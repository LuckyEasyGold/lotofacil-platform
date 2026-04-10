# 🎲 Loteria IA - Aplicativo Mobile

Aplicativo mobile de loterias com inteligência artificial para geração de jogos, gestão financeira e simulação de resultados. Desenvolvido em **React Native** com **Expo**.

## 🚀 Funcionalidades

- **Geração de Jogos com IA**: Análise estatística dos últimos resultados para sugerir jogos otimizados
- **Múltiplas Loterias**: Lotofácil, Mega Sena, Quina, Lotomania, Dupla Sena, Timemania, Dia de Sorte, Super Sete, Federal
- **Carteira Digital**: Depósitos, saques, transferências, compra/venda de cotas de bolão
- **Simulador de Resultados**: Teste seus jogos contra os últimos 50 concursos
- **Histórico Completo**: Acompanhe todos os jogos gerados e utilizados
- **Sistema de Bolão**: Crie, participe e gerencie bolões com outros usuários
- **Interface Bancária**: Design moderno inspirado em apps de investimento

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- [Node.js](https://nodejs.org/) (versão 18 ou superior)
- [Git](https://git-scm.com/)
- [VS Code](https://code.visualstudio.com/) (editor recomendado)
- PowerShell (já incluso no Windows)

### Extensões Recomendadas para VS Code

- ES7+ React/Redux/React-Native snippets
- Prettier - Code formatter
- ESLint
- Expo Tools

## 🛠️ Instalação Automática (Windows/PowerShell)

O projeto inclui um script automático que configura todo o ambiente:

```powershell
cd loteria-ai-app
.\inicial.ps1
```

Este script irá:
1. ✅ Verificar se o Node.js está instalado
2. ✅ Instalar todas as dependências do projeto
3. ✅ Verificar estrutura de diretórios e arquivos
4. ✅ Limpar cache do npm
5. ✅ Preparar o ambiente para desenvolvimento

### Execução Manual (caso prefira)

Se preferir executar manualmente ou estiver em outro sistema operacional:

```bash
cd loteria-ai-app
npm install
npm start
```

## 🏃‍♂️ Como Rodar o Projeto

Após a instalação das dependências:

```bash
npm start
```

Isso iniciará o **Expo DevTools** no seu navegador. Você terá três opções:

1. **Testar no Celular Físico** (Recomendado):
   - Baixe o app **Expo Go** na App Store (iOS) ou Google Play (Android)
   - Escaneie o QR code exibido no terminal/navegador

2. **Testar no Emulador Android**:
   - Pressione `a` no terminal ou clique em "Run on Android device/emulator"
   - Requer Android Studio instalado

3. **Testar no Simulador iOS** (apenas macOS):
   - Pressione `i` no terminal ou clique em "Run on iOS simulator"
   - Requer Xcode instalado

4. **Testar no Navegador Web**:
   - Pressione `w` no terminal
   - Abre uma versão web do aplicativo

## 📁 Estrutura do Projeto

```
loteria-ai-app/
├── src/
│   ├── components/     # Componentes reutilizáveis
│   │   ├── GameCard.tsx
│   │   └── TransactionItem.tsx
│   ├── screens/        # Telas principais do app
│   │   ├── HomeScreen.tsx
│   │   ├── WalletScreen.tsx
│   │   ├── HistoryScreen.tsx
│   │   └── ProfileScreen.tsx
│   ├── navigation/     # Configuração de navegação
│   │   └── AppNavigator.tsx
│   ├── context/        # Context API para estado global
│   │   └── AppContext.tsx
│   ├── services/       # Serviços e API mock
│   │   └── api.ts
│   ├── types/          # Definições TypeScript
│   │   └── index.ts
│   └── utils/          # Funções utilitárias
│       ├── helpers.ts
│       ├── constants.ts
│       └── index.ts
├── assets/             # Imagens, ícones e fonts
├── App.tsx             # Componente principal
├── package.json        # Dependências do projeto
├── tsconfig.json       # Configuração TypeScript
├── app.json            # Configuração Expo
├── README.md           # Documentação completa
├── SETUP.md            # Guia de configuração rápida
└── inicial.ps1         # Script de instalação automática
```

## 🎨 Tecnologias Utilizadas

- **React Native** - Framework mobile
- **Expo** - Plataforma de desenvolvimento
- **TypeScript** - Tipagem estática
- **React Navigation** - Navegação entre telas
- **Context API** - Gerenciamento de estado
- **AsyncStorage** - Armazenamento local
- **Linear Gradient** - Gradientes na UI
- **Vector Icons** - Ícones nativos

## 🔧 Comandos Disponíveis

```bash
npm start          # Inicia o servidor de desenvolvimento
npm run android    # Roda no emulador Android
npm run ios        # Roda no simulador iOS (macOS apenas)
npm run web        # Roda no navegador
npm run lint       # Verifica erros de código
npm run build      # Gera build de produção
```

## 🤖 Integração com API de IA

Atualmente o projeto utiliza uma API mock (`src/services/api.ts`) que simula a resposta da IA. Para integrar com sua API real:

1. Edite o arquivo `src/services/api.ts`
2. Substitua as funções mock pelas chamadas HTTP reais
3. Configure a URL base da sua API
4. Ajuste os tipos em `src/types/index.ts` conforme necessário

Exemplo de integração:

```typescript
// src/services/api.ts
const API_URL = 'https://sua-api-ia.com';

export const generateGame = async (gameType: string) => {
  const response = await fetch(`${API_URL}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: gameType })
  });
  return response.json();
};
```

## 📱 Telas do Aplicativo

O aplicativo possui 4 telas principais acessíveis via tab bar inferior:

1. **🏠 Home**: 
   - Saldo atual
   - Últimos resultados das loterias
   - Cards de jogos disponíveis
   - Botão para gerar jogos com IA

2. **💰 Carteira**: 
   - Extrato completo
   - Depósitos e saques
   - Transferências
   - Bolões ativos

3. **📊 Histórico**: 
   - Jogos gerados anteriormente
   - Jogos utilizados em concursos
   - **Simulador de resultados** (testa contra 50 últimos concursos)

4. **👤 Perfil**: 
   - Dados do usuário
   - Dados bancários
   - Configurações
   - Resumo financeiro

## 🐛 Solução de Problemas

### Erro: "Command not found: expo"
```bash
npm install -g expo-cli
```

### Erro: "Metro bundler not starting"
```bash
npx expo start -c
```

### Erro: "Network response timed out" (celular)
- Verifique se computador e celular estão no **mesmo Wi-Fi**
- Tente: `npx expo start --host lan`

### Problemas no Android Emulator
- Certifique-se de ter o Android Studio instalado
- Crie um dispositivo virtual no AVD Manager
- Inicie o emulador antes de rodar `npm run android`

### Problemas no iOS Simulator (macOS)
- Certifique-se de ter o Xcode instalado
- Aceite os termos de licença do Xcode
- Execute: `sudo xcode-select --switch /Applications/Xcode.app`

## 📄 Licença

Este projeto está sob licença MIT. Sinta-se livre para usar e modificar.

## 🤝 Contribuição

Contribuições são bem-vindas! Siga estes passos:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📞 Suporte

Para dúvidas ou problemas:
- Consulte o arquivo `SETUP.md` para guia de configuração detalhada
- Abra uma issue no repositório
- Entre em contato com a equipe de desenvolvimento

## 🔗 Links Úteis

- [Documentação Expo](https://docs.expo.dev/)
- [React Native Docs](https://reactnative.dev/)
- [React Navigation](https://reactnavigation.org/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

**Desenvolvido com ❤️ usando React Native e Expo**
