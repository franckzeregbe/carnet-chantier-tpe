// Composants d'interface : feuille modale, champs de formulaire, photos, icônes.
import { html, raw, esc, $, $$, lireForm, toast } from './util.js';
import { ajouterPhoto, compresserImage, urlPhoto } from './store.js';

// ---------- Icônes (traits SVG, 24px) ----------
const P = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  site: 'M4 21V9l8-5 8 5v12M9 21v-6h6v6M2 21h20',
  journal: 'M6 3h10l4 4v14H6zM16 3v4h4M9 12h8M9 16h6',
  money: 'M3 7h18v10H3zM7 7v10M17 7v10M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  more: 'M4 6h16M4 12h16M4 18h16',
  plus: 'M12 5v14M5 12h14',
  back: 'M15 18l-6-6 6-6',
  check: 'M5 12l5 5L20 7',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 11a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  pin: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  box: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
  team: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6',
  print: 'M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z',
  share: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
  save: 'M5 3h11l3 3v15H5zM8 3v5h7V3M8 14h8v7H8z',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  invoice: 'M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h4',
  alert: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3',
  edit: 'M4 20h4L20 8l-4-4L4 16zM14 6l4 4',
  in: 'M12 4v14M6 12l6 6 6-6',
  out: 'M12 20V6M6 12l6-6 6 6',
  chevron: 'M9 6l6 6-6 6',
  wifi: 'M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01',
};

export const ico = (nom, cls = '') =>
  raw(`<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[nom] || ''}"/></svg>`);

// ---------- Champs ----------

export function champ(label, controle, aide = '') {
  return html`<label class="champ"><span class="champ-label">${label}</span>${raw(controle)}${aide ? raw(`<small class="aide">${esc(aide)}</small>`) : ''}</label>`;
}

export function input(name, value = '', o = {}) {
  const type = o.type || 'text';
  const attrs = [
    `name="${esc(name)}"`,
    `type="${type === 'money' ? 'text' : type}"`,
    `value="${esc(value ?? '')}"`,
    o.placeholder ? `placeholder="${esc(o.placeholder)}"` : '',
    o.required ? 'required' : '',
    type === 'money' ? 'inputmode="decimal" data-money' : '',
    type === 'number' ? 'inputmode="decimal" data-num' : '',
    o.step ? `step="${o.step}"` : '',
    o.min !== undefined ? `min="${o.min}"` : '',
    o.list ? `list="${esc(o.list)}"` : '',
    o.autofocus ? 'autofocus' : '',
    o.vide ? 'data-vide' : '',
    type === 'tel' ? 'inputmode="tel"' : '',
  ];
  return `<input ${attrs.filter(Boolean).join(' ')}>`;
}

export function select(name, options, value = '', o = {}) {
  const opts = options
    .map((op) => {
      const [v, t] = Array.isArray(op) ? op : [op, op];
      return `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(t)}</option>`;
    })
    .join('');
  return `<select name="${esc(name)}" ${o.required ? 'required' : ''}>${o.vide ? `<option value="">${esc(o.vide)}</option>` : ''}${opts}</select>`;
}

export function textarea(name, value = '', placeholder = '', rows = 3) {
  return `<textarea name="${esc(name)}" rows="${rows}" placeholder="${esc(placeholder)}">${esc(value ?? '')}</textarea>`;
}

/** Choix multiples sous forme de pastilles cochables. */
export function puces(name, options, choisis = []) {
  const set = new Set(choisis);
  return `<div class="puces">${options
    .map(([v, t]) => `<label class="puce"><input type="checkbox" name="${esc(name)}" value="${esc(v)}" data-multi="1" ${set.has(v) ? 'checked' : ''}><span>${esc(t)}</span></label>`)
    .join('')}</div>`;
}

/** Boutons radio en ligne (segment). */
export function segment(name, options, value) {
  return `<div class="segment">${options
    .map(([v, t]) => `<label><input type="radio" name="${esc(name)}" value="${esc(v)}" ${v === value ? 'checked' : ''}><span>${esc(t)}</span></label>`)
    .join('')}</div>`;
}

// ---------- Feuille modale ----------

/**
 * Ouvre une feuille avec un formulaire. `onValider(donnees, form)` peut retourner false pour garder la feuille ouverte.
 */
export function feuille({ titre, corps, valider = 'Enregistrer', onValider, onOuvert, supprimer }) {
  const dlg = $('#feuille');
  dlg.innerHTML = html`
    <form method="dialog" class="feuille-form" novalidate>
      <header class="feuille-tete">
        <button type="button" class="btn-ico" data-fermer aria-label="Fermer">${ico('back')}</button>
        <h2>${titre}</h2>
        ${supprimer ? raw(`<button type="button" class="btn-ico danger" data-suppr aria-label="Supprimer">${ico('trash').v}</button>`) : ''}
      </header>
      <div class="feuille-corps">${raw(corps)}</div>
      ${onValider ? raw(`<footer class="feuille-pied"><button type="submit" class="btn btn-plein">${esc(valider)}</button></footer>`) : ''}
    </form>`;
  const form = $('form', dlg);
  const fermer = () => dlg.close();
  $('[data-fermer]', dlg).onclick = fermer;
  if (supprimer) {
    $('[data-suppr]', dlg).onclick = async () => {
      if (await confirmer('Supprimer définitivement cet élément ?')) {
        await supprimer();
        fermer();
      }
    };
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!onValider) return fermer();
    const manquant = $$('[required]', form).find((x) => !x.value.trim());
    if (manquant) {
      manquant.focus();
      toast('Remplis les champs obligatoires', 'err');
      return;
    }
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    try {
      const r = await onValider(lireForm(form), form);
      if (r !== false) fermer();
    } catch (err) {
      console.error(err);
      toast(err.message || 'Erreur lors de l’enregistrement', 'err');
    } finally {
      btn.disabled = false;
    }
  };
  if (!dlg.open) dlg.showModal();
  $('.feuille-corps', dlg).scrollTop = 0;
  if (onOuvert) onOuvert(form, dlg);
  return { form, fermer };
}

export function confirmer(message, ok = 'Confirmer') {
  return new Promise((resolve) => {
    const d = $('#confirm');
    let reponse = false;
    d.innerHTML = html`<div class="confirm-boite"><p>${message}</p><div class="confirm-actions">
      <button class="btn" data-r="0">Annuler</button><button class="btn btn-plein" data-r="1">${ok}</button></div></div>`;
    $$('button', d).forEach((b) => (b.onclick = () => { reponse = b.dataset.r === '1'; d.close(); }));
    // Fermeture par Échap ou bouton retour d'Android = « Annuler » : la promesse se termine toujours.
    d.addEventListener('close', () => resolve(reponse), { once: true });
    d.showModal();
  });
}

// ---------- Photos ----------

/** Zone photos : vignettes + bouton d'ajout. Les ids sont gardés dans un champ caché `name`. */
export function zonePhotos(name, ids = []) {
  return `<div class="photos" data-photos="${esc(name)}">
    <input type="hidden" name="${esc(name)}" value="${esc(ids.join(','))}">
    <div class="photos-liste"></div>
    <label class="photo-ajout">${ico('camera').v}<span>Photo</span>
      <input type="file" accept="image/*" multiple hidden></label>
  </div>`;
}

export async function brancherPhotos(root) {
  for (const zone of $$('[data-photos]', root)) {
    const champCache = $('input[type=hidden]', zone);
    const liste = $('.photos-liste', zone);
    const ids = () => champCache.value.split(',').filter(Boolean);
    const dessiner = async () => {
      liste.innerHTML = '';
      for (const id of ids()) {
        const url = await urlPhoto(id);
        if (!url) continue;
        const v = document.createElement('div');
        v.className = 'vignette';
        v.innerHTML = `<img src="${url}" alt=""><button type="button" aria-label="Retirer">×</button>`;
        v.querySelector('button').onclick = () => {
          champCache.value = ids().filter((x) => x !== id).join(',');
          dessiner();
        };
        v.querySelector('img').onclick = () => voirPhoto(url);
        liste.appendChild(v);
      }
    };
    $('input[type=file]', zone).onchange = async (e) => {
      for (const f of e.target.files) {
        try {
          const id = await ajouterPhoto(await compresserImage(f));
          champCache.value = [...ids(), id].join(',');
        } catch (err) {
          toast(err.message, 'err');
        }
      }
      e.target.value = '';
      dessiner();
    };
    dessiner();
  }
}

export function voirPhoto(url) {
  const d = $('#confirm');
  d.innerHTML = `<div class="photo-grande"><img src="${url}" alt=""><button class="btn btn-plein">Fermer</button></div>`;
  $('button', d).onclick = () => d.close();
  d.showModal();
}

export const idsPhotos = (s) => (Array.isArray(s) ? s : String(s || '').split(',').filter(Boolean));

// ---------- Divers ----------

export function vide(message, action = '') {
  return html`<div class="vide"><p>${message}</p>${raw(action)}</div>`;
}

export function barre(valeur, max, cls = '') {
  const pct = max ? Math.min(100, Math.round((valeur / max) * 100)) : 0;
  return `<div class="barre ${cls}"><span style="width:${pct}%"></span></div>`;
}
