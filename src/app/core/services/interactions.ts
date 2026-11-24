
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

export interface Interaction {
  id: number;
  prospectId: number;
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

  private url(prospectId: number): string {
    return `${environment.apiUrl}/prospects/${prospectId}/interactions`;
  }

  findAll(prospectId: number): Promise<Interaction[]> {
    return firstValueFrom(
      this.http.get<Interaction[]>(this.url(prospectId))
    );
  }

  create(
    prospectId: number,
    data: InteractionInput
  ): Promise<Interaction> {
    return firstValueFrom(
      this.http.post<Interaction>(
        this.url(prospectId),
        data
      )
    );
  }

  update(
    prospectId: number,
    id: number,
    data: Partial<InteractionInput>
  ): Promise<Interaction> {
    return firstValueFrom(
      this.http.patch<Interaction>(
        `${this.url(prospectId)}/${id}`,
        data
      )
    );
  }

  remove(
    prospectId: number,
    id: number
  ): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(
        `${this.url(prospectId)}/${id}`
      )
    );
  }
}
