// ── Projects dropdown ─────────────────────────────────────────────────────────
// Adds a "Projects" dropdown to the header.
// Projects: QEII Perpetuity (delegates to qeii.js) and Layers (delegates to layers.js,
// unlocked with the user's own LRIS API key, which is stored only in their browser).
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  const _unlocked = {};

  // ── Dropdown HTML ─────────────────────────────────────────────────────────
  function _buildDropdown() {
    const wrap = document.getElementById('projectsDropWrap');
    const btn  = document.getElementById('projectsDropBtn');
    const menu = document.getElementById('projectsMenu');
    if (!wrap || !btn || !menu) return;

    _addItem(menu, 'qeii', icon('lock', { size: 14 }), 'QEII', 'Enter access key for QEII covenant layer');
    _addItem(menu, 'layers', icon('lock', { size: 14 }), 'Layers',
      'Enter your LRIS API key (from <a href="https://lris.scinfo.org.nz/" target="_blank" style="color:var(--green-dark);">lris.scinfo.org.nz</a>, with query, tiles and WFS access). It stays in this browser only.');

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
      `<span id="projectIcon_${id}" style="display:inline-flex;align-items:center;flex-shrink:0;color:var(--green-dark);">${icon}</span>` +
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
    if (id === 'layers' && window._layersHasKey && window._layersHasKey()) {
      _closeAllForms();
      _activate(id);
      return;
    }
    _closeAllForms(id);
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
      if (id === 'layers') {
        const k = input.value.trim();
        if (!k || !window._layersSetKey) return;
        submit.disabled = true;
        window._layersSetKey(k).then(ok => {
          submit.disabled = false;
          if (ok) { form.remove(); _activate(id); }
          else { err.textContent = 'LRIS did not accept that key'; err.style.display = 'block'; input.select(); }
        });
        return;
      }
      const KEYS = { qeii: 'perpetuity' };
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
    ['qeii', 'layers'].forEach(id => {
      if (id === exceptId) return;
      const f = document.getElementById('projectForm_' + id);
      if (f) f.remove();
    });
  }

  // ── Activate / deactivate ─────────────────────────────────────────────────
  function _activate(id) {
    _unlocked[id] = true;
    _setIcon(id, icon('unlock', { size: 14 }));
    const menu = document.getElementById('projectsMenu');
    if (menu) menu.style.display = 'none';
    if (id === 'qeii') {
      if (typeof window._qeiiActivate === 'function') window._qeiiActivate();
    }
    if (id === 'layers') {
      if (typeof window._layersActivate === 'function') window._layersActivate();
    }
  }

  function _deactivate(id) {
    _unlocked[id] = false;
    _setIcon(id, icon('lock', { size: 14 }));
    if (id === 'layers' && typeof window._layersDeactivate === 'function') window._layersDeactivate();
  }
  // Lets layers.js re-lock the menu item when its panel is closed or the key is forgotten
  window._projectsSetLocked = function (id) { _unlocked[id] = false; _setIcon(id, icon('lock', { size: 14 })); };

  function _setIcon(id, icon) { const el = document.getElementById('projectIcon_' + id); if (el) el.innerHTML = icon; }

  // ── Init ──────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _buildDropdown);
  } else {
    _buildDropdown();
  }

})();
