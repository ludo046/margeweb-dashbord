
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

type ProspectStatus =
  | 'À contacter'
  | 'Contacté'
  | 'À relancer'
  | 'En discussion'
  | 'Client';

interface Prospect {
  id: number;
  name: string;
  location: string;
  email: string;
  status: ProspectStatus;
}

@Component({
  selector: 'app-prospects',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './prospects.html',
  styleUrl: './prospects.scss'
})
export class Prospects {
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

  prospects = signal<Prospect[]>([
    {
      id: 1,
      name: 'Trail des Volcans',
      location: 'Auvergne',
      email: 'contact@example.com',
      status: 'À contacter'
    },
    {
      id: 2,
      name: 'Trail des Forêts',
      location: 'Occitanie',
      email: 'organisation@example.com',
      status: 'Contacté'
    },
    {
      id: 3,
      name: 'Trail des Crêtes',
      location: 'Rhône-Alpes',
      email: 'trail@example.com',
      status: 'À relancer'
    }
  ]);

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

  updateStatus(id: number, status: ProspectStatus): void {
    this.prospects.update(items =>
      items.map(item =>
        item.id === id ? { ...item, status } : item
      )
    );
  }
}
