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
    'En discussion'
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

  readonly isConverted = computed(() =>
    !!this.linkedClient()
  );

  // Ancien prospect avec statut Client
  // mais sans fiche client associée

  readonly isLegacyClient = computed(() =>
    !this.isNew &&
    this.prospect()?.status === 'Client' &&
    !this.isConverted() &&
    !this.clientsLoading() &&
    !this.clientsError()
  );

  // Vérification des relations commerciales

  readonly relationReady = computed(() =>
    !this.clientsLoading() &&
    !this.clientsError()
  );

  // Actions en cours

  readonly busy = computed(() =>
    this.saving() ||
    this.deleting() ||
    this.converting()
  );

  // Autorisations

  readonly canEdit = computed(() =>
    this.isNew ||
    (
      !!this.prospect() &&
      this.relationReady() &&
      !this.isConverted() &&
      !this.busy() &&
      !this.mailOpen()
    )
  );

  readonly canDelete = computed(() =>
    !this.isNew &&
    !!this.prospect() &&
    this.relationReady() &&
    !this.isConverted() &&
    !this.busy() &&
    !this.editing() &&
    !this.mailOpen()
  );

  readonly canConvert = computed(() =>
    !this.isNew &&
    !!this.prospect() &&
    this.relationReady() &&
    !this.isConverted() &&
    !this.busy() &&
    !this.editing() &&
    !this.mailOpen()
  );

  readonly canSendMail = computed(() =>
    !this.isNew &&
    !!this.prospect()?.email?.trim() &&
    this.relationReady() &&
    !this.isConverted() &&
    !this.isLegacyClient() &&
    !this.busy() &&
    !this.editing() &&
    !this.mailOpen()
  );

  readonly historyReadOnly = computed(() =>
    this.isConverted() ||
    this.isLegacyClient() ||
    !this.relationReady() ||
    this.busy()
  );

  ngOnInit(): void {

    if (!this.isNew) {

      void this.clientsService.load();

    }

  }

  refreshClients(): void {

    void this.clientsService.load();

  }

  // Message d'erreur retourné par le serveur

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

  // Ouverture du compositeur

  openMail(): void {

    if (!this.canSendMail()) return;

    this.mailMessage.set(null);
    this.saveError.set(null);

    this.mailOpen.set(true);

  }

  closeMail(): void {

    this.mailOpen.set(false);

  }

  // Après envoi d'un e-mail

  onMailSent(message: string): void {

    this.mailOpen.set(false);

    this.mailMessage.set(message);

    this.historyVersion.update(
      value => value + 1
    );

  }

  // Modification du prospect

  startEditing(): void {

    const current = this.prospect();

    if (!current || !this.canEdit()) return;

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

    if (
      !this.draft ||
      !this.draft.name.trim() ||
      this.busy()
    ) {
      return;
    }

    if (!this.isNew && !this.canEdit()) {

      this.saveError.set(
        'Cette fiche prospect ne peut plus être modifiée.'
      );

      return;

    }

    if (
      this.draft.status === 'Client' &&
      (
        this.isNew ||
        this.prospect()?.status !== 'Client'
      )
    ) {

      this.saveError.set(
        'Utilise la conversion pour transformer ce prospect en client.'
      );

      return;

    }

    this.saving.set(true);
    this.saveError.set(null);

    try {

      this.draft.name = this.draft.name.trim();

      if (this.draft.status === 'Client') {

        this.draft.nextFollowUp = null;

      }

      if (this.isNew) {

        const { id, ...data } = this.draft;

        const created = await this.service.create(data);

        await this.router.navigate([
          '/prospects',
          created.id
        ]);

        return;

      }

      await this.service.update(
        this.id,
        this.draft
      );

      this.draft = null;
      this.editing.set(false);

    } catch (error) {

      console.error(error);

      this.saveError.set(
        this.getErrorMessage(
          error,
          'Impossible d’enregistrer le prospect.'
        )
      );

      if (
        error instanceof HttpErrorResponse &&
        error.status === 409
      ) {

        await this.clientsService.load();

      }

    } finally {

      this.saving.set(false);

    }

  }

  // Suppression

  async deleteProspect(): Promise<void> {

    if (!this.canDelete()) return;

    this.deleting.set(true);
    this.saveError.set(null);

    try {

      await this.service.remove(this.id);

      await this.router.navigate(['/prospects']);

    } catch (error) {

      console.error(error);

      this.saveError.set(
        this.getErrorMessage(
          error,
          'Impossible de supprimer le prospect.'
        )
      );

      if (
        error instanceof HttpErrorResponse &&
        error.status === 409
      ) {

        await this.clientsService.load();

      }

    } finally {

      this.deleting.set(false);

    }

  }

  // Confirmation de conversion

  openConversion(): void {

    if (!this.canConvert()) return;

    this.conversionError.set(null);
    this.confirmConvert.set(true);

  }

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

      const client =
        await this.clientsService.convertProspect(
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
          this.getErrorMessage(
            error,
            'Impossible de confirmer la conversion.'
          )
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