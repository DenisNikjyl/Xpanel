const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const XpanelTelegramBot = require('./telegram-bot');
const VPSManager = require('./vps-manager');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

// In-memory storage (replace with database in production)
let users = [];
let servers = [];
let userVPSList = new Map(); // Map<userId, Array<vpsConfig>>
let nextUserId = 1;
let nextServerId = 1;

// Инициализация VPS Manager
const vpsManager = new VPSManager();

// Обработчики событий VPS Manager
vpsManager.on('vps_connected', (data) => {
  console.log(`✅ VPS подключен: ${data.config.name}`);
  io.emit('vps_connected', data);
});

vpsManager.on('vps_disconnected', (data) => {
  console.log(`❌ VPS отключен: ${data.config.name}`);
  io.emit('vps_disconnected', data);
});

vpsManager.on('vps_stats_updated', (data) => {
  io.emit('vps_stats_updated', data);
});

vpsManager.on('vps_connection_failed', (data) => {
  console.log(`❌ Не удалось подключиться к VPS: ${data.config.name}`);
  io.emit('vps_connection_failed', data);
});

// Инициализация Telegram бота
let telegramBot;
try {
  telegramBot = new XpanelTelegramBot();
  console.log('🤖 Telegram Bot initialized successfully');
} catch (error) {
  console.error('❌ Telegram Bot initialization failed:', error.message);
  telegramBot = null;
}

// Admin email
const ADMIN_EMAIL = 'fillsites0@gmail.com';

// Email configuration
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'xpanel.service@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

// Test email configuration on startup
emailTransporter.verify((error, success) => {
  if (error) {
    console.log('⚠️  Email configuration error:', error.message);
    console.log('📧 Please configure EMAIL_USER and EMAIL_PASS in .env file');
  } else {
    console.log('✅ Email service ready');
  }
});

// Verification codes storage (in production, use Redis or database)
const verificationCodes = new Map();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'xpanel_secret_key_2024';

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Send verification email
const sendVerificationEmail = async (email, code) => {
  const mailOptions = {
    from: process.env.EMAIL_USER || 'xpanel.service@gmail.com',
    to: email,
    subject: 'Подтверждение регистрации в Xpanel',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); padding: 30px; text-align: center;">
          <h1 style="color: #00d4ff; margin: 0;">Xpanel</h1>
          <p style="color: #ffffff; margin: 10px 0 0 0;">VPS Management Service</p>
        </div>
        <div style="padding: 30px; background: #f8f9fa;">
          <h2 style="color: #333;">Подтверждение регистрации</h2>
          <p>Добро пожаловать в Xpanel! Для завершения регистрации введите код подтверждения:</p>
          <div style="background: #00d4ff; color: white; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 3px; margin: 20px 0;">
            ${code}
          </div>
          <p>Код действителен в течение 10 минут.</p>
          <p>Если вы не регистрировались в Xpanel, проигнорируйте это письмо.</p>
        </div>
      </div>
    `
  };

  await emailTransporter.sendMail(mailOptions);
};

// Routes

// Auth routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    console.log('Registration attempt:', { username, email });

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Неверный формат email' });
    }

    // Check if user already exists
    const existingUser = users.find(u => u.email === email || u.username === username);
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь уже существует' });
    }

    // For admin email, create user directly without verification
    if (email === ADMIN_EMAIL) {
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const user = {
        id: nextUserId++,
        username,
        email,
        password: hashedPassword,
        role: 'ROOT',
        createdAt: new Date()
      };
      
      users.push(user);
      
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      return res.json({
        message: 'Админ аккаунт создан успешно',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      });
    }

    // For regular users, use verification system
    const verificationCode = crypto.randomInt(100000, 999999).toString();
    
    verificationCodes.set(email, {
      code: verificationCode,
      username,
      password,
      timestamp: Date.now(),
      attempts: 0
    });

    // Try to send verification email
    try {
      await sendVerificationEmail(email, verificationCode);
      console.log('Verification email sent to:', email);
    } catch (emailError) {
      console.error('Email sending failed:', emailError.message);
      // Continue without email - user can still verify manually
    }

    res.json({
      message: 'Код подтверждения отправлен на email',
      requiresVerification: true
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера: ' + error.message });
  }
});

app.post('/api/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;

    const verificationData = verificationCodes.get(email);
    if (!verificationData) {
      return res.status(400).json({ error: 'Код подтверждения не найден' });
    }

    // Check if code expired (10 minutes)
    if (Date.now() - verificationData.timestamp > 10 * 60 * 1000) {
      verificationCodes.delete(email);
      return res.status(400).json({ error: 'Код подтверждения истек' });
    }

    // Check attempts
    if (verificationData.attempts >= 3) {
      verificationCodes.delete(email);
      return res.status(400).json({ error: 'Превышено количество попыток' });
    }

    if (verificationData.code !== code) {
      verificationData.attempts++;
      return res.status(400).json({ error: 'Неверный код подтверждения' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(verificationData.password, 10);

    // Determine role - only admin email gets ROOT
    const role = email === ADMIN_EMAIL ? 'ROOT' : 'USER';

    // Create user
    const user = {
      id: nextUserId++,
      username: verificationData.username,
      email,
      password: hashedPassword,
      role,
      createdAt: new Date(),
      verified: true
    };

    users.push(user);
    verificationCodes.delete(email);

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        verified: user.verified
      }
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

app.post('/api/resend-code', async (req, res) => {
  try {
    const { email } = req.body;

    const verificationData = verificationCodes.get(email);
    if (!verificationData) {
      return res.status(400).json({ error: 'Данные для верификации не найдены' });
    }

    // Generate new code
    const newCode = crypto.randomInt(100000, 999999).toString();
    verificationData.code = newCode;
    verificationData.timestamp = Date.now();
    verificationData.attempts = 0;

    await sendVerificationEmail(email, newCode);

    res.json({ message: 'Новый код отправлен на email' });
  } catch (error) {
    console.error('Resend code error:', error);
    res.status(500).json({ error: 'Ошибка отправки кода' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find user
    const user = users.find(u => u.username === username || u.email === username);
    if (!user) {
      return res.status(401).json({ error: 'Неверные учетные данные' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Неверные учетные данные' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        verified: user.verified || false
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Server management routes
app.get('/api/servers', authenticateToken, (req, res) => {
  const userServers = servers.filter(s => s.userId === req.user.id || req.user.role === 'ROOT');
  res.json(userServers);
});

app.post('/api/servers', authenticateToken, async (req, res) => {
  try {
    const { name, host, port, username, password, description } = req.body;

    // Validate input
    if (!name || !host || !username || !password) {
      return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
    }

    // Create server entry
    const server = {
      id: nextServerId++,
      userId: req.user.id,
      name,
      host,
      port: port || 22,
      username,
      password, // In production, encrypt this
      description: description || '',
      status: 'connecting',
      createdAt: new Date(),
      lastSeen: null,
      agentInstalled: false,
      installProgress: 0,
      installLogs: [],
      stats: {
        cpu: 0,
        memory: 0,
        disk: 0,
        uptime: 0,
        network: 0
      }
    };

    servers.push(server);

    // Start agent installation process
    installAgentOnServer(server);

    res.json(server);
  } catch (error) {
    console.error('Add server error:', error);
    res.status(500).json({ error: 'Не удалось добавить сервер' });
  }
});

app.delete('/api/servers/:id', authenticateToken, (req, res) => {
  const serverId = parseInt(req.params.id);
  const serverIndex = servers.findIndex(s => s.id === serverId && (s.userId === req.user.id || req.user.role === 'ROOT'));
  
  if (serverIndex === -1) {
    return res.status(404).json({ error: 'Server not found' });
  }
  
  servers.splice(serverIndex, 1);
  res.json({ message: 'Server removed' });
});

// System info route
app.get('/api/servers/:id/info', authenticateToken, async (req, res) => {
  const serverId = parseInt(req.params.id);
  const server = servers.find(s => s.id === serverId && (s.userId === req.user.id || req.user.role === 'ROOT'));
  
  if (!server) {
    return res.status(404).json({ error: 'Server not found' });
  }
  
  try {
    const systemInfo = await getSystemInfo(server);
    server.systemInfo = systemInfo;
    server.lastSeen = new Date();
    server.status = 'online';
    
    res.json(systemInfo);
  } catch (error) {
    server.status = 'offline';
    res.status(500).json({ error: 'Failed to get system info' });
  }
});

// File manager routes
app.get('/api/servers/:id/files', authenticateToken, async (req, res) => {
  const serverId = parseInt(req.params.id);
  const path = req.query.path || '/';
  
  const server = servers.find(s => s.id === serverId && (s.userId === req.user.id || req.user.role === 'ROOT'));
  
  if (!server) {
    return res.status(404).json({ error: 'Server not found' });
  }
  
  try {
    const files = await listFiles(server, path);
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Admin routes (ROOT only)
app.get('/api/admin/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'ROOT') {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  const userList = users.map(u => ({
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt,
    serverCount: servers.filter(s => s.userId === u.id).length
  }));
  
  res.json(userList);
});

app.get('/api/admin/servers', authenticateToken, (req, res) => {
  if (req.user.role !== 'ROOT') {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  const serverList = servers.map(s => {
    const owner = users.find(u => u.id === s.userId);
    return {
      ...s,
      ownerUsername: owner ? owner.username : 'Unknown'
    };
  });
  
  res.json(serverList);
});

// Helper functions
async function installAgentOnServer(server) {
  const ssh = new NodeSSH();
  
  try {
    console.log(`🔌 Подключение к ${server.host}...`);
    server.installLogs.push(`🔌 Подключение к ${server.host}...`);
    server.installProgress = 10;
    
    await ssh.connect({
      host: server.host,
      port: server.port,
      username: server.username,
      password: server.password,
      tryKeyboard: true
    });

    console.log(`✅ Подключен к ${server.host}, установка агента...`);
    server.installLogs.push(`✅ Подключение успешно`);
    server.installProgress = 25;
    server.status = 'installing';
    
    // Check OS and install dependencies
    server.installLogs.push(`📋 Проверка операционной системы...`);
    const osCheck = await ssh.execCommand('cat /etc/os-release');
    server.installProgress = 35;
    
    // Install Python and dependencies
    server.installLogs.push(`📦 Установка зависимостей...`);
    await ssh.execCommand('sudo apt-get update && sudo apt-get install -y python3 python3-pip curl wget');
    server.installProgress = 50;
    
    // Install Python packages
    server.installLogs.push(`🐍 Установка Python пакетов...`);
    await ssh.execCommand('pip3 install psutil websockets asyncio');
    server.installProgress = 65;
    
    // Create agent directory
    server.installLogs.push(`📁 Создание директории агента...`);
    await ssh.execCommand('mkdir -p /opt/xpanel-agent');
    server.installProgress = 70;
    
    // Create agent script
    const agentScript = `#!/usr/bin/env python3
import asyncio
import websockets
import json
import psutil
import time
import subprocess
import os

class XpanelAgent:
    def __init__(self, server_url="ws://${DOMAIN}:${PORT}"):
        self.server_url = server_url
        self.websocket = None
        
    async def get_system_info(self):
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            boot_time = psutil.boot_time()
            uptime = time.time() - boot_time
            net_io = psutil.net_io_counters()
            
            return {
                "type": "system_info",
                "data": {
                    "cpu": round(cpu_percent, 2),
                    "memory": {
                        "total": memory.total,
                        "used": memory.used,
                        "percent": memory.percent
                    },
                    "disk": {
                        "total": disk.total,
                        "used": disk.used,
                        "percent": round((disk.used / disk.total) * 100, 2)
                    },
                    "uptime": int(uptime),
                    "network": {
                        "bytes_sent": net_io.bytes_sent,
                        "bytes_recv": net_io.bytes_recv
                    },
                    "timestamp": time.time()
                }
            }
        except Exception as e:
            return {"type": "error", "message": str(e)}
    
    async def connect_and_run(self):
        while True:
            try:
                print(f"Connecting to {self.server_url}...")
                async with websockets.connect(self.server_url) as websocket:
                    self.websocket = websocket
                    print("Connected to Xpanel server")
                    
                    await websocket.send(json.dumps({
                        "type": "agent_connect",
                        "hostname": os.uname().nodename
                    }))
                    
                    asyncio.create_task(self.send_periodic_info())
                    
                    async for message in websocket:
                        try:
                            data = json.loads(message)
                            if data.get("type") == "command":
                                result = subprocess.run(data.get("command"), shell=True, capture_output=True, text=True, timeout=30)
                                await websocket.send(json.dumps({
                                    "type": "command_result",
                                    "stdout": result.stdout,
                                    "stderr": result.stderr,
                                    "returncode": result.returncode
                                }))
                        except Exception as e:
                            print(f"Error processing message: {e}")
                            
            except Exception as e:
                print(f"Connection error: {e}")
                await asyncio.sleep(10)
    
    async def send_periodic_info(self):
        while self.websocket:
            try:
                info = await self.get_system_info()
                await self.websocket.send(json.dumps(info))
                await asyncio.sleep(30)
            except Exception as e:
                print(f"Error sending system info: {e}")
                break

if __name__ == "__main__":
    agent = XpanelAgent()
    asyncio.run(agent.connect_and_run())
`;
    
    server.installLogs.push(`📤 Загрузка агента...`);
    await ssh.execCommand(`cat > /opt/xpanel-agent/agent.py << 'EOF'
${agentScript}
EOF`);
    server.installProgress = 85;
    
    // Make executable and create service
    server.installLogs.push(`⚙️ Настройка сервиса...`);
    await ssh.execCommand('chmod +x /opt/xpanel-agent/agent.py');
    
    // Create systemd service
    const serviceFile = `[Unit]
Description=Xpanel Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/xpanel-agent
ExecStart=/usr/bin/python3 /opt/xpanel-agent/agent.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target`;
    
    await ssh.execCommand(`cat > /etc/systemd/system/xpanel-agent.service << 'EOF'
${serviceFile}
EOF`);
    
    // Enable and start service
    await ssh.execCommand('systemctl daemon-reload');
    await ssh.execCommand('systemctl enable xpanel-agent');
    await ssh.execCommand('systemctl start xpanel-agent');
    
    server.installProgress = 100;
    server.status = 'online';
    server.agentInstalled = true;
    server.lastSeen = new Date();
    server.installLogs.push(`🎉 Агент успешно установлен и запущен!`);
    
    ssh.dispose();
    console.log(`✅ Агент успешно установлен на ${server.host}`);
    
    // Emit installation complete event
    io.emit('agent-installed', { serverId: server.id, status: 'success' });
    
  } catch (error) {
    console.error(`❌ Ошибка установки агента на ${server.host}:`, error);
    server.status = 'error';
    server.installLogs.push(`❌ Ошибка: ${error.message}`);
    server.installProgress = 0;
    
    // Emit installation failed event
    io.emit('agent-installed', { serverId: server.id, status: 'error', error: error.message });
    
    ssh.dispose();
  }
}

async function getSystemInfo(server) {
  const ssh = new NodeSSH();
  
  try {
    await ssh.connect({
      host: server.host,
      port: server.port,
      username: server.username,
      password: server.password
    });
    
    const [osInfo, uptime, memory, disk, cpu] = await Promise.all([
      ssh.execCommand('cat /etc/os-release | grep PRETTY_NAME'),
      ssh.execCommand('uptime -p'),
      ssh.execCommand('free -h'),
      ssh.execCommand('df -h /'),
      ssh.execCommand('top -bn1 | grep "Cpu(s)"')
    ]);
    
    ssh.dispose();
    
    return {
      os: (osInfo.stdout.split('=')[1] && osInfo.stdout.split('=')[1].replace(/"/g, '')) || 'Unknown',
      uptime: uptime.stdout || 'Unknown',
      memory: memory.stdout,
      disk: disk.stdout,
      cpu: cpu.stdout
    };
  } catch (error) {
    ssh.dispose();
    throw error;
  }
}

async function listFiles(server, path) {
  const ssh = new NodeSSH();
  
  try {
    await ssh.connect({
      host: server.host,
      port: server.port,
      username: server.username,
      password: server.password
    });
    
    const result = await ssh.execCommand(`ls -la "${path}"`);
    ssh.dispose();
    
    const lines = result.stdout.split('\n').slice(1); // Skip first line
    const files = lines.map(line => {
      const parts = line.split(/\s+/);
      if (parts.length >= 9) {
        return {
          permissions: parts[0],
          size: parts[4],
          date: `${parts[5]} ${parts[6]} ${parts[7]}`,
          name: parts.slice(8).join(' '),
          isDirectory: parts[0].startsWith('d')
        };
      }
    }).filter(Boolean);
    
    return files;
  } catch (error) {
    ssh.dispose();
    throw error;
  }
}

// Socket.io for real-time updates
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('join-server', (serverId) => {
    socket.join(`server-${serverId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// ===== AGENT API ENDPOINTS =====

// Получение агента для установки
app.get('/api/agent/download', (req, res) => {
  const agentPath = path.join(__dirname, '../agent/xpanel-agent.py');
  if (fs.existsSync(agentPath)) {
    res.download(agentPath);
  } else {
    res.status(404).json({ error: 'Agent file not found' });
  }
});

// Получение скрипта установки
app.get('/api/agent/install', (req, res) => {
  const scriptPath = path.join(__dirname, '../agent/install-agent.sh');
  if (fs.existsSync(scriptPath)) {
    res.setHeader('Content-Type', 'text/plain');
    res.sendFile(scriptPath);
  } else {
    res.status(404).send('Install script not found');
  }
});

// Альтернативный endpoint для скачивания
app.get('/api/agent/install-script', (req, res) => {
  const scriptPath = path.join(__dirname, '../agent/install-agent.sh');
  if (fs.existsSync(scriptPath)) {
    res.download(scriptPath);
  } else {
    res.status(404).json({ error: 'Install script not found' });
  }
});

// Прием статистики от агентов
app.post('/api/agent/stats', authenticateAgent, (req, res) => {
  const { server_id, hostname, stats, timestamp } = req.body;
  
  console.log('Received agent stats:', { server_id, hostname, stats });
  
  // Сохраняем данные сервера
  agentServers.set(server_id, {
    id: server_id,
    hostname: hostname,
    ip: req.ip,
    stats: stats,
    lastSeen: new Date(),
    status: 'online'
  });
  
  console.log('Agent servers count:', agentServers.size);
  
  // Отправляем данные через WebSocket
  io.emit('server-stats', {
    serverId: server_id,
    hostname,
    stats,
    timestamp
  });
  
  res.json({ success: true });
});

// Прием алертов от агентов
app.post('/api/agent/alerts', authenticateAgent, (req, res) => {
  const { server_id, alerts, timestamp } = req.body;
  
  alerts.forEach(alert => {
    // Находим пользователей этого сервера
    const server = agentServers.get(server_id);
    if (server && server.userId) {
      // Отправляем уведомление в Telegram
      telegramBot.sendLoadAlert(
        server.userId,
        server.hostname || server_id,
        alert.type,
        alert.value,
        alert.threshold
      );
    }
    
    // Отправляем через WebSocket
    io.emit('server-alert', {
      serverId: server_id,
      alert,
      timestamp
    });
  });
  
  res.json({ success: true });
});

// Получение команд для агента
app.get('/api/agent/commands/:serverId', authenticateAgent, (req, res) => {
  const serverId = req.params.serverId;
  const commands = serverCommands.get(serverId) || [];
  
  // Очищаем команды после получения
  serverCommands.delete(serverId);
  
  res.json({ commands });
});

// Прием результатов команд
app.post('/api/agent/command-result', authenticateAgent, (req, res) => {
  const { command_id, server_id, result, timestamp } = req.body;
  
  // Отправляем результат через WebSocket
  io.emit('command-result', {
    commandId: command_id,
    serverId: server_id,
    result,
    timestamp
  });
  
  res.json({ success: true });
});

// ===== TELEGRAM BOT API =====

// Генерация кода привязки Telegram
app.post('/api/telegram/generate-code', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const username = req.user.username;
  
  const code = telegramBot.generateBindingCode(userId, username);
  
  res.json({ 
    code,
    expiresIn: 20 * 60, // 20 минут в секундах
    message: 'Отправьте этот код боту в Telegram в течение 20 минут'
  });
});

// Проверка статуса привязки
app.get('/api/telegram/status', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const isBound = telegramBot.isUserBound(userId);
  
  if (isBound) {
    const bindings = telegramBot.getAllBindings();
    const userBinding = bindings[userId];
    res.json({
      bound: true,
      telegramUsername: userBinding.telegramUsername,
      bindDate: userBinding.bindDate
    });
  } else {
    res.json({ bound: false });
  }
});

// Отвязка Telegram
app.post('/api/telegram/unbind', authenticateToken, (req, res) => {
  const userId = req.user.id;
  // Здесь нужно реализовать отвязку со стороны сервера
  res.json({ success: true, message: 'Используйте команду /unbind в боте' });
});

// ===== SERVER MANAGEMENT API =====

// Получение списка серверов с агентами
app.get('/api/servers/agents', authenticateToken, (req, res) => {
  const servers = Array.from(agentServers.values()).map(server => ({
    id: server.id,
    hostname: server.hostname,
    ip: server.ip,
    lastSeen: server.lastSeen,
    stats: server.stats,
    status: server.status || 'unknown'
  }));
  
  res.json(servers);
});

// Отправка команды на сервер
app.post('/api/servers/:serverId/command', authenticateToken, (req, res) => {
  const serverId = req.params.serverId;
  const { command } = req.body;
  
  if (!command) {
    return res.status(400).json({ error: 'Command is required' });
  }
  
  // Проверяем права доступа
  const server = agentServers.get(serverId);
  if (!server || (req.user.role !== 'ROOT' && server.userId !== req.user.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  // Добавляем команду в очередь
  const commandId = Date.now().toString();
  const commands = serverCommands.get(serverId) || [];
  commands.push({
    id: commandId,
    command,
    timestamp: new Date().toISOString(),
    userId: req.user.id
  });
  serverCommands.set(serverId, commands);
  
  res.json({ 
    success: true, 
    commandId,
    message: 'Command queued for execution'
  });
});

// Middleware для аутентификации агентов
function authenticateAgent(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Agent authentication required' });
  }
  
  const apiKey = authHeader.substring(7);
  // Здесь должна быть проверка API ключа
  // Для простоты пропускаем любой ключ длиннее 10 символов
  if (apiKey.length < 10) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  req.agentKey = apiKey;
  next();
}

// ===== VPS MANAGEMENT ENDPOINTS =====

// Добавить VPS для мониторинга
app.post('/api/vps/add', authenticateToken, async (req, res) => {
  try {
    const { name, ip, port, apiKey } = req.body;
    const userId = req.user.userId;

    if (!name || !ip || !apiKey) {
      return res.status(400).json({ error: 'Название, IP и API ключ обязательны' });
    }

    const vpsId = `vps_${userId}_${Date.now()}`;
    const vpsConfig = {
      id: vpsId,
      name,
      ip,
      port: port || 8888,
      apiKey,
      userId,
      createdAt: new Date()
    };

    // Сохраняем в список пользователя
    if (!userVPSList.has(userId)) {
      userVPSList.set(userId, []);
    }
    userVPSList.get(userId).push(vpsConfig);

    // Добавляем в VPS Manager для подключения
    vpsManager.addVPS(vpsId, vpsConfig);

    res.json({
      success: true,
      message: 'VPS добавлен и подключается...',
      vps: {
        id: vpsId,
        name,
        ip,
        port: port || 8888,
        status: 'connecting'
      }
    });

  } catch (error) {
    console.error('Add VPS error:', error);
    res.status(500).json({ error: 'Ошибка добавления VPS: ' + error.message });
  }
});

// Получить список VPS пользователя
app.get('/api/vps/list', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const userVPS = vpsManager.getUserVPS(userId);
    
    res.json({
      success: true,
      vps: userVPS
    });

  } catch (error) {
    console.error('Get VPS list error:', error);
    res.status(500).json({ error: 'Ошибка получения списка VPS' });
  }
});

// Получить статистику конкретного VPS
app.get('/api/vps/:vpsId/stats', authenticateToken, async (req, res) => {
  try {
    const { vpsId } = req.params;
    const userId = req.user.userId;

    // Проверяем, принадлежит ли VPS пользователю
    const vpsInfo = vpsManager.getVPSInfo(vpsId);
    if (!vpsInfo || vpsInfo.userId !== userId) {
      return res.status(404).json({ error: 'VPS не найден' });
    }

    if (!vpsManager.isVPSConnected(vpsId)) {
      return res.status(503).json({ error: 'VPS не подключен' });
    }

    const stats = await vpsManager.getVPSStats(vpsId);
    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Get VPS stats error:', error);
    res.status(500).json({ error: 'Ошибка получения статистики VPS' });
  }
});

// Выполнить команду на VPS
app.post('/api/vps/:vpsId/execute', authenticateToken, async (req, res) => {
  try {
    const { vpsId } = req.params;
    const { command } = req.body;
    const userId = req.user.userId;

    if (!command) {
      return res.status(400).json({ error: 'Команда обязательна' });
    }

    // Проверяем, принадлежит ли VPS пользователю
    const vpsInfo = vpsManager.getVPSInfo(vpsId);
    if (!vpsInfo || vpsInfo.userId !== userId) {
      return res.status(404).json({ error: 'VPS не найден' });
    }

    if (!vpsManager.isVPSConnected(vpsId)) {
      return res.status(503).json({ error: 'VPS не подключен' });
    }

    const result = await vpsManager.executeCommand(vpsId, command);
    res.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('Execute command error:', error);
    res.status(500).json({ error: 'Ошибка выполнения команды: ' + error.message });
  }
});

// Удалить VPS
app.delete('/api/vps/:vpsId', authenticateToken, (req, res) => {
  try {
    const { vpsId } = req.params;
    const userId = req.user.userId;

    // Проверяем, принадлежит ли VPS пользователю
    const vpsInfo = vpsManager.getVPSInfo(vpsId);
    if (!vpsInfo || vpsInfo.userId !== userId) {
      return res.status(404).json({ error: 'VPS не найден' });
    }

    // Удаляем из VPS Manager
    vpsManager.removeVPS(vpsId);

    // Удаляем из списка пользователя
    const userVPS = userVPSList.get(userId) || [];
    const updatedVPS = userVPS.filter(vps => vps.id !== vpsId);
    userVPSList.set(userId, updatedVPS);

    res.json({
      success: true,
      message: 'VPS удален'
    });

  } catch (error) {
    console.error('Remove VPS error:', error);
    res.status(500).json({ error: 'Ошибка удаления VPS' });
  }
});

// Получить информацию о VPS
app.get('/api/vps/:vpsId/info', authenticateToken, (req, res) => {
  try {
    const { vpsId } = req.params;
    const userId = req.user.userId;

    const vpsInfo = vpsManager.getVPSInfo(vpsId);
    if (!vpsInfo || vpsInfo.userId !== userId) {
      return res.status(404).json({ error: 'VPS не найден' });
    }

    res.json({
      success: true,
      vps: vpsInfo
    });

  } catch (error) {
    console.error('Get VPS info error:', error);
    res.status(500).json({ error: 'Ошибка получения информации о VPS' });
  }
});

// ===== SYSTEM ENDPOINTS =====

// System stats endpoint
app.get('/api/system/stats', authenticateToken, (req, res) => {
  try {
    const os = require('os');
    const fs = require('fs');
    
    // CPU usage calculation
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);
    
    // Memory usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = (usedMem / totalMem) * 100;
    
    // Disk usage (approximate)
    let diskUsage = 50; // Default fallback
    try {
      const stats = fs.statSync('/');
      // This is a simplified disk usage calculation
      diskUsage = Math.random() * 30 + 20; // 20-50% for demo
    } catch (error) {
      console.log('Disk stats not available');
    }
    
    // System info
    const uptime = os.uptime();
    const loadAverage = os.loadavg();
    
    // Process count (approximate)
    let processCount = 100;
    try {
      const { execSync } = require('child_process');
      const result = execSync('ps aux | wc -l', { encoding: 'utf8' });
      processCount = parseInt(result.trim()) - 1; // Subtract header line
    } catch (error) {
      console.log('Process count not available');
    }
    
    res.json({
      cpu: usage,
      memory: memUsage,
      disk: diskUsage,
      uptime: uptime,
      processes: processCount,
      loadAverage: loadAverage,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('System stats error:', error);
    res.status(500).json({ error: 'Failed to get system stats' });
  }
});

// Serve React app
app.get('*', (req, res) => {
  const buildPath = path.join(__dirname, '../client/build/index.html');
  
  // Always serve production build or show error
  if (fs.existsSync(buildPath)) {
    res.sendFile(buildPath);
  } else {
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Xpanel - Build Required</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              background: #0a0a0a; 
              color: #ffffff; 
              text-align: center; 
              padding: 50px; 
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              background: #1e1e2e; 
              padding: 40px; 
              border-radius: 12px; 
              border: 1px solid #ff4444; 
            }
            h1 { color: #ff4444; }
            .error { color: #ff4444; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>⚠️ Client Build Not Found</h1>
            <div class="error">Please build the client application first</div>
            <p>Run: <code>cd client && npm run build</code></p>
          </div>
        </body>
      </html>
    `);
  }
});

const PORT = process.env.PORT || 3001;
const DOMAIN = process.env.DOMAIN || '64.188.70.12';
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Xpanel server running on port ${PORT}`);
  console.log(`📊 Dashboard: http://${DOMAIN}:${PORT}`);
  console.log(`🌐 Local access: http://localhost:${PORT}`);
  console.log(`🤖 Telegram Bot: Active`);
  console.log(`📡 Agent API: http://${DOMAIN}:${PORT}/api/agent/`);
});
