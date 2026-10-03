// Champs du profil (TPE, contrat avec l'ONG, quincaillerie), partagés entre le premier lancement et les Réglages.
import { html, raw, esc, initiales, toast, $ } from '../util.js';
import { champ, input, select } from '../ui.js';
import { MODES_PAIEMENT } from '../data.js';
import { logoEnDataURL } from '../store.js';

/** Pastille du logo : l'image si elle existe, sinon les initiales de la TPE. */
export function pastilleLogo(tpe, cls = 'logo-tpe') {
  return tpe.logo
    ? `<span class="${cls}"><img src="${esc(tpe.logo)}" alt=""></span>`
    : `<span class="${cls} sans-image">${esc(initiales(tpe.nom))}</span>`;
}

export function champsTPE(t) {
  return html`
    ${raw(champ('Nom de la TPE', input('nom', t.nom, { required: true, placeholder: 'Nom de ton entreprise' })))}
    ${raw(champ('Gérant(e)', input('gerant', t.gerant, { required: true, placeholder: 'Nom et prénoms' })))}
    <div class="deux">
      ${raw(champ('Téléphone', input('tel', t.tel, { type: 'tel' })))}
      ${raw(champ('Réseau Mobile Money', select('reseauMomo', MODES_PAIEMENT.slice(0, 4), t.reseauMomo)))}
    </div>
    ${raw(champ('N° Mobile Money', input('momo', t.momo, { type: 'tel' }), 'Imprimé sur les factures envoyées à l’ONG'))}
    <div class="champ"><span class="champ-label">Logo de la TPE (facultatif)</span>
      <div class="logo-choix">
        <span id="logo-apercu">${raw(pastilleLogo(t, 'logo-tpe grand'))}</span>
        <label class="btn btn-petit">Choisir une image<input type="file" accept="image/*" hidden id="logo-fichier"></label>
        <button type="button" class="btn btn-petit" id="logo-retirer" ${t.logo ? '' : 'hidden'}>Retirer</button>
      </div>
      <input type="hidden" name="logo" value="${t.logo || ''}">
      <small class="aide">Il apparaît en haut de l’application et sur les rapports et factures.</small>
    </div>`;
}

export function champsContrat(c, t) {
  return html`
    ${raw(champ('Nom de l’ONG (commanditaire)', input('commanditaire', c.commanditaire, { required: true, placeholder: 'Nom complet de l’ONG' })))}
    <div class="deux">
      ${raw(champ('Sigle de l’ONG', input('sigle', c.sigle, { placeholder: 'Abréviation' })))}
      ${raw(champ('Projet', input('projet', c.projet, { placeholder: 'Nom du projet' })))}
    </div>
    ${raw(champ('Référence du contrat', input('ref', c.ref, { placeholder: 'N° inscrit sur ton contrat' })))}
    <div class="deux">
      ${raw(champ('N° de lot', input('lot', t.lot)))}
      ${raw(champ('Village(s)', input('village', t.village, { required: true })))}
    </div>
    ${raw(champ('Sous-préfecture', input('sousPrefecture', t.sousPrefecture)))}
    <div class="deux">
      ${raw(champ('Latrines à construire', input('totalLatrines', c.totalLatrines || '', { type: 'number', required: true })))}
      ${raw(champ('Date de démarrage', input('dateDebut', c.dateDebut, { type: 'date' })))}
    </div>
    <div class="deux">
      ${raw(champ('Prix d’une latrine (F)', input('prixLatrine', c.prixLatrine, { type: 'money' })))}
      ${raw(champ('Objectif / semaine', input('objectifSemaine', c.objectifSemaine, { type: 'number' })))}
    </div>
    <div class="deux">
      ${raw(champ('Avance de l’ONG (%)', input('avancePct', c.avancePct, { type: 'number' })))}
      ${raw(champ('Délai du solde (jours ouvr.)', input('delaiSolde', c.delaiSolde, { type: 'number' })))}
    </div>
    ${raw(champ('Contrôleur de l’ONG', input('controleur', c.controleur)))}`;
}

/** `avecTerrain` : ajoute le prix du kit réellement obtenu (Marge 2, usage personnel). */
export function champsQuincaillerie(q, avecTerrain = false) {
  return html`
    ${raw(champ('Nom de la quincaillerie', input('qnom', q.nom)))}
    <div class="deux">
      ${raw(champ('Prix d’un kit (F)', input('prixKit', q.prixKit, { type: 'money' })))}
      ${raw(champ('Acompte à la commande (%)', input('acomptePct', q.acomptePct, { type: 'number' })))}
    </div>
    ${raw(avecTerrain ? champ('🔒 Prix du kit obtenu (Marge 2)', input('prixKitTerrain', q.prixKitTerrain, { type: 'money', placeholder: 'Vide = même prix', vide: true }),
    'Personnel : jamais imprimé ni partagé.') : '')}`;
}

/** Applique les champs saisis (quelle que soit la section) sur une copie des paramètres. */
export function appliquerProfil(p, d) {
  const garder = (cles) => Object.fromEntries(cles.filter((k) => k in d).map((k) => [k, d[k]]));
  return {
    ...p,
    tpe: { ...p.tpe, ...garder(['nom', 'gerant', 'tel', 'reseauMomo', 'momo', 'logo', 'lot', 'village', 'sousPrefecture']) },
    contrat: {
      ...p.contrat,
      ...garder(['commanditaire', 'sigle', 'projet', 'ref', 'totalLatrines', 'dateDebut', 'prixLatrine', 'objectifSemaine', 'avancePct', 'delaiSolde', 'controleur']),
    },
    quincaillerie: {
      ...p.quincaillerie,
      ...('qnom' in d ? { nom: d.qnom } : {}),
      ...garder(['prixKit', 'acomptePct']),
      ...garder(['prixKitTerrain']),
    },
  };
}

/** Branche le choix du logo (aperçu, compression, retrait). */
export function brancherLogo(form) {
  const fichier = $('#logo-fichier', form);
  if (!fichier) return;
  const cache = form.elements.logo;
  const apercu = $('#logo-apercu', form);
  const retirer = $('#logo-retirer', form);
  const dessiner = () => {
    apercu.innerHTML = pastilleLogo({ logo: cache.value, nom: form.elements.nom?.value || '' }, 'logo-tpe grand');
    retirer.hidden = !cache.value;
  };
  fichier.onchange = async () => {
    const f = fichier.files[0];
    if (!f) return;
    try {
      cache.value = await logoEnDataURL(f);
      dessiner();
    } catch (err) {
      toast(err.message, 'err');
    }
  };
  retirer.onclick = () => { cache.value = ''; dessiner(); };
  if (form.elements.nom) form.elements.nom.addEventListener('input', () => !cache.value && dessiner());
}
