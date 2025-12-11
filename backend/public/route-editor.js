document.addEventListener('DOMContentLoaded', () => {
    const map = L.map('map').setView([36.041, 14.245], 13);
    
    // Use local tiles for offline functionality
    const gozoBounds = L.latLngBounds([35.98, 14.15], [36.09, 14.40]);
    
    // Add cache-busting parameter to tile URLs to prevent stale cache issues
    const cacheBuster = new Date().getTime();
    
    L.tileLayer('/tiles/gozo/{z}/{x}/{y}.png?v=' + cacheBuster, {
        maxZoom: 19,
        minZoom: 12,
        attribution: 'Discover Gozo | &copy; Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP',
        bounds: gozoBounds,
        errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    }).addTo(map);
    
    map.setMaxBounds(gozoBounds);

    const routeTypeSelect = document.getElementById('route-type-select');
    const routeSelect = document.getElementById('route-select');
    const saveStopsBtn = document.getElementById('save-stops-btn');
    const saveShapeBtn = document.getElementById('save-shape-btn');

    let selectedRouteId = null;
    let stopsLayer = L.layerGroup().addTo(map);
    let shapeLayer = L.layerGroup().addTo(map);

    const fetchRoutes = async () => {
        const routeType = routeTypeSelect.value;
        try {
            const response = await fetch(`/api/routes/list?type=${routeType}`);
            const routes = await response.json();
            routeSelect.innerHTML = '<option value="">Select a route</option>';
            routes.forEach(route => {
                const option = document.createElement('option');
                option.value = route.id;
                option.textContent = route.name;
                routeSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to fetch routes:', error);
        }
    };

    const fetchRouteData = async () => {
        const routeType = routeTypeSelect.value;
        selectedRouteId = routeSelect.value;
        if (!selectedRouteId) {
            stopsLayer.clearLayers();
            shapeLayer.clearLayers();
            return;
        }

        try {
            const response = await fetch(`/api/routes/${routeType}/${selectedRouteId}`);
            const routeData = await response.json();

            stopsLayer.clearLayers();
            if (routeData.stops) {
                routeData.stops.forEach(stop => {
                    L.marker([stop.lat, stop.lng]).addTo(stopsLayer);
                });
            }

            shapeLayer.clearLayers();
            if (routeData.shape) {
                L.polyline(routeData.shape.map(p => [p.lat, p.lng])).addTo(shapeLayer);
            }

            if (routeData.shape && routeData.shape.length > 0) {
                map.fitBounds(L.polyline(routeData.shape.map(p => [p.lat, p.lng])).getBounds());
            }

        } catch (error) {
            console.error('Failed to fetch route data:', error);
        }
    };

    const saveStops = async () => {
        if (!selectedRouteId) return;
        const routeType = routeTypeSelect.value;
        const stops = [];
        stopsLayer.eachLayer(layer => {
            const latLng = layer.getLatLng();
            stops.push({ lat: latLng.lat, lng: latLng.lng });
        });

        try {
            await fetch(`/api/routes/${routeType}/${selectedRouteId}/stops`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stops })
            });
            alert('Stops saved successfully!');
        } catch (error) {
            console.error('Failed to save stops:', error);
            alert('Failed to save stops.');
        }
    };

    const saveShape = async () => {
        if (!selectedRouteId) return;
        const routeType = routeTypeSelect.value;
        const shape = [];
        shapeLayer.eachLayer(layer => {
            const latLngs = layer.getLatLngs();
            latLngs.forEach(latLng => {
                shape.push({ lat: latLng.lat, lng: latLng.lng });
            });
        });

        try {
            await fetch(`/api/routes/${routeType}/${selectedRouteId}/shape`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shape })
            });
            alert('Shape saved successfully!');
        } catch (error) {
            console.error('Failed to save shape:', error);
            alert('Failed to save shape.');
        }
    };

    map.pm.addControls({
        position: 'topleft',
        drawMarker: true,
        drawPolyline: true,
        editMode: true,
        removalMode: true
    });

    map.on('pm:create', e => {
        if (e.shape === 'Marker') {
            e.layer.addTo(stopsLayer);
        }
        if (e.shape === 'Line') {
            shapeLayer.clearLayers();
            e.layer.addTo(shapeLayer);
        }
    });

    routeTypeSelect.addEventListener('change', fetchRoutes);
    routeSelect.addEventListener('change', fetchRouteData);
    saveStopsBtn.addEventListener('click', saveStops);
    saveShapeBtn.addEventListener('click', saveShape);

    // Initial fetch
    fetchRoutes();
});