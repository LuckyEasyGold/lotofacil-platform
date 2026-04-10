# Loteria AI App - Aplicativo Mobile de Loterias com IA

## Visão Geral

Aplicativo mobile desenvolvido em **React Native (Expo)** para geração de jogos de loteria utilizando Inteligência Artificial. O app possui interface moderna semelhante a aplicativos bancários/de investimento, com controle financeiro completo e funcionalidades avançadas.

## Tecnologias Utilizadas

- **Framework**: React Native com Expo SDK 54
- **Linguagem**: TypeScript
- **Navegação**: React Navigation 6 (Bottom Tabs)
- **Gerenciamento de Estado**: Context API
- **UI Components**: Componentes nativos do React Native + Ícones Ionicons

## Estrutura do Projeto

```
loteria-ai-app/
├── src/
│   ├── components/       # Componentes reutilizáveis
│   │   ├── GameCard.tsx
│   │   └── TransactionItem.tsx
│   ├── context/          # Contextos React
│   │   └── AppContext.tsx
│   ├── navigation/       # Configuração de navegação
│   │   └── AppNavigator.tsx
│   ├── screens/          # Telas principais
│   │   ├── HomeScreen.tsx
│   │   ├── WalletScreen.tsx
│   │   ├── HistoryScreen.tsx
│   │   └── ProfileScreen.tsx
│   ├── services/         # Serviços e APIs
│   │   └── api.ts
│   ├── types/            # Tipos TypeScript
│   │   └── index.ts
│   └── utils/            # Utilitários
├── App.tsx               # Componente principal
├── package.json
└── tsconfig.json
```

## Funcionalidades Implementadas

### 🏠 Tela Inicial (Home)
- Exibição do saldo atual do usuário
- Últimos resultados das loterias (Lotofácil, Mega Sena, Quina, etc.)
- Cards interativos para cada tipo de jogo
- Geração de jogos com IA
- Transações recentes
- Interface similar a apps bancários

### 💰 Carteira (Wallet)
- Saldo disponível
- Resumo financeiro completo:
  - Total depositado
  - Total sacado
  - Prêmios ganhos
  - Gasto em apostas
  - Ganho/perda com cotas de bolão
- Cadastro de conta bancária
- Extrato com filtros (todos, entradas, saídas, apostas, cotas)
- Histórico de transações detalhado

### 📊 Histórico de Jogos
- Lista de todos os jogos gerados pela IA
- Análise da IA para cada jogo:
  - Nível de confiança
  - Estratégia utilizada
  - Números quentes e frios
- **Simulador de resultados**: Testa seu jogo contra os últimos 50 concursos
- Estatísticas de desempenho:
  - Melhor acerto
  - Quantidade de acertos ≥ 11
  - Prêmio total simulado

### 👤 Perfil
- Dados do usuário
- Resumo financeiro detalhado
- Menu de configurações:
  - Dados pessoais
  - Conta bancária
  - Segurança
  - Notificações
  - Ajuda e suporte
  - Termos de uso

## Tipos de Jogos Suportados (Modular)

O sistema é modular para fácil adição de novos jogos:

- ✅ Lotofácil (15 números de 1 a 25)
- ✅ Mega Sena (6 números de 1 a 60)
- ✅ Quina (5 números de 1 a 80)
- ✅ Lotomania (50 números de 1 a 100)
- ✅ Time Mania
- ✅ Dupla Sena
- ✅ Dia de Sorte
- ✅ Super Sete
- ✅ +Milionária

## Sistema Financeiro

### Entradas de Saldo
- Depósitos via PIX/transferência
- Prêmios de apostas vencedoras
- Venda de cotas de bolão para outros usuários

### Saídas de Saldo
- Saques para conta bancária
- Pagamento de jogos/apostas
- Compra de cotas de bolão de outros usuários

### Controle Completo
- Histórico de todas as transações
- Filtros por categoria
- Status das transações (pendente, concluído, cancelado)

## Inteligência Artificial

A IA analisa:
- Frequência de números sorteados
- Atraso de números
- Padrões históricos
- Equilíbrio entre pares e ímpares
- Distribuição no volante

Retorna:
- Níveis de confiança (75-95%)
- Estratégias utilizadas
- Números quentes (mais frequentes)
- Números frios (menos frequentes)
- Recomendações personalizadas

## Simulador de Resultados

Permite testar qualquer jogo gerado comparando com os últimos 50 concursos:
- Mostra quantos acertos teria feito em cada concurso
- Calcula prêmios que teria ganhado
- Identifica o melhor resultado
- Mostra período analisado

## Bolão (Cotas)

Sistema de bolão integrado:
- Criar bolões com cotas
- Vender cotas para outros usuários
- Comprar cotas de bolões de terceiros
- Controle automático de entradas/saídas

## Design System

- **Cor Primária**: Verde (#10B981) - Remete a dinheiro/investimento
- **Fundo**: Cinza claro (#f5f7fa)
- **Cards**: Branco com sombras suaves
- **Ícones**: Ionicons (consistente com iOS/Android)
- **Tipografia**: Fonte do sistema nativa
- **Border Radius**: 12-16px para cards
- **Sombras**: Elevação sutil para profundidade

## Como Executar

```bash
# Instalar dependências
cd loteria-ai-app
npm install

# Iniciar o servidor de desenvolvimento
npm start

# Rodar em diferentes plataformas
npm run android    # Android
npm run ios        # iOS (requer macOS)
npm run web        # Web browser
```

## API Mock

O projeto inclui um serviço de API mock (`src/services/api.ts`) que simula:
- Autenticação de usuário
- Consulta de saldo e extrato
- Últimos resultados das loterias
- Geração de jogos com IA
- Simulação de resultados
- Gestão de bolões

**Para produção**: Substituir pelas chamadas reais à API backend.

## Próximos Passos Sugeridos

1. **Backend**: Implementar API real com Node.js/Python
2. **IA**: Integrar com modelo de machine learning real
3. **Autenticação**: Login/registro com JWT
4. **Pagamentos**: Integração com gateway de pagamento
5. **Push Notifications**: Alertas de resultados
6. **Compartilhamento**: Compartilhar bolões nas redes sociais
7. **Estatísticas Avançadas**: Gráficos e análises mais detalhadas

## Licença

MIT License - Projeto educacional/demonstrativo

---

**Desenvolvido com ❤️ usando React Native + Expo**
