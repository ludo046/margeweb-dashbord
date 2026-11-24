
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
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
    path: 'prospects/new',
    loadComponent: () =>
      import('./features/prospect-detail/prospect-detail')
        .then(m => m.ProspectDetail)
  },
  {
    path: 'prospects/:id',
    loadComponent: () =>
      import('./features/prospect-detail/prospect-detail')
        .then(m => m.ProspectDetail)
  },
  {
  path: 'pipeline',
  loadComponent: () =>
    import('./features/pipeline/pipeline')
      .then(m => m.Pipeline)
  },
  {
  path: 'follow-ups',
  loadComponent: () =>
    import('./features/follow-ups/follow-ups')
      .then(m => m.FollowUps)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
