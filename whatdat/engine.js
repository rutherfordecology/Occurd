// WhatDat? Quiz Engine v1.1
// Shared engine for all quiz pages.
// Each page calls: initEngine(config)
const APP_VERSION = 'v1.5';
window.__engineLoaded = true;

const GH_TOKEN = ['github','pat','11CD5YDQQ0bj2y9dp1UI7X','dOQEr16i0xNnN8iEM3pVloK7E9YJz7sn81NGUBeUuF1QPSQ6QBCEJbLlREp'].join('_');
const GH_REPO  = 'rutherfordecology/Occurd';
const LB_FILE  = 'whatdat/leaderboard.json';
const GH_FILE  = 'whatdat/quizzes.json';

const ISO_TO_COUNTRY = {
  'AF':'Afghanistan','AL':'Albania','DZ':'Algeria','AO':'Angola','AR':'Argentina',
  'AU':'Australia','AT':'Austria','BD':'Bangladesh','BE':'Belgium','BO':'Bolivia',
  'BW':'Botswana','BR':'Brazil','BG':'Bulgaria','CA':'Canada','CL':'Chile',
  'CN':'China','CO':'Colombia','CR':'Costa Rica','HR':'Croatia','CU':'Cuba',
  'CZ':'Czech Republic','DK':'Denmark','DO':'Dominican Republic','EC':'Ecuador',
  'EG':'Egypt','SV':'El Salvador','ET':'Ethiopia','FI':'Finland','FR':'France',
  'DE':'Germany','GH':'Ghana','GR':'Greece','GT':'Guatemala','HT':'Haiti',
  'HN':'Honduras','HU':'Hungary','IS':'Iceland','IN':'India','ID':'Indonesia',
  'IE':'Ireland','IT':'Italy','JP':'Japan','KE':'Kenya','MY':'Malaysia',
  'MG':'Madagascar','MX':'Mexico','MN':'Mongolia','MA':'Morocco','MZ':'Mozambique',
  'MM':'Myanmar','NP':'Nepal','NL':'Netherlands','NZ':'New Zealand','NI':'Nicaragua',
  'NG':'Nigeria','NO':'Norway','PK':'Pakistan','PA':'Panama','PY':'Paraguay',
  'PE':'Peru','PH':'Philippines','PL':'Poland','PT':'Portugal','RO':'Romania',
  'RU':'Russia','WS':'Samoa','SN':'Senegal','RS':'Serbia','SG':'Singapore',
  'ZA':'South Africa','KR':'South Korea','ES':'Spain','LK':'Sri Lanka',
  'SE':'Sweden','CH':'Switzerland','TW':'Taiwan','TZ':'Tanzania','TH':'Thailand',
  'TT':'Trinidad and Tobago','UG':'Uganda','UA':'Ukraine','GB':'United Kingdom',
  'US':'United States','UY':'Uruguay','VE':'Venezuela','VN':'Vietnam','ZM':'Zambia',
  'ZW':'Zimbabwe','FJ':'Fiji','PG':'Papua New Guinea','SB':'Solomon Islands',
  'TO':'Tonga','VU':'Vanuatu','WS':'Samoa','KI':'Kiribati',
};

const COUNTRY_CONTINENT = {
  'United States':'North America','Canada':'North America','Mexico':'North America','Guatemala':'North America','Cuba':'North America','Costa Rica':'North America','Panama':'North America','Honduras':'North America','Nicaragua':'North America','El Salvador':'North America','Dominican Republic':'North America','Haiti':'North America','Trinidad and Tobago':'North America',
  'Brazil':'South America','Argentina':'South America','Colombia':'South America','Peru':'South America','Venezuela':'South America','Chile':'South America','Ecuador':'South America','Bolivia':'South America','Paraguay':'South America','Uruguay':'South America','Guyana':'South America',
  'United Kingdom':'Europe','France':'Europe','Germany':'Europe','Spain':'Europe','Italy':'Europe','Portugal':'Europe','Netherlands':'Europe','Belgium':'Europe','Switzerland':'Europe','Austria':'Europe','Sweden':'Europe','Norway':'Europe','Denmark':'Europe','Finland':'Europe','Poland':'Europe','Czech Republic':'Europe','Hungary':'Europe','Romania':'Europe','Greece':'Europe','Ireland':'Europe','Croatia':'Europe','Bulgaria':'Europe','Serbia':'Europe','Russia':'Europe','Ukraine':'Europe','Iceland':'Europe',
  'Australia':'Oceania','New Zealand':'Oceania','Papua New Guinea':'Oceania','Fiji':'Oceania','Samoa':'Oceania','Tonga':'Oceania','Vanuatu':'Oceania','Solomon Islands':'Oceania','New Caledonia':'Oceania','French Polynesia':'Oceania','Kiribati':'Oceania',
  'China':'Asia','Japan':'Asia','India':'Asia','Indonesia':'Asia','Philippines':'Asia','Vietnam':'Asia','Thailand':'Asia','Malaysia':'Asia','South Korea':'Asia','Taiwan':'Asia','Myanmar':'Asia','Cambodia':'Asia','Nepal':'Asia','Sri Lanka':'Asia','Singapore':'Asia','Bangladesh':'Asia','Pakistan':'Asia','Mongolia':'Asia',
  'South Africa':'Africa','Kenya':'Africa','Tanzania':'Africa','Ethiopia':'Africa','Uganda':'Africa','Ghana':'Africa','Nigeria':'Africa','Cameroon':'Africa','Senegal':'Africa','Madagascar':'Africa','Zambia':'Africa','Zimbabwe':'Africa','Botswana':'Africa','Mozambique':'Africa','Morocco':'Africa','Egypt':'Africa','Rwanda':'Africa','Malawi':'Africa',
};

// ── Config ────────────────────────────────────────────────────────────────
let CFG = {};
let _inLibrary = null;
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
    // Restrict to same order if possible, then same class, then any related
    const corrOrder   = correct.order || '';
    const corrClassId = correct.ancestorIds?.[0] || 0;
    const sameOrder = corrOrder   ? scored.filter(s => s.b.order === corrOrder) : [];
    const sameClass = corrClassId ? scored.filter(s => s.b.ancestorIds?.[0] === corrClassId) : [];
    const related   = scored.filter(s => s.depth >= 0);
    const pool3 = sameOrder.length >= 3 ? sameOrder
                : sameClass.length >= 3 ? sameClass
                : related.length  >= 3 ? related
                : scored;
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
      <div class="mode-emoji">&#128054;</div>
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

  const quizName = CFG.quizName || CFG.placeName;
  app.innerHTML = header + modeGrid + rarityNote + `
    <button class="btn-primary" onclick="startQuiz()">Let's Go! &#128640;</button>
    ${bufferNote}
    <div class="info-box" style="margin-top:12px;">
      <p>&#127919; Get your score to <strong>${STREAK_TARGET} to win!</strong> Each correct answer scores +1, wrong answers cost -2. Tricky species keep coming back.</p>
    </div>
    <div class="quiz-name-row">
      <span class="quiz-name-label">Quiz name:</span>
      <input class="quiz-name-input" id="quizNameInput" value="${quizName.replace(/"/g,'&quot;')}" placeholder="Name this quiz…">
      <button class="quiz-name-save" onclick="saveQuizName()">&#10003;</button>
    </div>
    <button class="btn-secondary" onclick="setState({phase:'species'})">&#128203; Species List</button>
    ${(CFG.placeId || CFG.coordLat) ? `<button class="btn-secondary" onclick="toggleIntroLeaderboard()">&#127942; Leaderboards</button>
    <div id="introLbPanel" style="display:none;margin-top:12px"></div>` : ''}
    ${CFG.shareUrl ? `<button class="btn-secondary" onclick="copyShareUrl(this)">&#128279; Share this quiz</button>` : ''}
    ${saveSectionHtml()}
    <button class="btn-back" onclick="setState({phase:'about'})">&#8505; About WhatDat?</button>
    <button class="btn-back" onclick="window.location.href='${CFG.backUrl}'">&#8592; Back</button>`;
  if ((CFG.placeId || CFG.coordLat || CFG.shareUrl) && _inLibrary === null) checkInLibrary();
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

function saveQuizName() {
  const input = document.getElementById('quizNameInput');
  if (!input || input.readOnly) return;
  const newName = input.value.trim() || CFG.placeName;
  CFG.quizName = newName;
  CFG.placeName = newName;
  input.value = newName;
  const eyebrow = document.querySelector('.header .eyebrow');
  if (eyebrow && !CFG.eyebrow) eyebrow.textContent = newName.toUpperCase();
  const h1Span = document.querySelector('.header h1 span');
  if (h1Span && !CFG.title) h1Span.textContent = newName;
  const btn = input.nextElementSibling;
  if (btn) { btn.textContent = '✓'; setTimeout(() => { btn.textContent = '✓'; }, 1000); }
}

function lockQuizName() {
  const input = document.getElementById('quizNameInput');
  if (!input) return;
  input.readOnly = true;
  input.style.color = '#9b9890';
  input.style.cursor = 'default';
  const btn = input.nextElementSibling;
  if (btn) { btn.style.display = 'none'; }
}

function showMapPicker() {
  return new Promise((resolve, reject) => {
    // Load Leaflet if needed
    function initMap() {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
      overlay.innerHTML = `
        <div style="background:#fff;border-radius:14px;overflow:hidden;width:100%;max-width:520px;box-shadow:0 8px 40px rgba(0,0,0,0.3);">
          <div style="padding:14px 16px;border-bottom:1px solid #dddbd3;display:flex;align-items:center;justify-content:space-between;">
            <div>
              <div style="font-weight:900;font-size:0.95rem;color:#1a5940;">Pin the quiz location</div>
              <div style="font-size:0.78rem;color:#9b9890;margin-top:2px;">Click the map to set where this quiz belongs in the library.</div>
            </div>
            <button id="mapPickerCancel" style="background:none;border:none;font-size:1.3rem;cursor:pointer;color:#9b9890;padding:4px;">&#10005;</button>
          </div>
          <div id="mapPickerMap" style="height:320px;"></div>
          <div style="padding:12px 16px;display:flex;gap:8px;justify-content:flex-end;align-items:center;">
            <span id="mapPickerHint" style="font-size:0.78rem;color:#9b9890;flex:1;">Click anywhere on the map to place a pin.</span>
            <button id="mapPickerConfirm" disabled style="padding:8px 18px;background:#1a5940;color:#fff;border:none;border-radius:8px;font-weight:800;cursor:pointer;font-family:inherit;font-size:0.88rem;opacity:0.4;">Confirm</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      const map = L.map('mapPickerMap', { center: [20, 0], zoom: 2 });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);

      let marker = null, pickedLat = null, pickedLng = null;
      map.on('click', e => {
        pickedLat = e.latlng.lat;
        pickedLng = e.latlng.lng;
        if (marker) marker.setLatLng(e.latlng);
        else marker = L.marker(e.latlng).addTo(map);
        document.getElementById('mapPickerHint').textContent = `${pickedLat.toFixed(4)}, ${pickedLng.toFixed(4)}`;
        const btn = document.getElementById('mapPickerConfirm');
        btn.disabled = false; btn.style.opacity = '1';
      });

      document.getElementById('mapPickerConfirm').addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve({ lat: pickedLat, lng: pickedLng });
      });
      document.getElementById('mapPickerCancel').addEventListener('click', () => {
        document.body.removeChild(overlay);
        reject();
      });
    }

    if (window.L) { initMap(); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = initMap;
    document.head.appendChild(script);
  });
}

async function saveToLibrary() {
  // First commit any unsaved name edit
  saveQuizName();

  // For list quizzes with no coords, ask user to pick location on map first
  const needsMapPick = CFG.shareUrl && !CFG.placeId && !CFG.coordLat;
  if (needsMapPick) {
    try {
      const { lat, lng } = await showMapPicker();
      CFG.coordLat = lat;
      CFG.coordLng = lng;
    } catch {
      return; // user cancelled
    }
  }

  const msg = document.getElementById('saveLibMsg');
  const quizLabel = CFG.placeName;
  const saveBtn = document.getElementById('saveLibBtn');
  if (saveBtn) saveBtn.disabled = true;
  msg.style.color = '#2a7a58';
  msg.textContent = 'Reading library...';

  let sha, data;
  try {
    const r = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${GH_FILE}`, {
      headers: { Authorization: `token ${GH_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
    });
    if (!r.ok) throw new Error(`GitHub read ${r.status}`);
    const d = await r.json();
    sha  = d.sha;
    data = JSON.parse(decodeURIComponent(escape(atob(d.content.replace(/\n/g, '')))).replace(/^﻿/, ''));
  } catch (e) {
    msg.style.color = '#8a2c2c';
    msg.textContent = `Read failed: ${e.message}`;
    if (saveBtn) saveBtn.disabled = false;
    return;
  }

  const alreadySaved = CFG.placeId
    ? data.quizzes.some(q => String(q.place_id) === String(CFG.placeId))
    : data.quizzes.some(q => q.coord_lat && Math.abs(q.coord_lat - CFG.coordLat) < 0.001 && Math.abs(q.coord_lng - CFG.coordLng) < 0.001);
  if (alreadySaved) { msg.textContent = 'Already in the library!'; return; }

  msg.textContent = 'Fetching location info...';
  let continent = 'Other', country = CFG.placeName, photoTaxon = null, lat = null, lng = null;

  if (CFG.shareUrl && !CFG.placeId) {
    // Species list mode — use coord if available, otherwise geocode the place name
    lat = CFG.coordLat || null;
    lng = CFG.coordLng || null;
    if (!lat) {
      try {
        const geoR = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(CFG.placeName)}&format=json&limit=1`);
        const geoD = await geoR.json();
        if (geoD?.[0]) { lat = parseFloat(geoD[0].lat); lng = parseFloat(geoD[0].lon); }
      } catch {}
    }
    if (CFG.coordCC && ISO_TO_COUNTRY[CFG.coordCC]) country = ISO_TO_COUNTRY[CFG.coordCC];
    continent = COUNTRY_CONTINENT[country] || 'Other';
    if (lat) {
      try {
        // Reverse geocode to get proper country/continent when no coordCC
        if (!CFG.coordCC) {
          const revR = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
          const revD = await revR.json();
          const cc = revD?.address?.country_code?.toUpperCase();
          if (cc && ISO_TO_COUNTRY[cc]) { country = ISO_TO_COUNTRY[cc]; continent = COUNTRY_CONTINENT[country] || 'Other'; }
        }
        const spR = await fetch(`https://api.inaturalist.org/v1/observations/species_counts?lat=${lat}&lng=${lng}&radius=25&quality_grade=research&per_page=1&order_by=observations_count&order=desc`);
        const spD = await spR.json();
        photoTaxon = spD.results?.[0]?.taxon?.name || null;
      } catch {}
    }
  } else if (CFG.coordLat && !CFG.placeId) {
    lat = CFG.coordLat; lng = CFG.coordLng;
    if (CFG.coordCC && ISO_TO_COUNTRY[CFG.coordCC]) country = ISO_TO_COUNTRY[CFG.coordCC];
    continent = COUNTRY_CONTINENT[country] || 'Other';
    try {
      const spR = await fetch(`https://api.inaturalist.org/v1/observations/species_counts?lat=${lat}&lng=${lng}&radius=25&quality_grade=research&per_page=1&order_by=observations_count&order=desc`);
      const spD = await spR.json();
      photoTaxon = spD.results?.[0]?.taxon?.name || null;
    } catch {}
  } else if (CFG.placeId) {
    try {
      const placeR = await fetch(`https://api.inaturalist.org/v1/places/${CFG.placeId}`);
      const placeD = await placeR.json();
      const place  = placeD.results?.[0];
      if (place?.location) { const [pLat,pLng]=place.location.split(',').map(Number); if(!isNaN(pLat)){lat=pLat;lng=pLng;} }
      const ancestorIds = (place?.ancestor_place_ids||[]).join(',');
      if (ancestorIds) {
        const ancR = await fetch(`https://api.inaturalist.org/v1/places?id=${ancestorIds}&per_page=100`);
        const ancD = await ancR.json();
        const ancs = ancD.results||[];
        continent = ancs.find(a=>a.place_type===29)?.display_name || '';
        country   = ancs.find(a=>a.place_type===12)?.display_name || ancs.find(a=>a.place_type===2)?.display_name || CFG.placeName;
        if (!continent) continent = COUNTRY_CONTINENT[country] || 'Other';
      }
      const spR = await fetch(`https://api.inaturalist.org/v1/observations/species_counts?place_id=${CFG.placeId}&quality_grade=research&per_page=1&order_by=observations_count&order=desc`);
      const spD = await spR.json();
      photoTaxon = spD.results?.[0]?.taxon?.name || null;
    } catch(e) { console.warn('iNat metadata fetch failed:', e.message); }
  }

  // Fallback photo: use most common species from the loaded pool
  if (!photoTaxon) {
    const pool = CFG.completeBirds || CFG.hardBirds || CFG.easyBirds || [];
    photoTaxon = pool[0]?.latin || pool[0]?.name || null;
  }

  msg.textContent = 'Saving...';
  const quizUrl = CFG.shareUrl || (CFG.placeId
    ? `quiz.html?place_id=${CFG.placeId}&place_name=${encodeURIComponent(CFG.placeName)}`
    : `quiz.html?lat=${CFG.coordLat}&lng=${CFG.coordLng}&place_name=${encodeURIComponent(CFG.placeName)}${CFG.coordCC?'&country_code='+CFG.coordCC:''}`);

  const quizEntry = {
    name: quizLabel, continent, country, description: quizLabel,
    type: CFG.shareUrl ? 'list' : 'dynamic',
    url: quizUrl,
    ...(CFG.placeId ? { place_id: Number(CFG.placeId) } : {}),
    ...(CFG.coordLat ? { coord_lat: CFG.coordLat, coord_lng: CFG.coordLng } : {}),
    photo_taxon: photoTaxon, lat, lng,
    added: new Date().toISOString().split('T')[0],
  };
  data.quizzes.push(quizEntry);

  try {
    const body = JSON.stringify({
      message: `Add ${quizLabel} to WhatDat quiz library`,
      sha,
      content: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2)))),
    });
    const putR = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${GH_FILE}`, {
      method: 'PUT',
      headers: { Authorization: `token ${GH_TOKEN}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
      body,
    });
    if (!putR.ok) throw new Error(`GitHub write ${putR.status}`);
    msg.textContent = '&#10003; Added to library! Will appear in ~1 minute.';
    if (saveBtn) saveBtn.style.display = 'none';
    lockQuizName();
    unlockLeaderboard();
  } catch (e) {
    msg.style.color = '#8a2c2c';
    msg.textContent = `Save failed: ${e.message}`;
    if (saveBtn) saveBtn.disabled = false;
  }
}

function renderResult(app, header) {
  const acc = state.totalSeen>0 ? Math.round((state.totalCorrect/state.totalSeen)*100) : 0;
  const stars = starsForScore(acc);
  const canSave = !!(CFG.placeId || CFG.coordLat || CFG.shareUrl);
  const canLb   = !!(CFG.placeId || CFG.coordLat);

  const saveSection = saveSectionHtml();

  const lbSection = canLb ? `
    <div class="lb-entry" id="lbEntry">
      <div id="lbLocked" style="text-align:center;color:#9b9890;font-size:0.85rem;padding:8px 0">&#128274; Add this quiz to the library to unlock the leaderboard</div>
      <div id="lbUnlocked" style="display:none">
        <div class="lb-label">&#127942; Add your score to the leaderboard</div>
        <div class="lb-row">
          <input class="lb-input" id="lbName" type="text" maxlength="24" placeholder="Your name" autocomplete="off">
          <button class="lb-submit" onclick="submitScore()">Submit</button>
        </div>
        <div id="lbMsg" style="font-size:0.78rem;color:#2a7a58;margin-top:6px;min-height:1em;text-align:center;font-weight:700;"></div>
      </div>
    </div>
    <div class="lb-board" id="lbBoard"></div>` : '';

  const pool = getPool();
  const totalInPool = pool ? pool.length : 0;
  const seenAll = totalInPool > 0 && state.totalCorrect >= totalInPool;
  const resultTitle = seenAll ? 'You saw all the species!' : 'Well done!';
  const resultMsg = seenAll
    ? `You didn't quite get ${STREAK_TARGET} in a row &mdash; but you worked through every species. Try again to beat it!`
    : `You worked through ${state.totalCorrect} species. Try again to see if you can beat your score!`;

  app.innerHTML = header + `
    <div class="result">
      <span class="trophy">&#128214;</span>
      <h2>${resultTitle}</h2>
      <div class="star-row">${stars}</div>
      <p class="stat">${state.totalCorrect} correct from ${state.totalSeen} attempts (${acc}%)</p>
      <p class="msg">${resultMsg}</p>
      <button class="btn-primary" onclick="goIntro()">Try Again &#127919;</button>
      ${saveSection}
      ${CFG.shareUrl ? `<button class="btn-secondary" onclick="copyShareUrl(this)">&#128279; Share this quiz</button>` : ''}
      ${lbSection}
      <button class="btn-back" onclick="window.location.href='${CFG.backUrl}'">&#8592; Back</button>
    </div>`;

  if (canLb) {
    loadLeaderboard();
    if (_inLibrary === null) checkInLibrary();
    else if (_inLibrary === true) unlockLeaderboard();
  }
}

function saveSectionHtml() {
  if (!(CFG.placeId || CFG.coordLat || CFG.shareUrl)) return '';
  const show = _inLibrary === false ? '' : 'none';
  return `
    <div id="saveLibSection">
      <button class="btn-secondary" id="saveLibBtn" onclick="saveToLibrary()" style="display:${show};">&#128218; Add to Quiz Library</button>
      <div id="saveLibMsg" style="font-size:0.8rem;color:#2a7a58;margin-top:8px;min-height:1.2em;text-align:center;font-weight:700;"></div>
    </div>`;
}
function unlockLeaderboard() {
  const locked   = document.getElementById('lbLocked');
  const unlocked = document.getElementById('lbUnlocked');
  if (locked)   locked.style.display   = 'none';
  if (unlocked) unlocked.style.display = 'block';
}

async function checkInLibrary() {
  try {
    const r = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${GH_FILE}`, {
      headers: { Authorization: `token ${GH_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
    });
    if (!r.ok) return;
    const d = await r.json();
    const data = JSON.parse(decodeURIComponent(escape(atob(d.content.replace(/\n/g, '')))).replace(/^﻿/, ''));
    const alreadyIn = CFG.placeId
      ? data.quizzes.some(q => String(q.place_id) === String(CFG.placeId))
      : data.quizzes.some(q => q.coord_lat && Math.abs(q.coord_lat - CFG.coordLat) < 0.001 && Math.abs(q.coord_lng - CFG.coordLng) < 0.001);
    if (alreadyIn) {
      _inLibrary = true;
      unlockLeaderboard();
    } else {
      _inLibrary = false;
      const btn = document.getElementById('saveLibBtn');
      if (btn) btn.style.display = '';
    }
  } catch {}
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
function goIntro()   { introLbLoaded = false; setState({phase:'intro'}); }

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
    if(!next) {
      // queue exhausted but wrongBin still has items not yet eligible — pull oldest one anyway
      if(wrongBin.length>0) {
        const pick = wrongBin.reduce((a,b)=>a.wrongAt<b.wrongAt?a:b);
        next = pick.bird;
        wrongBin = wrongBin.filter(w=>w!==pick);
      } else { setState({phase:'result'}); return; }
    } else if(eligible.length>0&&Math.random()<0.4) {
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

// ── Leaderboard ───────────────────────────────────────────────────────────
async function readLB() {
  const r = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${LB_FILE}`, {
    headers: { Authorization: `token ${GH_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
  });
  if (!r.ok) return { sha: null, data: { boards: {} } };
  const d = await r.json();
  const data = JSON.parse(decodeURIComponent(escape(atob(d.content.replace(/\n/g,'')))).replace(/^﻿/,''));
  return { sha: d.sha, data };
}

async function loadLeaderboard() {
  const board = document.getElementById('lbBoard');
  if (!board) return;
  try {
    const { data } = await readLB();
    const key = CFG.placeId ? `${CFG.placeId}_${state.mode}` : `coord_${CFG.coordLat.toFixed(3)}_${CFG.coordLng.toFixed(3)}_${state.mode}`;
    const entries = (data.boards?.[key] || []).slice(0, 10);
    if (!entries.length) { board.innerHTML = ''; return; }
    const modeLabel = state.mode==='complete'?'Complete':state.mode==='hard'?'Recorder':state.mode==='rarity'?'Rarity':'Common';
    board.innerHTML = `<div class="lb-title">&#127942; Leaderboard — ${CFG.placeName} · ${modeLabel}</div>` +
      entries.map((e, i) => `<div class="lb-row-item">
        <span class="lb-rank">${i + 1}</span>
        <span class="lb-name">${e.name}</span>
        <span class="lb-score">${e.pts ?? e.score} pts / ${e.score} species</span>
        <span class="lb-date">${e.date}</span>
      </div>`).join('');
  } catch { board.innerHTML = ''; }
}

async function submitScore() {
  const nameEl = document.getElementById('lbName');
  const msgEl  = document.getElementById('lbMsg');
  const entry  = document.getElementById('lbEntry');
  const name   = nameEl?.value?.trim();
  if (!name) { if (msgEl) { msgEl.style.color='#8a2c2c'; msgEl.textContent='Please enter your name.'; } return; }
  if (msgEl) { msgEl.style.color='#2a7a58'; msgEl.textContent='Saving...'; }
  try {
    const { sha, data } = await readLB();
    if (!data.boards) data.boards = {};
    const key = CFG.placeId ? `${CFG.placeId}_${state.mode}` : `coord_${CFG.coordLat.toFixed(3)}_${CFG.coordLng.toFixed(3)}_${state.mode}`;
    if (!data.boards[key]) data.boards[key] = [];
    data.boards[key].push({ name, score: state.totalSeen, pts: state.totalCorrect, date: new Date().toISOString().split('T')[0] });
    data.boards[key].sort((a, b) => (b.pts ?? 0) - (a.pts ?? 0) || (a.score ?? 0) - (b.score ?? 0));
    data.boards[key] = data.boards[key].slice(0, 10);
    const body = JSON.stringify({
      message: `Leaderboard: ${name} scored ${state.totalCorrect} pts at ${CFG.placeName}`,
      sha: sha || undefined,
      content: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2)))),
    });
    const putR = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${LB_FILE}`, {
      method: 'PUT',
      headers: { Authorization: `token ${GH_TOKEN}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
      body,
    });
    if (putR.status === 409) {
      if (msgEl) { msgEl.style.color='#8a6020'; msgEl.textContent='Someone else just submitted — try again in a moment.'; }
      return;
    }
    if (!putR.ok) throw new Error(`GitHub write ${putR.status}`);
    if (entry) entry.style.display = 'none';
    loadLeaderboard();
  } catch (e) {
    if (msgEl) { msgEl.style.color='#8a2c2c'; msgEl.textContent=`Could not save: ${e.message}`; }
  }
}

let introLbLoaded = false;
async function toggleIntroLeaderboard() {
  const panel = document.getElementById('introLbPanel');
  if (!panel) return;
  if (panel.style.display !== 'none') { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  if (introLbLoaded) return;
  introLbLoaded = true;
  panel.innerHTML = '<p style="text-align:center;color:#9b9890;font-size:0.85rem">Loading…</p>';
  try {
    const { data } = await readLB();
    const MODES = [{key:'easy',label:'Common'},{key:'hard',label:'Recorder'},{key:'complete',label:'Complete'},{key:'rarity',label:'Rarity'}];
    const html = MODES.map(({key, label}) => {
      const lbKey = CFG.placeId ? `${CFG.placeId}_${key}` : `coord_${CFG.coordLat.toFixed(3)}_${CFG.coordLng.toFixed(3)}_${key}`;
      const entries = data.boards?.[lbKey] || [];
      if (!entries.length) return '';
      return `<div style="margin-bottom:14px">
        <div class="lb-title" style="margin-bottom:6px">&#127942; ${label}</div>
        ${entries.map((e,i) => `<div class="lb-row-item">
          <span class="lb-rank">${i+1}</span>
          <span class="lb-name">${e.name}</span>
          <span class="lb-score">${e.pts ?? e.score} pts / ${e.score} species</span>
          <span class="lb-date">${e.date}</span>
        </div>`).join('')}
      </div>`;
    }).join('');
    panel.innerHTML = html || '<p style="text-align:center;color:#9b9890;font-size:0.85rem">No scores yet for this place.</p>';
  } catch {
    panel.innerHTML = '<p style="text-align:center;color:#9b9890;font-size:0.85rem">Could not load leaderboards.</p>';
  }
}

// ── Init ──────────────────────────────────────────────────────────────────
function initEngine(config) {
  CFG = config;
  CFG.indigenousField = config.indigenousField || null;
  CFG.easyUseWiki = config.easyUseWiki || false;
  _inLibrary = null;
  if (!CFG.easyBirds) CFG.easyBirds = [];
  state.mode = 'easy';

  const footer = document.createElement('div');
  footer.className = 'footer-bar';
  footer.innerHTML = `<a href="${CFG.backUrl}" style="color:#2a7a58;font-weight:700;">WhatDat?</a> - by <a href="https://www.rutherfordecology.co.nz/" target="_blank" style="color:#9b9890;">Rutherford Ecology</a> <span style="opacity:0.4;font-size:0.75em">${APP_VERSION}</span>`;
  document.body.appendChild(footer);

  render();
}
