
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  Prospect,
  ProspectStatus,
  ProspectsService
} from '../../core/services/prospects';

@Component({
  selector: 'app-prospect-detail',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './prospect-detail.html',
  styleUrl: './prospect-detail.scss'
})
export class ProspectDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(ProspectsService);

  private readonly id = Number(
    this.route.snapshot.paramMap.get('id')
  );

  readonly prospect = computed(() =>
    this.service.prospects().find(p => p.id === this.id)
  );

  readonly editing = signal(false);

  draft: Prospect | null = null;

  readonly statuses: ProspectStatus[] = [
    'À contacter',
    'Contacté',
    'À relancer',
    'En discussion',
    'Client'
  ];

  startEditing(): void {
    const current = this.prospect();
    if (!current) return;

    this.draft = { ...current };
    this.editing.set(true);
  }

  cancelEditing(): void {
    this.draft = null;
    this.editing.set(false);
  }

  save(): void {
    if (!this.draft) return;

    this.service.update(this.id, this.draft);
    this.draft = null;
    this.editing.set(false);
  }
}
