/**
 * Composable for managing edge bundling Web Worker
 * Handles SBEB (Skeleton-Based Edge Bundling) computation
 */
import { ref, shallowRef, onUnmounted } from 'vue';

/**
 * Default bundling options based on the SBEB paper
 */
export const DEFAULT_BUNDLE_OPTIONS = {
  gridResolution: 128,      // Density field resolution
  subdivisionPoints: 16,    // Control points per edge
  iterations: 12,           // 12 iterations per paper
  attractionStrength: 0.5,  // Skeleton attraction force
  smoothing: 0.25,          // Edge smoothing factor
  aggregationGridSize: 1.5, // Aggregation cell size (~100 mi)
};

/**
 * Composable for managing the edge bundling worker
 */
export function useBundleWorker() {
  const isBundling = ref(false);
  const bundlingProgress = ref(0);
  const bundlingStatus = ref('');
  
  // Use shallowRef for large bundled data array
  const bundledArcsData = shallowRef([]);
  
  let worker = null;
  let resolvePromise = null;
  let rejectPromise = null;
  
  /**
   * Initialize the web worker
   */
  const initWorker = () => {
    if (worker) return worker;
    
    worker = new Worker(
      new URL('../workers/bundleWorker.js', import.meta.url),
      { type: 'module' }
    );
    
    worker.onmessage = handleWorkerMessage;
    worker.onerror = handleWorkerError;
    
    return worker;
  };
  
  /**
   * Handle messages from the worker
   */
  const handleWorkerMessage = (e) => {
    const { type, progress, message, bundledEdges, originalCount, bundledCount } = e.data;
    
    switch (type) {
      case 'progress':
        bundlingProgress.value = progress;
        break;
        
      case 'status':
        bundlingStatus.value = message;
        break;
        
      case 'complete':
        bundledArcsData.value = bundledEdges;
        isBundling.value = false;
        bundlingProgress.value = 1;
        bundlingStatus.value = `Bundled ${originalCount} routes into ${bundledCount} flows`;
        console.log(`Bundling complete: ${originalCount} -> ${bundledCount} edges`);
        
        if (resolvePromise) {
          resolvePromise(bundledEdges);
          resolvePromise = null;
        }
        break;
        
      case 'error':
        console.error('Bundling error:', message);
        isBundling.value = false;
        bundlingStatus.value = 'Bundling failed: ' + message;
        
        if (rejectPromise) {
          rejectPromise(new Error(message));
          rejectPromise = null;
        }
        break;
    }
  };
  
  /**
   * Handle worker errors
   */
  const handleWorkerError = (error) => {
    console.error('Worker error:', error);
    isBundling.value = false;
    bundlingStatus.value = 'Worker error: ' + error.message;
    
    if (rejectPromise) {
      rejectPromise(error);
      rejectPromise = null;
    }
  };
  
  /**
   * Start edge bundling process
   * @param {Array} arcsData - Array of arc data to bundle
   * @param {Object} options - Bundling options
   * @returns {Promise<Array>} Promise resolving to bundled edges
   */
  const startBundling = (arcsData, options = {}) => {
    if (!arcsData || arcsData.length === 0) {
      return Promise.resolve([]);
    }
    
    // Cancel any existing bundling
    if (isBundling.value) {
      terminateWorker();
    }
    
    initWorker();
    
    isBundling.value = true;
    bundlingProgress.value = 0;
    bundlingStatus.value = 'Preparing edges for bundling...';
    
    // Merge options with defaults
    const mergedOptions = { ...DEFAULT_BUNDLE_OPTIONS, ...options };
    
    // Create plain JavaScript array (required for postMessage)
    const plainEdges = arcsData.map(arc => ({
      source: [...arc.source],
      target: [...arc.target],
      volume: arc.volume,
      orderCount: arc.orderCount || 1, // Actual number of orders (for width scaling)
      category: arc.category,
      // Include state fields for exclusion filtering
      shipperState: arc.shipperState || '',
      destState: arc.destState || '',
      // Preserve additional data for click handling
      orderIndices: arc.orderIndices,
      totalValue: arc.totalValue,
    }));
    
    // Return promise for async handling
    return new Promise((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
      
      worker.postMessage({
        type: 'bundle',
        edges: plainEdges,
        options: mergedOptions,
      });
    });
  };
  
  /**
   * Terminate the worker
   */
  const terminateWorker = () => {
    if (worker) {
      worker.terminate();
      worker = null;
    }
    isBundling.value = false;
    resolvePromise = null;
    rejectPromise = null;
  };
  
  /**
   * Clear bundled data
   */
  const clearBundledData = () => {
    bundledArcsData.value = [];
    bundlingProgress.value = 0;
    bundlingStatus.value = '';
  };
  
  // Cleanup on unmount
  onUnmounted(() => {
    terminateWorker();
  });
  
  return {
    // State
    isBundling,
    bundlingProgress,
    bundlingStatus,
    bundledArcsData,
    
    // Methods
    startBundling,
    terminateWorker,
    clearBundledData,
  };
}

export default useBundleWorker;


