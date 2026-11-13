import { Component, Input } from "@angular/core";

/**
 * Inline SVG icon set for the wizard steps. Rendered at 1em so the
 * surrounding wrapper's font-size controls the size.
 */
@Component({
  selector: "app-step-icon",
  standalone: true,
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @switch (name) {
        @case ("access") {
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.6 2.7 4 5.8 4 9s-1.4 6.3-4 9c-2.6-2.7-4-5.8-4-9s1.4-6.3 4-9Z" />
        }
        @case ("general") {
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        }
        @case ("legal") {
          <path d="M12 3v18M8 21h8M4.5 7h15" />
          <path d="M4.5 7 2.3 12.5a2.4 2.4 0 0 0 4.4 0L4.5 7Z" />
          <path d="M19.5 7l-2.2 5.5a2.4 2.4 0 0 0 4.4 0L19.5 7Z" />
        }
        @case ("additional") {
          <path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z" />
          <path d="m3 12 9 4.5 9-4.5" />
          <path d="m3 16.5 9 4.5 9-4.5" />
        }
        @case ("fasttrack") {
          <path d="M13.5 5.5C16.3 2.7 19 3 19 3s.3 2.7-2.5 5.5L13 12l-3-3 3.5-3.5Z" />
          <path d="M10 9 6.5 10.5 4 12l5 5 1.5-2.5L12 11" />
          <path d="M6.5 17.5c-1 1-2 3-2 3s2-1 3-2" />
          <circle cx="15.5" cy="8.5" r="1.1" />
        }
        @case ("s4") {
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4.5" />
          <circle cx="12" cy="12" r="1" />
        }
        @case ("s5") {
          <path d="M4 21V6l8-3 8 3v15" />
          <path d="M2 21h20M9 21v-5h6v5" />
          <path d="M8.5 9h.01M12 9h.01M15.5 9h.01M8.5 12h.01M12 12h.01M15.5 12h.01" />
        }
        @case ("s6") {
          <path d="M3 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1" />
          <path d="M3 8v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" />
          <path d="M21 9h-5a2 2 0 0 0 0 4h5V9Z" />
        }
        @case ("s7") {
          <circle cx="9.5" cy="20" r="1.3" />
          <circle cx="18" cy="20" r="1.3" />
          <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 7H6" />
        }
        @case ("s8") {
          <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" />
          <path d="m9 12 2 2 4-4" />
        }
        @case ("s9") {
          <path d="m14 4 6 6L9 21H3v-6L14 4Z" />
          <path d="m12 6 6 6M3 21l3-3" />
        }
        @case ("s10") {
          <path d="M20 4c-9 0-15 5-15 11 0 3 2 5 5 5 6 0 10-6 10-16Z" />
          <path d="M4 21c1.5-5 5-8.5 10-11" />
        }
        @case ("s11") {
          <path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a9 9 0 0 1 18 0Z" />
          <path d="M12 8v4M12 15h.01" />
        }
        @case ("s12") {
          <path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20" />
          <circle cx="9.5" cy="7" r="3.5" />
          <path d="M17 4.5a3.5 3.5 0 0 1 0 6.9M21 20v-1.5a4 4 0 0 0-3-3.8" />
        }
        @case ("s13") {
          <circle cx="12" cy="8" r="4.5" />
          <path d="M12 12.5V21M9 18h6" />
        }
        @default {
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        }
      }
    </svg>
  `,
  styles: [
    ":host { display: inline-flex; align-items: center; justify-content: center; }",
    ":host svg { width: 1em; height: 1em; }",
  ],
})
export class StepIconComponent {
  @Input() name = "";
}
