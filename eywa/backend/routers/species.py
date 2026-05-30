"""
IUCN Red List API v4
Docs: https://apiv4.iucnredlist.org/

Requires: IUCN_API_TOKEN env var
GET https://apiv4.iucnredlist.org/api/v4/species/page/{page_number}

Rate limit: 10 req/min. We cache aggressively (24h).
"""
import os
import time
import httpx
from fastapi import APIRouter

router = APIRouter()

_cache: dict = {}
CACHE_TTL = 86400

IUCN_BASE = "https://apiv4.iucnredlist.org/api/v4"
IUCN_TOKEN = os.getenv("IUCN_API_TOKEN", "")

# Static fallback — curated 40 species with approximate coords and category
FALLBACK_SPECIES = [
    {"scientific_name": "Panthera tigris",          "common_name": "Tiger",                   "category": "EN", "lat": 20.0,  "lon": 85.0,  "population_trend": -1, "habitat": "Tropical forests, grasslands"},
    {"scientific_name": "Gorilla beringei",         "common_name": "Mountain Gorilla",        "category": "EN", "lat": -1.5,  "lon": 29.5,  "population_trend": 0,  "habitat": "Montane forest, Central Africa"},
    {"scientific_name": "Phocoena sinus",           "common_name": "Vaquita",                 "category": "CR", "lat": 31.0,  "lon": -114.0,"population_trend": -1, "habitat": "Gulf of California"},
    {"scientific_name": "Diceros bicornis",         "common_name": "Black Rhinoceros",        "category": "CR", "lat": -3.0,  "lon": 35.0,  "population_trend": 1,  "habitat": "African savanna and scrubland"},
    {"scientific_name": "Ailuropoda melanoleuca",   "common_name": "Giant Panda",             "category": "VU", "lat": 30.5,  "lon": 103.0, "population_trend": 1,  "habitat": "Temperate broadleaf forest, China"},
    {"scientific_name": "Chelonia mydas",           "common_name": "Green Sea Turtle",        "category": "EN", "lat": 0.0,   "lon": -90.0, "population_trend": -1, "habitat": "Tropical and subtropical seas"},
    {"scientific_name": "Elephas maximus",          "common_name": "Asian Elephant",          "category": "EN", "lat": 12.0,  "lon": 80.0,  "population_trend": -1, "habitat": "Forests and grasslands, South Asia"},
    {"scientific_name": "Loxodonta africana",       "common_name": "African Savanna Elephant","category": "VU", "lat": -8.0,  "lon": 24.0,  "population_trend": -1, "habitat": "Sub-Saharan savanna"},
    {"scientific_name": "Spheniscus demersus",      "common_name": "African Penguin",         "category": "EN", "lat": -34.0, "lon": 26.0,  "population_trend": -1, "habitat": "Coastal southern Africa"},
    {"scientific_name": "Pongo pygmaeus",           "common_name": "Bornean Orangutan",       "category": "CR", "lat": 0.5,   "lon": 114.0, "population_trend": -1, "habitat": "Lowland rainforest, Borneo"},
    {"scientific_name": "Pongo abelii",             "common_name": "Sumatran Orangutan",      "category": "CR", "lat": 3.5,   "lon": 97.5,  "population_trend": -1, "habitat": "Lowland peat-swamp forest"},
    {"scientific_name": "Trichechus manatus",       "common_name": "West Indian Manatee",     "category": "VU", "lat": 18.0,  "lon": -66.0, "population_trend": -1, "habitat": "Coastal Caribbean waters"},
    {"scientific_name": "Acipenser sturio",         "common_name": "European Sturgeon",       "category": "CR", "lat": 45.5,  "lon": -0.5,  "population_trend": -1, "habitat": "Atlantic rivers and estuaries"},
    {"scientific_name": "Gymnogyps californianus",  "common_name": "California Condor",       "category": "CR", "lat": 36.0,  "lon": -119.0,"population_trend": 1,  "habitat": "Cliffs and open country, California"},
    {"scientific_name": "Panthera uncia",           "common_name": "Snow Leopard",            "category": "VU", "lat": 38.0,  "lon": 75.0,  "population_trend": -1, "habitat": "Central Asian mountain ranges"},
    {"scientific_name": "Okapia johnstoni",         "common_name": "Okapi",                   "category": "EN", "lat": 1.5,   "lon": 28.5,  "population_trend": -1, "habitat": "Congo Basin rainforest"},
    {"scientific_name": "Eretmochelys imbricata",   "common_name": "Hawksbill Sea Turtle",    "category": "CR", "lat": 10.0,  "lon": 50.0,  "population_trend": -1, "habitat": "Tropical coral reefs"},
    {"scientific_name": "Rhincodon typus",          "common_name": "Whale Shark",             "category": "EN", "lat": -5.0,  "lon": 80.0,  "population_trend": -1, "habitat": "Open tropical oceans"},
    {"scientific_name": "Ateles geoffroyi",         "common_name": "Geoffroy's Spider Monkey","category": "EN", "lat": 10.0,  "lon": -84.0, "population_trend": -1, "habitat": "Central American rainforest"},
    {"scientific_name": "Tapirus indicus",          "common_name": "Malayan Tapir",           "category": "EN", "lat": 4.0,   "lon": 102.0, "population_trend": -1, "habitat": "Lowland rainforest, SE Asia"},
    {"scientific_name": "Vultur gryphus",           "common_name": "Andean Condor",           "category": "VU", "lat": -15.0, "lon": -72.0, "population_trend": -1, "habitat": "Andean mountain ridges"},
    {"scientific_name": "Mandrillus sphinx",        "common_name": "Mandrill",                "category": "VU", "lat": 0.5,   "lon": 12.0,  "population_trend": -1, "habitat": "West African rainforest"},
    {"scientific_name": "Lutra lutra",              "common_name": "Eurasian Otter",          "category": "NT", "lat": 55.0,  "lon": 20.0,  "population_trend": 0,  "habitat": "Rivers and lakes, Eurasia"},
    {"scientific_name": "Ursus maritimus",          "common_name": "Polar Bear",              "category": "VU", "lat": 80.0,  "lon": -10.0, "population_trend": -1, "habitat": "Arctic sea ice"},
    {"scientific_name": "Panthera onca",            "common_name": "Jaguar",                  "category": "NT", "lat": -5.0,  "lon": -60.0, "population_trend": -1, "habitat": "Amazon and Pantanal"},
    {"scientific_name": "Carcharodon carcharias",   "common_name": "Great White Shark",       "category": "VU", "lat": -34.0, "lon": 26.0,  "population_trend": -1, "habitat": "Temperate coastal ocean"},
    {"scientific_name": "Dermochelys coriacea",     "common_name": "Leatherback Sea Turtle",  "category": "VU", "lat": 8.0,   "lon": -63.0, "population_trend": -1, "habitat": "Open ocean, Atlantic"},
    {"scientific_name": "Hippopotamus amphibius",   "common_name": "Common Hippopotamus",     "category": "VU", "lat": -2.0,  "lon": 29.0,  "population_trend": -1, "habitat": "Sub-Saharan rivers and lakes"},
    {"scientific_name": "Ceratotherium simum",      "common_name": "White Rhinoceros",        "category": "NT", "lat": -24.0, "lon": 31.0,  "population_trend": -1, "habitat": "Southern African savanna"},
    {"scientific_name": "Gavialis gangeticus",      "common_name": "Gharial",                 "category": "CR", "lat": 27.0,  "lon": 84.0,  "population_trend": -1, "habitat": "Ganges river system"},
    {"scientific_name": "Helarctos malayanus",      "common_name": "Sun Bear",                "category": "VU", "lat": 2.5,   "lon": 114.0, "population_trend": -1, "habitat": "Tropical rainforest, SE Asia"},
    {"scientific_name": "Panthera leo",             "common_name": "Lion",                    "category": "VU", "lat": -2.0,  "lon": 34.0,  "population_trend": -1, "habitat": "Sub-Saharan savanna"},
    {"scientific_name": "Acinonyx jubatus",         "common_name": "Cheetah",                 "category": "VU", "lat": -22.0, "lon": 22.0,  "population_trend": -1, "habitat": "African open savanna"},
    {"scientific_name": "Lycaon pictus",            "common_name": "African Wild Dog",        "category": "EN", "lat": -18.0, "lon": 26.0,  "population_trend": -1, "habitat": "Open woodland, Sub-Saharan Africa"},
    {"scientific_name": "Saiga tatarica",           "common_name": "Saiga Antelope",          "category": "CR", "lat": 49.0,  "lon": 55.0,  "population_trend": -1, "habitat": "Central Asian steppe"},
    {"scientific_name": "Presbytis comata",         "common_name": "Javan Langur",            "category": "EN", "lat": -7.5,  "lon": 110.0, "population_trend": -1, "habitat": "Java lowland forest"},
    {"scientific_name": "Delphinapterus leucas",    "common_name": "Beluga Whale",            "category": "LC", "lat": 72.0,  "lon": -80.0, "population_trend": -1, "habitat": "Arctic and subarctic waters"},
    {"scientific_name": "Zalophus wollebaeki",      "common_name": "Galapagos Sea Lion",      "category": "EN", "lat": -0.5,  "lon": -90.5, "population_trend": -1, "habitat": "Galapagos Islands"},
    {"scientific_name": "Neofelis diardi",          "common_name": "Sunda Clouded Leopard",   "category": "VU", "lat": 1.0,   "lon": 110.0, "population_trend": -1, "habitat": "Lowland forests of Borneo"},
    {"scientific_name": "Tapirus bairdii",          "common_name": "Baird's Tapir",           "category": "EN", "lat": 9.0,   "lon": -83.0, "population_trend": -1, "habitat": "Central American tropical forest"},
]

THREATENED_CATEGORIES = {"EX", "EW", "CR", "EN", "VU"}


async def get_threatened_species():
    cache_key = "species_all"
    now = time.time()
    if cache_key in _cache and now - _cache[cache_key][0] < CACHE_TTL:
        return _cache[cache_key][1]

    if IUCN_TOKEN:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    f"{IUCN_BASE}/species/page/0",
                    params={"token": IUCN_TOKEN}
                )
                if resp.status_code == 200:
                    raw = resp.json()
                    species_list = []
                    for sp in raw.get("result", [])[:40]:
                        species_list.append({
                            "scientific_name": sp.get("scientific_name", ""),
                            "common_name": sp.get("main_common_name", sp.get("scientific_name", "")),
                            "category": sp.get("category", "LC"),
                            "lat": sp.get("lat", 0),
                            "lon": sp.get("lon", 0),
                            "population_trend": -1 if sp.get("population_trend") == "Decreasing" else (
                                1 if sp.get("population_trend") == "Increasing" else 0
                            ),
                            "habitat": "",
                        })
                    total = raw.get("count", len(species_list))
                    data = {
                        "species": species_list,
                        "total_threatened": total,
                    }
                    _cache[cache_key] = (now, data)
                    return data
        except Exception:
            pass

    threatened = [s for s in FALLBACK_SPECIES if s["category"] in THREATENED_CATEGORIES]
    data = {
        "species": FALLBACK_SPECIES,
        "total_threatened": 44016,  # IUCN published figure
    }
    _cache[cache_key] = (now, data)
    return data


@router.get("/threatened")
async def threatened_endpoint():
    return await get_threatened_species()


@router.get("/categories")
async def categories_breakdown():
    data = await get_threatened_species()
    counts = {}
    for sp in data["species"]:
        cat = sp["category"]
        counts[cat] = counts.get(cat, 0) + 1
    return {"categories": counts, "total_threatened": data["total_threatened"]}