import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { 
  FiCpu, FiHardDrive, FiActivity, FiWifi, FiClock, FiUsers,
  FiServer, FiMonitor, FiTrendingUp, FiTrendingDown, FiAlertTriangle,
  FiCheckCircle, FiXCircle, FiRefreshCw, FiBarChart2
} from 'react-icons/fi';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar 
} from 'recharts';
import toast from 'react-hot-toast';

const MonitoringContainer = styled.div`
  padding: 20px;
  height: 100vh;
  overflow-y: auto;
  background: ${props => props.theme.colors.background};
`;

const Header = styled.div`
  display: flex;
  justify-content: between;
  align-items: center;
  margin-bottom: 30px;
`;

const Title = styled.h1`
  color: ${props => props.theme.colors.text};
  font-size: 28px;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const RefreshButton = styled(motion.button)`
  background: ${props => props.theme.colors.accent};
  color: white;
  border: none;
  padding: 10px 15px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  margin-left: auto;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
`;

const StatCard = styled(motion.div)`
  background: ${props => props.theme.colors.surface};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 12px;
  padding: 20px;
  position: relative;
  overflow: hidden;
`;

const StatHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
`;

const StatTitle = styled.h3`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 14px;
  font-weight: 500;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const StatIcon = styled.div`
  color: ${props => props.color || props.theme.colors.accent};
  font-size: 20px;
`;

const StatValue = styled.div`
  color: ${props => props.theme.colors.text};
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 8px;
`;

const StatChange = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: ${props => props.positive ? '#00ff88' : '#ff4757'};
`;

const ChartsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
`;

const ChartCard = styled(motion.div)`
  background: ${props => props.theme.colors.surface};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 12px;
  padding: 20px;
  height: 300px;
`;

const ChartTitle = styled.h3`
  color: ${props => props.theme.colors.text};
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 20px 0;
`;

const ServerStatusGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
`;

const ServerCard = styled(motion.div)`
  background: ${props => props.theme.colors.surface};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 12px;
  padding: 20px;
`;

const ServerHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
`;

const ServerName = styled.h4`
  color: ${props => props.theme.colors.text};
  font-size: 16px;
  font-weight: 600;
  margin: 0;
`;

const ServerStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: ${props => props.online ? '#00ff88' : '#ff4757'};
  font-weight: 500;
`;

const ServerMetrics = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
`;

const Metric = styled.div`
  text-align: center;
`;

const MetricLabel = styled.div`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 12px;
  margin-bottom: 5px;
`;

const MetricValue = styled.div`
  color: ${props => props.theme.colors.text};
  font-size: 18px;
  font-weight: 600;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 6px;
  background: ${props => props.theme.colors.border};
  border-radius: 3px;
  overflow: hidden;
  margin-top: 5px;
`;

const ProgressFill = styled.div`
  height: 100%;
  background: ${props => {
    if (props.value > 80) return '#ff4757';
    if (props.value > 60) return '#ffa502';
    return '#00ff88';
  }};
  width: ${props => props.value}%;
  transition: width 0.3s ease;
`;

const MonitoringDashboard = ({ selectedServer }) => {
  const [stats, setStats] = useState({
    totalServers: 5,
    onlineServers: 4,
    totalCPU: 45.2,
    totalRAM: 67.8,
    totalDisk: 34.5,
    networkTraffic: 125.6
  });

  const [cpuData, setCpuData] = useState([]);
  const [memoryData, setMemoryData] = useState([]);
  const [networkData, setNetworkData] = useState([]);
  const [servers, setServers] = useState([]);

  useEffect(() => {
    // Генерируем данные для графиков
    const generateData = () => {
      const now = new Date();
      const data = [];
      for (let i = 23; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 60 * 60 * 1000);
        data.push({
          time: time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          cpu: Math.random() * 100,
          memory: Math.random() * 100,
          network: Math.random() * 1000
        });
      }
      return data;
    };

    const data = generateData();
    setCpuData(data);
    setMemoryData(data);
    setNetworkData(data);

    // Генерируем данные серверов
    setServers([
      {
        id: 1,
        name: 'Веб-сервер #1',
        ip: '192.168.1.100',
        online: true,
        cpu: 45,
        memory: 67,
        disk: 34,
        uptime: '15д 7ч'
      },
      {
        id: 2,
        name: 'База данных',
        ip: '192.168.1.101',
        online: true,
        cpu: 23,
        memory: 89,
        disk: 56,
        uptime: '30д 12ч'
      },
      {
        id: 3,
        name: 'API сервер',
        ip: '192.168.1.102',
        online: true,
        cpu: 78,
        memory: 45,
        disk: 23,
        uptime: '7д 3ч'
      },
      {
        id: 4,
        name: 'Файловый сервер',
        ip: '192.168.1.103',
        online: false,
        cpu: 0,
        memory: 0,
        disk: 78,
        uptime: 'Офлайн'
      },
      {
        id: 5,
        name: 'Резервный сервер',
        ip: '192.168.1.104',
        online: true,
        cpu: 12,
        memory: 34,
        disk: 67,
        uptime: '45д 18ч'
      }
    ]);
  }, []);

  const refreshData = () => {
    toast.success('Данные мониторинга обновлены');
    // Здесь будет логика обновления данных с сервера
  };

  return (
    <MonitoringContainer>
      <Header>
        <Title>
          <FiBarChart2 />
          Панель мониторинга
        </Title>
        <RefreshButton
          onClick={refreshData}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <FiRefreshCw />
          Обновить
        </RefreshButton>
      </Header>

      <StatsGrid>
        <StatCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <StatHeader>
            <StatTitle>Всего серверов</StatTitle>
            <StatIcon color="#00d4ff">
              <FiServer />
            </StatIcon>
          </StatHeader>
          <StatValue>{stats.totalServers}</StatValue>
          <StatChange positive>
            <FiTrendingUp />
            Онлайн: {stats.onlineServers}
          </StatChange>
        </StatCard>

        <StatCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <StatHeader>
            <StatTitle>Средняя нагрузка CPU</StatTitle>
            <StatIcon color="#ffa502">
              <FiCpu />
            </StatIcon>
          </StatHeader>
          <StatValue>{stats.totalCPU}%</StatValue>
          <StatChange positive={stats.totalCPU < 70}>
            {stats.totalCPU < 70 ? <FiTrendingDown /> : <FiTrendingUp />}
            {stats.totalCPU < 70 ? 'Нормальная' : 'Высокая'}
          </StatChange>
        </StatCard>

        <StatCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <StatHeader>
            <StatTitle>Использование RAM</StatTitle>
            <StatIcon color="#ff6b6b">
              <FiActivity />
            </StatIcon>
          </StatHeader>
          <StatValue>{stats.totalRAM}%</StatValue>
          <StatChange positive={stats.totalRAM < 80}>
            {stats.totalRAM < 80 ? <FiCheckCircle /> : <FiAlertTriangle />}
            {stats.totalRAM < 80 ? 'Нормально' : 'Внимание'}
          </StatChange>
        </StatCard>

        <StatCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <StatHeader>
            <StatTitle>Сетевой трафик</StatTitle>
            <StatIcon color="#00ff88">
              <FiWifi />
            </StatIcon>
          </StatHeader>
          <StatValue>{stats.networkTraffic} МБ/с</StatValue>
          <StatChange positive>
            <FiTrendingUp />
            Активный
          </StatChange>
        </StatCard>
      </StatsGrid>

      <ChartsGrid>
        <ChartCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <ChartTitle>Нагрузка CPU (24 часа)</ChartTitle>
          <div style={{ width: '100%', height: '85%' }}>
            <ResponsiveContainer>
              <AreaChart data={cpuData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                <XAxis dataKey="time" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip 
                  contentStyle={{ 
                    background: '#1e1e2e', 
                    border: '1px solid #00d4ff',
                    borderRadius: '8px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="cpu" 
                  stroke="#ffa502" 
                  fill="#ffa502" 
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <ChartTitle>Использование памяти (24 часа)</ChartTitle>
          <div style={{ width: '100%', height: '85%' }}>
            <ResponsiveContainer>
              <LineChart data={memoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                <XAxis dataKey="time" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip 
                  contentStyle={{ 
                    background: '#1e1e2e', 
                    border: '1px solid #00d4ff',
                    borderRadius: '8px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="memory" 
                  stroke="#ff6b6b" 
                  strokeWidth={2}
                  dot={{ fill: '#ff6b6b', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <ChartTitle>Сетевой трафик (24 часа)</ChartTitle>
          <div style={{ width: '100%', height: '85%' }}>
            <ResponsiveContainer>
              <BarChart data={networkData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                <XAxis dataKey="time" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip 
                  contentStyle={{ 
                    background: '#1e1e2e', 
                    border: '1px solid #00d4ff',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="network" fill="#00ff88" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </ChartsGrid>

      <Title style={{ fontSize: '20px', marginBottom: '20px' }}>
        <FiMonitor />
        Статус серверов
      </Title>

      <ServerStatusGrid>
        {servers.map((server, index) => (
          <ServerCard
            key={server.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 + index * 0.1 }}
          >
            <ServerHeader>
              <ServerName>{server.name}</ServerName>
              <ServerStatus online={server.online}>
                {server.online ? <FiCheckCircle /> : <FiXCircle />}
                {server.online ? 'Онлайн' : 'Офлайн'}
              </ServerStatus>
            </ServerHeader>
            
            <div style={{ color: '#666', fontSize: '12px', marginBottom: '15px' }}>
              IP: {server.ip} • Время работы: {server.uptime}
            </div>

            <ServerMetrics>
              <Metric>
                <MetricLabel>CPU</MetricLabel>
                <MetricValue>{server.cpu}%</MetricValue>
                <ProgressBar>
                  <ProgressFill value={server.cpu} />
                </ProgressBar>
              </Metric>
              
              <Metric>
                <MetricLabel>Память</MetricLabel>
                <MetricValue>{server.memory}%</MetricValue>
                <ProgressBar>
                  <ProgressFill value={server.memory} />
                </ProgressBar>
              </Metric>
              
              <Metric>
                <MetricLabel>Диск</MetricLabel>
                <MetricValue>{server.disk}%</MetricValue>
                <ProgressBar>
                  <ProgressFill value={server.disk} />
                </ProgressBar>
              </Metric>
              
              <Metric>
                <MetricLabel>Сеть</MetricLabel>
                <MetricValue>{server.online ? 'Активна' : 'Неактивна'}</MetricValue>
              </Metric>
            </ServerMetrics>
          </ServerCard>
        ))}
      </ServerStatusGrid>
    </MonitoringContainer>
  );
};

export default MonitoringDashboard;
