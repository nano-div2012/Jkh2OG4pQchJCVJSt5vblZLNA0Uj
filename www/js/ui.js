/* Shared UI helpers: landscape guard, sound effects, orientation lock. */
(function (global) {
  'use strict';

  var audioCtx = null;

  function ensureAudio() {
    if (audioCtx) return audioCtx;
    var Ctx = global.AudioContext || global.webkitAudioContext;
    if (!Ctx) return null;
    try { audioCtx = new Ctx(); } catch (err) { audioCtx = null; }
    return audioCtx;
  }

  function tone(freq, duration, type, volume) {
    if (!global.SkyStore.getSettings().sound) return;
    var ctx = ensureAudio();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume || 0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  function addRotateGuard() {
    if (document.getElementById('rotate-guard')) return;
    var guard = document.createElement('div');
    guard.id = 'rotate-guard';
    guard.setAttribute('role', 'alert');
    guard.textContent = 'Putar HP ke mode landscape (miring) untuk bermain Sky Courier.';
    document.body.appendChild(guard);
  }

  function tryLockLandscape() {
    try {
      if (global.screen && global.screen.orientation && global.screen.orientation.lock) {
        global.screen.orientation.lock('landscape').catch(function () {});
      }
    } catch (err) { /* not supported */ }
  }

  global.SkyUI = {
    coin: function () { tone(880, 0.12, 'triangle', 0.14); setTimeout(function () { tone(1175, 0.14, 'triangle', 0.12); }, 70); },
    crash: function () { tone(140, 0.35, 'sawtooth', 0.16); },
    click: function () { tone(520, 0.06, 'square', 0.06); },
    unlockAudio: function () { var c = ensureAudio(); if (c && c.state === 'suspended') c.resume(); },
    isPortrait: function () { return global.innerHeight > global.innerWidth; }
  };

  document.addEventListener('DOMContentLoaded', function () {
    addRotateGuard();
    document.addEventListener('pointerdown', tryLockLandscape, { once: true });
    document.addEventListener('click', function (event) {
      if (event.target.closest && event.target.closest('.btn')) global.SkyUI.click();
    });
  });
})(window);
