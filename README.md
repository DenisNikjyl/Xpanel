# Xpanel - Панель управления VPS серверами

Современная веб-панель для управления VPS серверами на базе Linux с красивым интерфейсом и мощным функционалом.

## 🚀 Возможности

- **Мониторинг в реальном времени** - CPU, RAM, диск, сеть
- **Управление до 20 серверов** одновременно
- **Встроенный терминал** с историей команд
- **Файловый менеджер** для работы с файлами
- **Система аутентификации** с JWT токенами
- **WebSocket** для обновлений в реальном времени
- **Адаптивный дизайн** для всех устройств
- **Без React** - чистый HTML, CSS, JavaScript

## 📋 Требования

- Python 3.8+
- Linux сервер для развертывания
- SSH доступ к управляемым серверам

## 🛠️ Установка

### 1. Клонирование и настройка

```bash
# Перейти в директорию проекта
cd Xpanels

# Создать виртуальное окружение
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# или
venv\Scripts\activate     # Windows

# Установить зависимости
pip install -r requirements.txt
```

### 2. Настройка окружения

```bash
# Скопировать файл конфигурации
cp .env.example .env

# Отредактировать .env файл
nano .env
```

Обязательно измените следующие параметры:
- `SECRET_KEY` - секретный ключ Flask
- `JWT_SECRET_KEY` - ключ для JWT токенов

### 3. Запуск приложения

```bash
# Запуск в режиме разработки
python app.py

# Или через Flask CLI
export FLASK_APP=app.py
flask run --host=0.0.0.0 --port=5000
```

### 4. Доступ к панели

Откройте браузер и перейдите по адресу:
```
http://your-server-ip:5000
```

**Данные для входа по умолчанию:**
- Логин: `admin`
- Пароль: `admin123`

⚠️ **Обязательно смените пароль после первого входа!**

## 🔧 Настройка для продакшена

### 1. Использование Gunicorn

```bash
# Установить Gunicorn
pip install gunicorn

# Запуск с Gunicorn
gunicorn --worker-class eventlet -w 1 --bind 0.0.0.0:5000 app:app
```

### 2. Настройка Nginx (опционально)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Systemd сервис

Создайте файл `/etc/systemd/system/xpanel.service`:

```ini
[Unit]
Description=Xpanel VPS Management Panel
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/xpanels
Environment=PATH=/path/to/xpanels/venv/bin
ExecStart=/path/to/xpanels/venv/bin/gunicorn --worker-class eventlet -w 1 --bind 127.0.0.1:5000 app:app
Restart=always

[Install]
WantedBy=multi-user.target
```

Запуск сервиса:
```bash
sudo systemctl daemon-reload
sudo systemctl enable xpanel
sudo systemctl start xpanel
```

## 📱 Использование

### Добавление сервера

1. Войдите в панель
2. Перейдите в раздел "Серверы"
3. Нажмите "Добавить сервер"
4. Заполните данные:
   - Название сервера
   - IP адрес или домен
   - SSH порт (обычно 22)
   - Имя пользователя
   - Пароль или SSH ключ

### Работа с терминалом

1. Перейдите в раздел "Терминал"
2. Выберите сервер из списка
3. Используйте команды как в обычном SSH терминале
4. Доступны горячие клавиши:
   - `↑/↓` - навигация по истории
   - `Ctrl+L` - очистка терминала
   - `clear` - очистка терминала

### Файловый менеджер

1. Перейдите в раздел "Файлы"
2. Выберите сервер
3. Навигация по папкам кликом
4. Просмотр информации о файлах

## 🔒 Безопасность

- Все соединения используют HTTPS в продакшене
- JWT токены для аутентификации
- Хеширование паролей с bcrypt
- Валидация всех входных данных
- Логирование всех действий

## 🎨 Кастомизация

### Изменение темы

Отредактируйте CSS переменные в `static/css/style.css`:

```css
:root {
    --primary-color: #2563eb;
    --background-color: #0f172a;
    --surface-color: #1e293b;
    /* ... другие переменные */
}
```

### Добавление новых функций

1. Backend API - добавьте роуты в `app.py`
2. Frontend - создайте новые JavaScript модули
3. UI - добавьте HTML шаблоны и стили

## 🐛 Отладка

### Логи

```bash
# Просмотр логов приложения
tail -f xpanel.log

# Логи systemd сервиса
journalctl -u xpanel -f
```

### Частые проблемы

1. **Ошибка подключения к серверу**
   - Проверьте SSH доступ
   - Убедитесь в правильности данных
   - Проверьте firewall

2. **WebSocket не работает**
   - Проверьте настройки прокси
   - Убедитесь что порт открыт

3. **Высокая нагрузка**
   - Увеличьте количество воркеров Gunicorn
   - Настройте кеширование

## 📄 API Документация

### Аутентификация

```bash
# Вход в систему
POST /api/login
{
    "username": "admin",
    "password": "admin123"
}
```

### Управление серверами

```bash
# Получить список серверов
GET /api/servers
Authorization: Bearer <token>

# Добавить сервер
POST /api/servers
Authorization: Bearer <token>
{
    "name": "My Server",
    "host": "192.168.1.100",
    "port": 22,
    "username": "root",
    "password": "password"
}

# Выполнить команду
POST /api/servers/{id}/execute
Authorization: Bearer <token>
{
    "command": "ls -la"
}
```

## 🤝 Вклад в проект

1. Форкните репозиторий
2. Создайте ветку для новой функции
3. Внесите изменения
4. Создайте Pull Request

## 📞 Поддержка

- GitHub Issues для багов и предложений
- Документация: [Wiki](https://github.com/your-repo/xpanel/wiki)

## 📜 Лицензия

MIT License - см. файл LICENSE

## 🎯 Roadmap

- [ ] Поддержка SSH ключей
- [ ] Групповые операции
- [ ] Уведомления в Telegram
- [ ] Система бэкапов
- [ ] API для интеграций
- [ ] Мобильное приложение

---

**Xpanel** - бесплатная панель управления VPS серверами ❤️
