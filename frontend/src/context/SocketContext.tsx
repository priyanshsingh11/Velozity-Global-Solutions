import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { Notification, ActivityLog, Task } from '../types';
import api, { API_ORIGIN } from '../lib/api';

interface PresenceData {
  onlineCount: number;
  onlineUserIds: string[];
  timestamp: string;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  presence: PresenceData | null;
  notifications: Notification[];
  unreadCount: number;
  recentActivities: ActivityLog[];
  joinProjectRoom: (projectId: string) => void;
  leaveProjectRoom: (projectId: string) => void;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  onTaskUpdated: (handler: (data: { task: Task; activity: ActivityLog }) => void) => () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user, accessToken } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [presence, setPresence] = useState<PresenceData | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentActivities, setRecentActivities] = useState<ActivityLog[]>([]);
  const taskUpdateHandlers = useRef<Array<(data: { task: Task; activity: ActivityLog }) => void>>([]);

  // Fetch initial notifications from REST API
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.data.notifications);
      setUnreadCount(data.data.unreadCount);
    } catch { /* silent */ }
  }, [user]);

  // Offline catch-up: fetch last 20 missed activities from PostgreSQL
  const fetchMissedActivities = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get('/activity/missed');
      setRecentActivities(data.data.activities);
    } catch { /* silent */ }
  }, [user]);

  // Initialize Socket.io connection when authenticated
  useEffect(() => {
    if (!user || !accessToken) {
      socket?.disconnect();
      setSocket(null);
      setIsConnected(false);
      return;
    }

    // The handshake carries the access token; the server verifies it and
    // rejects the connection outright if it is missing or invalid.
    const newSocket = io(API_ORIGIN || '/', {
      auth: { token: accessToken },
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('✅ Socket connected:', newSocket.id);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    // On reconnect: fetch missed activities from PostgreSQL
    newSocket.on('reconnect', () => {
      console.log('🔄 Socket reconnected - fetching missed activities...');
      fetchMissedActivities();
    });

    // Presence updates (Admin dashboard)
    newSocket.on('presence:update', (data: PresenceData) => {
      setPresence(data);
    });

    // New notification pushed via WebSocket
    newSocket.on('notification:new', (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
    });

    // Real-time task update
    newSocket.on('task:updated', (data: { task: Task; activity: ActivityLog }) => {
      setRecentActivities((prev) => [data.activity, ...prev.slice(0, 49)]);
      taskUpdateHandlers.current.forEach((handler) => handler(data));
    });

    // Activity feed update
    newSocket.on('activity:new', (activity: ActivityLog) => {
      setRecentActivities((prev) => {
        const exists = prev.some((a) => a.id === activity.id);
        if (exists) return prev;
        return [activity, ...prev.slice(0, 49)];
      });
    });

    setSocket(newSocket);
    fetchNotifications();
    fetchMissedActivities();

    return () => {
      newSocket.disconnect();
    };
  }, [user, accessToken]); // eslint-disable-line

  const joinProjectRoom = useCallback(
    (projectId: string) => {
      socket?.emit('project:join', { projectId }, (response: any) => {
        if (!response?.success) {
          console.warn('Failed to join project room:', response?.error);
        }
      });
    },
    [socket]
  );

  const leaveProjectRoom = useCallback(
    (projectId: string) => {
      socket?.emit('project:leave', { projectId });
    },
    [socket]
  );

  const markNotificationRead = useCallback(async (id: string) => {
    const { data } = await api.patch(`/notifications/${id}/read`);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount(data.data.unreadCount);
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    await api.post('/notifications/read-all');
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, []);

  const onTaskUpdated = useCallback(
    (handler: (data: { task: Task; activity: ActivityLog }) => void) => {
      taskUpdateHandlers.current.push(handler);
      return () => {
        taskUpdateHandlers.current = taskUpdateHandlers.current.filter((h) => h !== handler);
      };
    },
    []
  );

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        presence,
        notifications,
        unreadCount,
        recentActivities,
        joinProjectRoom,
        leaveProjectRoom,
        markNotificationRead,
        markAllNotificationsRead,
        onTaskUpdated,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}
