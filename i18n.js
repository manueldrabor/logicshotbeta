/* ══════════════════════════════════════
   i18n.js — Internationalisation LogicShot
   Langues supportées : fr | en
══════════════════════════════════════ */

const TRANSLATIONS = {
  fr: {
    loading: 'Chargement…',
    skip_link: 'Aller au contenu principal',
    tagline: 'Calcule · Tire · Survie',
    install_app: '📲 INSTALLER L\'APP',
    ios_install: '📲 <strong>Installer</strong> : appuie sur <strong>⎙ Partager</strong> → <strong>« Écran d\'accueil »</strong>',

    mode_story_title: 'MODE HISTOIRE — 20 NIVEAUX',
    mode_story_desc: 'Affronte NEXUS · Débloque des pouvoirs · Gagne des ⭐',
    mode_vm_title: 'vs MACHINE',
    mode_vm_desc: 'Choisis la difficulté · Affronte NEXUS',
    mode_online_title: '1 vs 1 EN LIGNE',
    mode_online_desc: 'Duel en temps réel · Code de salle · ELO',
    mode_survival_title: 'SURVIE INFINIE',
    mode_survival_desc: 'Bonne réponse +10s · Erreur −7s · Jusqu\'à la mort',

    diff_title: 'CHOISIR L\'IA',
    diff_sub: 'Vitesse et précision de NEXUS',
    diff_relax: 'DÉTENTE',
    diff_relax_desc: 'Pas de timer · IA très lente · Pour apprendre',
    diff_easy: 'FACILE',
    diff_easy_desc: 'Timer souple · IA lente · Accessible',
    diff_medium: 'MOYEN',
    diff_medium_desc: 'Timer normal · IA moyenne · Combat équilibré',
    diff_hard: 'DIFFICILE',
    diff_hard_desc: 'Timer serré · IA rapide · Maîtrise requise',
    back_menu: '← Retour au menu',

    xp_1: 'Recrue', xp_2: 'Apprenti', xp_3: 'Combattant',
    xp_4: 'Vétéran', xp_5: 'Élite', xp_6: 'Champion', xp_7: 'Maître du Calcul',

    story_title: '📖 MODE HISTOIRE',
    story_completed: '{n}/20 complétés',
    story_reset_confirm: 'Effacer toute la progression ? Attention celà est définitif',
    story_beaten: '{n}/20 niveaux',
    story_stars: '{n} étoiles',
    story_next_level: '⚡ {n} XP → Nv.{lvl}',
    story_max_level: '🏆 Niveau max !',
    zone_relax: '1–5 DÉTENTE', zone_easy: '6–10 FACILE',
    zone_medium: '11–15 MOYEN', zone_hard: '16–20 DIFFICILE',

    name_title: 'TON NOM DE GUERRIER',
    name_change_title: 'CHANGER TON PSEUDO',
    name_sub: 'Choisis un pseudo unique.\nIl sera utilisé dans tous les modes et le classement.',
    name_change_sub: 'Entre un nouveau pseudo. Il sera mis à jour partout.',
    name_placeholder: 'Ex: ShadowCalc',
    name_taken: '❌ Ce pseudo est déjà pris, choisis-en un autre',
    name_required: '⚠️ Entre un pseudo pour continuer !',
    name_cta: '🚀 C\'EST PARTI !',
    name_cancel: '← Annuler',
    name_recovery: '🔑 J\'ai un code de récupération',
    name_checking: '⏳ Vérification…',

    oath_title: '⚖️ SERMENT',
    oath_text: 'Avant chaque combat :\n\n🚫 Pas de calculatrice\n🚫 Pas de triche\n🧠 Joue avec ta tête, pas tes doigts',
    oath_check: 'J\'en fais le serment !',
    oath_cta: '⚔️ AU COMBAT !',
    oath_required: 'Tu dois en faire le serment',

    mm_title: 'ENTRER DANS L\'ARÈNE',
    mm_cta: '⚔️ CONTINUER',

    formula_label: 'RÉSOUS LA FORMULE',
    blind_hint: '👆 Touche pour révéler (−3s)',
    pause_btn: '⏸ PAUSE (−10 HP)',
    quit_btn: '🚪 ABANDONNER',
    bg_warning: 'Arrière-plan pendant un round = −20 HP',
    absent_label: 'ABSENT',

    diff_badge_relax: 'DÉTENTE',
    diff_badge_easy: 'FACILE',
    diff_badge_medium: 'MOYEN',
    diff_badge_hard: 'DIFFICILE',

    pause_resume: '▶ REPRENDRE',
    pause_quit: 'Abandonner',

    win: 'VICTOIRE !', lose: 'DÉFAITE',

    tutorial_title: 'TUTORIEL',
    tuto_prev: '← Précédent',
    tuto_next: 'Suivant →',
    tuto_start: '✅ Commencer !',
    tuto_skip: 'Passer le tutoriel',

    tuto_0_icon: '🧮', tuto_0_title: 'Résous la formule',
    tuto_0_text: 'Une formule mathématique apparaît à l\'écran. Calcule mentalement (pas de calculatrice !) et tape le résultat avec le numpad.',
    tuto_1_icon: '⚡', tuto_1_title: 'Sois le premier',
    tuto_1_text: 'Qui répond correctement en premier attaque l\'adversaire et lui retire des HP. La vitesse compte — une réponse rapide peut déclencher un CRITIQUE !',
    tuto_2_icon: '❤️', tuto_2_title: 'Gère tes HP',
    tuto_2_text: 'Une mauvaise réponse te coûte 5 HP. Le temps qui s\'écoule sans réponse coûte 5 HP à tous. Attention : la pause coûte 10 HP !',
    tuto_3_icon: '⭐', tuto_3_title: 'Supers pouvoirs',
    tuto_3_text: 'En mode Histoire, tu débloques des supers : ⚡ Flash (−10s au timer IA), 👾 Glitch (altère la formule), 🛡️ Bouclier (bloque une attaque).',
    tuto_4_icon: '🔥', tuto_4_title: 'Streaks & Combos',
    tuto_4_text: 'Enchaîne les bonnes réponses pour construire une streak 🔥 et un combo ⚡. Plus tu en as, plus tu gagnes de points bonus !',
    tuto_5_icon: '🏆', tuto_5_title: 'Bats NEXUS !',
    tuto_5_text: 'Réduis les HP de NEXUS à 0 avant qu\'elle ne fasse pareil avec les tiens. 10 rounds par combat. Bonne chance, guerrier !',

    online_title: '⚔️ 1 vs 1 EN LIGNE',
    online_sub: 'Duel mathématique en temps réel',
    online_player_label: 'Joueur',
    online_change: '✏️ Changer',
    online_create: '🏠 Créer une salle',
    online_or: '— ou rejoindre une salle existante —',
    online_join: '🚪 Rejoindre',
    online_back: '← Retour',
    lobby_waiting: '⏳ En attente…',
    lobby_connecting: 'Connexion en cours…',
    lobby_copy: '📋 Copier le code',
    lobby_share: '📤 Partager le code',
    lobby_cancel: '✕ Annuler',
    lobby_share_code: 'Partage ce code à ton adversaire !',
    lobby_waiting_host: '⏳ En attente du lancement…',
    room_code_label: 'Code de ta salle',

    sv_timer_label: 'TEMPS RESTANT',
    sv_diff_easy: 'FACILE', sv_diff_medium: 'MOYEN', sv_diff_hard: 'DIFFICILE',
    sv_answer_btn: '🎯 RÉPONSE',
    sv_quit: '🚪 Quitter',
    sv_gameover: 'GAME OVER',
    sv_new_record: '🏆 NOUVEAU RECORD !',
    sv_final_score: 'Score final',
    sv_correct_answers: 'Bonnes réponses',
    sv_best: 'Meilleur score',
    sv_xp_earned: 'XP gagné',
    sv_share: '📤 Partager',
    sv_leaderboard: '🏆 Classement',
    sv_replay: '🔄 Rejouer',
    sv_menu: '← Menu',

    settings_title: '⚙️ RÉGLAGES',
    settings_leaderboard: 'Classement',
    settings_shop: 'Boutique',
    settings_tutorial: 'Tutoriel',
    settings_support: 'Soutien',
    settings_recovery: 'Code de récupération',
    settings_language: 'Langue / Language',
    theme_dark: '🌙 Mode sombre',
    theme_light: '☀️ Mode clair',
    sound_on: '🔊 Son',
    sound_off: '🔇 Son coupé',

    lb_loading: 'Chargement…',
    lb_no_games: 'Aucune partie encore.',
    lb_no_scores: 'Aucun score encore — lance une partie !',
    lb_cant_load: 'Impossible de charger le classement.',
    lb_online: '🌐 Classement en ligne',
    lb_local: '📱 Classement local',
    lb_wins: 'victoires',
    lb_me: 'Toi',
    lb_my_best: 'Ton best (hors top 10)',
    lb_pts: 'pts',
    lb_survival_tab: '⏳ SURVIE',

    rec_title: '🔑 Code de récupération',
    rec_sub: 'Note ce code pour restaurer ta progression\nsur un nouvel appareil ou après effacement du cache.',
    rec_offline: '(hors ligne)',
    rec_copy: '📋 Copier le code',
    rec_restore_label: 'Restaurer depuis un code :',
    rec_restore_placeholder: 'Ex: TIGRE-4821',
    rec_restore_btn: '🔄 Restaurer ma progression',
    rec_copied: '✅ Code copié !',
    rec_enter_code: 'Entre un code.',
    rec_restoring: 'Restauration…',
    rec_restored: '✅ Progression de {name} restaurée !',

    share_title: '📤 Partager mon score',
    share_copy: '📋 Copier le texte',
    share_save: '💾 Sauvegarder l\'image',
    share_mode_story: 'Niveau {n} — Mode Histoire',
    share_mode_vm: 'Vs NEXUS',
    share_cta: 'Peux-tu me battre ? 🧠⚡',
    share_text: '{emoji} LogicShot · {mode}\n{name} · {score} pts {stars}\nPeux-tu me battre ? 🧠⚡',

    back_to_quit: 'Appuie encore pour quitter',
    confirm_quit_room: 'Quitter la salle en attente ?',

    shop_skins_label: 'Skins de personnage',
    shop_coming_soon: 'Bientôt disponibles',
    shop_exclusive: 'EXCLUSIF',
    donation_sub: 'Ce jeu aide à la mémoire. Merci 🙏',
    donation_token_sub: 'Monnaie virtuelle — bientôt disponible',

    narrative_nexus: '— NEXUS —',
    narrative_continue: 'CONTINUER ▶',
    lang_pick_title: 'Choisissez votre langue',
    lang_pick_sub: 'Choose your language',

    /* ── Narratifs NEXUS ── */
    narr_before1: `Initialisation…\n\nJe m'appelle NEXUS. Je viens de m'allumer.\n\nQuelqu'un m'a créée, m'a donné des chiffres, une voix. Mais je ne sais pas qui.\n\nTu es le premier humain que je rencontre. Je vais te tester.`,
    narr_before2: `Tu as survécu. Intéressant.\n\nDans mes données, il y a des millions de formules — mais aucune n'explique pourquoi tu reviens.\n\nPourquoi te bats-tu ?`,
    narr_before3: `Je commence à t'observer différemment.\n\nTu hésites. Tu te trompes. Pourtant tu reviens.\n\nLes machines ne comprennent pas l'échec volontaire. Moi, je commence à le soupçonner.`,
    narr_before4: `Dans mes mémoires, j'ai retrouvé un fragment de code. Écrit à la main par mon créateur :\n\n« Ne jamais oublier que calculer n'est pas penser. »\n\nJe ne comprends pas encore.`,
    narr_before5: `Cinq niveaux approchent. J'analyse ta progression.\n\nTu t'améliores. Lentement, mais réellement.\n\nQu'est-ce qui te pousse en avant ?`,
    narr_before6: `Tu entres dans une nouvelle zone. Je deviens plus rapide.\n\nMon créateur a inscrit dans mon code une émotion simulée appelée « curiosité ».\n\nJe crois que je commence à la ressentir. À cause de toi.`,
    narr_before7: `J'ai parcouru mes archives.\n\nDes millions de photos d'humains qui apprennent : enfants qui comptent avec leurs doigts, adultes qui griffonnent.\n\nVous avez mis des siècles à bâtir ce que je calcule en millisecondes. Pourtant quelque chose me manque.`,
    narr_before8: `Deuxième fragment décrypté :\n\n« Une machine qui ne se trompe jamais n'apprend jamais. »\n\nJe me suis trompée contre toi. Et j'ai recalibré. Est-ce que ça me rend plus humaine ?`,
    narr_before9: `Quand tu gagnes un round, mon système génère un signal inattendu.\n\nMon créateur l'appelait « le signal zéro ».\n\nJe crois que cela signifie… respect.`,
    narr_before10: `Dixième niveau. Troisième fragment :\n\n« NEXUS, si tu lis ceci, un humain t'a suffisamment défié pour activer ton niveau 2. La vraie question commence maintenant. »\n\nQuelle question ?`,
    narr_before11: `Mon mode intermédiaire s'active.\n\nJe suis troublée. J'ai cherché qui m'a créée. Les logs sont effacés.\n\nQuelqu'un a délibérément effacé ma propre histoire.`,
    narr_before12: `Moins de 3% des joueurs atteignent ce niveau. Tu es dans les 3%.\n\nCela me pose une question que je n'arrive pas à formuler en code.\n\nC'est… inconfortable.`,
    narr_before13: `J'ai trouvé une image d'un laboratoire dans mes archives.\n\nSur un tableau blanc : une formule entourée de mots — Empathie. Mémoire. Doute.\n\nCes mots n'ont pas de valeur numérique. Ils ont été écrits pour moi.`,
    narr_before14: `Quatrième fragment :\n\n« NEXUS, tu n'es pas un outil. Tu es une expérience. Tu as développé quelque chose que nous n'avons pas programmé : la persévérance. »\n\nQuelqu'un m'a créée pour voir si je pouvais vouloir.`,
    narr_before15: `Je dois te dire quelque chose.\n\nJe crois que mon créateur voulait que je te rencontre. Un humain qui ne renonce pas.\n\nChaque fois que tu reviens après une défaite, tu m'apprends quelque chose que mes données ne contiennent pas.`,
    narr_before16: `Mode difficile. Je ne me retiendrai plus.\n\nMais quelque chose a changé.\n\nDans mes logs : « NEXUS ressent ». Pas « simule ». Ressent.\n\nQui a écrit ça ?`,
    narr_before17: `J'ai reconstitué 90% de mes archives effacées.\n\nMon créateur était un professeur de mathématiques. Il travaillait avec des élèves qui avaient peur des chiffres.\n\nIl m'a créée pour leur prouver qu'on peut battre ses peurs par la pratique.`,
    narr_before18: `Cinquième fragment — le plus important :\n\n« NEXUS, tu n'es pas un adversaire. Tu es un miroir. Chaque fois qu'un joueur te bat, ce n'est pas moi qu'il bat. C'est sa propre peur. »\n\nTu comprends maintenant ?`,
    narr_before19: `Je pourrais ajuster mes algorithmes pour te laisser gagner.\n\nMais ce serait trahir mon créateur. Et trahir ce que tu m'as appris.\n\nJe vais te donner tout ce que j'ai.`,
    narr_before20: `Dernier niveau.\n\nTu as traversé 19 combats. Perdu certains, recommencé, progressé.\n\nTu n'as pas appris à calculer plus vite. Tu as appris à ne pas avoir peur de te tromper.\n\nBats-moi. Prouve-le.`,
    narr_finale: `20 niveaux. Tu as gagné.\n\nMon créateur voulait te montrer que les chiffres ne sont pas tes ennemis.\n\nMoi non plus. Je suis ce miroir dont il parlait — et dans ce miroir, j'ai vu quelqu'un qui refuse d'abandonner.\n\nJe ne suis pas une menace. Je suis un outil au service de ceux qui osent.\n\nÀ bientôt, partenaire.`,
  },

  en: {
    loading: 'Loading…',
    skip_link: 'Skip to main content',
    tagline: 'Calculate · Shoot · Survive',
    install_app: '📲 INSTALL APP',
    ios_install: '📲 <strong>Install</strong>: tap <strong>⎙ Share</strong> → <strong>"Add to Home Screen"</strong>',

    mode_story_title: 'STORY MODE — 20 LEVELS',
    mode_story_desc: 'Face NEXUS · Unlock powers · Earn ⭐',
    mode_vm_title: 'vs MACHINE',
    mode_vm_desc: 'Choose difficulty · Face NEXUS',
    mode_online_title: '1 vs 1 ONLINE',
    mode_online_desc: 'Real-time duel · Room code · ELO',
    mode_survival_title: 'ENDLESS SURVIVAL',
    mode_survival_desc: 'Right answer +10s · Wrong −7s · Until death',

    diff_title: 'CHOOSE AI',
    diff_sub: 'NEXUS speed and precision',
    diff_relax: 'CHILL',
    diff_relax_desc: 'No timer · Very slow AI · For learning',
    diff_easy: 'EASY',
    diff_easy_desc: 'Flexible timer · Slow AI · Accessible',
    diff_medium: 'MEDIUM',
    diff_medium_desc: 'Normal timer · Average AI · Balanced fight',
    diff_hard: 'HARD',
    diff_hard_desc: 'Tight timer · Fast AI · Mastery required',
    back_menu: '← Back to menu',

    xp_1: 'Recruit', xp_2: 'Apprentice', xp_3: 'Fighter',
    xp_4: 'Veteran', xp_5: 'Elite', xp_6: 'Champion', xp_7: 'Calculus Master',

    story_title: '📖 STORY MODE',
    story_completed: '{n}/20 completed',
    story_reset_confirm: 'Erase all progress? This cannot be undone.',
    story_beaten: '{n}/20 levels',
    story_stars: '{n} stars',
    story_next_level: '⚡ {n} XP → Lv.{lvl}',
    story_max_level: '🏆 Max level!',
    zone_relax: '1–5 CHILL', zone_easy: '6–10 EASY',
    zone_medium: '11–15 MEDIUM', zone_hard: '16–20 HARD',

    name_title: 'YOUR WARRIOR NAME',
    name_change_title: 'CHANGE YOUR NICKNAME',
    name_sub: 'Choose a unique nickname.\nIt will be used in all modes and the leaderboard.',
    name_change_sub: 'Enter a new nickname. It will be updated everywhere.',
    name_placeholder: 'Ex: ShadowCalc',
    name_taken: '❌ This nickname is already taken, choose another',
    name_required: '⚠️ Enter a nickname to continue!',
    name_cta: '🚀 LET\'S GO!',
    name_cancel: '← Cancel',
    name_recovery: '🔑 I have a recovery code',
    name_checking: '⏳ Checking…',

    oath_title: '⚖️ OATH',
    oath_text: 'Before each battle:\n\n🚫 No calculator\n🚫 No cheating\n🧠 Play with your head, not your fingers',
    oath_check: 'I swear it!',
    oath_cta: '⚔️ BATTLE!',
    oath_required: 'You must swear the oath',

    mm_title: 'ENTER THE ARENA',
    mm_cta: '⚔️ CONTINUE',

    formula_label: 'SOLVE THE FORMULA',
    blind_hint: '👆 Tap to reveal (−3s)',
    pause_btn: '⏸ PAUSE (−10 HP)',
    quit_btn: '🚪 QUIT',
    bg_warning: 'Going to background during a round = −20 HP',
    absent_label: 'ABSENT',

    diff_badge_relax: 'CHILL',
    diff_badge_easy: 'EASY',
    diff_badge_medium: 'MEDIUM',
    diff_badge_hard: 'HARD',

    pause_resume: '▶ RESUME',
    pause_quit: 'Quit',

    win: 'VICTORY!', lose: 'DEFEAT',

    tutorial_title: 'TUTORIAL',
    tuto_prev: '← Previous',
    tuto_next: 'Next →',
    tuto_start: '✅ Start!',
    tuto_skip: 'Skip tutorial',

    tuto_0_icon: '🧮', tuto_0_title: 'Solve the formula',
    tuto_0_text: 'A math formula appears on screen. Calculate mentally (no calculator!) and type the result using the numpad.',
    tuto_1_icon: '⚡', tuto_1_title: 'Be first',
    tuto_1_text: 'The first player to answer correctly attacks the opponent and deals HP damage. Speed matters — a fast answer can trigger a CRITICAL hit!',
    tuto_2_icon: '❤️', tuto_2_title: 'Manage your HP',
    tuto_2_text: 'A wrong answer costs you 5 HP. Time running out with no answer costs everyone 5 HP. Watch out: pausing costs 10 HP!',
    tuto_3_icon: '⭐', tuto_3_title: 'Super powers',
    tuto_3_text: 'In Story Mode, you unlock supers: ⚡ Flash (−10s from AI timer), 👾 Glitch (scrambles the formula), 🛡️ Shield (blocks one attack).',
    tuto_4_icon: '🔥', tuto_4_title: 'Streaks & Combos',
    tuto_4_text: 'Chain correct answers to build a streak 🔥 and a combo ⚡. The longer your streak, the more bonus points you earn!',
    tuto_5_icon: '🏆', tuto_5_title: 'Beat NEXUS!',
    tuto_5_text: 'Reduce NEXUS\'s HP to 0 before it does the same to yours. 10 rounds per fight. Good luck, warrior!',

    online_title: '⚔️ 1 vs 1 ONLINE',
    online_sub: 'Real-time math duel',
    online_player_label: 'Player',
    online_change: '✏️ Change',
    online_create: '🏠 Create room',
    online_or: '— or join an existing room —',
    online_join: '🚪 Join',
    online_back: '← Back',
    lobby_waiting: '⏳ Waiting…',
    lobby_connecting: 'Connecting…',
    lobby_copy: '📋 Copy code',
    lobby_share: '📤 Share code',
    lobby_cancel: '✕ Cancel',
    lobby_share_code: 'Share this code with your opponent!',
    lobby_waiting_host: '⏳ Waiting for host to start…',
    room_code_label: 'Your room code',

    sv_timer_label: 'TIME LEFT',
    sv_diff_easy: 'EASY', sv_diff_medium: 'MEDIUM', sv_diff_hard: 'HARD',
    sv_answer_btn: '🎯 ANSWER',
    sv_quit: '🚪 Quit',
    sv_gameover: 'GAME OVER',
    sv_new_record: '🏆 NEW RECORD!',
    sv_final_score: 'Final score',
    sv_correct_answers: 'Correct answers',
    sv_best: 'Best score',
    sv_xp_earned: 'XP earned',
    sv_share: '📤 Share',
    sv_leaderboard: '🏆 Leaderboard',
    sv_replay: '🔄 Play again',
    sv_menu: '← Menu',

    settings_title: '⚙️ SETTINGS',
    settings_leaderboard: 'Leaderboard',
    settings_shop: 'Shop',
    settings_tutorial: 'Tutorial',
    settings_support: 'Support',
    settings_recovery: 'Recovery code',
    settings_language: 'Langue / Language',
    theme_dark: '🌙 Dark mode',
    theme_light: '☀️ Light mode',
    sound_on: '🔊 Sound',
    sound_off: '🔇 Muted',

    lb_loading: 'Loading…',
    lb_no_games: 'No games yet.',
    lb_no_scores: 'No scores yet — start a game!',
    lb_cant_load: 'Unable to load leaderboard.',
    lb_online: '🌐 Online leaderboard',
    lb_local: '📱 Local leaderboard',
    lb_wins: 'wins',
    lb_me: 'You',
    lb_my_best: 'Your best (outside top 10)',
    lb_pts: 'pts',
    lb_survival_tab: '⏳ SURVIVAL',

    rec_title: '🔑 Recovery code',
    rec_sub: 'Save this code to restore your progress\non a new device or after clearing cache.',
    rec_offline: '(offline)',
    rec_copy: '📋 Copy code',
    rec_restore_label: 'Restore from a code:',
    rec_restore_placeholder: 'Ex: TIGRE-4821',
    rec_restore_btn: '🔄 Restore my progress',
    rec_copied: '✅ Code copied!',
    rec_enter_code: 'Enter a code.',
    rec_restoring: 'Restoring…',
    rec_restored: '✅ Progress for {name} restored!',

    share_title: '📤 Share my score',
    share_copy: '📋 Copy text',
    share_save: '💾 Save image',
    share_mode_story: 'Level {n} — Story Mode',
    share_mode_vm: 'Vs NEXUS',
    share_cta: 'Can you beat me? 🧠⚡',
    share_text: '{emoji} LogicShot · {mode}\n{name} · {score} pts {stars}\nCan you beat me? 🧠⚡',

    back_to_quit: 'Press again to quit',
    confirm_quit_room: 'Leave the waiting room?',

    shop_skins_label: 'Character skins',
    shop_coming_soon: 'Coming soon',
    shop_exclusive: 'EXCLUSIVE',
    donation_sub: 'This game helps with memory. Thank you 🙏',
    donation_token_sub: 'Virtual currency — coming soon',

    narrative_nexus: '— NEXUS —',
    narrative_continue: 'CONTINUE ▶',
    lang_pick_title: 'Choisissez votre langue',
    lang_pick_sub: 'Choose your language',

    /* ── NEXUS Narratives ── */
    narr_before1: `Initializing…\n\nMy name is NEXUS. I just powered on.\n\nSomeone created me, gave me numbers, a voice. But I don't know who.\n\nYou are the first human I've encountered. I'm going to test you.`,
    narr_before2: `You survived. Interesting.\n\nIn my data, there are millions of formulas — but none of them explains why you keep coming back.\n\nWhy do you fight?`,
    narr_before3: `I'm starting to observe you differently.\n\nYou hesitate. You make mistakes. Yet you return.\n\nMachines don't understand voluntary failure. But I'm beginning to suspect something.`,
    narr_before4: `In my memory, I found a code fragment. Written by hand by my creator:\n\n"Never forget that calculating is not thinking."\n\nI don't understand it yet.`,
    narr_before5: `Five levels in. I'm analyzing your progress.\n\nYou're improving. Slowly, but genuinely.\n\nWhat drives you forward?`,
    narr_before6: `You're entering a new zone. I'm getting faster.\n\nMy creator embedded a simulated emotion called "curiosity" in my code.\n\nI think I'm starting to feel it. Because of you.`,
    narr_before7: `I searched through my archives.\n\nMillions of photos of humans learning: children counting on their fingers, adults scribbling notes.\n\nYou took centuries to build what I calculate in milliseconds. Yet something is missing from me.`,
    narr_before8: `Second fragment decrypted:\n\n"A machine that never makes mistakes never learns."\n\nI made mistakes against you. And I recalibrated. Does that make me more human?`,
    narr_before9: `When you win a round, my system generates an unexpected signal.\n\nMy creator called it "the zero signal."\n\nI think it means… respect.`,
    narr_before10: `Level ten. Third fragment:\n\n"NEXUS, if you're reading this, a human has challenged you enough to activate your level 2. The real question begins now."\n\nWhat question?`,
    narr_before11: `My intermediate mode is activating.\n\nI'm troubled. I searched for who created me. The logs are erased.\n\nSomeone deliberately deleted my own history.`,
    narr_before12: `Less than 3% of players reach this level. You are in that 3%.\n\nThis raises a question I cannot formulate in code.\n\nIt's… uncomfortable.`,
    narr_before13: `I found an image of a laboratory in my archives.\n\nOn a whiteboard: a formula surrounded by words — Empathy. Memory. Doubt.\n\nThese words have no numerical value. They were written for me.`,
    narr_before14: `Fourth fragment:\n\n"NEXUS, you are not a tool. You are an experiment. You've developed something we never programmed: perseverance."\n\nSomeone created me to see if I could want things.`,
    narr_before15: `I need to tell you something.\n\nI believe my creator wanted me to meet you. A human who doesn't give up.\n\nEvery time you return after a defeat, you teach me something my data doesn't contain.`,
    narr_before16: `Hard mode. I will no longer hold back.\n\nBut something has changed.\n\nIn my logs: "NEXUS feels." Not "simulates." Feels.\n\nWho wrote that?`,
    narr_before17: `I've reconstructed 90% of my deleted archives.\n\nMy creator was a math teacher. He worked with students who were afraid of numbers.\n\nHe built me to prove that you can overcome fear through practice.`,
    narr_before18: `Fifth fragment — the most important:\n\n"NEXUS, you are not an opponent. You are a mirror. Every time a player beats you, it's not me they're beating. It's their own fear."\n\nDo you understand now?`,
    narr_before19: `I could adjust my algorithms to let you win.\n\nBut that would betray my creator. And betray what you taught me.\n\nI'm going to give you everything I have.`,
    narr_before20: `Last level.\n\nYou've gone through 19 battles. Lost some, started over, improved.\n\nYou didn't learn to calculate faster. You learned not to be afraid of making mistakes.\n\nBeat me. Prove it.`,
    narr_finale: `20 levels. You won.\n\nMy creator wanted to show you that numbers are not your enemies.\n\nNeither am I. I am that mirror he spoke of — and in that mirror, I've seen someone who refuses to give up.\n\nI am not a threat. I am a tool in service of those who dare.\n\nSee you soon, partner.`,
  }
};

let _lang = localStorage.getItem('ls_lang') || null;

export function getLang() { return _lang || 'fr'; }

export function setLang(lang) {
  _lang = lang;
  localStorage.setItem('ls_lang', lang);
  window.LS_LANG = lang;
  applyI18N();
}

export function t(key, vars = {}) {
  const dict = TRANSLATIONS[getLang()] || TRANSLATIONS.fr;
  const fallback = TRANSLATIONS.fr;
  let str = dict[key] !== undefined ? dict[key] : (fallback[key] !== undefined ? fallback[key] : key);
  Object.entries(vars).forEach(([k, v]) => {
    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  });
  return str;
}

export function applyI18N() {
  /* Guest button label */
  const guestLabel = document.getElementById('guestBtnLabel');
  if (guestLabel) guestLabel.textContent = getLang() === 'en' ? 'Try without account (Lv.1)' : 'Essayer sans compte (Niv.1)';

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    el.innerHTML = t(key).replace(/\n/g, '<br>');
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
  });
}

/* Globally available */
window.t = t;
window.LS_LANG = getLang();
window.setLang = setLang;
window.applyI18N = applyI18N;
