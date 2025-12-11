document.addEventListener('DOMContentLoaded', async () => {
    const editEventForm = document.getElementById('edit-event-form');
    const eventIdInput = document.getElementById('event-id');
    const nameInput = document.getElementById('name');
    const descriptionInput = document.getElementById('description');
    const websiteInput = document.getElementById('website');
    const dateInput = document.getElementById('date');
    const customPinInput = document.getElementById('custom_pin');
    const mapContainer = document.getElementById('map');

    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');

    let map;
    let marker;

    if (eventId) {
        const response = await fetch(`/api/events/${eventId}`);
        const event = await response.json();

        eventIdInput.value = event.id;
        nameInput.value = event.name;
        descriptionInput.value = event.description;
        websiteInput.value = event.website;
        dateInput.value = event.date;
        customPinInput.value = event.custom_pin;

        initializeMap(event.latitude, event.longitude);
    } else {
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
            // You might want to add hidden lat/lng inputs to the form
        });
    }

    editEventForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(editEventForm);
        const url = eventId ? `/admin/events/${eventId}` : '/admin/events';
        const method = eventId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            body: formData,
        });

        if (response.ok) {
            window.location.href = 'events.html';
        } else {
            const result = await response.json();
            alert(`Error: ${result.error}`);
        }
    });
});
