import { useRef, useEffect } from 'react';

export default function BackgroundAnimation() {
  const canvasRef = useRef(null);
  const gc0Ref = useRef(null);
  const gc1Ref = useRef(null);
  const gc2Ref = useRef(null);
  const gt0Ref = useRef(null);
  const gt1Ref = useRef(null);
  const gt2Ref = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let W, H;

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // ── SVG helpers ──
    function pencilSVG(c) {
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`;
    }
    function eraserSVG(c) {
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H7L3 16l9-9 8 8-4 5z"/><path d="M6 11l8 8"/></svg>`;
    }

    // ── Drawing utilities ──
    function handDrawn(pts, amt) {
      const seed = Math.random() * 100;
      return pts.map((p, i) => {
        if (!p) return null;
        const t = i * 0.3 + seed;
        return {
          x: p.x + Math.sin(t * 1.7) * amt + Math.sin(t * 3.1) * amt * 0.3,
          y: p.y + Math.cos(t * 2.3) * amt + Math.cos(t * 2.9) * amt * 0.3
        };
      });
    }

    function lerp(pts, d) {
      if (pts.length < 2) return pts;
      const o = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const s = Math.max(2, Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / d));
        for (let t = 0; t < s; t++) {
          const f = t / s;
          o.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
        }
      }
      o.push(pts[pts.length - 1]);
      return o;
    }

    function circ(cx, cy, r, n) {
      const p = [];
      for (let i = 0; i <= n; i++) {
        const a = i / n * Math.PI * 2;
        p.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      }
      return p;
    }

    function arc(cx, cy, r, sa, ea, n) {
      const p = [];
      for (let i = 0; i <= n; i++) {
        const a = sa + i / n * (ea - sa);
        p.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      }
      return p;
    }

    // ── 19 Shape generators ──
    function genSmiley(cx, cy, s) {
      return [circ(cx, cy, s, 20), circ(cx - s * .32, cy - s * .2, s * .1, 8), circ(cx + s * .32, cy - s * .2, s * .1, 8), arc(cx, cy + s * .08, s * .48, .15, Math.PI - .15, 10)];
    }
    function genHeart(cx, cy, s) {
      const p = [];
      for (let i = 0; i <= 24; i++) { const t = i / 24 * Math.PI * 2, x = 16 * Math.pow(Math.sin(t), 3), y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)); p.push({ x: cx + x * s / 17, y: cy + y * s / 17 - s * .1 }); }
      return [p];
    }
    function genStar(cx, cy, s) {
      const p = [];
      for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 === 0 ? s : s * .42; p.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }); }
      return [p];
    }
    function genStickman(cx, cy, s) {
      return [circ(cx, cy - s * .6, s * .22, 18), [{ x: cx, y: cy - s * .38 }, { x: cx, y: cy + s * .2 }], [{ x: cx - s * .4, y: cy - s * .05 }, { x: cx, y: cy - s * .2 }, { x: cx + s * .4, y: cy - s * .05 }], [{ x: cx, y: cy + s * .2 }, { x: cx - s * .3, y: cy + s * .65 }], [{ x: cx, y: cy + s * .2 }, { x: cx + s * .3, y: cy + s * .65 }]];
    }
    function genHouse(cx, cy, s) {
      return [[{ x: cx - s * .5, y: cy }, { x: cx - s * .5, y: cy + s * .55 }, { x: cx + s * .5, y: cy + s * .55 }, { x: cx + s * .5, y: cy }], [{ x: cx - s * .6, y: cy + s * .03 }, { x: cx, y: cy - s * .45 }, { x: cx + s * .6, y: cy + s * .03 }], [{ x: cx - s * .12, y: cy + s * .55 }, { x: cx - s * .12, y: cy + s * .22 }, { x: cx + s * .12, y: cy + s * .22 }, { x: cx + s * .12, y: cy + s * .55 }], circ(cx + s * .28, cy + s * .18, s * .09, 10)];
    }
    function genTree(cx, cy, s) {
      return [
        [
          { x: cx, y: cy - s * .72 },
          { x: cx - s * .28, y: cy - s * .3 },
          { x: cx - s * .12, y: cy - s * .3 },
          { x: cx - s * .44, y: cy + s * .12 },
          { x: cx - s * .2, y: cy + s * .12 },
          { x: cx - s * .54, y: cy + s * .5 },
          { x: cx + s * .54, y: cy + s * .5 },
          { x: cx + s * .2, y: cy + s * .12 },
          { x: cx + s * .44, y: cy + s * .12 },
          { x: cx + s * .12, y: cy - s * .3 },
          { x: cx + s * .28, y: cy - s * .3 },
          { x: cx, y: cy - s * .72 }
        ],
        [{ x: cx, y: cy + s * .5 }, { x: cx, y: cy + s * .78 }]
      ];
    }
    function genSun(cx, cy, s) {
      const st = [circ(cx, cy, s * .35, 20)];
      for (let r = 0; r < 8; r++) { const a = r / 8 * Math.PI * 2; st.push([{ x: cx + Math.cos(a) * s * .45, y: cy + Math.sin(a) * s * .45 }, { x: cx + Math.cos(a) * s * .8, y: cy + Math.sin(a) * s * .8 }]); }
      return st;
    }
    function genFlower(cx, cy, s) {
      const st = [];
      for (let p = 0; p < 5; p++) { const b = p / 5 * Math.PI * 2; st.push(circ(cx + Math.cos(b) * s * .3, cy + Math.sin(b) * s * .3, s * .18, 12)); }
      st.push(circ(cx, cy, s * .12, 10));
      st.push([{ x: cx, y: cy + s * .3 }, { x: cx - s * .04, y: cy + s * .55 }, { x: cx + s * .02, y: cy + s * .8 }]);
      return st;
    }
    function genCat(cx, cy, s) {
      return [
        circ(cx, cy, s * .42, 28),
        [{ x: cx - s * .24, y: cy - s * .34 }, { x: cx - s * .38, y: cy - s * .66 }, { x: cx - s * .05, y: cy - s * .42 }],
        [{ x: cx + s * .24, y: cy - s * .34 }, { x: cx + s * .38, y: cy - s * .66 }, { x: cx + s * .05, y: cy - s * .42 }],
        circ(cx - s * .15, cy - s * .08, s * .035, 6),
        circ(cx + s * .15, cy - s * .08, s * .035, 6),
        [{ x: cx, y: cy + s * .02 }, { x: cx - s * .05, y: cy + s * .08 }, { x: cx + s * .05, y: cy + s * .08 }, { x: cx, y: cy + s * .02 }],
        [{ x: cx - s * .08, y: cy + s * .12 }, { x: cx - s * .38, y: cy + s * .04 }],
        [{ x: cx - s * .08, y: cy + s * .16 }, { x: cx - s * .38, y: cy + s * .18 }],
        [{ x: cx + s * .08, y: cy + s * .12 }, { x: cx + s * .38, y: cy + s * .04 }],
        [{ x: cx + s * .08, y: cy + s * .16 }, { x: cx + s * .38, y: cy + s * .18 }]
      ];
    }
    function genBoat(cx, cy, s) {
      return [(() => { const p = []; for (let i = 0; i <= 12; i++) { const t = i / 12; p.push({ x: cx - s * .5 + t * s, y: cy + s * .2 + Math.sin(t * Math.PI) * .15 * s }); } return p; })(), [{ x: cx, y: cy + s * .15 }, { x: cx, y: cy - s * .4 }], [{ x: cx, y: cy - s * .4 }, { x: cx + s * .35, y: cy - s * .15 }, { x: cx, y: cy - s * .1 }]];
    }
    function genBird(cx, cy, s) {
      return [arc(cx - s * .15, cy, s * .2, Math.PI + .3, 2 * Math.PI - .3, 8), arc(cx + s * .15, cy, s * .2, Math.PI + .3, 2 * Math.PI - .3, 8)];
    }
    function genMusic(cx, cy, s) {
      return [[{ x: cx - s * .2, y: cy + s * .35 }, { x: cx - s * .2, y: cy - s * .35 }], circ(cx - s * .2, cy + s * .35, s * .1, 8), [{ x: cx + s * .2, y: cy + s * .25 }, { x: cx + s * .2, y: cy - s * .45 }], circ(cx + s * .2, cy + s * .25, s * .1, 8), [{ x: cx - s * .2, y: cy - s * .35 }, { x: cx + s * .2, y: cy - s * .45 }]];
    }
    function genBalloon(cx, cy, s) {
      return [circ(cx, cy - s * .2, s * .35, 24), [{ x: cx, y: cy + s * .15 }, { x: cx - s * .05, y: cy + s * .35 }, { x: cx + s * .05, y: cy + s * .55 }, { x: cx - s * .05, y: cy + s * .75 }]];
    }
    function genFish(cx, cy, s) {
      return [(() => { const p = []; for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI * 2; p.push({ x: cx + Math.cos(a) * s * .45, y: cy + Math.sin(a) * s * .25 }); } return p; })(), [{ x: cx + s * .45, y: cy }, { x: cx + s * .7, y: cy - s * .2 }, { x: cx + s * .7, y: cy + s * .2 }, { x: cx + s * .45, y: cy }], circ(cx - s * .2, cy - s * .05, s * .05, 6)];
    }
    function genButterfly(cx, cy, s) {
      return [circ(cx - s * .25, cy - s * .1, s * .3, 16), circ(cx + s * .25, cy - s * .1, s * .3, 16), circ(cx - s * .2, cy + s * .2, s * .22, 12), circ(cx + s * .2, cy + s * .2, s * .22, 12), [{ x: cx, y: cy - s * .5 }, { x: cx, y: cy + s * .5 }]];
    }
    function genRocket(cx, cy, s) {
      return [(() => { const p = [{ x: cx, y: cy - s * .7 }]; p.push({ x: cx + s * .2, y: cy - s * .3 }); p.push({ x: cx + s * .2, y: cy + s * .3 }); p.push({ x: cx, y: cy + s * .5 }); p.push({ x: cx - s * .2, y: cy + s * .3 }); p.push({ x: cx - s * .2, y: cy - s * .3 }); p.push({ x: cx, y: cy - s * .7 }); return p; })(), circ(cx, cy - s * .15, s * .08, 8), [{ x: cx - s * .2, y: cy + s * .2 }, { x: cx - s * .35, y: cy + s * .45 }], [{ x: cx + s * .2, y: cy + s * .2 }, { x: cx + s * .35, y: cy + s * .45 }]];
    }
    function genCrown(cx, cy, s) {
      return [[{ x: cx - s * .4, y: cy + s * .2 }, { x: cx - s * .4, y: cy - s * .1 }, { x: cx - s * .2, y: cy + s * .05 }, { x: cx, y: cy - s * .3 }, { x: cx + s * .2, y: cy + s * .05 }, { x: cx + s * .4, y: cy - s * .1 }, { x: cx + s * .4, y: cy + s * .2 }, { x: cx - s * .4, y: cy + s * .2 }]];
    }
    function genSpiral(cx, cy, s) {
      const p = [];
      for (let i = 0; i <= 50; i++) { const a = i * .25, r = i / 50 * s; p.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }); }
      return [p];
    }

    const allShapes = [genSmiley, genHeart, genStar, genStickman, genHouse, genTree, genSun, genFlower, genCat, genBoat, genBird, genMusic, genBalloon, genFish, genButterfly, genRocket, genCrown, genSpiral];

    // ── 6 Scene generators ──
    function sceneHouseyard(cx, cy, s) { return [{ gi: 0, st: genHouse(cx - s * .3, cy, s) }, { gi: 1, st: genTree(cx + s * .8, cy + s * .1, s * .8) }, { gi: 2, st: genSun(cx + s * .5, cy - s * .8, s * .5) }, { gi: 0, st: [[{ x: cx - s * .1, y: cy + s * .55 }, { x: cx, y: cy + s * .8 }, { x: cx + s * .2, y: cy + s * .85 }]] }, { gi: 2, st: genBird(cx - s * .5, cy - s * .6, s * .3) }, { gi: 2, st: genBird(cx - s * .2, cy - s * .75, s * .25) }, { gi: 1, st: genFlower(cx + s * .4, cy + s * .2, s * .35) }]; }
    function sceneBeach(cx, cy, s) { return [{ gi: 0, st: genSun(cx + s * .6, cy - s * .6, s * .4) }, { gi: 2, st: genBoat(cx - s * .2, cy + s * .1, s * .6) }, { gi: 1, st: genBird(cx - s * .5, cy - s * .5, s * .25) }, { gi: 1, st: genBird(cx - s * .2, cy - s * .6, s * .2) }, { gi: 0, st: genFish(cx + s * .3, cy + s * .4, s * .35) }, { gi: 2, st: genStar(cx - s * .6, cy + s * .3, s * .2) }]; }
    function sceneSpace(cx, cy, s) { return [{ gi: 0, st: genRocket(cx - s * .3, cy, s * .7) }, { gi: 1, st: genStar(cx + s * .5, cy - s * .3, s * .3) }, { gi: 2, st: genStar(cx - s * .6, cy - s * .5, s * .2) }, { gi: 2, st: genStar(cx + s * .2, cy - s * .7, s * .15) }, { gi: 2, st: genStar(cx + s * .8, cy - s * .5, s * .18) }, { gi: 1, st: genStar(cx + s * .7, cy + s * .2, s * .12) }, { gi: 0, st: genStar(cx - s * .1, cy + s * .5, s * .12) }]; }
    function sceneGarden(cx, cy, s) { return [{ gi: 0, st: genFlower(cx - s * .5, cy + s * .1, s * .5) }, { gi: 1, st: genFlower(cx + s * .1, cy + s * .15, s * .45) }, { gi: 2, st: genFlower(cx + s * .65, cy + s * .05, s * .5) }, { gi: 0, st: genSun(cx + s * .3, cy - s * .7, s * .35) }, { gi: 2, st: genButterfly(cx, cy - s * .3, s * .3) }, { gi: 1, st: genBird(cx - s * .3, cy - s * .5, s * .2) }]; }
    function sceneParty(cx, cy, s) { return [{ gi: 0, st: genBalloon(cx - s * .5, cy, s * .4) }, { gi: 1, st: genBalloon(cx, cy - s * .1, s * .45) }, { gi: 2, st: genBalloon(cx + s * .5, cy + s * .05, s * .4) }, { gi: 0, st: genCrown(cx, cy + s * .5, s * .35) }, { gi: 1, st: genMusic(cx + s * .6, cy + s * .3, s * .3) }, { gi: 2, st: genStar(cx - s * .3, cy - s * .5, s * .2) }]; }
    function scenePark(cx, cy, s) { return [{ gi: 0, st: genTree(cx - s * .4, cy + s * .1, s * .7) }, { gi: 1, st: genTree(cx + s * .4, cy + s * .05, s * .65) }, { gi: 2, st: genSun(cx, cy - s * .7, s * .35) }, { gi: 0, st: genBird(cx - s * .2, cy - s * .45, s * .2) }, { gi: 1, st: genFlower(cx - s * .1, cy + s * .5, s * .35) }, { gi: 2, st: genCat(cx + s * .6, cy + s * .3, s * .35) }]; }

    const scenes = [sceneHouseyard, sceneBeach, sceneSpace, sceneGarden, sceneParty, scenePark];

    // ── Zone management ──
    let zones = [];
    function findSpot(s, options = {}) {
      const { allowFallback = true, padding = 1.6 } = options;
      // Place shapes in a ring around the center content.
      // Inner boundary = just outside the content area
      // Outer boundary = edge of viewport
      const innerW = Math.min(420, Math.max(150, W * 0.48));
      const innerH = Math.min(340, Math.max(210, H * 0.38));
      const cx = W / 2, cy = H / 2;

      for (let a = 0; a < 50; a++) {
        // Pick a random angle around the center
        const angle = Math.random() * Math.PI * 2;
        // Pick a distance that's just outside the content but not too far
        const minR = Math.sqrt(innerW * innerW + innerH * innerH);
        const maxR = Math.max(W, H) * 0.55;
        const r = minR + Math.random() * (maxR - minR);
        const x = cx + Math.cos(angle) * r * (W / H);
        const y = cy + Math.sin(angle) * r;
        // Keep in bounds
        if (x < s + 20 || x > W - s - 20 || y < s + 60 || y > H - s - 20) continue;
        // Collision with existing shapes
        let ok = true;
        for (const z of zones) {
          const minGap = z.s * padding + s * padding;
          if (Math.hypot(x - z.x, y - z.y) < minGap) ok = false;
        }
        if (ok) return { x, y };
      }
      if (!allowFallback) return null;
      // Fallback: place at a random angle on the ring
      const fa = Math.random() * Math.PI * 2;
      const fr = Math.sqrt(innerW * innerW + innerH * innerH) * 1.1;
      return {
        x: Math.max(s + 20, Math.min(W - s - 20, cx + Math.cos(fa) * fr * (innerW / innerH))),
        y: Math.max(s + 60, Math.min(H - s - 20, cy + Math.sin(fa) * fr))
      };
    }

    function hasRoomFor(x, y, s, padding = 1.45) {
      for (const z of zones) {
        const minGap = z.s * padding + s * padding;
        if (Math.hypot(x - z.x, y - z.y) < minGap) return false;
      }
      return true;
    }

    function findPrefillSpot(s, options = {}) {
      const { padding = 1.45, attempts = 220 } = options;
      const cx = W / 2;
      const cy = H / 2;
      const contentW = Math.min(560, W * 0.78);
      const contentH = Math.min(680, H * 0.78);

      for (let a = 0; a < attempts; a++) {
        const x = s + 24 + Math.random() * Math.max(1, W - s * 2 - 48);
        const y = s + 74 + Math.random() * Math.max(1, H - s * 2 - 96);
        const insideContent =
          Math.abs(x - cx) < contentW / 2 + s * 0.8 &&
          Math.abs(y - cy) < contentH / 2 + s * 0.8;
        if (insideContent) continue;
        if (!hasRoomFor(x, y, s, padding)) continue;
        return { x, y };
      }
      return null;
    }

    // ── Ghost cursors ──
    const gcColors = ['#22c55e', '#f59e0b', '#ec4899'];
    const gcRefs = [gc0Ref, gc1Ref, gc2Ref];
    const gtRefs = [gt0Ref, gt1Ref, gt2Ref];

    const ghosts = gcColors.map((c, i) => ({
      el: gcRefs[i].current,
      toolEl: gtRefs[i].current,
      color: c, x: W * .3 + i * W * .2, y: H * .5,
      state: 'idle', strokes: null, si: 0, pi: 0, sampled: null,
      tx: 0, ty: 0, mx: 0, my: 0, mp: 0, pause: 0,
      drawn: [], isErasing: false, eraseTargets: null, eraseIdx: 0, tick: 0,
      _zone: null
    }));
    ghosts.forEach((g) => { g.toolEl.innerHTML = pencilSVG(g.color); });

    let persist = [];
    let queue = [];

    // ── Stroke prep: 1.5px spacing for slow deliberate drawing ──
    function prep(raw) {
      let pts = lerp(raw, 1.5);
      if (pts.length < 30 && pts.length >= 2) {
        const out = [];
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1];
          const n = Math.ceil(30 / pts.length);
          for (let t = 0; t < n; t++) { const f = t / n; out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }); }
        }
        out.push(pts[pts.length - 1]);
        pts = out;
      }
      return handDrawn(pts, 0.3);
    }

    function assignSolo(g) {
      const gen = allShapes[Math.floor(Math.random() * allShapes.length)];
      const s = 40 + Math.random() * 30;
      const pos = findSpot(s);
      const z = { x: pos.x, y: pos.y, s, stroke: null };
      zones.push(z);
      startDraw(g, gen(pos.x, pos.y, s));
      g._zone = z;
    }

    function startDraw(g, raw) {
      g.strokes = raw.map(prep);
      g.si = 0; g.pi = 0; g.isErasing = false; g.tick = 0;
      g.toolEl.innerHTML = pencilSVG(g.color);
      const fp = g.strokes[0][0];
      g.tx = fp.x; g.ty = fp.y; g.mx = g.x; g.my = g.y; g.mp = 0;
      g.state = 'moving';
      g.el.classList.add('visible');
    }

    function startErase(g) {
      const n = Math.min(1 + Math.floor(Math.random() * 2), g.drawn.length);
      g.eraseTargets = g.drawn.splice(g.drawn.length - n, n);
      g.eraseIdx = 0; g.isErasing = true; g.tick = 0;
      g.toolEl.innerHTML = eraserSVG(g.color);
      const tgt = g.eraseTargets[0];
      if (tgt && tgt.points.length > 0) {
        g.tx = tgt.points[0].x; g.ty = tgt.points[0].y;
        g.mx = g.x; g.my = g.y; g.mp = 0; g.state = 'moving';
        g.el.classList.add('visible');
      }
    }

    function scheduleScene() {
      const fn = scenes[Math.floor(Math.random() * scenes.length)];
      const s = 35 + Math.random() * 25;
      const pos = findSpot(s * 2);
      const z = { x: pos.x, y: pos.y, s: s * 2, stroke: null };
      zones.push(z);
      fn(pos.x, pos.y, s).forEach(t => { t._zone = z; queue.push(t); });
    }

    function savePreloaded(raw, color, zone, options = {}) {
      const saved = raw.map(prep).map(points => ({
        points,
        color,
        alpha: options.alpha ?? 1,
        width: options.width ?? 2,
        decay: options.decay ?? 0,
        delay: options.delay ?? 0
      }));
      persist.push(...saved);
      if (zone && !zone.stroke) zone.stroke = saved[0];
      return saved;
    }

    function prepopulateBackground() {
      const isCompact = W < 720 || H < 620;
      const targetCount = isCompact ? 9 : 22;
      const maxAttempts = targetCount * 12;

      for (let i = 0, placed = 0; placed < targetCount && i < maxAttempts; i++) {
        const gen = allShapes[Math.floor(Math.random() * allShapes.length)];
        const s = isCompact ? 16 + Math.random() * 14 : 28 + Math.random() * 28;
        const pos = findPrefillSpot(s, { padding: isCompact ? 1.3 : 1.45 });
        if (!pos) continue;
        const z = { x: pos.x, y: pos.y, s, stroke: null };
        zones.push(z);
        savePreloaded(gen(pos.x, pos.y, s), gcColors[placed % gcColors.length], z, {
          alpha: 0.55 + Math.random() * 0.45,
          decay: 0.000025 + Math.random() * 0.000025,
          delay: 600 + Math.floor(Math.random() * 1200)
        });
        placed++;
      }
    }

    function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

    // ── Ghost state machine ──
    function update(g, gi) {
      if (g.state === 'idle') {
        g.pause--;
        if (g.pause <= 0) {
          const ti = queue.findIndex(t => t.gi === gi);
          if (ti >= 0) {
            const t = queue.splice(ti, 1)[0];
            startDraw(g, t.st);
            if (t._zone) g._zone = t._zone;
          } else if (g.drawn.length > 4 && Math.random() < 0.2) {
            startErase(g);
          } else if (Math.random() < 0.35 && queue.length === 0) {
            scheduleScene(); g.pause = 30;
          } else {
            assignSolo(g);
          }
        }
        return;
      }

      if (g.state === 'moving') {
        g.mp += 0.012;
        if (g.mp >= 1) {
          g.x = g.tx; g.y = g.ty;
          if (g.isErasing) { g.state = 'erasing'; g.pi = 0; }
          else { g.state = 'drawing'; g.sampled = [g.strokes[g.si][0]]; }
        } else {
          const t = ease(g.mp);
          g.x = g.mx + (g.tx - g.mx) * t;
          g.y = g.my + (g.ty - g.my) * t;
        }
        return;
      }

      if (g.state === 'erasing') {
        const tgt = g.eraseTargets[g.eraseIdx];
        if (!tgt) { g.state = 'idle'; g.pause = 80; g.el.classList.remove('visible'); g.toolEl.innerHTML = pencilSVG(g.color); return; }
        for (let _e = 0; _e < 2 && g.pi < tgt.points.length; _e++) {
          const pt = tgt.points[g.pi];
          if (pt) { g.x = pt.x; g.y = pt.y; }
          tgt.alpha = Math.max(0, tgt.alpha - 0.008); g.pi++;
        }
        if (g.pi >= tgt.points.length) {
          tgt.alpha = 0; g.eraseIdx++;
          if (g.eraseIdx >= g.eraseTargets.length) {
            g.state = 'idle'; g.pause = 100 + Math.floor(Math.random() * 80);
            g.el.classList.remove('visible'); g.isErasing = false;
            g.toolEl.innerHTML = pencilSVG(g.color);
          } else {
            const next = g.eraseTargets[g.eraseIdx];
            if (next && next.points.length > 0) {
              g.tx = next.points[0].x; g.ty = next.points[0].y;
              g.mx = g.x; g.my = g.y; g.mp = 0; g.state = 'moving';
            }
          }
        }
        return;
      }

      if (g.state === 'pausing') {
        g.pause--;
        if (g.pause <= 0) {
          g.si++;
          if (g.si >= g.strokes.length) {
            g.state = 'idle'; g.pause = 80 + Math.floor(Math.random() * 60);
            g.el.classList.remove('visible'); return;
          }
          // Smooth movement to next stroke start instead of teleporting
          const np = g.strokes[g.si][0];
          g.tx = np.x; g.ty = np.y;
          g.mx = g.x; g.my = g.y;
          g.mp = 0;
          g.state = 'moving';
        }
        return;
      }

      if (g.state === 'drawing') {
        // 1 point per frame keeps the drawing readable without feeling sluggish.
        g.tick++;
        const stroke = g.strokes[g.si];
        if (g.pi < stroke.length) {
          const pt = stroke[g.pi];
          if (pt) { g.x = pt.x; g.y = pt.y; g.sampled.push(pt); }
          g.pi++;
        }
        if (g.pi >= stroke.length) {
          const saved = { points: [...g.sampled], color: g.color, alpha: 1, width: 2 };
          persist.push(saved); g.drawn.push(saved);
          if (g._zone && !g._zone.stroke) { g._zone.stroke = saved; }
          g.sampled = null; g.pi = 0;
          g.state = 'pausing'; g.pause = 0;
        }
      }
    }

    // ── Render loop (single canvas, 100-stroke cap, fixed 60fps timestep) ──
    const STEP = 1000 / 60; // 16.67ms per logic tick
    let lastTime = 0;
    let accum = 0;

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Clean up dead zones
      for (let i = zones.length - 1; i >= 0; i--) {
        const z = zones[i];
        if (z.stroke && z.stroke.alpha <= 0) zones.splice(i, 1);
      }
      if (zones.length > 50) zones.splice(0, 1);

      // Cap max strokes — higher limit so drawings accumulate
      while (persist.length > 200) { persist.shift(); }

      // Draw persisted strokes — slow fade only when getting full
      for (let i = persist.length - 1; i >= 0; i--) {
        const s = persist[i];
        if (s.delay > 0) s.delay--;
        else if (s.decay) s.alpha -= s.decay;
        else if (persist.length > 150) s.alpha -= 0.0001;
        if (s.alpha <= 0) { persist.splice(i, 1); continue; }
        ctx.globalAlpha = Math.min(s.alpha, 1) * 0.2;
        ctx.strokeStyle = s.color; ctx.lineWidth = s.width;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let j = 0; j < s.points.length; j++) {
          if (!s.points[j]) continue;
          if (j === 0 || !s.points[j - 1]) ctx.moveTo(s.points[j].x, s.points[j].y);
          else ctx.lineTo(s.points[j].x, s.points[j].y);
        }
        ctx.stroke();
      }

      // Draw active in-progress strokes
      for (const g of ghosts) {
        if (g.sampled && g.sampled.length > 1) {
          ctx.globalAlpha = 0.2; ctx.strokeStyle = g.color; ctx.lineWidth = 2;
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.beginPath();
          for (let j = 0; j < g.sampled.length; j++) {
            if (j === 0) ctx.moveTo(g.sampled[j].x, g.sampled[j].y);
            else ctx.lineTo(g.sampled[j].x, g.sampled[j].y);
          }
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 1;

      // Position cursors (visual only, no logic)
      for (let i = 0; i < ghosts.length; i++) {
        ghosts[i].el.style.left = (ghosts[i].x - 3) + 'px';
        ghosts[i].el.style.top = (ghosts[i].y - 20) + 'px';
      }
    }

    function render(timestamp) {
      if (!lastTime) lastTime = timestamp;
      const dt = Math.min(timestamp - lastTime, 100); // cap dt to avoid spiral after tab switch
      lastTime = timestamp;
      accum += dt;

      // Fixed timestep: advance logic at exactly 60fps regardless of monitor refresh rate
      while (accum >= STEP) {
        for (let i = 0; i < ghosts.length; i++) {
          update(ghosts[i], i);
        }
        accum -= STEP;
      }

      draw();
      animId.current = requestAnimationFrame(render);
    }

    prepopulateBackground();
    draw();

    // Staggered start
    ghosts[0].state = 'idle'; ghosts[0].pause = 80;
    ghosts[1].state = 'idle'; ghosts[1].pause = 200;
    ghosts[2].state = 'idle'; ghosts[2].pause = 350;

    const animId = { current: null };
    const startTimer = setTimeout(() => { animId.current = requestAnimationFrame(render); }, 600);

    return () => {
      clearTimeout(startTimer);
      if (animId.current) cancelAnimationFrame(animId.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' }}
      />

      {/* Ghost cursor: Maya (green) */}
      <div ref={gc0Ref} className="ghost-cursor">
        <div ref={gt0Ref} className="gc-tool" />
        <span className="gc-name" style={{ background: '#22c55e' }}>Maya</span>
      </div>

      {/* Ghost cursor: Jake (orange) */}
      <div ref={gc1Ref} className="ghost-cursor">
        <div ref={gt1Ref} className="gc-tool" />
        <span className="gc-name" style={{ background: '#f59e0b' }}>Jake</span>
      </div>

      {/* Ghost cursor: Lily (pink) */}
      <div ref={gc2Ref} className="ghost-cursor">
        <div ref={gt2Ref} className="gc-tool" />
        <span className="gc-name" style={{ background: '#ec4899' }}>Lily</span>
      </div>
    </>
  );
}
