# 🚀 Deploy da Lotofácil Platform na Oracle Cloud

Guia completo para colocar sua plataforma no ar 24/7 usando o **Oracle Cloud Always Free Tier**.

---

## 📋 Pré-requisitos

- ✅ Conta na **[Oracle Cloud](https://signup.cloud.oracle.com)** (nível Always Free)
- ✅ Cartão de crédito para verificação (não será cobrado)
- ✅ Domínio (opcional - pode usar IP direto)

---

## 🎯 Passo 1: Criar a VM no Oracle Cloud

1. **Acesse o console**: https://cloud.oracle.com
2. **Menu** → `Compute` → `Instances` → `Create instance`
3. **Configurações**:

   | Campo | Valor |
   |---|---|
   | **Name** | `lotofacil-platform` |
   | **Image** | Ubuntu 22.04 (ou superior) |
   | **Shape** | `VM.Standard.A1.Flex` (Ampere ARM) |
   | **OCPUs** | 4 (máximo grátis) |
   | **Memory** | 24 GB (máximo grátis) |
   | **SSH Key** | Adicione sua chave pública SSH |

4. **Rede**: Marque "Assign a public IPv4 address"
5. **Clique em "Create"** e aguarde (1-2 minutos)

---

## 🔑 Passo 2: Conectar via SSH

```bash
# Ajuste o caminho da sua chave privada
ssh -i ~/.ssh/id_rsa ubuntu@<IP_PUBLICO_DA_VM>
```

> 💡 **Dica**: Se você não tem chave SSH, crie com `ssh-keygen -t rsa -b 4096` no seu terminal local.

---

## 🛠️ Passo 3: Configurar Firewall no Console OCI

**Essa parte é OBRIGATÓRIA** — a Oracle tem 2 camadas de firewall:

1. **Console OCI** → `Networking` → `Virtual Cloud Networks`
2. Clique na VCN da sua VM
3. `Security Lists` → `Default Security List` → `Add Ingress Rules`

Adicione **3 regras**:

| Source Type | Source CIDR | Protocol | Port |
|---|---|---|---|
| CIDR | `0.0.0.0/0` | TCP | `80` (HTTP) |
| CIDR | `0.0.0.0/0` | TCP | `443` (HTTPS) |
| CIDR | `0.0.0.0/0` | TCP | `3000` (Web direto - opcional) |

---

## 🚀 Passo 4: Rodar o Setup Automático

Dentro da VM, execute:

```bash
# Baixar o projeto (ou clonar seu repositório)
git clone https://github.com/LuckyEasyGold/lotofacil-platform
cd lotofacil-platform

# Executar o setup
chmod +x deploy/setup.sh
./deploy/setup.sh
```

O script vai:
1. ✅ Atualizar o sistema
2. ✅ Instalar Docker + Docker Compose
3. ✅ Configurar firewall (iptables)
4. ✅ Clonar o repositório
5. ✅ Criar variáveis de ambiente
6. ✅ Construir e subir todos os containers
7. ✅ Rodar o seed do banco de dados
8. ✅ Mostrar resumo com URLs de acesso

---

## 🌐 Passo 5: Acessar a Plataforma

Após o setup, acesse:

```
http://<IP_PUBLICO_DA_VM>
```

Exemplo:
```
http://129.146.xxx.xxx
```

Para descobrir seu IP público:
```bash
curl -s ifconfig.me
```

---

## 📌 Comandos Úteis

### Verificar tudo funcionando

```bash
# Status dos containers
docker compose ps

# Logs em tempo real
docker compose logs -f

# Logs só da web
docker compose logs -f web

# Logs da IA
docker compose logs -f ai-engine
```

### Atualizar código

```bash
git pull
sudo docker compose up -d --build
```

> 💡 **Dica**: Na primeira execução o script `setup.sh` usa `sudo` para todos os comandos Docker. Depois que você sair e logar de novo, o grupo docker estará ativo e poderá usar `docker compose` sem `sudo`.

### Parar tudo

```bash
sudo docker compose down
```

### Acessar terminal do container web

```bash
sudo docker compose exec web sh
```

### Sincronizar histórico de resultados

```bash
sudo docker compose exec web node database/seed.js
```

### Ativar loop evolutivo 24/7 da IA

Edite o `docker-compose.yml` e descomente a linha:
```yaml
# command: sh -c "uvicorn app.main:app --host ..."
```

Depois:
```bash
sudo docker compose up -d --build ai-engine
```

---

## 🔒 (Opcional) Configurar HTTPS com Certbot

Se você tem um domínio:

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Gerar certificado
sudo certbot --nginx -d loteria.seusite.com

# Editar deploy/nginx.conf e descomentar o bloco HTTPS
# Depois reiniciar
docker compose restart nginx
```

---

## 💰 Sobre o Oracle Always Free

| Recurso | Grátis | Sua VM |
|---|---|---|
| **VM Ampere A1** | 4 OCPUs + 24GB RAM | ✅ |
| **Armazenamento** | 200GB | ✅ |
| **Transferência** | 10TB/mês | ✅ |
| **Disponibilidade** | 24/7 sem dormir | ✅ |

**⚠️ Aviso**: A Oracle pode desligar VMs consideradas "ociosas". Para evitar:
- Mantenha a IA rodando (ela usa CPU)
- Configure um cron job para acessar a plataforma periodicamente:
  ```bash
  # No crontab: */30 * * * * curl -s http://localhost:3000/ > /dev/null
  ```

---

## 🐳 Arquitetura dos Containers

```
┌──────────────────────────────────────────────────────────┐
│                    NGINX (porta 80/443)                    │
│                    Reverse Proxy                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │  WEB APP  │    │  AI ENGINE   │    │  PostgreSQL   │  │
│  │  Node.js  │    │  FastAPI     │    │  (resultados  │  │
│  │  :3000    │    │  :8000       │    │   + seeds)   │  │
│  │           │    │  Genético    │    │               │  │
│  │  Cache:   │    │  Evolução    │    │  4 tabelas   │  │
│  │  3739     │    │  24/7        │    │               │  │
│  │  jogos    │    │              │    │               │  │
│  └──────────┘    └──────────────┘    └───────────────┘  │
│                                                          │
│                    ┌─────────────┐                       │
│                    │    Redis    │                       │
│                    │   (cache)   │                       │
│                    └─────────────┘                       │
└──────────────────────────────────────────────────────────┘
```

---

## ❓ Troubleshooting

### "Porta 80 já está em uso"
```bash
sudo lsof -i :80
sudo systemctl stop apache2  # se for o Apache
```

### "Container reinicia toda hora"
```bash
docker compose logs web
docker compose logs ai-engine
```

### "AI Engine não conecta"
```bash
docker compose exec ai-engine python -c "from app.db.database import engine; engine.connect()"
```

### "Precisa de mais resultados no cache"
```bash
docker compose exec web node database/seed.js
```

---

Feito com 🎲 por LuckyEasyGold
