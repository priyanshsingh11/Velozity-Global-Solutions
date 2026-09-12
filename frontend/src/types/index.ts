export type Role = 'ADMIN' | 'PM' | 'DEVELOPER';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type NotificationType = 'TASK_ASSIGNED' | 'TASK_IN_REVIEW' | 'TASK_OVERDUE' | 'SYSTEM';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt?: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  company: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  clientId: string;
  createdById: string;
  client?: { id: string; name: string; company: string };
  creator?: { id: string; name: string; email: string };
  tasks?: Task[];
  _count?: { tasks: number };
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string;
  assignedDeveloperId: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  isOverdue: boolean;
  project?: { id: string; name: string; createdById: string };
  assignedDeveloper?: { id: string; name: string; email: string } | null;
  activities?: ActivityLog[];
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  taskId: string | null;
  projectId: string;
  userId: string;
  action: string;
  oldStatus: TaskStatus | null;
  newStatus: TaskStatus | null;
  details: string | null;
  user?: { id: string; name: string; role?: Role };
  project?: { id: string; name: string };
  task?: { id: string; title: string; status: TaskStatus } | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  taskId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  task?: { id: string; title: string; status: TaskStatus; projectId: string } | null;
  createdAt: string;
}

export interface DashboardStatsAdmin {
  role: 'ADMIN';
  totalProjects: number;
  totalTasks: number;
  tasksByStatus: Record<TaskStatus, number>;
  overdueCount: number;
  activeUsersOnline: number;
}

export interface DashboardStatsPM {
  role: 'PM';
  totalProjects: number;
  projects: Project[];
  tasksByPriority: Record<TaskPriority, number>;
  upcomingTasksThisWeek: Task[];
}

export interface DashboardStatsDev {
  role: 'DEVELOPER';
  stats: {
    total: number;
    todo: number;
    inProgress: number;
    inReview: number;
    done: number;
    overdue: number;
  };
  tasks: Task[];
}

export type DashboardStats = DashboardStatsAdmin | DashboardStatsPM | DashboardStatsDev;
