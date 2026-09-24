@echo off
rem MutantcatOffice CLI launcher for the packaged Windows app: <install>\resources\cli\mutantcatoffice.cmd
setlocal
set ELECTRON_RUN_AS_NODE=1
"%~dp0..\..\MutantcatOffice.exe" "%~dp0mutantcatoffice.cjs" %*
endlocal
