/**
 * qa-player.test.js — QA: FLUXO COMPLETO DO JOGADOR.
 *
 * Simula um usuário real usando todos os recursos que o app promete:
 *   1. Cadastro + depósito
 *   2. Criar jogo com 15 dezenas (valor oficial R$ 3,00 da Caixa)
 *   3. Apostar — o jogo DEVE aparecer no portfólio "Meus Jogos" (bug corrigido)
 *   4. Criar jogo com 20 dezenas (valor oficial R$ 46.512,00)
 *   5. Criar bolão a partir de um jogo
 *   6. Entrar em um bolão (comprar cotas)
 *   7. Ofertar cotas no mercado e outro jogador comprar
 *   8. Conferir que os preços batem com a tabela oficial da Caixa
 *
 * É o teste que valida que o app "faz o que promete" do ponto de vista do
 * jogador — não apenas que as rotas respondem 200.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { registerUser, fundUser, cleanupTestData } from './helpers.js';

const QUINZE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const VINTE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

// Preços oficiais da Caixa (tabela combinatória: base × C(n, 15))
// BASE CORRIGIDA para R$ 3,50 (admin atualizou no banco — teste acompanha a tabela real).
// ⚠️ Este teste depende do override `lottery_config` presente no banco de teste.
// Se rodar contra um banco isolado SEM override, getGamePrice() cai no fallback
// de LOTTERY_CONFIGS e estes valores quebram — semear a tabela antes se precisar.
const PRECOS_LOTOFACIL = { 15: 3.50, 16: 56.00, 17: 476.00, 18: 2856.00, 19: 13566.00, 20: 54264.00 };

describe('QA — fluxo completo do jogador', () => {
  afterAll(async () => {
    await cleanupTestData();
  });

  it('1. cadastro + depósito', async () => {
    const { agent, user } = await registerUser();
    await fundUser(user.id, 1000);
    const wallet = await agent.get('/api/wallet');
    expect(wallet.body.balance).toBe(1000);
  });

  it('2. tabela de preços oficial (Lotofácil 15-20 dezenas)', async () => {
    const { agent } = await registerUser();
    const res = await agent.get('/api/lottery-config');
    expect(res.status).toBe(200);
    const lf = res.body.lotteries.find(l => l.key === 'LOTOFACIL');
    expect(lf).toBeDefined();
    for (const [pick, price] of Object.entries(PRECOS_LOTOFACIL)) {
      const row = lf.priceTable.find(t => t.pickCount === Number(pick));
      expect(row).toBeDefined();
      expect(row.price).toBeCloseTo(price, 2);
    }
  });

  it('3. apostar 15 dezenas custa R$ 3,50 e cria o jogo no portfólio', async () => {
    const { agent, user } = await registerUser();
    await fundUser(user.id, 100);

    // Antes: portfólio vazio
    const antes = await agent.get('/api/games');
    expect(antes.body.total).toBe(0);

    const bet = await agent.post('/api/bets').send({ gameType: 'LOTOFACIL', numbers: QUINZE });
    expect(bet.status).toBe(200);
    expect(bet.body.amount).toBe(3.5);
    expect(bet.body.game).toBeDefined(); // jogo criado junto com a aposta

    // Depois: o jogo APARECE no portfólio (bug do "não aparece em Meus Jogos")
    const depois = await agent.get('/api/games');
    expect(depois.body.total).toBe(1);
    expect(depois.body.games[0].id).toBe(bet.body.game.id);
    expect(depois.body.games[0].source).toBe('bet');

    // Saldo: 100 - 3,5
    const wallet = await agent.get('/api/wallet');
    expect(wallet.body.balance).toBeCloseTo(96.5, 2);
  });

  it('4. apostar 16 dezenas custa R$ 56,00 (tabela da Caixa)', async () => {
    const { agent, user } = await registerUser();
    await fundUser(user.id, 200);

    const DEZESSEIS = [...QUINZE, 20];
    const bet = await agent.post('/api/bets').send({ gameType: 'LOTOFACIL', numbers: DEZESSEIS });
    expect(bet.status).toBe(200);
    expect(bet.body.amount).toBe(56);

    const wallet = await agent.get('/api/wallet');
    expect(wallet.body.balance).toBe(144);
  });

  it('5. criar jogo de 20 dezenas no portfólio (válido pela Caixa)', async () => {
    const { agent } = await registerUser();
    const res = await agent.post('/api/games').send({ gameType: 'LOTOFACIL', numbers: VINTE, name: 'Mega Jogo 20' });
    expect(res.status).toBe(200);
    expect(res.body.game.numbers).toHaveLength(20);
  });

  it('6. criar bolão a partir de um jogo + entrar com cotas', async () => {
    const { agent: criador, user: criadorUser } = await registerUser();
    await fundUser(criadorUser.id, 500);

    const game = await criador.post('/api/games').send({ gameType: 'LOTOFACIL', numbers: QUINZE, name: 'Jogo do Bolão' });
    const gameId = game.body.game.id;

    // Criar bolão a partir do jogo (debita 1 cota do criador)
    const pool = await criador.post(`/api/games/${gameId}/create-pool`).send({
      name: 'Bolão da Galera', totalShares: 10, sharePrice: 25, contestNumber: 3005
    });
    expect(pool.status).toBe(200);
    expect(pool.body.pool.availableShares).toBe(9);
    expect(pool.body.pool.numbers).toEqual(QUINZE);

    // Outro jogador entra comprando 2 cotas
    const { agent: participante, user: participanteUser } = await registerUser({ name: 'Participante QA' });
    await fundUser(participanteUser.id, 200);
    const join = await participante.post(`/api/pools/${pool.body.pool.id}/join`).send({ shares: 2 });
    expect(join.status).toBe(200);
    expect(join.body.pool.availableShares).toBe(7);
    expect(join.body.balance).toBe(150); // 200 - 2×25
  });

  it('7. ofertar cotas no mercado e outro jogador comprar', async () => {
    // Nomes DISTINTOS: o buy-offer valida por nome (não comprar as próprias cotas)
    const { agent: vendedor, user: vendedorUser } = await registerUser({ name: 'Vendedor QA' });
    await fundUser(vendedorUser.id, 500);
    const game = await vendedor.post('/api/games').send({ gameType: 'LOTOFACIL', numbers: QUINZE, name: 'Oferta' });
    const pool = await vendedor.post(`/api/games/${game.body.game.id}/create-pool`).send({
      name: 'Bolão Oferta', totalShares: 10, sharePrice: 25, contestNumber: 3005
    });
    const poolId = pool.body.pool.id;

    // Vendedor oferta 1 cota (o criador reserva 1 cota ao criar o bolão)
    // por R$ 30
    const offer = await vendedor.post(`/api/pools/${poolId}/create-offer`).send({ shares: 1, price: 30 });
    expect(offer.status).toBe(200);
    expect(offer.body.offer.totalValue).toBe(30);

    // Comprador adquire as cotas
    const { agent: comprador, user: compradorUser } = await registerUser({ name: 'Comprador QA' });
    await fundUser(compradorUser.id, 200);
    const buy = await comprador.post(`/api/pools/${poolId}/buy-offer/${offer.body.offer.id}`);
    expect(buy.status).toBe(200);
    expect(buy.body.success).toBe(true);

    const walletComprador = await comprador.get('/api/wallet');
    expect(walletComprador.body.balance).toBe(170); // 200 - 30

    const walletVendedor = await vendedor.get('/api/wallet');
    // MODELO 1 (pré-financiado): o criador paga o CUSTO REAL do jogo (15
    // dezenas = R$ 3,50), não 1 cota de R$ 25. Saldo: 500 - 3,5 + 30 = 526,50
    expect(walletVendedor.body.balance).toBe(526.5);
  });

  it('8. aposta com quantidade fora do permitido é rejeitada', async () => {
    const { agent, user } = await registerUser();
    await fundUser(user.id, 500);
    // 14 dezenas: abaixo do mínimo (15)
    const res = await agent.post('/api/bets').send({ gameType: 'LOTOFACIL', numbers: QUINZE.slice(0, 14) });
    expect(res.status).toBe(400);
  });

  it('9. apostar vinculando jogo do portfólio (gameId) marca o jogo como usado', async () => {
    const { agent, user } = await registerUser();
    await fundUser(user.id, 100);
    const game = await agent.post('/api/games').send({ gameType: 'LOTOFACIL', numbers: QUINZE, name: 'Via Portfólio' });
    const gameId = game.body.game.id;

    const bet = await agent.post('/api/bets').send({ gameType: 'LOTOFACIL', numbers: QUINZE, gameId });
    expect(bet.status).toBe(200);
    expect(bet.body.game.id).toBe(gameId);

    // Jogo vinculado: marcado como usado + usageHistory com 1 entrada (check-result funcional)
    const list = await agent.get('/api/games');
    const linked = list.body.games.find(g => g.id === gameId);
    expect(linked.status).toBe('used');
    expect(linked.usageHistory).toHaveLength(1);

    // Sem jogo duplicado (total continua 1)
    expect(list.body.total).toBe(1);
  });

  it('10. aposta com gameId de números divergentes é rejeitada (400)', async () => {
    const { agent, user } = await registerUser();
    await fundUser(user.id, 100);
    const game = await agent.post('/api/games').send({ gameType: 'LOTOFACIL', numbers: QUINZE, name: 'Original' });
    const gameId = game.body.game.id;

    // Números diferentes dos do jogo vinculado
    const OUTROS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    const res = await agent.post('/api/bets').send({ gameType: 'LOTOFACIL', numbers: OUTROS, gameId });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/não correspondem/i);
  });
});
