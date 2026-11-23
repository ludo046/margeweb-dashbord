
import { Injectable, signal } from '@angular/core';

export type ProspectStatus =
  | 'À contacter'
  | 'Contacté'
  | 'À relancer'
  | 'En discussion'
  | 'Client';

export interface Prospect {
  id: number;
  name: string;
  location: string;
  email: string;
  status: ProspectStatus;
  website?: string;
  phone?: string;
  notes?: string;
  creationQuote?: number;
  monthlySubscription?: number;
  nextFollowUp?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProspectsService {
  readonly prospects = signal<Prospect[]>([
    {
      id: 1,
      name: 'Trail des Volcans',
      location: 'Auvergne',
      email: 'contact@example.com',
      status: 'À contacter',
      notes: 'Premier contact à préparer.',
      creationQuote: 900,
      monthlySubscription: 39
    },
    {
      id: 2,
      name: 'Trail des Forêts',
      location: 'Occitanie',
      email: 'organisation@example.com',
      status: 'Contacté',
      notes: 'En attente de réponse.'
    },
    {
      id: 3,
      name: 'Trail des Crêtes',
      location: 'Rhône-Alpes',
      email: 'trail@example.com',
      status: 'À relancer'
    }
  ]);

  findById(id: number): Prospect | undefined {
    return this.prospects().find(p => p.id === id);
  }

  update(id: number, changes: Partial<Prospect>): void {
    this.prospects.update(items =>
      items.map(p =>
        p.id === id ? { ...p, ...changes } : p
      )
    );
  }
}
