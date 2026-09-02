# Implementation Guide — Step by Step

How to actually build this system, in dependency order, starting from a clean Mac.

Each phase states **what you build**, **the commands**, and a **checkpoint** — a concrete thing that must work before you move on. Do not skip checkpoints; every phase assumes the previous one actually runs.

---

## Contents

- [Build Order at a Glance](#build-order-at-a-glance)
- [Phase 0 — Accounts & Credentials](#phase-0--accounts--credentials-do-this-first)
- [Phase 1 — Local Toolchain](#phase-1--local-toolchain)
- [Phase 2 — Project Skeleton](#phase-2--project-skeleton)
- [Phase 3 — Infrastructure with Docker](#phase-3--infrastructure-with-docker)
- [Phase 4 — Database Schema](#phase-4--database-schema)
- [Phase 5 — Data Ingestion](#phase-5--data-ingestion)
- [Phase 6 — Terrain Feature Engineering](#phase-6--terrain-feature-engineering)
- [Phase 7 — Layer 1: Susceptibility Model](#phase-7--layer-1-susceptibility-model)
- [Phase 8 — Layer 2: Rainfall Trigger Model](#phase-8--layer-2-rainfall-trigger-model)
- [Phase 9 — Layer 3: InSAR Deformation](#phase-9--layer-3-insar-deformation)
- [Phase 10 — Fusion & Exposure](#phase-10--fusion--exposure)
- [Phase 11 — API Layer](#phase-11--api-layer)
- [Phase 12 — Officials' Dashboard](#phase-12--officials-dashboard)
- [Phase 13 — Alerting: SMS & IVR](#phase-13--alerting-sms--ivr)
- [Phase 14 — Citizen App](#phase-14--citizen-app)
- [Phase 15 — Orchestration](#phase-15--orchestration)
- [Phase 16 — Deployment](#phase-16--deployment)
- [Minimum Viable Path](#minimum-viable-path-if-you-are-short-on-time)
- [Common Pitfalls](#common-pitfalls)

---

## Build Order at a Glance

```mermaid
flowchart TD
    P0["Phase 0<br/>Credentials"] --> P1["Phase 1<br/>Toolchain"]
    P1 --> P2["Phase 2<br/>Skeleton"]
    P2 --> P3["Phase 3<br/>Docker infra"]
    P3 --> P4["Phase 4<br/>DB schema"]
    P4 --> P5["Phase 5<br/>Ingestion"]
    P5 --> P6["Phase 6<br/>Terrain features"]
    P6 --> P7["Phase 7<br/>Layer 1 model"]
    P5 --> P8["Phase 8<br/>Layer 2 model"]
    P5 --> P9["Phase 9<br/>Layer 3 InSAR"]
    P7 --> P10["Phase 10<br/>Fusion"]
    P8 --> P10
    P9 --> P10
    P10 --> P11["Phase 11<br/>API"]
    P11 --> P12["Phase 12<br/>Dashboard"]
    P11 --> P13["Phase 13<br/>SMS / IVR"]
    P11 --> P14["Phase 14<br/>Citizen app"]
    P12 --> P15["Phase 15<br/>Orchestration"]
    P13 --> P15
    P14 --> P15
    P15 --> P16["Phase 16<br/>Deployment"]

    style P9 fill:#ffe0e0,stroke:#c00
    style P7 fill:#e0f0ff,stroke:#06c
    style P8 fill:#e0f0ff,stroke:#06c
```

**Phases 7, 8 and 9 are independent of each other** — if you are working in a team, that is the natural three-way split. Phase 9 (InSAR) is shaded red because it is by far the largest time sink; read its section before committing anyone to it.

### Rough effort

| Phase | Effort (solo) | Can run in parallel with |
|---|---|---|
| 0–4 Setup & database | 2–3 days | — |
| 5 Ingestion | 4–6 days | — |
| 6 Terrain features | 3–4 days | 5 |
| 7 Susceptibility model | 5–7 days | 8, 9 |
| 8 Trigger model | 5–7 days | 7, 9 |
| 9 InSAR | 7–14 days | 7, 8 |
| 10 Fusion | 3–4 days | — |
| 11 API | 4–5 days | — |
| 12 Dashboard | 6–8 days | 13, 14 |
| 13 Alerting | 2–3 days | 12, 14 |
| 14 Citizen app | 6–8 days | 12, 13 |
| 15–16 Orchestration & deploy | 3–5 days | — |

---

## Phase 0 — Accounts & Credentials (do this first)

**Do this before writing any code.** Two of these take days to approve, and discovering that on the day you need the data will cost you a week.

| Account | Sign up at | Approval time | Needed for |
|---|---|---|---|
| **Google Earth Engine** | `earthengine.google.com/signup` — register a *non-commercial / research* project | **1–7 days** ⚠️ | Almost everything raster |
| **NASA Earthdata** | `urs.earthdata.nasa.gov` | Instant | GPM IMERG rainfall, SMAP soil moisture |
| **Copernicus Data Space** | `dataspace.copernicus.eu` | Instant | Sentinel-1 SLC, Sentinel-2 |
| **ASF Vertex** | `search.asf.alaska.edu` (uses Earthdata login) | Instant | Sentinel-1 SLC — better download speeds than CDSE |
| **MSG91 or Twilio** | `msg91.com` / `twilio.com` | Instant (trial) | SMS + IVR |
| **GSI Bhukosh** | `bhukosh.gsi.gov.in` | Instant | Landslide inventory |

### Set up the GEE service account

Interactive login works for notebooks, but scheduled jobs need a service account:

```bash
# after your GEE project is approved
gcloud iam service-accounts create landslide-ee --display-name="Landslide EE"
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:landslide-ee@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/earthengine.writer"
gcloud iam service-accounts keys create ./secrets/gee-key.json \
  --iam-account=landslide-ee@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

Then register that service account at `code.earthengine.google.com/register`.

### NASA Earthdata credentials file

Most NASA tools read `~/.netrc`, not environment variables:

```bash
cat >> ~/.netrc <<'NETRC'
machine urs.earthdata.nasa.gov
login YOUR_USERNAME
password YOUR_PASSWORD
NETRC
chmod 600 ~/.netrc
```

> ✅ **Checkpoint:** `python -c "import ee; ee.Initialize(); print(ee.Number(1).getInfo())"` prints `1`.

---

## Phase 1 — Local Toolchain

Your machine currently has system Python 3.9, no Node, no Docker. All three need fixing.

### 1.1 Homebrew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 1.2 Core tools

```bash
brew install python@3.11 node@20 git gdal
brew install --cask docker          # then LAUNCH Docker Desktop once, manually
```

**GDAL matters more than it looks.** `rasterio`, `geopandas` and `pyproj` all bind to it, and installing them without the system GDAL present produces wheel-version mismatches that are miserable to debug.

### 1.3 Verify

```bash
python3.11 --version    # → 3.11.x
node --version          # → v20.x
docker --version        # → 27.x
gdalinfo --version      # → GDAL 3.x
```

> ✅ **Checkpoint:** all four print a version. `docker ps` runs without error (Docker Desktop is running).

---

## Phase 2 — Project Skeleton

### 2.1 Directory tree

```bash
cd "/Users/ankita/major "
mkdir -p ingestion/{flows,clients} processing/{dem,insar,optical} \
         models/{susceptibility,trigger,deformation,fusion} \
         api/{routers,schemas,db,services} alerting/{templates,gateways} \
         dashboard citizen-app notebooks tests/{unit,integration} \
         data/{raw,interim,processed,external} infra secrets
find ingestion processing models api alerting -type d -exec touch {}/__init__.py \;
```

### 2.2 Python environment

```bash
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
```

### 2.3 `pyproject.toml`

```toml
[project]
name = "landslide-ews"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    # geospatial
    "rasterio>=1.3", "geopandas>=1.0", "shapely>=2.0", "pyproj>=3.6",
    "xarray>=2024.1", "rioxarray>=0.15", "richdem>=0.3",
    # earth observation
    "earthengine-api>=1.0", "geemap>=0.32", "asf-search>=7.0",
    # ml
    "xgboost>=2.0", "scikit-learn>=1.4", "torch>=2.2",
    "ruptures>=1.1", "shap>=0.45", "imbalanced-learn>=0.12",
    # data
    "pandas>=2.2", "numpy>=1.26",
    "psycopg[binary]>=3.1", "sqlalchemy>=2.0", "geoalchemy2>=0.15", "alembic>=1.13",
    # api
    "fastapi>=0.110", "uvicorn[standard]>=0.29", "pydantic-settings>=2.2", "redis>=5.0",
    # orchestration + tracking
    "prefect>=3.0", "mlflow>=2.12",
    # utils
    "python-dotenv>=1.0", "httpx>=0.27", "typer>=0.12",
]

[project.optional-dependencies]
dev = ["pytest>=8.0", "pytest-cov", "ruff>=0.4", "mypy>=1.10", "ipykernel", "jupyterlab"]

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.pytest.ini_options]
testpaths = ["tests"]
markers = ["slow: long-running tests"]
```

```bash
pip install -e ".[dev]"
```

### 2.4 `.gitignore`

```bash
cat > .gitignore <<'GI'
.venv/
__pycache__/
*.pyc
.env
secrets/
data/raw/
data/interim/
data/processed/
*.tif
*.SAFE/
node_modules/
dist/
.DS_Store
mlruns/
GI
git init && git add -A && git commit -m "Initial project skeleton"
```

> ✅ **Checkpoint:** `python -c "import rasterio, geopandas, xgboost, torch; print('ok')"` prints `ok`.

---

## Phase 3 — Infrastructure with Docker

Four services: PostgreSQL (with PostGIS **and** TimescaleDB), Redis, MinIO, and TiTiler.

### 3.1 `docker-compose.yml`

```yaml
services:
  db:
    image: timescale/timescaledb-ha:pg16          # includes PostGIS
    environment:
      POSTGRES_USER: landslide
      POSTGRES_PASSWORD: landslide
      POSTGRES_DB: landslide
    ports: ["5432:5432"]
    volumes: ["pgdata:/home/postgres/pgdata/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U landslide"]
      interval: 10s
      retries: 5

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports: ["9000:9000", "9001:9001"]
    volumes: ["miniodata:/data"]

  titiler:
    image: ghcr.io/developmentseed/titiler:latest
    environment:
      AWS_ACCESS_KEY_ID: minioadmin
      AWS_SECRET_ACCESS_KEY: minioadmin
      AWS_S3_ENDPOINT: http://minio:9000
      AWS_VIRTUAL_HOSTING: "FALSE"
    ports: ["8001:80"]
    depends_on: [minio]

volumes:
  pgdata:
  miniodata:
```

### 3.2 Start and enable extensions

```bash
docker compose up -d
docker compose ps                       # all should read "healthy" / "running"

docker compose exec db psql -U landslide -d landslide -c \
  "CREATE EXTENSION IF NOT EXISTS postgis;
   CREATE EXTENSION IF NOT EXISTS timescaledb;
   SELECT postgis_version(), extversion FROM pg_extension WHERE extname='timescaledb';"
```

### 3.3 Create the MinIO bucket

Open `http://localhost:9001` (minioadmin / minioadmin) → create bucket `landslide-cogs` → set access policy to public read (so TiTiler can serve tiles).

> ✅ **Checkpoint:** the `SELECT postgis_version()` query returns a version string, and `http://localhost:8001/docs` loads the TiTiler API page.

---

## Phase 4 — Database Schema

Use the SQL in [README §13](../README.md#13-database-schema) — it is complete and ready to run. Wire it through Alembic so migrations are versioned:

```bash
alembic init api/db/migrations
```

Edit `alembic.ini` → `sqlalchemy.url = postgresql+psycopg://landslide:landslide@localhost:5432/landslide`

Then create the first migration and paste the README's `CREATE TABLE` statements into its `upgrade()` as `op.execute("""…""")` blocks:

```bash
alembic revision -m "core schema"
# ...paste SQL...
alembic upgrade head
```

**Order matters:** create tables → `create_hypertable()` → indexes. Timescale refuses to convert a table that already holds data, so hypertable conversion must happen before any ingestion.

> ✅ **Checkpoint:**
> ```bash
> docker compose exec db psql -U landslide -d landslide -c "\dt"
> docker compose exec db psql -U landslide -d landslide -c \
>   "SELECT hypertable_name FROM timescaledb_information.hypertables;"
> ```
> lists your tables, and shows `rainfall_obs`, `displacement_ts`, `risk_scores` as hypertables.

---

## Phase 5 — Data Ingestion

Build these in the order below. Each is independently testable.

### 5.1 Define the area of interest

Start with the pilot corridor only. A region-wide AOI will make every download 100× slower for zero extra insight.

```python
# ingestion/aoi.py
NH10_BBOX = (88.30, 26.85, 88.85, 27.45)   # Sevoke–Gangtok, ~60 × 65 km
```

### 5.2 Terrain — DEM (one-time download)

```python
# ingestion/clients/dem.py
import ee

def fetch_dem(bbox, out_asset):
    ee.Initialize()
    aoi = ee.Geometry.Rectangle(bbox)
    dem = ee.Image("USGS/SRTMGL1_003").clip(aoi)      # 30 m SRTM
    task = ee.batch.Export.image.toDrive(
        image=dem, description="srtm_nh10",
        region=aoi, scale=30, crs="EPSG:32645", maxPixels=1e9,
    )
    task.start()
    return task
```

Export to Drive, download the GeoTIFF, then push to MinIO. For NER also try **CartoDEM** from Bhuvan (ISRO, 30 m) — it is better fitted to Indian terrain than SRTM, though the download is manual.

### 5.3 Rainfall — GPM IMERG (the workhorse)

Pulling IMERG through GEE is far simpler than wrestling with NASA's OPeNDAP:

```python
# ingestion/clients/rainfall.py
import ee, pandas as pd

def fetch_imerg(bbox, start, end):
    ee.Initialize()
    aoi = ee.Geometry.Rectangle(bbox)
    coll = (ee.ImageCollection("NASA/GPM_L3/IMERG_V07")
            .filterDate(start, end).filterBounds(aoi).select("precipitation"))

    def to_row(img):
        val = img.reduceRegion(ee.Reducer.mean(), aoi, 11000).get("precipitation")
        return ee.Feature(None, {"ts": img.date().format(), "precip_mm_hr": val})

    rows = coll.map(to_row).getInfo()["features"]
    return pd.DataFrame([r["properties"] for r in rows])
```

Write results into the `rainfall_obs` hypertable. **Backfill at least 5 years** — the trigger model needs many monsoons to learn from.

### 5.4 Landslide inventory (your labels — the binding constraint)

1. Download GSI NLSM polygons/points from Bhukosh for your states.
2. Download the NASA COOLR global catalogue (CSV) and filter to your bbox.
3. Deduplicate — the same event often appears in both.
4. Load into `landslide_events`.

```python
# ingestion/clients/inventory.py
import geopandas as gpd, pandas as pd

def load_coolr(csv_path, bbox):
    df = pd.read_csv(csv_path)
    gdf = gpd.GeoDataFrame(df,
        geometry=gpd.points_from_xy(df.longitude, df.latitude), crs="EPSG:4326")
    return gdf.cx[bbox[0]:bbox[2], bbox[1]:bbox[3]]
```

> ⚠️ **Expect a small number.** The pilot corridor may yield only 50–300 usable events. That is normal, and it is exactly why spatial CV and transfer learning matter later.

### 5.5 Exposure — roads and population

```bash
pip install osmnx
```

```python
import osmnx as ox
roads = ox.graph_from_bbox(27.45, 26.85, 88.85, 88.30,
                           custom_filter='["highway"~"trunk|primary|secondary"]')
```

Segment the centreline into 1 km chainage units and load into `road_segments`. Grab WorldPop 100 m population raster for the same bbox.

> ✅ **Checkpoint:**
> ```sql
> SELECT count(*) FROM landslide_events;   -- > 50
> SELECT count(*) FROM road_segments;      -- ~60-100 for NH-10
> SELECT count(*), min(ts), max(ts) FROM rainfall_obs;  -- multi-year span
> ```

---

## Phase 6 — Terrain Feature Engineering

Turn one DEM into ~15 predictor rasters. This phase is pure computation — no network, no credentials, fully testable.

```python
# processing/dem/derivatives.py
import numpy as np, richdem as rd, rasterio

def compute_derivatives(dem_path, out_dir):
    dem = rd.LoadGDAL(dem_path)

    slope     = rd.TerrainAttribute(dem, attrib="slope_degrees")
    aspect    = rd.TerrainAttribute(dem, attrib="aspect")
    plan_curv = rd.TerrainAttribute(dem, attrib="curvature")
    prof_curv = rd.TerrainAttribute(dem, attrib="profile_curvature")

    rd.FillDepressions(dem, in_place=True)
    accum = rd.FlowAccumulation(dem, method="D8")

    # circular encoding — never feed raw degrees to the model
    aspect_rad = np.deg2rad(np.asarray(aspect))
    aspect_sin, aspect_cos = np.sin(aspect_rad), np.cos(aspect_rad)

    slope_rad = np.deg2rad(np.asarray(slope))
    tan_b = np.tan(np.clip(slope_rad, 0.001, None))     # guard div-by-zero on flats
    a = np.asarray(accum) + 1.0
    twi = np.log(a / tan_b)
    spi = a * tan_b

    return {"slope": slope, "aspect_sin": aspect_sin, "aspect_cos": aspect_cos,
            "plan_curv": plan_curv, "prof_curv": prof_curv, "twi": twi, "spi": spi}
```

Then compute distance rasters with GDAL:

```bash
gdal_proximity.py roads_raster.tif dist_to_road.tif -distunits GEO
gdal_proximity.py faults_raster.tif dist_to_fault.tif -distunits GEO
```

**Every raster must share one grid** — same CRS, same resolution, same extent, same transform — or your feature stack will silently misalign and the model will learn nonsense. Reproject everything to a metric UTM CRS (EPSG:32645/32646 for NER), never work in degrees for slope calculations.

```python
# processing/featurestack.py
import xarray as xr, rioxarray

def build_stack(paths: dict, reference: str):
    ref = rioxarray.open_rasterio(reference)
    layers = {}
    for name, p in paths.items():
        da = rioxarray.open_rasterio(p)
        layers[name] = da.rio.reproject_match(ref)   # forces grid alignment
    return xr.Dataset(layers)
```

> ✅ **Checkpoint:** a test asserting that every band in the stack has identical `shape` and `transform`, and that slope on a synthetic 45° ramp computes to 45 ± 0.1°.

---

## Phase 7 — Layer 1: Susceptibility Model

### 7.1 Sample points

```python
# models/susceptibility/dataset.py
import geopandas as gpd, numpy as np

def sample_negatives(events_gdf, stack, n, min_slope=10, buffer_m=500, seed=42):
    """Negatives from real slopes, far from any known failure."""
    rng = np.random.default_rng(seed)
    exclusion = events_gdf.buffer(buffer_m).union_all()
    picked = []
    while len(picked) < n:
        x = rng.uniform(stack.x.min(), stack.x.max())
        y = rng.uniform(stack.y.min(), stack.y.max())
        pt = gpd.points_from_xy([x], [y])[0]
        if exclusion.contains(pt):
            continue                                   # too close to a real event
        if float(stack.slope.sel(x=x, y=y, method="nearest")) < min_slope:
            continue                                   # flat ground = free win, useless
        picked.append(pt)
    return gpd.GeoDataFrame(geometry=picked, crs=events_gdf.crs)
```

### 7.2 Spatial blocking — the step everything else depends on

```python
# models/susceptibility/spatial_cv.py
import numpy as np
from sklearn.model_selection import GroupKFold

def assign_blocks(gdf, block_size_m=5000):
    """Grid the AOI into blocks; whole blocks are held out together."""
    bx = (gdf.geometry.x // block_size_m).astype(int)
    by = (gdf.geometry.y // block_size_m).astype(int)
    return (bx.astype(str) + "_" + by.astype(str)).values

def spatial_cv(X, y, groups, n_splits=5):
    return GroupKFold(n_splits=n_splits).split(X, y, groups)
```

Choose `block_size_m` from a variogram of your terrain features, not by guessing. If unsure, 5 km is a defensible starting point for 30 m data.

### 7.3 Train

```python
# models/susceptibility/train.py
import numpy as np, xgboost as xgb, mlflow
from sklearn.metrics import roc_auc_score, average_precision_score
from imblearn.over_sampling import SMOTE

def train(X, y, groups, params=None):
    params = params or dict(
        max_depth=5, learning_rate=0.05, n_estimators=600,
        subsample=0.8, colsample_bytree=0.8,
        scale_pos_weight=float((y == 0).sum() / (y == 1).sum()),
        eval_metric="aucpr", tree_method="hist",
    )
    aucs, aps = [], []
    with mlflow.start_run():
        mlflow.log_params(params)
        for fold, (tr, te) in enumerate(spatial_cv(X, y, groups)):
            # SMOTE INSIDE the fold only — outside, it leaks into the test set
            Xr, yr = SMOTE(random_state=42).fit_resample(X[tr], y[tr])
            m = xgb.XGBClassifier(**params).fit(Xr, yr)
            p = m.predict_proba(X[te])[:, 1]
            aucs.append(roc_auc_score(y[te], p))
            aps.append(average_precision_score(y[te], p))
            mlflow.log_metric("fold_auc", aucs[-1], step=fold)
        mlflow.log_metric("cv_auc_mean", float(np.mean(aucs)))
        mlflow.log_metric("cv_ap_mean", float(np.mean(aps)))
    return m, np.mean(aucs), np.mean(aps)
```

### 7.4 Predict to a raster, export as COG

```bash
gdal_translate susceptibility.tif susceptibility_cog.tif \
  -of COG -co COMPRESS=DEFLATE -co OVERVIEWS=AUTO
```

Upload to MinIO — TiTiler serves it as map tiles with no further work.

### 7.5 SHAP

```python
import shap
explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X_sample)
```

Store the top 5 contributing features per prediction into `risk_scores.attribution`.

> ✅ **Checkpoint:** spatially blocked CV AUC lands in **0.75–0.88**.
> If you see **0.97+, something is leaking** — check that blocks are contiguous, that SMOTE runs inside folds, and that no negative was sampled adjacent to a positive. A suspiciously perfect score is a bug report, not a result.

---

## Phase 8 — Layer 2: Rainfall Trigger Model

### 8.1 Build sequences

```python
# models/trigger/sequences.py
import numpy as np

def make_windows(rain_df, events, lookback_h=720, horizons=(24, 48, 72)):
    """One sample = 30 days of hourly rain ending at time t, labelled by
    whether a failure occurred within each horizon after t."""
    X, Y = [], []
    series = rain_df.set_index("ts")["precip_mm"].asfreq("h").fillna(0.0)
    for t in series.index[lookback_h:]:
        window = series.loc[:t].iloc[-lookback_h:].values
        feats = np.column_stack([
            window,
            np.convolve(window, np.ones(72),  "same") / 72,    # 3-day
            np.convolve(window, np.ones(168), "same") / 168,   # 7-day
            np.convolve(window, np.ones(360), "same") / 360,   # 15-day
            np.convolve(window, np.ones(720), "same") / 720,   # 30-day
        ])
        X.append(feats)
        Y.append([int(any(t < e <= t + np.timedelta64(h, "h") for e in events))
                  for h in horizons])
    return np.array(X, dtype="float32"), np.array(Y, dtype="float32")
```

### 8.2 Model

```python
# models/trigger/model.py
import torch, torch.nn as nn

class TriggerLSTM(nn.Module):
    def __init__(self, n_feat=5, hidden=128, n_static=4, n_horizons=3):
        super().__init__()
        self.lstm = nn.LSTM(n_feat, hidden, num_layers=2,
                            batch_first=True, dropout=0.2)
        self.head = nn.Sequential(
            nn.Linear(hidden + n_static, 64), nn.ReLU(),
            nn.Dropout(0.2), nn.Linear(64, n_horizons),
        )

    def forward(self, seq, static):
        _, (h, _) = self.lstm(seq)
        return self.head(torch.cat([h[-1], static], dim=1))   # logits
```

### 8.3 Focal loss — essential, not optional

Positives here are well under 0.1% of samples. Plain BCE will converge to predicting "no landslide, ever" with 99.9% accuracy.

```python
# models/trigger/loss.py
import torch, torch.nn.functional as F

def focal_loss(logits, targets, alpha=0.25, gamma=2.0):
    bce = F.binary_cross_entropy_with_logits(logits, targets, reduction="none")
    p_t = torch.exp(-bce)
    return (alpha * (1 - p_t) ** gamma * bce).mean()
```

### 8.4 Split temporally, never randomly

```python
train = data[data.year <= 2021]
val   = data[data.year == 2022]
test  = data[data.year >= 2023]
```

A random split puts hour 14 of a storm in train and hour 15 in test. The model then "predicts" a storm it has already seen.

### 8.5 Keep the physical baseline

```python
# models/trigger/thresholds.py
def guzzetti_threshold(duration_h, alpha=2.2, beta=0.44):
    """Critical mean intensity (mm/h) for a storm of given duration."""
    return alpha * duration_h ** (-beta)
```

Fit `alpha`/`beta` to your own inventory. Log any LSTM alert that fires far below this curve — that is your early warning that the network has latched onto a seasonal artefact.

> ✅ **Checkpoint:** on held-out monsoons, the model fires Orange/Red before ≥1 documented event, with AUC-PR meaningfully above the base rate. Plot a reliability diagram — a stated 0.7 should occur about 70% of the time.

---

## Phase 9 — Layer 3: InSAR Deformation

> ⚠️ **Read this before starting.** Processing Sentinel-1 SLC from scratch means ~10 GB per acquisition, hours of compute per interferogram, and a steep learning curve in SNAP/ISCE2. For a time-boxed project this can consume your entire schedule.

### 9.1 Take the shortcut: LiCSBAS

The COMET-LiCS portal publishes **pre-processed interferograms** for most tectonic regions including the Himalaya, free. LiCSBAS turns them into displacement time series without you ever touching an SLC.

```bash
pip install LiCSBAS
# 1. Find your frame at https://comet.nerc.ac.uk/COMET-LiCS-portal/
LiCSBAS01_get_geotiff.py -f 019D_05055_131313 -s 20200101 -e 20240101
LiCSBAS02_ml_prep.py -i GEOC -n 4          # multilook
LiCSBAS03op_GACOS.py -i GEOC_4look         # atmospheric correction
LiCSBAS04op_mask.py  -i GEOC_4look
LiCSBAS13_sb_inv.py  -d GEOC_4look         # SBAS inversion → time series
```

This gets you a real deformation layer in **days instead of weeks**. Full SLC processing is the right call only if you have the time and a specific reason.

### 9.2 The full chain, if you do process SLCs

```bash
pip install asf_search
```

```python
import asf_search as asf
results = asf.geo_search(
    platform=asf.PLATFORM.SENTINEL1, processingLevel="SLC",
    intersectsWith="POLYGON((88.3 26.85, 88.85 26.85, 88.85 27.45, 88.3 27.45, 88.3 26.85))",
    start="2023-05-01", end="2023-10-31",
    beamMode="IW", flightDirection="DESCENDING",   # ONE track only — never mix
)
asf.download_urls([r.properties["url"] for r in results],
                  path="data/raw/slc", session=asf.ASFSession().auth_with_netrc())
```

Then SNAP (GUI first to learn it, `gpt` for batch) → interferogram → SNAPHU unwrap → **MintPy** for time-series inversion. MintPy is the standard tool; do not hand-roll SBAS.

### 9.3 Change-point detection

This part is genuinely easy once you have a time series:

```python
# models/deformation/changepoint.py
import numpy as np, ruptures as rpt

def detect_creep(dates, disp_mm, pen=10.0, min_size=3):
    velocity = np.gradient(disp_mm, dates.astype("datetime64[D]").astype(float))
    breaks = rpt.Pelt(model="rbf", min_size=min_size, jump=1).fit(velocity).predict(pen=pen)
    if len(breaks) < 2:
        return {"state": "stable", "modifier": 1.00}
    last = breaks[-2]
    before, after = velocity[:last].mean(), velocity[last:].mean()
    if abs(after) < 3 * np.std(velocity[:last]):
        return {"state": "stable", "modifier": 1.00}
    if abs(after) > 2 * abs(before):
        return {"state": "accelerating", "modifier": 1.35, "changepoint": int(last)}
    return {"state": "slow", "modifier": 1.15}
```

### 9.4 Be honest about coverage

```python
COHERENCE_MIN = 0.30
if coherence < COHERENCE_MIN:
    return {"state": "unknown", "modifier": 1.00, "coverage": "none"}
```

Never interpolate deformation across incoherent pixels. Store the coverage flag and surface it in the UI.

> ✅ **Checkpoint:** a displacement time series plotted for one known unstable slope, with a detected change point, and a coverage map showing which parts of the corridor are actually observable.

---

## Phase 10 — Fusion & Exposure

The step that turns three models into one number.

```python
# models/fusion/risk.py
from dataclasses import dataclass

TIERS = [(0.75, "red"), (0.50, "orange"), (0.25, "yellow"), (0.0, "green")]

@dataclass
class RiskInput:
    susceptibility: float      # Layer 1
    trigger_prob: float        # Layer 2
    deform_modifier: float     # Layer 3
    exposure: float

def compute_risk(r: RiskInput) -> dict:
    hazard = r.susceptibility * r.trigger_prob * r.deform_modifier
    risk = min(hazard * r.exposure, 1.0)          # clamp: D can exceed 1
    tier = next(name for thr, name in TIERS if risk >= thr)
    return {"hazard": hazard, "risk": risk, "tier": tier}
```

### Exposure with runout

A slope 400 m above a road still reaches it. Use an angle-of-reach buffer, not a fixed one:

```python
import numpy as np

def runout_distance(slope_height_m, reach_angle_deg=30):
    return slope_height_m / np.tan(np.deg2rad(reach_angle_deg))
```

### Aggregate with percentiles, not means

```sql
-- a road km is only as safe as its worst slope
SELECT rs.id,
       percentile_cont(0.90) WITHIN GROUP (ORDER BY h.hazard) AS hazard_p90
FROM road_segments rs
JOIN slope_units s ON ST_DWithin(rs.geom::geography, s.geom::geography, 500)
JOIN hazard h ON h.slope_unit_id = s.id
GROUP BY rs.id;
```

> ✅ **Checkpoint:** `SELECT tier, count(*) FROM risk_scores GROUP BY tier;` returns a sane spread — mostly green, a few red. If everything is red, your thresholds or your exposure normalisation are wrong.

---

## Phase 11 — API Layer

```python
# api/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routers import risk, alerts, reports, deformation

app = FastAPI(title="Landslide Early Warning API", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"],
                   allow_methods=["*"], allow_headers=["*"])

for r, prefix, tag in [
    (risk, "/api/v1/risk", "risk"),
    (alerts, "/api/v1/alerts", "alerts"),
    (reports, "/api/v1/reports", "reports"),
    (deformation, "/api/v1/deformation", "deformation"),
]:
    app.include_router(r.router, prefix=prefix, tags=[tag])

@app.get("/health")
def health():
    return {"status": "ok"}
```

```python
# api/routers/risk.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
router = APIRouter()

@router.get("/watchlist")
def watchlist(limit: int = Query(50, le=500), horizon: int = 24, db=Depends(get_db)):
    rows = db.execute(text("""
        SELECT DISTINCT ON (r.target_id)
               r.target_id, s.highway_code, s.chainage_km,
               r.risk, r.tier, r.attribution, r.computed_at
        FROM risk_scores r
        JOIN road_segments s ON s.id = r.target_id
        WHERE r.target_type = 'segment' AND r.horizon_h = :h
        ORDER BY r.target_id, r.computed_at DESC
    """), {"h": horizon}).mappings().all()
    return sorted(rows, key=lambda x: x["risk"], reverse=True)[:limit]
```

Endpoint list is in [README §14](../README.md#14-api-specification). Build them in this order: `/health` → `/risk/watchlist` → `/risk/segments/{id}` → `/risk/point` → alerts → reports.

```bash
uvicorn api.main:app --reload --port 8000
```

> ✅ **Checkpoint:** `http://localhost:8000/docs` lists every endpoint, and `/api/v1/risk/watchlist` returns real rows from your database.

---

## Phase 12 — Officials' Dashboard

```bash
cd dashboard
npm create vite@latest . -- --template react-ts
npm install maplibre-gl react-map-gl @tanstack/react-query recharts date-fns
npm install -D tailwindcss @tailwindcss/vite
```

```tsx
// dashboard/src/components/RiskMap.tsx
import Map, { Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

const TIER_COLORS: Record<string, string> = {
  green: "#16a34a", yellow: "#eab308", orange: "#f97316", red: "#dc2626",
};

export function RiskMap({ segments }: { segments: GeoJSON.FeatureCollection }) {
  return (
    <Map
      initialViewState={{ longitude: 88.55, latitude: 27.15, zoom: 10 }}
      style={{ width: "100%", height: "100%" }}
      mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
    >
      <Source id="risk" type="geojson" data={segments}>
        <Layer
          id="risk-lines" type="line"
          paint={{
            "line-width": 5,
            "line-color": [
              "match", ["get", "tier"],
              "red", TIER_COLORS.red, "orange", TIER_COLORS.orange,
              "yellow", TIER_COLORS.yellow, TIER_COLORS.green,
            ],
          }}
        />
      </Source>
    </Map>
  );
}
```

Build in this order: **map → watchlist table → segment detail with SHAP chart → historical replay slider → deformation plot.** The watchlist is what officials actually use; ship it before the pretty parts.

> ✅ **Checkpoint:** the map renders NH-10 with segments coloured by tier, and clicking one opens a panel showing its risk breakdown.

---

## Phase 13 — Alerting: SMS & IVR

```python
# alerting/gateways/msg91.py
import httpx, os

async def send_sms(phone: str, template_id: str, variables: dict):
    async with httpx.AsyncClient() as c:
        r = await c.post("https://control.msg91.com/api/v5/flow/",
            headers={"authkey": os.environ["MSG91_AUTH_KEY"]},
            json={"template_id": template_id,
                  "recipients": [{"mobiles": f"91{phone}", **variables}]})
        return r.json()
```

### Language templates

```python
# alerting/templates/messages.py
TEMPLATES = {
    ("red", "en"): "LANDSLIDE WARNING: High risk on {location} in next {hours}h. Avoid travel.",
    ("red", "hi"): "भूस्खलन चेतावनी: {location} पर अगले {hours} घंटे में उच्च जोखिम। यात्रा से बचें।",
    ("red", "as"): "ভূমিস্খলন সতৰ্কবাণী: {location}ত পিছৰ {hours} ঘণ্টাত উচ্চ বিপদ।",
    # + Khasi, Mizo, Bodo, Nyishi, Manipuri
}
```

Get translations reviewed by native speakers. A mistranslated warning is worse than none.

### IVR

Record one audio file per (tier × language) and splice in the location name via TTS, or pre-record the top 50 locations. Twilio's `<Play>` verb, or MSG91's voice API.

### Dispatch on tier *transition*, not on tier

```python
# alerting/dispatcher.py
async def maybe_alert(prev_tier, new_tier, segment, subscribers):
    rank = {"green": 0, "yellow": 1, "orange": 2, "red": 3}
    if rank[new_tier] <= rank[prev_tier]:
        return                              # no escalation → stay silent
    for sub in subscribers:
        await send_sms(sub.phone, TEMPLATE_IDS[(new_tier, sub.language)],
                       {"location": segment.name, "hours": 24})
```

Alerting on tier rather than transition will send the same red alert every 3 hours for four days, and people will start ignoring it.

> ✅ **Checkpoint:** a real SMS arrives on your own phone, in a non-English language, triggered by a simulated tier escalation.

---

## Phase 14 — Citizen App

```bash
npx create-expo-app@latest citizen-app --template blank-typescript
cd citizen-app
npx expo install expo-location expo-camera expo-notifications \
                 @react-native-async-storage/async-storage react-native-maps
```

Screen order: **Alerts → Map → Report → Settings/Language.**

```tsx
// citizen-app/src/services/risk.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export async function getRisk(lat: number, lon: number) {
  try {
    const r = await fetch(`${API}/api/v1/risk/point?lat=${lat}&lon=${lon}`);
    const data = await r.json();
    await AsyncStorage.setItem("lastRisk", JSON.stringify(data));  // cache for offline
    return data;
  } catch {
    const cached = await AsyncStorage.getItem("lastRisk");         // storm-proof path
    return cached ? { ...JSON.parse(cached), stale: true } : null;
  }
}
```

**Build offline-first from the first commit.** Retrofitting offline support is painful, and offline is the actual operating condition this app exists for.

> ✅ **Checkpoint:** app shows the correct risk tier for your location, and still shows the last-known value with a "stale" badge in airplane mode.

---

## Phase 15 — Orchestration

```python
# ingestion/flows/forecast_flow.py
from prefect import flow, task

@task(retries=3, retry_delay_seconds=300)
def pull_rainfall(): ...

@task
def run_trigger_model(): ...

@task
def fuse_and_score(): ...

@task
def dispatch_alerts(): ...

@flow(name="forecast-cycle", log_prints=True)
def forecast_cycle():
    pull_rainfall()
    run_trigger_model()
    fuse_and_score()
    dispatch_alerts()

if __name__ == "__main__":
    forecast_cycle.serve(name="every-3h", cron="0 */3 * * *")
```

Separate schedules: forecast every 3 h, InSAR on each Sentinel-1 pass (every 6–12 days), susceptibility retrain seasonally.

> ✅ **Checkpoint:** Prefect UI at `http://localhost:4200` shows the flow running on schedule, and a deliberately failed task retries rather than dying.

---

## Phase 16 — Deployment

For a college project, **Docker Compose on a single VM is entirely sufficient.** Kubernetes is in the README for completeness; do not spend your last two weeks on it.

```bash
# on the server
docker compose -f docker-compose.prod.yml up -d
```

Add the API and dashboard as services, put Caddy in front for automatic HTTPS:

```yaml
  caddy:
    image: caddy:2-alpine
    ports: ["80:80", "443:443"]
    volumes: ["./Caddyfile:/etc/caddy/Caddyfile", "caddydata:/data"]
```

Minimal CI:

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - run: pip install -e ".[dev]"
      - run: ruff check .
      - run: pytest -m "not slow"
```

---

## Minimum Viable Path (if you are short on time)

Cut in this order. Everything below still demonstrates the core idea end to end:

| Keep | Cut / defer |
|---|---|
| ✅ Phases 0–4 (setup, DB) | ❌ Kubernetes — Compose is fine |
| ✅ Phase 5, but **one season, one corridor** | ❌ Multi-year backfill |
| ✅ Phase 6 terrain features | ❌ Lineament/fault layers if unavailable |
| ✅ Phase 7 susceptibility — **your strongest, most reliable result** | — |
| ✅ Phase 8 trigger, simplified to antecedent-rainfall thresholds if the LSTM won't converge | ❌ SMAP soil moisture |
| ⚠️ Phase 9 via **LiCSBAS only** | ❌ Raw SLC processing |
| ✅ Phase 10 fusion | — |
| ✅ Phase 11 API — 4 endpoints is enough | ❌ OGC/WMS export |
| ✅ Phase 12 dashboard — map + watchlist | ❌ Historical replay |
| ✅ Phase 13 SMS in 2 languages | ❌ IVR (mention as designed, not built) |
| ⚠️ Phase 14 app — or a mobile-responsive web page instead | ❌ Native app if time-pressed |

**The single most valuable deliverable is the hindcast**: replay a real past event and show the system raising Orange/Red before it happened. One verified early warning on a real event beats every other feature you could build.

---

## Common Pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| **AUC = 0.98** | Spatial leakage | Contiguous blocks, buffered negatives, SMOTE inside folds |
| Model predicts "no landslide" always | Class imbalance | Focal loss, `scale_pos_weight`, report AUC-PR not accuracy |
| Rasters "align" but results are nonsense | Mixed CRS or resolution | `reproject_match` everything to one reference grid, metric CRS |
| Slope values look wrong | DEM in degrees | Reproject to UTM before terrain derivatives |
| InSAR gives nothing over vegetation | Decorrelation — expected | Coherence threshold, report coverage, don't interpolate |
| Timescale rejects `create_hypertable` | Table already has data | Convert before ingesting |
| Alerts fire every cycle for days | Alerting on tier, not transition | Only dispatch on escalation |
| GEE `getInfo()` hangs or errors | Pulling too much client-side | `Export` to Drive/Asset, or reduce region size |
| Sentinel-1 pairs won't interfere | Mixed tracks or orbit directions | One relative orbit, one flight direction, always |
| Everything is Red | Exposure not normalised | Scale exposure to 0–1 across the corridor |

---

## Where to Start Tomorrow

1. Apply for Google Earth Engine access — **it gates everything and takes days**.
2. `brew install python@3.11 node@20 gdal` and `brew install --cask docker`.
3. `docker compose up -d`, enable PostGIS + TimescaleDB, run the schema.
4. Download SRTM for the NH-10 bbox and compute slope. Seeing a real slope raster of a real corridor is the moment the project stops being a document.
