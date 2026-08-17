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

Trois étapes, dans cet ordre.

### 1. Héberger l'installeur

Créer un dépôt GitHub **séparé** `caflo-releases`, publier une *release* et y
attacher l'installeur nommé **`Caflo-Setup.exe`**, sans numéro de version dans le
nom de fichier — c'est ce qui fait fonctionner l'URL permanente :

```
https://github.com/hassaineNazim/caflo-releases/releases/latest/download/Caflo-Setup.exe
```

Gratuit, 2 Go par fichier, téléchargements illimités. Le site lit aussi le
numéro de version et le poids du fichier via l'API GitHub, et les affiche dans
la section « Essai gratuit ».

### 2. Déployer le serveur de licences

```bash
cd serveur-licence
npm install -g wrangler
wrangler d1 create caflo-licences          # copier l'id dans wrangler.toml
wrangler d1 execute caflo-licences --remote --file=schema.sql
node scripts/generer-cles.mjs              # génère la paire Ed25519
wrangler secret put CLE_PRIVEE_JWK         # coller la clé PRIVÉE
wrangler deploy
```

Reporter l'URL du Worker dans `main.js` (`CONFIG.apiLicence`) et la clé
**publique** dans `integration-electron/licence.js`.

Tout tient dans les paliers gratuits de Cloudflare (100 000 requêtes/jour,
base D1 de 5 Go).

### 3. Brancher l'application

Voir `integration-electron/README.md`. En résumé : un seul installeur pour les
quatre formules, c'est le jeton signé qui débloque les modules.

**Comment fonctionne l'essai.** Le site délivre une clé `CAFLO-XXXX-XXXX-XXXX`
contre le formulaire. Au premier lancement, l'application échange cette clé
contre un jeton signé Ed25519 contenant la date d'expiration, et se lie au poste
via son `MachineGuid`. Les 2 jours démarrent **à l'activation**, pas au
téléchargement. Ensuite tout est vérifié hors ligne. Réinstaller ne relance pas
l'essai : le serveur renvoie la même date d'expiration pour le même poste.

À l'expiration, l'application se verrouille **sans supprimer les données** — la
carte et les réglages saisis pendant l'essai doivent survivre au passage en
formule payante.

Pour changer la durée : `DUREE_ESSAI_JOURS` dans `serveur-licence/src/index.js`,
puis redéployer. Les essais déjà activés gardent leur date d'origine.

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
- Le **menu mobile** apparaît sous 1120 px (la maquette masquait simplement la
  navigation).
- Respect de `prefers-reduced-motion`, styles d'impression, et repli `<noscript>`.
- Les boutons « Demander une démonstration » ouvrent un e-mail prérempli vers
  `contact@caflo.dz`. Pour un vrai formulaire, il faudra un service d'envoi
  (Formspree, Netlify Forms, ou un endpoint maison).
