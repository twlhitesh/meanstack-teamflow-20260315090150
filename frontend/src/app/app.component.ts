import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  constructor(public auth: AuthService, private router: Router) {
    if (this.auth.token) {
      this.auth.loadProfile().subscribe({
        error: () => {
          this.auth.logout();
          this.router.navigate(['/auth']);
        }
      });
    }
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/']);
  }
}
