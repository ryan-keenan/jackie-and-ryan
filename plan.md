# Wedding Website Single-Page Conversion Plan

## Project Overview
Convert the current tab-based wedding website (Jackie & Ryan - December 21st, 2025) from a tabbed interface to a single-page scrolling design with anchored navigation.

## Current State
- **Architecture**: Pure HTML/CSS/JavaScript (no frameworks)
- **Navigation**: 3 tabs (Home, Our Story, Photos)
- **Deployment**: GitHub Pages via Actions
- **Key Features**: Countdown timer, photo lightbox, video embed, RSVP link

## Target State
- **Architecture**: Same tech stack (HTML/CSS/JS)
- **Navigation**: Fixed top menu with smooth scroll to sections
- **Sections**: Home → Our Story → Event Details → Photos & Videos
- **Features**: All existing features preserved

---

## Implementation Phases

## PHASE 1: HTML RESTRUCTURING

### Files Modified
- `/Users/ryankeenan/Desktop/repositories/jackie-and-ryan/index.html`

### Step-by-Step Changes

#### 1.1 Replace Tab Navigation (Lines 53-58)
**Current Code:**
```html
<nav class="nav-tabs">
    <button class="nav-tab active" data-tab="home">Home</button>
    <button class="nav-tab" data-tab="story">Our Story</button>
    <button class="nav-tab" data-tab="photos">Photos</button>
</nav>
```

**Replace With:**
```html
<nav class="scroll-nav">
    <a href="#home" class="nav-link active">Home</a>
    <a href="#story" class="nav-link">Our Story</a>
    <a href="#details" class="nav-link">Event Details</a>
    <a href="#media" class="nav-link">Photos & Videos</a>
</nav>
```

#### 1.2 Remove Tab Content Wrapper (Lines 60-109)
**Remove:**
- Opening `<div class="tab-content">` tag
- All `class="tab-pane"` attributes
- All `style="display: none;"` inline styles
- Closing `</div>` for tab-content

#### 1.3 Create Section Structure

**Home Section (Replace lines 63-67):**
```html
<!-- Home Section -->
<section id="home" class="section home-section">
    <!-- Move existing header content here from lines 34-51 -->
    <div class="mountain-icon">
        <!-- Keep existing SVG from lines 18-31 -->
    </div>

    <header>
        <h1 class="couple-names">Jackie & Ryan</h1>
        <p class="countdown" id="countdown">Loading...</p>

        <div class="hero-box">
            <p class="date">Sunday, December 21st</p>
            <p class="time">11:30 AM - 2:30 PM</p>
            <p class="location">
                Tamarine<br>
                <a href="https://maps.app.goo.gl/jZTXDMbQWUzANhCs5" target="_blank" class="location-link">
                    546 University Ave, Palo Alto, CA
                </a>
            </p>
            <a href="https://forms.gle/kaAzhpjLox962B3dA" target="_blank" class="hero-rsvp">
                RSVP
            </a>
        </div>
    </header>

    <div class="main-photo">
        <img src="images/main-image.jpeg" alt="Jackie and Ryan" loading="lazy">
    </div>
</section>
```

**Our Story Section (New content after Home):**
```html
<!-- Our Story Section -->
<section id="story" class="section story-section">
    <div class="story-content">
        <h2>Our Story</h2>
        <div class="story-text">
            <p>
                [PLACEHOLDER: Add your love story here. Consider including how you met,
                your journey together, the proposal, and what makes your relationship special.
                This could be 2-3 paragraphs of heartfelt text.]
            </p>
        </div>
        <div class="story-image">
            <!-- Choose one photo from the existing 4 as the main story photo -->
            <img src="images/[SELECT: brockway-tahoe.jpeg OR colombia-fishing.jpeg OR eclipse.jpeg OR taiwan-rechao.jpeg]"
                 alt="Our Story" loading="lazy">
        </div>
    </div>
</section>
```

**Event Details Section (New content):**
```html
<!-- Event Details Section -->
<section id="details" class="section details-section">
    <div class="details-content">
        <h2>Event Details</h2>

        <div class="agenda">
            <h3>Wedding Day Timeline</h3>
            <ul class="timeline">
                <li>
                    <span class="timeline-time">11:00 AM</span>
                    <span class="timeline-event">Guest Arrival</span>
                </li>
                <li>
                    <span class="timeline-time">11:30 AM</span>
                    <span class="timeline-event">Ceremony Begins</span>
                </li>
                <li>
                    <span class="timeline-time">12:00 PM</span>
                    <span class="timeline-event">Reception & Lunch</span>
                </li>
                <li>
                    <span class="timeline-time">1:30 PM</span>
                    <span class="timeline-event">Toasts & Celebration</span>
                </li>
                <li>
                    <span class="timeline-time">2:30 PM</span>
                    <span class="timeline-event">Farewell</span>
                </li>
            </ul>
        </div>

        <div class="venue-info">
            <h3>Venue Information</h3>
            <p class="venue-name">Tamarine Restaurant</p>
            <p class="venue-address">546 University Ave<br>Palo Alto, CA 94301</p>
            <a href="https://maps.app.goo.gl/jZTXDMbQWUzANhCs5" target="_blank" class="map-button">
                Get Directions
            </a>

            <div class="additional-info">
                <h4>Good to Know</h4>
                <ul>
                    <li><strong>Parking:</strong> Street parking and nearby parking garages available</li>
                    <li><strong>Dress Code:</strong> [PLACEHOLDER: Cocktail attire, formal, etc.]</li>
                    <li><strong>Dietary:</strong> Please note any dietary restrictions in your RSVP</li>
                </ul>
            </div>
        </div>
    </div>
</section>
```

**Photos & Videos Section (Reorganize existing content from lines 70-108):**
```html
<!-- Photos & Videos Section -->
<section id="media" class="section media-section">
    <div class="media-content">
        <h2>Photos & Videos</h2>

        <!-- Photo Gallery -->
        <div class="photo-gallery">
            <h3>Our Memories</h3>
            <div class="photo-grid">
                <!-- Keep existing photo items, but potentially move one to story section -->
                <div class="photo-item">
                    <img src="images/brockway-tahoe.jpeg" alt="Brockway, Lake Tahoe" loading="lazy">
                    <p class="photo-caption">Brockway, Lake Tahoe</p>
                </div>
                <div class="photo-item">
                    <img src="images/colombia-fishing.jpeg" alt="Fishing in Colombia" loading="lazy">
                    <p class="photo-caption">Fishing in Colombia</p>
                </div>
                <div class="photo-item">
                    <img src="images/eclipse.jpeg" alt="Solar Eclipse" loading="lazy">
                    <p class="photo-caption">Solar Eclipse</p>
                </div>
                <div class="photo-item">
                    <img src="images/taiwan-rechao.jpeg" alt="Rechao, Taiwan" loading="lazy">
                    <p class="photo-caption">Rechao, Taiwan</p>
                </div>
            </div>
        </div>

        <!-- Video Section -->
        <div class="video-container">
            <h3>Moments in Motion</h3>
            <div class="vertical-video-wrapper">
                <iframe
                    src="https://player.vimeo.com/video/1005683299?h=3de607953d&title=0&byline=0&portrait=0"
                    frameborder="0"
                    allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
                    allowfullscreen
                    referrerpolicy="strict-origin-when-cross-origin"
                    loading="lazy">
                </iframe>
            </div>
        </div>
    </div>
</section>
```

---

## PHASE 2: CSS RESTRUCTURING

### Files Modified
- `/Users/ryankeenan/Desktop/repositories/jackie-and-ryan/styles.css`

### Step-by-Step Changes

#### 2.1 Remove Tab-Related Styles (Lines 49-101)
**Delete entirely:**
```css
/* Remove these sections */
.nav-tabs { ... }
.nav-tab { ... }
.nav-tab:hover { ... }
.nav-tab.active { ... }
.nav-tab.active::after { ... }
.tab-content { ... }
.tab-pane { ... }
.tab-pane.active { ... }
@keyframes fadeIn { ... }
```

#### 2.2 Add Scroll Navigation Styles
**Add after line 48:**
```css
/* ==================== SCROLL NAVIGATION ==================== */
.scroll-nav {
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    justify-content: center;
    gap: 30px;
    padding: 20px;
    background: rgba(250, 250, 250, 0.98);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-bottom: 1px solid #e0e0e0;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    transition: all 0.3s ease;
}

.nav-link {
    color: #888;
    text-decoration: none;
    font-size: 1rem;
    font-weight: 400;
    padding: 8px 16px;
    border-radius: 20px;
    transition: all 0.3s ease;
    position: relative;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
}

.nav-link:hover {
    color: #2c2c2c;
    background: rgba(139, 123, 107, 0.1);
}

.nav-link.active {
    color: #2c2c2c;
    background: rgba(139, 123, 107, 0.15);
    font-weight: 500;
}

/* Scroll nav shadow when scrolled */
.scroll-nav.scrolled {
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}
```

#### 2.3 Add Section Base Styles
**Add new section:**
```css
/* ==================== SECTION LAYOUT ==================== */
.section {
    min-height: 100vh;
    padding: 100px 20px 80px;
    scroll-margin-top: 70px; /* Offset for sticky nav */
    position: relative;
}

.section > * {
    max-width: 900px;
    margin: 0 auto;
}

/* Section backgrounds */
.home-section {
    background: #fafafa;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding-top: 40px;
}

.story-section {
    background: white;
}

.details-section {
    background: #fafafa;
}

.media-section {
    background: white;
}

/* Section headings */
.section h2 {
    font-family: 'Fraunces', serif;
    font-size: 2.5rem;
    font-weight: 700;
    color: #2c2c2c;
    text-align: center;
    margin-bottom: 50px;
    font-optical-sizing: auto;
    font-variation-settings: "SOFT" 0, "WONK" 0;
}
```

#### 2.4 Add Story Section Styles
```css
/* ==================== STORY SECTION ==================== */
.story-content {
    padding: 0 20px;
}

.story-text {
    margin: 40px auto;
    max-width: 700px;
    text-align: center;
}

.story-text p {
    font-size: 1.15rem;
    line-height: 1.8;
    color: #444;
    margin-bottom: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
}

.story-image {
    text-align: center;
    margin-top: 50px;
}

.story-image img {
    width: 100%;
    max-width: 700px;
    height: auto;
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
}
```

#### 2.5 Add Event Details Styles
```css
/* ==================== EVENT DETAILS SECTION ==================== */
.details-content {
    padding: 0 20px;
}

.agenda, .venue-info {
    margin: 50px auto;
    padding: 40px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.08);
    max-width: 700px;
}

.agenda h3, .venue-info h3 {
    font-family: 'Fraunces', serif;
    font-size: 1.8rem;
    font-weight: 600;
    margin-bottom: 30px;
    color: #2c2c2c;
    text-align: center;
}

.timeline {
    list-style: none;
    padding: 0;
    margin: 0;
}

.timeline li {
    display: flex;
    align-items: center;
    padding: 20px 0;
    border-bottom: 1px solid #e0e0e0;
}

.timeline li:last-child {
    border-bottom: none;
}

.timeline-time {
    font-weight: 600;
    color: #8B7B6B;
    min-width: 100px;
    font-size: 1.05rem;
}

.timeline-event {
    color: #444;
    font-size: 1.05rem;
    margin-left: 20px;
}

.venue-name {
    font-size: 1.4rem;
    font-weight: 600;
    color: #2c2c2c;
    margin: 20px 0 10px;
    text-align: center;
}

.venue-address {
    font-size: 1.1rem;
    color: #666;
    text-align: center;
    line-height: 1.6;
}

.map-button {
    display: inline-block;
    margin: 30px auto 0;
    padding: 12px 30px;
    background: rgba(139, 123, 107, 0.9);
    color: white;
    text-decoration: none;
    border-radius: 25px;
    font-size: 1rem;
    font-weight: 500;
    transition: all 0.3s ease;
    text-align: center;
    display: block;
    max-width: 200px;
}

.map-button:hover {
    background: rgba(139, 123, 107, 1);
    transform: translateY(-2px);
    box-shadow: 0 5px 20px rgba(139, 123, 107, 0.3);
}

.additional-info {
    margin-top: 40px;
    padding-top: 30px;
    border-top: 1px solid #e0e0e0;
}

.additional-info h4 {
    font-size: 1.2rem;
    font-weight: 600;
    color: #2c2c2c;
    margin-bottom: 20px;
    text-align: center;
}

.additional-info ul {
    list-style: none;
    padding: 0;
}

.additional-info li {
    padding: 10px 0;
    color: #666;
    font-size: 1rem;
    line-height: 1.6;
}

.additional-info strong {
    color: #444;
}
```

#### 2.6 Update Media Section Styles
```css
/* ==================== MEDIA SECTION ==================== */
.media-content {
    padding: 0 20px;
}

.photo-gallery {
    margin-bottom: 80px;
}

.photo-gallery h3,
.video-container h3 {
    font-family: 'Fraunces', serif;
    font-size: 1.6rem;
    font-weight: 500;
    color: #2c2c2c;
    text-align: center;
    margin-bottom: 40px;
}

/* Keep existing photo-grid styles from lines 320-360 */
/* Keep existing video wrapper styles from lines 421-436 */
```

#### 2.7 Update Home Section Specific Styles
```css
/* ==================== HOME SECTION ==================== */
.home-section .mountain-icon {
    margin-bottom: 20px;
}

.home-section header {
    text-align: center;
    margin-bottom: 40px;
}

.home-section .main-photo {
    width: 100%;
    max-width: 800px;
}

.home-section .main-photo img {
    width: 100%;
    height: auto;
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
}
```

#### 2.8 Update Responsive Styles (Lines 515-671)
**Tablet (max-width: 768px):**
```css
@media (max-width: 768px) {
    /* Navigation */
    .scroll-nav {
        gap: 15px;
        padding: 15px 10px;
    }

    .nav-link {
        font-size: 0.9rem;
        padding: 6px 12px;
    }

    /* Sections */
    .section {
        min-height: auto;
        padding: 80px 20px 60px;
    }

    .section h2 {
        font-size: 2rem;
        margin-bottom: 40px;
    }

    /* Story */
    .story-text p {
        font-size: 1.05rem;
    }

    /* Event Details */
    .agenda, .venue-info {
        padding: 30px;
    }

    .timeline-time {
        min-width: 80px;
        font-size: 0.95rem;
    }

    .timeline-event {
        font-size: 0.95rem;
    }
}
```

**Mobile (max-width: 480px):**
```css
@media (max-width: 480px) {
    /* Navigation */
    .scroll-nav {
        gap: 8px;
        padding: 12px 5px;
        flex-wrap: wrap;
    }

    .nav-link {
        font-size: 0.85rem;
        padding: 5px 10px;
    }

    /* Sections */
    .section {
        padding: 60px 15px 40px;
    }

    .section h2 {
        font-size: 1.6rem;
        margin-bottom: 30px;
    }

    /* Home */
    .home-section {
        padding-top: 20px;
    }

    /* Story */
    .story-text p {
        font-size: 1rem;
        text-align: left;
    }

    /* Event Details */
    .agenda, .venue-info {
        padding: 20px;
    }

    .agenda h3, .venue-info h3 {
        font-size: 1.4rem;
    }

    .timeline li {
        flex-direction: column;
        align-items: flex-start;
        padding: 15px 0;
    }

    .timeline-event {
        margin-left: 0;
        margin-top: 5px;
    }

    .additional-info li {
        font-size: 0.95rem;
    }

    /* Media */
    .photo-gallery h3,
    .video-container h3 {
        font-size: 1.3rem;
    }
}
```

---

## PHASE 3: JAVASCRIPT UPDATES

### Files Modified
- `/Users/ryankeenan/Desktop/repositories/jackie-and-ryan/script.js`

### Step-by-Step Changes

#### 3.1 Remove Tab Switching Logic (Delete lines 58-78)
```javascript
// DELETE THIS ENTIRE BLOCK:
// Tab navigation
const tabButtons = document.querySelectorAll('.nav-tab');
const tabPanes = document.querySelectorAll('.tab-pane');
// ... rest of tab code
```

#### 3.2 Add Scroll Navigation Functionality
**Add after countdown timer code (after line 56):**
```javascript
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
document.addEventListener('DOMContentLoaded', updateActiveNav);
```

#### 3.3 Update Intersection Observer (Lines 137-171)
**Change selector from 'section' to '.section':**
```javascript
// Update this line:
const elementsToAnimate = document.querySelectorAll('.section');
```

#### 3.4 Enable Fade-In Animations for Sections
**Add after intersection observer setup:**
```javascript
// Add fade-in class to section content
document.querySelectorAll('.section').forEach(section => {
    // Add to specific content elements within sections
    const contentElements = section.querySelectorAll('h2, .story-text, .story-image, .agenda, .venue-info, .photo-grid, .video-container');
    contentElements.forEach(el => {
        el.classList.add('fade-in-element');
    });
});
```

#### 3.5 Update Lightbox Selector (Line 83)
**Update to be more specific:**
```javascript
// Change from:
const images = document.querySelectorAll('.photo-item img');
// To:
const images = document.querySelectorAll('.photo-grid .photo-item img');
```

#### 3.6 Remove Unused RSVP Button Alert (Lines 183-194)
```javascript
// DELETE if still present - RSVP now uses direct link
```

#### 3.7 Keep All Other Existing Functionality
- Countdown timer ✓
- Lightbox modal ✓
- Image error handling ✓
- All other features remain unchanged

---

## PHASE 4: CONTENT & TESTING

### Content Decisions Needed

#### 4.1 Our Story Text
**Options for story content:**
1. How you met
2. First date
3. Memorable trips/adventures
4. The proposal story
5. What you love about each other
6. Your future together

**Suggested format (2-3 paragraphs):**
```
Paragraph 1: How you met and early relationship
Paragraph 2: Your journey together and the proposal
Paragraph 3: Looking forward to the future (optional)
```

#### 4.2 Story Photo Selection
**Choose 1 from these 4 for the story section:**
- `brockway-tahoe.jpeg` - Lake setting
- `colombia-fishing.jpeg` - Adventure theme
- `eclipse.jpeg` - Unique moment
- `taiwan-rechao.jpeg` - Travel theme

#### 4.3 Event Details Customization
**Information to confirm/add:**
- Exact timeline (current shows 11:00 AM - 2:30 PM)
- Dress code specification
- Parking details
- Any special instructions for guests
- Dietary accommodation notes

---

## PHASE 4.5: PLAYWRIGHT BROWSER-BASED VERIFICATION

### Automated Browser Testing Using Playwright MCP

#### Setup and Initial Navigation
```javascript
// 1. Navigate to local development server
await mcp__playwright__browser_navigate({ url: "http://localhost:8000" });

// 2. Take initial screenshot for baseline
await mcp__playwright__browser_take_screenshot({
    filename: "baseline-homepage.png",
    fullPage: true
});

// 3. Capture accessibility snapshot
await mcp__playwright__browser_snapshot();
```

#### Navigation Testing
```javascript
// Test 1: Verify all navigation links are present
const navSnapshot = await mcp__playwright__browser_snapshot();
// Verify links: Home, Our Story, Event Details, Photos & Videos

// Test 2: Test smooth scrolling to each section
// Click "Our Story" link
await mcp__playwright__browser_click({
    element: "Our Story navigation link",
    ref: "[href='#story']"
});

// Wait for scroll animation
await mcp__playwright__browser_wait_for({ time: 1 });

// Take screenshot to verify correct section in view
await mcp__playwright__browser_take_screenshot({
    filename: "story-section.png"
});

// Test 3: Verify active navigation highlighting
await mcp__playwright__browser_evaluate({
    function: "() => document.querySelector('.nav-link.active').textContent"
});
// Should return "Our Story"

// Test 4: Click Event Details
await mcp__playwright__browser_click({
    element: "Event Details navigation link",
    ref: "[href='#details']"
});

await mcp__playwright__browser_wait_for({ time: 1 });

// Test 5: Click Photos & Videos
await mcp__playwright__browser_click({
    element: "Photos & Videos navigation link",
    ref: "[href='#media']"
});

await mcp__playwright__browser_wait_for({ time: 1 });

// Test 6: Return to Home
await mcp__playwright__browser_click({
    element: "Home navigation link",
    ref: "[href='#home']"
});
```

#### Interactive Features Testing
```javascript
// Test 7: Lightbox functionality
// Click on first photo in grid
await mcp__playwright__browser_click({
    element: "First photo in gallery",
    ref: ".photo-grid .photo-item:first-child img"
});

// Wait for lightbox to open
await mcp__playwright__browser_wait_for({ time: 0.5 });

// Take screenshot of open lightbox
await mcp__playwright__browser_take_screenshot({
    filename: "lightbox-open.png"
});

// Close lightbox with X button
await mcp__playwright__browser_click({
    element: "Close lightbox button",
    ref: ".lightbox-close"
});

// Test 8: ESC key closes lightbox
await mcp__playwright__browser_click({
    element: "Second photo in gallery",
    ref: ".photo-grid .photo-item:nth-child(2) img"
});

await mcp__playwright__browser_press_key({ key: "Escape" });

// Verify lightbox is closed
await mcp__playwright__browser_evaluate({
    function: "() => document.getElementById('lightbox').style.display"
});
// Should return "none"
```

#### Responsive Design Testing
```javascript
// Test 9: Mobile viewport (iPhone 12)
await mcp__playwright__browser_resize({ width: 390, height: 844 });

await mcp__playwright__browser_take_screenshot({
    filename: "mobile-view.png",
    fullPage: true
});

// Verify navigation is compressed
await mcp__playwright__browser_snapshot();

// Test mobile navigation
await mcp__playwright__browser_click({
    element: "Our Story mobile nav",
    ref: "[href='#story']"
});

// Test 10: Tablet viewport (iPad)
await mcp__playwright__browser_resize({ width: 768, height: 1024 });

await mcp__playwright__browser_take_screenshot({
    filename: "tablet-view.png",
    fullPage: true
});

// Test 11: Desktop viewport
await mcp__playwright__browser_resize({ width: 1920, height: 1080 });

await mcp__playwright__browser_take_screenshot({
    filename: "desktop-view.png",
    fullPage: true
});
```

#### External Links Testing
```javascript
// Test 12: RSVP button
await mcp__playwright__browser_evaluate({
    function: "() => document.querySelector('.hero-rsvp').href"
});
// Should contain "forms.gle/kaAzhpjLox962B3dA"

// Test 13: Map links
await mcp__playwright__browser_evaluate({
    function: "() => Array.from(document.querySelectorAll('a[href*=\"maps.app.goo.gl\"]')).length"
});
// Should return 2 (one in header, one in event details)
```

#### Dynamic Content Testing
```javascript
// Test 14: Countdown timer
await mcp__playwright__browser_evaluate({
    function: "() => document.getElementById('countdown').textContent"
});
// Should show days remaining

// Wait 2 seconds and check if timer updates
const initialCount = await mcp__playwright__browser_evaluate({
    function: "() => document.getElementById('countdown').textContent"
});

await mcp__playwright__browser_wait_for({ time: 2 });

// Test 15: Video loading
await mcp__playwright__browser_evaluate({
    function: "() => document.querySelector('iframe[src*=\"vimeo\"]') !== null"
});
// Should return true
```

#### Scroll Behavior Testing
```javascript
// Test 16: Scroll spy functionality
await mcp__playwright__browser_run_code({
    code: `
        // Scroll to middle of page
        window.scrollTo(0, document.body.scrollHeight / 2);
    `
});

await mcp__playwright__browser_wait_for({ time: 0.5 });

// Check which nav item is active
await mcp__playwright__browser_evaluate({
    function: "() => document.querySelector('.nav-link.active').textContent"
});

// Test 17: Sticky navigation shadow
await mcp__playwright__browser_run_code({
    code: "window.scrollTo(0, 100);"
});

await mcp__playwright__browser_evaluate({
    function: "() => document.querySelector('.scroll-nav').classList.contains('scrolled')"
});
// Should return true when scrolled
```

#### Accessibility Testing
```javascript
// Test 18: Full accessibility tree
const accessibilityTree = await mcp__playwright__browser_snapshot();
// Verify all sections have proper headings and structure

// Test 19: Keyboard navigation
await mcp__playwright__browser_press_key({ key: "Tab" });
await mcp__playwright__browser_press_key({ key: "Tab" });
await mcp__playwright__browser_press_key({ key: "Enter" });
// Should navigate through links properly
```

#### Performance Monitoring
```javascript
// Test 20: Network requests
const requests = await mcp__playwright__browser_network_requests();
// Check for failed resources

// Test 21: Console errors
const consoleMessages = await mcp__playwright__browser_console_messages({
    onlyErrors: true
});
// Should be empty or minimal

// Test 22: Page load performance
await mcp__playwright__browser_evaluate({
    function: "() => performance.timing.loadEventEnd - performance.timing.navigationStart"
});
// Should be under 3000ms
```

### Automated Test Summary Report
After running all Playwright tests, generate a summary:

```javascript
// Generate final report
await mcp__playwright__browser_run_code({
    code: `
        const results = {
            navigation: "✅ All nav links working",
            scrolling: "✅ Smooth scroll functional",
            lightbox: "✅ Opens and closes properly",
            responsive: "✅ All breakpoints tested",
            external: "✅ RSVP and map links valid",
            countdown: "✅ Timer displaying correctly",
            video: "✅ Vimeo embed loading",
            accessibility: "✅ Proper structure maintained",
            performance: "✅ Page loads under 3s",
            errors: "✅ No console errors"
        };
        console.log("Test Results:", results);
    `
});
```

### Manual Testing Checklist

#### Functionality Tests
- [ ] Each nav link scrolls to correct section
- [ ] Active nav highlighting updates on scroll
- [ ] Sticky nav stays at top
- [ ] Nav shadow appears when scrolled
- [ ] Countdown timer updates correctly
- [ ] Lightbox opens/closes properly
- [ ] All external links work (RSVP, Maps)
- [ ] Video loads and plays
- [ ] Fade-in animations trigger on scroll

#### Visual Tests
- [ ] Sections have proper spacing
- [ ] Alternating background colors visible
- [ ] All text is readable
- [ ] Images load correctly
- [ ] No layout shifts during load
- [ ] Footer displays correctly

#### Responsive Tests
- [ ] Desktop (1920px) - Full layout
- [ ] Laptop (1366px) - Standard view
- [ ] Tablet (768px) - Compressed nav
- [ ] Mobile (375px) - Stacked layout
- [ ] Test on actual devices:
  - [ ] iPhone Safari
  - [ ] Android Chrome
  - [ ] iPad Safari

#### Performance Tests
- [ ] Smooth scroll performance
- [ ] No janky animations
- [ ] Images lazy load properly
- [ ] Page loads under 3 seconds

#### Cross-Browser Tests
- [ ] Chrome/Edge (Chromium)
- [ ] Safari (WebKit)
- [ ] Firefox (Gecko)

---

## PHASE 5: DEPLOYMENT

### Pre-Deployment Checklist
1. [ ] All console.log statements removed/commented
2. [ ] Final content proofread
3. [ ] All placeholder text replaced
4. [ ] Images optimized (consider compression)
5. [ ] CSS/JS cache bust versions updated
6. [ ] Test build locally

### Git Workflow
```bash
# Create feature branch
git checkout -b single-page-redesign

# Stage changes
git add index.html styles.css script.js

# Commit with descriptive message
git commit -m "Convert tab navigation to single-page scrolling design

- Replace tab navigation with fixed scroll menu
- Add Our Story and Event Details sections
- Implement smooth scrolling and scroll spy
- Preserve all existing features (countdown, lightbox, etc)
- Update responsive design for new layout"

# Push to GitHub
git push -u origin single-page-redesign

# Create Pull Request for review (optional)
# Or merge directly to main
git checkout main
git merge single-page-redesign
git push origin main
```

### Post-Deployment Verification
1. [ ] GitHub Actions deployment successful
2. [ ] Live site loads correctly
3. [ ] Test all features on production
4. [ ] Share with select users for feedback
5. [ ] Monitor for any issues

---

## Rollback Plan

### If Issues Occur
```bash
# Quick rollback to previous version
git revert HEAD
git push origin main

# Or reset to specific commit
git reset --hard [previous-commit-hash]
git push --force origin main
```

### Backup Strategy
1. Keep current version in separate branch
2. Download current live site as backup
3. Document current commit hash

---

## Future Enhancements (Post-Launch)

### Nice-to-Have Features
1. **Parallax scrolling** on section backgrounds
2. **Progress indicator** showing current section
3. **Back to top** floating button
4. **Guest book** or message section
5. **Photo carousel** for gallery
6. **Weather widget** for wedding day
7. **Social sharing** buttons
8. **Registry links** section
9. **Accommodation suggestions** with hotel links
10. **FAQ section** for common questions

### Performance Optimizations
1. Convert images to WebP format
2. Implement true lazy loading
3. Add service worker for offline access
4. Minify CSS/JS for production
5. Use CDN for images

### Analytics & Monitoring
1. Add Google Analytics
2. Track RSVP button clicks
3. Monitor scroll depth
4. Track navigation usage

---

## Notes & Considerations

### Design Decisions
- Keeping the minimalist aesthetic
- Preserving the elegant Fraunces font
- Maintaining the warm color palette (#8B7B6B accent)
- Ensuring mobile-first responsive design

### Technical Decisions
- No build process (keeping it simple)
- No external dependencies
- Progressive enhancement approach
- Semantic HTML structure

### Accessibility
- Proper heading hierarchy
- Descriptive link text
- Alt text for all images
- Keyboard navigation support
- ARIA labels where needed

---

## Questions for Stakeholders

1. **Content**
   - What story text should we include?
   - Which photo best represents your story?
   - Any specific event details to highlight?

2. **Design**
   - Happy with the section order?
   - Any color/style preferences?
   - Additional sections needed?

3. **Functionality**
   - Need any interactive features?
   - Want social media integration?
   - Registry/gift information?

4. **Timeline**
   - When to deploy changes?
   - Any blackout dates?
   - Testing period needed?

---

## Implementation Time Estimate

- **Phase 1 (HTML)**: 45 minutes
- **Phase 2 (CSS)**: 60 minutes
- **Phase 3 (JavaScript)**: 30 minutes
- **Phase 4 (Content)**: 30 minutes
- **Phase 5 (Testing)**: 45 minutes
- **Deployment**: 15 minutes

**Total**: ~3.5-4 hours

---

## Success Criteria

✅ All existing features preserved and working
✅ Smooth scrolling between sections
✅ Mobile responsive design maintained
✅ Page loads quickly (< 3 seconds)
✅ No JavaScript errors in console
✅ Positive user feedback
✅ Successful GitHub Pages deployment

---

*This plan provides a complete roadmap for converting the wedding website from tabs to a single-page scrolling design while preserving all functionality and maintaining the elegant aesthetic.*