import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
  private readonly contextSignal = signal<string | null>(null);
  readonly context = this.contextSignal.asReadonly();

  setContext(label: string): void {
    this.contextSignal.set(label);
  }

  clearContext(): void {
    this.contextSignal.set(null);
  }
}
