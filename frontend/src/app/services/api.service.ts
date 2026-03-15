import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthPayload, NewProjectPayload, Project, Task, UserProfile } from '../models/domain.models';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private handleError(error: any) {
    const message = error.error?.error || 'An error occurred';
    return throwError(() => new Error(message));
  }

  register(payload: { name: string; email: string; password: string }): Observable<AuthPayload> {
    return this.http.post<ApiResponse<AuthPayload>>(`${this.apiUrl}/auth/register`, payload).pipe(
      map(response => {
        if (!response.data) throw new Error('Invalid register response');
        return response.data;
      }),
      catchError(this.handleError)
    );
  }

  login(payload: { email: string; password: string }): Observable<AuthPayload> {
    return this.http.post<ApiResponse<AuthPayload>>(`${this.apiUrl}/auth/login`, payload).pipe(
      map(response => {
        if (!response.data) throw new Error('Invalid login response');
        return response.data;
      }),
      catchError(this.handleError)
    );
  }

  getMe(): Observable<UserProfile> {
    return this.http.get<ApiResponse<UserProfile>>(`${this.apiUrl}/auth/me`).pipe(
      map(response => {
        if (!response.data) throw new Error('Invalid user profile response');
        return response.data;
      }),
      catchError(this.handleError)
    );
  }

  getProjects(): Observable<Project[]> {
    return this.http.get<ApiResponse<Project[]>>(`${this.apiUrl}/projects`).pipe(
      map(response => response.data || []),
      catchError(this.handleError)
    );
  }

  createProject(project: NewProjectPayload): Observable<Project> {
    return this.http.post<ApiResponse<Project>>(`${this.apiUrl}/projects`, project).pipe(
      map(response => {
        if (!response.data) throw new Error('Invalid create project response');
        return response.data;
      }),
      catchError(this.handleError)
    );
  }

  deleteProject(id: string): Observable<any> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/projects/${id}`).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getTasks(projectId?: string): Observable<Task[]> {
    const url = projectId
      ? `${this.apiUrl}/tasks?projectId=${encodeURIComponent(projectId)}`
      : `${this.apiUrl}/tasks`;
    return this.http.get<ApiResponse<Task[]>>(url).pipe(
      map(response => response.data || []),
      catchError(this.handleError)
    );
  }

  createTask(task: Partial<Task>): Observable<Task> {
    return this.http.post<ApiResponse<Task>>(`${this.apiUrl}/tasks`, task).pipe(
      map(response => {
        if (!response.data) throw new Error('Invalid create task response');
        return response.data;
      }),
      catchError(this.handleError)
    );
  }

  updateTask(id: string, task: Partial<Task>): Observable<Task> {
    return this.http.put<ApiResponse<Task>>(`${this.apiUrl}/tasks/${id}`, task).pipe(
      map(response => {
        if (!response.data) throw new Error('Invalid update task response');
        return response.data;
      }),
      catchError(this.handleError)
    );
  }

  deleteTask(id: string): Observable<any> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/tasks/${id}`).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }
}
