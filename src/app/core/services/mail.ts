
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Interaction } from './interactions';

export interface MailInput {
  subject: string;
  content: string;
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

  sendToProspect(
    prospectId: number,
    data: MailInput
  ): Promise<MailResponse> {

    return firstValueFrom(
      this.http.post<MailResponse>(
        `${environment.apiUrl}/prospects/${prospectId}/send-email`,
        data
      )
    );

  }
}
