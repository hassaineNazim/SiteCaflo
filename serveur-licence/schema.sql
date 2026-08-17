-- Caflo — base des essais (Cloudflare D1)

CREATE TABLE IF NOT EXISTS prospects (
  id            TEXT PRIMARY KEY,
  nom           TEXT NOT NULL,
  etablissement TEXT NOT NULL,
  ville         TEXT,
  telephone     TEXT NOT NULL,
  tel_normalise TEXT NOT NULL,          -- 9 derniers chiffres, pour dédoublonner
  email         TEXT,
  formule       TEXT NOT NULL,          -- caisse | salle | express | suite
  cle           TEXT NOT NULL UNIQUE,
  cree_le       INTEGER NOT NULL,       -- epoch ms
  ip            TEXT,
  ua            TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prospects_tel ON prospects (tel_normalise);
CREATE INDEX IF NOT EXISTS idx_prospects_ip  ON prospects (ip, cree_le);

CREATE TABLE IF NOT EXISTS activations (
  cle        TEXT NOT NULL,
  machine_id TEXT NOT NULL,
  active_le  INTEGER NOT NULL,
  expire_le  INTEGER NOT NULL,
  dernier_vu INTEGER,
  revoquee   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (cle, machine_id)
);

CREATE INDEX IF NOT EXISTS idx_activations_cle ON activations (cle);
