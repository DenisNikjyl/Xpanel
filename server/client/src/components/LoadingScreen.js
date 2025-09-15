import React from 'react';
import styled, { keyframes } from 'styled-components';
import { motion } from 'framer-motion';
import { FiServer } from 'react-icons/fi';

const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: ${props => props.theme.gradients.background};
  position: relative;
  overflow: hidden;
`;

const BackgroundEffect = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 200px;
  height: 200px;
  border: 2px solid rgba(0, 212, 255, 0.2);
  border-radius: 50%;
  animation: ${spin} 3s linear infinite;
  
  &::before {
    content: '';
    position: absolute;
    top: -20px;
    left: -20px;
    right: -20px;
    bottom: -20px;
    border: 1px solid rgba(0, 212, 255, 0.1);
    border-radius: 50%;
    animation: ${spin} 4s linear infinite reverse;
  }
`;

const LogoContainer = styled(motion.div)`
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 10;
`;

const Logo = styled.div`
  font-size: 48px;
  color: ${props => props.theme.colors.primary};
  margin-bottom: 20px;
  animation: ${pulse} 2s ease-in-out infinite;
`;

const Title = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin-bottom: 10px;
  text-align: center;
`;

const Subtitle = styled.p`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 1rem;
  text-align: center;
  margin-bottom: 40px;
`;

const LoadingBar = styled.div`
  width: 200px;
  height: 4px;
  background: rgba(0, 212, 255, 0.2);
  border-radius: 2px;
  overflow: hidden;
  position: relative;
`;

const LoadingProgress = styled(motion.div)`
  height: 100%;
  background: ${props => props.theme.gradients.primary};
  border-radius: 2px;
`;

function LoadingScreen() {
  return (
    <LoadingContainer>
      <BackgroundEffect />
      
      <LogoContainer
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
      >
        <Logo>
          <FiServer />
        </Logo>
        
        <Title>Xpanel</Title>
        <Subtitle>VPS Management System</Subtitle>
        
        <LoadingBar>
          <LoadingProgress
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 1.5, ease: 'easeInOut' }}
          />
        </LoadingBar>
      </LogoContainer>
    </LoadingContainer>
  );
}

export default LoadingScreen;
