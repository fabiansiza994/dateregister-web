import { Injectable } from '@angular/core';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export type Side = 'top' | 'bottom' | 'left' | 'right';
export type Align = 'start' | 'center' | 'end';

export interface TourStep {
  selector: string;
  title: string;
  description: string;
  side?: Side;
  align?: Align;
  onBefore?: () => void; // abrir dropdown/tab/modal antes del paso
}

export interface TourOpts {
  key?: string;                 // si está, se guarda en localStorage y corre 1 sola vez
  elevateModals?: boolean;      // por defecto true
  onFinish?: () => void;        // callback cuando el tour termina / se cierra
}

@Injectable({ providedIn: 'root' })
export class TourService {
  private d: Driver;

  constructor() {
    this.d = driver({
      animate: true,
      smoothScroll: true,
      overlayOpacity: 0.5,
      stagePadding: 6,
      showProgress: true,
      showButtons: ['next', 'previous', 'close'] as const, // botones globales
      nextBtnText: 'Siguiente',
      prevBtnText: 'Atrás',
      doneBtnText: 'Entendido',
    });
  }

  // ====== elevación de modales/overlays mientras corre el tour ======
  private enableModalElevation() { document.body.classList.add('tour-elevate'); }
  private disableModalElevation() { document.body.classList.remove('tour-elevate'); }

  private attachCleanup(elevate: boolean, onFinish?: () => void) {
    // @ts-ignore (según versión de driver puede no estar tipado)
    this.d.on?.('destroyed', () => { if (elevate) this.disableModalElevation(); onFinish?.(); });
    // @ts-ignore
    this.d.on?.('reset', () => { if (elevate) this.disableModalElevation(); onFinish?.(); });
  }

  // ====== helpers reutilizables ======
  /** Abre el navbar colapsado (útil en mobile) */
  public openCollapsedNavbar(navId = 'navbarContent') {
    const navbar = document.getElementById(navId);
    const toggler = document.querySelector('.navbar-toggler') as HTMLButtonElement | null;
    if (!navbar) return;
    if (!navbar.classList.contains('show')) {
      toggler?.click();
      if (!navbar.classList.contains('show')) {
        navbar.classList.add('show');
        toggler?.setAttribute('aria-expanded', 'true');
      }
    }
  }

  /** Abre un dropdown de Bootstrap por id del toggle (ej: 'adminMenu') */
  public openDropdownById(toggleId: string) {
    const toggle = document.getElementById(toggleId);
    const menu = toggle?.nextElementSibling as HTMLElement | null;
    if (!toggle || !menu) return;
    toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    if (!menu.classList.contains('show')) {
      toggle.setAttribute('aria-expanded', 'true');
      menu.classList.add('show');
      menu.style.display = 'block';
    }
  }

  /** Abre un modal (Bootstrap) por id; hace fallback si no hay bootstrap.bundle.js */
  public ensureModalOpen(modalId: string) {
    const el = document.getElementById(modalId) as HTMLElement | null;
    if (!el || el.classList.contains('show')) return;
    try {
      // @ts-ignore
      const Modal = (window as any).bootstrap?.Modal;
      if (Modal) {
        // @ts-ignore
        Modal.getOrCreateInstance(el).show();
        return;
      }
    } catch { /* noop */ }
    el.classList.add('show');
    el.style.display = 'block';
    el.removeAttribute('aria-hidden');
  }

  // ====== API genérica ======
  start(steps: TourStep[], opts: TourOpts = {}) {
    if (!steps?.length) return;
    if (opts.key && localStorage.getItem(opts.key)) return;  // ya corrido antes

    const elevate = opts.elevateModals !== false;
    if (elevate) this.enableModalElevation();

    const mapped = steps
      .map(s => ({
        element: s.selector,
        onHighlightStarted: () => s.onBefore?.(),
        popover: {
          title: s.title,
          description: s.description,
          side: s.side ?? 'bottom',
          align: s.align ?? 'center',
        }
      }))
      .filter(s => !!document.querySelector(String(s.element)));

    if (!mapped.length) { if (elevate) this.disableModalElevation(); return; }

    this.d.setSteps(mapped);
    this.d.drive();
    this.attachCleanup(elevate, opts.onFinish);

    if (opts.key) localStorage.setItem(opts.key, '1');
  }

  // ====== Tour de Módulos (atajo) ======
  startModulesTour(role?: string, sector?: string, onFinish?: () => void) {
    const steps: TourStep[] = [
      { selector: '#mod-clientes',  title: 'Clientes',  description: 'Gestiona la información de tus clientes, contactos y datos asociados.' },
      { selector: '#mod-trabajos',  title: 'Trabajos',  description: 'Crea y administra trabajos, tareas y estados de ejecución.' },
      { selector: '#mod-reportes',  title: 'Reportes',  description: 'Explora métricas y estadísticas para tomar mejores decisiones.' },
    ];
    if ((sector ?? '').toUpperCase() === 'SALUD' && document.getElementById('mod-pacientes')) {
      steps.push({ selector: '#mod-pacientes', title: 'Pacientes', description: 'Gestiona pacientes, historiales clínicos, citas y seguimiento.' });
    }

    this.start(steps, { key: 'tour:modulos:v1', onFinish });
  }

  // ====== Nudge: abrir dropdown Admin y señalar Formas de pago ======
  startPaymentNudge(role?: string) {
    if ((role ?? '').toUpperCase() !== 'ADMIN') return; // solo admins ven el ítem

    const steps: TourStep[] = [
      {
        selector: '#menu-pagos',
        title: 'Crea tu método de pago',
        description: 'Abre aquí **Formas de pago** y luego presiona “Nuevo” para registrar tu primer método.',
        side: 'right',
        align: 'start',
        onBefore: () => {
          this.openCollapsedNavbar();       // en mobile
          this.openDropdownById('adminMenu'); // abre el dropdown Admin
        }
      }
    ];

    // corre sin key (para que lo puedas invocar después del tour de módulos)
    this.start(steps, { elevateModals: true });
  }
}
