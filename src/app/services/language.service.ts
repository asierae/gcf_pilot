import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

export type SupportedLanguage = 'en' | 'es' | 'pt' | 'zh' | 'ru';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private readonly STORAGE_KEY = 'app_language';
  private currentLanguageSubject = new BehaviorSubject<SupportedLanguage>('en');
  
  public currentLanguage$ = this.currentLanguageSubject.asObservable();

  constructor(private translate: TranslateService) {
    this.translate.addLangs(['en', 'es', 'pt', 'zh', 'ru']);
    this.translate.setFallbackLang('en');
    this.initLanguage();
  }

  private initLanguage(): void {
    const savedLang = localStorage.getItem(this.STORAGE_KEY) as SupportedLanguage;
    const langToUse = (savedLang && this.isValidLanguage(savedLang)) ? savedLang : 'en';
    
    this.translate.use(langToUse);
    this.currentLanguageSubject.next(langToUse);
  }

  public setLanguage(lang: string): void {
    if (this.isValidLanguage(lang)) {
      localStorage.setItem(this.STORAGE_KEY, lang);
      this.translate.use(lang);
      this.currentLanguageSubject.next(lang as SupportedLanguage);
    }
  }

  public get currentLanguage(): SupportedLanguage {
    return this.currentLanguageSubject.value;
  }

  private isValidLanguage(lang: string): boolean {
    return ['en', 'es', 'pt', 'zh', 'ru'].includes(lang);
  }
}
