// Email verification service
import { API_ENDPOINTS } from '../config/api';

export const sendVerificationEmail = async (email) => {
  try {
    const response = await fetch(`${API_ENDPOINTS.REGISTER}/verify-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Ошибка отправки письма');
    }
    
    return data;
  } catch (error) {
    console.error('Email verification error:', error);
    throw error;
  }
};

export const verifyEmailCode = async (email, code) => {
  try {
    const response = await fetch(`${API_ENDPOINTS.REGISTER}/verify-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, code }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Неверный код подтверждения');
    }
    
    return data;
  } catch (error) {
    console.error('Code verification error:', error);
    throw error;
  }
};

export const resendVerificationCode = async (email) => {
  try {
    const response = await fetch(`${API_ENDPOINTS.REGISTER}/resend-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Ошибка повторной отправки кода');
    }
    
    return data;
  } catch (error) {
    console.error('Resend code error:', error);
    throw error;
  }
};
