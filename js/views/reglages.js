// Réglages : TPE, ONG & contrat, kit de quincaillerie, budget, et référentiel du chantier (tout est modifiable).
import { etat, enregistrer, sauverParams, sauverKit, sauverBudget, sauverReferentiel, marquerConfigure } from '../store.js';
import { html, raw, fcfa, dateFr, toast, lireMontant, $, $$, uid } from '../util.js';
import { ico, champ, input, select, feuille, confirmer } from '../ui.js';
import {
  nomONG, ETAPES, CONTROLES, TYPES_LATRINE, INTERFACES_WC, KIT_DEFAUT, BUDGET_DEFAUT, REFERENTIEL_DEFAUT, referentielActuel,
} from '../data.js';
import { budgetLatrine, dateAchevement } from '../calc.js';
import { rafraichir } from '../app.js';
import { champsTPE, champsContrat, champsQuincaillerie, appliquerProfil, brancherLogo, pastilleLogo } from './profil.js';

// Catégories d'un poste du budget : « Main-d’œuvre » est séparée des achats dans la rentabilité.
const CATEGORIES_BUDGET = [['materiaux', 'Achat'], ['transport', 'Transport'], ['mo', 'Main-d’œuvre'], ['divers', 'Divers']];

const ligneReglage = (cle, titre, sous) => html`<button class="ligne" data-ed="${cle}">
  <span class="ligne-corps"><span class="ligne-titre">${titre}</span><span class="ligne-sous">${sous}</span></span>${ico('chevron', 'chev')}</button>`;

export async function vueReglages(vue) {
  const { params, kit, budget } = etat;
  const b = budgetLatrine(params, budget);
  const c = params.contrat;
  const marge2 = Boolean(params.options?.marge2);
  vue.innerHTML = html`
    <a class="retour" href="#/plus">${ico('back')} Plus</a>
    <div class="titre-vue"><div><span class="sur">Tout est modifiable</span><h1>Réglages</h1></div></div>

    <div class="etiquette">Ma TPE <a href="#" data-ed="tpe">Modifier</a></div>
    <div class="carte" style="display:flex;gap:14px;align-items:flex-start">
      ${raw(pastilleLogo(params.tpe, 'logo-tpe grand'))}
      <dl class="infos" style="flex:1">
        <dt>Nom</dt><dd>${params.tpe.nom}</dd><dt>Gérant(e)</dt><dd>${params.tpe.gerant}</dd>
        <dt>Mobile Money</dt><dd>${params.tpe.momo ? `${params.tpe.reseauMomo} ${params.tpe.momo}` : '—'}</dd>
      </dl>
    </div>

    <div class="etiquette">ONG & contrat <a href="#" data-ed="contrat">Modifier</a></div>
    <div class="carte"><dl class="infos">
      <dt>ONG</dt><dd>${nomONG(params)}${c.sigle && c.commanditaire ? ` (${c.sigle})` : ''}</dd>
      <dt>Projet</dt><dd>${c.projet || '—'}</dd>
      <dt>Référence</dt><dd>${c.ref || '—'}</dd>
      <dt>Lot / village</dt><dd>${params.tpe.lot ? `Lot ${params.tpe.lot} · ` : ''}${params.tpe.village}${params.tpe.sousPrefecture ? ` (${params.tpe.sousPrefecture})` : ''}</dd>
      <dt>Prix par latrine</dt><dd>${fcfa(c.prixLatrine)}</dd>
      <dt>Avance / solde</dt><dd>${c.avancePct} % / ${100 - c.avancePct} % (sous ${c.delaiSolde} j)</dd>
      <dt>Latrines à faire</dt><dd>${c.totalLatrines}</dd>
      <dt>Objectif</dt><dd>${c.objectifSemaine} / semaine</dd>
      <dt>Démarrage</dt><dd>${dateFr(c.dateDebut)}</dd>
      <dt>Contrôleur</dt><dd>${c.controleur || '—'}</dd>
    </dl></div>

    <div class="etiquette">Achats</div>
    <div class="liste">
      ${raw(ligneReglage('kit', 'Kit de quincaillerie', `${kit.length} articles · ${fcfa(params.quincaillerie.prixKit)} / latrine · acompte ${params.quincaillerie.acomptePct} %`))}
      ${raw(ligneReglage('budget', 'Budget local par latrine', `Achats ${fcfa(b.achats)} · main-d’œuvre ${fcfa(b.mo)}`))}
    </div>
    <div class="carte plate" style="padding:8px 12px"><table class="tableau"><tbody>
      <tr><td>Prix payé par l’ONG</td><td class="d">${fcfa(b.prix)}</td></tr>
      <tr><td>− Kit</td><td class="d">${fcfa(b.kit)}</td></tr>
      <tr><td>− Achats locaux</td><td class="d">${fcfa(b.achats)}</td></tr>
      <tr><td>− Main-d’œuvre</td><td class="d">${fcfa(b.mo)}</td></tr>
      <tr class="total"><td>${marge2 ? 'Marge 1 (officielle)' : 'Marge prévue'} / latrine</td><td class="d ${b.marge >= 0 ? 'ecart-pos' : 'ecart-neg'}">${fcfa(b.marge)}</td></tr>
      ${raw(marge2 ? html`<tr><td>🔒 Marge 2 (prix terrain)</td><td class="d ${b.marge2 >= 0 ? 'ecart-pos' : 'ecart-neg'}">${fcfa(b.marge2)}</td></tr>` : '')}
    </tbody></table></div>

    <div class="etiquette">Options</div>
    <label class="carte coche interrupteur">
      <input type="checkbox" id="opt-marge2" ${marge2 ? 'checked' : ''}>
      <span class="coche-txt"><strong>Marge personnelle (Marge 2)</strong>
        <small>Ajoute un « prix terrain » à côté de chaque prix de base, pour suivre ce que tu gagnes vraiment. Visible seulement sur ce téléphone : jamais dans les rapports, factures, partages WhatsApp ou exports. Laisse désactivé si tu n’as de comptes à rendre à personne.</small></span>
    </label>

    <div class="etiquette">Chantier</div>
    <div class="liste">
      ${raw(ligneReglage('etapes', 'Étapes des travaux', `${ETAPES.length} étapes : ${ETAPES.map((e) => e.court).join(', ')}`))}
      ${raw(Object.entries(CONTROLES).map(([k, ctl]) => ligneReglage(`qc-${k}`, ctl.titre, `Contrôle qualité · ${ctl.points.length} points`)).join(''))}
      ${raw(ligneReglage('types', 'Types de latrines', Object.values(TYPES_LATRINE).map((t) => t.split(' — ')[0]).join(', ')))}
      ${raw(ligneReglage('interfaces', 'Interfaces WC', INTERFACES_WC.join(', ')))}
    </div>
    <button class="btn btn-danger btn-bloc" id="defauts" style="margin-top:14px">Rétablir le modèle PASEA (kit, budget, étapes, contrôles)</button>`;

  const editeurs = {
    tpe: editTPE, contrat: editContrat, kit: editKit, budget: editBudget, etapes: editEtapes, types: editTypes, interfaces: editInterfaces,
  };
  $$('[data-ed]', vue).forEach((a) => (a.onclick = (e) => {
    e.preventDefault();
    const cle = a.dataset.ed;
    if (cle.startsWith('qc-')) editControle(cle.slice(3));
    else editeurs[cle]();
  }));
  $('#opt-marge2', vue).onchange = async (e) => {
    await sauverParams({ ...etat.params, options: { ...etat.params.options, marge2: e.target.checked } });
    toast(e.target.checked ? 'Marge 2 activée : saisis tes prix terrain dans Budget et Kit' : 'Marge 2 désactivée');
    rafraichir();
  };
  $('#defauts', vue).onclick = async () => {
    if (!(await confirmer('Remplacer le kit, le budget, les étapes et les contrôles qualité par le modèle PASEA d’origine ?', 'Rétablir'))) return;
    await sauverKit(structuredClone(KIT_DEFAUT));
    await sauverBudget(structuredClone(BUDGET_DEFAUT));
    await sauverReferentiel(structuredClone(REFERENTIEL_DEFAUT));
    toast('Modèle PASEA rétabli');
    rafraichir();
  };
}

const apres = async (params, msg) => {
  await sauverParams(params);
  await marquerConfigure();
  toast(msg);
  rafraichir();
};

function editTPE() {
  feuille({
    titre: 'Ma TPE',
    corps: champsTPE(etat.params.tpe),
    onOuvert: (form) => brancherLogo(form),
    onValider: (d) => apres(appliquerProfil(etat.params, d), 'TPE mise à jour'),
  });
}

function editContrat() {
  feuille({
    titre: 'ONG & contrat',
    corps: champsContrat(etat.params.contrat, etat.params.tpe),
    onValider: (d) => apres(appliquerProfil(etat.params, d), 'Contrat mis à jour'),
  });
}

// ---------- Éditeur de listes générique ----------

/**
 * Lignes modifiables. `colonnes` : [{ cle, label, type?, largeur?, options? }] — la première colonne est le nom.
 * Avec 3 colonnes ou plus, le nom prend toute la largeur et les autres champs passent dessous.
 * `ordonnable` ajoute un bouton pour remonter une ligne.
 */
function lignesHtml(items, colonnes, ordonnable) {
  const large = colonnes.length > 2;
  const autres = colonnes.slice(1).map((c) => (large ? '1fr' : c.largeur || '90px')).join(' ');
  const grille = `${large ? '' : '1fr '}${autres} ${ordonnable ? '36px ' : ''}36px`;
  const controle = (c, it, i) => (c.options
    ? select(`${c.cle}_${i}`, c.options, it[c.cle])
    : input(`${c.cle}_${i}`, it[c.cle], { type: c.type || 'text', placeholder: c.placeholder, vide: c.vide }));
  return items.map((it, i) => `<div class="deux ligne-edit${large ? ' large' : ''}" data-ligne style="grid-template-columns:${grille};align-items:end;gap:6px">
      ${colonnes.map((c, k) => {
        const bloc = champ(i === 0 || (large && k === 0) ? c.label : '', controle(c, it, i));
        return large && k === 0 ? bloc.replace('<label class="champ"', '<label class="champ" style="grid-column:1/-1;margin-bottom:6px"') : bloc;
      }).join('')}
      ${ordonnable ? `<button type="button" class="btn-ico" data-monter="${i}" style="margin-bottom:16px" aria-label="Monter" ${i === 0 ? 'disabled' : ''}>↑</button>` : ''}
      <button type="button" class="btn-ico danger" data-retirer="${i}" style="margin-bottom:16px" aria-label="Retirer">${ico('trash').v}</button>
    </div>`).join('');
}

function editeurLignes({ titre, items, colonnes, entete = '', ordonnable = false, nouveau, onSave }) {
  let liste = items.map((x) => ({ ...x }));
  feuille({
    titre,
    corps: `${entete}<div id="lignes"></div>
      <button type="button" class="btn btn-bloc" id="ajout-ligne">${ico('plus').v} Ajouter une ligne</button>`,
    onOuvert: (form) => {
      const relire = () => {
        liste = $$('[data-ligne]', form).map((_, i) => ({
          ...liste[i],
          ...Object.fromEntries(colonnes.map((c) => {
            const v = form.elements[`${c.cle}_${i}`].value;
            if (c.vide && v.trim() === '') return [c.cle, ''];
            if (c.type === 'money') return [c.cle, lireMontant(v) || 0];
            return [c.cle, c.type === 'number' ? Number(String(v).replace(/\s/g, '').replace(',', '.')) || 0 : v.trim()];
          })),
        }));
      };
      const dessiner = () => {
        $('#lignes', form).innerHTML = lignesHtml(liste, colonnes, ordonnable);
        $$('[data-retirer]', form).forEach((b) => (b.onclick = () => {
          relire();
          liste = liste.filter((_, i) => i !== Number(b.dataset.retirer));
          dessiner();
        }));
        $$('[data-monter]', form).forEach((b) => (b.onclick = () => {
          relire();
          const i = Number(b.dataset.monter);
          liste = [...liste.slice(0, i - 1), liste[i], liste[i - 1], ...liste.slice(i + 1)];
          dessiner();
        }));
      };
      dessiner();
      $('#ajout-ligne', form).onclick = () => {
        relire();
        liste = [...liste, { id: uid(), ...nouveau }];
        dessiner();
        const champs = $$('[data-ligne] input', form);
        champs[champs.length - colonnes.length]?.focus();
      };
      form.relire = () => { relire(); return liste; };
    },
    onValider: async (d, form) => {
      const propres = form.relire().filter((x) => x[colonnes[0].cle]);
      if (!propres.length) { toast('Garde au moins une ligne', 'err'); return false; }
      return onSave(propres, d);
    },
  });
}

function editKit() {
  editeurLignes({
    titre: 'Kit de quincaillerie',
    items: etat.kit,
    colonnes: [{ cle: 'nom', label: 'Article' }, { cle: 'qte', label: 'Qté/kit', type: 'number', largeur: '76px' }],
    entete: `${champsQuincaillerie(etat.params.quincaillerie, Boolean(etat.params.options?.marge2))}<div class="etiquette" style="margin-top:4px">Articles pour une latrine</div>`,
    nouveau: { nom: '', qte: 1, unite: 'u' },
    onSave: async (liste, d) => {
      await sauverKit(liste);
      await apres(appliquerProfil(etat.params, d), 'Kit mis à jour');
    },
  });
}

function editBudget() {
  const marge2 = Boolean(etat.params.options?.marge2);
  editeurLignes({
    titre: 'Budget local par latrine',
    items: etat.budget,
    colonnes: [
      { cle: 'nom', label: 'Poste' },
      { cle: 'montant', label: marge2 ? 'Prix de base' : 'Montant (F)', type: 'money' },
      ...(marge2 ? [{ cle: 'montantTerrain', label: '🔒 Prix terrain', type: 'money', vide: true, placeholder: '= base' }] : []),
      { cle: 'cat', label: 'Catégorie', options: CATEGORIES_BUDGET },
    ],
    entete: `<p class="note">Dépenses prévues pour UNE latrine, hors kit de quincaillerie (main-d’œuvre, sable, gravier, transport…).${marge2
      ? '<br><strong>Prix de base</strong> = Marge 1, celle des rapports. <strong>Prix terrain</strong> = ce que tu paies vraiment (Marge 2, personnelle). Laisse vide si c’est le même prix.'
      : ''}</p><div style="height:12px"></div>`,
    nouveau: { nom: '', montant: 0, cat: 'materiaux' },
    onSave: async (liste) => {
      await sauverBudget(liste);
      toast('Budget mis à jour');
      rafraichir();
    },
  });
}

async function majReferentiel(changement, msg) {
  await sauverReferentiel({ ...referentielActuel(), ...changement });
  toast(msg);
  rafraichir();
}

function editEtapes() {
  editeurLignes({
    titre: 'Étapes des travaux',
    items: ETAPES,
    colonnes: [{ cle: 'nom', label: 'Étape' }, { cle: 'court', label: 'Nom court', largeur: '92px' }],
    entete: '<p class="note">Dans l’ordre du chantier. La latrine est « achevée » quand toutes les étapes sont cochées. Le nom court s’affiche dans le rapport du jour.</p><div style="height:12px"></div>',
    ordonnable: true,
    nouveau: { nom: '', court: '' },
    onSave: async (liste) => {
      const etapes = liste.map(({ id, nom, court }) => ({ id, nom, court }));
      const ajoutees = etapes.filter((e) => !ETAPES.some((o) => o.id === e.id)).map((e) => e.id);
      const achevees = etat.latrines.map((l) => ({ l, fin: dateAchevement(l) })).filter((x) => x.fin);
      if (ajoutees.length && achevees.length && await confirmer(
        `${achevees.length} latrine(s) sont déjà achevées. Marquer la ou les nouvelles étapes comme faites pour elles ? Sinon elles repasseront « en cours ».`,
        'Marquer faites',
      )) {
        for (const { l, fin } of achevees) {
          await enregistrer('latrines', { ...l, etapes: { ...l.etapes, ...Object.fromEntries(ajoutees.map((id) => [id, fin])) } });
        }
      }
      return majReferentiel({ etapes }, 'Étapes mises à jour');
    },
  });
}

function editControle(cle) {
  const ctl = CONTROLES[cle];
  editeurLignes({
    titre: 'Contrôle qualité',
    items: ctl.points,
    colonnes: [{ cle: 'nom', label: 'Point à vérifier' }],
    entete: html`${raw(champ('Nom de la visite', input('titreControle', ctl.titre, { required: true })))}<div class="etiquette" style="margin-top:4px">Points de contrôle</div>`,
    ordonnable: true,
    nouveau: { nom: '' },
    onSave: (liste, d) => majReferentiel({
      controles: { ...CONTROLES, [cle]: { titre: d.titreControle || ctl.titre, points: liste.map(({ id, nom }) => ({ id, nom })) } },
    }, 'Grille de contrôle mise à jour'),
  });
}

function editTypes() {
  editeurLignes({
    titre: 'Types de latrines',
    items: Object.entries(TYPES_LATRINE).map(([id, nom]) => ({ id, nom })),
    colonnes: [{ cle: 'nom', label: 'Type (ex. : Type E — Description)' }],
    entete: '<p class="note">Écris « Type X — description » : la partie avant le tiret s’affiche dans les listes.</p><div style="height:12px"></div>',
    ordonnable: true,
    nouveau: { nom: '' },
    onSave: (liste) => majReferentiel({ types: liste.map(({ id, nom }) => ({ id, nom })) }, 'Types mis à jour'),
  });
}

function editInterfaces() {
  editeurLignes({
    titre: 'Interfaces WC',
    items: INTERFACES_WC.map((nom) => ({ id: nom, nom })),
    colonnes: [{ cle: 'nom', label: 'Interface' }],
    ordonnable: true,
    nouveau: { nom: '' },
    onSave: (liste) => majReferentiel({ interfaces: liste.map((x) => x.nom) }, 'Interfaces mises à jour'),
  });
}

