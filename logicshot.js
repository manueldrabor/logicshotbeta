/* ══════════════════════════════════════
   logicshot.js — Point d'entrée principal
   Navigation, initialisation, glue code
══════════════════════════════════════ */
import { State, C, Save } from './state.js';
import { t, getLang, setLang, applyI18N } from './i18n.js';
import { sfx, toggleMute, initAudioAutoplay, resumeMenuMusic, stopMenuMusic } from './audio.js';
import {
  showScreen, toggleTheme, initTheme, renderXPBar, renderStoryMap,
  showShop, showLeaderboard, showDonation, showComingSoon,
  openModal, closeModal, initCanvas, shareResult
} from './ui.js';
import {
  beginBattle, loadRound, togglePause, quitBattle,
  clearAll, renderAnswerZone, renderOrderZone, renderNumpad, renderSupers,
  submitAnswer, tapOrderBtn, npPress, npNeg, npDel, revealBlind,
  activateSuper, storyLevelToDiff, startAbsentCheck
} from './battle.js';
import { startSurvival, svPress, svNeg, svDel, svSubmit, svShare, svQuit } from './survival.js';

/* ══ EXPOSE GLOBALS (pour les onclick inline restants) ══ */
window._goSplash = goSplash;
window._openStoryMap = openStoryMap;
window._showNarrative = showNarrative;
window._startStoryLevel = startStoryLevel;
window._replayStoryLevel = replayStoryLevel;
window._showLeaderboard = showLeaderboard;
window._shareResult = (name, score, stars, isWin, lvl) => shareResult(name, score, stars, !!isWin, lvl || null);
window._submitAnswer = submitAnswer;
window._tapOrderBtn = tapOrderBtn;
window._npPress = npPress;
window._npNeg = npNeg;
window._npDel = npDel;
window._activateSuper = activateSuper;

/* ── Exposer pour HTML buttons ── */
window.toggleTheme = toggleTheme;
window.toggleMute = toggleMute;
window.startStoryMode = startStoryMode;
window.startVsMachine = () => { _markMenuInteracted(); showScreen('screenDiffSelect'); };
window.selectAIDiff = selectAIDiff;
window.proceedMatchmaking = proceedMatchmaking;
window.showLeaderboard = showLeaderboard;
window.showShop = showShop;
window.showDonation = showDonation;
window.showComingSoon = showComingSoon;
window.openStoryMap = openStoryMap;
window.togglePause = togglePause;
window.quitBattle = quitBattle;
window.revealBlind = revealBlind;
window.confirmOath = confirmOath;
window.narrativeContinue = narrativeContinue;
window.closeModal = closeModal;
window.goSplash = goSplash;
window.showTutorial = showTutorial;
window.closeTutorial = closeTutorial;
window.startOnlineMode = () => { _markMenuInteracted(); startOnlineMode(); };
/* showRecoveryCode est défini en bas du fichier comme window.showRecoveryCode */
window.startCreateRoom = startCreateRoom;
window.startJoinRoom = startJoinRoom;
window.copyRoomCode = copyRoomCode;
window.shareRoomCode = shareRoomCode;
window.cancelOnline = cancelOnline;

/* ══ SURVIE INFINIE ══ */
window.startSurvivalMode = () => { _markMenuInteracted();
  /* Si pas de pseudo → créer un nom invité automatiquement */
  if (!Save.getSavedName()) {
    const guestName = window.LS_LANG === 'en' ? 'Guest' : 'Invité';
    Save.savePlayerName(guestName);
    /* Créer la ligne Supabase en background */
    import('./leaderboard.js').then(({ reserveName }) => reserveName(guestName).catch(() => {}));
  }
  stopMenuMusic();
  State.gameMode = '1vm';
  window._oathCallback = () => startSurvival();
  const saved = Save.getSavedName();
  if (!saved) {
    _nameSetupCallback = (name) => {
      State.oathNames = [name];
      showScreen('screenOath');
    };
    window.showNameSetup(false);
  } else {
    State.oathNames = [saved];
    showScreen('screenOath');
  }
};
window.svPress  = svPress;
window.svNeg    = svNeg;
window.svDel    = svDel;
window.svSubmit = svSubmit;
window.svShare  = svShare;
window.svQuit   = svQuit;

/* ══ NARRATIFS ══ */
function getNarratives() {
  return {
    before1:{robot:'🤖', text:t('narr_before1')},
    before2:{robot:'🤖', text:t('narr_before2')},
    before3:{robot:'🤖', text:t('narr_before3')},
    before4:{robot:'🤖', text:t('narr_before4')},
    before5:{robot:'🤖', text:t('narr_before5')},
    before6:{robot:'⚙️', text:t('narr_before6')},
    before7:{robot:'⚙️', text:t('narr_before7')},
    before8:{robot:'⚙️', text:t('narr_before8')},
    before9:{robot:'⚙️', text:t('narr_before9')},
    before10:{robot:'⚙️',text:t('narr_before10')},
    before11:{robot:'💡',text:t('narr_before11')},
    before12:{robot:'💡',text:t('narr_before12')},
    before13:{robot:'💡',text:t('narr_before13')},
    before14:{robot:'💡',text:t('narr_before14')},
    before15:{robot:'💡',text:t('narr_before15')},
    before16:{robot:'💀',text:t('narr_before16')},
    before17:{robot:'💀',text:t('narr_before17')},
    before18:{robot:'💀',text:t('narr_before18')},
    before19:{robot:'💀',text:t('narr_before19')},
    before20:{robot:'💀',text:t('narr_before20')},
    finale:{robot:'🤝', text:t('narr_finale')}
  };
}

/* ══ NAVIGATE ══ */
function goSplash() {
  clearAll();
  _nameSetupCallback = null;
  document.removeEventListener('visibilitychange', () => {});
  showScreen('screenSplash');
  resumeMenuMusic();
  _refreshPlayerBadge();
  if (_historyReady) {
    history.pushState({ ls: true }, '');
    history.pushState({ ls: true }, '');
  }
  /* Proposer PWA au retour au menu si onboarding vient de se terminer */
  if (window._pendingPwa) {
    window._pendingPwa = false;
    setTimeout(() => window._showPwaModalIfNeeded?.(), 1200);
  }
}

/* ══ BADGE NOM JOUEUR SUR SPLASH ══ */
function _markMenuInteracted() {
  localStorage.setItem('ls_menu_interacted', '1');
  _refreshPlayerBadge();
}

function _refreshPlayerBadge() {
  const name = Save.getSavedName();
  const badge = document.getElementById('splashPlayerBadge');
  const nameEl = document.getElementById('splashPlayerName');
  const hasInteracted = !!localStorage.getItem('ls_menu_interacted');
  if (badge && nameEl) {
    if (name && hasInteracted) {
      nameEl.textContent = name;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  }
  /* Mettre à jour l'affichage dans le menu online */
  const onlineShown = document.getElementById('onlineNameShown');
  const onlineDisplay = document.getElementById('onlineNameDisplay');
  const onlineInput = document.getElementById('onlineNameInput');
  if (name && onlineShown) {
    onlineShown.textContent = name;
    if (onlineDisplay) onlineDisplay.style.display = 'flex';
    if (onlineInput)  onlineInput.style.display = 'none';
  } else if (!name) {
    if (onlineDisplay) onlineDisplay.style.display = 'none';
    if (onlineInput)  { onlineInput.style.display = ''; onlineInput.value = ''; }
  }
}

/* ══ NAME SETUP SCREEN ══ */
let _nameSetupCallback = null;
let _nameSetupCanCancel = false;

window.showNameSetup = function(canCancel = false) {
  _nameSetupCanCancel = canCancel;
  const inp = document.getElementById('nameSetupInput');
  const skipBtn = document.getElementById('nameSetupSkipBtn');
  const title = document.getElementById('nameSetupTitle');
  const sub   = document.getElementById('nameSetupSub');
  const existingName = Save.getSavedName();

  if (inp) { inp.value = existingName || ''; inp.placeholder = t('name_placeholder'); }

  /* Toujours afficher Annuler si : canCancel OU si un nom existe déjà */
  const showCancel = canCancel || !!existingName;
  if (skipBtn) skipBtn.style.display = showCancel ? '' : 'none';

  if (title) title.textContent = canCancel ? t('name_change_title') : t('name_title');
  if (sub) sub.textContent = canCancel ? t('name_change_sub') : t('name_sub');
  document.getElementById('nameSetupWarn').textContent = '';
  showScreen('screenNameSetup');
  setTimeout(() => inp?.focus(), 200);
};

window.cancelNameSetup = function() {
  /* Toujours permettre de revenir au splash (même premier lancement) */
  _nameSetupCallback = null;
  goSplash();
};

window.confirmNameSetup = async function() {
  const inp  = document.getElementById('nameSetupInput');
  const warn = document.getElementById('nameSetupWarn');
  const btn  = document.querySelector('#screenNameSetup .res-btn.gold');
  const raw  = (inp?.value || '').trim();

  if (!raw) {
    if (warn) warn.textContent = t('name_required');
    inp?.focus();
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = t('name_checking'); }
  if (warn) warn.textContent = '';

  try {
    const { reserveName } = await import('./leaderboard.js');
    const timeoutP = new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), 4000));
    const name = await Promise.race([reserveName(raw), timeoutP]);
    /* Nom validé online → sauvegarder seulement maintenant */
    Save.savePlayerName(name);
    State.oathNames = [name];
  } catch(e) {
    /* Hors ligne ou timeout → sauvegarder localement et continuer */
    Save.savePlayerName(raw);
    State.oathNames = [raw];
  }

  if (btn) { btn.disabled = false; btn.textContent = t('name_cta'); }
  _refreshPlayerBadge();

  /* Première fois qu'un nom est défini → proposer PWA après retour menu */
  if (!localStorage.getItem('ls_pwa_onboarded')) {
    localStorage.setItem('ls_pwa_onboarded', '1');
    window._pendingPwa = true;
  }

  const cb = _nameSetupCallback;
  _nameSetupCallback = null;
  if (cb) cb(Save.getSavedName());
  else goSplash();
};

/* ══ SPLASH ══ */
function startStoryMode() {
  _markMenuInteracted();
  State.gameMode = 'story';
  const saved = Save.getSavedName();
  if (!saved) {
    _nameSetupCallback = () => openStoryMap();
    window.showNameSetup(false);
  } else {
    State.oathNames = [saved];
    openStoryMap();
  }
}

function selectAIDiff(diff) {
  State.aiDifficulty = diff;
  State.gameMode = '1vm';
  State.unlockedSupers = {
    flash: diff === 'easy' || diff === 'medium' || diff === 'hard',
    glitch: diff === 'medium' || diff === 'hard',
    shield: diff === 'hard'
  };
  const saved = Save.getSavedName();
  if (!saved) {
    _nameSetupCallback = (name) => {
      State.oathNames = [name];
      showScreen('screenOath');
    };
    window.showNameSetup(false);
  } else {
    State.oathNames = [saved];
    showScreen('screenOath');
  }
}

async function proceedMatchmaking() {
  const raw  = (document.getElementById('mmInp0')?.value || '').trim() || (t('online_player_label') || 'Joueur');
  const btn  = document.querySelector('#screenMatchmaking .res-btn.gold');

  /* Désactiver le bouton pendant la vérification */
  if (btn) { btn.disabled = true; btn.textContent = t('name_checking'); }

  try {
    const { reserveName } = await import('./leaderboard.js');
    const name = await reserveName(raw);

    State.oathNames = [name];
    if (State.gameMode === 'story') openStoryMap();
    else showScreen('screenOath');
  } catch(e) {
    /* Fallback silencieux si offline */
    Save.savePlayerName(raw);
    State.oathNames = [raw];
    if (State.gameMode === 'story') openStoryMap();
    else showScreen('screenOath');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = t('mm_cta'); }
  }
}

/* ══ STORY MAP ══ */
function openStoryMap() {
  renderStoryMap();
  const beaten = Save.getBeatenLevels();
  const totalStars = Save.getTotalStars();
  if (beaten.length > 0) {
    const storyDesc = document.querySelector('#screenSplash .mode-btn .mode-desc');
    if (storyDesc) storyDesc.textContent = `${beaten.length}/20 · ${totalStars}⭐`;
  }
  showScreen('screenStory');
}

/* ══ NARRATIVE ══ */
function showNarrative(key, afterCb) {
  const n = getNarratives()[key];
  if (!n) { afterCb && afterCb(); return; }
  State._narrativeAfterCb = afterCb;
  document.getElementById('narrativeRobot').textContent = n.robot;
  document.getElementById('narrativeText').innerHTML = n.text.replace(/\n/g, '<br>');
  document.getElementById('narrativeLvl').textContent = '';
  showScreen('screenNarrative');
}

function narrativeContinue() {
  if (State._narrativeAfterCb) { const cb = State._narrativeAfterCb; State._narrativeAfterCb = null; cb(); }
  else if (State.gameMode === 'story') openStoryMap();
  else goSplash();
}

/* ══ STORY LEVEL ══ */
function startStoryLevel(lvl) {
  State.currentStoryLevel = lvl;
  State.aiDifficulty = storyLevelToDiff(lvl);
  State.unlockedSupers = { flash: lvl > 5, glitch: lvl > 10, shield: lvl > 15 };
  showNarrative('before' + lvl, () => {
    document.getElementById('oathCb').checked = false;
    window._oathCallback = () => beginBattle();
    showScreen('screenOath');
  });
}

function replayStoryLevel() { startStoryLevel(State.currentStoryLevel); }

/* ══ ONLINE 1v1 ══ */
function startOnlineMode() {
  const saved = Save.getSavedName();
  stopMenuMusic();
  _refreshPlayerBadge(); /* Sync le nom dans l'écran online */
  if (!saved) {
    /* Pas de nom — demander d'abord, puis revenir au mode online */
    _nameSetupCallback = () => startOnlineMode();
    window.showNameSetup(false);
    return;
  }
  /* Nom connu → pré-remplir le champ fallback input aussi */
  const inp = document.getElementById('onlineNameInput');
  if (inp) inp.value = saved;
  window._oathCallback = () => showScreen('screenOnlineMenu');
  showScreen('screenOath');
}

function showOnlineError(msg) {
  let el = document.getElementById('onlineError');
  if (!el) {
    el = document.createElement('div');
    el.id = 'onlineError';
    el.style.cssText = 'font-size:12px;color:var(--red);text-align:center;font-weight:600;min-height:18px;transition:opacity .3s;';
    const box = document.querySelector('#screenOnlineMenu .online-box');
    if (box) box.insertBefore(el, box.querySelector('.online-btn'));
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 3000);
}

async function startCreateRoom() {
  /* Utilise le nom sauvegardé — l'input est un fallback si jamais pas de nom */
  const saved = Save.getSavedName();
  const inp   = document.getElementById('onlineNameInput');
  const raw   = saved || (inp?.value || '').trim();

  if (!raw) {
    showOnlineError('⚠️ Entre ton pseudo pour continuer !');
    if (inp) { inp.style.display = ''; inp.focus(); }
    return;
  }

  const btn = document.getElementById('onlineCreateBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Réservation du nom…'; }

  try {
    const { reserveName } = await import('./leaderboard.js');
    const name = await reserveName(raw);
    if (inp && name !== raw) inp.value = name;

    State.oathNames = [name];
    if (btn) btn.textContent = '⏳ Création de la salle…';

    const { createRoom } = await import('./online.js');
    const code = await createRoom(name);

    document.getElementById('lobbyTitle').textContent = '🏠 En attente d\'un adversaire';
    document.getElementById('lobbyCode').innerHTML =
      `<div style="font-size:11px;color:var(--muted);margin-bottom:6px;letter-spacing:1px;text-transform:uppercase;">Code de ta salle</div>
       <div class="room-code-display">${code}</div>`;
    document.getElementById('lobbyStatus').innerHTML = t('lobby_share_code');
    document.getElementById('lobbyCopyBtn').style.display = '';
    document.getElementById('lobbyShareBtn').style.display = '';
    showScreen('screenOnlineLobby');
  } catch(e) {
    showOnlineError('⚠️ ' + (e.message || 'Erreur réseau. Réessaie.'));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🏠 Créer une salle'; }
  }
}

async function startJoinRoom() {
  const saved   = Save.getSavedName();
  const nameInp = document.getElementById('onlineNameInput');
  const codeInp = document.getElementById('onlineCodeInput');
  const raw  = saved || (nameInp?.value || '').trim();
  const code = (codeInp?.value || '').trim().toUpperCase();

  if (!raw) {
    showOnlineError('⚠️ Entre ton pseudo pour continuer !');
    if (nameInp) { nameInp.style.display = ''; nameInp.focus(); }
    return;
  }

  if (!code || code.length < 4) {
    codeInp?.focus();
    codeInp?.classList.add('wrong');
    setTimeout(() => codeInp?.classList.remove('wrong'), 700);
    showOnlineError('⚠️ Entre le code de 4 lettres !');
    return;
  }

  const btn = document.getElementById('onlineJoinBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Réservation du nom…'; }

  try {
    const { reserveName } = await import('./leaderboard.js');
    const name = await reserveName(raw);
    if (nameInp && name !== raw) nameInp.value = name;

    State.oathNames = [name];
    if (btn) btn.textContent = '⏳ Connexion…';

    const { joinRoom } = await import('./online.js');
    const hostName = await joinRoom(code, name);

    document.getElementById('lobbyTitle').textContent = `⚔️ Connecté à ${hostName}`;
    document.getElementById('lobbyCode').innerHTML = '';
    document.getElementById('lobbyStatus').innerHTML = t('lobby_waiting_host');
    document.getElementById('lobbyCopyBtn').style.display = 'none';
    document.getElementById('lobbyShareBtn').style.display = 'none';
    showScreen('screenOnlineLobby');
  } catch(e) {
    showOnlineError('⚠️ ' + (e.message || 'Erreur réseau. Réessaie.'));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🚪 Rejoindre'; }
  }
}

function copyRoomCode() {
  if (!State.roomCode) return;
  navigator.clipboard?.writeText(State.roomCode).then(() => {
    const btn = document.getElementById('lobbyCopyBtn');
    if (btn) { btn.textContent = '✅'; setTimeout(() => btn.textContent = t('lobby_copy'), 2000); }
  });
}

function shareRoomCode() {
  if (!State.roomCode) return;
  const code = State.roomCode;
  const gameUrl = window.location.origin + window.location.pathname.replace(/\/$/, '') + '/';
  /* shareText : sans URL (navigator.share ajoute url séparément — évite le doublon)
     clipboardText : avec URL (pour le fallback copier-coller) */
  const shareText    = `⚔️ Rejoins-moi sur LogicShot !\nCode de la salle : ${code}\n🧠 Calcul mental en 1v1 — Peux-tu me battre ?`;
  const clipboardText = shareText + '\n' + gameUrl;
  const onCopied = () => {
    const btn = document.getElementById('lobbyShareBtn');
    if (btn) { btn.textContent = '✅ Lien copié !'; setTimeout(() => btn.textContent = '📤 Partager le code', 2000); }
  };
  if (navigator.share) {
    navigator.share({ title: 'LogicShot — Rejoins ma salle !', text: shareText, url: gameUrl })
      .catch(() => navigator.clipboard?.writeText(clipboardText).then(onCopied));
  } else {
    navigator.clipboard?.writeText(clipboardText).then(onCopied);
  }
}

function cancelOnline() {
  import('./online.js').then(({ cleanup }) => cleanup()).catch(() => {});
  State.gameMode = '1vm';
  goSplash();
}

/* ══ OATH ══ */
function confirmOath() {
  if (!document.getElementById('oathCb')?.checked) { alert(t('oath_required')); return; }
  document.getElementById('oathCb').checked = false;
  if (window._oathCallback) { const cb = window._oathCallback; window._oathCallback = null; cb(); }
  else beginBattle();
}

/* ══ TUTORIEL ══ */
function getTutorialSteps() {
  return [0,1,2,3,4,5].map(i => ({
    icon: t('tuto_' + i + '_icon'),
    title: t('tuto_' + i + '_title'),
    text: t('tuto_' + i + '_text')
  }));
}

let tutorialStep = 0;

function showTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
  document.getElementById('screenTutorial')?.classList.remove('hidden');
}

function closeTutorial() {
  document.getElementById('screenTutorial')?.classList.add('hidden');
}

function tutoNext() {
  const steps = getTutorialSteps();
  if (tutorialStep < steps.length - 1) { tutorialStep++; renderTutorialStep(); }
  else closeTutorial();
}

function tutoPrev() {
  if (tutorialStep > 0) { tutorialStep--; renderTutorialStep(); }
}

window.tutoNext = tutoNext;
window.tutoPrev = tutoPrev;

function renderTutorialStep() {
  const TUTORIAL_STEPS = getTutorialSteps();
  const step = TUTORIAL_STEPS[tutorialStep];
  if (!step) return;

  /* ── Contenu texte ── */
  const content = document.getElementById('tutorialContent');
  if (content) {
    content.innerHTML = `
      <div style="text-align:center;margin-bottom:6px;">
        <span style="font-size:34px;display:block;margin-bottom:8px;">${step.icon}</span>
        <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:17px;
          color:var(--text);margin-bottom:10px;letter-spacing:0.5px;">${step.title}</div>
        <div style="font-size:13px;color:var(--muted);line-height:1.65;padding:0 4px;">${step.text}</div>
      </div>`;
  }

  /* ── Illustration SVG animée selon l'étape ── */
  const illu = document.getElementById('tutoIllustration');
  if (illu) illu.innerHTML = _getTutoIllustration(tutorialStep);

  /* ── Dots de progression ── */
  const dots = document.getElementById('tutoDots');
  if (dots) {
    dots.innerHTML = TUTORIAL_STEPS.map((_, i) => `
      <div style="
        width:${i === tutorialStep ? 22 : 7}px;height:7px;border-radius:4px;
        background:${i === tutorialStep ? 'var(--blue-neon)' : 'rgba(0,180,255,0.2)'};
        transition:all .25s ease;"></div>`).join('');
  }

  /* ── Boutons nav ── */
  const prevBtn = document.getElementById('tutoPrevBtn');
  const nextBtn = document.getElementById('tutoNextBtn');
  if (prevBtn) {
    prevBtn.textContent = t('tuto_prev');
    prevBtn.style.visibility = tutorialStep === 0 ? 'hidden' : 'visible';
  }
  if (nextBtn) nextBtn.textContent = tutorialStep === TUTORIAL_STEPS.length - 1 ? t('tuto_start') : t('tuto_next');
}

/* ── Illustrations SVG par étape ── */
function _getTutoIllustration(step) {
  const isEn = window.LS_LANG === 'en';
  const illustrations = [
    /* 0 — Formule */
    `<div style="font-family:'Share Tech Mono',monospace;font-size:26px;color:var(--blue-neon);
        text-align:center;animation:tutoGlow 1.5s ease-in-out infinite alternate;">
      <div style="font-size:13px;color:var(--muted);margin-bottom:6px;font-family:'Space Grotesk',sans-serif;letter-spacing:2px;">${isEn ? 'SOLVE' : 'RÉSOUS'}</div>
      8 × 7 − 12
      <div style="font-size:14px;color:var(--gold);margin-top:8px;">= ?</div>
    </div>`,

    /* 1 — Vitesse */
    `<div style="display:flex;align-items:center;justify-content:center;gap:20px;width:100%;">
      <div style="text-align:center;">
        <div style="font-size:36px;animation:tutoBounce 0.8s ease infinite alternate;">🧠</div>
        <div style="font-size:10px;color:var(--blue-neon);margin-top:4px;font-weight:700;">${isEn ? 'YOU' : 'TOI'}</div>
      </div>
      <div style="font-size:28px;color:var(--gold);animation:tutoFade 1s ease infinite alternate;">⚡</div>
      <div style="text-align:center;">
        <div style="font-size:36px;animation:tutoBounce 0.8s ease 0.4s infinite alternate;">🤖</div>
        <div style="font-size:10px;color:var(--red);margin-top:4px;font-weight:700;">NEXUS</div>
      </div>
    </div>`,

    /* 2 — HP */
    `<div style="text-align:center;width:100%;padding:0 20px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <div style="font-size:13px;color:var(--muted);width:50px;text-align:right;">${isEn ? 'YOU' : 'TOI'}</div>
        <div style="flex:1;height:14px;border-radius:7px;background:rgba(255,255,255,0.1);overflow:hidden;">
          <div style="width:70%;height:100%;background:linear-gradient(90deg,var(--green),#00ff88);border-radius:7px;animation:tutoHP 2s ease infinite;"></div>
        </div>
        <div style="font-size:13px;color:var(--green);width:30px;">70</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="font-size:13px;color:var(--muted);width:50px;text-align:right;">NEXUS</div>
        <div style="flex:1;height:14px;border-radius:7px;background:rgba(255,255,255,0.1);overflow:hidden;">
          <div style="width:40%;height:100%;background:linear-gradient(90deg,var(--red),#ff6644);border-radius:7px;"></div>
        </div>
        <div style="font-size:13px;color:var(--red);width:30px;">40</div>
      </div>
    </div>`,

    /* 3 — Supers */
    `<div style="display:flex;align-items:center;justify-content:center;gap:16px;">
      ${['⚡','👾','🛡️'].map((icon,i) => `
        <div style="text-align:center;animation:tutoBounce 0.7s ease ${i*0.2}s infinite alternate;">
          <div style="width:52px;height:52px;border-radius:14px;
            background:rgba(0,180,255,0.12);border:1.5px solid rgba(0,180,255,0.3);
            display:flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:4px;">${icon}</div>
          <div style="font-size:9px;color:var(--muted);">${['Flash','Glitch','Shield'][i]}</div>
        </div>`).join('')}
    </div>`,

    /* 4 — Streak */
    `<div style="text-align:center;">
      <div style="display:flex;justify-content:center;gap:6px;margin-bottom:10px;">
        ${[1,2,3,4,5].map((n,i) => `
          <div style="
            width:32px;height:32px;border-radius:50%;font-size:14px;font-weight:800;
            display:flex;align-items:center;justify-content:center;
            background:${i < 3 ? 'linear-gradient(135deg,var(--gold),#ff8800)' : 'rgba(255,255,255,0.08)'};
            color:${i < 3 ? '#000' : 'var(--muted)'};
            animation:${i < 3 ? 'tutoBounce 0.6s ease '+(i*0.1)+'s infinite alternate' : 'none'};">
            ${i < 3 ? '✓' : n}
          </div>`).join('')}
      </div>
      <div style="font-size:22px;font-weight:800;color:var(--gold);font-family:'Syne',sans-serif;">
        🔥 ×3 COMBO
      </div>
    </div>`,

    /* 5 — Beat NEXUS */
    `<div style="text-align:center;animation:tutoGlow 1.2s ease infinite alternate;">
      <div style="font-size:48px;margin-bottom:8px;">🏆</div>
      <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:18px;
        background:linear-gradient(135deg,var(--gold),#ff8800);
        -webkit-background-clip:text;-webkit-text-fill-color:transparent;">
        ${isEn ? 'BEAT NEXUS!' : 'BATS NEXUS !'}
      </div>
    </div>`,
  ];

  const html = illustrations[step] || '';
  return html;
}


function _getCurrentScreen() {
  return SCREEN_ORDER.find(id => !document.getElementById(id)?.classList.contains('hidden'))
    || 'screenSplash';
}

let _splashBackCount  = 0;
let _splashBackTimer  = null;

function _handleBack() {
  /* ── Vérifier d'abord les overlays / panels ── */
  const recovModal = document.getElementById('recoveryModal');
  if (recovModal) { recovModal.remove(); history.pushState({ ls: true }, ''); return; }

  /* Settings panel is open when backdrop has pointer-events:auto */
  const settingsBd = document.getElementById('settingsBackdrop');
  if (settingsBd && settingsBd.style.pointerEvents === 'auto') {
    closeSettings(); history.pushState({ ls: true }, ''); return;
  }
  const modalOverlay = document.getElementById('modalOverlay');
  if (modalOverlay && !modalOverlay.classList.contains('hidden')) {
    closeModal(); history.pushState({ ls: true }, ''); return;
  }
  const tutorialScreen = document.getElementById('screenTutorial');
  if (tutorialScreen && !tutorialScreen.classList.contains('hidden')) {
    closeTutorial(); history.pushState({ ls: true }, ''); return;
  }

  const screen = _getCurrentScreen();

  /* ── Combat en cours : même action qu'Abandonner ── */
  if (screen === 'screenBattle') {
    quitBattle();   /* quitBattle() a déjà son propre confirm() */
    return;
  }

  /* ── Lobby online : annuler ── */
  if (screen === 'screenOnlineLobby') {
    if (confirm(t('confirm_quit_room'))) cancelOnline();
    return;
  }

  /* ── Splash : double appui pour quitter ── */
  if (screen === 'screenSplash') {
    _splashBackCount++;
    clearTimeout(_splashBackTimer);
    if (_splashBackCount >= 2) {
      _splashBackCount = 0;
      /* Laisser le navigateur quitter — ne pas re-pousser d'état */
      return;
    }
    /* Re-pousser 2 états pour que le prochain appui reste interceptable */
    history.pushState({ ls: true }, '');
    history.pushState({ ls: true }, '');
    _showBackToast(t('back_to_quit'));
    _splashBackTimer = setTimeout(() => { _splashBackCount = 0; }, 2500);
    return;
  }

  /* ── Autres écrans : navigation vers l'écran parent ── */
  _splashBackCount = 0;
  history.pushState({ ls: true }, '');

  switch (screen) {
    case 'screenNameSetup':     window.cancelNameSetup();  break;
    case 'screenMatchmaking':   goSplash();       break;
    case 'screenDiffSelect':    goSplash();       break;
    case 'screenResults':       goSplash();       break;
    case 'screenOnlineMenu':    goSplash();       break;
    case 'screenTutorial':      closeTutorial();  break;
    case 'screenStory':        goSplash();       break;
    case 'screenNarrative':
      if (State.gameMode === 'story') openStoryMap(); else goSplash(); break;
    case 'screenOath':
      if (State.gameMode === 'story') openStoryMap(); else goSplash(); break;
    default: goSplash(); break;
  }
}

function _showBackToast(msg) {
  let t = document.getElementById('backToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'backToast';
    t.style.cssText = [
      'position:fixed','bottom:90px','left:50%','transform:translateX(-50%)',
      'background:rgba(10,10,18,0.88)','color:#fff','padding:11px 22px',
      'border-radius:24px','font-size:13px','font-family:\'Space Grotesk\',sans-serif',
      'font-weight:600','z-index:99999','opacity:0','transition:opacity .25s',
      'pointer-events:none','white-space:nowrap',
      'border:1px solid rgba(245,196,0,0.35)',
      'box-shadow:0 4px 20px rgba(0,0,0,0.4)'
    ].join(';');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; }, 1800);
}

/* Pousser le premier état uniquement après interaction utilisateur
   (évite l'avertissement "added without user interaction" de Chrome) */
let _historyReady = false;
function _initHistory() {
  if (_historyReady) return;
  _historyReady = true;
  history.pushState({ ls: true }, '');
}
document.addEventListener('click',      _initHistory, { once: true });
document.addEventListener('touchend',   _initHistory, { once: true, passive: true });
document.addEventListener('keydown',    _initHistory, { once: true });

window.addEventListener('popstate', () => {
  if (!_historyReady) return; /* pas encore initialisé — laisser le navigateur gérer */
  const screen = _getCurrentScreen();
  /* Pour tous les écrans sauf le cas "2e appui au splash", on re-pousse un état
     afin que le prochain appui de retour déclenche aussi popstate */
  if (!(screen === 'screenSplash' && _splashBackCount >= 1)) {
    history.pushState({ ls: true }, '');
  }
  _handleBack();
});


/* ══ SÉLECTEUR DE LANGUE (premier lancement) ══ */
function _showLanguagePicker(onDone) {
  let _selected = null;

  const overlay = document.createElement('div');
  overlay.id = 'langPickOverlay';
  overlay.style.cssText = [
    'position:fixed','inset:0','z-index:9999',
    'display:flex','align-items:center','justify-content:center',
    'background:var(--bg)','padding:20px'
  ].join(';');

  const btnStyle = (active) => `
    padding:16px;border-radius:16px;
    border:2px solid ${active ? 'var(--blue-neon)' : 'var(--border)'};
    background:${active ? 'rgba(0,180,255,0.10)' : 'var(--card)'};
    color:var(--text);
    font-family:'Syne',sans-serif;font-weight:800;font-size:16px;
    cursor:pointer;transition:all .18s;display:flex;align-items:center;gap:12px;
    width:100%;-webkit-tap-highlight-color:transparent;`;

  const continueBtnStyle = (enabled) => `
    width:100%;padding:15px;border-radius:16px;border:none;
    background:${enabled ? 'var(--blue-neon)' : 'rgba(0,180,255,0.2)'};
    color:${enabled ? '#000' : 'rgba(0,180,255,0.4)'};
    font-family:'Syne',sans-serif;font-weight:800;font-size:16px;
    letter-spacing:1px;cursor:${enabled ? 'pointer' : 'default'};
    transition:all .2s;-webkit-tap-highlight-color:transparent;`;

  overlay.innerHTML = `
    <div style="text-align:center;max-width:320px;width:100%;">
      <div style="font-size:52px;margin-bottom:16px;">🌍</div>
      <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:22px;
        color:var(--text);margin-bottom:4px;">Choisissez votre langue</div>
      <div style="font-size:14px;color:var(--muted);margin-bottom:24px;">Choose your language</div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;">
        <button id="langBtnFr" style="${btnStyle(false)}">
          <span style="font-size:28px;">🇫🇷</span>
          <div style="text-align:left;">
            <div>Français</div>
            <div style="font-size:11px;color:var(--muted);font-weight:500;font-family:'Space Grotesk',sans-serif;">French</div>
          </div>
          <span id="langCheckFr" style="margin-left:auto;font-size:18px;opacity:0;">✓</span>
        </button>
        <button id="langBtnEn" style="${btnStyle(false)}">
          <span style="font-size:28px;">🇬🇧</span>
          <div style="text-align:left;">
            <div>English</div>
            <div style="font-size:11px;color:var(--muted);font-weight:500;font-family:'Space Grotesk',sans-serif;">Anglais</div>
          </div>
          <span id="langCheckEn" style="margin-left:auto;font-size:18px;opacity:0;">✓</span>
        </button>
      </div>
      <button id="langContinueBtn" style="${continueBtnStyle(false)}" disabled>
        Continuer &nbsp;/&nbsp; Continue →
      </button>
    </div>`;

  document.body.appendChild(overlay);

  function selectLang(lang) {
    _selected = lang;
    const frActive = lang === 'fr';
    document.getElementById('langBtnFr').style.cssText = btnStyle(frActive);
    document.getElementById('langBtnEn').style.cssText = btnStyle(!frActive);
    document.getElementById('langCheckFr').style.opacity = frActive ? '1' : '0';
    document.getElementById('langCheckEn').style.opacity = !frActive ? '1' : '0';
    document.getElementById('langCheckFr').style.color = 'var(--blue-neon)';
    document.getElementById('langCheckEn').style.color = 'var(--blue-neon)';
    const btn = document.getElementById('langContinueBtn');
    btn.style.cssText = continueBtnStyle(true);
    btn.disabled = false;
    btn.textContent = lang === 'fr' ? 'Continuer →' : 'Continue →';
  }

  function confirm() {
    if (!_selected) return;
    setLang(_selected);
    applyI18N();
    overlay.remove();
    onDone && onDone();
  }

  document.getElementById('langBtnFr').addEventListener('click', () => selectLang('fr'));
  document.getElementById('langBtnEn').addEventListener('click', () => selectLang('en'));
  document.getElementById('langContinueBtn').addEventListener('click', confirm);
}

function _doFirstLaunchTutorial() {
  localStorage.setItem('ls_tutorial_done', '1');
  showTutorial();
  const origClose = window.closeTutorial;
  window.closeTutorial = function() {
    origClose && origClose();
    window.closeTutorial = origClose;
    /* Après le tuto : si déjà un nom → proposer PWA. Sinon → nom d'abord, puis PWA */
    if (!Save.getSavedName()) {
      setTimeout(() => window.showNameSetup(false), 300);
      /* La PWA sera proposée après la validation du nom (voir confirmNameSetup) */
    } else {
      setTimeout(() => window._showPwaModalIfNeeded?.(), 1000);
    }
  };
}

/* ══ SWITCHER DE LANGUE DANS LES RÉGLAGES ══ */
window.toggleLanguage = function() {
  const newLang = getLang() === 'fr' ? 'en' : 'fr';
  setLang(newLang);
  applyI18N();
  /* Mettre à jour le bouton */
  const btn = document.getElementById('settingsLangBtn');
  if (btn) btn.textContent = newLang === 'fr' ? '🇫🇷 FR / EN' : '🇬🇧 EN / FR';
  /* Update theme/mute buttons */
  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) themeBtn.textContent = State.isDark ? t('theme_light') : t('theme_dark');
  const muteBtn = document.getElementById('muteBtn');
  if (muteBtn) muteBtn.textContent = State.isMuted ? t('sound_off') : t('sound_on');
};


/* ══ MODE INVITÉ — jouer sans compte ══ */
window.playAsGuest = function() {
  const isEn = window.LS_LANG === 'en';
  /* Nom invité temporaire */
  const guestName = isEn ? 'Guest' : 'Invité';
  Save.savePlayerName(guestName);
  State.oathNames = [guestName];
  /* Créer la ligne Supabase en background pour que le leaderboard fonctionne */
  import('./leaderboard.js').then(({ reserveName }) => reserveName(guestName).catch(() => {}));
  /* Forcer niveau 1, relax pour découverte */
  State.gameMode = 'story';
  State.currentStoryLevel = 1;
  State.aiDifficulty = 'easy';
  showScreen('screenNameSetup');
  document.getElementById('screenNameSetup')?.classList.add('hidden');
  showScreen('screenOath');
};

/* ══ INIT ══ */
(function init() {
  initTheme();
  applyI18N();
  initCanvas();
  initAudioAutoplay();
  renderXPBar();

  /* Afficher le badge joueur si nom déjà enregistré */
  _refreshPlayerBadge();

  /* Restaurer progression cloud si localStorage vide */
  import('./leaderboard.js').then(m => {
    m.loadProgressFromCloud().then(() => { renderXPBar(); _refreshPlayerBadge(); }).catch(() => {});
  }).catch(() => {});

  /* ── Premier lancement : langue → tutoriel → pseudo ── */
  if (!localStorage.getItem('ls_lang')) {
    setTimeout(() => _showLanguagePicker(() => {
      _doFirstLaunchTutorial();
    }), 500);
  } else if (!localStorage.getItem('ls_tutorial_done')) {
    setTimeout(() => _doFirstLaunchTutorial(), 600);
  } else if (!Save.getSavedName()) {
    setTimeout(() => window.showNameSetup(false), 800);
  }

  /* Mettre à jour le badge story sur le splash */
  const beaten = Save.getBeatenLevels();
  const totalStars = Save.getTotalStars();
  if (beaten.length > 0) {
    const storyDesc = document.querySelector('#screenSplash .mode-btn .mode-desc');
    if (storyDesc) storyDesc.textContent = `${beaten.length}/20 · ${totalStars}⭐`;
  }

  /* Service Worker PWA */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();

/* ══════════════════════════════════════
   CODE DE RÉCUPÉRATION — UI
   Bouton "🔑 Récupération" dans le splash
══════════════════════════════════════ */
window.showRecoveryCode = async function() {
  /* Créer la modale */
  const m = document.createElement('div');
  m.id = 'recoveryModal';
  m.style.cssText = `position:fixed;inset:0;z-index:9200;display:flex;align-items:center;
    justify-content:center;background:rgba(0,0,0,.82);backdrop-filter:blur(6px);padding:20px;`;
  m.innerHTML = `
    <div style="background:var(--card);border:1.5px solid var(--border);border-radius:20px;
      padding:28px 24px;max-width:340px;width:100%;text-align:center;position:relative;">
      <button onclick="document.getElementById('recoveryModal')?.remove()"
        style="position:absolute;top:12px;right:14px;background:none;border:none;
          font-size:20px;color:var(--muted);cursor:pointer;">✕</button>
      <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:18px;
        color:var(--gold);margin-bottom:6px;">${t('rec_title')}</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:18px;line-height:1.5;white-space:pre-line;">
        ${t('rec_sub')}
      </div>
      <div id="recCodeDisplay" style="font-family:'Share Tech Mono',monospace;font-size:24px;
        font-weight:700;letter-spacing:3px;color:var(--cyan);
        background:rgba(0,180,255,.08);border:1px solid var(--cyan);
        border-radius:12px;padding:14px;margin-bottom:16px;">
        <span style="opacity:.5;font-size:13px;">Chargement…</span>
      </div>
      <button onclick="window._copyRecCode()"
        style="width:100%;padding:12px;border-radius:12px;border:1.5px solid var(--gold-neon);
          background:transparent;color:var(--gold-neon);font-weight:700;font-size:14px;
          cursor:pointer;margin-bottom:10px;letter-spacing:1px;">${t('rec_copy')}</button>
      <div style="margin:16px 0;font-size:11px;color:var(--muted);letter-spacing:1px;">${t('diff_badge_easy').startsWith('E')?'— OR —':'— OU —'}</div>
      <div style="font-size:13px;color:var(--fg);margin-bottom:10px;font-weight:600;">
        ${t('rec_restore_label')}
      </div>
      <input id="recCodeInput" placeholder="${t('rec_restore_placeholder')}" maxlength="12"
        style="width:100%;box-sizing:border-box;padding:12px;border-radius:10px;
          border:1.5px solid var(--border);background:var(--bg);color:var(--fg);
          font-family:'Share Tech Mono',monospace;font-size:16px;text-align:center;
          text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;"
        oninput="this.value=this.value.toUpperCase()">
      <button onclick="window._restoreFromCode()"
        style="width:100%;padding:12px;border-radius:12px;border:none;
          background:var(--gold-neon);color:#1a1200;font-weight:800;font-size:14px;
          cursor:pointer;letter-spacing:1px;">${t('rec_restore_btn')}</button>
      <div id="recMsg" style="margin-top:10px;font-size:12px;min-height:18px;"></div>
    </div>`;
  document.body.appendChild(m);

  /* Charger le code existant */
  import('./leaderboard.js').then(async ({ getOrCreateRecoveryCode }) => {
    const code = await getOrCreateRecoveryCode();
    const disp = document.getElementById('recCodeDisplay');
    if (code) {
      if (disp) disp.textContent = code;
      window._currentRecCode = code;
    } else {
      if (disp) {
        disp.textContent = t('diff_badge_easy').startsWith('E') ? '(offline)' : '(hors ligne)';
        disp.style.opacity = '0.7';
      }
      window._currentRecCode = null;
    }
  }).catch(() => {
    const disp = document.getElementById('recCodeDisplay');
    if (disp) disp.textContent = t('diff_badge_easy').startsWith('E') ? '(offline)' : '(hors ligne)';
    window._currentRecCode = null;
  });
};

window._copyRecCode = function() {
  const code = window._currentRecCode;
  if (!code) {
    const msg = document.getElementById('recMsg');
    if (msg) { msg.style.color = 'var(--muted)'; msg.textContent = t('diff_badge_easy').startsWith('E') ? 'Code unavailable offline.' : 'Code indisponible hors ligne.'; }
    return;
  }
  navigator.clipboard.writeText(code).then(() => {
    const msg = document.getElementById('recMsg');
    if (msg) { msg.style.color = 'var(--green)'; msg.textContent = t('rec_copied'); }
  }).catch(() => {
    const msg = document.getElementById('recMsg');
    if (msg) { msg.style.color = 'var(--muted)'; msg.textContent = code; }
  });
};

window._restoreFromCode = async function() {
  const inp = document.getElementById('recCodeInput');
  const msg = document.getElementById('recMsg');
  if (!inp || !inp.value.trim()) { if (msg) { msg.style.color='var(--red)'; msg.textContent=t('rec_enter_code'); } return; }
  if (msg) { msg.style.color='var(--muted)'; msg.textContent=t('rec_restoring'); }
  try {
    const { restoreFromRecoveryCode } = await import('./leaderboard.js');
    const name = await restoreFromRecoveryCode(inp.value.trim());
    if (msg) { msg.style.color='var(--green)'; msg.textContent=t('rec_restored', {name}); }
    setTimeout(() => {
      document.getElementById('recoveryModal')?.remove();
      renderXPBar();
      _refreshPlayerBadge();
      /* Fermer l'écran nom si visible + retour splash */
      goSplash();
    }, 1200);
  } catch(e) {
    if (msg) { msg.style.color='var(--red)'; msg.textContent=e.message || 'Erreur inconnue.'; }
  }
};
