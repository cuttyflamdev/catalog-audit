// Return true if value is null or undefined
// or when value is an empty string after trimming whitespace
// false otherwise
function isBlank(value) {
  if (value === null || value === undefined) return true;
  if (value.trim() === '') return true;
  return false;
}

// Returns lists of empty skus, description, and zero inventory
export function audit(products) {
  const productCount = products.length;
  let variantCount = 0;
  const skuFindings = [];
  const descriptionFindings = [];
  const inventoryFindings = [];
  products.forEach((product) => {
    const variants = product.variants.edges.map((edge) => edge.node);
    variantCount += variants.length;
    const productFields = {
      handle: product.handle,
      productId: product.id,
      productTitle: product.title,
      productStatus: product.status,
    };
    if (isBlank(product.description)) {
      descriptionFindings.push(productFields);
    }
    variants.forEach((variant) => {
      const option1 = variant.selectedOptions[0]?.value;
      const variantFields = {
        variantId: variant.id,
        variantTitle: variant.title,
        option1,
      };
      if (isBlank(variant.sku)) {
        skuFindings.push({ ...productFields, ...variantFields });
      }
      if (variant.inventoryQuantity === 0) {
        inventoryFindings.push({ ...productFields, ...variantFields });
      }
    });
  });
  return {
    productCount,
    variantCount,
    skuFindings,
    descriptionFindings,
    inventoryFindings,
  };
}
