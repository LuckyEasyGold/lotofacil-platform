# Script de Inicialização do Projeto Loteria IA
# Executar no PowerShell: .\inicial.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  LOTERIA IA - Configuração Inicial" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se o Node.js está instalado
Write-Host "[1/4] Verificando Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js encontrado: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js não encontrado!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Por favor, instale o Node.js em: https://nodejs.org/" -ForegroundColor Yellow
    Write-Host "Recomendamos a versão LTS (18.x ou superior)" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Pressione Enter para sair"
    exit 1
}

# Verificar se o npm está instalado
Write-Host ""
Write-Host "[2/4] Verificando npm..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version
    Write-Host "✓ npm encontrado: v$npmVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ npm não encontrado!" -ForegroundColor Red
    Write-Host "O npm deve ser instalado junto com o Node.js." -ForegroundColor Yellow
    Read-Host "Pressione Enter para sair"
    exit 1
}

# Instalar dependências
Write-Host ""
Write-Host "[3/4] Instalando dependências do projeto..." -ForegroundColor Yellow
Write-Host "Isso pode levar alguns minutos..." -ForegroundColor Gray
Write-Host ""

if (Test-Path "package.json") {
    npm install --legacy-peer-deps
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Dependências instaladas com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "✗ Erro ao instalar dependências" -ForegroundColor Red
        Write-Host ""
        Write-Host "Tente executar manualmente: npm install" -ForegroundColor Yellow
        Read-Host "Pressione Enter para sair"
        exit 1
    }
} else {
    Write-Host "✗ arquivo package.json não encontrado!" -ForegroundColor Red
    Write-Host "Certifique-se de estar na raiz do projeto." -ForegroundColor Yellow
    Read-Host "Pressione Enter para sair"
    exit 1
}

# Verificar estrutura de diretórios
Write-Host ""
Write-Host "[4/4] Verificando estrutura do projeto..." -ForegroundColor Yellow

$requiredFolders = @("src", "src/components", "src/screens", "src/navigation", "src/context", "src/services", "src/types")
$allFoldersExist = $true

foreach ($folder in $requiredFolders) {
    if (Test-Path $folder -PathType Container) {
        Write-Host "✓ $folder" -ForegroundColor Green
    } else {
        Write-Host "✗ $folder (não encontrado)" -ForegroundColor Red
        $allFoldersExist = $false
    }
}

if (-not $allFoldersExist) {
    Write-Host ""
    Write-Host "⚠ Alguns diretórios não foram encontrados." -ForegroundColor Yellow
    Write-Host "O projeto pode não estar completo." -ForegroundColor Yellow
}

# Verificar arquivos principais
Write-Host ""
Write-Host "Verificando arquivos principais..." -ForegroundColor Yellow

$requiredFiles = @("App.tsx", "package.json", "tsconfig.json", "README.md")
$allFilesExist = $true

foreach ($file in $requiredFiles) {
    if (Test-Path $file -PathType Leaf) {
        Write-Host "✓ $file" -ForegroundColor Green
    } else {
        Write-Host "✗ $file (não encontrado)" -ForegroundColor Red
        $allFilesExist = $false
    }
}

# Limpar cache do npm (opcional, mas recomendado)
Write-Host ""
Write-Host "Limpando cache do npm..." -ForegroundColor Gray
npm cache clean --force | Out-Null
Write-Host "✓ Cache limpo" -ForegroundColor Green

# Resumo final
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CONFIGURAÇÃO CONCLUÍDA!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($allFoldersExist -and $allFilesExist) {
    Write-Host "✓ Tudo pronto para desenvolver!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Próximos passos:" -ForegroundColor Cyan
    Write-Host "  1. Execute: npm start" -ForegroundColor White
    Write-Host "  2. Escaneie o QR code com Expo Go no seu celular" -ForegroundColor White
    Write-Host "  3. Ou pressione 'w' para testar no navegador" -ForegroundColor White
    Write-Host ""
    Write-Host "Comandos úteis:" -ForegroundColor Cyan
    Write-Host "  npm start       - Inicia o servidor de desenvolvimento" -ForegroundColor Gray
    Write-Host "  npm run web     - Roda no navegador" -ForegroundColor Gray
    Write-Host "  npm run android - Roda no emulador Android" -ForegroundColor Gray
    Write-Host "  npm run ios     - Roda no simulador iOS (macOS apenas)" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "⚠ Configuração concluída com avisos." -ForegroundColor Yellow
    Write-Host "Verifique os itens marcados acima." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Dúvidas? Consulte o README.md" -ForegroundColor Gray
Write-Host ""
Write-Host "Pressione Enter para continuar..." -ForegroundColor Gray
Read-Host
