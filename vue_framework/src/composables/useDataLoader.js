/**
 * Composable for loading and parsing supply chain CSV data
 * Shared between ArcMap and SemanticZoomMap components
 */
import { ref, shallowRef, computed } from 'vue';

/**
 * The 4 warehouse locations identified from the delivery data
 * All shipments are mapped to the nearest warehouse for aggregation
 */
export const WAREHOUSE_LOCATIONS = [
  { id: 'CA', name: 'California Warehouse', coords: [-117.8647, 34.0206], state: 'CA' },
  { id: 'NJ', name: 'New Jersey Warehouse', coords: [-74.1724, 40.7357], state: 'NJ' },
  { id: 'TX', name: 'Texas Warehouse', coords: [-95.5569, 29.9190], state: 'TX' },
  { id: 'IL', name: 'Illinois Warehouse', coords: [-88.0423, 41.5894], state: 'IL' },
];

/**
 * Find the nearest warehouse to a given coordinate
 */
function findNearestWarehouse(lon, lat) {
  let nearest = WAREHOUSE_LOCATIONS[0];
  let minDist = Infinity;
  
  for (const wh of WAREHOUSE_LOCATIONS) {
    const dist = Math.sqrt(
      Math.pow(lon - wh.coords[0], 2) + 
      Math.pow(lat - wh.coords[1], 2)
    );
    if (dist < minDist) {
      minDist = dist;
      nearest = wh;
    }
  }
  
  return nearest;
}

/**
 * US State centroid coordinates for aggregated flows
 * Format: [longitude, latitude]
 */
export const STATE_CENTROIDS = {
  'AL': [-86.9023, 32.3182], 'AK': [-153.4937, 64.2008], 'AZ': [-111.0937, 34.0489],
  'AR': [-92.3731, 34.9697], 'CA': [-119.4179, 36.7783], 'CO': [-105.3111, 39.0598],
  'CT': [-72.7554, 41.6032], 'DE': [-75.5277, 38.9108], 'FL': [-81.5158, 27.6648],
  'GA': [-83.6431, 32.1656], 'HI': [-155.5828, 19.8968], 'ID': [-114.4788, 44.0682],
  'IL': [-89.3985, 40.6331], 'IN': [-86.1349, 40.2672], 'IA': [-93.2140, 41.8780],
  'KS': [-98.4842, 39.0119], 'KY': [-84.2700, 37.8393], 'LA': [-91.9623, 30.9843],
  'ME': [-69.4455, 45.2538], 'MD': [-76.6413, 39.0458], 'MA': [-71.3824, 42.4072],
  'MI': [-84.5555, 44.3148], 'MN': [-94.6859, 46.7296], 'MS': [-89.3985, 32.3547],
  'MO': [-91.8318, 37.9643], 'MT': [-110.3626, 46.8797], 'NE': [-99.9018, 41.4925],
  'NV': [-116.4194, 38.8026], 'NH': [-71.5724, 43.1939], 'NJ': [-74.4057, 40.0583],
  'NM': [-105.8701, 34.5199], 'NY': [-75.4999, 43.2994], 'NC': [-79.0193, 35.7596],
  'ND': [-101.0020, 47.5515], 'OH': [-82.9071, 40.4173], 'OK': [-97.0929, 35.0078],
  'OR': [-120.5542, 43.8041], 'PA': [-77.1945, 41.2033], 'RI': [-71.4774, 41.5801],
  'SC': [-81.1637, 33.8361], 'SD': [-99.9018, 43.9695], 'TN': [-86.5804, 35.5175],
  'TX': [-99.9018, 31.9686], 'UT': [-111.0937, 39.3210], 'VT': [-72.5778, 44.5588],
  'VA': [-78.6569, 37.4316], 'WA': [-120.7401, 47.7511], 'WV': [-80.4549, 38.5976],
  'WI': [-89.6165, 43.7844], 'WY': [-107.2903, 43.0760], 'DC': [-77.0369, 38.9072],
  // Handle full state names and variations
  'ALABAMA': [-86.9023, 32.3182], 'ALASKA': [-153.4937, 64.2008], 'ARIZONA': [-111.0937, 34.0489],
  'ARKANSAS': [-92.3731, 34.9697], 'CALIFORNIA': [-119.4179, 36.7783], 'COLORADO': [-105.3111, 39.0598],
  'CONNECTICUT': [-72.7554, 41.6032], 'DELAWARE': [-75.5277, 38.9108], 'FLORIDA': [-81.5158, 27.6648],
  'GEORGIA': [-83.6431, 32.1656], 'HAWAII': [-155.5828, 19.8968], 'IDAHO': [-114.4788, 44.0682],
  'ILLINOIS': [-89.3985, 40.6331], 'INDIANA': [-86.1349, 40.2672], 'IOWA': [-93.2140, 41.8780],
  'KANSAS': [-98.4842, 39.0119], 'KENTUCKY': [-84.2700, 37.8393], 'LOUISIANA': [-91.9623, 30.9843],
  'MAINE': [-69.4455, 45.2538], 'MARYLAND': [-76.6413, 39.0458], 'MASSACHUSETTS': [-71.3824, 42.4072],
  'MICHIGAN': [-84.5555, 44.3148], 'MINNESOTA': [-94.6859, 46.7296], 'MISSISSIPPI': [-89.3985, 32.3547],
  'MISSOURI': [-91.8318, 37.9643], 'MONTANA': [-110.3626, 46.8797], 'NEBRASKA': [-99.9018, 41.4925],
  'NEVADA': [-116.4194, 38.8026], 'NEW HAMPSHIRE': [-71.5724, 43.1939], 'NEW JERSEY': [-74.4057, 40.0583],
  'NEW MEXICO': [-105.8701, 34.5199], 'NEW YORK': [-75.4999, 43.2994], 'NORTH CAROLINA': [-79.0193, 35.7596],
  'NORTH DAKOTA': [-101.0020, 47.5515], 'OHIO': [-82.9071, 40.4173], 'OKLAHOMA': [-97.0929, 35.0078],
  'OREGON': [-120.5542, 43.8041], 'PENNSYLVANIA': [-77.1945, 41.2033], 'RHODE ISLAND': [-71.4774, 41.5801],
  'SOUTH CAROLINA': [-81.1637, 33.8361], 'SOUTH DAKOTA': [-99.9018, 43.9695], 'TENNESSEE': [-86.5804, 35.5175],
  'TEXAS': [-99.9018, 31.9686], 'UTAH': [-111.0937, 39.3210], 'VERMONT': [-72.5778, 44.5588],
  'VIRGINIA': [-78.6569, 37.4316], 'WASHINGTON': [-120.7401, 47.7511], 'WEST VIRGINIA': [-80.4549, 38.5976],
  'WISCONSIN': [-89.6165, 43.7844], 'WYOMING': [-107.2903, 43.0760],
};

/**
 * Normalize state code to 2-letter format
 */
export function normalizeStateCode(state) {
  if (!state) return null;
  const upper = state.toUpperCase().trim();
  // If it's already a 2-letter code
  if (upper.length === 2 && STATE_CENTROIDS[upper]) {
    return upper;
  }
  // Try to find full state name
  if (STATE_CENTROIDS[upper]) {
    // Map full names to codes
    const stateNameToCode = {
      'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR', 'CALIFORNIA': 'CA',
      'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE', 'FLORIDA': 'FL', 'GEORGIA': 'GA',
      'HAWAII': 'HI', 'IDAHO': 'ID', 'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA',
      'KANSAS': 'KS', 'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
      'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS', 'MISSOURI': 'MO',
      'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ',
      'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH',
      'OKLAHOMA': 'OK', 'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
      'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT', 'VERMONT': 'VT',
      'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV', 'WISCONSIN': 'WI', 'WYOMING': 'WY',
    };
    return stateNameToCode[upper] || upper;
  }
  return upper.length === 2 ? upper : null;
}

/**
 * Simple CSV parser that handles quoted fields
 * @param {string} line - CSV line to parse
 * @returns {string[]} Array of field values
 */
export function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Haversine distance calculation (great-circle distance)
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
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
 * Format date for display (MM/DD/YY -> Month Day, Year)
 * @param {string} dateStr - Date string in MM/DD/YY format
 * @returns {string} Formatted date string
 */
export function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  const [month, day, year] = dateStr.split('/');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[parseInt(month) - 1]} ${parseInt(day)}, 20${year}`;
}

/**
 * Composable for loading demand data
 * Uses shallowRef for large arrays to improve performance
 */
export function useDataLoader() {
  const isLoading = ref(true);
  const loadError = ref(null);
  const selectedDate = ref('all');
  const availableDates = ref([]);
  
  // Use shallowRef for large arrays - prevents deep reactivity overhead
  const rawArcsData = shallowRef([]);           // Original zip-to-zip arcs (for details sidebar)
  const allArcsData = shallowRef([]);           // Filtered arcs
  const aggregatedArcs = shallowRef([]);        // Warehouse-to-State aggregated arcs (for bundling)
  const destinationPoints = shallowRef([]);
  
  // Computed properties
  const totalArcs = computed(() => allArcsData.value.length);
  const totalAggregatedArcs = computed(() => aggregatedArcs.value.length);
  const totalVolume = computed(() => 
    allArcsData.value.reduce((sum, arc) => sum + (arc.volume || 1), 0)
  );
  const totalPoints = computed(() => destinationPoints.value.length);
  
  /**
   * Filter data by selected date
   */
  const filterByDate = () => {
    if (selectedDate.value === 'all') {
      allArcsData.value = [...rawArcsData.value];
    } else {
      allArcsData.value = rawArcsData.value.filter(arc => arc.date === selectedDate.value);
    }
    console.log(`Filtered to ${allArcsData.value.length} arcs for date: ${selectedDate.value}`);
  };
  
  /**
   * Load and parse demand data from CSV
   * @param {Object} options - Loading options
   * @param {boolean} options.includeDestinationPoints - Whether to extract destination points for hexagon layer
   * @returns {Promise<void>}
   */
  const loadDemandData = async (options = {}) => {
    const { includeDestinationPoints = false } = options;
    
    try {
      isLoading.value = true;
      loadError.value = null;
      
      const response = await fetch(`${import.meta.env.BASE_URL}demand_data_geocoded.csv`);
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`);
      }
      
      let csvText = await response.text();
      
      // Remove BOM if present
      if (csvText.charCodeAt(0) === 0xFEFF) {
        csvText = csvText.slice(1);
      }
      
      const lines = csvText.split('\n');
      const headers = parseCSVLine(lines[0]);
      
      // Find column indices once
      const columnIndices = {
        createdTime: headers.indexOf('created_time'),
        shipperLat: headers.indexOf('shipper_lat'),
        shipperLon: headers.indexOf('shipper_lon'),
        shiptoLat: headers.indexOf('shipto_lat'),
        shiptoLon: headers.indexOf('shipto_lon'),
        volume: headers.indexOf('quantity'),
        category: headers.indexOf('category_lvl1'),
        categoryLvl2: headers.indexOf('category_lvl2'),
        categoryLvl3: headers.indexOf('category_lvl3'),
        shipperPostal: headers.indexOf('shipper_postal_code'),
        shiptoPostal: headers.indexOf('shipto_postal_code'),
        shipperState: headers.indexOf('shipper_province_code'),
        shiptoState: headers.indexOf('shipto_province_code'),
        shipperName: headers.indexOf('shipper_name'),
        cargoName: headers.indexOf('cargo_name_en'),
        sku: headers.indexOf('sku'),
        usdValue: headers.indexOf('usd_value_ttl'),
      };
      
      // Pre-allocate arrays for better performance
      const arcs = [];
      const points = includeDestinationPoints ? [] : null;
      const dateSet = new Set();
      
      // Aggregation map: warehouseKey -> stateCode -> { aggregated data }
      const aggregationMap = new Map();
      
      // Process data in batches for better performance
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        
        const cols = parseCSVLine(line);
        
        // Parse date
        const createdTime = cols[columnIndices.createdTime] || '';
        const datePart = createdTime.split(' ')[0];
        if (datePart) {
          dateSet.add(datePart);
        }
        
        // Parse coordinates
        const shipperLat = parseFloat(cols[columnIndices.shipperLat]);
        const shipperLon = parseFloat(cols[columnIndices.shipperLon]);
        const shiptoLat = parseFloat(cols[columnIndices.shiptoLat]);
        const shiptoLon = parseFloat(cols[columnIndices.shiptoLon]);
        
        // Skip invalid coordinates
        if (isNaN(shipperLat) || isNaN(shipperLon) || isNaN(shiptoLat) || isNaN(shiptoLon)) {
          continue;
        }
        
        const volume = parseFloat(cols[columnIndices.volume]) || 1;
        const category = cols[columnIndices.category] || 'Unknown';
        
        // deck.gl uses [lon, lat] format
        const sourceCoords = [shipperLon, shipperLat];
        const targetCoords = [shiptoLon, shiptoLat];
        
        // Calculate distance
        const distanceKm = haversineDistance(shipperLat, shipperLon, shiptoLat, shiptoLon);
        
        const shipperState = cols[columnIndices.shipperState] || '';
        const shiptoState = cols[columnIndices.shiptoState] || '';
        const usdValue = parseFloat(cols[columnIndices.usdValue]) || 0;
        
        arcs.push({
          source: sourceCoords,
          target: targetCoords,
          volume,
          distance: distanceKm * 0.621371, // Convert to miles
          category,
          categoryLvl2: cols[columnIndices.categoryLvl2] || '',
          categoryLvl3: cols[columnIndices.categoryLvl3] || '',
          shipperPostal: cols[columnIndices.shipperPostal],
          shiptoPostal: cols[columnIndices.shiptoPostal],
          shipperState,
          shiptoState,
          shipperName: cols[columnIndices.shipperName] || 'Unknown Warehouse',
          cargoName: cols[columnIndices.cargoName] || 'Unknown Product',
          sku: cols[columnIndices.sku] || '',
          usdValue,
          date: datePart,
        });
        
        // Aggregate by warehouse -> state
        const normalizedDestState = normalizeStateCode(shiptoState);
        if (normalizedDestState && STATE_CENTROIDS[normalizedDestState]) {
          // Find the nearest warehouse to this shipper
          const warehouse = findNearestWarehouse(shipperLon, shipperLat);
          const routeKey = `${warehouse.id}->${normalizedDestState}`;
          
          if (!aggregationMap.has(routeKey)) {
            aggregationMap.set(routeKey, {
              source: warehouse.coords, // Use warehouse coords, not shipper coords
              target: STATE_CENTROIDS[normalizedDestState],
              warehouseId: warehouse.id,
              warehouseName: warehouse.name,
              shipperState: warehouse.state, // Use warehouse state
              destState: normalizedDestState,
              volume: 0,
              orderCount: 0,
              totalValue: 0,
              categories: {},
              orders: [], // Store references to individual orders
            });
          }
          
          const agg = aggregationMap.get(routeKey);
          agg.volume += volume;
          agg.orderCount++;
          agg.totalValue += usdValue;
          agg.categories[category] = (agg.categories[category] || 0) + 1;
          // Store reference to this order (limited to save memory)
          if (agg.orders.length < 100) {
            agg.orders.push(arcs.length - 1); // Index of the arc
          }
        }
        
        // Add destination point for hexagon layer
        if (points) {
          points.push({
            position: targetCoords,
            weight: volume,
            category,
            origin: cols[columnIndices.shipperPostal] || 'Unknown',
          });
        }
      }
      
      // Sort dates chronologically
      availableDates.value = Array.from(dateSet).sort((a, b) => {
        const [am, ad, ay] = a.split('/').map(Number);
        const [bm, bd, by] = b.split('/').map(Number);
        return (ay - by) || (am - bm) || (ad - bd);
      });
      
      // Convert aggregation map to array
      const aggArcs = Array.from(aggregationMap.values()).map((agg, idx) => {
        // Find dominant category
        let dominantCategory = 'Unknown';
        let maxCount = 0;
        Object.entries(agg.categories).forEach(([cat, count]) => {
          if (count > maxCount) {
            maxCount = count;
            dominantCategory = cat;
          }
        });
        
        return {
          id: `agg-${idx}`,
          source: agg.source,
          target: agg.target,
          warehouseId: agg.warehouseId,
          warehouseName: agg.warehouseName,
          shipperState: agg.shipperState,
          destState: agg.destState,
          volume: agg.volume,
          orderCount: agg.orderCount,
          totalValue: agg.totalValue,
          category: dominantCategory,
          categories: agg.categories,
          orderIndices: agg.orders, // Indices to look up original orders
        };
      });
      
      // Update refs (use direct assignment for shallowRef)
      rawArcsData.value = arcs;
      allArcsData.value = arcs;
      aggregatedArcs.value = aggArcs;
      
      if (points) {
        destinationPoints.value = points;
      }
      
      console.log(`Loaded ${arcs.length} individual arcs, aggregated to ${aggArcs.length} warehouse→state flows`);
      
    } catch (error) {
      console.error('Error loading demand data:', error);
      loadError.value = error.message;
    } finally {
      isLoading.value = false;
    }
  };
  
  /**
   * Get original order details for an aggregated arc
   */
  const getOrdersForAggregatedArc = (aggArc) => {
    if (!aggArc || !aggArc.orderIndices) return [];
    return aggArc.orderIndices.map(idx => allArcsData.value[idx]).filter(Boolean);
  };
  
  return {
    // State
    isLoading,
    loadError,
    selectedDate,
    availableDates,
    rawArcsData,
    allArcsData,
    aggregatedArcs,      // NEW: Warehouse → State aggregated flows
    destinationPoints,
    
    // Computed
    totalArcs,
    totalAggregatedArcs, // NEW: Count of aggregated arcs
    totalVolume,
    totalPoints,
    
    // Methods
    loadDemandData,
    filterByDate,
    formatDateDisplay,
    getOrdersForAggregatedArc, // NEW: Get original orders for an aggregated arc
  };
}

export default useDataLoader;

