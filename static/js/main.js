// Main JavaScript functionality for FurryFriends

// Global state
const AppState = {
    currentUser: null,
    selectedFile: null
};

// Utility Functions
const Utils = {
    // Show global popup - disappears after 1 second
    showPopup(message, duration = 1000) {
        const popup = document.getElementById('globalPopup');
        const messageEl = document.getElementById('popupMessage');

        if (popup && messageEl) {
            messageEl.textContent = message;
            popup.style.display = 'block';

            setTimeout(() => {
                popup.style.display = 'none';
            }, duration);
        }
    },

    // Auto-hide flash messages - disappear after 1 second
    autoHideFlashMessages() {
        const flashMessages = document.querySelectorAll('.flash-message');
        flashMessages.forEach(message => {
            setTimeout(() => {
                message.style.display = 'none';
            }, 1000);
        });
    },

    // Check if on home page
    isHomePage() {
        const currentPath = window.location.pathname;
        return currentPath === '/' || currentPath === '/index' || currentPath === '';
    },

    // Check if on MyImages page
    isMyImagesPage() {
        const currentPath = window.location.pathname;
        return currentPath === '/images';
    }
};

// Modal Controller
const ModalController = {
    // Open modal
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    },

    // Close modal
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    },

    // Open login modal
    openLoginModal() {
        this.openModal('loginModal');
        this.closeModal('registerModal');
    },

    // Open register modal
    openRegisterModal() {
        this.openModal('registerModal');
        this.closeModal('loginModal');
    },

    // Open upload modal
    openUploadModal() {
        fetch('/api/check-auth')
            .then(response => response.json())
            .then(data => {
                if (data.authenticated) {
                    this.openModal('uploadModal');
                } else {
                    // Only show prompt, don't open login modal
                    Utils.showPopup('Please login first', 1000);
                }
            })
            .catch(error => {
                console.error('Auth check failed:', error);
                Utils.showPopup('Please login first', 1000);
            });
    },

    // Close upload modal
    closeUploadModal() {
        this.closeModal('uploadModal');
    },

    // Switch to register form
    switchToRegister() {
        this.closeModal('loginModal');
        this.openRegisterModal();
    },

    // Switch to login form
    switchToLogin() {
        this.closeModal('registerModal');
        this.openLoginModal();
    },

    // Initialize modal events
    initModalEvents() {
        // Close button events (excluding image modal)
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = btn.getAttribute('data-modal');
                if (modalId && modalId !== 'imageModal') {
                    this.closeModal(modalId);
                }
            });
        });

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });

        // Login/register switch links
        const showRegisterLink = document.getElementById('showRegisterLink');
        const showLoginLink = document.getElementById('showLoginLink');

        if (showRegisterLink) {
            showRegisterLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchToRegister();
            });
        }

        if (showLoginLink) {
            showLoginLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchToLogin();
            });
        }

        // Initialize login link click event
        const loginLink = document.getElementById('loginLink');
        if (loginLink) {
            loginLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.openLoginModal();
            });
        }
    }
};

// Image Modal Controller
const ImageModalController = {
    // Open image modal
    openImageModal(imageUrl, caption) {
        const modal = document.getElementById('imageModal');
        const modalImage = document.getElementById('modalImage');
        const modalCaption = document.getElementById('modalCaption');

        if (modal && modalImage && modalCaption) {
            modalImage.src = imageUrl;
            modalCaption.textContent = caption;
            modal.style.display = 'flex';

            // Close modal when clicking on image
            modalImage.onclick = (e) => {
                e.stopPropagation();
                this.closeImageModal();
            };
        }
    },

    // Close image modal
    closeImageModal() {
        ModalController.closeModal('imageModal');
    },

    // Initialize image click events
    initImageEvents() {
        // Add click event for upload preview thumbnail
        const fileThumbnail = document.getElementById('fileThumbnail');
        if (fileThumbnail) {
            fileThumbnail.addEventListener('click', () => {
                const imageUrl = fileThumbnail.src;
                const fileName = document.getElementById('fileName').textContent;
                this.openImageModal(imageUrl, fileName);
            });
        }

        // Add click events for images on the page
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('thumbnail') ||
                (e.target.closest('.gallery-item') && e.target.tagName === 'IMG')) {
                const galleryItem = e.target.closest('.gallery-item');
                if (galleryItem) {
                    const imageUrl = galleryItem.getAttribute('data-original-url') || e.target.src;
                    const caption = galleryItem.getAttribute('data-caption') || 'Pet Image';
                    this.openImageModal(imageUrl, caption);
                }
            }
        });
    }
};

// Upload Controller
const UploadController = {
    // Handle file selection
    handleFileSelect(input) {
        const filePreview = document.getElementById('filePreview');
        const fileName = document.getElementById('fileName');
        const fileThumbnail = document.getElementById('fileThumbnail');
        const selectedFile = document.getElementById('selectedFile');

        if (input.files && input.files[0]) {
            const file = input.files[0];

            // Validate file size
            if (file.size > 10 * 1024 * 1024) {
                Utils.showPopup('File size cannot exceed 10MB');
                input.value = '';
                return;
            }

            // Validate file type
            if (!file.type.match('image.*')) {
                Utils.showPopup('Please select image files (JPG, PNG, GIF, BMP, WebP)');
                input.value = '';
                AppState.selectedFile = null;
                return;
            }

            // Display file name
            fileName.textContent = file.name;

            // Create thumbnail
            const reader = new FileReader();
            reader.onload = (e) => {
                fileThumbnail.src = e.target.result;
                filePreview.style.display = 'block';
                selectedFile.style.display = 'flex';
                AppState.selectedFile = file;
            };
            reader.readAsDataURL(file);
        }
    },

    // Remove selected file
    removeSelectedFile() {
        const filePreview = document.getElementById('filePreview');
        const fileInput = document.getElementById('pet-image');

        filePreview.style.display = 'none';
        fileInput.value = '';
        AppState.selectedFile = null;
    },

    // Initialize upload events
    initUploadEvents() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('pet-image');
        const removeFileBtn = document.getElementById('removeFileBtn');

        if (uploadArea && fileInput) {
            uploadArea.addEventListener('click', () => {
                fileInput.click();
            });

            fileInput.addEventListener('change', (e) => {
                this.handleFileSelect(e.target);
            });
        }

        if (removeFileBtn) {
            removeFileBtn.addEventListener('click', () => {
                this.removeSelectedFile();
            });
        }

        // Upload form submission
        const uploadForm = document.getElementById('uploadForm');
        if (uploadForm) {
            uploadForm.addEventListener('submit', (e) => {
                if (!AppState.selectedFile) {
                    e.preventDefault();
                    Utils.showPopup('Please select an image to upload');
                    return;
                }
                Utils.showPopup('Uploading image... Please wait');
            });
        }
    }
};

// Form Controller
const FormController = {
    // AJAX login
    async submitLoginForm(event) {
        event.preventDefault();

        const form = event.target;
        const formData = new FormData(form);

        try {
            const response = await fetch("/login", {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            const data = await response.json();

            if (data.success) {
                Utils.showPopup('Login successful!');
                ModalController.closeModal('loginModal');
                setTimeout(() => {
                    window.location.href = data.redirect;
                }, 1000);
            } else {
                Utils.showPopup(data.message || 'Login failed');
            }
        } catch (error) {
            Utils.showPopup('Login error. Please try again.');
        }
    },

    // AJAX register
    async submitRegisterForm(event) {
        event.preventDefault();

        const form = event.target;
        const formData = new FormData(form);

        try {
            const response = await fetch("/register", {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            const data = await response.json();

            if (data.success) {
                Utils.showPopup('Registration successful!');
                ModalController.closeModal('registerModal');
                setTimeout(() => {
                    window.location.href = data.redirect;
                }, 1000);
            } else {
                Utils.showPopup(data.message || 'Registration failed');
            }
        } catch (error) {
            Utils.showPopup('Registration error. Please try again.');
        }
    },

    // Initialize form events
    initFormEvents() {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.submitLoginForm(e));
        }

        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.submitRegisterForm(e));
        }
    }
};

// Navigation Controller
const NavigationController = {
    // Initialize navigation events
    initNavigationEvents() {
        // Home link handling
        const homeLinks = document.querySelectorAll('#homeLink, #homeNavLink');
        homeLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                if (Utils.isHomePage()) {
                    e.preventDefault();
                    Utils.showPopup('Already in home page');
                }
            });
        });

        // MyImages link handling - JS middleware validation
        const myImagesLink = document.getElementById('myImagesLink');
        if (myImagesLink) {
            myImagesLink.addEventListener('click', (e) => {
                if (Utils.isMyImagesPage()) {
                    e.preventDefault();
                    Utils.showPopup('Already in MyImages page');
                    return;
                }
                
                e.preventDefault(); // Immediately prevent any default navigation
                
                fetch('/api/check-auth')
                    .then(response => response.json())
                    .then(data => {
                        if (data.authenticated) {
                            // Validation passed: JS-controlled navigation
                            window.location.href = myImagesLink.href;
                        } else {
                            // Validation failed: only show prompt, don't open modal
                            Utils.showPopup('Please login first', 1000);
                        }
                    })
                    .catch(error => {
                        console.error('Auth check failed:', error);
                        Utils.showPopup('Please login first', 1000);
                    });
            });
        }

        // Upload link handling
        const uploadLink = document.getElementById('uploadLink');
        if (uploadLink) {
            uploadLink.addEventListener('click', (e) => {
                e.preventDefault();
                ModalController.openUploadModal();
            });
        }
    }
};

// Drag and Drop functionality
const DragDropController = {
    initializeDragDrop() {
        const uploadArea = document.querySelector('.upload-area');
        if (!uploadArea) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, this.preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, this.highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, this.unhighlight, false);
        });

        uploadArea.addEventListener('drop', this.handleDrop, false);
    },

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    },

    highlight() {
        this.style.borderColor = 'var(--bright-purple)';
        this.style.background = 'var(--lavender)';
    },

    unhighlight() {
        this.style.borderColor = 'var(--heliotrope)';
        this.style.background = 'var(--light-gray)';
    },

    handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        const fileInput = document.getElementById('pet-image');

        if (files.length > 0) {
            fileInput.files = files;
            UploadController.handleFileSelect(fileInput);
        }
    }
};

// Main initialization
document.addEventListener('DOMContentLoaded', function() {
    // Initialize all functionality
    Utils.autoHideFlashMessages();
    ModalController.initModalEvents();
    ImageModalController.initImageEvents();
    UploadController.initUploadEvents();
    FormController.initFormEvents();
    NavigationController.initNavigationEvents();
    DragDropController.initializeDragDrop();

    console.log('FurryFriends JavaScript initialized successfully');
});

// Lazy loading for images
function initializeLazyLoading() {
    const lazyImages = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                imageObserver.unobserve(img);
            }
        });
    });
    lazyImages.forEach(img => imageObserver.observe(img));
}

// Initialize when page loads
window.addEventListener('load', function() {
    initializeLazyLoading();
});
