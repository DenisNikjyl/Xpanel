import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiServer, 
  FiPlus, 
  FiTrash2, 
  FiActivity, 
  FiWifi, 
  FiWifiOff,
  FiTerminal,
  FiRefreshCw,
  FiSettings,
  FiEye,
  FiCpu,
  FiHardDrive,
  FiMonitor,
  FiCheckCircle,
  FiAlertTriangle
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import io from 'socket.io-client';
import axios from 'axios';

const Container = styled.div`
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
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

const AddButton = styled(motion.button)`
  background: ${props => props.theme.colors.accent};
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
`;

const VPSGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
`;

const VPSCard = styled(motion.div)`
  background: ${props => props.theme.colors.surface};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 12px;
  padding: 20px;
  position: relative;
  overflow: hidden;
`;

const VPSHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
`;

const VPSName = styled.h3`
  color: ${props => props.theme.colors.text};
  font-size: 18px;
  font-weight: 600;
  margin: 0;
`;

const VPSStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: ${props => props.online ? '#00ff88' : '#ff4757'};
  font-weight: 500;
`;

const VPSInfo = styled.div`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 14px;
  margin-bottom: 15px;
`;

const VPSActions = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 15px;
`;

const ActionButton = styled(motion.button)`
  background: ${props => props.variant === 'danger' ? '#ff4757' : props.theme.colors.accent};
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  flex: 1;
`;

const Modal = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled(motion.div)`
  background: ${props => props.theme.colors.surface};
  border-radius: 12px;
  padding: 30px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const ModalTitle = styled.h2`
  color: ${props => props.theme.colors.text};
  font-size: 20px;
  font-weight: 600;
  margin: 0;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: ${props => props.theme.colors.textSecondary};
  cursor: pointer;
  font-size: 20px;
`;

const FormGroup = styled.div`
  margin-bottom: 20px;
`;

const Label = styled.label`
  display: block;
  color: ${props => props.theme.colors.text};
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
`;

const Input = styled.input`
  width: 100%;
  background: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.text};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.accent};
  }
`;

const SubmitButton = styled(motion.button)`
  background: ${props => props.theme.colors.accent};
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  width: 100%;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: ${props => props.theme.colors.textSecondary};
`;

const EmptyIcon = styled.div`
  font-size: 48px;
  margin-bottom: 20px;
  opacity: 0.5;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
  margin-top: 15px;
`;

const StatItem = styled.div`
  text-align: center;
  padding: 10px;
  background: ${props => props.theme.colors.background};
  border-radius: 8px;
`;

const StatLabel = styled.div`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 12px;
  margin-bottom: 5px;
`;

const StatValue = styled.div`
  color: ${props => props.theme.colors.text};
  font-size: 16px;
  font-weight: 600;
`;

const VPSManager = ({ user }) => {
  const [vpsList, setVpsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedVPS, setSelectedVPS] = useState(null);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showTerminalModal, setShowTerminalModal] = useState(false);
  const [socket, setSocket] = useState(null);

  // Форма добавления VPS
  const [vpsForm, setVpsForm] = useState({
    name: '',
    ip: '',
    port: '8888',
    apiKey: ''
  });

  // Терминал
  const [terminalCommand, setTerminalCommand] = useState('');
  const [terminalOutput, setTerminalOutput] = useState('');
  const [terminalLoading, setTerminalLoading] = useState(false);
  
  // Статистика VPS
  const [vpsStats, setVpsStats] = useState({});

  useEffect(() => {
    loadVPSList();
    initializeSocket();
    
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  const initializeSocket = () => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('vps_connected', (data) => {
      toast.success(`VPS ${data.config.name} подключен`);
      loadVPSList();
    });

    newSocket.on('vps_disconnected', (data) => {
      toast.error(`VPS ${data.config.name} отключен`);
      loadVPSList();
    });

    newSocket.on('vps_stats_updated', (data) => {
      setVpsList(prev => prev.map(vps => 
        vps.id === data.vpsId 
          ? { ...vps, lastStats: data.stats, lastSeen: new Date() }
          : vps
      ));
    });

    newSocket.on('vps_connection_failed', (data) => {
      toast.error(`Не удалось подключиться к VPS ${data.config.name}`);
    });
  };

  const loadVPSList = async () => {
    try {
      const token = localStorage.getItem('xpanel_token');
      const response = await fetch('/api/vps/list', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setVpsList(data.vps || []);
      } else {
        toast.error('Ошибка загрузки списка VPS');
      }
    } catch (error) {
      console.error('Load VPS list error:', error);
      toast.error('Ошибка соединения с сервером');
    } finally {
      setLoading(false);
    }
  };

  const handleAddVPS = async (e) => {
    e.preventDefault();
    
    if (!vpsForm.name || !vpsForm.ip || !vpsForm.apiKey) {
      toast.error('Заполните все обязательные поля');
      return;
    }

    try {
      const token = localStorage.getItem('xpanel_token');
      const response = await fetch('/api/vps/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(vpsForm)
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        setShowAddModal(false);
        setVpsForm({ name: '', ip: '', port: '8888', apiKey: '' });
        loadVPSList();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Ошибка добавления VPS');
      }
    } catch (error) {
      console.error('Add VPS error:', error);
      toast.error('Ошибка соединения с сервером');
    }
  };

  const handleRemoveVPS = async (vpsId, vpsName) => {
    if (!window.confirm(`Удалить VPS "${vpsName}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('xpanel_token');
      const response = await fetch(`/api/vps/${vpsId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success('VPS удален');
        loadVPSList();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Ошибка удаления VPS');
      }
    } catch (error) {
      console.error('Remove VPS error:', error);
      toast.error('Ошибка соединения с сервером');
    }
  };

  const handleExecuteCommand = async () => {
    if (!terminalCommand.trim()) {
      toast.error('Введите команду');
      return;
    }

    setTerminalLoading(true);
    try {
      const token = localStorage.getItem('xpanel_token');
      const response = await fetch(`/api/vps/${selectedVPS.id}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ command: terminalCommand })
      });

      if (response.ok) {
        const data = await response.json();
        const result = data.result;
        
        setTerminalOutput(prev => 
          prev + `\n$ ${terminalCommand}\n` + 
          (result.stdout || '') + 
          (result.stderr ? `\nError: ${result.stderr}` : '') +
          `\nExit code: ${result.returncode}\n` +
          '─'.repeat(50) + '\n'
        );
        setTerminalCommand('');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Ошибка выполнения команды');
      }
    } catch (error) {
      console.error('Execute command error:', error);
      toast.error('Ошибка соединения с сервером');
    } finally {
      setTerminalLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected': return 'text-green-400';
      case 'connecting': return 'text-yellow-400';
      case 'disconnected': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'connected': return <FiWifi className="w-4 h-4" />;
      case 'connecting': return <FiRefreshCw className="w-4 h-4 animate-spin" />;
      default: return <FiWifiOff className="w-4 h-4" />;
    }
  };

  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}д ${hours}ч`;
    if (hours > 0) return `${hours}ч ${minutes}м`;
    return `${minutes}м`;
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <FiRefreshCw className="w-8 h-8 animate-spin text-blue-400" />
        <span className="ml-2 text-gray-300">Загрузка VPS...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center">
            <FiServer className="mr-3 text-blue-400" />
            Управление VPS
          </h2>
          <p className="text-gray-400 mt-1">
            Подключайтесь к вашим серверам и управляйте ими
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
        >
          <FiPlus className="mr-2" />
          Добавить VPS
        </motion.button>
      </div>

      {/* VPS Grid */}
      {vpsList.length === 0 ? (
        <div className="text-center py-12">
          <FiServer className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-300 mb-2">
            Нет подключенных VPS
          </h3>
          <p className="text-gray-500 mb-6">
            Добавьте свой первый VPS сервер для начала мониторинга
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center mx-auto transition-colors"
          >
            <FiPlus className="mr-2" />
            Добавить VPS
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vpsList.map((vps) => (
            <motion.div
              key={vps.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-blue-500 transition-colors"
            >
              {/* VPS Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className={`p-2 rounded-lg ${vps.status === 'connected' ? 'bg-green-900/50' : 'bg-gray-700'}`}>
                    <FiServer className={`w-5 h-5 ${vps.status === 'connected' ? 'text-green-400' : 'text-gray-400'}`} />
                  </div>
                  <div className="ml-3">
                    <h3 className="font-semibold text-white">{vps.name}</h3>
                    <p className="text-sm text-gray-400">{vps.ip}:{vps.port}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`flex items-center ${getStatusColor(vps.status)}`}>
                    {getStatusIcon(vps.status)}
                  </div>
                  <button
                    onClick={() => handleRemoveVPS(vps.id, vps.name)}
                    className="text-red-400 hover:text-red-300 p-1"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Stats */}
              {vps.lastStats && (
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-sm text-gray-400">
                      <FiCpu className="w-4 h-4 mr-2" />
                      CPU
                    </div>
                    <span className="text-sm text-white">
                      {vps.lastStats.cpu.percent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        vps.lastStats.cpu.percent > 80 ? 'bg-red-500' :
                        vps.lastStats.cpu.percent > 60 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(vps.lastStats.cpu.percent, 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-sm text-gray-400">
                      <FiMonitor className="w-4 h-4 mr-2" />
                      RAM
                    </div>
                    <span className="text-sm text-white">
                      {vps.lastStats.memory.percent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        vps.lastStats.memory.percent > 80 ? 'bg-red-500' :
                        vps.lastStats.memory.percent > 60 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(vps.lastStats.memory.percent, 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-sm text-gray-400">
                      <FiHardDrive className="w-4 h-4 mr-2" />
                      Диск
                    </div>
                    <span className="text-sm text-white">
                      {vps.lastStats.disk.percent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        vps.lastStats.disk.percent > 90 ? 'bg-red-500' :
                        vps.lastStats.disk.percent > 70 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(vps.lastStats.disk.percent, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setSelectedVPS(vps);
                    setShowStatsModal(true);
                  }}
                  disabled={vps.status !== 'connected'}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-3 rounded-lg flex items-center justify-center text-sm transition-colors"
                >
                  <FiEye className="w-4 h-4 mr-1" />
                  Детали
                </button>
                <button
                  onClick={() => {
                    setSelectedVPS(vps);
                    setShowTerminalModal(true);
                    setTerminalOutput('');
                  }}
                  disabled={vps.status !== 'connected'}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-3 rounded-lg flex items-center justify-center text-sm transition-colors"
                >
                  <FiTerminal className="w-4 h-4 mr-1" />
                  Терминал
                </button>
              </div>

              {/* Last Seen */}
              {vps.lastSeen && (
                <div className="mt-3 text-xs text-gray-500 text-center">
                  Обновлено: {new Date(vps.lastSeen).toLocaleTimeString()}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Add VPS Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-800 rounded-xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-white mb-4">Добавить VPS</h3>
              
              <form onSubmit={handleAddVPS} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Название *
                  </label>
                  <input
                    type="text"
                    value={vpsForm.name}
                    onChange={(e) => setVpsForm({...vpsForm, name: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="Мой VPS"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    IP адрес *
                  </label>
                  <input
                    type="text"
                    value={vpsForm.ip}
                    onChange={(e) => setVpsForm({...vpsForm, ip: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="192.168.1.100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Порт
                  </label>
                  <input
                    type="number"
                    value={vpsForm.port}
                    onChange={(e) => setVpsForm({...vpsForm, port: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="8888"
                    min="1"
                    max="65535"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    API ключ *
                  </label>
                  <input
                    type="password"
                    value={vpsForm.apiKey}
                    onChange={(e) => setVpsForm({...vpsForm, apiKey: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="Введите API ключ агента"
                    required
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
                  >
                    Добавить
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Terminal Modal */}
      <AnimatePresence>
        {showTerminalModal && selectedVPS && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowTerminalModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 rounded-xl p-6 w-full max-w-4xl h-96"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">
                  Терминал - {selectedVPS.name}
                </h3>
                <button
                  onClick={() => setShowTerminalModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="bg-black rounded-lg p-4 h-64 overflow-y-auto mb-4 font-mono text-sm">
                <pre className="text-green-400 whitespace-pre-wrap">
                  {terminalOutput || 'Введите команду для выполнения...'}
                </pre>
              </div>

              <div className="flex space-x-2">
                <input
                  type="text"
                  value={terminalCommand}
                  onChange={(e) => setTerminalCommand(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleExecuteCommand()}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono"
                  placeholder="Введите команду..."
                  disabled={terminalLoading}
                />
                <button
                  onClick={handleExecuteCommand}
                  disabled={terminalLoading || !terminalCommand.trim()}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center transition-colors"
                >
                  {terminalLoading ? (
                    <FiRefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <FiTerminal className="w-4 h-4" />
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VPSManager;
