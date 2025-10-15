# UI Migration Guide (Bootstrap -> Tailwind Bridge)

This document outlines the phased migration strategy from legacy Bootstrap markup to Tailwind CSS utilities with a temporary bridge layer.

## 1. Goals
- Modernize design and unlock rapid iteration (utility-first + custom theme).
- Reduce CSS payload over time by purging unused Bootstrap styles.
- Avoid a big-bang rewrite: migrate module-by-module with production safety.

## 2. Stack Status
- Tailwind CSS v3.4.x installed (postcss plugins: tailwindcss + autoprefixer).
- `tailwind-bridge.css` provides transitional class mappings (.btn, grid columns, .alert-* etc.).
- Global design tokens in `src/styles.css` (CSS custom properties plus base theming).
- Bootstrap CDN still loaded in `index.html` until majority (>70%) screens migrated.

## 3. Migration Principles
1. Low risk first: start with self-contained views (verifycode, modules) before core flows (login, trabajos, usuarios).
2. Prefer direct Tailwind utilities for new markup; only keep bridge classes for untouched areas.
3. Keep PRs / commits focused: one component or view per change so rollback remains simple.
4. After converting a view, remove unused Bootstrap structural classes (row/col-*) from that template.
5. Reuse design tokens: use `var(--dr-*)` in bespoke CSS when utilities are insufficient.

## 4. Step-by-Step per Module
1. Identify template: `component.html` + optional `component.css`.
2. Snapshot: note current Bootstrap classes (navbar, row, col-md-6, btn, alert, card, etc.).
3. Replace layout:
   - Rows/cols -> CSS grid or flex utilities (`grid grid-cols-1 md:grid-cols-2`, `flex flex-wrap gap-4`).
4. Replace spacing & typography (`mb-3`, `pt-2`) -> Tailwind equivalents (`mb-4`, `py-2`). Adjust for vertical rhythm.
5. Replace components:
   - Buttons: `.btn btn-primary` -> `btn-soft-primary` (bridge) or custom `inline-flex items-center ...` utilities.
   - Alerts: `.alert.alert-danger` -> `alert-danger` (bridge) or utilities (`rounded-md bg-red-50 text-red-700 px-4 py-2`).
6. Remove any leftover Bootstrap-only wrappers (`<div class="container">` etc.) if not needed.
7. Simplify component stylesheet: delete Bootstrap overrides, keep only bespoke styles not covered by utilities.
8. Visual QA at common breakpoints (sm: 640px, md: 768px, lg: 1024px) + dark text contrast review.
9. Commit with message: `migrate(<module>): bootstrap -> tailwind utilities`.

## 5. Pattern Library Extraction (Soon)
After 4-5 modules migrated:
- Create small Angular standalone components: `UiButton`, `UiCard`, `UiBadge`, `UiAlert` using props + host classes.
- Centralize variants (primary, danger, ghost) to reduce duplication.

## 6. Bootstrap Decommission Checklist
When ≥70% templates migrated:
- Remove Bootstrap `<link>` and `<script>` from `index.html`.
- Search for remaining classes: `grep -E "\b(row|col-|container|navbar|alert-|btn|dropdown-menu)\b" src/**/*.html`.
- For each occurrence: either convert or keep a mapped bridge class.
- Delete unused bridge mappings (e.g., `.col-md-3`) if no longer referenced.
- Rebuild and compare CSS bundle size before/after (aim: gradual drop).

## 7. Tailwind Optimization
- Ensure `content` array in `tailwind.config.js` includes all template/TS paths to maximize purge.
- Avoid adding utility classes dynamically via string concatenation; prefer static class lists.
- Use `group` + `group-hover` for hover states instead of custom CSS where feasible.

## 8. Accessibility & Semantics
- Preserve semantic HTML (buttons stay `<button>`, navigation stays `<nav>`/`<ul>`).
- Ensure focus states: Tailwind ring utilities (`focus:ring-2 focus:ring-violet-500 focus:outline-none`).
- Color contrast: test primary violet (#7c3aed) on light backgrounds, adjust if < WCAG AA.

## 9. Common Utility Recipes
- Center icon circle: `grid place-items-center rounded-full w-14 h-14 shadow-card bg-white`.
- Card hover: `transition shadow-card hover:shadow-cardHover hover:-translate-y-1`.
- Responsive grid: `grid gap-6 sm:grid-cols-2 lg:grid-cols-3`.
- Button base: `inline-flex items-center gap-2 font-semibold px-4 py-2 rounded-xl transition`.

## 10. Next Targets (Order)
1. `login/` (high traffic, isolated layout)
2. `usuarios/` list + detail
3. `trabajos/` create + list
4. `register/` (complex form – convert after shared form patterns validated)

## 11. Post-Migration Cleanup
- Remove unused CSS blocks from `styles.css` that were purely Bootstrap overrides.
- Validate that form controls rely on tokens; simplify if Tailwind `form-*` plugin adopted later.
- Consider enabling Tailwind dark mode with a `.dark` class toggle for future theming.

## 12. Troubleshooting
| Issue | Cause | Fix |
|-------|-------|-----|
| Unknown `@tailwind` at-rule warning | Stylelint not aware of Tailwind | Add a stylelint config allowing Tailwind rules or ignore warnings. |
| Class not purged | File path missing in `content` | Update `tailwind.config.js` content glob. |
| Dropdown hover flicker | Gap between trigger and panel | Add `pointer-events-none` spacer or ensure panel overlaps trigger area. |

## 13. Metrics (Track Later)
- Bundle size delta after each batch of migrations.
- Count of remaining Bootstrap classes.
- Lighthouse accessibility scores.

---
Incremental, observable improvements keep risk low. Proceed with the outlined order and refine patterns as they stabilize.
