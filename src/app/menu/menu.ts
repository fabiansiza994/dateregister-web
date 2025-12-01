import { Component, computed, signal, ElementRef, ViewChild, HostListener, AfterViewInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { PlanesService } from '../suscripcion/planes.service';
import { ReportesActionsService } from '../reportes-component/reportes-actions.service';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './menu.html',
  styleUrls: ['./menu.css']
})
export class Menu implements AfterViewInit {
  // Template refs para detectar clic fuera
  @ViewChild('adminDropdown', { static: false }) adminRef?: ElementRef<HTMLElement>;
  @ViewChild('userDropdown', { static: false }) userRef?: ElementRef<HTMLElement>;
  private readonly _claims = signal<any | null>(null);

  empresa = computed(() => this._claims()?.empresa ?? 'DataRegister');
  sector  = computed(() => (this._claims()?.sector ?? '').toUpperCase());
  role    = computed(() => (this._claims()?.role ?? '').toUpperCase());
  user    = computed(() => this._claims()?.sub ?? this._claims()?.usuario ?? 'Usuario');

  // nombre amigable para avatar / dropdown
  userName = computed(() => {
    const n = this._claims()?.nombre;
    const a = this._claims()?.apellido;
    if (n || a) return [n, a].filter(Boolean).join(' ');
    return String(this.user());
  });

  // Estados UI
  mobileOpen = signal(false);
  adminOpen  = signal(false);
  userOpen   = signal(false);
  canInstall = signal(false);
  private deferredPrompt: any = null;
  // iOS A2HS tip (Safari no soporta beforeinstallprompt)
  isIOS = signal(false);
  isStandalone = signal(false);
  showIOSTip = signal(false);

  toggleMobile() { this.mobileOpen.update(v => !v); }
  toggleAdmin()  {
    const next = !this.adminOpen();
    // Exclusividad: cerrar el otro dropdown
    this.userOpen.set(false);
    this.adminOpen.set(next);
  }
  toggleUser()   {
    const next = !this.userOpen();
    // Exclusividad: cerrar el otro dropdown
    this.adminOpen.set(false);
    this.userOpen.set(next);
  }

  closeAll() {
    this.mobileOpen.set(false);
    this.adminOpen.set(false);
    this.userOpen.set(false);
  }

  // Plan actual (suscripción)
  planName = computed(() => {
    const plan = this.planes.current();
    return plan?.name || 'Free';
  });

  constructor(private router: Router, private auth: AuthService, private planes: PlanesService, private host: ElementRef<HTMLElement>, private reportesActions: ReportesActionsService) {
    this.auth.refreshFromStorage();
    this._claims.set(this.auth.claims());

    // Cargar planes al inicializar
    this.planes.loadPlans().catch(() => {
      // Error silencioso, se usarán planes fallback
    });

    // Captura del evento para ofrecer instalación (PWA Add to Home Screen)
    window.addEventListener('beforeinstallprompt', (e: any) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.canInstall.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.canInstall.set(false);
      this.deferredPrompt = null;
      this.showIOSTip.set(false);
    });

    // Detectar iOS (incluye iPadOS) y modo standalone
    try {
      const ua = navigator.userAgent || (navigator as any).vendor || '';
      const isIOSDevice = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
      const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (navigator as any).standalone === true;
      this.isIOS.set(!!isIOSDevice);
      this.isStandalone.set(!!isStandalone);

      // Mostrar tip en iOS Safari si no está instalada y no fue ocultado recientemente
      const dismissedAt = Number(localStorage.getItem('iosInstallTipDismissed') || '0');
      const recentlyDismissed = Date.now() - dismissedAt < 14 * 24 * 60 * 60 * 1000; // 14 días
      if (isIOSDevice && !isStandalone && !recentlyDismissed) {
        this.showIOSTip.set(true);
      }
    } catch {}

    // Detectar módulo actual para mostrar acción Crear en móvil
    const setModuleFromUrl = (url: string) => {
      try {
        const path = (url || '').split('?')[0].split('#')[0];
        const seg = path.split('/').filter(Boolean)[0] || '';
        this.currentModule.set(seg.toLowerCase());
      } catch { this.currentModule.set(''); }
    };
    setModuleFromUrl(this.router.url || '');
    this.router.events.subscribe(ev => { if (ev instanceof NavigationEnd) setModuleFromUrl((ev as NavigationEnd).urlAfterRedirects || (ev as any).url || ''); });
  }

  logout() {
    localStorage.removeItem('token');
    this.router.navigate(['/login']);
    this.closeAll();
  }

  async installPWA() {
    if (!this.deferredPrompt) return;
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      this.canInstall.set(false);
      this.deferredPrompt = null;
    }
  }

  dismissIOSTip() {
    this.showIOSTip.set(false);
    try { localStorage.setItem('iosInstallTipDismissed', String(Date.now())); } catch {}
  }

  // Cerrar dropdowns al hacer clic fuera
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as Node | null;
    if (!target) return;

    // Si el clic fue en el propio botón de toggle, no cerrar aquí (lo maneja toggleX)
    if (target instanceof Element && target.closest('[data-dd-toggle]')) {
      return;
    }

    if (this.adminOpen() && this.adminRef && !this.adminRef.nativeElement.contains(target)) {
      this.adminOpen.set(false);
    }
    if (this.userOpen() && this.userRef && !this.userRef.nativeElement.contains(target)) {
      this.userOpen.set(false);
    }
  }

  // Cerrar con Escape
  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.adminOpen() || this.userOpen()) {
      this.adminOpen.set(false);
      this.userOpen.set(false);
    }
  }

  initials(text?: string): string {
    const t = (text || '').trim();
    if (!t) return 'DR';
    const parts = t.split(/\s+/).slice(0, 2);
    return parts.map(p => p[0]?.toUpperCase() ?? '').join('') || 'DR';
  }

  // Divide el nombre de empresa en dos líneas para móvil
  private splitCompanyName(name: string): { l1: string; l2: string } {
    const trimmed = (name || '').trim();
    if (!trimmed) return { l1: 'DataRegister', l2: '' };
    // Si es corto, todo en la primera línea
    if (trimmed.length <= 18) return { l1: trimmed, l2: '' };

    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length === 1) {
      // sin espacios: corta por caracteres
      const cut = Math.min(16, Math.max(10, Math.floor(trimmed.length / 2)));
      return { l1: trimmed.slice(0, cut), l2: trimmed.slice(cut) };
    }

    // Greedy: llena l1 hasta ~18–22 chars sin cortar palabras
    const targetMin = 18, targetMax = 22;
    let l1 = '';
    let i = 0;
    while (i < words.length) {
      const candidate = (l1 ? l1 + ' ' : '') + words[i];
      if (candidate.length > targetMax && l1.length >= targetMin) break;
      l1 = candidate;
      i++;
    }
    const l2 = words.slice(i).join(' ');
    return { l1: l1.trim(), l2: l2.trim() };
  }

  brandLines = computed(() => this.splitCompanyName(this.empresa() ?? ''));

  // ===== Crear acción condicional (móvil): botón + según módulo =====
  private currentModule = signal<string>('');
  private readonly actionModules = new Set<string>(['trabajos', 'clientes', 'pacientes', 'usuarios']);
  showCreateAction = computed(() => this.actionModules.has((this.currentModule() || '').toLowerCase()));
  createLink = computed(() => {
    const m = (this.currentModule() || '').toLowerCase();
    if (m === 'trabajos') return '/trabajos/nuevo';
    if (m === 'clientes') return '/clientes/nuevo';
    if (m === 'pacientes') return '/pacientes/nuevo';
    if (m === 'usuarios') return '/usuarios/nuevo';
    return '/';
  });

  // Acción Excel en Reportes (móvil)
  showExcelAction = computed(() => (this.currentModule() || '').toLowerCase() === 'reportes');
  triggerReportDownload() {
    this.reportesActions.triggerDownload();
    // cerrar menús si alguno abierto
    this.closeAll();
  }

  // Título centrado del módulo actual (móvil)
  moduleTitle = computed(() => {
    const m = (this.currentModule() || '').toLowerCase();
    if (!m) return 'INICIO';
    // Mapear algunos módulos a títulos legibles
    const map: Record<string, string> = {
      'clientes': 'CLIENTES',
      'pacientes': 'PACIENTES',
      'trabajos': 'TRABAJOS',
      'reportes': 'REPORTES',
      'usuarios': 'USUARIOS',
      'formas-pago': 'FORMAS DE PAGO',
      'grupos': 'GRUPOS',
      'configuracion': 'CONFIGURACIÓN',
      'perfil': 'MI PERFIL',
      'suscripcion': 'SUSCRIPCIÓN'
    };
    return map[m] || m.toUpperCase();
  });

  // Efecto para recalcular altura y bloquear scroll del body cuando el menú móvil se abre
  // Debe crearse en contexto de inyección (campo/constructor), no en hooks del ciclo de vida
  private readonly _heightEffect = effect(() => {
    // Dependencias que pueden cambiar la altura
    this.showIOSTip();
    const isOpen = this.mobileOpen();
    // Pequeño defer para permitir el reflow
    setTimeout(() => this.updateMenuHeight(), 50);

    // Bloquear scroll del body cuando el menú móvil está abierto
    try {
      document.body.style.overflow = isOpen ? 'hidden' : '';
    } catch { /* noop */ }
  });

  // ===== Altura dinámica del menú para sticky de filtros =====
  ngAfterViewInit(): void {
    // Actualizar inmediatamente y al redimensionar
    this.updateMenuHeight();
    setTimeout(() => this.updateMenuHeight(), 0);
    window.addEventListener('resize', this._onResize);
  }

  private _onResize = () => this.updateMenuHeight();

  private updateMenuHeight() {
    try {
      const nav: HTMLElement | null = this.host?.nativeElement?.querySelector('nav');
      const h = (nav?.offsetHeight || 56);
      document.documentElement.style.setProperty('--menu-h', `${h}px`);
    } catch { /* noop */ }
  }
}
