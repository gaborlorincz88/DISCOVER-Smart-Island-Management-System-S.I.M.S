document.addEventListener('DOMContentLoaded', async () => {
    const editPlaceForm = document.getElementById('edit-place-form');
    const placeIdInput = document.getElementById('place-id');
    const nameInput = document.getElementById('name');
    const descriptionInput = document.getElementById('description');
    const latitudeInput = document.getElementById('latitude');
    const longitudeInput = document.getElementById('longitude');
    const websiteInput = document.getElementById('website');
    const customPinInput = document.getElementById('custom_pin');
    const isDefaultInput = document.getElementById('is_default');
    const existingImagesInput = document.getElementById('existing-images');
    const existingIconInput = document.getElementById('existing-icon');
    const iconSizeInput = document.getElementById('iconSize');
    const existingImagesContainer = document.getElementById('existing-images-container');
    const existingIconContainer = document.getElementById('existing-icon-container');
    const mapContainer = document.getElementById('map');

    const urlParams = new URLSearchParams(window.location.search);
    const placeId = urlParams.get('id');

    let map;
    let marker;

    if (placeId) {
        const response = await fetch(`/api/places/${placeId}`);
        const place = await response.json();

        placeIdInput.value = place.id;
        nameInput.value = place.name || '';
        descriptionInput.value = place.description || '';
        latitudeInput.value = place.latitude;
        longitudeInput.value = place.longitude;
        websiteInput.value = place.website || '';
        customPinInput.value = place.custom_pin || '';
        isDefaultInput.checked = place.is_default || false;
        
        // Set category (required field)
        const categoryInput = document.getElementById('category');
        if (categoryInput) {
            categoryInput.value = place.category || '';
        }
        
        // Handle images
        const imageUrls = place.image_urls || [];
        if (Array.isArray(imageUrls) && imageUrls.length > 0) {
            existingImagesInput.value = JSON.stringify(imageUrls);
            // Display existing images
            existingImagesContainer.innerHTML = imageUrls.map((url, index) => 
                `<div style="margin: 0.5rem 0; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                    <img src="${url}" alt="Image ${index + 1}" style="max-width: 200px; max-height: 150px; display: block; margin-bottom: 0.5rem;">
                    <small style="color: #666; word-break: break-all;">${url}</small>
                </div>`
            ).join('');
        } else {
            existingImagesInput.value = JSON.stringify([]);
            existingImagesContainer.innerHTML = '<p style="color: #666; font-style: italic;">No images currently</p>';
        }
        
        // Handle custom icon
        if (place.icon) {
            existingIconInput.value = place.icon;
            existingIconContainer.innerHTML = `
                <div style="margin: 0.5rem 0; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                    <img src="${place.icon}" alt="Custom Icon" style="max-width: 64px; max-height: 64px; display: block; margin-bottom: 0.5rem;">
                    <small style="color: #666; word-break: break-all;">${place.icon}</small>
                </div>
            `;
        } else {
            existingIconInput.value = '';
            existingIconContainer.innerHTML = '<p style="color: #666; font-style: italic;">No custom icon</p>';
        }
        
        // Handle icon size
        if (place.iconSize) {
            iconSizeInput.value = place.iconSize;
        }

        initializeMap(place.latitude, place.longitude);
    } else {
        // Initialize empty values for new place
        existingImagesInput.value = JSON.stringify([]);
        existingIconInput.value = '';
        initializeMap(36.04, 14.25); // Default to Gozo
    }

    function initializeMap(lat, lng) {
        map = L.map(mapContainer).setView([lat, lng], 13);
        // Add cache-busting parameter to tile URLs to prevent stale cache issues
        const cacheBuster = new Date().getTime();
        
        L.tileLayer('/tiles/gozo/{z}/{x}/{y}.png?v=' + cacheBuster, {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
            errorTileUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' // Fallback
        }).addTo(map);
        marker = L.marker([lat, lng], { draggable: true }).addTo(map);

        marker.on('dragend', (event) => {
            const position = marker.getLatLng();
            latitudeInput.value = position.lat;
            longitudeInput.value = position.lng;
        });
    }

    editPlaceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(editPlaceForm);
        const url = placeId ? `/admin/places/${placeId}` : '/admin/places';
        const method = placeId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            body: formData,
        });

        if (response.ok) {
            window.location.href = 'places.html';
        } else {
            const result = await response.json();
            alert(`Error: ${result.error}`);
        }
    });
});
