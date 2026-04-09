# Semantic Zooming and Edge Bundling for Multi-Scale Supply Chain Flow Visualization

A multi-scale visual analytics dashboard that combines **Semantic Zooming** with **Skeleton-Based Edge Bundling (SBEB)** to visualize high-density supply chain networks. Built with Vue 3, Deck.gl, and D3.js.

**[Live Demo](https://songmaol.github.io/semantic-zoom-supply-chain/)**

---

## Overview

Modern supply chain networks generate tens of thousands of origin-destination flows that overwhelm traditional visualization approaches. This dashboard addresses the problem by dynamically adapting its representation based on the user's zoom level:

| View | Zoom Level | Representation | Analytical Task |
|------|------------|---------------|-----------------|
| **Macro** (Flows) | z < 6 | Bundled warehouse-to-state arcs | Identify shipping corridors, detect routing anomalies |
| **Meso** (Density) | 6 &le; z < 10 | Hexagonal density bins | Assess regional demand concentration |
| **Micro** (Warehouse) | z &ge; 10 | Sunburst inventory charts | Analyze warehouse-level product composition |

The system aggregates **51,371 shipment records** into **202 warehouse-to-state flows** (a 254x reduction) and renders them entirely client-side with no server infrastructure required.

## Key Features

- **Skeleton-Based Edge Bundling** with directional-sector clustering and adaptive detour constraints optimized for geographic OD flows
- **Animated semantic zoom transitions** (400ms opacity interpolation) preserving spatial context across scale changes
- **Interactive exploration**: click bundled arcs to inspect route details, hover hexagons for demand metrics, drill into warehouse inventory sunbursts
- **Visual parameter controls**: bundling toggle, arc width/opacity sliders, color encoding (by warehouse, volume, or category), hex bin radius

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Vue 3 (Composition API) |
| Map Rendering | Deck.gl + Mapbox GL JS |
| Charts | D3.js (Sunburst) |
| Edge Bundling | Web Worker (SBEB algorithm) |
| Styling | Bootstrap 5 |
| Build | Vite |
| Deployment | GitHub Pages (static) |

## Getting Started

### Prerequisites
- Node.js 18+
- A Mapbox access token (set as `VITE_MAPBOX_TOKEN` environment variable)

### Installation

```bash
git clone https://github.com/SongmaoL/semantic-zoom-supply-chain.git
cd semantic-zoom-supply-chain/vue_framework
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

### Production Build

```bash
npm run build
```

## Project Structure

```
semantic-zoom-supply-chain/
├── vue_framework/
│   ├── public/
│   │   ├── demand_data_geocoded.csv         # 51,371 e-commerce orders (July 2025)
│   │   └── data/
│   │       ├── inventory_stock_levels.csv   # Warehouse inventory (4,000+ SKUs)
│   │       └── inbound_cargo_shipments.csv  # Import routes
│   ├── src/
│   │   ├── pages/
│   │   │   ├── FlowMap.vue                  # Main visualization engine
│   │   │   └── Dashboard.vue                # Landing page
│   │   ├── components/
│   │   │   ├── FlowDetailSidebar.vue        # Route detail panel
│   │   │   ├── ImportDetailSidebar.vue      # Inbound cargo details
│   │   │   └── WarehouseSunburst.vue        # D3 inventory sunburst
│   │   ├── composables/
│   │   │   ├── useDataLoader.js             # CSV parsing & flow aggregation
│   │   │   ├── useBundleWorker.js           # Web Worker interface
│   │   │   ├── useInventoryLoader.js        # Inventory data loading
│   │   │   ├── useInboundLoader.js          # Import route loading
│   │   │   └── useMapColors.js              # Color schemes
│   │   └── workers/
│   │       └── bundleWorker.js              # SBEB algorithm implementation
│   └── vite.config.js
├── data/                                     # Raw source data
└── LICENSE
```

## Data

The primary dataset comprises 51,371 e-commerce orders from July 2025, sourced from a US logistics provider. Four fulfillment centers serve as flow origins:

| Warehouse | Location | Orders | Share |
|-----------|----------|--------|-------|
| WH-CA | California | 27,071 | 52.7% |
| WH-NJ | New Jersey | 17,128 | 33.3% |
| WH-TX | Texas | 4,300 | 8.4% |
| WH-IL | Illinois | 2,872 | 5.6% |

The dataset was provided by Thunder International Group under a non-redistribution agreement; aggregated summary statistics are included in this repository.

## Citation

If you use this work in your research, please cite:

```bibtex
@article{li2025semantic,
  title={Semantic Zooming and Edge Bundling for Multi-Scale Supply Chain Flow Visualization},
  author={Li, Songmao and Qu, Kaixuan and Sun, Kara and Limbasia, Bhargav},
  year={2025}
}
```

*(Paper link will be added upon publication.)*

## Authors

Songmao Li, Kaixuan Qu, Kara Sun, and Bhargav Limbasia

University of Southern California

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
