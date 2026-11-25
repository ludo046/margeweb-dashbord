import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Prospect } from './prospects';

export type ClientStatus = 'Actif' | 'Inactif' | 'Archivé';

export interface Client {
  id: number;
  prospectId?: number | null;
  name: string;
  legalName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  siret?: string;
  status: ClientStatus;
  clientSince?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  prospect?: Prospect | null;
}

interface ConversionResponse {
  status: number;
  client: Client;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ClientsService {

  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.apiUrl}/clients`;

  readonly clients = signal<Client[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly activeClients = computed(() =>
    this.clients().filter(client => client.status === 'Actif')
  );

  readonly inactiveClients = computed(() =>
    this.clients().filter(client => client.status === 'Inactif')
  );

  readonly archivedClients = computed(() =>
    this.clients().filter(client => client.status === 'Archivé')
  );

  readonly totalClients = computed(() =>
    this.clients().filter(client => client.status !== 'Archivé').length
  );

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const clients = await firstValueFrom(
        this.http.get<Client[]>(this.apiUrl)
      );

      this.clients.set(clients);

    } catch (error) {
      console.error(error);
      this.error.set('Impossible de récupérer les clients.');

    } finally {
      this.loading.set(false);
    }
  }

  findById(id: number): Client | undefined {
    return this.clients().find(client => client.id === id);
  }

  async getById(id: number): Promise<Client> {
    return firstValueFrom(
      this.http.get<Client>(`${this.apiUrl}/${id}`)
    );
  }

  async create(data: Omit<Client, 'id'>): Promise<Client> {
    const client = await firstValueFrom(
      this.http.post<Client>(this.apiUrl, data)
    );

    this.clients.update(items => [...items, client]);

    return client;
  }

  async update(
    id: number,
    changes: Partial<Client>
  ): Promise<Client> {

    const client = await firstValueFrom(
      this.http.patch<Client>(
        `${this.apiUrl}/${id}`,
        changes
      )
    );

    this.clients.update(items =>
      items.map(item => item.id === id ? client : item)
    );

    return client;
  }

  async archive(id: number): Promise<Client> {
    const client = await firstValueFrom(
      this.http.patch<Client>(
        `${this.apiUrl}/${id}/archive`,
        {}
      )
    );

    this.clients.update(items =>
      items.map(item => item.id === id ? client : item)
    );

    return client;
  }

  async convertProspect(prospectId: number): Promise<Client> {

    const response = await firstValueFrom(
      this.http.post<ConversionResponse>(
        `${this.apiUrl}/convert/${prospectId}`,
        {}
      )
    );

    this.clients.update(items => [
      ...items.filter(item => item.id !== response.client.id),
      response.client
    ]);

    return response.client;
  }
}