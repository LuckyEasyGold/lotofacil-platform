/**
 * lib/http.js — Helpers HTTP compartilhados.
 *
 * - `asyncHandler(fn)`: envolve um handler async e encaminha rejeições ao
 *   middleware de erro do Express (Express 4 não captura rejeições sozinho).
 * - `asyncRouter()`: cria um express.Router com o MESMO monkey-patch que o
 *   server.js aplicava no app — todos os handlers async ficam protegidos.
 */
const express = require('express');

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

function asyncRouter() {
  const router = express.Router();
  ['get', 'post', 'put', 'delete'].forEach(method => {
    const original = router[method].bind(router);
    router[method] = (path, ...handlers) =>
      original(path, ...handlers.map(h => (h.length >= 4 ? h : asyncHandler(h))));
  });
  return router;
}

/**
 * Responde 500 com mensagem GENÉRICA e loga o erro real no servidor.
 *
 * Usar em todos os `catch` de rotas em vez de `res.status(500).json({ error: e.message })`:
 * vazar `e.message` expõe detalhes internos (SQL, caminhos, libs) ao cliente —
 * risco de segurança. O erro real continua acessível nos logs do servidor.
 */
function sendError(res, e, context = 'rota') {
  console.error(`Erro em ${context}:`, e.message);
  if (res.headersSent) return; // não tentar responder de novo se já enviou
  res.status(500).json({ error: 'Erro interno do servidor' });
}

module.exports = { asyncHandler, asyncRouter, sendError };
