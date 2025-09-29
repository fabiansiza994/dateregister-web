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
  onBefore?: () => void;     // abrir dropdown/tab/modal antes del paso
  onNextClick?: () => boolean | void; // bloquear/permitir avance
}

export interface TourOpts {
  key?: string;                 // si está, se guarda en localStorage y corre 1 sola vez
  elevateModals?: boolean;      // por defecto true
  onFinish?: () => void;        // callback cuando el tour termina / se cierra
  userKeyPart?: string;
  allowClose?: boolean;         // bloquear cierre (overlay/Esc/x)
  disablePrev?: boolean;        // ocultar botón "previous"
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
      showButtons: ['next', 'previous', 'close'] as const,
      nextBtnText: 'Siguiente',
      prevBtnText: 'Atrás',
      doneBtnText: 'Entendido',
    });
  }

  private buildScopedKey(baseKey?: string, userKeyPart?: string) {
    if (!baseKey) return undefined;
    return userKeyPart ? `${baseKey}:${userKeyPart}` : baseKey;
  }

  // Ejecuta una función solo una vez por instancia (útil para onBefore de cada paso)
  private once(fn: () => void): () => void {
    let called = false;
    return () => { if (!called) { called = true; fn(); } };
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

    // ✅ Idempotente: solo clic si NO está abierto
    if (!menu.classList.contains('show')) {
      toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      // Fallback si Bootstrap no está o no respondió
      if (!menu.classList.contains('show')) {
        toggle.setAttribute('aria-expanded', 'true');
        menu.classList.add('show');
        menu.style.display = 'block';
      }
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

  // ====== Motor genérico ======
  start(steps: TourStep[], opts: TourOpts = {}) {
    if (!steps?.length) return;

    const scopedKey = this.buildScopedKey(opts.key, opts.userKeyPart);
    if (scopedKey && localStorage.getItem(scopedKey)) return;  // ya corrido para este usuario

    const elevate = opts.elevateModals !== false;
    if (elevate) this.enableModalElevation();

    // ⚠️ Mapeamos asegurando que onBefore sea "once" por paso
    const mapped = steps.map(s => {
      const onBeforeOnce = s.onBefore ? this.once(s.onBefore) : undefined;
      return {
        element: s.selector,
        onHighlightStarted: () => onBeforeOnce?.(),
        onNextClick: () => s.onNextClick?.(),
        popover: {
          title: s.title,
          description: s.description,
          side: s.side ?? 'bottom',
          align: s.align ?? 'center',
        }
      };
    });

    // Configurar cierre y botones
    this.d.setConfig({
      allowClose: opts.allowClose ?? true,
      showButtons: (opts.disablePrev ? ['next', 'close'] : ['next', 'previous', 'close']) as any,
    });

    this.d.setSteps(mapped);
    this.d.drive();
    this.attachCleanup(elevate, opts.onFinish);

    if (scopedKey) localStorage.setItem(scopedKey, '1');
  }

  // ====== Tour de Módulos (atajo) ======
  startModulesTour(role?: string, sector?: string, userKeyPart?: string, onFinish?: () => void) {
    const steps: TourStep[] = [
      { selector: '#mod-clientes', title: 'Clientes', description: 'Gestiona la información de tus clientes, contactos y datos asociados.' },
      { selector: '#mod-trabajos', title: 'Trabajos', description: 'Crea y administra trabajos, tareas y estados de ejecución.' },
      { selector: '#mod-reportes', title: 'Reportes', description: 'Explora métricas y estadísticas para tomar mejores decisiones.' },
    ];
    if ((sector ?? '').toUpperCase() === 'SALUD' && document.getElementById('mod-pacientes')) {
      steps.push({ selector: '#mod-pacientes', title: 'Pacientes', description: 'Gestiona pacientes, historiales clínicos, citas y seguimiento.' });
    }

    this.start(steps, { key: 'tour:modulos:v1', userKeyPart, onFinish, allowClose: true });
  }

  // ====== Nudge: abrir dropdown Admin y señalar Formas de pago ======
  startPaymentNudge(role?: string, userKeyPart?: string) {
    if ((role ?? '').toUpperCase() !== 'ADMIN') return;
    const steps: TourStep[] = [{
      selector: '#menu-pagos',
      title: 'Crea tu método de pago',
      description: 'Abre aquí <b>Formas de pago</b> y luego presiona “Nuevo” para registrar tu primer método.',
      side: 'right', align: 'start',
      onBefore: () => { this.openCollapsedNavbar(); this.openDropdownById('adminMenu'); }
    }];
    this.start(steps, { key: 'tour:nudge:pagos:v1', userKeyPart, elevateModals: true, allowClose: true });
  }

  // ========== ENFORCED para ADMIN ==========
  /** Paso 1: en el menú, fuerza ir a Formas de pago */
  startAdminPaymentEnforcedTour(role?: string, userKeyPart?: string) {
    if ((role ?? '').toUpperCase() !== 'ADMIN') return;

    const steps: TourStep[] = [
      {
        selector: '#adminMenu',
        title: 'Panel de administración',
        description: 'Dale click menú <b>Admin</b> y dale <b>Next --></b> para configurar tu empresa.',
        side: 'left', align: 'start',
        onBefore: () => { this.openCollapsedNavbar(); }
      },
      {
        selector: '#menu-pagos',
        title: 'Formas de pago',
        description: 'Entra a <b>Formas de pago</b> para crear tu primer método.',
        side: 'right', align: 'start',
        onBefore: () => {
          this.setDropdownAutoClose('adminMenu', 'false');
          this.openDropdownById('adminMenu');

          const link = document.getElementById('menu-pagos') as HTMLAnchorElement | null;
          if (link) {
            const handler = () => {
              const pendingKey = this.buildScopedKey('tour:payments:pending', userKeyPart)!;
              localStorage.setItem(pendingKey, '1');
              link.removeEventListener('click', handler);
              // Destruye el overlay en el próximo tick
              setTimeout(() => {
                // @ts-ignore
                this.d.destroy?.();
                // fallback por si la versión usa reset()
                // @ts-ignore
                this.d.reset?.();
              }, 0);
            };
            link.addEventListener('click', handler, { once: true });
          }
        },
        onNextClick: () => {
          const pendingKey = this.buildScopedKey('tour:payments:pending', userKeyPart)!;
          localStorage.setItem(pendingKey, '1'); // marcar “pendiente”
          (document.getElementById('menu-pagos') as HTMLAnchorElement | null)?.click();
          return false; // detener este tour; el de la página se iniciará solo
        }
      }
    ];
    this.d.setConfig({ allowClose: false, showButtons: ['next', 'close'], animate: false, smoothScroll: false } as any);

    this.start(steps, { userKeyPart, allowClose: false, disablePrev: true, elevateModals: true });
  }

  // En TourService

  private waitForElements(selectors: string[], timeoutMs = 5000): Promise<boolean> {
    const end = Date.now() + timeoutMs;
    return new Promise(resolve => {
      const check = () => {
        const ready = selectors.every(s => !!document.querySelector(s));
        if (ready) return resolve(true);
        if (Date.now() > end) return resolve(false);
        setTimeout(check, 50);
      };
      check();
    });
  }


  // Avanza al siguiente paso del driver de forma segura
  private moveNextSafe() {
    try { (this.d as any).moveNext?.(); } catch { /* noop */ }
  }


  /** Paso 2: dentro de /formas-pago, bloquear hasta crear al menos un método */
  public async startPaymentPageEnforcedTour(userKeyPart?: string, empresaId?: number) {
    const hasOneKey = `mop:hasOne:${empresaId ?? ''}`;
    const pendingKey = this.buildScopedKey('tour:payments:pending', userKeyPart)!;

    // 👇 Espera a que el input, botón y tabla existan en DOM
    await this.waitForElements(['#mop-new-name', '#mop-add-btn', '#mop-table'], 5000);

    const waitForRow = () =>
      document.querySelectorAll('#mop-table tbody tr.mop-row').length > 0;

    const steps: TourStep[] = [
      {
        selector: '#mop-new-name',
        title: 'Escribe el nombre',
        description: 'Ej.: <b>EFECTIVO</b> o <b>TRANSFERENCIA</b>.',
        side: 'bottom', align: 'start'
      },
      {
        selector: '#mop-add-btn',
        title: 'Crea el método',
        description: 'Haz clic en <b>Agregar</b> para registrarlo.',
        side: 'left', align: 'center',
        onNextClick: () => {
          const btn = document.getElementById('mop-add-btn') as HTMLButtonElement | null;
          if (btn && !btn.disabled) btn.click();
          // Avanza al paso 3 (la verificación) y allí se bloqueará hasta que exista la fila
          setTimeout(() => this.moveNextSafe(), 0);
          return false; // controlamos el avance manualmente
        },
        onBefore: () => {
          const btn = document.getElementById('mop-add-btn') as HTMLButtonElement | null;
          const form = btn?.closest('form') as HTMLFormElement | null;

          const nextOnce = this.once(() => setTimeout(() => this.moveNextSafe(), 0));

          // Clic real en el botón
          btn?.addEventListener('click', nextOnce, { once: true });

          // Submit del form (Enter en el input)
          form?.addEventListener('submit', nextOnce, { once: true });

          // Por si la creación es asíncrona y llega el evento de éxito estando aún en este paso
          const createdHandler = () => nextOnce();
          window.addEventListener('mop:created', createdHandler, { once: true });
        }
      },
      {
        selector: '#mop-table',
        title: 'Verificación',
        description: 'Debes tener al menos un método en la tabla para finalizar.',
        side: 'top', align: 'center',
        onNextClick: () => {
          if (waitForRow() || localStorage.getItem(hasOneKey) === '1') {
            // permitir cerrar y limpiar “pendiente”
            // @ts-ignore
            this.d.setConfig({ allowClose: true, showButtons: ['next', 'previous', 'close'] });
            localStorage.removeItem(pendingKey);
            return; // permitir avanzar al final
          }
          // feedback visual
          const el = document.querySelector('#mop-table') as HTMLElement | null;
          el?.animate([{ outline: '3px solid rgba(220,53,69,.4)' }, { outline: '0' }], { duration: 600 });
          return false; // sigue bloqueado
        }
      }
    ];

    this.start(steps, {
      key: 'tour:pagos:enforced:v1',
      userKeyPart,
      allowClose: false,   // no se puede cerrar hasta cumplir
      elevateModals: true
    });
  }

  private flash(selector: string) {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (!el) return;
    el.animate([{ outline: '3px solid rgba(220,53,69,.4)' }, { outline: '0' }], { duration: 600 });
  }

  private getEmpresaIdFromDOM(): number | null {
    const el = document.querySelector('[data-empresa-id]') as HTMLElement | null;
    return el ? Number(el.getAttribute('data-empresa-id')) : null;
  }

  // 1) helper para bloquear autocierre del dropdown mientras corre el tour
  private setDropdownAutoClose(toggleId: string, value: 'false' | 'true' | 'outside' | 'inside' = 'false') {
    const t = document.getElementById(toggleId);
    if (t) t.setAttribute('data-bs-auto-close', value);
  }

}
