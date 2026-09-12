import React, { useEffect, useState } from 'react';
import { Building2, Plus, Loader2 } from 'lucide-react';
import api from '../lib/api';
import { Client } from '../types';
import { LoadingSpinner, EmptyState } from '../components/ui';

function CreateClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Client) => void }) {
  const [form, setForm] = useState({ name: '', email: '', company: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/clients', form);
      onCreated(data.data.client);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to create client');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card rounded-2xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-white mb-5">Add New Client</h3>
        {error && <p className="mb-4 text-sm text-red-400 p-3 rounded-lg bg-red-500/10 border border-red-500/20">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {(['name', 'email', 'company'] as const).map((field) => (
            <div key={field}>
              <label className="block text-sm text-slate-300 mb-1.5 capitalize">{field}</label>
              <input
                type={field === 'email' ? 'email' : 'text'}
                value={form[field]}
                onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                required
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Add Client
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    api.get('/clients')
      .then(({ data }) => setClients(data.data.clients))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading clients..." />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Clients</h2>
          <p className="text-slate-400 text-sm mt-1">{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          id="add-client-btn"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all shadow-lg shadow-indigo-500/20"
        >
          <Plus className="w-4 h-4" />
          Add Client
        </button>
      </div>

      {clients.length === 0 ? (
        <EmptyState icon={<Building2 className="w-8 h-8" />} title="No clients" description="Add your first client to start managing projects." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map((c) => (
            <div key={c.id} className="glass-card rounded-2xl p-5 hover:glow-indigo-sm transition-all">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {c.company.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-white text-sm truncate">{c.name}</h3>
                  <p className="text-xs text-indigo-400 truncate">{c.company}</p>
                  <p className="text-xs text-slate-500 mt-1 truncate">{c.email}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <CreateClientModal
          onClose={() => setShowModal(false)}
          onCreated={(c) => setClients((prev) => [c, ...prev])}
        />
      )}
    </div>
  );
}
