import { readFile } from 'node:fs/promises';

// positive means the audit found it and the manifest didn’t list it
// negative means the manifest planted it and the audit missed it
export function compare(found, expected, keyOf) {
  const counts = new Map();
  found.forEach((item) => {
    const key = keyOf(item);
    const value = (counts.get(key) ?? 0) + 1;
    counts.set(key, value);
  });
  expected.forEach((item) => {
    const key = keyOf(item);
    const value = (counts.get(key) ?? 0) - 1;
    counts.set(key, value);
  });
  const differences = [];
  for (const [key, count] of counts) {
    if (count !== 0) {
      differences.push({ key, count });
    }
  }
  return differences;
}

function checkList(label, found, expected, keyOf) {
  const differences = compare(found, expected, keyOf);
  return { label, count: found.length, differences };
}

export async function verifyFindings(findings, manifestPath) {
  const { skuFindings, inventoryFindings, descriptionFindings } = findings;
  const text = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(text);
  const skuResult = checkList(
    'empty SKUs',
    skuFindings,
    manifest.empty_sku,
    (item) => item.handle + '|' + item.option1,
  );
  const inventoryResult = checkList(
    'zero inventory',
    inventoryFindings,
    manifest.zero_inventory,
    (item) => item.handle + '|' + item.option1,
  );
  const descriptionHandles = descriptionFindings.map(
    (finding) => finding.handle,
  );
  const descriptionResult = checkList(
    'empty description',
    descriptionHandles,
    manifest.empty_description,
    (item) => item,
  );
  return [skuResult, inventoryResult, descriptionResult];
}

export function printVerification(results) {
  results.forEach((result) => {
    if (result.differences.length === 0) {
      console.log(`${result.label}: match (${result.count})`);
    } else {
      console.log(`${result.label} differences:`);
      console.log(result.differences);
    }
  });
}

export function hasDifferences(results) {
  return results.some((result) => result.differences.length !== 0);
}
