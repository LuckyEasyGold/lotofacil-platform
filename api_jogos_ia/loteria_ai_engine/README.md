# 🧬 Loteria AI Engine

<div align="center">

![Loteria AI](https://img.shields.io/badge/Loteria-AI-purple?style=for-the-badge)
![Version](https://img.shields.io/badge/version-1.0.0-blue?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-orange?style=for-the-badge)
![Python](https://img.shields.io/badge/Python-3.10+-brightgreen?style=for-the-badge)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-red?style=for-the-badge)

**Sistema de Inteligência Artificial para Loterias com Algoritmo Genético e Interface Gráfica em Tempo Real**

[API Docs](http://localhost:8000/docs) · [Interface Gráfica](http://localhost:8000) · [Reportar Bug](https://github.com/LuckyEasyGold/loteria_ai_engine/issues)

</div>

---

## 📋 Sobre o Projeto

Loteria AI Engine é uma plataforma completa de análise estatística e geração de jogos para loterias utilizando **algoritmos genéticos**. O sistema opera 24/7 em um loop evolutivo constante, refinando seus algoritmos a cada novo resultado oficial publicado para produzir "sementes" (fórmulas geradoras) otimizadas.

### ✨ Diferenciais

- 🧬 **Algoritmo Genético Avançado**: Evolução contínua de sementes com seleção natural
- 📊 **Interface Gráfica em Tempo Real**: Visualize a evolução dos descendentes com gráficos interativos
- 🔄 **Loop Evolutivo 24/7**: Refinamento constante baseado em novos resultados
- 🎯 **Análise Estatística Profunda**: Identificação de padrões históricos
- 🚀 **API RESTful Completa**: Backend robusto com FastAPI + PostgreSQL
- 📱 **Mobile-Ready**: Sementes otimizadas para geração offline em apps móveis
- 🎨 **Visualização de Descendentes**: Scatter plot colorido mostrando fitness de cada indivíduo
- 🏆 **Sistema de Fitness**: Avaliação por simulação de milhares de jogos
- 🔬 **Matrizes de Correlação**: Análise de relacionamentos entre dezenas
- 🛡️ **Validação Histórica**: Teste contra resultados reais anteriores

---

## 🚀 Funcionalidades

### Para Usuários

- ✅ Visualizar sementes otimizadas para cada tipo de jogo
- ✅ Gerar jogos com base na semente mais recente
- ✅ Acompanhar evolução do algoritmo em tempo real via interface gráfica
- ✅ Ver histórico de gerações e scores de fitness
- ✅ Consultar estatísticas detalhadas da evolução
- ✅ Adicionar novos resultados oficiais para treinamento
- ✅ Exportar sementes para uso em aplicativos móveis
- ✅ Visualizar distribuição de descendentes no espaço de busca
- ✅ Comparar performance entre diferentes tipos de jogo

### Para Desenvolvedores

- ✅ API RESTful documentada com OpenAPI/Swagger
- ✅ Banco de dados PostgreSQL com SQLAlchemy ORM
- ✅ Algoritmo genético implementado com DEAP
- ✅ Sistema de persistência de estado da evolução
- ✅ Loop evolutivo em segundo plano
- ✅ Endpoints para ingestão de dados históricos
- ✅ Sistema de logs e auditoria
- ✅ Containerização completa com Docker
- ✅ Cache opcional com Redis

---

## 🛠️ Tecnologias

### Backend
- **Python 3.10+**
- **FastAPI** (framework web assíncrono)
- **SQLAlchemy** (ORM)
- **PostgreSQL 15+** (banco de dados)
- **Redis 7+** (cache - opcional)
- **DEAP** (algoritmo genético)
- **NumPy** (processamento numérico)
- **Pandas** (análise de dados)
- **Pydantic** (validação de dados)

### Frontend
- **HTML5** + **CSS3**
- **JavaScript Vanilla**
- **Chart.js** (visualização de dados)
- **Jinja2** (templates)

### DevOps
- **Docker** (containerização)
- **Docker Compose** (orquestração)
- **Uvicorn** (servidor ASGI)
- **GitHub Actions** (CI/CD - planejado)

---

## 📦 Instalação

### Pré-requisitos

- Python 3.10+
- Docker e Docker Compose (recomendado)
- OU PostgreSQL 15+ e Redis 7+ (para execução local)
- Git

### 1. Clone o repositório

```bash
git clone https://github.com/LuckyEasyGold/loteria_ai_engine.git
cd loteria_ai_engine
```

### 2. Instale as dependências

#### Opção A: Docker Compose (Recomendado)

```bash
# Nenhuma dependência adicional necessária além do Docker
docker --version
docker-compose --version
```

#### Opção B: Local (Python)

```bash
# Criar ambiente virtual
python -m venv venv

# Ativar ambiente virtual
# Linux/Mac:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Instalar dependências
pip install -r requirements.txt
```

### 3. Configure as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Banco de Dados
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/loteria_ai
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=loteria_ai
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# Redis (opcional)
REDIS_URL=redis://localhost:6379/0

# Aplicação
APP_ENV=development
DEBUG=true
SECRET_KEY=sua-chave-secreta-aqui
LOG_LEVEL=INFO

# Algoritmo Genético
POPULATION_SIZE=100
GENERATIONS_PER_CYCLE=50
MUTATION_RATE=0.1
CROSSOVER_RATE=0.8
```

### 4. Configure o banco de dados

#### Opção A: Docker Compose (Automático)

```bash
# O banco será criado automaticamente
docker-compose up -d postgres
```

#### Opção B: Local (Manual)

```bash
# Certifique-se que o PostgreSQL está rodando
sudo service postgresql start

# Criar banco de dados
sudo -u postgres createdb loteria_ai

# Ou via psql
sudo -u postgres psql -c "CREATE DATABASE loteria_ai;"
```

### 5. Execute em desenvolvimento

#### Opção A: Docker Compose (Recomendado)

```bash
# Iniciar todos os serviços (app, postgres, redis)
docker-compose up -d

# Ver logs em tempo real
docker-compose logs -f app

# Ver status dos containers
docker-compose ps
```

#### Opção B: Local (Python)

```bash
# Iniciar apenas banco de dados com Docker (opcional)
docker-compose up -d postgres redis

# Executar a aplicação
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 6. Acesse a aplicação

- **Interface Gráfica**: http://localhost:8000
- **API Docs (Swagger)**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health
- **API ReDoc**: http://localhost:8000/redoc

---

## 🌐 Deploy

### Deploy com Docker

```bash
# Build das imagens
docker-compose build

# Deploy em produção
docker-compose -f docker-compose.prod.yml up -d

# Ver logs
docker-compose logs -f
```

### Deploy em Plataformas Cloud

#### Railway

```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Login e deploy
railway login
railway init
railway up
```

#### Render

1. Conecte seu repositório GitHub
2. Configure variáveis de ambiente
3. Use o comando: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

#### VPS (DigitalOcean/Hetzner)

```bash
# Clonar repositório
git clone https://github.com/LuckyEasyGold/loteria_ai_engine.git
cd loteria_ai_engine

# Copiar .env
cp .env.example .env
# Editar .env com credenciais de produção

# Build e deploy
docker-compose build
docker-compose up -d
```

---

## 📱 Estrutura do Projeto

```
loteria_ai_engine/
├── app/
│   ├── __init__.py
│   ├── main.py                    # Aplicação FastAPI principal
│   ├── api/
│   │   └── v1/
│   │       ├── routes.py          # Endpoints da API REST
│   │       └── schemas.py         # Modelos Pydantic
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py              # Configurações da aplicação
│   │   └── genetic_engine.py      # Motor de algoritmo genético (DEAP)
│   ├── db/
│   │   ├── __init__.py
│   │   ├── database.py            # Configuração SQLAlchemy
│   │   └── session.py             # Gerenciamento de sessões
│   ├── models/
│   │   ├── __init__.py
│   │   └── models.py              # Modelos SQLAlchemy (4 tabelas)
│   ├── services/
│   │   ├── __init__.py
│   │   └── evolution_service.py   # Lógica de negócio e evolução
│   └── utils/
│       ├── __init__.py
│       └── helpers.py             # Funções utilitárias
├── frontend/
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css          # Estilos da interface
│   │   └── js/
│   │       └── app.js             # Lógica Chart.js + AJAX
│   └── templates/
│       └── index.html             # Interface gráfica principal
├── tests/
│   ├── __init__.py
│   ├── test_api.py                # Testes de API
│   └── test_genetic.py            # Testes do algoritmo genético
├── data/
│   └── historical/                # Dados históricos CSV (opcional)
├── scripts/
│   ├── seed_data.py               # Popular banco com dados iniciais
│   └── export_seed.py             # Exportar semente atual
├── .env.example                   # Modelo de variáveis de ambiente
├── .gitignore
├── docker-compose.yml             # Orquestração Docker
├── Dockerfile                     # Imagem da aplicação
├── requirements.txt               # Dependências Python
└── README.md                      # Este arquivo
```

---

## 🧬 Algoritmo Genético

### Indivíduo (Semente)

Cada "semente" é um conjunto de pesos e regras que define como jogos são gerados:

- **Genoma**: Vetor de probabilidades para cada dezena (ex: peso do número 10 = 0.85)
- **Matrizes de Correlação**: Relacionamentos entre números (ex: se sai 5, aumenta chance do 12)
- **Filtros de Padrão**: Regras como par/ímpar, soma total, sequências

### Função de Fitness

O algoritmo avalia cada semente simulando **10.000 jogos** e comparando com resultados históricos:

- **Pontuação Positiva**: Quadras, quinas e senas simuladas vs. esperadas
- **Penalidade**: Padrões improváveis (ex: 1,2,3,4,5,6) são penalizados
- **Score Final**: Combinação ponderada de acertos e padrões

### Ciclo de Evolução

1. **População Inicial**: 100-1000 sementes candidatas
2. **Seleção**: Torneio entre as sementes (melhores avançam)
3. **Crossover**: Combinação de pesos de dois pais para criar filhos
4. **Mutação**: Pequenas alterações aleatórias nos pesos (exploração)
5. **Substituição**: Piores 10% são descartadas
6. **Checkpoint**: A cada X gerações, salva melhor semente no banco

---

## 🎮 Uso da Interface Gráfica

1. **Acesse** http://localhost:8000
2. **Selecione** o tipo de jogo:
   - Lotofácil (25 números, escolhe 15)
   - Mega-Sena (60 números, escolhe 6)
   - Quina (80 números, escolhe 5)
   - Lotomania (100 números, escolhe 20)
3. **Configure** os parâmetros (opcional):
   - Tamanho da população (padrão: 100)
   - Número de gerações (padrão: 50)
4. **Clique** em **"▶️ Rodar Evolução"**
5. **Acompanhe** a evolução nos gráficos:
   - 📈 **Gráfico de Linha**: Evolução do fitness (melhor, médio, pior) ao longo das gerações
   - 🔵 **Scatter Plot**: Cada ponto representa um descendente, colorido por fitness (verde=melhor, vermelho=pior)
6. **Visualize** as estatísticas:
   - Geração atual
   - Melhor fitness
   - Fitness médio
   - Resultados analisados
7. **Consulte** a tabela de gerações e informações da semente ativa

### Interpretação dos Gráficos

#### Gráfico de Evolução (Linha)
- **Linha Verde**: Melhor fitness da geração
- **Linha Azul**: Fitness médio da população
- **Linha Vermelha**: Pior fitness da geração
- **Eixo X**: Número da geração
- **Eixo Y**: Score de fitness

#### Scatter Plot (Descendentes)
- **Cada Ponto**: Um indivíduo da população
- **Cor**: Intensidade do fitness (verde escuro = melhor, vermelho = pior)
- **Posição X/Y**: Coordenadas no espaço de busca (PCA ou projeção 2D)
- **Tamanho**: Pode representar diversidade ou outro atributo

---

## 🔌 API Endpoints

### Saúde

```http
GET /health
```

### Sementes

```http
GET /api/v1/seed/{game_type}
```

**Response:**
```json
{
  "version": "1.0.45",
  "game_type": "LOTOFACIL",
  "weights": [0.5, 0.8, 0.3, ...],
  "correlations": [[...]],
  "filters": { "min_evens": 8, "max_evens": 10 },
  "generated_at": "2024-01-15T10:00:00Z"
}
```

### Resultados

```http
POST /api/v1/results
Content-Type: application/json

{
  "game_type": "LOTOFACIL",
  "contest_number": 3000,
  "draw_date": "2024-01-15T20:00:00",
  "numbers": [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]
}
```

### Estatísticas

```http
GET /api/v1/stats/{game_type}
```

### Histórico de Evolução

```http
GET /api/v1/evolution-history/{game_type}?limit=100
```

### Gerar Jogos

```http
GET /api/v1/games/{game_type}?quantity=5
```

**Response:**
```json
{
  "game_type": "LOTOFACIL",
  "games": [
    [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
    [2,4,6,8,10,12,14,16,18,20,22,24,25,3,5]
  ],
  "seed_version": "1.0.45"
}
```

📖 [Documentação completa: http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🎯 Tipos de Jogo Suportados

| Jogo | Números Disponíveis | Números por Jogo | Prêmio Mínimo |
|------|-------------------|------------------|---------------|
| Lotofácil | 25 | 15 | 11 acertos |
| Mega-Sena | 60 | 6 | 4 acertos |
| Quina | 80 | 5 | 3 acertos |
| Lotomania | 100 | 20 | 0 acertos (surpresinha) |

---

## 📝 Exemplos de Uso

### Obter Semente Atual (cURL)

```bash
curl http://localhost:8000/api/v1/seed/LOTOFACIL | jq
```

### Obter Semente Atual (Python)

```python
import requests

response = requests.get('http://localhost:8000/api/v1/seed/LOTOFACIL')
seed = response.json()
print(f"Versão: {seed['version']}")
print(f"Pesos: {seed['weights'][:5]}...")  # Primeiros 5 pesos
```

### Adicionar Resultado Oficial

```bash
curl -X POST http://localhost:8000/api/v1/results \
  -H "Content-Type: application/json" \
  -d '{
    "game_type": "LOTOFACIL",
    "contest_number": 3000,
    "draw_date": "2024-01-15T20:00:00",
    "numbers": [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]
  }'
```

### Gerar 5 Jogos

```bash
curl "http://localhost:8000/api/v1/games/LOTOFACIL?quantity=5" | jq
```

### Consultar Estatísticas

```bash
curl http://localhost:8000/api/v1/stats/MEGASENA | jq
```

---

## 📊 Monitoramento

### Health Check

```bash
curl http://localhost:8000/health
```

**Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "evolution_running": true,
  "current_generation": 1250
}
```

### Logs

```bash
# Logs da aplicação
docker-compose logs -f app

# Logs do banco de dados
docker-compose logs -f postgres

# Logs do Redis
docker-compose logs -f redis
```

### Métricas

- Gerações executadas
- Melhor fitness histórico
- Tempo médio por geração
- Quantidade de resultados analisados
- Performance da API (tempo de resposta)

---

## 🔒 Segurança

- ✅ **Rate Limiting**: Proteger endpoints contra abuso (configurar em produção)
- ✅ **CORS**: Configurável para domínios específicos
- ✅ **Variáveis de Ambiente**: Credenciais nunca hard-coded
- ✅ **HTTPS**: Recomendado em produção
- ✅ **Backup**: Backup diário automático do PostgreSQL
- ✅ **Logs de Auditoria**: Todos os endpoints registrados

---

## 🤝 Como Contribuir

Contribuições são bem-vindas! Siga os passos:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

### Áreas que precisam de ajuda

- [ ] Implementar scraper automático de resultados da Caixa
- [ ] Adicionar WebSocket para updates em tempo real na interface
- [ ] Criar testes automatizados (pytest)
- [ ] Implementar CI/CD com GitHub Actions
- [ ] Adicionar suporte a mais loterias internacionais
- [ ] Otimizar algoritmo genético para performance
- [ ] Criar dashboard administrativo
- [ ] Implementar sistema de autenticação para endpoints admin
- [ ] Adicionar exportação de dados em formatos variados (CSV, JSON, Excel)
- [ ] Documentação de API com exemplos interativos

---

## 📈 Progresso do Projeto

**Status Atual:** 90% Concluído

| Fase | Descrição | Status |
|------|-----------|--------|
| 1 | Configuração do Ambiente | ✅ 100% |
| 2 | Modelagem do Banco | ✅ 100% |
| 3 | API Endpoints Básicos | ✅ 100% |
| 4 | Motor Genético (DEAP) | ✅ 100% |
| 5 | Interface Gráfica | ✅ 100% |
| 6 | Integração Banco + API | ✅ 100% |
| 7 | Dockerização | ✅ 100% |
| 8 | Sistema de Logs | ✅ 100% |
| 9 | Otimização de Performance | 🔄 70% |
| 10 | Scraper Automático | ⏸️ 0% |
| 11 | WebSocket Tempo Real | ⏸️ 0% |
| 12 | Tests Automatizados | ⏸️ 0% |
| 13 | CI/CD Pipeline | ⏸️ 0% |
| 14 | Dashboard Admin | ⏸️ 0% |

---

## ❓ FAQ

### Quanto tempo leva para evoluir uma semente?
Depende dos parâmetros. Com população=100 e gerações=50, leva ~2-5 minutos.

### Posso usar em produção?
Sim! Mas recomendamos configurar rate limiting, HTTPS e backup automático.

### Os jogos gerados garantem vitória?
**NÃO!** Loterias são jogos de azar. O sistema apenas otimiza baseado em estatísticas históricas.

### Como adicionar novos resultados?
Via endpoint `POST /api/v1/results` ou importando CSVs históricos.

### Funciona offline?
A API precisa estar online, mas a semente pode ser usada offline em apps móveis.

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## ⚠️ Aviso Importante

**ESTE SISTEMA É UMA FERRAMENTA DE ANÁLISE ESTATÍSTICA E NÃO GARANTE GANHOS EM LOTERIAS.**

Loterias são jogos de azar onde os resultados são **totalmente aleatórios**. Este software:

- ❌ **NÃO garante** prêmios ou vitórias
- ❌ **NÃO prevê** resultados futuros
- ❌ **NÃO substitui** a sorte
- ✅ **APENAS analisa** padrões históricos
- ✅ **APENAS otimiza** com base em dados passados

Use com **responsabilidade** e nunca gaste mais do que pode perder. Jogue de forma consciente.

---

## 👨‍💻 Autor

**Vinícius Ribeiro Ramos**

- GitHub: [@LuckyEasyGold](https://github.com/LuckyEasyGold)
- Email: viniciusribramos@gmail.com
- WhatsApp: (42) 99106-6464
- Projetos: [Tarifa Zero](https://github.com/LuckyEasyGold/tarifaZero), [Loteria AI Engine](https://github.com/LuckyEasyGold/loteria_ai_engine)
- Localização: Palmas - PR, Brasil

---

## 🙏 Agradecimentos

- Comunidade open source Python
- Criadores do FastAPI e DEAP
- Contribuidores do projeto
- Todos que acreditam em tecnologia aplicada à análise de dados

---

## 📞 Contato

- **Dúvidas**: Abra uma issue no GitHub
- **Parcerias**: Envie um email para viniciusribramos@gmail.com
- **Suporte**: WhatsApp (42) 99106-6464

---

<div align="center">

**Desenvolvido com ❤️ usando Python, FastAPI e Algoritmos Genéticos**

[⬆ Voltar ao topo](#-loteria-ai-engine)

</div>
