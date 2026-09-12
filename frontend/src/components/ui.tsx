import React from 'react';
import { TaskStatus, TaskPriority } from '../types';

const statusConfig: Record<TaskStatus, { label: string; className: string }> = {
  TODO: { label: 'To Do', className: 'bg-slate-700/60 text-slate-300 border border-slate-600/40' },
  IN_PROGRESS: { label: 'In Progress', className: 'bg-blue-500/15 text-blue-300 border border-blue-500/30' },
  IN_REVIEW: { label: 'In Review', className: 'bg-amber-500/15 text-amber-300 border border-amber-500/30' },
  DONE: { label: 'Done', className: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' },
};

const priorityConfig: Record<TaskPriority, { label: string; className: string; dot: string }> = {
  LOW: { label: 'Low', className: 'bg-slate-700/40 text-slate-400 border border-slate-600/30', dot: 'bg-slate-400' },
  MEDIUM: { label: 'Medium', className: 'bg-blue-500/10 text-blue-400 border border-blue-500/20', dot: 'bg-blue-400' },
  HIGH: { label: 'High', className: 'bg-orange-500/15 text-orange-300 border border-orange-500/30', dot: 'bg-orange-400' },
  CRITICAL: { label: 'Critical', className: 'bg-red-500/15 text-red-300 border border-red-500/30', dot: 'bg-red-400' },
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const cfg = statusConfig[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const cfg = priorityConfig[priority];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${cfg.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export function StatCard({
  label,
  value,
  icon,
  colorClass = 'text-indigo-400',
  bgClass = 'bg-indigo-500/10',
  trend,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  colorClass?: string;
  bgClass?: string;
  trend?: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-5 hover:glow-indigo-sm transition-all duration-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${colorClass}`}>{value}</p>
          {trend && <p className="text-xs text-slate-500 mt-1">{trend}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${bgClass}`}>
          <span className={colorClass}>{icon}</span>
        </div>
      </div>
    </div>
  );
}

export function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-3">
      <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-400 text-sm">{message}</p>
    </div>
  );
}

export function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="p-4 rounded-2xl bg-slate-800/60 text-slate-500">{icon}</div>
      <h3 className="text-slate-300 font-medium">{title}</h3>
      <p className="text-slate-500 text-sm max-w-xs">{description}</p>
    </div>
  );
}
