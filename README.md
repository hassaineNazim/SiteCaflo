# Caflo — site vitrine

Site statique (HTML / CSS / JS, sans dépendance ni build) construit à partir de la
maquette `Caflo — Design du site web.zip`.

## Contenu

```
index.html         page unique
styles.css         styles (variables de couleurs en haut du fichier)
main.js            préchargeur, menu mobile, révélations, parcours interactif
img/               images optimisées en WebP (+ favicons et image de partage)
site.webmanifest   icônes / nom pour l'installation sur mobile
robots.txt         indexation
sitemap.xml        plan du site
_design/           maquette d'origine — NE PAS mettre en ligne
```

## Lancer en local

```bash
npx serve -l 4321 .
```

Puis ouvrir http://localhost:4321

## Mettre en ligne

Déposer à la racine du serveur : `index.html`, `styles.css`, `main.js`, `img/`,
`site.webmanifest`, `robots.txt`, `sitemap.xml`. **Ne pas** publier `_design/`.

Fonctionne tel quel sur n'importe quel hébergement statique (Netlify, Vercel,
Cloudflare Pages, GitHub Pages, ou un simple dossier Apache/Nginx).

Avant la mise en ligne, remplacer `https://caflo.dz/` par le domaine réel dans :
`index.html` (balises `canonical`, `og:url`, `og:image`, `twitter:image`,
et le bloc JSON-LD) et `robots.txt` / `sitemap.xml`.

## Contenus à compléter

Repris tels quels de la maquette, ils attendent les vraies données :

- **Chiffres clés** — trois `—` dans la section « Établissements équipés /
  Commandes traitées / Villes couvertes » (`.stats` dans `index.html`).
- **Témoignages** — trois citations d'exemple (`.quotes`).
- **Logos clients** — six emplacements « Logo client » dans le bandeau défilant
  (`.marquee`). Seuls Smashki et Emporio Café sont réels.
- **Photos d'établissements** — quatre vignettes rayées dans « Solutions »
  (restaurants, pizzerias, boulangeries, groupes). Fast-food et cafés ont
  leur photo.
- **Menu « Tarifs »** — l'ancre pointe vers le bloc d'appel à l'action ; il n'y a
  pas encore de grille tarifaire dans la maquette.
- **Mentions légales** — le lien de pied de page renvoie au bloc de contact.

## Notes techniques

- Toutes les images ont été converties en **WebP** et redimensionnées :
  6,9 Mo → 0,86 Mo au total. Les originaux restent dans `_design/uploads/`.
- Le **préchargeur** (animation du logo) ne s'affiche qu'une fois par session
  (`sessionStorage`), et pas du tout si le visiteur a activé « réduire les
  animations ».
- Le **parcours d'une commande** défile automatiquement toutes les 4,2 s, se met
  en pause hors écran ou quand l'onglet est en arrière-plan, et s'arrête dès que
  le visiteur clique une étape. Navigable au clavier (flèches, Début, Fin).
- Le **menu mobile** apparaît sous 1120 px (la maquette masquait simplement la
  navigation).
- Respect de `prefers-reduced-motion`, styles d'impression, et repli `<noscript>`.
- Les boutons « Demander une démonstration » ouvrent un e-mail prérempli vers
  `contact@caflo.dz`. Pour un vrai formulaire, il faudra un service d'envoi
  (Formspree, Netlify Forms, ou un endpoint maison).
