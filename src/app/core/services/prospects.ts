
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

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

  private readonly apiUrl =
    `${environment.apiUrl}/prospects`;

  readonly prospects = signal<Prospect[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
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

  findById(id: number): Prospect | undefined {
    return this.prospects().find(p => p.id === id);
  }

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

  async update(
    id: number,
    changes: Partial<Prospect>
  ): Promise<Prospect> {

    const prospect = await firstValueFrom(
      this.http.patch<Prospect>(
        `${this.apiUrl}/${id}`,
        changes
      )
    );

    this.prospects.update(items =>
      items.map(p => p.id === id ? prospect : p)
    );

    return prospect;
  }

  async remove(id: number): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(
        `${this.apiUrl}/${id}`
      )
    );

    this.prospects.update(items =>
      items.filter(p => p.id !== id)
    );
  }
}
