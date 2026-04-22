/* ══════════════════════════════════════
   survival.js — Mode Survie Infinie
   Bonne réponse → +10s · Erreur → -7s
   Score x combo · Best score Supabase
══════════════════════════════════════ */
import { State, Save } from './state.js';
import { sfx } from './audio.js';
import { showScreen } from './ui.js';
import { generateRounds } from './formula.js';

/* ══ SUPABASE ══ */
const SUPABASE_URL = 'https://msgfuyshsfxbjjsyzyvv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zZ2Z1eXNoc2Z4Ympqc3l6eXZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTI1NTQsImV4cCI6MjA5MjI4ODU1NH0.kHeUYsePZtYL7eYjb1gohHG6hTKEDNR18UR8FSazsHc';

async function _supaFetch(path, opts = {}) {
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

async function _loadBestOnline() {
  const deviceId = Save.getDeviceId();
  try {
    const rows = await _supaFetch(
      `leaderboard?device_id=eq.${encodeURIComponent(deviceId)}&select=survival_best`
    );
    if (rows.length > 0 && rows[0].survival_best > 0) {
      const best = Math.max(rows[0].survival_best, parseInt(localStorage.getItem('ls_survival_best') || '0'));
      localStorage.setItem('ls_survival_best', best.toString());
      return best;
    }
  } catch(e) { /* offline */ }
  return parseInt(localStorage.getItem('ls_survival_best') || '0');
}

async function _saveBestOnline(score) {
  localStorage.setItem('ls_survival_best', score.toString());
  const deviceId = Save.getDeviceId();
  try {
    const rows = await _supaFetch(
      `leaderboard?device_id=eq.${encodeURIComponent(deviceId)}&select=id,survival_best`
    );
    if (rows.length === 0) {
      /* Pas encore de ligne → créer l'entrée avec le nom du joueur */
      const name = Save.getSavedName() || 'Joueur';
      await _supaFetch('leaderboard', {
        method: 'POST',
        body: JSON.stringify({
          device_id: deviceId,
          name,
          elo: 1000,
          wins: 0,
          survival_best: score
        })
      });
      return;
    }
    if (score > (rows[0].survival_best || 0)) {
      await _supaFetch(`leaderboard?id=eq.${rows[0].id}`, {
        method: 'PATCH',
        headers: { Prefer: '' },
        body: JSON.stringify({ survival_best: score, updated_at: new Date().toISOString() })
      });
    }
  } catch(e) { /* fail silently */ }
}

/* ══ CONSTANTES ══ */
const TIME_START   = 30;
const TIME_CORRECT = 10;
const TIME_WRONG   = 7;
const TIME_CAP     = 60;
const SCORE_BASE   = 100;

/* ══ STATE LOCAL ══ */
let _timeBank  = TIME_START;
let _score     = 0;
let _combo     = 0;
let _correct   = 0;
let _timerIv   = null;
let _round     = null;
let _rounds    = [];
let _roundIdx  = 0;
let _active    = false;
let _inputVal  = '';
let _bestScore = 0;

/* ══ DÉMARRAGE ══ */
export async function startSurvival() {
  /* Reset état */
  clearInterval(_timerIv);
  _timeBank = TIME_START;
  _score    = 0;
  _combo    = 0;
  _correct  = 0;
  _roundIdx = 0;
  _active   = false;
  _inputVal = '';
  _rounds   = [];

  _bestScore = await _loadBestOnline();

  /* ── Reset UI — masquer game over, montrer question ── */
  const goBox = document.getElementById('svGameOverBox');
  const qBox  = document.getElementById('svQuestionBox');
  if (goBox) goBox.style.display = 'none';
  if (qBox)  qBox.style.display  = 'flex';

  sfx.battleStart?.();
  showScreen('screenSurvival');
  _nextQuestion();
}

/* ══ QUESTION SUIVANTE ══ */
function _nextQuestion() {
  clearInterval(_timerIv);
  _inputVal = '';
  _active   = true;

  State.aiDifficulty = _correct < 8 ? 'easy' : _correct < 18 ? 'medium' : 'hard';

  if (_roundIdx >= _rounds.length) {
    _rounds   = generateRounds();
    _roundIdx = 0;
  }
  _round = _rounds[_roundIdx++];

  _renderQuestion();
  _startBank();
}

/* ══ DÉCOMPTE ══ */
function _startBank() {
  const startMs     = Date.now();
  const bankAtStart = _timeBank;

  _timerIv = setInterval(() => {
    if (!_active) return;
    _timeBank = Math.max(0, bankAtStart - (Date.now() - startMs) / 1000);
    _updateBank();
    if (_timeBank <= 0) {
      clearInterval(_timerIv);
      _active = false;
      _onTimeout();
    }
  }, 50);
}

/* ══ RÉPONSE ══ */
function _onAnswer() {
  if (!_active || _inputVal === '') return;
  clearInterval(_timerIv);
  _active = false;

  const correct = parseInt(_inputVal, 10) === _round.answer;

  if (correct) {
    _combo++;
    _correct++;
    const mult   = Math.min(_combo, 5);
    const points = SCORE_BASE * mult;
    _score   += points;
    _timeBank = Math.min(_timeBank + TIME_CORRECT, TIME_CAP);
    sfx.correct?.();
    _showFeedback(
      `✅ +${points} pts · +${TIME_CORRECT}s${_combo >= 2 ? ` · ×${mult} COMBO !` : ''}`,
      '#00ff88'
    );
    _updateBank();
    _updateScore();
    setTimeout(() => {
      if (_timeBank <= 0) { _gameOver(); return; }
      _nextQuestion();
    }, 1100);
  } else {
    _combo    = 0;
    _timeBank = Math.max(0, _timeBank - TIME_WRONG);
    sfx.wrong?.();
    _showFeedback(`❌ Réponse : ${_round.answer} · −${TIME_WRONG}s`, '#ff4444');
    /* Afficher la bonne réponse en doré pendant 5s */
    const fa = document.getElementById('svInput');
    if (fa) { fa.value = `= ${_round.answer}`; fa.style.color = 'var(--gold)'; }
    _updateBank();
    _updateScore();
    setTimeout(() => {
      const fa2 = document.getElementById('svInput');
      if (fa2) fa2.style.color = '';
      if (_timeBank <= 0) { _gameOver(); return; }
      _nextQuestion();
    }, 5000);
  }
}

/* ══ TIMEOUT ══ */
function _onTimeout() {
  _combo    = 0;
  _timeBank = 0;
  sfx.wrong?.();
  _showFeedback(`⏰ Temps écoulé ! = ${_round.answer}`, '#ff4444');
  _updateBank();
  setTimeout(() => _gameOver(), 1200);
}

/* ══ GAME OVER ══ */
async function _gameOver() {
  clearInterval(_timerIv);
  _active = false;

  const isNew = _score > _bestScore;
  if (isNew) {
    _bestScore = _score;
    _saveBestOnline(_score);
  }

  const xpGain = Math.max(10, Math.floor(_score / 50));
  State.xp += xpGain;

  _renderGameOver(isNew, xpGain);
}

/* ══ INPUT ══ */
export function svPress(digit) {
  if (!_active || _inputVal.length >= 4) return;
  _inputVal += digit;
  _updateInput();
}

export function svNeg() {
  if (!_active) return;
  _inputVal = _inputVal.startsWith('-') ? _inputVal.slice(1) : '-' + _inputVal;
  _updateInput();
}

export function svDel() {
  if (!_active) return;
  _inputVal = _inputVal.slice(0, -1);
  _updateInput();
}

export function svSubmit() { _onAnswer(); }

export function svQuit() {
  clearInterval(_timerIv);
  _active = false;
  _gameOver();
}

/* ══ RENDER ══ */
function _renderQuestion() {
  const diffLabel = { easy: 'FACILE', medium: 'MOYEN', hard: 'DIFFICILE' };
  const diffColor = { easy: 'var(--blue-neon)', medium: 'var(--gold)', hard: 'var(--red)' };
  const el = id => document.getElementById(id);
  if (!el('svFormula')) return;

  el('svFormula').textContent  = _round.formula;
  el('svInput').value          = '';
  el('svInput').style.color    = '';
  el('svFeedback').textContent = '';
  el('svDiff').textContent     = diffLabel[_round.difficulty] || '';
  el('svDiff').style.color     = diffColor[_round.difficulty] || '';
  _inputVal = '';
  _updateBank();
  _updateScore();
}

function _updateBank() {
  const el  = document.getElementById('svBank');
  const bar = document.getElementById('svBankBar');
  if (!el) return;
  const t = Math.max(0, _timeBank);
  el.textContent = t.toFixed(1) + 's';
  if (bar) {
    bar.style.width      = Math.min(100, (t / TIME_CAP) * 100) + '%';
    bar.style.background = t > 20 ? 'var(--blue-neon)' : t > 10 ? 'var(--gold)' : 'var(--red)';
  }
}

function _updateScore() {
  const el = document.getElementById('svScore');
  if (el) el.textContent = '🏆 ' + _score.toLocaleString();
  const cb = document.getElementById('svCombo');
  if (cb) cb.textContent = _combo >= 2 ? `×${Math.min(_combo, 5)} COMBO` : '';
}

function _updateInput() {
  const el = document.getElementById('svInput');
  if (el) el.value = _inputVal || '';
}

function _showFeedback(msg, color) {
  const el = document.getElementById('svFeedback');
  if (!el) return;
  el.textContent = msg;
  el.style.color = color;
}

function _renderGameOver(isNew, xpGain) {
  const el = id => document.getElementById(id);
  if (!el('svGameOverBox')) return;

  el('svGameOverBox').style.display = 'flex';
  el('svQuestionBox').style.display = 'none';

  el('svGoScore').textContent   = _score.toLocaleString();
  el('svGoCorrect').textContent = _correct;
  el('svGoBest').textContent    = _bestScore.toLocaleString();
  el('svGoXP').textContent      = `+${xpGain} XP`;
  el('svGoNew').style.display   = isNew ? 'block' : 'none';
}

/* ══ PARTAGE ══ */
export function svShare() {
  const text = `🎯 LogicShot — Mode Survie Infinie\n🏆 Score : ${_score.toLocaleString()}\n✅ Réponses : ${_correct}\n🔥 Best : ${_bestScore.toLocaleString()}\nEssaie de me battre 👇\nhttps://manueldrabor.github.io/logicshotbeta/`;
  if (navigator.share) {
    navigator.share({ title: 'LogicShot Survie', text }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(text).then(() => {
      const btn = document.getElementById('svShareBtn');
      if (btn) { btn.textContent = '✅ Copié !'; setTimeout(() => { btn.textContent = '📤 Partager'; }, 2000); }
    });
  }
}
