<template>
  <Transition name="slide">
    <div v-if="isVisible" class="flow-sidebar" @click.stop>
      <!-- Header -->
      <div class="sidebar-header">
        <div class="header-title">
          <i class="bi bi-bezier2"></i>
          <span>Flow Details</span>
        </div>
        <button class="close-btn" @click="$emit('close')" title="Close">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>

      <!-- Route Summary -->
      <div class="sidebar-section">
        <h4 class="section-title">
          <i class="bi bi-geo-alt"></i> Route
        </h4>
        <div class="route-info">
          <div class="route-endpoint origin">
            <span class="label">From</span>
            <span class="warehouse-name">{{ warehouseName }}</span>
            <span class="location">{{ originState }}</span>
          </div>
          <div class="route-arrow">
            <i class="bi bi-arrow-down"></i>
          </div>
          <div class="route-endpoint destination">
            <span class="label">To</span>
            <span class="region-name">{{ destinationRegion }}</span>
            <span class="location" v-if="uniqueDestStates.length > 1">{{ uniqueDestStates.join(', ') }}</span>
          </div>
        </div>
      </div>

      <!-- Order Stats -->
      <div class="sidebar-section">
        <h4 class="section-title">
          <i class="bi bi-bar-chart"></i> Statistics
        </h4>
        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-value">{{ totalOrders.toLocaleString() }}</span>
            <span class="stat-label">Orders</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ totalVolume.toLocaleString() }}</span>
            <span class="stat-label">Items</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">${{ formatCurrency(totalValue) }}</span>
            <span class="stat-label">Value</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ avgDistance.toFixed(0) }} mi</span>
            <span class="stat-label">Avg Distance</span>
          </div>
        </div>
      </div>

      <!-- Top Categories -->
      <div class="sidebar-section">
        <h4 class="section-title">
          <i class="bi bi-tags"></i> Categories
        </h4>
        <div class="category-bars">
          <div 
            v-for="cat in topCategories" 
            :key="cat.name" 
            class="category-bar"
          >
            <div class="category-info">
              <span 
                class="category-dot" 
                :style="{ backgroundColor: getCategoryColor(cat.name) }"
              ></span>
              <span class="category-name">{{ cat.name }}</span>
              <span class="category-count">{{ cat.count }}</span>
            </div>
            <div class="bar-container">
              <div 
                class="bar-fill" 
                :style="{ 
                  width: `${cat.percent}%`,
                  backgroundColor: getCategoryColor(cat.name)
                }"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sample SKUs -->
      <div class="sidebar-section">
        <h4 class="section-title">
          <i class="bi bi-upc-scan"></i> Sample SKUs
        </h4>
        <div class="product-list">
          <div v-for="(sku, idx) in sampleSkus" :key="idx" class="product-item">
            <span class="product-bullet">•</span>
            <span class="product-name">{{ sku }}</span>
          </div>
        </div>
        <div v-if="totalOrders > sampleSkus.length" class="more-products">
          + {{ totalOrders - sampleSkus.length }} more SKUs
        </div>
      </div>
    </div>
  </Transition>
  
  <!-- Backdrop -->
  <Transition name="fade">
    <div v-if="isVisible" class="sidebar-backdrop" @click="$emit('close')"></div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  isVisible: {
    type: Boolean,
    default: false,
  },
  flowData: {
    type: Array,
    default: () => [],
  },
  // Aggregated stats from the route (optional, overrides flowData-based calculations)
  aggregatedStats: {
    type: Object,
    default: null, // { orderCount, volume, totalValue }
  },
});

defineEmits(['close']);

// State code to full name mapping
const STATE_NAMES = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
  'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
  'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
  'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
  'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
  'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
  'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
  'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
  'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
  'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
  'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'Washington DC',
};

// Warehouse locations by state code
const WAREHOUSE_NAMES = {
  'CA': 'California Warehouse',
  'NJ': 'New Jersey Warehouse',
  'TX': 'Texas Warehouse',
  'IL': 'Illinois Warehouse',
};

/**
 * Normalize state input to 2-letter code
 * Handles both codes like "CA" and full names like "California"
 */
const normalizeStateCode = (state) => {
  if (!state) return null;
  const trimmed = state.trim().toUpperCase();
  
  // Already a 2-letter code
  if (trimmed.length === 2 && STATE_NAMES[trimmed]) {
    return trimmed;
  }
  
  // Try to find by full name
  const entry = Object.entries(STATE_NAMES).find(
    ([, name]) => name.toUpperCase() === trimmed
  );
  return entry ? entry[0] : null;
};

// Category colors matching the hexagon layer
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

const formatCurrency = (value) => {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
  if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
  return value.toFixed(0);
};

// Computed stats - prefer aggregatedStats if available (more accurate for large routes)
const totalOrders = computed(() => 
  props.aggregatedStats?.orderCount ?? props.flowData.length
);

const totalVolume = computed(() => 
  props.aggregatedStats?.volume ?? 
  props.flowData.reduce((sum, arc) => sum + (arc.volume || 1), 0)
);

const totalValue = computed(() => 
  props.aggregatedStats?.totalValue ?? 
  props.flowData.reduce((sum, arc) => sum + (arc.usdValue || 0), 0)
);

const avgDistance = computed(() => {
  if (props.flowData.length === 0) return 0;
  const total = props.flowData.reduce((sum, arc) => sum + (arc.distance || 0), 0);
  return total / props.flowData.length;
});

// Get the origin warehouse state code
const originStateCode = computed(() => {
  if (props.flowData.length === 0) return null;
  // Get most common shipper state
  const counts = {};
  props.flowData.forEach(arc => {
    const code = normalizeStateCode(arc.shipperState);
    if (code) {
      counts[code] = (counts[code] || 0) + 1;
    }
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || null;
});

const warehouseName = computed(() => {
  const code = originStateCode.value;
  if (!code) return 'Unknown';
  return WAREHOUSE_NAMES[code] || `${STATE_NAMES[code] || code} Warehouse`;
});

const originState = computed(() => {
  const code = originStateCode.value;
  if (!code) return '';
  return code; // Just show the state code like "CA"
});

// Normalize all destination states to 2-letter codes
const uniqueDestStates = computed(() => {
  const codes = new Set();
  props.flowData.forEach(arc => {
    const code = normalizeStateCode(arc.shiptoState);
    if (code) codes.add(code);
  });
  return Array.from(codes).slice(0, 5);
});

const destinationRegion = computed(() => {
  const states = uniqueDestStates.value;
  const count = states.length;
  if (count === 0) return 'Unknown';
  if (count === 1) {
    // Show full name for single state
    return STATE_NAMES[states[0]] || states[0];
  }
  return `${count} States`;
});

const topCategories = computed(() => {
  const counts = {};
  props.flowData.forEach(arc => {
    const cat = arc.category || 'Unknown';
    counts[cat] = (counts[cat] || 0) + 1;
  });
  
  const total = props.flowData.length;
  return Object.entries(counts)
    .map(([name, count]) => ({
      name,
      count,
      percent: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
});

const sampleSkus = computed(() => {
  const skus = props.flowData
    .map(arc => arc.sku)
    .filter(sku => sku && sku.length > 0)
    .slice(0, 12);
  
  // Dedupe while keeping order
  return [...new Set(skus)].slice(0, 8);
});
</script>

<style scoped>
.flow-sidebar {
  position: fixed;
  top: 0;
  right: 0;
  width: 360px;
  height: 100vh;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.5);
  overflow-y: auto;
}

.sidebar-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.3);
  z-index: 999;
}

/* Transitions */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease-out;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Header */
.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.header-title i {
  color: #4ecdc4;
}

.close-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #fff;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #ff6b6b;
}

/* Sections */
.sidebar-section {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 12px 0;
}

.section-title i {
  font-size: 14px;
}

/* Route Info */
.route-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.route-endpoint {
  display: flex;
  flex-direction: column;
  padding: 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
}

.route-endpoint .label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  margin-bottom: 4px;
}

.route-endpoint .warehouse-name,
.route-endpoint .region-name {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.route-endpoint .location {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 2px;
}

.route-endpoint.origin {
  border-left: 3px solid #4ecdc4;
}

.route-endpoint.destination {
  border-left: 3px solid #ff6b6b;
}

.route-arrow {
  display: flex;
  justify-content: center;
  color: rgba(255, 255, 255, 0.3);
  font-size: 18px;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14px 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #4ecdc4;
}

.stat-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  margin-top: 4px;
}

/* Category Bars */
.category-bars {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.category-bar {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.category-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.category-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.category-name {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.category-count {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 500;
}

.bar-container {
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

/* Product List */
.product-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.product-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.4;
}

.product-bullet {
  color: #4ecdc4;
  flex-shrink: 0;
}

.product-name {
  word-break: break-word;
}

.more-products {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  font-style: italic;
  margin-top: 8px;
}
</style>

