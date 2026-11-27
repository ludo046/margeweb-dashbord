import { Routes } from '@angular/router';

import {
  unsavedChangesGuard
} from './core/guards/unsaved-changes-guard';

export const routes: Routes = [

  // ==========================================
  // TABLEAU DE BORD
  // ==========================================

  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/dashboard/dashboard')
        .then(m => m.Dashboard)
  },

  // ==========================================
  // PROSPECTS
  // ==========================================

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

  // ==========================================
  // PIPELINE
  // ==========================================

  {
    path: 'pipeline',
    loadComponent: () =>
      import('./features/pipeline/pipeline')
        .then(m => m.Pipeline)
  },

  // ==========================================
  // RELANCES
  // ==========================================

  {
    path: 'follow-ups',
    loadComponent: () =>
      import('./features/follow-ups/follow-ups')
        .then(m => m.FollowUps)
  },

  // ==========================================
  // MESSAGERIE
  // ==========================================

  {
    path: 'messaging',
    loadComponent: () =>
      import('./features/messaging/messaging')
        .then(m => m.Messaging)
  },

  // ==========================================
  // CLIENTS
  // ==========================================

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

  // ==========================================
  // ABONNEMENTS
  // ==========================================

  {
    path: 'subscriptions',
    loadComponent: () =>
      import('./features/subscriptions/subscriptions')
        .then(m => m.Subscriptions)
  },

  // ==========================================
  // DEVIS
  // ==========================================

  {
    path: 'quotes',
    loadComponent: () =>
      import('./features/quotes/quotes')
        .then(m => m.Quotes)
  },
  {
    path: 'quotes/new',
    canDeactivate: [
      unsavedChangesGuard
    ],
    loadComponent: () =>
      import('./features/quote-editor/quote-editor')
        .then(m => m.QuoteEditor)
  },
  {
    path: 'quotes/:id/edit',
    canDeactivate: [
      unsavedChangesGuard
    ],
    loadComponent: () =>
      import('./features/quote-editor/quote-editor')
        .then(m => m.QuoteEditor)
  },
  {
    path: 'quotes/:id',
    loadComponent: () =>
      import('./features/quote-detail/quote-detail')
        .then(m => m.QuoteDetail)
  },

  // ==========================================
  // REDIRECTION
  // ==========================================

  {
    path: '**',
    redirectTo: ''
  }
];