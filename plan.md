# Mobile Responsiveness Optimization Plan

## Current Issue Analysis

### Primary Problem
On mobile devices, the translucent info box in the hero section covers the main photo, obscuring the couple's faces and important visual content. This creates poor user experience on smaller screens.

### Root Causes
1. Fixed positioning of `.hero-content` not adapting to mobile viewport constraints
2. Insufficient vertical spacing calculations for small screens
3. Overlay box height competing with limited mobile screen real estate
4. Background image aspect ratio not optimized for mobile portrait orientation

## Implementation Strategy

### Phase 1: Hero Section Mobile Layout Redesign

#### 1.1 Mobile-First Approach for Hero Content
- **Current State**: Info box positioned with `bottom: 18%` which doesn't scale properly
- **Solution**:
  - Create mobile-specific layout where info box is positioned below the image
  - Use CSS Grid or Flexbox to stack hero image and content vertically on mobile
  - Breakpoint: `@media (max-width: 768px)`

#### 1.2 Image Optimization for Mobile
- **Current State**: Fixed background image that gets cropped unpredictably
- **Solution**:
  - Use `object-fit: cover` with focal point adjustment
  - Consider art direction with different image crop for mobile
  - Ensure faces remain visible in mobile viewport

#### 1.3 Typography and Spacing Adjustments
- **Current State**: Font sizes and padding not optimized for small screens
- **Solution**:
  - Reduce font sizes: h1 from 4rem to 2.5rem on mobile
  - Decrease padding: 40px to 20px for mobile containers
  - Adjust line-height for better readability

### Phase 2: Navigation and Interactive Elements

#### 2.1 Sticky Navigation Enhancement
- Ensure `.scroll-nav` doesn't overlap content on mobile
- Reduce nav height from 60px to 50px on mobile
- Implement hamburger menu if nav items overflow

#### 2.2 Touch-Friendly Interactions
- Increase tap target sizes to minimum 44x44px
- Add touch-specific event handlers for lightbox swipe gestures
- Improve button spacing for thumb reach

### Phase 3: Gallery and Media Optimization

#### 3.1 Photo Grid Responsive Layout
- Adjust from 3 columns to 2 columns at 768px breakpoint
- Single column layout at 480px breakpoint
- Maintain aspect ratios while scaling

#### 3.2 Lightbox Mobile Experience
- Implement swipe gestures for previous/next navigation
- Optimize video sizing for mobile landscape/portrait
- Add pinch-to-zoom for photos

## Testing Plan with Playwright MCP

### Test Environment Setup
```javascript
// Test at multiple mobile viewport sizes
const viewports = [
  { name: 'iPhone 14 Pro', width: 393, height: 852 },
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'Samsung Galaxy S21', width: 360, height: 800 },
  { name: 'iPad Mini', width: 768, height: 1024 }
];
```

### Test Suite 1: Hero Section Visibility

#### Test 1.1: Photo Visibility Check
1. Navigate to site at each viewport size
2. Take screenshot of hero section
3. Verify info box doesn't overlap faces
4. Measure distance between photo bottom and info box top

```javascript
// Playwright test implementation
await mcp__playwright__browser_navigate({ url: 'http://localhost:8000' });
await mcp__playwright__browser_resize({ width: 393, height: 852 });
await mcp__playwright__browser_take_screenshot({
  filename: 'mobile-hero-iphone14.png',
  fullPage: false
});
await mcp__playwright__browser_evaluate({
  function: '() => {
    const heroContent = document.querySelector(".hero-content");
    const mainPhoto = document.querySelector(".main-photo img");
    const contentRect = heroContent.getBoundingClientRect();
    const photoRect = mainPhoto.getBoundingClientRect();
    return {
      overlap: contentRect.top < photoRect.bottom,
      overlapAmount: photoRect.bottom - contentRect.top
    };
  }'
});
```

#### Test 1.2: Content Readability
1. Verify all text is readable without horizontal scrolling
2. Check font sizes meet minimum accessibility standards
3. Ensure adequate color contrast on translucent backgrounds

### Test Suite 2: Navigation Functionality

#### Test 2.1: Scroll Navigation
1. Click each nav item and verify smooth scroll
2. Check active state updates correctly
3. Verify nav doesn't cover content when sticky

```javascript
// Test navigation clicks
await mcp__playwright__browser_click({
  element: 'Our Story navigation link',
  ref: 'a[href="#story"]'
});
await mcp__playwright__browser_wait_for({ time: 1 });
await mcp__playwright__browser_evaluate({
  function: '() => {
    const storySection = document.getElementById("story");
    const nav = document.querySelector(".scroll-nav");
    const rect = storySection.getBoundingClientRect();
    return rect.top <= nav.offsetHeight + 10;
  }'
});
```

### Test Suite 3: Interactive Elements

#### Test 3.1: Lightbox on Mobile
1. Open photo lightbox by clicking gallery item
2. Test swipe gestures for navigation (if implemented)
3. Verify close button is accessible
4. Check video playback on mobile

```javascript
// Test lightbox interaction
await mcp__playwright__browser_click({
  element: 'First photo in gallery',
  ref: '.photo-grid .photo-item:first-child img'
});
await mcp__playwright__browser_wait_for({ text: 'of 18' });
await mcp__playwright__browser_click({
  element: 'Next button in lightbox',
  ref: '#lightbox-next'
});
await mcp__playwright__browser_evaluate({
  function: '() => {
    const counter = document.getElementById("lightbox-counter");
    return counter.textContent.includes("2 of");
  }'
});
```

#### Test 3.2: Video Gallery
1. Click video thumbnail
2. Verify video loads and centers properly
3. Test fullscreen mode on mobile
4. Confirm close functionality

### Test Suite 4: Performance Metrics

#### Test 4.1: Load Time Analysis
1. Measure First Contentful Paint (FCP)
2. Check Largest Contentful Paint (LCP)
3. Verify Cumulative Layout Shift (CLS) < 0.1

```javascript
// Performance monitoring
await mcp__playwright__browser_evaluate({
  function: '() => {
    return performance.getEntriesByType("paint").map(entry => ({
      name: entry.name,
      startTime: entry.startTime
    }));
  }'
});
```

### Test Suite 5: Cross-Device Validation

#### Test 5.1: Orientation Changes
1. Test portrait to landscape transitions
2. Verify layout adapts without breaking
3. Check that no content is cut off

```javascript
// Test orientation change
await mcp__playwright__browser_resize({ width: 852, height: 393 }); // Landscape
await mcp__playwright__browser_take_screenshot({
  filename: 'mobile-landscape.png',
  fullPage: true
});
```

## Success Criteria

### Must Have (P0)
- [ ] Info box never covers faces in hero photo on any tested device
- [ ] All text remains readable without horizontal scrolling
- [ ] Navigation functions correctly on all screen sizes
- [ ] Lightbox opens and closes properly on mobile
- [ ] Videos play and display correctly

### Should Have (P1)
- [ ] Touch gestures work smoothly in lightbox
- [ ] Page loads in under 3 seconds on 3G connection
- [ ] All interactive elements meet 44x44px tap target size
- [ ] Smooth scrolling works on all devices

### Nice to Have (P2)
- [ ] Swipe navigation in lightbox
- [ ] Lazy loading for images below fold
- [ ] Haptic feedback on button presses (iOS)
- [ ] Progressive Web App capabilities

## Implementation Order

1. **Immediate Fix** (5 mins)
   - Add mobile-specific CSS to move hero content below photo at 768px breakpoint

2. **Core Mobile Layout** (30 mins)
   - Implement responsive hero section
   - Adjust typography scales
   - Fix navigation spacing

3. **Testing & Validation** (20 mins)
   - Run Playwright test suite
   - Capture screenshots for review
   - Verify on actual devices if available

4. **Enhancement Phase** (15 mins)
   - Add touch gestures
   - Optimize images
   - Fine-tune animations

## CSS Changes Preview

```css
/* Mobile-first hero section fix */
@media (max-width: 768px) {
  .hero-container {
    display: flex;
    flex-direction: column;
  }

  .main-photo {
    height: 60vh;
    position: relative;
  }

  .hero-overlay {
    position: relative;
    height: auto;
  }

  .hero-content {
    position: relative;
    bottom: auto;
    transform: none;
    margin: 20px;
    padding: 20px;
  }

  .couple-names {
    font-size: 2.5rem;
  }

  .wedding-date {
    font-size: 1rem;
  }
}

/* Touch-friendly buttons */
@media (max-width: 768px) {
  .hero-rsvp,
  .map-button {
    min-height: 44px;
    padding: 12px 24px;
  }

  .lightbox-prev,
  .lightbox-next {
    width: 50px;
    height: 50px;
  }
}
```

## Rollback Plan

If any changes cause regression:
1. Git revert to previous commit
2. Re-apply fixes incrementally
3. Test each change in isolation
4. Deploy only validated changes

## Monitoring Post-Deploy

1. Check GitHub Pages deployment status
2. Test on real devices via BrowserStack or physical devices
3. Monitor Google Analytics for bounce rate changes
4. Collect user feedback via RSVP form comments