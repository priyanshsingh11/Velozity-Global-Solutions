import React, { useEffect, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import api from '../lib/api';
import { useSocket } from '../context/SocketContext';
import { ActivityLog } from '../types';
import { LoadingSpinner, StatusBadge, EmptyState } from '../components/ui';
import { formatDistanceToNow } from 'date-fns';

const ACTION_COLOR: Record<string, string> = {
  STATUS_CHANGE: 'bg-blue-500',
  TASK_CREATED: 'bg-emerald-500',
  TASK_UPDATED: 'bg-amber-500',
  TASK_OVERDUE: 'bg-red-500',
  DEFAULT: 'bg-indigo-500',
};

export default function ActivityPage() {
  const { recentActivities } = useSocket();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [catchingUp, setCatchingUp] = useState(false);

  useEffect(() => {
    api.get('/activity/feed?limit=50')
      .then(({ data }) => setActivities(data.data.activities))
      .finally(() => setLoading(false));
  }, []);

  // Merge real-time socket activities
  useEffect(() => {
    if (recentActivities.length > 0) {
      setActivities((prev) => {
        const merged = [...recentActivities, ...prev];
        const uniqueIds = new Set<string>();
        return merged.filter((a) => {
          if (uniqueIds.has(a.id)) return false;
          uniqueIds.add(a.id);
          return true;
        }).slice(0, 100);
      });
    }
  }, [recentActivities]);

  const handleCatchUp = async () => {
    setCatchingUp(true);
    try {
      const { data } = await api.get('/activity/missed');
      setActivities((prev) => {
        const merged = [...data.data.activities, ...prev];
        const uniqueIds = new Set<string>();
        return merged.filter((a) => {
          if (uniqueIds.has(a.id)) return false;
          uniqueIds.add(a.id);
          return true;
        });
      });
    } finally {
      setCatchingUp(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading activity feed..." />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Activity Feed</h2>
          <p className="text-slate-400 text-sm mt-1">
            Role-filtered real-time activity stream
          </p>
        </div>
        <button
          id="catchup-btn"
          onClick={handleCatchUp}
          disabled={catchingUp}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 text-sm font-medium transition-all disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${catchingUp ? 'animate-spin' : ''}`} />
          Catch Up (Last 20)
        </button>
      </div>

      {activities.length === 0 ? (
        <EmptyState
          icon={<Activity className="w-8 h-8" />}
          title="No activity yet"
          description="Activities will appear here as tasks are created and updated."
        />
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-2 bottom-2 w-px bg-slate-700/50" />

          <div className="space-y-0">
            {activities.map((activity, idx) => (
              <div
                key={activity.id}
                className="relative flex gap-5 pb-5 pl-14 group"
              >
                {/* Dot */}
                <div
                  className={`absolute left-4 top-1.5 w-4 h-4 rounded-full border-2 border-slate-950 flex-shrink-0 ${ACTION_COLOR[activity.action] || ACTION_COLOR.DEFAULT}`}
                />

                {/* Card */}
                <div className="flex-1 glass-card rounded-2xl p-4 group-hover:glow-indigo-sm transition-all duration-150">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-200 leading-snug">
                        {activity.details || `${activity.action.replace('_', ' ')}`}
                      </p>
                      {activity.task && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          Task: <span className="text-slate-400">{activity.task.title}</span>
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {activity.project && (
                          <span className="text-xs text-indigo-400/80 bg-indigo-500/10 px-2 py-0.5 rounded-md">
                            {activity.project.name}
                          </span>
                        )}
                        {activity.oldStatus && activity.newStatus && (
                          <div className="flex items-center gap-1.5">
                            <StatusBadge status={activity.oldStatus} />
                            <span className="text-slate-600 text-xs">→</span>
                            <StatusBadge status={activity.newStatus} />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {activity.user && (
                        <span className="text-xs text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-md whitespace-nowrap">
                          {activity.user.name}
                        </span>
                      )}
                      <time className="text-xs text-slate-500 whitespace-nowrap">
                        {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                      </time>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
