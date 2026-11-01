# Catalog Audit

A read-only script that scans a Shopify catalog through the Admin GraphQL API and reports three problems: variants with no SKU, variants with zero inventory, and products with an empty description. It writes the findings to a CSV file and checks them against a manifest of planted defects.

I built it to learn how Shopify's cost-based rate limits, product queries and connection pagination behave in practice. All data in this repo is synthetic and comes from a development store.

## What it does

1. Reads products page by page (250 per page), each with all of its variants. A search string limits the run; the seed data uses `tag:audit-seed`. With no search string it reads the whole catalog.
2. Flags:
   - variants whose SKU is blank
   - variants whose inventory quantity is exactly 0
   - products whose description is blank
3. Compares each list of findings with `data/seed-manifest.json`, which records exactly which items were planted, and prints `match` or the differences.
4. Writes one row per finding to `output/audit-report.csv`.
5. Exits with code 0 when all three checks match the manifest, and 1 otherwise.

"Blank" means `null`, `undefined`, or a string that is empty after trimming whitespace.

The manifest check only makes sense on the seeded store. On a real catalog there is no manifest, and the audit report is the output.

## Setup

Requirements: Node (developed on v24.22.1) and a Shopify development store.

1. In the Dev Dashboard, create an app with the `read_products` scope only, set the API version to 2026-10, release a version, and install the app on the store.
2. Copy .env.example to .env and fill in SHOPIFY_SHOP (your store’s name), SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET from the Dev Dashboard. The app authenticates with the client credentials grant.
3. Run from the repo root:

```
node src/index.js
```

Run it from the repo root: the manifest and report paths (`data/seed-manifest.json`, `output/audit-report.csv`) are relative to the folder you start `node` from.

## Why the app is read-only

The app has the `read_products` scope and nothing else, so the audit cannot change store data. Fixing the findings would be a separate write-scoped app.

This was a design choice, not a limitation. Shopify's documentation says a Dev Dashboard app's scopes are changed by releasing a new version with the scopes you want.

## Sample output

Run against the seeded store:

```
Page number: 1
Number of products: 250
Requested query cost: 277
Actual query cost: 35
Currently available: 19965
Page number: 2
Number of products: 50
Requested query cost: 277
Actual query cost: 9
Currently available: 19991
Product count: 300
Variant count: 449
empty SKUs: match (30)
zero inventory: match (20)
empty description: match (15)
Wrote 65 rows to output/audit-report.csv
```

## The report

`output/audit-report.csv` has one row per finding (65 rows for the seed data: 30 + 20 + 15). The columns are:

`issue`, `productId`, `variantId`, `handle`, `productTitle`, `variantTitle`, `productStatus`

- `issue` is `empty_sku`, `zero_inventory` or `empty_description`.
- Rows are grouped by issue in that order, then sorted by handle.
- `variantId` and `variantTitle` are blank on description rows, because that problem belongs to the product.
- IDs are the full `gid://shopify/...` strings the API returns, so a later write step can use them directly.
- Values containing commas, double quotes or line breaks are quoted and escaped. I tested the escaping on a made-up value, `Tote, "Large"`, which came out as `"Tote, ""Large"""`.

## Seed data

The development store held 17 products from earlier work (26 variants). I added 300 seeded products (449 variants), all tagged `audit-seed`, so the search filter separates them from the originals. An unfiltered run returns 317 products and 475 variants, and the filtered run returns 300 and 449.

Planted defects:

| Defect            | Count       | Note                                                         |
| ----------------- | ----------- | ------------------------------------------------------------ |
| Empty SKU         | 30 variants | 3 of them are on the big product, past its first 20 variants |
| Zero inventory    | 20 variants |                                                              |
| Empty description | 15 products |                                                              |

One product, `audit-300-big-variants`, has 28 variants (7 sizes x 4 colors). It exists to test truncation of long variant lists.

`data/seed-manifest.json` lists the exact handles and option values for every planted defect, so the audit can be checked item by item and not only by count.

How the data got into the store:

- I imported the products with Shopify's product CSV import.
- Quantities from the product CSV did not import. The dev store has multiple locations, and Shopify's help center says the `Inventory quantity` column in the product CSV is only for stores with a single location.
- I imported the quantities with Shopify's inventory CSV instead, setting stock only at `Shop location`. The store has two other locations; one of them is managed by the Shopify Test Data app, and I left both out.

## What I measured

### Rate limits and page size

Shopify limits API use by calculated query cost, not by request count. According to shopify.dev, a connection returns at most 250 items per page, and a single query cannot cost more than 1,000 points.

My development store reports a 20,000 point bucket that restores 1,000 points per second. Every response includes `extensions.cost` with the requested cost, the actual cost and the bucket status (`throttleStatus`), and the reader logs them for every page. It reads the bucket status from the response and does not hard-code any limits.

Measured on a full first page of 250 products:

| Variants requested per product | Extra fields      | Requested cost | Actual cost |
| ------------------------------ | ----------------- | -------------- | ----------- |
| 20                             | none              | 90             | 46          |
| 250                            | none              | 156            | 35          |
| 250                            | `selectedOptions` | 277            | 35          |

All three are far below the 1,000 point single-query limit. I did not investigate why the actual cost went down when I asked for more variants.

The reader is written to wait when the bucket cannot cover the next request, but that branch has never run. The bucket was nearly full before every page I fetched, so I have not tested it.

### Silent truncation of variants

My first version asked for `variants(first: 20)`. The full catalog has 475 variants, and that query returned 467. The eight missing variants belong to the 28-variant product, and nothing in the response said they were missing. An audit built on that query would have found 27 of the 30 empty SKUs.

I raised the limit to 250 and added `pageInfo { hasNextPage }` on the variants. If any product still has more variants than were returned, the run stops with an error that names the product. I tested the guard by setting the limit back to 20, and it stopped on the big product.

### Empty SKU and empty description look different

By printing the raw values, I found that an empty SKU comes back as `null`, while an empty description comes back as an empty string. Comparing with `=== ""` would have missed every empty SKU, so both fields go through the same blank check.

### Checking the audit against the manifest

Matching counts is not enough, because one wrong item and one missed item cancel out. The comparison counts occurrences per key (product handle plus first option value). It has to count, and not just check membership, because two of the big product's empty-SKU variants share the same key.

I tested the comparison by editing the manifest four ways. Each edit was caught, with the right key and the right sign:

1. Deleted one empty-SKU entry.
2. Changed one empty-SKU entry to a different option value, so the total stayed at 30.
3. Deleted one of the two entries that share a key.
4. Swapped one handle in the empty-description list for another real handle.

I also checked the exit code: 1 on a mismatch and 0 on a match.

## Known limits and what I did not test

- Dev store rate limits may be far more generous than a typical merchant's. I only tested on this store.
- A product with more than 250 variants stops the run. I did not look up Shopify's maximum number of variants per product.
- I did not verify how `inventoryQuantity` is defined across locations on shopify.dev. In my seed data only one location holds stock, so the data does not test that question.
- All seeded products were active, so I have not tested products with draft or archived status. The status is included in the report.
- I did not test descriptions that contain only markup.
- Bulk operations are not implemented. For a very large catalog they would be the next thing to try.
- There are no automated tests. The check against the manifest is the verification.

## Project layout

```
src/index.js      main: fetch, audit, verify, write the report
src/products.js   the GraphQL query, pagination, waiting on the rate limit
src/audit.js      finds the three kinds of problems
src/verify.js     compares findings with the manifest
src/report.js     builds the report rows and columns
src/csv.js        CSV serializer and file writer
src/shopify.js    GraphQL request helper (returns data and cost extensions)
src/config.js     environment variables
data/             seed-manifest.json
output/           generated report (not committed)
```
