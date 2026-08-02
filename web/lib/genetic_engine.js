/**
 * Genetic Algorithm Engine for Lottery Number Generation
 * 
 * Ported from Python DEAP implementation to pure JavaScript.
 * No external dependencies required — runs inside Node.js.
 * 
 * Each "individual" is an array of 25 weights (0.0–1.0) representing
 * the probability bias for each Lotofácil number (01–25).
 * The algorithm evolves these weights to maximize matches against
 * historical results.
 */

const fs = require('fs');
const path = require('path');

// Janela de concursos usada na avaliação de fitness (os N mais recentes).
// Trade-off: janela maior = aprendizado mais amplo, mas evolução mais lenta.
// Medido (100pop x 20gen): 100→~4min · 300→~6min · 500→~9.6min · 3750→~55min.
// Configurável via env FITNESS_WINDOW_SIZE (ex.: 100 para evolução rápida,
// 500+ para aprendizado mais amplo). Default 300 = bom equilíbrio.
const FITNESS_WINDOW_SIZE = parseInt(process.env.FITNESS_WINDOW_SIZE || '300', 10) || 300;

class LotteryGeneticEngine {
  constructor(gameType = 'LOTOFACIL', options = {}) {
    this.gameType = gameType;
    this.numNumbers = 25;       // Lotofácil: 25 numbers
    this.numbersToPick = 15;    // Lotofácil: pick 15

    this.historicalResults = []; // [[n1,n2,...], ...] — loaded from cache
    this.historicalSets = [];   // Pre-computed Sets for fast fitness evaluation
    this.currentSeed = null;     // Best weights found so far
    this.currentGeneration = 0;
    this.bestFitness = 0;
    this.generationHistory = [];

    this.dbPath = path.join(__dirname, '..', 'database', 'lotofacil.json');
    this.seedsPath = path.join(__dirname, '..', 'database', 'seeds.json');

    // Fontes de dados injetáveis (para ambientes serverless como Vercel)
    this.historicalResultsProvider = options.historicalResultsProvider || null;
    this.seedProvider = options.seedProvider || null;
    this.seedSaver = options.seedSaver || null;
    this.autoEvolve = options.autoEvolve !== undefined ? options.autoEvolve : true;
  }

  // ======================================================================
  //  PERSISTENCE
  // ======================================================================

  /** Load historical results from the local JSON cache */
  loadHistoricalResults() {
    if (this.historicalResultsProvider) {
      const data = this.historicalResultsProvider();
      if (data && data.length) {
        this.historicalResults = data
          .filter(c => c.listaDezenas && Array.isArray(c.listaDezenas))
          .map(c => c.listaDezenas.map(n => parseInt(n)));
        this.historicalSets = this.historicalResults.slice(-FITNESS_WINDOW_SIZE).map(r => new Set(r));
        console.log(`🧬 Engine: ${this.historicalResults.length} resultados históricos carregados (DB)`);
        return true;
      }
      return false;
    }
    try {
      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf8');
        const data = JSON.parse(raw);
        this.historicalResults = data
          .filter(c => c.listaDezenas && Array.isArray(c.listaDezenas))
          .map(c => c.listaDezenas.map(n => parseInt(n)));
        // Pre-compute Sets for fast matching — evita recriar 75M de Sets na evolução
        this.historicalSets = this.historicalResults.slice(-FITNESS_WINDOW_SIZE).map(r => new Set(r));
        console.log(`🧬 Engine: ${this.historicalResults.length} resultados históricos carregados`);
        return true;
      }
    } catch (e) {
      console.error('Erro ao carregar histórico:', e.message);
    }
    return false;
  }

  /** Load the best seed from disk (if one was saved previously) */
  loadSavedSeed() {
    if (this.seedProvider) {
      const data = this.seedProvider();
      if (data && data.weights) {
        this.currentSeed = data.weights;
        this.currentGeneration = data.generation || 0;
        this.bestFitness = data.fitness || 0;
        this.generationHistory = data.history || [];
        console.log(`🧬 Engine: semente carregada (DB) — geração ${this.currentGeneration}, fitness ${this.bestFitness.toFixed(4)}`);
        return true;
      }
      return false;
    }
    try {
      if (fs.existsSync(this.seedsPath)) {
        const raw = fs.readFileSync(this.seedsPath, 'utf8');
        const data = JSON.parse(raw);
        this.currentSeed = data.weights;
        this.currentGeneration = data.generation || 0;
        this.bestFitness = data.fitness || 0;
        this.generationHistory = data.history || [];
        console.log(`🧬 Engine: semente carregada — geração ${this.currentGeneration}, fitness ${this.bestFitness.toFixed(4)}`);
        return true;
      }
    } catch (e) {
      console.error('Erro ao carregar semente:', e.message);
    }
    return false;
  }

  /** Persist the current best seed to disk */
  saveSeed() {
    if (this.seedSaver) {
      const data = {
        version: `1.0.${this.currentGeneration}`,
        game_type: this.gameType,
        weights: this.currentSeed,
        generation: this.currentGeneration,
        fitness: this.bestFitness,
        history: this.generationHistory.slice(-500),
        updatedAt: new Date().toISOString()
      };
      try { this.seedSaver(data); } catch (e) { console.error('Erro ao salvar semente (DB):', e.message); }
      return;
    }
    try {
      const dir = path.dirname(this.seedsPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const data = {
        version: `1.0.${this.currentGeneration}`,
        game_type: this.gameType,
        weights: this.currentSeed,
        generation: this.currentGeneration,
        fitness: this.bestFitness,
        history: this.generationHistory.slice(-500),
        updatedAt: new Date().toISOString()
      };
      fs.writeFileSync(this.seedsPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('Erro ao salvar semente:', e.message);
    }
  }

  // ======================================================================
  //  GENETIC ALGORITHM — CORE OPERATIONS
  // ======================================================================

  /** Create a random individual: 25 weights in [0, 1] */
  createIndividual() {
    const ind = [];
    for (let i = 0; i < this.numNumbers; i++) ind.push(Math.random());
    return ind;
  }

  /** Normalise an array so that all elements sum to 1 */
  normalise(weights) {
    const sum = weights.reduce((a, b) => a + b, 0);
    if (sum <= 0) return weights.map(() => 1 / weights.length);
    return weights.map(w => w / sum);
  }

  /**
   * Simulate N lottery games given a set of weights.
   * Uses roulette-wheel selection without replacement.
   * @param {number|null} pickCount — nº de dezenas por jogo (ex.: 15–20 na
   *   Lotofácil). Se omitido, usa o padrão da loteria (numbersToPick).
   */
  simulateGames(weights, nGames = 500, pickCount = null) {
    const probs = this.normalise(weights);
    const games = [];
    const target = pickCount || this.numbersToPick;

    for (let g = 0; g < nGames; g++) {
      const selected = [];
      const available = [...probs];

      for (let p = 0; p < target; p++) {
        const total = available.reduce((a, b) => a + b, 0);
        const normed = available.map(w => w / total);

        let r = Math.random();
        let chosen = 0;
        for (let i = 0; i < this.numNumbers; i++) {
          r -= normed[i];
          if (r <= 0) { chosen = i; break; }
        }

        selected.push(chosen + 1); // 1-indexed
        available[chosen] = 0;     // remove from pool
      }

      games.push(selected.sort((a, b) => a - b));
    }

    return games;
  }

  /**
   * Fitness function.
   * Simulates games with the individual's weights and compares them
   * against the last 100 historical results. Rewards games that
   * produce many partial matches (11, 12, 13, 14, 15 hits).
   */
  evaluateFitness(individual) {
    const simulated = this.simulateGames(individual, 500);
    if (!this.historicalSets.length) return 0;

    let totalScore = 0;

    for (const simGame of simulated) {
      for (const histSet of this.historicalSets) {
        let matches = 0;
        for (const n of simGame) if (histSet.has(n)) matches++;

        if (matches >= 15)      totalScore += 10000;
        else if (matches >= 14) totalScore += 1000;
        else if (matches >= 13) totalScore += 100;
        else if (matches >= 12) totalScore += 10;
        else if (matches >= 11) totalScore += 1;
      }
    }

    return totalScore / simulated.length;
  }

  /** Tournament selection: pick the best from `tournamentSize` random individuals */
  tournamentSelect(population, fitnesses, tournamentSize = 3) {
    let bestIdx = -1;
    let bestFit = -Infinity;
    for (let i = 0; i < tournamentSize; i++) {
      const idx = Math.floor(Math.random() * population.length);
      if (fitnesses[idx] > bestFit) { bestFit = fitnesses[idx]; bestIdx = idx; }
    }
    return population[bestIdx];
  }

  /**
   * Blend crossover (DEAP's cxBlend).
   * Children are placed in an interval [min-ext, max+ext] between the parents.
   */
  crossover(p1, p2, alpha = 0.5) {
    const c1 = []; const c2 = [];
    for (let i = 0; i < this.numNumbers; i++) {
      const lo = Math.min(p1[i], p2[i]);
      const hi = Math.max(p1[i], p2[i]);
      const ext = (hi - lo) * alpha;
      const low = lo - ext;
      const high = hi + ext;
      c1[i] = Math.max(0, Math.min(1, low + Math.random() * (high - low)));
      c2[i] = Math.max(0, Math.min(1, low + Math.random() * (high - low)));
    }
    return [c1, c2];
  }

  /**
   * Gaussian mutation (DEAP's mutGaussian).
   * Each gene has `indpb` probability of being perturbed by N(0, sigma).
   */
  mutate(individual, sigma = 0.1, indpb = 0.1) {
    const m = [...individual];
    for (let i = 0; i < m.length; i++) {
      if (Math.random() < indpb) {
        // Box-Muller transform → standard normal
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        m[i] = Math.max(0, Math.min(1, m[i] + z * sigma));
      }
    }
    return m;
  }

  // ======================================================================
  //  EVOLUTION LOOP
  // ======================================================================

  /**
   * Run the evolutionary algorithm.
   * @param {number} populationSize   — default 100
   * @param {number} generations      — default 20 (lighter for first run)
   * @returns {object|null} seed data
   */
  evolve(populationSize = 100, generations = 20) {
    if (!this.historicalResults.length) {
      console.warn('⚠️ Sem dados históricos — evolução cancelada');
      return null;
    }

    console.log(`🧬 Evolução: ${generations} gerações, ${populationSize} indivíduos`);
    const t0 = Date.now();

    // 1. Initialise population
    let population = [];
    for (let i = 0; i < populationSize; i++) population.push(this.createIndividual());

    let bestInd = null;
    let bestFit = -Infinity;

    for (let gen = 0; gen < generations; gen++) {
      // 2. Evaluate
      const fitnesses = population.map(ind => this.evaluateFitness(ind));

      const genBest = Math.max(...fitnesses);
      const genAvg = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;
      const bestIdx = fitnesses.indexOf(genBest);

      if (genBest > bestFit) { bestFit = genBest; bestInd = [...population[bestIdx]]; }

      // 3. Build next generation (elitism: keep top 2)
      const ranked = population
        .map((ind, i) => ({ ind, fit: fitnesses[i] }))
        .sort((a, b) => b.fit - a.fit);

      const next = [];
      next.push([...ranked[0].ind]);
      next.push([...ranked[1].ind]);

      while (next.length < populationSize) {
        const p1 = this.tournamentSelect(population, fitnesses);
        const p2 = this.tournamentSelect(population, fitnesses);
        let [c1, c2] = [p1, p2];

        if (Math.random() < 0.7) [c1, c2] = this.crossover(p1, p2);
        if (Math.random() < 0.2) c1 = this.mutate(c1);
        if (Math.random() < 0.2) c2 = this.mutate(c2);

        next.push(c1);
        if (next.length < populationSize) next.push(c2);
      }

      population = next;

      // 4. Log progress every 10 generations
      if ((gen + 1) % 10 === 0 || gen === 0) {
        console.log(`   Gen ${gen + 1}/${generations} | melhor: ${genBest.toFixed(4)} | média: ${genAvg.toFixed(4)}`);
      }

      this.generationHistory.push({
        generation: this.currentGeneration + gen + 1,
        bestFitness: genBest,
        avgFitness: genAvg,
        timestamp: new Date().toISOString()
      });
    }

    this.currentSeed = bestInd;
    this.currentGeneration += generations;
    this.bestFitness = bestFit;
    this.saveSeed();

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`✅ Evolução concluída em ${elapsed}s · fitness: ${bestFit.toFixed(4)}`);

    return this.getSeed();
  }

  // ======================================================================
  //  PUBLIC API
  // ======================================================================

  /** Return the current best seed metadata */
  getSeed() {
    if (!this.currentSeed) this.currentSeed = this.createIndividual();
    return {
      version: `1.0.${this.currentGeneration}`,
      game_type: this.gameType,
      weights: this.normalise(this.currentSeed),
      generation: this.currentGeneration,
      fitnessScore: this.bestFitness,
      status: this.currentGeneration > 0 ? 'evolved' : 'initial'
    };
  }

  /**
   * Generate `quantity` games using the current best seed.
   * @param {number} quantity   — quantos jogos gerar
   * @param {number|null} pickCount — quantas dezenas por jogo (15–20 na
   *   Lotofácil, respeitando a tabela da Caixa). Omitido = padrão da loteria.
   */
  generateGames(quantity = 5, pickCount = null) {
    if (this.autoEvolve && !this.currentSeed && this.historicalResults.length > 0) {
      this.evolve(100, 15); // quick first evolution
    }
    const seed = this.currentSeed || this.createIndividual();
    const games = this.simulateGames(seed, quantity, pickCount);
    return {
      game_type: this.gameType,
      seed_version: `1.0.${this.currentGeneration}`,
      pickCount: pickCount || this.numbersToPick,
      games,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Return the full evolution history for the dashboard
   */
  getEvolutionHistory() {
    return {
      gameType: this.gameType,
      currentGeneration: this.currentGeneration,
      bestFitness: this.bestFitness,
      populationSize: 100,
      history: this.generationHistory.slice(-200), // últimas 200 gerações
      seedInfo: {
        version: `1.0.${this.currentGeneration}`,
        weights: this.currentSeed ? this.normalise(this.currentSeed) : null,
        fitnessScore: this.bestFitness
      },
      stats: {
        totalGenerations: this.currentGeneration,
        totalHistoryPoints: this.generationHistory.length,
        contestsAnalyzed: this.historicalResults.length,
        evolutionTime: this.currentGeneration * 2.5, // ~2.5s por geração
        lastUpdate: new Date().toISOString()
      }
    };
  }

  /**
   * Continue evolving for N more generations.
   * Non-blocking: runs via setImmediate to not freeze the server.
   * Returns immediately with a promise that resolves when done.
   */
  async evolveMore(generations = 10) {
    if (this._evolving) {
      throw new Error('Evolução já em andamento');
    }
    this._evolving = true;
    try {
      return await new Promise((resolve) => {
        // Usa setImmediate para não travar o event loop completamente
        // A cada 5 gerações, dá um breather pro servidor respirar
        const totalGens = generations;
        let completed = 0;

        const runBatch = () => {
          setImmediate(() => {
            const batchSize = Math.min(5, totalGens - completed);
            this.evolve(100, batchSize);
            completed += batchSize;
            if (completed < totalGens) {
              runBatch();
            } else {
              this._evolving = false;
              resolve(this.getEvolutionHistory());
            }
          });
        };

        runBatch();
      });
    } catch (e) {
      this._evolving = false;
      throw e;
    }
  }

  /** Check if evolution is currently running */
  isEvolving() {
    return !!this._evolving;
  }

  /**
   * Bootstrap the engine:
   *  - Load historical results from local cache
   *  - Load saved seed (if any)
   *  - If no seed exists, run a quick evolution
   */
  initialize() {
    const hasHistory = this.loadHistoricalResults();
    const hasSeed = this.loadSavedSeed();

    if (this.autoEvolve && hasHistory && !hasSeed) {
      console.log('🧬 Nenhuma semente salva. Executando evolução inicial...');
      this.evolve(100, 15);
    }

    return {
      ready: hasHistory || hasSeed,
      contestsLoaded: this.historicalResults.length,
      generation: this.currentGeneration,
      fitness: this.bestFitness
    };
  }
}

module.exports = LotteryGeneticEngine;
