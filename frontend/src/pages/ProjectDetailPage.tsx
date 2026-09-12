import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  User,
  Calendar,
  CheckSquare,
  AlertTriangle,
  Radio,
  ShieldAlert,
  Activity as ActivityIcon,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Project, Task, TaskStatus, ActivityLog } from '../types';
import { StatusBadge, PriorityBadge, LoadingSpinner, EmptyState } from '../components/ui';

const NEXT_STATUS: Record<TaskStatus, TaskStatus | null> = {
  TODO: 'IN_PROGRESS',
  IN_PROGRESS: 'IN_REVIEW',
  IN_REVIEW: 'DONE',
  DONE: null,
};

function AdvanceStatusButton({ task, onUpdated }: { task: Task; onUpdated: (t: Task) => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const canUpdate =
    user?.role === 'ADMIN' ||
    user?.role === 'PM' ||
    (user?.role === 'DEVELOPER' && task.assignedDeveloperId === user.id);
  const next = NEXT_STATUS[task.status];

  if (!canUpdate || !next) return <StatusBadge status={task.status} />;

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const { data } = await api.patch(`/tasks/${task.id}/status`, { status: next });
      onUpdated(data.data.task);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleUpdate}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition-all disabled:opacity-60"
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3 h-3" />}
      Move to {next.replace('_', ' ')}
    </button>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { joinProjectRoom, leaveProjectRoom, onTaskUpdated, isConnected } = useSocket();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveRoom, setLiveRoom] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [projectRes, activityRes] = await Promise.all([
        api.get(`/projects/${id}`),
        // Role-filtered by the API: a Developer only ever gets activity for
        // their own tasks, a PM only for projects they created.
        api.get('/activity/feed', { params: { limit: 25 } }),
      ]);
      const p: Project = projectRes.data.data.project;
      setProject(p);
      setTasks(p.tasks ?? []);
      setActivities(
        (activityRes.data.data.activities as ActivityLog[]).filter((a) => a.projectId === id)
      );
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Unable to load this project.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Subscribe to this project's live channel. The server re-authorizes the
  // join, so an unauthorized user is refused the room even if they force the
  // route in the browser.
  useEffect(() => {
    if (!id || !isConnected || error) return;
    joinProjectRoom(id);
    setLiveRoom(true);
    return () => {
      leaveProjectRoom(id);
      setLiveRoom(false);
    };
  }, [id, isConnected, error, joinProjectRoom, leaveProjectRoom]);

  // Apply live task updates + activity pushed into `project:<id>`
  useEffect(() => {
    const unsubscribe = onTaskUpdated(({ task, activity }) => {
      if (task.projectId !== id) return;
      setTasks((prev) => {
        const idx = prev.findIndex((t) => t.id === task.id);
        if (idx === -1) return [...prev, task];
        const next = [...prev];
        next[idx] = task;
        return next;
      });
      if (activity) {
        setActivities((prev) =>
          prev.some((a) => a.id === activity.id) ? prev : [activity, ...prev].slice(0, 25)
        );
      }
    });
    return unsubscribe;
  }, [id, onTaskUpdated]);

  if (loading) return <LoadingSpinner message="Loading project..." />;

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <div className="p-4 rounded-2xl bg-red-500/10 text-red-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-semibold text-white">Project unavailable</h3>
        <p className="text-slate-500 text-sm max-w-sm">{error}</p>
        <Link
          to="/projects"
          className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-300 border border-slate-700 hover:border-slate-600 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to projects
        </Link>
      </div>
    );
  }

  const overdueCount = tasks.filter((t) => t.isOverdue && t.status !== 'DONE').length;
  const doneCount = tasks.filter((t) => t.status === 'DONE').length;

  return (
    <div>
      <Link
        to="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-all mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        All projects
      </Link>

      <div className="glass-card rounded-2xl p-5 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-white">{project.name}</h2>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">{project.description}</p>
            <div className="flex items-center flex-wrap gap-4 mt-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                {project.client?.name ?? '—'}
              </span>
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                Owned by {project.creator?.name ?? '—'}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Created {format(new Date(project.createdAt), 'MMM d, yyyy')}
              </span>
            </div>
          </div>

          <div
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full flex-shrink-0 ${
              liveRoom ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 bg-slate-700/30'
            }`}
            title="Live updates are delivered to everyone authorized to view this project"
          >
            <Radio className="w-3.5 h-3.5" />
            {liveRoom ? 'Live channel joined' : 'Not subscribed'}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="rounded-xl bg-slate-800/50 px-4 py-3">
            <p className="text-xs text-slate-400">Tasks</p>
            <p className="text-xl font-bold text-white mt-0.5">{tasks.length}</p>
          </div>
          <div className="rounded-xl bg-slate-800/50 px-4 py-3">
            <p className="text-xs text-slate-400">Completed</p>
            <p className="text-xl font-bold text-emerald-400 mt-0.5">{doneCount}</p>
          </div>
          <div className="rounded-xl bg-slate-800/50 px-4 py-3">
            <p className="text-xs text-slate-400">Overdue</p>
            <p className="text-xl font-bold text-red-400 mt-0.5">{overdueCount}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tasks */}
        <div className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-white mb-3">Tasks</h3>
          {tasks.length === 0 ? (
            <EmptyState
              icon={<CheckSquare className="w-8 h-8" />}
              title="No tasks visible"
              description="You can only see tasks this project exposes to your role."
            />
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`glass-card rounded-2xl p-4 transition-all duration-150 ${
                    task.isOverdue && task.status !== 'DONE' ? 'border border-red-500/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2 flex-wrap">
                        <h4
                          className={`text-sm font-medium ${
                            task.status === 'DONE' ? 'line-through text-slate-500' : 'text-white'
                          }`}
                        >
                          {task.title}
                        </h4>
                        {task.isOverdue && task.status !== 'DONE' && (
                          <span className="inline-flex items-center gap-1 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-md">
                            <AlertTriangle className="w-3 h-3" />
                            Overdue
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                        {task.description}
                      </p>
                      <div className="flex items-center flex-wrap gap-3 mt-2.5 text-xs text-slate-500">
                        {task.assignedDeveloper && (
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {task.assignedDeveloper.name}
                          </span>
                        )}
                        <span
                          className={`flex items-center gap-1 ${
                            task.isOverdue && task.status !== 'DONE' ? 'text-red-400' : ''
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          {format(new Date(task.dueDate), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <PriorityBadge priority={task.priority} />
                      <AdvanceStatusButton
                        task={task}
                        onUpdated={(updated) =>
                          setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Project activity */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Project activity</h3>
          <div className="glass-card rounded-2xl divide-y divide-slate-700/30 overflow-hidden">
            {activities.length === 0 ? (
              <div className="px-4 py-10 text-center text-slate-500 text-sm">
                No activity recorded yet
              </div>
            ) : (
              activities.map((a) => (
                <div key={a.id} className="flex gap-3 px-4 py-3">
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 h-fit flex-shrink-0">
                    <ActivityIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-300">
                      {a.details || `${a.user?.name ?? 'Someone'} · ${a.action}`}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
