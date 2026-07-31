/**
 * seed.js - Sincroniza concursos faltantes da Lotofácil
 * 
 * Baixa os concursos que estão faltando no cache local
 * (do último disponível até o mais recente) usando as APIs
 * disponíveis em cascata.
 * 
 * Uso: node database/seed.js
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const DB_PATH = path.join(__dirname, 'lotofacil.json');
const BATCH_SIZE = 5; // Requisições simultâneas
const DELAY_MS = 200; // Delay entre batches para evitar rate limit

// Fontes de dados em cascata
const API_SOURCES = [
  { name: 'guidi', url: contest => `https://api.guidi.dev.br/loteria/lotofacil/${contest}` },
  { name: 'caixa', url: contest => `https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil/${contest}`,
    headers: { 'Accept': 'application/json' } }
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchContest(contestNumber) {
  for (const source of API_SOURCES) {
    try {
      const config = { timeout: 15000 };
      if (source.headers) config.headers = source.headers;
      const response = await axios.get(source.url(contestNumber), config);
      if (response.data && response.data.numero && response.data.listaDezenas) {
        return response.data;
      }
    } catch (e) {
      // Tenta próxima fonte
    }
  }
  return null;
}

async function main() {
  console.log('=== Sincronizador de Concursos Lotofácil ===\n');

  // Carrega cache atual
  let database = [];
  if (fs.existsSync(DB_PATH)) {
    database = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    console.log(`Cache local: ${database.length} concursos (1 a ${database[database.length-1].numero})`);
  } else {
    console.log('Cache local não encontrado. Execute primeiro o download do _todos.json');
    process.exit(1);
  }

  const lastContest = database[database.length - 1].numero;
  console.log(`Último concurso no cache: ${lastContest}`);

  // Descobre o concurso mais recente via guidi API
  const latest = await fetchContest('ultimo');
  if (!latest) {
    console.log('Não foi possível descobrir o concurso mais recente.');
    process.exit(1);
  }
  const targetContest = latest.numero;
  console.log(`Concurso mais recente disponível: ${targetContest}`);

  if (lastContest >= targetContest) {
    console.log('Cache já está atualizado!');
    return;
  }

  const missingStart = lastContest + 1;
  const totalMissing = targetContest - lastContest;
  console.log(`\nBuscando ${totalMissing} concursos faltantes (${missingStart} a ${targetContest})...\n`);

  // Busca em batches
  let fetched = 0;
  let errors = 0;

  for (let start = missingStart; start <= targetContest; start += BATCH_SIZE) {
    const batch = [];
    const end = Math.min(start + BATCH_SIZE - 1, targetContest);

    for (let c = start; c <= end; c++) {
      batch.push(fetchContest(c));
    }

    const results = await Promise.all(batch);
    
    for (let i = 0; i < results.length; i++) {
      const contest = results[i];
      const contestNumber = start + i;
      
      if (contest) {
        database.push(contest);
        fetched++;
        process.stdout.write(`✓ ${contestNumber} `);
      } else {
        errors++;
        process.stdout.write(`✗ ${contestNumber} `);
      }
    }

    // Salva a cada batch para não perder progresso
    database.sort((a, b) => a.numero - b.numero);
    fs.writeFileSync(DB_PATH, JSON.stringify(database, null, 2), 'utf8');
    
    process.stdout.write(`| Progresso: ${fetched}/${totalMissing}\n`);
    
    if (end < targetContest) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n=== Sincronização concluída! ===`);
  console.log(`Baixados: ${fetched}`);
  console.log(`Erros: ${errors}`);
  console.log(`Total no cache: ${database.length} concursos`);
  console.log(`Último: Concurso ${database[database.length-1].numero} (${database[database.length-1].dataApuracao})`);
}

main().catch(console.error);
