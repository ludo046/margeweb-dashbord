import {
  Component,
  inject,
  signal,
  computed,
  OnInit
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { DatePipe, CurrencyPipe } from '@angular/common';

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
  Subscription,
  SubscriptionsService
} from '../../core/services/subscriptions';

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
    CurrencyPipe,
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

  readonly subscriptionsService = inject(
    SubscriptionsService
  );

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

  // ==========================================
  // MESSAGERIE
  // ==========================================

  readonly mailOpen = signal(false);
  readonly historyVersion = signal(0);

  // ==========================================
  // NAVIGATION
  // ==========================================

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

  // ==========================================
  // ABONNEMENTS
  // ==========================================

  readonly subscriptions = signal<Subscription[]>([]);

  readonly subscriptionsLoading = signal(!this.isNew);

  readonly subscriptionsError = signal<string | null>(
    null
  );

  readonly subscriptionsLoaded = signal(false);

  private subscriptionsLoadVersion = 0;

  readonly subscriptionsReady = computed(() =>
    this.subscriptionsLoaded() &&
    !this.subscriptionsLoading() &&
    !this.subscriptionsError()
  );

  readonly totalSubscriptions = computed(() =>
    this.subscriptionsReady()
      ? this.subscriptions().length
      : null
  );

  readonly activeSubscriptions = computed(() =>
    this.subscriptions().filter(
      subscription => subscription.status === 'Actif'
    )
  );

  readonly upcomingSubscriptions = computed(() =>
    this.subscriptions().filter(
      subscription => subscription.status === 'À venir'
    )
  );

  readonly suspendedSubscriptions = computed(() =>
    this.subscriptions().filter(
      subscription => subscription.status === 'Suspendu'
    )
  );

  readonly cancelledSubscriptions = computed(() =>
    this.subscriptions().filter(
      subscription => subscription.status === 'Résilié'
    )
  );

  readonly expiredSubscriptions = computed(() =>
    this.subscriptions().filter(
      subscription => this.isSubscriptionExpired(subscription)
    )
  );

  // Abonnements générant réellement
  // des revenus récurrents.

  readonly recurringSubscriptions = computed(() => {

    if (this.client()?.status !== 'Actif') {
      return [];
    }

    const today = this.businessDate();

    return this.activeSubscriptions().filter(
      subscription =>
        subscription.startDate <= today &&
        (
          !subscription.endDate ||
          subscription.endDate >= today
        )
    );

  });

  readonly activeSubscriptionCount = computed(() =>
    this.subscriptionsReady()
      ? this.recurringSubscriptions().length
      : null
  );

  // Revenu annuel calculé en centimes
  // pour limiter les erreurs d'arrondi.

  private readonly annualRevenueCents = computed(() =>
    this.recurringSubscriptions().reduce(
      (total, subscription) =>
        total + Math.round(
          this.subscriptionsService.getAnnualAmount(
            subscription
          ) * 100
        ),
      0
    )
  );

  readonly monthlyRevenue = computed(() => {

    if (!this.subscriptionsReady()) {
      return null;
    }

    return Math.round(
      this.annualRevenueCents() / 12
    ) / 100;

  });

  readonly annualRevenue = computed(() => {

    if (!this.subscriptionsReady()) {
      return null;
    }

    return this.annualRevenueCents() / 100;

  });

  readonly overdueSubscriptions = computed(() =>
    this.recurringSubscriptions().filter(
      subscription =>
        this.isSubscriptionOverdue(subscription)
    )
  );

  readonly nextBillingDate = computed(() => {

    if (!this.subscriptionsReady()) {
      return null;
    }

    const today = this.businessDate();

    const dates = this.recurringSubscriptions()
      .map(subscription => subscription.nextBillingDate)
      .filter(
        (date): date is string =>
          !!date && date >= today
      )
      .sort();

    return dates[0] ?? null;

  });

  readonly sortedSubscriptions = computed(() => {

    const order: Record<
      Subscription['status'],
      number
    > = {
      'Actif': 0,
      'À venir': 1,
      'Suspendu': 2,
      'Résilié': 3
    };

    return [...this.subscriptions()].sort(
      (a, b) => {

        const statusDifference =
          order[a.status] - order[b.status];

        if (statusDifference !== 0) {
          return statusDifference;
        }

        return a.name.localeCompare(
          b.name,
          'fr'
        );

      }
    );

  });

  // ==========================================
  // ÉTAT DU CLIENT
  // ==========================================

  readonly isArchived = computed(() =>
    this.client()?.status === 'Archivé'
  );

  readonly busy = computed(() =>
    this.loading() ||
    this.saving() ||
    this.archiving()
  );

  // ==========================================
  // AUTORISATIONS
  // ==========================================

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

  readonly canCreateSubscription = computed(() =>
    !this.isNew &&
    !!this.client() &&
    !this.isArchived() &&
    !this.busy() &&
    !this.editing() &&
    !this.mailOpen() &&
    !this.confirmArchive()
  );

  readonly canViewSubscriptions = computed(() =>
    !this.isNew &&
    !!this.client() &&
    !this.busy() &&
    !this.editing() &&
    !this.mailOpen() &&
    !this.confirmArchive()
  );

  draft: Client = this.emptyClient();

  // ==========================================
  // INITIALISATION
  // ==========================================

  ngOnInit(): void {

    if (!this.isNew) {

      void this.loadClient();

    }

  }

  // ==========================================
  // DATES
  // ==========================================

  private localDate(): string {

    const date = new Date();

    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');

  }

  // Date métier identique au backend :
  // fuseau horaire Europe/Paris.

  private businessDate(): string {

    const parts = new Intl.DateTimeFormat(
      'fr-FR',
      {
        timeZone: 'Europe/Paris',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }
    ).formatToParts(new Date());

    const year = parts.find(
      part => part.type === 'year'
    )?.value;

    const month = parts.find(
      part => part.type === 'month'
    )?.value;

    const day = parts.find(
      part => part.type === 'day'
    )?.value;

    return `${year}-${month}-${day}`;

  }

  // ==========================================
  // NOUVEAU CLIENT
  // ==========================================

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

  // ==========================================
  // GESTION DES ERREURS
  // ==========================================

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

  // ==========================================
  // CHARGEMENT DE LA FICHE
  // ==========================================

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

      void this.loadSubscriptions();

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

  // ==========================================
  // CHARGEMENT DES ABONNEMENTS
  // ==========================================

  async loadSubscriptions(): Promise<void> {

    const client = this.client();

    if (this.isNew || !client) {
      return;
    }

    const version = ++this.subscriptionsLoadVersion;

    this.subscriptionsLoading.set(true);
    this.subscriptionsError.set(null);

    try {

      const subscriptions =
        await this.subscriptionsService.findByClient(
          client.id
        );

      if (
        version !== this.subscriptionsLoadVersion ||
        this.client()?.id !== client.id
      ) {
        return;
      }

      this.subscriptions.set(
        subscriptions.filter(
          subscription =>
            subscription.clientId === client.id
        )
      );

      this.subscriptionsLoaded.set(true);

    } catch (error) {

      if (version !== this.subscriptionsLoadVersion) {
        return;
      }

      console.error(error);

      this.subscriptionsError.set(
        this.getErrorMessage(
          error,
          'Impossible de charger les abonnements du client.'
        )
      );

    } finally {

      if (version === this.subscriptionsLoadVersion) {

        this.subscriptionsLoading.set(false);

      }

    }

  }

  // ==========================================
  // INFORMATIONS DES ABONNEMENTS
  // ==========================================

  getSubscriptionMonthlyAmount(
    subscription: Subscription
  ): number {

    return this.subscriptionsService.getMonthlyAmount(
      subscription
    );

  }

  getSubscriptionAnnualAmount(
    subscription: Subscription
  ): number {

    return this.subscriptionsService.getAnnualAmount(
      subscription
    );

  }

  getBillingLabel(
    subscription: Subscription
  ): string {

    switch (subscription.billingCycle) {

      case 'Trimestriel':
        return '/ trimestre';

      case 'Annuel':
        return '/ an';

      default:
        return '/ mois';

    }

  }

  getSubscriptionStatusClass(
    subscription: Subscription
  ): string {

    switch (subscription.status) {

      case 'Actif':
        return 'active';

      case 'À venir':
        return 'upcoming';

      case 'Suspendu':
        return 'suspended';

      case 'Résilié':
        return 'cancelled';

    }

  }

  isSubscriptionExpired(
    subscription: Subscription
  ): boolean {

    return (
      subscription.status !== 'Résilié' &&
      !!subscription.endDate &&
      subscription.endDate < this.businessDate()
    );

  }

  isSubscriptionOverdue(
    subscription: Subscription
  ): boolean {

    const today = this.businessDate();

    return (
      this.client()?.status === 'Actif' &&
      subscription.status === 'Actif' &&
      subscription.startDate <= today &&
      !this.isSubscriptionExpired(subscription) &&
      !!subscription.nextBillingDate &&
      subscription.nextBillingDate < today
    );

  }

  // ==========================================
  // NAVIGATION VERS LES ABONNEMENTS
  // ==========================================

  openSubscriptions(): void {

    const client = this.client();

    if (!client || !this.canViewSubscriptions()) {
      return;
    }

    void this.router.navigate(
      ['/subscriptions'],
      {
        queryParams: {
          clientId: client.id
        }
      }
    );

  }

  createSubscription(): void {

    const client = this.client();

    if (!client || !this.canCreateSubscription()) {
      return;
    }

    void this.router.navigate(
      ['/subscriptions'],
      {
        queryParams: {
          clientId: client.id,
          create: 'true'
        }
      }
    );

  }

  // ==========================================
  // MODIFICATION DU CLIENT
  // ==========================================

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

  // ==========================================
  // ANNULATION
  // ==========================================

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

  // ==========================================
  // ENREGISTREMENT
  // ==========================================

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

        void this.loadSubscriptions();

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

  // ==========================================
  // MESSAGERIE CLIENT
  // ==========================================

  openMail(): void {

    if (!this.canSendMail()) return;

    this.error.set(null);
    this.success.set(null);

    this.mailOpen.set(true);

  }

  closeMail(): void {

    this.mailOpen.set(false);

  }

  onMailSent(message: string): void {

    this.mailOpen.set(false);

    this.error.set(null);
    this.success.set(message);

    this.activeTab.set('history');

    this.historyVersion.update(
      version => version + 1
    );

  }

  // ==========================================
  // CONFIRMATION D'ARCHIVAGE
  // ==========================================

  openArchive(): void {

    if (!this.canArchive()) return;

    this.error.set(null);
    this.success.set(null);

    this.confirmArchive.set(true);

  }

  cancelArchive(): void {

    if (this.archiving()) return;

    this.confirmArchive.set(false);

  }

  // ==========================================
  // ARCHIVAGE
  // ==========================================

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

      void this.loadSubscriptions();

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

  // ==========================================
  // RÉACTIVATION
  // ==========================================

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

      void this.loadSubscriptions();

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
