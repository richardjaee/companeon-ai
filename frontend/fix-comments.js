#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, 'src');
const exts = new Set(['.ts', '.tsx', '.js', '.jsx']);

function listFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    const st = fs.statSync(p);
    if (st.isDirectory()) listFiles(p, out);
    else if (exts.has(path.extname(p))) out.push(p);
  }
  return out;
}

function cleanCommentText(text) {
  // Remove common emojis and symbols
  const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}\u{200D}]/gu;
  let s = text.replace(emojiRe, '');

  // Tone down conversational/AI-like phrasing
  s = s.replace(/\b(as\s+per|per)\s+(your|the)\s+request\b/gi, 'updated');
  s = s.replace(/\brefactor(?:ed|ing)?\b/gi, 'updated');
  s = s.replace(/\bAI\b/g, 'assistant');
  s = s.replace(/let[’']?s/gi, ''); // remove "let's" tone
  s = s.replace(/^\s*I\s+/g, 'It '); // line-leading I -> It

  // Trim extra spaces
  s = s.replace(/\s{2,}/g, ' ');
  return s;
}

function processFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    // Handle block comments /* ... */ possibly spanning lines
    if (inBlock) {
      const endIdx = line.indexOf('*/');
      const content = endIdx === -1 ? line : line.slice(0, endIdx);
      const cleaned = cleanCommentText(content);
      line = cleaned + (endIdx === -1 ? '' : line.slice(endIdx));
      if (endIdx !== -1) inBlock = false;
      lines[i] = line;
      continue;
    }
    const blockStart = line.indexOf('/*');
    const lineCommentMatch = line.match(/^\s*\/\/.*$/);

    if (lineCommentMatch) {
      const idx = line.indexOf('//');
      const before = line.slice(0, idx);
      const comment = line.slice(idx);
      const cleaned = cleanCommentText(comment);
      lines[i] = before + cleaned;
      continue;
    }

    if (blockStart !== -1) {
      const endIdx = line.indexOf('*/', blockStart + 2);
      if (endIdx !== -1) {
        // single-line block comment
        const before = line.slice(0, blockStart);
        const mid = line.slice(blockStart, endIdx + 2);
        const after = line.slice(endIdx + 2);
        const cleaned = mid.replace(/\/\*([\s\S]*?)\*\//g, (m, inner) => `/*${cleanCommentText(inner)}*/`);
        lines[i] = before + cleaned + after;
      } else {
        // start block
        const before = line.slice(0, blockStart);
        const mid = line.slice(blockStart);
        const cleaned = cleanCommentText(mid);
        lines[i] = before + cleaned;
        inBlock = true;
      }
    }
  }
  const out = lines.join('\n');
  if (out !== src) {
    fs.writeFileSync(file, out, 'utf8');
    return true;
  }
  return false;
}

const files = listFiles(root);
let changed = 0;
for (const f of files) {
  if (processFile(f)) changed++;
}
console.log(`Processed ${files.length} files. Updated ${changed}.`);
