# MergePilot fidelity ledger

Compared at the native concept frame (1536×1024), desktop implementation viewport (1440×900), and mobile implementation viewport (390×844). Both implementation screenshots were opened at original resolution after the browser journey passed.

| Concept cue | Implemented evidence | Result |
| --- | --- | --- |
| Dark fixed navigation rail with cyan product mark | 68px ink rail on desktop; compact top rail on mobile | Matched and responsively adapted |
| Issue title, metadata, recorded/completed status above the workflow | Header preserves all four evidence groups | Matched; provider version was omitted because the replay does not measure it |
| Seven connected delivery phases | Seven numbered cyan phases, horizontally keyboard-scrollable on narrow screens | Matched with an accessibility improvement |
| Activity, Diff, and Verification evidence tabs | Keyboard-operable ARIA tabs with a semantic diff table and 12-check view | Matched |
| Expanded protected-path policy denial in the audit timeline | Blocked `apply_patch` event starts expanded and records replanning | Matched; tool names use the real MCP vocabulary |
| Plan and release approval cards | Both reviewers, timestamps, reasons, and artifact hash prefixes remain visible | Matched |
| Verification summary and evaluation handoff | Summary button changes tabs; footer deep-links to evaluation evidence | Matched |
| Desktop two-column evidence/decision composition | 2fr/.9fr grid, collapsing to one column below 800px | Matched and adapted |

## Copy differences

- Concept `fs.write`, `agent.refactor`, and `test.run` labels became the implemented MCP operations `apply_patch`, `run_check`, and `get_diff`.
- Concept date `May 12, 2025` became the fixed replay date `12 May 2026` to align with the recorded portfolio dataset.
- Concept `Release approved by human` seal became `Human release gate satisfied`; the approval card retains the original phrase while avoiding a duplicate accessible-name ambiguity.
- The concept's claim of a named orchestrator version was removed because no version report supports it.

## Verification notes

The in-app browser journey opened the blocked event, corrected diff, 12-check verification, and evaluation page. Playwright repeated it at 1440×900 and 390×844. Axe reported no WCAG A/AA violations after interactive cyan was darkened and the mobile phase scroller was made keyboard-focusable. No clipping, overlapping approval cards, broken diff lines, or horizontal page overflow was observed in the final captures.
