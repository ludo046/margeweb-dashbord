import {
  Component,
  input,
  inject,
  signal,
  effect,
  computed
} from '@angular/core';

import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import {
  Interaction,
  InteractionInput,
  InteractionType,
  InteractionOwner,
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

  readonly prospectId = input<number | null>(null);
  readonly clientId = input<number | null>(null);
  readonly readOnly = input(false);

  readonly interactions = signal<Interaction[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly formOpen = signal(false);
  readonly editingId = signal<number | null>(null);

  private loadVersion = 0;

  draft: InteractionInput = this.emptyDraft();

  readonly owner = computed<InteractionOwner | null>(() => {

    const clientId = this.clientId();
    const prospectId = this.prospectId();

    if (clientId !== null) {
      return {
        type: 'client',
        id: clientId
      };
    }

    if (prospectId !== null) {
      return {
        type: 'prospect',
        id: prospectId
      };
    }

    return null;

  });

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

  readonly manualTypes = computed(() => {

    const allowed: InteractionType[] = [
      'note',
      'call',
      'meeting'
    ];

    if (
      this.owner()?.type === 'prospect' &&
      this.editingId() === null
    ) {
      allowed.push('follow_up');
    }

    return this.types.filter(type =>
      allowed.includes(type.value)
    );

  });

  constructor() {

    effect(() => {

      const owner = this.owner();

      this.formOpen.set(false);
      this.editingId.set(null);
      this.interactions.set([]);
      this.error.set(null);

      if (owner) {

        void this.load(owner);

      } else {

        this.loadVersion++;
        this.loading.set(false);

      }

    });

    effect(() => {

      if (this.readOnly()) {

        this.formOpen.set(false);
        this.editingId.set(null);

      }

    });

  }

  private emptyDraft(): InteractionInput {

    return {
      type: 'note',
      subject: '',
      content: ''
    };

  }

  private isCurrentOwner(owner: InteractionOwner): boolean {

    const current = this.owner();

    return (
      current?.id === owner.id &&
      current?.type === owner.type
    );

  }

  private getErrorMessage(
    error: unknown,
    fallback: string
  ): string {

    if (
      error instanceof HttpErrorResponse &&
      typeof error.error?.message === 'string'
    ) {
      return error.error.message;
    }

    return fallback;

  }

  getType(type: InteractionType) {

    return this.types.find(t => t.value === type);

  }

  isAutomatic(interaction: Interaction): boolean {

    if (
      interaction.type === 'note' &&
      interaction.subject === 'Conversion en client' &&
      interaction.clientId != null &&
      interaction.prospectId != null
    ) {
      return true;
    }

    return ![
      'note',
      'call',
      'meeting'
    ].includes(interaction.type);

  }

  canEdit(interaction: Interaction): boolean {

    return (
      this.owner() !== null &&
      !this.readOnly() &&
      !this.isAutomatic(interaction)
    );

  }

  async load(
    owner = this.owner()
  ): Promise<void> {

    if (!owner) return;

    const version = ++this.loadVersion;

    this.loading.set(true);
    this.error.set(null);

    try {

      const data = await this.service.findAll(owner);

      if (
        this.isCurrentOwner(owner) &&
        version === this.loadVersion
      ) {

        this.interactions.set(data);

      }

    } catch (error) {

      console.error(error);

      if (
        this.isCurrentOwner(owner) &&
        version === this.loadVersion
      ) {

        this.error.set(
          this.getErrorMessage(
            error,
            'Impossible de récupérer les échanges.'
          )
        );

      }

    } finally {

      if (
        this.isCurrentOwner(owner) &&
        version === this.loadVersion
      ) {

        this.loading.set(false);

      }

    }

  }

  openForm(): void {

    if (
      this.readOnly() ||
      !this.owner() ||
      this.saving() ||
      this.loading()
    ) return;

    this.error.set(null);
    this.editingId.set(null);
    this.draft = this.emptyDraft();
    this.formOpen.set(true);

  }

  edit(interaction: Interaction): void {

    if (
      !this.canEdit(interaction) ||
      this.saving() ||
      this.formOpen()
    ) return;

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
    this.draft = this.emptyDraft();

  }

  async save(): Promise<void> {

    const owner = this.owner();

    if (
      !owner ||
      this.readOnly() ||
      !this.formOpen() ||
      !this.draft.subject.trim() ||
      this.saving()
    ) return;

    if (
      !this.manualTypes().some(
        type => type.value === this.draft.type
      )
    ) {

      this.error.set(
        'Ce type d’interaction est interdit.'
      );

      return;

    }

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
          owner,
          editingId,
          data
        );

      } else {

        await this.service.create(owner, data);

      }

      if (this.isCurrentOwner(owner)) {

        this.formOpen.set(false);
        this.editingId.set(null);
        this.draft = this.emptyDraft();

        await this.load(owner);

      }

    } catch (error) {

      console.error(error);

      if (this.isCurrentOwner(owner)) {

        this.error.set(
          this.getErrorMessage(
            error,
            'Impossible d’enregistrer cet échange.'
          )
        );

      }

    } finally {

      this.saving.set(false);

    }

  }

  async remove(interaction: Interaction): Promise<void> {

    const owner = this.owner();

    if (
      !owner ||
      !this.canEdit(interaction) ||
      this.saving() ||
      this.formOpen()
    ) return;

    if (!confirm('Supprimer définitivement cet échange ?')) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    try {

      await this.service.remove(
        owner,
        interaction.id
      );

      if (this.isCurrentOwner(owner)) {

        await this.load(owner);

      }

    } catch (error) {

      console.error(error);

      if (this.isCurrentOwner(owner)) {

        this.error.set(
          this.getErrorMessage(
            error,
            'Impossible de supprimer cet échange.'
          )
        );

      }

    } finally {

      this.saving.set(false);

    }

  }

}