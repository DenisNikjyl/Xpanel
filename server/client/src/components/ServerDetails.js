import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { 
  FiCpu, FiHardDrive, FiActivity, FiWifi, FiMonitor, 
  FiRefreshCw, FiPower, FiRotateCcw, FiSettings
} from 'react-icons/fi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const DetailsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const ServerHeader = styled.div`
  background: ${props => props.theme.gradients.card};
  padding: 25px;
  border-radius: ${props => props.theme.borderRadius.large};
  border: 1px solid rgba(0, 212, 255, 0.2);
`;

const ServerTitle = styled.h2`
  color: ${props => props.theme.colors.text};
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 10px;
`;

const ServerMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  color: ${props => props.theme.colors.textSecondary};
  font-size: 0.9rem;
`;

const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
`;

const MetricCard = styled(motion.div)`
  background: ${props => props.theme.gradients.card};
  padding: 20px;
  border-radius: ${props => props.theme.borderRadius.large};
  border: 1px solid rgba(0, 212, 255, 0.2);
`;

const MetricHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
`;

const MetricIcon = styled.div`
  color: ${props => props.theme.colors.primary};
  font-size: 1.2rem;
`;

const MetricTitle = styled.h3`
  color: ${props => props.theme.colors.text};
  font-size: 1rem;
  font-weight: 600;
`;

const MetricValue = styled.div`
  font-size: 2rem;
  font-weight: 700;
  color: ${props => props.theme.colors.primary};
  margin-bottom: 10px;
`;

const MetricDescription = styled.div`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 0.9rem;
`;

const ChartContainer = styled.div`
  background: ${props => props.theme.gradients.card};
  padding: 20px;
  border-radius: ${props => props.theme.borderRadius.large};
  border: 1px solid rgba(0, 212, 255, 0.2);
  height: 300px;
`;

const ChartTitle = styled.h3`
  color: ${props => props.theme.colors.text};
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 20px;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
`;

const ActionButton = styled(motion.button)`
  padding: 12px 20px;
  background: ${props => {
    if (props.danger) return 'rgba(255, 71, 87, 0.2)';
    if (props.warning) return 'rgba(255, 165, 2, 0.2)';
    return 'rgba(0, 212, 255, 0.2)';
  }};
  color: ${props => {
    if (props.danger) return props.theme.colors.error;
    if (props.warning) return props.theme.colors.warning;
    return props.theme.colors.primary;
  }};
  border: 1px solid ${props => {
    if (props.danger) return props.theme.colors.error;
    if (props.warning) return props.theme.colors.warning;
    return props.theme.colors.primary;
  }};
  border-radius: ${props => props.theme.borderRadius.medium};
  cursor: pointer;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  
  &:hover {
    background: ${props => {
      if (props.danger) return 'rgba(255, 71, 87, 0.3)';
      if (props.warning) return 'rgba(255, 165, 2, 0.3)';
      return 'rgba(0, 212, 255, 0.3)';
    }};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

function ServerDetails({ server }) {
  const [metrics, setMetrics] = useState({
    cpu: 0,
    memory: 0,
    disk: 0,
    network: 0
  });
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    // Simulate real-time metrics
    const interval = setInterval(() => {
      const newMetrics = {
        cpu: Math.floor(Math.random() * 100),
        memory: Math.floor(Math.random() * 100),
        disk: Math.floor(Math.random() * 100),
        network: Math.floor(Math.random() * 1000)
      };
      
      setMetrics(newMetrics);
      
      const now = new Date();
      const timeString = now.toLocaleTimeString();
      
      setChartData(prev => {
        const newData = [...prev, {
          time: timeString,
          cpu: newMetrics.cpu,
          memory: newMetrics.memory,
          disk: newMetrics.disk
        }];
        
        // Keep only last 20 data points
        return newData.slice(-20);
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleServerAction = (action) => {
    console.log(`Executing ${action} on server ${server.name}`);
    // Implementation would go here
  };

  if (!server) {
    return <div>Select a server to view details</div>;
  }

  return (
    <DetailsContainer>
      <ServerHeader>
        <ServerTitle>{server.name}</ServerTitle>
        <ServerMeta>
          <span>{server.host}:{server.port}</span>
          <span>•</span>
          <span>{server.systemInfo?.os || 'Unknown OS'}</span>
          <span>•</span>
          <span>Uptime: {server.systemInfo?.uptime || 'Unknown'}</span>
        </ServerMeta>
      </ServerHeader>

      <MetricsGrid>
        <MetricCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <MetricHeader>
            <MetricIcon><FiCpu /></MetricIcon>
            <MetricTitle>CPU Usage</MetricTitle>
          </MetricHeader>
          <MetricValue>{metrics.cpu}%</MetricValue>
          <MetricDescription>
            {metrics.cpu > 80 ? 'High usage' : metrics.cpu > 50 ? 'Moderate usage' : 'Low usage'}
          </MetricDescription>
        </MetricCard>

        <MetricCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <MetricHeader>
            <MetricIcon><FiActivity /></MetricIcon>
            <MetricTitle>Memory Usage</MetricTitle>
          </MetricHeader>
          <MetricValue>{metrics.memory}%</MetricValue>
          <MetricDescription>
            {metrics.memory > 80 ? 'High usage' : metrics.memory > 50 ? 'Moderate usage' : 'Low usage'}
          </MetricDescription>
        </MetricCard>

        <MetricCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <MetricHeader>
            <MetricIcon><FiHardDrive /></MetricIcon>
            <MetricTitle>Disk Usage</MetricTitle>
          </MetricHeader>
          <MetricValue>{metrics.disk}%</MetricValue>
          <MetricDescription>
            {metrics.disk > 80 ? 'High usage' : metrics.disk > 50 ? 'Moderate usage' : 'Low usage'}
          </MetricDescription>
        </MetricCard>

        <MetricCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <MetricHeader>
            <MetricIcon><FiWifi /></MetricIcon>
            <MetricTitle>Network I/O</MetricTitle>
          </MetricHeader>
          <MetricValue>{metrics.network}</MetricValue>
          <MetricDescription>KB/s transfer rate</MetricDescription>
        </MetricCard>
      </MetricsGrid>

      <ChartContainer>
        <ChartTitle>Real-time Performance</ChartTitle>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 212, 255, 0.1)" />
            <XAxis 
              dataKey="time" 
              stroke="#a0a0a0"
              fontSize={12}
            />
            <YAxis 
              stroke="#a0a0a0"
              fontSize={12}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: '#1e1e2e',
                border: '1px solid #00d4ff',
                borderRadius: '8px',
                color: '#ffffff'
              }}
            />
            <Line 
              type="monotone" 
              dataKey="cpu" 
              stroke="#00d4ff" 
              strokeWidth={2}
              dot={false}
              name="CPU %"
            />
            <Line 
              type="monotone" 
              dataKey="memory" 
              stroke="#00ff88" 
              strokeWidth={2}
              dot={false}
              name="Memory %"
            />
            <Line 
              type="monotone" 
              dataKey="disk" 
              stroke="#ffa502" 
              strokeWidth={2}
              dot={false}
              name="Disk %"
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>

      <ActionButtons>
        <ActionButton
          onClick={() => handleServerAction('refresh')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <FiRefreshCw />
          Refresh Data
        </ActionButton>

        <ActionButton
          warning
          onClick={() => handleServerAction('reboot')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <FiRotateCcw />
          Reboot Server
        </ActionButton>

        <ActionButton
          danger
          onClick={() => handleServerAction('shutdown')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <FiPower />
          Shutdown
        </ActionButton>

        <ActionButton
          onClick={() => handleServerAction('settings')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <FiSettings />
          Settings
        </ActionButton>
      </ActionButtons>
    </DetailsContainer>
  );
}

export default ServerDetails;
