import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.css'
})
export class TasksComponent implements OnInit {
  tasks: any[] = [];
  projects: any[] = [];
  newTask = { title: '', description: '', status: 'todo', priority: 'medium', dueDate: '', project: '' };
  showForm = false;
  filterProject = '';
  filterStatus = '';
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
        this.tasks = this.filterStatus 
          ? allTasks.filter((t: any) => t.status === this.filterStatus) 
          : allTasks;
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
    
    this.submitting = true;
    this.error = '';
    
    const taskData = {
      ...this.newTask,
      dueDate: this.newTask.dueDate || null
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

  updateStatus(task: any) {
    const statuses = ['todo', 'in-progress', 'done'];
    const currentIndex = statuses.indexOf(task.status);
    const newStatus = statuses[(currentIndex + 1) % statuses.length];
    
    this.api.updateTask(task._id, { status: newStatus }).subscribe({
      next: (updatedTask) => {
        task.status = updatedTask.status;
      },
      error: (err) => {
        this.error = err.message;
      }
    });
  }

  updatePriority(task: any, priority: string) {
    this.api.updateTask(task._id, { priority }).subscribe({
      next: () => {
        this.loadTasks();
      },
      error: (err) => {
        this.error = err.message;
      }
    });
  }

  deleteTask(id: string) {
    if (this.submitting) return;
    
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

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'todo': 'To Do',
      'in-progress': 'In Progress',
      'done': 'Done'
    };
    return labels[status] || status;
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
