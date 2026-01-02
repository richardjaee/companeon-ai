#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function main() {
  const hooksDir = path.resolve('src/hooks');
  if (!fs.existsSync(hooksDir)) {
    console.log('No src/hooks directory');
    return;
  }

  const hooks = fs.readdirSync(hooksDir).filter(f => /\.(ts|tsx)$/.test(f));
  const results = [];
  for (const file of hooks) {
    const name = file.replace(/\.(ts|tsx)$/,'');
    let count = 0;
    try {
      const cmd = `rg -n "from ['\\\"](.*/)?${name}['\\\"]|@/hooks/${name}\\b" src | wc -l`;
      count = parseInt(execSync(cmd, {stdio:['ignore','pipe','ignore']}).toString().trim(), 10);
    } catch {
      count = 0;
    }
    results.push({ file, imports: isNaN(count) ? 0 : count });
  }

  results.sort((a,b)=>a.imports-b.imports);
  const unused = results.filter(r => r.imports === 0);

  console.log('Hook usage counts (0 means never imported):');
  for (const r of results) {
    console.log(`${r.file}: ${r.imports}`);
  }

  if (unused.length) {
    console.log('\nPotentially unused hooks:');
    for (const r of unused) console.log(` - ${r.file}`);
  }
}

main();

