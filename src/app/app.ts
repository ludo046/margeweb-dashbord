import {
  Component,
  signal,
  inject,
  HostListener,
  DestroyRef
} from '@angular/core';

import {
  Router,
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
  NavigationEnd
} from '@angular/router';

import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ProspectsService } from './core/services/prospects';
import { EmailsService } from './core/services/emails';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive
  ],
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {

  protected readonly title = signal('margeweb-crm');

  // ==========================================
  // SERVICES
  // ==========================================

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly prospectsService =
    inject(ProspectsService);

  private readonly emailsService =
    inject(EmailsService);

  // ==========================================
  // COMPTEURS
  // ==========================================

  readonly urgentFollowUpCount =
    this.prospectsService.urgentFollowUpCount;

  readonly unreadEmailCount =
    this.emailsService.unreadCount;

  // ==========================================
  // NAVIGATION RESPONSIVE
  // ==========================================

  readonly mobileMenuOpen = signal(false);

  private readonly mobileBreakpoint = 1024;

  constructor() {

    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.closeMobileMenu();
      });

  }

  // ==========================================
  // GESTION DU MENU MOBILE
  // ==========================================

  toggleMobileMenu(): void {

    this.mobileMenuOpen.update(open => !open);

  }

  openMobileMenu(): void {

    this.mobileMenuOpen.set(true);

  }

  closeMobileMenu(): void {

    this.mobileMenuOpen.set(false);

  }

  // ==========================================
  // RACCOURCIS CLAVIER
  // ==========================================

  @HostListener('document:keydown.escape')
  onEscape(): void {

    this.closeMobileMenu();

  }

  // ==========================================
  // REDIMENSIONNEMENT DE LA FENETRE
  // ==========================================

  @HostListener('window:resize')
  onWindowResize(): void {

    if (window.innerWidth > this.mobileBreakpoint) {

      this.closeMobileMenu();

    }

  }

}