import {
  Component,
  computed,
  inject,
  signal
} from '@angular/core';

import { RouterLink } from '@angular/router';

import {
  CdkDrag,
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
    CdkDropList,
    CdkDropListGroup
  ],
  templateUrl: './pipeline.html',
  styleUrl: './pipeline.scss'
})
export class Pipeline {

  private readonly service = inject(ProspectsService);
  private readonly clientsService = inject(ClientsService);

  readonly loading = computed(() =>
    this.service.loading() ||
    this.clientsService.loading()
  );

  readonly loadError = computed(() =>
    this.service.error() ||
    this.clientsService.error()
  );

  readonly moving = signal(false);
  readonly error = signal<string | null>(null);

  // Les quatre étapes commerciales

  readonly stages: {
    status: ProspectStatus;
    color: string;
  }[] = [
    { status: 'À contacter', color: '#94a3b8' },
    { status: 'Contacté', color: '#3b82f6' },
    { status: 'À relancer', color: '#f59e0b' },
    { status: 'En discussion', color: '#8b5cf6' }
  ];

  // Exclusion des prospects convertis

  readonly prospects = computed(() => {

    const convertedIds = new Set(
      this.clientsService.clients()
        .map(client => client.prospectId)
    );

    return this.service.prospects().filter(
      prospect => !convertedIds.has(prospect.id)
    );

  });

  // Anciens prospects dont la conversion reste à finaliser

  readonly pendingConversions = computed(() =>
    this.prospects().filter(
      prospect => prospect.status === 'Client'
    )
  );

  // Construction des colonnes

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
      (total, column) => total + column.prospects.length,
      0
    )
  );

  constructor() {
    void this.refresh();
  }

  // Actualisation

  async refresh(): Promise<void> {

    await Promise.all([
      this.service.load(),
      this.clientsService.load()
    ]);

  }

  // Déplacement dans le pipeline

  async drop(
    event: CdkDragDrop<Prospect[]>,
    status: ProspectStatus
  ): Promise<void> {

    if (event.previousContainer === event.container) return;

    if (
      this.moving() ||
      this.loading() ||
      this.loadError()
    ) return;

    if (!this.stages.some(stage => stage.status === status)) {
      return;
    }

    const prospect = event.item.data as Prospect;

    if (
      !this.prospects().some(
        item => item.id === prospect.id
      )
    ) return;

    this.moving.set(true);
    this.error.set(null);

    try {

      await this.service.update(
        prospect.id,
        { status }
      );

    } catch (error) {

      console.error(error);

      this.error.set(
        'Impossible de déplacer le prospect.'
      );

      await this.refresh();

    } finally {

      this.moving.set(false);

    }
  }
}