@echo off
echo =========================================
echo    DEPLOY BANG CHAM CONG BE YEU
echo =========================================
echo.
cd /d "g:\My Drive\Build App\kids-timesheet"
echo [1] Dang kiem tra dang nhap Firebase...
firebase login
echo.
echo [2] Dang deploy len Firebase Hosting...
firebase deploy --only hosting
echo.
echo =========================================
echo DONE! Mo link: https://cham-cong-be-yeu.web.app
echo =========================================
pause
