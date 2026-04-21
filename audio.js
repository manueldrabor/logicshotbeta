/* ══════════════════════════════════════
   audio.js — Gestion audio LogicShot
   Sons distincts par action + musique menu
══════════════════════════════════════ */
import { State } from './state.js';

/* ── AudioContext — créé uniquement dans le handler du geste utilisateur ── */
let _audioCtx = null;
let _audioReady = false;

/* Retourne le contexte si utilisable */
function getAC() {
  if (!_audioCtx || _audioCtx.state === 'closed') return null;
  if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {});
  return _audioCtx;
}

/* Unlock audio.
   Événements valides pour Web Audio autoplay policy Chrome :
   click, touchend, pointerup, keydown — PAS touchstart.
   On joue un buffer silencieux (trick iOS Safari) + resume() pour Android. */
export function unlockAudio() {
  if (_audioReady) return;
  try {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    /* Buffer silencieux — déverrouilage iOS Safari */
    const buf = _audioCtx.createBuffer(1, 1, 22050);
    const src = _audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(_audioCtx.destination);
    src.start(0);
    _audioReady = true;
    _audioCtx.resume().catch(() => {});
  } catch(e) { /* pas de WebAudio */ }
}

/* ── Oscillateur ── */
function playTone(freq, type, dur, vol = 0.1, delay = 0) {
  if (State.isMuted) return;
  try {
    const ac = getAC();
    if (!ac) return;
    const o = ac.createOscillator();
    const g = ac.createGain();
    const f = ac.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 4200;
    o.type = type;
    o.frequency.setValueAtTime(freq, ac.currentTime + delay);
    g.gain.setValueAtTime(vol, ac.currentTime + delay);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + delay + dur);
    o.connect(f); f.connect(g); g.connect(ac.destination);
    o.start(ac.currentTime + delay);
    o.stop(ac.currentTime + delay + dur);
  } catch(e) {}
}

/* ── Bruit ── */
function playNoise(dur, vol = 0.04, freq = 800) {
  if (State.isMuted) return;
  try {
    const ac = getAC();
    if (!ac) return;
    const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    const filt = ac.createBiquadFilter();
    const g = ac.createGain();
    filt.type = 'bandpass'; filt.frequency.value = freq; filt.Q.value = 0.8;
    src.buffer = buf;
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    src.connect(filt); filt.connect(g); g.connect(ac.destination);
    src.start();
  } catch(e) {}
}

/* ══ SONS PAR ACTION ══
   Chaque événement a sa propre signature sonore unique
══════════════════════════════════════ */
export const sfx = {

  /* ─ Réponse correcte : accord ascendant lumineux ─ */
  correct() {
    playTone(523, 'sine', 0.08, 0.08);
    playTone(659, 'sine', 0.12, 0.07, 0.06);
    playTone(784, 'sine', 0.16, 0.07, 0.12);
    playTone(1047,'sine', 0.18, 0.06, 0.18);
  },

  /* ─ Mauvaise réponse : chute grave avec distorsion ─ */
  wrong() {
    playTone(220, 'sawtooth', 0.12, 0.10);
    playTone(170, 'sawtooth', 0.20, 0.08, 0.08);
    playNoise(0.07, 0.05, 300);
  },

  /* ─ Victoire finale : fanfare ascendante ─ */
  win() {
    [261, 330, 392, 523, 659, 784, 1047].forEach((f, i) =>
      playTone(f, 'sine', 0.35, 0.09, i * 0.08)
    );
  },

  /* ─ Défaite finale : accord descendant sombre ─ */
  lose() {
    [300, 270, 240, 200, 150].forEach((f, i) =>
      playTone(f, 'sawtooth', 0.30, 0.09, i * 0.10)
    );
    playNoise(0.4, 0.06, 180);
  },

  /* ─ Level up (mode histoire) : fanfare rapide brillante ─ */
  levelup() {
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      playTone(f, 'sine', 0.28, 0.10, i * 0.08)
    );
  },

  /* ─ Début de combat : tension + impact ─ */
  battleStart() {
    playNoise(0.08, 0.06, 700);
    playTone(200, 'square', 0.15, 0.08, 0.1);
    playTone(350, 'square', 0.22, 0.09, 0.3);
    playTone(500, 'sawtooth', 0.18, 0.08, 0.45);
  },

  /* ─ Coup critique joueur : impact + éclat ─ */
  criticalPlayer() {
    playTone(80,   'sawtooth', 0.35, 0.18);
    playNoise(0.12, 0.14, 400);
    setTimeout(() => {
      playTone(880,  'sine', 0.22, 0.12);
      playTone(1200, 'sine', 0.18, 0.10, 0.08);
    }, 180);
    setTimeout(() => playTone(1600, 'sine', 0.15, 0.09), 320);
  },

  /* ─ Coup critique IA : grave menaçant ─ */
  criticalAI() {
    playTone(60,  'sawtooth', 0.40, 0.18);
    playNoise(0.18, 0.16, 250);
    setTimeout(() => {
      playTone(300, 'sawtooth', 0.20, 0.12);
      playTone(150, 'square',   0.14, 0.10, 0.08);
    }, 160);
  },

  /* ─ Combo : cascade rapide ─ */
  combo() {
    [880, 1100, 1320, 1600].forEach((f, i) =>
      playTone(f, 'sine', 0.10, 0.07, i * 0.05)
    );
  },

  /* ─ Score pop : bip aigu léger ─ */
  scorePop() { playTone(1400, 'sine', 0.06, 0.05); },

  /* ─ Super pouvoir déclenché ─ */
  superpow() {
    playTone(800,  'square', 0.09, 0.08);
    playTone(1200, 'square', 0.13, 0.08, 0.08);
  },

  /* ─ Bouclier activé ─ */
  shield() {
    playTone(600, 'sine', 0.12, 0.09);
    playTone(900, 'sine', 0.18, 0.07, 0.08);
  },

  /* ─ Bouclier qui bloque : impact sourd ─ */
  shieldBlock() {
    playTone(400, 'triangle', 0.30, 0.11);
    playNoise(0.12, 0.05, 500);
  },

  /* ─ Tir facile ─ */
  gunshot() {
    playNoise(0.08, 0.10, 1200);
    playTone(200, 'sawtooth', 0.06, 0.05);
  },

  /* ─ Tir moyen (burst) ─ */
  burst() {
    for (let i = 0; i < 3; i++)
      setTimeout(() => playNoise(0.05, 0.07, 1000), i * 70);
  },

  /* ─ Explosion difficile ─ */
  explosion() {
    playNoise(0.5, 0.15, 300);
    playTone(60, 'sawtooth', 0.4, 0.10);
  },

  /* ─ Alarme timer ─ */
  alarm() {
    playTone(600, 'square', 0.07, 0.07);
    playTone(800, 'square', 0.07, 0.07, 0.12);
  },

  /* ─ Joueur absent ─ */
  absent() { playTone(220, 'triangle', 0.30, 0.06); },

  /* ─ Débloquage XP / badge ─ */
  xpUp() {
    playTone(440, 'sine', 0.12, 0.08);
    playTone(554, 'sine', 0.16, 0.08, 0.10);
    playTone(659, 'sine', 0.20, 0.08, 0.20);
  },

  /* ─ Tutoriel : son doux ─ */
  tutorial() {
    playTone(523, 'sine', 0.10, 0.06);
    playTone(659, 'sine', 0.14, 0.06, 0.12);
  },

  /* ─ Partage de résultat ─ */
  share() {
    playTone(880, 'sine', 0.08, 0.07);
    playTone(1100,'sine', 0.10, 0.06, 0.08);
  }
};

/* ══ MUSIQUE DU MENU ══ */
let _menuMusicTimer = null;
let _menuMusicFadeInterval = null;
let _menuMusicStarted = false;

export function playMenuMusic() {
  if (State.isMuted) return;
  const mus = document.getElementById('menuMusic');
  if (!mus) return;
  clearTimeout(_menuMusicTimer);
  clearInterval(_menuMusicFadeInterval);
  if (!mus.paused && _menuMusicStarted) { mus.volume = 0.1; return; }
  _menuMusicStarted = true;
  mus.volume = 0.1;
  mus.play().catch(() => {});
  mus.onended = () => {
    _menuMusicStarted = false;
    _menuMusicTimer = setTimeout(() => playMenuMusic(), 10000);
  };
}

export function pauseMenuMusicForBattle() {
  const mus = document.getElementById('menuMusic');
  if (!mus || mus.paused) return;
  clearInterval(_menuMusicFadeInterval);
  clearTimeout(_menuMusicTimer);
  const step = mus.volume / 30;
  _menuMusicFadeInterval = setInterval(() => {
    if (mus.volume > step) { mus.volume = Math.max(0, mus.volume - step); }
    else { mus.volume = 0; mus.pause(); clearInterval(_menuMusicFadeInterval); }
  }, 50);
}

export function resumeMenuMusic() {
  if (State.isMuted) return;
  const mus = document.getElementById('menuMusic');
  if (!mus) return;
  clearInterval(_menuMusicFadeInterval);
  clearTimeout(_menuMusicTimer);
  if (mus.paused) { mus.volume = 0; mus.play().catch(() => {}); }
  const target = 0.1;
  _menuMusicFadeInterval = setInterval(() => {
    if (mus.volume < target - 0.02) { mus.volume = Math.min(target, mus.volume + 0.03); }
    else { mus.volume = target; clearInterval(_menuMusicFadeInterval); }
  }, 50);
}

export function stopMenuMusic() {
  const mus = document.getElementById('menuMusic');
  if (!mus) return;
  clearTimeout(_menuMusicTimer);
  clearInterval(_menuMusicFadeInterval);
  mus.pause();
  mus.currentTime = 0;
  mus.onended = null;
  _menuMusicStarted = false;
}

/* ── Initialisation autoplay ── */
export function initAudioAutoplay() {
  /* touchstart est EXCLU : Chrome ne le compte pas comme user-activation
     pour la Web Audio API. Événements valides : click, touchend, pointerup, keydown */
  const UNLOCK_EVENTS = ['click', 'touchend', 'pointerup', 'keydown'];

  function startOnce() {
    UNLOCK_EVENTS.forEach(ev => document.removeEventListener(ev, startOnce));
    unlockAudio();
    setTimeout(() => playMenuMusic(), 100);
  }

  UNLOCK_EVENTS.forEach(ev =>
    document.addEventListener(ev, startOnce, { passive: true })
  );
}

/* ── Toggle mute ── */
export function toggleMute() {
  State.isMuted = !State.isMuted;
  const btn = document.getElementById('muteBtn');
  if (btn) {
    btn.textContent = State.isMuted ? '🔇 Son coupé' : '🔊 Son';
    btn.classList.toggle('active', State.isMuted);
  }
  const inBattle = !document.getElementById('screenBattle')?.classList.contains('hidden') && !State.isPaused;
  if (State.isMuted) stopMenuMusic();
  else if (!inBattle) resumeMenuMusic();
}
