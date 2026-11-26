import {
  Injectable,
  inject,
  signal
} from '@angular/core';

import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ClientStatus } from './clients';

export type MailFolder = 'INBOX' | 'SENT';

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
  clientId: number | null;

  prospect?: {
    id: number;
    name: string;
  } | null;

  client?: {
    id: number;
    name: string;
    status: ClientStatus;
  } | null;
}

export interface FolderStats {
  scanned: number;
  imported: number;
  updated: number;
  linked: number;

  linkedClients?: number;
  linkedProspects?: number;
}

export interface SyncResult extends FolderStats {
  success: boolean;
  folders?: Record<string, FolderStats>;
  warnings?: string[];
}

export interface EmailFilters {
  folder?: MailFolder | 'ALL';
  prospectId?: number;
  clientId?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

@Injectable({
  providedIn: 'root'
})
export class EmailsService {

  private readonly http = inject(HttpClient);

  private readonly apiUrl =
    `${environment.apiUrl}/emails`;

  private readonly storageKey =
    'margeweb-crm-mail-folder';

  private loadVersion = 0;

  readonly activeFolder = signal<MailFolder>(
    this.restoreFolder()
  );

  readonly emails = signal<Email[]>([]);
  readonly unreadCount = signal(0);
  readonly loading = signal(false);
  readonly syncing = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {

    void this.loadUnreadCount();

  }

  // Restaurer le dernier dossier consulté

  private restoreFolder(): MailFolder {

    try {

      const savedFolder = localStorage.getItem(
        this.storageKey
      );

      if (
        savedFolder === 'INBOX' ||
        savedFolder === 'SENT'
      ) {
        return savedFolder;
      }

    } catch (error) {

      console.warn(
        'Impossible de restaurer le dossier.',
        error
      );

    }

    return 'INBOX';

  }

  // Mémoriser le dossier consulté

  private saveFolder(folder: MailFolder): void {

    try {

      localStorage.setItem(
        this.storageKey,
        folder
      );

    } catch (error) {

      console.warn(
        'Impossible de mémoriser le dossier.',
        error
      );

    }

  }

  // Récupérer les messages avec des filtres

  async findAll(
    filters: EmailFilters = {}
  ): Promise<Email[]> {

    const params: Record<string, string> = {
      folder: filters.folder ?? 'INBOX'
    };

    if (filters.prospectId !== undefined) {

      params['prospectId'] =
        String(filters.prospectId);

    }

    if (filters.clientId !== undefined) {

      params['clientId'] =
        String(filters.clientId);

    }

    if (filters.search?.trim()) {

      params['search'] = filters.search.trim();

    }

    if (filters.limit !== undefined) {

      params['limit'] = String(filters.limit);

    }

    if (filters.offset !== undefined) {

      params['offset'] = String(filters.offset);

    }

    return firstValueFrom(
      this.http.get<Email[]>(
        this.apiUrl,
        { params }
      )
    );

  }

  // Récupérer un message précis

  async findById(id: number): Promise<Email> {

    return firstValueFrom(
      this.http.get<Email>(
        `${this.apiUrl}/${id}`
      )
    );

  }

  // Récupérer les messages d'un prospect

  async findByProspect(
    prospectId: number,
    limit = 100,
    offset = 0
  ): Promise<Email[]> {

    return this.findAll({
      folder: 'ALL',
      prospectId,
      limit,
      offset
    });

  }

  // Récupérer les messages d'un client

  async findByClient(
    clientId: number,
    limit = 100,
    offset = 0
  ): Promise<Email[]> {

    return this.findAll({
      folder: 'ALL',
      clientId,
      limit,
      offset
    });

  }

  // Charger la messagerie principale

  async load(
    folder: MailFolder = this.activeFolder()
  ): Promise<void> {

    const version = ++this.loadVersion;

    if (folder !== this.activeFolder()) {

      this.emails.set([]);

    }

    this.activeFolder.set(folder);
    this.saveFolder(folder);

    this.loading.set(true);
    this.error.set(null);

    try {

      const emails = await this.findAll({
        folder
      });

      if (version !== this.loadVersion) return;

      this.emails.set(emails);

      await this.loadUnreadCount();

    } catch (error) {

      if (version !== this.loadVersion) return;

      console.error(error);

      this.error.set(
        'Impossible de récupérer les messages.'
      );

    } finally {

      if (version === this.loadVersion) {

        this.loading.set(false);

      }

    }

  }

  // Compteur de messages non lus

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

  // Marquer un message comme lu ou non lu

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

  // Synchronisation avec Hostinger

  async sync(): Promise<SyncResult> {

    this.syncing.set(true);

    try {

      const result = await firstValueFrom(
        this.http.post<SyncResult>(
          `${this.apiUrl}/sync`,
          {}
        )
      );

      await this.load(this.activeFolder());

      return result;

    } finally {

      this.syncing.set(false);

    }

  }

}