const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

const user = {id: '1', name: 'Admin', email: 'a@b.com', role: 'admin', balance: 5000};
const evo = {currentGeneration: 15, bestFitness: 4520.156, stats: {contestsAnalyzed: 3739}, history: [], seedInfo: {weights: [0.04]}};

const viewsDir = path.join(__dirname, 'views');

// Test 1: Minimal body template
function test(template, label) {
  try {
    const html = ejs.render(template, { user, evolution: evo, body: '', title: 'Test', page: 'test', subtitle: '' }, { views: [viewsDir], filename: path.join(viewsDir, 'test.ejs') });
    console.log('✅ ' + label + ' OK (' + html.length + ' bytes)');
    return true;
  } catch(e) {
    console.log('❌ ' + label + ': ' + e.message.substring(0, 100));
    return false;
  }
}

// Test 2: Body with 1 EJS tag
test(
  `<% let body = \`<div><%= evolution.currentGeneration %></div>\` %>\n<%- include('layout', { body: body, title: 'Test', page: 'test', user: user }) %>`,
  '1 EJS tag inside body'
);

// Test 3: Body with 2 EJS tags  
test(
  `<% let body = \`<div><%= evolution.currentGeneration %></div><span><%= evolution.bestFitness.toFixed(2) %></span>\` %>\n<%- include('layout', { body: body, title: 'Test', page: 'test', user: user }) %>`,
  '2 EJS tags inside body'
);

// Test 4: Use string concat instead of EJS tags
test(
  `<% let body = '<div>' + evolution.currentGeneration + '</div>' %>\n<%- include('layout', { body: body, title: 'Test', page: 'test', user: user }) %>`,
  'String concat instead of EJS tags'
);

// Test 5: Complex body with JSON.stringify
test(
  `<% let body = \`<div><%= JSON.stringify(evolution.history || []) %></div>\` %>\n<%- include('layout', { body: body, title: 'Test', page: 'test', user: user }) %>`,
  'JSON.stringify inside body'
);

// Test 6: Body with script tag and multiple lines
test(
  `<% let body = \`<script>\nlet x = '<%= evolution.currentGeneration %>';\n<\/script>\` %>\n<%- include('layout', { body: body, title: 'Test', page: 'test', user: user }) %>`,
  'Script tag with multiple lines'
);
