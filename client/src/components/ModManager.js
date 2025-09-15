import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiGitBranch, 
  FiBell, 
  FiSettings, 
  FiDownload, 
  FiServer,
  FiCode,
  FiPackage,
  FiPlay,
  FiStop,
  FiRefreshCw,
  FiTrash2,
  FiEdit3,
  FiPlus
} from 'react-icons/fi';
import GitManager from './GitManager';
import NotificationManager from './NotificationManager';
import toast from 'react-hot-toast';

const ModContainer = styled.div`
  padding: 2rem;
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
  min-height: 100vh;
  color: #ffffff;
`;

const ModHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(0, 212, 255, 0.2);
`;

const ModTitle = styled.h1`
  font-size: 2rem;
  font-weight: bold;
  background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ModTabs = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
`;

const ModTab = styled(motion.button)`
  padding: 1rem 2rem;
  background: ${props => props.active ? 
    'linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)' : 
    'rgba(255, 255, 255, 0.05)'
  };
  color: ${props => props.active ? '#0a0a0a' : '#ffffff'};
  border: 1px solid ${props => props.active ? '#00d4ff' : 'rgba(0, 212, 255, 0.2)'};
  border-radius: 12px;
  cursor: pointer;
  font-weight: ${props => props.active ? 'bold' : 'normal'};
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.3s ease;
  
  &:hover {
    border-color: #00d4ff;
    transform: translateY(-2px);
  }
`;

const ModContent = styled(motion.div)`
  background: rgba(255, 255, 255, 0.02);
  border-radius: 16px;
  border: 1px solid rgba(0, 212, 255, 0.1);
  backdrop-filter: blur(10px);
  overflow: hidden;
`;

const ModSection = styled.div`
  padding: 2rem;
`;

const SectionTitle = styled.h2`
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: #00d4ff;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ModGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

const ModCard = styled(motion.div)`
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  border: 1px solid rgba(0, 212, 255, 0.1);
  padding: 1.5rem;
  transition: all 0.3s ease;
  
  &:hover {
    border-color: rgba(0, 212, 255, 0.3);
    transform: translateY(-5px);
  }
`;

const ModCardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
`;

const ModCardTitle = styled.h3`
  font-size: 1.2rem;
  font-weight: bold;
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ModCardDescription = styled.p`
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 1rem;
  line-height: 1.5;
`;

const ModCardActions = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
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
  color: ${props => ['primary', 'success', 'danger', 'warning'].includes(props.variant) ? '#ffffff' : '#ffffff'};
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
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

const StatusBadge = styled.span`
  padding: 0.3rem 0.8rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: bold;
  background: ${props => {
    switch(props.status) {
      case 'active': return 'linear-gradient(135deg, #00ff88 0%, #00cc66 100%)';
      case 'inactive': return 'rgba(255, 255, 255, 0.2)';
      case 'error': return 'linear-gradient(135deg, #ff4757 0%, #cc3644 100%)';
      case 'installing': return 'linear-gradient(135deg, #ffa502 0%, #cc8400 100%)';
      default: return 'rgba(255, 255, 255, 0.1)';
    }
  }};
  color: #ffffff;
`;

function ModManager({ servers }) {
  const [activeTab, setActiveTab] = useState('git');
  const [installedMods, setInstalledMods] = useState([]);
  const [availableMods, setAvailableMods] = useState([
    {
      id: 'git-manager',
      name: 'Git Manager',
      description: 'Управление Git репозиториями на серверах',
      icon: FiGitBranch,
      status: 'active',
      version: '1.0.0',
      author: 'Xpanel Team'
    },
    {
      id: 'docker-manager',
      name: 'Docker Manager',
      description: 'Управление Docker контейнерами и образами',
      icon: FiPackage,
      status: 'inactive',
      version: '1.2.0',
      author: 'Community'
    },
    {
      id: 'nginx-manager',
      name: 'Nginx Manager',
      description: 'Конфигурация и управление Nginx',
      icon: FiServer,
      status: 'inactive',
      version: '2.1.0',
      author: 'Xpanel Team'
    }
  ]);

  const tabs = [
    { id: 'git', name: 'Git Manager', icon: FiGitBranch },
    { id: 'notifications', name: 'Уведомления', icon: FiBell },
    { id: 'mods', name: 'Модули', icon: FiPackage },
    { id: 'settings', name: 'Настройки', icon: FiSettings }
  ];

  const handleInstallMod = async (modId) => {
    try {
      toast.loading(`Установка модуля ${modId}...`);
      
      // Симуляция установки
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setAvailableMods(prev => 
        prev.map(mod => 
          mod.id === modId 
            ? { ...mod, status: 'active' }
            : mod
        )
      );
      
      toast.success('Модуль успешно установлен!');
    } catch (error) {
      toast.error('Ошибка установки модуля');
    }
  };

  const handleUninstallMod = async (modId) => {
    try {
      toast.loading(`Удаление модуля ${modId}...`);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setAvailableMods(prev => 
        prev.map(mod => 
          mod.id === modId 
            ? { ...mod, status: 'inactive' }
            : mod
        )
      );
      
      toast.success('Модуль удален');
    } catch (error) {
      toast.error('Ошибка удаления модуля');
    }
  };

  const renderTabContent = () => {
    switch(activeTab) {
      case 'git':
        return <GitManager servers={servers} />;
      
      case 'notifications':
        return <NotificationManager />;
      
      case 'mods':
        return (
          <ModSection>
            <SectionTitle>
              <FiPackage />
              Доступные модули
            </SectionTitle>
            <ModGrid>
              {availableMods.map(mod => (
                <ModCard
                  key={mod.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.02 }}
                >
                  <ModCardHeader>
                    <ModCardTitle>
                      <mod.icon />
                      {mod.name}
                    </ModCardTitle>
                    <StatusBadge status={mod.status}>
                      {mod.status === 'active' ? 'Установлен' : 'Не установлен'}
                    </StatusBadge>
                  </ModCardHeader>
                  
                  <ModCardDescription>
                    {mod.description}
                  </ModCardDescription>
                  
                  <div style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>
                    Версия: {mod.version} • Автор: {mod.author}
                  </div>
                  
                  <ModCardActions>
                    {mod.status === 'active' ? (
                      <>
                        <ActionButton variant="success" disabled>
                          <FiPlay />
                          Активен
                        </ActionButton>
                        <ActionButton 
                          variant="danger"
                          onClick={() => handleUninstallMod(mod.id)}
                        >
                          <FiTrash2 />
                          Удалить
                        </ActionButton>
                      </>
                    ) : (
                      <>
                        <ActionButton 
                          variant="primary"
                          onClick={() => handleInstallMod(mod.id)}
                        >
                          <FiDownload />
                          Установить
                        </ActionButton>
                      </>
                    )}
                  </ModCardActions>
                </ModCard>
              ))}
            </ModGrid>
          </ModSection>
        );
      
      case 'settings':
        return (
          <ModSection>
            <SectionTitle>
              <FiSettings />
              Настройки модулей
            </SectionTitle>
            <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
              Настройки модулей будут доступны в следующих версиях
            </div>
          </ModSection>
        );
      
      default:
        return null;
    }
  };

  return (
    <ModContainer>
      <ModHeader>
        <ModTitle>
          <FiCode />
          MOD Manager
        </ModTitle>
        <ActionButton variant="primary">
          <FiPlus />
          Добавить модуль
        </ActionButton>
      </ModHeader>

      <ModTabs>
        {tabs.map(tab => (
          <ModTab
            key={tab.id}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <tab.icon />
            {tab.name}
          </ModTab>
        ))}
      </ModTabs>

      <ModContent
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        key={activeTab}
      >
        <AnimatePresence mode="wait">
          {renderTabContent()}
        </AnimatePresence>
      </ModContent>
    </ModContainer>
  );
}

export default ModManager;
