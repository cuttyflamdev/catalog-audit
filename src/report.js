export function buildRows(skuFindings, inventoryFindings, descriptionFindings) {
  const rows = [];
  const groups = [
    ['empty_sku', skuFindings],
    ['zero_inventory', inventoryFindings],
    ['empty_description', descriptionFindings],
  ];
  for (const [issue, findings] of groups) {
    const sortedFindings = [...findings].sort((a, b) =>
      a.handle.localeCompare(b.handle),
    );
    sortedFindings.forEach((finding) => {
      rows.push(toRow(issue, finding));
    });
  }
  return rows;
}

function toRow(issue, finding) {
  return {
    issue,
    productId: finding.productId,
    variantId: finding.variantId ?? '',
    handle: finding.handle,
    productTitle: finding.productTitle,
    variantTitle: finding.variantTitle ?? '',
    productStatus: finding.productStatus,
  };
}

export const columns = [
  { key: 'issue', label: 'Issue' },
  { key: 'productId', label: 'Product ID' },
  { key: 'variantId', label: 'Variant ID' },
  { key: 'handle', label: 'Handle' },
  { key: 'productTitle', label: 'Product Title' },
  { key: 'variantTitle', label: 'Variant Title' },
  { key: 'productStatus', label: 'Product Status' },
];
