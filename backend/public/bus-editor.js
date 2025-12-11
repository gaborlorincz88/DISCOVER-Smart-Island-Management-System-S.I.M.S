// --- Global Notification System ---
let notificationTimeout;
let notificationDiv;

const showNotification = (message, type = 'info') => {
    if (!notificationDiv) {
        notificationDiv = document.createElement('div');
        notificationDiv.id = 'notification-popup';
        document.body.appendChild(notificationDiv);
    }
    
    clearTimeout(notificationTimeout);
    notificationDiv.textContent = message;
    notificationDiv.className = `notification-popup ${type}`;
    notificationDiv.style.display = 'block';
    notificationDiv.style.opacity = '1';

    notificationTimeout = setTimeout(() => {
        notificationDiv.style.opacity = '0';
        notificationDiv.addEventListener('transitionend', function handler() {
            notificationDiv.style.display = 'none';
            notificationDiv.removeEventListener('transitionend', handler);
        }, { once: true });
    }, 3000);
};

// --- Global Route List Refresh Function ---
const refreshRouteList = async () => {
    try {
        const response = await fetch('/api/bus-routes');
        const routes = await response.json();
        const routeSelector = document.getElementById('route-selector');
        
        if (routeSelector) {
            routeSelector.innerHTML = '<option value="">Select a route...</option>';
            routes.forEach(route => {
                const option = document.createElement('option');
                option.value = route.id;
                option.textContent = route.name;
                routeSelector.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error refreshing route list:', error);
        showNotification('Error refreshing route list', 'error');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const map = L.map('map').setView([36.045, 14.26], 13);
    
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

    // --- DOM Elements ---
    const routeSelector = document.getElementById('route-selector');
    const saveBtn = document.getElementById('save-route-btn');
    const clearBtn = document.getElementById('clear-route-btn');
    const stopsList = document.getElementById('stops-list');
    const modeStopBtn = document.getElementById('mode-stop');
    const modeShapeBtn = document.getElementById('mode-shape');
    const modal = document.getElementById('stop-editor-modal');
    const stopForm = document.getElementById('stop-form');
    const cancelStopEditBtn = document.getElementById('cancel-stop-edit-btn');
    
    // Route image elements
    const routeMainImageInput = document.getElementById('route-main-image');
    const routeImagePreview = document.getElementById('route-image-preview');
    const routeImagePreviewContainer = document.getElementById('route-image-preview-container');
    const removeRouteImageBtn = document.getElementById('remove-route-image-btn');
    const existingRouteImageInput = document.getElementById('existing-route-image');

    // --- State ---
    let currentRouteId = null;
    let currentRouteName = null; // Store the route name
    let points = [];
    let routePolyline = null;
    let pointMarkers = [];
    let editMode = 'stop';
    let currentlyEditingPointIndex = -1;

    // --- Route Image Preview ---
    routeMainImageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                routeImagePreview.src = e.target.result;
                routeImagePreviewContainer.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });
    
    removeRouteImageBtn.addEventListener('click', () => {
        routeMainImageInput.value = '';
        routeImagePreview.src = '';
        routeImagePreviewContainer.style.display = 'none';
        existingRouteImageInput.value = '';
    });
    
    // --- Handle Image Selection from Gallery ---
    routeMainImageInput.addEventListener('imageSelectedFromGallery', (e) => {
        const selectedImage = e.detail;
        console.log('Route main image selected from gallery:', selectedImage);
        
        // Set preview
        routeImagePreview.src = selectedImage.path;
        routeImagePreviewContainer.style.display = 'block';
        
        // Set as existing image (don't upload again)
        existingRouteImageInput.value = selectedImage.path;
        
        // Clear the file input
        routeMainImageInput.value = '';
    });

    // --- Mode & Modal ---
    modeStopBtn.addEventListener('click', () => {
        editMode = 'stop';
        modeStopBtn.classList.add('active');
        modeShapeBtn.classList.remove('active');
    });
    modeShapeBtn.addEventListener('click', () => {
        editMode = 'shape';
        modeShapeBtn.classList.add('active');
        modeStopBtn.classList.remove('active');
    });

    const openStopModal = (pointIndex) => {
        currentlyEditingPointIndex = pointIndex;
        const point = points[pointIndex];
        
        document.getElementById('stop-id').value = point.id || '';
        document.getElementById('stop-name').value = point.name;
        document.getElementById('stop-description').value = point.description || '';
        
        // TODO: Populate existing images preview
        
        modal.style.display = 'flex';
    };

    const closeStopModal = () => {
        modal.style.display = 'none';
        stopForm.reset();
        currentlyEditingPointIndex = -1;
    };

    // --- Data & Rendering ---
    const loadRoutes = async () => {
        try {
            const response = await fetch('/api/bus-routes');
            const routes = await response.json();
            routeSelector.innerHTML = '<option value="">Select a route...</option>';
            routes.forEach(route => {
                const option = document.createElement('option');
                option.value = route.id;
                option.textContent = route.name;
                routeSelector.appendChild(option);
            });
        } catch (error) { console.error('Failed to load bus routes:', error); }
    };

    const render = () => {
        stopsList.innerHTML = '';
        pointMarkers.forEach(marker => marker.remove());
        pointMarkers = [];
        if (routePolyline) routePolyline.remove();

        points.forEach((point, index) => {
            const isStop = point.type === 'stop';
            
            // Create a square container for each point
            const pointContainer = document.createElement('div');
            pointContainer.className = 'point-container';
            pointContainer.setAttribute('draggable', 'true');
            pointContainer.setAttribute('data-index', index);
            
            // Create the point content
            const pointContent = document.createElement('div');
            pointContent.className = 'point-content';
            
            // Point number and name/type
            const pointInfo = document.createElement('div');
            pointInfo.className = 'point-info';
            pointInfo.innerHTML = `<span class="point-number">${index + 1}</span><span class="point-text">${isStop ? point.name : '(Shape Point)'}</span>`;
            pointContent.appendChild(pointInfo);
            
            // Buttons container
            const buttonsContainer = document.createElement('div');
            buttonsContainer.className = 'point-buttons';
            
            if (isStop) {
                const editBtn = document.createElement('button');
                editBtn.innerHTML = '✏️';
                editBtn.className = 'edit-stop-btn';
                editBtn.onclick = () => openStopModal(index);
                buttonsContainer.appendChild(editBtn);
            }

            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '✖';
            removeBtn.className = 'remove-stop-btn';
            removeBtn.onclick = () => removePoint(index);
            buttonsContainer.appendChild(removeBtn);
            
            pointContent.appendChild(buttonsContainer);
            pointContainer.appendChild(pointContent);
            stopsList.appendChild(pointContainer);

            // Add a '+' button between points
            if (index < points.length - 1) {
                const addShapeContainer = document.createElement('div');
                addShapeContainer.className = 'add-shape-container';
                const addShapeBtn = document.createElement('button');
                addShapeBtn.textContent = '+';
                addShapeBtn.className = 'add-shape-btn';
                addShapeBtn.onclick = () => addShapePointBetween(index);
                addShapeContainer.appendChild(addShapeBtn);
                stopsList.appendChild(addShapeContainer);
            }

            const marker = L.marker([point.lat, point.lng], {
                draggable: true,
                icon: L.divIcon({
                    className: `custom-div-icon ${isStop ? 'stop-marker' : 'shape-marker'}`,
                    html: `<div style="font-size: 20px; text-align: center; line-height: 24px;">${isStop ? '🚏' : '●'}</div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12],
                    className: 'custom-marker'
                })
            }).addTo(map).bindPopup(`${index + 1}. ${isStop ? point.name : '(Shape Point)'}`);
            
            marker.on('dragend', (event) => {
                const newLatLng = event.target.getLatLng();
                points[index].lat = newLatLng.lat;
                points[index].lng = newLatLng.lng;
                render();
            });
            pointMarkers.push(marker);
        });

        const latLngs = points.map(p => [p.lat, p.lng]);
        if (latLngs.length > 1) {
            routePolyline = L.polyline(latLngs, { color: '#1e40af', weight: 8 }).addTo(map);
            routePolyline.on('click', addShapePointOnLine);
        }
    };

    const loadRouteData = async (routeId) => {
        if (!routeId) {
            clearMap();
            return;
        }
        currentRouteId = routeId;
        try {
            const response = await fetch(`/api/bus-routes/${routeId}`, {
                credentials: 'include' // Send cookies for authentication
            });
            if (!response.ok) {
                points = [];
            } else {
                const data = await response.json();
                points = data.points || [];
                currentRouteName = data.name || `Route ${routeId}`; // Store the route name
                
                // Update route ID input if it exists
                const routeIdInput = document.getElementById('route-id-input');
                if (routeIdInput) {
                    routeIdInput.value = routeId;
                    routeIdInput.removeAttribute('readonly'); // Allow editing
                }
                
                // Update route name input if it exists
                const routeNameInput = document.getElementById('route-name-input');
                if (routeNameInput) {
                    routeNameInput.value = currentRouteName;
                }
                
                // Update displayed name input if it exists
                const displayedNameInput = document.getElementById('route-displayed-name-input');
                if (displayedNameInput) {
                    displayedNameInput.value = data.displayedName || '';
                }
                
                // Load route image if exists
                if (data.mainImage) {
                    routeImagePreview.src = data.mainImage;
                    routeImagePreviewContainer.style.display = 'block';
                    existingRouteImageInput.value = data.mainImage;
                } else {
                    routeImagePreview.src = '';
                    routeImagePreviewContainer.style.display = 'none';
                    existingRouteImageInput.value = '';
                }
                routeMainImageInput.value = ''; // Clear file input
            }
            render();
            if (points.length > 0) {
                map.fitBounds(L.polyline(points.map(p => [p.lat, p.lng])).getBounds(), { padding: [50, 50] });
            }
        } catch (error) {
            console.error(`Failed to load route ${routeId}:`, error);
        }
    };

    // --- Drag and Drop Logic ---
    let draggedIndex = null;

    stopsList.addEventListener('dragstart', (e) => {
        const targetDiv = e.target.closest('div[draggable="true"]');
        if (targetDiv) {
            draggedIndex = parseInt(targetDiv.dataset.index, 10);
            e.dataTransfer.effectAllowed = 'move';
            // Add a slight delay so the browser can capture the snapshot of the element
            setTimeout(() => {
                targetDiv.classList.add('dragging');
            }, 0);
        }
    });

    stopsList.addEventListener('dragend', (e) => {
        const targetDiv = e.target.closest('div[draggable="true"]');
        if (targetDiv) {
            targetDiv.classList.remove('dragging');
        }
    });

    stopsList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const targetDiv = e.target.closest('div[draggable="true"]');
        if (targetDiv) {
            const allItems = stopsList.querySelectorAll('div[draggable="true"]');
            allItems.forEach(item => item.classList.remove('drag-over'));
            targetDiv.classList.add('drag-over');
        }
    });

    stopsList.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetDiv = e.target.closest('div[draggable="true"]');
        if (targetDiv && draggedIndex !== null) {
            const droppedIndex = parseInt(targetDiv.dataset.index, 10);
            
            // Reorder the array
            const [draggedItem] = points.splice(draggedIndex, 1);
            points.splice(droppedIndex, 0, draggedItem);

            // Clean up
            const allItems = stopsList.querySelectorAll('div[draggable="true"]');
            allItems.forEach(item => item.classList.remove('drag-over'));
            draggedIndex = null;

            // Re-render everything
            render();
        }
    });
    
    // --- Actions ---
    const addPointOnMapClick = (e) => {
        const clickedLatLng = e.latlng;
        let newPoint = {
            id: `stop_${Date.now()}`, // Give it a temporary unique ID
            lat: clickedLatLng.lat,
            lng: clickedLatLng.lng,
            type: editMode,
            name: ''
        };

        if (editMode === 'stop') {
            const stopName = prompt('Enter the name for this stop:');
            if (!stopName) return; // User cancelled
            newPoint.name = stopName;

            let insertIndex = points.length; // Default to end if no suitable segment found or no points yet

            if (points.length > 0) { // Only calculate bestIndex if there are existing points
                let bestIndex = -1, minDistance = Infinity;
                for (let i = 0; i < points.length - 1; i++) {
                    const start = map.latLngToLayerPoint(L.latLng(points[i].lat, points[i].lng));
                    const end = map.latLngToLayerPoint(L.latLng(points[i+1].lat, points[i+1].lng));
                    const clickedPoint = map.latLngToLayerPoint(clickedLatLng);
                    const distance = L.LineUtil.pointToSegmentDistance(clickedPoint, start, end);
                    if (distance < minDistance) {
                        minDistance = distance;
                        bestIndex = i + 1;
                    }
                }
                if (bestIndex !== -1) {
                    insertIndex = bestIndex;
                }
            }

            points.splice(insertIndex, 0, newPoint);
            render();
            openStopModal(insertIndex); // Open editor for the new stop at its actual index
        } else { // editMode === 'shape'
            points.push(newPoint); // Keep current behavior for shape points when clicking on map directly
            render();
        }
    };

    const addShapePointOnLine = (e) => {
        const clickedLatLng = e.latlng;
        let bestIndex = -1, minDistance = Infinity;
        for (let i = 0; i < points.length - 1; i++) {
            const start = map.latLngToLayerPoint(L.latLng(points[i].lat, points[i].lng));
            const end = map.latLngToLayerPoint(L.latLng(points[i+1].lat, points[i+1].lng));
            const clickedPoint = map.latLngToLayerPoint(clickedLatLng);
            const distance = L.LineUtil.pointToSegmentDistance(clickedPoint, start, end);
            if (distance < minDistance) {
                minDistance = distance;
                bestIndex = i + 1;
            }
        }
        if (bestIndex !== -1) {
            points.splice(bestIndex, 0, {
                id: `shape_${Date.now()}`,
                lat: clickedLatLng.lat,
                lng: clickedLatLng.lng,
                type: 'shape',
                name: ''
            });
            render();
        }
    };

    const addShapePointBetween = (index) => {
        const p1 = points[index];
        const p2 = points[index + 1];
        const midLat = (p1.lat + p2.lat) / 2;
        const midLng = (p1.lng + p2.lng) / 2;

        const newShapePoint = {
            id: `shape_${Date.now()}`,
            lat: midLat,
            lng: midLng,
            type: 'shape',
            name: ''
        };

        points.splice(index + 1, 0, newShapePoint);
        render();
    };

    const removePoint = (index) => {
        if (!confirm(`Are you sure you want to remove this point?`)) return;
        points.splice(index, 1);
        render();
    };

    const clearMap = () => {
        points = [];
        currentRouteId = null;
        routeSelector.value = '';
        render();
    };

    const saveRouteFile = async () => {
        if (!currentRouteId) {
            showNotification('Please select a route before saving.', 'warning');
            return;
        }
        
        let routeMainImageUrl = existingRouteImageInput.value || '';
        
        // Upload route image if a new one is selected
        if (routeMainImageInput.files && routeMainImageInput.files[0]) {
            const formData = new FormData();
            formData.append('image', routeMainImageInput.files[0]);
            
            try {
                const uploadResponse = await fetch('/api/admin/upload-image', {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                });
                
                if (!uploadResponse.ok) {
                    throw new Error('Image upload failed');
                }
                
                const uploadData = await uploadResponse.json();
                routeMainImageUrl = uploadData.imageUrl;
                existingRouteImageInput.value = routeMainImageUrl;
                showNotification('Route image uploaded successfully!', 'success');
            } catch (error) {
                console.error('Failed to upload route image:', error);
                showNotification('Failed to upload route image. Continuing with save...', 'warning');
            }
        }
        
        // Get route name from input if it exists, otherwise use stored name
        const routeNameInput = document.getElementById('route-name-input');
        const routeName = routeNameInput ? routeNameInput.value.trim() : (currentRouteName || `Route ${currentRouteId}`);
        
        // Get displayed name from input if it exists
        const displayedNameInput = document.getElementById('route-displayed-name-input');
        const displayedName = displayedNameInput ? displayedNameInput.value.trim() : '';
        
        // Get route ID from input if it exists (for renaming)
        const routeIdInput = document.getElementById('route-id-input');
        const newRouteId = routeIdInput ? routeIdInput.value.trim() : currentRouteId;
        
        const routeData = {
            id: newRouteId, // Use new ID if changed
            name: routeName,
            displayedName: displayedName || undefined, // Only include if not empty
            mainImage: routeMainImageUrl,
            points: points.map(p => {
                const pointData = { id: p.id, type: p.type, lat: p.lat, lng: p.lng };
                // Include name and description ONLY for stops
                if (p.type === 'stop') {
                    pointData.name = p.name;
                    pointData.description = p.description || ''; // Ensure description is included
                }
                return pointData;
            })
        };
        
        try {
            // If route ID changed, we need to save to new file and delete old one
            if (newRouteId !== currentRouteId) {
                // Save to new file
                const newResponse = await fetch(`/api/bus-routes/${newRouteId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(routeData),
                    credentials: 'include'
                });
                if (!newResponse.ok) throw new Error(`Server responded with ${newResponse.status}`);
                
                // Delete old file
                const deleteResponse = await fetch(`/api/bus-routes/${currentRouteId}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                
                currentRouteId = newRouteId;
                routeSelector.value = newRouteId;
                showNotification(`Route renamed and saved successfully!`, 'success');
            } else {
                // Normal save
                const response = await fetch(`/api/bus-routes/${currentRouteId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(routeData),
                    credentials: 'include'
                });
                if (!response.ok) throw new Error(`Server responded with ${response.status}`);
                showNotification(`Route "${routeName}" saved successfully!`, 'success');
            }
            
            // Refresh route list to get updated name
            await refreshRouteList();
        } catch (error) {
            console.error('Failed to save route file:', error);
            showNotification('An error occurred while saving the route file.', 'error');
        }
    };

    const handleStopFormSubmit = async (e) => {
        e.preventDefault();
        const point = points[currentlyEditingPointIndex];
        const formData = new FormData();
        
        formData.append('id', point.id);
        formData.append('name', document.getElementById('stop-name').value);
        formData.append('description', document.getElementById('stop-description').value);
        formData.append('latitude', point.lat);
        formData.append('longitude', point.lng);
        formData.append('category', 'BUS_STOP'); // Hardcode the category

        const imageInput = document.getElementById('stop-images');
        for (const file of imageInput.files) {
            formData.append('images', file);
        }

        try {
            // This uses the existing /api/places endpoint from admin.js
            const response = await fetch('/api/places', {
                method: 'POST',
                body: formData,
                credentials: 'include' // Send cookies for authentication
            });
            if (!response.ok) throw new Error('Failed to save stop details.');
            
            const savedPlace = await response.json();
            
            // Update the point in our local array with the saved data
            // CRUCIAL: Update the ID from a temporary one to the real one from the database
            points[currentlyEditingPointIndex].id = savedPlace.id;
            points[currentlyEditingPointIndex].name = savedPlace.name;
            points[currentlyEditingPointIndex].description = savedPlace.description;

            showNotification('Bus stop details saved successfully!', 'success');
            closeStopModal();
            render();

        } catch (error) {
            console.error('Error saving stop details:', error);
            showNotification('Error saving stop details.', 'error');
        }
    };

    // --- Initial Setup ---
    map.on('click', addPointOnMapClick);
    routeSelector.addEventListener('change', (e) => loadRouteData(e.target.value));
    saveBtn.addEventListener('click', saveRouteFile);
    clearBtn.addEventListener('click', clearMap);
    stopForm.addEventListener('submit', handleStopFormSubmit);
    cancelStopEditBtn.addEventListener('click', closeStopModal);

    loadRoutes();

    const style = document.createElement('style');
    style.innerHTML = `
        .stop-marker { background-color: rgba(220, 0, 0, 0.8); color: white; text-align: center; line-height: 22px; font-weight: bold; border-radius: 50%; border: 1px solid white; box-shadow: 0 0 5px black; }
        .shape-marker { background-color: rgba(0, 100, 255, 0.7); border-radius: 50%; border: 1px solid white; width: 12px !important; height: 12px !important; margin-left: -6px !important; margin-top: -6px !important; }
        .leaflet-polyline { cursor: crosshair; }
        li[draggable="true"] { cursor: move; user-select: none; }
        li.dragging { opacity: 0.5; background: #f0f0f0; }
        li.drag-over { border-top: 2px solid blue; }
        #notification-popup {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #333;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.5s ease-in-out;
            display: none;
        }
        #notification-popup.success { background-color: #4CAF50; }
        #notification-popup.error { background-color: #f44336; }
        #notification-popup.warning { background-color: #ff9800; }
        #notification-popup.info { background-color: #2196F3; }
    `;
    document.head.appendChild(style);
});

// Create New Route Functionality
document.addEventListener('DOMContentLoaded', () => {
    const createNewRouteBtn = document.getElementById('create-new-route-btn');
    const deleteRouteBtn = document.getElementById('delete-route-btn');
    const routeSelector = document.getElementById('route-selector');
    
    if (createNewRouteBtn) {
        createNewRouteBtn.addEventListener('click', showCreateRouteModal);
    }
    
    if (deleteRouteBtn) {
        deleteRouteBtn.addEventListener('click', showDeleteRouteModal);
    }
    
    // Enable/disable delete button based on route selection
    if (routeSelector) {
        routeSelector.addEventListener('change', () => {
            if (deleteRouteBtn) {
                deleteRouteBtn.disabled = !routeSelector.value;
            }
        });
    }
    
    // --- Enhance image inputs with gallery selection ---
    if (typeof enhanceImageInputWithGallery === 'function') {
        // Route main image
        const routeMainImageInput = document.getElementById('route-main-image');
        const routeImagePreview = document.getElementById('route-image-preview');
        if (routeMainImageInput && !routeMainImageInput.dataset.galleryEnhanced) {
            enhanceImageInputWithGallery(routeMainImageInput, routeImagePreview, false);
            routeMainImageInput.dataset.galleryEnhanced = 'true';
        }
        
        // New route image in create modal
        const newRouteImageInput = document.getElementById('new-route-image');
        if (newRouteImageInput && !newRouteImageInput.dataset.galleryEnhanced) {
            enhanceImageInputWithGallery(newRouteImageInput, null, false);
            newRouteImageInput.dataset.galleryEnhanced = 'true';
        }
        
        // Note: Stop images input is auto-enhanced by image-gallery-modal.js, so we don't enhance it here
        
        // Add event listener for new route image gallery selection
        if (newRouteImageInput) {
            newRouteImageInput.addEventListener('imageSelectedFromGallery', (e) => {
                const selectedImage = e.detail;
                console.log('New route image selected from gallery:', selectedImage);
                
                // Store the selected image path
                newRouteImageInput.dataset.selectedImagePath = selectedImage.path;
            });
        }
        
        // Add event listener for stop images gallery selection (handled by auto-enhancement)
        const stopImagesInput = document.getElementById('stop-images');
        if (stopImagesInput) {
            stopImagesInput.addEventListener('imageSelectedFromGallery', (e) => {
                const selectedImage = e.detail;
                console.log('Stop image selected from gallery:', selectedImage);
                
                // Store the selected image path
                stopImagesInput.dataset.selectedImagePath = selectedImage.path;
            });
        }
    }
});

function showCreateRouteModal() {
    const modal = document.getElementById('create-route-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('show');
        // Clear form
        document.getElementById('create-route-form').reset();
        
        // Clear any selected images from gallery
        const newRouteImageInput = document.getElementById('new-route-image');
        if (newRouteImageInput) {
            delete newRouteImageInput.dataset.selectedImagePath;
        }
    }
}

function closeCreateRouteModal() {
    const modal = document.getElementById('create-route-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}

async function createNewRoute() {
    const routeId = document.getElementById('new-route-id').value.trim();
    const routeName = document.getElementById('new-route-name').value.trim();
    const description = document.getElementById('new-route-description').value.trim();
    const imageInput = document.getElementById('new-route-image');
    
    // Validation
    if (!routeId || !routeName) {
        showNotification('Please fill in all required fields.', 'warning');
        return;
    }
    
    // Validate route ID format (should be like: 401-victoria-xlendi or 401-victoria-victoria)
    const routeIdPattern = /^\d{3}-[a-z]+-[a-z]+$/;
    if (!routeIdPattern.test(routeId)) {
        showNotification('Route ID must follow format: number-from-to (e.g., 402-victoria-xlendi)', 'warning');
        return;
    }
    
    // Check if route already exists
    try {
        const checkResponse = await fetch(`/api/bus-routes/${routeId}`);
        if (checkResponse.ok) {
            showNotification('A route with this ID already exists. Please choose a different ID.', 'warning');
            return;
        }
    } catch (error) {
        // Route doesn't exist, which is what we want
    }
    
    // Upload image if provided, or use selected image from gallery
    let imageUrl = '';
    
    // Check if an image was selected from gallery
    if (imageInput.dataset.selectedImagePath) {
        imageUrl = imageInput.dataset.selectedImagePath;
        console.log('Using image from gallery:', imageUrl);
    } else if (imageInput.files && imageInput.files[0]) {
        // Upload new image
        const formData = new FormData();
        formData.append('image', imageInput.files[0]);
        
        try {
            const uploadResponse = await fetch('/api/admin/upload-image', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            
            if (!uploadResponse.ok) {
                throw new Error('Image upload failed');
            }
            
            const uploadData = await uploadResponse.json();
            imageUrl = uploadData.imageUrl;
            showNotification('Route image uploaded successfully!', 'success');
        } catch (error) {
            console.error('Failed to upload route image:', error);
            showNotification('Failed to upload route image. Creating route without image...', 'warning');
        }
    }
    
    // Create new route data structure
    const newRouteData = {
        id: routeId,
        name: routeName,
        mainImage: imageUrl,
        points: [] // Start with empty points array
    };
    
    // Add description if provided
    if (description) {
        newRouteData.description = description;
    }
    
    try {
        const response = await fetch(`/api/bus-routes/${routeId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newRouteData)
        });
        
        if (response.ok) {
            showNotification(`Route "${routeName}" created successfully!`, 'success');
            closeCreateRouteModal();
            
            // Clear the image input
            imageInput.value = '';
            
            // Refresh the route list
            await refreshRouteList();
            
            // Select the new route
            const routeSelector = document.getElementById('route-selector');
            if (routeSelector) {
                routeSelector.value = routeId;
                routeSelector.dispatchEvent(new Event('change'));
            }
        } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('API Error:', errorData);
            showNotification(`Failed to create route: ${errorData.error || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        console.error('Error creating route:', error);
        showNotification('An error occurred while creating the route.', 'error');
    }
}

// Delete Route Functionality
let deleteConfirmationStep = 1;
let routeToDelete = null;

function showDeleteRouteModal() {
    const routeSelector = document.getElementById('route-selector');
    if (!routeSelector.value) {
        showNotification('Please select a route to delete.', 'warning');
        return;
    }
    
    routeToDelete = {
        id: routeSelector.value,
        name: routeSelector.options[routeSelector.selectedIndex].text
    };
    
    const modal = document.getElementById('delete-route-modal');
    if (modal) {
        // Reset to step 1
        deleteConfirmationStep = 1;
        document.getElementById('delete-confirmation-step-1').style.display = 'block';
        document.getElementById('delete-confirmation-step-2').style.display = 'none';
        document.getElementById('delete-route-name-1').textContent = routeToDelete.name;
        document.getElementById('delete-route-name-2').textContent = routeToDelete.name;
        document.getElementById('delete-confirmation-input').value = '';
        
        modal.style.display = 'flex';
        modal.classList.add('show');
    }
}

function closeDeleteRouteModal() {
    const modal = document.getElementById('delete-route-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
    deleteConfirmationStep = 1;
    routeToDelete = null;
}

function confirmDeleteRoute() {
    if (deleteConfirmationStep === 1) {
        // First confirmation - show second step
        deleteConfirmationStep = 2;
        document.getElementById('delete-confirmation-step-1').style.display = 'none';
        document.getElementById('delete-confirmation-step-2').style.display = 'block';
        
        // Focus on the input field
        setTimeout(() => {
            document.getElementById('delete-confirmation-input').focus();
        }, 100);
        
        return;
    }
    
    if (deleteConfirmationStep === 2) {
        // Second confirmation - check if user typed "DELETE"
        const confirmationInput = document.getElementById('delete-confirmation-input');
        if (confirmationInput.value.trim() !== 'DELETE') {
            showNotification('Please type "DELETE" exactly to confirm deletion.', 'warning');
            confirmationInput.focus();
            return;
        }
        
        // Proceed with deletion
        performRouteDeletion();
    }
}

async function performRouteDeletion() {
    if (!routeToDelete) {
        showNotification('No route selected for deletion.', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/bus-routes/${routeToDelete.id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification(`Route "${routeToDelete.name}" deleted successfully!`, 'success');
            closeDeleteRouteModal();
            
            // Refresh the route list
            await refreshRouteList();
            
            // Clear the map
            if (typeof clearMap === 'function') {
                clearMap();
            }
            
            // Reset route selector
            const routeSelector = document.getElementById('route-selector');
            if (routeSelector) {
                routeSelector.value = '';
            }
        } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            showNotification(`Failed to delete route: ${errorData.error || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        console.error('Error deleting route:', error);
        showNotification('An error occurred while deleting the route.', 'error');
    }
}

// Close modals when clicking outside
window.addEventListener('click', (event) => {
    const createModal = document.getElementById('create-route-modal');
    const deleteModal = document.getElementById('delete-route-modal');
    
    if (event.target === createModal) {
        closeCreateRouteModal();
    }
    if (event.target === deleteModal) {
        closeDeleteRouteModal();
    }
});