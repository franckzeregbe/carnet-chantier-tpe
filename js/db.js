// Stockage local (IndexedDB) : toutes les données restent dans le téléphone.

const DB_NAME = 'vn-chantier';
const DB_VERSION = 1;
export const STORES = ['kv', 'latrines', 'journal', 'tx', 'workers', 'commandes', 'stock', 'photos'];

let dbPromise;

function ouvrir() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) {
          db.createObjectStore(s, { keyPath: s === 'kv' ? 'k' : 'id' });
        }
      }
    };
    req.onsuccess = () => {
      const base = req.result;
      // Libère la base si une autre page de l'app doit la mettre à jour ou l'effacer.
      base.onversionchange = () => {
        base.close();
        dbPromise = null;
      };
      resolve(base);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
    req.onblocked = () => {
      dbPromise = null;
      reject(new Error('La base est bloquée par un autre onglet de l’application. Ferme les autres onglets puis recharge.'));
    };
  });
  return dbPromise;
}

function requete(store, mode, fn) {
  return ouvrir().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tr = db.transaction(store, mode);
        const res = fn(tr.objectStore(store));
        tr.oncomplete = () => resolve(res && 'result' in res ? res.result : res);
        tr.onerror = () => reject(tr.error);
        tr.onabort = () => reject(tr.error || new Error('Transaction annulée'));
      }),
  );
}

export const db = {
  all: (store) => requete(store, 'readonly', (s) => s.getAll()),
  cles: (store) => requete(store, 'readonly', (s) => s.getAllKeys()),
  get: (store, id) => requete(store, 'readonly', (s) => s.get(id)),
  put: (store, obj) => requete(store, 'readwrite', (s) => s.put(obj)),
  del: (store, id) => requete(store, 'readwrite', (s) => s.delete(id)),
  clear: (store) => requete(store, 'readwrite', (s) => s.clear()),
  async getKV(k, def) {
    const r = await this.get('kv', k);
    return r ? r.v : def;
  },
  setKV: (k, v) => db.put('kv', { k, v }),
  async putMany(store, list) {
    const base = await ouvrir();
    return new Promise((resolve, reject) => {
      const tr = base.transaction(store, 'readwrite');
      const s = tr.objectStore(store);
      list.forEach((o) => s.put(o));
      tr.oncomplete = () => resolve();
      tr.onerror = () => reject(tr.error);
      tr.onabort = () => reject(tr.error || new Error('Enregistrement annulé'));
    });
  },
  /**
   * Remplace le contenu de plusieurs stores en UNE transaction : si une écriture échoue
   * (espace plein, donnée invalide…), tout est annulé et les anciennes données restent intactes.
   */
  async remplacerTout(contenu) {
    const base = await ouvrir();
    const noms = Object.keys(contenu);
    return new Promise((resolve, reject) => {
      let tr;
      try {
        tr = base.transaction(noms, 'readwrite');
        for (const nom of noms) {
          const s = tr.objectStore(nom);
          s.clear();
          contenu[nom].forEach((o) => s.put(o));
        }
      } catch (err) {
        if (tr) tr.abort();
        reject(err);
        return;
      }
      tr.oncomplete = () => resolve();
      tr.onerror = () => reject(tr.error);
      tr.onabort = () => reject(tr.error || new Error('Restauration annulée'));
    });
  },
};

/** Demande au navigateur de ne pas effacer les données en cas de manque d'espace. */
export async function demanderPersistance() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      return await navigator.storage.persist();
    }
  } catch (e) {
    console.warn('Persistance refusée', e);
  }
  return false;
}
