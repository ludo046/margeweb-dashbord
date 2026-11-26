import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Interaction } from './interactions';

export interface MailInput {
  subject: string;
  content: string;
}

export interface NewMailInput extends MailInput {
  to: string;
}

export interface MailResponse {
  success: boolean;
  message?: string;
  warning?: string;
  messageId?: string;
  interaction?: Interaction | null;
}

@Injectable({
  providedIn: 'root'
})
export class MailService {

  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  // Envoi depuis une fiche prospect

  sendToProspect(
    prospectId: number,
    data: MailInput
  ): Promise<MailResponse> {

    return firstValueFrom(
      this.http.post<MailResponse>(
        `${this.apiUrl}/prospects/${prospectId}/send-email`,
        data
      )
    );
  }

  // Envoi depuis une fiche client

  sendToClient(
    clientId: number,
    data: MailInput
  ): Promise<MailResponse> {

    return firstValueFrom(
      this.http.post<MailResponse>(
        `${this.apiUrl}/clients/${clientId}/send-email`,
        data
      )
    );
  }

  // Nouveau message libre

  sendNew(data: NewMailInput): Promise<MailResponse> {

    return firstValueFrom(
      this.http.post<MailResponse>(
        `${this.apiUrl}/emails/send`,
        data
      )
    );
  }

  // Réponse à un message reçu

  reply(
    emailId: number,
    data: MailInput
  ): Promise<MailResponse> {

    return firstValueFrom(
      this.http.post<MailResponse>(
        `${this.apiUrl}/emails/${emailId}/reply`,
        data
      )
    );
  }
}