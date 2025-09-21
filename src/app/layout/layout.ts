import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { Menu } from '../menu/menu'; // tu navbar standalone

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, Menu],
  templateUrl: './layout.html',
})
export class Layout {}