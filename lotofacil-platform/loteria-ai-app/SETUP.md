# Guia de Configuração Rápida - Loteria IA App

## 🚀 Início Rápido

### Windows (PowerShell)

1. **Abra o PowerShell** na pasta do projeto:
   ```powershell
   cd loteria-ai-app
   ```

2. **Execute o script de inicialização**:
   ```powershell
   .\inicial.ps1
   ```

3. **Inicie o aplicativo**:
   ```bash
   npm start
   ```

4. **Escolha como testar**:
   - **Celular físico**: Baixe "Expo Go" na App Store ou Google Play e escaneie o QR code
   - **Navegador**: Pressione `w` no terminal
   - **Emulador Android**: Pressione `a` no terminal (requer Android Studio)
   - **Simulador iOS**: Pressione `i` no terminal (apenas macOS, requer Xcode)

---

## 📋 Pré-requisitos Detalhados

### 1. Node.js (Versão 18 ou superior)

**Verificar se já está instalado:**
```bash
node --version
```

**Instalar:**
- Acesse: https://nodejs.org/
- Baixe a versão **LTS** (Long Term Support)
- Execute o instalador e siga as instruções

### 2. Git

**Verificar se já está instalado:**
```bash
git --version
```

**Instalar:**
- Windows: https://git-scm.com/download/win
- macOS: Já vem instalado ou via Homebrew (`brew install git`)
- Linux: `sudo apt install git` (Ubuntu/Debian)

### 3. VS Code (Editor Recomendado)

**Baixar e instalar:**
- Acesse: https://code.visualstudio.com/
- Instale as extensões recomendadas:
  - ES7+ React/Redux/React-Native snippets
  - Prettier - Code formatter
  - ESLint
  - Expo Tools

---

## 🔧 Instalação Manual (Alternativa)

Se preferir não usar o script automático:

```bash
# Navegue até a pasta do projeto
cd loteria-ai-app

# Instale todas as dependências
npm install

# Ou use yarn se preferir
yarn install

# Inicie o servidor de desenvolvimento
npm start
```

---

## 📱 Testando no Celular (Recomendado)

### Passo 1: Instalar Expo Go

- **iOS**: App Store → Busque por "Expo Go"
- **Android**: Google Play → Busque por "Expo Go"

### Passo 2: Conectar ao Mesmo Wi-Fi

Certifique-se de que seu computador e celular estão na **mesma rede Wi-Fi**.

### Passo 3: Escanear QR Code

1. Execute `npm start` no computador
2. Um QR code aparecerá no terminal
3. Abra o Expo Go no celular
4. Escaneie o QR code:
   - **iOS**: Use a câmera nativa
   - **Android**: Toque em "Scan QR Code"

---

## 🖥️ Testando no Navegador

```bash
npm start
# Pressione 'w' no terminal
```

Ou diretamente:
```bash
npm run web
```

O aplicativo abrirá no seu navegador padrão.

---

## 🤖 Testando no Emulador Android

### Pré-requisitos:
- Android Studio instalado
- Um dispositivo virtual (AVD) criado

### Passos:

1. **Abra o Android Studio**
2. **Vá em Tools → Device Manager**
3. **Crie um dispositivo virtual** (se não tiver)
4. **Inicie o emulador**
5. **No terminal do projeto**:
   ```bash
   npm run android
   ```

---

## 🍎 Testando no Simulador iOS (macOS apenas)

### Pré-requisitos:
- macOS
- Xcode instalado
- Aceitar termos de licença do Xcode

### Passos:

1. **Instale o Xcode** da App Store
2. **Abra o Xcode** e aceite os termos
3. **Configure o simulador**:
   ```bash
   sudo xcode-select --switch /Applications/Xcode.app
   ```
4. **No terminal do projeto**:
   ```bash
   npm run ios
   ```

---

## 🐛 Solução de Problemas Comuns

### Erro: "Cannot find module 'expo'"

```bash
npm install expo --save
```

### Erro: "Metro bundler not starting"

```bash
npx expo start -c
```

### Erro: "Network response timed out" (celular)

- Verifique se computador e celular estão no **mesmo Wi-Fi**
- Desative firewalls temporariamente
- Tente usar o IP explícito:
  ```bash
  npx expo start --host lan
  ```

### Erro: "Node version mismatch"

Verifique a versão do Node:
```bash
node --version
```

Deve ser **18.x ou superior**. Atualize se necessário.

### Erro: "EMFILE: too many open files" (macOS/Linux)

```bash
ulimit -n 10240
```

### Build falhando no Android

Limpe o cache:
```bash
cd android
./gradlew clean
cd ..
npm start
```

---

## 📦 Estrutura do Projeto

```
loteria-ai-app/
├── src/
│   ├── components/     # Componentes reutilizáveis
│   │   ├── GameCard.tsx
│   │   └── TransactionItem.tsx
│   ├── screens/        # Telas principais
│   │   ├── HomeScreen.tsx
│   │   ├── WalletScreen.tsx
│   │   ├── HistoryScreen.tsx
│   │   └── ProfileScreen.tsx
│   ├── navigation/     # Configuração de rotas
│   │   └── AppNavigator.tsx
│   ├── context/        # Estado global
│   │   └── AppContext.tsx
│   ├── services/       # API e serviços
│   │   └── api.ts
│   ├── types/          # Tipos TypeScript
│   │   └── index.ts
│   └── utils/          # Funções utilitárias
│       ├── helpers.ts
│       ├── constants.ts
│       └── index.ts
├── assets/             # Imagens e ícones
├── App.tsx             # Entry point
├── package.json        # Dependências
├── tsconfig.json       # Config TypeScript
├── app.json            # Config Expo
├── README.md           # Documentação completa
└── inicial.ps1         # Script de instalação
```

---

## 🎯 Próximos Passos

Após configurar e rodar o app:

1. **Explore as funcionalidades**:
   - Home: Gere jogos com IA
   - Carteira: Gerencie seu saldo
   - Histórico: Veja jogos anteriores e simule resultados
   - Perfil: Configure sua conta

2. **Personalize**:
   - Edite `src/services/api.ts` para integrar com sua API real
   - Ajuste cores e temas em `src/utils/constants.ts`
   - Adicione novos jogos em `src/types/index.ts`

3. **Desenvolva**:
   - Crie novas telas em `src/screens/`
   - Adicione componentes em `src/components/`
   - Implemente navegação em `src/navigation/`

---

## 📚 Recursos Úteis

- [Documentação Expo](https://docs.expo.dev/)
- [React Native Docs](https://reactnative.dev/)
- [React Navigation](https://reactnavigation.org/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

## 💡 Dicas de Desenvolvimento

1. **Hot Reload**: Mudanças no código são refletidas automaticamente
2. **Debug no Celular**: Shake o dispositivo para abrir menu de debug
3. **Console Logs**: Aparecem no terminal onde rodou `npm start`
4. **Recarregar**: 
   - iOS: Cmd + D → Reload
   - Android: Shake → Reload
   - Web: F5

---

**Dúvidas?** Consulte o `README.md` principal ou abra uma issue no repositório.
