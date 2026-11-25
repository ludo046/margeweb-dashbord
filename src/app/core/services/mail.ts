
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
  interaction?: Interaction;
}

@Injectable({
  providedIn: 'root'
})
export class MailService {

  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

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

  sendNew(data: NewMailInput): Promise<MailResponse> {

    return firstValueFrom(
      this.http.post<MailResponse>(
        `${this.apiUrl}/emails/send`,
        data
      )
    );
  }

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
