const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
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
app.use(express.static(path.join(__dirname, '../public')));

// In-memory storage
let users = [];
let servers = [];
let nextUserId = 1;
let nextServerId = 1;

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'xpanel_secret_key_2024';

// Admin email
const ADMIN_EMAIL = 'fillsites0@gmail.com';

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

// Auth routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Неверный формат email' });
    }

    const existingUser = users.find(u => u.email === email || u.username === username);
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь уже существует' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const role = email === ADMIN_EMAIL ? 'ROOT' : 'USER';
    
    const user = {
      id: nextUserId++,
      username,
      email,
      password: hashedPassword,
      role,
      createdAt: new Date()
    };
    
    users.push(user);
    
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
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = users.find(u => u.username === username || u.email === username);
    if (!user) {
      return res.status(401).json({ error: 'Неверные учетные данные' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Неверные учетные данные' });
    }

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
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Server management routes
app.get('/api/servers', authenticateToken, (req, res) => {
  const userServers = servers.filter(s => s.userId === req.user.userId || req.user.role === 'ROOT');
  res.json(userServers);
});

app.post('/api/servers', authenticateToken, async (req, res) => {
  try {
    const { name, host, port, username, password, description } = req.body;

    if (!name || !host || !username || !password) {
      return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
    }

    const server = {
      id: nextServerId++,
      userId: req.user.userId,
      name,
      host,
      port: port || 22,
      username,
      password,
      description: description || '',
      status: 'offline',
      createdAt: new Date(),
      lastSeen: null,
      stats: {
        cpu: Math.floor(Math.random() * 100),
        memory: Math.floor(Math.random() * 100),
        disk: Math.floor(Math.random() * 100),
        uptime: Math.floor(Math.random() * 86400)
      }
    };

    servers.push(server);
    res.json(server);
  } catch (error) {
    console.error('Add server error:', error);
    res.status(500).json({ error: 'Не удалось добавить сервер' });
  }
});

app.delete('/api/servers/:id', authenticateToken, (req, res) => {
  const serverId = parseInt(req.params.id);
  const serverIndex = servers.findIndex(s => s.id === serverId && (s.userId === req.user.userId || req.user.role === 'ROOT'));
  
  if (serverIndex === -1) {
    return res.status(404).json({ error: 'Server not found' });
  }
  
  servers.splice(serverIndex, 1);
  res.json({ message: 'Server removed' });
});

// Admin routes
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

// Serve static files
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send(`
      <html>
        <head>
          <title>Xpanel - Files Not Found</title>
          <style>
            body { 
              font-family: Arial; 
              text-align: center; 
              padding: 50px; 
              background: #1a1a1a; 
              color: #fff; 
            }
            .container { 
              max-width: 500px; 
              margin: 0 auto; 
              background: #2d2d2d; 
              padding: 40px; 
              border-radius: 12px; 
              border: 1px solid #ff4444; 
            }
            h1 { color: #ff4444; }
            .error { color: #ff4444; margin: 20px 0; }
            code { background: #000; padding: 5px; border-radius: 3px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>⚠️ Xpanel Files Not Found</h1>
            <div class="error">Static files not found in /public directory</div>
            <p>Please ensure these files exist:</p>
            <ul style="text-align: left;">
              <li>/public/index.html</li>
              <li>/public/style.css</li>
              <li>/public/script.js</li>
            </ul>
          </div>
        </body>
      </html>
    `);
  }
});

const PORT = process.env.PORT || 3001;
const DOMAIN = process.env.DOMAIN || '64.188.70.12';

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Xpanel Simple Server running on port ${PORT}`);
  console.log(`📊 Dashboard: http://${DOMAIN}:${PORT}`);
  console.log(`🌐 Local access: http://localhost:${PORT}`);
  console.log(`📁 Serving files from: /public`);
  console.log(`🚫 NO BUILD REQUIRED - Pure HTML/CSS/JS`);
});
