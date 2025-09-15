import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { FiMail, FiRefreshCw, FiCheck } from 'react-icons/fi';
import toast from 'react-hot-toast';

const VerificationContainer = styled(motion.div)`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%);
  padding: 20px;
`;

const VerificationCard = styled(motion.div)`
  background: rgba(20, 20, 20, 0.9);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: 20px;
  padding: 40px;
  max-width: 400px;
  width: 100%;
  text-align: center;
`;

const IconWrapper = styled.div`
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 30px;
  
  svg {
    width: 40px;
    height: 40px;
    color: white;
  }
`;

const Title = styled.h2`
  color: #ffffff;
  font-size: 24px;
  margin-bottom: 10px;
`;

const Subtitle = styled.p`
  color: #888;
  margin-bottom: 30px;
  line-height: 1.6;
`;

const CodeInput = styled.input`
  width: 100%;
  padding: 15px;
  background: rgba(40, 40, 40, 0.8);
  border: 2px solid rgba(0, 212, 255, 0.3);
  border-radius: 10px;
  color: #ffffff;
  font-size: 18px;
  text-align: center;
  letter-spacing: 3px;
  margin-bottom: 20px;
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
  margin-bottom: 15px;
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

const ResendButton = styled(motion.button)`
  background: transparent;
  border: 1px solid rgba(0, 212, 255, 0.3);
  border-radius: 10px;
  color: #00d4ff;
  padding: 12px 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 auto;
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(0, 212, 255, 0.1);
    border-color: #00d4ff;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Timer = styled.div`
  color: #888;
  font-size: 14px;
  margin-top: 15px;
`;

const EmailVerification = ({ email, onVerified, onBack }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    
    if (code.length !== 6) {
      toast.error('Введите 6-значный код');
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch('/api/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, code }),
      });

      const data = await response.json();
      
      if (response.ok) {
        toast.success('Email подтвержден!');
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        onVerified(data.user);
      } else {
        toast.error(data.error || 'Ошибка подтверждения');
      }
    } catch (error) {
      toast.error('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    
    try {
      const response = await fetch('/api/resend-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      
      if (response.ok) {
        toast.success('Новый код отправлен!');
        setTimeLeft(600); // Reset timer
        setCode('');
      } else {
        toast.error(data.error || 'Ошибка отправки кода');
      }
    } catch (error) {
      toast.error('Ошибка подключения к серверу');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <VerificationContainer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <VerificationCard
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <IconWrapper>
          <FiMail />
        </IconWrapper>
        
        <Title>Подтверждение Email</Title>
        <Subtitle>
          Мы отправили код подтверждения на<br />
          <strong>{email}</strong>
        </Subtitle>
        
        <form onSubmit={handleVerify}>
          <CodeInput
            type="text"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            autoFocus
          />
          
          <Button
            type="submit"
            disabled={loading || code.length !== 6}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? (
              <>
                <FiRefreshCw style={{ animation: 'spin 1s linear infinite' }} />
                Проверка...
              </>
            ) : (
              <>
                <FiCheck />
                Подтвердить
              </>
            )}
          </Button>
        </form>
        
        {timeLeft > 0 ? (
          <Timer>
            Код действителен: {formatTime(timeLeft)}
          </Timer>
        ) : (
          <div style={{ color: '#ff6b6b', fontSize: '14px', marginTop: '15px' }}>
            Код истек
          </div>
        )}
        
        <ResendButton
          onClick={handleResend}
          disabled={resendLoading || timeLeft > 540} // Allow resend after 1 minute
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {resendLoading ? (
            <>
              <FiRefreshCw style={{ animation: 'spin 1s linear infinite' }} />
              Отправка...
            </>
          ) : (
            <>
              <FiRefreshCw />
              Отправить повторно
            </>
          )}
        </ResendButton>
        
        <motion.button
          onClick={onBack}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
            marginTop: '20px',
            fontSize: '14px'
          }}
          whileHover={{ color: '#00d4ff' }}
        >
          ← Вернуться к регистрации
        </motion.button>
      </VerificationCard>
    </VerificationContainer>
  );
};

export default EmailVerification;
