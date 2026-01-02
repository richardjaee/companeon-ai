#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const exts = ['.tsx', '.ts', '.jsx', '.js', '.json', '.d.ts'];

function resolveImport(baseFile, spec) {
  if (!spec) return null;
  if (/^(react|next|@tanstack|ethers|@sentry|@heroicons|@vercel|viem|zustand|wagmi|clsx|tailwindcss|lucide)/.test(spec)) return null;
  if (/^(node:|https?:|fs$|path$|process$)/.test(spec)) return null;

  let p = spec;
  if (spec.startsWith('@/')) p = path.resolve('src', spec.slice(2));
  else if (spec.startsWith('./') || spec.startsWith('../')) p = path.resolve(path.dirname(baseFile), spec);
  else return null; // bare module -> external

  // if points to a file with extension
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  for (const ext of exts) {
    if (fs.existsSync(p + ext)) return p + ext;
  }
  // index resolution
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

function crawl(roots) {
  const visited = new Set();
  const queue = [...roots];
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
  const args = process.argv.slice(2);
  const showAll = args.includes('--all');
  const rootsArgIndex = args.indexOf('--roots');

  const defaultRoots = [
    'src/components/Dashboard/views/PortfolioView.tsx',
    'src/components/Chat/CompaneonChatInterface.tsx',
    'src/components/Dashboard/views/AgentPermissionsView.tsx',
    'src/app/[chain]/portfolio/components/cryptoBalance.tsx',
    'src/app/[chain]/portfolio/components/nftBalance.tsx',
  ];
  const rootsList = rootsArgIndex !== -1
    ? args.slice(rootsArgIndex + 1).filter(a => !a.startsWith('--'))
    : [];

  const roots = (rootsList.length ? rootsList : defaultRoots)
    .map(p => path.resolve(p))
    .filter(p => fs.existsSync(p));
  if (!roots.length) {
    console.error('No valid roots provided.');
    process.exit(1);
  }
  const reachable = crawl(roots);
  const allFiles = [];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir)) {
      const p = path.join(dir, ent);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (exts.includes(path.extname(p))) allFiles.push(p);
    }
  }
  walk(path.resolve('src'));

  const unreachable = allFiles.filter(f => !reachable.has(f));

  console.log('Reachable files count:', reachable.size);
  if (showAll) {
    console.log('All unreachable files:');
    for (const f of unreachable.sort()) console.log(' -', path.relative(process.cwd(), f));
  } else {
    const focus = unreachable.filter(f => /\/lib\/api\/|\/app\/api\//.test(f) || /(leaderboard|rewards)/i.test(f));
    console.log('Unreachable files (focused on api/* and leaderboard|rewards):');
    for (const f of focus.sort()) console.log(' -', path.relative(process.cwd(), f));
    console.log("\nTip: pass --all to see every unreachable file.");
  }
}

main();
