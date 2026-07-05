import { useState, useEffect, useRef } from 'react';
import { Menu, Bell, UserCircle, LogOut } from 'lucide-react';
import api from '../api.js';

// Safely try to fetch notifications — if the endpoint doesn't exist yet,
// silently returns an empty list rather than crashing.
async function tryFetchNotifications() {
  try {
    const data = await api.request('/users/examiner/notifications', { method: 'GET' });
    return Array.isArray(data?.notifications) ? data.notifications : [];
  } catch {
    return [];
  }
}

async function tryMarkAllRead() {
  try {
    await api.request('/users/examiner/notifications/read', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  } catch { /* non-fatal */ }
}

export default function Header({ toggleSidebar, onLogout, userData }) {
  const [notifs, setNotifs] = useState([]);
  const [open,   setOpen]   = useState(false);
  const panelRef = useRef(null);

  const isExaminer = userData?.type === 'examiner';

  // Poll every 30 s — only for examiners, only when a token exists
  useEffect(() => {
    if (!isExaminer) return;
    const load = async () => setNotifs(await tryFetchNotifications());
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [isExaminer]);

  // Close panel when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const unread = notifs.filter(n => !n.read).length;

  const handleBellClick = async () => {
    if (!isExaminer) return;
    const opening = !open;
    setOpen(opening);
    if (opening && unread > 0) {
      setNotifs(prev => prev.map(n => ({ ...n, read: true })));
      await tryMarkAllRead();
    }
  };

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

        {/* Bell button */}
        <div className="relative" ref={panelRef}>
          <button
            onClick={handleBellClick}
            className={`relative p-2 rounded-full hover:bg-gray-700 transition ${!isExaminer ? 'opacity-40 cursor-default' : ''}`}
            title={isExaminer ? 'Notifications' : 'Notifications — examiner only'}
          >
            <Bell className="w-5 h-5" />
            {isExaminer && unread > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-gray-900 animate-pulse" />
            )}
          </button>

          {/* Dropdown */}
          {open && isExaminer && (
            <div className="absolute right-0 mt-2 w-80 bg-white text-gray-800 rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800">Notifications</span>
                {notifs.length > 0 && (
                  <span className="text-xs text-gray-400">{notifs.length} assignment{notifs.length !== 1 ? 's' : ''}</span>
                )}
              </div>

              {notifs.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-400">No notifications yet</p>
                  <p className="text-xs text-gray-300 mt-1">You'll see assignments here when an admin assigns a question to you.</p>
                </div>
              ) : (
                <ul className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                  {notifs.map((n, i) => (
                    <li key={n.id ?? i} className={`px-4 py-3 ${n.read ? 'bg-white' : 'bg-blue-50'}`}>
                      <p className="text-sm font-medium text-gray-800">
                        Q{n.question_no} assigned — Paper <span className="font-mono text-blue-700">{n.paper_id}</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Assigned by admin <span className="font-mono">{n.assigned_by}</span>
                      </p>
                      {n.created_at && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                      )}
                      {!n.read && (
                        <span className="inline-block mt-1 text-xs font-medium text-blue-600 bg-blue-100 rounded px-1.5 py-0.5">New</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <button className="p-2 rounded-full hover:bg-gray-700"><UserCircle className="w-6 h-6" /></button>
        <button onClick={onLogout} className="p-2 rounded-full text-red-400 hover:bg-gray-700"><LogOut className="w-5 h-5" /></button>
      </div>
    </header>
  );
}