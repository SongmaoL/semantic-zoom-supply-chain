/**
 * Composable for loading and managing inbound cargo/container shipment data
 * Provides port-level import data for visualization
 */
import { ref, shallowRef, computed } from 'vue';
import { parseCSVLine } from './useDataLoader';

/**
 * Port coordinates for visualization
 * Major US ports receiving containers from China
 */
export const PORT_LOCATIONS = {
  'Los Angeles': { coords: [-118.2437, 33.7283], country: 'USA', region: 'West Coast' },
  'Long Beach': { coords: [-118.1937, 33.7701], country: 'USA', region: 'West Coast' },
  'Savannah': { coords: [-81.0912, 32.0809], country: 'USA', region: 'East Coast' },
  'New York': { coords: [-74.0445, 40.6892], country: 'USA', region: 'East Coast' },
  'Houston': { coords: [-95.2698, 29.7589], country: 'USA', region: 'Gulf Coast' },
  'Seattle': { coords: [-122.3321, 47.6062], country: 'USA', region: 'West Coast' },
  // Origin ports in China
  'Xiamen': { coords: [118.0894, 24.4798], country: 'China', region: 'East China' },
  'Shanghai': { coords: [121.4737, 31.2304], country: 'China', region: 'East China' },
  'Ningbo': { coords: [121.5440, 29.8683], country: 'China', region: 'East China' },
  'Shenzhen': { coords: [114.0579, 22.5431], country: 'China', region: 'South China' },
  'Guangzhou': { coords: [113.2644, 23.1291], country: 'China', region: 'South China' },
};

/**
 * Get port coordinates by name
 */
export function getPortCoords(portName) {
  return PORT_LOCATIONS[portName]?.coords || null;
}

/**
 * Shipment status colors
 */
export const STATUS_COLORS = {
  'In Transit': [52, 152, 219],      // Blue
  'Customs Clearance': [241, 196, 15], // Yellow
  'Delivered': [39, 174, 96],         // Green
  'Pending': [149, 165, 166],         // Gray
  'Delayed': [231, 76, 60],           // Red
};

/**
 * Composable for inbound cargo data management
 */
export function useInboundLoader() {
  const isLoading = ref(false);
  const loadError = ref(null);
  
  // All shipment data
  const allShipments = shallowRef([]);
  
  // Grouped data
  const shipmentsByPort = ref(new Map());
  const shipmentsByContainer = ref(new Map());
  const shipmentsByStatus = ref(new Map());
  
  // Computed stats
  const totalShipments = computed(() => allShipments.value.length);
  const totalContainers = computed(() => {
    const containers = new Set(allShipments.value.map(s => s.containerId));
    return containers.size;
  });
  const totalCargoValue = computed(() =>
    allShipments.value.reduce((sum, s) => sum + (s.totalCargoValue || 0), 0)
  );
  const uniqueVessels = computed(() => {
    const vessels = new Set(allShipments.value.map(s => s.vesselName));
    return vessels.size;
  });
  
  /**
   * Load inbound cargo data from CSV
   */
  const loadInboundData = async () => {
    try {
      isLoading.value = true;
      loadError.value = null;
      
      const response = await fetch(`${import.meta.env.BASE_URL}data/inbound_cargo_shipments.csv`);
      if (!response.ok) {
        throw new Error(`Failed to fetch inbound data: ${response.status}`);
      }
      
      let csvText = await response.text();
      
      // Remove BOM if present
      if (csvText.charCodeAt(0) === 0xFEFF) {
        csvText = csvText.slice(1);
      }
      
      const lines = csvText.split('\n');
      const headers = parseCSVLine(lines[0]);
      
      // Find column indices
      const colIdx = {
        shipmentId: headers.indexOf('shipment_id'),
        containerId: headers.indexOf('container_id'),
        containerType: headers.indexOf('container_type'),
        vesselName: headers.indexOf('vessel_name'),
        vesselImo: headers.indexOf('vessel_imo'),
        voyageNumber: headers.indexOf('voyage_number'),
        bookingNumber: headers.indexOf('booking_number'),
        originPort: headers.indexOf('origin_port'),
        originCountry: headers.indexOf('origin_country'),
        destinationPort: headers.indexOf('destination_port'),
        destinationCountry: headers.indexOf('destination_country'),
        departureDate: headers.indexOf('departure_date'),
        expectedArrival: headers.indexOf('expected_arrival_date'),
        actualArrival: headers.indexOf('actual_arrival_date'),
        transitDays: headers.indexOf('transit_days'),
        status: headers.indexOf('shipment_status'),
        wmsCargoId: headers.indexOf('wms_cargo_id'),
        cargoName: headers.indexOf('cargo_name'),
        skuWms: headers.indexOf('sku_wms'),
        quantity: headers.indexOf('quantity'),
        packageType: headers.indexOf('package_type'),
        totalWeightKg: headers.indexOf('total_weight_kg'),
        totalVolumeCbm: headers.indexOf('total_volume_cbm'),
        categoryLvl1: headers.indexOf('category_lvl1'),
        freightForwarder: headers.indexOf('freight_forwarder'),
        customsBroker: headers.indexOf('customs_broker'),
        shippingCost: headers.indexOf('shipping_cost_usd'),
        insuranceCost: headers.indexOf('insurance_cost_usd'),
        totalCargoValue: headers.indexOf('total_cargo_value_usd'),
      };
      
      const shipments = [];
      const portMap = new Map();
      const containerMap = new Map();
      const statusMap = new Map();
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        
        const cols = parseCSVLine(line);
        
        const originPort = cols[colIdx.originPort] || '';
        const destinationPort = cols[colIdx.destinationPort] || '';
        const status = cols[colIdx.status] || 'Unknown';
        const containerId = cols[colIdx.containerId] || '';
        
        const shipment = {
          shipmentId: cols[colIdx.shipmentId] || '',
          containerId,
          containerType: cols[colIdx.containerType] || '',
          vesselName: cols[colIdx.vesselName] || '',
          vesselImo: cols[colIdx.vesselImo] || '',
          voyageNumber: cols[colIdx.voyageNumber] || '',
          bookingNumber: cols[colIdx.bookingNumber] || '',
          originPort,
          originCountry: cols[colIdx.originCountry] || '',
          destinationPort,
          destinationCountry: cols[colIdx.destinationCountry] || '',
          departureDate: cols[colIdx.departureDate] || '',
          expectedArrival: cols[colIdx.expectedArrival] || '',
          actualArrival: cols[colIdx.actualArrival] || '',
          transitDays: parseInt(cols[colIdx.transitDays]) || 0,
          status,
          wmsCargoId: cols[colIdx.wmsCargoId] || '',
          cargoName: cols[colIdx.cargoName] || '',
          skuWms: cols[colIdx.skuWms] || '',
          quantity: parseInt(cols[colIdx.quantity]) || 0,
          packageType: cols[colIdx.packageType] || '',
          totalWeightKg: parseFloat(cols[colIdx.totalWeightKg]) || 0,
          totalVolumeCbm: parseFloat(cols[colIdx.totalVolumeCbm]) || 0,
          categoryLvl1: cols[colIdx.categoryLvl1] || 'Unknown',
          freightForwarder: cols[colIdx.freightForwarder] || '',
          customsBroker: cols[colIdx.customsBroker] || '',
          shippingCost: parseFloat(cols[colIdx.shippingCost]) || 0,
          insuranceCost: parseFloat(cols[colIdx.insuranceCost]) || 0,
          totalCargoValue: parseFloat(cols[colIdx.totalCargoValue]) || 0,
          // Add coordinates for visualization
          originCoords: getPortCoords(originPort),
          destinationCoords: getPortCoords(destinationPort),
        };
        
        shipments.push(shipment);
        
        // Group by destination port
        if (!portMap.has(destinationPort)) {
          portMap.set(destinationPort, []);
        }
        portMap.get(destinationPort).push(shipment);
        
        // Group by container
        if (!containerMap.has(containerId)) {
          containerMap.set(containerId, []);
        }
        containerMap.get(containerId).push(shipment);
        
        // Group by status
        if (!statusMap.has(status)) {
          statusMap.set(status, []);
        }
        statusMap.get(status).push(shipment);
      }
      
      allShipments.value = shipments;
      shipmentsByPort.value = portMap;
      shipmentsByContainer.value = containerMap;
      shipmentsByStatus.value = statusMap;
      
      console.log(`Loaded ${shipments.length} inbound shipments across ${containerMap.size} containers`);
      
    } catch (error) {
      console.error('Error loading inbound data:', error);
      loadError.value = error.message;
    } finally {
      isLoading.value = false;
    }
  };
  
  /**
   * Get shipments for a specific port
   */
  const getShipmentsByPort = (portName) => {
    return shipmentsByPort.value.get(portName) || [];
  };
  
  /**
   * Get shipments by status
   */
  const getShipmentsByStatus = (status) => {
    return shipmentsByStatus.value.get(status) || [];
  };
  
  /**
   * Create arc data for port-to-port visualization
   * Aggregates shipments by route
   */
  const getPortArcs = computed(() => {
    const routeMap = new Map();
    
    allShipments.value.forEach(shipment => {
      if (!shipment.originCoords || !shipment.destinationCoords) return;
      
      const routeKey = `${shipment.originPort}-${shipment.destinationPort}`;
      
      if (!routeMap.has(routeKey)) {
        routeMap.set(routeKey, {
          source: shipment.originCoords,
          target: shipment.destinationCoords,
          originPort: shipment.originPort,
          destinationPort: shipment.destinationPort,
          shipments: [],
          totalQuantity: 0,
          totalValue: 0,
          containers: new Set(),
        });
      }
      
      const route = routeMap.get(routeKey);
      route.shipments.push(shipment);
      route.totalQuantity += shipment.quantity;
      route.totalValue += shipment.totalCargoValue;
      route.containers.add(shipment.containerId);
    });
    
    // Convert to array with container count
    return Array.from(routeMap.values()).map(route => ({
      ...route,
      containerCount: route.containers.size,
      containers: undefined, // Remove Set for serialization
    }));
  });
  
  /**
   * Get port markers for visualization
   */
  const getPortMarkers = computed(() => {
    const markers = [];
    
    // Add destination ports
    shipmentsByPort.value.forEach((shipments, portName) => {
      const coords = getPortCoords(portName);
      if (!coords) return;
      
      const totalValue = shipments.reduce((sum, s) => sum + s.totalCargoValue, 0);
      const totalQuantity = shipments.reduce((sum, s) => sum + s.quantity, 0);
      const containers = new Set(shipments.map(s => s.containerId)).size;
      
      markers.push({
        name: portName,
        coords,
        type: 'destination',
        shipmentCount: shipments.length,
        containerCount: containers,
        totalValue,
        totalQuantity,
      });
    });
    
    // Add origin ports (China)
    const originPorts = new Map();
    allShipments.value.forEach(s => {
      if (!originPorts.has(s.originPort)) {
        originPorts.set(s.originPort, {
          shipments: [],
          containers: new Set(),
        });
      }
      originPorts.get(s.originPort).shipments.push(s);
      originPorts.get(s.originPort).containers.add(s.containerId);
    });
    
    originPorts.forEach((data, portName) => {
      const coords = getPortCoords(portName);
      if (!coords) return;
      
      markers.push({
        name: portName,
        coords,
        type: 'origin',
        shipmentCount: data.shipments.length,
        containerCount: data.containers.size,
        totalValue: data.shipments.reduce((sum, s) => sum + s.totalCargoValue, 0),
        totalQuantity: data.shipments.reduce((sum, s) => sum + s.quantity, 0),
      });
    });
    
    return markers;
  });
  
  return {
    // State
    isLoading,
    loadError,
    allShipments,
    shipmentsByPort,
    shipmentsByContainer,
    shipmentsByStatus,
    
    // Computed
    totalShipments,
    totalContainers,
    totalCargoValue,
    uniqueVessels,
    getPortArcs,
    getPortMarkers,
    
    // Methods
    loadInboundData,
    getShipmentsByPort,
    getShipmentsByStatus,
    
    // Constants
    PORT_LOCATIONS,
    STATUS_COLORS,
  };
}

export default useInboundLoader;

