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
        _pingIv    = setInterval(() => _send({ type: 'ping' }), 5000);
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
        _roundAcks.add(_myName);
        /* Fallback si l'invité ne répond pas dans 5s */
        clearTimeout(_ackTimeout);
        _ackTimeout = setTimeout(() => { if (_roundAcks.size >= 1) _fireNextRound(); }, 5000);
      }
    },
    broadcastNextRound   : (roundIndex, nextAt) =>
      _send({ type: 'next_round', roundIndex, nextAt }),
    broadcastGameOver    : () =>
      _send({ type: 'player_quit', name: _myName }),
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
    case 'pong':            _lastPing = Date.now(); break;
    case 'guest_joined':    if (_isHost)  _onGuestJoined(data.name);  break;
    case 'game_start':      if (!_isHost) _onGameStart(data);          break;
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
    case 'disconnect':      _onDisconnect();                           break;
  }
}

/* ── Invité a rejoint (hôte reçoit) — on NE lance pas automatiquement, on attend PRÊT ── */
function _onGuestJoined(guestName) {
  _oppName = guestName;
  const el = document.getElementById('lobbyStatus');
  if (el) el.innerHTML =
    `<span style="color:var(--green);font-weight:700;">✅ ${guestName} a rejoint !</span>
     <br><span style="color:var(--muted);font-size:11px;">Lancement dans 2 secondes…</span>`;

  setTimeout(() => {
    const rounds = generateRounds();
    State.allRounds = rounds;
    _send({ type: 'game_start', rounds, hostName: _myName, guestName });
    _launchBattle(_myName, guestName, rounds);
  }, 2000);
}

/* ── Lancement reçu (invité reçoit) ── */
function _onGameStart(data) {
  _oppName      = data.hostName;
  State.allRounds = data.rounds;
  const el = document.getElementById('lobbyStatus');
  if (el) el.innerHTML =
    `<span style="color:var(--gold);font-weight:700;">⚔️ Le combat commence !</span>`;
  setTimeout(() => _launchBattle(_myName, data.hostName, data.rounds), 900);
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

function _checkBothReady() {
  /* Seul l'hôte envoie le signal start_at quand les 2 sont prêts */
  if (!_isHost || _readyPlayers.size < 2) return;
  const startAt = Date.now() + 3500;
  _send({ type: 'start_at', startAt });
  /* L'hôte s'applique aussi le countdown */
  import('./battle.js').then(({ receiveStartAt }) => receiveStartAt(startAt));
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

function _onRoundAck(data) {
  if (data.roundIndex !== _ackRoundIndex) return;
  _roundAcks.add(data.name);
  if (_roundAcks.size >= 2) _fireNextRound();
}

function _fireNextRound() {
  clearTimeout(_ackTimeout);
  _ackTimeout = null;
  const roundIndex = _ackRoundIndex;
  _ackRoundIndex = -1;
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

/* ══════════════════════════════════════
   NETTOYAGE
══════════════════════════════════════ */
export function cleanup() {
  clearInterval(_pingIv);
  clearInterval(_pingCheck);
  clearTimeout(_ackTimeout);
  _pingIv = _pingCheck = _ackTimeout = null;
  _readyPlayers.clear();
  _roundAcks.clear();
  _ackRoundIndex = -1;
  _subscribed = false;
  _msgQueue.length = 0;

  if (_channel) {
    _send({ type: 'disconnect' });
    setTimeout(() => { _channel?.unsubscribe(); _channel = null; }, 300);
  }

  if (_isHost && _code) {
    dbFetch(`rooms?code=eq.${_code}`,
      { method: 'DELETE', headers: { Prefer: '' } }).catch(() => {});
  }

  State.onlineAdapter = null;
  _isHost = false; _code = ''; _myName = ''; _oppName = '';
}
