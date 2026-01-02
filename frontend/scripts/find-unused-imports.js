#!/usr/bin/env node
const fs = require('fs');

if (process.argv.length < 3) {
  console.error('Usage: node scripts/find-unused-imports.js <file>');
  process.exit(1);
}

const file = process.argv[2];
const src = fs.readFileSync(file, 'utf8');
const lines = src.split(/\r?\n/);

const importRegex = /^import\s+(.+)\s+from\s+['\"]([^'\"]+)['\"];?\s*$/;
const sideEffectImport = /^import\s+['\"][^'\"]+['\"];?$/;

const imports = [];
for (const line of lines) {
  if (sideEffectImport.test(line)) continue;
  const m = line.match(importRegex);
  if (!m) continue;
  const clause = m[1];
  const source = m[2];
  const entry = { source, default: null, named: [], namespace: null, raw: line };
  if (clause.startsWith('* as ')) {
    entry.namespace = clause.replace('* as ', '').trim();
  } else if (clause.startsWith('{')) {
    const inner = clause.replace(/[{}]/g,'').trim();
    if (inner.length) {
      inner.split(',').forEach(part => {
        const [name, alias] = part.trim().split(/\s+as\s+/);
        entry.named.push((alias || name).trim());
      });
    }
  } else if (/^\w+\s*,\s*{/.test(clause)) {
    const def = clause.split(',')[0].trim();
    entry.default = def;
    const inner = clause.replace(/^\w+\s*,\s*/, '');
    const names = inner.replace(/[{}]/g,'').trim();
    if (names.length) names.split(',').forEach(part => {
      const [name, alias] = part.trim().split(/\s+as\s+/);
      entry.named.push((alias || name).trim());
    });
  } else {
    entry.default = clause.trim();
  }
  imports.push(entry);
}

const body = lines.filter(l => !l.startsWith('import ')).join('\n');

function countUsage(id) {
  const re = new RegExp(`(^|[^\\w$])${id}([^\\w$]|$)`,'g');
  let count = 0; let m;
  while ((m = re.exec(body))) count++;
  return count;
}

const report = [];
for (const imp of imports) {
  if (imp.default) {
    const c = countUsage(imp.default);
    if (c === 0) report.push({identifier: imp.default, source: imp.source});
  }
  if (imp.namespace) {
    const c = countUsage(imp.namespace);
    if (c === 0) report.push({identifier: `* as ${imp.namespace}`, source: imp.source});
  }
  for (const n of imp.named) {
    const c = countUsage(n);
    if (c === 0) report.push({identifier: n, source: imp.source});
  }
}

if (report.length === 0) {
  console.log('No unused imports detected.');
} else {
  console.log('Potentially unused imports:');
  for (const r of report) {
    console.log(` - ${r.identifier} from ${r.source}`);
  }
}

