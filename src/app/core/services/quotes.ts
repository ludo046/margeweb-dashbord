import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ClientStatus } from './clients';
import { BillingCycle } from './subscriptions';

// ======================================================
// TYPES
// ======================================================

export type QuoteStatus =
  | 'Brouillon'
  | 'Émis'
  | 'Envoyé'
  | 'Accepté'
  | 'Refusé'
  | 'Expiré'
  | 'Annulé';

export type QuoteItemType =
  | 'Ponctuelle'
  | 'Récurrente';

export const QUOTE_STATUSES: QuoteStatus[] = [
  'Brouillon',
  'Émis',
  'Envoyé',
  'Accepté',
  'Refusé',
  'Expiré',
  'Annulé'
];

// ======================================================
// RELATIONS
// ======================================================

export interface QuoteProspect {
  id: number;
  name: string;
  email?: string;
  status: string;
}

export interface QuoteClient {
  id: number;
  name: string;
  legalName?: string;
  email?: string;
  status: ClientStatus;
}

// ======================================================
// INFORMATIONS DU DESTINATAIRE
// ======================================================

export interface QuoteRecipient {
  recipientName: string;
  recipientLegalName: string;
  recipientContactName: string;
  recipientEmail: string;
  recipientPhone: string;
  recipientAddress: string;
  recipientPostalCode: string;
  recipientCity: string;
  recipientCountry: string;
  recipientSiret: string;
}

// ======================================================
// INFORMATIONS DE L'ÉMETTEUR
// ======================================================

export interface QuoteIssuerSnapshot {
  tradeName: string;
  legalName: string;
  legalForm: string;
  siren: string;
  siret: string;
  apeCode: string;
  registrationMention: string;
  address: string;
  addressComplement: string;
  postalCode: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  website: string;
  currency: string;
  taxExempt: boolean;
  vatNumber: string;
  taxMention: string;
  legalInformationVerifiedAt: string;
}

// ======================================================
// PRESTATIONS
// ======================================================

export interface QuoteItem {
  id: number;
  quoteId: number;
  position: number;

  type: QuoteItemType;
  name: string;
  description: string;

  quantity: number;
  unit: string;

  unitPriceCents: number;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;

  billingCycle: BillingCycle | null;
  commitmentMonths: number | null;
  autoRenew: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface QuoteItemInput {
  type: QuoteItemType;
  name: string;
  description?: string;

  quantity: number;
  unit?: string;

  unitPriceCents: number;
  discountCents?: number;

  billingCycle?: BillingCycle | null;
  commitmentMonths?: number | null;
  autoRenew?: boolean;
}

// ======================================================
// MONTANTS RÉCURRENTS
// ======================================================

export interface QuoteRecurring {
  byBillingCycle: Record<BillingCycle, number>;
  monthlyCents: number;
  annualCents: number;
}

// ======================================================
// DEVIS
// ======================================================

export interface Quote extends QuoteRecipient {
  id: number;
  number: string | null;

  prospectId: number | null;
  clientId: number | null;

  title: string;
  status: QuoteStatus;

  issueDate: string | null;
  validUntil: string | null;

  issuerSnapshot: QuoteIssuerSnapshot | null;

  currency: string;

  subtotalCents: number;
  discountCents: number;
  globalDiscountCents: number;
  itemDiscountsCents: number;

  totalExcludingTaxCents: number;
  taxCents: number;
  totalIncludingTaxCents: number;

  taxExempt: boolean;
  taxMention: string;

  paymentTerms: string;
  deliveryTerms: string;
  termsAndConditions: string;
  publicNotes: string;
  internalNotes: string;

  issuedAt: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  refusedAt: string | null;
  cancelledAt: string | null;

  refusalReason: string;
  cancellationReason: string;

  createdAt: string;
  updatedAt: string;

  items: QuoteItem[];
  recurring: QuoteRecurring;

  prospect?: QuoteProspect | null;
  client?: QuoteClient | null;
}

// ======================================================
// CRÉATION ET MODIFICATION
// ======================================================

export interface QuoteInput extends Partial<QuoteRecipient> {
  prospectId?: number | null;
  clientId?: number | null;

  title: string;
  validUntil?: string | null;

  items: QuoteItemInput[];
  globalDiscountCents?: number;

  paymentTerms?: string;
  deliveryTerms?: string;
  termsAndConditions?: string;
  publicNotes?: string;
  internalNotes?: string;
}

export type QuoteUpdate = Partial<
  Omit<QuoteInput, 'prospectId' | 'clientId'>
>;

// ======================================================
// FILTRES
// ======================================================

export interface QuoteStatsFilters {
  prospectId?: number;
  clientId?: number;
}

export interface QuoteFilters extends QuoteStatsFilters {
  status?: QuoteStatus;
  search?: string;
}

// ======================================================
// STATISTIQUES
// ======================================================

export interface QuoteStatusStats {
  count: number;
  amountCents: number;
}

export interface QuoteStats {
  asOfDate: string;
  currency: string;
  expirationAlertDays: number;

  totalQuotes: number;
  draftQuotes: number;
  issuedQuotes: number;
  sentQuotes: number;
  acceptedQuotes: number;
  refusedQuotes: number;
  expiredQuotes: number;
  cancelledQuotes: number;

  pendingQuotes: number;
  answeredQuotes: number;

  pendingAmountCents: number;
  acceptedAmountCents: number;
  refusedAmountCents: number;

  averageAcceptedAmountCents: number | null;
  acceptanceRate: number | null;

  pendingRecurringMonthlyCents: number;
  pendingRecurringAnnualCents: number;

  acceptedRecurringMonthlyCents: number;
  acceptedRecurringAnnualCents: number;

  expiringSoonQuotes: number;
  expiringSoonAmountCents: number;

  overdueQuotes: number;
  overdueAmountCents: number;

  missingValidityQuotes: number;

  byStatus: Record<QuoteStatus, QuoteStatusStats>;
}

// ======================================================
// SUPPRESSION
// ======================================================

export interface QuoteDeleteResult {
  success: boolean;
  message: string;
  deletedQuoteId: number;
  deletedItems: number;
}

// ======================================================
// SERVICE
// ======================================================

@Injectable({
  providedIn: 'root'
})
export class QuotesService {

  private readonly http = inject(HttpClient);

  private readonly apiUrl =
    `${environment.apiUrl}/quotes`;

  // ====================================================
  // SIGNALS
  // ====================================================

  private readonly quotesState =
    signal<Quote[]>([]);

  private readonly statsState =
    signal<QuoteStats | null>(null);

  private readonly loadingState = signal(false);
  private readonly statsLoadingState = signal(false);

  private readonly errorState =
    signal<string | null>(null);

  private readonly statsErrorState =
    signal<string | null>(null);

  private pendingLoad: Promise<void> | null = null;
  private pendingStatsLoad: Promise<void> | null = null;

  readonly quotes = this.quotesState.asReadonly();
  readonly stats = this.statsState.asReadonly();

  readonly loading = this.loadingState.asReadonly();
  readonly statsLoading = this.statsLoadingState.asReadonly();

  readonly error = this.errorState.asReadonly();
  readonly statsError = this.statsErrorState.asReadonly();

  // ====================================================
  // SIGNAUX CALCULÉS
  // ====================================================

  readonly totalQuotes = computed(() =>
    this.quotes().length
  );

  readonly draftQuotes = computed(() =>
    this.quotes().filter(
      quote => quote.status === 'Brouillon'
    )
  );

  readonly issuedQuotes = computed(() =>
    this.quotes().filter(
      quote => quote.status === 'Émis'
    )
  );

  readonly sentQuotes = computed(() =>
    this.quotes().filter(
      quote => quote.status === 'Envoyé'
    )
  );

  readonly acceptedQuotes = computed(() =>
    this.quotes().filter(
      quote => quote.status === 'Accepté'
    )
  );

  readonly refusedQuotes = computed(() =>
    this.quotes().filter(
      quote => quote.status === 'Refusé'
    )
  );

  readonly cancelledQuotes = computed(() =>
    this.quotes().filter(
      quote => quote.status === 'Annulé'
    )
  );

  readonly expiredQuotes = computed(() =>
    this.quotes().filter(
      quote => quote.status === 'Expiré'
    )
  );

  readonly pendingQuoteCount = computed(() =>
    this.stats()?.pendingQuotes ?? null
  );

  readonly acceptanceRate = computed(() =>
    this.stats()?.acceptanceRate ?? null
  );

  readonly pendingAmount = computed(() => {
    const stats = this.stats();

    return stats
      ? this.centsToEuros(stats.pendingAmountCents)
      : null;
  });

  readonly acceptedAmount = computed(() => {
    const stats = this.stats();

    return stats
      ? this.centsToEuros(stats.acceptedAmountCents)
      : null;
  });

  readonly acceptedRecurringMonthly = computed(() => {
    const stats = this.stats();

    return stats
      ? this.centsToEuros(
          stats.acceptedRecurringMonthlyCents
        )
      : null;
  });

  readonly acceptedRecurringAnnual = computed(() => {
    const stats = this.stats();

    return stats
      ? this.centsToEuros(
          stats.acceptedRecurringAnnualCents
        )
      : null;
  });

  readonly pendingRecurringMonthly = computed(() => {
    const stats = this.stats();

    return stats
      ? this.centsToEuros(
          stats.pendingRecurringMonthlyCents
        )
      : null;
  });

  readonly averageAcceptedAmount = computed(() => {
    const amount =
      this.stats()?.averageAcceptedAmountCents;

    return amount === null || amount === undefined
      ? null
      : this.centsToEuros(amount);
  });

  readonly expiringSoonQuotes = computed(() =>
    this.stats()?.expiringSoonQuotes ?? null
  );

  readonly overdueQuotes = computed(() =>
    this.stats()?.overdueQuotes ?? null
  );

  // ====================================================
  // CHARGEMENT DES DEVIS
  // ====================================================

  load(): Promise<void> {
    if (this.pendingLoad) {
      return this.pendingLoad;
    }

    this.pendingLoad = this.fetchQuotes()
      .finally(() => {
        this.pendingLoad = null;
      });

    return this.pendingLoad;
  }

  private async fetchQuotes(): Promise<void> {
    this.loadingState.set(true);
    this.errorState.set(null);

    try {
      const quotes = await this.findAll();

      this.quotesState.set(quotes);
    } catch (error) {
      this.errorState.set(
        this.getErrorMessage(
          error,
          'Impossible de charger les devis.'
        )
      );
    } finally {
      this.loadingState.set(false);
    }
  }

  // ====================================================
  // CHARGEMENT DES STATISTIQUES
  // ====================================================

  loadStats(): Promise<void> {
    if (this.pendingStatsLoad) {
      return this.pendingStatsLoad;
    }

    this.pendingStatsLoad = this.fetchStats()
      .finally(() => {
        this.pendingStatsLoad = null;
      });

    return this.pendingStatsLoad;
  }

  private async fetchStats(): Promise<void> {
    this.statsLoadingState.set(true);
    this.statsErrorState.set(null);

    try {
      const stats = await this.getStats();

      this.statsState.set(stats);
    } catch (error) {
      this.statsState.set(null);

      this.statsErrorState.set(
        this.getErrorMessage(
          error,
          'Impossible de charger les statistiques des devis.'
        )
      );
    } finally {
      this.statsLoadingState.set(false);
    }
  }

  async refresh(): Promise<void> {
    await Promise.all([
      this.load(),
      this.loadStats()
    ]);
  }

  // ====================================================
  // RECHERCHE ET FILTRES
  // ====================================================

  async findAll(
    filters: QuoteFilters = {}
  ): Promise<Quote[]> {
    let params = this.buildRelationParams(filters);

    if (filters.status) {
      params = params.set(
        'status',
        filters.status
      );
    }

    if (filters.search?.trim()) {
      params = params.set(
        'search',
        filters.search.trim()
      );
    }

    return firstValueFrom(
      this.http.get<Quote[]>(
        this.apiUrl,
        { params }
      )
    );
  }

  findById(id: number): Quote | undefined {
    return this.quotes().find(
      quote => quote.id === id
    );
  }

  async getById(id: number): Promise<Quote> {
    return firstValueFrom(
      this.http.get<Quote>(
        `${this.apiUrl}/${id}`
      )
    );
  }

  async findByProspect(
    prospectId: number
  ): Promise<Quote[]> {
    return this.findAll({ prospectId });
  }

  async findByClient(
    clientId: number
  ): Promise<Quote[]> {
    return this.findAll({ clientId });
  }

  async getStats(
    filters: QuoteStatsFilters = {}
  ): Promise<QuoteStats> {
    const params = this.buildRelationParams(filters);

    return firstValueFrom(
      this.http.get<QuoteStats>(
        `${this.apiUrl}/stats`,
        { params }
      )
    );
  }

  private buildRelationParams(
    filters: QuoteStatsFilters
  ): HttpParams {
    let params = new HttpParams();

    if (filters.prospectId !== undefined) {
      params = params.set(
        'prospectId',
        String(filters.prospectId)
      );
    }

    if (filters.clientId !== undefined) {
      params = params.set(
        'clientId',
        String(filters.clientId)
      );
    }

    return params;
  }

  // ====================================================
  // CRÉATION
  // ====================================================

  async create(
    data: QuoteInput
  ): Promise<Quote> {
    const quote = await firstValueFrom(
      this.http.post<Quote>(
        this.apiUrl,
        data
      )
    );

    await this.afterMutation(quote);

    return quote;
  }

  // ====================================================
  // MODIFICATION
  // ====================================================

  async update(
    id: number,
    data: QuoteUpdate
  ): Promise<Quote> {
    const quote = await firstValueFrom(
      this.http.patch<Quote>(
        `${this.apiUrl}/${id}`,
        data
      )
    );

    await this.afterMutation(quote);

    return quote;
  }

  // ====================================================
  // ÉMISSION DÉFINITIVE
  // ====================================================

  async issue(id: number): Promise<Quote> {
    return this.changeStatus(id, 'issue');
  }

  // ====================================================
  // ACCEPTATION
  // ====================================================

  async accept(id: number): Promise<Quote> {
    return this.changeStatus(id, 'accept');
  }

  // ====================================================
  // REFUS
  // ====================================================

  async refuse(
    id: number,
    reason = ''
  ): Promise<Quote> {
    return this.changeStatus(
      id,
      'refuse',
      { reason: reason.trim() }
    );
  }

  // ====================================================
  // ANNULATION
  // ====================================================

  async cancel(
    id: number,
    reason: string
  ): Promise<Quote> {
    const normalizedReason = reason.trim();

    if (!normalizedReason) {
      throw new Error(
        'Le motif d’annulation est obligatoire.'
      );
    }

    return this.changeStatus(
      id,
      'cancel',
      { reason: normalizedReason }
    );
  }

  // ====================================================
  // EXPIRATION
  // ====================================================

  async expire(id: number): Promise<Quote> {
    return this.changeStatus(id, 'expire');
  }

  // ====================================================
  // CHANGEMENT DE STATUT
  // ====================================================

  private async changeStatus(
    id: number,
    action:
      | 'issue'
      | 'accept'
      | 'refuse'
      | 'cancel'
      | 'expire',
    data: { reason?: string } = {}
  ): Promise<Quote> {
    const quote = await firstValueFrom(
      this.http.post<Quote>(
        `${this.apiUrl}/${id}/${action}`,
        data
      )
    );

    await this.afterMutation(quote);

    return quote;
  }

  // ====================================================
  // DUPLICATION
  // ====================================================

  async duplicate(id: number): Promise<Quote> {
    const quote = await firstValueFrom(
      this.http.post<Quote>(
        `${this.apiUrl}/${id}/duplicate`,
        {}
      )
    );

    await this.afterMutation(quote);

    return quote;
  }

  // ====================================================
  // SUPPRESSION D'UN BROUILLON
  // ====================================================

  async remove(id: number): Promise<QuoteDeleteResult> {
    const result = await firstValueFrom(
      this.http.delete<QuoteDeleteResult>(
        `${this.apiUrl}/${id}`
      )
    );

    await this.waitForPendingLoads();

    this.quotesState.update(quotes =>
      quotes.filter(quote => quote.id !== id)
    );

    await this.refresh();

    return result;
  }

  // ====================================================
  // ACTUALISATION APRÈS MODIFICATION
  // ====================================================

  private async waitForPendingLoads(): Promise<void> {
    await Promise.all([
      this.pendingLoad ?? Promise.resolve(),
      this.pendingStatsLoad ?? Promise.resolve()
    ]);
  }

  private async afterMutation(
    quote: Quote
  ): Promise<void> {
    await this.waitForPendingLoads();

    this.upsertQuote(quote);

    await this.refresh();
  }

  private upsertQuote(quote: Quote): void {
    this.quotesState.update(quotes => {
      const exists = quotes.some(
        item => item.id === quote.id
      );

      if (!exists) {
        return [quote, ...quotes];
      }

      return quotes.map(item =>
        item.id === quote.id
          ? quote
          : item
      );
    });
  }

  // ====================================================
  // DATES
  // ====================================================

  getBusinessDate(date = new Date()): string {
    const parts = new Intl.DateTimeFormat(
      'fr-FR',
      {
        timeZone: 'Europe/Paris',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }
    ).formatToParts(date);

    const year = parts.find(
      part => part.type === 'year'
    )?.value;

    const month = parts.find(
      part => part.type === 'month'
    )?.value;

    const day = parts.find(
      part => part.type === 'day'
    )?.value;

    return `${year}-${month}-${day}`;
  }

  isPastValidity(
    quote: Quote,
    date = new Date()
  ): boolean {
    if (!quote.validUntil) {
      return false;
    }

    return quote.validUntil < this.getBusinessDate(date);
  }

  isOverdue(quote: Quote): boolean {
    return this.isPending(quote)
      && this.isPastValidity(quote);
  }

  // ====================================================
  // AUTORISATIONS D'ACTIONS
  // ====================================================

  isDraft(quote: Quote): boolean {
    return quote.status === 'Brouillon';
  }

  isPending(quote: Quote): boolean {
    return quote.status === 'Émis'
      || quote.status === 'Envoyé';
  }

  canEdit(quote: Quote): boolean {
    return this.isDraft(quote);
  }

  canDelete(quote: Quote): boolean {
    return this.isDraft(quote)
      && quote.number === null
      && quote.issuedAt === null
      && quote.issueDate === null
      && quote.issuerSnapshot === null
      && quote.sentAt === null
      && quote.acceptedAt === null
      && quote.refusedAt === null
      && quote.cancelledAt === null;
  }

  canIssue(quote: Quote): boolean {
    return this.isDraft(quote);
  }

  canAccept(quote: Quote): boolean {
    return this.isPending(quote)
      && !this.isPastValidity(quote);
  }

  canRefuse(quote: Quote): boolean {
    return this.isPending(quote);
  }

  canCancel(quote: Quote): boolean {
    return this.isPending(quote);
  }

  canExpire(quote: Quote): boolean {
    return this.isPending(quote)
      && this.isPastValidity(quote);
  }

  canDuplicate(quote: Quote): boolean {
    return quote.client?.status !== 'Archivé';
  }

  // ====================================================
  // CONVERSION DES MONTANTS
  // ====================================================

  centsToEuros(cents: number): number {
    return cents / 100;
  }

  eurosToCents(euros: number | string): number {
    const normalized = typeof euros === 'string'
      ? euros.trim().replace(',', '.')
      : String(euros);

    if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
      throw new Error(
        'Le montant doit être positif ou nul, avec deux décimales maximum.'
      );
    }

    const [whole, fraction = ''] = normalized.split('.');

    const cents =
      Number(whole) * 100
      + Number(fraction.padEnd(2, '0'));

    if (!Number.isSafeInteger(cents)) {
      throw new Error('Le montant est trop élevé.');
    }

    return cents;
  }

  formatAmount(cents: number): string {
    return new Intl.NumberFormat(
      'fr-FR',
      {
        style: 'currency',
        currency: 'EUR'
      }
    ).format(this.centsToEuros(cents));
  }

  getQuoteAmount(quote: Quote): number {
    return this.centsToEuros(
      quote.totalIncludingTaxCents
    );
  }

  getMonthlyAmount(quote: Quote): number {
    return this.centsToEuros(
      quote.recurring.monthlyCents
    );
  }

  getAnnualAmount(quote: Quote): number {
    return this.centsToEuros(
      quote.recurring.annualCents
    );
  }

  // ====================================================
  // AFFICHAGE
  // ====================================================

  getQuoteLabel(quote: Quote): string {
    return quote.number ?? `Brouillon #${quote.id}`;
  }

  getRecipientLabel(quote: Quote): string {
    return quote.recipientLegalName
      || quote.recipientName
      || quote.client?.name
      || quote.prospect?.name
      || 'Destinataire non renseigné';
  }

  getStatusColor(status: QuoteStatus): string {
    switch (status) {
      case 'Brouillon':
        return '#94a3b8';

      case 'Émis':
        return '#3b82f6';

      case 'Envoyé':
        return '#8b5cf6';

      case 'Accepté':
        return '#16a34a';

      case 'Refusé':
        return '#dc2626';

      case 'Expiré':
        return '#d97706';

      case 'Annulé':
        return '#64748b';
    }
  }

  // ====================================================
  // GESTION DES ERREURS
  // ====================================================

  getErrorMessage(
    error: unknown,
    fallback = 'Une erreur est survenue.'
  ): string {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error?.message === 'string') {
        return error.error.message;
      }

      if (error.status === 0) {
        return 'Impossible de joindre le serveur MargeWeb.';
      }
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallback;
  }
}