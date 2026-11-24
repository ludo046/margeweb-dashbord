
import {
  Component,
  input,
  output,
  inject,
  signal
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Prospect } from '../../../core/services/prospects';
import { MailService } from '../../../core/services/mail';

@Component({
  selector: 'app-mail-composer',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './mail-composer.html',
  styleUrl: './mail-composer.scss'
})
export class MailComposer {

  private readonly service = inject(MailService);

  readonly prospect = input.required<Prospect>();

  readonly closed = output<void>();
  readonly sent = output<string>();

  readonly sending = signal(false);
  readonly error = signal<string | null>(null);

  subject = '';
  content = '';

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
      !this.subject.trim() ||
      !this.content.trim()
    ) {
      return;
    }

    if (!confirm(
      `Envoyer cet e-mail à ${this.prospect().email} ?`
    )) {
      return;
    }

    this.sending.set(true);
    this.error.set(null);

    try {

      const result = await this.service.sendToProspect(
        this.prospect().id,
        {
          subject: this.subject.trim(),
          content: this.content.trim()
        }
      );

      this.sent.emit(
        result.warning || 'E-mail accepté par le serveur SMTP.'
      );

    } catch (error) {

      console.error(error);

      this.error.set(
        'Envoi non confirmé. Vérifie avant de réessayer pour éviter un doublon.'
      );

    } finally {

      this.sending.set(false);

    }
  }
}
