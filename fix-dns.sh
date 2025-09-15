#!/bin/bash

# Скрипт для настройки альтернативных DNS серверов
# Решает проблемы с npm timeout и медленным интернетом

echo "🔧 Настройка альтернативных DNS серверов..."

# Создаем резервную копию текущих настроек
cp /etc/resolv.conf /etc/resolv.conf.backup
echo "✅ Создана резервная копия /etc/resolv.conf"

# Настраиваем быстрые DNS серверы
cat > /etc/resolv.conf << EOF
# Cloudflare DNS (быстрые и надежные)
nameserver 1.1.1.1
nameserver 1.0.0.1

# Google DNS (резервные)
nameserver 8.8.8.8
nameserver 8.8.4.4

# Quad9 DNS (дополнительные)
nameserver 9.9.9.9
nameserver 149.112.112.112
EOF

echo "✅ Настроены новые DNS серверы:"
echo "   - Cloudflare: 1.1.1.1, 1.0.0.1"
echo "   - Google: 8.8.8.8, 8.8.4.4"
echo "   - Quad9: 9.9.9.9, 149.112.112.112"

# Делаем файл неизменяемым (защита от перезаписи)
chattr +i /etc/resolv.conf
echo "✅ Файл /etc/resolv.conf защищен от изменений"

# Очищаем DNS кэш
if command -v systemd-resolve &> /dev/null; then
    systemd-resolve --flush-caches
    echo "✅ Очищен DNS кэш (systemd-resolve)"
elif command -v resolvectl &> /dev/null; then
    resolvectl flush-caches
    echo "✅ Очищен DNS кэш (resolvectl)"
fi

# Тестируем новые DNS
echo "🧪 Тестирование DNS..."
if nslookup registry.npmjs.org > /dev/null 2>&1; then
    echo "✅ DNS работает корректно"
else
    echo "❌ Проблемы с DNS, восстанавливаем резервную копию"
    chattr -i /etc/resolv.conf
    cp /etc/resolv.conf.backup /etc/resolv.conf
    exit 1
fi

# Настраиваем npm для работы с новыми DNS
echo "🔧 Настройка npm..."

# Увеличиваем timeout для npm
npm config set timeout 120000
npm config set registry https://registry.npmjs.org/
npm config set prefer-online false

# Отключаем IPv6 для npm (часто вызывает проблемы)
npm config set prefer-ipv4 true

# Настраиваем кэширование
npm config set cache-max 86400000
npm config set cache-min 10

echo "✅ npm настроен для работы с новыми DNS"

# Тестируем npm
echo "🧪 Тестирование npm..."
if npm ping > /dev/null 2>&1; then
    echo "✅ npm успешно подключается к registry"
else
    echo "⚠️  npm ping не удался, но это не критично"
fi

# Дополнительные настройки для улучшения сети
echo "🔧 Дополнительные сетевые настройки..."

# Увеличиваем буферы сети
echo 'net.core.rmem_default = 262144' >> /etc/sysctl.conf
echo 'net.core.rmem_max = 16777216' >> /etc/sysctl.conf
echo 'net.core.wmem_default = 262144' >> /etc/sysctl.conf
echo 'net.core.wmem_max = 16777216' >> /etc/sysctl.conf

# Применяем настройки
sysctl -p > /dev/null 2>&1

echo "✅ Сетевые буферы увеличены"

# Создаем скрипт для восстановления DNS
cat > /root/restore-dns.sh << 'EOF'
#!/bin/bash
echo "Восстановление оригинальных DNS настроек..."
chattr -i /etc/resolv.conf
cp /etc/resolv.conf.backup /etc/resolv.conf
echo "DNS настройки восстановлены"
EOF

chmod +x /root/restore-dns.sh
echo "✅ Создан скрипт восстановления: /root/restore-dns.sh"

echo ""
echo "🎉 DNS настройка завершена!"
echo ""
echo "📋 Что было сделано:"
echo "   ✓ Установлены быстрые DNS серверы"
echo "   ✓ Настроен npm с увеличенными timeout"
echo "   ✓ Отключен IPv6 для npm"
echo "   ✓ Увеличены сетевые буферы"
echo "   ✓ Создан скрипт восстановления"
echo ""
echo "🚀 Теперь можно повторить установку npm пакетов:"
echo "   cd /root/a && npm install"
echo ""
echo "🔄 Если нужно восстановить старые настройки:"
echo "   bash /root/restore-dns.sh"
