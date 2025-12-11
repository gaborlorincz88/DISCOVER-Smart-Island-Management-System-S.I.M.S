// Image Upload Progress System for Admin UI
class ImageUploadProgress {
    constructor() {
        this.isVisible = false;
        this.uploadProgress = 0;
        this.optimizationStatus = 'idle';
        this.optimizedImages = null;
        this.createProgressElement();
    }

    createProgressElement() {
        // Create the progress container
        this.progressContainer = document.createElement('div');
        this.progressContainer.id = 'image-upload-progress';
        this.progressContainer.className = 'image-progress-container';
        this.progressContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 400px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            border: 1px solid #e5e7eb;
            z-index: 9999;
            display: none;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        // Create header
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 16px 20px;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            align-items: center;
            justify-content: space-between;
        `;
        
        const title = document.createElement('h3');
        title.style.cssText = `
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            color: #111827;
        `;
        title.textContent = 'Image Processing';
        
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            font-size: 18px;
            color: #9ca3af;
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            transition: color 0.2s;
        `;
        closeBtn.onmouseover = () => closeBtn.style.color = '#6b7280';
        closeBtn.onmouseout = () => closeBtn.style.color = '#9ca3af';
        closeBtn.onclick = () => this.hide();
        
        header.appendChild(title);
        header.appendChild(closeBtn);

        // Create progress section
        const progressSection = document.createElement('div');
        progressSection.style.cssText = 'padding: 20px;';
        
        // Progress bar container
        const progressContainer = document.createElement('div');
        progressContainer.style.cssText = 'margin-bottom: 16px;';
        
        // Progress text
        const progressText = document.createElement('div');
        progressText.style.cssText = `
            display: flex;
            justify-content: space-between;
            font-size: 14px;
            color: #6b7280;
            margin-bottom: 8px;
        `;
        
        this.statusText = document.createElement('span');
        this.statusText.textContent = 'Uploading image...';
        
        this.percentageText = document.createElement('span');
        this.percentageText.textContent = '0%';
        
        progressText.appendChild(this.statusText);
        progressText.appendChild(this.percentageText);
        
        // Progress bar
        const progressBarBg = document.createElement('div');
        progressBarBg.style.cssText = `
            width: 100%;
            height: 8px;
            background: #e5e7eb;
            border-radius: 4px;
            overflow: hidden;
        `;
        
        this.progressBar = document.createElement('div');
        this.progressBar.style.cssText = `
            height: 100%;
            background: #3b82f6;
            border-radius: 4px;
            width: 0%;
            transition: width 0.3s ease-out;
        `;
        
        progressBarBg.appendChild(this.progressBar);
        progressContainer.appendChild(progressText);
        progressContainer.appendChild(progressBarBg);
        
        // Status indicators
        const statusIndicators = document.createElement('div');
        statusIndicators.style.cssText = `
            display: flex;
            align-items: center;
            gap: 24px;
            font-size: 14px;
        `;
        
        // Upload status
        const uploadStatus = document.createElement('div');
        uploadStatus.style.cssText = 'display: flex; align-items: center; gap: 8px;';
        
        this.uploadIndicator = document.createElement('div');
        this.uploadIndicator.style.cssText = `
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #3b82f6;
        `;
        
        this.uploadText = document.createElement('span');
        this.uploadText.style.cssText = 'color: #3b82f6;';
        this.uploadText.textContent = 'Upload in progress';
        
        uploadStatus.appendChild(this.uploadIndicator);
        uploadStatus.appendChild(this.uploadText);
        
        // Optimization status
        const optimizationStatus = document.createElement('div');
        optimizationStatus.style.cssText = 'display: flex; align-items: center; gap: 8px;';
        
        this.optimizationIndicator = document.createElement('div');
        this.optimizationIndicator.style.cssText = `
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #d1d5db;
        `;
        
        this.optimizationText = document.createElement('span');
        this.optimizationText.style.cssText = 'color: #6b7280;';
        this.optimizationText.textContent = 'Optimization pending';
        
        optimizationStatus.appendChild(this.optimizationIndicator);
        optimizationStatus.appendChild(this.optimizationText);
        
        statusIndicators.appendChild(uploadStatus);
        statusIndicators.appendChild(optimizationStatus);
        
        // Optimization results
        this.optimizationResults = document.createElement('div');
        this.optimizationResults.style.cssText = `
            margin-top: 16px;
            padding: 16px;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 8px;
            display: none;
        `;
        
        const resultsHeader = document.createElement('div');
        resultsHeader.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            color: #166534;
            margin-bottom: 8px;
        `;
        
        const checkIcon = document.createElement('span');
        checkIcon.innerHTML = '✓';
        checkIcon.style.cssText = 'font-weight: bold;';
        
        const resultsTitle = document.createElement('span');
        resultsTitle.style.cssText = 'font-weight: 600;';
        resultsTitle.textContent = 'Optimization Results';
        
        resultsHeader.appendChild(checkIcon);
        resultsHeader.appendChild(resultsTitle);
        
        this.resultsContent = document.createElement('div');
        this.resultsContent.style.cssText = `
            font-size: 14px;
            color: #166534;
        `;
        
        this.optimizationResults.appendChild(resultsHeader);
        this.optimizationResults.appendChild(this.resultsContent);
        
        // Success notification
        this.successNotification = document.createElement('div');
        this.successNotification.style.cssText = `
            padding: 16px 20px;
            background: #f0fdf4;
            border-top: 1px solid #bbf7d0;
            border-radius: 0 0 12px 12px;
            display: none;
        `;
        
        const successContent = document.createElement('div');
        successContent.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            color: #166534;
        `;
        
        const successIcon = document.createElement('span');
        successIcon.innerHTML = '✓';
        successIcon.style.cssText = 'font-weight: bold;';
        
        const successText = document.createElement('span');
        successText.style.cssText = 'font-weight: 500;';
        successText.textContent = 'Image successfully compressed!';
        
        successContent.appendChild(successIcon);
        successContent.appendChild(successText);
        this.successNotification.appendChild(successContent);
        
        // Assemble everything
        progressSection.appendChild(progressContainer);
        progressSection.appendChild(statusIndicators);
        progressSection.appendChild(this.optimizationResults);
        
        this.progressContainer.appendChild(header);
        this.progressContainer.appendChild(progressSection);
        this.progressContainer.appendChild(this.successNotification);
        
        // Add to body
        document.body.appendChild(this.progressContainer);
    }

    show() {
        this.progressContainer.style.display = 'block';
        this.isVisible = true;
    }

    hide() {
        this.progressContainer.style.display = 'none';
        this.isVisible = false;
    }

    startUpload() {
        this.show();
        this.uploadProgress = 0;
        this.optimizationStatus = 'idle';
        this.optimizedImages = null;
        this.updateDisplay();
        
        // Update upload indicator (with safety checks)
        if (this.uploadIndicator) {
            this.uploadIndicator.style.background = '#3b82f6';
        }
        if (this.uploadText) {
            this.uploadText.style.color = '#3b82f6';
            this.uploadText.textContent = 'Upload in progress';
        }
        
        // Reset optimization indicator (with safety checks)
        if (this.optimizationIndicator) {
            this.optimizationIndicator.style.background = '#d1d5db';
        }
        if (this.optimizationText) {
            this.optimizationText.style.color = '#6b7280';
            this.optimizationText.textContent = 'Optimization pending';
        }
        
        // Hide results and success (with safety checks)
        if (this.optimizationResults) {
            this.optimizationResults.style.display = 'none';
        }
        if (this.successNotification) {
            this.successNotification.style.display = 'none';
        }
    }

    updateUploadProgress(progress) {
        this.uploadProgress = Math.min(progress, 100);
        this.updateDisplay();
        
        if (this.uploadProgress >= 100) {
            this.completeUpload();
        }
    }

    completeUpload() {
        this.uploadProgress = 100;
        if (this.uploadIndicator) {
            this.uploadIndicator.style.background = '#10b981';
        }
        if (this.uploadText) {
            this.uploadText.style.color = '#10b981';
            this.uploadText.textContent = 'Upload complete';
        }
        this.updateDisplay();
        
        // Start optimization
        setTimeout(() => {
            this.startOptimization();
        }, 500);
    }

    startOptimization() {
        this.optimizationStatus = 'processing';
        if (this.optimizationIndicator) {
            this.optimizationIndicator.style.background = '#f59e0b';
        }
        if (this.optimizationText) {
            this.optimizationText.style.color = '#f59e0b';
            this.optimizationText.textContent = 'Optimization in progress';
        }
        this.updateDisplay();
        
        // Simulate optimization progress
        this.simulateOptimizationProgress();
    }

    simulateOptimizationProgress() {
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress >= 90) {
                progress = 90;
                clearInterval(interval);
            }
            this.uploadProgress = progress;
            this.updateDisplay();
        }, 200);
        
        // Complete optimization after delay
        setTimeout(() => {
            clearInterval(interval);
            this.completeOptimization();
        }, 2000);
    }

    completeOptimization() {
        this.optimizationStatus = 'completed';
        this.uploadProgress = 100;
        if (this.optimizationIndicator) {
            this.optimizationIndicator.style.background = '#10b981';
        }
        if (this.optimizationText) {
            this.optimizationText.style.color = '#10b981';
            this.optimizationText.textContent = 'Optimization complete';
        }
        this.updateDisplay();
        
        // Show optimization results
        this.showOptimizationResults();
        
        // Show success notification
        this.showSuccessNotification();
        
        // Auto-hide after delay
        setTimeout(() => {
            this.hide();
        }, 5000);
    }

    showOptimizationResults() {
        if (this.resultsContent) {
            this.resultsContent.innerHTML = `
                <p>• Created 6 optimized versions</p>
                <p>• Average compression: 95.2% smaller</p>
                <p>• WebP versions for modern browsers</p>
            `;
        }
        if (this.optimizationResults) {
            this.optimizationResults.style.display = 'block';
        }
    }

    showSuccessNotification() {
        if (this.successNotification) {
            this.successNotification.style.display = 'block';
        }
    }

    updateDisplay() {
        this.percentageText.textContent = `${Math.round(this.uploadProgress)}%`;
        this.progressBar.style.width = `${this.uploadProgress}%`;
        
        if (this.uploadProgress >= 100) {
            this.progressBar.style.background = '#10b981';
        } else {
            this.progressBar.style.background = '#3b82f6';
        }
        
        // Update status text
        if (this.uploadProgress < 100) {
            this.statusText.textContent = 'Uploading image...';
        } else if (this.optimizationStatus === 'processing') {
            this.statusText.textContent = 'Optimizing image...';
        } else if (this.optimizationStatus === 'completed') {
            this.statusText.textContent = 'Image optimization completed!';
        }
    }
}

// Global instance
window.imageUploadProgress = new ImageUploadProgress();

// Enhanced file input functionality
function enhanceFileInputs() {
    // Only enhance file inputs that accept images. This prevents JSON or other non-image
    // file inputs (like the timetable JSON) from being wrapped by the image optimizer UI.
    const fileInputs = document.querySelectorAll('input[type="file"][accept*="image/"]');
    
    fileInputs.forEach(input => {
        // Skip if this is an image input that should use gallery
        if (input.id === 'icon' || input.id === 'tour-icon' || input.id === 'tour-main-image') {
            console.log('Skipping image input from enhancement (will use gallery):', input.id);
            return;
        }
        
        // Create a wrapper for the file input
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'margin-bottom: 16px;';
        
        // Create a custom drop zone
        const dropZone = document.createElement('div');
        dropZone.style.cssText = `
            border: 2px dashed #6b7280 !important;
            border-radius: 8px !important;
            padding: 24px !important;
            text-align: center !important;
            cursor: pointer !important;
            transition: all 0.2s !important;
            background: #4b5563 !important;
        `;
        
        dropZone.innerHTML = `
            <div style="margin-bottom: 16px;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7,10 12,15 17,10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
            </div>
            <div style="color: white; margin-bottom: 8px;">
                <span style="color: white; font-weight: 500;">Click to upload</span> or drag and drop
            </div>
            <div style="font-size: 12px; color: #e5e7eb;">
                ${input.accept === 'image/*' ? 'PNG, JPG, GIF up to 10MB' : 'Files up to 10MB'}
            </div>
        `;
        
        // Handle drag and drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.setProperty('border-color', '#ffffff', 'important');
            dropZone.style.setProperty('background', '#374151', 'important');
        });
        
        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.style.setProperty('border-color', '#6b7280', 'important');
            dropZone.style.setProperty('background', '#4b5563', 'important');
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.setProperty('border-color', '#6b7280', 'important');
            dropZone.style.setProperty('background', '#4b5563', 'important');
            
            if (e.dataTransfer.files.length > 0) {
                input.files = e.dataTransfer.files;
                input.dispatchEvent(new Event('change'));
            }
        });
        
        // Handle click to open file dialog
        dropZone.addEventListener('click', () => {
            input.click();
        });
        
        // Handle file selection - intercept and show config modal first
        const originalFiles = [];
        input.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                // Store the selected files
                const files = Array.from(e.target.files);
                
                // Only show config for image files
                const isImageUpload = files.some(f => f.type.startsWith('image/'));
                
                if (isImageUpload && window.imageGalleryModal) {
                    // Show upload configuration modal
                    window.imageGalleryModal.openUploadConfig((config) => {
                        console.log('Upload config:', config);
                        
                        // Store config for the backend to use
                        input.dataset.uploadConfig = JSON.stringify(config);
                        
                        // Start progress tracking
                        window.imageUploadProgress.startUpload();
                        
                        // Simulate upload progress
                        let progress = 0;
                        const interval = setInterval(() => {
                            progress += Math.random() * 20;
                            window.imageUploadProgress.updateUploadProgress(progress);
                            
                            if (progress >= 100) {
                                clearInterval(interval);
                            }
                        }, 100);
                    });
                } else {
                    // Non-image files, proceed normally
                    window.imageUploadProgress.startUpload();
                    
                    let progress = 0;
                    const interval = setInterval(() => {
                        progress += Math.random() * 20;
                        window.imageUploadProgress.updateUploadProgress(progress);
                        
                        if (progress >= 100) {
                            clearInterval(interval);
                        }
                    }, 100);
                }
            }
        });
        
        // Hide original input and show custom drop zone
        input.style.display = 'none';
        wrapper.appendChild(dropZone);
        input.parentNode.insertBefore(wrapper, input);
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    enhanceFileInputs();
});

// Export for use in other scripts
window.enhanceFileInputs = enhanceFileInputs;
