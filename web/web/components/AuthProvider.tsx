'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  username: string;
  token: string;
  lineUserId?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ローカルストレージからトークン復元
    const stored = localStorage.getItem('auth_user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
      } catch {
        localStorage.removeItem('auth_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'ログインに失敗しました');
    }
    
    const data = await res.json();
    const userData: User = {
      id: data.userId,
      email: data.email,
      username: data.username,
      token: data.token,
    };
    
    setUser(userData);
    localStorage.setItem('auth_user', JSON.stringify(userData));
  };

  const register = async (email: string, password: string, username: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username }),
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '登録に失敗しました');
    }
    
    const data = await res.json();
    const userData: User = {
      id: data.userId,
      email: data.email,
      username: data.username,
      token: data.token,
    };
    
    setUser(userData);
    localStorage.setItem('auth_user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('auth_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
