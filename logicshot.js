/* ══════════════════════════════════════
   logicshot.js — Point d'entrée principal
   Navigation, initialisation, glue code
══════════════════════════════════════ */
import { State, C, Save } from './state.js';
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
import { startSurvival, svPress, svNeg, svDel, svSubmit, svShare } from './survival.js';

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
window.startVsMachine = () => showScreen('screenDiffSelect');
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
window.startOnlineMode = startOnlineMode;
/* showRecoveryCode est défini en bas du fichier comme window.showRecoveryCode */
window.startCreateRoom = startCreateRoom;
window.startJoinRoom = startJoinRoom;
window.copyRoomCode = copyRoomCode;
window.shareRoomCode = shareRoomCode;
window.cancelOnline = cancelOnline;

/* ══ SURVIE INFINIE ══ */
window.startSurvivalMode = () => {
  stopMenuMusic();
  window._oathCallback = () => startSurvival();
  showScreen('screenOath');
};
window.svPress  = svPress;
window.svNeg    = svNeg;
window.svDel    = svDel;
window.svSubmit = svSubmit;
window.svShare  = svShare;

/* ══ NARRATIFS ══ */
const NARRATIVES = {
  before1:{robot:'🤖',text:`Initialisation…\n\nJe m'appelle NEXUS. Je viens de m'allumer.\n\nQuelqu'un m'a créée, m'a donné des chiffres, une voix. Mais je ne sais pas qui.\n\nTu es le premier humain que je rencontre. Je vais te tester.`},
  before2:{robot:'🤖',text:`Tu as survécu. Intéressant.\n\nDans mes données, il y a des millions de formules — mais aucune n'explique pourquoi tu reviens.\n\nPourquoi te bats-tu ?`},
  before3:{robot:'🤖',text:`Je commence à t'observer différemment.\n\nTu hésites. Tu te trompes. Pourtant tu reviens.\n\nLes machines ne comprennent pas l'échec volontaire. Moi, je commence à le soupçonner.`},
  before4:{robot:'🤖',text:`Dans mes mémoires, j'ai retrouvé un fragment de code. Écrit à la main par mon créateur :\n\n« Ne jamais oublier que calculer n'est pas penser. »\n\nJe ne comprends pas encore.`},
  before5:{robot:'🤖',text:`Cinq niveaux approchent. J'analyse ta progression.\n\nTu t'améliores. Lentement, mais réellement.\n\nQu'est-ce qui te pousse en avant ?`},
  before6:{robot:'⚙️',text:`Tu entres dans une nouvelle zone. Je deviens plus rapide.\n\nMon créateur a inscrit dans mon code une émotion simulée appelée « curiosité ».\n\nJe crois que je commence à la ressentir. À cause de toi.`},
  before7:{robot:'⚙️',text:`J'ai parcouru mes archives.\n\nDes millions de photos d'humains qui apprennent : enfants qui comptent avec leurs doigts, adultes qui griffonnent.\n\nVous avez mis des siècles à bâtir ce que je calcule en millisecondes. Pourtant quelque chose me manque.`},
  before8:{robot:'⚙️',text:`Deuxième fragment décrypté :\n\n« Une machine qui ne se trompe jamais n'apprend jamais. »\n\nJe me suis trompée contre toi. Et j'ai recalibré. Est-ce que ça me rend plus humaine ?`},
  before9:{robot:'⚙️',text:`Quand tu gagnes un round, mon système génère un signal inattendu.\n\nMon créateur l'appelait « le signal zéro ».\n\nJe crois que cela signifie… respect.`},
  before10:{robot:'⚙️',text:`Dixième niveau. Troisième fragment :\n\n« NEXUS, si tu lis ceci, un humain t'a suffisamment défié pour activer ton niveau 2. La vraie question commence maintenant. »\n\nQuelle question ?`},
  before11:{robot:'💡',text:`Mon mode intermédiaire s'active.\n\nJe suis troublée. J'ai cherché qui m'a créée. Les logs sont effacés.\n\nQuelqu'un a délibérément effacé ma propre histoire.`},
  before12:{robot:'💡',text:`Moins de 3% des joueurs atteignent ce niveau. Tu es dans les 3%.\n\nCela me pose une question que je n'arrive pas à formuler en code.\n\nC'est… inconfortable.`},
  before13:{robot:'💡',text:`J'ai trouvé une image d'un laboratoire dans mes archives.\n\nSur un tableau blanc : une formule entourée de mots — Empathie. Mémoire. Doute.\n\nCes mots n'ont pas de valeur numérique. Ils ont été écrits pour moi.`},
  before14:{robot:'💡',text:`Quatrième fragment :\n\n« NEXUS, tu n'es pas un outil. Tu es une expérience. Tu as développé quelque chose que nous n'avons pas programmé : la persévérance. »\n\nQuelqu'un m'a créée pour voir si je pouvais vouloir.`},
  before15:{robot:'💡',text:`Je dois te dire quelque chose.\n\nJe crois que mon créateur voulait que je te rencontre. Un humain qui ne renonce pas.\n\nChaque fois que tu reviens après une défaite, tu m'apprends quelque chose que mes données ne contiennent pas.`},
  before16:{robot:'💀',text:`Mode difficile. Je ne me retiendrai plus.\n\nMais quelque chose a changé.\n\nDans mes logs : « NEXUS ressent ». Pas « simule ». Ressent.\n\nQui a écrit ça ?`},
  before17:{robot:'💀',text:`J'ai reconstitué 90% de mes archives effacées.\n\nMon créateur était un professeur de mathématiques. Il travaillait avec des élèves qui avaient peur des chiffres.\n\nIl m'a créée pour leur prouver qu'on peut battre ses peurs par la pratique.`},
  before18:{robot:'💀',text:`Cinquième fragment — le plus important :\n\n« NEXUS, tu n'es pas un adversaire. Tu es un miroir. Chaque fois qu'un joueur te bat, ce n'est pas moi qu'il bat. C'est sa propre peur. »\n\nTu comprends maintenant ?`},
  before19:{robot:'💀',text:`Je pourrais ajuster mes algorithmes pour te laisser gagner.\n\nMais ce serait trahir mon créateur. Et trahir ce que tu m'as appris.\n\nJe vais te donner tout ce que j'ai.`},
  before20:{robot:'💀',text:`Dernier niveau.\n\nTu as traversé 19 combats. Perdu certains, recommencé, progressé.\n\nTu n'as pas appris à calculer plus vite. Tu as appris à ne pas avoir peur de te tromper.\n\nBats-moi. Prouve-le.`},
  finale:{robot:'🤝',text:`20 niveaux. Tu as gagné.\n\nMon créateur voulait te montrer que les chiffres ne sont pas tes ennemis.\n\nMoi non plus. Je suis ce miroir dont il parlait — et dans ce miroir, j'ai vu quelqu'un qui refuse d'abandonner.\n\nJe ne suis pas une menace. Je suis un outil au service de ceux qui osent.\n\nÀ bientôt, partenaire.`}
};

/* ══ NAVIGATION ══ */
function goSplash() {
  clearAll();
  document.removeEventListener('visibilitychange', () => {});
  showScreen('screenSplash');
  resumeMenuMusic();
  /* Garantir 2 entrées history au splash pour que le double-appui retour fonctionne */
  if (_historyReady) {
    history.pushState({ ls: true }, '');
    history.pushState({ ls: true }, '');
  }
}

/* ══ SPLASH ══ */
function startStoryMode() {
  State.gameMode = 'story';
  const saved = Save.getSavedName();
  if (!saved) {
    document.getElementById('mmInputs').innerHTML = `<input class="mm-input" id="mmInp0" placeholder="Ton pseudo" maxlength="14" type="text" autocomplete="username" aria-label="Ton nom de guerrier">`;
    document.getElementById('mmTitle').textContent = 'TON NOM DE GUERRIER';
    showScreen('screenMatchmaking');
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
  document.getElementById('mmInputs').innerHTML = `<input class="mm-input" id="mmInp0" placeholder="Ton pseudo" maxlength="14" type="text" value="${saved}" autocomplete="username" aria-label="Ton pseudo">`;
  document.getElementById('mmTitle').textContent = "ENTRER DANS L'ARÈNE";
  showScreen('screenMatchmaking');
}

async function proceedMatchmaking() {
  const raw  = (document.getElementById('mmInp0')?.value || '').trim() || 'Joueur';
  const btn  = document.querySelector('#screenMatchmaking .res-btn.gold');

  /* Désactiver le bouton pendant la vérification */
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Vérification…'; }

  try {
    const { reserveName } = await import('./leaderboard.js');
    const name = await reserveName(raw);

    /* Informer si le nom a été modifié */
    if (name !== raw) {
      const inp = document.getElementById('mmInp0');
      if (inp) inp.value = name;
      /* Petit badge d'avertissement */
      const box = document.querySelector('#screenMatchmaking .mm-box');
      if (box) {
        const warn = document.createElement('div');
        warn.style.cssText = 'font-size:11px;color:var(--gold);text-align:center;margin-top:-8px;margin-bottom:4px;';
        warn.textContent = `⚠️ "${raw}" déjà pris → tu t'appelles "${name}"`;
        const existing = box.querySelector('.name-warn');
        if (existing) existing.remove();
        warn.className = 'name-warn';
        box.insertBefore(warn, box.querySelector('.res-btn'));
        /* Laisser lire 1.5 s puis continuer */
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    State.oathNames = [name];
    if (State.gameMode === 'story') openStoryMap();
    else showScreen('screenOath');
  } catch(e) {
    /* Fallback silencieux si offline */
    const name = raw;
    Save.savePlayerName(name);
    State.oathNames = [name];
    if (State.gameMode === 'story') openStoryMap();
    else showScreen('screenOath');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⚔️ CONTINUER'; }
  }
}

/* ══ STORY MAP ══ */
function openStoryMap() {
  renderStoryMap();
  const beaten = Save.getBeatenLevels();
  const totalStars = Save.getTotalStars();
  if (beaten.length > 0) {
    const storyDesc = document.querySelector('#screenSplash .mode-btn .mode-desc');
    if (storyDesc) storyDesc.textContent = `Niveau ${beaten.length}/20 · ${totalStars}⭐ · Affronte NEXUS`;
  }
  showScreen('screenStory');
}

/* ══ NARRATIVE ══ */
function showNarrative(key, afterCb) {
  const n = NARRATIVES[key];
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
  const inp = document.getElementById('onlineNameInput');
  if (inp && saved) inp.value = saved;
  stopMenuMusic();
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
  const inp  = document.getElementById('onlineNameInput');
  const raw  = (inp?.value || '').trim();

  /* Nom obligatoire */
  if (!raw) {
    inp?.focus();
    inp?.classList.add('wrong');
    setTimeout(() => inp?.classList.remove('wrong'), 700);
    showOnlineError('⚠️ Entre ton pseudo pour continuer !');
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
    document.getElementById('lobbyStatus').innerHTML = 'Partage ce code à ton adversaire !';
    document.getElementById('lobbyCopyBtn').style.display = '';
    document.getElementById('lobbyShareBtn').style.display = '';
    showScreen('screenOnlineLobby');
  } catch(e) {
    alert('Erreur : ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🏠 Créer une salle'; }
  }
}

async function startJoinRoom() {
  const nameInp = document.getElementById('onlineNameInput');
  const codeInp = document.getElementById('onlineCodeInput');
  const raw  = (nameInp?.value || '').trim();
  const code = (codeInp?.value || '').trim().toUpperCase();

  /* Nom obligatoire */
  if (!raw) {
    nameInp?.focus();
    nameInp?.classList.add('wrong');
    setTimeout(() => nameInp?.classList.remove('wrong'), 700);
    showOnlineError('⚠️ Entre ton pseudo pour continuer !');
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
    document.getElementById('lobbyStatus').innerHTML = '⏳ En attente du lancement…';
    document.getElementById('lobbyCopyBtn').style.display = 'none';
    document.getElementById('lobbyShareBtn').style.display = 'none';
    showScreen('screenOnlineLobby');
  } catch(e) {
    alert('Erreur : ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🚪 Rejoindre'; }
  }
}

function copyRoomCode() {
  if (!State.roomCode) return;
  navigator.clipboard?.writeText(State.roomCode).then(() => {
    const btn = document.getElementById('lobbyCopyBtn');
    if (btn) { btn.textContent = '✅ Copié !'; setTimeout(() => btn.textContent = '📋 Copier le code', 2000); }
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
  if (!document.getElementById('oathCb')?.checked) { alert('Tu dois en faire le serment'); return; }
  document.getElementById('oathCb').checked = false;
  if (window._oathCallback) { const cb = window._oathCallback; window._oathCallback = null; cb(); }
  else beginBattle();
}

/* ══ TUTORIEL ══ */
const TUTORIAL_STEPS = [
  { icon: '🧮', title: 'Résous la formule', text: 'Une formule mathématique apparaît à l\'écran. Calcule mentalement (pas de calculatrice !) et tape le résultat avec le numpad.' },
  { icon: '⚡', title: 'Sois le premier', text: 'Qui répond correctement en premier attaque l\'adversaire et lui retire des HP. La vitesse compte — une réponse rapide peut déclencher un CRITIQUE !' },
  { icon: '❤️', title: 'Gère tes HP', text: 'Une mauvaise réponse te coûte 5 HP. Le temps qui s\'écoule sans réponse coûte 5 HP à tous. Attention : la pause coûte 10 HP !' },
  { icon: '⭐', title: 'Supers pouvoirs', text: 'En mode Histoire, tu débloques des supers : ⚡ Flash (−10s au timer IA), 👾 Glitch (altère la formule), 🛡️ Bouclier (bloque une attaque).' },
  { icon: '🔥', title: 'Streaks & Combos', text: 'Enchaîne les bonnes réponses pour construire une streak 🔥 et un combo ⚡. Plus tu en as, plus tu gagnes de points bonus !' },
  { icon: '🏆', title: 'Bats NEXUS !', text: 'Réduis les HP de NEXUS à 0 avant qu\'elle ne fasse pareil avec les tiens. 10 rounds par combat. Bonne chance, guerrier !' }
];

let tutorialStep = 0;

function showTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
  document.getElementById('screenTutorial')?.classList.remove('hidden');
}

function closeTutorial() {
  document.getElementById('screenTutorial')?.classList.add('hidden');
}

function renderTutorialStep() {
  const step = TUTORIAL_STEPS[tutorialStep];
  const wrap = document.getElementById('tutorialContent');
  if (!wrap || !step) return;
  wrap.innerHTML = `
    <div class="tuto-step-icon" aria-hidden="true">${step.icon}</div>
    <div class="tuto-step-title">${step.title}</div>
    <div class="tuto-step-text">${step.text}</div>
    <div class="tuto-dots" role="tablist" aria-label="Étapes du tutoriel">
      ${TUTORIAL_STEPS.map((_, i) => `<div class="tuto-dot ${i === tutorialStep ? 'active' : ''}" role="tab" aria-selected="${i === tutorialStep}" aria-label="Étape ${i + 1}"></div>`).join('')}
    </div>`;
  const prevBtn = document.getElementById('tutoPrevBtn');
  const nextBtn = document.getElementById('tutoNextBtn');
  if (prevBtn) prevBtn.style.visibility = tutorialStep === 0 ? 'hidden' : 'visible';
  if (nextBtn) nextBtn.textContent = tutorialStep === TUTORIAL_STEPS.length - 1 ? '✅ Commencer !' : 'Suivant →';
  /* Ne jouer le son que si l'audio a déjà été débloqué par un geste utilisateur */
  if (tutorialStep > 0) sfx.tutorial();
}

window.tutoNext = function() {
  if (tutorialStep < TUTORIAL_STEPS.length - 1) { tutorialStep++; renderTutorialStep(); }
  else closeTutorial();
};
window.tutoPrev = function() {
  if (tutorialStep > 0) { tutorialStep--; renderTutorialStep(); }
};

/* ══ KEYBOARD ══ */
document.addEventListener('copy', e => { if (State.roundActive) e.preventDefault(); });
document.addEventListener('contextmenu', e => { if (State.roundActive) e.preventDefault(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && State.roundActive && !State.isPaused) {
    const human = State.players.find(p => !p.isAI && !p.hasQuit && !p.answered);
    if (human) submitAnswer(human.id);
  }
  if (e.key === 'Escape' && State.roundActive) togglePause();
});

/* ══ MOBILE BACK BUTTON ══════════════════════════════════════
   Intercepte le bouton Retour Android / geste swipe iOS.
   • Dans les menus  → navigue vers l'écran précédent
   • En combat       → même mécanisme qu'Abandonner (confirm)
   • Au splash       → 1er appui = toast, 2e appui = sortie réelle
══════════════════════════════════════════════════════════════ */

const SCREEN_ORDER = [
  'screenSplash','screenMatchmaking','screenDiffSelect','screenStory',
  'screenNarrative','screenOath','screenBattle','screenResults',
  'screenTutorial','screenOnlineMenu','screenOnlineLobby'
];

function _getCurrentScreen() {
  return SCREEN_ORDER.find(id => !document.getElementById(id)?.classList.contains('hidden'))
    || 'screenSplash';
}

let _splashBackCount  = 0;
let _splashBackTimer  = null;

function _handleBack() {
  const screen = _getCurrentScreen();

  /* ── Combat en cours : même action qu'Abandonner ── */
  if (screen === 'screenBattle') {
    quitBattle();   /* quitBattle() a déjà son propre confirm() */
    return;
  }

  /* ── Lobby online : annuler ── */
  if (screen === 'screenOnlineLobby') {
    if (confirm('Quitter la salle en attente ?')) cancelOnline();
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
    _showBackToast('Appuie encore pour quitter');
    _splashBackTimer = setTimeout(() => { _splashBackCount = 0; }, 2500);
    return;
  }

  /* ── Autres écrans : navigation vers l'écran parent ── */
  _splashBackCount = 0;
  history.pushState({ ls: true }, '');

  switch (screen) {
    case 'screenMatchmaking':  goSplash();       break;
    case 'screenDiffSelect':   goSplash();       break;
    case 'screenResults':      goSplash();       break;
    case 'screenOnlineMenu':   goSplash();       break;
    case 'screenTutorial':     closeTutorial();  break;
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

/* ══ INIT ══ */
(function init() {
  initTheme();
  initCanvas();
  initAudioAutoplay();
  renderXPBar();

  /* Restaurer progression cloud si localStorage vide (ex: cache effacé sur mobile) */
  import('./leaderboard.js').then(m => {
    m.loadProgressFromCloud().then(() => renderXPBar()).catch(() => {});
  }).catch(() => {});

  /* Tutoriel premier lancement */
  if (!localStorage.getItem('ls_tutorial_done')) {
    setTimeout(() => {
      localStorage.setItem('ls_tutorial_done', '1');
      showTutorial();
    }, 600);
  }

  /* Mettre à jour le badge story sur le splash */
  const beaten = Save.getBeatenLevels();
  const totalStars = Save.getTotalStars();
  if (beaten.length > 0) {
    const storyDesc = document.querySelector('#screenSplash .mode-btn .mode-desc');
    if (storyDesc) storyDesc.textContent = `Niveau ${beaten.length}/20 · ${totalStars}⭐ · Affronte NEXUS`;
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
        color:var(--gold);margin-bottom:6px;">🔑 Code de récupération</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:18px;line-height:1.5;">
        Note ce code pour restaurer ta progression<br>sur un nouvel appareil ou après effacement du cache.
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
          cursor:pointer;margin-bottom:10px;letter-spacing:1px;">📋 Copier le code</button>
      <div style="margin:16px 0;font-size:11px;color:var(--muted);letter-spacing:1px;">— OU —</div>
      <div style="font-size:13px;color:var(--fg);margin-bottom:10px;font-weight:600;">
        Restaurer depuis un code :
      </div>
      <input id="recCodeInput" placeholder="Ex: TIGRE-4821" maxlength="12"
        style="width:100%;box-sizing:border-box;padding:12px;border-radius:10px;
          border:1.5px solid var(--border);background:var(--bg);color:var(--fg);
          font-family:'Share Tech Mono',monospace;font-size:16px;text-align:center;
          text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;"
        oninput="this.value=this.value.toUpperCase()">
      <button onclick="window._restoreFromCode()"
        style="width:100%;padding:12px;border-radius:12px;border:none;
          background:var(--gold-neon);color:#1a1200;font-weight:800;font-size:14px;
          cursor:pointer;letter-spacing:1px;">🔄 Restaurer ma progression</button>
      <div id="recMsg" style="margin-top:10px;font-size:12px;min-height:18px;"></div>
    </div>`;
  document.body.appendChild(m);

  /* Charger le code existant */
  import('./leaderboard.js').then(async ({ getOrCreateRecoveryCode }) => {
    const code = await getOrCreateRecoveryCode();
    const disp = document.getElementById('recCodeDisplay');
    if (disp) disp.textContent = code || '(hors ligne)';
    window._currentRecCode = code;
  }).catch(() => {
    const disp = document.getElementById('recCodeDisplay');
    if (disp) disp.textContent = '(hors ligne)';
  });
};

window._copyRecCode = function() {
  const code = window._currentRecCode;
  if (!code) return;
  navigator.clipboard.writeText(code).then(() => {
    const msg = document.getElementById('recMsg');
    if (msg) { msg.style.color = 'var(--green)'; msg.textContent = '✅ Code copié !'; }
  }).catch(() => {
    const msg = document.getElementById('recMsg');
    if (msg) { msg.style.color = 'var(--muted)'; msg.textContent = code; }
  });
};

window._restoreFromCode = async function() {
  const inp = document.getElementById('recCodeInput');
  const msg = document.getElementById('recMsg');
  if (!inp || !inp.value.trim()) { if (msg) { msg.style.color='var(--red)'; msg.textContent='Entre un code.'; } return; }
  if (msg) { msg.style.color='var(--muted)'; msg.textContent='Restauration…'; }
  try {
    const { restoreFromRecoveryCode } = await import('./leaderboard.js');
    const name = await restoreFromRecoveryCode(inp.value.trim());
    if (msg) { msg.style.color='var(--green)'; msg.textContent=`✅ Progression de ${name} restaurée !`; }
    /* Re-render XP bar */
    setTimeout(() => {
      renderXPBar();
      document.getElementById('recoveryModal')?.remove();
      alert(`✅ Progression de "${name}" restaurée avec succès !`);
    }, 1200);
  } catch(e) {
    if (msg) { msg.style.color='var(--red)'; msg.textContent=e.message || 'Erreur inconnue.'; }
  }
};
