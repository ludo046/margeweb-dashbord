import {
  Component,
  HostListener,
  computed,
  inject,
  signal,
  OnInit
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import {
  Quote,
  QuoteInput,
  QuoteUpdate,
  QuoteItemInput,
  QuoteItemType,
  QuoteRecipient,
  QuotesService
} from '../../core/services/quotes';

import {
  Client,
  ClientsService
} from '../../core/services/clients';

import {
  Prospect,
  ProspectsService
} from '../../core/services/prospects';

import { BillingCycle } from '../../core/services/subscriptions';

// ======================================================
// TYPES
// ======================================================

type RecipientType = 'prospect' | 'client';

interface EditorItem {
  key: number;
  type: QuoteItemType;
  name: string;
  description: string;
  quantity: number | null;
  unit: string;
  unitPrice: string;
  discount: string;
  billingCycle: BillingCycle;
  commitmentMonths: number | null;
  autoRenew: boolean;
}

interface EditorForm extends QuoteRecipient {
  title: string;
  validUntil: string;
  globalDiscount: string;
  paymentTerms: string;
  deliveryTerms: string;
  termsAndConditions: string;
  publicNotes: string;
  internalNotes: string;
}

interface EditorTotals {
  subtotalCents: number;
  itemDiscountsCents: number;
  globalDiscountCents: number;
  totalDiscountCents: number;
  totalExcludingTaxCents: number;
  taxCents: number;
  totalIncludingTaxCents: number;
  recurringMonthlyCents: number;
  recurringAnnualCents: number;
  recurringByCycle: Record<BillingCycle, number>;
}

// ======================================================
// CONSTANTES
// ======================================================

const BILLING_MONTHS: Record<BillingCycle, number> = {
  Mensuel: 1,
  Trimestriel: 3,
  Annuel: 12
};

const MAX_ITEMS = 200;
const MAX_UNIT_PRICE_CENTS = 9999999999;

// ======================================================
// COMPOSANT
// ======================================================

@Component({
  selector: 'app-quote-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './quote-editor.html',
  styleUrl: './quote-editor.scss'
})
export class QuoteEditor implements OnInit {

  private readonly quotesService = inject(QuotesService);
  private readonly clientsService = inject(ClientsService);
  private readonly prospectsService = inject(ProspectsService);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private nextItemKey = 1;
  private initialSnapshot = '';
  private initialForm: EditorForm | null = null;

  // ====================================================
  // ÉTAT DE LA PAGE
  // ====================================================

  readonly quoteId = signal<number | null>(null);
  readonly currentQuote = signal<Quote | null>(null);

  readonly loading = signal(true);
  readonly saving = signal(false);

  readonly loadError = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);
  readonly validationErrors = signal<string[]>([]);

  readonly showLeaveConfirmation = signal(false);
  readonly saved = signal(false);
  readonly dirty = signal(false);

  readonly isEditMode = computed(() =>
    this.quoteId() !== null
  );

  readonly pageTitle = computed(() =>
    this.isEditMode()
      ? 'Modifier le devis'
      : 'Nouveau devis'
  );

  readonly pageDescription = computed(() =>
    this.isEditMode()
      ? 'Modifiez votre proposition commerciale.'
      : 'Préparez une nouvelle proposition commerciale.'
  );

  // ====================================================
  // DESTINATAIRE
  // ====================================================

  readonly recipientType = signal<RecipientType>('prospect');
  readonly recipientId = signal<number | null>(null);
  readonly recipientSearch = signal('');

  readonly recipientsLoading =
    this.prospectsService.commercialLoading;

  readonly recipientsError =
    this.prospectsService.commercialError;

  readonly prospects = computed(() =>
    [...this.prospectsService.commercialProspects()]
      .sort((a, b) =>
        a.name.localeCompare(b.name, 'fr')
      )
  );

  readonly clients = computed(() =>
    this.clientsService.clients()
      .filter(client => client.status !== 'Archivé')
      .sort((a, b) =>
        a.name.localeCompare(b.name, 'fr')
      )
  );

  readonly filteredProspects = computed(() => {
    const search = this.normalizeSearch(
      this.recipientSearch()
    );

    return this.prospects().filter(prospect => {
      const value = this.normalizeSearch([
        prospect.name,
        prospect.email,
        prospect.location
      ].join(' '));

      return value.includes(search);
    });
  });

  readonly filteredClients = computed(() => {
    const search = this.normalizeSearch(
      this.recipientSearch()
    );

    return this.clients().filter(client => {
      const value = this.normalizeSearch([
        client.name,
        client.legalName,
        client.email,
        client.city
      ].join(' '));

      return value.includes(search);
    });
  });

  readonly selectedProspect = computed(() => {
    const id = this.recipientId();

    if (
      this.recipientType() !== 'prospect' ||
      id === null
    ) {
      return null;
    }

    return this.prospectsService.findById(id) ?? null;
  });

  readonly selectedClient = computed(() => {
    const id = this.recipientId();

    if (
      this.recipientType() !== 'client' ||
      id === null
    ) {
      return null;
    }

    return this.clientsService.findById(id) ?? null;
  });

  readonly hasCommercialEstimate = computed(() => {
    const prospect = this.selectedProspect();

    return !!prospect && (
      Number(prospect.creationQuote ?? 0) > 0 ||
      Number(prospect.monthlySubscription ?? 0) > 0
    );
  });

  // ====================================================
  // FORMULAIRE
  // ====================================================

  readonly form = signal<EditorForm>(
    this.createEmptyForm()
  );

  readonly items = signal<EditorItem[]>([]);

  readonly billingCycles: BillingCycle[] = [
    'Mensuel',
    'Trimestriel',
    'Annuel'
  ];

  readonly itemTypes: QuoteItemType[] = [
    'Ponctuelle',
    'Récurrente'
  ];

  readonly units = [
    'Forfait',
    'Unité',
    'Heure',
    'Jour',
    'Page',
    'Prestation'
  ];

  readonly today =
    this.quotesService.getBusinessDate();

  readonly oneOffItems = computed(() =>
    this.items().filter(item =>
      item.type === 'Ponctuelle'
    )
  );

  readonly recurringItems = computed(() =>
    this.items().filter(item =>
      item.type === 'Récurrente'
    )
  );

  readonly canAddItem = computed(() =>
    this.items().length < MAX_ITEMS &&
    !this.saving()
  );

  readonly canSave = computed(() => {
    if (
      this.loading() ||
      this.saving() ||
      this.saved() ||
      this.loadError()
    ) {
      return false;
    }

    if (this.isEditMode()) {
      return this.currentQuote()?.status === 'Brouillon'
        && this.selectedClient()?.status !== 'Archivé';
    }

    if (
      this.recipientsLoading() ||
      this.recipientsError()
    ) {
      return false;
    }

    return this.recipientType() === 'client'
      ? !!this.selectedClient() &&
        this.selectedClient()?.status !== 'Archivé'
      : !!this.selectedProspect() &&
        this.prospects().some(
          prospect => prospect.id === this.recipientId()
        );
  });

  // ====================================================
  // CALCUL DES MONTANTS
  // ====================================================

  readonly totals = computed<EditorTotals>(() => {
    let subtotalCents = 0;
    let itemDiscountsCents = 0;
    let recurringAnnualCents = 0;

    const recurringByCycle: Record<BillingCycle, number> = {
      Mensuel: 0,
      Trimestriel: 0,
      Annuel: 0
    };

    for (const item of this.items()) {
      const subtotal = this.getItemSubtotal(item);
      const discount = this.getItemDiscount(item);
      const total = Math.max(0, subtotal - discount);

      if (item.type === 'Ponctuelle') {
        subtotalCents += subtotal;
        itemDiscountsCents += discount;
      } else {
        recurringByCycle[item.billingCycle] += total;

        recurringAnnualCents += total * (
          12 / BILLING_MONTHS[item.billingCycle]
        );
      }
    }

    const availableDiscount = Math.max(
      0,
      subtotalCents - itemDiscountsCents
    );

    const globalDiscountCents = Math.min(
      availableDiscount,
      this.parseAmountOrZero(
        this.form().globalDiscount
      )
    );

    const totalDiscountCents =
      itemDiscountsCents + globalDiscountCents;

    const totalExcludingTaxCents = Math.max(
      0,
      subtotalCents - totalDiscountCents
    );

    return {
      subtotalCents,
      itemDiscountsCents,
      globalDiscountCents,
      totalDiscountCents,
      totalExcludingTaxCents,
      taxCents: 0,
      totalIncludingTaxCents: totalExcludingTaxCents,
      recurringMonthlyCents: Math.round(
        recurringAnnualCents / 12
      ),
      recurringAnnualCents,
      recurringByCycle
    };
  });

  // ====================================================
  // INITIALISATION
  // ====================================================

  ngOnInit(): void {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    this.saveError.set(null);
    this.validationErrors.set([]);

    try {
      const rawId = this.route.snapshot.paramMap.get('id');

      if (rawId !== null) {
        const id = this.parseId(rawId);

        if (id === null) {
          throw new Error(
            'Identifiant du devis invalide.'
          );
        }

        this.quoteId.set(id);
      }

      await this.prospectsService.loadCommercialData();

      if (this.isEditMode()) {
        await this.loadQuote();
      } else {
        if (this.recipientsError()) {
          throw new Error(
            this.recipientsError() ??
            'Impossible de charger les destinataires.'
          );
        }

        this.form.set(this.createEmptyForm());

        this.items.set([
          this.createItem('Ponctuelle')
        ]);

        this.applyQueryParams();
      }

      this.initialForm = {
        ...this.form()
      };

      this.markAsClean();

    } catch (error) {
      this.loadError.set(
        this.quotesService.getErrorMessage(
          error,
          'Impossible de charger l’éditeur de devis.'
        )
      );
    } finally {
      this.loading.set(false);
    }
  }

  retry(): void {
    if (!this.loading() && !this.saving()) {
      void this.initialize();
    }
  }

  // ====================================================
  // CHARGEMENT D'UN BROUILLON
  // ====================================================

  private async loadQuote(): Promise<void> {
    const id = this.quoteId();

    if (id === null) {
      return;
    }

    const quote = await this.quotesService.getById(id);

    if (!this.quotesService.canEdit(quote)) {
      throw new Error(
        'Ce devis a déjà été émis ou clôturé. ' +
        'Il ne peut plus être modifié.'
      );
    }

    if (quote.client?.status === 'Archivé') {
      throw new Error(
        'Le client associé à ce devis est archivé.'
      );
    }

    this.currentQuote.set(quote);

    if (quote.clientId !== null) {
      this.recipientType.set('client');
      this.recipientId.set(quote.clientId);
    } else {
      this.recipientType.set('prospect');
      this.recipientId.set(quote.prospectId);
    }

    this.form.set({
      title: quote.title,
      validUntil: quote.validUntil ?? '',

      recipientName: quote.recipientName ?? '',
      recipientLegalName: quote.recipientLegalName ?? '',
      recipientContactName: quote.recipientContactName ?? '',
      recipientEmail: quote.recipientEmail ?? '',
      recipientPhone: quote.recipientPhone ?? '',
      recipientAddress: quote.recipientAddress ?? '',
      recipientPostalCode: quote.recipientPostalCode ?? '',
      recipientCity: quote.recipientCity ?? '',
      recipientCountry: quote.recipientCountry ?? 'France',
      recipientSiret: quote.recipientSiret ?? '',

      globalDiscount: this.amountToInput(
        quote.globalDiscountCents
      ),

      paymentTerms: quote.paymentTerms ?? '',
      deliveryTerms: quote.deliveryTerms ?? '',
      termsAndConditions: quote.termsAndConditions ?? '',
      publicNotes: quote.publicNotes ?? '',
      internalNotes: quote.internalNotes ?? ''
    });

    this.items.set(
      [...quote.items]
        .sort((a, b) => a.position - b.position)
        .map(item => ({
          key: this.nextItemKey++,
          type: item.type,
          name: item.name,
          description: item.description ?? '',
          quantity: item.quantity,
          unit: item.unit,

          unitPrice: this.amountToInput(
            item.unitPriceCents
          ),

          discount: this.amountToInput(
            item.discountCents
          ),

          billingCycle: item.billingCycle ?? 'Mensuel',
          commitmentMonths: item.commitmentMonths,
          autoRenew: item.autoRenew
        }))
    );
  }

  // ====================================================
  // PARAMÈTRES D'URL
  // ====================================================

  private applyQueryParams(): void {
    const params = this.route.snapshot.queryParamMap;

    const clientId = this.parseId(
      params.get('clientId')
    );

    const prospectId = this.parseId(
      params.get('prospectId')
    );

    if (clientId !== null) {
      const client =
        this.clientsService.findById(clientId);

      if (client && client.status !== 'Archivé') {
        this.recipientType.set('client');
        this.selectRecipient(clientId);
        return;
      }

      throw new Error(
        'Le client demandé est introuvable ou archivé.'
      );
    }

    if (prospectId !== null) {
      const linkedClient =
        this.clientsService.clients().find(
          client => client.prospectId === prospectId
        );

      if (linkedClient) {
        if (linkedClient.status === 'Archivé') {
          throw new Error(
            'Le client associé à ce prospect est archivé.'
          );
        }

        this.recipientType.set('client');
        this.selectRecipient(linkedClient.id);
        return;
      }

      const prospect = this.prospects().find(
        item => item.id === prospectId
      );

      if (!prospect) {
        throw new Error(
          'Le prospect demandé est indisponible.'
        );
      }

      this.recipientType.set('prospect');
      this.selectRecipient(prospectId);
    }
  }

  // ====================================================
  // GESTION DU DESTINATAIRE
  // ====================================================

  setRecipientType(type: RecipientType): void {
    if (
      this.isEditMode() ||
      this.saving() ||
      this.recipientType() === type
    ) {
      return;
    }

    if (!this.confirmRecipientReplacement()) {
      return;
    }

    this.recipientType.set(type);
    this.recipientId.set(null);
    this.recipientSearch.set('');

    this.clearRecipientFields();
    this.markAsDirty();
  }

  selectRecipient(value: number | string | null): void {
    if (this.isEditMode() || this.saving()) {
      return;
    }

    const id = this.parseId(value);

    if (id === this.recipientId()) {
      return;
    }

    if (!this.confirmRecipientReplacement()) {
      return;
    }

    if (id === null) {
      this.recipientId.set(null);
      this.clearRecipientFields();
      this.markAsDirty();
      return;
    }

    if (this.recipientType() === 'client') {
      const client = this.clients().find(
        item => item.id === id
      );

      if (!client) {
        return;
      }

      this.recipientId.set(id);
      this.fillClientFields(client);

    } else {
      const prospect = this.prospects().find(
        item => item.id === id
      );

      if (!prospect) {
        return;
      }

      this.recipientId.set(id);
      this.fillProspectFields(prospect);
    }

    this.markAsDirty();
  }

  private confirmRecipientReplacement(): boolean {
    const form = this.form();

    const hasRecipientData = !!(
      this.recipientId() ||
      form.recipientName ||
      form.recipientLegalName ||
      form.recipientContactName ||
      form.recipientEmail ||
      form.recipientPhone ||
      form.recipientAddress ||
      form.recipientPostalCode ||
      form.recipientCity ||
      form.recipientSiret ||
      form.recipientCountry !== 'France'
    );

    return !hasRecipientData || window.confirm(
      'Changer de destinataire remplacera les coordonnées ' +
      'actuellement renseignées. Continuer ?'
    );
  }

  private fillClientFields(client: Client): void {
    this.form.update(form => ({
      ...form,
      recipientName: client.name,
      recipientLegalName: client.legalName ?? '',
      recipientContactName: client.contactName ?? '',
      recipientEmail: client.email ?? '',
      recipientPhone: client.phone ?? '',
      recipientAddress: client.address ?? '',
      recipientPostalCode: client.postalCode ?? '',
      recipientCity: client.city ?? '',
      recipientCountry: client.country || 'France',
      recipientSiret: client.siret ?? ''
    }));
  }

  private fillProspectFields(prospect: Prospect): void {
    this.form.update(form => ({
      ...form,
      ...this.createEmptyRecipient(),
      recipientName: prospect.name,
      recipientEmail: prospect.email ?? '',
      recipientPhone: prospect.phone ?? ''
    }));
  }

  private clearRecipientFields(): void {
    this.form.update(form => ({
      ...form,
      ...this.createEmptyRecipient()
    }));
  }

  refreshRecipientFields(): void {
    if (this.saving()) {
      return;
    }

    const client = this.selectedClient();
    const prospect = this.selectedProspect();

    if (!client && !prospect) {
      return;
    }

    const confirmed = window.confirm(
      'Remplacer les coordonnées du devis par celles ' +
      'actuellement enregistrées dans la fiche ?'
    );

    if (!confirmed) {
      return;
    }

    if (client) {
      this.fillClientFields(client);
    } else if (prospect) {
      this.fillProspectFields(prospect);
    }

    this.markAsDirty();
  }

  // ====================================================
  // IMPORT DES ESTIMATIONS COMMERCIALES
  // ====================================================

  importCommercialEstimate(): void {
    if (this.saving() || this.isEditMode()) {
      return;
    }

    const prospect = this.selectedProspect();

    if (!prospect) {
      return;
    }

    const creationAmount = Number(
      prospect.creationQuote ?? 0
    );

    const maintenanceAmount = Number(
      prospect.monthlySubscription ?? 0
    );

    const importedItems: EditorItem[] = [];

    if (creationAmount > 0) {
      importedItems.push({
        ...this.createItem('Ponctuelle'),
        name: 'Création du site internet',
        unitPrice: creationAmount.toFixed(2)
      });
    }

    if (maintenanceAmount > 0) {
      importedItems.push({
        ...this.createItem('Récurrente'),
        name: 'Maintenance et administration du site',
        unitPrice: maintenanceAmount.toFixed(2),
        billingCycle: 'Mensuel'
      });
    }

    if (!importedItems.length) {
      return;
    }

    const hasExistingItems = this.items().some(
      item =>
        item.name.trim() ||
        item.description.trim() ||
        this.parseAmountOrZero(item.unitPrice) > 0 ||
        this.parseAmountOrZero(item.discount) > 0 ||
        item.quantity !== 1
    );

    if (
      hasExistingItems &&
      !window.confirm(
        'Remplacer les prestations actuelles par ' +
        'les estimations commerciales du prospect ?'
      )
    ) {
      return;
    }

    this.items.set(importedItems);

    this.form.update(form => ({
      ...form,
      title: form.title ||
        'Création et maintenance du site internet',
      globalDiscount: '0'
    }));

    this.markAsDirty();
  }

  // ====================================================
  // MODIFICATION DU FORMULAIRE
  // ====================================================

  updateForm<K extends keyof EditorForm>(
    field: K,
    value: EditorForm[K]
  ): void {
    if (this.saving()) {
      return;
    }

    this.form.update(form => ({
      ...form,
      [field]: value
    }));

    this.markAsDirty();
  }

  // ====================================================
  // GESTION DES PRESTATIONS
  // ====================================================

  private createItem(
    type: QuoteItemType
  ): EditorItem {
    return {
      key: this.nextItemKey++,
      type,
      name: '',
      description: '',
      quantity: 1,
      unit: 'Forfait',
      unitPrice: '0',
      discount: '0',
      billingCycle: 'Mensuel',
      commitmentMonths: null,
      autoRenew: false
    };
  }

  addItem(
    type: QuoteItemType = 'Ponctuelle'
  ): void {
    if (!this.canAddItem()) {
      return;
    }

    this.items.update(items => [
      ...items,
      this.createItem(type)
    ]);

    this.markAsDirty();
  }

  addWebsiteCreation(): void {
    if (!this.canAddItem()) {
      return;
    }

    this.items.update(items => [
      ...items,
      {
        ...this.createItem('Ponctuelle'),
        name: 'Création du site internet'
      }
    ]);

    this.markAsDirty();
  }

  addMaintenance(): void {
    if (!this.canAddItem()) {
      return;
    }

    this.items.update(items => [
      ...items,
      {
        ...this.createItem('Récurrente'),
        name: 'Maintenance et administration du site',
        billingCycle: 'Mensuel'
      }
    ]);

    this.markAsDirty();
  }

  updateItem<K extends keyof Omit<EditorItem, 'key'>>(
    key: number,
    field: K,
    value: EditorItem[K]
  ): void {
    if (this.saving()) {
      return;
    }

    this.items.update(items =>
      items.map(item => {
        if (item.key !== key) {
          return item;
        }

        const updated = {
          ...item,
          [field]: value
        };

        if (
          field === 'type' &&
          updated.type === 'Ponctuelle'
        ) {
          updated.billingCycle = 'Mensuel';
          updated.commitmentMonths = null;
          updated.autoRenew = false;
        }

        return updated;
      })
    );

    this.markAsDirty();
  }

  duplicateItem(key: number): void {
    if (!this.canAddItem()) {
      return;
    }

    this.items.update(items => {
      const index = items.findIndex(
        item => item.key === key
      );

      if (index === -1) {
        return items;
      }

      const copy: EditorItem = {
        ...items[index],
        key: this.nextItemKey++
      };

      const result = [...items];

      result.splice(index + 1, 0, copy);

      return result;
    });

    this.markAsDirty();
  }

  removeItem(key: number): void {
    if (this.saving()) {
      return;
    }

    this.items.update(items =>
      items.filter(item => item.key !== key)
    );

    this.markAsDirty();
  }

  moveItem(
    key: number,
    direction: -1 | 1
  ): void {
    if (this.saving()) {
      return;
    }

    this.items.update(items => {
      const index = items.findIndex(
        item => item.key === key
      );

      const target = index + direction;

      if (
        index < 0 ||
        target < 0 ||
        target >= items.length
      ) {
        return items;
      }

      const result = [...items];

      [
        result[index],
        result[target]
      ] = [
        result[target],
        result[index]
      ];

      return result;
    });

    this.markAsDirty();
  }

  // ====================================================
  // CALCULS DES PRESTATIONS
  // ====================================================

  getItemSubtotal(item: EditorItem): number {
    const quantity = Number(item.quantity);

    if (
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > 10000
    ) {
      return 0;
    }

    const unitPriceCents = this.parseAmountOrZero(
      item.unitPrice,
      MAX_UNIT_PRICE_CENTS
    );

    const subtotal = quantity * unitPriceCents;

    return Number.isSafeInteger(subtotal)
      ? subtotal
      : 0;
  }

  getItemDiscount(item: EditorItem): number {
    return Math.min(
      this.getItemSubtotal(item),
      this.parseAmountOrZero(item.discount)
    );
  }

  getItemTotal(item: EditorItem): number {
    return Math.max(
      0,
      this.getItemSubtotal(item) -
      this.getItemDiscount(item)
    );
  }

  getItemMonthlyAmount(item: EditorItem): number {
    if (item.type !== 'Récurrente') {
      return 0;
    }

    return Math.round(
      this.getItemTotal(item) /
      BILLING_MONTHS[item.billingCycle]
    );
  }

  getItemAnnualAmount(item: EditorItem): number {
    if (item.type !== 'Récurrente') {
      return 0;
    }

    return this.getItemTotal(item) * (
      12 / BILLING_MONTHS[item.billingCycle]
    );
  }

  getBillingLabel(cycle: BillingCycle): string {
    switch (cycle) {
      case 'Mensuel':
        return '/ mois';

      case 'Trimestriel':
        return '/ trimestre';

      case 'Annuel':
        return '/ an';
    }
  }

  // ====================================================
  // VALIDATION
  // ====================================================

  private validate(): string[] {
    const errors: string[] = [];
    const form = this.form();

    if (this.recipientId() === null) {
      errors.push(
        'Sélectionnez un prospect ou un client.'
      );
    }

    if (!this.isEditMode()) {
      const validRecipient =
        this.recipientType() === 'client'
          ? this.clients().some(
              client => client.id === this.recipientId()
            )
          : this.prospects().some(
              prospect => prospect.id === this.recipientId()
            );

      if (!validRecipient) {
        errors.push(
          'Le destinataire sélectionné est indisponible.'
        );
      }
    }

    if (!form.title.trim()) {
      errors.push(
        'Le titre du devis est obligatoire.'
      );
    }

    if (form.title.trim().length > 255) {
      errors.push(
        'Le titre ne peut pas dépasser 255 caractères.'
      );
    }

    if (!form.recipientName.trim()) {
      errors.push(
        'Le nom du destinataire est obligatoire.'
      );
    }

    if (
      form.recipientEmail.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        form.recipientEmail.trim()
      )
    ) {
      errors.push(
        'L’adresse e-mail du destinataire est invalide.'
      );
    }

    if (
      form.recipientSiret.trim() &&
      !/^\d{14}$/.test(
        form.recipientSiret.trim()
      )
    ) {
      errors.push(
        'Le SIRET doit contenir 14 chiffres.'
      );
    }

    if (form.validUntil) {
      if (!this.isValidDate(form.validUntil)) {
        errors.push(
          'La date de validité est invalide.'
        );

      } else if (
        form.validUntil <
        this.quotesService.getBusinessDate()
      ) {
        errors.push(
          'La date de validité ne peut pas être passée.'
        );
      }
    }

    // Validation des coordonnées du destinataire

    const recipientFields = Object.keys(
      this.createEmptyRecipient()
    ) as (keyof QuoteRecipient)[];

    for (const field of recipientFields) {
      if (form[field].trim().length > 255) {
        errors.push(
          'Une coordonnée du destinataire dépasse ' +
          '255 caractères.'
        );

        break;
      }
    }

    // Validation des conditions et notes

    const textFields: (keyof EditorForm)[] = [
      'paymentTerms',
      'deliveryTerms',
      'termsAndConditions',
      'publicNotes',
      'internalNotes'
    ];

    for (const field of textFields) {
      if (form[field].trim().length > 20000) {
        errors.push(
          'Une condition ou une note dépasse ' +
          '20 000 caractères.'
        );

        break;
      }
    }

    // Validation des prestations

    const items = this.items();

    if (items.length === 0) {
      errors.push(
        'Ajoutez au moins une prestation.'
      );
    }

    if (items.length > MAX_ITEMS) {
      errors.push(
        `Le devis est limité à ${MAX_ITEMS} prestations.`
      );
    }

    let oneOffSubtotal = 0;
    let oneOffDiscounts = 0;
    let recurringAnnual = 0;

    items.forEach((item, index) => {
      const label = `Prestation ${index + 1}`;

      if (!item.name.trim()) {
        errors.push(
          `${label} : le nom est obligatoire.`
        );
      }

      if (item.name.trim().length > 255) {
        errors.push(
          `${label} : le nom est trop long.`
        );
      }

      if (item.description.trim().length > 10000) {
        errors.push(
          `${label} : la description est trop longue.`
        );
      }

      if (
        !item.unit.trim() ||
        item.unit.trim().length > 50
      ) {
        errors.push(
          `${label} : l’unité est invalide.`
        );
      }

      const quantity = Number(item.quantity);

      const validQuantity =
        Number.isSafeInteger(quantity) &&
        quantity >= 1 &&
        quantity <= 10000;

      if (!validQuantity) {
        errors.push(
          `${label} : la quantité doit être ` +
          'un entier compris entre 1 et 10 000.'
        );
      }

      const price = this.parseAmount(
        item.unitPrice
      );

      const discount = this.parseAmount(
        item.discount
      );

      const validPrice =
        price !== null &&
        price <= MAX_UNIT_PRICE_CENTS;

      if (!validPrice) {
        errors.push(
          `${label} : le prix unitaire est invalide.`
        );
      }

      if (discount === null) {
        errors.push(
          `${label} : la remise est invalide.`
        );
      }

      if (
        validQuantity &&
        price !== null &&
        validPrice &&
        discount !== null
      ) {
        const subtotal = quantity * price;

        if (!Number.isSafeInteger(subtotal)) {
          errors.push(
            `${label} : le montant est trop élevé.`
          );

        } else if (discount > subtotal) {
          errors.push(
            `${label} : la remise dépasse le montant.`
          );

        } else {
          if (item.type === 'Ponctuelle') {
            oneOffSubtotal += subtotal;
            oneOffDiscounts += discount;

          } else if (
            this.billingCycles.includes(item.billingCycle)
          ) {
            recurringAnnual += (
              subtotal - discount
            ) * (
              12 / BILLING_MONTHS[item.billingCycle]
            );
          }
        }
      }

      if (item.type === 'Récurrente') {
        if (
          !this.billingCycles.includes(
            item.billingCycle
          )
        ) {
          errors.push(
            `${label} : la périodicité est invalide.`
          );
        }

        if (item.commitmentMonths !== null) {
          const months = Number(
            item.commitmentMonths
          );

          if (
            !Number.isSafeInteger(months) ||
            months < 1 ||
            months > 120
          ) {
            errors.push(
              `${label} : l’engagement doit être ` +
              'compris entre 1 et 120 mois.'
            );
          }
        }
      }
    });

    if (
      !Number.isSafeInteger(oneOffSubtotal) ||
      !Number.isSafeInteger(oneOffDiscounts) ||
      !Number.isSafeInteger(recurringAnnual)
    ) {
      errors.push(
        'Le montant total du devis est trop élevé.'
      );
    }

    // Validation de la remise globale

    const globalDiscount = this.parseAmount(
      form.globalDiscount
    );

    if (globalDiscount === null) {
      errors.push(
        'La remise globale est invalide.'
      );

    } else if (
      globalDiscount >
      oneOffSubtotal - oneOffDiscounts
    ) {
      errors.push(
        'La remise globale dépasse le montant ' +
        'des prestations ponctuelles.'
      );
    }

    return errors;
  }

  // ====================================================
  // PRÉPARATION DES DONNÉES
  // ====================================================

  private buildPayload(): QuoteInput {
    const form = this.form();

    const payload: QuoteInput = {
      title: form.title.trim(),
      validUntil: form.validUntil || null,

      recipientName: form.recipientName.trim(),
      recipientLegalName: form.recipientLegalName.trim(),
      recipientContactName: form.recipientContactName.trim(),
      recipientEmail: form.recipientEmail.trim(),
      recipientPhone: form.recipientPhone.trim(),
      recipientAddress: form.recipientAddress.trim(),
      recipientPostalCode: form.recipientPostalCode.trim(),
      recipientCity: form.recipientCity.trim(),
      recipientCountry: form.recipientCountry.trim(),
      recipientSiret: form.recipientSiret.trim(),

      globalDiscountCents:
        this.quotesService.eurosToCents(
          form.globalDiscount.trim() || '0'
        ),

      internalNotes: form.internalNotes.trim(),

      items: this.items().map(
        item => this.buildItemPayload(item)
      )
    };

    const commercialFields = [
      'paymentTerms',
      'deliveryTerms',
      'termsAndConditions',
      'publicNotes'
    ] as const;

    for (const field of commercialFields) {
      const value = form[field].trim();

      if (
        this.isEditMode() ||
        value ||
        form[field] !== this.initialForm?.[field]
      ) {
        payload[field] = value;
      }
    }

    if (!this.isEditMode()) {
      if (this.recipientType() === 'client') {
        payload.clientId = this.recipientId();
      } else {
        payload.prospectId = this.recipientId();
      }
    }

    return payload;
  }

  private buildItemPayload(
    item: EditorItem
  ): QuoteItemInput {
    const recurring =
      item.type === 'Récurrente';

    return {
      type: item.type,
      name: item.name.trim(),
      description: item.description.trim(),
      quantity: Number(item.quantity),
      unit: item.unit.trim(),

      unitPriceCents:
        this.quotesService.eurosToCents(
          item.unitPrice.trim() || '0'
        ),

      discountCents:
        this.quotesService.eurosToCents(
          item.discount.trim() || '0'
        ),

      billingCycle: recurring
        ? item.billingCycle
        : null,

      commitmentMonths: recurring
        ? item.commitmentMonths
        : null,

      autoRenew: recurring
        ? item.autoRenew
        : false
    };
  }

  // ====================================================
  // ENREGISTREMENT
  // ====================================================

  async save(): Promise<void> {
    if (!this.canSave()) {
      return;
    }

    this.saveError.set(null);
    this.validationErrors.set([]);

    const errors = this.validate();

    if (errors.length > 0) {
      this.validationErrors.set(errors);

      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });

      return;
    }

    this.saving.set(true);

    try {
      const payload = this.buildPayload();

      let quote: Quote;

      const id = this.quoteId();

      if (id !== null) {
        const changes: QuoteUpdate = {
          ...payload
        };

        quote = await this.quotesService.update(
          id,
          changes
        );

      } else {
        quote = await this.quotesService.create(
          payload
        );
      }

      this.currentQuote.set(quote);
      this.quoteId.set(quote.id);
      this.saved.set(true);

      this.markAsClean();

    } catch (error) {
      this.saveError.set(
        this.quotesService.getErrorMessage(
          error,
          'Impossible d’enregistrer le devis.'
        )
      );

      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });

      return;

    } finally {
      this.saving.set(false);
    }

    await this.router.navigate(['/quotes']);
  }

  // ====================================================
  // MODIFICATIONS NON ENREGISTRÉES
  // ====================================================

  private getSnapshot(): string {
    return JSON.stringify({
      recipientType: this.recipientType(),
      recipientId: this.recipientId(),
      form: this.form(),
      items: this.items()
    });
  }

  private markAsClean(): void {
    this.initialSnapshot = this.getSnapshot();
    this.dirty.set(false);
  }

  private markAsDirty(): void {
    this.dirty.set(
      this.getSnapshot() !== this.initialSnapshot
    );

    this.validationErrors.set([]);
    this.saveError.set(null);
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (
      this.saving() ||
      (this.dirty() && !this.saved())
    ) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  cancel(): void {
    if (this.saving()) {
      return;
    }

    if (this.dirty() && !this.saved()) {
      this.showLeaveConfirmation.set(true);
      return;
    }

    void this.router.navigate(['/quotes']);
  }

  closeLeaveConfirmation(): void {
    this.showLeaveConfirmation.set(false);
  }

  confirmLeave(): void {
    if (this.saving()) {
      return;
    }

    this.showLeaveConfirmation.set(false);
    this.dirty.set(false);

    void this.router.navigate(['/quotes']);
  }

  // ====================================================
  // UTILITAIRES
  // ====================================================

  private createEmptyRecipient(): QuoteRecipient {
    return {
      recipientName: '',
      recipientLegalName: '',
      recipientContactName: '',
      recipientEmail: '',
      recipientPhone: '',
      recipientAddress: '',
      recipientPostalCode: '',
      recipientCity: '',
      recipientCountry: 'France',
      recipientSiret: ''
    };
  }

  private createEmptyForm(): EditorForm {
    return {
      ...this.createEmptyRecipient(),
      title: '',
      validUntil: '',
      globalDiscount: '0',
      paymentTerms: '',
      deliveryTerms: '',
      termsAndConditions: '',
      publicNotes: '',
      internalNotes: ''
    };
  }

  private parseId(
    value: number | string | null
  ): number | null {
    if (
      value === null ||
      !/^\d+$/.test(String(value))
    ) {
      return null;
    }

    const id = Number(value);

    return Number.isSafeInteger(id) && id > 0
      ? id
      : null;
  }

  private parseAmount(
    value: string
  ): number | null {
    try {
      return this.quotesService.eurosToCents(
        value.trim() || '0'
      );
    } catch {
      return null;
    }
  }

  private parseAmountOrZero(
    value: string,
    maximum = Number.MAX_SAFE_INTEGER
  ): number {
    const cents = this.parseAmount(value);

    return cents !== null && cents <= maximum
      ? cents
      : 0;
  }

  private amountToInput(cents: number): string {
    return (
      this.quotesService.centsToEuros(cents)
    ).toFixed(2);
  }

  private normalizeSearch(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private isValidDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const date = new Date(
      `${value}T00:00:00.000Z`
    );

    return !Number.isNaN(date.getTime()) &&
      date.getUTCFullYear() >= 2000 &&
      date.toISOString().slice(0, 10) === value;
  }

  formatAmount(cents: number): string {
    return this.quotesService.formatAmount(cents);
  }

  getRecipientLabel(): string {
    return this.form().recipientLegalName ||
      this.form().recipientName ||
      'Aucun destinataire sélectionné';
  }

  getQuoteLabel(): string {
    const quote = this.currentQuote();

    return quote
      ? this.quotesService.getQuoteLabel(quote)
      : 'Nouveau brouillon';
  }

  getInitials(name: string): string {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(word =>
        word.charAt(0).toUpperCase()
      )
      .join('') || '?';
  }
}