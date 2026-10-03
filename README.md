# Carnet de chantier TPE

Application de gestion de chantier **hors ligne** pour les très petites entreprises (TPE) qui construisent des latrines familiales pour une ONG (par exemple dans le projet PASEA). Une application Vision Noble.

Chaque TPE l'installe sur son téléphone et saisit, au premier lancement, sa propre identité (nom, gérant, logo, Mobile Money), son ONG et son contrat. Les chiffres du modèle PASEA Hambol sont pré-remplis et modifiables : 325 000 F par latrine, avance de 50 %, 3 latrines par semaine, kit de quincaillerie à 196 500 F.

## Fonctions

- **Accueil** : avancement (une case par latrine), objectif de la semaine, caisse, alertes.
- **Latrines** : fiche par ménage (GPS, type, interface WC), étapes des travaux, contrôle qualité en 3 visites, défauts (48 h / 5 j), PV de réception, paiements de l'ONG (avance et solde calculés automatiquement).
- **Journal** : rapport du jour (sites, étapes finies, équipe, matériaux, achat, incident, EPI, photos), partage WhatsApp, PDF, journal hebdomadaire.
- **Argent** : entrées / sorties, Mobile Money, budget prévu vs réel, export CSV.
- **Kits & stock** : commandes à la quincaillerie, acompte, livraisons, stock par article.
- **Équipe** : ouvriers payés par latrine ou par jour, présences tirées du journal.
- **Factures**, **rapports PDF** (aperçu A4, enregistrement en PDF sans en-tête du navigateur, titres de colonnes et pied de page répétés sur chaque page), **sauvegarde / restauration**.
- **Marge 1 / Marge 2** : la Marge 1 (prix de base) est la marge officielle, reprise dans les rapports. La Marge 2 (option dans Réglages) utilise les prix réellement obtenus sur le terrain ; elle n'apparaît que sur l'accueil, repliée, et jamais dans les PDF, factures, partages WhatsApp ou exports.
- **Réglages — tout est modifiable** : TPE et logo, ONG et contrat, kit, budget, étapes des travaux, grille de contrôle qualité, types de latrines, interfaces WC.

## Technique

HTML/CSS/JS sans compilation (modules ES). Données dans IndexedDB du téléphone (rien n'est envoyé sur internet). Service worker (`sw.js`) pour le hors-ligne. Installable (PWA).

```bash
python -m http.server 8090
```

```bash
npm test
```

```bash
npm run check
```

À chaque mise en ligne : incrémenter `VERSION` dans `sw.js` et le `?v=` dans `index.html` (et dans la liste de `sw.js`).
