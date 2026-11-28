import {
  Component,
  computed,
  inject,
  signal
} from '@angular/core';

import { RouterLink } from '@angular/router';

import {
  CdkDrag,
  CdkDragHandle,
  CdkDropList,
  CdkDropListGroup,
  CdkDragDrop
} from '@angular/cdk/drag-drop';

import {
  Prospect,
  ProspectStatus,
  ProspectsService
} from '../../core/services/prospects';

import {
  ClientsService
} from '../../core/services/clients';

@Component({
  selector: 'app-pipeline',
  standalone: true,
  imports: [
    RouterLink,
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    CdkDropListGroup
  ],
  templateUrl: './pipeline.html',
  styleUrl: './pipeline.scss'
})
export class Pipeline {

  // ==========================================
  // SERVICES
  // ==========================================

  private readonly service = inject(ProspectsService);

  private readonly clientsService = inject(ClientsService);

  // ==========================================
  // ETATS
  // ==========================================

  readonly loading = computed(() =>
    this.service.loading() ||
    this.clientsService.loading()
  );

  readonly loadError = computed(() =>
    this.service.error() ||
    this.clientsService.error()
  );

  readonly moving = signal(false);

  readonly movingProspectId = signal<number | null>(null);

  readonly error = signal<string | null>(null);

  // ==========================================
  // ETAPES COMMERCIALES
  // ==========================================

  readonly stages: {
    status: ProspectStatus;
    color: string;
  }[] = [
    {
      status: 'À contacter',
      color: '#94a3b8'
    },
    {
      status: 'Contacté',
      color: '#3b82f6'
    },
    {
      status: 'À relancer',
      color: '#f59e0b'
    },
    {
      status: 'En discussion',
      color: '#8b5cf6'
    }
  ];

  // ==========================================
  // EXCLUSION DES PROSPECTS CONVERTIS
  // ==========================================

  readonly prospects = computed(() => {

    const convertedIds = new Set(
      this.clientsService.clients()
        .map(client => client.prospectId)
    );

    return this.service.prospects().filter(
      prospect => !convertedIds.has(prospect.id)
    );

  });

  // ==========================================
  // CONVERSIONS A FINALISER
  // ==========================================

  readonly pendingConversions = computed(() =>
    this.prospects().filter(
      prospect => prospect.status === 'Client'
    )
  );

  // ==========================================
  // COLONNES DU PIPELINE
  // ==========================================

  readonly columns = computed(() =>
    this.stages.map(stage => ({
      ...stage,

      prospects: this.prospects().filter(
        prospect => prospect.status === stage.status
      )
    }))
  );

  readonly totalProspects = computed(() =>
    this.columns().reduce(
      (total, column) =>
        total + column.prospects.length,
      0
    )
  );

  // ==========================================
  // DISPONIBILITE DES ACTIONS
  // ==========================================

  readonly actionsDisabled = computed(() =>
    this.moving() ||
    this.loading() ||
    !!this.loadError()
  );

  // ==========================================
  // INITIALISATION
  // ==========================================

  constructor() {

    void this.refresh();

  }

  // ==========================================
  // ACTUALISATION
  // ==========================================

  async refresh(): Promise<void> {

    await Promise.all([
      this.service.load(),
      this.clientsService.load()
    ]);

  }

  // ==========================================
  // VALIDATION DES STATUTS
  // ==========================================

  private isCommercialStatus(
    status: string
  ): status is ProspectStatus {

    return this.stages.some(
      stage => stage.status === status
    );

  }

  // ==========================================
  // VERIFICATION DU DEPLACEMENT
  // ==========================================

  canMoveProspect(prospect: Prospect): boolean {

    if (this.actionsDisabled()) {
      return false;
    }

    const current = this.prospects().find(
      item => item.id === prospect.id
    );

    if (!current) {
      return false;
    }

    return this.isCommercialStatus(
      current.status
    );

  }

  // ==========================================
  // GLISSER-DEPOSER
  // ==========================================

  async drop(
    event: CdkDragDrop<Prospect[]>,
    status: ProspectStatus
  ): Promise<void> {

    if (
      event.previousContainer === event.container
    ) {
      return;
    }

    const prospect = event.item.data as Prospect;

    if (!prospect) {
      return;
    }

    await this.moveProspect(
      prospect.id,
      status
    );

  }

  // ==========================================
  // CHANGEMENT DE STATUT PAR SELECTEUR
  // ==========================================

  async changeStatus(
    prospect: Prospect,
    status: string
  ): Promise<void> {

    if (!this.isCommercialStatus(status)) {
      return;
    }

    await this.moveProspect(
      prospect.id,
      status
    );

  }

  // ==========================================
  // DEPLACEMENT CENTRALISE
  // ==========================================

  async moveProspect(
    prospectId: number,
    status: ProspectStatus
  ): Promise<void> {

    // Une seule modification a la fois

    if (this.actionsDisabled()) {
      return;
    }

    // Verification du statut de destination

    if (!this.isCommercialStatus(status)) {
      return;
    }

    // Recuperation du prospect actuel

    const prospect = this.prospects().find(
      item => item.id === prospectId
    );

    if (!prospect) {
      return;
    }

    // Protection des anciens statuts Client

    if (!this.isCommercialStatus(prospect.status)) {
      return;
    }

    // Aucun changement necessaire

    if (prospect.status === status) {
      return;
    }

    // Debut de la modification

    this.moving.set(true);

    this.movingProspectId.set(prospectId);

    this.error.set(null);

    try {

      await this.service.update(
        prospectId,
        { status }
      );

    } catch (error) {

      console.error(error);

      this.error.set(
        'Impossible de déplacer le prospect. ' +
        'Veuillez réessayer.'
      );

      // Rechargement des donnees pour eviter
      // toute incoherence avec le serveur

      await this.refresh();

    } finally {

      this.moving.set(false);

      this.movingProspectId.set(null);

    }

  }

  // ==========================================
  // INDICATEUR DE DEPLACEMENT
  // ==========================================

  isMovingProspect(prospectId: number): boolean {

    return this.movingProspectId() === prospectId;

  }

  // ==========================================
  // FERMETURE DU MESSAGE D'ERREUR
  // ==========================================

  dismissError(): void {

    this.error.set(null);

  }

}