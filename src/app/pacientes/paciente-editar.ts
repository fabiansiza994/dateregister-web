import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { ConfigService } from '../core/config.service';

interface Paciente {
    id: number;
    nombre: string;
    apellido?: string | null;
    documento?: string | null;
    telefono?: string | null;
    email?: string | null;
    direccion?: string | null;
    clienteId?: number | null;
    estado: string; // 'ACTIVO' | 'INACTIVO'
}

interface DetailOk {
    dataResponse?: { response?: 'SUCCESS' | 'ERROR' };
    data?: Paciente;
    error?: Array<{ descError?: string; msgError?: string }>;
    message?: string;
}

interface UpdateOk {
    dataResponse?: { response?: 'SUCCESS' | 'ERROR' };
    error?: Array<{ descError?: string; msgError?: string }>;
    message?: string;
}

@Component({
    selector: 'app-paciente-editar',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './paciente-editar.html'
})
export class PacienteEditarComponent implements OnInit {
    loading = signal(false);
    error = signal<string | null>(null);
    fieldErrors = signal<Record<string, string>>({});
    paciente = signal<Paciente | null>(null);

    formOk = computed(() => {
        const p = this.paciente();
        return !!p && !!p.nombre?.trim();
    });

    private apiBase = '';
    private id = 0;

    constructor(
        private http: HttpClient,
        private cfg: ConfigService,
        private route: ActivatedRoute,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.apiBase = this.cfg.get<string>('apiBaseUrl', '');
        const id = Number(this.route.snapshot.paramMap.get('id'));
        if (!id) {
            this.error.set('ID inválido.');
            return;
        }
        this.id = id;
        this.loadDetail(id);
    }

    async loadDetail(id: number) {
        this.loading.set(true);
        this.error.set(null);
        this.fieldErrors.set({});
        try {
            const url = `${this.apiBase}/paciente/detail/${id}`;
            const res = await firstValueFrom(
                this.http.get<DetailOk>(url).pipe(timeout(10000))
            );
            if (res?.dataResponse?.response === 'ERROR') {
                const apiMsgs = res?.error?.map(e => e?.descError || e?.msgError)?.filter(Boolean)?.join(' | ');
                throw new Error(apiMsgs || res?.message || 'No se pudo cargar el paciente.');
            }
            if (!res?.data) throw new Error('Respuesta sin datos.');
            // Asegurar estado por defecto
            // paciente-editar.ts (en loadDetail, donde asignas p)
            const p = {
                ...res.data,
                estado: res.data?.estado ?? 'ACTIVO'
            } as Paciente;

            this.paciente.set(p);

            this.paciente.set(p);
        } catch (e: any) {
            if (e instanceof TimeoutError) this.error.set('La consulta tardó demasiado. Intenta de nuevo.');
            else this.error.set(e?.error?.message || e?.message || 'Error al cargar el paciente.');
        } finally {
            this.loading.set(false);
        }
    }

    onField<K extends keyof Paciente>(key: K, value: Paciente[K]) {
        this.paciente.update(p => p ? ({ ...p, [key]: value }) as Paciente : p);
        const fe = { ...this.fieldErrors() };
        delete fe[String(key)];
        this.fieldErrors.set(fe);
    }

    toggleEstado(ev: Event) {
        const checked = (ev.target as HTMLInputElement).checked;
        this.paciente.update(p => p ? ({ ...p, estado: checked ? 'ACTIVO' : 'INACTIVO' }) as Paciente : p);
        const fe = { ...this.fieldErrors() };
        delete fe['estado'];
        this.fieldErrors.set(fe);
    }

    async actualizar() {
        const p = this.paciente();
        if (!p) return;
        if (!this.formOk()) {
            this.error.set('Faltan campos obligatorios.');
            return;
        }

        this.loading.set(true);
        this.error.set(null);
        this.fieldErrors.set({});

        try {
            const url = `${this.apiBase}/paciente/update/${this.id}`;
            const payload = {
                nombre: (p.nombre ?? '').trim(),
                apellido: (p.apellido ?? '').trim(),
                documento: (p.documento ?? '').trim(),
                telefono: (p.telefono ?? '').trim(),
                email: (p.email ?? '').trim(),
                direccion: (p.direccion ?? '').trim(),
                clienteId: p.clienteId ?? null,
                estado: p.estado || 'ACTIVO'
            };

            const res = await firstValueFrom(
                this.http.put<UpdateOk>(url, payload).pipe(timeout(12000))
            );

            if (res?.dataResponse?.response === 'ERROR') {
                const arr = res?.error ?? [];
                if (arr.length > 0) {
                    const map: Record<string, string> = {};
                    arr.forEach(it => {
                        const field = (it?.msgError ?? '').trim() || 'global';
                        const msg = (it?.descError ?? 'Error').trim();
                        if (field === 'global') this.error.set(msg);
                        else map[field] = msg;
                    });
                    this.fieldErrors.set(map);
                    return;
                }
                throw new Error(res?.message || 'Actualización rechazada.');
            }

            this.router.navigate(['/pacientes'], { state: { flash: '✅ Paciente actualizado.' } });

        } catch (e: any) {
            if (e instanceof TimeoutError) this.error.set('La actualización tardó demasiado. Intenta de nuevo.');
            else this.error.set(e?.message || e?.error?.message || 'No se pudo actualizar el paciente.');
        } finally {
            this.loading.set(false);
        }
    }

    volver() { this.router.navigate(['/pacientes']); }
}
