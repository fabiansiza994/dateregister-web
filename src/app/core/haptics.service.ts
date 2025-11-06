import { Injectable } from '@angular/core';

// Capacitor Haptics is optional; on web it no-ops.
// We import types safely and call methods guardedly.
// Install with: npm i @capacitor/haptics && npx cap sync
// Then, native builds will provide real haptics; web stays silent.
let Haptics: any;
let ImpactStyle: any;
let NotificationType: any;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('@capacitor/haptics');
  Haptics = mod.Haptics;
  ImpactStyle = mod.ImpactStyle;
  NotificationType = mod.NotificationType;
} catch { /* optional dep not installed or running in environments without require */ }

@Injectable({ providedIn: 'root' })
export class HapticsService {
  private get available() { return !!Haptics; }

  async impact(level: 'light' | 'medium' | 'heavy' = 'light') {
    if (!this.available) return;
    const style = level === 'heavy' ? ImpactStyle.Heavy : level === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light;
    try { await Haptics.impact({ style }); } catch { /* noop */ }
  }

  async selection() {
    if (!this.available) return;
    try { await Haptics.selectionChanged(); } catch { /* noop */ }
  }

  async notify(type: 'success' | 'warning' | 'error' = 'success') {
    if (!this.available) return;
    const t = type === 'error' ? NotificationType.Error : type === 'warning' ? NotificationType.Warning : NotificationType.Success;
    try { await Haptics.notification({ type: t }); } catch { /* noop */ }
  }

  async vibrate(ms = 30) {
    if (!this.available) return;
    try { await Haptics.vibrate({ duration: Math.max(1, Math.min(ms, 500)) }); } catch { /* noop */ }
  }
}
