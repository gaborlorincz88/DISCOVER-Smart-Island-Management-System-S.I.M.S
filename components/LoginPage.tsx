
import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getApiBaseUrl } from '../services/config';
import { User } from '../types';

interface LoginPageProps {
  onClose: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onClose }) => {
  const { login } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [location, setLocation] = useState('');
  const [plannedStayDuration, setPlannedStayDuration] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Try regular user authentication first (works for all users including admins)
      const response = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include', // Include cookies for authentication
      });

      const data = await response.json();
      console.log('Login response:', response);
      console.log('Login data:', data);

      if (response.ok) {
        // Login successful - works for both regular users and admins
        const user: User = {
          id: data.user.id,
          email: data.user.email,
          role: data.user.role || 'user',
          username: data.user.username || '',
          location: data.user.location || '',
          plannedStayDuration: '', // Not returned in login response
          createdAt: data.user.created_at || '',
          lastLogin: data.user.last_login || new Date().toISOString()
        };

        // Use the AuthContext login function with remember me option
        login(user, rememberMe);
        onClose();
      } else {
        // Login failed - check if it's a verification issue
        if (data.requiresVerification) {
          setError(data.error || 'Please verify your email address before logging in.');
          // Store email for resend functionality
          (window as any).__pendingVerificationEmail = data.email;
        } else {
          setError(data.error || 'Invalid email or password. Please try again.');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !username || !location || !plannedStayDuration) {
      setError('All fields are required for registration.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Call the backend registration API
      const response = await fetch(`${getApiBaseUrl()}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, username, location, plannedStayDuration }),
      });

      const data = await response.json();

      if (response.ok) {
        // Registration successful
        if (data.requiresVerification) {
          // Show verification message instead of logging in
          setError(''); // Clear any errors
          // Store email for resend functionality
          (window as any).__pendingVerificationEmail = data.user.email;
          // Show success message
          alert('Registration successful! Please check your email to verify your account before logging in.');
          // Close the modal
          onClose();
        } else {
          // Old flow - auto login (shouldn't happen with new verification)
          const user: User = {
            id: data.user.id,
            email: data.user.email,
            role: data.user.role,
          };
          login(user, rememberMe);
          onClose();
        }
      } else {
        // Registration failed
        setError(data.error || 'Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-sm relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-2 rounded-full">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">{isRegistering ? 'Create Account' : 'Login'}</h2>
        <p className="text-center text-sm text-gray-500 mb-6">
          {isRegistering ? 'Fill in your details to create a new account' : 'Enter your email and password to access your account'}
        </p>
        <form onSubmit={isRegistering ? handleRegister : handleLogin}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="user@example.com"
              disabled={isLoading}
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="******************"
              disabled={isLoading}
            />
          </div>
          
          {/* Additional Registration Fields */}
          {isRegistering && (
            <>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="username">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="johndoe"
                  disabled={isLoading}
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="location">
                  Your Country <span className="text-red-500">*</span>
                </label>
                <input
                  id="location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. UK, Germany, USA, etc."
                  disabled={isLoading}
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="plannedStayDuration">
                  Planned Stay in Gozo <span className="text-red-500">*</span>
                </label>
                <select
                  id="plannedStayDuration"
                  value={plannedStayDuration}
                  onChange={(e) => setPlannedStayDuration(e.target.value)}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                  required
                >
                  <option value="">Select duration...</option>
                  <option value="1-3 days">1-3 days</option>
                  <option value="4-7 days">4-7 days</option>
                  <option value="1-2 weeks">1-2 weeks</option>
                  <option value="2-4 weeks">2-4 weeks</option>
                  <option value="1-3 months">1-3 months</option>
                  <option value="3-6 months">3-6 months</option>
                  <option value="6+ months">6+ months</option>
                  <option value="Local resident">Local resident</option>
                </select>
              </div>
            </>
          )}
          
          {/* Remember Me Toggle */}
          <div className="mb-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                disabled={isLoading}
              />
              <span className="ml-2 text-sm text-gray-700">Remember me</span>
            </label>
            <p className="text-xs text-gray-500 mt-1">
              {rememberMe 
                ? "You'll stay logged in even after closing the browser" 
                : "You'll be logged out when you close the browser"
              }
            </p>
          </div>
          
          {error && <p className="text-red-500 text-xs italic mb-4">{error}</p>}
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors"
          >
            {isLoading ? (isRegistering ? 'Creating Account...' : 'Signing In...') : (isRegistering ? 'Create Account' : 'Sign In')}
          </button>
          
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError('');
              }}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
              disabled={isLoading}
            >
              {isRegistering ? 'Already have an account? Sign in' : "Don't have an account? Register"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;