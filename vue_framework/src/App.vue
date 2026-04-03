<template>
  <div id="app" class="bg-light">
    <nav class="navbar navbar-expand-lg navbar-light bg-white border-bottom">
      <div class="container">
        <router-link to="/" class="navbar-brand">
          <i class="bi bi-graph-up"></i> Supply Chain Dashboard
        </router-link>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav ms-auto">
            <li class="nav-item">
              <router-link to="/" class="nav-link">
                <i class="bi bi-house-door"></i> Home
              </router-link>
            </li>
            <li class="nav-item">
              <router-link to="/flow-map" class="nav-link">
                <i class="bi bi-diagram-3"></i> Flow Map
              </router-link>
            </li>
          </ul>
        </div>
      </div>
    </nav>
    
    <main>
      <router-view :key="$route.fullPath" />
    </main>
  </div>
</template>

<script setup>
// App component with Bootstrap navigation
</script>

<style>
/* Clean Bootstrap theme for supply chain visualization */
body {
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  background: #f8f9fa;
  min-height: 100vh;
}

#app {
  min-height: 100vh;
}

.navbar {
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
}

.navbar-brand {
  font-weight: 600;
  color: #212529 !important;
}

.nav-link.router-link-active {
  font-weight: 600;
  color: #0d6efd !important;
}
</style>
