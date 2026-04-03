<template>
  <div class="flow-map-container" :class="{ transitioning: isTransitioning }">
    <!-- Header Section -->
    <div class="controls-header">
      <div class="container-fluid px-4">
        <div class="row align-items-center py-2">
          <div class="col-md-5">
            <h2 class="mb-1 fs-4">
              <i class="bi bi-diagram-3"></i> Supply Chain Flow Map
            </h2>
            <p class="text-muted mb-0 small">
              Semantic zoom: flow patterns at country scale, destination density at city scale
            </p>
          </div>
          <div class="col-md-7">
            <div class="d-flex gap-3 justify-content-end">
              <!-- Stats Cards -->
              <div class="stat-card">
                <small class="text-muted d-block">Zoom</small>
                <strong>{{ currentZoom.toFixed(1) }}</strong>
              </div>
              <div class="stat-card">
                <small class="text-muted d-block">View</small>
                <strong :class="viewModeClass">{{ viewModeLabel }}</strong>
              </div>
              <div class="stat-card">
                <small class="text-muted d-block">Routes</small>
                <strong>{{ totalAggregatedArcs > 0 ? totalAggregatedArcs : totalArcs }}</strong>
                <small v-if="totalAggregatedArcs > 0" class="text-muted d-block" style="font-size: 9px;">
                  ({{ totalArcs.toLocaleString() }} orders)
                </small>
              </div>
              <div class="stat-card">
                <small class="text-muted d-block">Volume</small>
                <strong>{{ totalVolume.toLocaleString() }}</strong>
              </div>
              <div class="stat-card" v-if="showImportArcs && totalContainers > 0">
                <small class="text-muted d-block">Containers</small>
                <strong class="text-warning">{{ totalContainers.toLocaleString() }}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Controls Panel -->
    <div class="controls-panel">
      <div class="container-fluid px-4">
        <div class="row g-2 py-2 align-items-end">
          <!-- Date Filter -->
          <div class="col-auto">
            <label class="form-label small mb-1">
              <i class="bi bi-calendar3"></i> Date
            </label>
            <select v-model="selectedDate" class="form-select form-select-sm">
              <option value="all">All Days</option>
              <option v-for="date in availableDates" :key="date" :value="date">
                {{ formatDateDisplay(date) }}
              </option>
            </select>
          </div>
          
          <!-- Color Mode -->
          <div class="col-auto">
            <label class="form-label small mb-1">
              <i class="bi bi-palette"></i> Color
            </label>
            <select v-model="colorMode" class="form-select form-select-sm">
              <option value="warehouse">By Warehouse</option>
              <option value="volume">By Volume</option>
              <option value="category">By Category</option>
            </select>
          </div>
          
          <!-- Arc Width -->
          <div class="col-auto" style="width: 120px;">
            <label class="form-label small mb-1">
              <i class="bi bi-arrows-expand"></i> Width {{ arcWidth.toFixed(1) }}
            </label>
            <input v-model.number="arcWidth" type="range" min="0.5" max="5" step="0.5" class="form-range">
          </div>
          
          <!-- Arc Opacity -->
          <div class="col-auto" style="width: 120px;">
            <label class="form-label small mb-1">
              <i class="bi bi-droplet-half"></i> Opacity {{ Math.round(arcOpacity * 100) }}%
            </label>
            <input v-model.number="arcOpacity" type="range" min="0.1" max="1" step="0.1" class="form-range">
          </div>
          
          <!-- Hex Radius (only visible in hex mode) -->
          <div class="col-auto" v-show="showHexControls">
            <label class="form-label small mb-1">
              <i class="bi bi-hexagon"></i> Hex Size
            </label>
            <select v-model.number="hexRadius" class="form-select form-select-sm">
              <option :value="10000">10 km</option>
              <option :value="25000">25 km</option>
              <option :value="50000">50 km</option>
            </select>
          </div>
          
          <!-- Hex Elevation (only visible in hex mode) -->
          <div class="col-auto" style="width: 100px;" v-show="showHexControls">
            <label class="form-label small mb-1">
              <i class="bi bi-box"></i> Height {{ elevationScale }}
            </label>
            <input v-model.number="elevationScale" type="range" min="200" max="500" step="25" class="form-range">
          </div>
          
          <!-- Bundling Toggle -->
          <div class="col-auto">
            <label class="form-label small mb-1">
              <i class="bi bi-bezier"></i> Bundling
            </label>
            <div class="form-check form-switch">
              <input 
                v-model="useBundling" 
                class="form-check-input" 
                type="checkbox" 
                id="bundlingSwitch"
                :disabled="isBundling"
              >
              <label class="form-check-label small" for="bundlingSwitch">
                {{ useBundling ? 'ON' : 'OFF' }}
              </label>
            </div>
          </div>
          
          <!-- Re-bundle Button -->
          <div class="col-auto" v-if="useBundling">
            <button 
              @click="rebundle" 
              class="btn btn-sm btn-outline-primary"
              :disabled="isBundling || allArcsData.length === 0"
            >
              <i class="bi bi-arrow-repeat"></i> Rebundle
            </button>
          </div>
          
          <!-- Import/Container Routes Toggle -->
          <div class="col-auto">
            <label class="form-label small mb-1">
              <i class="bi bi-box-seam"></i> Imports
            </label>
            <div class="form-check form-switch">
              <input 
                v-model="showImportArcs" 
                class="form-check-input" 
                type="checkbox" 
                id="importSwitch"
              >
              <label class="form-check-label small" for="importSwitch">
                {{ showImportArcs ? 'ON' : 'OFF' }}
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Map Container -->
    <div ref="mapContainer" class="map-canvas"></div>

    <!-- Loading Overlay -->
    <div v-if="isLoading || isBundling" class="loading-overlay">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-3 mb-1">{{ loadingMessage }}</p>
      <div v-if="isBundling" class="progress" style="width: 200px; height: 6px;">
        <div 
          class="progress-bar progress-bar-striped progress-bar-animated" 
          :style="{ width: bundlingProgress * 100 + '%' }"
        ></div>
      </div>
      <small v-if="isBundling" class="text-muted">{{ Math.round(bundlingProgress * 100) }}%</small>
    </div>

    <!-- Error Overlay -->
    <div v-if="loadError" class="error-overlay">
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-triangle me-2"></i>
        {{ loadError }}
      </div>
    </div>

    <!-- View Mode Tabs (bottom center) - Clickable -->
    <div class="zoom-indicator">
      <div class="zoom-bar" :class="{ transitioning: isTransitioning }">
        <button 
          class="zoom-section" 
          :class="{ active: currentView === 'flows', manual: manualViewMode === 'flows' }"
          @click="switchToView('flows')"
          title="Show supply chain flows"
        >
          <i class="bi bi-bezier2"></i>
          <span>Flows</span>
        </button>
        <button 
          class="zoom-section" 
          :class="{ active: currentView === 'density', manual: manualViewMode === 'density' }"
          @click="switchToView('density')"
          title="Show destination density"
        >
          <i class="bi bi-hexagon"></i>
          <span>Density</span>
        </button>
        <button 
          class="zoom-section warehouse" 
          :class="{ active: currentView === 'warehouse' }"
          @click="flyToWarehouse"
          title="Fly to warehouse for inventory view"
        >
          <i class="bi bi-building"></i>
          <span>Warehouse</span>
        </button>
      </div>
      <div v-if="manualViewMode !== 'auto'" class="auto-hint">
        <small>Click active tab to return to auto mode</small>
      </div>
    </div>

    <!-- Warehouse Sunburst Chart (positioned on map) -->
    <WarehouseSunburst
      v-if="activeWarehouse"
      :warehouse-id="activeWarehouse.id"
      :warehouse-name="activeWarehouse.name"
      :inventory-data="activeWarehouseInventory"
      :is-visible="showSunburst"
      :screen-x="sunburstScreenPos.x"
      :screen-y="sunburstScreenPos.y"
      :size="300"
    />

    <!-- Category Legend (visible in hexagon mode) -->
    <div class="category-legend" v-show="showHexControls && !showSunburst">
      <div class="legend-title">
        <i class="bi bi-tags-fill"></i> Top Category
      </div>
      <div class="legend-items">
        <div class="legend-item" v-for="cat in categoryLegendItems" :key="cat.name">
          <span class="legend-color" :style="{ backgroundColor: cat.color }"></span>
          <span class="legend-label">{{ cat.name }}</span>
        </div>
      </div>
      <small class="text-muted d-block mt-2">Height = Order Count</small>
    </div>

    <!-- Hexagon Hover Popup -->
    <div 
      v-if="hoverInfo && hoverInfo.categories" 
      class="hex-tooltip"
      :style="{ left: (hoverInfo.x + 15) + 'px', top: (hoverInfo.y - 10) + 'px' }"
    >
      <div class="tooltip-header">
        <strong>{{ hoverInfo.count.toLocaleString() }}</strong> orders
      </div>
      <div class="tooltip-divider"></div>
      <div class="tooltip-categories">
        <div 
          v-for="cat in hoverInfo.categories.slice(0, 5)" 
          :key="cat.name"
          class="category-row"
        >
          <span class="cat-color" :style="{ backgroundColor: getCategoryColor(cat.name) }"></span>
          <span class="cat-name">{{ cat.name }}</span>
          <span class="cat-stats">{{ cat.count }} ({{ cat.percent }}%)</span>
        </div>
        <div v-if="hoverInfo.categories.length > 5" class="more-categories">
          +{{ hoverInfo.categories.length - 5 }} more
        </div>
      </div>
    </div>

    <!-- Import Route Hover Popup -->
    <div 
      v-if="hoverInfo && hoverInfo.isImportRoute" 
      class="hex-tooltip import-tooltip"
      :style="{ left: (hoverInfo.x + 15) + 'px', top: (hoverInfo.y - 10) + 'px' }"
    >
      <div class="tooltip-header import-header">
        <i class="bi bi-ship"></i>
        <span>{{ hoverInfo.originPort }} → {{ hoverInfo.destinationPort }}</span>
      </div>
      <div class="tooltip-divider"></div>
      <div class="tooltip-stats">
        <div class="stat-row">
          <span class="stat-label">Containers:</span>
          <span class="stat-value">{{ hoverInfo.containerCount.toLocaleString() }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Total Units:</span>
          <span class="stat-value">{{ hoverInfo.totalQuantity.toLocaleString() }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Cargo Value:</span>
          <span class="stat-value">${{ (hoverInfo.totalValue / 1000).toFixed(0) }}K</span>
        </div>
      </div>
    </div>

    <!-- Port Marker Hover Popup -->
    <div 
      v-if="hoverInfo && hoverInfo.isPort" 
      class="hex-tooltip port-tooltip"
      :style="{ left: (hoverInfo.x + 15) + 'px', top: (hoverInfo.y - 10) + 'px' }"
    >
      <div class="tooltip-header port-header">
        <i :class="hoverInfo.portType === 'origin' ? 'bi bi-geo-alt-fill text-warning' : 'bi bi-geo-alt-fill text-info'"></i>
        <span>{{ hoverInfo.portName }}</span>
        <span class="port-type">{{ hoverInfo.portType === 'origin' ? '(Origin)' : '(Destination)' }}</span>
      </div>
      <div class="tooltip-divider"></div>
      <div class="tooltip-stats">
        <div class="stat-row">
          <span class="stat-label">Containers:</span>
          <span class="stat-value">{{ hoverInfo.containerCount.toLocaleString() }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Shipments:</span>
          <span class="stat-value">{{ hoverInfo.shipmentCount.toLocaleString() }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Total Value:</span>
          <span class="stat-value">${{ (hoverInfo.totalValue / 1000000).toFixed(2) }}M</span>
        </div>
      </div>
    </div>

    <!-- Info Panel (bottom right) -->
    <div class="info-panel">
      <div class="card shadow-sm">
        <div class="card-body p-2">
          <div v-if="useBundling && bundledArcsData.length > 0" class="mb-2">
            <span class="badge bg-success">
              <i class="bi bi-check-circle"></i> SBEB
            </span>
            <small class="d-block text-muted">{{ bundledArcsData.length }} bundled flows</small>
          </div>
          <div v-if="hoverInfo && hoverInfo.isWarehouse" class="hover-stats">
            <small>
              <strong>Click to zoom:</strong> {{ hoverInfo.warehouse }}
            </small>
          </div>
          <div v-if="!showFlowSidebar && useBundling && bundledArcsData.length > 0 && currentView === 'flows'" class="click-hint mt-2">
            <small class="text-muted">
              <i class="bi bi-hand-index"></i> Click a flow line for details
            </small>
          </div>
          <div v-else-if="currentView === 'density'" class="click-hint mt-2">
            <small class="text-muted">
              <i class="bi bi-hexagon"></i> Hover on hexagons for order details
            </small>
          </div>
          <div v-else-if="currentView === 'warehouse'" class="click-hint mt-2">
            <small class="text-muted">
              <i class="bi bi-pie-chart"></i> Hover on sunburst for inventory details
            </small>
          </div>
        </div>
      </div>
    </div>

    <!-- Flow Detail Sidebar -->
    <FlowDetailSidebar
      :is-visible="showFlowSidebar"
      :flow-data="selectedFlowData"
      :aggregated-stats="selectedAggregatedStats"
      @close="closeFlowSidebar"
    />

    <!-- Import Route Detail Sidebar -->
    <ImportDetailSidebar
      :is-visible="showImportSidebar"
      :route-data="selectedImportRoute"
      @close="closeImportSidebar"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { ArcLayer, ScatterplotLayer, PathLayer } from '@deck.gl/layers';
import { HexagonLayer } from '@deck.gl/aggregation-layers';
import { MapboxOverlay } from '@deck.gl/mapbox';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Import composables
import { useDataLoader, formatDateDisplay } from '../composables/useDataLoader';
import { useBundleWorker } from '../composables/useBundleWorker';
import { getBundledPathColor, getBundledPathWidth, getArcColor, HEXAGON_COLOR_RANGE } from '../composables/useMapColors';
import { useInventoryLoader } from '../composables/useInventoryLoader';
import { useInboundLoader, STATUS_COLORS } from '../composables/useInboundLoader';

// Import components
import WarehouseSunburst from '../components/WarehouseSunburst.vue';
import FlowDetailSidebar from '../components/FlowDetailSidebar.vue';
import ImportDetailSidebar from '../components/ImportDetailSidebar.vue';

// Mapbox token
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

// ============================================================================
// COMPOSABLES
// ============================================================================

const {
  isLoading,
  loadError,
  selectedDate,
  availableDates,
  allArcsData,
  rawArcsData,
  aggregatedArcs,           // Warehouse → State flows for bundling
  destinationPoints,
  totalArcs,
  totalAggregatedArcs,      // Count of aggregated flows
  totalVolume,
  loadDemandData,
  filterByDate,
  getOrdersForAggregatedArc, // Get original orders for sidebar
} = useDataLoader();

const {
  isBundling,
  bundlingProgress,
  bundlingStatus,
  bundledArcsData,
  startBundling,
} = useBundleWorker();

const {
  isLoading: isInventoryLoading,
  inventoryByWarehouse,
  loadInventoryData,
  getWarehouseInventory,
  shouldShowWarehouseDetail,
} = useInventoryLoader();

const {
  isLoading: isInboundLoading,
  allShipments,
  totalContainers,
  totalCargoValue,
  getPortArcs,
  getPortMarkers,
  loadInboundData,
} = useInboundLoader();

// ============================================================================
// COMPONENT STATE
// ============================================================================

const mapContainer = ref(null);
const currentZoom = ref(4);

// Visual settings
const colorMode = ref('warehouse');
const arcWidth = ref(2);
const arcOpacity = ref(0.5);
const useBundling = ref(true);
const bundlingAlgorithm = ref('SBEB'); // SBEB only (FDEB removed)
const showImportArcs = ref(false); // Toggle for import/container routes

// Hexagon settings
const hexRadius = ref(25000);
const elevationScale = ref(300);  // Default 300, range 200-500
const hoverInfo = ref(null);

// Warehouse sunburst state
const activeWarehouse = ref(null);
const activeWarehouseInventory = ref([]);
const showSunburst = ref(false);
const sunburstScreenPos = ref({ x: 0, y: 0 });

// Flow detail sidebar state
const showFlowSidebar = ref(false);
const selectedFlowData = ref([]);
const selectedAggregatedStats = ref(null); // { orderCount, volume, totalValue }
const selectedPathId = ref(null);

// Import route sidebar state
const showImportSidebar = ref(false);
const selectedImportRoute = ref(null);

// Manual view mode: 'auto', 'flows', 'density'
// When 'auto', follows zoom level. Otherwise, forces that view.
const manualViewMode = ref('auto');
const isTransitioning = ref(false);

// Animated opacity values for smooth transitions
const animatedFlowOpacity = ref(1);
const animatedHexOpacity = ref(0);
const transitionDuration = 400; // ms
let animationFrameId = null;

// Map instances
let map = null;
let deckOverlay = null;

// ============================================================================
// COMPUTED
// ============================================================================

// Determine current view based on manual mode or zoom
const currentView = computed(() => {
  if (showSunburst.value) return 'warehouse';
  if (manualViewMode.value !== 'auto') return manualViewMode.value;
  // Auto mode: simple threshold at zoom 6
  return currentZoom.value < 6 ? 'flows' : 'density';
});

const viewModeLabel = computed(() => {
  if (currentView.value === 'warehouse') return 'Warehouse';
  if (currentView.value === 'density') return 'Density';
  return 'Flows';
});

const viewModeClass = computed(() => {
  if (currentView.value === 'warehouse') return 'text-purple';
  if (currentView.value === 'density') return 'text-success';
  return 'text-primary';
});

const showHexControls = computed(() => currentView.value === 'density');

// Category colors for hexagon layer
const CATEGORY_COLORS = {
  'Home & Garden': '#27ae60',
  'Apparel & Accessories': '#e74c3c',
  'Health & Beauty': '#9b59b6',
  'Electronics': '#3498db',
  'Toys & Games': '#f1c40f',
  'Hardware': '#e67e22',
  'Business & Industrial': '#1abc9c',
  'Arts & Entertainment': '#8e44ad',
  'Vehicles & Parts': '#2c3e50',
  'Office Supplies': '#7f8c8d',
  'Unknown': '#95a5a6',
};

const getCategoryColor = (category) => {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS['Unknown'];
};

// Category legend items
const categoryLegendItems = computed(() => [
  { name: 'Home & Garden', color: '#27ae60' },
  { name: 'Apparel', color: '#e74c3c' },
  { name: 'Health & Beauty', color: '#9b59b6' },
  { name: 'Electronics', color: '#3498db' },
  { name: 'Toys & Games', color: '#f1c40f' },
  { name: 'Hardware', color: '#e67e22' },
  { name: 'Industrial', color: '#1abc9c' },
  { name: 'Other', color: '#95a5a6' },
]);

const loadingMessage = computed(() => {
  if (isLoading.value) return 'Loading supply chain data...';
  if (isInventoryLoading.value) return 'Loading inventory data...';
  if (isBundling.value) return bundlingStatus.value || 'Computing edge bundles...';
  return '';
});

// Show sunburst when zoomed close to a warehouse
const showWarehouseControls = computed(() => currentZoom.value >= 10);

// ============================================================================
// SEMANTIC ZOOM LOGIC
// ============================================================================

/**
 * Get target opacities based on current view mode
 */
const getTargetOpacities = () => {
  const view = currentView.value;
  
  // Hide all when sunburst is showing
  if (view === 'warehouse') {
    return { flowOpacity: 0, hexOpacity: 0 };
  }
  
  // Density view
  if (view === 'density') {
    return { flowOpacity: 0, hexOpacity: 1 };
  }
  
  // Flows view (default)
  return { flowOpacity: 1, hexOpacity: 0 };
};

/**
 * Animate opacity values smoothly from current to target
 * Uses easeOutCubic for natural feel
 */
const animateOpacities = (targetFlow, targetHex, duration = transitionDuration) => {
  // Cancel any existing animation
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  
  const startFlow = animatedFlowOpacity.value;
  const startHex = animatedHexOpacity.value;
  const startTime = performance.now();
  
  // Easing function - cubic ease out for smooth deceleration
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  
  const animate = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easeOutCubic(progress);
    
    // Interpolate opacities
    animatedFlowOpacity.value = startFlow + (targetFlow - startFlow) * easedProgress;
    animatedHexOpacity.value = startHex + (targetHex - startHex) * easedProgress;
    
    // Update visualization with new opacity values
    if (deckOverlay) {
      deckOverlay.setProps({ layers: createLayers() });
    }
    
    // Continue animation if not complete
    if (progress < 1) {
      animationFrameId = requestAnimationFrame(animate);
    } else {
      animationFrameId = null;
      isTransitioning.value = false;
    }
  };
  
  isTransitioning.value = true;
  animationFrameId = requestAnimationFrame(animate);
};

/**
 * Trigger smooth transition to new view
 */
const triggerViewTransition = () => {
  const { flowOpacity, hexOpacity } = getTargetOpacities();
  
  // Only animate if values are different
  if (Math.abs(animatedFlowOpacity.value - flowOpacity) > 0.01 ||
      Math.abs(animatedHexOpacity.value - hexOpacity) > 0.01) {
    animateOpacities(flowOpacity, hexOpacity);
  }
};

/**
 * Get current animated layer opacities for rendering
 */
const getLayerOpacities = () => {
  return { 
    flowOpacity: animatedFlowOpacity.value, 
    hexOpacity: animatedHexOpacity.value 
  };
};

/**
 * Switch to a specific view mode with smooth transition animation
 */
const switchToView = (mode) => {
  if (mode === manualViewMode.value) {
    // Toggle back to auto if clicking the same mode
    manualViewMode.value = 'auto';
  } else {
    manualViewMode.value = mode;
  }
  
  // Clear any hover states
  hoverInfo.value = null;
  
  // If switching away from warehouse, hide the sunburst
  if (mode !== 'warehouse' && showSunburst.value) {
    showSunburst.value = false;
    activeWarehouse.value = null;
  }
  
  // Trigger smooth opacity transition
  triggerViewTransition();
};

/**
 * Fly to a warehouse to show sunburst inventory view
 * Cycles through warehouses if already at one
 */
const warehouseIndex = ref(0);
const WAREHOUSES = [
  { id: 'WH-CA', name: 'California', coords: [-117.8647, 34.0206] },
  { id: 'WH-NJ', name: 'New Jersey', coords: [-74.1724, 40.7357] },
  { id: 'WH-TX', name: 'Texas', coords: [-95.5569, 29.9190] },
  { id: 'WH-IL', name: 'Illinois', coords: [-88.0423, 41.5894] },
];

const flyToWarehouse = () => {
  if (!map) return;
  
  // If already in warehouse view, cycle to next warehouse
  if (showSunburst.value) {
    warehouseIndex.value = (warehouseIndex.value + 1) % WAREHOUSES.length;
  }
  
  const warehouse = WAREHOUSES[warehouseIndex.value];
  
  // Clear any hover info
  hoverInfo.value = null;
  
  // Fly to the warehouse
  map.flyTo({
    center: warehouse.coords,
    zoom: 11,
    duration: 1500,
    essential: true,
  });
  
  // Clear manual mode so auto takes over after fly
  manualViewMode.value = 'auto';
  
  // Trigger smooth transition (layers will fade out as we approach warehouse)
  triggerViewTransition();
};

/**
 * Check if map is zoomed close to a warehouse and update sunburst visibility
 */
const checkWarehouseProximity = () => {
  const zoom = currentZoom.value;
  const wasShowingSunburst = showSunburst.value;
  
  // Only check at high zoom levels
  if (zoom < 10) {
    if (showSunburst.value) {
      showSunburst.value = false;
      activeWarehouse.value = null;
      // Trigger transition back to normal view
      triggerViewTransition();
    }
    return;
  }
  
  const center = map.getCenter();
  
  // Find nearest warehouse within range
  const nearestWarehouse = shouldShowWarehouseDetail(zoom, center.lng, center.lat);
  
  if (nearestWarehouse) {
    activeWarehouse.value = nearestWarehouse;
    activeWarehouseInventory.value = getWarehouseInventory(nearestWarehouse.id);
    showSunburst.value = true;
    
    // Clear hex hover info when showing sunburst
    hoverInfo.value = null;
    
    // Calculate screen position for sunburst
    updateSunburstPosition();
    
    // Trigger transition if sunburst just appeared
    if (!wasShowingSunburst) {
      triggerViewTransition();
    }
  } else {
    if (showSunburst.value) {
      showSunburst.value = false;
      activeWarehouse.value = null;
      // Trigger transition back to normal view
      triggerViewTransition();
    }
  }
};

/**
 * Update the sunburst screen position based on warehouse coordinates
 */
const updateSunburstPosition = () => {
  if (!activeWarehouse.value || !map) return;
  
  const point = map.project(activeWarehouse.value.coords);
  sunburstScreenPos.value = { x: point.x, y: point.y };
};

// ============================================================================
// FLOW CLICK HANDLING
// ============================================================================

/**
 * Calculate distance between two points
 */
const pointDistance = (p1, p2) => {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Handle click on a bundled flow path
 * Finds all original arcs that match this bundled path by source/target proximity
 */
const handleFlowClick = (bundledPath) => {
  if (!bundledPath || !bundledPath.path || bundledPath.path.length < 2) return;
  
  // Get start and end points of the bundled path
  const pathStart = bundledPath.path[0];
  const pathEnd = bundledPath.path[bundledPath.path.length - 1];
  
  // Extract aggregated stats from the bundled path (these are accurate even if samples are limited)
  const extractAggregatedStats = (path) => {
    if (path.orderCount !== undefined) {
      return {
        orderCount: path.orderCount,
        volume: path.volume || path.orderCount,
        totalValue: path.totalValue || 0,
      };
    }
    return null;
  };
  
  // First, check if bundledPath has orderIndices (from aggregated arc)
  if (bundledPath.orderIndices && bundledPath.orderIndices.length > 0) {
    // Get original orders directly from indices (limited sample)
    const originalOrders = getOrdersForAggregatedArc(bundledPath);
    if (originalOrders.length > 0) {
      selectedFlowData.value = originalOrders;
      selectedAggregatedStats.value = extractAggregatedStats(bundledPath);
      selectedPathId.value = bundledPath.id;
      showFlowSidebar.value = true;
      updateVisualization();
      return;
    }
  }
  
  // Fallback: Find matching aggregated arcs by proximity
  const threshold = 2.0; // Larger threshold for state centroids
  
  const matchingAggArcs = aggregatedArcs.value.filter(arc => {
    const sourceMatch = pointDistance(arc.source, pathStart) < threshold;
    const targetMatch = pointDistance(arc.target, pathEnd) < threshold;
    return sourceMatch && targetMatch;
  });
  
  if (matchingAggArcs.length > 0) {
    // Get all original orders from matching aggregated arcs (limited samples)
    const allOrders = matchingAggArcs.flatMap(agg => getOrdersForAggregatedArc(agg));
    // Sum up the true aggregated stats from all matching arcs
    const combinedStats = matchingAggArcs.reduce((sum, agg) => ({
      orderCount: sum.orderCount + (agg.orderCount || 0),
      volume: sum.volume + (agg.volume || 0),
      totalValue: sum.totalValue + (agg.totalValue || 0),
    }), { orderCount: 0, volume: 0, totalValue: 0 });
    
    if (allOrders.length > 0) {
      selectedFlowData.value = allOrders;
      selectedAggregatedStats.value = combinedStats;
      selectedPathId.value = bundledPath.id;
      showFlowSidebar.value = true;
      updateVisualization();
      return;
    }
  }
  
  // Last fallback: search in raw arcs
  const nearbyArcs = allArcsData.value.filter(arc => {
    const sourceMatch = pointDistance(arc.source, pathStart) < threshold;
    return sourceMatch;
  }).slice(0, 100); // Limit for performance
  
  if (nearbyArcs.length > 0) {
    selectedFlowData.value = nearbyArcs;
    selectedAggregatedStats.value = null; // No aggregated stats for raw arc fallback
    selectedPathId.value = bundledPath.id;
    showFlowSidebar.value = true;
    updateVisualization();
  } else {
    // Show aggregated info
    console.log('Showing aggregated path info:', bundledPath);
    selectedFlowData.value = [{
      source: pathStart,
      target: pathEnd,
      volume: bundledPath.volume || bundledPath.orderCount || 1,
      category: bundledPath.category || 'Mixed',
      shipperState: bundledPath.shipperState || 'Unknown',
      shiptoState: bundledPath.destState || 'Unknown',
      shipperName: 'Warehouse',
      cargoName: 'Various Products',
      usdValue: bundledPath.totalValue || 0,
      distance: 0,
    }];
    selectedAggregatedStats.value = extractAggregatedStats(bundledPath);
    selectedPathId.value = bundledPath.id;
    showFlowSidebar.value = true;
    updateVisualization();
  }
};

/**
 * Close the flow detail sidebar
 */
const closeFlowSidebar = () => {
  showFlowSidebar.value = false;
  selectedPathId.value = null;
  selectedFlowData.value = [];
  selectedAggregatedStats.value = null;
  updateVisualization();
};

// ============================================================================
// IMPORT ROUTE CLICK HANDLING
// ============================================================================

/**
 * Handle click on an import route arc
 * Opens sidebar with container/shipment details
 */
const handleImportRouteClick = (routeData) => {
  if (!routeData) return;
  
  // Get the shipments for this route from the composable
  const shipments = allShipments.value.filter(s => 
    s.originPort === routeData.originPort && 
    s.destinationPort === routeData.destinationPort
  );
  
  selectedImportRoute.value = {
    ...routeData,
    shipments,
  };
  showImportSidebar.value = true;
  hoverInfo.value = null; // Clear hover
};

/**
 * Close the import route sidebar
 */
const closeImportSidebar = () => {
  showImportSidebar.value = false;
  selectedImportRoute.value = null;
};


// ============================================================================
// BUNDLING
// ============================================================================

const rebundle = async () => {
  // Use aggregated warehouse→state arcs for bundling (much faster!)
  const arcsToBundle = aggregatedArcs.value.length > 0 ? aggregatedArcs.value : allArcsData.value;
  if (arcsToBundle.length === 0) return;
  
  console.log(`Bundling ${arcsToBundle.length} flows using SBEB`);
  
  const options = {
    algorithm: 'SBEB',
    gridResolution: 128,
    subdivisionPoints: 64,
    iterations: 15,
    attractionStrength: 0.35,
    smoothing: 0.65,
    aggregationGridSize: 2.0,
  };
  
  await startBundling(arcsToBundle, options);
  
  updateVisualization();
};

// ============================================================================
// LAYER CREATION
// ============================================================================

const createLayers = () => {
  const layers = [];
  const { flowOpacity, hexOpacity } = getLayerOpacities();
  
  // === FLOW LAYERS (visible at low zoom) ===
  if (flowOpacity > 0.05) {
    if (useBundling.value && bundledArcsData.value.length > 0) {
      // Bundled paths
      const bundledData = bundledArcsData.value.map(arc => ({
        ...arc,
        path: arc.path.map(p => [p[0], p[1]]),
        warehouseColor: arc.warehouseColor ? [...arc.warehouseColor] : [255, 100, 100],
      }));
      
      layers.push(
        new PathLayer({
          id: 'bundled-paths',
          data: bundledData,
          getPath: d => d.path,
          getColor: d => {
            // Highlight selected path
            if (selectedPathId.value && d.id === selectedPathId.value) {
              return [78, 205, 196, 255]; // Teal highlight
            }
            // Dim other paths when sidebar is open
            const opacity = showFlowSidebar.value ? 0.3 : 1;
            return getBundledPathColor(d, colorMode.value, arcOpacity.value * flowOpacity * opacity);
          },
          getWidth: d => {
            // Make selected path thicker
            if (selectedPathId.value && d.id === selectedPathId.value) {
              return getBundledPathWidth(d, arcWidth.value) * 2;
            }
            return getBundledPathWidth(d, arcWidth.value);
          },
          widthUnits: 'pixels',
          widthMinPixels: 1,
          widthMaxPixels: 20,
          pickable: true,
          capRounded: true,
          jointRounded: true,
          visible: flowOpacity > 0.05,
          updateTriggers: {
            getColor: [selectedPathId.value, showFlowSidebar.value, colorMode.value, arcOpacity.value],
            getWidth: [selectedPathId.value, arcWidth.value],
          },
          onClick: (info) => {
            if (info.object) {
              handleFlowClick(info.object);
            }
          },
        })
      );
      
      // Warehouse markers - 4 fulfillment centers from actual delivery data
      const warehouseData = [
        { id: 'WH-CA', name: 'California', coordinates: [-117.8647, 34.0206], color: [255, 165, 0], orders: 27071 },
        { id: 'WH-NJ', name: 'New Jersey', coordinates: [-74.1724, 40.7357], color: [30, 144, 255], orders: 17128 },
        { id: 'WH-TX', name: 'Texas', coordinates: [-95.5569, 29.9190], color: [50, 205, 50], orders: 4300 },
        { id: 'WH-IL', name: 'Illinois', coordinates: [-88.0423, 41.5894], color: [255, 99, 71], orders: 2872 },
      ];
      
      layers.push(
        new ScatterplotLayer({
          id: 'warehouse-markers',
          data: warehouseData,
          getPosition: d => d.coordinates,
          getFillColor: d => [...d.color, 220],
          getRadius: 25000,
          radiusMinPixels: 12,
          radiusMaxPixels: 40,
          stroked: true,
          lineWidthMinPixels: 3,
          getLineColor: [255, 255, 255, 255],
          pickable: true,
          onClick: (info) => {
            if (info.object && map) {
              console.log(`🏭 Clicked warehouse: ${info.object.id} (${info.object.name})`);
              // Fly to warehouse and zoom in
              map.flyTo({
                center: info.object.coordinates,
                zoom: 11,
                duration: 1500,
              });
            }
          },
          onHover: (info) => {
            if (info.object) {
              hoverInfo.value = { 
                count: 0, 
                warehouse: `${info.object.id}: ${info.object.name}`,
                isWarehouse: true,
              };
            }
          },
        })
      );
    } else {
      // Show aggregated warehouse→state arcs as simple curved arcs
      // These are the 202 flows we aggregated for bundling
      const arcsToShow = aggregatedArcs.value.length > 0 ? aggregatedArcs.value : allArcsData.value.slice(0, 5000);
      
      layers.push(
        new ArcLayer({
          id: 'aggregated-arcs',
          data: arcsToShow,
          getSourcePosition: d => d.source,
          getTargetPosition: d => d.target,
          getSourceColor: d => {
            // Color by warehouse
            const wKey = d.shipperState || '';
            if (wKey.includes('CA') || wKey === 'CA') return [255, 107, 53, Math.round(220 * flowOpacity)];
            if (wKey.includes('NJ') || wKey === 'NJ') return [0, 212, 255, Math.round(220 * flowOpacity)];
            if (wKey.includes('TX') || wKey === 'TX') return [178, 255, 89, Math.round(220 * flowOpacity)];
            if (wKey.includes('IL') || wKey === 'IL') return [178, 102, 255, Math.round(220 * flowOpacity)];
            return [255, 140, 0, Math.round(200 * flowOpacity)];
          },
          getTargetColor: d => {
            const wKey = d.shipperState || '';
            if (wKey.includes('CA') || wKey === 'CA') return [255, 180, 140, Math.round(180 * flowOpacity)];
            if (wKey.includes('NJ') || wKey === 'NJ') return [140, 230, 255, Math.round(180 * flowOpacity)];
            if (wKey.includes('TX') || wKey === 'TX') return [210, 255, 170, Math.round(180 * flowOpacity)];
            if (wKey.includes('IL') || wKey === 'IL') return [210, 170, 255, Math.round(180 * flowOpacity)];
            return [255, 200, 150, Math.round(180 * flowOpacity)];
          },
          getWidth: d => Math.max(1, Math.log10((d.volume || d.orderCount || 1) + 1) * 2),
          getHeight: 0.3, // Gentle arc height
          greatCircle: false, // Simple arc
          pickable: true,
          visible: flowOpacity > 0.05,
          onClick: (info) => {
            if (info.object) {
              // Use the aggregated arc data directly
              const orders = getOrdersForAggregatedArc(info.object);
              if (orders.length > 0) {
                selectedFlowData.value = orders;
              } else {
                selectedFlowData.value = [info.object];
              }
              // Set aggregated stats for accurate count display
              selectedAggregatedStats.value = {
                orderCount: info.object.orderCount || orders.length,
                volume: info.object.volume || 0,
                totalValue: info.object.totalValue || 0,
              };
              showFlowSidebar.value = true;
            }
          },
        })
      );
    }
  }
  
  // === HEXAGON LAYER (visible at high zoom) ===
  // Color by dominant category, height by volume
  if (hexOpacity > 0.05 && destinationPoints.value.length > 0) {
    // Category to color index mapping
    const CATEGORY_INDEX = {
      'Home & Garden': 0,
      'Apparel & Accessories': 1,
      'Health & Beauty': 2,
      'Electronics': 3,
      'Toys & Games': 4,
      'Hardware': 5,
      'Business & Industrial': 6,
      'Arts & Entertainment': 7,
      'Vehicles & Parts': 8,
      'Office Supplies': 9,
      'Unknown': 10,
    };
    
    layers.push(
      new HexagonLayer({
        id: 'hexagons',
        data: destinationPoints.value,
        getPosition: d => d.position,
        radius: hexRadius.value,
        elevationScale: elevationScale.value,
        extruded: true,
        coverage: 0.9,
        pickable: true,
        autoHighlight: true,
        opacity: hexOpacity,
        visible: hexOpacity > 0.05,
        gpuAggregation: false,
        
        // Color by dominant category - return index 0-10
        getColorValue: points => {
          const counts = {};
          points.forEach(p => {
            const cat = p.source?.category || p.category || 'Unknown';
            counts[cat] = (counts[cat] || 0) + 1;
          });
          let maxCat = 'Unknown';
          let maxCount = 0;
          Object.entries(counts).forEach(([cat, count]) => {
            if (count > maxCount) {
              maxCount = count;
              maxCat = cat;
            }
          });
          // Return index (0-10) for color mapping
          return CATEGORY_INDEX[maxCat] ?? 10;
        },
        colorDomain: [0, 10],
        colorRange: [
          [39, 174, 96],     // 0: Home & Garden - Green
          [231, 76, 60],     // 1: Apparel - Red
          [155, 89, 182],    // 2: Health & Beauty - Purple
          [52, 152, 219],    // 3: Electronics - Blue
          [241, 196, 15],    // 4: Toys & Games - Yellow
          [230, 126, 34],    // 5: Hardware - Orange
          [26, 188, 156],    // 6: Industrial - Teal
          [142, 68, 173],    // 7: Arts - Dark purple
          [44, 62, 80],      // 8: Vehicles - Dark blue
          [127, 140, 141],   // 9: Office - Gray
          [149, 165, 166],   // 10: Unknown - Light gray
        ],
        
        material: {
          ambient: 0.6,
          diffuse: 0.6,
          shininess: 32,
        },
        onHover: (info, event) => {
          if (info.object) {
            const pts = info.object.points || [];
            // Count categories in this hexagon
            const counts = {};
            let total = 0;
            pts.forEach(p => {
              const cat = p.source?.category || p.category || 'Unknown';
              counts[cat] = (counts[cat] || 0) + 1;
              total++;
            });
            
            // Find dominant category
            let dominantCat = 'Unknown';
            let maxCount = 0;
            Object.entries(counts).forEach(([cat, count]) => {
              if (count > maxCount) {
                maxCount = count;
                dominantCat = cat;
              }
            });
            
            // Sort categories by count
            const sortedCategories = Object.entries(counts)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, count]) => ({
                name: cat,
                count,
                percent: Math.round((count / total) * 100),
              }));
            
            hoverInfo.value = {
              count: total,
              dominantCategory: dominantCat,
              categories: sortedCategories,
              x: event?.offsetCenter?.x || info.x || 0,
              y: event?.offsetCenter?.y || info.y || 0,
            };
          } else {
            hoverInfo.value = null;
          }
        },
      })
    );
  }
  
  // === IMPORT ARC LAYER (China ports to US ports) ===
  if (showImportArcs.value && flowOpacity > 0.05 && getPortArcs.value.length > 0) {
    // Port-to-port shipping routes
    layers.push(
      new ArcLayer({
        id: 'import-arcs',
        data: getPortArcs.value,
        getSourcePosition: d => d.source,
        getTargetPosition: d => d.target,
        getSourceColor: [255, 215, 0, Math.round(180 * flowOpacity)], // Gold for China
        getTargetColor: [0, 191, 255, Math.round(200 * flowOpacity)], // Deep sky blue for US
        getWidth: d => Math.max(2, Math.log10(d.containerCount + 1) * 3),
        getHeight: 0.5, // Higher arc for trans-Pacific routes
        greatCircle: true, // Follow great circle path
        pickable: true,
        visible: flowOpacity > 0.05,
        onHover: (info) => {
          if (info.object) {
            hoverInfo.value = {
              isImportRoute: true,
              originPort: info.object.originPort,
              destinationPort: info.object.destinationPort,
              containerCount: info.object.containerCount,
              totalValue: info.object.totalValue,
              totalQuantity: info.object.totalQuantity,
              x: info.x,
              y: info.y,
            };
          } else {
            hoverInfo.value = null;
          }
        },
        onClick: (info) => {
          if (info.object) {
            handleImportRouteClick(info.object);
          }
        },
      })
    );
    
    // Port markers (origin ports in China, destination ports in US)
    layers.push(
      new ScatterplotLayer({
        id: 'port-markers',
        data: getPortMarkers.value,
        getPosition: d => d.coords,
        getFillColor: d => d.type === 'origin' 
          ? [255, 215, 0, 220]  // Gold for China ports
          : [0, 191, 255, 220], // Blue for US ports
        getRadius: d => Math.max(15000, Math.sqrt(d.containerCount) * 8000),
        radiusMinPixels: 6,
        radiusMaxPixels: 25,
        stroked: true,
        lineWidthMinPixels: 2,
        getLineColor: [255, 255, 255, 200],
        pickable: true,
        visible: flowOpacity > 0.05,
        onHover: (info) => {
          if (info.object) {
            hoverInfo.value = {
              isPort: true,
              portName: info.object.name,
              portType: info.object.type,
              containerCount: info.object.containerCount,
              shipmentCount: info.object.shipmentCount,
              totalValue: info.object.totalValue,
              x: info.x,
              y: info.y,
            };
          } else {
            hoverInfo.value = null;
          }
        },
      })
    );
  }
  
  return layers;
};

// ============================================================================
// UPDATE VISUALIZATION
// ============================================================================

const updateVisualization = () => {
  if (!deckOverlay) return;
  if (allArcsData.value.length === 0 && destinationPoints.value.length === 0) return;
  
  deckOverlay.setProps({ layers: createLayers() });
};

// ============================================================================
// LIFECYCLE
// ============================================================================

onMounted(async () => {
  // Load data with destination points for hexagon layer
  await Promise.all([
    loadDemandData({ includeDestinationPoints: true }),
    loadInventoryData(),
    loadInboundData(), // Load container/port import data
  ]);
  
  // Start bundling if enabled
  if (useBundling.value && allArcsData.value.length > 0) {
    rebundle();
  }
  
  // Initialize Mapbox
  mapboxgl.accessToken = MAPBOX_TOKEN;
  
  map = new mapboxgl.Map({
    container: mapContainer.value,
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [-98.5795, 39.8283], // Center of US
    zoom: 4,
    pitch: 30,
    projection: 'mercator',
  });
  
  map.on('load', () => {
    // Initialize animated opacity values based on starting view
    const { flowOpacity, hexOpacity } = getTargetOpacities();
    animatedFlowOpacity.value = flowOpacity;
    animatedHexOpacity.value = hexOpacity;
    
    deckOverlay = new MapboxOverlay({
      interleaved: true,
      layers: createLayers(),
    });
    map.addControl(deckOverlay);
  });
  
  // Track zoom for semantic zoom behavior
  map.on('zoom', () => {
    const newZoom = map.getZoom();
    const prevView = currentView.value;
    
    // Reset to auto mode when user zooms (more intuitive UX)
    if (manualViewMode.value !== 'auto') {
      manualViewMode.value = 'auto';
    }
    
    currentZoom.value = newZoom;
    
    // Check if view changed due to zoom
    const newView = showSunburst.value ? 'warehouse' : (newZoom < 6 ? 'flows' : 'density');
    if (prevView !== newView) {
      hoverInfo.value = null; // Clear any hover states
      // Trigger smooth opacity transition
      triggerViewTransition();
    }
    
    checkWarehouseProximity();
  });
  
  // Track map movement for warehouse proximity
  map.on('moveend', () => {
    checkWarehouseProximity();
  });
  
  // Update sunburst position during map movement
  map.on('move', () => {
    if (showSunburst.value) {
      updateSunburstPosition();
    }
  });
  
  map.on('pitch', updateVisualization);
  map.addControl(new mapboxgl.NavigationControl(), 'top-right');
});

// ============================================================================
// WATCHERS
// ============================================================================

// Visual settings that need immediate update (no transition)
watch([colorMode, arcWidth, arcOpacity, hexRadius, elevationScale, showFlowSidebar, showImportArcs], updateVisualization);

// View mode changes that need smooth transitions
watch([showSunburst, manualViewMode], () => {
  triggerViewTransition();
});

watch(useBundling, (enabled) => {
  if (enabled && bundledArcsData.value.length === 0) {
    rebundle();
  } else {
    updateVisualization();
  }
});

// bundlingAlgorithm watcher removed - SBEB only

watch(selectedDate, () => {
  filterByDate();
  if (useBundling.value) {
    rebundle();
  } else {
    updateVisualization();
  }
});
</script>

<style scoped>
.flow-map-container {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: #1a1a2e;
}

.controls-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.97);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid #e0e0e0;
  z-index: 10;
}

.controls-panel {
  position: absolute;
  top: 70px;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid #e0e0e0;
  z-index: 10;
}

.stat-card {
  background: #f8f9fa;
  padding: 6px 12px;
  border-radius: 6px;
  text-align: center;
  min-width: 70px;
}

.stat-card small {
  font-size: 10px;
}

.stat-card strong {
  font-size: 14px;
}

.map-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.loading-overlay,
.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(26, 26, 46, 0.95);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 100;
  color: white;
}

.zoom-indicator {
  position: absolute;
  bottom: 25px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.zoom-bar {
  display: flex;
  background: rgba(20, 20, 35, 0.9);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.zoom-bar.transitioning {
  animation: pulse-glow 0.5s ease-out;
}

@keyframes pulse-glow {
  0% { 
    box-shadow: 0 0 0 0 rgba(78, 205, 196, 0.5); 
    transform: scale(1);
  }
  30% { 
    box-shadow: 0 0 25px 8px rgba(78, 205, 196, 0.4); 
    transform: scale(1.02);
  }
  100% { 
    box-shadow: 0 0 0 0 rgba(78, 205, 196, 0); 
    transform: scale(1);
  }
}

/* Smooth layer transition overlay effect */
.flow-map-container::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 5;
  background: radial-gradient(ellipse at center, transparent 0%, transparent 100%);
  opacity: 0;
  transition: opacity 0.3s ease-out;
}

.flow-map-container.transitioning::after {
  opacity: 1;
  background: radial-gradient(ellipse at center, rgba(78, 205, 196, 0.05) 0%, transparent 70%);
}

.zoom-section {
  padding: 8px 16px;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  cursor: pointer;
}

.zoom-section:hover:not(.active) {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.zoom-section i {
  font-size: 14px;
}

.zoom-section span {
  font-size: 12px;
  font-weight: 500;
}

.zoom-section.active {
  background: #0d6efd;
  color: white;
}

.zoom-section.manual {
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.3);
}

.zoom-section:nth-child(2).active {
  background: #198754;
}

.zoom-section.warehouse {
  cursor: pointer;
}

.zoom-section.warehouse:hover:not(.active) {
  background: rgba(102, 126, 234, 0.3);
}

.zoom-section.warehouse.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.auto-hint {
  color: rgba(255, 255, 255, 0.4);
  font-size: 10px;
}

/* Category Legend for Hexagon Layer */
.category-legend {
  position: absolute;
  top: 200px;
  right: 15px;
  z-index: 10;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(8px);
  max-width: 160px;
}

.legend-title {
  font-size: 11px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.legend-items {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-color {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  flex-shrink: 0;
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.15);
}

.legend-label {
  font-size: 11px;
  color: #555;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.density-gradient {
  margin-top: 8px;
}

.gradient-bar {
  height: 12px;
  border-radius: 4px;
  background: linear-gradient(to right, 
    rgb(65, 182, 196),
    rgb(127, 205, 187),
    rgb(199, 233, 180),
    rgb(255, 237, 160),
    rgb(254, 178, 76),
    rgb(240, 59, 32),
    rgb(189, 0, 38)
  );
}

.gradient-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #666;
  margin-top: 2px;
}

/* Hexagon Hover Tooltip */
.hex-tooltip {
  position: absolute;
  z-index: 100;
  background: rgba(20, 20, 35, 0.95);
  border-radius: 8px;
  padding: 12px;
  min-width: 200px;
  max-width: 280px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  pointer-events: none;
  backdrop-filter: blur(10px);
}

.tooltip-header {
  color: white;
  font-size: 14px;
  margin-bottom: 8px;
}

.tooltip-header strong {
  font-size: 18px;
  color: #3498db;
}

.tooltip-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.15);
  margin: 8px 0;
}

.tooltip-categories {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.category-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
}

.cat-color {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  flex-shrink: 0;
}

.cat-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cat-stats {
  color: rgba(255, 255, 255, 0.6);
  font-size: 11px;
  white-space: nowrap;
}

.more-categories {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  font-style: italic;
  margin-top: 4px;
}

/* Import Route Tooltip */
.import-tooltip .import-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #f1c40f;
}

.import-tooltip .import-header i {
  font-size: 16px;
}

.tooltip-stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tooltip-stats .stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.tooltip-stats .stat-label {
  color: rgba(255, 255, 255, 0.6);
}

.tooltip-stats .stat-value {
  color: #4ecdc4;
  font-weight: 600;
}

/* Port Tooltip */
.port-tooltip .port-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.port-tooltip .port-header i {
  font-size: 14px;
}

.port-tooltip .port-type {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  margin-left: auto;
}

.info-panel {
  position: absolute;
  bottom: 80px;
  right: 15px;
  z-index: 10;
  max-width: 180px;
}

.info-panel .card {
  background: rgba(255, 255, 255, 0.95);
  border: none;
}

.hover-stats {
  background: #f0f0f0;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 11px;
}

h2 i {
  color: #0d6efd;
}

/* Form controls */
.form-select-sm, .form-range {
  font-size: 12px;
}

.form-label {
  font-size: 11px;
  color: #666;
}

.form-check-input:checked {
  background-color: #198754;
  border-color: #198754;
}

.badge.bg-purple {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
</style>
