import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgModel } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';

import { ConfigService } from '../core/config.service';
import { AuthService } from '../core/auth.service'; // para obtener claims (empresaId, userId)
import { ClientCreateRequest, ClientCreateOk, ClientCreateError } from '../interfaces/cliente-create.interface';

@Component({
    selector: 'app-cliente-nuevo',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './cliente-nuevo.html',
    styleUrls: ['./cliente-nuevo.css']
})
export class ClienteNuevoComponent implements OnInit {

    onField<K extends keyof ClientCreateRequest>(key: K, value: ClientCreateRequest[K]) {
        this.model.update(m => ({ ...m, [key]: value }));
        this.clearFieldError(key as string);
    }

    // (si algún día quieres cambiar empresa/usuario por UI; ahora son solo lectura)
    onEmpresaId(value: number | string) {
        const id = Number(value) || 0;
        this.model.update(m => ({ ...m, empresa: { ...m.empresa, id } }));
    }
    onUsuarioId(value: number | string) {
        const id = Number(value) || 0;
        this.model.update(m => ({ ...m, usuario: { ...m.usuario, id } }));
    }

    // Modelo del formulario
    model = signal<ClientCreateRequest>({
        nombre: '',
        apellido: '',
        email: '',
        direccion: '',
        telefono: '',
        identificacion: '',
        razonSocial: '',
        empresa: { id: 0 },   // se setea en ngOnInit con claims
        usuario: { id: 0 },   // se setea en ngOnInit con claims
        pacientes: []
    });

    // Estado UI
    loading = signal(false);
    errorGlobal = signal<string | null>(null);
    uploadPct = signal<number | null>(null); // progreso global de envío
    // progreso individual por archivo (solo si se adjuntan)
    rutPct = signal<number>(0);
    camaraPct = signal<number>(0);

    // Errores por campo (mapeados desde backend)
    fieldErrors = signal<Record<string, string>>({});

    // Validación mínima en cliente
    isValid = computed(() => !!this.model().nombre.trim());

    private apiBase = '';
    private _initialSnapshot = '';

    constructor(
        private http: HttpClient,
        private cfg: ConfigService,
        private auth: AuthService,
        private router: Router
    ) {
        this.apiBase = this.cfg.get<string>('apiBaseUrl', '');
        // Claims para setear empresa/usuario
        const claims = this.auth.claims(); // { empresaId, userId, ... }
        const current = this.model();
        this.model.set({
            ...current,
            empresa: { id: Number(claims?.empresaId ?? 0) },
            usuario: { id: Number(claims?.userId ?? 0) },
        });
    }

    ngOnInit(): void {
        // snapshot inicial para confirmar al cancelar si hay cambios
        this._initialSnapshot = JSON.stringify(this.model());
    }

    // Helpers de error
    private setFieldError(field: string, msg: string) {
        const cur = this.fieldErrors();
        this.fieldErrors.set({ ...cur, [field]: msg });
    }

    clearFieldError(field: string) {
        const cur = { ...this.fieldErrors() };
        delete cur[field];
        this.fieldErrors.set(cur);
    }

    // Enviar
    async create() {
        if (!this.isValid()) {
            this.errorGlobal.set('Revisa los campos requeridos.');
            return;
        }

        this.loading.set(true);
        this.errorGlobal.set(null);
        this.fieldErrors.set({});

        try {
            if (!this.apiBase) throw new Error('Config no cargada: falta apiBaseUrl');

            const url = `${this.apiBase}/client/create`;

            // Construir multipart/form-data: parte JSON 'cliente' y opcionalmente PDFs
            const clientePayload = { ...this.model() };
            const jsonStr = JSON.stringify(clientePayload);
            const jsonBlob = new Blob([jsonStr], { type: 'application/json' });
            const jsonSize = jsonBlob.size;
            const rutSize = this._rutFile ? this._rutFile.size : 0;
            const camaraSize = this._camaraFile ? this._camaraFile.size : 0;
            const fd = new FormData();
            fd.append('cliente', jsonBlob);
            if (this._rutFile) fd.append('rut', this._rutFile, this._rutFile.name);
            if (this._camaraFile) fd.append('camaraComercio', this._camaraFile, this._camaraFile.name);

                        this.uploadPct.set(0);
                        this.rutPct.set(0);
                        this.camaraPct.set(0);
                        const res = await new Promise<ClientCreateOk>((resolve, reject) => {
                                this.http.post<ClientCreateOk>(url, fd, { observe: 'events', reportProgress: true })
                                    .pipe(timeout(30000))
                                    .subscribe({
                                        next: ev => {
                                            if (ev.type === 1 /* UploadProgress */) {
                                                if (typeof ev.total === 'number' && ev.total > 0) {
                                                    const loaded = ev.loaded;
                                                    const pct = Math.min(100, Math.round(loaded * 100 / ev.total));
                                                    this.uploadPct.set(pct);
                                                    // per-file progress approximation (order: json, rut, camara)
                                                    if (rutSize > 0) {
                                                        const rutLoaded = Math.max(0, loaded - jsonSize);
                                                        const rPct = Math.min(100, Math.max(0, Math.round(rutLoaded * 100 / rutSize)));
                                                        this.rutPct.set(rPct);
                                                    }
                                                    if (camaraSize > 0) {
                                                        const camLoaded = Math.max(0, loaded - jsonSize - rutSize);
                                                        const cPct = Math.min(100, Math.max(0, Math.round(camLoaded * 100 / camaraSize)));
                                                        this.camaraPct.set(cPct);
                                                    }
                                                } else {
                                                    // indeterminado, animar con pseudo progreso
                                                    const curr = this.uploadPct() ?? 0;
                                                    this.uploadPct.set(Math.min(95, curr + 5));
                                                    if (rutSize > 0 && this.rutPct() < 95) this.rutPct.set(Math.min(95, this.rutPct() + 5));
                                                    if (camaraSize > 0 && this.camaraPct() < 95) this.camaraPct.set(Math.min(95, this.camaraPct() + 5));
                                                }
                                            } else if (ev.type === 4 /* Response */) {
                                                if (rutSize > 0) this.rutPct.set(100);
                                                if (camaraSize > 0) this.camaraPct.set(100);
                                                this.uploadPct.set(100);
                                                resolve(ev.body as ClientCreateOk);
                                            }
                                        },
                                        error: e => reject(e),
                                        complete: () => { /* noop */ }
                                    });
                        });

            // Algunos backends responden 200 pero con response="ERROR"
            if (res?.dataResponse?.response === 'ERROR') {
                throw { error: res } as any;
            }

            const createdId = res?.data?.id;
            const flash = `✅ Cliente creado (ID ${createdId}).`;

            // volver al listado con flash
            this.router.navigate(['/clientes'], { state: { flash } });

        } catch (e: any) {
            if (e instanceof TimeoutError) {
                this.errorGlobal.set('La solicitud tardó demasiado. Intenta de nuevo.');
            } else {
                // Mapear errores del backend
                const be = (e?.error ?? e) as ClientCreateError;

                // 1) Si trae arreglo de errores, mapear a campos
                const perField = be?.error ?? [];
                if (perField.length > 0) {
                    // msgError trae el nombre del campo; descError trae el mensaje para humano
                    perField.forEach(err => {
                        const field = (err?.msgError ?? '').trim() || 'global';
                        const msg = (err?.descError ?? err?.codError ?? 'Error').trim();
                        if (field === 'global') {
                            this.errorGlobal.set(msg);
                        } else {
                            this.setFieldError(field, msg);
                        }
                    });
                } else {
                    // 2) Fallback a message genérica
                    const msg = be?.message || e?.message || e?.error?.message || 'No se pudo crear el cliente.';
                    this.errorGlobal.set(msg);
                }
            }

            // subir a la parte superior para ver el mensaje
            setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);

        } finally {
            this.loading.set(false);
            setTimeout(() => {
                this.uploadPct.set(null);
                this.rutPct.set(0);
                this.camaraPct.set(0);
            }, 600);
        }
    }

    // Confirmación de cancelación si hay cambios
    cancelConfirmOpen = signal(false);
    cancel() {
        if (this.hasChanges()) {
            this.cancelConfirmOpen.set(true);
        } else {
            this.router.navigate(['/clientes']);
        }
    }
    closeCancelConfirm() { if (!this.loading()) this.cancelConfirmOpen.set(false); }
    proceedCancel() { this.router.navigate(['/clientes']); }

    private hasChanges(): boolean {
        try {
            return this._initialSnapshot !== JSON.stringify(this.model());
        } catch {
            return true;
        }
    }

    // ===== Archivos PDF nuevos =====
    _rutFile: File | null = null;
    _camaraFile: File | null = null;
    rutDragOver = signal(false);
    camaraDragOver = signal(false);

    onPickRut(ev: Event) {
        const input = ev.target as HTMLInputElement;
        const f = input.files?.[0];
        if (!f) { this._rutFile = null; return; }
        if (f.type !== 'application/pdf') {
            this.setFieldError('rut', 'Debe ser un PDF.');
            this._rutFile = null;
            return;
        }
        this.clearFieldError('rut');
        this._rutFile = f;
    }
    onRutDrop(ev: DragEvent) {
        ev.preventDefault(); this.rutDragOver.set(false);
        const f = ev.dataTransfer?.files?.[0];
        if (!f) return;
        if (f.type !== 'application/pdf') { this.setFieldError('rut', 'Debe ser un PDF.'); return; }
        this.clearFieldError('rut'); this._rutFile = f;
    }
    onRutDrag(ev: DragEvent) { ev.preventDefault(); this.rutDragOver.set(true); }
    onRutLeave(ev: DragEvent) { ev.preventDefault(); this.rutDragOver.set(false); }
    clearRut() { this._rutFile = null; this.clearFieldError('rut'); }

    onPickCamara(ev: Event) {
        const input = ev.target as HTMLInputElement;
        const f = input.files?.[0];
        if (!f) { this._camaraFile = null; return; }
        if (f.type !== 'application/pdf') {
            this.setFieldError('camaraComercio', 'Debe ser un PDF.');
            this._camaraFile = null;
            return;
        }
        this.clearFieldError('camaraComercio');
        this._camaraFile = f;
    }
    onCamaraDrop(ev: DragEvent) {
        ev.preventDefault(); this.camaraDragOver.set(false);
        const f = ev.dataTransfer?.files?.[0];
        if (!f) return;
        if (f.type !== 'application/pdf') { this.setFieldError('camaraComercio', 'Debe ser un PDF.'); return; }
        this.clearFieldError('camaraComercio'); this._camaraFile = f;
    }
    onCamaraDrag(ev: DragEvent) { ev.preventDefault(); this.camaraDragOver.set(true); }
    onCamaraLeave(ev: DragEvent) { ev.preventDefault(); this.camaraDragOver.set(false); }
    clearCamara() { this._camaraFile = null; this.clearFieldError('camaraComercio'); }
}