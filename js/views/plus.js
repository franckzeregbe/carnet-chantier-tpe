// Menu « Plus » : sauvegarde, factures ONG, rapports imprimables, installation.
import { etat, exporterTout, importerTout, toutEffacer, marquerConfigure, marquerSauvegarde } from '../store.js';
import { db } from '../db.js';
import { html, raw, fcfa, num, todayISO, dateFr, lundiDe, ajouterJours, toast, telechargerFichier, initiales, $, $$ } from '../util.js';
import { ico, puces, confirmer, vide } from '../ui.js';
import { sigleONG } from '../data.js';
import { paiementsParLatrine, statut } from '../calc.js';
import { rafraichir } from '../app.js';
import {
  imprimerFacture, instantaneFacture, imprimerSituation, imprimerSituationOfficielle, imprimerAvancement, imprimerJournalSemaine, exporterLatrinesCSV,
} from '../reports.js';

let invitationInstall = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  invitationInstall = e;
});

export async function vuePlus(vue) {
  const installee = window.matchMedia('(display-mode: standalone)').matches;
  const tuiles = [
    ['#/stock', 'box', 'Kits & stock', 'Quincaillerie dédiée'],
    ['#/equipe', 'team', 'Équipe', 'Présences & paies'],
    ['#/factures', 'invoice', 'Factures ONG', 'Lots de latrines'],
    ['#/rapports', 'print', 'Rapports PDF', 'Journal, bilan…'],
    ['#/sauvegarde', 'save', 'Sauvegarde', 'Ne rien perdre'],
    ['#/reglages', 'gear', 'Réglages', 'TPE, ONG, contrat, kit'],
  ];
  vue.innerHTML = html`
    <div class="titre-vue"><div><span class="sur">${etat.params.tpe.nom}</span><h1>Plus</h1></div></div>
    <div class="menu-grille">${raw(tuiles.map(([h, i, t, s]) => html`<a class="tuile" href="${h}"><span class="pastille">${ico(i)}</span><strong>${t}</strong><small>${s}</small></a>`).join(''))}</div>
    ${raw(installee ? '' : html`<div class="carte">
      <h3>Installer sur le téléphone</h3>
      <p style="color:var(--encre-2);font-size:14px">L’application s’ouvre alors comme une vraie app, même sans réseau au village.</p>
      <button class="btn btn-plein btn-bloc" id="installer">${ico('save')} Installer l’application</button>
      <p class="aide" id="aide-install" hidden>Sur Android (Chrome) : menu ⋮ → « Ajouter à l’écran d’accueil ». Sur iPhone (Safari) : bouton Partager → « Sur l’écran d’accueil ».</p>
    </div>`)}
    <p class="aide" style="text-align:center">Carnet de chantier TPE · une application Vision Noble<br>Données stockées uniquement dans ce téléphone</p>`;

  const btn = $('#installer', vue);
  if (btn) {
    btn.onclick = async () => {
      if (invitationInstall) {
        invitationInstall.prompt();
        const r = await invitationInstall.userChoice;
        if (r.outcome === 'accepted') toast('Application installée');
        invitationInstall = null;
      } else $('#aide-install', vue).hidden = false;
    };
  }
}

// ---------- Sauvegarde ----------

export async function vueSauvegarde(vue) {
  let espace = '';
  try {
    const e = await navigator.storage.estimate();
    espace = `${num((e.usage || 0) / 1048576)} Mo utilisés`;
  } catch { espace = ''; }
  const nb = etat.latrines.length + etat.journal.length + etat.txs.length;
  vue.innerHTML = html`
    <a class="retour" href="#/plus">${ico('back')} Plus</a>
    <div class="titre-vue"><div><span class="sur">${espace}</span><h1>Sauvegarde</h1></div></div>
    <div class="note">Tes données sont <strong>uniquement dans ce téléphone</strong>. Si le téléphone est perdu ou réinitialisé, tout est perdu. Fais une sauvegarde chaque semaine et envoie-la sur WhatsApp ou Google Drive quand tu as du réseau.</div>
    <div class="carte">
      <dl class="infos"><dt>Dernière sauvegarde</dt><dd>${etat.derniereSauvegarde ? dateFr(etat.derniereSauvegarde.slice(0, 10)) : 'jamais'}</dd><dt>Éléments</dt><dd>${nb}</dd></dl>
      <div style="height:14px"></div>
      <button class="btn btn-plein btn-bloc" id="partager">${ico('share')} Sauvegarder et envoyer</button>
      <small class="aide" style="text-align:center">Toutes les données, sans les photos (fichier léger, facile à envoyer).</small>
      <div style="height:8px"></div>
      <div class="rangee">
        <button class="btn" id="telecharger">${ico('save')} Télécharger</button>
        <button class="btn" id="avec-photos">${ico('camera')} Avec photos</button>
      </div>
      <small class="aide" style="text-align:center">« Avec photos » : fichier plus lourd, à garder sur le téléphone ou un ordinateur.</small>
    </div>
    <div class="etiquette">Restaurer</div>
    <div class="carte">
      <p style="margin:0 0 12px;color:var(--encre-2);font-size:14px">Remplace toutes les données de ce téléphone par celles d’un fichier de sauvegarde.</p>
      <label class="btn btn-bloc">${ico('in')} Choisir un fichier de sauvegarde<input type="file" accept=".json,application/json" hidden id="restaurer"></label>
    </div>
    <div class="etiquette">Zone sensible</div>
    <button class="btn btn-danger btn-bloc" id="effacer">${ico('trash')} Effacer toutes les données</button>`;

  const nomFichier = (photos) => `sauvegarde-chantier-${(etat.params.tpe.nom || 'tpe').replace(/\W+/g, '-').toLowerCase()}-${todayISO()}${photos ? '-photos' : ''}.json`;
  const occupe = (bouton, fn) => async () => {
    bouton.disabled = true;
    try {
      await fn();
    } catch (err) {
      console.error(err);
      toast(err.name === 'RangeError' ? 'Trop de photos pour un seul fichier : fais une sauvegarde sans photos' : `Sauvegarde impossible : ${err.message}`, 'err');
    } finally {
      bouton.disabled = false;
    }
  };
  const telecharger = async (photos) => {
    telechargerFichier(nomFichier(photos), await exporterTout(photos));
    await marquerSauvegarde();
    toast(photos ? 'Sauvegarde complète téléchargée' : 'Sauvegarde téléchargée');
    vueSauvegarde(vue);
  };
  const bTel = $('#telecharger', vue);
  const bPhotos = $('#avec-photos', vue);
  const bPartager = $('#partager', vue);
  bTel.onclick = occupe(bTel, () => telecharger(false));
  bPhotos.onclick = occupe(bPhotos, () => telecharger(true));
  bPartager.onclick = occupe(bPartager, async () => {
    const contenu = await exporterTout(false);
    const fichier = new File([contenu], nomFichier(false), { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
      try {
        await navigator.share({ files: [fichier], title: 'Sauvegarde chantier' });
      } catch (e) {
        if (e.name === 'AbortError') return; // partage annulé : rien n'est sauvegardé
        telechargerFichier(fichier.name, contenu);
      }
    } else telechargerFichier(fichier.name, contenu);
    await marquerSauvegarde();
    toast('Sauvegarde faite');
    vueSauvegarde(vue);
  });
  $('#restaurer', vue).onchange = async (e) => {
    const f = e.target.files[0];
    e.target.value = ''; // permet de rechoisir le même fichier
    if (!f) return;
    if (!(await confirmer('Remplacer toutes les données actuelles par cette sauvegarde ?', 'Restaurer'))) return;
    try {
      await importerTout(await f.text());
      await marquerConfigure();
      toast('Sauvegarde restaurée');
      rafraichir();
    } catch (err) {
      toast(err.message, 'err');
    }
  };
  $('#effacer', vue).onclick = async () => {
    if (!(await confirmer('Effacer TOUTES les données de ce téléphone ? Fais d’abord une sauvegarde.', 'Continuer'))) return;
    if (!(await confirmer('Dernière confirmation : cette action est irréversible.', 'Tout effacer'))) return;
    await toutEffacer();
    toast('Données effacées');
    location.hash = '#/';
    rafraichir();
  };
}

// ---------- Factures ONG ----------

export async function vueFactures(vue) {
  const factures = await db.getKV('factures', []);
  const paie = paiementsParLatrine(etat.txs);
  const facturables = etat.latrines.filter((l) => ['achevee', 'receptionnee', 'payee'].includes(statut(l, paie, etat.params)));
  const dejaFacturees = new Set(factures.flatMap((f) => f.latrineIds));
  const aFacturer = facturables.filter((l) => !dejaFacturees.has(l.id)).map((l) => l.id);

  vue.innerHTML = html`
    <a class="retour" href="#/plus">${ico('back')} Plus</a>
    <div class="titre-vue"><div><span class="sur">Pour ${sigleONG(etat.params)} · lots de latrines achevées</span><h1>Factures</h1></div></div>
    <div class="carte">
      <h3>Nouvelle facture</h3>
      ${raw(facturables.length
        ? html`<form id="form-fac"><div class="champ" style="margin-top:12px"><span class="champ-label">Latrines achevées à facturer</span>
            ${raw(puces('ids', facturables.map((l) => [l.id, `L${l.num}${dejaFacturees.has(l.id) ? ' (déjà)' : ''}`]), aFacturer.slice(0, 3)))}</div>
            <p class="aide">Pièces à joindre : fiches qualité signées, journaux de chantier, photos avant/après.</p>
            <button class="btn btn-plein btn-bloc">${ico('invoice')} Générer la facture</button></form>`
        : '<p style="color:var(--encre-2)">Aucune latrine achevée pour l’instant.</p>')}
    </div>
    <div class="etiquette">Factures émises <span>${factures.length}</span></div>
    ${raw(factures.length
      ? `<div class="liste">${[...factures].reverse().map((f) => html`<button class="ligne" data-fac="${f.num}">
          <span class="icone-rond out">${ico('invoice')}</span>
          <span class="ligne-corps"><span class="ligne-titre">${f.num}</span><span class="ligne-sous">${dateFr(f.date)} · ${f.latrineIds.length} latrine(s) · ${fcfa(f.total)}</span></span>
          ${ico('print', 'chev')}</button>`).join('')}</div>`
      : vide('Aucune facture émise.'))}`;

  const form = $('#form-fac', vue);
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const ids = $$('input[name=ids]:checked', form).map((c) => c.value);
      if (!ids.length) return toast('Choisis au moins une latrine', 'err');
      const n = factures.length + 1;
      const fac = instantaneFacture(
        `FAC-${initiales(etat.params.tpe.nom)}${etat.params.tpe.lot ? `-L${etat.params.tpe.lot}` : ''}-${String(n).padStart(3, '0')}`,
        ids,
      );
      await db.setKV('factures', [...factures, fac]);
      imprimerFacture(fac);
      vueFactures(vue);
    };
  }
  $$('[data-fac]', vue).forEach((b) => (b.onclick = () => imprimerFacture(factures.find((f) => f.num === b.dataset.fac))));
}

// ---------- Rapports ----------

export async function vueRapports(vue) {
  const lundi = lundiDe(todayISO());
  const semaines = [0, 1, 2, 3].map((i) => ajouterJours(lundi, -7 * i));
  vue.innerHTML = html`
    <a class="retour" href="#/plus">${ico('back')} Plus</a>
    <div class="titre-vue"><div><span class="sur">Documents A4 à enregistrer en PDF</span><h1>Rapports</h1></div></div>
    <div class="liste">
      <button class="ligne" id="officielle"><span class="icone-rond in">${ico('invoice')}</span><span class="ligne-corps"><span class="ligne-titre">Situation officielle — pour un mandataire</span><span class="ligne-sous">Prix du contrat et budget de base · sans caisse ni dépenses réelles</span></span>${ico('print', 'chev')}</button>
      <button class="ligne" id="situation"><span class="icone-rond out">${ico('money')}</span><span class="ligne-corps"><span class="ligne-titre">Situation financière complète — interne</span><span class="ligne-sous">Caisse, entrées et sorties réelles · à garder pour toi</span></span>${ico('print', 'chev')}</button>
      <button class="ligne" id="avancement"><span class="icone-rond out">${ico('site')}</span><span class="ligne-corps"><span class="ligne-titre">État d’avancement des latrines</span><span class="ligne-sous">Tableau de bord pour la réunion du vendredi</span></span>${ico('print', 'chev')}</button>
      <button class="ligne" id="csv-latrines"><span class="icone-rond in">${ico('save')}</span><span class="ligne-corps"><span class="ligne-titre">Liste des latrines (Excel)</span><span class="ligne-sous">Fichier CSV avec GPS, statuts, paiements</span></span>${ico('chevron', 'chev')}</button>
    </div>
    <div class="etiquette">Journal de chantier hebdomadaire</div>
    <div class="liste">${raw(semaines.map((s) => html`<button class="ligne" data-sem="${s}"><span class="icone-rond out">${ico('journal')}</span><span class="ligne-corps"><span class="ligne-titre">Semaine du ${dateFr(s)}</span><span class="ligne-sous">${etat.journal.filter((j) => lundiDe(j.date) === s).length} rapport(s)</span></span>${ico('print', 'chev')}</button>`).join(''))}</div>
    <p class="aide">Astuce : dans la fenêtre d’impression, choisis « Enregistrer au format PDF » puis partage le fichier sur WhatsApp.</p>`;
  $('#situation', vue).onclick = imprimerSituation;
  $('#officielle', vue).onclick = imprimerSituationOfficielle;
  $('#avancement', vue).onclick = imprimerAvancement;
  $('#csv-latrines', vue).onclick = exporterLatrinesCSV;
  $$('[data-sem]', vue).forEach((b) => (b.onclick = () => imprimerJournalSemaine(b.dataset.sem)));
}
