# Sales Pipeline

A high-scale CRM pipeline for a 20-person sales team sharing about 50,000 deals. It is a Vite + React (JavaScript) frontend with a fake API. There is no backend and no login.

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
npm run build
npm run preview
```

## What I built and why

The main screen is a **kanban board** (one column per stage). Salespeople already think in stages — New Lead through Won/Lost — so moving a card across columns matches the work.

**Table** is a secondary dense view of the same deal state (paginated, 50 rows). It is not a second copy of the data.

**Needs Attention** uses the same table as All Deals, with tabs for **Overdue**, **Closing soon**, **No recent activity**, and **High-value opportunity**. Failed saves and conflicts appear as extra tabs only when they exist. Thresholds live in [`src/utils/attention.js`](src/utils/attention.js):

- **Overdue:** open deal, `expectedCloseDate` before today, high priority or ₹10L+
- **Closing soon:** open deal, close date within the next **7** days, high priority or ₹10L+
- **No recent activity:** last contact older than **14** days, high priority or ₹10L+
- **High-value:** leftover open ₹10L+ high-priority deals not already in a more urgent bucket
- **Failed save / conflict:** unresolved overlays, any stage

**Failed Saves** is still the dedicated retry list.

You can **switch the simulated user** in the header (Priya Sharma, Rahul Mehta, and others). This is not authentication. **My Deals** follows that name. Each browser tab stores its own user in `sessionStorage`, so Tab A can be Priya and Tab B can be Rahul.

## Architecture

- **UI:** React function components and hooks. No TypeScript, no Redux, no router.
- **State:** `PipelineProvider` keeps UI state (selection, filters, overlays). Deal records live in a ref (`dealsById`) so moving one deal does not clone 50,000 objects. Column order is `dealIdsByStage`.
- **Fake API:** [`src/api/fakeApi.js`](src/api/fakeApi.js) is an in-memory server. It sleeps 300–1500ms, fails based on the Simulation slider, and stores a `version` on every deal.
- **Virtualization:** `@tanstack/react-virtual` renders only visible cards. 10,000 deals in New Lead does not mean 10,000 DOM nodes.
- **Drag and drop:** `@dnd-kit` drops onto a **column**, not a pixel-perfect index inside 10,000 cards. Stage can also be changed from the deal drawer or the Table **Move to** menu.
- **Cross-tab realtime:** [`src/services/realtimeChannel.js`](src/services/realtimeChannel.js) uses `BroadcastChannel("sales-pipeline")` because the assessment specifies that there is no backend. This is **not** a production WebSocket. Incoming events are applied locally and are **not** rebroadcast, so they cannot loop.

## Key UX decisions

- **Kanban + lists + optional table** instead of a table-only UI.
- **Optimistic moves** instead of waiting on the network. The card jumps immediately and shows Saving / Saved / Save failed.
- **Visible failure** instead of a toast-only error. Failed cards keep Retry and Undo, and appear in Failed Saves.
- **Conflicts are explicit.** If a teammate changed the same deal, the app does not silently overwrite anyone.
- **Bulk toolbar is always reserved** (same height selected or empty) so the board does not jump. Batching copy only appears while a bulk job is running. Bulk moves run 10 at a time with Retry failed. Successful bulk rows are **not** rolled back when a subset fails.
- **Keyboard path:** arrows move focus, Space selects, Enter opens the drawer, the drawer’s stage select (or Table Move to) moves the deal, Escape closes / clears selection.

## Performance

- Dataset is **exactly 50,000** deals. New Lead has **10,000**.
- Search is debounced (200ms). Filtering walks ids, not DOM.
- Columns virtualize independently. Table paginates after filters (50 rows).
- Bulk updates rebuild stage arrays once (`filter` + concat), not 10,000 splices.
- `DealCard` is memoized; only visible rows mount.

## Failure handling

1. User moves a deal → UI updates immediately (`pending` / Saving…).
2. Fake API may succeed, fail, or return a **version conflict**.
3. Success shows **Saved** briefly.
4. Failure keeps the optimistic stage and marks the deal failed. Retry resubmits without snapping the card back. Undo restores the previous stage locally (the save never landed).
5. Retry is also offered on a successful single move via the toast.

### Conflict strategy

Optimistic locking with a `version` field.

If the server version is not the version the client started with, the save is rejected. The card shows:

- Your change (local stage)
- Latest teammate change
- Updated by
- **Keep my change** (force write) or **Use latest** (discard local)

This is documented for evaluators: use **Simulation → Simulate conflict**, or open two tabs and move the same deal at once.

### Bulk partial failure

Bulk work is **not transactional**. If 9,820 of 10,000 succeed, those 9,820 stay moved. That is intentional: rolling back thousands of successful writes because 180 failed would be worse for quarter-end cleanup. **Retry failed** resubmits only the failures.

Bulk moves are not mirrored across tabs. Broadcasting 10,000 deal snapshots would stall the UI.

## Simulation / evaluator path

Header → **Simulation**:

1. Confirm the counts (50,000 total, ~10,000 in New Lead).
2. Drag one deal, or open it and use **Move stage**; watch Saving → Saved.
3. Raise **Failure rate** to 100% and move again; use **Retry**. **Simulate API failure** forces the same overlay.
4. Leave **Teammate activity** on; the ticker and **Activity** popover show moves. Automated events only fire in the focused tab, then BroadcastChannel updates the other tab.
5. Open two tabs. Switch Tab B to Rahul Mehta. Move a deal in Tab A; Tab B should update.
6. **Simulate conflict** and resolve Keep / Use latest.
7. Select several cards (Shift-click or column checkbox) and **Move to…** Watch progress. Raise failure rate and retry the failed subset.
8. Open **Activity** for the team-wide feed. Switch user and confirm **My Deals** follows the selected name.
9. Keyboard: Tab, arrows, Space, Enter, Escape. Table **Move to** does not require drag.

## Tradeoffs

Not built on purpose:

- Real login, permissions, a backend, or a WebSocket server
- Reordering inside a stage
- Phone-sized layout (desktop/tablet first)
- Full analytics / forecasting
- Mirroring bulk jobs across tabs
- Shared fake-API memory across tabs (each tab has its own in-memory server; BroadcastChannel patches the other tab’s copy)

A one-way stage rule is still in place from earlier product feedback (deals cannot move backward). Automated teammate simulation can still land on any other stage.

## What I would improve with more time

- Web Worker for first-load data generation
- Persist unsaved retries across refresh
- Column search and saved views
- Virtualize horizontal columns on very small widths
- Tests around conflict and bulk partial failure
- A 2–3 minute walkthrough recording for submission
