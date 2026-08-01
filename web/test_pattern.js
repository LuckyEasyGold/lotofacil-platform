const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

const user = {id: '9d961bea-5ffe-460a-9f31-a4738f97794b', name: 'Admin', email: 'a@b.com', role: 'admin', balance: 5000};

// Test the EXACT template used by evolution.ejs 
const evoTemplate = fs.readFileSync(path.join(__dirname, 'views', 'evolution.ejs'), 'utf8');

// Check for % inside the template that might be confused with %>
console.log('=== Checking for standalone %> inside template literal ===');
// Find all %> that are NOT part of EJS close tags (immediately after EJS open tag)
const lines = evoTemplate.split('\n');
for (let i = 0; i < lines.length; i++) {
  // Check for %> inside JavaScript strings (between quotes)
  const line = lines[i];
  const gtIdx = line.indexOf('%>');
  if (gtIdx >= 0) {
    // Check what's before this %>
    const before = line.substring(Math.max(0, gtIdx - 2), gtIdx);
    console.log(`Line ${i+1}: ...${before}%> (at col ${gtIdx})`);
  }
}

// Also check for inline conditionals or other % uses
console.log('\n=== Lines with % character ===');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('%') && !lines[i].includes('<%') && !lines[i].includes('%>')) {
    console.log(`Line ${i+1}: ${lines[i].trim().substring(0, 100)}`);
  }
}
