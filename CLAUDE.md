# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Static wedding website for Jackie & Ryan's December 21st, 2025 wedding. Pure HTML/CSS/JavaScript with no build process or dependencies.

## Development Commands

### Local Development
```bash
# Start a local development server (choose one):
python3 -m http.server 8000
# OR
npx serve .
# OR
open index.html  # macOS - opens directly in browser
```

### Deployment
The site auto-deploys to GitHub Pages when changes are pushed to the `main` branch via `.github/workflows/deploy.yml`.

## Architecture

### File Structure
- **index.html**: Single-page layout with hero section, photo gallery, video embed, and RSVP link
- **script.js**: Interactive features including:
  - Lightbox gallery for photo viewing (click any photo to open)
  - Fade-in animations on scroll using Intersection Observer
  - Parallax scrolling effect on hero image
  - Smooth scroll behavior for anchor links
- **styles.css**: Responsive design with mobile-first approach, uses CSS Grid for photo gallery
- **images/**: Wedding photos and favicon

### Key Interactive Features

**Lightbox Gallery**:
- Implementation spans `script.js:1-40` (event handlers and modal control) and `index.html:89-92` (lightbox HTML structure)
- Click any photo to open, ESC or click outside to close

**Scroll Animations**:
- Intersection Observer in `script.js:61-79` adds fade-in effects to sections
- CSS classes injected dynamically at `script.js:82-94`

**Hero Section**:
- Glassmorphism effect with backdrop-filter in `styles.css:69-79`
- Parallax scrolling via transform in `script.js:96-104`

### External Integrations
- **Google Fonts**: Playfair Display (headings) and Lato (body text)
- **Vimeo**: Embedded video player at `index.html:67-73`
- **Google Forms**: RSVP link at `index.html:27`
- **Google Maps**: Venue location link at `index.html:23`

## Testing Checklist
When making changes, verify:
1. Lightbox opens/closes properly on photo click
2. Mobile responsiveness (hero box positioning, font sizes)
3. Vimeo video loads and plays
4. All external links work (RSVP, Maps)
5. GitHub Pages deployment succeeds after push to main