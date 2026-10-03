// État de l'application en mémoire, synchronisé avec IndexedDB.
import { db, STORES } from './db.js';
import { PARAMS_DEFAUT, KIT_DEFAUT, BUDGET_DEFAUT, definirReferentiel } from './data.js';
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

export async function charger() {
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
