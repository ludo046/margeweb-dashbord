
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ProspectStatus,
  ProspectsService
} from '../../core/services/prospects';

@Component({
  selector: 'app-prospects',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './prospects.html',
  styleUrl: './prospects.scss'
})
export class Prospects {
  private readonly service = inject(ProspectsService);

  readonly prospects = this.service.prospects;

  search = signal('');
  statusFilter = signal('Tous');

  statuses = [
    'Tous',
    'À contacter',
    'Contacté',
    'À relancer',
    'En discussion',
    'Client'
  ];

  filteredProspects = computed(() => {
    const query = this.search().trim().toLowerCase();
    const status = this.statusFilter();

    return this.prospects().filter(prospect => {
      const matchesSearch =
        prospect.name.toLowerCase().includes(query) ||
        prospect.location.toLowerCase().includes(query) ||
        prospect.email.toLowerCase().includes(query);

      const matchesStatus =
        status === 'Tous' || prospect.status === status;

      return matchesSearch && matchesStatus;
    });
  });

 async updateStatus(
  id: number,
  status: ProspectStatus
): Promise<void> {
  try {
    await this.service.update(id, { status });
  } catch (error) {
    console.error(error);
    alert('Impossible de modifier le statut.');
    await this.service.load();
  }
}
}
