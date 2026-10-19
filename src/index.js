import { graphql } from "./shopify.js";

const query = `
  {
    products(first: 50) {
        edges {
            node {
                id
                title
                status
                variants(first: 20) {
                  edges {
                    node {
                      id
                      sku
                      inventoryQuantity
                    }  
                  }
                }
            }
        }
    }
  }
`;

async function main() {
    const { data, extensions } = await graphql(query);
    console.log(JSON.stringify(data, null, 2));
    const requestedQueryCost = extensions.cost.requestedQueryCost;
    const actualyQueryCost = extensions.cost.actualQueryCost;
    const throttleStatus = extensions.cost.throttleStatus;
    console.log(`Requested query cost: ${requestedQueryCost}`);
    console.log(`Actual query cost: ${actualyQueryCost}`);
    console.log(`Throttle status: ${JSON.stringify(throttleStatus, null, 2)}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

