// ── Projects dropdown + Kakapo (Strigops habroptilus) project ────────────────
// Adds a "Projects" dropdown to the header. Two projects are available:
//   QEII Perpetuity  — key: 'perpetuity'  (delegates to the existing QEII layer)
//   Kakapo           — key: 'whenuahou'   (fetches all global Kakapo GBIF records)
//
// For Kakapo records that lack field coordinates, the publishing organisation's
// registered coordinates (from the GBIF organisation API) are used as a fallback
// so they still appear on the map, distinguished by a grey marker.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  // ── State ────────────────────────────────────────────────────────────────
  const _unlocked = {};         // clientId → true once key accepted
  let   _kakapoLayer  = null;  // Leaflet LayerGroup for kakapo markers
  let   _kakapoLoaded = false; // prevent double-load

  // ── Dropdown HTML ─────────────────────────────────────────────────────────
  function _buildDropdown() {
    const wrap = document.getElementById('projectsDropWrap');
    const btn  = document.getElementById('projectsDropBtn');
    const menu = document.getElementById('projectsMenu');
    if (!wrap || !btn || !menu) return;

    _addItem(menu, 'qeii',   '🔐', 'QEII Perpetuity',    'Access key for QEII covenant layer');
    _addItem(menu, 'kakapo', '🔐', 'Kākāpō · Whenuahou', 'Access key for Kākāpō global records');

    btn.addEventListener('click', e => {
      e.stopPropagation();
      const open = menu.style.display !== 'none';
      menu.style.display = open ? 'none' : 'block';
    });
    document.addEventListener('click', e => {
      if (!wrap.contains(e.target)) {
        menu.style.display = 'none';
        _closeAllForms();
      }
    });
  }

  function _addItem(menu, id, icon, label, hint) {
    const item = document.createElement('div');
    item.id = 'projectItem_' + id;
    item.style.cssText = [
      'padding:9px 14px;cursor:pointer;font-size:12px;color:var(--text)',
      'display:flex;align-items:center;gap:8px;border-bottom:0.5px solid var(--border)',
      'transition:background 0.08s;',
    ].join(';');
    item.innerHTML =
      `<span id="projectIcon_${id}" style="font-size:14px;flex-shrink:0;">${icon}</span>` +
      `<span id="projectLabel_${id}">${label}</span>`;
    item.addEventListener('mouseover', () => { item.style.background = 'var(--surface2)'; });
    item.addEventListener('mouseout',  () => { item.style.background = ''; });
    item.addEventListener('click', e => { e.stopPropagation(); _onItemClick(id, hint); });
    menu.appendChild(item);
  }

  function _onItemClick(id, hint) {
    if (_unlocked[id]) {
      _deactivate(id);
      return;
    }
    // Remove any other open forms
    _closeAllForms(id);
    // Build inline unlock form beneath the item
    const item = document.getElementById('projectItem_' + id);
    if (!item) return;
    const existing = document.getElementById('projectForm_' + id);
    if (existing) { existing.remove(); return; }

    const form = document.createElement('div');
    form.id = 'projectForm_' + id;
    form.style.cssText = 'padding:8px 14px 10px;border-bottom:0.5px solid var(--border);background:var(--surface2);';
    form.innerHTML =
      `<div style="font-size:10px;color:var(--text2);margin-bottom:5px;line-height:1.4;">${hint}</div>` +
      `<div style="display:flex;gap:5px;">` +
        `<input id="projectInput_${id}" type="password" placeholder="key…" autocomplete="new-password" spellcheck="false"
          style="flex:1;font-size:12px;font-family:var(--font-sans);padding:4px 7px;border:1px solid var(--border2);border-radius:4px;outline:none;color:var(--text);background:#fff;">` +
        `<button id="projectSubmit_${id}"
          style="font-size:11px;font-family:var(--font-sans);padding:4px 9px;border-radius:4px;border:none;background:var(--green-dark);color:#fff;cursor:pointer;">↵</button>` +
      `</div>` +
      `<div id="projectErr_${id}" style="display:none;font-size:10px;color:var(--red);margin-top:4px;">Wrong key</div>`;
    item.after(form);

    const input  = form.querySelector('#projectInput_'  + id);
    const submit = form.querySelector('#projectSubmit_' + id);
    const err    = form.querySelector('#projectErr_'    + id);

    function tryKey() {
      const KEYS = { qeii: 'perpetuity', kakapo: 'whenuahou' };
      if (input.value.trim().toLowerCase() === KEYS[id]) {
        form.remove();
        _activate(id);
      } else {
        err.style.display = 'block';
        input.select();
        input.style.borderColor = 'var(--red)';
        setTimeout(() => { input.style.borderColor = 'var(--border2)'; }, 800);
      }
    }
    submit.addEventListener('click', tryKey);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') tryKey(); });
    setTimeout(() => input.focus(), 0);
  }

  function _closeAllForms(exceptId) {
    ['qeii','kakapo'].forEach(id => {
      if (id === exceptId) return;
      const f = document.getElementById('projectForm_' + id);
      if (f) f.remove();
    });
  }

  // ── Activate / deactivate ─────────────────────────────────────────────────
  function _activate(id) {
    _unlocked[id] = true;
    _setIcon(id, '🔓');
    const menu = document.getElementById('clientsMenu');
    if (menu) menu.style.display = 'none';

    if (id === 'qeii') {
      // Delegate to the existing QEII system (qeii.js exposes _qeiiActivate)
      if (typeof window._qeiiActivate === 'function') {
        window._qeiiActivate();
      } else {
        // Fallback: simulate a click on the QEII toggle
        const btn = document.getElementById('qeiiToggleBtn');
        if (btn) btn.click();
      }
    } else if (id === 'kakapo') {
      _loadKakapo();
    }
  }

  function _deactivate(id) {
    _unlocked[id] = false;
    _setIcon(id, '🔐');
    if (id === 'kakapo') {
      if (_kakapoLayer) { map.removeLayer(_kakapoLayer); _kakapoLayer = null; }
      _kakapoLoaded = false;
      _setLabel('kakapo', 'Kākāpō · Whenuahou');
    }
    // QEII deactivation via its own toggle (don't double-fire)
  }

  function _setIcon(id, icon)  { const el = document.getElementById('projectIcon_'  + id); if (el) el.textContent = icon; }
  function _setLabel(id, text) { const el = document.getElementById('projectLabel_' + id); if (el) el.textContent = text; }

  // ── Kakapo fetch ──────────────────────────────────────────────────────────
  async function _loadKakapo() {
    if (_kakapoLoaded) return;
    _kakapoLoaded = true;
    _setIcon('kakapo', '⏳');
    _setLabel('kakapo', 'Kākāpō · loading…');

    try {
      // 1. Resolve GBIF taxon key for Strigops habroptilus
      const matchRes = await fetch(
        'https://api.gbif.org/v1/species/match?name=Strigops+habroptilus&kingdom=Animalia'
      );
      const matchData = await matchRes.json();
      const taxonKey  = matchData.usageKey;
      if (!taxonKey) throw new Error('Taxon not matched');

      // 2. Paginate through all records (no geometry filter — global)
      const allRecords = [];
      const LIMIT = 300;
      let offset = 0;
      while (true) {
        const res  = await fetch(
          `https://api.gbif.org/v1/occurrence/search?taxonKey=${taxonKey}&limit=${LIMIT}&offset=${offset}`
        );
        const data = await res.json();
        allRecords.push(...(data.results || []));
        if (data.endOfRecords || allRecords.length >= (data.count || 0)) break;
        offset += LIMIT;
        if (offset > 9900) break; // safety cap
      }

      // 3. Split coordinated vs uncoordinated
      const withCoords    = allRecords.filter(r => r.decimalLatitude  != null && r.decimalLongitude != null);
      const withoutCoords = allRecords.filter(r => r.decimalLatitude  == null || r.decimalLongitude == null);

      // 4. For uncoordinated records: fetch publishing organisation coordinates
      //    Each unique publishingOrganizationKey → GET /v1/organization/{key}
      const orgCache = {};
      const orgKeys  = [...new Set(withoutCoords.map(r => r.publishingOrganizationKey).filter(Boolean))];
      await Promise.all(orgKeys.map(async orgKey => {
        try {
          const r = await fetch(`https://api.gbif.org/v1/organization/${orgKey}`);
          const d = await r.json();
          if (d.latitude != null && d.longitude != null) {
            orgCache[orgKey] = { lat: d.latitude, lng: d.longitude, name: d.title || orgKey };
          }
        } catch (_) {}
      }));

      // Attach institution coordinates to uncoordinated records
      const institutionPlaced = [];
      withoutCoords.forEach(r => {
        const org = r.publishingOrganizationKey && orgCache[r.publishingOrganizationKey];
        if (org) {
          institutionPlaced.push(Object.assign({}, r, {
            decimalLatitude:  org.lat,
            decimalLongitude: org.lng,
            _instName:        org.name,
            _isInst:          true,
          }));
        }
      });

      const toPlot = [...withCoords, ...institutionPlaced];

      // 5. Build Leaflet layer
      if (_kakapoLayer) map.removeLayer(_kakapoLayer);
      _kakapoLayer = L.layerGroup().addTo(map);

      toPlot.forEach(r => {
        const inst = r._isInst;
        const circle = L.circleMarker(
          [r.decimalLatitude, r.decimalLongitude],
          {
            radius:      inst ? 5 : 7,
            color:       inst ? '#888'    : '#1a5c34',
            weight:      1.5,
            fillColor:   inst ? '#bbb'    : '#27ae60',
            fillOpacity: inst ? 0.55      : 0.82,
            pane:        'markerPane',
          }
        );

        const date  = r.eventDate ? r.eventDate.substring(0, 10) : (r.year ? String(r.year) : '—');
        const where = inst
          ? `<em style="color:#888;">Institution: ${r._instName}</em>`
          : [r.locality, r.stateProvince, r.country].filter(Boolean).join(', ') || '—';
        const link  = `https://www.gbif.org/occurrence/${r.gbifID || r.key}`;

        circle.bindPopup(
          `<div style="font-size:12px;line-height:1.8;min-width:190px;">
            <strong style="font-size:13px;">🦜 Kākāpō</strong>
            ${inst ? '<span style="font-size:10px;color:#888;"> · institution coords</span>' : ''}<br>
            <span style="color:#555;">Date: ${date}</span><br>
            <span style="color:#555;">Basis: ${r.basisOfRecord || '—'}</span><br>
            <span style="color:#555;">${where}</span><br>
            ${r.recordedBy ? `<span style="color:#555;">By: ${r.recordedBy}</span><br>` : ''}
            <a href="${link}" target="_blank" style="color:var(--green-dark);font-size:11px;">View on GBIF ↗</a>
          </div>`,
          { maxWidth: 280 }
        );
        _kakapoLayer.addLayer(circle);
      });

      // 6. Fit map to plotted bounds
      if (toPlot.length > 0) {
        try {
          map.fitBounds(
            L.latLngBounds(toPlot.map(r => [r.decimalLatitude, r.decimalLongitude])).pad(0.08)
          );
        } catch (_) {}
      }

      // 7. Update dropdown label
      const noCoordCount = withoutCoords.length - institutionPlaced.length;
      _setIcon('kakapo', '🟢');
      _setLabel('kakapo',
        `Kākāpō — ${toPlot.length.toLocaleString()} records` +
        (institutionPlaced.length ? ` (${institutionPlaced.length} at institution)` : '') +
        (noCoordCount > 0 ? ` · ${noCoordCount} unplaceable` : '')
      );

    } catch (e) {
      console.warn('Kakapo load error:', e);
      _setIcon('kakapo', '❌');
      _setLabel('kakapo', 'Kākāpō · load failed');
      _kakapoLoaded = false;
    }
  }

  // ── Init (after DOM ready) ────────────────────────────────────────────────
  function _init() {
    _buildDropdown();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

})();
