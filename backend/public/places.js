document.addEventListener('DOMContentLoaded', async () => {
    const placesList = document.getElementById('places-list');
    const editPlaceCard = document.getElementById('edit-place-card');
    const editPlaceForm = document.getElementById('edit-place-form');
    const mapContainer = document.getElementById('map');

    let map;
    const markers = {};
    let places = [];

    // Initialize Map
    map = L.map(mapContainer).setView([36.04, 14.25], 13);
    
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

    // Fetch Places
    const response = await fetch('/api/places');
    places = await response.json();
    renderPlacesList();
    renderMapMarkers();

    function renderPlacesList() {
        placesList.innerHTML = '';
        places.forEach(place => {
            const item = document.createElement('div');
            item.className = 'place-item';
            item.textContent = place.name;
            item.dataset.id = place.id;
            item.addEventListener('click', () => selectPlace(place));
            placesList.appendChild(item);
        });
    }

    function renderMapMarkers() {
        places.forEach(place => {
            const marker = L.marker([place.latitude, place.longitude]).addTo(map);
            marker.on('click', () => selectPlace(place));
            markers[place.id] = marker;
        });
    }

    function selectPlace(place) {
        // Highlight selected item in list
        document.querySelectorAll('.place-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.id == place.id);
        });

        // Get full place details including images and icon
        fetch(`/api/places/${place.id}`)
            .then(response => response.json())
            .then(fullPlace => {
                // Parse image_urls if it's a string
                const imageUrls = Array.isArray(fullPlace.image_urls) 
                    ? fullPlace.image_urls 
                    : (fullPlace.image_urls ? JSON.parse(fullPlace.image_urls) : []);
                
                // Build existing images display
                let existingImagesHtml = '';
                if (imageUrls.length > 0) {
                    existingImagesHtml = `
                        <label>Existing Images:</label>
                        <div style="margin-bottom: 1rem; max-height: 200px; overflow-y: auto;">
                            ${imageUrls.map((url, index) => 
                                `<div style="margin: 0.5rem 0; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                                    <img src="${url}" alt="Image ${index + 1}" style="max-width: 150px; max-height: 100px; display: block;">
                                </div>`
                            ).join('')}
                        </div>
                    `;
                }
                
                // Build existing icon display
                let existingIconHtml = '';
                if (fullPlace.icon) {
                    existingIconHtml = `
                        <label>Current Custom Icon:</label>
                        <div style="margin-bottom: 1rem;">
                            <img src="${fullPlace.icon}" alt="Custom Icon" style="max-width: 48px; max-height: 48px; display: block;">
                        </div>
                    `;
                }

        // Show and populate the edit form
        editPlaceCard.style.display = 'block';
        editPlaceForm.innerHTML = `
            <input type="hidden" name="id" value="${fullPlace.id}">
            <input type="hidden" name="category" value="${fullPlace.category || ''}">
            <label for="name">Name:</label>
            <input type="text" name="name" value="${fullPlace.name || ''}" required>
            <label for="description">Description:</label>
            <textarea name="description">${fullPlace.description || ''}</textarea>
            <label for="latitude">Latitude:</label>
            <input type="number" name="latitude" value="${fullPlace.latitude}" step="any" required>
            <label for="longitude">Longitude:</label>
            <input type="number" name="longitude" value="${fullPlace.longitude}" step="any" required>
            <label for="website">Website:</label>
            <input type="url" name="website" value="${fullPlace.website || ''}">
            ${existingImagesHtml}
            <input type="hidden" name="existingImages" value='${JSON.stringify(imageUrls)}'>
            <label for="images">Upload New Images:</label>
            <input type="file" id="images" name="images" multiple accept="image/*">
            ${existingIconHtml}
            <input type="hidden" name="existingIcon" value="${fullPlace.icon || ''}">
            <label for="icon">Upload New Custom Icon:</label>
            <input type="file" id="icon" name="icon" accept="image/*">
            <label for="iconSize">Icon Size:</label>
            <input type="number" name="iconSize" value="${fullPlace.iconSize || 32}" min="16" max="128">
            <label for="custom_pin">Custom Pin:</label>
            <input type="text" name="custom_pin" value="${fullPlace.custom_pin || ''}">
            <label>
                <input type="checkbox" name="is_default" ${fullPlace.is_default ? 'checked' : ''}>
                Show on map by default
            </label>
            <button type="submit">Save Place</button>
            <p style="margin-top: 1rem; color: #666; font-size: 0.9em;">
                <strong>Note:</strong> For full editing with image management, 
                <a href="edit-place.html?id=${fullPlace.id}" style="color: #007bff;">open in full editor</a>
            </p>
        `;

        // Pan map to the selected place
        map.panTo([fullPlace.latitude, fullPlace.longitude]);
            })
            .catch(error => {
                console.error('Error loading place details:', error);
                alert('Error loading place details. Please try again.');
            });
    }

    editPlaceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(editPlaceForm);
        const id = formData.get('id');
        const url = `/admin/places/${id}`;
        
        // Check if there are file inputs with files
        const imagesInput = editPlaceForm.querySelector('input[name="images"]');
        const iconInput = editPlaceForm.querySelector('input[name="icon"]');
        const hasFiles = (imagesInput && imagesInput.files.length > 0) || (iconInput && iconInput.files.length > 0);
        
        const response = await fetch(url, {
            method: 'PUT',
            body: formData, // Use FormData to support file uploads
            credentials: 'include' // Send cookies for authentication
        });

        if (response.ok) {
            alert('Place updated successfully!');
            // Refresh data
            const updatedPlace = await response.json();
            places = places.map(p => p.id == id ? updatedPlace : p);
            renderPlacesList();
            // Update marker position if coordinates changed
            if (markers[id]) {
                map.removeLayer(markers[id]);
                const marker = L.marker([updatedPlace.latitude, updatedPlace.longitude]).addTo(map);
                marker.on('click', () => selectPlace(updatedPlace));
                markers[id] = marker;
            }
        } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            alert(`Error updating place: ${errorData.error || 'Unknown error'}`);
        }
    });
});
