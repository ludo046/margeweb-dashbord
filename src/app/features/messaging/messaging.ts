
import {
  Component,
  computed,
  inject,
  signal
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import {
  Email,
  EmailsService
} from '../../core/services/emails';

import {
  MailComposer,
  MailMode
} from '../prospect-detail/mail-composer/mail-composer';

@Component({
  selector: 'app-messaging',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    RouterLink,
    MailComposer
  ],
  templateUrl: './messaging.html',
  styleUrl: './messaging.scss'
})
export class Messaging {

  private readonly service = inject(EmailsService);

  readonly emails = this.service.emails;
  readonly unreadCount = this.service.unreadCount;
  readonly loading = this.service.loading;
  readonly syncing = this.service.syncing;
  readonly loadError = this.service.error;

  readonly search = signal('');
  readonly unreadOnly = signal(false);
  readonly selectedId = signal<number | null>(null);

  readonly error = signal<string | null>(null);
  readonly notification = signal<string | null>(null);


  readonly composerOpen = signal(false);
  readonly composerMode = signal<MailMode>('new');
  readonly composerEmail = signal<Email | null>(null);

  readonly selectedEmail = computed(() =>
    this.emails().find(
      email => email.id === this.selectedId()
    )
  );

  readonly filteredEmails = computed(() => {

    const search = this.search().trim().toLowerCase();

    return this.emails().filter(email => {

      const matchesSearch = [
        email.fromName,
        email.fromEmail,
        email.subject,
        email.textContent
      ].some(value =>
        (value || '').toLowerCase().includes(search)
      );

      const matchesUnread =
        !this.unreadOnly() || !email.isRead;

      return matchesSearch && matchesUnread;

    });
  });

  constructor() {
    void this.service.load();
  }

  async openEmail(email: Email): Promise<void> {

    this.selectedId.set(email.id);
    this.error.set(null);

    if (!email.isRead) {

      try {

        await this.service.markAsRead(email.id, true);

      } catch (error) {

        console.error(error);

        this.error.set(
          'Impossible de modifier l’état de lecture.'
        );

      }
    }
  }

  closeEmail(): void {
    this.selectedId.set(null);
  }

  async toggleRead(email: Email): Promise<void> {

    this.error.set(null);

    try {

      await this.service.markAsRead(
        email.id,
        !email.isRead
      );

    } catch (error) {

      console.error(error);

      this.error.set(
        'Impossible de modifier l’état de lecture.'
      );

    }
  }

  async refresh(): Promise<void> {
    await this.service.load();
  }

  async synchronize(): Promise<void> {

    if (this.syncing()) return;

    this.error.set(null);
    this.notification.set(null);

    try {

      const result = await this.service.sync();

      this.notification.set(
        `Synchronisation terminée : ${result.imported} nouveau(x) message(s).`
      );

    } catch (error: any) {

      this.error.set(
        error?.error?.message ||
        'Impossible de synchroniser la messagerie.'
      );

    }
  }

  newMessage(): void {

  this.composerMode.set('new');
  this.composerEmail.set(null);
  this.composerOpen.set(true);

}

replyTo(email: Email): void {

  this.composerMode.set('reply');
  this.composerEmail.set(email);
  this.composerOpen.set(true);

}

forwardEmail(email: Email): void {

  this.composerMode.set('forward');
  this.composerEmail.set(email);
  this.composerOpen.set(true);

}

closeComposer(): void {

  this.composerOpen.set(false);
  this.composerEmail.set(null);

}

onMailSent(message: string): void {

  this.closeComposer();
  this.notification.set(message);

}
}
