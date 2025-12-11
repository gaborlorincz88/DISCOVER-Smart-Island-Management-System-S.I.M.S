// Enhance image inputs with gallery selection
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎨 Admin: Enhancing image inputs with gallery...');
    
    // Wait a bit for image-gallery-modal.js to load
    setTimeout(() => {
        if (typeof enhanceImageInputWithGallery === 'function') {
            // Place gallery images (main edit form)
            const placeImagesInput = document.getElementById('images');
            if (placeImagesInput && !placeImagesInput.dataset.galleryEnhanced) {
                console.log('✅ Enhancing place gallery images input');
                // Force single-click selection behavior (like the custom icon flow) even though
                // the input supports multiple files. This makes the gallery close on click and
                // triggers the same imageSelectedFromGallery event handlers.
                placeImagesInput.dataset.forceGallerySingle = 'true';
                enhanceImageInputWithGallery(placeImagesInput, null, false); // Single-select for gallery
                placeImagesInput.dataset.galleryEnhanced = 'true';
                
                // Add event listener for gallery selection
                placeImagesInput.addEventListener('imageSelectedFromGallery', (e) => {
                    const selectedImage = e.detail;
                    console.log('Place gallery image selected:', selectedImage);
                    
                    // Add image to existingImages array and show preview
                    if (typeof existingImages !== 'undefined') {
                        // Check if image is already in the array to avoid duplicates
                        if (!existingImages.includes(selectedImage.path)) {
                            existingImages.push(selectedImage.path);
                            console.log('✅ Added gallery-selected image to existingImages:', selectedImage.path);
                            
                            // Update the preview if the function exists
                            if (typeof renderImagePreviews === 'function') {
                                renderImagePreviews();
                            }
                        }
                    } else {
                        console.error('existingImages array not found!');
                    }
                    
                    // Store selected image path for form submission
                    if (!placeImagesInput.dataset.selectedImages) {
                        placeImagesInput.dataset.selectedImages = JSON.stringify([]);
                    }
                    const selectedImages = JSON.parse(placeImagesInput.dataset.selectedImages);
                    if (!selectedImages.includes(selectedImage.path)) {
                        selectedImages.push(selectedImage.path);
                        placeImagesInput.dataset.selectedImages = JSON.stringify(selectedImages);
                    }
                    
                    console.log('Total selected place images:', selectedImages.length);
                });
            }
            
            // Event images
            const eventImagesInput = document.getElementById('event-images');
            if (eventImagesInput && !eventImagesInput.dataset.galleryEnhanced) {
                console.log('✅ Enhancing event images input');
                // Force single-click selection for event images as well (consistent UX)
                eventImagesInput.dataset.forceGallerySingle = 'true';
                enhanceImageInputWithGallery(eventImagesInput, null, false); // Single-select for events
                eventImagesInput.dataset.galleryEnhanced = 'true';
                
                // Add event listener for gallery selection
                eventImagesInput.addEventListener('imageSelectedFromGallery', (e) => {
                    const selectedImage = e.detail;
                    console.log('Event image selected from gallery:', selectedImage);
                    
                    // Add image to existingEventImages array and show preview
                    if (typeof existingEventImages !== 'undefined') {
                        // Check if image is already in the array to avoid duplicates
                        if (!existingEventImages.includes(selectedImage.path)) {
                            existingEventImages.push(selectedImage.path);
                            console.log('✅ Added gallery-selected image to existingEventImages:', selectedImage.path);
                            
                            // Update the preview if the function exists
                            if (typeof renderEventImagePreviews === 'function') {
                                renderEventImagePreviews();
                            }
                        }
                    }
                    
                    // Create a visual indicator that image was selected
                    const indicator = document.createElement('div');
                    indicator.className = 'selected-image-indicator';
                    indicator.style.cssText = 'display: inline-block; margin: 5px; padding: 5px 10px; background: #10b981; color: white; border-radius: 5px; font-size: 12px;';
                    indicator.innerHTML = `✓ ${selectedImage.filename}`;
                    
                    // Add after the input
                    const container = eventImagesInput.parentElement;
                    const existingIndicators = container.querySelector('.gallery-selected-images');
                    if (!existingIndicators) {
                        const indicatorsDiv = document.createElement('div');
                        indicatorsDiv.className = 'gallery-selected-images';
                        indicatorsDiv.style.cssText = 'margin-top: 10px;';
                        container.appendChild(indicatorsDiv);
                    }
                    container.querySelector('.gallery-selected-images').appendChild(indicator);
                    
                    // Store selected image path (single image for events) - this is a backup in case existingEventImages isn't accessible
                    eventImagesInput.dataset.selectedImagePath = selectedImage.path;
                    
                    console.log('Event image selected:', selectedImage.filename);
                });
            }
        }
    }, 500); // 500ms delay to ensure image-gallery-modal.js is loaded

    // Watch for dynamic insertion of the form inputs (some editors recreate the form)
    // If the inputs are re-inserted later we need to re-apply the enhancement and dataset flags.
    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (!(node instanceof HTMLElement)) continue;

                // If a whole form/container was added, search inside it
                const maybePlaceInput = node.id === 'images' ? node : node.querySelector && node.querySelector('#images');
                if (maybePlaceInput && !maybePlaceInput.dataset.galleryEnhanced) {
                    console.log('admin-enhancement: detected insertion of place images input, applying gallery enhancement');
                    maybePlaceInput.dataset.forceGallerySingle = 'true';
                    enhanceImageInputWithGallery(maybePlaceInput, null, false);
                    maybePlaceInput.dataset.galleryEnhanced = 'true';

                    // Attach the event listener (same as initial wiring)
                    maybePlaceInput.addEventListener('imageSelectedFromGallery', (e) => {
                        const selectedImage = e.detail;
                        console.log('Place gallery image selected (observer):', selectedImage);
                        if (typeof existingImages !== 'undefined') {
                            if (!existingImages.includes(selectedImage.path)) {
                                existingImages.push(selectedImage.path);
                                if (typeof renderImagePreviews === 'function') renderImagePreviews();
                            }
                        }
                        if (!maybePlaceInput.dataset.selectedImages) maybePlaceInput.dataset.selectedImages = JSON.stringify([]);
                        const selectedImages = JSON.parse(maybePlaceInput.dataset.selectedImages);
                        if (!selectedImages.includes(selectedImage.path)) {
                            selectedImages.push(selectedImage.path);
                            maybePlaceInput.dataset.selectedImages = JSON.stringify(selectedImages);
                        }
                    });
                }

                const maybeEventInput = node.id === 'event-images' ? node : node.querySelector && node.querySelector('#event-images');
                if (maybeEventInput && !maybeEventInput.dataset.galleryEnhanced) {
                    console.log('admin-enhancement: detected insertion of event images input, applying gallery enhancement');
                    maybeEventInput.dataset.forceGallerySingle = 'true';
                    enhanceImageInputWithGallery(maybeEventInput, null, false);
                    maybeEventInput.dataset.galleryEnhanced = 'true';

                    maybeEventInput.addEventListener('imageSelectedFromGallery', (e) => {
                        const selectedImage = e.detail;
                        console.log('Event image selected from gallery (observer):', selectedImage);
                        if (typeof existingEventImages !== 'undefined') {
                            if (!existingEventImages.includes(selectedImage.path)) {
                                existingEventImages.push(selectedImage.path);
                                if (typeof renderEventImagePreviews === 'function') renderEventImagePreviews();
                            }
                        }
                        const indicator = document.createElement('div');
                        indicator.className = 'selected-image-indicator';
                        indicator.style.cssText = 'display: inline-block; margin: 5px; padding: 5px 10px; background: #10b981; color: white; border-radius: 5px; font-size: 12px;';
                        indicator.innerHTML = `✓ ${selectedImage.filename}`;
                        const container = maybeEventInput.parentElement;
                        let indicatorsDiv = container.querySelector('.gallery-selected-images');
                        if (!indicatorsDiv) {
                            indicatorsDiv = document.createElement('div');
                            indicatorsDiv.className = 'gallery-selected-images';
                            indicatorsDiv.style.cssText = 'margin-top: 10px;';
                            container.appendChild(indicatorsDiv);
                        }
                        indicatorsDiv.appendChild(indicator);
                        maybeEventInput.dataset.selectedImagePath = selectedImage.path;
                    });
                }
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    
    // Intercept form submissions to add gallery-selected images
    const placeForm = document.getElementById('place-form');
    const eventForm = document.getElementById('event-form');
    
    if (placeForm) {
        placeForm.addEventListener('submit', (e) => {
            const imagesInput = document.getElementById('images');
            if (imagesInput && imagesInput.dataset.selectedImages) {
                const selectedImages = JSON.parse(imagesInput.dataset.selectedImages);
                if (selectedImages.length > 0) {
                    console.log('Adding gallery-selected images to form data:', selectedImages);
                    
                    // Create hidden input with selected image paths
                    let hiddenInput = document.getElementById('gallery-selected-images');
                    if (!hiddenInput) {
                        hiddenInput = document.createElement('input');
                        hiddenInput.type = 'hidden';
                        hiddenInput.id = 'gallery-selected-images';
                        hiddenInput.name = 'gallerySelectedImages';
                        placeForm.appendChild(hiddenInput);
                    }
                    hiddenInput.value = JSON.stringify(selectedImages);
                }
            }
        }, true); // Use capture phase to run before the main handler
    }
    
    if (eventForm) {
        eventForm.addEventListener('submit', (e) => {
            const imagesInput = document.getElementById('event-images');
            if (imagesInput && imagesInput.dataset.selectedImagePath) {
                const selectedImagePath = imagesInput.dataset.selectedImagePath;
                console.log('Adding gallery-selected event image to form data:', selectedImagePath);
                
                // Create hidden input with selected image path
                let hiddenInput = document.getElementById('gallery-selected-event-images');
                if (!hiddenInput) {
                    hiddenInput = document.createElement('input');
                    hiddenInput.type = 'hidden';
                    hiddenInput.id = 'gallery-selected-event-images';
                    hiddenInput.name = 'gallerySelectedImages';
                    eventForm.appendChild(hiddenInput);
                }
                hiddenInput.value = JSON.stringify([selectedImagePath]);
            }
        }, true); // Use capture phase to run before the main handler
    }
    
    // Add form reset handlers to clear selected images
    if (placeForm) {
        placeForm.addEventListener('reset', () => {
            const imagesInput = document.getElementById('images');
            if (imagesInput) {
                delete imagesInput.dataset.selectedImages;
                const container = imagesInput.parentElement;
                const indicators = container.querySelector('.gallery-selected-images');
                if (indicators) {
                    indicators.remove();
                }
            }
        });
    }
    
    if (eventForm) {
        eventForm.addEventListener('reset', () => {
            const imagesInput = document.getElementById('event-images');
            if (imagesInput) {
                delete imagesInput.dataset.selectedImagePath;
                const container = imagesInput.parentElement;
                const indicators = container.querySelector('.gallery-selected-images');
                if (indicators) {
                    indicators.remove();
                }
            }
        });
    }
});

