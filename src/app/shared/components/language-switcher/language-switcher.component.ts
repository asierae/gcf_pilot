import {
  Component,
  ElementRef,
  HostListener,
  Input,
  inject,
} from '@angular/core';
import { LanguageService, SupportedLanguage } from '../../../services/language.service';

/** Inline SVG flags, encoded as data URIs so no files or emoji fonts are needed. */
const FLAG_SVGS: Record<SupportedLanguage, string> = {
  en: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 16"><rect width="24" height="16" fill="#012169"/><path d="M0 0 24 16M24 0 0 16" stroke="#ffffff" stroke-width="3.4"/><path d="M0 0 24 16M24 0 0 16" stroke="#c8102e" stroke-width="1.8"/><path d="M12 0v16M0 8h24" stroke="#ffffff" stroke-width="5.4"/><path d="M12 0v16M0 8h24" stroke="#c8102e" stroke-width="3.2"/></svg>`,
  ru: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 16"><rect width="24" height="5.34" fill="#ffffff"/><rect y="5.34" width="24" height="5.33" fill="#0039a6"/><rect y="10.67" width="24" height="5.33" fill="#d52b1e"/></svg>`,
  es: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 16"><rect width="24" height="16" fill="#aa151b"/><rect y="4" width="24" height="8" fill="#f1bf00"/></svg>`,
  fr: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 16"><rect width="8" height="16" fill="#002395"/><rect x="8" width="8" height="16" fill="#ffffff"/><rect x="16" width="8" height="16" fill="#ed2939"/></svg>`,
  zh: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 16"><rect width="24" height="16" fill="#de2910"/><polygon points="4.6,1.6 5.29,2.56 7.26,3.53 6.55,4.28 6.25,6.66 5.23,5.88 2.95,6.66 3.97,5.88 1.94,3.53 2.65,4.28" fill="#ffde00"/><polygon points="9.4,2.4 9.75,2.9 10.75,3.4 10.4,3.8 10.25,5 9.7,4.6 8.55,5 9.05,4.6 8.05,3.4 8.9,3.8" fill="#ffde00"/></svg>`,
  ar: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 16"><rect width="24" height="16" fill="#006c35"/><path d="M4 9.6h15.4" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round"/><path d="M4 12.2h9.6" stroke="#ffffff" stroke-width="0.9" stroke-linecap="round"/><path d="M19.2 8.2c.6.5.6 1.4 0 1.9" stroke="#ffffff" stroke-width="0.9" fill="none"/></svg>`,
  vi: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 16"><rect width="24" height="16" fill="#da251d"/><polygon points="12,3.8 15.99,6.7 14.47,11.4 9.53,11.4 8.01,6.7" fill="#ffde00"/></svg>`,
};

function flagDataUri(code: SupportedLanguage): string {
  return `data:image/svg+xml,${encodeURIComponent(FLAG_SVGS[code])}`;
}

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  template: `
    <div class="lang-switch" [class.is-open]="open" [class.is-block]="block">
      <button
        type="button"
        class="lang-trigger"
        [attr.aria-expanded]="open"
        [attr.aria-label]="ariaLabel"
        (click)="toggle($event)"
      >
        <img class="lang-flag" [src]="currentFlag" alt="" width="20" height="14" />
        <span class="lang-name">{{ currentLabel }}</span>
        <svg class="lang-caret" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="m2.5 4.5 3.5 3 3.5-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      @if (open) {
        <div class="lang-menu" role="listbox" [attr.aria-label]="ariaLabel">
          @for (language of languageService.languages; track language.code) {
            <button
              type="button"
              class="lang-option"
              role="option"
              [attr.aria-selected]="language.code === languageService.currentLanguage"
              [class.is-active]="language.code === languageService.currentLanguage"
              (click)="choose(language.code)"
            >
              <img class="lang-flag" [src]="flagFor(language.code)" alt="" width="20" height="14" />
              <span class="lang-option-label">{{ language.label }}</span>
              @if (language.code === languageService.currentLanguage) {
                <svg class="lang-check" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              }
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: inline-block;
        position: relative;
      }

      :host(.block-host) {
        display: block;
      }

      .lang-switch {
        position: relative;
      }

      .lang-switch.is-block {
        width: 100%;
      }

      .lang-trigger {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        height: 34px;
        padding: 0 10px;
        border: 1px solid rgba(126, 178, 198, 0.18);
        border-radius: 999px;
        background: rgba(147, 168, 184, 0.06);
        color: rgba(212, 228, 236, 0.88);
        font-family: inherit;
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.04em;
        cursor: pointer;
        transition: border-color 0.2s ease, background 0.2s ease;
      }

      .lang-trigger:hover,
      .lang-switch.is-open .lang-trigger {
        border-color: rgba(232, 192, 106, 0.36);
        background: rgba(232, 192, 106, 0.09);
      }

      .lang-switch.is-block .lang-trigger {
        width: 100%;
        justify-content: flex-start;
        border-radius: 10px;
        height: 40px;
        font-size: 13px;
        padding: 0 12px;
      }

      .lang-flag {
        display: block;
        width: 20px;
        height: 14px;
        border-radius: 2px;
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.14);
        flex-shrink: 0;
      }

      .lang-name {
        line-height: 1;
        white-space: nowrap;
      }

      .lang-caret {
        width: 11px;
        height: 11px;
        color: rgba(232, 192, 106, 0.85);
        transition: transform 0.2s ease;
        flex-shrink: 0;
      }

      .lang-switch.is-open .lang-caret {
        transform: rotate(180deg);
      }

      .lang-switch.is-block .lang-caret {
        margin-left: auto;
      }

      .lang-menu {
        position: absolute;
        z-index: 120;
        top: calc(100% + 8px);
        right: 0;
        min-width: 176px;
        padding: 6px;
        border: 1px solid rgba(126, 178, 198, 0.2);
        border-radius: 12px;
        background: #0d1f2c;
        box-shadow: 0 18px 40px rgba(3, 10, 16, 0.55);
      }

      .lang-switch.is-block .lang-menu {
        left: 0;
        right: 0;
        min-width: 0;
      }

      .lang-option {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 8px 10px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: rgba(212, 228, 236, 0.86);
        font-family: inherit;
        font-size: 12px;
        text-align: left;
        cursor: pointer;
      }

      .lang-option:hover {
        background: rgba(232, 192, 106, 0.1);
        color: #ffffff;
      }

      .lang-option.is-active {
        background: rgba(232, 192, 106, 0.14);
        color: #ffffff;
      }

      .lang-option-label {
        flex: 1;
        white-space: nowrap;
      }

      .lang-check {
        width: 14px;
        height: 14px;
        color: #e8c06a;
        flex-shrink: 0;
      }

      @media (max-width: 700px) {
        .lang-trigger {
          height: 30px;
          padding: 0 8px;
          gap: 6px;
          font-size: 10px;
        }
        .lang-name {
          max-width: 62px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .lang-menu {
          min-width: 158px;
        }
      }
    `,
  ],
})
export class LanguageSwitcherComponent {
  @Input() block = false;
  @Input() ariaLabel = 'Language';

  readonly languageService = inject(LanguageService);
  private readonly host = inject(ElementRef<HTMLElement>);

  open = false;

  get currentFlag(): string {
    return this.flagFor(this.languageService.currentLanguage);
  }

  get currentLabel(): string {
    return (
      this.languageService.languages.find(
        (language) => language.code === this.languageService.currentLanguage,
      )?.label ?? 'English'
    );
  }

  flagFor(code: SupportedLanguage): string {
    return flagDataUri(code);
  }

  toggle(event: MouseEvent): void {
    event.stopPropagation();
    this.open = !this.open;
  }

  choose(code: SupportedLanguage): void {
    this.languageService.setLanguage(code);
    this.open = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open) return;
    const target = event.target as Node | null;
    if (target && !this.host.nativeElement.contains(target)) {
      this.open = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open = false;
  }
}
