import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

export type SupportedLanguage = 'en' | 'ru' | 'es' | 'fr' | 'zh' | 'ar' | 'vi';

export interface LanguageOption {
  code: SupportedLanguage;
  /** Native name, shown in the switcher. */
  label: string;
  dir: 'ltr' | 'rtl';
}

/** Languages offered across the site, in the order shown to visitors. */
export const SUPPORTED_LANGUAGES: readonly LanguageOption[] = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'ru', label: 'Русский', dir: 'ltr' },
  { code: 'es', label: 'Español', dir: 'ltr' },
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'zh', label: '中文', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'vi', label: 'Tiếng Việt', dir: 'ltr' },
];

const DEFAULT_LANGUAGE: SupportedLanguage = 'en';
const STORAGE_KEY = 'app_language';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  readonly languages = SUPPORTED_LANGUAGES;

  private currentLanguageSubject = new BehaviorSubject<SupportedLanguage>(DEFAULT_LANGUAGE);

  public currentLanguage$ = this.currentLanguageSubject.asObservable();

  constructor(
    private translate: TranslateService,
    @Inject(DOCUMENT) private document: Document,
  ) {
    this.translate.addLangs(this.languages.map((language) => language.code));
    this.translate.setFallbackLang(DEFAULT_LANGUAGE);
    this.initLanguage();
  }

  /**
   * Saved choice first, then the browser's preferred languages (es-MX -> es),
   * falling back to English for anything we do not translate yet.
   */
  private initLanguage(): void {
    this.applyLanguage(this.resolveInitialLanguage());
  }

  private resolveInitialLanguage(): SupportedLanguage {
    const saved = this.readSavedLanguage();
    if (saved) return saved;

    const candidates = this.browserLanguages();
    for (const tag of candidates) {
      const base = tag.toLowerCase().split('-')[0];
      const match = this.languages.find((language) => language.code === base);
      if (match) return match.code;
    }

    return DEFAULT_LANGUAGE;
  }

  private browserLanguages(): string[] {
    if (typeof navigator === 'undefined') return [];
    const languages = navigator.languages?.length
      ? Array.from(navigator.languages)
      : [navigator.language];
    return languages.filter((tag): tag is string => Boolean(tag));
  }

  private readSavedLanguage(): SupportedLanguage | null {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved && this.isValidLanguage(saved) ? (saved as SupportedLanguage) : null;
    } catch {
      // Storage can be blocked (private mode); detection still works.
      return null;
    }
  }

  public setLanguage(lang: string): void {
    if (!this.isValidLanguage(lang)) return;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Ignore storage failures.
    }
    this.applyLanguage(lang as SupportedLanguage);
  }

  public get currentLanguage(): SupportedLanguage {
    return this.currentLanguageSubject.value;
  }

  public get isRtl(): boolean {
    return this.languageOption(this.currentLanguage)?.dir === 'rtl';
  }

  private applyLanguage(lang: SupportedLanguage): void {
    this.translate.use(lang);
    this.applyDocumentLanguage(lang);
    this.currentLanguageSubject.next(lang);
  }

  private applyDocumentLanguage(lang: SupportedLanguage): void {
    const dir = this.languageOption(lang)?.dir ?? 'ltr';
    const root = this.document.documentElement;
    root.setAttribute('lang', lang);
    root.setAttribute('dir', dir);
  }

  private languageOption(code: SupportedLanguage): LanguageOption | undefined {
    return this.languages.find((language) => language.code === code);
  }

  private isValidLanguage(lang: string): boolean {
    return this.languages.some((language) => language.code === lang);
  }
}
