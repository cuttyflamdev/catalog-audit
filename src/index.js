import { fetchAllProducts } from './product.js';
import { verifyFindings, printVerification, hasDifferences } from './verify.js';
import { buildRows, columns } from './report.js';
import { writeCsv, toCsv } from './csv.js';
import { audit } from './audit.js';

const manifestPath = 'data/seed-manifest.json';
const reportPath = 'output/audit-report.csv';
const pageSize = 250;
const searchString = 'tag:audit-seed';

async function main() {
  const products = await fetchAllProducts(pageSize, searchString);
  const auditResult = audit(products);
  console.log(`Product count: ${auditResult.productCount}`);
  console.log(`Variant count: ${auditResult.variantCount}`);
  const results = await verifyFindings(auditResult, manifestPath);
  printVerification(results);
  if (hasDifferences(results)) {
    process.exitCode = 1;
  }
  const rows = buildRows(
    auditResult.skuFindings,
    auditResult.inventoryFindings,
    auditResult.descriptionFindings,
  );
  const content = toCsv(columns, rows);
  await writeCsv(reportPath, content);
  console.log(`Wrote ${rows.length} rows to ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
