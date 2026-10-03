// Calculs purs (sans DOM ni stockage) : statuts, finances, stock, alertes.
import { ETAPES, partAvance } from './data.js';
import { lundiDe, ajouterJours, joursEntre, dateFr } from './util.js';

export const STATUTS = {
  planifiee: { nom: 'À démarrer', ordre: 0 },
  encours: { nom: 'En cours', ordre: 1 },
  achevee: { nom: 'Achevée', ordre: 2 },
  receptionnee: { nom: 'Réceptionnée', ordre: 3 },
  payee: { nom: 'Payée', ordre: 4 },
};

const somme = (list, f = (x) => x) => list.reduce((s, x) => s + (Number(f(x)) || 0), 0);

/** Ids des points de contrôle cochés qui existent encore dans la grille en vigueur. */
export function pointsConformes(controle, resultat = {}) {
  const coches = new Set(resultat.points || []);
  return controle.points.filter((pt) => coches.has(pt.id)).map((pt) => pt.id);
}

export function etapesFaites(lat) {
  return ETAPES.filter((e) => lat.etapes && lat.etapes[e.id]).length;
}

export function progression(lat) {
  return etapesFaites(lat) / ETAPES.length;
}

/** Date d'achèvement = date de la dernière étape (essais), si toutes les étapes sont faites. */
export function dateAchevement(lat) {
  if (!ETAPES.length || etapesFaites(lat) < ETAPES.length) return null;
  // Seules les étapes en vigueur comptent (une étape supprimée des Réglages est ignorée).
  return ETAPES.map((e) => lat.etapes[e.id]).sort().at(-1);
}

/** Répartit les paiements de l'ONG (avance / solde) sur les latrines concernées. */
export function paiementsParLatrine(txs) {
  const map = {};
  for (const t of txs) {
    if (t.sens !== 'in' || !['avance', 'solde'].includes(t.cat)) continue;
    const ids = t.latrineIds || [];
    if (!ids.length) continue;
    const part = (Number(t.montant) || 0) / ids.length;
    for (const id of ids) {
      map[id] = map[id] || { avance: 0, solde: 0 };
      map[id][t.cat] += part;
    }
  }
  return map;
}

/**
 * Montant d'un paiement de l'ONG : avance (50 %) ou solde (50 %) pour `nb` latrines.
 * Ex. : avance d'un ordre de service de 3 latrines = 3 × 325 000 × 50 % = 487 500 F.
 */
export function montantONG(cat, nb, params) {
  const prix = Number(params.contrat.prixLatrine) || 0;
  const pct = partAvance(params);
  const part = cat === 'solde' ? 1 - pct : pct;
  return Math.round(nb * prix * part);
}

export function statut(lat, paie = {}, params) {
  const p = paie[lat.id];
  const prix = params?.contrat?.prixLatrine || 0;
  if (lat.pvSigne && p && prix && p.avance + p.solde >= prix - 1) return 'payee';
  if (lat.pvSigne) return 'receptionnee';
  if (etapesFaites(lat) === ETAPES.length) return 'achevee';
  if (etapesFaites(lat) > 0) return 'encours';
  return 'planifiee';
}

export function compterStatuts(latrines, paie, params) {
  const c = { planifiee: 0, encours: 0, achevee: 0, receptionnee: 0, payee: 0 };
  for (const l of latrines) c[statut(l, paie, params)] += 1;
  return c;
}

/** Latrines achevées dans la semaine (lundi→dimanche) contenant `jour`. */
export function acheveesSemaine(latrines, jour) {
  const debut = lundiDe(jour);
  const fin = ajouterJours(debut, 6);
  return latrines.filter((l) => {
    const d = dateAchevement(l);
    return d && d >= debut && d <= fin;
  });
}

/** Cadence contractuelle : latrines attendues depuis le démarrage vs. réalisées. */
export function cadence(latrines, params, jour) {
  const debut = params.contrat.dateDebut;
  const objectif = Number(params.contrat.objectifSemaine) || 3;
  const faites = latrines.filter((l) => dateAchevement(l)).length;
  if (!debut || jour < debut) return { semaines: 0, attendues: 0, faites, retard: 0 };
  const semaines = Math.floor(joursEntre(lundiDe(debut), jour) / 7) + 1;
  const attendues = Math.min(semaines * objectif, Number(params.contrat.totalLatrines) || Infinity);
  return { semaines, attendues, faites, retard: Math.max(0, attendues - faites) };
}

export function finances(txs, commandes, latrines, params) {
  const entrees = somme(txs.filter((t) => t.sens === 'in'), (t) => t.montant);
  const sorties = somme(txs.filter((t) => t.sens === 'out'), (t) => t.montant);
  const parCat = {};
  for (const t of txs) parCat[t.cat] = (parCat[t.cat] || 0) + (Number(t.montant) || 0);

  const recuONG = (parCat.avance || 0) + (parCat.solde || 0);
  const prix = Number(params.contrat.prixLatrine) || 0;
  const pctAvance = partAvance(params);
  const paie = paiementsParLatrine(txs);

  // Ce que l'ONG doit encore : avances des latrines démarrées + soldes des latrines réceptionnées.
  let attenduONG = 0;
  for (const l of latrines) {
    const p = paie[l.id] || { avance: 0, solde: 0 };
    const s = statut(l, paie, params);
    if (s === 'planifiee') continue;
    const du = s === 'receptionnee' || s === 'payee' ? prix : prix * pctAvance;
    attenduONG += Math.max(0, du - p.avance - p.solde);
  }

  const commande = somme(commandes, (c) => c.montant);
  const payeQuinc = parCat.quincaillerie || 0;

  return {
    entrees,
    sorties,
    caisse: entrees - sorties,
    parCat,
    recuONG,
    attenduONG,
    detteQuincaillerie: Math.max(0, commande - payeQuinc),
    commandeQuincaillerie: commande,
    payeQuincaillerie: payeQuinc,
  };
}

/** Prix terrain d'une ligne : le prix réellement obtenu, ou le prix de base s'il n'a pas été saisi. */
const terrain = (valeur, base) => (valeur === '' || valeur === null || valeur === undefined ? Number(base) || 0 : Number(valeur) || 0);

/**
 * Budget d'une latrine : kit, achats locaux et main-d'œuvre séparés.
 * - Marge 1 (`marge`) : avec les prix de base — la marge officielle, celle des rapports.
 * - Marge 2 (`marge2`) : avec les prix terrain réellement obtenus — usage personnel uniquement.
 */
export function budgetLatrine(params, budgetLocal) {
  const prix = Number(params.contrat.prixLatrine) || 0;
  const kit = Number(params.quincaillerie.prixKit) || 0;
  const estMO = (b) => b.cat === 'mo';
  const mo = somme(budgetLocal.filter(estMO), (b) => b.montant);
  const achats = somme(budgetLocal.filter((b) => !estMO(b)), (b) => b.montant);
  const local = achats + mo;

  const kitTerrain = terrain(params.quincaillerie.prixKitTerrain, kit);
  const moTerrain = somme(budgetLocal.filter(estMO), (b) => terrain(b.montantTerrain, b.montant));
  const achatsTerrain = somme(budgetLocal.filter((b) => !estMO(b)), (b) => terrain(b.montantTerrain, b.montant));
  const marge = prix - kit - local;
  const marge2 = prix - kitTerrain - achatsTerrain - moTerrain;

  return {
    prix, kit, achats, mo, local, cout: kit + local, marge,
    kitTerrain, achatsTerrain, moTerrain, coutTerrain: kitTerrain + achatsTerrain + moTerrain, marge2, gainTerrain: marge2 - marge,
  };
}

/**
 * Situation « officielle » pour un mandataire : uniquement les prix de base du budget et du contrat.
 * Ni caisse, ni dépenses réelles, ni prix terrain (Marge 2).
 */
export function situationOfficielle(latrines, txs, params, budgetLocal) {
  const paie = paiementsParLatrine(txs);
  const c = compterStatuts(latrines, paie, params);
  const b = budgetLatrine(params, budgetLocal);
  const f = finances(txs, [], latrines, params);
  const demarrees = latrines.length - c.planifiee;
  const achevees = c.achevee + c.receptionnee + c.payee;
  return {
    statuts: c,
    prix: b.prix, kit: b.kit, achats: b.achats, mo: b.mo, cout: b.cout, marge: b.marge,
    demarrees,
    achevees,
    avancesRecues: f.parCat.avance || 0,
    soldesRecus: f.parCat.solde || 0,
    recu: f.recuONG,
    attendu: f.attenduONG,
    valeurAchevee: achevees * b.prix,
    coutAchevee: achevees * b.cout,
    margeAchevee: achevees * b.marge,
    coutEngage: demarrees * b.cout,
  };
}

/** Stock par article : entrées (kits livrés + entrées manuelles) − sorties (kits affectés + sorties manuelles). */
export function stock(kit, commandes, latrines, mouvements) {
  const kitsLivres = somme(commandes.filter((c) => c.livre), (c) => c.nbKits);
  const kitsAffectes = latrines.filter((l) => l.kitAffecte).length;
  const articles = kit.map((a) => {
    const entreesMan = somme(mouvements.filter((m) => m.article === a.id && m.sens === 'in'), (m) => m.qte);
    const sortiesMan = somme(mouvements.filter((m) => m.article === a.id && m.sens === 'out'), (m) => m.qte);
    const recu = kitsLivres * a.qte + entreesMan;
    const sorti = kitsAffectes * a.qte + sortiesMan;
    return { ...a, recu, sorti, dispo: recu - sorti, bas: recu - sorti < a.qte };
  });
  const kitsCommandes = somme(commandes, (c) => c.nbKits);
  return {
    kitsCommandes,
    kitsLivres,
    kitsAffectes,
    kitsDispo: kitsLivres - kitsAffectes,
    kitsEnAttente: kitsCommandes - kitsLivres,
    articles,
  };
}

/** Ce qui est dû à chaque ouvrier selon son mode de rémunération, et ce qui a été payé. */
export function comptesOuvriers(workers, journal, latrines, txs) {
  const achevees = new Set(latrines.filter((l) => dateAchevement(l)).map((l) => l.id));
  return workers.map((w) => {
    const jours = journal.filter((j) => (j.presents || []).includes(w.id));
    // Jours distincts : deux rapports le même jour ne paient pas deux journées.
    const nbJours = new Set(jours.map((j) => j.date)).size;
    let du = 0;
    if (w.mode === 'jour') du = nbJours * (Number(w.tarif) || 0);
    else {
      const sites = new Set();
      jours.forEach((j) => (j.latrineIds || []).forEach((id) => achevees.has(id) && sites.add(id)));
      du = sites.size * (Number(w.tarif) || 0);
    }
    const paye = somme(txs.filter((t) => t.sens === 'out' && t.workerId === w.id), (t) => t.montant);
    return { ...w, jours: nbJours, du, paye, reste: du - paye };
  });
}

/** Jours ouvrables (lun→ven) ajoutés à une date. */
export function plusJoursOuvrables(iso, n) {
  let d = iso;
  let reste = n;
  while (reste > 0) {
    d = ajouterJours(d, 1);
    const jour = new Date(`${d}T12:00:00`).getDay();
    if (jour !== 0 && jour !== 6) reste -= 1;
  }
  return d;
}

export function alertes(etat, jour) {
  const { latrines, journal, txs, commandes, params, kit, mouvements, derniereSauvegarde } = etat;
  const paie = paiementsParLatrine(txs);
  const out = [];

  for (const l of latrines) {
    for (const d of l.defauts || []) {
      if (d.corrigeLe) continue;
      const limite = plusJoursOuvrables(d.date, d.gravite === 'majeur' ? 5 : 2);
      out.push({
        niveau: jour > limite ? 'rouge' : 'orange',
        texte: `Défaut ${d.gravite} — latrine ${l.num} (${l.menage || 'ménage ?'}) : à corriger avant le ${dateFr(limite)}`,
        lien: `#/latrine/${l.id}`,
      });
    }
    const s = statut(l, paie, params);
    const fin = dateAchevement(l);
    if (s === 'achevee' && fin && joursEntre(fin, jour) >= 3) {
      out.push({ niveau: 'orange', texte: `Latrine ${l.num} achevée le ${dateFr(fin)} : demander la réception / PV tripartite`, lien: `#/latrine/${l.id}` });
    }
    if (s === 'receptionnee' && l.dateReception && jour > plusJoursOuvrables(l.dateReception, Number(params.contrat.delaiSolde) || 5)) {
      out.push({ niveau: 'rouge', texte: `Solde de l’ONG en retard pour la latrine ${l.num} (PV du ${dateFr(l.dateReception)})`, lien: `#/latrine/${l.id}` });
    }
  }

  const c = cadence(latrines, params, jour);
  if (c.retard > 0) {
    out.push({ niveau: c.retard >= 6 ? 'rouge' : 'orange', texte: `Retard de cadence : ${c.faites} latrines achevées pour ${c.attendues} attendues (${c.retard} en retard)`, lien: '#/latrines' });
  }

  const st = stock(kit, commandes, latrines, mouvements);
  const sansKit = latrines.filter((l) => !l.kitAffecte && etapesFaites(l) > 0).length;
  if (st.kitsDispo < 0) {
    out.push({ niveau: 'rouge', texte: `${-st.kitsDispo} kit(s) affecté(s) de plus que livrés : vérifie les livraisons de la quincaillerie`, lien: '#/stock' });
  } else if (sansKit > st.kitsDispo) {
    out.push({ niveau: 'orange', texte: `${sansKit} latrine(s) en cours sans kit, seulement ${st.kitsDispo} kit(s) en stock : commande des kits`, lien: '#/stock' });
  }

  const f = finances(txs, commandes, latrines, params);
  if (f.caisse < 0) out.push({ niveau: 'rouge', texte: `Caisse négative : il manque des entrées enregistrées`, lien: '#/argent' });

  const actifs = latrines.some((l) => statut(l, paie, params) === 'encours');
  const jourSemaine = new Date(`${jour}T12:00:00`).getDay();
  if (actifs && jourSemaine !== 0 && !journal.some((j) => j.date === jour)) {
    out.push({ niveau: 'info', texte: `Rapport du jour pas encore rempli`, lien: '#/journal/nouveau' });
  }

  if (latrines.length && (!derniereSauvegarde || joursEntre(derniereSauvegarde.slice(0, 10), jour) >= 7)) {
    out.push({ niveau: 'orange', texte: `Pas de sauvegarde depuis plus de 7 jours`, lien: '#/sauvegarde' });
  }

  const ordre = { rouge: 0, orange: 1, info: 2 };
  return out.sort((a, b) => ordre[a.niveau] - ordre[b.niveau]);
}
