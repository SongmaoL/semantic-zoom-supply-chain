<template>
  <div 
    class="sunburst-overlay" 
    :class="{ visible: isVisible }"
    :style="overlayStyle"
  >
    <svg ref="svgRef" :width="size" :height="size" class="sunburst-svg">
      <!-- Sunburst will be rendered here -->
    </svg>
    <div class="warehouse-label">
      <span class="warehouse-id">{{ warehouseId }}</span>
      <span class="warehouse-name">{{ warehouseName }}</span>
    </div>
    
    <!-- Hover Tooltip -->
    <div 
      v-if="tooltipData" 
      class="sunburst-tooltip"
      :style="tooltipStyle"
    >
      <div class="tooltip-header">
        <span class="tooltip-color" :style="{ backgroundColor: tooltipData.color }"></span>
        <span class="tooltip-name">{{ tooltipData.name }}</span>
      </div>
      <div class="tooltip-stats">
        <div class="stat-row">
          <span class="stat-label">Stock:</span>
          <span class="stat-value">{{ tooltipData.value.toLocaleString() }} items</span>
        </div>
        <div class="stat-row" v-if="tooltipData.percent">
          <span class="stat-label">Share:</span>
          <span class="stat-value">{{ tooltipData.percent }}%</span>
        </div>
        <div class="stat-row" v-if="tooltipData.depth > 1">
          <span class="stat-label">Category:</span>
          <span class="stat-value">{{ tooltipData.parent }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, nextTick } from 'vue';
import * as d3 from 'd3';

const props = defineProps({
  warehouseId: { type: String, required: true },
  warehouseName: { type: String, default: '' },
  inventoryData: { type: Array, required: true },
  isVisible: { type: Boolean, default: false },
  screenX: { type: Number, default: 0 },
  screenY: { type: Number, default: 0 },
  size: { type: Number, default: 280 },
});

const svgRef = ref(null);
const tooltipData = ref(null);
const tooltipPosition = ref({ x: 0, y: 0 });

// Tooltip positioning
const tooltipStyle = computed(() => ({
  left: `${tooltipPosition.value.x}px`,
  top: `${tooltipPosition.value.y}px`,
}));

// Position the overlay centered on the warehouse screen coordinates
const overlayStyle = computed(() => ({
  left: `${props.screenX - props.size / 2}px`,
  top: `${props.screenY - props.size / 2}px`,
  width: `${props.size}px`,
  height: `${props.size}px`,
}));

// Category colors
const categoryColors = {
  'Apparel & Accessories': '#e74c3c',
  'Electronics': '#3498db',
  'Hardware': '#f39c12',
  'Business & Industrial': '#27ae60',
  'Home & Garden': '#9b59b6',
  'Health & Beauty': '#e91e63',
  'Toys & Games': '#00bcd4',
  'Unknown': '#95a5a6',
};

/**
 * Build hierarchical data for sunburst
 */
const buildHierarchy = (data) => {
  const root = { name: 'root', children: [] };
  const lvl1Map = new Map();
  
  data.forEach(item => {
    const lvl1 = item.category_lvl1 || 'Unknown';
    const lvl2 = item.category_lvl2 || 'Other';
    const lvl3 = item.category_lvl3 || 'General';
    const stock = Number.parseInt(item.current_stock, 10) || 0;
    
    if (!lvl1Map.has(lvl1)) {
      lvl1Map.set(lvl1, { name: lvl1, children: [], _lvl2Map: new Map() });
    }
    
    const lvl1Node = lvl1Map.get(lvl1);
    
    if (!lvl1Node._lvl2Map.has(lvl2)) {
      lvl1Node._lvl2Map.set(lvl2, { name: lvl2, children: [], _lvl3Map: new Map() });
    }
    
    const lvl2Node = lvl1Node._lvl2Map.get(lvl2);
    
    if (!lvl2Node._lvl3Map.has(lvl3)) {
      lvl2Node._lvl3Map.set(lvl3, { name: lvl3, value: 0 });
    }
    
    lvl2Node._lvl3Map.get(lvl3).value += stock;
  });
  
  // Convert maps to arrays
  lvl1Map.forEach((lvl1Node) => {
    lvl1Node._lvl2Map.forEach((lvl2Node) => {
      lvl2Node._lvl3Map.forEach((lvl3Node) => {
        if (lvl3Node.value > 0) {
          lvl2Node.children.push(lvl3Node);
        }
      });
      delete lvl2Node._lvl3Map;
      if (lvl2Node.children.length > 0) {
        lvl1Node.children.push(lvl2Node);
      }
    });
    delete lvl1Node._lvl2Map;
    if (lvl1Node.children.length > 0) {
      root.children.push(lvl1Node);
    }
  });
  
  return root;
};

const getColor = (d) => {
  // Find top-level category
  let node = d;
  while (node.depth > 1 && node.parent) {
    node = node.parent;
  }
  const baseColor = categoryColors[node.data.name] || '#6c757d';
  
  // Adjust brightness based on depth
  const color = d3.color(baseColor);
  if (d.depth === 2) {
    return color.brighter(0.3).toString();
  } else if (d.depth === 3) {
    return color.brighter(0.6).toString();
  }
  return baseColor;
};

/**
 * Create the sunburst chart
 */
const createChart = () => {
  if (!svgRef.value || !props.inventoryData.length) return;
  
  const svg = d3.select(svgRef.value);
  svg.selectAll('*').remove();
  
  const width = props.size;
  const height = props.size;
  const radius = Math.min(width, height) / 2;
  const innerRadius = radius * 0.25; // Hole in center for label
  
  // Build hierarchy
  const hierarchyData = buildHierarchy(props.inventoryData);
  
  const root = d3.hierarchy(hierarchyData)
    .sum(d => d.value || 0)
    .sort((a, b) => b.value - a.value);
  
  // Partition layout
  const partition = d3.partition()
    .size([2 * Math.PI, radius - innerRadius]);
  
  partition(root);
  
  // Arc generator
  const arc = d3.arc()
    .startAngle(d => d.x0)
    .endAngle(d => d.x1)
    .padAngle(0.02)
    .padRadius(innerRadius)
    .innerRadius(d => innerRadius + d.y0)
    .outerRadius(d => innerRadius + d.y1 - 2);
  
  // Create group centered in SVG
  const g = svg.append('g')
    .attr('transform', `translate(${width / 2},${height / 2})`);
  
  // Add center circle (background)
  g.append('circle')
    .attr('r', innerRadius - 5)
    .attr('fill', 'rgba(20, 20, 35, 0.9)')
    .attr('stroke', 'rgba(255, 255, 255, 0.2)')
    .attr('stroke-width', 2);
  
  // Calculate total for percentages
  const totalValue = root.value;
  
  // Add arcs (skip root node)
  g.selectAll('path')
    .data(root.descendants().filter(d => d.depth > 0))
    .join('path')
    .attr('d', arc)
    .attr('fill', d => getColor(d))
    .attr('stroke', 'rgba(20, 20, 35, 0.8)')
    .attr('stroke-width', 1)
    .style('opacity', 0.9)
    .style('cursor', 'pointer')
    .style('transition', 'opacity 0.2s, transform 0.2s')
    .on('mouseenter', function(event, d) {
      // Highlight this segment
      d3.select(this)
        .style('opacity', 1)
        .attr('stroke', '#fff')
        .attr('stroke-width', 2);
      
      // Get parent category name
      let parentName = '';
      if (d.depth > 1 && d.parent) {
        parentName = d.parent.data.name;
      }
      
      // Calculate percentage
      const percent = totalValue > 0 ? Math.round((d.value / totalValue) * 100) : 0;
      
      // Update tooltip
      tooltipData.value = {
        name: d.data.name,
        value: d.value,
        percent: percent,
        depth: d.depth,
        parent: parentName,
        color: getColor(d),
      };
      
      // Position tooltip relative to mouse
      const rect = svgRef.value.getBoundingClientRect();
      tooltipPosition.value = {
        x: event.clientX - rect.left + 15,
        y: event.clientY - rect.top - 10,
      };
    })
    .on('mousemove', function(event) {
      // Update tooltip position on move
      const rect = svgRef.value.getBoundingClientRect();
      tooltipPosition.value = {
        x: event.clientX - rect.left + 15,
        y: event.clientY - rect.top - 10,
      };
    })
    .on('mouseleave', function() {
      // Reset segment style
      d3.select(this)
        .style('opacity', 0.9)
        .attr('stroke', 'rgba(20, 20, 35, 0.8)')
        .attr('stroke-width', 1);
      
      // Hide tooltip
      tooltipData.value = null;
    });
};

// Watch for visibility and data changes
watch([() => props.isVisible, () => props.inventoryData], async ([visible]) => {
  if (visible && props.inventoryData.length > 0) {
    await nextTick();
    createChart();
  }
}, { immediate: true });

// Update position reactively
watch([() => props.screenX, () => props.screenY], () => {
  // Position updates automatically via computed style
});
</script>

<style scoped>
.sunburst-overlay {
  position: absolute;
  pointer-events: auto;
  z-index: 15;
  opacity: 0;
  transform: scale(0.7);
  transition: opacity 0.4s ease-out, transform 0.4s ease-out;
}

.sunburst-overlay.visible {
  opacity: 1;
  transform: scale(1);
}

.sunburst-svg {
  filter: drop-shadow(0 4px 20px rgba(0, 0, 0, 0.5));
}

.warehouse-label {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  pointer-events: none;
}

.warehouse-id {
  display: block;
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}

.warehouse-name {
  display: block;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

/* Tooltip styles */
.sunburst-tooltip {
  position: absolute;
  background: rgba(20, 20, 35, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  padding: 10px 14px;
  min-width: 160px;
  max-width: 220px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  pointer-events: none;
  z-index: 20;
  backdrop-filter: blur(8px);
}

.tooltip-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.tooltip-color {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
}

.tooltip-name {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tooltip-stats {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.stat-label {
  color: rgba(255, 255, 255, 0.5);
}

.stat-value {
  color: #4ecdc4;
  font-weight: 500;
}
</style>
