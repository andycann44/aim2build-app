// LEGO Brick Scanner App
// Main application logic

class LegoBrickScanner {
    constructor() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.capturedImage = document.getElementById('captured-image');
        this.statusDiv = document.getElementById('status');
        this.model = null;
        this.stream = null;
        this.currentResults = null;
        this.inventory = this.loadInventory();
        
        this.initializeApp();
    }
    
    async initializeApp() {
        this.setupEventListeners();
        await this.initCamera();
        await this.loadModel();
        this.updateInventoryView();
    }
    
    setupEventListeners() {
        document.getElementById('capture-btn').addEventListener('click', () => this.captureAndScan());
        document.getElementById('view-inventory-btn').addEventListener('click', () => this.showView('inventory'));
        document.getElementById('add-to-inventory-btn').addEventListener('click', () => this.addToInventory());
        document.getElementById('rescan-btn').addEventListener('click', () => this.showView('camera'));
        document.getElementById('back-to-camera-btn').addEventListener('click', () => this.showView('camera'));
        document.getElementById('clear-inventory-btn').addEventListener('click', () => this.clearInventory());
    }
    
    async initCamera() {
        try {
            this.showStatus('Initializing camera...', 'info');
            
            const constraints = {
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };
            
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            
            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.video.play();
                    resolve();
                };
            });
            
            this.showStatus('Camera ready! Position a LEGO brick in the frame', 'success');
            
        } catch (error) {
            console.error('Camera initialization error:', error);
            this.showStatus('Camera access denied or unavailable. Please enable camera permissions.', 'error');
        }
    }
    
    async loadModel() {
        try {
            this.showStatus('Loading AI model...', 'info');
            
            // Load MobileNet model for image classification
            this.model = await mobilenet.load();
            
            this.showStatus('AI model loaded! Ready to scan LEGO bricks', 'success');
            
        } catch (error) {
            console.error('Model loading error:', error);
            this.showStatus('Failed to load AI model. Please refresh the page.', 'error');
        }
    }
    
    async captureAndScan() {
        if (!this.model) {
            this.showStatus('AI model not loaded yet. Please wait...', 'warning');
            return;
        }
        
        try {
            this.showStatus('Capturing image...', 'info');
            
            // Set canvas dimensions to match video
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            
            // Draw current video frame to canvas
            const ctx = this.canvas.getContext('2d');
            ctx.drawImage(this.video, 0, 0);
            
            // Convert canvas to image
            const imageDataUrl = this.canvas.toDataURL('image/jpeg');
            this.capturedImage.src = imageDataUrl;
            
            // Show scanning status
            this.showStatus('Analyzing LEGO brick...', 'info');
            
            // Analyze the image
            const predictions = await this.model.classify(this.canvas);
            console.log('Predictions:', predictions);
            
            // Match predictions to LEGO parts
            this.currentResults = analyzeForLegoParts(predictions);
            
            // Display results
            this.displayResults(this.currentResults);
            this.showView('results');
            
        } catch (error) {
            console.error('Capture and scan error:', error);
            this.showStatus('Failed to analyze image. Please try again.', 'error');
        }
    }
    
    displayResults(results) {
        const resultsDiv = document.getElementById('analysis-results');
        
        if (results.length === 0) {
            resultsDiv.innerHTML = `
                <div class="result-item">
                    <h3>No LEGO parts identified</h3>
                    <p>Try positioning the brick more clearly in the frame and ensure good lighting.</p>
                </div>
            `;
            return;
        }
        
        resultsDiv.innerHTML = results.map((result, index) => {
            const confidence = (result.confidence * 100).toFixed(1);
            const colors = result.part.colors ? result.part.colors.join(', ') : 'Unknown';
            
            return `
                <div class="result-item" data-index="${index}">
                    <h3>${result.part.name}</h3>
                    <p><strong>Part ID:</strong> ${result.part.id}</p>
                    <p><strong>Category:</strong> ${result.part.category}</p>
                    <p><strong>Dimensions:</strong> ${result.part.dimensions}</p>
                    <p><strong>Common Colors:</strong> ${colors}</p>
                    <p><strong>Confidence:</strong> ${confidence}%</p>
                    <div class="confidence-bar">
                        <div class="confidence-fill" style="width: ${confidence}%"></div>
                    </div>
                    ${index === 0 ? '<p style="margin-top: 8px; color: var(--lego-blue); font-weight: bold;">✓ Best Match</p>' : ''}
                </div>
            `;
        }).join('');
    }
    
    addToInventory() {
        if (!this.currentResults || this.currentResults.length === 0) {
            this.showStatus('No results to add to inventory', 'warning');
            return;
        }
        
        // Add the best match (first result) to inventory
        const bestMatch = this.currentResults[0];
        const partKey = bestMatch.part.key || bestMatch.part.id;
        
        if (this.inventory[partKey]) {
            this.inventory[partKey].quantity += 1;
        } else {
            this.inventory[partKey] = {
                ...bestMatch.part,
                quantity: 1,
                dateAdded: new Date().toISOString()
            };
        }
        
        this.saveInventory();
        this.showStatus(`Added ${bestMatch.part.name} to inventory!`, 'success');
        
        // Show inventory after a short delay
        setTimeout(() => {
            this.showView('inventory');
            this.updateInventoryView();
        }, 1500);
    }
    
    updateInventoryView() {
        const inventoryList = document.getElementById('inventory-list');
        const totalPartsEl = document.getElementById('total-parts');
        const uniquePartsEl = document.getElementById('unique-parts');
        
        const items = Object.entries(this.inventory);
        
        if (items.length === 0) {
            inventoryList.innerHTML = `
                <div class="empty-inventory">
                    <p style="font-size: 48px;">📦</p>
                    <p>Your inventory is empty</p>
                    <p>Start scanning LEGO bricks to build your collection!</p>
                </div>
            `;
            totalPartsEl.textContent = '0';
            uniquePartsEl.textContent = '0';
            return;
        }
        
        const totalParts = items.reduce((sum, [_, item]) => sum + item.quantity, 0);
        totalPartsEl.textContent = totalParts;
        uniquePartsEl.textContent = items.length;
        
        inventoryList.innerHTML = items
            .sort((a, b) => b[1].quantity - a[1].quantity)
            .map(([key, item]) => `
                <div class="inventory-item">
                    <div class="item-info">
                        <h4>${item.name}</h4>
                        <p>Part ID: ${item.id} | ${item.category}</p>
                        <p>${item.dimensions}</p>
                    </div>
                    <div class="item-quantity">${item.quantity}</div>
                </div>
            `).join('');
    }
    
    clearInventory() {
        if (confirm('Are you sure you want to clear all inventory? This cannot be undone.')) {
            this.inventory = {};
            this.saveInventory();
            this.updateInventoryView();
            this.showStatus('Inventory cleared', 'info');
        }
    }
    
    loadInventory() {
        try {
            const stored = localStorage.getItem('lego_inventory');
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.error('Error loading inventory:', error);
            return {};
        }
    }
    
    saveInventory() {
        try {
            localStorage.setItem('lego_inventory', JSON.stringify(this.inventory));
        } catch (error) {
            console.error('Error saving inventory:', error);
            this.showStatus('Failed to save inventory', 'error');
        }
    }
    
    showView(viewName) {
        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        
        // Show requested view
        const viewId = `${viewName}-view`;
        const view = document.getElementById(viewId);
        if (view) {
            view.classList.add('active');
        }
        
        // Clear status when switching views
        if (viewName !== 'camera') {
            this.statusDiv.innerHTML = '';
            this.statusDiv.className = 'status';
        }
    }
    
    showStatus(message, type = 'info') {
        this.statusDiv.textContent = message;
        this.statusDiv.className = `status ${type}`;
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.scanner = new LegoBrickScanner();
});

// Register service worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('Service Worker registered:', reg))
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}
