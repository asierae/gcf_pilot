import {
  AfterViewInit,
  Component,
  HostListener,
  OnDestroy,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ImpactGlobeComponent } from './impact-globe/impact-globe.component';
import { LanguageService } from '../../services/language.service';
import { LanguageSwitcherComponent } from '../../shared/components/language-switcher/language-switcher.component';
import { CONTACT_EMAIL } from '../../config/email.config';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, TranslatePipe, ImpactGlobeComponent, LanguageSwitcherComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
})
export class LandingComponent implements AfterViewInit, OnDestroy {
  menuOpen = false;
  scrolled = false;

  /** Contact inbox used by the pathway-guidance CTA. */
  readonly contactMailto = `mailto:${CONTACT_EMAIL}?subject=GCF%20pathway%20guidance`;

  private revealObserver?: IntersectionObserver;
  private counterObserver?: IntersectionObserver;
  private readonly previousTitle = 'Avera — GCF Accreditation Portal';
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly title: Title,
    public readonly languageService: LanguageService,
    private readonly translate: TranslateService,
  ) {
    this.syncDocumentTitle();
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncDocumentTitle());
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    const next = window.scrollY > 24;
    if (next !== this.scrolled) {
      this.scrolled = next;
    }
  }

  @HostListener('click', ['$event'])
  onHostClick(event: MouseEvent): void {
    const anchor = (event.target as HTMLElement | null)?.closest?.(
      'a[href^="#"]',
    ) as HTMLAnchorElement | null;
    const hash = anchor?.getAttribute('href');
    if (!hash || hash === '#') {
      return;
    }

    const target = document.querySelector(hash);
    if (!target) {
      return;
    }

    event.preventDefault();
    const offset = hash === '#hero' ? 0 : 76;
    const top = Math.max(
      target.getBoundingClientRect().top + window.scrollY - offset,
      0,
    );
    window.scrollTo({
      top,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
    history.replaceState(null, '', hash);
  }

  ngAfterViewInit(): void {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.style.scrollBehavior = 'smooth';
    }
    this.setupReveals();
    this.setupCounters();
  }

  ngOnDestroy(): void {
    document.documentElement.style.scrollBehavior = '';
    this.revealObserver?.disconnect();
    this.counterObserver?.disconnect();
    this.title.setTitle(this.previousTitle);
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }

  private syncDocumentTitle(): void {
    const translated = this.translate.instant('LANDING.META_TITLE');
    this.title.setTitle(
      translated && translated !== 'LANDING.META_TITLE'
        ? translated
        : 'Avera Capital Access — Climate Finance Advisory',
    );
  }

  private setupReveals(): void {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>('[data-reveal]'),
    );
    if (!elements.length) {
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      elements.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    this.revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            this.revealObserver?.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );

    elements.forEach((el) => this.revealObserver?.observe(el));
  }

  private setupCounters(): void {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>('[data-count]'),
    );
    if (!elements.length) {
      return;
    }

    this.counterObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }
          this.counterObserver?.unobserve(entry.target);
          this.animateCounter(entry.target as HTMLElement);
        }
      },
      { threshold: 0.5 },
    );

    elements.forEach((el) => this.counterObserver?.observe(el));
  }

  private animateCounter(element: HTMLElement): void {
    const target = Number(element.dataset['count'] ?? '0');
    const decimals = Number(element.dataset['decimals'] ?? '0');
    const prefix = element.dataset['prefix'] ?? '';
    const suffix = element.dataset['suffix'] ?? '';

    if (
      !Number.isFinite(target) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      element.textContent = `${prefix}${target.toFixed(decimals)}${suffix}`;
      return;
    }

    const duration = 1500;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = target * eased;
      element.textContent = `${prefix}${value.toFixed(decimals)}${suffix}`;
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }
}
