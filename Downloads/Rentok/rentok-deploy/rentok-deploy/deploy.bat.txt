@echo off
title RentAI Auto Deploy
color 0A
echo.
echo  ========================================
echo   RentAI - Auto Git Deploy
echo  ========================================
echo.
cd /d "C:\Users\Hitesh M\Downloads\Rentok\rentok-deploy\rentok-deploy"
git add .
set /p MSG="  Commit message (press Enter for auto): "
if "%MSG%"=="" set MSG=Update %date% %time%
git commit -m "%MSG%"
git push origin main
echo.
echo   Done! Pushed to GitHub.
echo  ========================================
pause