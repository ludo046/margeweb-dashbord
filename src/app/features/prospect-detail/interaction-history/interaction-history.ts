
import {
  Component,
  input,
  inject,
  signal,
  effect
} from '@angular/core';

import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  Interaction,
  InteractionInput,
  InteractionType,
  InteractionsService
} from '../../../core/services/interactions';

@Component({
  selector: 'app-interaction-history',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './interaction-history.html',
  styleUrl: './interaction-history.scss'
})
export class InteractionHistory {

  private readonly service = inject(InteractionsService);

  readonly prospectId = input.required<number>();

  readonly interactions = signal<Interaction[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly formOpen = signal(false);
  readonly editingId = signal<number | null>(null);

  draft: InteractionInput = this.emptyDraft();

  readonly types: {
    value: InteractionType;
    label: string;
    icon: string;
    color: string;
  }[] = [
    {
      value: 'email_sent',
      label: 'E-mail envoyé',
      icon: '↗',
      color: '#2563eb'
    },
    {
      value: 'email_received',
      label: 'E-mail reçu',
      icon: '↙',
      color: '#0284c7'
    },
    {
      value: 'call',
      label: 'Appel téléphonique',
      icon: '☎',
      color: '#087f73'
    },
    {
      value: 'follow_up',
      label: 'Relance',
      icon: '↻',
      color: '#d97706'
    },
    {
      value: 'meeting',
      label: 'Rendez-vous',
      icon: '▦',
      color: '#7c3aed'
    },
    {
      value: 'note',
      label: 'Note interne',
      icon: '✎',
      color: '#64748b'
    },
    {
      value: 'status_change',
      label: 'Changement de statut',
      icon: '⇄',
      color: '#9333ea'
    }
  ];

  constructor() {
    effect(() => {
      const id = this.prospectId();
      this.formOpen.set(false);
      this.editingId.set(null);
      void this.load(id);
    });
  }

  private emptyDraft(): InteractionInput {
    return {
      type: 'note',
      subject: '',
      content: ''
    };
  }

  getType(type: InteractionType) {
    return this.types.find(t => t.value === type);
  }

  async load(id = this.prospectId()): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const data = await this.service.findAll(id);

      if (this.prospectId() === id) {
        this.interactions.set(data);
      }
    } catch (error) {
      console.error(error);

      if (this.prospectId() === id) {
        this.error.set(
          'Impossible de récupérer les échanges.'
        );
      }
    } finally {
      if (this.prospectId() === id) {
        this.loading.set(false);
      }
    }
  }

  openForm(): void {
    this.error.set(null);
    this.editingId.set(null);
    this.draft = this.emptyDraft();
    this.formOpen.set(true);
  }

  edit(interaction: Interaction): void {
    this.error.set(null);
    this.editingId.set(interaction.id);

    this.draft = {
      type: interaction.type,
      subject: interaction.subject,
      content: interaction.content
    };

    this.formOpen.set(true);
  }

  cancel(): void {
    if (this.saving()) return;

    this.formOpen.set(false);
    this.editingId.set(null);
    this.error.set(null);
  }

  async save(): Promise<void> {
    if (!this.draft.subject.trim() || this.saving()) {
      return;
    }

    const prospectId = this.prospectId();
    const editingId = this.editingId();

    this.saving.set(true);
    this.error.set(null);

    try {
      const data = {
        ...this.draft,
        subject: this.draft.subject.trim()
      };

      if (editingId !== null) {
        await this.service.update(
          prospectId,
          editingId,
          data
        );
      } else {
        await this.service.create(prospectId, data);
      }

      if (this.prospectId() === prospectId) {
        this.formOpen.set(false);
        this.editingId.set(null);
        await this.load(prospectId);
      }

    } catch (error) {
      console.error(error);
      this.error.set(
        'Impossible d’enregistrer cet échange.'
      );
    } finally {
      this.saving.set(false);
    }
  }

  async remove(interaction: Interaction): Promise<void> {
    if (this.saving()) return;

    if (!confirm('Supprimer définitivement cet échange ?')) {
      return;
    }

    const prospectId = this.prospectId();

    this.saving.set(true);
    this.error.set(null);

    try {
      await this.service.remove(
        prospectId,
        interaction.id
      );

      if (this.prospectId() === prospectId) {
        await this.load(prospectId);
      }
    } catch (error) {
      console.error(error);
      this.error.set(
        'Impossible de supprimer cet échange.'
      );
    } finally {
      this.saving.set(false);
    }
  }
}
