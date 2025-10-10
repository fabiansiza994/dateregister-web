// src/app/configuracion/company-settings.ts
import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { AuthService } from '../core/auth.service';
import { CompanySettingsService, CompanySettingsDTO } from './company-settings.service';
// src/app/configuracion/company-settings.ts

@Component({
  selector: 'app-company-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './company-settings.html'
})
export class CompanySettingsComponent implements OnInit {

  private _claims = signal<any | null>(null);
  empresaId = computed<number>(() => Number(this._claims()?.empresaId ?? this._claims()?.empresa?.id ?? 0));
  empresaNombre = signal<string>('Empresa');

  loading = signal(false);
  error   = signal<string | null>(null);
  success = signal<string | null>(null);

  allowView = signal(false);
  allowEdit = signal(false);

  constructor(
    private auth: AuthService,
    private svc: CompanySettingsService,
  ) {}

  async ngOnInit() {
    this.auth.refreshFromStorage?.();
    this._claims.set(this.auth.claims());
    await this.load();
  }

  private async load() {
    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);
    try {
      const id = this.empresaId();
      if (!id) throw new Error('No se encontró empresaId en el token/claims.');
      const res = await firstValueFrom(this.svc.getSettings(id).pipe(timeout(10000)));
      if (res.dataResponse?.response === 'ERROR') throw res;
      const data = res.data as CompanySettingsDTO;
      this.empresaNombre.set(data.nombre);
      this.allowView.set(!!data.allowView);
      this.allowEdit.set(!!data.allowEdit);
    } catch (e: any) {
      this.error.set(e?.message || 'No fue posible cargar la configuración.');
    } finally {
      this.loading.set(false);
    }
  }

  async onToggleAllowView(ev: Event) {
    const target = ev.target as HTMLInputElement;
    const enabled = target.checked;
    await this.saveAllowView(enabled);
  }

  async onToggleAllowEdit(ev: Event) {
    const target = ev.target as HTMLInputElement;
    const enabled = target.checked;
    await this.saveAllowEdit(enabled);
  }

  private async saveAllowView(enabled: boolean) {
    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);
    const prev = this.allowView();
    try {
      const id = this.empresaId();
      const res = await firstValueFrom(this.svc.setAllowView(id, enabled).pipe(timeout(10000)));
      if (res.dataResponse?.response === 'ERROR') throw res;
      this.allowView.set(!!res.data?.allowView);
      this.allowEdit.set(!!res.data?.allowEdit); // si se apaga ver, BE apaga editar
      this.success.set(res.message || 'Guardado.');
    } catch (e: any) {
      this.allowView.set(prev);
      const msg = e?.error?.message || e?.message || 'No fue posible actualizar allowView.';
      this.error.set(msg);
    } finally {
      this.loading.set(false);
    }
  }

  private async saveAllowEdit(enabled: boolean) {
    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);
    const prev = this.allowEdit();
    try {
      const id = this.empresaId();
      const res = await firstValueFrom(this.svc.setAllowEdit(id, enabled).pipe(timeout(10000)));
      if (res.dataResponse?.response === 'ERROR') throw res;
      this.allowEdit.set(!!res.data?.allowEdit);
      this.allowView.set(!!res.data?.allowView); // si se enciende editar, BE enciende ver
      this.success.set(res.message || 'Guardado.');
    } catch (e: any) {
      this.allowEdit.set(prev);
      const msg = e?.error?.message || e?.message || 'No fue posible actualizar allowEdit.';
      this.error.set(msg);
    } finally {
      this.loading.set(false);
    }
  }
}
