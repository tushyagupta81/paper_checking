import { useState } from 'react';
import { useLocalStorage } from './Components/useLocalStorage';
import LoginPage from './Components/LoginPage';
import Header from './Components/Header';
import Sidebar from './Components/Sidebar';
import AdminDashboard from './Components/AdminDashboard';
import EvaluatorDashboard from './Components/EvaluatorDashboard';
import UserDashboard from './Components/UserDashboard';
import ReportsPage from './Components/ReportsPage';
import EvaluationPage from './Components/EvaluationPage';
import api from "./api.js";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [userData, setUserData] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useLocalStorage('sidebarCollapsed', false);
  const [currentPage, setCurrentPage] = useState('dashboard');

  const handleLogin = (role, data) => {
    setIsLoggedIn(true);
    setUserRole(role);
    setUserData(data);
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    api.clearToken();
    setIsLoggedIn(false);
    setUserRole('');
    setUserData(null);
    setCurrentPage('');
  };

  const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed);

  if (!isLoggedIn) return <LoginPage onLogin={handleLogin} />;

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        if (userRole === 'admin') return <AdminDashboard userData={userData} />;
        if (userRole === 'examiner') return <EvaluatorDashboard userData={userData} />;
        if (userRole === 'user') return <UserDashboard userData={userData} />;
        break;

      case 'assignment':
        return userRole === 'examiner'
          ? <EvaluationPage userData={userData} />
          : <div className="p-8 text-center text-xl text-red-500">Access Denied</div>;

      case 'reports':
        return <ReportsPage userRole={userRole} userData={userData} />;

      case 'system':
        return userRole === 'admin'
          ? <div className="p-8 text-center text-xl text-gray-500">System & Utilities</div>
          : <div className="p-8 text-center text-xl text-red-500">Access Denied</div>;

      default:
        return <div className="p-8 text-center text-xl text-gray-500">Welcome! Select an item from the sidebar.</div>;
    }
  };

  return (
    <div className="flex flex-col h-screen antialiased font-sans">
      <Header toggleSidebar={toggleSidebar} onLogout={handleLogout} userData={userData} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          userRole={userRole}
        />
        <main className="flex-1 overflow-hidden bg-gray-100">{renderContent()}</main>
      </div>
    </div>
  );
}