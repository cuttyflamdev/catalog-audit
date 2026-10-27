import { error } from "node:console";
import { graphql } from "./shopify.js";

const query = /* GraphQL */ `
  query ($first: Int!, $cursor: String, $query: String) {
    products(first: $first, after: $cursor, query: $query) {
        edges {
            node {
                id
                title
                status
                variants(first: 250) {
                  edges {
                    node {
                      id
                      sku
                      inventoryQuantity
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

function getCounts(products) {
  const productCount = products.length;
  let variantCount = 0;
  products.forEach(product => {
    variantCount += product.variants.edges.length;
  });
  return { productCount, variantCount};
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

  const { productCount, variantCount } = getCounts(products);
  console.log(`Product count: ${productCount}`);
  console.log(`Variant count: ${variantCount}`);

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

fetchAllProducts(250, "tag:audit-seed").catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

