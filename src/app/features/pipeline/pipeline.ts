
import { Component, computed, inject, signal } from '@angular/core';
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

  readonly loading = this.service.loading;
  readonly loadError = this.service.error;
  readonly moving = signal(false);
  readonly error = signal<string | null>(null);

  readonly stages: {
    status: ProspectStatus;
    color: string;
  }[] = [
    { status: 'À contacter', color: '#94a3b8' },
    { status: 'Contacté', color: '#3b82f6' },
    { status: 'À relancer', color: '#f59e0b' },
    { status: 'En discussion', color: '#8b5cf6' },
    { status: 'Client', color: '#15b8a6' }
  ];

  readonly columns = computed(() =>
    this.stages.map(stage => ({
      ...stage,
      prospects: this.service.prospects().filter(
        p => p.status === stage.status
      )
    }))
  );

  async drop(
    event: CdkDragDrop<Prospect[]>,
    status: ProspectStatus
  ): Promise<void> {
    if (event.previousContainer === event.container) return;
    if (this.moving()) return;

    const prospect = event.item.data as Prospect;

    this.moving.set(true);
    this.error.set(null);

    try {
      await this.service.update(prospect.id, { status });
    } catch (error) {
      console.error(error);
      this.error.set('Impossible de déplacer le prospect.');
    } finally {
      this.moving.set(false);
    }
  }
}
