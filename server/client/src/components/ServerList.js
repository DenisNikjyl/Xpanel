import React, { useState } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { 
  FiServer, FiActivity, FiCpu, FiHardDrive, FiWifi, 
  FiTrash2, FiRefreshCw, FiMoreVertical, FiPlay, FiPause
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import axios from 'axios';

const ServerGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
`;

const ServerCard = styled(motion.div)`
  background: ${props => props.theme.gradients.card};
  border-radius: ${props => props.theme.borderRadius.large};
  border: 1px solid rgba(0, 212, 255, 0.2);
  padding: 25px;
  position: relative;
  overflow: hidden;
  
  &:hover {
    border-color: rgba(0, 212, 255, 0.4);
    box-shadow: ${props => props.theme.shadows.medium};
  }
`;

const ServerHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
`;

const ServerInfo = styled.div`
  flex: 1;
`;

const ServerName = styled.h3`
  color: ${props => props.theme.colors.text};
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 5px;
`;

const ServerHost = styled.p`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 0.9rem;
  font-family: 'Courier New', monospace;
`;

const StatusBadge = styled.div`
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  
  ${props => {
    switch (props.status) {
      case 'online':
        return `
          background: rgba(0, 255, 136, 0.2);
          color: ${props.theme.colors.success};
        `;
      case 'offline':
        return `
          background: rgba(255, 71, 87, 0.2);
          color: ${props.theme.colors.error};
        `;
      case 'connecting':
        return `
          background: rgba(255, 165, 2, 0.2);
          color: ${props.theme.colors.warning};
        `;
      default:
        return `
          background: rgba(160, 160, 160, 0.2);
          color: ${props.theme.colors.textSecondary};
        `;
    }
  }}
`;

const ServerStats = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-bottom: 20px;
`;

const StatItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${props => props.theme.colors.textSecondary};
  font-size: 0.9rem;
`;

const StatIcon = styled.div`
  color: ${props => props.theme.colors.primary};
`;

const ServerActions = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 20px;
`;

const ActionButton = styled(motion.button)`
  flex: 1;
  padding: 8px 16px;
  background: ${props => props.danger ? 'rgba(255, 71, 87, 0.2)' : 'rgba(0, 212, 255, 0.2)'};
  color: ${props => props.danger ? props.theme.colors.error : props.theme.colors.primary};
  border: 1px solid ${props => props.danger ? props.theme.colors.error : props.theme.colors.primary};
  border-radius: ${props => props.theme.borderRadius.medium};
  cursor: pointer;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  
  &:hover {
    background: ${props => props.danger ? 'rgba(255, 71, 87, 0.3)' : 'rgba(0, 212, 255, 0.3)'};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: ${props => props.theme.colors.textSecondary};
`;

const EmptyIcon = styled.div`
  font-size: 4rem;
  margin-bottom: 20px;
  opacity: 0.5;
`;

const EmptyTitle = styled.h3`
  font-size: 1.5rem;
  margin-bottom: 10px;
  color: ${props => props.theme.colors.text};
`;

const EmptyDescription = styled.p`
  font-size: 1rem;
  line-height: 1.6;
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px;
  
  &::after {
    content: '';
    width: 40px;
    height: 40px;
    border: 3px solid rgba(0, 212, 255, 0.3);
    border-top: 3px solid ${props => props.theme.colors.primary};
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

function ServerList({ servers, onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  const handleRefresh = async () => {
    setLoading(true);
    await onRefresh();
    setLoading(false);
    toast.success('Servers refreshed');
  };

  const handleDeleteServer = async (serverId) => {
    if (!window.confirm('Are you sure you want to remove this server?')) {
      return;
    }

    setActionLoading(prev => ({ ...prev, [serverId]: true }));
    
    try {
      const token = localStorage.getItem('xpanel_token');
      await axios.delete(`/api/servers/${serverId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Server removed successfully');
      onRefresh();
    } catch (error) {
      toast.error('Failed to remove server');
    } finally {
      setActionLoading(prev => ({ ...prev, [serverId]: false }));
    }
  };

  const handleServerAction = async (serverId, action) => {
    setActionLoading(prev => ({ ...prev, [`${serverId}-${action}`]: true }));
    
    try {
      const token = localStorage.getItem('xpanel_token');
      await axios.post(`/api/servers/${serverId}/${action}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Server ${action} initiated`);
      setTimeout(() => onRefresh(), 2000);
    } catch (error) {
      toast.error(`Failed to ${action} server`);
    } finally {
      setActionLoading(prev => ({ ...prev, [`${serverId}-${action}`]: false }));
    }
  };

  const getUptimeDisplay = (lastSeen) => {
    if (!lastSeen) return 'Unknown';
    
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffMs = now - lastSeenDate;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (loading && servers.length === 0) {
    return <LoadingSpinner />;
  }

  if (servers.length === 0) {
    return (
      <EmptyState>
        <EmptyIcon>
          <FiServer />
        </EmptyIcon>
        <EmptyTitle>No servers added yet</EmptyTitle>
        <EmptyDescription>
          Get started by adding your first VPS server.<br />
          Click the "Add Server" button to begin.
        </EmptyDescription>
      </EmptyState>
    );
  }

  return (
    <ServerGrid>
      {servers.map((server, index) => (
        <ServerCard
          key={server.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          whileHover={{ y: -5 }}
        >
          <ServerHeader>
            <ServerInfo>
              <ServerName>{server.name}</ServerName>
              <ServerHost>{server.host}:{server.port}</ServerHost>
            </ServerInfo>
            <StatusBadge status={server.status}>
              {server.status}
            </StatusBadge>
          </ServerHeader>

          <ServerStats>
            <StatItem>
              <StatIcon><FiActivity /></StatIcon>
              <span>Uptime: {getUptimeDisplay(server.lastSeen)}</span>
            </StatItem>
            <StatItem>
              <StatIcon><FiCpu /></StatIcon>
              <span>CPU: {server.systemInfo?.cpu || 'N/A'}</span>
            </StatItem>
            <StatItem>
              <StatIcon><FiHardDrive /></StatIcon>
              <span>Disk: {server.systemInfo?.disk || 'N/A'}</span>
            </StatItem>
            <StatItem>
              <StatIcon><FiWifi /></StatIcon>
              <span>Agent: {server.agentPort}</span>
            </StatItem>
          </ServerStats>

          {server.systemInfo?.os && (
            <StatItem style={{ marginBottom: '15px' }}>
              <StatIcon><FiServer /></StatIcon>
              <span>{server.systemInfo.os}</span>
            </StatItem>
          )}

          <ServerActions>
            <ActionButton
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleServerAction(server.id, 'reboot')}
              disabled={actionLoading[`${server.id}-reboot`] || server.status !== 'online'}
            >
              <FiRefreshCw />
              Reboot
            </ActionButton>
            
            <ActionButton
              danger
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleDeleteServer(server.id)}
              disabled={actionLoading[server.id]}
            >
              <FiTrash2 />
              Remove
            </ActionButton>
          </ServerActions>
        </ServerCard>
      ))}
    </ServerGrid>
  );
}

export default ServerList;
