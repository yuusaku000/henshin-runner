'use strict';

// ===== せってい（ここの数字を変えると遊びやすさが変わる） =====
const W = 960, H = 540;          // ゲーム画面の大きさ（中の計算用）
const GROUND_Y = 430;            // 地面の高さ
const PLAYER_X = 220;            // 自分のキャラの横の位置
const PSIZE = 84;                // 自分のキャラの大きさ
const PX_PER_M = 40;             // 40px = 1m
const START_SPEED = 160;         // 走り始めの速さ
const TOP_SPEED = 290;           // いちばん速いとき（速すぎないように）
const RAMP_TIME = 10;            // トップスピードになるまでの秒数
const GRAVITY = 1250;
const JUMP_V = 740;              // ジャンプの強さ（高さ 約220px・ふんわり長め）
const INVINCIBLE_TIME = 3;       // やられたあと無敵の秒数
const CHANGE_EVERY_M = 100;      // 何mごとにへんしんするか
const FOOT = 22;                 // 足のはば（穴に落ちる判定をゆるくする）
const FONT = '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Meiryo", sans-serif';

// もとの絵が 左むきなので、右むきに ひっくり返す キャラ
// （ぞう・イルカ・くるま・きかんしゃ・しょうぼうしゃ・きょうりゅう・ユニコーン）
const FLIP = new Set(['1f418', '1f42c', '1f697', '1f682', '1f692', '1f996', '1f984']);

// 自分のキャラ（絵文字のコード, なまえ）
const CHARS = [
  ['1f425', 'ひよこ'], ['1f34e', 'りんご'], ['1f436', 'いぬ'], ['1f431', 'ねこ'],
  ['1f43c', 'パンダ'], ['1f34c', 'バナナ'], ['1f438', 'カエル'], ['1f359', 'おにぎり'],
  ['1f427', 'ペンギン'], ['1f996', 'きょうりゅう'], ['1f353', 'いちご'], ['1f430', 'うさぎ'],
  ['1f418', 'ぞう'], ['1f369', 'ドーナツ'], ['1f981', 'ライオン'], ['1f43b', 'くま'],
  ['26c4', 'ゆきだるま'], ['1f42c', 'イルカ'], ['1f366', 'ソフトクリーム'], ['1f428', 'コアラ'],
  ['1f349', 'すいか'], ['1f984', 'ユニコーン'], ['1f419', 'タコ'], ['1f354', 'ハンバーガー'],
  ['1f437', 'ぶた'], ['1f435', 'さる'], ['1f697', 'くるま'], ['1f680', 'ロケット'],
  ['1f682', 'きかんしゃ'], ['1f692', 'しょうぼうしゃ'],
].map(([cp, name]) => ({ cp, name, flip: FLIP.has(cp) }));

// てき
const ENEMY_TYPES = [
  // amp: うごく はば（0 = うごかない）
  { cp: '1f980', size: 80, amp: 0, freq: 0 },  // かに
  { cp: '1f40c', size: 78, amp: 0, freq: 0 },  // かたつむり
  { cp: '1f335', size: 86, amp: 0, freq: 0 },  // サボテン
  { cp: '1f994', size: 78, amp: 0, freq: 0 },  // はりねずみ
  { cp: '1faa8', size: 76, amp: 0, freq: 0 },  // いわ
];
const DECOR = ['2600', '2601', '26f0', '1f333', '1f332', '1f337', '1f33c', '1f3e0'];
const FX = ['1f4a5', '2b50', '2728', '1f389', '1f4ab'];

// ===== がめん =====
const stage = document.getElementById('stage');
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const titleEl = document.getElementById('title');
const guideEl = document.getElementById('guide');
const loadingEl = document.getElementById('loading');
const muteBtn = document.getElementById('mute');
let scale = 1;

function resize() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  const cw = Math.floor(W * s), ch = Math.floor(H * s);
  stage.style.width = cw + 'px';
  stage.style.height = ch + 'px';
  stage.style.fontSize = (16 * s) + 'px';
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  scale = s * dpr;
}
addEventListener('resize', resize);
resize();

// ===== え（絵文字）をよみこむ =====
const sprites = {};
function loadSprite(cp) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      c.getContext('2d').drawImage(img, 0, 0, 256, 256);
      sprites[cp] = c;
      resolve();
    };
    img.onerror = () => resolve();
    img.src = `assets/${cp}.svg`;
  });
}
function spr(cp) { return sprites[cp]; }

// てき用：赤と白の ふちどり つきの絵を作る（目立たせるため）
function makeOutlined(cp) {
  const src = sprites[cp];
  if (!src) return;
  const pad = 28, size = 256 + pad * 2;
  const silhouette = (color, r) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      x.drawImage(src, pad + Math.cos(a) * r, pad + Math.sin(a) * r);
    }
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, size, size);
    return c;
  };
  const out = document.createElement('canvas');
  out.width = out.height = size;
  const o = out.getContext('2d');
  o.drawImage(silhouette('#ff2a2a', 24), 0, 0);
  o.drawImage(silhouette('#ffffff', 11), 0, 0);
  o.drawImage(src, pad, pad);
  sprites[cp + '_o'] = out;
}

// ===== おと（ファイルなし・その場で作る） =====
let ac = null, master = null, muted = false;
function initAudio() {
  if (!ac) {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = 0.5;
      master.connect(ac.destination);
    } catch (e) { ac = null; }
  }
  if (ac && ac.state === 'suspended') ac.resume();
}
function tone(type, f0, f1, dur, vol = 0.2, delay = 0) {
  if (!ac || muted) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), gn = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  gn.gain.setValueAtTime(vol, t);
  gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(gn).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}
function noise(dur, vol, delay = 0, fStart = 2500, attack = 0) {
  if (!ac || muted) return;
  const t = ac.currentTime + delay;
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(fStart, t);
  f.frequency.exponentialRampToValueAtTime(80, t + dur);
  const gn = ac.createGain();
  if (attack > 0) {
    // いきなり大きくならないよう、すこしずつ音を大きくする
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(vol, t + attack);
  } else {
    gn.gain.setValueAtTime(vol, t);
  }
  gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(gn).connect(master);
  src.start(t);
}
const sfx = {
  jump() { tone('square', 380, 760, 0.14, 0.1); },
  spin() { for (let i = 0; i < 13; i++) tone('triangle', 500 + i * 80, 650 + i * 80, 0.08, 0.14, i * 0.1); },
  // へんしんの「ぼわん」：やわらかい低い音 ＋ キラキラ音（はれつ音にならないよう 高い音をけずって 小さめに）
  boom() {
    noise(0.9, 0.22, 0, 700, 0.06);
    tone('sine', 220, 70, 0.7, 0.35);
    [1047, 1319, 1568, 2093].forEach((f, i) => tone('sine', f, f * 1.001, 0.35, 0.08, 0.05 + i * 0.06));
  },
  fanfare() { [784, 988, 1175, 1568].forEach((f, i) => tone('triangle', f, f * 1.001, i === 3 ? 0.45 : 0.13, 0.18, 0.15 + i * 0.1)); },
  hit() { tone('square', 520, 140, 0.35, 0.13); },
  fall() { tone('sine', 900, 160, 0.7, 0.25); },
  respawn() { tone('sine', 600, 1200, 0.25, 0.15); },
  start() { [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f * 1.001, 0.16, 0.2, i * 0.11)); },
};

// ===== べんりな関数 =====
const rand = (a, b) => a + Math.random() * (b - a);
function hash(i, salt) { const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function easeOutBack(t) { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }

function drawSprite(cp, x, y, size, rot = 0, sx = 1, sy = 1, alpha = 1) {
  const s = spr(cp);
  if (!s) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.scale(sx, sy);
  ctx.drawImage(s, -size / 2, -size / 2, size, size);
  ctx.restore();
}
function outlined(text, x, y, size, fill, stroke = '#fff', align = 'center') {
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(4, size * 0.2);
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ===== ゲームのじょうたい =====
let state = 'loading';   // loading → title → play
let g = null;

function newGame() {
  g = {
    scrollX: 0, runTime: 0, speed: START_SPEED, time: 0,
    py: GROUND_Y, vy: 0, onGround: true, coyote: 0, jumpBuf: 0,
    inv: 0, invShow: false, dying: null,
    maxDist: 0, level: 0,
    cur: 0, queue: [],
    holes: [], enemies: [], nextSpawn: PLAYER_X + W + 100,
    transform: null, particles: [], texts: [],
    shake: 0, flash: 0, runPhase: 0, squash: 0, pop: 1,
  };
}
newGame();

function nextChar() {
  if (g.queue.length === 0) {
    g.queue = shuffle(CHARS.map((_, i) => i).filter((i) => i !== g.cur));
  }
  return g.queue.shift();
}

function playerWorldX() { return g.scrollX + PLAYER_X; }

function overHole(x) {
  return g.holes.some((h) => x - FOOT > h.x && x + FOOT < h.x + h.w);
}

function hitEnemy(e) {
  const px = playerWorldX();
  const pw = PSIZE * 0.42, ph = PSIZE * 0.7;
  const pl = px - pw / 2, pr = px + pw / 2, pt = g.py - ph - 4, pb = g.py - 4;
  const ew = e.size * 0.55, eh = e.size * 0.6;
  const el = e.x - ew / 2, er = e.x + ew / 2, et = GROUND_Y - eh, eb = GROUND_Y;
  return pl < er && pr > el && pt < eb && pb > et;
}

function addText(text, x, y, color, size = 44, life = 1.0) {
  g.texts.push({ text, x, y, color, size, life, t: 0 });
}

function burst(x, y, n, speedMin, speedMax, cps) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), v = rand(speedMin, speedMax);
    g.particles.push({
      cp: cps[Math.floor(Math.random() * cps.length)],
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120,
      rot: rand(0, 6), vr: rand(-8, 8), size: rand(26, 46), t: 0, life: rand(0.9, 1.5), grav: 500,
    });
  }
}

// ===== はじめる =====
function startGame() {
  initAudio();
  newGame();
  state = 'play';
  titleEl.classList.add('hidden');
  guideEl.classList.add('hidden');
  muteBtn.classList.remove('hidden');
  sfx.start();
  addText('スタート！', W / 2, 200, '#ff7a1a', 72, 1.3);
}

// ===== うごき =====
function update(dt) {
  g.time += dt;
  updateEffects(dt);
  // へんしんした キャラを見せている間は ゲームを止める
  if (g.showcase) { g.showcase.t += dt; return; }
  if (g.transform) updateTransform(dt);
  if (g.dying) { updateDying(dt); return; }

  // スピード：ゆっくり → 10秒くらいでトップスピード
  g.runTime += dt;
  const k = Math.min(g.runTime / RAMP_TIME, 1);
  g.speed = START_SPEED + (TOP_SPEED - START_SPEED) * (1 - (1 - k) * (1 - k));
  g.scrollX += g.speed * dt;
  g.runPhase += dt * g.speed / 26;

  const px = playerWorldX();

  // むてき
  if (g.inv > 0) {
    g.inv -= dt;
    if (g.inv <= 0) {
      // 穴の上や敵にかさなっているときは、ぬけるまで むてきを のばす
      if ((g.onGround && overHole(px)) || g.enemies.some(hitEnemy)) g.inv = 0.05;
      else g.invShow = false;
    }
  }
  const invincible = g.inv > 0;

  // ジャンプ
  g.jumpBuf = Math.max(0, g.jumpBuf - dt);
  g.coyote = Math.max(0, g.coyote - dt);
  if (g.jumpBuf > 0 && (g.onGround || g.coyote > 0)) {
    g.vy = -JUMP_V;
    g.onGround = false;
    g.coyote = 0;
    g.jumpBuf = 0;
    sfx.jump();
  }

  const supported = invincible || !overHole(px);
  const prevY = g.py;
  if (g.onGround) {
    if (!supported) { g.onGround = false; g.coyote = 0.12; }
    else { g.py = GROUND_Y; g.vy = 0; }
  }
  if (!g.onGround) {
    g.vy += GRAVITY * dt;
    g.py += g.vy * dt;
    if (g.vy > 0 && prevY <= GROUND_Y + 4 && g.py >= GROUND_Y && supported) {
      g.py = GROUND_Y; g.vy = 0; g.onGround = true; g.squash = 1;
    }
  }
  g.squash = Math.max(0, g.squash - dt * 5);

  // 穴に落ちた
  if (g.py > GROUND_Y + 140) { die('fall'); return; }

  // てき
  for (const e of g.enemies) {
    e.x = e.x0 + Math.sin(g.time * e.freq + e.phase) * e.amp;
    if (!invincible && hitEnemy(e)) { die('hit'); return; }
  }

  // きょり と へんしん
  const d = g.scrollX / PX_PER_M;
  if (d > g.maxDist) g.maxDist = d;
  const lv = Math.floor(g.maxDist / CHANGE_EVERY_M);
  if (lv > g.level) { g.level = lv; startTransform(); }

  spawn();
  g.holes = g.holes.filter((h) => h.x + h.w > g.scrollX - 300);
  g.enemies = g.enemies.filter((e) => e.x0 + 100 > g.scrollX - 300);
}

function spawn() {
  while (g.nextSpawn < g.scrollX + W + 300) {
    const x = g.nextSpawn;
    const m = (x - PLAYER_X) / PX_PER_M;
    const r = m % CHANGE_EVERY_M;
    // さいしょ と へんしんの まえ8m・あと30m は 敵も穴も おかない
    if (m < 15 || r > CHANGE_EVERY_M - 8 || r < 30) { g.nextSpawn += 80; continue; }
    if (Math.random() < 0.4) {
      const w = Math.min(115, Math.max(64, g.speed * 0.4)) + rand(0, 14);
      g.holes.push({ x, w });
      g.nextSpawn = x + w + rand(340, 600);
    } else {
      const t = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
      const ex = x + 60;
      g.enemies.push({ ...t, x0: ex, x: ex, phase: rand(0, 6), dir: -1 });
      g.nextSpawn = x + 120 + rand(340, 600);
    }
  }
}

function die(kind) {
  g.dying = { kind, t: 0, x: playerWorldX(), rot: 0 };
  g.onGround = false;
  if (kind === 'hit') {
    g.vy = -560;
    g.shake = 0.25;
    sfx.hit();
    addText('いたっ！', PLAYER_X, g.py - 120, '#ff4d4d', 52);
    burst(PLAYER_X + 30, g.py - 40, 6, 120, 260, ['1f4ab', '2b50']);
  } else {
    sfx.fall();
    addText('あっ！', PLAYER_X, GROUND_Y - 80, '#ff4d4d', 56);
  }
}

function updateDying(dt) {
  const d = g.dying;
  d.t += dt;
  g.vy += GRAVITY * dt;
  g.py += g.vy * dt;
  if (d.kind === 'hit') d.rot += dt * 12;
  if (d.t > 1.1) respawn();
}

function respawn() {
  // 直前から もういちど（すこし手前から）
  g.scrollX = Math.max(0, g.dying.x - PLAYER_X - 160);
  g.dying = null;
  g.py = GROUND_Y; g.vy = 0; g.onGround = true;
  g.inv = INVINCIBLE_TIME; g.invShow = true;
  g.runTime = 0; g.speed = START_SPEED;
  g.pop = 0;
  sfx.respawn();
  burst(PLAYER_X, GROUND_Y - PSIZE / 2, 10, 80, 220, ['2728', '2b50']);
  addText('むてき！', PLAYER_X, GROUND_Y - 140, '#ffb300', 44, 1.4);
}

// ===== へんしん =====
function startTransform() {
  g.transform = { t: 0, next: nextChar(), boomed: false };
  g.inv = Math.max(g.inv, 2.3);
  sfx.spin();
}

function updateTransform(dt) {
  const tr = g.transform;
  tr.t += dt;
  if (!tr.boomed && tr.t >= 1.3) {
    tr.boomed = true;
    g.cur = tr.next;
    g.pop = 0;
    g.shake = 0.45;
    g.flash = 0.2;
    sfx.boom();
    sfx.fanfare();
    const cy = g.py - PSIZE / 2;
    g.particles.push({ cp: '1f4a5', x: PLAYER_X, y: cy, vx: 0, vy: 0, rot: 0, vr: 0, size: 60, grow: 520, t: 0, life: 0.55, grav: 0 });
    burst(PLAYER_X, cy, 26, 220, 560, ['2b50', '2728', '1f389', '1f4ab']);
    addText('ぼかーん！', PLAYER_X + 150, cy - 50, '#ff4d4d', 66, 1.1);
    // ここで ゲームを止めて、キャラを大きく見せる
    g.transform = null;
    g.showcase = { t: 0 };
  }
}

const SHOWCASE_DELAY = 0.5;   // ぼかーん のあと、大きく見せるまでの秒数
const SHOWCASE_LOCK = 1.4;    // この秒数まではキーを押しても進まない（連打でとばさないため）

function resumeFromShowcase() {
  if (!g.showcase || g.showcase.t < SHOWCASE_LOCK) return;
  g.showcase = null;
  g.inv = Math.max(g.inv, 1.0);
  g.jumpBuf = 0;
  sfx.start();
  addText('しゅっぱつ！', W / 2, 200, '#ff7a1a', 64, 1.0);
}

function updateEffects(dt) {
  g.shake = Math.max(0, g.shake - dt);
  g.flash = Math.max(0, g.flash - dt);
  g.pop = Math.min(1, g.pop + dt * 2.2);
  for (const p of g.particles) {
    p.t += dt;
    p.vy += p.grav * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.rot += p.vr * dt;
    if (p.grow) p.size += p.grow * dt;
  }
  g.particles = g.particles.filter((p) => p.t < p.life);
  for (const t of g.texts) t.t += dt;
  g.texts = g.texts.filter((t) => t.t < t.life);
}

// ===== えがく =====
function render() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.save();
  if (g.shake > 0) {
    const s = 10 * (g.shake / 0.45);
    ctx.translate(rand(-s, s), rand(-s, s));
  }
  drawBackground();
  drawGround();
  if (state === 'play') {
    drawEnemies();
    drawPlayer();
    drawParticles();
  }
  ctx.restore();

  if (state === 'play') {
    drawTexts();
    drawTransformUI();
    drawHUD();
    drawHint();
    drawShowcase();
  }
  if (g.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${g.flash / 0.2 * 0.8})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, '#5bb8f5');
  sky.addColorStop(1, '#d6f0ff');
  ctx.fillStyle = sky;
  ctx.fillRect(-20, -20, W + 40, H + 40);

  drawSprite('2600', 360, 86, 100, g.time * 0.3);

  layer(260, 0.12, (i, x) => {
    if (hash(i, 1) < 0.3) return;
    drawSprite('2601', x, 50 + hash(i, 2) * 120, 90 + hash(i, 3) * 60);
  });
  layer(300, 0.25, (i, x) => {
    const s = 250 + hash(i, 4) * 90;
    drawSprite('26f0', x, GROUND_Y + 12 - s / 2 + s * 0.08, s);
  });
  layer(170, 0.5, (i, x) => {
    const r = hash(i, 5);
    if (r < 0.25) return;
    const cp = r < 0.6 ? '1f333' : r < 0.88 ? '1f332' : '1f3e0';
    const s = 110 + hash(i, 6) * 40;
    drawSprite(cp, x, GROUND_Y + 8 - s / 2, s);
  });
  // 背景を すこし うすくして、てきと自分を目立たせる
  ctx.fillStyle = 'rgba(225, 242, 255, 0.45)';
  ctx.fillRect(-20, -20, W + 40, GROUND_Y + 20);
}

function layer(spacing, parallax, fn) {
  const off = g.scrollX * parallax;
  const start = Math.floor(off / spacing) - 2;
  const end = Math.floor((off + W) / spacing) + 2;
  for (let i = start; i <= end; i++) {
    const x = i * spacing - off + hash(i, 9) * spacing * 0.6;
    fn(i, x);
  }
}

function drawGround() {
  // つち
  ctx.fillStyle = '#c98a4b';
  ctx.fillRect(-20, GROUND_Y, W + 40, H - GROUND_Y + 20);
  // つちの もよう
  ctx.fillStyle = '#b07438';
  layer(46, 1, (i, x) => {
    ctx.beginPath();
    ctx.arc(x, GROUND_Y + 40 + hash(i, 7) * 60, 5 + hash(i, 8) * 5, 0, Math.PI * 2);
    ctx.fill();
  });
  // くさ
  ctx.fillStyle = '#5cc13d';
  ctx.fillRect(-20, GROUND_Y, W + 40, 18);
  ctx.fillStyle = '#86dc5c';
  ctx.fillRect(-20, GROUND_Y, W + 40, 6);
  // はな
  layer(90, 1, (i, x) => {
    if (hash(i, 10) < 0.5) return;
    const wx = x + g.scrollX;
    if (g.holes.some((h) => wx > h.x - 20 && wx < h.x + h.w + 20)) return;
    drawSprite(hash(i, 11) < 0.5 ? '1f337' : '1f33c', x, GROUND_Y - 10, 30);
  });
  // あな
  for (const h of g.holes) {
    const x = h.x - g.scrollX;
    if (x > W + 20 || x + h.w < -20) continue;
    const pit = ctx.createLinearGradient(0, GROUND_Y, 0, H);
    pit.addColorStop(0, '#3a2412');
    pit.addColorStop(1, '#0d0704');
    ctx.fillStyle = pit;
    ctx.fillRect(x, GROUND_Y, h.w, H - GROUND_Y + 20);
    ctx.fillStyle = '#4a9c2f';
    ctx.fillRect(x - 4, GROUND_Y, 6, 22);
    ctx.fillRect(x + h.w - 2, GROUND_Y, 6, 22);
  }
}

function drawEnemies() {
  for (const e of g.enemies) {
    const x = e.x - g.scrollX;
    if (x < -100 || x > W + 100) continue;
    const bob = e.amp ? Math.abs(Math.sin(g.time * 8 + e.phase)) * 5 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(x, GROUND_Y + 2, e.size * 0.4, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    const k = (256 + 56) / 256; // ふちどりの ぶん すこし大きく
    const ey = GROUND_Y - e.size / 2 - bob + 4;
    drawSprite(e.cp + '_o', x, ey, e.size * k);
    // 「！」マーク
    const my = ey - e.size / 2 - 34 + Math.sin(g.time * 7 + e.phase) * 5;
    ctx.beginPath();
    ctx.arc(x, my, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#ff2a2a';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.font = `800 28px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText('！', x, my + 1);
  }
}

function drawPlayer() {
  const ch = CHARS[g.cur];
  let x = PLAYER_X, y = g.py - PSIZE / 2;
  let rot = 0, sx = 1, sy = 1, alpha = 1;

  if (g.dying) {
    rot = g.dying.rot;
  } else {
    if (g.onGround) {
      y -= Math.abs(Math.sin(g.runPhase)) * 7;
      rot = Math.sin(g.runPhase * 2) * 0.08;
    } else {
      rot = Math.max(-0.3, Math.min(0.3, g.vy / 2500));
    }
    const sq = g.squash;
    sx = 1 + sq * 0.2; sy = 1 - sq * 0.2;
    y += sq * PSIZE * 0.1;
  }

  // へんしん中 くるくる
  const tr = g.transform;
  if (tr && !tr.boomed) {
    const t = tr.t;
    rot = Math.PI * 2 * (t * 1.2 + t * t * 2.4);
    const s = 1 - 0.2 * (t / 1.3);
    sx = s; sy = s;
    // まわりの キラキラ
    for (let i = 0; i < 5; i++) {
      const a = g.time * 9 + i * (Math.PI * 2 / 5);
      drawSprite('2728', x + Math.cos(a) * 70, y + Math.sin(a) * 60, 30);
    }
  }
  // でてきた ときの ポン
  const p = easeOutBack(g.pop);
  sx *= p; sy *= p;

  // むてき中は ちかちか
  if (g.invShow && g.inv > 0 && Math.floor(g.time * 12) % 2 === 0) alpha = 0.35;

  // かげ
  if (!g.dying && (g.inv > 0 || !overHole(playerWorldX()))) {
    const hgt = Math.max(0, GROUND_Y - g.py);
    const sw = Math.max(10, PSIZE * 0.4 - hgt * 0.08);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(x, GROUND_Y + 3, sw, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (ch.flip) { sx = -sx; rot = -rot; }
  drawSprite(ch.cp, x, y, PSIZE, rot, sx, sy, alpha);
}

function drawParticles() {
  for (const p of g.particles) {
    const a = 1 - p.t / p.life;
    drawSprite(p.cp, p.x, p.y, p.size, p.rot, 1, 1, Math.min(1, a * 1.5));
  }
}

function drawTexts() {
  for (const t of g.texts) {
    const k = t.t / t.life;
    const s = easeOutBack(Math.min(1, t.t / 0.25));
    ctx.save();
    ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    ctx.translate(t.x, t.y - k * 30);
    ctx.scale(s, s);
    outlined(t.text, 0, 0, t.size, t.color);
    ctx.restore();
  }
}

function drawTransformUI() {
  const tr = g.transform;
  if (!tr) return;
  const t = tr.t;
  if (!tr.boomed) {
    // 「くるくるくるくる」が 1もじずつ でる
    const full = 'くるくるくるくる…';
    const n = Math.min(full.length, Math.floor(t / 1.2 * full.length) + 1);
    ctx.save();
    ctx.translate(W / 2, 150);
    ctx.rotate(Math.sin(t * 12) * 0.04);
    outlined(full.slice(0, n), 0, 0, 58, '#8a4dff');
    ctx.restore();
  }
}

// へんしんした キャラを まんなかに 大きく
function drawShowcase() {
  const s = g.showcase;
  if (!s) return;
  const t = s.t - SHOWCASE_DELAY;
  if (t < 0) return;
  const a = Math.min(1, t / 0.3);
  ctx.fillStyle = `rgba(20, 30, 60, ${0.6 * a})`;
  ctx.fillRect(0, 0, W, H);

  const pop = easeOutBack(Math.min(1, t / 0.5));
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(W / 2, H / 2);
  ctx.scale(pop, pop);
  ctx.translate(-W / 2, -H / 2);

  roundRect(W / 2 - 320, 28, 640, 484, 44);
  ctx.fillStyle = 'rgba(255,255,255,0.97)';
  ctx.fill();
  ctx.lineWidth = 9;
  ctx.strokeStyle = '#ffb300';
  ctx.stroke();

  outlined('へんしん！', W / 2, 82, 46, '#ff7a1a');

  // まわりの キラキラ
  for (let i = 0; i < 6; i++) {
    const ang = g.time * 1.5 + i * (Math.PI * 2 / 6);
    drawSprite(i % 2 ? '2b50' : '2728', W / 2 + Math.cos(ang) * 170, 240 + Math.sin(ang) * 110, 40);
  }
  const ch = CHARS[g.cur];
  drawSprite(ch.cp, W / 2, 240 + Math.sin(g.time * 3) * 8, 220, Math.sin(g.time * 2) * 0.08, ch.flip ? -1 : 1, 1);

  // なまえ（長い名前は 小さくして 枠に おさめる）
  ctx.font = `800 100px ${FONT}`;
  const nw = ctx.measureText(ch.name).width;
  const size = Math.min(100, 100 * 560 / nw);
  outlined(ch.name, W / 2, 400, size, '#2f80ed');

  // 「スペース か エンター で つぎへ！」
  if (s.t >= SHOWCASE_LOCK) {
    const ps = 1 + Math.sin(g.time * 6) * 0.05;   // ちかちか ではなく、ふわふわ大きさを変える
    ctx.save();
    ctx.translate(W / 2, 470);
    ctx.scale(ps, ps);
    drawPrompt(0, 0, 'で つぎへ！');
    ctx.restore();
  }
  ctx.restore();
}

function drawKeycap(label, x, y) {
  ctx.font = `800 24px ${FONT}`;
  const w = ctx.measureText(label).width + 28;
  roundRect(x, y - 22, w, 44, 10);
  ctx.fillStyle = '#ff7a1a';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#c94f00';
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 14, y + 1);
  return w;
}

function drawPrompt(cx, cy, tail) {
  ctx.font = `800 24px ${FONT}`;
  const w1 = ctx.measureText('スペース').width + 28;
  const w2 = ctx.measureText('エンター').width + 28;
  ctx.font = `800 26px ${FONT}`;
  const wk = ctx.measureText(' か ').width;
  const wt = ctx.measureText(' ' + tail).width;
  let x = cx - (w1 + wk + w2 + wt) / 2;
  x += drawKeycap('スペース', x, cy);
  ctx.font = `800 26px ${FONT}`;
  ctx.fillStyle = '#1f3b73';
  ctx.textAlign = 'left';
  ctx.fillText(' か ', x, cy + 1);
  x += wk;
  x += drawKeycap('エンター', x, cy);
  ctx.font = `800 26px ${FONT}`;
  ctx.fillStyle = '#1f3b73';
  ctx.textAlign = 'left';
  ctx.fillText(' ' + tail, x, cy + 1);
}

function drawHUD() {
  const d = Math.floor(g.maxDist);
  const x = W - 262, y = 16, w = 246, h = 120;
  roundRect(x, y, w, h, 20);
  ctx.fillStyle = 'rgba(255,255,255,0.93)';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#2f80ed';
  ctx.stroke();

  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 56px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#1f3b73';
  ctx.fillText(String(d), x + w - 58, y + 66);
  ctx.font = `800 30px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('m', x + w - 50, y + 66);

  // つぎの へんしん までの バー
  const prog = (g.maxDist % CHANGE_EVERY_M) / CHANGE_EVERY_M;
  const bx = x + 16, by = y + 80, bw = w - 72, bh = 16;
  roundRect(bx, by, bw, bh, 8);
  ctx.fillStyle = '#e3ecf7';
  ctx.fill();
  if (prog > 0.01) {
    roundRect(bx, by, Math.max(bh, bw * prog), bh, 8);
    ctx.fillStyle = '#ffb300';
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x + w - 30, by + bh / 2, 17, 0, Math.PI * 2);
  ctx.fillStyle = '#8a4dff';
  ctx.fill();
  ctx.font = `800 22px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText('？', x + w - 30, by + bh / 2 + 1);
  ctx.font = `800 14px ${FONT}`;
  ctx.fillStyle = '#1f3b73';
  const left = Math.ceil(CHANGE_EVERY_M - (g.maxDist % CHANGE_EVERY_M));
  ctx.fillText(`へんしん まで あと ${left}m`, bx + bw / 2, by + bh + 13);
}

function drawHint() {
  if (g.time > 10) return;
  const a = g.time > 9 ? 10 - g.time : 1;
  ctx.save();
  ctx.globalAlpha = a;
  const cx = W / 2, cy = 496;
  roundRect(cx - 290, cy - 30, 580, 60, 30);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fill();
  ctx.font = `800 28px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1f3b73';
  ctx.fillText('スペース か エンター で ジャンプ！', cx, cy + 1);
  ctx.restore();
}

// ===== そうさ =====
function showGuide() {
  initAudio();
  state = 'guide';
  titleEl.classList.add('hidden');
  guideEl.classList.remove('hidden');
  sfx.respawn();
}
function press(fromKey) {
  initAudio();
  if (state === 'title') { showGuide(); return; }
  // キーの場所をおぼえてもらうため、案内画面は キーでだけ すすむ
  if (state === 'guide') { if (fromKey) startGame(); return; }
  if (state === 'play') {
    if (g.showcase) { resumeFromShowcase(); return; }
    g.jumpBuf = 0.15;
  }
}
addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    if (e.repeat) return;
    press(true);
  }
});
canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); press(false); });
titleEl.addEventListener('pointerdown', (e) => { e.preventDefault(); press(false); });
muteBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  muted = !muted;
  muteBtn.textContent = muted ? '🔇' : '🔊';
});

// ===== キーボードの絵（スペースとエンターを光らせる） =====
function buildKeyboard() {
  const kb = document.getElementById('kb');
  const Q = 4; // キー1こ = 4マス
  const rows = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
    [1.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 'enter'],
    [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.75],
    [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.75],
    [1.25, 1.25, 1.25, 1.25, 'space', 1.25, 1.25, 1.25, 1.25],
  ];
  rows.forEach((row, r) => {
    let col = 0;
    for (const k of row) {
      const el = document.createElement('div');
      el.className = 'k';
      if (k === 'enter') {
        el.classList.add('hot');
        el.style.gridColumn = `${col + 1} / span ${1.75 * Q}`;
        el.style.gridRow = `${r + 1} / span 2`;
        el.innerHTML = '<span style="font-size:1.05em;white-space:nowrap">エンター</span><div class="here right">◀ ここ！</div>';
        col += 1.75 * Q;
      } else if (k === 'space') {
        el.classList.add('hot');
        el.style.gridColumn = `${col + 1} / span ${5 * Q}`;
        el.style.gridRow = `${r + 1}`;
        el.innerHTML = '<span>スペース</span><div class="here below">▲ ここ！</div>';
        col += 5 * Q;
      } else {
        el.style.gridColumn = `${col + 1} / span ${k * Q}`;
        el.style.gridRow = `${r + 1}`;
        col += k * Q;
      }
      kb.appendChild(el);
    }
  });
}
buildKeyboard();

// ===== ループ =====
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state === 'play') update(dt);
  else { g.time += dt; g.scrollX += 70 * dt; updateEffects(dt); }
  render();
  requestAnimationFrame(frame);
}

(async function boot() {
  const all = [...new Set([...CHARS.map((c) => c.cp), ...ENEMY_TYPES.map((e) => e.cp), ...DECOR, ...FX])];
  await Promise.all(all.map(loadSprite));
  ENEMY_TYPES.forEach((e) => makeOutlined(e.cp));
  try { await document.fonts.load(`800 40px "M PLUS Rounded 1c"`); } catch (e) { /* フォントがなくても動く */ }
  loadingEl.classList.add('hidden');
  titleEl.classList.remove('hidden');
  state = 'title';
  requestAnimationFrame(frame);
})();
