import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { 
  FiUsers, FiServer, FiActivity, FiSettings, FiTrash2, 
  FiEdit, FiPlus, FiRefreshCw, FiEye, FiBarChart2, FiLock, FiShield
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import axios from 'axios';

const AdminContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 30px;
`;

const StatsOverview = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
`;

const StatCard = styled(motion.div)`
  background: ${props => props.theme.gradients.card};
  padding: 25px;
  border-radius: ${props => props.theme.borderRadius.large};
  border: 1px solid rgba(0, 212, 255, 0.2);
  display: flex;
  align-items: center;
  gap: 20px;
`;

const StatIcon = styled.div`
  width: 60px;
  height: 60px;
  background: ${props => props.theme.gradients.primary};
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 24px;
`;

const StatInfo = styled.div`
  flex: 1;
`;

const StatValue = styled.div`
  font-size: 2rem;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin-bottom: 5px;
`;

const StatLabel = styled.div`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 0.9rem;
`;

const TabContainer = styled.div`
  display: flex;
  gap: 5px;
  margin-bottom: 30px;
`;

const Tab = styled(motion.button)`
  padding: 12px 20px;
  background: ${props => props.active ? props.theme.gradients.primary : 'transparent'};
  color: ${props => props.active ? 'white' : props.theme.colors.textSecondary};
  border: 1px solid ${props => props.active ? props.theme.colors.primary : 'rgba(0, 212, 255, 0.3)'};
  border-radius: ${props => props.theme.borderRadius.medium};
  cursor: pointer;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  
  &:hover {
    background: ${props => props.active ? props.theme.gradients.primary : 'rgba(0, 212, 255, 0.1)'};
    color: ${props => props.active ? 'white' : props.theme.colors.primary};
  }
`;

const TableContainer = styled.div`
  background: ${props => props.theme.gradients.card};
  border-radius: ${props => props.theme.borderRadius.large};
  border: 1px solid rgba(0, 212, 255, 0.2);
  overflow: hidden;
`;

const TableHeader = styled.div`
  padding: 20px;
  border-bottom: 1px solid rgba(0, 212, 255, 0.2);
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const TableTitle = styled.h3`
  color: ${props => props.theme.colors.text};
  font-size: 1.2rem;
  font-weight: 600;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const TableHead = styled.thead`
  background: rgba(30, 30, 46, 0.5);
`;

const TableRow = styled.tr`
  border-bottom: 1px solid rgba(0, 212, 255, 0.1);
  
  &:hover {
    background: rgba(0, 212, 255, 0.05);
  }
`;

const TableHeader2 = styled.th`
  padding: 15px 20px;
  text-align: left;
  color: ${props => props.theme.colors.textSecondary};
  font-weight: 600;
  font-size: 0.9rem;
  text-transform: uppercase;
`;

const TableCell = styled.td`
  padding: 15px 20px;
  color: ${props => props.theme.colors.text};
  font-size: 0.9rem;
`;

const StatusBadge = styled.div`
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  display: inline-block;
  
  ${props => {
    switch (props.status) {
      case 'active':
      case 'online':
        return `
          background: rgba(0, 255, 136, 0.2);
          color: ${props.theme.colors.success};
        `;
      case 'blocked':
      case 'offline':
        return `
          background: rgba(255, 71, 87, 0.2);
          color: ${props.theme.colors.error};
        `;
      case 'ROOT':
        return `
          background: rgba(255, 165, 2, 0.2);
          color: ${props.theme.colors.warning};
        `;
      default:
        return `
          background: rgba(0, 212, 255, 0.2);
          color: ${props.theme.colors.primary};
        `;
    }
  }}
`;

const ActionButton = styled(motion.button)`
  padding: 6px 12px;
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
  border-radius: ${props => props.theme.borderRadius.small};
  cursor: pointer;
  font-size: 0.8rem;
  margin-right: 5px;
  
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

function AdminPanel() {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalServers: 0,
    onlineServers: 0
  });

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('xpanel_token');
      const [usersRes, serversRes] = await Promise.all([
        axios.get('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/admin/servers', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      setUsers(usersRes.data);
      setServers(serversRes.data);
      
      setStats({
        totalUsers: usersRes.data.length,
        activeUsers: usersRes.data.filter(u => u.status !== 'blocked').length,
        totalServers: serversRes.data.length,
        onlineServers: serversRes.data.filter(s => s.status === 'online').length
      });
    } catch (error) {
      toast.error('Failed to fetch admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleUserAction = async (userId, action) => {
    try {
      const token = localStorage.getItem('xpanel_token');
      await axios.post(`/api/admin/users/${userId}/${action}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`User ${action} successfully`);
      fetchAdminData();
    } catch (error) {
      toast.error(`Failed to ${action} user`);
    }
  };

  const handleServerAction = async (serverId, action) => {
    try {
      const token = localStorage.getItem('xpanel_token');
      await axios.post(`/api/admin/servers/${serverId}/${action}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Server ${action} successfully`);
      fetchAdminData();
    } catch (error) {
      toast.error(`Failed to ${action} server`);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <AdminContainer>
      <StatsOverview>
        <StatCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <StatIcon><FiUsers /></StatIcon>
          <StatInfo>
            <StatValue>{stats.totalUsers}</StatValue>
            <StatLabel>Total Users</StatLabel>
          </StatInfo>
        </StatCard>

        <StatCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <StatIcon><FiActivity /></StatIcon>
          <StatInfo>
            <StatValue>{stats.activeUsers}</StatValue>
            <StatLabel>Active Users</StatLabel>
          </StatInfo>
        </StatCard>

        <StatCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <StatIcon><FiServer /></StatIcon>
          <StatInfo>
            <StatValue>{stats.totalServers}</StatValue>
            <StatLabel>Total Servers</StatLabel>
          </StatInfo>
        </StatCard>

        <StatCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <StatIcon><FiBarChart2 /></StatIcon>
          <StatInfo>
            <StatValue>{stats.onlineServers}</StatValue>
            <StatLabel>Online Servers</StatLabel>
          </StatInfo>
        </StatCard>
      </StatsOverview>

      <TabContainer>
        <Tab
          active={activeTab === 'users'}
          onClick={() => setActiveTab('users')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <FiUsers />
          Users Management
        </Tab>
        <Tab
          active={activeTab === 'servers'}
          onClick={() => setActiveTab('servers')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <FiServer />
          Servers Overview
        </Tab>
      </TabContainer>

      {activeTab === 'users' && (
        <TableContainer>
          <TableHeader>
            <TableTitle>Users Management</TableTitle>
          </TableHeader>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader2>Username</TableHeader2>
                <TableHeader2>Email</TableHeader2>
                <TableHeader2>Role</TableHeader2>
                <TableHeader2>Servers</TableHeader2>
                <TableHeader2>Created</TableHeader2>
                <TableHeader2>Status</TableHeader2>
                <TableHeader2>Actions</TableHeader2>
              </TableRow>
            </TableHead>
            <tbody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <StatusBadge status={user.role}>{user.role}</StatusBadge>
                  </TableCell>
                  <TableCell>{user.serverCount}</TableCell>
                  <TableCell>{formatDate(user.createdAt)}</TableCell>
                  <TableCell>
                    <StatusBadge status={user.status || 'active'}>
                      {user.status || 'active'}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <ActionButton
                      onClick={() => handleUserAction(user.id, 'view')}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <FiEye />
                    </ActionButton>
                    {user.role !== 'ROOT' && (
                      <>
                        <ActionButton
                          warning
                          onClick={() => handleUserAction(user.id, 'block')}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <FiLock />
                        </ActionButton>
                        <ActionButton
                          danger
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete user ${user.username}?`)) {
                              handleUserAction(user.id, 'delete');
                            }
                          }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <FiTrash2 />
                        </ActionButton>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        </TableContainer>
      )}

      {activeTab === 'servers' && (
        <TableContainer>
          <TableHeader>
            <TableTitle>Servers Overview</TableTitle>
          </TableHeader>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader2>Server Name</TableHeader2>
                <TableHeader2>Owner</TableHeader2>
                <TableHeader2>Host</TableHeader2>
                <TableHeader2>Status</TableHeader2>
                <TableHeader2>OS</TableHeader2>
                <TableHeader2>Added</TableHeader2>
                <TableHeader2>Actions</TableHeader2>
              </TableRow>
            </TableHead>
            <tbody>
              {servers.map((server) => (
                <TableRow key={server.id}>
                  <TableCell>{server.name}</TableCell>
                  <TableCell>{server.ownerUsername}</TableCell>
                  <TableCell>{server.host}:{server.port}</TableCell>
                  <TableCell>
                    <StatusBadge status={server.status}>{server.status}</StatusBadge>
                  </TableCell>
                  <TableCell>{server.systemInfo?.os || 'Unknown'}</TableCell>
                  <TableCell>{formatDate(server.createdAt)}</TableCell>
                  <TableCell>
                    <ActionButton
                      onClick={() => handleServerAction(server.id, 'view')}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <FiEye />
                    </ActionButton>
                    <ActionButton
                      warning
                      onClick={() => handleServerAction(server.id, 'block')}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <FiShield />
                    </ActionButton>
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        </TableContainer>
      )}
    </AdminContainer>
  );
}

export default AdminPanel;
