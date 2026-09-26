"""Road network from OpenStreetMap.

OSM is the only road source that needs no credentials and no manual export,
which matters because the GSI and Survey of India portals are not reachable
from outside India. Geometry quality on NH-10 is good; attribute quality
(lane counts, surface) is not, so we use OSM for centrelines only.
"""

from __future__ import annotations

import logging
from pathlib import Path

import geopandas as gpd
import osmnx as ox
from shapely.geometry import LineString, Point, shape
from shapely.ops import substring

from ingestion.aoi import AOI

log = logging.getLogger(__name__)

# The corridor's alerting unit. Everything downstream keys off these.
CHAINAGE_M = 1000.0

# 'trunk' is how NH-10 is tagged; 'primary' catches state highways feeding it.
HIGHWAY_CLASSES = ["motorway", "trunk", "primary", "secondary"]


def fetch_roads(aoi: AOI, out_path: Path | None = None) -> gpd.GeoDataFrame:
    """All significant roads in the AOI, in the AOI's metric CRS."""
    min_lon, min_lat, max_lon, max_lat = aoi.bbox
    gdf = ox.features_from_bbox(
        bbox=(min_lon, min_lat, max_lon, max_lat),
        tags={"highway": HIGHWAY_CLASSES},
    )
    gdf = gdf[gdf.geometry.geom_type.isin(["LineString", "MultiLineString"])]

    keep = [c for c in ("highway", "name", "ref", "lanes", "surface", "geometry")
            if c in gdf.columns]
    gdf = gdf[keep].reset_index(drop=True).to_crs(aoi.utm_crs)

    # Overpass returns whole ways that merely intersect the bbox, so they run past the
    # study area. Chainage built on those would extend beyond the DEM and the segments
    # would carry terrain values we never computed.
    clip = gpd.GeoDataFrame(geometry=[shape(aoi.geojson)], crs="EPSG:4326").to_crs(aoi.utm_crs)
    km_before = gdf.geometry.length.sum() / 1000
    gdf = gdf.clip(clip).reset_index(drop=True)
    gdf = gdf[~gdf.geometry.is_empty & gdf.geometry.notna()]

    # Clipping trims geometry rather than dropping rows, so length is the honest measure.
    log.info(
        "fetched %d road features in %d classes; %.1f km -> %.1f km after clipping to the AOI",
        len(gdf), gdf["highway"].nunique(), km_before, gdf.geometry.length.sum() / 1000
    )
    if out_path:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        gdf.to_parquet(out_path)
    return gdf


def _as_str(value) -> str:
    """OSM 'ref' is sometimes a list when a way carries several designations."""
    if isinstance(value, list):
        return ";".join(str(v) for v in value)
    return "" if value is None else str(value)


def select_highway(roads: gpd.GeoDataFrame, ref_contains: str = "NH10") -> gpd.GeoDataFrame:
    """Pick one designated highway out of the network by its `ref` tag."""
    if "ref" not in roads.columns:
        return roads.iloc[0:0]
    wanted = ref_contains.replace(" ", "").replace("-", "").upper()
    refs = roads["ref"].map(_as_str).str.replace(r"[\s-]", "", regex=True).str.upper()
    return roads[refs.str.contains(wanted, na=False)].copy()


def corridor_path(
    highway: gpd.GeoDataFrame, start: tuple[float, float] | None = None,
) -> LineString:
    """The highway as one continuous line, start to end.

    OSM draws a highway as dozens of ways: dual carriageways, both directions of
    a one-way pair, slip roads, and pieces that overlap where two ways were
    mapped over each other. Merging them does not give one line; it gives
    several, and chaining those end to end makes the kilometre count jump
    between distant places, run backwards, and count stretches twice.

    Instead the ways become a graph, and the corridor is the shortest path
    along it from `start` (a point in the highway's CRS) to the node furthest
    from it. With no `start`, the path runs between the two ends furthest
    apart, which is what an unnamed highway should mean by its length.
    """
    import networkx as nx

    def node(c: tuple[float, ...]) -> tuple[float, float]:
        # Decimetre rounding joins ways whose shared node was written twice.
        return (round(c[0], 1), round(c[1], 1))

    graph = nx.Graph()
    for geom in highway.geometry:
        for line in getattr(geom, "geoms", [geom]):
            coords = list(line.coords)
            for a, b in zip(coords, coords[1:], strict=False):
                if node(a) != node(b):
                    graph.add_edge(node(a), node(b), weight=Point(a).distance(Point(b)))
    if graph.number_of_nodes() == 0:
        raise ValueError("highway has no line geometry")

    # A corridor is one road; a gap in OSM would otherwise pick the larger half
    # silently, so it is refused rather than guessed across.
    if not nx.is_connected(graph):
        sizes = sorted((len(c) for c in nx.connected_components(graph)), reverse=True)
        raise ValueError(f"highway is not one connected road: components of {sizes[:5]} nodes")

    nodes = list(graph.nodes)
    if start is None:
        # Double sweep: the node furthest from anywhere is one end; the node
        # furthest from that is the other.
        first = max(nx.single_source_dijkstra_path_length(graph, nodes[0]).items(),
                    key=lambda kv: kv[1])[0]
    else:
        first = min(nodes, key=lambda n: (n[0] - start[0]) ** 2 + (n[1] - start[1]) ** 2)
    distance, paths = nx.single_source_dijkstra(graph, first)
    last = max(distance, key=distance.get)
    return LineString(paths[last])


def build_chainage(
    highway: gpd.GeoDataFrame,
    highway_code: str,
    spacing_m: float = CHAINAGE_M,
    start_lonlat: tuple[float, float] | None = None,
) -> gpd.GeoDataFrame:
    """Cut a highway into fixed-length segments — the unit alerts are issued against.

    Chainage is measured along one continuous path (see `corridor_path`), so km
    N is N kilometres from the start along the road, every segment is distinct,
    and the numbering only ever increases in the direction of travel.
    `start_lonlat` pins where km 0 is; without it, one end of the road is chosen.
    """
    start = None
    if start_lonlat is not None:
        start_point = gpd.GeoSeries([Point(start_lonlat)], crs="EPSG:4326").to_crs(highway.crs)
        start = (start_point.iloc[0].x, start_point.iloc[0].y)
    path = corridor_path(highway, start)

    rows, offset = [], 0.0
    while offset < path.length:
        end = min(offset + spacing_m, path.length)
        piece = substring(path, offset, end)
        if piece.length > 1.0:  # drop a sliver at the very end of the road
            rows.append({
                "highway_code": highway_code,
                "chainage_km": round(offset / 1000.0, 3),
                "length_m": round(piece.length, 1),
                "geometry": piece,
            })
        offset = end

    out = gpd.GeoDataFrame(rows, crs=highway.crs)
    log.info("built %d segments covering %.1f km", len(out), out["length_m"].sum() / 1000)
    return out
