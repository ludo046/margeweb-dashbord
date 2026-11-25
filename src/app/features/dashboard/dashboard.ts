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
  private readonly clientsService = inject(ClientsService);

  readonly loading = computed(() =>
    this.service.loading() ||
    this.clientsService.loading()
  );

  readonly error = computed(() =>
    this.service.error() ||
    this.clientsService.error()
  );

  // Clients

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

  // Prospects convertis

  readonly convertedProspectIds = computed(() =>
    new Set(
      this.allClients()
        .map(client => client.prospectId)
        .filter((id): id is number => typeof id === 'number')
    )
  );

  readonly convertedProspects = computed(() =>
    this.convertedProspectIds().size
  );

  // Prospects non convertis

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

  // Opportunités commerciales

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

  // Potentiel financier

  readonly potentialRevenue = computed(() =>
    this.commercialProspects().reduce(
      (total, prospect) =>
        total + Number(prospect.monthlySubscription ?? 0),
      0
    )
  );

  readonly potentialQuotes = computed(() =>
    this.commercialProspects().reduce(
      (total, prospect) =>
        total + Number(prospect.creationQuote ?? 0),
      0
    )
  );

  // Taux de conversion

  readonly conversionRate = computed(() => {

    const converted = this.convertedProspects();

    const total = this.totalProspects() + converted;

    return total === 0
      ? 0
      : Math.round(converted / total * 100);

  });

  // Derniers prospects

  readonly recentProspects = computed(() =>
    [...this.prospects()]
      .sort((a, b) => b.id - a.id)
      .slice(0, 5)
  );

  // Pipeline commercial

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

  // Relances urgentes

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

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {

    await Promise.all([
      this.service.load(),
      this.clientsService.load()
    ]);

  }

}