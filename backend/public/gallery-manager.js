// Gallery Manager JavaScript
let currentFolderId = 'root';
let folders = [];
let currentImages = [];
let selectedImages = new Set();
let currentView = 'grid';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎨 Gallery Manager initialized');
    console.log('📁 DOM elements:', {
        folderTree: document.getElementById('folder-tree'),
        galleryGrid: document.getElementById('gallery-grid'),
        breadcrumb: document.getElementById('breadcrumb'),
        searchInput: document.getElementById('search-input')
    });
    loadFolders();
    setupEventListeners();
});

function setupEventListeners() {
    // Search
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', debounce(handleSearch, 300));
    
    // View controls
    document.querySelectorAll('.view-controls button').forEach(btn => {
        btn.addEventListener('click', () => {
            currentView = btn.dataset.view;
            document.querySelectorAll('.view-controls button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateView();
        });
    });
    
    // Upload drag and drop
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    
    dropZone.addEventListener('click', () => fileInput.click());
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });
    
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });
    
    // Close context menu on click outside
    document.addEventListener('click', () => {
        hideContextMenu();
    });
}

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Load folders
async function loadFolders() {
    try {
        showLoading(true);
        const response = await fetch('/api/gallery-manager/folders', {
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Failed to load folders');
        
        const data = await response.json();
        folders = data.folders;
        
        renderFolderTree();
        updateFolderSelects();
        loadImages(currentFolderId);
    } catch (error) {
        console.error('Error loading folders:', error);
        showNotification('Failed to load folders', 'error');
    } finally {
        showLoading(false);
    }
}

// Render folder tree
function renderFolderTree() {
    const tree = document.getElementById('folder-tree');
    tree.innerHTML = '';
    
    // Build tree structure
    const buildTree = (parentId) => {
        return folders
            .filter(f => f.parent === parentId)
            .map(folder => ({
                ...folder,
                children: buildTree(folder.id)
            }));
    };
    
    const treeData = buildTree('root');
    
    // Render tree
    const renderFolder = (folder, level = 0) => {
        const div = document.createElement('div');
        
        const item = document.createElement('div');
        item.className = 'folder-item' + (folder.id === currentFolderId ? ' active' : '');
        item.style.paddingLeft = `${level * 16 + 12}px`;
        item.draggable = true;
        item.dataset.folderId = folder.id;
        
        item.innerHTML = `
            <i class="fas fa-folder${folder.id === 'root' ? '-open' : ''}"></i>
            <span class="folder-name">${folder.name}</span>
            ${folder.id !== 'root' ? `
                <div class="folder-actions">
                    <button onclick="event.stopPropagation(); renameFolderPrompt('${folder.id}')" title="Rename">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="event.stopPropagation(); deleteFolderPrompt('${folder.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            ` : ''}
        `;
        
        item.addEventListener('click', () => selectFolder(folder.id));
        
        // Drag and drop for folders
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('folderId', folder.id);
            e.dataTransfer.effectAllowed = 'move';
        });
        
        item.addEventListener('dragover', (e) => {
            if (folder.id !== 'root') {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                item.classList.add('drag-over');
            }
        });
        
        item.addEventListener('dragleave', () => {
            item.classList.remove('drag-over');
        });
        
        item.addEventListener('drop', async (e) => {
            e.preventDefault();
            item.classList.remove('drag-over');
            
            // Check if dropping images
            const imageData = e.dataTransfer.getData('imagePaths');
            if (imageData) {
                const imagePaths = JSON.parse(imageData);
                await moveImagesToFolder(imagePaths, folder.id);
                return;
            }
        });
        
        div.appendChild(item);
        
        if (folder.children && folder.children.length > 0) {
            const childrenDiv = document.createElement('div');
            childrenDiv.className = 'folder-children';
            folder.children.forEach(child => {
                childrenDiv.appendChild(renderFolder(child, level + 1));
            });
            div.appendChild(childrenDiv);
        }
        
        return div;
    };
    
    // Add root folder
    const rootFolder = folders.find(f => f.id === 'root');
    if (rootFolder) {
        tree.appendChild(renderFolder({ ...rootFolder, children: treeData }));
    }
}

// Select folder
function selectFolder(folderId) {
    currentFolderId = folderId;
    deselectAll();
    renderFolderTree();
    loadImages(folderId);
    updateBreadcrumb();
}

// Update breadcrumb
function updateBreadcrumb() {
    const breadcrumb = document.getElementById('breadcrumb');
    breadcrumb.innerHTML = '';
    
    if (currentFolderId === 'root') {
        breadcrumb.innerHTML = '<span class="breadcrumb-item active">All Images</span>';
        return;
    }
    
    // Build path
    const path = [];
    let currentId = currentFolderId;
    
    while (currentId && currentId !== 'root') {
        const folder = folders.find(f => f.id === currentId);
        if (folder) {
            path.unshift(folder);
            currentId = folder.parent;
        } else {
            break;
        }
    }
    
    // Add root
    const rootLink = document.createElement('a');
    rootLink.href = '#';
    rootLink.className = 'breadcrumb-item';
    rootLink.textContent = 'All Images';
    rootLink.onclick = (e) => {
        e.preventDefault();
        selectFolder('root');
    };
    breadcrumb.appendChild(rootLink);
    
    // Add path
    path.forEach((folder, index) => {
        breadcrumb.appendChild(document.createTextNode(' / '));
        
        const link = document.createElement('a');
        link.href = '#';
        link.className = 'breadcrumb-item' + (index === path.length - 1 ? ' active' : '');
        link.textContent = folder.name;
        link.onclick = (e) => {
            e.preventDefault();
            selectFolder(folder.id);
        };
        breadcrumb.appendChild(link);
    });
}

// Load images
async function loadImages(folderId) {
    try {
        showLoading(true);
        const response = await fetch(`/api/gallery-manager/images/${folderId}`, {
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Failed to load images');
        
        const data = await response.json();
        currentImages = data.images || [];
        
        renderImages();
    } catch (error) {
        console.error('Error loading images:', error);
        showNotification('Failed to load images', 'error');
    } finally {
        showLoading(false);
    }
}

// Render images
function renderImages(images = currentImages) {
    const grid = document.getElementById('gallery-grid');
    grid.innerHTML = '';
    
    if (images.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-images"></i>
                <h3>No images in this folder</h3>
                <p>Upload images or move them from other folders</p>
                <button class="btn btn-primary" onclick="showUploadModal()" style="margin-top: 16px;">
                    <i class="fas fa-upload"></i> Upload Images
                </button>
            </div>
        `;
        return;
    }
    
    images.forEach(image => {
        const card = document.createElement('div');
        card.className = 'image-card';
        if (selectedImages.has(image.path)) {
            card.classList.add('selected');
        }
        card.draggable = true;
        card.dataset.imagePath = image.path;
        
        card.innerHTML = `
            <input type="checkbox" class="image-checkbox" ${selectedImages.has(image.path) ? 'checked' : ''}>
            <img src="${image.path}" alt="${image.name}" class="image-thumbnail" loading="lazy">
            <div class="image-actions">
                <button onclick="copyImagePath('${image.path}')" title="Copy Path">
                    <i class="fas fa-copy"></i>
                </button>
                <button onclick="deleteImage('${image.path}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="image-info">
                <div class="image-name" title="${image.name}">${image.name}</div>
                <div class="image-meta">
                    <span>${formatFileSize(image.size)}</span>
                    <span>${formatDate(image.created)}</span>
                </div>
            </div>
        `;
        
        // Click event to show image in modal
        card.addEventListener('click', (e) => {
            // Don't trigger if clicking on checkbox or action buttons
            if (e.target.closest('.image-checkbox') || e.target.closest('.image-actions') || e.target.closest('.image-info')) {
                return;
            }
            showImageModal(image);
        });
        
        // Checkbox event
        const checkbox = card.querySelector('.image-checkbox');
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            toggleImageSelection(image.path);
        });
        
        // Right click context menu
        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showContextMenu(e.clientX, e.clientY, image);
        });
        
        // Drag and drop
        card.addEventListener('dragstart', (e) => {
            if (!selectedImages.has(image.path)) {
                selectedImages.clear();
                selectedImages.add(image.path);
                updateSelectionUI();
            }
            
            const paths = Array.from(selectedImages);
            e.dataTransfer.setData('imagePaths', JSON.stringify(paths));
            e.dataTransfer.effectAllowed = 'move';
            card.classList.add('dragging');
        });
        
        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
        });
        
        grid.appendChild(card);
    });
    
    updateView();
}

// Toggle image selection
function toggleImageSelection(path) {
    if (selectedImages.has(path)) {
        selectedImages.delete(path);
    } else {
        selectedImages.add(path);
    }
    updateSelectionUI();
}

// Update selection UI
function updateSelectionUI() {
    const count = selectedImages.size;
    document.getElementById('selected-count').textContent = count;
    document.getElementById('bulk-actions').classList.toggle('visible', count > 0);
    
    // Update card selection state
    document.querySelectorAll('.image-card').forEach(card => {
        const path = card.dataset.imagePath;
        const isSelected = selectedImages.has(path);
        card.classList.toggle('selected', isSelected);
        const checkbox = card.querySelector('.image-checkbox');
        if (checkbox) checkbox.checked = isSelected;
    });
}

// Select/Deselect all
function selectAll() {
    currentImages.forEach(img => selectedImages.add(img.path));
    updateSelectionUI();
}

function deselectAll() {
    selectedImages.clear();
    updateSelectionUI();
}

// Update view
function updateView() {
    const grid = document.getElementById('gallery-grid');
    if (currentView === 'list') {
        grid.classList.add('list-view');
    } else {
        grid.classList.remove('list-view');
    }
}

// Search
async function handleSearch(e) {
    const query = e.target.value.trim();
    
    if (!query) {
        loadImages(currentFolderId);
        return;
    }
    
    try {
        showLoading(true);
        const response = await fetch(`/api/gallery-manager/search?query=${encodeURIComponent(query)}`, {
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Search failed');
        
        const data = await response.json();
        renderImages(data.images || []);
    } catch (error) {
        console.error('Error searching:', error);
        showNotification('Search failed', 'error');
    } finally {
        showLoading(false);
    }
}

// Create folder
function showCreateFolderModal() {
    updateFolderSelects();
    document.getElementById('create-folder-modal').classList.add('show');
}

function hideCreateFolderModal() {
    document.getElementById('create-folder-modal').classList.remove('show');
    document.getElementById('new-folder-name').value = '';
}

async function createFolder(e) {
    e.preventDefault();
    
    const name = document.getElementById('new-folder-name').value.trim();
    const parent = document.getElementById('parent-folder-select').value;
    
    if (!name) return;
    
    try {
        showLoading(true);
        const response = await fetch('/api/gallery-manager/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name, parent })
        });
        
        if (!response.ok) throw new Error('Failed to create folder');
        
        showNotification('Folder created successfully', 'success');
        hideCreateFolderModal();
        await loadFolders();
    } catch (error) {
        console.error('Error creating folder:', error);
        showNotification('Failed to create folder', 'error');
    } finally {
        showLoading(false);
    }
}

// Rename folder
async function renameFolderPrompt(folderId) {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;
    
    const newName = prompt('Enter new folder name:', folder.name);
    if (!newName || newName === folder.name) return;
    
    try {
        showLoading(true);
        const response = await fetch(`/api/gallery-manager/folders/${folderId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name: newName })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to rename folder');
        }
        
        showNotification('Folder renamed successfully', 'success');
        await loadFolders();
    } catch (error) {
        console.error('Error renaming folder:', error);
        showNotification(error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Delete folder
async function deleteFolderPrompt(folderId) {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;
    
    if (!confirm(`Are you sure you want to delete the folder "${folder.name}"?\n\nThe folder must be empty (no images or subfolders).`)) {
        return;
    }
    
    try {
        showLoading(true);
        const response = await fetch(`/api/gallery-manager/folders/${folderId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete folder');
        }
        
        showNotification('Folder deleted successfully', 'success');
        
        // If current folder was deleted, go to root
        if (currentFolderId === folderId) {
            currentFolderId = 'root';
        }
        
        await loadFolders();
    } catch (error) {
        console.error('Error deleting folder:', error);
        showNotification(error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Upload images
function showUploadModal() {
    updateFolderSelects();
    document.getElementById('upload-folder-select').value = currentFolderId;
    document.getElementById('upload-modal').classList.add('show');
}

function hideUploadModal() {
    document.getElementById('upload-modal').classList.remove('show');
    document.getElementById('file-input').value = '';
    document.getElementById('file-list').innerHTML = '';
}

function handleFiles(files) {
    const fileList = document.getElementById('file-list');
    fileList.innerHTML = '';
    
    if (files.length === 0) return;
    
    Array.from(files).forEach(file => {
        const item = document.createElement('div');
        item.style.padding = '8px';
        item.style.background = 'var(--bg-hover)';
        item.style.margin = '4px 0';
        item.style.borderRadius = '4px';
        item.innerHTML = `
            <i class="fas fa-image"></i> ${file.name} (${formatFileSize(file.size)})
        `;
        fileList.appendChild(item);
    });
}

async function uploadImages(e) {
    e.preventDefault();
    
    const fileInput = document.getElementById('file-input');
    const folderId = document.getElementById('upload-folder-select').value;
    
    if (fileInput.files.length === 0) {
        showNotification('Please select files to upload', 'error');
        return;
    }
    
    try {
        showLoading(true);
        
        // Get folder path
        let folderPath = '';
        if (folderId !== 'root') {
            const folder = folders.find(f => f.id === folderId);
            if (folder) folderPath = folder.path;
        }
        
        // Upload each file
        const uploadPromises = Array.from(fileInput.files).map(async (file) => {
            const formData = new FormData();
            formData.append('image', file);
            if (folderPath) formData.append('folder', folderPath);
            
            const response = await fetch('/api/admin/upload-image', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });
            
            if (!response.ok) throw new Error(`Failed to upload ${file.name}`);
            return response.json();
        });
        
        await Promise.all(uploadPromises);
        
        showNotification(`${fileInput.files.length} image(s) uploaded successfully`, 'success');
        hideUploadModal();
        
        // Reload if uploading to current folder
        if (folderId === currentFolderId) {
            await loadImages(currentFolderId);
        }
    } catch (error) {
        console.error('Error uploading images:', error);
        showNotification('Failed to upload images', 'error');
    } finally {
        showLoading(false);
    }
}

// Move images
function showMoveModal() {
    if (selectedImages.size === 0) return;
    
    updateFolderSelects();
    document.getElementById('move-count').textContent = selectedImages.size;
    document.getElementById('move-modal').classList.add('show');
}

function hideMoveModal() {
    document.getElementById('move-modal').classList.remove('show');
}

async function moveImages(e) {
    e.preventDefault();
    
    const targetFolderId = document.getElementById('move-folder-select').value;
    const imagePaths = Array.from(selectedImages);
    
    await moveImagesToFolder(imagePaths, targetFolderId);
    hideMoveModal();
}

async function moveImagesToFolder(imagePaths, targetFolderId) {
    try {
        showLoading(true);
        const response = await fetch('/api/gallery-manager/images/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                images: imagePaths,
                targetFolderId
            })
        });
        
        if (!response.ok) throw new Error('Failed to move images');
        
        const result = await response.json();
        showNotification(`${result.moved.length} image(s) moved successfully`, 'success');
        
        deselectAll();
        await loadImages(currentFolderId);
    } catch (error) {
        console.error('Error moving images:', error);
        showNotification('Failed to move images', 'error');
    } finally {
        showLoading(false);
    }
}

// Delete images
async function deleteSelected() {
    if (selectedImages.size === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedImages.size} image(s)?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    await deleteImages(Array.from(selectedImages));
}

async function deleteImage(path) {
    if (!confirm('Are you sure you want to delete this image?\n\nThis action cannot be undone.')) {
        return;
    }
    
    await deleteImages([path]);
}

async function deleteImages(imagePaths) {
    try {
        showLoading(true);
        const response = await fetch('/api/gallery-manager/images/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ images: imagePaths })
        });
        
        if (!response.ok) throw new Error('Failed to delete images');
        
        const result = await response.json();
        showNotification(`${result.deleted.length} image(s) deleted successfully`, 'success');
        
        deselectAll();
        await loadImages(currentFolderId);
    } catch (error) {
        console.error('Error deleting images:', error);
        showNotification('Failed to delete images', 'error');
    } finally {
        showLoading(false);
    }
}

// Context menu
function showContextMenu(x, y, image) {
    const menu = document.getElementById('context-menu');
    menu.innerHTML = `
        <div class="context-menu-item" onclick="copyImagePath('${image.path}')">
            <i class="fas fa-copy"></i> Copy Path
        </div>
        <div class="context-menu-item" onclick="window.open('${image.path}', '_blank')">
            <i class="fas fa-external-link-alt"></i> Open in New Tab
        </div>
        <div class="context-menu-item" onclick="toggleImageSelection('${image.path}'); hideContextMenu();">
            <i class="fas fa-check-square"></i> ${selectedImages.has(image.path) ? 'Deselect' : 'Select'}
        </div>
        <div class="context-menu-item danger" onclick="deleteImage('${image.path}'); hideContextMenu();">
            <i class="fas fa-trash"></i> Delete
        </div>
    `;
    
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.classList.add('show');
}

function hideContextMenu() {
    document.getElementById('context-menu').classList.remove('show');
}

// Update folder selects
function updateFolderSelects() {
    const selects = [
        document.getElementById('parent-folder-select'),
        document.getElementById('upload-folder-select'),
        document.getElementById('move-folder-select')
    ];
    
    selects.forEach(select => {
        if (!select) return;
        
        select.innerHTML = '';
        
        const addOption = (folder, level = 0) => {
            const option = document.createElement('option');
            option.value = folder.id;
            option.textContent = '  '.repeat(level) + folder.name;
            select.appendChild(option);
            
            // Add children
            const children = folders.filter(f => f.parent === folder.id);
            children.forEach(child => addOption(child, level + 1));
        };
        
        const root = folders.find(f => f.id === 'root');
        if (root) addOption(root);
    });
}

// Copy image path
function copyImagePath(path) {
    navigator.clipboard.writeText(path).then(() => {
        showNotification('Path copied to clipboard', 'success');
    }).catch(() => {
        showNotification('Failed to copy path', 'error');
    });
}

// Show image preview modal
function showImageModal(image) {
    const modal = document.getElementById('image-preview-modal');
    const img = document.getElementById('preview-image');
    const name = document.getElementById('preview-image-name');
    const meta = document.getElementById('preview-image-meta');
    
    img.src = image.path;
    img.alt = image.name;
    name.textContent = image.name;
    meta.textContent = `${formatFileSize(image.size)} • ${formatDate(image.created)}`;
    
    modal.style.display = 'flex';
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    
    // Close on Escape key
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            hideImageModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
}

function hideImageModal() {
    const modal = document.getElementById('image-preview-modal');
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

// Utility functions
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString();
}

function showLoading(show) {
    document.getElementById('loading-spinner').classList.toggle('show', show);
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 3000;
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

