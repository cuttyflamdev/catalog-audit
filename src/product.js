import { graphql } from './shopify.js';

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

function sleep(seconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
}

function secondsToWait(throttleStatus, needed) {
  if (throttleStatus.currentlyAvailable >= needed) return 0;
  else
    return (
      (needed - throttleStatus.currentlyAvailable) / throttleStatus.restoreRate
    );
}

export async function fetchAllProducts(pageSize, search) {
  const products = [];
  let cursor = null;
  let pageNumber = 0;

  while (true) {
    pageNumber += 1;
    const { data, extensions } = await graphql(query, {
      first: pageSize,
      cursor,
      query: search,
    });
    const page = data.products;
    const requestedQueryCost = extensions.cost.requestedQueryCost;
    const actualQueryCost = extensions.cost.actualQueryCost;
    const throttleStatus = extensions.cost.throttleStatus;
    console.log(`Page number: ${pageNumber}`);
    console.log(`Number of products: ${page.edges.length} `);
    console.log(`Requested query cost: ${requestedQueryCost}`);
    console.log(`Actual query cost: ${actualQueryCost}`);
    console.log(`Currently available: ${throttleStatus.currentlyAvailable}`);
    page.edges.forEach((edge) => {
      if (edge.node.variants.pageInfo.hasNextPage) {
        throw new Error(`Variants of product ${edge.node.title} were cutoff.`);
      }
    });
    products.push(...page.edges.map((edge) => edge.node));
    if (!page.pageInfo.hasNextPage) {
      break;
    }
    cursor = page.pageInfo.endCursor;
    const wait = secondsToWait(throttleStatus, requestedQueryCost);
    await sleep(wait);
  }
  return products;
}
