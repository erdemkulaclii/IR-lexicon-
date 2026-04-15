/**
 * Units: marker at path start; motion ONLY on .unit-motion.
 * Position follows an off-DOM SVG path (getPointAtLength) built from the same
 * lat/lng vertices Leaflet would draw — zoom/move rebuilds path, not every frame tick.
 */
(function (global) {
  'use strict';

  var Lref = global.L;
  var NS = 'http://www.w3.org/2000/svg';
  if (!Lref) return;

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function applyMoveEasing(t, type) {
    t = Math.max(0, Math.min(1, t));
    if (type === 'plane') return easeInOut(t);
    if (type === 'soldier') {
      var d = 0.14;
      if (t <= d) return 0;
      return (t - d) / (1 - d);
    }
    return t;
  }

  function geoControlPoint(start, end) {
    var s0 = Number(start[0]);
    var s1 = Number(start[1]);
    var e0 = Number(end[0]);
    var e1 = Number(end[1]);
    var midLat = (s0 + e0) * 0.5;
    var midLon = (s1 + e1) * 0.5;
    var dlat = e0 - s0;
    var dlon = e1 - s1;
    var len = Math.sqrt(dlat * dlat + dlon * dlon) || 1;
    var k = 0.11;
    return [midLat + (-dlon / len) * k, midLon + (dlat / len) * k];
  }

  function getGhostSvgRoot() {
    var id = 'irlex-unit-path-ghost-svg';
    var el = global.document.getElementById(id);
    if (!el) {
      el = global.document.createElementNS(NS, 'svg');
      el.id = id;
      el.setAttribute('aria-hidden', 'true');
      el.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none';
      global.document.body.appendChild(el);
    }
    return el;
  }

  function getIconBase() {
    return global.IRLEX_ICON_BASE || './icons/';
  }

  function resolveSoldierIconBySide(side) {
    var s = String(side || '').toLowerCase();
    if (s === 'left') return 'sol.svg';
    if (s === 'right') return 'sağ.svg';
    return 'helmet-soldier-svgrepo-com.svg';
  }

  var UNIT_ICON_FILES = {
    plane: 'plane-2-svgrepo-com.svg',
    tank: 'tank-svgrepo-com.svg',
    soldier: 'helmet-soldier-svgrepo-com.svg'
  };

  var UNIT_SIZES = {
    plane: [34, 34],
    tank: [32, 32],
    soldier: [30, 30]
  };

  var UNIT_HEADING_OFFSET_RAD = {
    plane: Math.PI / 2,
    tank: 0,
    soldier: 0
  };

  var Z_PLANE = 950;
  var Z_TANK = 620;
  var Z_SOLDIER = 380;

  var SCALE_PLANE = 1.2;
  var SCALE_TANK = 1.0;
  var SCALE_SOLDIER = 0.95;

  function spawnImpactPulse(map, latlng, layerGroup) {
    if (!map || !latlng) return;
    var size = 36;
    var icon = Lref.divIcon({
      className: 'unit-impact-marker',
      html:
        '<div class="unit-impact">' +
        '<div class="unit-impact-pulse"></div>' +
        '<div class="unit-impact-core"></div>' +
        '</div>',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
    var marker = Lref.marker(latlng, {
      icon: icon,
      interactive: false,
      keyboard: false,
      zIndexOffset: 920
    });
    if (layerGroup) marker.addTo(layerGroup);
    else marker.addTo(map);
    global.setTimeout(function () {
      try {
        marker.remove();
      } catch (e) {}
    }, 700);
  }

  function Unit(map, type, coordsPath, options) {
    options = options || {};
    this._map = map;
    this._type = type;
    var raw = coordsPath && coordsPath.length ? coordsPath.slice() : [[0, 0], [0, 0]];
    this._latLngPath = raw;
    this._start = [Number(raw[0][0]), Number(raw[0][1])];
    var last = raw[raw.length - 1];
    this._end = [Number(last[0]), Number(last[1])];
    this._ctrlLL = type === 'plane' && raw.length === 2 ? geoControlPoint(this._start, this._end) : null;
    this._label = options.label || '';
    this._startTime = Number.isFinite(options.evtStart) ? options.evtStart : 0;
    this._duration = Math.max(1, (Number.isFinite(options.evtEnd) ? options.evtEnd : 1) - this._startTime);
    this._marker = null;
    this._trail = null;
    this._trailHist = [];
    this._arrivalFxFired = false;
    this._fxLayer = options.fxLayer || null;
    this._motionEl = null;
    this.el = null;
    this._svgPath = null;
    this._pathLen = 0;
    this._boundRebuild = this._rebuildFollowPath.bind(this);

    var ci = Number.isFinite(options.clusterIndex) ? options.clusterIndex : 0;
    this._clusterOffX = type === 'soldier' ? ((ci % 4) - 1.5) * 9 : 0;
    this._clusterOffY = type === 'soldier' ? (Math.floor(ci / 4) % 3 - 1) * 8 : 0;

    var zOff = type === 'plane' ? Z_PLANE : type === 'tank' ? Z_TANK : Z_SOLDIER;
    var depthClass = type === 'plane' ? 'unit-plane' : type === 'tank' ? 'unit-tank' : 'unit-soldier';

    var sz = UNIT_SIZES[type] || [28, 28];
    if (type === 'soldier') {
      var sideNorm = String(options.side || '').toLowerCase();
      if (sideNorm === 'left' || sideNorm === 'right') sz = [64, 64];
    }
    var base = getIconBase();
    var file = type === 'soldier'
      ? resolveSoldierIconBySide(options.side)
      : (UNIT_ICON_FILES[type] || UNIT_ICON_FILES.soldier);
    var iconPath = base + file;

    /* side: 'left'→Sol, 'right'→Ülkücü, 'army'→Ordu — CSS filtresi ile renk tonu */
    var sideNormClass = String(options.side || '').toLowerCase();
    var sideAttr = options.side ? ' data-side="' + options.side + '"' : '';
    var motionClass = 'unit-motion' + (sideNormClass ? ' side-' + sideNormClass : '');

    var icon = Lref.divIcon({
      className: 'unit-icon unit-icon-root ' + type + ' ' + depthClass,
      html:
        '<div class="unit ' +
        depthClass +
        '">' +
        '<div class="' + motionClass + '">' +
        '<img src="' +
        iconPath +
        '" alt="" class="unit-img ' +
        type +
        '" draggable="false"' +
        sideAttr +
        '/>' +
        '</div></div>',
      iconSize: sz,
      iconAnchor: [sz[0] / 2, sz[1] / 2]
    });

    this._marker = Lref.marker(this._start, { icon: icon, interactive: true, zIndexOffset: zOff });
    this._marker.bindTooltip(this._label || type, {
      className: 'unit-tooltip',
      direction: 'top',
      offset: [0, -sz[1] / 2 - 4]
    });

    this._svgPath = global.document.createElementNS(NS, 'path');
    this._svgPath.setAttribute('fill', 'none');
    this._svgPath.setAttribute('stroke', 'none');
    getGhostSvgRoot().appendChild(this._svgPath);

    if (type === 'plane' && this._fxLayer) {
      try {
        this._trail = Lref.polyline([this._start], {
          color: '#7dd3fc',
          weight: 2,
          opacity: 0.55,
          interactive: false,
          className: 'unit-plane-trail unit-plane-trail-live'
        });
      } catch (e) {
        this._trail = null;
      }
    }
    if (type === 'tank' && this._fxLayer) {
      try {
        this._trail = Lref.polyline([this._start], {
          color: '#f97316',
          weight: 2.5,
          opacity: 0.5,
          dashArray: '6 5',
          interactive: false,
          className: 'unit-tank-trail unit-plane-trail-live'
        });
      } catch (e) {
        this._trail = null;
      }
    }
  }

  Unit.prototype._rebuildFollowPath = function () {
    if (!this._map || !this._svgPath || !this._latLngPath || this._latLngPath.length < 2) {
      this._pathLen = 0;
      return;
    }
    var raw = this._latLngPath;
    var p0 = this._map.latLngToLayerPoint(Lref.latLng(raw[0][0], raw[0][1]));
    var dAttr;

    if (this._type === 'plane' && raw.length === 2 && this._ctrlLL) {
      var mid = this._map.latLngToLayerPoint(Lref.latLng(this._ctrlLL[0], this._ctrlLL[1]));
      var end = this._map.latLngToLayerPoint(Lref.latLng(raw[1][0], raw[1][1]));
      dAttr =
        'M 0 0 Q ' +
        (mid.x - p0.x) +
        ' ' +
        (mid.y - p0.y) +
        ' ' +
        (end.x - p0.x) +
        ' ' +
        (end.y - p0.y);
    } else {
      var parts = ['M 0 0'];
      for (var i = 1; i < raw.length; i++) {
        var pi = this._map.latLngToLayerPoint(Lref.latLng(Number(raw[i][0]), Number(raw[i][1])));
        parts.push('L ' + (pi.x - p0.x) + ' ' + (pi.y - p0.y));
      }
      dAttr = parts.join(' ');
    }

    this._svgPath.setAttribute('d', dAttr);
    try {
      this._pathLen = this._svgPath.getTotalLength() || 0;
    } catch (e) {
      this._pathLen = 0;
    }
  };

  Unit.prototype._resolveMotionEl = function () {
    if (this.el && this._motionEl) return this.el;
    try {
      var root = this._marker && this._marker.getElement && this._marker.getElement();
      if (!root) {
        this._motionEl = null;
        this.el = null;
        return null;
      }
      var motion = root.querySelector('.unit-motion');
      this._motionEl = motion;
      this.el = motion;
    } catch (err) {
      this._motionEl = null;
      this.el = null;
    }
    return this.el;
  };

  Unit.prototype.addTo = function (layerGroup) {
    if (this._trail && layerGroup) this._trail.addTo(layerGroup);
    if (this._marker) this._marker.addTo(layerGroup);
    this._resolveMotionEl();
    if (this._map) {
      this._map.on('zoomend', this._boundRebuild);
      this._map.on('moveend', this._boundRebuild);
      this._map.on('resize', this._boundRebuild);
    }
    this._rebuildFollowPath();
    return this;
  };

  Unit.prototype.start = function () {
    return this;
  };
  Unit.prototype.stop = function () {
    return this;
  };

  Unit.prototype.remove = function () {
    if (this._map && this._boundRebuild) {
      this._map.off('zoomend', this._boundRebuild);
      this._map.off('moveend', this._boundRebuild);
      this._map.off('resize', this._boundRebuild);
    }
    try {
      if (this._svgPath && this._svgPath.parentNode) this._svgPath.parentNode.removeChild(this._svgPath);
    } catch (e) {}
    this._svgPath = null;
    try {
      if (this._marker && this._marker._map) this._marker.remove();
    } catch (e) {}
    try {
      if (this._trail && this._trail._map) this._trail.remove();
    } catch (e) {}
    try {
      if (this._debugLine && this._debugLine._map) this._debugLine.remove();
    } catch (e) {}
    this._marker = null;
    this._trail = null;
    this._trailHist = [];
    this._debugLine = null;
    this._motionEl = null;
    this.el = null;
  };

  Unit.prototype.syncToTimeline = function (globalMs) {
    if (!this._marker || !this._map || !this._svgPath) return;
    var tRaw = (globalMs - this._startTime) / this._duration;
    tRaw = Math.max(0, Math.min(1, tRaw));
    if (tRaw < 0.04 && this._type === 'plane' && this._trail) {
      this._trailHist.length = 0;
      try {
        this._trail.setLatLngs([this._start]);
      } catch (e) {}
    }
    var u = applyMoveEasing(tRaw, this._type);

    var len = this._pathLen;
    if (!len || !isFinite(len)) {
      this._rebuildFollowPath();
      len = this._pathLen;
    }
    if (!len) return;

    var dist = u * len;
    var pt = this._svgPath.getPointAtLength(dist);
    var tx = pt.x + this._clusterOffX;
    var ty = pt.y + this._clusterOffY;

    var delta = Math.max(1.2, len * 0.01);
    var pA = this._svgPath.getPointAtLength(Math.min(len, dist));
    var pB = this._svgPath.getPointAtLength(Math.min(len, dist + delta));
    var angleRad = Math.atan2(pB.y - pA.y, pB.x - pA.x) + (UNIT_HEADING_OFFSET_RAD[this._type] || 0);
    if (this._type === 'plane') {
      angleRad += Math.sin(globalMs * 0.005) * ((4 * Math.PI) / 180);
    }

    var sc = this._type === 'plane' ? SCALE_PLANE : this._type === 'soldier' ? SCALE_SOLDIER : SCALE_TANK;

    var motion = this._resolveMotionEl();
    if (motion) {
      motion.style.transform =
        'translate3d(' + tx + 'px,' + ty + 'px,0) rotate(' + angleRad + 'rad) scale(' + sc + ')';
    }

    if ((this._type === 'plane' || this._type === 'tank') && this._trail && this._trailHist) {
      var p0 = this._map.latLngToLayerPoint(Lref.latLng(this._start[0], this._start[1]));
      var absLp = Lref.point(p0.x + tx, p0.y + ty);
      var ll = this._map.layerPointToLatLng(absLp);
      this._trailHist.push([ll.lat, ll.lng]);
      var maxHist = this._type === 'tank' ? 18 : 10;
      if (this._trailHist.length > maxHist) this._trailHist.shift();
      if (this._trailHist.length >= 2) {
        try {
          this._trail.setLatLngs(this._trailHist);
        } catch (e) {}
      }
    }

    if (tRaw >= 0.998 && !this._arrivalFxFired) {
      this._arrivalFxFired = true;
      var p0b = this._map.latLngToLayerPoint(Lref.latLng(this._start[0], this._start[1]));
      var llHit = this._map.layerPointToLatLng(Lref.point(p0b.x + tx, p0b.y + ty));
      spawnImpactPulse(this._map, llHit, this._fxLayer);
    }
    if (tRaw < 0.12) this._arrivalFxFired = false;
  };

  function UnitManager() {
    this._units = [];
    this._layerGroup = null;
    this._soldierClusterIdx = 0;
  }

  UnitManager.prototype.setLayerGroup = function (lg) {
    this._layerGroup = lg;
  };

  UnitManager.prototype.addUnit = function (map, type, coordsPath, opts) {
    opts = opts || {};
    opts.fxLayer = this._layerGroup;
    if (type === 'soldier') {
      opts.clusterIndex = this._soldierClusterIdx++;
    }
    var unit = new Unit(map, type, coordsPath, opts);
    if (opts.debugPath && Lref && map && coordsPath && coordsPath.length > 1) {
      try {
        unit._debugLine = Lref.polyline(coordsPath, {
          color: 'rgba(250,204,121,0.4)',
          weight: 1.5,
          opacity: 0.65,
          dashArray: '4 6',
          interactive: false
        });
        if (this._layerGroup) unit._debugLine.addTo(this._layerGroup);
      } catch (e) {}
    }
    if (this._layerGroup) unit.addTo(this._layerGroup);
    this._units.push(unit);
    return unit;
  };

  UnitManager.prototype.syncAll = function (globalMs) {
    for (var i = 0; i < this._units.length; i++) {
      this._units[i].syncToTimeline(globalMs);
    }
  };

  UnitManager.prototype.clearAll = function () {
    for (var i = 0; i < this._units.length; i++) {
      this._units[i].remove();
    }
    this._units = [];
    this._soldierClusterIdx = 0;
  };

  global.IRLEX_Units = {
    Unit: Unit,
    UnitManager: UnitManager,
    easeInOut: easeInOut
  };
})(typeof window !== 'undefined' ? window : this);
