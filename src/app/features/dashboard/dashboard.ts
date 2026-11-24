
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { ProspectsService } from '../../core/services/prospects';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, CurrencyPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard {
  private readonly service = inject(ProspectsService);

  readonly prospects = this.service.prospects;
  readonly loading = this.service.loading;
  readonly error = this.service.error;

  readonly totalProspects = computed(() =>
    this.prospects().length
  );

  readonly contacted = computed(() =>
    this.prospects().filter(p =>
      ['Contacté', 'À relancer', 'En discussion', 'Client']
        .includes(p.status)
    ).length
  );

  readonly toContact = computed(() =>
    this.prospects().filter(p =>
      p.status === 'À contacter'
    ).length
  );

  readonly toFollowUp = computed(() =>
    this.prospects().filter(p =>
      p.status === 'À relancer'
    ).length
  );

  readonly discussions = computed(() =>
    this.prospects().filter(p =>
      p.status === 'En discussion'
    ).length
  );

  readonly clients = computed(() =>
    this.prospects().filter(p =>
      p.status === 'Client'
    ).length
  );

  readonly monthlyRevenue = computed(() =>
    this.prospects()
      .filter(p => p.status === 'Client')
      .reduce((total, p) =>
        total + Number(p.monthlySubscription ?? 0), 0
      )
  );

  readonly potentialRevenue = computed(() =>
    this.prospects()
      .filter(p => p.status !== 'Client')
      .reduce((total, p) =>
        total + Number(p.monthlySubscription ?? 0), 0
      )
  );

  readonly potentialQuotes = computed(() =>
    this.prospects()
      .filter(p => p.status !== 'Client')
      .reduce((total, p) =>
        total + Number(p.creationQuote ?? 0), 0
      )
  );

  readonly conversionRate = computed(() =>
    this.totalProspects() === 0
      ? 0
      : Math.round(
          this.clients() / this.totalProspects() * 100
        )
  );

  readonly recentProspects = computed(() =>
    [...this.prospects()]
      .sort((a, b) => b.id - a.id)
      .slice(0, 5)
  );

  readonly pipeline = computed(() => [
    {
      label: 'À contacter',
      count: this.toContact(),
      color: '#94a3b8'
    },
    {
      label: 'Contacté',
      count: this.prospects().filter(
        p => p.status === 'Contacté'
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
    },
    {
      label: 'Client',
      count: this.clients(),
      color: '#15b8a6'
    }
  ]);

  refresh(): void {
    void this.service.load();
  }
}
