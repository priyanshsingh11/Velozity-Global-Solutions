import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, Plus, Loader2, Building2, User, ChevronRight, CheckSquare } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Project, Client, User as UserType } from '../types';
import { LoadingSpinner, EmptyState } from '../components/ui';

function CreateProjectModal({
  clients,
  onClose,
  onCreated,
}: {
  clients: Client[];
  onClose: () => void;
  onCreated: (p: Project) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/projects', { name, description, clientId });
      onCreated(data.data.project);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-lg font-semibold text-white mb-5">Create New Project</h3>
        {error && (
          <p className="mb-4 text-sm text-red-400 p-3 rounded-lg bg-red-500/10 border border-red-500/20">{error}</p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Project Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Enterprise Portal v2"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
              placeholder="Brief project overview..."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm resize-none"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Client</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-white focus:outline-none focus:border-indigo-500 text-sm"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name} — {c.company}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 transition-all text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all text-sm disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const { onTaskUpdated } = useSocket();
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const canCreate = user?.role === 'ADMIN' || user?.role === 'PM';

  useEffect(() => {
    Promise.all([
      api.get('/projects'),
      canCreate ? api.get('/clients') : Promise.resolve({ data: { data: { clients: [] } } }),
    ])
      .then(([pRes, cRes]) => {
        setProjects(pRes.data.data.projects);
        setClients(cRes.data.data.clients);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading projects..." />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Projects</h2>
          <p className="text-slate-400 text-sm mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''} accessible</p>
        </div>
        {canCreate && (
          <button
            id="create-project-btn"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all shadow-lg shadow-indigo-500/20 hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        )}
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="w-8 h-8" />}
          title="No projects found"
          description={canCreate ? 'Create your first project to get started.' : 'No projects have been assigned to you yet.'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="glass-card rounded-2xl p-5 hover:glow-indigo-sm hover:-translate-y-0.5 transition-all duration-200 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10">
                  <FolderKanban className="w-5 h-5 text-indigo-400" />
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 transition-colors" />
              </div>
              <h3 className="font-semibold text-white text-sm leading-snug mb-1 line-clamp-2">{p.name}</h3>
              <p className="text-slate-500 text-xs line-clamp-2 mb-4">{p.description}</p>
              <div className="flex items-center justify-between pt-3 border-t border-slate-700/40">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Building2 className="w-3.5 h-3.5" />
                  {p.client?.name || 'Unknown client'}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <CheckSquare className="w-3.5 h-3.5" />
                  {p._count?.tasks ?? p.tasks?.length ?? 0} tasks
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showModal && (
        <CreateProjectModal
          clients={clients}
          onClose={() => setShowModal(false)}
          onCreated={(p) => setProjects((prev) => [p, ...prev])}
        />
      )}
    </div>
  );
}
