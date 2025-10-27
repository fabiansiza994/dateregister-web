import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  styles: [`
  :host { display: block; }
  /* Ocultra en móvil cuando el host tiene la clase 'hidden' */
  :host(.hidden) { display: none; }
  /* En md+ re-mostramos aunque tenga 'hidden' (para respetar hidden md:block en app.html) */
  @media (min-width: 768px) { :host(.hidden) { display: block; } }

    footer {
      background: var(--dr-surface, #0f1420);
      color: var(--dr-text, #e5e7eb);
      font-size: 0.9rem;
      padding: 1rem 1rem;
      border-top: 1px solid rgba(255,255,255,0.08);
      width: 100%;
      margin-top: auto; /* 🔥 Esto permite que se quede al fondo si el contenedor usa flex */
    }

    .footer-container {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 1.5rem;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: .6rem;
      font-weight: 600;
    }

    .brand i {
      color: var(--dr-brand, #7c3aed);
      font-size: 1.3rem;
    }

    .links a {
      color: var(--dr-muted, #94a3b8);
      text-decoration: none;
      margin: 0 .5rem;
      transition: color .2s ease;
    }

    .links a:hover {
      color: var(--dr-brand-2, #22d3ee);
    }

    .credits {
      color: var(--dr-muted, #94a3b8);
      font-size: 0.8rem;
    }

    @media (max-width: 768px) {
      .footer-container {
        flex-direction: column;
        text-align: center;
      }
    }
  `],
  template: `
  <footer>
    <div class="footer-container">
      <div class="brand">
        <i class="bi bi-shield-lock"></i>
        <span>DataRegister</span>
      </div>

      <div class="links">
        <a routerLink="/about">Acerca</a> ·
        <a routerLink="/contact">Contacto</a> ·
        <a routerLink="/privacy">Privacidad</a>
      </div>

      <div class="credits">
        © {{ year }} <strong>DataRegister by Hacker994 & IA</strong> — Todos los derechos reservados.
      </div>
    </div>
  </footer>
  `
})
export class FooterComponent {
  year = new Date().getFullYear();
}
