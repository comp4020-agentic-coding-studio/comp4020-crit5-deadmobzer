// A dark parody of Chrome's offline dino game: it looks like a connection
// error, plays like the real thing, and slowly stops pretending it's here to
// help. Collision and the restart-lock rule live in ./game-rules.js so they
// can be tested without a DOM; everything else --- rendering, input, the
// escalating copy --- lives here.
import { boxesOverlap, locksOnRestart } from "./game-rules.js";
import trexRunSrc from "./assets/sprites/trex-run-right.webp";
import trexDeadSrc from "./assets/sprites/trex-dead.webp";
import cactusSmallSrc from "./assets/sprites/cactus-small.webp";
import cactusLargeSrc from "./assets/sprites/cactus-large.webp";

var W = 600,
  H = 180,
  GROUND = 142;
var COL = "#a4a7ab";
var BG = "#202124";

var canvas = document.getElementById("game");
var ctx = canvas.getContext("2d");

function fit() {
  var dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}
fit();
window.addEventListener("resize", fit);

/* ---------- sprites: Chrome dino/cactus art, drawn from real images ---------- */
/* Dino & cactus sprites: SpiciousS, CC BY-SA 4.0, commons.wikimedia.org/wiki/Category:Dinosaur_Game */

function loadImage(src) {
  var img = new Image();
  img.src = src;
  return img;
}
var trexRun = loadImage(trexRunSrc);
var trexDead = loadImage(trexDeadSrc);
var cactusSmallImg = loadImage(cactusSmallSrc);
var cactusLargeImg = loadImage(cactusLargeSrc);

var DINO_H = 48;
var CACTUS_SMALL_H = 40;
var CACTUS_LARGE_H = 48;

function dims(img, targetH, fallbackRatio) {
  var ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : fallbackRatio;
  return { w: targetH * ratio, h: targetH };
}

/* ---------- pixel sprites: everything without a source image ---------- */

function sprite(rows) {
  return rows;
}

function draw(s, x, y, scale, color) {
  ctx.fillStyle = color || COL;
  x = Math.round(x);
  y = Math.round(y);
  for (var r = 0; r < s.length; r++) {
    var row = s[r],
      c = 0;
    while (c < row.length) {
      if (row[c] === "X") {
        var start = c;
        while (c < row.length && row[c] === "X") c++;
        ctx.fillRect(x + start * scale, y + r * scale, (c - start) * scale, scale);
      } else c++;
    }
  }
}

var CLOUD = sprite([
  ".....XXXXXX.....",
  "...XX......XX...",
  "..X..........X..",
  "XX............XX",
  ".XXXXXXXXXXXXXX.",
]);

var STAR = sprite([".X.", "XXX", ".X."]);

var RESTART = sprite([
  "..XXXXXX..",
  ".XX....XX.",
  "XX......XX",
  "XX........",
  "XX...XXXXX",
  "XX....XXX.",
  ".XX....X..",
  "..XXXXXX..",
]);

var DIGITS = {
  0: ["XXXX", "X..X", "X..X", "X..X", "XXXX"],
  1: ["..XX", "...X", "...X", "...X", "...X"],
  2: ["XXXX", "...X", "XXXX", "X...", "XXXX"],
  3: ["XXXX", "...X", "XXXX", "...X", "XXXX"],
  4: ["X..X", "X..X", "XXXX", "...X", "...X"],
  5: ["XXXX", "X...", "XXXX", "...X", "XXXX"],
  6: ["XXXX", "X...", "XXXX", "X..X", "XXXX"],
  7: ["XXXX", "...X", "...X", "...X", "...X"],
  8: ["XXXX", "X..X", "XXXX", "X..X", "XXXX"],
  9: ["XXXX", "X..X", "XXXX", "...X", "XXXX"],
  H: ["X..X", "X..X", "XXXX", "X..X", "X..X"],
  I: ["XXXX", ".XX.", ".XX.", ".XX.", "XXXX"],
  " ": ["....", "....", "....", "....", "...."],
};

function text(str, x, y, scale, color) {
  for (var i = 0; i < str.length; i++) {
    var g = DIGITS[str[i]];
    if (g) draw(g, x + i * 5 * scale, y, scale, color);
  }
}

/* ---------- world ---------- */

var dino = { x: 42, y: 0, vy: 0, jumping: false };
var speed, dist, score, hi = 0, obstacles, running, dead, started, phaseTime, lastPhase, lastTick = -1;
var runs = 0,
  locked = false,
  lockTaps = 0;

// How many refusals before the page relents. Set to Infinity for a real brick.
var RELENT_AFTER = 5;
var REFUSALS = [
  "No.",
  "I said no.",
  "You're proving the point.",
  "This is embarrassing for both of us.",
  "Fine. Go on then.",
];
var groundBits = [],
  clouds = [],
  stars = [],
  moonX;

function buildScenery() {
  groundBits = [];
  for (var i = 0; i < 90; i++) {
    groundBits.push({
      x: Math.random() * 1800,
      w: 2 + Math.floor(Math.random() * 5) * 2,
      y: 4 + Math.floor(Math.random() * 3) * 2,
    });
  }
  clouds = [];
  for (var c = 0; c < 3; c++) clouds.push({ x: 200 + c * 260 + Math.random() * 120, y: 22 + Math.random() * 34 });
  stars = [];
  for (var s = 0; s < 9; s++) stars.push({ x: Math.random() * 1200, y: 12 + Math.random() * 56 });
  moonX = 420;
}

function reset() {
  speed = 5.6;
  dist = 0;
  score = 0;
  obstacles = [];
  dead = false;
  running = true;
  dino.y = 0;
  dino.vy = 0;
  dino.jumping = false;
}

buildScenery();
reset();
running = false;
started = false;
phaseTime = 0;
lastPhase = -1;

/* ---------- obstacles ---------- */

var nextGap = 500;

function spawn() {
  var large = Math.random() < 0.42;
  obstacles.push({ size: large ? "large" : "small", x: W + 20 });
  nextGap = (260 + Math.random() * 340) * (speed / 8);
  if (nextGap < 210) nextGap = 210;
}

function obstacleBox(o) {
  var d = o.size === "large" ? dims(cactusLargeImg, CACTUS_LARGE_H, 0.99) : dims(cactusSmallImg, CACTUS_SMALL_H, 0.476);
  var inset = d.w * 0.18;
  return { x: o.x + inset, y: GROUND - d.h + 2, w: d.w - inset * 2, h: d.h - 4 };
}

/* ---------- input ---------- */

function die() {
  dead = true;
  runs++;
  if (locksOnRestart(runs, score, hi)) {
    locked = true;
    lockTaps = 0;
  }
}

// A held or mashed key sends jump() many times a second --- exactly what a
// refused player does. Without a cooldown, that burns through all five
// refusals in under a frame and the standoff resolves before it reads as one.
var REFUSE_COOLDOWN = 500;
var lastRefuseAt = -Infinity;

function refuse() {
  var now = performance.now();
  if (now - lastRefuseAt < REFUSE_COOLDOWN) return;
  lastRefuseAt = now;

  var msg = REFUSALS[Math.min(lockTaps, REFUSALS.length - 1)];
  lockTaps++;
  reply.textContent = msg;
  reply.classList.add("show");
  if (lockTaps >= RELENT_AFTER) {
    locked = false;
    lastPhase = -1;
    reply.classList.remove("show");
    reset();
  }
}

function jump() {
  if (locked) {
    refuse();
    return;
  }
  if (!started) {
    started = true;
    running = true;
    return;
  }
  if (dead) {
    reset();
    return;
  }
  if (!dino.jumping) {
    dino.jumping = true;
    dino.vy = -10.6;
  }
}

window.addEventListener("keydown", function (e) {
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "Enter") {
    if (document.activeElement && document.activeElement.id === "btn") return;
    e.preventDefault();
    jump();
  }
});
canvas.addEventListener("pointerdown", function (e) {
  e.preventDefault();
  canvas.focus();
  jump();
});

/* ---------- loop ---------- */

var last = performance.now();

function frame(now) {
  var dt = Math.min(now - last, 50);
  last = now;
  var f = dt / 16.6667;

  if (started && !document.hidden) {
    phaseTime += dt;
    updatePhase();
  }

  if (running && !dead) {
    speed = Math.min(12.4, speed + 0.0012 * f);
    dist += speed * f;
    score = Math.floor(dist * 0.025);
    if (score > hi) hi = score;

    dino.vy += 0.55 * f;
    dino.y += dino.vy * f;
    if (dino.y > 0) {
      dino.y = 0;
      dino.vy = 0;
      dino.jumping = false;
    }

    nextGap -= speed * f;
    if (nextGap <= 0) spawn();

    for (var i = obstacles.length - 1; i >= 0; i--) {
      var o = obstacles[i];
      o.x -= speed * f;
      if (o.x < -120) obstacles.splice(i, 1);
    }

    var dinoDims = dims(trexRun, DINO_H, 1.03);
    var db = {
      x: dino.x + dinoDims.w * 0.22,
      y: GROUND - dinoDims.h + dino.y + dinoDims.h * 0.14,
      w: dinoDims.w * 0.56,
      h: dinoDims.h * 0.78,
    };
    for (var j = 0; j < obstacles.length; j++) {
      if (boxesOverlap(db, obstacleBox(obstacles[j]))) {
        die();
        break;
      }
    }
  }

  render(f);
  requestAnimationFrame(frame);
}

function render(f) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  var move = running && !dead ? speed * f : 0;

  for (var s = 0; s < stars.length; s++) {
    stars[s].x -= move * 0.12;
    if (stars[s].x < -8) {
      stars[s].x += 1240;
      stars[s].y = 12 + Math.random() * 56;
    }
    draw(STAR, stars[s].x, stars[s].y, 2, "#63666a");
  }

  moonX -= move * 0.08;
  if (moonX < -80) moonX = W + 260;
  ctx.fillStyle = "#4a4d51";
  ctx.beginPath();
  ctx.arc(moonX, 46, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BG;
  ctx.beginPath();
  ctx.arc(moonX - 13, 40, 26, 0, Math.PI * 2);
  ctx.fill();

  for (var c = 0; c < clouds.length; c++) {
    clouds[c].x -= move * 0.36;
    if (clouds[c].x < -70) {
      clouds[c].x = W + 60 + Math.random() * 200;
      clouds[c].y = 22 + Math.random() * 34;
    }
    draw(CLOUD, clouds[c].x, clouds[c].y, 3, "#4f5256");
  }

  ctx.fillStyle = COL;
  ctx.fillRect(0, GROUND, W, 2);
  for (var g = 0; g < groundBits.length; g++) {
    var b = groundBits[g];
    b.x -= move;
    if (b.x < -20) b.x += 1800;
    if (b.x < W + 20) ctx.fillRect(Math.round(b.x), GROUND + b.y, b.w, 2);
  }

  for (var i = 0; i < obstacles.length; i++) {
    var o = obstacles[i];
    var img = o.size === "large" ? cactusLargeImg : cactusSmallImg;
    var d = o.size === "large" ? dims(cactusLargeImg, CACTUS_LARGE_H, 0.99) : dims(cactusSmallImg, CACTUS_SMALL_H, 0.476);
    if (img.complete) ctx.drawImage(img, o.x, GROUND - d.h, d.w, d.h);
  }

  var dinoImg = dead ? trexDead : trexRun;
  var dinoDims = dims(dinoImg, DINO_H, 1.03);
  var dy = GROUND - dinoDims.h + dino.y;
  if (dinoImg.complete) ctx.drawImage(dinoImg, dino.x, dy, dinoDims.w, dinoDims.h);

  var pad = function (n) {
    var s = "" + n;
    while (s.length < 5) s = "0" + s;
    return s;
  };
  if (hi > 0) text("HI " + pad(hi), W - 210, 16, 2, "#6f7378");
  text(pad(score), W - 60, 16, 2, "#9aa0a6");

  if (dead) {
    ctx.fillStyle = "#9aa0a6";
    ctx.textAlign = "center";
    if (locked) {
      ctx.font = "600 15px system-ui, Roboto, Arial, sans-serif";
      ctx.fillText("J U S T   G I V E   U P   A L R E A D Y", W / 2, 62);
      ctx.fillStyle = "#6f7378";
      ctx.font = "13px system-ui, Roboto, Arial, sans-serif";
      ctx.fillText(score + " after " + hi + ". That was run " + runs + ".", W / 2, 86);
    } else {
      ctx.font = "600 15px system-ui, Roboto, Arial, sans-serif";
      ctx.fillText("G A M E   O V E R", W / 2, 62);
      draw(RESTART, W / 2 - 10, 78, 2, "#9aa0a6");
    }
  }
}

requestAnimationFrame(frame);

/* ---------------------------------------------------------------
   The part that talks. One change per minute, six in total.
----------------------------------------------------------------*/

var PHASES = [
  {
    head: "No internet",
    label: "Try:",
    items: [
      "Turning off airplane mode",
      "Turning on mobile data or Wi-Fi",
      "Checking the signal in your area",
    ],
    code: "ERR_INTERNET_DISCONNECTED",
    btn: "LOAD PAGE LATER",
    reply: "Queued.",
  },
  {
    head: "You are still doing this",
    label: "Try:",
    items: [
      "Turning off airplane mode",
      "Turning on mobile data or Wi-Fi",
      "Asking yourself how long you plan to keep this up",
    ],
    code: "ERR_INTERNET_DISCONNECTED",
    btn: "LOAD PAGE LATER",
    reply: "Later. Sure.",
  },
  {
    head: "You have better things to do",
    label: "Try:",
    items: ["Any of them", "The thing you actually opened the browser for", "The thing you have been putting off since Tuesday"],
    code: "ERR_TIME_WASTED",
    btn: "LOAD PAGE LATER",
    reply: "You said that {score} points ago.",
  },
  {
    head: "Why are you doing this to yourself?",
    label: "Try:",
    items: ["Not this", "Not this either", "Genuinely anything else"],
    code: "ERR_YOU_KNOW_BETTER",
    btn: "KEEP GOING",
    reply: "Of course you are.",
  },
  {
    head: "This is why they don't want you",
    label: "You have spent {min} minutes:",
    items: [
      "Jumping a small dinosaur over a small cactus",
      "Getting good at the thing they hand you when the internet breaks",
      "Calling it a break from something you were not doing anyway",
    ],
    code: "ERR_SEE_WHAT_I_MEAN",
    btn: "KEEP GOING",
    reply: "That's the spirit.",
  },
  {
    head: "You are not going to stop, are you?",
    label: "Understood:",
    items: [
      "There is nothing after the last cactus. You know this.",
      "The dino is not going anywhere. Neither are you.",
      "Nobody is coming to close this tab.",
    ],
    code: "ERR_NO_ONE_IS_COMING",
    btn: "CLOSE TAB",
    reply: "You won't. But it was right there.",
  },
];

var box = document.getElementById("text");
var reply = document.getElementById("reply");
var els = {
  head: document.getElementById("head"),
  label: document.getElementById("label"),
  i0: document.getElementById("i0"),
  i1: document.getElementById("i1"),
  i2: document.getElementById("i2"),
  code: document.getElementById("code"),
  btn: document.getElementById("btnlabel"),
};

var LOCK = {
  head: "Just give up already",
  label: "That run:",
  items: ["{score}. Your best is {hi}.", "That was attempt {runs}.", "It is not going up from here."],
  code: "ERR_RESTART_REFUSED",
  btn: "TRY AGAIN",
  reply: "No.",
};

function fill(str) {
  return str
    .replace(/\{min\}/g, Math.max(1, Math.floor(phaseTime / 60000)))
    .replace(/\{score\}/g, score)
    .replace(/\{runs\}/g, runs)
    .replace(/\{hi\}/g, hi);
}

function apply(p) {
  els.head.textContent = fill(p.head);
  els.label.textContent = fill(p.label);
  els.i0.textContent = fill(p.items[0]);
  els.i1.textContent = fill(p.items[1]);
  els.i2.textContent = fill(p.items[2]);
  els.code.textContent = p.code;
  els.btn.textContent = p.btn;
}

function updatePhase() {
  if (locked) {
    if (lastPhase !== "lock") {
      lastPhase = "lock";
      reply.classList.remove("show");
      box.classList.add("swap");
      setTimeout(function () {
        apply(LOCK);
        box.classList.remove("swap");
      }, 320);
    }
    return;
  }
  var idx = Math.min(PHASES.length - 1, Math.floor(phaseTime / 60000));
  if (idx === lastPhase) {
    var tick = Math.floor(phaseTime / 1000);
    if (tick !== lastTick && !box.classList.contains("swap")) {
      lastTick = tick;
      apply(PHASES[idx]);
    }
    return;
  }
  lastTick = Math.floor(phaseTime / 1000);
  lastPhase = idx;
  reply.classList.remove("show");
  box.classList.add("swap");
  setTimeout(function () {
    apply(PHASES[idx]);
    box.classList.remove("swap");
  }, 320);
}

document.getElementById("btn").addEventListener("click", function () {
  if (locked) {
    refuse();
    return;
  }
  var idx = Math.max(0, lastPhase);
  reply.textContent = fill(PHASES[idx].reply);
  reply.classList.add("show");
});
