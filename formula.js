/* ══════════════════════════════════════
   formula.js — Générateur de formules
══════════════════════════════════════ */

/* ── Évaluation sécurisée : entier entre 0 et 100 ── */
function evalExact(f) {
  try {
    const r = eval(f.replace(/×/g, '*').replace(/÷/g, '/'));
    if (!Number.isFinite(r)) return null;
    if (r !== Math.floor(r)) return null;
    if (r < 0 || r > 100) return null;
    return r;
  } catch(e) { return null; }
}

/* ── EASY : additions / soustractions ── */
function genEasy() {
  let formula, answer, att = 0;
  do {
    att++;
    const n = 2 + Math.floor(Math.random() * 3);
    const nums = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 35));
    const ops = Array.from({ length: n - 1 }, () => Math.random() > 0.42 ? '+' : '-');
    let f = '' + nums[0];
    for (let i = 0; i < ops.length; i++) f += ` ${ops[i]} ${nums[i + 1]}`;
    const r = evalExact(f);
    if (r !== null) { formula = f; answer = r; break; }
  } while (att < 600);
  if (!formula) { formula = '13 + 9'; answer = 22; }
  return { formula, answer, difficulty: 'easy', time: 20 };
}

/* ── MEDIUM : × ou ÷ + termes +/- ── */
function genMedium() {
  let formula, answer, att = 0;
  do {
    att++;
    const n = 3 + Math.floor(Math.random() * 3);
    let f, terms = 0;
    if (Math.random() > 0.5) {
      const b = 2 + Math.floor(Math.random() * 8);
      const q = 2 + Math.floor(Math.random() * 10);
      f = `${b * q} ÷ ${b}`; terms = 2;
    } else {
      const a = 2 + Math.floor(Math.random() * 9);
      const b = 2 + Math.floor(Math.random() * 8);
      f = `${a} × ${b}`; terms = 2;
    }
    while (terms < n) {
      const c = 1 + Math.floor(Math.random() * 20);
      f += ` ${Math.random() > 0.5 ? '+' : '-'} ${c}`;
      terms++;
    }
    const r = evalExact(f);
    if (r !== null) { formula = f; answer = r; break; }
  } while (att < 800);
  if (!formula) { formula = '6 × 7 - 9'; answer = 33; }
  return { formula, answer, difficulty: 'medium', time: 25 };
}

/* ── HARD : plusieurs × et/ou ÷ + +/- ── */
function genHard() {
  let formula, answer, att = 0;
  do {
    att++;
    const n = 4 + Math.floor(Math.random() * 3);
    const numStrong = 1 + Math.floor(Math.random() * 2);
    const strongPos = new Set();
    while (strongPos.size < numStrong) strongPos.add(Math.floor(Math.random() * (n - 1)));
    const ops = [];
    for (let i = 0; i < n - 1; i++)
      ops.push(strongPos.has(i) ? (Math.random() > 0.5 ? '×' : '÷') : (Math.random() > 0.5 ? '+' : '-'));
    const terms = Array(n).fill(0);
    terms[0] = 2 + Math.floor(Math.random() * 25);
    for (let i = 1; i < n; i++) {
      if (ops[i - 1] === '÷') {
        const d = 2 + Math.floor(Math.random() * 8);
        const q = 2 + Math.floor(Math.random() * 9);
        terms[i - 1] = d * q;
        terms[i] = d;
      } else if (ops[i - 1] === '×') {
        terms[i] = 2 + Math.floor(Math.random() * 9);
      } else {
        terms[i] = 1 + Math.floor(Math.random() * 25);
      }
    }
    let f = '' + terms[0];
    for (let i = 0; i < ops.length; i++) f += ` ${ops[i]} ${terms[i + 1]}`;
    const r = evalExact(f);
    if (r !== null) { formula = f; answer = r; break; }
  } while (att < 1000);
  if (!formula) { formula = '7 × 8 - 48 ÷ 6 + 3 - 2'; answer = 49; }
  return { formula, answer, difficulty: 'hard', time: 40 };
}

/* ── Assignation des mécaniques par round (sync online) ──
   La mécanique est déterminée ICI une seule fois et embarquée dans le round.
   En mode online, l'hôte envoie les rounds complets → les deux appareils
   utilisent exactement la même mécanique pour chaque round. */
function assignMechanic(diff) {
  const r = Math.random();
  if (diff === 'easy')   return r < 0.60 ? 'normal' : 'speed';
  if (r < 0.40) return 'normal';
  if (r < 0.65) return 'speed';
  if (r < 0.85) return 'order';
  return 'blind';
}

export function generateRounds(forceNormal = false) {
  const slots = [
    ...Array(3).fill('easy'),
    ...Array(4).fill('medium'),
    ...Array(3).fill('hard')
  ];
  /* Mélanger pour ne pas toujours avoir easy en premier */
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  return slots.map(diff => {
    const base = diff === 'easy' ? genEasy() : diff === 'medium' ? genMedium() : genHard();
    base.mechanic = forceNormal ? 'normal' : assignMechanic(diff);
    return base;
  });
}
