// frontend/src/ui/Components/LoginPage.jsx

import { useState } from 'react';
import { LayoutDashboard } from 'lucide-react';
import api from "../api.js";

export default function LoginPage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true); 
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.login(parseInt(userId), password);
      const userRole = response.user_type || 'user';
      
      onLogin(userRole, response);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // --- NEW SIGNUP HANDLER ---
  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // **CRITICAL FIX**: Pass the selected 'role' state to api.signup
      const response = await api.signup(password, role); 
      
      // If signup is successful, you might auto-login or switch to the login form
      alert('Signup successful! Please log in.');
      setIsLogin(true); // Switch to login form
      setUserId(response.id); // Pre-fill ID if API returns it
      setPassword('');
    } catch (err) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  // ---------------------------------

  const currentAction = isLogin ? 'Sign in' : 'Sign up';
  const handleSubmit = isLogin ? handleLogin : handleSignup;

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-full max-w-sm p-8 bg-white rounded-xl shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto bg-gray-200 rounded-lg mb-2 flex items-center justify-center">
            <LayoutDashboard className="text-gray-500 w-8 h-8" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-800">{currentAction}</h1>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* USER ID Field is only needed for Login */}
          {isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">User ID:</label>
              <input
                type="number"
                value={userId}
                onChange={e => setUserId(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition"
                placeholder="Enter user ID"
                required
                disabled={loading}
              />
            </div>
          )}

          {/* Password Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password:</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition"
              placeholder="Enter password"
              required
              disabled={loading}
            />
          </div>

          {/* ROLE SELECTION is only needed for Signup */}
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">User Role:</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition bg-white"
                required
                disabled={loading}
              >
                <option value="student">Student</option>
                <option value="examiner">Examiner</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {loading ? (isLogin ? 'Signing in...' : 'Registering...') : currentAction}
          </button>
        </form>
        
        {/* Toggle Link */}
        <div className="mt-6 text-center text-sm">
          {isLogin ? (
            <p>
              Don't have an account?{' '}
              <button 
                className="text-blue-600 hover:text-blue-800 font-medium focus:outline-none"
                onClick={() => { setIsLogin(false); setError(''); }}
                disabled={loading}
              >
                Sign up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button 
                className="text-blue-600 hover:text-blue-800 font-medium focus:outline-none"
                onClick={() => { setIsLogin(true); setError(''); }}
                disabled={loading}
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}