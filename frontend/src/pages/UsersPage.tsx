import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import api from '../lib/api';
import { User } from '../types';
import { LoadingSpinner, EmptyState } from '../components/ui';

const roleConfig: Record<string, { label: string; className: string }> = {
  ADMIN: { label: 'Admin', className: 'bg-violet-500/15 text-violet-300 border border-violet-500/30' },
  PM: { label: 'Project Manager', className: 'bg-blue-500/15 text-blue-300 border border-blue-500/30' },
  DEVELOPER: { label: 'Developer', className: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' },
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/users')
      .then(({ data }) => setUsers(data.data.users))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading users..." />;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Users</h2>
        <p className="text-slate-400 text-sm mt-1">{users.length} registered users</p>
      </div>

      {users.length === 0 ? (
        <EmptyState icon={<Users className="w-8 h-8" />} title="No users found" description="No users have been created yet." />
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Tasks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {users.map((u: any) => {
                const cfg = roleConfig[u.role];
                return (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {u.name.charAt(0)}
                        </div>
                        <span className="font-medium text-white">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${cfg.className}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {u._count?.assignedTasks ?? 0} assigned
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
