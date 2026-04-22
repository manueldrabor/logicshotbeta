/* ══════════════════════════════════════
   battle.js — Logique de combat LogicShot
══════════════════════════════════════ */
import { State, C, Save } from './state.js';
import { sfx, pauseMenuMusicForBattle, resumeMenuMusic } from './audio.js';
import {
  renderFighters, updateHP, updateAllSuperDots, animFighter, setAbsentBadge,
  renderScoreBar, showFeedback, hideFeedback, updateTimerUI, freezeTimerUI, unfreezeTimerUI,
  triggerRoundTransition, showCriticalFX, triggerSlowMo, showImpactFX, showHpLossFX,
  showScorePop, fireBang, showScreen, animateXPGain
} from './ui.js';
import { generateRounds } from './formula.js';

/* ── Profils IA ── */
const AI_PROFILES = {
  relax:  { minFrac: 0.55, maxFrac: 0.90, accuracy: 0.60, attemptChance: 0.80 },
  easy:   { minFrac: 0.54, maxFrac: 0.88, accuracy: 0.68, attemptChance: 0.84 },
  medium: { minFrac: 0.34, maxFrac: 0.64, accuracy: 0.79, attemptChance: 0.90 },
  hard:   { minFrac: 0.18, maxFrac: 0.46, accuracy: 0.89, attemptChance: 0.95 }
};

function getFormulaComplexity(round) {
  const formula = round.formula || '';
  const terms = formula.split(/[+\-×÷]/).map(s => s.trim()).filter(Boolean).length;
  const mulCount = (formula.match(/×/g) || []).length;
  const divCount = (formula.match(/÷/g) || []).length;
  let score = 0;
  score += Math.max(0, terms - 2) * 0.08;
  score += mulCount * 0.08;
  score += divCount * 0.12;
  return Math.min(score, 0.35);
}

function getAIProfile(round) {
  const base = { ...(AI_PROFILES[State.aiDifficulty] || AI_PROFILES.easy) };
  const ai = State.players.find(p => p.isAI);
  const hpRatio = ai ? ai.hp / C.MAX_HP : 1;
  const complexity = getFormulaComplexity(round);
  base.minFrac += complexity * 0.40;
  base.maxFrac += complexity * 0.55;
  base.accuracy -= complexity * 0.60;
  if (hpRatio <= 0.70 && hpRatio > 0.40) {
    base.minFrac += 0.04; base.maxFrac += 0.06; base.accuracy -= 0.04;
  } else if (hpRatio <= 0.40) {
    if (State.aiDifficulty === 'hard') { base.minFrac -= 0.03; base.maxFrac -= 0.02; base.accuracy -= 0.06; }
    else if (State.aiDifficulty === 'medium') { base.minFrac -= 0.01; base.maxFrac += 0.02; base.accuracy -= 0.07; }
    else { base.minFrac += 0.08; base.maxFrac += 0.12; base.accuracy -= 0.10; base.attemptChance -= 0.08; }
  }
  base.minFrac = Math.max(0.08, Math.min(base.minFrac, 0.95));
  base.maxFrac = Math.max(base.minFrac + 0.05, Math.min(base.maxFrac, 1.15));
  base.accuracy = Math.max(0.25, Math.min(base.accuracy, 0.97));
  base.attemptChance = Math.max(0.55, Math.min(base.attemptChance, 0.99));
  return base;
}

/* ── Helpers ── */
export function storyLevelToDiff(l) { return l <= 5 ? 'relax' : l <= 10 ? 'easy' : l <= 15 ? 'medium' : 'hard'; }
export function isRelaxMode() { return State.aiDifficulty === 'relax' && State.gameMode !== 'online'; }

const SPRITES = ['🥷'];
function pickSprite() { return SPRITES[Math.floor(Math.random() * SPRITES.length)]; }
function makePlayer(id, name, color, sprite, isAI = false) {
  return {
    id, name, color, sprite, isAI, hp: C.MAX_HP, answered: false, answerVal: null,
    superUsed: { flash: 0, glitch: 0, shield: 0 }, superCooldown: { flash: false, glitch: false, shield: false },
    isAbsent: false, hasQuit: false, _orderAttempts: 0
  };
}

function pickMechanic(diff) {
  /* Conservé pour compatibilité mais n'est plus utilisé directement —
     la mécanique est désormais assignée dans formula.js → generateRounds() */
  if (isRelaxMode()) return 'normal';
  const r = Math.random();
  if (diff === 'easy') return r < 0.60 ? 'normal' : 'speed';
  if (r < 0.40) return 'normal';
  if (r < 0.65) return 'speed';
  if (r < 0.85) return 'order';
  return 'blind';
}

/* ══ BEGIN BATTLE ══ */
export function beginBattle() {
  _battleFinished = false; /* FIX : reset du guard pour cette nouvelle partie */
  pauseMenuMusicForBattle();
  State.players = [
    makePlayer('p1', State.oathNames[0] || 'Joueur', 'p1c', pickSprite(), false),
    makePlayer('ai', 'NEXUS', 'aic', '🤖', true)
  ];
  State.allRounds = generateRounds();
  State.resetBattle();
  sfx.battleStart();
  showScreen('screenBattle');
  renderFighters();
  renderSupers();
  if (State.gameMode !== 'online') scheduleAISupers();
  loadRound();
  if (State.gameMode !== 'online') startAbsentCheck();
}

/* ══ LOAD ROUND ══ */
export function loadRound() {
  clearInterval(State.timerInterval);
  State.currentRoundToken++;
  const thisToken = State.currentRoundToken;

  const faInit = document.getElementById('formulaAnswer');
  if (faInit) { faInit.textContent = ''; faInit.style.display = 'none'; faInit.className = 'formula-answer'; }

  State.players.forEach(p => { p.answered = false; p.answerVal = null; State.npVals[p.id] = ''; p._orderAttempts = 0; });
  State.blindRevealed = false;
  State.orderOptions = [];

  const round = State.allRounds[State.roundIndex];
  /* Mécanique pré-assignée dans generateRounds() → même valeur sur tous les appareils.
     En mode relax, on force toujours 'normal'. Fallback sur pickMechanic si ancien format. */
  State.currentMechanic = isRelaxMode()
    ? 'normal'
    : (round.mechanic || pickMechanic(round.difficulty));

  let roundTime = isRelaxMode() ? 999 : round.time;
  if (State.currentMechanic === 'speed' && !isRelaxMode()) roundTime = Math.max(8, Math.floor(round.time * 0.55));
  if (State.currentMechanic === 'blind') roundTime = Math.floor(round.time * 1.35);

  const diffLabel = { easy: 'FACILE', medium: 'MOYEN', hard: 'DIFFICILE' };
  const diffCls   = { easy: 'diff-easy', medium: 'diff-medium', hard: 'diff-hard' };
  const ptCls     = { easy: 'pt-easy', medium: 'pt-medium', hard: 'pt-hard' };
  const dmg = C.DAMAGE[round.difficulty];

  document.getElementById('roundLabel').textContent = `ROUND ${State.roundIndex + 1}/${C.ROUNDS}`;
  const db = document.getElementById('diffBadge');
  db.textContent = diffLabel[round.difficulty]; db.className = `diff-badge ${diffCls[round.difficulty]}`;
  const pi = document.getElementById('ptInfo');
  pi.textContent = `💥 −${dmg} HP`; pi.className = `points-info ${ptCls[round.difficulty]}`;

  const fd = document.getElementById('formulaDisplay');
  const bh = document.getElementById('blindHint');
  const fl = document.getElementById('formulaLabel');
  fd.className = 'formula-big';
  if (State.currentMechanic === 'blind') {
    fd.className = 'formula-big blind-mode'; fd.textContent = round.formula;
    bh.style.display = 'block'; fl.textContent = 'AVEUGLE — touche pour révéler';
  } else if (State.currentMechanic === 'speed') {
    fd.textContent = round.formula; bh.style.display = 'none';
    fl.textContent = '⚡ SPEED — retire 10 HP supplémentaires à la cible';
  } else if (State.currentMechanic === 'order') {
    fd.textContent = round.formula; bh.style.display = 'none';
    fl.textContent = '🔢 CHOIX — sélectionne le résultat';
  } else {
    fd.textContent = round.formula; bh.style.display = 'none';
    fl.textContent = 'RÉSOUS LA FORMULE';
  }

  const faClean = document.getElementById('formulaAnswer');
  if (faClean) { faClean.textContent = ''; faClean.style.display = 'none'; faClean.className = 'formula-answer'; }
  document.getElementById('feedbackBar').className = 'feedback-bar';

  const tb = document.getElementById('timerBar');
  tb.className = `timer-bar t-${round.difficulty}`;
  State.timeLeft = roundTime; State.roundTimeRef = roundTime;

  if (isRelaxMode()) {
    document.getElementById('timerBar').style.width = '100%';
    document.getElementById('timerNum').textContent = '∞';
    document.getElementById('timerNum').className = 'timer-num no-timer';
  } else {
    updateTimerUI(roundTime, roundTime);
  }

  State.speedBonusActive = (State.currentMechanic === 'speed');
  State.criticalActive = false;

  renderAnswerZone();
  renderOrderZone(round);
  renderNumpad();
  renderSupers();
  renderScoreBar();

  State.roundActive = true; State.isPaused = false;
  if (State.gameMode !== 'online') {
    scheduleAI({ ...round, time: roundTime });
    maybeFireAISuper(State.roundIndex);
    setTimeout(() => startTimer({ ...round, time: roundTime }), 600);
  } else {
    /* En online : masquer la formule jusqu'au vrai départ (évite le flash visuel).
       startAt est protégé : s'il est dans le passé (retard réseau), on utilise now+100ms
       pour que le timer ne démarre pas à 0 immédiatement. */
    const safeStart = Math.max(State._onlineRoundStartAt || 0, Date.now() + 50);
    const msToStart = safeStart - Date.now();

    /* Masquer la formule pendant la phase countdown restante */
    if (msToStart > 200) {
      const fd = document.getElementById('formulaDisplay');
      const fl = document.getElementById('formulaLabel');
      if (fd) { fd.style.visibility = 'hidden'; }
      if (fl) { fl.style.visibility = 'hidden'; }
      setTimeout(() => {
        const fd2 = document.getElementById('formulaDisplay');
        const fl2 = document.getElementById('formulaLabel');
        if (fd2) fd2.style.visibility = '';
        if (fl2) fl2.style.visibility = '';
      }, msToStart - 100);
    }

    startTimer({ ...round, time: roundTime }, safeStart);
    if (State.isHost) _startPeriodicSync(round, roundTime);
  }
}

/* ══ TIMER ══ */
/* Référence partagée pour que Flash puisse décaler le timer en cours depuis receiveOpponentSuper */
const _timerEndMsRef = { val: 0, pauseOffsetRef: { v: 0 } };

/* Appelé par receiveOpponentSuper quand Flash est reçu — avance la fin du timer de −10s */
export function applyFlashPenaltyOnTimer() {
  if (!State.roundActive || isRelaxMode()) return;
  _timerEndMsRef.val = Math.max(_timerEndMsRef.val - 10000, Date.now() + 500);
}

function startTimer(round, absoluteStart) {
  clearInterval(State.timerInterval);
  if (isRelaxMode()) return;
  /* Timestamp absolu partagé : les 2 appareils calculent timeLeft depuis le même t=0 */
  _timerEndMsRef.val = (absoluteStart || Date.now()) + round.time * 1000;
  let _pauseStart = 0, _pauseOffset = 0;
  State.timerInterval = setInterval(() => {
    if (State.isPaused) { if (!_pauseStart) _pauseStart = Date.now(); return; }
    if (_pauseStart) { _pauseOffset += Date.now() - _pauseStart; _pauseStart = 0; }
    State.timeLeft = Math.max(0, (_timerEndMsRef.val + _pauseOffset - Date.now()) / 1000);
    updateTimerUI(State.timeLeft, round.time);
    if (State.timeLeft <= 0) {
      clearInterval(State.timerInterval); State.roundActive = false;
      State.players.forEach(p => {
        if (!p.hasQuit) {
          p.hp = Math.max(0, p.hp - C.NO_ANSWER_PENALTY);
          updateHP(p); showHpLossFX(p.id, `−${C.NO_ANSWER_PENALTY}`, 'var(--red)');
        }
      });
      State.playerStreak = 0; renderScoreBar(); sfx.wrong();
      const fa = document.getElementById('formulaAnswer');
      if (fa) { fa.textContent = ''; fa.style.display = 'none'; fa.className = 'formula-answer'; }
      const _ridxTimer = State.roundIndex; const _ansTimer = round.answer;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (State.roundIndex !== _ridxTimer) return;
        if (fa) { fa.textContent = `= ${_ansTimer}`; fa.style.display = 'block'; fa.classList.add('answer-revealed'); }
      }));
      freezeTimerUI();
      showFeedback(`⏰ Temps écoulé ! Réponse : ${round.answer} — −${C.NO_ANSWER_PENALTY} HP pour tous`, 'draw');
      setTimeout(() => hideFeedback(), 4500);
      setTimeout(() => {
        clearTimeout(State.shieldExpireTimer); clearTimeout(State.aiShieldExpireTimer);
        if (State.playerShieldActive) deactivateShield();
        if (State.aiShieldActive) deactivateAIShield();
        triggerRoundTransition(() => advanceRound());
      }, 5000);
    }
  }, 50);
}

export function advanceRound() {
  State.roundIndex++;
  if (State.roundIndex >= C.ROUNDS || State.players.some(p => p.hp <= 0)) finishBattle();
  else if (State.gameMode === 'online') _onlineNextRound();
  else loadRound();
}

/* ══ AI ══ */
function scheduleAI(round) {
  const ai = State.players.find(p => p.isAI);
  if (!ai || ai.hasQuit) return;
  const prof = getAIProfile(round);
  const baseTime = isRelaxMode() ? 18 : round.time;
  const maxAttempts = State.aiDifficulty === 'relax' ? 4 : State.aiDifficulty === 'easy' ? 2 : State.aiDifficulty === 'medium' ? 2 : 3;
  let attempts = 0;

  function doAttempt() {
    if (!State.roundActive || State.isPaused) return;
    const ai = State.players.find(p => p.isAI);
    if (!ai || ai.hasQuit || ai.answered || attempts >= maxAttempts) return;
    attempts++;
    if (Math.random() > prof.attemptChance) return;
    const frac = prof.minFrac + Math.random() * (prof.maxFrac - prof.minFrac);
    const delay = frac * baseTime * 1000;
    const tokenAtSchedule = State.currentRoundToken;
    setTimeout(() => {
      if (!State.roundActive || State.isPaused || State.currentRoundToken !== tokenAtSchedule) return;
      const ai = State.players.find(p => p.isAI);
      if (!ai || ai.hasQuit || ai.answered) return;
      const isCorrect = Math.random() < prof.accuracy;
      let aiVal;
      if (isCorrect) { aiVal = round.answer; }
      else { const spread = round.difficulty === 'easy' ? 4 : round.difficulty === 'medium' ? 6 : 8; let err = Math.floor(Math.random() * spread) + 1; if (Math.random() > 0.5) err *= -1; aiVal = round.answer + err; }
      ai.answerVal = aiVal;
      if (aiVal === round.answer) { ai.answered = true; sfx.correct(); resolveCorrectAnswer(ai, round); }
      else { ai.hp = Math.max(0, ai.hp - C.SELF_DAMAGE); updateHP(ai); sfx.wrong(); animFighter(ai.id, 'hurt'); showHpLossFX(ai.id, `−${C.SELF_DAMAGE}`, 'var(--red)'); showFeedback(`NEXUS se trompe — −${C.SELF_DAMAGE} HP`, 'fail'); if (ai.hp <= 0) { finishBattle(); return; } if (attempts < maxAttempts) doAttempt(); }
    }, delay);
  }
  doAttempt();
}

/* ══ AI SUPERS ══ */
function scheduleAISupers() {
  const ai = State.players.find(p => p.isAI);
  if (!ai) return;
  const config = {
    relax:  { uses: 0, types: [], delayMin: 12000, delayMax: 18000 },
    easy:   { uses: 1, types: ['flash'], delayMin: 9000, delayMax: 15000 },
    medium: { uses: 2, types: ['flash','glitch'], delayMin: 5000, delayMax: 11000 },
    hard:   { uses: 4, types: ['flash','glitch','shield','flash'], delayMin: 2500, delayMax: 7000 }
  };
  const cfg = config[State.aiDifficulty] || config.easy;
  const allowedTypes = cfg.types.filter(t => State.unlockedSupers[t]);
  if (!allowedTypes.length) { ai._scheduledSupers = []; return; }
  const chosen = [];
  while (chosen.length < cfg.uses && chosen.length < C.ROUNDS) {
    const ri = Math.floor(Math.random() * C.ROUNDS);
    if (!chosen.find(c => c.roundIdx === ri)) chosen.push({ roundIdx: ri });
  }
  ai._scheduledSupers = chosen.map((c, idx) => ({ roundIdx: c.roundIdx, type: allowedTypes[idx % allowedTypes.length], delayMin: cfg.delayMin, delayMax: cfg.delayMax }));
}

function maybeFireAISuper(roundIdx) {
  const ai = State.players.find(p => p.isAI);
  if (!ai || !ai._scheduledSupers) return;
  ai._scheduledSupers.filter(s => s.roundIdx === roundIdx).forEach(s => {
    if (s.type === 'shield') { if (ai.superUsed.shield >= 1) return; } else { if (ai.superUsed[s.type] >= 2) return; }
    const dMin = s.delayMin || 3000, dMax = s.delayMax || 9000;
    const delay = dMin + Math.random() * (dMax - dMin);
    setTimeout(() => {
      if (!State.roundActive) return;
      ai.superUsed[s.type] = (ai.superUsed[s.type] || 0) + 1;
      const fd = document.getElementById('formulaDisplay'); sfx.superpow();
      if (s.type === 'flash') {
        fd.classList.add('flash'); State.timeLeft = Math.max(1, State.timeLeft - 10);
        showImpactFX('⚡', 'var(--gold-neon)');
        showFeedback(`<span style="color:var(--red);font-weight:800;">🤖 NEXUS active ⚡ Flash — −10s sur ton timer !</span>`, 'fail');
        setTimeout(() => fd.classList.remove('flash'), 700);
      } else if (s.type === 'glitch') {
        fd.classList.add('glitch'); showImpactFX('👾', 'var(--purple)');
        showFeedback(`<span style="color:var(--red);font-weight:800;">🤖 NEXUS active 👾 Glitch — formule altérée !</span>`, 'fail');
        setTimeout(() => fd.classList.remove('glitch'), 10000);
      } else if (s.type === 'shield') {
        if (State.aiShieldActive) return;
        State.aiShieldActive = true; sfx.shield();
        showImpactFX('🛡️🤖', 'var(--red)');
        const aiEl = document.getElementById('fighter_ai');
        if (aiEl) aiEl.classList.add('shielded');
        showFeedback('🛡️ NEXUS active son bouclier !', 'draw');
        clearTimeout(State.aiShieldExpireTimer);
        State.aiShieldExpireTimer = setTimeout(() => { if (State.aiShieldActive) deactivateAIShield(); }, 10000);
      }
      updateAllSuperDots();
    }, delay);
  });
}

/* ══ ANSWER ZONE ══ */
export function renderAnswerZone() {
  const zone = document.getElementById('answerZone');
  if (State.currentMechanic === 'order') { zone.innerHTML = ''; return; }
  zone.innerHTML = '';
  State.players.filter(p => !p.isAI && !p.isRemote && !p.hasQuit).forEach(p => {
    zone.innerHTML += `<div class="player-answer-row">
      <input type="text" inputmode="none" readonly class="ans-input" id="ans_${p.id}" placeholder="?" autocomplete="off" aria-label="Réponse de ${p.name}">
      <button class="fire-btn" id="firebtn_${p.id}" aria-label="Valider la réponse" onclick="window._submitAnswer('${p.id}')">🎯 RÉPONSE</button>
    </div>`;
  });
}

export function renderOrderZone(round) {
  const zone = document.getElementById('orderZone');
  if (State.currentMechanic !== 'order') { zone.innerHTML = ''; return; }
  const correct = round.answer;
  const decoys = new Set(); decoys.add(correct);
  let guard = 0;
  while (decoys.size < 4 && guard < 200) { guard++; const d = correct + Math.floor(Math.random() * 21) - 10; if (d !== correct) decoys.add(d); }
  let fill = correct + 11; while (decoys.size < 4) decoys.add(fill++);
  State.orderOptions = Array.from(decoys).sort(() => Math.random() - 0.5);
  zone.innerHTML = `<div class="order-zone" role="group" aria-label="Sélectionne la bonne réponse">
    <div class="order-label">Sélectionne le résultat — <span id="orderAttemptsLeft" style="color:var(--gold);font-weight:700;">2 essais</span></div>
    <div class="order-options">
      ${State.orderOptions.map((v, i) => `<button class="order-btn" id="ob_${i}" aria-label="Réponse ${v}" onclick="window._tapOrderBtn(${i},${v},${correct})">${v}</button>`).join('')}
    </div>
  </div>`;
}

export function renderNumpad() {
  const zone = document.getElementById('numpadZone');
  if (State.currentMechanic === 'order') { zone.innerHTML = ''; return; }
  const human = State.players.filter(p => !p.isAI && !p.isRemote && !p.hasQuit);
  if (!human.length) { zone.innerHTML = ''; return; }
  const p = human[0];
  zone.innerHTML = `<div class="numpad" id="np_${p.id}" role="group" aria-label="Clavier numérique">
    ${[7,8,9,4,5,6,1,2,3].map(n => `<button class="numpad-btn" aria-label="${n}" onclick="window._npPress('${p.id}','${n}')">${n}</button>`).join('')}
    <button class="numpad-btn neg" aria-label="Inverser le signe" onclick="window._npNeg('${p.id}')">±</button>
    <button class="numpad-btn" aria-label="0" onclick="window._npPress('${p.id}','0')">0</button>
    <button class="numpad-btn del" aria-label="Supprimer" onclick="window._npDel('${p.id}')">⌫</button>
  </div>`;
}

/* ── Numpad handlers ── */
export function npPress(pid, d) {
  if (!State.roundActive || State.isPaused) return;
  const p = State.players.find(x => x.id === pid);
  if (!p || p.hasQuit || p.answered) return;
  if (!State.npVals[pid]) State.npVals[pid] = '';
  if (State.npVals[pid].replace('-', '').length >= 6) return;
  State.npVals[pid] += d;
  const inp = document.getElementById(`ans_${pid}`); if (inp) inp.value = State.npVals[pid];
}
export function npNeg(pid) {
  if (!State.roundActive || State.isPaused) return;
  if (!State.npVals[pid]) State.npVals[pid] = '';
  State.npVals[pid] = State.npVals[pid].startsWith('-') ? State.npVals[pid].slice(1) : '-' + State.npVals[pid];
  const inp = document.getElementById(`ans_${pid}`); if (inp) inp.value = State.npVals[pid];
}
export function npDel(pid) {
  if (!State.roundActive || State.isPaused) return;
  if (!State.npVals[pid]) return;
  State.npVals[pid] = State.npVals[pid].slice(0, -1);
  const inp = document.getElementById(`ans_${pid}`); if (inp) inp.value = State.npVals[pid];
}

/* ══ BLIND REVEAL ══ */
export function revealBlind() {
  if (State.currentMechanic !== 'blind' || State.blindRevealed) return;
  State.blindRevealed = true;
  const fd = document.getElementById('formulaDisplay');
  fd.classList.remove('blind-mode'); fd.classList.add('revealed');
  document.getElementById('blindHint').style.display = 'none';
  if (!isRelaxMode()) State.timeLeft = Math.max(1, State.timeLeft - 3);
}

/* ══ SUBMIT ══ */
export function submitAnswer(pid) {
  if (!State.roundActive || State.isPaused) return;
  const p = State.players.find(x => x.id === pid);
  if (!p || p.hasQuit || p.answered) return;
  if (State.currentMechanic === 'blind' && !State.blindRevealed) { revealBlind(); return; }
  const raw = State.npVals[pid] || '', val = parseFloat(raw);
  if (isNaN(val) || raw === '') {
    const inp = document.getElementById(`ans_${pid}`);
    if (inp) { inp.classList.add('wrong'); setTimeout(() => inp.classList.remove('wrong'), 500); }
    return;
  }
  const submittedToken = State.currentRoundToken;
  const round = State.allRounds[State.roundIndex];
  const isCorrect = Math.abs(val - round.answer) <= 0.5;
  if (isCorrect) {
    if (submittedToken !== State.currentRoundToken) return;
    p.answerVal = val; p.answered = true; State.npVals[pid] = '';
    const inp = document.getElementById(`ans_${pid}`); if (inp) { inp.disabled = true; inp.classList.add('correct'); }
    const fb2 = document.getElementById(`firebtn_${pid}`); if (fb2) { fb2.disabled = true; fb2.textContent = '✓ VALIDÉ'; fb2.classList.add('validated'); }
    document.getElementById(`np_${pid}`)?.querySelectorAll('button').forEach(b => b.disabled = true);
    if (State.gameMode === 'online') State.onlineAdapter?.broadcastAnswer(val, Date.now(), true, State.roundIndex);
    sfx.correct(); resolveCorrectAnswer(p, round);
  } else {
    p.hp = Math.max(0, p.hp - C.SELF_DAMAGE); updateHP(p); sfx.wrong(); animFighter(pid, 'hurt'); showHpLossFX(pid, `−${C.SELF_DAMAGE}`, 'var(--red)');
    State.npVals[pid] = '';
    const inp = document.getElementById(`ans_${pid}`); if (inp) { inp.value = ''; inp.classList.add('wrong'); setTimeout(() => inp.classList.remove('wrong'), 500); }
    if (State.gameMode === 'online') State.onlineAdapter?.broadcastAnswer(val, Date.now(), false, State.roundIndex);
    State.playerStreak = 0; renderScoreBar();
    if (p.hp <= 0) { State.roundActive = false; clearInterval(State.timerInterval); freezeTimerUI(); document.querySelectorAll('.ans-input,.fire-btn,.numpad-btn').forEach(b => b.disabled = true); showFeedback(`💀 ${p.name} a épuisé ses HP — réponse correcte : ${round.answer}`, 'fail'); setTimeout(() => finishBattle(), 5000); }
    else { showFeedback(`Mauvaise réponse — −${C.SELF_DAMAGE} HP`, 'fail'); }
  }
}

export function tapOrderBtn(idx, val, correct) {
  if (!State.roundActive || State.isPaused) return;
  const p = State.players.find(x => !x.isAI && !x.hasQuit);
  if (!p || p.answered) return;
  const submittedToken = State.currentRoundToken;
  const btn = document.getElementById(`ob_${idx}`);
  if (val === correct) {
    if (submittedToken !== State.currentRoundToken) return;
    btn.classList.add('correct-order');
    document.querySelectorAll('.order-btn').forEach(b => b.disabled = true);
    p.answered = true;
    /* En online : broadcaster la bonne réponse exactement comme submitAnswer */
    if (State.gameMode === 'online') State.onlineAdapter?.broadcastAnswer(val, Date.now(), true, State.roundIndex);
    sfx.correct(); resolveCorrectAnswer(p, State.allRounds[State.roundIndex]);
  } else {
    btn.classList.add('wrong-order'); setTimeout(() => btn.classList.remove('wrong-order'), 500);
    p.hp = Math.max(0, p.hp - C.SELF_DAMAGE); updateHP(p); sfx.wrong(); animFighter(p.id, 'hurt'); showHpLossFX(p.id, `−${C.SELF_DAMAGE}`, 'var(--red)');
    p._orderAttempts = (p._orderAttempts || 0) + 1;
    const attLeft = 2 - p._orderAttempts;
    const attEl = document.getElementById('orderAttemptsLeft');
    if (p._orderAttempts >= 2) {
      document.querySelectorAll('.order-btn').forEach(b => b.disabled = true);
      if (attEl) attEl.textContent = '0 essai';
      showFeedback(`Plus d'essais — −${C.SELF_DAMAGE} HP · attends la fin du round`, 'fail');
      p.answered = true;
      if (p.hp <= 0) { State.roundActive = false; clearInterval(State.timerInterval); freezeTimerUI(); showFeedback(`💀 ${p.name} a épuisé ses HP — réponse correcte : ${correct}`, 'fail'); setTimeout(() => finishBattle(), 5000); }
    } else {
      if (attEl) attEl.textContent = `${attLeft} essai${attLeft > 1 ? 's' : ''}`;
      showFeedback(`Mauvaise réponse — −${C.SELF_DAMAGE} HP · ${attLeft} essai restant`, 'fail');
      if (p.hp <= 0) { State.roundActive = false; clearInterval(State.timerInterval); freezeTimerUI(); document.querySelectorAll('.order-btn').forEach(b => b.disabled = true); showFeedback(`💀 ${p.name} a épuisé ses HP — réponse correcte : ${correct}`, 'fail'); setTimeout(() => finishBattle(), 5000); }
    }
  }
}

/* ══ RESOLVE CORRECT ══ */
function resolveCorrectAnswer(winner, round) {
  if (!State.roundActive) return;
  clearInterval(State.timerInterval);
  State.roundActive = false;

  const isOpponent = winner.isAI || !!winner.isRemote;
  const round_time = isRelaxMode() ? 999 : State.roundTimeRef;
  const isCritical = !isRelaxMode() && State.timeLeft > round_time * 0.8;
  let dmg = C.DAMAGE[round.difficulty] || 10;
  const speedBonus = (State.currentMechanic === 'speed') ? 10 : 0;
  if (isCritical) dmg = dmg * 2;
  const totalDmg = dmg + speedBonus;

  const enemy = State.players.find(p => p.id !== winner.id && !p.hasQuit);
  if (!enemy) return;

  if ((isOpponent && State.playerShieldActive) || (!isOpponent && State.aiShieldActive)) {
    const blocker = isOpponent ? State.players.find(p => !p.isAI && !p.isRemote) : State.players.find(p => p.isAI || p.isRemote);
    const blockerName = isOpponent ? (blocker?.name || 'Toi') : winner.name;
    if (isOpponent) State.playerShieldActive = false; else State.aiShieldActive = false;
    showFeedback(`🛡️ ${blockerName} bloque l'attaque avec son bouclier !`, 'draw');
    sfx.shieldBlock(); deactivateShield(); deactivateAIShield();
    setTimeout(() => hideFeedback(), 1500);
    setTimeout(() => { State.roundIndex++; if (State.roundIndex >= C.ROUNDS || State.players.some(p => p.hp <= 0)) finishBattle(); else if (State.gameMode === 'online') triggerRoundTransition(() => _onlineNextRound()); else triggerRoundTransition(() => loadRound()); }, 3000);
    return;
  }

  const feedbackColor = isOpponent ? 'var(--red)' : (isCritical ? 'var(--cyan)' : 'var(--green)');
  const fzone = document.querySelector('.formula-zone');
  if (fzone) { fzone.classList.add('slowmo-hit'); setTimeout(() => fzone.classList.remove('slowmo-hit'), 450); }

  const opponentLabel = winner.isAI ? '🤖 NEXUS' : `⚔️ ${winner.name}`;
  let msg = isOpponent ? `${opponentLabel} frappe !` : `✅ ${winner.name} frappe !`;
  let detail = ` [ −${totalDmg} HP ]`;
  if (isCritical) detail = " 💥 CRITIQUE !" + detail;
  if (speedBonus > 0) detail += " ⚡ SPEED";
  showFeedback(`<span style="color:${feedbackColor}; font-weight:800;">${msg}${detail}</span>`, isOpponent ? 'fail' : 'ok');

  enemy.hp = Math.max(0, enemy.hp - totalDmg); updateHP(enemy);
  animFighter(winner.id, 'attack'); animFighter(enemy.id, 'hurt');
  fireBang(winner.id, enemy.id, round.difficulty);

  const fa = document.getElementById('formulaAnswer');
  if (fa) { fa.textContent = ''; fa.style.display = 'none'; fa.className = 'formula-answer'; }
  const _roundIndexAtReveal = State.roundIndex;
  const _answerToShow = round.answer;
  requestAnimationFrame(() => {
    if (State.roundIndex !== _roundIndexAtReveal) return;
    if (fa) { fa.textContent = `= ${_answerToShow}`; fa.style.display = 'block'; fa.classList.add('answer-revealed'); }
  });

  freezeTimerUI();
  document.querySelectorAll('.ans-input, .fire-btn, .order-btn, .numpad-btn').forEach(b => b.disabled = true);
  showHpLossFX(enemy.id, `−${totalDmg}`, 'var(--red)');

  if (!isOpponent) {
    let pts = C.SCORE_BASE[round.difficulty];
    const timeFrac = isRelaxMode() ? 1 : (State.timeLeft / State.roundTimeRef);
    if (timeFrac > 0.5) pts += C.SCORE_SPEED_BONUS;
    State.playerStreak++;
    State.playerCombo = Math.min(State.playerCombo + 1, 5);
    pts += C.STREAK_BONUS[Math.min(State.playerStreak, 5)];
    if (State.currentMechanic === 'speed') pts = Math.floor(pts * 1.5);
    State.battleScore += pts;
    showScorePop(pts, winner.id); renderScoreBar();
    animateXPGain(C.XP_PER_ROUND_WIN);
    if (isCritical) { sfx.criticalPlayer(); showCriticalFX(true); }
    else if (State.playerStreak >= 3) sfx.combo();
    else sfx.scorePop();
  } else {
    State.playerStreak = 0; renderScoreBar();
    if (isCritical) { sfx.criticalAI(); showCriticalFX(false); }
    else sfx.gunshot();
  }

  if (isCritical) triggerSlowMo();
  setTimeout(() => hideFeedback(), 4500);
  setTimeout(() => {
    clearTimeout(State.shieldExpireTimer); clearTimeout(State.aiShieldExpireTimer);
    if (State.playerShieldActive) deactivateShield();
    if (State.aiShieldActive) deactivateAIShield();
    triggerRoundTransition(() => {
      State.roundIndex++;
      if (State.players.some(p => p.hp <= 0) || State.roundIndex >= C.ROUNDS) finishBattle();
      else if (State.gameMode === 'online') _onlineNextRound();
      else loadRound();
    });
  }, 5000);
}

/* ══ SUPERS ══ */
export function renderSupers() {
  const zone = document.getElementById('supersZone'); zone.innerHTML = '';
  /* En mode online, tous les supers sont activés */
  if (State.gameMode === 'online' && !State.unlockedSupers.flash) {
    State.unlockedSupers = { flash: true, glitch: true, shield: true };
  }
  State.players.filter(p => !p.isAI && !p.isRemote && !p.hasQuit).forEach(p => {
    const fl = 2 - p.superUsed.flash, gl = 2 - p.superUsed.glitch, sh = 1 - p.superUsed.shield;
    let html = '';
    if (State.unlockedSupers.flash)
      html += `<button class="sp-btn flash-btn" ${fl <= 0 || p.superCooldown.flash ? 'disabled' : ''} aria-label="Super Flash, ${fl} utilisations restantes" onclick="window._activateSuper('${p.id}','flash')"><span class="sp-name">⚡ Flash</span><span class="sp-desc">(−10s les 2 timers)</span><div class="sp-uses">${fl}/2</div></button>`;
    if (State.unlockedSupers.glitch)
      html += `<button class="sp-btn glitch-btn" ${gl <= 0 || p.superCooldown.glitch ? 'disabled' : ''} aria-label="Super Glitch, ${gl} utilisations restantes" onclick="window._activateSuper('${p.id}','glitch')"><span class="sp-name">👾 Glitch</span><span class="sp-desc">(altère formule)</span><div class="sp-uses">${gl}/2</div></button>`;
    if (State.unlockedSupers.shield)
      html += `<button class="sp-btn shield-btn ${State.playerShieldActive ? 'active-shield' : ''}" ${sh <= 0 || p.superCooldown.shield ? 'disabled' : ''} aria-label="Super Bouclier, ${sh} utilisation restante" onclick="window._activateSuper('${p.id}','shield')"><span class="sp-name">🛡️ Bouclier</span><span class="sp-desc">(bloque 1 attaque)</span><div class="sp-uses">${sh}/1</div></button>`;
    zone.innerHTML = html;
  });
}

export function activateSuper(pid, type) {
  const p = State.players.find(x => x.id === pid);
  if (!p || p.superCooldown[type] || !State.roundActive || State.isPaused) return;
  if (type === 'shield') { if (p.superUsed.shield >= 1) return; } else if (p.superUsed[type] >= 2) return;
  sfx.superpow(); p.superUsed[type]++; p.superCooldown[type] = true;
  const fd = document.getElementById('formulaDisplay');
  const superNames = { flash: '⚡ Flash', glitch: '👾 Glitch', shield: '🛡️ Bouclier' };
  if (type === 'flash') {
    fd.classList.add('flash');
    /* Flash pénalise les DEUX timers : le sien ET celui de l'adversaire */
    if (!isRelaxMode()) applyFlashPenaltyOnTimer();
    showImpactFX('⚡', 'var(--gold-neon)');
    const msg = State.gameMode === 'online'
      ? `⚡ Flash — −10s sur les deux timers !`
      : `${p.name} active ${superNames.flash} — −10s au timer de NEXUS !`;
    showFeedback(msg, 'ok');
    setTimeout(() => fd.classList.remove('flash'), 700);
  } else if (type === 'glitch') {
    fd.classList.add('glitch'); showImpactFX('👾', 'var(--purple)');
    const msg = State.gameMode === 'online' ? `👾 Glitch envoyé — formule adversaire altérée !` : `${p.name} active ${superNames.glitch} — formule altérée !`;
    showFeedback(msg, 'ok');
    setTimeout(() => fd.classList.remove('glitch'), 10000);
  } else if (type === 'shield') {
    State.playerShieldActive = true; sfx.shield();
    showImpactFX('🛡️', 'var(--blue-neon)');
    showFeedback(`${p.name} active ${superNames.shield} — prochaine attaque bloquée !`, 'ok');
    const fighter = document.getElementById(`fighter_${pid}`); if (fighter) fighter.classList.add('shielded');
    clearTimeout(State.shieldExpireTimer);
    State.shieldExpireTimer = setTimeout(() => { if (State.playerShieldActive) deactivateShield(); }, 10000);
  }
  /* En online : diffuser le super à l'adversaire */
  if (State.gameMode === 'online') State.onlineAdapter?.broadcastSuper(type);
  if (type !== 'shield') {
    let cd = 5;
    const cdI = setInterval(() => { cd--; if (cd <= 0) { clearInterval(cdI); p.superCooldown[type] = false; renderSupers(); } }, 1000);
  } else { p.superCooldown.shield = false; }
  renderSupers(); updateAllSuperDots();
}

function deactivateShield() {
  State.playerShieldActive = false;
  State.players.filter(p => !p.isAI).forEach(p => { const f = document.getElementById(`fighter_${p.id}`); if (f) f.classList.remove('shielded'); });
  renderSupers();
}
function deactivateAIShield() {
  State.aiShieldActive = false;
  document.getElementById('fighter_ai')?.classList.remove('shielded');
  updateAllSuperDots();
}

/* ══ PAUSE ══ */
export function togglePause() {
  if (!State.roundActive && !State.isPaused) return;
  State.isPaused = !State.isPaused;
  const overlay = document.getElementById('pauseOverlay');
  if (State.isPaused) {
    overlay.classList.remove('hidden');
    resumeMenuMusic();
    State.players.filter(p => !p.isAI && !p.hasQuit).forEach(p => {
      p.hp = Math.max(0, p.hp - C.PAUSE_PENALTY);
      updateHP(p); showImpactFX(`⏸ −${C.PAUSE_PENALTY} HP`, 'var(--red)');
    });
    sfx.wrong();
  } else {
    overlay.classList.add('hidden');
    pauseMenuMusicForBattle();
  }
}

export function quitBattle() {
  if (!confirm('Abandonner ce combat ? La défaite sera enregistrée.')) return;
  /* Notifier l'adversaire EN PREMIER — avant tout cleanup */
  if (State.gameMode === 'online') State.onlineAdapter?.broadcastQuit();
  clearAll();
  document.removeEventListener('visibilitychange', handleVisibility);
  State.players.filter(p => !p.isAI && !p.isRemote).forEach(p => { p.hp = 0; p.hasQuit = true; });
  if (State.gameMode === 'online') {
    /* Délai 500ms pour laisser le message partir avant de couper le canal */
    setTimeout(() => State.onlineAdapter?.cleanup(), 500);
  }
  finishBattle(true);
}

/* ══ ABSENT ══ */
export function startAbsentCheck() { document.addEventListener('visibilitychange', handleVisibility); }
function handleVisibility() {
  const hidden = document.hidden;
  State.players.filter(p => !p.isAI && !p.isRemote && !p.hasQuit).forEach(p => {
    if (hidden && !p.isAbsent) {
      /* Départ en arrière-plan : pénalité immédiate (garantit que finishBattle
         verra les bons HP même si le round se termine avant le retour) */
      p.isAbsent = true;
      setAbsentBadge(p.id, true);
      sfx.absent();
      if (!State.roundActive) return; /* entre deux rounds — badge seulement, pas de pénalité */
      p.hp = Math.max(0, p.hp - C.ABSENT_PENALTY);
      updateHP(p);
      showImpactFX(`👁️ −${C.ABSENT_PENALTY} HP`, 'var(--red)');
      sfx.wrong();
      if (State.gameMode === 'online') {
        State.onlineAdapter?.broadcastAbsentPenalty(p.hp);
      }
      if (p.hp <= 0) {
        State.roundActive = false;
        clearInterval(State.timerInterval);
        showFeedback(`💀 ${p.name} a mis le jeu en arrière-plan — −${C.ABSENT_PENALTY} HP · KO !`, 'fail');
        setTimeout(() => finishBattle(), 5000);
      }
    } else if (!hidden && p.isAbsent) {
      /* Retour : juste effacer le badge — la pénalité a déjà été appliquée au départ */
      p.isAbsent = false;
      setAbsentBadge(p.id, false);
    }
  });
}

/* ══ FINISH ══ */
export function finishBattle(forceQuit = false) {
  /* FIX : guard anti-double-appel */
  if (_battleFinished) return;

  /* ── ONLINE : l'invité ne décide plus seul ── */
  if (State.gameMode === 'online' && !State.isHost && !forceQuit && !_fromMatchResult) {
    _battleFinished = true;
    clearAll();
    showFeedback('⏳ Synchronisation du résultat…', 'draw');
    return;
  }
  _fromMatchResult = false; /* reset après usage */

  _battleFinished = true;

  clearAll();
  document.removeEventListener('visibilitychange', handleVisibility);
  const sorted = [...State.players].sort((a, b) => b.hp - a.hp);
  const winner = sorted[0];
  /* ── ONLINE : seul l’hôte envoie le résultat officiel ── */
if (State.gameMode === 'online' && State.isHost && !forceQuit) {
  const localP = State.players.find(p => !p.isAI && !p.isRemote);
  const opp    = State.players.find(p => p.isRemote);

  State.onlineAdapter?.broadcastMatchResult({
    localHp : localP ? localP.hp : 0,
    remoteHp: opp ? opp.hp : 0,
    winnerId: winner?.id || null,
    message : winner?.isRemote
      ? `${winner.name} gagne`
      : `${winner?.name || 'Joueur'} gagne`
  });
}
  const humanWon = !winner.isAI && !winner.isRemote && winner.hp > 0;
  let stars = 0;
  if (State.gameMode === 'story' && humanWon) {
    const p1 = State.players.find(p => !p.isAI);
    stars = 1; if (p1 && p1.hp > 50) stars = 2; if (p1 && p1.hp > 70) stars = 3;
    Save.saveBeatenLevel(State.currentStoryLevel, stars);
  }

  /* ── XP gain : victoire = XP_WIN, défaite = XP_LOSS, abandon = 0 ── */
  const xpKey = State.gameMode === 'story' ? 'story' : '1vm';
  const localP = State.players.find(p => !p.isAI && !p.isRemote);
  let xpGain = forceQuit ? 0 : (humanWon ? C.XP_WIN[xpKey] : C.XP_LOSS[xpKey]);
  if (humanWon && !forceQuit && localP && localP.hp > 70) xpGain += C.XP_PERFECT;
  animateXPGain(xpGain);

  /* ── ELO ── */
  if (State.gameMode !== 'story') {
    import('./leaderboard.js').then(({ updateElo }) => {
      if (State.gameMode === 'online') {
        if (localP) updateElo(localP.name, humanWon ? +25 : -8, humanWon);
        const elo = Save.getElo();
        if (localP) elo[localP.name] = Math.max(800, (elo[localP.name] || 1000) + (humanWon ? 25 : -8));
        Save.saveElo(elo);
      } else {
        if (winner && !winner.isAI) {
          updateElo(winner.name, +25, true);
          sorted.slice(1).filter(p => !p.isAI).forEach(p => updateElo(p.name, -12, false));
        } else if (winner && winner.isAI) {
          sorted.filter(p => !p.isAI).forEach(p => updateElo(p.name, -8, false));
        }
        const elo = Save.getElo();
        if (winner && !winner.isAI) {
          elo[winner.name] = (elo[winner.name] || 1000) + 25;
          sorted.slice(1).filter(p => !p.isAI).forEach(p => { elo[p.name] = Math.max(800, (elo[p.name] || 1000) - 12); });
        } else if (winner && winner.isAI) {
          sorted.filter(p => !p.isAI).forEach(p => { elo[p.name] = Math.max(800, (elo[p.name] || 1000) - 8); });
        }
        Save.saveElo(elo);
      }
    }).catch(() => {
      const elo = Save.getElo();
      if (State.gameMode === 'online') {
        if (localP) elo[localP.name] = Math.max(800, (elo[localP.name] || 1000) + (humanWon ? 25 : -8));
      } else {
        if (winner && !winner.isAI) elo[winner.name] = (elo[winner.name] || 1000) + 25;
        else if (winner && winner.isAI) sorted.filter(p => !p.isAI).forEach(p => { elo[p.name] = Math.max(800, (elo[p.name] || 1000) - 8); });
      }
      Save.saveElo(elo);
    });
  }

  /* ── Online : stopper la sync périodique + broadcast fin + nettoyage ── */
  if (State.gameMode === 'online') {
    clearPeriodicSync();
    setTimeout(() => State.onlineAdapter?.cleanup(), 3000);
  }

  showResults(forceQuit, humanWon, winner, stars, xpGain);
}

function showResults(forceQuit = false, humanWon = false, winner = null, stars = 0, xpGain = 0) {
  showScreen('screenResults');
  resumeMenuMusic();
  const sorted = [...State.players].sort((a, b) => b.hp - a.hp);
  const w = winner || sorted[0];
  const isOpponentWin = w.isAI || !!w.isRemote;

  document.getElementById('resEmoji').textContent = isOpponentWin ? (w.isRemote ? '⚔️' : '🤖') : humanWon ? '🏆' : '💀';
  document.getElementById('resTitle').textContent =
    isOpponentWin && State.gameMode === 'online' ? `${w.name} GAGNE` :
    isOpponentWin ? 'NEXUS GAGNE' :
    forceQuit ? 'ABANDON' :
    humanWon ? `${w.name} GAGNE` : 'ÉGALITÉ';

  const subMsgs = {
    win:       ['Bien joué, guerrier.', 'NEXUS est impressionnée.', 'Le calcul coule dans tes veines.'],
    winOnline: ['Ton adversaire n\'a pas résisté !', 'Calcul + vitesse = victoire.', 'Bravo champion !'],
    lose:      ['NEXUS est implacable…', 'Recalibration requise.', 'Reviens quand tu seras prêt.'],
    loseOnline:['Ton adversaire était plus rapide.', 'La prochaine fois sera la bonne !', 'Revanche ?'],
    quit:      ['Défaite enregistrée.', 'On ne fuit pas indéfiniment.']
  };
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const sub = State.gameMode === 'online'
    ? (humanWon ? pick(subMsgs.winOnline) : forceQuit ? pick(subMsgs.quit) : pick(subMsgs.loseOnline))
    : (isOpponentWin ? pick(subMsgs.lose) : forceQuit ? pick(subMsgs.quit) : pick(subMsgs.win));
  document.getElementById('resSub').textContent = sub;

  /* ── Gain XP affiché ── */
  const xpInfo = State.xpLevel;
  const xpBadgeColor = humanWon ? 'var(--gold)' : 'var(--muted)';
  const xpHtml = xpGain > 0 ? `
    <div class="res-xp-badge" style="color:${xpBadgeColor}">
      <span class="res-xp-icon">⚡</span>
      <span>+${xpGain} XP</span>
      <span class="res-xp-level">· Nv.${xpInfo.level} ${xpInfo.title}</span>
    </div>` : '';
  const xpBadgeEl = document.getElementById('resXpBadge');
  if (xpBadgeEl) xpBadgeEl.innerHTML = xpHtml;

  const starsEl = document.getElementById('starsReward');
  if (State.gameMode === 'story' && humanWon && stars > 0) {
    starsEl.innerHTML = '';
    for (let i = 1; i <= 3; i++) {
      const s = document.createElement('span');
      s.textContent = '⭐'; s.className = i <= stars ? 'star-earned' : 'star-empty';
      if (i <= stars) s.style.animationDelay = (i * 0.18) + 's';
      starsEl.appendChild(s);
    }
  } else starsEl.innerHTML = '';

  document.getElementById('resScore').textContent = State.battleScore > 0 ? `${State.battleScore.toLocaleString()} pts` : '';

  const rewardBox = document.getElementById('rewardBox');
  if (State.gameMode === 'story' && humanWon && State.currentStoryLevel === 20) {
    rewardBox.innerHTML = `<div class="reward-box"><div class="reward-title">🎖️ CHAMPION DE LOGICSHOT</div><div class="reward-text">Tu as vaincu NEXUS dans sa forme ultime.<br>Mon créateur serait fier. Moi aussi.<br><br>🏅 Titre débloqué : <strong>Maître du Calcul</strong><br>⭐ Bonus : +30 étoiles permanentes<br>🔓 Mode Défi Infini — bientôt disponible</div></div>`;
  } else rewardBox.innerHTML = '';

  const medals = ['🥇','🥈','💀'];
  document.getElementById('resRows').innerHTML = sorted.map((p, i) => {
    const hpColor = p.hp > 60 ? 'var(--green)' : p.hp > 30 ? 'var(--gold)' : 'var(--red)';
    return `<div class="res-row"><div class="res-rank">${medals[Math.min(i, 2)]}</div><div class="res-name">${p.sprite} ${p.name}</div><div class="res-hp" style="color:${hpColor}">❤️ ${Math.max(0, p.hp)}</div></div>`;
  }).join('');

  const btns = document.getElementById('resBtns');
  const playerName = State.players.find(p => !p.isAI && !p.isRemote)?.name || 'Joueur';
  const shareBtn = `<button class="res-btn outline" aria-label="Partager mon score" onclick="window._shareResult('${playerName}',${State.battleScore},${stars},${humanWon ? 1 : 0},${State.gameMode === 'story' ? State.currentStoryLevel : 0})">📤 Partager mon score</button>`;

  if (State.gameMode === 'story') {
    const showFinale = humanWon && State.currentStoryLevel === 20;
    btns.innerHTML = `
      ${showFinale ? `<button class="res-btn gold" onclick="window._showNarrative('finale',()=>window._openStoryMap())">📖 ÉPILOGUE</button>` : ''}
      <button class="res-btn ${showFinale ? 'outline' : 'gold'}" onclick="window._openStoryMap()">Carte des niveaux</button>
      <button class="res-btn outline" onclick="window._replayStoryLevel()">🔁 Rejouer niv. ${State.currentStoryLevel}</button>
      ${shareBtn}
      <button class="res-btn outline" onclick="window._goSplash()">🏠 Accueil</button>`;
  } else if (State.gameMode === 'online') {
    btns.innerHTML = `
      <button class="res-btn gold" onclick="window.startOnlineMode()">⚔️ Revanche</button>
      <button class="res-btn outline" onclick="window._showLeaderboard()">🏆 Classement</button>
      ${shareBtn}
      <button class="res-btn outline" onclick="window._goSplash()">🏠 Accueil</button>`;
  } else {
    btns.innerHTML = `
      <button class="res-btn gold" onclick="window._goSplash()">Retour au Menu</button>
      <button class="res-btn outline" onclick="window._showLeaderboard()">🏆 Classement</button>
      ${shareBtn}`;
  }

  if (!humanWon || forceQuit) sfx.lose();
  else { sfx.win(); if (State.gameMode === 'story') setTimeout(() => sfx.levelup(), 600); }
}

/* ══ CLEAR ══ */
export function clearAll() {
  clearInterval(State.timerInterval);
  clearTimeout(State.shieldExpireTimer);
  clearTimeout(State.aiShieldExpireTimer);
  clearPeriodicSync();
  State.isPaused = false; State.roundActive = false;
  State.playerShieldActive = false; State.aiShieldActive = false;
  document.getElementById('pauseOverlay')?.classList.add('hidden');
}

/* FIX double finishBattle : flag global réinitialisé à chaque nouvelle partie */
let _battleFinished = false;
/* FIX guest freeze : permet à receiveMatchResult de contourner le guard online */
let _fromMatchResult = false;

/* ══════════════════════════════════════
   ONLINE MODE — fonctions exportées
   appelées par online.js via import()
══════════════════════════════════════ */
export function receiveMatchResult(data) {
  if (State.gameMode !== 'online') return;
  if (State.isHost) return; // l'hôte n'a pas besoin de recevoir son propre verdict

  const localP = State.players.find(p => !p.isAI && !p.isRemote);
  const opp    = State.players.find(p => p.isRemote);

  /* Synchroniser les HP officiels envoyés par l'hôte */
  if (localP && typeof data.localHp === 'number') {
    localP.hp = data.localHp;
    updateHP(localP);
  }
  if (opp && typeof data.remoteHp === 'number') {
    opp.hp = data.remoteHp;
    updateHP(opp);
  }

  clearAll();
  showFeedback(data.message || 'Fin du combat', 'ok');

  /* Permettre à finishBattle de s'exécuter complètement pour l'invité
     (_battleFinished est déjà true depuis l'early-return, on le réinitialise) */
  _battleFinished = false;
  _fromMatchResult = true;
  setTimeout(() => finishBattle(false), 1200);
}
export function beginOnlineBattle(myName, opponentName, rounds) {
  _battleFinished = false; /* FIX : reset du guard pour cette nouvelle partie */
  _fromMatchResult = false;
  pauseMenuMusicForBattle();
  State.gameMode = 'online';
  State.unlockedSupers = { flash: true, glitch: true, shield: true };
  State.players = [
    makePlayer('p1', myName,       'p1c', '🥷', false),
    { ...makePlayer('p2', opponentName, 'aic', '⚔️', false), isRemote: true }
  ];
  State.allRounds = rounds;
  State.resetBattle();
  sfx.battleStart();
  showScreen('screenBattle');
  renderFighters();
  renderSupers();

  /* Cacher la pause + le bouton quit qui se transforme en abandon */
  const pauseBtn = document.querySelector('.pause-btn');
  if (pauseBtn) pauseBtn.style.display = 'none';

  /* Absent check actif en online */
  startAbsentCheck();

  /* Overlay PRÊT — chaque joueur confirme manuellement */
  _showReadyOverlay(myName, opponentName);
}

function _showReadyOverlay(myName, oppName) {
  const ov = document.createElement('div');
  ov.id = 'readyOverlay';
  ov.style.cssText = `position:fixed;inset:0;z-index:9100;display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:12px;padding:24px;box-sizing:border-box;
    background:rgba(0,0,0,0.85);backdrop-filter:blur(6px);`;
  ov.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px;width:100%;max-width:320px;">
      <div style="font-family:'Syne',sans-serif;font-size:clamp(18px,5vw,26px);font-weight:800;
        color:var(--cyan);text-shadow:0 0 16px rgba(0,180,255,.6);
        text-align:center;word-break:break-word;line-height:1.2;">🥷 ${myName}</div>
      <div style="font-family:'Syne',sans-serif;font-size:clamp(13px,3.5vw,16px);font-weight:700;
        color:var(--gold);letter-spacing:4px;opacity:0.8;padding:4px 0;">VS</div>
      <div style="font-family:'Syne',sans-serif;font-size:clamp(18px,5vw,26px);font-weight:800;
        color:#ff5555;text-shadow:0 0 16px rgba(255,80,80,.5);
        text-align:center;word-break:break-word;line-height:1.2;">⚔️ ${oppName}</div>
    </div>
    <div id="readyStatus" style="font-size:12px;color:var(--muted);letter-spacing:2px;
      text-align:center;max-width:280px;line-height:1.5;margin-top:4px;">
      En attente que les deux joueurs soient prêts…
    </div>
    <button id="readyBtn" style="
      margin-top:12px;padding:16px 36px;border-radius:16px;border:2px solid var(--gold-neon);
      background:var(--gold-neon);color:#1a1200;font-family:'Syne',sans-serif;
      font-size:clamp(16px,4.5vw,20px);font-weight:800;cursor:pointer;letter-spacing:1px;
      box-shadow:0 0 32px var(--gold-glow);transition:all .2s;width:min(280px,80vw);"
      onclick="window._onReadyClick()">
      ✋ JE SUIS PRÊT
    </button>`;
  document.body.appendChild(ov);

  window._onReadyClick = function() {
    const btn = document.getElementById('readyBtn');
    if (btn) { btn.disabled = true; btn.textContent = '✅ Prêt !'; btn.style.opacity = '0.6'; }
    document.getElementById('readyStatus').textContent = 'En attente de l\'adversaire…';
    State.onlineAdapter?.broadcastReady();
  };
}

/* ══════════════════════════════════════
   ONLINE SYNC — Countdown synchronisé
   Le principe de synchronisation :
   - L'hôte envoie nextAt = Date.now() + 3000
   - Le message met ~latency ms à arriver chez l'invité
   - L'invité fait son propre Date.now() + 3000 mais son horloge est
     déjà "en avance" de ~latency ms → son countdown est naturellement
     plus court de ~latency ms → les deux timers de jeu démarrent en même temps
   - On affiche "SYNC…" pendant la phase de transit réseau pour que
     l'utilisateur ne voie pas d'écran vide
   mode='overlay' : plein écran (round 1)
   mode='formula' : zone formule (rounds 2-10)
══════════════════════════════════════ */
function _ensureCdStyle() {
  if (document.getElementById('cdStyle')) return;
  const s = document.createElement('style');
  s.id = 'cdStyle';
  s.textContent = `@keyframes cdPop{0%{transform:scale(.4);opacity:0}100%{transform:scale(1);opacity:1}}
  @keyframes syncPulse{0%,100%{opacity:.4}50%{opacity:1}}`;
  document.head.appendChild(s);
}

function _onlineCountdownThenLoad(startAt, mode) {
  _ensureCdStyle();
  let lastSec = -1;
  /* Afficher immédiatement SYNC si on est encore dans la phase de transit */
  const now = Date.now();
  const msUntilStart = startAt - now;

  /* Affichage initial SYNC pendant le transit réseau */
  if (msUntilStart > 0) {
    if (mode === 'overlay') {
      const ov = document.getElementById('readyOverlay');
      if (ov) ov.innerHTML =
        `<div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:700;
          color:var(--cyan);letter-spacing:4px;
          animation:syncPulse 0.6s ease-in-out infinite;">SYNC…</div>`;
    } else {
      const fd = document.getElementById('formulaDisplay');
      const fl = document.getElementById('formulaLabel');
      if (fl) fl.textContent = 'SYNCHRONISATION…';
      if (fd) {
        fd.className = 'formula-big';
        fd.style.cssText = `font-size:18px;color:var(--cyan);letter-spacing:4px;
          animation:syncPulse 0.6s ease-in-out infinite;`;
        fd.textContent = 'SYNC…';
      }
    }
  }

  const tick = () => {
    const now  = Date.now();
    const ms   = startAt - now;
    const secs = Math.min(3, Math.max(0, Math.ceil(ms / 1000))); /* max 3s */

    if (secs !== lastSec) {
      lastSec = secs;
      if (ms > 0) {
        if (mode === 'overlay') {
          const ov = document.getElementById('readyOverlay');
          if (ov) ov.innerHTML =
            `<div style="font-family:'Syne',sans-serif;font-size:clamp(80px,24vw,150px);
              font-weight:800;color:#ffd700;
              text-shadow:0 0 50px rgba(255,215,0,.9),0 0 100px rgba(255,215,0,.4);
              animation:cdPop .3s cubic-bezier(.22,1,.36,1);">${secs}</div>
             <div style="font-size:14px;color:rgba(255,255,255,.5);letter-spacing:4px;margin-top:8px;">PRÉPARE-TOI</div>`;
        } else {
          const fd = document.getElementById('formulaDisplay');
          const fl = document.getElementById('formulaLabel');
          if (fl) fl.textContent = 'ROUND SUIVANT';
          if (fd) {
            fd.className = 'formula-big';
            fd.style.cssText = `font-size:clamp(72px,22vw,120px);color:var(--gold-neon);
              text-shadow:0 0 30px var(--gold-glow);animation:cdPop .3s cubic-bezier(.22,1,.36,1);`;
            fd.textContent = secs;
          }
          const fa = document.getElementById('formulaAnswer');
          if (fa) { fa.textContent = ''; fa.style.display = 'none'; }
        }
      }
    }

    if (now < startAt) {
      requestAnimationFrame(tick);
    } else {
      if (mode === 'overlay') document.getElementById('readyOverlay')?.remove();
      const fd = document.getElementById('formulaDisplay');
      if (fd) fd.style.cssText = ''; /* reset inline styles avant loadRound */
      /* Protège startAt : s'il est dans le passé (mobile lent / réseau dégradé),
         on le cale à now pour que le timer parte de roundTime et non de 0 */
      State._onlineRoundStartAt = Math.max(startAt, Date.now());
      loadRound();
    }
  };
  requestAnimationFrame(tick);
}

/* Premier round : overlay plein écran */
export function receiveStartAt(startAt) {
  const ov = document.getElementById('readyOverlay');
  if (ov) {
    const status = document.getElementById('readyStatus');
    if (status) status.innerHTML = '<span style="color:var(--green);font-weight:700;">✅ Prêts ! Lancement…</span>';
    document.getElementById('readyBtn')?.remove();
  }
  _onlineCountdownThenLoad(startAt, 'overlay');
}

/* Rounds 2-10 : chaque joueur envoie un ACK, l'hôte attend les 2 puis lance le countdown */
function _onlineNextRound() {
  if (State.gameMode !== 'online') { loadRound(); return; }
  /* FIX index ACK : à ce stade, State.roundIndex est déjà le NOUVEAU index
     (incrémenté dans resolveCorrectAnswer ou advanceRound avant cet appel).
     On envoie ce nouvel index pour que l'hôte et l'invité se synchronisent
     sur le bon round à charger. */
  const ackIndex = State.roundIndex;
  State.onlineAdapter?.broadcastRoundAck(ackIndex);
  if (State.isHost) {
    /* L'hôte s'enregistre lui-même ET attend l'ACK de l'invité via online.js/_onRoundAck */
    /* fireNextRoundFromHost sera appelé par online.js quand les 2 ACKs sont reçus */
    /* Fallback si l'invité ne répond pas dans 4s */
    clearTimeout(State._ackFallback);
    State._ackFiredForRound = ackIndex; /* FIX #1 : guard partagé anti-double-tir */
    State._ackFallback = setTimeout(() => {
      if (State.gameMode === 'online' && State.roundActive === false
          && State._ackFiredForRound === ackIndex) {
        State._ackFiredForRound = -1;
        fireNextRoundFromHost(ackIndex);
      }
    }, 4000);
  }
  /* L'invité attend next_round — fallback local après 8s (FIX : augmenté de 6→8s
     pour laisser le temps à l'hôte de faire le syncClock + envoyer next_round) */
  if (!State.isHost) {
    State._waitingNextRound = ackIndex;
    setTimeout(() => {
      if (State._waitingNextRound === ackIndex) {
        State._waitingNextRound = -1;
        _onlineCountdownThenLoad(Date.now() + 3000, 'formula');
      }
    }, 8000);
  }
}

/* Appelé par online.js quand les 2 ACKs sont collectés */
export function fireNextRoundFromHost(roundIndex) {
  clearTimeout(State._ackFallback);
  State._ackFiredForRound = -1; /* FIX #1 : neutralise le fallback battle.js immédiatement */
  if (roundIndex !== State.roundIndex) return;
  /* FIX clock sync : on force toujours un syncClock() avant d'envoyer nextAt.
     Si le réseau est dégradé, le timeout d'1s dans _syncClock retourne 0
     et on utilise _estimatedLatency comme fallback — ce qui est toujours
     meilleur que d'ignorer complètement le décalage d'horloge. */
  const adapter = State.onlineAdapter;
  const syncClock = adapter?._syncClock;
  const doFire = () => {
    if (roundIndex !== State.roundIndex) return; /* guard si round changé pendant sync */
    const rtt = (adapter?._getLatency?.() || 100) * 2;
    /* nextAt = maintenant + 3s + rtt/2 :
       - l'hôte attend rtt/2 ms supplémentaires
       - le message met rtt/2 ms à arriver chez l'invité
       → les deux comptent à rebours depuis le même instant absolu */
    const nextAt = Date.now() + 3000 + Math.min(rtt / 2, 500);
    adapter?.broadcastNextRound(State.roundIndex, nextAt);
    _onlineCountdownThenLoad(nextAt, 'formula');
  };
  if (syncClock) {
    syncClock().then(doFire).catch(() => doFire());
  } else {
    doFire();
  }
}

export function receiveNextRound(roundIndex, nextAt) {
  /* FIX #2 : accepter roundIndex - 1 si l'invité a déjà avancé localement
     (ex. via timeout ou resolveCorrect) — évite le blocage 8s sur SYNC */
  const isCurrent  = roundIndex === State.roundIndex;
  const isPrevious = roundIndex === State.roundIndex - 1;
  if (!isCurrent && !isPrevious) return;
  State._waitingNextRound = -1;
  _onlineCountdownThenLoad(nextAt, 'formula');
}

export function receiveOpponentAnswer(val, correct, roundIndex) {
  /* FIX #5 : accepter roundIndex - 1 (message arrivé après avancement local)
     → mise à jour silencieuse des HP pour éviter la désynchronisation d'affichage */
  const isCurrent  = roundIndex === State.roundIndex;
  const isPrevious = roundIndex === State.roundIndex - 1;
  if (!isCurrent && !isPrevious) return;

  if (isPrevious) {
    /* Round déjà passé : mettre à jour les HP sans effets UI */
    if (correct) {
      const opp = State.players.find(p => p.isRemote);
      if (opp && !opp.answered) {
        const prevRound = State.allRounds[roundIndex];
        const target = State.players.find(p => p.id !== opp.id && !p.hasQuit);
        if (target && prevRound) {
          const dmg = C.DAMAGE[prevRound.difficulty] || 10;
          target.hp = Math.max(0, target.hp - dmg);
          updateHP(target);
        }
      }
    }
    return;
  }

  if (!State.roundActive) return;
  const opp = State.players.find(p => p.isRemote);
  if (!opp || opp.answered) return;

  const round = State.allRounds[State.roundIndex];
  opp.answerVal = val;

  if (correct) {
    opp.answered = true;
    sfx.gunshot();
    resolveCorrectAnswer(opp, round);
  } else {
    opp.hp = Math.max(0, opp.hp - C.SELF_DAMAGE);
    updateHP(opp);
    sfx.wrong();
    animFighter(opp.id, 'hurt');
    showHpLossFX(opp.id, `−${C.SELF_DAMAGE}`, 'var(--red)');
    showFeedback(`${opp.name} se trompe — −${C.SELF_DAMAGE} HP`, 'draw');
    if (opp.hp <= 0) {
      State.roundActive = false;
      clearInterval(State.timerInterval);
      freezeTimerUI();
      showFeedback(`💀 ${opp.name} a épuisé ses HP !`, 'ok');
      setTimeout(() => finishBattle(), 5000);
    }
  }
}

export function receiveDisconnect(oppName) {
  /* Ignorer si on n'est pas en mode online — évite les faux positifs en mode histoire/machine */
  if (State.gameMode !== 'online') return;
  if (!State.roundActive && document.getElementById('screenBattle')?.classList.contains('hidden')) return;
  clearAll();
  const opp = State.players.find(p => p.isRemote);
  if (opp) opp.hp = 0;
  showFeedback(`📡 ${oppName || 'Adversaire'} s'est déconnecté — victoire par forfait !`, 'ok');
  setTimeout(() => finishBattle(false), 3000);
}

/* Super reçu de l'adversaire distant — appliquer l'effet localement */
export function receiveOpponentSuper(type) {
  if (!State.roundActive) return;
  const fd = document.getElementById('formulaDisplay');
  const opp = State.players.find(p => p.isRemote);

  /* ── Mettre à jour le compteur de supers de l'adversaire (mini-logos) ── */
  if (opp) {
    if (type === 'shield') opp.superUsed.shield = Math.min(1, (opp.superUsed.shield || 0) + 1);
    else opp.superUsed[type] = Math.min(2, (opp.superUsed[type] || 0) + 1);
    updateAllSuperDots();
  }

  sfx.superpow();
  if (type === 'flash') {
    /* Flash adverse → décale la FIN du timer de −10s (effet réel sur le vrai timer) */
    applyFlashPenaltyOnTimer();
    if (fd) { fd.classList.add('flash'); setTimeout(() => fd.classList.remove('flash'), 700); }
    showImpactFX('⚡', 'var(--red)');
    showFeedback(`<span style="color:var(--red);font-weight:800;">⚡ ${opp?.name || 'Adversaire'} active Flash — −10s sur ton timer !</span>`, 'fail');
  } else if (type === 'glitch') {
    /* Glitch adverse → notre formule est distordue */
    if (fd) { fd.classList.add('glitch'); setTimeout(() => fd.classList.remove('glitch'), 10000); }
    showImpactFX('👾', 'var(--purple)');
    showFeedback(`<span style="color:var(--red);font-weight:800;">👾 ${opp?.name || 'Adversaire'} active Glitch — formule altérée !</span>`, 'fail');
  } else if (type === 'shield') {
    /* Shield adverse → l'adversaire est protégé (= aiShieldActive pour nous) */
    State.aiShieldActive = true;
    sfx.shield();
    const oppFighter = document.getElementById(`fighter_p2`);
    if (oppFighter) oppFighter.classList.add('shielded');
    showImpactFX('🛡️', 'var(--blue-neon)');
    showFeedback(`🛡️ ${opp?.name || 'Adversaire'} active son Bouclier !`, 'draw');
    clearTimeout(State.aiShieldExpireTimer);
    State.aiShieldExpireTimer = setTimeout(() => { State.aiShieldActive = false; oppFighter?.classList.remove('shielded'); }, 10000);
  }
}

/* L'adversaire a abandonné → terminer la partie localement */
export function receiveOpponentQuit(oppName) {
  clearAll();
  clearPeriodicSync();
  document.getElementById('readyOverlay')?.remove();
  const opp = State.players.find(p => p.isRemote);
  if (opp) opp.hp = 0;
  /* Afficher le feedback même si aucun round n'est actif */
  showFeedback(`🏳️ ${oppName || 'Adversaire'} a abandonné — victoire par forfait !`, 'ok');
  setTimeout(() => finishBattle(false), 2500);
}

/* L'adversaire est allé en arrière-plan → sync ses HP localement */
export function receiveOpponentAbsent(newHp) {
  const opp = State.players.find(p => p.isRemote);
  if (!opp) return;
  opp.hp = Math.max(0, newHp);
  updateHP(opp);
  showImpactFX(`👁️ −${C.ABSENT_PENALTY} HP`, 'var(--gold)');
  showFeedback(`👁️ ${opp.name} est allé en arrière-plan — −${C.ABSENT_PENALTY} HP !`, 'ok');
  sfx.wrong();
  if (opp.hp <= 0) {
    State.roundActive = false; clearInterval(State.timerInterval);
    showFeedback(`💀 ${opp.name} a mis le jeu en arrière-plan · KO !`, 'ok');
    setTimeout(() => finishBattle(false), 5000);
  }
}

/* Sync périodique du timer (hôte → invité, toutes les 3s) */
let _syncInterval = null;
function _startPeriodicSync(round, roundTime) {
  clearInterval(_syncInterval);
  _syncInterval = setInterval(() => {
    if (!State.roundActive || State.gameMode !== 'online') { clearInterval(_syncInterval); return; }
    State.onlineAdapter?._sendTimerSync(State.timeLeft, State.roundIndex);
  }, 3000);
}
export function clearPeriodicSync() { clearInterval(_syncInterval); _syncInterval = null; }

/* Correction de dérive reçue (invité) */
export function receiveTimerSync(timeLeft, roundIndex) {
  /* Avec les timestamps absolus partagés, la dérive est quasi nulle.
     Correctif uniquement pour les cas de réseau très dégradé (>3s). */
  if (roundIndex !== State.roundIndex || !State.roundActive) return;
  const drift = Math.abs(State.timeLeft - timeLeft);
  if (drift > 3) { State.timeLeft = timeLeft; } /* hard-sync uniquement si dérive sévère */
}
