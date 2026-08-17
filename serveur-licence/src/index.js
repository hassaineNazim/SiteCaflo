/**
 * Caflo — serveur de licences d'essai (Cloudflare Worker + D1)
 *
 * Trois routes :
 *   POST /api/essai      le site envoie le formulaire, reçoit une clé d'essai
 *   POST /api/activation l'application envoie clé + identifiant machine,
 *                        reçoit un jeton signé Ed25519 avec la date d'expiration
 *   POST /api/verifier   revalidation périodique (facultatif, met à jour "dernier_vu")
 *
 * Le jeton est signé côté serveur et vérifié hors ligne par l'application :
 * modifier la date d'expiration casse la signature.
 */

const DUREE_ESSAI_JOURS = 2;
const FORMULES = ['caisse', 'salle', 'express', 'suite'];
const MAX_ESSAIS_PAR_IP_PAR_JOUR = 5;

/* ---------------------------------------------------------------
   Utilitaires
   --------------------------------------------------------------- */

const encodeur = new TextEncoder();

function b64url(donnees) {
  const octets = donnees instanceof Uint8Array ? donnees : new Uint8Array(donnees);
  let binaire = '';
  for (const o of octets) binaire += String.fromCharCode(o);
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function json(corps, statut = 200, origine = '*') {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': origine,
      'cache-control': 'no-store',
    },
  });
}

/** Clé lisible au téléphone : CAFLO-A3F9-K21M-7QX4 (sans I, O, 0, 1 — ambigus à l'oral). */
function genererCle() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const octets = crypto.getRandomValues(new Uint8Array(12));
  let sortie = '';
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) sortie += '-';
    sortie += alphabet[octets[i] % alphabet.length];
  }
  return 'CAFLO-' + sortie;
}

function nettoyer(valeur, max = 120) {
  return String(valeur ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

/** Accepte 0555123456, +213555123456, 00213 555 12 34 56… */
function telephoneValide(tel) {
  const chiffres = tel.replace(/[^\d+]/g, '');
  return /^(\+?213|0)\d{8,10}$/.test(chiffres);
}

/* ---------------------------------------------------------------
   Signature Ed25519
   --------------------------------------------------------------- */

let cleSigningCache = null;

async function cleDeSignature(env) {
  if (cleSigningCache) return cleSigningCache;
  const jwk = JSON.parse(env.CLE_PRIVEE_JWK);
  cleSigningCache = await crypto.subtle.importKey('jwk', jwk, { name: 'Ed25519' }, false, ['sign']);
  return cleSigningCache;
}

/**
 * Produit "<payload base64url>.<signature base64url>".
 * L'application vérifie la signature avec la clé publique embarquée dans le binaire.
 */
async function signerJeton(env, charge) {
  const cle = await cleDeSignature(env);
  const payload = b64url(encodeur.encode(JSON.stringify(charge)));
  const signature = await crypto.subtle.sign({ name: 'Ed25519' }, cle, encodeur.encode(payload));
  return `${payload}.${b64url(signature)}`;
}

/* ---------------------------------------------------------------
   POST /api/essai — le formulaire du site
   --------------------------------------------------------------- */

async function demanderEssai(request, env, origine) {
  let corps;
  try {
    corps = await request.json();
  } catch {
    return json({ erreur: 'Requête illisible.' }, 400, origine);
  }

  const nom = nettoyer(corps.nom, 80);
  const etablissement = nettoyer(corps.etablissement, 80);
  const ville = nettoyer(corps.ville, 60);
  const telephone = nettoyer(corps.telephone, 30);
  const email = nettoyer(corps.email, 120).toLowerCase();
  const formule = nettoyer(corps.formule, 20).toLowerCase();

  if (nom.length < 2) return json({ erreur: 'Merci d’indiquer votre nom.' }, 400, origine);
  if (etablissement.length < 2) return json({ erreur: 'Merci d’indiquer le nom de votre établissement.' }, 400, origine);
  if (!telephoneValide(telephone)) return json({ erreur: 'Numéro de téléphone invalide.' }, 400, origine);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ erreur: 'Adresse e-mail invalide.' }, 400, origine);
  if (!FORMULES.includes(formule)) return json({ erreur: 'Formule inconnue.' }, 400, origine);

  // Pot de miel : les robots remplissent tous les champs, les humains ne voient pas celui-ci.
  if (nettoyer(corps.societe)) return json({ erreur: 'Requête refusée.' }, 400, origine);

  const ip = request.headers.get('cf-connecting-ip') ?? '';
  const maintenant = Date.now();
  const telNormalise = telephone.replace(/[^\d]/g, '').slice(-9);

  // Même numéro = même clé. Le restaurateur qui a perdu sa clé la retrouve,
  // et on ne multiplie pas les essais pour un seul établissement.
  const existant = await env.DB.prepare(
    'SELECT cle, formule FROM prospects WHERE tel_normalise = ?1 LIMIT 1'
  ).bind(telNormalise).first();

  if (existant) {
    return json({
      cle: existant.cle,
      formule: existant.formule,
      deja_demande: true,
      telechargement: env.URL_TELECHARGEMENT,
    }, 200, origine);
  }

  const depuis24h = maintenant - 86_400_000;
  const { total } = await env.DB.prepare(
    'SELECT COUNT(*) AS total FROM prospects WHERE ip = ?1 AND cree_le > ?2'
  ).bind(ip, depuis24h).first();

  if (total >= MAX_ESSAIS_PAR_IP_PAR_JOUR) {
    return json({ erreur: 'Trop de demandes depuis cette connexion. Contactez-nous au +213 673 35 61 65.' }, 429, origine);
  }

  const cle = genererCle();
  await env.DB.prepare(
    `INSERT INTO prospects (id, nom, etablissement, ville, telephone, tel_normalise, email, formule, cle, cree_le, ip, ua)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)`
  ).bind(
    crypto.randomUUID(), nom, etablissement, ville, telephone, telNormalise,
    email || null, formule, cle, maintenant, ip,
    nettoyer(request.headers.get('user-agent'), 200)
  ).run();

  return json({ cle, formule, telechargement: env.URL_TELECHARGEMENT }, 200, origine);
}

/* ---------------------------------------------------------------
   POST /api/activation — le premier lancement de l'application
   --------------------------------------------------------------- */

async function activer(request, env, origine) {
  let corps;
  try {
    corps = await request.json();
  } catch {
    return json({ erreur: 'Requête illisible.' }, 400, origine);
  }

  const cle = nettoyer(corps.cle, 40).toUpperCase();
  const machine = nettoyer(corps.machine, 64);
  if (!cle || !machine) return json({ erreur: 'Clé ou identifiant machine manquant.' }, 400, origine);

  const prospect = await env.DB.prepare(
    'SELECT id, formule, etablissement FROM prospects WHERE cle = ?1 LIMIT 1'
  ).bind(cle).first();

  if (!prospect) return json({ erreur: 'Clé inconnue.' }, 404, origine);

  const maintenant = Date.now();

  // Une clé est liée à la première machine qui l'active. Réactiver depuis
  // cette même machine renvoie la même date d'expiration : réinstaller
  // l'application ne relance pas l'essai.
  const activation = await env.DB.prepare(
    'SELECT machine_id, expire_le FROM activations WHERE cle = ?1 LIMIT 1'
  ).bind(cle).first();

  let expire_le;
  if (activation) {
    if (activation.machine_id !== machine) {
      return json({ erreur: 'Cette clé est déjà utilisée sur un autre poste.' }, 409, origine);
    }
    expire_le = activation.expire_le;
    await env.DB.prepare('UPDATE activations SET dernier_vu = ?1 WHERE cle = ?2')
      .bind(maintenant, cle).run();
  } else {
    expire_le = maintenant + DUREE_ESSAI_JOURS * 86_400_000;
    await env.DB.prepare(
      'INSERT INTO activations (cle, machine_id, active_le, expire_le, dernier_vu) VALUES (?1,?2,?3,?4,?5)'
    ).bind(cle, machine, maintenant, expire_le, maintenant).run();
  }

  const jeton = await signerJeton(env, {
    v: 1,
    id: prospect.id,
    cle,
    formule: prospect.formule,
    etablissement: prospect.etablissement,
    machine,
    essai: true,
    emis_le: maintenant,
    expire_le,
  });

  return json({ jeton, formule: prospect.formule, expire_le }, 200, origine);
}

/* ---------------------------------------------------------------
   POST /api/verifier — revalidation quand l'application est en ligne
   --------------------------------------------------------------- */

async function verifier(request, env, origine) {
  let corps;
  try {
    corps = await request.json();
  } catch {
    return json({ erreur: 'Requête illisible.' }, 400, origine);
  }

  const cle = nettoyer(corps.cle, 40).toUpperCase();
  const machine = nettoyer(corps.machine, 64);

  const ligne = await env.DB.prepare(
    'SELECT expire_le, revoquee FROM activations WHERE cle = ?1 AND machine_id = ?2 LIMIT 1'
  ).bind(cle, machine).first();

  if (!ligne) return json({ valide: false, motif: 'introuvable' }, 404, origine);
  if (ligne.revoquee) return json({ valide: false, motif: 'revoquee' }, 403, origine);

  await env.DB.prepare('UPDATE activations SET dernier_vu = ?1 WHERE cle = ?2 AND machine_id = ?3')
    .bind(Date.now(), cle, machine).run();

  return json({ valide: Date.now() < ligne.expire_le, expire_le: ligne.expire_le }, 200, origine);
}

/* ---------------------------------------------------------------
   Routage
   --------------------------------------------------------------- */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const demandeur = request.headers.get('origin') ?? '';
    const autorisees = (env.ORIGINES_AUTORISEES ?? '').split(',').map(o => o.trim()).filter(Boolean);
    const origine = autorisees.includes(demandeur) ? demandeur : (autorisees[0] ?? '*');

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': origine,
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'content-type',
          'access-control-max-age': '86400',
        },
      });
    }

    if (request.method !== 'POST') {
      return json({ erreur: 'Méthode non autorisée.' }, 405, origine);
    }

    try {
      switch (url.pathname) {
        case '/api/essai':      return await demanderEssai(request, env, origine);
        case '/api/activation': return await activer(request, env, origine);
        case '/api/verifier':   return await verifier(request, env, origine);
        default:                return json({ erreur: 'Route inconnue.' }, 404, origine);
      }
    } catch (e) {
      console.error(e);
      return json({ erreur: 'Erreur serveur.' }, 500, origine);
    }
  },
};
