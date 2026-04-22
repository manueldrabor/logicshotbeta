/* ══════════════════════════════════════
   online.js — Mode 1v1 en ligne
   Supabase Realtime Broadcast (WebSocket)
   + REST pour gestion des salles
══════════════════════════════════════ */
import { State } from './state.js';
import { generateRounds } from './formula.js';
import { sfx } from './audio.js';
import { showScreen } from './ui.js';

const SUPABASE_URL = 'https://msgfuyshsfxbjjsyzyvv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zZ2Z1eXNoc2Z4Ympqc3l6eXZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTI1NTQsImV4cCI6MjA5MjI4ODU1NH0.kHeUYsePZtYL7eYjb1gohHG6hTKEDNR18UR8FSazsHc';

let _sb        = null;
let _channel   = null;
let _isHost    = false;
let _myName    = '';
let _oppName   = '';
let _code      = '';
let _pingIv    = null;
let _pingCheck = null;
let _lastPing  = 0;
let _pingSentAt = 0;
let _estimatedLatency = 200; /* latence one-way estimée en ms (défaut 200ms) */

/* ── Synchronisation d'horloge NTP-style ──
   Juste avant d'envoyer nextAt, l'hôte mesure l'offset exact entre
   les deux horloges en 1 aller-retour :
     t1 = hôte envoie sync_probe
     t2 = invité reçoit et répond immédiatement (son Date.now())
     t3 = hôte reçoit la réponse
   offset = ((t2 - t1) + (t2 - t3)) / 2  ≈  heure_invité - heure_hôte
   nextAt est envoyé APRÈS mesure → les deux appareils démarrent au même instant absolu */
let _clockOffset = 0;    /* heure_invité - heure_hôte en ms */
let _syncProbeT1 = 0;    /* timestamp d'envoi de la probe */
let _syncResolve = null; /* resolve() de la Promise en attente */

/* ══ SUPABASE CLIENT (CDN lazy) ══ */
async function getSB() {
  if (_sb) return _sb;
  const { createClient } = await import(
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
  );
  _sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  return _sb;
}

/* ══ REST helper ══ */
async function dbFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opts.headers || {})
    }
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  const txt = await res.text();
  return txt ? JSON.parse(txt) : [];
}

/* ══ CODE 4 LETTRES ══ */
function genCode() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => c[Math.floor(Math.random() * c.length)]).join('');
}

/* ══════════════════════════════════════
   CRÉER UNE SALLE (hôte)
══════════════════════════════════════ */
export async function createRoom(playerName) {
  _myName  = playerName;
  _isHost  = true;
  _code    = genCode();
  State.isHost   = true;
  State.roomCode = _code;

  /* Purge des salles périmées (>30 min) */
  const stale = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  dbFetch(`rooms?created_at=lt.${stale}&status=eq.waiting`,
    { method: 'DELETE', headers: { Prefer: '' } }).catch(() => {});

  await dbFetch('rooms', {
    method: 'POST',
    body: JSON.stringify({ code: _code, host_name: playerName, status: 'waiting' })
  });

  await _subscribe(_code);
  _setupAdapter();
  return _code;
}

/* ══════════════════════════════════════
   REJOINDRE UNE SALLE (invité)
══════════════════════════════════════ */
export async function joinRoom(code, playerName) {
  _myName  = playerName;
  _isHost  = false;
  _code    = code.toUpperCase().trim();
  State.isHost   = false;
  State.roomCode = _code;

  const rows = await dbFetch(
    `rooms?code=eq.${_code}&status=eq.waiting&select=id,host_name`
  );
  if (!rows || rows.length === 0)
    throw new Error('Salle introuvable ou déjà en cours. Vérifie le code !');

  _oppName = rows[0].host_name;

  await dbFetch(`rooms?code=eq.${_code}`, {
    method: 'PATCH',
    headers: { Prefer: '' },
    body: JSON.stringify({ guest_name: playerName, status: 'playing' })
  });

  await _subscribe(_code);
  _setupAdapter();

  /* Annonce à l'hôte */
  _send({ type: 'guest_joined', name: playerName });
  return _oppName;
}

/* ══ ABONNEMENT REALTIME BROADCAST ══ */
let _subscribed = false;
const _msgQueue = [];

async function _subscribe(code) {
  const sb = await getSB();
  _channel = sb.channel(`logicshot:room:${code}`, {
    config: { broadcast: { self: false } }
  });
  _channel
    .on('broadcast', { event: 'game' }, ({ payload }) => _handleMsg(payload))
    .subscribe(status => {
      if (status === 'SUBSCRIBED') {
        _subscribed = true;
        _lastPing = Date.now();
        /* Vider la queue des messages en attente */
        while (_msgQueue.length) _channel.send({ type: 'broadcast', event: 'game', payload: _msgQueue.shift() });
        /* Ping toutes les 5s */
        _pingIv    = setInterval(() => { _pingSentAt = Date.now(); _send({ type: 'ping' }); }, 5000);
        /* Détection déconnexion si pas de pong depuis 20s */
        _pingCheck = setInterval(() => {
          if (State.roundActive && Date.now() - _lastPing > 20000) _onDisconnect();
        }, 4000);
      }
    });
}

/* ══ ADAPTER injecté dans State (évite import circulaire) ══ */
function _setupAdapter() {
  State.onlineAdapter = {
    broadcastAnswer      : (val, ts, correct, roundIndex) =>
      _send({ type: correct ? 'correct_answer' : 'wrong_answer', val, ts, roundIndex }),
    broadcastSuper       : (type) =>
      _send({ type: 'super_used', superType: type }),
    broadcastAbsentPenalty: (newHp) =>
      _send({ type: 'absent_penalty', newHp }),
    broadcastReady       : () => {
      _readyPlayers.add(_myName);
      _send({ type: 'player_ready', name: _myName });
      _checkBothReady();
    },
    broadcastRoundAck    : (roundIndex) => {
      _send({ type: 'round_ack', roundIndex, name: _myName });
      /* L'hôte ne reçoit pas ses propres messages (self:false) — s'enregistrer directement */
      if (_isHost) {
        _ackRoundIndex = roundIndex;
        _ackRoundFired = false; /* FIX : reset du guard pour ce nouveau round */
        _roundAcks.add(_myName);
        /* Fallback si l'invité ne répond pas dans 5s */
        clearTimeout(_ackTimeout);
        _ackTimeout = setTimeout(() => {
          if (_roundAcks.size >= 1 && !_ackRoundFired) {
            _ackRoundFired = true;
            _fireNextRound();
          }
        }, 5000);
      }
    },
    broadcastNextRound   : (roundIndex, nextAt) =>
      _send({ type: 'next_round', roundIndex, nextAt: nextAt + _clockOffset }),
    broadcastQuit        : () =>
      _send({ type: 'player_quit', name: _myName }),
    broadcastMatchResult : (payload) =>
      _send({ type: 'match_result', ...payload }),
    _getLatency          : () => _estimatedLatency,
    _syncClock           : () => _syncClock(),
    _getClockOffset      : () => _clockOffset,
    _sendTimerSync       : (timeLeft, roundIndex) =>
      _send({ type: 'timer_sync', timeLeft, roundIndex }),
    cleanup              : cleanup
  };
}

/* ══ ENVOI BROADCAST ══
   Si le channel n'est pas encore SUBSCRIBED, on met en queue */
function _send(data) {
  if (_subscribed && _channel) {
    _channel.send({ type: 'broadcast', event: 'game', payload: data });
  } else {
    _msgQueue.push(data);
  }
}

/* ══════════════════════════════════════
   RÉCEPTION DES MESSAGES
══════════════════════════════════════ */
function _handleMsg(data) {
  switch (data.type) {
    case 'ping':            _lastPing = Date.now(); _send({ type: 'pong' }); break;
    case 'pong':
      _lastPing = Date.now();
      if (_pingSentAt > 0) {
        const rtt = Date.now() - _pingSentAt;
        _estimatedLatency = Math.min(1500, Math.max(10, rtt / 2));
        _pingSentAt = 0;
      }
      break;
    /* ── Handshake NTP : l'invité répond immédiatement avec son timestamp ── */
    case 'sync_probe':
      _send({ type: 'sync_reply', t1: data.t1, t2: Date.now() });
      break;
    /* ── L'hôte reçoit la réponse et calcule l'offset d'horloge exact ── */
    case 'sync_reply':
      if (_syncProbeT1 > 0) {
        const t3 = Date.now();
        const t1 = _syncProbeT1, t2 = data.t2;
        /* Formule NTP correcte avec 3 timestamps :
           rtt    = t3 - t1  (aller-retour complet)
           offset = t2 - t1 - rtt/2  = t2 - (t1+t3)/2
           (positif si l'horloge invité est en avance sur l'hôte)
           nextAt = Date.now() + 3000 + rtt/2 :
             l'hôte attend rtt/2 ms de plus → le message arrive chez l'invité exactement
             quand l'hôte est à t=0, les deux comptent à rebours depuis le même instant absolu */
        const rtt = t3 - t1;
        _clockOffset = t2 - (t1 + t3) / 2;   /* heure_invité - heure_hôte */
        _estimatedLatency = Math.max(10, rtt / 2);
        _syncProbeT1 = 0;
        if (_syncResolve) { _syncResolve(_clockOffset); _syncResolve = null; }
      }
      break;
    case 'guest_joined':    if (_isHost)  _onGuestJoined(data.name);  break;
    case 'game_start':      if (!_isHost) _onGameStart(data);          break;
    case 'game_start_ack':  if (_isHost)  _onGameStartAck();           break;
    case 'player_ready':    _onPlayerReady(data.name);                 break;
    case 'start_at':        _onStartAt(data.startAt);                  break;
    case 'correct_answer':
    case 'wrong_answer':    _onOpponentAnswer(data);                   break;
    case 'super_used':      _onOpponentSuper(data.superType);          break;
    case 'next_round':      if (!_isHost) _onNextRound(data);          break;
    case 'round_ack':       if (_isHost)  _onRoundAck(data);           break;
    case 'timer_sync':      if (!_isHost) _onTimerSync(data);          break;
    case 'absent_penalty':  _onOpponentAbsent(data.newHp);             break;
    case 'player_quit':     _onOpponentQuit(data.name);                break;
    case 'match_result':   _onMatchResult(data);                    break;
    case 'disconnect':      _onDisconnect();                           break;
  }
}

/* ── Invité a rejoint (hôte reçoit) — on NE lance pas automatiquement, on attend PRÊT ── */
let _hostPendingBattle = null;
let _hostBattleFallback = null;

function _onGuestJoined(guestName) {
  _oppName = guestName;
  const el = document.getElementById('lobbyStatus');
  if (el) el.innerHTML =
    `<span style="color:var(--green);font-weight:700;">✅ ${guestName} a rejoint !</span>
     <br><span style="color:var(--muted);font-size:11px;">Lancement dans 2 secondes…</span>`;

  setTimeout(() => {
    const rounds = generateRounds();
    State.allRounds = rounds;
    /* FIX race condition : l'hôte envoie game_start, puis attend l'ACK de l'invité
       (game_start_ack) avant de lancer son propre combat. Sans ça, l'hôte peut
       appeler _launchBattle avant que l'invité ait reçu les rounds. */
    _send({ type: 'game_start', rounds, hostName: _myName, guestName });
    _hostPendingBattle = { myName: _myName, guestName, rounds };
    /* Fallback : si pas d'ACK dans 3s (réseau très lent), on lance quand même */
    clearTimeout(_hostBattleFallback);
    _hostBattleFallback = setTimeout(() => {
      if (_hostPendingBattle) {
        const { myName, guestName: gn, rounds: r } = _hostPendingBattle;
        _hostPendingBattle = null;
        _launchBattle(myName, gn, r);
      }
    }, 3000);
  }, 2000);
}

/* ── Lancement reçu (invité reçoit) ── */
function _onGameStart(data) {
  _oppName      = data.hostName;
  State.allRounds = data.rounds;
  const el = document.getElementById('lobbyStatus');
  if (el) el.innerHTML =
    `<span style="color:var(--gold);font-weight:700;">⚔️ Le combat commence !</span>`;
  /* FIX race condition : l'invité confirme la réception avant de lancer le combat */
  _send({ type: 'game_start_ack', name: _myName });
  setTimeout(() => _launchBattle(_myName, data.hostName, data.rounds), 900);
}

/* ── Hôte reçoit la confirmation de l'invité → lancer son propre combat ── */
function _onGameStartAck() {
  clearTimeout(_hostBattleFallback);
  if (_hostPendingBattle) {
    const { myName, guestName, rounds } = _hostPendingBattle;
    _hostPendingBattle = null;
    _launchBattle(myName, guestName, rounds);
  }
}

/* ── Lance le combat ── */
function _launchBattle(myName, opponentName, rounds) {
  import('./battle.js')
    .then(({ beginOnlineBattle }) => beginOnlineBattle(myName, opponentName, rounds))
    .catch(e => { showScreen('screenSplash'); alert('Erreur lancement : ' + e.message); });
}

/* ── Système PRÊT : suivi des joueurs prêts ── */
const _readyPlayers = new Set();

function _onPlayerReady(name) {
  _readyPlayers.add(name);
  _checkBothReady();
}

/* ── Mesure NTP : envoie une probe et retourne une Promise<offset> ──
   Timeout 1s si pas de réponse (réseau dégradé) → fallback sur _estimatedLatency */
function _syncClock() {
  return new Promise(resolve => {
    _syncProbeT1 = Date.now();
    _syncResolve = resolve;
    _send({ type: 'sync_probe', t1: _syncProbeT1 });
    setTimeout(() => {
      if (_syncResolve) {
        /* Timeout : pas de réponse → utiliser latence estimée comme fallback */
        _syncResolve(0);
        _syncResolve = null;
        _syncProbeT1 = 0;
      }
    }, 1000);
  });
}

function _checkBothReady() {
  if (!_isHost || _readyPlayers.size < 2) return;
  /* Mesure le RTT exact par handshake NTP, PUIS envoie startAt.
     nextAt = Date.now() + 3000 + rtt/2 :
       - l'hôte attend rtt/2 ms de plus que le "vrai" t=0
       - le message met rtt/2 ms à arriver chez l'invité
       - quand l'invité reçoit le message, son Date.now() ≈ nextAt - 3000
       → les deux countdowns démarrent au même instant absolu */
  _syncClock().then(() => {
    const rtt = _estimatedLatency * 2;   /* rtt = 2 × one-way */
    const startAt = Date.now() + 3000 + Math.min(rtt / 2, 500);
    /* _clockOffset = heure_invité − heure_hôte :
       On envoie startAt + _clockOffset pour que l'invité, en calculant
       (startAt_reçu − guest.Date.now()), obtienne exactement 3000 ms,
       identique à l'hôte. Sans ce correctif, tout décalage d'horloge
       entre les deux appareils se répercute sur le démarrage du timer. */
    _send({ type: 'start_at', startAt: startAt + _clockOffset });
    import('./battle.js').then(({ receiveStartAt }) => receiveStartAt(startAt));
  });
}

function _onStartAt(startAt) {
  /* Reçu par l'invité */
  import('./battle.js').then(({ receiveStartAt }) => receiveStartAt(startAt));
}

/* ── Sync périodique du timer (invité reçoit) ── */
function _onTimerSync(data) {
  import('./battle.js').then(({ receiveTimerSync }) =>
    receiveTimerSync(data.timeLeft, data.roundIndex)
  );
}

/* ── Réponse adverse reçue ── */
function _onOpponentAnswer(data) {
  import('./battle.js').then(({ receiveOpponentAnswer }) =>
    receiveOpponentAnswer(data.val, data.type === 'correct_answer', data.roundIndex)
  );
}

/* ── Super adverse reçu ── */
function _onOpponentSuper(type) {
  import('./battle.js').then(({ receiveOpponentSuper }) =>
    receiveOpponentSuper(type)
  );
}

/* ── ACK de fin de round : l'hôte attend les 2 avant de lancer next_round ── */
let _roundAcks = new Set();
let _ackRoundIndex = -1;
let _ackTimeout = null;
let _ackRoundFired = false; /* FIX : guard anti-double-déclenchement */

function _onRoundAck(data) {
  if (data.roundIndex !== _ackRoundIndex) return;
  _roundAcks.add(data.name);
  if (_roundAcks.size >= 2 && !_ackRoundFired) {
    _ackRoundFired = true;
    _fireNextRound();
  }
}

function _fireNextRound() {
  clearTimeout(_ackTimeout);
  _ackTimeout = null;
  const roundIndex = _ackRoundIndex;
  _ackRoundIndex = -1;
  _ackRoundFired = false; /* FIX : reset pour le prochain round */
  _roundAcks.clear();
  import('./battle.js').then(({ fireNextRoundFromHost }) =>
    fireNextRoundFromHost(roundIndex)
  );
}

/* ── next_round reçu (invité seulement) ── */
function _onNextRound(data) {
  import('./battle.js').then(({ receiveNextRound }) =>
    receiveNextRound(data.roundIndex, data.nextAt)
  );
}

/* ── Adversaire a abandonné ── */
function _onOpponentQuit(name) {
  clearInterval(_pingIv);
  clearInterval(_pingCheck);
  import('./battle.js').then(({ receiveOpponentQuit }) =>
    receiveOpponentQuit(name || _oppName)
  );
}

/* ── Adversaire est allé en arrière-plan ── */
function _onOpponentAbsent(newHp) {
  import('./battle.js').then(({ receiveOpponentAbsent }) =>
    receiveOpponentAbsent(newHp)
  );
}

/* ── Déconnexion adverse (ping timeout) ── */
function _onDisconnect() {
  clearInterval(_pingIv);
  clearInterval(_pingCheck);
  const battleVisible = !document.getElementById('screenBattle')?.classList.contains('hidden');
  if (!battleVisible) return;
  import('./battle.js').then(({ receiveDisconnect }) => receiveDisconnect(_oppName));
}
function _onMatchResult(data) {
  import('./battle.js').then(({ receiveMatchResult }) =>
    receiveMatchResult(data)
  );
}
/* ══════════════════════════════════════
   NETTOYAGE
══════════════════════════════════════ */
export function cleanup() {
  clearInterval(_pingIv);
  clearInterval(_pingCheck);
  clearTimeout(_ackTimeout);
  clearTimeout(_hostBattleFallback); /* FIX : annuler le fallback game_start */
  _pingIv = _pingCheck = _ackTimeout = null;
  _hostPendingBattle = null;
  _hostBattleFallback = null;
  _readyPlayers.clear();
  _roundAcks.clear();
  _ackRoundIndex = -1;
  _ackRoundFired = false;   /* FIX : reset guard anti-double-fire */
  _msgQueue.length = 0;
  _subscribed = false;      /* FIX : reset pour éviter qu'une revanche réutilise l'ancien état */
  _clockOffset = 0;
  _syncProbeT1 = 0;
  _syncResolve = null;
  _estimatedLatency = 200;

  if (_channel) {
    /* Envoyer disconnect AVANT de passer _subscribed à false */
    _send({ type: 'disconnect' });
    setTimeout(() => {
      _subscribed = false;
      _channel?.unsubscribe();
      _channel = null;
    }, 400);
  } else {
    _subscribed = false;
  }

  if (_isHost && _code) {
    dbFetch(`rooms?code=eq.${_code}`,
      { method: 'DELETE', headers: { Prefer: '' } }).catch(() => {});
  }

  State.onlineAdapter = null;
  _isHost = false; _code = ''; _myName = ''; _oppName = '';
}
