#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const workspace = path.resolve(__dirname, 'src');
const aliasPrefix = '@/';
const exts = ['.tsx', '.ts', '.jsx', '.js'];

// Roots: app routes/pages, dashboard view, pages/api
function gatherRoots() {
  const roots = new Set();
  const candidates = [
    path.join(workspace, 'app'),
    path.join(workspace, 'components/Dashboard/views/PortfolioView.tsx'),
    path.join(workspace, 'pages/api'),
  ];
  for (const c of candidates) {
    if (!fs.existsSync(c)) continue;
    const stat = fs.statSync(c);
    if (stat.isFile()) {
      roots.add(c);
    } else if (stat.isDirectory()) {
      for (const p of listFiles(c)) roots.add(p);
    }
  }
  return Array.from(roots);
}

function listFiles(dir, out = []) {
  const entries = fs.readdirSync(dir);
  for (const e of entries) {
    const p = path.join(dir, e);
    const st = fs.statSync(p);
    if (st.isDirectory()) listFiles(p, out);
    else if (exts.includes(path.extname(p))) out.push(p);
  }
  return out;
}

function readFileSafe(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }
function resolveImport(fromFile, spec) {
  if (!spec || spec.startsWith('http') || spec.startsWith('data:')) return null;
  let target = spec;
  if (spec.startsWith(aliasPrefix)) target = spec.replace(aliasPrefix, workspace + '/');
  else if (spec.startsWith('./') || spec.startsWith('../')) target = path.resolve(path.dirname(fromFile), spec);
  else return null; // external
  for (const ext of exts) {
    const candidate = target.endsWith(ext) ? target : target + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    for (const ext of exts) {
      const idx = path.join(target, 'index' + ext);
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
  for (const re of [importRegex, exportFromRegex, dynamicImportRegex]) { let m; while ((m = re.exec(src))) specs.push(m[1]); }
  for (const spec of specs) { const resolved = resolveImport(filePath, spec); if (resolved) collectImports(resolved, seen); }
  return seen;
}

function isProtected(p) {
  // Always protect Next app and pages/api, styles, d.ts, config, middleware
  if (p.includes(path.sep + 'app' + path.sep)) return true;
  if (p.includes(path.sep + 'pages' + path.sep + 'api' + path.sep)) return true;
  if (p.includes(path.sep + 'styles' + path.sep)) return true;
  if (p.endsWith('.d.ts')) return true;
  if (p.endsWith('next.config.js')) return true;
  if (p.endsWith('middleware.ts')) return true;
  return false;
}

const roots = gatherRoots();
const reachable = new Set();
for (const r of roots) collectImports(r, reachable);

// Consider all modules in src (ts/tsx/js/jsx)
const all = listFiles(workspace);
const candidates = all.filter(f => !isProtected(f));
const unreachable = candidates.filter(f => !reachable.has(f));

console.log('Roots:', roots.map(r => r.replace(workspace + '/', '')).length);
console.log('Reachable modules:', reachable.size);
console.log('Unreachable modules:', unreachable.length);
for (const u of unreachable) console.log('  - ' + u.replace(workspace + '/', 'src/'));

if (process.argv.includes('--delete')) {
  for (const f of unreachable) {
    try { fs.unlinkSync(f); } catch {}
  }
  console.log('Deleted', unreachable.length, 'files.');
}
