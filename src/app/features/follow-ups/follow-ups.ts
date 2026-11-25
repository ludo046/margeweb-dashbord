import {
  Component,
  computed,
  inject,
  signal
} from '@angular/core';

import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  Prospect,
  ProspectsService
} from '../../core/services/prospects';

@Component({
  selector: 'app-follow-ups',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    FormsModule
  ],
  templateUrl: './follow-ups.html',
  styleUrl: './follow-ups.scss'
})
export class FollowUps {

  private readonly service = inject(ProspectsService);

  readonly loading = this.service.commercialLoading;
  readonly loadError = this.service.commercialError;

  readonly error = signal<string | null>(null);
  readonly saving = signal(false);

  readonly selectedProspect = signal<Prospect | null>(null);
  readonly newDate = signal('');

  readonly today = signal(this.localDate(new Date()));

  // Date locale

  private localDate(date: Date): string {

    const year = date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, '0');

    const day = String(
      date.getDate()
    ).padStart(2, '0');

    return `${year}-${month}-${day}`;

  }

  // Relances commerciales

  readonly scheduled = this.service.scheduledFollowUps;

  readonly overdue = computed(() =>
    this.scheduled().filter(
      prospect =>
        prospect.nextFollowUp! < this.today()
    )
  );

  readonly dueToday = computed(() =>
    this.scheduled().filter(
      prospect =>
        prospect.nextFollowUp === this.today()
    )
  );

  readonly upcoming = computed(() =>
    this.scheduled().filter(
      prospect =>
        prospect.nextFollowUp! > this.today()
    )
  );

  // Groupes de relances

  readonly groups = computed(() => [
    {
      title: 'Relances en retard',
      type: 'overdue',
      prospects: this.overdue()
    },
    {
      title: 'Relances du jour',
      type: 'today',
      prospects: this.dueToday()
    },
    {
      title: 'Prochaines relances',
      type: 'upcoming',
      prospects: this.upcoming()
    }
  ]);

  // Calendrier

  readonly currentMonth = signal(new Date());

  readonly selectedDay = signal<string | null>(null);

  readonly weekDays = [
    'Lun',
    'Mar',
    'Mer',
    'Jeu',
    'Ven',
    'Sam',
    'Dim'
  ];

  readonly monthLabel = computed(() =>
    this.currentMonth().toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric'
    })
  );

  readonly calendarDays = computed(() => {

    const current = this.currentMonth();

    const year = current.getFullYear();
    const month = current.getMonth();

    const firstDay = new Date(year, month, 1);

    const offset = (firstDay.getDay() + 6) % 7;

    return Array.from({ length: 42 }, (_, index) => {

      const date = new Date(
        year,
        month,
        index - offset + 1
      );

      const isoDate = this.localDate(date);

      return {
        date: isoDate,
        day: date.getDate(),
        inMonth: date.getMonth() === month,
        isToday: isoDate === this.today(),
        isOverdue: isoDate < this.today(),
        prospects: this.scheduled().filter(
          prospect =>
            prospect.nextFollowUp === isoDate
        )
      };

    });

  });

  readonly selectedDayProspects = computed(() =>
    this.scheduled().filter(
      prospect =>
        prospect.nextFollowUp === this.selectedDay()
    )
  );

  constructor() {
    void this.refresh();
  }

  // Actualisation

  async refresh(): Promise<void> {

    this.today.set(this.localDate(new Date()));

    await this.service.loadCommercialData();

  }

  // Navigation dans le calendrier

  changeMonth(direction: number): void {

    const current = this.currentMonth();

    this.currentMonth.set(
      new Date(
        current.getFullYear(),
        current.getMonth() + direction,
        1
      )
    );

    this.selectedDay.set(null);

  }

  goToToday(): void {

    const now = new Date();

    this.today.set(this.localDate(now));
    this.currentMonth.set(now);
    this.selectedDay.set(this.localDate(now));

  }

  selectDay(date: string): void {

    this.selectedDay.set(
      this.selectedDay() === date
        ? null
        : date
    );

  }

  // Report d'une relance

  openReschedule(prospect: Prospect): void {

    this.error.set(null);

    if (
      this.saving() ||
      !this.service.canScheduleFollowUp(prospect.id)
    ) {

      this.error.set(
        'Ce prospect ne peut plus faire l’objet d’une relance commerciale.'
      );

      return;

    }

    this.selectedProspect.set(prospect);

    const tomorrow = new Date();

    tomorrow.setDate(tomorrow.getDate() + 1);

    this.newDate.set(this.localDate(tomorrow));

  }

  closeModal(): void {

    if (this.saving()) return;

    this.selectedProspect.set(null);
    this.error.set(null);

  }

  async reschedule(): Promise<void> {

    const prospect = this.selectedProspect();

    if (
      !prospect ||
      !this.newDate() ||
      this.saving()
    ) {
      return;
    }

    this.error.set(null);

    if (!this.service.canScheduleFollowUp(prospect.id)) {

      this.selectedProspect.set(null);

      this.error.set(
        'Cette relance commerciale n’est plus disponible.'
      );

      return;

    }

    this.saving.set(true);

    try {

      await this.service.update(prospect.id, {
        nextFollowUp: this.newDate()
      });

      this.selectedProspect.set(null);

    } catch (error) {

      console.error(error);

      this.error.set(
        'Impossible de reporter la relance.'
      );

      await this.refresh();

      if (!this.service.canScheduleFollowUp(prospect.id)) {
        this.selectedProspect.set(null);
      }

    } finally {

      this.saving.set(false);

    }

  }

  // Terminer une relance

  async complete(prospect: Prospect): Promise<void> {

    if (this.saving()) return;

    this.error.set(null);

    if (!this.service.canScheduleFollowUp(prospect.id)) {

      this.error.set(
        'Cette relance commerciale n’est plus disponible.'
      );

      return;

    }

    if (!confirm(
      `Marquer la relance de ${prospect.name} comme effectuée ?`
    )) {
      return;
    }

    this.saving.set(true);

    try {

      await this.service.completeFollowUp(prospect.id);

    } catch (error) {

      console.error(error);

      this.error.set(
        'Impossible de terminer la relance.'
      );

      await this.refresh();

    } finally {

      this.saving.set(false);

    }

  }

}