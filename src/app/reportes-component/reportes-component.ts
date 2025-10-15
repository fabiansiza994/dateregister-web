import { Component, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ConfigService } from '../core/config.service';
import { AuthService } from '../core/auth.service';

interface ClienteMin { id: number; nombre: string; apellido?: string | null }
interface TrabajoMin {
  id: number;
  fecha: string;              // YYYY-MM-DD
  valorTotal?: number | null;
  estado?: string | null;
  cliente?: ClienteMin | null;
}
interface JobSearchOk {
  dataResponse?: { response?: 'SUCCESS'|'ERROR' };
  data?: { items: TrabajoMin[]; totalElements: number; totalPages?: number };
  message?: string;
}

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reportes-component.html'
})
export class ReportesComponent {
  // ===== Claims
  private readonly _claims = signal<any | null>(null);
  empresaId = computed<number>(() => Number(this._claims()?.empresaId ?? 0));
  empresa = computed<string>(() => String(this._claims()?.empresa ?? '—'));

  // ===== UI
  from = signal<string>('');
  to = signal<string>('');

  loading = signal(false);
  error = signal<string | null>(null);
  info = signal<string | null>(null);

  private apiBase = '';
  private _chartDebounce: any = 0;

  // ===== Chart state
  chartLoading = signal(false);
  chartMode = signal<'bar'|'doughnut'>('bar');
  barGranularity = signal<'daily'|'weekly'>('daily');
  barRects = signal<Array<{ x:number; y:number; w:number; h:number; label:string; value:number }>>([]);
  barMax = signal(0);
  barTicksX = signal<Array<{ x:number; label:string }>>([]);
  barGridY = signal<Array<{ y:number; label:string }>>([]);
  donutArcs = signal<Array<{ d:string; color:string; label:string; value:number }>>([]);
  donutTotal = signal(0);
  donutLegend = signal<Array<{ color:string; label:string; value:number }>>([]);
  chartNote = signal<string | null>(null);
  chartSubtitle = signal<string>('');
  metric = signal<'count'|'sum'>('count');
  tip = signal<{ x:number; y:number; title:string; sub?:string } | null>(null);
  yAxisLabel = computed(() => this.metric()==='count' ? 'Trabajos (cantidad)' : 'Valor total (COP)');
  formattedBarMax = computed(() => {
    const v = this.barMax();
    return this.metric()==='count' ? `${v} ${v===1?'trabajo':'trabajos'}` : this.formatCurrency(v);
  });

  constructor(private http: HttpClient, private cfg: ConfigService, private auth: AuthService) {
    this.apiBase = this.cfg.get<string>('apiBaseUrl', '');
    this.auth.refreshFromStorage();
    this._claims.set(this.auth.claims());
    // defaults: mes actual
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const pad = (n: number) => String(n).padStart(2, '0');
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    this.from.set(`${first.getFullYear()}-${pad(first.getMonth() + 1)}-${pad(first.getDate())}`);
    this.to.set(`${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`);

    // Auto-refresh chart when dates change (debounced via effect)
    effect(() => {
      const f = this.from();
      const t = this.to();
      clearTimeout(this._chartDebounce);
      this._chartDebounce = setTimeout(() => this.loadChart(), 300);
    });
  }

  canDownload = computed(() => !!this.from() && !!this.to() && !this.loading() && this.empresaId() > 0);

  private validate(): string | null {
    if (!this.from() || !this.to()) return 'Selecciona fecha inicio y fecha fin.';
    if (!this.empresaId()) return 'No se pudo determinar la empresa del usuario.';
    if (this.from() > this.to()) return 'La fecha inicio no puede ser mayor a la fecha fin.';
    return null;
  }

  async downloadExcel() {
    const v = this.validate();
    if (v) { this.error.set(v); return; }

    this.loading.set(true);
    this.error.set(null);
    this.info.set(null);
    try {
      const params = new HttpParams()
        .set('from', this.from())
        .set('to', this.to())
        .set('empresaId', String(this.empresaId()));

      // GET excel como blob
      const url = `${this.apiBase}/job/report/excel`;
      const blob = await this.http.get(url, { params, responseType: 'blob' as const }).toPromise();

      if (!blob || blob.size === 0) throw new Error('El reporte no devolvió contenido.');

      // Descargar
      const fname = `reporte_trabajos_${this.from()}_a_${this.to()}.xlsx`;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fname;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 2000);

      this.info.set('✅ Reporte generado.');
      setTimeout(() => this.info.set(null), 2000);

    } catch (e: any) {
      const msg = e?.error?.message || e?.message || 'No fue posible generar el reporte.';
      this.error.set(msg);
    } finally {
      this.loading.set(false);
    }
  }

  // ===== Charts =====
  private daysDiff(a: string, b: string): number {
    const da = new Date(a + 'T00:00:00');
    const db = new Date(b + 'T00:00:00');
    return Math.floor((db.getTime() - da.getTime()) / (24*3600*1000)) + 1;
  }

  async loadChart() {
    const v = this.validate();
    if (v) { this.error.set(v); return; }
    this.chartLoading.set(true);
    this.chartNote.set(null);
    try {
      const days = this.daysDiff(this.from(), this.to());
      if (days <= 31) { this.chartMode.set('bar'); this.barGranularity.set('daily'); }
      else if (days <= 90) { this.chartMode.set('bar'); this.barGranularity.set('weekly'); }
      else { this.chartMode.set('doughnut'); }
      const items = await this.fetchAllJobsInRange();
      if (!items.length) {
        this.barRects.set([]); this.donutArcs.set([]); this.donutLegend.set([]); this.donutTotal.set(0);
        this.chartNote.set('No hay datos para el rango seleccionado.');
        return;
      }
      if (this.chartMode()==='bar') this.prepareBar(items, this.barGranularity(), this.metric());
      else this.prepareDonut(items, this.metric());

      // Subtitle
      const f = this.from(), t = this.to();
      if (this.chartMode()==='bar') {
        const gran = this.barGranularity()==='daily' ? 'diario' : 'semanal';
        const met = this.metric()==='count' ? 'Conteo' : 'Valor $';
        this.chartSubtitle.set(`Del ${f} al ${t} · ${met} (${gran})`);
      } else {
        const met = this.metric()==='count' ? 'Distribución por estado (conteo)' : 'Distribución por estado (valor $)';
        this.chartSubtitle.set(`Del ${f} al ${t} · ${met}`);
      }
    } catch (e:any) {
      this.error.set(e?.message || 'No fue posible cargar datos para el gráfico.');
    } finally {
      this.chartLoading.set(false);
    }
  }

  private async fetchAllJobsInRange(): Promise<TrabajoMin[]> {
    const size = 200; // page size
    let page = 0;
    let collected: TrabajoMin[] = [];
    let total = 0;
    for (let i=0; i<10; i++) { // limitar a 10 páginas (2000 items)
      const params = new HttpParams()
        .set('q', '')
        .set('page', String(page))
        .set('size', String(size))
        .set('sortBy', 'fecha')
        .set('direction', 'ASC')
        // Intentar server-side; si el backend ignora, filtramos client-side
        .set('from', this.from())
        .set('to', this.to())
        .set('empresaId', String(this.empresaId()));
      const url = `${this.apiBase}/job/search`;
      const res = await this.http.get<JobSearchOk>(url, { params }).toPromise();
      const items = res?.data?.items ?? [];
      total = res?.data?.totalElements ?? items.length;
      collected = collected.concat(items);
      if (collected.length >= total || items.length < size) break;
      page++;
    }
    // Filtro client-side por si el backend no filtró
    const fromStr = this.from(); const toStr = this.to();
    const inRange = collected.filter(j => j.fecha >= fromStr && j.fecha <= toStr);
    if (collected.length > inRange.length) {
      this.chartNote.set('Se filtró por fecha en el cliente.');
    }
    if (collected.length > 2000) this.chartNote.set('Mostrando primeros 2000 registros.');
    return inRange;
  }

  private prepareBar(items: TrabajoMin[], granularity: 'daily'|'weekly', metric: 'count'|'sum') {
    const start = new Date(this.from() + 'T00:00:00');
    const end = new Date(this.to() + 'T00:00:00');
    const pad = (n:number)=>String(n).padStart(2,'0');
    const mm = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

    let out: Array<{label:string, value:number}> = [];

    if (granularity === 'daily') {
      // Conteo por día
      const counts = new Map<string, number>();
      for (const it of items) {
        const add = metric==='count' ? 1 : (Number(it.valorTotal||0));
        counts.set(it.fecha, (counts.get(it.fecha) || 0) + add);
      }
      for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
        const key = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
        out.push({ label: key, value: counts.get(key) || 0 });
      }
    } else {
      // Conteo por semana (bloques de 7 días align Lunes)
      const counts = new Map<string, number>();
      // Encontrar lunes en o antes de 'start'
      const s0 = new Date(start);
      const day = s0.getDay(); // 0=Dom,1=Lun,...
      const back = (day + 6) % 7; // días hacia atrás hasta lunes
      s0.setDate(s0.getDate() - back);
      for (let s = new Date(s0), idx = 0; s <= end; s.setDate(s.getDate()+7), idx++) {
        const e = new Date(Math.min(end.getTime(), new Date(s.getTime() + 6*24*3600*1000).getTime()));
        const key = `${pad(s.getDate())} ${mm[s.getMonth()]}–${pad(e.getDate())} ${mm[e.getMonth()]}`;
        counts.set(key, 0);
      }
      for (const it of items) {
        const d = new Date(it.fecha + 'T00:00:00');
        const diff = Math.floor((d.getTime() - s0.getTime())/(24*3600*1000));
        const blockStart = new Date(s0.getTime() + Math.floor(diff/7)*7*24*3600*1000);
        const blockEnd = new Date(Math.min(end.getTime(), blockStart.getTime() + 6*24*3600*1000));
        const key = `${pad(blockStart.getDate())} ${mm[blockStart.getMonth()]}–${pad(blockEnd.getDate())} ${mm[blockEnd.getMonth()]}`;
        const add = metric==='count' ? 1 : (Number(it.valorTotal||0));
        counts.set(key, (counts.get(key) || 0) + add);
      }
      out = Array.from(counts.entries()).map(([label, value])=>({label, value}));
    }

    const maxV = Math.max(1, ...out.map(o=>o.value));
    // SVG geom
    const W = 760, H = 260, padL = 36, padB = 24, padT = 10, padR = 10;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const n = out.length; const gap = 6; const barW = Math.max(8, Math.floor((innerW - (n-1)*gap)/Math.max(1,n)));
    let x = padL;
    const rects: Array<{x:number;y:number;w:number;h:number;label:string;value:number}> = [];
    for (const o of out) {
      const h = Math.round(innerH * (o.value / maxV));
      const y = padT + (innerH - h);
      rects.push({ x, y, w: barW, h, label: o.label, value: o.value });
      x += barW + gap;
    }
    this.barRects.set(rects);
    this.barMax.set(maxV);

    // Eje Y grid con "nice ticks" (evita duplicados 1,1,2,2)
    const yTicks = this.computeNiceTicks(maxV, 5, this.metric());
    const grid: Array<{y:number;label:string}> = yTicks.map(v => {
      const y = padT + (innerH - innerH * (v / Math.max(1, yTicks[yTicks.length-1])));
      const label = this.metric()==='sum' ? this.formatCurrency(v) : String(v);
      return { y, label };
    });
    this.barGridY.set(grid);

    // Eje X ticks (aprox. 8 etiquetas)
    const xTicks: Array<{x:number;label:string}> = [];
    const step = Math.max(1, Math.ceil(n / 8));
    rects.forEach((r, i) => {
      if (i % step === 0) xTicks.push({ x: Math.round(r.x + r.w/2), label: out[i]?.label || '' });
    });
    this.barTicksX.set(xTicks);
  }

  private computeNiceTicks(maxV: number, targetCount: number, metric: 'count'|'sum'): number[] {
    if (!Number.isFinite(maxV) || maxV <= 0) return [0, 1];
    if (metric === 'count' && maxV <= 3) {
      const arr: number[] = [];
      for (let i=0;i<=maxV;i++) arr.push(i);
      return arr;
    }
    const niceNum = (range: number, round: boolean) => {
      const exp = Math.floor(Math.log10(range));
      const f = range / Math.pow(10, exp);
      let nf: number;
      if (round) {
        if (f < 1.5) nf = 1; else if (f < 3) nf = 2; else if (f < 7) nf = 5; else nf = 10;
      } else {
        if (f <= 1) nf = 1; else if (f <= 2) nf = 2; else if (f <= 5) nf = 5; else nf = 10;
      }
      return nf * Math.pow(10, exp);
    };
    const range = niceNum(maxV, false);
    const spacing = niceNum(range / (targetCount - 1), true);
    const niceMax = Math.ceil(maxV / spacing) * spacing;
    const ticks: number[] = [];
    for (let v = 0; v <= niceMax + 1e-6; v += spacing) {
      ticks.push(metric==='count' ? Math.round(v) : v);
    }
    // Asegurar 0 y max
    if (ticks[0] !== 0) ticks.unshift(0);
    if (ticks[ticks.length-1] !== niceMax) ticks[ticks.length-1] = niceMax;
    return ticks;
  }

  private prepareDonut(items: TrabajoMin[], metric: 'count'|'sum') {
    // Agrupar por estado con métrica
    const map = new Map<string, number>();
    for (const it of items) {
      const k = (it.estado || '—').toUpperCase();
      const add = metric==='count' ? 1 : (Number(it.valorTotal||0));
      map.set(k, (map.get(k) || 0) + add);
    }
    const entries = Array.from(map.entries()).map(([label, value])=>({label, value}));
    const total = entries.reduce((a,b)=>a+b.value,0) || 1;
    const colors = ['#4f46e5','#06b6d4','#f59e0b','#10b981','#ef4444','#8b5cf6','#14b8a6','#f97316'];
    const cx = 140, cy = 140, r = 100, ir = 60; // inner radius
    let acc = 0;
    const arcs: Array<{d:string;color:string;label:string;value:number}> = [];
    const legend: Array<{color:string;label:string;value:number}> = [];
    const toXY = (ang:number, rad:number) => ({ x: cx + rad*Math.cos(ang), y: cy + rad*Math.sin(ang) });
    entries.forEach((e, i) => {
      const start = acc / total * 2*Math.PI - Math.PI/2;
      acc += e.value;
      const end = acc / total * 2*Math.PI - Math.PI/2;
      const large = (end - start) > Math.PI ? 1 : 0;
      const c = colors[i % colors.length];
      const p0 = toXY(start, r), p1 = toXY(end, r);
      const q0 = toXY(end, ir), q1 = toXY(start, ir);
      const d = [
        `M ${p0.x} ${p0.y}`,
        `A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`,
        `L ${q0.x} ${q0.y}`,
        `A ${ir} ${ir} 0 ${large} 0 ${q1.x} ${q1.y}`,
        'Z'
      ].join(' ');
      arcs.push({ d, color: c, label: e.label, value: e.value });
      legend.push({ color: c, label: e.label, value: e.value });
    });
    this.donutArcs.set(arcs);
    this.donutLegend.set(legend);
    this.donutTotal.set(total);
  }

  // ===== Tooltip helpers and formatting =====
  showTip(e: MouseEvent, title: string, value: number) {
    const sub = this.metric()==='count' ? `${value} ${value===1?'trabajo':'trabajos'}` : this.formatCurrency(value);
    this.tip.set({ x: e.clientX + 12, y: e.clientY + 12, title, sub });
  }
  moveTip(e: MouseEvent) {
    const t = this.tip(); if (!t) return; this.tip.set({ ...t, x: e.clientX + 12, y: e.clientY + 12 });
  }
  hideTip() { this.tip.set(null); }

  formatCurrency(n: number) {
    try { return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n); }
    catch { return `$${n}`; }
  }
}
