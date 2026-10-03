// Petits utilitaires partagés : formatage, dates, création d'éléments DOM.

const nf = new Intl.NumberFormat('fr-FR');

export const fcfa = (n) => `${nf.format(Math.round(Number(n) || 0))} F`;
export const num = (n) => nf.format(Math.round(Number(n) || 0));

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const todayISO = () => toISO(new Date());

export function toISO(d) {
  const x = new Date(d);
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const j = String(x.getDate()).padStart(2, '0');
  return `${x.getFullYear()}-${m}-${j}`;
}

const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function dateFr(iso, withDay = false) {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  const base = `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
  return withDay ? `${JOURS[d.getDay()]} ${base}` : base;
}

export function dateCourte(iso) {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Lundi (ISO) de la semaine contenant la date donnée. */
export function lundiDe(iso) {
  const d = new Date(`${iso}T12:00:00`);
  const decal = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - decal);
  return toISO(d);
}

export function ajouterJours(iso, n) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function joursEntre(a, b) {
  const da = new Date(`${a}T12:00:00`);
  const db = new Date(`${b}T12:00:00`);
  return Math.round((db - da) / 86400000);
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/**
 * Gabarit HTML avec échappement automatique des valeurs interpolées.
 * Utiliser raw() pour insérer du HTML déjà sûr.
 */
/** HTML déjà sûr. Une classe (et non un simple objet) : impossible à imiter depuis des données importées. */
class Raw {
  constructor(v) {
    this.v = String(v ?? '');
  }
}

export const raw = (v) => new Raw(v);

const rendre = (x) => (x instanceof Raw ? x.v : esc(x));

export function html(strings, ...vals) {
  return strings.reduce((out, s, i) => {
    if (i >= vals.length) return out + s;
    const v = vals[i];
    return out + s + (Array.isArray(v) ? v.map(rendre).join('') : rendre(v));
  }, '');
}

/**
 * Montant saisi → nombre. Accepte les espaces et les séparateurs de milliers
 * (« 12 500 », « 12.500 », « 12,500 » → 12 500) ; sinon la virgule vaut un point décimal.
 */
export function lireMontant(valeur) {
  const s = String(valeur ?? '').replace(/\s/g, ''); // \s couvre aussi les espaces insécables
  if (s === '') return 0;
  if (/^-?\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ''));
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

/** Initiales d'un nom d'entreprise (« TPE Bâtir Ensemble » → « BE »). */
export function initiales(nom) {
  const mots = String(nom || '').split(/[\s\-.']+/).filter((m) => m && !/^(tpe|ets|sarl|et|de|du|la|le)$/i.test(m));
  return (mots.slice(0, 2).map((m) => m[0]).join('') || 'TPE').toUpperCase();
}

export function $(sel, root = document) {
  return root.querySelector(sel);
}

export function $$(sel, root = document) {
  return [...root.querySelectorAll(sel)];
}

let toastTimer;
export function toast(msg, type = 'ok') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = 'toast'), 2600);
}

/** Lit un formulaire en objet simple ; les champs data-money / data-num sont convertis en nombre. */
export function lireForm(form) {
  const o = {};
  for (const elt of form.elements) {
    if (!elt.name) continue;
    if (elt.type === 'checkbox') {
      if (elt.dataset.multi) {
        o[elt.name] = o[elt.name] || [];
        if (elt.checked) o[elt.name].push(elt.value);
      } else o[elt.name] = elt.checked;
    } else if (elt.type === 'radio') {
      if (elt.checked) o[elt.name] = elt.value;
    } else if (elt.dataset.vide !== undefined && elt.value.trim() === '') {
      o[elt.name] = ''; // champ facultatif laissé vide (ex. prix terrain = prix de base)
    } else if (elt.dataset.money !== undefined) {
      o[elt.name] = lireMontant(elt.value);
    } else if (elt.dataset.num !== undefined) {
      o[elt.name] = elt.value === '' ? 0 : Number(String(elt.value).replace(/\s/g, '').replace(',', '.'));
    } else o[elt.name] = elt.value.trim();
  }
  return o;
}

export function telechargerFichier(nom, contenu, type = 'application/json') {
  const blob = contenu instanceof Blob ? contenu : new Blob([contenu], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
