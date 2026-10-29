// ── Measure tools ────────────────────────────────────────────────────────────
// Two buttons under the map's draw toolbar: measure a distance (line) and
// measure an area (polygon). Measurements are drawn in their own layer, never
// become analysis polygons, and stay on the map until clicked.
//
// Shared with inferrd., which loads this file straight from occurd.'s site
// (like layers.js), so keep it free of occurd.-only globals: it needs only
// Leaflet, Leaflet.draw and a global `map`.
//
// Host pages ignore Leaflet.draw's CREATED event while a measurement is being
// drawn: check window.LMeasure.isMeasuring() first.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  const LINE_COLOUR = '#2F4F4F';
  const AREA_COLOUR = '#5F6B66';
  const ICONS = {
    line: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17 17 3l4 4L7 21z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/></svg>',
    area: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7 12 3l8 5-2 11H6z" stroke-dasharray="3 2"/><path d="M9 13h6M12 10v6"/></svg>'
  };

  let mode = null;      // 'line' | 'area' while a measurement is being drawn
  let handler = null;   // the active Leaflet.draw handler
  let buttons = {};
  const group = L.featureGroup();

  window.LMeasure = {
    isMeasuring: () => !!mode,
    mode: () => mode,
    handler: () => handler,
    clear: () => group.clearLayers()
  };

  function fmtLength(m) {
    return m >= 1000 ? (m / 1000).toFixed(m >= 10000 ? 1 : 2) + ' km' : Math.round(m) + ' m';
  }
  function fmtArea(m2) {
    const ha = m2 / 10000;
    if (ha >= 100) return Math.round(ha).toLocaleString('en-NZ') + ' ha';
    if (ha >= 1) return ha.toFixed(2) + ' ha';
    return Math.round(m2).toLocaleString('en-NZ') + ' m² (' + ha.toFixed(3) + ' ha)';
  }
  function pathLength(lls) {
    let d = 0;
    for (let i = 1; i < lls.length; i++) d += lls[i - 1].distanceTo(lls[i]);
    return d;
  }

  function setActive(m) {
    Object.keys(buttons).forEach(k => buttons[k].classList.toggle('lmeasure-active', k === m));
  }

  // The host's own draw toolbar (a global `drawControl` in both apps), if any.
  function hostToolbars() {
    return (typeof drawControl !== 'undefined' && drawControl && drawControl._toolbars)
      ? Object.values(drawControl._toolbars) : [];
  }

  function start(m) {
    if (handler) handler.disable(); // also fires DRAWSTOP, which resets mode
    hostToolbars().forEach(t => { if (t.disable) t.disable(); }); // stop a polygon the user was drawing
    const opts = m === 'line'
      ? { shapeOptions: { color: LINE_COLOUR, weight: 3, dashArray: '6,6', bubblingMouseEvents: false }, showLength: true, metric: true }
      : { shapeOptions: { color: AREA_COLOUR, weight: 2, fillColor: AREA_COLOUR, fillOpacity: 0.12, dashArray: '6,6', bubblingMouseEvents: false },
          showArea: true, showLength: true, metric: ['ha', 'm'], allowIntersection: false };
    handler = m === 'line' ? new L.Draw.Polyline(map, opts) : new L.Draw.Polygon(map, opts);
    mode = m;
    setActive(m);
    handler.enable();
  }

  function addMeasurement(layer, m) {
    const lls = m === 'line' ? layer.getLatLngs() : layer.getLatLngs()[0];
    let text;
    if (m === 'line') {
      text = fmtLength(pathLength(lls));
    } else {
      const area = L.GeometryUtil.geodesicArea(lls);
      text = fmtArea(area) + '<br><span style="font-weight:400;opacity:0.75;">perimeter ' + fmtLength(pathLength(lls.concat([lls[0]]))) + '</span>';
    }
    layer.options.bubblingMouseEvents = false;
    layer.bindTooltip(text, { permanent: true, direction: 'center', className: 'lmeasure-label', interactive: false });
    layer.on('click', () => group.removeLayer(layer));
    layer.on('mouseover', () => layer.setStyle({ weight: m === 'line' ? 4 : 3 }));
    layer.on('mouseout', () => layer.setStyle({ weight: m === 'line' ? 3 : 2 }));
    layer.options.title = 'Click to remove';
    group.addLayer(layer);
  }

  function init() {
    if (typeof map === 'undefined' || !L.Draw || !L.GeometryUtil) return;
    group.addTo(map);

    const style = document.createElement('style');
    style.textContent =
      '.lmeasure-bar a{display:flex;align-items:center;justify-content:center;color:#333;cursor:pointer;}' +
      '.lmeasure-bar a.lmeasure-active{background:var(--hover);color:' + LINE_COLOUR + ';}' +
      '.lmeasure-label{background:rgba(255,255,255,0.92);border:1px solid var(--slate);border-radius:0;padding:2px 6px;' +
      'font:600 11.5px/1.35 var(--font-sans);color:#000;text-align:center;}' +
      '.lmeasure-label::before{display:none;}';
    document.head.appendChild(style);

    const Control = L.Control.extend({
      options: { position: 'topleft' },
      onAdd() {
        const bar = L.DomUtil.create('div', 'leaflet-bar lmeasure-bar');
        [['line', 'Measure a distance — click points, double-click (or click the last point) to finish'],
         ['area', 'Measure an area — click points, click the first point to finish']].forEach(([m, title]) => {
          const a = L.DomUtil.create('a', '', bar);
          a.href = '#';
          a.title = title;
          a.setAttribute('role', 'button');
          a.setAttribute('aria-label', m === 'line' ? 'Measure distance' : 'Measure area');
          a.innerHTML = ICONS[m];
          L.DomEvent.on(a, 'click', e => {
            L.DomEvent.preventDefault(e);
            L.DomEvent.stopPropagation(e);
            if (mode === m && handler) { handler.disable(); return; }
            start(m);
          });
          buttons[m] = a;
        });
        L.DomEvent.disableClickPropagation(bar);
        return bar;
      }
    });
    new Control().addTo(map);

    // Starting one of the host's own draw tools ends a measurement first. The
    // toolbar's 'enable' fires before that tool's DRAWSTART, so the host never
    // sees a stray DRAWSTOP from us in the middle of its own draw.
    hostToolbars().forEach(t => t.on && t.on('enable', () => { if (handler) handler.disable(); }));

    map.on(L.Draw.Event.CREATED, e => { if (mode) addMeasurement(e.layer, mode); });
    map.on(L.Draw.Event.DRAWSTOP, () => { mode = null; handler = null; setActive(null); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
