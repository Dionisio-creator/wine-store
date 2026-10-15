@echo off
cd /d "%~dp0"

echo ===============================================
echo   Grand Cru Copacabana - modo de teste local
echo ===============================================
echo.
echo Isso abre uma copia do site so no seu computador,
echo com dados de teste. Nao mexe no site publicado
echo nem no banco de dados do Replit.
echo.

if not exist node_modules (
    echo Primeira vez rodando aqui - instalando os programas necessarios...
    echo (isso pode demorar um minuto, so acontece essa vez)
    call npm install
    echo.
)

set USE_FAKE_DB=true
set DATABASE_URL=postgres://local:local@localhost:5432/local
set ADMIN_USERNAME=admin
set ADMIN_PASSWORD=admin123
set SESSION_SECRET=chave-local-de-teste
set PORT=5050

echo Iniciando o site numa janela separada...
start "Grand Cru Copacabana - servidor local (feche esta janela para PARAR o site)" cmd /k "node --watch server.js"

timeout /t 2 /nobreak >nul
start "" http://localhost:5050

echo.
echo Pronto! O site deve ter aberto no seu navegador.
echo Area administrativa: usuario "admin", senha "admin123"
echo.
echo O site continua rodando na OUTRA janela que abriu.
echo Para PARAR o site, feche aquela janela.
echo Essa aqui voce ja pode fechar.
echo.
pause
