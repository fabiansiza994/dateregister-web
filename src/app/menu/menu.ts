import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './menu.html',
  styleUrls: ['./menu.css']
})
export class Menu {
  constructor(private router: Router) { }
  logout() {
    localStorage.removeItem('token');
    this.router.navigate(['/login']);
  }
}