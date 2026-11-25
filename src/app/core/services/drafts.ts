
import {
  Injectable,
  inject,
  signal
} from '@angular/core';

import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Email } from './emails';

export type DraftMode =
  'new' |
  'prospect' |
  'reply' |
  'forward';

export interface DraftInput {
  mode: DraftMode;
  toEmail: string;
  subject: string;
  content: string;
  prospectId: number | null;
  originalEmailId: number | null;
}

export interface Draft extends DraftInput {

  id: number;

  createdAt: string;
  updatedAt: string;

  prospect?: {
    id: number;
    name: string;
    email: string;
  } | null;

  originalEmail?: Email | null;

}

@Injectable({
  providedIn: 'root'
})
export class DraftsService {

  private readonly http = inject(HttpClient);

  private readonly apiUrl =
    `${environment.apiUrl}/drafts`;

  readonly drafts = signal<Draft[]>([]);
  readonly count = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {

    void this.loadCount();

  }

  // Charger les brouillons

  async load(): Promise<void> {

    this.loading.set(true);
    this.error.set(null);

    try {

      const drafts = await firstValueFrom(
        this.http.get<Draft[]>(this.apiUrl)
      );

      this.drafts.set(drafts);
      this.count.set(drafts.length);

    } catch (error) {

      console.error(error);

      this.error.set(
        'Impossible de récupérer les brouillons.'
      );

    } finally {

      this.loading.set(false);

    }

  }

  // Charger le compteur

  async loadCount(): Promise<void> {

    try {

      const result = await firstValueFrom(
        this.http.get<{ count: number }>(
          `${this.apiUrl}/count`
        )
      );

      this.count.set(result.count);

    } catch (error) {

      console.error(error);

    }

  }

  // Récupérer un brouillon

  async findById(id: number): Promise<Draft> {

    return firstValueFrom(
      this.http.get<Draft>(
        `${this.apiUrl}/${id}`
      )
    );

  }

  // Créer un brouillon

  async create(data: DraftInput): Promise<Draft> {

    const draft = await firstValueFrom(
      this.http.post<Draft>(
        this.apiUrl,
        data
      )
    );

    this.drafts.update(drafts => [
      draft,
      ...drafts.filter(item => item.id !== draft.id)
    ]);

    await this.loadCount();

    return draft;

  }

  // Modifier un brouillon

  async update(
    id: number,
    data: Partial<DraftInput>
  ): Promise<Draft> {

    const draft = await firstValueFrom(
      this.http.patch<Draft>(
        `${this.apiUrl}/${id}`,
        data
      )
    );

    this.drafts.update(drafts => [
      draft,
      ...drafts.filter(item => item.id !== id)
    ]);

    return draft;

  }

  // Supprimer un brouillon

  async remove(id: number): Promise<void> {

    await firstValueFrom(
      this.http.delete<void>(
        `${this.apiUrl}/${id}`
      )
    );

    this.drafts.update(drafts =>
      drafts.filter(draft => draft.id !== id)
    );

    await this.loadCount();

  }

}

