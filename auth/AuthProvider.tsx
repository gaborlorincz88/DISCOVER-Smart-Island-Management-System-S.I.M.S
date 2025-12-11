import React, { createContext, useState, useEffect } from 'react';
import { User } from '../types';
import AuthContext from './AuthContext';

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing authentication on mount
  useEffect(() => {
    const checkAuth = () => {
      try {
        console.log('=== AUTH PROVIDER: Checking authentication ===');
        console.log('Timestamp:', new Date().toISOString());
        
        // Check for session storage first (temporary session)
        const sessionUser = sessionStorage.getItem('user');
        console.log('Session storage user:', sessionUser);
        
        if (sessionUser) {
          const parsedUser = JSON.parse(sessionUser);
          console.log('Setting user from session storage:', parsedUser);
          setUser(parsedUser);
          setIsLoading(false);
          console.log('User set from session storage, loading complete');
          return;
        }

        // Check for persistent storage (remember me)
        const persistentUser = localStorage.getItem('user');
        console.log('Local storage user:', persistentUser);
        
        if (persistentUser) {
          const parsedUser = JSON.parse(persistentUser);
          console.log('Setting user from local storage:', parsedUser);
          setUser(parsedUser);
          setIsLoading(false);
          console.log('User set from local storage, loading complete');
          return;
        }

        console.log('No user found in storage, setting user to null');
        setIsLoading(false);
      } catch (error) {
        console.error('Error checking authentication:', error);
        // Clear corrupted data
        sessionStorage.removeItem('user');
        localStorage.removeItem('user');
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = (user: User, rememberMe: boolean = false) => {
    console.log('=== AUTH PROVIDER: Login called ===');
    console.log('User to login:', user);
    console.log('Remember me:', rememberMe);
    
    setUser(user);
    
    try {
      if (rememberMe) {
        // Store in localStorage for persistent login
        console.log('Storing user in localStorage for persistent login');
        const userJson = JSON.stringify(user);
        console.log('User JSON to store:', userJson);
        localStorage.setItem('user', userJson);
        sessionStorage.removeItem('user'); // Clear session storage
        console.log('User stored in localStorage, sessionStorage cleared');
        
        // Verify storage worked
        const storedUser = localStorage.getItem('user');
        console.log('Verification - stored user from localStorage:', storedUser);
      } else {
        // Store in sessionStorage for temporary session
        console.log('Storing user in sessionStorage for temporary session');
        const userJson = JSON.stringify(user);
        console.log('User JSON to store:', userJson);
        sessionStorage.setItem('user', userJson);
        localStorage.removeItem('user'); // Clear persistent storage
        console.log('User stored in sessionStorage, localStorage cleared');
        
        // Verify storage worked
        const storedUser = sessionStorage.getItem('user');
        console.log('Verification - stored user from sessionStorage:', storedUser);
      }
      
      console.log('User state set, storage updated');
    } catch (error) {
      console.error('=== STORAGE ERROR ===');
      console.error('Error storing user data:', error);
      console.error('Error message:', error instanceof Error ? error.message : String(error));
      console.error('Storage type attempted:', rememberMe ? 'localStorage' : 'sessionStorage');
    }
  };

  const logout = () => {
    setUser(null);
    // Clear both storage types
    sessionStorage.removeItem('user');
    localStorage.removeItem('user');
  };

  const value = {
    user,
    login,
    logout,
    isLoading
  };

  // Debug: Log whenever user or isLoading changes
  useEffect(() => {
    console.log('=== AUTH PROVIDER STATE CHANGED ===');
    console.log('User:', user);
    console.log('IsLoading:', isLoading);
    console.log('Timestamp:', new Date().toISOString());
  }, [user, isLoading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
