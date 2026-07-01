# Recall

Recall is an offline-first Progressive Web App for rapid mental-math and knowledge-recall practice. It uses plain HTML, CSS, and JavaScript—no frameworks, accounts, or external libraries.

## Current release

Version **0.3.0** includes the foundation, content library, and practice engine:

- Responsive iPhone-style interface
- Dark, light, and device-controlled themes
- Working Home, Install, and Settings navigation
- PWA manifest and service worker
- Offline app-shell caching
- Accessible keyboard navigation and reduced-motion support
- All requested default categories
- A starter library of multiplication, powers, fractions, percentages, triplets, primes, and factorials
- Create, edit, duplicate, favourite, mark for practice, and delete card controls
- Unlimited custom categories and cards within the browser's storage capacity
- Search, category filtering, and pasted-text import with preview
- Session builder with category, order, question-count, and timer controls
- Rapid-fire question screen with custom reverse-entry numeric keypad
- Skip, don't-know, reveal, swipe, and long-press interactions
- Instant, Correct, Slow, Incorrect, and Timeout results
- Saved session summaries and per-card attempt statistics

The refined adaptive algorithm, statistics dashboard, and backup tools are scheduled in later milestones.

## Open it locally

The offline worker needs a local web server. In PowerShell, open this project folder and run:

    python -m http.server 8080

Then open http://localhost:8080 in a browser.

## Privacy

Recall is designed to keep study data in the browser. Later releases add manual export and import so you control your backups.

## License

MIT. See LICENSE.
