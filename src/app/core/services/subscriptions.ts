import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ClientStatus } from './clients';

export type SubscriptionStatus =
  | 'À venir'
  | 'Actif'
  | 'Suspendu'
  | 'Résilié';

export type BillingCycle =
  | 'Mensuel'
  | 'Trimestriel'
  | 'Annuel';

export interface SubscriptionClient {
  id: number;
  name: string;
  legalName?: string;
  email?: string;
  status: ClientStatus;
}

export interface Subscription {
  id: number;
  clientId: number;
  name: string;
  description: string;
  amount: number | string;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  startDate: string;
  endDate: string | null;
  nextBillingDate: string | null;
  autoRenew: boolean;
  cancelledAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  client?: SubscriptionClient;
}

export interface SubscriptionInput {
  clientId: number;
  name: string;
  description?: string;
  amount: number | string;
  billingCycle: BillingCycle;
  startDate: string;
  endDate?: string | null;
  nextBillingDate?: string | null;
  autoRenew?: boolean;
  notes?: string;
}

export type SubscriptionUpdate = Partial<
  Omit<SubscriptionInput, 'clientId'>
>;

export interface SubscriptionFilters {
  clientId?: number;
  status?: SubscriptionStatus;
  billingCycle?: BillingCycle;
}

export interface SubscriptionStats {
  total: number;
  upcoming: number;
  active: number;
  suspended: number;
  cancelled: number;
  expired: number;
  recurringSubscriptions: number;
  overdueBilling: number;
  upcomingBilling: number;
  mrr: number;
  arr: number;
  averageMonthlyRevenue: number;
  byBillingCycle: Record<BillingCycle, number>;
}

@Injectable({
  providedIn: 'root'
})
export class SubscriptionsService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl =
    `${environment.apiUrl}/subscriptions`;

  private readonly subscriptionsState =
    signal<Subscription[]>([]);

  private readonly statsState =
    signal<SubscriptionStats | null>(null);

  private readonly loadingState = signal(false);
  private readonly statsLoadingState = signal(false);

  private readonly errorState = signal<string | null>(null);
  private readonly statsErrorState = signal<string | null>(null);

  private pendingLoad: Promise<void> | null = null;
  private pendingStatsLoad: Promise<void> | null = null;

  readonly subscriptions = this.subscriptionsState.asReadonly();
  readonly stats = this.statsState.asReadonly();

  readonly loading = this.loadingState.asReadonly();
  readonly statsLoading = this.statsLoadingState.asReadonly();

  readonly error = this.errorState.asReadonly();
  readonly statsError = this.statsErrorState.asReadonly();

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

  readonly totalSubscriptions = computed(() =>
    this.subscriptions().length
  );

  readonly mrr = computed(() =>
    this.stats()?.mrr ?? null
  );

  readonly arr = computed(() =>
    this.stats()?.arr ?? null
  );

  readonly averageMonthlyRevenue = computed(() =>
    this.stats()?.averageMonthlyRevenue ?? null
  );

  readonly upcomingBilling = computed(() =>
    this.stats()?.upcomingBilling ?? null
  );

  readonly overdueBilling = computed(() =>
    this.stats()?.overdueBilling ?? null
  );

  // Chargement de tous les abonnements

  load(): Promise<void> {
    if (this.pendingLoad) {
      return this.pendingLoad;
    }

    this.pendingLoad = this.fetchSubscriptions()
      .finally(() => {
        this.pendingLoad = null;
      });

    return this.pendingLoad;
  }

  private async fetchSubscriptions(): Promise<void> {
    this.loadingState.set(true);
    this.errorState.set(null);

    try {
      const subscriptions = await this.findAll();

      this.subscriptionsState.set(subscriptions);
    } catch (error) {
      this.errorState.set(
        this.getErrorMessage(
          error,
          'Impossible de charger les abonnements.'
        )
      );
    } finally {
      this.loadingState.set(false);
    }
  }

  // Chargement des statistiques

  loadStats(): Promise<void> {
    if (this.pendingStatsLoad) {
      return this.pendingStatsLoad;
    }

    this.pendingStatsLoad = this.fetchStats()
      .finally(() => {
        this.pendingStatsLoad = null;
      });

    return this.pendingStatsLoad;
  }

  private async fetchStats(): Promise<void> {
    this.statsLoadingState.set(true);
    this.statsErrorState.set(null);

    try {
      const stats = await firstValueFrom(
        this.http.get<SubscriptionStats>(
          `${this.apiUrl}/stats`
        )
      );

      this.statsState.set(stats);
    } catch (error) {
      this.statsState.set(null);

      this.statsErrorState.set(
        this.getErrorMessage(
          error,
          'Impossible de charger les statistiques.'
        )
      );
    } finally {
      this.statsLoadingState.set(false);
    }
  }

  async refresh(): Promise<void> {
    await Promise.all([
      this.load(),
      this.loadStats()
    ]);
  }

  // Recherche et filtres

  async findAll(
    filters: SubscriptionFilters = {}
  ): Promise<Subscription[]> {
    let params = new HttpParams();

    if (filters.clientId !== undefined) {
      params = params.set(
        'clientId',
        String(filters.clientId)
      );
    }

    if (filters.status) {
      params = params.set('status', filters.status);
    }

    if (filters.billingCycle) {
      params = params.set(
        'billingCycle',
        filters.billingCycle
      );
    }

    return firstValueFrom(
      this.http.get<Subscription[]>(
        this.apiUrl,
        { params }
      )
    );
  }

  findById(id: number): Subscription | undefined {
    return this.subscriptions().find(
      subscription => subscription.id === id
    );
  }

  async getById(id: number): Promise<Subscription> {
    return firstValueFrom(
      this.http.get<Subscription>(
        `${this.apiUrl}/${id}`
      )
    );
  }

  async findByClient(
    clientId: number
  ): Promise<Subscription[]> {
    return this.findAll({ clientId });
  }

  // Création

  async create(
    data: SubscriptionInput
  ): Promise<Subscription> {
    const subscription = await firstValueFrom(
      this.http.post<Subscription>(
        this.apiUrl,
        data
      )
    );

    await this.afterMutation(subscription);

    return subscription;
  }

  // Modification

  async update(
    id: number,
    data: SubscriptionUpdate
  ): Promise<Subscription> {
    const subscription = await firstValueFrom(
      this.http.patch<Subscription>(
        `${this.apiUrl}/${id}`,
        data
      )
    );

    await this.afterMutation(subscription);

    return subscription;
  }

  // Activation

  async activate(id: number): Promise<Subscription> {
    return this.changeStatus(id, 'activate');
  }

  // Suspension

  async suspend(id: number): Promise<Subscription> {
    return this.changeStatus(id, 'suspend');
  }

  // Reprise

  async resume(id: number): Promise<Subscription> {
    return this.changeStatus(id, 'resume');
  }

  // Résiliation définitive

  async cancel(id: number): Promise<Subscription> {
    return this.changeStatus(id, 'cancel');
  }

  private async changeStatus(
    id: number,
    action: 'activate' | 'suspend' | 'resume' | 'cancel'
  ): Promise<Subscription> {
    const subscription = await firstValueFrom(
      this.http.patch<Subscription>(
        `${this.apiUrl}/${id}/${action}`,
        {}
      )
    );

    await this.afterMutation(subscription);

    return subscription;
  }

  // Actualisation après modification

  private async afterMutation(
    subscription: Subscription
  ): Promise<void> {
    await Promise.all([
      this.pendingLoad ?? Promise.resolve(),
      this.pendingStatsLoad ?? Promise.resolve()
    ]);

    this.upsertSubscription(subscription);

    await this.refresh();
  }

  private upsertSubscription(
    subscription: Subscription
  ): void {
    this.subscriptionsState.update(subscriptions => {
      const exists = subscriptions.some(
        item => item.id === subscription.id
      );

      if (!exists) {
        return [subscription, ...subscriptions];
      }

      return subscriptions.map(item =>
        item.id === subscription.id
          ? subscription
          : item
      );
    });
  }

  // Conversion des montants

  getMonthlyAmount(subscription: Subscription): number {
    const amount = Number(subscription.amount);

    switch (subscription.billingCycle) {
      case 'Trimestriel':
        return amount / 3;

      case 'Annuel':
        return amount / 12;

      default:
        return amount;
    }
  }

  getAnnualAmount(subscription: Subscription): number {
    const amount = Number(subscription.amount);

    switch (subscription.billingCycle) {
      case 'Trimestriel':
        return amount * 4;

      case 'Annuel':
        return amount;

      default:
        return amount * 12;
    }
  }

  // Gestion des erreurs

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
