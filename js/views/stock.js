// Kits de la quincaillerie dédiée : commandes, livraisons, paiements, stock par article.
import { etat, enregistrer, supprimer } from '../store.js';
import { html, raw, fcfa, num, todayISO, dateFr, toast, $, $$ } from '../util.js';
import { ico, champ, input, select, textarea, segment, feuille, vide } from '../ui.js';
import { stock, finances } from '../calc.js';
import { partAcompte } from '../data.js';
import { rafraichir } from '../app.js';
import { formTransaction } from './argent.js';

const payeCommande = (c) =>
  etat.txs.filter((t) => t.commandeId === c.id && t.sens === 'out').reduce((s, t) => s + (Number(t.montant) || 0), 0);

export async function vueStock(vue) {
  const { kit, commandes, latrines, mouvements, params, txs } = etat;
  const st = stock(kit, commandes, latrines, mouvements);
  const f = finances(txs, commandes, latrines, params);
  const prixKit = Number(params.quincaillerie.prixKit) || 0;

  vue.innerHTML = html`
    <a class="retour" href="#/plus">${ico('back')} Plus</a>
    <div class="titre-vue">
      <div><span class="sur">${params.quincaillerie.nom || 'Quincaillerie dédiée'}</span><h1>Kits & stock</h1></div>
      <button class="btn-ajout" id="ajout" aria-label="Nouvelle commande">${ico('plus')}</button>
    </div>
    <div class="kpis">
      <div class="kpi accent"><small>Kits en stock</small><span class="num">${num(st.kitsDispo)}</span><span class="sous">prêts à affecter</span></div>
      <div class="kpi"><small>Kits livrés</small><span class="num">${num(st.kitsLivres)}</span><span class="sous">${st.kitsEnAttente} en attente</span></div>
      <div class="kpi"><small>Kits affectés</small><span class="num">${num(st.kitsAffectes)}</span><span class="sous">sortis sur chantier</span></div>
      <div class="kpi ${f.detteQuincaillerie ? 'neg' : 'pos'}"><small>Reste à payer</small><span class="num">${fcfa(f.detteQuincaillerie)}</span><span class="sous">payé ${fcfa(f.payeQuincaillerie)}</span></div>
    </div>

    <div class="etiquette">Commandes à la quincaillerie</div>
    ${raw(commandes.length
      ? `<div class="liste">${commandes.map((c) => {
        const paye = payeCommande(c);
        const reste = c.montant - paye;
        return html`<button class="ligne" data-cmd="${c.id}">
          <span class="badge-num">${c.nbKits}</span>
          <span class="ligne-corps"><span class="ligne-titre">${c.nbKits} kit(s) — ${fcfa(c.montant)}</span>
          <span class="ligne-sous">${dateFr(c.date)} · ${c.livre ? `livré${c.dateLivraison ? ` le ${dateFr(c.dateLivraison)}` : ''}` : 'en attente de livraison'}</span></span>
          <span class="ligne-fin">${raw(reste > 0 ? `<span class="statut encours">Reste ${fcfa(reste)}</span>` : '<span class="statut payee">Payé</span>')}</span></button>`;
      }).join('')}</div>`
      : vide('Aucune commande. Commande les kits par lot de 3 latrines (1 kit = 1 latrine).', '<button class="btn btn-plein" data-ajout>Nouvelle commande</button>'))}
    <p class="note">Protocole quincaillerie : la TPE paie <strong>${Math.round(partAcompte(params) * 100)} %</strong> à la commande, le solde après validation de la latrine. L’ONG garantit le paiement en cas de défaut.</p>

    <div class="etiquette">Stock par article <a href="#" id="mouvement">+ Entrée / sortie</a></div>
    <div class="carte plate defile" style="padding:6px 12px">
      <table class="tableau">
        <thead><tr><th>Article</th><th class="d">/kit</th><th class="d">Reçu</th><th class="d">Sorti</th><th class="d">Stock</th></tr></thead>
        <tbody>${raw(st.articles.map((a) => html`<tr><td>${a.nom}</td><td class="d">${a.qte}</td><td class="d">${num(a.recu)}</td><td class="d">${num(a.sorti)}</td><td class="d ${a.bas ? 'bas' : ''}">${num(a.dispo)}</td></tr>`).join(''))}</tbody>
      </table>
    </div>

    <div class="etiquette">Composition du kit <span>prix fixe ${fcfa(prixKit)} / latrine</span></div>
    <div class="carte plate"><p style="margin:0;color:var(--encre-2);font-size:14px">${kit.map((a) => `${a.qte} × ${a.nom}`).join(' · ')}</p>
      <a class="btn btn-petit" href="#/reglages" style="margin-top:12px">Modifier le kit et le prix</a></div>

    ${raw(mouvements.length ? html`<div class="etiquette">Mouvements manuels</div>
      <div class="liste">${raw(mouvements.map((m) => html`<button class="ligne" data-mvt="${m.id}">
        <span class="icone-rond ${m.sens}">${ico(m.sens === 'in' ? 'in' : 'out')}</span>
        <span class="ligne-corps"><span class="ligne-titre">${m.sens === 'in' ? '+' : '−'}${m.qte} ${kit.find((a) => a.id === m.article)?.nom || m.article}</span>
        <span class="ligne-sous">${dateFr(m.date)} · ${m.motif || ''}</span></span></button>`).join(''))}</div>` : '')}`;

  $$('#ajout, [data-ajout]', vue).forEach((b) => (b.onclick = () => formCommande()));
  $$('[data-cmd]', vue).forEach((b) => (b.onclick = () => formCommande(commandes.find((c) => c.id === b.dataset.cmd))));
  $('#mouvement', vue).onclick = (e) => { e.preventDefault(); formMouvement(); };
  $$('[data-mvt]', vue).forEach((b) => (b.onclick = () => formMouvement(mouvements.find((m) => m.id === b.dataset.mvt))));
}

function formCommande(c = null) {
  // Prix fixe arrêté avec la quincaillerie : il n'est pas modifiable à la commande.
  const prixKit = Number(etat.params.quincaillerie.prixKit) || 0;
  const x = c || { date: todayISO(), nbKits: 3, livre: false };
  const prix = c?.prixUnitaire ?? prixKit;
  const paye = c ? payeCommande(c) : 0;
  feuille({
    titre: c ? 'Commande de kits' : 'Nouvelle commande de kits',
    corps: html`
      <div class="deux">
        ${raw(champ('Nombre de kits', input('nbKits', x.nbKits, { type: 'number', required: true, min: 1 })))}
        <div class="champ"><span class="champ-label">Prix fixe d’un kit</span><div class="valeur-fixe">${fcfa(prix)}</div></div>
      </div>
      <p class="note" id="total-cmd"></p>
      <div style="height:12px"></div>
      ${raw(champ('Date de commande', input('date', x.date, { type: 'date' })))}
      <div class="groupe"><h4>Livraison</h4>
        <label class="coche"><input type="checkbox" name="livre" ${x.livre ? 'checked' : ''}><span class="coche-txt">Kits livrés et vérifiés<small>Les articles entrent dans le stock</small></span></label>
        <div class="deux" style="margin-top:10px">
          ${raw(champ('Date de livraison', input('dateLivraison', x.dateLivraison || todayISO(), { type: 'date' })))}
          ${raw(champ('N° bon de livraison', input('bonLivraison', x.bonLivraison)))}
        </div>
      </div>
      ${raw(champ('Note', textarea('note', x.note, 'Articles manquants, non conformes…', 2)))}
      ${raw(c ? html`<div class="carte plate"><dl class="infos"><dt>Payé</dt><dd>${fcfa(paye)}</dd><dt>Reste</dt><dd class="${c.montant - paye > 0 ? 'ecart-neg' : 'ecart-pos'}">${fcfa(c.montant - paye)}</dd></dl>
        ${raw(c.montant - paye > 0 ? `<button type="button" class="btn btn-navy btn-bloc" id="payer" style="margin-top:12px">${ico('out').v} Enregistrer un paiement</button>` : '')}</div>` : '')}`,
    supprimer: c ? async () => { await supprimer('commandes', c.id); toast('Commande supprimée'); rafraichir(); } : null,
    onOuvert: (form) => {
      const majTotal = () => {
        const n = Number(form.elements.nbKits.value) || 0;
        const acompte = Math.round(n * prix * partAcompte(etat.params));
        $('#total-cmd', form).innerHTML = `Total : <strong>${fcfa(n * prix)}</strong> · acompte ${Math.round(partAcompte(etat.params) * 100)} % : <strong>${fcfa(acompte)}</strong>`;
      };
      form.elements.nbKits.oninput = majTotal;
      majTotal();
      const btn = $('#payer', form);
      if (btn) btn.onclick = () => formTransaction({ sens: 'out', cat: 'quincaillerie', montant: c.montant - paye, commandeId: c.id, libelle: `Kits quincaillerie (${c.nbKits}) — ${paye ? 'solde' : 'acompte'}`, tiers: etat.params.quincaillerie.nom });
    },
    onValider: async (d) => {
      if (!(d.nbKits > 0)) { toast('Nombre de kits invalide', 'err'); return false; }
      const rec = await enregistrer('commandes', {
        ...x, ...d, prixUnitaire: prix, montant: d.nbKits * prix, dateLivraison: d.livre ? d.dateLivraison : '',
      });
      toast(c ? 'Commande mise à jour' : 'Commande enregistrée');
      rafraichir();
      if (!c) {
        const acompte = Math.round(rec.montant * partAcompte(etat.params));
        setTimeout(() => formTransaction({ sens: 'out', cat: 'quincaillerie', montant: acompte, commandeId: rec.id, libelle: `Kits quincaillerie (${rec.nbKits}) — acompte`, tiers: etat.params.quincaillerie.nom }), 250);
      }
    },
  });
}

function formMouvement(m = null) {
  const x = m || { date: todayISO(), sens: 'out', qte: 1 };
  feuille({
    titre: m ? 'Mouvement de stock' : 'Entrée / sortie de stock',
    corps: html`
      ${raw(champ('Sens', segment('sens', [['out', 'Sortie (perte, casse…)'], ['in', 'Entrée (achat hors kit…)']], x.sens)))}
      ${raw(champ('Article', select('article', etat.kit.map((a) => [a.id, a.nom]), x.article)))}
      <div class="deux">
        ${raw(champ('Quantité', input('qte', x.qte, { type: 'number', required: true })))}
        ${raw(champ('Date', input('date', x.date, { type: 'date' })))}
      </div>
      ${raw(champ('Motif', input('motif', x.motif, { placeholder: 'Ex. : sac de ciment mouillé, tôle abîmée…' })))}`,
    supprimer: m ? async () => { await supprimer('stock', m.id); toast('Mouvement supprimé'); rafraichir(); } : null,
    onValider: async (d) => {
      if (!(d.qte > 0)) { toast('Quantité invalide', 'err'); return false; }
      await enregistrer('stock', { ...x, ...d });
      toast('Stock mis à jour');
      rafraichir();
    },
  });
}
