#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
// This script now uses reachability from Next.js roots to determine unused components

// Find all component files
function findComponentFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules') {
        findComponentFiles(filePath, fileList);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Extract component name from file path
function getComponentName(filePath) {
  const basename = path.basename(filePath, path.extname(filePath));
  return basename;
}

// Check if component is imported anywhere
function isComponentUsed(componentName, componentPath) {
  try {
    // Search for imports of this component
    const result = execSync(
      `grep -r "import.*${componentName}" src --include="*.tsx" --include="*.ts" | grep -v "${componentPath}"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    );
    return result.trim().length > 0;
  } catch (error) {
    // grep returns non-zero if no matches found
    return false;
  }
}

// Minimal resolver to compute reachability
const workspace = path.join(__dirname, 'src');
const aliasPrefix = '@/';
const exts = ['.tsx', '.ts', '.jsx', '.js'];

function readFileSafe(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }
function resolveImport(fromFile, spec) {
  if (!spec || spec.startsWith('http') || spec.startsWith('data:')) return null;
  let target = spec;
  if (spec.startsWith(aliasPrefix)) target = spec.replace(aliasPrefix, workspace + '/');
  else if (spec.startsWith('./') || spec.startsWith('../')) target = path.resolve(path.dirname(fromFile), spec);
  else return null;
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
function listFiles(dir, out = []) { if (!fs.existsSync(dir)) return out; for (const e of fs.readdirSync(dir)) { const p = path.join(dir, e); const st = fs.statSync(p); if (st.isDirectory()) listFiles(p, out); else if (exts.includes(path.extname(p))) out.push(p); } return out; }

// Roots: PortfolioView + Next app
const roots = [
  path.resolve(workspace, 'components/Dashboard/views/PortfolioView.tsx'),
  path.resolve(workspace, 'app/layout.tsx'),
  path.resolve(workspace, 'app/[chain]/dashboard/page.tsx'),
  path.resolve(workspace, 'app/[chain]/dashboard/layout.tsx'),
  path.resolve(workspace, 'app/page.tsx'),
];
const reachable = new Set();
for (const r of roots) { if (fs.existsSync(r)) collectImports(r, reachable); }

const componentsDir = path.join(workspace, 'components');
const allComponents = listFiles(componentsDir);
const unused = allComponents.filter(f => !reachable.has(f));

if (unused.length === 0) {
  console.log('✓ No unused components (by reachability)');
} else {
  console.log(`Found ${unused.length} components not reachable from roots:`);
  unused.forEach(f => console.log('  - ' + f.replace(workspace + '/', 'src/')));
}
