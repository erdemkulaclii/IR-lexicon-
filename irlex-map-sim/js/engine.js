/**
 * War timeline: calendar-weighted segments on the sim clock, unit events for EventManager.
 * window.IRLEX_WARS from wars.js
 */
(function (global) {
  'use strict';

  function parseIso(iso) {
    return new Date(String(iso).trim() + 'T12:00:00').getTime();
  }

  function formatYmd(ms) {
    var d = new Date(ms);
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    var ms = m < 10 ? '0' + m : '' + m;
    var ds = day < 10 ? '0' + day : '' + day;
    return y + '-' + ms + '-' + ds;
  }

  /** Base ms duration per unit type; scaled by war temperament. */
  function getSpeedByType(type, warType) {
    var base =
      type === 'plane' ? 3000 : type === 'tank' ? 8000 : type === 'soldier' ? 12000 : 9000;
    var mul = 1;
    if (warType === 'blitz') mul = 0.82;
    else if (warType === 'war') mul = 1;
    else if (warType === 'counter_attack') mul = 1.12;
    return Math.round(base * mul);
  }

  /** Calendar-length weight multiplier for timeline segment share. */
  function warTypeSegmentWeight(warType) {
    if (warType === 'blitz') return 0.55;
    if (warType === 'counter_attack') return 1.15;
    return 1;
  }

  function getWars() {
    return global.IRLEX_WARS || [];
  }

  function getTimelineBoundsMs() {
    var wars = getWars();
    if (!wars.length) return { start: 0, end: 1 };
    var start = Infinity;
    var end = -Infinity;
    for (var i = 0; i < wars.length; i++) {
      var w = wars[i];
      var a = parseIso(w.start);
      var b = parseIso(w.end);
      if (a < start) start = a;
      if (b > end) end = b;
    }
    return { start: start, end: end };
  }

  /** Progress 0..1 over full calendar span (all wars). */
  function getDateStringFromProgress(p) {
    var b = getTimelineBoundsMs();
    var span = b.end - b.start;
    if (span <= 0) return formatYmd(b.start);
    var t = b.start + span * Math.max(0, Math.min(1, p));
    return formatYmd(t);
  }

  /** Which war id contains this calendar date (by midpoint rule). */
  function resolveWarIdAtProgress(p) {
    var b = getTimelineBoundsMs();
    var span = b.end - b.start;
    if (span <= 0) return null;
    var t = b.start + span * Math.max(0, Math.min(1, p));
    var wars = getWars();
    for (var i = 0; i < wars.length; i++) {
      var w = wars[i];
      if (t >= parseIso(w.start) && t <= parseIso(w.end)) return w.id;
    }
    for (var j = 0; j < wars.length; j++) {
      var w2 = wars[j];
      if (t < parseIso(w2.start)) return w2.id;
    }
    return wars.length ? wars[wars.length - 1].id : null;
  }

  function warToPhaseIndex(warId) {
    var order = ['1948', '1956', '1967', '1973'];
    var idx = order.indexOf(warId);
    return idx < 0 ? 0 : idx;
  }

  /**
   * Push type:'unit' events onto EventManager.events (non-destructive append).
   * Skips if wars missing.
   */
  function appendTimelineUnitEvents(eventManager, totalTimelineMs) {
    var wars = getWars();
    if (!wars.length || !eventManager || !Array.isArray(eventManager.events)) return;

    var weighted = [];
    var sum = 0;
    for (var i = 0; i < wars.length; i++) {
      var w = wars[i];
      var cal = Math.max(1, parseIso(w.end) - parseIso(w.start));
      var wt = cal * warTypeSegmentWeight(w.type);
      weighted.push({ war: w, weight: wt });
      sum += wt;
    }
    if (sum <= 0) return;

    var cursor = 0;
    var ei = 0;
    for (var wi = 0; wi < weighted.length; wi++) {
      var item = weighted[wi];
      var war = item.war;
      var segLen = (item.weight / sum) * totalTimelineMs;
      var segStart = cursor;
      var segEnd = cursor + segLen;
      cursor = segEnd;

      var phaseIndex = warToPhaseIndex(war.id);
      var fronts = war.fronts || [];
      for (var fi = 0; fi < fronts.length; fi++) {
        var front = fronts[fi];
        var path = front.path;
        if (!path || path.length < 2) continue;
        var types = front.units || [];
        for (var ti = 0; ti < types.length; ti++) {
          var ut = types[ti];
          var spd = getSpeedByType(ut, war.type);
          var inner = segEnd - segStart;
          var frac = Math.max(0.32, Math.min(1.15, spd / 8000));
          var unitSpan = Math.max(2500, inner * frac);
          var margin = (inner - unitSpan) * 0.5;
          var evStart = segStart + Math.max(0, margin);
          var evEnd = Math.min(segEnd, evStart + unitSpan);

          eventManager.events.push({
            id: 'war_' + war.id + '_f' + fi + '_' + ut + '_' + ei,
            type: 'unit',
            phaseIndex: phaseIndex,
            startTime: evStart,
            endTime: evEnd,
            data: {
              unitType: ut,
              path: path,
              label: (front.name || 'Front') + ' · ' + ut,
              speed: spd,
              warId: war.id
            },
            style: { fadeIn: 280 },
            meta: { title: war.name + ': ' + (front.name || '') }
          });
          ei++;
        }
      }
    }
  }

  /**
   * Optional: dynamic war switch hook (e.g. UI label). Does not reload units when
   * events are pre-baked — only invokes callback when resolved id changes.
   */
  function trackWarProgress(progress, callback) {
    if (typeof callback !== 'function') return;
    var id = resolveWarIdAtProgress(progress);
    if (id !== trackWarProgress._last) {
      trackWarProgress._last = id;
      callback(id, getDateStringFromProgress(progress));
    }
  }
  trackWarProgress._last = null;
  trackWarProgress.reset = function () {
    trackWarProgress._last = null;
  };

  /** Read-only mirror for devtools; timeline in app remains authoritative. */
  var Simulation = {
    progress: 0,
    duration: 40000,
    isPlaying: false,
    startTime: null
  };

  function syncSimulationMirror(progress, duration, isPlaying) {
    Simulation.progress = progress;
    Simulation.duration = duration;
    Simulation.isPlaying = !!isPlaying;
    global.IRLEX_Simulation = Simulation;
  }

  global.IRLEX_WarEngine = {
    getSpeedByType: getSpeedByType,
    warTypeSegmentWeight: warTypeSegmentWeight,
    getTimelineBoundsMs: getTimelineBoundsMs,
    getDateStringFromProgress: getDateStringFromProgress,
    resolveWarIdAtProgress: resolveWarIdAtProgress,
    appendTimelineUnitEvents: appendTimelineUnitEvents,
    trackWarProgress: trackWarProgress,
    syncSimulationMirror: syncSimulationMirror,
    Simulation: Simulation
  };
})(typeof window !== 'undefined' ? window : this);
