import { CanDeactivateFn } from '@angular/router';

// ==========================================
// INTERFACE DES COMPOSANTS PROTÉGÉS
// ==========================================

export interface UnsavedChangesComponent {
  dirty(): boolean;
  saving(): boolean;
  saved(): boolean;
}

// ==========================================
// PROTECTION DE LA NAVIGATION
// ==========================================

export const unsavedChangesGuard:
  CanDeactivateFn<UnsavedChangesComponent> = (
    component
  ) => {

    // Interdire la navigation pendant un enregistrement

    if (component.saving()) {
      return false;
    }

    // Autoriser la navigation si le formulaire
    // est enregistré ou n'a pas été modifié

    if (
      component.saved() ||
      !component.dirty()
    ) {
      return true;
    }

    // Demander une confirmation avant de quitter

    return window.confirm(
      'Vous avez des modifications non enregistrées.\n\n' +
      'Si vous quittez cette page, elles seront perdues.\n\n' +
      'Voulez-vous vraiment quitter cette page ?'
    );
  };