// État de l'application en mémoire, synchronisé avec IndexedDB.
import { db, STORES } from './db.js';
import { PARAMS_DEFAUT, KIT_DEFAUT, BUDGET_DEFAUT, definirReferentiel, prixDuKit } from './data.js';
import { uid } from './util.js';

// Nom du store IndexedDB → clé dans l'état.
const COLLECTIONS = {
  latrines: 'latrines',
  journal: 'journal',
  tx: 'txs',
  workers: 'workers',
  commandes: 'commandes',
  stock: 'mouvements',
};

export const etat = {
  params: structuredClone(PARAMS_DEFAUT),
  kit: structuredClone(KIT_DEFAUT),
  budget: structuredClone(BUDGET_DEFAUT),
  latrines: [],
  journal: [],
  txs: [],
  workers: [],
  commandes: [],
  mouvements: [],
  derniereSauvegarde: null,
  configure: false,
};

/** Fusion profonde simple pour garder les nouveaux champs par défaut lors des mises à jour. */
function fusion(defaut, sauve) {
  if (!sauve) return structuredClone(defaut);
  const out = structuredClone(defaut);
  for (const k of Object.keys(sauve)) {
    out[k] = typeof defaut[k] === 'object' && defaut[k] && !Array.isArray(defaut[k])
      ? { ...defaut[k], ...sauve[k] }
      : sauve[k];
  }
  return out;
}

const VERSION_DONNEES = 5;

// Kits par défaut des versions précédentes ([id, quantité, prix]) : s'ils sont restés tels quels sur le téléphone
// (même enregistrés sans changement), ils sont remplacés par le kit par défaut actuel.
const ANCIENS_KITS = [
  // v1 — 196 500 F, 17 articles sans prix unitaire
  [['satopan', 1, 0], ['fer-regard', 1, 0], ['fer-fosses', 2, 0], ['porte', 1, 0], ['tole', 3, 0], ['chevron', 3, 0], ['ciment', 8, 0],
    ['coude110', 1, 0], ['tuyau110', 1, 0], ['tuyau75', 1, 0], ['coude75', 1, 0], ['te75', 1, 0], ['collier75', 1, 0], ['lavemain', 1, 0],
    ['brique-pleine', 1, 0], ['brique-creuse', 1, 0], ['claustra', 2, 0]],
  // v2 — 127 000 F
  [['fer8', 3, 2000], ['tole', 3, 3000], ['chevron', 3, 2500], ['ciment', 8, 6000], ['coude110', 1, 1500], ['tuyau110', 1, 6500],
    ['tuyau75', 0.5, 5000], ['coude75', 1, 1000], ['te75', 1, 1000], ['porte', 1, 27000], ['wc', 1, 17000]],
  // v3 — 135 600 F
  [['fer8', 3, 2500], ['tole', 3, 3500], ['chevron', 3, 2500], ['ciment', 8, 6700], ['coude110', 1, 1500], ['tuyau110', 1, 6500],
    ['tuyau75', 1, 2500], ['coude75', 1, 1000], ['te75', 1, 1000], ['porte', 1, 26000], ['wc', 1, 18000]],
];

// Postes du budget local de la v1 : lave-mains et claustras n'y figuraient pas (ils étaient alors dans le kit).
const BUDGET_V1 = ['sable', 'gravier', 'planche', 'colle', 'pointes', 'fil', 'transport', 'macon', 'plombier', 'menuisier', 'puisatier', 'imprevus'];
const AJOUTS_BUDGET = ['claustras', 'support-lavemains', 'seau-lavemains'];

const signatureKit = (kit) => JSON.stringify(kit.map((a) => [a.id, Number(a.qte) || 0, Number(a.prix) || 0]));

/** Vrai si le kit enregistré est absent ou identique à un ancien kit par défaut (donc jamais personnalisé). */
export function kitNonPersonnalise(kit) {
  return !kit || ANCIENS_KITS.some((k) => JSON.stringify(k) === signatureKit(kit));
}

/** Ajoute lave-mains et claustras à un budget qui a gardé les postes de la v1 ; les montants saisis sont conservés. */
export function budgetMisAJour(budget) {
  if (!budget) return null;
  const ids = budget.map((b) => b.id);
  const structureV1 = ids.length === BUDGET_V1.length && BUDGET_V1.every((id) => ids.includes(id));
  if (!structureV1) return null;
  return [...budget, ...BUDGET_DEFAUT.filter((b) => AJOUTS_BUDGET.includes(b.id)).map((b) => ({ ...b }))];
}

/**
 * Mises à jour des données déjà enregistrées sur un téléphone (oct. 2026 : nouveaux kits de la quincaillerie ;
 * v5 : kit avec WC préfabriqué à 121 700 F).
 * Un kit ou un budget que la TPE a personnalisé n'est jamais remplacé ; les commandes passées gardent leur prix.
 */
async function migrer() {
  const version = await db.getKV('versionDonnees', 1);
  if (version >= VERSION_DONNEES) return;
  const kitEnregistre = await db.getKV('kit', null);
  if (kitNonPersonnalise(kitEnregistre)) {
    if (kitEnregistre) await db.del('kv', 'kit'); // le kit par défaut actuel s'applique
    const params = await db.getKV('params', null);
    if (params?.quincaillerie) {
      await db.setKV('params', { ...params, quincaillerie: { ...params.quincaillerie, prixKit: prixDuKit(KIT_DEFAUT) } });
    }
  }
  const budget = budgetMisAJour(await db.getKV('budget', null));
  if (budget) await db.setKV('budget', budget);
  await db.setKV('versionDonnees', VERSION_DONNEES);
}

export async function charger() {
  await migrer();
  etat.params = fusion(PARAMS_DEFAUT, await db.getKV('params'));
  etat.kit = (await db.getKV('kit')) || structuredClone(KIT_DEFAUT);
  etat.budget = (await db.getKV('budget')) || structuredClone(BUDGET_DEFAUT);
  definirReferentiel(await db.getKV('referentiel', null));
  etat.derniereSauvegarde = await db.getKV('derniereSauvegarde', null);
  etat.configure = await db.getKV('configure', false);
  for (const [store, cle] of Object.entries(COLLECTIONS)) {
    etat[cle] = await db.all(store);
  }
  trier();
}

function trier() {
  etat.latrines.sort((a, b) => (Number(a.num) || 0) - (Number(b.num) || 0) || String(a.num).localeCompare(String(b.num)));
  etat.journal.sort((a, b) => b.date.localeCompare(a.date) || (b.cree || 0) - (a.cree || 0));
  etat.txs.sort((a, b) => b.date.localeCompare(a.date) || (b.cree || 0) - (a.cree || 0));
  etat.commandes.sort((a, b) => b.date.localeCompare(a.date));
  etat.mouvements.sort((a, b) => b.date.localeCompare(a.date));
}

/** Crée ou met à jour un enregistrement. Retourne l'objet enregistré (nouvelle copie). */
export async function enregistrer(store, obj) {
  const cle = COLLECTIONS[store];
  const rec = { ...obj, id: obj.id || uid(), cree: obj.cree || Date.now(), modifie: Date.now() };
  await db.put(store, rec);
  const idx = etat[cle].findIndex((x) => x.id === rec.id);
  etat[cle] = idx >= 0 ? etat[cle].map((x) => (x.id === rec.id ? rec : x)) : [...etat[cle], rec];
  trier();
  return rec;
}

export async function supprimer(store, id) {
  const cle = COLLECTIONS[store];
  await db.del(store, id);
  etat[cle] = etat[cle].filter((x) => x.id !== id);
}

export async function sauverParams(params) {
  etat.params = params;
  await db.setKV('params', params);
}

export async function sauverKit(kit) {
  etat.kit = kit;
  await db.setKV('kit', kit);
}

export async function sauverBudget(budget) {
  etat.budget = budget;
  await db.setKV('budget', budget);
}

/** Enregistre le référentiel technique (types, interfaces, étapes, contrôles qualité). */
export async function sauverReferentiel(referentiel) {
  definirReferentiel(referentiel);
  await db.setKV('referentiel', referentiel);
}

export async function marquerConfigure() {
  etat.configure = true;
  await db.setKV('configure', true);
}

// ---------- Photos (stockées à part, en Blob) ----------

export async function ajouterPhoto(blob) {
  const id = uid();
  await db.put('photos', { id, blob, date: Date.now() });
  return id;
}

export async function urlPhoto(id) {
  const p = await db.get('photos', id);
  return p ? URL.createObjectURL(p.blob) : null;
}

/** Réduit une photo (max 1280 px, JPEG 0,7) pour économiser l'espace du téléphone. */
export function compresserImage(file, max = 1280, qualite = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * r);
      c.height = Math.round(img.height * r);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Compression impossible'))), 'image/jpeg', qualite);
    };
    img.onerror = () => reject(new Error('Image illisible'));
    img.src = url;
  });
}

/** Logo réduit (256 px max) en data URL, pour l'en-tête et les documents imprimés. */
export function logoEnDataURL(file, max = 256) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Choisis une image'));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * r);
      c.height = Math.round(img.height * r);
      const ctx = c.getContext('2d');
      const png = file.type === 'image/png';
      if (!png) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
      }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = () => reject(new Error('Image illisible'));
    img.src = url;
  });
}

// ---------- Sauvegarde / restauration ----------

const blobVersDataURL = (blob) =>
  new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(blob);
  });

export async function exporterTout(avecPhotos = false) {
  const data = { app: 'vn-chantier', version: 1, date: new Date().toISOString(), stores: {} };
  for (const s of STORES) {
    if (s === 'photos') continue;
    data.stores[s] = await db.all(s);
  }
  data.stores.kv = data.stores.kv.filter((x) => x.k !== 'derniereSauvegarde');
  if (avecPhotos) {
    // Une photo à la fois pour limiter la mémoire utilisée sur les petits téléphones.
    const photos = await db.all('photos');
    data.stores.photos = [];
    for (const p of photos) data.stores.photos.push({ id: p.id, date: p.date, data: await blobVersDataURL(p.blob) });
  }
  return JSON.stringify(data);
}

/** À appeler seulement quand le fichier a vraiment été téléchargé ou envoyé. */
export async function marquerSauvegarde(date = new Date().toISOString()) {
  etat.derniereSauvegarde = date;
  await db.setKV('derniereSauvegarde', date);
}

const INVALIDE = 'Ce fichier n’est pas une sauvegarde valide de l’application';

/** Vérifie toute la sauvegarde avant de toucher aux données du téléphone. */
function verifierSauvegarde(data) {
  if (!data || data.app !== 'vn-chantier' || typeof data.stores !== 'object' || !data.stores) throw new Error(INVALIDE);
  for (const [nom, liste] of Object.entries(data.stores)) {
    if (!STORES.includes(nom) || !Array.isArray(liste)) throw new Error(INVALIDE);
    const cle = nom === 'kv' ? 'k' : 'id';
    if (liste.some((o) => !o || typeof o !== 'object' || typeof o[cle] !== 'string' || !o[cle])) throw new Error(`${INVALIDE} (${nom})`);
    if (nom === 'photos' && liste.some((p) => typeof p.data !== 'string' || !p.data.startsWith('data:image/'))) throw new Error(`${INVALIDE} (photos)`);
  }
}

export async function importerTout(texte) {
  let data;
  try {
    data = JSON.parse(texte);
  } catch {
    throw new Error(INVALIDE);
  }
  verifierSauvegarde(data);
  const contenu = {};
  for (const [nom, liste] of Object.entries(data.stores)) {
    if (nom !== 'photos') {
      contenu[nom] = liste;
      continue;
    }
    contenu.photos = [];
    for (const p of liste) contenu.photos.push({ id: p.id, date: p.date, blob: await (await fetch(p.data)).blob() });
  }
  try {
    // Une seule transaction : en cas d'échec, les données actuelles restent intactes.
    await db.remplacerTout(contenu);
    if (data.date) await marquerSauvegarde(data.date);
  } finally {
    await charger();
  }
}

/** Supprime les photos qui ne sont plus utilisées par aucune fiche (formulaire annulé, photo retirée…). */
export async function nettoyerPhotos() {
  const utilisees = new Set([
    ...etat.latrines.flatMap((l) => [...(l.photos || []), ...(l.photosFin || [])]),
    ...etat.journal.flatMap((j) => j.photos || []),
    ...etat.txs.flatMap((t) => t.photos || []),
  ]);
  const ids = await db.cles('photos');
  const orphelines = ids.filter((id) => !utilisees.has(id));
  for (const id of orphelines) await db.del('photos', id);
  return orphelines.length;
}

export async function toutEffacer() {
  for (const s of STORES) await db.clear(s);
  await charger();
}
