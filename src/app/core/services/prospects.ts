import {
  Injectable,
  inject,
  signal,
  computed
} from '@angular/core';

import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ClientsService } from './clients';

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
  needs?: string;
  creationQuote?: number | null;
  monthlySubscription?: number | null;
  firstContact?: string | null;
  nextFollowUp?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProspectsService {

  private readonly http = inject(HttpClient);
  private readonly clientsService = inject(ClientsService);

  private readonly apiUrl =
    `${environment.apiUrl}/prospects`;

  readonly prospects = signal<Prospect[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  private pendingLoad: Promise<void> | null = null;

  // Chargement des données commerciales

  readonly commercialLoading = computed(() =>
    this.loading() ||
    this.clientsService.loading()
  );

  readonly commercialError = computed(() =>
    this.error() ||
    this.clientsService.error()
  );

  // Identifiants des prospects convertis

  readonly convertedProspectIds = computed(() =>
    new Set(
      this.clientsService.clients()
        .map(client => client.prospectId)
        .filter((id): id is number =>
          typeof id === 'number'
        )
    )
  );

  // Prospects non convertis

  readonly activeProspects = computed(() =>
    this.prospects().filter(
      prospect =>
        !this.convertedProspectIds().has(prospect.id)
    )
  );

  // Prospects réellement en cours de prospection

  readonly commercialProspects = computed(() =>
    this.activeProspects().filter(
      prospect => prospect.status !== 'Client'
    )
  );

  // Toutes les relances commerciales

  readonly scheduledFollowUps = computed(() => {

    if (
      this.commercialLoading() ||
      this.commercialError()
    ) {
      return [];
    }

    return this.commercialProspects()
      .filter(prospect => !!prospect.nextFollowUp)
      .sort((a, b) =>
        a.nextFollowUp!.localeCompare(b.nextFollowUp!)
      );

  });

  // Relances urgentes

  readonly urgentFollowUps = computed(() => {

    const now = new Date();

    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0')
    ].join('-');

    return this.scheduledFollowUps().filter(
      prospect => prospect.nextFollowUp! <= today
    );

  });

  readonly urgentFollowUpCount = computed(() =>
    this.urgentFollowUps().length
  );

  constructor() {
    void this.loadCommercialData();
  }

  // Chargement des prospects et clients

  async loadCommercialData(): Promise<void> {

    await Promise.all([
      this.load(),
      this.clientsService.load()
    ]);

  }

  // Chargement des prospects

  load(): Promise<void> {

    if (this.pendingLoad) {
      return this.pendingLoad;
    }

    this.pendingLoad = this.fetchProspects()
      .finally(() => {
        this.pendingLoad = null;
      });

    return this.pendingLoad;

  }

  private async fetchProspects(): Promise<void> {

    this.loading.set(true);
    this.error.set(null);

    try {

      const data = await firstValueFrom(
        this.http.get<Prospect[]>(this.apiUrl)
      );

      this.prospects.set(data);

    } catch (error) {

      console.error(error);

      this.error.set(
        'Impossible de récupérer les prospects.'
      );

    } finally {

      this.loading.set(false);

    }

  }

  // Recherche

  findById(id: number): Prospect | undefined {

    return this.prospects().find(
      prospect => prospect.id === id
    );

  }

  isConverted(id: number): boolean {

    return this.convertedProspectIds().has(id);

  }

  canScheduleFollowUp(id: number): boolean {

    if (
      this.commercialLoading() ||
      this.commercialError()
    ) {
      return false;
    }

    return this.commercialProspects().some(
      prospect => prospect.id === id
    );

  }

  // Création

  async create(
    data: Omit<Prospect, 'id'>
  ): Promise<Prospect> {

    const prospect = await firstValueFrom(
      this.http.post<Prospect>(this.apiUrl, data)
    );

    this.prospects.update(items => [
      ...items,
      prospect
    ]);

    return prospect;

  }

  // Modification

  async update(
    id: number,
    changes: Partial<Prospect>
  ): Promise<Prospect> {

    if (
      changes.nextFollowUp &&
      !this.canScheduleFollowUp(id)
    ) {

      throw new Error(
        'Impossible de programmer une relance pour ce prospect.'
      );

    }

    const prospect = await firstValueFrom(
      this.http.patch<Prospect>(
        `${this.apiUrl}/${id}`,
        changes
      )
    );

    this.prospects.update(items =>
      items.map(item =>
        item.id === id ? prospect : item
      )
    );

    return prospect;

  }

  // Suppression

  async remove(id: number): Promise<void> {

    if (this.isConverted(id)) {

      throw new Error(
        'Impossible de supprimer un prospect converti.'
      );

    }

    await firstValueFrom(
      this.http.delete<void>(
        `${this.apiUrl}/${id}`
      )
    );

    this.prospects.update(items =>
      items.filter(prospect => prospect.id !== id)
    );

  }

  // Relance effectuée

  async completeFollowUp(id: number): Promise<Prospect> {

    if (!this.canScheduleFollowUp(id)) {

      throw new Error(
        'Cette relance commerciale ne peut plus être traitée.'
      );

    }

    const prospect = await firstValueFrom(
      this.http.post<Prospect>(
        `${this.apiUrl}/${id}/complete-follow-up`,
        {}
      )
    );

    this.prospects.update(items =>
      items.map(item =>
        item.id === id ? prospect : item
      )
    );

    return prospect;

  }

}