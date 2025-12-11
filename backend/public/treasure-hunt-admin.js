// Treasure Hunt Admin JavaScript
console.log('=== TREASURE HUNT ADMIN JS FILE LOADED ===');

let treasureHuntMap = null;
let treasureHuntMarkers = {};
let allTreasureHunts = [];
let allClues = {};
let selectedHuntId = null;
let mapClickMode = false;
let newClueMarker = null;

const API_URL = '/api/treasure-hunts';

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== DOMContentLoaded FIRED IN treasure-hunt-admin.js ===');
    
    // Use existing map if already initialized, otherwise create it
    if (window.treasureHuntMap) {
        console.log('Using existing map from inline script');
        treasureHuntMap = window.treasureHuntMap;
    } else {
        console.log('Initializing new map...');
        treasureHuntMap = L.map('treasure-hunt-map').setView([36.045, 14.25], 13);
        const gozoBounds = L.latLngBounds([35.98, 14.15], [36.09, 14.40]);
        const cacheBuster = new Date().getTime();
        L.tileLayer('/tiles/gozo/{z}/{x}/{y}.png?v=' + cacheBuster, {
            maxZoom: 19,
            minZoom: 12,
            attribution: 'Discover Gozo | &copy; Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP',
            bounds: gozoBounds,
            errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
        }).addTo(treasureHuntMap);
        treasureHuntMap.setMaxBounds(gozoBounds);
    }
    
    console.log('Map initialized');

    // Prevent default context menu on map container
    const mapContainer = document.getElementById('treasure-hunt-map');
    if (mapContainer) {
        mapContainer.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, true);
    }

    // Handle click on map
    treasureHuntMap.on('click', (e) => {
        if (mapClickMode) {
            const latInput = document.getElementById('treasure-hunt-clue-latitude');
            const lngInput = document.getElementById('treasure-hunt-clue-longitude');
            if (latInput && lngInput) {
                latInput.value = e.latlng.lat.toFixed(5);
                lngInput.value = e.latlng.lng.toFixed(5);
            }
            mapClickMode = false;
            const btn = document.getElementById('use-map-coords-clue');
            if (btn) {
                btn.innerHTML = '<i class="fas fa-crosshairs"></i> Use Map Click';
                btn.classList.remove('btn-danger');
                btn.classList.add('btn-info');
            }
        } else if (selectedHuntId) {
            showClueForm(e.latlng);
        }
    });

    // Handle right-click - PRIMARY METHOD
    treasureHuntMap.on('contextmenu', (e) => {
        e.originalEvent.preventDefault();
        e.originalEvent.stopPropagation();
        
        if (!selectedHuntId) {
            alert('Please select a treasure hunt first from the list on the left.');
            return false;
        }
        console.log('Right-click detected, showing clue form');
        showClueForm(e.latlng);
        return false;
    });

    function showInstructions(message) {
        const instructions = document.getElementById('map-instructions');
        if (instructions) {
            instructions.innerHTML = `<strong>💡 ${message}</strong>`;
            instructions.classList.remove('hidden');
        }
    }

    function showClueForm(latLng) {
        if (!selectedHuntId) {
            alert('Please select a treasure hunt first. Click on a hunt in the list to select it.');
            return;
        }
        
        const clueFormContainer = document.getElementById('treasure-hunt-clue-form-container');
        if (!clueFormContainer) {
            console.error('Clue form container not found');
            return;
        }
        
        clueFormContainer.setAttribute('open', '');
        document.getElementById('treasure-hunt-clue-hunt-id').value = selectedHuntId;
        document.getElementById('treasure-hunt-clue-id').value = '';
        document.getElementById('treasure-hunt-clue-form').reset();
        document.getElementById('treasure-hunt-clue-hunt-id').value = selectedHuntId;
        
        if (latLng) {
            document.getElementById('treasure-hunt-clue-latitude').value = latLng.lat.toFixed(5);
            document.getElementById('treasure-hunt-clue-longitude').value = latLng.lng.toFixed(5);
        }
        
        const clues = allClues[selectedHuntId] || [];
        const nextClueNumber = clues.length > 0 ? Math.max(...clues.map(c => c.clue_number)) + 1 : 1;
        document.getElementById('treasure-hunt-clue-number').value = nextClueNumber;
        
        const iconPreview = document.getElementById('clue-icon-preview');
        if (iconPreview) iconPreview.style.display = 'none';
        const iconInput = document.getElementById('treasure-hunt-clue-icon');
        if (iconInput) iconInput.value = '';
        
        clueFormContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        const instructions = document.getElementById('map-instructions');
        if (instructions) instructions.classList.add('hidden');
        
        treasureHuntMap.closePopup();
        if (newClueMarker) {
            treasureHuntMap.removeLayer(newClueMarker);
            newClueMarker = null;
        }
    }

    // Define handleHuntSubmit FIRST
    async function handleHuntSubmit(e) {
        console.log('=== handleHuntSubmit CALLED ===');
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        const form = document.getElementById('treasure-hunt-form');
        if (!form) {
            console.error('Form not found!');
            alert('Form not found. Please refresh the page.');
            return;
        }
        
        const formData = new FormData(form);
        const huntId = document.getElementById('treasure-hunt-id').value;
        const iconValue = formData.get('icon') || '';
        
        // If icon is base64, try to upload it as a file first
        let finalIconValue = iconValue;
        if (iconValue && iconValue.startsWith('data:image')) {
            console.log('Icon is base64, attempting to convert to file...');
            try {
                // Convert base64 to blob
                const base64Data = iconValue.split(',')[1];
                const mimeType = iconValue.match(/data:image\/(\w+);base64/)?.[1] || 'png';
                const byteCharacters = atob(base64Data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: `image/${mimeType}` });
                const file = new File([blob], `icon.${mimeType}`, { type: `image/${mimeType}` });
                
                // Upload the file
                const uploadFormData = new FormData();
                uploadFormData.append('icon', file);
                
                const uploadResponse = await fetch(`${API_URL}/upload-icon`, {
                    method: 'POST',
                    credentials: 'include',
                    body: uploadFormData
                });
                
                if (uploadResponse.ok) {
                    const uploadResult = await uploadResponse.json();
                    if (uploadResult.success && uploadResult.icon) {
                        finalIconValue = uploadResult.icon;
                        console.log('Base64 icon converted to file:', finalIconValue);
                        // Update the input field with the file path
                        document.getElementById('treasure-hunt-icon').value = finalIconValue;
                    } else {
                        console.warn('Upload succeeded but no icon path returned, backend will handle conversion');
                    }
                } else {
                    console.warn('Failed to upload base64 icon, backend will handle conversion');
                }
            } catch (uploadError) {
                console.error('Error converting base64 to file:', uploadError);
                console.warn('Backend will handle base64 conversion');
            }
        }
        
        const data = {
            name: formData.get('name'),
            description: formData.get('description'),
            icon: finalIconValue,
            is_active: formData.get('is_active') === 'on'
        };

        if (!data.name || !data.name.trim()) {
            alert('Please enter a hunt name');
            return;
        }

        console.log('Submitting hunt data:', data);

        try {
            const url = huntId ? `${API_URL}/${huntId}` : API_URL;
            const method = huntId ? 'PUT' : 'POST';
            
            console.log(`Making ${method} request to ${url}`);
            console.log('Request body:', JSON.stringify(data));
            
            const response = await fetch(url, {
                method: method,
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(data)
            });

            console.log('Response status:', response.status, response.statusText);
            console.log('Response headers:', [...response.headers.entries()]);

            const responseText = await response.text();
            console.log('Response text:', responseText);
            
            let responseData;
            try {
                responseData = JSON.parse(responseText);
            } catch (e) {
                console.error('Failed to parse JSON response:', e);
                console.error('Response was:', responseText);
                throw new Error(`Server error: ${response.status} - ${responseText.substring(0, 200)}`);
            }

            if (!response.ok) {
                console.error('Request failed. Response data:', responseData);
                throw new Error(responseData.error || `Failed to save hunt: ${response.status}`);
            }
            
            console.log('Hunt saved successfully:', responseData);
            alert('Treasure hunt saved successfully!');
            
            await loadTreasureHunts();
            
            const savedHuntId = responseData.id;
            if (savedHuntId) {
                await selectHunt(savedHuntId);
                document.getElementById('treasure-hunt-id').value = savedHuntId;
                document.getElementById('treasure-hunt-name').value = responseData.name || '';
                document.getElementById('treasure-hunt-description').value = responseData.description || '';
                document.getElementById('treasure-hunt-icon').value = responseData.icon || '';
                document.getElementById('treasure-hunt-active').checked = responseData.is_active !== 0;
                document.getElementById('treasure-hunt-form-container').setAttribute('open', '');
            } else {
                document.getElementById('treasure-hunt-form').reset();
                document.getElementById('treasure-hunt-id').value = '';
            }
        } catch (error) {
            console.error('Error saving treasure hunt:', error);
            alert(`Failed to save treasure hunt: ${error.message || error}`);
        }
    }

    function bindEvents() {
        console.log('=== Binding events ===');
        
        const huntForm = document.getElementById('treasure-hunt-form');
        const submitBtn = document.getElementById('submit-treasure-hunt-button');
        
        if (huntForm && submitBtn) {
            console.log('Found form and submit button');
            
            // Remove any existing listeners by cloning
            const newSubmitBtn = submitBtn.cloneNode(true);
            submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
            
            newSubmitBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Submit button clicked');
                handleHuntSubmit(e);
            });
            
            huntForm.addEventListener('submit', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Form submit event');
                handleHuntSubmit(e);
                return false;
            });
        } else {
            console.error('Form or submit button not found!', { huntForm: !!huntForm, submitBtn: !!submitBtn });
        }

        const cancelBtn = document.getElementById('cancel-treasure-hunt-button');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                document.getElementById('treasure-hunt-form').reset();
                document.getElementById('treasure-hunt-id').value = '';
                document.getElementById('treasure-hunt-form-container').removeAttribute('open');
            });
        }
        
        // Test API button
        const testApiBtn = document.getElementById('test-api-button');
        if (testApiBtn) {
            testApiBtn.addEventListener('click', async () => {
                console.log('=== MANUAL API TEST ===');
                testApiBtn.disabled = true;
                testApiBtn.textContent = 'Testing...';
                
                try {
                    const response = await fetch('/api/treasure-hunts', {
                        method: 'GET',
                        credentials: 'include',
                        headers: { 'Accept': 'application/json' }
                    });
                    
                    const text = await response.text();
                    console.log('Test Response status:', response.status);
                    console.log('Test Response text:', text);
                    
                    let data;
                    try {
                        data = JSON.parse(text);
                        console.log('Test Parsed data:', data);
                        alert(`API Test: Status ${response.status}\nHunts found: ${Array.isArray(data) ? data.length : 'Not an array'}\nCheck console for details.`);
                    } catch (e) {
                        alert(`API Test: Status ${response.status}\nParse error: ${e.message}\nResponse: ${text.substring(0, 200)}`);
                    }
                } catch (error) {
                    console.error('Test error:', error);
                    alert(`API Test Failed: ${error.message}`);
                } finally {
                    testApiBtn.disabled = false;
                    testApiBtn.innerHTML = '<i class="fas fa-bug"></i> Test API';
                }
            });
        }

        const clueForm = document.getElementById('treasure-hunt-clue-form');
        if (clueForm) {
            clueForm.addEventListener('submit', handleClueSubmit);
        }

        const cancelClueBtn = document.getElementById('cancel-treasure-hunt-clue-button');
        if (cancelClueBtn) {
            cancelClueBtn.addEventListener('click', () => {
                document.getElementById('treasure-hunt-clue-form').reset();
                document.getElementById('treasure-hunt-clue-id').value = '';
                document.getElementById('treasure-hunt-clue-form-container').removeAttribute('open');
            });
        }

        const useMapCoordsBtn = document.getElementById('use-map-coords-clue');
        if (useMapCoordsBtn) {
            useMapCoordsBtn.addEventListener('click', () => {
                mapClickMode = !mapClickMode;
                if (mapClickMode) {
                    useMapCoordsBtn.innerHTML = '<i class="fas fa-hand-pointer"></i> Click on Map';
                    useMapCoordsBtn.classList.remove('btn-info');
                    useMapCoordsBtn.classList.add('btn-danger');
                } else {
                    useMapCoordsBtn.innerHTML = '<i class="fas fa-crosshairs"></i> Use Map Click';
                    useMapCoordsBtn.classList.remove('btn-danger');
                    useMapCoordsBtn.classList.add('btn-info');
                }
            });
        }

        const searchInput = document.getElementById('search-treasure-hunts-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                const items = document.querySelectorAll('#treasure-hunts-list li.treasure-hunt-item');
                items.forEach(item => {
                    const text = item.textContent.toLowerCase();
                    item.style.display = text.includes(searchTerm) ? '' : 'none';
                });
            });
        }
        
        // Icon selection handlers
        const selectIconBtn = document.getElementById('select-clue-icon-btn');
        const uploadIconBtn = document.getElementById('upload-clue-icon-btn');
        const uploadIconFile = document.getElementById('upload-clue-icon-file');
        const removeIconBtn = document.getElementById('remove-clue-icon-btn');
        const iconPreview = document.getElementById('clue-icon-preview');
        const iconInput = document.getElementById('treasure-hunt-clue-icon');
        
        if (selectIconBtn && iconInput) {
            selectIconBtn.addEventListener('click', () => {
                const icons = ['🗺️', '📍', '🎯', '🔍', '💎', '🏴‍☠️', '🗿', '🏛️', '⛪', '🏖️', '🌊', '⛰️', '🌴', '🏝️', '🦅', '🐚', '🎪', '🎭', '🎨', '📸'];
                const selected = prompt(`Enter emoji or select:\n${icons.join(' ')}\n\nOr type your own emoji/text:`, iconInput.value || '🗺️');
                if (selected !== null) {
                    iconInput.value = selected;
                    updateIconPreview(selected);
                }
            });
        }
        
        if (uploadIconBtn && uploadIconFile && iconInput) {
            uploadIconBtn.addEventListener('click', () => uploadIconFile.click());
            uploadIconFile.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 500000) {
                        alert('Image too large. Please use an image smaller than 500KB.');
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        iconInput.value = event.target.result;
                        updateIconPreview(event.target.result, true);
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
        
        if (removeIconBtn && iconPreview) {
            removeIconBtn.addEventListener('click', () => {
                if (iconInput) iconInput.value = '';
                iconPreview.style.display = 'none';
                if (uploadIconFile) uploadIconFile.value = '';
            });
        }
        
        function updateIconPreview(value, isImage = false) {
            if (!value || !iconPreview) {
                if (iconPreview) iconPreview.style.display = 'none';
                return;
            }
            
            const previewImg = document.getElementById('clue-icon-preview-img');
            const previewText = document.getElementById('clue-icon-text-preview');
            
            if (isImage || value.startsWith('data:image') || value.startsWith('http') || value.startsWith('/uploads/')) {
                if (previewImg) {
                    previewImg.src = value;
                    previewImg.style.display = 'block';
                }
                if (previewText) previewText.style.display = 'none';
                iconPreview.style.display = 'block';
            } else {
                if (previewImg) previewImg.style.display = 'none';
                if (previewText) {
                    previewText.textContent = value;
                    previewText.style.display = 'block';
                }
                iconPreview.style.display = 'block';
            }
        }
        
        window.updateIconPreview = updateIconPreview;
        
        if (iconInput) {
            iconInput.addEventListener('input', (e) => {
                const value = e.target.value;
                if (value && !value.startsWith('data:image') && !value.startsWith('http')) {
                    updateIconPreview(value);
                }
            });
        }
    }

    async function loadTreasureHunts() {
        try {
            console.log('=== Loading treasure hunts ===');
            console.log('API_URL:', API_URL);
            console.log('Current URL:', window.location.href);
            console.log('Cookies:', document.cookie);
            
            const list = document.getElementById('treasure-hunts-list');
            if (list) {
                list.innerHTML = '<li class="empty-state">Loading hunts...</li>';
            }
            
            const response = await fetch(API_URL, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });
            
            console.log('Response status:', response.status, response.statusText);
            console.log('Response ok:', response.ok);
            console.log('Response type:', response.type);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Failed to load hunts. Status:', response.status);
                console.error('Error response:', errorText);
                
                if (list) {
                    if (response.status === 401) {
                        list.innerHTML = '<li class="empty-state">Authentication required. Please log in as admin.</li>';
                    } else {
                        list.innerHTML = `<li class="empty-state">Failed to load: ${response.status} - ${errorText.substring(0, 100)}</li>`;
                    }
                }
                throw new Error(`Failed to load: ${response.status} - ${errorText}`);
            }
            
            const responseText = await response.text();
            console.log('Response text length:', responseText.length);
            console.log('Response text (first 500 chars):', responseText.substring(0, 500));
            
            let hunts;
            try {
                hunts = JSON.parse(responseText);
            } catch (parseError) {
                console.error('Failed to parse JSON:', parseError);
                console.error('Response was:', responseText);
                if (list) {
                    list.innerHTML = '<li class="empty-state">Invalid response from server. Check console.</li>';
                }
                throw new Error('Invalid JSON response from server');
            }
            
            console.log('Parsed hunts type:', typeof hunts);
            console.log('Parsed hunts:', hunts);
            
            if (!Array.isArray(hunts)) {
                console.error('Response is not an array:', hunts);
                console.error('Type:', typeof hunts);
                if (list) {
                    list.innerHTML = '<li class="empty-state">Server returned invalid data format. Check console.</li>';
                }
                hunts = [];
            }
            
            allTreasureHunts = hunts;
            console.log('Successfully loaded', hunts.length, 'hunts');
            console.log('Hunt IDs:', hunts.map(h => h.id));
            
            renderTreasureHuntsList();
            
            if (hunts.length === 0 && list) {
                console.log('No hunts found, showing empty state');
            }
            
            return hunts; // Explicit return
        } catch (error) {
            console.error('=== ERROR loading treasure hunts ===');
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            const list = document.getElementById('treasure-hunts-list');
            if (list) {
                list.innerHTML = `<li class="empty-state" style="color: #ef4444;">Error: ${error.message}<br>Check browser console (F12) for details.</li>`;
            }
            throw error; // Re-throw to reject the promise
        }
    }
    
    window.loadTreasureHunts = loadTreasureHunts;

    function renderTreasureHuntsList() {
        console.log('=== renderTreasureHuntsList called ===');
        console.log('allTreasureHunts:', allTreasureHunts);
        console.log('Number of hunts:', allTreasureHunts.length);
        
        const list = document.getElementById('treasure-hunts-list');
        if (!list) {
            console.error('treasure-hunts-list element not found!');
            return;
        }
        
        console.log('Clearing list and rendering', allTreasureHunts.length, 'hunts');
        list.innerHTML = '';

        if (allTreasureHunts.length === 0) {
            console.log('No hunts to display');
            list.innerHTML = '<li class="empty-state"><em>No treasure hunts yet. Create one above!</em></li>';
            return;
        }
        
        console.log('Rendering', allTreasureHunts.length, 'hunts');

        allTreasureHunts.forEach(hunt => {
            const li = document.createElement('li');
            li.className = 'treasure-hunt-item';
            li.dataset.id = hunt.id;
            
            // Determine if icon is an image URL or emoji/text
            const iconValue = hunt.icon || '🏴‍☠️';
            
            // Get API base URL for image preview
            const getApiBaseUrl = () => {
                if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                    return window.location.origin;
                }
                return 'http://localhost:3003';
            };
            
            let iconDisplay = '';
            
            // Debug logging
            console.log(`[JS] Hunt ${hunt.id} (${hunt.name}):`);
            console.log(`  - iconValue type:`, typeof iconValue);
            console.log(`  - iconValue:`, iconValue);
            console.log(`  - iconValue length:`, iconValue ? iconValue.length : 0);
            
            // Check if it's a base64 data URL
            if (iconValue && typeof iconValue === 'string' && iconValue.startsWith('data:image')) {
                console.log(`  - Detected as base64 image`);
                // Base64 image - use directly
                iconDisplay = `<img src="${iconValue}" alt="Hunt Icon" style="width: 24px; height: 24px; object-fit: contain; vertical-align: middle; margin-right: 6px; border-radius: 4px; display: inline-block;" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';" /><span style="font-size: 20px; vertical-align: middle; margin-right: 6px; display: none;">🏴‍☠️</span>`;
            } 
            // Check if it's a file path (starts with /uploads/ or /, or contains image extension)
            else if (iconValue && typeof iconValue === 'string' && (
                     iconValue.startsWith('/uploads/') || 
                     iconValue.startsWith('/') || 
                     iconValue.startsWith('http://') || 
                     iconValue.startsWith('https://') ||
                     iconValue.includes('.png') || 
                     iconValue.includes('.gif') || 
                     iconValue.includes('.jpg') || 
                     iconValue.includes('.jpeg') || 
                     iconValue.includes('.webp')
                     )) {
                console.log(`  - Detected as image URL/path`);
                // File path or HTTP URL - construct full URL
                let imgSrc;
                if (iconValue.startsWith('http://') || iconValue.startsWith('https://')) {
                    imgSrc = iconValue;
                } else if (iconValue.startsWith('/uploads/') || iconValue.startsWith('/')) {
                    // Absolute path - prepend API base URL
                    const apiBaseUrl = getApiBaseUrl();
                    imgSrc = `${apiBaseUrl}${iconValue}`;
                } else {
                    // Relative path - prepend /uploads/ and API base URL
                    const apiBaseUrl = getApiBaseUrl();
                    imgSrc = `${apiBaseUrl}/uploads/${iconValue}`;
                }
                console.log(`  - Constructed imgSrc:`, imgSrc);
                iconDisplay = `<img src="${imgSrc}" alt="Hunt Icon" style="width: 24px; height: 24px; object-fit: contain; vertical-align: middle; margin-right: 6px; border-radius: 4px; display: inline-block;" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';" /><span style="font-size: 20px; vertical-align: middle; margin-right: 6px; display: none;">🏴‍☠️</span>`;
            } 
            // Otherwise, treat as emoji/text
            else {
                console.log(`  - Treating as emoji/text`);
                iconDisplay = `<span style="font-size: 20px; vertical-align: middle; margin-right: 6px;">${iconValue || '🏴‍☠️'}</span>`;
            }
            
            console.log(`  - Final iconDisplay length:`, iconDisplay.length);
            console.log(`  - iconDisplay preview:`, iconDisplay.substring(0, 150));
            
            const status = hunt.is_active ? '<span class="status-badge active"></span>' : '<span class="status-badge inactive"></span>';
            
            li.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <div style="flex: 1; display: flex; align-items: center; gap: 8px; min-width: 0;">
                        ${status} ${iconDisplay} <strong style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${hunt.name}</strong>
                        ${hunt.description ? `<br><small style="opacity: 0.7; font-size: 11px; display: block; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${hunt.description.substring(0, 50)}${hunt.description.length > 50 ? '...' : ''}</small>` : ''}
                    </div>
                    <div style="display: flex; gap: 5px; flex-shrink: 0;">
                        <button class="btn btn-sm btn-primary edit-hunt-btn" data-id="${hunt.id}"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger delete-hunt-btn" data-id="${hunt.id}"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
            
            li.querySelector('.edit-hunt-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                editHunt(hunt);
            });
            li.querySelector('.delete-hunt-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteHunt(hunt.id);
            });
            li.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    selectHunt(hunt.id);
                }
            });
            
            list.appendChild(li);
        });
    }

    async function selectHunt(huntId) {
        selectedHuntId = huntId;
        // Also set window.selectedHuntId for HTML fallback code
        window.selectedHuntId = huntId;
        
        document.querySelectorAll('.treasure-hunt-item').forEach(item => {
            item.classList.remove('active');
            if (parseInt(item.dataset.id) === huntId) {
                item.classList.add('active');
            }
        });

        try {
            const response = await fetch(`${API_URL}/${huntId}`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Failed to load hunt details');
            
            const hunt = await response.json();
            // Update allTreasureHunts with the loaded hunt to ensure it's available for renderCluesOnMap
            const existingIndex = allTreasureHunts.findIndex(h => h.id === huntId);
            if (existingIndex >= 0) {
                allTreasureHunts[existingIndex] = hunt;
            } else {
                allTreasureHunts.push(hunt);
            }
            // Also store the hunt icon globally for the HTML fallback
            window.selectedHuntIcon = hunt.icon || '/treasuregif.gif';
            allClues[huntId] = hunt.clues || [];
            
            // Update prize display
            updatePrizeDisplay(hunt);
            renderCluesOnMap();
            renderCluesList();
            
            const indicator = document.getElementById('selected-hunt-indicator');
            if (indicator) indicator.textContent = `(${hunt.name})`;
            
            const cluesSection = document.getElementById('clues-list-section');
            if (cluesSection) cluesSection.setAttribute('open', '');
            
            const instructions = document.getElementById('map-instructions');
            if (instructions) {
                instructions.innerHTML = `<strong>💡 Selected: ${hunt.name}</strong><br>Right-click on map to add clues`;
                instructions.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error loading hunt details:', error);
            alert('Failed to load hunt details');
        }
    }

    function renderCluesList() {
        const list = document.getElementById('clues-list');
        if (!list) return;
        
        const clues = allClues[selectedHuntId] || [];
        list.innerHTML = '';
        
        if (clues.length === 0) {
            list.innerHTML = '<li class="empty-state">No clues yet. Right-click on the map to add one!</li>';
            return;
        }
        
        const sortedClues = [...clues].sort((a, b) => a.clue_number - b.clue_number);
        
        sortedClues.forEach(clue => {
            const li = document.createElement('li');
            li.className = 'clue-item';
            const iconValue = clue.icon || '📍';
            
            // Get API base URL for image preview
            const getApiBaseUrl = () => {
                if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                    return window.location.origin;
                }
                return 'http://localhost:3003';
            };
            
            // Determine if icon is an image URL or emoji/text
            let iconDisplay = '';
            if (iconValue && typeof iconValue === 'string' && iconValue.startsWith('data:image')) {
                // Base64 image - use directly
                iconDisplay = `<img src="${iconValue}" alt="Clue Icon" style="width: 20px; height: 20px; object-fit: contain; vertical-align: middle; margin-right: 6px; border-radius: 4px; display: inline-block;" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';" /><span style="font-size: 16px; vertical-align: middle; margin-right: 6px; display: none;">📍</span>`;
            } 
            else if (iconValue && typeof iconValue === 'string' && (
                     iconValue.startsWith('/uploads/') || 
                     iconValue.startsWith('/') || 
                     iconValue.startsWith('http://') || 
                     iconValue.startsWith('https://') ||
                     iconValue.includes('.png') || 
                     iconValue.includes('.gif') || 
                     iconValue.includes('.jpg') || 
                     iconValue.includes('.jpeg') || 
                     iconValue.includes('.webp')
                     )) {
                // File path or HTTP URL - construct full URL
                let imgSrc;
                if (iconValue.startsWith('http://') || iconValue.startsWith('https://')) {
                    imgSrc = iconValue;
                } else if (iconValue.startsWith('/uploads/') || iconValue.startsWith('/')) {
                    // Absolute path - prepend API base URL
                    const apiBaseUrl = getApiBaseUrl();
                    imgSrc = `${apiBaseUrl}${iconValue}`;
                } else {
                    // Relative path - prepend /uploads/ and API base URL
                    const apiBaseUrl = getApiBaseUrl();
                    imgSrc = `${apiBaseUrl}/uploads/${iconValue}`;
                }
                iconDisplay = `<img src="${imgSrc}" alt="Clue Icon" style="width: 20px; height: 20px; object-fit: contain; vertical-align: middle; margin-right: 6px; border-radius: 4px; display: inline-block;" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';" /><span style="font-size: 16px; vertical-align: middle; margin-right: 6px; display: none;">📍</span>`;
            } 
            else {
                // Emoji/text
                iconDisplay = `<span style="font-size: 16px; vertical-align: middle; margin-right: 6px;">${iconValue}</span>`;
            }
            
            li.innerHTML = `
                <div class="clue-item-header">
                    <div>
                        <span class="clue-number-badge">#${clue.clue_number}</span>
                        ${clue.title ? `<strong>${clue.title}</strong>` : ''}
                    </div>
                    <div class="clue-actions">
                        <button class="btn btn-sm btn-primary edit-clue-btn"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger delete-clue-btn"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div style="margin-top: 8px; font-size: 13px; opacity: 0.9; display: flex; align-items: center;">
                    ${iconDisplay} ${clue.clue_text ? clue.clue_text.substring(0, 60) + (clue.clue_text.length > 60 ? '...' : '') : 'No clue text'}
                </div>
            `;
            
            li.querySelector('.edit-clue-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                editClue(clue);
            });
            li.querySelector('.delete-clue-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteClue(clue.id);
            });
            
            list.appendChild(li);
        });
    }

    function renderCluesOnMap() {
        Object.values(treasureHuntMarkers).forEach(marker => {
            treasureHuntMap.removeLayer(marker);
        });
        treasureHuntMarkers = {};

        if (!selectedHuntId) return;

        const clues = allClues[selectedHuntId] || [];

        // Ensure selectedHunt is always defined, even if not found in allTreasureHunts
        const selectedHunt = allTreasureHunts.find(h => h.id === selectedHuntId) || null;
        clues.forEach(clue => {
            let icon = clue.icon || selectedHunt?.icon || '/treasuregif.gif';
            // Replace treasurehunt.png with treasuregif.gif if present
            if (icon && (icon.includes('treasurehunt.png') || icon === 'treasurehunt.png')) {
                icon = '/treasuregif.gif';
            }
            // If no icon is set, default to the treasure hunt GIF
            if (!icon || icon === '📍') {
                icon = '/treasuregif.gif';
            }
            const isEmoji = /[\u{1F300}-\u{1F9FF}]/u.test(icon) || (icon.length <= 2 && !icon.startsWith('/'));
            const isImageUrl = icon.startsWith('http') || icon.startsWith('/') || icon.startsWith('/uploads/') || icon.startsWith('data:') || icon.endsWith('.png') || icon.endsWith('.gif') || icon.endsWith('.jpg') || icon.endsWith('.jpeg') || icon.endsWith('.webp');
            
            let marker;
            if (isImageUrl) {
                // Determine the correct image source
                let imgSrc;
                if (icon.startsWith('data:image')) {
                    // Base64 data URL - use directly
                    imgSrc = icon;
                } else if (icon.startsWith('http://') || icon.startsWith('https://')) {
                    // Full URL - use directly
                    imgSrc = icon;
                } else if (icon.startsWith('/uploads/') || icon.startsWith('/')) {
                    // Absolute path - use directly
                    imgSrc = icon;
                } else {
                    // Relative path - prepend /uploads/
                    imgSrc = '/uploads/' + icon;
                }
                
                // Use divIcon with img tag for images
                marker = L.marker([clue.latitude, clue.longitude], {
                    icon: L.divIcon({
                        className: 'custom-clue-marker',
                        html: `<div style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;"><img src="${imgSrc}" alt="Treasure Hunt" style="width: 40px; height: 40px; object-fit: contain;"></div>`,
                        iconSize: [40, 40],
                        iconAnchor: [20, 20]
                    })
                });
            } else if (isEmoji) {
                marker = L.marker([clue.latitude, clue.longitude], {
                    icon: L.divIcon({
                        className: 'custom-clue-marker',
                        html: `<div style="font-size: 32px; text-align: center; line-height: 1;">${icon}</div>`,
                        iconSize: [40, 40],
                        iconAnchor: [20, 20]
                    })
                });
            } else {
                marker = L.marker([clue.latitude, clue.longitude], {
                    icon: L.icon({
                        iconUrl: icon,
                        iconSize: [40, 40],
                        iconAnchor: [20, 20]
                    })
                });
            }

            marker.bindPopup(`
                <div style="min-width: 200px;">
                    <strong>Clue #${clue.clue_number}${clue.title ? ': ' + clue.title : ''}</strong><br>
                    ${clue.clue_text ? '<p>' + clue.clue_text + '</p>' : ''}
                </div>
            `);

            marker.addTo(treasureHuntMap);
            treasureHuntMarkers[clue.id] = marker;
        });
    }

    function editHunt(hunt) {
        document.getElementById('treasure-hunt-id').value = hunt.id;
        document.getElementById('treasure-hunt-name').value = hunt.name || '';
        document.getElementById('treasure-hunt-description').value = hunt.description || '';
        document.getElementById('treasure-hunt-icon').value = hunt.icon || '';
        document.getElementById('treasure-hunt-active').checked = hunt.is_active !== 0;
        document.getElementById('treasure-hunt-form-container').setAttribute('open', '');
    }

    async function deleteHunt(huntId) {
        if (!confirm('Are you sure you want to delete this treasure hunt? All clues will be deleted as well.')) {
            return;
        }

        try {
            const response = await fetch(`${API_URL}/${huntId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Failed to delete treasure hunt');
            
            if (selectedHuntId === huntId) {
                selectedHuntId = null;
                allClues = {};
                renderCluesOnMap();
                renderCluesList();
            }
            await loadTreasureHunts();
            alert('Treasure hunt deleted successfully');
        } catch (error) {
            console.error('Error deleting treasure hunt:', error);
            alert('Failed to delete treasure hunt');
        }
    }

    async function handleClueSubmit(e) {
        e.preventDefault();
        if (!selectedHuntId) {
            alert('Please select a treasure hunt first');
            return;
        }

        const formData = new FormData(e.target);
        const clueId = document.getElementById('treasure-hunt-clue-id').value;
        let iconValue = formData.get('icon');
        
        if (iconValue && iconValue.startsWith('data:image')) {
            try {
                const blob = await (await fetch(iconValue)).blob();
                const uploadFormData = new FormData();
                uploadFormData.append('icon', blob, `clue-icon-${Date.now()}.png`);
                
                const uploadResponse = await fetch('/api/routes/upload-icon', {
                    method: 'POST',
                    credentials: 'include',
                    body: uploadFormData
                });
                
                if (uploadResponse.ok) {
                    const uploadData = await uploadResponse.json();
                    iconValue = uploadData.iconUrl || iconValue;
                }
            } catch (uploadError) {
                console.error('Error uploading icon:', uploadError);
            }
        }
        
        const data = {
            clue_number: parseInt(formData.get('clue_number')),
            title: formData.get('title'),
            clue_text: formData.get('clue_text'),
            answer: formData.get('answer'),
            latitude: parseFloat(formData.get('latitude')),
            longitude: parseFloat(formData.get('longitude')),
            icon: iconValue,
            hint: formData.get('hint')
        };

        try {
            const url = clueId ? `${API_URL}/${selectedHuntId}/clues/${clueId}` : `${API_URL}/${selectedHuntId}/clues`;
            const method = clueId ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save clue');
            }
            
            await selectHunt(selectedHuntId);
            e.target.reset();
            document.getElementById('treasure-hunt-clue-id').value = '';
            document.getElementById('treasure-hunt-clue-hunt-id').value = selectedHuntId;
            document.getElementById('treasure-hunt-clue-form-container').removeAttribute('open');
            
            const iconPreview = document.getElementById('clue-icon-preview');
            if (iconPreview) iconPreview.style.display = 'none';
            const iconInput = document.getElementById('treasure-hunt-clue-icon');
            if (iconInput) iconInput.value = '';
            
            alert('Clue saved successfully!');
        } catch (error) {
            console.error('Error saving clue:', error);
            alert(error.message || 'Failed to save clue');
        }
    }

    function editClue(clue) {
        document.getElementById('treasure-hunt-clue-id').value = clue.id;
        document.getElementById('treasure-hunt-clue-number').value = clue.clue_number;
        document.getElementById('treasure-hunt-clue-title').value = clue.title || '';
        document.getElementById('treasure-hunt-clue-text').value = clue.clue_text || '';
        document.getElementById('treasure-hunt-clue-answer').value = clue.answer || '';
        document.getElementById('treasure-hunt-clue-latitude').value = clue.latitude;
        document.getElementById('treasure-hunt-clue-longitude').value = clue.longitude;
        document.getElementById('treasure-hunt-clue-icon').value = clue.icon || '';
        document.getElementById('treasure-hunt-clue-hint').value = clue.hint || '';
        
        if (clue.icon && typeof window.updateIconPreview === 'function') {
            const isImage = clue.icon.startsWith('data:image') || clue.icon.startsWith('http') || clue.icon.startsWith('/uploads/');
            window.updateIconPreview(clue.icon, isImage);
        }
        
        document.getElementById('treasure-hunt-clue-form-container').setAttribute('open', '');
        treasureHuntMap.closePopup();
    }

    async function deleteClue(clueId) {
        if (!confirm('Are you sure you want to delete this clue?')) {
            return;
        }

        try {
            const response = await fetch(`${API_URL}/${selectedHuntId}/clues/${clueId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Failed to delete clue');
            
            await selectHunt(selectedHuntId);
            alert('Clue deleted successfully');
        } catch (error) {
            console.error('Error deleting clue:', error);
            alert('Failed to delete clue');
        }
    }

    // Prize Management Functions
    async function setPrize(huntId, discountPercentage) {
        try {
            const response = await fetch(`${API_URL}/${huntId}/prize`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ discount_percentage: discountPercentage })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to set prize');
            }

            const data = await response.json();
            updatePrizeDisplay(data.hunt);
            alert(`Prize configuration set successfully! Unique codes will be generated for each user upon completion.`);
            await loadTreasureHunts();
        } catch (error) {
            console.error('Error setting prize:', error);
            alert(`Failed to set prize: ${error.message}`);
        }
    }

    async function removePrize(huntId) {
        if (!confirm('Are you sure you want to remove the prize from this hunt?')) {
            return;
        }

        try {
            const response = await fetch(`${API_URL}/${huntId}/prize`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to remove prize');
            }

            updatePrizeDisplay(null);
            alert('Prize removed successfully');
            await loadTreasureHunts();
        } catch (error) {
            console.error('Error removing prize:', error);
            alert(`Failed to remove prize: ${error.message}`);
        }
    }

    function updatePrizeDisplay(hunt) {
        const prizeDisplay = document.getElementById('prize-display');
        const discountDisplay = document.getElementById('prize-discount-display');
        const couponDisplay = document.getElementById('prize-coupon-display');
        const qrDisplay = document.getElementById('prize-qr-display');

        // Only show discount percentage (codes are generated per user on completion)
        if (hunt && hunt.prize_discount_percentage) {
            prizeDisplay.style.display = 'block';
            discountDisplay.textContent = hunt.prize_discount_percentage;
            couponDisplay.textContent = 'Generated per user on completion';
            qrDisplay.innerHTML = '<p style="font-size: 11px; color: rgba(255,255,255,0.6);">QR codes are generated uniquely for each user when they complete the hunt.</p>';
        } else {
            prizeDisplay.style.display = 'none';
        }
    }

    // Bind prize management events
    function bindPrizeEvents() {
        const setPrizeBtn = document.getElementById('set-prize-btn');
        const removePrizeBtn = document.getElementById('remove-prize-btn');

        if (setPrizeBtn) {
            setPrizeBtn.addEventListener('click', async () => {
                const huntId = document.getElementById('treasure-hunt-id').value;
                const discountPercentage = document.getElementById('prize-discount-percentage').value;

                if (!huntId) {
                    alert('Please save the hunt first before setting a prize');
                    return;
                }

                if (!discountPercentage) {
                    alert('Please select a discount percentage');
                    return;
                }

                await setPrize(parseInt(huntId), parseInt(discountPercentage));
            });
        }

        if (removePrizeBtn) {
            removePrizeBtn.addEventListener('click', async () => {
                const huntId = document.getElementById('treasure-hunt-id').value;
                if (!huntId) {
                    alert('No hunt selected');
                    return;
                }
                await removePrize(parseInt(huntId));
            });
        }
    }

    // Load and display user activity - MUST BE GLOBALLY ACCESSIBLE
    async function loadUserActivity() {
        console.log('=== Loading user activity ===');
        console.log('Function loadUserActivity called');
        console.log('This function is being executed!');
        const activitySection = document.getElementById('user-activity-section');
        const activityList = document.getElementById('user-activity-list');
        
        console.log('Activity section found:', !!activitySection);
        console.log('Activity list found:', !!activityList);
        
        if (!activitySection || !activityList) {
            console.error('User activity section not found!', { activitySection, activityList });
            return;
        }
        
        try {
            const url = `${API_URL}/users`;
            console.log('Fetching from:', url);
            console.log('API_URL:', API_URL);
            
            const response = await fetch(url, {
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            console.log('Response received');
            console.log('Response status:', response.status, response.statusText);
            console.log('Response ok:', response.ok);
            console.log('Response headers:', [...response.headers.entries()]);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Response error text:', errorText);
                throw new Error(`Failed to load user activity: ${response.status} ${response.statusText} - ${errorText}`);
            }
            
            const users = await response.json();
            console.log('Received users:', users);
            console.log('Number of users:', users.length);
            console.log('Users is array:', Array.isArray(users));
            
            if (users.length === 0) {
                activityList.innerHTML = '<div class="empty-state">No users have started any treasure hunts yet</div>';
                activitySection.style.display = 'block';
                return;
            }
            
            let html = '';
            users.forEach(user => {
                const lastActivity = user.last_activity 
                    ? new Date(user.last_activity).toLocaleString() 
                    : 'Never';
                
                html += `
                    <div class="user-activity-item">
                        <div class="user-activity-header">
                            <div>
                                <div class="user-activity-name">${escapeHtml(user.username || 'Unknown')}</div>
                                <div class="user-activity-email">${escapeHtml(user.email || 'No email')}</div>
                            </div>
                        </div>
                        <div class="user-activity-stats">
                            <div class="user-activity-stat">
                                <i class="fas fa-play-circle"></i>
                                <span>${user.total_hunts_started} started</span>
                            </div>
                            <div class="user-activity-stat">
                                <i class="fas fa-check-circle"></i>
                                <span>${user.total_hunts_completed} completed</span>
                            </div>
                        </div>
                        <div class="user-activity-last">
                            <i class="fas fa-clock"></i> Last activity: ${lastActivity}
                        </div>
                        ${user.hunts && user.hunts.length > 0 ? `
                            <div class="user-hunt-progress">
                                ${user.hunts.map(hunt => {
                                    const isCompleted = hunt.completed_at !== null;
                                    const progressPercent = hunt.total_clues > 0 
                                        ? Math.round((hunt.current_clue_number / hunt.total_clues) * 100)
                                        : 0;
                                    const displayPercent = isCompleted ? 100 : progressPercent;
                                    
                                    return `
                                        <div class="user-hunt-item">
                                            <div class="user-hunt-name">${escapeHtml(hunt.hunt_name || 'Unknown Hunt')}</div>
                                            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: rgba(255,255,255,0.7);">
                                                <span>Clue ${hunt.current_clue_number} / ${hunt.total_clues}</span>
                                                <span>${displayPercent}%</span>
                                            </div>
                                            <div class="user-hunt-progress-bar">
                                                <div class="user-hunt-progress-fill ${isCompleted ? 'completed' : ''}" style="width: ${displayPercent}%"></div>
                                            </div>
                                            ${isCompleted ? '<div style="color: #f59e0b; font-size: 10px; margin-top: 4px;"><i class="fas fa-trophy"></i> Completed</div>' : ''}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        ` : ''}
                    </div>
                `;
            });
            
            activityList.innerHTML = html;
            activitySection.style.display = 'block';
            console.log('✅ User activity loaded successfully');
        } catch (error) {
            console.error('❌ Error loading user activity:', error);
            console.error('Error stack:', error.stack);
            const activityList = document.getElementById('user-activity-list');
            if (activityList) {
                activityList.innerHTML = `<div class="empty-state" style="color: #ef4444;">Error loading users: ${error.message}<br><small>Check console for details</small></div>`;
            }
        }
    }
    
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Initialize everything - MUST BE AT THE END
    console.log('=== Initializing treasure hunt admin ===');
    
    // Update loading message immediately
    const list = document.getElementById('treasure-hunts-list');
    if (list) {
        list.innerHTML = '<li class="empty-state">Loading hunts...</li>';
    } else {
        console.error('treasure-hunts-list element not found!');
    }
    
    // Bind events
    console.log('Binding events...');
    try {
        bindEvents();
        bindPrizeEvents();
        console.log('Events bound successfully');
    } catch (err) {
        console.error('Error binding events:', err);
    }
    
    // Load hunts immediately
    console.log('Calling loadTreasureHunts...');
    const huntsPromise = loadTreasureHunts();
    console.log('loadTreasureHunts returned:', huntsPromise);
    console.log('Is promise?', huntsPromise instanceof Promise);
    
    huntsPromise.then(() => {
        console.log('✅ loadTreasureHunts completed successfully - INSIDE THEN');
        console.log('NOW calling loadUserActivity...');
        // Load user activity after hunts are loaded
        setTimeout(() => {
            console.log('About to call loadUserActivity (delayed)...');
            console.log('loadUserActivity function exists:', typeof loadUserActivity);
            if (typeof loadUserActivity === 'function') {
                console.log('Calling loadUserActivity now...');
                loadUserActivity().catch(err => {
                    console.error('Error in loadUserActivity promise:', err);
                });
            } else {
                console.error('loadUserActivity is not a function!', loadUserActivity);
            }
        }, 500);
    }).catch(err => {
        console.error('❌ loadTreasureHunts failed:', err);
        if (list) {
            list.innerHTML = `<li class="empty-state" style="color: #ef4444;">Error: ${err.message}</li>`;
        }
    });
    
    // ALSO call loadUserActivity directly - don't wait
    console.log('IMMEDIATE: About to call loadUserActivity directly...');
    setTimeout(() => {
        console.log('IMMEDIATE: Calling loadUserActivity after 1.5 seconds...');
        if (typeof loadUserActivity === 'function') {
            loadUserActivity().catch(err => {
                console.error('IMMEDIATE: Error:', err);
            });
        }
    }, 1500);
    
    // DIRECT CALL - Don't wait for loadTreasureHunts promise
    // Call loadUserActivity directly after a short delay
    setTimeout(() => {
        console.log('=== DIRECT CALL: Attempting to call loadUserActivity after 1 second ===');
        console.log('loadUserActivity type:', typeof loadUserActivity);
        console.log('loadUserActivity value:', loadUserActivity);
        
        if (typeof loadUserActivity === 'function') {
            console.log('DIRECT CALL: Calling loadUserActivity now...');
            loadUserActivity().then(() => {
                console.log('DIRECT CALL: loadUserActivity completed');
            }).catch(err => {
                console.error('DIRECT CALL: loadUserActivity error:', err);
                console.error('Error stack:', err.stack);
            });
        } else {
            console.error('DIRECT CALL: loadUserActivity is not a function!');
            console.error('Available functions:', Object.keys(window).filter(k => typeof window[k] === 'function' && k.includes('User')));
        }
    }, 1000);
    
    // Also try calling it directly after a longer delay (fallback)
    setTimeout(() => {
        console.log('Fallback 2: Attempting to call loadUserActivity after 5 seconds...');
        if (typeof loadUserActivity === 'function') {
            console.log('Fallback 2: Calling loadUserActivity...');
            loadUserActivity().catch(err => {
                console.error('Fallback 2 loadUserActivity error:', err);
            });
        } else {
            console.error('Fallback 2: loadUserActivity is not a function!');
        }
    }, 5000);
    
    // Invalidate map size
    setTimeout(() => {
        if (treasureHuntMap) {
            treasureHuntMap.invalidateSize();
            console.log('Map size invalidated');
        }
    }, 500);
    
    // FORCE CALL loadUserActivity - Independent of promise chain
    setTimeout(() => {
        console.log('=== FORCE CALL: loadUserActivity ===');
        console.log('loadUserActivity type:', typeof loadUserActivity);
        console.log('loadUserActivity:', loadUserActivity);
        try {
            if (typeof loadUserActivity === 'function') {
                console.log('FORCE: Calling loadUserActivity...');
                loadUserActivity().catch(err => {
                    console.error('FORCE: Promise rejected:', err);
                });
            } else {
                console.error('FORCE: loadUserActivity not found!');
                console.error('Available in scope:', Object.keys(this || {}));
            }
        } catch (e) {
            console.error('FORCE: Error calling loadUserActivity:', e);
            console.error('Error stack:', e.stack);
        }
    }, 2000);
    
    // Make function globally accessible
    window.loadUserActivity = loadUserActivity;
    console.log('loadUserActivity assigned to window.loadUserActivity');
});
