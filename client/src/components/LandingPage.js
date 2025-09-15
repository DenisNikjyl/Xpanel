import React from 'react';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { motion } from 'framer-motion';
import { FiServer, FiShield, FiZap, FiMonitor, FiTerminal, FiFolder, FiGitBranch, FiUsers, FiPlay, FiArrowRight, FiStar, FiTrendingUp } from 'react-icons/fi';

// Анимации
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

const gradientShift = keyframes`
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
`;

// Styled Components
const LandingContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
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
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(0, 212, 255, 0.1) 0%, transparent 50%);
    animation: ${pulse} 4s ease-in-out infinite;
  }
  
  &::after {
    content: '';
    position: absolute;
    bottom: -50%;
    right: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(0, 153, 204, 0.05) 0%, transparent 50%);
    animation: ${pulse} 6s ease-in-out infinite reverse;
  }
`;

const Header = styled.header`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: rgba(10, 10, 10, 0.9);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 212, 255, 0.1);
`;

const Nav = styled.nav`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  max-width: 1200px;
  margin: 0 auto;
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.5rem;
  font-weight: bold;
  color: #00d4ff;
  
  svg {
    font-size: 2rem;
    animation: ${float} 3s ease-in-out infinite;
  }
`;

const NavButtons = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
`;

const HeroSection = styled.section`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
  position: relative;
  z-index: 2;
`;

const HeroContent = styled(motion.div)`
  text-align: center;
  max-width: 900px;
  z-index: 3;
`;

const Title = styled.h1`
  font-size: 4rem;
  margin-bottom: 1rem;
  color: white;
  line-height: 1.2;
  
  @media (max-width: 768px) {
    font-size: 2.5rem;
  }
`;

const GradientText = styled.span`
  background: linear-gradient(135deg, #00d4ff 0%, #0099cc 50%, #00ff88 100%);
  background-size: 200% 200%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: ${gradientShift} 3s ease infinite;
`;

const Subtitle = styled.p`
  font-size: 1.3rem;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 3rem;
  line-height: 1.6;
  max-width: 700px;
  margin-left: auto;
  margin-right: auto;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 1.5rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 4rem;
`;

const PrimaryButton = styled(motion.button)`
  padding: 1.2rem 2.5rem;
  background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
  color: #0a0a0a;
  border: none;
  border-radius: 12px;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 4px 15px rgba(0, 212, 255, 0.3);
  
  &:hover {
    box-shadow: 0 6px 20px rgba(0, 212, 255, 0.4);
    transform: translateY(-2px);
  }
`;

const SecondaryButton = styled(motion.button)`
  padding: 1.2rem 2.5rem;
  background: transparent;
  color: #00d4ff;
  border: 2px solid #00d4ff;
  border-radius: 12px;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(0, 212, 255, 0.1);
    transform: translateY(-2px);
  }
`;

const StatsSection = styled.section`
  padding: 4rem 2rem;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(0, 212, 255, 0.1);
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 2rem;
  max-width: 800px;
  margin: 0 auto;
`;

const StatCard = styled(motion.div)`
  text-align: center;
  padding: 2rem 1rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 16px;
  border: 1px solid rgba(0, 212, 255, 0.1);
  backdrop-filter: blur(10px);
  
  &:hover {
    border-color: rgba(0, 212, 255, 0.3);
    transform: translateY(-5px);
  }
`;

const StatNumber = styled.div`
  font-size: 2.5rem;
  font-weight: bold;
  color: #00d4ff;
  margin-bottom: 0.5rem;
`;

const StatLabel = styled.div`
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const IconsContainer = styled(motion.div)`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 800px;
  height: 800px;
  pointer-events: none;
  z-index: 1;
`;

const FloatingIcon = styled.div`
  position: absolute;
  color: rgba(0, 212, 255, 0.2);
  font-size: 4rem;
  animation: ${float} 4s ease-in-out infinite;
  
  &:nth-child(1) {
    top: 15%;
    left: 15%;
    animation-delay: 0s;
  }
  &:nth-child(2) {
    top: 15%;
    right: 15%;
    animation-delay: 1s;
  }
  &:nth-child(3) {
    bottom: 15%;
    left: 15%;
    animation-delay: 2s;
  }
  &:nth-child(4) {
    bottom: 15%;
    right: 15%;
    animation-delay: 3s;
  }
  &:nth-child(5) {
    top: 50%;
    left: 10%;
    animation-delay: 0.5s;
  }
  &:nth-child(6) {
    top: 50%;
    right: 10%;
    animation-delay: 1.5s;
  }
`;

const FeaturesSection = styled.section`
  padding: 6rem 2rem;
  background: rgba(0, 0, 0, 0.3);
  position: relative;
  z-index: 2;
`;

const SectionTitle = styled.h2`
  text-align: center;
  font-size: 2.5rem;
  margin-bottom: 1rem;
  color: white;
`;

const SectionSubtitle = styled.p`
  text-align: center;
  font-size: 1.2rem;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 4rem;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
`;

const FeaturesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
`;

const FeatureCard = styled(motion.div)`
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: 16px;
  padding: 2.5rem;
  text-align: center;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-5px);
    border-color: rgba(0, 212, 255, 0.4);
    box-shadow: 0 10px 30px rgba(0, 212, 255, 0.1);
  }
`;

const FeatureIcon = styled.div`
  color: #00d4ff;
  font-size: 3.5rem;
  margin-bottom: 1.5rem;
  animation: ${float} 3s ease-in-out infinite;
`;

const FeatureTitle = styled.h3`
  color: white;
  font-size: 1.4rem;
  margin-bottom: 1rem;
  font-weight: 600;
`;

const FeatureDescription = styled.p`
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
  font-size: 1rem;
`;

const CheckmarkList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
  margin: 3rem 0;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
`;

const CheckmarkItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: rgba(255, 255, 255, 0.8);
  font-size: 1rem;
  
  &::before {
    content: '✓';
    color: #00ff88;
    font-weight: bold;
    font-size: 1.2rem;
  }
`;

function LandingPage() {
  const navigate = useNavigate();

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
            <PrimaryButton
              onClick={() => navigate('/auth')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem' }}
            >
              Войти в панель
            </PrimaryButton>
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
            Управляйте VPS серверами
            <br />
            <GradientText>легко и профессионально</GradientText>
          </Title>
          <Subtitle>
            Xpanel - современная панель управления Linux серверами с автоустановкой и real-time мониторингом. 
            Полный контроль над вашей инфраструктурой в одном интерфейсе.
          </Subtitle>

          <ButtonGroup>
            <PrimaryButton
              onClick={() => navigate('/auth')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FiPlay />
              Начать работу
            </PrimaryButton>
            <SecondaryButton
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Узнать больше
              <FiArrowRight />
            </SecondaryButton>
          </ButtonGroup>

          <CheckmarkList>
            <CheckmarkItem>Автоматическая установка на любой Linux сервер</CheckmarkItem>
            <CheckmarkItem>Real-time мониторинг ресурсов и производительности</CheckmarkItem>
            <CheckmarkItem>Веб-терминал SSH прямо в браузере</CheckmarkItem>
            <CheckmarkItem>Файловый менеджер с редактированием кода</CheckmarkItem>
            <CheckmarkItem>Git интеграция для разработчиков</CheckmarkItem>
            <CheckmarkItem>Многопользовательский доступ с ролями</CheckmarkItem>
          </CheckmarkList>
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
          <FloatingIcon><FiFolder /></FloatingIcon>
          <FloatingIcon><FiGitBranch /></FloatingIcon>
        </IconsContainer>
      </HeroSection>

      <StatsSection>
        <StatsGrid>
          <StatCard
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <StatNumber>99.9%</StatNumber>
            <StatLabel>Uptime</StatLabel>
          </StatCard>
          
          <StatCard
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <StatNumber>1000+</StatNumber>
            <StatLabel>Серверов</StatLabel>
          </StatCard>
          
          <StatCard
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <StatNumber>24/7</StatNumber>
            <StatLabel>Поддержка</StatLabel>
          </StatCard>
          
          <StatCard
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <StatNumber>5 мин</StatNumber>
            <StatLabel>Установка</StatLabel>
          </StatCard>
        </StatsGrid>
      </StatsSection>

      <FeaturesSection>
        <SectionTitle>Возможности Xpanel</SectionTitle>
        <SectionSubtitle>
          Полный набор инструментов для профессионального управления серверами
        </SectionSubtitle>
        
        <FeaturesGrid>
          <FeatureCard
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <FeatureIcon><FiZap /></FeatureIcon>
            <FeatureTitle>Автоматическая установка</FeatureTitle>
            <FeatureDescription>
              Установка на любой Linux сервер одним кликом с real-time логированием процесса установки
            </FeatureDescription>
          </FeatureCard>

          <FeatureCard
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <FeatureIcon><FiMonitor /></FeatureIcon>
            <FeatureTitle>Real-time мониторинг</FeatureTitle>
            <FeatureDescription>
              Отслеживание CPU, RAM, дискового пространства и сетевой активности в реальном времени
            </FeatureDescription>
          </FeatureCard>

          <FeatureCard
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <FeatureIcon><FiTerminal /></FeatureIcon>
            <FeatureTitle>SSH Терминал</FeatureTitle>
            <FeatureDescription>
              Полноценный веб-терминал с SSH доступом, множественными сессиями и историей команд
            </FeatureDescription>
          </FeatureCard>

          <FeatureCard
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <FeatureIcon><FiFolder /></FeatureIcon>
            <FeatureTitle>Файловый менеджер</FeatureTitle>
            <FeatureDescription>
              Просмотр, загрузка, редактирование файлов с встроенным редактором кода и поддержкой архивов
            </FeatureDescription>
          </FeatureCard>

          <FeatureCard
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <FeatureIcon><FiGitBranch /></FeatureIcon>
            <FeatureTitle>Git интеграция</FeatureTitle>
            <FeatureDescription>
              Управление репозиториями, ветками, коммитами и автоматическое развертывание проектов
            </FeatureDescription>
          </FeatureCard>

          <FeatureCard
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <FeatureIcon><FiUsers /></FeatureIcon>
            <FeatureTitle>Многопользовательский доступ</FeatureTitle>
            <FeatureDescription>
              Ролевая система доступа, командная работа и аудит действий пользователей
            </FeatureDescription>
          </FeatureCard>
        </FeaturesGrid>
      </FeaturesSection>
    </LandingContainer>
  );
}

export default LandingPage;
