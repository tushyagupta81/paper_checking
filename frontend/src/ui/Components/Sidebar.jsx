import { LayoutDashboard, HelpCircle } from 'lucide-react';

export default function Sidebar({ isCollapsed, currentPage, setCurrentPage, userRole }) {
  const baseWidth = isCollapsed ? 'w-20' : 'w-64';

  const NAV_ITEMS = [
    { name: 'Dashboard', view: 'dashboard' },
    { name: 'Assignment & Evaluation', view: 'assignment', roles: ['evaluator'] },
    { name: 'Reports & Analytics', view: 'reports', roles: ['admin'] },
    { name: 'System & Utilities', view: 'system', roles: ['admin'] },
  ];

  const filteredItems = NAV_ITEMS.filter(item => !item.roles || item.roles.includes(userRole));

  return (
    <nav className={`h-full ${baseWidth} bg-white flex flex-col justify-between shadow-xl transition-all duration-300 ease-in-out overflow-hidden`}>
      <div className="p-4 flex-1 overflow-y-auto">
        {filteredItems.map(item => (
          <button key={item.name} onClick={() => setCurrentPage(item.view)}
            className={`flex items-center p-3 my-1 rounded-r-full transition-all duration-200 hover:bg-gray-200 ${currentPage === item.view ? 'bg-blue-100 border-l-4 border-blue-500 text-blue-700 font-semibold' : 'text-gray-600'}`}>
            <LayoutDashboard className="w-6 h-6 flex-shrink-0" />
            <span className={`${isCollapsed ? 'hidden' : 'ml-4'} text-sm whitespace-nowrap overflow-hidden`}>{item.name}</span>
          </button>
        ))}
      </div>
      <div className="p-4 border-t">
        <button className={`w-full flex items-center ${isCollapsed ? 'justify-center' : ''} p-3 rounded-lg text-gray-600 hover:bg-gray-200`}>
          <HelpCircle className="w-6 h-6" /><span className={`${isCollapsed ? 'hidden' : 'ml-4'} text-sm font-medium`}>Help</span>
        </button>
      </div>
    </nav>
  );
}
