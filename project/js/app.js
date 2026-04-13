/**
 * War timeline — RAF motion (translate3d + lerp), geo paths from warData.js
 */
import { wars } from './warData.js';

const LERP = 0.08;
const TOOLTIP_PAD = 14;
const HOVER_RADIUS = 42;

const ICONS = {
  plane: 'icons/plane-2-svgrepo-com.svg',
  tank: 'icons/tank-svgrepo-com.svg',
  soldier: 'icons/helmet-soldier-svgrepo-com.svg',
};

/** Equirectangular bbox — Levant / Sinai / Suez (lat, lng) */
const MAP = {
  latMin: 29.0,
  latMax: 34.6,
  lngMin: 28.5,
  lngMax: 36.8,
};

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function latLngToNxNy(lat, lng) {
  const nx = (lng - MAP.lngMin) / (MAP.lngMax - MAP.lngMin);
  const ny = 1 - (lat - MAP.latMin) / (MAP.latMax - MAP.latMin);
  return { nx: clamp(nx, 0.02, 0.98), ny: clamp(ny, 0.02, 0.98) };
}

function interpLatLngKeyframes(kf, t) {
  if (t <= kf[0].t) {
    return latLngToNxNy(kf[0].lat, kf[0].lng);
  }
  const last = kf[kf.length - 1];
  if (t >= last.t) {
    return latLngToNxNy(last.lat, last.lng);
  }
  for (let i = 0; i < kf.length - 1; i++) {
    const a = kf[i];
    const b = kf[i + 1];
    if (t <= b.t) {
      const u = (t - a.t) / (b.t - a.t);
      const lat = a.lat + (b.lat - a.lat) * u;
      const lng = a.lng + (b.lng - a.lng) * u;
      return latLngToNxNy(lat, lng);
    }
  }
  return latLngToNxNy(last.lat, last.lng);
}

function pathToKeyframes(path, maxDay) {
  const n = path.length;
  if (n === 0) return [];
  if (n === 1) {
    return [
      { t: 0, lat: path[0][0], lng: path[0][1] },
      { t: maxDay, lat: path[0][0], lng: path[0][1] },
    ];
  }
  return path.map((pt, i) => ({
    t: (maxDay * i) / (n - 1),
    lat: pt[0],
    lng: pt[1],
  }));
}

function buildUnitSpecs(war) {
  const maxDay = war.days.length - 1;
  const specs = [];
  war.units.forEach((wu, idx) => {
    const type = wu.type;
    if (!ICONS[type]) return;
    specs.push({
      name: `${war.name.split('(')[0].trim()} — ${type} ${idx + 1}`,
      type,
      speed: typeof wu.speed === 'number' ? wu.speed : 1,
      spawn: 0,
      keyframesLatLng: pathToKeyframes(wu.path, maxDay),
    });
  });
  return specs;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let currentWar = wars.six_day_war;
let unitSpecs = [];
let dayEvents = [];
let maxDay = 5;
let playSpeedDaysPerSec = 0.25;

let battlefield;
let unitsRoot;
let slider;
let tooltip;
let btnPlay;
let btnLabel;
let dayLabelEl;
let dayDateEl;
let timelineStartEl;
let timelineEndEl;
let headerTitleEl;
let headerSubtitleEl;
let warSelector;

let playheadDay = 0;
let isPlaying = false;
let isDragging = false;
let lastTs = 0;
let bw = 1;
let bh = 1;

const units = [];

function measureBattlefield() {
  const r = battlefield.getBoundingClientRect();
  bw = Math.max(1, r.width);
  bh = Math.max(1, r.height);
}

function clearUnits() {
  units.length = 0;
  unitsRoot.replaceChildren();
}

function createUnits(specs) {
  specs.forEach((spec) => {
    const el = document.createElement('div');
    el.className = `unit unit--${spec.type}`;
    const img = document.createElement('img');
    img.src = ICONS[spec.type];
    img.alt = '';
    img.draggable = false;
    el.appendChild(img);
    unitsRoot.appendChild(el);

    measureBattlefield();
    const start = interpLatLngKeyframes(spec.keyframesLatLng, 0);
    const ux = start.nx * bw;
    const uy = start.ny * bh;

    units.push({
      element: el,
      spec,
      x: ux,
      y: uy,
      targetX: ux,
      targetY: uy,
      speed: spec.speed,
      type: spec.type,
      angle: 0,
    });
  });
}

function updateTargets(day) {
  measureBattlefield();
  units.forEach((u) => {
    const p = interpLatLngKeyframes(u.spec.keyframesLatLng, day);
    u.targetX = p.nx * bw;
    u.targetY = p.ny * bh;
    const vis = day >= u.spec.spawn - 0.08;
    u.element.style.opacity = vis ? '1' : '0';
  });
}

function stepUnits() {
  units.forEach((u) => {
    const k = LERP * u.speed;
    u.x += (u.targetX - u.x) * k;
    u.y += (u.targetY - u.y) * k;

    const dx = u.targetX - u.x;
    const dy = u.targetY - u.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (u.type === 'plane') {
      let angle = u.angle;
      if (dist > 0.75) {
        const inv = 1 / dist;
        const ndx = dx * inv;
        const ndy = dy * inv;
        angle = Math.atan2(ndy, ndx);
        u.angle = angle;
      }
      u.element.style.transform = `translate3d(${u.x}px, ${u.y}px, 0) rotate(${angle}rad)`;
    } else {
      u.element.style.transform = `translate3d(${u.x}px, ${u.y}px, 0)`;
    }
  });
}

function setSliderFill() {
  const denom = maxDay > 0 ? maxDay : 1;
  const pct = (playheadDay / denom) * 100;
  slider.style.setProperty('--fill-pct', `${pct}%`);
}

function dayMeta(d) {
  const idx = Math.min(maxDay, Math.max(0, Math.floor(d + 1e-6)));
  return dayEvents[idx] || { title: '', date: '', blurb: '' };
}

function updateDayReadout() {
  const meta = dayMeta(playheadDay);
  dayLabelEl.textContent = meta.title;
  dayDateEl.textContent = meta.date;
  setSliderFill();
}

function syncSliderAria() {
  slider.setAttribute('aria-valuenow', String(Math.round(playheadDay * 1000) / 1000));
  slider.setAttribute('aria-valuemax', String(maxDay));
}

function setPlayUI() {
  btnPlay.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
  btnLabel.textContent = isPlaying ? 'Pause' : 'Play';
}

function hideTooltip() {
  tooltip.classList.remove('is-visible');
  tooltip.setAttribute('aria-hidden', 'true');
}

function showTooltip(html, clientX, clientY) {
  tooltip.innerHTML = html;
  tooltip.classList.add('is-visible');
  tooltip.setAttribute('aria-hidden', 'false');
  const tw = tooltip.offsetWidth;
  const th = tooltip.offsetHeight;
  let left = clientX + TOOLTIP_PAD;
  let top = clientY + TOOLTIP_PAD;
  if (left + tw > window.innerWidth - 8) left = clientX - tw - TOOLTIP_PAD;
  if (top + th > window.innerHeight - 8) top = clientY - th - TOOLTIP_PAD;
  tooltip.style.left = `${Math.max(8, left)}px`;
  tooltip.style.top = `${Math.max(8, top)}px`;
}

function onBattlefieldMove(e) {
  if (isDragging) {
    hideTooltip();
    return;
  }
  measureBattlefield();
  const rect = battlefield.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  let best = null;
  let bestD = HOVER_RADIUS;
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (u.element.style.opacity === '0') continue;
    const d = Math.hypot(u.x - mx, u.y - my);
    if (d < bestD) {
      bestD = d;
      best = u;
    }
  }

  const meta = dayMeta(playheadDay);
  if (best) {
    const html = `<div class="tooltip__title">${escapeHtml(best.spec.name)}</div><div class="tooltip__body">${escapeHtml(meta.blurb)}</div>`;
    showTooltip(html, e.clientX, e.clientY);
  } else {
    hideTooltip();
  }
}

function loadEvents(war) {
  const year = war.name.includes('1973') ? '1973' : '1967';
  dayEvents = war.days.map((dateStr, i) => {
    const ev = war.events.find((e) => e.day === i);
    const text = ev ? ev.text : `Day ${i + 1}`;
    return {
      title: text,
      date: `${dateStr}, ${year}`,
      blurb: ev ? ev.text : text,
    };
  });
}

function updateTimeline(days) {
  if (timelineStartEl && timelineEndEl && days.length) {
    timelineStartEl.textContent = `Day 1 · ${days[0]}`;
    timelineEndEl.textContent = `Day ${days.length} · ${days[days.length - 1]}`;
  }
}

function applyWarHeader(war) {
  if (headerTitleEl) headerTitleEl.textContent = war.name;
  if (headerSubtitleEl) {
    const y = war.name.includes('1973') ? '1973' : '1967';
    headerSubtitleEl.textContent = `${y} — operational timeline`;
  }
}

function loadWar(key) {
  const war = wars[key];
  if (!war) return;

  currentWar = war;
  isPlaying = false;
  setPlayUI();

  maxDay = Math.max(0, war.days.length - 1);
  const durSec = war.duration / 1000;
  playSpeedDaysPerSec = maxDay > 0 && durSec > 0 ? maxDay / durSec : 0.2;

  loadEvents(war);
  updateTimeline(war.days);
  applyWarHeader(war);

  slider.max = String(maxDay * 1000);
  slider.value = '0';
  playheadDay = 0;

  unitSpecs = buildUnitSpecs(war);
  clearUnits();
  createUnits(unitSpecs);

  updateTargets(playheadDay);
  updateDayReadout();
  syncSliderAria();
  hideTooltip();
}

function frame(ts) {
  requestAnimationFrame(frame);
  if (!lastTs) lastTs = ts;
  const rawDt = (ts - lastTs) / 1000;
  lastTs = ts;
  const dt = rawDt > 0.05 ? 0.05 : rawDt;

  if (isPlaying && !isDragging) {
    playheadDay += playSpeedDaysPerSec * dt;
    if (playheadDay >= maxDay) {
      playheadDay = maxDay;
      isPlaying = false;
      setPlayUI();
    }
    slider.value = String(Math.round(playheadDay * 1000));
    syncSliderAria();
    updateTargets(playheadDay);
    updateDayReadout();
  }

  stepUnits();
}

function init() {
  battlefield = document.getElementById('battlefield');
  unitsRoot = document.getElementById('unitsRoot');
  slider = document.getElementById('daySlider');
  tooltip = document.getElementById('tooltip');
  btnPlay = document.getElementById('btnPlayPause');
  btnLabel = document.getElementById('btnPlayPauseLabel');
  dayLabelEl = document.getElementById('dayLabel');
  dayDateEl = document.getElementById('dayDate');
  timelineStartEl = document.getElementById('timelineStart');
  timelineEndEl = document.getElementById('timelineEnd');
  headerTitleEl = document.getElementById('headerTitle');
  headerSubtitleEl = document.getElementById('headerSubtitle');
  warSelector = document.getElementById('warSelector');

  loadWar('six_day_war');
  if (warSelector) warSelector.value = 'six_day_war';

  slider.addEventListener('mousedown', () => {
    isDragging = true;
  });
  slider.addEventListener('pointerdown', () => {
    isDragging = true;
  });
  slider.addEventListener(
    'touchstart',
    () => {
      isDragging = true;
    },
    { passive: true }
  );

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });
  window.addEventListener('pointerup', () => {
    isDragging = false;
  });
  window.addEventListener('pointercancel', () => {
    isDragging = false;
  });
  window.addEventListener('touchend', () => {
    isDragging = false;
  });
  window.addEventListener('touchcancel', () => {
    isDragging = false;
  });

  slider.addEventListener('input', () => {
    isPlaying = false;
    setPlayUI();
    playheadDay = Number(slider.value) / 1000;
    updateTargets(playheadDay);
    updateDayReadout();
    syncSliderAria();
  });

  btnPlay.addEventListener('click', () => {
    isPlaying = !isPlaying;
    if (isPlaying && playheadDay >= maxDay - 0.0001) {
      playheadDay = 0;
      slider.value = '0';
      syncSliderAria();
      updateTargets(playheadDay);
      updateDayReadout();
    }
    setPlayUI();
  });

  if (warSelector) {
    warSelector.addEventListener('change', (e) => {
      loadWar(e.target.value);
    });
  }

  battlefield.addEventListener('mousemove', onBattlefieldMove);
  battlefield.addEventListener('mouseleave', hideTooltip);

  window.addEventListener('resize', () => {
    measureBattlefield();
    updateTargets(playheadDay);
  });

  setPlayUI();
  requestAnimationFrame(frame);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
