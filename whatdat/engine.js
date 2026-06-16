// WhatDat? Quiz Engine v1.0
// Shared engine for all quiz pages.
// Each page calls: initEngine(config)
const APP_VERSION = 'v1.0';
window.__engineLoaded = true;

// ── Config ────────────────────────────────────────────────────────────────
let CFG = {};
let _swipeX = 0;

// ── Constants ─────────────────────────────────────────────────────────────
const STREAK_TARGET = 10;
const CONFETTI_COLORS = ['#1a5940','#2a7a58','#6dba9a','#d4a84b','#2c5f8a','#7aaed4','#8a6020','#d47a7a'];
const CORRECT_MSGS = ['Amazing!','Brilliant!','Yes!','On fire!','Super!','Spot on!','Nailed it!','Perfect!','Woohoo!','Awesome!','Great job!','Fantastic!'];
const STREAK_MSGS  = {3:'3 in a row!', 5:'5 streak!', 7:'Lucky 7!', 9:'One more!!!'};

// ── Image fetching ────────────────────────────────────────────────────────
const inatPhotoCache    = {};
const wikiCache         = {};
const colorVarianceCache = new Map();

function checkColorVariance(url) {
  if (colorVarianceCache.has(url)) return Promise.resolve(colorVarianceCache.get(url));
  return new Promise(resolve => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    const done = v => { colorVarianceCache.set(url, v); resolve(v); };
    const timer = setTimeout(() => done(true), 4000);
    img.onerror = () => { clearTimeout(timer); done(true); };
    img.onload = () => {
      clearTimeout(timer);
      try {
        const S = 40, c = document.createElement('canvas');
        c.width = c.height = S;
        const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, S, S);
        const d = ctx.getImageData(0, 0, S, S).data, n = d.length >> 2;
        let sR=0,sG=0,sB=0;
        for(let i=0;i<d.length;i+=4){sR+=d[i];sG+=d[i+1];sB+=d[i+2];}
        const mR=sR/n,mG=sG/n,mB=sB/n;
        let v=0;
        for(let i=0;i<d.length;i+=4) v+=(d[i]-mR)**2+(d[i+1]-mG)**2+(d[i+2]-mB)**2;
        const stdDev=Math.sqrt(v/(n*3));
        const lo=Math.floor(S*0.3),hi=Math.floor(S*0.7);
        let cR=0,cG=0,cB=0,cN=0,eR=0,eG=0,eB=0,eN=0;
        for(let y=0;y<S;y++) for(let x=0;x<S;x++){
          const i=(y*S+x)*4;
          if(x>=lo&&x<hi&&y>=lo&&y<hi){cR+=d[i];cG+=d[i+1];cB+=d[i+2];cN++;}
          else{eR+=d[i];eG+=d[i+1];eB+=d[i+2];eN++;}
        }
        const ced=Math.sqrt(((cR/cN)-(eR/eN))**2+((cG/cN)-(eG/eN))**2+((cB/cN)-(eB/eN))**2);
        done(stdDev>42||(stdDev>26&&ced>12));
      } catch { done(true); }
    };
    img.src = url;
  });
}

const inatIdCache = {};
async function lookupInatId(latin, commonName) {
  if (inatIdCache[latin] !== undefined) return inatIdCache[latin];
  try {
    const r = await fetch(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(latin)}&rank=species&per_page=5`);
    if (!r.ok) { inatIdCache[latin] = null; return null; }
    const d = await r.json();
    const epithet = latin.split(' ')[1]?.toLowerCase();
    let taxon = d.results?.find(t => t.name.toLowerCase() === latin.toLowerCase());
    if (!taxon) {
      taxon = d.results?.find(t => {
        const tEpi = t.name.split(' ')[1]?.toLowerCase();
        return epithet && tEpi === epithet;
      });
    }
    inatIdCache[latin] = taxon?.id || null;
  } catch { inatIdCache[latin] = null; }
  return inatIdCache[latin];
}

async function fetchInatImage(bird) {
  const latin = typeof bird === 'string' ? bird : (bird.latin || bird.name);
  const commonName = typeof bird === 'object' ? bird.name : null;
  const cacheKey = latin;

  if (!inatPhotoCache[cacheKey]) {
    try {
      const preloaded = typeof bird === 'object' ? bird.defaultPhoto : null;
      const inatId = (typeof bird === 'object' && bird.inatId)
        ? bird.inatId
        : await lookupInatId(latin, commonName);

      const obsPhotos = [];
      const taxonParam = inatId ? `taxon_id=${inatId}` : `taxon_name=${encodeURIComponent(latin)}`;
      const or = await fetch(`https://api.inaturalist.org/v1/observations?${taxonParam}&photos=true&per_page=20&quality_grade=research&order_by=faves`);
      if (or.ok) {
        const od = await or.json();
        for (const o of (od.results || [])) {
          const src = o.photos?.[0]?.url?.replace('/square.', '/medium.');
          if (src) obsPhotos.push({ src, faves: o.faves_count || 0 });
        }
      }

      obsPhotos.sort((a, b) => b.faves - a.faves);
      const seen = new Set(preloaded ? [preloaded] : []);
      const sorted = obsPhotos.map(p => p.src).filter(src => { if (seen.has(src)) return false; seen.add(src); return true; });

      let taxonPhoto = preloaded;
      if (!taxonPhoto) {
        const taxaUrl = inatId
          ? `https://api.inaturalist.org/v1/taxa/${inatId}`
          : `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(latin)}&rank=species&per_page=3`;
        try {
          const tr = await fetch(taxaUrl);
          if (tr.ok) {
            const td = await tr.json();
            const commonWords = new Set((commonName||'').toLowerCase().split(/\s+/).filter(w => w.length > 2));
            const taxon = inatId ? td.results?.[0] : td.results?.find(t => {
              if (t.name.toLowerCase() === latin.toLowerCase()) return true;
              if (!commonWords.size || !t.preferred_common_name) return false;
              return t.preferred_common_name.toLowerCase().split(/\s+/).some(w => commonWords.has(w));
            });
            if (taxon) {
              const dp = taxon.default_photo?.url?.replace('/square.', '/medium.');
              if (dp) taxonPhoto = dp;
              if (taxon.id && !inatId && !sorted.length) {
                const or2 = await fetch(`https://api.inaturalist.org/v1/observations?taxon_id=${taxon.id}&photos=true&per_page=10&quality_grade=research&order_by=faves`);
                if (or2.ok) {
                  const od2 = await or2.json();
                  for (const o of (od2.results || [])) {
                    const src = o.photos?.[0]?.url?.replace('/square.', '/medium.');
                    if (src && !seen.has(src)) { seen.add(src); sorted.push(src); }
                  }
                }
              }
            }
          }
        } catch {}
      }

      const photos = [...sorted];
      if (taxonPhoto) {
        const existingIdx = photos.indexOf(taxonPhoto);
        if (existingIdx > 2) {
          photos.splice(existingIdx, 1);
          photos.splice(1, 0, taxonPhoto);
        } else if (existingIdx === -1) {
          photos.unshift(taxonPhoto);
        }
      }

      inatPhotoCache[cacheKey] = photos;
    } catch { inatPhotoCache[cacheKey] = []; }
  }

  const urls = inatPhotoCache[cacheKey];
  if (!urls.length) return null;
  return urls[0];
}

async function fetchWikiImage(bird) {
  const common = typeof bird === 'string' ? bird : bird.name;
  const latin  = typeof bird === 'object' ? (bird.latin || null) : null;
  const cacheKey = common;
  if (wikiCache[cacheKey] !== undefined) return wikiCache[cacheKey];
  const bad = ['distribution','range','map','blank','locator','svg','silhouette','outline','flag','clade','tree'];
  const tryTitle = async (title) => {
    const r = await fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&pithumbsize=800&format=json&origin=*`);
    if (!r.ok) return null;
    const d = await r.json();
    const src = Object.values(d.query.pages)[0]?.thumbnail?.source || null;
    return src && !bad.some(p => src.toLowerCase().includes(p)) ? src : null;
  };
  try {
    const result = (await tryTitle(common)) || (latin ? await tryTitle(latin) : null);
    wikiCache[cacheKey] = result;
    return result;
  } catch { wikiCache[cacheKey] = null; return null; }
}

async function fetchImage(bird, mode) {
  if (mode === 'easy' && CFG.easyUseWiki) return fetchWikiImage(bird);
  const url = await fetchInatImage(bird);
  if (url) return url;
  return fetchWikiImage(bird);
}

function getPhotoUrls(bird, mode) {
  const name = (mode === 'easy' && CFG.easyUseWiki) ? null : (bird.latin || bird.name);
  const cached = name ? (inatPhotoCache[name] || []).slice(0,5) : [];
  const first = state.imgUrl;
  if (!first) return cached;
  return [first, ...cached.filter(u => u !== first)].slice(0,5);
}

// ── Wikipedia ID notes ────────────────────────────────────────────────────
const wikiSummaryCache = {};
const ID_SECTIONS = /^(description|identification|appearance|plumage|characteristics|field marks|field identification|morphology)/i;

async function fetchIDNote(wikiUrl) {
  if (!wikiUrl) return null;
  if (wikiSummaryCache[wikiUrl] !== undefined) return wikiSummaryCache[wikiUrl];
  try {
    const rawTitle = decodeURIComponent(wikiUrl.split('/wiki/').pop());
    const secR = await fetch(`https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(rawTitle)}&prop=sections&redirects=1&format=json&origin=*`);
    if (!secR.ok) throw new Error();
    const secD = await secR.json();
    const title = secD.parse?.title || rawTitle;
    const sections = secD.parse?.sections || [];
    const idSec = sections.find(s => ID_SECTIONS.test(s.line?.replace(/<[^>]+>/g, '')));

    let text = '';
    if (idSec) {
      const secR2 = await fetch(`https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&section=${idSec.index}&prop=wikitext&format=json&origin=*`);
      if (secR2.ok) {
        const secD2 = await secR2.json();
        const wikitext = secD2.parse?.wikitext?.['*'] || '';
        text = wikitext
          .replace(/{{[^}]*}}/g, '')
          .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
          .replace(/<[^>]+>/g, '')
          .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
          .replace(/'{2,}/g, '')
          .replace(/==+[^=]+==+/g, '')
          .replace(/\n+/g, ' ')
          .trim();
        text = text.replace(/([.!?])\s+/g,'$1\n').split('\n')
          .filter(s => s.trim().length > 30).slice(0,3).join(' ').trim();
      }
    }

    if (!text) {
      const extR = await fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&redirects=1&prop=extracts&explaintext=true&exsectionformat=plain&format=json&origin=*`);
      if (extR.ok) {
        const extD = await extR.json();
        const extract = Object.values(extD.query.pages)[0]?.extract || '';
        const skipPat = /\b(found in|native to|endemic to|range[sd]?( from| across| throughout)?|distribut|taxonom|classif|synonym|named (after|by|for)|family \w+idae|order \w+iformes|conspecific|iucn)\b/i;
        const idPat = /\b(cm|mm|inch|length|wingspan|plumage|feather|crown|mantle|breast|belly|throat|nape|back|wing|tail|bill|beak|eye|leg|foot|colour|color|white|black|brown|grey|gray|green|blue|red|yellow|orange|rufous|chestnut|olive|buff|pale|dark|bright|glossy|streak|spot|stripe|band|patch|underpart|upperpart|adult|male|female|juvenile|immature|leaf|flower|petal|bark|scale|spine|shell|carapace|fin|gill|antenna|thorax|abdomen|wing|elytra)\b/i;
        const sentences = extract.replace(/\n+/g,' ').split(/(?<=[.!?])\s+/);
        const long = sentences.filter(s => s.trim().length > 40);
        const idSents = long.filter(s => idPat.test(s) && !skipPat.test(s));
        const fallback = long.filter(s => !skipPat.test(s));
        text = (idSents.length ? idSents.slice(0,3) : fallback.length ? fallback.slice(0,2) : long.slice(0,2)).join(' ').trim();
      }
    }

    wikiSummaryCache[wikiUrl] = text || null;
    return wikiSummaryCache[wikiUrl];
  } catch { wikiSummaryCache[wikiUrl] = null; return null; }
}

// ── Helpers ───────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i=a.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}

function scoreByAncestry(candidates, correctIds, correctSet) {
  return candidates.map(b => {
    const shared = (b.ancestorIds || []).filter(id => correctSet.has(id));
    const depth = shared.length > 0
      ? Math.max(...shared.map(id => correctIds.indexOf(id)))
      : -1;
    return { b, depth, shared: shared.length };
  }).sort((a, b) => b.depth - a.depth || b.shared - a.shared);
}

function getOptions(correct, pool) {
  if (!correct) return [];
  const correctIds = correct.ancestorIds || [];
  const correctSet = new Set(correctIds);
  const fullPool = CFG.completeBirds?.length ? CFG.completeBirds : pool;
  const notCorrect = b => {
    if (b.name === correct.name) return false;
    if (correct.latin && b.latin && b.latin === correct.latin) return false;
    const a = correct.name.toLowerCase(), bn = b.name.toLowerCase();
    if (a.includes(bn) || bn.includes(a)) return false;
    return true;
  };

  const others = shuffle(fullPool.filter(notCorrect));

  if (correctSet.size > 0 && others.length >= 3) {
    const scored = scoreByAncestry(others, correctIds, correctSet);
    // prefer candidates that share at least one ancestor (same kingdom or closer)
    const related = scored.filter(s => s.depth >= 0);
    const pool3 = related.length >= 3 ? related : scored; // fall back to full scored list if too few related
    const closest = pool3[0];
    const rest    = shuffle(pool3.slice(1, Math.min(10, pool3.length)));
    const picks   = [closest, ...rest.slice(0, 2)];
    if (picks.length >= 3) return shuffle([correct.name, ...picks.map(s => s.b.name)]);
  }

  // Small pool fallback — just pick closest by family/genus then fill randomly
  const genus      = correct.latin?.split(' ')[0] || '';
  const corrFamily = correct.family || '';
  const corrOrder  = correct.order  || '';
  const ranked = [
    ...others.filter(b => corrFamily && b.family === corrFamily),
    ...others.filter(b => corrOrder  && b.order  === corrOrder  && b.family !== corrFamily),
    ...others.filter(b => b.latin?.split(' ')[0] === genus),
    ...others,
  ];
  const seen = new Set(), deduped = [];
  for (const b of ranked) { if (!seen.has(b.name)) { seen.add(b.name); deduped.push(b); } }
  return shuffle([correct.name, ...deduped.slice(0, 3).map(b => b.name)]);
}

// ── State ─────────────────────────────────────────────────────────────────
let state = {
  phase:'loading', mode:'easy', loadError:null, buffer:0,
  queue:[], wrongBin:[], current:null,
  streak:0, streakHistory:[], totalSeen:0, totalCorrect:0,
  selected:null, options:[], imgUrl:null, imgLoading:false,
  photoUrls:[], photoIdx:0,
};
function setState(p) { Object.assign(state,p); render(); }

function getPool() {
  if (state.mode==='rarity')   return CFG.rarityBirds || CFG.easyBirds;
  if (state.mode==='complete') return CFG.completeBirds || CFG.hardBirds || CFG.easyBirds;
  if (state.mode==='hard')     return CFG.hardBirds || CFG.easyBirds;
  return CFG.easyBirds;
}

// ── Celebrations ──────────────────────────────────────────────────────────
function showEncouragement(text) {
  const el=document.getElementById('encourage'); if(el) el.remove();
  const div=document.createElement('div'); div.id='encourage'; div.textContent=text;
  document.body.appendChild(div); setTimeout(()=>div.remove(),1300);
}
function burstStars(x,y) {
  const emojis=['&#11088;','&#10024;','&#128171;','&#127775;'];
  for(let i=0;i<8;i++) {
    const el=document.createElement('div'); el.className='star-burst';
    el.innerHTML=emojis[Math.floor(Math.random()*emojis.length)];
    const angle=(i/8)*Math.PI*2, dist=60+Math.random()*60;
    el.style.cssText=`left:${x}px;top:${y}px;--tx:${Math.cos(angle)*dist}px;--ty:${Math.sin(angle)*dist}px;animation-duration:${0.6+Math.random()*0.3}s`;
    document.body.appendChild(el); setTimeout(()=>el.remove(),1000);
  }
}
function launchConfetti() {
  for(let i=0;i<60;i++) setTimeout(()=>{
    const el=document.createElement('div'); el.className='confetti-piece';
    const size=8+Math.random()*10;
    el.style.cssText=`left:${Math.random()*100}vw;width:${size}px;height:${size}px;background:${CONFETTI_COLORS[Math.floor(Math.random()*CONFETTI_COLORS.length)]};animation-duration:${1.5+Math.random()*2}s;animation-delay:${Math.random()*0.5}s;transform:rotate(${Math.random()*360}deg)`;
    document.body.appendChild(el); setTimeout(()=>el.remove(),3000);
  },i*30);
}

function starsForScore(pct) {
  if(pct>=95) return'&#11088;&#11088;&#11088;&#11088;&#11088;';
  if(pct>=85) return'&#11088;&#11088;&#11088;&#11088;';
  if(pct>=70) return'&#11088;&#11088;&#11088;';
  if(pct>=55) return'&#11088;&#11088;';
  return'&#11088;';
}

function badge(label, cls) { return `<span class="badge ${cls}">${label}</span>`; }
function speciesBadges(sp) {
  const p=[];
  if(sp.endemic)    p.push(badge('Endemic','badge-green'));
  if(sp.introduced) p.push(badge('Introduced','badge-orange'));
  return p.join('');
}

// ── Render ────────────────────────────────────────────────────────────────
function render() {
  const app = document.getElementById('app');
  const isQuiz = state.phase==='quiz';

  const brandBtn = `<div class="header-brand"><a href="https://www.rutherfordecology.co.nz/" target="_blank"><span class="by-word">by </span><span class="re-bold">Rutherford</span> <span class="re-light">ecology</span></a></div>`;
  const taxonTag = CFG.taxonName ? `<div style="display:inline-block;background:#e8f4ef;border:1.5px solid #6dba9a;border-radius:20px;padding:3px 12px;font-size:0.72rem;font-weight:800;color:#1a5940;margin-top:6px;">&#127807; ${CFG.taxonName}</div>` : '';
  const header = isQuiz ? '' : state.phase === 'about' ? `
    <div class="header fade">
      <div class="eyebrow">WHATDAT?</div>
      <h1>WhatDat?</h1>
      ${brandBtn}
    </div>` : `
    <div class="header fade">
      <div class="eyebrow">${CFG.eyebrow || CFG.placeName.toUpperCase()}</div>
      <h1>${CFG.title || 'WhatDat?<br><span style="font-size:1.3rem;font-weight:700;color:#2a7a58;">' + CFG.placeName + '</span>'}</h1>
      ${taxonTag}
      <p>Can you get ${STREAK_TARGET} in a row?</p>
      ${brandBtn}
    </div>`;

  if (state.phase==='loading') {
    app.innerHTML = header + `
      <div class="loading-wrap fade">
        <div class="spinner"></div>
        <div class="loading-text">Loading species for ${CFG.placeName}...</div>
        <div class="loading-sub">${state.buffer>0?`Searching within ${state.buffer}km radius`:'Fetching from GBIF + iNaturalist'}</div>
      </div>`;
    return;
  }

  if (state.phase==='error') {
    app.innerHTML = header + `
      <div class="error-box fade">
        <p>${state.loadError||'Could not load species for this location.'}</p>
        <button class="btn-primary" onclick="window.location.href='${CFG.backUrl}'">&#8592; WhatDat?</button>
      </div>`;
    return;
  }

  if (state.phase==='about') { renderAbout(app, header); return; }
  if (state.phase==='species') { renderSpeciesList(app, header); return; }
  if (state.phase==='intro') { renderIntro(app, header); return; }
  if (state.phase==='celebrate') { renderCelebrate(app, header); return; }
  if (state.phase==='result') { renderResult(app, header); return; }
  renderQuiz(app);
}

function renderIntro(app, header) {
  const easy     = CFG.easyBirds;
  const hard     = CFG.hardBirds;
  const complete = CFG.completeBirds;
  const rarity   = CFG.rarityBirds;
  const hasHard     = hard && hard.length > easy.length;
  const hasComplete = complete && complete.length > (hard||easy).length;
  const hasRarity   = rarity && rarity.length >= 8;

  const modeGrid = `<div class="mode-grid">
    <button class="mode-btn ${state.mode==='easy'?'active':''}" onclick="setMode('easy')">
      <div class="mode-emoji">&#129468;</div>
      <div class="mode-count" id="mc-easy">${easy.length} SPECIES</div>
      <div class="mode-title">Common</div>
      <div class="mode-desc">The most frequently recorded species here.</div>
    </button>
    <button class="mode-btn ${state.mode==='hard'?'active':''}" ${hasHard?'':'disabled'} onclick="setMode('hard')">
      <div class="mode-emoji">&#128247;</div>
      <div class="mode-count" id="mc-hard">${hasHard?hard.length+' SPECIES':'Loading...'}</div>
      <div class="mode-title">Recorder</div>
      <div class="mode-desc">The 90% of species you're likely to encounter here.</div>
    </button>
    <button class="mode-btn ${state.mode==='complete'?'active':''}" ${hasComplete?'':'disabled'} onclick="setMode('complete')">
      <div class="mode-emoji">&#128301;</div>
      <div class="mode-count" id="mc-complete">${hasComplete?complete.length+' SPECIES':'Loading...'}</div>
      <div class="mode-title">Complete</div>
      <div class="mode-desc">Everything ever recorded. Gets progressively harder.</div>
    </button>
    <button class="mode-btn ${state.mode==='rarity'?'active':''}" ${hasRarity?'':'disabled'} ${hasRarity?`onclick="setMode('rarity')"`:''}>
      <div class="mode-emoji">&#128269;</div>
      <div class="mode-count" id="mc-rarity">${hasRarity?rarity.length+' SPECIES':'Not enough species'}</div>
      <div class="mode-title">Rarity</div>
      <div class="mode-desc">The least-recorded species in this area.</div>
    </button>
  </div>`;

  const rarityNote = state.mode === 'rarity' ? `
    <div class="info-box" style="margin-bottom:12px;border-color:#d47a7a;background:#faf0f0;">
      <p style="color:#8a2c2c;"><strong>Rarity mode:</strong> These species have very few recorded occurrences in this area. Some may be genuine rarities, others may be misidentifications or data issues. Treat with appropriate scepticism.</p>
    </div>` : '';

  const bufferNote = state.buffer>0 ? `<p class="note-text">&#x1F4E1; Area expanded to ${state.buffer}km radius to find enough species</p>` : '';

  app.innerHTML = header + modeGrid + rarityNote + `
    <button class="btn-primary" onclick="startQuiz()">Let's Go! &#128640;</button>
    ${bufferNote}
    <div class="info-box" style="margin-top:12px;">
      <p>&#127919; Get your score to <strong>${STREAK_TARGET} to win!</strong> Each correct answer scores +1, wrong answers cost -2. Tricky species keep coming back.</p>
    </div>
    <button class="btn-secondary" onclick="setState({phase:'species'})">&#128203; Species List</button>
    ${CFG.shareUrl ? `<button class="btn-secondary" onclick="copyShareUrl(this)">&#128279; Share this quiz</button>` : ''}
    <button class="btn-back" onclick="setState({phase:'about'})">&#8505; About WhatDat?</button>
    <button class="btn-back" onclick="window.location.href='${CFG.backUrl}'">&#8592; Back</button>`;
}

function renderCelebrate(app, header) {
  launchConfetti();
  const birdsLeft = state.queue.length + state.wrongBin.length;
  const canContinue = birdsLeft > 0;
  app.innerHTML = header + `
    <div class="fade" style="text-align:center;padding:32px 20px;">
      <div style="font-size:3rem;margin-bottom:12px;">&#127881;</div>
      <h2 style="font-size:1.8rem;font-weight:900;color:#1a5940;margin-bottom:8px;">10 points!</h2>
      <p style="color:#6b6960;margin-bottom:28px;">Amazing work — you nailed it!</p>
      ${canContinue ? `
        <button class="btn-primary" onclick="keepPlaying()" style="margin-bottom:12px;">Keep going for 10 more! &#128640;</button>
        <br>` : ''}
      <button class="btn-secondary" onclick="setState({phase:'result'})">See results</button>
    </div>`;
}

function keepPlaying() {
  setState({ phase: 'quiz', streak: 0, streakHistory: [], selected: null, imgUrl: null, imgLoading: true, photoUrls: [], photoIdx: 0 });
  _advance();
}

function renderResult(app, header) {
  const acc = state.totalSeen>0 ? Math.round((state.totalCorrect/state.totalSeen)*100) : 0;
  const stars = starsForScore(acc);
  const msg = [
    acc>=95?'Absolutely flawless! &#127942;':null,
    acc>=85?'Brilliant work! &#127775;':null,
    acc>=70?'Great job! &#127881;':null,
    acc>=55?'Well done! Keep practising! &#128170;':null,
    'You did it! Those tricky ones kept coming back until you nailed them! &#128522;',
  ].find(m=>m!==null);

  app.innerHTML = header + `
    <div class="result">
      <span class="trophy">&#127942;</span>
      <h2>${STREAK_TARGET} points!</h2>
      <div class="star-row">${stars}</div>
      <p class="stat">${state.totalCorrect} correct from ${state.totalSeen} attempts (${acc}%)</p>
      <p class="msg">${msg}</p>
      <button class="btn-primary" onclick="goIntro()">Play Again &#127919;</button>
      ${CFG.shareUrl ? `<button class="btn-secondary" onclick="copyShareUrl(this)">&#128279; Share this quiz</button>` : ''}
      <button class="btn-back" onclick="window.location.href='${CFG.backUrl}'">&#8592; Back</button>
    </div>`;
  launchConfetti();
}

function renderQuiz(app) {
  const bird = state.current;
  if (!bird) return;
  const pool = getPool();
  const modePill = state.mode==='complete'?'pill-complete':state.mode==='hard'?'pill-hard':state.mode==='rarity'?'pill-complete':'pill-easy';
  const modeLabel = state.mode==='complete'?'Complete':state.mode==='hard'?'Recorder':state.mode==='rarity'?'Rarity':'Common';

  const dots = Array.from({length:STREAK_TARGET},(_,i) => {
    const h=state.streakHistory[i];
    return `<div class="${h===true?'dot correct':h===false?'dot wrong':'dot'}">${h===true?'&#11088;':h===false?'&#10005;':''}</div>`;
  }).join('');

  let imgContent;
  if(state.imgLoading) imgContent=`<div class="img-placeholder"><div class="icon">&#128247;</div><span>Loading...</span></div>`;
  else if(state.imgUrl) imgContent=`<img src="${state.imgUrl}" alt="mystery species" onerror="imgFailed()" onload="adjustImgPosition(this)"/>`;
  else imgContent=`<div class="img-placeholder"><div class="icon">&#128247;</div><span>No photo available</span></div>`;

  const multi = state.photoUrls.length>1 && !state.imgLoading;
  const carousel = multi ? `
    <button class="carousel-btn carousel-prev" onclick="prevPhoto()">&#8249;</button>
    <button class="carousel-btn carousel-next" onclick="nextPhoto()">&#8250;</button>
    <div class="carousel-dots">${state.photoUrls.map((_,i)=>`<div class="carousel-dot ${i===state.photoIdx?'active':''}" onclick="goPhoto(${i})"></div>`).join('')}</div>` : '';

  let overlay='';
  if(state.selected) {
    const ok=state.selected===bird.name;
    overlay=`<div class="img-overlay ${ok?'overlay-correct':'overlay-wrong'}">
      <span>${ok?'&#10003;':'&#10007;'}</span>
      <span class="overlay-msg">${ok?CORRECT_MSGS[Math.floor(Math.random()*CORRECT_MSGS.length)]:`It's the ${bird.name}`}</span>
      <button class="btn-next-overlay" onclick="advance()">Next &#8594;</button>
    </div>`;
  }

  const fullPool = CFG.completeBirds?.length ? CFG.completeBirds : pool;
  const optBirds = state.options.map(opt => fullPool.find(b=>b.name===opt) || pool.find(b=>b.name===opt));
  const showLatin = optBirds.every(b => b?.latin);
  const optionsHtml = state.options.map((opt, i) => {
    let cls='option';
    if(state.selected){if(opt===bird.name)cls+=' correct';else if(opt===state.selected)cls+=' wrong';else cls+=' dimmed';}
    const safe=opt.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const matchBird=optBirds[i];
    const localName = matchBird?.samoan || matchBird?.maori || '';
    const localLabel = localName ? `<span class="opt-local-name">${localName}</span>` : '';
    const latinLabel = showLatin && matchBird?.latin ? `<span class="opt-latin-small">${matchBird.latin}</span>` : '';
    return `<button class="${cls}" ${state.selected?'disabled':''} onclick="selectAnswer('${safe}',event)"><span class="opt-english">${opt}</span>${localLabel}${latinLabel}</button>`;
  }).join('');

  let fieldNote='';
  if(state.selected) {
    const ok=state.selected===bird.name;
    const noteText=bird.note||'<em style="color:#9b9890">Loading identification note...</em>';
    const wrongMsg=ok?'':`<div class="wrong-note"><p>&#128204; -2 points. This one will come back after a few species.</p></div>`;
    fieldNote=`
      <div class="field-note">
        <div class="fn-head">
          <div class="fn-species-name">${bird.name}</div>
          <div class="fn-species-latin">${bird.latin||''}</div>
        </div>
        <div class="fn-label">&#128269; HOW TO IDENTIFY</div>
        <p class="fn-main">${noteText}</p>
        ${bird.count?`<p class="fn-count">&#128202; ${bird.count.toLocaleString()} GBIF records in area</p>`:''}
        <p class="inat-credit" style="margin-top:6px">
          <a href="https://www.inaturalist.org/taxa/search?q=${encodeURIComponent(bird.name)}" target="_blank">Photo: iNaturalist</a> - CC licensed &nbsp;|&nbsp;
          <a href="https://www.gbif.org/species/search?q=${encodeURIComponent(bird.latin||bird.name)}" target="_blank">Data: GBIF</a>
        </p>
      </div>${wrongMsg}`;
    if(!bird.note && bird.wikiUrl) {
      fetchIDNote(bird.wikiUrl).then(text => {
        if(text && state.current?.name===bird.name) { bird.note=text; if(state.selected) render(); }
      });
    }
  }

  app.innerHTML = `
    <div>
      <div class="meta-row">
        <span class="q-label">${state.totalSeen} seen - ${state.totalCorrect} correct
          <span class="mode-pill ${modePill}">${modeLabel}</span>
        </span>
        <div class="badges">${speciesBadges(bird)}</div>
      </div>
      <div class="streak-row">
        <div class="streak-dots">${dots}</div>
        <span class="streak-label">&#128293; ${state.streak}/${STREAK_TARGET}</span>
      </div>
      <div class="img-box" id="imgBox" ontouchstart="_swipeX=event.touches[0].clientX" ontouchend="if(Math.abs(event.changedTouches[0].clientX-_swipeX)>40){event.changedTouches[0].clientX<_swipeX?nextPhoto():prevPhoto()}">${imgContent}${overlay}${carousel}</div>
      <p class="question-text">&#128269; What is this?</p>
      <div class="options">${optionsHtml}</div>
      ${fieldNote}
    </div>`;
}

let _spSortMode = 'count';
let _spHeader = '';

function renderSpeciesList(app, header, sortMode) {
  if (header) _spHeader = header;
  if (sortMode) _spSortMode = sortMode;
  const birds = CFG.completeBirds || CFG.hardBirds || CFG.easyBirds;

  let sorted;
  if (_spSortMode === 'taxonomy') {
    sorted = [...birds].sort((a, b) => {
      const ai = a.ancestorIds || [], bi = b.ancestorIds || [];
      for (const i of [1, 2, 3]) {
        const diff = (ai[i] || 0) - (bi[i] || 0);
        if (diff !== 0) return diff;
      }
      return (a.latin || a.name).localeCompare(b.latin || b.name);
    });
  } else {
    sorted = [...birds].sort((a, b) => (b.count || 0) - (a.count || 0));
  }

  const rows = sorted.map((bird, idx) => {
    const inatUrl=`https://www.inaturalist.org/taxa/search?q=${encodeURIComponent(bird.latin||bird.name)}`;
    const countBadge = bird.count ? `<span class="obs-count">${bird.count.toLocaleString()} records</span>` : '';
    const badges = speciesBadges(bird);
    const detailId = `spd-${idx}`;
    const familyLabel = _spSortMode === 'taxonomy' && bird.family ? `<span class="sp-family">${bird.family}</span>` : '';
    return `<div class="sp-item">
      <div class="sp-name-row">
        <span class="sp-name">${bird.name}</span>
        <span class="sp-latin">${bird.latin||''}</span>
        <button class="sp-chevron-btn" onclick="toggleSpDetail('${detailId}',this)" data-latin="${encodeURIComponent(bird.latin||bird.name)}" data-wiki="${encodeURIComponent(bird.wikiUrl||'')}" data-inat="${bird.inatId||''}" data-photo="${encodeURIComponent(bird.defaultPhoto||'')}" aria-label="Show details"><span class="sp-chevron-label">Info</span><span class="sp-chevron-arrow">&#8250;</span></button>
      </div>
      <div class="sp-meta-row">${countBadge}${familyLabel}<a href="${inatUrl}" target="_blank" style="font-size:0.7rem;color:#9b9890;">iNat &#8594;</a></div>
      ${badges?`<div class="sp-badges">${badges}</div>`:''}
      <div class="sp-detail" id="${detailId}"></div>
    </div>`;
  }).join('');

  const sortLabel = _spSortMode === 'taxonomy' ? 'taxonomic order' : 'observation count';
  const toggleLabel = _spSortMode === 'taxonomy' ? '&#128202; Sort by count' : '&#128218; Sort by taxonomy';

  app.innerHTML = _spHeader + `
    <div class="fade">
      <button class="btn-secondary" style="margin-bottom:12px" onclick="goIntro()">&#8592; Back</button>
      <div class="info-box" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <p style="margin:0">&#128203; <strong>${birds.length} species</strong> - sorted by ${sortLabel}.</p>
        <button class="btn-sort-toggle" onclick="renderSpeciesList(document.getElementById('app'),null,_spSortMode==='taxonomy'?'count':'taxonomy')">${toggleLabel}</button>
      </div>
      ${rows}
    </div>`;
}

async function toggleSpDetail(id, btn) {
  const panel = document.getElementById(id);
  if (!panel) return;
  const isOpen = panel.classList.contains('open');
  panel.classList.toggle('open', !isOpen);
  btn.classList.toggle('open', !isOpen);
  if (isOpen || panel.dataset.loaded) return;
  panel.dataset.loaded = '1';

  const latin = decodeURIComponent(btn.dataset.latin || '');
  const wikiUrl = decodeURIComponent(btn.dataset.wiki || '');
  const inatId = btn.dataset.inat ? parseInt(btn.dataset.inat) : null;
  const taxaPhoto = decodeURIComponent(btn.dataset.photo || '');
  panel.innerHTML = `<div class="sp-id-loading">Loading...</div>`;

  const [obsPhotos, noteText] = await Promise.all([
    fetchInatPhotosByTaxon(inatId, latin),
    wikiUrl ? fetchIDNote(wikiUrl) : Promise.resolve(null),
  ]);

  const seen = new Set(taxaPhoto ? [taxaPhoto] : []);
  const extra = obsPhotos.filter(u => !seen.has(u) && seen.add(u));
  const photoUrls = [...(taxaPhoto ? [taxaPhoto] : []), ...extra].slice(0, 5);
  if (photoUrls.length) panel._spPhotos = photoUrls;
  let carouselHtml = '';
  if (photoUrls.length) {
    const imgId = `spc-img-${id}`;
    const dotsHtml = photoUrls.length > 1
      ? `<div class="sp-dc-dots">${photoUrls.map((_,i)=>`<div class="sp-dc-dot${i===0?' active':''}" id="${imgId}-dot-${i}" onclick="spGoPhoto('${id}','${imgId}',${i})"></div>`).join('')}</div>`
      : '';
    const prevNext = photoUrls.length > 1
      ? `<button class="sp-dc-prev" onclick="spPrevPhoto('${id}','${imgId}')">&#8249;</button><button class="sp-dc-next" onclick="spNextPhoto('${id}','${imgId}')">&#8250;</button>`
      : '';
    carouselHtml = `<div class="sp-detail-carousel" ontouchstart="_swipeX=event.touches[0].clientX" ontouchend="if(Math.abs(event.changedTouches[0].clientX-_swipeX)>40){event.changedTouches[0].clientX<_swipeX?spNextPhoto('${id}','${imgId}'):spPrevPhoto('${id}','${imgId}')}">${prevNext}<img id="${imgId}" src="${photoUrls[0]}" alt="${latin}" onerror="this.parentElement.style.display='none'"/>${dotsHtml}</div>`;
  }

  const noteHtml = noteText
    ? `<div class="sp-id-label">&#128269; How to identify</div><p class="sp-id-text">${noteText}</p>`
    : `<div class="sp-id-label">&#128269; How to identify</div><p class="sp-id-loading">No identification notes available.</p>`;

  panel.innerHTML = carouselHtml + noteHtml;
}

async function fetchInatPhotosByTaxon(inatId, latin) {
  try {
    const param = inatId ? `taxon_id=${inatId}` : `taxon_name=${encodeURIComponent(latin)}`;
    const r = await fetch(`https://api.inaturalist.org/v1/observations?${param}&quality_grade=research&order_by=votes&per_page=10`);
    if (!r.ok) return [];
    const d = await r.json();
    const urls = [];
    const seen = new Set();
    for (const obs of (d.results||[])) {
      const url = obs.photos?.[0]?.url?.replace('/square.','/medium.');
      if (url && !seen.has(url)) { seen.add(url); urls.push(url); if(urls.length>=5) break; }
    }
    return urls;
  } catch { return []; }
}

function spGoPhoto(detailId, imgId, idx) {
  const img = document.getElementById(imgId);
  const panel = document.getElementById(detailId);
  if (!img || !panel?._spPhotos) return;
  img.src = panel._spPhotos[idx];
  panel.querySelectorAll('.sp-dc-dot').forEach((d,i) => d.classList.toggle('active', i===idx));
  img.dataset.idx = idx;
}
function spPrevPhoto(detailId, imgId) {
  const img = document.getElementById(imgId);
  const panel = document.getElementById(detailId);
  const cur = parseInt(img?.dataset.idx||'0');
  if (panel?._spPhotos) spGoPhoto(detailId, imgId, (cur - 1 + panel._spPhotos.length) % panel._spPhotos.length);
}
function spNextPhoto(detailId, imgId) {
  const img = document.getElementById(imgId);
  const panel = document.getElementById(detailId);
  const cur = parseInt(img?.dataset.idx||'0');
  if (panel?._spPhotos) spGoPhoto(detailId, imgId, (cur + 1) % panel._spPhotos.length);
}

function renderAbout(app, header) {
  app.innerHTML = header + `
    <div class="fade">
      <button class="btn-secondary" style="margin-bottom:16px" onclick="goIntro()">&#8592; Back</button>

      <div class="field-note" style="margin-bottom:12px">
        <div class="fn-label">WHAT IS THIS?</div>
        <p class="fn-main">WhatDat? is a photo identification quiz for any organism — birds, plants, insects, fungi, or whatever you choose. Pick a location and a taxonomic group, and get 10 points to win. Correct answers score +1, wrong answers cost -2, and tricky species keep coming back until you nail them.</p>
      </div>

      <div class="field-note" style="margin-bottom:12px">
        <div class="fn-label">THE DATA</div>
        <p class="fn-main"><strong>Species lists</strong> come from GBIF occurrence data, filtered to the last 25 years and ordered by observation count. Photos come from iNaturalist research-grade observations sorted by community faves. Field notes are pulled from Wikipedia — specifically the identification or description section.</p>
        <p class="fn-main" style="margin-top:8px"><strong>Taxon filter:</strong> when you browse by group (e.g. Aves, Coleoptera, Poaceae), the GBIF query uses that taxon key directly — so only species within that group appear in the quiz.</p>
        <p class="fn-main" style="margin-top:8px"><strong>Species list mode:</strong> paste species names from But Is It Threatened or any other source. Each name is resolved via GBIF and iNaturalist to get taxonomy and photos.</p>
      </div>

      <div class="field-note" style="margin-bottom:12px">
        <div class="fn-label">WRONG ANSWERS</div>
        <p class="fn-main">Distractor options are chosen by taxonomic relatedness — the closest relative in the full species list is always included. Within a family or genus, distractors will be very closely related, making it genuinely challenging.</p>
      </div>

      <div class="field-note" style="margin-bottom:12px">
        <div class="fn-label">BUILT WITH</div>
        <p class="fn-main">
          <a href="https://www.gbif.org" target="_blank" style="color:#2a7a58">GBIF</a> - species lists, occurrence data, and taxonomy<br>
          <a href="https://www.inaturalist.org" target="_blank" style="color:#2a7a58">iNaturalist</a> - photos and common names (CC licensed)<br>
          <a href="https://en.wikipedia.org" target="_blank" style="color:#2a7a58">Wikipedia</a> - identification notes<br>
          <a href="https://leafletjs.com" target="_blank" style="color:#2a7a58">Leaflet</a> + OpenStreetMap - location picker<br>
          No backend, no database, no login.
        </p>
      </div>

      <button class="btn-back" onclick="window.location.href='${CFG.backUrl}'">&#8592; Back</button>
    </div>`;
}

// ── Actions ───────────────────────────────────────────────────────────────
function adjustImgPosition(img) {
  const isPortrait = img.naturalWidth < img.naturalHeight;
  if(isPortrait) {
    const fullH = img.offsetWidth/(img.naturalWidth/img.naturalHeight);
    img.style.height=(fullH*0.7)+'px'; img.style.objectPosition='center 15%';
  } else {
    img.style.height='auto'; img.style.maxHeight='65vw'; img.style.objectPosition='center center';
  }
}
function imgFailed() {
  const box=document.getElementById('imgBox');
  if(box) box.innerHTML=`<div class="img-placeholder"><div class="icon">&#128247;</div><span>No photo available</span></div>`;
}
let _photoSliding = false;
function slidePhoto(newIdx, dir) {
  if (_photoSliding || state.photoUrls.length <= 1) return;
  const box = document.getElementById('imgBox');
  const curImg = box?.querySelector('img:not(.slide-in)');
  if (!box || !curImg) { setState({photoIdx:newIdx, imgUrl:state.photoUrls[newIdx]}); return; }

  _photoSliding = true;
  box.style.height = box.offsetHeight + 'px';

  const newImg = document.createElement('img');
  newImg.src = state.photoUrls[newIdx];
  newImg.className = 'slide-in';
  newImg.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;object-position:center top;transform:translateX(${dir>0?'100%':'-100%'});`;
  curImg.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;object-position:center top;`;
  const overlayEl = box.querySelector('.img-overlay');
  if (overlayEl) box.insertBefore(newImg, overlayEl);
  else box.appendChild(newImg);
  newImg.getBoundingClientRect();
  newImg.style.transition = curImg.style.transition = 'transform 0.28s ease';
  newImg.style.transform = 'translateX(0)';
  curImg.style.transform = `translateX(${dir>0?'-100%':'100%'})`;

  setTimeout(() => {
    curImg.remove();
    newImg.style.cssText = '';
    newImg.className = '';
    box.style.height = '';
    state.photoIdx = newIdx;
    state.imgUrl = state.photoUrls[newIdx];
    box.querySelectorAll('.carousel-dot').forEach((d,i) => d.classList.toggle('active', i===newIdx));
    _photoSliding = false;
  }, 300);
}
function prevPhoto() { slidePhoto((state.photoIdx-1+state.photoUrls.length)%state.photoUrls.length, -1); }
function nextPhoto() { slidePhoto((state.photoIdx+1)%state.photoUrls.length, 1); }
function goPhoto(i)  { slidePhoto(i, i>=state.photoIdx?1:-1); }
function setMode(m)  { setState({mode:m}); }
function goIntro()   { setState({phase:'intro'}); }

function buildQueue(pool) {
  if (state.mode !== 'complete') return shuffle([...pool]);
  const sorted = [...pool].sort((a,b) => (b.count||0)-(a.count||0));
  const queue = [];
  for (let i = 0; i < sorted.length; i += 10) {
    queue.push(...shuffle(sorted.slice(i, i+10)));
  }
  return queue;
}

function startQuiz() {
  const pool=getPool();
  const queue=buildQueue(pool);
  const first=queue.shift();
  setState({phase:'quiz',queue,wrongBin:[],current:first,streak:0,streakHistory:[],totalSeen:0,totalCorrect:0,selected:null,imgUrl:null,imgLoading:true,photoUrls:[],photoIdx:0,options:getOptions(first,pool)});
  fetchImage(first, state.mode).then(url => {
    const all=(inatPhotoCache[first.latin||first.name]||[]).slice(0,5);
    const photoUrls=url?[url,...all.filter(u=>u!==url)].slice(0,5):all;
    if (!url && !photoUrls.length) { _advance(); return; }
    setState({imgUrl:url,imgLoading:false,photoUrls,photoIdx:0});
  });
}

function selectAnswer(opt, event) {
  if(state.selected) return;
  const bird=state.current;
  const correct=opt===bird.name;
  const newHistory=[...state.streakHistory,correct];
  if(newHistory.length>STREAK_TARGET) newHistory.shift();
  const newStreak=correct?state.streak+1:Math.max(0,state.streak-2);
  setState({selected:opt,streak:newStreak,streakHistory:newHistory,
    totalSeen:state.totalSeen+1,totalCorrect:state.totalCorrect+(correct?1:0),
    wrongBin:correct?state.wrongBin:[...state.wrongBin,{bird,wrongAt:state.totalSeen}]});
  if(correct) {
    if(event) burstStars(event.clientX,event.clientY);
    setTimeout(()=>showEncouragement(STREAK_MSGS[newStreak]||CORRECT_MSGS[Math.floor(Math.random()*CORRECT_MSGS.length)]),150);
  }
  if(newStreak>=STREAK_TARGET) setTimeout(()=>setState({phase:'celebrate'}),2000);
}

function advance() {
  const box = document.getElementById('imgBox');
  if (box) { box.style.opacity='0'; box.style.transition='opacity 0.18s ease'; }
  setTimeout(_advance, box ? 180 : 0);
}
function _advance() {
  const pool=getPool();
  let queue=[...state.queue], wrongBin=[...state.wrongBin];
  if(queue.length===0&&wrongBin.length===0){setState({phase:'result'});return;}

  const WRONG_GAP = 3;
  const eligible = wrongBin.filter(w => state.totalSeen - w.wrongAt >= WRONG_GAP);
  const insertWrong = eligible.length > 0 && (queue.length === 0 || state.totalSeen % 3 === 0);

  let next;
  if(insertWrong) {
    const pick = eligible[Math.floor(Math.random()*eligible.length)];
    next = pick.bird;
    wrongBin = wrongBin.filter(w => w !== pick);
  } else {
    next=queue.shift();
    if(eligible.length>0&&Math.random()<0.4) {
      const pick = eligible[Math.floor(Math.random()*eligible.length)];
      wrongBin = wrongBin.filter(w => w !== pick);
      queue.splice(Math.min(Math.floor(Math.random()*4)+1,queue.length),0,pick.bird);
    }
  }
  setState({current:next,queue,wrongBin,selected:null,imgUrl:null,imgLoading:true,photoUrls:[],photoIdx:0,options:getOptions(next,pool)});
  fetchImage(next, state.mode).then(url => {
    const all=(inatPhotoCache[next.latin||next.name]||[]).slice(0,5);
    const photoUrls=url?[url,...all.filter(u=>u!==url)].slice(0,5):all;
    if (!url && !photoUrls.length) { _advance(); return; }
    setState({imgUrl:url,imgLoading:false,photoUrls,photoIdx:0});
  });
  if (next.wikiUrl && !next.note) fetchIDNote(next.wikiUrl).catch(() => {});
  const prefetchBird = queue[0] || wrongBin[0]?.bird;
  if (prefetchBird) {
    fetchInatImage(prefetchBird).catch(() => {});
    if (prefetchBird.wikiUrl && !prefetchBird.note) fetchIDNote(prefetchBird.wikiUrl).catch(() => {});
  }
}

// ── Share ──────────────────────────────────────────────────────────────────
function copyShareUrl(btn) {
  const url = CFG.shareUrl;
  if (!url) return;
  navigator.clipboard.writeText(url).then(() => {
    const orig = btn.innerHTML;
    btn.innerHTML = '&#10003; Link copied!';
    btn.disabled = true;
    setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 2500);
  }).catch(() => {
    // Fallback for browsers without clipboard API
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    btn.innerHTML = '&#10003; Link copied!';
    btn.disabled = true;
    setTimeout(() => { btn.innerHTML = '&#128279; Share this quiz'; btn.disabled = false; }, 2500);
  });
}

// ── Init ──────────────────────────────────────────────────────────────────
function initEngine(config) {
  CFG = config;
  CFG.indigenousField = config.indigenousField || null;
  CFG.easyUseWiki = config.easyUseWiki || false;
  if (!CFG.easyBirds) CFG.easyBirds = [];
  state.mode = 'easy';

  const footer = document.createElement('div');
  footer.className = 'footer-bar';
  footer.innerHTML = `<a href="${CFG.backUrl}" style="color:#2a7a58;font-weight:700;">WhatDat?</a> - by <a href="https://www.rutherfordecology.co.nz/" target="_blank" style="color:#9b9890;">Rutherford Ecology</a> <span style="opacity:0.4;font-size:0.75em">${APP_VERSION}</span>`;
  document.body.appendChild(footer);

  render();
}
