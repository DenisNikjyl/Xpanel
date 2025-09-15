import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { 
  FiGitBranch, FiGitCommit, FiGitPullRequest, FiRefreshCw, 
  FiDownload, FiUpload, FiClock, FiUser, FiFolder, FiPlus
} from 'react-icons/fi';
import toast from 'react-hot-toast';

const GitContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const GitHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: between;
  gap: 15px;
  padding: 20px;
  background: ${props => props.theme.gradients.card};
  border-radius: ${props => props.theme.borderRadius.medium};
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

const ActionButton = styled(motion.button)`
  padding: 8px 16px;
  background: ${props => props.primary ? props.theme.gradients.primary : 'rgba(0, 212, 255, 0.2)'};
  color: ${props => props.primary ? 'white' : props.theme.colors.primary};
  border: 1px solid ${props => props.theme.colors.primary};
  border-radius: ${props => props.theme.borderRadius.small};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  
  &:hover {
    background: ${props => props.primary ? '#0099cc' : 'rgba(0, 212, 255, 0.3)'};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ProjectsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
`;

const ProjectCard = styled(motion.div)`
  background: ${props => props.theme.gradients.card};
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: ${props => props.theme.borderRadius.large};
  padding: 25px;
  transition: all 0.3s ease;
  
  &:hover {
    border-color: rgba(0, 212, 255, 0.4);
    box-shadow: ${props => props.theme.shadows.medium};
  }
`;

const ProjectHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
`;

const ProjectInfo = styled.div`
  flex: 1;
`;

const ProjectName = styled.h3`
  color: ${props => props.theme.colors.text};
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 5px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ProjectPath = styled.p`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 0.9rem;
  font-family: 'Courier New', monospace;
  margin-bottom: 10px;
`;

const StatusBadge = styled.div`
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  
  ${props => {
    switch (props.status) {
      case 'up-to-date':
        return `
          background: rgba(0, 255, 136, 0.2);
          color: ${props.theme.colors.success};
        `;
      case 'behind':
        return `
          background: rgba(255, 165, 2, 0.2);
          color: ${props.theme.colors.warning};
        `;
      case 'ahead':
        return `
          background: rgba(0, 212, 255, 0.2);
          color: ${props.theme.colors.primary};
        `;
      case 'diverged':
        return `
          background: rgba(255, 71, 87, 0.2);
          color: ${props.theme.colors.error};
        `;
      default:
        return `
          background: rgba(160, 160, 160, 0.2);
          color: ${props.theme.colors.textSecondary};
        `;
    }
  }}
`;

const BranchInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 15px;
  padding: 10px;
  background: rgba(30, 30, 46, 0.3);
  border-radius: ${props => props.theme.borderRadius.small};
`;

const BranchItem = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  color: ${props => props.theme.colors.textSecondary};
  font-size: 0.9rem;
`;

const CommitInfo = styled.div`
  margin-bottom: 20px;
  padding: 15px;
  background: rgba(30, 30, 46, 0.3);
  border-radius: ${props => props.theme.borderRadius.small};
`;

const CommitMessage = styled.div`
  color: ${props => props.theme.colors.text};
  font-weight: 500;
  margin-bottom: 8px;
`;

const CommitMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
  color: ${props => props.theme.colors.textSecondary};
  font-size: 0.8rem;
`;

const ProjectActions = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const SmallButton = styled(motion.button)`
  padding: 6px 12px;
  background: ${props => {
    if (props.danger) return 'rgba(255, 71, 87, 0.2)';
    if (props.success) return 'rgba(0, 255, 136, 0.2)';
    return 'rgba(0, 212, 255, 0.2)';
  }};
  color: ${props => {
    if (props.danger) return props.theme.colors.error;
    if (props.success) return props.theme.colors.success;
    return props.theme.colors.primary;
  }};
  border: 1px solid ${props => {
    if (props.danger) return props.theme.colors.error;
    if (props.success) return props.theme.colors.success;
    return props.theme.colors.primary;
  }};
  border-radius: ${props => props.theme.borderRadius.small};
  cursor: pointer;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 5px;
  
  &:hover {
    background: ${props => {
      if (props.danger) return 'rgba(255, 71, 87, 0.3)';
      if (props.success) return 'rgba(0, 255, 136, 0.3)';
      return 'rgba(0, 212, 255, 0.3)';
    }};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: ${props => props.theme.colors.textSecondary};
  text-align: center;
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

function GitManager({ servers }) {
  const [selectedServer, setSelectedServer] = useState('');
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);

  // Mock data for demonstration
  const mockProjects = [
    {
      id: 1,
      name: 'my-web-app',
      path: '/var/www/my-web-app',
      branch: 'main',
      status: 'up-to-date',
      lastCommit: {
        hash: 'a1b2c3d',
        message: 'Fix responsive design issues',
        author: 'john.doe',
        date: '2 hours ago'
      },
      branches: ['main', 'develop', 'feature/auth']
    },
    {
      id: 2,
      name: 'api-server',
      path: '/opt/api-server',
      branch: 'develop',
      status: 'behind',
      lastCommit: {
        hash: 'e4f5g6h',
        message: 'Add user authentication endpoints',
        author: 'jane.smith',
        date: '1 day ago'
      },
      branches: ['main', 'develop']
    },
    {
      id: 3,
      name: 'frontend-dashboard',
      path: '/home/user/projects/dashboard',
      branch: 'feature/charts',
      status: 'ahead',
      lastCommit: {
        hash: 'i7j8k9l',
        message: 'Implement real-time charts',
        author: 'bob.wilson',
        date: '3 hours ago'
      },
      branches: ['main', 'develop', 'feature/charts']
    }
  ];

  useEffect(() => {
    if (selectedServer) {
      fetchProjects();
    }
  }, [selectedServer]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      // Simulate API call
      setTimeout(() => {
        setProjects(mockProjects);
        setLoading(false);
      }, 1000);
    } catch (error) {
      toast.error('Failed to fetch Git projects');
      setLoading(false);
    }
  };

  const handleGitAction = async (projectId, action) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    toast.info(`${action} for ${project.name}...`);
    
    // Simulate action
    setTimeout(() => {
      switch (action) {
        case 'pull':
          toast.success(`Successfully pulled latest changes for ${project.name}`);
          break;
        case 'push':
          toast.success(`Successfully pushed changes for ${project.name}`);
          break;
        case 'fetch':
          toast.success(`Successfully fetched remote changes for ${project.name}`);
          break;
        case 'status':
          toast.info(`Git status for ${project.name}: Working tree clean`);
          break;
        default:
          toast.success(`Action ${action} completed for ${project.name}`);
      }
      fetchProjects();
    }, 1500);
  };

  const handleUpdateAll = () => {
    toast.info('Updating all Git projects...');
    projects.forEach((project, index) => {
      setTimeout(() => {
        toast.success(`Updated ${project.name}`);
        if (index === projects.length - 1) {
          toast.success('All projects updated successfully!');
          fetchProjects();
        }
      }, (index + 1) * 1000);
    });
  };

  return (
    <GitContainer>
      <GitHeader>
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

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
          <ActionButton onClick={fetchProjects} disabled={!selectedServer || loading}>
            <FiRefreshCw />
            Refresh
          </ActionButton>
          
          <ActionButton onClick={handleUpdateAll} disabled={!selectedServer || projects.length === 0}>
            <FiDownload />
            Update All
          </ActionButton>
          
          <ActionButton primary>
            <FiPlus />
            Add Repository
          </ActionButton>
        </div>
      </GitHeader>

      {!selectedServer ? (
        <EmptyState>
          <EmptyIcon>
            <FiGitBranch />
          </EmptyIcon>
          <EmptyTitle>No server selected</EmptyTitle>
          <p>Select a server to manage Git repositories</p>
        </EmptyState>
      ) : loading ? (
        <EmptyState>
          <div>Loading Git projects...</div>
        </EmptyState>
      ) : projects.length === 0 ? (
        <EmptyState>
          <EmptyIcon>
            <FiGitBranch />
          </EmptyIcon>
          <EmptyTitle>No Git projects found</EmptyTitle>
          <p>No Git repositories detected on this server.<br />Add a repository to get started.</p>
        </EmptyState>
      ) : (
        <ProjectsGrid>
          {projects.map((project, index) => (
            <ProjectCard
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <ProjectHeader>
                <ProjectInfo>
                  <ProjectName>
                    <FiFolder />
                    {project.name}
                  </ProjectName>
                  <ProjectPath>{project.path}</ProjectPath>
                </ProjectInfo>
                <StatusBadge status={project.status}>
                  {project.status}
                </StatusBadge>
              </ProjectHeader>

              <BranchInfo>
                <BranchItem>
                  <FiGitBranch />
                  <strong>{project.branch}</strong>
                </BranchItem>
                <BranchItem>
                  <span>{project.branches.length} branches</span>
                </BranchItem>
              </BranchInfo>

              <CommitInfo>
                <CommitMessage>{project.lastCommit.message}</CommitMessage>
                <CommitMeta>
                  <span>
                    <FiGitCommit style={{ marginRight: '4px' }} />
                    {project.lastCommit.hash}
                  </span>
                  <span>
                    <FiUser style={{ marginRight: '4px' }} />
                    {project.lastCommit.author}
                  </span>
                  <span>
                    <FiClock style={{ marginRight: '4px' }} />
                    {project.lastCommit.date}
                  </span>
                </CommitMeta>
              </CommitInfo>

              <ProjectActions>
                <SmallButton
                  success
                  onClick={() => handleGitAction(project.id, 'pull')}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FiDownload />
                  Pull
                </SmallButton>
                
                <SmallButton
                  onClick={() => handleGitAction(project.id, 'push')}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FiUpload />
                  Push
                </SmallButton>
                
                <SmallButton
                  onClick={() => handleGitAction(project.id, 'fetch')}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FiRefreshCw />
                  Fetch
                </SmallButton>
                
                <SmallButton
                  onClick={() => handleGitAction(project.id, 'status')}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Status
                </SmallButton>
              </ProjectActions>
            </ProjectCard>
          ))}
        </ProjectsGrid>
      )}
    </GitContainer>
  );
}

export default GitManager;
