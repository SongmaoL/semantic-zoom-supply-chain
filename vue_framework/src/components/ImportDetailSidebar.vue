<template>
  <Transition name="slide">
  <div v-if="isVisible" class="import-sidebar">
    <div class="sidebar-content">
      <!-- Header -->
      <div class="sidebar-header">
        <div class="header-title">
          <i class="bi bi-ship"></i>
          <span>Import Route Details</span>
        </div>
        <button class="close-btn" @click="$emit('close')" title="Close">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>

      <!-- Route Summary -->
      <div class="sidebar-section route-summary">
        <div class="route-visual">
          <div class="route-endpoint origin">
            <span class="port-icon">🇨🇳</span>
            <span class="port-name">{{ routeData?.originPort || 'Unknown' }}</span>
            <span class="port-label">Origin Port</span>
          </div>
          <div class="route-arrow">
            <i class="bi bi-arrow-right"></i>
            <span class="transit-info">~{{ avgTransitDays }} days</span>
          </div>
          <div class="route-endpoint destination">
            <span class="port-icon">🇺🇸</span>
            <span class="port-name">{{ routeData?.destinationPort || 'Unknown' }}</span>
            <span class="port-label">Destination Port</span>
          </div>
        </div>
      </div>

      <!-- Key Stats -->
      <div class="sidebar-section stats-grid">
        <div class="stat-box">
          <i class="bi bi-box-seam"></i>
          <span class="stat-value">{{ containerCount.toLocaleString() }}</span>
          <span class="stat-label">Containers</span>
        </div>
        <div class="stat-box">
          <i class="bi bi-truck"></i>
          <span class="stat-value">{{ shipmentCount.toLocaleString() }}</span>
          <span class="stat-label">Shipments</span>
        </div>
        <div class="stat-box">
          <i class="bi bi-currency-dollar"></i>
          <span class="stat-value">${{ (totalValue / 1000000).toFixed(2) }}M</span>
          <span class="stat-label">Cargo Value</span>
        </div>
        <div class="stat-box">
          <i class="bi bi-boxes"></i>
          <span class="stat-value">{{ totalQuantity.toLocaleString() }}</span>
          <span class="stat-label">Total Units</span>
        </div>
      </div>

      <!-- Vessel Information -->
      <div class="sidebar-section">
        <h4 class="section-title">
          <i class="bi bi-water"></i> Vessels
        </h4>
        <div class="vessel-list">
          <div v-for="vessel in uniqueVessels" :key="vessel" class="vessel-item">
            <span class="vessel-icon">🚢</span>
            <span class="vessel-name">{{ vessel }}</span>
          </div>
        </div>
      </div>

      <!-- Status Breakdown -->
      <div class="sidebar-section">
        <h4 class="section-title">
          <i class="bi bi-pie-chart"></i> Shipment Status
        </h4>
        <div class="status-breakdown">
          <div 
            v-for="status in statusBreakdown" 
            :key="status.name"
            class="status-item"
          >
            <span class="status-dot" :style="{ backgroundColor: status.color }"></span>
            <span class="status-name">{{ status.name }}</span>
            <span class="status-count">{{ status.count }}</span>
            <div class="status-bar">
              <div 
                class="status-fill" 
                :style="{ width: status.percent + '%', backgroundColor: status.color }"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Category Breakdown -->
      <div class="sidebar-section">
        <h4 class="section-title">
          <i class="bi bi-tags"></i> Product Categories
        </h4>
        <div class="category-list">
          <div 
            v-for="cat in categoryBreakdown" 
            :key="cat.name"
            class="category-item"
          >
            <span class="category-name">{{ cat.name }}</span>
            <span class="category-value">${{ (cat.value / 1000).toFixed(0) }}K</span>
          </div>
        </div>
      </div>

      <!-- Freight Forwarders -->
      <div class="sidebar-section">
        <h4 class="section-title">
          <i class="bi bi-building"></i> Freight Forwarders
        </h4>
        <div class="forwarder-list">
          <div v-for="ff in topForwarders" :key="ff.name" class="forwarder-item">
            <span class="forwarder-name">{{ ff.name }}</span>
            <span class="forwarder-count">{{ ff.count }} shipments</span>
          </div>
        </div>
      </div>

      <!-- Sample Containers -->
      <div class="sidebar-section">
        <h4 class="section-title">
          <i class="bi bi-archive"></i> Sample Containers
        </h4>
        <div class="container-list">
          <div v-for="cont in sampleContainers" :key="cont.id" class="container-item">
            <span class="container-id">{{ cont.id }}</span>
            <span class="container-type">{{ cont.type }}</span>
          </div>
        </div>
        <div v-if="containerCount > sampleContainers.length" class="more-items">
          + {{ containerCount - sampleContainers.length }} more containers
        </div>
      </div>
    </div>
  </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  isVisible: { type: Boolean, default: false },
  routeData: { type: Object, default: null },
});

defineEmits(['close']);

const shipments = computed(() => props.routeData?.shipments || []);

const containerCount = computed(() => {
  const containers = new Set(shipments.value.map(s => s.containerId));
  return containers.size;
});

const shipmentCount = computed(() => shipments.value.length);

const totalValue = computed(() => 
  shipments.value.reduce((sum, s) => sum + (s.totalCargoValue || 0), 0)
);

const totalQuantity = computed(() => 
  shipments.value.reduce((sum, s) => sum + (s.quantity || 0), 0)
);

const avgTransitDays = computed(() => {
  if (shipments.value.length === 0) return 0;
  const total = shipments.value.reduce((sum, s) => sum + (s.transitDays || 0), 0);
  return Math.round(total / shipments.value.length);
});

const uniqueVessels = computed(() => {
  const vessels = new Set(shipments.value.map(s => s.vesselName).filter(Boolean));
  return Array.from(vessels).slice(0, 5);
});

const statusBreakdown = computed(() => {
  const counts = {};
  shipments.value.forEach(s => {
    const status = s.status || 'Unknown';
    counts[status] = (counts[status] || 0) + 1;
  });
  
  const total = shipments.value.length;
  const statusColors = {
    'In Transit': '#3498db',
    'Customs Clearance': '#f1c40f',
    'Delivered': '#27ae60',
    'Pending': '#95a5a6',
    'Delayed': '#e74c3c',
    'Unknown': '#7f8c8d',
  };
  
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      count,
      percent: total > 0 ? Math.round((count / total) * 100) : 0,
      color: statusColors[name] || '#7f8c8d',
    }));
});

const categoryBreakdown = computed(() => {
  const categories = {};
  shipments.value.forEach(s => {
    const cat = s.categoryLvl1 || 'Unknown';
    if (!categories[cat]) {
      categories[cat] = { count: 0, value: 0 };
    }
    categories[cat].count++;
    categories[cat].value += s.totalCargoValue || 0;
  });
  
  return Object.entries(categories)
    .sort((a, b) => b[1].value - a[1].value)
    .slice(0, 6)
    .map(([name, data]) => ({ name, ...data }));
});

const topForwarders = computed(() => {
  const forwarders = {};
  shipments.value.forEach(s => {
    const ff = s.freightForwarder || 'Unknown';
    forwarders[ff] = (forwarders[ff] || 0) + 1;
  });
  
  return Object.entries(forwarders)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => ({ name, count }));
});

const sampleContainers = computed(() => {
  const seen = new Set();
  const containers = [];
  
  for (const s of shipments.value) {
    if (!seen.has(s.containerId)) {
      seen.add(s.containerId);
      containers.push({
        id: s.containerId,
        type: s.containerType,
      });
      if (containers.length >= 5) break;
    }
  }
  
  return containers;
});
</script>

<style scoped>
/* Slide transition */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}

.import-sidebar {
  position: fixed;
  top: 0;
  right: 0;
  width: 380px;
  height: 100vh;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.4);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, #f1c40f 0%, #e67e22 100%);
  color: #1a1a2e;
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 700;
}

.header-title i {
  font-size: 22px;
}

.close-btn {
  background: rgba(0, 0, 0, 0.15);
  border: none;
  color: #1a1a2e;
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
  background: rgba(0, 0, 0, 0.25);
}

.sidebar-section {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #4ecdc4;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-title i {
  font-size: 14px;
}

/* Route Summary */
.route-summary {
  background: rgba(255, 215, 0, 0.08);
}

.route-visual {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.route-endpoint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.port-icon {
  font-size: 28px;
}

.port-name {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.port-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
}

.route-arrow {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: #f1c40f;
}

.route-arrow i {
  font-size: 20px;
}

.transit-info {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.stat-box {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.stat-box i {
  font-size: 18px;
  color: #4ecdc4;
}

.stat-box .stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
}

.stat-box .stat-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

/* Vessel List */
.vessel-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.vessel-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.vessel-icon {
  font-size: 18px;
}

.vessel-name {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
}

/* Status Breakdown */
.status-breakdown {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.status-item {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: 10px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.status-name {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}

.status-count {
  font-size: 12px;
  font-weight: 600;
  color: #fff;
}

.status-bar {
  width: 60px;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.status-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

/* Category List */
.category-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.category-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.category-name {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}

.category-value {
  font-size: 12px;
  font-weight: 600;
  color: #4ecdc4;
}

/* Forwarder List */
.forwarder-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.forwarder-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.forwarder-name {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}

.forwarder-count {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

/* Container List */
.container-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.container-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  font-family: monospace;
}

.container-id {
  font-size: 12px;
  color: #f1c40f;
}

.container-type {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.more-items {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
  margin-top: 8px;
  font-style: italic;
}
</style>

