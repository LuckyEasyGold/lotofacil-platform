const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, 'views', 'evolution.ejs');

const evolution = {
  gameType: 'LOTOFACIL',
  currentGeneration: 15,
  bestFitness: 4520.156,
  populationSize: 100,
  history: [{generation: 1, bestFitness: 74.984, avgFitness: 45.2, timestamp: '2024-01-01'}],
  seedInfo: {version: '1.0.15', weights: Array(25).fill(0.04), fitnessScore: 4520.156},
  stats: {totalGenerations: 15, totalHistoryPoints: 1, contestsAnalyzed: 3739, evolutionTime: 37.5, lastUpdate: new Date().toISOString()}
};
const user = {id: '9d961bea-5ffe-460a-9f31-a4738f97794b', name: 'Admin', email: 'admin@test.com', avatar: 'AD', balance: 5000, role: 'admin'};

// First just try to compile it (no render)
try {
  const compiled = ejs.compile(fs.readFileSync(templatePath, 'utf8'), {
    views: [path.join(__dirname, 'views')],
    filename: templatePath
  });
  console.log('✅ Compilado com sucesso!');
  
  // Now try to render
  try {
    const html = compiled({
      body: '',
      title: 'Evolução da IA',
      page: 'evolution',
      user: user,
      subtitle: 'Test',
      evolution: evolution
    });
    console.log('✅ Renderizado com sucesso! Tamanho:', html.length, 'bytes');
  } catch(renderErr) {
    console.error('❌ Erro no render:', renderErr.message);
  }
} catch(compileErr) {
  console.error('❌ Erro na compilacao:', compileErr.message);
  if (compileErr.stack) {
    console.error('Stack:', compileErr.stack.split('\n').slice(0, 5).join('\n'));
  }
}
