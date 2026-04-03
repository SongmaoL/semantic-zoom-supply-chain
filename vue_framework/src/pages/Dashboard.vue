<template>
  <div class="container py-5">
    <div class="row">
      <div class="col-12">
        <h1 class="display-4 mb-4">Supply Chain Dashboard</h1>
        <p class="lead text-muted">
          Welcome to your supply chain visualization platform
        </p>
      </div>
    </div>

    <div class="row mt-5">
      <div class="col-md-4 mb-4">
        <div class="card shadow-sm">
          <div class="card-body">
            <div class="d-flex align-items-center mb-3">
              <i class="bi bi-box-seam fs-1 text-primary me-3"></i>
              <div>
                <h5 class="card-title mb-0">Demand Data</h5>
                <p class="text-muted small mb-0">July 2025</p>
              </div>
            </div>
            <h3 class="mb-0">90,033</h3>
            <p class="text-muted small">Total Orders</p>
          </div>
        </div>
      </div>

      <div class="col-md-4 mb-4">
        <div class="card shadow-sm">
          <div class="card-body">
            <div class="d-flex align-items-center mb-3">
              <i class="bi bi-archive fs-1 text-success me-3"></i>
              <div>
                <h5 class="card-title mb-0">Inventory</h5>
                <p class="text-muted small mb-0">Current Stock</p>
              </div>
            </div>
            <h3 class="mb-0">6,852</h3>
            <p class="text-muted small">Unique Products</p>
          </div>
        </div>
      </div>

      <div class="col-md-4 mb-4">
        <div class="card shadow-sm">
          <div class="card-body">
            <div class="d-flex align-items-center mb-3">
              <i class="bi bi-ship fs-1 text-info me-3"></i>
              <div>
                <h5 class="card-title mb-0">Inbound Cargo</h5>
                <p class="text-muted small mb-0">In Transit</p>
              </div>
            </div>
            <h3 class="mb-0">1,099</h3>
            <p class="text-muted small">Shipment Items</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Featured: Unified Flow Map -->
    <div class="row mt-4">
      <div class="col-12 mb-4">
        <div class="card shadow border-primary">
          <div class="card-body p-4">
            <div class="row align-items-center">
              <div class="col-md-8">
                <h4 class="card-title mb-3">
                  <i class="bi bi-diagram-3 text-primary me-2"></i>Supply Chain Flow Map
                  <span class="badge bg-primary ms-2">Unified</span>
                </h4>
                <p class="mb-3">
                  Interactive visualization combining edge-bundled flow patterns with 
                  semantic zoom. Explore warehouse-to-customer routes at the national 
                  scale, then zoom in to see 3D density hotspots at the city level.
                </p>
                <ul class="list-unstyled mb-3">
                  <li class="mb-2">
                    <i class="bi bi-bezier2 text-primary me-2"></i>
                    <strong>Skeleton-Based Edge Bundling (SBEB)</strong> — reduces clutter while preserving flow patterns
                  </li>
                  <li class="mb-2">
                    <i class="bi bi-layers text-success me-2"></i>
                    <strong>Semantic Zoom</strong> — automatic transition from flows to hexagonal density
                  </li>
                  <li class="mb-2">
                    <i class="bi bi-palette text-warning me-2"></i>
                    <strong>Color by Warehouse/Volume/Category</strong> — multiple analysis perspectives
                  </li>
                </ul>
              </div>
              <div class="col-md-4 text-center">
                <div class="mb-3">
                  <i class="bi bi-diagram-3 text-primary" style="font-size: 5rem;"></i>
                </div>
                <router-link to="/flow-map" class="btn btn-primary btn-lg">
                  <i class="bi bi-arrow-right-circle me-2"></i>Open Flow Map
                </router-link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Data Overview -->
    <div class="row mt-2">
      <div class="col-12">
        <div class="card shadow-sm">
          <div class="card-body">
            <h5 class="card-title mb-3">
              <i class="bi bi-info-circle me-2"></i>Data Overview
            </h5>
            <p class="mb-3">Your supply chain data is ready for visualization:</p>
            <ul class="list-unstyled">
              <li class="mb-2">
                <i class="bi bi-check-circle text-success me-2"></i>
                <strong>Demand Data:</strong> 90,033 orders from July 2025 with geocoded coordinates
              </li>
              <li class="mb-2">
                <i class="bi bi-check-circle text-success me-2"></i>
                <strong>Inventory:</strong> 6,852 products with stock levels
              </li>
              <li class="mb-2">
                <i class="bi bi-check-circle text-success me-2"></i>
                <strong>Inbound Shipments:</strong> 1,099 items across 191 containers
              </li>
            </ul>
            <p class="text-muted small mb-0">
              All data files are linked via <code>wms_cargo_id</code> for complete supply chain visibility.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// Dashboard page - clean starting point
</script>

<style scoped>
.card {
  transition: transform 0.2s;
  border: none;
}

.card:hover {
  transform: translateY(-5px);
}

.card.border-primary {
  border: 2px solid #0d6efd !important;
}

.bi {
  line-height: 1;
}
</style>
