/* ══════════════════════════════════════
   ui.js — Rendu, FX, XP, Partage
══════════════════════════════════════ */
import { State, C, Save } from './state.js';
import { sfx } from './audio.js';

/* ══ NAVIGATION ══ */
const ALL_SCREENS = [
  'screenSplash','screenMatchmaking','screenDiffSelect','screenStory',
  'screenNarrative','screenOath','screenBattle','screenResults','screenTutorial',
  'screenOnlineMenu','screenOnlineLobby'
];
export function showScreen(id) {
  ALL_SCREENS.forEach(s => document.getElementById(s)?.classList.add('hidden'));
  document.getElementById(id)?.classList.remove('hidden');
}

/* ══ THÈME ══ */
export function toggleTheme() {
  State.isDark = !State.isDark;
  document.documentElement.setAttribute('data-theme', State.isDark ? 'dark' : 'light');
  const btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = State.isDark ? '☀️ Mode clair' : '🌙 Mode sombre';
  localStorage.setItem('ls_theme', State.isDark ? 'dark' : 'light');
}

export function initTheme() {
  const t = localStorage.getItem('ls_theme');
  if (t === 'dark') {
    State.isDark = true;
    document.documentElement.setAttribute('data-theme', 'dark');
    const btn = document.getElementById('themeBtn');
    if (btn) btn.textContent = '☀️ Mode clair';
  }
}

/* ══ XP BAR ══ */
export function renderXPBar() {
  const bar = document.getElementById('xpBarFill');
  const lvlEl = document.getElementById('xpLevelLabel');
  const xpEl = document.getElementById('xpValueLabel');
  if (!bar) return;
  const info = State.xpLevel;
  const xp = State.xp;
  const prevThreshold = getPrevThreshold(info.level);
  const pct = info.next === Infinity ? 100 : Math.min(100, ((xp - prevThreshold) / (info.next - prevThreshold)) * 100);
  bar.style.width = pct + '%';
  if (lvlEl) lvlEl.textContent = `Nv.${info.level} · ${info.title}`;
  if (xpEl)  xpEl.textContent = info.next === Infinity ? `${xp} XP · MAX` : `${xp}/${info.next} XP`;
}

function getPrevThreshold(level) {
  const thresholds = [0, 0, 500, 1200, 2500, 4500, 7000, 10000];
  return thresholds[level] || 0;
}

export function animateXPGain(amount) {
  if (amount <= 0) return;
  const prev = State.xp;
  State.xp = prev + amount;
  // Vérifier level up
  const prevInfo = getXPLevelFor(prev);
  const newInfo = getXPLevelFor(State.xp);
  renderXPBar();
  if (newInfo.level > prevInfo.level) {
    showLevelUpFX(newInfo);
    sfx.xpUp();
  }
  // Afficher le gain
  const pop = document.getElementById('xpGainPop');
  if (pop) {
    pop.textContent = `+${amount} XP`;
    pop.classList.remove('hidden');
    pop.classList.add('xp-pop-anim');
    setTimeout(() => { pop.classList.add('hidden'); pop.classList.remove('xp-pop-anim'); }, 1800);
  }
}

function getXPLevelFor(xp) {
  if (xp < 500)   return { level: 1, title: 'Recrue' };
  if (xp < 1200)  return { level: 2, title: 'Apprenti' };
  if (xp < 2500)  return { level: 3, title: 'Combattant' };
  if (xp < 4500)  return { level: 4, title: 'Vétéran' };
  if (xp < 7000)  return { level: 5, title: 'Élite' };
  if (xp < 10000) return { level: 6, title: 'Champion' };
  return           { level: 7, title: 'Maître du Calcul' };
}

function showLevelUpFX(info) {
  const el = document.createElement('div');
  el.className = 'levelup-overlay';
  el.innerHTML = `
    <div class="levelup-title">🎖️ NIVEAU ${info.level} !</div>
    <div class="levelup-sub">${info.title || ''}</div>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

/* ══ FIGHTERS ══ */
export function renderFighters() {
  const row = document.getElementById('fightersRow');
  if (State.players.length < 2) return;
  const p0 = State.players[0], p1 = State.players[1];
  row.innerHTML = `
    <div class="fighter p1" id="fighter_${p0.id}" role="status" aria-label="${p0.name} — ${p0.hp} HP">
      <div class="fighter-header">
        <span class="fighter-sprite-ico" id="sprite_${p0.id}" aria-hidden="true">${p0.sprite}</span>
        <div style="min-width:0;flex:1">
          <div class="fighter-name p1c">${p0.name}</div>
          <div class="hp-bar-bg" role="progressbar" aria-valuenow="${p0.hp}" aria-valuemin="0" aria-valuemax="100" aria-label="HP ${p0.name}">
            <div class="hp-bar p1b" id="hpb_${p0.id}" style="width:100%"></div>
          </div>
          <div class="hp-val" id="hpv_${p0.id}">❤️ 100</div>
        </div>
      </div>
      <div class="super-indicators" id="sdots_${p0.id}"></div>
    </div>
    <div class="vs-badge" aria-hidden="true">VS</div>
    <div class="fighter ai right-side" id="fighter_${p1.id}" role="status" aria-label="NEXUS — ${p1.hp} HP">
      <div class="fighter-header">
        <div style="min-width:0;flex:1;text-align:right">
          <div class="fighter-name aic">${p1.name}</div>
          <div class="hp-bar-bg" role="progressbar" aria-valuenow="${p1.hp}" aria-valuemin="0" aria-valuemax="100" aria-label="HP NEXUS">
            <div class="hp-bar aib" id="hpb_${p1.id}" style="width:100%"></div>
          </div>
          <div class="hp-val" id="hpv_${p1.id}">❤️ 100</div>
        </div>
        <span class="fighter-sprite-ico" id="sprite_${p1.id}" aria-hidden="true">${p1.sprite}</span>
      </div>
      <div class="super-indicators" style="justify-content:flex-end" id="sdots_${p1.id}"></div>
    </div>`;
  updateAllSuperDots();
}

export function updateHP(p) {
  const pct = Math.max(0, p.hp / C.MAX_HP * 100);
  const bar = document.getElementById(`hpb_${p.id}`);
  const val = document.getElementById(`hpv_${p.id}`);
  const fighter = document.getElementById(`fighter_${p.id}`);
  if (bar) {
    bar.style.width = pct + '%';
    pct <= 30 ? bar.classList.add('low') : bar.classList.remove('low');
  }
  if (val) val.textContent = `❤️ ${Math.max(0, p.hp)}`;
  if (fighter) {
    fighter.setAttribute('aria-label', `${p.name} — ${Math.max(0, p.hp)} HP`);
    const progressBar = fighter.querySelector('.hp-bar-bg');
    if (progressBar) progressBar.setAttribute('aria-valuenow', Math.max(0, p.hp));
  }
}

export function updateAllSuperDots() {
  State.players.forEach(p => {
    const zone = document.getElementById(`sdots_${p.id}`);
    if (!zone) return;
    const fl = 2 - p.superUsed.flash;
    const gl = 2 - p.superUsed.glitch;
    const sh = 1 - p.superUsed.shield;
    let html = '';
    if (State.unlockedSupers.flash)
      html += [fl > 1, fl > 0].map(a => `<div class="sp-dot ${a ? 'active' : 'used'}" title="Flash" aria-label="Flash ${a ? 'disponible' : 'utilisé'}">⚡</div>`).join('');
    if (State.unlockedSupers.glitch)
      html += [gl > 1, gl > 0].map(a => `<div class="sp-dot ${a ? 'active' : 'used'}" title="Glitch" aria-label="Glitch ${a ? 'disponible' : 'utilisé'}">👾</div>`).join('');
    if (State.unlockedSupers.shield)
      html += [sh > 0].map(a => `<div class="sp-dot ${a ? 'active' : 'used'}" style="border-color:var(--blue-neon)" title="Bouclier" aria-label="Bouclier ${a ? 'disponible' : 'utilisé'}">🛡️</div>`).join('');
    zone.innerHTML = html;
  });
}

export function animFighter(id, cls) {
  const el = document.getElementById(`fighter_${id}`);
  if (!el) return;
  el.classList.remove('hurt', 'attack');
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 500);
}

export function setAbsentBadge(id, show) {
  const el = document.getElementById(`fighter_${id}`);
  if (!el) return;
  const e = el.querySelector('.absent-badge');
  if (show && !e) {
    const b = document.createElement('div');
    b.className = 'absent-badge';
    b.textContent = 'ABSENT';
    el.appendChild(b);
  } else if (!show && e) e.remove();
}

/* ══ SCORE BAR ══ */
export function renderScoreBar() {
  document.getElementById('scoreDisplay').textContent = `🏆 ${State.battleScore.toLocaleString()}`;
  document.getElementById('streakDisplay').textContent = State.playerStreak >= 2 ? `🔥 ×${State.playerStreak}` : '';
  document.getElementById('comboDisplay').textContent = State.playerCombo >= 3 ? `⚡ COMBO ×${State.playerCombo}` : '';
}

/* ══ FEEDBACK ══ */
export function showFeedback(html, type) {
  const fb = document.getElementById('feedbackBar');
  if (!fb) return;
  fb.innerHTML = html;
  fb.className = `feedback-bar show ${type}`;
  requestAnimationFrame(() => requestAnimationFrame(() => fb.classList.add('visible')));
}
export function hideFeedback() {
  const fb = document.getElementById('feedbackBar');
  if (!fb) return;
  fb.classList.remove('visible');
  setTimeout(() => {
    if (!fb.classList.contains('visible')) { fb.textContent = ''; fb.className = 'feedback-bar'; }
  }, 360);
}

/* ══ TIMER UI ══ */
export function updateTimerUI(cur, max) {
  const pct = Math.max(0, cur / max * 100);
  const bar = document.getElementById('timerBar');
  const num = document.getElementById('timerNum');
  if (bar) {
    bar.style.width = pct + '%';
    cur <= 5 ? bar.classList.add('urgent') : bar.classList.remove('urgent');
  }
  if (num) {
    num.textContent = Math.ceil(Math.max(0, cur));
    num.className = `timer-num${cur <= 5 ? ' urgent' : ''}`;
  }
}
export function freezeTimerUI() {
  document.getElementById('timerBar')?.classList.add('timer-frozen');
  document.getElementById('timerNum')?.classList.add('timer-frozen');
}
export function unfreezeTimerUI() {
  document.getElementById('timerBar')?.classList.remove('timer-frozen');
  document.getElementById('timerNum')?.classList.remove('timer-frozen');
}

/* ══ TRANSITION ROUND ══ */
export function triggerRoundTransition(cb) {
  unfreezeTimerUI();
  const fzone = document.querySelector('.formula-zone');
  if (!fzone) { cb(); return; }
  fzone.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
  fzone.style.opacity = '0';
  fzone.style.transform = 'translateY(10px)';
  setTimeout(() => {
    const fa = document.getElementById('formulaAnswer');
    if (fa) { fa.textContent = ''; fa.style.display = 'none'; fa.className = 'formula-answer'; }
    fzone.style.transition = 'none';
    fzone.style.transform = 'translateY(-14px)';
    cb();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fzone.style.transition = 'opacity 0.32s cubic-bezier(0.22,1,0.36,1), transform 0.32s cubic-bezier(0.22,1,0.36,1)';
        fzone.style.opacity = '1';
        fzone.style.transform = 'translateY(0)';
        setTimeout(() => { fzone.style.transition = ''; fzone.style.opacity = ''; fzone.style.transform = ''; }, 360);
      });
    });
  }, 230);
}

/* ══ FX VISUELS ══ */
export function showCriticalFX(isPlayerCrit) {
  const label = document.createElement('div');
  label.className = isPlayerCrit ? 'crit-overlay crit-player' : 'crit-overlay crit-ai';
  label.textContent = '💥 CRITIQUE !';
  document.body.appendChild(label);
  label.addEventListener('animationend', () => label.remove());

  const flash = document.createElement('div');
  flash.className = isPlayerCrit ? 'crit-screen-flash crit-screen-player' : 'crit-screen-flash crit-screen-ai';
  document.body.appendChild(flash);
  flash.addEventListener('animationend', () => flash.remove());

  const arena = document.getElementById('arenaWrap');
  if (arena) { arena.classList.remove('screen-shake'); void arena.offsetWidth; arena.classList.add('screen-shake'); setTimeout(() => arena.classList.remove('screen-shake'), 520); }

  const victimId = isPlayerCrit ? 'ai' : 'p1';
  const victimEl = document.getElementById(`fighter_${victimId}`);
  if (victimEl) {
    victimEl.classList.remove('fighter-crit-hit'); void victimEl.offsetWidth;
    victimEl.classList.add('fighter-crit-hit');
    setTimeout(() => victimEl.classList.remove('fighter-crit-hit'), 420);
  }
}

export function triggerSlowMo() {
  const arena = document.getElementById('arenaWrap');
  const fz = document.querySelector('.formula-zone');
  const tz = document.querySelector('.timer-zone');
  if (arena) { arena.classList.remove('slowmo'); void arena.offsetWidth; arena.classList.add('slowmo'); setTimeout(() => arena.classList.remove('slowmo'), 500); }
  if (fz)    { fz.classList.remove('slowmo-hit'); void fz.offsetWidth; fz.classList.add('slowmo-hit'); setTimeout(() => fz.classList.remove('slowmo-hit'), 500); }
  if (tz)    { tz.classList.add('slowmo-freeze'); setTimeout(() => tz.classList.remove('slowmo-freeze'), 500); }
}

export function showImpactFX(text, color, originEl) {
  const el = document.createElement('div');
  el.className = 'impact-fx'; el.textContent = text; el.style.color = color;
  el.style.setProperty('--sc', color);
  if (originEl) {
    const r = originEl.getBoundingClientRect();
    el.style.setProperty('--sx', (r.left + r.width / 2 - window.innerWidth / 2) + 'px');
    el.style.setProperty('--sy', (r.top + r.height / 2 - window.innerHeight / 2) + 'px');
  } else {
    el.style.setProperty('--sx', '0px');
    el.style.setProperty('--sy', (-window.innerHeight * 0.3) + 'px');
  }
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

export function showAttackTravelFX(attackerId, targetId, symbol) {
  const att = document.getElementById(`fighter_${attackerId}`);
  const tgt = document.getElementById(`fighter_${targetId}`);
  if (!att || !tgt) return;
  const a = att.getBoundingClientRect(), t = tgt.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'attack-travel-fx'; el.textContent = symbol;
  el.style.left = a.left + a.width / 2 + 'px';
  el.style.top = a.top + a.height / 2 + 'px';
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.left = t.left + t.width / 2 + 'px'; el.style.top = t.top + t.height / 2 + 'px'; });
  el.addEventListener('transitionend', () => el.remove());
  setTimeout(() => el.remove(), 800);
}

export function showHpLossFX(targetId, text, color = 'var(--red)') {
  const target = document.getElementById(`fighter_${targetId}`);
  if (!target) return;
  const r = target.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'hp-loss-fx'; el.textContent = text;
  const rawTop = r.top + r.height * 0.3;
  const safeTop = Math.max(60, Math.min(rawTop, window.innerHeight - 80));
  el.style.left = r.left + r.width / 2 + 'px';
  el.style.top = safeTop + 'px';
  el.style.color = color;
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

export function showScorePop(pts, targetId) {
  const target = document.getElementById(`fighter_${targetId}`);
  let x = window.innerWidth / 2, y = window.innerHeight / 2;
  if (target) { const r = target.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
  const el = document.createElement('div');
  el.className = 'score-pop'; el.textContent = `+${pts}`;
  el.style.left = x + 'px'; el.style.top = y + 'px';
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

export function fireBang(attackerId, targetId, diff) {
  const symbol = diff === 'easy' ? '💥' : diff === 'medium' ? '🔥' : '💣';
  showAttackTravelFX(attackerId, targetId, symbol);
  if (diff === 'easy') sfx.gunshot();
  else if (diff === 'medium') sfx.burst();
  else sfx.explosion();
}

/* ══ MODALS ══ */
export function openModal() { document.getElementById('modalOverlay').classList.remove('hidden'); }
export function closeModal(e) {
  if (!e || e.target === document.getElementById('modalOverlay'))
    document.getElementById('modalOverlay').classList.add('hidden');
}

export function showShop() {
  document.getElementById('modalTitle').textContent = '🛒 Boutique';
  document.getElementById('modalContent').innerHTML = `
    <div style="font-size:10px;color:var(--muted);text-align:center;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Skins de personnage</div>
    <div class="shop-grid">
      <div class="shop-item"><div class="shop-item-icon">🔫</div><div class="shop-item-name">Skin Désert Eagle</div><div class="shop-item-price">1,99 €</div></div>
      <div class="shop-item"><div class="shop-item-icon">💣</div><div class="shop-item-name">Skin Bazooka Or</div><div class="shop-item-price">2,99 €</div></div>
      <div class="shop-item"><div class="shop-item-icon">🤖</div><div class="shop-item-name">Skin Robot Ninja</div><div class="shop-item-price">1,99 €</div></div>
      <div class="shop-item shop-item-featured"><div class="shop-item-icon">💀</div><div class="shop-item-name">Skin Fatality</div><div class="shop-item-badge">EXCLUSIF</div><div class="shop-item-price">0,99 €</div></div>
    </div>
    <p style="text-align:center;font-size:12px;color:var(--muted);margin-top:10px;">Bientôt disponibles</p>`;
  openModal();
}

export async function showLeaderboard() {
  document.getElementById('modalTitle').textContent = '🏆 Classement ELO';
  document.getElementById('modalContent').innerHTML = `
    <div style="text-align:center;padding:20px;color:var(--muted);">
      <div style="font-size:24px;animation:robotBreathe 1.5s infinite">⏳</div>
      <div style="font-size:12px;margin-top:8px;">Chargement…</div>
    </div>`;
  openModal();

  try {
    const { fetchLeaderboard, isOnlineLeaderboard } = await import('./leaderboard.js');
    const entries = await fetchLeaderboard();
    const medals = ['🥇','🥈','🥉'];
    const onlineBadge = isOnlineLeaderboard()
      ? `<div style="text-align:center;font-size:10px;color:var(--green);margin-bottom:10px;font-weight:700;">🌐 Classement en ligne</div>`
      : `<div style="text-align:center;font-size:10px;color:var(--muted);margin-bottom:10px;font-weight:700;">📱 Classement local</div>`;
    const rows = entries.length === 0
      ? `<p style="text-align:center;color:var(--muted);padding:20px;">Aucune partie encore.</p>`
      : entries.map((e, i) =>
          `<div class="lb-row">
            <div class="lb-rank">${medals[i] || `#${i + 1}`}</div>
            <div class="lb-name">${e.name}</div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">
              <div class="elo-badge">ELO ${e.elo}</div>
              ${e.wins > 0 ? `<div style="font-size:9px;color:var(--gold);font-weight:600;">${e.wins} victoires</div>` : ''}
            </div>
          </div>`
        ).join('');
    document.getElementById('modalContent').innerHTML = onlineBadge + rows + `
      <button onclick="if(confirm('Effacer le classement local ?')){localStorage.removeItem('ls_elo');closeModalUI();}"
        style="margin-top:12px;width:100%;padding:8px;background:transparent;border:1px solid rgba(229,48,48,0.3);border-radius:8px;font-size:11px;color:var(--red);cursor:pointer;font-family:'Space Grotesk',sans-serif;font-weight:600;">
        🗑 Effacer le classement local
      </button>`;
  } catch(e) {
    document.getElementById('modalContent').innerHTML = `<p style="text-align:center;color:var(--muted);padding:20px;">Impossible de charger le classement.</p>`;
  }
}

export function showDonation() {
  document.getElementById('modalTitle').textContent = '❤️ Soutenir';
  document.getElementById('modalContent').innerHTML = `
    <p style="text-align:center;color:var(--muted);margin-bottom:14px;">Ce jeu aide à la mémoire. Merci 🙏</p>
    <div class="donation-grid">
      <button class="don-btn" aria-label="Soutenir avec 1 euro">☕ 1€</button>
      <button class="don-btn" aria-label="Soutenir avec 2 euros">🍕 2€</button>
      <button class="don-btn" aria-label="Soutenir avec 5 euros">🎮 5€</button>
    </div>
    <div class="funtoken">
      <div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:var(--blue-neon);">🪙 LOGICTOKEN</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px;">Monnaie virtuelle — bientôt disponible</div>
    </div>`;
  openModal();
}

export function showComingSoon(f) {
  document.getElementById('modalTitle').textContent = '🚀 Coming Soon';
  document.getElementById('modalContent').innerHTML = `
    <p style="text-align:center;font-size:15px;color:var(--gold);margin:20px 0;font-family:'Syne',sans-serif;font-weight:800;">
      ${f === '2v2' ? 'Mode 2v2<br><br>4 joueurs · Matchmaking · ELO' : 'Mode 1v1<br><br>Duel en ligne · ELO'}<br><br>En développement
    </p>`;
  openModal();
}

/* ══ PARTAGE DE RÉSULTAT ══ */
export function shareResult(playerName, score, stars, isWin, storyLevel) {
  sfx.share();
  const gameUrl = window.location.origin + window.location.pathname.replace(/\/$/, '') + '/';

  /* ── Générer une belle image de partage via canvas ── */
  _buildShareImage(playerName, score, stars, isWin, storyLevel).then(dataUrl => {
    const emoji  = isWin ? '🏆' : '💀';
    const starStr = '⭐'.repeat(stars || 0);
    const modeStr = storyLevel ? `Niveau ${storyLevel}` : 'vs NEXUS';
    /* shareText : sans URL — navigator.share ajoute url séparément (évite le doublon)
       clipboardText : avec URL — pour le fallback copier-coller */
    const shareText    = `${emoji} LogicShot · ${modeStr}\n${playerName} · ${score > 0 ? score.toLocaleString() + ' pts' : ''} ${starStr}\nPeux-tu me battre ? 🧠⚡`;
    const clipboardText = shareText + '\n' + gameUrl;

    if (dataUrl && navigator.share && navigator.canShare) {
      /* Tenter le partage avec image (Android Chrome, iOS 15+) */
      fetch(dataUrl).then(r => r.blob()).then(blob => {
        const file = new File([blob], 'logicshot.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: 'LogicShot', text: shareText, url: gameUrl }).catch(() => _fallbackShare(clipboardText, dataUrl, gameUrl));
        } else {
          navigator.share({ title: 'LogicShot', text: shareText, url: gameUrl }).catch(() => _fallbackShare(clipboardText, dataUrl, gameUrl));
        }
      }).catch(() => _fallbackShare(clipboardText, dataUrl, gameUrl));
    } else if (navigator.share) {
      navigator.share({ title: 'LogicShot', text: shareText, url: gameUrl }).catch(() => _fallbackShare(clipboardText, dataUrl, gameUrl));
    } else {
      _fallbackShare(clipboardText, dataUrl, gameUrl);
    }
  });
}

function _buildShareImage(playerName, score, stars, isWin, storyLevel) {
  return new Promise(resolve => {
    try {
      const W = 600, H = 340;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');

      /* ── Fond dégradé ── */
      const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, isDark ? '#0a0f1e' : '#f0f4ff');
      grad.addColorStop(1, isDark ? '#111827' : '#e8eeff');
      ctx.fillStyle = grad;
      ctx.roundRect(0, 0, W, H, 20);
      ctx.fill();

      /* ── Bordure ── */
      ctx.strokeStyle = isWin ? '#ffd700' : '#ff5555';
      ctx.lineWidth = 3;
      ctx.roundRect(2, 2, W - 4, H - 4, 18);
      ctx.stroke();

      /* ── Logo texte ── */
      ctx.font = 'bold 15px "Space Grotesk", sans-serif';
      ctx.fillStyle = isDark ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.3)';
      ctx.fillText('LOGICSHOT', 28, 36);

      /* ── Emoji résultat ── */
      ctx.font = '64px serif';
      ctx.fillText(isWin ? '🏆' : '💀', W - 100, 80);

      /* ── Nom joueur ── */
      ctx.font = 'bold 32px "Syne", "Space Grotesk", sans-serif';
      ctx.fillStyle = isDark ? '#ffffff' : '#0a0f1e';
      ctx.fillText(playerName.slice(0, 18), 28, 80);

      /* ── Mode ── */
      const modeStr = storyLevel ? `Niveau ${storyLevel} — Mode Histoire` : 'Vs NEXUS';
      ctx.font = '15px "Space Grotesk", sans-serif';
      ctx.fillStyle = isDark ? 'rgba(255,255,255,.5)' : 'rgba(0,0,30,.5)';
      ctx.fillText(modeStr, 28, 108);

      /* ── Ligne séparatrice ── */
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.1)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(28, 126); ctx.lineTo(W - 28, 126); ctx.stroke();

      /* ── Score ── */
      if (score > 0) {
        ctx.font = 'bold 56px "Syne", sans-serif';
        ctx.fillStyle = isWin ? '#ffd700' : '#ff5555';
        ctx.fillText(score.toLocaleString(), 28, 198);
        ctx.font = '16px "Space Grotesk", sans-serif';
        ctx.fillStyle = isDark ? 'rgba(255,255,255,.4)' : 'rgba(0,0,0,.4)';
        ctx.fillText('POINTS', 28, 220);
      }

      /* ── Étoiles ── */
      if (stars > 0) {
        ctx.font = '36px serif';
        for (let i = 0; i < stars; i++) ctx.fillText('⭐', 28 + i * 42, 272);
      }

      /* ── Résultat badge ── */
      const badgeText = isWin ? 'VICTOIRE' : 'DÉFAITE';
      ctx.font = 'bold 13px "Syne", sans-serif';
      const bw = ctx.measureText(badgeText).width + 24;
      ctx.fillStyle = isWin ? 'rgba(255,215,0,.15)' : 'rgba(255,85,85,.15)';
      ctx.beginPath(); ctx.roundRect(W - bw - 28, 150, bw, 30, 8); ctx.fill();
      ctx.fillStyle = isWin ? '#ffd700' : '#ff5555';
      ctx.fillText(badgeText, W - bw - 28 + 12, 170);

      /* ── Call to action ── */
      ctx.font = '13px "Space Grotesk", sans-serif';
      ctx.fillStyle = isDark ? 'rgba(255,255,255,.3)' : 'rgba(0,0,0,.35)';
      ctx.fillText('Peux-tu me battre ? 🧠⚡', 28, 310);
      ctx.fillStyle = '#00b4ff';
      ctx.fillText(gameUrl.replace('https://', ''), 28, 328);

      resolve(canvas.toDataURL('image/png'));
    } catch(e) {
      resolve(null);
    }
  });
}

function _fallbackShare(text, dataUrl, gameUrl) {
  /* Afficher la belle carte + bouton copier */
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modalTitle');
  const modalContent = document.getElementById('modalContent');
  if (!modal || !modalContent) {
    /* Fallback ultime : copie presse-papiers */
    navigator.clipboard?.writeText(text + '\n' + gameUrl).then(() =>
      _showToast('📋 Score copié ! Colle dans tes messages 😄')
    );
    return;
  }
  if (modalTitle) modalTitle.textContent = '📤 Partager mon score';
  modalContent.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
      ${dataUrl ? `<img src="${dataUrl}" style="width:100%;max-width:440px;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.3);" alt="Score card">` : ''}
      <div style="display:flex;gap:8px;width:100%;max-width:440px;">
        <button onclick="navigator.clipboard?.writeText(${JSON.stringify(text)}).then(()=>window._shareToast())"
          style="flex:1;padding:12px;border-radius:10px;border:1.5px solid var(--border);
            background:var(--card);color:var(--fg);font-weight:700;font-size:13px;cursor:pointer;">
          📋 Copier le texte
        </button>
        ${dataUrl ? `<button onclick="window._downloadShareImg()"
          style="flex:1;padding:12px;border-radius:10px;border:1.5px solid var(--cyan);
            background:transparent;color:var(--cyan);font-weight:700;font-size:13px;cursor:pointer;">
          💾 Sauvegarder l'image
        </button>` : ''}
      </div>
    </div>`;
  window._shareImgDataUrl = dataUrl;
  window._downloadShareImg = function() {
    const a = document.createElement('a');
    a.href = window._shareImgDataUrl;
    a.download = 'logicshot-score.png';
    a.click();
  };
  window._shareToast = function() { _showToast('📋 Score copié !'); };
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

/* ── Toast notification ── */
function _showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast-notif';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

/* ── roundRect polyfill pour anciens navigateurs ── */
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

/* ══ STORY MAP ══ */
export function renderStoryMap() {
  const beaten = Save.getBeatenLevels();
  const unlocked = Save.getUnlockedLevel();
  const stars = Save.getLevelStars();
  const totalStars = Save.getTotalStars();

  /* ── Bloc XP dans la story map ── */
  const xp = State.xp;
  const info = State.xpLevel;
  const prevThreshold = getPrevThreshold(info.level);
  const pct = info.next === Infinity ? 100 : Math.min(100, ((xp - prevThreshold) / (info.next - prevThreshold)) * 100);
  const nextLvlXP = info.next === Infinity ? null : info.next - xp;
  const xpBlock = document.getElementById('storyXpBlock');
  if (xpBlock) {
    xpBlock.innerHTML = `
      <div class="story-xp-row">
        <span class="story-xp-label">🎖️ Nv.${info.level} · ${info.title}</span>
        <span class="story-xp-val">${info.next === Infinity ? `${xp} XP · MAX` : `${xp} / ${info.next} XP`}</span>
      </div>
      <div class="story-xp-bg"><div class="story-xp-fill" style="width:${pct}%"></div></div>
      <div class="story-xp-stats">
        <span>✅ ${beaten.length}/20 niveaux</span>
        <span>⭐ ${totalStars} étoiles</span>
        <span>${nextLvlXP ? `⚡ ${nextLvlXP} XP → Nv.${info.level + 1}` : '🏆 Niveau max !'}</span>
      </div>`;
  }

  /* ── Grille des niveaux ── */
  const grid = document.getElementById('storyGrid');
  grid.innerHTML = '';
  for (let i = 1; i <= 20; i++) {
    const isBeat = beaten.includes(i), isUnlocked = i <= unlocked;
    const zone = i <= 5 ? 'relax-zone' : i <= 10 ? 'easy-zone' : i <= 15 ? 'medium-zone' : 'hard-zone';
    const cls = `story-level ${zone} ${isBeat ? 'beaten' : isUnlocked ? 'unlocked' : 'locked'} ${i === unlocked && !isBeat ? 'current' : ''}`;
    const btn = document.createElement('button');
    btn.className = cls;
    btn.setAttribute('aria-label', `Niveau ${i}${isBeat ? ', complété' : isUnlocked ? ', disponible' : ', verrouillé'}`);
    btn.setAttribute('aria-disabled', isUnlocked ? 'false' : 'true');
    const s = stars[i] || 0;
    const starsHtml = isBeat ? `<div class="story-stars" aria-hidden="true">${'⭐'.repeat(s)}${'☆'.repeat(3 - s)}</div>` : '';
    btn.innerHTML = `${i}${starsHtml}`;
    if (isUnlocked) btn.onclick = () => window._startStoryLevel(i);
    grid.appendChild(btn);
  }
  document.getElementById('storyProgress').textContent = `${beaten.length}/20 complétés`;
}

/* ══ CANVAS PARTICULES ══ */
export function initCanvas() {
  const cv = document.getElementById('cyberCanvas');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  let W, H, pts = [];

  function resize() { W = cv.width = window.innerWidth; H = cv.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  const cols = ['rgba(0,180,255,', 'rgba(245,196,0,', 'rgba(0,184,200,', 'rgba(0,212,255,'];
  for (let i = 0; i < 55; i++) {
    pts.push({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.0002, vy: (Math.random() - 0.5) * 0.0002, r: Math.random() * 1.4 + 0.3, c: cols[i % 4], a: Math.random() * 0.5 + 0.1, life: Math.random() * 200 + 100, ml: 200 });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    pts.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.life--;
      if (p.x < 0 || p.x > 1) p.vx *= -1;
      if (p.y < 0 || p.y > 1) p.vy *= -1;
      if (p.life <= 0) { p.life = p.ml; p.x = Math.random(); p.y = Math.random(); }
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.c + (p.a * (p.life / p.ml)) + ')';
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
}

/* exposer closeModal globalement pour le HTML inline modal */
window.closeModalUI = () => document.getElementById('modalOverlay').classList.add('hidden');
