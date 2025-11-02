import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ReportesActionsService {
  private readonly _download$ = new Subject<void>();

  triggerDownload(): void {
    this._download$.next();
  }

  onDownload(): Observable<void> {
    return this._download$.asObservable();
  }
}
