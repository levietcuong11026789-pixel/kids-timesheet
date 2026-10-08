@echo off
chcp 65001 >nul
echo ===================================================
echo     DEPLOY BANG CHAM CONG BE YEU (GITHUB)
echo ===================================================
echo.
cd /d "g:\My Drive\Build App\kids-timesheet"

echo [1] Dang day toan bo thay doi len GitHub...
git add .
git commit -m "Cap nhat ung dung phien ban moi"
git push origin main
echo.
echo ===================================================
echo  DA DAY LEN GITHUB THANH CONG!
echo  Cac thiet bi (dien thoai, laptop) se tu dong nhan
echo  ban cap nhat moi ngay khi mo ung dung.
echo ===================================================
echo.
pause

