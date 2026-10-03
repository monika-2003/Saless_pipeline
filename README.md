# Sales Pipeline

A high-scale CRM pipeline for a 20-person sales team sharing about 50,000 deals. It is a Vite + React (JavaScript) frontend with an in-memory pipeline API. There is no backend and no login.

The product answers the problems in the assignment:

- “I don’t know which deals to work on today.”
- “I moved a deal, but it didn’t save, and nobody told me.”
- “Deals keep jumping around because teammates are editing at the same time.”
- “At quarter end I need to move thousands of old deals to Lost.”
- “I can’t use a mouse for long.”

## Running locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). Open a second tab of the same URL to demo cross-tab teammate updates.

```bash
npm test
npm run build
npm run preview
```

`npm test` runs Vitest (jsdom). Conflict, bulk partial failure, persistence, and stage-order cases live under `src/**/*.test.js` and `src/**/*.test.jsx`.

## What I built and why

The main screen is a **kanban board** (one column per stage). Salespeople already think in stages — New Lead through Won/Lost — so moving a card across columns matches the work.

**Table** is a secondary dense view of the same deal state (paginated, 10 / 20 / 50 / 100 rows). It is not a second copy of the data.

**Needs Attention** uses the same table as All Deals, with tabs for **Overdue**, **Closing soon**, **No recent activity**, and **High-value opportunity**. Failed saves and conflicts appear as extra tabs only when they exist. Thresholds live in [`src/utils/attention.js`](src/utils/attention.js):

- **Overdue:** open deal, `expectedCloseDate` before today, high priority or ₹10L+
- **Closing soon:** open deal, close date within the next **7** days, high priority or ₹10L+
- **No recent activity:** last contact older than **14** days, high priority or ₹10L+
- **High-value:** leftover open ₹10L+ high-priority deals not already in a more urgent bucket
- **Failed save / conflict:** unresolved overlays, any stage

**Failed Saves** is a dedicated recovery **table** (same `DealTable` chrome as Needs Attention), grouped by the deal’s current stage. Select rows, retry one deal, or **Retry** the selected subset. Each row explains the intended destination (“Could not save move to Lost”).

You can **switch the simulated user** in the header (Priya Sharma, Rahul Mehta, and others). This is not authentication. **My Deals** follows that name. Each browser tab stores its own user in `sessionStorage`, so Tab A can be Priya and Tab B can be Rahul.

**Priority** is a seeded field on each deal (about 18% high, 37% medium, 45% low). It is not derived from value or close date. Filters and Needs Attention read that stored value.

Stage moves are **forward-only**. A deal cannot go back to an earlier stage except Undo and conflict “Use latest”.

## Architecture

- **UI:** React function components and hooks. No TypeScript, no Redux, no router.
- **State:** `PipelineProvider` keeps UI state (selection, filters, overlays). Deal records live in a ref (`dealsById`) so moving one deal does not clone 50,000 objects. Column order is `dealIdsByStage`.
- **Pipeline API:** [`src/api/pipelineApi.js`](src/api/pipelineApi.js) is an in-memory server. It sleeps 300–1500ms, fails based on the Simulation slider, and stores a `version` on every deal.
- **Persistence:** [`src/utils/pipelinePersist.js`](src/utils/pipelinePersist.js) stores the generation seed plus compact deal patches (`stage`, `version`, `probability`, `closedAt`) in `localStorage`. Reload keeps moved deals. **Simulation → Reset demo data** regenerates the original 50,000 from the same seed.
- **Virtualization:** `@tanstack/react-virtual` renders only visible cards. 10,000 deals in New Lead does not mean 10,000 DOM nodes.
- **Drag and drop:** `@dnd-kit` drops onto a **column**, not a pixel-perfect index inside 10,000 cards. Stage can also be changed from the deal drawer or the Table **Move to** menu.
- **Cross-tab realtime:** [`src/services/realtimeChannel.js`](src/services/realtimeChannel.js) uses `BroadcastChannel("sales-pipeline")` because the assessment specifies that there is no backend. This is **not** a production WebSocket. Incoming events are applied locally and are **not** rebroadcast, so they cannot loop.

## Key UX decisions

- **Kanban + lists + optional table** instead of a table-only UI.
- **Optimistic moves** instead of waiting on the network. The card jumps to the destination immediately and shows Saving / Saved. If the save fails or conflicts, the card **returns to the previous stage** and keeps Retry / Undo (or Keep my change / Use latest).
- **Visible failure** instead of a toast-only error. Failed cards stay on the source stage, show Retry and Undo, and appear in Failed Saves.
- **Conflicts are explicit.** If a teammate changed the same deal, the app does not silently overwrite anyone. **Updated by** is a real owner name (for example Vikram Singh), not “A teammate”. The teammate’s conflicting stage is always **later** than the deal’s current stage.
- **Bulk toolbar is always reserved** (same height selected or empty) so the board does not jump. The progress bar only appears while a bulk job is running and disappears when it finishes. Bulk moves run 10 at a time. Successful bulk rows are **not** rolled back when a subset fails.
- **Selection follows filters.** Checking a column, then narrowing Owner / Priority / Stage, prunes the selection to deals still on screen. Owner and Priority filters include **Select all**.
- **Keyboard path:** arrows move focus, Space selects, Enter opens the drawer, the drawer’s stage select (or Table Move to) moves the deal, Escape closes / clears selection.

## Performance

- Dataset is **exactly 50,000** deals. New Lead has **10,000**.
- Search is debounced (200ms). Filtering walks ids, not DOM.
- Columns virtualize independently. Table paginates after filters (10 / 20 / 50 / 100 rows).
- Bulk updates rebuild stage arrays once (`filter` + concat), not 10,000 splices.
- `DealCard` is memoized; only visible rows mount.

## Failure handling

1. User moves a deal → the card moves to the destination immediately (`pending` / Saving…).
2. Pipeline API may succeed, fail, or return a **version conflict**.
3. Success applies the server snapshot and shows **Saved** briefly. Saved is a confirmation, not a lock — the deal can move again.
4. Network failure **moves the card back** to the previous stage and marks it failed. Retry resubmits the intended destination. Undo clears the failed-save state after the card has already been restored to its previous stage.
5. The same fail-back applies to bulk: successes stay on the new stage; failures return to the source stage.
6. Undo is also offered on a successful single move via the toast when available.

### Conflict strategy

Optimistic locking with a `version` field.

If the server version is not the version the client started with, the save is rejected. The card returns to the previous stage and shows:

- Your change (the stage you tried)
- Latest teammate change (a **later** stage than the deal was on)
- Updated by (a name from the owner list)
- **Keep my change** (force write) or **Use latest** (discard local)

This is documented for evaluators: arm **Simulate conflict** on selected or open deals, then Move to… / Mark lost, or open two tabs and move the same deal at once.

### Bulk partial failure

Bulk work is **not transactional**. If 9,820 of 10,000 succeed, those 9,820 stay moved. Failures return to the previous stage and show in Failed Saves. That is intentional: rolling back thousands of successful writes because 180 failed would be worse for quarter-end cleanup. **Retry failed** (toolbar or Failed Saves) resubmits only the failures.

Bulk moves are not mirrored across tabs. Broadcasting 10,000 deal snapshots would stall the UI.

## Simulation / evaluator path

Header → **Simulation**, or the buttons on an open deal drawer:

1. Confirm the counts (50,000 total, ~10,000 in New Lead).
2. Drag one deal, or open it and use **Move stage**; watch Saving → Saved.
3. **Arm, then move.** Select deals on the board **or** open a single deal. Click **Simulate conflict** or **Simulate API failure**. Nothing fails yet. Then choose **Move to…**, **Move stage**, or **Mark lost**. The queued error fires on that next save.
4. Raise **Failure rate** to 100% and move again; use **Retry**. The deal should sit on the previous stage while failed.
5. Leave **Teammate activity** on; the ticker and **Activity** popover show moves. Automated events only fire in the focused tab, then BroadcastChannel updates the other tab. Simulated teammate moves are forward-only.
6. Open two tabs. Switch Tab B to Rahul Mehta. Move a deal in Tab A; Tab B should update.
7. Select several cards (Shift-click or column checkbox) and **Move to…**. Watch progress, then confirm the bar disappears when the job finishes. Raise failure rate and retry the failed subset from the toolbar or **Failed Saves**.
8. Reload the page: moved deals stay. **Reset demo data** restores the original 50,000.
9. Open **Activity** for the team-wide feed. Switch user and confirm **My Deals** follows the selected name.
10. Keyboard: Tab, arrows, Space, Enter, Escape. Table **Move to** does not require drag.

## Tradeoffs

Not built on purpose:

- Real login, permissions, a backend, or a WebSocket server
- Reordering inside a stage
- Full analytics / forecasting
- Mirroring bulk jobs across tabs
- Shared pipeline-API memory across tabs (each tab has its own in-memory server; BroadcastChannel patches the other tab’s copy)
- Persisting in-flight overlays (failed / pending / conflict) across refresh — deal stage patches persist; retry banners do not

A one-way stage rule is in place: deals cannot move backward. Automated teammate simulation and conflict “other stage” picks also stay forward-only.

## What I would improve with more time

- Web Worker for first-load data generation
- Persist unsaved retries / conflict banners across refresh
- Column search and saved views
- Virtualize horizontal columns on very small widths
- A 2–3 minute walkthrough recording for submission
