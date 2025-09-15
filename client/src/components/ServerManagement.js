import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiServer, FiActivity, FiCpu, FiHardDrive, FiWifi, FiTerminal,
  FiPlay, FiPause, FiRefreshCw, FiTrash2, FiEdit3, FiSettings,
  FiMonitor, FiShield, FiAlertTriangle, FiCheckCircle, FiXCircle
} from 'react-icons/fi';
import toast from 'react-hot-toast';

// Анимации
const pulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
`;

const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

// Styled Components
const Container = styled.div`
  padding: 0;
`;

const ServerGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
`;

const ServerCard = styled(motion.div)`
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: 16px;
  padding: 2rem;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  
  &:hover {
    transform: translateY(-5px);
    border-color: rgba(0, 212, 255, 0.4);
    box-shadow: 0 10px 30px rgba(0, 212, 255, 0.1);
  }
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: ${props => {
      switch (props.status) {
        case 'online': return 'linear-gradient(90deg, #00ff88, #00d4ff)';
        case 'offline': return 'linear-gradient(90deg, #ff4757, #ff3838)';
        case 'maintenance': return 'linear-gradient(90deg, #ffa502, #ff6348)';
        default: return 'linear-gradient(90deg, #747d8c, #57606f)';
      }
    }};
  }
`;

const ServerHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
`;

const ServerInfo = styled.div`
  flex: 1;
`;

const ServerName = styled.h3`
  color: white;
  font-size: 1.3rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ServerAddress = styled.p`
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
`;

const StatusBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  
  ${props => {
    switch (props.status) {
      case 'online':
        return `
          background: rgba(0, 255, 136, 0.2);
          color: #00ff88;
          border: 1px solid rgba(0, 255, 136, 0.3);
        `;
      case 'offline':
        return `
          background: rgba(255, 71, 87, 0.2);
          color: #ff4757;
          border: 1px solid rgba(255, 71, 87, 0.3);
        `;
      case 'maintenance':
        return `
          background: rgba(255, 165, 2, 0.2);
          color: #ffa502;
          border: 1px solid rgba(255, 165, 2, 0.3);
        `;
      default:
        return `
          background: rgba(116, 125, 140, 0.2);
          color: #747d8c;
          border: 1px solid rgba(116, 125, 140, 0.3);
        `;
    }
  }}
`;

const ServerActions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ActionButton = styled(motion.button)`
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(0, 212, 255, 0.3);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(0, 212, 255, 0.2);
    color: #00d4ff;
    border-color: #00d4ff;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
`;

const MetricItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(0, 212, 255, 0.1);
`;

const MetricIcon = styled.div`
  color: #00d4ff;
  font-size: 1.2rem;
`;

const MetricInfo = styled.div`
  flex: 1;
`;

const MetricLabel = styled.div`
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.8rem;
  margin-bottom: 0.25rem;
`;

const MetricValue = styled.div`
  color: white;
  font-weight: 600;
  font-size: 0.9rem;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 0.5rem;
`;

const ProgressFill = styled.div`
  height: 100%;
  background: ${props => {
    if (props.value > 80) return 'linear-gradient(90deg, #ff4757, #ff3838)';
    if (props.value > 60) return 'linear-gradient(90deg, #ffa502, #ff6348)';
    return 'linear-gradient(90deg, #00ff88, #00d4ff)';
  }};
  width: ${props => props.value}%;
  transition: width 0.3s ease;
`;

const ServerFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 1rem;
  border-top: 1px solid rgba(0, 212, 255, 0.1);
`;

const LastUpdate = styled.div`
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.8rem;
`;

const QuickActions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const QuickActionButton = styled(motion.button)`
  padding: 0.5rem 1rem;
  background: transparent;
  border: 1px solid rgba(0, 212, 255, 0.3);
  border-radius: 6px;
  color: #00d4ff;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 500;
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(0, 212, 255, 0.1);
    border-color: #00d4ff;
  }
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

const EmptyTitle = styled.h3`
  color: rgba(255, 255, 255, 0.8);
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
`;

const EmptyDescription = styled.p`
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 2rem;
`;

const AddServerButton = styled(motion.button)`
  padding: 1rem 2rem;
  background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
  color: #0a0a0a;
  border: none;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 212, 255, 0.3);
  }
`;

function ServerManagement({ servers = [], onRefresh, onAddServer }) {
  const [loading, setLoading] = useState(false);
  const [selectedServer, setSelectedServer] = useState(null);

  // Симуляция данных метрик для демонстрации
  const generateMetrics = (server) => ({
    cpu: Math.floor(Math.random() * 100),
    memory: Math.floor(Math.random() * 100),
    disk: Math.floor(Math.random() * 100),
    network: Math.floor(Math.random() * 1000)
  });

  const handleServerAction = async (serverId, action) => {
    setLoading(true);
    try {
      // Здесь будет API вызов для выполнения действия
      await new Promise(resolve => setTimeout(resolve, 1000)); // Симуляция
      
      switch (action) {
        case 'start':
          toast.success('Сервер запущен');
          break;
        case 'stop':
          toast.success('Сервер остановлен');
          break;
        case 'restart':
          toast.success('Сервер перезапущен');
          break;
        case 'delete':
          toast.success('Сервер удален');
          break;
        default:
          break;
      }
      
      if (onRefresh) onRefresh();
    } catch (error) {
      toast.error('Ошибка выполнения операции');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'online':
        return <FiCheckCircle />;
      case 'offline':
        return <FiXCircle />;
      case 'maintenance':
        return <FiAlertTriangle />;
      default:
        return <FiServer />;
    }
  };

  const formatLastUpdate = (date) => {
    if (!date) return 'Никогда';
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Только что';
    if (minutes < 60) return `${minutes} мин назад`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)} ч назад`;
    return `${Math.floor(minutes / 1440)} дн назад`;
  };

  if (servers.length === 0) {
    return (
      <Container>
        <EmptyState>
          <EmptyIcon>
            <FiServer />
          </EmptyIcon>
          <EmptyTitle>Нет серверов</EmptyTitle>
          <EmptyDescription>
            Добавьте свой первый сервер для начала управления инфраструктурой
          </EmptyDescription>
          <AddServerButton
            onClick={onAddServer}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Добавить сервер
          </AddServerButton>
        </EmptyState>
      </Container>
    );
  }

  return (
    <Container>
      <ServerGrid>
        {servers.map((server) => {
          const metrics = generateMetrics(server);
          
          return (
            <ServerCard
              key={server.id}
              status={server.status}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ServerHeader>
                <ServerInfo>
                  <ServerName>
                    <FiServer />
                    {server.name || server.hostname}
                  </ServerName>
                  <ServerAddress>
                    {server.ip}:{server.port || 22}
                  </ServerAddress>
                  <StatusBadge status={server.status}>
                    {getStatusIcon(server.status)}
                    {server.status || 'unknown'}
                  </StatusBadge>
                </ServerInfo>
                
                <ServerActions>
                  <ActionButton
                    onClick={() => handleServerAction(server.id, 'restart')}
                    disabled={loading}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    title="Перезапустить"
                  >
                    <FiRefreshCw style={{ animation: loading ? `${spin} 1s linear infinite` : 'none' }} />
                  </ActionButton>
                  
                  <ActionButton
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    title="Настройки"
                  >
                    <FiSettings />
                  </ActionButton>
                  
                  <ActionButton
                    onClick={() => handleServerAction(server.id, 'delete')}
                    disabled={loading}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    title="Удалить"
                    style={{ color: '#ff4757' }}
                  >
                    <FiTrash2 />
                  </ActionButton>
                </ServerActions>
              </ServerHeader>

              <MetricsGrid>
                <MetricItem>
                  <MetricIcon><FiCpu /></MetricIcon>
                  <MetricInfo>
                    <MetricLabel>CPU</MetricLabel>
                    <MetricValue>{metrics.cpu}%</MetricValue>
                    <ProgressBar>
                      <ProgressFill value={metrics.cpu} />
                    </ProgressBar>
                  </MetricInfo>
                </MetricItem>

                <MetricItem>
                  <MetricIcon><FiActivity /></MetricIcon>
                  <MetricInfo>
                    <MetricLabel>RAM</MetricLabel>
                    <MetricValue>{metrics.memory}%</MetricValue>
                    <ProgressBar>
                      <ProgressFill value={metrics.memory} />
                    </ProgressBar>
                  </MetricInfo>
                </MetricItem>

                <MetricItem>
                  <MetricIcon><FiHardDrive /></MetricIcon>
                  <MetricInfo>
                    <MetricLabel>Диск</MetricLabel>
                    <MetricValue>{metrics.disk}%</MetricValue>
                    <ProgressBar>
                      <ProgressFill value={metrics.disk} />
                    </ProgressBar>
                  </MetricInfo>
                </MetricItem>

                <MetricItem>
                  <MetricIcon><FiWifi /></MetricIcon>
                  <MetricInfo>
                    <MetricLabel>Сеть</MetricLabel>
                    <MetricValue>{metrics.network} MB/s</MetricValue>
                  </MetricInfo>
                </MetricItem>
              </MetricsGrid>

              <ServerFooter>
                <LastUpdate>
                  Обновлено: {formatLastUpdate(server.lastUpdate)}
                </LastUpdate>
                
                <QuickActions>
                  <QuickActionButton
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <FiTerminal style={{ marginRight: '0.25rem' }} />
                    SSH
                  </QuickActionButton>
                  
                  <QuickActionButton
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <FiMonitor style={{ marginRight: '0.25rem' }} />
                    Мониторинг
                  </QuickActionButton>
                </QuickActions>
              </ServerFooter>
            </ServerCard>
          );
        })}
      </ServerGrid>
    </Container>
  );
}

export default ServerManagement;
