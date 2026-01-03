#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const exts = ['.tsx', '.ts', '.jsx', '.js', '.json'];

function resolveImport(baseFile, spec) {
  if (!spec) return null;
  if (/^(react|next|@tanstack|ethers|@sentry|@heroicons|@vercel|viem|zustand|wagmi|clsx|tailwindcss|lucide)/.test(spec)) return null;
  if (/^(node:|https?:|fs$|path$|process$)/.test(spec)) return null;

  let p = spec;
  if (spec.startsWith('@/')) p = path.resolve('src', spec.slice(2));
  else if (spec.startsWith('./') || spec.startsWith('../')) p = path.resolve(path.dirname(baseFile), spec);
  else return null; // external

  if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  for (const ext of exts) {
    if (fs.existsSync(p + ext)) return p + ext;
  }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
    for (const ext of exts) {
      const idx = path.join(p, 'index' + ext);
      if (fs.existsSync(idx)) return idx;
    }
  }
  return null;
}

function parseImports(src) {
  const out = [];
  const importRe = /import\s+(?:[^'";]+\s+from\s+)?['\"]([^'\"]+)['\"]/g;
  const dynamicRe = /import\(\s*['\"]([^'\"]+)['\"]\s*\)/g;
  let m;
  while ((m = importRe.exec(src))) out.push(m[1]);
  while ((m = dynamicRe.exec(src))) out.push(m[1]);
  return out;
}

function crawl(root) {
  const visited = new Set();
  const queue = [root];
  while (queue.length) {
    const f = queue.pop();
    if (!f || visited.has(f)) continue;
    if (!fs.existsSync(f) || !fs.statSync(f).isFile()) continue;
    visited.add(f);
    const src = fs.readFileSync(f, 'utf8');
    const specs = parseImports(src);
    for (const s of specs) {
      const r = resolveImport(f, s);
      if (r && !visited.has(r)) queue.push(r);
    }
  }
  return visited;
}

function main() {
  if (process.argv.length < 3) {
    
    process.exit(1);
  }
  const root = path.resolve(process.argv[2]);
  const visited = crawl(root);
  const list = Array.from(visited).sort();
  
  for (const f of list) ;
}

main();

