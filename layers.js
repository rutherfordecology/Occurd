// ── Layers project ───────────────────────────────────────────────────────────
// Unlocked from Projects > Layers with the user's own LRIS (Manaaki Whenua) API key.
// The key is kept only in this browser (localStorage) and is never in this code.
//
// Two jobs:
//   1. Show reference layers on the map (GDC plan layers via ArcGIS, LRIS layers via WFS).
//   2. Layer check: test every drawn polygon against every layer and download the
//      result as a CSV (one row per polygon x layer x intersecting feature).
// The layer list lives in layers-register.json, shared with the report workflow.
//
// Shared with inferrd., which loads this file and the register straight from
// occurd.'s site, so a layer added here shows up there too. Keep it portable:
//   - the register is fetched next to this script, wherever it was loaded from;
//   - the geometry/CSV helpers it needs have fallbacks below for pages that
//     don't define them;
//   - a host page can set window.LAYERS_HOST = { name, url, polygons() } to name
//     itself in the CSV header and hand over its own drawn areas
//     ([{ label, latlngs, holes }]) for the layer check.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  const KEY_STORE = 'occurd_lris_key';
  const ON_STORE  = 'occurd_layers_on';  // ticked layers were once remembered here; now cleared
  const GROUPS_STORE = 'occurd_layers_closed'; // group headings folded away
  const LRIS_BASE = 'https://lris.scinfo.org.nz/services';
  const MAX_LRIS  = 1000;
  const ENC = { salt: '0P/eszsAXIeVnFtoNQxbgQ==', iv: 'r34wHTw2jD6PhsFU', ct: '5lifxl4IXjKW1gp0Uf5i9jynJhZS0CanRBXgkKkyVbXRMqDUb15GrK9nkHKaPqNw', iter: 600000 };  // LRIS key encrypted with the Layers password (PBKDF2-SHA256 + AES-GCM)

  const SELF_URL = (document.currentScript && document.currentScript.src) || location.href;
  const HOST = window.LAYERS_HOST || {};

  // ── helpers: occurd.'s own when present, else these copies ────────────────
  const G = {
    icon: typeof icon === 'function' ? icon : function (name, o) {
      const s = (o && o.size) || 20;
      return name === 'layers' ? '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>' : '';
    },
    wrapLng180: typeof wrapLng180 === 'function' ? wrapLng180 : function (lng) { const n = ((lng % 360) + 360) % 360; return n > 180 ? n - 360 : n; },
    buildCSV: typeof buildCSV === 'function' ? buildCSV : function (rows, fields) {
      const e = v => { if (v == null) return ''; const t = String(v); return /[,"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
      return [fields.join(','), ...rows.map(r => fields.map(f => e(r[f])).join(','))].join('\n');
    },
    downloadBlob: typeof downloadBlob === 'function' ? downloadBlob : function (content, filename, type) {
      const url = URL.createObjectURL(new Blob([content], { type })), a = document.createElement('a');
      a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
    }
  };
  // Antimeridian-safe turf polygons (same logic as occurd.'s index.html).
  function _unwrapRing(pairs) {
    const out = []; let prev = null;
    for (const [raw, lat] of pairs) {
      let lng = ((raw % 360) + 360) % 360; if (lng > 180) lng -= 360;
      if (prev !== null) { while (lng - prev > 180) lng -= 360; while (lng - prev < -180) lng += 360; }
      prev = lng; out.push([lng, lat]);
    }
    return out;
  }
  function _align(coords, ref) {
    let shift = 0; const first = coords[0][0];
    while (first + shift - ref > 180) shift -= 360;
    while (first + shift - ref < -180) shift += 360;
    return shift === 0 ? coords : coords.map(([x, y]) => [x + shift, y]);
  }
  function _close(c) { return (c[0][0] !== c[c.length - 1][0] || c[0][1] !== c[c.length - 1][1]) ? [...c, c[0]] : c; }
  function _llRing(latlngs) { return _unwrapRing(latlngs.map(ll => ll.lat !== undefined ? [ll.lng, ll.lat] : [ll[1], ll[0]])); }
  G.llToTurfPolygon = typeof llToTurfPolygon === 'function' ? llToTurfPolygon : function (latlngs, holes) {
    const outer = _close(_llRing(latlngs)); const refLng = outer[0][0]; const rings = [outer];
    (holes || []).forEach(h => { if (h && h.length >= 3) rings.push(_close(_align(_llRing(h), refLng))); });
    return { poly: turf.polygon(rings), refLng };
  };
  G.geoJsonPolyToTurfInFrame = typeof geoJsonPolyToTurfInFrame === 'function' ? geoJsonPolyToTurfInFrame : function (coordinates, refLng) {
    return turf.polygon(coordinates.map(r => _close(_align(_unwrapRing(r), refLng))));
  };

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
    const r = await fetch(new URL('layers-register.json', SELF_URL).href, { cache: 'no-cache' });
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
    panel.style.display = 'block';
    lsDel(ON_STORE);  // every layer starts unticked; nothing is restored from last visit
    register.layers.forEach(l => { const cb = document.getElementById('lyrcb_' + l.id); if (cb) cb.checked = false; setStatus(l.id, ''); });
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
    // Group headings fold with a chevron; folded groups are remembered.
    let closed = [];
    try { closed = JSON.parse(lsGet(GROUPS_STORE) || '[]'); } catch (e) {}
    const CHEV = '<svg class="lyr-chev" viewBox="0 0 10 10" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="transition:transform 0.12s;flex-shrink:0;"><path d="M3 1.5 7 5 3 8.5"/></svg>';
    const groupHead = (name) =>
      '<button type="button" class="lyr-grp" data-grp="' + esc(name) + '" style="display:flex;align-items:center;gap:5px;width:100%;background:none;border:none;padding:0;cursor:pointer;font-family:inherit;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text3);margin:8px 0 4px;text-align:left;">' + CHEV + esc(name) + '</button>';
    let html =
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:0.5px solid var(--border);background:var(--surface2);">' +
        '<strong style="display:inline-flex;align-items:center;gap:6px;color:var(--green-dark, #1a5940);">' + G.icon('layers', { size: 15 }) + 'Layers</strong>' +
        '<span><button id="lyrMin" title="Collapse" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:14px;">–</button>' +
        '<button id="lyrClose" title="Hide layers" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:14px;">✕</button></span>' +
      '</div><div id="lyrBody" style="padding:6px 10px 10px;"><div id="lyrHost"></div>';
    Object.keys(groups).forEach(g => {
      html += groupHead(g) + '<div class="lyr-grp-body" data-grp="' + esc(g) + '">';
      groups[g].forEach(l => {
        html +=
          '<label style="display:flex;align-items:flex-start;gap:6px;margin:3px 0;cursor:pointer;" title="' + esc(l.notes || '') + '">' +
            '<input type="checkbox" id="lyrcb_' + l.id + '" style="accent-color:var(--green, #2a7a58);margin-top:2px;">' +
            '<span style="width:10px;height:10px;border-radius:2px;margin-top:3px;flex-shrink:0;background:' + l.color + '55;border:1.5px solid ' + l.color + ';"></span>' +
            '<span style="flex:1;line-height:1.35;">' + esc(l.name) +
              '<span id="lyrst_' + l.id + '" style="display:block;font-size:10px;color:var(--text3);"></span></span>' +
          '</label>';
      });
      html += '</div>';
    });
    html +=
      '<div style="border-top:0.5px solid var(--border);margin-top:8px;padding-top:8px;">' +
        '<div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text3);margin-bottom:4px;">Layer check</div>' +
        '<div style="font-size:11px;color:var(--text2);line-height:1.4;margin-bottom:6px;">Tests every drawn polygon against every layer above, ticked or not.</div>' +
        '<button id="lyrCheck" class="dl-btn" style="width:100%;margin-bottom:5px;">Check polygons against layers</button>' +
        '<button id="lyrDl" class="dl-btn" style="width:100%;" disabled>&#8595; Layer check CSV</button>' +
        '<div id="lyrResult" style="margin-top:6px;font-size:11px;line-height:1.45;color:var(--text2);"></div>' +
      '</div>' +
      '<div style="margin-top:8px;font-size:10px;color:var(--text3);line-height:1.4;">Published GIS layers, not the legal plan maps. ' +
        '<a href="#" id="lyrForget" style="color:var(--text3);">Lock and forget</a></div>' +
      '</div>';
    panel.innerHTML = html;
    mapEl.appendChild(panel);

    const setGroup = (name, fold) => {
      panel.querySelectorAll('.lyr-grp-body').forEach(b => { if (b.dataset.grp === name) b.style.display = fold ? 'none' : ''; });
      panel.querySelectorAll('.lyr-grp').forEach(h => { if (h.dataset.grp === name) { h.querySelector('.lyr-chev').style.transform = fold ? '' : 'rotate(90deg)'; h.setAttribute('aria-expanded', String(!fold)); } });
    };
    const wireGroup = (h) => {
      setGroup(h.dataset.grp, closed.includes(h.dataset.grp));
      h.addEventListener('click', () => {
        const fold = !closed.includes(h.dataset.grp);
        closed = fold ? closed.concat(h.dataset.grp) : closed.filter(n => n !== h.dataset.grp);
        lsSet(GROUPS_STORE, JSON.stringify(closed));
        setGroup(h.dataset.grp, fold);
      });
    };
    panel.querySelectorAll('.lyr-grp').forEach(wireGroup);
    // A host page can put its own group at the top (inferrd.'s condition
    // check layers): HOST.panelSection(el, group) is called once, and
    // group(name, bodyEl) returns a folding heading for that body.
    if (typeof HOST.panelSection === 'function') {
      HOST.panelSection(panel.querySelector('#lyrHost'), (name, body) => {
        const wrap = document.createElement('div');
        wrap.innerHTML = groupHead(name);
        const h = wrap.firstChild;
        body.classList.add('lyr-grp-body'); body.dataset.grp = name;
        wrap.appendChild(body);
        wireGroup(h);
        return wrap;
      });
    }

    register.layers.forEach(l => {
      document.getElementById('lyrcb_' + l.id).addEventListener('change', e => toggleLayer(l.id, e.target.checked));
    });
    panel.querySelector('#lyrClose').addEventListener('click', () => { window._layersDeactivate(); if (window._projectsSetLocked) window._projectsSetLocked('layers'); });
    panel.querySelector('#lyrMin').addEventListener('click', () => {
      const b = panel.querySelector('#lyrBody'); const hide = b.style.display !== 'none';
      b.style.display = hide ? 'none' : 'block'; panel.querySelector('#lyrMin').textContent = hide ? '+' : '–';
    });
    panel.querySelector('#lyrCheck').addEventListener('click', runCheck);
    panel.querySelector('#lyrDl').addEventListener('click', downloadCheck);
    panel.querySelector('#lyrForget').addEventListener('click', e => {
      e.preventDefault(); lsDel(KEY_STORE); window._layersDeactivate();
      if (window._projectsSetLocked) window._projectsSetLocked('layers');
    });
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

  // Host hook (inferrd.'s "Analyse this area"): HOST.featureAction =
  // { button(onClick) → element, run(feature, label, layerName) }. The shown features
  // are simplified to ~1 px, so ArcGIS features are fetched again at full
  // detail before being handed over; LRIS WFS features are already full.
  function popupWithAction(l, f) {
    const el = document.createElement('div');
    el.innerHTML = popupHtml(l, f.properties);
    el.appendChild(HOST.featureAction.button(async () => {
      let feature = f;
      if (l.source === 'arcgis' && f.id != null && f._sub != null) {
        try {
          const body = new URLSearchParams({ f: 'geojson', objectIds: String(f.id), outFields: '*', outSR: '4326', returnGeometry: 'true', geometryPrecision: '7' });
          const r = await fetch(l.url + '/' + f._sub + '/query', { method: 'POST', body });
          const j = r.ok ? await r.json() : null;
          if (j && j.features && j.features[0] && j.features[0].geometry) feature = j.features[0];
        } catch (e) { console.warn('Layers: full-detail fetch failed, using the shown boundary', e); }
      }
      HOST.featureAction.run(feature, labelFor(l, f.properties) || l.name, l.name);
    }));
    return el;
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
    bbox[0] = G.wrapLng180(bbox[0]); bbox[2] = G.wrapLng180(bbox[2]);
    try {
      let fc = { type: 'FeatureCollection', features: [] }, capped = false;
      if (l.source === 'arcgis') {
        const tol = (bbox[2] - bbox[0]) / (map.getSize().x || 800); // ~1 px in degrees
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
          (j.features || []).forEach(f => { f._sub = sub; });
          fc.features = fc.features.concat(j.features || []);
          if (j.properties && j.properties.exceededTransferLimit) capped = true;
          if (j.exceededTransferLimit) capped = true;
        }
      } else {
        if (!getKey()) throw new Error('no LRIS key');
        const r = await fetch(lrisWfsUrl(l.layer, bbox, MAX_LRIS));
        if (!r.ok) throw new Error('HTTP ' + r.status);
        fc = await r.json();
        capped = (fc.features || []).length >= MAX_LRIS;
      }
      const cb2 = document.getElementById('lyrcb_' + id);
      if (!active || !cb2 || !cb2.checked) return;
      removeShown(id);
      shown[id] = L.geoJSON(fc, {
        pane: 'qeiiPane',
        style: { color: l.color, weight: 1.5, fillColor: l.color, fillOpacity: 0.15 },
        onEachFeature: (f, lyr) => lyr.bindPopup(HOST.featureAction ? () => popupWithAction(l, f) : popupHtml(l, f.properties), { maxWidth: 300 })
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
    const list = typeof HOST.polygons === 'function' ? HOST.polygons() : (typeof polygons !== 'undefined' ? polygons : []);
    return list.filter(p => p.type !== 'species' && p.latlngs && p.latlngs.length >= 3);
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
      if (geom.type === 'Polygon') return turf.booleanIntersects(polyTurf, G.geoJsonPolyToTurfInFrame(geom.coordinates, refLng));
      if (geom.type === 'MultiPolygon') return geom.coordinates.some(c => { try { return turf.booleanIntersects(polyTurf, G.geoJsonPolyToTurfInFrame(c, refLng)); } catch (e) { return false; } });
      return turf.booleanIntersects(polyTurf, { type: 'Feature', geometry: geom, properties: {} });
    } catch (e) { return false; }
  }

  async function checkOne(l, p) {
    const { poly, refLng } = G.llToTurfPolygon(p.latlngs, p.holes);
    const ring = poly.geometry.coordinates[0].map(([x, y]) => [G.wrapLng180(x), y]);
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
      const bbox = [G.wrapLng180(bb[0]), bb[1], G.wrapLng180(bb[2]), bb[3]];
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
      '# Layer check from ' + (HOST.name || 'occurd.') + ' (' + (HOST.url || 'https://rutherfordecology.github.io/Occurd/') + ') on ' + lastCheck.time.slice(0, 10),
      '# Layer register version ' + (register.register_version || '?') + '. Published GIS layers, not the legal plan maps: confirm anything decisive against the operative plan.',
      '# Gisborne District Council layers from GDC ArcGIS Online; Manaaki Whenua layers from the LRIS portal under its licence terms.'
    ].join('\n');
    G.downloadBlob(head + '\n' + G.buildCSV(lastCheck.rows, fields), 'layer_check_' + lastCheck.time.slice(0, 10) + '.csv', 'text/csv');
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

  // ── init ──────────────────────────────────────────────────────────────────
  function init() { if (typeof map !== 'undefined') map.on('moveend', onMove); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
