# MergePilot console design system

Reference: `mergepilot-console-concept.png` at 1536×1024.

- **Palette:** true near-white `#f8fafc`, white surfaces, ink `#0b1526`, slate `#667085`, cyan `#0891b2`, success `#067647`, danger `#d92d20`, hairline `#d0d5dd`.
- **Type:** Inter-style system sans for interface and content; ui-monospace for hashes, tools and times. Headings use 700 weight; controls use deliberate 13–14px/600 typography.
- **Layout:** 68px ink navigation rail; 68rem maximum content; run header; seven-stage horizontal phase rail; 2fr/0.9fr evidence and decision columns; one column below 800px.
- **Containers:** open bands and lists with one main bordered evidence frame and one decision rail. No nested dashboard card grid and almost no shadow.
- **Components:** navigation icon buttons, status marker, phase nodes, text tabs, audit rows, expanded policy block, semantic diff table, check list, approval records and decision form.
- **Controls:** at least 44px; cyan active/focus treatment; explicit hover and `:focus-visible`; motion limited to row reveal and phase-node fill, disabled by `prefers-reduced-motion`.
- **Above-fold copy:** MergePilot; Fix duplicate entitlement grants; Recorded demo; Completed; Activity; Diff; Verification; Human decisions; Blocked: protected path; Plan approved; Release approved by human; Evaluation evidence.
