// Tests des mises à jour de données (kit et budget déjà enregistrés sur un téléphone).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { kitNonPersonnalise, budgetMisAJour } from '../js/store.js';
import { KIT_DEFAUT, BUDGET_DEFAUT } from '../js/data.js';

const KIT_V1 = [['satopan', 1], ['fer-regard', 1], ['fer-fosses', 2], ['porte', 1], ['tole', 3], ['chevron', 3], ['ciment', 8],
  ['coude110', 1], ['tuyau110', 1], ['tuyau75', 1], ['coude75', 1], ['te75', 1], ['collier75', 1], ['lavemain', 1],
  ['brique-pleine', 1], ['brique-creuse', 1], ['claustra', 2]].map(([id, qte]) => ({ id, nom: id, qte, unite: 'u' }));

describe('kit enregistré sur le téléphone', () => {
  test('aucun kit enregistré : le kit par défaut actuel s’applique', () => {
    assert.equal(kitNonPersonnalise(null), true);
  });
  test('ancien kit à 17 articles enregistré sans changement : remplacé', () => {
    assert.equal(kitNonPersonnalise(KIT_V1), true);
  });
  test('kit précédent à 135 600 F enregistré sans changement : remplacé', () => {
    const v3 = [['fer8', 3, 2500], ['tole', 3, 3500], ['chevron', 3, 2500], ['ciment', 8, 6700], ['coude110', 1, 1500], ['tuyau110', 1, 6500],
      ['tuyau75', 1, 2500], ['coude75', 1, 1000], ['te75', 1, 1000], ['porte', 1, 26000], ['wc', 1, 18000]].map(([id, qte, prix]) => ({ id, nom: id, qte, prix }));
    assert.equal(kitNonPersonnalise(v3), true);
  });
  test('kit modifié par la TPE (un prix ou une quantité) : conservé', () => {
    assert.equal(kitNonPersonnalise(KIT_V1.map((a) => (a.id === 'ciment' ? { ...a, qte: 9 } : a))), false);
    assert.equal(kitNonPersonnalise(KIT_DEFAUT.map((a) => (a.id === 'ciment' ? { ...a, prix: 7000 } : a))), false);
  });
});

describe('budget enregistré sur le téléphone', () => {
  const v1 = BUDGET_DEFAUT.filter((b) => !['claustras', 'support-lavemains', 'seau-lavemains'].includes(b.id));
  test('structure de la v1 : lave-mains et claustras ajoutés, montants saisis conservés', () => {
    const saisi = v1.map((b) => (b.id === 'sable' ? { ...b, montant: 17000, montantTerrain: 15000 } : b));
    const maj = budgetMisAJour(saisi);
    assert.equal(maj.length, 15);
    assert.deepEqual(maj.find((b) => b.id === 'sable'), { id: 'sable', nom: 'Sable', montant: 17000, cat: 'materiaux', montantTerrain: 15000 });
    assert.equal(maj.filter((b) => ['claustras', 'support-lavemains', 'seau-lavemains'].includes(b.id)).reduce((s, b) => s + b.montant, 0), 6000);
  });
  test('budget personnalisé (ligne ajoutée ou retirée) ou absent : non touché', () => {
    assert.equal(budgetMisAJour([...v1, { id: 'x', nom: 'Briques', montant: 53000, cat: 'materiaux' }]), null);
    assert.equal(budgetMisAJour(v1.slice(1)), null);
    assert.equal(budgetMisAJour(BUDGET_DEFAUT), null);
    assert.equal(budgetMisAJour(null), null);
  });
});
