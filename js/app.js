// Point d'entrée : chargement des données, routes, service worker.
import { charger, etat, nettoyerPhotos } from './store.js';
import { demanderPersistance } from './db.js';
import { $, $$ } from './util.js';
import { vueAccueil, vueBienvenue } from './views/accueil.js';
import { vueLatrines, vueFicheLatrine } from './views/latrines.js';
import { vueJournal, vueRapport } from './views/journal.js';
import { vueArgent } from './views/argent.js';
import { vueStock } from './views/stock.js';
import { vueEquipe } from './views/equipe.js';
import { vuePlus, vueSauvegarde, vueFactures, vueRapports } from './views/plus.js';
import { vueReglages } from './views/reglages.js';
import { pastilleLogo } from './views/profil.js';

const ROUTES = [
  [/^\/?$/, 'accueil', vueAccueil],
  [/^\/latrines(?:\/(nouvelle))?$/, 'latrines', vueLatrines],
  [/^\/latrine\/([\w-]+)$/, 'latrines', vueFicheLatrine],
  [/^\/journal(?:\/(nouveau))?$/, 'journal', vueJournal],
  [/^\/rapport\/([\w-]+)$/, 'journal', vueRapport],
  [/^\/argent(?:\/(entree|sortie))?$/, 'argent', vueArgent],
  [/^\/stock$/, 'plus', vueStock],
  [/^\/equipe$/, 'plus', vueEquipe],
  [/^\/factures$/, 'plus', vueFactures],
  [/^\/rapports$/, 'plus', vueRapports],
  [/^\/reglages$/, 'plus', vueReglages],
  [/^\/sauvegarde$/, 'plus', vueSauvegarde],
  [/^\/plus$/, 'plus', vuePlus],
];

let derniereRoute = '';

export async function afficher() {
  const chemin = location.hash.replace(/^#/, '') || '/';
  const vue = $('#vue');
  const changement = chemin !== derniereRoute;
  derniereRoute = chemin;

  // Avant le premier remplissage, la barre du bas est masquée : elle ne mènerait nulle part.
  document.body.classList.toggle('demarrage', !etat.configure);
  if (!etat.configure && chemin !== '/reglages') {
    marquerNav('accueil');
    await vueBienvenue(vue);
    return;
  }

  const route = ROUTES.find(([re]) => re.test(chemin));
  if (!route) {
    location.hash = '#/';
    return;
  }
  const [re, nav, fn] = route;
  marquerNav(nav);
  try {
    await fn(vue, ...(chemin.match(re).slice(1)));
  } catch (err) {
    console.error(err);
    vue.innerHTML = `<div class="vide"><p>Une erreur est survenue : ${String(err.message).replace(/</g, '&lt;')}</p><a class="btn" href="#/">Retour à l’accueil</a></div>`;
  }
  if (changement) window.scrollTo(0, 0);
}

/** Revient à une route sans créer d'entrée d'historique (après fermeture d'un formulaire ouvert par URL). */
export function remplacerRoute(hash) {
  history.replaceState(null, '', hash);
  derniereRoute = hash.replace(/^#/, '');
}

function marquerNav(nom) {
  $$('.nav a').forEach((a) => a.classList.toggle('actif', a.dataset.nav === nom));
}

function majEntete() {
  const p = etat.params;
  if (!etat.configure) return;
  $('#logo-entete').innerHTML = pastilleLogo(p.tpe);
  $('#nom-tpe').textContent = p.tpe.nom || 'Ma TPE';
  $('#sous-titre').textContent = [p.tpe.lot && `Lot ${p.tpe.lot}`, p.tpe.village || p.contrat.projet].filter(Boolean).join(' · ');
}

function majReseau() {
  const r = $('#reseau');
  const enLigne = navigator.onLine;
  r.textContent = enLigne ? 'En ligne' : 'Hors ligne';
  r.classList.toggle('hors', !enLigne);
}

export async function rafraichir() {
  majEntete();
  await afficher();
}

/** Écran d'erreur bloquant : on ne laisse pas l'utilisateur saisir si ses données ne sont pas chargées. */
function afficherErreurBase(err) {
  $('#vue').innerHTML = `<div class="vide"><p><strong>Impossible d’ouvrir les données du chantier.</strong><br>${String(err.message || err).replace(/</g, '&lt;')}</p>
    <button class="btn btn-plein" id="reessayer">Réessayer</button></div>`;
  $('#reessayer').onclick = () => location.reload();
}

function proposerRechargement() {
  if ($('#maj')) return;
  const bandeau = document.createElement('div');
  bandeau.id = 'maj';
  bandeau.className = 'bandeau-maj';
  bandeau.innerHTML = '<span>Nouvelle version de l’application installée.</span><button class="btn btn-petit btn-plein">Recharger</button>';
  bandeau.querySelector('button').onclick = () => location.reload();
  document.body.appendChild(bandeau);
}

async function demarrer() {
  try {
    await charger();
  } catch (err) {
    console.error(err);
    afficherErreurBase(err);
    return;
  }
  majEntete();
  majReseau();
  window.addEventListener('online', majReseau);
  window.addEventListener('offline', majReseau);
  window.addEventListener('hashchange', afficher);
  await afficher();
  demanderPersistance();
  nettoyerPhotos().catch((e) => console.warn('Nettoyage des photos impossible', e));

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    // Une nouvelle version vient de s'installer : on propose de recharger (sans forcer, pour ne pas perdre une saisie).
    const avaitVersion = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => avaitVersion && proposerRechargement());
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker non installé', e));
  }
}

demarrer();
