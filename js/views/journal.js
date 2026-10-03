// Journal de chantier : rapport du jour, historique par semaine, partage.
import { etat, enregistrer, supprimer, urlPhoto } from '../store.js';
import { html, raw, fcfa, todayISO, dateFr, dateCourte, lundiDe, ajouterJours, toast, $, $$ } from '../util.js';
import { ico, champ, input, select, textarea, segment, puces, feuille, zonePhotos, brancherPhotos, idsPhotos, vide, voirPhoto } from '../ui.js';
import { ETAPES, METEO, TYPES_INCIDENT, CATEGORIES, MODES_PAIEMENT } from '../data.js';
import { paiementsParLatrine, statut, acheveesSemaine, dateAchevement } from '../calc.js';
import { rafraichir, remplacerRoute } from '../app.js';
import { texteRapport, partagerTexte, imprimerRapport, imprimerJournalSemaine } from '../reports.js';

const nomLatrine = (id) => {
  const l = etat.latrines.find((x) => x.id === id);
  return l ? `L${l.num}${l.menage ? ` (${l.menage})` : ''}` : '?';
};

export async function vueJournal(vue, action) {
  const parSemaine = new Map();
  for (const j of etat.journal) {
    const k = lundiDe(j.date);
    parSemaine.set(k, [...(parSemaine.get(k) || []), j]);
  }
  const objectif = Number(etat.params.contrat.objectifSemaine) || 3;

  const blocs = [...parSemaine.entries()].map(([lundi, liste]) => {
    const faites = acheveesSemaine(etat.latrines, lundi).length;
    return html`<div class="etiquette">Semaine du ${dateCourte(lundi)} au ${dateCourte(ajouterJours(lundi, 6))}
        <a href="#" data-semaine="${lundi}">${ico('print')} Journal</a></div>
      <div class="liste">
        <div class="jour-groupe">${faites}/${objectif} latrines achevées · ${liste.length} rapport(s)</div>
        ${raw(liste.map((j) => html`<a class="ligne" href="#/rapport/${j.id}">
          <span class="badge-num" style="font-size:12px;line-height:1.1;text-align:center">${dateCourte(j.date)}</span>
          <span class="ligne-corps">
            <span class="ligne-titre">${(j.latrineIds || []).map(nomLatrine).join(', ') || 'Rapport général'}</span>
            <span class="ligne-sous">${j.travaux || '—'}</span>
          </span>
          ${raw(j.incident && j.incident !== 'Aucun' ? `<span class="statut encours">Incident</span>` : '')}
          ${ico('chevron', 'chev')}</a>`).join(''))}
      </div>`;
  }).join('');

  vue.innerHTML = html`
    <div class="titre-vue">
      <div><span class="sur">${etat.journal.length} rapport(s)</span><h1>Journal de chantier</h1></div>
      <button class="btn-ajout" id="ajout" aria-label="Nouveau rapport">${ico('plus')}</button>
    </div>
    <p class="note">À remplir chaque jour de chantier. Il sert de pièce justificative pour l’ONG et fait avancer automatiquement les étapes des latrines.</p>
    ${raw(blocs || vide('Aucun rapport pour l’instant.', '<button class="btn btn-plein" data-ajout>Faire le rapport du jour</button>'))}`;

  $$('#ajout, [data-ajout]', vue).forEach((b) => (b.onclick = () => formRapport()));
  $$('[data-semaine]', vue).forEach((a) => (a.onclick = (e) => { e.preventDefault(); imprimerJournalSemaine(a.dataset.semaine); }));
  if (action === 'nouveau') {
    remplacerRoute('#/journal');
    const existant = etat.journal.find((j) => j.date === todayISO());
    formRapport(existant || null);
  }
}

function blocEtapes(latrineIds, choisies = {}) {
  if (!latrineIds.length) return '<p class="aide">Choisis d’abord les latrines travaillées.</p>';
  return latrineIds.map((id) => {
    const l = etat.latrines.find((x) => x.id === id);
    if (!l) return '';
    const restantes = ETAPES.filter((e) => !l.etapes?.[e.id] || (choisies[id] || []).includes(e.id));
    if (!restantes.length) return html`<p class="aide">L${l.num} : toutes les étapes sont faites.</p>`;
    return html`<div class="champ"><span class="champ-label">L${l.num} — ${l.menage || ''}</span>
      ${raw(puces(`etapes_${id}`, restantes.map((e) => [e.id, e.court]), choisies[id] || []))}</div>`;
  }).join('');
}

export function formRapport(j = null) {
  const jour = j?.date || todayISO();
  const paie = paiementsParLatrine(etat.txs);
  const actives = etat.latrines.filter((l) => {
    const s = statut(l, paie, etat.params);
    return s === 'encours' || s === 'planifiee' || (j?.latrineIds || []).includes(l.id) || (s === 'achevee' && dateAchevement(l) === jour);
  });
  const ouvriers = etat.workers.filter((w) => w.actif !== false);
  const x = j || { meteo: 'Ensoleillé', epi: true, incident: 'Aucun', presents: ouvriers.map((w) => w.id), latrineIds: [] };

  feuille({
    titre: j ? `Rapport du ${dateCourte(j.date)}` : 'Rapport du jour',
    valider: 'Enregistrer le rapport',
    corps: html`
      <div class="deux">
        ${raw(champ('Date', input('date', jour, { type: 'date', required: true })))}
        ${raw(champ('Météo', select('meteo', METEO, x.meteo)))}
      </div>
      <div class="champ"><span class="champ-label">Latrines travaillées aujourd’hui</span>
        ${raw(actives.length ? puces('latrineIds', actives.map((l) => [l.id, `L${l.num} ${l.menage ? `· ${l.menage.split(' ')[0]}` : ''}`]), x.latrineIds) : '<p class="aide">Aucune latrine en cours. Ajoute-les dans l’onglet Latrines.</p>')}
      </div>
      <div class="groupe"><h4>Étapes terminées aujourd’hui</h4><div id="zone-etapes">${raw(blocEtapes(x.latrineIds, x.etapesFaites))}</div></div>
      ${raw(champ('Travaux réalisés', textarea('travaux', x.travaux, 'Ex. : coulage dallettes, élévation murs L12…')))}
      <div class="champ"><span class="champ-label">Équipe présente</span>
        ${raw(ouvriers.length ? puces('presents', ouvriers.map((w) => [w.id, `${w.nom} · ${w.role}`]), x.presents) : '<p class="aide">Ajoute ton équipe dans Plus → Équipe pour cocher les présences.</p>')}
      </div>
      ${raw(champ('Matériaux utilisés', textarea('materiaux', x.materiaux, 'Ex. : 4 sacs de ciment, 3 brouettes de sable, 1 tuyau PVC 110', 2)))}
      ${raw(j ? '' : html`<div class="groupe"><h4>Achat du jour (facultatif)</h4>
        ${raw(champ('Quoi ?', input('achatLibelle', '', { placeholder: 'Ex. : 1 tricycle de sable' })))}
        <div class="deux">
          ${raw(champ('Montant (F)', input('achatMontant', '', { type: 'money' })))}
          ${raw(champ('Payé par', select('achatMode', MODES_PAIEMENT, 'Espèces')))}
        </div>
        ${raw(champ('Catégorie', select('achatCat', CATEGORIES.out.map((c) => [c.id, c.nom]), 'materiaux')))}
      </div>`)}
      ${raw(champ('Difficultés rencontrées', textarea('difficultes', x.difficultes, 'Manque d’eau, retard livraison, ménage absent…', 2)))}
      <div class="groupe"><h4>Incident / plainte / sécurité</h4>
        ${raw(champ('Incident', select('incident', ['Aucun', ...TYPES_INCIDENT], x.incident)))}
        <div id="zone-incident" ${x.incident === 'Aucun' ? 'hidden' : ''}>
          ${raw(champ('Gravité', segment('gravite', [['mineur', 'Mineur'], ['modere', 'Modéré'], ['majeur', 'Majeur']], x.gravite || 'mineur')))}
          ${raw(champ('Ce qui s’est passé et mesures prises', textarea('incidentDetail', x.incidentDetail, '', 2)))}
        </div>
        <label class="coche"><input type="checkbox" name="epi" ${x.epi ? 'checked' : ''}><span class="coche-txt">EPI portés par toute l’équipe<small>Casques, gants, chaussures — et chantier balisé</small></span></label>
      </div>
      <div class="champ"><span class="champ-label">Photos du jour</span>${raw(zonePhotos('photos', x.photos || []))}</div>`,
    supprimer: j ? async () => {
      await supprimer('journal', j.id);
      await appliquerEtapes({}, '', j.date, j.etapesFaites || {}); // décoche les étapes posées par ce rapport
      toast('Rapport supprimé');
      location.hash = '#/journal';
    } : null,
    onOuvert: (form) => {
      brancherPhotos(form);
      const majEtapes = () => {
        const ids = $$('input[name=latrineIds]:checked', form).map((c) => c.value);
        // État affiché actuellement, y compris les latrines dont tout a été décoché.
        const garde = {};
        $$('#zone-etapes input', form).forEach((c) => {
          const lid = c.name.replace('etapes_', '');
          garde[lid] = [...(garde[lid] || []), ...(c.checked ? [c.value] : [])];
        });
        $('#zone-etapes', form).innerHTML = blocEtapes(ids, { ...x.etapesFaites, ...garde });
      };
      $$('input[name=latrineIds]', form).forEach((c) => (c.onchange = majEtapes));
      form.elements.incident.onchange = (e) => ($('#zone-incident', form).hidden = e.target.value === 'Aucun');
    },
    onValider: async (d, form) => {
      const etapesFaites = {};
      for (const id of d.latrineIds || []) {
        etapesFaites[id] = $$(`input[name="etapes_${id}"]:checked`, form).map((c) => c.value);
      }
      const rec = await enregistrer('journal', {
        ...(j || {}),
        date: d.date, meteo: d.meteo, latrineIds: d.latrineIds || [], etapesFaites, travaux: d.travaux,
        presents: d.presents || [], materiaux: d.materiaux, difficultes: d.difficultes, incident: d.incident,
        gravite: d.incident === 'Aucun' ? '' : d.gravite, incidentDetail: d.incident === 'Aucun' ? '' : d.incidentDetail,
        epi: d.epi, photos: idsPhotos(d.photos),
      });
      await appliquerEtapes(etapesFaites, d.date, j?.date || d.date, j?.etapesFaites || {});
      if (d.achatMontant > 0) {
        await enregistrer('tx', {
          date: d.date, sens: 'out', cat: d.achatCat, montant: d.achatMontant, mode: d.achatMode,
          libelle: d.achatLibelle || 'Achat du jour', latrineIds: d.latrineIds || [], rapportId: rec.id,
        });
      }
      toast('Rapport enregistré');
      location.hash = `#/rapport/${rec.id}`;
      rafraichir();
    },
  });
}

/**
 * Reporte les étapes d'un rapport dans les fiches latrines.
 * Une étape n'est retirée ou re-datée que si elle porte encore la date de l'ancien rapport
 * (elle n'a donc pas été cochée ailleurs entre-temps).
 */
async function appliquerEtapes(nouvelles, date, ancienneDate, anciennes) {
  const ids = new Set([...Object.keys(nouvelles), ...Object.keys(anciennes)]);
  for (const id of ids) {
    const l = etat.latrines.find((x) => x.id === id);
    if (!l) continue;
    const etapes = { ...(l.etapes || {}) };
    const posees = (e) => (anciennes[id] || []).includes(e) && etapes[e] === ancienneDate;
    for (const e of anciennes[id] || []) if (!(nouvelles[id] || []).includes(e) && posees(e)) delete etapes[e];
    for (const e of nouvelles[id] || []) etapes[e] = posees(e) || !etapes[e] ? date : etapes[e];
    await enregistrer('latrines', { ...l, etapes });
  }
}

export async function vueRapport(vue, id) {
  const j = etat.journal.find((x) => x.id === id);
  if (!j) { vue.innerHTML = vide('Rapport introuvable.', '<a class="btn" href="#/journal">Retour</a>'); return; }
  const presents = etat.workers.filter((w) => (j.presents || []).includes(w.id));
  const depenses = etat.txs.filter((t) => t.date === j.date && t.sens === 'out');
  const totalDep = depenses.reduce((s, t) => s + (Number(t.montant) || 0), 0);
  const etapesTxt = Object.entries(j.etapesFaites || {})
    .filter(([, l]) => l.length)
    .map(([lid, l]) => `${nomLatrine(lid)} : ${l.map((e) => ETAPES.find((x) => x.id === e)?.court || e).join(', ')}`);

  const bloc = (titre, contenu) => (contenu ? html`<dt>${titre}</dt><dd style="text-align:left;font-weight:500">${contenu}</dd>` : '');

  vue.innerHTML = html`
    <a class="retour" href="#/journal">${ico('back')} Journal</a>
    <div class="titre-vue">
      <div><span class="sur">Rapport de chantier</span><h1>${dateFr(j.date, true)}</h1></div>
      <button class="btn-ico" id="modifier" aria-label="Modifier">${ico('edit')}</button>
    </div>
    <div class="rangee">
      <button class="btn btn-plein" id="partager">${ico('share')} WhatsApp</button>
      <button class="btn" id="imprimer">${ico('print')} PDF</button>
    </div>
    <div class="carte">
      <dl class="infos" style="grid-template-columns:110px 1fr">
        ${raw(bloc('Météo', j.meteo))}
        ${raw(bloc('Sites', (j.latrineIds || []).map(nomLatrine).join(', ')))}
        ${raw(bloc('Étapes finies', etapesTxt.join(' · ')))}
        ${raw(bloc('Travaux', j.travaux))}
        ${raw(bloc('Équipe', presents.length ? `${presents.length} : ${presents.map((w) => w.nom).join(', ')}` : ''))}
        ${raw(bloc('Matériaux', j.materiaux))}
        ${raw(bloc('Difficultés', j.difficultes))}
        ${raw(bloc('Incident', j.incident === 'Aucun' ? 'Aucun' : `${j.incident} (${j.gravite}) — ${j.incidentDetail || ''}`))}
        ${raw(bloc('EPI', j.epi ? 'Portés ✓' : 'Non portés ⚠'))}
      </dl>
    </div>
    <div class="etiquette">Dépenses du jour <span>${fcfa(totalDep)}</span></div>
    ${raw(depenses.length
      ? `<div class="liste">${depenses.map((t) => html`<div class="ligne"><span class="ligne-corps"><span class="ligne-titre">${t.libelle || t.cat}</span><span class="ligne-sous">${t.mode || ''}</span></span><span class="num">${fcfa(t.montant)}</span></div>`).join('')}</div>`
      : vide('Aucune dépense enregistrée ce jour.'))}
    ${raw((j.photos || []).length ? '<div class="etiquette">Photos</div><div class="galerie" id="galerie"></div>' : '')}`;

  const galerie = $('#galerie', vue);
  if (galerie) {
    for (const pid of j.photos) {
      const url = await urlPhoto(pid);
      if (!url) continue;
      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      img.onclick = () => voirPhoto(url);
      galerie.appendChild(img);
    }
  }
  $('#modifier', vue).onclick = () => formRapport(j);
  $('#partager', vue).onclick = () => partagerTexte(texteRapport(j), j.photos);
  $('#imprimer', vue).onclick = () => imprimerRapport(j);
}
