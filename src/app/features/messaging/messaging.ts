
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
  EmailsService,
  MailFolder
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
  readonly activeFolder = this.service.activeFolder;

  readonly search = signal('');
  readonly unreadOnly = signal(false);
  readonly selectedId = signal<number | null>(null);

  readonly error = signal<string | null>(null);
  readonly notification = signal<string | null>(null);
  readonly warning = signal<string | null>(null);

  readonly composerOpen = signal(false);
  readonly composerMode = signal<MailMode>('new');
  readonly composerEmail = signal<Email | null>(null);

  readonly isSentFolder = computed(() =>
    this.activeFolder() === 'SENT'
  );

  readonly folderTitle = computed(() =>
    this.isSentFolder()
      ? 'Messages envoyés'
      : 'Boîte de réception'
  );

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
        email.toEmail,
        email.subject,
        email.textContent
      ].some(value =>
        (value || '').toLowerCase().includes(search)
      );

      const matchesUnread =
        this.isSentFolder() ||
        !this.unreadOnly() ||
        !email.isRead;

      return matchesSearch && matchesUnread;

    });
  });

  constructor() {
    void this.service.load();
  }

  async changeFolder(folder: MailFolder): Promise<void> {

    if (folder === this.activeFolder()) return;

    this.selectedId.set(null);
    this.search.set('');
    this.unreadOnly.set(false);
    this.error.set(null);
    this.notification.set(null);
    this.warning.set(null);

    await this.service.load(folder);
  }

  correspondent(email: Email): string {

    if (email.folder === 'SENT') {
      return email.toEmail || 'Destinataire inconnu';
    }

    return email.fromName ||
      email.fromEmail ||
      'Expéditeur inconnu';
  }

  async openEmail(email: Email): Promise<void> {

    this.selectedId.set(email.id);
    this.error.set(null);

    if (email.folder === 'INBOX' && !email.isRead) {

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

    if (email.folder !== 'INBOX') return;

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

    await this.service.load(this.activeFolder());

  }

  async synchronize(): Promise<void> {

    if (this.syncing()) return;

    this.error.set(null);
    this.notification.set(null);
    this.warning.set(null);

    try {

      const result = await this.service.sync();

      const received =
        result.folders?.['INBOX']?.imported || 0;

      const sent =
        result.folders?.['SENT']?.imported || 0;

      if (result.folders) {

        this.notification.set(
          `Synchronisation terminée : ${received} reçu(s), ${sent} envoyé(s).`
        );

      } else {

        this.notification.set(
          `Synchronisation terminée : ${result.imported} nouveau(x) message(s).`
        );

      }

      if (result.warnings?.length) {

        this.warning.set(
          result.warnings.join(' ')
        );

      }

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

    if (email.folder !== 'INBOX') return;

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
    this.error.set(null);
    this.warning.set(null);
    this.notification.set(message);

  }
}
