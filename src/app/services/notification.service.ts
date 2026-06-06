import { Injectable, signal } from '@angular/core';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly notificationsState = signal<Notification[]>([]);
  readonly notifications = this.notificationsState.asReadonly();
  private readonly defaultDuration = 4500;

  show(message: string, type: NotificationType = 'info', duration = this.defaultDuration): void {
    const notification: Notification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      message,
      type
    };

    this.notificationsState.update((list) => [...list, notification]);

    if (duration > 0) {
      setTimeout(() => this.dismiss(notification.id), duration);
    }
  }

  success(message: string): void {
    this.show(message, 'success');
  }

  error(message: string): void {
    this.show(message, 'error');
  }

  info(message: string): void {
    this.show(message, 'info');
  }

  warning(message: string): void {
    this.show(message, 'warning');
  }

  dismiss(id: string): void {
    this.notificationsState.update((list) => list.filter((n) => n.id !== id));
  }
}
