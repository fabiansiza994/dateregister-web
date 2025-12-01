import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { ConfigService } from '../core/config.service';

interface Cliente {
  id: number;
  identificacion: string;
  nombre: string;
  apellido: string;
  email?: string;
  direccion?: string;
  telefono?: string;
  estado: string; // 'ACTIVO' | 'INACTIVO'
  razonSocial?: string;
  rut?: string | null; // URL o null
  camaraComercio?: string | null; // URL o null
}

@Component({
  selector: 'app-cliente-editar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cliente-editar.html',
  styleUrls: ['./cliente-editar.css']
})
export class ClienteEditarComponent implements OnInit {

  // estado con signals
  loading = signal(false);
  error = signal<string | null>(null); // error global
  fieldErrors = signal<Record<string, string>>({}); // errores por campo
  cliente = signal<Cliente | null>(null);
  // archivos nuevos seleccionados
  rutFile = signal<File | null>(null);
  camaraFile = signal<File | null>(null);
  // flags de eliminación / reemplazo
  removeRut = signal(false);
  removeCamara = signal(false);
  // progreso de subida (0..100)
  uploadPct = signal(0);
  // progreso por archivo individual (solo si se envía)
  rutPct = signal(0);
  camaraPct = signal(0);
  // Modal PDF preview (para archivos existentes antes de reemplazar)
  pdfModalOpen = signal(false);
  pdfModalUrl = signal<string | null>(null);
  pdfModalTitle = signal<string>('Documento');

  private apiBase = '';
  private _initialSnapshot: string | null = null;

  // validación mínima para habilitar guardar
  formOk = computed(() => {
    const c = this.cliente();
    return !!c && !!c.identificacion?.trim() && !!c.nombre?.trim();
  });

  constructor(
    private http: HttpClient,
    private cfg: ConfigService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.apiBase = this.cfg.get<string>('apiBaseUrl', '');
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) this.loadCliente(id);
  }

  async loadCliente(id: number) {
    this.loading.set(true);
    this.error.set(null);
    this.fieldErrors.set({});
    try {
      const url = `${this.apiBase}/client/detail/${id}`;
      const res = await firstValueFrom(
        this.http.get<{ data: Cliente }>(url).pipe(timeout(10000))
      );
      this.cliente.set(res?.data ?? null);
      if (!res?.data) this.error.set('No se encontró el cliente.');
      // snapshot para detección de cambios
      if (res?.data) this._initialSnapshot = JSON.stringify(res.data);
    } catch (e: any) {
      if (e instanceof TimeoutError) this.error.set('La consulta tardó demasiado. Intenta de nuevo.');
      else this.error.set(e?.error?.message || e?.message || 'Error al cargar cliente');
    } finally {
      this.loading.set(false);
    }
  }

  // Actualizar un campo y limpiar el error de ese campo
  onField<K extends keyof Cliente>(key: K, value: Cliente[K]) {
    this.cliente.update(c => c ? ({ ...c, [key]: value }) as Cliente : c);
    const fe = { ...this.fieldErrors() };
    delete fe[String(key)];
    this.fieldErrors.set(fe);
  }

  async actualizar() {
    const c = this.cliente();
    if (!c) return;

    this.loading.set(true);
    this.error.set(null);
    this.fieldErrors.set({});
    this.uploadPct.set(0);
    this.rutPct.set(0);
    this.camaraPct.set(0);

    try {
      const url = `${this.apiBase}/client/update/${c.id}`;

      // Semántica:
      // - Si se selecciona archivo nuevo => propiedad JSON se envía null + archivo en FormData
      // - Si se marca eliminar sin archivo => propiedad JSON null y sin archivo
      // - Si se mantiene => se envía valor original (URL/string)
      const jsonPayload = {
        identificacion: c.identificacion?.trim(),
        nombre: c.nombre?.trim(),
        apellido: (c.apellido ?? '').trim(),
        email: (c.email ?? '').trim(),
        direccion: (c.direccion ?? '').trim(),
        telefono: (c.telefono ?? '').trim(),
        estado: c.estado,
        razonSocial: (c.razonSocial ?? '').trim() || null,
        rut: (this.removeRut() || this.rutFile()) ? null : (c.rut ?? null),
        camaraComercio: (this.removeCamara() || this.camaraFile()) ? null : (c.camaraComercio ?? null)
      };

      // Preparar tamaños para cálculo de progreso por archivo (aproximado).
      const jsonStr = JSON.stringify(jsonPayload);
      const jsonBlob = new Blob([jsonStr], { type: 'application/json' });
      const jsonSize = jsonBlob.size;
      const rutSize = this.rutFile() ? this.rutFile()!.size : 0;
      const camaraSize = this.camaraFile() ? this.camaraFile()!.size : 0;

      const fd = new FormData();
      fd.append('cliente', jsonBlob);
      if (this.rutFile()) fd.append('rut', this.rutFile()!, this.rutFile()!.name);
      if (this.camaraFile()) fd.append('camaraComercio', this.camaraFile()!, this.camaraFile()!.name);

      const body = await new Promise<any>((resolve, reject) => {
        this.http.request<any>('PUT', url, {
          body: fd,
          reportProgress: true,
          observe: 'events'
        }).pipe(timeout(30000)).subscribe({
          next: ev => {
            // 1 = UploadProgress, 4 = Response
            if ((ev as any).type === 1) {
              const e = ev as any;
              if (typeof e.total === 'number' && e.total > 0) {
                const loaded = e.loaded;
                const pct = Math.min(100, Math.round((loaded * 100) / e.total));
                this.uploadPct.set(pct);
                // Progreso por archivo (orden: JSON, rut, camara). Ignora cabeceras multipart.
                if (rutSize > 0) {
                  const rutLoaded = Math.max(0, loaded - jsonSize);
                  const rutPct = Math.min(100, Math.max(0, Math.round((rutLoaded * 100) / rutSize)));
                  this.rutPct.set(rutPct);
                }
                if (camaraSize > 0) {
                  const camaraLoaded = Math.max(0, loaded - jsonSize - rutSize);
                  const camaraPct = Math.min(100, Math.max(0, Math.round((camaraLoaded * 100) / camaraSize)));
                  this.camaraPct.set(camaraPct);
                }
              } else {
                // Indeterminado: avanzar barras de forma suave.
                const curr = this.uploadPct();
                this.uploadPct.set(Math.min(95, curr + 5));
                if (rutSize > 0 && this.rutPct() < 95) this.rutPct.set(Math.min(95, this.rutPct() + 5));
                if (camaraSize > 0 && this.camaraPct() < 95) this.camaraPct.set(Math.min(95, this.camaraPct() + 5));
              }
            } else if ((ev as any).type === 4) {
              // asegurar barras al 100%
              if (rutSize > 0) this.rutPct.set(100);
              if (camaraSize > 0) this.camaraPct.set(100);
              this.uploadPct.set(100);
              resolve((ev as any).body);
            }
          },
          error: err => reject(err),
          complete: () => {}
        });
      });

      if (body?.dataResponse?.response === 'ERROR') {
        const arr = body?.error ?? [];
        if (arr.length > 0) {
          const map: Record<string, string> = {};
          arr.forEach((it: any) => {
            const field = (it?.msgError ?? '').trim() || 'global';
            const msg   = (it?.descError ?? 'Error').trim();
            if (field === 'global') this.error.set(msg); else map[field] = msg;
          });
          this.fieldErrors.set(map);
          return; // detener
        }
        throw new Error(body?.message || 'Actualización rechazada');
      }

      // éxito
      this.router.navigate(['/clientes'], { state: { flash: '✅ Cliente actualizado.' } });

    } catch (e: any) {
      if (e instanceof TimeoutError) this.error.set('La actualización tardó demasiado. Intenta de nuevo.');
      else this.error.set(e?.descError || e?.error?.descError || e?.message || 'No se pudo actualizar el cliente');
    } finally {
      this.loading.set(false);
      setTimeout(() => {
        this.uploadPct.set(0);
        this.rutPct.set(0);
        this.camaraPct.set(0);
      }, 1200);
    }
  }

  toggleEstado(ev: Event) {
    const checked = (ev.target as HTMLInputElement).checked;
    this.cliente.update(c => c ? { ...c, estado: checked ? 'ACTIVO' : 'INACTIVO' } as Cliente : c);
    // limpiar posible error de estado si lo hubiera en el futuro
    const fe = { ...this.fieldErrors() };
    delete fe['estado'];
    this.fieldErrors.set(fe);
  }

  // Selección de PDFs
  onPickRut(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { this.error.set('El archivo RUT debe ser PDF'); return; }
    this.rutFile.set(file);
    this.removeRut.set(false);
  }
  onPickCamara(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { this.error.set('El archivo Cámara de Comercio debe ser PDF'); return; }
    this.camaraFile.set(file);
    this.removeCamara.set(false);
  }
  clearRut() { this.rutFile.set(null); this.removeRut.set(true); }
  clearCamara() { this.camaraFile.set(null); this.removeCamara.set(true); }
  keepRut() { this.removeRut.set(false); this.rutFile.set(null); }
  keepCamara() { this.removeCamara.set(false); this.camaraFile.set(null); }
  openPdf(url: string | null, title: string) { if (!url) return; this.pdfModalTitle.set(title); this.pdfModalUrl.set(url); this.pdfModalOpen.set(true); }
  closePdf() { if (!this.loading()) { this.pdfModalOpen.set(false); this.pdfModalUrl.set(null); } }

  // Drag & drop helpers
  rutDragOver = signal(false);
  camaraDragOver = signal(false);
  onRutDrag(e: DragEvent) { e.preventDefault(); this.rutDragOver.set(true); }
  onRutLeave(e: DragEvent) { e.preventDefault(); this.rutDragOver.set(false); }
  onRutDrop(e: DragEvent) {
    e.preventDefault();
    this.rutDragOver.set(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { this.error.set('El archivo RUT debe ser PDF'); return; }
    this.rutFile.set(file); this.removeRut.set(false);
  }
  onCamaraDrag(e: DragEvent) { e.preventDefault(); this.camaraDragOver.set(true); }
  onCamaraLeave(e: DragEvent) { e.preventDefault(); this.camaraDragOver.set(false); }
  onCamaraDrop(e: DragEvent) {
    e.preventDefault();
    this.camaraDragOver.set(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { this.error.set('El archivo Cámara de Comercio debe ser PDF'); return; }
    this.camaraFile.set(file); this.removeCamara.set(false);
  }

  volver() { this.router.navigate(['/clientes']); }

  // Confirmación de cancelación si hay cambios
  cancelConfirmOpen = signal(false);
  cancel() {
    if (this.hasChanges()) {
      this.cancelConfirmOpen.set(true);
    } else {
      this.volver();
    }
  }
  closeCancelConfirm() { if (!this.loading()) this.cancelConfirmOpen.set(false); }
  proceedCancel() { this.volver(); }

  private hasChanges(): boolean {
    try {
      if (!this._initialSnapshot) return false;
      const baseChanged = this._initialSnapshot !== JSON.stringify(this.cliente());
      const fileChanged = !!(this.rutFile() || this.camaraFile() || this.removeRut() || this.removeCamara());
      return baseChanged || fileChanged;
    } catch { return true; }
  }
}
