// Tableau de bord + écran de premier démarrage.
import { etat, sauverParams, marquerConfigure, importerTout } from '../store.js';
import { html, raw, fcfa, num, todayISO, dateFr, lundiDe, ajouterJours, lireForm, toast, $ } from '../util.js';
import { ico } from '../ui.js';
import { champsTPE, champsContrat, champsQuincaillerie, appliquerProfil, brancherLogo } from './profil.js';
import {
  paiementsParLatrine, statut, compterStatuts, acheveesSemaine, cadence, finances, stock, alertes, budgetLatrine,
} from '../calc.js';
import { rafraichir } from '../app.js';

export async function vueAccueil(vue) {
  const { latrines, txs, commandes, params, kit, mouvements, journal } = etat;
  const jour = todayISO();
  const paie = paiementsParLatrine(txs);
  const c = compterStatuts(latrines, paie, params);
  const total = Number(params.contrat.totalLatrines) || latrines.length;
  const faites = c.achevee + c.receptionnee + c.payee;
  const pct = total ? Math.round((faites / total) * 100) : 0;
  const sem = acheveesSemaine(latrines, jour).length;
  const objectif = Number(params.contrat.objectifSemaine) || 3;
  const cad = cadence(latrines, params, jour);
  const f = finances(txs, commandes, latrines, params);
  const st = stock(kit, commandes, latrines, mouvements);
  const al = alertes(etat, jour);
  const b = budgetLatrine(params, etat.budget);
  const marge2 = Boolean(params.options?.marge2);
  const rapportDuJour = journal.find((j) => j.date === jour);

  // Mur : une case par latrine prévue, colorée selon son statut.
  const ordre = ['payee', 'receptionnee', 'achevee', 'encours'];
  const cases = [];
  for (const s of ordre) for (let i = 0; i < c[s]; i += 1) cases.push(s);
  while (cases.length < total) cases.push('planifiee');

  const creneaux = Array.from({ length: Math.max(objectif, sem) }, (_, i) =>
    `<i class="${i < Math.min(sem, objectif) ? 'ok' : i < sem ? 'ok bonus' : ''}"></i>`).join('');
  const finSemaine = ajouterJours(lundiDe(jour), 6);

  vue.innerHTML = html`
    <section class="hero" aria-label="Avancement global">
      <div class="hero-haut">
        <div>
          <div class="sur">Latrines achevées</div>
          <div class="hero-chiffre">${faites}<small> / ${total}</small></div>
        </div>
        <div class="hero-pct">${pct} %</div>
      </div>
      <div class="mur" role="img" aria-label="${faites} latrines achevées sur ${total}">${raw(cases.map((s) => `<i data-s="${s}"></i>`).join(''))}</div>
      <div class="legende">
        <span><i style="background:var(--orange)"></i>En cours ${c.encours}</span>
        <span><i style="background:#6FB2E0"></i>Achevées ${c.achevee}</span>
        <span><i style="background:#52D08F"></i>Réceptionnées ${c.receptionnee}</span>
        <span><i style="background:#fff"></i>Payées ${c.payee}</span>
      </div>
    </section>

    <section class="carte semaine" aria-label="Objectif de la semaine">
      <div class="creneaux">${raw(creneaux)}</div>
      <div class="semaine-txt">
        <strong>${sem} / ${objectif} cette semaine</strong>
        <span>${cad.semaines ? `Semaine ${cad.semaines} · ` : ''}jusqu’au ${dateFr(finSemaine)}${cad.retard ? ` · ${cad.retard} en retard` : ''}</span>
      </div>
    </section>

    <div class="actions-rapides">
      <a class="action principale" href="${rapportDuJour ? `#/rapport/${rapportDuJour.id}` : '#/journal/nouveau'}">
        <span class="pastille">${ico('journal')}</span>
        <span>${rapportDuJour ? 'Rapport du jour rempli' : 'Faire le rapport du jour'}<small>${dateFr(jour, true)}${rapportDuJour ? ' · voir / partager' : ' · travaux, équipe, matériaux'}</small></span>
      </a>
      <a class="action" href="#/argent/sortie"><span class="pastille">${ico('out')}</span>Dépense</a>
      <a class="action" href="#/argent/entree"><span class="pastille">${ico('in')}</span>Entrée</a>
      <a class="action" href="#/latrines/nouvelle"><span class="pastille">${ico('site')}</span>Latrine</a>
      <a class="action" href="#/stock"><span class="pastille">${ico('box')}</span>Kits</a>
    </div>

    ${raw(al.length ? html`<div class="etiquette">À faire / alertes <span>${al.length}</span></div>
      <div class="alertes">${raw(al.slice(0, 6).map((a) => html`<a class="alerte ${a.niveau}" href="${a.lien}">${ico(a.niveau === 'info' ? 'journal' : 'alert')}<span>${a.texte}</span></a>`).join(''))}</div>` : '')}

    <div class="etiquette">Argent <a href="#/argent">Détails</a></div>
    <div class="kpis">
      <a class="kpi accent ${f.caisse < 0 ? 'neg' : ''}" href="#/argent"><small>Caisse</small><span class="num">${fcfa(f.caisse)}</span><span class="sous">disponible</span></a>
      <a class="kpi" href="#/argent"><small>Reçu de l’ONG</small><span class="num">${fcfa(f.recuONG)}</span><span class="sous">attendu : ${fcfa(f.attenduONG)}</span></a>
      <a class="kpi ${f.detteQuincaillerie ? 'neg' : ''}" href="#/stock"><small>Dû quincaillerie</small><span class="num">${fcfa(f.detteQuincaillerie)}</span><span class="sous">sur ${fcfa(f.commandeQuincaillerie)}</span></a>
      <a class="kpi" href="#/stock"><small>Kits en stock</small><span class="num">${num(st.kitsDispo)}</span><span class="sous">${st.kitsEnAttente ? `${st.kitsEnAttente} à livrer` : `${st.kitsAffectes} affectés`}</span></a>
    </div>

    <div class="carte plate">
      <div class="etiquette" style="margin-top:0">Rentabilité prévue par latrine</div>
      <dl class="infos">
        <dt>Prix payé par l’ONG</dt><dd>${fcfa(b.prix)}</dd>
        <dt>Kit quincaillerie</dt><dd>− ${fcfa(b.kit)}</dd>
        <dt>Achats locaux</dt><dd>− ${fcfa(b.achats)}</dd>
        <dt>Main-d’œuvre</dt><dd>− ${fcfa(b.mo)}</dd>
        <dt><strong>${marge2 ? 'Marge 1 (officielle)' : 'Marge prévue'}</strong></dt><dd class="${b.marge >= 0 ? 'ecart-pos' : 'ecart-neg'}"><strong>${fcfa(b.marge)}</strong></dd>
        <dt>Sur ${total} latrines</dt><dd>${fcfa(b.marge * total)}</dd>
      </dl>
      ${raw(marge2 ? blocMarge2(b, total) : '')}
    </div>`;
}

/** Marge personnelle (prix terrain) : repliée par défaut, jamais reprise dans les rapports ni les partages. */
function blocMarge2(b, total) {
  return html`<details class="perso">
    <summary><span>🔒 Ma marge personnelle — Marge 2</span><small>Toucher pour afficher</small></summary>
    <dl class="infos">
      <dt>Kit obtenu</dt><dd>− ${fcfa(b.kitTerrain)}</dd>
      <dt>Achats locaux (terrain)</dt><dd>− ${fcfa(b.achatsTerrain)}</dd>
      <dt>Main-d’œuvre (terrain)</dt><dd>− ${fcfa(b.moTerrain)}</dd>
      <dt><strong>Marge 2</strong></dt><dd class="${b.marge2 >= 0 ? 'ecart-pos' : 'ecart-neg'}"><strong>${fcfa(b.marge2)}</strong></dd>
      <dt>Gain en plus / latrine</dt><dd class="${b.gainTerrain >= 0 ? 'ecart-pos' : 'ecart-neg'}">${b.gainTerrain >= 0 ? '+' : '−'} ${fcfa(Math.abs(b.gainTerrain))}</dd>
      <dt>Marge 2 sur ${total} latrines</dt><dd>${fcfa(b.marge2 * total)}</dd>
    </dl>
    <p class="aide">Visible seulement ici. Les rapports, factures et partages n’affichent que la Marge 1.</p>
  </details>`;
}

// ---------- Premier démarrage ----------

export async function vueBienvenue(vue) {
  const p = etat.params;
  vue.innerHTML = html`
    <div class="bienvenue">
      <img src="icons/icon-512.png" alt="">
      <h1>Bienvenue sur ton carnet de chantier</h1>
      <p>Rapports journaliers, latrines, équipe, achats, kits de quincaillerie et argent — tout fonctionne sans internet. Renseigne ta TPE et ton contrat pour commencer.</p>
    </div>
    <form id="form-init" novalidate>
      <div class="groupe"><h4>1 · Ta TPE</h4>${raw(champsTPE(p.tpe))}</div>
      <div class="groupe"><h4>2 · Ton contrat avec l’ONG</h4>
        <p class="note" style="margin:0 0 14px">Les chiffres du modèle PASEA Hambol sont pré-remplis. Modifie-les si ton contrat est différent.</p>
        ${raw(champsContrat(p.contrat, p.tpe))}</div>
      <div class="groupe"><h4>3 · Quincaillerie</h4>${raw(champsQuincaillerie(p.quincaillerie))}
        <small class="aide" style="margin:-6px 0 14px">La liste des articles du kit se modifie ensuite dans Réglages.</small></div>
      <button class="btn btn-plein btn-bloc" type="submit">Commencer</button>
    </form>
    <div class="carte plate" style="text-align:center">
      <p style="margin:0 0 10px;color:var(--encre-2)">Tu as déjà utilisé l’application sur un autre téléphone ?</p>
      <label class="btn btn-bloc">${ico('save')} Restaurer une sauvegarde<input type="file" accept=".json,application/json" hidden id="restaurer"></label>
    </div>
    <p class="aide" style="text-align:center">Une application Vision Noble · tes données restent dans ton téléphone</p>`;

  const form = $('#form-init');
  brancherLogo(form);
  form.onsubmit = async (e) => {
    e.preventDefault();
    const manquant = [...form.querySelectorAll('[required]')].find((x) => !x.value.trim());
    if (manquant) {
      manquant.focus();
      return toast('Remplis les champs obligatoires', 'err');
    }
    const d = lireForm(form);
    if (!(d.totalLatrines > 0)) return toast('Indique le nombre de latrines à construire', 'err');
    await sauverParams(appliquerProfil(p, d));
    await marquerConfigure();
    toast('C’est parti !');
    location.hash = '#/';
    rafraichir();
  };

  $('#restaurer').onchange = async (e) => {
    const fichier = e.target.files[0];
    e.target.value = '';
    if (!fichier) return;
    try {
      await importerTout(await fichier.text());
      await marquerConfigure();
      toast('Sauvegarde restaurée');
      rafraichir();
    } catch (err) {
      toast(err.message, 'err');
    }
  };
}
