// Référentiel métier. L'identité de la TPE et de l'ONG est saisie au premier lancement ;
// les chiffres par défaut sont ceux du modèle PASEA Hambol, tous modifiables dans « Réglages ».

export const PARAMS_DEFAUT = {
  tpe: {
    nom: '',
    gerant: '',
    lot: '',
    village: '',
    sousPrefecture: '',
    tel: '',
    momo: '',
    reseauMomo: 'Orange Money',
    logo: '',
  },
  contrat: {
    commanditaire: '',
    sigle: '',
    projet: '',
    ref: '',
    controleur: '',
    prixLatrine: 325000,
    avancePct: 50,
    delaiSolde: 5,
    objectifSemaine: 3,
    totalLatrines: 0,
    dateDebut: '',
  },
  quincaillerie: {
    nom: '',
    prixKit: 127000, // = prixDuKit(kit) : recalculé à chaque modification du kit
    acomptePct: 50,
  },
  options: {
    // Marge 2 : marge personnelle calculée avec les prix réellement obtenus sur le terrain.
    // Jamais imprimée ni partagée (rapports, factures, WhatsApp, exports).
    marge2: false,
  },
};

/** Sigle de l'ONG pour les libellés courts, ou « ONG » si non renseigné. */
export const sigleONG = (p) => p.contrat.sigle || 'ONG';

/** Pourcentage saisi (0 à 100). Un champ vide ou invalide prend la valeur par défaut — mais 0 reste 0. */
export function pourcentage(valeur, defaut = 50) {
  if (valeur === '' || valeur === null || valeur === undefined) return defaut;
  const n = Number(valeur);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : defaut;
}

/** Part d'avance de l'ONG, de 0 à 1. */
export const partAvance = (p) => pourcentage(p.contrat.avancePct) / 100;

/** Part d'acompte payée à la commande de kits, de 0 à 1. */
export const partAcompte = (p) => pourcentage(p.quincaillerie.acomptePct) / 100;

/** Nom complet de l'ONG pour les documents officiels. */
export const nomONG = (p) => p.contrat.commanditaire || p.contrat.sigle || 'ONG commanditaire';

// Kit par défaut (modèle PASEA Hambol) : « KITS DE MATÉRIELS, MATÉRIAUX ET CONSOMMABLES DE LA QUINCAILLERIE DÉDIÉE PROJET PASEA HAMBOL ».
// Kit par défaut : « KIT DES CONSOMMABLES DE LA QUINCAILLERIE DÉDIÉE » (mise à jour d'octobre 2026).
// Quantités pour UNE latrine ; le kit se commande par lot de 3 latrines. Tout est modifiable dans Réglages → Kit,
// car la composition et les prix de la quincaillerie peuvent changer d'une commande à l'autre.
export const KIT_DEFAUT = [
  { id: 'fer8', nom: 'Barre de fer de 8', qte: 3, unite: 'u', prix: 2000 },
  { id: 'tole', nom: 'Tôle ondulée ordinaire', qte: 3, unite: 'u', prix: 3000 },
  { id: 'chevron', nom: 'Chevron 6/4', qte: 3, unite: 'u', prix: 2500 },
  { id: 'ciment', nom: 'Ciment CPA 42,5 (sac de 50 kg)', qte: 8, unite: 'sac', prix: 6000 },
  { id: 'coude110', nom: 'Coude PVC Ø 110', qte: 1, unite: 'u', prix: 1500 },
  { id: 'tuyau110', nom: 'Tuyau PVC Ø 110', qte: 1, unite: 'barre', prix: 6500 },
  { id: 'tuyau75', nom: 'Tuyau PVC Ø 75', qte: 0.5, unite: 'barre', prix: 5000 },
  { id: 'coude75', nom: 'Coude PVC Ø 75', qte: 1, unite: 'u', prix: 1000 },
  { id: 'te75', nom: 'Té PVC Ø 75', qte: 1, unite: 'u', prix: 1000 },
  { id: 'porte', nom: 'Porte métallique', qte: 1, unite: 'u', prix: 27000 },
  { id: 'wc', nom: 'WC complet', qte: 1, unite: 'u', prix: 17000 },
];

/** Prix d'un kit pour une latrine = somme (quantité × prix unitaire). 0 si aucun prix n'est saisi. */
export const prixDuKit = (kit) => Math.round(kit.reduce((s, a) => s + (Number(a.qte) || 0) * (Number(a.prix) || 0), 0));

// Dépenses locales prévues par latrine, hors kit (base : DQE réel).
// Lave-mains et claustras sont achetés sur place depuis qu'ils ne sont plus dans le kit.
export const BUDGET_DEFAUT = [
  { id: 'sable', nom: 'Sable', montant: 18000, cat: 'materiaux' },
  { id: 'gravier', nom: 'Gravier', montant: 4000, cat: 'materiaux' },
  { id: 'planche', nom: 'Planche fond 12 ép. 4 cm', montant: 1500, cat: 'materiaux' },
  { id: 'colle', nom: 'Colle PVC Tangit', montant: 500, cat: 'materiaux' },
  { id: 'claustras', nom: 'Claustras (2)', montant: 1000, cat: 'materiaux' },
  { id: 'pointes', nom: 'Pointes n°6 et n°10', montant: 1000, cat: 'materiaux' },
  { id: 'fil', nom: 'Fil de fer d’attache galva', montant: 2000, cat: 'materiaux' },
  { id: 'support-lavemains', nom: 'Support de lave-mains', montant: 2000, cat: 'materiaux' },
  { id: 'seau-lavemains', nom: 'Seau de lave-mains', montant: 3000, cat: 'materiaux' },
  { id: 'transport', nom: 'Transport matériaux', montant: 3000, cat: 'transport' },
  { id: 'macon', nom: 'Maçon', montant: 20000, cat: 'mo' },
  { id: 'plombier', nom: 'Plombier', montant: 5000, cat: 'mo' },
  { id: 'menuisier', nom: 'Menuisier', montant: 3500, cat: 'mo' },
  { id: 'puisatier', nom: 'Puisatier', montant: 15000, cat: 'mo' },
  { id: 'imprevus', nom: 'Imprévus et divers', montant: 6500, cat: 'divers' },
];

// ---------- Référentiel technique (modifiable dans Réglages → Chantier) ----------

const points = (prefixe, noms) => noms.map((nom, i) => ({ id: `${prefixe}-${i + 1}`, nom }));

export const REFERENTIEL_DEFAUT = {
  types: [
    { id: 'A', nom: 'Type A — Fosse sèche ventilée' },
    { id: 'B', nom: 'Type B — Fosse double, WC turque / Satopan' },
    { id: 'C', nom: 'Type C — Améliorée, blocs ciment / BTC' },
    { id: 'D', nom: 'Type D — Personnes à mobilité réduite' },
  ],
  interfaces: ['Satopan accroupi', 'Satopan assis', 'WC turque', 'WC anglais'],
  // Étapes de construction d'une latrine, dans l'ordre.
  etapes: [
    { id: 'implantation', nom: 'Implantation & balisage', court: 'Implant.' },
    { id: 'fouille', nom: 'Fouille double fosse', court: 'Fouille' },
    { id: 'fosses', nom: 'Fosses & dallettes', court: 'Fosses' },
    { id: 'fondation', nom: 'Fondation', court: 'Fond.' },
    { id: 'elevation', nom: 'Élévation des murs', court: 'Murs' },
    { id: 'plomberie', nom: 'Interface WC & plomberie', court: 'Plomb.' },
    { id: 'toiture', nom: 'Charpente & toiture', court: 'Toit' },
    { id: 'porte', nom: 'Pose de la porte', court: 'Porte' },
    { id: 'finitions', nom: 'Enduits, finitions, lave-mains', court: 'Finit.' },
    { id: 'essais', nom: 'Essais & nettoyage du site', court: 'Essais' },
  ],
  // Fiche de contrôle qualité (modèle PASEA) — 3 visites.
  controles: {
    e1: {
      titre: 'Étape 1 — Avant démarrage',
      points: points('e1', [
        'Coordonnées GPS conformes à la liste officielle',
        'Accord du ménage bénéficiaire',
        'Intrants disponibles (sable, ciment, gravier, PVC)',
        'Plan type disponible sur site',
        'Code de bonne conduite signé par les artisans',
        'EPI disponibles (casques, gants, chaussures)',
      ]),
    },
    e2: {
      titre: 'Étape 2 — En cours d’exécution',
      points: points('e2', [
        'Béton fondation dosé à 150 kg/m³',
        'Pente interface WC ≥ 2 %',
        'Hauteur sous toiture ≥ 2,20 m',
        'PVC évacuation Ø110',
        'PVC ventilation Ø75',
        'Débord toiture ≥ 30 cm',
        'Murs parpaing 12 creux alignés',
        'Chantier balisé et sécurisé',
        'EPI portés par tous les artisans',
      ]),
    },
    e3: {
      titre: 'Étape 3 — Réception finale',
      points: points('e3', [
        'Porte 0,70 × 1,80 m + verrou int./ext.',
        'Essai d’étanchéité de la fosse',
        'Test de ventilation (Ø75)',
        'Essai d’écoulement (pente ≥ 2 %)',
        'Finitions intérieures (enduit imperméable)',
        'Finitions extérieures',
        'Nettoyage final du site',
        'Double fosse couverte',
        'Journal de chantier rempli',
      ]),
    },
  },
};

/** Nom court d'une étape pour les pastilles (« Élévation des murs » → « Élévation »). */
export const nomCourt = (nom) => {
  const mot = String(nom).split(/[\s&,]+/)[0] || String(nom);
  return mot.length > 9 ? `${mot.slice(0, 8)}.` : mot;
};

// Liaisons « vivantes » : tous les modules voient le référentiel en vigueur après definirReferentiel().
export let TYPES_LATRINE = {};
export let INTERFACES_WC = [];
export let ETAPES = [];
export let CONTROLES = {};
let referentiel = REFERENTIEL_DEFAUT;

export function definirReferentiel(r) {
  referentiel = { ...REFERENTIEL_DEFAUT, ...(r || {}) };
  TYPES_LATRINE = Object.fromEntries(referentiel.types.map((t) => [t.id, t.nom]));
  INTERFACES_WC = [...referentiel.interfaces];
  ETAPES = referentiel.etapes.map((e) => ({ ...e, court: e.court || nomCourt(e.nom) }));
  CONTROLES = referentiel.controles;
}

export const referentielActuel = () => structuredClone(referentiel);

/** Libellé court d'un type (« Type B — Fosse double… » → « Type B »). */
export const typeCourt = (id) => (TYPES_LATRINE[id] || '').split(' — ')[0] || '';

definirReferentiel();

export const ROLES = ['Maçon', 'Plombier', 'Menuisier', 'Puisatier', 'Manœuvre', 'Conducteur tricycle', 'Autre'];

export const MODES_PAIEMENT = ['Orange Money', 'Wave', 'MTN MoMo', 'Moov Money', 'Espèces', 'Banque'];

// Catégories d'argent. « in » = entrée, « out » = sortie.
export const CATEGORIES = {
  in: [
    { id: 'avance', nom: 'Avance de l’ONG' },
    { id: 'solde', nom: 'Solde de l’ONG' },
    { id: 'apport', nom: 'Apport personnel' },
    { id: 'autre-in', nom: 'Autre entrée' },
  ],
  out: [
    { id: 'quincaillerie', nom: 'Quincaillerie (kits)' },
    { id: 'materiaux', nom: 'Sable, gravier, matériaux' },
    { id: 'mo', nom: 'Main-d’œuvre' },
    { id: 'transport', nom: 'Transport / carburant tricycle' },
    { id: 'epi', nom: 'EPI & sécurité' },
    { id: 'divers', nom: 'Divers & imprévus' },
  ],
};

export const TYPES_INCIDENT = [
  'Accident / blessure',
  'Non-conformité technique',
  'Retard de production',
  'Conflit avec ménage',
  'Plainte VBG / EAS / HS',
  'Travail d’enfant signalé',
  'Vol / fraude',
  'Pluie / intempérie',
  'Rupture de matériaux',
  'Autre',
];

export const METEO = ['Ensoleillé', 'Nuageux', 'Pluie', 'Forte pluie'];
