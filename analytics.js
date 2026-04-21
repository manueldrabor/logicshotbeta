/* ══════════════════════════════════════
   analytics.js — LogicShot Analytics
   Google Analytics 4 + Microsoft Clarity

   Expose window.logEvent(name, params)
   appelé depuis logicshot.js / battle.js
══════════════════════════════════════ */

/**
 * Envoie un événement vers GA4 et Clarity.
 * @param {string} name   Nom de l'événement (snake_case)
 * @param {object} params Paramètres optionnels
 */
window.logEvent = function(name, params = {}) {
  try {
    if (typeof gtag !== 'undefined') {
      gtag('event', name, params);
    }
    if (typeof clarity !== 'undefined') {
      clarity('set', name, JSON.stringify(params));
    }
  } catch(e) { /* fail silently */ }
};

/* ── Événements automatiques au chargement ── */
window.addEventListener('DOMContentLoaded', () => {

  /* Temps passé sur la page (session engagement) */
  let _startTime = Date.now();
  window.addEventListener('beforeunload', () => {
    const seconds = Math.round((Date.now() - _startTime) / 1000);
    logEvent('session_end', { duration_seconds: seconds });
  });

  /* Thème détecté au démarrage */
  const theme = document.documentElement.getAttribute('data-theme') || 'light';
  logEvent('app_open', { theme });
});
