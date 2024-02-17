@echo off
setlocal
if not defined PLAYWRIGHT_NODEJS_PATH set PLAYWRIGHT_NODEJS_PATH=%~dp0node.exe
"%PLAYWRIGHT_NODEJS_PATH%" "%~dp0package\cli.js" %*