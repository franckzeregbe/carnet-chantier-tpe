// Équipe : ouvriers, présences (depuis le journal), sommes dues et payées.
import { etat, enregistrer, supprimer } from '../store.js';
import { html, raw, fcfa, toast, $$ } from '../util.js';
import { ico, champ, input, select, segment, feuille, vide } from '../ui.js';
import { ROLES } from '../data.js';
import { comptesOuvriers } from '../calc.js';
import { rafraichir } from '../app.js';
import { formTransaction } from './argent.js';

export async function vueEquipe(vue) {
  const comptes = comptesOuvriers(etat.workers, etat.journal, etat.latrines, etat.txs);
  const totalReste = comptes.reduce((s, c) => s + Math.max(0, c.reste), 0);

  vue.innerHTML = html`
    <a class="retour" href="#/plus">${ico('back')} Plus</a>
    <div class="titre-vue">
      <div><span class="sur">${comptes.length} personne(s)</span><h1>Équipe</h1></div>
      <button class="btn-ajout" id="ajout" aria-label="Ajouter un ouvrier">${ico('plus')}</button>
    </div>
    <div class="kpis">
      <div class="kpi"><small>Payé à l’équipe</small><span class="num">${fcfa(comptes.reduce((s, c) => s + c.paye, 0))}</span></div>
      <div class="kpi ${totalReste ? 'neg' : 'pos'}"><small>Reste à payer</small><span class="num">${fcfa(totalReste)}</span></div>
    </div>
    <p class="note">Les sommes dues se calculent avec le journal : <strong>par jour</strong> = jours de présence × tarif ; <strong>par latrine</strong> = latrines achevées où l’ouvrier était présent × tarif.</p>
    ${raw(comptes.length
      ? `<div class="liste">${comptes.map((c) => html`<div class="ligne">
          <span class="badge-num">${c.nom.slice(0, 2).toUpperCase()}</span>
          <button class="ligne-corps" data-modif="${c.id}" style="background:none;border:0;text-align:left;padding:0;cursor:pointer">
            <span class="ligne-titre">${c.nom}${c.actif === false ? ' (inactif)' : ''}</span>
            <span class="ligne-sous">${c.role} · ${fcfa(c.tarif)} / ${c.mode === 'jour' ? 'jour' : 'latrine'} · ${c.jours} j. présent</span>
            <span class="ligne-sous">Dû ${fcfa(c.du)} · payé ${fcfa(c.paye)} · <b class="${c.reste > 0 ? 'ecart-neg' : 'ecart-pos'}">reste ${fcfa(c.reste)}</b></span>
          </button>
          <button class="btn btn-petit ${c.reste > 0 ? 'btn-navy' : ''}" data-payer="${c.id}">Payer</button>
        </div>`).join('')}</div>`
      : vide('Ajoute les membres de ton équipe : maçon, plombier, menuisier, puisatier…', '<button class="btn btn-plein" data-ajout>Ajouter un ouvrier</button>'))}`;

  $$('#ajout, [data-ajout]', vue).forEach((b) => (b.onclick = () => formOuvrier()));
  $$('[data-modif]', vue).forEach((b) => (b.onclick = () => formOuvrier(etat.workers.find((w) => w.id === b.dataset.modif))));
  $$('[data-payer]', vue).forEach((b) => (b.onclick = () => {
    const c = comptes.find((x) => x.id === b.dataset.payer);
    formTransaction({ sens: 'out', cat: 'mo', workerId: c.id, montant: Math.max(0, c.reste) || '', libelle: `Paiement ${c.nom}`, tiers: c.nom, mode: 'Espèces' });
  }));
}

function formOuvrier(w = null) {
  const x = w || { role: 'Maçon', mode: 'latrine', tarif: 20000, actif: true };
  feuille({
    titre: w ? w.nom : 'Nouvel ouvrier',
    corps: html`
      ${raw(champ('Nom et prénoms', input('nom', x.nom, { required: true })))}
      <div class="deux">
        ${raw(champ('Métier', select('role', ROLES, x.role)))}
        ${raw(champ('Téléphone', input('tel', x.tel, { type: 'tel' })))}
      </div>
      ${raw(champ('Payé', segment('mode', [['latrine', 'Par latrine'], ['jour', 'Par jour']], x.mode)))}
      ${raw(champ('Tarif (F)', input('tarif', x.tarif, { type: 'money' }), 'Repères DQE par latrine : maçon 20 000 · puisatier 15 000 · plombier 5 000 · menuisier 3 500'))}
      <label class="coche"><input type="checkbox" name="actif" ${x.actif !== false ? 'checked' : ''}><span class="coche-txt">Actif sur le chantier</span></label>`,
    supprimer: w ? async () => { await supprimer('workers', w.id); toast('Ouvrier retiré'); rafraichir(); } : null,
    onValider: async (d) => {
      await enregistrer('workers', { ...x, ...d });
      toast(w ? 'Fiche mise à jour' : `${d.nom} ajouté à l’équipe`);
      rafraichir();
    },
  });
}

