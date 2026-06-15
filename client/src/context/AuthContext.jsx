import { createContext, useContext, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user,  setUser]  = useState(() => {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  });

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token: t, user: u } = res.data;

    // Fetch /me to confirm role from server (token is now set via header)
    let fullUser = u;
    try {
      const meRes = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${t}` },
      });
      fullUser = { ...u, ...meRes.data };
    } catch (_) { /* fall back to login payload */ }

    localStorage.setItem('token', t);
    localStorage.setItem('user', JSON.stringify(fullUser));
    setToken(t);
    setUser(fullUser);
    return { token: t, user: fullUser };
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const hasRole = (...roles) => roles.includes(user?.role);

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
