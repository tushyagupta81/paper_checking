import { Menu, Bell, UserCircle, LogOut } from 'lucide-react';

export default function Header({ toggleSidebar, onLogout }) {
  return (
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
}
