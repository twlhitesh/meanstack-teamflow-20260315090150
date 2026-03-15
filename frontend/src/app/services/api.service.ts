import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

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

  getProjects(): Observable<any[]> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/projects`).pipe(
      map(response => response.data || []),
      catchError(this.handleError)
    );
  }

  createProject(project: any): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/projects`, project).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  deleteProject(id: string): Observable<any> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/projects/${id}`).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getTasks(projectId?: string): Observable<any[]> {
    const url = projectId ? `${this.apiUrl}/tasks?projectId=${projectId}` : `${this.apiUrl}/tasks`;
    return this.http.get<ApiResponse<any[]>>(url).pipe(
      map(response => response.data || []),
      catchError(this.handleError)
    );
  }

  createTask(task: any): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/tasks`, task).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  updateTask(id: string, task: any): Observable<any> {
    return this.http.put<ApiResponse<any>>(`${this.apiUrl}/tasks/${id}`, task).pipe(
      map(response => response.data),
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
