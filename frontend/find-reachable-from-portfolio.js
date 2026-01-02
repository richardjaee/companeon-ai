#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const workspace = path.resolve(__dirname, 'src');
const roots = [
  path.resolve(workspace, 'components/Dashboard/views/PortfolioView.tsx'),
  path.resolve(workspace, 'app/layout.tsx'),
  path.resolve(workspace, 'app/[chain]/dashboard/page.tsx'),
  path.resolve(workspace, 'app/[chain]/dashboard/layout.tsx'),
  path.resolve(workspace, 'app/page.tsx'),
];
const aliasPrefix = '@/';

const exts = ['.tsx', '.ts', '.jsx', '.js'];

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function resolveImport(fromFile, spec) {
  if (!spec || spec.startsWith('http') || spec.startsWith('data:')) return null;
  if (spec.startsWith(aliasPrefix)) {
    spec = spec.replace(aliasPrefix, workspace + '/');
  } else if (spec.startsWith('./') || spec.startsWith('../')) {
    spec = path.resolve(path.dirname(fromFile), spec);
  } else {
    // external package
    return null;
  }

  // Try file directly
  for (const ext of exts) {
    const candidate = spec.endsWith(ext) ? spec : spec + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  // Try index in directory
  if (fs.existsSync(spec) && fs.statSync(spec).isDirectory()) {
    for (const ext of exts) {
      const idx = path.join(spec, 'index' + ext);
      if (fs.existsSync(idx)) return idx;
    }
  }
  return null;
}

function collectImports(filePath, seen = new Set()) {
  if (!filePath || seen.has(filePath)) return seen;
  seen.add(filePath);
  const src = readFileSafe(filePath);
  if (!src) return seen;
  const importRegex = /import\s+[^'"\n]+['\"]([^'\"]+)['\"]/g;
  const exportFromRegex = /export\s+[^'"\n]+from\s+['\"]([^'\"]+)['\"]/g;
  const dynamicImportRegex = /import\(\s*['\"]([^'\"]+)['\"]\s*\)/g;

  const specs = [];
  for (const re of [importRegex, exportFromRegex, dynamicImportRegex]) {
    let m;
    while ((m = re.exec(src))) specs.push(m[1]);
  }
  for (const spec of specs) {
    const resolved = resolveImport(filePath, spec);
    if (resolved) collectImports(resolved, seen);
  }
  return seen;
}

function listAllFiles(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir)) {
    const p = path.join(dir, e);
    const st = fs.statSync(p);
    if (st.isDirectory()) out = out.concat(listAllFiles(p));
    else out.push(p);
  }
  return out;
}

function isProtected(p) {
  // Keep Next.js app, middleware and config, plus public assets and styles
  if (p.includes(path.sep + 'app' + path.sep)) return true;
  if (p.endsWith('middleware.ts')) return true;
  if (p.endsWith('next.config.js')) return true;
  if (p.includes(path.sep + 'public' + path.sep)) return true;
  if (p.includes(path.sep + 'globals.css')) return true;
  if (p.includes(path.sep + 'styles' + path.sep)) return true; // Tailwind tokens, css helpers
  // Keep types d.ts
  if (p.endsWith('.d.ts')) return true;
  return false;
}

const reachable = new Set();
for (const r of roots) {
  if (fs.existsSync(r)) collectImports(r, reachable);
}
const all = listAllFiles(workspace).filter(f => exts.includes(path.extname(f)) || f.endsWith('.d.ts'));
const unreachable = all.filter(f => !reachable.has(f) && !isProtected(f));

console.log('Reachable count:', reachable.size);
console.log('Candidates to remove (unreachable, non-Next):', unreachable.length);
for (const f of unreachable) console.log(f.replace(workspace + '/', 'src/'));

if (process.argv.includes('--delete')) {
  for (const f of unreachable) {
    try { fs.unlinkSync(f); } catch {}
  }
  console.log('Deleted', unreachable.length, 'files.');
}
