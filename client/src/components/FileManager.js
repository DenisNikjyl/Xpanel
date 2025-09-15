import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { 
  FiFolder, FiFile, FiDownload, FiUpload, FiEdit, FiTrash2, 
  FiPlus, FiRefreshCw, FiHome, FiChevronRight, FiSearch,
  FiCopy, FiScissors, FiArchive, FiServer
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import axios from 'axios';

const FileManagerContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: ${props => props.theme.colors.background};
`;

const Toolbar = styled.div`
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

const PathBreadcrumb = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 1;
  padding: 8px 12px;
  background: rgba(30, 30, 46, 0.5);
  border-radius: ${props => props.theme.borderRadius.small};
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
`;

const BreadcrumbItem = styled.span`
  color: ${props => props.clickable ? props.theme.colors.primary : props.theme.colors.textSecondary};
  cursor: ${props => props.clickable ? 'pointer' : 'default'};
  
  &:hover {
    ${props => props.clickable && `color: #0099cc;`}
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

const FileGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
  padding: 20px;
  flex: 1;
  overflow-y: auto;
`;

const FileItem = styled(motion.div)`
  background: ${props => props.theme.gradients.card};
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: ${props => props.theme.borderRadius.medium};
  padding: 15px;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    border-color: rgba(0, 212, 255, 0.4);
    transform: translateY(-2px);
    box-shadow: ${props => props.theme.shadows.medium};
  }
  
  ${props => props.selected && `
    border-color: ${props.theme.colors.primary};
    background: rgba(0, 212, 255, 0.1);
  `}
`;

const FileIcon = styled.div`
  font-size: 2rem;
  color: ${props => props.isDirectory ? props.theme.colors.primary : props.theme.colors.textSecondary};
  margin-bottom: 10px;
  text-align: center;
`;

const FileName = styled.div`
  color: ${props => props.theme.colors.text};
  font-size: 0.9rem;
  font-weight: 500;
  text-align: center;
  word-break: break-word;
  margin-bottom: 5px;
`;

const FileInfo = styled.div`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 0.8rem;
  text-align: center;
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

const ContextMenu = styled(motion.div)`
  position: fixed;
  background: ${props => props.theme.gradients.card};
  border: 1px solid rgba(0, 212, 255, 0.3);
  border-radius: ${props => props.theme.borderRadius.medium};
  padding: 8px 0;
  min-width: 150px;
  z-index: 1000;
  box-shadow: ${props => props.theme.shadows.large};
`;

const ContextMenuItem = styled.div`
  padding: 8px 15px;
  color: ${props => props.theme.colors.text};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9rem;
  
  &:hover {
    background: rgba(0, 212, 255, 0.1);
  }
  
  ${props => props.danger && `
    color: ${props.theme.colors.error};
  `}
`;

function FileManager({ servers }) {
  const [selectedServer, setSelectedServer] = useState('');
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);

  useEffect(() => {
    if (selectedServer) {
      fetchFiles();
    }
  }, [selectedServer, currentPath]);

  const fetchFiles = async () => {
    if (!selectedServer) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('xpanel_token');
      const response = await axios.get(`/api/servers/${selectedServer}/files`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { path: currentPath }
      });
      setFiles(response.data);
    } catch (error) {
      toast.error('Failed to load files');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileClick = (file) => {
    if (file.isDirectory) {
      const newPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
      setCurrentPath(newPath);
    } else {
      // Open file editor or download
      toast.info(`Opening ${file.name}...`);
    }
  };

  const handleFileSelect = (file, event) => {
    event.stopPropagation();
    
    if (event.ctrlKey || event.metaKey) {
      setSelectedFiles(prev => 
        prev.includes(file.name) 
          ? prev.filter(name => name !== file.name)
          : [...prev, file.name]
      );
    } else {
      setSelectedFiles([file.name]);
    }
  };

  const handleContextMenu = (event, file) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      file
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const navigateToPath = (pathSegment, index) => {
    const pathParts = currentPath.split('/').filter(Boolean);
    const newPath = '/' + pathParts.slice(0, index).join('/');
    setCurrentPath(newPath || '/');
  };

  const goHome = () => {
    setCurrentPath('/');
  };

  const goUp = () => {
    const pathParts = currentPath.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      pathParts.pop();
      setCurrentPath('/' + pathParts.join('/'));
    }
  };

  const handleFileAction = (action, file) => {
    switch (action) {
      case 'download':
        toast.info(`Downloading ${file.name}...`);
        break;
      case 'edit':
        toast.info(`Opening editor for ${file.name}...`);
        break;
      case 'delete':
        if (window.confirm(`Are you sure you want to delete ${file.name}?`)) {
          toast.success(`${file.name} deleted`);
          fetchFiles();
        }
        break;
      case 'copy':
        toast.info(`${file.name} copied to clipboard`);
        break;
      case 'cut':
        toast.info(`${file.name} cut to clipboard`);
        break;
      default:
        break;
    }
    closeContextMenu();
  };

  const pathParts = currentPath.split('/').filter(Boolean);

  return (
    <FileManagerContainer onClick={closeContextMenu}>
      <Toolbar>
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

        <PathBreadcrumb>
          <BreadcrumbItem clickable onClick={goHome}>
            <FiHome />
          </BreadcrumbItem>
          {pathParts.map((part, index) => (
            <React.Fragment key={index}>
              <FiChevronRight />
              <BreadcrumbItem 
                clickable 
                onClick={() => navigateToPath(part, index + 1)}
              >
                {part}
              </BreadcrumbItem>
            </React.Fragment>
          ))}
        </PathBreadcrumb>

        <ActionButton onClick={goUp} disabled={currentPath === '/'}>
          ← Up
        </ActionButton>

        <ActionButton onClick={fetchFiles} disabled={!selectedServer}>
          <FiRefreshCw />
          Refresh
        </ActionButton>

        <ActionButton primary>
          <FiPlus />
          New
        </ActionButton>

        <ActionButton>
          <FiUpload />
          Upload
        </ActionButton>
      </Toolbar>

      {!selectedServer ? (
        <EmptyState>
          <FiServer />
          <div>Select a server to browse files</div>
        </EmptyState>
      ) : loading ? (
        <EmptyState>
          <div>Loading files...</div>
        </EmptyState>
      ) : files.length === 0 ? (
        <EmptyState>
          <FiFolder />
          <div>No files found in this directory</div>
        </EmptyState>
      ) : (
        <FileGrid>
          {files.map((file, index) => (
            <FileItem
              key={file.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              selected={selectedFiles.includes(file.name)}
              onClick={() => handleFileClick(file)}
              onContextMenu={(e) => handleContextMenu(e, file)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <FileIcon isDirectory={file.isDirectory}>
                {file.isDirectory ? <FiFolder /> : <FiFile />}
              </FileIcon>
              <FileName>{file.name}</FileName>
              <FileInfo>
                {file.isDirectory ? 'Directory' : file.size}
                <br />
                {file.date}
              </FileInfo>
            </FileItem>
          ))}
        </FileGrid>
      )}

      {contextMenu && (
        <ContextMenu
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <ContextMenuItem onClick={() => handleFileAction('download', contextMenu.file)}>
            <FiDownload />
            Download
          </ContextMenuItem>
          {!contextMenu.file.isDirectory && (
            <ContextMenuItem onClick={() => handleFileAction('edit', contextMenu.file)}>
              <FiEdit />
              Edit
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={() => handleFileAction('copy', contextMenu.file)}>
            <FiCopy />
            Copy
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleFileAction('cut', contextMenu.file)}>
            <FiScissors />
            Cut
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleFileAction('archive', contextMenu.file)}>
            <FiArchive />
            Archive
          </ContextMenuItem>
          <ContextMenuItem danger onClick={() => handleFileAction('delete', contextMenu.file)}>
            <FiTrash2 />
            Delete
          </ContextMenuItem>
        </ContextMenu>
      )}
    </FileManagerContainer>
  );
}

export default FileManager;
