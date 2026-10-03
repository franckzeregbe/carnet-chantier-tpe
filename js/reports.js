// Documents imprimables (PDF via l'impression du navigateur) et textes partageables (WhatsApp).
import { etat, urlPhoto } from './store.js';
import { html, raw, esc, fcfa, num, todayISO, dateFr, dateCourte, ajouterJours, toast, telechargerFichier, $ } from './util.js';
import { ico } from './ui.js';
import { ETAPES, CONTROLES, TYPES_LATRINE, CATEGORIES, sigleONG, nomONG, typeCourt, partAvance } from './data.js';
import {
  STATUTS, statut, pointsConformes, situationOfficielle, paiementsParLatrine, compterStatuts, etapesFaites, dateAchevement, finances, budgetLatrine, stock, cadence,
} from './calc.js';

const nomL = (id) => {
  const l = etat.latrines.find((x) => x.id === id);
  return l ? `L${l.num}${l.menage ? ` (${l.menage})` : ''}` : '?';
};
const nomEtape = (id) => ETAPES.find((e) => e.id === id)?.nom || id;

// ---------- Impression ----------

function entete(titre, ref = '') {
  const p = etat.params;
  const lieu = [p.tpe.lot && `Lot ${p.tpe.lot}`, p.tpe.village, p.tpe.sousPrefecture && `S/P de ${p.tpe.sousPrefecture}`].filter(Boolean).join(' · ');
  return html`<div class="doc-tete">
    <div class="g">${raw(p.tpe.logo ? `<img src="${esc(p.tpe.logo)}" alt="">` : '')}
      <div><h1>${titre}</h1><small>${p.tpe.nom}${lieu ? ` · ${lieu}` : ''}<br>${[p.contrat.projet, nomONG(p)].filter(Boolean).join(' — ')}</small></div></div>
    <div class="ref">${raw(ref)}<br>Édité le ${dateFr(todayISO())}</div></div>`;
}

const pied = () => {
  const p = etat.params;
  return html`<div class="pied">${p.tpe.nom} — Gérant(e) : ${p.tpe.gerant}${p.tpe.tel ? ` · ${p.tpe.tel}` : ''}${p.contrat.ref ? ` · Contrat ${p.contrat.ref}` : ''} · ${nomONG(p)}</div>`;
};

/** Nom de fichier propre : « Rapport-du-jour_2026-10-03_TPE-Exemple ». Chrome l'utilise pour le PDF. */
function nomFichierPDF(nom) {
  const tpe = (etat.params.tpe.nom || 'TPE').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
  return `${nom}_${tpe}`;
}

/**
 * Ouvre l'aperçu du document, avec le bouton « Enregistrer en PDF ».
 * La mise en page utilise un tableau : l'espace du haut et le pied de page se répètent sur chaque page A4,
 * sans l'adresse ni la date que le navigateur ajoute habituellement.
 */
async function imprimer(contenu, nom = 'Document', { compact = false } = {}) {
  const zone = $('#impression');
  zone.innerHTML = `
    <div class="apercu-barre">
      <button class="btn btn-petit" data-fermer-apercu>${ico('back').v} Fermer</button>
      <button class="btn btn-petit btn-plein" data-pdf>${ico('print').v} Enregistrer en PDF</button>
    </div>
    <p class="apercu-aide">Aperçu de la page A4 · zoom à deux doigts.<br>Ensuite : <strong>Enregistrer au format PDF</strong>, puis partage sur WhatsApp.</p>
    <div class="doc${compact ? ' compact' : ''}"><table class="doc-cadre">
      <thead><tr><td><div class="doc-espace"></div></td></tr></thead>
      <tbody><tr><td>${contenu}</td></tr></tbody>
      <tfoot><tr><td>${pied()}</td></tr></tfoot>
    </table></div>`;
  await Promise.all([...zone.querySelectorAll('img')].map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; }))));
  // Aperçu fidèle : la page A4 (794 px) est réduite pour tenir dans l'écran ; on peut zoomer avec deux doigts.
  const page = zone.querySelector('.doc');
  page.style.zoom = String(Math.min(1, (window.innerWidth - 16) / 794));
  zone.classList.add('ouvert');
  zone.scrollTop = 0;
  const titreApp = document.title;
  const fermer = () => {
    zone.classList.remove('ouvert');
    zone.innerHTML = '';
    document.title = titreApp;
  };
  zone.querySelector('[data-fermer-apercu]').onclick = fermer;
  zone.querySelector('[data-pdf]').onclick = () => {
    document.title = nomFichierPDF(nom);
    window.addEventListener('afterprint', () => (document.title = titreApp), { once: true });
    window.print();
  };
}

async function photosHtml(ids = [], max = 6) {
  const urls = (await Promise.all(ids.slice(0, max).map(urlPhoto))).filter(Boolean);
  return urls.length ? `<div class="photos-doc">${urls.map((u) => `<img src="${u}" alt="">`).join('')}</div>` : '';
}

// ---------- Rapport du jour ----------

const ESPACE = Symbol('ligne vide');

export function texteRapport(j) {
  const p = etat.params;
  const presents = etat.workers.filter((w) => (j.presents || []).includes(w.id));
  const depenses = etat.txs.filter((t) => t.date === j.date && t.sens === 'out');
  const totalDep = depenses.reduce((s, t) => s + (Number(t.montant) || 0), 0);
  const paie = paiementsParLatrine(etat.txs);
  const c = compterStatuts(etat.latrines, paie, p);
  const faites = c.achevee + c.receptionnee + c.payee;
  const etapes = Object.entries(j.etapesFaites || {}).filter(([, l]) => l.length)
    .map(([id, l]) => `  • ${nomL(id)} : ${l.map(nomEtape).join(', ')}`);

  const lignes = [
    `*RAPPORT DE CHANTIER — ${dateFr(j.date, true).toUpperCase()}*`,
    `${p.tpe.nom} · Lot ${p.tpe.lot} · ${p.tpe.village}`,
    [p.contrat.projet, sigleONG(p)].filter(Boolean).join(' · ') || 'Construction de latrines familiales',
    ESPACE,
    `☀️ Météo : ${j.meteo || '—'}`,
    `📍 Sites : ${(j.latrineIds || []).map(nomL).join(', ') || '—'}`,
    j.travaux ? `🔨 Travaux : ${j.travaux}` : '',
    etapes.length ? `✅ Étapes terminées :\n${etapes.join('\n')}` : '',
    `👷 Équipe (${presents.length}) : ${presents.map((w) => `${w.nom} (${w.role})`).join(', ') || '—'}`,
    j.materiaux ? `🧱 Matériaux : ${j.materiaux}` : '',
    totalDep ? `💰 Dépenses : ${fcfa(totalDep)} (${depenses.map((t) => `${t.libelle || t.cat} ${fcfa(t.montant)}`).join(' ; ')})` : '',
    j.difficultes ? `⚠️ Difficultés : ${j.difficultes}` : '',
    `🚨 Incident : ${j.incident === 'Aucun' || !j.incident ? 'Aucun' : `${j.incident} (${j.gravite}) — ${j.incidentDetail || ''}`}`,
    `🦺 EPI : ${j.epi ? 'portés' : 'NON portés'}`,
    ESPACE,
    `📊 Avancement : ${faites}/${p.contrat.totalLatrines} latrines achevées`,
    `— ${p.tpe.gerant}`,
  ];
  return lignes.filter((l) => l !== '').map((l) => (l === ESPACE ? '' : l)).join('\n');
}

export async function partagerTexte(texte, photoIds = []) {
  // Avec les photos si l'appareil le permet (partage natif Android).
  try {
    if (navigator.share) {
      const fichiers = [];
      for (const id of (photoIds || []).slice(0, 4)) {
        const url = await urlPhoto(id);
        if (!url) continue;
        const blob = await (await fetch(url)).blob();
        fichiers.push(new File([blob], `photo-${id}.jpg`, { type: 'image/jpeg' }));
      }
      const data = { text: texte };
      if (fichiers.length && navigator.canShare && navigator.canShare({ files: fichiers, text: texte })) data.files = fichiers;
      await navigator.share(data);
      return;
    }
  } catch (e) {
    if (e.name === 'AbortError') return;
    console.warn('Partage natif impossible', e);
  }
  try {
    await navigator.clipboard.writeText(texte);
    toast('Texte copié — colle-le dans WhatsApp');
  } catch {
    window.open(`https://wa.me/?text=${encodeURIComponent(texte)}`, '_blank');
  }
}

function blocJour(j) {
  const presents = etat.workers.filter((w) => (j.presents || []).includes(w.id));
  const etapes = Object.entries(j.etapesFaites || {}).filter(([, l]) => l.length)
    .map(([id, l]) => `${nomL(id)} : ${l.map(nomEtape).join(', ')}`).join(' ; ');
  return html`<table>
    <tr><th style="width:24%">${dateFr(j.date, true)}</th><td>Sites / latrines : <strong>${(j.latrineIds || []).map(nomL).join(', ') || '—'}</strong> · Météo : ${j.meteo || '—'}</td></tr>
    <tr><th>Travaux réalisés</th><td>${j.travaux || ''}${etapes ? raw(`<br><em>Étapes terminées : ${esc(etapes)}</em>`) : ''}</td></tr>
    <tr><th>Matériaux utilisés</th><td>${j.materiaux || ''}</td></tr>
    <tr><th>Effectif présent</th><td>${presents.map((w) => `${w.nom} (${w.role})`).join(', ')}</td></tr>
    <tr><th>Difficultés</th><td>${j.difficultes || ''}</td></tr>
    <tr><th>Incident / plainte / EPI</th><td>${j.incident === 'Aucun' || !j.incident ? 'Aucun' : `${j.incident} (${j.gravite}) — ${j.incidentDetail || ''}`} · EPI : ${j.epi ? 'portés' : 'non portés'}</td></tr>
  </table>`;
}

export async function imprimerRapport(j) {
  const depenses = etat.txs.filter((t) => t.date === j.date && t.sens === 'out');
  await imprimer(`${entete('Rapport journalier de chantier', dateFr(j.date, true))}
    ${blocJour(j)}
    ${depenses.length ? `<h2>Dépenses du jour</h2><table><tr><th>Libellé</th><th>Moyen</th><th class="d">Montant</th></tr>
      ${depenses.map((t) => html`<tr><td>${t.libelle || t.cat}</td><td>${t.mode || ''}</td><td class="d">${fcfa(t.montant)}</td></tr>`).join('')}
      <tr class="total"><td colspan="2">Total</td><td class="d">${fcfa(depenses.reduce((s, t) => s + (Number(t.montant) || 0), 0))}</td></tr></table>` : ''}
    ${(j.photos || []).length ? `<h2>Photos</h2>${await photosHtml(j.photos)}` : ''}
    <div class="signatures deux-col"><div>Gérant(e) TPE : ${esc(etat.params.tpe.gerant)}</div><div>Visa du contrôleur ${esc(sigleONG(etat.params))}</div></div>`, `Rapport-du-jour_${j.date}`);
}

export async function imprimerJournalSemaine(lundi) {
  const fin = ajouterJours(lundi, 6);
  const jours = etat.journal.filter((j) => j.date >= lundi && j.date <= fin).sort((a, b) => a.date.localeCompare(b.date));
  const achevees = etat.latrines.filter((l) => { const d = dateAchevement(l); return d && d >= lundi && d <= fin; });
  const objectif = Number(etat.params.contrat.objectifSemaine) || 3;
  const c = cadence(etat.latrines, etat.params, fin);
  await imprimer(`${entete('Journal de chantier hebdomadaire', `${c.semaines ? `Semaine ${c.semaines} · ` : ''}du ${dateCourte(lundi)} au ${dateCourte(fin)}`)}
    <table>
      <tr><th>Objectif semaine</th><td>${objectif} latrines conformes minimum</td><th>Latrines achevées</th><td><strong>${achevees.length} / ${objectif}</strong> ${achevees.length >= objectif ? '☑ Objectif atteint' : '☐ Retard (justification ci-dessous)'}</td></tr>
      <tr><th>Latrines achevées</th><td colspan="3">${esc(achevees.map((l) => nomL(l.id)).join(', ') || '—')}</td></tr>
    </table>
    <h2>Suivi journalier</h2>
    ${jours.length ? jours.map(blocJour).join('<div style="height:6px"></div>') : '<p>Aucun rapport saisi cette semaine.</p>'}
    <div class="signatures deux-col"><div>Gérant(e) TPE : ${esc(etat.params.tpe.gerant)}<br>Date et signature</div><div>Validé par le contrôleur ${esc(sigleONG(etat.params))}<br>Date, signature et cachet</div></div>`, `Journal-semaine_${lundi}`);
}

// ---------- Fiche qualité ----------

export async function imprimerFicheQualite(l) {
  const qc = l.qc || {};
  const etapes = Object.entries(CONTROLES).map(([k, c]) => {
    const r = qc[k] || {};
    const ok = new Set(pointsConformes(c, r));
    return `<h2>${esc(c.titre)}</h2>
      <p>Date : ${r.date ? dateFr(r.date) : '____ / ____ / ______'} · Contrôleur ${esc(sigleONG(etat.params))} : ${esc(r.controleur || '________________')}</p>
      <table><tr><th>Point de contrôle</th><th style="width:28%">Résultat</th></tr>
      ${c.points.map((pt) => `<tr><td>${esc(pt.nom)}</td><td>${ok.has(pt.id) ? '☑ Conforme' : r.date ? '☒ Non conforme' : '☐ Conforme ☐ Non conforme'}</td></tr>`).join('')}</table>
      <p>Observations : ${esc(r.observations || '')}</p>`;
  }).join('');
  await imprimer(`${entete('Fiche de contrôle qualité — latrine familiale', `Latrine n° ${esc(l.num)}`)}
    <table>
      <tr><th>Chef de ménage</th><td>${esc(l.menage || '')}</td><th>Village</th><td>${esc(l.village || '')}</td></tr>
      <tr><th>Type</th><td>${esc(TYPES_LATRINE[l.type] || '')}</td><th>Interface</th><td>${esc(l.interface || '')}</td></tr>
      <tr><th>GPS</th><td>${l.lat ? `${esc(l.lat)}, ${esc(l.lng)}` : ''}</td><th>Achèvement</th><td>${dateFr(dateAchevement(l))}</td></tr>
    </table>
    ${etapes}
    <div class="signatures"><div>Contrôleur ${esc(sigleONG(etat.params))}</div><div>Représentant TPE</div><div>Chef de ménage</div></div>`, `Fiche-qualite_L${l.num}`);
}

// ---------- Facture ----------

/** Copie figée d'une facture au moment de sa création : une réimpression donne toujours les mêmes chiffres. */
export function instantaneFacture(num, ids) {
  const p = etat.params;
  const prix = Number(p.contrat.prixLatrine) || 0;
  const paie = paiementsParLatrine(etat.txs);
  const lignes = ids.map((id) => etat.latrines.find((l) => l.id === id)).filter(Boolean).map((l) => ({
    id: l.id, num: l.num, menage: l.menage || '', village: l.village || '', type: typeCourt(l.type), fin: dateAchevement(l) || '',
  }));
  return {
    num,
    date: todayISO(),
    latrineIds: lignes.map((l) => l.id),
    lignes,
    prix,
    pctAvance: Math.round(partAvance(p) * 100),
    avance: Math.round(lignes.reduce((s, l) => s + (paie[l.id]?.avance || 0), 0)),
    total: lignes.length * prix,
  };
}

export async function imprimerFacture(fac) {
  const p = etat.params;
  const { lignes, prix, total, avance } = fac;
  const pct = fac.pctAvance / 100;
  await imprimer(`${entete('Facture de travaux — TPE partenaire', `N° ${esc(fac.num)}<br>du ${dateFr(fac.date)}`)}
    <table>
      <tr><th colspan="2">Émetteur</th><th colspan="2">Destinataire</th></tr>
      <tr><td>Dénomination</td><td><strong>${esc(p.tpe.nom)}</strong></td><td>Organisation</td><td>${esc(nomONG(p))}</td></tr>
      <tr><td>Gérant(e)</td><td>${esc(p.tpe.gerant)}</td><td>Projet</td><td>${esc([p.contrat.projet, p.tpe.sousPrefecture].filter(Boolean).join(' — '))}</td></tr>
      <tr><td>Mobile Money</td><td>${esc(p.tpe.reseauMomo)} ${esc(p.tpe.momo)}</td><td>Contrat</td><td>${esc(p.contrat.ref)}</td></tr>
      <tr><td>N° lot</td><td>${esc(p.tpe.lot)}</td><td></td><td></td></tr>
    </table>
    <h2>Détail des prestations</h2>
    <table class="lignes"><thead><tr><th>N°</th><th>Latrine (ménage)</th><th>Village</th><th>Type</th><th>Achevée le</th><th class="d">Montant (F CFA)</th></tr></thead><tbody>
      ${lignes.map((l, i) => html`<tr><td>${i + 1}</td><td>L${l.num} — ${l.menage || ''}</td><td>${l.village || ''}</td><td>${l.type}</td><td>${dateFr(l.fin)}</td><td class="d">${num(prix)}</td></tr>`).join('')}
      <tr class="total"><td colspan="5">TOTAL FACTURE (${lignes.length} × ${num(prix)} F)</td><td class="d">${num(total)}</td></tr>
      <tr><td colspan="5">Avance déjà perçue (${Math.round(pct * 100)} %)</td><td class="d">${num(avance)}</td></tr>
      <tr class="total"><td colspan="5">SOLDE À PAYER</td><td class="d">${num(total - avance)}</td></tr>
    </tbody></table>
    <p>Paiement exclusivement par Mobile Money (Wave / MTN / Moov / Orange) — aucun paiement en espèces.</p>
    <h2>Pièces jointes</h2>
    <p>☐ ${lignes.length} fiche(s) qualité signée(s) (contrôleur ${esc(sigleONG(p))} + représentant TPE + chef de ménage)<br>☐ Copies des journaux de chantier des sites concernés<br>☐ Photos des latrines achevées (avant + après)</p>
    <div class="signatures deux-col"><div>Émis par la TPE<br>${esc(p.tpe.gerant)}<br>Date et signature</div><div>Validé pour ${esc(nomONG(p))}<br>Date, signature et cachet</div></div>`, fac.num);
}

// ---------- Situation financière ----------

export async function imprimerSituation() {
  const { txs, commandes, latrines, params, budget, kit, mouvements } = etat;
  const f = finances(txs, commandes, latrines, params);
  const b = budgetLatrine(params, budget);
  const st = stock(kit, commandes, latrines, mouvements);
  const cats = [...CATEGORIES.in.map((c) => ({ ...c, sens: 'Entrée' })), ...CATEGORIES.out.map((c) => ({ ...c, sens: 'Sortie' }))];
  const paie = paiementsParLatrine(txs);
  const c = compterStatuts(latrines, paie, params);
  await imprimer(`${entete('Situation financière du chantier', `Au ${dateFr(todayISO())}`)}
    <h2>Synthèse</h2>
    <table>
      <tr><th>Total entrées</th><td class="d">${fcfa(f.entrees)}</td><th>Reçu de l’ONG</th><td class="d">${fcfa(f.recuONG)}</td></tr>
      <tr><th>Total sorties</th><td class="d">${fcfa(f.sorties)}</td><th>Encore attendu de l’ONG</th><td class="d">${fcfa(f.attenduONG)}</td></tr>
      <tr class="total"><td>Caisse</td><td class="d">${fcfa(f.caisse)}</td><td>Dû à la quincaillerie</td><td class="d">${fcfa(f.detteQuincaillerie)}</td></tr>
    </table>
    <h2>Par catégorie</h2>
    <table class="lignes"><thead><tr><th>Sens</th><th>Catégorie</th><th class="d">Montant</th></tr></thead><tbody>
      ${cats.filter((x) => f.parCat[x.id]).map((x) => html`<tr><td>${x.sens}</td><td>${x.nom}</td><td class="d">${fcfa(f.parCat[x.id])}</td></tr>`).join('')}</tbody></table>
    <h2>Production et kits</h2>
    <table>
      <tr><th>Latrines prévues</th><td>${params.contrat.totalLatrines}</td><th>En cours</th><td>${c.encours}</td></tr>
      <tr><th>Achevées</th><td>${c.achevee}</td><th>Réceptionnées / payées</th><td>${c.receptionnee} / ${c.payee}</td></tr>
      <tr><th>Kits commandés / livrés</th><td>${st.kitsCommandes} / ${st.kitsLivres}</td><th>Kits affectés / en stock</th><td>${st.kitsAffectes} / ${st.kitsDispo}</td></tr>
    </table>
    <h2>Rentabilité prévue par latrine</h2>
    <table><tr><td>Prix payé par l’ONG</td><td class="d">${fcfa(b.prix)}</td></tr><tr><td>Kit quincaillerie</td><td class="d">${fcfa(b.kit)}</td></tr>
      <tr><td>Achats locaux</td><td class="d">${fcfa(b.achats)}</td></tr><tr><td>Main-d’œuvre</td><td class="d">${fcfa(b.mo)}</td></tr><tr class="total"><td>Marge prévue</td><td class="d">${fcfa(b.marge)}</td></tr></table>`, `Situation-financiere_${todayISO()}`);
}

/**
 * Version « mandataire » : montants officiels seulement (prix du contrat et budget de base).
 * Jamais de caisse, de dépenses réelles ni de prix terrain (Marge 2).
 */
export async function imprimerSituationOfficielle() {
  const { txs, latrines, params, budget } = etat;
  const s = situationOfficielle(latrines, txs, params, budget);
  const c = s.statuts;
  const libCat = { materiaux: 'Achat', transport: 'Transport', mo: 'Main-d’œuvre', divers: 'Divers' };
  await imprimer(`${entete('Situation financière officielle', `Au ${dateFr(todayISO())}`)}
    <h2>Production et paiements de l’ONG</h2>
    <table>
      <tr><th>Latrines prévues</th><td class="d">${params.contrat.totalLatrines}</td><th>Démarrées</th><td class="d">${s.demarrees}</td></tr>
      <tr><th>Achevées</th><td class="d">${s.achevees}</td><th>Dont réceptionnées / payées</th><td class="d">${c.receptionnee + c.payee} / ${c.payee}</td></tr>
      <tr><th>Avances reçues</th><td class="d">${fcfa(s.avancesRecues)}</td><th>Soldes reçus</th><td class="d">${fcfa(s.soldesRecus)}</td></tr>
      <tr class="total"><td>Total reçu</td><td class="d">${fcfa(s.recu)}</td><td>Reste à recevoir</td><td class="d">${fcfa(s.attendu)}</td></tr>
    </table>
    <h2>Budget officiel d’une latrine</h2>
    <table class="lignes"><thead><tr><th>Poste</th><th>Nature</th><th class="d">Montant</th></tr></thead><tbody>
      <tr><td>Kit de quincaillerie</td><td>Achat</td><td class="d">${fcfa(s.kit)}</td></tr>
      ${budget.map((x) => html`<tr><td>${x.nom}</td><td>${libCat[x.cat] || 'Divers'}</td><td class="d">${fcfa(x.montant)}</td></tr>`).join('')}
      <tr class="total"><td colspan="2">Coût officiel d’une latrine</td><td class="d">${fcfa(s.cout)}</td></tr>
      <tr><td colspan="2">Prix payé par l’ONG</td><td class="d">${fcfa(s.prix)}</td></tr>
      <tr class="total"><td colspan="2">Marge officielle par latrine</td><td class="d">${fcfa(s.marge)}</td></tr>
    </tbody></table>
    <div class="bloc-fin">
      <h2>Bilan des latrines achevées (${s.achevees})</h2>
      <table>
        <tr><th>Valeur des travaux (${s.achevees} × ${fcfa(s.prix)})</th><th class="d">Coût officiel</th><th class="d">Marge officielle</th></tr>
        <tr class="total"><td class="d">${fcfa(s.valeurAchevee)}</td><td class="d">${fcfa(s.coutAchevee)}</td><td class="d">${fcfa(s.margeAchevee)}</td></tr>
      </table>
      <p style="font-size:9pt;color:#5E6D79">Montants calculés sur les prix de base du budget et du contrat.</p>
      <div class="signatures deux-col"><div>Gérant(e) de la TPE<br>${esc(params.tpe.gerant)}<br>Date et signature</div><div>Visa du destinataire</div></div>
    </div>`,
  `Situation-officielle_${todayISO()}`, { compact: true });
}

// ---------- Avancement ----------

export async function imprimerAvancement() {
  const { latrines, params, txs } = etat;
  const paie = paiementsParLatrine(txs);
  const c = compterStatuts(latrines, paie, params);
  const cad = cadence(latrines, params, todayISO());
  await imprimer(`${entete('Tableau de bord — avancement des latrines', cad.semaines ? `Semaine ${cad.semaines}` : '')}
    <table><tr><th>Prévues</th><th>À démarrer</th><th>En cours</th><th>Achevées</th><th>Réceptionnées</th><th>Payées</th><th>Retard cadence</th></tr>
      <tr><td>${params.contrat.totalLatrines}</td><td>${c.planifiee}</td><td>${c.encours}</td><td>${c.achevee}</td><td>${c.receptionnee}</td><td>${c.payee}</td><td>${cad.retard}</td></tr></table>
    <h2>Détail par latrine</h2>
    <table class="lignes"><thead><tr><th>N°</th><th>Chef de ménage</th><th>Village</th><th>Type</th><th>Étapes</th><th>Dernière étape</th><th>Kit</th><th>Statut</th><th class="d">Reçu ONG</th></tr></thead><tbody>
      ${latrines.map((l) => {
        const derniere = ETAPES.filter((e) => l.etapes?.[e.id]).at(-1);
        const p = paie[l.id] || { avance: 0, solde: 0 };
        return html`<tr><td>${l.num}</td><td>${l.menage || ''}</td><td>${l.village || ''}</td><td>${typeCourt(l.type)}</td><td>${etapesFaites(l)}/${ETAPES.length}</td><td>${derniere ? `${derniere.court} ${dateCourte(l.etapes[derniere.id])}` : '—'}</td><td>${l.kitAffecte ? '✓' : ''}</td><td>${STATUTS[statut(l, paie, params)].nom}</td><td class="d">${num(p.avance + p.solde)}</td></tr>`;
      }).join('')}</tbody></table>`, `Avancement-latrines_${todayISO()}`);
}

export function exporterLatrinesCSV() {
  const paie = paiementsParLatrine(etat.txs);
  const lignes = [['N°', 'Chef de ménage', 'Village', 'Quartier', 'Téléphone', 'Type', 'Interface', 'Latitude', 'Longitude', 'Statut', 'Étapes faites', 'Achevée le', 'Kit affecté', 'PV signé', 'Date réception', 'Avance reçue', 'Solde reçu']];
  for (const l of etat.latrines) {
    const p = paie[l.id] || { avance: 0, solde: 0 };
    lignes.push([l.num, l.menage, l.village, l.quartier, l.telMenage, typeCourt(l.type), l.interface, l.lat, l.lng,
      STATUTS[statut(l, paie, etat.params)].nom, etapesFaites(l), dateAchevement(l) || '', l.kitAffecte || '',
      l.pvSigne ? 'Oui' : 'Non', l.dateReception || '', Math.round(p.avance), Math.round(p.solde)]);
  }
  const csv = lignes.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  telechargerFichier(`latrines-${todayISO()}.csv`, `﻿${csv}`, 'text/csv;charset=utf-8');
  toast('Liste des latrines téléchargée');
}
