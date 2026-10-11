// Mises à jour de l'application (service worker).
// Une app installée reste souvent ouverte en arrière-plan pendant des jours : sans vérification explicite,
// elle ne verrait jamais les nouvelles versions. On vérifie donc au démarrage, au retour au premier plan,
// au retour du réseau, et à la demande (bouton dans « Plus »).
import { $ } from './util.js';

const DELAI_MIN = 10 * 60 * 1000;
let enregistrement = null;
let derniereVerif = 0;

/** Bandeau « nouvelle version » : on propose de recharger sans forcer, pour ne pas perdre une saisie en cours. */
function proposerRechargement() {
  if ($('#maj')) return;
  const bandeau = document.createElement('div');
  bandeau.id = 'maj';
  bandeau.className = 'bandeau-maj';
  bandeau.innerHTML = '<span>Nouvelle version de l’application installée.</span><button class="btn btn-petit btn-plein">Recharger</button>';
  bandeau.querySelector('button').onclick = () => location.reload();
  document.body.appendChild(bandeau);
}

/**
 * Compare la version installée avec celle du site.
 * @returns {Promise<'nouvelle'|'a-jour'|'hors-ligne'|'indisponible'>}
 */
export async function verifierMiseAJour({ force = false } = {}) {
  if (!enregistrement) return 'indisponible';
  if (!navigator.onLine) return 'hors-ligne';
  if (!force && Date.now() - derniereVerif < DELAI_MIN) return 'a-jour';
  derniereVerif = Date.now();
  try {
    await enregistrement.update();
  } catch (e) {
    console.warn('Vérification de mise à jour impossible', e);
    return 'hors-ligne';
  }
  return enregistrement.installing || enregistrement.waiting ? 'nouvelle' : 'a-jour';
}

export function installerMisesAJour() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  // Le bandeau ne s'affiche que pour une mise à jour, pas à la toute première installation.
  const avaitVersion = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => avaitVersion && proposerRechargement());
  navigator.serviceWorker.register('sw.js')
    .then((reg) => {
      enregistrement = reg;
      verifierMiseAJour({ force: true });
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && verifierMiseAJour());
      window.addEventListener('online', () => verifierMiseAJour({ force: true }));
    })
    .catch((e) => console.warn('Service worker non installé', e));
}
