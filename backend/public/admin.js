/**
 * © 2025 Lőrincz Gábor – All Rights Reserved
 * Unauthorized copying or use is strictly prohibited.
 */

let charts = {}; // To store Chart.js instances

document.addEventListener('DOMContentLoaded', () => {
    // Set Chart.js default colors to white after Chart.js is loaded
    // Wait for Chart.js to be fully loaded
    const setChartDefaults = () => {
        if (typeof Chart !== 'undefined' && Chart.defaults) {
            Chart.defaults.color = '#ffffff';
            if (Chart.defaults.elements) {
                Chart.defaults.elements.text = Chart.defaults.elements.text || {};
                Chart.defaults.elements.text.color = '#ffffff';
            }
            if (Chart.defaults.plugins && Chart.defaults.plugins.legend) {
                Chart.defaults.plugins.legend.labels = Chart.defaults.plugins.legend.labels || {};
                Chart.defaults.plugins.legend.labels.color = '#ffffff';
            }
            if (Chart.defaults.scales) {
                if (Chart.defaults.scales.x) {
                    Chart.defaults.scales.x.ticks = Chart.defaults.scales.x.ticks || {};
                    Chart.defaults.scales.x.ticks.color = '#ffffff';
                }
                if (Chart.defaults.scales.y) {
                    Chart.defaults.scales.y.ticks = Chart.defaults.scales.y.ticks || {};
                    Chart.defaults.scales.y.ticks.color = '#ffffff';
                }
            }
        } else {
            // Retry after a short delay if Chart.js isn't ready yet
            setTimeout(setChartDefaults, 100);
        }
    };

    setChartDefaults();
    // Initialize Header / Menu Editor if present
    try { initHeaderMenuEditor(); } catch (e) { /* ignore */ }
    const placeApiUrl = '/api/places';
    const eventApiUrl = '/api/events';
    window.adminApiUrl = '/api/admin';

    // --- Element Selectors ---
    const placeForm = document.getElementById('place-form');
    const eventForm = document.getElementById('event-form');
    const placesList = document.getElementById('places-list');
    const submitButton = document.getElementById('submit-button');
    const cancelEditButton = document.getElementById('cancel-edit-button');
    const placeIdInput = document.getElementById('place-id');
    const categorySelect = document.getElementById('category');

    const existingImagesContainer = document.getElementById('existing-images-container');
    const existingImagesPreview = document.getElementById('existing-images-preview');
    const existingEventImagesContainer = document.getElementById('existing-event-images-container');
    const existingEventImagesPreview = document.getElementById('existing-event-images-preview');

    const exportBtn = document.getElementById('export-places-btn');
    const importInput = document.getElementById('import-places-input');
    const importBtn = document.getElementById('import-places-btn');

    const downloadGozoBtn = document.getElementById('download-gozo-btn');
    const downloadCominoBtn = document.getElementById('download-comino-btn');
    const tileStatus = document.getElementById('tile-status');
    const progressBarContainer = document.querySelector('.progress-bar-container');
    const progressBar = document.querySelector('.progress-bar');

    const discoveryCategorySelect = document.getElementById('discovery-category');
    const discoveryRegionSelect = document.getElementById('discovery-region');
    const discoverBtn = document.getElementById('discover-places-btn');
    const discoverAllBtn = document.getElementById('discover-all-btn');
    const discoveryStatus = document.getElementById('discovery-status');

    // Master Password Protection (moved to global scope)
    window.masterPasswordInput = document.getElementById('master-password-input');
    window.unlockBtn = document.getElementById('unlock-admin-tools-btn');
    window.lockBtn = document.getElementById('lock-admin-tools-btn');
    window.adminToolsLocked = document.getElementById('admin-tools-locked');
    window.adminToolsContent = document.getElementById('admin-tools-content');
    window.masterPasswordError = document.getElementById('master-password-error');

    // Master password verification is now handled by the backend
    const iconSizeSlider = document.getElementById('iconSize');
    const iconSizeValue = document.getElementById('icon-size-value');
    const iconPreviewContainer = document.getElementById('icon-preview-container');
    const iconPreview = document.getElementById('icon-preview');
    const removeIconBtn = document.getElementById('remove-icon-btn');
    const existingIconInput = document.getElementById('existingIcon');
    const iconInput = document.getElementById('icon');
    // Make iconInput available globally to avoid conflicts with other scripts
    window.iconInput = iconInput;
    const searchPlacesInput = document.getElementById('search-places-input');

    let existingImages = [];
    let existingEventImages = [];
    // Expose arrays to window so enhancement scripts can reliably update them
    try { window.existingImages = existingImages; window.existingEventImages = existingEventImages; } catch (e) { /* ignore */ }
    let map;
    let markers = {};
    let tileDownloadInterval;
    let selectedPlaceId = null;
    let allPlaces = []; // Store all places globally
    let allEvents = []; // Store all events globally
    let currentFilter = 'all'; // 'all', 'place', or 'event'
    let newPlaceMarker = null; // To hold the temporary marker for a new place

    // --- Category Info ---
    const CATEGORY_INFO = {
        "Landscape": { icon: '🌄' },
        "Viewpoint": { icon: '🔭' },
        "Historical Building": { icon: '🏛️' },
        "Nature Spot": { icon: '🌳' },
        "Art & Culture": { icon: '🎭' },
        "Food & Drink": { icon: '🍔' },
        "Shopping": { icon: '🛍️' },
        "Diving Site": { icon: '🤿' },
        "Beach": { icon: '🏖️' },
        "Public Toilet": { icon: '🚽' },
        "Ferry Terminal": { icon: '⛴️' },
        "Boat Tour": { icon: '🚤' },
        "Bus Terminus": { icon: '🚌' },
        "Bus Stop": { icon: '🚏' },
        "BUS_STOP": { icon: '🚏' }, // Added for consistency with enum
        "TOUR_STOP": { icon: '🗺️' }, // Tour stops
        "Tours": { icon: '🗺️' }, // Tours category
        "Cities/Towns": { icon: '🏘️' },
        "Events": { icon: '🎉' },
        "Other Site": { icon: '📍' },
    };

    // Category filter state
    let selectedCategories = [];

    // --- Initial Setup ---
    async function initialize() {
        // Load custom categories first, then populate filters
        await loadCustomCategories();
        updateCategoryFilters();

        // Only initialize map if we're on the admin dashboard (not analytics page)
        const isAnalyticsPage = document.getElementById('analytics-content') !== null;
        if (!isAnalyticsPage) {
            initMap();
            fetchPlacesAndEvents();
            resetForm();
            bindEventListeners();
            checkDownloadStatus();
        }
    }

    // Update category filters to include both built-in and custom categories
    function updateCategoryFilters() {
        // Re-get select elements in case they weren't available when script loaded
        const categorySelectEl = document.getElementById('category');
        const discoveryCategorySelectEl = document.getElementById('discovery-category');

        if (!categorySelectEl) {
            console.error('❌ Category select element not found!');
            return;
        }

        const builtInCategories = Object.keys(CATEGORY_INFO);
        const customCategoryNames = customCategories.map(cat => cat.name);
        const allCategories = [...builtInCategories, ...customCategoryNames];

        // Remove duplicates (in case a custom category has same name as built-in)
        const uniqueCategories = [...new Set(allCategories)];

        console.log('🔄 Updating category filters:', {
            builtInCount: builtInCategories.length,
            customCount: customCategories.length,
            customCategories: customCategoryNames,
            totalCount: uniqueCategories.length,
            hasFerries: uniqueCategories.includes('Ferries')
        });

        // Populate category select dropdowns
        [categorySelectEl, discoveryCategorySelectEl].forEach(select => {
            if (select) {
                const currentValue = select.value; // Save current selection
                select.innerHTML = '';

                // Sort categories: built-in first, then custom
                const sortedCategories = [...builtInCategories.sort(), ...customCategoryNames.sort()];

                sortedCategories.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat;

                    // Get icon from built-in categories or custom categories
                    let icon = '';
                    if (CATEGORY_INFO[cat]) {
                        icon = CATEGORY_INFO[cat].icon;
                    } else {
                        const customCat = customCategories.find(c => c.name === cat);
                        icon = customCat ? customCat.icon : '📍';
                    }

                    option.textContent = `${icon} ${cat}`;
                    select.appendChild(option);
                });

                // Restore selection if it still exists
                if (currentValue && sortedCategories.includes(currentValue)) {
                    select.value = currentValue;
                }

                // Verify Ferries is in the dropdown
                const ferriesOption = Array.from(select.options).find(opt => opt.value === 'Ferries');
                if (ferriesOption) {
                    console.log(`✅ Ferries category found in ${select.id} dropdown:`, ferriesOption.textContent);
                } else {
                    console.error(`❌ Ferries category NOT found in ${select.id} dropdown!`);
                    console.error('Available options:', Array.from(select.options).map(opt => opt.value));
                }

                console.log(`✅ Populated ${select.id} with ${sortedCategories.length} categories`);
            } else {
                console.error(`❌ Select element not found: ${select === categorySelectEl ? 'category' : 'discovery-category'}`);
            }
        });

        // Populate category filter buttons
        const categoryFilterButtons = document.getElementById('category-filter-buttons');
        if (categoryFilterButtons) {
            categoryFilterButtons.innerHTML = '';
            allCategories.forEach(cat => {
                const button = document.createElement('button');
                button.className = 'btn btn-secondary';
                button.dataset.category = cat;

                // Get icon from built-in categories or custom categories
                let icon = '';
                if (CATEGORY_INFO[cat]) {
                    icon = CATEGORY_INFO[cat].icon;
                } else {
                    const customCat = customCategories.find(c => c.name === cat);
                    icon = customCat ? customCat.icon : '📍';
                }

                // Create proper structure with spans for icon and text
                const iconSpan = document.createElement('span');
                iconSpan.textContent = icon;
                iconSpan.className = 'category-icon';

                const textSpan = document.createElement('span');
                textSpan.textContent = cat;
                textSpan.className = 'category-text';

                button.appendChild(iconSpan);
                button.appendChild(textSpan);
                button.onclick = () => toggleCategoryFilter(cat);
                categoryFilterButtons.appendChild(button);
            });
        }
    }

    function populateCategoryFilter(categories) {
        // This function is kept for backward compatibility but now uses updateCategoryFilters
        updateCategoryFilters();
    }

    function toggleCategoryFilter(category) {
        const index = selectedCategories.indexOf(category);
        if (index > -1) {
            selectedCategories.splice(index, 1);
        } else {
            selectedCategories.push(category);
        }

        // Update button appearance
        const button = document.querySelector(`[data-category="${category}"]`);
        if (button) {
            if (selectedCategories.includes(category)) {
                button.className = 'btn btn-primary';
            } else {
                button.className = 'btn btn-secondary';
            }
        }

        // Re-render map markers with category filter
        renderMapMarkers(
            currentFilter === 'all' || currentFilter === 'place' ? allPlaces : [],
            currentFilter === 'all' || currentFilter === 'event' ? allEvents : []
        );
    }

    function initMap() {
        map = L.map('map').setView([36.045, 14.25], 13);
        const gozoBounds = L.latLngBounds([35.98, 14.15], [36.09, 14.40]);

        // Add cache-busting parameter to tile URLs to prevent stale cache issues
        const cacheBuster = new Date().getTime();

        L.tileLayer('/tiles/gozo/{z}/{x}/{y}.png?v=' + cacheBuster, {
            maxZoom: 19,
            minZoom: 12,
            attribution: 'Discover Gozo | &copy; Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP',
            bounds: gozoBounds,
            errorTileUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        }).addTo(map);

        map.setMaxBounds(gozoBounds);

        // Handle right-click or long-press to drop a new pin
        map.on('contextmenu', (e) => {
            if (newPlaceMarker) {
                map.removeLayer(newPlaceMarker);
            }

            const markerHtml = `<div style="font-size: 28px; color: var(--primary-color); transform: translate(-50%, -50%); background: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.25);">+</div>`;
            const markerIcon = L.divIcon({
                className: 'new-place-icon',
                html: markerHtml,
                iconSize: [40, 40]
            });

            newPlaceMarker = L.marker(e.latlng, { icon: markerIcon, zIndexOffset: 1000 })
                .addTo(map)
                .bindPopup(`
                    <b>Create New...</b><br>
                    Lat: ${e.latlng.lat.toFixed(5)}<br>
                    Lng: ${e.latlng.lng.toFixed(5)}
                    <div style="display: flex; gap: 10px; margin-top: 10px;">
                        <button class="btn btn-primary create-place-btn" style="flex: 1;">Place</button>
                        <button class="btn btn-secondary create-event-btn" style="flex: 1;">Event</button>
                    </div>
                `)
                .openPopup();
        });

        // Event delegation for the "Create" buttons in the new item popup
        map.on('popupopen', (e) => {
            const popupContent = e.popup.getElement();

            const createPlaceBtn = popupContent.querySelector('.create-place-btn');
            if (createPlaceBtn) {
                createPlaceBtn.onclick = () => {
                    const latLng = e.popup.getLatLng();
                    showPlaceForm(latLng);
                };
            }

            const createEventBtn = popupContent.querySelector('.create-event-btn');
            if (createEventBtn) {
                createEventBtn.onclick = () => {
                    const latLng = e.popup.getLatLng();
                    showEventForm(latLng);
                };
            }
        });
    }

    function showPlaceForm(latLng) {
        document.getElementById('event-form-container').classList.add('hidden');
        // For details element, we need to set the 'open' attribute instead of removing 'hidden'
        document.getElementById('place-form-container').setAttribute('open', '');
        resetForm(); // Clear the place form
        if (latLng) {
            document.getElementById('latitude').value = latLng.lat.toFixed(5);
            document.getElementById('longitude').value = latLng.lng.toFixed(5);
        }
        // Scroll to the place form summary instead of non-existent form-title
        document.querySelector('#place-form-container summary').scrollIntoView({ behavior: 'smooth', block: 'start' });
        map.closePopup();
        if (newPlaceMarker) {
            map.removeLayer(newPlaceMarker);
            newPlaceMarker = null;
        }
    }

    function showEventForm(latLng) {
        document.getElementById('place-form-container').removeAttribute('open');
        const eventFormContainer = document.getElementById('event-form-container');
        eventFormContainer.classList.remove('hidden');
        const form = eventFormContainer.querySelector('form');
        form.reset(); // Clear the event form

        // Clear the event ID to ensure it's a new event
        document.getElementById('event-id').value = '';

        // Reset form title and button text for new event
        document.getElementById('event-form-title').textContent = '<i class="fas fa-calendar-plus"></i> Add New Event';
        document.getElementById('submit-event-button').textContent = 'Add Event';

        // Clear existing event images
        existingEventImages = [];
        const existingImagesContainer = document.getElementById('existing-event-images-container');
        if (existingImagesContainer) {
            existingImagesContainer.style.display = 'none';
            const preview = document.getElementById('existing-event-images-preview');
            if (preview) preview.innerHTML = '';
        }

        if (latLng) {
            document.getElementById('event-latitude').value = latLng.lat.toFixed(5);
            document.getElementById('event-longitude').value = latLng.lng.toFixed(5);
        }
        eventFormContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        map.closePopup();
        if (newPlaceMarker) {
            map.removeLayer(newPlaceMarker);
            newPlaceMarker = null;
        }
    }

    // --- Event Listeners ---
    function bindEventListeners() {
        if (!placeForm) {
            console.error('❌ placeForm not found!');
            return;
        }

        placeForm.addEventListener('submit', handleFormSubmit);
        eventForm.addEventListener('submit', handleEventFormSubmit);

        // Setup checkbox listeners using MutationObserver to detect when form opens
        const setupCheckboxListenersWhenReady = () => {
            const showOnMainScreenCheckbox = document.getElementById('showOnMainScreen');
            const showOnMainScreenValue = document.getElementById('showOnMainScreenValue');
            const showWhenCategorySelectedCheckbox = document.getElementById('showWhenCategorySelected');
            const showWhenCategorySelectedValue = document.getElementById('showWhenCategorySelectedValue');

            if (showOnMainScreenCheckbox && showOnMainScreenValue) {
                // Remove old listeners by replacing the element
                const newCheckbox1 = showOnMainScreenCheckbox.cloneNode(true);
                showOnMainScreenCheckbox.parentNode.replaceChild(newCheckbox1, showOnMainScreenCheckbox);
                const freshCheckbox1 = document.getElementById('showOnMainScreen');
                const freshValue1 = document.getElementById('showOnMainScreenValue');

                freshCheckbox1.addEventListener('change', function () {
                    freshValue1.value = this.checked ? '1' : '0';
                    console.log('✅✅✅ showOnMainScreen changed to:', freshValue1.value);
                });
                freshCheckbox1.addEventListener('click', function () {
                    setTimeout(() => {
                        freshValue1.value = this.checked ? '1' : '0';
                        console.log('✅✅✅ showOnMainScreen clicked, value:', freshValue1.value);
                    }, 10);
                });
            }

            if (showWhenCategorySelectedCheckbox && showWhenCategorySelectedValue) {
                const newCheckbox2 = showWhenCategorySelectedCheckbox.cloneNode(true);
                showWhenCategorySelectedCheckbox.parentNode.replaceChild(newCheckbox2, showWhenCategorySelectedCheckbox);
                const freshCheckbox2 = document.getElementById('showWhenCategorySelected');
                const freshValue2 = document.getElementById('showWhenCategorySelectedValue');

                freshCheckbox2.addEventListener('change', function () {
                    freshValue2.value = this.checked ? '1' : '0';
                    console.log('✅✅✅ showWhenCategorySelected changed to:', freshValue2.value);
                });
                freshCheckbox2.addEventListener('click', function () {
                    setTimeout(() => {
                        freshValue2.value = this.checked ? '1' : '0';
                        console.log('✅✅✅ showWhenCategorySelected clicked, value:', freshValue2.value);
                    }, 10);
                });
            }
        };

        // Setup initially
        setTimeout(setupCheckboxListenersWhenReady, 500);

        // Also setup when form container opens
        const placeFormContainer = document.getElementById('place-form-container');
        if (placeFormContainer) {
            placeFormContainer.addEventListener('toggle', function () {
                if (this.open) {
                    setTimeout(setupCheckboxListenersWhenReady, 200);
                    // Also set up timetable file listener when form opens
                    setupTimetableFileListener();
                }
            });
        }

        // Function to set up timetable listener (we use a dynamic file picker; no persistent file input)
        function setupTimetableFileListener() {
            const timetableFileSelectedDiv = document.getElementById('timetable-file-selected');
            const timetableFileSelectedName = document.getElementById('timetable-file-selected-name');

            // If a file was previously selected and stored, show it
            try {
                if (window.selectedTimetableFile && timetableFileSelectedDiv && timetableFileSelectedName) {
                    timetableFileSelectedName.textContent = window.selectedTimetableFile.name;
                    timetableFileSelectedDiv.style.display = 'block';
                } else if (window.pendingTimetableForNewPlace && timetableFileSelectedDiv && timetableFileSelectedName) {
                    timetableFileSelectedName.textContent = window.pendingTimetableForNewPlace.filename;
                    timetableFileSelectedDiv.style.display = 'block';
                }
            } catch (err) {
                console.warn('Error showing existing timetable selection:', err);
            }

            console.log('✅ Timetable listener initialized (dynamic uploader)');
        }

        // Set up initially
        setupTimetableFileListener();

        // Setup the separate Upload Timetable button so JSON uploads bypass the image uploader entirely
        // Expose a global function so the action works even when DOM nodes are replaced
        window.performTimetableUpload = async function () {
            if (window._performingTimetableUpload) {
                console.log('⏳ Timetable upload already in progress, ignoring duplicate request');
                return;
            }
            window._performingTimetableUpload = true;
            const uploadStatus = document.getElementById('upload-timetable-status');
            const fileInput = document.getElementById('timetable-file');
            const uploadBtn = document.getElementById('upload-timetable-button');
            try {
                let file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : window.selectedTimetableFile;
                const placeId = document.getElementById('place-id')?.value;

                if (!file) {
                    // Create a dynamic file input so the image optimizer (which runs on static inputs) won't attach.
                    const picker = document.createElement('input');
                    picker.type = 'file';
                    picker.accept = '.json,application/json';
                    picker.style.display = 'none';
                    document.body.appendChild(picker);
                    picker.addEventListener('change', async (ev) => {
                        const f = ev.target.files && ev.target.files[0];
                        if (!f) {
                            if (uploadStatus) { uploadStatus.textContent = 'No timetable file selected.'; uploadStatus.style.color = '#d97706'; }
                            return;
                        }
                        try { window.selectedTimetableFile = f; } catch (err) { /* ignore */ }
                        // Update display field
                        const display = document.getElementById('timetable-file-display');
                        if (display) display.value = f.name;

                        const selectedPlaceId = document.getElementById('place-id')?.value;
                        // If no place yet, parse and store pending
                        if (!selectedPlaceId) {
                            if (uploadStatus) { uploadStatus.textContent = 'Parsing file and storing until place is saved...'; uploadStatus.style.color = '#06b6d4'; }
                            try {
                                const txt = await f.text();
                                const parsed = JSON.parse(txt);
                                window.pendingTimetableForNewPlace = { data: parsed, filename: f.name };
                                if (uploadStatus) { uploadStatus.textContent = 'Timetable parsed and will be uploaded when place is saved.'; uploadStatus.style.color = '#10b981'; }
                                const selDiv = document.getElementById('timetable-file-selected');
                                const selName = document.getElementById('timetable-file-selected-name');
                                if (selDiv && selName) { selName.textContent = f.name; selDiv.style.display = 'block'; }
                                console.log('📅 Timetable parsed and stored for new place:', f.name);
                            } catch (err) {
                                console.error('Failed to parse timetable JSON (picker):', err);
                                if (uploadStatus) { uploadStatus.textContent = 'Invalid JSON file.'; uploadStatus.style.color = '#ef4444'; }
                            }
                        } else {
                            // Upload immediately for existing place
                            if (uploadStatus) { uploadStatus.textContent = 'Uploading...'; uploadStatus.style.color = '#06b6d4'; }
                            try {
                                const txt = await f.text();
                                const parsed = JSON.parse(txt);
                                const resp = await fetch(`/api/places/${selectedPlaceId}/timetable`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    credentials: 'include',
                                    body: JSON.stringify(parsed)
                                });
                                if (!resp.ok) {
                                    const t = await resp.text();
                                    throw new Error(t || `Upload failed: ${resp.status}`);
                                }
                                const res = await resp.json();
                                console.log('Timetable uploaded via picker:', res);
                                if (uploadStatus) { uploadStatus.textContent = 'Upload successful'; uploadStatus.style.color = '#10b981'; }
                                const timetableInfo = document.getElementById('timetable-file-info');
                                const timetableName = document.getElementById('timetable-file-name');
                                if (timetableInfo && timetableName) { timetableName.textContent = res.timetable_file || res.filename || f.name; timetableInfo.style.display = 'block'; }
                                window.lastUploadedTimetableFilename = res.timetable_file || res.filename || f.name;
                                if (selectedPlaceId && allPlaces) {
                                    const idx = allPlaces.findIndex(p => p.id == selectedPlaceId);
                                    if (idx !== -1) { allPlaces[idx].timetable_file = window.lastUploadedTimetableFilename; try { updateMapMarker(allPlaces[idx]); } catch (err) { /* ignore */ } }
                                }
                            } catch (err) {
                                console.error('Error uploading timetable via picker:', err);
                                if (uploadStatus) { uploadStatus.textContent = 'Upload failed: ' + (err.message || 'unknown'); uploadStatus.style.color = '#ef4444'; }
                            }
                        }
                        // cleanup picker
                        setTimeout(() => { try { picker.remove(); } catch (e) { } }, 500);
                    });
                    // open file chooser
                    picker.click();
                    return;
                }

                if (!placeId) {
                    if (uploadStatus) { uploadStatus.textContent = 'Parsing file and storing until place is saved...'; uploadStatus.style.color = '#06b6d4'; }
                    try {
                        const text = await file.text();
                        const parsed = JSON.parse(text);
                        window.pendingTimetableForNewPlace = { data: parsed, filename: file.name };
                        if (uploadStatus) { uploadStatus.textContent = 'Timetable parsed and will be uploaded when place is saved.'; uploadStatus.style.color = '#10b981'; }
                        const selDiv = document.getElementById('timetable-file-selected');
                        const selName = document.getElementById('timetable-file-selected-name');
                        if (selDiv && selName) { selName.textContent = file.name; selDiv.style.display = 'block'; }
                        console.log('📅 Timetable parsed and stored for new place:', file.name);
                    } catch (err) {
                        console.error('Failed to parse timetable JSON:', err);
                        if (uploadStatus) { uploadStatus.textContent = 'Invalid JSON file.'; uploadStatus.style.color = '#ef4444'; }
                    }
                    return;
                }

                // Upload immediately for existing place
                if (uploadBtn) uploadBtn.disabled = true;
                if (uploadStatus) { uploadStatus.textContent = 'Uploading...'; uploadStatus.style.color = '#06b6d4'; }

                const text = await file.text();
                const parsed = JSON.parse(text);

                const resp = await fetch(`/api/places/${placeId}/timetable`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(parsed)
                });

                if (!resp.ok) {
                    const txt = await resp.text();
                    throw new Error(txt || `Upload failed: ${resp.status}`);
                }

                const result = await resp.json();
                console.log('Timetable uploaded via dedicated action:', result);
                if (uploadStatus) { uploadStatus.textContent = 'Upload successful'; uploadStatus.style.color = '#10b981'; }

                const timetableInfo = document.getElementById('timetable-file-info');
                const timetableName = document.getElementById('timetable-file-name');
                const removeBtn = document.getElementById('remove-timetable-btn');
                if (timetableInfo && timetableName) { timetableName.textContent = result.timetable_file || result.filename || file.name; timetableInfo.style.display = 'block'; }
                if (removeBtn) removeBtn.dataset.shouldRemove = 'false';

                window.lastUploadedTimetableFilename = result.timetable_file || result.filename || file.name;
                if (placeId && allPlaces) {
                    const idx = allPlaces.findIndex(p => p.id == placeId);
                    if (idx !== -1) {
                        allPlaces[idx].timetable_file = window.lastUploadedTimetableFilename;
                        try { updateMapMarker(allPlaces[idx]); } catch (err) { /* ignore */ }
                    }
                }
            } catch (err) {
                console.error('Error performing timetable upload:', err);
                const uploadStatus = document.getElementById('upload-timetable-status');
                if (uploadStatus) { uploadStatus.textContent = 'Upload failed: ' + (err.message || 'unknown'); uploadStatus.style.color = '#ef4444'; }
            } finally {
                const uploadBtn = document.getElementById('upload-timetable-button');
                if (uploadBtn) uploadBtn.disabled = false;
                window._performingTimetableUpload = false;
                setTimeout(() => { const us = document.getElementById('upload-timetable-status'); if (us && us.textContent === 'Upload successful') us.textContent = ''; }, 3000);
            }
        };

        function setupUploadTimetableButton() {
            const uploadBtn = document.getElementById('upload-timetable-button');
            if (!uploadBtn) {
                console.warn('Upload Timetable button not found, skipping immediate setup');
                return;
            }
            // Attach a simple click that calls the global action
            uploadBtn.addEventListener('click', function (e) { e.preventDefault(); window.performTimetableUpload(); });

            // Delegated click listener as a fallback in case DOM nodes are replaced
            if (!window._timetableUploadDelegated) {
                document.addEventListener('click', function (e) {
                    const btn = e.target.closest && e.target.closest('#upload-timetable-button');
                    if (btn) {
                        e.preventDefault();
                        window.performTimetableUpload();
                    }
                });
                window._timetableUploadDelegated = true;
            }

            console.log('✅ Upload Timetable button listener set up');
        }

        // Setup upload button on load
        setupUploadTimetableButton();
        // Use MutationObserver to detect when checkboxes are added to DOM
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    const hasCheckbox = Array.from(mutation.addedNodes).some(node =>
                        node.nodeType === 1 && (
                            node.id === 'showOnMainScreen' ||
                            node.id === 'showWhenCategorySelected' ||
                            node.querySelector?.('#showOnMainScreen') ||
                            node.querySelector?.('#showWhenCategorySelected')
                        )
                    );
                    if (hasCheckbox) {
                        setTimeout(setupCheckboxListenersWhenReady, 100);
                    }
                }
            });
        });

        if (placeFormContainer) {
            observer.observe(placeFormContainer, { childList: true, subtree: true });
        }
        document.getElementById('cancel-event-button').addEventListener('click', () => {
            document.getElementById('event-form-container').classList.add('hidden');
            document.getElementById('place-form-container').setAttribute('open', '');
        });
        placesList.addEventListener('click', handlePlaceListClick);

        // Hover events for interactivity
        placesList.addEventListener('mouseover', (e) => {
            const li = e.target.closest('li[data-id]');
            if (li) handlePlaceHover(li.dataset.id, true);
        });
        placesList.addEventListener('mouseout', (e) => {
            const li = e.target.closest('li[data-id]');
            if (li) handlePlaceHover(li.dataset.id, false);
        });

        cancelEditButton.addEventListener('click', (e) => {
            e.preventDefault();
            resetForm();
        });

        exportBtn.addEventListener('click', () => { window.location.href = `${window.adminApiUrl}/export-places`; });
        importBtn.addEventListener('click', () => importInput.click());
        importInput.addEventListener('change', handleImport);

        downloadGozoBtn.addEventListener('click', () => downloadTiles('gozo'));
        downloadCominoBtn.addEventListener('click', () => downloadTiles('comino'));

        // Clear cache button
        const clearCacheBtn = document.getElementById('clear-cache-btn');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', async () => {
                console.log('🧹 Clearing service worker caches...');
                try {
                    // Clear all caches
                    const cacheNames = await caches.keys();
                    console.log('Found caches:', cacheNames);

                    await Promise.all(
                        cacheNames.map(cacheName => {
                            console.log('Deleting cache:', cacheName);
                            return caches.delete(cacheName);
                        })
                    );

                    // Unregister service worker
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(
                        registrations.map(registration => {
                            console.log('Unregistering service worker:', registration.scope);
                            return registration.unregister();
                        })
                    );

                    console.log('✅ Service worker caches cleared');
                    alert('✅ Cache cleared! The page will reload to apply changes.');
                    window.location.reload();
                } catch (error) {
                    console.error('❌ Error clearing caches:', error);
                    alert('❌ Error clearing caches: ' + error.message);
                }
            });
        }

        discoverBtn.addEventListener('click', discoverPlaces);
        discoverAllBtn.addEventListener('click', discoverAllPlaces);

        // Master Password Protection Event Listeners
        window.unlockBtn.addEventListener('click', unlockAdminTools);
        window.lockBtn.addEventListener('click', lockAdminTools);
        window.masterPasswordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                unlockAdminTools();
            }
        });

        // Link slider to value display
        iconSizeSlider.addEventListener('input', (e) => {
            iconSizeValue.textContent = e.target.value;
        });

        // Handle isDefaultIcon checkbox
        const isDefaultIconCheckbox = document.getElementById('isDefaultIcon');
        const isDefaultIconValue = document.getElementById('isDefaultIconValue');
        const iconVisibilityGroup = document.getElementById('iconVisibilityGroup');
        const showOnMainScreenCheckbox = document.getElementById('showOnMainScreen');
        const showOnMainScreenValue = document.getElementById('showOnMainScreenValue');
        const showWhenCategorySelectedCheckbox = document.getElementById('showWhenCategorySelected');
        const showWhenCategorySelectedValue = document.getElementById('showWhenCategorySelectedValue');

        // Also show/hide visibility toggles when icon is uploaded or removed
        // iconInput is already declared globally at line 85, reuse it
        const existingIconInput = document.getElementById('existingIcon');

        const updateVisibilityGroup = () => {
            if (iconVisibilityGroup) {
                const hasIconFile = iconInput && iconInput.files && iconInput.files.length > 0;
                const hasExistingIcon = existingIconInput && existingIconInput.value && existingIconInput.value.startsWith('/uploads/');
                const iconPreviewContainer = document.getElementById('icon-preview-container');
                const hasPreview = iconPreviewContainer && iconPreviewContainer.style.display !== 'none' && iconPreviewContainer.style.display !== '';
                const hasIcon = hasIconFile || hasExistingIcon || hasPreview;

                // ALWAYS show if there's an icon, or force show for debugging
                if (hasIcon) {
                    iconVisibilityGroup.style.display = 'block';
                    console.log('✅ updateVisibilityGroup: Showing toggles - icon detected:', { hasIconFile, hasExistingIcon, hasPreview, hasIcon });
                } else {
                    // Keep hidden if no icon
                    iconVisibilityGroup.style.display = 'none';
                    console.log('❌ updateVisibilityGroup: Hiding toggles - no icon:', { hasIconFile, hasExistingIcon, hasPreview, hasIcon });
                }
            } else {
                console.error('❌❌❌ updateVisibilityGroup: iconVisibilityGroup element not found!');
            }
        };

        if (iconInput) {
            iconInput.addEventListener('change', updateVisibilityGroup);
        }
        if (existingIconInput) {
            // Watch for changes to existing icon (when removed)
            const observer = new MutationObserver(updateVisibilityGroup);
            observer.observe(existingIconInput, { attributes: true, attributeFilter: ['value'] });
        }

        // Initial check
        updateVisibilityGroup();

        if (isDefaultIconCheckbox && isDefaultIconValue) {
            isDefaultIconCheckbox.addEventListener('change', (e) => {
                isDefaultIconValue.value = e.target.checked ? '1' : '0';
                console.log('isDefaultIcon changed to:', isDefaultIconValue.value);
            });
        }

        // Use a simpler approach: set up listeners using event delegation on the form
        // This works even if checkboxes are inside collapsed details elements
        function updateCheckboxValue(checkboxId, valueId) {
            const checkbox = document.getElementById(checkboxId);
            const valueField = document.getElementById(valueId);
            if (checkbox && valueField) {
                valueField.value = checkbox.checked ? '1' : '0';
                console.log(`✅✅✅ ${checkboxId} updated to:`, valueField.value);
                return true;
            }
            return false;
        }

        // Listen for any click or change on the form
        placeForm.addEventListener('click', function (e) {
            if (e.target.id === 'showOnMainScreen') {
                setTimeout(() => updateCheckboxValue('showOnMainScreen', 'showOnMainScreenValue'), 10);
            } else if (e.target.id === 'showWhenCategorySelected') {
                setTimeout(() => updateCheckboxValue('showWhenCategorySelected', 'showWhenCategorySelectedValue'), 10);
            }
        });

        // AIS configuration toggle for places
        const placeDynamicLocationCheckbox = document.getElementById('place-is-dynamic-location');
        const placeAisConfig = document.getElementById('place-ais-config');
        if (placeDynamicLocationCheckbox && placeAisConfig) {
            placeDynamicLocationCheckbox.addEventListener('change', function () {
                placeAisConfig.style.display = this.checked ? 'block' : 'none';
            });
        }

        // AIS configuration toggle for events
        const eventDynamicLocationCheckbox = document.getElementById('event-is-dynamic-location');
        const eventAisConfig = document.getElementById('event-ais-config');
        if (eventDynamicLocationCheckbox && eventAisConfig) {
            eventDynamicLocationCheckbox.addEventListener('change', function () {
                eventAisConfig.style.display = this.checked ? 'block' : 'none';
            });
        }

        placeForm.addEventListener('change', function (e) {
            if (e.target.id === 'showOnMainScreen') {
                updateCheckboxValue('showOnMainScreen', 'showOnMainScreenValue');
            } else if (e.target.id === 'showWhenCategorySelected') {
                updateCheckboxValue('showWhenCategorySelected', 'showWhenCategorySelectedValue');
            }
        });

        console.log('✅✅✅ Checkbox event delegation set up on placeForm');

        // Handle remove icon button
        removeIconBtn.addEventListener('click', () => {
            existingIconInput.value = ''; // Clear the existing icon path
            iconInput.value = ''; // Clear the file input
            iconPreviewContainer.style.display = 'none'; // Hide preview
        });

        // Drag and Drop for Icon Upload
        const iconDropZone = document.getElementById('icon-drop-zone');
        if (iconDropZone) {
            // Click to open file picker
            iconDropZone.addEventListener('click', () => {
                iconInput.click();
            });

            // Handle drag events
            iconDropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                iconDropZone.style.borderColor = '#4A90E2';
                iconDropZone.style.background = '#E8F4FD';
            });

            iconDropZone.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                iconDropZone.style.borderColor = '#ccc';
                iconDropZone.style.background = '#f9f9f9';
            });

            iconDropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                iconDropZone.style.borderColor = '#ccc';
                iconDropZone.style.background = '#f9f9f9';

                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    // Store files temporarily
                    iconInput.files = files;

                    // Show upload configuration modal if available
                    if (window.imageGalleryModal) {
                        window.imageGalleryModal.openUploadConfig((config) => {
                            console.log('Icon upload config:', config);
                            // Store config for the backend to use
                            iconInput.dataset.uploadConfig = JSON.stringify(config);

                            // Update drop zone to show file info
                            const file = files[0];
                            iconDropZone.innerHTML = `
                            <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <div>
                                    <p style="margin: 0; color: #333; font-size: 14px; font-weight: 500;">${file.name}</p>
                                    <p style="margin: 5px 0 0 0; color: #999; font-size: 12px;">${(file.size / 1024).toFixed(0)} KB</p>
                                </div>
                            </div>
                        `;
                        });
                    } else {
                        // Fallback if no gallery modal - just proceed with upload
                        console.log('No imageGalleryModal available, proceeding with normal upload');
                    }
                }
            });

            // Handle file picker selection - also show config modal
            iconInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    const file = e.target.files[0];

                    // Show upload configuration modal if available
                    if (window.imageGalleryModal) {
                        window.imageGalleryModal.openUploadConfig((config) => {
                            console.log('Icon upload config:', config);
                            // Store config for the backend to use
                            iconInput.dataset.uploadConfig = JSON.stringify(config);

                            // Update drop zone to show file info
                            iconDropZone.innerHTML = `
                            <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <div>
                                    <p style="margin: 0; color: #333; font-size: 14px; font-weight: 500;">${file.name}</p>
                                    <p style="margin: 5px 0 0 0; color: #999; font-size: 12px;">${(file.size / 1024).toFixed(0)} KB</p>
                                </div>
                            </div>
                        `;
                        });
                    } else {
                        // Fallback: just show file info
                        const file = e.target.files[0];
                        iconDropZone.innerHTML = `
                            <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <div>
                                    <p style="margin: 0; color: #333; font-size: 14px; font-weight: 500;">${file.name}</p>
                                    <p style="margin: 5px 0 0 0; color: #999; font-size: 12px;">${(file.size / 1024).toFixed(0)} KB</p>
                                </div>
                            </div>
                        `;
                    }
                }
            });
        }

        // Handle image selected from gallery
        if (iconInput) {
            iconInput.addEventListener('imageSelectedFromGallery', (e) => {
                const selectedImage = e.detail;
                console.log('Icon selected from gallery:', selectedImage);

                // Construct full URL for icon preview
                const getApiBaseUrl = () => {
                    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                        return window.location.origin;
                    }
                    return 'http://localhost:3003';
                };
                const iconUrl = selectedImage.path.startsWith('http') ? selectedImage.path : `${getApiBaseUrl()}${selectedImage.path}`;
                iconPreview.src = iconUrl;
                iconPreviewContainer.style.display = 'block';

                // Set as existing icon (don't upload again)
                existingIconInput.value = selectedImage.path;

                // Clear the file input
                iconInput.value = '';
            });
        }

        // Handle search input
        searchPlacesInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            renderFilteredList();
        });

        document.getElementById('list-filter-buttons').addEventListener('click', (e) => {
            if (e.target.matches('.btn')) {
                currentFilter = e.target.dataset.filter;
                document.querySelectorAll('#list-filter-buttons .btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                renderFilteredList();
            }
        });

        // Category Management Event Listeners
        document.getElementById('add-category-btn').addEventListener('click', () => {
            showCategoryModal();
        });

        document.getElementById('refresh-categories-btn').addEventListener('click', () => {
            loadCustomCategories();
        });
    }

    // --- Core Functions ---
    async function fetchPlacesAndEvents() {
        try {
            const [placesRes, eventsRes] = await Promise.all([
                fetch(placeApiUrl, { credentials: 'include' }),
                fetch(eventApiUrl, { credentials: 'include' })
            ]);
            if (!placesRes.ok) throw new Error('Failed to fetch places.');
            if (!eventsRes.ok) throw new Error('Failed to fetch events.');

            allPlaces = await placesRes.json();
            allEvents = await eventsRes.json();

            renderFilteredList();
        } catch (error) {
            console.error('Error fetching data:', error);
            placesList.innerHTML = '<li>Error loading data.</li>';
        }
    }

    function renderFilteredList() {
        const searchTerm = searchPlacesInput.value.toLowerCase();

        let combinedList = [];
        if (currentFilter === 'all' || currentFilter === 'place') {
            // Apply category filter to places
            let filteredPlaces = allPlaces;
            if (selectedCategories.length > 0) {
                filteredPlaces = allPlaces.filter(place => selectedCategories.includes(place.category));
            }
            combinedList.push(...filteredPlaces.map(p => ({ ...p, type: 'place' })));
        }
        if (currentFilter === 'all' || currentFilter === 'event') {
            // Apply category filter to events
            let filteredEvents = allEvents;
            if (selectedCategories.length > 0) {
                // Show events only if "Events" category is selected
                if (selectedCategories.includes('Events')) {
                    filteredEvents = allEvents;
                } else {
                    filteredEvents = []; // Hide events if Events category is not selected
                }
            }
            combinedList.push(...filteredEvents.map(e => ({ ...e, type: 'event' })));
        }

        const filtered = combinedList.filter(item => item.name && item.name.toLowerCase().includes(searchTerm));

        renderList(filtered);
        renderMapMarkers(
            currentFilter === 'all' || currentFilter === 'place' ? allPlaces : [],
            currentFilter === 'all' || currentFilter === 'event' ? allEvents : []
        );
    }

    function renderList(items) {
        placesList.innerHTML = '';
        if (items.length === 0) {
            placesList.innerHTML = '<li style="padding: 1rem;">No items found.</li>';
            return;
        }
        items.sort((a, b) => a.name.localeCompare(b.name)).forEach(item => {
            const li = document.createElement('li');
            li.dataset.id = item.id;
            li.dataset.type = item.type;

            if (item.type === 'place') {
                const thumbnailUrl = (item.image_urls && item.image_urls.length > 0) ? item.image_urls[0] : '';
                // Get icon from custom categories or built-in categories
                let categoryIcon = '📍';
                const customCat = customCategories.find(c => c.name === item.category);
                if (customCat) {
                    categoryIcon = customCat.icon;
                } else if (CATEGORY_INFO[item.category]) {
                    categoryIcon = CATEGORY_INFO[item.category].icon;
                }
                if (item.category === 'Bus Stop') {
                    categoryIcon = '🚏';
                }
                li.innerHTML = `
                    <img src="${thumbnailUrl}" alt="${item.name}" class="place-thumbnail" onerror="this.style.display='none';">
                    <div class="place-info">
                        <h3>${categoryIcon} ${item.name}</h3>
                        <p>ID: ${item.id}</p>
                    </div>
                    <div class="place-buttons">
                        <button class="btn btn-secondary fetch-wiki-btn" data-id="${item.id}" data-name="${item.name}" title="Auto-fetch image from Wikipedia">Wiki</button>
                        <button class="btn btn-secondary fetch-img-btn" data-id="${item.id}" data-name="${item.name}" title="Auto-fetch images from Pexels">Img</button>
                        <button class="btn btn-secondary edit-btn" data-id="${item.id}" title="Edit Place">Edit</button>
                        <button class="btn btn-danger delete-btn" data-id="${item.id}" title="Delete Place">Del</button>
                    </div>
                `;
            } else { // Event
                const eventIcon = CATEGORY_INFO['Events']?.icon || '🎉';
                li.innerHTML = `
                    <div class="place-info" style="margin-left: 1rem;">
                        <h3>${eventIcon} ${item.name}</h3>
                        <p>Event ID: ${item.id}</p>
                    </div>
                    <div class="place-buttons">
                        <button class="btn btn-secondary edit-event-btn" data-id="${item.id}" title="Edit Event">Edit</button>
                        <button class="btn btn-danger delete-event-btn" data-id="${item.id}" title="Delete Event">Del</button>
                    </div>
                `;
            }
            placesList.appendChild(li);
        });
    }

    function renderMapMarkers(places, events) {
        console.log('🔄 Rendering markers...', { placesCount: places.length, eventsCount: events.length });

        // Comprehensive marker cleanup
        Object.values(markers).forEach(marker => {
            if (marker && marker._map) {
                marker._map.removeLayer(marker);
            }
            if (marker && marker.remove) {
                marker.remove();
            }
        });
        markers = {};

        // Clear all existing markers from map
        if (map) {
            map.eachLayer(layer => {
                if (layer instanceof L.Marker) {
                    map.removeLayer(layer);
                }
            });
        }

        // Apply category filter to places
        let filteredPlaces = places;
        if (selectedCategories.length > 0) {
            filteredPlaces = places.filter(place => selectedCategories.includes(place.category));
        }

        // Render Places
        filteredPlaces.forEach(place => {
            if (place.latitude && place.longitude) {
                const marker = createCustomMarker(place, false);

                marker.on('click', () => handleMarkerClick(place));

                marker.on('popupopen', () => {
                    const popupElement = marker.getPopup().getElement();

                    // Handle edit button
                    const editBtn = popupElement.querySelector('.popup-edit-btn');
                    if (editBtn) {
                        editBtn.onclick = async () => {
                            const id = editBtn.dataset.id;
                            if (!id) return;
                            try {
                                const response = await fetch(`${placeApiUrl}/${id}`, {
                                    credentials: 'include'
                                });
                                if (!response.ok) throw new Error('Failed to fetch place details for editing.');
                                const placeToEdit = await response.json();
                                if (placeToEdit) {
                                    map.closePopup();
                                    // Scroll the edit form into view and open it
                                    const editFormContainer = document.querySelector('#place-form-container summary');
                                    if (editFormContainer) {
                                        editFormContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        editFormContainer.click(); // Open the details element
                                    }
                                    fillFormForEdit(placeToEdit);
                                }
                            } catch (error) {
                                console.error('Error fetching place from popup button:', error);
                                alert(error.message);
                            }
                        };
                    }

                    // Handle delete button
                    const deleteBtn = popupElement.querySelector('.popup-delete-btn');
                    if (deleteBtn) {
                        deleteBtn.onclick = async () => {
                            const id = deleteBtn.dataset.id;
                            if (!id) return;

                            const placeName = place.name || 'this place';
                            // Prevent deletion of bus stops
                            if (place.category === 'Bus Stop' || place.category === 'BUS_STOP' || place.category === 'Bus Terminus') {
                                alert('⚠️ Bus stops and bus terminals cannot be deleted here.\n\nPlease use the dedicated Bus Routes Editor (bus-editor.html) to manage bus stops and routes.');
                                return;
                            }

                            // Prevent deletion of tour stops
                            if (place.category === 'TOUR_STOP' || place.category === 'Tours') {
                                alert('⚠️ Tour stops and tour routes cannot be deleted here.\n\nPlease use the dedicated Tour Routes Editor (new-route-editor.html) to manage tours and their stops.');
                                return;
                            }

                            if (confirm(`Are you sure you want to delete ${placeName}? This action cannot be undone.`)) {
                                try {
                                    const response = await fetch(`${placeApiUrl}/${id}`, {
                                        method: 'DELETE',
                                        credentials: 'include'
                                    });
                                    if (!response.ok) throw new Error('Failed to delete place.');

                                    map.closePopup();
                                    // Remove marker from map
                                    if (markers[place.id]) {
                                        map.removeLayer(markers[place.id]);
                                        delete markers[place.id];
                                    }
                                    // Refresh the places list
                                    await fetchPlacesAndEvents();
                                    alert(`${placeName} has been deleted successfully.`);
                                } catch (error) {
                                    console.error('Error deleting place:', error);
                                    alert('Failed to delete place. Please try again.');
                                }
                            }
                        };
                    }
                });

                markers[place.id] = marker;
            }
        });

        // Apply category filter to events
        let filteredEvents = events;
        if (selectedCategories.length > 0) {
            // Show events only if "Events" category is selected
            if (selectedCategories.includes('Events')) {
                filteredEvents = events;
            } else {
                filteredEvents = []; // Hide events if Events category is not selected
            }
        }

        // Render Events separately for clarity and robustness
        filteredEvents.forEach(event => {
            if (event.latitude && event.longitude) {
                const eventIcon = CATEGORY_INFO['Events']?.icon || '🎉';
                const eventIconHtml = `<div style="background-color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; border: 3px solid #f43f5e; box-shadow: 0 4px 12px rgba(0,0,0,0.25);">${eventIcon}</div>`;
                const eventIconDiv = L.divIcon({
                    className: 'custom-div-icon',
                    html: eventIconHtml,
                    iconSize: [46, 46],
                    iconAnchor: [23, 23]
                });

                const marker = L.marker([event.latitude, event.longitude], { icon: eventIconDiv, zIndexOffset: 200 })
                    .addTo(map)
                    .bindPopup(`
                        <h4>${eventIcon} ${event.name}</h4>
                        <p><strong>Event ID:</strong> ${event.id}</p>
                        <div style="display: flex; gap: 10px; margin-top: 10px;">
                            <button class="btn btn-secondary popup-edit-event-btn" data-id="${event.id}" style="flex: 1;">Edit</button>
                            <button class="btn btn-danger popup-delete-event-btn" data-id="${event.id}" style="flex: 1;">Delete</button>
                        </div>
                    `);

                // Store event marker in the markers object for proper cleanup
                markers[`event_${event.id}`] = marker;

                marker.on('popupopen', () => {
                    const popupElement = marker.getPopup().getElement();

                    const editBtn = popupElement.querySelector('.popup-edit-event-btn');
                    if (editBtn) {
                        editBtn.onclick = () => {
                            fillFormForEventEdit(event);
                        };
                    }

                    const deleteBtn = popupElement.querySelector('.popup-delete-event-btn');
                    if (deleteBtn) {
                        deleteBtn.onclick = async () => {
                            if (confirm(`Are you sure you want to delete event "${event.name}"?`)) {
                                try {
                                    const response = await fetch(`/api/events/${event.id}`, {
                                        method: 'DELETE',
                                        credentials: 'include'
                                    });
                                    if (!response.ok) throw new Error('Failed to delete event.');

                                    map.closePopup();

                                    // Remove marker from map
                                    const eventMarkerId = `event-${event.id}`;
                                    if (markers[eventMarkerId]) {
                                        map.removeLayer(markers[eventMarkerId]);
                                        delete markers[eventMarkerId];
                                    }

                                    // Remove from local array and re-render
                                    allEvents = allEvents.filter(e => e.id != event.id);
                                    renderFilteredList();

                                    alert(`Event "${event.name}" has been deleted successfully.`);
                                } catch (error) {
                                    console.error('Error deleting event:', error);
                                    alert('Failed to delete event.');
                                }
                            }
                        };
                    }
                });

                markers[`event-${event.id}`] = marker;
            }
        });
    }

    function createCustomMarker(place, isHovered) {
        const isSelected = place.id === selectedPlaceId;
        const customIconUrl = place.icon;
        const iconSize = place.iconSize || 32;

        let markerHtml;
        let iconOptions;

        if (customIconUrl && customIconUrl.startsWith('/uploads/')) {
            // Use custom image icon without the circular frame
            markerHtml = `<img src="${customIconUrl}" alt="${place.name}" style="width: ${iconSize}px; height: ${iconSize}px; transform: ${isSelected || isHovered ? 'scale(1.2)' : 'scale(1)'}; transition: transform 0.2s ease-out; object-fit: contain;">`;
            iconOptions = {
                className: 'custom-image-icon', // Use a different class to avoid conflicting styles
                html: markerHtml,
                iconSize: [iconSize, iconSize],
                iconAnchor: [iconSize / 2, iconSize * 0.5] // Anchor at the center
            };
        } else {
            // Fallback to emoji with the circular frame
            // Get icon from custom categories or built-in categories
            let emoji = customIconUrl;
            if (!emoji) {
                const customCat = customCategories.find(c => c.name === place.category);
                emoji = customCat?.icon || CATEGORY_INFO[place.category]?.icon || '📍';
            }
            markerHtml = `<div style="background-color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; border: 3px solid ${isSelected ? '#0ea5e9' : 'white'}; box-shadow: 0 4px 12px rgba(0,0,0,0.25); transform: ${isSelected || isHovered ? 'scale(1.15)' : 'scale(1)'}; transition: all 0.2s ease-out;">${emoji}</div>`;
            iconOptions = {
                className: 'custom-div-icon',
                html: markerHtml,
                iconSize: [46, 46],
                iconAnchor: [23, 23]
            };
        }

        const markerIcon = L.divIcon(iconOptions);

        let imageGallery = '';
        if (place.image_urls && place.image_urls.length > 0) {
            imageGallery = '<div class="popup-image-gallery">';
            place.image_urls.forEach(url => {
                imageGallery += `<img src="${url}" alt="${place.name}">`;
            });
            imageGallery += '</div>';
        }
        const popupContent = `
            <div class="popup-content">
                <h4>${place.name}</h4>
                <p><strong>Category:</strong> ${place.category || 'N/A'}</p>
                <p><strong>ID:</strong> ${place.id}</p>
                ${imageGallery}
                <div class="popup-buttons" style="display: flex; gap: 8px; margin-top: 12px;">
                    <button class="btn btn-primary popup-edit-btn" data-id="${place.id}" style="flex: 1;">Edit Place</button>
                    <button class="btn btn-danger popup-delete-btn" data-id="${place.id}" style="flex: 1;">Delete</button>
                </div>
            </div>
        `;

        const baseZIndex = (customIconUrl && customIconUrl.startsWith('/uploads/')) ? 100 : 0;

        const marker = L.marker([place.latitude, place.longitude], {
            icon: markerIcon,
            zIndexOffset: isSelected ? 500 : (isHovered ? 400 : baseZIndex)
        })
            .addTo(map)
            .bindPopup(popupContent, { minWidth: 200 });

        // Store marker in the markers object for proper cleanup
        markers[place.id] = marker;

        return marker;
    }

    function updateMarkerStyle(place, isHovered) {
        const marker = markers[place.id];
        if (marker) {
            const newIcon = createCustomMarker(place, isHovered).options.icon;
            marker.setIcon(newIcon);
            if (isHovered) {
                marker.setZIndexOffset(400);
            } else {
                marker.setZIndexOffset(place.id === selectedPlaceId ? 500 : 0);
            }
        }
    }

    // Add a new marker to the map
    function addMapMarker(item) {
        if (item.latitude && item.longitude) {
            // Check if it should be shown based on current filters
            const shouldShow = shouldShowItem(item);
            if (shouldShow) {
                const marker = createCustomMarker(item, false);
                marker.on('click', () => handleMarkerClick(item));

                // Add popup event handler for places
                if (item.category) { // It's a place
                    marker.on('popupopen', () => {
                        const popupElement = marker.getPopup().getElement();

                        // Handle edit button
                        const editBtn = popupElement.querySelector('.popup-edit-btn');
                        if (editBtn) {
                            editBtn.onclick = async () => {
                                const id = editBtn.dataset.id;
                                if (!id) return;
                                try {
                                    const response = await fetch(`${placeApiUrl}/${id}`, {
                                        credentials: 'include'
                                    });
                                    if (!response.ok) throw new Error('Failed to fetch place details for editing.');
                                    const placeToEdit = await response.json();
                                    if (placeToEdit) {
                                        map.closePopup();
                                        // Scroll the edit form into view and open it
                                        const editFormContainer = document.querySelector('#place-form-container summary');
                                        if (editFormContainer) {
                                            editFormContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                            editFormContainer.click(); // Open the details element
                                        }
                                        fillFormForEdit(placeToEdit);
                                    }
                                } catch (error) {
                                    console.error('Error fetching place from popup button:', error);
                                    alert(error.message);
                                }
                            };
                        }

                        // Handle delete button
                        const deleteBtn = popupElement.querySelector('.popup-delete-btn');
                        if (deleteBtn) {
                            deleteBtn.onclick = async () => {
                                const id = deleteBtn.dataset.id;
                                if (!id) return;

                                const itemName = item.name || 'this item';
                                // Prevent deletion of bus stops
                                if (item.category === 'Bus Stop' || item.category === 'BUS_STOP' || item.category === 'Bus Terminus') {
                                    alert('⚠️ Bus stops and bus terminals cannot be deleted here.\n\nPlease use the dedicated Bus Routes Editor (bus-editor.html) to manage bus stops and routes.');
                                    return;
                                }

                                // Prevent deletion of tour stops
                                if (item.category === 'TOUR_STOP' || item.category === 'Tours') {
                                    alert('⚠️ Tour stops and tour routes cannot be deleted here.\n\nPlease use the dedicated Tour Routes Editor (new-route-editor.html) to manage tours and their stops.');
                                    return;
                                }

                                if (confirm(`Are you sure you want to delete ${itemName}? This action cannot be undone.`)) {
                                    try {
                                        const response = await fetch(`${placeApiUrl}/${id}`, {
                                            method: 'DELETE',
                                            credentials: 'include'
                                        });
                                        if (!response.ok) throw new Error('Failed to delete item.');

                                        map.closePopup();
                                        // Remove marker from map
                                        if (markers[item.id]) {
                                            map.removeLayer(markers[item.id]);
                                            delete markers[item.id];
                                        }
                                        // Remove from arrays
                                        const placeIndex = allPlaces.findIndex(p => p.id == id);
                                        if (placeIndex !== -1) {
                                            allPlaces.splice(placeIndex, 1);
                                        }
                                        const eventIndex = allEvents.findIndex(e => e.id == id);
                                        if (eventIndex !== -1) {
                                            allEvents.splice(eventIndex, 1);
                                        }
                                        // Refresh the list
                                        renderFilteredList();
                                        alert(`${itemName} has been deleted successfully.`);
                                    } catch (error) {
                                        console.error('Error deleting item:', error);
                                        alert('Failed to delete item. Please try again.');
                                    }
                                }
                            };
                        }
                    });
                }

                // Use correct marker ID format (events use event- prefix)
                const markerId = item.category ? item.id : `event-${item.id}`;
                markers[markerId] = marker;
            }
        }
    }

    // Update an existing marker on the map
    function updateMapMarker(item) {
        if (item.latitude && item.longitude) {
            console.log(`🔄 Updating marker for ${item.category ? 'place' : 'event'}: ${item.name}`);

            // Immediate re-render without delay for updates
            renderMapMarkers(
                currentFilter === 'all' || currentFilter === 'place' ? allPlaces : [],
                currentFilter === 'all' || currentFilter === 'event' ? allEvents : []
            );
        }
    }

    // Check if an item should be shown based on current filters
    function shouldShowItem(item) {
        // Check category filter
        if (selectedCategories.length > 0 && !selectedCategories.includes(item.category)) {
            return false;
        }

        // Check type filter
        if (currentFilter === 'place' && !item.category) {
            return false; // Events don't have category
        }
        if (currentFilter === 'event' && item.category) {
            return false; // Places have category, events don't
        }

        return true;
    }

    function handleMarkerClick(place, scrollListIntoView = true) {
        // Deselect previous
        if (selectedPlaceId && markers[selectedPlaceId]) {
            const oldPlace = allPlaces.find(p => p.id == selectedPlaceId);
            if (oldPlace) updateMarkerStyle(oldPlace, false);
            document.querySelector(`li[data-id="${selectedPlaceId}"]`)?.classList.remove('selected');
        }

        // Select new one
        selectedPlaceId = place.id;
        updateMarkerStyle(place, true); // Hovered = true to make it pop

        const listItem = document.querySelector(`li[data-id="${place.id}"]`);
        if (listItem) {
            listItem.classList.add('selected');
            // Only scroll the list into view if triggered by a map click
            if (scrollListIntoView) {
                listItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        // Fly to the location only if coordinates are valid
        if (place && typeof place.latitude === 'number' && typeof place.longitude === 'number') {
            map.flyTo([place.latitude, place.longitude], 15);
        } else {
            console.warn('Marker click handled for a place with invalid coordinates:', place);
        }
    }

    function handlePlaceHover(placeId, isHovered) {
        if (placeId == selectedPlaceId) return; // Don't change style for selected item on hover
        const place = allPlaces.find(p => p.id == placeId);
        if (place) {
            updateMarkerStyle(place, isHovered);
        }
    }

    async function handleFormSubmit(e) {
        e.preventDefault();

        console.log('🚀🚀🚀 handleFormSubmit called - TIMETABLE UPLOAD CHECK');
        console.log('🚀🚀🚀 This is the NEW version of handleFormSubmit with timetable support');

        // Show loading indicator
        const submitBtn = placeForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = '⏳ Saving...';
        submitBtn.disabled = true;

        const formData = new FormData(placeForm);
        const id = formData.get('id'); // Get ID directly from form data

        // Remove timetable file from formData - it will be uploaded separately
        // Store the file reference before removing from formData
        console.log('🔍 Looking for timetable selection (dynamic uploader)...');
        // We removed the static file input to prevent the image optimizer attaching to it.
        // Timetable selection is stored in window.selectedTimetableFile or window.pendingTimetableForNewPlace.
        let timetableFile = null;
        if (window.selectedTimetableFile) {
            timetableFile = window.selectedTimetableFile;
            console.log('📅✅ Timetable file detected (from window.selectedTimetableFile):', timetableFile.name, 'size:', timetableFile.size, 'type:', timetableFile.type);
        } else if (window.pendingTimetableForNewPlace) {
            console.log('📅ℹ️ Pending parsed timetable present for new place:', window.pendingTimetableForNewPlace.filename);
        } else {
            console.log('📅❌ No timetable file selected or pending');
        }

        // Debug: log the existingImages used for submission and whether it matches the global
        try {
            console.log('DEBUG handleFormSubmit - existingImages (local):', existingImages);
            console.log('DEBUG handleFormSubmit - window.existingImages:', window.existingImages);
            console.log('DEBUG handleFormSubmit - same reference?', existingImages === window.existingImages);
        } catch (err) {
            console.warn('DEBUG handleFormSubmit - failed to log existingImages', err);
        }

        formData.append('existingImages', JSON.stringify(existingImages));

        // Debug: list formData keys for inspection
        try {
            for (const entry of formData.entries()) {
                console.log('DEBUG formData entry:', entry[0], entry[1]);
            }
        } catch (err) {
            console.warn('DEBUG formData iteration failed:', err);
        }

        // Handle is_dynamic_location checkbox
        const isDynamicLocationCheckbox = document.getElementById('place-is-dynamic-location');
        if (isDynamicLocationCheckbox) {
            formData.set('is_dynamic_location', isDynamicLocationCheckbox.checked ? '1' : '0');
        }

        // CRITICAL: Ensure hidden field values are always included, even if checkboxes are unchecked
        // This ensures the backend always receives the checkbox values
        // IMPORTANT: Read checkbox state directly to ensure we get the current value, not stale hidden field value
        const isDefaultIconCheckbox = document.getElementById('isDefaultIcon');
        const isDefaultIconValue = document.getElementById('isDefaultIconValue');
        const showOnMainScreenCheckbox = document.getElementById('showOnMainScreen');
        const showOnMainScreenValue = document.getElementById('showOnMainScreenValue');
        const showWhenCategorySelectedCheckbox = document.getElementById('showWhenCategorySelected');
        const showWhenCategorySelectedValue = document.getElementById('showWhenCategorySelectedValue');

        // Update hidden fields from checkbox state to ensure they're in sync
        console.log('🔍 Before updating hidden fields:', {
            isDefaultIconCheckbox: isDefaultIconCheckbox ? isDefaultIconCheckbox.checked : 'NOT FOUND',
            showOnMainScreenCheckbox: showOnMainScreenCheckbox ? showOnMainScreenCheckbox.checked : 'NOT FOUND',
            showWhenCategorySelectedCheckbox: showWhenCategorySelectedCheckbox ? showWhenCategorySelectedCheckbox.checked : 'NOT FOUND'
        });

        if (isDefaultIconCheckbox && isDefaultIconValue) {
            isDefaultIconValue.value = isDefaultIconCheckbox.checked ? '1' : '0';
            formData.set('isDefaultIconValue', isDefaultIconValue.value);
            console.log('✅ isDefaultIconValue set to:', isDefaultIconValue.value);
        } else {
            console.error('❌ isDefaultIconCheckbox or isDefaultIconValue not found!');
        }
        // Check if there's a custom icon to determine if we should send visibility fields
        // iconInput is already declared globally at line 85, reuse it
        const existingIconInput = document.getElementById('existingIcon');
        const hasCustomIcon = (existingIconInput && existingIconInput.value && existingIconInput.value.startsWith('/uploads/')) ||
            (iconInput && iconInput.files && iconInput.files.length > 0);

        // CRITICAL FIX: When checkboxes exist, send their actual values (0 or 1).
        // Only send empty string if checkboxes don't exist (new place, user hasn't interacted).
        // This ensures user's explicit choices are respected.
        if (hasCustomIcon) {
            if (showOnMainScreenCheckbox && showOnMainScreenValue) {
                // Checkbox exists: send actual value (0 or 1) based on checked state
                const value = showOnMainScreenCheckbox.checked ? '1' : '0';
                formData.set('showOnMainScreenValue', value);
                console.log('✅✅✅ FORM SUBMIT: hasCustomIcon=true, showOnMainScreen =', value, '(checkbox exists, using actual value)');
            } else {
                // Checkbox doesn't exist: send empty string so backend defaults to 1 (show)
                formData.set('showOnMainScreenValue', '');
                console.log('✅✅✅ FORM SUBMIT: hasCustomIcon=true, showOnMainScreen = empty (checkbox not found, backend will default to 1)');
            }

            if (showWhenCategorySelectedCheckbox && showWhenCategorySelectedValue) {
                // Checkbox exists: send actual value (0 or 1) based on checked state
                const value = showWhenCategorySelectedCheckbox.checked ? '1' : '0';
                formData.set('showWhenCategorySelectedValue', value);
                console.log('✅✅✅ FORM SUBMIT: hasCustomIcon=true, showWhenCategorySelected =', value, '(checkbox exists, using actual value)');
            } else {
                // Checkbox doesn't exist: send empty string so backend defaults to 1 (show)
                formData.set('showWhenCategorySelectedValue', '');
                console.log('✅✅✅ FORM SUBMIT: hasCustomIcon=true, showWhenCategorySelected = empty (checkbox not found, backend will default to 1)');
            }
        } else {
            // No custom icon: send empty string so backend sets to NULL
            formData.set('showOnMainScreenValue', '');
            formData.set('showWhenCategorySelectedValue', '');
            console.log('✅✅✅ FORM SUBMIT: hasCustomIcon=false, setting visibility fields to empty (NULL)');
        }

        // Add upload config if icon has been uploaded with config
        // iconInput is already declared above, reuse it
        if (iconInput && iconInput.dataset.uploadConfig) {
            formData.append('uploadConfig', iconInput.dataset.uploadConfig);
            console.log('📋 Adding upload config to formData:', iconInput.dataset.uploadConfig);
        }

        const method = id ? 'PUT' : 'POST';
        const url = id ? `${placeApiUrl}/${id}` : placeApiUrl;

        // Verify values are actually in FormData before sending
        const isDefaultIconVal = formData.get('isDefaultIconValue');
        const showOnMainScreenVal = formData.get('showOnMainScreenValue');
        const showWhenCategorySelectedVal = formData.get('showWhenCategorySelectedValue');

        // If values are missing, try to set them again
        if (!isDefaultIconVal && isDefaultIconValue) {
            formData.set('isDefaultIconValue', isDefaultIconValue.value);
            console.warn('⚠️ isDefaultIconValue was missing, re-added:', isDefaultIconValue.value);
        }
        if (!showOnMainScreenVal && showOnMainScreenValue) {
            formData.set('showOnMainScreenValue', showOnMainScreenValue.value);
            console.warn('⚠️ showOnMainScreenValue was missing, re-added:', showOnMainScreenValue.value);
        }
        if (!showWhenCategorySelectedVal && showWhenCategorySelectedValue) {
            formData.set('showWhenCategorySelectedValue', showWhenCategorySelectedValue.value);
            console.warn('⚠️ showWhenCategorySelectedValue was missing, re-added:', showWhenCategorySelectedValue.value);
        }

        // Final check: verify timetable selection is still available (we use stored references)
        if (timetableFile) {
            console.log('📅 Final check - timetable file still available:', timetableFile.name);
        } else if (window.pendingTimetableForNewPlace) {
            console.log('📅 Final check - pending parsed timetable exists for new place:', window.pendingTimetableForNewPlace.filename);
        } else if (window.selectedTimetableFile) {
            timetableFile = window.selectedTimetableFile;
            console.log('📅 Final check - timetable file found in window.selectedTimetableFile:', timetableFile.name);
        } else {
            console.log('📅 Final check - no timetable file found');
        }

        // Debug: Log form data being sent - log each value separately to ensure they're visible
        console.log('📤 Sending form data to backend:');
        console.log('  - method:', method);
        console.log('  - url:', url);
        console.log('  - id:', id);
        console.log('  - name:', formData.get('name'));
        console.log('  - isDefaultIconValue:', formData.get('isDefaultIconValue'));
        console.log('  - showOnMainScreenValue:', formData.get('showOnMainScreenValue'));
        console.log('  - showWhenCategorySelectedValue:', formData.get('showWhenCategorySelectedValue'));
        console.log('  - timetableFile:', timetableFile ? timetableFile.name : 'NONE');
        console.log('  - Checkbox states:', {
            isDefaultIcon: isDefaultIconCheckbox ? isDefaultIconCheckbox.checked : 'NOT FOUND',
            showOnMainScreen: showOnMainScreenCheckbox ? showOnMainScreenCheckbox.checked : 'NOT FOUND',
            showWhenCategorySelected: showWhenCategorySelectedCheckbox ? showWhenCategorySelectedCheckbox.checked : 'NOT FOUND'
        });

        try {
            const response = await fetch(url, {
                method,
                body: formData,
                credentials: 'include'
            });
            if (!response.ok) {
                let errorMessage = 'Failed to save place.';
                try {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        const err = await response.json();
                        errorMessage = err.error || errorMessage;
                    } else {
                        const text = await response.text();
                        console.error('Non-JSON error response:', text);
                        errorMessage = `Server error (${response.status}): ${text.substring(0, 200)}`;
                    }
                } catch (parseError) {
                    console.error('Error parsing error response:', parseError);
                    errorMessage = `Server error (${response.status})`;
                }
                throw new Error(errorMessage);
            }
            const savedPlace = await response.json();

            // Debug: Log what was saved
            console.log('💾 Place saved, received from backend:', {
                name: savedPlace.name,
                showWhenCategorySelected: savedPlace.showWhenCategorySelected,
                showOnMainScreen: savedPlace.showOnMainScreen,
                isDefaultIcon: savedPlace.isDefaultIcon,
                icon: savedPlace.icon,
                timetable_file: savedPlace.timetable_file || 'NOT SET'
            });

            // Handle timetable file upload if one was selected (using the file we stored earlier)
            const removeTimetableBtn = document.getElementById('remove-timetable-btn');

            console.log('📅🔍 Checking timetable upload:', {
                hasRemoveBtn: !!removeTimetableBtn,
                shouldRemove: removeTimetableBtn?.dataset.shouldRemove === 'true',
                hasTimetableFile: !!timetableFile,
                timetableFileName: timetableFile?.name,
                savedPlaceId: savedPlace?.id
            });

            // Check if timetable should be removed
            if (removeTimetableBtn && removeTimetableBtn.dataset.shouldRemove === 'true') {
                console.log('🗑️ Removing timetable...');
                try {
                    const deleteResponse = await fetch(`${placeApiUrl}/${savedPlace.id}/timetable`, {
                        method: 'DELETE',
                        credentials: 'include'
                    });
                    if (deleteResponse.ok) {
                        console.log('✅ Timetable removed successfully');
                    } else {
                        const errorText = await deleteResponse.text();
                        console.error('❌ Failed to remove timetable:', errorText);
                    }
                } catch (error) {
                    console.error('Error removing timetable:', error);
                }
                removeTimetableBtn.dataset.shouldRemove = 'false';
            }
            // If a pending parsed timetable exists for new places (uploaded via dedicated button before saving)
            else if (window.pendingTimetableForNewPlace && savedPlace && savedPlace.id) {
                console.log('📤 Uploading pending timetable (pre-parsed) for new place ID:', savedPlace.id);
                try {
                    const timetableUrl = `${placeApiUrl}/${savedPlace.id}/timetable`;
                    const timetableResponse = await fetch(timetableUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(window.pendingTimetableForNewPlace.data)
                    });

                    if (timetableResponse.ok) {
                        const timetableResult = await timetableResponse.json();
                        console.log('✅ Pending timetable uploaded successfully:', timetableResult);
                        const timetableFileName = timetableResult.timetable_file || timetableResult.filename || window.pendingTimetableForNewPlace.filename;
                        if (timetableFileName) {
                            savedPlace.timetable_file = timetableFileName;
                            const placeIndex = allPlaces.findIndex(p => p.id == savedPlace.id);
                            if (placeIndex !== -1) allPlaces[placeIndex].timetable_file = timetableFileName;
                        }
                        // Clear pending
                        delete window.pendingTimetableForNewPlace;
                    } else {
                        const errorText = await timetableResponse.text();
                        console.error('❌ Pending timetable upload failed:', errorText);
                    }
                } catch (error) {
                    console.error('❌ Error uploading pending timetable:', error);
                }
            }
            // Check if new timetable file was uploaded (using the file we stored before form submission)
            else if (timetableFile && savedPlace && savedPlace.id) {
                console.log('📤🚀 Uploading timetable file:', timetableFile.name, 'for place ID:', savedPlace.id);
                try {
                    // Read the JSON file
                    const fileText = await timetableFile.text();
                    console.log('📄 Timetable file content length:', fileText.length);
                    const timetableData = JSON.parse(fileText);
                    console.log('📊 Parsed timetable data:', Object.keys(timetableData));

                    // Upload timetable to the place
                    const timetableUrl = `${placeApiUrl}/${savedPlace.id}/timetable`;
                    console.log('📤 POSTing to:', timetableUrl);
                    const timetableResponse = await fetch(timetableUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(timetableData),
                        credentials: 'include'
                    });

                    if (timetableResponse.ok) {
                        const timetableResult = await timetableResponse.json();
                        console.log('✅ Timetable uploaded successfully:', timetableResult);
                        // Update the saved place with the timetable_file (use filename if timetable_file not present)
                        const timetableFileName = timetableResult.timetable_file || timetableResult.filename;
                        if (timetableFileName) {
                            savedPlace.timetable_file = timetableFileName;
                            console.log('📅 Updated savedPlace.timetable_file:', savedPlace.timetable_file);

                            // Also update the place in allPlaces array
                            const placeIndex = allPlaces.findIndex(p => p.id == savedPlace.id);
                            if (placeIndex !== -1) {
                                allPlaces[placeIndex].timetable_file = timetableFileName;
                                console.log('📅 Updated allPlaces[' + placeIndex + '].timetable_file:', allPlaces[placeIndex].timetable_file);
                            }
                        }
                    } else {
                        const errorText = await timetableResponse.text();
                        console.error('❌ Timetable upload failed:', errorText);
                        let error;
                        try {
                            error = JSON.parse(errorText);
                        } catch {
                            error = { error: errorText };
                        }
                        throw new Error(error.error || 'Failed to upload timetable');
                    }
                } catch (error) {
                    console.error('❌ Error uploading timetable:', error);
                    alert(`⚠️ Place saved, but timetable upload failed: ${error.message}`);
                }
            } else {
                console.log('📅❌ No timetable file to upload', {
                    hasTimetableFile: !!timetableFile,
                    hasSavedPlace: !!savedPlace,
                    hasPlaceId: !!(savedPlace && savedPlace.id)
                });
            }

            if (id) {
                // Update existing place in the array
                const index = allPlaces.findIndex(p => p.id == id);
                if (index !== -1) {
                    allPlaces[index] = savedPlace;
                } else {
                    allPlaces.push(savedPlace); // Fallback
                }

                // Update the map marker for existing place
                console.log('🔄 Updating existing place:', savedPlace.name);
                updateMapMarker(savedPlace);

                // Show success message
                alert(`✅ Place "${savedPlace.name}" has been updated successfully!`);
            } else {
                // Add new place to the array
                allPlaces.push(savedPlace);
                console.log('➕ Added new place to array:', savedPlace.name);

                // Re-render all markers to ensure new place appears
                setTimeout(() => {
                    console.log('🔄 Re-rendering markers for new place');
                    renderMapMarkers(
                        currentFilter === 'all' || currentFilter === 'place' ? allPlaces : [],
                        currentFilter === 'all' || currentFilter === 'event' ? allEvents : []
                    );
                }, 50); // Reduced delay for faster response

                // Show success message
                alert(`✅ Place "${savedPlace.name}" has been created successfully!`);
            }

            resetForm();
            renderFilteredList();
        } catch (error) {
            console.error('Error saving place:', error);
            alert(`Error: ${error.message}`);
        } finally {
            // Restore button state
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    async function handleEventFormSubmit(e) {
        e.preventDefault();

        // Show loading indicator
        const submitBtn = eventForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = '⏳ Saving...';
        submitBtn.disabled = true;

        const formData = new FormData(eventForm);

        // Handle is_dynamic_location checkbox
        const isDynamicLocationCheckbox = document.getElementById('event-is-dynamic-location');
        if (isDynamicLocationCheckbox) {
            formData.set('is_dynamic_location', isDynamicLocationCheckbox.checked ? '1' : '0');
        }

        // CRITICAL: Add gallery-selected image to existingEventImages if it exists
        const eventImagesInput = document.getElementById('event-images');
        if (eventImagesInput && eventImagesInput.dataset.selectedImagePath) {
            const selectedImagePath = eventImagesInput.dataset.selectedImagePath;
            // Check if image is already in existingEventImages to avoid duplicates
            if (!existingEventImages.includes(selectedImagePath)) {
                existingEventImages.push(selectedImagePath);
                console.log('✅ Added gallery-selected image to event:', selectedImagePath);
            }
            // Clear the selected image path after adding it
            delete eventImagesInput.dataset.selectedImagePath;
        }

        formData.append('existingImages', JSON.stringify(existingEventImages));
        const id = formData.get('id');
        const url = id ? `/api/events/${id}` : eventApiUrl;
        const method = id ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method,
                body: formData,
                credentials: 'include'
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to save event.');
            }
            const savedEvent = await response.json();

            if (id) {
                // Update existing event in the array
                const index = allEvents.findIndex(e => e.id == id);
                if (index !== -1) {
                    allEvents[index] = savedEvent;
                } else {
                    // Event not found in array, but we're updating - this shouldn't happen
                    // Log error but don't add duplicate
                    console.error(`Event with ID ${id} not found in array during update`);
                }

                // Update the map marker for existing event
                updateMapMarker(savedEvent);

                // Show success message
                alert(`✅ Event "${savedEvent.name}" has been updated successfully!`);
            } else {
                // Add new event to the array
                allEvents.push(savedEvent);

                // Re-render all markers to ensure new event appears
                setTimeout(() => {
                    renderMapMarkers(
                        currentFilter === 'all' || currentFilter === 'place' ? allPlaces : [],
                        currentFilter === 'all' || currentFilter === 'event' ? allEvents : []
                    );
                }, 50); // Reduced delay for faster response

                // Show success message
                alert(`✅ Event "${savedEvent.name}" has been created successfully!`);
            }

            // Reset the event form after successful submission
            eventForm.reset();
            document.getElementById('event-id').value = '';
            document.getElementById('event-form-title').textContent = '<i class="fas fa-calendar-plus"></i> Add New Event';
            document.getElementById('submit-event-button').textContent = 'Add Event';
            existingEventImages = [];

            // Clear gallery-selected image indicator
            const eventImagesInput = document.getElementById('event-images');
            if (eventImagesInput) {
                delete eventImagesInput.dataset.selectedImagePath;
                const galleryIndicators = eventImagesInput.parentElement?.querySelector('.gallery-selected-images');
                if (galleryIndicators) {
                    galleryIndicators.remove();
                }
            }

            const existingImagesContainer = document.getElementById('existing-event-images-container');
            if (existingImagesContainer) {
                existingImagesContainer.style.display = 'none';
                const preview = document.getElementById('existing-event-images-preview');
                if (preview) preview.innerHTML = '';
            }

            document.getElementById('event-form-container').classList.add('hidden');
            document.getElementById('place-form-container').setAttribute('open', '');
            renderFilteredList();
        } catch (error) {
            console.error('Error saving event:', error);
            alert(`Error: ${error.message}`);
            // Restore button state on error
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    async function handlePlaceListClick(e) {
        const target = e.target;
        const li = target.closest('li[data-id]');
        const button = target.closest('button');

        if (button) { // A button was clicked
            const id = button.dataset.id;
            if (button.classList.contains('edit-btn')) {
                // Scroll the edit form into view when the list edit button is clicked
                document.querySelector('#place-form-container summary').scrollIntoView({ behavior: 'smooth', block: 'start' });

                try {
                    const response = await fetch(`${placeApiUrl}/${id}`, {
                        credentials: 'include'
                    });
                    if (!response.ok) throw new Error('Failed to fetch place details.');
                    const place = await response.json();
                    if (place) fillFormForEdit(place);
                } catch (error) {
                    console.error('Error fetching place for edit:', error);
                    alert(error.message);
                }
            } else if (button.classList.contains('delete-btn')) {
                const place = allPlaces.find(p => p.id == id);
                const placeName = place ? place.name : `place with ID ${id}`;

                // Prevent deletion of bus stops
                if (place && (place.category === 'Bus Stop' || place.category === 'BUS_STOP' || place.category === 'Bus Terminus')) {
                    alert('⚠️ Bus stops and bus terminals cannot be deleted here.\n\nPlease use the dedicated Bus Routes Editor (bus-editor.html) to manage bus stops and routes.');
                    return;
                }

                // Prevent deletion of tour stops
                if (place && (place.category === 'TOUR_STOP' || place.category === 'Tours')) {
                    alert('⚠️ Tour stops and tour routes cannot be deleted here.\n\nPlease use the dedicated Tour Routes Editor (new-route-editor.html) to manage tours and their stops.');
                    return;
                }

                if (confirm(`Are you sure you want to delete ${placeName}? This action cannot be undone.`)) {
                    try {
                        const response = await fetch(`${placeApiUrl}/${id}`, {
                            method: 'DELETE',
                            credentials: 'include'
                        });
                        if (!response.ok) throw new Error('Failed to delete.');

                        // Remove marker from map
                        if (markers[id]) {
                            map.removeLayer(markers[id]);
                            delete markers[id];
                        }

                        // Remove from local array and re-render
                        allPlaces = allPlaces.filter(p => p.id != id);
                        renderFilteredList();

                        alert(`${placeName} has been deleted successfully.`);

                    } catch (error) {
                        console.error('Error deleting place:', error);
                        alert('Failed to delete place.');
                    }
                }

            } else if (button.classList.contains('delete-event-btn')) {
                const event = allEvents.find(e => e.id == id);
                const eventName = event ? event.name : `event with ID ${id}`;
                if (confirm(`Are you sure you want to delete ${eventName}? This action cannot be undone.`)) {
                    try {
                        const response = await fetch(`/api/events/${id}`, {
                            method: 'DELETE',
                            credentials: 'include'
                        });
                        if (!response.ok) throw new Error('Failed to delete event.');

                        // Remove marker from map
                        const eventMarkerId = `event-${id}`;
                        if (markers[eventMarkerId]) {
                            map.removeLayer(markers[eventMarkerId]);
                            delete markers[eventMarkerId];
                        }

                        // Remove from local array and re-render
                        allEvents = allEvents.filter(e => e.id != id);
                        renderFilteredList();

                        alert(`${eventName} has been deleted successfully.`);

                    } catch (error) {
                        console.error('Error deleting event:', error);
                        alert('Failed to delete event.');
                    }
                }

            } else if (button.classList.contains('fetch-wiki-btn')) {
                const name = button.dataset.name;
                button.textContent = '...';
                button.disabled = true;
                try {
                    // Step 1: Search for pages
                    const searchResponse = await fetch(`${window.adminApiUrl}/search-wiki-pages`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ name })
                    });
                    const searchResult = await searchResponse.json();
                    if (!searchResponse.ok) throw new Error(searchResult.error);

                    // Step 2: Show confirmation modal to the user
                    const chosenTitle = await showWikiConfirmationModal(name, searchResult.titles);

                    if (chosenTitle) {
                        // Step 3: Fetch the image for the chosen page
                        const fetchResponse = await fetch(`${window.adminApiUrl}/fetch-wiki-image/${id}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ pageTitle: chosenTitle })
                        });
                        const fetchResult = await fetchResponse.json();
                        if (!fetchResponse.ok) throw new Error(fetchResult.error);

                        alert(fetchResult.message);
                        await fetchPlacesAndEvents();
                    }
                } catch (error) {
                    alert(`Error with Wikipedia Fetch: ${error.message}`);
                } finally {
                    button.textContent = 'Wiki';
                    button.disabled = false;
                }
            } else if (button.classList.contains('fetch-img-btn')) {
                const name = button.dataset.name;
                button.textContent = '...';
                button.disabled = true;
                try {
                    const response = await fetch(`${window.adminApiUrl}/fetch-images/${id}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ name }) // No longer sending category
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error);
                    alert(result.message);
                    await fetchPlacesAndEvents();
                } catch (error) {
                    alert(`Failed to fetch images from Pexels: ${error.message}`);
                } finally {
                    button.textContent = 'Img';
                    button.disabled = false;
                }
            }
        } else if (li) { // The list item itself was clicked
            const placeId = li.dataset.id;
            const marker = markers[placeId];
            if (marker) {
                marker.fire('click');
            }
        }
    }

    function fillFormForEdit(place) {
        // Prevent editing of bus stops
        if (place.category === 'Bus Stop' || place.category === 'BUS_STOP' || place.category === 'Bus Terminus') {
            alert('⚠️ Bus stops and bus terminals cannot be edited here.\n\nPlease use the dedicated Bus Routes Editor (bus-editor.html) to manage bus stops and routes.');
            return;
        }

        // Prevent editing of tour stops
        if (place.category === 'TOUR_STOP' || place.category === 'Tours') {
            alert('⚠️ Tour stops and tour routes cannot be edited here.\n\nPlease use the dedicated Tour Routes Editor (new-route-editor.html) to manage tours and their stops.');
            return;
        }

        placeIdInput.value = place.id;
        document.getElementById('name').value = place.name;
        document.getElementById('description').value = place.description;
        document.getElementById('latitude').value = place.latitude;
        document.getElementById('longitude').value = place.longitude;
        document.getElementById('website').value = place.website || '';
        const categorySelectEl = document.getElementById('category');
        if (categorySelectEl) {
            categorySelectEl.value = place.category || 'Other Site';
        }

        // Populate AIS fields
        const isDynamicLocationCheckbox = document.getElementById('place-is-dynamic-location');
        const placeAisConfig = document.getElementById('place-ais-config');
        if (isDynamicLocationCheckbox && placeAisConfig) {
            const isDynamic = place.is_dynamic_location === 1 || place.is_dynamic_location === true;
            isDynamicLocationCheckbox.checked = isDynamic;
            placeAisConfig.style.display = isDynamic ? 'block' : 'none';

            if (place.ais_provider) {
                document.getElementById('place-ais-provider').value = place.ais_provider;
            }
            if (place.ais_api_key) {
                document.getElementById('place-ais-api-key').value = place.ais_api_key;
            }
            if (place.ais_mmsi) {
                document.getElementById('place-ais-mmsi').value = place.ais_mmsi;
            }
        }

        // Handle timetable file info
        const timetableFileInfo = document.getElementById('timetable-file-info');
        const timetableFileName = document.getElementById('timetable-file-name');
        const timetableFileDisplay = document.getElementById('timetable-file-display');
        const removeTimetableBtn = document.getElementById('remove-timetable-btn');

        if (place.timetable_file) {
            if (timetableFileInfo) timetableFileInfo.style.display = 'block';
            if (timetableFileName) timetableFileName.textContent = place.timetable_file;
            if (removeTimetableBtn) {
                removeTimetableBtn.dataset.shouldRemove = 'false';
                removeTimetableBtn.onclick = function () {
                    if (confirm('Are you sure you want to remove the timetable for this place?')) {
                        removeTimetableBtn.dataset.shouldRemove = 'true';
                        timetableFileInfo.style.display = 'none';
                        if (timetableFileDisplay) timetableFileDisplay.value = '';
                        try { delete window.selectedTimetableFile; } catch (e) { }
                        try { delete window.pendingTimetableForNewPlace; } catch (e) { }
                    }
                };
            }
        } else {
            if (timetableFileInfo) timetableFileInfo.style.display = 'none';
            if (timetableFileName) timetableFileName.textContent = '';
            if (removeTimetableBtn) removeTimetableBtn.dataset.shouldRemove = 'false';
        }
        if (timetableFileInput) timetableFileInput.value = ''; // Clear file input on form fill

        // Handle custom icon
        const hasCustomIcon = place.icon && place.icon.startsWith('/uploads/');
        const iconPreview = document.getElementById('icon-preview');
        const iconPreviewContainer = document.getElementById('icon-preview-container');
        const existingIconInput = document.getElementById('existingIcon');
        // iconInput is already declared globally at line 85, reuse it

        if (hasCustomIcon) {
            // Construct full URL for icon preview
            const getApiBaseUrl = () => {
                if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                    return window.location.origin;
                }
                return 'http://localhost:3003';
            };
            const iconUrl = place.icon.startsWith('http') ? place.icon : `${getApiBaseUrl()}${place.icon}`;
            if (iconPreview) iconPreview.src = iconUrl;
            if (iconPreviewContainer) iconPreviewContainer.style.display = 'block';
            if (existingIconInput) existingIconInput.value = place.icon;
        } else {
            if (iconPreviewContainer) iconPreviewContainer.style.display = 'none';
            if (existingIconInput) existingIconInput.value = '';
        }
        if (iconInput) iconInput.value = ''; // Clear file input on form fill

        iconSizeSlider.value = place.iconSize || 32;
        iconSizeValue.textContent = place.iconSize || 32;

        // Handle isDefaultIcon checkbox
        const isDefaultIconCheckbox = document.getElementById('isDefaultIcon');
        const isDefaultIconValue = document.getElementById('isDefaultIconValue');
        const iconVisibilityGroup = document.getElementById('iconVisibilityGroup');
        const showOnMainScreenCheckbox = document.getElementById('showOnMainScreen');
        const showOnMainScreenValue = document.getElementById('showOnMainScreenValue');
        const showWhenCategorySelectedCheckbox = document.getElementById('showWhenCategorySelected');
        const showWhenCategorySelectedValue = document.getElementById('showWhenCategorySelectedValue');

        if (isDefaultIconCheckbox && isDefaultIconValue) {
            const isDefault = place.isDefaultIcon === 1 || place.isDefaultIcon === true;
            isDefaultIconCheckbox.checked = isDefault;
            isDefaultIconValue.value = isDefault ? '1' : '0';
        }

        // ALWAYS show the icon visibility toggles when editing a place - user needs to control visibility
        // This ensures the toggles are always accessible
        setTimeout(() => {
            if (iconVisibilityGroup) {
                // Check multiple ways to detect custom icon
                const hasIconInPlace = hasCustomIcon;
                const hasIconInInput = existingIconInput && existingIconInput.value && existingIconInput.value.startsWith('/uploads/');
                const hasIconPreview = iconPreviewContainer && iconPreviewContainer.style.display !== 'none' && iconPreviewContainer.style.display !== '';
                const hasIconFile = iconInput && iconInput.files && iconInput.files.length > 0;

                const shouldShow = hasIconInPlace || hasIconInInput || hasIconPreview || hasIconFile;

                // ALWAYS show the toggles if there's ANY indication of a custom icon, OR if the place category is Hotels
                // This ensures users can always control visibility
                if (shouldShow || place.category === 'Hotels' || place.category === '🏨 Hotels') {
                    iconVisibilityGroup.style.display = 'block';
                    console.log('✅✅✅ FORCING icon visibility group to show for place:', place.name, {
                        hasIconInPlace,
                        hasIconInInput,
                        hasIconPreview,
                        hasIconFile,
                        icon: place.icon,
                        category: place.category,
                        shouldShow,
                        forcing: true
                    });
                } else {
                    iconVisibilityGroup.style.display = 'none';
                    console.log('❌ Hiding icon visibility group - no custom icon detected:', {
                        hasIconInPlace,
                        hasIconInInput,
                        hasIconPreview,
                        hasIconFile,
                        icon: place.icon,
                        category: place.category
                    });
                }
            } else {
                console.error('❌❌❌ iconVisibilityGroup element not found! Check HTML structure!');
            }
        }, 200);

        // Handle showOnMainScreen checkbox
        if (showOnMainScreenCheckbox && showOnMainScreenValue) {
            // CRITICAL: Default to 0 (hide) if not set, so places with custom icons don't auto-show
            const showOnMain = place.showOnMainScreen !== undefined && place.showOnMainScreen !== null
                ? (place.showOnMainScreen === 1 || place.showOnMainScreen === true)
                : false; // Default to false (hide) - user must explicitly enable
            showOnMainScreenCheckbox.checked = showOnMain;
            showOnMainScreenValue.value = showOnMain ? '1' : '0';
            console.log('showOnMainScreen set to:', showOnMain, 'for place:', place.name);
        } else {
            console.error('showOnMainScreen checkbox or value element not found!');
        }

        // Handle showWhenCategorySelected checkbox
        if (showWhenCategorySelectedCheckbox && showWhenCategorySelectedValue) {
            // CRITICAL FIX: For places with custom icons, default to true (show) when category is selected
            // This ensures backward compatibility - when a user selects a category, places with custom icons should show
            const hasCustomIcon = place.icon && place.icon.startsWith('/uploads/');
            const showWhenCategory = place.showWhenCategorySelected !== undefined && place.showWhenCategorySelected !== null
                ? (place.showWhenCategorySelected === 1 || place.showWhenCategorySelected === true)
                : (hasCustomIcon ? true : false); // Default to true (show) if has custom icon, false (hide) otherwise
            showWhenCategorySelectedCheckbox.checked = showWhenCategory;
            showWhenCategorySelectedValue.value = showWhenCategory ? '1' : '0';
            console.log('showWhenCategorySelected set to:', showWhenCategory, 'for place:', place.name, 'hasCustomIcon:', hasCustomIcon);
        } else {
            console.error('showWhenCategorySelected checkbox or value element not found!');
        }

        // Setup checkbox listeners after form is filled (elements are now in DOM)
        setTimeout(() => {
            if (typeof window.setupCheckboxListeners === 'function') {
                window.setupCheckboxListeners();
            } else if (typeof setupCheckboxListeners === 'function') {
                setupCheckboxListeners();
            } else {
                console.error('❌ setupCheckboxListeners function not found!');
            }
        }, 300);

        // Update the collapsible summary text
        const summary = document.querySelector('#place-form-container summary');
        if (summary) {
            summary.textContent = `Edit Place (ID: ${place.id})`;
        }

        submitButton.textContent = 'Update Place';
        cancelEditButton.classList.remove('hidden');

        existingImages = place.image_urls || [];
        renderImagePreviews();

        // Scroll the edit form into view and handle the marker selection
        document.getElementById('place-form-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
        handleMarkerClick(place, false); // Select marker, but don't scroll the list
    }

    function fillFormForEventEdit(event) {
        console.log('Filling event form for edit:', event);
        showEventForm(); // Switch to the event form

        document.getElementById('event-id').value = event.id;
        document.getElementById('event-name').value = event.name;
        document.getElementById('event-description').value = event.description || '';
        document.getElementById('event-latitude').value = event.latitude;
        document.getElementById('event-longitude').value = event.longitude;
        document.getElementById('event-website').value = event.website || '';
        document.getElementById('event-category').value = event.category || '';

        // Populate AIS fields
        const isDynamicLocationCheckbox = document.getElementById('event-is-dynamic-location');
        const eventAisConfig = document.getElementById('event-ais-config');
        if (isDynamicLocationCheckbox && eventAisConfig) {
            const isDynamic = event.is_dynamic_location === 1 || event.is_dynamic_location === true;
            isDynamicLocationCheckbox.checked = isDynamic;
            eventAisConfig.style.display = isDynamic ? 'block' : 'none';

            if (event.ais_provider) {
                document.getElementById('event-ais-provider').value = event.ais_provider;
            }
            if (event.ais_api_key) {
                document.getElementById('event-ais-api-key').value = event.ais_api_key;
            }
            if (event.ais_mmsi) {
                document.getElementById('event-ais-mmsi').value = event.ais_mmsi;
            }
        }

        // Format and set datetime values in Malta timezone
        const formatDateTimeLocal = (datetime) => {
            if (!datetime) return '';
            const date = new Date(datetime);
            // Format in Malta timezone for datetime-local input
            const year = date.toLocaleString('en-US', { year: 'numeric', timeZone: 'Europe/Malta' });
            const month = String(date.toLocaleString('en-US', { month: '2-digit', timeZone: 'Europe/Malta' })).padStart(2, '0');
            const day = String(date.toLocaleString('en-US', { day: '2-digit', timeZone: 'Europe/Malta' })).padStart(2, '0');
            const hours = String(date.toLocaleString('en-US', { hour: '2-digit', hour12: false, timeZone: 'Europe/Malta' })).padStart(2, '0');
            const minutes = String(date.toLocaleString('en-US', { minute: '2-digit', timeZone: 'Europe/Malta' })).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        };

        document.getElementById('start_datetime').value = formatDateTimeLocal(event.start_datetime);
        document.getElementById('end_datetime').value = formatDateTimeLocal(event.end_datetime);

        document.getElementById('event-form-title').textContent = `Edit Event (ID: ${event.id})`;
        document.getElementById('submit-event-button').textContent = 'Update Event';

        existingEventImages = event.image_urls ? JSON.parse(event.image_urls) : [];
        console.log('Existing event images:', existingEventImages);
        renderEventImagePreviews();

        // Check for gallery-selected images and show them
        const eventImagesInput = document.getElementById('event-images');
        if (eventImagesInput && eventImagesInput.dataset.selectedImagePath) {
            // Clear any existing gallery indicators
            const existingIndicators = eventImagesInput.parentElement.querySelector('.gallery-selected-images');
            if (existingIndicators) {
                existingIndicators.remove();
            }

            // Show the selected image indicator
            const selectedImagePath = eventImagesInput.dataset.selectedImagePath;
            const indicator = document.createElement('div');
            indicator.className = 'selected-image-indicator';
            indicator.style.cssText = 'display: inline-block; margin: 5px; padding: 5px 10px; background: #10b981; color: white; border-radius: 5px; font-size: 12px;';
            indicator.innerHTML = `✓ ${selectedImagePath.split('/').pop()}`;

            const container = eventImagesInput.parentElement;
            const indicatorsDiv = document.createElement('div');
            indicatorsDiv.className = 'gallery-selected-images';
            indicatorsDiv.style.cssText = 'margin-top: 10px;';
            indicatorsDiv.appendChild(indicator);
            container.appendChild(indicatorsDiv);
        }
    }

    function renderEventImagePreviews() {
        existingEventImagesPreview.innerHTML = '';
        existingEventImagesContainer.style.display = existingEventImages.length > 0 ? 'block' : 'none';
        existingEventImages.forEach((imageUrl, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'img-preview-wrapper';
            wrapper.innerHTML = `<img src="${imageUrl}" alt="Event image" class="img-preview"><button type="button" class="remove-event-img-btn" data-index="${index}" title="Remove Image">&times;</button>`;
            existingEventImagesPreview.appendChild(wrapper);
        });

        existingEventImagesPreview.querySelectorAll('.remove-event-img-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const indexToRemove = parseInt(e.target.dataset.index, 10);
                existingEventImages.splice(indexToRemove, 1);
                renderEventImagePreviews();
            });
        });
    }

    function renderImagePreviews() {
        existingImagesPreview.innerHTML = '';
        existingImagesContainer.style.display = existingImages.length > 0 ? 'block' : 'none';
        existingImages.forEach((imageUrl, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'img-preview-wrapper';
            wrapper.innerHTML = `<img src="${imageUrl}" alt="Place image" class="img-preview"><button type="button" class="remove-img-btn" data-index="${index}" title="Remove Image">&times;</button>`;
            existingImagesPreview.appendChild(wrapper);
        });

        existingImagesPreview.querySelectorAll('.remove-img-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const indexToRemove = parseInt(e.target.dataset.index, 10);
                existingImages.splice(indexToRemove, 1);
                renderImagePreviews();
            });
        });
    }

    function resetForm() {
        placeForm.reset();
        eventForm.reset();
        placeIdInput.value = '';

        // Update the collapsible summary text
        const summary = document.querySelector('#place-form-container summary');
        if (summary) {
            summary.textContent = 'Add New Place';
        }

        submitButton.textContent = 'Add Place';
        cancelEditButton.classList.add('hidden');
        existingImagesContainer.style.display = 'none';
        existingImagesPreview.innerHTML = '';
        existingImages = [];
        existingEventImagesContainer.style.display = 'none';
        existingEventImagesPreview.innerHTML = '';
        existingEventImages = [];

        // Reset event form title and button text
        document.getElementById('event-id').value = '';
        document.getElementById('event-form-title').textContent = '<i class="fas fa-calendar-plus"></i> Add New Event';
        document.getElementById('submit-event-button').textContent = 'Add Event';

        // Reset icon fields
        iconInput.value = '';
        existingIconInput.value = '';
        iconPreviewContainer.style.display = 'none';
        iconSizeSlider.value = 32;

        // Reset timetable fields (we use dynamic uploader/display)
        const timetableFileDisplay = document.getElementById('timetable-file-display');
        const timetableFileInfo = document.getElementById('timetable-file-info');
        const removeTimetableBtn = document.getElementById('remove-timetable-btn');
        if (timetableFileDisplay) timetableFileDisplay.value = '';
        if (timetableFileInfo) timetableFileInfo.style.display = 'none';
        if (removeTimetableBtn) removeTimetableBtn.dataset.shouldRemove = 'false';
        try { delete window.selectedTimetableFile; } catch (e) { }
        try { delete window.pendingTimetableForNewPlace; } catch (e) { }
        iconSizeValue.textContent = 32;

        // Reset checkbox hidden field values to default (0 = unchecked)
        const isDefaultIconValue = document.getElementById('isDefaultIconValue');
        const showOnMainScreenValue = document.getElementById('showOnMainScreenValue');
        const showWhenCategorySelectedValue = document.getElementById('showWhenCategorySelectedValue');
        if (isDefaultIconValue) isDefaultIconValue.value = '0';
        if (showOnMainScreenValue) showOnMainScreenValue.value = '0';
        if (showWhenCategorySelectedValue) showWhenCategorySelectedValue.value = '0';

        // Reset checkbox checked states
        const isDefaultIconCheckbox = document.getElementById('isDefaultIcon');
        const showOnMainScreenCheckbox = document.getElementById('showOnMainScreen');
        const showWhenCategorySelectedCheckbox = document.getElementById('showWhenCategorySelected');
        if (isDefaultIconCheckbox) isDefaultIconCheckbox.checked = false;
        if (showOnMainScreenCheckbox) showOnMainScreenCheckbox.checked = false;
        if (showWhenCategorySelectedCheckbox) showWhenCategorySelectedCheckbox.checked = false;

        if (selectedPlaceId) {
            const oldListItem = document.querySelector(`li[data-id="${selectedPlaceId}"]`);
            oldListItem?.classList.remove('selected');
            const oldPlace = allPlaces.find(p => p.id == selectedPlaceId);
            if (oldPlace) updateMarkerStyle(oldPlace, false);
        }
        selectedPlaceId = null;

        // Remove the temporary new place marker if it exists
        if (newPlaceMarker) {
            map.removeLayer(newPlaceMarker);
            newPlaceMarker = null;
        }
    }

    // --- Data & Tile Management ---
    async function handleImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        if (!confirm('Are you sure? This will replace all existing places.')) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const places = JSON.parse(e.target.result);
                const response = await fetch(`${window.adminApiUrl}/import-places`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ places }),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                alert(result.message);
                await fetchPlacesAndEvents();
            } catch (error) {
                alert(`Import failed: ${error.message}`);
            }
        };
        reader.readAsText(file);
    }

    async function downloadTiles(region) {
        if (!confirm(`Start downloading tiles for ${region}? This is a long process.`)) return;

        try {
            const response = await fetch(`${window.adminApiUrl}/download-tiles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ region, minZoom: 10, maxZoom: 19 }),
            });
            if (response.status === 409) { // Conflict
                alert(await response.text());
                checkDownloadStatus(); // Start polling if a download is already in progress
                return;
            }
            if (!response.ok) {
                throw new Error(await response.text());
            }
            tileStatus.textContent = await response.text();
            tileStatus.style.display = 'block';
            checkDownloadStatus(); // Start polling
        } catch (error) {
            tileStatus.textContent = `Error: ${error.message}`;
            tileStatus.style.display = 'block';
        }
    }

    function checkDownloadStatus() {
        if (tileDownloadInterval) clearInterval(tileDownloadInterval); // Clear any existing timers

        tileDownloadInterval = setInterval(async () => {
            try {
                const response = await fetch(`${window.adminApiUrl}/download-status`, { credentials: 'include' });
                const status = await response.json();

                if (status.inProgress) {
                    downloadGozoBtn.disabled = true;
                    downloadCominoBtn.disabled = true;
                    progressBarContainer.style.display = 'block';
                    tileStatus.style.display = 'block';

                    const percentage = status.total > 0 ? (status.progress / status.total) * 100 : 0;
                    progressBar.style.width = `${percentage}%`;
                    progressBar.textContent = `${Math.round(percentage)}%`;
                    tileStatus.textContent = `[${status.region.toUpperCase()}] ${status.message}`;
                } else {
                    downloadGozoBtn.disabled = false;
                    downloadCominoBtn.disabled = false;
                    progressBar.textContent = '';
                    progressBarContainer.style.display = 'none';
                    if (status.total > 0) { // If a download has completed
                        tileStatus.textContent = status.message;
                        tileStatus.style.display = 'block';
                    } else {
                        tileStatus.style.display = 'none';
                    }
                    clearInterval(tileDownloadInterval);
                }
            } catch (error) {
                console.error('Failed to get download status:', error);
                tileStatus.textContent = 'Could not retrieve download status.';
                tileStatus.style.display = 'block';
                clearInterval(tileDownloadInterval);
            }
        }, 1000); // Poll every second
    }

    async function discoverPlaces() {
        const category = discoveryCategorySelect.value;
        const region = discoveryRegionSelect.value;
        discoveryStatus.textContent = `Searching for "${category}" in ${region}...`;
        discoveryStatus.style.display = 'block';
        discoverBtn.disabled = true;
        discoverAllBtn.disabled = true;
        try {
            const response = await fetch(`${window.adminApiUrl}/discover-places`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ category, region }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            discoveryStatus.textContent = result.message;
            await fetchPlacesAndEvents();
        } catch (error) {
            discoveryStatus.textContent = `Error: ${error.message}`;
        } finally {
            setTimeout(() => {
                discoverBtn.disabled = false;
                discoverAllBtn.disabled = false;
            }, 3000);
        }
    }

    async function discoverAllPlaces() {
        const region = discoveryRegionSelect.value;
        if (!confirm(`Discover places for ALL categories in ${region}? This will take several minutes.`)) return;
        discoveryStatus.textContent = `Starting full discovery for ${region}... Check server console for progress.`;
        discoveryStatus.style.display = 'block';
        discoverBtn.disabled = true;
        discoverAllBtn.disabled = true;
        try {
            const response = await fetch(`${window.adminApiUrl}/discover-all-places`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ region }),
            });
            const message = await response.text();
            discoveryStatus.textContent = message;
        } catch (error) {
            discoveryStatus.textContent = `Error: ${error.message}`;
        } finally {
            setTimeout(() => {
                discoverBtn.disabled = false;
                discoverAllBtn.disabled = false;
            }, 3000);
        }
    }

    function showWikiConfirmationModal(placeName, titles) {
        return new Promise((resolve) => {
            // Create modal elements
            const modalOverlay = document.createElement('div');
            modalOverlay.className = 'modal-overlay';

            const modalContent = document.createElement('div');
            modalContent.className = 'modal-content';

            let titleHtml = `<h3>Select Wikipedia Page for "${placeName}"</h3>`;
            let listHtml = '<ul class="wiki-results-list">';
            titles.forEach(title => {
                listHtml += `<li><button class="wiki-title-btn" data-title="${title}">${title}</button></li>`;
            });
            listHtml += '</ul>';

            const cancelBtnHtml = '<button id="wiki-cancel-btn" class="btn btn-danger" style="margin-top: 1rem;">Cancel</button>';

            modalContent.innerHTML = titleHtml + listHtml + cancelBtnHtml;
            modalOverlay.appendChild(modalContent);
            document.body.appendChild(modalOverlay);

            // Event listeners
            modalContent.addEventListener('click', (e) => {
                if (e.target.classList.contains('wiki-title-btn')) {
                    const chosenTitle = e.target.dataset.title;
                    document.body.removeChild(modalOverlay);
                    resolve(chosenTitle);
                } else if (e.target.id === 'wiki-cancel-btn') {
                    document.body.removeChild(modalOverlay);
                    resolve(null);
                }
            });
        });
    }


    // --- Custom Category Management ---
    let customCategories = [];
    let editingCategory = null;

    // Icon options for categories
    const iconOptions = [
        '📍', '🏛️', '🏖️', '🌄', '🔭', '🌳', '🎭', '🍔', '🛍️', '🤿',
        '🚽', '⛴️', '🚤', '🚌', '🚏', '🏘️', '🎉', '🏰', '⛪', '🕌',
        '🕍', '🏛️', '🏟️', '🎪', '🎨', '📚', '🏛️', '🌊', '🏔️', '🌋',
        '🏜️', '🏕️', '⛺', '🏞️', '🌅', '🌇', '🌆', '🏙️', '🌃', '🌌',
        '🎡', '🎢', '🎠', '🏗️', '🏭', '🏢', '🏬', '🏪', '🏫', '🏩',
        '🏨', '🏦', '🏥', '🏤', '🏣', '🏢', '🏡', '🏠', '🏘️', '🏚️',
        '⛩️', '🕋', '🛕', '🏛️', '⛪', '🕌', '🕍', '🛤️', '🛣️', '🗾',
        '🏔️', '⛰️', '🌋', '🗻', '🏕️', '⛺', '🏞️', '🛣️', '🛤️', '🌉',
        '🌁', '🌃', '🌆', '🌇', '🌅', '🌄', '🌌', '🌉', '🌊', '🏖️'
    ];

    // Load custom categories from localStorage
    async function loadCustomCategories() {
        try {
            // Try loading from localStorage first
            const saved = localStorage.getItem('customCategories');
            if (saved) {
                customCategories = JSON.parse(saved);
                console.log('✅ Custom categories loaded from localStorage:', customCategories);
                console.log('✅ Custom categories count:', customCategories.length);
            } else {
                // Fallback to loading from server/static file
                console.log('📥 localStorage empty, loading from server...');
                const response = await fetch('/custom-categories.json');
                if (response.ok) {
                    customCategories = await response.json();
                    console.log('✅ Custom categories loaded from static file:', customCategories);
                    console.log('✅ Custom categories count:', customCategories.length);
                    // Save to localStorage for future use
                    localStorage.setItem('customCategories', JSON.stringify(customCategories));
                } else {
                    console.warn('⚠️ Failed to load custom-categories.json, status:', response.status);
                    customCategories = [];
                }
            }
        } catch (error) {
            console.error('❌ Error loading custom categories:', error);
            customCategories = [];
        }

        // Verify Ferries category is loaded
        const ferriesCategory = customCategories.find(cat => cat.name === 'Ferries');
        if (ferriesCategory) {
            console.log('✅ Ferries category found:', ferriesCategory);
        } else {
            console.warn('⚠️ Ferries category NOT found in loaded categories');
        }

        renderCustomCategories();
        // Update main category filters when custom categories are loaded
        updateCategoryFilters();
    }

    // Save custom categories to server
    function saveCustomCategories() {
        console.log('Saving custom categories to server:', customCategories);

        fetch('/api/admin/custom-categories', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ categories: customCategories })
        })
            .then(response => response.json())
            .then(data => {
                console.log('Custom categories saved to server:', data);
                // Also save to localStorage for admin interface
                localStorage.setItem('customCategories', JSON.stringify(customCategories));
                // Also update the static file that frontend reads
                updateStaticFile();
                // Dispatch custom event to notify frontend of changes
                window.dispatchEvent(new CustomEvent('customCategoriesChanged'));
            })
            .catch(error => {
                console.error('Error saving custom categories:', error);
                // Fallback to localStorage
                localStorage.setItem('customCategories', JSON.stringify(customCategories));
                // Still try to update static file
                updateStaticFile();
            });
    }

    // Update the static file that frontend reads
    function updateStaticFile() {
        fetch('/api/admin/update-static-categories', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ categories: customCategories })
        })
            .then(response => response.json())
            .then(data => {
                console.log('Static file updated:', data);
            })
            .catch(error => {
                console.error('Error updating static file:', error);
            });
    }

    // Render all categories list (built-in + custom)
    function renderCustomCategories() {
        const container = document.getElementById('custom-categories-list');
        if (!container) return;

        const builtInCategories = Object.keys(CATEGORY_INFO);
        const allCategories = [
            ...builtInCategories.map(cat => ({
                id: `builtin-${cat}`,
                name: cat,
                icon: CATEGORY_INFO[cat].icon,
                isCustom: false
            })),
            ...customCategories
        ];

        container.innerHTML = allCategories.map(category => `
            <div class="category-item ${category.isCustom ? 'custom-category' : 'builtin-category'}" data-id="${category.id}">
                <div class="category-info">
                    <div class="category-icon">${category.icon}</div>
                    <div class="category-name">${category.name}</div>
                    ${category.isCustom ? '<span class="category-badge">Custom</span>' : '<span class="category-badge builtin">Built-in</span>'}
                </div>
                <div class="category-actions">
                    ${category.isCustom ? `
                        <button class="edit-category-btn" onclick="editCategory('${category.id}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="delete-category-btn" onclick="deleteCategory('${category.id}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    ` : `
                        <span class="builtin-note">Built-in category</span>
                    `}
                </div>
            </div>
        `).join('');
    }

    // Show add/edit category modal
    function showCategoryModal(category = null) {
        editingCategory = category;
        const isEdit = !!category;

        const modal = document.createElement('div');
        modal.className = 'category-modal';
        modal.innerHTML = `
            <div class="category-modal-content">
                <h3>${isEdit ? 'Edit Category' : 'Add New Category'}</h3>
                
                <div class="form-group">
                    <label for="category-name">Category Name</label>
                    <input type="text" id="category-name" placeholder="Enter category name..." value="${category ? category.name : ''}">
                </div>
                
                <div class="form-group">
                    <label>Select Icon</label>
                    <div class="icon-grid">
                        ${iconOptions.map(icon => `
                            <button class="icon-option ${category && category.icon === icon ? 'selected' : ''}" data-icon="${icon}">${icon}</button>
                        `).join('')}
                    </div>
                    <div class="selected-icon-preview">
                        <div class="icon">${category ? category.icon : '📍'}</div>
                        <p>Selected Icon</p>
                    </div>
                </div>
                
                <div class="modal-buttons">
                    <button class="save-btn" onclick="saveCategory()">
                        ${isEdit ? 'Update Category' : 'Add Category'}
                    </button>
                    <button class="cancel-btn" onclick="closeCategoryModal()">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Set initial selected icon
        const selectedIcon = category ? category.icon : '📍';
        updateSelectedIcon(selectedIcon);

        // Add event listeners
        modal.querySelectorAll('.icon-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const icon = e.target.dataset.icon;
                updateSelectedIcon(icon);
            });
        });
    }

    // Update selected icon in modal
    function updateSelectedIcon(icon) {
        const modal = document.querySelector('.category-modal');
        if (!modal) return;

        // Update selected state
        modal.querySelectorAll('.icon-option').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.icon === icon);
        });

        // Update preview
        const preview = modal.querySelector('.selected-icon-preview .icon');
        if (preview) {
            preview.textContent = icon;
        }
    }

    // Save category (add or edit)
    function saveCategory() {
        const modal = document.querySelector('.category-modal');
        if (!modal) return;

        const nameInput = modal.querySelector('#category-name');
        const selectedIconBtn = modal.querySelector('.icon-option.selected');

        if (!nameInput.value.trim()) {
            alert('Please enter a category name.');
            return;
        }

        if (!selectedIconBtn) {
            alert('Please select an icon.');
            return;
        }

        const categoryData = {
            name: nameInput.value.trim(),
            icon: selectedIconBtn.dataset.icon
        };

        if (editingCategory) {
            // Edit existing category
            const index = customCategories.findIndex(cat => cat.id === editingCategory.id);
            if (index !== -1) {
                customCategories[index] = {
                    ...customCategories[index],
                    ...categoryData
                };
            }
        } else {
            // Add new category
            const newCategory = {
                id: `custom-${Date.now()}`,
                ...categoryData,
                isCustom: true,
                createdAt: new Date().toISOString()
            };
            customCategories.push(newCategory);
        }

        saveCustomCategories();
        renderCustomCategories();
        updateCategoryFilters(); // Update main category filters
        closeCategoryModal();
    }

    // Edit category
    function editCategory(categoryId) {
        const category = customCategories.find(cat => cat.id === categoryId);
        if (category) {
            showCategoryModal(category);
        }
    }

    // Delete category
    function deleteCategory(categoryId) {
        if (confirm('Are you sure you want to delete this category?')) {
            customCategories = customCategories.filter(cat => cat.id !== categoryId);
            saveCustomCategories();
            renderCustomCategories();
            updateCategoryFilters(); // Update main category filters
        }
    }

    // Close category modal
    function closeCategoryModal() {
        const modal = document.querySelector('.category-modal');
        if (modal) {
            document.body.removeChild(modal);
        }
        editingCategory = null;
    }

    // Make functions globally available
    window.editCategory = editCategory;
    window.deleteCategory = deleteCategory;
    window.saveCategory = saveCategory;
    window.closeCategoryModal = closeCategoryModal;

    // --- Run Application ---
    initialize();
});

async function initHeaderMenuEditor() {
    const themeSel = document.getElementById('header-theme-select');
    const bpSel = document.getElementById('header-breakpoint-select');
    if (!themeSel || !bpSel) return;
    const headerBg = document.getElementById('header-bg');
    const headerShadow = document.getElementById('header-shadow');
    const headerBorderColor = document.getElementById('header-border-color');
    const logoUrl = document.getElementById('logo-url');
    const logoWidth = document.getElementById('logo-width');
    const logoHeight = document.getElementById('logo-height');
    const logoAlt = document.getElementById('logo-alt');
    const buttonsEditor = document.getElementById('buttons-editor');
    const saveBtn = document.getElementById('header-settings-save');
    const reloadBtn = document.getElementById('header-settings-reload');

    let settings = await fetchHeaderSettings();

    function ctx() {
        return settings[themeSel.value][bpSel.value];
    }

    function coerce(field, val) {
        if (field === 'fontSize' || field === 'letterSpacing') {
            const n = Number(val);
            return isNaN(n) ? val : n;
        }
        if (field === 'uppercase') return !!val;
        return val;
    }

    function renderButtons() {
        const c = ctx();
        const overrides = c.overrides || {};
        buttonsEditor.innerHTML = '';
        c.buttons.forEach((btn, idx) => {
            const ov = overrides[btn.key] || {};
            const row = document.createElement('div');
            row.className = 'input-group';
            row.innerHTML = `
                <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                  <span style="min-width:90px; font-weight:600;">${btn.key}</span>
                  <input type="text" data-idx="${idx}" data-field="label" value="${btn.label}" placeholder="Label" />
                  <input type="text" data-idx="${idx}" data-field="fontFamily" value="${btn.fontFamily}" placeholder="Font Family" />
                  <input type="number" data-idx="${idx}" data-field="fontSize" value="${btn.fontSize}" min="8" max="48" step="0.1" style="width:90px;" />
                  <input type="text" data-idx="${idx}" data-field="color" value="${ov.color || btn.color}" placeholder="Text Color" style="width:120px;" />
                  <input type="text" data-idx="${idx}" data-field="bg" value="${ov.bg || btn.bg}" placeholder="BG" style="width:120px;" />
                  <input type="text" data-idx="${idx}" data-field="borderColor" value="${ov.borderColor || btn.borderColor}" placeholder="Border Color" style="width:120px;" />
                </div>
            `;
            buttonsEditor.appendChild(row);
        });
        buttonsEditor.querySelectorAll('input').forEach(inp => {
            inp.addEventListener('input', (e) => {
                const idx = Number(e.target.getAttribute('data-idx'));
                const field = e.target.getAttribute('data-field');
                const c = ctx();
                const key = c.buttons[idx].key;
                c.overrides = c.overrides || {};
                c.overrides[key] = c.overrides[key] || {};
                if (['label', 'fontFamily', 'fontSize', 'letterSpacing', 'uppercase'].includes(field)) {
                    c.buttons[idx][field] = coerce(field, e.target.value);
                } else {
                    c.overrides[key][field] = e.target.value;
                }
            });
        });
    }

    function syncForm() {
        const c = ctx();
        headerBg.value = c.header.bg || '';
        headerShadow.value = c.header.shadow || '';
        headerBorderColor.value = c.header.borderColor || '';
        logoUrl.value = c.logo.url || '';
        logoWidth.value = c.logo.width || 40;
        logoHeight.value = c.logo.height || 40;
        logoAlt.value = c.logo.alt || '';
        renderButtons();
    }

    themeSel.addEventListener('change', syncForm);
    bpSel.addEventListener('change', syncForm);
    [headerBg, headerShadow, headerBorderColor].forEach(inp => inp && inp.addEventListener('input', () => {
        const c = ctx();
        c.header.bg = headerBg.value;
        c.header.shadow = headerShadow.value;
        c.header.borderColor = headerBorderColor.value;
    }));
    [logoUrl, logoWidth, logoHeight, logoAlt].forEach(inp => inp && inp.addEventListener('input', () => {
        const c = ctx();
        c.logo.url = logoUrl.value;
        c.logo.width = Number(logoWidth.value) || 40;
        c.logo.height = Number(logoHeight.value) || 40;
        c.logo.alt = logoAlt.value;
    }));

    reloadBtn.addEventListener('click', async () => {
        settings = await fetchHeaderSettings();
        syncForm();
        alert('Header settings reloaded.');
    });
    saveBtn.addEventListener('click', async () => {
        try {
            const res = await fetch('/api/settings/header', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(settings)
            });
            if (!res.ok) throw new Error(await res.text());
            settings = await res.json();
            alert('✅ Header settings saved.');
        } catch (e) {
            console.error(e);
            alert('❌ Failed to save header settings.');
        }
    });

    syncForm();
}

async function fetchHeaderSettings() {
    const res = await fetch('/api/settings/header', { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch header settings');
    return res.json();
}
// Tab switching logic
function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    // Remove active class from both tab-button and btn classes
    document.querySelectorAll('.tab-button, .btn').forEach(button => {
        button.classList.remove('active');
    });

    const tabElement = document.getElementById(`${tabId}-tab`);
    if (tabElement) {
        tabElement.classList.add('active');
    }

    // Try to find the button with either tab-button or btn class
    let tabButton = document.querySelector(`.tab-button[onclick="showTab('${tabId}')"]`);
    if (!tabButton) {
        tabButton = document.querySelector(`.btn[onclick="showTab('${tabId}')"]`);
    }
    if (tabButton) {
        tabButton.classList.add('active');
    }

    // Load analytics data only when the analytics tab is active
    if (tabId === 'analytics') {
        // Show the first sub-tab by default
        showAnalyticsSubTab('general-analytics');
    } else {
        destroyCharts(); // Destroy charts when switching away from analytics
        // Stop real-time feed when leaving analytics tab
        if (realtimeInterval) {
            stopRealtimeFeed();
        }
    }

}

// Initial tab display
document.addEventListener('DOMContentLoaded', () => {
    showTab('places-events'); // Default to places/events tab
    initializeAnalyticsControls(); // Initialize analytics controls
});

// --- Enhanced Analytics Functions ---
let analyticsCharts = {};
let miniMap = null;
let heatmapLayer = null;
let realtimeInterval = null;

async function loadAnalytics() {
    try {
        console.log('🔄 Starting analytics load...');
        // Show loading state
        showAnalyticsLoading();

        // Get selected period
        const period = document.getElementById('analytics-period')?.value || '30d';
        console.log('📊 Selected period:', period);

        // Fetch comprehensive analytics data
        console.log('🌐 Fetching analytics data...');
        const [analyticsResponse, tripAnalyticsResponse, comprehensiveResponse, realtimeResponse] = await Promise.all([
            fetch(`/api/analytics/summary?period=${period}`, { credentials: 'include' }),
            fetch(`/api/admin/trip-analytics?period=${period}`, { credentials: 'include' }),
            fetch(`/api/analytics/comprehensive?period=${period}`, { credentials: 'include' }),
            fetch('/api/analytics/real-time', { credentials: 'include' })
        ]);

        console.log('📡 API responses received:', {
            analytics: analyticsResponse.status,
            tripAnalytics: tripAnalyticsResponse.status,
            comprehensive: comprehensiveResponse.status,
            realtime: realtimeResponse.status
        });

        const analyticsData = await analyticsResponse.json();
        const tripAnalyticsData = await tripAnalyticsResponse.json();
        const comprehensiveData = await comprehensiveResponse.json();
        const realtimeData = await realtimeResponse.json();

        // Hide loading state and show charts
        hideAnalyticsLoading();

        destroyChartsOnly(); // Clear existing charts before rendering new ones (preserve heatmap)

        // Update stats overview
        updateStatsOverview(comprehensiveData, realtimeData);

        // Render all charts
        renderAnalyticsCharts(analyticsData);
        renderTripAnalyticsCharts(tripAnalyticsData);
        renderComprehensiveCharts(comprehensiveData);

        // Check if heatmap is already initialized and working
        const heatmapContainer = document.getElementById('gozo-heatmap');
        const existingMap = window.heatmapMap;

        if (heatmapContainer && heatmapContainer.children.length > 0 && existingMap) {
            console.log('Heatmap already initialized, skipping reinitialization');
        } else {
            // Wait a bit for the charts container to be visible before initializing heatmap
            setTimeout(() => {
                initializeHeatmap(comprehensiveData.heatmapData);
            }, 100);
        }

    } catch (error) {
        console.error('Failed to load analytics data:', error);
        hideAnalyticsLoading();
        showAnalyticsError('Could not load analytics data. Please try again.');
    }
}

function updateStatsOverview(comprehensiveData, realtimeData) {
    // Update stat cards
    document.getElementById('active-users').textContent = realtimeData.activeSessions?.active_users || 0;
    document.getElementById('total-views').textContent = comprehensiveData.sessionStats?.total_sessions || 0;
    document.getElementById('avg-session').textContent =
        comprehensiveData.sessionStats?.avg_session_duration ?
            Math.round(comprehensiveData.sessionStats.avg_session_duration / 60) + ' min' : '-';
    document.getElementById('places-visited').textContent =
        comprehensiveData.heatmapData?.length || 0;
}

function initializeHeatmap(heatmapData, retryCount = 0) {
    if (!heatmapData || heatmapData.length === 0) {
        console.log('No heatmap data available');
        return;
    }

    // Maximum retry limit for tab visibility
    if (retryCount >= 20) {
        console.error('Maximum retry limit reached for analytics tab visibility');
        return;
    }

    // Check if analytics tab is active and visible (for admin dashboard)
    // or if we're on the standalone analytics page
    const analyticsTab = document.getElementById('analytics-tab');
    const isStandaloneAnalytics = document.getElementById('analytics-content') !== null;

    if (!isStandaloneAnalytics && (!analyticsTab || !analyticsTab.classList.contains('active'))) {
        console.log(`Analytics tab not active (retry ${retryCount + 1}/20), deferring heatmap initialization`);
        // Retry after a delay
        setTimeout(() => initializeHeatmap(heatmapData, retryCount + 1), 500);
        return;
    }

    if (isStandaloneAnalytics) {
        console.log('Standalone analytics page detected, proceeding with heatmap initialization');
        // Force visibility for standalone analytics page
        const analyticsContent = document.getElementById('analytics-content');
        if (analyticsContent) {
            analyticsContent.style.display = 'block';
            analyticsContent.style.visibility = 'visible';
        }
    }

    // Get the heatmap container
    const heatmapContainer = document.getElementById('gozo-heatmap');
    if (!heatmapContainer) {
        console.warn('Heatmap container not found');
        return;
    }

    // Ensure container has proper dimensions and is visible
    heatmapContainer.style.display = 'block';
    heatmapContainer.style.visibility = 'visible';
    heatmapContainer.style.height = '450px';
    heatmapContainer.style.width = '100%';
    heatmapContainer.style.minHeight = '450px';
    heatmapContainer.style.maxHeight = '450px';
    heatmapContainer.style.borderRadius = '10px';
    heatmapContainer.style.overflow = 'hidden';
    heatmapContainer.style.margin = '0';

    // Clear any existing content
    heatmapContainer.innerHTML = '';

    // Create Leaflet map for heatmap with a small delay to ensure container is rendered
    setTimeout(() => {
        // Double-check container dimensions before creating map
        const rect = heatmapContainer.getBoundingClientRect();
        console.log('Final container check - dimensions:', rect, 'offsetWidth:', heatmapContainer.offsetWidth, 'offsetHeight:', heatmapContainer.offsetHeight);

        if (heatmapContainer.offsetWidth > 0 && heatmapContainer.offsetHeight > 0) {
            createLeafletHeatmap(heatmapData, heatmapContainer);
        } else {
            console.warn('Container still has zero dimensions, retrying...');
            // Force dimensions again
            heatmapContainer.style.height = '450px';
            heatmapContainer.style.width = '100%';
            heatmapContainer.style.minHeight = '450px';
            heatmapContainer.style.display = 'block';
            heatmapContainer.style.visibility = 'visible';
            createLeafletHeatmap(heatmapData, heatmapContainer);
        }
    }, 100);
}

function createLeafletHeatmap(heatmapData, container, retryCount = 0) {
    console.log('Creating Leaflet heatmap with data:', heatmapData, 'retry:', retryCount);

    // Clean up any existing map in the container
    if (window.heatmapMap) {
        console.log('Removing existing heatmap map...');
        window.heatmapMap.remove();
        window.heatmapMap = null;
    }

    // Clear container content
    container.innerHTML = '';

    // Check if container is visible and has dimensions
    const containerRect = container.getBoundingClientRect();
    const parentCharts = document.getElementById('analytics-charts');
    const parentAnalytics = document.getElementById('analytics-content');
    const isVisible = container.offsetParent !== null &&
        container.style.display !== 'none' &&
        container.style.visibility !== 'hidden' &&
        (parentCharts?.style.display !== 'none' || parentAnalytics?.style.display !== 'none');

    console.log('Container dimensions:', containerRect, 'isVisible:', isVisible, 'parentCharts visible:', parentCharts?.style.display, 'parentAnalytics visible:', parentAnalytics?.style.display);

    // Maximum retry limit to prevent infinite loops
    if (retryCount >= 10) {
        console.error('Maximum retry limit reached. Container may not be visible or properly sized.');
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Heatmap container not available. Please ensure the analytics tab is visible.</div>';
        return;
    }

    if (containerRect.width === 0 || containerRect.height === 0 || !isVisible) {
        console.warn(`Container has zero dimensions or is not visible (retry ${retryCount + 1}/10), waiting for proper sizing...`);

        // Ensure parent charts container is visible
        if (parentCharts) {
            parentCharts.style.display = 'block';
        }

        // Set minimum dimensions
        container.style.width = '100%';
        container.style.height = '400px';
        container.style.minHeight = '400px';
        container.style.display = 'block';
        container.style.visibility = 'visible';

        // Wait for next frame to ensure dimensions are applied
        requestAnimationFrame(() => {
            createLeafletHeatmap(heatmapData, container, retryCount + 1);
        });
        return;
    }

    // Aggregate visits by location (group by place name only)
    const aggregatedData = {};
    heatmapData.forEach(point => {
        const key = point.place_name; // Group by place name only
        if (!aggregatedData[key]) {
            aggregatedData[key] = {
                place_name: point.place_name,
                latitude: point.latitude,
                longitude: point.longitude,
                category: point.category,
                visit_count: 0
            };
        }
        aggregatedData[key].visit_count += point.visit_count;
        // Use the first occurrence's coordinates
        aggregatedData[key].latitude = point.latitude;
        aggregatedData[key].longitude = point.longitude;
    });

    const aggregatedPoints = Object.values(aggregatedData);
    console.log('Aggregated heatmap data:', aggregatedPoints);
    console.log('Sample coordinates:', aggregatedPoints.slice(0, 5).map(p => ({
        name: p.place_name,
        lat: p.latitude,
        lon: p.longitude
    })));

    // Log the actual coordinate values
    console.log('First 3 coordinates:', aggregatedPoints.slice(0, 3).map(p =>
        `"${p.place_name}": [${p.latitude}, ${p.longitude}]`
    ));

    // Calculate max visits for normalization
    const maxVisits = Math.max(...aggregatedPoints.map(p => p.visit_count));
    console.log('Max visits for normalization:', maxVisits);

    // Use real data only - no dummy data generation

    // Create Leaflet map with same settings as Places & Events tab
    const map = L.map(container, {
        center: [36.045, 14.25], // Same as Places & Events tab
        zoom: 13, // Same zoom level
        zoomControl: true,
        attributionControl: false
    });

    // Store map reference globally for cleanup
    window.heatmapMap = map;

    // Wait for map to be ready before adding layers
    map.whenReady(() => {
        console.log('Map is ready, adding heatmap layer...');
        addHeatmapLayer(map, aggregatedPoints, maxVisits);
    });

    // Set the same bounds as Places & Events tab
    const gozoBounds = L.latLngBounds([35.98, 14.15], [36.09, 14.40]);
    map.setMaxBounds(gozoBounds);

    // Add the same tile layer as Places & Events tab
    // Add cache-busting parameter to tile URLs to prevent stale cache issues
    const cacheBuster = new Date().getTime();

    L.tileLayer('/tiles/gozo/{z}/{x}/{y}.png?v=' + cacheBuster, {
        maxZoom: 19,
        minZoom: 12,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
}

function addHeatmapLayer(map, aggregatedPoints, maxVisits) {
    try {
        console.log('Adding heatmap layer to map...');

        // Create foggy heatmap layer with vivid cloud colors
        const heatmapLayer = L.heatLayer([], {
            radius: 60,
            blur: 50,
            maxZoom: 17,
            max: 1.0,
            gradient: {
                0.0: 'rgba(0, 0, 255, 0.0)', // Transparent
                0.2: 'rgba(0, 0, 255, 0.4)', // Blue cloud
                0.4: 'rgba(0, 255, 0, 0.5)', // Green cloud
                0.6: 'rgba(255, 255, 0, 0.6)', // Yellow cloud
                0.8: 'rgba(255, 165, 0, 0.7)', // Orange cloud
                1.0: 'rgba(255, 0, 0, 0.8)' // Red cloud
            }
        }).addTo(map);

        console.log('Heatmap layer created and added to map');

        // Convert aggregated data to heatmap points
        const heatmapPoints = aggregatedPoints.map(point => {
            const intensity = maxVisits > 0 ? point.visit_count / maxVisits : 0;
            return [parseFloat(point.latitude), parseFloat(point.longitude), intensity];
        });

        // Set heatmap data
        heatmapLayer.setLatLngs(heatmapPoints);

        console.log('Heatmap data set successfully');
        console.log('Heatmap points created:', heatmapPoints.length);
        console.log('Sample heatmap points:', heatmapPoints.slice(0, 3));

        // Add visible foggy markers as fallback
        aggregatedPoints.forEach(point => {
            const intensity = maxVisits > 0 ? point.visit_count / maxVisits : 0;
            const radius = 15 + (intensity * 25); // 15-40px radius based on intensity

            // Color based on intensity with vivid colors
            let color = 'rgba(255, 0, 0, 0.4)'; // Default red cloud
            if (intensity >= 0.8) color = 'rgba(255, 0, 0, 0.6)'; // Red cloud
            else if (intensity >= 0.6) color = 'rgba(255, 165, 0, 0.5)'; // Orange cloud
            else if (intensity >= 0.4) color = 'rgba(255, 255, 0, 0.4)'; // Yellow cloud
            else if (intensity >= 0.2) color = 'rgba(0, 255, 0, 0.3)'; // Green cloud
            else color = 'rgba(0, 0, 255, 0.2)'; // Blue cloud

            // Create visible foggy markers
            const marker = L.circleMarker([parseFloat(point.latitude), parseFloat(point.longitude)], {
                radius: radius,
                fillColor: color,
                color: 'rgba(255, 255, 255, 0.3)',
                weight: 1,
                opacity: 0.6,
                fillOpacity: 0.4
            }).addTo(map);

            marker.bindPopup(`
            <div style="background: rgba(0, 0, 0, 0.8); color: white; padding: 10px; border-radius: 8px; text-align: center;">
                <strong style="color: #FFD700;">${point.place_name}</strong><br>
                <span style="color: #00FF7F;">Category: ${point.category}</span><br>
                <span style="color: #00BFFF;">Visits: ${point.visit_count}</span><br>
                <span style="color: #FF6347;">Intensity: ${Math.round(intensity * 100)}%</span>
            </div>
        `);
        });

        // Add legend
        const legend = L.control({ position: 'topright' });
        legend.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'heatmap-legend');
            div.style.cssText = `
                background: rgba(0, 0, 0, 0.85);
                color: white;
                padding: 12px;
                border-radius: 8px;
                font-size: 12px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            `;
            div.innerHTML = `
                <h4 style="margin: 0 0 10px 0; color: #FFD700;">Tourist Movement Clouds</h4>
                <div style="display: flex; align-items: center; margin-bottom: 6px;">
                    <div style="width: 20px; height: 12px; background: linear-gradient(90deg, rgba(255, 0, 0, 0.8), rgba(255, 0, 0, 0.4)); border-radius: 6px; margin-right: 8px; box-shadow: 0 2px 4px rgba(255, 0, 0, 0.4);"></div>
                    <span>Red Cloud (80-100%)</span>
                </div>
                <div style="display: flex; align-items: center; margin-bottom: 6px;">
                    <div style="width: 20px; height: 12px; background: linear-gradient(90deg, rgba(255, 165, 0, 0.7), rgba(255, 165, 0, 0.3)); border-radius: 6px; margin-right: 8px; box-shadow: 0 2px 4px rgba(255, 165, 0, 0.4);"></div>
                    <span>Orange Cloud (60-80%)</span>
                </div>
                <div style="display: flex; align-items: center; margin-bottom: 6px;">
                    <div style="width: 20px; height: 12px; background: linear-gradient(90deg, rgba(255, 255, 0, 0.6), rgba(255, 255, 0, 0.3)); border-radius: 6px; margin-right: 8px; box-shadow: 0 2px 4px rgba(255, 255, 0, 0.4);"></div>
                    <span>Yellow Cloud (40-60%)</span>
                </div>
                <div style="display: flex; align-items: center; margin-bottom: 6px;">
                    <div style="width: 20px; height: 12px; background: linear-gradient(90deg, rgba(0, 255, 0, 0.5), rgba(0, 255, 0, 0.2)); border-radius: 6px; margin-right: 8px; box-shadow: 0 2px 4px rgba(0, 255, 0, 0.4);"></div>
                    <span>Green Cloud (20-40%)</span>
                </div>
                <div style="display: flex; align-items: center;">
                    <div style="width: 20px; height: 12px; background: linear-gradient(90deg, rgba(0, 0, 255, 0.4), rgba(0, 0, 255, 0.1)); border-radius: 6px; margin-right: 8px; box-shadow: 0 2px 4px rgba(0, 0, 255, 0.4);"></div>
                    <span>Blue Cloud (0-20%)</span>
                </div>
            `;
            return div;
        };
        legend.addTo(map);

        console.log('Leaflet heatmap created with', heatmapPoints.length, 'points');
    } catch (error) {
        console.error('Error adding heatmap layer:', error);
    }
}

function createStaticHeatmap(heatmapData, container) {
    // Create SVG container with proper aspect ratio for Gozo map
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '600px'); // Reasonable height
    svg.setAttribute('viewBox', '0 0 800 600'); // Balanced viewBox
    svg.style.borderRadius = '15px';
    svg.style.background = '#f0f0f0'; // Light background instead of gradient

    // Add Gozo map background image (smaller, zoomed out)
    const mapImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    mapImage.setAttribute('href', '/images/gozo-map.png');
    mapImage.setAttribute('x', '100'); // Center horizontally
    mapImage.setAttribute('y', '50'); // Center vertically
    mapImage.setAttribute('width', '600'); // Smaller width
    mapImage.setAttribute('height', '450'); // Smaller height
    mapImage.setAttribute('preserveAspectRatio', 'xMidYMid meet'); // Maintain aspect ratio, don't crop
    mapImage.setAttribute('opacity', '1.0');
    svg.appendChild(mapImage);

    // Add a subtle border around the image
    const imageBorder = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    imageBorder.setAttribute('x', '100'); // Match image position
    imageBorder.setAttribute('y', '50'); // Match image position
    imageBorder.setAttribute('width', '600'); // Match image width
    imageBorder.setAttribute('height', '450'); // Match image height
    imageBorder.setAttribute('fill', 'none');
    imageBorder.setAttribute('stroke', 'rgba(0, 0, 0, 0.2)');
    imageBorder.setAttribute('stroke-width', '2');
    svg.appendChild(imageBorder);

    // Add title
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', '400');
    title.setAttribute('y', '30');
    title.setAttribute('text-anchor', 'middle');
    title.setAttribute('fill', '#333');
    title.setAttribute('font-size', '18');
    title.setAttribute('font-weight', 'bold');
    title.textContent = 'Gozo Tourist Traffic Heatmap';
    svg.appendChild(title);

    // Aggregate visits by location (group by place name only)
    const aggregatedData = {};
    heatmapData.forEach(point => {
        const key = point.place_name; // Group by place name only
        if (!aggregatedData[key]) {
            aggregatedData[key] = {
                place_name: point.place_name,
                latitude: point.latitude,
                longitude: point.longitude,
                category: point.category,
                visit_count: 0
            };
        }
        aggregatedData[key].visit_count += point.visit_count;
        // Use the first occurrence's coordinates (or average them if needed)
        aggregatedData[key].latitude = point.latitude;
        aggregatedData[key].longitude = point.longitude;
    });

    const aggregatedPoints = Object.values(aggregatedData);
    console.log('Aggregated heatmap data:', aggregatedPoints);

    // Calculate max visits for normalization
    const maxVisits = Math.max(...aggregatedPoints.map(p => p.visit_count));
    console.log('Max visits for normalization:', maxVisits);
    console.log('Visit counts sample:', aggregatedPoints.slice(0, 10).map(p => ({ name: p.place_name, visits: p.visit_count })));

    // Use real data only - no dummy data generation

    // Create heatmap overlay using radial gradients and blur effects
    const currentMaxVisits = Math.max(...aggregatedPoints.map(p => p.visit_count));

    // Create a group for the heatmap overlay
    const heatmapGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    heatmapGroup.setAttribute('id', 'heatmap-overlay');

    // Create radial gradients for each intensity level
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    // High intensity (red) gradient
    const redGradient = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
    redGradient.setAttribute('id', 'red-heat');
    redGradient.setAttribute('cx', '50%');
    redGradient.setAttribute('cy', '50%');
    redGradient.setAttribute('r', '50%');

    const redStop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    redStop1.setAttribute('offset', '0%');
    redStop1.setAttribute('stop-color', '#ff0000');
    redStop1.setAttribute('stop-opacity', '0.8');
    redGradient.appendChild(redStop1);

    const redStop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    redStop2.setAttribute('offset', '70%');
    redStop2.setAttribute('stop-color', '#ff0000');
    redStop2.setAttribute('stop-opacity', '0.3');
    redGradient.appendChild(redStop2);

    const redStop3 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    redStop3.setAttribute('offset', '100%');
    redStop3.setAttribute('stop-color', '#ff0000');
    redStop3.setAttribute('stop-opacity', '0');
    redGradient.appendChild(redStop3);

    // Orange gradient
    const orangeGradient = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
    orangeGradient.setAttribute('id', 'orange-heat');
    orangeGradient.setAttribute('cx', '50%');
    orangeGradient.setAttribute('cy', '50%');
    orangeGradient.setAttribute('r', '50%');

    const orangeStop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    orangeStop1.setAttribute('offset', '0%');
    orangeStop1.setAttribute('stop-color', '#ff8800');
    orangeStop1.setAttribute('stop-opacity', '0.7');
    orangeGradient.appendChild(orangeStop1);

    const orangeStop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    orangeStop2.setAttribute('offset', '70%');
    orangeStop2.setAttribute('stop-color', '#ff8800');
    orangeStop2.setAttribute('stop-opacity', '0.2');
    orangeGradient.appendChild(orangeStop2);

    const orangeStop3 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    orangeStop3.setAttribute('offset', '100%');
    orangeStop3.setAttribute('stop-color', '#ff8800');
    orangeStop3.setAttribute('stop-opacity', '0');
    orangeGradient.appendChild(orangeStop3);

    // Yellow gradient
    const yellowGradient = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
    yellowGradient.setAttribute('id', 'yellow-heat');
    yellowGradient.setAttribute('cx', '50%');
    yellowGradient.setAttribute('cy', '50%');
    yellowGradient.setAttribute('r', '50%');

    const yellowStop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    yellowStop1.setAttribute('offset', '0%');
    yellowStop1.setAttribute('stop-color', '#ffff00');
    yellowStop1.setAttribute('stop-opacity', '0.6');
    yellowGradient.appendChild(yellowStop1);

    const yellowStop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    yellowStop2.setAttribute('offset', '70%');
    yellowStop2.setAttribute('stop-color', '#ffff00');
    yellowStop2.setAttribute('stop-opacity', '0.15');
    yellowGradient.appendChild(yellowStop2);

    const yellowStop3 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    yellowStop3.setAttribute('offset', '100%');
    yellowStop3.setAttribute('stop-color', '#ffff00');
    yellowStop3.setAttribute('stop-opacity', '0');
    yellowGradient.appendChild(yellowStop3);

    // Green gradient
    const greenGradient = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
    greenGradient.setAttribute('id', 'green-heat');
    greenGradient.setAttribute('cx', '50%');
    greenGradient.setAttribute('cy', '50%');
    greenGradient.setAttribute('r', '50%');

    const greenStop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    greenStop1.setAttribute('offset', '0%');
    greenStop1.setAttribute('stop-color', '#00ff00');
    greenStop1.setAttribute('stop-opacity', '0.4');
    greenGradient.appendChild(greenStop1);

    const greenStop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    greenStop2.setAttribute('offset', '70%');
    greenStop2.setAttribute('stop-color', '#00ff00');
    greenStop2.setAttribute('stop-opacity', '0.1');
    greenGradient.appendChild(greenStop2);

    const greenStop3 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    greenStop3.setAttribute('offset', '100%');
    greenStop3.setAttribute('stop-color', '#00ff00');
    greenStop3.setAttribute('stop-opacity', '0');
    greenGradient.appendChild(greenStop3);

    defs.appendChild(redGradient);
    defs.appendChild(orangeGradient);
    defs.appendChild(yellowGradient);
    defs.appendChild(greenGradient);
    svg.appendChild(defs);

    // Create heatmap blobs for each area
    aggregatedPoints.forEach((point, index) => {
        // Convert lat/lon to SVG coordinates
        const x = 100 + ((parseFloat(point.longitude) - 14.15) / (14.40 - 14.15)) * 600;
        const y = 50 + ((36.09 - parseFloat(point.latitude)) / (36.09 - 35.98)) * 450;

        // Calculate intensity and determine gradient
        const intensity = currentMaxVisits > 0 ? point.visit_count / currentMaxVisits : 0;
        let gradientId;
        let radius;

        if (intensity > 0.8) {
            gradientId = 'red-heat';
            radius = 80; // Large area for high traffic
        } else if (intensity > 0.6) {
            gradientId = 'orange-heat';
            radius = 60; // Medium-large area
        } else if (intensity > 0.4) {
            gradientId = 'yellow-heat';
            radius = 40; // Medium area
        } else {
            gradientId = 'green-heat';
            radius = 25; // Small area for low traffic
        }

        // Create heatmap blob
        const blob = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        blob.setAttribute('cx', x);
        blob.setAttribute('cy', y);
        blob.setAttribute('r', radius);
        blob.setAttribute('fill', `url(#${gradientId})`);
        blob.setAttribute('opacity', '0.8');

        // Add blur effect for fog-like appearance
        blob.setAttribute('filter', 'url(#blur)');

        // Add hover effect
        blob.addEventListener('mouseenter', (e) => {
            blob.setAttribute('opacity', '1');
            blob.setAttribute('r', radius + 10);

            // Create tooltip
            const tooltip = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            tooltip.setAttribute('x', x);
            tooltip.setAttribute('y', y - radius - 20);
            tooltip.setAttribute('text-anchor', 'middle');
            tooltip.setAttribute('fill', '#333');
            tooltip.setAttribute('font-size', '12');
            tooltip.setAttribute('font-weight', 'bold');
            tooltip.setAttribute('id', 'tooltip-' + index);
            tooltip.textContent = `${point.place_name}: ${point.visit_count} visits`;
            svg.appendChild(tooltip);
        });

        blob.addEventListener('mouseleave', () => {
            blob.setAttribute('opacity', '0.8');
            blob.setAttribute('r', radius);

            // Remove tooltip
            const tooltip = document.getElementById('tooltip-' + index);
            if (tooltip) {
                svg.removeChild(tooltip);
            }
        });

        heatmapGroup.appendChild(blob);
    });

    // Add blur filter for fog effect
    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.setAttribute('id', 'blur');
    const feGaussianBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
    feGaussianBlur.setAttribute('stdDeviation', '3');
    filter.appendChild(feGaussianBlur);
    defs.appendChild(filter);

    svg.appendChild(heatmapGroup);

    // Add some decorative elements
    const decoration = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    decoration.setAttribute('x', '400');
    decoration.setAttribute('y', '580'); // Positioned near bottom of 600px container
    decoration.setAttribute('text-anchor', 'middle');
    decoration.setAttribute('fill', 'rgba(0, 0, 0, 0.6)');
    decoration.setAttribute('font-size', '12');
    decoration.textContent = 'Hover over colored areas to see tourist density details';
    svg.appendChild(decoration);

    container.appendChild(svg);

    // Debug: Log container and SVG dimensions
    console.log('Container dimensions:', {
        width: container.offsetWidth,
        height: container.offsetHeight,
        clientWidth: container.clientWidth,
        clientHeight: container.clientHeight
    });
    console.log('SVG dimensions:', {
        width: svg.offsetWidth,
        height: svg.offsetHeight,
        clientWidth: svg.clientWidth,
        clientHeight: svg.clientHeight
    });

    console.log('Static heatmap created successfully');
}

function addHeatmapLegend() {
    // Create a simple HTML legend instead of Leaflet control
    const heatmapContainer = document.getElementById('gozo-heatmap');
    if (!heatmapContainer) return;

    const legend = document.createElement('div');
    legend.className = 'heatmap-legend-static';
    legend.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 15px;
        border-radius: 10px;
        font-size: 12px;
        z-index: 1000;
    `;

    legend.innerHTML = `
        <h4 style="margin: 0 0 10px 0; font-size: 14px;">Tourist Density Heatmap</h4>
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
            <div style="width: 20px; height: 20px; background: radial-gradient(circle, rgba(255,0,0,0.8) 0%, rgba(255,0,0,0.3) 70%, transparent 100%); border-radius: 50%; margin-right: 8px;"></div>
            <span>High Traffic (80-100%)</span>
        </div>
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
            <div style="width: 20px; height: 20px; background: radial-gradient(circle, rgba(255,136,0,0.7) 0%, rgba(255,136,0,0.2) 70%, transparent 100%); border-radius: 50%; margin-right: 8px;"></div>
            <span>Medium-High (60-80%)</span>
        </div>
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
            <div style="width: 20px; height: 20px; background: radial-gradient(circle, rgba(255,255,0,0.6) 0%, rgba(255,255,0,0.15) 70%, transparent 100%); border-radius: 50%; margin-right: 8px;"></div>
            <span>Medium (40-60%)</span>
        </div>
        <div style="display: flex; align-items: center;">
            <div style="width: 20px; height: 20px; background: radial-gradient(circle, rgba(0,255,0,0.4) 0%, rgba(0,255,0,0.1) 70%, transparent 100%); border-radius: 50%; margin-right: 8px;"></div>
            <span>Low (0-40%)</span>
        </div>
        <div style="margin-top: 10px; font-size: 10px; opacity: 0.8;">
            Larger areas = more tourist activity
        </div>
    `;

    heatmapContainer.appendChild(legend);
}

function renderComprehensiveCharts(data) {
    // Device & Browser Usage Chart
    if (data.deviceStats && data.deviceStats.length > 0) {
        const deviceCanvas = document.getElementById('device-stats-chart');
        if (!deviceCanvas) {
            console.warn('device-stats-chart canvas not found');
            return;
        }
        const deviceCtx = deviceCanvas.getContext('2d');
        analyticsCharts.deviceStats = new Chart(deviceCtx, {
            type: 'doughnut',
            data: {
                labels: data.deviceStats.map(d => `${d.device_type || 'Unknown'} (${d.browser || 'Unknown'})`),
                datasets: [{
                    data: data.deviceStats.map(d => d.count),
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.6)', 'rgba(54, 162, 235, 0.6)', 'rgba(255, 206, 86, 0.6)',
                        'rgba(75, 192, 192, 0.6)', 'rgba(153, 102, 255, 0.6)', 'rgba(255, 159, 64, 0.6)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)', 'rgba(54, 162, 235, 1)', 'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)', 'rgba(153, 102, 255, 1)', 'rgba(255, 159, 64, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: addWhiteTextColors({
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right' }
                }
            })
        });
    }

    // Hourly Stats Chart
    if (data.hourlyStats && data.hourlyStats.length > 0) {
        const hourlyCanvas = document.getElementById('hourly-stats-chart');
        if (!hourlyCanvas) {
            console.warn('hourly-stats-chart canvas not found');
            return;
        }
        const hourlyCtx = hourlyCanvas.getContext('2d');
        analyticsCharts.hourlyStats = new Chart(hourlyCtx, {
            type: 'line',
            data: {
                labels: data.hourlyStats.map(h => h.hour + ':00'),
                datasets: [{
                    label: 'Events',
                    data: data.hourlyStats.map(h => h.event_count),
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.4,
                    fill: true
                }, {
                    label: 'Users',
                    data: data.hourlyStats.map(h => h.unique_users || 0),
                    borderColor: 'rgba(153, 102, 255, 1)',
                    backgroundColor: 'rgba(153, 102, 255, 0.2)',
                    tension: 0.4,
                    fill: false
                }]
            },
            options: addWhiteTextColors({
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true }
                }
            })
        });
    }

    // Daily Stats Chart
    if (data.dailyStats && data.dailyStats.length > 0) {
        const dailyCanvas = document.getElementById('daily-stats-chart');
        if (!dailyCanvas) {
            console.warn('daily-stats-chart canvas not found');
            return;
        }
        const dailyCtx = dailyCanvas.getContext('2d');
        analyticsCharts.dailyStats = new Chart(dailyCtx, {
            type: 'bar',
            data: {
                labels: data.dailyStats.map(d => new Date(d.date).toLocaleDateString()),
                datasets: [{
                    label: 'Events',
                    data: data.dailyStats.map(d => d.event_count),
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }, {
                    label: 'Users',
                    data: data.dailyStats.map(d => d.unique_users || 0),
                    backgroundColor: 'rgba(255, 206, 86, 0.6)',
                    borderColor: 'rgba(255, 206, 86, 1)',
                    borderWidth: 1
                }]
            },
            options: addWhiteTextColors({
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true }
                }
            })
        });
    }

    // Search Analytics Chart
    if (data.searchAnalytics && data.searchAnalytics.length > 0) {
        const searchCanvas = document.getElementById('search-analytics-chart');
        if (!searchCanvas) {
            console.warn('search-analytics-chart canvas not found');
            return;
        }
        const searchCtx = searchCanvas.getContext('2d');
        analyticsCharts.searchAnalytics = new Chart(searchCtx, {
            type: 'bar',
            data: {
                labels: data.searchAnalytics.slice(0, 10).map(s => s.query),
                datasets: [{
                    label: 'Search Count',
                    data: data.searchAnalytics.slice(0, 10).map(s => s.search_count),
                    backgroundColor: 'rgba(255, 99, 132, 0.6)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                }]
            },
            options: addWhiteTextColors({
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: {
                    x: { beginAtZero: true }
                }
            })
        });
    }

    // Economic Activity Chart
    if (data.economicActivity && data.economicActivity.length > 0) {
        const economicCanvas = document.getElementById('economic-activity-chart');
        if (!economicCanvas) {
            console.warn('economic-activity-chart canvas not found');
            return;
        }
        const economicCtx = economicCanvas.getContext('2d');
        analyticsCharts.economicActivity = new Chart(economicCtx, {
            type: 'bar',
            data: {
                labels: data.economicActivity.slice(0, 10).map(e => e.place_name),
                datasets: [{
                    label: 'Interactions',
                    data: data.economicActivity.slice(0, 10).map(e => e.interactions),
                    backgroundColor: 'rgba(34, 197, 94, 0.6)',
                    borderColor: 'rgba(34, 197, 94, 1)',
                    borderWidth: 1
                }]
            },
            options: addWhiteTextColors({
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: {
                    x: { beginAtZero: true }
                }
            })
        });
    }

    // User Engagement Trends Chart
    if (data.dailyStats && data.dailyStats.length > 0) {
        const engagementCanvas = document.getElementById('engagement-trends-chart');
        if (engagementCanvas) {
            const engagementCtx = engagementCanvas.getContext('2d');
            analyticsCharts.engagementTrends = new Chart(engagementCtx, {
                type: 'line',
                data: {
                    labels: data.dailyStats.map(d => new Date(d.date).toLocaleDateString()),
                    datasets: [{
                        label: 'Daily Events',
                        data: data.dailyStats.map(d => d.event_count),
                        borderColor: 'rgba(75, 192, 192, 1)',
                        backgroundColor: 'rgba(75, 192, 192, 0.1)',
                        tension: 0.4,
                        fill: true
                    }, {
                        label: 'Active Users',
                        data: data.dailyStats.map(d => d.unique_users),
                        borderColor: 'rgba(255, 99, 132, 1)',
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        tension: 0.4,
                        fill: true
                    }, {
                        label: 'Sessions',
                        data: data.dailyStats.map(d => d.unique_sessions),
                        borderColor: 'rgba(54, 162, 235, 1)',
                        backgroundColor: 'rgba(54, 162, 235, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: addWhiteTextColors({
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'top' }
                    },
                    scales: {
                        y: { beginAtZero: true }
                    }
                })
            });
        }
    }
}

// Helper function to add white text colors to chart options
function addWhiteTextColors(options) {
    const isDark = document.body.getAttribute('data-theme') === 'dark';

    // Only apply white text colors if in dark mode
    if (!isDark) {
        return options;
    }

    console.log('Adding white text colors to chart options (Dark Mode):', options);
    // Ensure scales object exists
    if (!options.scales) options.scales = {};

    // Force white text on ALL scales (Chart.js v4 syntax)
    Object.keys(options.scales).forEach(scaleKey => {
        if (!options.scales[scaleKey].ticks) options.scales[scaleKey].ticks = {};
        options.scales[scaleKey].ticks.color = '#ffffff';
        options.scales[scaleKey].ticks.font = { color: '#ffffff' };
        if (!options.scales[scaleKey].grid) options.scales[scaleKey].grid = {};
        options.scales[scaleKey].grid.color = 'rgba(255, 255, 255, 0.1)';
    });

    // Chart.js v4 specific: Add color to the main options
    options.color = '#ffffff';

    // Chart.js v4 specific: Set elements color for text
    options.elements = options.elements || {};
    options.elements.text = {
        color: '#ffffff'
    };

    // Chart.js v4 specific: Set plugins legend labels color
    options.plugins = options.plugins || {};
    options.plugins.legend = options.plugins.legend || {};
    if (typeof options.plugins.legend === 'object') {
        options.plugins.legend.labels = {
            color: '#ffffff',
            font: { color: '#ffffff' }
        };
    }

    // Explicitly set title color if title plugin is used
    if (!options.plugins) options.plugins = {};
    if (!options.plugins.title) options.plugins.title = {};
    options.plugins.title.color = '#ffffff';

    console.log('Final chart options with white text:', options);
    console.log('Scales object:', JSON.stringify(options.scales, null, 2));
    return options;
}

// Show analytics loading state
function showAnalyticsLoading() {
    const loadingElement = document.getElementById('analytics-loading');
    const chartsElement = document.getElementById('analytics-charts');

    if (loadingElement) loadingElement.style.display = 'block';
    if (chartsElement) chartsElement.style.display = 'none';
}

// Hide analytics loading state
function hideAnalyticsLoading() {
    const loadingElement = document.getElementById('analytics-loading');
    const chartsElement = document.getElementById('analytics-charts');

    if (loadingElement) loadingElement.style.display = 'none';
    if (chartsElement) chartsElement.style.display = 'block';
}

// Show analytics error state
function showAnalyticsError(message) {
    const loadingElement = document.getElementById('analytics-loading');
    const chartsElement = document.getElementById('analytics-charts');

    if (loadingElement) {
        loadingElement.innerHTML = `
            <div class="analytics-error">
                <div class="error-icon">⚠️</div>
                <h3>Failed to Load Analytics</h3>
                <p>${message}</p>
                <button onclick="loadAnalytics()" class="btn btn-primary">
                    <i class="fas fa-sync-alt"></i>
                    Retry
                </button>
            </div>
        `;
        loadingElement.style.display = 'block';
    }

    if (chartsElement) chartsElement.style.display = 'none';
}

function renderAnalyticsCharts(data) {
    // Check if we have any data
    if (!data || (!data.topPlaces?.length && !data.topTrips?.length && !data.topCategories?.length && !data.topSearchQueries?.length)) {
        console.log('No analytics data available to render charts');
        return;
    }

    // Top Places Chart
    const topPlacesCanvas = document.getElementById('top-places-chart');
    if (topPlacesCanvas && data.topPlaces && data.topPlaces.length > 0) {
        const topPlacesCtx = topPlacesCanvas.getContext('2d');

        // Show loading state for this chart
        topPlacesCanvas.style.display = 'none';
        topPlacesCanvas.parentNode.insertAdjacentHTML('beforeend', '<div class="chart-loading"><div class="spinner"></div>Loading chart...</div>');

        charts.topPlaces = new Chart(topPlacesCtx, {
            type: 'bar',
            data: {
                labels: data.topPlaces.map(p => p.place_name),
                datasets: [{
                    label: 'Views',
                    data: data.topPlaces.map(p => p.view_count),
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: addWhiteTextColors({
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y', // Make it a horizontal bar chart
                plugins: {
                    legend: { display: false },
                    title: { display: false }
                },
                scales: {
                    x: { beginAtZero: true, grid: { display: false } },
                    y: { grid: { display: false } }
                },
                layout: {
                    padding: {
                        top: 10,
                        right: 10,
                        bottom: 10,
                        left: 10
                    }
                }
            })
        });

        // Hide loading and show chart
        topPlacesCanvas.style.display = 'block';
        topPlacesCanvas.parentNode.querySelector('.chart-loading').remove();
    }

    // Top Trips Chart
    const topTripsCanvas = document.getElementById('top-trips-chart');
    if (topTripsCanvas && data.topTrips && data.topTrips.length > 0) {
        const topTripsCtx = topTripsCanvas.getContext('2d');

        // Show loading state for this chart
        topTripsCanvas.style.display = 'none';
        topTripsCanvas.parentNode.insertAdjacentHTML('beforeend', '<div class="chart-loading"><div class="spinner"></div>Loading chart...</div>');

        charts.topTrips = new Chart(topTripsCtx, {
            type: 'pie',
            data: {
                labels: data.topTrips.map(t => t.trip_name),
                datasets: [{
                    label: 'Trips Created',
                    data: data.topTrips.map(t => t.trip_count),
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.6)', 'rgba(54, 162, 235, 0.6)', 'rgba(255, 206, 86, 0.6)',
                        'rgba(75, 192, 192, 0.6)', 'rgba(153, 102, 255, 0.6)', 'rgba(255, 159, 64, 0.6)',
                        'rgba(199, 199, 199, 0.6)', 'rgba(83, 102, 255, 0.6)', 'rgba(40, 159, 64, 0.6)',
                        'rgba(210, 100, 100, 0.6)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)', 'rgba(54, 162, 235, 1)', 'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)', 'rgba(153, 102, 255, 1)', 'rgba(255, 159, 64, 1)',
                        'rgba(199, 199, 199, 1)', 'rgba(83, 102, 255, 1)', 'rgba(40, 159, 64, 1)',
                        'rgba(210, 100, 100, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: addWhiteTextColors({
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right' },
                    title: { display: false }
                },
                layout: {
                    padding: {
                        top: 10,
                        right: 10,
                        bottom: 10,
                        left: 10
                    }
                }
            })
        });

        // Hide loading and show chart
        topTripsCanvas.style.display = 'block';
        topTripsCanvas.parentNode.querySelector('.chart-loading').remove();
    }

    // Top Categories Chart
    const topCategoriesCanvas = document.getElementById('top-categories-chart');
    if (topCategoriesCanvas && data.topCategories && data.topCategories.length > 0) {
        const topCategoriesCtx = topCategoriesCanvas.getContext('2d');

        // Show loading state for this chart
        topCategoriesCanvas.style.display = 'none';
        topCategoriesCanvas.parentNode.insertAdjacentHTML('beforeend', '<div class="chart-loading"><div class="spinner"></div>Loading chart...</div>');

        charts.topCategories = new Chart(topCategoriesCtx, {
            type: 'doughnut',
            data: {
                labels: data.topCategories.map(c => c.category),
                datasets: [{
                    label: 'Views',
                    data: data.topCategories.map(c => c.view_count),
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.6)', 'rgba(54, 162, 235, 0.6)', 'rgba(255, 206, 86, 0.6)',
                        'rgba(75, 192, 192, 0.6)', 'rgba(153, 102, 255, 0.6)', 'rgba(255, 159, 64, 0.6)',
                        'rgba(199, 199, 199, 0.6)', 'rgba(83, 102, 255, 0.6)', 'rgba(40, 159, 64, 0.6)',
                        'rgba(210, 100, 100, 0.6)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)', 'rgba(54, 162, 235, 1)', 'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)', 'rgba(153, 102, 255, 1)', 'rgba(255, 159, 64, 1)',
                        'rgba(199, 199, 199, 1)', 'rgba(83, 102, 255, 1)', 'rgba(40, 159, 64, 1)',
                        'rgba(210, 100, 100, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: addWhiteTextColors({
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right' },
                    title: { display: false }
                },
                layout: {
                    padding: {
                        top: 10,
                        right: 10,
                        bottom: 10,
                        left: 10
                    }
                }
            })
        });

        // Hide loading and show chart
        topCategoriesCanvas.style.display = 'block';
        topCategoriesCanvas.parentNode.querySelector('.chart-loading').remove();
    }

    // Top Search Queries Chart
    const topSearchQueriesCanvas = document.getElementById('top-search-queries-chart');
    if (topSearchQueriesCanvas && data.topSearchQueries && data.topSearchQueries.length > 0) {
        const topSearchQueriesCtx = topSearchQueriesCanvas.getContext('2d');

        // Show loading state for this chart
        topSearchQueriesCanvas.style.display = 'none';
        topSearchQueriesCanvas.parentNode.insertAdjacentHTML('beforeend', '<div class="chart-loading"><div class="spinner"></div>Loading chart...</div>');

        charts.topSearchQueries = new Chart(topSearchQueriesCtx, {
            type: 'bar',
            data: {
                labels: data.topSearchQueries.map(q => q.query),
                datasets: [{
                    label: 'Searches',
                    data: data.topSearchQueries.map(q => q.search_count),
                    backgroundColor: 'rgba(153, 102, 255, 0.6)',
                    borderColor: 'rgba(153, 102, 255, 1)',
                    borderWidth: 1
                }]
            },
            options: addWhiteTextColors({
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y', // Horizontal bar chart
                plugins: {
                    legend: { display: false },
                    title: { display: false }
                },
                scales: {
                    x: { beginAtZero: true, grid: { display: false } },
                    y: { grid: { display: false } }
                },
                layout: {
                    padding: {
                        top: 10,
                        right: 10,
                        bottom: 10,
                        left: 10
                    }
                }
            })
        });

        // Hide loading and show chart
        topSearchQueriesCanvas.style.display = 'block';
        topSearchQueriesCanvas.parentNode.querySelector('.chart-loading').remove();
    }
}

// --- Trip Analytics Charts ---
function renderTripAnalyticsCharts(data) {
    // Check if we have data, if not show empty state
    if (!data || Object.keys(data).length === 0) {
        console.log('No trip analytics data available');
        return;
    }

    // Most Added Places to Trips Chart
    if (data.popularPlacesInTrips && data.popularPlacesInTrips.length > 0) {
        const popularPlacesTripsCanvas = document.getElementById('popular-places-trips-chart');
        if (popularPlacesTripsCanvas) {
            const popularPlacesTripsCtx = popularPlacesTripsCanvas.getContext('2d');

            // Show loading state for this chart
            popularPlacesTripsCanvas.style.display = 'none';
            popularPlacesTripsCanvas.parentNode.insertAdjacentHTML('beforeend', '<div class="chart-loading"><div class="spinner"></div>Loading chart...</div>');

            charts.popularPlacesTrips = new Chart(popularPlacesTripsCtx, {
                type: 'bar',
                data: {
                    labels: data.popularPlacesInTrips.map(p => p.place_name),
                    datasets: [{
                        label: 'Times Added to Trips',
                        data: data.popularPlacesInTrips.map(p => p.trip_count),
                        backgroundColor: 'rgba(255, 99, 132, 0.6)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 1
                    }]
                },
                options: addWhiteTextColors({
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y', // Horizontal bar chart
                    plugins: {
                        legend: { display: false },
                        title: { display: false }
                    },
                    scales: {
                        x: { beginAtZero: true, grid: { display: false } },
                        y: { grid: { display: false } }
                    },
                    layout: {
                        padding: {
                            top: 10,
                            right: 10,
                            bottom: 10,
                            left: 10
                        }
                    }
                })
            });

            // Hide loading and show chart
            popularPlacesTripsCanvas.style.display = 'block';
            popularPlacesTripsCanvas.parentNode.querySelector('.chart-loading').remove();
        }
    }

    // User Trip Statistics Chart
    if (data.userTripStats && data.userTripStats.length > 0) {
        const userTripStatsCanvas = document.getElementById('user-trip-stats-chart');
        if (userTripStatsCanvas) {
            const userTripStatsCtx = userTripStatsCanvas.getContext('2d');

            // Show loading state for this chart
            userTripStatsCanvas.style.display = 'none';
            userTripStatsCanvas.parentNode.insertAdjacentHTML('beforeend', '<div class="chart-loading"><div class="spinner"></div>Loading chart...</div>');

            charts.userTripStats = new Chart(userTripStatsCtx, {
                type: 'bar',
                data: {
                    labels: data.userTripStats.map(u => u.email.substring(0, 20) + '...'),
                    datasets: [{
                        label: 'Total Trips',
                        data: data.userTripStats.map(u => u.total_trips),
                        backgroundColor: 'rgba(54, 162, 235, 0.6)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    }, {
                        label: 'Total Places',
                        data: data.userTripStats.map(u => u.total_places || 0),
                        backgroundColor: 'rgba(255, 206, 86, 0.6)',
                        borderColor: 'rgba(255, 206, 86, 1)',
                        borderWidth: 1
                    }]
                },
                options: addWhiteTextColors({
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'top' },
                        title: { display: false }
                    },
                    scales: {
                        y: { beginAtZero: true, grid: { display: false } },
                        x: { grid: { display: false } }
                    },
                    layout: {
                        padding: {
                            top: 10,
                            right: 10,
                            bottom: 10,
                            left: 10
                        }
                    }
                })
            });

            // Hide loading and show chart
            userTripStatsCanvas.style.display = 'block';
            userTripStatsCanvas.parentNode.querySelector('.chart-loading').remove();
        }
    }

    // Trip Creation Trends Chart
    if (data.tripCreationTrends && data.tripCreationTrends.length > 0) {
        const tripCreationTrendsCanvas = document.getElementById('trip-creation-trends-chart');
        if (tripCreationTrendsCanvas) {
            const tripCreationTrendsCtx = tripCreationTrendsCanvas.getContext('2d');

            // Show loading state for this chart
            tripCreationTrendsCanvas.style.display = 'none';
            tripCreationTrendsCanvas.parentNode.insertAdjacentHTML('beforeend', '<div class="chart-loading"><div class="spinner"></div>Loading chart...</div>');

            charts.tripCreationTrends = new Chart(tripCreationTrendsCtx, {
                type: 'line',
                data: {
                    labels: data.tripCreationTrends.map(t => t.month),
                    datasets: [{
                        label: 'Trips Created',
                        data: data.tripCreationTrends.map(t => t.trips_created),
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }, {
                        label: 'Active Users',
                        data: data.tripCreationTrends.map(t => t.active_users),
                        backgroundColor: 'rgba(153, 102, 255, 0.2)',
                        borderColor: 'rgba(153, 102, 255, 1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4
                    }]
                },
                options: addWhiteTextColors({
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'top' },
                        title: { display: false }
                    },
                    scales: {
                        y: { beginAtZero: true, grid: { display: false } },
                        x: { grid: { display: false } }
                    },
                    layout: {
                        padding: {
                            top: 10,
                            right: 10,
                            bottom: 10,
                            left: 10
                        }
                    }
                })
            });

            // Hide loading and show chart
            tripCreationTrendsCanvas.style.display = 'block';
            tripCreationTrendsCanvas.parentNode.querySelector('.chart-loading').remove();
        }
    }

    // Note: trip-category-popularity-chart canvas not found in HTML, skipping this chart
}

function destroyCharts() {
    // Destroy original charts
    for (const chartKey in charts) {
        if (charts[chartKey]) {
            charts[chartKey].destroy();
            charts[chartKey] = null;
        }
    }

    // Destroy analytics charts
    for (const chartKey in analyticsCharts) {
        if (analyticsCharts[chartKey]) {
            analyticsCharts[chartKey].destroy();
            analyticsCharts[chartKey] = null;
        }
    }

    // Clean up heatmap map
    if (window.heatmapMap) {
        console.log('Cleaning up heatmap map...');
        window.heatmapMap.remove();
        window.heatmapMap = null;
    }
}

function destroyChartsOnly() {
    // Destroy original charts
    for (const chartKey in charts) {
        if (charts[chartKey]) {
            charts[chartKey].destroy();
            charts[chartKey] = null;
        }
    }

    // Destroy analytics charts
    for (const chartKey in analyticsCharts) {
        if (analyticsCharts[chartKey]) {
            analyticsCharts[chartKey].destroy();
            analyticsCharts[chartKey] = null;
        }
    }

    // Don't destroy heatmap - preserve it for sub-tab switching
}

// Real-time analytics functions
function startRealtimeFeed() {
    if (realtimeInterval) {
        clearInterval(realtimeInterval);
    }

    realtimeInterval = setInterval(async () => {
        try {
            const response = await fetch('/api/analytics/real-time', { credentials: 'include' });
            const data = await response.json();
            updateRealtimeFeed(data);
        } catch (error) {
            console.error('Failed to fetch real-time data:', error);
        }
    }, 5000); // Update every 5 seconds

    document.getElementById('toggle-realtime').innerHTML = '<i class="fas fa-pause"></i> Stop Live Feed';
    document.getElementById('toggle-realtime').classList.remove('btn-primary');
    document.getElementById('toggle-realtime').classList.add('btn-danger');
    document.querySelector('.realtime-status').textContent = 'Running';
}

function stopRealtimeFeed() {
    if (realtimeInterval) {
        clearInterval(realtimeInterval);
        realtimeInterval = null;
    }

    document.getElementById('toggle-realtime').innerHTML = '<i class="fas fa-play"></i> Start Live Feed';
    document.getElementById('toggle-realtime').classList.remove('btn-danger');
    document.getElementById('toggle-realtime').classList.add('btn-primary');
    document.querySelector('.realtime-status').textContent = 'Stopped';
}

function updateRealtimeFeed(data) {
    const feed = document.getElementById('realtime-feed');
    if (!feed) return;

    // Clear existing feed
    feed.innerHTML = '';

    if (data.recentEvents && data.recentEvents.length > 0) {
        data.recentEvents.slice(0, 10).forEach(event => {
            const item = document.createElement('div');
            item.className = 'realtime-item';

            const icon = getEventIcon(event.event_type);
            const time = new Date(event.timestamp).toLocaleTimeString();

            item.innerHTML = `
                <i class="${icon}"></i>
                <span>${event.place_name || event.event_type}</span>
                <span class="timestamp">${time}</span>
            `;

            feed.appendChild(item);
        });
    } else {
        const item = document.createElement('div');
        item.className = 'realtime-item';
        item.innerHTML = `
            <i class="fas fa-info-circle"></i>
            <span>No recent activity</span>
        `;
        feed.appendChild(item);
    }
}

function getEventIcon(eventType) {
    const icons = {
        'view_place': 'fas fa-eye',
        'create_trip': 'fas fa-route',
        'search_query': 'fas fa-search',
        'bookmark_place': 'fas fa-bookmark',
        'add_to_trip': 'fas fa-plus-circle',
        'remove_from_trip': 'fas fa-minus-circle'
    };
    return icons[eventType] || 'fas fa-circle';
}

// Analytics event listeners
function initializeAnalyticsControls() {
    // Period selector
    const periodSelect = document.getElementById('analytics-period');
    if (periodSelect) {
        periodSelect.addEventListener('change', () => {
            loadAnalytics();
        });
    }

    // Refresh button
    const refreshBtn = document.getElementById('refresh-analytics');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadAnalytics();
        });
    }

    // Export button
    const exportBtn = document.getElementById('export-analytics');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const period = document.getElementById('analytics-period')?.value || '30d';
            window.open(`/api/analytics/export?format=csv&period=${period}`, '_blank');
        });
    }

    // Real-time toggle
    const realtimeBtn = document.getElementById('toggle-realtime');
    if (realtimeBtn) {
        realtimeBtn.addEventListener('click', () => {
            if (realtimeInterval) {
                stopRealtimeFeed();
            } else {
                startRealtimeFeed();
            }
        });
    }

}

// Master Password Protection Functions
async function unlockAdminTools() {
    const enteredPassword = window.masterPasswordInput.value.trim();

    if (!enteredPassword) {
        window.masterPasswordError.textContent = 'Please enter the master password.';
        window.masterPasswordError.style.display = 'block';
        return;
    }

    try {
        const response = await fetch(`${window.adminApiUrl}/verify-master-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ password: enteredPassword })
        });

        const result = await response.json();

        if (result.success) {
            // Correct password - unlock admin tools
            window.adminToolsLocked.style.display = 'none';
            window.adminToolsContent.style.display = 'block';
            window.masterPasswordInput.value = '';
            window.masterPasswordError.style.display = 'none';
        } else {
            // Wrong password - show error
            window.masterPasswordError.textContent = result.message || 'Incorrect master password. Please try again.';
            window.masterPasswordError.style.display = 'block';
            window.masterPasswordInput.value = '';
            window.masterPasswordInput.focus();
        }
    } catch (error) {
        console.error('Error verifying master password:', error);
        window.masterPasswordError.textContent = 'Error verifying password. Please try again.';
        window.masterPasswordError.style.display = 'block';
    }
}

function lockAdminTools() {
    window.adminToolsLocked.style.display = 'block';
    window.adminToolsContent.style.display = 'none';
    window.masterPasswordInput.value = '';
    window.masterPasswordError.style.display = 'none';
    window.masterPasswordInput.focus();
}

// Tab switching logic
function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    // Remove active class from both tab-button and btn classes
    document.querySelectorAll('.tab-button, .btn').forEach(button => {
        button.classList.remove('active');
    });

    const tabElement = document.getElementById(`${tabId}-tab`);
    if (tabElement) {
        tabElement.classList.add('active');
    }

    // Try to find the button with either tab-button or btn class
    let tabButton = document.querySelector(`.tab-button[onclick="showTab('${tabId}')"]`);
    if (!tabButton) {
        tabButton = document.querySelector(`.btn[onclick="showTab('${tabId}')"]`);
    }
    if (tabButton) {
        tabButton.classList.add('active');
    }

    // Load analytics data only when the analytics tab is active
    if (tabId === 'analytics') {
        // Show the first sub-tab by default
        showAnalyticsSubTab('general-analytics');
    } else {
        destroyCharts(); // Destroy charts when switching away from analytics
        // Stop real-time feed when leaving analytics tab
        if (realtimeInterval) {
            stopRealtimeFeed();
        }
    }

}

// Initial tab display
document.addEventListener('DOMContentLoaded', () => {
    showTab('places-events'); // Default to places/events tab
    initializeAnalyticsControls(); // Initialize analytics controls
});