// Wedding countdown timer
function updateCountdown() {
    // Wedding date: December 21, 2025
    const weddingDate = new Date(2025, 11, 21); // Month is 0-indexed: 11 = December
    const today = new Date();

    // Log to console to verify it's calculating
    console.log('Today:', today.toDateString());
    console.log('Wedding:', weddingDate.toDateString());

    // Set both to midnight for clean day calculation
    weddingDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    // Calculate difference in milliseconds
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysRemaining = Math.round((weddingDate - today) / msPerDay);

    console.log('Days calculated:', daysRemaining);

    // Update the display
    const daysEl = document.getElementById('days');
    if (daysEl) {
        if (daysRemaining > 0) {
            daysEl.textContent = daysRemaining;
        } else if (daysRemaining === 0) {
            daysEl.parentElement.textContent = "Today is the day!";
        } else {
            daysEl.parentElement.textContent = "Just married!";
        }
    }

    // Test: Change the wedding date to tomorrow to see it update
    // Uncomment the line below to test with tomorrow's date
    // testWithDifferentDate();
}

// Test function to verify countdown is working
function testWithDifferentDate() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const testEl = document.querySelector('.countdown-text');
    if (testEl) {
        testEl.innerHTML += '<br><small style="color: #999;">Test: 1 day if set to tomorrow</small>';
    }
}

// Run countdown immediately and also when DOM loads
updateCountdown(); // Run immediately

// Lightbox functionality for photo gallery
document.addEventListener('DOMContentLoaded', function() {
    // Start the countdown again when DOM is ready
    updateCountdown(); // Initial call
    setInterval(updateCountdown, 60000); // Update every minute (days don't change that fast)

    // ==================== SCROLL NAVIGATION ====================

    // Smooth scroll for navigation links with offset
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();

            const targetId = this.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);

            if (targetSection) {
                const navHeight = document.querySelector('.scroll-nav').offsetHeight;
                const targetPosition = targetSection.offsetTop - navHeight + 1;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });

                // Update active state immediately
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                this.classList.add('active');
            }
        });
    });

    // Scroll spy for active navigation highlighting
    function updateActiveNav() {
        const sections = document.querySelectorAll('.section');
        const navLinks = document.querySelectorAll('.nav-link');
        const scrollPosition = window.scrollY + 100; // Offset for detection

        sections.forEach((section, index) => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;

            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                navLinks.forEach(link => link.classList.remove('active'));
                if (navLinks[index]) {
                    navLinks[index].classList.add('active');
                }
            }
        });
    }

    // Throttle scroll events for performance
    let isScrolling = false;
    window.addEventListener('scroll', () => {
        if (!isScrolling) {
            window.requestAnimationFrame(() => {
                updateActiveNav();

                // Add shadow to nav when scrolled
                const nav = document.querySelector('.scroll-nav');
                if (window.scrollY > 10) {
                    nav.classList.add('scrolled');
                } else {
                    nav.classList.remove('scrolled');
                }

                isScrolling = false;
            });
            isScrolling = true;
        }
    });

    // Initial active state
    updateActiveNav();

    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxVideo = document.getElementById('lightbox-video');
    const lightboxCaption = document.getElementById('lightbox-caption');
    const lightboxCounter = document.getElementById('lightbox-counter');
    const closeBtn = document.querySelector('.close-lightbox');
    const prevBtn = document.getElementById('lightbox-prev');
    const nextBtn = document.getElementById('lightbox-next');

    // Get all media items (photos and videos)
    const photoItems = document.querySelectorAll('.photo-grid .photo-item');
    const videoItems = document.querySelectorAll('.video-grid .media-item');
    const allMediaItems = [...photoItems, ...videoItems];

    let currentMediaIndex = 0;

    // Function to create video iframe
    function createVideoIframe(videoId, hash, aspectRatio) {
        const iframe = document.createElement('iframe');
        iframe.src = `https://player.vimeo.com/video/${videoId}?h=${hash}&autoplay=1&title=0&byline=0&portrait=0`;
        iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute('frameborder', '0');
        iframe.className = aspectRatio === 'vertical' ? 'lightbox-video-vertical' : 'lightbox-video-horizontal';
        return iframe;
    }

    // Function to show media at specific index
    function showMedia(index) {
        if (index < 0) {
            currentMediaIndex = allMediaItems.length - 1;
        } else if (index >= allMediaItems.length) {
            currentMediaIndex = 0;
        } else {
            currentMediaIndex = index;
        }

        const currentItem = allMediaItems[currentMediaIndex];
        const mediaType = currentItem.getAttribute('data-type') || 'photo';
        const longCaption = currentItem.getAttribute('data-long-caption') || '';

        // Clear previous content
        lightboxImg.style.display = 'none';
        lightboxVideo.style.display = 'none';
        lightboxVideo.innerHTML = '';

        if (mediaType === 'video') {
            // Handle video
            const videoId = currentItem.getAttribute('data-video-id');
            const videoHash = currentItem.getAttribute('data-video-hash');
            const aspectRatio = currentItem.getAttribute('data-aspect-ratio');

            const iframe = createVideoIframe(videoId, videoHash, aspectRatio);
            lightboxVideo.appendChild(iframe);
            lightboxVideo.style.display = 'block';
        } else {
            // Handle photo
            const img = currentItem.querySelector('img');
            lightboxImg.src = img.src;
            lightboxImg.alt = img.alt;
            lightboxImg.style.display = 'block';
        }

        // Only show caption for photos, not for videos
        if (mediaType === 'video') {
            lightboxCaption.textContent = '';
            lightboxCaption.style.display = 'none';
        } else {
            lightboxCaption.textContent = longCaption;
            lightboxCaption.style.display = 'block';
        }

        lightboxCounter.textContent = `${currentMediaIndex + 1} of ${allMediaItems.length}`;
    }

    // Open lightbox when media is clicked
    allMediaItems.forEach((item, index) => {
        // For video items, use the whole container as click target
        // For photo items, use the image
        const isVideo = item.classList.contains('video-item');
        const clickTarget = isVideo ? item : (item.querySelector('img') || item);

        clickTarget.addEventListener('click', function(e) {
            // Prevent event from bubbling if clicking on a video item
            if (isVideo) {
                e.preventDefault();
            }
            currentMediaIndex = index;
            showMedia(currentMediaIndex);
            lightbox.style.display = 'block';
            document.body.style.overflow = 'hidden'; // Prevent scrolling
        });

        // Also add cursor pointer style for video items
        if (isVideo) {
            item.style.cursor = 'pointer';
        }
    });

    // Close lightbox when X is clicked
    if (closeBtn) {
        closeBtn.addEventListener('click', closeLightbox);
    }

    // Previous button click
    if (prevBtn) {
        prevBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            showMedia(currentMediaIndex - 1);
        });
    }

    // Next button click
    if (nextBtn) {
        nextBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            showMedia(currentMediaIndex + 1);
        });
    }

    // Close lightbox when clicking outside the image
    lightbox.addEventListener('click', function(e) {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });

    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (lightbox.style.display === 'block') {
            if (e.key === 'Escape') {
                closeLightbox();
            } else if (e.key === 'ArrowLeft') {
                showMedia(currentMediaIndex - 1);
            } else if (e.key === 'ArrowRight') {
                showMedia(currentMediaIndex + 1);
            }
        }
    });

    function closeLightbox() {
        lightbox.style.display = 'none';
        document.body.style.overflow = 'auto'; // Re-enable scrolling
        // Clear video content to stop playback
        lightboxVideo.innerHTML = '';
        lightboxVideo.style.display = 'none';
    }

    // Smooth scroll for anchor links
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    anchorLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href !== '#' && href !== '#0') {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });

    // Add fade-in animation for elements as they come into view
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in-visible');
            }
        });
    }, observerOptions);

    // Observe all sections
    const sectionsToAnimate = document.querySelectorAll('.section');
    sectionsToAnimate.forEach(section => {
        section.classList.add('fade-in-element');
        observer.observe(section);
    });

    // Add fade-in class to section content
    document.querySelectorAll('.section').forEach(section => {
        // Add to specific content elements within sections
        const contentElements = section.querySelectorAll('h2, .story-text, .story-image, .agenda, .venue-info, .photo-grid, .video-container');
        contentElements.forEach(el => {
            el.classList.add('fade-in-element');
            observer.observe(el);
        });
    });

    // Add CSS for fade-in animation
    const style = document.createElement('style');
    style.textContent = `
        .fade-in-element {
            opacity: 0;
            transform: translateY(20px);
            transition: opacity 0.8s ease, transform 0.8s ease;
        }
        .fade-in-visible {
            opacity: 1;
            transform: translateY(0);
        }
    `;
    document.head.appendChild(style);

    // Parallax effect for hero image (subtle)
    const heroImage = document.querySelector('.hero-image');
    if (heroImage) {
        window.addEventListener('scroll', function() {
            const scrolled = window.pageYOffset;
            const parallaxSpeed = 0.5;
            heroImage.style.transform = `translateY(${scrolled * parallaxSpeed}px)`;
        });
    }

    // RSVP button - you can update this with your actual RSVP link
    const rsvpButton = document.querySelector('.rsvp-button');
    if (rsvpButton) {
        rsvpButton.addEventListener('click', function(e) {
            // If it's still a placeholder link
            if (this.getAttribute('href') === '#') {
                e.preventDefault();
                // You can replace this alert with your actual RSVP functionality
                alert('Please update the RSVP link in the HTML to point to your RSVP form or page.');
            }
        });
    }

    // Optional: Add loading placeholders for images
    const allImages = document.querySelectorAll('img');
    allImages.forEach(img => {
        img.addEventListener('error', function() {
            // If image fails to load, show a placeholder
            this.style.background = '#f0f0f0';
            this.style.padding = '40px';
            this.alt = 'Image placeholder - add your photo';
            this.style.textAlign = 'center';
            this.style.color = '#999';
        });
    });
});

// Lazy loading for videos (load only when visible)
// Commenting out for now as it's preventing videos from loading
/* document.addEventListener('DOMContentLoaded', function() {
    const videoFrames = document.querySelectorAll('.video-wrapper iframe');

    const videoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const iframe = entry.target;
                if (!iframe.src && iframe.dataset.src) {
                    iframe.src = iframe.dataset.src;
                    videoObserver.unobserve(iframe);
                }
            }
        });
    });

    videoFrames.forEach(frame => {
        // Store the src in data-src and remove it initially for lazy loading
        if (frame.src) {
            frame.dataset.src = frame.src;
            frame.src = '';
        }
        videoObserver.observe(frame);
    });
}); */