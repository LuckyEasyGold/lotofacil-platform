#!/bin/bash
# ================================================================
#  🚀 SETUP LOTOFÁCIL PLATFORM - ORACLE CLOUD
#  Script automático de instalação e deploy
#  Uso: chmod +x setup.sh && ./setup.sh
# ================================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }
info() { echo -e "${BLUE}[i]${NC} $1"; }

echo ""
echo "=============================================="
echo "   🚀 LOTOFÁCIL PLATFORM - SETUP ORACLE CLOUD"
echo "=============================================="
echo ""

# ==================== 1. CONFIGURAÇÕES ====================
echo ""
info "Passo 1: Configurações iniciais"

# Solicitar variáveis
read -p "📌 URL do repositório Git (ex: https://github.com/LuckyEasyGold/lotofacil-platform): " GIT_REPO
read -p "🔑 Senha do PostgreSQL [password]: " POSTGRES_PASSWORD
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-password}
read -p "🌐 Domínio (deixe vazio para IP direto): " DOMAIN

# ==================== 2. ATUALIZAR SISTEMA ====================
echo ""
info "Passo 2: Atualizando sistema..."
sudo apt update && sudo apt upgrade -y
log "Sistema atualizado"

# ==================== 3. INSTALAR DOCKER ====================
echo ""
info "Passo 3: Instalando Docker..."

if ! command -v docker &> /dev/null; then
    sudo apt install -y ca-certificates curl gnupg lsb-release
    
    # Adicionar repositório Docker
    sudo install -m 0755 -d /etc/apt/keyrings
    sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    sudo chmod a+r /etc/apt/keyrings/docker.asc
    
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.sources > /dev/null
    
    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Adicionar usuário ao grupo docker
    sudo usermod -aG docker $USER
    
    log "Docker instalado"
else
    log "Docker já instalado: $(docker --version)"
fi

# ==================== 4. ABRIR PORTAS NO FIREWALL ====================
echo ""
info "Passo 4: Configurando firewall (iptables)..."

# Abrir portas HTTP e HTTPS
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
sudo iptables -I INPUT -p tcp --dport 3000 -j ACCEPT 2>/dev/null || true  # Opcional: acesso direto

# Instalar iptables-persistent para salvar regras
sudo apt install -y iptables-persistent 2>/dev/null || true
sudo netfilter-persistent save 2>/dev/null || true

log "Portas 80, 443, 3000 liberadas no firewall do sistema"

warn "⚠️  IMPORTANTE: Você TAMBÉM precisa liberar as portas no Console Oracle Cloud!"
warn "   Vá em: Networking > Virtual Cloud Networks > Sua VCN > Security Lists"
warn "   Adicione regras Ingress para portas 80 e 443 (Source: 0.0.0.0/0, TCP)"

# ==================== 5. CLONAR REPOSITÓRIO ====================
echo ""
info "Passo 5: Clonando repositório..."

# Primeira vez ou atualizar?
if [ -d "lotofacil-platform" ]; then
    warn "Diretório 'lotofacil-platform' já existe. Atualizando..."
    cd lotofacil-platform
    git pull
else
    if [ -n "$GIT_REPO" ]; then
        git clone $GIT_REPO
        cd lotofacil-platform
    else
        error "Nenhum repositório informado. Clone manualmente:"
        error "git clone https://github.com/LuckyEasyGold/lotofacil-platform"
        exit 1
    fi
fi

log "Código atualizado"

# ==================== 6. CONFIGURAR VARIÁVEIS DE AMBIENTE ====================
echo ""
info "Passo 6: Configurando variáveis de ambiente..."

cat > .env << EOF
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
DOMAIN=${DOMAIN}
EOF

log "Arquivo .env criado"

# ==================== 7. SUBIR CONTAINERS ====================
echo ""
info "Passo 7: Iniciando containers..."

# Parar containers antigos se existirem
docker compose down 2>/dev/null || true

# Construir e iniciar (sudo porque grupo docker só será aplicado no próximo login)
sudo docker compose up -d --build

log "Containers iniciados! Aguardando serviços ficarem saudáveis..."

# ==================== 8. AGUARDAR E VERIFICAR ====================
echo ""
info "Passo 8: Verificando serviços..."

sleep 10

# Verificar se os containers estão rodando
if sudo docker ps | grep -q "lotofacil-web"; then
    log "✅ Web App rodando em: http://localhost:3000"
else
    warn "❌ Web App pode não ter iniciado. Verifique: docker compose logs web"
fi

if sudo docker ps | grep -q "lotofacil-ai-engine"; then
    log "✅ AI Engine rodando em: http://localhost:8000"
    log "   Docs: http://localhost:8000/docs"
else
    warn "❌ AI Engine pode não ter iniciado. Verifique: docker compose logs ai-engine"
fi

if sudo docker ps | grep -q "lotofacil-postgres"; then
    log "✅ PostgreSQL rodando"
fi

if sudo docker ps | grep -q "lotofacil-nginx"; then
    IP=$(curl -s ifconfig.me || wget -qO- ifconfig.me || echo "IP_PUBLICO")
    log "✅ Nginx rodando"
    log "   🌐 Acesse: http://${IP}"
    if [ -n "$DOMAIN" ]; then
        log "   🌐 Ou: http://${DOMAIN}"
    fi
fi

# ==================== 9. EXECUTAR SEED DO BANCO ====================
echo ""
info "Passo 9: Sincronizando histórico de resultados..."

# Baixar base inicial se cache não existir
sudo docker compose exec -T web sh -c "[ -f /app/database/lotofacil.json ] || \
  curl -sL https://raw.githubusercontent.com/maickon/free-apiloterias/refs/heads/master/database/lotofacil/_todos.json \
  -o /app/database/lotofacil.json" 2>/dev/null || true

# Sincronizar concursos mais recentes
sudo docker compose exec -T web node database/seed.js || \
  warn "Seed falhou. Execute manualmente: docker compose exec web node database/seed.js"

# ==================== 10. RESUMO ====================
echo ""
echo "=============================================="
echo "   🎉 DEPLOY CONCLUÍDO!"
echo "=============================================="
echo ""
echo "📋 RESUMO DOS SERVIÇOS:"
echo ""
echo "   🌐 Web App:       http://localhost:3000"
echo "   🤖 AI Engine:     http://localhost:8000"
echo "   📚 AI Docs:       http://localhost:8000/docs"
echo "   🗄️ PostgreSQL:    localhost:5432"
echo "   ⚡ Redis:         localhost:6379"
echo ""
echo "📌 COMANDOS ÚTEIS:"
echo ""
echo "   Ver logs:          docker compose logs -f"
echo "   Ver web:           docker compose logs -f web"
echo "   Ver IA:            docker compose logs -f ai-engine"
echo "   Reiniciar:         docker compose restart"
echo "   Parar:             docker compose down"
echo "   Atualizar:         git pull && docker compose up -d --build"
echo "   Seed manual:       docker compose exec web node database/seed.js"
echo "   Shell web:         docker compose exec web sh"
echo ""
echo "⚠️  NÃO ESQUEÇA DE CONFIGURAR O FIREWALL NO CONSOLE ORACLE!"
echo ""
