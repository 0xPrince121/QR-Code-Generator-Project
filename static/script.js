// Optimized QR Code Generator JavaScript

// DOM Elements - Cache for performance
const elements = {
    optionBtns: document.querySelectorAll('.option-btn'),
    dataInput: document.getElementById('dataInput'),
    inputDesc: document.getElementById('inputDesc'),
    generateBtn: document.getElementById('generateBtn'),
    qrResult: document.getElementById('qrResult'),
    qrcodeDiv: document.getElementById('qrcode'),
    downloadBtn: document.getElementById('downloadBtn'),
    locationStatus: document.getElementById('locationStatus')
};

// Current state
let currentType = 'website';
let isGenerating = false;

// Optimized type configurations
const typeConfig = {
    website: {
        placeholder: 'Enter website URL\n(https://example.com)',
        description: 'Enter a website URL to generate QR code',
        format: (data) => {
            if (!/^https?:\/\//i.test(data)) {
                return 'https://' + data.trim();
            }
            return data.trim();
        }
    },
    whatsapp: {
        placeholder: 'Enter phone number\n(e.g., +919876543210)',
        description: 'Enter phone number with country code',
        format: (data) => {
            const cleanNumber = data.replace(/\D/g, '');
            return `https://wa.me/${cleanNumber}`;
        }
    },
    email: {
        placeholder: 'Enter email address\n(example@email.com)',
        description: 'Enter an email address to generate QR code',
        format: (data) => `mailto:${data.trim()}`
    },
    location: {
        placeholder: '📍 Auto-detecting your location...\n(This will be filled automatically)',
        description: 'We will automatically use your current location',
        format: (data) => {
            const coords = data.split(',').map(c => c.trim());
            return `geo:${coords[0]},${coords[1]}`;
        },
        autoDetect: true
    }
};

// Input validation patterns
const validationPatterns = {
    website: /^https?:\/\/[^\s$.?#].[^\s]*$/i,
    whatsapp: /^[\+]?[1-9][\d]{0,15}$/,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    location: /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/
};

// Initialize the application
function init() {
    setupEventListeners();
    setInitialState();
    registerServiceWorker();
}

// Set up event listeners
function setupEventListeners() {
    // Option button clicks
    elements.optionBtns.forEach(btn => {
        btn.addEventListener('click', handleOptionChange, { passive: true });
    });

    // Generate button click
    elements.generateBtn.addEventListener('click', handleGenerate, { passive: false });

    // Input events
    elements.dataInput.addEventListener('input', handleInputChange, { passive: true });
    elements.dataInput.addEventListener('keypress', handleKeyPress, { passive: false });

    // Download button click
    elements.downloadBtn.addEventListener('click', handleDownload, { passive: true });
}

// Handle option button changes
function handleOptionChange(event) {
    const btn = event.currentTarget;
    const type = btn.dataset.type;
    
    if (type === currentType || isGenerating) return;

    // Update active state
    elements.optionBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Update current type and UI
    currentType = type;
    updateInputUI();
    
    // Clear previous state
    clearError();
    elements.dataInput.value = '';
    elements.qrResult.classList.remove('show');
}

// Update input UI based on current type
function updateInputUI() {
    const config = typeConfig[currentType];
    
    // Update placeholder and description
    elements.dataInput.placeholder = config.placeholder;
    elements.inputDesc.textContent = config.description;
    
    // Show/hide location status
    elements.locationStatus.style.display = currentType === 'location' ? 'flex' : 'none';
    
    // Clear any validation styling
    elements.dataInput.style.borderColor = '';
    elements.dataInput.style.boxShadow = '';
}

// Handle input changes
function handleInputChange() {
    // Clear error states
    clearError();
    
    // Real-time validation feedback
    const value = elements.dataInput.value.trim();
    if (value.length > 0) {
        const isValid = validateInput(value, currentType);
        elements.dataInput.style.borderColor = isValid ? 'var(--success-color)' : 'var(--warning-color)';
    } else {
        elements.dataInput.style.borderColor = '';
    }
    
    // Hide result when typing
    if (elements.qrResult.classList.contains('show')) {
        elements.qrResult.classList.remove('show');
    }
}

// Handle keyboard events
function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleGenerate();
    }
}

// Generate QR Code
async function handleGenerate() {
    if (isGenerating) return;

    let inputValue = elements.dataInput.value.trim();
    
    try {
        // Set generating state
        setGeneratingState(true);
        
        // Handle location detection
        if (currentType === 'location') {
            inputValue = await detectLocation();
        } else {
            // Validate manual input
            if (!inputValue) {
                throw new Error('Please enter data to generate QR code');
            }
            
            if (!validateInput(inputValue, currentType)) {
                throw new Error(getValidationErrorMessage(currentType));
            }
        }
        
        // Clear error and generate
        clearError();
        await generateQRCode(inputValue, currentType);
        
    } catch (error) {
        showError(error.message);
    } finally {
        setGeneratingState(false);
    }
}

// Set generating state
function setGeneratingState(generating) {
    isGenerating = generating;
    elements.generateBtn.disabled = generating;
    
    if (generating) {
        elements.generateBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" class="animate-spin">
                <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
            </svg>
            Generating...
        `;
    } else {
        elements.generateBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
            </svg>
            Generate QR Code
        `;
    }
}

// Detect current location
async function detectLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by this browser'));
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 300000
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const coords = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                elements.dataInput.value = coords;
                resolve(coords);
            },
            (error) => {
                const errorMessages = {
                    [error.PERMISSION_DENIED]: 'Location access denied by user',
                    [error.POSITION_UNAVAILABLE]: 'Location information unavailable',
                    [error.TIMEOUT]: 'Location request timed out'
                };
                reject(new Error(errorMessages[error.code] || 'Unknown location error'));
            },
            options
        );
    });
}

// Generate QR Code via backend
async function generateQRCode(data, type) {
    const response = await fetch('/generate_qr', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            data: data,
            type: type
        })
    });

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.error || 'Failed to generate QR code');
    }

    // Display the QR code
    displayQRCode(result.filename);
}

// Display generated QR code
function displayQRCode(filename) {
    // Clear previous QR code
    elements.qrcodeDiv.innerHTML = '';
    
    // Create and display image
    const img = document.createElement('img');
    img.src = `/static/qr_codes/${filename}`;
    img.alt = 'Generated QR Code';
    img.style.width = '256px';
    img.style.height = '256px';
    img.style.borderRadius = '8px';
    
    // Store filename for download
    elements.qrcodeDiv.dataset.filename = filename;
    
    // Add to container
    elements.qrcodeDiv.appendChild(img);
    
    // Show result with smooth animation
    requestAnimationFrame(() => {
        elements.qrResult.classList.add('show');
        
        // Scroll to result
        setTimeout(() => {
            elements.qrResult.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'nearest' 
            });
        }, 100);
    });
}

// Handle download
function handleDownload() {
    const filename = elements.qrcodeDiv.dataset.filename;
    if (!filename) {
        showError('No QR code to download. Please generate a QR code first.');
        return;
    }

    const link = document.createElement('a');
    link.href = `/download/${filename}`;
    link.download = filename;
    link.click();
}

// Validate input
function validateInput(data, type) {
    const pattern = validationPatterns[type];
    if (!pattern) return true;
    
    switch (type) {
        case 'website':
            return pattern.test(data);
        case 'whatsapp':
            return pattern.test(data.replace(/[\s\-\(\)]/g, ''));
        case 'email':
            return pattern.test(data);
        case 'location':
            return pattern.test(data);
        default:
            return true;
    }
}

// Get validation error message
function getValidationErrorMessage(type) {
    const messages = {
        website: 'Please enter a valid website URL (include http:// or https://)',
        whatsapp: 'Please enter a valid phone number',
        email: 'Please enter a valid email address',
        location: 'Please enter valid coordinates (latitude, longitude)'
    };
    return messages[type] || 'Please enter valid data';
}

// Show error message
function showError(message) {
    // Clear previous errors
    clearError();
    
    // Style input
    elements.dataInput.style.borderColor = 'var(--error-color)';
    elements.dataInput.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';
    
    // Create error message
    const errorMsg = document.createElement('div');
    errorMsg.className = 'error-message';
    errorMsg.textContent = message;
    
    // Insert after input wrapper
    elements.dataInput.parentNode.appendChild(errorMsg);
    
    // Auto-remove error
    setTimeout(clearError, 5000);
}

// Clear error state
function clearError() {
    elements.dataInput.style.borderColor = '';
    elements.dataInput.style.boxShadow = '';
    
    const errorMsg = document.querySelector('.error-message');
    if (errorMsg) {
        errorMsg.remove();
    }
}

// Set initial state
function setInitialState() {
    const websiteBtn = document.querySelector('[data-type="website"]');
    if (websiteBtn) {
        websiteBtn.classList.add('active');
    }
    
    updateInputUI();
    elements.dataInput.focus();
}

// Register service worker
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/static/sw.js')
            .then(registration => {
                console.log('Service Worker registered:', registration);
            })
            .catch(error => {
                console.log('Service Worker registration failed:', error);
            });
    }
}

// Add CSS for spinning animation
const style = document.createElement('style');
style.textContent = `
    .animate-spin {
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
    init();
}

// Export for potential testing
window.QRGenerator = {
    validateInput,
    getValidationErrorMessage,
    typeConfig
};
