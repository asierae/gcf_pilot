import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NotificationsComponent } from './shared/components/notifications/notifications.component';
import { LanguageService } from './services/language.service';

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
export class AppComponent {
  // Injected at bootstrap so the saved/browser language is applied even on
  // routes that do not use the shell layout (login, landing).
  constructor(public readonly languageService: LanguageService) {}
}
