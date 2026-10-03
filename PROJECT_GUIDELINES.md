\# Sales Pipeline — Project Guidelines



Single source of truth for AI-assisted work on this repository. Read this file and inspect the relevant existing code before changing behavior.



This is a \*\*JavaScript\*\* (not TypeScript) Vite + React 19 frontend. There is no router, no Redux, no real backend, and no authentication.



\---



\# 1. Project Purpose



This application is a \*\*shared sales pipeline\*\* for a \~20-person sales team working against \*\*exactly 50,000 deals\*\*. It is a take-home frontend that demonstrates product thinking under load: optimistic UI, failure recovery, concurrent teammate edits, keyboard use, and kanban performance.



\*\*Who uses it:\*\* simulated salespeople and a sales manager. The current user is chosen in the header (not a login).



\*\*What problem it solves:\*\* a team sharing one pipeline needs to know which deals to work, whether a move actually saved, what teammates changed, and how to recover when the network fails — including quarter-end bulk moves of thousands of deals.



It is \*\*not\*\* a generic CRUD table. The unit of work is the \*\*stage\*\*. Moving a deal (one or many) is the primary mutation. Ownership, attention, activity, and save state exist to support that operational loop.



\---



\# 2. Product Principles



\- \*\*Fast feedback.\*\* User actions update the board immediately (optimistic UI). Saving is a state, not a spinner that freezes the page.

\- \*\*Reliable state communication.\*\* The user must always know whether a change is saving, saved, failed, or in conflict.

\- \*\*Recoverability.\*\* Failed and conflicted saves stay visible and retryable. Do not silently revert.

\- \*\*Collaboration awareness.\*\* Teammate edits are expected. Explain who changed what. Do not make cards jump without a reason.

\- \*\*Keyboard accessibility.\*\* Drag-and-drop is optional. Every important action has a non-drag path.

\- \*\*Large dataset performance.\*\* 50,000 deals and \~10,000 in a single stage must stay usable. Virtualize. Do not mount the whole board.

\- \*\*Minimal complexity.\*\* A small, well-thought-out product beats extra features.



Prioritize \*\*operational usability\*\* over decorative UI. Visual polish may improve clarity; it must not compete with deals, stage headers, and filters.



Screen priority (current product):



1\. Pipeline / deal cards

2\. Stage headers

3\. Filters / navigation

4\. Utility metrics (header Pipeline summary)



\---



\# 3. Core User Model



There is \*\*no real authentication\*\*.



\- Simulated users live in \`SWITCHABLE_USERS\` (\`src/data/constants.js\`). Default is \*\*Priya Sharma\*\*.

\- The header \*\*Switch user\*\* control sets \`currentUser\`. Each browser tab stores its own user in \`sessionStorage\` (\`sales-pipeline-current-user\`).

\- The pipeline is \*\*shared\*\*. Any simulated user may move any deal.

\- \`deal.owner\` is the salesperson \*\*responsible\*\* for the deal. It is \*\*not\*\* an edit permission.

\- \*\*Owner\*\* = who owns the relationship. \*\*Actor / editor\*\* = who performed an activity (current user or teammate name).

\- Do \*\*not\*\* add RBAC, roles-as-permissions, or “only owner can edit” unless explicitly requested.



\`OWNERS\` on deals includes names that are not in \`SWITCHABLE_USERS\`. That is fine: not every owner is a switchable demo identity.



\---



\# 4. Deal Model



Use the \*\*existing field names\*\*. Do not invent a parallel model.



\| Field | Meaning |

\| --- | --- |

\| \`id\` | String, e.g. \`deal-0\` |

\| \`company\` | Account name (shown as the card title) |

\| \`contactName\` | Primary contact (UI label: Contact) |

\| \`owner\` | Salesperson name string |

\| \`value\` | Number, INR rupees (format with existing \`formatMoney\` / \`formatMoneyCompact\`) |

\| \`stage\` | Stage \*\*id\*\*: \`new_lead\`, \`contacted\`, \`demo_done\`, \`proposal_sent\`, \`negotiation\`, \`won\`, \`lost\` |

\| \`probability\` | 0–100 integer |

\| \`expectedCloseDate\` | Timestamp (ms) |

\| \`lastContactedAt\` | Timestamp (ms) |

\| \`priority\` | \`'high'\` \\| \`'medium'\` \\| \`'low'\` |

\| \`createdAt\` | Timestamp (ms) |

\| \`closedAt\` | Timestamp or \`null\` (set when won/lost) |

\| \`version\` | Integer optimistic-lock version used by the fake API |



Normalized storage: deals live in a \*\*ref\*\* (\`dealsById\`). Column membership is \`dealIdsByStage\` in React state. Do not clone 50,000 deal objects on every move.



\---



\# 5. Pipeline Stages



Current stages (\`STAGES\` in \`src/data/constants.js\`):



\| id | Label | Role |

\| --- | --- | --- |

\| \`new_lead\` | New Lead | Newly created / unqualified |

\| \`contacted\` | Contacted | Outreach has happened |

\| \`demo_done\` | Demo Done | Product shown |

\| \`proposal_sent\` | Proposal Sent | Commercial proposal out |

\| \`negotiation\` | Negotiation | Terms in discussion |

\| \`won\` | Won | Closed-won |

\| \`lost\` | Lost | Closed-lost |



\*\*Current product rule (preserve unless explicitly asked to change):\*\* stage moves are \*\*forward-only\*\*. \`canMoveStage\` in \`src/utils/stageOrder.js\` allows a move only when the destination index is \*\*greater\*\* than the source. Backward moves are blocked in the board, drawer, table, and bulk toolbar.



Exceptions that already exist:



\- Undo of a failed or recently saved move (\`allowBackward: true\`)

\- Conflict “Use latest” applying the server stage



Normal stage movement does \*\*not\*\* use a confirmation modal. Do not reintroduce one.



Do not invent a new stage list. Seeded counts are in \`STAGE_COUNTS\` (New Lead = 10,000).



\---



\# 6. Main Views



Top nav (\`VIEWS\`): \*\*All Deals\*\*, \*\*My Deals\*\*, \*\*Needs Attention\*\*, \*\*Failed Saves\*\*.



\| View | \`view\` id | Purpose now |

\| --- | --- | --- |

\| All Deals | \`all\` | Entire shared pipeline. Board (default) or Table. |

\| My Deals | \`mine\` | Deals where \`owner === currentUser.name\`. Same board/table chrome. |

\| Needs Attention | \`attention\` | Action queue grouped by \*\*why\*\* (see §7). Not a second All Deals. |

\| Failed Saves | \`failed\` | Deals with a \`overlays.failed\` entry. Retry / Undo. |



\*\*Activity\*\* is \*\*not\*\* a nav tab. It is the header \*\*Activity\*\* popover: team-wide session events (\`activityEvents\`). The live ticker on the board is the latest teammate/user move.



\*\*My Work\*\* is \*\*not currently in the UI\*\* (removed from nav). If asked to add it, it must be \*\*current-user actions only\*\*, date-filterable, distinct from team Activity. Do not recreate it unprompted.



All Deals / My Deals may switch \*\*Board\*\* vs \*\*Table\*\*. Table is a dense paginated view of the same state (\`TABLE_PAGE_SIZES\` 10/20/50/100), not a second dataset.



Do not add views that duplicate an existing purpose.



\---



\# 7. Needs Attention UX



Needs Attention is an \*\*action queue\*\*, not a generic deal list.



Current implementation: \`AttentionTable\` reuses \`DealTable\` with \*\*reason tabs\*\* and a \*\*Why\*\* column. Exclusive category via \`getAttentionReason\` (\`src/utils/attention.js\`).



\| Category id | Label | Rule (current) |

\| --- | --- | --- |

\| \`conflict\` | Conflict requiring attention | Unresolved conflict overlay (any deal) |

\| \`failed\` | Failed save | Unresolved failed overlay (any deal) |

\| \`overdue\` | Overdue | Open, \`expectedCloseDate\` before today, and high priority \*\*or\*\* ≥ ₹10L |

\| \`closingSoon\` | Closing soon | Open, close within \*\*7\*\* days, high priority \*\*or\*\* ≥ ₹10L |

\| \`stale\` | No recent activity | Open, \`lastContactedAt\` older than \*\*14\*\* days, high priority \*\*or\*\* ≥ ₹10L |

\| \`highValue\` | High-value opportunity | Open, ≥ ₹10L \*\*and\*\* high priority, not already in a more urgent bucket |



Failed/conflict tabs appear only when count > 0. Each row must keep \*\*why\*\*, \*\*owner\*\*, and an action (open / move / retry).



Do not drop the “why” grouping. Do not make this look like All Deals with a different title.



\---



\# 8. Optimistic Update Rules



Mutation lifecycle (already implemented in \`PipelineProvider\` + \`pipelineApi\`):



1\. User action (drag, drawer Move stage, table Move to, bulk Move / Mark lost)

2\. Immediate local stage update (\`moveLocal\`)

3\. Overlay \`pending\` → UI \*\*Saving…\*\*

4\. \`pipelineApi.moveDeal\` with \`clientVersion\`

5\. Success → apply server snapshot, bump version, brief \*\*Saved\*\*, optional undo toast

6\. Network failure → automatically restore the previous stage, then overlay \`failed\`, \*\*Save failed\*\* + \*\*Retry\*\* + \*\*Undo\*\*

7\. Version mismatch → overlay \`conflicts\`, do not silently overwrite



The user must never wonder whether a change saved. On network failure, restore the card to its previous stage automatically and keep the failure visible. Retry resubmits the intended destination. Undo clears the failed-save state because the card has already been restored.



Overlays: \`pending\`, \`failed\`, \`conflicts\`, \`saved\` in \`src/store/stageLists.js\`.



\---



\# 9. Failed Save UX



Failed save is a \*\*first-class state\*\*.



\- Card: stacked \*\*Save failed\*\* banner with \*\*Retry\*\* and \*\*Undo\*\* (do not smash those actions onto one row).

\- Drawer: same retry/undo when that deal is open.

\- \*\*Failed Saves\*\* view: dedicated recovery list.

\- Needs Attention: Failed save tab when any exist.

\- Toast may notify; it is not sufficient by itself.



\*\*Retry\*\* resubmits the intended \`toStage\` from the previous stage. \*\*Undo\*\* clears the failed-save state without another server request because the card has already been restored locally.



Bulk: \*\*Retry failed\*\* resubmits only the failed subset. Successful bulk moves are \*\*not\*\* rolled back because others failed. Failed bulk moves automatically return to their previous stage and remain visible in Failed Saves.



Do not show stack traces or raw \`NETWORK\` error codes in the main UI.



\---



\# 10. Concurrent Editing / Conflict Handling



Teammate changes are expected.



\- In-tab simulation: random teammate moves when Simulation \*\*Teammate activity\*\* is on and the tab is focused.

\- Cross-tab: \`BroadcastChannel('sales-pipeline')\` in \`src/services/realtimeChannel.js\`. Incoming events are applied locally and \*\*not\*\* rebroadcast (no loops).

\- If \`server.version !== clientVersion\`, the API returns \`CONFLICT\` plus \`serverDeal\`.



Conflict UI must show:



\- Your change (local stage)

\- Latest teammate change (server stage)

\- Updated by (\`actorName\`) when known

\- \*\*Keep my change\*\* (force write) vs \*\*Use latest\*\* (apply server deal)



Do not silently overwrite the user’s in-flight change. Do not move cards with no explanation. Activity should record \`CONFLICT_DETECTED\` and \`CONFLICT_RESOLVED\`.



Evaluator shortcuts: Simulation → \*\*Simulate conflict\*\* / \*\*Simulate API failure\*\*.



\---



\# 11. Activity Model



Real session events: \`activityEvents\` in \`PipelineProvider\`, types in \`src/utils/activity.js\`.



Logged types include: \`DEAL_MOVED\`, \`DEAL_UPDATED\`, \`SAVE_FAILED\`, \`SAVE_RETRIED\`, \`CONFLICT_DETECTED\`, \`CONFLICT_RESOLVED\`, \`BULK_OPERATION_STARTED\`, \`BULK_OPERATION_COMPLETED\`, \`BULK_OPERATION_PARTIAL_FAILURE\`.



Each event has: \`id\`, \`type\`, \`dealId\`, \`dealName\`, \`actorId\`, \`actorName\`, \`timestamp\`, \`metadata\` (e.g. \`fromStage\`, \`toStage\`).



\- \*\*Header Activity\*\* = team-wide feed for this session (capped at \`ACTIVITY_LIMIT\` 150, persisted in \`sessionStorage\`).

\- \*\*Board ticker\*\* = latest move (or latest event).

\- \*\*Deal drawer Activity\*\* = real events for \*\*that deal\*\* first, then older placeholder history (calls/notes). Do not generate fake “moved to {current stage}” lines that look like real moves.



Do not log hover, focus, or selection as activity.



\---



\# 12. My Work



Intended meaning: \*\*“What work did I do?”\*\* — actions \*\*by the current simulated user\*\*, grouped by date, with presets (Today, Yesterday, Last 7 days, Last 30 days, custom range).



\*\*Current code:\*\* My Work is not mounted. Team Activity is the only live feed.



If reintroduced: filter \`activityEvents\` (or a dedicated log) by \`actorName === currentUser.name\`. Do not mix teammate events into My Work. Do not duplicate the header Activity popover.



\---



\# 13. Bulk Operations



Core feature. Select many deals → \*\*Move to…\*\* or \*\*Mark lost\*\*.



\- Eligibility still uses \`canMoveStage\` (forward-only).

\- Concurrency: \`BULK_CONCURRENCY = 10\` via \`runPool\` (\`src/utils/concurrency.js\`). Never fire thousands of requests at once.

\- Progress: selected → processing → partial success/failure → completed.

\- Example copy: “8 succeeded, 4 failed” + \*\*Retry failed\*\*.

\- Bulk jobs are \*\*not\*\* transactional. Keep successful moves.

\- Bulk snapshots are \*\*not\*\* broadcast across tabs (would stall the UI at 10k deals). That is intentional.



\---



\# 14. Bulk Toolbar UX



The toolbar \*\*always occupies space\*\* (empty or selected) so the board does not jump vertically.



Empty: compact instructional copy; Move to / Mark lost disabled.



Selected (left): count, \*\*Move to…\*\*, \*\*Mark lost\*\*.



Selected (right): \*\*Bring to top\*\* (pins selected cards to the top of each column/list \*\*on click only\*\* — selecting a card must not auto-jump), \*\*Unselect all\*\*.



Do not auto-reorder the board when the user checks a card. Pinning is an explicit action.



Do not show batching implementation details except while a bulk job is running (\`BulkProgress\`).



\---



\# 15. Keyboard Accessibility



First-class. Do not make the app mouse-only.



Current board/list:



\- Arrow keys move focus between cards / columns

\- \*\*Enter\*\* opens the deal drawer

\- \*\*Space\*\* toggles selection

\- \*\*Shift+click\*\* / shift+space range-select in a column

\- \*\*Escape\*\* closes drawer/popovers; clears selection when the drawer is closed

\- \*\*Cmd/Ctrl+A\*\* in a column selects visible ids in that column

\- Drawer \*\*Move stage\*\* and table \*\*Move to\*\* are the non-drag move paths

\- Custom Select / MultiSelect / DateRangePicker support arrow + Enter + Escape (native \`\<select>\` is not used)



Every new interactive control needs a keyboard path. Shortcuts should stay discoverable from the UI (labels, focus rings), not only a hidden cheat-sheet.



\---



\# 16. Performance Rules



Dataset: \*\*50,000\*\* deals. New Lead: \*\*10,000\*\*. This is a hard constraint.



\*\*Do not:\*\*



\- Render all cards in a column

\- Filter 50k objects on every keystroke (search is debounced \*\*200ms\*\* via \`useDebouncedValue\`)

\- Clone \`dealsById\` on each move

\- Rebuild all stage arrays with per-item splice in a loop (use \`applyMoveToStageIds\` / \`applyBulkMoveToStageIds\`)

\- Virtualize incorrectly (card estimate sizes must match real card height + gap or cards overlap / look sparse)



\*\*Do:\*\*



\- \`@tanstack/react-virtual\` per stage column and Failed Saves list

\- Paginate table views

\- Memoize \`DealCard\` and expensive derived lists

\- Keep deals in a ref; keep id lists in state

\- Batch bulk updates



Do not add libraries “for performance” without a measured need. Preserve readability.



\---



\# 17. Kanban / Board Rules



The board is the dominant UI.



Cards should show: company, value, owner, close timing, priority. Failed/conflict/saving states on the card.



Stage color is a \*\*dot / tint\*\*, not a large saturated column wash. Columns use a light mix of \`--stage\` into \`--surface\`.



Horizontal column scroll; on narrow viewports columns snap and peek. Vertical card gap is tight (\~6px). Do not restore the old large KPI card row above the board.



Drag uses \`@dnd-kit\` onto a \*\*column\*\* (stage), not a pixel index inside 10,000 cards. On narrow screens, drag uses a short press delay so the column can still scroll.



\---



\# 18. Design System



Restrained B2B SaaS. Tokens in \`src/index.css\` (\`data-theme\` light/dark). Theme: Light / Dark / System (\`ThemeProvider\`).



\- Neutral surfaces, Inter, compact controls

\- One primary accent (\`--primary\`)

\- Semantic success / warning / danger

\- Custom dropdowns (not native OS selects)

\- Toasts: top-right (bottom on small screens); success uses a green wash

\- Header \*\*Pipeline summary\*\* is a compact utility + popover (Total deals, Pipeline value, Won this month, Needs attention). Do not bring back four large KPI cards.



Avoid: gradients, large colored hero blocks, decorative charts, noisy animation, feature-creep chrome.



\---



\# 19. Deal Details



\*\*Drawer\*\* (\`DealDrawer\`), not a separate page.



Show: company (title), contact, owner, value, stage, probability, priority, expected close, last contacted, created, Move stage, Mark won / Mark lost (when \`canMoveStage\` allows), save/conflict controls, activity for this deal.



Keep the user on the pipeline. Escape / backdrop / X closes. Simulation and Activity popovers should not fight the drawer (they close each other / shift when the drawer is open).



\---



\# 20. Simulation Controls



Header \*\*Simulation\*\* popover is the evaluator/demo surface. There is no separate “Demo Mode” product.



\| Control | Current |

\| --- | --- |

\| Latency min/max | sliders; default 300–1500ms |

\| Failure rate | 0–100%; default 10% |

\| Teammate activity | on/off; default on |

\| Simulate conflict | forces a conflict overlay on a deal |

\| Simulate API failure | forces a failed save overlay |



Defaults: \`DEFAULT_SIMULATION\` in \`src/data/constants.js\`. Keep current simulation state visible on the controls themselves. Do not dump fake-API internals into the main chrome.



\---



\# 21. Cross-Tab Collaboration



\`BroadcastChannel\` is a \*\*frontend simulation\*\* of realtime, not a production WebSocket.



\- Channel name: \`sales-pipeline\`

\- Include \`actorId\` / \`actorName\` / \`sourceTabId\`

\- Ignore events from the same tab

\- Do not rebroadcast incoming events

\- Do not steal the other user’s drawer/selection context without cause

\- Bulk fan-out across tabs is intentionally omitted



\---



\# 22. Demo Mode



No standalone Demo Mode exists. Use \*\*Simulation\*\* plus the README evaluator path:



optimistic move → delayed save → failed save + retry → teammate ticker → two-tab update → simulate conflict → bulk + partial failure → 50k scale.



Do not add a wizard that blocks normal use.



\---



\# 23. Architecture Rules



Keep the current shape unless there is a concrete failure:



\| Layer | Where |

\| --- | --- |

\| UI | \`src/components/\*\*\` |

\| App shell / views | \`src/App.jsx\` |

\| State | \`src/store/PipelineProvider.jsx\` + \`pipelineContext.js\` |

\| Stage id lists | \`src/store/stageLists.js\` |

\| Pipeline API | \`src/api/pipelineApi.js\` |

\| Dataset | \`src/data/mockData.js\`, \`src/data/constants.js\` |

\| Realtime | \`src/services/realtimeChannel.js\` |

\| Domain utils | \`src/utils/\*\` |



Prefer: overlays as explicit mutation state, one fake API, one activity event model, reusable \`DealTable\` / \`DealCard\` / Select.



Avoid: Redux/Zustand, TypeScript conversion, a real backend, auth, new routing, extra state stores.



Stack already in use: React 19, Vite, \`@tanstack/react-virtual\`, \`@dnd-kit/core\`, \`lucide-react\`. Do not add packages without a clear benefit.



\---



\# 24. Scope Guardrails



Do \*\*not\*\* add unless explicitly requested:



\- Real auth, backend, database, production WebSockets

\- RBAC / billing / email / CRM integrations

\- Analytics/forecasting dashboards

\- Unrelated pages or AI features

\- A mobile-first rewrite (responsive behavior already exists; extend it, don’t replace the product)

\- Duplicate KPI dashboards, My Work, or confirmation modals that were deliberately removed



The assignment values a focused frontend product.



\---



\# 25. AI Coding Rules



1\. Inspect existing implementation first.

2\. Reuse components and utilities (\`DealTable\`, overlays, \`canMoveStage\`, \`formatMoney\`, etc.).

3\. Do not create a second source of deal truth.

4\. Do not add a library without a clear benefit.

5\. Do not restyle working architecture for taste.

6\. Preserve optimistic updates, conflicts, bulk batching, virtualization, and current-user switching.

7\. Think 50,000 deals before any new list/render.

8\. Cover loading, empty, saving, failed, retry, conflict.

9\. Keyboard path for every new control.

10\. Do not silently remove features (Failed Saves, Simulation, Activity, user switcher, table Move to, Bring to top, etc.).

11\. Do not invent requirements absent from this file or an explicit user request.

12\. If a request conflicts with these guidelines (e.g. backward stage moves vs \`canMoveStage\`), \*\*explain the conflict\*\* before implementing.



Language: \*\*JavaScript\*\*. Do not convert the app to TypeScript unprompted.



\---



\# 26. Definition of Done



A change is not done when only the happy path works. Check:



\- Happy path

\- Loading / empty

\- Optimistic pending and Saved

\- Failure + Retry + Undo where relevant

\- Conflict keep-mine / use-latest where relevant

\- Keyboard

\- 50k / virtualization (no overlapping cards, no full-column mount)

\- Responsive layout (header, filters, board snap, drawer full-width on small screens)

\- No regressions in board, table, attention, failed, bulk, activity, simulation, user switcher



For UI changes, verify in the browser (or the closest substitute) across the views that share the state you touched.



\---



\# 27. Decision Hierarchy



1\. Assignment requirements (50k, optimistic, failures, teammates, keyboard, fake API)

2\. User workflow clarity

3\. Correct state synchronization

4\. Failure recovery

5\. Performance at 50,000 deals

6\. Accessibility / keyboard

7\. Maintainability

8\. Visual polish

9\. Optional features



Do not sacrifice 1–6 for polish or extra screens.



\---



\# 28. Important Product Decisions



\- Anyone can move deals owned by someone else. Owner is informational.

\- \*\*Current app:\*\* forward-only stages (\`canMoveStage\`). Do not change directionality unless explicitly requested.

\- Normal moves: \*\*no confirmation dialog\*\*.

\- Mark lost / bulk lost is allowed when the stage move is valid; it is a primary action, not a hidden danger modal.

\- Failed saves automatically return to the previous stage and remain visibly marked as failed until Retry or Undo.

\- Concurrent edits are explainable (conflict UI + activity).

\- Activity (team) ≠ My Work (current user, if re-added) ≠ Needs Attention (queue).

\- Bulk communicates progress and partial failure; successes stay.

\- Bulk toolbar height is reserved.

\- Selected deals stay in place until \*\*Bring to top\*\*.

\- Frontend-only; fake API + BroadcastChannel.

\- Metrics live in the header Pipeline summary popover, not large KPI cards.

\- Currency is INR.



\---



\# 29. Before Changing Existing Behavior



When asked to change something:



1\. Inspect current behavior in code and UI.

2\. Ask whether it is required by the assignment or this file.

3\. Check impact on optimistic updates, conflicts, 50k performance, and keyboard.

4\. Preserve behavior unless there is a clear product reason.

5\. If the request undoes a deliberate decision (one-way stages, no move confirmation, no My Work nav, no KPI cards, reserved bulk bar), say so and wait for confirmation — unless the user was explicit.



\---



\# 30. Final AI Instruction



Treat this file as the product and engineering guardrail.



Before a significant feature:



1\. Read this file.

2\. Inspect the relevant existing code.

3\. Explain the approach briefly.

4\. Implement the \*\*smallest\*\* change that satisfies the request.

5\. Verify existing functionality still works.



Do not turn this into a generic CRM. The goal is a focused demonstration of frontend product thinking, large-data performance, optimistic UI, failure recovery, and concurrent collaboration.
