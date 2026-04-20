import * as fs from 'fs'
import * as path from 'path'

const data = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'clusters-data.json'), 'utf8')
)

const CLUSTER_COLORS = [
  '#F87171', // red
  '#FB923C', // orange
  '#FBBF24', // amber
  '#34D399', // green
  '#22D3EE', // cyan
  '#60A5FA', // blue
  '#A78BFA', // purple
  '#F472B6', // pink
]

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ask Amit · Cluster Map</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --navy:#0B1929; --navy2:#102540;
  --red:#e63946; --red3:#F87171;
  --white:#FFFFFF; --off:#F8FAFC;
  --slate:#64748B; --slate2:#94A3B8; --slate3:#CBD5E1;
  --dark:#0F172A;
}
html,body{
  height:100%;margin:0;background:var(--navy);
  font-family:'Plus Jakarta Sans',sans-serif;-webkit-font-smoothing:antialiased;
  color:var(--slate2);overflow:hidden;
}
body::before{
  content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
  background-image:
    linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px);
  background-size:60px 60px;
}
body::after{
  content:'';position:fixed;top:0;left:0;right:0;height:3px;z-index:50;
  background:linear-gradient(90deg,var(--red) 0%,transparent 100%);
}

.app{display:flex;flex-direction:column;height:100vh;position:relative;z-index:1}

/* nav */
.topnav{
  padding:1rem 2rem;display:flex;justify-content:space-between;align-items:center;
  border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(11,25,41,0.85);
  backdrop-filter:blur(14px);z-index:10;flex-shrink:0;
}
.brand{display:flex;align-items:center;gap:.65rem}
.brand-mono{
  width:32px;height:32px;border-radius:50%;
  background:linear-gradient(135deg,#0a0a0a 0%,#2b2b2b 55%,#e63946 140%);
  color:#fff;display:flex;align-items:center;justify-content:center;
  font-family:'Playfair Display',serif;font-weight:900;font-size:.78rem;letter-spacing:-.02em;
}
.brand-txt{font-family:'Playfair Display',serif;font-weight:900;color:var(--white);font-size:1rem;letter-spacing:-.015em}
.brand-sub{font-size:.55rem;letter-spacing:.2em;text-transform:uppercase;color:var(--red3);font-weight:700;margin-left:.75rem}
.back-link{
  color:var(--slate2);font-size:.62rem;letter-spacing:.2em;text-transform:uppercase;
  font-weight:600;text-decoration:none;transition:color .2s;
}
.back-link:hover{color:var(--red3)}

/* controls */
.controls{
  padding:1rem 2rem;display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;
  border-bottom:1px solid rgba(255,255,255,0.05);flex-shrink:0;
}
.control-lbl{
  font-size:.58rem;letter-spacing:.22em;text-transform:uppercase;color:var(--slate);
  font-weight:700;margin-right:.2rem;
}
.src-pill{
  font-size:.68rem;padding:.35rem .85rem;border-radius:100px;cursor:pointer;
  border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.03);
  color:var(--slate2);transition:all .15s;user-select:none;font-weight:600;
}
.src-pill.active{background:rgba(230,57,70,0.15);border-color:rgba(230,57,70,0.6);color:var(--red3)}
.src-pill:hover{border-color:rgba(230,57,70,0.4)}

/* main area */
.main{display:flex;flex:1;min-height:0;overflow:hidden}
.plot-wrap{
  flex:1;position:relative;overflow:hidden;cursor:grab;
  background:radial-gradient(ellipse at center,rgba(255,255,255,0.015) 0%,transparent 70%);
}
.plot-wrap.dragging{cursor:grabbing}
.plot{width:100%;height:100%}

/* tooltip */
.tooltip{
  position:absolute;pointer-events:none;z-index:30;
  background:rgba(15,23,42,0.96);border:1px solid rgba(255,255,255,0.08);
  border-radius:.6rem;padding:.75rem .85rem;max-width:320px;
  font-size:.68rem;line-height:1.55;color:var(--slate2);
  box-shadow:0 12px 32px rgba(0,0,0,0.45);
  backdrop-filter:blur(10px);opacity:0;transition:opacity .12s;
}
.tooltip.show{opacity:1}
.tt-title{font-weight:700;color:var(--white);font-size:.75rem;margin-bottom:.2rem}
.tt-meta{color:var(--red3);font-size:.55rem;letter-spacing:.15em;text-transform:uppercase;font-weight:700;margin-bottom:.45rem}
.tt-hint{color:var(--slate);font-size:.55rem;letter-spacing:.15em;text-transform:uppercase;margin-top:.5rem}

/* legend */
.legend{
  width:230px;padding:1rem 1.25rem;border-left:1px solid rgba(255,255,255,0.06);
  overflow-y:auto;display:flex;flex-direction:column;gap:.45rem;
  background:rgba(255,255,255,0.01);flex-shrink:0;
}
.legend-h{
  font-size:.58rem;letter-spacing:.22em;text-transform:uppercase;color:var(--slate);
  font-weight:700;margin-bottom:.55rem;
}
.legend-item{
  display:flex;align-items:center;gap:.55rem;padding:.4rem .5rem;border-radius:.4rem;
  cursor:pointer;transition:background .15s;font-size:.7rem;color:var(--slate2);
}
.legend-item:hover{background:rgba(255,255,255,0.04)}
.legend-item.dimmed{opacity:0.35}
.legend-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.legend-cnt{color:var(--slate);margin-left:auto;font-size:.6rem}
.legend-footer{margin-top:1rem;padding-top:.85rem;border-top:1px solid rgba(255,255,255,0.05);font-size:.58rem;color:var(--slate);line-height:1.7}

/* detail panel */
.detail{
  position:fixed;bottom:0;left:0;right:0;
  background:rgba(11,25,41,0.97);border-top:1px solid rgba(230,57,70,0.35);
  padding:1.25rem 2rem;transform:translateY(100%);transition:transform .25s cubic-bezier(.4,0,.2,1);
  max-height:40vh;overflow-y:auto;z-index:40;backdrop-filter:blur(12px);
  box-shadow:0 -12px 40px rgba(0,0,0,.4);
}
.detail.open{transform:translateY(0)}
.detail-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.85rem;gap:1rem}
.detail-title{font-family:'Playfair Display',serif;font-size:1.15rem;color:var(--white);font-weight:700}
.detail-meta{font-size:.58rem;letter-spacing:.22em;text-transform:uppercase;color:var(--red3);font-weight:700;margin-top:.25rem}
.detail-close{
  width:28px;height:28px;border-radius:50%;border:1px solid rgba(255,255,255,0.12);
  background:rgba(255,255,255,0.03);color:var(--slate2);cursor:pointer;
  display:flex;align-items:center;justify-content:center;font-size:1.1rem;line-height:1;
  transition:all .15s;
}
.detail-close:hover{border-color:var(--red);color:var(--red3)}
.detail-body{font-size:.82rem;line-height:1.75;color:var(--slate2);max-width:72ch}
.detail-body::first-letter{font-family:'Playfair Display',serif;font-size:2.2em;font-weight:900;color:var(--red);float:left;line-height:.9;margin-right:.12em;margin-top:.05em}

/* zoom button */
.zoom-ctrls{position:absolute;bottom:1.5rem;right:1.5rem;display:flex;flex-direction:column;gap:.4rem;z-index:20}
.zoom-btn{
  width:36px;height:36px;border-radius:.45rem;border:1px solid rgba(255,255,255,0.08);
  background:rgba(11,25,41,0.85);color:var(--slate2);cursor:pointer;
  display:flex;align-items:center;justify-content:center;font-size:1rem;
  transition:all .15s;backdrop-filter:blur(8px);
}
.zoom-btn:hover{border-color:var(--red);color:var(--red3)}

@media (max-width:760px){
  .legend{display:none}
  .topnav,.controls{padding:1rem}
}
</style>
</head>
<body>

<div class="app">
  <nav class="topnav">
    <div class="brand">
      <div class="brand-mono">AK</div>
      <div class="brand-txt">Ask Amit</div>
      <div class="brand-sub">Cluster Map</div>
    </div>
    <a class="back-link" href="./summary.html">← Back to Summary</a>
  </nav>

  <div class="controls">
    <span class="control-lbl">Filter by Source:</span>
    <span class="src-pill active" data-src="__ALL__">All</span>
  </div>

  <div class="main">
    <div class="plot-wrap" id="plotwrap">
      <svg class="plot" id="plot" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet"></svg>
      <div class="tooltip" id="tt"></div>
      <div class="zoom-ctrls">
        <button class="zoom-btn" id="zin">+</button>
        <button class="zoom-btn" id="zout">−</button>
        <button class="zoom-btn" id="zreset" title="Reset view">⊙</button>
      </div>
    </div>
    <aside class="legend" id="legend">
      <div class="legend-h">Topics (click to isolate)</div>
    </aside>
  </div>

  <div class="detail" id="detail">
    <div class="detail-head">
      <div>
        <div class="detail-title" id="dt-title">—</div>
        <div class="detail-meta" id="dt-meta">—</div>
      </div>
      <button class="detail-close" id="dt-close" aria-label="Close">×</button>
    </div>
    <div class="detail-body" id="dt-body">—</div>
  </div>
</div>

<script>
// ────────────────────────────────────────────────────────────
// DATA (inlined at build time)
// ────────────────────────────────────────────────────────────
const DATA = __DATA_JSON__;
const COLORS = __COLORS_JSON__;

// ────────────────────────────────────────────────────────────
// STATE
// ────────────────────────────────────────────────────────────
const state = {
  activeSources: new Set(DATA.sources),
  activeClusters: new Set(DATA.labels.map((_,i)=>i)),
  tx: 0, ty: 0, scale: 1,
  dragging: false, dragStartX: 0, dragStartY: 0, dragTx: 0, dragTy: 0,
};

// ────────────────────────────────────────────────────────────
// DOM
// ────────────────────────────────────────────────────────────
const svg = document.getElementById('plot');
const plotWrap = document.getElementById('plotwrap');
const tt = document.getElementById('tt');
const legend = document.getElementById('legend');
const detail = document.getElementById('detail');
const dtTitle = document.getElementById('dt-title');
const dtMeta = document.getElementById('dt-meta');
const dtBody = document.getElementById('dt-body');
const controls = document.querySelector('.controls');

// ────────────────────────────────────────────────────────────
// BUILD SOURCE PILLS
// ────────────────────────────────────────────────────────────
DATA.sources.forEach(src => {
  const p = document.createElement('span');
  p.className = 'src-pill active';
  p.dataset.src = src;
  p.textContent = src;
  controls.appendChild(p);
});
controls.addEventListener('click', e => {
  const pill = e.target.closest('.src-pill');
  if (!pill) return;
  const src = pill.dataset.src;
  if (src === '__ALL__') {
    const allActive = state.activeSources.size === DATA.sources.length;
    if (allActive) {
      state.activeSources.clear();
      controls.querySelectorAll('.src-pill').forEach(p => p.classList.remove('active'));
    } else {
      state.activeSources = new Set(DATA.sources);
      controls.querySelectorAll('.src-pill').forEach(p => p.classList.add('active'));
    }
  } else {
    if (state.activeSources.has(src)) {
      state.activeSources.delete(src);
      pill.classList.remove('active');
    } else {
      state.activeSources.add(src);
      pill.classList.add('active');
    }
    // update "All" pill state
    const allPill = controls.querySelector('.src-pill[data-src="__ALL__"]');
    if (state.activeSources.size === DATA.sources.length) allPill.classList.add('active');
    else allPill.classList.remove('active');
  }
  render();
});

// ────────────────────────────────────────────────────────────
// BUILD LEGEND
// ────────────────────────────────────────────────────────────
DATA.labels.forEach((lbl, i) => {
  const count = DATA.points.filter(p => p.cluster === i).length;
  const item = document.createElement('div');
  item.className = 'legend-item';
  item.dataset.cluster = i;
  item.innerHTML = \`
    <span class="legend-dot" style="background:\${COLORS[i]}"></span>
    <span>\${lbl}</span>
    <span class="legend-cnt">\${count}</span>
  \`;
  item.onclick = () => {
    // solo/toggle: if only this cluster is active, show all. Otherwise show only this.
    if (state.activeClusters.size === 1 && state.activeClusters.has(i)) {
      state.activeClusters = new Set(DATA.labels.map((_, k) => k));
    } else {
      state.activeClusters = new Set([i]);
    }
    updateLegendUI();
    render();
  };
  legend.appendChild(item);
});
const footer = document.createElement('div');
footer.className = 'legend-footer';
footer.innerHTML = \`
  \${DATA.points.length} chunks · 8 clusters · kNN lines shown<br>
  Hover a point for title · click for full excerpt<br>
  Scroll to zoom · drag to pan
\`;
legend.appendChild(footer);

function updateLegendUI() {
  legend.querySelectorAll('.legend-item').forEach(it => {
    const c = +it.dataset.cluster;
    if (state.activeClusters.has(c)) it.classList.remove('dimmed');
    else it.classList.add('dimmed');
  });
}

// ────────────────────────────────────────────────────────────
// RENDERING
// ────────────────────────────────────────────────────────────
const W = 1000, H = 680, PAD = 40;
svg.setAttribute('viewBox', \`0 0 \${W} \${H}\`);

const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
group.id = 'viewport';
svg.appendChild(group);

const linesLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
linesLayer.id = 'lines';
group.appendChild(linesLayer);

const pointsLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
pointsLayer.id = 'points';
group.appendChild(pointsLayer);

function px(p) { return PAD + p.x * (W - 2 * PAD); }
function py(p) { return PAD + (1 - p.y) * (H - 2 * PAD); }

function render() {
  linesLayer.innerHTML = '';
  pointsLayer.innerHTML = '';

  const visible = DATA.points.map((p, i) => ({ p, i })).filter(({ p }) =>
    state.activeSources.has(p.title) && state.activeClusters.has(p.cluster)
  );
  const visibleIdxSet = new Set(visible.map(v => v.i));

  // lines (kNN): only between two visible points
  for (const { p, i } of visible) {
    for (const n of p.neighbors) {
      if (!visibleIdxSet.has(n) || n < i) continue;
      const q = DATA.points[n];
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', px(p));
      line.setAttribute('y1', py(p));
      line.setAttribute('x2', px(q));
      line.setAttribute('y2', py(q));
      line.setAttribute('stroke', COLORS[p.cluster]);
      line.setAttribute('stroke-width', 0.5);
      line.setAttribute('stroke-opacity', 0.18);
      linesLayer.appendChild(line);
    }
  }

  // points
  for (const { p, i } of visible) {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', px(p));
    c.setAttribute('cy', py(p));
    c.setAttribute('r', 4.5);
    c.setAttribute('fill', COLORS[p.cluster]);
    c.setAttribute('fill-opacity', 0.88);
    c.setAttribute('stroke', '#0B1929');
    c.setAttribute('stroke-width', 1.2);
    c.style.cursor = 'pointer';
    c.style.transition = 'r 0.15s, fill-opacity 0.15s';
    c.dataset.idx = i;

    c.addEventListener('mouseenter', e => {
      c.setAttribute('r', 7.5);
      c.setAttribute('fill-opacity', 1);
      showTip(p, e);
    });
    c.addEventListener('mouseleave', () => {
      c.setAttribute('r', 4.5);
      c.setAttribute('fill-opacity', 0.88);
      tt.classList.remove('show');
    });
    c.addEventListener('mousemove', e => positionTip(e));
    c.addEventListener('click', () => openDetail(p));

    pointsLayer.appendChild(c);
  }

  applyTransform();
}

function showTip(p, e) {
  tt.innerHTML = \`
    <div class="tt-meta">\${DATA.labels[p.cluster]}</div>
    <div class="tt-title">\${escapeHtml(p.title)}</div>
    <div>\${escapeHtml(p.excerpt)}\${p.excerpt.length >= 240 ? '…' : ''}</div>
    <div class="tt-hint">Click to expand</div>
  \`;
  tt.classList.add('show');
  positionTip(e);
}

function positionTip(e) {
  const r = plotWrap.getBoundingClientRect();
  let x = e.clientX - r.left + 14;
  let y = e.clientY - r.top + 14;
  const tw = tt.offsetWidth, th = tt.offsetHeight;
  if (x + tw > r.width) x = e.clientX - r.left - tw - 14;
  if (y + th > r.height) y = e.clientY - r.top - th - 14;
  tt.style.left = x + 'px';
  tt.style.top = y + 'px';
}

function openDetail(p) {
  dtTitle.textContent = p.title + ' · chunk ' + p.chunk_index;
  dtMeta.textContent = DATA.labels[p.cluster];
  dtBody.textContent = p.excerpt + (p.excerpt.length >= 240 ? '…' : '');
  detail.classList.add('open');
}

document.getElementById('dt-close').onclick = () => detail.classList.remove('open');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ────────────────────────────────────────────────────────────
// PAN / ZOOM
// ────────────────────────────────────────────────────────────
function applyTransform() {
  const g = document.getElementById('viewport');
  g.setAttribute('transform', \`translate(\${state.tx}, \${state.ty}) scale(\${state.scale})\`);
}

plotWrap.addEventListener('wheel', e => {
  e.preventDefault();
  const r = plotWrap.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  const svgX = mx / r.width * W;
  const svgY = my / r.height * H;
  const delta = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  const newScale = Math.min(Math.max(state.scale * delta, 0.5), 8);
  state.tx = svgX - (svgX - state.tx) * (newScale / state.scale);
  state.ty = svgY - (svgY - state.ty) * (newScale / state.scale);
  state.scale = newScale;
  applyTransform();
}, { passive: false });

plotWrap.addEventListener('mousedown', e => {
  if (e.target.tagName === 'circle') return;
  state.dragging = true;
  state.dragStartX = e.clientX;
  state.dragStartY = e.clientY;
  state.dragTx = state.tx;
  state.dragTy = state.ty;
  plotWrap.classList.add('dragging');
});
window.addEventListener('mousemove', e => {
  if (!state.dragging) return;
  const r = plotWrap.getBoundingClientRect();
  const kx = W / r.width, ky = H / r.height;
  state.tx = state.dragTx + (e.clientX - state.dragStartX) * kx;
  state.ty = state.dragTy + (e.clientY - state.dragStartY) * ky;
  applyTransform();
});
window.addEventListener('mouseup', () => {
  state.dragging = false;
  plotWrap.classList.remove('dragging');
});

document.getElementById('zin').onclick = () => { state.scale = Math.min(state.scale * 1.25, 8); applyTransform(); };
document.getElementById('zout').onclick = () => { state.scale = Math.max(state.scale / 1.25, 0.5); applyTransform(); };
document.getElementById('zreset').onclick = () => { state.tx = 0; state.ty = 0; state.scale = 1; applyTransform(); };

// ────────────────────────────────────────────────────────────
// INIT
// ────────────────────────────────────────────────────────────
render();
updateLegendUI();
</script>
</body>
</html>
`

const out = html
  .replace('__DATA_JSON__', JSON.stringify(data))
  .replace('__COLORS_JSON__', JSON.stringify(CLUSTER_COLORS))

const outPath = path.join(process.cwd(), 'cluster.html')
fs.writeFileSync(outPath, out, 'utf8')
console.log(`✓ Wrote ${outPath} (${(out.length / 1024).toFixed(1)} KB)`)
