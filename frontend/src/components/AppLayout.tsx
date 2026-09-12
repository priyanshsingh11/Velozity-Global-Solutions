import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  Building2,
  Activity,
  Bell,
  LogOut,
  Zap,
  Wifi,
  WifiOff,
  ChevronDown,
  X,
  CheckCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { formatDistanceToNow } from 'date-fns';

function NotificationDropdown() {
  const { notifications, unreadCount, markNotificationRead, markAllNotificationsRead } = useSocket();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const typeColor: Record<string, string> = {
    TASK_ASSIGNED: 'bg-indigo-500',
    TASK_IN_REVIEW: 'bg-amber-500',
    TASK_OVERDUE: 'bg-red-500',
    SYSTEM: 'bg-slate-500',
  };

  return (
    <div className="relative" ref={ref}>
      <button
        id="notification-bell-btn"
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/60 transition-all"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-indigo-600 rounded-full px-1 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 glass-card rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
            <h3 className="font-semibold text-white text-sm">Notifications</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllNotificationsRead()}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-500 text-sm">
                No notifications yet
              </div>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.isRead && markNotificationRead(n.id)}
                  className={`flex gap-3 px-4 py-3 cursor-pointer transition-all hover:bg-slate-700/30 border-b border-slate-700/20 last:border-0 ${!n.isRead ? 'bg-indigo-500/5' : ''}`}
                >
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${typeColor[n.type] || 'bg-slate-500'}`} />
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${n.isRead ? 'text-slate-400' : 'text-white'}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-xs text-slate-600 mt-1">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  {!n.isRead && (
                    <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  roles: string[];
}

const navItems: NavItem[] = [
  { to: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard', roles: ['ADMIN', 'PM', 'DEVELOPER'] },
  { to: '/projects', icon: <FolderKanban className="w-5 h-5" />, label: 'Projects', roles: ['ADMIN', 'PM', 'DEVELOPER'] },
  { to: '/tasks', icon: <CheckSquare className="w-5 h-5" />, label: 'Tasks', roles: ['ADMIN', 'PM', 'DEVELOPER'] },
  { to: '/activity', icon: <Activity className="w-5 h-5" />, label: 'Activity Feed', roles: ['ADMIN', 'PM', 'DEVELOPER'] },
  { to: '/clients', icon: <Building2 className="w-5 h-5" />, label: 'Clients', roles: ['ADMIN', 'PM'] },
  { to: '/users', icon: <Users className="w-5 h-5" />, label: 'Users', roles: ['ADMIN'] },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const visibleNav = navItems.filter((n) => user && n.roles.includes(user.role));

  const roleColor: Record<string, string> = {
    ADMIN: 'text-violet-400 bg-violet-500/10',
    PM: 'text-blue-400 bg-blue-500/10',
    DEVELOPER: 'text-emerald-400 bg-emerald-500/10',
  };

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 glass border-r border-slate-800/50 flex flex-col">
        {/* Logo */}
        <div className="p-5 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">Velozity</h1>
              <p className="text-xs text-slate-500">Project Dashboard</p>
            </div>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleNav.map((item) => {
            const isActive = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <span className={isActive ? 'text-indigo-400' : ''}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User Menu */}
        <div className="p-3 border-t border-slate-800/50">
          <div className="relative">
            <button
              id="user-menu-btn"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800/60 transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-sm font-medium text-white truncate">{user?.name?.split(' ')[0]}</p>
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${roleColor[user?.role || 'DEVELOPER']}`}>
                  {user?.role}
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 glass-card rounded-xl overflow-hidden shadow-xl">
                <button
                  id="logout-btn"
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 glass border-b border-slate-800/50 flex items-center justify-between px-6 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-white capitalize">
              {location.pathname.replace('/dashboard', 'Dashboard').replace('/projects', 'Projects').replace('/tasks', 'Tasks').replace('/activity', 'Activity Feed').replace('/clients', 'Clients').replace('/users', 'Users').replace('/', '')}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Connection Status */}
            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${isConnected ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 bg-slate-700/30'}`}>
              {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {isConnected ? 'Live' : 'Offline'}
            </div>
            <NotificationDropdown />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
