import { Component, signal, computed } from '@angular/core';
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
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './cliente-nuevo.html',
})
export class ClienteNuevoComponent {

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
        empresa: { id: 0 },   // se setea en ngOnInit con claims
        usuario: { id: 0 },   // se setea en ngOnInit con claims
        pacientes: []
    });

    // Estado UI
    loading = signal(false);
    errorGlobal = signal<string | null>(null);

    // Errores por campo (mapeados desde backend)
    fieldErrors = signal<Record<string, string>>({});

    // Validación mínima en cliente
    isValid = computed(() => !!this.model().nombre.trim());

    private apiBase = '';

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

            const res = await firstValueFrom(
                this.http.post<ClientCreateOk>(url, this.model()).pipe(timeout(10000))
            );

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
        }
    }
}