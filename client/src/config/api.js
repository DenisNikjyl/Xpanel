// API Configuration
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://xpanel.xload.ru'
  : 'http://localhost:3001';

export const API_ENDPOINTS = {
  LOGIN: `${API_BASE_URL}/api/login`,
  REGISTER: `${API_BASE_URL}/api/register`,
  SERVERS: `${API_BASE_URL}/api/servers`,
  ADMIN_USERS: `${API_BASE_URL}/api/admin/users`,
  ADMIN_SERVERS: `${API_BASE_URL}/api/admin/servers`,
  FILES: `${API_BASE_URL}/api/files`,
  SSH: `${API_BASE_URL}/api/ssh`,
  TERMINAL: `${API_BASE_URL}/api/terminal`,
  GIT: `${API_BASE_URL}/api/git`
};

export const WEBSOCKET_URL = process.env.NODE_ENV === 'production'
  ? 'wss://xpanel.xload.ru'
  : 'ws://localhost:3001';

export default API_BASE_URL;
