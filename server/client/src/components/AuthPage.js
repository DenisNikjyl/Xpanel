import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { FiUser, FiMail, FiLock, FiEye, FiEyeOff, FiServer } from 'react-icons/fi';
import toast from 'react-hot-toast';
import axios from 'axios';

const AuthContainer = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => props.theme.gradients.background};
  padding: 20px;
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
    top: 20%;
    right: 10%;
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, rgba(0, 212, 255, 0.1) 0%, transparent 70%);
    border-radius: 50%;
  }
  
  &::after {
    content: '';
    position: absolute;
    bottom: 20%;
    left: 10%;
    width: 200px;
    height: 200px;
    background: radial-gradient(circle, rgba(0, 212, 255, 0.05) 0%, transparent 70%);
    border-radius: 50%;
  }
`;

const AuthCard = styled(motion.div)`
  background: ${props => props.theme.gradients.card};
  padding: 40px;
  border-radius: ${props => props.theme.borderRadius.large};
  box-shadow: ${props => props.theme.shadows.large};
  border: 1px solid rgba(0, 212, 255, 0.2);
  width: 100%;
  max-width: 400px;
  position: relative;
  z-index: 10;
  backdrop-filter: blur(10px);
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 30px;
  font-size: 24px;
  font-weight: 700;
  color: ${props => props.theme.colors.primary};
`;

const Title = styled.h2`
  text-align: center;
  margin-bottom: 30px;
  color: ${props => props.theme.colors.text};
  font-size: 1.8rem;
  font-weight: 600;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const InputGroup = styled.div`
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
  padding: 15px 15px 15px 45px;
  border: 2px solid rgba(0, 212, 255, 0.2);
  border-radius: ${props => props.theme.borderRadius.medium};
  background: rgba(30, 30, 46, 0.5);
  color: ${props => props.theme.colors.text};
  font-size: 16px;
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

const SubmitButton = styled(motion.button)`
  width: 100%;
  padding: 15px;
  background: ${props => props.theme.gradients.primary};
  color: white;
  border: none;
  border-radius: ${props => props.theme.borderRadius.medium};
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const SwitchMode = styled.div`
  text-align: center;
  margin-top: 20px;
  color: ${props => props.theme.colors.textSecondary};
  
  button {
    background: none;
    border: none;
    color: ${props => props.theme.colors.primary};
    cursor: pointer;
    font-weight: 600;
    text-decoration: underline;
    
    &:hover {
      color: #0099cc;
    }
  }
`;

const ErrorMessage = styled.div`
  color: ${props => props.theme.colors.error};
  font-size: 14px;
  margin-top: 5px;
`;

function AuthPage({ onLogin }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') || 'login';
  
  const [mode, setMode] = useState(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }
    
    if (mode === 'register' && !formData.email.trim()) {
      newErrors.email = 'Email is required';
    }
    
    if (mode === 'register' && formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }
    
    if (mode === 'register' && formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
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
      const endpoint = mode === 'login' ? '/api/login' : '/api/register';
      const response = await axios.post(endpoint, formData);
      
      toast.success(mode === 'login' ? 'Welcome back!' : 'Account created successfully!');
      onLogin(response.data.user, response.data.token);
      navigate('/dashboard');
    } catch (error) {
      const message = error.response?.data?.error || 'Something went wrong';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setErrors({});
    setFormData({
      username: '',
      email: '',
      password: ''
    });
  };

  return (
    <AuthContainer>
      <BackgroundElements />
      
      <AuthCard
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Logo>
          <FiServer />
          Xpanel
        </Logo>
        
        <Title>
          {mode === 'login' ? 'Welcome Back' : 'Create Account'}
        </Title>
        
        <Form onSubmit={handleSubmit}>
          <InputGroup>
            <InputIcon>
              <FiUser />
            </InputIcon>
            <Input
              type="text"
              name="username"
              placeholder="Username"
              value={formData.username}
              onChange={handleInputChange}
            />
            {errors.username && <ErrorMessage>{errors.username}</ErrorMessage>}
          </InputGroup>
          
          {mode === 'register' && (
            <InputGroup>
              <InputIcon>
                <FiMail />
              </InputIcon>
              <Input
                type="email"
                name="email"
                placeholder="Email"
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
              placeholder="Password"
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
          
          <SubmitButton
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? 'Please wait...' : (mode === 'login' ? 'Sign In' : 'Create Account')}
          </SubmitButton>
        </Form>
        
        <SwitchMode>
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button type="button" onClick={switchMode}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" onClick={switchMode}>
                Sign in
              </button>
            </>
          )}
        </SwitchMode>
      </AuthCard>
    </AuthContainer>
  );
}

export default AuthPage;
