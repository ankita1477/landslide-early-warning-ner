# AI-Based Early Warning and Landslide Risk Monitoring System for the North Eastern Region

**Project Specification Document**

| | | | |
|---|---|---|---|
| **Reference ID** | 26001 | **Category** | Software |
| **Domain** | Development of the North Eastern Region | **Theme** | Disaster Management |

---

## 1. Problem Statement

The North Eastern Region loses lives, highways and weeks of economic activity to landslides every monsoon. Fragile young-fold geology, extremely high rainfall, unplanned hill cutting and road-widening spoil combine to produce slope failures that sever the only surface link to entire districts. When NH-10 to Gangtok or the Imphal–Jiribam corridor closes, relief, fuel, medicines and perishables stop moving.

The core gap is not awareness — it is **resolution and timing**. What is available to a district administrator today falls into two buckets, and neither is actionable:

- **Static hazard maps.** Geological Survey of India susceptibility maps classify a slope as high-risk permanently. They answer *where* failures are possible, never *when*. An engineer cannot close a road on a map that has said 'high' for a decade.

- **Coarse meteorological warnings.** IMD rainfall alerts are issued at district scale. A district in Meghalaya contains thousands of slopes; a blanket red alert gives no basis to prioritise which culvert to clear or which hamlet to evacuate first.

- **No deformation sensing.** Slopes usually creep for days or weeks before catastrophic failure. That precursor signal is currently unread in NER, because instrumenting every slope with extensometers is financially impossible.

- **Broken last mile.** Even a correct warning fails if it arrives as an English PDF circular. Mobile data is the first casualty of a storm, and the affected population speaks Assamese, Khasi, Mizo, Bodo, Nyishi and Manipuri.

**The problem to be solved:** build a system that continuously fuses terrain (why a slope is intrinsically weak), rainfall (what triggers it) and satellite-measured ground deformation (whether it is already moving) into a rolling 24–72 hour risk forecast, resolved to individual slopes and road kilometres, and delivered in a form that reaches officials and citizens when the network is degraded.

---

## 2. Proposed Solution

A three-layer risk engine that turns free, continuously refreshed satellite and meteorological data into a per-kilometre risk score, served through an official dashboard and a citizen alerting channel. No new field hardware is required for national rollout, which is what makes it deployable across all eight NER states rather than one pilot slope.

### Layer 1 — Static Susceptibility (where slopes are weak)

A gradient-boosted classifier (XGBoost) trained on the GSI landslide inventory and NASA COOLR event catalogue. Terrain features are derived from 30 m CartoDEM/SRTM: slope angle, aspect, plan and profile curvature, topographic wetness index, stream power index, distance to road cuts, distance to lineaments and faults. Lithology and soil come from GSI/NBSS layers; vegetation vigour (NDVI) from Sentinel-2. Output is a susceptibility raster, refreshed seasonally.

**Validation must use spatially blocked cross-validation** — random splits leak neighbouring pixels between train and test and inflate AUC to meaningless levels.

### Layer 2 — Dynamic Trigger (when rain will set it off)

An LSTM sequence model over rainfall history, using NASA GPM IMERG half-hourly precipitation and IMD gridded data. Inputs are antecedent rainfall accumulations at 3, 7, 15 and 30 days plus intensity–duration characteristics of the current storm and soil-moisture proxy from SMAP. Output is failure probability over the next 24, 48 and 72 hours. Combined as `hazard = susceptibility × trigger probability`.

### Layer 3 — Slope Creep Detection (what is already moving)

This is the differentiating layer. Sentinel-1 radar interferometry (InSAR) measures line-of-sight ground displacement to millimetre precision on a 6–12 day repeat cycle, free of charge. Running change-point detection on displacement velocity time series flags slopes entering accelerated creep — a slope moving steadily is a red flag even before the rain arrives, and this is precisely the precursor that no rainfall-only model can see.

### Risk Resolution and Delivery

Hazard is multiplied by exposure — national and state highway centrelines, WorldPop settlement density, schools and health centres — to produce a risk score **per road segment and per habitation, not per district**. Delivery is deliberately redundant:

- **Officials' dashboard** for PWD, BRO, NDRF and district control rooms: map view, ranked watchlist of the top-risk road kilometres, historical replay and per-alert SHAP explanation showing which factors drove the score.

- **Citizen app** (React Native) with location-based alerts, safe-route guidance, and geotagged photo reporting of observed cracks or minor slips — which feeds straight back into the training inventory and steadily improves the model.

- **SMS and IVR fallback** in Assamese, Khasi, Mizo, Bodo, Nyishi and Manipuri. Voice calls survive when data does not, and this is the single design choice that determines whether the system saves lives or produces reports.

- **Four-tier colour coding** (Green / Yellow / Orange / Red) aligned with existing IMD convention, so no retraining of officials is needed.

---

## 3. System Architecture

| Layer | Components | Technology |
|---|---|---|
| **Data Ingestion** | Scheduled pulls of Sentinel-1 SLC, Sentinel-2, GPM IMERG, IMD grids, SMAP soil moisture, CartoDEM, GSI inventory | Prefect / Airflow, Google Earth Engine, Sentinel Hub API |
| **Processing** | DEM derivative computation, InSAR interferogram generation, cloud masking, feature stack assembly | Google Earth Engine, Python, rasterio, xarray, SNAP/ISCE2 |
| **Models** | Susceptibility classifier, rainfall trigger sequence model, deformation change-point detector, explainability | XGBoost, PyTorch (LSTM), ruptures, SHAP |
| **Storage** | Vector risk layers, raster tiles, rainfall and displacement time series | PostgreSQL + PostGIS, TimescaleDB, object storage for COGs |
| **API and Serving** | Risk queries, alert subscription, tile server, admin endpoints | FastAPI, Redis cache, TiTiler |
| **Interfaces** | Officials' web dashboard, citizen mobile app, SMS/IVR gateway | React + MapLibre GL, React Native, Twilio / MSG91 |
| **Deployment** | Containerised services, scheduled retraining, monitoring | Docker, Kubernetes, GitHub Actions, Grafana |

> Google Earth Engine carries the heavy raster processing server-side, which removes the need for a GPU cluster or petabyte-scale storage and keeps recurring infrastructure cost within a state IT budget.

---

## 4. Feasibility and Data Availability

| Dataset | Source | Resolution / Cadence | Access |
|---|---|---|---|
| **Radar deformation** | Sentinel-1 (ESA Copernicus) | 5–20 m, 6–12 day repeat | Free |
| **Optical / NDVI** | Sentinel-2, Landsat 8/9 | 10–30 m, 5 day | Free |
| **Rainfall** | NASA GPM IMERG | ~10 km, 30 min | Free |
| **Rainfall (in-situ)** | IMD AWS network and gridded product | Station / 0.25° | Public / MoU |
| **Terrain** | CartoDEM (ISRO), SRTM, ALOS PALSAR | 30 m | Free |
| **Landslide inventory** | GSI NLSM, NASA COOLR | Point events | Free / GSI portal |
| **Soil moisture** | SMAP | 9 km, 2–3 day | Free |
| **Exposure** | OpenStreetMap roads, WorldPop, Bhuvan | Vector / 100 m | Free |

### Known Challenges and Mitigations

| Challenge | Mitigation |
|---|---|
| **Sparse and incomplete landslide inventory in NER; severe class imbalance** | Careful spatial negative sampling from stable slopes, SMOTE on the minority class, transfer learning from Himachal and Uttarakhand inventories, and continuous inventory growth from citizen reports |
| **Persistent monsoon cloud cover blocks optical imagery** | The deformation layer uses radar (Sentinel-1), which penetrates cloud; optical data is used only for slow-changing vegetation features |
| **Dense vegetation causes InSAR decorrelation on NER slopes** | Use SBAS multi-temporal InSAR with coherence thresholding and restrict deformation confidence to coherent pixels; report coverage honestly rather than interpolating over gaps |
| **False alarms erode official trust** | Four graded tiers rather than binary alerts, SHAP explanation attached to every alert, and a feedback loop where officials mark outcomes to recalibrate thresholds |
| **Poor connectivity during the exact events being warned about** | SMS and IVR as primary channel, app functions offline with last-cached risk layer, alerts pre-pushed before storm onset |

---

## 5. Prototype Scope and Validation Strategy

A credible prototype narrows to **one corridor** and proves the model retrospectively. The recommended pilot is the **NH-10 Sevoke–Gangtok corridor** — the most landslide-prone strategic highway in the country, with dense documented event history.

- **Hindcast validation.** Replay archived rainfall, terrain and Sentinel-1 data preceding a documented disaster — for example the 2023 Sikkim event or the 2022 Tupul landslide in Manipur — and demonstrate the model issuing an Orange or Red alert well before the actual failure. A verified early warning on a real past event is far more persuasive to an evaluation panel than a polished live dashboard.

- **Metrics reported honestly.** Spatially blocked AUC-ROC, precision and recall at each alert tier, lead time distribution, and false alarm rate per hundred alerts. Claiming near-perfect accuracy on a sparse inventory signals overfitting to any technically literate evaluator.

- **Live demonstration.** Current rainfall pulled in real time, risk recomputed on the corridor, and an SMS alert delivered to a handset in a regional language during the presentation.

---

## 6. Impact and Scalability

- **Lives and injuries.** Even a 24-hour lead time converts an unanticipated disaster into a managed evacuation of the affected habitations.

- **Connectivity and logistics.** Pre-positioning of BRO and PWD clearing equipment at flagged kilometres cuts road-closure duration, which is the dominant economic cost of NER landslides.

- **Planning value.** The susceptibility layer informs alignment of new roads, siting of new construction, and prioritisation of slope stabilisation budgets under regional development schemes.

- **Scalability at near-zero marginal cost.** Because the system runs on freely available satellite and meteorological feeds rather than installed sensors, extending from the pilot corridor to all eight NER states, and subsequently to the Western Himalaya and Western Ghats, requires retraining rather than reinvestment.

- **Integration path.** Outputs can be published to NDMA, SDMA and Bhuvan through standard OGC services, and the alert layer can feed the existing Common Alerting Protocol used by NDMA's SACHET platform.

---

## 7. References

1. Geological Survey of India — National Landslide Susceptibility Mapping (NLSM) programme and Bhukosh portal.
2. NASA Global Landslide Catalog and Cooperative Open Online Landslide Repository (COOLR).
3. ESA Copernicus Sentinel-1 and Sentinel-2 mission documentation; SBAS-InSAR methodology for slow-moving landslide detection.
4. NASA GPM IMERG precipitation product technical documentation.
5. Guzzetti et al., rainfall intensity–duration thresholds for the initiation of landslides.
6. NDMA National Disaster Management Guidelines on Landslides and Snow Avalanches; NDMA SACHET / Common Alerting Protocol.
7. ISRO Bhuvan and NRSC landslide hazard zonation datasets.
