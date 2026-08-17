/**
 * Génère la paire de clés Ed25519 qui signe les jetons de licence.
 *
 *   node scripts/generer-cles.mjs
 *
 * - la clé PRIVÉE part dans un secret Cloudflare (jamais dans le dépôt) ;
 * - la clé PUBLIQUE est embarquée dans le binaire de l'application.
 *
 * À exécuter UNE SEULE FOIS. Regénérer la paire invalide tous les jetons
 * déjà émis chez les clients.
 */

import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');

const privee = privateKey.export({ format: 'jwk' });
const publique = publicKey.export({ format: 'jwk' });

console.log('\n========================================================');
console.log('  CLÉ PRIVÉE — secret Cloudflare, à ne jamais commiter');
console.log('========================================================\n');
console.log(JSON.stringify(privee));
console.log('\nÀ coller dans :  npx wrangler secret put CLE_PRIVEE_JWK\n');

console.log('========================================================');
console.log('  CLÉ PUBLIQUE — à embarquer dans l\'application Electron');
console.log('========================================================\n');
console.log(JSON.stringify(publique));
console.log('\nÀ recopier dans integration-electron/licence.js (CLE_PUBLIQUE_JWK).\n');
