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

    // --- Notification System ---
    let notificationTimeout;
    const notificationDiv = document.createElement('div');
    notificationDiv.id = 'notification-popup';
    document.body.appendChild(notificationDiv);

    const showNotification = (message, type = 'info') => {
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

    // --- DOM Elements ---
    const routeTypeSelector = document.getElementById('route-type-selector');
    const routeSelector = document.getElementById('route-selector');
    const newRouteNameInput = document.getElementById('new-route-name');
    const createRouteBtn = document.getElementById('create-route-btn');
    const saveBtn = document.getElementById('save-route-btn');
    const clearBtn = document.getElementById('clear-route-btn');
    const deleteBtn = document.getElementById('delete-route-btn');
    const stopsList = document.getElementById('stops-list');
    const modeStopBtn = document.getElementById('mode-stop');
    const modeShapeBtn = document.getElementById('mode-shape');
    const modal = document.getElementById('stop-editor-modal');
    const stopForm = document.getElementById('stop-form');
    const cancelStopEditBtn = document.getElementById('cancel-stop-edit-btn');
    
    // Tour icon elements
    const tourIconSelector = document.getElementById('tour-icon-selector');
    const tourIconInput = document.getElementById('tour-icon');
    const tourIconPreview = document.getElementById('tour-icon-preview');
    const tourIconPreviewContainer = document.getElementById('tour-icon-preview-container');
    const removeTourIconBtn = document.getElementById('remove-tour-icon-btn');
    const existingTourIconInput = document.getElementById('existing-tour-icon');
    const tourIconSizeSlider = document.getElementById('tour-icon-size');
    const tourIconSizeValue = document.getElementById('tour-icon-size-value');
    const tourDescriptionInput = document.getElementById('tour-description');
    const tourPolylineColorInput = document.getElementById('tour-polyline-color');
    console.log('Color input element found:', tourPolylineColorInput);
    // Pricing & details inputs
    const tourCurrencyInput = document.getElementById('tour-currency');
    const priceAdultInput = document.getElementById('price-adult');
    const priceChildInput = document.getElementById('price-child');
    const priceSeniorInput = document.getElementById('price-senior');
    const tourDurationInput = document.getElementById('tour-duration');
    const tourMaxParticipantsInput = document.getElementById('tour-max-participants');
    const tourImportantInfoInput = document.getElementById('tour-important-info');
    
    // Tour main image elements
    const tourMainImageInput = document.getElementById('tour-main-image');
    const tourMainImagePreview = document.getElementById('tour-main-image-preview');
    const tourMainImagePreviewContainer = document.getElementById('tour-main-image-preview-container');
    const removeTourMainImageBtn = document.getElementById('remove-tour-main-image-btn');
    const existingTourMainImageInput = document.getElementById('existing-tour-main-image');

    // --- State ---
    let currentRouteId = null;
    let currentRouteType = routeTypeSelector.value;
    let points = [];
    let routePolyline = null;
    let pointMarkers = [];
    let editMode = 'stop';
    let currentlyEditingPointIndex = -1;
    let trailCoordinates = []; // For hiking trails - stores the actual trail path
    let tourIconFile = null;
    let tourIconUrl = '/tours.svg';
    let tourIconSize = 32;
    let tourDescription = '';
    let tourPolylineColor = '#8A2BE2';
    let tourMainImageFile = null;
    let tourMainImageUrl = '';
    // Pricing & details state
    let tourCurrency = 'EUR';
    let tourPrices = { adult: null, child: null, senior: null };
    let tourDuration = '';
    let tourMaxParticipants = null;
    let tourImportantInfo = '';

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
    
    // --- Tour Icon Handling ---
    tourIconSelector.addEventListener('change', (e) => {
        const selectedIcon = e.target.value;
        if (selectedIcon) {
            // Clear any custom uploaded icon
            tourIconFile = null;
            tourIconInput.value = '';
            
            // Set the emoji icon
            tourIconUrl = selectedIcon;
            tourIconPreview.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><text x="16" y="20" font-size="24" text-anchor="middle" font-family="Arial, sans-serif">${selectedIcon}</text></svg>`;
            tourIconPreviewContainer.style.display = 'block';
            
            // Reset selector to show placeholder
            setTimeout(() => {
                tourIconSelector.value = '';
            }, 100);
        }
    });
    
    tourIconInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            tourIconFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                tourIconUrl = e.target.result;
                tourIconPreview.src = tourIconUrl;
                tourIconPreviewContainer.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });
    
    removeTourIconBtn.addEventListener('click', () => {
        tourIconFile = null;
        tourIconUrl = '/tours.svg';
        tourIconInput.value = '';
        tourIconPreviewContainer.style.display = 'none';
    });
    
    tourIconSizeSlider.addEventListener('input', (e) => {
        tourIconSize = parseInt(e.target.value);
        tourIconSizeValue.textContent = tourIconSize;
    });
    
    // Handle tour description input
    tourDescriptionInput.addEventListener('input', (e) => {
        tourDescription = e.target.value;
    });

    // Pricing & details handlers
    tourCurrencyInput.addEventListener('change', (e) => {
        tourCurrency = e.target.value || 'EUR';
    });
    priceAdultInput.addEventListener('input', (e) => {
        const v = e.target.value;
        tourPrices.adult = v === '' ? null : parseFloat(v);
    });
    priceChildInput.addEventListener('input', (e) => {
        const v = e.target.value;
        tourPrices.child = v === '' ? null : parseFloat(v);
    });
    priceSeniorInput.addEventListener('input', (e) => {
        const v = e.target.value;
        tourPrices.senior = v === '' ? null : parseFloat(v);
    });
    tourDurationInput.addEventListener('input', (e) => {
        tourDuration = e.target.value;
    });
    tourMaxParticipantsInput.addEventListener('input', (e) => {
        const v = e.target.value;
        tourMaxParticipants = v === '' ? null : parseInt(v);
    });
    tourImportantInfoInput.addEventListener('input', (e) => {
        tourImportantInfo = e.target.value;
    });
    
    // Handle tour polyline color input
    tourPolylineColorInput.addEventListener('input', (e) => {
        tourPolylineColor = e.target.value;
        console.log('Polyline color changed to:', tourPolylineColor);
        
        // Update the color preview
        const colorPreview = document.getElementById('color-preview');
        if (colorPreview) {
            colorPreview.style.backgroundColor = tourPolylineColor;
        }
        
        // Update the polyline color on the map if it exists
        if (routePolyline) {
            routePolyline.setStyle({ color: tourPolylineColor });
            console.log('Updated existing polyline color');
        } else {
            console.log('No polyline exists yet, color will be applied when polyline is created');
        }
    });
    
    // --- Tour Main Image Handling ---
    tourMainImageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            tourMainImageFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                tourMainImageUrl = e.target.result;
                tourMainImagePreview.src = tourMainImageUrl;
                tourMainImagePreviewContainer.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });
    
    removeTourMainImageBtn.addEventListener('click', () => {
        tourMainImageFile = null;
        tourMainImageUrl = '';
        tourMainImageInput.value = '';
        tourMainImagePreviewContainer.style.display = 'none';
    });

    const openStopModal = (pointIndex) => {
        currentlyEditingPointIndex = pointIndex;
        const point = points[pointIndex];
        
        // Store the array index in stop-id for easy retrieval
        document.getElementById('stop-id').value = pointIndex;
        document.getElementById('stop-name').value = point.name;
        document.getElementById('stop-description').value = point.description || '';
        
        // Populate existing images preview
        const existingImagesContainer = document.getElementById('existing-stop-images-preview');
        existingImagesContainer.innerHTML = '';
        
        if (point.images && point.images.length > 0) {
            point.images.forEach((image, index) => {
                const imgContainer = document.createElement('div');
                imgContainer.className = 'relative group';
                
                const img = document.createElement('img');
                img.src = image;
                img.alt = `Image ${index + 1}`;
                img.className = 'w-full h-20 object-cover rounded-md';
                
                const removeBtn = document.createElement('button');
                removeBtn.innerHTML = '✖';
                removeBtn.className = 'absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-600';
                removeBtn.onclick = () => removeStopImage(pointIndex, index);
                
                imgContainer.appendChild(img);
                imgContainer.appendChild(removeBtn);
                existingImagesContainer.appendChild(imgContainer);
            });
        } else {
            existingImagesContainer.innerHTML = '<div class="text-sm text-gray-500 italic">No images uploaded yet</div>';
        }
        
        modal.style.display = 'flex';
    };

    const closeStopModal = () => {
        modal.style.display = 'none';
        stopForm.reset();
        currentlyEditingPointIndex = -1;
    };

    const removeStopImage = (pointIndex, imageIndex) => {
        if (points[pointIndex] && points[pointIndex].images) {
            points[pointIndex].images.splice(imageIndex, 1);
            // Refresh the modal to show updated images
            openStopModal(pointIndex);
        }
    };

    // --- Data & Rendering ---
    const loadCategories = async () => {
        try {
            const response = await fetch('/api/tour-categories', {
                credentials: 'include' // Send cookies for authentication
            });
            const categories = await response.json();
            
            // Clear existing options
            routeTypeSelector.innerHTML = '';
            
            // Add categories to selector
            categories.forEach(category => {
                if (category.active) {
                    const option = document.createElement('option');
                    option.value = category.id;
                    option.textContent = category.name;
                    routeTypeSelector.appendChild(option);
                }
            });
            
            // Set default selection
            if (routeTypeSelector.options.length > 0) {
                routeTypeSelector.value = routeTypeSelector.options[0].value;
                currentRouteType = routeTypeSelector.value;
            }
        } catch (error) { 
            console.error('Failed to load categories:', error);
            // Fallback to hardcoded options if API fails
            routeTypeSelector.innerHTML = `
                <option value="sightseeing">Sightseeing</option>
                <option value="boat-tour">Boat Tours</option>
                <option value="jeep-tour">Jeep Tours</option>
                <option value="quad-tours">Quad Tours</option>
                <option value="hiking">Hiking Trails</option>
                <option value="parasailing">Parasailing</option>
            `;
        }
    };

    const loadRoutes = async () => {
        currentRouteType = routeTypeSelector.value;
        console.log('Loading routes for category:', currentRouteType);
        try {
            const response = await fetch(`/api/tours/${currentRouteType}`, {
                credentials: 'include' // Send cookies for authentication
            });
            const routes = await response.json();
            console.log('Routes loaded:', routes);
            routeSelector.innerHTML = '<option value="">Select a route...</option>';
            routes.forEach(route => {
                const option = document.createElement('option');
                option.value = route.id;
                option.textContent = route.name;
                routeSelector.appendChild(option);
            });
        } catch (error) { 
            console.error('Failed to load routes:', error); 
        }
    };

    const render = () => {
        console.log('render: points before rendering:', points);
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
                    html: `<div style="font-size: ${isStop ? tourIconSize : 16}px; text-align: center; line-height: ${isStop ? tourIconSize : 16}px;">${isStop ? tourIconUrl : '●'}</div>`,
                    iconSize: [isStop ? tourIconSize : 16, isStop ? tourIconSize : 16],
                    iconAnchor: [isStop ? tourIconSize/2 : 8, isStop ? tourIconSize/2 : 8]
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

        // For hiking trails, use trailCoordinates for the polyline, otherwise use points
        let latLngs;
        if (currentRouteType === 'hiking' && trailCoordinates.length > 0) {
            latLngs = trailCoordinates;
            console.log('Creating hiking trail polyline with', latLngs.length, 'coordinates');
        } else {
            latLngs = points.map(p => [p.lat, p.lng]);
            console.log('Creating regular tour polyline with', latLngs.length, 'points');
        }
        
        if (latLngs.length > 1) {
            console.log('Creating polyline with color:', tourPolylineColor);
            routePolyline = L.polyline(latLngs, { color: tourPolylineColor, weight: 6 }).addTo(map);
            routePolyline.on('click', addShapePointOnLine);
            console.log('Polyline created successfully');
        }
    };

    const loadRouteData = async (routeId) => {
        if (!routeId) {
            clearMap();
            return;
        }
        currentRouteId = routeId;
        try {
            const response = await fetch(`/api/tours/${currentRouteType}/${routeId}`, {
                credentials: 'include' // Send cookies for authentication
            });
            console.log('Response status:', response.status);
            if (!response.ok) {
                points = [];
            } else {
                const data = await response.json();
                console.log('loadRouteData: data received from server:', data);
                points = data.points || [];
                console.log('loadRouteData: points after assignment:', points);
                
                // For hiking trails, store the trail coordinates separately
                if (currentRouteType === 'hiking' && data.coordinates) {
                    trailCoordinates = data.coordinates;
                    console.log('loadRouteData: trail coordinates stored:', trailCoordinates.length);
                } else {
                    trailCoordinates = [];
                }
                
                // Load tour metadata
                tourDescriptionInput.value = data.description || '';
                tourIconUrl = data.icon || '/tours.svg';
                tourIconSize = data.iconSize || 32;
                tourIconSizeSlider.value = tourIconSize;
                tourIconSizeValue.textContent = tourIconSize;
                tourPolylineColor = data.polylineColor || '#8A2BE2';
                tourPolylineColorInput.value = tourPolylineColor;
                // Load pricing & details
                tourCurrency = data.currency || 'EUR';
                if (tourCurrencyInput) tourCurrencyInput.value = tourCurrency;
                const prices = data.prices || {};
                tourPrices = {
                    adult: typeof prices.adult === 'number' ? prices.adult : null,
                    child: typeof prices.child === 'number' ? prices.child : null,
                    senior: typeof prices.senior === 'number' ? prices.senior : null
                };
                if (priceAdultInput) priceAdultInput.value = tourPrices.adult ?? '';
                if (priceChildInput) priceChildInput.value = tourPrices.child ?? '';
                if (priceSeniorInput) priceSeniorInput.value = tourPrices.senior ?? '';
                tourDuration = data.duration || '';
                if (tourDurationInput) tourDurationInput.value = tourDuration;
                tourMaxParticipants = typeof data.maxParticipants === 'number' ? data.maxParticipants : null;
                if (tourMaxParticipantsInput) tourMaxParticipantsInput.value = tourMaxParticipants ?? '';
                tourImportantInfo = data.importantInfo || '';
                if (tourImportantInfoInput) tourImportantInfoInput.value = tourImportantInfo;
                
                // Update the color preview
                const colorPreview = document.getElementById('color-preview');
                if (colorPreview) {
                    colorPreview.style.backgroundColor = tourPolylineColor;
                }
                
                // Debug: Log loaded polyline color
                console.log('Loaded polyline color from route data:', data.polylineColor);
                console.log('Set tourPolylineColor to:', tourPolylineColor);
                console.log('Set color input value to:', tourPolylineColorInput.value);
                
                // Update tour metadata variables
                tourDescription = data.description || '';
                tourIconUrl = data.icon || '/tours.svg';
                tourIconSize = data.iconSize || 32;
                
                // Show existing icon if it's not the default
                if (tourIconUrl !== '/tours.svg') {
                    // Check if it's an emoji icon
                    if (tourIconUrl.length <= 4 && /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(tourIconUrl)) {
                        // It's an emoji, create SVG preview
                        tourIconPreview.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><text x="16" y="20" font-size="24" text-anchor="middle" font-family="Arial, sans-serif">${tourIconUrl}</text></svg>`;
                    } else {
                        // It's a custom uploaded icon
                        tourIconPreview.src = tourIconUrl;
                    }
                    tourIconPreviewContainer.style.display = 'block';
                    existingTourIconInput.value = tourIconUrl;
                } else {
                    tourIconPreviewContainer.style.display = 'none';
                    existingTourIconInput.value = '';
                }
                
                // Load main tour image if it exists
                if (data.mainImage) {
                    tourMainImageUrl = data.mainImage;
                    tourMainImagePreview.src = tourMainImageUrl;
                    tourMainImagePreviewContainer.style.display = 'block';
                    existingTourMainImageInput.value = tourMainImageUrl;
                } else {
                    tourMainImageUrl = '';
                    tourMainImagePreviewContainer.style.display = 'none';
                    existingTourMainImageInput.value = '';
                }
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
            
            const [draggedItem] = points.splice(draggedIndex, 1);
            points.splice(droppedIndex, 0, draggedItem);

            const allItems = stopsList.querySelectorAll('div[draggable="true"]');
            allItems.forEach(item => item.classList.remove('drag-over'));
            draggedIndex = null;

            render();
        }
    });
    
    // --- Actions ---
    const addPointOnMapClick = (e) => {
        const clickedLatLng = e.latlng;
        let newPoint = {
            id: `stop_${Date.now()}`,
            lat: clickedLatLng.lat,
            lng: clickedLatLng.lng,
            type: editMode,
            name: ''
        };

        if (editMode === 'stop') {
            const stopName = prompt('Enter the name for this stop:');
            if (!stopName) return;
            newPoint.name = stopName;

            let insertIndex = points.length;

            if (points.length > 0) {
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
            console.log('addPointOnMapClick: points after adding stop:', points);
            render();
            openStopModal(insertIndex);
        } else {
            points.push(newPoint);
            console.log('addPointOnMapClick: points after adding shape:', points);
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
        trailCoordinates = []; // Clear trail coordinates
        currentRouteId = null;
        routeSelector.value = '';
        newRouteNameInput.value = '';
        
        // Clear tour metadata
        tourDescriptionInput.value = '';
        tourIconFile = null;
        tourIconUrl = '/tours.svg';
        tourIconSize = 32;
        tourIconInput.value = '';
        tourIconSelector.value = '';
        tourIconPreviewContainer.style.display = 'none';
        tourIconSizeSlider.value = 32;
        tourIconSizeValue.textContent = '32';
        tourPolylineColor = '#8A2BE2';
        tourPolylineColorInput.value = '#8A2BE2';
        // Clear pricing & details with sensible defaults
        tourCurrency = 'EUR';
        if (tourCurrencyInput) tourCurrencyInput.value = 'EUR';
        tourPrices = { adult: null, child: null, senior: null };
        if (priceAdultInput) priceAdultInput.value = '';
        if (priceChildInput) priceChildInput.value = '';
        if (priceSeniorInput) priceSeniorInput.value = '';
        tourDuration = '';
        if (tourDurationInput) tourDurationInput.value = '';
        tourMaxParticipants = null;
        if (tourMaxParticipantsInput) tourMaxParticipantsInput.value = '';
        tourImportantInfo = '';
        if (tourImportantInfoInput) tourImportantInfoInput.value = '';
        
        // Update the color preview
        const colorPreview = document.getElementById('color-preview');
        if (colorPreview) {
            colorPreview.style.backgroundColor = '#8A2BE2';
        }
        
        render();
    };

    const saveRouteFile = async () => {
        let routeIdToSave = currentRouteId;
        let routeNameToSave = routeSelector.options[routeSelector.selectedIndex]?.text;
    
        // If no route is selected, but a new route name is provided, it's a new route.
        if (!routeIdToSave && newRouteNameInput.value.trim()) {
            routeNameToSave = newRouteNameInput.value.trim();
            routeIdToSave = routeNameToSave.toLowerCase().replace(/\s+/g, '-');
        }
    
        if (!routeIdToSave) {
            showNotification('Please select a route or enter a new route name.', 'warning');
            return;
        }
        
        // Validate required fields
        if (!tourDescriptionInput.value.trim()) {
            showNotification('Please enter a tour description.', 'warning');
            return;
        }
        
        if (points.length === 0) {
            showNotification('Please add at least one point to the tour.', 'warning');
            return;
        }
    
        console.log(`Saving route: ID=${routeIdToSave}, Name=${routeNameToSave}, Type=${currentRouteType}`);
        console.log('Points to save:', points);
    
        console.log('💾 Preparing to save route...');
        console.log('Tour main image URL:', tourMainImageUrl);
        console.log('Tour main image file:', tourMainImageFile);
        console.log('Existing tour main image input value:', existingTourMainImageInput?.value);
        
        const routeData = {
            id: routeIdToSave,
            name: routeNameToSave,
            type: currentRouteType,
            description: tourDescriptionInput.value.trim(),
            icon: tourIconUrl || '/tours.svg',
            iconSize: tourIconSize || 32,
            polylineColor: tourPolylineColor || '#8A2BE2',
            mainImage: tourMainImageUrl || existingTourMainImageInput?.value || '',
            currency: tourCurrency || 'EUR',
            prices: {
                ...(tourPrices.adult != null ? { adult: tourPrices.adult } : {}),
                ...(tourPrices.child != null ? { child: tourPrices.child } : {}),
                ...(tourPrices.senior != null ? { senior: tourPrices.senior } : {})
            },
            duration: tourDuration || '',
            maxParticipants: tourMaxParticipants != null ? tourMaxParticipants : undefined,
            importantInfo: tourImportantInfo || '',
            points: points.map(p => {
                const pointData = {
                    id: p.id,
                    type: p.type,
                    lat: p.lat,
                    lng: p.lng
                };
                if (p.type === 'stop') {
                    pointData.name = p.name;
                    pointData.description = p.description || '';
                    pointData.images = p.images || [];
                }
                return pointData;
            })
        };
    
        try {
            // If there's a new icon file, upload it first
            let finalIconUrl = tourIconUrl;
            if (tourIconFile) {
                const iconFormData = new FormData();
                iconFormData.append('icon', tourIconFile);
                
                console.log('Uploading tour icon...');
                const iconResponse = await fetch('/api/routes/upload-icon', {
                    method: 'POST',
                    body: iconFormData,
                    credentials: 'include' // Send cookies for authentication
                });
                
                console.log('Icon upload response status:', iconResponse.status);
                
                if (iconResponse.ok) {
                    const iconData = await iconResponse.json();
                    console.log('Icon upload response data:', iconData);
                    finalIconUrl = iconData.iconUrl;
                    routeData.icon = finalIconUrl;
                } else {
                    const errorText = await iconResponse.text();
                    console.error('Icon upload failed:', iconResponse.status, errorText);
                    throw new Error(`Failed to upload icon: ${iconResponse.status} - ${errorText}`);
                }
            }
            
            // If there's a new main tour image file, upload it
            let finalMainImageUrl = tourMainImageUrl;
            if (tourMainImageFile) {
                const mainImageFormData = new FormData();
                mainImageFormData.append('image', tourMainImageFile);
                
                console.log('Uploading main tour image...');
                const mainImageResponse = await fetch('/api/routes/upload-image', {
                    method: 'POST',
                    body: mainImageFormData,
                    credentials: 'include' // Send cookies for authentication
                });
                
                console.log('Main image upload response status:', mainImageResponse.status);
                
                if (mainImageResponse.ok) {
                    const mainImageData = await mainImageResponse.json();
                    console.log('Main image upload response data:', mainImageData);
                    finalMainImageUrl = mainImageData.imageUrl;
                    routeData.mainImage = finalMainImageUrl;
                } else {
                    const errorText = await mainImageResponse.text();
                    console.error('Main image upload failed:', mainImageResponse.status, errorText);
                    throw new Error(`Failed to upload main tour image: ${mainImageResponse.status} - ${errorText}`);
                }
            }
            
            const response = await fetch(`/api/routes/${currentRouteType}/${routeIdToSave}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(routeData),
                credentials: 'include' // Send cookies for authentication
            });
    
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Server responded with ${response.status}`);
            }
    
            showNotification(`Route '${routeNameToSave}' saved successfully!`, 'success');
    
            // If it was a new route, reload the list and select it.
            if (!currentRouteId) {
                newRouteNameInput.value = '';
                await loadRoutes();
                routeSelector.value = routeIdToSave;
                currentRouteId = routeIdToSave; // Update state to reflect the newly saved route
            }
    
        } catch (error) {
            console.error('Failed to save route file:', error);
            showNotification(`Error saving route: ${error.message}`, 'error');
        }
    };

    const deleteRoute = async () => {
        if (!currentRouteId) {
            showNotification('Please select a route to delete.', 'warning');
            return;
        }
        if (!confirm(`Are you sure you want to delete the route: ${currentRouteId}?`)) return;

        try {
            const response = await fetch(`/api/routes/${currentRouteType}/${currentRouteId}`, {
                method: 'DELETE',
                credentials: 'include' // Send cookies for authentication
            });
            if (!response.ok) throw new Error(`Server responded with ${response.status}`);
            showNotification(`Route ${currentRouteId} deleted successfully!`, 'success');
            clearMap();
            await loadRoutes();
        } catch (error) {
            console.error('Failed to delete route:', error);
            showNotification('An error occurred while deleting the route.', 'error');
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
        formData.append('category', 'TOUR_STOP');

        const imageInput = document.getElementById('stop-images');
        for (const file of imageInput.files) {
            formData.append('images', file);
        }

        try {
            // Handle image uploads to server
            const imageInput = document.getElementById('stop-images');
            const uploadedImageUrls = [];
            
            if (imageInput && imageInput.files && imageInput.files.length > 0) {
                console.log(`📤 Uploading ${imageInput.files.length} images for stop...`);
                console.log('Files to upload:', Array.from(imageInput.files).map(f => f.name));
                
                // Upload each image to the server
                for (const file of imageInput.files) {
                    console.log(`📤 Uploading file: ${file.name} (${file.size} bytes)`);
                    
                    const uploadFormData = new FormData();
                    uploadFormData.append('image', file); // Use 'image' singular to match endpoint
                    
                    // Add upload config if it exists in the file input's dataset
                    if (imageInput.dataset.uploadConfig) {
                        uploadFormData.append('uploadConfig', imageInput.dataset.uploadConfig);
                        console.log('📦 Including upload config in request');
                    }
                    
                    try {
                        console.log('Sending upload request...');
                        const uploadResponse = await fetch('/api/routes/upload-image', {
                            method: 'POST',
                            body: uploadFormData,
                            credentials: 'include'
                        });
                        
                        console.log('Upload response status:', uploadResponse.status);
                        
                        if (uploadResponse.ok) {
                            const uploadData = await uploadResponse.json();
                            console.log('✅ Image uploaded successfully:', uploadData);
                            
                            // Use the returned imageUrl
                            const imageUrl = uploadData.imageUrl;
                            console.log('Image URL to add:', imageUrl);
                            uploadedImageUrls.push(imageUrl);
                        } else {
                            console.error('❌ Failed to upload image:', uploadResponse.status);
                            const errorText = await uploadResponse.text();
                            console.error('Error response:', errorText);
                        }
                    } catch (uploadError) {
                        console.error('❌ Error uploading image:', uploadError);
                    }
                }
                
                console.log(`📊 Upload complete. ${uploadedImageUrls.length} images uploaded:`, uploadedImageUrls);
            } else {
                console.log('ℹ️ No files selected for upload');
            }
            
            // Update the point with new data
            const point = points[currentlyEditingPointIndex];
            point.name = document.getElementById('stop-name').value;
            point.description = document.getElementById('stop-description').value;
            
            // Add uploaded images to existing ones
            if (!point.images) point.images = [];
            if (uploadedImageUrls.length > 0) {
                point.images = [...point.images, ...uploadedImageUrls];
                console.log(`✅ Added ${uploadedImageUrls.length} images to stop. Total: ${point.images.length}`);
                
                // Update the preview immediately
                const existingImagesContainer = document.getElementById('existing-stop-images-preview');
                if (existingImagesContainer) {
                    existingImagesContainer.innerHTML = '';
                    
                    point.images.forEach((image, index) => {
                        const imgContainer = document.createElement('div');
                        imgContainer.style.cssText = 'position: relative; display: inline-block; margin: 4px;';
                        
                        const img = document.createElement('img');
                        img.src = image;
                        img.style.cssText = 'width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 2px solid rgba(255, 255, 255, 0.3);';
                        
                        const removeBtn = document.createElement('button');
                        removeBtn.type = 'button';
                        removeBtn.innerHTML = '×';
                        removeBtn.style.cssText = 'position: absolute; top: -8px; right: -8px; background: #ef4444; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-size: 16px; font-weight: bold;';
                        removeBtn.onclick = () => {
                            point.images.splice(index, 1);
                            // Re-open modal to refresh
                            openStopModal(currentlyEditingPointIndex);
                        };
                        
                        imgContainer.appendChild(img);
                        imgContainer.appendChild(removeBtn);
                        existingImagesContainer.appendChild(imgContainer);
                    });
                }
                
                // Clear the file input for next upload
                imageInput.value = '';
                
                // Show success message and keep modal open so user can add more images
                showNotification(`✅ ${uploadedImageUrls.length} image(s) added! Click Save again to finish or add more.`, 'success');
                
                // Keep modal open to allow adding more images
            } else {
                // No images uploaded, just text changes - close modal
                showNotification('Stop details saved successfully!', 'success');
                closeStopModal();
            }
            
            render();

        } catch (error) {
            console.error('Error saving stop details:', error);
            showNotification('Error saving stop details.', 'error');
        }
    };

    // --- Initial Setup ---
    map.on('click', addPointOnMapClick);
    routeTypeSelector.addEventListener('change', loadRoutes);
    routeSelector.addEventListener('change', (e) => loadRouteData(e.target.value));
    createRouteBtn.addEventListener('click', () => {
        const newName = newRouteNameInput.value.trim();
        if (!newName) {
            showNotification('Please enter a name for the new route.', 'warning');
            return;
        }
        // Clear the map and current selection to start fresh for the new route
        clearMap();
        newRouteNameInput.value = newName; // Keep the name in the input
        
        // Reset tour metadata for new route with defaults
        tourDescriptionInput.value = '';
        tourIconFile = null;
        tourIconUrl = '/tours.svg';
        tourIconSize = 32;
        tourIconInput.value = '';
        tourIconSelector.value = '';
        tourIconPreviewContainer.style.display = 'none';
        tourIconSizeSlider.value = 32;
        tourIconSizeValue.textContent = '32';
        tourMainImageFile = null;
        tourMainImageUrl = '';
        tourMainImageInput.value = '';
        tourMainImagePreviewContainer.style.display = 'none';
        
        // Set default values for new tours
        tourCurrency = 'EUR';
        if (tourCurrencyInput) tourCurrencyInput.value = 'EUR';
        tourPrices = { adult: null, child: null, senior: null };
        if (priceAdultInput) priceAdultInput.value = '';
        if (priceChildInput) priceChildInput.value = '';
        if (priceSeniorInput) priceSeniorInput.value = '';
        tourDuration = '';
        if (tourDurationInput) tourDurationInput.value = '';
        tourMaxParticipants = null;
        if (tourMaxParticipantsInput) tourMaxParticipantsInput.value = '';
        tourImportantInfo = '';
        if (tourImportantInfoInput) tourImportantInfoInput.value = '';
        
        showNotification(`Ready to create new route: '${newName}'. Add points and click Save.`, 'info');
    });
    saveBtn.addEventListener('click', saveRouteFile);
    clearBtn.addEventListener('click', clearMap);
    deleteBtn.addEventListener('click', deleteRoute);
    stopForm.addEventListener('submit', handleStopFormSubmit);
    cancelStopEditBtn.addEventListener('click', closeStopModal);

    loadCategories().then(() => {
        loadRoutes();
    });
    
    // Debug: Log initial state
    console.log('Initial polyline color:', tourPolylineColor);
    console.log('Initial color input value:', tourPolylineColorInput.value);
    console.log('Color input element:', tourPolylineColorInput);

    // --- Handle Image Selection from Gallery ---
    
    // Tour main image
    if (tourMainImageInput) {
        tourMainImageInput.addEventListener('imageSelectedFromGallery', (e) => {
            const selectedImage = e.detail;
            console.log('Tour main image selected from gallery:', selectedImage);
            
            // Set preview
            if (tourMainImagePreview && tourMainImagePreviewContainer) {
                tourMainImagePreview.src = selectedImage.path;
                tourMainImagePreviewContainer.style.display = 'block';
            }
            
            // Set as existing image (don't upload again)
            if (existingTourMainImageInput) {
                existingTourMainImageInput.value = selectedImage.path;
                tourMainImageUrl = selectedImage.path;
            }
            
            // Clear the file input
            tourMainImageInput.value = '';
        });
    }

    // Tour icon
    if (tourIconInput) {
        tourIconInput.addEventListener('imageSelectedFromGallery', (e) => {
            const selectedImage = e.detail;
            console.log('Tour icon selected from gallery:', selectedImage);
            
            // Set preview
            if (tourIconPreview && tourIconPreviewContainer) {
                tourIconPreview.src = selectedImage.path;
                tourIconPreviewContainer.style.display = 'block';
            }
            
            // Set as existing icon
            if (existingTourIconInput) {
                existingTourIconInput.value = selectedImage.path;
                tourIcon = selectedImage.path;
            }
            
            // Clear the file input
            tourIconInput.value = '';
        });
    }

    // Stop images (from modal)
    const stopImagesInput = document.getElementById('stop-images');
    if (stopImagesInput) {
        console.log('✅ Attaching imageSelectedFromGallery listener to stop-images');
        
        stopImagesInput.addEventListener('imageSelectedFromGallery', (e) => {
            const selectedImage = e.detail;
            console.log('🎯 Stop image selected from gallery event fired!', selectedImage);
            
            // Get the current stop being edited - use the currentlyEditingPointIndex variable
            console.log('currentlyEditingPointIndex:', currentlyEditingPointIndex);
            console.log('Points array length:', points.length);
            
            if (currentlyEditingPointIndex >= 0 && currentlyEditingPointIndex < points.length && points[currentlyEditingPointIndex]) {
                const stopIndex = currentlyEditingPointIndex;
                // Add image to the stop's images array
                if (!points[stopIndex].images) {
                    points[stopIndex].images = [];
                }
                
                // Check if image already added
                if (!points[stopIndex].images.includes(selectedImage.path)) {
                    points[stopIndex].images.push(selectedImage.path);
                    console.log('✅ Added image to stop:', selectedImage.path);
                    
                    // Re-render the existing images preview
                    const existingImagesContainer = document.getElementById('existing-stop-images-preview');
                    if (existingImagesContainer) {
                        existingImagesContainer.innerHTML = '';
                        
                        points[stopIndex].images.forEach((image, index) => {
                            const imgContainer = document.createElement('div');
                            imgContainer.style.cssText = 'position: relative; display: inline-block; margin: 4px;';
                            
                            const img = document.createElement('img');
                            img.src = image;
                            img.style.cssText = 'width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 2px solid rgba(255, 255, 255, 0.3);';
                            
                            const removeBtn = document.createElement('button');
                            removeBtn.type = 'button';
                            removeBtn.innerHTML = '×';
                            removeBtn.style.cssText = 'position: absolute; top: -8px; right: -8px; background: #ef4444; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-size: 16px; font-weight: bold;';
                            removeBtn.onclick = () => {
                                points[stopIndex].images.splice(index, 1);
                                const container = document.getElementById('existing-stop-images-preview');
                                if (container) {
                                    container.innerHTML = '';
                                    points[stopIndex].images.forEach((img, idx) => {
                                        // Re-render all images
                                        const newContainer = document.createElement('div');
                                        newContainer.style.cssText = 'position: relative; display: inline-block; margin: 4px;';
                                        const newImg = document.createElement('img');
                                        newImg.src = img;
                                        newImg.style.cssText = 'width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 2px solid rgba(255, 255, 255, 0.3);';
                                        newContainer.appendChild(newImg);
                                        container.appendChild(newContainer);
                                    });
                                }
                            };
                            
                            imgContainer.appendChild(img);
                            imgContainer.appendChild(removeBtn);
                            existingImagesContainer.appendChild(imgContainer);
                        });
                    }
                }
            }
            
            // Clear the file input
            stopImagesInput.value = '';
        });
    }

    // --- KML Import Functionality ---
    const kmlFileInput = document.getElementById('kml-file-input');
    const importKmlBtn = document.getElementById('import-kml-btn');

    importKmlBtn.addEventListener('click', async () => {
        const file = kmlFileInput.files[0];
        
        if (!file) {
            showNotification('Please select a KML file first', 'error');
            return;
        }

        if (!file.name.toLowerCase().endsWith('.kml')) {
            showNotification('Please select a valid .kml file (not .kmz)', 'error');
            return;
        }

        try {
            importKmlBtn.disabled = true;
            importKmlBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importing...';

            const formData = new FormData();
            formData.append('kmlFile', file);

            const response = await fetch('/api/kml-import/parse', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to import KML');
            }

            const data = await response.json();
            console.log('📥 KML Import successful:', data);

            if (!data.success || !data.tour) {
                throw new Error('Invalid response from server');
            }

            // Import the tour data
            importTourFromKML(data.tour);

            showNotification(`✅ Imported: ${data.tour.name} (${data.tour.coordinates.length} coordinates, ${data.tour.stops.length} stops)`, 'success');
            
            // Clear file input
            kmlFileInput.value = '';

        } catch (error) {
            console.error('❌ KML Import error:', error);
            showNotification(error.message, 'error');
        } finally {
            importKmlBtn.disabled = false;
            importKmlBtn.innerHTML = '<i class="fas fa-upload"></i> Import KML';
        }
    });

    // Function to import tour data from parsed KML
    function importTourFromKML(tourData) {
        console.log('🔄 Importing tour data into editor:', tourData);

        // Clear existing route
        clearMap();

        // Set route name (create new route)
        const routeNameMatch = tourData.name.match(/^(.*?)(\s*-\s*|\s*\|\s*)/);
        const cleanName = routeNameMatch ? routeNameMatch[1] : tourData.name;
        currentRouteName = cleanName.trim();
        newRouteNameInput.value = currentRouteName;
        currentRouteId = null; // New route

        // Set description
        currentRouteDescription = tourData.description || '';
        const descInput = document.getElementById('tour-description');
        if (descInput) {
            descInput.value = currentRouteDescription;
        }

        // Strategy: Import ALL route coordinates as shape points, then insert stops at their positions
        const importedPoints = [];

        if (tourData.coordinates && tourData.coordinates.length > 0) {
            console.log(`📍 Importing ${tourData.coordinates.length} route coordinates...`);
            
            // Sample the route coordinates to create manageable shape points
            // Use dynamic sampling: more points for shorter routes, fewer for longer routes
            let sampleRate;
            if (tourData.coordinates.length < 100) {
                sampleRate = 1; // Keep all points for short routes
            } else if (tourData.coordinates.length < 500) {
                sampleRate = 2; // Keep every 2nd point
            } else if (tourData.coordinates.length < 1000) {
                sampleRate = 5; // Keep every 5th point
            } else {
                sampleRate = 10; // Keep every 10th point for very long routes
            }
            
            tourData.coordinates.forEach((coord, index) => {
                // Always keep first and last points, plus sampled points
                if (index === 0 || index === tourData.coordinates.length - 1 || index % sampleRate === 0) {
                    importedPoints.push({
                        lat: coord[0],
                        lng: coord[1],
                        type: 'shape',
                        name: '',
                        description: '',
                        images: []
                    });
                }
            });
            
            console.log(`✅ Sampled ${importedPoints.length} shape points from ${tourData.coordinates.length} coordinates (sample rate: 1/${sampleRate})`);
        }

        // Now insert stops into the route at their closest positions
        if (tourData.stops && tourData.stops.length > 0) {
            console.log(`📍 Inserting ${tourData.stops.length} stops into route...`);
            
            tourData.stops.forEach((stop) => {
                const stopLatLng = [stop.coordinates[0], stop.coordinates[1]];
                
                // Find the closest position in the route to insert this stop
                let closestIndex = 0;
                let minDistance = Infinity;
                
                importedPoints.forEach((point, index) => {
                    const distance = Math.sqrt(
                        Math.pow(point.lat - stopLatLng[0], 2) + 
                        Math.pow(point.lng - stopLatLng[1], 2)
                    );
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestIndex = index;
                    }
                });
                
                // Insert the stop at the closest position
                importedPoints.splice(closestIndex, 0, {
                    lat: stopLatLng[0],
                    lng: stopLatLng[1],
                    type: 'stop',
                    name: stop.name || `Stop ${tourData.stops.indexOf(stop) + 1}`,
                    description: stop.description || '',
                    images: []
                });
            });
            
            console.log(`✅ Inserted ${tourData.stops.length} stops into route`);
        }

        // Set the points array
        points = importedPoints;

        // Render the imported data
        render();

        // Fit map to show entire route
        if (points.length > 0) {
            const latLngs = points.map(p => [p.lat, p.lng]);
            const bounds = L.latLngBounds(latLngs);
            map.fitBounds(bounds, { padding: [50, 50] });
        }

        // Update status
        const stopCount = points.filter(p => p.type === 'stop').length;
        const shapeCount = points.filter(p => p.type === 'shape').length;
        showNotification(`✅ Imported: ${stopCount} stops + ${shapeCount} shape points. Edit and click Save!`, 'success');
        
        console.log('✅ Import complete. Points array:', points);
        console.log(`   Stops: ${stopCount}, Shape points: ${shapeCount}`);
    }

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