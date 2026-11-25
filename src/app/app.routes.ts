
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
  path: 'messaging',
  loadComponent: () =>
    import('./features/messaging/messaging')
      .then(m => m.Messaging)
  },
  {
  path: 'clients',
  loadComponent: () =>
    import('./features/clients/clients')
      .then(m => m.Clients)
  },
  {
    path: 'clients/new',
    loadComponent: () =>
      import('./features/client-detail/client-detail')
        .then(m => m.ClientDetail)
  },
  {
    path: 'clients/:id',
    loadComponent: () =>
      import('./features/client-detail/client-detail')
        .then(m => m.ClientDetail)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
