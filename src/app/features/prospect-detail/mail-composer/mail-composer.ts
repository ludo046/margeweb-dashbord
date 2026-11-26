import {
  Component,
  input,
  output,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy
} from '@angular/core';

import { FormsModule } from '@angular/forms';

import { Prospect } from '../../../core/services/prospects';

import {
  Client,
  ClientsService
} from '../../../core/services/clients';

import { MailService } from '../../../core/services/mail';
import { Email } from '../../../core/services/emails';

import {
  Draft,
  DraftInput,
  DraftMode,
  DraftsService
} from '../../../core/services/drafts';

export type MailMode = DraftMode;

type SaveState =
  'idle' |
  'pending' |
  'saving' |
  'saved' |
  'error';

@Component({
  selector: 'app-mail-composer',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './mail-composer.html',
  styleUrl: './mail-composer.scss'
})
export class MailComposer implements OnInit, OnDestroy {

  private readonly service = inject(MailService);
  private readonly draftsService = inject(DraftsService);
  private readonly clientsService = inject(ClientsService);

  readonly mode = input<MailMode>('prospect');

  readonly prospect = input<Prospect | null>(null);
  readonly client = input<Client | null>(null);

  readonly originalEmail = input<Email | null>(null);
  readonly draft = input<Draft | null>(null);

  readonly closed = output<void>();
  readonly sent = output<string>();

  readonly sending = signal(false);
  readonly closing = signal(false);
  readonly deleting = signal(false);

  readonly sendConfirmed = signal(false);

  readonly error = signal<string | null>(null);

  readonly draftId = signal<number | null>(null);
  readonly saveState = signal<SaveState>('idle');
  readonly savedAt = signal<Date | null>(null);

  private saveTimer:
    ReturnType<typeof setTimeout> | null = null;

  private savePromise: Promise<boolean> | null = null;

  private revision = 0;
  private savedRevision = 0;
  private destroyed = false;

  recipient = '';
  subject = '';
  content = '';

  // Mode de rédaction

  readonly effectiveMode = computed<MailMode>(() => {

    const draft = this.draft();

    if (draft) {

      // Un prospect converti devient un client

      if (
        draft.mode === 'prospect' &&
        draft.clientId !== null &&
        draft.clientId !== undefined
      ) {
        return 'client';
      }

      if (
        draft.mode === 'prospect' &&
        !draft.prospect
      ) {
        return 'new';
      }

      if (
        draft.mode === 'reply' &&
        draft.originalEmail?.folder !== 'INBOX'
      ) {
        return 'new';
      }

      return draft.mode;

    }

    return this.mode();

  });

  // Prospect associé

  readonly effectiveProspectId = computed(() => {

    const draft = this.draft();

    if (draft) {
      return draft.prospectId ?? null;
    }

    return (
      this.prospect()?.id ??
      this.client()?.prospectId ??
      this.originalEmail()?.prospectId ??
      null
    );

  });

  // Client associé

  readonly effectiveClientId = computed(() => {

    const draft = this.draft();

    if (draft) {
      return draft.clientId ?? null;
    }

    return (
      this.client()?.id ??
      this.originalEmail()?.clientId ??
      null
    );

  });

  // Message original

  readonly effectiveOriginalEmail = computed(() =>
    this.draft()
      ? this.draft()?.originalEmail ?? null
      : this.originalEmail()
  );

  // État du formulaire

  readonly busy = computed(() =>
    this.sending() ||
    this.closing() ||
    this.deleting()
  );

  // Titre de la fenêtre

  readonly title = computed(() => {

    switch (this.effectiveMode()) {

      case 'reply':
        return 'Répondre au message';

      case 'forward':
        return 'Transférer le message';

      case 'client':
        return this.draft()
          ? 'Modifier le brouillon client'
          : 'Nouveau message client';

      default:
        return this.draft()
          ? 'Modifier le brouillon'
          : 'Nouveau message';

    }

  });

  // Verrouillage du destinataire

  readonly recipientLocked = computed(() =>
    this.effectiveMode() === 'prospect' ||
    this.effectiveMode() === 'client' ||
    this.effectiveMode() === 'reply'
  );

  // État du client

  readonly clientArchived = computed(() =>
    this.effectiveMode() === 'client' &&
    (
      this.draft()?.client?.status === 'Archivé' ||
      this.client()?.status === 'Archivé'
    )
  );

  // Indicateur de sauvegarde

  readonly saveLabel = computed(() => {

    switch (this.saveState()) {

      case 'pending':
        return 'Modifications non enregistrées';

      case 'saving':
        return 'Enregistrement en cours...';

      case 'saved': {

        const date = this.savedAt();

        return date
          ? `Brouillon enregistré à ${date.toLocaleTimeString(
              'fr-FR',
              {
                hour: '2-digit',
                minute: '2-digit'
              }
            )}`
          : 'Brouillon enregistré';

      }

      case 'error':
        return 'Échec de la sauvegarde';

      default:
        return 'Sauvegarde automatique activée';

    }

  });

  // Initialisation

  ngOnInit(): void {

    const draft = this.draft();

    // Réouverture d'un brouillon existant

    if (draft) {

      this.draftId.set(draft.id);

      this.recipient = draft.toEmail;
      this.subject = draft.subject;
      this.content = draft.content;

      if (
        this.effectiveMode() === 'prospect' &&
        draft.prospect
      ) {

        this.recipient = draft.prospect.email || '';

      }

      if (
        this.effectiveMode() === 'client' &&
        draft.client
      ) {

        this.recipient = draft.client.email || '';

      }

      if (
        this.effectiveMode() === 'reply' &&
        draft.originalEmail
      ) {

        this.recipient = draft.originalEmail.fromEmail;

      }

      this.savedAt.set(new Date(draft.updatedAt));
      this.saveState.set('saved');

      if (this.clientArchived()) {

        this.error.set(
          'Ce client est archivé. Réactivez-le avant de lui envoyer un message.'
        );

      } else if (
        this.effectiveMode() === 'client' &&
        !draft.client
      ) {

        this.error.set(
          'Impossible de récupérer les informations du client.'
        );

      } else if (
        this.recipient !== draft.toEmail
      ) {

        this.error.set(
          'L’adresse du destinataire a changé depuis la création du brouillon. Vérifiez-la avant l’envoi.'
        );

      }

      if (
        this.recipient !== draft.toEmail ||
        this.effectiveMode() !== draft.mode
      ) {

        this.onFieldChange();

      }

      return;

    }

    const prospect = this.prospect();
    const client = this.client();
    const email = this.originalEmail();

    // Nouveau message depuis un prospect

    if (this.mode() === 'prospect' && prospect) {

      this.recipient = prospect.email || '';

    }

    // Nouveau message depuis un client

    if (this.mode() === 'client' && client) {

      this.recipient = client.email || '';

      if (client.status === 'Archivé') {

        this.error.set(
          'Ce client est archivé. Réactivez-le avant de lui envoyer un message.'
        );

      }

    }

    // Réponse à un message

    if (this.mode() === 'reply' && email) {

      this.recipient = email.fromEmail;

      this.subject = /^re:/i.test(email.subject)
        ? email.subject
        : `Re: ${email.subject}`;

      this.content =
        '\n\n' + this.quoteOriginal(email);

      this.revision++;

    }

    // Transfert d'un message

    if (this.mode() === 'forward' && email) {

      this.subject = /^tr:/i.test(email.subject)
        ? email.subject
        : `Tr: ${email.subject}`;

      this.content =
        '\n\n' + this.quoteOriginal(email);

      this.revision++;

    }

  }

  // Citation du message original

  private quoteOriginal(email: Email): string {

    const date = new Date(
      email.receivedAt
    ).toLocaleString('fr-FR');

    return [
      '---------- Message original ----------',
      `De : ${email.fromName} <${email.fromEmail}>`,
      `Date : ${date}`,
      `À : ${email.toEmail}`,
      `Objet : ${email.subject}`,
      '',
      email.textContent || ''
    ].join('\n');

  }

  // Données du brouillon

  private getDraftData(): DraftInput {

    return {

      mode: this.effectiveMode(),

      toEmail: this.recipient,
      subject: this.subject,
      content: this.content,

      prospectId: this.effectiveProspectId(),
      clientId: this.effectiveClientId(),

      originalEmailId:
        this.effectiveOriginalEmail()?.id ?? null

    };

  }

  // Vérifier si le brouillon contient des données

  private hasContent(): boolean {

    return Boolean(
      this.recipient.trim() ||
      this.subject.trim() ||
      this.content.trim()
    );

  }

  // Annuler le délai de sauvegarde

  private clearSaveTimer(): void {

    if (this.saveTimer !== null) {

      clearTimeout(this.saveTimer);
      this.saveTimer = null;

    }

  }

  // Déclenchement de la sauvegarde automatique

  onFieldChange(): void {

    if (
      this.busy() ||
      this.destroyed ||
      this.sendConfirmed()
    ) {
      return;
    }

    this.revision++;

    this.saveState.set('pending');

    this.clearSaveTimer();

    this.saveTimer = setTimeout(() => {

      this.saveTimer = null;

      void this.saveDraft();

    }, 2000);

  }

  // Une seule sauvegarde simultanée

  async saveDraft(): Promise<boolean> {

    this.clearSaveTimer();

    if (this.sendConfirmed()) {
      return true;
    }

    if (this.savePromise) {

      const success = await this.savePromise;

      if (!success) return false;

      if (this.savedRevision === this.revision) {
        return true;
      }

      return this.saveDraft();

    }

    if (this.savedRevision === this.revision) {
      return true;
    }

    if (!this.draftId() && !this.hasContent()) {

      this.savedRevision = this.revision;
      this.saveState.set('idle');

      return true;

    }

    const currentRevision = this.revision;
    const data = this.getDraftData();

    const promise = this.persistDraft(
      data,
      currentRevision
    );

    this.savePromise = promise;

    try {

      return await promise;

    } finally {

      if (this.savePromise === promise) {

        this.savePromise = null;

      }

    }

  }

  // Enregistrement dans la base de données

  private async persistDraft(
    data: DraftInput,
    revision: number
  ): Promise<boolean> {

    this.saveState.set('saving');

    try {

      const id = this.draftId();

      const draft = id !== null

        ? await this.draftsService.update(id, data)

        : await this.draftsService.create(data);

      this.draftId.set(draft.id);

      this.savedRevision = revision;

      this.savedAt.set(new Date(draft.updatedAt));

      this.saveState.set(
        this.savedRevision === this.revision
          ? 'saved'
          : 'pending'
      );

      return true;

    } catch (error) {

      console.error(error);

      this.saveState.set('error');

      return false;

    }

  }

  // Sauvegarde avant fermeture

  async close(): Promise<void> {

    if (this.busy()) return;

    if (this.sendConfirmed()) {

      this.closed.emit();
      return;

    }

    this.closing.set(true);
    this.error.set(null);

    try {

      const success = await this.saveDraft();

      if (!success) {

        this.error.set(
          'Impossible de sauvegarder le brouillon. Le message reste ouvert.'
        );

        return;

      }

      this.closed.emit();

    } finally {

      this.closing.set(false);

    }

  }

  // Abandon volontaire du brouillon

  async discard(): Promise<void> {

    if (this.busy()) return;

    if (!confirm(
      'Supprimer définitivement ce brouillon ?'
    )) {
      return;
    }

    this.deleting.set(true);
    this.error.set(null);

    this.clearSaveTimer();

    try {

      if (this.savePromise) {

        await this.savePromise;

      }

      const id = this.draftId();

      if (id !== null) {

        await this.draftsService.remove(id);

        this.draftId.set(null);

      }

      this.closed.emit();

    } catch (error) {

      console.error(error);

      this.error.set(
        'Impossible de supprimer le brouillon.'
      );

    } finally {

      this.deleting.set(false);

    }

  }

  // Vérifier les informations du client avant envoi

  private async verifyClientRecipient(
    clientId: number
  ): Promise<boolean> {

    const client = await this.clientsService.getById(
      clientId
    );

    if (client.status === 'Archivé') {

      this.error.set(
        'Ce client est archivé. Réactivez-le avant de lui envoyer un message.'
      );

      return false;

    }

    const currentEmail = client.email?.trim() || '';

    if (!currentEmail) {

      this.error.set(
        'Ce client ne possède pas d’adresse e-mail.'
      );

      return false;

    }

    if (
      currentEmail.toLowerCase() !==
      this.recipient.trim().toLowerCase()
    ) {

      this.recipient = currentEmail;

      this.revision++;

      await this.saveDraft();

      this.error.set(
        'L’adresse e-mail du client a changé. Vérifiez le nouveau destinataire avant de confirmer à nouveau l’envoi.'
      );

      return false;

    }

    return true;

  }

  // Envoi du message

  async send(): Promise<void> {

    if (
      this.busy() ||
      this.sendConfirmed() ||
      !this.subject.trim() ||
      !this.content.trim()
    ) {
      return;
    }

    const mode = this.effectiveMode();

    const prospectId = this.effectiveProspectId();
    const clientId = this.effectiveClientId();

    const originalEmail = this.effectiveOriginalEmail();

    if (mode === 'prospect' && prospectId === null) {

      this.error.set('Prospect introuvable.');
      return;

    }

    if (mode === 'client' && clientId === null) {

      this.error.set('Client introuvable.');
      return;

    }

    if (mode === 'reply' && !originalEmail) {

      this.error.set('Message original introuvable.');
      return;

    }

    this.sending.set(true);
    this.error.set(null);

    try {

      // Vérifier l'adresse actuelle du client

      if (mode === 'client' && clientId !== null) {

        const valid = await this.verifyClientRecipient(
          clientId
        );

        if (!valid) return;

      }

      if (!this.recipient.trim()) {

        this.error.set(
          'Aucune adresse e-mail renseignée.'
        );

        return;

      }

      // Confirmation avant envoi

      if (!confirm(
        `Envoyer cet e-mail à ${this.recipient} ?`
      )) {
        return;
      }

      // Sauvegarder avant de tenter l'envoi

      const saved = await this.saveDraft();

      if (!saved) {

        this.error.set(
          'Impossible de sauvegarder le brouillon avant envoi.'
        );

        return;

      }

      const data = {

        subject: this.subject.trim(),
        content: this.content.trim()

      };

      let result;

      // Envoi depuis un prospect

      if (
        mode === 'prospect' &&
        prospectId !== null
      ) {

        result = await this.service.sendToProspect(
          prospectId,
          data
        );

      // Envoi depuis un client

      } else if (
        mode === 'client' &&
        clientId !== null
      ) {

        result = await this.service.sendToClient(
          clientId,
          data
        );

      // Réponse à un message

      } else if (
        mode === 'reply' &&
        originalEmail
      ) {

        result = await this.service.reply(
          originalEmail.id,
          data
        );

      // Nouveau message ou transfert

      } else {

        result = await this.service.sendNew({

          to: this.recipient.trim(),

          ...data

        });

      }

      if (!result.success) {

        this.error.set(
          result.message ||
          'Le serveur n’a pas confirmé l’envoi.'
        );

        return;

      }

      // L'envoi est confirmé

      this.sendConfirmed.set(true);

      this.clearSaveTimer();

      let message =
        result.warning ||
        result.message ||
        'E-mail accepté par le serveur SMTP.';

      // Supprimer le brouillon après envoi

      const id = this.draftId();

      if (id !== null) {

        try {

          await this.draftsService.remove(id);

          this.draftId.set(null);

        } catch (error) {

          console.error(error);

          message +=
            ' Attention : le brouillon n’a pas pu être supprimé. Ne renvoyez pas ce message.';

        }

      }

      this.sent.emit(message);

    } catch (error: any) {

      console.error(error);

      if ([400, 404, 409].includes(error?.status)) {

        this.error.set(

          error?.error?.message ||
          'Impossible d’envoyer le message.'

        );

      } else {

        this.error.set(

          'Envoi non confirmé. Vérifiez avant de réessayer pour éviter un doublon.'

        );

      }

    } finally {

      this.sending.set(false);

    }

  }

  // Nettoyage du composant

  ngOnDestroy(): void {

    this.destroyed = true;

    this.clearSaveTimer();

  }

}