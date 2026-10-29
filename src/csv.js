import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

function escapeField(value) {
  if (value === null || value === undefined) return '';
  // Check for double quote, comma, newline, and carriage return in value
  let text = String(value);
  if (/[",\n\r]/.test(text)) {
    text = text.replaceAll('"', '""');
    text = '"' + text + '"';
  }
  return text;
}

function toLine(values) {
  return values.map((value) => escapeField(value)).join(',');
}

export function toCsv(columns, rows) {
  const headerValues = columns.map((column) => column.label);
  const headerLine = toLine(headerValues);
  const rowLines = rows.map((row) => {
    const rowValues = columns.map((column) => row[column.key]);
    return toLine(rowValues);
  });
  return [headerLine, ...rowLines].join('\n') + '\n';
}

export async function writeCsv(path, text) {
  const folder = dirname(path);
  await mkdir(folder, { recursive: true });
  await writeFile(path, text, 'utf8');
}
