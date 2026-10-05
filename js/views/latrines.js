// Latrines : liste, fiche de suivi, étapes, contrôle qualité, défauts, réception.
import { etat, enregistrer, supprimer, urlPhoto } from '../store.js';
import { html, raw, esc, fcfa, todayISO, dateFr, dateCourte, toast, $, $$ } from '../util.js';
import {
  ico, champ, input, select, textarea, segment, feuille, confirmer, zonePhotos, brancherPhotos, idsPhotos, vide, voirPhoto,
} from '../ui.js';
import { TYPES_LATRINE, INTERFACES_WC, ETAPES, CONTROLES, sigleONG, nomONG, typeCourt, partAvance } from '../data.js';
import { STATUTS, statut, paiementsParLatrine, etapesFaites, dateAchevement, stock, montantONG, pointsConformes } from '../calc.js';
import { rafraichir, remplacerRoute } from '../app.js';
import { formTransaction } from './argent.js';
import { imprimerFicheQualite } from '../reports.js';

let filtreActif = 'tous';
let recherche = '';

export function pastilleStatut(s) {
  return `<span class="statut ${s}">${STATUTS[s].nom}</span>`;
}

export function miniEtapes(l) {
  const n = etapesFaites(l);
  return `<div class="mini-etapes ${n === ETAPES.length ? 'fini' : ''}">${ETAPES.map((e) => `<i class="${l.etapes?.[e.id] ? 'f' : ''}"></i>`).join('')}</div>`;
}

export function ligneLatrine(l, paie) {
  const s = statut(l, paie, etat.params);
  return html`<a class="ligne" href="#/latrine/${l.id}">
    <span class="badge-num">${l.num}</span>
    <span class="ligne-corps">
      <span class="ligne-titre">${l.menage || 'Ménage non renseigné'}</span>
      <span class="ligne-sous">${l.village || ''}${l.type ? ` · ${typeCourt(l.type)}` : ''}${l.interface ? ` · ${l.interface}` : ''}</span>
      ${raw(miniEtapes(l))}
    </span>
    <span class="ligne-fin">${raw(pastilleStatut(s))}</span>
  </a>`;
}

export async function vueLatrines(vue, action) {
  const paie = paiementsParLatrine(etat.txs);
  const avecStatut = etat.latrines.map((l) => ({ l, s: statut(l, paie, etat.params) }));
  const compte = (k) => (k === 'tous' ? avecStatut.length : avecStatut.filter((x) => x.s === k).length);
  const filtres = [['tous', 'Toutes'], ...Object.entries(STATUTS).map(([k, v]) => [k, v.nom])];

  vue.innerHTML = html`
    <div class="titre-vue">
      <div><span class="sur">${etat.latrines.length} / ${etat.params.contrat.totalLatrines} enregistrées</span><h1>Latrines</h1></div>
      <button class="btn-ajout" id="ajout" aria-label="Nouvelle latrine">${ico('plus')}</button>
    </div>
    <input class="recherche" type="search" id="recherche" placeholder="Rechercher : n°, ménage, village…" value="${recherche}">
    <div class="filtres" id="filtres"></div>
    <div id="zone-liste"></div>`;

  // Seules la liste et les filtres sont redessinés : le champ de recherche garde le clavier ouvert.
  const dessiner = () => {
    const q = recherche.toLowerCase();
    const visibles = avecStatut
      .filter((x) => filtreActif === 'tous' || x.s === filtreActif)
      .filter((x) => !q || `${x.l.num} ${x.l.menage} ${x.l.village} ${x.l.quartier}`.toLowerCase().includes(q));
    $('#filtres', vue).innerHTML = filtres.map(([k, t]) => `<button class="filtre ${k === filtreActif ? 'actif' : ''}" data-f="${k}">${t}<b>${compte(k)}</b></button>`).join('');
    $('#zone-liste', vue).innerHTML = visibles.length
      ? `<div class="liste">${visibles.map((x) => ligneLatrine(x.l, paie)).join('')}</div>`
      : vide(etat.latrines.length ? 'Aucune latrine ne correspond.' : 'Ajoute ta première latrine : ménage, village, type, position GPS.',
        etat.latrines.length ? '' : '<button class="btn btn-plein" data-ajout>Ajouter une latrine</button>');
    $$('[data-f]', vue).forEach((b) => (b.onclick = () => { filtreActif = b.dataset.f; dessiner(); }));
    $$('[data-ajout]', vue).forEach((b) => (b.onclick = () => formLatrine()));
  };
  dessiner();

  const champRecherche = $('#recherche', vue);
  champRecherche.oninput = () => { recherche = champRecherche.value; dessiner(); };
  $('#ajout', vue).onclick = () => formLatrine();
  if (action === 'nouvelle') {
    remplacerRoute('#/latrines');
    formLatrine();
  }
}

function prochainNumero() {
  const nums = etat.latrines.map((l) => Number(l.num)).filter((n) => !Number.isNaN(n));
  return nums.length ? Math.max(...nums) + 1 : 1;
}

export function formLatrine(l = null) {
  const x = l || { num: prochainNumero(), village: etat.params.tpe.village, type: 'B', interface: 'Satopan accroupi' };
  feuille({
    titre: l ? `Modifier la latrine ${l.num}` : 'Nouvelle latrine',
    corps: html`
      <div class="deux">
        ${raw(champ('N° latrine', input('num', x.num, { required: true })))}
        ${raw(champ('N° semaine / OS', input('os', x.os, { placeholder: 'ex. S1' })))}
      </div>
      ${raw(champ('Chef de ménage', input('menage', x.menage, { required: true, placeholder: 'Nom et prénoms' })))}
      <div class="deux">
        ${raw(champ('Village', input('village', x.village, { required: true })))}
        ${raw(champ('Quartier / repère', input('quartier', x.quartier)))}
      </div>
      ${raw(champ('Téléphone du ménage', input('telMenage', x.telMenage, { type: 'tel' })))}
      ${raw(champ('Type de latrine', select('type', Object.entries(TYPES_LATRINE), x.type)))}
      ${raw(champ('Interface WC (choix du ménage)', INTERFACES_WC.length > 4
        ? select('interface', INTERFACES_WC, x.interface)
        : segment('interface', INTERFACES_WC.map((i) => [i, i]), x.interface)))}
      <div class="groupe">
        <h4>Position GPS</h4>
        <div class="deux">
          ${raw(champ('Latitude', input('lat', x.lat, { type: 'number', step: 'any' })))}
          ${raw(champ('Longitude', input('lng', x.lng, { type: 'number', step: 'any' })))}
        </div>
        <button type="button" class="btn btn-bloc" id="gps" style="margin-bottom:14px">${ico('pin')} Prendre ma position ici</button>
      </div>
      ${raw(champ('Remarques', textarea('notes', x.notes, 'Accès, sol, point d’eau proche…')))}
      <div class="champ"><span class="champ-label">Photos (site avant travaux…)</span>${raw(zonePhotos('photos', x.photos || []))}</div>`,
    supprimer: l ? async () => { await supprimer('latrines', l.id); toast('Latrine supprimée'); location.hash = '#/latrines'; } : null,
    onOuvert: (form) => {
      brancherPhotos(form);
      $('#gps', form).onclick = () => capturerGPS(form);
    },
    onValider: async (d) => {
      const doublon = etat.latrines.find((o) => String(o.num) === String(d.num) && o.id !== x.id);
      if (doublon) { toast(`Le n° ${d.num} existe déjà`, 'err'); return false; }
      const rec = await enregistrer('latrines', {
        ...x, ...d, lat: d.lat || '', lng: d.lng || '', photos: idsPhotos(d.photos), etapes: x.etapes || {},
      });
      toast(l ? 'Latrine modifiée' : `Latrine ${rec.num} ajoutée`);
      if (l) rafraichir(); else location.hash = `#/latrine/${rec.id}`;
    },
  });
}

function capturerGPS(form) {
  if (!navigator.geolocation) return toast('GPS non disponible sur cet appareil', 'err');
  const btn = $('#gps', form);
  btn.disabled = true;
  btn.lastChild.textContent = ' Recherche du signal GPS…';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      form.elements.lat.value = pos.coords.latitude.toFixed(6);
      form.elements.lng.value = pos.coords.longitude.toFixed(6);
      btn.disabled = false;
      btn.lastChild.textContent = ` Position prise (± ${Math.round(pos.coords.accuracy)} m)`;
    },
    (err) => {
      btn.disabled = false;
      btn.lastChild.textContent = ' Prendre ma position ici';
      toast(err.code === 1 ? 'Autorise la localisation pour cette application' : 'Signal GPS introuvable, réessaie dehors', 'err');
    },
    { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 },
  );
}

// ---------- Fiche latrine ----------

export async function vueFicheLatrine(vue, id) {
  const l = etat.latrines.find((x) => x.id === id);
  if (!l) { vue.innerHTML = vide('Latrine introuvable.', '<a class="btn" href="#/latrines">Retour</a>'); return; }
  const paie = paiementsParLatrine(etat.txs);
  const s = statut(l, paie, etat.params);
  const p = paie[l.id] || { avance: 0, solde: 0 };
  const prix = Number(etat.params.contrat.prixLatrine) || 0;
  const faites = etapesFaites(l);
  const prochaine = ETAPES.find((e) => !l.etapes?.[e.id]);
  const rapports = etat.journal.filter((j) => (j.latrineIds || []).includes(l.id));
  const defauts = l.defauts || [];
  const qc = l.qc || {};

  const etapesHtml = ETAPES.map((e, i) => {
    const d = l.etapes?.[e.id];
    return `<button class="etape ${d ? 'fait' : ''} ${prochaine && prochaine.id === e.id ? 'suivante' : ''}" data-etape="${esc(e.id)}">
      <span class="rond">${d ? '✓' : i + 1}</span><span class="etape-nom">${esc(e.nom)}</span><span class="etape-date">${d ? dateCourte(d) : ''}</span></button>`;
  }).join('');

  const qcHtml = Object.entries(CONTROLES).map(([k, c]) => {
    const r = qc[k] || {};
    const ok = pointsConformes(c, r).length;
    const fini = c.points.length > 0 && ok === c.points.length;
    return `<button class="ligne" data-qc="${esc(k)}">
      <span class="icone-rond ${fini ? 'in' : 'out'}">${ico(fini ? 'check' : 'journal').v}</span>
      <span class="ligne-corps"><span class="ligne-titre">${esc(c.titre)}</span>
      <span class="ligne-sous">${ok}/${c.points.length} conformes${r.date ? ` · ${dateFr(r.date)}` : ''}${r.controleur ? ` · ${esc(r.controleur)}` : ''}</span></span>
      ${ico('chevron', 'chev').v}</button>`;
  }).join('');

  const defautsHtml = defauts.length
    ? defauts.map((d, i) => `<div class="ligne"><span class="icone-rond ${d.corrigeLe ? 'in' : 'out'}">${ico(d.corrigeLe ? 'check' : 'alert').v}</span>
        <span class="ligne-corps"><span class="ligne-titre">${esc(d.description)}</span><span class="ligne-sous">${d.gravite === 'majeur' ? 'Majeur (5 j)' : 'Mineur (48 h)'} · signalé le ${dateFr(d.date)}${d.corrigeLe ? ` · corrigé le ${dateFr(d.corrigeLe)}` : ''}</span></span>
        ${d.corrigeLe ? '' : `<button class="btn btn-petit" data-corrige="${i}">Corrigé</button>`}</div>`).join('')
    : '<div class="ligne"><span class="ligne-sous">Aucun défaut signalé.</span></div>';

  vue.innerHTML = html`
    <a class="retour" href="#/latrines">${ico('back')} Latrines</a>
    <div class="titre-vue">
      <div><span class="sur">Latrine n° ${l.num}${l.os ? ` · ${l.os}` : ''}</span><h1>${l.menage || 'Ménage'}</h1></div>
      <button class="btn-ico" id="modifier" aria-label="Modifier">${ico('edit')}</button>
    </div>
    <div class="carte">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">${raw(pastilleStatut(s))}<span class="num" style="color:var(--navy)">${faites}/${ETAPES.length} étapes</span></div>
      <dl class="infos">
        <dt>Village</dt><dd>${l.village}${l.quartier ? ` — ${l.quartier}` : ''}</dd>
        <dt>Type</dt><dd>${TYPES_LATRINE[l.type] || '—'}</dd>
        <dt>Interface</dt><dd>${l.interface || '—'}</dd>
        ${raw(l.telMenage ? html`<dt>Téléphone</dt><dd><a href="tel:${l.telMenage}">${l.telMenage}</a></dd>` : '')}
        <dt>GPS</dt><dd>${raw(l.lat && l.lng ? html`<a href="https://www.google.com/maps?q=${l.lat},${l.lng}" target="_blank" rel="noopener">${Number(l.lat).toFixed(5)}, ${Number(l.lng).toFixed(5)}</a>` : '<span style="color:var(--attention)">à relever</span>')}</dd>
      </dl>
      ${raw(l.notes ? html`<p class="note" style="margin:12px 0 0">${l.notes}</p>` : '')}
    </div>

    <div class="etiquette">Avancement des travaux <span>touche une étape</span></div>
    <div class="carte etapes" style="padding:4px 16px">${raw(etapesHtml)}</div>

    <div class="etiquette">Kit quincaillerie</div>
    <div class="carte" style="display:flex;align-items:center;gap:12px">
      <span class="icone-rond ${l.kitAffecte ? 'in' : 'out'}">${ico('box')}</span>
      <span style="flex:1"><strong>${l.kitAffecte ? 'Kit affecté' : 'Pas encore de kit'}</strong><br><small style="color:var(--encre-2)">${l.kitAffecte ? `sorti du stock le ${dateFr(l.kitAffecte)}` : 'Sortir 1 kit du stock pour ce chantier'}</small></span>
      <button class="btn btn-petit ${l.kitAffecte ? '' : 'btn-navy'}" id="kit">${l.kitAffecte ? 'Annuler' : 'Affecter'}</button>
    </div>

    <div class="etiquette">Contrôle qualité <a href="#" id="imprimer-qc">Fiche PDF</a></div>
    <div class="liste">${raw(qcHtml)}</div>

    <div class="etiquette">Défauts à corriger <a href="#" id="ajout-defaut">+ Signaler</a></div>
    <div class="liste">${raw(defautsHtml)}</div>

    <div class="etiquette">Réception & paiement</div>
    <div class="carte">
      <dl class="infos">
        <dt>PV tripartite</dt><dd>${l.pvSigne ? `Signé le ${dateFr(l.dateReception)}` : 'Non signé'}</dd>
        <dt>Avance reçue</dt><dd>${fcfa(p.avance)}</dd>
        <dt>Solde reçu</dt><dd>${fcfa(p.solde)}</dd>
        <dt>Reste à recevoir</dt><dd class="${prix - p.avance - p.solde > 0 ? 'ecart-neg' : 'ecart-pos'}">${fcfa(Math.max(0, prix - p.avance - p.solde))}</dd>
      </dl>
      <div class="rangee" style="margin-top:14px">
        <button class="btn" id="reception">${l.pvSigne ? 'Modifier la réception' : 'PV signé'}</button>
        <button class="btn btn-navy" id="paiement">${ico('in')} Paiement ${sigleONG(etat.params)}</button>
      </div>
    </div>

    ${raw((l.photos || []).length ? html`<div class="etiquette">Photos</div><div class="galerie" id="galerie"></div>` : '')}

    <div class="etiquette">Rapports journaliers <span>${rapports.length}</span></div>
    ${raw(rapports.length
      ? `<div class="liste">${rapports.map((j) => html`<a class="ligne" href="#/rapport/${j.id}"><span class="ligne-corps"><span class="ligne-titre">${dateFr(j.date, true)}</span><span class="ligne-sous">${j.travaux || '—'}</span></span>${ico('chevron', 'chev')}</a>`).join('')}</div>`
      : vide('Pas encore de rapport pour ce chantier.'))}`;

  // Galerie
  const galerie = $('#galerie', vue);
  if (galerie) {
    for (const pid of l.photos) {
      const url = await urlPhoto(pid);
      if (!url) continue;
      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      img.onclick = () => voirPhoto(url);
      galerie.appendChild(img);
    }
  }

  const maj = async (changes, msg) => {
    await enregistrer('latrines', { ...l, ...changes });
    if (msg) toast(msg);
    rafraichir();
  };

  $('#modifier', vue).onclick = () => formLatrine(l);
  $$('[data-etape]', vue).forEach((b) => (b.onclick = async () => {
    const eid = b.dataset.etape;
    const etapes = { ...(l.etapes || {}) };
    if (etapes[eid]) {
      if (!(await confirmer('Annuler cette étape ?', 'Oui, annuler'))) return;
      delete etapes[eid];
    } else etapes[eid] = todayISO();
    const fini = ETAPES.every((e) => etapes[e.id]) && !dateAchevement(l);
    await maj({ etapes }, fini ? 'Latrine achevée ! Pense au PV de réception.' : '');
  }));
  $('#kit', vue).onclick = async () => {
    if (l.kitAffecte && !(await confirmer('Remettre ce kit dans le stock ?'))) return;
    if (!l.kitAffecte) {
      const dispo = stock(etat.kit, etat.commandes, etat.latrines, etat.mouvements).kitsDispo;
      if (dispo <= 0 && !(await confirmer('Aucun kit livré en stock. Affecter quand même ?', 'Affecter'))) return;
    }
    // On garde la composition du kit sorti du stock (le kit de la quincaillerie peut changer ensuite).
    const kitArticles = l.kitAffecte ? null : etat.kit.map(({ id, nom, qte, unite }) => ({ id, nom, qte, unite }));
    await maj({ kitAffecte: l.kitAffecte ? null : todayISO(), kitArticles }, l.kitAffecte ? 'Kit remis en stock' : 'Kit affecté à la latrine');
  };
  $$('[data-qc]', vue).forEach((b) => (b.onclick = () => formControle(l, b.dataset.qc)));
  $('#ajout-defaut', vue).onclick = (e) => { e.preventDefault(); formDefaut(l); };
  $$('[data-corrige]', vue).forEach((b) => (b.onclick = async () => {
    const liste = defauts.map((d, i) => (i === Number(b.dataset.corrige) ? { ...d, corrigeLe: todayISO() } : d));
    await maj({ defauts: liste }, 'Défaut marqué corrigé');
  }));
  $('#reception', vue).onclick = () => formReception(l);
  $('#paiement', vue).onclick = () => {
    // Avance puis solde ; on coche les latrines du même ordre de service (OS) pas encore payées.
    const cat = p.avance ? 'solde' : 'avance';
    const memeOS = l.os ? etat.latrines.filter((o) => o.os === l.os && o.id !== l.id && !(paie[o.id]?.[cat] > 0)) : [];
    const ids = [l.id, ...memeOS.map((o) => o.id)];
    formTransaction({
      sens: 'in', cat, latrineIds: ids, montant: montantONG(cat, ids.length, etat.params), mode: etat.params.tpe.reseauMomo,
      libelle: `${cat === 'avance' ? 'Avance' : 'Solde'} ${sigleONG(etat.params)}${l.os ? ` — OS ${l.os}` : ''}`, tiers: nomONG(etat.params),
    });
  };
  $('#imprimer-qc', vue).onclick = (e) => { e.preventDefault(); imprimerFicheQualite(l); };
}

function formControle(l, cle) {
  const c = CONTROLES[cle];
  const r = (l.qc || {})[cle] || {};
  const coches = new Set(r.points || []);
  feuille({
    titre: c.titre,
    corps: html`
      <div class="carte coches" style="padding:4px 14px">
        ${raw(c.points.map((pt) => html`<label class="coche"><input type="checkbox" name="points" value="${pt.id}" data-multi="1" ${coches.has(pt.id) ? 'checked' : ''}><span class="coche-txt">${pt.nom}</span></label>`).join(''))}
      </div>
      <div style="height:14px"></div>
      <div class="deux">
        ${raw(champ('Date du contrôle', input('date', r.date || todayISO(), { type: 'date' })))}
        ${raw(champ(`Contrôleur ${sigleONG(etat.params)}`, input('controleur', r.controleur || etat.params.contrat.controleur)))}
      </div>
      ${raw(champ('Observations', textarea('observations', r.observations)))}`,
    onValider: async (d) => {
      await enregistrer('latrines', { ...l, qc: { ...(l.qc || {}), [cle]: d } });
      const nonConformes = c.points.length - (d.points || []).length;
      toast(nonConformes ? `${nonConformes} point(s) non conforme(s) enregistrés` : 'Contrôle conforme ✓');
      rafraichir();
    },
  });
}

function formDefaut(l) {
  feuille({
    titre: `Défaut — latrine ${l.num}`,
    corps: html`
      ${raw(champ('Gravité', segment('gravite', [['mineur', 'Mineur — 48 h'], ['majeur', 'Majeur — 5 jours']], 'mineur')))}
      ${raw(champ('Description du défaut', textarea('description', '', 'Ex. : fissure enduit intérieur, pente WC insuffisante…')))}
      ${raw(champ('Date de signalement', input('date', todayISO(), { type: 'date' })))}`,
    onValider: async (d) => {
      if (!d.description) { toast('Décris le défaut', 'err'); return false; }
      await enregistrer('latrines', { ...l, defauts: [...(l.defauts || []), d] });
      toast('Défaut enregistré');
      rafraichir();
    },
  });
}

function formReception(l) {
  feuille({
    titre: `Réception — latrine ${l.num}`,
    corps: html`
      <label class="carte coche"><input type="checkbox" name="pvSigne" ${l.pvSigne ? 'checked' : ''}>
        <span class="coche-txt">PV / fiche qualité tripartite signée<small>Contrôleur ${sigleONG(etat.params)} + représentant TPE + chef de ménage</small></span></label>
      <div style="height:14px"></div>
      ${raw(champ('Date de réception', input('dateReception', l.dateReception || todayISO(), { type: 'date' })))}
      <div class="champ"><span class="champ-label">Photos de la latrine terminée</span>${raw(zonePhotos('photosFin', l.photosFin || []))}</div>
      <p class="note">Le solde (${Math.round((1 - partAvance(etat.params)) * 100)} %) doit être versé par ${nomONG(etat.params)} dans les ${Number(etat.params.contrat.delaiSolde) || 5} jours ouvrables après le PV signé. L’application t’alertera en cas de retard.</p>`,
    onOuvert: (form) => brancherPhotos(form),
    onValider: async (d) => {
      const reste = ETAPES.length - etapesFaites(l);
      if (d.pvSigne && !l.pvSigne && reste > 0
        && !(await confirmer(`Il reste ${reste} étape(s) non cochée(s). Enregistrer le PV quand même ?`, 'Enregistrer'))) return false;
      const photosFin = idsPhotos(d.photosFin);
      const photos = [...new Set([...(l.photos || []), ...photosFin])];
      await enregistrer('latrines', { ...l, pvSigne: d.pvSigne, dateReception: d.pvSigne ? d.dateReception : '', photosFin, photos });
      toast(d.pvSigne ? 'Réception enregistrée' : 'Réception annulée');
      rafraichir();
    },
  });
}
