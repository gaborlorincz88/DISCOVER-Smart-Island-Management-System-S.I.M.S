document.addEventListener('DOMContentLoaded', () => {
    // Get API base URL - use current origin for production, or detect from window location
    const getApiBaseUrl = () => {
        // If we're on the production server, use the current origin
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            const origin = window.location.origin;
            console.log('[Category Editor] Using API base URL:', origin);
            return origin;
        }
        // For localhost, use the backend port
        const localhostUrl = 'http://localhost:3003';
        console.log('[Category Editor] Using localhost API base URL:', localhostUrl);
        return localhostUrl;
    };
    
    const apiBaseUrl = getApiBaseUrl();
    console.log('[Category Editor] API Base URL set to:', apiBaseUrl);
    const categoriesApiUrl = '/api/tour-categories';
    
    // --- Element Selectors ---
    const categoriesContainer = document.getElementById('categories-container');
    const loadingDiv = document.getElementById('loading');
    const addCategoryBtn = document.getElementById('add-category-btn');
    const categoryModal = document.getElementById('category-modal');
    const categoryForm = document.getElementById('category-form');
    const modalTitle = document.getElementById('modal-title');
    const cancelBtn = document.getElementById('cancel-btn');
    
    // Form elements
    const categoryIdInput = document.getElementById('category-id');
    const categoryNameInput = document.getElementById('category-name');
    const categoryDescriptionInput = document.getElementById('category-description');
    const categoryIconSelect = document.getElementById('category-icon');
    const categoryColorInput = document.getElementById('category-color');
    const colorValueSpan = document.getElementById('color-value');
    const categoryImageInput = document.getElementById('category-image');
    const imagePreview = document.getElementById('image-preview');
    const categoryOrderInput = document.getElementById('category-order');
    const categoryActiveInput = document.getElementById('category-active');
    
    let categories = [];
    let isEditing = false;
    let currentEditingId = null;

    // --- Initialize ---
    init();

    function init() {
        loadCategories();
        setupEventListeners();
    }

    function setupEventListeners() {
        // Add category button
        addCategoryBtn.addEventListener('click', () => openModal('add'));
        
        // Modal close
        cancelBtn.addEventListener('click', closeModal);
        categoryModal.addEventListener('click', (e) => {
            if (e.target === categoryModal) closeModal();
        });
        
        // Form submission
        categoryForm.addEventListener('submit', handleFormSubmit);
        
        // Color picker
        categoryColorInput.addEventListener('input', (e) => {
            colorValueSpan.textContent = e.target.value;
        });
        
        // Image preview
        categoryImageInput.addEventListener('change', handleImagePreview);
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });
    }

    async function loadCategories() {
        try {
            showLoading(true);
            
            const response = await fetch(categoriesApiUrl, {
                credentials: 'include' // Send cookies for authentication
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            categories = await response.json();
            
            // Normalize image URLs in all categories - replace localhost URLs with current API base URL
            categories = categories.map(category => {
                if (category.image) {
                    // Replace localhost URLs with current API base URL
                    if (category.image.startsWith('http://localhost:3003') || category.image.startsWith('https://localhost:3003')) {
                        category.image = category.image.replace(/https?:\/\/localhost:3003/, '');
                    }
                    // If it's already a full URL (not localhost), keep it; otherwise it's already a relative path
                }
                return category;
            });
            
            renderCategories();
            
        } catch (error) {
            console.error('Error loading categories:', error);
            showError('Failed to load categories. Please try again.');
        } finally {
            showLoading(false);
        }
    }

    function renderCategories() {
        if (!categories || categories.length === 0) {
            categoriesContainer.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-secondary);">
                    <p>No categories found. Click "Add New Category" to get started.</p>
                </div>
            `;
            return;
        }

        categoriesContainer.innerHTML = categories
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map(category => createCategoryCard(category))
            .join('');
    }

    function createCategoryCard(category) {
        // Normalize image URL - handle both relative paths and full URLs
        let imageUrl = '';
        if (category.image) {
            if (category.image.startsWith('http://localhost:3003') || category.image.startsWith('https://localhost:3003')) {
                // Replace localhost URL with current API base URL
                imageUrl = category.image.replace(/https?:\/\/localhost:3003/, apiBaseUrl);
            } else if (category.image.startsWith('http')) {
                // Already a full URL, use as-is
                imageUrl = category.image;
            } else {
                // Relative path, prepend API base URL
                imageUrl = `${apiBaseUrl}${category.image}`;
            }
        } else {
            imageUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDMwMCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMTUwIiBmaWxsPSIjRjBGMEYwIi8+Cjx0ZXh0IHg9IjE1MCIgeT0iNzUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4=';
        }
        
        return `
            <div class="category-card" data-category-id="${category.id}">
                <img src="${imageUrl}" alt="${category.name}" class="category-image" 
                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDMwMCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMTUwIiBmaWxsPSIjRjBGMEYwIi8+Cjx0ZXh0IHg9IjE1MCIgeT0iNzUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4='">
                
                <div class="category-header">
                    <h3 class="category-name">${category.icon || '📁'} ${category.name}</h3>
                    <span class="category-status ${category.active ? 'status-active' : 'status-inactive'}">
                        ${category.active ? 'Active' : 'Inactive'}
                    </span>
                </div>
                
                <p class="category-description">${category.description || 'No description provided.'}</p>
                
                <div class="category-meta">
                    <span>Order: ${category.order || 1}</span>
                    <span style="color: ${category.color || '#3b82f6'};">●</span>
                </div>
                
                <div class="category-actions">
                    <button class="btn-edit" onclick="editCategory('${category.id}')">Edit</button>
                    <button class="btn-delete" onclick="deleteCategory('${category.id}')">Delete</button>
                </div>
            </div>
        `;
    }

    function openModal(mode, categoryId = null) {
        isEditing = mode === 'edit';
        currentEditingId = categoryId;
        
        // Reset form
        categoryForm.reset();
        colorValueSpan.textContent = categoryColorInput.value;
        imagePreview.style.display = 'none';
        
        if (isEditing && categoryId) {
            const category = categories.find(c => c.id === categoryId);
            if (category) {
                modalTitle.textContent = 'Edit Category';
                categoryIdInput.value = category.id;
                categoryNameInput.value = category.name;
                categoryDescriptionInput.value = category.description || '';
                categoryIconSelect.value = category.icon || '🏛️';
                categoryColorInput.value = category.color || '#3b82f6';
                colorValueSpan.textContent = category.color || '#3b82f6';
                categoryOrderInput.value = category.order || 1;
                categoryActiveInput.checked = category.active !== false;
                
                if (category.image) {
                    // Normalize image URL - handle both relative paths and full URLs
                    let imageUrl = '';
                    if (category.image.startsWith('http://localhost:3003') || category.image.startsWith('https://localhost:3003')) {
                        // Replace localhost URL with current API base URL
                        imageUrl = category.image.replace(/https?:\/\/localhost:3003/, apiBaseUrl);
                    } else if (category.image.startsWith('http')) {
                        // Already a full URL, use as-is
                        imageUrl = category.image;
                    } else {
                        // Relative path, prepend API base URL
                        imageUrl = `${apiBaseUrl}${category.image}`;
                    }
                    imagePreview.src = imageUrl;
                    imagePreview.style.display = 'block';
                }
            }
        } else {
            modalTitle.textContent = 'Add New Category';
        }
        
        categoryModal.style.display = 'flex';
        categoryNameInput.focus();
    }

    function closeModal() {
        categoryModal.style.display = 'none';
        isEditing = false;
        currentEditingId = null;
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData();
        formData.append('name', categoryNameInput.value.trim());
        formData.append('description', categoryDescriptionInput.value.trim());
        formData.append('icon', categoryIconSelect.value);
        formData.append('color', categoryColorInput.value);
        formData.append('order', parseInt(categoryOrderInput.value) || 1);
        formData.append('active', categoryActiveInput.checked);
        
        if (categoryImageInput.files[0]) {
            formData.append('image', categoryImageInput.files[0]);
        }
        
        try {
            showLoading(true);
            
            const url = isEditing ? `${categoriesApiUrl}/${currentEditingId}` : categoriesApiUrl;
            const method = isEditing ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                body: formData,
                credentials: 'include' // Send cookies for authentication
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (isEditing) {
                // Update existing category in local array
                const index = categories.findIndex(c => c.id === currentEditingId);
                if (index !== -1) {
                    categories[index] = { ...categories[index], ...result };
                }
            } else {
                // Add new category to local array
                categories.push(result);
            }
            
            renderCategories();
            closeModal();
            showSuccess(isEditing ? 'Category updated successfully!' : 'Category created successfully!');
            
        } catch (error) {
            console.error('Error saving category:', error);
            showError(`Failed to save category: ${error.message}`);
        } finally {
            showLoading(false);
        }
    }

    function handleImagePreview(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
                imagePreview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else {
            imagePreview.style.display = 'none';
        }
    }

    async function deleteCategory(categoryId) {
        const category = categories.find(c => c.id === categoryId);
        if (!category) return;
        
        if (!confirm(`Are you sure you want to delete "${category.name}"? This action cannot be undone.`)) {
            return;
        }
        
        try {
            showLoading(true);
            
            const response = await fetch(`${categoriesApiUrl}/${categoryId}`, {
                method: 'DELETE',
                credentials: 'include' // Send cookies for authentication
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            
            // Remove from local array
            categories = categories.filter(c => c.id !== categoryId);
            renderCategories();
            showSuccess('Category deleted successfully!');
            
        } catch (error) {
            console.error('Error deleting category:', error);
            showError(`Failed to delete category: ${error.message}`);
        } finally {
            showLoading(false);
        }
    }

    function showLoading(show) {
        loadingDiv.style.display = show ? 'block' : 'none';
        categoriesContainer.style.display = show ? 'none' : 'grid';
    }

    function showError(message) {
        // Create or update error message
        let errorDiv = document.getElementById('error-message');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'error-message';
            errorDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #ef4444;
                color: white;
                padding: 12px 20px;
                border-radius: 6px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10000;
                max-width: 400px;
            `;
            document.body.appendChild(errorDiv);
        }
        
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }

    function showSuccess(message) {
        // Create or update success message
        let successDiv = document.getElementById('success-message');
        if (!successDiv) {
            successDiv = document.createElement('div');
            successDiv.id = 'success-message';
            successDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #10b981;
                color: white;
                padding: 12px 20px;
                border-radius: 6px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10000;
                max-width: 400px;
            `;
            document.body.appendChild(successDiv);
        }
        
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        
        setTimeout(() => {
            successDiv.style.display = 'none';
        }, 3000);
    }

    // Global functions for onclick handlers
    window.editCategory = function(categoryId) {
        openModal('edit', categoryId);
    };

    window.deleteCategory = function(categoryId) {
        deleteCategory(categoryId);
    };
});
