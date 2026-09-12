import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckSquare,
  Filter,
  Plus,
  Loader2,
  AlertTriangle,
  Calendar,
  User,
  FolderKanban,
  ChevronRight,
  X,
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Task, TaskStatus, TaskPriority, Project, User as UserType } from '../types';
import { StatusBadge, PriorityBadge, LoadingSpinner, EmptyState } from '../components/ui';
import { format, isPast } from 'date-fns';

const STATUS_OPTIONS: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
const PRIORITY_OPTIONS: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function CreateTaskModal({
  projects,
  developers,
  onClose,
  onCreated,
}: {
  projects: Project[];
  developers: UserType[];
  onClose: () => void;
  onCreated: (t: Task) => void;
}) {
  const [form, setForm] = useState({
    projectId: projects[0]?.id ?? '',
    title: '',
    description: '',
    assignedDeveloperId: '',
    status: 'TODO' as TaskStatus,
    priority: 'MEDIUM' as TaskPriority,
    dueDate: format(new Date(Date.now() + 7 * 864e5), 'yyyy-MM-dd'),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const { data } = await api.post('/tasks', {
        ...form,
        // An empty select means "unassigned"; the API expects null, not ''.
        assignedDeveloperId: form.assignedDeveloperId || null,
        dueDate: new Date(form.dueDate).toISOString(),
      });
      onCreated(data.data.task);
      onClose();
    } catch (err: any) {
      const res = err?.response?.data?.error;
      setError(
        res?.details?.map((d: any) => `${d.field}: ${d.message}`).join(', ') ||
          res?.message ||
          'Failed to create task'
      );
    } finally {
      setSaving(false);
    }
  };

  const field =
    'w-full px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm px-4">
      <form
        onSubmit={handleSubmit}
        className="glass-card rounded-2xl w-full max-w-lg p-5 space-y-3 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">New Task</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Project</label>
          <select
            required
            value={form.projectId}
            onChange={(e) => set('projectId', e.target.value)}
            className={field}
          >
            <option value="">Select a project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Title</label>
          <input
            required
            minLength={2}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            className={field}
            placeholder="Implement refresh-token rotation"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Description</label>
          <textarea
            required
            minLength={3}
            rows={3}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            className={field}
            placeholder="What needs to be done?"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Assign to developer</label>
            <select
              value={form.assignedDeveloperId}
              onChange={(e) => set('assignedDeveloperId', e.target.value)}
              className={field}
            >
              <option value="">Unassigned</option>
              {developers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Due date</label>
            <input
              required
              type="date"
              value={form.dueDate}
              onChange={(e) => set('dueDate', e.target.value)}
              className={field}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Status</label>
            <select
              value={form.status}
              onChange={(e) => set('status', e.target.value)}
              className={field}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => set('priority', e.target.value)}
              className={field}
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          Assigning a developer sends them an in-app notification in real time.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-xl text-sm text-slate-400 border border-slate-700 hover:border-slate-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Create task
          </button>
        </div>
      </form>
    </div>
  );
}

/** Inline re-assignment for Admin/PM. Triggers the assignment notification. */
function AssignDeveloperSelect({
  task,
  developers,
  onUpdated,
}: {
  task: Task;
  developers: UserType[];
  onUpdated: (t: Task) => void;
}) {
  const [saving, setSaving] = useState(false);

  const handleChange = async (value: string) => {
    setSaving(true);
    try {
      const { data } = await api.put(`/tasks/${task.id}`, {
        assignedDeveloperId: value || null,
      });
      onUpdated(data.data.task);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Failed to reassign task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <select
      disabled={saving}
      value={task.assignedDeveloperId ?? ''}
      onChange={(e) => handleChange(e.target.value)}
      title="Reassign this task"
      className="px-2 py-0.5 rounded-md bg-slate-800/60 border border-slate-700 text-slate-300 text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-60"
    >
      <option value="">Unassigned</option>
      {developers.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </select>
  );
}

function StatusUpdateDropdown({
  task,
  onUpdated,
}: {
  task: Task;
  onUpdated: (t: Task) => void;
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const canUpdate =
    user?.role === 'ADMIN' ||
    user?.role === 'PM' ||
    (user?.role === 'DEVELOPER' && task.assignedDeveloperId === user.id);

  const nextStatus: Record<TaskStatus, TaskStatus | null> = {
    TODO: 'IN_PROGRESS',
    IN_PROGRESS: 'IN_REVIEW',
    IN_REVIEW: 'DONE',
    DONE: null,
  };

  const next = nextStatus[task.status];

  if (!canUpdate || !next) {
    return <StatusBadge status={task.status} />;
  }

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
      id={`status-update-${task.id}`}
      onClick={handleUpdate}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition-all disabled:opacity-60"
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3 h-3" />}
      Move to {next.replace('_', ' ')}
    </button>
  );
}

export default function TasksPage() {
  const { user } = useAuth();
  const { onTaskUpdated } = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [developers, setDevelopers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const canManage = user?.role === 'ADMIN' || user?.role === 'PM';

  // Filters live entirely in the URL, so any filtered view is shareable and
  // the same values are sent verbatim to the API as query parameters.
  const statusFilter = searchParams.get('status') as TaskStatus | null;
  const priorityFilter = searchParams.get('priority') as TaskPriority | null;
  const projectFilter = searchParams.get('projectId') || '';
  const dueFrom = searchParams.get('dueFrom') || '';
  const dueTo = searchParams.get('dueTo') || '';

  const fetchTasks = useCallback(async () => {
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    if (priorityFilter) params.priority = priorityFilter;
    if (projectFilter) params.projectId = projectFilter;
    if (dueFrom) params.dueFrom = dueFrom;
    if (dueTo) params.dueTo = dueTo;

    const { data } = await api.get('/tasks', { params });
    setTasks(data.data.tasks);
  }, [statusFilter, priorityFilter, projectFilter, dueFrom, dueTo]);

  useEffect(() => {
    Promise.all([fetchTasks(), api.get('/projects')])
      .then(([, pRes]) => setProjects(pRes.data.data.projects))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [fetchTasks]);

  // Only Admin/PM may list developers; the endpoint rejects anyone else.
  useEffect(() => {
    if (!canManage) return;
    api
      .get('/users/developers')
      .then(({ data }) => setDevelopers(data.data.developers))
      .catch(() => undefined);
  }, [canManage]);

  // Real-time task updates via WebSocket
  useEffect(() => {
    const unsubscribe = onTaskUpdated(({ task }) => {
      setTasks((prev) => {
        const idx = prev.findIndex((t) => t.id === task.id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = task;
          return next;
        }
        return prev;
      });
    });
    return unsubscribe;
  }, [onTaskUpdated]);

  const setFilter = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  const clearFilters = () => setSearchParams({});
  const activeFilters = [statusFilter, priorityFilter, projectFilter, dueFrom, dueTo].filter(Boolean);
  const hasFilters = activeFilters.length > 0;

  if (loading) return <LoadingSpinner message="Loading tasks..." />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Tasks</h2>
          <p className="text-slate-400 text-sm mt-1">{tasks.length} task{tasks.length !== 1 ? 's' : ''} found</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="filter-tasks-btn"
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
              hasFilters
                ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-300'
                : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters {hasFilters && `(${activeFilters.length})`}
          </button>
          {canManage && (
            <button
              id="create-task-btn"
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-all"
            >
              <Plus className="w-4 h-4" />
              New Task
            </button>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="glass-card rounded-2xl p-4 mb-5 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Status</label>
            <select
              value={statusFilter || ''}
              onChange={(e) => setFilter('status', e.target.value || null)}
              className="px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Priority</label>
            <select
              value={priorityFilter || ''}
              onChange={(e) => setFilter('priority', e.target.value || null)}
              className="px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Priorities</option>
              {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Project</label>
            <select
              value={projectFilter}
              onChange={(e) => setFilter('projectId', e.target.value || null)}
              className="px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Due from</label>
            <input
              type="date"
              value={dueFrom}
              max={dueTo || undefined}
              onChange={(e) => setFilter('dueFrom', e.target.value || null)}
              className="px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Due to</label>
            <input
              type="date"
              value={dueTo}
              min={dueFrom || undefined}
              onChange={(e) => setFilter('dueTo', e.target.value || null)}
              className="px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 transition-all"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
      )}

      {tasks.length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="w-8 h-8" />}
          title="No tasks found"
          description={hasFilters ? 'Try adjusting your filters.' : 'No tasks have been assigned yet.'}
        />
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`glass-card rounded-2xl p-4 hover:glow-indigo-sm transition-all duration-150 ${task.isOverdue && task.status !== 'DONE' ? 'border border-red-500/20' : ''}`}
            >
              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2 flex-wrap">
                    <h3 className={`text-sm font-medium ${task.status === 'DONE' ? 'line-through text-slate-500' : 'text-white'}`}>
                      {task.title}
                    </h3>
                    {task.isOverdue && task.status !== 'DONE' && (
                      <span className="inline-flex items-center gap-1 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-md">
                        <AlertTriangle className="w-3 h-3" />
                        Overdue
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{task.description}</p>

                  <div className="flex items-center flex-wrap gap-3 mt-2.5">
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <FolderKanban className="w-3.5 h-3.5" />
                      {task.project?.name}
                    </div>
                    {task.assignedDeveloper && (
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <User className="w-3.5 h-3.5" />
                        {task.assignedDeveloper.name}
                      </div>
                    )}
                    <div className={`flex items-center gap-1 text-xs ${task.isOverdue && task.status !== 'DONE' ? 'text-red-400' : 'text-slate-500'}`}>
                      <Calendar className="w-3.5 h-3.5" />
                      {format(new Date(task.dueDate), 'MMM d, yyyy')}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <PriorityBadge priority={task.priority} />
                  <StatusUpdateDropdown task={task} onUpdated={(updated) => setTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t))} />
                  {canManage && (
                    <AssignDeveloperSelect
                      task={task}
                      developers={developers}
                      onUpdated={(updated) => setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))}
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateTaskModal
          projects={projects}
          developers={developers}
          onClose={() => setShowCreate(false)}
          onCreated={(task) => setTasks((prev) => [task, ...prev])}
        />
      )}
    </div>
  );
}
