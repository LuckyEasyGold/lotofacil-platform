@echo off
title Lotofacil Platform
cls
echo ============================================
echo    LOTOFACIL PLATFORM - Inicializacao
echo ============================================
echo.
echo [1/3] Verificando Node.js...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERRO: Node.js nao encontrado. Instale Node.js 18+.
    pause
    exit /b 1
)
echo Node.js encontrado!
echo.
echo [2/3] Instalando dependencias...
cd web
call npm install --silent
echo.
echo [3/3] Iniciando servidor...
echo.
start "" http://localhost:3000
echo.
echo  Acesse: http://localhost:3000
echo  Para sair: pressione Ctrl+C
echo ============================================
echo.
node server.js
pause
