
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
    path: '**',
    redirectTo: ''
  }
];
