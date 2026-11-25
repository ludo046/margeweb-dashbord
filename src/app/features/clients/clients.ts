import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';

import {
  ClientsService
} from '../../core/services/clients';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './clients.html',
  styleUrl: './clients.scss'
})
export class Clients {

  private readonly service = inject(ClientsService);

  readonly clients = this.service.clients;
  readonly loading = this.service.loading;
  readonly error = this.service.error;

  readonly totalClients = this.service.totalClients;
  readonly activeClients = this.service.activeClients;
  readonly inactiveClients = this.service.inactiveClients;
  readonly archivedClients = this.service.archivedClients;

  readonly search = signal('');
  readonly statusFilter = signal('Tous');

  readonly statuses = [
    'Tous',
    'Actif',
    'Inactif',
    'Archivé'
  ];

  readonly filteredClients = computed(() => {

    const search = this.search().trim().toLowerCase();
    const status = this.statusFilter();

    return this.clients()
      .filter(client => {

        const matchesSearch = [
          client.name,
          client.legalName,
          client.contactName,
          client.email,
          client.city,
          client.siret
        ].some(value =>
          (value ?? '').toLowerCase().includes(search)
        );

        const matchesStatus = status === 'Tous'
          ? client.status !== 'Archivé'
          : client.status === status;

        return matchesSearch && matchesStatus;

      })
      .sort((a, b) =>
        a.name.localeCompare(b.name, 'fr')
      );

  });

  constructor() {
    void this.service.load();
  }

  refresh(): void {
    void this.service.load();
  }
}