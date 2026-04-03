/**
 * Skeleton-based Edge Bundling (SBEB) Worker
 * 
 * Implementation based on:
 * "Skeleton-based edge bundling for graph visualization"
 * Ersoy, Hurter, Paulovich, Cantareira, Telea (2011)
 * IEEE Transactions on Visualization and Computer Graphics
 * https://enac.hal.science/hal-01021607/file/Hurter_TVCG2011.pdf
 * 
 * Key concepts:
 * - Uses distance fields and 2D skeletonization to bundle edges
 * - Edges are iteratively attracted toward skeleton (medial axis) centerlines
 * - Creates organic, tree-like bundle structures
 */

// ============================================================================
// VECTOR MATH UTILITIES
// ============================================================================

const vecAdd = (a, b) => [a[0] + b[0], a[1] + b[1]];
const vecSub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const vecScale = (v, s) => [v[0] * s, v[1] * s];
const vecLength = (v) => Math.sqrt(v[0] * v[0] + v[1] * v[1]);
const vecNormalize = (v) => {
  const len = vecLength(v);
  return len > 0 ? [v[0] / len, v[1] / len] : [0, 0];
};
const vecDot = (a, b) => a[0] * b[0] + a[1] * b[1];
const vecLerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// ============================================================================
// GRID-BASED DISTANCE FIELD AND SKELETON COMPUTATION
// ============================================================================

/**
 * Create a 2D density grid from edge points
 * This represents the "edge density" at each grid cell
 */
function createDensityField(edges, bounds, resolution) {
  const { minX, minY, maxX, maxY } = bounds;
  const width = resolution;
  const height = resolution;
  const cellWidth = (maxX - minX) / width;
  const cellHeight = (maxY - minY) / height;
  
  // Initialize grid with zeros
  const grid = new Float32Array(width * height);
  
  // Splat each edge onto the grid using Gaussian kernels
  const kernelRadius = 3; // Cells to spread density
  const sigma = 1.5;
  
  for (const edge of edges) {
    // Sample points along the edge
    const numSamples = 10;
    for (let i = 0; i <= numSamples; i++) {
      const t = i / numSamples;
      const point = vecLerp(edge.source, edge.target, t);
      
      // Convert to grid coordinates
      const gx = Math.floor((point[0] - minX) / cellWidth);
      const gy = Math.floor((point[1] - minY) / cellHeight);
      
      // Splat Gaussian kernel
      for (let dy = -kernelRadius; dy <= kernelRadius; dy++) {
        for (let dx = -kernelRadius; dx <= kernelRadius; dx++) {
          const nx = gx + dx;
          const ny = gy + dy;
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            const weight = Math.exp(-(dist * dist) / (2 * sigma * sigma));
            grid[ny * width + nx] += weight * (edge.volume || 1);
          }
        }
      }
    }
  }
  
  return { grid, width, height, cellWidth, cellHeight, minX, minY };
}

/**
 * Compute distance transform of the density field
 * High density areas have distance 0, distance increases outward
 * Uses an approximation of the EDT (Euclidean Distance Transform)
 */
function computeDistanceTransform(densityGrid, width, height, threshold) {
  const maxDensity = Math.max(...densityGrid);
  const normalizedThreshold = maxDensity * threshold;
  
  // Initialize distance grid
  const dist = new Float32Array(width * height);
  const maxDist = Math.sqrt(width * width + height * height);
  
  // Initialize: 0 for high-density cells, large value otherwise
  for (let i = 0; i < densityGrid.length; i++) {
    dist[i] = densityGrid[i] >= normalizedThreshold ? 0 : maxDist;
  }
  
  // Forward pass (top-left to bottom-right)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      
      if (x > 0) {
        dist[idx] = Math.min(dist[idx], dist[idx - 1] + 1);
      }
      if (y > 0) {
        dist[idx] = Math.min(dist[idx], dist[(y - 1) * width + x] + 1);
      }
      if (x > 0 && y > 0) {
        dist[idx] = Math.min(dist[idx], dist[(y - 1) * width + (x - 1)] + 1.414);
      }
      if (x < width - 1 && y > 0) {
        dist[idx] = Math.min(dist[idx], dist[(y - 1) * width + (x + 1)] + 1.414);
      }
    }
  }
  
  // Backward pass (bottom-right to top-left)
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const idx = y * width + x;
      
      if (x < width - 1) {
        dist[idx] = Math.min(dist[idx], dist[idx + 1] + 1);
      }
      if (y < height - 1) {
        dist[idx] = Math.min(dist[idx], dist[(y + 1) * width + x] + 1);
      }
      if (x < width - 1 && y < height - 1) {
        dist[idx] = Math.min(dist[idx], dist[(y + 1) * width + (x + 1)] + 1.414);
      }
      if (x > 0 && y < height - 1) {
        dist[idx] = Math.min(dist[idx], dist[(y + 1) * width + (x - 1)] + 1.414);
      }
    }
  }
  
  return dist;
}

/**
 * Extract skeleton points from distance field
 * Skeleton points are local maxima of the distance transform (ridge detection)
 */
function extractSkeleton(distanceField, densityGrid, width, height, ridgeThreshold) {
  const skeleton = [];
  const maxDist = Math.max(...distanceField);
  
  // Find ridge points (local maxima in at least one direction)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const d = distanceField[idx];
      
      // Skip low-density regions entirely
      if (densityGrid[idx] < ridgeThreshold) continue;
      
      // Check if this is a ridge point (local max in gradient direction)
      const dxMinus = distanceField[idx - 1];
      const dxPlus = distanceField[idx + 1];
      const dyMinus = distanceField[(y - 1) * width + x];
      const dyPlus = distanceField[(y + 1) * width + x];
      
      // Is local max in x or y direction (skeleton ridge)
      const isRidgeX = d >= dxMinus && d >= dxPlus;
      const isRidgeY = d >= dyMinus && d >= dyPlus;
      
      if ((isRidgeX || isRidgeY) && d > 0) {
        skeleton.push({
          x, y,
          distance: d,
          density: densityGrid[idx],
          importance: d * densityGrid[idx], // Combine distance and density
        });
      }
    }
  }
  
  // Sort by importance for efficient lookup
  skeleton.sort((a, b) => b.importance - a.importance);
  
  return skeleton;
}

/**
 * Build a spatial index for skeleton points (grid-based)
 */
function buildSkeletonIndex(skeleton, width, height, cellSize = 5) {
  const gridWidth = Math.ceil(width / cellSize);
  const gridHeight = Math.ceil(height / cellSize);
  const index = new Map();
  
  for (const point of skeleton) {
    const cellX = Math.floor(point.x / cellSize);
    const cellY = Math.floor(point.y / cellSize);
    const key = `${cellX},${cellY}`;
    
    if (!index.has(key)) {
      index.set(key, []);
    }
    index.get(key).push(point);
  }
  
  return { index, cellSize, gridWidth, gridHeight };
}

/**
 * Find nearest skeleton point to a given location
 */
function findNearestSkeletonPoint(x, y, skeletonIndex, searchRadius = 3) {
  const { index, cellSize } = skeletonIndex;
  const cellX = Math.floor(x / cellSize);
  const cellY = Math.floor(y / cellSize);
  
  let nearest = null;
  let nearestDist = Infinity;
  
  // Search in surrounding cells
  for (let dy = -searchRadius; dy <= searchRadius; dy++) {
    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      const key = `${cellX + dx},${cellY + dy}`;
      const points = index.get(key);
      
      if (points) {
        for (const point of points) {
          const dist = Math.sqrt((point.x - x) ** 2 + (point.y - y) ** 2);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = point;
          }
        }
      }
    }
  }
  
  return { point: nearest, distance: nearestDist };
}

// ============================================================================
// EDGE SUBDIVISION AND ATTRACTION
// ============================================================================

/**
 * Subdivide an edge into control points
 */
function subdivideEdge(edge, numPoints) {
  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    points.push(vecLerp(edge.source, edge.target, t));
  }
  return points;
}

/**
 * Apply Chaikin's corner-cutting algorithm for smooth curves
 * This creates a smoother B-spline-like curve from control points
 * More iterations = smoother curves (3-4 recommended for organic look)
 */
function smoothCurve(points, iterations = 4) {
  if (!points || points.length < 2) return points;
  
  let smoothed = points.map(p => [...p]); // Deep copy
  
  for (let iter = 0; iter < iterations; iter++) {
    const newPoints = [[...smoothed[0]]]; // Keep first point
    
    for (let i = 0; i < smoothed.length - 1; i++) {
      const p0 = smoothed[i];
      const p1 = smoothed[i + 1];
      
      // Chaikin's algorithm: cut corners at 1/4 and 3/4
      const q = vecLerp(p0, p1, 0.25);
      const r = vecLerp(p0, p1, 0.75);
      
      newPoints.push(q);
      newPoints.push(r);
    }
    
    newPoints.push([...smoothed[smoothed.length - 1]]); // Keep last point
    smoothed = newPoints;
  }
  
  return smoothed;
}

/**
 * Catmull-Rom spline interpolation for ultra-smooth curves
 * Produces C1 continuous curves that pass through all control points
 */
function catmullRomSpline(points, segments = 10, tension = 0.5) {
  if (!points || points.length < 2) return points;
  if (points.length === 2) {
    // Just interpolate between two points
    const result = [];
    for (let i = 0; i <= segments; i++) {
      result.push(vecLerp(points[0], points[1], i / segments));
    }
    return result;
  }
  
  const result = [];
  
  // Extend control points for proper interpolation at ends
  const extended = [
    vecSub(vecScale(points[0], 2), points[1]), // Reflect first point
    ...points,
    vecSub(vecScale(points[points.length - 1], 2), points[points.length - 2]), // Reflect last point
  ];
  
  for (let i = 1; i < extended.length - 2; i++) {
    const p0 = extended[i - 1];
    const p1 = extended[i];
    const p2 = extended[i + 1];
    const p3 = extended[i + 2];
    
    for (let t = 0; t < segments; t++) {
      const s = t / segments;
      const s2 = s * s;
      const s3 = s2 * s;
      
      // Catmull-Rom basis functions with tension
      const t0 = tension * (-s3 + 2 * s2 - s);
      const t1 = tension * (3 * s3 - 5 * s2 + 2) + (1 - tension) * (-s3 + s2);
      const t2 = tension * (-3 * s3 + 4 * s2 + s) + (1 - tension) * (s3 - s2);
      const t3 = tension * (s3 - s2);
      
      // Simplified Catmull-Rom with tension = 0.5 (centripetal)
      const x = 0.5 * (
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * s3 +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * s2 +
        (-p0[0] + p2[0]) * s +
        2 * p1[0]
      );
      const y = 0.5 * (
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * s3 +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * s2 +
        (-p0[1] + p2[1]) * s +
        2 * p1[1]
      );
      
      result.push([x, y]);
    }
  }
  
  // Add the last point
  result.push([...points[points.length - 1]]);
  
  return result;
}

/**
 * Gaussian smoothing pass - averages each point with neighbors
 */
function gaussianSmooth(points, iterations = 3, sigma = 0.3) {
  if (!points || points.length < 3) return points;
  
  let smoothed = points.map(p => [...p]);
  
  for (let iter = 0; iter < iterations; iter++) {
    const newPoints = [[...smoothed[0]]]; // Keep first point fixed
    
    for (let i = 1; i < smoothed.length - 1; i++) {
      const prev = smoothed[i - 1];
      const curr = smoothed[i];
      const next = smoothed[i + 1];
      
      // Weighted average: prev + 2*curr + next / 4
      const weight = sigma;
      const avgX = curr[0] * (1 - weight) + (prev[0] + next[0]) * weight * 0.5;
      const avgY = curr[1] * (1 - weight) + (prev[1] + next[1]) * weight * 0.5;
      
      newPoints.push([avgX, avgY]);
    }
    
    newPoints.push([...smoothed[smoothed.length - 1]]); // Keep last point fixed
    smoothed = newPoints;
  }
  
  return smoothed;
}

/**
 * Resample a curve to have exactly N points (for consistent rendering)
 */
function resampleCurve(points, targetCount) {
  if (!points || points.length < 2) return points;
  
  // Calculate total length
  let totalLength = 0;
  const segmentLengths = [];
  for (let i = 0; i < points.length - 1; i++) {
    const len = vecLength(vecSub(points[i + 1], points[i]));
    segmentLengths.push(len);
    totalLength += len;
  }
  
  if (totalLength === 0) return points;
  
  // Resample at equal arc-length intervals
  const resampled = [[...points[0]]];
  const stepLength = totalLength / (targetCount - 1);
  let currentDist = 0;
  let segmentIdx = 0;
  
  for (let i = 1; i < targetCount - 1; i++) {
    const targetDist = i * stepLength;
    
    while (segmentIdx < segmentLengths.length && 
           currentDist + segmentLengths[segmentIdx] < targetDist) {
      currentDist += segmentLengths[segmentIdx];
      segmentIdx++;
    }
    
    if (segmentIdx >= segmentLengths.length) {
      segmentIdx = segmentLengths.length - 1;
    }
    
    if (segmentLengths[segmentIdx] > 0) {
      const t = Math.min(1, Math.max(0, (targetDist - currentDist) / segmentLengths[segmentIdx]));
      const point = vecLerp(points[segmentIdx], points[segmentIdx + 1], t);
      resampled.push(point);
    }
  }
  
  resampled.push([...points[points.length - 1]]);
  return resampled;
}

/**
 * Convert world coordinates to grid coordinates
 */
function worldToGrid(point, fieldInfo) {
  return [
    (point[0] - fieldInfo.minX) / fieldInfo.cellWidth,
    (point[1] - fieldInfo.minY) / fieldInfo.cellHeight,
  ];
}

/**
 * Convert grid coordinates to world coordinates
 */
function gridToWorld(gridPoint, fieldInfo) {
  return [
    gridPoint[0] * fieldInfo.cellWidth + fieldInfo.minX,
    gridPoint[1] * fieldInfo.cellHeight + fieldInfo.minY,
  ];
}

/**
 * Check if a skeleton point is "on the way" for an edge
 * This prevents local deliveries from being pulled to distant skeleton points
 */
function isOnPath(skelWorldPos, source, target, maxDetourFactor = 0.3) {
  // Direct distance from source to target
  const directDist = vecLength(vecSub(target, source));
  
  // If it's a very short edge (local delivery), don't bundle aggressively
  if (directDist < 3.0) return false; // ~300km, local deliveries stay local
  
  // Distance from source to skeleton point - reject if skeleton is behind source
  const distToSkel = vecLength(vecSub(skelWorldPos, source));
  if (distToSkel < 0.5) return false; // Too close to source, would cause sharp wedge
  
  // Distance via skeleton point
  const distViaSkel = distToSkel + vecLength(vecSub(target, skelWorldPos));
  
  // How much detour would this cause?
  const detourRatio = (distViaSkel - directDist) / directDist;
  
  // Stricter check: also ensure skeleton isn't pulling flow backward
  const toTarget = vecNormalize(vecSub(target, source));
  const toSkel = vecNormalize(vecSub(skelWorldPos, source));
  const forwardness = vecDot(toTarget, toSkel);
  
  // Skeleton must be generally in the direction of the target (not backward)
  if (forwardness < 0.3) return false;
  
  // Only attract if detour is acceptable
  return detourRatio < maxDetourFactor;
}

/**
 * Check if skeleton point is roughly between source and target
 */
function isBetweenEndpoints(skelWorldPos, source, target) {
  // Project skeleton point onto the line from source to target
  const edge = vecSub(target, source);
  const edgeLen = vecLength(edge);
  if (edgeLen < 0.001) return false;
  
  const toSkel = vecSub(skelWorldPos, source);
  const projection = vecDot(toSkel, edge) / (edgeLen * edgeLen);
  
  // Skeleton should be roughly between endpoints (with some margin)
  return projection > -0.1 && projection < 1.1;
}

/**
 * Attract edge control points toward skeleton
 * This is the core of SBEB: edges are pulled toward the medial axis
 * 
 * KEY IMPROVEMENT: Only attract to skeleton points that are "on the way"
 * This prevents Texas-to-Texas deliveries from detouring through Kansas
 */
function attractToSkeleton(controlPoints, skeletonIndex, fieldInfo, attractionStrength, smoothing, source, target) {
  // Calculate edge length for detour checking
  const edgeLength = vecLength(vecSub(target, source));
  const isLongDistance = edgeLength > 5.0; // ~500km threshold
  
  const newPoints = controlPoints.map((point, i) => {
    // Keep endpoints fixed
    if (i === 0 || i === controlPoints.length - 1) {
      return [...point];
    }
    
    // Middle points are attracted more strongly (bell curve)
    const t = i / (controlPoints.length - 1);
    const middleFactor = 4 * t * (1 - t); // 0 at ends, 1 at middle
    
    // Convert to grid space
    const gridPos = worldToGrid(point, fieldInfo);
    
    // Find nearest skeleton point
    const { point: skelPoint, distance } = findNearestSkeletonPoint(
      gridPos[0], gridPos[1], skeletonIndex, 10
    );
    
    if (!skelPoint || distance > 50) {
      // No nearby skeleton, just apply light smoothing
      const prev = controlPoints[i - 1];
      const next = controlPoints[i + 1];
      const mid = vecLerp(prev, next, 0.5);
      return vecLerp(point, mid, smoothing * 0.3);
    }
    
    // Convert skeleton point to world coordinates
    const skelWorldPos = gridToWorld([skelPoint.x, skelPoint.y], fieldInfo);
    
    // KEY FIX: Check if this skeleton point is "on the way"
    // Short/local edges should NOT be pulled to distant skeleton points
    const onPath = isOnPath(skelWorldPos, source, target, isLongDistance ? 0.4 : 0.15);
    const between = isBetweenEndpoints(skelWorldPos, source, target);
    
    if (!onPath || !between) {
      // Skeleton point would cause detour - just smooth, don't attract
      const prev = controlPoints[i - 1];
      const next = controlPoints[i + 1];
      const mid = vecLerp(prev, next, 0.5);
      return vecLerp(point, mid, smoothing * 0.4);
    }
    
    // Compute attraction force toward skeleton
    const toSkeleton = vecSub(skelWorldPos, point);
    const skelDist = vecLength(toSkeleton);
    
    if (skelDist < 0.0001) return [...point];
    
    // Attraction weighted by skeleton importance
    // Long-distance edges get stronger bundling
    const distanceBonus = isLongDistance ? 1.2 : 0.6;
    const importanceWeight = Math.min(skelPoint.importance / 50, 1.5) * distanceBonus;
    
    // Direct interpolation toward skeleton point
    const pullStrength = attractionStrength * middleFactor * importanceWeight;
    const newPoint = vecLerp(point, skelWorldPos, Math.min(pullStrength, 0.6));
    
    // Light smoothing
    const prev = controlPoints[i - 1];
    const next = controlPoints[i + 1];
    const mid = vecLerp(prev, next, 0.5);
    const smoothed = vecLerp(newPoint, mid, smoothing * 0.15);
    
    return smoothed;
  });
  
  return newPoints;
}

/**
 * Apply cohesion force - edges in same cluster attract each other
 * This creates tighter bundles by pulling edges toward cluster centroid
 * 
 * IMPROVED: Only apply strong cohesion to long-distance edges
 * Local edges get minimal cohesion to preserve their natural paths
 */
function applyCohesionDirectional(allSubdivided, cohesionStrength = 0.3) {
  if (allSubdivided.length === 0) return allSubdivided;
  
  // Separate long-distance and short-distance edges
  const longDistance = allSubdivided.filter(({ edge }) => {
    const dist = vecLength(vecSub(edge.target, edge.source));
    return dist > 5.0; // ~500km threshold
  });
  
  const shortDistance = allSubdivided.filter(({ edge }) => {
    const dist = vecLength(vecSub(edge.target, edge.source));
    return dist <= 5.0;
  });
  
  // Compute centroid only for long-distance edges
  const numPoints = allSubdivided[0].points.length;
  const centroids = [];
  
  if (longDistance.length > 0) {
    for (let i = 0; i < numPoints; i++) {
      let sumX = 0, sumY = 0;
      for (const { points } of longDistance) {
        sumX += points[i][0];
        sumY += points[i][1];
      }
      centroids.push([sumX / longDistance.length, sumY / longDistance.length]);
    }
  }
  
  // Apply strong cohesion to long-distance edges
  const processedLong = longDistance.map(({ points, edge }) => ({
    points: points.map((point, i) => {
      if (i === 0 || i === points.length - 1) return [...point];
      
      const t = i / (points.length - 1);
      const middleFactor = 4 * t * (1 - t);
      
      return vecLerp(point, centroids[i], cohesionStrength * middleFactor);
    }),
    edge,
  }));
  
  // Apply minimal smoothing to short-distance edges (no cohesion to centroid)
  const processedShort = shortDistance.map(({ points, edge }) => ({
    points: points.map((point, i) => {
      if (i === 0 || i === points.length - 1) return [...point];
      
      // Just smooth toward neighbors, no centroid pull
      const prev = points[i - 1];
      const next = points[i + 1];
      const mid = vecLerp(prev, next, 0.5);
      return vecLerp(point, mid, 0.1);
    }),
    edge,
  }));
  
  return [...processedLong, ...processedShort];
}

// ============================================================================
// EDGE CLUSTERING
// ============================================================================

/**
 * Compute direction sector (0-15 for 16 directions)
 */
function getDirectionSector(source, target, numSectors = 16) {
  const dx = target[0] - source[0];
  const dy = target[1] - source[1];
  const angle = Math.atan2(dy, dx); // -PI to PI
  const sector = Math.round((angle + Math.PI) / (2 * Math.PI / numSectors)) % numSectors;
  return sector;
}

/**
 * Get warehouse key from source coordinates
 */
function getWarehouseKey(source) {
  return `${source[0].toFixed(2)},${source[1].toFixed(2)}`;
}

/**
 * Cluster edges by source warehouse and direction
 */
function clusterEdges(edges) {
  const clusters = new Map();
  
  for (const edge of edges) {
    const warehouseKey = getWarehouseKey(edge.source);
    const sector = getDirectionSector(edge.source, edge.target, 8);
    const clusterKey = `${warehouseKey}_${sector}`;
    
    if (!clusters.has(clusterKey)) {
      clusters.set(clusterKey, {
        edges: [],
        warehouseKey,
        sector,
        source: [...edge.source],
        totalVolume: 0,
      });
    }
    
    const cluster = clusters.get(clusterKey);
    cluster.edges.push(edge);
    cluster.totalVolume += edge.volume || 1;
  }
  
  return clusters;
}

// ============================================================================
// WAREHOUSE COLOR PALETTE - High contrast, distinct colors
// ============================================================================

// Tetradic color scheme - 4 colors evenly spaced on color wheel
// Designed for 4 warehouses at US corners with maximum contrast
const WAREHOUSE_COLORS = [
  [255, 107, 53],   // CA (Southwest) - Warm Orange-Red
  [0, 212, 255],    // NJ (Northeast) - Cool Cyan-Blue (opposite of orange)
  [178, 255, 89],   // TX (South) - Lime-Yellow-Green
  [178, 102, 255],  // IL (North) - Purple-Violet (opposite of lime)
  // Extended palette if more warehouses needed
  [255, 159, 64],   // Peach-Orange
  [64, 224, 208],   // Turquoise
  [255, 99, 132],   // Pink-Red
  [153, 102, 255],  // Lavender
];

/**
 * Attempt to maximize color distance between warehouses
 * by shuffling based on hue distribution
 */
function getDistinctColor(index, totalWarehouses) {
  // Use golden ratio to spread hues evenly
  const goldenRatio = 0.618033988749895;
  const hue = (index * goldenRatio) % 1;
  
  // Convert HSL to RGB (high saturation, medium lightness)
  const s = 0.85;
  const l = 0.55;
  
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((hue * 6) % 2 - 1));
  const m = l - c / 2;
  
  let r, g, b;
  if (hue < 1/6) { r = c; g = x; b = 0; }
  else if (hue < 2/6) { r = x; g = c; b = 0; }
  else if (hue < 3/6) { r = 0; g = c; b = x; }
  else if (hue < 4/6) { r = 0; g = x; b = c; }
  else if (hue < 5/6) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  ];
}

// ============================================================================
// MAIN SKELETON-BASED BUNDLING ALGORITHM
// ============================================================================

// Warehouse locations for determining source state from coordinates
const WAREHOUSE_COORDS = {
  'CA': { lon: -117.8647, lat: 34.0206 },
  'NJ': { lon: -74.1724, lat: 40.7357 },
  'TX': { lon: -95.5569, lat: 29.9190 },
  'IL': { lon: -88.0423, lat: 41.5894 },
};

// Short-distance flows to exclude from bundling (render as simple arcs)
// These create angular artifacts when bundled with longer flows
const EXCLUDED_FLOWS = new Set([
  'TX-LA', 'TX-FL',  // Texas to nearby states (cause wedge near New Orleans)
  'NJ-DE',  // New Jersey to nearby states
  'CA-NV', 'CA-AZ',  // California to nearby states (short west coast flows)
]);

function getWarehouseStateFromCoords(source) {
  // Find closest warehouse to source coordinates
  let closestState = null;
  let minDist = Infinity;
  
  for (const [state, coords] of Object.entries(WAREHOUSE_COORDS)) {
    const dist = Math.sqrt(
      Math.pow(source[0] - coords.lon, 2) + 
      Math.pow(source[1] - coords.lat, 2)
    );
    if (dist < minDist) {
      minDist = dist;
      closestState = state;
    }
  }
  
  return closestState;
}

function shouldExcludeFromBundling(edge) {
  // Get warehouse state from source coordinates
  const warehouseState = getWarehouseStateFromCoords(edge.source);
  const destState = edge.destState || '';
  
  if (!warehouseState || !destState) return false;
  
  const key = `${warehouseState}-${destState}`;
  const excluded = EXCLUDED_FLOWS.has(key);
  
  if (excluded) {
    console.log(`Excluding flow: ${key}`);
  }
  
  return excluded;
}

function skeletonBasedBundling(edges, options = {}) {
  const {
    gridResolution = 128,        // Resolution of density/distance grid
    subdivisions = 48,           // More control points for extra smooth curves
    iterations = 12,             // Number of attraction iterations (per paper)
    attractionStrength = 0.5,    // Balanced skeleton attraction
    smoothing = 0.2,             // Increased smoothing for organic look
    densityThreshold = 0.1,      // Threshold for distance field
    ridgeThreshold = 0.05,       // Minimum density for skeleton points
  } = options;
  
  if (edges.length === 0) return [];
  
  // Separate edges: ones to bundle vs ones to render as simple arcs
  const edgesToBundle = edges.filter(e => !shouldExcludeFromBundling(e));
  const excludedEdges = edges.filter(e => shouldExcludeFromBundling(e));
  
  self.postMessage({ 
    type: 'status', 
    message: `Bundling ${edgesToBundle.length} flows (${excludedEdges.length} short-distance excluded)` 
  });
  
  self.postMessage({ type: 'status', message: 'Clustering edges by warehouse and direction...' });
  
  // Step 1: Cluster edges by warehouse and direction (only bundleable edges)
  const clusters = clusterEdges(edgesToBundle);
  self.postMessage({ type: 'status', message: `Created ${clusters.size} edge clusters` });
  
  // Assign colors to warehouses - use golden ratio for maximum distinction
  const warehouseColorMap = new Map();
  const warehouseVolumes = new Map();
  
  for (const [, cluster] of clusters) {
    const vol = warehouseVolumes.get(cluster.warehouseKey) || 0;
    warehouseVolumes.set(cluster.warehouseKey, vol + cluster.totalVolume);
  }
  
  // Sort warehouses by volume and assign distinct colors
  const sortedWarehouses = Array.from(warehouseVolumes.entries())
    .sort((a, b) => b[1] - a[1]);
  
  const totalWarehouses = sortedWarehouses.length;
  sortedWarehouses.forEach(([key], index) => {
    // Use golden ratio distribution for maximum color distinction
    warehouseColorMap.set(key, getDistinctColor(index, totalWarehouses));
  });
  
  // Step 2: Compute bounds (from bundleable edges only)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const edge of edgesToBundle) {
    minX = Math.min(minX, edge.source[0], edge.target[0]);
    minY = Math.min(minY, edge.source[1], edge.target[1]);
    maxX = Math.max(maxX, edge.source[0], edge.target[0]);
    maxY = Math.max(maxY, edge.source[1], edge.target[1]);
  }
  
  // Add padding
  const padX = (maxX - minX) * 0.05;
  const padY = (maxY - minY) * 0.05;
  const bounds = { minX: minX - padX, minY: minY - padY, maxX: maxX + padX, maxY: maxY + padY };
  
  self.postMessage({ type: 'status', message: 'Computing density field and skeleton...' });
  
  // Step 3: Create density field from bundleable edges (global structure)
  const fieldInfo = createDensityField(edgesToBundle, bounds, gridResolution);
  
  // Step 4: Compute distance transform
  const distanceField = computeDistanceTransform(
    fieldInfo.grid, fieldInfo.width, fieldInfo.height, densityThreshold
  );
  
  // Step 5: Extract skeleton
  const skeleton = extractSkeleton(
    distanceField, fieldInfo.grid, fieldInfo.width, fieldInfo.height,
    Math.max(...fieldInfo.grid) * ridgeThreshold
  );
  
  self.postMessage({ type: 'status', message: `Extracted ${skeleton.length} skeleton points` });
  
  // Step 6: Build skeleton spatial index
  const skeletonIndex = buildSkeletonIndex(skeleton, fieldInfo.width, fieldInfo.height, 4);
  
  // Step 7: Bundle each cluster's edges
  const bundledFlows = [];
  let clusterIndex = 0;
  const totalClusters = clusters.size;
  
  for (const [clusterKey, cluster] of clusters) {
    clusterIndex++;
    
    // Progress update
    if (clusterIndex % 10 === 0) {
      self.postMessage({
        type: 'progress',
        progress: clusterIndex / totalClusters * 0.8,
      });
    }
    
    // Skip very small clusters
    if (cluster.edges.length < 2) {
      // Just create simple paths for single edges
      for (const edge of cluster.edges) {
        const path = subdivideEdge(edge, 8);
        bundledFlows.push({
          path,
          source: edge.source,
          target: edge.target,
          volume: edge.volume || 1,
          orderCount: edge.orderCount || 1, // Preserve order count for width scaling
          count: 1,
          warehouseKey: cluster.warehouseKey,
          warehouseColor: warehouseColorMap.get(cluster.warehouseKey),
          sector: cluster.sector,
        });
      }
      continue;
    }
    
    // Subdivide all edges in cluster
    let subdivided = cluster.edges.map(edge => ({
      points: subdivideEdge(edge, subdivisions),
      edge,
    }));
    
    // Iteratively attract to skeleton (12 iterations per paper)
    // Two-phase approach: skeleton attraction + cluster cohesion
    for (let iter = 0; iter < iterations; iter++) {
      // Phase 1: Attract to skeleton (with directional constraints)
      subdivided = subdivided.map(({ points, edge }) => ({
        points: attractToSkeleton(
          points, skeletonIndex, fieldInfo,
          attractionStrength,
          smoothing,
          edge.source,  // Pass source for detour checking
          edge.target   // Pass target for detour checking
        ),
        edge,
      }));
      
      // Phase 2: Cohesion - pull edges in cluster toward each other
      // Only apply cohesion to long-distance edges
      const cohesionStrength = 0.15 + (iter / iterations) * 0.2;
      subdivided = applyCohesionDirectional(subdivided, cohesionStrength);
    }
    
    // Create bundled flow paths with aggressive multi-stage smoothing
    for (const { points, edge } of subdivided) {
      // Stage 1: Very heavy Gaussian smoothing to eliminate wedge artifacts
      const gaussian1 = gaussianSmooth(points, 15, 0.55);
      
      // Stage 2: Catmull-Rom spline for C1 continuous curves
      const splined = catmullRomSpline(gaussian1, 10);
      
      // Stage 3: More Gaussian smoothing to soften any remaining angles
      const gaussian2 = gaussianSmooth(splined, 10, 0.45);
      
      // Stage 4: Second spline pass
      const splined2 = catmullRomSpline(gaussian2, 8);
      
      // Stage 5: Final heavy smoothing pass
      const gaussian3 = gaussianSmooth(splined2, 8, 0.4);
      
      // Stage 6: One more light spline for final polish
      const splined3 = catmullRomSpline(gaussian3, 4);
      
      // Stage 7: Final light smoothing
      const gaussian4 = gaussianSmooth(splined3, 4, 0.25);
      
      // Stage 8: Resample to consistent point count
      const resampled = resampleCurve(gaussian4, 100);
      
      // Convert to plain arrays for serialization
      const finalPath = resampled.map(p => [p[0], p[1]]);
      
      bundledFlows.push({
        path: finalPath,
        source: [...edge.source],
        target: [...edge.target],
        volume: edge.volume || 1,
        orderCount: edge.orderCount || 1, // Preserve order count for width scaling
        count: edge.count || 1,
        warehouseKey: cluster.warehouseKey,
        warehouseColor: warehouseColorMap.get(cluster.warehouseKey),
        sector: cluster.sector,
      });
    }
  }
  
  self.postMessage({ type: 'progress', progress: 0.9 });
  self.postMessage({ type: 'status', message: 'Adding excluded short-distance flows...' });
  
  // Add excluded edges as simple curved arcs (not bundled)
  for (const edge of excludedEdges) {
    const warehouseKey = getWarehouseKey(edge.source);
    
    // Create a simple curved path (quadratic bezier-like)
    const numPoints = 20;
    const simplePath = [];
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      // Simple arc with slight curve
      const x = edge.source[0] + (edge.target[0] - edge.source[0]) * t;
      const y = edge.source[1] + (edge.target[1] - edge.source[1]) * t;
      // Add slight curve offset (perpendicular to line)
      const dx = edge.target[0] - edge.source[0];
      const dy = edge.target[1] - edge.source[1];
      const len = Math.sqrt(dx * dx + dy * dy);
      const perpX = -dy / len;
      const perpY = dx / len;
      const curveAmount = len * 0.1 * Math.sin(t * Math.PI); // Gentle arc
      simplePath.push([x + perpX * curveAmount, y + perpY * curveAmount]);
    }
    
    bundledFlows.push({
      id: `excluded-${bundledFlows.length}`,
      path: simplePath,
      source: [...edge.source],
      target: [...edge.target],
      volume: edge.volume || 1,
      orderCount: edge.orderCount || 1, // Preserve order count for width scaling
      count: edge.count || 1,
      warehouseKey: warehouseKey,
      warehouseColor: warehouseColorMap.get(warehouseKey) || [200, 200, 200],
      isExcluded: true, // Mark as excluded from bundling
      // Preserve original edge data
      orderIndices: edge.orderIndices,
      destState: edge.destState,
      shipperState: edge.shipperState,
      category: edge.category,
      totalValue: edge.totalValue,
    });
  }
  
  self.postMessage({ type: 'status', message: 'Finalizing bundled paths...' });
  
  return bundledFlows;
}

// ============================================================================
// AGGREGATED BUNDLING (for large datasets)
// ============================================================================

function aggregatedSkeletonBundling(edges, options = {}) {
  const {
    gridResolution = 100,
    subdivisions = 28,            // More points for smoother curves
    iterations = 12,              // 12 iterations per paper
    attractionStrength = 0.5,     // Balanced attraction
    smoothing = 0.15,             // Moderate smoothing
    aggregationGridSize = 1.5,    // degrees (~100 miles)
  } = options;
  
  if (edges.length === 0) return [];
  
  self.postMessage({ type: 'status', message: 'Aggregating edges by region...' });
  
  // Step 1: Aggregate edges by source warehouse and destination region
  const aggregated = new Map();
  
  for (const edge of edges) {
    const warehouseKey = getWarehouseKey(edge.source);
    const destGridX = Math.floor((edge.target[0] + 125) / aggregationGridSize);
    const destGridY = Math.floor((edge.target[1] - 24) / aggregationGridSize);
    const destKey = `${destGridX}_${destGridY}`;
    const aggKey = `${warehouseKey}__${destKey}`;
    
    if (!aggregated.has(aggKey)) {
      aggregated.set(aggKey, {
        source: [...edge.source],
        targetSum: [0, 0],
        count: 0,
        totalVolume: 0,
        warehouseKey,
        destKey,
      });
    }
    
    const agg = aggregated.get(aggKey);
    agg.targetSum[0] += edge.target[0];
    agg.targetSum[1] += edge.target[1];
    agg.count++;
    agg.totalVolume += edge.volume || 1;
  }
  
  // Create aggregated edges with centroid targets
  const aggEdges = [];
  for (const [, agg] of aggregated) {
    const target = [
      agg.targetSum[0] / agg.count,
      agg.targetSum[1] / agg.count,
    ];
    
    // Skip very short flows
    const dx = target[0] - agg.source[0];
    const dy = target[1] - agg.source[1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.5) continue;
    
    aggEdges.push({
      source: agg.source,
      target,
      volume: agg.totalVolume,
      count: agg.count,
      warehouseKey: agg.warehouseKey,
      destKey: agg.destKey,
    });
  }
  
  self.postMessage({ 
    type: 'status', 
    message: `Aggregated ${edges.length} edges into ${aggEdges.length} flows` 
  });
  
  // Step 2: Apply skeleton-based bundling to aggregated edges
  return skeletonBasedBundling(aggEdges, {
    gridResolution,
    subdivisions,
    iterations,
    attractionStrength,
    smoothing,
  });
}


// ============================================================================
// MESSAGE HANDLER
// ============================================================================

self.onmessage = function(e) {
  const { type, edges, options = {} } = e.data;
  
  if (type === 'bundle') {
    try {
      // Skeleton-Based Edge Bundling (SBEB)
      self.postMessage({ type: 'status', message: 'Using Skeleton-Based Edge Bundling (SBEB)...' });
      
      let bundledEdges;
      const useAggregation = edges.length > 500;
      
      if (useAggregation) {
        bundledEdges = aggregatedSkeletonBundling(edges, {
          gridResolution: options.gridResolution || 100,
          subdivisions: options.subdivisionPoints || 48,
          iterations: options.iterations || 20,
          attractionStrength: options.attractionStrength || 0.5,
          smoothing: options.smoothing || 0.5,
          aggregationGridSize: options.aggregationGridSize || 2.0,
        });
      } else {
        bundledEdges = skeletonBasedBundling(edges, {
          gridResolution: options.gridResolution || 128,
          subdivisions: options.subdivisionPoints || 64,
          iterations: options.iterations || 15,
          attractionStrength: options.attractionStrength || 0.35,
          smoothing: options.smoothing || 0.65,
        });
      }
      
      self.postMessage({
        type: 'status',
        message: `Created ${bundledEdges.length} bundled flows using SBEB`
      });
      
      self.postMessage({ type: 'progress', progress: 1 });
      
      self.postMessage({
        type: 'complete',
        bundledEdges,
        originalCount: edges.length,
        bundledCount: bundledEdges.length,
        algorithm: 'SBEB',
      });
      
    } catch (error) {
      self.postMessage({
        type: 'error',
        message: error.message,
      });
    }
  }
};
