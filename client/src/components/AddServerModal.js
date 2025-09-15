import React, { useState } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiServer, FiUser, FiLock, FiWifi, FiEye, FiEyeOff } from 'react-icons/fi';

const ModalOverlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
`;

const ModalContent = styled(motion.div)`
  background: ${props => props.theme.gradients.card};
  border-radius: ${props => props.theme.borderRadius.large};
  border: 1px solid rgba(0, 212, 255, 0.3);
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
`;

const ModalHeader = styled.div`
  padding: 25px;
  border-bottom: 1px solid rgba(0, 212, 255, 0.2);
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ModalTitle = styled.h2`
  color: ${props => props.theme.colors.text};
  font-size: 1.5rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const CloseButton = styled.button`
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

const ModalBody = styled.div`
  padding: 25px;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.label`
  color: ${props => props.theme.colors.text};
  font-weight: 500;
  font-size: 0.9rem;
`;

const InputWrapper = styled.div`
  position: relative;
`;

const InputIcon = styled.div`
  position: absolute;
  left: 15px;
  top: 50%;
  transform: translateY(-50%);
  color: ${props => props.theme.colors.textSecondary};
  z-index: 2;
`;

const Input = styled.input`
  width: 100%;
  padding: 12px 15px 12px 45px;
  border: 2px solid rgba(0, 212, 255, 0.2);
  border-radius: ${props => props.theme.borderRadius.medium};
  background: rgba(30, 30, 46, 0.5);
  color: ${props => props.theme.colors.text};
  font-size: 14px;
  transition: all 0.3s ease;
  
  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
    box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.1);
  }
  
  &::placeholder {
    color: ${props => props.theme.colors.textSecondary};
  }
`;

const PasswordToggle = styled.button`
  position: absolute;
  right: 15px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: ${props => props.theme.colors.textSecondary};
  cursor: pointer;
  padding: 5px;
  
  &:hover {
    color: ${props => props.theme.colors.primary};
  }
`;

const HelpText = styled.p`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 0.8rem;
  margin-top: 5px;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 15px;
  margin-top: 30px;
`;

const Button = styled(motion.button)`
  flex: 1;
  padding: 12px 20px;
  border: none;
  border-radius: ${props => props.theme.borderRadius.medium};
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  
  ${props => props.primary ? `
    background: ${props.theme.gradients.primary};
    color: white;
    
    &:hover {
      background: #0099cc;
    }
  ` : `
    background: transparent;
    color: ${props.theme.colors.textSecondary};
    border: 1px solid ${props.theme.colors.textSecondary};
    
    &:hover {
      background: rgba(0, 212, 255, 0.1);
      color: ${props.theme.colors.primary};
      border-color: ${props.theme.colors.primary};
    }
  `}
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const InstallationProgress = styled.div`
  margin-top: 20px;
  padding: 20px;
  background: rgba(30, 30, 46, 0.5);
  border-radius: ${props => props.theme.borderRadius.medium};
  border: 1px solid rgba(0, 212, 255, 0.2);
`;

const ProgressTitle = styled.h4`
  color: ${props => props.theme.colors.text};
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 8px;
  background: rgba(0, 212, 255, 0.2);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 15px;
`;

const ProgressFill = styled(motion.div)`
  height: 100%;
  background: ${props => props.theme.gradients.primary};
  border-radius: 4px;
`;

const LogContainer = styled.div`
  max-height: 200px;
  overflow-y: auto;
  background: rgba(10, 10, 10, 0.8);
  border-radius: ${props => props.theme.borderRadius.small};
  padding: 15px;
  font-family: 'Courier New', monospace;
  font-size: 0.8rem;
`;

const LogLine = styled.div`
  color: ${props => {
    if (props.type === 'success') return props.theme.colors.success;
    if (props.type === 'error') return props.theme.colors.error;
    if (props.type === 'warning') return props.theme.colors.warning;
    return props.theme.colors.textSecondary;
  }};
  margin-bottom: 5px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

function AddServerModal({ onClose, onAdd }) {
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: '22',
    username: '',
    password: '',
    agentPort: '8888'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  const simulateInstallation = async () => {
    setInstalling(true);
    setProgress(0);
    setLogs([]);

    const steps = [
      { message: 'Connecting to server via SSH...', delay: 1000, progress: 10 },
      { message: 'SSH connection established', type: 'success', delay: 500, progress: 20 },
      { message: 'Checking OS compatibility...', delay: 800, progress: 30 },
      { message: 'Ubuntu 22.04 LTS detected - compatible', type: 'success', delay: 500, progress: 40 },
      { message: 'Updating package manager...', delay: 2000, progress: 50 },
      { message: 'Package manager updated', type: 'success', delay: 500, progress: 60 },
      { message: 'Installing Python 3.9...', delay: 1500, progress: 70 },
      { message: 'Python 3.9 installed successfully', type: 'success', delay: 500, progress: 80 },
      { message: 'Installing pip packages: psutil websockets...', delay: 1200, progress: 90 },
      { message: 'All dependencies installed', type: 'success', delay: 500, progress: 95 },
      { message: 'Downloading Xpanel agent...', delay: 1000, progress: 98 },
      { message: 'Starting Xpanel service...', delay: 800, progress: 100 },
      { message: 'Installation completed successfully!', type: 'success', delay: 500, progress: 100 }
    ];

    for (const step of steps) {
      addLog(step.message, step.type);
      setProgress(step.progress);
      await new Promise(resolve => setTimeout(resolve, step.delay));
    }

    setInstalling(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await simulateInstallation();
      await onAdd(formData);
      onClose();
    } catch (error) {
      addLog('Installation failed: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <ModalOverlay
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <ModalContent
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <ModalHeader>
            <ModalTitle>
              <FiServer />
              Add New Server
            </ModalTitle>
            <CloseButton onClick={onClose}>
              <FiX />
            </CloseButton>
          </ModalHeader>

          <ModalBody>
            <Form onSubmit={handleSubmit}>
              <FormGroup>
                <Label>Server Name</Label>
                <InputWrapper>
                  <InputIcon><FiServer /></InputIcon>
                  <Input
                    type="text"
                    name="name"
                    placeholder="My VPS Server"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                </InputWrapper>
                <HelpText>A friendly name for your server</HelpText>
              </FormGroup>

              <FormGroup>
                <Label>Host Address</Label>
                <InputWrapper>
                  <InputIcon><FiWifi /></InputIcon>
                  <Input
                    type="text"
                    name="host"
                    placeholder="192.168.1.100 or example.com"
                    value={formData.host}
                    onChange={handleInputChange}
                    required
                  />
                </InputWrapper>
                <HelpText>IP address or domain name of your server</HelpText>
              </FormGroup>

              <FormGroup>
                <Label>SSH Port</Label>
                <InputWrapper>
                  <InputIcon><FiWifi /></InputIcon>
                  <Input
                    type="number"
                    name="port"
                    placeholder="22"
                    value={formData.port}
                    onChange={handleInputChange}
                    required
                  />
                </InputWrapper>
                <HelpText>SSH port (default: 22)</HelpText>
              </FormGroup>

              <FormGroup>
                <Label>SSH Username</Label>
                <InputWrapper>
                  <InputIcon><FiUser /></InputIcon>
                  <Input
                    type="text"
                    name="username"
                    placeholder="root"
                    value={formData.username}
                    onChange={handleInputChange}
                    required
                  />
                </InputWrapper>
                <HelpText>SSH username with sudo privileges</HelpText>
              </FormGroup>

              <FormGroup>
                <Label>SSH Password</Label>
                <InputWrapper>
                  <InputIcon><FiLock /></InputIcon>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="Enter SSH password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                  />
                  <PasswordToggle
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <FiEyeOff /> : <FiEye />}
                  </PasswordToggle>
                </InputWrapper>
                <HelpText>SSH password for authentication</HelpText>
              </FormGroup>

              <FormGroup>
                <Label>Agent Port</Label>
                <InputWrapper>
                  <InputIcon><FiWifi /></InputIcon>
                  <Input
                    type="number"
                    name="agentPort"
                    placeholder="8888"
                    value={formData.agentPort}
                    onChange={handleInputChange}
                    required
                  />
                </InputWrapper>
                <HelpText>Port for Xpanel agent communication (default: 8888)</HelpText>
              </FormGroup>

              {installing && (
                <InstallationProgress>
                  <ProgressTitle>
                    Installing Xpanel Agent...
                  </ProgressTitle>
                  <ProgressBar>
                    <ProgressFill
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </ProgressBar>
                  <LogContainer>
                    {logs.map((log, index) => (
                      <LogLine key={index} type={log.type}>
                        [{log.timestamp}] {log.message}
                      </LogLine>
                    ))}
                  </LogContainer>
                </InstallationProgress>
              )}

              <ButtonGroup>
                <Button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  primary
                  disabled={loading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {loading ? 'Installing...' : 'Add Server'}
                </Button>
              </ButtonGroup>
            </Form>
          </ModalBody>
        </ModalContent>
      </ModalOverlay>
    </AnimatePresence>
  );
}

export default AddServerModal;
