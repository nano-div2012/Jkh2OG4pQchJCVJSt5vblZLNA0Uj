/* Sky Courier - game engine (single canvas, classic script for file:// compatibility). */
(function () {
  'use strict';

  var WORLD_H = 360;
  var GROUND_H = 30;
  var PILLAR_W = 56;
  var SPACING = 290;

  var DIFFICULTY = {
    easy:   { speed: 130, gap: 160, grow: 3 },
    normal: { speed: 160, gap: 134, grow: 4 },
    hard:   { speed: 190, gap: 114, grow: 5 }
  };

  var canvas = document.getElementById('stage');
  var ctx = canvas.getContext('2d');
  var pauseBtn = document.getElementById('btn-pause');
  var pauseOverlay = document.getElementById('pause-overlay');
  var resumeBtn = document.getElementById('btn-resume');

  var settings = SkyStore.getSettings();
  var cfg = DIFFICULTY[settings.difficulty];
  var best = SkyStore.getBest();

  var viewW = 0;
  var state = 'ready'; // ready | running | paused | crashed
  var holding = false;
  var lastTime = 0;
  var elapsed = 0;
  var distance = 0;
  var coinCount = 0;
  var flash = 0;

  var plane = { x: 100, y: WORLD_H / 2, vy: 0 };
  var pillars = [];
  var coins = [];
  var clouds = [];

  function rand(min, max) { return min + Math.random() * (max - min); }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = window.innerWidth;
    var h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    var scale = h / WORLD_H;
    viewW = w / scale;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    plane.x = Math.max(90, viewW * 0.2);
    if (!clouds.length) seedClouds();
    if (SkyUI.isPortrait() && state === 'running') pauseGame();
  }

  function seedClouds() {
    for (var i = 0; i < 6; i++) {
      clouds.push({ x: rand(0, viewW + 200), y: rand(20, 170), s: rand(0.7, 1.3), v: rand(8, 20) });
    }
  }

  function resetRun() {
    plane.y = WORLD_H / 2;
    plane.vy = 0;
    pillars = [];
    coins = [];
    elapsed = 0;
    distance = 0;
    coinCount = 0;
  }

  function spawnPillar(x) {
    var gap = cfg.gap;
    var min = 28 + gap / 2;
    var max = WORLD_H - GROUND_H - 28 - gap / 2;
    var center = rand(min, max);
    pillars.push({ x: x, gapTop: center - gap / 2, gapH: gap });
    coins.push({ x: x + PILLAR_W / 2, y: center, taken: false });
    coins.push({ x: x + SPACING / 2 + PILLAR_W / 2, y: rand(70, WORLD_H - GROUND_H - 50), taken: false });
  }

  function currentSpeed() {
    return cfg.speed + Math.min(elapsed * cfg.grow, 120);
  }

  function score() {
    return Math.floor(distance / 10) + coinCount * 5;
  }

  function startRun() {
    resetRun();
    spawnPillar(viewW + 120);
    state = 'running';
  }

  function crash() {
    if (state === 'crashed') return;
    state = 'crashed';
    holding = false;
    flash = 1;
    SkyUI.crash();

    var finalScore = score();
    var entry = { score: finalScore, coins: coinCount, distance: Math.floor(distance / 10), date: Date.now() };
    var isRecord = SkyStore.addScore(entry);
    SkyStore.setLastRun({
      score: finalScore,
      coins: coinCount,
      distance: entry.distance,
      best: Math.max(best, finalScore),
      isRecord: isRecord
    });
    setTimeout(function () { window.location.href = 'result.html'; }, 850);
  }

  function update(dt) {
    if (state !== 'running') return;
    elapsed += dt;
    var speed = currentSpeed();
    distance += speed * dt;

    plane.vy += (holding ? -900 : 640) * dt;
    plane.vy = Math.max(-250, Math.min(310, plane.vy));
    plane.y += plane.vy * dt;
    if (plane.y < 14) { plane.y = 14; plane.vy = 0; }
    if (plane.y > WORLD_H - GROUND_H - 8) { crash(); return; }

    var i;
    for (i = pillars.length - 1; i >= 0; i--) {
      pillars[i].x -= speed * dt;
      if (pillars[i].x + PILLAR_W < -20) pillars.splice(i, 1);
    }
    var last = pillars[pillars.length - 1];
    if (!last || last.x < viewW - SPACING) spawnPillar(viewW + 40);

    for (i = coins.length - 1; i >= 0; i--) {
      var c = coins[i];
      c.x -= speed * dt;
      if (c.x < -20) { coins.splice(i, 1); continue; }
      if (!c.taken) {
        var dx = c.x - plane.x;
        var dy = c.y - plane.y;
        if (dx * dx + dy * dy < 22 * 22) {
          c.taken = true;
          coinCount++;
          SkyUI.coin();
        }
      }
    }

    var left = plane.x - 17, right = plane.x + 17, top = plane.y - 7, bottom = plane.y + 7;
    for (i = 0; i < pillars.length; i++) {
      var p = pillars[i];
      if (right > p.x && left < p.x + PILLAR_W && (top < p.gapTop || bottom > p.gapTop + p.gapH)) {
        crash();
        return;
      }
    }
  }

  /* ---------- Drawing ---------- */

  function drawSky() {
    var g = ctx.createLinearGradient(0, 0, 0, WORLD_H);
    g.addColorStop(0, '#34527c');
    g.addColorStop(0.55, '#d79a63');
    g.addColorStop(1, '#f4d9a6');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, viewW, WORLD_H);

    ctx.fillStyle = '#f8e3b2';
    ctx.beginPath();
    ctx.arc(viewW * 0.78, 210, 38, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMountains(factor, baseY, height, color) {
    var period = 420;
    var offset = (distance * factor) % period;
    ctx.fillStyle = color;
    for (var x = -offset - period; x < viewW + period; x += period) {
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x + period * 0.18, baseY - height * 0.7);
      ctx.lineTo(x + period * 0.34, baseY - height * 0.3);
      ctx.lineTo(x + period * 0.55, baseY - height);
      ctx.lineTo(x + period * 0.78, baseY - height * 0.4);
      ctx.lineTo(x + period, baseY);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawClouds(dt) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    clouds.forEach(function (c) {
      if (state === 'running') c.x -= c.v * dt;
      if (c.x < -120) { c.x = viewW + rand(20, 120); c.y = rand(20, 170); }
      var r = 14 * c.s;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.arc(c.x + r * 1.2, c.y - r * 0.4, r * 1.2, 0, Math.PI * 2);
      ctx.arc(c.x + r * 2.4, c.y, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawGround() {
    var y = WORLD_H - GROUND_H;
    ctx.fillStyle = '#3f5b46';
    ctx.fillRect(0, y, viewW, GROUND_H);
    ctx.fillStyle = '#58784f';
    ctx.fillRect(0, y, viewW, 6);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    var offset = distance % 40;
    for (var x = -offset; x < viewW; x += 40) ctx.fillRect(x, y + 16, 18, 3);
  }

  function drawPillar(p) {
    var bottomY = p.gapTop + p.gapH;
    var groundY = WORLD_H - GROUND_H;
    ctx.fillStyle = '#6a5a4c';
    ctx.fillRect(p.x, 0, PILLAR_W, p.gapTop);
    ctx.fillRect(p.x, bottomY, PILLAR_W, groundY - bottomY);
    ctx.fillStyle = '#54463a';
    ctx.fillRect(p.x + PILLAR_W - 10, 0, 10, p.gapTop);
    ctx.fillRect(p.x + PILLAR_W - 10, bottomY, 10, groundY - bottomY);
    ctx.fillStyle = '#85735f';
    ctx.fillRect(p.x - 5, p.gapTop - 16, PILLAR_W + 10, 16);
    ctx.fillRect(p.x - 5, bottomY, PILLAR_W + 10, 16);
    ctx.strokeStyle = '#2f261f';
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x - 5, p.gapTop - 16, PILLAR_W + 10, 16);
    ctx.strokeRect(p.x - 5, bottomY, PILLAR_W + 10, 16);
  }

  function drawCoin(c) {
    if (c.taken) return;
    ctx.fillStyle = '#e3a82a';
    ctx.beginPath();
    ctx.arc(c.x, c.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a6212';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#f3cd6a';
    ctx.beginPath();
    ctx.arc(c.x - 2, c.y - 2, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlane(time) {
    ctx.save();
    ctx.translate(plane.x, plane.y);
    ctx.rotate(Math.max(-0.45, Math.min(0.5, plane.vy / 600)));

    ctx.fillStyle = '#b8402f';
    ctx.beginPath();
    ctx.moveTo(-20, -2);
    ctx.lineTo(-6, -8);
    ctx.lineTo(16, -6);
    ctx.lineTo(20, 0);
    ctx.lineTo(16, 6);
    ctx.lineTo(-6, 8);
    ctx.lineTo(-20, 3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#2f1712';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#e2c78f';
    ctx.fillRect(-8, 2, 18, 4);
    ctx.strokeRect(-8, 2, 18, 4);

    ctx.fillStyle = '#8f2f22';
    ctx.beginPath();
    ctx.moveTo(-20, -2);
    ctx.lineTo(-27, -12);
    ctx.lineTo(-15, -6);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#cfe3ee';
    ctx.beginPath();
    ctx.arc(4, -5, 4, 0, Math.PI * 2);
    ctx.fill();

    var spin = Math.sin(time / 28) * 9;
    ctx.strokeStyle = '#2b2b2b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(21, -spin);
    ctx.lineTo(21, spin);
    ctx.stroke();
    ctx.restore();
  }

  function drawHud() {
    ctx.fillStyle = 'rgba(29, 43, 69, 0.78)';
    ctx.fillRect(10, 10, 190, 52);
    ctx.fillStyle = '#f7f0e1';
    ctx.font = 'bold 17px "Trebuchet MS", Arial, sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText('Skor  ' + score(), 20, 17);
    ctx.fillStyle = '#e8b948';
    ctx.font = 'bold 13px "Trebuchet MS", Arial, sans-serif';
    ctx.fillText('Koin ' + coinCount + '   Rekor ' + Math.max(best, score()), 20, 40);
  }

  function drawReadyHint() {
    if (state !== 'ready') return;
    ctx.fillStyle = 'rgba(29, 43, 69, 0.82)';
    var w = 300, h = 58;
    ctx.fillRect(viewW / 2 - w / 2, 120, w, h);
    ctx.fillStyle = '#f7f0e1';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 18px "Trebuchet MS", Arial, sans-serif';
    ctx.fillText('Tahan layar untuk naik', viewW / 2, 140);
    ctx.font = '13px "Trebuchet MS", Arial, sans-serif';
    ctx.fillText('Lepas untuk turun. Sentuh untuk mulai.', viewW / 2, 162);
  }

  function render(dt, time) {
    drawSky();
    drawMountains(0.15, 250, 120, '#4c628a');
    drawMountains(0.3, 290, 90, '#33476b');
    drawClouds(dt);
    pillars.forEach(drawPillar);
    coins.forEach(drawCoin);
    drawGround();
    drawPlane(time);
    drawHud();
    drawReadyHint();
    if (flash > 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, ' + (flash * 0.6) + ')';
      ctx.fillRect(0, 0, viewW, WORLD_H);
      flash = Math.max(0, flash - dt * 2.5);
    }
  }

  function frame(now) {
    var dt = Math.min(0.033, (now - lastTime) / 1000 || 0);
    lastTime = now;
    if (state !== 'paused') {
      update(dt);
      render(dt, now);
    }
    window.requestAnimationFrame(frame);
  }

  /* ---------- Input and pause ---------- */

  function press() {
    if (state === 'paused' || state === 'crashed') return;
    SkyUI.unlockAudio();
    holding = true;
    if (state === 'ready') startRun();
  }

  function release() { holding = false; }

  function pauseGame() {
    if (state !== 'running') return;
    state = 'paused';
    holding = false;
    pauseOverlay.hidden = false;
  }

  function resumeGame() {
    if (state !== 'paused') return;
    pauseOverlay.hidden = true;
    state = 'running';
    lastTime = performance.now();
  }

  canvas.addEventListener('pointerdown', function (event) { event.preventDefault(); press(); });
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  window.addEventListener('keydown', function (event) {
    if (event.code === 'Space' || event.code === 'ArrowUp') { event.preventDefault(); if (!event.repeat) press(); }
    if (event.code === 'Escape') { state === 'paused' ? resumeGame() : pauseGame(); }
  });
  window.addEventListener('keyup', function (event) {
    if (event.code === 'Space' || event.code === 'ArrowUp') release();
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden) pauseGame(); });
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 150); });

  pauseBtn.addEventListener('click', pauseGame);
  resumeBtn.addEventListener('click', resumeGame);

  resize();
  window.requestAnimationFrame(frame);
})();
