"""Area of interest definitions.

Start with the pilot corridor only. A region-wide AOI makes every download
roughly 100x slower for no extra insight during development.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class AOI:
    name: str
    bbox: tuple[float, float, float, float]  # (min_lon, min_lat, max_lon, max_lat)
    utm_crs: str
    description: str

    @property
    def geojson(self) -> dict:
        min_lon, min_lat, max_lon, max_lat = self.bbox
        return {
            "type": "Polygon",
            "coordinates": [[
                [min_lon, min_lat], [max_lon, min_lat],
                [max_lon, max_lat], [min_lon, max_lat], [min_lon, min_lat],
            ]],
        }

    @property
    def wkt(self) -> str:
        min_lon, min_lat, max_lon, max_lat = self.bbox
        return (
            f"POLYGON(({min_lon} {min_lat}, {max_lon} {min_lat}, "
            f"{max_lon} {max_lat}, {min_lon} {max_lat}, {min_lon} {min_lat}))"
        )


# Pilot corridor — the most landslide-prone strategic highway in the country.
NH10_SEVOKE_GANGTOK = AOI(
    name="NH10_Sevoke_Gangtok",
    bbox=(88.30, 26.85, 88.85, 27.45),
    utm_crs="EPSG:32645",
    description="NH-10 corridor, Sevoke to Gangtok — approx 60 x 65 km",
)

# Later expansion targets. Do not enable until the pilot works end to end.
SIKKIM = AOI(
    name="Sikkim",
    bbox=(88.00, 27.05, 88.92, 28.13),
    utm_crs="EPSG:32645",
    description="Full state of Sikkim",
)

DEFAULT = NH10_SEVOKE_GANGTOK
