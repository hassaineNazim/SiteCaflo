'use strict';

/**
 * Identifiant de poste, stable entre les réinstallations de Caflo.
 *
 * Source principale : MachineGuid, écrit par Windows à l'installation du système
 * et inchangé par une réinstallation d'application. Repli sur nom de machine +
 * adresse MAC si la clé de registre est illisible (poste verrouillé, non-Windows).
 */

const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const os = require('node:os');

let cache = null;

function lireMachineGuid() {
  // /reg:64 force la vue 64 bits même si l'application tourne en 32 bits.
  const sortie = execFileSync(
    'reg',
    ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid', '/reg:64'],
    { encoding: 'utf8', timeout: 5000, windowsHide: true }
  );
  const trouve = sortie.match(/MachineGuid\s+REG_SZ\s+([0-9a-f-]{36})/i);
  if (!trouve) throw new Error('MachineGuid introuvable');
  return trouve[1].toLowerCase();
}

function repli() {
  const interfaces = Object.values(os.networkInterfaces()).flat();
  const mac = interfaces
    .filter(i => i && !i.internal && i.mac && i.mac !== '00:00:00:00:00:00')
    .map(i => i.mac)
    .sort()[0] ?? 'sans-mac';
  return `${os.hostname()}|${mac}|${os.platform()}|${os.arch()}`;
}

/** Chaîne hexadécimale de 32 caractères. Ne contient aucune donnée personnelle en clair. */
function identifiantMachine() {
  if (cache) return cache;

  let source;
  try {
    source = process.platform === 'win32' ? lireMachineGuid() : repli();
  } catch {
    source = repli();
  }

  cache = createHash('sha256').update('caflo:v1:' + source).digest('hex').slice(0, 32);
  return cache;
}

module.exports = { identifiantMachine };
