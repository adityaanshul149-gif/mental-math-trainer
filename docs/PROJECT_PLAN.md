# Recall product plan

## Product goal

Create a production-quality, installable recall trainer that feels natural on iPhone, works on Windows, remains useful offline, and expands beyond mental math without changing its core architecture.

## Architecture

1. **Content:** categories and flexible question/answer cards.
2. **Practice:** session rules, presentation, timing, gestures, and scoring.
3. **Learning:** per-card history, mastery, confidence, and adaptive priority.
4. **Storage:** versioned local data with backups, import, export, and migrations.

This separation keeps future subjects such as vocabulary, SQL, geometry, and general knowledge independent from the practice engine.

## Milestones and acceptance checks

### 1. Application foundation — version 0.1.0

- Responsive shell works at iPhone and Windows sizes.
- Navigation, themes, and connection status work.
- Manifest is valid and the service worker caches the app shell.
- App opens offline after one successful online load.

### 2. Library and custom content — version 0.2.0

- Default categories are available.
- Categories/cards can be created, edited, duplicated, favourited, and deleted.
- Pasted question = answer lines are previewed and imported.
- Search and useful filters work without reloading.

### 3. Practice engine — version 0.3.0

- Session builder supports categories, modes, count, and timer.
- Numeric keypad never opens the system keyboard.
- Swipe, long-press, skip, reveal, timeout, and submit work.
- Results classify Instant, Correct, Slow, Incorrect, and Timeout.

### 4. Adaptive learning — version 0.4.0

- Every card stores the requested learning and timing fields.
- Weak or overdue cards receive higher priority.
- Mastered cards remain in lower-frequency rotation.
- Session modes behave distinctly.

### 5. Insights and data safety — version 0.5.0

- Dashboard numbers match stored history.
- Performance, activity, mastery, and heatmap views work.
- Export, import, automatic local backup, restore, and reset are tested.

### 6. Production QA — version 1.0.0

- Accessibility, gestures, responsive layouts, offline behavior, migrations, and recovery pass.
- iPhone PNG icons and final PWA metadata are validated.
- Release documentation matches the product.

### 7. GitHub Pages and iPhone installation

- Repository is created and pushed with beginner-friendly commands.
- GitHub Pages succeeds over HTTPS.
- Live app is verified on Windows and Safari.
- App is installed on iPhone and opens offline.
