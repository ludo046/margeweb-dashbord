import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { inject } from '@angular/core';
import { ProspectsService } from './core/services/prospects';
import { EmailsService } from './core/services/emails';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('margeweb-crm');
  private readonly prospectsService = inject(ProspectsService);

  readonly urgentFollowUpCount =
  this.prospectsService.urgentFollowUpCount;

  private readonly emailsService = inject(EmailsService);
  readonly unreadEmailCount = this.emailsService.unreadCount;
}
