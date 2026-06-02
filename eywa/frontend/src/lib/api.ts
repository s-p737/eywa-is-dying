const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface NetworkNode {
  id: string;
  type: "forest" | "species" | "carbon";
  label?: string;
  lat: number;
  lon: number;
  value?: number;
  color: "teal" | "gold" | "red";
  alive: boolean;
  tooltip: {
    title: string;
    stat: string;
    source: string;
    context: string;
  };
}

export interface NetworkEdge {
  a: string;
  b: string;
  strength: number;
}

export interface NetworkData {
  year: number;
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  integrity: number;
  summary: {
    total_nodes: number;
    alive_nodes: number;
    forest_loss_mha: number;
    threatened_species: number;
    avg_co2_ppm: number;
  };
}

export interface TimeseriesPoint {
  year: number;
  total_mha?: number;
  ppm?: number;
  increase?: number;
}

export async function fetchNetwork(year: number): Promise<NetworkData> {
  const res = await fetch(`${BASE}/api/network?year=${year}`);
  if (!res.ok) throw new Error(`Network fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchForestTimeseries(): Promise<TimeseriesPoint[]> {
  const res = await fetch(`${BASE}/api/forest/timeseries`);
  if (!res.ok) throw new Error("Forest timeseries failed");
  const data = await res.json();
  return data.series;
}

export async function fetchCarbonTimeseries(): Promise<TimeseriesPoint[]> {
  const res = await fetch(`${BASE}/api/carbon/timeseries`);
  if (!res.ok) throw new Error("Carbon timeseries failed");
  const data = await res.json();
  return data.series;
}