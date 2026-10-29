@echo off
cd /d "%~dp0"

echo ===============================================
echo   Grand Cru Copacabana - modo de teste local
echo ===============================================
echo.
echo Isso abre uma copia do site so no seu computador,
echo com dados de teste. Nao mexe no site publicado
echo nem no banco de dados do Replit.
echo O que voce mudar no admin fica salvo neste computador,
echo mesmo depois de fechar o site.
echo.

rem Confere programas de verdade, nao so a pasta: uma pasta node_modules
rem vazia (de uma instalacao que falhou) fazia o site quebrar ao iniciar.
rem O banco local (PGlite) entrou depois: quem ja tinha instalado antes
rem tambem precisa instalar de novo.
set PRECISA_INSTALAR=
if not exist node_modules\express\package.json set PRECISA_INSTALAR=1
if not exist node_modules\@electric-sql\pglite\package.json set PRECISA_INSTALAR=1
if defined PRECISA_INSTALAR (
    echo Instalando os programas necessarios...
    echo Isso pode demorar um minuto e so acontece uma vez.
    call npm install
    echo.
)

set PRECISA_INSTALAR=
if not exist node_modules\express\package.json set PRECISA_INSTALAR=1
if not exist node_modules\@electric-sql\pglite\package.json set PRECISA_INSTALAR=1
if defined PRECISA_INSTALAR (
    echo ERRO: nao foi possivel instalar os programas necessarios.
    echo Verifique sua conexao com a internet e rode este arquivo de novo.
    echo.
    pause
    exit /b 1
)

set USE_FAKE_DB=true
set DATABASE_URL=postgres://local:local@localhost:5432/local
set ADMIN_USERNAME=admin
set ADMIN_PASSWORD=admin123
set SESSION_SECRET=chave-local-de-teste
set PORT=5050

echo Iniciando o site numa janela separada...
start "Grand Cru Copacabana - servidor local (feche esta janela para PARAR o site)" cmd /k "node --watch server.js"

rem Espera o site responder antes de abrir o navegador: preparar o banco
rem pode levar alguns segundos (mais na primeira vez).
echo Aguardando o site ficar pronto...
set /a TENTATIVAS=0
:esperar
timeout /t 1 /nobreak >nul
curl -s -o nul http://localhost:5050/api/site && goto pronto
set /a TENTATIVAS+=1
if %TENTATIVAS% lss 60 goto esperar
echo.
echo O site demorou demais para abrir. Veja a mensagem na OUTRA janela
echo (a do servidor) e mande para quem cuida do site.
echo.
pause
exit /b 1
:pronto
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
