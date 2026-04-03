/**
 * Composable for loading and managing inventory data
 * Provides warehouse-level inventory for sunburst visualization
 */
import { ref, shallowRef, computed } from 'vue';
import { parseCSVLine } from './useDataLoader';

/**
 * Warehouse locations with coordinates
 * Derived from actual delivery data - 4 fulfillment centers
 */
export const WAREHOUSE_LOCATIONS = [
  { id: 'WH-CA', name: 'California', coords: [-117.8647, 34.0206], region: 'West', orders: 27071 },
  { id: 'WH-NJ', name: 'New Jersey', coords: [-74.1724, 40.7357], region: 'Northeast', orders: 17128 },
  { id: 'WH-TX', name: 'Texas', coords: [-95.5569, 29.9190], region: 'South', orders: 4300 },
  { id: 'WH-IL', name: 'Illinois', coords: [-88.0423, 41.5894], region: 'Midwest', orders: 2872 },
];

/**
 * Get warehouse ID from location string (e.g., "WH-CA" or legacy "WH-7-C87" -> "WH-CA")
 */
export function getWarehouseBaseId(locationStr) {
  if (!locationStr) return null;
  // New format: WH-CA, WH-NJ, WH-TX, WH-IL
  if (/^WH-(CA|NJ|TX|IL)$/.test(locationStr)) {
    return locationStr;
  }
  // Return as-is if it matches warehouse pattern
  const match = locationStr.match(/^(WH-[A-Z]{2})/);
  return match ? match[1] : locationStr;
}

/**
 * Get warehouse info by ID
 */
export function getWarehouseInfo(warehouseId) {
  return WAREHOUSE_LOCATIONS.find(w => w.id === warehouseId) || null;
}

/**
 * Calculate distance between two points in km
 */
function haversineDistance(lon1, lat1, lon2, lat2) {
  const R = 6371;
  const toRad = (deg) => deg * Math.PI / 180;
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Composable for inventory data management
 */
export function useInventoryLoader() {
  const isLoading = ref(false);
  const loadError = ref(null);
  
  // All inventory data
  const allInventory = shallowRef([]);
  
  // Inventory grouped by warehouse
  const inventoryByWarehouse = ref(new Map());
  
  // Currently selected/hovered warehouse
  const activeWarehouse = ref(null);
  
  // Computed stats
  const totalProducts = computed(() => allInventory.value.length);
  const totalStock = computed(() => 
    allInventory.value.reduce((sum, item) => sum + (parseInt(item.current_stock) || 0), 0)
  );
  
  /**
   * Load inventory data from CSV
   */
  const loadInventoryData = async () => {
    try {
      isLoading.value = true;
      loadError.value = null;
      
      // Try multiple possible paths (with base URL for GitHub Pages)
      const baseUrl = import.meta.env.BASE_URL;
      const paths = [
        `${baseUrl}data/inventory_stock_levels.csv`,
        `${baseUrl}inventory_stock_levels.csv`,
      ];
      
      let csvText = null;
      for (const path of paths) {
        try {
          const response = await fetch(path);
          if (response.ok) {
            csvText = await response.text();
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      if (!csvText) {
        throw new Error('Could not load inventory data');
      }
      
      // Remove BOM if present
      if (csvText.charCodeAt(0) === 0xFEFF) {
        csvText = csvText.slice(1);
      }
      
      const lines = csvText.split('\n');
      const headers = parseCSVLine(lines[0]);
      
      // Find column indices - support both old and new format
      const colIdx = {
        warehouseId: headers.indexOf('warehouse_id'),
        warehouseName: headers.indexOf('warehouse_name'),
        warehouseLocation: headers.indexOf('warehouse_location'),
        categoryLvl1: headers.indexOf('category_lvl1'),
        categoryLvl2: headers.indexOf('category_lvl2'),
        categoryLvl3: headers.indexOf('category_lvl3'),
        cargoName: headers.indexOf('cargo_name_en'),
        currentStock: headers.indexOf('current_stock'),
        availableStock: headers.indexOf('available_stock'),
        unitCost: headers.indexOf('unit_cost_usd'),
        sku: headers.indexOf('sku'),
      };
      
      const inventory = [];
      const warehouseMap = new Map();
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        
        const cols = parseCSVLine(line);
        
        // Get warehouse ID - prefer direct warehouse_id, fallback to parsing location
        let warehouseId = cols[colIdx.warehouseId] || '';
        if (!warehouseId && colIdx.warehouseLocation >= 0) {
          warehouseId = getWarehouseBaseId(cols[colIdx.warehouseLocation] || '');
        }
        
        if (!warehouseId) continue;
        
        const item = {
          warehouse_id: warehouseId,
          warehouse_name: cols[colIdx.warehouseName] || '',
          category_lvl1: cols[colIdx.categoryLvl1] || 'Unknown',
          category_lvl2: cols[colIdx.categoryLvl2] || 'Other',
          category_lvl3: cols[colIdx.categoryLvl3] || 'General',
          cargo_name: cols[colIdx.cargoName] || '',
          current_stock: parseInt(cols[colIdx.currentStock]) || 0,
          available_stock: parseInt(cols[colIdx.availableStock]) || 0,
          unit_cost: parseFloat(cols[colIdx.unitCost]) || 0,
          sku: cols[colIdx.sku] || '',
        };
        
        inventory.push(item);
        
        // Group by warehouse
        if (!warehouseMap.has(warehouseId)) {
          warehouseMap.set(warehouseId, []);
        }
        warehouseMap.get(warehouseId).push(item);
      }
      
      allInventory.value = inventory;
      inventoryByWarehouse.value = warehouseMap;
      
      console.log(`Loaded ${inventory.length} inventory items across ${warehouseMap.size} warehouses`);
      
    } catch (error) {
      console.error('Error loading inventory:', error);
      loadError.value = error.message;
    } finally {
      isLoading.value = false;
    }
  };
  
  /**
   * Get inventory for a specific warehouse
   */
  const getWarehouseInventory = (warehouseId) => {
    return inventoryByWarehouse.value.get(warehouseId) || [];
  };
  
  /**
   * Find nearest warehouse to a map point
   * @param {number} lon - Longitude
   * @param {number} lat - Latitude
   * @param {number} maxDistanceKm - Maximum distance in km (default 100)
   * @returns {Object|null} Warehouse info or null if none nearby
   */
  const findNearestWarehouse = (lon, lat, maxDistanceKm = 100) => {
    let nearest = null;
    let minDist = Infinity;
    
    for (const wh of WAREHOUSE_LOCATIONS) {
      const dist = haversineDistance(lon, lat, wh.coords[0], wh.coords[1]);
      if (dist < minDist && dist < maxDistanceKm) {
        minDist = dist;
        nearest = { ...wh, distance: dist };
      }
    }
    
    return nearest;
  };
  
  /**
   * Check if a zoom level and position should show warehouse detail
   * @param {number} zoom - Current map zoom
   * @param {number} lon - Center longitude
   * @param {number} lat - Center latitude
   * @returns {Object|null} Warehouse to show or null
   */
  const shouldShowWarehouseDetail = (zoom, lon, lat) => {
    // Only show at high zoom levels
    if (zoom < 10) return null;
    
    // Find warehouse within range
    // At zoom 10: ~100km, at zoom 12: ~50km, at zoom 14+: ~25km
    const maxDist = Math.max(25, 200 / (zoom - 8));
    return findNearestWarehouse(lon, lat, maxDist);
  };
  
  return {
    // State
    isLoading,
    loadError,
    allInventory,
    inventoryByWarehouse,
    activeWarehouse,
    
    // Computed
    totalProducts,
    totalStock,
    
    // Methods
    loadInventoryData,
    getWarehouseInventory,
    findNearestWarehouse,
    shouldShowWarehouseDetail,
    
    // Constants
    WAREHOUSE_LOCATIONS,
  };
}

export default useInventoryLoader;

