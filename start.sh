#!/bin/bash
echo "============================================"
echo "   LOTOFACIL PLATFORM - Inicializacao"
echo "============================================"
echo ""

echo "[1/3] Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo "ERRO: Node.js nao encontrado."
    exit 1
fi
echo "Node.js $(node -v) encontrado!"
echo ""

echo "[2/3] Instalando dependencias..."
cd web && npm install --silent
echo ""

echo "[3/3] Iniciando servidor..."
echo ""
echo "  Acesse: http://localhost:3000"
echo "  Para sair: Ctrl+C"
echo "============================================"
echo ""

# Open browser
case "$(uname -s)" in
    Darwin) open http://localhost:3000 ;;
    Linux) xdg-open http://localhost:3000 2>/dev/null || true ;;
esac

node server.js
