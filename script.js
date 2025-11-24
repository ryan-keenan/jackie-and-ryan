// Countdown functionality
function updateCountdown() {
    // Create wedding date in Pacific timezone
    const weddingDate = new Date('December 21, 2025 11:30:00 PST');
    const now = new Date();
    
    console.log('Wedding date:', weddingDate.toISOString());
    console.log('Current date:', now.toISOString());
    
    const timeDiff = weddingDate.getTime() - now.getTime();
    console.log('Time difference (ms):', timeDiff);
    
    if (timeDiff > 0) {
        const days = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
        console.log('Days calculated:', days);
        
        const countdownElement = document.getElementById('days');
        if (countdownElement) {
            countdownElement.textContent = days;
            console.log('Updated countdown element with:', days);
        } else {
            console.error('Countdown element not found!');
        }
    } else {
        console.log('Wedding date has passed');
        const countdownElement = document.getElementById('days');
        if (countdownElement) {
            countdownElement.textContent = '0';
        }
    }
}

// Wait for DOM to be ready and prevent multiple initializations
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWebsite);
} else {
    initializeWebsite();
}

function initializeWebsite() {
    // Prevent multiple initializations
    if (window.lightboxInitialized) {
        console.log('Website already initialized, skipping...');
        return;
    }
    window.lightboxInitialized = true;
    console.log('Initializing website...');
    
    // Start the countdown
    updateCountdown();
    setInterval(updateCountdown, 60000); // Update every minute

    // ==================== SCROLL NAVIGATION ====================

    // Smooth scroll for navigation links with offset
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);

            if (targetSection) {
                const navHeight = document.querySelector('.scroll-nav')?.offsetHeight || 0;
                const targetPosition = targetSection.offsetTop - navHeight + 1;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });

                navLinks.forEach(l => l.classList.remove('active'));
                this.classList.add('active');
            }
        });
    });

    // Scroll spy for active navigation highlighting
    function updateActiveNav() {
        const sections = document.querySelectorAll('.section');
        const scrollPosition = window.scrollY + 100;

        sections.forEach((section) => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');

            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                navLinks.forEach(link => link.classList.remove('active'));
                const activeLink = document.querySelector(`a[href="#${sectionId}"]`);
                if (activeLink) {
                    activeLink.classList.add('active');
                }
            }
        });
    }

    // Add scroll listener for navigation
    window.addEventListener('scroll', updateActiveNav);
    updateActiveNav(); // Initial call

    // ==================== LIGHTBOX FUNCTIONALITY ====================
    
    initializeLightbox();
}

function initializeLightbox() {
    console.log('Initializing lightbox...');
    
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxVideo = document.getElementById('lightbox-video');
    const lightboxCaption = document.getElementById('lightbox-caption');
    const lightboxCounter = document.getElementById('lightbox-counter');
    const closeLightbox = document.querySelector('.close-lightbox');
    const prevButton = document.getElementById('lightbox-prev');
    const nextButton = document.getElementById('lightbox-next');

    if (!lightbox) {
        console.error('Lightbox element not found!');
        return;
    }

    console.log('Lightbox elements found:', {
        lightbox: !!lightbox,
        lightboxImg: !!lightboxImg,
        lightboxVideo: !!lightboxVideo,
        lightboxCaption: !!lightboxCaption,
        lightboxCounter: !!lightboxCounter,
        closeLightbox: !!closeLightbox,
        prevButton: !!prevButton,
        nextButton: !!nextButton
    });

    let currentIndex = 0;
    let galleryItems = [];

    // Collect all gallery items (photos and videos)
    function collectGalleryItems() {
        console.log('Collecting gallery items...');
        const photos = document.querySelectorAll('.photo-item');
        const videos = document.querySelectorAll('.video-item');
        
        galleryItems = [];
        
        console.log('Found photos:', photos.length);
        console.log('Found videos:', videos.length);
        
        photos.forEach((photo) => {
            const img = photo.querySelector('img');
            if (img) {
                const imgSrc = img.src;
                const caption = photo.getAttribute('data-long-caption') || 
                              photo.querySelector('.photo-caption')?.textContent || '';
                galleryItems.push({
                    type: 'image',
                    src: imgSrc,
                    caption: caption,
                    element: photo
                });
            }
        });

        videos.forEach((video) => {
            const vimeoId = video.getAttribute('data-vimeo-id');
            if (vimeoId) {
                const caption = video.querySelector('.media-caption')?.textContent || '';
                galleryItems.push({
                    type: 'video',
                    vimeoId: vimeoId,
                    caption: caption,
                    element: video
                });
            }
        });

        console.log(`Gallery initialized with ${galleryItems.length} items:`, galleryItems);
    }

    // Open lightbox
    function openLightbox(index) {
        console.log('Opening lightbox at index:', index);
        
        if (index < 0 || index >= galleryItems.length) {
            console.error('Invalid gallery index:', index);
            return;
        }
        
        currentIndex = index;
        const item = galleryItems[currentIndex];
        
        console.log('Opening item:', item);
        
        lightbox.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // Hide both media elements initially
        lightboxImg.style.display = 'none';
        lightboxVideo.style.display = 'none';
        
        if (item.type === 'image') {
            console.log('Displaying image:', item.src);
            lightboxImg.src = item.src;
            lightboxImg.style.display = 'block';
        } else if (item.type === 'video') {
            console.log('Displaying video:', item.vimeoId);
            const iframe = `<iframe src="https://player.vimeo.com/video/${item.vimeoId}?autoplay=1" 
                           width="100%" height="100%" frameborder="0" allow="autoplay; fullscreen" 
                           allowfullscreen></iframe>`;
            lightboxVideo.innerHTML = iframe;
            lightboxVideo.style.display = 'block';
        }
        
        lightboxCaption.textContent = item.caption;
        lightboxCounter.textContent = `${currentIndex + 1} / ${galleryItems.length}`;
        
        console.log('Lightbox opened successfully');
    }

    // Close lightbox
    function closeLightboxFunction() {
        console.log('Closing lightbox');
        lightbox.style.display = 'none';
        document.body.style.overflow = 'auto';
        lightboxImg.src = '';
        lightboxVideo.innerHTML = '';
        lightboxImg.style.display = 'none';
        lightboxVideo.style.display = 'none';
    }

    // Navigate lightbox
    function navigateLightbox(direction) {
        console.log('Navigating lightbox:', direction);
        if (direction === 'next') {
            currentIndex = (currentIndex + 1) % galleryItems.length;
        } else {
            currentIndex = (currentIndex - 1 + galleryItems.length) % galleryItems.length;
        }
        openLightbox(currentIndex);
    }

    // Initialize gallery and add event listeners
    collectGalleryItems();

    // Add click listeners to gallery items
    galleryItems.forEach((item, index) => {
        console.log(`Adding click listener to item ${index}:`, item.element);
        item.element.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Gallery item clicked:', index);
            openLightbox(index);
        });
        
        // Make sure the cursor shows it's clickable
        item.element.style.cursor = 'pointer';
    });

    // Lightbox controls
    if (closeLightbox) {
        closeLightbox.addEventListener('click', (e) => {
            e.preventDefault();
            closeLightboxFunction();
        });
    }

    if (prevButton) {
        prevButton.addEventListener('click', (e) => {
            e.preventDefault();
            navigateLightbox('prev');
        });
    }

    if (nextButton) {
        nextButton.addEventListener('click', (e) => {
            e.preventDefault();
            navigateLightbox('next');
        });
    }

    // Close on background click
    lightbox.addEventListener('click', function(e) {
        if (e.target === lightbox) {
            closeLightboxFunction();
        }
    });

    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (lightbox.style.display === 'block') {
            switch(e.key) {
                case 'Escape':
                    e.preventDefault();
                    closeLightboxFunction();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    navigateLightbox('prev');
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    navigateLightbox('next');
                    break;
            }
        }
    });

    // Touch/Swipe navigation for mobile
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    let isSwiping = false;
    
    function handleTouchStart(e) {
        if (lightbox.style.display === 'block') {
            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            isSwiping = true;
            console.log('Touch start at:', touchStartX, touchStartY);
        }
    }
    
    function handleTouchMove(e) {
        if (lightbox.style.display === 'block' && isSwiping) {
            // Don't prevent default here - let the user move their finger
            const touch = e.touches[0];
            const deltaX = touch.clientX - touchStartX;
            const deltaY = touch.clientY - touchStartY;
            
            // If it's primarily a horizontal swipe, prevent scrolling
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                e.preventDefault();
            }
        }
    }
    
    function handleTouchEnd(e) {
        if (lightbox.style.display === 'block' && isSwiping) {
            const touch = e.changedTouches[0];
            touchEndX = touch.clientX;
            touchEndY = touch.clientY;
            
            console.log('Touch end at:', touchEndX, touchEndY);
            
            // Calculate swipe distance and direction
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;
            const absDeltaX = Math.abs(deltaX);
            const absDeltaY = Math.abs(deltaY);
            
            // Minimum swipe distance (in pixels)
            const minSwipeDistance = 30; // Reduced from 50 for better sensitivity
            
            // Make sure it's more horizontal than vertical (to avoid interfering with scrolling)
            if (absDeltaX > minSwipeDistance && absDeltaX > absDeltaY * 1.5) {
                e.preventDefault(); // Prevent any default behavior
                if (deltaX > 0) {
                    // Swiped right - go to previous photo
                    console.log('Swiped right - previous photo');
                    navigateLightbox('prev');
                } else {
                    // Swiped left - go to next photo  
                    console.log('Swiped left - next photo');
                    navigateLightbox('next');
                }
            } else {
                console.log('Swipe not detected - deltaX:', absDeltaX, 'deltaY:', absDeltaY, 'minDistance:', minSwipeDistance);
            }
            
            isSwiping = false;
        }
    }
    
    // Add touch event listeners to multiple elements for better coverage
    const lightboxMediaContainer = document.getElementById('lightbox-media-container');
    const swipeElements = [lightbox, lightboxImg, lightboxVideo, lightboxMediaContainer];
    
    swipeElements.forEach(element => {
        if (element) {
            element.addEventListener('touchstart', handleTouchStart, { passive: false });
            element.addEventListener('touchmove', handleTouchMove, { passive: false });
            element.addEventListener('touchend', handleTouchEnd, { passive: false });
            console.log('Added touch listeners to:', element.id || element.className);
        }
    });

    console.log('Lightbox initialization complete with swipe support!');
}

// Story expand/collapse functionality
function initStoryExpandCollapse() {
    console.log('Initializing story expand/collapse...');
    
    const expandBtn = document.getElementById('storyExpandBtn');
    const fullContent = document.getElementById('storyFullContent');
    
    console.log('Expand button found:', expandBtn);
    console.log('Full content found:', fullContent);
    
    if (!expandBtn || !fullContent) {
        console.error('Story expand elements not found - Button:', expandBtn, 'Content:', fullContent);
        return;
    }
    
    const expandText = expandBtn.querySelector('.expand-text');
    const collapseText = expandBtn.querySelector('.collapse-text');
    
    console.log('Text elements found - Expand:', expandText, 'Collapse:', collapseText);

    expandBtn.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('Story expand button clicked!');
        
        const isExpanded = expandBtn.classList.contains('expanded');
        console.log('Currently expanded:', isExpanded);
        
        if (isExpanded) {
            // Collapse
            console.log('Collapsing story...');
            expandBtn.classList.remove('expanded');
            fullContent.classList.remove('show');
            if (expandText) expandText.style.display = 'inline';
            if (collapseText) collapseText.style.display = 'none';
            
            // Smooth scroll to story section
            setTimeout(() => {
                const storySection = document.getElementById('story');
                if (storySection) {
                    storySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);
        } else {
            // Expand
            console.log('Expanding story...');
            expandBtn.classList.add('expanded');
            fullContent.classList.add('show');
            if (expandText) expandText.style.display = 'none';
            if (collapseText) collapseText.style.display = 'inline';
        }
    });
    
    console.log('Story expand/collapse initialized successfully');
}

// Try multiple initialization methods for better compatibility
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded - initializing story expand');
    initStoryExpandCollapse();
});

// Fallback initialization
window.addEventListener('load', function() {
    console.log('Window loaded - checking story expand initialization');
    const btn = document.getElementById('storyExpandBtn');
    if (btn && !btn.hasAttribute('data-initialized')) {
        console.log('Backup initialization triggered');
        initStoryExpandCollapse();
        btn.setAttribute('data-initialized', 'true');
    }
});

// Even more backup - initialize after a short delay
setTimeout(function() {
    const btn = document.getElementById('storyExpandBtn');
    if (btn && !btn.hasAttribute('data-initialized')) {
        console.log('Delayed initialization triggered');
        initStoryExpandCollapse();
        btn.setAttribute('data-initialized', 'true');
    }
}, 500);

console.log('Script loaded successfully!');

// Simple inline backup - this should definitely work
(function() {
    console.log('Inline backup story expand initializer running...');
    
    function setupStoryExpand() {
        const btn = document.getElementById('storyExpandBtn');
        const content = document.getElementById('storyFullContent');
        
        if (!btn || !content) {
            console.log('Story elements not ready yet, will retry...');
            return false;
        }
        
        console.log('Setting up story expand with inline method...');
        
        btn.onclick = function() {
            console.log('Button clicked with inline method!');
            const isExpanded = btn.classList.contains('expanded');
            
            if (isExpanded) {
                btn.classList.remove('expanded');
                content.classList.remove('show');
                content.style.display = 'none';
                btn.querySelector('.expand-text').style.display = 'inline';
                btn.querySelector('.collapse-text').style.display = 'none';
            } else {
                btn.classList.add('expanded');
                content.classList.add('show');
                content.style.display = 'block';
                btn.querySelector('.expand-text').style.display = 'none';
                btn.querySelector('.collapse-text').style.display = 'inline';
            }
            return false;
        };
        
        console.log('Inline story expand setup complete!');
        return true;
    }
    
    // Try immediately
    if (!setupStoryExpand()) {
        // If not ready, try after DOM content loaded
        document.addEventListener('DOMContentLoaded', setupStoryExpand);
        
        // And also try after page load
        window.addEventListener('load', setupStoryExpand);
        
        // And one more time after a delay
        setTimeout(setupStoryExpand, 1000);
    }
})();