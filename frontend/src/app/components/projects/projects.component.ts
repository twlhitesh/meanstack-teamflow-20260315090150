import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { NewProjectPayload, Project } from '../../models/domain.models';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.css'
})
export class ProjectsComponent implements OnInit {
  projects: Project[] = [];
  newProject: NewProjectPayload = { name: '', description: '' };
  searchTerm = '';
  showForm = false;
  loading = false;
  submitting = false;
  error = '';
  success = '';

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit() {
    this.loadProjects();
  }

  loadProjects() {
    this.loading = true;
    this.error = '';
    this.api.getProjects().subscribe({
      next: (data) => {
        this.projects = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message;
        this.loading = false;
      }
    });
  }

  createProject() {
    if (!this.newProject.name.trim() || this.submitting) return;
    if (this.newProject.name.trim().length < 3) {
      this.error = 'Project name must be at least 3 characters long';
      return;
    }
    
    this.submitting = true;
    this.error = '';
    
    this.api.createProject(this.newProject).subscribe({
      next: () => {
        this.success = 'Project created successfully';
        this.loadProjects();
        this.newProject = { name: '', description: '' };
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

  deleteProject(id: string) {
    if (this.submitting) return;
    if (!confirm('Delete this project and all associated tasks?')) return;
    
    this.submitting = true;
    this.error = '';
    
    this.api.deleteProject(id).subscribe({
      next: () => {
        this.success = 'Project deleted successfully';
        this.loadProjects();
        this.submitting = false;
        this.clearSuccess();
      },
      error: (err) => {
        this.error = err.message;
        this.submitting = false;
      }
    });
  }

  viewTasks(projectId: string) {
    this.router.navigate(['/tasks'], { queryParams: { projectId } });
  }

  get filteredProjects(): Project[] {
    const keyword = this.searchTerm.trim().toLowerCase();
    if (!keyword) return this.projects;
    return this.projects.filter(project => {
      return project.name.toLowerCase().includes(keyword)
        || (project.description || '').toLowerCase().includes(keyword);
    });
  }

  clearSuccess() {
    setTimeout(() => this.success = '', 3000);
  }

  clearError() {
    this.error = '';
  }
}
