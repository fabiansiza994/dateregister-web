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
}

@Component({
  selector: 'app-cliente-editar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cliente-editar.html'
})
export class ClienteEditarComponent implements OnInit {

  // estado con signals
  loading = signal(false);
  error = signal<string | null>(null); // error global
  fieldErrors = signal<Record<string, string>>({}); // errores por campo
  cliente = signal<Cliente | null>(null);

  private apiBase = '';

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

    try {
      const url = `${this.apiBase}/client/update/${c.id}`;
      const payload = {
        identificacion: c.identificacion?.trim(),
        nombre: c.nombre?.trim(),
        apellido: (c.apellido ?? '').trim(),
        email: (c.email ?? '').trim(),
        direccion: (c.direccion ?? '').trim(),
        telefono: (c.telefono ?? '').trim(),
        estado: c.estado
      };

      const res = await firstValueFrom(
        this.http.put<{
          dataResponse?: { response?: 'SUCCESS' | 'ERROR' };
          error?: Array<{ descError?: string; msgError?: string }>;
          message?: string;
        }>(url, payload).pipe(timeout(10000))
      );

      if (res?.dataResponse?.response === 'ERROR') {
        // Mapear errores por campo
        const arr = res?.error ?? [];
        if (arr.length > 0) {
          const map: Record<string, string> = {};
          arr.forEach(it => {
            const field = (it?.msgError ?? '').trim() || 'global';
            const msg   = (it?.descError ?? 'Error').trim();
            if (field === 'global') {
              this.error.set(msg);
            } else {
              map[field] = msg;
            }
          });
          this.fieldErrors.set(map);
          // ejemplo recibido:
          // [{ codError:"E400", descError:"El apellido es obligatorio", msgError:"apellido" }]
          return; // no navegamos si hay errores
        }
        // si no hay array de errores, mostrar un genérico
        throw new Error(res?.message || 'Actualización rechazada');
      }

      // éxito
      this.router.navigate(['/clientes'], { state: { flash: '✅ Cliente actualizado.' } });

    } catch (e: any) {
      if (e instanceof TimeoutError) this.error.set('La actualización tardó demasiado. Intenta de nuevo.');
      else this.error.set(e?.descError || e?.error?.descError || 'No se pudo actualizar el cliente');
    } finally {
      this.loading.set(false);
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

  volver() { this.router.navigate(['/clientes']); }
}
