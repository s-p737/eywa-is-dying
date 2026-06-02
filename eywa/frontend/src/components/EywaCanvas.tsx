"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { NetworkData, NetworkNode } from "@/lib/api";
import NodeTooltip from "./NodeTooltip";

interface EywaCanvasProps {
  data: NetworkData | null;
  scrollRatio: number;
}

const NODE_COLORS = {
  teal: { alive: "#00c4a7", dead: "#c0392b", glow: "0,196,167" },
  gold: { alive: "#c8a04a", dead: "#c0392b", glow: "200,160,74" },
  red:  { alive: "#ff6b35", dead: "#c0392b", glow: "255,107,53" },
};

function project(lat: number, lon: number, W: number, H: number) {
  const x = ((lon + 180) / 360) * W;
  const y = ((90 - lat) / 180) * H;
  return { x, y };
}

interface CanvasNode extends NetworkNode {
  cx: number; cy: number; r: number;
  pulsePhase: number; opacity: number; deadTime: number;
}

// Pandora scene element hit targets for click detection
interface SceneTarget {
  id: string;
  cx: number; cy: number; r: number;
  node: NetworkNode; // synthetic node for tooltip
}

// Synthetic tooltip nodes for Pandora scene elements
function makeSyntheticNode(
  id: string, type: "forest"|"species"|"carbon",
  title: string, stat: string, context: string,
  lat: number, lon: number
): NetworkNode {
  return {
    id, type, lat, lon,
    alive: true,
    color: type === "forest" ? "teal" : type === "species" ? "gold" : "red",
    tooltip: { title, stat, context, source: type === "forest" ? "Global Forest Watch" : type === "species" ? "IUCN Red List" : "NASA / NOAA" },
  };
}

export default function EywaCanvas({ data, scrollRatio }: EywaCanvasProps) {
  const bgRef  = useRef<HTMLCanvasElement>(null);
  const prtRef = useRef<HTMLCanvasElement>(null);
  const lvRef  = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<HTMLCanvasElement>(null);

  const nodesRef  = useRef<CanvasNode[]>([]);
  const sceneRef  = useRef<SceneTarget[]>([]);
  const rafIds    = useRef<number[]>([]);

  const [hovered, setHovered] = useState<{ node: NetworkNode; x: number; y: number } | null>(null);
  const [W, setW] = useState(0);
  const [H, setH] = useState(0);

  // t shared across loops via ref so leaves/spores stay in sync
  const tRef = useRef(0);

  // degradation: 0 = fully alive, 1 = fully dead
  const degradation = scrollRatio < 0.15 ? 0 : Math.min(1, (scrollRatio - 0.15) / 0.75);
  const degRef = useRef(degradation);
  useEffect(() => { degRef.current = degradation; }, [degradation]);

  /* ── RESIZE ── */
  const resize = useCallback(() => {
    const w = window.innerWidth, h = window.innerHeight;
    [bgRef, prtRef, lvRef, dataRef].forEach(r => {
      if (r.current) { r.current.width = w; r.current.height = h; }
    });
    setW(w); setH(h);
  }, []);

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [resize]);

  /* ── BUILD DATA NODES ── */
  useEffect(() => {
    if (!data || W === 0) return;
    nodesRef.current = data.nodes.map((n, i) => {
      const { x, y } = project(n.lat, n.lon, W, H);
      const jitter = 30;
      return {
        ...n,
        cx: Math.max(20, Math.min(W - 20, x + (Math.random() - 0.5) * jitter)),
        cy: Math.max(20, Math.min(H - 20, y + (Math.random() - 0.5) * jitter)),
        r: n.type === "carbon" ? 4 : n.type === "forest" ? 3.5 : 2.5,
        pulsePhase: (i / data.nodes.length) * Math.PI * 2,
        opacity: 1, deadTime: 0,
      };
    });
  }, [data, W, H]);

  /* ── SCENE DATA (stable refs, built once on mount) ── */
  const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
  const rng  = (a: number, b: number) => a + Math.random() * (b - a);
  const rngI = (a: number, b: number) => Math.floor(rng(a, b));

  const FAR_TREES = useRef(Array.from({ length: 18 }, (_, i) => ({
    x: i / 17 + rng(-0.02, 0.02), h: rng(0.18, 0.38), w: rng(6, 14),
    glowHue: rngI(160, 310), phase: rng(0, Math.PI * 2),
  }))).current;

  const MID_TREES = useRef(Array.from({ length: 12 }, (_, i) => ({
    x: i / 11 + rng(-0.03, 0.03), h: rng(0.38, 0.60), w: rng(14, 26),
    glowHue: rngI(160, 320), phase: rng(0, Math.PI * 2),
  }))).current;

  const FG_TREES = useRef([
    { x: 0.0,  h: 0.72, w: 32, phase: 0.0 },
    { x: 0.04, h: 0.78, w: 42, phase: 1.1 },
    { x: 0.09, h: 0.65, w: 28, phase: 2.3 },
    { x: 0.96, h: 0.74, w: 36, phase: 0.5 },
    { x: 1.0,  h: 0.80, w: 44, phase: 1.7 },
    { x: 0.91, h: 0.62, w: 30, phase: 3.0 },
    { x: 0.14, h: 0.55, w: 22, phase: 0.8 },
    { x: 0.86, h: 0.58, w: 24, phase: 2.1 },
  ]).current;

  const MUSHROOMS = useRef([
    {x:0.06,y:0.74,r:26,hue:195,phase:0.0},{x:0.10,y:0.79,r:16,hue:200,phase:1.1},
    {x:0.04,y:0.80,r:11,hue:188,phase:2.3},{x:0.02,y:0.76,r:8, hue:205,phase:3.5},
    {x:0.88,y:0.70,r:32,hue:35, phase:0.7},{x:0.93,y:0.75,r:19,hue:30, phase:1.9},
    {x:0.83,y:0.77,r:13,hue:42, phase:3.1},{x:0.97,y:0.72,r:9, hue:28, phase:0.3},
    {x:0.22,y:0.82,r:18,hue:280,phase:0.3},{x:0.26,y:0.86,r:10,hue:290,phase:1.5},
    {x:0.18,y:0.84,r:7, hue:270,phase:2.8},{x:0.30,y:0.80,r:14,hue:295,phase:0.9},
    {x:0.68,y:0.80,r:22,hue:160,phase:2.0},{x:0.73,y:0.84,r:12,hue:155,phase:0.9},
    {x:0.78,y:0.82,r:8, hue:165,phase:3.3},{x:0.63,y:0.83,r:16,hue:170,phase:1.4},
    {x:0.40,y:0.64,r:9, hue:260,phase:1.2},{x:0.54,y:0.62,r:7, hue:200,phase:2.4},
    {x:0.34,y:0.67,r:6, hue:290,phase:0.6},{x:0.47,y:0.60,r:5, hue:310,phase:1.8},
    {x:0.60,y:0.65,r:8, hue:180,phase:3.1},{x:0.50,y:0.70,r:11,hue:240,phase:0.4},
    {x:0.15,y:0.72,r:7, hue:220,phase:2.0},{x:0.80,y:0.68,r:9, hue:130,phase:1.3},
  ]).current;

  const JELLIES = useRef([
    {x:0.36,y:0.20,r:22,hue:300,phase:0.0,drift:0.0},
    {x:0.54,y:0.13,r:28,hue:288,phase:1.5,drift:0.3},
    {x:0.64,y:0.26,r:16,hue:312,phase:0.8,drift:-0.2},
    {x:0.47,y:0.30,r:12,hue:278,phase:2.1,drift:0.1},
    {x:0.28,y:0.17,r:9, hue:302,phase:3.0,drift:0.4},
    {x:0.71,y:0.09,r:14,hue:258,phase:1.0,drift:-0.3},
    {x:0.20,y:0.35,r:8, hue:280,phase:2.5,drift:0.2},
    {x:0.78,y:0.22,r:10,hue:320,phase:0.6,drift:-0.1},
    {x:0.60,y:0.40,r:7, hue:270,phase:1.8,drift:0.35},
  ]).current;

  const PLANTS = useRef(Array.from({ length: 120 }, () => ({
    x: Math.random(), y: 0.68 + Math.random() * 0.28,
    h: 15 + Math.random() * 100,
    hue: [160,175,190,200,210,265,280,295,310][rngI(0,9)],
    phase: Math.random() * Math.PI * 2, w: 1.5 + Math.random() * 4,
    hasFan: Math.random() > 0.55, fanAngle: rng(-0.4, 0.4),
    // staggered death threshold so they die at different scroll points
    deathThreshold: 0.2 + Math.random() * 0.8,
  }))).current;

  const LILIES = useRef(Array.from({ length: 22 }, () => ({
    x: Math.random(), y: 0.80 + Math.random() * 0.16,
    r: 12 + Math.random() * 35, phase: Math.random() * Math.PI * 2,
    hasFlower: Math.random() > 0.6, flowerHue: rngI(160, 320),
    deathThreshold: 0.3 + Math.random() * 0.7,
  }))).current;

  const LEAVES = useRef(Array.from({ length: 80 }, () => ({
    x: Math.random(), y: Math.random(),
    vx: rng(-0.0002, 0.0002), vy: rng(0.00005, 0.0003),
    angle: rng(0, Math.PI * 2), va: rng(-0.01, 0.01),
    r: rng(3, 9), hue: [160,175,190,200,265,280,295][rngI(0,7)],
    life: Math.random(), phase: rng(0, Math.PI * 2),
    deathThreshold: 0.2 + Math.random() * 0.8,
  }))).current;

  const WATERFALLS = useRef([
    { x: 0.37, yStart: 0.05, yEnd: 0.72, w: 20, hue: 200, alpha: 0.14 },
    { x: 0.62, yStart: 0.08, yEnd: 0.68, w: 14, hue: 190, alpha: 0.10 },
    { x: 0.22, yStart: 0.15, yEnd: 0.75, w: 10, hue: 210, alpha: 0.08 },
    { x: 0.75, yStart: 0.20, yEnd: 0.70, w:  8, hue: 195, alpha: 0.07 },
  ]).current;

  const SPORES = useRef(Array.from({ length: 350 }, () => ({
    x: Math.random(), y: Math.random(),
    vx: (Math.random() - 0.5) * 0.00025,
    vy: -Math.random() * 0.00055 - 0.00008,
    r: 0.4 + Math.random() * 2.2,
    hue: [165,185,195,255,275,295,310][Math.floor(Math.random() * 7)],
    life: Math.random(), speed: 0.0025 + Math.random() * 0.005,
    phase: Math.random() * Math.PI * 2,
  }))).current;

  // Creature state
  const creatureRef = useRef({ opacity: 1, spotOpacities: [1,1,1,1,1,1,1,1,1] });

  /* ── DRAW HELPERS ── */
  function drawTreeFull(
    ctx: CanvasRenderingContext2D,
    x: number, baseY: number, trunkH: number, trunkW: number,
    glowHue: number, glowAlpha: number, phase: number, t: number
  ) {
    for (let i = 0; i < 3; i++) {
      const bx2 = x + (i - 1) * trunkW * 0.7;
      const bh  = trunkH * 0.12;
      ctx.fillStyle = "rgba(4,14,10,0.85)";
      ctx.beginPath();
      ctx.moveTo(bx2, baseY);
      ctx.quadraticCurveTo(bx2 + (i - 1) * 8, baseY - bh * 0.5, x, baseY - bh);
      ctx.lineTo(x, baseY); ctx.fill();
    }
    const tg = ctx.createLinearGradient(x - trunkW / 2, baseY, x + trunkW / 2, baseY - trunkH);
    tg.addColorStop(0, "rgba(3,12,8,1)");
    tg.addColorStop(0.5, "rgba(6,22,14,0.9)");
    tg.addColorStop(1, "rgba(8,28,18,0.75)");
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(x - trunkW / 2, baseY);
    ctx.bezierCurveTo(x - trunkW / 2 - 10, baseY - trunkH * 0.3, x - trunkW * 0.25, baseY - trunkH * 0.72, x, baseY - trunkH);
    ctx.bezierCurveTo(x + trunkW * 0.25, baseY - trunkH * 0.72, x + trunkW / 2 + 10, baseY - trunkH * 0.3, x + trunkW / 2, baseY);
    ctx.fill();

    if (glowAlpha > 0.01) {
      const p = (0.6 + 0.4 * Math.sin(t * 0.7 + phase)) * glowAlpha;
      const eg = ctx.createLinearGradient(x - trunkW / 2, 0, x + trunkW / 2, 0);
      eg.addColorStop(0, hsl(glowHue, 90, 55, 0.18 * p));
      eg.addColorStop(0.5, "transparent");
      eg.addColorStop(1, hsl(glowHue, 90, 55, 0.18 * p));
      ctx.fillStyle = eg;
      ctx.beginPath();
      ctx.moveTo(x - trunkW / 2, baseY);
      ctx.bezierCurveTo(x - trunkW / 2 - 10, baseY - trunkH * 0.3, x - trunkW * 0.25, baseY - trunkH * 0.72, x, baseY - trunkH);
      ctx.bezierCurveTo(x + trunkW * 0.25, baseY - trunkH * 0.72, x + trunkW / 2 + 10, baseY - trunkH * 0.3, x + trunkW / 2, baseY);
      ctx.fill();
    }

    const vineCount = Math.floor(trunkW / 4) + 3;
    for (let i = 0; i < vineCount; i++) {
      const vx0 = x + rng(-trunkW * 1.2, trunkW * 1.2);
      const vy0 = baseY - trunkH * rng(0.25, 0.75);
      const len  = trunkH * rng(0.15, 0.55);
      ctx.strokeStyle = `rgba(4,18,10,${rng(0.4, 0.8)})`; ctx.lineWidth = rng(0.8, 2.5);
      ctx.beginPath(); ctx.moveTo(vx0, vy0);
      ctx.bezierCurveTo(vx0 + rng(-20,20), vy0 + len * 0.3, vx0 + rng(-20,20), vy0 + len * 0.65, vx0 + rng(-12,12), vy0 + len);
      ctx.stroke();
      if (glowAlpha > 0.05 && Math.random() > 0.6) {
        const p2 = (0.5 + 0.5 * Math.sin(t * 1.2 + i + phase)) * glowAlpha;
        ctx.fillStyle = hsl(glowHue, 85, 65, 0.4 * p2);
        ctx.beginPath(); ctx.arc(vx0 + rng(-12,12), vy0 + len, rng(1, 3), 0, Math.PI * 2); ctx.fill();
      }
    }

    const branchCount = 4 + Math.floor(trunkW / 8);
    for (let i = 0; i < branchCount; i++) {
      const bFrac = rng(0.3, 0.9);
      const bxS = x + (i % 2 === 0 ? -1 : 1) * trunkW * rng(0.1, 0.4);
      const byS = baseY - trunkH * bFrac;
      const bLen = trunkW * rng(1.5, 3.5);
      const bAngle = (i % 2 === 0 ? -1 : 1) * rng(0.3, 0.8);
      const bxE = bxS + Math.cos(bAngle) * bLen;
      const byE = byS + Math.sin(bAngle - Math.PI / 2) * bLen * 0.6;
      ctx.strokeStyle = `rgba(4,16,10,${rng(0.6, 0.9)})`; ctx.lineWidth = rng(1.5, trunkW * 0.15); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(bxS, byS);
      ctx.quadraticCurveTo(bxS + (bxE - bxS) * 0.4 + rng(-10, 10), byS + (byE - byS) * 0.5, bxE, byE);
      ctx.stroke();
      if (glowAlpha > 0.05) {
        const lp = (0.5 + 0.5 * Math.sin(t * 0.6 + i * 0.8 + phase)) * glowAlpha;
        const lg2 = ctx.createRadialGradient(bxE, byE, 0, bxE, byE, bLen * 0.4);
        lg2.addColorStop(0, hsl(glowHue, 80, 55, 0.2 * lp)); lg2.addColorStop(1, "transparent");
        ctx.fillStyle = lg2; ctx.beginPath(); ctx.ellipse(bxE, byE, bLen * 0.4, bLen * 0.3, bAngle - 0.3, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawMushroom(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, r: number, hue: number, phase: number,
    vitality: number, t: number
  ) {
    if (vitality < 0.01) return;
    const p = (0.8 + 0.2 * Math.sin(t * 0.9 + phase)) * vitality;
    const og = ctx.createRadialGradient(x, y - r * 0.4, 0, x, y - r * 0.4, r * 3.5);
    og.addColorStop(0, hsl(hue, 90, 60, 0.3 * p));
    og.addColorStop(0.5, hsl(hue, 80, 50, 0.12 * p));
    og.addColorStop(1, "transparent");
    ctx.fillStyle = og; ctx.beginPath(); ctx.ellipse(x, y - r * 0.4, r * 3.5, r * 2.8, 0, 0, Math.PI * 2); ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.bezierCurveTo(x - r * 1.15, y - r * 0.5, x - r * 0.85, y - r * 1.5, x, y - r * 1.4);
    ctx.bezierCurveTo(x + r * 0.85, y - r * 1.5, x + r * 1.15, y - r * 0.5, x + r, y);
    ctx.closePath();
    // dead mushrooms go grey/brown
    const deadHue = 30;
    const capHue = hue + (deadHue - hue) * (1 - vitality);
    const cg = ctx.createRadialGradient(x, y - r * 0.8, 0, x, y - r * 0.5, r * 1.3);
    cg.addColorStop(0, hsl(capHue, 85 * vitality, 75 * vitality + 20, 0.95 * p));
    cg.addColorStop(0.55, hsl(capHue + 12, 72 * vitality, 48 * vitality + 10, 0.88 * p));
    cg.addColorStop(1, hsl(capHue + 25, 60 * vitality, 22, 0.82 * p));
    ctx.fillStyle = cg; ctx.fill();

    ctx.beginPath(); ctx.moveTo(x - r, y); ctx.bezierCurveTo(x - r * 1.1, y + r * 0.18, x + r * 1.1, y + r * 0.18, x + r, y);
    ctx.strokeStyle = hsl(capHue, 92 * vitality, 82, 0.55 * p); ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = hsl(hue + 15, 35, 28, 0.75 * vitality);
    ctx.beginPath(); ctx.moveTo(x - r * 0.22, y); ctx.lineTo(x + r * 0.22, y); ctx.lineTo(x + r * 0.15, y + r * 0.7); ctx.lineTo(x - r * 0.15, y + r * 0.7); ctx.closePath(); ctx.fill();
  }

  function drawJelly(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, r: number, hue: number, phase: number,
    vitality: number, t: number
  ) {
    if (vitality < 0.01) return;
    // as vitality drops, drift slows and bell deflates
    const driftMult = vitality;
    const p = (0.75 + 0.25 * Math.sin(t * 1.3 * driftMult + phase)) * vitality;

    const wg = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    wg.addColorStop(0, hsl(hue, 90, 80, 0.35 * p));
    wg.addColorStop(0.4, hsl(hue, 80, 60, 0.12 * p));
    wg.addColorStop(1, "transparent");
    ctx.fillStyle = wg; ctx.beginPath(); ctx.ellipse(x, y, r * 4, r * 4, 0, 0, Math.PI * 2); ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.bezierCurveTo(x - r, y - r * 1.8, x + r, y - r * 1.8, x + r, y);
    ctx.bezierCurveTo(x + r * 0.85, y + r * 0.25, x - r * 0.85, y + r * 0.25, x - r, y);
    ctx.closePath();
    const bg2 = ctx.createRadialGradient(x, y - r * 0.7, 0, x, y - r * 0.5, r * 1.1);
    bg2.addColorStop(0, hsl(hue, 88, 88, 0.75 * p));
    bg2.addColorStop(0.7, hsl(hue, 75, 60, 0.5 * p));
    bg2.addColorStop(1, hsl(hue, 65, 38, 0.3 * p));
    ctx.fillStyle = bg2; ctx.fill();
    ctx.strokeStyle = hsl(hue, 92, 92, 0.45 * p); ctx.lineWidth = 1; ctx.stroke();

    for (let k = 0; k < 3; k++) {
      const kr = r * (0.3 + k * 0.22);
      ctx.strokeStyle = hsl(hue, 85, 80, 0.15 * p); ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.ellipse(x, y - r * 0.3, kr, kr * 0.5, 0, 0, Math.PI); ctx.stroke();
    }

    // tendrils go limp as vitality drops
    for (let i = -3; i <= 3; i++) {
      const tx2 = x + i * r * 0.32;
      const tendrilLife = vitality;
      const len = r * (1.8 + Math.abs(i) * 0.4 + 0.5 * Math.sin(t * 2.2 * driftMult + i + phase)) * tendrilLife;
      ctx.beginPath(); ctx.moveTo(tx2, y + r * 0.2);
      ctx.bezierCurveTo(
        tx2 + Math.sin(t * driftMult + i * 0.6) * 10 * vitality, y + len * 0.35,
        tx2 + Math.sin(t * 0.8 * driftMult + i) * 12 * vitality, y + len * 0.7,
        tx2 + Math.sin(t * 0.5 * driftMult + i * 1.8) * 8 * vitality, y + len
      );
      ctx.strokeStyle = hsl(hue, 82, 82, 0.28 * p); ctx.lineWidth = 0.7; ctx.stroke();
    }
  }

  function drawWaterfall(
    ctx: CanvasRenderingContext2D,
    wfX: number, wfYS: number, wfYE: number, wfW: number,
    hue: number, alpha: number, vitality: number, t: number
  ) {
    if (vitality < 0.01) return;
    const wfH = wfYE - wfYS;
    const wg = ctx.createLinearGradient(wfX, wfYS, wfX + wfW * 0.5, wfYE);
    wg.addColorStop(0, hsl(hue, 80, 70, alpha * 1.5 * vitality));
    wg.addColorStop(0.4, hsl(hue, 75, 60, alpha * vitality));
    wg.addColorStop(1, hsl(hue, 70, 50, alpha * 0.3 * vitality));
    ctx.fillStyle = wg;
    ctx.beginPath(); ctx.moveTo(wfX, wfYS);
    ctx.bezierCurveTo(wfX - 4, wfYS + wfH * 0.3, wfX + wfW + 4, wfYS + wfH * 0.6, wfX + wfW, wfYE);
    ctx.lineTo(wfX + wfW * 0.3, wfYE);
    ctx.bezierCurveTo(wfX + wfW * 0.3 - 3, wfYS + wfH * 0.5, wfX + 3, wfYS + wfH * 0.3, wfX, wfYS);
    ctx.fill();
    for (let i = 0; i < Math.ceil(6 * vitality); i++) {
      const wy = (t * 40 * vitality + i * 38) % wfH;
      const wx = wfX + wfW * rng(0.1, 0.85);
      ctx.strokeStyle = `rgba(180,230,255,${(0.05 + 0.04 * Math.sin(t + i)) * vitality})`;
      ctx.lineWidth = rng(0.5, 1.5);
      ctx.beginPath(); ctx.moveTo(wx, wfYS + wy); ctx.lineTo(wx + rng(-3, 3), wfYS + wy + rng(15, 35)); ctx.stroke();
    }
    const sg = ctx.createRadialGradient(wfX + wfW * 0.5, wfYE, 0, wfX + wfW * 0.5, wfYE, wfW * 2);
    sg.addColorStop(0, hsl(hue, 80, 70, alpha * 1.2 * vitality)); sg.addColorStop(1, "transparent");
    ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(wfX + wfW * 0.5, wfYE, wfW * 2, wfW * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, r: number, hue: number, alpha: number) {
    if (alpha < 0.01) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    const lg = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2);
    lg.addColorStop(0, hsl(hue, 90, 65, alpha * 0.5)); lg.addColorStop(1, "transparent");
    ctx.fillStyle = lg; ctx.beginPath(); ctx.ellipse(0, 0, r * 2, r * 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hsl(hue, 80, 50, alpha * 0.85);
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.bezierCurveTo(r * 0.6, -r * 0.6, r * 0.7, r * 0.4, 0, r);
    ctx.bezierCurveTo(-r * 0.7, r * 0.4, -r * 0.6, -r * 0.6, 0, -r); ctx.fill();
    ctx.strokeStyle = hsl(hue, 90, 75, alpha * 0.5); ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke();
    ctx.restore();
  }

  function drawCreature(ctx: CanvasRenderingContext2D, vitality: number, t: number) {
    if (vitality < 0.01) return;
    const cx = W * 0.20, cy = H * 0.58, sc = W / 1500;
    const pulse = (0.7 + 0.3 * Math.sin(t * 0.55)) * vitality;

    const bg3 = ctx.createRadialGradient(cx, cy, 0, cx, cy, 140 * sc);
    bg3.addColorStop(0, `rgba(15,70,180,${0.14 * vitality})`); bg3.addColorStop(1, "transparent");
    ctx.fillStyle = bg3; ctx.beginPath(); ctx.ellipse(cx, cy, 175 * sc, 70 * sc, -0.12, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = `rgba(6,16,30,${0.92 * vitality})`;
    ctx.beginPath(); ctx.ellipse(cx, cy, 120 * sc, 48 * sc, -0.08, 0, Math.PI * 2); ctx.fill();

    const spotDefs: [number,number,number][] = [[-65,8,8],[-40,-18,10],[-10,-22,7],[22,-12,9],[55,4,6],[70,14,4],[-55,22,5],[15,20,5],[45,20,4]];
    const cr = creatureRef.current;
    spotDefs.forEach(([dx,dy,r], idx) => {
      const sv = cr.spotOpacities[idx] * vitality;
      if (sv < 0.01) return;
      const sg2 = ctx.createRadialGradient(cx+dx*sc,cy+dy*sc,0,cx+dx*sc,cy+dy*sc,r*sc*2);
      sg2.addColorStop(0,`rgba(40,190,255,${0.65*pulse*sv})`); sg2.addColorStop(1,"transparent");
      ctx.fillStyle=sg2; ctx.beginPath(); ctx.arc(cx+dx*sc,cy+dy*sc,r*sc*2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=`rgba(80,220,255,${0.55*pulse*sv})`; ctx.beginPath(); ctx.arc(cx+dx*sc,cy+dy*sc,r*sc*0.55,0,Math.PI*2); ctx.fill();
    });

    // eye goes out last
    const eyeV = Math.max(0, vitality * 2 - 1); // stays bright until 50% then drops
    if (eyeV > 0.01) {
      const ey = ctx.createRadialGradient(cx-28*sc,cy-20*sc,0,cx-28*sc,cy-20*sc,9*sc);
      ey.addColorStop(0,`rgba(160,255,230,${(0.95+0.05*Math.sin(t))*eyeV})`); ey.addColorStop(1,"rgba(0,140,110,0)");
      ctx.fillStyle=ey; ctx.beginPath(); ctx.arc(cx-28*sc,cy-20*sc,9*sc,0,Math.PI*2); ctx.fill();
    }

    ctx.strokeStyle=`rgba(6,16,30,${0.9*vitality})`; ctx.lineWidth=12*sc; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(cx+115*sc,cy+10*sc);
    ctx.bezierCurveTo(cx+160*sc,cy+30*sc,cx+175*sc,cy-10*sc,cx+195*sc,cy-25*sc); ctx.stroke();

    ([[140,20],[165,8],[185,-18]] as [number,number][]).forEach(([dx,dy]) => {
      ctx.fillStyle=`rgba(40,200,255,${0.3*pulse})`; ctx.beginPath(); ctx.arc(cx+dx*sc,cy+dy*sc,4*sc,0,Math.PI*2); ctx.fill();
    });
  }

  /* ── UPDATE SCENE CLICK TARGETS ── */
  function updateSceneTargets(W: number, H: number) {
    const targets: SceneTarget[] = [];
    // Jellyfish targets → species nodes
    const jellySpecies = [
      "Mantella aurantiaca (Golden Poison Frog)",
      "Rhincodon typus (Whale Shark)",
      "Physeter macrocephalus (Sperm Whale)",
      "Carcharhinus longimanus (Oceanic Whitetip Shark)",
      "Chelonia mydas (Green Sea Turtle)",
      "Dermochelys coriacea (Leatherback Sea Turtle)",
      "Pristis pristis (Largetooth Sawfish)",
      "Acropora cervicornis (Staghorn Coral)",
      "Pangasianodon gigas (Mekong Giant Catfish)",
    ];
    const jellyStats = ["CR — Critically Endangered","EN — Endangered","VU — Vulnerable","CR — Critically Endangered","EN — Endangered","CR — Critically Endangered","CR — Critically Endangered","CR — Critically Endangered","CR — Critically Endangered"];
    const jellyContext = [
      "Population declined >80% in 10 years due to habitat destruction and climate change.",
      "Targeted by fisheries and bycatch. Filter feeders dependent on healthy ocean ecosystems.",
      "Deep ocean sonar disruption and historical whaling reduced populations by 70%.",
      "Fins removed at sea for shark fin soup. Population down 70–80% since 1950s.",
      "Fibropapillomatosis disease linked to ocean warming. Nesting beaches threatened by rising seas.",
      "The largest sea turtle. Jellyfish diet means plastic bags are lethal. Deep diver, long migrator.",
      "Freshwater and marine. Critically endangered due to overfishing and habitat destruction.",
      "Coral bleaching events now annual in many reefs. Rebuilds over decades; bleaches in weeks.",
      "Critically endangered. Giant river fish; hunted for meat, blocked by dams.",
    ];
    JELLIES.forEach((j, i) => {
      const jx = j.x * W + Math.sin(0 * 0.42 + j.drift) * 28;
      const jy = j.y * H + Math.sin(0 * 0.65 + j.phase) * 20;
      targets.push({
        id: `jelly_${i}`, cx: jx, cy: jy, r: j.r * 2.5 * (W / 1400),
        node: makeSyntheticNode(`jelly_${i}`, "species",
          jellySpecies[i] ?? `Marine Species ${i+1}`,
          jellyStats[i] ?? "EN — Endangered",
          jellyContext[i] ?? "Marine biodiversity under pressure from warming oceans and human activity.",
          j.y * 90 - 45, j.x * 360 - 180
        ),
      });
    });

    // Mushroom targets → forest nodes
    const forestRegions = [
      "Amazon Basin, Brazil","Congo Basin, DRC","Borneo Rainforest","Atlantic Forest, Brazil",
      "Cerrado Savanna, Brazil","Mekong Delta Forests","Sundarbans Mangroves","Sierra Madre, Mexico",
      "Chocó-Darién, Colombia","Madagascar Dry Forest","Eastern Afromontane","Mesoamerican Reef Forest",
      "Western Ghats, India","Cardamom Mountains, Cambodia","Valdivian Forest, Chile","Miombo Woodlands",
      "Tepuis, Venezuela","Gran Chaco, Paraguay","Caatinga, Brazil","Namib Savanna",
      "Daintree Rainforest, Australia","Tongass, Alaska","Białowieża, Poland","Kinabalu, Borneo",
    ];
    const forestStats = ["8.7 Mha lost in 2022","4.1 Mha lost in 2022","3.2 Mha lost in 2022","88% original extent lost","50% cover remaining","2.1 Mha lost 2022","0.5 Mha lost 2022","1.8 Mha lost 2022","1.2 Mha lost 2022","90% original lost","0.9 Mha lost 2022","0.4 Mha lost 2022","0.7 Mha lost 2022","0.3 Mha lost 2022","0.2 Mha lost 2022","1.4 Mha lost 2022","0.1 Mha lost 2022","2.3 Mha lost 2022","0.6 Mha lost 2022","0.2 Mha lost 2022","<0.1 Mha lost","0.05 Mha lost","Protected forest","0.8 Mha lost 2022"];
    const forestContext = [
      "The Amazon lost a Texas-sized area of forest in 2022 alone. 1 Mha = 10,000 sq km — roughly the size of Jamaica.",
      "The world's second largest tropical rainforest. Deforestation accelerating for agriculture and mining.",
      "One of Earth's most biodiverse islands. 85% of species found nowhere else.",
      "One of the world's most threatened hotspots. Less than 12% of original extent remains.",
      "The Cerrado loses roughly 1% of its area per year to soy and cattle farming.",
      "Delta ecosystems are disproportionately rich in species and disproportionately threatened by development.",
      "The world's largest mangrove forest, shared by India and Bangladesh. Sea level rise is its greatest threat.",
      "Ancient highland forests. Logging and drug cartel land clearing drive losses.",
      "Most biodiverse place on Earth per km². Mining and logging concessions expanding.",
      "Over 90% of Madagascar's original forest is gone. Lemur habitat disappears with it.",
      "Mountain forests spanning 11 countries. Cloud forest ecosystems are highly climate-sensitive.",
      "Reef and coastal forests form a single ecosystem. Loss of one accelerates loss of the other.",
      "Biodiversity hotspot. Tea and spice cultivation replaced much of the original forest.",
      "One of Asia's last intact large forest landscapes. Protected but under logging pressure.",
      "Temperate rainforest unique to southern Chile. Mining and plantation forestry are primary threats.",
      "Dry woodland covering 2.7M km². Charcoal production is the main driver of loss.",
      "Ancient tabletop mountains with unique endemic species. Mining rights recently contested.",
      "South America's largest dry forest. Soy and cattle are eliminating it rapidly.",
      "Thorny dry forest unique to Brazil. Climate change making droughts more frequent.",
      "Desert-adjacent savanna. Elephant and rhino poaching connected to habitat fragmentation.",
      "135 million years old. One of the world's oldest tropical rainforests. Protected since 1988.",
      "Largest national forest in the US. Carbon sink under pressure from timber industry.",
      "Europe's last ancient forest. UNESCO site. Logging controversy ongoing since 2017.",
      "UNESCO World Heritage. Orangutan habitat. Logging roads opening interior to hunting.",
    ];
    MUSHROOMS.forEach((m, i) => {
      targets.push({
        id: `mush_${i}`, cx: m.x * W, cy: m.y * H, r: m.r * 2 * (W / 1300),
        node: makeSyntheticNode(`mush_${i}`, "forest",
          forestRegions[i] ?? `Forest Region ${i+1}`,
          forestStats[i] ?? "Data unavailable",
          forestContext[i] ?? "Forest cover loss accelerating due to agricultural expansion.",
          m.y * 90 - 45, m.x * 360 - 180
        ),
      });
    });

    // Creature → carbon node
    targets.push({
      id: "creature", cx: W * 0.20, cy: H * 0.58, r: 80 * (W / 1500),
      node: makeSyntheticNode("creature", "carbon",
        "Atmospheric CO₂ — Mauna Loa",
        "424.3 ppm (May 2024)",
        "Pre-industrial baseline was 280 ppm. We crossed 400 ppm in 2013 — a threshold not seen in 3 million years. Each ppm of CO₂ represents ~7.81 billion tonnes of CO₂ in the atmosphere.",
        20, -156
      ),
    });

    sceneRef.current = targets;
  }

  /* ── MAIN PANDORA + DATA DRAW LOOP ── */
  useEffect(() => {
    const bg  = bgRef.current;
    const prt = prtRef.current;
    const lv  = lvRef.current;
    const data_c = dataRef.current;
    if (!bg || !prt || !lv || !data_c || W === 0) return;

    const bx = bg.getContext("2d")!;
    const px = prt.getContext("2d")!;
    const lxc = lv.getContext("2d")!;
    const dctx = data_c.getContext("2d")!;

    // Update scene targets whenever W/H changes
    updateSceneTargets(W, H);

    function draw(ts: number) {
      tRef.current = ts * 0.011 / 1000 * 60; // normalize to ~60fps units
      const t = tRef.current;
      const deg = degRef.current;

      // vitality = inverse of degradation, clamped
      const vitality = Math.max(0, 1 - deg);

      bx.clearRect(0, 0, W, H);

      /* Sky */
      const sky = bx.createLinearGradient(0, 0, 0, H);
      // sky desaturates as world dies
      const skyL1 = deg > 0 ? `rgb(${Math.round(1+deg*15)},${Math.round(7-deg*5)},${Math.round(16-deg*10)})` : "#010710";
      sky.addColorStop(0, skyL1); sky.addColorStop(0.2, "#020f1e");
      sky.addColorStop(0.5, "#031422"); sky.addColorStop(0.75, "#041828"); sky.addColorStop(1, "#020c1a");
      bx.fillStyle = sky; bx.fillRect(0, 0, W, H);

      /* Ambient glow — dims with degradation */
      ([
        {x:0.43,y:0.30,h:280,r:0.28,a:0.13},{x:0.57,y:0.18,h:300,r:0.20,a:0.11},
        {x:0.28,y:0.38,h:195,r:0.22,a:0.09},{x:0.72,y:0.35,h:165,r:0.24,a:0.10},
        {x:0.14,y:0.48,h:220,r:0.18,a:0.08},{x:0.85,y:0.42,h:260,r:0.17,a:0.07},
        {x:0.50,y:0.50,h:240,r:0.30,a:0.06},{x:0.35,y:0.22,h:310,r:0.15,a:0.09},
        {x:0.65,y:0.25,h:185,r:0.16,a:0.08},
      ] as {x:number,y:number,h:number,r:number,a:number}[]).forEach(({x,y,h,r,a}) => {
        const p = (0.82 + 0.18 * Math.sin(t * 0.45 + x * 12)) * vitality;
        const g = bx.createRadialGradient(x*W,y*H,0,x*W,y*H,r*W);
        g.addColorStop(0, hsl(h, 82, 52, a * p)); g.addColorStop(1, "transparent");
        bx.fillStyle = g; bx.fillRect(0, 0, W, H);
      });

      /* Far trees — glow fades */
      bx.save(); bx.globalAlpha = 0.38;
      FAR_TREES.forEach(tr => drawTreeFull(bx, tr.x*W, H, tr.h*H, tr.w, tr.glowHue, vitality * 0.6, tr.phase, t));
      bx.restore();

      /* Waterfalls — flow slows */
      WATERFALLS.forEach(wf => drawWaterfall(bx, wf.x*W, wf.yStart*H, wf.yEnd*H, wf.w*(W/1400)*18, wf.hue, wf.alpha, vitality, t));

      /* Mid trees */
      bx.save(); bx.globalAlpha = 0.65;
      MID_TREES.forEach(tr => drawTreeFull(bx, tr.x*W, H, tr.h*H, tr.w*(W/1200), tr.glowHue, vitality, tr.phase, t));
      bx.restore();

      /* Plants — staggered die-off */
      PLANTS.forEach(p => {
        const plantVitality = Math.max(0, Math.min(1, (p.deathThreshold - deg) / p.deathThreshold));
        if (plantVitality < 0.01) return;
        const pulse = (0.65 + 0.35 * Math.sin(t * 1.6 + p.phase)) * plantVitality;
        const ppx = p.x * W, ppy = p.y * H;
        const sway = Math.sin(t * 0.75 * plantVitality + p.phase) * 6;
        const pg = bx.createRadialGradient(ppx, ppy, 0, ppx, ppy - p.h * 0.5, p.h * 0.9);
        pg.addColorStop(0, hsl(p.hue, 92, 62, 0.18 * pulse)); pg.addColorStop(1, "transparent");
        bx.fillStyle = pg; bx.beginPath(); bx.ellipse(ppx, ppy - p.h * 0.5, p.h * 0.65, p.h * 0.75, 0, 0, Math.PI*2); bx.fill();
        bx.strokeStyle = hsl(p.hue, 88, 58, 0.65 * pulse); bx.lineWidth = p.w; bx.lineCap = "round";
        bx.beginPath(); bx.moveTo(ppx, ppy); bx.quadraticCurveTo(ppx + sway * 0.6, ppy - p.h * 0.55, ppx + sway * 0.9, ppy - p.h); bx.stroke();
        if (p.hasFan) {
          for (let f = -1; f <= 1; f++) {
            const fa = p.fanAngle + f * 0.5 + Math.sin(t * 0.6 * plantVitality + p.phase) * 0.08;
            const llen = p.h * 0.25;
            const lx2 = ppx + sway * 0.9 + Math.sin(fa) * llen;
            const ly2 = ppy - p.h + Math.cos(fa) * llen * 0.4;
            bx.strokeStyle = hsl(p.hue, 80, 52, 0.45 * pulse); bx.lineWidth = p.w * 0.6;
            bx.beginPath(); bx.moveTo(ppx + sway * 0.9, ppy - p.h); bx.lineTo(lx2, ly2); bx.stroke();
            bx.fillStyle = hsl(p.hue, 85, 60, 0.3 * pulse); bx.beginPath(); bx.ellipse(lx2, ly2, p.h * 0.08, p.h * 0.04, fa, 0, Math.PI*2); bx.fill();
          }
        }
        bx.fillStyle = hsl(p.hue, 92, 82, 0.85 * pulse); bx.beginPath(); bx.arc(ppx + sway * 0.9, ppy - p.h, p.w * 1.6, 0, Math.PI*2); bx.fill();
        bx.fillStyle = hsl(p.hue, 96, 90, 0.5 * pulse); bx.beginPath(); bx.arc(ppx + sway * 0.9, ppy - p.h, p.w * 0.7, 0, Math.PI*2); bx.fill();
      });

      /* Water */
      const waterY = H * 0.78;
      const wbase = bx.createLinearGradient(0, waterY, 0, H);
      // water gets darker and stiller as world dies
      const wAlpha = 0.50 - deg * 0.15;
      wbase.addColorStop(0, `rgba(12,45,100,${wAlpha})`);
      wbase.addColorStop(0.3, `rgba(8,30,75,${wAlpha * 0.8})`);
      wbase.addColorStop(0.7, `rgba(5,18,55,${wAlpha})`);
      wbase.addColorStop(1, `rgba(3,10,35,${wAlpha * 1.3})`);
      bx.fillStyle = wbase; bx.fillRect(0, waterY, W, H - waterY);

      for (let ri = 0; ri < 6; ri++) {
        const rx = W * (0.15 + ri * 0.14 + Math.sin(t * 0.3 * vitality + ri) * 0.04);
        const ry = waterY + H * 0.06 + Math.cos(t * 0.5 * vitality + ri * 1.2) * 8;
        const rrad = (60 + ri * 30 + Math.sin(t * 0.7 * vitality + ri) * 20) * (W / 1400);
        const rp = (0.5 + 0.5 * Math.sin(t * 1.1 + ri * 0.9)) * vitality;
        bx.strokeStyle = `rgba(60,160,220,${(0.06 + 0.04 * rp)})`; bx.lineWidth = 1;
        bx.beginPath(); bx.ellipse(rx, ry, rrad, rrad * 0.3, 0, 0, Math.PI*2); bx.stroke();
        bx.strokeStyle = `rgba(80,180,240,${(0.03 + 0.02 * rp)})`;
        bx.beginPath(); bx.ellipse(rx, ry, rrad * 0.6, rrad * 0.18, 0, 0, Math.PI*2); bx.stroke();
      }
      for (let ci = 0; ci < 14; ci++) {
        const cxp = (0.05 + ci * 0.065) * W + Math.sin(t * 0.55 * vitality + ci) * 28;
        const cyp = waterY + H * 0.04 + Math.cos(t * 0.7 * vitality + ci * 0.9) * 14;
        const cr2 = 25 + ci * 10 + Math.sin(t + ci * 0.7) * 14;
        const cHues = [200,280,165,300,185,255,210,295,175,240,310,195,270,220];
        const cg2 = bx.createRadialGradient(cxp, cyp, 0, cxp, cyp, cr2);
        cg2.addColorStop(0, hsl(cHues[ci % cHues.length], 82, 62, (0.14 + 0.07 * Math.sin(t * 1.6 + ci)) * vitality));
        cg2.addColorStop(1, "transparent");
        bx.fillStyle = cg2; bx.beginPath(); bx.ellipse(cxp, cyp, cr2, cr2 * 0.35, 0, 0, Math.PI*2); bx.fill();
      }

      /* Lilies — staggered fade */
      LILIES.forEach(l => {
        const lilyV = Math.max(0, Math.min(1, (l.deathThreshold - deg) / l.deathThreshold));
        if (lilyV < 0.01) return;
        const lx2 = l.x * W, ly2 = l.y * H;
        const p = (0.6 + 0.4 * Math.sin(t * 0.65 + l.phase)) * lilyV;
        bx.fillStyle = `rgba(2,15,10,0.6)`; bx.beginPath(); bx.ellipse(lx2+4, ly2+3, l.r, l.r*0.38, 0, 0, Math.PI*2); bx.fill();
        bx.fillStyle = `rgba(6,45,28,${0.78*p})`; bx.beginPath(); bx.ellipse(lx2, ly2, l.r, l.r*0.36, 0, 0, Math.PI*2); bx.fill();
        bx.strokeStyle = `rgba(15,90,50,${0.3*p})`; bx.lineWidth = 0.8;
        for (let v = 0; v < 5; v++) { const va = v * Math.PI / 5 - Math.PI / 2; bx.beginPath(); bx.moveTo(lx2, ly2); bx.lineTo(lx2 + Math.cos(va) * l.r, ly2 + Math.sin(va) * l.r * 0.36); bx.stroke(); }
        bx.strokeStyle = `rgba(25,200,110,${0.3*p})`; bx.lineWidth = 1.8; bx.beginPath(); bx.ellipse(lx2, ly2, l.r, l.r*0.36, 0, 0, Math.PI*2); bx.stroke();
        bx.strokeStyle = "rgba(4,30,18,1)"; bx.lineWidth = 2.5; bx.beginPath(); bx.moveTo(lx2, ly2); bx.lineTo(lx2, ly2 - l.r * 0.36); bx.stroke();
        if (l.hasFlower) {
          const fp = (0.7 + 0.3 * Math.sin(t * 1.2 + l.phase)) * lilyV;
          const fg = bx.createRadialGradient(lx2, ly2 - l.r * 0.1, 0, lx2, ly2 - l.r * 0.1, l.r * 0.45);
          fg.addColorStop(0, hsl(l.flowerHue, 90, 80, 0.9 * fp)); fg.addColorStop(0.5, hsl(l.flowerHue, 80, 55, 0.6 * fp)); fg.addColorStop(1, "transparent");
          bx.fillStyle = fg; bx.beginPath(); bx.ellipse(lx2, ly2 - l.r * 0.1, l.r * 0.45, l.r * 0.28, 0, 0, Math.PI*2); bx.fill();
        }
      });

      /* Mushrooms — staggered die-off */
      MUSHROOMS.forEach((m, i) => {
        // each mushroom has a slightly different threshold
        const threshold = 0.3 + (i / MUSHROOMS.length) * 0.65;
        const mushroomV = Math.max(0, Math.min(1, (threshold - deg) / threshold));
        drawMushroom(bx, m.x * W, m.y * H, m.r * (W / 1300), m.hue, m.phase, mushroomV, t);
      });

      /* Jellyfish — drift slows, fade out staggered */
      JELLIES.forEach((j, i) => {
        const threshold = 0.25 + (i / JELLIES.length) * 0.65;
        const jellyV = Math.max(0, Math.min(1, (threshold - deg) / threshold));
        const jx2 = j.x * W + Math.sin(t * 0.42 * Math.max(0.1, jellyV) + j.drift) * 28;
        const jy2 = j.y * H + Math.sin(t * 0.65 * Math.max(0.1, jellyV) + j.phase) * 20;
        drawJelly(bx, jx2, jy2, j.r * (W / 1400), j.hue, j.phase, jellyV, t);
      });

      /* Update jelly positions in scene targets so clicks track them */
      const targets = sceneRef.current;
      JELLIES.forEach((j, i) => {
        const jellyV = Math.max(0.1, 1 - deg);
        const jx2 = j.x * W + Math.sin(t * 0.42 * jellyV + j.drift) * 28;
        const jy2 = j.y * H + Math.sin(t * 0.65 * jellyV + j.phase) * 20;
        const tgt = targets.find(t2 => t2.id === `jelly_${i}`);
        if (tgt) { tgt.cx = jx2; tgt.cy = jy2; }
      });

      /* Creature — spot die-off */
      const cr = creatureRef.current;
      cr.opacity = vitality;
      if (deg > 0.2) {
        cr.spotOpacities.forEach((_, idx) => {
          const spotThreshold = 0.2 + (idx / 9) * 0.6;
          cr.spotOpacities[idx] = Math.max(0, Math.min(1, (spotThreshold - deg) / spotThreshold));
        });
      }
      drawCreature(bx, vitality, t);

      /* Foreground trees */
      FG_TREES.forEach(tr => drawTreeFull(bx, tr.x * W, H, tr.h * H, tr.w * (W / 1200), 200, vitality, tr.phase, t));

      /* Side dark masses */
      const lmg = bx.createLinearGradient(0, 0, W * 0.16, 0);
      lmg.addColorStop(0, "rgba(1,5,12,1)"); lmg.addColorStop(1, "transparent");
      bx.fillStyle = lmg; bx.fillRect(0, 0, W * 0.16, H);
      const rmg = bx.createLinearGradient(W, 0, W * 0.84, 0);
      rmg.addColorStop(0, "rgba(1,5,12,1)"); rmg.addColorStop(1, "transparent");
      bx.fillStyle = rmg; bx.fillRect(W * 0.84, 0, W * 0.16, H);

      /* Boat */
      const bxb = W * 0.50, byb = H * 0.875, bsc = W / 1400;
      const boat_glow = bx.createRadialGradient(bxb, byb, 0, bxb, byb + 30, 100 * bsc);
      boat_glow.addColorStop(0, `rgba(70,150,210,${0.18 * vitality})`); boat_glow.addColorStop(1, "transparent");
      bx.fillStyle = boat_glow; bx.fillRect(0, 0, W, H);
      bx.fillStyle = "rgba(28,18,13,0.96)";
      bx.beginPath(); bx.moveTo(bxb - 80*bsc, byb - 8*bsc);
      bx.bezierCurveTo(bxb - 85*bsc, byb + 22*bsc, bxb + 85*bsc, byb + 22*bsc, bxb + 80*bsc, byb - 8*bsc);
      bx.bezierCurveTo(bxb + 60*bsc, byb - 28*bsc, bxb - 60*bsc, byb - 28*bsc, bxb - 80*bsc, byb - 8*bsc);
      bx.closePath(); bx.fill();
      bx.strokeStyle = "rgba(75,55,35,0.85)"; bx.lineWidth = 3.5 * bsc;
      bx.beginPath(); bx.moveTo(bxb - 80*bsc, byb - 8*bsc);
      bx.bezierCurveTo(bxb - 60*bsc, byb - 28*bsc, bxb + 60*bsc, byb - 28*bsc, bxb + 80*bsc, byb - 8*bsc);
      bx.stroke();
      ([-35, 0, 35] as number[]).forEach(dx => {
        const ppx = bxb + dx * bsc, ppy = byb - 38 * bsc;
        bx.fillStyle = "rgba(12,8,8,0.96)";
        bx.beginPath(); bx.ellipse(ppx, ppy + 12*bsc, 11*bsc, 16*bsc, 0, 0, Math.PI*2); bx.fill();
        bx.beginPath(); bx.arc(ppx, ppy - 7*bsc, 10*bsc, 0, Math.PI*2); bx.fill();
      });

      /* DATA NODES on separate canvas */
      dctx.clearRect(0, 0, W, H);
      const cnodes = nodesRef.current;
      cnodes.forEach(n => {
        if (n.alive && deg > 0) {
          if (Math.random() < deg * 0.0004) { n.alive = false; n.deadTime = ts; }
        }
        if (!n.alive) {
          const elapsed = (ts - n.deadTime) / 1200;
          n.opacity = Math.max(0, 1 - elapsed * 0.5);
        }
      });
      if (data) {
        const nodeById = new Map(cnodes.map(n => [n.id, n]));
        data.edges.forEach(edge => {
          const na = nodeById.get(edge.a), nb = nodeById.get(edge.b);
          if (!na || !nb) return;
          const op = Math.min(na.opacity, nb.opacity) * edge.strength * 0.15;
          if (op < 0.01) return;
          dctx.beginPath(); dctx.moveTo(na.cx, na.cy); dctx.lineTo(nb.cx, nb.cy);
          dctx.strokeStyle = na.alive && nb.alive ? `rgba(0,196,167,${op})` : `rgba(192,57,43,${op * 0.4})`;
          dctx.lineWidth = 0.5; dctx.stroke();
        });
      }
      cnodes.forEach(n => {
        if (n.opacity < 0.01) return;
        const pulse = Math.sin(ts * 0.0018 + n.pulsePhase) * 0.3 + 0.7;
        const colors = NODE_COLORS[n.color];
        const gAlpha = n.alive ? (0.15 + pulse * 0.1) * (1 - deg * 0.5) : 0.04 * n.opacity;
        const glowR = n.r * 10;
        const grd = dctx.createRadialGradient(n.cx, n.cy, 0, n.cx, n.cy, glowR);
        grd.addColorStop(0, `rgba(${colors.glow},${gAlpha})`); grd.addColorStop(1, `rgba(${colors.glow},0)`);
        dctx.fillStyle = grd; dctx.beginPath(); dctx.arc(n.cx, n.cy, glowR, 0, Math.PI*2); dctx.fill();
        const dotColor = n.alive ? colors.alive : colors.dead;
        dctx.beginPath(); dctx.arc(n.cx, n.cy, n.r, 0, Math.PI*2);
        dctx.fillStyle = `${dotColor}${Math.round(n.opacity * (n.alive ? 0.9 : 0.3) * 255).toString(16).padStart(2,"0")}`;
        dctx.fill();
      });

      rafIds.current[0] = requestAnimationFrame(draw);
    }

    /* LEAVES */
    function drawLeaves(ts: number) {
      const t = ts * 0.011 / 1000 * 60;
      const deg = degRef.current;
      const vitality = Math.max(0, 1 - deg);
      lxc.clearRect(0, 0, W, H);
      LEAVES.forEach(l => {
        const leafV = Math.max(0, Math.min(1, (l.deathThreshold - deg) / l.deathThreshold));
        l.life += 0.002 + l.vy;
        if (l.life > 1) { l.life = 0; l.x = Math.random(); l.y = -0.05; }
        l.x += l.vx + Math.sin(t * 0.7 * vitality + l.phase) * 0.0003;
        l.y += l.vy * vitality; // leaves slow and fall as vitality drops
        l.angle += l.va + Math.sin(t * 0.5 * vitality + l.phase) * 0.005;
        const alpha = Math.sin(l.life * Math.PI) * 0.75 * leafV;
        drawLeaf(lxc, l.x * W, l.y * H, l.angle + Math.sin(t * 1.2 + l.phase) * 0.15, l.r, l.hue, alpha);
      });
      rafIds.current[1] = requestAnimationFrame(drawLeaves);
    }

    /* SPORES */
    function drawSpores(ts: number) {
      const t = ts * 0.011 / 1000 * 60;
      const deg = degRef.current;
      const vitality = Math.max(0, 1 - deg);
      px.clearRect(0, 0, W, H);
      // spores thin out as vitality drops
      const visibleCount = Math.ceil(SPORES.length * (0.1 + 0.9 * vitality));
      SPORES.slice(0, visibleCount).forEach(sp => {
        sp.life += sp.speed * vitality;
        if (sp.life > 1) { sp.life = 0; sp.x = Math.random(); sp.y = 0.97 + Math.random() * 0.08; }
        sp.x += sp.vx + Math.sin(t * 0.6 * vitality + sp.phase) * 0.00018;
        sp.y += sp.vy * vitality;
        const alpha = Math.sin(sp.life * Math.PI) * 0.85 * vitality;
        if (alpha < 0.01) return;
        px.fillStyle = `hsla(${sp.hue},92%,72%,${alpha})`;
        px.beginPath(); px.arc(sp.x * W, sp.y * H, sp.r, 0, Math.PI*2); px.fill();
        if (alpha > 0.25) {
          px.fillStyle = `hsla(${sp.hue},82%,62%,${alpha * 0.28})`;
          px.beginPath(); px.arc(sp.x * W, sp.y * H + sp.r * 3.5, sp.r * 0.65, 0, Math.PI*2); px.fill();
        }
      });
      rafIds.current[2] = requestAnimationFrame(drawSpores);
    }

    rafIds.current[0] = requestAnimationFrame(draw);
    rafIds.current[1] = requestAnimationFrame(drawLeaves);
    rafIds.current[2] = requestAnimationFrame(drawSpores);

    return () => { rafIds.current.forEach(id => cancelAnimationFrame(id)); };
  }, [W, H, data]);

  /* ── UNIFIED CLICK HANDLER ── */
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const mx = e.clientX, my = e.clientY;
    let best: { node: NetworkNode; dist: number } | null = null;

    // Check Pandora scene targets first (they're bigger, more satisfying to click)
    sceneRef.current.forEach(tgt => {
      const d = Math.sqrt((tgt.cx - mx) ** 2 + (tgt.cy - my) ** 2);
      if (d < tgt.r && (!best || d < best.dist)) best = { node: tgt.node, dist: d };
    });

    // Then check data nodes
    nodesRef.current.forEach(n => {
      if (n.opacity < 0.1) return;
      const d = Math.sqrt((n.cx - mx) ** 2 + (n.cy - my) ** 2);
      if (d < 60 && (!best || d < best.dist)) best = { node: n, dist: d };
    });

    if (best) {
      const b = best as { node: NetworkNode; dist: number };
      setHovered(prev => prev?.node.id === b.node.id ? null : { node: b.node, x: mx, y: my });
    } else {
      setHovered(null);
    }
  }, []);

  const canvasBase: React.CSSProperties = { position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none" };

  return (
    <>
      {/* Layer 0: Pandora scene */}
      <canvas ref={bgRef}   style={{ ...canvasBase, zIndex: 0 }} />
      {/* Layer 1: God rays (CSS div, handled below) */}
      {/* Layer 2: Spores */}
      <canvas ref={prtRef}  style={{ ...canvasBase, zIndex: 2 }} />
      {/* Layer 3: Falling leaves */}
      <canvas ref={lvRef}   style={{ ...canvasBase, zIndex: 3 }} />
      {/* Layer 4: Data nodes — receives clicks */}
      <canvas ref={dataRef} style={{ ...canvasBase, zIndex: 4, pointerEvents: "auto", cursor: "pointer" }} onClick={handleClick} />

      {/* CSS overlays */}
      <div style={{
        position:"fixed", top:"-10%", left:"50%", transform:"translateX(-50%)",
        width:"220%", height:"130%", zIndex:1, pointerEvents:"none",
        background:`conic-gradient(from 255deg at 42% 0%,
          transparent 0deg, rgba(90,40,200,0.05) 2deg, transparent 5deg,
          transparent 11deg, rgba(60,160,255,0.04) 13deg, transparent 16deg,
          transparent 22deg, rgba(140,60,255,0.04) 25deg, transparent 28deg,
          transparent 35deg, rgba(40,210,180,0.03) 38deg, transparent 41deg,
          transparent 48deg, rgba(100,50,220,0.03) 51deg, transparent 54deg,
          transparent 62deg, rgba(70,190,255,0.04) 65deg, transparent 68deg)`,
        animation:"rayR 50s linear infinite", mixBlendMode:"screen",
      }} />
      <div style={{
        position:"fixed", bottom:0, left:0, width:"100%", height:"32%",
        zIndex:5, pointerEvents:"none",
        background:`repeating-linear-gradient(180deg,
          transparent 0px, transparent 2px,
          rgba(30,120,200,0.07) 2px, rgba(30,120,200,0.07) 3px,
          transparent 3px, transparent 6px,
          rgba(20,80,160,0.04) 6px, rgba(20,80,160,0.04) 7px)`,
        animation:"wShim 6s ease-in-out infinite alternate",
      }} />
      <div style={{
        position:"fixed", inset:0, zIndex:6, pointerEvents:"none",
        background:"radial-gradient(ellipse 85% 85% at 50% 50%, transparent 25%, rgba(1,5,15,0.45) 70%, rgba(0,2,10,0.88) 100%)",
      }} />
      <style>{`
        @keyframes rayR { from{transform:translateX(-50%) rotate(0deg)} to{transform:translateX(-50%) rotate(360deg)} }
        @keyframes wShim { 0%{opacity:0.5;transform:scaleX(1) translateX(0)} 50%{opacity:0.8;transform:scaleX(1.008) translateX(-3px)} 100%{opacity:0.5;transform:scaleX(0.995) translateX(2px)} }
      `}</style>

      {hovered && <NodeTooltip node={hovered.node} x={hovered.x} y={hovered.y} />}
    </>
  );
}