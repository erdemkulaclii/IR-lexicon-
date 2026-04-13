/**
 * Arab-Israeli conflict timeline data — paths are [lat, lng] (Leaflet order).
 * Loaded before engine.js; exposes window.IRLEX_WARS
 */
(function (global) {
  'use strict';

  global.IRLEX_WARS = [
    {
      id: '1948',
      name: 'First Arab-Israeli War',
      start: '1948-05-14',
      end: '1949-03-10',
      type: 'war',
      fronts: [
        {
          name: 'Negev / Jerusalem axis',
          path: [[31.78, 35.22], [31.55, 34.95], [31.25, 34.75], [30.85, 34.8]],
          units: ['tank', 'soldier']
        },
        {
          name: 'Coastal corridor',
          path: [[32.08, 34.78], [31.9, 34.65], [31.7, 34.55]],
          units: ['soldier']
        }
      ]
    },
    {
      id: '1956',
      name: 'Suez Crisis',
      start: '1956-10-29',
      end: '1956-11-07',
      type: 'war',
      fronts: [
        {
          name: 'Sinai advance',
          path: [[31.05, 34.35], [30.55, 33.8], [30.15, 33.2], [29.95, 32.55]],
          units: ['tank', 'soldier']
        },
        {
          name: 'Air corridor (north Sinai)',
          path: [[31.2, 34.2], [30.8, 33.5], [30.4, 32.9]],
          units: ['plane']
        }
      ]
    },
    {
      id: '1967',
      name: 'Six-Day War',
      start: '1967-06-05',
      end: '1967-06-10',
      type: 'blitz',
      fronts: [
        {
          name: 'Southern front',
          path: [[31.25, 34.3], [31.45, 34.55], [31.65, 34.85], [31.85, 35.15]],
          units: ['tank', 'plane']
        },
        {
          name: 'Central highlands',
          path: [[32.2, 34.95], [32.45, 35.25], [32.65, 35.5]],
          units: ['tank', 'soldier']
        }
      ]
    },
    {
      id: '1973',
      name: 'Yom Kippur War',
      start: '1973-10-06',
      end: '1973-10-24',
      type: 'counter_attack',
      fronts: [
        {
          name: 'Suez Canal crossing',
          path: [[30.05, 32.25], [30.25, 32.45], [30.5, 32.75], [30.72, 33.05]],
          units: ['tank', 'soldier', 'plane']
        },
        {
          name: 'Golan Heights',
          path: [[33.35, 35.75], [33.2, 35.9], [33.05, 36.05], [32.95, 36.18]],
          units: ['tank', 'soldier']
        }
      ]
    }
  ];
})(typeof window !== 'undefined' ? window : this);
