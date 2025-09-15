import React, { useState } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { 
  FiServer, 
  FiDownload, 
  FiCopy, 
  FiTerminal,
  FiCheck,
  FiX,
  FiLoader,
  FiKey,
  FiGlobe,
  FiUser
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import axios from 'axios';

const InstallerContainer = styled.div`
  padding: 2rem;
`;

const InstallerCard = styled(motion.div)`
  background: rgba(255, 255, 255, 0.03);
  border-radius: 16px;
  border: 1px solid rgba(0, 212, 255, 0.1);
  padding: 2rem;
  margin-bottom: 2rem;
  backdrop-filter: blur(10px);
`;

const CardTitle = styled.h3`
  font-size: 1.5rem;
  font-weight: bold;
  color: #00d4ff;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const StepContainer = styled.div`
  margin-bottom: 2rem;
`;

const StepTitle = styled.h4`
  font-size: 1.2rem;
  color: #ffffff;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const StepNumber = styled.div`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
  color: #0a0a0a;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.9rem;
`;

const CodeBlock = styled.div`
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(0, 212, 255, 0.3);
  border-radius: 8px;
  padding: 1rem;
  font-family: 'Courier New', monospace;
  color: #00ff88;
  margin: 1rem 0;
  position: relative;
  overflow-x: auto;
`;

const CopyButton = styled(motion.button)`
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  padding: 0.5rem;
  background: rgba(0, 212, 255, 0.2);
  border: 1px solid rgba(0, 212, 255, 0.3);
  border-radius: 6px;
  color: #00d4ff;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8rem;
  
  &:hover {
    background: rgba(0, 212, 255, 0.3);
  }
`;

const FormGroup = styled.div`
  margin-bottom: 1.5rem;
`;

const Label = styled.label`
  display: block;
  color: #ffffff;
  margin-bottom: 0.5rem;
  font-weight: 500;
`;

const Input = styled.input`
  width: 100%;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(0, 212, 255, 0.3);
  border-radius: 8px;
  color: #ffffff;
  font-size: 1rem;
  
  &::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }
  
  &:focus {
    outline: none;
    border-color: #00d4ff;
    box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.1);
  }
`;

const ActionButton = styled(motion.button)`
  padding: 1rem 2rem;
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
  font-weight: 600;
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

const InstallationStatus = styled.div`
  padding: 1rem;
  border-radius: 8px;
  margin: 1rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: ${props => {
    switch(props.status) {
      case 'success': return 'rgba(0, 255, 136, 0.1)';
      case 'error': return 'rgba(255, 71, 87, 0.1)';
      case 'loading': return 'rgba(255, 165, 2, 0.1)';
      default: return 'rgba(255, 255, 255, 0.05)';
    }
  }};
  border: 1px solid ${props => {
    switch(props.status) {
      case 'success': return 'rgba(0, 255, 136, 0.3)';
      case 'error': return 'rgba(255, 71, 87, 0.3)';
      case 'loading': return 'rgba(255, 165, 2, 0.3)';
      default: return 'rgba(255, 255, 255, 0.1)';
    }
  }};
  color: ${props => {
    switch(props.status) {
      case 'success': return '#00ff88';
      case 'error': return '#ff4757';
      case 'loading': return '#ffa502';
      default: return '#ffffff';
    }
  }};
`;

function ServerInstaller() {
  const [serverInfo, setServerInfo] = useState({
    hostname: '',
    ip: '',
    username: 'root',
    password: '',
    sshKey: ''
  });
  const [apiKey, setApiKey] = useState('');
  const [installationStatus, setInstallationStatus] = useState(null);
  const [isInstalling, setIsInstalling] = useState(false);

  const generateApiKey = async () => {
    try {
      // Генерируем случайный API ключ
      const key = Array.from({length: 32}, () => 
        Math.random().toString(36)[2] || '0'
      ).join('');
      setApiKey(key);
      toast.success('API ключ сгенерирован');
    } catch (error) {
      toast.error('Ошибка генерации ключа');
    }
  };

  const copyToClipboard = (text, message = 'Скопировано в буфер обмена') => {
    navigator.clipboard.writeText(text);
    toast.success(message);
  };

  const installAgent = async () => {
    if (!serverInfo.ip || !serverInfo.username || (!serverInfo.password && !serverInfo.sshKey)) {
      toast.error('Заполните все обязательные поля');
      return;
    }

    if (!apiKey) {
      toast.error('Сгенерируйте API ключ');
      return;
    }

    setIsInstalling(true);
    setInstallationStatus({ status: 'loading', message: 'Подключение к серверу...' });

    try {
      // Симуляция установки агента
      await new Promise(resolve => setTimeout(resolve, 2000));
      setInstallationStatus({ status: 'loading', message: 'Установка зависимостей...' });
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      setInstallationStatus({ status: 'loading', message: 'Настройка агента...' });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      setInstallationStatus({ status: 'loading', message: 'Запуск сервиса...' });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      setInstallationStatus({ 
        status: 'success', 
        message: 'Агент успешно установлен! Сервер появится в панели через 1-2 минуты.' 
      });

      // Очищаем форму
      setServerInfo({
        hostname: '',
        ip: '',
        username: 'root',
        password: '',
        sshKey: ''
      });
      setApiKey('');

    } catch (error) {
      setInstallationStatus({ 
        status: 'error', 
        message: 'Ошибка установки агента. Проверьте данные подключения.' 
      });
    } finally {
      setIsInstalling(false);
    }
  };

  const manualInstallScript = `#!/bin/bash
# Автоустановка Xpanel Agent
curl -sSL http://64.188.70.12/api/agent/install-script | bash`;

  const wgetInstallScript = `wget -O - http://64.188.70.12/api/agent/install-script | bash`;

  return (
    <InstallerContainer>
      {/* Автоматическая установка */}
      <InstallerCard
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <CardTitle>
          <FiServer />
          Автоматическая установка агента
        </CardTitle>

        <FormGroup>
          <Label>Hostname сервера</Label>
          <Input
            type="text"
            placeholder="web-server-01"
            value={serverInfo.hostname}
            onChange={(e) => setServerInfo({...serverInfo, hostname: e.target.value})}
          />
        </FormGroup>

        <FormGroup>
          <Label>IP адрес сервера *</Label>
          <Input
            type="text"
            placeholder="192.168.1.100"
            value={serverInfo.ip}
            onChange={(e) => setServerInfo({...serverInfo, ip: e.target.value})}
          />
        </FormGroup>

        <FormGroup>
          <Label>Пользователь SSH *</Label>
          <Input
            type="text"
            placeholder="root"
            value={serverInfo.username}
            onChange={(e) => setServerInfo({...serverInfo, username: e.target.value})}
          />
        </FormGroup>

        <FormGroup>
          <Label>Пароль SSH</Label>
          <Input
            type="password"
            placeholder="Пароль для SSH подключения"
            value={serverInfo.password}
            onChange={(e) => setServerInfo({...serverInfo, password: e.target.value})}
          />
        </FormGroup>

        <FormGroup>
          <Label>SSH ключ (альтернатива паролю)</Label>
          <Input
            type="text"
            placeholder="Путь к приватному SSH ключу"
            value={serverInfo.sshKey}
            onChange={(e) => setServerInfo({...serverInfo, sshKey: e.target.value})}
          />
        </FormGroup>

        <FormGroup>
          <Label>API ключ для агента</Label>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Input
              type="text"
              placeholder="Сгенерируйте API ключ"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{ flex: 1 }}
            />
            <ActionButton variant="primary" onClick={generateApiKey}>
              <FiKey />
              Генерировать
            </ActionButton>
          </div>
        </FormGroup>

        {installationStatus && (
          <InstallationStatus status={installationStatus.status}>
            {installationStatus.status === 'loading' && <FiLoader className="animate-spin" />}
            {installationStatus.status === 'success' && <FiCheck />}
            {installationStatus.status === 'error' && <FiX />}
            {installationStatus.message}
          </InstallationStatus>
        )}

        <ActionButton 
          variant="success" 
          onClick={installAgent}
          disabled={isInstalling}
        >
          {isInstalling ? <FiLoader className="animate-spin" /> : <FiDownload />}
          {isInstalling ? 'Установка...' : 'Установить агент'}
        </ActionButton>
      </InstallerCard>

      {/* Ручная установка */}
      <InstallerCard
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <CardTitle>
          <FiTerminal />
          Ручная установка агента
        </CardTitle>

        <StepContainer>
          <StepTitle>
            <StepNumber>1</StepNumber>
            Подключитесь к серверу по SSH
          </StepTitle>
          <CodeBlock>
            ssh root@YOUR_SERVER_IP
            <CopyButton onClick={() => copyToClipboard('ssh root@YOUR_SERVER_IP')}>
              <FiCopy />
              Копировать
            </CopyButton>
          </CodeBlock>
        </StepContainer>

        <StepContainer>
          <StepTitle>
            <StepNumber>2</StepNumber>
            Скачайте и запустите установщик
          </StepTitle>
          <CodeBlock>
            {manualInstallScript}
            <CopyButton onClick={() => copyToClipboard(manualInstallScript)}>
              <FiCopy />
              Копировать
            </CopyButton>
          </CodeBlock>
          
          <div style={{ margin: '1rem 0', color: 'rgba(255,255,255,0.7)' }}>
            Альтернативный способ (если curl недоступен):
          </div>
          
          <CodeBlock>
            {wgetInstallScript}
            <CopyButton onClick={() => copyToClipboard(wgetInstallScript)}>
              <FiCopy />
              Копировать
            </CopyButton>
          </CodeBlock>
        </StepContainer>

        <StepContainer>
          <StepTitle>
            <StepNumber>3</StepNumber>
            Введите API ключ при запросе
          </StepTitle>
          <div style={{ marginBottom: '1rem' }}>
            {!apiKey ? (
              <ActionButton variant="primary" onClick={generateApiKey}>
                <FiKey />
                Сгенерировать API ключ
              </ActionButton>
            ) : (
              <CodeBlock>
                {apiKey}
                <CopyButton onClick={() => copyToClipboard(apiKey, 'API ключ скопирован')}>
                  <FiCopy />
                  Копировать
                </CopyButton>
              </CodeBlock>
            )}
          </div>
        </StepContainer>

        <StepContainer>
          <StepTitle>
            <StepNumber>4</StepNumber>
            Проверьте статус агента
          </StepTitle>
          <CodeBlock>
            systemctl status xpanel-agent
            <CopyButton onClick={() => copyToClipboard('systemctl status xpanel-agent')}>
              <FiCopy />
              Копировать
            </CopyButton>
          </CodeBlock>
        </StepContainer>

        <div style={{ 
          padding: '1rem', 
          background: 'rgba(0, 212, 255, 0.1)', 
          border: '1px solid rgba(0, 212, 255, 0.3)', 
          borderRadius: '8px',
          color: 'rgba(255,255,255,0.8)'
        }}>
          <strong>💡 Совет:</strong> После успешной установки сервер появится в списке серверов через 1-2 минуты. 
          Агент будет автоматически отправлять статистику и принимать команды от панели управления.
        </div>
      </InstallerCard>
    </InstallerContainer>
  );
}

export default ServerInstaller;
