@echo off
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot"
set "PATH=%JAVA_HOME%\bin;%PATH%"
cd /d "%~dp0\..\android"
call gradlew.bat assembleDebug
