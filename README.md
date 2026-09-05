# Landslide Early Warning & Risk Monitoring System

**A multi-layer geospatial machine learning system that fuses terrain, rainfall and satellite-measured ground deformation into a rolling 24–72 hour landslide risk forecast for the North Eastern Region of India — resolved to individual slopes and road kilometres, and delivered over channels that survive a storm.**

> Major Project — Department of Computer Science & Engineering
> Domain: Geospatial AI · Remote Sensing · Disaster Management

---

## Status

Built and validated on the **NH-10 Sevoke–Gangtok pilot corridor** — 109.6 km, 116 one-kilometre segments scored daily from satellite data alone.

| | |
|---|---|
| **Susceptibility** | **AUC 0.866** spatially blocked, 59 blocks · trained on 175 mapped landslide polygons |
| **Hindcast** | **Red raised 8 days before** the landslide of 21 July 2016, 11 m from NH-10 |
| **Trigger** | **31.7× lift** over base rate, calibrated to the true daily event rate |
| **Across 42 events** | Red fired before **17%**, median lead **9 days**, walk-forward validated |
| **Deformation** | **Not observable here** — coherence 0.095 median against a 0.30 threshold |

The binding constraint is not the model. It is inventory location error: detection is **28% for events within 1 km of the corridor and 8% beyond it**, because the global catalogues locate most landslides to 5–25 km.

Full figures, including what did not work and why, in [§16A Results](#16a-results). SMS dispatch is built and tested but runs dry — it has no provider credentials, and only English has been through review, so no other language will send. `make alerts` reports exactly what could and could not reach a phone.

---

## Table of Contents

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
| `P_t` | Trigger probability at horizon *t* ∈ {24, 48, 72} h | 0–1 | Layer 2 (LSTM) | Every 3 hours |
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

| Tier | Risk score `R` | Meaning | Recommended action |
|---|---|---|---|
| 🟢 **Green** | 0.00 – 0.25 | Normal | Routine monitoring |
| 🟡 **Yellow** | 0.25 – 0.50 | Watch | Inspect drains and culverts; brief field staff |
| 🟠 **Orange** | 0.50 – 0.75 | Alert | Pre-position clearing equipment; advise avoiding the segment at night |
| 🔴 **Red** | 0.75 – 1.00 | Warning | Restrict traffic; prepare evacuation of flagged habitations |

Thresholds are **not hard-coded constants** — they are calibrated per corridor against the historical inventory and are recalibrated from the official feedback loop (see §9.4).

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

```mermaid
flowchart TB
    subgraph SRC["🛰️  Data Sources (all free / public)"]
        S1["Sentinel-1 SLC<br/>radar, 6-12 day"]
        S2["Sentinel-2 / Landsat<br/>optical, NDVI"]
        GPM["GPM IMERG<br/>rainfall, 30 min"]
        IMD["IMD gridded +<br/>AWS stations"]
        SMAP["SMAP<br/>soil moisture"]
        DEM["CartoDEM / SRTM<br/>30 m terrain"]
        INV["GSI NLSM +<br/>NASA COOLR inventory"]
        OSM["OSM roads / WorldPop<br/>exposure"]
    end

    subgraph ING["⚙️  Ingestion & Orchestration"]
        PF["Prefect / Airflow<br/>scheduled flows"]
        GEE["Google Earth Engine<br/>server-side raster ops"]
    end

    subgraph PROC["🧮  Processing"]
        DER["DEM derivatives<br/>slope, aspect, TWI, SPI"]
        INSAR["SBAS-InSAR chain<br/>SNAP / ISCE2"]
        STACK["Feature stack assembly<br/>rasterio / xarray"]
    end

    subgraph MOD["🧠  Model Layer"]
        L1["Layer 1<br/>XGBoost susceptibility"]
        L2["Layer 2<br/>LSTM rainfall trigger"]
        L3["Layer 3<br/>ruptures change-point"]
        FUSE["Risk fusion engine"]
        SHAP["SHAP explainer"]
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
    FUS->>DB: upsert risk_scores + SHAP attribution
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
│  XGBoost susceptibility · LSTM trigger · change-point detector      │
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

A gradient-boosted decision tree classifier (**XGBoost**) trained on the GSI National Landslide Susceptibility Mapping inventory and the NASA COOLR event catalogue. Output is a continuous susceptibility raster at 30 m, refreshed seasonally (post-monsoon, when new failures and new vegetation state are available).

Gradient boosting is chosen over deep CNN approaches for three reasons: the inventory is small and sparse (hundreds to low thousands of labelled events, not millions), tabular terrain features are already physically meaningful so learned convolutional features add little, and tree ensembles are directly interpretable through SHAP — which the alerting requirement demands.

### 5.2 Feature Set

| Group | Features | Derived from |
|---|---|---|
| **Topography** | Slope angle, aspect (sin/cos encoded), plan curvature, profile curvature, relative relief, elevation | CartoDEM / SRTM 30 m |
| **Hydrology** | Topographic Wetness Index (TWI), Stream Power Index (SPI), distance to drainage, flow accumulation | DEM-derived |
| **Anthropogenic** | Distance to road cuts, road-cut density, distance to settlements | OSM + Bhuvan |
| **Structural** | Distance to lineaments, distance to mapped faults, lithology class, weathering grade | GSI geological layers |
| **Soil** | Soil texture class, soil depth, drainage class | NBSS&LUP |
| **Vegetation** | NDVI (seasonal mean and dry-season minimum), land-cover class, forest-loss flag | Sentinel-2 / Landsat |

Feature engineering notes:
- **Aspect is circular.** It is encoded as `(sin θ, cos θ)`, never as raw degrees — a naive 0–360 encoding puts north-facing 359° and 1° slopes at opposite ends of the feature space.
- **TWI** = `ln(a / tan β)` where `a` is upslope contributing area per unit contour width and `β` is local slope. It captures where water accumulates and pore pressure builds.
- **SPI** = `a × tan β`, capturing erosive power of concentrated flow.
- Categorical layers (lithology, soil, land cover) are target-encoded with out-of-fold statistics to avoid leakage.

### 5.3 Negative Sampling

Landslide inventories record only positives. Negatives must be constructed, and this is the single most common source of a falsely excellent model:

1. Sample candidate negatives **only from slopes above a minimum gradient** (a flat floodplain pixel is a trivially easy negative and inflates accuracy without adding skill).
2. Enforce a **minimum buffer distance** from any recorded event, so that the immediate surroundings of a real failure are not labelled stable.
3. Match the **elevation and lithology distribution** of the positive set, so the classifier cannot separate classes on a proxy variable.
4. Maintain a **1:2 positive-to-negative ratio**, with SMOTE applied to the minority class *inside each training fold only*.

### 5.4 Handling a Sparse Inventory

- **Transfer learning** from the substantially denser Himachal Pradesh and Uttarakhand inventories: pre-train on the Western Himalaya, fine-tune on NER events.
- **Continuous inventory growth** from citizen geotagged reports of cracks and minor slips, which flow back into the training set after moderation.
- Class weighting via `scale_pos_weight` rather than aggressive oversampling alone.

---

## 6. Layer 2 — Dynamic Rainfall Trigger

> **Question answered:** *When will rain set it off?*

### 6.1 Model

An **LSTM sequence model** over rainfall history. Sequence models are appropriate here because landslide triggering is fundamentally a memory process: it is not today's rainfall that fails a slope but today's rainfall arriving on a slope already saturated by three weeks of monsoon.

```
Input sequence  →  [B, T=720, F]     T = 30 days at hourly resolution
                        │
                 ┌──────▼──────┐
                 │  LSTM (2×)  │     hidden = 128, dropout = 0.2
                 └──────┬──────┘
                        │  last hidden state
                 ┌──────▼──────┐
                 │  concat     │  ← static context: susceptibility,
                 │  static ctx │     elevation band, lithology embedding
                 └──────┬──────┘
                 ┌──────▼──────┐
                 │  Dense 64   │  ReLU
                 └──────┬──────┘
                 ┌──────▼──────┐
                 │  Dense 3    │  sigmoid → P(24h), P(48h), P(72h)
                 └─────────────┘
```

### 6.2 Input Features

| Feature | Description |
|---|---|
| Hourly precipitation | GPM IMERG half-hourly, aggregated to hourly |
| Antecedent accumulations | Rolling sums at **3, 7, 15 and 30 days** |
| Storm intensity–duration | Peak intensity, mean intensity, duration of the current rainfall event |
| I–D threshold exceedance | Ratio of observed `(I, D)` to the Guzzetti regional threshold curve |
| Soil moisture | SMAP surface and root-zone moisture, gap-filled and downscaled |
| API | Antecedent Precipitation Index with a decay constant fitted per lithology |
| Seasonality | Day-of-monsoon encoded cyclically |

### 6.3 Intensity–Duration Threshold

A classical Guzzetti-style power-law threshold is retained as an interpretable baseline and as a physical sanity check on the LSTM:

$$I = \alpha \cdot D^{-\beta}$$

where `I` is mean rainfall intensity (mm/h), `D` is duration (h), and `α`, `β` are fitted regionally from the inventory. Any LSTM prediction that fires far below the fitted threshold curve is logged for review rather than silently trusted — this catches the model latching onto a spurious seasonal correlate.

### 6.4 Loss & Imbalance

Failure events are extremely rare in a per-hour, per-cell framing (well under 0.1% positives). Training uses **focal loss** with `γ = 2` to stop the vast easy-negative majority from dominating the gradient, plus temporal negative mining that preferentially samples high-rainfall non-failure windows — the hard negatives that teach the model where the real boundary is.

---

## 7. Layer 3 — Slope Creep Detection (InSAR)

> **Question answered:** *Which slopes are already moving?*

This is the differentiating layer of the project. Rainfall-only models are, in the end, sophisticated weather forecasts. Deformation measurement observes the physical state of the slope itself.

### 7.1 Principle

**Interferometric Synthetic Aperture Radar (InSAR)** compares the phase of radar returns from repeat satellite passes over the same ground. A change in phase between two acquisitions corresponds to a change in the sensor-to-ground distance — line-of-sight (LOS) displacement — measurable to **millimetre precision**. Sentinel-1 provides this free of charge on a 6–12 day repeat cycle, and, critically, **radar penetrates cloud**, which matters in a region where optical imagery is useless for the entire monsoon.

### 7.2 Processing Chain (SBAS)

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

Audience: PWD, BRO, NDRF, State Disaster Management Authorities, district control rooms.

| Feature | Description |
|---|---|
| **Map view** | MapLibre GL, vector risk layers over terrain basemap; tier-coloured road segments |
| **Ranked watchlist** | Top-N highest-risk road kilometres, sortable by risk, tier change, or lead time |
| **Per-alert explanation** | SHAP waterfall showing which factors drove the score — rainfall accumulation, slope, creep state, distance to road cut |
| **Historical replay** | Scrub any past date range and watch risk evolve; used both for training officials and for post-event review |
| **Deformation inspector** | Displacement time series plot per slope, with detected change points marked |
| **Outcome feedback** | Officials mark whether a failure occurred, feeding threshold recalibration |
| **Export** | GeoJSON / OGC WMS-WFS for ingestion into existing state GIS |

### 9.2 Citizen Mobile App

React Native, Android-first (the dominant platform in the target districts).

- **Location-based alerts** for the user's registered home and travel corridors.
- **Safe-route guidance** — routes weighted to avoid Orange/Red segments where an alternative exists.
- **Geotagged photo reporting** of observed cracks, seepage or minor slips. This is not decoration: moderated reports feed straight back into the training inventory and steadily improve the model in a region where the inventory is the binding constraint.
- **Offline mode** — the last-cached risk layer and safe-route map remain usable with no connectivity.
- **Pre-push before storm onset** — alerts are pushed *ahead* of the predicted rainfall window, while the network is still up.

### 9.3 SMS & IVR Fallback

Supported languages: **Assamese, Khasi, Mizo, Bodo, Nyishi, Manipuri** (plus Hindi and English).

Voice calls survive when data does not, and this is the single design choice that determines whether the system saves lives or produces reports. IVR delivers a pre-recorded message per tier per language, assembled from templated segments with the location name spliced in. Delivery receipts are tracked so that undelivered alerts can be escalated to the local control room for manual relay.

```
Alert raised → template selected by (tier, language)
             → SMS via gateway  ──► delivery receipt logged
             → IVR call queued  ──► answered / unanswered / retry ×3
             → unanswered after retries → escalate to control room roster
```

### 9.4 Feedback & Recalibration Loop

False alarms erode official trust faster than missed events erode it, because officials experience false alarms far more often. The system therefore treats calibration as a first-class, continuously running process:

1. Every dispatched alert is stored with its full input state and attribution.
2. Officials record the outcome — failure occurred / did not occur / minor slip only.
3. A scheduled job recomputes per-tier precision and the false-alarm rate per hundred alerts.
4. Tier thresholds are re-fit per corridor to hold false alarms within an operationally agreed budget while maximising recall at the Red tier.

---

## 10. Technology Stack

| Layer | Components | Technology |
|---|---|---|
| **Data Ingestion** | Scheduled pulls of Sentinel-1 SLC, Sentinel-2, GPM IMERG, IMD grids, SMAP, CartoDEM, GSI inventory | Prefect / Airflow, Google Earth Engine, Sentinel Hub API, `sentinelsat` |
| **Processing** | DEM derivative computation, InSAR interferogram generation, cloud masking, feature stack assembly | Google Earth Engine, Python, `rasterio`, `xarray`, `richdem`, SNAP / ISCE2, SNAPHU |
| **Models** | Susceptibility classifier, rainfall trigger sequence model, deformation change-point detector, explainability | XGBoost, PyTorch (LSTM), `ruptures`, SHAP |
| **Storage** | Vector risk layers, raster tiles, rainfall and displacement time series | PostgreSQL + PostGIS, TimescaleDB, MinIO / S3 for COGs |
| **API & Serving** | Risk queries, alert subscription, tile server, admin endpoints | FastAPI, Pydantic, Redis cache, TiTiler |
| **Interfaces** | Officials' web dashboard, citizen mobile app, SMS/IVR gateway | React + TypeScript + MapLibre GL, React Native, Twilio / MSG91 |
| **Deployment** | Containerised services, scheduled retraining, monitoring | Docker, Docker Compose (dev), Kubernetes (prod), GitHub Actions, Prometheus + Grafana |
| **Quality** | Testing, linting, typing, reproducibility | pytest, ruff, mypy, DVC, MLflow |

### Why these choices

- **Google Earth Engine** performs petabyte-scale raster operations server-side, eliminating the need for a GPU cluster or bulk imagery storage. This is the single decision that makes the system affordable enough to actually deploy.
- **PostGIS + TimescaleDB** in one PostgreSQL instance keeps spatial joins and time-series rollups in the same query engine, avoiding a cross-database join on the hot alerting path.
- **XGBoost over deep learning for Layer 1** — small tabular dataset, physically meaningful features, and native SHAP support that the explainability requirement makes non-negotiable.
- **COGs + TiTiler** allow the dashboard to stream raster tiles directly from object storage with no pre-tiling step and no tile cache to invalidate on every model refresh.

---

## 11. Data Sources

| Dataset | Source | Resolution / Cadence | Access |
|---|---|---|---|
| **Radar deformation** | Sentinel-1 (ESA Copernicus) | 5–20 m, 6–12 day repeat | Free |
| **Optical / NDVI** | Sentinel-2, Landsat 8/9 | 10–30 m, 5 day | Free |
| **Rainfall (satellite)** | NASA GPM IMERG | ~10 km, 30 min | Free |
| **Rainfall (in-situ)** | IMD AWS network & gridded product | Station / 0.25° | Public / MoU |
| **Terrain** | CartoDEM (ISRO), SRTM, ALOS PALSAR | 30 m | Free |
| **Landslide inventory** | GSI NLSM, NASA COOLR | Point events | Free / GSI Bhukosh portal |
| **Soil moisture** | SMAP | 9 km, 2–3 day | Free |
| **Lithology & soil** | GSI geological maps, NBSS&LUP | 1:50k vector | Public |
| **Exposure** | OpenStreetMap roads, WorldPop, Bhuvan | Vector / 100 m | Free |

Every dataset in the operational path is **free and continuously refreshed**. No component depends on commercial imagery or on installed field sensors, which is what allows expansion from the pilot corridor to all eight NER states — and subsequently to the Western Himalaya and Western Ghats — to be a retraining exercise rather than a reinvestment.

---

## 12. Repository Structure

```
major/
├── README.md
├── docker-compose.yml
├── Makefile
├── pyproject.toml
├── .env.example
│
├── data/
│   ├── raw/                     # immutable downloads (DVC-tracked, gitignored)
│   ├── interim/                 # intermediate rasters
│   ├── processed/               # model-ready feature stacks
│   └── external/                # inventories, admin boundaries
│
├── ingestion/
│   ├── flows/
│   │   ├── rainfall_flow.py     # 3-hourly IMERG + IMD pull
│   │   ├── sentinel1_flow.py    # SLC acquisition on each pass
│   │   ├── sentinel2_flow.py    # NDVI refresh
│   │   ├── smap_flow.py         # soil moisture
│   │   └── inventory_flow.py    # GSI / COOLR sync
│   ├── clients/                 # GEE, Sentinel Hub, IMD, NASA Earthdata
│   └── provenance.py            # source, timestamp, checksum logging
│
├── processing/
│   ├── dem/
│   │   ├── derivatives.py       # slope, aspect, curvature, TWI, SPI
│   │   └── hydrology.py         # flow accumulation, drainage
│   ├── insar/
│   │   ├── coregister.py
│   │   ├── interferogram.py
│   │   ├── unwrap.py            # SNAPHU wrapper
│   │   ├── sbas.py              # time-series inversion
│   │   └── coherence.py         # masking & coverage flags
│   ├── optical/
│   │   ├── cloud_mask.py
│   │   └── ndvi.py
│   └── featurestack.py          # aligned multi-band stack assembly
│
├── models/
│   ├── susceptibility/
│   │   ├── dataset.py           # sampling, negatives, encoding
│   │   ├── train.py             # XGBoost + spatial CV
│   │   ├── predict.py           # raster inference
│   │   └── explain.py           # SHAP
│   ├── trigger/
│   │   ├── sequences.py         # window construction
│   │   ├── model.py             # LSTM definition
│   │   ├── train.py             # focal loss, temporal split
│   │   └── thresholds.py        # Guzzetti I–D baseline
│   ├── deformation/
│   │   ├── changepoint.py       # ruptures / PELT
│   │   └── classify.py          # creep state → modifier D
│   └── fusion/
│       ├── risk.py              # R = S × P × D × E
│       ├── exposure.py          # runout buffers, segment joins
│       └── calibration.py       # tier threshold fitting
│
├── api/
│   ├── main.py
│   ├── routers/                 # risk, alerts, reports, admin, auth
│   ├── schemas/                 # Pydantic models
│   ├── db/                      # SQLAlchemy models, migrations
│   ├── services/                # alert dispatch, SHAP formatting
│   └── cache.py
│
├── alerting/
│   ├── dispatcher.py            # tier transitions → channel fan-out
│   ├── templates/               # per-language SMS & IVR scripts
│   ├── gateways/                # Twilio / MSG91 adapters
│   └── escalation.py
│
├── dashboard/                   # React + TypeScript + MapLibre
│   ├── src/
│   │   ├── components/
│   │   ├── pages/               # Map, Watchlist, Replay, Deformation
│   │   ├── hooks/
│   │   └── api/
│   └── package.json
│
├── citizen-app/                 # React Native
│   ├── src/
│   │   ├── screens/             # Alerts, SafeRoute, Report, Offline
│   │   ├── services/            # geolocation, cache, push
│   │   └── i18n/                # 6 regional languages
│   └── package.json
│
├── notebooks/
│   ├── 01_inventory_eda.ipynb
│   ├── 02_terrain_features.ipynb
│   ├── 03_susceptibility_training.ipynb
│   ├── 04_rainfall_sequences.ipynb
│   ├── 05_insar_timeseries.ipynb
│   └── 06_hindcast_validation.ipynb
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
│
├── infra/
│   ├── k8s/
│   ├── grafana/
│   └── github-actions/
│
└── docs/
    ├── architecture.md
    ├── data-dictionary.md
    ├── model-cards/
    └── api.md
```

---

## 13. Database Schema

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

Base URL: `/api/v1` · Auth: JWT bearer tokens, role-based (`public`, `official`, `admin`)

### 14.1 Risk

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/risk/segments` | Risk for road segments; filters `?highway=NH-10&tier=orange,red&horizon=24` |
| `GET` | `/risk/segments/{id}` | Full detail for one segment including component breakdown |
| `GET` | `/risk/segments/{id}/explain` | SHAP attribution for the latest score |
| `GET` | `/risk/habitations` | Risk per habitation, same filters |
| `GET` | `/risk/point?lat=&lon=` | Nearest-slope risk for an arbitrary coordinate (citizen app) |
| `GET` | `/risk/watchlist?limit=50` | Ranked top-risk segments — dashboard landing query |
| `GET` | `/risk/history?target_id=&from=&to=` | Time series for historical replay |

### 14.2 Deformation

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/deformation/slopes/{id}/timeseries` | LOS displacement series with detected change points |
| `GET` | `/deformation/coverage` | InSAR coherence coverage map for the AOI |

### 14.3 Alerts

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/alerts` | Alert history with filters |
| `POST` | `/alerts/subscribe` | Register phone / device for a location or corridor |
| `DELETE` | `/alerts/subscribe/{id}` | Unsubscribe |
| `POST` | `/alerts/{id}/outcome` | Official records what actually happened *(role: official)* |
| `GET` | `/alerts/{id}/deliveries` | Per-channel delivery status *(role: official)* |

### 14.4 Citizen Reports

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/reports` | Submit geotagged observation with photo |
| `GET` | `/reports` | List reports *(role: official)* |
| `PATCH` | `/reports/{id}/moderate` | Accept / reject / mark duplicate *(role: official)* |

### 14.5 Tiles & Export

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/tiles/susceptibility/{z}/{x}/{y}.png` | Susceptibility raster tiles via TiTiler |
| `GET` | `/tiles/risk/{z}/{x}/{y}.mvt` | Vector risk tiles |
| `GET` | `/export/geojson?bbox=` | GeoJSON export for state GIS |
| `GET` | `/ogc/wms` | OGC WMS endpoint for NDMA / SDMA / Bhuvan integration |

### 14.6 Sample Response

```jsonc
GET /api/v1/risk/segments/1842?horizon=24

{
  "segment": {
    "id": 1842,
    "highway_code": "NH-10",
    "chainage_km": 27.0,
    "district": "Kalimpong",
    "state": "West Bengal"
  },
  "computed_at": "2026-06-18T09:00:00Z",
  "horizon_h": 24,
  "risk": 0.81,
  "tier": "red",
  "components": {
    "susceptibility": 0.88,
    "trigger_probability": 0.71,
    "deformation_modifier": 1.35,
    "exposure": 0.97
  },
  "deformation": {
    "creep_state": "accelerating",
    "los_velocity_mm_yr": -42.3,
    "last_changepoint": "2026-06-04",
    "insar_coverage": "partial"
  },
  "explanation": [
    { "feature": "rain_accum_72h_mm",  "value": 318.0, "shap": 0.24 },
    { "feature": "creep_acceleration",  "value": 2.1,   "shap": 0.19 },
    { "feature": "slope_angle_deg",     "value": 41.5,  "shap": 0.14 },
    { "feature": "dist_to_road_cut_m",  "value": 18.0,  "shap": 0.11 },
    { "feature": "soil_moisture_pct",   "value": 0.46,  "shap": 0.08 }
  ],
  "model_versions": {
    "susceptibility": "xgb-v2.3-2026Q1",
    "trigger": "lstm-v1.7",
    "deformation": "pelt-rbf-v1.2"
  }
}
```

---

## 15. Machine Learning Pipeline

### 15.1 End-to-End Flow

```mermaid
flowchart LR
    subgraph OFF["Offline — retraining (seasonal)"]
        A1["Inventory + terrain<br/>+ NDVI"] --> A2["Negative sampling<br/>+ feature encoding"]
        A2 --> A3["Spatially blocked CV<br/>XGBoost training"]
        A3 --> A4["Susceptibility raster<br/>→ COG"]
        B1["Rainfall archive<br/>+ SMAP"] --> B2["Sequence windows<br/>around events"]
        B2 --> B3["LSTM training<br/>focal loss"]
        B3 --> B4["Trigger model<br/>→ registry"]
    end
    subgraph ON["Online — inference (3-hourly)"]
        C1["Latest rainfall<br/>+ soil moisture"] --> C2["Trigger inference"]
        A4 --> C3["Fusion engine"]
        B4 --> C2 --> C3
        C4["Latest InSAR<br/>creep state"] --> C3
        C5["Exposure layer"] --> C3
        C3 --> C6["Risk scores<br/>+ SHAP"] --> C7["Tier transition<br/>detection"] --> C8["Alert dispatch"]
    end
```

### 15.2 Training Cadence

| Model | Retrain cadence | Trigger for off-cycle retrain |
|---|---|---|
| Susceptibility (XGBoost) | Seasonal, post-monsoon | ≥ 50 new verified inventory events |
| Trigger (LSTM) | Annual | Systematic drift in per-tier precision |
| Change-point detector | No training; parameters re-tuned per corridor | New track added, or noise-floor shift |
| Tier thresholds | Monthly during monsoon | False-alarm rate exceeding agreed budget |

### 15.3 Experiment Tracking & Reproducibility

- **MLflow** records every run: parameters, metrics, spatial fold definitions, model artefacts.
- **DVC** versions the datasets and feature stacks so a model version maps to an exact data snapshot.
- Every risk score persists the `model_versions` object, so any historical alert can be reproduced exactly — which is essential when a decision is reviewed after an event.
- All random seeds fixed and logged; fold assignments stored, not regenerated.

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

Only **0.26%** of AOI pixels stay coherent through all 32 interferograms, though a 500 m buffer around the road recovers enough built-up ground that **37 of 116 segments** get a usable series. All 37 classify as stable, so the deformation modifier is 1.0 corridor-wide and no risk score changes.

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

### Intensity–duration threshold — not fitted

The classical Guzzetti baseline **cannot be fitted to this inventory**, and `fit_threshold` raises rather than returning a curve that is backwards. Daily CHIRPS gives only 6 distinct durations and a log-duration/log-intensity correlation of 0.009. Half-hourly IMERG gives 41 distinct durations and a correlation of 0.407 — but with the wrong sign, fitting β = −0.406 where physics requires β > 0. That holds at every storm-gap setting from 0.5 h to 12 h, so it is not a definition artefact. The likely cause is reporting bias: a news-derived inventory records large events during long monsoon spells, not short intense bursts.


---

## 17. Deployment Architecture

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

GitHub Actions pipeline:

```
lint (ruff) → type-check (mypy) → unit tests → integration tests (docker-compose)
  → build images → push to registry → deploy to staging → smoke test → manual gate → production
```

Model artefacts are versioned separately from application code: a model promotion is a registry change plus a config bump, never an application redeploy — so a bad model can be rolled back in seconds without touching the serving path.

### 17.2 Monitoring & Alerting on the System Itself

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

- Python 3.11+
- Node.js 20+
- Docker & Docker Compose
- A Google Earth Engine service account
- NASA Earthdata credentials (for GPM IMERG and SMAP)
- Copernicus Data Space credentials (for Sentinel-1/2)
- ESA SNAP with `snappy`, or ISCE2 — required only to run the InSAR chain locally

### 18.2 Bring-Up

```bash
# 1. Clone and configure
git clone <repo-url> major && cd major
cp .env.example .env          # then fill in credentials

# 2. Python environment
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

# 3. Infrastructure (Postgres+PostGIS+Timescale, Redis, MinIO, Prefect)
docker compose up -d

# 4. Database schema and reference data
make migrate
make seed-reference        # admin boundaries, road network, inventory

# 5. Pull a demo slice of data for the pilot corridor
make fetch-demo-data       # NH-10 Sevoke–Gangtok, one monsoon season

# 6. Train (or download pre-trained) models
make train-susceptibility
make train-trigger
# or:  make download-models

# 7. Run the API
uvicorn api.main:app --reload --port 8000

# 8. Dashboard
cd dashboard && npm install && npm run dev      # → http://localhost:5173

# 9. Citizen app
cd citizen-app && npm install && npx expo start
```

### 18.3 Useful Make Targets

| Target | Action |
|---|---|
| `make migrate` | Apply Alembic migrations |
| `make seed-reference` | Load boundaries, roads, inventory |
| `make fetch-demo-data` | Download the pilot-corridor data slice |
| `make train-susceptibility` | Train Layer 1 with spatial CV |
| `make train-trigger` | Train Layer 2 |
| `make run-insar CORRIDOR=nh10` | Execute the SBAS chain for a corridor |
| `make hindcast EVENT=sikkim_2023` | Replay a historical event end-to-end |
| `make forecast` | Run one full inference cycle |
| `make test` | Full test suite |
| `make lint` | ruff + mypy |

---

## 19. Configuration

`.env.example`:

```bash
# ─── Database ───────────────────────────────────────────────
DATABASE_URL=postgresql://landslide:landslide@localhost:5432/landslide
REDIS_URL=redis://localhost:6379/0

# ─── Object storage ─────────────────────────────────────────
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=landslide-cogs
S3_ACCESS_KEY=
S3_SECRET_KEY=

# ─── Earth observation credentials ──────────────────────────
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
FORECAST_HORIZONS=24,48,72
TIER_THRESHOLDS=0.25,0.50,0.75
INFERENCE_CRON=0 */3 * * *
INSAR_COHERENCE_THRESHOLD=0.30

# ─── Application ────────────────────────────────────────────
JWT_SECRET=
API_BASE_URL=http://localhost:8000
LOG_LEVEL=INFO
```

---

## 20. Known Challenges & Mitigations

| Challenge | Mitigation |
|---|---|
| **Sparse and incomplete landslide inventory in NER; severe class imbalance** | Careful spatial negative sampling from stable slopes, SMOTE within training folds only, transfer learning from the denser Himachal and Uttarakhand inventories, and continuous inventory growth from moderated citizen reports |
| **Persistent monsoon cloud cover blocks optical imagery** | The deformation layer uses radar (Sentinel-1), which penetrates cloud. Optical data is used only for slow-changing vegetation features, where a gap of days is harmless |
| **Dense vegetation causes InSAR decorrelation on NER slopes** | SBAS multi-temporal InSAR with coherence thresholding; deformation confidence restricted to coherent pixels; coverage reported honestly rather than interpolated over gaps |
| **False alarms erode official trust** | Four graded tiers rather than binary alerts, SHAP explanation attached to every alert, and a feedback loop where officials mark outcomes to recalibrate thresholds per corridor |
| **Poor connectivity during the exact events being warned about** | SMS and IVR as the primary channel, app functions offline with the last-cached risk layer, alerts pre-pushed before storm onset |
| **IMERG rainfall is coarse (~10 km) relative to slope scale** | Bias-correct and downscale against IMD AWS station observations; propagate the resulting uncertainty into the trigger probability rather than hiding it |
| **DEM is dated relative to active hill cutting and road widening** | Detect new cut faces from Sentinel-2 change detection and flag affected slope units for susceptibility re-evaluation |
| **Model decay as terrain and land cover change** | Seasonal retraining, drift monitoring on per-tier precision, and automatic off-cycle retrain when the inventory grows materially |

---

## 21. Testing

| Level | Scope | Tools |
|---|---|---|
| **Unit** | DEM derivative correctness against analytic surfaces, TWI/SPI formulas, tier assignment, runout buffer geometry, template rendering per language | pytest |
| **Integration** | Ingestion → processing → inference → risk write, against a seeded test database | pytest + docker-compose, `testcontainers` |
| **Model** | Spatial CV harness asserts no fold overlap; regression test that AUC does not drop below a floor; SHAP values sum to the model output | pytest + MLflow |
| **API** | Contract tests on every endpoint, auth and RBAC enforcement, pagination, error shapes | pytest + httpx |
| **Frontend** | Component tests, map layer rendering snapshots | Vitest + Testing Library |
| **End-to-end** | Full hindcast run asserts an Orange/Red alert fires before a known event date | pytest, marked `slow` |
| **Load** | Dashboard watchlist and tile endpoints under concurrent district-control-room load | Locust |

A dedicated test guards the property that matters most: **the spatial CV splitter must never place two spatially adjacent samples in different folds.** If that test fails, every reported metric in the project is invalid.

---

## 22. Limitations & Ethical Considerations

### Technical Limitations

*Measured on this corridor, not anticipated — see §16A for the figures.*

- **Detection is 17% at the Red tier** across 42 replayed events. The warnings that fire are timely (median 9 days), but most events produce no alert at all.
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
| **5 — Fusion & exposure** | Runout buffers, segment scoring, tier calibration | ☑ 116 segments; habitation joins not built |
| **6 — API & dashboard** | FastAPI endpoints, React dashboard with map, watchlist, corridor strip and factor breakdown | ☑ 7 endpoints; TiTiler tiles and historical replay not built |
| **7 — Delivery** | SMS gateway, escalation dispatcher, delivery tracking | ☑ *partial* — dispatcher and templates built and tested; **English only** until translations are reviewed, and **dry-run only** without provider credentials. Citizen app and IVR not built |
| **8 — Validation** | Hindcast, metric report, lead-time distribution | ☑ **8-day warning** on a real event; 42-event walk-forward study — see §16A |
| **9 — Hardening & scale-out** | Kubernetes deployment, monitoring, CI/CD, OGC export, extension beyond the pilot corridor | ☐ not started |

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
