import { useState } from 'react';
import { LayoutDashboard } from 'lucide-react';
import api from "../api.js";

export default function LoginPage({ onLogin }) {
  const [isLogin,    setIsLogin]    = useState(true); 
  const [userId,     setUserId]     = useState('');
  const [password,   setPassword]   = useState('');
  const [role,       setRole]       = useState('student');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [successMsg, setSuccessMsg] = useState('');   

  const handleLogin = async (e) => {  
    e.preventDefault();
    setError(''); 
    setSuccessMsg('');
    setLoading(true);
    try {
      const response = await api.login(parseInt(userId), password);
      const userRole = response.user_type;
      if (!userRole) throw new Error('Server did not return a user role. Please contact support.');
      onLogin(userRole, response);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError(''); setSuccessMsg('');
    setLoading(true);
    try {
      const response = await api.signup(password, role); 
      setSuccessMsg(`Account created! Your User ID is ${response.id}. Use it to sign in.`);
      setIsLogin(true);
      setUserId(String(response.id));
      setPassword('');
    } catch (err) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const currentAction = isLogin ? 'Sign in' : 'Sign up';
  const handleSubmit  = isLogin ? handleLogin : handleSignup;

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

        {successMsg && (
          <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg text-sm">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
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
        
        <div className="mt-6 text-center text-sm">
          {isLogin ? (
            <p>
              Don't have an account?{' '}
              <button 
                className="text-blue-600 hover:text-blue-800 font-medium focus:outline-none"
                onClick={() => { setIsLogin(false); setError(''); setSuccessMsg(''); }}
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
                onClick={() => { setIsLogin(true); setError(''); setSuccessMsg(''); }}
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