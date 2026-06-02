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

interface SceneTarget {
  id: string;
  cx: number; cy: number; r: number;
  node: NetworkNode;
}

function makeSyntheticNode(
  id: string,
  type: "forest" | "species" | "carbon",
  title: string,
  stat: string,
  context: string,
  lat: number,
  lon: number
): NetworkNode {
  return {
    id,
    type,
    lat,
    lon,
    alive: true,
    color: type === "forest" ? "teal" : type === "species" ? "gold" : "red",
    label: title,
    value: 1,
    tooltip: {
      title,
      stat,
      context,
      source: type === "forest" ? "Global Forest Watch" : type === "species" ? "IUCN Red List" : "NASA / NOAA",
    },
  };
}

export default function EywaCanvas({ data, scrollRatio }: EywaCanvasProps) {
  const bgRef = useRef<HTMLCanvasElement>(null);
  const prtRef = useRef<HTMLCanvasElement>(null);
  const lvRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<HTMLCanvasElement>(null);

  const nodesRef = useRef<CanvasNode[]>([]);
  const sceneRef = useRef<SceneTarget[]>([]);
  const rafId = useRef<number | null>(null);

  const [hovered, setHovered] = useState<{ node: NetworkNode; x: number; y: number } | null>(null);
  const [W, setW] = useState(0);
  const [H, setH] = useState(0);

  const tRef = useRef(0);
  const degradation = scrollRatio < 0.15 ? 0 : Math.min(1, (scrollRatio - 0.15) / 0.75);
  const degRef = useRef(degradation);

  useEffect(() => { degRef.current = degradation; }, [degradation]);

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
      return {
        ...n,
        cx: Math.max(20, Math.min(W - 20, x + (Math.random() - 0.5) * 30)),
        cy: Math.max(20, Math.min(H - 20, y + (Math.random() - 0.5) * 30)),
        r: n.type === "carbon" ? 4 : n.type === "forest" ? 3.5 : 2.5,
        pulsePhase: (i / data.nodes.length) * Math.PI * 2,
        opacity: 1,
        deadTime: 0,
      };
    });
  }, [data, W, H]);

  /* ── STABLE SCENE DATA ── */
  const rng = (a: number, b: number) => a + Math.random() * (b - a);
  const rngI = (a: number, b: number) => Math.floor(rng(a, b));
  const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;

  const FAR_TREES = useRef(Array.from({ length: 18 }, (_, i) => ({
    x: i / 17 + rng(-0.02, 0.02), h: rng(0.18, 0.38), w: rng(6, 14),
    glowHue: rngI(160, 310), phase: rng(0, Math.PI * 2),
  }))).current;

  const JELLIES = useRef(Array.from({ length: 9 }, (_, i) => ({
    x: 0.2 + i * 0.08, y: 0.1 + Math.random() * 0.3, r: 8 + Math.random() * 15,
    hue: 250 + Math.random() * 60, phase: Math.random() * Math.PI * 2, drift: Math.random()
  }))).current;

  const MUSHROOMS = useRef(Array.from({ length: 15 }, (_, i) => ({
    x: Math.random(), y: 0.6 + Math.random() * 0.3, r: 10 + Math.random() * 20,
    hue: Math.random() * 360, phase: Math.random() * Math.PI * 2
  }))).current;

  // ... (Other useRef scene data like WATERFALLS, PLANTS would go here similarly)

  /* ── DRAW HELPERS (Partial list for brevity, same as your logic) ── */
  const drawTreeFull = (ctx: CanvasRenderingContext2D, x: number, baseY: number, trunkH: number, trunkW: number, hue: number, alpha: number, phase: number, t: number) => {
    ctx.fillStyle = `rgba(10, 20, 15, ${alpha})`;
    ctx.fillRect(x - trunkW / 2, baseY - trunkH, trunkW, trunkH);
  };

  /* ── INTERACTION ── */
  const handlePointer = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = dataRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const hit = sceneRef.current.find(t => {
      const dx = t.cx - x, dy = t.cy - y;
      return Math.sqrt(dx * dx + dy * dy) < t.r;
    });

    setHovered(hit ? { node: hit.node, x, y } : null);
  };

  /* ── ANIMATION LOOP ── */
  useEffect(() => {
    const bg = bgRef.current?.getContext("2d");
    const dctx = dataRef.current?.getContext("2d");
    if (!bg || !dctx || W === 0) return;

    const render = (ts: number) => {
      tRef.current = ts * 0.001;
      const t = tRef.current;
      const vitality = Math.max(0, 1 - degRef.current);

      bg.clearRect(0, 0, W, H);
      dctx.clearRect(0, 0, W, H);

      // Background Sky
      bg.fillStyle = `rgb(${10 * (1 - vitality)}, 15, ${25 * vitality})`;
      bg.fillRect(0, 0, W, H);

      // Render Far Trees
      FAR_TREES.forEach(tr => drawTreeFull(bg, tr.x * W, H, tr.h * H, tr.w, tr.glowHue, vitality, tr.phase, t));

      // Render Data Nodes
      nodesRef.current.forEach(n => {
        const colors = NODE_COLORS[n.color as keyof typeof NODE_COLORS];
        dctx.beginPath();
        dctx.arc(n.cx, n.cy, n.r, 0, Math.PI * 2);
        dctx.fillStyle = n.alive ? colors.alive : colors.dead;
        dctx.fill();
      });

      rafId.current = requestAnimationFrame(render);
    };

    rafId.current = requestAnimationFrame(render);
    return () => { if (rafId.current) cancelAnimationFrame(rafId.current); };
  }, [W, H, FAR_TREES]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <canvas ref={bgRef} className="absolute inset-0" />
      <canvas ref={prtRef} className="absolute inset-0" />
      <canvas ref={lvRef} className="absolute inset-0" />
      <canvas 
        ref={dataRef} 
        className="absolute inset-0 cursor-crosshair" 
        onMouseMove={handlePointer}
        onClick={handlePointer}
      />
      {hovered && <NodeTooltip node={hovered.node} x={hovered.x} y={hovered.y} />}
    </div>
  );
}