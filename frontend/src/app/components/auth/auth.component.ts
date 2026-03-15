import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.css'
})
export class AuthComponent {
  mode: 'login' | 'register' = 'login';
  loading = false;
  error = '';

  loginForm = {
    email: '',
    password: ''
  };

  registerForm = {
    name: '',
    email: '',
    password: ''
  };

  constructor(private auth: AuthService, private router: Router) {}

  toggleMode(mode: 'login' | 'register') {
    this.mode = mode;
    this.error = '';
  }

  submit() {
    this.error = '';
    this.loading = true;

    const request = this.mode === 'login'
      ? this.auth.login(this.loginForm)
      : this.auth.register(this.registerForm);

    request.subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/projects']);
      },
      error: (err: Error) => {
        this.loading = false;
        this.error = err.message;
      }
    });
  }
}
