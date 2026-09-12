import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { DashboardStatsAdmin, DashboardStatsPM, DashboardStatsDev } from '../types';
import { StatCard, LoadingSpinner, StatusBadge, PriorityBadge } from '../components/ui';
import api from '../lib/api';
import {
  FolderKanban,
  CheckSquare,
  AlertTriangle,
  Users,
  TrendingUp,
  Clock,
  Activity,
  CheckCircle2,
  Circle,
  ArrowRight,
  Wifi,
} from 'lucide-react';
import { formatDistanceToNow, format, isPast } from 'date-fns';

function AdminDashboard({ stats }: { stats: DashboardStatsAdmin }) {
  const { presence, recentActivities } = useSocket();
  const online = presence?.onlineCount ?? stats.activeUsersOnline;

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Projects" value={stats.totalProjects} icon={<FolderKanban className="w-5 h-5" />} colorClass="text-indigo-400" bgClass="bg-indigo-500/10" />
        <StatCard label="Total Tasks" value={stats.totalTasks} icon={<CheckSquare className="w-5 h-5" />} colorClass="text-blue-400" bgClass="bg-blue-500/10" />
        <StatCard label="Overdue Tasks" value={stats.overdueCount} icon={<AlertTriangle className="w-5 h-5" />} colorClass="text-red-400" bgClass="bg-red-500/10" trend={stats.overdueCount > 0 ? 'Requires attention' : 'All on track'} />
        <StatCard label="Users Online" value={online} icon={<Wifi className="w-5 h-5" />} colorClass="text-emerald-400" bgClass="bg-emerald-500/10" trend="Live WebSocket count" />
      </div>

      {/* Task Status Breakdown */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-base font-semibold text-white mb-4">Task Status Breakdown</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(stats.tasksByStatus).map(([status, count]) => {
            const colors: Record<string, string> = {
              TODO: 'text-slate-400',
              IN_PROGRESS: 'text-blue-400',
              IN_REVIEW: 'text-amber-400',
              DONE: 'text-emerald-400',
            };
            const bars: Record<string, string> = {
              TODO: 'bg-slate-500',
              IN_PROGRESS: 'bg-blue-500',
              IN_REVIEW: 'bg-amber-500',
              DONE: 'bg-emerald-500',
            };
            const pct = stats.totalTasks > 0 ? Math.round((count / stats.totalTasks) * 100) : 0;
            return (
              <div key={status} className="bg-slate-800/40 rounded-xl p-4">
                <StatusBadge status={status as any} />
                <p className={`text-2xl font-bold mt-2 ${colors[status]}`}>{count}</p>
                <div className="mt-2 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${bars[status]}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-slate-500 mt-1">{pct}% of total</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Activity Feed */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-base font-semibold text-white">Live Activity Feed</h3>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {recentActivities.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">No recent activities</p>
          ) : (
            recentActivities.slice(0, 15).map((a) => (
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/30 hover:bg-slate-800/50 transition-all">
                <Activity className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-slate-300 line-clamp-1">{a.details}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                    {a.project && <span className="ml-2 text-indigo-400/70">• {a.project.name}</span>}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function PMDashboard({ stats }: { stats: DashboardStatsPM }) {
  const { recentActivities } = useSocket();

  const priorityColors: Record<string, string> = {
    CRITICAL: 'bg-red-500',
    HIGH: 'bg-orange-500',
    MEDIUM: 'bg-blue-500',
    LOW: 'bg-slate-500',
  };

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="My Projects" value={stats.totalProjects} icon={<FolderKanban className="w-5 h-5" />} colorClass="text-indigo-400" bgClass="bg-indigo-500/10" />
        <StatCard label="Due This Week" value={stats.upcomingTasksThisWeek.length} icon={<Clock className="w-5 h-5" />} colorClass="text-amber-400" bgClass="bg-amber-500/10" />
        <StatCard label="Critical Tasks" value={stats.tasksByPriority.CRITICAL} icon={<AlertTriangle className="w-5 h-5" />} colorClass="text-red-400" bgClass="bg-red-500/10" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Breakdown */}
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-base font-semibold text-white mb-4">Tasks by Priority</h3>
          <div className="space-y-3">
            {Object.entries(stats.tasksByPriority).map(([priority, count]) => {
              const total = Object.values(stats.tasksByPriority).reduce((a, b) => a + b, 0);
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={priority} className="flex items-center gap-3">
                  <PriorityBadge priority={priority as any} />
                  <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
                    <div className={`h-full rounded-full ${priorityColors[priority]}`} style={{ width: `${pct}%`, transition: 'width 0.5s' }} />
                  </div>
                  <span className="text-sm font-medium text-slate-300 w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-base font-semibold text-white mb-4">Due This Week</h3>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {stats.upcomingTasksThisWeek.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">No tasks due this week</p>
            ) : (
              stats.upcomingTasksThisWeek.map((t) => (
                <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800/60 transition-all">
                  <PriorityBadge priority={t.priority} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-300 truncate">{t.title}</p>
                    <p className="text-xs text-slate-500">{format(new Date(t.dueDate), 'MMM d')}</p>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* My Projects */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-base font-semibold text-white mb-4">My Projects</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {stats.projects.map((p) => (
            <div key={p.id} className="bg-slate-800/40 rounded-xl p-4 hover:bg-slate-800/60 transition-all">
              <p className="font-medium text-white text-sm truncate">{p.name}</p>
              <p className="text-xs text-indigo-400 mt-0.5">{p.client?.name}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-slate-500">{(p._count?.tasks ?? 0)} tasks</span>
                <ArrowRight className="w-4 h-4 text-slate-600" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DevDashboard({ stats }: { stats: DashboardStatsDev }) {
  const { recentActivities } = useSocket();

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total', value: stats.stats.total, color: 'text-slate-300' },
          { label: 'To Do', value: stats.stats.todo, color: 'text-slate-400' },
          { label: 'In Progress', value: stats.stats.inProgress, color: 'text-blue-400' },
          { label: 'In Review', value: stats.stats.inReview, color: 'text-amber-400' },
          { label: 'Done', value: stats.stats.done, color: 'text-emerald-400' },
        ].map((s) => (
          <div key={s.label} className="glass-card rounded-2xl p-4 text-center">
            <p className="text-xs text-slate-400 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Overdue Alert */}
      {stats.stats.overdue > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300">
            You have <strong>{stats.stats.overdue}</strong> overdue task{stats.stats.overdue > 1 ? 's' : ''}. Please prioritize them.
          </p>
        </div>
      )}

      {/* Task List Sorted by Priority then Due */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-base font-semibold text-white mb-4">My Tasks (by Priority & Due Date)</h3>
        <div className="space-y-2">
          {stats.tasks.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">No tasks assigned yet</p>
          ) : (
            stats.tasks.map((t) => (
              <div key={t.id} className={`flex items-center gap-4 p-3 rounded-xl bg-slate-800/40 hover:bg-slate-800/60 transition-all ${t.isOverdue && t.status !== 'DONE' ? 'border border-red-500/20' : ''}`}>
                <div className="flex-shrink-0">
                  {t.status === 'DONE' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium truncate ${t.status === 'DONE' ? 'line-through text-slate-500' : 'text-white'}`}>{t.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-500">{t.project?.name}</span>
                    {t.isOverdue && t.status !== 'DONE' && (
                      <span className="text-xs text-red-400 font-medium">Overdue</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <PriorityBadge priority={t.priority} />
                  <StatusBadge status={t.status} />
                  <span className="text-xs text-slate-500 w-20 text-right">
                    {isPast(new Date(t.dueDate)) ? (
                      <span className="text-red-400">{format(new Date(t.dueDate), 'MMM d')}</span>
                    ) : (
                      format(new Date(t.dueDate), 'MMM d')
                    )}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard')
      .then(({ data }) => setStats(data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;
  if (!stats) return <p className="text-slate-400">Failed to load dashboard.</p>;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">
          Welcome back, {user?.name?.split(' ')[0]}! 👋
        </h2>
        <p className="text-slate-400 mt-1 text-sm">
          Here's your {user?.role === 'ADMIN' ? 'global' : user?.role === 'PM' ? 'project' : 'personal'} overview
        </p>
      </div>

      {user?.role === 'ADMIN' && <AdminDashboard stats={stats as DashboardStatsAdmin} />}
      {user?.role === 'PM' && <PMDashboard stats={stats as DashboardStatsPM} />}
      {user?.role === 'DEVELOPER' && <DevDashboard stats={stats as DashboardStatsDev} />}
    </div>
  );
}
