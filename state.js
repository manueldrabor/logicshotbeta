/* ══════════════════════════════════════
   state.js — État centralisé LogicShot
   Toutes les variables globales du jeu
══════════════════════════════════════ */
export const State = {
  /* ── Paramètres de partie ── */
  gameMode: '1vm',          // '1vm' | 'story' | 'online'
  aiDifficulty: 'easy',     // 'relax' | 'easy' | 'medium' | 'hard'
  oathNames: [],
  currentStoryLevel: 1,

  /* ── Online 1v1 ── */
  isHost: false,
  roomCode: '',
  onlineAdapter: null,
  _waitingNextRound: -1,  /* roundIndex attendu par l'invité, -1 = pas en attente */

  /* ── Combat en cours ── */
  players: [],
  allRounds: [],
  roundIndex: 0,
  roundActive: false,
  isPaused: false,
  timeLeft: 20,
  roundTimeRef: 20,
  timerInterval: null,
  currentRoundToken: 0,

  /* ── Mécanique du round ── */
  currentMechanic: 'normal', // 'normal' | 'speed' | 'blind' | 'order'
  blindRevealed: false,
  orderOptions: [],
  npVals: {},               // { playerId: string }

  /* ── Score & streak ── */
  battleScore: 0,
  playerStreak: 0,
  playerCombo: 0,

  /* ── Boucliers ── */
  playerShieldActive: false,
  aiShieldActive: false,
  shieldExpireTimer: null,
  aiShieldExpireTimer: null,

  /* ── Supers débloqués ── */
  unlockedSupers: { flash: false, glitch: false, shield: false },

  /* ── Flags FX ── */
  speedBonusActive: false,
  criticalActive: false,

  /* ── Narratif ── */
  _narrativeAfterCb: null,

  /* ── Audio ── */
  isDark: false,
  isMuted: false,

  /* ── XP / Progression ── */
  get xp() { return parseInt(localStorage.getItem('ls_xp') || '0'); },
  set xp(v) {
    localStorage.setItem('ls_xp', Math.max(0, v).toString());
    /* Sync cloud en arrière-plan (fire-and-forget) */
    import('./leaderboard.js').then(m => m.syncProgressToCloud()).catch(() => {});
  },
  get xpLevel() {
    const xp = this.xp;
    if (xp < 500)  return { level: 1, title: 'Recrue',        next: 500 };
    if (xp < 1200) return { level: 2, title: 'Apprenti',      next: 1200 };
    if (xp < 2500) return { level: 3, title: 'Combattant',    next: 2500 };
    if (xp < 4500) return { level: 4, title: 'Vétéran',       next: 4500 };
    if (xp < 7000) return { level: 5, title: 'Élite',         next: 7000 };
    if (xp < 10000)return { level: 6, title: 'Champion',      next: 10000 };
    return         { level: 7, title: 'Maître du Calcul',      next: Infinity };
  },

  /* ── Réinitialisation d'une partie ── */
  resetBattle() {
    this.roundIndex = 0;
    this.battleScore = 0;
    this.playerStreak = 0;
    this.playerCombo = 0;
    this.playerShieldActive = false;
    this.aiShieldActive = false;
    this.roundActive = false;
    this.isPaused = false;
    this.speedBonusActive = false;
    this.criticalActive = false;
    this.blindRevealed = false;
    this.orderOptions = [];
    this.npVals = {};
    this.currentRoundToken = 0;
    this._waitingNextRound = -1;
    clearInterval(this.timerInterval);
    clearTimeout(this.shieldExpireTimer);
    clearTimeout(this.aiShieldExpireTimer);
    document.getElementById('pauseOverlay')?.classList.add('hidden');
  }
};

/* ── Constantes de jeu ── */
export const C = {
  STORY_LEVELS: 20,
  MAX_HP: 100,
  ROUNDS: 10,
  DAMAGE: { easy: 10, medium: 15, hard: 20 },
  SELF_DAMAGE: 5,
  ABSENT_PENALTY: 20,
  NO_ANSWER_PENALTY: 5,
  PAUSE_PENALTY: 10,
  SCORE_BASE: { easy: 100, medium: 150, hard: 200 },
  SCORE_SPEED_BONUS: 50,
  STREAK_BONUS: [0, 0, 25, 50, 75, 100],
  XP_WIN: { story: 120, '1vm': 80 },
  XP_LOSS: { story: 30, '1vm': 20 },
  XP_PERFECT: 50,            // bonus HP > 70 en fin de partie
  XP_PER_ROUND_WIN: 10,      // XP par round gagné
};

/* ── Persistance story ── */
export const Save = {
  getBeatenLevels() {
    try { return JSON.parse(localStorage.getItem('ls_beaten') || '[]'); }
    catch(e) { return []; }
  },
  saveBeatenLevel(lvl, stars) {
    const b = this.getBeatenLevels();
    if (!b.includes(lvl)) b.push(lvl);
    localStorage.setItem('ls_beaten', JSON.stringify(b));
    const s = this.getLevelStars();
    s[lvl] = Math.max(s[lvl] || 0, stars);
    localStorage.setItem('ls_stars', JSON.stringify(s));
  },
  getLevelStars() {
    try { return JSON.parse(localStorage.getItem('ls_stars') || '{}'); }
    catch(e) { return {}; }
  },
  getTotalStars() {
    return Object.values(this.getLevelStars()).reduce((a, b) => a + b, 0);
  },
  getUnlockedLevel() {
    const b = this.getBeatenLevels();
    return b.length === 0 ? 1 : Math.min(Math.max(...b) + 1, 20);
  },
  savePlayerName(n) { if (n) localStorage.setItem('ls_name', n); },
  getSavedName() { return localStorage.getItem('ls_name') || ''; },
  getDeviceId() {
    let id = localStorage.getItem('ls_device_id');
    if (!id) {
      id = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'dev-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      localStorage.setItem('ls_device_id', id);
    }
    return id;
  },
  getElo() {
    try { return JSON.parse(localStorage.getItem('ls_elo') || '{}'); }
    catch(e) { return {}; }
  },
  saveElo(obj) { localStorage.setItem('ls_elo', JSON.stringify(obj)); }
};
