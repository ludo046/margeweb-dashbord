import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export type InteractionType =
  | 'email_sent'
  | 'email_received'
  | 'call'
  | 'follow_up'
  | 'meeting'
  | 'note'
  | 'status_change';

export type InteractionOwnerType =
  | 'prospect'
  | 'client';

export interface InteractionOwner {
  type: InteractionOwnerType;
  id: number;
}

export interface Interaction {
  id: number;
  prospectId: number | null;
  clientId: number | null;
  type: InteractionType;
  subject: string;
  content: string;
  occurredAt: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InteractionInput {
  type: InteractionType;
  subject: string;
  content: string;
  occurredAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class InteractionsService {

  private readonly http = inject(HttpClient);

  private url(owner: number | InteractionOwner): string {

    const target: InteractionOwner =
      typeof owner === 'number'
        ? { type: 'prospect', id: owner }
        : owner;

    const resource =
      target.type === 'client'
        ? 'clients'
        : 'prospects';

    return `${environment.apiUrl}/${resource}/${target.id}/interactions`;

  }

  findAll(
    owner: number | InteractionOwner
  ): Promise<Interaction[]> {

    return firstValueFrom(
      this.http.get<Interaction[]>(
        this.url(owner)
      )
    );

  }

  create(
    owner: number | InteractionOwner,
    data: InteractionInput
  ): Promise<Interaction> {

    return firstValueFrom(
      this.http.post<Interaction>(
        this.url(owner),
        data
      )
    );

  }

  update(
    owner: number | InteractionOwner,
    id: number,
    data: Partial<InteractionInput>
  ): Promise<Interaction> {

    return firstValueFrom(
      this.http.patch<Interaction>(
        `${this.url(owner)}/${id}`,
        data
      )
    );

  }

  remove(
    owner: number | InteractionOwner,
    id: number
  ): Promise<void> {

    return firstValueFrom(
      this.http.delete<void>(
        `${this.url(owner)}/${id}`
      )
    );

  }

}