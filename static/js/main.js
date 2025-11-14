// Main JavaScript functionality for FurryFriends

// Global state
const AppState = {
    currentUser: null,
    selectedFile: null
};

// Utility Functions
const Utils = {
    // 显示全局弹窗 - 1秒后消失
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

    // 自动隐藏Flash消息 - 1秒后消失
    autoHideFlashMessages() {
        const flashMessages = document.querySelectorAll('.flash-message');
        flashMessages.forEach(message => {
            setTimeout(() => {
                message.style.display = 'none';
            }, 1000);
        });
    },

    // 检查是否在首页
    isHomePage() {
        const currentPath = window.location.pathname;
        return currentPath === '/' || currentPath === '/index' || currentPath === '';
    },

    // 检查是否在MyImages页面
    isMyImagesPage() {
        const currentPath = window.location.pathname;
        return currentPath === '/images';
    }
};

// Modal Controller
const ModalController = {
    // 打开模态框
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    },

    // 关闭模态框
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    },

    // 打开登录模态框
    openLoginModal() {
        this.openModal('loginModal');
        this.closeModal('registerModal');
    },

    // 打开注册模态框
    openRegisterModal() {
        this.openModal('registerModal');
        this.closeModal('loginModal');
    },

    // 打开上传模态框
    openUploadModal() {
        fetch('/api/check-auth')
            .then(response => response.json())
            .then(data => {
                if (data.authenticated) {
                    this.openModal('uploadModal');
                } else {
                    // 只显示提示，不打开登录模态框
                    Utils.showPopup('Please login first', 1000);
                }
            })
            .catch(error => {
                console.error('Auth check failed:', error);
                Utils.showPopup('Please login first', 1000);
            });
    },

    // 关闭上传模态框
    closeUploadModal() {
        this.closeModal('uploadModal');
    },

    // 切换到注册表单
    switchToRegister() {
        this.closeModal('loginModal');
        this.openRegisterModal();
    },

    // 切换到登录表单
    switchToLogin() {
        this.closeModal('registerModal');
        this.openLoginModal();
    },

    // 初始化模态框事件
    initModalEvents() {
        // 关闭按钮事件（排除图片模态框）
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = btn.getAttribute('data-modal');
                if (modalId && modalId !== 'imageModal') {
                    this.closeModal(modalId);
                }
            });
        });

        // 点击模态框外部关闭
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });

        // 登录/注册切换链接
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

        // 初始化登录链接点击事件
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
    // 打开图片模态框
    openImageModal(imageUrl, caption) {
        const modal = document.getElementById('imageModal');
        const modalImage = document.getElementById('modalImage');
        const modalCaption = document.getElementById('modalCaption');

        if (modal && modalImage && modalCaption) {
            modalImage.src = imageUrl;
            modalCaption.textContent = caption;
            modal.style.display = 'flex';

            // 点击图片关闭模态框
            modalImage.onclick = (e) => {
                e.stopPropagation();
                this.closeImageModal();
            };
        }
    },

    // 关闭图片模态框
    closeImageModal() {
        ModalController.closeModal('imageModal');
    },

    // 初始化图片点击事件
    initImageEvents() {
        // 为上传预览的缩略图添加点击事件
        const fileThumbnail = document.getElementById('fileThumbnail');
        if (fileThumbnail) {
            fileThumbnail.addEventListener('click', () => {
                const imageUrl = fileThumbnail.src;
                const fileName = document.getElementById('fileName').textContent;
                this.openImageModal(imageUrl, fileName);
            });
        }

        // 为页面中的图片添加点击事件
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
    // 处理文件选择
    handleFileSelect(input) {
        const filePreview = document.getElementById('filePreview');
        const fileName = document.getElementById('fileName');
        const fileThumbnail = document.getElementById('fileThumbnail');
        const selectedFile = document.getElementById('selectedFile');

        if (input.files && input.files[0]) {
            const file = input.files[0];

            // 验证文件大小
            if (file.size > 10 * 1024 * 1024) {
                Utils.showPopup('File size cannot exceed 10MB');
                input.value = '';
                return;
            }

            // 验证文件类型
            if (!file.type.match('image.*')) {
                Utils.showPopup('Please select image files (JPG, PNG, GIF)');
                input.value = '';
                return;
            }

            // 显示文件名
            fileName.textContent = file.name;

            // 创建缩略图
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

    // 移除选择的文件
    removeSelectedFile() {
        const filePreview = document.getElementById('filePreview');
        const fileInput = document.getElementById('pet-image');

        filePreview.style.display = 'none';
        fileInput.value = '';
        AppState.selectedFile = null;
    },

    // 初始化上传事件
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

        // 上传表单提交
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
    // AJAX登录
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

    // AJAX注册
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

    // 初始化表单事件
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
    // 初始化导航事件
    initNavigationEvents() {
        // Home链接处理
        const homeLinks = document.querySelectorAll('#homeLink, #homeNavLink');
        homeLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                if (Utils.isHomePage()) {
                    e.preventDefault();
                    Utils.showPopup('Already in home page');
                }
            });
        });

        // MyImages链接处理 - JS做中间人验证
        const myImagesLink = document.getElementById('myImagesLink');
        if (myImagesLink) {
            myImagesLink.addEventListener('click', (e) => {
                if (Utils.isMyImagesPage()) {
                    e.preventDefault();
                    Utils.showPopup('Already in MyImages page');
                    return;
                }
                
                e.preventDefault(); // 立即阻止任何默认跳转
                
                fetch('/api/check-auth')
                    .then(response => response.json())
                    .then(data => {
                        if (data.authenticated) {
                            // 验证通过：JS控制跳转
                            window.location.href = myImagesLink.href;
                        } else {
                            // 验证不通过：只显示提示，不打开模态框
                            Utils.showPopup('Please login first', 1000);
                        }
                    })
                    .catch(error => {
                        console.error('Auth check failed:', error);
                        Utils.showPopup('Please login first', 1000);
                    });
            });
        }

        // Upload链接处理
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
    // 初始化所有功能
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
