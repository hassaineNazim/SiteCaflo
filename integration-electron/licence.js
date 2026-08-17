'use strict';

/**
 * Caflo — licence d'essai côté application (processus principal Electron).
 *
 * Principe
 *   1. Au premier lancement, l'utilisateur saisit la clé reçue sur le site.
 *   2. L'application envoie clé + identifiant machine au serveur, qui renvoie
 *      un jeton signé Ed25519 contenant la date d'expiration.
 *   3. Le jeton est stocké localement ; les lancements suivants sont vérifiés
 *      HORS LIGNE avec la clé publique embarquée ici.
 *
 * Ce que ça empêche
 *   - modifier la date d'expiration : la signature ne correspond plus ;
 *   - réinstaller pour relancer l'essai : le serveur renvoie la même date
 *     d'expiration pour le même identifiant machine ;
 *   - reculer l'horloge : on garde la dernière date vue et on refuse le recul.
 *
 * Ce que ça n'empêche pas
 *   - un utilisateur déterminé qui modifie le binaire pour remplacer la clé
 *     publique. Aucune protection purement logicielle n'y résiste ; l'objectif
 *     est d'arrêter le contournement occasionnel, pas le reverse engineering.
 */

const fs = require('node:fs');
const path = require('node:path');
const { createPublicKey, verify } = require('node:crypto');
const { identifiantMachine } = require('./machine-id');

/* ---------------------------------------------------------------
   Configuration — à adapter
   --------------------------------------------------------------- */

// Sortie de `node scripts/generer-cles.mjs` (partie PUBLIQUE uniquement).
const CLE_PUBLIQUE_JWK = {
  kty: 'OKP',
  crv: 'Ed25519',
  x: 'REMPLACER_PAR_LA_CLE_PUBLIQUE',
};

const URL_SERVEUR = 'https://caflo-licence.<votre-sous-domaine>.workers.dev';

/** Modules débloqués par formule. La formule vient du jeton signé. */
const MODULES = {
  caisse:  ['caisse', 'commandes', 'tickets', 'rapport_jour'],
  salle:   ['caisse', 'commandes', 'tickets', 'rapport_jour', 'plan_salle', 'app_serveur', 'sync'],
  express: ['caisse', 'commandes', 'tickets', 'rapport_jour', 'express', 'livraison', 'beeper'],
  suite:   ['caisse', 'commandes', 'tickets', 'rapport_jour', 'plan_salle', 'app_serveur', 'sync',
            'express', 'livraison', 'beeper', 'stock', 'recettes', 'charges', 'patron', 'statistiques'],
};

// Tolérance de recul d'horloge : un poste mal réglé ou un changement d'heure
// ne doit pas bloquer un restaurant en plein service.
const TOLERANCE_HORLOGE_MS = 6 * 60 * 60 * 1000;

/* ---------------------------------------------------------------
   Stockage
   --------------------------------------------------------------- */

/**
 * ProgramData plutôt que le profil utilisateur : une caisse tourne souvent
 * sous plusieurs sessions Windows, la licence doit être commune au poste.
 * L'installeur doit créer ce dossier avec les droits d'écriture.
 */
function cheminLicence() {
  const base = process.env.ProgramData || process.env.ALLUSERSPROFILE || require('node:os').tmpdir();
  return path.join(base, 'Caflo', 'licence.json');
}

function lireStockage() {
  try {
    return JSON.parse(fs.readFileSync(cheminLicence(), 'utf8'));
  } catch {
    return null;
  }
}

function ecrireStockage(donnees) {
  const chemin = cheminLicence();
  fs.mkdirSync(path.dirname(chemin), { recursive: true });
  fs.writeFileSync(chemin, JSON.stringify(donnees), 'utf8');
}

/* ---------------------------------------------------------------
   Vérification du jeton
   --------------------------------------------------------------- */

let clePublique = null;

function chargerClePublique() {
  if (!clePublique) clePublique = createPublicKey({ key: CLE_PUBLIQUE_JWK, format: 'jwk' });
  return clePublique;
}

/** Renvoie la charge utile si la signature est valide, sinon null. */
function ouvrirJeton(jeton) {
  if (typeof jeton !== 'string' || !jeton.includes('.')) return null;
  const [payload, signature] = jeton.split('.');
  if (!payload || !signature) return null;

  let valide;
  try {
    valide = verify(null, Buffer.from(payload), chargerClePublique(), Buffer.from(signature, 'base64url'));
  } catch {
    return null;
  }
  if (!valide) return null;

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------
   État de la licence
   --------------------------------------------------------------- */

/**
 * @returns {{statut: string, formule?: string, modules?: string[],
 *            expire_le?: number, heuresRestantes?: number, message?: string}}
 *
 * statut :
 *   'absent'   aucune licence → afficher la fenêtre d'activation
 *   'invalide' jeton illisible, falsifié, ou émis pour une autre machine
 *   'horloge'  l'horloge système a reculé → exiger une revérification en ligne
 *   'expire'   essai terminé → verrouiller l'interface SANS toucher aux données
 *   'actif'    tout va bien
 */
function etatLicence() {
  const stockage = lireStockage();
  if (!stockage?.jeton) return { statut: 'absent' };

  const charge = ouvrirJeton(stockage.jeton);
  if (!charge) return { statut: 'invalide', message: 'Licence illisible ou modifiée.' };

  if (charge.machine !== identifiantMachine()) {
    return { statut: 'invalide', message: 'Cette licence a été activée sur un autre poste.' };
  }

  const maintenant = Date.now();

  if (stockage.dernier_vu && maintenant < stockage.dernier_vu - TOLERANCE_HORLOGE_MS) {
    return { statut: 'horloge', message: 'La date du système a reculé. Reconnectez-vous pour vérifier la licence.' };
  }

  // On avance le repère anti-recul à chaque démarrage.
  if (!stockage.dernier_vu || maintenant > stockage.dernier_vu) {
    ecrireStockage({ ...stockage, dernier_vu: maintenant });
  }

  if (maintenant >= charge.expire_le) {
    return {
      statut: 'expire',
      formule: charge.formule,
      expire_le: charge.expire_le,
      message: 'Votre essai de Caflo est terminé.',
    };
  }

  return {
    statut: 'actif',
    formule: charge.formule,
    modules: MODULES[charge.formule] ?? MODULES.caisse,
    expire_le: charge.expire_le,
    heuresRestantes: Math.ceil((charge.expire_le - maintenant) / 3_600_000),
  };
}

/* ---------------------------------------------------------------
   Activation
   --------------------------------------------------------------- */

/**
 * Échange la clé saisie par l'utilisateur contre un jeton signé.
 * Nécessite une connexion internet — une seule fois, à l'installation.
 *
 * @param {string} cle  clé reçue sur caflo.dz, format CAFLO-XXXX-XXXX-XXXX
 */
async function activer(cle) {
  const propre = String(cle ?? '').trim().toUpperCase();
  if (!/^CAFLO-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(propre)) {
    return { ok: false, message: 'Format de clé invalide. Exemple : CAFLO-A3F9-K21M-7QX4' };
  }

  let reponse;
  try {
    reponse = await fetch(`${URL_SERVEUR}/api/activation`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cle: propre, machine: identifiantMachine() }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return { ok: false, message: 'Impossible de joindre le serveur. Vérifiez votre connexion internet.' };
  }

  const corps = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    return { ok: false, message: corps.erreur ?? 'Activation refusée.' };
  }

  const charge = ouvrirJeton(corps.jeton);
  if (!charge || charge.machine !== identifiantMachine()) {
    return { ok: false, message: 'Réponse du serveur invalide.' };
  }

  ecrireStockage({ jeton: corps.jeton, cle: propre, dernier_vu: Date.now() });

  return {
    ok: true,
    formule: charge.formule,
    expire_le: charge.expire_le,
    heuresRestantes: Math.ceil((charge.expire_le - Date.now()) / 3_600_000),
  };
}

/**
 * Revalidation silencieuse quand l'application est en ligne : permet de
 * révoquer une licence à distance et de corriger un décalage d'horloge.
 * À appeler au démarrage, sans bloquer si le réseau est absent.
 */
async function revaliderEnArrierePlan() {
  const stockage = lireStockage();
  if (!stockage?.cle) return;

  try {
    const reponse = await fetch(`${URL_SERVEUR}/api/verifier`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cle: stockage.cle, machine: identifiantMachine() }),
      signal: AbortSignal.timeout(10000),
    });
    const corps = await reponse.json().catch(() => ({}));

    if (reponse.status === 403 || corps.motif === 'revoquee') {
      fs.rmSync(cheminLicence(), { force: true });
      return;
    }
    if (corps.expire_le) {
      ecrireStockage({ ...stockage, dernier_vu: Date.now() });
    }
  } catch {
    // Hors ligne : le jeton local fait foi jusqu'à son expiration.
  }
}

module.exports = {
  etatLicence,
  activer,
  revaliderEnArrierePlan,
  MODULES,
  cheminLicence,
};
