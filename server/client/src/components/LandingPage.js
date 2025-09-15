import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { motion } from 'framer-motion';
import { FiServer, FiShield, FiZap, FiMonitor, FiTerminal, FiFolder, FiGitBranch, FiUsers } from 'react-icons/fi';
import toast from 'react-hot-toast';
import EmailVerification from './EmailVerification';

const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const float = keyframes`
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
`;

const pulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
`;

const LandingContainer = styled.div`
  min-height: 100vh;
  background: ${props => props.theme.gradients.background};
  position: relative;
  overflow: hidden;
`;

const BackgroundElements = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  
  &::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -50%;
    width: 100%;
    height: 100%;
    background: radial-gradient(circle, rgba(0, 212, 255, 0.1) 0%, transparent 70%);
    animation: ${pulse} 4s ease-in-out infinite;
  }
  
  &::after {
    content: '';
    position: absolute;
    bottom: -50%;
    left: -50%;
    width: 100%;
    height: 100%;
    background: radial-gradient(circle, rgba(0, 212, 255, 0.05) 0%, transparent 70%);
    animation: ${pulse} 6s ease-in-out infinite reverse;
  }
`;

const Header = styled.header`
  position: relative;
  z-index: 10;
  padding: 20px 0;
  background: rgba(10, 10, 10, 0.8);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 212, 255, 0.2);
`;

const Nav = styled.nav`
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Logo = styled.div`
  font-size: 24px;
  font-weight: 700;
  color: ${props => props.theme.colors.primary};
  display: flex;
  align-items: center;
  gap: 10px;
`;

const NavButtons = styled.div`
  display: flex;
  gap: 15px;
`;

const Button = styled(motion.button)`
  padding: 12px 24px;
  border: none;
  border-radius: ${props => props.theme.borderRadius.medium};
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 14px;
  
  ${props => props.primary ? `
    background: ${props.theme.gradients.primary};
    color: white;
    box-shadow: ${props.theme.shadows.medium};
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: ${props.theme.shadows.large};
    }
  ` : `
    background: transparent;
    color: ${props.theme.colors.text};
    border: 2px solid ${props.theme.colors.primary};
    
    &:hover {
      background: ${props.theme.colors.primary};
      color: ${props.theme.colors.background};
    }
  `}
`;

const HeroSection = styled.section`
  position: relative;
  z-index: 5;
  max-width: 1200px;
  margin: 0 auto;
  padding: 100px 20px;
  text-align: center;
`;

const HeroTitle = styled(motion.h1)`
  font-size: clamp(2.5rem, 5vw, 4rem);
  font-weight: 700;
  margin-bottom: 20px;
  background: linear-gradient(135deg, #ffffff 0%, #00D4FF 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1.2;
`;

const HeroSubtitle = styled(motion.p)`
  font-size: clamp(1.1rem, 2vw, 1.3rem);
  color: ${props => props.theme.colors.textSecondary};
  margin-bottom: 40px;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.6;
`;

const HeroButtons = styled(motion.div)`
  display: flex;
  gap: 20px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 80px;
`;

const IconsContainer = styled(motion.div)`
  display: flex;
  justify-content: center;
  gap: 30px;
  margin-bottom: 80px;
  flex-wrap: wrap;
`;

const FloatingIcon = styled(motion.div)`
  width: 60px;
  height: 60px;
  background: ${props => props.theme.gradients.card};
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.theme.colors.primary};
  font-size: 24px;
  box-shadow: ${props => props.theme.shadows.medium};
  animation: ${float} 3s ease-in-out infinite;
  
  &:nth-child(2) { animation-delay: 0.5s; }
  &:nth-child(3) { animation-delay: 1s; }
  &:nth-child(4) { animation-delay: 1.5s; }
`;

const FeaturesSection = styled.section`
  position: relative;
  z-index: 5;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px 100px;
`;

const FeaturesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 30px;
  margin-bottom: 60px;
`;

const FeatureCard = styled(motion.div)`
  background: ${props => props.theme.gradients.card};
  padding: 30px;
  border-radius: ${props => props.theme.borderRadius.large};
  box-shadow: ${props => props.theme.shadows.medium};
  border: 1px solid rgba(0, 212, 255, 0.1);
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-5px);
    box-shadow: ${props => props.theme.shadows.large};
    border-color: rgba(0, 212, 255, 0.3);
  }
`;

const FeatureIcon = styled.div`
  width: 50px;
  height: 50px;
  background: ${props => props.theme.gradients.primary};
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 20px;
  margin-bottom: 20px;
`;

const FeatureTitle = styled.h3`
  font-size: 1.3rem;
  font-weight: 600;
  margin-bottom: 15px;
  color: ${props => props.theme.colors.text};
`;

const FeatureDescription = styled.p`
  color: ${props => props.theme.colors.textSecondary};
  line-height: 1.6;
`;

function LandingPage() {
  const navigate = useNavigate();

  const features = [
    {
      icon: <FiZap />,
      title: "Автоматическая установка",
      description: "Установка на любой Linux сервер одним кликом с real-time логированием процесса"
    },
    {
      icon: <FiMonitor />,
      title: "Real-time мониторинг",
      description: "Мониторинг ресурсов и производительности в реальном времени с красивыми графиками"
    },
    {
      icon: <FiTerminal />,
      title: "Веб-терминал SSH",
      description: "Полноценный SSH терминал прямо в браузере с поддержкой множественных сессий"
    },
    {
      icon: <FiFolder />,
      title: "Файловый менеджер",
      description: "Управление файлами с встроенным редактором кода и поддержкой архивов"
    },
    {
      icon: <FiGitBranch />,
      title: "Git интеграция",
      description: "Полная интеграция с Git для разработчиков с автоматическими обновлениями"
    },
    {
      icon: <FiUsers />,
      title: "Многопользовательский доступ",
      description: "Система ролей и прав доступа для командной работы с серверами"
    }
  ];

  return (
    <LandingContainer>
      <BackgroundElements />
      
      <Header>
        <Nav>
          <Logo>
            <FiServer />
            Xpanel
          </Logo>
          <NavButtons>
            <form onSubmit={handleLogin}>
              <input
                type="text"
                placeholder="Имя пользователя или email"
                value={loginData.username}
                onChange={(e) => setLoginData({...loginData, username: e.target.value})}
                required
              />
              <input
                type="password"
                placeholder="Пароль"
                value={loginData.password}
                onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                required
              />
              <button type="submit">Войти</button>
            </form>
          </NavButtons>
        </Nav>
      </Header>

      <HeroSection>
        <HeroContent
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <Title>
            <GradientText>Xpanel</GradientText>
            <br />
            Система управления VPS
          </Title>
          <Subtitle>
            Профессиональное управление серверами с мониторингом в реальном времени, 
            SSH доступом и инструментами автоматического развертывания
          </Subtitle>
          <ButtonGroup>
            <PrimaryButton
              onClick={() => navigate('/auth')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Начать работу
            </PrimaryButton>
            <SecondaryButton
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Узнать больше
            </SecondaryButton>
          </ButtonGroup>
        </HeroContent>

        <IconsContainer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
        >
          <FloatingIcon><FiServer /></FloatingIcon>
          <FloatingIcon><FiMonitor /></FloatingIcon>
          <FloatingIcon><FiTerminal /></FloatingIcon>
          <FloatingIcon><FiShield /></FloatingIcon>
        </IconsContainer>
      </HeroSection>

      <FeaturesSection>
        <FeaturesGrid>
          <FeatureCard
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <FeatureIcon><FiServer /></FeatureIcon>
            <FeatureTitle>Управление серверами</FeatureTitle>
            <FeatureDescription>
              Централизованное управление всеми VPS с мониторингом статуса в реальном времени
            </FeatureDescription>
          </FeatureCard>

          <FeatureCard
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
          >
            <FeatureIcon><FiMonitor /></FeatureIcon>
            <FeatureTitle>Мониторинг в реальном времени</FeatureTitle>
            <FeatureDescription>
              Отслеживание CPU, RAM, дискового пространства и сетевой активности на всех серверах
            </FeatureDescription>
          </FeatureCard>

          <FeatureCard
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
          >
            <FeatureIcon><FiTerminal /></FeatureIcon>
            <FeatureTitle>SSH Терминал</FeatureTitle>
            <FeatureDescription>
              Прямой SSH доступ к серверам через веб-интерфейс
            </FeatureDescription>
          </FeatureCard>

          <FeatureCard
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
          >
            <FeatureIcon><FiFolder /></FeatureIcon>
            <FeatureTitle>Файловый менеджер</FeatureTitle>
            <FeatureDescription>
              Просмотр, загрузка, скачивание и управление файлами на серверах
            </FeatureDescription>
          </FeatureCard>

          <FeatureCard
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
          >
            <FeatureIcon><FiGitBranch /></FeatureIcon>
            <FeatureTitle>Git интеграция</FeatureTitle>
            <FeatureDescription>
              Развертывание и управление репозиториями кода прямо из панели
            </FeatureDescription>
          </FeatureCard>

          <FeatureCard
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.3 }}
          >
            <FeatureIcon><FiShield /></FeatureIcon>
            <FeatureTitle>Безопасность</FeatureTitle>
            <FeatureDescription>
              Расширенные функции безопасности с ролевым контролем доступа
            </FeatureDescription>
          </FeatureCard>
        </FeaturesGrid>
      </FeaturesSection>
    </LandingContainer>
  );
}

export default LandingPage;
