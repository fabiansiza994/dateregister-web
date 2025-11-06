import { Directive, ElementRef, EventEmitter, HostBinding, HostListener, Input, NgZone, OnDestroy, OnInit, Output } from '@angular/core';

/**
 * Swipe-to-delete directive (only used in Trabajos mobile list)
 * - Drag left to reveal a red delete background.
 * - If released beyond threshold (ratio), emits `swipeDelete` and snaps back.
 * - Short drags snap back and do nothing.
 */
@Directive({
  selector: '[appSwipeToDelete]',
  standalone: true,
})
export class SwipeToDeleteDirective implements OnInit, OnDestroy {
  @HostBinding('class.dr-swipeable') swipeable = true;

  @Input() thresholdRatio = 0.6; // % of width required to trigger action
  @Output() swipeDelete = new EventEmitter<void>();
  @Output() swipeEdit = new EventEmitter<void>();

  private hostEl: HTMLElement;
  private contentEl: HTMLElement | null = null;
  private bgEl: HTMLElement | null = null;

  private startX = 0;
  private startY = 0;
  private dx = 0;
  private swiping = false;
  private lockedX = false;
  private moved = false;
  private lastSwipeTs = 0;

  constructor(el: ElementRef<HTMLElement>, private zone: NgZone) {
    this.hostEl = el.nativeElement;
  }

  ngOnInit(): void {
    // Find content and background elements if present
    this.contentEl = this.hostEl.querySelector('.dr-swipe-content') as HTMLElement | null;
    this.bgEl = this.hostEl.querySelector('.dr-swipe-bg') as HTMLElement | null;
    if (!this.contentEl) {
      // Fallback: apply transform to host itself
      this.contentEl = this.hostEl;
    }
    // Ensure initial transition style
    this.setTransition(true);
  }

  ngOnDestroy(): void {
    // noop
  }

  @HostListener('touchstart', ['$event'])
  onTouchStart(ev: TouchEvent) {
    if (ev.touches.length !== 1) return;
    const t = ev.touches[0];
    this.startX = t.clientX;
    this.startY = t.clientY;
    this.dx = 0;
    this.swiping = true;
    this.lockedX = false;
    this.moved = false;
    this.setTransition(false);
  }

  @HostListener('touchmove', ['$event'])
  onTouchMove(ev: TouchEvent) {
    if (!this.swiping || !this.contentEl) return;
    const t = ev.touches[0];
    const curX = t.clientX;
    const curY = t.clientY;
    const dx = curX - this.startX;
    const dy = curY - this.startY;

    if (!this.lockedX) {
      // Lock to horizontal if horizontal delta dominates a bit
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        this.lockedX = true;
        // prevent page from scrolling while swiping horizontally
        this.hostEl.style.touchAction = 'none';
      } else {
        return; // allow vertical scroll until locked
      }
    }

  // Allow swiping both directions
  this.dx = dx;
    if (Math.abs(this.dx) > 2) this.moved = true;

    // Apply transform following the finger
    this.contentEl.style.transform = `translateX(${this.dx}px)`;
    // Optional: slight reveal of bg can be handled by CSS; nothing more here
    ev.preventDefault();
  }

  @HostListener('touchend')
  @HostListener('touchcancel')
  onTouchEnd() {
    if (!this.swiping || !this.contentEl) return;
    const width = this.hostEl.clientWidth || 1;
  const thr = this.thresholdRatio * width;
  const shouldDelete = this.dx <= -thr;
  const shouldEdit = this.dx >= thr;

    // Snap animation
    this.setTransition(true);
    if (shouldDelete) {
      // Animate off-screen for feedback, then emit and reset
      this.contentEl.style.transform = `translateX(${-width}px)`;
      const ts = Date.now();
      this.lastSwipeTs = ts;
      // Use zone to avoid change detection thrash
      this.zone.runOutsideAngular(() => {
        setTimeout(() => {
          // Emit inside Angular
          this.zone.run(() => this.swipeDelete.emit());
          // Reset back to resting position
          this.contentEl!.style.transform = 'translateX(0px)';
          // Restore touch-action
          this.hostEl.style.touchAction = '';
        }, 160);
      });
    } else if (shouldEdit) {
      // Swipe right: edit
      this.contentEl.style.transform = `translateX(${width}px)`;
      const ts = Date.now();
      this.lastSwipeTs = ts;
      this.zone.runOutsideAngular(() => {
        setTimeout(() => {
          this.zone.run(() => this.swipeEdit.emit());
          this.contentEl!.style.transform = 'translateX(0px)';
          this.hostEl.style.touchAction = '';
        }, 160);
      });
    } else {
      // Not enough: snap back
      this.contentEl.style.transform = 'translateX(0px)';
      this.hostEl.style.touchAction = '';
    }

    // Reset state
    this.swiping = false;
    this.lockedX = false;
    this.dx = 0;
  }

  // Prevent accidental click right after a swipe gesture
  @HostListener('click', ['$event'])
  onClick(ev: MouseEvent) {
    if (this.moved) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      // Reset moved flag shortly after to not block future taps
      setTimeout(() => { this.moved = false; }, 0);
    }
  }

  private setTransition(enable: boolean) {
    if (!this.contentEl) return;
    this.contentEl.style.transition = enable ? 'transform 180ms ease' : 'none';
    this.contentEl.style.willChange = enable ? 'auto' : 'transform';
  }
}
