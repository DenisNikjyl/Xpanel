import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { FiTerminal, FiMaximize2, FiMinimize2, FiX, FiPlus } from 'react-icons/fi';
import toast from 'react-hot-toast';

const TerminalContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: ${props => props.theme.colors.background};
`;

const TerminalHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
  background: ${props => props.theme.gradients.card};
  border-radius: ${props => props.theme.borderRadius.medium};
  margin-bottom: 20px;
  border: 1px solid rgba(0, 212, 255, 0.2);
`;

const ServerSelect = styled.select`
  padding: 8px 12px;
  background: rgba(30, 30, 46, 0.5);
  border: 1px solid rgba(0, 212, 255, 0.3);
  border-radius: ${props => props.theme.borderRadius.small};
  color: ${props => props.theme.colors.text};
  min-width: 200px;
  
  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
  }
`;

const TabContainer = styled.div`
  display: flex;
  gap: 5px;
  flex: 1;
`;

const Tab = styled(motion.div)`
  padding: 8px 15px;
  background: ${props => props.active ? props.theme.colors.primary : 'rgba(30, 30, 46, 0.5)'};
  color: ${props => props.active ? 'white' : props.theme.colors.textSecondary};
  border-radius: ${props => props.theme.borderRadius.small};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  max-width: 200px;
  
  &:hover {
    background: ${props => props.active ? props.theme.colors.primary : 'rgba(0, 212, 255, 0.2)'};
  }
`;

const TabTitle = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const CloseTab = styled.button`
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 2px;
  border-radius: 2px;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

const ActionButton = styled(motion.button)`
  padding: 8px 12px;
  background: ${props => props.primary ? props.theme.gradients.primary : 'rgba(0, 212, 255, 0.2)'};
  color: ${props => props.primary ? 'white' : props.theme.colors.primary};
  border: 1px solid ${props => props.theme.colors.primary};
  border-radius: ${props => props.theme.borderRadius.small};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.9rem;
  
  &:hover {
    background: ${props => props.primary ? '#0099cc' : 'rgba(0, 212, 255, 0.3)'};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const TerminalWindow = styled.div`
  flex: 1;
  background: #0a0a0a;
  border-radius: ${props => props.theme.borderRadius.medium};
  border: 1px solid rgba(0, 212, 255, 0.3);
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const TerminalTitleBar = styled.div`
  background: rgba(30, 30, 46, 0.8);
  padding: 10px 15px;
  display: flex;
  justify-content: between;
  align-items: center;
  border-bottom: 1px solid rgba(0, 212, 255, 0.2);
`;

const TerminalTitle = styled.div`
  color: ${props => props.theme.colors.text};
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const TerminalControls = styled.div`
  display: flex;
  gap: 5px;
  margin-left: auto;
`;

const ControlButton = styled.button`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  
  &.close { background: #ff5f57; }
  &.minimize { background: #ffbd2e; }
  &.maximize { background: #28ca42; }
`;

const TerminalContent = styled.div`
  flex: 1;
  padding: 15px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.4;
  overflow-y: auto;
  background: #0a0a0a;
  color: #00ff00;
`;

const TerminalLine = styled.div`
  margin-bottom: 5px;
  white-space: pre-wrap;
  word-break: break-all;
  
  &.command {
    color: #00d4ff;
  }
  
  &.error {
    color: #ff4757;
  }
  
  &.success {
    color: #00ff88;
  }
`;

const InputLine = styled.div`
  display: flex;
  align-items: center;
  margin-top: 10px;
`;

const Prompt = styled.span`
  color: #00d4ff;
  margin-right: 5px;
`;

const CommandInput = styled.input`
  background: transparent;
  border: none;
  color: #00ff00;
  font-family: inherit;
  font-size: inherit;
  flex: 1;
  outline: none;
  
  &::selection {
    background: rgba(0, 212, 255, 0.3);
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: ${props => props.theme.colors.textSecondary};
  
  svg {
    font-size: 3rem;
    margin-bottom: 15px;
    opacity: 0.5;
  }
`;

function Terminal({ servers }) {
  const [selectedServer, setSelectedServer] = useState('');
  const [terminals, setTerminals] = useState([]);
  const [activeTerminal, setActiveTerminal] = useState(0);
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef(null);
  const terminalRef = useRef(null);

  const createNewTerminal = () => {
    if (!selectedServer) {
      toast.error('Please select a server first');
      return;
    }

    const server = servers.find(s => s.id === parseInt(selectedServer));
    if (!server) return;

    const newTerminal = {
      id: Date.now(),
      serverId: selectedServer,
      serverName: server.name,
      lines: [
        { type: 'success', content: `Connected to ${server.name} (${server.host})` },
        { type: 'info', content: 'Welcome to Xpanel SSH Terminal' },
        { type: 'info', content: 'Type commands below...' }
      ],
      currentCommand: '',
      connected: true
    };

    setTerminals(prev => [...prev, newTerminal]);
    setActiveTerminal(terminals.length);
    toast.success(`Terminal connected to ${server.name}`);
  };

  const closeTerminal = (index) => {
    setTerminals(prev => prev.filter((_, i) => i !== index));
    if (activeTerminal >= index && activeTerminal > 0) {
      setActiveTerminal(activeTerminal - 1);
    }
  };

  const executeCommand = (command) => {
    if (!command.trim()) return;

    const terminal = terminals[activeTerminal];
    if (!terminal) return;

    // Add command to history
    setCommandHistory(prev => [...prev, command]);
    setHistoryIndex(-1);

    // Add command line to terminal
    const updatedTerminals = [...terminals];
    updatedTerminals[activeTerminal].lines.push({
      type: 'command',
      content: `root@${terminal.serverName}:~$ ${command}`
    });

    // Simulate command execution
    setTimeout(() => {
      const mockOutput = generateMockOutput(command);
      updatedTerminals[activeTerminal].lines.push(...mockOutput);
      setTerminals(updatedTerminals);
      
      // Scroll to bottom
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      }
    }, 100);

    updatedTerminals[activeTerminal].currentCommand = '';
    setTerminals(updatedTerminals);
  };

  const generateMockOutput = (command) => {
    const cmd = command.toLowerCase().trim();
    
    if (cmd === 'ls' || cmd === 'ls -la') {
      return [
        { type: 'info', content: 'total 24' },
        { type: 'info', content: 'drwxr-xr-x 3 root root 4096 Dec  5 14:30 .' },
        { type: 'info', content: 'drwxr-xr-x 3 root root 4096 Dec  5 14:30 ..' },
        { type: 'info', content: 'drwxr-xr-x 2 root root 4096 Dec  5 14:30 documents' },
        { type: 'info', content: '-rw-r--r-- 1 root root  220 Dec  5 14:30 .bashrc' },
        { type: 'info', content: '-rw-r--r-- 1 root root  807 Dec  5 14:30 .profile' }
      ];
    }
    
    if (cmd === 'pwd') {
      return [{ type: 'info', content: '/root' }];
    }
    
    if (cmd === 'whoami') {
      return [{ type: 'info', content: 'root' }];
    }
    
    if (cmd === 'date') {
      return [{ type: 'info', content: new Date().toString() }];
    }
    
    if (cmd === 'uptime') {
      return [{ type: 'info', content: '14:30:25 up 15 days,  3:42,  1 user,  load average: 0.08, 0.03, 0.01' }];
    }
    
    if (cmd.startsWith('cd ')) {
      return [{ type: 'success', content: '' }];
    }
    
    if (cmd === 'clear') {
      // Clear terminal
      setTimeout(() => {
        const updatedTerminals = [...terminals];
        updatedTerminals[activeTerminal].lines = [];
        setTerminals(updatedTerminals);
      }, 50);
      return [];
    }
    
    if (cmd === 'help') {
      return [
        { type: 'info', content: 'Available commands:' },
        { type: 'info', content: '  ls, ls -la    - List directory contents' },
        { type: 'info', content: '  pwd           - Print working directory' },
        { type: 'info', content: '  whoami        - Current user' },
        { type: 'info', content: '  date          - Current date and time' },
        { type: 'info', content: '  uptime        - System uptime' },
        { type: 'info', content: '  clear         - Clear terminal' },
        { type: 'info', content: '  exit          - Close terminal' }
      ];
    }
    
    if (cmd === 'exit') {
      setTimeout(() => {
        closeTerminal(activeTerminal);
        toast.info('Terminal session closed');
      }, 100);
      return [{ type: 'success', content: 'Goodbye!' }];
    }
    
    // Unknown command
    return [{ type: 'error', content: `bash: ${command}: command not found` }];
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      executeCommand(e.target.value);
      e.target.value = '';
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        e.target.value = commandHistory[newIndex];
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          e.target.value = '';
        } else {
          setHistoryIndex(newIndex);
          e.target.value = commandHistory[newIndex];
        }
      }
    }
  };

  const currentTerminal = terminals[activeTerminal];

  return (
    <TerminalContainer>
      <TerminalHeader>
        <ServerSelect
          value={selectedServer}
          onChange={(e) => setSelectedServer(e.target.value)}
        >
          <option value="">Select Server</option>
          {servers.filter(s => s.status === 'online').map(server => (
            <option key={server.id} value={server.id}>
              {server.name} ({server.host})
            </option>
          ))}
        </ServerSelect>

        <TabContainer>
          {terminals.map((terminal, index) => (
            <Tab
              key={terminal.id}
              active={activeTerminal === index}
              onClick={() => setActiveTerminal(index)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <FiTerminal />
              <TabTitle>{terminal.serverName}</TabTitle>
              <CloseTab onClick={(e) => {
                e.stopPropagation();
                closeTerminal(index);
              }}>
                <FiX size={12} />
              </CloseTab>
            </Tab>
          ))}
        </TabContainer>

        <ActionButton primary onClick={createNewTerminal} disabled={!selectedServer}>
          <FiPlus />
          New Terminal
        </ActionButton>
      </TerminalHeader>

      {terminals.length === 0 ? (
        <EmptyState>
          <FiTerminal />
          <div>No terminal sessions</div>
          <div>Select a server and click "New Terminal" to start</div>
        </EmptyState>
      ) : (
        <TerminalWindow>
          <TerminalTitleBar>
            <TerminalTitle>
              <FiTerminal />
              SSH Terminal - {currentTerminal?.serverName}
            </TerminalTitle>
            <TerminalControls>
              <ControlButton className="close" onClick={() => closeTerminal(activeTerminal)} />
              <ControlButton className="minimize" />
              <ControlButton className="maximize" />
            </TerminalControls>
          </TerminalTitleBar>

          <TerminalContent ref={terminalRef}>
            {currentTerminal?.lines.map((line, index) => (
              <TerminalLine key={index} className={line.type}>
                {line.content}
              </TerminalLine>
            ))}
            
            <InputLine>
              <Prompt>root@{currentTerminal?.serverName}:~$</Prompt>
              <CommandInput
                ref={inputRef}
                type="text"
                onKeyDown={handleKeyDown}
                autoFocus
                placeholder="Type command here..."
              />
            </InputLine>
          </TerminalContent>
        </TerminalWindow>
      )}
    </TerminalContainer>
  );
}

export default Terminal;
