
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Email {
  id: number;
  folder: string;
  fromName: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  textContent: string;
  receivedAt: string;
  isRead: boolean;
  hasAttachments: boolean;
  prospectId: number | null;

  prospect?: {
    id: number;
    name: string;
  } | null;
}

export interface SyncResult {
  success: boolean;
  scanned: number;
  imported: number;
  updated: number;
  linked: number;
}

@Injectable({
  providedIn: 'root'
})
export class EmailsService {

  private readonly http = inject(HttpClient);

  private readonly apiUrl =
    `${environment.apiUrl}/emails`;

  readonly emails = signal<Email[]>([]);
  readonly unreadCount = signal(0);
  readonly loading = signal(false);
  readonly syncing = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    void this.loadUnreadCount();
  }

  async load(folder = 'INBOX'): Promise<void> {

    this.loading.set(true);
    this.error.set(null);

    try {

      const emails = await firstValueFrom(
        this.http.get<Email[]>(this.apiUrl, {
          params: { folder }
        })
      );

      this.emails.set(emails);

      await this.loadUnreadCount();

    } catch (error) {

      console.error(error);

      this.error.set(
        'Impossible de récupérer les messages.'
      );

    } finally {

      this.loading.set(false);

    }
  }

  async loadUnreadCount(): Promise<void> {

    try {

      const result = await firstValueFrom(
        this.http.get<{ count: number }>(
          `${this.apiUrl}/unread-count`
        )
      );

      this.unreadCount.set(result.count);

    } catch (error) {
      console.error(error);
    }
  }

  async markAsRead(
    id: number,
    isRead: boolean
  ): Promise<void> {

    await firstValueFrom(
      this.http.patch(
        `${this.apiUrl}/${id}/read`,
        { isRead }
      )
    );

    this.emails.update(emails =>
      emails.map(email =>
        email.id === id
          ? { ...email, isRead }
          : email
      )
    );

    await this.loadUnreadCount();
  }

  async sync(): Promise<SyncResult> {

    this.syncing.set(true);

    try {

      const result = await firstValueFrom(
        this.http.post<SyncResult>(
          `${this.apiUrl}/sync`,
          {}
        )
      );

      await this.load();

      return result;

    } finally {

      this.syncing.set(false);

    }
  }
}
