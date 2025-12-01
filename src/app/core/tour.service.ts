import { Injectable } from '@angular/core';
import { Router, NavigationStart } from '@angular/router';
import { ConfigService } from './config.service';
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
  typewriter?: boolean;       // si true, anima la descripción como máquina de escribir
  typewriterSpeedMsPerChar?: number; // velocidad opcional
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
  // Coach (robot) elements/state
  private coachWrap: HTMLElement | null = null;
  private coachTextEl: HTMLElement | null = null;
  private coachAnchorEl: HTMLElement | null = null;
  private coachIdx = 0;
  private coachSteps: Array<{ title: string; text: string }>|null = null;
  private coachCleanupBound: any = null;
  private coachTypeTimer: any = null;
  private coachSession = 0; // invalida esperas y estados en navegación

  constructor(private cfg: ConfigService, private router: Router) {
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

    // Teardown automático al cambiar de ruta para evitar que persista
    try {
      this.router.events.subscribe(ev => {
        if (ev instanceof NavigationStart) {
          this.coachSession++; // invalida sesiones en curso
          this.destroyCoach();
        }
      });
    } catch { /* no-op en tests */ }
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
    this.d.on?.('destroyed', () => { if (elevate) this.disableModalElevation(); this.stopTypewriter(); onFinish?.(); });
    // @ts-ignore
    this.d.on?.('reset', () => { if (elevate) this.disableModalElevation(); this.stopTypewriter(); onFinish?.(); });
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

    // Global kill-switch para tours
    const toursEnabled = !!this.cfg.get<boolean>('toursEnabled', true);
    if (!toursEnabled) return;

  const scopedKey = this.buildScopedKey(opts.key, opts.userKeyPart);
  // Control centralizado: si en config.json => "toursAlwaysRun": true, entonces ignora gating.
  const alwaysRun = !!this.cfg.get<boolean>('toursAlwaysRun', false);
  if (!alwaysRun && scopedKey && localStorage.getItem(scopedKey)) return;  // ya corrido para este usuario

    const elevate = opts.elevateModals !== false;
    if (elevate) this.enableModalElevation();

    // ⚠️ Mapeamos asegurando que onBefore sea "once" por paso
    const mapped = steps.map(s => {
      const onBeforeOnce = s.onBefore ? this.once(s.onBefore) : undefined;
      const sel = s.selector;
      return {
        element: sel,
        onHighlightStarted: () => {
          // Asegurar visibilidad bajo header fijo (especialmente en móvil)
          this.ensureVisibleElement(sel, 10);
          onBeforeOnce?.();
          // Máquinade escribir si aplica
          if (s.typewriter) {
            const txt = this.stripHtml(s.description || '');
            const spd = s.typewriterSpeedMsPerChar ?? 18;
            this.startTypewriter(txt, spd);
          } else {
            this.stopTypewriter();
          }
        },
        onNextClick: () => s.onNextClick?.(),
        popover: {
          title: s.title,
          // NBSP como placeholder para forzar que driver renderice el nodo de descripción
          description: s.typewriter ? '\u00A0' : s.description,
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

  if (!alwaysRun && scopedKey) localStorage.setItem(scopedKey, '1');
  }

  // Desplaza la página para que el elemento quede visible debajo del menú sticky
  private ensureVisibleElement(selector: string, padding = 8) {
    try {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const menuH = this.getMenuHeight();
      const topNeeded = rect.top - (menuH + padding);
      const bottomOverflow = rect.bottom - (window.innerHeight - padding);
      const prefersReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Si está tapado por el header o muy abajo, ajusta el scroll
      if (topNeeded < 0 || bottomOverflow > 0) {
        const currentY = window.scrollY || window.pageYOffset || 0;
        const targetY = currentY + topNeeded;
        window.scrollTo({ top: Math.max(0, targetY), behavior: prefersReduce ? 'auto' : 'smooth' });
      }
    } catch { /* noop */ }
  }

  private getMenuHeight(): number {
    try {
      const cssVar = getComputedStyle(document.documentElement).getPropertyValue('--menu-h');
      const fromVar = parseInt(cssVar || '', 10);
      if (!isNaN(fromVar) && fromVar > 0) return fromVar;
      const nav = document.querySelector('nav.sticky-top') as HTMLElement | null;
      return nav?.offsetHeight || 56;
    } catch {
      return 56;
    }
  }

  // ====== Animación de máquina de escribir para la descripción ======
  private typeTimer: any = null;
  private startTypewriter(text: string, speed = 18) {
    try { this.stopTypewriter(); } catch {}
    try {
      const startAt = Date.now();
      const tryStart = () => {
        const node = this.ensureTyperNode();
        if (node) { this.runTypewriter(node, text, speed); return true; }
        return Date.now() - startAt > 1500; // timeout
      };
      if (!tryStart()) {
        let tries = 0;
        const tick = () => {
          if (tryStart()) return;
          tries++;
          if (tries > 30) return; // ~1.5s a 50ms
          this.typeTimer = window.setTimeout(tick, 50);
        };
        tick();
      }
    } catch { /* noop */ }
  }
  private runTypewriter(node: HTMLElement, text: string, speed: number) {
    const full = text || '';
    let i = 0;
    node.textContent = '';
    const step = () => {
      if (i > full.length) { this.typeTimer = null; return; }
      node.textContent = full.slice(0, i);
      i++;
      this.typeTimer = window.setTimeout(step, speed);
    };
    step();
  }
  private stopTypewriter() {
    try {
      if (this.typeTimer) { clearTimeout(this.typeTimer); this.typeTimer = null; }
      const wrap = document.querySelector('.driver-popover') as HTMLElement | null;
      const custom = wrap?.querySelector('.dr-typer-desc') as HTMLElement | null;
      const builtin = wrap?.querySelector('.driver-popover-description') as HTMLElement | null;
      if (custom) custom.remove();
      if (builtin) builtin.style.removeProperty('display');
    } catch {}
  }
  private stripHtml(html: string): string {
    try { const tmp = document.createElement('div'); tmp.innerHTML = html; return tmp.textContent || tmp.innerText || ''; } catch { return html.replace(/<[^>]*>/g, ''); }
  }
  private ensureTyperNode(): HTMLElement | null {
    const wrap = document.querySelector('.driver-popover') as HTMLElement | null;
    if (!wrap) return null;
    // Oculta la descripción por defecto para que no parpadee
    const builtin = wrap.querySelector('.driver-popover-description') as HTMLElement | null;
    if (builtin) builtin.style.display = 'none';
    let node = wrap.querySelector('.dr-typer-desc') as HTMLElement | null;
    if (!node) {
      node = document.createElement('div');
      node.className = 'dr-typer-desc';
      node.style.marginTop = '6px';
      node.style.fontSize = '13px';
      node.style.lineHeight = '1.45';
      node.style.color = 'inherit';
      node.style.whiteSpace = 'pre-wrap';
      wrap.appendChild(node);
    }
    return node;
  }

  // ====== COACH: Burbuja con robot en lugar de modal ======
  private createCoachElements() {
    if (this.coachWrap) return;
    const wrap = document.createElement('div');
    wrap.className = 'dr-coach';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-live', 'polite');

    const bubble = document.createElement('div');
    bubble.className = 'dr-coach-bubble';

    const avatar = document.createElement('div');
    avatar.className = 'dr-coach-avatar';
    avatar.innerText = '🤖';

    const title = document.createElement('div');
    title.className = 'dr-coach-title';

    const text = document.createElement('div');
    text.className = 'dr-coach-text';

    const actions = document.createElement('div');
    actions.className = 'dr-coach-actions';

    const btnPrev = document.createElement('button');
    btnPrev.type = 'button';
    btnPrev.className = 'btn btn-light btn-xs dr-coach-prev';
    btnPrev.textContent = 'Atrás';

    const btnNext = document.createElement('button');
    btnNext.type = 'button';
    btnNext.className = 'btn btn-primary btn-xs dr-coach-next';
    btnNext.textContent = 'Siguiente';

    const btnClose = document.createElement('button');
    btnClose.type = 'button';
    btnClose.className = 'btn btn-outline-secondary btn-xs dr-coach-close';
    btnClose.textContent = 'Cerrar';

    actions.append(btnPrev, btnNext, btnClose);
    bubble.append(avatar, title, text, actions);
    wrap.append(bubble);
    document.body.appendChild(wrap);

    // Store refs
    this.coachWrap = wrap;
    this.coachTextEl = text;

    // Handlers
    btnPrev.addEventListener('click', () => this.coachPrev());
    btnNext.addEventListener('click', () => this.coachNext());
    btnClose.addEventListener('click', () => this.destroyCoach());
  }

  private positionCoach(anchor: HTMLElement) {
    if (!this.coachWrap) return;
    const rect = anchor.getBoundingClientRect();
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const pad = 8;
    const top = rect.bottom + scrollY + pad;
    let left = rect.left + scrollX;
    // Keep inside viewport margins
    const vw = document.documentElement.clientWidth;
    const maxLeft = Math.max(8, vw - 8 - 300); // assume max bubble width
    left = Math.min(Math.max(8, left), maxLeft);
    this.coachWrap.style.top = `${top}px`;
    this.coachWrap.style.left = `${left}px`;
  }

  private updateCoachStep() {
    if (!this.coachWrap || !this.coachSteps) return;
    const bubble = this.coachWrap.querySelector('.dr-coach-bubble') as HTMLElement | null;
    const titleEl = this.coachWrap.querySelector('.dr-coach-title') as HTMLElement | null;
    const prev = this.coachWrap.querySelector('.dr-coach-prev') as HTMLButtonElement | null;
    const next = this.coachWrap.querySelector('.dr-coach-next') as HTMLButtonElement | null;
    if (!bubble || !titleEl) return;
    const step = this.coachSteps[this.coachIdx];
    titleEl.textContent = step.title;
    // start typewriter into coach text
    this.startCoachTypewriter(step.text, 16);
    if (prev) prev.disabled = this.coachIdx === 0;
    if (next) next.textContent = this.coachIdx >= (this.coachSteps.length - 1) ? 'Entendido' : 'Siguiente';
  }

  private coachPrev() {
    if (!this.coachSteps) return;
    if (this.coachIdx > 0) {
      this.coachIdx--;
      this.updateCoachStep();
    }
  }
  private coachNext() {
    if (!this.coachSteps) return;
    if (this.coachIdx < this.coachSteps.length - 1) {
      this.coachIdx++;
      this.updateCoachStep();
    } else {
      this.destroyCoach();
    }
  }

  private destroyCoach() {
    try { window.removeEventListener('scroll', this.coachCleanupBound, true); } catch {}
    try { window.removeEventListener('resize', this.coachCleanupBound, true); } catch {}
    try { if (this.coachAnchorEl) this.coachAnchorEl.classList.remove('dr-coach-highlight'); } catch {}
    try { this.stopCoachTypewriter(); } catch {}
    try { this.coachWrap?.remove(); } catch {}
    this.coachWrap = null;
    this.coachTextEl = null;
    this.coachAnchorEl = null;
    this.coachSteps = null;
    this.coachIdx = 0;
  }

  private startCoachTypewriter(text: string, speed = 16) {
    this.stopCoachTypewriter();
    const node = this.coachTextEl;
    if (!node) return;
    const full = text || '';
    let i = 0;
    node.textContent = '';
    const stepFn = () => {
      if (!this.coachTextEl) { this.coachTypeTimer = null; return; }
      if (i > full.length) { this.coachTypeTimer = null; return; }
      this.coachTextEl.textContent = full.slice(0, i);
      i++;
      this.coachTypeTimer = window.setTimeout(stepFn, speed);
    };
    this.coachTypeTimer = window.setTimeout(stepFn, 40);
  }
  private stopCoachTypewriter() {
    try { if (this.coachTypeTimer) { clearTimeout(this.coachTypeTimer); this.coachTypeTimer = null; } } catch {}
  }

  /**
   * Muestra el coach de gestos de swipe en listas móviles.
   * @param userKeyPart parte de clave por usuario
   * @param force si true ignora localStorage y gating para depurar
   */
  async startMobileSwipeCoach(userKeyPart?: string, force = false) {
    // Config master switch
    const enabled = !!this.cfg.get<boolean>('swipeCoachEnabled', true);
    if (!enabled && !force) { console.debug('[coach] disabled by config'); return; }
    // Usa el mismo breakpoint que las vistas (md hidden => <768px)
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    const alwaysRun = !!this.cfg.get<boolean>('toursAlwaysRun', false);
    if (!isMobile && !force && !alwaysRun) { console.debug('[coach] early-return: not mobile'); return; }

    // Gateo por página: solo en listas donde existe swipe (clientes, usuarios, pacientes, trabajos)
    const body = document?.body;
    const allowedPages = ['page-clientes', 'page-usuarios', 'page-pacientes', 'page-trabajos'];
  const onAllowedPage = !!body && allowedPages.some(cls => body.classList.contains(cls));
  if (!onAllowedPage && !force) { console.debug('[coach] early-return: not on allowed page'); return; }

  const key = this.buildScopedKey('coach:swipe:v1', userKeyPart);
  if (!force && !alwaysRun && key && localStorage.getItem(key)) { console.debug('[coach] early-return: localStorage gated'); return; }

    // Espera primer item swipeable (poll + MutationObserver)
    const mySession = ++this.coachSession;
    let dummyAnchor: HTMLElement | null = null; // se crea si lista vacía
    const first = await new Promise<HTMLElement | null>(resolve => {
      const deadline = Date.now() + 12000;
      const check = () => document.querySelector('.dr-wa-item') as HTMLElement | null;
      const found = check();
      if (found) return resolve(found);
      const obs = new MutationObserver(() => {
        const n = check();
        if (n) { try { obs.disconnect(); } catch {} resolve(n); }
      });
      try { obs.observe(document.body, { childList: true, subtree: true }); } catch {}
      const timer = window.setInterval(() => {
        const n = check();
        if (n) { clearInterval(timer); try { obs.disconnect(); } catch {} resolve(n); }
        else if (Date.now() > deadline) { clearInterval(timer); try { obs.disconnect(); } catch {} resolve(null); }
      }, 150);
    });
    // Si cambió la sesión (navegaste) abortar
  if (mySession !== this.coachSession) { console.debug('[coach] abort: session changed'); return; }

    let anchor = first;

    // Si no hay item pero estamos en modo force o alwaysRun, crear dummy para demo
    if (!anchor && (force || alwaysRun)) {
      const listHost = document.querySelector('.md\:hidden') || document.body; // intenta usar contenedor móvil
      dummyAnchor = document.createElement('div');
      dummyAnchor.className = 'dr-wa-item dr-wa-item-dummy';
      dummyAnchor.style.cssText = 'margin:12px;border:1px dashed #94a3b8;border-radius:16px;padding:20px;text-align:center;font-size:13px;color:#64748b;background:#f1f5f9;';
      dummyAnchor.innerHTML = '<div style="opacity:.8">(Demo) Desliza aquí para ver acciones</div>';
      listHost.appendChild(dummyAnchor);
      anchor = dummyAnchor;
    }

  if (!anchor) { console.debug('[coach] abort: no anchor found'); return; }

    // Verifica nuevamente la página por si cambió el body class tras render
  if (!allowedPages.some(cls => document.body.classList.contains(cls)) && !force) { console.debug('[coach] abort: page changed/not allowed'); return; }

    this.coachAnchorEl = anchor;
    this.coachAnchorEl.classList.add('dr-coach-highlight');
    this.createCoachElements();
    this.coachSteps = [
      { title: 'Eliminar con swipe', text: 'Desliza este elemento hacia la izquierda. Verás fondo rojo y, al pasar el 60%, aparece un check de confirmación. Suelta para eliminar con opción de Deshacer.' },
      { title: 'Editar con swipe', text: 'También puedes deslizar hacia la derecha para editar. El fondo azul y el check confirman la acción al pasar el umbral.' }
    ];
    this.coachIdx = 0;
    this.updateCoachStep();
    this.positionCoach(this.coachAnchorEl);

    // Reposicionar en scroll/resize
    this.coachCleanupBound = () => {
      if (this.coachAnchorEl) this.positionCoach(this.coachAnchorEl);
    };
    window.addEventListener('scroll', this.coachCleanupBound, true);
    window.addEventListener('resize', this.coachCleanupBound, true);

    if (!force && !alwaysRun && key) localStorage.setItem(key, '1');

    // Limpieza extra para dummy
    if (dummyAnchor) {
      const origDestroy = this.destroyCoach.bind(this);
      this.destroyCoach = () => {
        try { dummyAnchor?.remove(); } catch {}
        // restaurar método y ejecutar
        this.destroyCoach = origDestroy;
        origDestroy();
      };
    }
  }

  // ====== Tour de Módulos (atajo) ======
  startModulesTour(role?: string, sector?: string, userKeyPart?: string, onFinish?: () => void) {
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    const steps: TourStep[] = [];
    // En móvil podemos querer enfocar el título del módulo si está disponible, pero aquí son cards.
    steps.push({ selector: '#mod-clientes', title: 'Clientes', description: 'Gestiona la información de tus clientes, contactos y datos asociados.', side: isMobile ? 'bottom' : 'bottom', align: isMobile ? 'center' : 'center' });
    steps.push({ selector: '#mod-trabajos', title: 'Trabajos', description: 'Crea y administra trabajos, tareas y estados de ejecución.', side: isMobile ? 'bottom' : 'bottom' });
    steps.push({ selector: '#mod-reportes', title: 'Reportes', description: 'Explora métricas y estadísticas para tomar mejores decisiones.', side: isMobile ? 'bottom' : 'bottom' });
    if ((sector ?? '').toUpperCase() === 'SALUD' && document.getElementById('mod-pacientes')) {
      steps.push({ selector: '#mod-pacientes', title: 'Pacientes', description: 'Gestiona pacientes, historiales clínicos, citas y seguimiento.' });
    }
    this.start(steps, { key: 'tour:modulos:v2', userKeyPart, onFinish, allowClose: true });
  }

  // ====== Nudge: abrir dropdown Admin y señalar Formas de pago ======
  startPaymentNudge(role?: string, userKeyPart?: string) {
    if ((role ?? '').toUpperCase() !== 'ADMIN') return;
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    const selector = isMobile ? '#mob-pagos' : '#menu-pagos';
    const steps: TourStep[] = [{
      selector,
      title: 'Formas de pago',
      description: 'Configura y administra los métodos de pago aceptados por tu empresa.',
      side: isMobile ? 'bottom' : 'right', align: isMobile ? 'center' : 'start',
      onBefore: () => { if (!isMobile) this.openAdminAngular(); }
    }];
    this.start(steps, { key: 'tour:nudge:pagos:v2', userKeyPart, elevateModals: true, allowClose: true });
  }

  // ========== ENFORCED para ADMIN ==========
  /** Paso 1: en el menú, fuerza ir a Formas de pago */
  startAdminPaymentEnforcedTour(role?: string, userKeyPart?: string) {
    // Eliminado: ya no se fuerza creación de formas de pago
    return;
  }

  // Método antiguo de flujo forzado en página de pagos eliminado (mantener comentario para referencia histórica).

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

  // ==== Nueva helper para abrir el dropdown Admin controlado por Angular ==== 
  private openAdminAngular() {
    const btn = document.getElementById('adminMenu') as HTMLButtonElement | null;
    if (!btn) return;
    // Si aria-expanded != true, disparamos click
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    if (!expanded) {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  }

  // ==== Tour introductorio para todas las opciones Admin (no forzado) ====
  startAdminIntroTour(role?: string, userKeyPart?: string, onFinish?: () => void) {
    if ((role ?? '').toUpperCase() !== 'ADMIN') return;
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    const steps: TourStep[] = [
      !isMobile ? { selector: '#adminMenu', title: 'Panel Admin', description: 'Accede a funciones avanzadas de gestión.', side: 'bottom', align: 'start', onBefore: () => this.openAdminAngular() } : { selector: '#mob-usuarios', title: 'Usuarios', description: 'Administra cuentas y permisos internos.', side: 'bottom', align: 'center' },
      { selector: isMobile ? '#mob-usuarios' : '#menu-usuarios', title: 'Usuarios', description: 'Administra cuentas y permisos internos.', side: isMobile ? 'bottom' : 'right', align: isMobile ? 'center' : 'start', onBefore: () => { if (!isMobile) this.openAdminAngular(); } },
      { selector: isMobile ? '#mob-pagos' : '#menu-pagos', title: 'Formas de pago', description: 'Configura métodos de pago aceptados.', side: isMobile ? 'bottom' : 'right', align: isMobile ? 'center' : 'start', onBefore: () => { if (!isMobile) this.openAdminAngular(); } },
      { selector: isMobile ? '#mob-grupos' : '#menu-grupos', title: 'Grupos', description: 'Organiza usuarios o clientes en grupos.', side: isMobile ? 'bottom' : 'right', align: isMobile ? 'center' : 'start', onBefore: () => { if (!isMobile) this.openAdminAngular(); } },
      { selector: isMobile ? '#mob-configuracion' : '#menu-configuracion', title: 'Configuración', description: 'Ajusta parámetros generales.', side: isMobile ? 'bottom' : 'right', align: isMobile ? 'center' : 'start', onBefore: () => { if (!isMobile) this.openAdminAngular(); } }
    ];
    this.start(steps, { key: 'tour:admin:intro:v1', userKeyPart, allowClose: true, onFinish });
  }

  // ==== Tutorial de gestos swipe en listas móviles ====
  async startMobileSwipeTour(userKeyPart?: string) {
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    if (!isMobile) return; // solo móvil
  // Modo pruebas: no gateamos por clave

    // Esperar a que exista un item swipeable (por carga asíncrona)
    const first = await new Promise<HTMLElement | null>(resolve => {
      const end = Date.now() + 5000;
      const tick = () => {
        const el = document.querySelector('.dr-wa-item') as HTMLElement | null;
        if (el) return resolve(el);
        if (Date.now() > end) return resolve(null);
        setTimeout(tick, 100);
      };
      tick();
    });
    if (!first) return;
    // Asignar id temporal estable para el tour
    const idWas = first.id;
    if (!idWas) first.id = 'swipe-demo-item';
    const selector = '#' + first.id;

    const steps: TourStep[] = [
      {
        selector,
        title: 'Eliminar con swipe',
        description: 'Desliza este elemento hacia la izquierda. Verás fondo rojo y, al pasar el 60%, aparece un check de confirmación. Suelta para eliminar con opción de Deshacer.',
        side: 'bottom', align: 'center', typewriter: true, typewriterSpeedMsPerChar: 14
      },
      {
        selector,
        title: 'Editar con swipe',
        description: 'También puedes deslizar hacia la derecha para editar. El fondo azul y el check confirman la acción al pasar el umbral.',
        side: 'bottom', align: 'center', typewriter: true, typewriterSpeedMsPerChar: 14
      }
    ];

    this.start(steps, {
      key: 'tour:swipe:v1',
      userKeyPart,
      allowClose: true,
      onFinish: () => {
        // Restaurar id si era vacío
        if (!idWas) first.removeAttribute('id');
      }
    });
  }

}
