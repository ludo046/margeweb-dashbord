import {
  Component,
  computed,
  inject,
  signal
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
  ProspectStatus,
  ProspectsService
} from '../../core/services/prospects';

import {
  ClientsService
} from '../../core/services/clients';

@Component({
  selector: 'app-prospects',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './prospects.html',
  styleUrl: './prospects.scss'
})
export class Prospects {

  private readonly service = inject(ProspectsService);
  private readonly clientsService = inject(ClientsService);

  // Exclure les prospects réellement convertis

  readonly prospects = computed(() => {

    const convertedIds = new Set(
      this.clientsService.clients()
        .map(client => client.prospectId)
    );

    return this.service.prospects().filter(
      prospect => !convertedIds.has(prospect.id)
    );

  });

  readonly loading = computed(() =>
    this.service.loading() ||
    this.clientsService.loading()
  );

  readonly error = computed(() =>
    this.service.error() ||
    this.clientsService.error()
  );

  readonly search = signal('');
  readonly statusFilter = signal('Tous');

  readonly commercialStatuses: ProspectStatus[] = [
    'À contacter',
    'Contacté',
    'À relancer',
    'En discussion'
  ];

  readonly statuses = [
    'Tous',
    ...this.commercialStatuses
  ];

  constructor() {
    void this.refresh();
  }

  // Actualisation des données

  async refresh(): Promise<void> {

    await Promise.all([
      this.service.load(),
      this.clientsService.load()
    ]);

  }

  // Recherche et filtrage

  readonly filteredProspects = computed(() => {

    if (this.loading() || this.error()) {
      return [];
    }

    const query = this.search().trim().toLowerCase();
    const status = this.statusFilter();

    return this.prospects().filter(prospect => {

      const matchesSearch =
        (prospect.name ?? '').toLowerCase().includes(query) ||
        (prospect.location ?? '').toLowerCase().includes(query) ||
        (prospect.email ?? '').toLowerCase().includes(query);

      const matchesStatus =
        status === 'Tous' || prospect.status === status;

      return matchesSearch && matchesStatus;

    });

  });

  // Modification du statut commercial

  async updateStatus(
    id: number,
    status: ProspectStatus
  ): Promise<void> {

    if (
      !this.commercialStatuses.includes(status) ||
      this.loading() ||
      this.error() ||
      !this.prospects().some(prospect => prospect.id === id)
    ) {
      return;
    }

    try {

      await this.service.update(id, { status });

    } catch (error) {

      console.error(error);

      alert('Impossible de modifier le statut.');

      await this.refresh();

    }

  }
}