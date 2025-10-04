import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { firstValueFrom } from 'rxjs';
import { UsageService, UsagePoint } from '../core/usage.service';
import { ConfigService } from '../core/config.service';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/assets/leaflet/marker-icon-2x.png',
  iconUrl:       '/assets/leaflet/marker-icon.png',
  shadowUrl:     '/assets/leaflet/marker-shadow.png',
});

@Component({
  selector: 'app-usage-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container py-3">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h3 class="fw-semibold mb-0">Mapa de uso</h3>
          <small class="text-secondary">Puntos donde se ha usado la app</small>
        </div>
      </div>

      @if (error()) {
        <div class="alert alert-danger d-flex align-items-start gap-2" role="alert">
          <i class="bi bi-exclamation-triangle mt-1"></i>
          <div class="flex-grow-1">{{ error() }}</div>
        </div>
      }

      <div id="usage-map" class="rounded-4 shadow-sm"></div>
    </div>
  `,
  styles: [`
    /* Altura y ancho del contenedor del mapa */
    #usage-map { height: 70vh; width: 100%; }

    /* Si usas Leaflet por primera vez, importa su CSS en src/styles.css:
       @import "leaflet/dist/leaflet.css";
    */
  `]
})
export class UsageMap implements OnInit, OnDestroy {

  private map?: L.Map;
  private markersLayer = L.layerGroup();

  loading = signal(false);
  error = signal<string | null>(null);

  constructor(
    private usage: UsageService,
    private cfg: ConfigService
  ) {}

  ngOnInit(): void {
    // Config base del servicio
    this.usage.setApiBase(this.cfg.get<string>('apiBaseUrl', ''));

    this.initMap();
    this.sendPing();     // no bloquea UI si falla
    this.loadPoints();   // carga de puntos
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private initMap() {
    this.map = L.map('usage-map', {
      center: [4.7110, -74.0721],  // Bogotá por defecto
      zoom: 5
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    this.markersLayer.addTo(this.map);

    // Si el contenedor pudo estar oculto (tabs/accordions), forzamos re-cálculo
    setTimeout(() => this.map?.invalidateSize(), 0);

    // (Opcional) Recalcular al redimensionar
    window.addEventListener('resize', this.invalidateSize, { passive: true });
  }

  private invalidateSize = () => this.map?.invalidateSize();

  private placeMarkers(points: UsagePoint[]) {
    this.markersLayer.clearLayers();

    points.forEach(p => {
      const m = L.marker([p.lat, p.lng]);
      const label = `
        <div><strong>Uso</strong></div>
        <div>${p.city ? p.city + ',' : ''} ${p.country || ''}</div>
        <div class="text-secondary small">${p.ts ? new Date(p.ts).toLocaleString() : ''}</div>
      `;
      m.bindPopup(label);
      m.addTo(this.markersLayer);
    });

    if (points.length > 0) {
      const group = L.featureGroup(points.map(p => L.marker([p.lat, p.lng])));
      this.map?.fitBounds(group.getBounds().pad(0.2));
    }

    // Por si el mapa aún no tenía tamaño calculado
    this.map?.invalidateSize();
  }

  private async loadPoints() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(this.usage.list());
      const points = res?.data ?? [];
      this.placeMarkers(points);
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'No se pudo cargar el mapa.');
    } finally {
      this.loading.set(false);
    }
  }

  private async sendPing() {
    // Ubicación del navegador (si el usuario acepta); si no, el BE puede resolver por IP
    const getPosition = () =>
      new Promise<GeolocationPosition | null>((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          pos => resolve(pos),
          () => resolve(null),
          { enableHighAccuracy: false, timeout: 5000 }
        );
      });

    const pos = await getPosition();

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const platform = navigator.userAgent;

    this.usage.ping({
      lat: pos?.coords?.latitude ?? null,
      lng: pos?.coords?.longitude ?? null,
      appVersion: 'web-1.0.0',
      tz,
      platform
    }).subscribe({
      next: () => {},
      error: () => {} // fail-silent
    });
  }
}
