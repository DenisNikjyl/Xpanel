import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { 
  FiServer, 
  FiCpu, 
  FiHardDrive, 
  FiActivity,
  FiWifi,
  FiTerminal,
  FiSettings,
  FiTrash2,
  FiRefreshCw,
  FiEye,
  FiAlertTriangle
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import axios from 'axios';

const ServerListContainer = styled.div`
  padding: 2rem;
`;

const ServerGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

const ServerCard = styled(motion.div)`
  background: rgba(255, 255, 255, 0.03);
  border-radius: 16px;
  border: 1px solid rgba(0, 212, 255, 0.1);
  padding: 1.5rem;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  
  &:hover {
    border-color: rgba(0, 212, 255, 0.3);
    transform: translateY(-5px);
  }
`;

const ServerHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
`;

const ServerInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const ServerIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
`;

const ServerDetails = styled.div``;

const ServerName = styled.h3`
  font-size: 1.1rem;
  font-weight: bold;
  color: #ffffff;
  margin: 0 0 0.25rem 0;
`;

const ServerIP = styled.div`
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.6);
`;

const StatusBadge = styled.span`
  padding: 0.3rem 0.8rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: bold;
  background: ${props => {
    switch(props.status) {
      case 'online': return 'linear-gradient(135deg, #00ff88 0%, #00cc66 100%)';
      case 'offline': return 'linear-gradient(135deg, #ff4757 0%, #cc3644 100%)';
      case 'warning': return 'linear-gradient(135deg, #ffa502 0%, #cc8400 100%)';
      default: return 'rgba(255, 255, 255, 0.2)';
    }
  }};
  color: #ffffff;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin: 1rem 0;
`;

const StatItem = styled.div`
  text-align: center;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  border: 1px solid rgba(0, 212, 255, 0.1);
`;

const StatIcon = styled.div`
  color: #00d4ff;
  margin-bottom: 0.5rem;
  display: flex;
  justify-content: center;
`;

const StatValue = styled.div`
  font-size: 1.2rem;
  font-weight: bold;
  color: ${props => {
    if (props.value > 90) return '#ff4757';
    if (props.value > 80) return '#ffa502';
    return '#00ff88';
  }};
  margin-bottom: 0.25rem;
`;

const StatLabel = styled.div`
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
`;

const ServerActions = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
`;

const ActionButton = styled(motion.button)`
  padding: 0.5rem 1rem;
  background: ${props => {
    switch(props.variant) {
      case 'primary': return 'linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)';
      case 'success': return 'linear-gradient(135deg, #00ff88 0%, #00cc66 100%)';
      case 'danger': return 'linear-gradient(135deg, #ff4757 0%, #cc3644 100%)';
      case 'warning': return 'linear-gradient(135deg, #ffa502 0%, #cc8400 100%)';
      default: return 'rgba(255, 255, 255, 0.1)';
    }
  }};
  color: #ffffff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 212, 255, 0.3);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const LastSeen = styled.div`
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 0.5rem;
  text-align: center;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 4rem 2rem;
  color: rgba(255, 255, 255, 0.6);
`;

const EmptyIcon = styled.div`
  font-size: 4rem;
  color: rgba(0, 212, 255, 0.3);
  margin-bottom: 1rem;
`;

function AgentServerList() {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServers();
    const interval = setInterval(fetchServers, 30000); // Обновляем каждые 30 секунд
    return () => clearInterval(interval);
  }, []);

  const fetchServers = async () => {
    try {
      const token = localStorage.getItem('xpanel_token');
      const response = await axios.get('/api/servers/agents', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setServers(response.data);
    } catch (error) {
      console.error('Ошибка загрузки серверов:', error);
      toast.error('Ошибка загрузки серверов с агентами');
    } finally {
      setLoading(false);
    }
  };

  const executeCommand = async (serverId, command) => {
    try {
      const token = localStorage.getItem('xpanel_token');
      const response = await axios.post(`/api/servers/${serverId}/command`, 
        { command },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Команда отправлена на сервер');
    } catch (error) {
      toast.error('Ошибка выполнения команды');
    }
  };

  const getServerStatus = (server) => {
    if (!server.lastSeen) return 'offline';
    
    const lastSeen = new Date(server.lastSeen);
    const now = new Date();
    const diffMinutes = (now - lastSeen) / (1000 * 60);
    
    if (diffMinutes > 5) return 'offline';
    if (server.stats?.cpu?.percent > 90 || server.stats?.memory?.percent > 90) return 'warning';
    return 'online';
  };

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'Никогда';
    
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Только что';
    if (diffMinutes < 60) return `${diffMinutes} мин назад`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} ч назад`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} дн назад`;
  };

  const formatUptime = (uptime) => {
    if (!uptime) return 'N/A';
    
    const days = Math.floor(uptime / (24 * 3600));
    const hours = Math.floor((uptime % (24 * 3600)) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    
    if (days > 0) return `${days}д ${hours}ч`;
    if (hours > 0) return `${hours}ч ${minutes}м`;
    return `${minutes}м`;
  };

  if (loading) {
    return (
      <ServerListContainer>
        <div style={{ textAlign: 'center', padding: '4rem', color: 'rgba(255,255,255,0.6)' }}>
          <FiRefreshCw className="animate-spin" size={48} />
          <div style={{ marginTop: '1rem' }}>Загрузка серверов...</div>
        </div>
      </ServerListContainer>
    );
  }

  if (servers.length === 0) {
    return (
      <ServerListContainer>
        <EmptyState>
          <EmptyIcon>
            <FiServer />
          </EmptyIcon>
          <h3>Нет подключенных серверов</h3>
          <p>Установите агент на ваши серверы для начала мониторинга</p>
          <ActionButton 
            variant="primary" 
            style={{ marginTop: '1rem' }}
            onClick={() => window.location.hash = '#installer'}
          >
            Установить агент
          </ActionButton>
        </EmptyState>
      </ServerListContainer>
    );
  }

  return (
    <ServerListContainer>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '2rem' 
      }}>
        <h2 style={{ color: '#00d4ff', margin: 0 }}>
          Серверы с агентами ({servers.length})
        </h2>
        <ActionButton variant="primary" onClick={fetchServers}>
          <FiRefreshCw />
          Обновить
        </ActionButton>
      </div>

      <ServerGrid>
        {servers.map(server => {
          const status = getServerStatus(server);
          const stats = server.stats || {};
          
          return (
            <ServerCard
              key={server.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02 }}
            >
              <ServerHeader>
                <ServerInfo>
                  <ServerIcon>
                    <FiServer />
                  </ServerIcon>
                  <ServerDetails>
                    <ServerName>{server.hostname}</ServerName>
                    <ServerIP>{server.ip}</ServerIP>
                  </ServerDetails>
                </ServerInfo>
                <StatusBadge status={status}>
                  {status === 'online' && 'Онлайн'}
                  {status === 'offline' && 'Офлайн'}
                  {status === 'warning' && 'Предупреждение'}
                </StatusBadge>
              </ServerHeader>

              <StatsGrid>
                <StatItem>
                  <StatIcon><FiCpu /></StatIcon>
                  <StatValue value={stats.cpu?.percent || 0}>
                    {Math.round(stats.cpu?.percent || 0)}%
                  </StatValue>
                  <StatLabel>CPU</StatLabel>
                </StatItem>
                
                <StatItem>
                  <StatIcon><FiHardDrive /></StatIcon>
                  <StatValue value={stats.memory?.percent || 0}>
                    {Math.round(stats.memory?.percent || 0)}%
                  </StatValue>
                  <StatLabel>RAM</StatLabel>
                </StatItem>
                
                <StatItem>
                  <StatIcon><FiActivity /></StatIcon>
                  <StatValue>
                    {formatUptime(stats.uptime)}
                  </StatValue>
                  <StatLabel>Uptime</StatLabel>
                </StatItem>
              </StatsGrid>

              <ServerActions>
                <ActionButton 
                  variant="primary"
                  onClick={() => executeCommand(server.id, 'systemctl status xpanel-agent')}
                >
                  <FiEye />
                  Статус
                </ActionButton>
                
                <ActionButton 
                  variant="success"
                  onClick={() => executeCommand(server.id, 'systemctl restart xpanel-agent')}
                >
                  <FiRefreshCw />
                  Перезапуск
                </ActionButton>
                
                <ActionButton 
                  variant="warning"
                  onClick={() => executeCommand(server.id, 'top -b -n1 | head -20')}
                >
                  <FiTerminal />
                  Процессы
                </ActionButton>
              </ServerActions>

              <LastSeen>
                Последняя активность: {formatLastSeen(server.lastSeen)}
              </LastSeen>
              
              {server.agentVersion && (
                <div style={{ 
                  fontSize: '0.8rem', 
                  color: 'rgba(255,255,255,0.4)', 
                  textAlign: 'center',
                  marginTop: '0.25rem'
                }}>
                  Agent v{server.agentVersion}
                </div>
              )}
            </ServerCard>
          );
        })}
      </ServerGrid>
    </ServerListContainer>
  );
}

export default AgentServerList;
