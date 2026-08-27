@echo off
setlocal

cd /d "%~dp0"

echo LICITA AI - iniciando frontend e backend...
echo.
echo O sistema sera aberto automaticamente quando estiver pronto:
echo Frontend: http://127.0.0.1:5173
echo Backend:  http://127.0.0.1:3333
echo.
echo Mantenha esta janela aberta enquanto estiver usando o sistema.
echo Para encerrar, pressione Ctrl+C.
echo.

npm.cmd run dev

pause
