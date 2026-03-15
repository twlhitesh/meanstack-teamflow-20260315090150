export type TaskStatus = 'todo' | 'in-progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Project {
  _id: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface Task {
  _id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  project: Project | string | null;
  createdAt: string;
}

export interface NewProjectPayload {
  name: string;
  description: string;
}

export interface NewTaskPayload {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  project: string;
}

export interface UserProfile {
  _id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthPayload {
  token: string;
  user: UserProfile;
}
