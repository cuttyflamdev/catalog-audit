import { graphql } from "./shopify.js";
import { readFile } from "node:fs/promises";

const text = await readFile("data/seed-manifest.json", "utf8");
const manifest = JSON.parse(text);

const query = /* GraphQL */ `
  query ($first: Int!, $cursor: String, $query: String) {
    products(first: $first, after: $cursor, query: $query) {
        edges {
            node {
                id
                title
                handle
                status
                description
                variants(first: 250) {
                  edges {
                    node {
                      id
                      title
                      sku
                      inventoryQuantity
                      selectedOptions {
                        name
                        value
                      }
                    }  
                  } 
                  pageInfo {
                    hasNextPage
                    endCursor
                  }  
                }
            }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
    }
  }
`;

// Return true if value is null or undefined
// or when value is an empty string after trimming whitespace
// false otherwise
function isBlank(value) {
  if (value === null || value === undefined) return true;
  if (value.trim() === "") return true;
  return false;
}

// Return lists of empty skus, description, and 0 inventory
function audit(products) {
  const productCount = products.length;
  let variantCount = 0;
  const skuFindings = [];
  const descriptionFindings = [];
  const inventoryFindings = [];
  products.forEach(product => {
    const variants = product.variants.edges.map((edge) => edge.node);
    variantCount += variants.length;
    if (isBlank(product.description)) {
      descriptionFindings.push(product.handle);
    }
    variants.forEach(variant => {
      if (isBlank(variant.sku)) {
        const skuFinding = {
          "handle": product.handle,
          "option1": variant.selectedOptions[0]?.value
        };
        skuFindings.push(skuFinding);
      }
      if (variant.inventoryQuantity === 0) {
        const inventoryFinding = {
          "handle": product.handle,
          "option1": variant.selectedOptions[0]?.value,
          "sku": variant.sku
        };
        inventoryFindings.push(inventoryFinding);
      }
    })
  })
  return { productCount, variantCount, skuFindings, descriptionFindings, inventoryFindings };
}

function compare (found, expected, keyOf) {
  const counts = new Map();
  found.forEach(item => {
    const key = keyOf(item);
    const value = (counts.get(key) ?? 0) + 1;
    counts.set(key, value);
  })
  expected.forEach(item => {
    const key = keyOf(item);
    const value = (counts.get(key) ?? 0) - 1;
    counts.set(key, value);
  })
  const differences = [];
  for (const [key, count] of counts) {
    if (count != 0) {
      differences.push( {key, count} );
    }
  }
  return differences;
}

async function fetchAllProducts(pageSize, search) {
  const products = [];
  let cursor = null;
  let estimate = 0;
  let pageNumber = 0;

  while (true) {
    pageNumber += 1;
    const {data, extensions} = await graphql(query, { first: pageSize, cursor, query: search });
    const page = data.products;
    const requestedQueryCost = extensions.cost.requestedQueryCost;
    const actualQueryCost = extensions.cost.actualQueryCost;
    const throttleStatus = extensions.cost.throttleStatus;
    estimate = requestedQueryCost;
    console.log(`Page number: ${pageNumber}`);
    console.log(`Number of products: ${page.edges.length} `);
    console.log(`Requested query cost: ${requestedQueryCost}`);
    console.log(`Actual query cost: ${actualQueryCost}`);
    console.log(`Currently available: ${throttleStatus.currentlyAvailable}`);
    page.edges.forEach(edge => {
      if (edge.node.variants.pageInfo.hasNextPage) {
        throw new Error(`Variants of product ${edge.node.title} were cutoff.`);
      }
    })
    products.push(...page.edges.map((edge) => edge.node));
    if (!page.pageInfo.hasNextPage) {
      break;
    }
    cursor = page.pageInfo.endCursor;
    const wait = secondsToWait(throttleStatus, estimate);
    await sleep(wait);
  }
  return products;
}

function sleep(seconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  })
}

function secondsToWait(throttleStatus, needed) {
  if (throttleStatus.currentlyAvailable >= needed)
    return 0;
  else
    return (needed - throttleStatus.currentlyAvailable) / throttleStatus.restoreRate
}

async function main() {
  const products = await fetchAllProducts(250, "tag:audit-seed");
  const { productCount, variantCount, skuFindings, descriptionFindings, inventoryFindings } = audit(products);
  console.log(`Product count: ${productCount}`);
  console.log(`Variant count: ${variantCount}`);
  const skuDifferences = compare(skuFindings, manifest.empty_sku, (item) => item.handle + "|" + item.option1);
  if (skuDifferences.length === 0) {
    console.log(`empty SKUs: match (${skuFindings.length})`);
  }
  else {
    console.log("empty SKUs differences:");
    console.log(skuDifferences);
  }
  const descriptionDifferences = compare(descriptionFindings, manifest.empty_description, (item) => item );
  if (descriptionDifferences.length === 0) {
    console.log(`empty description: match (${descriptionFindings.length})`);
  }
  else {
    console.log("empty description differences");
    console.log(descriptionDifferences);
  }
  const inventoryDifferences = compare(inventoryFindings, manifest.zero_inventory, (item) => item.handle + "|" + item.option1);
  if (inventoryDifferences.length === 0) {
    console.log(`zero inventory: match (${inventoryFindings.length})`);
  }
  else {
    console.log("zero inventory differences:");
    console.log(inventoryDifferences);
  }
  
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

