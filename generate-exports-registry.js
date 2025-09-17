/**
 * Script: generate-exports-registry.js
 * -----------------------------------------------------------
 * Scans all .js files in ./src/, extracts named exports, writes src/exports.index.json
 * Usage: node generate-exports-registry.js
 * -----------------------------------------------------------
 */

import fs from 'fs';
import path from 'path';

// Directory to scan
const SRC_DIR = path.resolve('./src');
const OUTPUT_FILE = path.resolve(SRC_DIR, 'exports.index.json');

// Utility: get all .js files in src/
function getJsFiles(dir) {
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.js'))
    .map(f => path.join(dir, f));
}

// Utility: extract named exports from JS file
function extractExports(filePath) {
  const code = fs.readFileSync(filePath, 'utf-8');
  const exportNames = new Set();

  // Match: export function/export const/export let/export var/export class
  const namedExportRegex = /export\s+(?:function|const|let|var|class)\s+([a-zA-Z0-9_]+)/g;
  let match;
  while ((match = namedExportRegex.exec(code))) {
    exportNames.add(match[1]);
  }

  // Match: export { ... }
  const curlyExportRegex = /export\s*{\s*([^}]+)\s*}/g;
  while ((match = curlyExportRegex.exec(code))) {
    const items = match[1].split(',').map(s => s.trim().replace(/ as .+$/, ''));
    items.forEach(name => exportNames.add(name));
  }

  // Optionally: export default (don't list default exports)
  // if (code.includes('export default')) exportNames.add('default');

  return Array.from(exportNames);
}

// Main
function main() {
  const files = getJsFiles(SRC_DIR);
  const registry = {};

  files.forEach(filePath => {
    const fileName = path.basename(filePath);
    const exports = extractExports(filePath);
    if (exports.length > 0) {
      registry[fileName] = exports;
    }
  });

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(registry, null, 2), 'utf-8');
  console.log(`Export registry written to ${OUTPUT_FILE}`);
}

main();
