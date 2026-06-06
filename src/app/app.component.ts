import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NotificationsComponent } from './shared/components/notifications/notifications.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NotificationsComponent],
  template: `
    <router-outlet></router-outlet>
    <app-notifications></app-notifications>
  `,
  styles: [`:host { display: block; min-height: 100vh; }`]
})
export class AppComponent {}
