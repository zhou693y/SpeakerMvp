@echo off
chcp 65001 >nul
title 演讲评分系统 - 启动工具
color 0A

echo.
echo ========================================
echo    演讲评分系统 - 一键启动工具
echo ========================================
echo.
echo [1/3] 正在启动本地服务器...
echo.

cd /d "%~dp0"

echo 服务器地址: http://localhost:8080
echo 项目目录: %CD%
echo.
echo ========================================
echo    重要提示
echo ========================================
echo.
echo 1. 请在LeanCloud控制台添加以下域名:
echo    http://localhost:8080
echo    http://127.0.0.1:8080
echo.
echo 2. 配置路径:
echo    设置 -^> 安全中心 -^> Web安全域名
echo.
echo 3. 等待2-3分钟让配置生效
echo.
echo ========================================
echo.
echo [2/3] 正在打开浏览器...
echo.

timeout /t 3 /nobreak >nul
start http://localhost:8080/index.html

echo [3/3] 服务器运行中...
echo.
echo 按 Ctrl+C 停止服务器
echo.
echo ========================================
echo.

python -m http.server 8080

pause
