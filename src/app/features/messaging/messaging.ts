
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
  Draft,
  DraftsService
} from '../../core/services/drafts';

import {
  MailComposer,
  MailMode
} from '../prospect-detail/mail-composer/mail-composer';

type MessagingFolder = MailFolder | 'DRAFTS';

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
  private readonly draftsService = inject(DraftsService);

  private readonly storageKey =
    'margeweb-crm-messaging-folder';

  readonly activeFolder = signal<MessagingFolder>(
    this.restoreFolder()
  );

  readonly emails = this.service.emails;
  readonly unreadCount = this.service.unreadCount;
  readonly syncing = this.service.syncing;

  readonly drafts = this.draftsService.drafts;
  readonly draftCount = this.draftsService.count;

  readonly search = signal('');
  readonly unreadOnly = signal(false);

  readonly selectedId = signal<number | null>(null);
  readonly selectedDraftId = signal<number | null>(null);

  readonly error = signal<string | null>(null);
  readonly notification = signal<string | null>(null);
  readonly warning = signal<string | null>(null);

  readonly composerOpen = signal(false);
  readonly composerMode = signal<MailMode>('new');
  readonly composerEmail = signal<Email | null>(null);
  readonly composerDraft = signal<Draft | null>(null);

  readonly openingDraft = signal(false);
  readonly deletingDraft = signal(false);

  readonly isSentFolder = computed(() =>
    this.activeFolder() === 'SENT'
  );

  readonly isDraftFolder = computed(() =>
    this.activeFolder() === 'DRAFTS'
  );

  readonly isInboxFolder = computed(() =>
    this.activeFolder() === 'INBOX'
  );

  readonly loading = computed(() =>
    this.isDraftFolder()
      ? this.draftsService.loading()
      : this.service.loading()
  );

  readonly loadError = computed(() =>
    this.isDraftFolder()
      ? this.draftsService.error()
      : this.service.error()
  );

  readonly folderTitle = computed(() => {

    switch (this.activeFolder()) {

      case 'DRAFTS':
        return 'Brouillons';

      case 'SENT':
        return 'Messages envoyés';

      default:
        return 'Boîte de réception';

    }

  });

  readonly selectedEmail = computed(() => {

    if (this.isDraftFolder()) return undefined;

    return this.emails().find(
      email => email.id === this.selectedId()
    );

  });

  readonly selectedDraft = computed(() => {

    if (!this.isDraftFolder()) return undefined;

    return this.drafts().find(
      draft => draft.id === this.selectedDraftId()
    );

  });

  readonly filteredEmails = computed(() => {

  const search = this.search().trim().toLowerCase();

  return this.emails().filter(email => {

    const matchesSearch = [
      email.fromName,
      email.fromEmail,
      email.toEmail,
      email.subject,
      email.textContent,
      email.client?.name,
      email.prospect?.name
    ].some(value =>
      (value || '').toLowerCase().includes(search)
    );

    const matchesUnread =
      !this.isInboxFolder() ||
      !this.unreadOnly() ||
      !email.isRead;

    return matchesSearch && matchesUnread;

  });

});

readonly filteredDrafts = computed(() => {

  const search = this.search().trim().toLowerCase();

  return this.drafts().filter(draft => {

    return [
      draft.toEmail,
      draft.subject,
      draft.content,
      draft.client?.name,
      draft.prospect?.name
    ].some(value =>
      (value || '').toLowerCase().includes(search)
    );

  });

});

  constructor() {

    void this.refresh();

    void this.draftsService.loadCount();

  }

  // Mémorisation du dossier actif

  private restoreFolder(): MessagingFolder {

    try {

      const folder = localStorage.getItem(
        this.storageKey
      );

      if (
        folder === 'INBOX' ||
        folder === 'SENT' ||
        folder === 'DRAFTS'
      ) {
        return folder;
      }

    } catch (error) {

      console.warn(
        'Impossible de restaurer le dossier.',
        error
      );

    }

    return this.service.activeFolder();

  }

  private saveFolder(folder: MessagingFolder): void {

    try {

      localStorage.setItem(
        this.storageKey,
        folder
      );

    } catch (error) {

      console.warn(
        'Impossible de mémoriser le dossier.',
        error
      );

    }

  }

  async changeFolder(
    folder: MessagingFolder
  ): Promise<void> {

    if (
      folder === this.activeFolder() ||
      this.composerOpen() ||
      this.openingDraft() ||
      this.deletingDraft()
    ) {
      return;
    }

    this.selectedId.set(null);
    this.selectedDraftId.set(null);

    this.search.set('');
    this.unreadOnly.set(false);

    this.error.set(null);
    this.notification.set(null);
    this.warning.set(null);

    this.activeFolder.set(folder);
    this.saveFolder(folder);

    await this.refresh();

  }

  // Messages reçus et envoyés

  correspondent(email: Email): string {

    if (email.folder === 'SENT') {

      return email.toEmail ||
        'Destinataire inconnu';

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

        await this.service.markAsRead(
          email.id,
          true
        );

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

  // Brouillons

  draftModeLabel(mode: MailMode): string {

  switch (mode) {

    case 'client':
      return 'Message client';

    case 'prospect':
      return 'Message prospect';

    case 'reply':
      return 'Réponse';

    case 'forward':
      return 'Transfert';

    default:
      return 'Nouveau message';

  }

}

  selectDraft(draft: Draft): void {

    this.selectedDraftId.set(draft.id);
    this.error.set(null);

  }

  closeDraft(): void {

    this.selectedDraftId.set(null);

  }

  async editDraft(draft: Draft): Promise<void> {

    if (
      this.openingDraft() ||
      this.composerOpen() ||
      this.deletingDraft()
    ) {
      return;
    }

    this.openingDraft.set(true);
    this.error.set(null);

    try {

      const currentDraft =
        await this.draftsService.findById(draft.id);

      this.composerDraft.set(currentDraft);
      this.composerMode.set(currentDraft.mode);
      this.composerEmail.set(null);

      this.composerOpen.set(true);

    } catch (error) {

      console.error(error);

      this.error.set(
        'Impossible d’ouvrir ce brouillon.'
      );

    } finally {

      this.openingDraft.set(false);

    }

  }

  async deleteDraft(draft: Draft): Promise<void> {

    if (
      this.deletingDraft() ||
      this.openingDraft() ||
      this.composerOpen()
    ) {
      return;
    }

    if (!confirm(
      'Supprimer définitivement ce brouillon ?'
    )) {
      return;
    }

    this.deletingDraft.set(true);

    this.error.set(null);
    this.notification.set(null);

    try {

      await this.draftsService.remove(draft.id);

      if (this.selectedDraftId() === draft.id) {

        this.selectedDraftId.set(null);

      }

      this.notification.set(
        'Brouillon supprimé.'
      );

    } catch (error) {

      console.error(error);

      this.error.set(
        'Impossible de supprimer ce brouillon.'
      );

    } finally {

      this.deletingDraft.set(false);

    }

  }

  // Actualisation

  async refresh(): Promise<void> {

    const folder = this.activeFolder();

    if (folder === 'DRAFTS') {

      await this.draftsService.load();

      if (
        this.selectedDraftId() !== null &&
        !this.selectedDraft()
      ) {

        this.selectedDraftId.set(null);

      }

    } else {

      await this.service.load(folder);

    }

    await this.draftsService.loadCount();

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

      if (this.isDraftFolder()) {

        await this.draftsService.load();

      }

      await this.draftsService.loadCount();

    } catch (error: any) {

      this.error.set(
        error?.error?.message ||
        'Impossible de synchroniser la messagerie.'
      );

    }

  }

  // Compositeur

  newMessage(): void {

    if (
      this.composerOpen() ||
      this.openingDraft()
    ) {
      return;
    }

    this.composerMode.set('new');
    this.composerEmail.set(null);
    this.composerDraft.set(null);

    this.composerOpen.set(true);

  }

  replyTo(email: Email): void {

    if (
      email.folder !== 'INBOX' ||
      this.composerOpen()
    ) {
      return;
    }

    this.composerMode.set('reply');
    this.composerEmail.set(email);
    this.composerDraft.set(null);

    this.composerOpen.set(true);

  }

  forwardEmail(email: Email): void {

    if (this.composerOpen()) return;

    this.composerMode.set('forward');
    this.composerEmail.set(email);
    this.composerDraft.set(null);

    this.composerOpen.set(true);

  }

  closeComposer(): void {

    this.composerOpen.set(false);
    this.composerEmail.set(null);
    this.composerDraft.set(null);

    if (this.isDraftFolder()) {

      void this.refresh();

    } else {

      void this.draftsService.loadCount();

    }

  }

  onMailSent(message: string): void {

    this.closeComposer();

    this.error.set(null);
    this.warning.set(null);

    this.notification.set(message);

  }

}
