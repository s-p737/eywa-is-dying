"use client";
import { useState, useEffect, useCallback } from "react";
import { fetchNetwork, NetworkData } from "@/lib/api";

export function useNetwork(year: number) {
  const [data, setData] = useState<NetworkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await fetchNetwork(year);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load network");
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, refetch: load };
}