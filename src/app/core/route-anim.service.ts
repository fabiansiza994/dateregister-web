import { Injectable, signal } from '@angular/core';

type TabKey = 'clientes' | 'pacientes' | 'trabajos' | 'reportes' | '';

@Injectable({ providedIn: 'root' })
export class RouteAnimService {
  private currentKey = signal<TabKey>('');
  private direction = signal<'forward' | 'backward'>('forward');

  // Orden lógico de tabs para decidir sentido del slide
  private order: Record<Exclude<TabKey, ''>, number> = {
    clientes: 0,
    pacientes: 1,
    trabajos: 2,
    reportes: 3,
  } as const;

  setCurrentFromUrl(url: string) {
    const first = (url || '').split('?')[0].split('#')[0];
    const seg = first.startsWith('/') ? first.slice(1).split('/')[0] : first.split('/')[0];
    const key = (seg || '').toLowerCase() as TabKey;
    if (key === 'clientes' || key === 'pacientes' || key === 'trabajos' || key === 'reportes') {
      this.currentKey.set(key);
    } else {
      this.currentKey.set('');
    }
  }

  /** Llamar ANTES de navegar para fijar el sentido del slide */
  setTarget(targetKey: TabKey) {
    const cur = this.currentKey();
    if (!targetKey || !cur || !(targetKey in this.order) || !(cur in this.order)) {
      this.direction.set('forward');
      return;
    }
    const dir = this.order[targetKey as Exclude<TabKey, ''>] > this.order[cur as Exclude<TabKey, ''>] ? 'forward' : 'backward';
    this.direction.set(dir);
  }

  getDirection() { return this.direction(); }
}
