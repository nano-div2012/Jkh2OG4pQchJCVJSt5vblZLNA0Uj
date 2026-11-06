/* Local persistence shared by every screen. Falls back to memory if storage is blocked. */
(function (global) {
  'use strict';

  var PREFIX = 'skycourier.';
  var memory = {};

  var DEFAULTS = {
    settings: { sound: true, difficulty: 'normal' },
    scores: [],
    lastRun: null
  };

  function read(key) {
    try {
      var raw = global.localStorage.getItem(PREFIX + key);
      if (raw !== null) return JSON.parse(raw);
    } catch (err) { /* storage unavailable, use memory */ }
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : DEFAULTS[key];
  }

  function write(key, value) {
    memory[key] = value;
    try {
      global.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (err) { /* keep memory copy */ }
  }

  var Store = {
    getSettings: function () {
      var saved = read('settings') || {};
      return {
        sound: saved.sound !== false,
        difficulty: ['easy', 'normal', 'hard'].indexOf(saved.difficulty) >= 0 ? saved.difficulty : 'normal'
      };
    },
    saveSettings: function (settings) { write('settings', settings); },

    getScores: function () {
      var list = read('scores');
      return Array.isArray(list) ? list : [];
    },
    getBest: function () {
      var list = Store.getScores();
      return list.length ? list[0].score : 0;
    },
    addScore: function (entry) {
      var list = Store.getScores();
      var wasBest = !list.length || entry.score > list[0].score;
      list.push(entry);
      list.sort(function (a, b) { return b.score - a.score; });
      write('scores', list.slice(0, 10));
      return wasBest && entry.score > 0;
    },
    setLastRun: function (run) { write('lastRun', run); },
    getLastRun: function () { return read('lastRun'); },
    resetAll: function () {
      memory = {};
      try {
        ['settings', 'scores', 'lastRun'].forEach(function (k) {
          global.localStorage.removeItem(PREFIX + k);
        });
      } catch (err) { /* nothing to clear */ }
    }
  };

  global.SkyStore = Store;
})(window);
