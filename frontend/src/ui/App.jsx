import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  LayoutDashboard, Menu, Scan, ClipboardList, BarChart, Settings, HelpCircle, UserCircle, Bell, LogOut, Signal, List, Check, X, Pen, Circle
} from 'lucide-react';
import EvaluationPage from './Components/EvaluationPage'; // optional if you want to keep it modular

// Dummy Dashboard metrics
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

// Local storage hook
const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch { return initialValue; }
  });
  const setValue = useCallback((value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch {}
  }, [storedValue]);
  return [storedValue, setValue];
};

// Login Page
const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (username && password && role) {
      onLogin(role); // pass role
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Username:</label>
            <input type="text" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Enter username" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password:</label>
            <input type="password" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter password" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role:</label>
            <select className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" value={role} onChange={e=>setRole(e.target.value)} required>
              <option value="" disabled>-- select --</option>
              <option value="admin">Admin</option>
              <option value="evaluator">Evaluator</option>
              <option value="user">User</option>
            </select>
          </div>

          <button type="submit" className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700">Sign in</button>
        </form>
      </div>
    </div>
  );
};

// Header
const Header = ({ toggleSidebar, isSidebarCollapsed, onLogout }) => (
  <header className="flex items-center justify-between h-16 bg-gray-900 text-white px-4 shadow-lg">
    <div className="flex items-center space-x-4">
      <button onClick={toggleSidebar} className="p-2 rounded-lg hover:bg-gray-700">
        <Menu className="w-6 h-6" />
      </button>
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-gray-700 rounded-md flex items-center justify-center">L</div>
        <span className="text-lg font-semibold hidden sm:inline">System Name</span>
      </div>
    </div>

    <div className="flex items-center space-x-4">
      <button className="p-2 rounded-full hover:bg-gray-700"><Bell className="w-5 h-5" /></button>
      <button className="p-2 rounded-full hover:bg-gray-700"><UserCircle className="w-6 h-6" /></button>
      <button onClick={onLogout} className="p-2 rounded-full text-red-400 hover:bg-gray-700"><LogOut className="w-5 h-5" /></button>
    </div>
  </header>
);

// Sidebar
const Sidebar = ({ isCollapsed, currentPage, setCurrentPage, userRole }) => {
  const baseWidth = isCollapsed ? 'w-20' : 'w-64';

  const NavLink = ({ item }) => {
    if(item.view==='assignment' && userRole!=='evaluator') return null; // hide assignment for non-evaluators
    const isActive = currentPage === item.view;
    const Icon = item.icon;
    return (
      <button onClick={()=>setCurrentPage(item.view)} className={`flex items-center p-3 my-1 rounded-r-full transition-all duration-200 hover:bg-gray-200 ${isActive?'bg-blue-100 border-l-4 border-blue-500 text-blue-700 font-semibold':'text-gray-600'}`}>
        <Icon className="w-6 h-6 flex-shrink-0" />
        <span className={`${isCollapsed?'hidden':'ml-4'} text-sm whitespace-nowrap overflow-hidden`}>{item.name}</span>
      </button>
    );
  };

  return (
    <nav className={`h-full ${baseWidth} bg-white flex flex-col justify-between shadow-xl flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden`}>
      <div className="p-4 flex-1 overflow-y-auto">
        {NAV_ITEMS.map(item => <NavLink key={item.name} item={item} />)}
      </div>
      <div className="p-4 border-t">
        <button className={`w-full flex items-center ${isCollapsed?'justify-center':''} p-3 rounded-lg text-gray-600 hover:bg-gray-200`}><HelpCircle className="w-6 h-6" /><span className={`${isCollapsed?'hidden':'ml-4'} text-sm font-medium`}>Help</span></button>
      </div>
    </nav>
  );
};

// Dashboard Content
const DashboardContent = () => (
  <div className="p-6 h-full overflow-y-auto">
    <h1 className="text-3xl font-bold text-gray-800 mb-6">Dashboard Overview</h1>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {DASHBOARD_METRICS.map((metric, i)=>(
        <div key={i} className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-300">
          <h3 className="text-lg font-medium text-gray-500 mb-2">{metric.title}</h3>
          <p className="text-4xl font-extrabold text-gray-900 mb-1">{metric.value}</p>
          <p className="text-sm text-blue-600 font-medium cursor-pointer hover:underline">{metric.detail} &rarr;</p>
        </div>
      ))}
    </div>
  </div>
);

// Content Area with role-based EvaluationPage access
const ContentArea = ({ currentPage, userRole }) => {
  const renderContent = useMemo(()=>{
    switch(currentPage){
      case 'dashboard': return <DashboardContent />;
      case 'batch': return <div className="p-8 text-center text-xl text-gray-500">Batch & Scan Management View</div>;
      case 'assignment': 
        if(userRole==='evaluator') return <EvaluationPage />; 
        return <div className="p-8 text-center text-xl text-red-500">You are not authorized to access the Evaluation Page.</div>;
      case 'reports': return <div className="p-8 text-center text-xl text-gray-500">Reports & Analytics View</div>;
      case 'system': return <div className="p-8 text-center text-xl text-gray-500">System & Utilities View</div>;
      default: return <div className="p-8 text-center text-xl text-gray-500">Welcome! Select an item from the sidebar.</div>;
    }
  }, [currentPage, userRole]);

  return <main className="flex-1 overflow-hidden bg-gray-100">{renderContent}</main>;
};

// Main App
export default function App(){
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useLocalStorage('sidebarCollapsed', false);
  const [currentPage, setCurrentPage] = useState('dashboard');

  const handleLogin = (role)=>{
    setIsLoggedIn(true);
    setUserRole(role);
    setCurrentPage('dashboard');
  };
  const handleLogout = ()=>{
    setIsLoggedIn(false);
    setUserRole('');
    setCurrentPage('');
  };
  const toggleSidebar = ()=>setIsSidebarCollapsed(!isSidebarCollapsed);

  if(!isLoggedIn) return <LoginPage onLogin={handleLogin} />;

  return (
    <div className="flex flex-col h-screen antialiased font-sans">
      <Header toggleSidebar={toggleSidebar} isSidebarCollapsed={isSidebarCollapsed} onLogout={handleLogout}/>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isCollapsed={isSidebarCollapsed} currentPage={currentPage} setCurrentPage={setCurrentPage} userRole={userRole}/>
        <ContentArea currentPage={currentPage} userRole={userRole}/>
      </div>
    </div>
  );
}
