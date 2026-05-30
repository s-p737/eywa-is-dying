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
  cx: number;
  cy: number;
  r: number;
  pulsePhase: number;
  opacity: number;
  deadTime: number;
}

export default function EywaCanvas({ data, scrollRatio }: EywaCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<CanvasNode[]>([]);
  const rafRef = useRef<number>(0);
  const [hovered, setHovered] = useState<{ node: NetworkNode; x: number; y: number } | null>(null);
  const [W, setW] = useState(0);
  const [H, setH] = useState(0);

  useEffect(() => {
    if (!data || W === 0) return;
    nodesRef.current = data.nodes.map((n, i) => {
      const { x, y } = project(n.lat, n.lon, W, H);
      const jitter = 30;
      const jx = (Math.random() - 0.5) * jitter;
      const jy = (Math.random() - 0.5) * jitter;
      return {
        ...n,
        cx: Math.max(20, Math.min(W - 20, x + jx)),
        cy: Math.max(20, Math.min(H - 20, y + jy)),
        r: n.type === "carbon" ? 4 : n.type === "forest" ? 3.5 : 2.5,
        pulsePhase: (i / data.nodes.length) * Math.PI * 2,
        opacity: 1,
        deadTime: 0,
      };
    });
  }, [data, W, H]);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
    setW(w);
    setH(h);
  }, []);

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [resize]);

  const degradation = scrollRatio < 0.15 ? 0 : Math.min(1, (scrollRatio - 0.15) / 0.75);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    function draw(t: number) {
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      const cnodes = nodesRef.current;

      cnodes.forEach(n => {
        if (n.alive && degradation > 0) {
          if (Math.random() < degradation * 0.0004) {
            n.alive = false;
            n.deadTime = t;
          }
        }
        if (!n.alive) {
          const elapsed = (t - n.deadTime) / 1200;
          n.opacity = Math.max(0, 1 - elapsed * 0.5);
        }
      });

      if (data) {
        const nodeById = new Map(cnodes.map(n => [n.id, n]));
        data.edges.forEach(edge => {
          const na = nodeById.get(edge.a);
          const nb = nodeById.get(edge.b);
          if (!na || !nb) return;
          const op = Math.min(na.opacity, nb.opacity) * edge.strength * 0.15;
          if (op < 0.01) return;
          const alive = na.alive && nb.alive;
          ctx.beginPath();
          ctx.moveTo(na.cx, na.cy);
          ctx.lineTo(nb.cx, nb.cy);
          ctx.strokeStyle = alive ? `rgba(0,196,167,${op})` : `rgba(192,57,43,${op * 0.4})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        });
      }

      cnodes.forEach(n => {
        if (n.opacity < 0.01) return;
        const pulse = Math.sin(t * 0.0018 + n.pulsePhase) * 0.3 + 0.7;
        const colors = NODE_COLORS[n.color];
        const glowStr = colors.glow;
        const gAlpha = n.alive ? (0.15 + pulse * 0.1) * (1 - degradation * 0.5) : 0.04 * n.opacity;
        const glowR = n.r * 10;

        const grd = ctx.createRadialGradient(n.cx, n.cy, 0, n.cx, n.cy, glowR);
        grd.addColorStop(0, `rgba(${glowStr},${gAlpha})`);
        grd.addColorStop(1, `rgba(${glowStr},0)`);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(n.cx, n.cy, glowR, 0, Math.PI * 2);
        ctx.fill();

        const dotColor = n.alive ? colors.alive : colors.dead;
        ctx.beginPath();
        ctx.arc(n.cx, n.cy, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `${dotColor}${Math.round(n.opacity * (n.alive ? 0.9 : 0.3) * 255).toString(16).padStart(2, "0")}`;
        ctx.fill();
      });

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [data, degradation]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const cnodes = nodesRef.current;
    if (!cnodes.length) return;
    const mx = e.clientX, my = e.clientY;
    let nearest: CanvasNode | null = null;
    let minDist = Infinity;
    cnodes.forEach(n => {
      if (n.opacity < 0.1) return;
      const d = Math.sqrt((n.cx - mx) ** 2 + (n.cy - my) ** 2);
      if (d < 60 && d < minDist) { minDist = d; nearest = n; }
    });
    if (nearest) {
      setHovered(prev => prev?.node.id === nearest!.id ? null : { node: nearest!, x: mx, y: my });
    } else {
      setHovered(null);
    }
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 2, cursor: "pointer" }}
        onClick={handleClick}
      />
      {hovered && (
        <NodeTooltip node={hovered.node} x={hovered.x} y={hovered.y} />
      )}
    </>
  );
}