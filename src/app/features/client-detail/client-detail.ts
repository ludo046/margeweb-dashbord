import {
  Component,
  inject,
  signal,
  OnInit
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';

import {
  ActivatedRoute,
  Router,
  RouterLink
} from '@angular/router';

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
    'Inactif',
    'Archivé'
  ];

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

    } catch (error) {

      console.error(error);

      this.error.set(
        'Impossible de récupérer les informations du client.'
      );

    } finally {

      this.loading.set(false);

    }

  }

  // Modification

  startEditing(): void {

    const client = this.client();

    if (!client || this.mailOpen()) return;

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
      this.saving() ||
      !this.draft.name.trim()
    ) {
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
        'Impossible d’enregistrer le client.'
      );

    } finally {

      this.saving.set(false);

    }

  }

  // Ouvrir la rédaction d'un e-mail

  openMail(): void {

    const client = this.client();

    if (
      !client ||
      this.isNew ||
      this.editing() ||
      this.saving() ||
      this.archiving() ||
      this.mailOpen()
    ) {
      return;
    }

    this.error.set(null);
    this.success.set(null);

    if (client.status === 'Archivé') {

      this.error.set(
        'Réactivez ce client avant de lui envoyer un e-mail.'
      );

      return;

    }

    if (!client.email?.trim()) {

      this.error.set(
        'Ce client ne possède pas d’adresse e-mail.'
      );

      return;

    }

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

  // Archivage

  async archiveClient(): Promise<void> {

    if (
      this.archiving() ||
      !this.client() ||
      this.mailOpen()
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

      this.confirmArchive.set(false);

      this.success.set(
        'Le client a été archivé.'
      );

    } catch (error) {

      console.error(error);

      this.error.set(
        'Impossible d’archiver le client.'
      );

    } finally {

      this.archiving.set(false);

    }

  }

  // Réactivation

  async reactivateClient(): Promise<void> {

    if (
      this.saving() ||
      !this.client() ||
      this.mailOpen()
    ) {
      return;
    }

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
        'Impossible de réactiver le client.'
      );

    } finally {

      this.saving.set(false);

    }

  }

}