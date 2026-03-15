import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  highlights = [
    'Organize tasks by project and priority',
    'Track progress from To Do to Done',
    'Keep teams aligned with deadlines and ownership'
  ];

  metrics = [
    { label: 'Completion visibility', value: '100%' },
    { label: 'Live progress stages', value: '3' },
    { label: 'Minutes to onboard', value: '< 5' }
  ];

  constructor(public auth: AuthService) {}
}
