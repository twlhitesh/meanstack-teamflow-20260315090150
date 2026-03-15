import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { NewTaskPayload, Project, Task, TaskPriority, TaskStatus } from '../../models/domain.models';

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.css'
})
export class TasksComponent implements OnInit {
  tasks: Task[] = [];
  projects: Project[] = [];
  newTask: NewTaskPayload = { title: '', description: '', status: 'todo', priority: 'medium', dueDate: '', project: '' };
  showForm = false;
  filterProject = '';
  filterStatus = '';
  searchTerm = '';
  loading = false;
  submitting = false;
  error = '';
  success = '';

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.filterProject = params['projectId'] || '';
      this.filterStatus = params['status'] || '';
      this.newTask.project = this.filterProject;
      this.loadTasks();
    });
    this.loadProjects();
  }

  loadProjects() {
    this.api.getProjects().subscribe({
      next: (data) => {
        this.projects = data;
      },
      error: (err) => {
        this.error = err.message;
      }
    });
  }

  loadTasks() {
    this.loading = true;
    this.error = '';
    const projectId = this.filterProject || undefined;
    
    this.api.getTasks(projectId).subscribe({
      next: (allTasks) => {
        this.tasks = allTasks;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message;
        this.loading = false;
      }
    });
  }

  createTask() {
    if (!this.newTask.title.trim() || this.submitting) return;
    if (!this.newTask.project && !this.filterProject) {
      this.error = 'Please select a project for this task';
      return;
    }
    
    this.submitting = true;
    this.error = '';
    
    const taskData: Partial<Task> = {
      ...this.newTask,
      dueDate: this.newTask.dueDate || null,
      project: this.newTask.project || this.filterProject
    };
    
    this.api.createTask(taskData).subscribe({
      next: () => {
        this.success = 'Task created successfully';
        this.loadTasks();
        this.newTask = { 
          title: '', 
          description: '', 
          status: 'todo', 
          priority: 'medium', 
          dueDate: '', 
          project: this.filterProject 
        };
        this.showForm = false;
        this.submitting = false;
        this.clearSuccess();
      },
      error: (err) => {
        this.error = err.message;
        this.submitting = false;
      }
    });
  }

  updateStatus(task: Task) {
    const statuses = ['todo', 'in-progress', 'done'];
    const currentIndex = statuses.indexOf(task.status);
    const newStatus = statuses[(currentIndex + 1) % statuses.length] as TaskStatus;
    
    this.api.updateTask(task._id, { status: newStatus }).subscribe({
      next: (updatedTask) => {
        task.status = updatedTask.status;
      },
      error: (err) => {
        this.error = err.message;
      }
    });
  }

  updatePriority(task: Task, priority: TaskPriority) {
    this.api.updateTask(task._id, { priority }).subscribe({
      next: (updatedTask) => {
        task.priority = updatedTask.priority;
      },
      error: (err) => {
        this.error = err.message;
      }
    });
  }

  deleteTask(id: string) {
    if (this.submitting) return;
    if (!confirm('Delete this task?')) return;
    
    this.submitting = true;
    this.error = '';
    
    this.api.deleteTask(id).subscribe({
      next: () => {
        this.success = 'Task deleted successfully';
        this.loadTasks();
        this.submitting = false;
        this.clearSuccess();
      },
      error: (err) => {
        this.error = err.message;
        this.submitting = false;
      }
    });
  }

  getPriorityClass(priority: string): string {
    return `priority-${priority}`;
  }

  getStatusClass(status: string): string {
    return `status-${status.replace('-', '')}`;
  }

  applyFilters() {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        projectId: this.filterProject || null,
        status: this.filterStatus || null
      },
      queryParamsHandling: 'merge'
    });
  }

  get filteredTasks(): Task[] {
    let list = [...this.tasks];

    if (this.filterStatus) {
      list = list.filter(task => task.status === this.filterStatus);
    }

    const keyword = this.searchTerm.trim().toLowerCase();
    if (keyword) {
      list = list.filter(task => {
        const projectName = typeof task.project === 'object' && task.project ? task.project.name : '';
        return task.title.toLowerCase().includes(keyword)
          || (task.description || '').toLowerCase().includes(keyword)
          || projectName.toLowerCase().includes(keyword);
      });
    }

    return list;
  }

  get todoCount(): number {
    return this.tasks.filter(task => task.status === 'todo').length;
  }

  get inProgressCount(): number {
    return this.tasks.filter(task => task.status === 'in-progress').length;
  }

  get doneCount(): number {
    return this.tasks.filter(task => task.status === 'done').length;
  }

  isOverdue(task: Task): boolean {
    if (!task.dueDate || task.status === 'done') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(task.dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'todo': 'To Do',
      'in-progress': 'In Progress',
      'done': 'Done'
    };
    return labels[status] || status;
  }

  getProjectName(task: Task): string {
    if (!task.project) return '';
    if (typeof task.project === 'string') {
      return this.projects.find(project => project._id === task.project)?.name || '';
    }
    return task.project.name;
  }

  goBack() {
    this.router.navigate(['/projects']);
  }

  clearSuccess() {
    setTimeout(() => this.success = '', 3000);
  }

  clearError() {
    this.error = '';
  }
}
