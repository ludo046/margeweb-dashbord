import {
  Component,
  computed,
  inject,
  signal,
  OnInit
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import {
  Prospect,
  ProspectStatus,
  ProspectsService
} from '../../core/services/prospects';

import {
  ClientsService
} from '../../core/services/clients';

import { InteractionHistory } from './interaction-history/interaction-history';
import { MailComposer } from './mail-composer/mail-composer';

@Component({
  selector: 'app-prospect-detail',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    InteractionHistory,
    MailComposer
  ],
  templateUrl: './prospect-detail.html',
  styleUrl: './prospect-detail.scss'
})
export class ProspectDetail implements OnInit {

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(ProspectsService);
  private readonly clientsService = inject(ClientsService);

  readonly isNew =
    this.route.snapshot.routeConfig?.path === 'prospects/new';

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

  // Messagerie

  readonly mailOpen = signal(false);
  readonly mailMessage = signal<string | null>(null);
  readonly historyVersion = signal(0);

  // Conversion en client

  readonly converting = signal(false);
  readonly confirmConvert = signal(false);
  readonly conversionError = signal<string | null>(null);

  readonly clientsLoading = this.clientsService.loading;
  readonly clientsError = this.clientsService.error;

  readonly linkedClient = computed(() =>
    this.clientsService.clients().find(
      client => client.prospectId === this.id
    )
  );

  readonly canConvert = computed(() =>
    !this.isNew &&
    !!this.prospect() &&
    !this.linkedClient() &&
    !this.clientsLoading() &&
    !this.clientsError() &&
    !this.converting()
  );

  ngOnInit(): void {
    if (!this.isNew) {
      void this.clientsService.load();
    }
  }

  refreshClients(): void {
    void this.clientsService.load();
  }

  // Envoi d'un e-mail

  onMailSent(message: string): void {
    this.mailOpen.set(false);
    this.mailMessage.set(message);
    this.historyVersion.update(value => value + 1);
  }

  // Modification du prospect

  startEditing(): void {
    const current = this.prospect();

    if (!current || this.converting()) return;

    this.draft = { ...current };
    this.saveError.set(null);
    this.editing.set(true);
  }

  cancelEditing(): void {
    if (this.saving()) return;

    if (this.isNew) {
      void this.router.navigate(['/prospects']);
      return;
    }

    this.draft = null;
    this.saveError.set(null);
    this.editing.set(false);
  }

  // Enregistrement

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

  // Suppression

  async deleteProspect(): Promise<void> {

    if (
      this.deleting() ||
      this.converting() ||
      this.linkedClient() ||
      this.clientsLoading() ||
      this.clientsError()
    ) return;

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

  // Ouverture de la confirmation de conversion

  openConversion(): void {

    if (!this.canConvert()) return;

    this.conversionError.set(null);
    this.confirmConvert.set(true);
  }

  // Annulation de la conversion

  cancelConversion(): void {

    if (this.converting()) return;

    this.confirmConvert.set(false);
    this.conversionError.set(null);
  }

  // Conversion du prospect en client

  async convertToClient(): Promise<void> {

    if (!this.canConvert()) return;

    this.converting.set(true);
    this.conversionError.set(null);

    try {

      const client = await this.clientsService.convertProspect(
        this.id
      );

      this.confirmConvert.set(false);

      await this.service.load();

      await this.router.navigate([
        '/clients',
        client.id
      ]);

    } catch (error) {

      console.error(error);

      if (
        error instanceof HttpErrorResponse &&
        error.status === 409
      ) {

        await this.clientsService.load();

        const existingClient = this.linkedClient();

        if (existingClient) {

          this.confirmConvert.set(false);

          await this.service.load();

          await this.router.navigate([
            '/clients',
            existingClient.id
          ]);

          return;
        }

        this.conversionError.set(
          'Ce prospect possède déjà une fiche client.'
        );

      } else {

        this.conversionError.set(
          'Impossible de confirmer la conversion. Vérifie la liste des clients avant de réessayer.'
        );

        await this.clientsService.load();

      }

    } finally {

      this.converting.set(false);

    }
  }
}