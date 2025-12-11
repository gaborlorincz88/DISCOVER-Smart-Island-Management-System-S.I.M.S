document.addEventListener('DOMContentLoaded', async () => {
    const eventsList = document.getElementById('events-list');
    const editEventCard = document.getElementById('edit-event-card');
    const editEventForm = document.getElementById('edit-event-form');
    const mapContainer = document.getElementById('map');

    let map;
    const markers = {};
    let events = [];

    // Initialize Map
    map = L.map(mapContainer).setView([36.04, 14.25], 13);
    
    // Use local tiles for offline functionality
    const gozoBounds = L.latLngBounds([35.98, 14.15], [36.09, 14.40]);
    
    L.tileLayer('/tiles/gozo/{z}/{x}/{y}.png', {
        maxZoom: 19,
        minZoom: 12,
        attribution: 'Discover Gozo | &copy; Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP',
        bounds: gozoBounds,
        errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    }).addTo(map);
    
    map.setMaxBounds(gozoBounds);

    // Fetch Events
    const response = await fetch('/api/events');
    events = await response.json();
    renderEventsList();
    renderMapMarkers();

    function renderEventsList() {
        eventsList.innerHTML = '';
        const newEventButton = document.createElement('button');
        newEventButton.textContent = 'Add New Event';
        newEventButton.addEventListener('click', () => selectEvent({}));
        eventsList.appendChild(newEventButton);

        events.forEach(event => {
            const item = document.createElement('div');
            item.className = 'event-item';
            item.textContent = event.name;
            item.dataset.id = event.id;
            item.addEventListener('click', () => selectEvent(event));
            eventsList.appendChild(item);
        });
    }

    function renderMapMarkers() {
        events.forEach(event => {
            if (event.latitude && event.longitude) {
                const marker = L.marker([event.latitude, event.longitude]).addTo(map);
                marker.on('click', () => selectEvent(event));
                markers[event.id] = marker;
            }
        });
    }

    function selectEvent(event) {
        document.querySelectorAll('.event-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.id == event.id);
        });

        editEventCard.style.display = 'block';
        editEventForm.innerHTML = `
            <input type="hidden" name="id" value="${event.id || ''}">
            <label for="name">Name:</label>
            <input type="text" name="name" value="${event.name || ''}" required>
            <label for="description">Description:</label>
            <textarea name="description">${event.description || ''}</textarea>
            <label for="latitude">Latitude:</label>
            <input type="number" name="latitude" value="${event.latitude || ''}" step="any">
            <label for="longitude">Longitude:</label>
            <input type="number" name="longitude" value="${event.longitude || ''}" step="any">
            <label for="website">Website:</label>
            <input type="url" name="website" value="${event.website || ''}">
            <label for="custom_pin">Custom Pin:</label>
            <input type="text" name="custom_pin" value="${event.custom_pin || ''}">
            <button type="submit">${event.id ? 'Save Event' : 'Create Event'}</button>
        `;

        if (event.latitude && event.longitude) {
            map.panTo([event.latitude, event.longitude]);
        }
    }

    editEventForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(editEventForm);
        const id = formData.get('id');
        const url = id ? `/api/events/${id}` : '/api/events';
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            body: new URLSearchParams(formData),
            credentials: 'include' // Send cookies for authentication
        });

        if (response.ok) {
            alert('Event saved successfully!');
            const savedEvent = await response.json();
            if (id) {
                events = events.map(e => e.id == id ? savedEvent : e);
            } else {
                events.push(savedEvent);
            }
            renderEventsList();
            // Update marker
        } else {
            alert('Error saving event.');
        }
    });
});
