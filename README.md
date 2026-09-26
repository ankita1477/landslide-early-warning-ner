# Landslide Early Warning & Risk Monitoring System

**A multi-layer geospatial machine learning system that fuses terrain, rainfall and satellite-measured ground deformation into a rolling 24–72 hour landslide risk forecast for the North Eastern Region of India — resolved to individual slopes and road kilometres, and delivered over channels that survive a storm.**

> Major Project — Department of Computer Science & Engineering
> Domain: Geospatial AI · Remote Sensing · Disaster Management

---

## Status

Built and validated on the **NH-10 Sevoke–Gangtok pilot corridor** — 95.2 km of road in 96 segments of about a kilometre each, scored daily from satellite data alone.

| | |
|---|---|
| **Susceptibility** | **AUC 0.866** spatially blocked, 59 blocks · trained on 175 mapped landslide polygons |
| **Hindcast** | **Red raised 8 days before** the landslide of 21 July 2016, 11 m from NH-10 |
| **Trigger** | **31.7× lift** over base rate, calibrated to the true daily event rate |
| **Across 42 events** | Red fired before **17%**, median lead **9 days**, walk-forward validated — *measured before the corridor was rebuilt; re-run pending, see §16A* |
| **Deformation** | **Not observable here** — coherence 0.095 median against a 0.30 threshold |

The binding constraint is not the model. It is inventory location error: detection is **28% for events within 1 km of the corridor and 8% beyond it**, because the global catalogues locate most landslides to 5–25 km.

This README describes both the system as designed and the pilot as built. Where they differ, [§0](#0-what-is-built-what-is-designed) says which is which, and every section that is still design is labelled. Full figures, including what did not work and why, in [§16A Results](#16a-results). SMS dispatch is built and tested but runs dry — it has no provider credentials, and only English has been through review, so no other language will send. `make alerts` reports exactly what could and could not reach a phone.

---

## Table of Contents

0. [What Is Built, What Is Designed](#0-what-is-built-what-is-designed)
1. [Motivation](#1-motivation)
2. [Objectives](#2-objectives)
3. [Risk Formulation](#3-risk-formulation)
4. [System Architecture](#4-system-architecture)
5. [Layer 1 — Static Susceptibility](#5-layer-1--static-susceptibility)
6. [Layer 2 — Dynamic Rainfall Trigger](#6-layer-2--dynamic-rainfall-trigger)
7. [Layer 3 — Slope Creep Detection (InSAR)](#7-layer-3--slope-creep-detection-insar)
8. [Exposure & Risk Resolution](#8-exposure--risk-resolution)
9. [Alerting & Delivery Layer](#9-alerting--delivery-layer)
10. [Technology Stack](#10-technology-stack)
11. [Data Sources](#11-data-sources)
12. [Repository Structure](#12-repository-structure)
13. [Database Schema](#13-database-schema)
14. [API Specification](#14-api-specification)
15. [Machine Learning Pipeline](#15-machine-learning-pipeline)
16. [Validation Strategy & Metrics](#16-validation-strategy--metrics)
16A. [**Results**](#16a-results)
17. [Deployment Architecture](#17-deployment-architecture)
18. [Local Setup](#18-local-setup)
19. [Configuration](#19-configuration)
20. [Known Challenges & Mitigations](#20-known-challenges--mitigations)
21. [Testing](#21-testing)
22. [Limitations & Ethical Considerations](#22-limitations--ethical-considerations)
23. [Project Roadmap](#23-project-roadmap)
24. [References](#24-references)

---

## 0. What Is Built, What Is Designed

The repository is a working pilot on one corridor plus the design for the full regional system. The two are kept apart so that nothing here is claimed by implication.

| Component | Built and measured | Design only |
|---|---|---|
| **Terrain & susceptibility** | Copernicus GLO-30 derivatives via WhiteboxTools, 9 features, XGBoost, spatially blocked CV, 30 m raster | Lithology, soil, NDVI and structural features; transfer learning from other ranges |
| **Rainfall trigger** | CHIRPS and IMERG via Earth Engine, antecedent features, calibrated logistic regression, 24 h horizon, temporal validation | LSTM sequence model; 48 / 72 h horizons; SMAP soil moisture; IMD station bias correction |
| **Deformation** | LiCSAR interferograms read by byte range, coherence masking, chain integration, per-segment creep state and coverage flag | Running the SBAS chain from SLCs in SNAP / ISCE2 |
| **Exposure & fusion** | OSM settlements and facilities, runout reach, 90th-percentile aggregation, per-corridor tier calibration, 96 segments | WorldPop density, traffic proxy, per-habitation scores |
| **Validation** | 2016-07-21 hindcast, 42-event walk-forward lead-time study | — |
| **API** | FastAPI, 7 read endpoints, file-backed (GeoParquet), scoped CORS | PostGIS / TimescaleDB, Redis, TiTiler, auth, alert subscription, report intake |
| **Dashboard** | React + MapLibre console: map, ranked list, corridor strip, inspector, table, keyboard, light / dark / system | Historical replay, SHAP waterfall, outcome feedback, OGC export |
| **Citizen app** | **Landsafe NER** (Expo / React Native): today's reading, road map, journey check, alert history, safety guide, on-device report queue, offline cache | Push before storm onset, safe-route re-routing, regional languages, report upload |
| **Alerting** | Escalation-only SMS dispatcher, MSG91 gateway, review-gated templates in 8 languages, readiness report (`make alerts`) | IVR, delivery-receipt escalation, recalibration loop. **No credentials are configured, so nothing sends; only English has been reviewed** |
| **Operations** | GitHub Actions (tests, lint, types, dashboard build, app tests), Docker Compose for the designed database stack | Kubernetes, Prometheus / Grafana, Prefect scheduling, MLflow / DVC |

---

## 1. Motivation

The North Eastern Region loses lives, highways and weeks of economic activity to landslides every monsoon. Young-fold Himalayan geology, extremely high rainfall, unplanned hill cutting and the dumping of road-widening spoil combine to produce slope failures that sever the only surface link to entire districts. When NH-10 to Gangtok or the Imphal–Jiribam corridor closes, relief, fuel, medicines and perishables stop moving.

The core gap is **not awareness — it is resolution and timing.** What a district administrator has access to today falls into buckets that are individually correct but jointly unactionable:

| What exists today | Why it is not actionable |
|---|---|
| **Static hazard maps** (GSI susceptibility zonation) | Classifies a slope as high-risk *permanently*. Answers *where* failure is possible, never *when*. No engineer closes a highway on a map that has read "high" for a decade. |
| **Coarse meteorological warnings** (IMD district alerts) | Issued at district scale. A district in Meghalaya contains thousands of distinct slopes; a blanket red alert gives no basis to prioritise which culvert to clear or which hamlet to evacuate first. |
| **No deformation sensing** | Slopes typically creep for days to weeks before catastrophic failure. That precursor signal goes unread, because instrumenting every slope with extensometers and inclinometers is financially impossible at regional scale. |
| **Broken last mile** | A correct warning still fails if it arrives as an English PDF circular. Mobile data is the first casualty of a storm, and the affected population speaks Assamese, Khasi, Mizo, Bodo, Nyishi and Manipuri. |

**The problem this project solves:** continuously fuse *terrain* (why a slope is intrinsically weak), *rainfall* (what triggers it) and *satellite-measured ground deformation* (whether it is already moving) into a rolling 24–72 hour forecast, resolved to individual slopes and road kilometres, and delivered in a form that reaches officials and citizens when the network is degraded.

---

## 2. Objectives

1. **Build a susceptibility model** that predicts intrinsic slope instability from terrain, lithology and land-cover features at 30 m resolution, validated without spatial leakage.
2. **Build a rainfall trigger model** that converts antecedent and forecast precipitation into a time-resolved failure probability at 24, 48 and 72 hour horizons.
3. **Build a deformation monitoring layer** using free Sentinel-1 radar interferometry to detect slopes entering accelerated creep — the precursor no rainfall-only model can observe.
4. **Fuse the three into a per-road-kilometre and per-habitation risk score**, weighted by exposed population and critical infrastructure.
5. **Make every alert explainable**, attaching the factor attribution that drove the score so officials can audit and trust it.
6. **Deliver redundantly** — web dashboard, mobile app, and SMS/IVR in regional languages that work when data networks do not.
7. **Prove the system retrospectively** by hindcasting documented historical failures and reporting metrics honestly.
8. **Require no new field hardware**, so the system scales across all eight NER states at near-zero marginal cost.

### Non-Goals

- This is a **decision-support system, not an autonomous evacuation authority.** Final evacuation calls remain with the district administration.
- It does **not** predict earthquake-triggered or anthropogenic-blast-triggered failures.
- It does **not** replace geotechnical site investigation for individual slope stabilisation design.

---

## 3. Risk Formulation

The system decomposes risk into three multiplicative components, which is standard practice in quantitative hazard assessment:

```
RISK = HAZARD × EXPOSURE

where  HAZARD    = SUSCEPTIBILITY × TRIGGER_PROBABILITY × DEFORMATION_MODIFIER
       EXPOSURE  = f(population density, road criticality, critical facilities)
```

Component by component:

| Symbol | Meaning | Range | Source layer | Update cadence |
|---|---|---|---|---|
| `S` | Static susceptibility — intrinsic weakness of the slope | 0–1 | Layer 1 (XGBoost) | Seasonal |
| `P_t` | Trigger probability at horizon *t* — 24 h built; 48 and 72 h designed | 0–1 | Layer 2 (calibrated logistic regression) | Daily in the pilot; 3-hourly designed |
| `D` | Deformation modifier from creep state | 1.0–1.5 | Layer 3 (InSAR) | Every 6–12 days |
| `E` | Normalised exposure weight | 0–1 | Exposure layer | Static / annual |

$$H_t = S \times P_t \times D \qquad R_t = H_t \times E$$

The deformation modifier `D` is an **amplifier, not a standalone predictor.** A slope that is creeping steadily is a red flag even before rain arrives, but creep alone in a low-susceptibility, low-rainfall context is monitored rather than alerted. Concretely:

| Creep state (from change-point detection on LOS velocity) | `D` |
|---|---|
| Stable — no significant velocity, or incoherent pixel | 1.00 |
| Slow creep — velocity above noise floor, no acceleration | 1.15 |
| Accelerating — change-point detected, velocity trending up | 1.35 |
| Critical — sustained acceleration over ≥ 2 revisit cycles | 1.50 |

### Alert Tiers

Four graded tiers, deliberately aligned with the existing IMD colour convention so that no retraining of officials is required.

| Tier | Meaning | Recommended action | NH-10 threshold (calibrated) |
|---|---|---|---|
| **Green** | Normal | Routine monitoring | below 0.0043 |
| **Yellow** | Watch | Inspect drains and culverts; brief field staff | ≥ 0.0043 |
| **Orange** | Alert | Pre-position clearing equipment; advise avoiding the segment at night | ≥ 0.0055 |
| **Red** | Warning | Restrict traffic; prepare evacuation of flagged habitations | ≥ 0.0070 |

Thresholds are **not hard-coded constants.** The calibrated trigger probabilities are small numbers — a daily event rate of 0.8% is the truth of this corridor — so the fixed 0.25 / 0.50 / 0.75 cut-points of the original design would never fire. Instead the cut-points are fitted per corridor from the risk distribution's own frequencies (`models/fusion/risk.py`), served by `GET /risk/tiers`, and the hindcast refuses to score itself against thresholds derived from the window being replayed. Recalibration from official feedback (§9.4) is designed, not built.

---

## 4. System Architecture

### 4.1 The Simple Version

Before the detailed diagrams, here is the whole system in one picture. Three satellites answer three questions, one engine combines them, three channels deliver the answer.

```mermaid
flowchart LR
    A["🗻 TERRAIN<br/>elevation satellite"] --> D
    B["🌧️ RAINFALL<br/>weather satellite"] --> D
    C["📡 MOVEMENT<br/>radar satellite"] --> D
    D["🧠 RISK ENGINE<br/>combines all three"] --> E["🎯 RISK SCORE<br/>for every 1 km<br/>of road"]
    E --> F["💻 Dashboard<br/>for officials"]
    E --> G["📱 App<br/>for citizens"]
    E --> H["📞 SMS + Voice call<br/>works without internet"]

    style D fill:#fff3cd,stroke:#d39e00,stroke-width:2px
    style E fill:#f8d7da,stroke:#c82333,stroke-width:2px
```

### 4.2 Three Questions, Three Layers

Each layer answers one question that the other two cannot. A doctor analogy makes the split clear:

| Layer | The question it answers | What it uses | Medical analogy |
|---|---|---|---|
| **1 — Susceptibility** | *Is this slope weak by nature?* | Steepness, soil, rock type, tree cover, nearby road cuts | The patient's **medical history** — permanent risk factors |
| **2 — Rainfall Trigger** | *Is something stressing it right now?* | Rain over the last 30 days + rain forecast for the next 3 | Today's **stress and fever** — the immediate strain |
| **3 — Creep Detection** | *Is it already moving?* | Radar measuring millimetre ground shift every 6–12 days | The **early symptom** — the patient already limping |

**Why all three are needed:** a steep slope that never gets rain is safe. Heavy rain on flat ground is safe. But a weak slope + heavy rain + ground already sliding = the slope is about to fail. **Only the combination tells you that.**

### 4.3 The Formula in Plain English

```
   Weak slope   ×   Heavy rain   ×   Already moving   ×   People nearby   =   ALERT LEVEL
   (Layer 1)        (Layer 2)        (Layer 3)            (Exposure)
```

Because the terms are **multiplied**, any one of them being near zero pulls the risk down — which is exactly right. A crumbling slope above an empty forest is not an emergency. The same slope above a school is.

The output is one of four colours, the same colours IMD already uses, so no official has to learn a new system:

```
🟢 GREEN     Normal          → routine monitoring
🟡 YELLOW    Watch           → clear the drains, brief field staff
🟠 ORANGE    Alert           → move clearing equipment into position
🔴 RED       Warning         → restrict traffic, prepare evacuation
```

### 4.4 Following One Alert Through the System

What actually happens, step by step, on a rainy night in June:

```
 1.  ⏰  Every 3 hours, the system wakes up automatically
              │
 2.  🌧️  It downloads the latest rainfall from NASA's weather satellite
              │
 3.  🧠  The AI checks: how much rain has this slope soaked up in 30 days?
              │
 4.  📡  It looks up the radar record: has this slope been creeping downhill?
              │
 5.  🗻  It multiplies that by how weak the slope already was
              │
 6.  👥  Then by how many people and how much road sit below it
              │
 7.  🎯  Result: a score of 0.81 for kilometre 27 of NH-10  →  RED
              │
 8.  📤  Alert fires on three channels at once:
              ├── 💻 appears at the top of the district control room's watchlist
              ├── 📱 pushes to every phone registered near that kilometre
              └── 📞 a voice call in Nepali/Khasi/Mizo reaches people with no data
              │
 9.  📋  The alert carries its reason: "318 mm rain in 72 h, slope creeping
         since 4 June, 41° gradient, road cut 18 m away"
              │
10.  ✅  Afterwards, the official records what actually happened —
         and that answer is used to make the next prediction better
```

### 4.5 What Makes This Different From What Exists Today

| | Existing system | This system |
|---|---|---|
| **Area covered by one warning** | An entire district (~5,000 km²) | One kilometre of road |
| **Timing** | "This slope is dangerous" — permanently | "This slope is dangerous **on Thursday**" |
| **Sees slopes already moving** | ❌ No | ✅ Yes, via radar |
| **Explains its reasoning** | ❌ No | ✅ Every alert lists its causes |
| **Reaches people without internet** | ❌ PDF circular in English | ✅ Voice call in the local language |
| **Cost to expand to a new state** | New sensors, new survey | Retrain the model — the satellites are already there |

### 4.6 Why No Sensors on the Ground

The obvious way to detect a moving slope is to bolt instruments onto it. NER has tens of thousands of dangerous slopes; instrumenting even a fraction is financially impossible, and every device installed is a device that needs power, maintenance and a data link on a remote hillside.

Instead, **the satellites are already flying and the data is already free.** Sentinel-1 passes over every slope in the region every 6–12 days and measures ground movement to the millimetre, whether or not anyone is watching. This project's contribution is not new hardware — it is reading data that is already being collected and nobody is using.

That single decision is what makes the system deployable across all eight states instead of on one demonstration slope.

---

### 4.7 High-Level View (Detailed)

*The diagrams in 4.7–4.9 show the full design. §0 says which boxes exist in the pilot; the built path is Earth Engine and public archives → `ingestion/` → `processing/` → `models/` → GeoParquet → FastAPI → dashboard and app.*

```mermaid
flowchart TB
    subgraph SRC["🛰️  Data Sources (all free / public)"]
        S1["Sentinel-1 SLC<br/>radar, 6-12 day"]
        S2["Sentinel-2 / Landsat<br/>optical, NDVI"]
        GPM["GPM IMERG<br/>rainfall, 30 min"]
        IMD["IMD gridded +<br/>AWS stations (designed)"]
        SMAP["SMAP<br/>soil moisture (designed)"]
        DEM["Copernicus GLO-30<br/>30 m terrain"]
        INV["Sikkim inventory (Zenodo)<br/>+ NASA GLC dates"]
        OSM["OSM roads / WorldPop<br/>exposure"]
    end

    subgraph ING["⚙️  Ingestion & Orchestration"]
        PF["Prefect (designed)<br/>scheduled flows"]
        GEE["Google Earth Engine<br/>server-side raster ops"]
    end

    subgraph PROC["🧮  Processing"]
        DER["DEM derivatives<br/>slope, aspect, TWI, SPI"]
        INSAR["LiCSAR interferograms<br/>chain integration"]
        STACK["Feature stack assembly<br/>rasterio / xarray"]
    end

    subgraph MOD["🧠  Model Layer"]
        L1["Layer 1<br/>XGBoost susceptibility"]
        L2["Layer 2<br/>calibrated rainfall trigger"]
        L3["Layer 3<br/>creep change-point"]
        FUSE["Risk fusion engine"]
        SHAP["Factor components<br/>(SHAP designed)"]
    end

    subgraph STORE["🗄️  Storage"]
        PG[("PostgreSQL + PostGIS<br/>vector risk layers")]
        TS[("TimescaleDB<br/>rainfall & displacement<br/>time series")]
        OBJ[("Object store<br/>COG rasters")]
    end

    subgraph API["🔌  Serving"]
        FAST["FastAPI<br/>risk / alert / admin"]
        TILE["TiTiler<br/>raster tiles"]
        REDIS["Redis cache"]
    end

    subgraph UI["📡  Delivery"]
        DASH["Officials' Dashboard<br/>React + MapLibre"]
        APP["Citizen App<br/>React Native"]
        SMS["SMS / IVR Gateway<br/>6 regional languages"]
    end

    SRC --> ING --> PROC --> MOD --> STORE --> API --> UI
    APP -.->|"geotagged crack reports"| INV
    DASH -.->|"outcome feedback"| MOD
```

### 4.8 Component Interaction — Forecast Cycle

```mermaid
sequenceDiagram
    autonumber
    participant SCH as Scheduler (Prefect)
    participant ING as Ingestion Service
    participant GEE as Earth Engine
    participant L2 as Trigger Model
    participant L3 as Deformation Store
    participant FUS as Fusion Engine
    participant DB as PostGIS / Timescale
    participant ALR as Alert Dispatcher
    participant U as Officials & Citizens

    SCH->>ING: trigger 3-hourly rainfall pull
    ING->>GEE: request IMERG tiles over AOI
    GEE-->>ING: aggregated rainfall grid
    ING->>DB: append to rainfall hypertable
    SCH->>L2: run inference on updated sequences
    L2->>DB: read 30-day antecedent window
    DB-->>L2: rainfall + soil-moisture sequence
    L2-->>FUS: P(failure) @ 24 / 48 / 72 h
    FUS->>DB: read susceptibility raster (cached)
    FUS->>L3: read latest creep state per polygon
    L3-->>FUS: deformation modifier D
    FUS->>FUS: R = S × P × D × E per segment
    FUS->>DB: write risk scores + factor components
    FUS->>ALR: segments crossing tier boundary
    ALR->>U: push / SMS / IVR in preferred language
    U-->>DB: outcome feedback (occurred / not)
```

### 4.9 Layered Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  PRESENTATION                                                       │
│  Officials' Dashboard · Citizen App · SMS/IVR · OGC WMS/WFS export  │
├─────────────────────────────────────────────────────────────────────┤
│  APPLICATION / API                                                  │
│  FastAPI routers · auth & RBAC · alert subscription · tile server   │
├─────────────────────────────────────────────────────────────────────┤
│  DOMAIN / RISK ENGINE                                               │
│  Fusion · tier calibration · exposure weighting · explainability    │
├─────────────────────────────────────────────────────────────────────┤
│  MODEL                                                              │
│  XGBoost susceptibility · calibrated trigger · change-point detector│
├─────────────────────────────────────────────────────────────────────┤
│  PROCESSING                                                         │
│  DEM derivatives · InSAR SBAS chain · cloud masking · feature stack │
├─────────────────────────────────────────────────────────────────────┤
│  DATA ACCESS                                                        │
│  PostGIS repos · Timescale repos · COG readers · GEE client         │
├─────────────────────────────────────────────────────────────────────┤
│  INGESTION                                                          │
│  Prefect flows · retry & backfill · provenance logging              │
└─────────────────────────────────────────────────────────────────────┘
```

**Design principle:** Google Earth Engine carries the heavy raster processing server-side. This removes the need for a GPU cluster or petabyte-scale local storage and keeps recurring infrastructure cost inside a modest institutional or state IT budget.

---

## 5. Layer 1 — Static Susceptibility

> **Question answered:** *Where are slopes intrinsically weak?*

### 5.1 Model

A gradient-boosted decision tree classifier (**XGBoost**) trained on **175 mapped landslide polygons** from the multi-temporal Sikkim inventory (Zenodo, CC-BY), against 350 constructed negatives. Output is a continuous susceptibility raster at 30 m over the pilot AOI. The GSI Bhukosh inventory that the design names is not reachable from outside India and had to be dropped; the NASA Global Landslide Catalog was loaded but its points are geocoded to settlements — 5 to 25 km from the scarp, which is 167 to 833 pixels at 30 m — so it supplies event *dates* to Layer 2 and no *locations* to Layer 1.

Gradient boosting is chosen over deep CNN approaches for three reasons: the inventory is small and sparse (hundreds to low thousands of labelled events, not millions), tabular terrain features are already physically meaningful so learned convolutional features add little, and tree ensembles are directly interpretable through SHAP — which the alerting requirement demands.

### 5.2 Feature Set

The nine features the model actually uses (`processing/dem/derivatives.py`, `processing/proximity.py`):

| Group | Features | Derived from |
|---|---|---|
| **Topography** | Slope angle, aspect as `(sin θ, cos θ)`, plan curvature, profile curvature, elevation | Copernicus GLO-30, 30 m, via WhiteboxTools |
| **Hydrology** | Topographic Wetness Index (TWI), Stream Power Index (SPI) | DEM-derived, after `fill_depressions_wang_and_liu` |
| **Anthropogenic** | Distance to road | OSM highways clipped to the AOI |

Designed but not built — the data either needs an Indian institutional login or was out of scope for the pilot: structural (lineaments, faults, lithology), soil (NBSS&LUP), vegetation (NDVI, land cover) and relative relief. Their absence is stated on the dashboard's inspector rather than filled in.

Feature engineering notes:
- **Aspect is circular.** It is encoded as `(sin θ, cos θ)`, never as raw degrees — a naive 0–360 encoding puts north-facing 359° and 1° slopes at opposite ends of the feature space.
- **TWI** = `ln(a / tan β)` where `a` is upslope contributing area per unit contour width and `β` is local slope. It captures where water accumulates and pore pressure builds.
- **SPI** = `a × tan β`, capturing erosive power of concentrated flow.
- Elevation is a **trend-dominated** feature at this scale, so it is excluded when fitting the variogram that sets the spatial block size (§16.1), or it would report blocks wider than the corridor.

### 5.3 Negative Sampling

Landslide inventories record only positives. Negatives must be constructed, and this is the single most common source of a falsely excellent model:

1. Sample candidate negatives **only from slopes above a minimum gradient** (a flat floodplain pixel is a trivially easy negative and inflates accuracy without adding skill).
2. Enforce a **minimum buffer distance** from any recorded event, so that the immediate surroundings of a real failure are not labelled stable.
3. Match the **elevation distribution** of the positive set, so the classifier cannot separate classes on altitude rather than on process.
4. Maintain a **1:2 positive-to-negative ratio** (175 : 350). SMOTE was in the design and is not used: with balanced class weights the minority is learnable as it is, and synthetic positives on a 30 m grid are synthetic hillsides.

All three guards are implemented in `models/susceptibility/dataset.py` (`MIN_SLOPE_DEG = 10`, `BUFFER_M = 500`, `NEGATIVE_RATIO = 2`) and tested.

### 5.4 Handling a Sparse Inventory

- **What the pilot does:** class weighting rather than oversampling, and reporting both the blocked and the random-split AUC so the gap between them (the spatial leakage a naive split hides) is visible.
- **Designed, not built:** transfer learning from the denser Himachal Pradesh and Uttarakhand inventories, and inventory growth from moderated citizen reports. The app queues reports on the device today; no endpoint receives them yet.
- The honest finding is in §16A: the inventory's *location error*, not the model, is the binding constraint on this corridor.

---

## 6. Layer 2 — Dynamic Rainfall Trigger

> **Question answered:** *When will rain set it off?*

### 6.1 Model

**Built:** a regularised **logistic regression** over antecedent-rainfall features, with **sigmoid probability calibration** fitted by `TimeSeriesSplit` (`models/trigger/model.py`).

**Designed:** an LSTM over 30-day hourly rainfall sequences. That is the right model with thousands of labelled events. This corridor has **51** dated events in the rainfall record, and a recurrent network over 51 positives memorises them. The regression uses the same information the LSTM would have to rediscover — accumulations over increasing windows — and can be validated honestly at this sample size.

```
rain_1d, rain_3d, rain_7d, rain_15d, rain_30d      per event date and per matched non-event day
        │
  StandardScaler → LogisticRegression(class_weight="balanced")
        │
  CalibratedClassifierCV(method="sigmoid", cv=TimeSeriesSplit(4))
        │
  P(failure within 24 h)
```

Splits are **temporal, never random**: earlier monsoons train, later monsoons test. A random split puts one day of a storm in train and the next in test, and the model then "predicts" weather it has already seen.

### 6.2 Input Features

| Feature | Built | Description |
|---|---|---|
| Antecedent accumulations | ✓ | Daily rainfall summed over **1, 3, 7, 15 and 30 days**, from CHIRPS (daily, ~5 km) via Earth Engine; IMERG V07 (half-hourly, ~11 km) for sub-daily storm structure |
| Storm intensity–duration | ✓ extracted | Peak and mean intensity and duration of the current event, from IMERG half-hourly, with the half-step correction that a first-to-last-wet-timestamp span otherwise drops |
| I–D threshold exceedance | ✗ | Could not be fitted — see 6.3 |
| Soil moisture (SMAP) | ✗ | Designed |
| Antecedent Precipitation Index, seasonality | ✗ | Designed |

Because both rainfall products are coarser than the inventory's positional error, the imprecise landslide *locations* that ruin terrain modelling do not matter here — the pixel is the same either way. What matters is the event *date*, and the dates are reliable.

### 6.3 Intensity–Duration Threshold

A classical Guzzetti-style power-law threshold was to be retained as an interpretable baseline:

$$I = \alpha \cdot D^{-\beta}$$

It **could not be fitted to this inventory.** At every gap setting from 0.5 to 12 h the fitted exponent has the wrong sign (β = −0.406): recorded events show *higher* intensity with *longer* duration, which is physically backwards and most likely reporting bias — long, intense storms are the ones that get an event written down. `models/trigger/thresholds.py` raises `UnphysicalThreshold` rather than return a curve that would pass a sanity check it has already failed.

### 6.4 Imbalance and Calibration

Events occur on 0.8% of corridor-days. Balanced class weights are what make 51 positives learnable, but they fit a balanced prior: raw outputs read 0.64 where the true frequency is 0.008. That is harmless for ranking and fatal downstream, because risk is compared against absolute tier thresholds. Calibration brought the Brier score from **0.2440 to 0.0043** and is the reason the tier cut-points in §3 are the numbers they are. Focal loss and hard-negative mining, from the LSTM design, are not used.

---

## 7. Layer 3 — Slope Creep Detection (InSAR)

> **Question answered:** *Which slopes are already moving?*

This is the differentiating layer of the project. Rainfall-only models are, in the end, sophisticated weather forecasts. Deformation measurement observes the physical state of the slope itself.

### 7.1 Principle

**Interferometric Synthetic Aperture Radar (InSAR)** compares the phase of radar returns from repeat satellite passes over the same ground. A change in phase between two acquisitions corresponds to a change in the sensor-to-ground distance — line-of-sight (LOS) displacement — measurable to **millimetre precision**. Sentinel-1 provides this free of charge on a 6–12 day repeat cycle, and, critically, **radar penetrates cloud**, which matters in a region where optical imagery is useless for the entire monsoon.

### 7.2 Processing Chain (SBAS)

*Steps A–I below are performed by **COMET-LiCSAR**, which publishes unwrapped, geocoded interferograms for the Himalaya. Processing SLCs locally in SNAP or ISCE2 — the original design — means ~10 GB per acquisition; the pilot instead reads LiCSAR frame `048D_06252_131313` by HTTP byte range (`ingestion/clients/insar.py`), then does chain integration and epoch referencing itself (`processing/insar/`).*

```mermaid
flowchart LR
    A["Sentinel-1 SLC<br/>stack, single track"] --> B["Co-registration<br/>+ ESD refinement"]
    B --> C["Interferogram<br/>network generation"]
    C --> D["Topographic phase<br/>removal via DEM"]
    D --> E["Goldstein filtering<br/>+ multilooking"]
    E --> F["Coherence<br/>thresholding γ ≥ 0.3"]
    F --> G["Phase unwrapping<br/>SNAPHU"]
    G --> H["SBAS inversion<br/>→ displacement<br/>time series"]
    H --> I["Atmospheric<br/>phase screen removal"]
    I --> J["LOS velocity<br/>per coherent pixel"]
```

**SBAS (Small BAseline Subset)** is chosen over PSI (Persistent Scatterer) because NER slopes are vegetated and lack the stable man-made reflectors PSI depends on. SBAS uses distributed scatterers and short baselines, tolerating partial decorrelation far better.

### 7.3 Change-Point Detection

Displacement velocity time series per coherent pixel (or per slope polygon, spatially aggregated) are fed to the **`ruptures`** library using the PELT algorithm with an RBF cost function:

```python
import ruptures as rpt

algo   = rpt.Pelt(model="rbf", min_size=3, jump=1).fit(velocity_series)
breaks = algo.predict(pen=penalty)   # penalty tuned per corridor
```

A slope is flagged as **entering accelerated creep** when:
1. A change point is detected in the recent window, **and**
2. Mean velocity after the break exceeds mean velocity before it by a configurable factor, **and**
3. Post-break velocity magnitude exceeds the local noise floor (estimated from stable reference pixels in the same scene).

### 7.4 Handling Decorrelation — Reported Honestly

Dense vegetation causes InSAR decorrelation, and NER is densely vegetated. The system does **not** interpolate deformation across incoherent gaps to produce a prettier map. Instead:

- Deformation confidence is restricted to pixels above the coherence threshold.
- Every risk score carries a **coverage flag** — `full`, `partial`, or `none` — describing InSAR support for that segment.
- Where coverage is `none`, `D` defaults to 1.0 and the dashboard states plainly that the deformation layer is unavailable there.

On NH-10 this is the whole story: median coherence is **0.095 against the 0.30 threshold**, 33 of 96 segments are observable, all of them stable, and no public LiCSAR product predates March 2025 — so Layer 3 cannot improve any historical result either. §16A has the figures.

Reporting a coverage gap honestly is the correct engineering choice; a smoothly interpolated map that quietly invents data in exactly the places it cannot see is worse than no map at all.


---

## 8. Exposure & Risk Resolution

Hazard describes the slope. Risk describes the consequence. A high-hazard slope above an empty ravine is not the same as a moderate-hazard slope above a school, and the system must not rank them equally.

Hazard is intersected with exposure layers to produce a score **per road segment and per habitation — never per district.**

| Exposure layer | Source | Use |
|---|---|---|
| National & state highway centrelines | OSM, NHAI | Segmented into 1 km chainage units; each carries a criticality weight (sole-access corridors weighted highest) |
| Settlement density | WorldPop 100 m | Population within the runout buffer of the slope |
| Critical facilities | OSM + Bhuvan | Schools, PHCs, hospitals, relief centres |
| Traffic proxy | Road class + connectivity centrality | Approximates exposed vehicle-hours |

### 8.1 Spatial Units

```
Highway → 1 km chainage segments → buffered by runout distance → intersect hazard raster
Habitation → settlement polygon → buffered upslope catchment → intersect hazard raster
```

Runout distance is estimated from the slope's height and an empirical angle-of-reach (Fahrböschung) relationship, so that a slope 400 m above a road is correctly associated with that road even though the failure initiates well outside a naive fixed buffer.

### 8.2 Aggregation

For a segment `k` overlapping hazard cells `i`:

$$H_k = \text{percentile}_{90}\{ H_i : i \in k \} \qquad R_k = H_k \times E_k$$

The 90th percentile is used rather than the mean deliberately: a road kilometre is only as safe as its most dangerous slope, and averaging over a segment dilutes exactly the signal that matters.

---

## 9. Alerting & Delivery Layer

Delivery is **deliberately redundant**, because the network conditions during the event being warned about are precisely the worst conditions in the system's operating envelope.

### 9.1 Officials' Dashboard

Audience: PWD, BRO, NDRF, State Disaster Management Authorities, district control rooms. Built in `dashboard/` — React, TypeScript, MapLibre GL, Radix primitives, lucide icons.

| Feature | Built | Description |
|---|---|---|
| **Map** | ✓ | MapLibre GL over a desaturated OSM basemap; 96 segments coloured by band, with severity also encoded in **line width** (2 / 4 / 6 / 8 px) and a dash on Warning, so it survives greyscale and colour-vision deficiency. Single-layer views (susceptibility, trigger, deformation, exposure) on a neutral ramp |
| **Ranked list** | ✓ | Every kilometre sorted by risk or chainage, score bar per row, jump-to-km search, CSV export. Band filters and a drag-to-brush range on the strip narrow it |
| **Corridor strip** | ✓ | The whole road as a linear profile — the one view a folded mountain road cannot give on a map |
| **Inspector** | ✓ | Per-segment score meter against the calibrated thresholds, the four factor components as a bar, antecedent-rainfall sparkline, terrain features, nearby mapped scars, InSAR coverage; JSON export. Empty state carries the corridor summary |
| **Table view** | ✓ | Every value on screen reachable as text — what makes the colour encodings legal rather than merely mitigated |
| **Keyboard** | ✓ | Arrow keys, 1–4 band toggles, `c`, `t`, `?`, `Esc` |
| **Appearance** | ✓ | Light, dark, or follow the system; a high-contrast band mode ordered by lightness alone |
| **Per-alert explanation** | partial | The multiplicative components are shown; the SHAP waterfall over terrain features is designed |
| **Historical replay** | ✗ | The API serves one scored run; no per-day history is stored yet |
| **Deformation inspector** | ✗ | Designed; there is nothing observable to plot on this corridor |
| **Outcome feedback, OGC export** | ✗ | Designed |

### 9.2 Citizen App — Landsafe NER

Built in `citizen-app/` — Expo SDK 57 / React Native, Android-first. Five places and three pushed pages, in plain language: no score, probability, model name or "API" is ever shown to a citizen.

| Screen | What it does |
|---|---|
| **Today** | The band for the stretch the phone is on (Sevoke if location is off), as a word, an illustration of the hillside, the reasons in one sentence each, and what to do. The whole road as a strip |
| **Road** | The corridor drawn from its own geometry — works offline, no tile key — every kilometre tappable |
| **Route** | Sevoke-to-Gangtok journeys checked kilometre by kilometre; the worst band on the way, and where it is |
| **Report** | Road blocked, falling rocks, cracks, water — with a photo and location. **Queued on the device**: no endpoint receives reports yet, and the screen says so |
| **More** | Alert history recorded on the phone, the safety guide, emergency numbers, and where the advice comes from |

Behaviour that is built: the last reading is cached and served when the network fails, with its age stated; a banner drops only when the band on the user's stretch **escalates** (the same rule as the SMS dispatcher); the API host is derived from the address Expo delivered the bundle from, so a phone on the same wifi needs no configuration.

Designed, not built: push before storm onset, safe-route re-routing where an alternative exists, registered home corridors, regional-language interface, report upload and moderation.

### 9.3 SMS & IVR Fallback

Designed for **Assamese, Khasi, Mizo, Bodo, Nyishi, Manipuri**, Hindi and English; voice calls survive when data does not, and this is the single design choice that determines whether the system saves lives or produces reports.

What is built (`alerting/`):

- **Escalation-only dispatch.** An alert fires when a segment's band *worsens* to Orange or Red, never on every scoring cycle — a segment at Red for four days is one event, not thirty-two messages. De-escalation is silent; an "all clear" while the ground is saturated is a worse error than saying nothing.
- **Review-gated templates.** Every (tier, language) pair carries a status — `reviewed`, `draft`, `missing` — and a draft is never sent. If the requested language is not reviewed the dispatcher falls back to one that is, rather than sending machine text about an evacuation.
- **Gateways:** MSG91 adapter and a console gateway for dry runs.
- **Readiness report.** `make alerts` prints which gateway is configured, which languages can actually be sent, and the coverage grid.

What that report says today: **no provider credentials, so nothing reaches a phone; only English is reviewed.** IVR, delivery receipts and the escalation-to-control-room roster are designed, not built.

```
Alert raised → template selected by (tier, language)      built
             → SMS via gateway  ──► delivery receipt      built / designed
             → IVR call queued  ──► retry ×3              designed
             → unanswered → escalate to control room      designed
```

### 9.4 Feedback & Recalibration Loop *(designed)*

False alarms erode official trust faster than missed events erode it, because officials experience false alarms far more often. The system therefore treats calibration as a first-class, continuously running process:

1. Every dispatched alert is stored with its full input state and attribution.
2. Officials record the outcome — failure occurred / did not occur / minor slip only.
3. A scheduled job recomputes per-tier precision and the false-alarm rate per hundred alerts.
4. Tier thresholds are re-fit per corridor to hold false alarms within an operationally agreed budget while maximising recall at the Red tier.

None of this loop exists yet; thresholds are calibrated once from the risk distribution (§3).

### 9.5 Design System

The two interfaces share one rule and one ramp, and are otherwise deliberately different products.

| | Dashboard (`dashboard/`) | Citizen app (`citizen-app/`) |
|---|---|---|
| Ground | Cool fog, white panels; light, dark and system modes | Warm paper, light only — more legible in daylight through a rain-spotted screen |
| Type | IBM Plex Serif for headlines, Plex Sans for the interface, Plex Mono for every number | Fraunces for the lines that carry the message, Instrument Sans for everything read fast |
| Controls | Radix primitives, lucide icons | react-native-paper under a custom theme, lucide icons |
| Colour | No brand hue. Ink for every control; the only saturated colour is data | Same |

The risk ramp — moss `#3A8F5A`, amber `#D9A21B`, ember `#E0662B`, brick `#C8362B` — is the same hex in both, with a darker ink shade of each for text and a wash for large fields, so a person and a control room never see one kilometre in two colours. Model-layer identity uses a separate categorical palette that cannot be mistaken for a band. Nothing a person needs is ever gated behind an opacity animation; entrance motion moves or scales, and data-bearing dimensions are set directly.

---

## 10. Technology Stack

What runs in the pilot, and beside it what the full design adds.

| Layer | Built | Designed in addition |
|---|---|---|
| **Data ingestion** | Google Earth Engine (`earthengine-api`) for CHIRPS and IMERG; public AWS for Copernicus GLO-30; OSMnx for roads, settlements and facilities; LiCSAR HTTP byte-range reads for Sentinel-1 interferograms; NASA GLC and the Zenodo Sikkim inventory | Prefect scheduling, Sentinel-2 / NDVI, SMAP, IMD stations, GSI Bhukosh |
| **Processing** | `rasterio`, `xarray`, `geopandas`, WhiteboxTools (`richdem` has no arm64 wheel and does not compile against current clang) | SNAP / ISCE2 / SNAPHU for an SLC-to-displacement chain |
| **Models** | XGBoost with spatially blocked CV; scikit-learn logistic regression with `CalibratedClassifierCV`; change-point detection on LOS velocity; NumPy fusion | PyTorch LSTM, SHAP attribution, `ruptures` at scale |
| **Storage** | GeoParquet and COGs under `data/`, read directly by the API | PostgreSQL + PostGIS + TimescaleDB, MinIO / S3, Redis (the Compose stack exists; nothing writes to it) |
| **API** | FastAPI, Pydantic, uvicorn; 7 read endpoints; CORS scoped to the two front-ends | TiTiler, auth and RBAC, alert subscription, report intake |
| **Interfaces** | Dashboard: React 19, TypeScript, Vite, MapLibre GL 6, Radix, lucide, Framer Motion. App: Expo SDK 57, React Native, react-native-svg, react-native-paper, lucide, expo-location / image-picker / font | SMS via MSG91 (adapter built, no credentials); Twilio; IVR |
| **Quality** | pytest (160 tests), ruff, mypy, Vitest (app), `tsc` on both front-ends, GitHub Actions | Locust load tests, testcontainers integration, MLflow, DVC |

### Why these choices

- **Google Earth Engine** performs petabyte-scale raster operations server-side, eliminating the need for a GPU cluster or bulk imagery storage. This is the single decision that makes the system affordable enough to actually deploy.
- **PostGIS + TimescaleDB** in one PostgreSQL instance keeps spatial joins and time-series rollups in the same query engine, avoiding a cross-database join on the hot alerting path.
- **XGBoost over deep learning for Layer 1** — small tabular dataset, physically meaningful features, and native SHAP support that the explainability requirement makes non-negotiable.
- **A file-backed API** (`api/store.py`) rather than the designed PostGIS: the pipeline already writes GeoParquet, and reading it gives a working service with no database to run. Access goes through one `RiskStore` class, so the database is a later swap, not a rewrite.
- **LiCSAR instead of a local InSAR chain** — the difference between minutes per read and hours per interferogram, on a laptop.
- **COGs + TiTiler** (designed) would let the dashboard stream raster tiles directly from object storage; the pilot draws the 96 segments as vector GeoJSON and needs no tile server.

---

## 11. Data Sources

| Dataset | Source | Resolution / Cadence | Used in the pilot |
|---|---|---|---|
| **Terrain** | Copernicus GLO-30 DEM, from the public AWS bucket | 30 m | ✓ no credentials needed |
| **Rainfall, daily** | CHIRPS via Google Earth Engine | ~5 km, daily | ✓ trigger features |
| **Rainfall, sub-daily** | NASA GPM IMERG V07 via Earth Engine | ~11 km, 30 min | ✓ storm intensity–duration |
| **Radar deformation** | Sentinel-1 via COMET-LiCSAR interferograms | 100 m, 6–12 day | ✓ not observable here (coherence) |
| **Landslide inventory, locations** | Multi-temporal Sikkim catalogue (Zenodo, CC-BY) | 175 mapped polygons | ✓ Layer 1 labels |
| **Landslide inventory, dates** | NASA Global Landslide Catalog | Points, 5–25 km accuracy | ✓ Layer 2 event dates only |
| **Roads and exposure** | OpenStreetMap via OSMnx | Vector | ✓ 96 segments, 123 settlements, 68 facilities |
| **Inventory** | GSI Bhukosh | Mapped events | ✗ portal not reachable outside India |
| **Rainfall (in-situ)** | IMD AWS network & gridded product | Station / 0.25° | ✗ designed |
| **Optical / NDVI** | Sentinel-2, Landsat 8/9 | 10–30 m, 5 day | ✗ designed |
| **Soil moisture** | SMAP | 9 km, 2–3 day | ✗ designed |
| **Lithology & soil** | GSI geological maps, NBSS&LUP | 1:50k vector | ✗ designed |
| **Population** | WorldPop | 100 m | ✗ designed; OSM place classes stand in |

Every dataset in the operational path is **free and continuously refreshed**. No component depends on commercial imagery or on installed field sensors, which is what allows expansion from the pilot corridor to all eight NER states — and subsequently to the Western Himalaya and Western Ghats — to be a retraining exercise rather than a reinvestment.

---

## 12. Repository Structure

What is in the repository today. `data/` is produced by the pipeline and is git-ignored.

```
major/
├── README.md · IMPLEMENTATION.md · Landslide_Early_Warning_NER.md
├── Makefile · pyproject.toml · docker-compose.yml · .env.example
├── .github/workflows/ci.yml     # Python tests/lint/types, dashboard build, app tests
├── scripts/check-toolchain.sh
│
├── ingestion/
│   ├── aoi.py                   # pilot AOI, EPSG:32645
│   └── clients/
│       ├── dem.py               # Copernicus GLO-30 from public AWS
│       ├── earthengine.py       # EE session
│       ├── rainfall.py          # CHIRPS / IMERG at points; sub-daily storms
│       ├── insar.py             # LiCSAR frames, windowed byte-range reads
│       ├── inventory.py         # GLC, Sikkim polygons, fuzzy dedup, accuracy filter
│       ├── roads.py             # OSM highways → 1 km chainage
│       └── exposure.py          # OSM settlements and facilities
│
├── processing/
│   ├── dem/derivatives.py       # slope, aspect, curvature, TWI, SPI (WhiteboxTools)
│   ├── proximity.py             # distance to road
│   ├── featurestack.py          # aligned feature stack
│   └── insar/aggregate.py       # chain integration, referencing, per-segment series
│
├── models/
│   ├── susceptibility/
│   │   ├── dataset.py           # guarded negative sampling
│   │   ├── spatial_cv.py        # variogram → block size; blocked folds
│   │   └── train.py             # XGBoost; blocked and random AUC; raster inference
│   ├── trigger/
│   │   ├── model.py             # calibrated logistic regression, temporal split
│   │   └── thresholds.py        # Guzzetti I–D fit; raises when unphysical
│   ├── deformation/changepoint.py   # creep state → modifier D
│   ├── fusion/risk.py           # runout reach, 90th-percentile hazard, exposure, tiers
│   └── hindcast.py              # event replay; walk-forward lead times
│
├── api/
│   ├── main.py                  # FastAPI app, scoped CORS, /health
│   ├── store.py                 # file-backed RiskStore over GeoParquet
│   ├── routers/risk.py          # 6 risk endpoints
│   └── schemas/risk.py
│
├── alerting/
│   ├── dispatcher.py            # escalation-only dispatch
│   ├── templates/messages.py    # review-gated (tier, language) templates
│   ├── gateways/                # base, console (dry run), msg91
│   └── readiness.py             # `make alerts`
│
├── dashboard/                   # React + Vite + MapLibre — officials' console
│   └── src/
│       ├── components/landing/  # Hero, Metrics, Method, Proof, Corridor
│       ├── components/dashboard/# Console, CommandBar, Watchlist, MapPane,
│       │                        # CorridorStrip, Inspector, TableView, Shortcuts
│       ├── components/visuals/  # CorridorBlock, LayerStack (drawn figures)
│       ├── lib/                 # dashboard state, bands, motion, theme mode
│       ├── styles/tokens.css    # design tokens, light and dark
│       └── data/                # segment facts, rainfall, hindcast series
│
├── citizen-app/                 # Expo / React Native — Landsafe NER
│   └── src/
│       ├── screens/             # Splash, Today, MapScreen, Route, Report, Alerts, Safety, More
│       ├── components/          # TabBar, AlertBanner, Button, Card, Icons, Logo, …
│       ├── illustrations/       # Hillside, Hazards, Range, Quiet
│       └── lib/                 # api (cache-on-failure), explain, history, reports, theme, fonts
│
├── tests/
│   ├── unit/                    # 14 modules, one per pipeline stage
│   └── integration/test_api.py
│
└── data/                        # git-ignored pipeline outputs
    ├── raw/        dem/, inventory/
    ├── interim/    dem_utm.tif, roads, settlements, facilities, insar_chain
    └── processed/  terrain/*.tif, susceptibility.tif, rainfall/*, segment_risk.parquet,
                    tier_thresholds.parquet, hindcast_2016_07_21.parquet, lead_times.parquet
```

Not present, though the design names them: `notebooks/`, `docs/`, `infra/` (Kubernetes, Grafana), `ingestion/flows/` (Prefect), `processing/optical/`, `api/db/` migrations, `alerting/escalation.py`.

---

## 13. Database Schema *(design — not implemented)*

The API is file-backed (§10, `api/store.py`); none of these tables exist, and `docker compose up` brings up an empty PostGIS + TimescaleDB. The schema is kept because it is the shape a production deployment needs, and because `RiskStore` was written so that filling it in is one class.

### 13.1 Core Spatial Tables (PostGIS)

```sql
-- 1 km highway chainage units, the primary alerting unit
CREATE TABLE road_segments (
    id              BIGSERIAL PRIMARY KEY,
    highway_code    TEXT NOT NULL,              -- e.g. 'NH-10'
    chainage_km     NUMERIC(8,3) NOT NULL,
    state           TEXT NOT NULL,
    district        TEXT NOT NULL,
    geom            GEOMETRY(LineString, 4326) NOT NULL,
    criticality     NUMERIC(3,2) NOT NULL,      -- sole-access corridors → 1.00
    exposure_score  NUMERIC(4,3),
    UNIQUE (highway_code, chainage_km)
);
CREATE INDEX idx_road_segments_geom ON road_segments USING GIST (geom);

-- Habitations with upslope catchment
CREATE TABLE habitations (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    district        TEXT NOT NULL,
    population      INTEGER,
    geom            GEOMETRY(MultiPolygon, 4326) NOT NULL,
    catchment       GEOMETRY(MultiPolygon, 4326),
    exposure_score  NUMERIC(4,3)
);
CREATE INDEX idx_habitations_geom ON habitations USING GIST (geom);

-- Slope polygons carrying susceptibility and creep state
CREATE TABLE slope_units (
    id                 BIGSERIAL PRIMARY KEY,
    geom               GEOMETRY(Polygon, 4326) NOT NULL,
    mean_slope_deg     NUMERIC(5,2),
    lithology          TEXT,
    susceptibility     NUMERIC(4,3),            -- Layer 1 output
    susceptibility_ver TEXT,                    -- model version tag
    creep_state        TEXT CHECK (creep_state IN
                       ('stable','slow','accelerating','critical','unknown')),
    insar_coverage     TEXT CHECK (insar_coverage IN ('full','partial','none')),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_slope_units_geom ON slope_units USING GIST (geom);

-- Historical landslide inventory (training labels)
CREATE TABLE landslide_events (
    id            BIGSERIAL PRIMARY KEY,
    occurred_on   DATE,
    geom          GEOMETRY(Point, 4326) NOT NULL,
    source        TEXT NOT NULL,                -- 'GSI' | 'COOLR' | 'CITIZEN'
    fatalities    INTEGER,
    trigger_type  TEXT,
    confidence    TEXT,
    verified      BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_events_geom ON landslide_events USING GIST (geom);
CREATE INDEX idx_events_date ON landslide_events (occurred_on);
```

### 13.2 Time-Series Hypertables (TimescaleDB)

```sql
-- Rainfall observations per grid cell
CREATE TABLE rainfall_obs (
    ts          TIMESTAMPTZ NOT NULL,
    cell_id     INTEGER NOT NULL,
    precip_mm   REAL NOT NULL,
    source      TEXT NOT NULL,                  -- 'IMERG' | 'IMD_AWS' | 'IMD_GRID'
    PRIMARY KEY (cell_id, ts, source)
);
SELECT create_hypertable('rainfall_obs', 'ts', chunk_time_interval => INTERVAL '7 days');

-- Continuous aggregate powering antecedent-rainfall features
CREATE MATERIALIZED VIEW rainfall_daily
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 day', ts) AS day,
       cell_id,
       sum(precip_mm) AS precip_mm
FROM rainfall_obs
GROUP BY day, cell_id;

-- InSAR displacement time series per coherent pixel / slope unit
CREATE TABLE displacement_ts (
    ts             TIMESTAMPTZ NOT NULL,
    slope_unit_id  BIGINT NOT NULL REFERENCES slope_units(id),
    los_disp_mm    REAL NOT NULL,
    coherence      REAL NOT NULL,
    track          TEXT NOT NULL,
    PRIMARY KEY (slope_unit_id, ts, track)
);
SELECT create_hypertable('displacement_ts', 'ts', chunk_time_interval => INTERVAL '90 days');

-- Rolling risk scores
CREATE TABLE risk_scores (
    id             BIGSERIAL PRIMARY KEY,
    computed_at    TIMESTAMPTZ NOT NULL,
    target_type    TEXT NOT NULL CHECK (target_type IN ('segment','habitation')),
    target_id      BIGINT NOT NULL,
    horizon_h      SMALLINT NOT NULL CHECK (horizon_h IN (24,48,72)),
    susceptibility NUMERIC(4,3) NOT NULL,
    trigger_prob   NUMERIC(4,3) NOT NULL,
    deform_mod     NUMERIC(4,3) NOT NULL,
    exposure       NUMERIC(4,3) NOT NULL,
    risk           NUMERIC(4,3) NOT NULL,
    tier           TEXT NOT NULL CHECK (tier IN ('green','yellow','orange','red')),
    attribution    JSONB NOT NULL,              -- SHAP values per feature
    model_versions JSONB NOT NULL
);
SELECT create_hypertable('risk_scores', 'computed_at', chunk_time_interval => INTERVAL '30 days');
CREATE INDEX idx_risk_target ON risk_scores (target_type, target_id, computed_at DESC);
```

### 13.3 Operational Tables

```sql
CREATE TABLE alerts (
    id            BIGSERIAL PRIMARY KEY,
    risk_score_id BIGINT NOT NULL REFERENCES risk_scores(id),
    raised_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    tier          TEXT NOT NULL,
    prev_tier     TEXT,
    message_body  JSONB NOT NULL,               -- per-language rendered text
    outcome       TEXT CHECK (outcome IN
                  ('failure','no_failure','minor_slip','unknown')),
    outcome_by    TEXT,
    outcome_at    TIMESTAMPTZ
);

CREATE TABLE alert_deliveries (
    id          BIGSERIAL PRIMARY KEY,
    alert_id    BIGINT NOT NULL REFERENCES alerts(id),
    channel     TEXT NOT NULL CHECK (channel IN ('push','sms','ivr','dashboard')),
    recipient   TEXT NOT NULL,
    language    TEXT NOT NULL,
    status      TEXT NOT NULL,                  -- queued|sent|delivered|failed|answered
    attempts    SMALLINT NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE citizen_reports (
    id            BIGSERIAL PRIMARY KEY,
    submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    geom          GEOMETRY(Point, 4326) NOT NULL,
    photo_uri     TEXT,
    category      TEXT,                         -- crack | seepage | minor_slip | blockage
    description   TEXT,
    moderation    TEXT NOT NULL DEFAULT 'pending'
                  CHECK (moderation IN ('pending','accepted','rejected','duplicate')),
    promoted_event_id BIGINT REFERENCES landslide_events(id)
);
CREATE INDEX idx_reports_geom ON citizen_reports USING GIST (geom);
```

---

## 14. API Specification

FastAPI, served by `make api` on `0.0.0.0:8000`, prefix `/api/v1`. Read-only. CORS is scoped to the dashboard and app origins (`CORS_ORIGINS`), methods `GET` only.

### 14.1 Built

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Status, segments loaded, whether tiers are calibrated |
| `GET` | `/risk/segments?limit=500` | Every scored segment, ranked by risk |
| `GET` | `/risk/segments/{id}` | One segment with its components, runout reach and scoring timestamp |
| `GET` | `/risk/watchlist?limit=50` | Top-N — the dashboard's landing query |
| `GET` | `/risk/point?lat=&lon=` | Nearest segment to a coordinate, with the distance — what the app asks |
| `GET` | `/risk/geojson` | All segments as a FeatureCollection with properties, for the map |
| `GET` | `/risk/tiers` | The calibrated cut-points, so no client assumes them |

There is one scored run. Per-day history, and therefore replay and "sort by change", need a store that keeps previous runs.

### 14.2 Designed

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/risk/segments/{id}/explain` | SHAP attribution over terrain features |
| `GET` | `/risk/segments/{id}/history?from=&to=` | Score time series for replay |
| `GET` | `/deformation/{polygon_id}/series` | Displacement time series with change points |
| `POST` | `/alerts/subscribe` · `GET /alerts` · `POST /alerts/{id}/outcome` | Subscription, log, official feedback |
| `POST` | `/reports` · `GET /reports?bbox=` | Citizen report intake and moderation — the app queues these locally until it exists |
| `GET` | `/tiles/{layer}/{z}/{x}/{y}` · `/export/geojson?bbox=` | Raster tiles via TiTiler; OGC export |

### 14.3 Sample Response — `GET /risk/segments/NH-10:91.0`

Live from the pilot run — the highest-risk segment, in Gangtok:

```json
{
  "id": "NH-10:91.0",
  "highway_code": "NH-10",
  "chainage_km": 91.0,
  "risk": 0.00718,
  "tier": "red",
  "horizon_h": 24,
  "length_m": 1000.0,
  "components": {
    "susceptibility": 0.7131,
    "trigger_probability": 0.0101,
    "deformation_modifier": 1.0,
    "exposure": 1.0
  }
}
```

`risk = susceptibility × trigger_probability × deformation_modifier × exposure`, exactly, and `tier` is `risk` against `GET /risk/tiers` (red ≥ 0.00705, orange ≥ 0.00549, yellow ≥ 0.00429 on this run). The components are always returned with the score: an official who cannot see why a segment is red has no basis to act on it.

---

## 15. Machine Learning Pipeline

### 15.1 End-to-End Flow

```mermaid
flowchart LR
    subgraph OFF["Offline — retraining (seasonal)"]
        A1["Inventory + terrain<br/>+ NDVI"] --> A2["Negative sampling<br/>+ feature encoding"]
        A2 --> A3["Spatially blocked CV<br/>XGBoost training"]
        A3 --> A4["Susceptibility raster<br/>→ COG"]
        B1["CHIRPS / IMERG<br/>archive"] --> B2["Antecedent windows<br/>around event dates"]
        B2 --> B3["Calibrated logistic<br/>regression, temporal split"]
        B3 --> B4["Trigger model<br/>→ registry"]
    end
    subgraph ON["Online — inference (3-hourly)"]
        C1["Latest rainfall<br/>+ soil moisture"] --> C2["Trigger inference"]
        A4 --> C3["Fusion engine"]
        B4 --> C2 --> C3
        C4["Latest InSAR<br/>creep state"] --> C3
        C5["Exposure layer"] --> C3
        C3 --> C6["Risk scores<br/>+ components"] --> C7["Tier escalation<br/>detection"] --> C8["Alert dispatch"]
    end
```

*In the pilot the online cycle is run by hand: the modules are called in sequence and write GeoParquet, which the API serves. The scheduler is designed.*

### 15.2 Training Cadence *(designed)*

| Model | Retrain cadence | Trigger for off-cycle retrain |
|---|---|---|
| Susceptibility (XGBoost) | Seasonal, post-monsoon | ≥ 50 new verified inventory events |
| Trigger (calibrated regression) | Annual | Systematic drift in per-tier precision |
| Change-point detector | No training; parameters re-tuned per corridor | New track added, or noise-floor shift |
| Tier thresholds | Monthly during monsoon | False-alarm rate exceeding agreed budget |

### 15.3 Experiment Tracking & Reproducibility

Built:

- Every scored segment carries `computed_at` and `horizon_h`; the run is one immutable GeoParquet.
- The spatial block size is derived from a fitted variogram and logged, and fold assignments are computed from fixed seeds, so the blocked AUC is reproducible from the dataset alone.
- The hindcast refuses to run against tier thresholds derived from the replay window — a circularity that would otherwise flatter every result.

Designed: MLflow run tracking and DVC data versioning are in `pyproject.toml` and nothing calls them yet; the `model_versions` object on each score depends on the database that does not exist.

---

## 16. Validation Strategy & Metrics

This section matters more than the model code. A landslide model is trivially easy to make look excellent and very hard to make actually useful.

### 16.1 Spatially Blocked Cross-Validation — Mandatory

**Random train/test splits are invalid for this problem.** Neighbouring 30 m pixels share terrain, lithology, rainfall and often the same landslide scar. A random split places pixel `(i, j)` in train and `(i, j+1)` in test, the model memorises location rather than learning process, and AUC inflates to a meaningless 0.98+.

The system uses **spatial block cross-validation**: the study area is partitioned into contiguous blocks substantially larger than the spatial autocorrelation range of the terrain features (empirically estimated from a variogram), and whole blocks are held out.

```
❌ Random split          ✅ Spatial block split
┌───────────────┐        ┌───────┬───────┬───────┐
│ ▪▫▪▫▪▫▪▫▪▫▪▫ │        │ TRAIN │ TEST  │ TRAIN │
│ ▫▪▫▪▫▪▫▪▫▪▫▪ │        ├───────┼───────┼───────┤
│ ▪▫▪▫▪▫▪▫▪▫▪▫ │        │ TEST  │ TRAIN │ TRAIN │
└───────────────┘        ├───────┼───────┼───────┤
 AUC 0.98 — leaked       │ TRAIN │ TRAIN │ TEST  │
                         └───────┴───────┴───────┘
                          AUC 0.82 — honest
```

For the trigger model, splits are additionally **temporal** — train on earlier monsoons, test on later ones — because a random temporal split leaks the same storm into both sides.

### 16.2 Hindcast Validation

The primary evidence of usefulness is retrospective. Archived rainfall, terrain and Sentinel-1 data preceding a documented disaster are replayed through the full pipeline, and the system must be shown issuing an Orange or Red alert well before the actual failure.

Candidate hindcast events:

| Event | Location | Why it is a good test |
|---|---|---|
| 2023 Sikkim disaster | Teesta valley / NH-10 | High-impact, well documented, extensive Sentinel-1 archive |
| 2022 Tupul landslide | Noney district, Manipur | Catastrophic, with reported precursor movement |
| Recurrent NH-10 closures | Sevoke–Gangtok corridor | Multiple events allow lead-time distribution rather than a single anecdote |

A verified early warning on a real past event is far more persuasive evidence than a polished live dashboard.

### 16.3 Metrics Reported

| Metric | Why it is reported |
|---|---|
| **Spatially blocked AUC-ROC** | Honest discrimination; the only AUC that means anything here |
| **AUC-PR** | The right headline metric under severe class imbalance, where ROC flatters |
| **Precision & recall at each tier** | Officials act per tier, so metrics must be per tier |
| **Lead-time distribution** | Median and 10th-percentile hours between first Orange/Red and actual failure. A correct warning 20 minutes ahead is useless |
| **False alarms per 100 alerts** | The number that determines whether officials keep trusting the system |
| **Brier score & reliability diagram** | Is a stated 0.7 probability actually right about 70% of the time? |
| **Spatial coverage** | Fraction of the corridor with `full` / `partial` / `none` InSAR support |

### 16.4 On Honest Reporting

Claiming near-perfect accuracy on a sparse inventory signals overfitting to any technically literate reviewer. Target performance for this class of problem, honestly validated, is roughly **AUC 0.80–0.88** with a **usable lead time of 12–48 hours** — and that is a genuinely valuable system. The project reports the confusion matrix, the false alarms and the misses, not only the successes.

---

## 16A. Results

Every figure below is produced by the code in this repository and reproducible from the committed pipeline outputs. Where a layer did not work, that is stated rather than omitted.

### Layer 1 — Susceptibility

| Metric | Value |
|---|---|
| **AUC-ROC, spatially blocked** | **0.866** (5 folds over 59 blocks, fold range 0.805–0.912) |
| AUC-PR, spatially blocked | 0.752 |
| AUC-ROC, random split | 0.889 — *inflated by leakage, recorded only for comparison* |
| Training set | 175 mapped landslide polygons, 350 constructed negatives |
| Features | 9 terrain layers at 30 m |

Block size was **not guessed**. Variograms fitted to the corridor's own predictors give autocorrelation ranges of 1.4 km (plan curvature), 1.9 km (TWI) and 3.6 km (slope), producing **8 km blocks**. Raw elevation fits at 14 km, but that is the regional trend of a mountain front rather than autocorrelation, and including it would leave too few blocks to form folds.

The leakage gap is only **+0.023 AUC**, because the negative-sampling constraints — minimum slope, 500 m buffer from any scar, elevation matching — remove most of it before cross-validation runs.

**Operationally:** the most susceptible **5% of the corridor contains 40% of all mapped scar area** — a lift of 8.1×. At 10% it holds 56%.

### Layer 2 — Rainfall trigger

| Metric | Value |
|---|---|
| AUC-ROC, temporal holdout (2015+) | 0.601 |
| AUC-PR | 0.139 against a base rate of 0.0044 — **31.7× lift** |
| Brier score, calibrated | 0.0043 (0.2440 before calibration) |

Rainfall alone is weaker than it first appears. Seven-day antecedent rainfall scores **AUC 0.803 across the whole year but 0.619 within the monsoon**, at each event's own location. Most of the apparent skill was the calendar: events cluster in June–September and so does rain. The monsoon-controlled figure is the one to quote — it is the temporal analogue of spatial leakage.

Calibration mattered more than the model. Balanced class weights are what make 51 positives learnable, but they fit a balanced prior, so raw outputs read 0.64 where events occur 0.8% of the time. Harmless for ranking and fatal downstream, since risk is compared against absolute tier thresholds.

### Layer 3 — Deformation

**Not observable on this corridor.** Coherence over the AOI is **0.147 mean, 0.095 median, 0.239 at the 90th percentile** — all below the 0.30 threshold, verified against the raw product rather than inferred. Steep vegetated Himalayan slopes decorrelate at C-band.

Only **0.26%** of AOI pixels stay coherent through all 32 interferograms, though a 500 m buffer around the road recovers enough built-up ground that **33 of 96 segments** get a usable series. All 33 classify as stable, so the deformation modifier is 1.0 corridor-wide and no risk score changes.

Raw chain integration gave every segment a uniform 12–26 mm/yr, which was atmosphere rather than ground. Referencing each epoch to its spatial median moves velocities to **−1.9 mm/yr mean, range −19 to +8**.

Additionally, COMET-LiCS publishes only **March 2025 onward** publicly; everything earlier returns 403. There is therefore no InSAR for the hindcast event or for any event in the lead-time study, so this layer cannot improve any historical result.

### Tier calibration

Fixed 0.25/0.50/0.75 thresholds assume risk is a normalised index. Once the trigger model is calibrated to the true daily event rate, P<sub>t</sub> peaks at 0.024 and risk never exceeds 0.035 — the system would be permanently green and would never raise an alert. Thresholds are therefore derived as frequencies from the corridor's own distribution over 212,280 segment-days:

| Tier | Threshold |
|---|---|
| 🔴 Red | ≥ 0.01061 |
| 🟠 Orange | ≥ 0.00825 |
| 🟡 Yellow | ≥ 0.00657 |

### Hindcast — the primary evidence

Replaying the landslide of **21 July 2016**, 11 m from NH-10, using only rainfall that had already fallen and a trigger model fitted on data before 2015:

> **First Red on the failure segment: 13 July 2016 — 8 days before the landslide.**

Tier thresholds for this replay come from the full 2007–2018 record, not from the replay window, so the alert is not self-fulfilling.

### Lead-time distribution — 42 events, walk-forward

> **Re-run pending.** These figures were measured on the corridor as first built, whose chainage was stitched from OpenStreetMap pieces out of order: past km 50 it jumped between places and counted some stretches twice (§16B). 20 of the 42 events were matched to segments in that part. The corridor has since been rebuilt as one continuous path; the study must be re-run against it, which needs Earth Engine to re-fetch the rainfall. Until then treat the table below as provisional. The 2016 hindcast above is unaffected — its segment, km 3, is identical to within 0.2 m in both versions.

Each event scored by a model fitted only on years strictly before its own:

| Tier | Fired for | Median lead | 10th percentile | Max |
|---|---|---|---|---|
| Yellow | 15/42 (36%) | 16 d | 5 d | 20 d |
| Orange | 10/42 (24%) | 13 d | 3 d | 20 d |
| **Red** | **7/42 (17%)** | **9 d** | 3 d | 20 d |

**Detection, not lead time, is the weak link.** The warnings that do fire are timely — the 10th percentile is 3 days, so there are no useless twenty-minute alerts.

Detection is **28% for events within 1 km of the corridor against 8% further away**. That points at inventory location error rather than the models: for an event geocoded to a settlement 10 km off, the nearest segment is the wrong segment carrying the wrong susceptibility. Detection does not improve with more training data across years, so sample size is not the binding constraint either.

### The binding constraint: labels

| Source | In corridor | Located to ≤1 km |
|---|---|---|
| NASA GLC | 63 | 14 |
| NASA HMA | 69 | 16 |
| Combined, deduplicated | — | **16** |
| **Sikkim inventory (Zenodo, used)** | **175 polygons** | **all mapped** |

The global catalogues are news-derived and geocode most events to a settlement; at 25 km accuracy that is 833 pixels of error on a 30 m grid. GSI Bhukosh, the official Indian inventory, was unreachable. A published multi-temporal Sikkim inventory supplied the 175 mapped polygons the model is actually trained on.

Widening the area does not help: reaching 131 usable points from the global catalogues would require an 1,662 km study area spanning geology unrelated to this corridor.

### 16B. Corridor geometry — corrected

The first build cut NH-10 into segments by merging its OpenStreetMap ways and chaining the resulting pieces longest-first. OSM draws the highway as 87 ways — dual carriageways, overlapping duplicates, short spurs — which do not merge into one line, so the chain jumped between distant places, ran backwards, and counted stretches twice: 116 segments and "109.6 km", with Singtam numbered before Rangpo and Gangtok at km 73.8.

The corridor is now the shortest path through the ways as a graph, from the original km 0 to the far end in Gangtok (`corridor_path` in `ingestion/clients/roads.py`, with tests for out-of-order, duplicated and spurred ways). It is **95.2 km in 96 segments**, and the towns fall in road order: Teesta Bazaar km 31, Melli 37, Rangpo 54, Singtam 66, Ranipool 83, Gangtok 92. The first 50 km, including the hindcast segment, did not move.

Re-scoring on it gives Safe 52 · Caution 28 · Warning 14 · Danger 2; the highest-risk segments are km 90–91 in Gangtok, where susceptibility is high and exposure is the corridor's maximum.

### Intensity–duration threshold — not fitted

The classical Guzzetti baseline **cannot be fitted to this inventory**, and `fit_threshold` raises rather than returning a curve that is backwards. Daily CHIRPS gives only 6 distinct durations and a log-duration/log-intensity correlation of 0.009. Half-hourly IMERG gives 41 distinct durations and a correlation of 0.407 — but with the wrong sign, fitting β = −0.406 where physics requires β > 0. That holds at every storm-gap setting from 0.5 h to 12 h, so it is not a definition artefact. The likely cause is reporting bias: a news-derived inventory records large events during long monsoon spells, not short intense bursts.


---

## 17. Deployment Architecture *(design)*

Nothing below is deployed. The pilot runs on one machine: `make api` serves GeoParquet, the dashboard and the app connect to it over the local network. The diagram is the target once there is a database to deploy.

```mermaid
flowchart TB
    subgraph EXT["External"]
        GEEX["Google Earth Engine"]
        SMSX["SMS / IVR Gateway"]
    end
    subgraph K8S["Kubernetes Cluster"]
        subgraph WORK["Workloads"]
            APIP["api<br/>FastAPI · 3 replicas"]
            TILEP["titiler<br/>2 replicas"]
            WORKER["inference-worker<br/>CronJob 3-hourly"]
            INSARJ["insar-job<br/>CronJob on S1 pass"]
            DISP["alert-dispatcher<br/>Deployment"]
            PREF["prefect-agent"]
        end
        subgraph DATA["Stateful"]
            PGSQL[("PostgreSQL<br/>PostGIS + Timescale")]
            RDS[("Redis")]
            MINIO[("MinIO / S3<br/>COGs")]
        end
        subgraph OBS["Observability"]
            PROM["Prometheus"]
            GRAF["Grafana"]
        end
    end
    ING2["Ingress / TLS"] --> APIP & TILEP
    APIP --> PGSQL & RDS
    TILEP --> MINIO
    WORKER --> PGSQL & GEEX
    INSARJ --> MINIO & PGSQL
    DISP --> SMSX
    PROM --> GRAF
```

### 17.1 CI/CD

Built — `.github/workflows/ci.yml`, on every push to `main` and every pull request, three jobs in parallel:

```
python       uv install → ruff check → mypy (advisory) → pytest -m "not slow"
dashboard    npm ci → tsc --noEmit → vite build
citizen-app  npm install → tsc --noEmit → vitest
```

Tests that reach Earth Engine or LiCSAR need credentials, so CI runs the offline suite and marks the rest `slow`: skipped is better than a red build everyone learns to ignore. Image builds, staging and production deploys are designed.

### 17.2 Monitoring & Alerting on the System Itself *(designed)*

| Signal | Alert condition |
|---|---|
| Ingestion freshness | No rainfall data ingested for > 4 hours |
| Inference latency | 3-hourly cycle exceeding 20 minutes |
| InSAR job status | Missed acquisition window, or coherence coverage dropping sharply |
| Delivery success | SMS delivery rate below 90%, or IVR answer rate below 60% |
| Model drift | Rolling per-tier precision falling outside its calibrated band |
| Database | Timescale chunk bloat, replication lag, connection saturation |

A disaster warning system that fails silently is worse than no system, because the absence of an alert is read as safety. Every one of these signals pages an operator.

---

## 18. Local Setup

### 18.1 Prerequisites

- Python 3.11, Node.js 20+, git, GDAL (`gdalinfo`) — `make check` verifies all of them
- Docker only if you want the designed database stack; **nothing in the pilot needs it**
- A Google Earth Engine project (non-commercial registration is free) to pull rainfall
- No other credentials: the DEM comes from a public bucket, roads and exposure from OSM, interferograms from LiCSAR's open server

### 18.2 Bring-Up

```bash
git clone <repo-url> major && cd major
cp .env.example .env               # GEE_PROJECT_ID is the only value the pilot reads

make check                         # toolchain
make install                       # .venv + pip install -e ".[dev]"
make test                          # 160 tests, offline
make lint

make api                           # http://localhost:8000/api/v1/health — binds 0.0.0.0
make dashboard                     # http://localhost:5173  (needs make api in another shell)
make app                           # citizen app, web preview
make alerts                        # what the alerting layer could and could not send
```

`make api` serves `data/processed/segment_risk.parquet` and `tier_thresholds.parquet`. `data/` is git-ignored, so on a fresh clone the API reports the store as unavailable until the pipeline has been run — `ingestion/` → `processing/` → `models/` in module order, as documented in `IMPLEMENTATION.md` — or the two files are copied from a machine that has them. There is no single `make forecast` target yet.

### 18.2b Running the citizen app on a phone

```bash
make api                           # binds 0.0.0.0 so the phone can reach it
cd citizen-app && npx expo start   # scan the QR with Expo Go
```

The phone and the laptop must be on the same network. Check from the phone's
browser first — `http://<laptop-ip>:8000/api/v1/health` should return JSON. If it
times out, the network is isolating clients, which many campus networks do; a
phone hotspot works instead.

Two things had to be true for this to work at all, and neither is obvious:

- **The app cannot use `localhost`.** On a handset that resolves to the handset.
  The API host is derived from the address Expo already used to deliver the
  bundle, so no configuration is needed; `EXPO_PUBLIC_API_URL` overrides it.
- **The API cannot bind loopback.** `--host 0.0.0.0` is what makes it reachable
  from another device. That does expose it to everyone on the network — acceptable
  for a read-only development server on a trusted wifi, and not how it should be
  deployed. Production belongs behind a reverse proxy with TLS and auth.

### 18.3 Make Targets

| Target | Action |
|---|---|
| `make check` | Verify python3.11, node, docker, gdal, git |
| `make install` | Create `.venv` and install the project with dev extras |
| `make test` · `make lint` | pytest · ruff |
| `make api` | Run the API on `0.0.0.0:8000` from the pipeline outputs |
| `make dashboard` | Install and run the officials' console |
| `make app` | Install and run the citizen app in the browser |
| `make alerts` | Alerting readiness report |
| `make up` · `down` · `logs` · `db-shell` · `verify` · `migrate` · `clean` | The designed Postgres / Redis / MinIO / TiTiler stack via Docker Compose — optional, and unused by the pilot |

---

## 19. Configuration

`.env.example`. The pilot reads `GEE_PROJECT_ID`, the AOI block, and `MSG91_AUTH_KEY` if set; the rest configures the designed stack.

```bash
# ─── Database (designed stack) ──────────────────────────────
DATABASE_URL=postgresql+psycopg://landslide:landslide@localhost:5432/landslide
REDIS_URL=redis://localhost:6379/0

# ─── Object storage ─────────────────────────────────────────
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=landslide-cogs
S3_ACCESS_KEY=
S3_SECRET_KEY=

# ─── Earth observation credentials ──────────────────────────
GEE_PROJECT_ID=                   # the one credential the pilot needs
GEE_SERVICE_ACCOUNT=
GEE_PRIVATE_KEY_PATH=./secrets/gee-key.json
COPERNICUS_USER=
COPERNICUS_PASSWORD=
EARTHDATA_USER=
EARTHDATA_PASSWORD=

# ─── Alert gateways ─────────────────────────────────────────
SMS_PROVIDER=msg91                # msg91 | twilio
MSG91_AUTH_KEY=
MSG91_SENDER_ID=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
IVR_CALLER_ID=

# ─── Risk engine ────────────────────────────────────────────
AOI_BBOX=88.30,26.85,88.85,27.45  # pilot corridor
AOI_NAME=NH10_Sevoke_Gangtok
UTM_CRS=EPSG:32645
FORECAST_HORIZONS=24,48,72        # 24 built
TIER_THRESHOLDS=0.25,0.50,0.75    # design defaults; the pilot calibrates its own (§3)
INFERENCE_CRON=0 */3 * * *        # designed
INSAR_COHERENCE_THRESHOLD=0.30
SPATIAL_BLOCK_SIZE_M=5000         # overridden by the fitted variogram

# ─── Application ────────────────────────────────────────────
JWT_SECRET=
API_BASE_URL=http://localhost:8000
LOG_LEVEL=INFO
```

---

## 20. Known Challenges & Mitigations

| Challenge | Mitigation |
|---|---|
| **Sparse and incomplete landslide inventory in NER; severe class imbalance** | Guarded negative sampling (minimum slope, event buffer, elevation matching) and class weighting — built. Transfer learning from the Himachal and Uttarakhand inventories and inventory growth from moderated citizen reports — designed. The measured constraint is location error, not count: see §16A |
| **Persistent monsoon cloud cover blocks optical imagery** | The deformation layer uses radar (Sentinel-1), which penetrates cloud. Optical data is used only for slow-changing vegetation features, where a gap of days is harmless |
| **Dense vegetation causes InSAR decorrelation on NER slopes** | SBAS multi-temporal InSAR with coherence thresholding; deformation confidence restricted to coherent pixels; coverage reported honestly rather than interpolated over gaps |
| **False alarms erode official trust** | Four graded tiers rather than binary alerts, the factor components attached to every score, escalation-only dispatch — built. SHAP over terrain features and the outcome-feedback recalibration loop — designed |
| **Poor connectivity during the exact events being warned about** | SMS and IVR as the primary channel, app functions offline with the last-cached risk layer, alerts pre-pushed before storm onset |
| **IMERG rainfall is coarse (~10 km) relative to slope scale** | Bias-correct and downscale against IMD AWS station observations; propagate the resulting uncertainty into the trigger probability rather than hiding it |
| **DEM is dated relative to active hill cutting and road widening** | Detect new cut faces from Sentinel-2 change detection and flag affected slope units for susceptibility re-evaluation |
| **Model decay as terrain and land cover change** | Seasonal retraining, drift monitoring on per-tier precision, and automatic off-cycle retrain when the inventory grows materially |

---

## 21. Testing

`make test` runs **160 tests** in `tests/unit/` and `tests/integration/`, all offline; CI runs the same suite plus `tsc` and a build on both front-ends.

| Level | What is tested | Where |
|---|---|---|
| **Unit** | DEM derivatives against analytic surfaces; TWI / SPI; inventory loading, accuracy filtering and fuzzy dedup; Earth Engine date normalisation; sub-daily storm extraction; spatial CV block sizing and fold disjointness; negative-sampling guards; XGBoost training and raster inference; trigger calibration and temporal split; the I–D threshold raising on the wrong sign; change-point creep states; fusion, runout reach and tier calibration; hindcast replay and lead times; alert escalation rules and template review gating | `tests/unit/test_*.py` |
| **Integration** | Every API endpoint against a small fixture store | `tests/integration/test_api.py` |
| **Citizen app** | API host resolution and cache-on-failure | `citizen-app/src/lib/api.test.ts`, Vitest (8 tests) |
| **Dashboard** | Types and a production build | `tsc --noEmit`, `vite build` in CI — no component tests yet |

A dedicated test guards the property that matters most: **the spatial CV splitter must never place two spatially adjacent samples in different folds.** If that test fails, every reported metric in the project is invalid.

Designed, not present: `testcontainers` integration against a seeded database, Locust load tests, MLflow-backed AUC floors.

---

## 22. Limitations & Ethical Considerations

### Technical Limitations

*Measured on this corridor, not anticipated — see §16A for the figures.*

- **Detection is 17% at the Red tier** across 42 replayed events (provisional — measured on the first corridor build; re-run pending, §16A). The warnings that fire are timely (median 9 days), but most events produce no alert at all.
- **Inventory location error is the largest single cause.** Detection is 28% for events within 1 km of the corridor and 8% beyond it. The global catalogues locate most events to 5–25 km, which is 167–833 pixels at 30 m.
- **Layer 3 contributes nothing here.** Coherence is 0.095 median against a 0.30 threshold, and no public InSAR exists before March 2025, so it cannot improve any historical result either.
- **The intensity–duration baseline could not be fitted.** The inventory's duration and intensity correlate with the wrong sign, most likely reporting bias.
- **Rainfall carries modest skill** — AUC 0.60 within the monsoon. The three-layer design exists precisely because no single layer is sufficient.
- Deformation coverage is **not universal.** Dense vegetation leaves genuine blind spots; the system reports them rather than filling them in.
- InSAR revisit is **6–12 days.** A slope that goes from stable to failure inside a single revisit interval will not be caught by Layer 3, only by Layers 1 and 2.
- InSAR measures **line-of-sight** displacement only. Movement perpendicular to the satellite look direction is under-measured; combining ascending and descending tracks partially mitigates this.
- Rainfall forecasts carry their own error, which propagates into the 48 and 72 hour horizons. The 72 hour figure is a planning aid, not an evacuation trigger.
- The system does not model **earthquake-triggered** failures, and does not attempt to predict debris-flow runout paths in detail.

### Ethical Considerations

- **Human authority is retained.** The system ranks and explains; it does not order evacuations. Every alert is advisory to a named decision-maker.
- **Missed events are the costly error.** Thresholds are tuned to favour recall at the Red tier, with the false-alarm budget agreed with the operating authority rather than chosen by the model.
- **Explainability is a requirement, not a feature.** No alert is dispatched without its factor attribution, so that an official can interrogate why a road is being closed.
- **Equity of access.** Reliance on smartphone data would systematically exclude the most vulnerable populations. SMS and IVR in local languages exist precisely so that the warning does not stop at the digital divide.
- **Privacy.** Citizen reports are stored with coarsened location for public display; subscriber phone numbers are used solely for alert delivery and are never exposed through the API.
- **Avoiding harm from over-warning.** Repeated unnecessary road closures carry real economic and human cost in a region where a highway is the only supply line. Graded tiers exist so that "watch" and "close the road" are different actions.

---

## 23. Project Roadmap

| Phase | Deliverables | Status |
|---|---|---|
| **1 — Data foundation** | Ingestion flows, DEM derivatives, inventory cleaning for the pilot corridor | ☑ *schema written but unused — the API reads pipeline outputs directly, so the system runs without a database* |
| **2 — Susceptibility model** | Feature stack, negative sampling, XGBoost with spatially blocked CV, susceptibility raster | ☑ **AUC 0.866** blocked; SHAP explainer not wired into the API |
| **3 — Rainfall trigger** | Antecedent-rainfall features, calibrated probabilities, temporal validation | ☑ **31.7× lift**; regularised logistic regression rather than an LSTM — 51 positives would be memorised. I–D threshold cannot be fitted to this inventory |
| **4 — Deformation layer** | LiCSAR chain over the corridor, displacement time series, change-point detection, coverage flags | ☑ built, but **not observable here** — coherence 0.095 median against a 0.30 threshold |
| **5 — Fusion & exposure** | Runout buffers, segment scoring, tier calibration, exposure from settlements and facilities | ☑ 96 segments along one continuous path; exposure spans 0.15–1.00 from 123 OSM settlements and 68 facilities |
| **6 — API & dashboard** | FastAPI endpoints, React dashboard with map, watchlist, corridor strip and factor breakdown | ☑ 7 endpoints; TiTiler tiles and historical replay not built |
| **7 — Delivery** | SMS gateway, escalation dispatcher, delivery tracking, citizen app | ☑ *partial* — dispatcher and templates built; **English only** until translations are reviewed, **dry-run only** without credentials. Citizen app **Landsafe NER** built (Expo, 5 screens, offline cache, plain-language explanations); reports queue on device as no endpoint accepts them. IVR not built |
| **8 — Validation** | Hindcast, metric report, lead-time distribution | ☑ **8-day warning** on a real event; 42-event walk-forward study — see §16A |
| **9 — Hardening & scale-out** | Kubernetes deployment, monitoring, CI/CD, OGC export, extension beyond the pilot corridor | ☑ *partial* — GitHub Actions runs tests, lint, types and the dashboard build. Kubernetes, monitoring and OGC export not built |

### Pilot Scope

The pilot corridor is **NH-10, Sevoke–Gangtok** — arguably the most landslide-prone strategic highway in the country, with a dense documented event history, a sole-access role for Sikkim, and an extensive Sentinel-1 archive. Narrowing to one corridor and proving the model retrospectively is deliberately preferred over a shallow region-wide demonstration.

---

## 24. References

1. Geological Survey of India — National Landslide Susceptibility Mapping (NLSM) programme and the Bhukosh portal.
2. NASA Global Landslide Catalog and Cooperative Open Online Landslide Repository (COOLR).
3. ESA Copernicus Sentinel-1 and Sentinel-2 mission documentation; SBAS-InSAR methodology for slow-moving landslide detection.
4. Berardino, P. et al. — *A new algorithm for surface deformation monitoring based on small baseline differential SAR interferograms*, IEEE TGRS.
5. NASA GPM IMERG precipitation product technical documentation.
6. Guzzetti, F. et al. — *Rainfall intensity–duration control of shallow landslides and debris flows*, Meteorology and Atmospheric Physics.
7. Roberts, D. R. et al. — *Cross-validation strategies for data with temporal, spatial, hierarchical, or phylogenetic structure*, Ecography. (The basis for the spatial blocking requirement.)
8. Reichenbach, P. et al. — *A review of statistically-based landslide susceptibility models*, Earth-Science Reviews.
9. NDMA National Disaster Management Guidelines on Landslides and Snow Avalanches; NDMA SACHET / Common Alerting Protocol.
10. ISRO Bhuvan and NRSC landslide hazard zonation datasets.
11. Lundberg, S. & Lee, S.-I. — *A unified approach to interpreting model predictions* (SHAP), NeurIPS.
12. Killick, R. et al. — *Optimal detection of changepoints with a linear computational cost* (PELT), JASA.

---

## Integration Path

Outputs are designed to be publishable to NDMA, SDMA and Bhuvan through standard **OGC services**, and the alert layer can feed the existing **Common Alerting Protocol** used by NDMA's SACHET platform. The system is intended to slot into existing institutional workflows rather than ask them to reorganise around it.

---

<div align="center">

**Built with freely available satellite and meteorological data.**
No new field hardware. Scales by retraining, not reinvestment.

</div>
