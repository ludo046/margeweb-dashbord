
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/dashboard/dashboard')
        .then(m => m.Dashboard)
  },
  {
    path: 'prospects',
    loadComponent: () =>
      import('./features/prospects/prospects')
        .then(m => m.Prospects)
  },
  {
  path: 'prospects/:id',
  loadComponent: () =>
    import('./features/prospect-detail/prospect-detail')
      .then(m => m.ProspectDetail)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
