import {
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';

import {
  CurrencyPipe,
  DatePipe
} from '@angular/common';

import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import {
  Subscription,
  SubscriptionInput,
  SubscriptionUpdate,
  SubscriptionStatus,
  BillingCycle,
  SubscriptionsService
} from '../../core/services/subscriptions';

import {
  ClientsService
} from '../../core/services/clients';

type SubscriptionAction =
  | 'activate'
  | 'suspend'
  | 'resume'
  | 'cancel';

interface SubscriptionForm {
  clientId: number | null;
  name: string;
  description: string;
  amount: number | null;
  billingCycle: BillingCycle;
  startDate: string;
  endDate: string;
  nextBillingDate: string;
  autoRenew: boolean;
  notes: string;
}

interface ActionConfirmation {
  subscription: Subscription;
  action: SubscriptionAction;
  title: string;
  message: string;
  buttonLabel: string;
  dangerous: boolean;
}

@Component({
  selector: 'app-subscriptions',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    CurrencyPipe,
    DatePipe
  ],
  templateUrl: './subscriptions.html',
  styleUrl: './subscriptions.scss'
})
export class Subscriptions implements OnInit {

  readonly subscriptionsService = inject(
    SubscriptionsService
  );

  readonly clientsService = inject(ClientsService);

  readonly subscriptions =
    this.subscriptionsService.subscriptions;

  readonly stats =
    this.subscriptionsService.stats;

  readonly loading =
    this.subscriptionsService.loading;

  readonly statsLoading =
    this.subscriptionsService.statsLoading;

  readonly error =
    this.subscriptionsService.error;

  readonly statsError =
    this.subscriptionsService.statsError;

  readonly clientsLoading =
    this.clientsService.loading;

  readonly clientsError =
    this.clientsService.error;

  readonly search = signal('');

  readonly statusFilter =
    signal<SubscriptionStatus | 'Tous'>('Tous');

  readonly billingFilter =
    signal<BillingCycle | 'Tous'>('Tous');

  readonly clientFilter =
    signal<number | null>(null);

  readonly formOpen = signal(false);

  readonly editingSubscription =
    signal<Subscription | null>(null);

  readonly confirmation =
    signal<ActionConfirmation | null>(null);

  readonly saving = signal(false);

  readonly processingAction = signal(false);

  readonly formError = signal('');

  readonly actionError = signal('');

  readonly successMessage = signal('');

  readonly statuses: SubscriptionStatus[] = [
    'À venir',
    'Actif',
    'Suspendu',
    'Résilié'
  ];

  readonly billingCycles: BillingCycle[] = [
    'Mensuel',
    'Trimestriel',
    'Annuel'
  ];

  form: SubscriptionForm = this.emptyForm();

  readonly availableClients = computed(() =>
    this.clientsService.clients()
      .filter(client => client.status !== 'Archivé')
      .sort((a, b) =>
        a.name.localeCompare(b.name, 'fr')
      )
  );

  readonly filterClients = computed(() =>
    [...this.clientsService.clients()]
      .sort((a, b) =>
        a.name.localeCompare(b.name, 'fr')
      )
  );

  readonly busy = computed(() =>
    this.saving() || this.processingAction()
  );

  readonly canCreate = computed(() =>
    !this.busy() &&
    !this.clientsLoading() &&
    !this.clientsError() &&
    this.availableClients().length > 0
  );

  readonly filteredSubscriptions = computed(() => {
    const search = this.normalize(this.search());
    const status = this.statusFilter();
    const billing = this.billingFilter();
    const clientId = this.clientFilter();

    return this.subscriptions()
      .filter(subscription => {

        const matchesSearch =
          !search ||
          [
            subscription.name,
            subscription.description,
            subscription.client?.name,
            subscription.client?.legalName
          ].some(value =>
            this.normalize(value ?? '').includes(search)
          );

        const matchesStatus =
          status === 'Tous' ||
          subscription.status === status;

        const matchesBilling =
          billing === 'Tous' ||
          subscription.billingCycle === billing;

        const matchesClient =
          clientId === null ||
          subscription.clientId === clientId;

        return (
          matchesSearch &&
          matchesStatus &&
          matchesBilling &&
          matchesClient
        );
      })
      .sort((a, b) => {
        const nameComparison =
          (a.client?.name ?? '').localeCompare(
            b.client?.name ?? '',
            'fr'
          );

        return nameComparison ||
          a.name.localeCompare(b.name, 'fr');
      });
  });

  readonly hasFilters = computed(() =>
    this.search().trim() !== '' ||
    this.statusFilter() !== 'Tous' ||
    this.billingFilter() !== 'Tous' ||
    this.clientFilter() !== null
  );

  ngOnInit(): void {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    await Promise.all([
      this.subscriptionsService.refresh(),
      this.clientsService.load()
    ]);
  }

  // Filtres

  resetFilters(): void {
    this.search.set('');
    this.statusFilter.set('Tous');
    this.billingFilter.set('Tous');
    this.clientFilter.set(null);
  }

  filterByStatus(
    status: SubscriptionStatus | 'Tous'
  ): void {
    this.statusFilter.set(
      this.statusFilter() === status
        ? 'Tous'
        : status
    );
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  // Formulaire

  private today(): string {
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

  private emptyForm(): SubscriptionForm {
    return {
      clientId: null,
      name: '',
      description: '',
      amount: null,
      billingCycle: 'Mensuel',
      startDate: this.today(),
      endDate: '',
      nextBillingDate: this.today(),
      autoRenew: true,
      notes: ''
    };
  }

  openCreate(clientId?: number): void {
    if (
      !this.canCreate() ||
      this.formOpen() ||
      this.confirmation()
    ) {
      return;
    }

    this.editingSubscription.set(null);

    this.form = this.emptyForm();

    if (
      clientId &&
      this.availableClients().some(
        client => client.id === clientId
      )
    ) {
      this.form.clientId = clientId;
    }

    this.formError.set('');
    this.actionError.set('');
    this.successMessage.set('');

    this.formOpen.set(true);
  }

  openEdit(subscription: Subscription): void {
    if (
      !this.canEdit(subscription) ||
      this.formOpen() ||
      this.confirmation()
    ) {
      return;
    }

    this.editingSubscription.set(subscription);

    this.form = {
      clientId: subscription.clientId,
      name: subscription.name,
      description: subscription.description ?? '',
      amount: Number(subscription.amount),
      billingCycle: subscription.billingCycle,
      startDate: subscription.startDate,
      endDate: subscription.endDate ?? '',
      nextBillingDate:
        subscription.nextBillingDate ?? '',
      autoRenew: subscription.autoRenew,
      notes: subscription.notes ?? ''
    };

    this.formError.set('');
    this.actionError.set('');
    this.successMessage.set('');

    this.formOpen.set(true);
  }

  closeForm(): void {
    if (this.saving()) {
      return;
    }

    this.formOpen.set(false);
    this.editingSubscription.set(null);
    this.formError.set('');

    this.form = this.emptyForm();
  }

  onStartDateChange(value: string): void {
    const previousStartDate = this.form.startDate;

    this.form.startDate = value;

    if (
      !this.form.nextBillingDate ||
      this.form.nextBillingDate === previousStartDate ||
      this.form.nextBillingDate < value
    ) {
      this.form.nextBillingDate = value;
    }
  }

  canChangeStartDate(): boolean {
    const subscription = this.editingSubscription();

    return (
      !subscription ||
      subscription.status === 'À venir'
    );
  }

  getFormMonthlyAmount(): number {
    const amount = Number(this.form.amount ?? 0);

    switch (this.form.billingCycle) {
      case 'Trimestriel':
        return amount / 3;

      case 'Annuel':
        return amount / 12;

      default:
        return amount;
    }
  }

  getFormAnnualAmount(): number {
    return this.getFormMonthlyAmount() * 12;
  }

  private validateForm(): string | null {
    if (!this.form.clientId) {
      return 'Sélectionne un client.';
    }

    if (!this.form.name.trim()) {
      return 'Le nom de l’abonnement est obligatoire.';
    }

    if (this.form.name.trim().length > 255) {
      return 'Le nom ne doit pas dépasser 255 caractères.';
    }

    const amount = this.form.amount;

    if (
      amount === null ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      amount > 99999999.99
    ) {
      return 'Le montant de l’abonnement est invalide.';
    }

    if (
      Math.abs(
        amount * 100 - Math.round(amount * 100)
      ) > 0.00001
    ) {
      return 'Le montant doit comporter au maximum deux décimales.';
    }

    if (!this.form.startDate) {
      return 'La date de début est obligatoire.';
    }

    if (
      this.form.endDate &&
      this.form.endDate < this.form.startDate
    ) {
      return 'La date de fin ne peut pas précéder la date de début.';
    }

    if (
      this.form.nextBillingDate &&
      this.form.nextBillingDate < this.form.startDate
    ) {
      return 'La prochaine échéance ne peut pas précéder la date de début.';
    }

    if (
      this.form.endDate &&
      this.form.nextBillingDate &&
      this.form.nextBillingDate > this.form.endDate
    ) {
      return 'La prochaine échéance ne peut pas dépasser la date de fin.';
    }

    const subscription = this.editingSubscription();

    if (subscription?.status === 'Actif') {
      if (!this.form.nextBillingDate) {
        return 'Un abonnement actif doit avoir une prochaine échéance.';
      }

      if (
        this.form.endDate &&
        this.form.endDate < this.today()
      ) {
        return 'Un abonnement actif ne peut pas avoir une date de fin passée.';
      }
    }

    return null;
  }

  async save(): Promise<void> {
    if (this.busy() || !this.formOpen()) {
      return;
    }

    this.formError.set('');

    const validationError = this.validateForm();

    if (validationError) {
      this.formError.set(validationError);
      return;
    }

    this.saving.set(true);

    let saved = false;

    try {
      const current = this.editingSubscription();

      const data: SubscriptionInput = {
        clientId: Number(this.form.clientId),
        name: this.form.name.trim(),
        description: this.form.description.trim(),
        amount: Number(this.form.amount).toFixed(2),
        billingCycle: this.form.billingCycle,
        startDate: this.form.startDate,
        endDate: this.form.endDate || null,
        nextBillingDate:
          this.form.nextBillingDate || null,
        autoRenew: this.form.autoRenew,
        notes: this.form.notes.trim()
      };

      if (current) {
        const {
          clientId,
          ...updateData
        } = data;

        const changes: SubscriptionUpdate = {
          ...updateData
        };

        if (current.status !== 'À venir') {
          delete changes.startDate;
        }

        await this.subscriptionsService.update(
          current.id,
          changes
        );

        this.successMessage.set(
          'L’abonnement a été modifié.'
        );
      } else {
        await this.subscriptionsService.create(data);

        this.successMessage.set(
          'L’abonnement a été créé.'
        );
      }

      saved = true;

    } catch (error) {
      this.formError.set(
        this.getErrorMessage(
          error,
          'Impossible d’enregistrer l’abonnement.'
        )
      );
    } finally {
      this.saving.set(false);

      if (saved) {
        this.closeForm();
      }
    }
  }

  // Actions disponibles

  private getClientStatus(
    subscription: Subscription
  ): string | undefined {
    return this.clientsService.clients().find(
      client => client.id === subscription.clientId
    )?.status ?? subscription.client?.status;
  }

  canEdit(subscription: Subscription): boolean {
    const status = this.getClientStatus(subscription);

    return (
      !this.busy() &&
      subscription.status !== 'Résilié' &&
      !!status &&
      status !== 'Archivé'
    );
  }

  canActivate(subscription: Subscription): boolean {
    return (
      !this.busy() &&
      subscription.status === 'À venir' &&
      this.getClientStatus(subscription) === 'Actif' &&
      subscription.startDate <= this.today() &&
      (
        !subscription.endDate ||
        subscription.endDate >= this.today()
      )
    );
  }

  canSuspend(subscription: Subscription): boolean {
    const status = this.getClientStatus(subscription);

    return (
      !this.busy() &&
      subscription.status === 'Actif' &&
      !!status &&
      status !== 'Archivé'
    );
  }

  canResume(subscription: Subscription): boolean {
    return (
      !this.busy() &&
      subscription.status === 'Suspendu' &&
      this.getClientStatus(subscription) === 'Actif' &&
      subscription.startDate <= this.today() &&
      (
        !subscription.endDate ||
        subscription.endDate >= this.today()
      )
    );
  }

  canCancel(subscription: Subscription): boolean {
    const status = this.getClientStatus(subscription);

    return (
      !this.busy() &&
      subscription.status !== 'Résilié' &&
      !!status &&
      status !== 'Archivé'
    );
  }

  // Confirmations

  requestAction(
    subscription: Subscription,
    action: SubscriptionAction
  ): void {
    if (
      this.busy() ||
      this.formOpen() ||
      this.confirmation()
    ) {
      return;
    }

    let confirmation: ActionConfirmation;

    switch (action) {

      case 'activate':
        if (!this.canActivate(subscription)) {
          return;
        }

        confirmation = {
          subscription,
          action,
          title: 'Activer l’abonnement',
          message:
            'Cet abonnement sera activé et intégré aux revenus récurrents.',
          buttonLabel: 'Activer',
          dangerous: false
        };

        break;

      case 'suspend':
        if (!this.canSuspend(subscription)) {
          return;
        }

        confirmation = {
          subscription,
          action,
          title: 'Suspendre l’abonnement',
          message:
            'Cet abonnement sera temporairement retiré des revenus récurrents. Sa prochaine échéance sera conservée.',
          buttonLabel: 'Suspendre',
          dangerous: false
        };

        break;

      case 'resume':
        if (!this.canResume(subscription)) {
          return;
        }

        confirmation = {
          subscription,
          action,
          title: 'Reprendre l’abonnement',
          message:
            'Cet abonnement redeviendra actif et sera réintégré aux revenus récurrents.',
          buttonLabel: 'Reprendre',
          dangerous: false
        };

        break;

      case 'cancel':
        if (!this.canCancel(subscription)) {
          return;
        }

        confirmation = {
          subscription,
          action,
          title: 'Résilier l’abonnement',
          message:
            'Cette action est définitive. L’abonnement sera retiré des revenus récurrents et son historique sera conservé. Il ne pourra plus être réactivé.',
          buttonLabel: 'Résilier définitivement',
          dangerous: true
        };

        break;
    }

    this.actionError.set('');
    this.successMessage.set('');
    this.confirmation.set(confirmation);
  }

  closeConfirmation(): void {
    if (this.processingAction()) {
      return;
    }

    this.confirmation.set(null);
    this.actionError.set('');
  }

  async confirmAction(): Promise<void> {
    const confirmation = this.confirmation();

    if (!confirmation || this.busy()) {
      return;
    }

    this.processingAction.set(true);
    this.actionError.set('');

    try {
      const id = confirmation.subscription.id;

      switch (confirmation.action) {

        case 'activate':
          await this.subscriptionsService.activate(id);

          this.successMessage.set(
            'L’abonnement a été activé.'
          );
          break;

        case 'suspend':
          await this.subscriptionsService.suspend(id);

          this.successMessage.set(
            'L’abonnement a été suspendu.'
          );
          break;

        case 'resume':
          await this.subscriptionsService.resume(id);

          this.successMessage.set(
            'L’abonnement a été repris.'
          );
          break;

        case 'cancel':
          await this.subscriptionsService.cancel(id);

          this.successMessage.set(
            'L’abonnement a été résilié.'
          );
          break;
      }

      this.confirmation.set(null);

    } catch (error) {
      this.actionError.set(
        this.getErrorMessage(
          error,
          'Impossible de modifier le statut de l’abonnement.'
        )
      );
    } finally {
      this.processingAction.set(false);
    }
  }

  // Affichage

  getMonthlyAmount(
    subscription: Subscription
  ): number {
    return this.subscriptionsService
      .getMonthlyAmount(subscription);
  }

  getAnnualAmount(
    subscription: Subscription
  ): number {
    return this.subscriptionsService
      .getAnnualAmount(subscription);
  }

  getStatusClass(
    status: SubscriptionStatus
  ): string {
    switch (status) {
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

  isExpired(subscription: Subscription): boolean {
    return (
      subscription.status !== 'Résilié' &&
      !!subscription.endDate &&
      subscription.endDate < this.today()
    );
  }

  isOverdue(subscription: Subscription): boolean {
    return (
      subscription.status === 'Actif' &&
      this.getClientStatus(subscription) === 'Actif' &&
      subscription.startDate <= this.today() &&
      !this.isExpired(subscription) &&
      !!subscription.nextBillingDate &&
      subscription.nextBillingDate < this.today()
    );
  }

  getClientInitials(name: string): string {
    return name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(word => word.charAt(0).toUpperCase())
      .join('') || '?';
  }

  getBillingLabel(cycle: BillingCycle): string {
    switch (cycle) {
      case 'Mensuel':
        return '/ mois';

      case 'Trimestriel':
        return '/ trimestre';

      case 'Annuel':
        return '/ an';
    }
  }

  private getErrorMessage(
    error: unknown,
    fallback: string
  ): string {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error?.message === 'string') {
        return error.error.message;
      }
    }

    return fallback;
  }
}
