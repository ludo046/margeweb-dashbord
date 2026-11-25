
import {
  Component,
  input,
  output,
  inject,
  signal,
  computed,
  OnInit
} from '@angular/core';

import { FormsModule } from '@angular/forms';

import { Prospect } from '../../../core/services/prospects';
import { MailService } from '../../../core/services/mail';
import { Email } from '../../../core/services/emails';

export type MailMode =
  'prospect' | 'new' | 'reply' | 'forward';

@Component({
  selector: 'app-mail-composer',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './mail-composer.html',
  styleUrl: './mail-composer.scss'
})
export class MailComposer implements OnInit {

  private readonly service = inject(MailService);

  readonly mode = input<MailMode>('prospect');
  readonly prospect = input<Prospect | null>(null);
  readonly originalEmail = input<Email | null>(null);

  readonly closed = output<void>();
  readonly sent = output<string>();

  readonly sending = signal(false);
  readonly error = signal<string | null>(null);

  recipient = '';
  subject = '';
  content = '';

  readonly title = computed(() => {

    switch (this.mode()) {

      case 'reply':
        return 'Répondre au message';

      case 'forward':
        return 'Transférer le message';

      default:
        return 'Nouveau message';
    }
  });

  readonly recipientLocked = computed(() =>
    this.mode() === 'prospect' ||
    this.mode() === 'reply'
  );

  ngOnInit(): void {

    const prospect = this.prospect();
    const email = this.originalEmail();

    if (this.mode() === 'prospect' && prospect) {

      this.recipient = prospect.email || '';

    }

    if (this.mode() === 'reply' && email) {

      this.recipient = email.fromEmail;

      this.subject = /^re:/i.test(email.subject)
        ? email.subject
        : `Re: ${email.subject}`;

      this.content =
        '\n\n' + this.quoteOriginal(email);

    }

    if (this.mode() === 'forward' && email) {

      this.subject = /^tr:/i.test(email.subject)
        ? email.subject
        : `Tr: ${email.subject}`;

      this.content =
        '\n\n' + this.quoteOriginal(email);

    }
  }

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

  close(): void {

    if (this.sending()) return;

    if (
      (this.subject.trim() || this.content.trim()) &&
      !confirm('Abandonner cet e-mail ?')
    ) {
      return;
    }

    this.closed.emit();
  }

  async send(): Promise<void> {

    if (
      this.sending() ||
      !this.recipient.trim() ||
      !this.subject.trim() ||
      !this.content.trim()
    ) {
      return;
    }

    const prospect = this.prospect();
    const originalEmail = this.originalEmail();

    if (this.mode() === 'prospect' && !prospect) {
      this.error.set('Prospect introuvable.');
      return;
    }

    if (this.mode() === 'reply' && !originalEmail) {
      this.error.set('Message original introuvable.');
      return;
    }

    if (!confirm(
      `Envoyer cet e-mail à ${this.recipient} ?`
    )) {
      return;
    }

    this.sending.set(true);
    this.error.set(null);

    const data = {
      subject: this.subject.trim(),
      content: this.content.trim()
    };

    try {

      let result;

      if (this.mode() === 'prospect' && prospect) {

        result = await this.service.sendToProspect(
          prospect.id,
          data
        );

      } else if (
        this.mode() === 'reply' && originalEmail
      ) {

        result = await this.service.reply(
          originalEmail.id,
          data
        );

      } else {

        result = await this.service.sendNew({
          to: this.recipient.trim(),
          ...data
        });

      }

      this.sent.emit(
        result.warning ||
        result.message ||
        'E-mail accepté par le serveur SMTP.'
      );

    } catch (error: any) {

      console.error(error);

      if ([400, 404, 503].includes(error?.status)) {

        this.error.set(
          error?.error?.message ||
          'Impossible d’envoyer le message.'
        );

      } else {

        this.error.set(
          'Envoi non confirmé. Vérifie avant de réessayer pour éviter un doublon.'
        );

      }

    } finally {

      this.sending.set(false);

    }
  }
}
