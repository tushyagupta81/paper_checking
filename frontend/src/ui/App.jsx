// function App() {
//   return (
//     <div>
//       hello world!
//     </div>
//   )
// }

// export default App

import React, { useState, useMemo, useCallback } from 'react';
import { 
  LayoutDashboard, Menu, Scan, ClipboardList, BarChart, Settings, HelpCircle, UserCircle, Bell, Signal, LogOut 
} from 'lucide-react';

// --- Configuration Data ---
const DASHBOARD_METRICS = [
  { title: "Workbooks Scanned", value: "120/N", detail: "View all" },
  { title: "Workbooks Checked", value: "15/N", detail: "Review access only to super admin" },
  { title: "Active Evaluators", value: "8", detail: "Manage" },
  { title: "Questions Assigned", value: "2/N", detail: "Assign Now" },
];

const NAV_ITEMS = [
  { name: 'Dashboard', icon: LayoutDashboard, view: 'dashboard' },
  { name: 'Batch & Scan Management', icon: Scan, view: 'batch' },
  { name: 'Assignment & Evaluation', icon: ClipboardList, view: 'assignment' },
  { name: 'Reports & Analytics', icon: BarChart, view: 'reports' },
  { name: 'System & Utilities', icon: Settings, view: 'system' },
];

/**
 * Custom hook to manage state persistence for the sidebar state.
 * Uses localStorage as a mock for Electron's local storage solution.
 */
const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error("Error reading localStorage:", error);
      return initialValue;
    }
  });

  const setValue = useCallback((value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error("Error writing localStorage:", error);
    }
  }, [key, storedValue]);

  return [storedValue, setValue];
};

// --- Sub-Components ---

const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (username && password && role) {
      console.log('Attempting login:', { username, role });
      onLogin();
    } else {
      console.error('Please fill out all fields.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-full max-w-sm p-8 bg-white rounded-xl shadow-2xl transition-all duration-300">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto bg-gray-200 rounded-lg mb-2 flex items-center justify-center">
            <LayoutDashboard className="text-gray-500 w-8 h-8" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-800">System Name</h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="username">Username:</label>
            <input
              id="username"
              type="text"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">Password:</label>
            <input
              id="password"
              type="password"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="role">Role:</label>
            <select
              id="role"
              className="w-full p-3 border border-gray-300 rounded-lg appearance-none bg-white focus:ring-blue-500 focus:border-blue-500 transition duration-150"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
            >
              <option value="" disabled>-- select --</option>
              <option value="admin">Admin</option>
              <option value="evaluator">Evaluator</option>
              <option value="user">User</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50 transition duration-150 ease-in-out"
          >
            Sign in
          </button>
        </form>

        <div className="flex justify-between text-sm mt-4 text-gray-500">
          <button className="hover:text-blue-600 transition duration-150">Help?</button>
          <button className="hover:text-blue-600 transition duration-150">Forgot password?</button>
        </div>
      </div>
    </div>
  );
};

const Header = ({ toggleSidebar, isSidebarCollapsed, onLogout }) => (
  <header className="flex items-center justify-between h-16 bg-gray-900 text-white px-4 shadow-lg flex-shrink-0">
    {/* Left Section: Logo, Name, Menu Button */}
    <div className="flex items-center space-x-4">
      <button 
        onClick={toggleSidebar} 
        className="p-2 rounded-lg hover:bg-gray-700 transition duration-150"
        aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <Menu className="w-6 h-6" />
      </button>
      <div className="flex items-center space-x-2">
        {/* Placeholder for Logo */}
        <div className="w-8 h-8 bg-gray-700 rounded-md flex items-center justify-center">L</div>
        <span className="text-lg font-semibold hidden sm:inline">System Name</span>
      </div>
    </div>

    {/* Center Section: Desktop ID & Status Bar */}
    <div className="flex-1 max-w-xs mx-auto hidden lg:block">
      <div className="flex items-center justify-center h-8 bg-gray-700 rounded-full text-xs font-medium px-4">
        Desktop - 1
      </div>
    </div>

    {/* Right Section: Status, Profile, Logout */}
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-2 text-sm text-green-400 cursor-default group">
        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
        <span className="hidden sm:inline">Last Saved: 22:00</span>
        {/* Hover: display- "system online" */}
        <div className="relative">
          <Signal className="w-5 h-5 text-green-400" />
          <span className="absolute top-full right-1/2 translate-x-1/2 mt-1 px-2 py-1 bg-gray-700 text-xs text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-10">
            system online
          </span>
        </div>
      </div>
      
      <button className="p-2 rounded-full hover:bg-gray-700 transition duration-150" aria-label="Notifications">
        <Bell className="w-5 h-5" />
      </button>
      <button className="p-2 rounded-full hover:bg-gray-700 transition duration-150" aria-label="User Profile">
        <UserCircle className="w-6 h-6" />
      </button>
      <button 
        onClick={onLogout}
        className="p-2 rounded-full text-red-400 hover:bg-gray-700 transition duration-150"
        aria-label="Logout"
      >
        <LogOut className="w-5 h-5" />
      </button>
    </div>
  </header>
);

const Sidebar = ({ isCollapsed, currentPage, setCurrentPage }) => {
  const baseWidth = isCollapsed ? 'w-20' : 'w-64'; // Adjusted for better visuals

  const NavLink = ({ item }) => {
    const isActive = currentPage === item.view;
    const baseClasses = "flex items-center p-3 my-1 rounded-r-full transition-all duration-200 hover:bg-gray-200";
    const activeClasses = "bg-blue-100 border-l-4 border-blue-500 text-blue-700 font-semibold";
    const inactiveClasses = "text-gray-600";
    const Icon = item.icon;

    const handleClick = () => {
      setCurrentPage(item.view);
      // In a real app, you might collapse the sidebar on mobile after navigation
    };

    return (
      <button 
        onClick={handleClick} 
        className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
        aria-current={isActive ? 'page' : undefined}
      >
        <Icon className="w-6 h-6 flex-shrink-0" />
        <span className={`${isCollapsed ? 'hidden' : 'ml-4'} text-sm whitespace-nowrap overflow-hidden`}>
          {item.name}
        </span>
      </button>
    );
  };

  return (
    <nav className={`h-full ${baseWidth} bg-white flex flex-col justify-between shadow-xl flex-shrink-0 transition-width duration-300 ease-in-out overflow-hidden`}>
      {/* Menu Items */}
      <div className="p-4 pt-0 flex-1 overflow-y-auto">
        <div className="py-2 border-b mb-4">
          {/* Active Item placeholder from wireframe */}
          <div className="text-xs text-gray-500 mb-2">Active Item:</div>
          <div className="text-sm font-medium text-gray-800">1. Scanner Import & Batch</div>
          {/* Simplified list based on wireframe notes */}
          <ul className="list-disc list-inside text-xs text-gray-600 ml-2 mt-1 space-y-0.5">
            <li>Management</li>
            <li>QR Mapping</li>
          </ul>
        </div>
        
        {NAV_ITEMS.map(item => (
          <NavLink key={item.name} item={item} />
        ))}
      </div>

      {/* Help Button */}
      <div className="p-4 border-t">
        <button className={`w-full flex items-center ${isCollapsed ? 'justify-center' : ''} p-3 rounded-lg text-gray-600 hover:bg-gray-200 transition duration-150`}>
          <HelpCircle className="w-6 h-6 flex-shrink-0" />
          <span className={`${isCollapsed ? 'hidden' : 'ml-4'} text-sm font-medium whitespace-nowrap overflow-hidden`}>
            Help
          </span>
        </button>
      </div>
    </nav>
  );
};

const DashboardContent = () => {
  return (
    <div className="p-6 h-full overflow-y-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Dashboard Overview</h1>
      
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {DASHBOARD_METRICS.map((metric, index) => (
          <div key={index} className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-300">
            <h3 className="text-lg font-medium text-gray-500 mb-2">{metric.title}</h3>
            <p className="text-4xl font-extrabold text-gray-900 mb-1">{metric.value}</p>
            <p className="text-sm text-blue-600 font-medium cursor-pointer hover:underline">
              {metric.detail} &rarr;
            </p>
          </div>
        ))}
      </div>

      {/* Placeholder for charts/reports content */}
      <div className="mt-8 bg-white p-6 rounded-xl shadow-lg h-96 border border-gray-200 flex items-center justify-center">
        <p className="text-gray-400 text-xl">Main Content Area (Charts/Reports/Tables)</p>
      </div>
    </div>
  );
};

const ContentArea = ({ currentPage }) => {
  // Simple view switching based on current page state
  const renderContent = useMemo(() => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardContent />;
      case 'batch':
        return <div className="p-8 text-center text-xl text-gray-500">Batch & Scan Management View</div>;
      case 'assignment':
        return <div className="p-8 text-center text-xl text-gray-500">Assignment & Evaluation View</div>;
      case 'reports':
        return <div className="p-8 text-center text-xl text-gray-500">Reports & Analytics View</div>;
      case 'system':
        return <div className="p-8 text-center text-xl text-gray-500">System & Utilities View</div>;
      default:
        return <div className="p-8 text-center text-xl text-gray-500">Welcome! Select an item from the sidebar.</div>;
    }
  }, [currentPage]);

  return (
    <main className="flex-1 overflow-hidden bg-gray-100">
      {renderContent}
    </main>
  );
};


// --- Main App Component ---
function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false); // Start on login page per wireframe sequence
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useLocalStorage('sidebarCollapsed', false);
  const [currentPage, setCurrentPage] = useState('dashboard');

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const handleLogin = () => {
    // In a real Electron app, this would involve IPC to authenticate against a backend.
    setIsLoggedIn(true);
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentPage('');
  };

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="flex flex-col h-screen antialiased font-sans">
      <Header toggleSidebar={toggleSidebar} isSidebarCollapsed={isSidebarCollapsed} onLogout={handleLogout} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          isCollapsed={isSidebarCollapsed} 
          currentPage={currentPage} 
          setCurrentPage={setCurrentPage} 
        />
        <ContentArea currentPage={currentPage} />
      </div>
    </div>
  );
}

export default App;
