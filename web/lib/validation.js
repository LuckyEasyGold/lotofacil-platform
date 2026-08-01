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
  if (data.numbers.length !== cfg.pickCount) {
    ctx.addIssue({
      code: 'custom', path: ['numbers'],
      message: `É necessário exatamente ${cfg.pickCount} números para ${cfg.name}`
    });
    return;
  }
  const sorted = [...data.numbers].sort((a, b) => a - b);
  if (sorted[0] < 1 || sorted[sorted.length - 1] > cfg.totalNumbers) {
    ctx.addIssue({ code: 'custom', path: ['numbers'], message: `Números devem estar entre 1 e ${cfg.totalNumbers}` });
    return;
  }
  if (new Set(sorted).size !== cfg.pickCount) {
    ctx.addIssue({ code: 'custom', path: ['numbers'], message: 'Números não podem se repetir' });
  }
});

// ==================== APOSTAS ====================

const createBetSchema = z.object({
  gameType: z.enum(Object.keys(LOTTERY_CONFIGS), { error: 'Tipo de jogo inválido' }).default('LOTOFACIL'),
  numbers: z.array(z.coerce.number().int()).min(1, 'Informe os números'),
  amount: z.coerce.number().positive('Valor da aposta inválido')
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
  updateProfileSchema
};
