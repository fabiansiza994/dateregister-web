import { Directive, ElementRef, Input, OnDestroy, OnInit } from '@angular/core';
import type { Options as FlatpickrOptions } from 'flatpickr/dist/types/options';
import type { Instance as FlatpickrInstance } from 'flatpickr/dist/types/instance';
import flatpickr from 'flatpickr';
import { Spanish as es } from 'flatpickr/dist/l10n/es.js';
import { NgModel } from '@angular/forms';

@Directive({
  selector: '[appFlatpickr]',
  standalone: true
})
export class FlatpickrDirective implements OnInit, OnDestroy {
  @Input('appFlatpickr') config: Partial<FlatpickrOptions> | '' = '';

  private fp: FlatpickrInstance | null = null;

  constructor(private el: ElementRef<HTMLInputElement>, private ngModel: NgModel) {}

  ngOnInit(): void {
    const input = this.el.nativeElement;
    const current = this.ngModel?.model as string | null;
    const opts: Partial<FlatpickrOptions> = {
      dateFormat: 'Y-m-d',
      allowInput: true,
      locale: es,
      disableMobile: true,
      defaultDate: current || undefined,
      onChange: (dates, str) => {
        // Asegura formato Y-m-d
        const out = str && dates[0] ? this.fp?.formatDate?.(dates[0] as unknown as Date, 'Y-m-d') : '';
        // Actualiza ngModel
        if (this.ngModel?.control) this.ngModel.control.setValue(out || '');
      }
    };
    const finalConfig = { ...opts, ...(this.config && typeof this.config === 'object' ? this.config : {}) } as FlatpickrOptions;
    this.fp = flatpickr(input, finalConfig);
  }

  ngOnDestroy(): void {
    try { this.fp?.destroy(); } catch {}
    this.fp = null;
  }
}
