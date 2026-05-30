from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import forest, species, carbon

app = FastAPI(title="Eywa API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://eywa-is-dying.vercel.app"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(forest.router, prefix="/api/forest", tags=["forest"])
app.include_router(species.router, prefix="/api/species", tags=["species"])
app.include_router(carbon.router, prefix="/api/carbon", tags=["carbon"])


@app.get("/api/health")
def health():
    return {"status": "alive"}


@app.get("/api/network")
async def get_network(year: int = 2023):
    """
    Aggregates all three data sources into a single
    node/edge payload for the canvas network.
    Year range: 2001-2023
    """
    from routers.forest import get_forest_loss
    from routers.species import get_threatened_species
    from routers.carbon import get_co2

    forest_data = await get_forest_loss(year)
    species_data = await get_threatened_species()
    carbon_data = await get_co2(year)

    nodes = []
    edges = []

    # Forest nodes — one per region with loss magnitude driving size
    for i, region in enumerate(forest_data["regions"]):
        nodes.append({
            "id": f"forest_{i}",
            "type": "forest",
            "label": region["name"],
            "lat": region["lat"],
            "lon": region["lon"],
            "value": region["loss_mha"],         # million hectares
            "year": year,
            "color": "teal",
            "alive": region["loss_mha"] < region["baseline_mha"] * 1.5,
            "tooltip": {
                "title": region["name"],
                "stat": f"{region['loss_mha']:.2f} Mha lost in {year}",
                "source": "Global Forest Watch",
                "context": region.get("context", ""),
            }
        })

    # Species nodes
    for i, sp in enumerate(species_data["species"][:40]):
        nodes.append({
            "id": f"species_{i}",
            "type": "species",
            "label": sp["scientific_name"],
            "lat": sp.get("lat", 0),
            "lon": sp.get("lon", 0),
            "value": sp["population_trend"],      # -1 decreasing, 0 stable, 1 increasing
            "color": "gold",
            "alive": sp["category"] not in ("EX", "EW"),
            "tooltip": {
                "title": sp["common_name"],
                "stat": f"IUCN status: {sp['category']}",
                "source": "IUCN Red List",
                "context": sp.get("habitat", ""),
            }
        })

    # Carbon nodes — 5 atmospheric measurement stations
    for i, station in enumerate(carbon_data["stations"]):
        nodes.append({
            "id": f"carbon_{i}",
            "type": "carbon",
            "label": station["name"],
            "lat": station["lat"],
            "lon": station["lon"],
            "value": station["ppm"],
            "color": "red",
            "alive": station["ppm"] < 420,
            "tooltip": {
                "title": station["name"],
                "stat": f"{station['ppm']:.1f} ppm CO₂",
                "source": "NASA / NOAA",
                "context": f"Annual mean for {year}",
            }
        })

    # Edges: connect nearby nodes of different types (cross-system relationships)
    import math
    for i, a in enumerate(nodes):
        for j, b in enumerate(nodes[i+1:], i+1):
            if a["type"] == b["type"]:
                continue
            dlat = a["lat"] - b["lat"]
            dlon = a["lon"] - b["lon"]
            dist = math.sqrt(dlat**2 + dlon**2)
            if dist < 25:  # ~25 degree proximity
                edges.append({"a": a["id"], "b": b["id"], "strength": max(0, 1 - dist/25)})

    alive_count = sum(1 for n in nodes if n["alive"])
    integrity = round(alive_count / len(nodes) * 100) if nodes else 100

    return {
        "year": year,
        "nodes": nodes,
        "edges": edges,
        "integrity": integrity,
        "summary": {
            "total_nodes": len(nodes),
            "alive_nodes": alive_count,
            "forest_loss_mha": sum(r["loss_mha"] for r in forest_data["regions"]),
            "threatened_species": species_data["total_threatened"],
            "avg_co2_ppm": carbon_data["global_mean_ppm"],
        }
    }