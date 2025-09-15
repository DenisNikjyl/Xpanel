#!/bin/bash

# Xpanel Simple Server для Ubuntu
# БЕЗ СБОРОК И REACT - ТОЛЬКО HTML/CSS/JS

echo "========================================"
echo "       Xpanel Simple Server"
echo "  БЕЗ СБОРОК И REACT - ТОЛЬКО HTML/CSS/JS"
echo "========================================"
echo

cd "$(dirname "$0")"

echo "[1/2] Проверка Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не найден!"
    echo "Установите Node.js:"
    echo "curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
    echo "sudo apt-get install -y nodejs"
    exit 1
fi

echo "✅ Node.js найден: $(node --version)"
echo

echo "[2/2] Запуск простого сервера..."
cd server
node simple-server.js
