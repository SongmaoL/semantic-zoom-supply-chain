/**
 * Composable for map color utilities
 * Provides consistent color schemes across map components
 */

/**
 * Category color mapping
 */
export const CATEGORY_COLORS = {
  'Apparel & Accessories': [255, 107, 107],
  'Electronics': [72, 219, 251],
  'Hardware': [254, 202, 87],
  'Business & Industrial': [72, 219, 112],
  'Unknown': [150, 150, 150],
};

/**
 * Hexagon layer color range (green to red gradient)
 */
export const HEXAGON_COLOR_RANGE = [
  [26, 152, 80],
  [102, 189, 99],
  [166, 217, 106],
  [254, 224, 139],
  [253, 174, 97],
  [244, 109, 67],
  [215, 48, 39],
  [168, 0, 0]
];

/**
 * Get color for standard arc based on color mode
 * @param {Object} arc - Arc data object
 * @param {string} colorMode - Color mode: 'volume', 'distance', 'category', 'single'
 * @param {number} opacity - Opacity value (0-1)
 * @returns {number[]} RGBA color array
 */
export function getArcColor(arc, colorMode, opacity = 1) {
  const alpha = Math.round(255 * opacity);
  
  switch (colorMode) {
    case 'volume': {
      // Color by volume: red (high) to blue (low)
      const normalized = Math.min(arc.volume / 10, 1);
      return [
        Math.round(255 * normalized),
        100,
        Math.round(255 * (1 - normalized)),
        alpha
      ];
    }
    
    case 'distance': {
      // Color by distance: yellow (long) to green (short)
      const normalized = Math.min(arc.distance / 50, 1);
      return [
        Math.round(255 * normalized),
        206,
        87,
        alpha
      ];
    }
    
    case 'category': {
      const color = CATEGORY_COLORS[arc.category] || CATEGORY_COLORS['Unknown'];
      return [...color, alpha];
    }
    
    case 'single':
    default:
      return [0, 255, 255, alpha];
  }
}

/**
 * Get color for bundled path based on color mode
 * Creates delicate, translucent look with volume affecting density
 * @param {Object} arc - Bundled arc data
 * @param {string} colorMode - Color mode: 'warehouse', 'volume', 'category', 'single'
 * @param {number} baseOpacity - Base opacity (0-1)
 * @returns {number[]} RGBA color array
 */
export function getBundledPathColor(arc, colorMode, baseOpacity = 0.4) {
  const volume = arc.volume || arc.count || 1;
  
  // Volume-based opacity for delicate appearance
  const volumeNorm = Math.min(Math.log10(volume + 1) / 3, 1);
  const minOpacity = 0.15;
  const maxOpacity = baseOpacity;
  const dynamicOpacity = minOpacity + (maxOpacity - minOpacity) * Math.pow(volumeNorm, 0.5);
  const alpha = Math.round(255 * dynamicOpacity);
  
  switch (colorMode) {
    case 'warehouse': {
      const color = arc.warehouseColor || [255, 100, 100];
      return [color[0], color[1], color[2], alpha];
    }
    
    case 'volume': {
      // Gradient from cool blue (low) to warm red (high)
      return [
        Math.round(50 + 205 * volumeNorm),
        Math.round(150 - 100 * volumeNorm),
        Math.round(255 - 200 * volumeNorm),
        alpha
      ];
    }
    
    case 'category': {
      const color = CATEGORY_COLORS[arc.category] || CATEGORY_COLORS['Unknown'];
      return [...color, alpha];
    }
    
    case 'single':
      return [0, 230, 255, alpha];
    
    default:
      if (arc.warehouseColor) {
        return [...arc.warehouseColor, alpha];
      }
      return [100, 200, 255, alpha];
  }
}

/**
 * Get width for bundled path based on volume/count
 * Width scales with the number of orders bundled into this path
 * @param {Object} arc - Bundled arc data
 * @param {number} baseWidth - Base width multiplier
 * @returns {number} Path width in pixels
 */
export function getBundledPathWidth(arc, baseWidth = 2) {
  // Use count (number of bundled edges) as primary, volume as fallback
  const count = arc.count || 1;
  const volume = arc.volume || count;
  
  // Use the larger of count or volume for scaling
  const value = Math.max(count, volume);
  
  // Logarithmic scaling to handle large ranges
  // count=1 -> ~1px, count=10 -> ~2px, count=100 -> ~3px, count=1000+ -> ~4-6px
  const scaleFactor = Math.log10(value + 1);
  
  // Base minimum width + scaled width
  const minWidth = 0.8;
  const width = minWidth + scaleFactor * baseWidth * 0.6;
  
  // Clamp between reasonable bounds
  return Math.max(0.8, Math.min(width, 8));
}

/**
 * Composable providing color utilities with reactive settings
 */
export function useMapColors() {
  return {
    // Constants
    CATEGORY_COLORS,
    HEXAGON_COLOR_RANGE,
    
    // Functions
    getArcColor,
    getBundledPathColor,
    getBundledPathWidth,
  };
}

export default useMapColors;

