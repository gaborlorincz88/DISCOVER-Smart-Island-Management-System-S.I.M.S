// Enhance category editor image inputs with gallery selection
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎨 Category Editor: Enhancing image inputs with gallery...');
    
    // Get API base URL - use current origin for production, or detect from window location
    const getApiBaseUrl = () => {
        // If we're on the production server, use the current origin
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            return window.location.origin;
        }
        // For localhost, use the backend port
        return 'http://localhost:3003';
    };
    
    const apiBaseUrl = getApiBaseUrl();
    
    // Wait a bit for image-gallery-modal.js to load
    setTimeout(() => {
        if (typeof enhanceImageInputWithGallery === 'function') {
            // Category image input
            const categoryImageInput = document.getElementById('category-image');
            const imagePreview = document.getElementById('image-preview');
            
            if (categoryImageInput && !categoryImageInput.dataset.galleryEnhanced) {
                console.log('✅ Enhancing category image input');
                enhanceImageInputWithGallery(categoryImageInput, imagePreview, false); // Single image for category
                categoryImageInput.dataset.galleryEnhanced = 'true';
                
                // Add event listener for gallery selection
                categoryImageInput.addEventListener('imageSelectedFromGallery', (e) => {
                    const selectedImage = e.detail;
                    console.log('Category image selected from gallery:', selectedImage);
                    
                    // Set the preview - ensure we use the full API URL
                    if (imagePreview) {
                        // If path is already a full URL, use it; otherwise prepend apiBaseUrl
                        const imageUrl = selectedImage.path.startsWith('http') 
                            ? selectedImage.path 
                            : `${apiBaseUrl}${selectedImage.path}`;
                        imagePreview.src = imageUrl;
                        imagePreview.style.display = 'block';
                    }
                    
                    // Store the selected image path (keep relative path for form submission)
                    categoryImageInput.dataset.selectedImagePath = selectedImage.path;
                    
                    // Clear the file input
                    categoryImageInput.value = '';
                    
                    console.log('Category image set to:', selectedImage.path);
                });
            }
        }
    }, 500); // 500ms delay to ensure image-gallery-modal.js is loaded
    
    // Intercept form submissions to add gallery-selected image
    const categoryForm = document.getElementById('category-form');
    
    if (categoryForm) {
        categoryForm.addEventListener('submit', (e) => {
            const imageInput = document.getElementById('category-image');
            if (imageInput && imageInput.dataset.selectedImagePath) {
                console.log('Adding gallery-selected image to category form:', imageInput.dataset.selectedImagePath);
                
                // Create hidden input with selected image path
                let hiddenInput = document.getElementById('gallery-selected-category-image');
                if (!hiddenInput) {
                    hiddenInput = document.createElement('input');
                    hiddenInput.type = 'hidden';
                    hiddenInput.id = 'gallery-selected-category-image';
                    hiddenInput.name = 'gallerySelectedImage';
                    categoryForm.appendChild(hiddenInput);
                }
                hiddenInput.value = imageInput.dataset.selectedImagePath;
            }
        }, true); // Use capture phase to run before the main handler
        
        // Add form reset handler to clear selected image
        categoryForm.addEventListener('reset', () => {
            const imageInput = document.getElementById('category-image');
            if (imageInput) {
                delete imageInput.dataset.selectedImagePath;
            }
        });
    }
});


