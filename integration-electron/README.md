# Intégration dans l'application Electron

À copier dans le projet de l'application Caflo (pas dans le dépôt du site) :

```
licence.js        vérification + activation (processus principal)
machine-id.js     identifiant de poste
activation.html   fenêtre de saisie de la clé
```

## 1. Configurer

Dans `licence.js`, renseigner :

- `CLE_PUBLIQUE_JWK` — la partie publique produite par
  `serveur-licence/scripts/generer-cles.mjs` ;
- `URL_SERVEUR` — l'URL du Worker déployé.

## 2. Brancher dans `main.js`

```js
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');
const licence = require('./licence');

let fenetre;

function ouvrirActivation() {
  fenetre = new BrowserWindow({
    width: 520, height: 560, resizable: false, autoHideMenuBar: true,
    title: 'Activer Caflo',
    webPreferences: { preload: path.join(__dirname, 'preload-activation.js') },
  });
  fenetre.loadFile(path.join(__dirname, 'activation.html'));
}

function ouvrirApplication(etat) {
  fenetre = new BrowserWindow({ width: 1440, height: 900, show: false });
  fenetre.maximize();
  fenetre.loadFile('index.html');
  fenetre.once('ready-to-show', () => {
    fenetre.show();
    // L'interface se sert de ceci pour masquer les modules non inclus
    // dans la formule et afficher le bandeau « essai — N h restantes ».
    fenetre.webContents.send('licence:etat', etat);
  });
}

app.whenReady().then(() => {
  const etat = licence.etatLicence();

  switch (etat.statut) {
    case 'actif':
      ouvrirApplication(etat);
      licence.revaliderEnArrierePlan();   // non bloquant
      break;
    case 'expire':
      // IMPORTANT : ne rien supprimer. On ouvre l'application en lecture
      // seule pour que le restaurateur retrouve sa carte et ses réglages
      // dès qu'il passe en formule payante.
      ouvrirApplication(etat);
      break;
    default:                              // absent, invalide, horloge
      ouvrirActivation();
  }
});

ipcMain.handle('licence:activer', async (_e, cle) => licence.activer(cle));
ipcMain.handle('licence:terminer', () => {
  const etat = licence.etatLicence();
  fenetre.close();
  ouvrirApplication(etat);
});
ipcMain.handle('licence:site', () => shell.openExternal('https://caflo.dz/#telecharger'));
```

`preload-activation.js` :

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('caflo', {
  activer: cle => ipcRenderer.invoke('licence:activer', cle),
  terminer: () => ipcRenderer.invoke('licence:terminer'),
  ouvrirSite: () => ipcRenderer.invoke('licence:site'),
});
```

## 3. Gating des modules

`etat.modules` liste les modules autorisés par la formule. Côté interface :

```js
window.electron.on('licence:etat', etat => {
  const autorises = new Set(etat.modules ?? []);
  document.querySelectorAll('[data-module]').forEach(el => {
    if (!autorises.has(el.dataset.module)) el.classList.add('module-verrouille');
  });
});
```

Un seul installeur pour les quatre formules : c'est le jeton signé qui décide.
Passer de Caisse à Suite = nouvelle clé, aucune réinstallation.

## 4. Droits d'écriture sur `%ProgramData%\Caflo`

La licence est écrite dans `%ProgramData%\Caflo\licence.json` (commune à toutes
les sessions Windows du poste, contrairement au profil utilisateur). L'installeur
doit créer ce dossier et y donner les droits d'écriture — avec electron-builder,
via un script NSIS :

```nsis
!macro customInstall
  CreateDirectory "$APPDATA\..\..\ProgramData\Caflo"
  AccessControl::GrantOnFile "$COMMONPROGRAMDATA\Caflo" "(BU)" "FullAccess"
!macroend
```

## 5. Ce que ça tient, ce que ça ne tient pas

Tient :

- modifier la date d'expiration dans le fichier — la signature ne correspond plus ;
- supprimer `licence.json` et réactiver — le serveur renvoie la **même** date
  d'expiration pour ce poste ;
- réinstaller Windows Update, changer de session, déplacer le dossier — le
  `MachineGuid` ne bouge pas ;
- reculer l'horloge système — refusé au-delà de 6 h de recul.

Ne tient pas :

- reformater le poste (nouveau `MachineGuid`) — nouvel essai possible, mais
  personne ne reformate une caisse pour gagner 2 jours ;
- patcher le binaire pour remplacer la clé publique. Aucune protection
  logicielle n'y résiste. Le rôle de ce dispositif est d'arrêter le
  contournement occasionnel.

## 6. Tester sans serveur

```bash
node -e "
const l = require('./licence');
console.log(l.etatLicence());          // { statut: 'absent' }
console.log(l.cheminLicence());
"
```

Pour tester l'expiration, déployer le Worker avec `DUREE_ESSAI_JOURS` à une
petite valeur, ou modifier temporairement la constante dans `src/index.js`.
