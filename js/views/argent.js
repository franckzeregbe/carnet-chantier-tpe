// Argent : entrées (ONG, apports) et sorties (achats, main-d'œuvre…), budget prévu vs réel.
import { etat, enregistrer, supprimer } from '../store.js';
import { html, raw, esc, fcfa, todayISO, dateFr, toast, $, $$, telechargerFichier } from '../util.js';
import { ico, champ, input, select, textarea, segment, puces, feuille, zonePhotos, brancherPhotos, idsPhotos, vide } from '../ui.js';
import { CATEGORIES, MODES_PAIEMENT, sigleONG, partAvance } from '../data.js';
import { finances, paiementsParLatrine, statut, montantONG } from '../calc.js';
import { rafraichir, remplacerRoute } from '../app.js';

let filtreSens = 'tous';
let filtreMois = '';

const nomCat = (id) => [...CATEGORIES.in, ...CATEGORIES.out].find((c) => c.id === id)?.nom || id;

export async function vueArgent(vue, action) {
  const { txs, commandes, latrines, params, budget } = etat;
  const f = finances(txs, commandes, latrines, params);
  const mois = [...new Set(txs.map((t) => t.date.slice(0, 7)))].sort().reverse();
  const visibles = txs
    .filter((t) => filtreSens === 'tous' || t.sens === filtreSens)
    .filter((t) => !filtreMois || t.date.startsWith(filtreMois));

  // Prévu = budget unitaire × latrines démarrées.
  const paie = paiementsParLatrine(txs);
  const demarrees = latrines.filter((l) => statut(l, paie, params) !== 'planifiee').length;
  const prevuCat = (cat) => budget.filter((b) => b.cat === cat).reduce((s, b) => s + (Number(b.montant) || 0), 0) * demarrees;
  const lignesBudget = [
    ['Kits quincaillerie', (Number(params.quincaillerie.prixKit) || 0) * demarrees, f.commandeQuincaillerie],
    ['Matériaux locaux', prevuCat('materiaux'), f.parCat.materiaux || 0],
    ['Main-d’œuvre', prevuCat('mo'), f.parCat.mo || 0],
    ['Transport', prevuCat('transport'), f.parCat.transport || 0],
    ['Divers, EPI, imprévus', prevuCat('divers'), (f.parCat.divers || 0) + (f.parCat.epi || 0)],
  ];

  let jourCourant = '';
  const lignes = visibles.map((t) => {
    const entete = t.date !== jourCourant ? `<div class="jour-groupe">${dateFr(t.date, true)}</div>` : '';
    jourCourant = t.date;
    return entete + html`<button class="ligne" data-tx="${t.id}">
      <span class="icone-rond ${t.sens}">${ico(t.sens === 'in' ? 'in' : 'out')}</span>
      <span class="ligne-corps"><span class="ligne-titre">${t.libelle || nomCat(t.cat)}</span>
      <span class="ligne-sous">${nomCat(t.cat)}${t.mode ? ` · ${t.mode}` : ''}</span></span>
      <span class="num ${t.sens === 'in' ? 'montant-in' : 'montant-out'}">${t.sens === 'in' ? '+' : '−'} ${fcfa(t.montant)}</span></button>`;
  }).join('');

  vue.innerHTML = html`
    <div class="titre-vue">
      <div><span class="sur">Trésorerie du chantier</span><h1>Argent</h1></div>
      <button class="btn-ajout" id="ajout" aria-label="Nouvelle opération">${ico('plus')}</button>
    </div>
    <div class="hero">
      <div class="sur">Caisse disponible</div>
      <div class="hero-chiffre" style="font-size:36px">${fcfa(f.caisse)}</div>
      <div class="legende" style="margin-top:12px">
        <span>Entrées <b class="num">${fcfa(f.entrees)}</b></span>
        <span>Sorties <b class="num">${fcfa(f.sorties)}</b></span>
      </div>
    </div>
    <div class="rangee">
      <button class="btn" data-nouveau="in">${ico('in')} Entrée</button>
      <button class="btn btn-plein" data-nouveau="out">${ico('out')} Dépense</button>
    </div>
    <div class="kpis">
      <div class="kpi"><small>Reçu ${sigleONG(params)}</small><span class="num">${fcfa(f.recuONG)}</span></div>
      <div class="kpi"><small>Attendu ${sigleONG(params)}</small><span class="num">${fcfa(f.attenduONG)}</span></div>
      <a class="kpi ${f.detteQuincaillerie ? 'neg' : ''}" href="#/stock"><small>Dû quincaillerie</small><span class="num">${fcfa(f.detteQuincaillerie)}</span></a>
      <a class="kpi" href="#/equipe"><small>Main-d’œuvre payée</small><span class="num">${fcfa(f.parCat.mo || 0)}</span></a>
    </div>

    <div class="etiquette">Budget prévu vs réel <span>${demarrees} latrine(s) démarrée(s)</span></div>
    <div class="carte plate" style="padding:8px 12px">
      <table class="tableau">
        <thead><tr><th>Poste</th><th class="d">Prévu</th><th class="d">Réel</th><th class="d">Écart</th></tr></thead>
        <tbody>${raw(lignesBudget.map(([n, p, r]) => html`<tr><td>${n}</td><td class="d">${fcfa(p)}</td><td class="d">${fcfa(r)}</td><td class="d ${p - r >= 0 ? 'ecart-pos' : 'ecart-neg'}">${fcfa(p - r)}</td></tr>`).join(''))}
        <tr class="total"><td>Total</td><td class="d">${fcfa(lignesBudget.reduce((s, x) => s + x[1], 0))}</td><td class="d">${fcfa(lignesBudget.reduce((s, x) => s + x[2], 0))}</td><td class="d"></td></tr></tbody>
      </table>
    </div>

    <div class="etiquette">Opérations <a href="#" id="csv">${ico('save')} Export Excel</a></div>
    <div class="filtres">
      ${raw([['tous', 'Tout'], ['in', 'Entrées'], ['out', 'Sorties']].map(([k, t]) => `<button class="filtre ${filtreSens === k ? 'actif' : ''}" data-sens="${k}">${t}</button>`).join(''))}
      ${raw(mois.map((m) => `<button class="filtre ${filtreMois === m ? 'actif' : ''}" data-mois="${esc(m)}">${esc(new Date(`${m}-15`).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }))}</button>`).join(''))}
    </div>
    ${raw(visibles.length ? `<div class="liste">${lignes}</div>` : vide('Aucune opération enregistrée.'))}`;

  $('#ajout', vue).onclick = () => formTransaction({ sens: 'out' });
  $$('[data-nouveau]', vue).forEach((b) => (b.onclick = () => formTransaction({ sens: b.dataset.nouveau })));
  $$('[data-sens]', vue).forEach((b) => (b.onclick = () => { filtreSens = b.dataset.sens; vueArgent(vue); }));
  $$('[data-mois]', vue).forEach((b) => (b.onclick = () => { filtreMois = filtreMois === b.dataset.mois ? '' : b.dataset.mois; vueArgent(vue); }));
  $$('[data-tx]', vue).forEach((b) => (b.onclick = () => {
    const t = txs.find((x) => x.id === b.dataset.tx);
    if (t) formTransaction(t, t);
  }));
  $('#csv', vue).onclick = (e) => { e.preventDefault(); exporterCSV(); };

  if (action) {
    remplacerRoute('#/argent');
    formTransaction({ sens: action === 'entree' ? 'in' : 'out' });
  }
}

function optionsCat(sens) {
  return CATEGORIES[sens].map((c) => [c.id, c.nom]);
}

/** Formulaire d'opération. `preset` pré-remplit ; `existante` = opération à modifier. */
export function formTransaction(preset = {}, existante = null) {
  const x = { date: todayISO(), sens: 'out', mode: 'Espèces', latrineIds: [], ...preset };
  if (!x.cat) x.cat = CATEGORIES[x.sens][0].id;
  const latrines = etat.latrines.map((l) => [l.id, `L${l.num}`]);
  feuille({
    titre: existante ? 'Modifier l’opération' : x.sens === 'in' ? 'Nouvelle entrée d’argent' : 'Nouvelle dépense',
    corps: html`
      ${raw(champ('Type', segment('sens', [['out', 'Dépense / sortie'], ['in', 'Entrée d’argent']], x.sens)))}
      ${raw(champ('Montant (F CFA)', input('montant', x.montant || '', { type: 'money', required: true, placeholder: '0' })))}
      ${raw(champ('Catégorie', select('cat', optionsCat(x.sens), x.cat)))}
      ${raw(champ('Libellé', input('libelle', x.libelle, { placeholder: 'Ex. : 2 tricycles de sable, avance OS S3…' })))}
      <div class="deux">
        ${raw(champ('Date', input('date', x.date, { type: 'date', required: true })))}
        ${raw(champ('Moyen', select('mode', MODES_PAIEMENT, x.mode)))}
      </div>
      ${raw(champ('Référence / n° transaction', input('ref', x.ref, { placeholder: 'ID Mobile Money, n° facture…' })))}
      <div id="zone-ouvrier">${raw(champ('Ouvrier payé', select('workerId', etat.workers.map((w) => [w.id, `${w.nom} — ${w.role}`]), x.workerId, { vide: '— Aucun —' })))}</div>
      ${raw(champ('Fournisseur / bénéficiaire', input('tiers', x.tiers)))}
      ${raw(latrines.length ? `<div class="champ"><span class="champ-label">Latrines concernées</span>${puces('latrineIds', latrines, x.latrineIds)}<small class="aide">Obligatoire pour les avances et soldes de l’ONG (le montant est réparti entre elles).</small></div>` : '')}
      <p class="note" id="calcul-ong" hidden></p>
      ${raw(champ('Note', textarea('note', x.note, '', 2)))}
      <div class="champ"><span class="champ-label">Photo du reçu / facture</span>${raw(zonePhotos('photos', x.photos || []))}</div>`,
    supprimer: existante ? async () => { await supprimer('tx', existante.id); toast('Opération supprimée'); rafraichir(); } : null,
    onOuvert: (form) => {
      brancherPhotos(form);
      const zoneOuvrier = $('#zone-ouvrier', form);
      const champMontant = form.elements.montant;
      const noteONG = $('#calcul-ong', form);
      // Le montant de l'ONG se calcule tout seul tant que l'utilisateur ne l'a pas tapé lui-même.
      let montantManuel = Boolean(existante);
      champMontant.addEventListener('input', () => { montantManuel = true; });
      const majONG = () => {
        const cat = form.elements.cat.value;
        const n = $$('input[name=latrineIds]:checked', form).length;
        const estONG = cat === 'avance' || cat === 'solde';
        noteONG.hidden = !estONG;
        if (!estONG) return;
        const montant = montantONG(cat, n, etat.params);
        const parLatrine = montantONG(cat, 1, etat.params);
        const lotOS = Number(etat.params.contrat.objectifSemaine) || 3;
        noteONG.innerHTML = n
          ? `${n} latrine(s) × ${fcfa(parLatrine)} = <strong>${fcfa(montant)}</strong> (${cat === 'avance' ? 'avance' : 'solde'} de ${Math.round((cat === 'avance' ? partAvance(etat.params) : 1 - partAvance(etat.params)) * 100)} %)`
          : `Coche les latrines de l’ordre de service : ${lotOS} latrines = <strong>${fcfa(montantONG(cat, lotOS, etat.params))}</strong>`;
        if (!montantManuel && n) champMontant.value = montant;
      };
      const majOuvrier = () => (zoneOuvrier.hidden = form.elements.cat.value !== 'mo');
      const majTout = () => { majOuvrier(); majONG(); };
      majTout();
      form.elements.cat.onchange = majTout;
      $$('input[name=latrineIds]', form).forEach((c) => c.addEventListener('change', majONG));
      $$('input[name=sens]', form).forEach((r) => (r.onchange = () => {
        form.elements.cat.innerHTML = optionsCat(r.value).map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join('');
        majTout();
      }));
    },
    onValider: async (d) => {
      if (!(d.montant > 0)) { toast('Indique un montant', 'err'); return false; }
      if (['avance', 'solde'].includes(d.cat) && !(d.latrineIds || []).length) {
        toast('Choisis les latrines concernées par ce paiement de l’ONG', 'err');
        return false;
      }
      await enregistrer('tx', {
        ...(existante || {}), ...d, workerId: d.cat === 'mo' ? d.workerId : '', latrineIds: d.latrineIds || [],
        photos: idsPhotos(d.photos), commandeId: x.commandeId || '',
      });
      toast(d.sens === 'in' ? 'Entrée enregistrée' : 'Dépense enregistrée');
      rafraichir();
    },
  });
}

function exporterCSV() {
  const nomL = (id) => etat.latrines.find((l) => l.id === id)?.num ?? '';
  const nomW = (id) => etat.workers.find((w) => w.id === id)?.nom ?? '';
  const lignes = [['Date', 'Type', 'Catégorie', 'Libellé', 'Montant', 'Moyen', 'Référence', 'Latrines', 'Ouvrier', 'Fournisseur', 'Note']];
  for (const t of [...etat.txs].reverse()) {
    lignes.push([t.date, t.sens === 'in' ? 'Entrée' : 'Sortie', nomCat(t.cat), t.libelle, t.montant, t.mode, t.ref,
      (t.latrineIds || []).map(nomL).join(' '), nomW(t.workerId), t.tiers, t.note]);
  }
  const csv = lignes.map((l) => l.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  telechargerFichier(`argent-chantier-${todayISO()}.csv`, `﻿${csv}`, 'text/csv;charset=utf-8');
  toast('Fichier Excel (CSV) téléchargé');
}
