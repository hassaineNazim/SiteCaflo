# Caflo — site vitrine

Site statique (HTML / CSS / JS, sans dépendance ni build) construit à partir de la
maquette `Caflo — Design du site web.zip`.

## Contenu

```
index.html            page d'accueil
installer.html        guide d'installation pas à pas
styles.css            styles (variables de couleurs en haut du fichier)
main.js               préchargeur, menu mobile, révélations, parcours,
                      modale d'essai — CONFIG à renseigner en haut du fichier
img/                  images optimisées en WebP (+ favicons et image de partage)
site.webmanifest      icônes / nom pour l'installation sur mobile
robots.txt            indexation
sitemap.xml           plan du site

serveur-licence/      Cloudflare Worker : émission des clés et activation
integration-electron/ à copier dans le projet de l'application Windows
_design/              maquette d'origine — NE PAS mettre en ligne
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

## Essai gratuit — mise en route

### 1. Héberger les installeurs d'essai

Créer un dépôt GitHub **public et séparé** `caflo-essais`, publier une *release*
et y attacher les **quatre** installeurs, nommés exactement :

```
Caflo-Caisse-Essai-Setup.exe
Caflo-Salle-Essai-Setup.exe
Caflo-Express-Essai-Setup.exe
Caflo-Suite-Essai-Setup.exe
```

Sans numéro de version dans le nom : c'est ce qui fait fonctionner l'URL
permanente `…/releases/latest/download/<fichier>`, et donc les boutons du site
sans avoir à les modifier à chaque release.

**Ne pas publier les essais dans `caflo-release`.** Ce dépôt sert aux mises à
jour de production : l'updater lit `releases/latest/download/latest.json`, et
une release plus récente dépourvue de ce fichier couperait les mises à jour de
tous les postes déjà installés.

Gratuit, 2 Go par fichier, téléchargements illimités. Le site lit le numéro de
version et le poids via l'API GitHub et les affiche dans la section « Essai
gratuit » ; tant qu'aucune release n'existe, il affiche « bientôt disponible ».

### 2. Le formulaire de capture (facultatif)

`main.js` est livré avec `CONFIG.telechargementDirect = true` : les boutons
d'essai téléchargent directement, sans formulaire. C'est le mode à garder tant
que le Worker n'est pas déployé.

Pour récupérer les coordonnées des prospects, déployer le Worker puis repasser
`telechargementDirect` à `false` — la modale et son code sont intacts.

```bash
cd serveur-licence
npm install -g wrangler
wrangler d1 create caflo-licences          # copier l'id dans wrangler.toml
wrangler d1 execute caflo-licences --remote --file=schema.sql
wrangler deploy
```

Reporter l'URL du Worker dans `main.js` (`CONFIG.apiLicence`), et ajouter le
domaine de production dans `ORIGINES_AUTORISEES` (`wrangler.toml`) — sinon le
CORS bloquera le formulaire en ligne.

Tout tient dans les paliers gratuits de Cloudflare (100 000 requêtes/jour,
base D1 de 5 Go).

### Comment fonctionne l'essai

La limite de 2 jours est **dans le binaire** : quatre builds distinctes, chacune
avec son identifiant et son dossier de données, installables à côté de la
version complète sans rien écraser. Le visiteur n'a aucune clé à saisir, et
l'essai démarre au premier lancement.

Le serveur de licences (clés `CAFLO-XXXX-XXXX-XXXX`, jetons Ed25519, activation
liée au `MachineGuid`) reste dans `serveur-licence/` et `integration-electron/`.
Il n'est pas utilisé par ce modèle ; il sert de base si vous voulez plus tard
une activation en ligne ou une révocation à distance. À noter :
`integration-electron/` suppose Node dans le processus principal, alors que
l'application est bâtie avec Tauri — un portage serait nécessaire.

### À prévoir : signature du code

Un `.exe` non signé déclenche « Windows a protégé votre ordinateur » au
téléchargement. `installer.html` explique la manipulation aux clients, mais un
certificat de signature de code (~200-400 €/an, clé privée sur token matériel
obligatoire depuis 2023) reste la vraie solution.

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
- Le **menu mobile** apparaît sous 1220 px (la maquette masquait simplement la
  navigation).
- Respect de `prefers-reduced-motion`, styles d'impression, et repli `<noscript>`.
- Les boutons « Demander une démonstration » ouvrent un e-mail prérempli vers
  `contact@caflo.dz`. Pour un vrai formulaire, il faudra un service d'envoi
  (Formspree, Netlify Forms, ou un endpoint maison).
