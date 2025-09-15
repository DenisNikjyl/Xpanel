import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { motion } from 'framer-motion';
import { FiUser, FiLock, FiMail, FiEye, FiEyeOff, FiServer } from 'react-icons/fi';
import toast from 'react-hot-toast';

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

const pulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
`;

// Styled Components
const AuthContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
  display: flex;
  align-items: center;
  justify-content: center;
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

const AuthCard = styled(motion.div)`
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: 20px;
  padding: 3rem;
  backdrop-filter: blur(20px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 450px;
  z-index: 2;
  position: relative;
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 2rem;
  
  svg {
    font-size: 2.5rem;
    color: #00d4ff;
  }
  
  span {
    font-size: 2rem;
    font-weight: bold;
    color: #00d4ff;
  }
`;

const Title = styled.h1`
  text-align: center;
  color: white;
  font-size: 1.8rem;
  margin-bottom: 0.5rem;
  font-weight: 600;
`;

const Subtitle = styled.p`
  text-align: center;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 2rem;
  font-size: 0.95rem;
`;

const TabContainer = styled.div`
  display: flex;
  margin-bottom: 2rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 0.25rem;
`;

const Tab = styled.button`
  flex: 1;
  padding: 0.75rem;
  background: ${props => props.active ? 'linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)' : 'transparent'};
  color: ${props => props.active ? '#0a0a0a' : 'rgba(255, 255, 255, 0.7)'};
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    color: ${props => props.active ? '#0a0a0a' : 'white'};
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const InputGroup = styled.div`
  position: relative;
`;

const InputIcon = styled.div`
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(255, 255, 255, 0.5);
  z-index: 1;
`;

const Input = styled.input`
  width: 100%;
  padding: 1rem 1rem 1rem 3rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(0, 212, 255, 0.3);
  border-radius: 12px;
  color: white;
  font-size: 1rem;
  transition: all 0.3s ease;
  
  &::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }
  
  &:focus {
    outline: none;
    border-color: #00d4ff;
    box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.1);
    background: rgba(255, 255, 255, 0.15);
  }
`;

const PasswordToggle = styled.button`
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  padding: 0.25rem;
  
  &:hover {
    color: #00d4ff;
  }
`;

const SubmitButton = styled(motion.button)`
  width: 100%;
  padding: 1rem;
  background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
  color: #0a0a0a;
  border: none;
  border-radius: 12px;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 212, 255, 0.3);
  
  &:hover {
    box-shadow: 0 6px 20px rgba(0, 212, 255, 0.4);
    transform: translateY(-2px);
  }
  
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }
`;

const BackButton = styled(motion.button)`
  position: absolute;
  top: 2rem;
  left: 2rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(0, 212, 255, 0.3);
  border-radius: 12px;
  color: white;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  z-index: 3;
  
  &:hover {
    background: rgba(0, 212, 255, 0.1);
    border-color: #00d4ff;
  }
`;

const ErrorMessage = styled.div`
  color: #ff4757;
  font-size: 0.9rem;
  margin-top: 0.5rem;
  text-align: center;
`;

function Auth({ onLogin }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Очистить ошибку при изменении поля
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (activeTab === 'register') {
      if (!formData.username.trim()) {
        newErrors.username = 'Имя пользователя обязательно';
      }
      if (!formData.email.trim()) {
        newErrors.email = 'Email обязателен';
      } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
        newErrors.email = 'Некорректный email';
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Пароли не совпадают';
      }
    } else {
      if (!formData.username.trim()) {
        newErrors.username = 'Имя пользователя или email обязательно';
      }
    }

    if (!formData.password.trim()) {
      newErrors.password = 'Пароль обязателен';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Пароль должен содержать минимум 6 символов';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const endpoint = activeTab === 'login' ? '/api/login' : '/api/register';
      const payload = activeTab === 'login' 
        ? { username: formData.username, password: formData.password }
        : { username: formData.username, email: formData.email, password: formData.password };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('xpanel_token', data.token);
        localStorage.setItem('xpanel_user', JSON.stringify(data.user));
        
        if (onLogin) {
          onLogin(data.user, data.token);
        }
        
        toast.success(activeTab === 'login' ? 'Успешный вход!' : 'Регистрация завершена!');
        navigate('/dashboard');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Произошла ошибка');
      }
    } catch (error) {
      toast.error('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    setErrors({});
    setFormData({
      username: '',
      email: '',
      password: '',
      confirmPassword: ''
    });
  };

  return (
    <AuthContainer>
      <BackgroundElements />
      
      <BackButton
        onClick={() => navigate('/')}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        ← Назад
      </BackButton>

      <AuthCard
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Logo>
          <FiServer />
          <span>Xpanel</span>
        </Logo>

        <Title>
          {activeTab === 'login' ? 'Вход в систему' : 'Регистрация'}
        </Title>
        <Subtitle>
          {activeTab === 'login' 
            ? 'Войдите в свою учетную запись для управления серверами'
            : 'Создайте новую учетную запись для начала работы'
          }
        </Subtitle>

        <TabContainer>
          <Tab 
            active={activeTab === 'login'} 
            onClick={() => switchTab('login')}
            type="button"
          >
            Вход
          </Tab>
          <Tab 
            active={activeTab === 'register'} 
            onClick={() => switchTab('register')}
            type="button"
          >
            Регистрация
          </Tab>
        </TabContainer>

        <Form onSubmit={handleSubmit}>
          <InputGroup>
            <InputIcon>
              <FiUser />
            </InputIcon>
            <Input
              type="text"
              name="username"
              placeholder={activeTab === 'login' ? 'Имя пользователя или email' : 'Имя пользователя'}
              value={formData.username}
              onChange={handleInputChange}
            />
            {errors.username && <ErrorMessage>{errors.username}</ErrorMessage>}
          </InputGroup>

          {activeTab === 'register' && (
            <InputGroup>
              <InputIcon>
                <FiMail />
              </InputIcon>
              <Input
                type="email"
                name="email"
                placeholder="Email адрес"
                value={formData.email}
                onChange={handleInputChange}
              />
              {errors.email && <ErrorMessage>{errors.email}</ErrorMessage>}
            </InputGroup>
          )}

          <InputGroup>
            <InputIcon>
              <FiLock />
            </InputIcon>
            <Input
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="Пароль"
              value={formData.password}
              onChange={handleInputChange}
            />
            <PasswordToggle
              type="button"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <FiEyeOff /> : <FiEye />}
            </PasswordToggle>
            {errors.password && <ErrorMessage>{errors.password}</ErrorMessage>}
          </InputGroup>

          {activeTab === 'register' && (
            <InputGroup>
              <InputIcon>
                <FiLock />
              </InputIcon>
              <Input
                type={showPassword ? 'text' : 'password'}
                name="confirmPassword"
                placeholder="Подтвердите пароль"
                value={formData.confirmPassword}
                onChange={handleInputChange}
              />
              {errors.confirmPassword && <ErrorMessage>{errors.confirmPassword}</ErrorMessage>}
            </InputGroup>
          )}

          <SubmitButton
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? 'Загрузка...' : (activeTab === 'login' ? 'Войти' : 'Зарегистрироваться')}
          </SubmitButton>
        </Form>
      </AuthCard>
    </AuthContainer>
  );
}

export default Auth;
