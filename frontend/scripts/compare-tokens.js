/**
 * Compare tokens-base-updated.ts with tokens.base.ts
 * and identify missing tokens
 */

const fs = require('fs');
const path = require('path');

// Read both files
const updatedFilePath = path.join(__dirname, '../src/lib/constants/tokens-base-updated.ts');
const currentFilePath = path.join(__dirname, '../src/lib/constants/tokens.base.ts');

const updatedContent = fs.readFileSync(updatedFilePath, 'utf-8');
const currentContent = fs.readFileSync(currentFilePath, 'utf-8');

// Extract token addresses from both files
function extractTokenAddresses(content) {
  const addresses = [];
  const regex = /"(0x[a-fA-F0-9]{40})":\s*\{/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    addresses.push(match[1].toLowerCase());
  }

  return addresses;
}

// Extract full token definitions
function extractTokenDefinitions(content) {
  const tokens = {};
  const regex = /"(0x[a-fA-F0-9]{40})":\s*\{([^}]+)\}/g;
  let match;

  // More sophisticated extraction
  const lines = content.split('\n');
  let currentAddress = null;
  let currentToken = [];
  let braceCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for token address
    const addressMatch = line.match(/"(0x[a-fA-F0-9]{40})":\s*\{/);
    if (addressMatch) {
      if (currentAddress && currentToken.length > 0) {
        tokens[currentAddress] = currentToken.join('\n');
      }
      currentAddress = addressMatch[1].toLowerCase();
      currentToken = [line];
      braceCount = 1;
      continue;
    }

    if (currentAddress) {
      currentToken.push(line);

      // Count braces
      for (const char of line) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
      }

      // If we've closed all braces, save the token
      if (braceCount === 0 && line.includes('}')) {
        tokens[currentAddress] = currentToken.join('\n');
        currentAddress = null;
        currentToken = [];
      }
    }
  }

  return tokens;
}

const updatedAddresses = extractTokenAddresses(updatedContent);
const currentAddresses = extractTokenAddresses(currentContent);

const updatedTokens = extractTokenDefinitions(updatedContent);
const currentTokens = extractTokenDefinitions(currentContent);

// Find missing addresses
const missingAddresses = updatedAddresses.filter(addr => !currentAddresses.includes(addr));







if (missingAddresses.length > 0) {
  
  missingAddresses.forEach(addr => {
    const tokenDef = updatedTokens[addr];
    if (tokenDef) {
      
      
    }
  });

  
  
  
  missingAddresses.forEach(addr => {
    const symbolMatch = updatedTokens[addr]?.match(/"symbol":\s*"([^"]+)"/);
    const nameMatch = updatedTokens[addr]?.match(/"name":\s*"([^"]+)"/);

    if (symbolMatch && nameMatch) {
      
    }
  });
} else {
  
}

