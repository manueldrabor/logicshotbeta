/* ══════════════════════════════════════
   leaderboard.js — Classement serveur
   Supabase (online) + localStorage (fallback)

   TABLE leaderboard :
     id         bigint  PK auto
     device_id  text    UNIQUE  (identifiant permanent de l'appareil)
     name       text    not null
     elo        int     default 1000
     wins       int     default 0
     updated_at timestamptz default now()

   SQL à exécuter dans Supabase si pas encore fait :
     ALTER TABLE leaderboard ADD COLUMN IF NOT EXISTS device_id text;
     CREATE UNIQUE INDEX IF NOT EXISTS lb_device_id_idx ON leaderboard(device_id);
══════════════════════════════════════ */

import { Save } from './state.js';

const SUPABASE_URL = 'https://msgfuyshsfxbjjsyzyvv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zZ2Z1eXNoc2Z4Ympqc3l6eXZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTI1NTQsImV4cCI6MjA5MjI4ODU1NH0.kHeUYsePZtYL7eYjb1gohHG6hTKEDNR18UR8FSazsHc';

const isConfigured = SUPABASE_URL !== 'VOTRE_URL_SUPABASE';

/* ── Requête générique Supabase REST ── */
async function supaFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(opts.headers || {})
    }
  });
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
  const txt = await res.text();
  return txt ? JSON.parse(txt) : [];
}

/* ══════════════════════════════════════
   VÉRIFICATION / RÉSERVATION DU NOM
   Retourne le nom final (avec suffixe si doublon)
══════════════════════════════════════ */
export async function reserveName(wantedName) {
  const deviceId = Save.getDeviceId();

  /* Déjà une ligne pour ce device → on met juste à jour le nom */
  if (!isConfigured) {
    Save.savePlayerName(wantedName);
    return wantedName;
  }

  try {
    /* 1. Chercher si ce device a déjà une entrée */
    const myRows = await supaFetch(
      `leaderboard?device_id=eq.${encodeURIComponent(deviceId)}&select=id,name`
    );

    if (myRows.length > 0) {
      /* Device connu — on met à jour le nom si différent */
      if (myRows[0].name !== wantedName) {
        await supaFetch(`leaderboard?id=eq.${myRows[0].id}`, {
          method: 'PATCH',
          headers: { Prefer: '' },
          body: JSON.stringify({ name: wantedName, updated_at: new Date().toISOString() })
        });
      }
      Save.savePlayerName(wantedName);
      return wantedName;
    }

    /* 2. Device inconnu — vérifier si le nom existe pour un AUTRE device */
    let finalName = wantedName;
    const existing = await supaFetch(
      `leaderboard?name=eq.${encodeURIComponent(wantedName)}&select=device_id`
    );
    if (existing.length > 0 && existing[0].device_id !== deviceId) {
      /* Nom pris par un autre → ajouter suffixe numérique */
      let suffix = 2;
      while (true) {
        const candidate = `${wantedName}#${suffix}`;
        const check = await supaFetch(
          `leaderboard?name=eq.${encodeURIComponent(candidate)}&select=id`
        );
        if (check.length === 0) { finalName = candidate; break; }
        suffix++;
        if (suffix > 99) { finalName = wantedName + '_' + deviceId.slice(0, 4); break; }
      }
    }

    Save.savePlayerName(finalName);
    return finalName;
  } catch(e) {
    console.warn('reserveName offline — fallback local', e);
    Save.savePlayerName(wantedName);
    return wantedName;
  }
}

/* ══ API PUBLIQUE ══ */

export async function fetchLeaderboard() {
  if (!isConfigured) return getLocalLeaderboard();
  try {
    const data = await supaFetch(
      'leaderboard?select=name,elo,wins&order=elo.desc&limit=10'
    );
    return data;
  } catch(e) {
    console.warn('Leaderboard offline — fallback local', e);
    return getLocalLeaderboard();
  }
}

export async function updateElo(name, eloDelta, won) {
  const deviceId = Save.getDeviceId();
  updateLocalElo(name, eloDelta);

  if (!isConfigured) return;
  try {
    const rows = await supaFetch(
      `leaderboard?device_id=eq.${encodeURIComponent(deviceId)}&select=id,elo,wins`
    );
    if (rows.length === 0) {
      /* Première fois pour ce device — insert */
      await supaFetch('leaderboard', {
        method: 'POST',
        body: JSON.stringify({
          device_id: deviceId,
          name,
          elo: Math.max(800, 1000 + eloDelta),
          wins: won ? 1 : 0
        })
      });
    } else {
      const row = rows[0];
      await supaFetch(`leaderboard?id=eq.${row.id}`, {
        method: 'PATCH',
        headers: { Prefer: '' },
        body: JSON.stringify({
          name,                                          // nom peut avoir changé
          elo: Math.max(800, row.elo + eloDelta),
          wins: (row.wins || 0) + (won ? 1 : 0),
          xp:   parseInt(localStorage.getItem('ls_xp') || '0'),
          beaten: localStorage.getItem('ls_beaten') || '[]',
          stars:  localStorage.getItem('ls_stars')  || '{}',
          updated_at: new Date().toISOString()
        })
      });
    }
  } catch(e) {
    console.warn('ELO sync failed — local only', e);
  }
}

/* ── Fallback localStorage ── */
function getLocalLeaderboard() {
  try {
    const elo = JSON.parse(localStorage.getItem('ls_elo') || '{}');
    return Object.entries(elo)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, eloVal]) => ({ name, elo: eloVal, wins: 0 }));
  } catch(e) { return []; }
}

function updateLocalElo(name, delta) {
  try {
    const elo = JSON.parse(localStorage.getItem('ls_elo') || '{}');
    elo[name] = Math.max(800, (elo[name] || 1000) + delta);
    localStorage.setItem('ls_elo', JSON.stringify(elo));
  } catch(e) {}
}

export function isOnlineLeaderboard() { return isConfigured; }

/* ══════════════════════════════════════
   SYNC PROGRESSION (XP / story / étoiles)
   SQL à exécuter UNE FOIS dans Supabase :
     ALTER TABLE leaderboard ADD COLUMN IF NOT EXISTS xp int DEFAULT 0;
     ALTER TABLE leaderboard ADD COLUMN IF NOT EXISTS beaten text DEFAULT '[]';
     ALTER TABLE leaderboard ADD COLUMN IF NOT EXISTS stars text DEFAULT '{}';
     ALTER TABLE leaderboard ADD COLUMN IF NOT EXISTS recovery_code text;
     CREATE UNIQUE INDEX IF NOT EXISTS lb_recovery_code_idx
       ON leaderboard(recovery_code) WHERE recovery_code IS NOT NULL;
══════════════════════════════════════ */

/* Pousse XP + beaten + stars vers Supabase (fire-and-forget) */
export async function syncProgressToCloud() {
  if (!isConfigured) return;
  const deviceId = Save.getDeviceId();
  try {
    const xp     = parseInt(localStorage.getItem('ls_xp')     || '0');
    const beaten = localStorage.getItem('ls_beaten') || '[]';
    const stars  = localStorage.getItem('ls_stars')  || '{}';
    const rows = await supaFetch(
      `leaderboard?device_id=eq.${encodeURIComponent(deviceId)}&select=id`
    );
    if (rows.length === 0) return; /* pas encore de ligne → updateElo créera */
    await supaFetch(`leaderboard?id=eq.${rows[0].id}`, {
      method: 'PATCH',
      headers: { Prefer: '' },
      body: JSON.stringify({ xp, beaten, stars, updated_at: new Date().toISOString() })
    });
  } catch(e) { /* fail silently */ }
}

/* Restaure progression depuis Supabase si localStorage vide (cache effacé) */
export async function loadProgressFromCloud() {
  if (!isConfigured) return;
  const deviceId = Save.getDeviceId();
  const localXp  = parseInt(localStorage.getItem('ls_xp') || '0');
  /* Si on a déjà du XP local, pas besoin de charger */
  if (localXp > 0) return;
  try {
    const rows = await supaFetch(
      `leaderboard?device_id=eq.${encodeURIComponent(deviceId)}&select=xp,beaten,stars,name`
    );
    if (!rows || rows.length === 0) return;
    const row = rows[0];
    /* Fusion : prend le max pour XP, union pour beaten, max par niveau pour stars */
    const cloudXp     = row.xp     || 0;
    const cloudBeaten = JSON.parse(row.beaten || '[]');
    const cloudStars  = JSON.parse(row.stars  || '{}');
    if (cloudXp > 0) localStorage.setItem('ls_xp', String(cloudXp));
    if (cloudBeaten.length > 0) localStorage.setItem('ls_beaten', JSON.stringify(cloudBeaten));
    if (Object.keys(cloudStars).length > 0) localStorage.setItem('ls_stars', JSON.stringify(cloudStars));
    if (row.name) Save.savePlayerName(row.name);
  } catch(e) { /* fail silently */ }
}

/* ══════════════════════════════════════
   CODE DE RÉCUPÉRATION
   Génère un code XXXX-YYYY lisible, unique
   et lié au device_id dans Supabase.
══════════════════════════════════════ */
function _genRecoveryCode() {
  const WORDS = ['TIGRE','AIGLE','LOUP','COBRA','LYNX','PUMA','VIPER','ORYX',
                 'BISON','DINGO','GECKO','HYENE','IBIS','JAGUAR','KOALA'];
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const num  = 1000 + Math.floor(Math.random() * 9000);
  return `${word}-${num}`;
}

/* Génère (ou récupère) le code de récupération pour ce device */
export async function getOrCreateRecoveryCode() {
  if (!isConfigured) return null;
  const deviceId = Save.getDeviceId();
  try {
    const rows = await supaFetch(
      `leaderboard?device_id=eq.${encodeURIComponent(deviceId)}&select=id,recovery_code`
    );
    if (!rows || rows.length === 0) return null;
    const row = rows[0];
    if (row.recovery_code) return row.recovery_code;
    /* Générer un code unique */
    let code, attempts = 0;
    do {
      code = _genRecoveryCode();
      attempts++;
      const check = await supaFetch(
        `leaderboard?recovery_code=eq.${encodeURIComponent(code)}&select=id`
      );
      if (check.length === 0) break;
    } while (attempts < 10);
    /* Sauvegarder le code */
    await supaFetch(`leaderboard?id=eq.${row.id}`, {
      method: 'PATCH',
      headers: { Prefer: '' },
      body: JSON.stringify({ recovery_code: code })
    });
    return code;
  } catch(e) { return null; }
}

/* Restaure la progression depuis un code de récupération saisi par l'utilisateur */
export async function restoreFromRecoveryCode(code) {
  if (!isConfigured) throw new Error('Mode hors ligne — impossible de restaurer.');
  const clean = code.trim().toUpperCase();
  try {
    const rows = await supaFetch(
      `leaderboard?recovery_code=eq.${encodeURIComponent(clean)}&select=device_id,name,elo,xp,beaten,stars`
    );
    if (!rows || rows.length === 0) throw new Error('Code introuvable. Vérifie la saisie.');
    const row = rows[0];
    /* Réassigner ce device_id à l'appareil courant */
    const newDeviceId = Save.getDeviceId();
    await supaFetch(
      `leaderboard?recovery_code=eq.${encodeURIComponent(clean)}`, {
      method: 'PATCH',
      headers: { Prefer: '' },
      body: JSON.stringify({ device_id: newDeviceId })
    });
    /* Restaurer localement */
    if (row.name)   Save.savePlayerName(row.name);
    if (row.xp > 0) localStorage.setItem('ls_xp', String(row.xp));
    const beaten = JSON.parse(row.beaten || '[]');
    const stars  = JSON.parse(row.stars  || '{}');
    if (beaten.length > 0) localStorage.setItem('ls_beaten', JSON.stringify(beaten));
    if (Object.keys(stars).length > 0) localStorage.setItem('ls_stars', JSON.stringify(stars));
    const elo = Save.getElo();
    elo[row.name] = row.elo || 1000;
    Save.saveElo(elo);
    return row.name;
  } catch(e) { throw e; }
}
