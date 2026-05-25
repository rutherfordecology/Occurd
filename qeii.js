// ── QEII National Trust covenant layer ───────────────────────────────────────
// Shared state — accessible by the DRAWCREATED handler for auto-selection
// Activation is handled entirely via the Projects dropdown (kakapo.js).
window._qeiiState = { active: false, features: [] };

(function() {
  let qeiiLayer   = null;   // L.geoJSON layer currently on map
  let qeiiLoading = false;
  let qeiiUnlocked = false; // true once the user has entered the correct key

  // Exposed so kakapo.js (projects dropdown) can activate QEII programmatically
  window._qeiiActivate = function() {
    if (!qeiiUnlocked) {
      qeiiUnlocked = true;
    }
    if (!window._qeiiState.active) toggleQeii();
  };

  function _syncBtn() {
    const b = document.getElementById('qeiiToggleBtn');
    if (!b) return;
    b.classList.toggle('active', window._qeiiState.active);
    b.style.color      = window._qeiiState.active ? 'var(--green-dark)' : 'var(--text3)';
    b.style.fontWeight = window._qeiiState.active ? '600' : 'normal';
  }

  function toggleQeii() {
    window._qeiiState.active = !window._qeiiState.active;
    _syncBtn();
    if (window._qeiiState.active) {
      fetchQeii();
    } else {
      clearQeii();
    }
  }

  function clearQeii() {
    if (qeiiLayer) { map.removeLayer(qeiiLayer); qeiiLayer = null; }
    window._qeiiState.features = [];
  }

  async function fetchQeii() {
    if (!window._qeiiState.active) return;
    if (qeiiLoading) return;
    qeiiLoading = true;

    const b = document.getElementById('qeiiToggleBtn');
    if (b) { b._savedHTML = b.innerHTML; b.innerHTML = '⏳ loading…'; b.style.color = 'var(--text2)'; }

    try {
      const bounds = map.getBounds();
      const env = [
        bounds.getWest(), bounds.getSouth(),
        bounds.getEast(), bounds.getNorth()
      ].join(',');

      const url = 'https://services-ap1.arcgis.com/h9r62GhsQQYscUHs/arcgis/rest/services/QEII_National_Trust_protected_areas/FeatureServer/0/query?' +
        new URLSearchParams({
          geometry:          env,
          geometryType:      'esriGeometryEnvelope',
          spatialRel:        'esriSpatialRelIntersects',
          inSR:              '4326',
          outSR:             '4326',
          outFields:         'CovNumber,Type,AreaSurvHa,DateRegd,QEIIRegion,TA_Name',
          returnGeometry:    'true',
          f:                 'geojson',
          resultRecordCount: 1000
        });

      const resp = await fetch(url);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();

      if (!window._qeiiState.active) return;   // toggled off while loading

      clearQeii();
      window._qeiiState.features = data.features || [];

      qeiiLayer = L.geoJSON(data, {
        pane: 'qeiiPane',
        style: {
          color:       '#0e6655',
          weight:      1.5,
          fillColor:   '#1abc9c',
          fillOpacity: 0.18,
          dashArray:   '4 3'
        },
        onEachFeature: function(feature, layer) {
          const p = feature.properties || {};
          const ha   = p.AreaSurvHa ? parseFloat(p.AreaSurvHa).toFixed(1) + ' ha' : '—';
          const date = p.DateRegd
            ? new Date(p.DateRegd).toLocaleDateString('en-NZ', { year:'numeric', month:'short' })
            : '—';
          layer.bindPopup(
            '<div style="font-size:12px;line-height:1.7;min-width:160px;">' +
            '<strong style="font-size:13px;">' + (p.CovNumber || 'QEII Covenant') + '</strong><br>' +
            (p.Type ? '<span style="color:#555;">' + p.Type + '</span><br>' : '') +
            '<span style="color:#555;">Area: ' + ha + '</span><br>' +
            '<span style="color:#555;">Registered: ' + date + '</span><br>' +
            (p.TA_Name     ? '<span style="color:#555;">TA: '     + p.TA_Name     + '</span><br>' : '') +
            (p.QEIIRegion  ? '<span style="color:#555;">Region: ' + p.QEIIRegion  + '</span>'    : '') +
            '</div>',
            { maxWidth: 240 }
          );
          layer.on('mouseover', function() { layer.setStyle({ fillOpacity: 0.38, weight: 2.5 }); });
          layer.on('mouseout',  function() { layer.setStyle({ fillOpacity: 0.18, weight: 1.5 }); });
        }
      }).addTo(map);

    } catch(e) {
      console.warn('QEII fetch failed:', e);
    } finally {
      qeiiLoading = false;
      const b2 = document.getElementById('qeiiToggleBtn');
      if (b2) {
        if (b2._savedHTML) { b2.innerHTML = b2._savedHTML; delete b2._savedHTML; }
        _syncBtn();
      }
    }
  }

  // Refresh on pan/zoom (debounced)
  let qeiiMoveTimer = null;
  map.on('moveend', function() {
    if (!window._qeiiState.active) return;
    clearTimeout(qeiiMoveTimer);
    qeiiMoveTimer = setTimeout(fetchQeii, 400);
  });
})();
