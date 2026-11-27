import {
  Component,
  computed,
  inject
} from '@angular/core';

import { RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';

import {
  ProspectsService
} from '../../core/services/prospects';

import {
  ClientsService
} from '../../core/services/clients';

import {
  SubscriptionsService
} from '../../core/services/subscriptions';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    CurrencyPipe
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard {

  private readonly service = inject(ProspectsService);

  private readonly clientsService = inject(
    ClientsService
  );

  private readonly subscriptionsService = inject(
    SubscriptionsService
  );

  // ==========================================
  // CHARGEMENT DES DONNÉES COMMERCIALES
  // ==========================================

  readonly loading = computed(() =>
    this.service.loading() ||
    this.clientsService.loading()
  );

  readonly error = computed(() =>
    this.service.error() ||
    this.clientsService.error()
  );

  // ==========================================
  // CLIENTS
  // ==========================================

  readonly allClients = this.clientsService.clients;

  readonly clients = computed(() =>
    this.allClients().filter(
      client => client.status === 'Actif'
    ).length
  );

  readonly inactiveClients = computed(() =>
    this.allClients().filter(
      client => client.status === 'Inactif'
    ).length
  );

  readonly archivedClients = computed(() =>
    this.allClients().filter(
      client => client.status === 'Archivé'
    ).length
  );

  readonly totalClients = computed(() =>
    this.clients() + this.inactiveClients()
  );

  // ==========================================
  // PROSPECTS CONVERTIS
  // ==========================================

  readonly convertedProspectIds = computed(() =>
    new Set(
      this.allClients()
        .map(client => client.prospectId)
        .filter((id): id is number =>
          typeof id === 'number'
        )
    )
  );

  readonly convertedProspects = computed(() =>
    this.convertedProspectIds().size
  );

  // ==========================================
  // PROSPECTS NON CONVERTIS
  // ==========================================

  readonly prospects = computed(() =>
    this.service.prospects().filter(
      prospect =>
        !this.convertedProspectIds().has(prospect.id)
    )
  );

  // Anciennes conversions à finaliser

  readonly pendingConversions = computed(() =>
    this.prospects().filter(
      prospect => prospect.status === 'Client'
    )
  );

  // ==========================================
  // OPPORTUNITÉS COMMERCIALES
  // ==========================================

  readonly commercialProspects = computed(() =>
    this.prospects().filter(
      prospect => prospect.status !== 'Client'
    )
  );

  readonly totalProspects = computed(() =>
    this.prospects().length
  );

  readonly totalOpportunities = computed(() =>
    this.commercialProspects().length
  );

  readonly contacted = computed(() =>
    this.commercialProspects().filter(
      prospect =>
        ['Contacté', 'À relancer', 'En discussion']
          .includes(prospect.status)
    ).length
  );

  readonly toContact = computed(() =>
    this.commercialProspects().filter(
      prospect => prospect.status === 'À contacter'
    ).length
  );

  readonly toFollowUp = computed(() =>
    this.commercialProspects().filter(
      prospect => prospect.status === 'À relancer'
    ).length
  );

  readonly discussions = computed(() =>
    this.commercialProspects().filter(
      prospect => prospect.status === 'En discussion'
    ).length
  );

  // ==========================================
  // POTENTIEL FINANCIER COMMERCIAL
  // ==========================================

  readonly potentialRevenue = computed(() =>
    this.commercialProspects().reduce(
      (total, prospect) =>
        total + Number(
          prospect.monthlySubscription ?? 0
        ),
      0
    )
  );

  readonly potentialQuotes = computed(() =>
    this.commercialProspects().reduce(
      (total, prospect) =>
        total + Number(
          prospect.creationQuote ?? 0
        ),
      0
    )
  );

  // ==========================================
  // STATISTIQUES DES ABONNEMENTS
  // ==========================================

  readonly subscriptionStats =
    this.subscriptionsService.stats;

  readonly subscriptionsLoading =
    this.subscriptionsService.statsLoading;

  readonly subscriptionsError =
    this.subscriptionsService.statsError;

  readonly subscriptionsReady = computed(() =>
    !this.subscriptionsLoading() &&
    !this.subscriptionsError() &&
    this.subscriptionStats() !== null
  );

  // Nombre total d'abonnements, historique inclus

  readonly totalSubscriptions = computed(() =>
    this.subscriptionsReady()
      ? this.subscriptionStats()!.total
      : null
  );

  // Abonnements générant des revenus récurrents

  readonly activeSubscriptions = computed(() =>
    this.subscriptionsReady()
      ? this.subscriptionStats()!.recurringSubscriptions
      : null
  );

  // Abonnements à venir

  readonly upcomingSubscriptions = computed(() =>
    this.subscriptionsReady()
      ? this.subscriptionStats()!.upcoming
      : null
  );

  // Abonnements suspendus

  readonly suspendedSubscriptions = computed(() =>
    this.subscriptionsReady()
      ? this.subscriptionStats()!.suspended
      : null
  );

  // Abonnements résiliés

  readonly cancelledSubscriptions = computed(() =>
    this.subscriptionsReady()
      ? this.subscriptionStats()!.cancelled
      : null
  );

  // Abonnements dont la date de fin est dépassée

  readonly expiredSubscriptions = computed(() =>
    this.subscriptionsReady()
      ? this.subscriptionStats()!.expired
      : null
  );

  // ==========================================
  // REVENUS RÉCURRENTS
  // ==========================================

  // Monthly Recurring Revenue

  readonly monthlyRevenue = computed(() =>
    this.subscriptionsReady()
      ? this.subscriptionStats()!.mrr
      : null
  );

  // Annual Recurring Revenue

  readonly annualRevenue = computed(() =>
    this.subscriptionsReady()
      ? this.subscriptionStats()!.arr
      : null
  );

  // Revenu mensuel moyen par abonnement actif

  readonly averageMonthlyRevenue = computed(() =>
    this.subscriptionsReady()
      ? this.subscriptionStats()!.averageMonthlyRevenue
      : null
  );

  // ==========================================
  // ÉCHÉANCES DES ABONNEMENTS
  // ==========================================

  // Échéances prévues dans les 30 prochains jours

  readonly upcomingBilling = computed(() =>
    this.subscriptionsReady()
      ? this.subscriptionStats()!.upcomingBilling
      : null
  );

  // Échéances dont la date est dépassée

  readonly overdueBilling = computed(() =>
    this.subscriptionsReady()
      ? this.subscriptionStats()!.overdueBilling
      : null
  );

  readonly hasOverdueBilling = computed(() =>
    (this.overdueBilling() ?? 0) > 0
  );

  readonly hasExpiredSubscriptions = computed(() =>
    (this.expiredSubscriptions() ?? 0) > 0
  );

  readonly hasSubscriptionAlerts = computed(() =>
    this.hasOverdueBilling() ||
    this.hasExpiredSubscriptions()
  );

  // ==========================================
  // RÉPARTITION DES ABONNEMENTS
  // ==========================================

  readonly billingDistribution = computed(() => {

    const stats = this.subscriptionStats();

    if (!this.subscriptionsReady() || !stats) {
      return [];
    }

    const total = stats.recurringSubscriptions;

    const distribution = [
      {
        label: 'Mensuel',
        count: stats.byBillingCycle.Mensuel,
        color: '#15b8a6'
      },
      {
        label: 'Trimestriel',
        count: stats.byBillingCycle.Trimestriel,
        color: '#3b82f6'
      },
      {
        label: 'Annuel',
        count: stats.byBillingCycle.Annuel,
        color: '#8b5cf6'
      }
    ];

    return distribution.map(item => ({
      ...item,
      percentage: total > 0
        ? Math.round(item.count / total * 100)
        : 0
    }));

  });

  // ==========================================
  // TAUX DE CONVERSION
  // ==========================================

  readonly conversionRate = computed(() => {

    const converted = this.convertedProspects();

    const total = this.totalProspects() + converted;

    return total === 0
      ? 0
      : Math.round(converted / total * 100);

  });

  // ==========================================
  // DERNIERS PROSPECTS
  // ==========================================

  readonly recentProspects = computed(() =>
    [...this.prospects()]
      .sort((a, b) => b.id - a.id)
      .slice(0, 5)
  );

  // ==========================================
  // PIPELINE COMMERCIAL
  // ==========================================

  readonly pipeline = computed(() => [
    {
      label: 'À contacter',
      count: this.toContact(),
      color: '#94a3b8'
    },
    {
      label: 'Contacté',
      count: this.commercialProspects().filter(
        prospect => prospect.status === 'Contacté'
      ).length,
      color: '#3b82f6'
    },
    {
      label: 'À relancer',
      count: this.toFollowUp(),
      color: '#f59e0b'
    },
    {
      label: 'En discussion',
      count: this.discussions(),
      color: '#8b5cf6'
    }
  ]);

  // ==========================================
  // RELANCES URGENTES
  // ==========================================

  readonly urgentFollowUpCount = computed(() => {

    const now = new Date();

    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0')
    ].join('-');

    return this.commercialProspects().filter(
      prospect =>
        prospect.nextFollowUp &&
        prospect.nextFollowUp <= today
    ).length;

  });

  // ==========================================
  // CHARGEMENT INITIAL
  // ==========================================

  constructor() {
    void this.refresh();
  }

  // ==========================================
  // ACTUALISATION
  // ==========================================

  async refresh(): Promise<void> {

    await Promise.all([
      this.service.load(),
      this.clientsService.load(),
      this.subscriptionsService.loadStats()
    ]);

  }

  async refreshSubscriptions(): Promise<void> {

    await this.subscriptionsService.loadStats();

  }

}
