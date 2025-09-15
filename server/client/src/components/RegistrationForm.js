import React, { useState } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { FiUser, FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import toast from 'react-hot-toast';

const FormContainer = styled(motion.div)`
  background: rgba(20, 20, 20, 0.9);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: 20px;
  padding: 40px;
  max-width: 400px;
  width: 100%;
`;

const Title = styled.h2`
  color: #ffffff;
  font-size: 28px;
  margin-bottom: 30px;
  text-align: center;
`;

const InputGroup = styled.div`
  position: relative;
  margin-bottom: 20px;
`;

const Input = styled.input`
  width: 100%;
  padding: 15px 50px 15px 15px;
  background: rgba(40, 40, 40, 0.8);
  border: 2px solid rgba(0, 212, 255, 0.3);
  border-radius: 10px;
  color: #ffffff;
  font-size: 16px;
  transition: all 0.3s ease;
  
  &:focus {
    outline: none;
    border-color: #00d4ff;
    box-shadow: 0 0 20px rgba(0, 212, 255, 0.3);
  }
  
  &::placeholder {
    color: #666;
  }
`;

const InputIcon = styled.div`
  position: absolute;
  right: 15px;
  top: 50%;
  transform: translateY(-50%);
  color: #666;
  cursor: ${props => props.clickable ? 'pointer' : 'default'};
  
  &:hover {
    color: ${props => props.clickable ? '#00d4ff' : '#666'};
  }
`;

const Button = styled(motion.button)`
  width: 100%;
  padding: 15px;
  background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
  border: none;
  border-radius: 10px;
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 20px;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 25px rgba(0, 212, 255, 0.3);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const BackButton = styled(motion.button)`
  background: transparent;
  border: 1px solid rgba(0, 212, 255, 0.3);
  border-radius: 10px;
  color: #00d4ff;
  padding: 12px 20px;
  cursor: pointer;
  margin-top: 15px;
  width: 100%;
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(0, 212, 255, 0.1);
    border-color: #00d4ff;
  }
`;

const PasswordStrength = styled.div`
  margin-top: 5px;
  font-size: 12px;
  color: ${props => {
    switch(props.strength) {
      case 'weak': return '#ff6b6b';
      case 'medium': return '#feca57';
      case 'strong': return '#48dbfb';
      default: return '#666';
    }
  }};
`;

const RegistrationForm = ({ onRegister, onBack }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const getPasswordStrength = (password) => {
    if (password.length < 6) return 'weak';
    if (password.length < 10) return 'medium';
    if (password.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)) {
      return 'strong';
    }
    return 'medium';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Пароли не совпадают');
      return;
    }
    
    if (formData.password.length < 6) {
      toast.error('Пароль должен содержать минимум 6 символов');
      return;
    }
    
    setLoading(true);
    await onRegister(formData);
    setLoading(false);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <FormContainer
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Title>Регистрация</Title>
      
      <form onSubmit={handleSubmit}>
        <InputGroup>
          <Input
            type="text"
            name="username"
            placeholder="Имя пользователя"
            value={formData.username}
            onChange={handleChange}
            required
          />
          <InputIcon>
            <FiUser />
          </InputIcon>
        </InputGroup>
        
        <InputGroup>
          <Input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
          />
          <InputIcon>
            <FiMail />
          </InputIcon>
        </InputGroup>
        
        <InputGroup>
          <Input
            type={showPassword ? 'text' : 'password'}
            name="password"
            placeholder="Пароль"
            value={formData.password}
            onChange={handleChange}
            required
          />
          <InputIcon 
            clickable 
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <FiEyeOff /> : <FiEye />}
          </InputIcon>
          {formData.password && (
            <PasswordStrength strength={getPasswordStrength(formData.password)}>
              Сложность пароля: {
                getPasswordStrength(formData.password) === 'weak' ? 'Слабый' :
                getPasswordStrength(formData.password) === 'medium' ? 'Средний' : 'Сильный'
              }
            </PasswordStrength>
          )}
        </InputGroup>
        
        <InputGroup>
          <Input
            type={showConfirmPassword ? 'text' : 'password'}
            name="confirmPassword"
            placeholder="Подтвердите пароль"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
          />
          <InputIcon 
            clickable 
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
          </InputIcon>
        </InputGroup>
        
        <Button
          type="submit"
          disabled={loading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {loading ? 'Регистрация...' : 'Зарегистрироваться'}
        </Button>
      </form>
      
      <BackButton
        onClick={onBack}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        ← Вернуться к входу
      </BackButton>
    </FormContainer>
  );
};

export default RegistrationForm;
