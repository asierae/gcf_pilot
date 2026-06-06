import { Component, ViewEncapsulation, inject } from '@angular/core';
import { Notification, NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.css',
  encapsulation: ViewEncapsulation.None
})
export class NotificationsComponent {
  private notificationService = inject(NotificationService);
  notifications = this.notificationService.notifications;

  dismiss(id: string): void {
    this.notificationService.dismiss(id);
  }

  getIcon(type: Notification['type']): string {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '!';
      default:
        return 'i';
    }
  }
}
