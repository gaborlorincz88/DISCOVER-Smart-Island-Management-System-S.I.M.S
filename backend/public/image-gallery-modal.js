// Image Gallery Modal - Allows admins to browse and select existing images or upload new ones

class ImageGalleryModal {
    constructor() {
        this.isOpen = false;
        this.images = [];
        this.folders = [];
        this.currentFolder = '';
        this.selectedCallback = null;
        this.currentSearch = '';
        this.currentOffset = 0;
        this.limit = 50;
        this.total = 0;
        this.multiSelect = false;
        this.selectedImages = [];
        this.uploadConfig = null; // Store upload configuration
        this.createModal();
        this.createUploadConfigModal();
    }

    createModal() {
        // Create modal overlay
        this.modal = document.createElement('div');
        this.modal.id = 'image-gallery-modal';
        this.modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            z-index: 10000;
            display: none;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease;
        `;

        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 16px;
            width: 90%;
            max-width: 1000px;
            max-height: 85vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 25px 80px rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.2);
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 20px 24px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-radius: 16px 16px 0 0;
        `;
        
        const title = document.createElement('h2');
        title.style.cssText = `
            margin: 0;
            font-size: 20px;
            font-weight: 700;
            color: white;
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        title.innerHTML = '<i class="fas fa-images"></i> Image Gallery';
        
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText = `
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
        `;
        closeBtn.onmouseover = () => closeBtn.style.background = 'rgba(255, 255, 255, 0.3)';
        closeBtn.onmouseout = () => closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        closeBtn.onclick = () => this.close();
        
        header.appendChild(title);
        header.appendChild(closeBtn);

        // Breadcrumb navigation
        this.breadcrumb = document.createElement('div');
        this.breadcrumb.style.cssText = `
            padding: 12px 24px;
            background: rgba(255, 255, 255, 0.05);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            color: white;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        
        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.style.cssText = `
            padding: 16px 24px;
            display: flex;
            gap: 12px;
            background: rgba(255, 255, 255, 0.05);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        `;

        // Search input
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = '🔍 Search images...';
        searchInput.style.cssText = `
            flex: 1;
            padding: 10px 16px;
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.15);
            color: white;
            font-size: 14px;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
        `;
        searchInput.oninput = (e) => {
            this.currentSearch = e.target.value;
            this.currentOffset = 0;
            this.loadImages();
        };

        // Upload new button
        const uploadBtn = document.createElement('button');
        uploadBtn.innerHTML = '<i class="fas fa-upload"></i> Upload New';
        uploadBtn.style.cssText = `
            padding: 10px 20px;
            background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
            border: none;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s ease;
        `;
        uploadBtn.onmouseover = () => uploadBtn.style.transform = 'translateY(-2px)';
        uploadBtn.onmouseout = () => uploadBtn.style.transform = 'translateY(0)';
        uploadBtn.onclick = () => this.triggerUpload();
        
        // Manage Gallery button
        const manageBtn = document.createElement('button');
        manageBtn.innerHTML = '<i class="fas fa-folder-tree"></i> Manage Gallery';
        manageBtn.style.cssText = `
            padding: 10px 20px;
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            border: none;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s ease;
        `;
        manageBtn.onmouseover = () => manageBtn.style.transform = 'translateY(-2px)';
        manageBtn.onmouseout = () => manageBtn.style.transform = 'translateY(0)';
        manageBtn.onclick = () => {
            window.open('/gallery-manager.html', '_blank');
        };

        toolbar.appendChild(searchInput);
        toolbar.appendChild(uploadBtn);
        toolbar.appendChild(manageBtn);

        // Gallery container
        const galleryContainer = document.createElement('div');
        galleryContainer.id = 'gallery-container';
        galleryContainer.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 24px;
        `;

        // Images grid
        this.imagesGrid = document.createElement('div');
        this.imagesGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 16px;
        `;

        galleryContainer.appendChild(this.imagesGrid);

        // Loading indicator
        this.loadingIndicator = document.createElement('div');
        this.loadingIndicator.style.cssText = `
            text-align: center;
            padding: 40px;
            color: white;
            font-size: 16px;
            display: none;
        `;
        this.loadingIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading images...';
        galleryContainer.appendChild(this.loadingIndicator);

        // Load more button
        this.loadMoreBtn = document.createElement('button');
        this.loadMoreBtn.innerHTML = 'Load More';
        this.loadMoreBtn.style.cssText = `
            margin: 20px auto;
            padding: 12px 24px;
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 8px;
            color: white;
            font-weight: 600;
            cursor: pointer;
            display: none;
        `;
        this.loadMoreBtn.onclick = () => {
            this.currentOffset += this.limit;
            this.loadImages(true);
        };
        galleryContainer.appendChild(this.loadMoreBtn);

        // Assemble modal
        modalContent.appendChild(header);
        modalContent.appendChild(this.breadcrumb);
        modalContent.appendChild(toolbar);
        modalContent.appendChild(galleryContainer);
        
        this.modal.appendChild(modalContent);
        document.body.appendChild(this.modal);

        // Close on overlay click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });
    }

    async open(callback, multiSelect = false) {
        console.log('Opening gallery modal with callback:', callback);
        console.log('Multi-select mode:', multiSelect);
        this.selectedCallback = callback;
        this.multiSelect = multiSelect;
        this.selectedImages = [];
        this.currentOffset = 0;
        this.modal.style.display = 'flex';
        this.isOpen = true;
        await this.loadImages();
    }

    close() {
        this.modal.style.display = 'none';
        this.isOpen = false;
        this.selectedCallback = null;
        this.multiSelect = false;
        this.selectedImages = [];
    }

    async loadImages(append = false) {
        try {
            if (!append) {
                this.loadingIndicator.style.display = 'block';
                this.imagesGrid.innerHTML = '';
            }

            const url = `/api/image-gallery/list?limit=${this.limit}&offset=${this.currentOffset}&search=${encodeURIComponent(this.currentSearch)}&folder=${encodeURIComponent(this.currentFolder)}`;
            const response = await fetch(url, { credentials: 'include' });

            if (!response.ok) {
                throw new Error('Failed to load images');
            }

            const data = await response.json();
            this.images = append ? [...this.images, ...data.images] : data.images;
            this.folders = data.folders || [];
            this.total = data.total;

            this.loadingIndicator.style.display = 'none';

            // Update breadcrumb
            this.updateBreadcrumb();

            // Render folders and images
            this.renderImages(append);

            // Show/hide load more button
            this.loadMoreBtn.style.display = data.hasMore ? 'block' : 'none';

        } catch (error) {
            console.error('Error loading images:', error);
            this.loadingIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Failed to load images';
            this.loadMoreBtn.style.display = 'none';
        }
    }

    updateBreadcrumb() {
        this.breadcrumb.innerHTML = '';
        
        // Home icon
        const homeLink = document.createElement('span');
        homeLink.innerHTML = '<i class="fas fa-home"></i> Gallery';
        homeLink.style.cssText = 'cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: background 0.2s;';
        homeLink.onmouseover = () => homeLink.style.background = 'rgba(255, 255, 255, 0.1)';
        homeLink.onmouseout = () => homeLink.style.background = 'transparent';
        homeLink.onclick = () => {
            this.currentFolder = '';
            this.currentOffset = 0;
            this.loadImages();
        };
        this.breadcrumb.appendChild(homeLink);
        
        // Current folder path
        if (this.currentFolder) {
            const parts = this.currentFolder.split('/');
            let accumulatedPath = '';
            
            parts.forEach((part, index) => {
                accumulatedPath += (accumulatedPath ? '/' : '') + part;
                const folderPath = accumulatedPath;
                
                const separator = document.createElement('span');
                separator.textContent = ' / ';
                separator.style.color = 'rgba(255, 255, 255, 0.5)';
                this.breadcrumb.appendChild(separator);
                
                const folderLink = document.createElement('span');
                folderLink.textContent = part;
                folderLink.style.cssText = 'cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: background 0.2s;';
                folderLink.onmouseover = () => folderLink.style.background = 'rgba(255, 255, 255, 0.1)';
                folderLink.onmouseout = () => folderLink.style.background = 'transparent';
                
                if (index < parts.length - 1) {
                    // Not the last part, make it clickable
                    folderLink.onclick = () => {
                        this.currentFolder = folderPath;
                        this.currentOffset = 0;
                        this.loadImages();
                    };
                } else {
                    // Last part, highlight it
                    folderLink.style.fontWeight = 'bold';
                }
                
                this.breadcrumb.appendChild(folderLink);
            });
        }
    }

    renderImages(append = false) {
        if (!append) {
            this.imagesGrid.innerHTML = '';
        }

        // Render folders first
        if (!append && this.folders.length > 0) {
            this.folders.forEach((folder) => {
                const folderCard = this.createFolderCard(folder);
                this.imagesGrid.appendChild(folderCard);
            });
        }

        // Then render images
        const imagesToRender = append ? this.images.slice(this.currentOffset) : this.images;

        if (this.folders.length === 0 && this.images.length === 0) {
            this.imagesGrid.innerHTML = '<div style="text-align: center; color: rgba(255, 255, 255, 0.7); padding: 40px; grid-column: 1 / -1;">No images found. Upload your first image!</div>';
            return;
        }

        imagesToRender.forEach((image) => {
            const imageCard = this.createImageCard(image);
            this.imagesGrid.appendChild(imageCard);
        });
    }

    createFolderCard(folder) {
        const card = document.createElement('div');
        card.style.cssText = `
            background: rgba(255, 255, 255, 0.15);
            border: 2px solid rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            overflow: hidden;
            cursor: pointer;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
            min-height: 150px;
        `;
        card.onmouseover = () => {
            card.style.transform = 'translateY(-4px)';
            card.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.3)';
            card.style.borderColor = 'rgba(255, 255, 255, 0.4)';
        };
        card.onmouseout = () => {
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = 'none';
            card.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        };

        // Folder icon
        const icon = document.createElement('div');
        icon.innerHTML = '<i class="fas fa-folder"></i>';
        icon.style.cssText = `
            font-size: 48px;
            color: rgba(255, 193, 7, 0.9);
            margin-bottom: 12px;
        `;

        // Folder name
        const name = document.createElement('div');
        name.textContent = folder.name;
        name.style.cssText = `
            color: white;
            font-size: 14px;
            font-weight: 600;
            text-align: center;
            margin-bottom: 4px;
        `;

        // Image count
        const count = document.createElement('div');
        count.textContent = `${folder.imageCount} image${folder.imageCount !== 1 ? 's' : ''}`;
        count.style.cssText = `
            color: rgba(255, 255, 255, 0.7);
            font-size: 12px;
        `;

        card.appendChild(icon);
        card.appendChild(name);
        card.appendChild(count);

        // Click to open folder
        card.onclick = () => {
            this.currentFolder = folder.path;
            this.currentOffset = 0;
            this.loadImages();
        };

        return card;
    }

    createImageCard(image) {
        const card = document.createElement('div');
        card.style.cssText = `
            background: rgba(255, 255, 255, 0.15);
            border: 2px solid rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            overflow: hidden;
            cursor: pointer;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            position: relative;
        `;
        card.onmouseover = () => {
            card.style.transform = 'translateY(-4px)';
            card.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.3)';
            card.style.borderColor = 'rgba(255, 255, 255, 0.4)';
        };
        card.onmouseout = () => {
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = 'none';
            card.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        };

        // Image preview
        const img = document.createElement('img');
        img.src = image.path;
        img.alt = image.filename;
        img.style.cssText = `
            width: 100%;
            height: 150px;
            object-fit: cover;
        `;
        img.onerror = () => {
            img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><rect fill="%23ddd"/><text x="50%" y="50%" text-anchor="middle" fill="%23999">No preview</text></svg>';
        };

        // Info section
        const info = document.createElement('div');
        info.style.cssText = `
            padding: 12px;
            background: rgba(0, 0, 0, 0.2);
        `;

        const filename = document.createElement('div');
        filename.textContent = image.filename.length > 25 ? image.filename.substring(0, 22) + '...' : image.filename;
        filename.title = image.filename;
        filename.style.cssText = `
            color: white;
            font-size: 12px;
            font-weight: 500;
            margin-bottom: 4px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        `;

        const meta = document.createElement('div');
        meta.textContent = image.sizeFormatted;
        meta.style.cssText = `
            color: rgba(255, 255, 255, 0.7);
            font-size: 11px;
        `;

        info.appendChild(filename);
        info.appendChild(meta);

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.title = 'Delete image';
        deleteBtn.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            width: 32px;
            height: 32px;
            background: rgba(239, 68, 68, 0.9);
            border: none;
            border-radius: 50%;
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: all 0.3s ease;
            font-size: 14px;
        `;
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            this.deleteImage(image);
        };

        card.onmouseover = () => {
            deleteBtn.style.opacity = '1';
            card.style.transform = 'translateY(-4px)';
            card.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.3)';
            card.style.borderColor = 'rgba(255, 255, 255, 0.4)';
        };
        card.onmouseout = () => {
            deleteBtn.style.opacity = '0';
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = 'none';
            card.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        };

        // Click to select
        card.onclick = () => this.selectImage(image);

        card.appendChild(img);
        card.appendChild(info);
        card.appendChild(deleteBtn);

        return card;
    }

    selectImage(image) {
        console.log('Selected image:', image);
        console.log('Multi-select mode:', this.multiSelect);
        console.log('Selected callback:', this.selectedCallback);
        
        if (this.multiSelect) {
            // For multi-select, toggle selection
            const index = this.selectedImages.findIndex(img => img.filename === image.filename);
            if (index > -1) {
                this.selectedImages.splice(index, 1);
                console.log('Removed from selection:', image.filename);
            } else {
                this.selectedImages.push(image);
                console.log('Added to selection:', image.filename);
                console.log('Total selected:', this.selectedImages.length);
            }
            // Update UI to show selection
            this.renderImages();
            // Also call the callback for each click so callers that expect immediate
            // per-click behavior receive the selection (helps the place editor flow)
            if (this.selectedCallback) {
                try {
                    console.log('Multi-select mode: calling selectedCallback for image:', image.filename);
                    this.selectedCallback(image);
                } catch (err) {
                    console.error('Error calling selectedCallback in multi-select mode:', err);
                }
            }
        } else {
            // For single select, close immediately
            console.log('Single select mode - calling callback and closing');
            if (this.selectedCallback) {
                this.selectedCallback(image);
            } else {
                console.error('No callback set for single select!');
            }
            this.close();
        }
    }

    async deleteImage(image) {
        if (!confirm(`Delete "${image.filename}"?\n\nThis action cannot be undone. The image will be permanently removed from the server.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/image-gallery/${encodeURIComponent(image.filename)}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete image');
            }

            const data = await response.json();
            
            // Remove from UI
            this.images = this.images.filter(img => img.filename !== image.filename);
            this.total--;
            
            // Reload images to refresh the grid
            await this.loadImages();
            
            // Show success notification
            if (window.showNotification) {
                showNotification(`✅ Deleted: ${image.filename}`, 'success');
            } else {
                alert(`✅ Image deleted: ${image.filename}`);
            }

        } catch (error) {
            console.error('Error deleting image:', error);
            if (window.showNotification) {
                showNotification(`Failed to delete image: ${error.message}`, 'error');
            } else {
                alert(`Failed to delete image: ${error.message}`);
            }
        }
    }

    triggerUpload() {
        // Close gallery and trigger the original file input
        this.close();
        
        // Dispatch custom event that the page can listen to
        window.dispatchEvent(new CustomEvent('galleryUploadNew'));
    }

    createUploadConfigModal() {
        // Create upload config modal overlay
        this.configModal = document.createElement('div');
        this.configModal.id = 'upload-config-modal';
        this.configModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            z-index: 10001;
            display: none;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease;
        `;

        const configContent = document.createElement('div');
        configContent.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 16px;
            width: 90%;
            max-width: 600px;
            padding: 30px;
            box-shadow: 0 25px 80px rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.2);
        `;

        configContent.innerHTML = `
            <h2 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 700; color: white; display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-cog"></i> Upload Configuration
            </h2>
            
            <div style="display: flex; flex-direction: column; gap: 20px;">
                <!-- Destination Folder -->
                <div>
                    <label style="display: block; color: white; font-weight: 600; margin-bottom: 8px;">
                        📁 Destination Folder
                    </label>
                    <select id="upload-destination" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.3); background: rgba(255, 255, 255, 0.15); color: white; font-size: 14px; backdrop-filter: blur(10px);">
                        <option value="">uploads/optimized (root)</option>
                        <option value="Icons">uploads/optimized/Icons</option>
                        <option value="Images">uploads/optimized/Images</option>
                        <option value="tours">uploads/optimized/tours</option>
                        <option value="places">uploads/optimized/places</option>
                        <option value="events">uploads/optimized/events</option>
                        <option value="merchants">uploads/optimized/merchants</option>
                        <option value="custom">📝 Enter custom folder...</option>
                    </select>
                    <input type="text" id="custom-folder" placeholder="e.g., beaches/summer-2025" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.3); background: rgba(255, 255, 255, 0.15); color: white; font-size: 14px; margin-top: 8px; display: none; backdrop-filter: blur(10px);">
                    <small style="display: block; margin-top: 4px; color: rgba(255, 255, 255, 0.7); font-size: 12px;">Choose where to save the optimized images</small>
                </div>

                <!-- Custom Filename -->
                <div>
                    <label style="display: block; color: white; font-weight: 600; margin-bottom: 8px;">
                        ✏️ Custom Filename (optional)
                    </label>
                    <input type="text" id="custom-filename" placeholder="Leave empty to use original filename" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.3); background: rgba(255, 255, 255, 0.15); color: white; font-size: 14px; backdrop-filter: blur(10px);">
                    <small style="display: block; margin-top: 4px; color: rgba(255, 255, 255, 0.7); font-size: 12px;">A random suffix will be added automatically</small>
                </div>

                <!-- Size Variants -->
                <div>
                    <label style="display: block; color: white; font-weight: 600; margin-bottom: 8px;">
                        📐 Image Sizes to Generate
                    </label>
                    <div style="display: flex; flex-wrap: wrap; gap: 12px;">
                        <label style="display: flex; align-items: center; gap: 8px; color: white; cursor: pointer; padding: 8px 12px; background: rgba(255, 255, 255, 0.1); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.2);">
                            <input type="checkbox" id="size-optimized" checked style="cursor: pointer;">
                            <span>Main (Optimized)</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; color: white; cursor: pointer; padding: 8px 12px; background: rgba(255, 255, 255, 0.1); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.2);">
                            <input type="checkbox" id="size-200" checked style="cursor: pointer;">
                            <span>200x200 (Thumbnail)</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; color: white; cursor: pointer; padding: 8px 12px; background: rgba(255, 255, 255, 0.1); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.2);">
                            <input type="checkbox" id="size-400" checked style="cursor: pointer;">
                            <span>400x400 (Small)</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; color: white; cursor: pointer; padding: 8px 12px; background: rgba(255, 255, 255, 0.1); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.2);">
                            <input type="checkbox" id="size-800" checked style="cursor: pointer;">
                            <span>800x800 (Medium)</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; color: white; cursor: pointer; padding: 8px 12px; background: rgba(255, 255, 255, 0.1); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.2);">
                            <input type="checkbox" id="size-1200" checked style="cursor: pointer;">
                            <span>1200x1200 (Large)</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; color: white; cursor: pointer; padding: 8px 12px; background: rgba(255, 255, 255, 0.1); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.2);">
                            <input type="checkbox" id="size-1920" checked style="cursor: pointer;">
                            <span>1920x1920 (Full HD)</span>
                        </label>
                    </div>
                    <small style="display: block; margin-top: 8px; color: rgba(255, 255, 255, 0.7); font-size: 12px;">Select which size variants to generate</small>
                </div>

                <!-- Action Buttons -->
                <div style="display: flex; gap: 12px; margin-top: 16px;">
                    <button id="upload-config-cancel" style="flex: 1; padding: 12px; background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 8px; color: white; font-weight: 600; cursor: pointer; transition: all 0.3s ease;">
                        Cancel
                    </button>
                    <button id="upload-config-confirm" style="flex: 1; padding: 12px; background: rgba(255, 255, 255, 0.3); border: 1px solid rgba(255, 255, 255, 0.4); border-radius: 8px; color: white; font-weight: 600; cursor: pointer; transition: all 0.3s ease;">
                        Proceed to Upload
                    </button>
                </div>
            </div>
        `;

        this.configModal.appendChild(configContent);
        document.body.appendChild(this.configModal);

        // Event listeners
        const destinationSelect = document.getElementById('upload-destination');
        const customFolderInput = document.getElementById('custom-folder');
        
        destinationSelect.addEventListener('change', () => {
            if (destinationSelect.value === 'custom') {
                customFolderInput.style.display = 'block';
                customFolderInput.focus();
            } else {
                customFolderInput.style.display = 'none';
            }
        });

        document.getElementById('upload-config-cancel').onclick = () => {
            this.closeUploadConfig();
        };

        document.getElementById('upload-config-confirm').onclick = () => {
            this.confirmUploadConfig();
        };
    }

    openUploadConfig(callback) {
        this.uploadConfigCallback = callback;
        this.configModal.style.display = 'flex';
    }

    closeUploadConfig() {
        this.configModal.style.display = 'none';
        // Reset form
        document.getElementById('upload-destination').value = '';
        document.getElementById('custom-folder').value = '';
        document.getElementById('custom-folder').style.display = 'none';
        document.getElementById('custom-filename').value = '';
    }

    confirmUploadConfig() {
        const destination = document.getElementById('upload-destination').value;
        const customFolder = document.getElementById('custom-folder').value;
        const customFilename = document.getElementById('custom-filename').value;

        // Get selected sizes
        const sizes = {
            optimized: document.getElementById('size-optimized').checked,
            size200: document.getElementById('size-200').checked,
            size400: document.getElementById('size-400').checked,
            size800: document.getElementById('size-800').checked,
            size1200: document.getElementById('size-1200').checked,
            size1920: document.getElementById('size-1920').checked
        };

        // Build final folder path
        let finalFolder = '';
        if (destination === 'custom') {
            finalFolder = customFolder.trim();
        } else if (destination) {
            finalFolder = destination;
        }

        const config = {
            folder: finalFolder,
            customFilename: customFilename.trim(),
            sizes: sizes
        };

        this.closeUploadConfig();
        
        if (this.uploadConfigCallback) {
            this.uploadConfigCallback(config);
        }
    }
}

// Global instance
window.imageGalleryModal = new ImageGalleryModal();

// Helper function to enhance image upload inputs with gallery
function enhanceImageInputWithGallery(inputElement, previewElement = null, multiSelect = false) {
    // Diagnostic: log call parameters to help debug when multiSelect mode is unexpected
    try {
        console.log('enhanceImageInputWithGallery called for:', inputElement?.id, 'multiSelect param:', multiSelect, 'input.multiple:', !!(inputElement && inputElement.multiple));
    } catch (err) {
        console.warn('Failed to log enhanceImageInputWithGallery params', err);
    }

    // Record a short stack to help identify the caller
    try {
        const stack = (new Error()).stack || '';
        const shortStack = stack.split('\n').slice(1,4).map(s => s.trim()).join(' | ');
        if (inputElement) {
            inputElement.dataset._galleryEnhancerStack = shortStack;
            inputElement.dataset._galleryEnhancerParam = String(multiSelect);
            inputElement.dataset._galleryInputMultiple = String(!!(inputElement && inputElement.multiple));
        }
        console.log('enhanceImageInputWithGallery stack:', shortStack);
    } catch (err) {
        /* ignore */
    }
    // Create a "Select/Upload Image" button
    const selectBtn = document.createElement('button');
    selectBtn.type = 'button';
    selectBtn.innerHTML = multiSelect ? '<i class="fas fa-images"></i> Select Images from Gallery' : '<i class="fas fa-images"></i> Select or Upload Image';
    selectBtn.style.cssText = `
        padding: 12px 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        color: white;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: all 0.3s ease;
        margin-bottom: 8px;
    `;
    selectBtn.onmouseover = () => {
        selectBtn.style.transform = 'translateY(-2px)';
        selectBtn.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.4)';
    };
    selectBtn.onmouseout = () => {
        selectBtn.style.transform = 'translateY(0)';
        selectBtn.style.boxShadow = 'none';
    };

    selectBtn.onclick = () => {
        // Determine effective multi-select mode.
        // If caller explicitly provided a boolean for multiSelect, respect it.
        // Otherwise fall back to the input element's `multiple` attribute.
        let effectiveMultiSelect = (typeof multiSelect === 'boolean') ? multiSelect : !!(inputElement && inputElement.multiple);
        // Honor a per-input override to force single-select behavior when integrating with forms
        // (useful when input.multiple is true but the caller wants single-click selection like the icon workflow)
        try {
            if (inputElement && inputElement.dataset && inputElement.dataset.forceGallerySingle === 'true') {
                console.log('Overriding multi-select for input', inputElement.id, '-> forcing single-select due to data-force-gallery-single');
                effectiveMultiSelect = false;
            }
        } catch (err) {
            /* ignore */
        }

        console.log('Gallery button clicked for input:', inputElement.id);
        console.log('Multi-select mode:', effectiveMultiSelect);
        // Open gallery with callback
        window.imageGalleryModal.open((selectedImage) => {
            console.log('Image selected from gallery:', selectedImage);
            
            // Set the preview if preview element exists
            if (previewElement) {
                // Get API base URL for image preview
                const getApiBaseUrl = () => {
                    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                        return window.location.origin;
                    }
                    return 'http://localhost:3003';
                };
                const apiBaseUrl = getApiBaseUrl();
                
                // If path is already a full URL, use it; otherwise prepend apiBaseUrl
                const imageUrl = selectedImage.path.startsWith('http') 
                    ? selectedImage.path 
                    : `${apiBaseUrl}${selectedImage.path}`;
                previewElement.src = imageUrl;
                if (previewElement.parentElement) {
                    previewElement.parentElement.style.display = 'block';
                }
            }
            
            // Store the selected image path in a hidden input or data attribute
            inputElement.dataset.selectedImagePath = selectedImage.path;
            
            // Dispatch event for the page to handle
            inputElement.dispatchEvent(new CustomEvent('imageSelectedFromGallery', {
                detail: selectedImage
            }));

            // Fallback: update global arrays and DOM directly so selection works even when
            // other scripts haven't attached listeners or DOM nodes were replaced.
            try {
                // If this is the main place images input
                if (inputElement.id === 'images') {
                    // Ensure a global ref exists
                    window.existingImages = window.existingImages || [];
                    if (!window.existingImages.includes(selectedImage.path)) {
                        window.existingImages.push(selectedImage.path);
                        console.log('Fallback: pushed to window.existingImages:', selectedImage.path);
                    }
                    // Also maintain dataset.selectedImages for form submit compatibility
                    const prev = inputElement.dataset.selectedImages ? JSON.parse(inputElement.dataset.selectedImages) : [];
                    if (!prev.includes(selectedImage.path)) {
                        prev.push(selectedImage.path);
                        inputElement.dataset.selectedImages = JSON.stringify(prev);
                    }
                    // Try to call renderImagePreviews if available
                    if (typeof renderImagePreviews === 'function') {
                        try { renderImagePreviews(); } catch (err) { /* ignore */ }
                    }
                }

                // If this is the event images input
                if (inputElement.id === 'event-images') {
                    window.existingEventImages = window.existingEventImages || [];
                    if (!window.existingEventImages.includes(selectedImage.path)) {
                        window.existingEventImages.push(selectedImage.path);
                        console.log('Fallback: pushed to window.existingEventImages:', selectedImage.path);
                    }
                    inputElement.dataset.selectedImagePath = selectedImage.path;
                    if (typeof renderEventImagePreviews === 'function') {
                        try { renderEventImagePreviews(); } catch (err) { /* ignore */ }
                    }
                }
                // Always update (or create) a hidden input on the form so selections are
                // included in traditional form submissions and easier to inspect.
                try {
                    const form = inputElement.closest && inputElement.closest('form');
                    if (form) {
                        // For place images
                        if (inputElement.id === 'images') {
                            // existingImages hidden field (some submitters read this)
                            let existingField = form.querySelector('#existing-images-hidden');
                            if (!existingField) {
                                existingField = document.createElement('input');
                                existingField.type = 'hidden';
                                existingField.id = 'existing-images-hidden';
                                existingField.name = 'existingImages';
                                form.appendChild(existingField);
                            }
                            existingField.value = JSON.stringify(window.existingImages || []);

                            // gallerySelectedImages compatibility field
                            let galleryField = form.querySelector('#gallery-selected-images');
                            if (!galleryField) {
                                galleryField = document.createElement('input');
                                galleryField.type = 'hidden';
                                galleryField.id = 'gallery-selected-images';
                                galleryField.name = 'gallerySelectedImages';
                                form.appendChild(galleryField);
                            }
                            galleryField.value = JSON.stringify(window.existingImages || []);
                        }

                        // For event images
                        if (inputElement.id === 'event-images') {
                            let existingField = form.querySelector('#existing-event-images-hidden');
                            if (!existingField) {
                                existingField = document.createElement('input');
                                existingField.type = 'hidden';
                                existingField.id = 'existing-event-images-hidden';
                                existingField.name = 'existingEventImages';
                                form.appendChild(existingField);
                            }
                            existingField.value = JSON.stringify(window.existingEventImages || []);

                            let galleryField = form.querySelector('#gallery-selected-event-images');
                            if (!galleryField) {
                                galleryField = document.createElement('input');
                                galleryField.type = 'hidden';
                                galleryField.id = 'gallery-selected-event-images';
                                galleryField.name = 'gallerySelectedEventImages';
                                form.appendChild(galleryField);
                            }
                            galleryField.value = JSON.stringify(window.existingEventImages || []);
                        }
                    }
                } catch (err) {
                    console.warn('Failed to update hidden form fields for gallery selection:', err);
                }
            } catch (err) {
                console.warn('Fallback image selection handler failed:', err);
            }
        }, effectiveMultiSelect);
    };

    // Insert button before the file input
    inputElement.parentNode.insertBefore(selectBtn, inputElement);
    
    // Add a divider
    const divider = document.createElement('div');
    divider.style.cssText = 'margin: 8px 0; color: rgba(255, 255, 255, 0.6); font-size: 12px; text-align: center;';
    divider.textContent = '— or browse local files —';
    inputElement.parentNode.insertBefore(divider, inputElement);
}

// Auto-enhance all image inputs on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎨 Image Gallery Modal: Enhancing image inputs...');
    
    // Wait a bit for other scripts to load
    setTimeout(() => {
        // Find icon upload inputs and enhance them
        // Don't declare iconInput here - it may be declared in admin.js
        // Use window.iconInput if available, otherwise get element directly
        const iconInputElement = window.iconInput || document.getElementById('icon');
        const iconPreview = document.getElementById('icon-preview');
        if (iconInputElement) {
            console.log('✅ Enhancing icon input with gallery');
            enhanceImageInputWithGallery(iconInputElement, iconPreview);
        }

        // Find tour main image input
        const tourMainImageInput = document.getElementById('tour-main-image');
        const tourMainImagePreview = document.getElementById('tour-main-image-preview');
        if (tourMainImageInput) {
            console.log('✅ Enhancing tour main image input with gallery');
            enhanceImageInputWithGallery(tourMainImageInput, tourMainImagePreview);
        }

        // Find tour icon input
        const tourIconInput = document.getElementById('tour-icon');
        const tourIconPreview = document.getElementById('tour-icon-preview');
        if (tourIconInput) {
            console.log('✅ Enhancing tour icon input with gallery');
            enhanceImageInputWithGallery(tourIconInput, tourIconPreview);
        }

        // Find stop images input (tour editor) - use single select mode and dispatch for each click
        const stopImagesInput = document.getElementById('stop-images');
        if (stopImagesInput) {
            console.log('✅ Enhancing stop images input with gallery');
            enhanceImageInputWithGallery(stopImagesInput, null, false); // Single select, but don't close modal
        }
    }, 100);
});

// Export for use in other scripts
window.enhanceImageInputWithGallery = enhanceImageInputWithGallery;

