import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiServer, FiMonitor, FiTerminal, FiFolder, FiGitBranch, FiUsers, FiPlus, FiSettings, FiLogOut, FiMenu, FiX,
  FiActivity, FiHardDrive, FiCpu, FiWifi, FiDownload
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import axios from 'axios';

// Components
import ServerList from './ServerList';
import ServerDetails from './ServerDetails';
import Terminal from './Terminal';
import FileManager from './FileManager';
import ModManager from './ModManager';
import ServerInstaller from './ServerInstaller';
import AgentServerList from './AgentServerList';
import AdminPanel from './AdminPanel';
import MonitoringDashboard from './MonitoringDashboard';
import AddServerModal from './AddServerModal';
import VPSManager from './VPSManager';

const DashboardContainer = styled.div`
  display: flex;
  height: 100vh;
  background: ${props => props.theme.colors.background};
`;

const Sidebar = styled(motion.div)`
  width: ${props => props.collapsed ? '80px' : '280px'};
  background: ${props => props.theme.gradients.card};
  border-right: 1px solid rgba(0, 212, 255, 0.2);
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  position: relative;
  z-index: 100;
`;

const SidebarHeader = styled.div`
  padding: 20px;
  border-bottom: 1px solid rgba(0, 212, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  font-weight: 700;
  color: ${props => props.theme.colors.primary};
  
  span {
    display: ${props => props.collapsed ? 'none' : 'block'};
  }
`;

const CollapseButton = styled.button`
  background: none;
  border: none;
  color: ${props => props.theme.colors.textSecondary};
  cursor: pointer;
  padding: 5px;
  border-radius: 4px;
  
  &:hover {
    color: ${props => props.theme.colors.primary};
    background: rgba(0, 212, 255, 0.1);
  }
`;

const UserInfo = styled.div`
  padding: 20px;
  border-bottom: 1px solid rgba(0, 212, 255, 0.2);
  display: ${props => props.collapsed ? 'none' : 'block'};
`;

const UserName = styled.div`
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  margin-bottom: 5px;
`;

const UserRole = styled.div`
  font-size: 12px;
  color: ${props => props.theme.colors.textSecondary};
  text-transform: uppercase;
  padding: 2px 8px;
  background: ${props => props.theme.colors.primary};
  border-radius: 10px;
  display: inline-block;
`;

const Navigation = styled.nav`
  flex: 1;
  padding: 20px 0;
`;

const NavItem = styled(motion.div)`
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 12px 20px;
  margin: 0 10px;
  border-radius: ${props => props.theme.borderRadius.medium};
  cursor: pointer;
  color: ${props => props.active ? props.theme.colors.primary : props.theme.colors.textSecondary};
  background: ${props => props.active ? 'rgba(0, 212, 255, 0.1)' : 'transparent'};
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(0, 212, 255, 0.1);
    color: ${props => props.theme.colors.primary};
  }
  
  span {
    display: ${props => props.collapsed ? 'none' : 'block'};
    font-weight: 500;
  }
`;

const MainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const TopBar = styled.div`
  height: 70px;
  background: ${props => props.theme.gradients.card};
  border-bottom: 1px solid rgba(0, 212, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30px;
`;

const PageTitle = styled.h1`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
`;

const TopBarActions = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
`;

const ActionButton = styled(motion.button)`
  padding: 10px 20px;
  background: ${props => props.primary ? props.theme.gradients.primary : 'transparent'};
  color: ${props => props.primary ? 'white' : props.theme.colors.textSecondary};
  border: ${props => props.primary ? 'none' : `1px solid ${props.theme.colors.textSecondary}`};
  border-radius: ${props => props.theme.borderRadius.medium};
  cursor: pointer;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  
  &:hover {
    background: ${props => props.primary ? '#0099cc' : 'rgba(0, 212, 255, 0.1)'};
    color: ${props => props.primary ? 'white' : props.theme.colors.primary};
    border-color: ${props => props.theme.colors.primary};
  }
`;

const ContentArea = styled.div`
  flex: 1;
  padding: 30px;
  overflow-y: auto;
  background: ${props => props.theme.colors.background};
`;

const StatsGrid = styled.div`
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
  width: 50px;
  height: 50px;
  background: ${props => props.theme.gradients.primary};
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 20px;
`;

const StatInfo = styled.div`
  flex: 1;
`;

const StatValue = styled.div`
  font-size: 1.8rem;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin-bottom: 5px;
`;

const StatLabel = styled.div`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 0.9rem;
`;

function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('servers');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddServer, setShowAddServer] = useState(false);
  const [stats, setStats] = useState({
    totalServers: 0,
    onlineServers: 0,
    totalUsers: 0,
    activeConnections: 0
  });

  const navigationItems = [
    { id: 'servers', label: 'Серверы', icon: FiServer },
    { id: 'vps', label: 'VPS Manager', icon: FiHardDrive },
    { id: 'agents', label: 'Агенты', icon: FiWifi },
    { id: 'monitoring', label: 'Мониторинг', icon: FiMonitor },
    { id: 'terminal', label: 'SSH Терминал', icon: FiTerminal },
    { id: 'files', label: 'Файловый менеджер', icon: FiFolder },
    { id: 'mods', label: 'MOD', icon: FiGitBranch },
    { id: 'installer', label: 'Установка агента', icon: FiDownload },
    ...(user && user.role === 'ROOT' ? [{ id: 'admin', label: 'Админ панель', icon: FiUsers }] : [])
  ];

  useEffect(() => {
    fetchServers();
    fetchStats();
  }, []);

  const fetchServers = async () => {
    try {
      const token = localStorage.getItem('xpanel_token');
      const response = await axios.get('/api/servers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setServers(response.data);
    } catch (error) {
      toast.error('Failed to fetch servers');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('xpanel_token');
      const [serversRes, usersRes] = await Promise.all([
        axios.get('/api/servers', { headers: { Authorization: `Bearer ${token}` } }),
        user && user.role === 'ROOT' ? axios.get('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }) : Promise.resolve({ data: [] })
      ]);
      
      const serverData = serversRes.data;
      setStats({
        totalServers: serverData.length,
        onlineServers: serverData.filter(s => s.status === 'online').length,
        totalUsers: usersRes.data.length,
        activeConnections: serverData.filter(s => s.status === 'online').length
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleAddServer = async (serverData) => {
    try {
      const token = localStorage.getItem('xpanel_token');
      const response = await axios.post('/api/servers', serverData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setServers(prev => [...prev, response.data]);
      setShowAddServer(false);
      toast.success('Server added successfully!');
      fetchStats();
    } catch (error) {
      toast.error('Failed to add server');
    }
  };

  const getPageTitle = () => {
    switch (activeTab) {
      case 'servers': return 'Управление серверами';
      case 'vps': return 'VPS Manager';
      case 'agents': return 'Агенты мониторинга';
      case 'monitoring': return 'Панель мониторинга';
      case 'terminal': return 'SSH Терминал';
      case 'files': return 'Файловый менеджер';
      case 'mods': return 'MOD Manager';
      case 'installer': return 'Установка агента';
      case 'admin': return 'Админ панель';
      default: return 'Панель управления';
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'servers':
        return <ServerList servers={servers} onRefresh={fetchServers} />;
      case 'vps':
        return <VPSManager user={user} />;
      case 'agents':
        return <AgentServerList />;
      case 'monitoring':
        return <MonitoringDashboard selectedServer={selectedServer} />;
      case 'terminal':
        return <Terminal servers={servers} />;
      case 'files':
        return <FileManager servers={servers} />;
      case 'mods':
        return <ModManager servers={servers} />;
      case 'installer':
        return <ServerInstaller />;
      case 'users':
        return <div>User Management - Coming Soon</div>;
      case 'admin':
        return user && user.role === 'ROOT' ? <div style={{ padding: '20px', color: '#fff' }}>
          <h2>👑 Админ панель</h2>
          <p>Управление пользователями и серверами</p>
        </div> : <Navigate to="/dashboard" />;
      default:
        return <ServerList servers={servers} onRefresh={fetchServers} />;
    }
  };

  return (
    <DashboardContainer>
      <Sidebar collapsed={sidebarCollapsed}>
        <SidebarHeader>
          <Logo collapsed={sidebarCollapsed}>
            <FiServer />
            <span>Xpanel</span>
          </Logo>
          <CollapseButton onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            {sidebarCollapsed ? <FiMenu /> : <FiX />}
          </CollapseButton>
        </SidebarHeader>

        <UserInfo collapsed={sidebarCollapsed}>
          <UserName>{user?.username || 'User'}</UserName>
          <UserRole>{user?.role || 'USER'}</UserRole>
        </UserInfo>

        <Navigation>
          {navigationItems.map((item) => (
            <NavItem
              key={item.id}
              active={activeTab === item.id}
              collapsed={sidebarCollapsed}
              onClick={() => setActiveTab(item.id)}
              whileHover={{ x: 5 }}
              whileTap={{ scale: 0.95 }}
            >
              <item.icon />
              <span>{item.label}</span>
            </NavItem>
          ))}
        </Navigation>

        <NavItem
          collapsed={sidebarCollapsed}
          onClick={onLogout}
          whileHover={{ x: 5 }}
          whileTap={{ scale: 0.95 }}
          style={{ marginTop: 'auto', marginBottom: '20px', color: '#ff4757' }}
        >
          <FiLogOut />
          <span>Выход</span>
        </NavItem>
      </Sidebar>

      <MainContent>
        <TopBar>
          <PageTitle>{getPageTitle()}</PageTitle>
          <TopBarActions>
            {activeTab === 'servers' && (
              <ActionButton
                primary
                onClick={() => setShowAddServer(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <FiPlus />
                Добавить сервер
              </ActionButton>
            )}
          </TopBarActions>
        </TopBar>

        <ContentArea>
          {activeTab === 'servers' && (
            <StatsGrid>
              <StatCard
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <StatIcon><FiServer /></StatIcon>
                <StatInfo>
                  <StatValue>{stats.totalServers}</StatValue>
                  <StatLabel>Всего серверов</StatLabel>
                </StatInfo>
              </StatCard>

              <StatCard
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <StatIcon><FiActivity /></StatIcon>
                <StatInfo>
                  <StatValue>{stats.onlineServers}</StatValue>
                  <StatLabel>Онлайн серверов</StatLabel>
                </StatInfo>
              </StatCard>

              {user && user.role === 'ROOT' && (
                <StatCard
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <StatIcon><FiUsers /></StatIcon>
                  <StatInfo>
                    <StatValue>{stats.totalUsers}</StatValue>
                    <StatLabel>Всего пользователей</StatLabel>
                  </StatInfo>
                </StatCard>
              )}

              <StatCard
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <StatIcon><FiWifi /></StatIcon>
                <StatInfo>
                  <StatValue>{stats.activeConnections}</StatValue>
                  <StatLabel>Активных подключений</StatLabel>
                </StatInfo>
              </StatCard>
            </StatsGrid>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </ContentArea>
      </MainContent>

      <AnimatePresence>
        {showAddServer && (
          <AddServerModal
            onClose={() => setShowAddServer(false)}
            onAdd={handleAddServer}
          />
        )}
      </AnimatePresence>
    </DashboardContainer>
  );
}

export default Dashboard;
