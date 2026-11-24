
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Prospect,
  ProspectStatus,
  ProspectsService
} from '../../core/services/prospects';
import { InteractionHistory } from './interaction-history/interaction-history';
import { MailComposer } from './mail-composer/mail-composer';


@Component({
  selector: 'app-prospect-detail',
  standalone: true,
  imports: [FormsModule, RouterLink, InteractionHistory, MailComposer],
  templateUrl: './prospect-detail.html',
  styleUrl: './prospect-detail.scss'
})
export class ProspectDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(ProspectsService);

  readonly isNew = this.route.snapshot.routeConfig?.path === 'prospects/new';
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly loading = this.service.loading;
  readonly loadError = this.service.error;
  readonly deleting = signal(false);
  readonly confirmDelete = signal(false);

  private readonly id = Number(
    this.route.snapshot.paramMap.get('id')
  );

  readonly prospect = computed(() =>
    this.service.findById(this.id)
  );

  readonly editing = signal(this.isNew);

  draft: Prospect | null = this.isNew
    ? {
        id: 0,
        name: '',
        location: '',
        email: '',
        phone: '',
        website: '',
        status: 'À contacter',
        notes: '',
        nextFollowUp: ''
      }
    : null;

  readonly statuses: ProspectStatus[] = [
    'À contacter',
    'Contacté',
    'À relancer',
    'En discussion',
    'Client'
  ];


readonly mailOpen = signal(false);
readonly mailMessage = signal<string | null>(null);
readonly historyVersion = signal(0);

onMailSent(message: string): void {
  this.mailOpen.set(false);
  this.mailMessage.set(message);
  this.historyVersion.update(value => value + 1);
}


  startEditing(): void {
    const current = this.prospect();
    if (!current) return;

    this.draft = { ...current };
    this.editing.set(true);
  }

  cancelEditing(): void {
    if (this.isNew) {
      this.router.navigate(['/prospects']);
      return;
    }

    this.draft = null;
    this.editing.set(false);
  }

  
async save(): Promise<void> {
  if (!this.draft || !this.draft.name.trim()) return;
  if (this.saving()) return;

  this.saving.set(true);
  this.saveError.set(null);

  try {
    this.draft.name = this.draft.name.trim();

    if (this.isNew) {
      const { id, ...data } = this.draft;

      const created = await this.service.create(data);

      await this.router.navigate([
        '/prospects',
        created.id
      ]);

      return;
    }

    await this.service.update(this.id, this.draft);

    this.draft = null;
    this.editing.set(false);

  } catch (error) {
    console.error(error);

    this.saveError.set(
      'Impossible d’enregistrer le prospect.'
    );

  } finally {
    this.saving.set(false);
  }
}


async deleteProspect(): Promise<void> {
  if (this.deleting()) return;

  this.deleting.set(true);
  this.saveError.set(null);

  try {
    await this.service.remove(this.id);
    await this.router.navigate(['/prospects']);

  } catch (error) {
    console.error(error);
    this.saveError.set(
      'Impossible de supprimer le prospect.'
    );

  } finally {
    this.deleting.set(false);
  }
}


}
