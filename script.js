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

    // Tab Navigation
    const tabs = document.querySelectorAll('.nav-tab');
    const panes = document.querySelectorAll('.tab-pane');

    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs and panes
            tabs.forEach(t => t.classList.remove('active'));
            panes.forEach(p => p.style.display = 'none');

            // Add active class to clicked tab
            this.classList.add('active');

            // Show corresponding pane
            const tabId = this.getAttribute('data-tab');
            const pane = document.getElementById(tabId);
            if (pane) {
                pane.style.display = 'block';
            }
        });
    });

    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const closeBtn = document.querySelector('.close-lightbox');
    const photoItems = document.querySelectorAll('.photo-item img');

    // Open lightbox when photo is clicked
    photoItems.forEach(photo => {
        photo.addEventListener('click', function() {
            lightbox.style.display = 'block';
            lightboxImg.src = this.src;
            lightboxImg.alt = this.alt;
            document.body.style.overflow = 'hidden'; // Prevent scrolling
        });
    });

    // Close lightbox when X is clicked
    if (closeBtn) {
        closeBtn.addEventListener('click', closeLightbox);
    }

    // Close lightbox when clicking outside the image
    lightbox.addEventListener('click', function(e) {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });

    // Close lightbox with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && lightbox.style.display === 'block') {
            closeLightbox();
        }
    });

    function closeLightbox() {
        lightbox.style.display = 'none';
        document.body.style.overflow = 'auto'; // Re-enable scrolling
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
    const sections = document.querySelectorAll('section');
    sections.forEach(section => {
        section.classList.add('fade-in-element');
        observer.observe(section);
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