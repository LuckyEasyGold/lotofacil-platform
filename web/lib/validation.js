/**
 * lib/validation.js — Validação de payloads com Zod.
 *
 * Centraliza a validação de entrada das rotas-chave. Antes, cada handler
 * validava manualmente (e de forma inconsistente); agora os schemas abaixo
 * definem regras claras e mensagens em português, e o middleware `validate()`
 * responde 400 com a primeira mensagem de erro encontrada.
 *
 * Obs.: validações de NEGÓCIO (saldo, cotas disponíveis, permissão, etc.)
 * continuam nos handlers — o Zod valida o formato da entrada.
 */
const { z } = require('zod');
const { LOTTERY_CONFIGS } = require('./lottery');

/** Middleware: valida req.body contra um schema Zod. */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issue = result.error.issues[0];
      return res.status(400).json({ success: false, error: issue?.message || 'Dados inválidos' });
    }
    req.body = result.data;
    next();
  };
}

// ==================== AUTH ====================

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Preencha todos os campos'),
  email: z.string().trim().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres')
});

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Preencha e-mail e senha'),
  password: z.string().min(1, 'Preencha e-mail e senha')
});

// ==================== JOGOS (validação dinâmica por tipo de loteria) ====================

const createGameSchema = z.object({
  gameType: z.enum(Object.keys(LOTTERY_CONFIGS), { error: 'Tipo de jogo inválido' }).optional().default('LOTOFACIL'),
  numbers: z.array(z.coerce.number().int()).min(1, 'Informe os números do jogo'),
  name: z.string().trim().optional(),
  source: z.string().trim().optional(),
  seedVersion: z.string().nullable().optional()
}).superRefine((data, ctx) => {
  const cfg = LOTTERY_CONFIGS[data.gameType];
  if (!cfg) {
    ctx.addIssue({ code: 'custom', path: ['gameType'], message: 'Tipo de jogo inválido' });
    return;
  }
  // A Caixa permite apostar com mais dezenas que o mínimo (ex.: Lotofácil 15-20).
  // Um jogo salvo no portfólio respeita esse mesmo range.
  if (data.numbers.length < cfg.minPick || data.numbers.length > cfg.maxPick) {
    ctx.addIssue({
      code: 'custom', path: ['numbers'],
      message: `${cfg.name}: selecione entre ${cfg.minPick} e ${cfg.maxPick} números`
    });
    return;
  }
  const sorted = [...data.numbers].sort((a, b) => a - b);
  if (sorted[0] < 1 || sorted[sorted.length - 1] > cfg.totalNumbers) {
    ctx.addIssue({ code: 'custom', path: ['numbers'], message: `Números devem estar entre 1 e ${cfg.totalNumbers}` });
    return;
  }
  if (new Set(sorted).size !== data.numbers.length) {
    ctx.addIssue({ code: 'custom', path: ['numbers'], message: 'Números não podem se repetir' });
  }
});

// ==================== APOSTAS ====================

const createBetSchema = z.object({
  gameType: z.enum(Object.keys(LOTTERY_CONFIGS), { error: 'Tipo de jogo inválido' }).default('LOTOFACIL'),
  numbers: z.array(z.coerce.number().int()).min(1, 'Informe os números'),
  amount: z.coerce.number().positive('Valor da aposta inválido').optional(),
  // Opcional: id do jogo do portfólio que originou esta aposta (evita duplicar
  // o jogo e cria o vínculo aposta ↔ jogo).
  gameId: z.string().optional(),
  // Teimosinha: quantidade de concursos em que o jogo participa (1-30).
  // O valor cobrado é N × preço do jogo (o servidor calcula e debita).
  contests: z.coerce.number().int().min(1, 'Mínimo 1 concurso').max(30, 'Máximo 30 concursos').optional().default(1)
}).superRefine((data, ctx) => {
  const cfg = LOTTERY_CONFIGS[data.gameType];
  if (!cfg) return;
  if (data.numbers.length < cfg.minPick || data.numbers.length > cfg.maxPick) {
    ctx.addIssue({
      code: 'custom', path: ['numbers'],
      message: `${cfg.name}: selecione entre ${cfg.minPick} e ${cfg.maxPick} números`
    });
    return;
  }
  // Os números viram um jogo no portfólio — precisam ser válidos (range e únicos)
  const sorted = [...data.numbers].sort((a, b) => a - b);
  if (sorted[0] < 1 || sorted[sorted.length - 1] > cfg.totalNumbers) {
    ctx.addIssue({ code: 'custom', path: ['numbers'], message: `Números devem estar entre 1 e ${cfg.totalNumbers}` });
    return;
  }
  if (new Set(sorted).size !== data.numbers.length) {
    ctx.addIssue({ code: 'custom', path: ['numbers'], message: 'Números não podem se repetir' });
  }
});

// ==================== CARTEIRA ====================

const depositSchema = z.object({
  amount: z.coerce.number().positive('Valor inválido'),
  method: z.string().trim().optional()
});

const withdrawSchema = z.object({
  amount: z.coerce.number().positive('Valor inválido')
});

// ==================== BOLÕES ====================

const createPoolSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do bolão'),
  gameType: z.enum(Object.keys(LOTTERY_CONFIGS), { error: 'Tipo de jogo inválido' }).default('LOTOFACIL'),
  contestNumber: z.coerce.number().int().positive().optional(),
  totalShares: z.coerce.number().int().positive('Total de cotas inválido'),
  sharePrice: z.coerce.number().positive('Valor da cota inválido'),
  numbers: z.array(z.coerce.number().int()).min(1, 'Informe os números do bolão')
}).superRefine((data, ctx) => {
  const cfg = LOTTERY_CONFIGS[data.gameType];
  if (!cfg) return;
  if (data.numbers.length < cfg.minPick || data.numbers.length > cfg.maxPick) {
    ctx.addIssue({
      code: 'custom', path: ['numbers'],
      message: `${cfg.name}: bolão deve ter entre ${cfg.minPick} e ${cfg.maxPick} números`
    });
  }
});

const joinPoolSchema = z.object({
  shares: z.coerce.number().int().positive().optional()
});

const createOfferSchema = z.object({
  shares: z.coerce.number().int().positive('Quantidade de cotas inválida'),
  price: z.coerce.number().positive('Preço da cota inválido').optional()
});

// ==================== SIMULAÇÃO / IA ====================

const simulateSchema = z.object({
  numbers: z.array(z.coerce.number().int()).length(15, 'Selecione exatamente 15 números')
});

const evolveSchema = z.object({
  generations: z.coerce.number().int().min(1, 'Gerações deve ser entre 1 e 100')
    .max(100, 'Gerações deve ser entre 1 e 100')
    .optional()
    .default(10)
});

// ==================== ASSINATURAS ====================

const createSubscriptionSchema = z.object({
  gameId: z.string().nullable().optional(),
  gameType: z.enum(Object.keys(LOTTERY_CONFIGS), { error: 'Tipo de jogo inválido' }).optional().default('LOTOFACIL'),
  numbers: z.array(z.coerce.number().int()).min(1, 'Números são obrigatórios'),
  name: z.string().trim().optional(),
  interval: z.string().trim().optional(),
  nextContest: z.coerce.number().int().positive().optional()
});

// ==================== PERFIL ====================

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().trim().email('E-mail inválido').optional()
});

// ==================== IA ESTRUTURAL (2 MOTORES) ====================

/**
 * Geração de jogos estruturados (Motor 1 + Motor 2): quantidade de jogos,
 * dezenas por jogo (15-20), tamanho do pool (~20 de 25) e anti-rateio.
 */
const structuredGenerateSchema = z.object({
  quantity: z.coerce.number().int().min(1, 'Quantidade deve ser entre 1 e 20').max(20, 'Quantidade deve ser entre 1 e 20').default(10),
  pickCount: z.coerce.number().int().min(15, 'Dezenas por jogo entre 15 e 20').max(20, 'Dezenas por jogo entre 15 e 20').default(15),
  poolSize: z.coerce.number().int().min(15, 'Pool entre 15 e 25').max(25, 'Pool entre 15 e 25').optional(),
  antiRateio: z.boolean().optional().default(true)
});

/**
 * Criação de bolão estruturado (N jogos + cotas com preço da tabela).
 *
 * O bolão é CONFIGURÁVEL por composição de jogos: em vez de escolher só
 * 'quantity' jogos com um único pickCount, o usuário define QUANTOS jogos
 * de cada quantidade de dezenas — ex.: [{pickCount:15,quantity:10},
 * {pickCount:16,quantity:5},{pickCount:17,quantity:2}].
 *
 * Compatibilidade: se `composition` for omitido, usa quantity × pickCount
 * (comportamento anterior).
 */
const structuredCompositionItem = z.object({
  pickCount: z.coerce.number().int().min(15, 'Dezenas entre 15 e 20').max(20, 'Dezenas entre 15 e 20').default(15),
  quantity: z.coerce.number().int().min(1, 'Quantidade mínima de 1 jogo').max(50, 'Máximo de 50 jogos por grupo').default(1)
});

const structuredPoolSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do bolão'),
  quantity: z.coerce.number().int().min(1, 'Quantidade de jogos inválida').max(20, 'Máximo de 20 jogos').optional(),
  pickCount: z.coerce.number().int().min(15, 'Dezenas por jogo entre 15 e 20').max(20, 'Dezenas por jogo entre 15 e 20').optional(),
  // Configuração flexível: lista de grupos (dezenas × quantidade)
  composition: z.array(structuredCompositionItem).min(1, 'Informe pelo menos 1 grupo de jogos').optional(),
  sharePrice: z.coerce.number().positive('Valor da cota inválido').optional(),
  totalShares: z.coerce.number().int().positive('Total de cotas inválido').optional(),
  // Taxa administrativa (R$) que o criador cobra pelo trabalho de organizar.
  // Sempre transparente: aparece na capa do bolão como "Custo dos jogos + Taxa".
  adminFee: z.coerce.number().min(0, 'Taxa administrativa não pode ser negativa').optional().default(0),
  contestNumber: z.coerce.number().int().positive().optional(),
  poolSize: z.coerce.number().int().min(15, 'Pool entre 15 e 25').max(25, 'Pool entre 15 e 25').optional(),
  antiRateio: z.boolean().optional().default(true)
}).superRefine((data, ctx) => {
  // Valida a composição: sem composition, quantity/pickCount são obrigatórios
  if (!data.composition && !data.quantity) {
    ctx.addIssue({ code: 'custom', path: ['composition'], message: 'Informe a composição de jogos ou a quantidade' });
  }
});

// ==================== ADMIN: CONFIG DE LOTERIAS ====================

/**
 * Atualiza o preço por quantidade de dezenas de uma loteria.
 * `prices` é um mapa { "16": 48.00, "17": 408.00 } — só as quantidades
 * informadas são sobrescritas; as demais continuam com a fórmula da Caixa.
 */
const lotteryConfigSchema = z.object({
  gameType: z.enum(Object.keys(LOTTERY_CONFIGS), { error: 'Tipo de jogo inválido' }),
  prices: z.record(z.coerce.number().positive('Preço deve ser positivo')).refine(
    obj => Object.keys(obj).length > 0,
    'Informe pelo menos um preço'
  )
});

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  createGameSchema,
  createBetSchema,
  depositSchema,
  withdrawSchema,
  createPoolSchema,
  joinPoolSchema,
  createOfferSchema,
  simulateSchema,
  evolveSchema,
  createSubscriptionSchema,
  updateProfileSchema,
  lotteryConfigSchema,
  structuredGenerateSchema,
  structuredPoolSchema,
  structuredCompositionItem
};
