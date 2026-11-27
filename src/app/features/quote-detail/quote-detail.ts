import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  ActivatedRoute,
  Router,
  RouterLink
} from '@angular/router';

import {
  takeUntilDestroyed
} from '@angular/core/rxjs-interop';

import {
  Quote,
  QuoteItem,
  QuoteStatus,
  QuotesService
} from '../../core/services/quotes';

import {
  BillingCycle
} from '../../core/services/subscriptions';


// ======================================================
// TYPES
// ======================================================

type QuoteAction =
  | 'issue'
  | 'accept'
  | 'refuse'
  | 'cancel'
  | 'expire'
  | 'duplicate'
  | 'remove';


interface ActionConfirmation {
  action: QuoteAction;
  title: string;
  description: string;
  buttonLabel: string;
  danger: boolean;
  showReason: boolean;
  reasonRequired: boolean;
}


interface TimelineEvent {
  key: string;
  title: string;
  description: string;
  date: string | null;
  icon: string;
  color: string;
}


// ======================================================
// COMPOSANT
// ======================================================

@Component({
  selector: 'app-quote-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink
  ],
  templateUrl: './quote-detail.html',
  styleUrl: './quote-detail.scss'
})
export class QuoteDetail implements OnInit {

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly quotesService = inject(QuotesService);

  private requestVersion = 0;
  private destroyed = false;


  // ====================================================
  // SIGNALS
  // ====================================================

  readonly quoteId = signal<number | null>(null);

  readonly quote = signal<Quote | null>(null);

  readonly loading = signal(true);

  readonly error = signal<string | null>(null);

  readonly actionError = signal<string | null>(null);

  readonly successMessage = signal<string | null>(null);

  readonly processingAction = signal(false);

  readonly confirmation =
    signal<ActionConfirmation | null>(null);

  readonly actionReason = signal('');


  // ====================================================
  // INFORMATIONS PRINCIPALES
  // ====================================================

  readonly quoteLabel = computed(() => {
    const quote = this.quote();

    return quote
      ? this.quotesService.getQuoteLabel(quote)
      : 'Devis';
  });


  readonly recipientLabel = computed(() => {
    const quote = this.quote();

    return quote
      ? this.quotesService.getRecipientLabel(quote)
      : 'Destinataire';
  });


  readonly recipientType = computed(() => {
    const quote = this.quote();

    if (quote?.clientId) {
      return 'Client';
    }

    if (quote?.prospectId) {
      return 'Prospect';
    }

    return 'Destinataire';
  });


  readonly isDraft = computed(() => {
    return this.quote()?.status === 'Brouillon';
  });


  readonly isArchivedClient = computed(() => {
    return this.quote()?.client?.status === 'Archivé';
  });


  readonly isOverdue = computed(() => {
    const quote = this.quote();

    return quote
      ? this.quotesService.isOverdue(quote)
      : false;
  });


  readonly hasIssuer = computed(() => {
    return !!this.quote()?.issuerSnapshot;
  });


  readonly actionsDisabled = computed(() => {
    return this.loading()
      || this.processingAction()
      || !!this.confirmation()
      || !!this.error();
  });


  // ====================================================
  // PRESTATIONS
  // ====================================================

  readonly sortedItems = computed(() => {
    const quote = this.quote();

    if (!quote) {
      return [];
    }

    return [...quote.items].sort(
      (a, b) => a.position - b.position
    );
  });


  readonly oneOffItems = computed(() => {
    return this.sortedItems().filter(
      item => item.type === 'Ponctuelle'
    );
  });


  readonly recurringItems = computed(() => {
    return this.sortedItems().filter(
      item => item.type === 'Récurrente'
    );
  });


  readonly hasRecurringItems = computed(() => {
    return this.recurringItems().length > 0;
  });


  readonly recurringMonthlyCents = computed(() => {
    return this.quote()?.recurring.monthlyCents ?? 0;
  });


  readonly recurringAnnualCents = computed(() => {
    return this.quote()?.recurring.annualCents ?? 0;
  });


  readonly recurringCycles = computed(() => {
    const quote = this.quote();

    if (!quote) {
      return [];
    }

    const cycles: BillingCycle[] = [
      'Mensuel',
      'Trimestriel',
      'Annuel'
    ];

    return cycles
      .filter(cycle =>
        this.recurringItems().some(
          item => item.billingCycle === cycle
        )
      )
      .map(cycle => ({
        cycle,
        label: this.getBillingLabel(cycle),
        amountCents:
          quote.recurring.byBillingCycle[cycle] ?? 0
      }));
  });


  // ====================================================
  // CONDITIONS COMMERCIALES
  // ====================================================

  readonly hasCommercialConditions = computed(() => {
    const quote = this.quote();

    if (!quote) {
      return false;
    }

    return !!(
      quote.paymentTerms?.trim()
      || quote.deliveryTerms?.trim()
      || quote.termsAndConditions?.trim()
      || quote.publicNotes?.trim()
    );
  });


  readonly hasInternalNotes = computed(() => {
    return !!this.quote()?.internalNotes?.trim();
  });


  // ====================================================
  // AUTORISATIONS
  // ====================================================

  readonly canEdit = computed(() => {
    const quote = this.quote();

    return !!quote
      && !this.isArchivedClient()
      && this.quotesService.canEdit(quote);
  });


  readonly canIssue = computed(() => {
    const quote = this.quote();

    return !!quote
      && !this.isArchivedClient()
      && this.quotesService.canIssue(quote);
  });


  readonly canAccept = computed(() => {
    const quote = this.quote();

    return !!quote
      && this.quotesService.canAccept(quote);
  });


  readonly canRefuse = computed(() => {
    const quote = this.quote();

    return !!quote
      && this.quotesService.canRefuse(quote);
  });


  readonly canCancel = computed(() => {
    const quote = this.quote();

    return !!quote
      && this.quotesService.canCancel(quote);
  });


  readonly canExpire = computed(() => {
    const quote = this.quote();

    return !!quote
      && this.quotesService.canExpire(quote);
  });


  readonly canDuplicate = computed(() => {
    const quote = this.quote();

    return !!quote
      && this.quotesService.canDuplicate(quote);
  });


  readonly canDelete = computed(() => {
    const quote = this.quote();

    return !!quote
      && this.quotesService.canDelete(quote);
  });


  readonly hasStatusActions = computed(() => {
    return this.canIssue()
      || this.canAccept()
      || this.canRefuse()
      || this.canCancel()
      || this.canExpire();
  });


  // ====================================================
  // HISTORIQUE
  // ====================================================

  readonly timeline = computed<TimelineEvent[]>(() => {
    const quote = this.quote();

    if (!quote) {
      return [];
    }

    const events: TimelineEvent[] = [
      {
        key: 'created',
        title: 'Brouillon créé',
        description:
          'Le devis a été créé dans MargeWeb.',
        date: quote.createdAt,
        icon: '📝',
        color: '#94a3b8'
      }
    ];

    if (quote.issuedAt) {
      events.push({
        key: 'issued',
        title: 'Devis émis',
        description: quote.number
          ? `Numéro attribué : ${quote.number}.`
          : 'Le devis a été émis définitivement.',
        date: quote.issuedAt,
        icon: '📄',
        color: '#3b82f6'
      });
    }

    if (quote.sentAt) {
      events.push({
        key: 'sent',
        title: 'Devis envoyé',
        description:
          'Le devis a été transmis au destinataire.',
        date: quote.sentAt,
        icon: '✉️',
        color: '#8b5cf6'
      });
    }

    if (quote.acceptedAt) {
      events.push({
        key: 'accepted',
        title: 'Acceptation enregistrée',
        description:
          'Le devis a été marqué comme accepté.',
        date: quote.acceptedAt,
        icon: '✓',
        color: '#16a34a'
      });
    }

    if (quote.refusedAt) {
      events.push({
        key: 'refused',
        title: 'Refus enregistré',
        description: quote.refusalReason
          || 'Le devis a été marqué comme refusé.',
        date: quote.refusedAt,
        icon: '✕',
        color: '#dc2626'
      });
    }

    if (quote.cancelledAt) {
      events.push({
        key: 'cancelled',
        title: 'Devis annulé',
        description: quote.cancellationReason
          || 'Le devis a été annulé.',
        date: quote.cancelledAt,
        icon: '⊘',
        color: '#64748b'
      });
    }

    events.sort((a, b) => {
      const first = a.date
        ? new Date(a.date).getTime()
        : 0;

      const second = b.date
        ? new Date(b.date).getTime()
        : 0;

      return first - second;
    });

    if (quote.status === 'Expiré') {
      events.push({
        key: 'expired',
        title: 'Devis expiré',
        description: quote.validUntil
          ? `Date de validité dépassée : ${
              this.formatDate(quote.validUntil)
            }.`
          : 'Le devis a été marqué comme expiré.',
        date: null,
        icon: '⏳',
        color: '#d97706'
      });
    }

    return events;
  });


  // ====================================================
  // INITIALISATION
  // ====================================================

  ngOnInit(): void {

    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.requestVersion++;
    });

    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(params => {

        const rawId = params.get('id');

        this.requestVersion++;

        this.quote.set(null);
        this.error.set(null);
        this.actionError.set(null);
        this.successMessage.set(null);
        this.confirmation.set(null);
        this.actionReason.set('');
        this.processingAction.set(false);

        if (!rawId || !/^[1-9]\d*$/.test(rawId)) {
          this.quoteId.set(null);
          this.loading.set(false);
          this.error.set(
            'L’identifiant du devis est invalide.'
          );
          return;
        }

        const id = Number(rawId);

        if (!Number.isSafeInteger(id)) {
          this.quoteId.set(null);
          this.loading.set(false);
          this.error.set(
            'L’identifiant du devis est invalide.'
          );
          return;
        }

        this.quoteId.set(id);

        void this.loadQuote(id);
      });
  }


  // ====================================================
  // CHARGEMENT
  // ====================================================

  private async loadQuote(id: number): Promise<void> {

    const version = ++this.requestVersion;

    this.loading.set(true);
    this.error.set(null);

    try {

      const quote =
        await this.quotesService.getById(id);

      if (!this.isCurrentRequest(version, id)) {
        return;
      }

      this.quote.set(quote);

    } catch (error) {

      if (!this.isCurrentRequest(version, id)) {
        return;
      }

      this.quote.set(null);

      this.error.set(
        this.quotesService.getErrorMessage(
          error,
          'Impossible de charger ce devis.'
        )
      );

    } finally {

      if (this.isCurrentRequest(version, id)) {
        this.loading.set(false);
      }
    }
  }


  private isCurrentRequest(
    version: number,
    id: number
  ): boolean {

    return !this.destroyed
      && this.requestVersion === version
      && this.quoteId() === id;
  }


  async refresh(): Promise<void> {

    if (
      this.loading()
      || this.processingAction()
      || this.confirmation()
    ) {
      return;
    }

    const id = this.quoteId();

    if (id === null) {
      return;
    }

    this.actionError.set(null);
    this.successMessage.set(null);

    await this.loadQuote(id);
  }


  retry(): void {
    void this.refresh();
  }


  // ====================================================
  // NAVIGATION
  // ====================================================

  async goBack(): Promise<void> {

    if (this.processingAction()) {
      return;
    }

    this.closeConfirmation();

    await this.router.navigate(['/quotes']);
  }


  async editQuote(): Promise<void> {

    const quote = this.quote();

    if (
      !quote
      || !this.canEdit()
      || this.actionsDisabled()
    ) {
      return;
    }

    await this.router.navigate([
      '/quotes',
      quote.id,
      'edit'
    ]);
  }


  async openRecipient(): Promise<void> {

    const quote = this.quote();

    if (!quote || this.actionsDisabled()) {
      return;
    }

    if (quote.clientId) {

      await this.router.navigate([
        '/clients',
        quote.clientId
      ]);

      return;
    }

    if (quote.prospectId) {

      await this.router.navigate([
        '/prospects',
        quote.prospectId
      ]);
    }
  }


  // ====================================================
  // AUTORISATION D'UNE ACTION
  // ====================================================

  canPerform(action: QuoteAction): boolean {

    switch (action) {

      case 'issue':
        return this.canIssue();

      case 'accept':
        return this.canAccept();

      case 'refuse':
        return this.canRefuse();

      case 'cancel':
        return this.canCancel();

      case 'expire':
        return this.canExpire();

      case 'duplicate':
        return this.canDuplicate();

      case 'remove':
        return this.canDelete();
    }
  }


  // ====================================================
  // DEMANDE DE CONFIRMATION
  // ====================================================

  requestAction(action: QuoteAction): void {

    if (
      !this.quote()
      || this.actionsDisabled()
      || !this.canPerform(action)
    ) {
      return;
    }

    this.actionError.set(null);
    this.successMessage.set(null);
    this.actionReason.set('');

    this.confirmation.set(
      this.getActionConfirmation(action)
    );
  }


  private getActionConfirmation(
    action: QuoteAction
  ): ActionConfirmation {

    switch (action) {

      case 'issue':

        return {
          action,
          title: 'Émettre définitivement le devis',
          description:
            'Un numéro définitif sera attribué au devis. '
            + 'Ses informations commerciales ne pourront '
            + 'plus être modifiées. Cette action ne '
            + 'déclenche aucun envoi par e-mail.',
          buttonLabel: 'Émettre le devis',
          danger: false,
          showReason: false,
          reasonRequired: false
        };


      case 'accept':

        return {
          action,
          title: 'Enregistrer une acceptation',
          description:
            'Confirmez uniquement si le destinataire '
            + 'a réellement accepté le devis. '
            + 'Cette action ne crée pas automatiquement '
            + 'de client, de facture ou d’abonnement.',
          buttonLabel: 'Confirmer l’acceptation',
          danger: false,
          showReason: false,
          reasonRequired: false
        };


      case 'refuse':

        return {
          action,
          title: 'Enregistrer un refus',
          description:
            'Le devis sera marqué comme refusé. '
            + 'Vous pouvez conserver le motif du refus '
            + 'dans son historique.',
          buttonLabel: 'Confirmer le refus',
          danger: true,
          showReason: true,
          reasonRequired: false
        };


      case 'cancel':

        return {
          action,
          title: 'Annuler le devis',
          description:
            'Le devis sera conservé dans les archives '
            + 'avec son numéro et ses informations. '
            + 'Cette action est définitive.',
          buttonLabel: 'Annuler le devis',
          danger: true,
          showReason: true,
          reasonRequired: true
        };


      case 'expire':

        return {
          action,
          title: 'Marquer le devis comme expiré',
          description:
            'La date de validité du devis est dépassée. '
            + 'Le devis sera conservé dans l’historique.',
          buttonLabel: 'Confirmer l’expiration',
          danger: false,
          showReason: false,
          reasonRequired: false
        };


      case 'duplicate':

        return {
          action,
          title: 'Dupliquer le devis',
          description:
            'Un nouveau brouillon sera créé à partir '
            + 'des coordonnées, des prestations et '
            + 'des conditions de ce devis. '
            + 'Le devis original restera inchangé.',
          buttonLabel: 'Dupliquer le devis',
          danger: false,
          showReason: false,
          reasonRequired: false
        };


      case 'remove':

        return {
          action,
          title: 'Supprimer le brouillon',
          description:
            'Ce brouillon et toutes ses prestations '
            + 'seront définitivement supprimés. '
            + 'Cette action est irréversible.',
          buttonLabel: 'Supprimer le brouillon',
          danger: true,
          showReason: false,
          reasonRequired: false
        };
    }
  }


  // ====================================================
  // MODALE DE CONFIRMATION
  // ====================================================

  readonly canConfirmAction = computed(() => {

    const confirmation = this.confirmation();

    if (
      !confirmation
      || this.processingAction()
      || this.loading()
      || !this.canPerform(confirmation.action)
    ) {
      return false;
    }

    const reason = this.actionReason().trim();

    if (reason.length > 5000) {
      return false;
    }

    if (
      confirmation.reasonRequired
      && !reason
    ) {
      return false;
    }

    return true;
  });


  updateActionReason(value: string): void {

    if (this.processingAction()) {
      return;
    }

    this.actionReason.set(value);
    this.actionError.set(null);
  }


  closeConfirmation(): void {

    if (this.processingAction()) {
      return;
    }

    this.confirmation.set(null);
    this.actionReason.set('');
    this.actionError.set(null);
  }


  // ====================================================
  // EXÉCUTION DES ACTIONS
  // ====================================================

  async confirmAction(): Promise<void> {

    const confirmation = this.confirmation();
    const quote = this.quote();

    if (
      !confirmation
      || !quote
      || !this.canConfirmAction()
    ) {
      return;
    }

    const id = quote.id;
    const version = this.requestVersion;
    const action = confirmation.action;
    const reason = this.actionReason().trim();

    this.processingAction.set(true);
    this.actionError.set(null);
    this.successMessage.set(null);

    let updatedQuote: Quote | null = null;
    let destination: (string | number)[] | null = null;

    try {

      switch (action) {

        case 'issue':

          updatedQuote =
            await this.quotesService.issue(id);

          break;


        case 'accept':

          updatedQuote =
            await this.quotesService.accept(id);

          break;


        case 'refuse':

          updatedQuote =
            await this.quotesService.refuse(
              id,
              reason
            );

          break;


        case 'cancel':

          updatedQuote =
            await this.quotesService.cancel(
              id,
              reason
            );

          break;


        case 'expire':

          updatedQuote =
            await this.quotesService.expire(id);

          break;


        case 'duplicate': {

          const duplicate =
            await this.quotesService.duplicate(id);

          destination = [
            '/quotes',
            duplicate.id
          ];

          break;
        }


        case 'remove':

          await this.quotesService.remove(id);

          destination = ['/quotes'];

          break;
      }

      if (!this.isCurrentRequest(version, id)) {
        return;
      }

      if (updatedQuote) {
        this.quote.set(updatedQuote);
      }

      this.confirmation.set(null);
      this.actionReason.set('');

      this.successMessage.set(
        this.getSuccessMessage(action)
      );

    } catch (error) {

      if (!this.isCurrentRequest(version, id)) {
        return;
      }

      this.actionError.set(
        this.quotesService.getErrorMessage(
          error,
          'Impossible d’effectuer cette action.'
        )
      );

      return;

    } finally {

      if (this.isCurrentRequest(version, id)) {
        this.processingAction.set(false);
      }
    }

    if (
      destination
      && this.isCurrentRequest(version, id)
    ) {

      if (action === 'remove') {
        this.quote.set(null);
      }

      try {

        const navigated =
          await this.router.navigate(destination);

        if (
          !navigated
          && this.isCurrentRequest(version, id)
        ) {
          this.actionError.set(
            'L’action a réussi, mais la navigation '
            + 'automatique a échoué.'
          );
        }

      } catch {

        if (this.isCurrentRequest(version, id)) {
          this.actionError.set(
            'L’action a réussi, mais la navigation '
            + 'automatique a échoué.'
          );
        }
      }
    }
  }


  private getSuccessMessage(
    action: QuoteAction
  ): string {

    switch (action) {

      case 'issue':
        return 'Le devis a été émis avec succès.';

      case 'accept':
        return 'L’acceptation du devis a été enregistrée.';

      case 'refuse':
        return 'Le refus du devis a été enregistré.';

      case 'cancel':
        return 'Le devis a été annulé.';

      case 'expire':
        return 'Le devis a été marqué comme expiré.';

      case 'duplicate':
        return 'Le devis a été dupliqué avec succès.';

      case 'remove':
        return 'Le brouillon a été supprimé.';
    }
  }


  dismissSuccess(): void {
    this.successMessage.set(null);
  }


  dismissActionError(): void {
    this.actionError.set(null);
  }


  // ====================================================
  // MONTANTS
  // ====================================================

  formatAmount(cents: number): string {

    return this.quotesService.formatAmount(cents);
  }


  getItemMonthlyAmount(item: QuoteItem): number {

    if (
      item.type !== 'Récurrente'
      || !item.billingCycle
    ) {
      return 0;
    }

    switch (item.billingCycle) {

      case 'Mensuel':
        return item.totalCents;

      case 'Trimestriel':
        return Math.round(item.totalCents / 3);

      case 'Annuel':
        return Math.round(item.totalCents / 12);
    }
  }


  getItemAnnualAmount(item: QuoteItem): number {

    if (
      item.type !== 'Récurrente'
      || !item.billingCycle
    ) {
      return 0;
    }

    switch (item.billingCycle) {

      case 'Mensuel':
        return item.totalCents * 12;

      case 'Trimestriel':
        return item.totalCents * 4;

      case 'Annuel':
        return item.totalCents;
    }
  }


  getBillingLabel(
    cycle: BillingCycle | null
  ): string {

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


  getCommitmentLabel(item: QuoteItem): string {

    if (!item.commitmentMonths) {
      return 'Sans engagement défini';
    }

    return `${item.commitmentMonths} mois`;
  }


  // ====================================================
  // DATES
  // ====================================================

  formatDate(value: string | null | undefined): string {

    if (!value) {
      return 'Non renseignée';
    }

    const normalized =
      /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? `${value}T12:00:00Z`
        : value;

    const date = new Date(normalized);

    if (Number.isNaN(date.getTime())) {
      return 'Date indisponible';
    }

    return new Intl.DateTimeFormat(
      'fr-FR',
      {
        timeZone: 'Europe/Paris',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      }
    ).format(date);
  }


  formatDateTime(
    value: string | null | undefined
  ): string {

    if (!value) {
      return 'Date non enregistrée';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return 'Date indisponible';
    }

    return new Intl.DateTimeFormat(
      'fr-FR',
      {
        timeZone: 'Europe/Paris',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }
    ).format(date);
  }


  // ====================================================
  // AFFICHAGE DES STATUTS
  // ====================================================

  getStatusColor(status: QuoteStatus): string {

    return this.quotesService.getStatusColor(status);
  }


  getStatusClass(status: QuoteStatus): string {

    switch (status) {

      case 'Brouillon':
        return 'status-draft';

      case 'Émis':
        return 'status-issued';

      case 'Envoyé':
        return 'status-sent';

      case 'Accepté':
        return 'status-accepted';

      case 'Refusé':
        return 'status-refused';

      case 'Expiré':
        return 'status-expired';

      case 'Annulé':
        return 'status-cancelled';
    }
  }


  getStatusDescription(status: QuoteStatus): string {

    switch (status) {

      case 'Brouillon':
        return 'Ce devis est encore modifiable.';

      case 'Émis':
        return 'Ce devis possède un numéro définitif.';

      case 'Envoyé':
        return 'Ce devis est en attente de réponse.';

      case 'Accepté':
        return 'Une acceptation a été enregistrée.';

      case 'Refusé':
        return 'Le destinataire a refusé le devis.';

      case 'Expiré':
        return 'La période de validité est dépassée.';

      case 'Annulé':
        return 'Ce devis a été annulé.';
    }
  }


  getInitials(name: string): string {

    const initials = name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(word => word.charAt(0).toUpperCase())
      .join('');

    return initials || '?';
  }
}