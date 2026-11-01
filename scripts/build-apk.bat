@echo off
setlocal
echo [1/4] Building web application with Vite...
cd /d "%~dp0\.."
call npm.cmd run build
if %ERRORLEVEL% neq 0 (
    echo Error: Vite build failed!
    exit /b %ERRORLEVEL%
)

echo [2/4] Syncing assets to Android Capacitor project...
call npx.cmd cap copy android
if %ERRORLEVEL% neq 0 (
    echo Error: Capacitor copy failed!
    exit /b %ERRORLEVEL%
)

echo [3/4] Compiling Android APK with Gradle...
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot"
set "PATH=%JAVA_HOME%\bin;%PATH%"
cd /d "%~dp0\..\android"
call gradlew.bat assembleDebug
if %ERRORLEVEL% neq 0 (
    echo Error: Gradle build failed!
    exit /b %ERRORLEVEL%
)

echo [4/4] Copying fresh APK to root directory...
cd /d "%~dp0\.."
copy /y android\app\build\outputs\apk\debug\app-debug.apk TPS_Hostel_ERP_v1.9.26.apk
copy /y android\app\build\outputs\apk\debug\app-debug.apk TPS_Hostel_ERP_latest.apk

echo ========================================================
echo APK successfully built and synced!
echo Location: %cd%\TPS_Hostel_ERP_v1.9.26.apk
echo ========================================================
endlocal
