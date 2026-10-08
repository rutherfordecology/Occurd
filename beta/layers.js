// ── Layers project ───────────────────────────────────────────────────────────
// Unlocked from Projects > Layers with the user's own LRIS (Manaaki Whenua) API key.
// The key is kept only in this browser (localStorage) and is never in this code.
//
// Two jobs:
//   1. Show reference layers on the map (GDC plan layers via ArcGIS, LRIS layers via WFS).
//   2. Layer check: test every drawn polygon against every layer and download the
//      result as a CSV (one row per polygon x layer x intersecting feature).
// The layer list lives in layers-register.json, shared with the report workflow.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  const KEY_STORE = 'occurd_lris_key';
  const ON_STORE  = 'occurd_layers_on';
  const LRIS_BASE = 'https://lris.scinfo.org.nz/services';
  const MAX_LRIS  = 1000;
  const ENC = { salt: '0P/eszsAXIeVnFtoNQxbgQ==', iv: 'r34wHTw2jD6PhsFU', ct: '5lifxl4IXjKW1gp0Uf5i9jynJhZS0CanRBXgkKkyVbXRMqDUb15GrK9nkHKaPqNw', iter: 600000 };  // LRIS key encrypted with the Layers password (PBKDF2-SHA256 + AES-GCM)

  let register  = null;          // parsed layers-register.json
  let panel     = null;          // floating panel element
  let active    = false;         // panel shown and layers enabled
  const shown   = {};            // id -> L.GeoJSON on the map
  const loading = {};            // id -> bool
  const status  = {};            // id -> short status text
  let lastCheck = null;          // { time, rows }

  // ── storage helpers (never throw) ─────────────────────────────────────────
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function getKey() { return lsGet(KEY_STORE) || ''; }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  async function loadRegister() {
    if (register) return register;
    const r = await fetch('layers-register.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('layers-register.json: HTTP ' + r.status);
    register = await r.json();
    return register;
  }

  // ── service URLs ──────────────────────────────────────────────────────────
  function lrisWfsUrl(layerId, bbox, max) {
    // WFS 1.0.0, lon,lat. LRIS ignores the bbox unless its CRS is stated in it.
    const p = new URLSearchParams({
      service: 'WFS', version: '1.0.0', request: 'GetFeature',
      typeName: 'layer-' + layerId, outputFormat: 'json', srsName: 'EPSG:4326',
      maxFeatures: String(max || MAX_LRIS), bbox: bbox.join(',') + ',EPSG:4326'
    });
    return LRIS_BASE + ';key=' + encodeURIComponent(getKey()) + '/wfs/layer-' + layerId + '/?' + p.toString();
  }

  async function arcgisQuery(url, sub, params) {
    const body = new URLSearchParams(Object.assign({ f: 'json', outFields: '*', inSR: '4326', outSR: '4326' }, params));
    const r = await fetch(url + '/' + sub + '/query', { method: 'POST', body });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    if (j.error) throw new Error(j.error.message || 'ArcGIS error');
    return j;
  }

  // ── key check (used by projects.js) ───────────────────────────────────────
  // Resolves true if LRIS accepts the key, false if it refuses it.
  // If LRIS cannot be reached at all, the key is kept and the panel says so.
  window._layersHasKey = function () { return !!getKey(); };
  // Password unlock: decrypt the stored LRIS key in the browser. Returns the key or null.
  async function decryptKey(password) {
    try {
      const ub = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
      const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
      const aes = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: ub(ENC.salt), iterations: ENC.iter, hash: 'SHA-256' },
        base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ub(ENC.iv) }, aes, ub(ENC.ct));
      return new TextDecoder().decode(pt);
    } catch (e) { return null; }
  }

  // Accepts either the Layers password or a raw LRIS API key (32 hex characters).
  window._layersUnlock = async function (entry) {
    entry = (entry || '').trim();
    if (/^[0-9a-f]{32}$/i.test(entry)) return window._layersSetKey(entry);
    const key = await decryptKey(entry);
    if (!key) return false;
    lsSet(KEY_STORE, key);
    return true;
  };

  window._layersSetKey = async function (key) {
    const old = getKey();
    lsSet(KEY_STORE, key);
    try {
      const r = await fetch(lrisWfsUrl(48288, [178.0, -38.7, 178.01, -38.69], 1));
      if (r.status === 401 || r.status === 403) { if (old) lsSet(KEY_STORE, old); else lsDel(KEY_STORE); return false; }
      return true;
    } catch (e) {
      console.warn('Layers: LRIS key check could not reach LRIS', e);
      return true;
    }
  };

  window._layersActivate = async function () {
    active = true;
    try { await loadRegister(); } catch (e) { alert('Layers: could not load the layer register. ' + e.message); return; }
    buildPanel();
    refreshMapSites();
    panel.style.display = 'block';
    let on = [];
    try { on = JSON.parse(lsGet(ON_STORE) || '[]'); } catch (e) {}
    on.forEach(id => { const cb = document.getElementById('lyrcb_' + id); if (cb && !cb.checked) { cb.checked = true; toggleLayer(id, true); } });
    toggleDownloadBtn(true);
  };
  window._layersDeactivate = function () {
    active = false;
    Object.keys(shown).forEach(id => removeShown(id));
    if (panel) panel.style.display = 'none';
    toggleDownloadBtn(false);
  };

  // ── panel ─────────────────────────────────────────────────────────────────
  function buildPanel() {
    if (panel) return;
    const mapEl = document.getElementById('map');
    panel = document.createElement('div');
    panel.id = 'layersPanel';
    panel.style.cssText = [
      'position:absolute;top:10px;right:10px;z-index:1000;width:290px;max-height:calc(100% - 40px);overflow:auto',
      'background:#fff;border:1px solid var(--border);border-radius:var(--radius);box-shadow:0 4px 18px rgba(0,0,0,0.16)',
      'font-family:var(--font-sans);font-size:12px;color:var(--text)'
    ].join(';');
    L.DomEvent.disableClickPropagation(panel);
    L.DomEvent.disableScrollPropagation(panel);

    const groups = {};
    register.layers.forEach(l => { (groups[l.group] = groups[l.group] || []).push(l); });
    let html =
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:0.5px solid var(--border);background:var(--surface2);">' +
        '<strong style="display:inline-flex;align-items:center;gap:6px;color:var(--green-dark);">' + icon('layers', { size: 15 }) + 'Layers</strong>' +
        '<span><button id="lyrMin" title="Collapse" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:14px;">–</button>' +
        '<button id="lyrClose" title="Hide layers" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:14px;">✕</button></span>' +
      '</div><div id="lyrBody" style="padding:6px 10px 10px;">';
    Object.keys(groups).forEach(g => {
      html += '<div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text3);margin:8px 0 4px;">' + esc(g) + '</div>';
      groups[g].forEach(l => {
        html +=
          '<label style="display:flex;align-items:flex-start;gap:6px;margin:3px 0;cursor:pointer;" title="' + esc(l.notes || '') + '">' +
            '<input type="checkbox" id="lyrcb_' + l.id + '" style="accent-color:var(--green);margin-top:2px;">' +
            '<span style="width:10px;height:10px;border-radius:2px;margin-top:3px;flex-shrink:0;background:' + l.color + '55;border:1.5px solid ' + l.color + ';"></span>' +
            '<span style="flex:1;line-height:1.35;">' + esc(l.name) +
              '<span id="lyrst_' + l.id + '" style="display:block;font-size:10px;color:var(--text3);"></span></span>' +
          '</label>';
      });
    });
    html +=
      '<div style="border-top:0.5px solid var(--border);margin-top:8px;padding-top:8px;">' +
        '<div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text3);margin-bottom:4px;">Layer check</div>' +
        '<div style="font-size:11px;color:var(--text2);line-height:1.4;margin-bottom:6px;">Tests every drawn polygon against every layer above, ticked or not.</div>' +
        '<button id="lyrCheck" class="dl-btn" style="width:100%;margin-bottom:5px;">Check polygons against layers</button>' +
        '<button id="lyrDl" class="dl-btn" style="width:100%;" disabled>&#8595; Layer check CSV</button>' +
        '<div id="lyrResult" style="margin-top:6px;font-size:11px;line-height:1.45;color:var(--text2);"></div>' +
      '</div>' +
      '<div style="border-top:0.5px solid var(--border);margin-top:8px;padding-top:8px;">' +
        '<div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text3);margin-bottom:4px;">Report maps</div>' +
        '<div style="font-size:11px;color:var(--text2);line-height:1.4;margin-bottom:6px;">Location, site and work zone on aerial imagery, and protection context within 2 km (ticked layers, or PMAs and QEII covenants if none are ticked). 1800 × 1200 px PNGs.</div>' +
        '<label style="display:flex;gap:6px;align-items:center;margin-bottom:4px;">Site <select id="lyrMapSite" style="flex:1;min-width:0;font-size:11px;"></select></label>' +
        '<label style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">Work zone <input id="lyrMapWz" type="number" value="500" min="10" step="50" style="width:70px;font-size:11px;"> m</label>' +
        '<button id="lyrMaps" class="dl-btn" style="width:100%;">Make report maps</button>' +
        '<div id="lyrMapResult" style="margin-top:6px;font-size:11px;line-height:1.45;color:var(--text2);"></div>' +
      '</div>' +
      '<div style="margin-top:8px;font-size:10px;color:var(--text3);line-height:1.4;">Published GIS layers, not the legal plan maps. ' +
        '<a href="#" id="lyrForget" style="color:var(--text3);">Lock and forget</a></div>' +
      '</div>';
    panel.innerHTML = html;
    mapEl.appendChild(panel);

    register.layers.forEach(l => {
      document.getElementById('lyrcb_' + l.id).addEventListener('change', e => { toggleLayer(l.id, e.target.checked); saveOn(); });
    });
    panel.querySelector('#lyrClose').addEventListener('click', () => { window._layersDeactivate(); if (window._projectsSetLocked) window._projectsSetLocked('layers'); });
    panel.querySelector('#lyrMin').addEventListener('click', () => {
      const b = panel.querySelector('#lyrBody'); const hide = b.style.display !== 'none';
      b.style.display = hide ? 'none' : 'block'; panel.querySelector('#lyrMin').textContent = hide ? '+' : '–';
    });
    panel.querySelector('#lyrCheck').addEventListener('click', runCheck);
    panel.querySelector('#lyrDl').addEventListener('click', downloadCheck);
    panel.querySelector('#lyrMaps').addEventListener('click', makeMaps);
    panel.querySelector('#lyrMapSite').addEventListener('focus', refreshMapSites);
    panel.querySelector('#lyrMapSite').addEventListener('mousedown', refreshMapSites);
    refreshMapSites();
    panel.querySelector('#lyrForget').addEventListener('click', e => {
      e.preventDefault(); lsDel(KEY_STORE); window._layersDeactivate();
      if (window._projectsSetLocked) window._projectsSetLocked('layers');
    });
  }

  function saveOn() {
    const on = register.layers.filter(l => { const cb = document.getElementById('lyrcb_' + l.id); return cb && cb.checked; }).map(l => l.id);
    lsSet(ON_STORE, JSON.stringify(on));
  }
  function setStatus(id, txt) { status[id] = txt; const el = document.getElementById('lyrst_' + id); if (el) el.textContent = txt || ''; }
  function layerById(id) { return register.layers.find(l => l.id === id); }

  // ── display ───────────────────────────────────────────────────────────────
  function removeShown(id) { if (shown[id]) { map.removeLayer(shown[id]); delete shown[id]; } }

  function toggleLayer(id, on) {
    if (!on) { removeShown(id); setStatus(id, ''); return; }
    drawLayer(id);
  }

  function popupHtml(l, props) {
    const rows = Object.keys(props || {}).filter(k => !/^(OBJECTID|GlobalID|Shape__Area|Shape__Length|SHAPE.*|shape.*|fid)$/i.test(k))
      .map(k => '<tr><td style="color:#666;padding-right:6px;vertical-align:top;">' + esc(k) + '</td><td>' + esc(props[k]) + '</td></tr>').join('');
    return '<div style="font-size:12px;max-height:220px;overflow:auto;"><strong>' + esc(l.name) + '</strong>' +
      '<table style="margin-top:4px;border-collapse:collapse;">' + rows + '</table></div>';
  }

  // Features of one register layer within a [w,s,e,n] box (wrapped degrees).
  // tol = generalisation tolerance in degrees for ArcGIS layers.
  async function fetchFC(l, bbox, tol) {
    let fc = { type: 'FeatureCollection', features: [] }, capped = false;
    if (l.source === 'arcgis') {
      for (const sub of l.sublayers) {
        const body = new URLSearchParams({
          f: 'geojson', where: '1=1', outFields: '*', inSR: '4326', outSR: '4326', returnGeometry: 'true',
          geometry: bbox.join(','), geometryType: 'esriGeometryEnvelope', spatialRel: 'esriSpatialRelIntersects',
          maxAllowableOffset: String(tol), geometryPrecision: '6', resultRecordCount: '1000'
        });
        const r = await fetch(l.url + '/' + sub + '/query', { method: 'POST', body });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json();
        if (j.error) throw new Error(j.error.message || 'service error');
        fc.features = fc.features.concat(j.features || []);
        if ((j.properties && j.properties.exceededTransferLimit) || j.exceededTransferLimit) capped = true;
      }
    } else {
      if (!getKey()) throw new Error('no LRIS key');
      const r = await fetch(lrisWfsUrl(l.layer, bbox, MAX_LRIS));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      fc = await r.json();
      capped = (fc.features || []).length >= MAX_LRIS;
    }
    return { fc, capped };
  }

  async function drawLayer(id) {
    const l = layerById(id);
    const cb = document.getElementById('lyrcb_' + id);
    if (!l || !cb || !cb.checked || !active) return;
    if (map.getZoom() < (l.minZoom || 9)) { removeShown(id); setStatus(id, 'Zoom in to show (level ' + l.minZoom + '+)'); return; }
    if (loading[id]) return;
    loading[id] = true; setStatus(id, 'Loading…');
    const b = map.getBounds();
    const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map(v => +v.toFixed(6));
    bbox[0] = wrapLng180(bbox[0]); bbox[2] = wrapLng180(bbox[2]);
    try {
      const tol = (bbox[2] - bbox[0]) / (map.getSize().x || 800); // ~1 px in degrees
      const { fc, capped } = await fetchFC(l, bbox, tol);
      const cb2 = document.getElementById('lyrcb_' + id);
      if (!active || !cb2 || !cb2.checked) return;
      removeShown(id);
      shown[id] = L.geoJSON(fc, {
        pane: 'qeiiPane',
        style: { color: l.color, weight: 1.5, fillColor: l.color, fillOpacity: 0.15 },
        onEachFeature: (f, lyr) => lyr.bindPopup(popupHtml(l, f.properties), { maxWidth: 300 })
      }).addTo(map);
      setStatus(id, (fc.features || []).length + ' shown' + (capped ? ' (limit reached, zoom in)' : ''));
    } catch (e) {
      console.warn('Layers: ' + id + ' failed', e);
      setStatus(id, 'Could not load (' + e.message + ')');
    } finally {
      loading[id] = false;
    }
  }

  let moveTimer = null;
  function onMove() {
    if (!active || !register) return;
    clearTimeout(moveTimer);
    moveTimer = setTimeout(() => {
      register.layers.forEach(l => { const cb = document.getElementById('lyrcb_' + l.id); if (cb && cb.checked) drawLayer(l.id); });
    }, 450);
  }

  // ── layer check ───────────────────────────────────────────────────────────
  function geomPolys() {
    return (typeof polygons !== 'undefined' ? polygons : []).filter(p => p.type !== 'species' && p.latlngs && p.latlngs.length >= 3);
  }

  function labelFor(l, props) {
    const p = props || {};
    let parts = (l.labelFields || []).map(f => p[f]).filter(v => v != null && String(v).trim() !== '');
    if (!parts.length) {
      parts = Object.keys(p).filter(k => !/^(OBJECTID|GlobalID|Shape__Area|Shape__Length|fid)$/i.test(k))
        .map(k => p[k]).filter(v => typeof v === 'string' && v.trim() !== '').slice(0, 3);
    }
    return parts.join(' | ');
  }
  function attrText(props) {
    return Object.keys(props || {}).filter(k => !/^(OBJECTID|GlobalID|Shape__Area|Shape__Length|SHAPE.*|fid)$/i.test(k))
      .map(k => k + '=' + (props[k] == null ? '' : props[k])).join('; ');
  }

  function featureIntersects(polyTurf, refLng, geom) {
    if (!geom) return false;
    try {
      if (geom.type === 'Polygon') return turf.booleanIntersects(polyTurf, geoJsonPolyToTurfInFrame(geom.coordinates, refLng));
      if (geom.type === 'MultiPolygon') return geom.coordinates.some(c => { try { return turf.booleanIntersects(polyTurf, geoJsonPolyToTurfInFrame(c, refLng)); } catch (e) { return false; } });
      return turf.booleanIntersects(polyTurf, { type: 'Feature', geometry: geom, properties: {} });
    } catch (e) { return false; }
  }

  async function checkOne(l, p) {
    const { poly, refLng } = llToTurfPolygon(p.latlngs, p.holes);
    const ring = poly.geometry.coordinates[0].map(([x, y]) => [wrapLng180(x), y]);
    const found = []; let note = '';
    if (l.source === 'arcgis') {
      for (const sub of l.sublayers) {
        const j = await arcgisQuery(l.url, sub, {
          where: '1=1', returnGeometry: 'false', spatialRel: 'esriSpatialRelIntersects', geometryType: 'esriGeometryPolygon',
          geometry: JSON.stringify({ rings: [ring], spatialReference: { wkid: 4326 } })
        });
        (j.features || []).forEach(f => found.push(f.attributes || {}));
        if (j.exceededTransferLimit) note = 'result limit reached';
      }
    } else {
      if (!getKey()) throw new Error('no LRIS key');
      const bb = turf.bbox(poly);
      const bbox = [wrapLng180(bb[0]), bb[1], wrapLng180(bb[2]), bb[3]];
      const r = await fetch(lrisWfsUrl(l.layer, bbox, MAX_LRIS));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const fc = await r.json();
      (fc.features || []).forEach(f => { if (featureIntersects(poly, refLng, f.geometry)) found.push(f.properties || {}); });
      if ((fc.features || []).length >= MAX_LRIS) note = 'result limit reached, polygon may be too large';
    }
    return { found, note };
  }

  async function runCheck() {
    const res = panel.querySelector('#lyrResult');
    const btn = panel.querySelector('#lyrCheck');
    const polys = geomPolys();
    if (!polys.length) { res.innerHTML = 'Draw or import a polygon first.'; return; }
    btn.disabled = true; btn.textContent = 'Checking…';
    const time = new Date().toISOString();
    const rows = []; const summary = [];
    for (const p of polys) {
      const hits = [];
      for (const l of register.layers) {
        try {
          const { found, note } = await checkOne(l, p);
          if (!found.length) rows.push(row(p, l, 'no', 0, '', '', note, time));
          found.forEach(a => rows.push(row(p, l, 'yes', found.length, labelFor(l, a), attrText(a), note, time)));
          if (found.length) hits.push('<strong>' + esc(l.name) + '</strong>: ' + esc([...new Set(found.map(a => labelFor(l, a)).filter(Boolean))].join('; ') || found.length + ' feature(s)'));
        } catch (e) {
          console.warn('Layer check ' + l.id + ' failed', e);
          rows.push(row(p, l, 'error', 0, '', '', e.message, time));
          hits.push('<span style="color:var(--red);">' + esc(l.name) + ': could not check (' + esc(e.message) + ')</span>');
        }
      }
      summary.push('<div style="margin-top:4px;"><em>' + esc(p.label) + '</em><br>' + (hits.length ? hits.join('<br>') : 'No layers intersect.') + '</div>');
    }
    lastCheck = { time, rows };
    res.innerHTML = summary.join('');
    btn.disabled = false; btn.textContent = 'Check polygons against layers';
    panel.querySelector('#lyrDl').disabled = false;
    const extBtn = document.getElementById('dlLayersBtn'); if (extBtn) extBtn.disabled = false;
  }

  function row(p, l, hit, n, label, attrs, note, time) {
    return {
      polygon_name: p.label, layer_id: l.id, layer_name: l.name, layer_group: l.group,
      source: l.source === 'arcgis' ? l.url + ' (sublayers ' + l.sublayers.join(',') + ')' : 'LRIS layer ' + l.layer,
      intersects: hit, feature_count: n, feature_label: label, attributes: attrs, note: note || '', checked_at: time
    };
  }

  async function downloadCheck() {
    if (!lastCheck) { await runCheck(); if (!lastCheck) return; }
    const fields = ['polygon_name', 'layer_id', 'layer_name', 'layer_group', 'intersects', 'feature_count', 'feature_label', 'attributes', 'source', 'note', 'checked_at'];
    const head = [
      '# Layer check from occurd. (https://rutherfordecology.github.io/Occurd/) on ' + lastCheck.time.slice(0, 10),
      '# Layer register version ' + (register.register_version || '?') + '. Published GIS layers, not the legal plan maps: confirm anything decisive against the operative plan.',
      '# Gisborne District Council layers from GDC ArcGIS Online; Manaaki Whenua layers from the LRIS portal under its licence terms.'
    ].join('\n');
    downloadBlob(head + '\n' + buildCSV(lastCheck.rows, fields), 'layer_check_' + lastCheck.time.slice(0, 10) + '.csv', 'text/csv');
  }

  // A matching button in the Downloads row (shown only while Layers is unlocked)
  function toggleDownloadBtn(on) {
    let b = document.getElementById('dlLayersBtn');
    if (!b) {
      const rowEl = document.querySelector('.export-row');
      if (!rowEl) return;
      b = document.createElement('button');
      b.className = 'dl-btn'; b.id = 'dlLayersBtn'; b.innerHTML = '&#8595; Layer check CSV';
      b.addEventListener('click', async () => { if (!lastCheck && panel) await runCheck(); downloadCheck(); });
      rowEl.appendChild(b);
    }
    b.style.display = on ? '' : 'none';
  }

  // ── report maps ───────────────────────────────────────────────────────────
  // Draws report figures directly onto a canvas (not a screenshot of the map), so
  // size, scale bar, north arrow and legend come out the same every time.
  // 900 x 600 layout units at 2x = 1800 x 1200 px: 16 cm wide at ~285 dpi.
  const MW = 900, MH = 600, MR = 2;
  const BASEMAPS = {
    imagery: { tile: 256, max: 18, url: (z, x, y) => 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' + z + '/' + y + '/' + x,
               attr: 'Imagery: Esri, Maxar, Earthstar Geographics and the GIS user community' },
    street:  { tile: 512, max: 19, url: (z, x, y) => 'https://' + 'abcd'[(x + y) % 4] + '.basemaps.cartocdn.com/rastertiles/voyager/' + z + '/' + x + '/' + y + '@2x.png',
               attr: 'Basemap: © OpenStreetMap contributors, © CARTO' },
    grey:    { tile: 512, max: 19, url: (z, x, y) => 'https://' + 'abcd'[(x + y) % 4] + '.basemaps.cartocdn.com/light_all/' + z + '/' + x + '/' + y + '@2x.png',
               attr: 'Basemap: © OpenStreetMap contributors, © CARTO' }
  };
  const SITE_COL = '#e11d48', WZ_COL = '#facc15', BUF_COL = '#ffffff';
  let lastMaps = [];

  function worldPx(lng, lat, z) {
    const s = 256 * Math.pow(2, z), sl = Math.sin(Math.max(-85, Math.min(85, lat)) * Math.PI / 180);
    return [(lng + 180) / 360 * s, (0.5 - Math.log((1 + sl) / (1 - sl)) / (4 * Math.PI)) * s];
  }
  // A view: fit [minLng,minLat,maxLng,maxLat] (unwrapped) into the canvas with a margin
  function makeView(b, margin) {
    const [x0, y1] = worldPx(b[0], b[1], 0), [x1, y0] = worldPx(b[2], b[3], 0);
    const zf = Math.log2(Math.min(MW * (1 - margin) / Math.max(x1 - x0, 1e-9), MH * (1 - margin) / Math.max(y1 - y0, 1e-9)));
    const k = Math.pow(2, zf);
    const cx = (x0 + x1) / 2 * k, cy = (y0 + y1) / 2 * k;
    const lat = (b[1] + b[3]) / 2;
    return {
      zf, lat,
      px: (lng, lat2) => { const [x, y] = worldPx(lng, lat2, zf); return [x - cx + MW / 2, y - cy + MH / 2]; },
      cx, cy,
      mpp: 156543.03392 * Math.cos(lat * Math.PI / 180) / k   // metres per layout unit
    };
  }
  function loadImg(url) {
    return new Promise(res => {
      const img = new Image(); let done = false;
      const t = setTimeout(() => { if (!done) { done = true; res(null); } }, 20000);
      img.crossOrigin = 'anonymous';
      img.onload = () => { if (!done) { done = true; clearTimeout(t); res(img); } };
      img.onerror = () => { if (!done) { done = true; clearTimeout(t); res(null); } };
      img.src = url;
    });
  }
  async function drawBasemap(ctx, v, bm) {
    // tile zoom chosen so tile pixels land at about one canvas pixel each
    const zt = Math.min(bm.max, Math.ceil(v.zf + Math.log2(MR * 256 / bm.tile) - 1e-9));
    const k = Math.pow(2, zt - v.zf), n = Math.pow(2, zt);
    const minX = (v.cx - MW / 2) * k, minY = (v.cy - MH / 2) * k, maxX = (v.cx + MW / 2) * k, maxY = (v.cy + MH / 2) * k;
    const jobs = [];
    for (let tx = Math.floor(minX / 256); tx <= Math.floor(maxX / 256); tx++)
      for (let ty = Math.max(0, Math.floor(minY / 256)); ty <= Math.min(n - 1, Math.floor(maxY / 256)); ty++)
        jobs.push(loadImg(bm.url(zt, ((tx % n) + n) % n, ty)).then(img => ({ img, tx, ty })));
    const tiles = await Promise.all(jobs);
    let missing = 0;
    ctx.fillStyle = '#e5e7eb'; ctx.fillRect(0, 0, MW, MH);
    tiles.forEach(({ img, tx, ty }) => {
      if (!img) { missing++; return; }
      const s = 256 / k;
      ctx.drawImage(img, (tx * 256 - minX) / k, (ty * 256 - minY) / k, s + 0.6, s + 0.6);
    });
    return missing;
  }
  function shiftLng(lng, ref) { while (lng - ref > 180) lng -= 360; while (lng - ref < -180) lng += 360; return lng; }
  function pathRings(ctx, v, rings, ref) {
    ctx.beginPath();
    rings.forEach(r => r.forEach(([lng, lat], i) => { const [x, y] = v.px(shiftLng(lng, ref), lat); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }));
  }
  function haloStroke(ctx, col, w, dash) {
    ctx.save(); ctx.setLineDash(dash || []); ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = w + 2.5; ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); ctx.restore();
  }
  function drawGeom(ctx, v, g, ref, col) {
    if (!g) return;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : null;
    if (polys) {
      polys.forEach(rings => {
        pathRings(ctx, v, rings, ref);
        ctx.fillStyle = col + '40'; ctx.fill('evenodd');
        ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.stroke();
      });
      return;
    }
    const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : null;
    if (lines) { lines.forEach(c => { pathRings(ctx, v, [c], ref); haloStroke(ctx, col, 2.2); }); }
  }
  function haloText(ctx, txt, x, y, size, align) {
    ctx.save(); ctx.font = '600 ' + size + 'px Arial, sans-serif'; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.strokeText(txt, x, y);
    ctx.fillStyle = '#111827'; ctx.fillText(txt, x, y); ctx.restore();
  }
  function niceLen(maxM) {
    const p = Math.pow(10, Math.floor(Math.log10(maxM)));
    return [5, 2, 1].map(m => m * p).find(L => L <= maxM) || p;
  }
  function drawFurniture(ctx, v, legend, attr) {
    // north arrow, top right
    ctx.save(); ctx.translate(MW - 34, 38);
    ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.beginPath(); ctx.arc(0, 0, 22, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = '#111827'; ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(8, 9); ctx.lineTo(0, 4); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
    ctx.font = '700 10px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('N', 0, 19.5); ctx.restore();
    // attribution strip
    ctx.fillStyle = 'rgba(255,255,255,0.82)'; ctx.fillRect(0, MH - 15, MW, 15);
    ctx.fillStyle = '#374151'; ctx.font = '8.5px Arial, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(attr, MW - 6, MH - 7.5);
    // scale bar, bottom right
    const L = niceLen(v.mpp * 160), w = L / v.mpp, x = MW - 18 - w, y = MH - 32;
    ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.fillRect(x - 8, y - 18, w + 16, 28);
    ctx.fillStyle = '#111827'; ctx.fillRect(x, y, w, 4);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + w / 2, y + 0.8, w / 2 - 0.8, 2.4);
    ctx.fillStyle = '#111827'; ctx.font = '10px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('0', x, y - 4); ctx.fillText(L >= 1000 ? (L / 1000) + ' km' : L + ' m', x + w, y - 4);
    // legend, bottom left
    if (legend.length) {
      ctx.font = '11px Arial, sans-serif';
      const lw = Math.max(...legend.map(it => ctx.measureText(it.label).width)) + 44, lh = legend.length * 18 + 12;
      const lx = 10, ly = MH - 15 - 10 - lh;
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(lx, ly, lw, lh);
      legend.forEach((it, i) => {
        const yy = ly + 15 + i * 18;
        ctx.save();
        if (it.kind === 'fill') { ctx.fillStyle = it.color + '40'; ctx.fillRect(lx + 8, yy - 6, 22, 12); ctx.strokeStyle = it.color; ctx.lineWidth = 1.6; ctx.strokeRect(lx + 8, yy - 6, 22, 12); }
        else if (it.kind === 'point') { ctx.fillStyle = it.color; ctx.beginPath(); ctx.arc(lx + 19, yy, 5, 0, 2 * Math.PI); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
        else { ctx.beginPath(); ctx.moveTo(lx + 8, yy); ctx.lineTo(lx + 30, yy); ctx.setLineDash(it.dash || []); ctx.strokeStyle = it.kind === 'halo' ? '#6b7280' : it.color; ctx.lineWidth = it.kind === 'halo' ? 4.5 : 2.6; ctx.stroke(); if (it.kind === 'halo') { ctx.strokeStyle = it.color; ctx.lineWidth = 2.6; ctx.stroke(); } }
        ctx.restore();
        ctx.fillStyle = '#111827'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(it.label, lx + 38, yy);
      });
    }
  }
  function ringBBox(rings) {
    const xs = [], ys = []; rings.forEach(r => r.forEach(([x, y]) => { xs.push(x); ys.push(y); }));
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
  function newCanvas() {
    const c = document.createElement('canvas'); c.width = MW * MR; c.height = MH * MR;
    const ctx = c.getContext('2d'); ctx.setTransform(MR, 0, 0, MR, 0, 0); return { c, ctx };
  }
  function toBlob(c) { return new Promise((res, rej) => { try { c.toBlob(b => b ? res(b) : rej(new Error('empty image')), 'image/png'); } catch (e) { rej(e); } }); }

  async function makeMaps() {
    const res = panel.querySelector('#lyrMapResult'), btn = panel.querySelector('#lyrMaps');
    const sel = panel.querySelector('#lyrMapSite');
    const site = geomPolys().find(p => String(p.id) === sel.value);
    if (!site) { res.textContent = 'Draw or import the site polygon first.'; return; }
    const wzM = Math.max(10, +panel.querySelector('#lyrMapWz').value || 500);
    btn.disabled = true; btn.textContent = 'Drawing maps…'; res.textContent = '';
    lastMaps.forEach(m => URL.revokeObjectURL(m.url)); lastMaps = [];
    try {
      const { poly, refLng } = llToTurfPolygon(site.latlngs, site.holes);
      const siteRings = poly.geometry.coordinates;
      const wz = turf.buffer(poly, wzM / 1000, { units: 'kilometers' });
      const buf = turf.buffer(poly, 2, { units: 'kilometers' });
      const wzRings = wz.geometry.type === 'Polygon' ? wz.geometry.coordinates : wz.geometry.coordinates[0];
      const bufRings = buf.geometry.type === 'Polygon' ? buf.geometry.coordinates : buf.geometry.coordinates[0];
      const sb = ringBBox(siteRings), cLng = (sb[0] + sb[2]) / 2, cLat = (sb[1] + sb[3]) / 2;
      const stamp = fileStamp(), safe = String(site.label).replace(/[^\w\-]+/g, '_').slice(0, 40);
      const wzLabel = 'Work zone (' + (wzM >= 1000 ? wzM / 1000 + ' km' : wzM + ' m') + ')';
      const out = []; const warn = [];
      const siteDraw = (ctx, v) => { pathRings(ctx, v, siteRings, refLng); ctx.fillStyle = SITE_COL + '22'; ctx.fill('evenodd'); haloStroke(ctx, SITE_COL, 2.6); };

      // Figure 1: location (about 10 km across, street basemap)
      {
        const dLat = 5 / 111.32, dLng = 5 / (111.32 * Math.cos(cLat * Math.PI / 180));
        const v = makeView([cLng - dLng, cLat - dLat, cLng + dLng, cLat + dLat], 0);
        const { c, ctx } = newCanvas();
        const miss = await drawBasemap(ctx, v, BASEMAPS.street);
        siteDraw(ctx, v);
        const [x, y] = v.px(cLng, cLat);
        ctx.beginPath(); ctx.arc(x, y, 7, 0, 2 * Math.PI); ctx.fillStyle = SITE_COL; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        drawFurniture(ctx, v, [{ kind: 'point', color: SITE_COL, label: 'Site: ' + site.label }], BASEMAPS.street.attr + '  |  Map: occurd.');
        if (miss) warn.push('location map: ' + miss + ' basemap tiles missing');
        out.push({ name: 'map1_location_' + safe + '_' + stamp + '.png', title: 'Location', c });
      }
      // Figure 2: site and work zone on imagery
      {
        const v = makeView(ringBBox(wzRings), 0.08);
        const { c, ctx } = newCanvas();
        const miss = await drawBasemap(ctx, v, BASEMAPS.imagery);
        pathRings(ctx, v, wzRings, refLng); haloStroke(ctx, WZ_COL, 2.2, [8, 5]);
        siteDraw(ctx, v);
        drawFurniture(ctx, v, [
          { kind: 'halo', color: SITE_COL, label: 'Site: ' + site.label },
          { kind: 'halo', color: WZ_COL, dash: [8, 5], label: wzLabel }
        ], BASEMAPS.imagery.attr + '  |  Map: occurd.');
        if (miss) warn.push('site map: ' + miss + ' imagery tiles missing');
        out.push({ name: 'map2_site_' + safe + '_' + stamp + '.png', title: 'Site and work zone', c });
      }
      // Figure 3: protection and planning context within 2 km
      {
        const bb = ringBBox(bufRings), v = makeView(bb, 0.06);
        const { c, ctx } = newCanvas();
        const miss = await drawBasemap(ctx, v, BASEMAPS.grey);
        let ids = register.layers.filter(l => { const cb = document.getElementById('lyrcb_' + l.id); return cb && cb.checked; }).map(l => l.id);
        if (!ids.length) ids = ['gdc_pma', 'qeii'];
        const box = [wrapLng180(bb[0]), bb[1], wrapLng180(bb[2]), bb[3]].map(x => +x.toFixed(6));
        const legend = [], sources = new Set(), labels = [];
        for (const id of ids) {
          const l = layerById(id); if (!l) continue;
          try {
            const { fc } = await fetchFC(l, box, (bb[2] - bb[0]) / 1500);
            const feats = (fc.features || []);
            feats.forEach(f => drawGeom(ctx, v, f.geometry, refLng, l.color));
            if (feats.length) {
              const isLine = feats.every(f => /Line/.test((f.geometry || {}).type));
              legend.push({ kind: isLine ? 'line' : 'fill', color: l.color, label: l.name });
              sources.add(l.source === 'arcgis' ? (l.id === 'qeii' ? 'QEII National Trust' : 'Gisborne District Council') : 'Manaaki Whenua LRIS');
              if (/^(gdc_pma|qeii)$/.test(l.id)) feats.forEach(f => {
                try {
                  const pt = turf.pointOnFeature(f).geometry.coordinates, [x, y] = v.px(shiftLng(pt[0], refLng), pt[1]);
                  const t = String(labelFor(l, f.properties) || '').split(' | ')[0].slice(0, 24);
                  if (t && x > 20 && x < MW - 20 && y > 20 && y < MH - 40) labels.push([t, x, y]);
                } catch (e) {}
              });
            }
          } catch (e) { warn.push(l.name + ': ' + e.message); }
        }
        pathRings(ctx, v, bufRings, refLng); haloStroke(ctx, '#374151', 1.6, [6, 4]);
        siteDraw(ctx, v);
        labels.forEach(([t, x, y]) => haloText(ctx, t, x, y, 10));
        legend.unshift({ kind: 'halo', color: SITE_COL, label: 'Site: ' + site.label }, { kind: 'line', color: '#374151', dash: [6, 4], label: '2 km buffer' });
        drawFurniture(ctx, v, legend, 'Layers: ' + ([...sources].join(', ') || 'none') + ' (published GIS layers, not the legal plan maps)  |  ' + BASEMAPS.grey.attr + '  |  Map: occurd.');
        if (miss) warn.push('context map: ' + miss + ' basemap tiles missing');
        out.push({ name: 'map3_context_' + safe + '_' + stamp + '.png', title: 'Protection and planning context (2 km)', c });
      }
      for (const m of out) { const b = await toBlob(m.c); lastMaps.push({ name: m.name, title: m.title, url: URL.createObjectURL(b) }); }
      res.innerHTML = lastMaps.map(m =>
        '<div style="margin-top:6px;"><a href="' + m.url + '" download="' + esc(m.name) + '" class="lyrMapLink" style="color:var(--green-dark);font-weight:600;">&#8595; ' + esc(m.title) + '</a>' +
        '<img src="' + m.url + '" alt="" style="display:block;width:100%;margin-top:3px;border:0.5px solid var(--border);border-radius:4px;"></div>').join('') +
        (warn.length ? '<div style="margin-top:6px;color:var(--red);">' + esc(warn.join('; ')) + '</div>' : '');
    } catch (e) {
      console.warn('Report maps failed', e);
      res.innerHTML = '<span style="color:var(--red);">Could not make maps (' + esc(e.message) + ').' +
        (e.name === 'SecurityError' ? ' A basemap blocked export (CORS).' : '') + '</span>';
    } finally {
      btn.disabled = false; btn.textContent = 'Make report maps';
    }
  }
  function refreshMapSites() {
    const sel = panel && panel.querySelector('#lyrMapSite'); if (!sel) return;
    const polys = geomPolys(), cur = sel.value;
    sel.innerHTML = polys.map(p => '<option value="' + p.id + '">' + esc(p.label) + '</option>').join('') || '<option value="">(no polygons)</option>';
    if (polys.some(p => String(p.id) === cur)) sel.value = cur;
    else { const d = polys.find(p => !/buffer/i.test(p.label)) || polys[0]; if (d) sel.value = String(d.id); }
  }
  window._layersMakeMaps = () => makeMaps();

  // ── init ──────────────────────────────────────────────────────────────────
  function init() { if (typeof map !== 'undefined') map.on('moveend', onMove); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
