"use client";
import { useEffect, useRef, useState } from "react";
import { fetchForestTimeseries, fetchCarbonTimeseries, TimeseriesPoint } from "@/lib/api";

interface YearSliderProps {
  year: number;
  onChange: (year: number) => void;
}

export default function YearSlider({ year, onChange }: YearSliderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [forestSeries, setForestSeries] = useState<TimeseriesPoint[]>([]);
  const [carbonSeries, setCarbonSeries] = useState<TimeseriesPoint[]>([]);

  useEffect(() => {
    Promise.all([fetchForestTimeseries(), fetchCarbonTimeseries()])
      .then(([f, c]) => { setForestSeries(f); setCarbonSeries(c); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || forestSeries.length === 0) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const pad = { l: 4, r: 4, t: 4, b: 4 };
    const chartW = W - pad.l - pad.r;
    const chartH = H - pad.t - pad.b;

    const years = forestSeries.map(d => d.year);
    const minY = 2001, maxY = 2023;

    // Draw forest loss area (teal)
    const fVals = forestSeries.map(d => d.total_mha ?? 0);
    const maxF = Math.max(...fVals);
    ctx.beginPath();
    forestSeries.forEach((d, i) => {
      const x = pad.l + ((d.year - minY) / (maxY - minY)) * chartW;
      const y = pad.t + chartH - ((fVals[i] / maxF) * chartH * 0.85);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    // close area
    const lastX = pad.l + ((maxY - minY) / (maxY - minY)) * chartW;
    ctx.lineTo(lastX, pad.t + chartH);
    ctx.lineTo(pad.l, pad.t + chartH);
    ctx.closePath();
    ctx.fillStyle = "rgba(0,196,167,0.12)";
    ctx.fill();
    // redraw line
    ctx.beginPath();
    forestSeries.forEach((d, i) => {
      const x = pad.l + ((d.year - minY) / (maxY - minY)) * chartW;
      const y = pad.t + chartH - ((fVals[i] / maxF) * chartH * 0.85);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "rgba(0,196,167,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Vertical line for selected year
    const selX = pad.l + ((year - minY) / (maxY - minY)) * chartW;
    ctx.beginPath();
    ctx.moveTo(selX, pad.t);
    ctx.lineTo(selX, pad.t + chartH);
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [forestSeries, year]);

  const currentForest = forestSeries.find(d => d.year === year);
  const currentCarbon = carbonSeries.find(d => d.year === year);

  return (
    <div style={{
      position: "fixed",
      bottom: 32,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 50,
      width: "min(560px, 90vw)",
      background: "rgba(2,8,10,0.88)",
      border: "1px solid rgba(0,196,167,0.15)",
      padding: "16px 20px",
      backdropFilter: "blur(12px)",
      fontFamily: "'EB Garamond', Georgia, serif",
    }}>
      {/* Mini chart */}
      <canvas
        ref={canvasRef}
        width={520}
        height={36}
        style={{ width: "100%", height: 36, display: "block", marginBottom: 10 }}
      />

      {/* Slider */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{
          fontFamily: "'Cinzel', serif",
          fontSize: 10,
          letterSpacing: "0.25em",
          color: "#4a7a72",
          minWidth: 28,
        }}>2001</span>
        <input
          type="range"
          min={2001}
          max={2023}
          value={year}
          step={1}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            flex: 1,
            appearance: "none",
            height: 1,
            background: `linear-gradient(to right, #00c4a7 0%, #00c4a7 ${((year - 2001) / 22) * 100}%, rgba(255,255,255,0.1) ${((year - 2001) / 22) * 100}%, rgba(255,255,255,0.1) 100%)`,
            outline: "none",
            cursor: "pointer",
          }}
        />
        <span style={{
          fontFamily: "'Cinzel', serif",
          fontSize: 10,
          letterSpacing: "0.25em",
          color: "#4a7a72",
          minWidth: 28,
          textAlign: "right",
        }}>2023</span>
      </div>

      {/* Year label + data snippets */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
        <span style={{
          fontFamily: "'Cinzel', serif",
          fontSize: 22,
          fontWeight: 600,
          color: "#fff",
          letterSpacing: "0.04em",
        }}>{year}</span>
        <div style={{ display: "flex", gap: 20, fontSize: 12, color: "#7ab0a8" }}>
          {currentForest && (
            <span>
              <span style={{ color: "#00c4a7", marginRight: 4 }}>◈</span>
              {currentForest.total_mha?.toFixed(1)} Mha lost
            </span>
          )}
          {currentCarbon && (
            <span>
              <span style={{ color: "#ff6b35", marginRight: 4 }}>◎</span>
              {currentCarbon.ppm} ppm CO₂
            </span>
          )}
        </div>
      </div>
    </div>
  );
}