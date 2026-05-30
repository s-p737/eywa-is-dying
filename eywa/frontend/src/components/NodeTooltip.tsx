"use client";
import { NetworkNode } from "@/lib/api";

interface TooltipProps {
  node: NetworkNode;
  x: number;
  y: number;
}

const SOURCE_COLORS: Record<string, string> = {
  "Global Forest Watch": "#00c4a7",
  "IUCN Red List":       "#c8a04a",
  "NASA / NOAA":         "#ff6b35",
};

const TYPE_ICONS: Record<string, string> = {
  forest:  "◈",
  species: "◉",
  carbon:  "◎",
};

const IUCN_EXPLANATIONS: Record<string, string> = {
  "EX":  "Extinct — no individuals remain anywhere on Earth.",
  "EW":  "Extinct in the Wild — survives only in captivity.",
  "CR":  "Critically Endangered — faces an extremely high risk of extinction in the wild.",
  "EN":  "Endangered — faces a very high risk of extinction in the wild.",
  "VU":  "Vulnerable — faces a high risk of extinction if threats continue.",
  "NT":  "Near Threatened — close to qualifying as threatened in the near future.",
  "LC":  "Least Concern — population is stable; not currently at risk.",
  "DD":  "Data Deficient — not enough information to assess extinction risk.",
};

function getExplanation(node: NetworkNode): string {
  if (node.type === "forest") {
    return "Mha = million hectares. One hectare is about 2.5 acres — the size of a city block. This node represents a region where that much forest cover was lost in a single year.";
  }
  if (node.type === "carbon") {
    return "ppm = parts per million. This measures how much CO₂ is in the atmosphere. Pre-industrial levels were ~280 ppm. We crossed 400 ppm in 2013 and have not gone back.";
  }
  if (node.type === "species") {
    // Try to extract IUCN status from the stat or context string
    const stat = node.tooltip.stat ?? "";
    for (const code of Object.keys(IUCN_EXPLANATIONS)) {
      if (stat.includes(code)) {
        return `IUCN Status ${code}: ${IUCN_EXPLANATIONS[code]}`;
      }
    }
    return "IUCN Red List categories rank species by extinction risk, from Least Concern to Extinct. This species has been assessed as facing significant threat.";
  }
  return "";
}

export default function NodeTooltip({ node, x, y }: TooltipProps) {
  const { tooltip, type, alive } = node;
  const accent = SOURCE_COLORS[tooltip.source] ?? "#00c4a7";
  const explanation = getExplanation(node);

  const leftStyle = x > window.innerWidth - 260 ? { right: window.innerWidth - x + 12 } : { left: x + 16 };
  const topStyle = y > window.innerHeight - 200 ? { bottom: window.innerHeight - y + 8 } : { top: y - 8 };

  return (
    <div
      style={{
        position: "fixed",
        ...leftStyle,
        ...topStyle,
        zIndex: 100,
        pointerEvents: "none",
        maxWidth: 260,
        background: "rgba(2,8,10,0.92)",
        border: `1px solid ${accent}30`,
        borderTop: `2px solid ${accent}`,
        padding: "14px 16px",
        fontFamily: "'EB Garamond', Georgia, serif",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ color: accent, fontSize: 16 }}>{TYPE_ICONS[type]}</span>
        <span style={{
          fontFamily: "'Cinzel', serif",
          fontSize: 11,
          letterSpacing: "0.08em",
          color: "#fff",
          fontWeight: 600,
        }}>
          {tooltip.title}
        </span>
        {!alive && (
          <span style={{
            marginLeft: "auto",
            fontSize: 9,
            letterSpacing: "0.2em",
            fontFamily: "'Cinzel', serif",
            color: "#c0392b",
            background: "rgba(192,57,43,0.12)",
            padding: "2px 6px",
          }}>
            LOST
          </span>
        )}
      </div>

      {/* Stat */}
      <div style={{
        fontSize: 13,
        color: accent,
        marginBottom: 8,
        fontWeight: 500,
      }}>
        {tooltip.stat}
      </div>

      {/* Original context from API */}
      {tooltip.context && (
        <div style={{
          fontSize: 12,
          color: "#7ab0a8",
          lineHeight: 1.5,
          marginBottom: 8,
          borderTop: "1px solid rgba(255,255,255,0.05)",
          paddingTop: 8,
        }}>
          {tooltip.context}
        </div>
      )}

      {/* Plain-English explanation */}
      {explanation && (
        <div style={{
          fontSize: 11,
          color: "#5a8a82",
          lineHeight: 1.5,
          marginBottom: 10,
          borderTop: "1px solid rgba(255,255,255,0.04)",
          paddingTop: 8,
          fontStyle: "italic",
        }}>
          {explanation}
        </div>
      )}

      {/* Source */}
      <div style={{
        fontFamily: "'Cinzel', serif",
        fontSize: 9,
        letterSpacing: "0.3em",
        color: accent,
        opacity: 0.5,
        textTransform: "uppercase",
      }}>
        {tooltip.source}
      </div>
    </div>
  );
}