import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
/* eslint-disable react-refresh/only-export-components */

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('token')));

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/auth/me')
        .then(response => {
          setUser({
              ...response.data,
              name: response.data.nombre,
              role: response.data.rol?.nombre // Mapear rol de backend a frontend
          });
        })
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => setLoading(false));
    }
  }, []);

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { access_token, user } = response.data;
      
      localStorage.setItem('token', access_token);
      setUser({
          ...user,
          name: user.nombre,
          role: user.rol?.nombre
      });
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      const status = error?.response?.status;

      if (status === 401) {
        return {
          success: false,
          message: 'Credenciales incorrectas. Verifique su email y contraseña.',
        };
      }

      if (status === 403) {
        return {
          success: false,
          message: error?.response?.data?.message || 'Tu cuenta no tiene acceso en este momento.',
        };
      }

      return {
        success: false,
        message: 'No pudimos conectar con el servidor. Intenta nuevamente en unos segundos.',
      };
    }
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem('token');

    try {
        await api.post('/auth/logout');
    } catch (error) {
        console.error('Logout error', error);
    }
  };

  const value = {
    user,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
