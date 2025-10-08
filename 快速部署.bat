@echo off
chcp 65001 >nul
echo 正在部署修复...
git add .
git commit -m "修复: 移除LeanCloud自检和实时订阅，全部改为轮询"
git push origin main
echo 部署完成！
pause
