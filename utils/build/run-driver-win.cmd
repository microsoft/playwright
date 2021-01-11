@ECHO OFF
SETLOCAL
SET _PW_PACKAGE_ROOT="%~dp0\package"
"%~dp0\node.exe" "%~dp0\package\lib\cli\cli.js" %*
