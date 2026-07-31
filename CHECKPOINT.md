# 🎲 CHECKPOINT - Plataforma Lotofácil

> Última atualização: 20/07/2026
> Este arquivo documenta o estado atual do projeto para recuperação rápida em caso de travamento.

---

## 📋 Status Geral

| Item | Status |
|------|--------|
| Servidor rodando na porta 3000 | ✅ OK |
| Login admin@lotofacil.com / 123456 | ✅ OK |
| Login maria@email.com / 123456 | ✅ OK |
| Todas as páginas retornam HTTP 200 | ✅ OK |
| Motor genético carregado (gen 15, fitness 4520) | ✅ OK |
| Cache de 3.739 concursos | ✅ OK |

---

## ✅ Últimas Correções Realizadas

### 1. simulation.ejs - Bug saveGameToPortfolio
- **Problema:** Chave `name` duplicada e variável `count` inexistente
- **Correção:** Removeu linha duplicada; agora salva jogos IA corretamente no portfólio
- **Arquivo:** `web/views/simulation.ejs`

### 2. pools.ejs - Nome hardcoded + EJS dentro de backtick
- **Problema:** `'João Silva'` fixo no código + `<%- JSON.stringify %>` dentro de backtick
- **Correção:** Nome dinâmico do usuário logado; pré-cálculo de variáveis antes do backtick
- **Arquivo:** `web/views/pools.ejs`

### 3. bets.ejs - Erro silencioso no catch
- **Problema:** `catch(e) {}` engolia erro ao salvar jogo no portfólio
- **Correção:** Adicionado `console.warn` + `showToast('info')`
- **Arquivo:** `web/views/bets.ejs`

### 4. profile.ejs - EJS dentro de backtick
- **Problema:** `<%= %>` dentro de backtick causava HTTP 500
- **Correção:** Pré-cálculo de variáveis financeiras antes do backtick
- **Arquivo:** `web/views/profile.ejs`

### 5. my-games.ejs - Backtick aninhado
- **Problema:** Template literal JS dentro do body backtick
- **Correção:** Substituído por concatenação de strings
- **Arquivo:** `web/views/my-games.ejs`

---

## 🚧 IMPLEMENTAÇÃO DE 10 FUNCIONALIDADES

### FASE 1 — Estatísticas Avançadas ✅ CONCLUÍDA
- [x] Heatmap dos números mais frequentes (5x5 com gradiente de cor)
- [x] Números Quentes vs Frios (mais/menos sorteados)
- [x] Análise de Atraso (números há mais tempo sem sair)
- [x] API endpoint `/api/stats/advanced`
- [x] Página `/estatisticas` criada (stats.ejs)
- [x] Link no sidebar (seção Principal)
- [x] Método `getAdvancedStats` no api.js

### FASE 2 — Dashboard Turbinada ✅ CONCLUÍDA
- [x] Widget "Números da Sorte do Dia" (frequência + IA)
- [x] Widget "Cobertura do Portfólio" (heatmap 5x5, % cobertura)
- [x] Previsão de números não cobertos / complementares
- [x] API endpoints: /api/dashboard/lucky-numbers, /api/dashboard/portfolio-insights
- [x] Métodos no api.js: getLuckyNumbers, getPortfolioInsights

### FASE 3 — Comparador de Jogos ✅ CONCLUÍDA
- [x] Checkbox em cada card de jogo para seleção
- [x] Botão "Comparar Selecionados"
- [x] Similaridade entre pares (Índice Jaccard)
- [x] Cobertura combinada (números distintos dos jogos)
- [x] Números únicos por jogo
- [x] Sugestão de números complementares (não cobertos)
- [x] API endpoint: /api/games/compare
- [x] Método no api.js: compareGames

### FASE 4 — Sistema de Notificações ✅ CONCLUÍDA
- [x] `addNotification()` no servidor (armazenamento em memória)
- [x] Bell dropdown com badge na topbar (layout.ejs)
- [x] Painel de notificações com lista, toggle e outside-click
- [x] Notificação when jogo é premiado (check-result com hits >= 11)
- [x] API: GET /api/notifications, POST /:id/read, POST /read-all
- [x] Métodos no api.js: getNotifications, readNotification, readAllNotifications

### FASE 5 — Múltiplas Loterias ✅ CONCLUÍDA
- [x] LOTTERY_CONFIGS com 4 tipos (Lotofácil, Mega-Sena, Quina, Lotomania)
- [x] PRIZE_TABLES com premiações por loteria
- [x] Validação de jogos usa cfg.pickCount e cfg.totalNumbers (dinâmico)
- [x] bets.ejs: grade de números se adapta (5 colunas para LF, 10 para as demais)
- [x] bets.ejs: quickPick, confirmBet, useAIGenerate usam currentGame
- [x] bets.ejs: loadFromPortfolio filtra por gameType
- [x] api.js: getGames aceita gameType como filtro
- [x] server.js: /api/games filtra por gameType

### FASE 6 — Exportação de Dados ✅ CONCLUÍDA
- [x] Exportar jogos do portfólio para CSV
- [x] Botão de download na página Meus Jogos
- [x] Relatório de desempenho do portfólio (com preço dinâmico por loteria)

### FASE 7 — Mercado de Cotas ✅ CONCLUÍDA
- [x] Usuários podem vender cotas de bolões (botão "Vender Cotas")
- [x] Feed de ofertas ativas nos cards "Meus Bolões"
- [x] Comprar cotas de outros usuários (botão "Comprar")
- [x] APIs: createOffer, buyOffer

### FASE 8 — Apostas Recorrentes ✅ CONCLUÍDA
- [x] Assinar jogo para rodar automaticamente (UI em Configurações)
- [x] Gerenciar assinaturas ativas (listar, criar, cancelar)
- [x] Débito automático da carteira (auto-renovação a cada 60s)
- [x] APIs: POST/GET/DELETE /api/subscriptions

### FASE 9 — Gamificação ✅ CONCLUÍDA
- [x] Sistema de 16 medalhas/conquistas
- [x] Nível do usuário (baseado em XP)
- [x] Widget de nível na Dashboard + Perfil
- [x] Grid de conquistas no Perfil
- [x] Conquistas automáticas: criar jogos, usar IA, bolões, prêmios, assinaturas, exportar
- [x] Notificação ao desbloquear conquista

### FASE 10 — Compartilhamento Social ✅ CONCLUÍDA
- [x] Compartilhar estatísticas do portfólio (WhatsApp, Telegram, Twitter)
- [x] Compartilhar bolão via link
- [x] Botão "Compartilhar" em Meus Jogos e Bolões
- [x] Widget de bolões populares na Dashboard
- [x] APIs: shareGame, sharePool, shareStats

---

## 📝 Notas Importantes

- **Auto-renovação de assinaturas**: Verifica a cada 60 segundos se há assinaturas ativas. Para produção, aumentar para 1 hora.
- **checkAchievements**: Chamado em endpoints estratégicos (criar jogo, join pool, ganhar prêmio, criar assinatura, exportar CSV).
- **export_first**: Concedido manualmente no endpoint de exportação CSV.
- **share_first**: Concedido manualmente no endpoint shareGame.
- **Preço dinâmico**: Relatório de desempenho agora usa o preço real de cada loteria (R$3 Lotofácil, R$5 Mega-Sena, etc.).

## 🐛 Bugs Conhecidos

Nenhum conhecido no momento.

---

## 🔧 Como Reiniciar o Servidor

```bash
cd /c/projetos/sfg/web
npm start        # node server.js
# Acessar: http://localhost:3000
```

## 🔐 Contas de Teste

| Papel | Email | Senha | Nome |
|---|---|---|---|
| Admin | admin@lotofacil.com | 123456 | João Silva |
| Usuário | maria@email.com | 123456 | Maria Santos |

## 📁 Arquivos Modificados Recentemente

- `web/views/simulation.ejs` — corrigido saveGameToPortfolio
- `web/views/bets.ejs` — adicionado tratamento de erro no catch
- `web/views/pools.ejs` — nome dinâmico + EJS fix
- `web/views/profile.ejs` — EJS dentro de backtick corrigido
- `web/views/my-games.ejs` — backtick aninhado corrigido
- `web/server.js` — principal servidor
- `web/lib/genetic_engine.js` — motor genético
