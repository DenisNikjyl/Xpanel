import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { 
  FiBell, 
  FiSettings, 
  FiUser, 
  FiCpu, 
  FiHardDrive, 
  FiActivity,
  FiShield,
  FiCheck,
  FiX,
  FiRefreshCw,
  FiLink,
  FiCopy
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import axios from 'axios';

const NotificationContainer = styled.div`
  padding: 2rem;
`;

const NotificationGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 2rem;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const NotificationCard = styled(motion.div)`
  background: rgba(255, 255, 255, 0.03);
  border-radius: 16px;
  border: 1px solid rgba(0, 212, 255, 0.1);
  padding: 2rem;
  backdrop-filter: blur(10px);
`;

const CardTitle = styled.h3`
  font-size: 1.3rem;
  font-weight: bold;
  color: #00d4ff;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const TelegramSection = styled.div`
  margin-bottom: 2rem;
`;

const TelegramStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: ${props => props.connected ? 
    'rgba(0, 255, 136, 0.1)' : 
    'rgba(255, 71, 87, 0.1)'
  };
  border: 1px solid ${props => props.connected ? 
    'rgba(0, 255, 136, 0.3)' : 
    'rgba(255, 71, 87, 0.3)'
  };
  border-radius: 12px;
  margin-bottom: 1rem;
`;

const StatusIcon = styled.div`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: ${props => props.connected ? '#00ff88' : '#ff4757'};
`;

const StatusText = styled.div`
  color: ${props => props.connected ? '#00ff88' : '#ff4757'};
  font-weight: 500;
`;

const BindingCode = styled.div`
  background: rgba(0, 212, 255, 0.1);
  border: 1px solid rgba(0, 212, 255, 0.3);
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
  margin: 1rem 0;
`;

const CodeDisplay = styled.div`
  font-size: 2rem;
  font-weight: bold;
  font-family: 'Courier New', monospace;
  color: #00d4ff;
  letter-spacing: 0.2em;
  margin: 1rem 0;
`;

const CodeTimer = styled.div`
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
`;

const ThresholdSettings = styled.div`
  margin-bottom: 2rem;
`;

const ThresholdItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  margin-bottom: 0.5rem;
`;

const ThresholdLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #ffffff;
`;

const ThresholdInput = styled.input`
  width: 80px;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(0, 212, 255, 0.3);
  border-radius: 6px;
  color: #ffffff;
  text-align: center;
  
  &:focus {
    outline: none;
    border-color: #00d4ff;
  }
`;

const ActionButton = styled(motion.button)`
  padding: 0.8rem 1.5rem;
  background: ${props => {
    switch(props.variant) {
      case 'primary': return 'linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)';
      case 'success': return 'linear-gradient(135deg, #00ff88 0%, #00cc66 100%)';
      case 'danger': return 'linear-gradient(135deg, #ff4757 0%, #cc3644 100%)';
      default: return 'rgba(255, 255, 255, 0.1)';
    }
  }};
  color: #ffffff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.5rem;
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

const NotificationHistory = styled.div`
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid rgba(0, 212, 255, 0.1);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.2);
`;

const NotificationItem = styled.div`
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  gap: 1rem;
  
  &:last-child {
    border-bottom: none;
  }
`;

const NotificationIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: ${props => {
    switch(props.type) {
      case 'cpu': return 'linear-gradient(135deg, #ff4757 0%, #cc3644 100%)';
      case 'memory': return 'linear-gradient(135deg, #ffa502 0%, #cc8400 100%)';
      case 'login': return 'linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)';
      default: return 'rgba(255, 255, 255, 0.1)';
    }
  }};
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
`;

const NotificationContent = styled.div`
  flex: 1;
`;

const NotificationText = styled.div`
  color: #ffffff;
  margin-bottom: 0.3rem;
`;

const NotificationTime = styled.div`
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.8rem;
`;

function NotificationManager() {
  const [telegramStatus, setTelegramStatus] = useState({ connected: false });
  const [bindingCode, setBindingCode] = useState(null);
  const [codeExpiry, setCodeExpiry] = useState(null);
  const [thresholds, setThresholds] = useState({
    cpu: 80,
    memory: 80,
    disk: 90
  });
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: 'cpu',
      message: 'Высокая нагрузка CPU на сервере web-01',
      time: '2 минуты назад',
      server: 'web-01'
    },
    {
      id: 2,
      type: 'login',
      message: 'Успешный вход пользователя admin',
      time: '5 минут назад',
      server: 'db-01'
    },
    {
      id: 3,
      type: 'memory',
      message: 'Использование RAM превысило 85%',
      time: '10 минут назад',
      server: 'app-01'
    }
  ]);

  useEffect(() => {
    checkTelegramStatus();
  }, []);

  useEffect(() => {
    let timer;
    if (codeExpiry) {
      timer = setInterval(() => {
        const now = Date.now();
        if (now >= codeExpiry) {
          setBindingCode(null);
          setCodeExpiry(null);
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [codeExpiry]);

  const checkTelegramStatus = async () => {
    try {
      const token = localStorage.getItem('xpanel_token');
      const response = await axios.get('/api/telegram/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setTelegramStatus(response.data);
    } catch (error) {
      console.error('Ошибка проверки статуса Telegram:', error);
    }
  };

  const generateBindingCode = async () => {
    try {
      const token = localStorage.getItem('xpanel_token');
      const response = await axios.post('/api/telegram/generate-code', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setBindingCode(response.data.code);
      setCodeExpiry(Date.now() + (response.data.expiresIn * 1000));
      
      toast.success('Код привязки сгенерирован!');
    } catch (error) {
      toast.error('Ошибка генерации кода');
    }
  };

  const copyCodeToClipboard = () => {
    if (bindingCode) {
      navigator.clipboard.writeText(bindingCode);
      toast.success('Код скопирован в буфер обмена');
    }
  };

  const unbindTelegram = async () => {
    try {
      const token = localStorage.getItem('xpanel_token');
      await axios.post('/api/telegram/unbind', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setTelegramStatus({ connected: false });
      toast.success('Telegram отвязан');
    } catch (error) {
      toast.error('Ошибка отвязки Telegram');
    }
  };

  const updateThreshold = (type, value) => {
    setThresholds(prev => ({
      ...prev,
      [type]: parseInt(value) || 0
    }));
  };

  const saveThresholds = async () => {
    try {
      // Здесь будет API вызов для сохранения порогов
      toast.success('Пороги уведомлений сохранены');
    } catch (error) {
      toast.error('Ошибка сохранения настроек');
    }
  };

  const getTimeRemaining = () => {
    if (!codeExpiry) return '';
    
    const remaining = Math.max(0, Math.floor((codeExpiry - Date.now()) / 1000));
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getNotificationIcon = (type) => {
    switch(type) {
      case 'cpu': return FiCpu;
      case 'memory': return FiHardDrive;
      case 'login': return FiShield;
      default: return FiBell;
    }
  };

  return (
    <NotificationContainer>
      <NotificationGrid>
        {/* Telegram Integration */}
        <NotificationCard
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <CardTitle>
            <FiBell />
            Telegram Уведомления
          </CardTitle>
          
          <TelegramSection>
            <TelegramStatus connected={telegramStatus.bound}>
              <StatusIcon connected={telegramStatus.bound} />
              <StatusText connected={telegramStatus.bound}>
                {telegramStatus.bound ? 
                  `Подключен: @${telegramStatus.telegramUsername}` : 
                  'Не подключен'
                }
              </StatusText>
            </TelegramStatus>
            
            {!telegramStatus.bound ? (
              <>
                {!bindingCode ? (
                  <ActionButton 
                    variant="primary" 
                    onClick={generateBindingCode}
                  >
                    <FiLink />
                    Привязать Telegram
                  </ActionButton>
                ) : (
                  <BindingCode>
                    <div style={{ marginBottom: '1rem', color: 'rgba(255,255,255,0.8)' }}>
                      Отправьте этот код боту @XpanelBot в Telegram:
                    </div>
                    <CodeDisplay>{bindingCode}</CodeDisplay>
                    <CodeTimer>
                      Код действителен: {getTimeRemaining()}
                    </CodeTimer>
                    <ActionButton 
                      variant="secondary" 
                      onClick={copyCodeToClipboard}
                      style={{ marginTop: '1rem' }}
                    >
                      <FiCopy />
                      Копировать код
                    </ActionButton>
                  </BindingCode>
                )}
                
                <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>
                  📱 Найдите бота по имени @XpanelBot в Telegram и отправьте команду /start
                </div>
              </>
            ) : (
              <ActionButton 
                variant="danger" 
                onClick={unbindTelegram}
              >
                <FiX />
                Отвязать Telegram
              </ActionButton>
            )}
          </TelegramSection>
        </NotificationCard>

        {/* Threshold Settings */}
        <NotificationCard
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <CardTitle>
            <FiSettings />
            Пороги уведомлений
          </CardTitle>
          
          <ThresholdSettings>
            <ThresholdItem>
              <ThresholdLabel>
                <FiCpu />
                Загрузка CPU (%)
              </ThresholdLabel>
              <ThresholdInput
                type="number"
                min="1"
                max="100"
                value={thresholds.cpu}
                onChange={(e) => updateThreshold('cpu', e.target.value)}
              />
            </ThresholdItem>
            
            <ThresholdItem>
              <ThresholdLabel>
                <FiHardDrive />
                Использование RAM (%)
              </ThresholdLabel>
              <ThresholdInput
                type="number"
                min="1"
                max="100"
                value={thresholds.memory}
                onChange={(e) => updateThreshold('memory', e.target.value)}
              />
            </ThresholdItem>
            
            <ThresholdItem>
              <ThresholdLabel>
                <FiActivity />
                Заполнение диска (%)
              </ThresholdLabel>
              <ThresholdInput
                type="number"
                min="1"
                max="100"
                value={thresholds.disk}
                onChange={(e) => updateThreshold('disk', e.target.value)}
              />
            </ThresholdItem>
          </ThresholdSettings>
          
          <ActionButton variant="success" onClick={saveThresholds}>
            <FiCheck />
            Сохранить настройки
          </ActionButton>
        </NotificationCard>
      </NotificationGrid>

      {/* Notification History */}
      <NotificationCard
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <CardTitle>
          <FiBell />
          История уведомлений
        </CardTitle>
        
        <NotificationHistory>
          {notifications.map(notification => {
            const IconComponent = getNotificationIcon(notification.type);
            return (
              <NotificationItem key={notification.id}>
                <NotificationIcon type={notification.type}>
                  <IconComponent />
                </NotificationIcon>
                <NotificationContent>
                  <NotificationText>{notification.message}</NotificationText>
                  <NotificationTime>
                    {notification.server} • {notification.time}
                  </NotificationTime>
                </NotificationContent>
              </NotificationItem>
            );
          })}
        </NotificationHistory>
      </NotificationCard>
    </NotificationContainer>
  );
}

export default NotificationManager;
