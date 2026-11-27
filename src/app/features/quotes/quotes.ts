import {
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';

import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';

import {
  Quote,
  QuoteStatus,
  QUOTE_STATUSES,
  QuotesService
} from '../../core/services/quotes';

type QuoteAction =
  | 'issue'
  | 'accept'
  | 'refuse'
  | 'cancel'
  | 'expire'
  | 'duplicate'
  | 'remove';

interface ActionConfirmation {
  quote: Quote;
  action: QuoteAction;
  title: string;
  message: string;
  buttonLabel: string;
  dangerous: boolean;
}

@Component({
  selector: 'app-quotes',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    DatePipe
  ],
  templateUrl: './quotes.html',
  styleUrl: './quotes.scss'
})
export class Quotes implements OnInit {

  readonly quotesService = inject(QuotesService);
  private readonly router = inject(Router);

  readonly quotes = this.quotesService.quotes;
  readonly stats = this.quotesService.stats;

  readonly loading = this.quotesService.loading;
  readonly statsLoading = this.quotesService.statsLoading;

  readonly error = this.quotesService.error;
  readonly statsError = this.quotesService.statsError;

  readonly statuses = QUOTE_STATUSES;

  readonly search = signal('');

  readonly statusFilter =
    signal<QuoteStatus | 'Tous'>('Tous');

  readonly recipientFilter =
    signal<'Tous' | 'Prospects' | 'Clients'>('Tous');

  readonly validityFilter =
    signal<'Tous' | 'En retard'>('Tous');

  readonly confirmation =
    signal<ActionConfirmation | null>(null);

  readonly selectedQuote =
    signal<Quote | null>(null);

  readonly processingAction = signal(false);

  readonly actionError = signal('');
  readonly successMessage = signal('');

  reason = '';

  // ==========================================
  // INDICATEURS
  // ==========================================

  readonly financialCards = computed(() => {
    const stats = this.stats();

    return [
      {
        label: 'Montant en attente',
        value: stats
          ? this.formatAmount(stats.pendingAmountCents)
          : '—',
        description: 'Propositions commerciales valides',
        icon: '€',
        theme: 'revenue-card',
        iconTheme: 'revenue-icon'
      },
      {
        label: 'Montant accepté',
        value: stats
          ? this.formatAmount(stats.acceptedAmountCents)
          : '—',
        description: 'Prestations ponctuelles acceptées',
        icon: '↗',
        theme: '',
        iconTheme: 'annual-icon'
      },
      {
        label: 'Taux d’acceptation',
        value: stats?.acceptanceRate != null
          ? `${stats.acceptanceRate.toLocaleString('fr-FR')} %`
          : '—',
        description: 'Devis acceptés parmi les réponses',
        icon: '%',
        theme: '',
        iconTheme: 'active-icon'
      },
      {
        label: 'Expirations proches',
        value: stats
          ? String(stats.expiringSoonQuotes)
          : '—',
        description: 'Dans les 7 prochains jours',
        icon: '◷',
        theme: '',
        iconTheme: 'billing-icon'
      }
    ];
  });

  readonly statusCounts = computed(() => {
    const counts: Record<QuoteStatus, number> = {
      Brouillon: 0,
      Émis: 0,
      Envoyé: 0,
      Accepté: 0,
      Refusé: 0,
      Expiré: 0,
      Annulé: 0
    };

    for (const quote of this.quotes()) {
      counts[quote.status]++;
    }

    return counts;
  });

  // ==========================================
  // FILTRES
  // ==========================================

  readonly filteredQuotes = computed(() => {
    const search = this.normalize(this.search());
    const status = this.statusFilter();
    const recipient = this.recipientFilter();
    const validity = this.validityFilter();

    return this.quotes()
      .filter(quote => {
        const matchesSearch =
          !search ||
          [
            quote.number,
            quote.title,
            quote.recipientName,
            quote.recipientLegalName,
            quote.recipientContactName,
            quote.recipientEmail,
            quote.prospect?.name,
            quote.client?.name
          ].some(value =>
            this.normalize(value ?? '').includes(search)
          );

        const matchesStatus =
          status === 'Tous' ||
          quote.status === status;

        const matchesRecipient =
          recipient === 'Tous' ||
          (
            recipient === 'Prospects' &&
            quote.prospectId !== null &&
            quote.clientId === null
          ) ||
          (
            recipient === 'Clients' &&
            quote.clientId !== null
          );

        const matchesValidity =
          validity === 'Tous' ||
          this.quotesService.isOverdue(quote);

        return (
          matchesSearch &&
          matchesStatus &&
          matchesRecipient &&
          matchesValidity
        );
      })
      .sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt) ||
        b.id - a.id
      );
  });

  readonly hasFilters = computed(() =>
    this.search().trim() !== '' ||
    this.statusFilter() !== 'Tous' ||
    this.recipientFilter() !== 'Tous' ||
    this.validityFilter() !== 'Tous'
  );

  // ==========================================
  // INITIALISATION
  // ==========================================

  ngOnInit(): void {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    if (this.processingAction()) {
      return;
    }

    await this.quotesService.refresh();
  }

  resetFilters(): void {
    this.search.set('');
    this.statusFilter.set('Tous');
    this.recipientFilter.set('Tous');
    this.validityFilter.set('Tous');
  }

  filterByStatus(
    status: QuoteStatus | 'Tous'
  ): void {
    this.statusFilter.set(
      this.statusFilter() === status
        ? 'Tous'
        : status
    );
  }

  filterOverdue(): void {
    this.resetFilters();
    this.validityFilter.set('En retard');
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  // ==========================================
  // CRÉATION ET MODIFICATION
  // ==========================================

  createQuote(): void {
    if (
      this.processingAction() ||
      this.confirmation()
    ) {
      return;
    }

    void this.router.navigate(['/quotes', 'new']);
  }

  canEditQuote(quote: Quote): boolean {
    return (
      !this.processingAction() &&
      !this.confirmation() &&
      this.quotesService.canEdit(quote) &&
      quote.client?.status !== 'Archivé'
    );
  }

  editQuote(quote: Quote): void {
    const current =
      this.quotesService.findById(quote.id);

    if (!current || !this.canEditQuote(current)) {
      return;
    }

    void this.router.navigate([
      '/quotes',
      current.id,
      'edit'
    ]);
  }

  // ==========================================
  // APERÇU
  // ==========================================

  openPreview(quote: Quote): void {
    if (
      this.processingAction() ||
      this.confirmation()
    ) {
      return;
    }

    this.selectedQuote.set(quote);
  }

  closePreview(): void {
    if (!this.processingAction()) {
      this.selectedQuote.set(null);
    }
  }

  // ==========================================
  // ACTIONS DISPONIBLES
  // ==========================================

  canPerform(
    quote: Quote,
    action: QuoteAction
  ): boolean {
    if (this.processingAction()) {
      return false;
    }

    switch (action) {
      case 'issue':
        return (
          this.quotesService.canIssue(quote) &&
          quote.client?.status !== 'Archivé'
        );

      case 'accept':
        return this.quotesService.canAccept(quote);

      case 'refuse':
        return this.quotesService.canRefuse(quote);

      case 'cancel':
        return this.quotesService.canCancel(quote);

      case 'expire':
        return this.quotesService.canExpire(quote);

      case 'duplicate':
        return this.quotesService.canDuplicate(quote);

      case 'remove':
        return this.quotesService.canDelete(quote);
    }
  }

  // ==========================================
  // CONFIRMATION DES ACTIONS
  // ==========================================

  requestAction(
    quote: Quote,
    action: QuoteAction
  ): void {
    if (
      !this.canPerform(quote, action) ||
      this.confirmation()
    ) {
      return;
    }

    const configurations: Record<
      QuoteAction,
      {
        title: string;
        message: string;
        buttonLabel: string;
        dangerous: boolean;
      }
    > = {
      issue: {
        title: 'Émettre le devis',
        message:
          'Un numéro définitif sera attribué au devis. ' +
          'Son contenu ne pourra plus être modifié.',
        buttonLabel: 'Émettre définitivement',
        dangerous: false
      },
      accept: {
        title: 'Accepter le devis',
        message:
          'Confirmez que le destinataire a accepté cette proposition. ' +
          'Cette action ne crée pas automatiquement de facture.',
        buttonLabel: 'Confirmer l’acceptation',
        dangerous: false
      },
      refuse: {
        title: 'Refuser le devis',
        message:
          'Le devis sera marqué comme refusé. ' +
          'Vous pouvez renseigner le motif du refus.',
        buttonLabel: 'Confirmer le refus',
        dangerous: true
      },
      cancel: {
        title: 'Annuler le devis',
        message:
          'Le devis sera définitivement annulé, ' +
          'mais restera conservé dans l’historique.',
        buttonLabel: 'Annuler le devis',
        dangerous: true
      },
      expire: {
        title: 'Expirer le devis',
        message:
          'La date de validité est dépassée. ' +
          'Le devis ne pourra plus être accepté.',
        buttonLabel: 'Marquer comme expiré',
        dangerous: false
      },
      duplicate: {
        title: 'Dupliquer le devis',
        message:
          'Une nouvelle copie sera créée au statut Brouillon, ' +
          'sans numéro définitif.',
        buttonLabel: 'Dupliquer',
        dangerous: false
      },
      remove: {
        title: 'Supprimer le brouillon',
        message:
          'Ce brouillon et ses prestations seront supprimés. ' +
          'Cette action est irréversible.',
        buttonLabel: 'Supprimer définitivement',
        dangerous: true
      }
    };

    this.reason = '';
    this.actionError.set('');
    this.successMessage.set('');

    this.confirmation.set({
      quote,
      action,
      ...configurations[action]
    });
  }

  closeConfirmation(): void {
    if (this.processingAction()) {
      return;
    }

    this.confirmation.set(null);
    this.actionError.set('');
    this.reason = '';
  }

  async confirmAction(): Promise<void> {
    const confirmation = this.confirmation();

    if (!confirmation || this.processingAction()) {
      return;
    }

    const { quote, action } = confirmation;

    const current =
      this.quotesService.findById(quote.id) ?? quote;

    if (!this.canPerform(current, action)) {
      this.actionError.set(
        'Cette action n’est plus disponible.'
      );
      return;
    }

    if (
      action === 'cancel' &&
      !this.reason.trim()
    ) {
      this.actionError.set(
        'Le motif d’annulation est obligatoire.'
      );
      return;
    }

    if (this.reason.trim().length > 5000) {
      this.actionError.set(
        'Le motif ne doit pas dépasser 5 000 caractères.'
      );
      return;
    }

    this.processingAction.set(true);
    this.actionError.set('');

    let completed = false;

    try {
      let updatedQuote: Quote | null = null;
      let message = '';

      switch (action) {
        case 'issue':
          updatedQuote =
            await this.quotesService.issue(quote.id);

          message =
            `Le devis ${updatedQuote.number} a été émis.`;
          break;

        case 'accept':
          updatedQuote =
            await this.quotesService.accept(quote.id);

          message = 'Le devis a été accepté.';
          break;

        case 'refuse':
          updatedQuote =
            await this.quotesService.refuse(
              quote.id,
              this.reason
            );

          message = 'Le devis a été refusé.';
          break;

        case 'cancel':
          updatedQuote =
            await this.quotesService.cancel(
              quote.id,
              this.reason
            );

          message = 'Le devis a été annulé.';
          break;

        case 'expire':
          updatedQuote =
            await this.quotesService.expire(quote.id);

          message = 'Le devis a été marqué comme expiré.';
          break;

        case 'duplicate':
          updatedQuote =
            await this.quotesService.duplicate(quote.id);

          message = 'Un nouveau brouillon a été créé.';
          break;

        case 'remove':
          await this.quotesService.remove(quote.id);

          message = 'Le brouillon a été supprimé.';
          break;
      }

      if (action === 'remove') {
        this.selectedQuote.set(null);
      } else if (action === 'duplicate') {
        this.resetFilters();
        this.selectedQuote.set(updatedQuote);
      } else if (
        updatedQuote &&
        this.selectedQuote()?.id === quote.id
      ) {
        this.selectedQuote.set(updatedQuote);
      }

      this.successMessage.set(message);
      completed = true;

    } catch (error) {
      this.actionError.set(
        this.quotesService.getErrorMessage(
          error,
          'Impossible d’effectuer cette action.'
        )
      );
    } finally {
      this.processingAction.set(false);

      if (completed) {
        this.closeConfirmation();
      }
    }
  }

  // ==========================================
  // AFFICHAGE
  // ==========================================

  formatAmount(cents: number): string {
    return this.quotesService.formatAmount(cents);
  }

  getQuoteLabel(quote: Quote): string {
    return this.quotesService.getQuoteLabel(quote);
  }

  getRecipientLabel(quote: Quote): string {
    return this.quotesService.getRecipientLabel(quote);
  }

  getRecipientInitials(quote: Quote): string {
    return this.getRecipientLabel(quote)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase();
  }

  getStatusColor(status: QuoteStatus): string {
    return this.quotesService.getStatusColor(status);
  }

  getStatusClass(status: QuoteStatus): string {
    switch (status) {
      case 'Brouillon':
        return 'draft';

      case 'Émis':
        return 'issued';

      case 'Envoyé':
        return 'sent';

      case 'Accepté':
        return 'accepted';

      case 'Refusé':
        return 'refused';

      case 'Expiré':
        return 'expired';

      case 'Annulé':
        return 'cancelled';
    }
  }

  isOverdue(quote: Quote): boolean {
    return this.quotesService.isOverdue(quote);
  }

  getBillingLabel(cycle: string | null): string {
    switch (cycle) {
      case 'Mensuel':
        return '/ mois';

      case 'Trimestriel':
        return '/ trimestre';

      case 'Annuel':
        return '/ an';

      default:
        return '';
    }
  }

  getDistributionWidth(status: QuoteStatus): number {
    const stats = this.stats();

    if (!stats || stats.totalQuotes === 0) {
      return 0;
    }

    return (
      stats.byStatus[status].count /
      stats.totalQuotes * 100
    );
  }
}