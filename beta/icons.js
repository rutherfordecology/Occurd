/* Rutherford Ecology — shared icon set.
   One consistent line style: 24x24 grid, 2px stroke, currentColor.
   Icons inherit color + size from their parent, like text.

   Usage:
     <span data-icon="search"></span>            auto-hydrated on load
     el.innerHTML = icon('map', { size: 18 })     build a string
     icon('tag', { size: 16, cls: 'muted' })      optional class

   Re-run hydrateIcons(root) after injecting new markup. */
(function () {
  var ICONS = {
    // ── core UI ─────────────────────────────────────────────
    search: '<circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16" y2="16"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
    'chevron-down': '<polyline points="6 9 12 15 18 9"/>',
    'chevron-right': '<polyline points="9 6 15 12 9 18"/>',
    'arrow-right': '<line x1="4" y1="12" x2="20" y2="12"/><polyline points="13 5 20 12 13 19"/>',
    'arrow-left': '<line x1="20" y1="12" x2="4" y2="12"/><polyline points="11 5 4 12 11 19"/>',
    'external-link': '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
    info: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    warning: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="14"/><line x1="12" y1="17.5" x2="12.01" y2="17.5"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
    filter: '<polygon points="22 3 2 3 10 12.5 10 19 14 21 14 12.5 22 3"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M21 16v3a2 2 0 0 1-2 2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
    // ── access / privacy ────────────────────────────────────
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.9-1"/>',
    key: '<circle cx="7.5" cy="15.5" r="4.5"/><line x1="10.7" y1="12.3" x2="20.5" y2="2.5"/><line x1="16.5" y1="6.5" x2="19.5" y2="9.5"/><line x1="13.5" y1="9.5" x2="16.5" y2="12.5"/>',
    // ── domain: mapping / biodiversity ──────────────────────
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    map: '<polygon points="2 6 2 22 9 18 15 22 22 18 22 2 15 6 9 2 2 6"/><line x1="9" y1="2" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="22"/>',
    'map-pin': '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    crosshair: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V3h9l8.6 8.6a2 2 0 0 1 0 2.8z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
    flask: '<path d="M9 3h6"/><path d="M10 3v7L4.8 19.2A1.4 1.4 0 0 0 6 21.3h12a1.4 1.4 0 0 0 1.2-2.1L14 10V3"/><line x1="7.5" y1="15" x2="16.5" y2="15"/>',
    bird: '<path d="M16 7h.01"/><path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20"/><path d="M20 7h2"/><path d="M6 13c1.5 1 3 1.5 4.5 1.5"/>',
    award: '<circle cx="12" cy="8" r="6"/><polyline points="8.2 13.2 7 22 12 19 17 22 15.8 13.2"/>',
    volume: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.8 5.2a9 9 0 0 1 0 13.6"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
    waveform: '<line x1="4" y1="10" x2="4" y2="14"/><line x1="8" y1="6" x2="8" y2="18"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="16" y1="7" x2="16" y2="17"/><line x1="20" y1="10" x2="20" y2="14"/>',
    coffee: '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>',
    // ── taxa / life groups (WhatDat quick-picks) ────────────
    mammal: '<ellipse cx="9.5" cy="6.5" rx="1.6" ry="3.8"/><ellipse cx="14.5" cy="6.5" rx="1.6" ry="3.8"/><circle cx="12" cy="15" r="5"/><circle cx="10.3" cy="14.5" r=".7" fill="currentColor" stroke="none"/><circle cx="13.7" cy="14.5" r=".7" fill="currentColor" stroke="none"/>',
    fish: '<path d="M3 12c3-4.5 9-4.5 12 0-3 4.5-9 4.5-12 0z"/><path d="M15 12l6-4v8z"/><circle cx="6.5" cy="11" r=".8" fill="currentColor" stroke="none"/>',
    shark: '<path d="M3 12.5c4-2.5 9-2.5 13 0-4 2.5-9 2.5-13 0z"/><path d="M16 12.5l5-3v6z"/><path d="M9 10.8 11 6l2.5 4.4"/><circle cx="6.5" cy="12" r=".7" fill="currentColor" stroke="none"/>',
    reptile: '<path d="M7 20c-2-1.4-1.5-4 .9-4.3 2.3-.3 3.9-1.1 3.9-3.1 0-1.9-1.8-2.7-1.8-4.6 0-1.7 1.4-3 3.3-3"/><circle cx="14" cy="4.6" r="1.5"/><circle cx="14.2" cy="4.3" r=".45" fill="currentColor" stroke="none"/><path d="M15.4 4 17.2 3M16.4 3.5 17.2 3 16.5 2.4"/>',
    amphibian: '<path d="M4 12.5c0-3.5 3.5-5.5 8-5.5s8 2 8 5.5c0 3-3.5 4.8-8 4.8s-8-1.8-8-4.8z"/><circle cx="8.5" cy="8" r="2"/><circle cx="15.5" cy="8" r="2"/><path d="M8.5 13.5c2 1.5 5 1.5 7 0"/>',
    insect: '<ellipse cx="12" cy="13" rx="4" ry="5.5"/><line x1="12" y1="7.5" x2="12" y2="18.5"/><circle cx="12" cy="6" r="2"/><path d="M11 4.5 9.5 2.5M13 4.5 14.5 2.5"/><path d="M8 10.5 4 8.5M8 13H4M8 15.5 4 17.5M16 10.5 20 8.5M16 13h4M16 15.5 20 17.5"/>',
    spider: '<circle cx="12" cy="13" r="3"/><circle cx="12" cy="9" r="1.6"/><path d="M9.2 12 4 9M9 13.2 3.5 13.5M9.2 14.5 4.5 17.5M14.8 12 20 9M15 13.2 20.5 13.5M14.8 14.5 19.5 17.5M10.5 10.5 8 6M13.5 10.5 16 6"/>',
    fungi: '<path d="M4 11.5a8 5 0 0 1 16 0z"/><line x1="4" y1="11.5" x2="20" y2="11.5"/><path d="M9.5 11.5c0 3.5.2 6-1 8.5h7c-1.2-2.5-1-5-1-8.5"/>',
    animal: '<ellipse cx="6" cy="10.5" rx="1.4" ry="1.9"/><ellipse cx="9.5" cy="7.5" rx="1.5" ry="2.1"/><ellipse cx="13.5" cy="7.5" rx="1.5" ry="2.1"/><ellipse cx="17" cy="10.5" rx="1.4" ry="1.9"/><path d="M8 15.5c1.2-1.6 6.8-1.6 8 0 1 1.4.3 3.6-1.4 4.2-1.2.4-2.6-.4-3.6-.4s-2.4.8-3.6.4C5.7 19.1 5 16.9 8 15.5z"/>'
  };

  var DEFAULT_SIZE = 20;

  function icon(name, opts) {
    var inner = ICONS[name];
    if (!inner) return '';
    opts = opts || {};
    var size = opts.size || DEFAULT_SIZE;
    var cls = opts.cls ? ' class="' + opts.cls + '"' : '';
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size +
      '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' +
      cls + ' aria-hidden="true">' + inner + '</svg>';
  }

  function hydrateIcons(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll('[data-icon]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.__iconDone) continue;
      var name = el.getAttribute('data-icon');
      if (!ICONS[name]) continue;
      var size = el.getAttribute('data-icon-size') || DEFAULT_SIZE;
      el.innerHTML = icon(name, { size: size });
      el.style.display = el.style.display || 'inline-flex';
      el.__iconDone = true;
    }
  }

  window.Icons = ICONS;
  window.icon = icon;
  window.hydrateIcons = hydrateIcons;

  if (document.readyState !== 'loading') hydrateIcons();
  else document.addEventListener('DOMContentLoaded', function () { hydrateIcons(); });
})();
