// Tests des calculs métier (node --test).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  statut, paiementsParLatrine, montantONG, cadence, finances, stock, comptesOuvriers, plusJoursOuvrables, alertes,
  budgetLatrine, dateAchevement, acheveesSemaine, pointsConformes, compterStatuts, situationOfficielle,
} from '../js/calc.js';
import {
  PARAMS_DEFAUT, KIT_DEFAUT, BUDGET_DEFAUT, ETAPES, REFERENTIEL_DEFAUT, definirReferentiel, nomCourt, typeCourt,
} from '../js/data.js';

const params = (contrat = {}) => ({
  ...PARAMS_DEFAUT,
  tpe: { ...PARAMS_DEFAUT.tpe, nom: 'TPE Test' },
  contrat: { ...PARAMS_DEFAUT.contrat, totalLatrines: 30, ...contrat },
});

/** Latrine dont les `n` premières étapes sont faites à la date donnée. */
const latrine = (id, n = 0, date = '2026-10-01', extra = {}) => ({
  id, num: id, etapes: Object.fromEntries(ETAPES.slice(0, n).map((e) => [e.id, date])), ...extra,
});
const TOUTES = ETAPES.length;

describe('montantONG', () => {
  test('avance de 50 % pour un ordre de service de 3 latrines = 487 500 F', () => {
    assert.equal(montantONG('avance', 3, params()), 487500);
  });
  test('solde complémentaire de l’avance', () => {
    assert.equal(montantONG('solde', 3, params({ avancePct: 40 })), 3 * 325000 * 0.6);
  });
  test('suit le prix du contrat d’une autre ONG', () => {
    assert.equal(montantONG('avance', 2, params({ prixLatrine: 300000, avancePct: 40 })), 240000);
  });
});

describe('paiementsParLatrine', () => {
  test('répartit une avance entre les latrines cochées et ignore les autres opérations', () => {
    const txs = [
      { sens: 'in', cat: 'avance', montant: 487500, latrineIds: ['a', 'b', 'c'] },
      { sens: 'in', cat: 'solde', montant: 162500, latrineIds: ['a'] },
      { sens: 'out', cat: 'materiaux', montant: 9999, latrineIds: ['a'] },
      { sens: 'in', cat: 'apport', montant: 50000, latrineIds: ['a'] },
    ];
    const p = paiementsParLatrine(txs);
    assert.deepEqual(p.a, { avance: 162500, solde: 162500 });
    assert.deepEqual(p.b, { avance: 162500, solde: 0 });
  });
});

describe('statut', () => {
  const p = params();
  test('à démarrer, en cours, achevée', () => {
    assert.equal(statut(latrine('x', 0), {}, p), 'planifiee');
    assert.equal(statut(latrine('x', 3), {}, p), 'encours');
    assert.equal(statut(latrine('x', TOUTES), {}, p), 'achevee');
  });
  test('réceptionnée avec PV, payée quand avance + solde couvrent le prix', () => {
    const l = latrine('x', TOUTES, '2026-10-01', { pvSigne: true });
    assert.equal(statut(l, { x: { avance: 162500, solde: 0 } }, p), 'receptionnee');
    assert.equal(statut(l, { x: { avance: 162500, solde: 162500 } }, p), 'payee');
  });
  test('compterStatuts additionne chaque statut', () => {
    const c = compterStatuts([latrine('a'), latrine('b', 2), latrine('c', TOUTES)], {}, p);
    assert.deepEqual(c, { planifiee: 1, encours: 1, achevee: 1, receptionnee: 0, payee: 0 });
  });
});

describe('dates et cadence', () => {
  test('date d’achèvement = dernière étape, seulement si tout est fait', () => {
    const l = latrine('x', TOUTES, '2026-10-01');
    l.etapes[ETAPES.at(-1).id] = '2026-10-05';
    assert.equal(dateAchevement(l), '2026-10-05');
    assert.equal(dateAchevement(latrine('y', 2)), null);
  });
  test('une étape supprimée des réglages n’influence plus la date d’achèvement', () => {
    const l = latrine('x', TOUTES, '2026-10-01');
    l.etapes.ancienne = '2026-12-31';
    assert.equal(dateAchevement(l), '2026-10-01');
  });
  test('latrines achevées dans la semaine (lundi → dimanche)', () => {
    const l = [latrine('a', TOUTES, '2026-09-28'), latrine('b', TOUTES, '2026-10-04'), latrine('c', TOUTES, '2026-10-05')];
    assert.deepEqual(acheveesSemaine(l, '2026-10-01').map((x) => x.id), ['a', 'b']);
  });
  test('retard de cadence à 3 latrines par semaine', () => {
    const c = cadence([latrine('a', TOUTES)], params({ dateDebut: '2026-09-14' }), '2026-10-03');
    assert.deepEqual(c, { semaines: 3, attendues: 9, faites: 1, retard: 8 });
  });
  test('pas de retard avant la date de démarrage', () => {
    assert.equal(cadence([], params({ dateDebut: '2026-11-01' }), '2026-10-03').retard, 0);
  });
  test('jours ouvrables : saute le week-end', () => {
    assert.equal(plusJoursOuvrables('2026-10-02', 2), '2026-10-06'); // vendredi + 2 → mardi
    assert.equal(plusJoursOuvrables('2026-10-05', 5), '2026-10-12');
  });
});

describe('finances', () => {
  test('caisse, reçu et attendu de l’ONG, dette quincaillerie', () => {
    const p = params();
    const lats = [latrine('a', 3), latrine('b', TOUTES, '2026-10-01', { pvSigne: true }), latrine('c')];
    const txs = [
      { sens: 'in', cat: 'avance', montant: 325000, latrineIds: ['a', 'b'] },
      { sens: 'out', cat: 'quincaillerie', montant: 200000 },
      { sens: 'out', cat: 'mo', montant: 20000 },
    ];
    const commandes = [{ nbKits: 3, montant: 589500 }];
    const f = finances(txs, commandes, lats, p);
    assert.equal(f.caisse, 105000);
    assert.equal(f.recuONG, 325000);
    // a : avance due (162 500) déjà reçue ; b : réceptionnée, reste le solde 162 500 ; c : pas démarrée.
    assert.equal(f.attenduONG, 162500);
    assert.equal(f.detteQuincaillerie, 389500);
  });
  test('budget et marge par latrine avec le kit à 196 500 F', () => {
    const b = budgetLatrine(params(), BUDGET_DEFAUT);
    assert.equal(b.kit, 196500);
    assert.equal(b.local, 80000);
    assert.equal(b.achats, 36500);
    assert.equal(b.mo, 43500);
    assert.equal(b.marge, 48500);
  });
  test('Marge 2 : prix terrain obtenus, sans changer la Marge 1', () => {
    const p = params();
    p.quincaillerie = { ...p.quincaillerie, prixKitTerrain: 190000 };
    const budget = BUDGET_DEFAUT.map((x) => (x.id === 'sable' ? { ...x, montantTerrain: 15000 } : x));
    const b = budgetLatrine(p, budget);
    assert.equal(b.marge, 48500); // officielle, inchangée
    assert.equal(b.kitTerrain, 190000);
    assert.equal(b.achatsTerrain, 33500);
    assert.equal(b.marge2, 48500 + 6500 + 3000);
    assert.equal(b.gainTerrain, 9500);
  });
  test('Marge 2 = Marge 1 tant qu’aucun prix terrain n’est saisi', () => {
    const b = budgetLatrine(params(), BUDGET_DEFAUT);
    assert.equal(b.marge2, b.marge);
    assert.equal(b.gainTerrain, 0);
  });
});

describe('situation officielle (mandataire)', () => {
  test('uniquement les prix de base : la Marge 2 et les dépenses réelles n’y entrent pas', () => {
    const p = params();
    p.quincaillerie = { ...p.quincaillerie, prixKitTerrain: 150000 };
    const budget = BUDGET_DEFAUT.map((x) => ({ ...x, montantTerrain: 0 }));
    const lats = [latrine('a', TOUTES), latrine('b', TOUTES, '2026-10-01', { pvSigne: true }), latrine('c', 2), latrine('d')];
    const txs = [
      { sens: 'in', cat: 'avance', montant: 487500, latrineIds: ['a', 'b', 'c'] },
      { sens: 'out', cat: 'materiaux', montant: 999999 },
    ];
    const s = situationOfficielle(lats, txs, p, budget);
    assert.equal(s.marge, 48500);
    assert.deepEqual([s.demarrees, s.achevees], [3, 2]);
    assert.equal(s.margeAchevee, 97000);
    assert.equal(s.coutAchevee, 2 * 276500);
    assert.equal(s.recu, 487500);
    assert.ok(!('marge2' in s) && !('caisse' in s));
  });
});

describe('stock', () => {
  test('kits livrés − kits affectés, et quantités par article', () => {
    const commandes = [{ nbKits: 3, livre: true }, { nbKits: 3, livre: false }];
    const lats = [latrine('a', 1, '2026-10-01', { kitAffecte: '2026-10-01' }), latrine('b')];
    const mouvements = [{ article: 'ciment', sens: 'out', qte: 2 }];
    const s = stock(KIT_DEFAUT, commandes, lats, mouvements);
    assert.equal(s.kitsDispo, 2);
    assert.equal(s.kitsEnAttente, 3);
    const ciment = s.articles.find((a) => a.id === 'ciment');
    assert.deepEqual([ciment.recu, ciment.sorti, ciment.dispo], [24, 10, 14]);
  });
});

describe('comptesOuvriers', () => {
  test('paie par latrine achevée où l’ouvrier était présent, et par jour', () => {
    const lats = [latrine('a', TOUTES), latrine('b', 2)];
    const journal = [
      { date: '2026-10-01', presents: ['m', 'j'], latrineIds: ['a', 'b'] },
      { date: '2026-10-02', presents: ['m'], latrineIds: ['a'] },
    ];
    const workers = [{ id: 'm', mode: 'latrine', tarif: 20000 }, { id: 'j', mode: 'jour', tarif: 3000 }];
    const txs = [{ sens: 'out', workerId: 'm', montant: 5000 }];
    const [m, j] = comptesOuvriers(workers, journal, lats, txs);
    assert.deepEqual([m.du, m.paye, m.reste], [20000, 5000, 15000]);
    assert.deepEqual([j.jours, j.du], [1, 3000]);
  });
  test('deux rapports le même jour ne comptent qu’une journée', () => {
    const journal = [{ date: '2026-10-01', presents: ['j'] }, { date: '2026-10-01', presents: ['j'] }];
    const [j] = comptesOuvriers([{ id: 'j', mode: 'jour', tarif: 3000 }], journal, [], []);
    assert.deepEqual([j.jours, j.du], [1, 3000]);
  });
});

describe('alertes', () => {
  const base = (extra = {}) => ({
    latrines: [], journal: [], txs: [], commandes: [], mouvements: [], kit: KIT_DEFAUT,
    params: params(), derniereSauvegarde: '2026-10-02T10:00:00Z', ...extra,
  });
  test('défaut majeur en retard → alerte rouge avec date lisible', () => {
    const l = latrine('a', 2, '2026-09-20', { defauts: [{ date: '2026-09-21', gravite: 'majeur', description: 'x' }] });
    const a = alertes(base({ latrines: [l] }), '2026-10-03');
    const d = a.find((x) => x.texte.startsWith('Défaut'));
    assert.equal(d.niveau, 'rouge');
    assert.match(d.texte, /28 sept\. 2026/);
  });
  test('solde de l’ONG en retard selon le délai du contrat', () => {
    const l = latrine('a', TOUTES, '2026-09-20', { pvSigne: true, dateReception: '2026-09-21' });
    assert.ok(alertes(base({ latrines: [l] }), '2026-10-03').some((x) => x.texte.startsWith('Solde de l’ONG en retard')));
    const tard = base({ latrines: [l], params: params({ delaiSolde: 30 }) });
    assert.ok(!alertes(tard, '2026-10-03').some((x) => x.texte.startsWith('Solde')));
  });
  test('stock de kits négatif signalé, sans message incohérent', () => {
    const l = latrine('a', 1, '2026-10-01', { kitAffecte: '2026-10-01' });
    const a = alertes(base({ latrines: [l] }), '2026-10-03');
    assert.ok(a.some((x) => /affecté\(s\) de plus que livrés/.test(x.texte)));
    assert.ok(!a.some((x) => /sans kit/.test(x.texte)));
  });
  test('rappel de sauvegarde après 7 jours', () => {
    const a = alertes(base({ latrines: [latrine('a')], derniereSauvegarde: '2026-09-20T10:00:00Z' }), '2026-10-03');
    assert.ok(a.some((x) => x.texte.includes('sauvegarde')));
  });
});

describe('référentiel modifiable', () => {
  test('les étapes et types personnalisés sont pris en compte partout', () => {
    definirReferentiel({ ...REFERENTIEL_DEFAUT, etapes: [{ id: 'e1', nom: 'Fouille' }, { id: 'e2', nom: 'Élévation des murs' }], types: [{ id: 'X', nom: 'Type X — Spéciale' }] });
    try {
      assert.equal(ETAPES.length, 2);
      assert.equal(ETAPES[1].court, 'Élévation');
      assert.equal(statut({ id: 'a', etapes: { e1: '2026-10-01', e2: '2026-10-02' } }, {}, params()), 'achevee');
      assert.equal(typeCourt('X'), 'Type X');
    } finally {
      definirReferentiel();
    }
  });
  test('points de contrôle : seuls les points encore dans la grille comptent', () => {
    const ctl = { points: [{ id: 'p1', nom: 'a' }, { id: 'p2', nom: 'b' }] };
    assert.deepEqual(pointsConformes(ctl, { points: ['p2', 'ancien'] }), ['p2']);
  });
  test('pourcentage : 0 reste 0, vide donne la valeur par défaut', () => {
    assert.equal(montantONG('avance', 3, params({ avancePct: 0 })), 0);
    assert.equal(montantONG('solde', 1, params({ avancePct: 0 })), 325000);
    assert.equal(montantONG('avance', 1, params({ avancePct: '' })), 162500);
  });
  test('nom court tronqué', () => {
    assert.equal(nomCourt('Implantation & balisage'), 'Implanta.');
  });
});
