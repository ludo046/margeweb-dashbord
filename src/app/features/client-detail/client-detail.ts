import {
  Component,
  inject,
  signal,
  computed,
  OnInit
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';

import {
  ActivatedRoute,
  Router,
  RouterLink
} from '@angular/router';

import { HttpErrorResponse } from '@angular/common/http';

import {
  Client,
  ClientStatus,
  ClientsService
} from '../../core/services/clients';

import {
  InteractionHistory
} from '../prospect-detail/interaction-history/interaction-history';

import {
  MailComposer
} from '../prospect-detail/mail-composer/mail-composer';

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    RouterLink,
    InteractionHistory,
    MailComposer
  ],
  templateUrl: './client-detail.html',
  styleUrl: './client-detail.scss'
})
export class ClientDetail implements OnInit {

  private readonly service = inject(ClientsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly isNew =
    this.route.snapshot.routeConfig?.path === 'clients/new';

  private readonly id = Number(
    this.route.snapshot.paramMap.get('id')
  );

  readonly client = signal<Client | null>(null);

  readonly loading = signal(!this.isNew);
  readonly saving = signal(false);
  readonly archiving = signal(false);

  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly editing = signal(this.isNew);
  readonly confirmArchive = signal(false);

  // Messagerie

  readonly mailOpen = signal(false);
  readonly historyVersion = signal(0);

  readonly activeTab = signal<
    'information' |
    'history' |
    'subscriptions' |
    'quotes' |
    'invoices'
  >('information');

  readonly statuses: ClientStatus[] = [
    'Actif',
    'Inactif'
  ];

  // État du client

  readonly isArchived = computed(() =>
    this.client()?.status === 'Archivé'
  );

  readonly busy = computed(() =>
    this.loading() ||
    this.saving() ||
    this.archiving()
  );

  // Autorisations

  readonly canEdit = computed(() =>
    !this.busy() &&
    !this.mailOpen() &&
    !this.confirmArchive() &&
    (
      this.isNew ||
      (
        !!this.client() &&
        !this.isArchived()
      )
    )
  );

  readonly canArchive = computed(() =>
    !this.isNew &&
    !!this.client() &&
    !this.isArchived() &&
    !this.busy() &&
    !this.editing() &&
    !this.mailOpen()
  );

  readonly canReactivate = computed(() =>
    !this.isNew &&
    !!this.client() &&
    this.isArchived() &&
    !this.busy() &&
    !this.editing() &&
    !this.mailOpen() &&
    !this.confirmArchive()
  );

  readonly canSendMail = computed(() =>
    !this.isNew &&
    !!this.client()?.email?.trim() &&
    !this.isArchived() &&
    !this.busy() &&
    !this.editing() &&
    !this.mailOpen() &&
    !this.confirmArchive()
  );

  draft: Client = this.emptyClient();

  // Initialisation

  ngOnInit(): void {

    if (!this.isNew) {

      void this.loadClient();

    }

  }

  // Date locale

  private localDate(): string {

    const date = new Date();

    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');

  }

  // Nouveau client

  private emptyClient(): Client {

    return {
      id: 0,
      name: '',
      legalName: '',
      contactName: '',
      email: '',
      phone: '',
      website: '',
      address: '',
      postalCode: '',
      city: '',
      country: 'France',
      siret: '',
      status: 'Actif',
      clientSince: this.localDate(),
      notes: ''
    };

  }

  // Gestion des erreurs

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

  // Chargement de la fiche

  async loadClient(): Promise<void> {

    this.loading.set(true);
    this.error.set(null);

    try {

      const client = await this.service.getById(
        this.id
      );

      this.client.set(client);
      this.draft = { ...client };

      if (client.status === 'Archivé') {

        this.editing.set(false);
        this.confirmArchive.set(false);

      }

    } catch (error) {

      console.error(error);

      this.error.set(
        this.getErrorMessage(
          error,
          'Impossible de récupérer les informations du client.'
        )
      );

    } finally {

      this.loading.set(false);

    }

  }

  // Modification

  startEditing(): void {

    const client = this.client();

    if (
      !client ||
      !this.canEdit()
    ) {
      return;
    }

    this.draft = { ...client };

    this.error.set(null);
    this.success.set(null);

    this.activeTab.set('information');
    this.editing.set(true);

  }

  // Annulation

  cancelEditing(): void {

    if (this.saving()) return;

    if (this.isNew) {

      void this.router.navigate(['/clients']);
      return;

    }

    const client = this.client();

    if (client) {

      this.draft = { ...client };

    }

    this.error.set(null);
    this.editing.set(false);

  }

  // Enregistrement

  async save(): Promise<void> {

    if (
      !this.editing() ||
      !this.canEdit() ||
      !this.draft.name.trim()
    ) {
      return;
    }

    if (
      this.draft.status !== 'Actif' &&
      this.draft.status !== 'Inactif'
    ) {

      this.error.set(
        'Utilisez la procédure d’archivage pour archiver un client.'
      );

      return;

    }

    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);

    try {

      const data = {
        name: this.draft.name.trim(),
        legalName: this.draft.legalName ?? '',
        contactName: this.draft.contactName ?? '',
        email: this.draft.email ?? '',
        phone: this.draft.phone ?? '',
        website: this.draft.website ?? '',
        address: this.draft.address ?? '',
        postalCode: this.draft.postalCode ?? '',
        city: this.draft.city ?? '',
        country: this.draft.country || 'France',
        siret: this.draft.siret ?? '',
        status: this.draft.status,
        clientSince:
          this.draft.clientSince || this.localDate(),
        notes: this.draft.notes ?? ''
      };

      if (this.isNew) {

        const client = await this.service.create(
          data
        );

        await this.router.navigate([
          '/clients',
          client.id
        ]);

      } else {

        const updated = await this.service.update(
          this.id,
          data
        );

        this.client.set({
          ...this.client(),
          ...updated
        });

        this.editing.set(false);

        this.success.set(
          'Les informations du client ont été enregistrées.'
        );

      }

    } catch (error) {

      console.error(error);

      this.error.set(
        this.getErrorMessage(
          error,
          'Impossible d’enregistrer le client.'
        )
      );

    } finally {

      this.saving.set(false);

    }

  }

  // Ouvrir la rédaction d'un e-mail

  openMail(): void {

    if (!this.canSendMail()) return;

    this.error.set(null);
    this.success.set(null);

    this.mailOpen.set(true);

  }

  // Fermer la rédaction

  closeMail(): void {

    this.mailOpen.set(false);

  }

  // Après confirmation de l'envoi

  onMailSent(message: string): void {

    this.mailOpen.set(false);

    this.error.set(null);
    this.success.set(message);

    this.activeTab.set('history');

    this.historyVersion.update(
      version => version + 1
    );

  }

  // Ouvrir la confirmation d'archivage

  openArchive(): void {

    if (!this.canArchive()) return;

    this.error.set(null);
    this.success.set(null);

    this.confirmArchive.set(true);

  }

  // Annuler l'archivage

  cancelArchive(): void {

    if (this.archiving()) return;

    this.confirmArchive.set(false);

  }

  // Archivage

  async archiveClient(): Promise<void> {

    if (
      !this.confirmArchive() ||
      !this.canArchive()
    ) {
      return;
    }

    this.archiving.set(true);
    this.error.set(null);
    this.success.set(null);

    try {

      const updated = await this.service.archive(
        this.id
      );

      this.client.set({
        ...this.client(),
        ...updated
      });

      this.editing.set(false);
      this.confirmArchive.set(false);

      this.success.set(
        'Le client a été archivé.'
      );

    } catch (error) {

      console.error(error);

      this.error.set(
        this.getErrorMessage(
          error,
          'Impossible d’archiver le client.'
        )
      );

    } finally {

      this.archiving.set(false);

    }

  }

  // Réactivation

  async reactivateClient(): Promise<void> {

    if (!this.canReactivate()) return;

    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);

    try {

      const updated = await this.service.update(
        this.id,
        { status: 'Actif' }
      );

      this.client.set({
        ...this.client(),
        ...updated
      });

      this.success.set(
        'Le client a été réactivé.'
      );

    } catch (error) {

      console.error(error);

      this.error.set(
        this.getErrorMessage(
          error,
          'Impossible de réactiver le client.'
        )
      );

    } finally {

      this.saving.set(false);

    }

  }

}