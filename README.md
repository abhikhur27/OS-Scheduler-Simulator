# CPU Scheduling Studio

Interactive CPU scheduling simulator focused on correctness, algorithm comparison, and transparent metric reporting.

## Features

- Editable process table with per-row validation.
- Algorithms:
  - First Come, First Served (FCFS)
  - Shortest Job First (SJF, non-preemptive)
  - Shortest Remaining Time First (SRTF, preemptive)
  - Round Robin (configurable quantum)
- Timeline (Gantt chart) with idle segments included.
- Workload import/export as JSON for reproducible comparisons.
- Workload CSV import for quick handoff from spreadsheet-style process tables.
- Copy Decision Brief turns the current workload fingerprint, tuned scheduler choice, and per-process outcome summary into a clipboard-ready note.
- Compare-all benchmark table across FCFS, SJF, SRTF, and RR for the same workload.
- Keyboard shortcut `C` now runs a compare-all benchmark for the current workload.
- Added a starvation-watch workload preset for contrasting long-running jobs against steady short arrivals.
- Workload fingerprint panel that estimates convoy risk, burst skew, and the likely best scheduling family before a run.
- Automatic workload coach that flags convoy pressure, response-time tradeoffs, and context-switch overhead after each run.
- Service posture board classifies whether the current scheduler is behaving more like an interactive, batch-heavy, or mixed policy.
- Policy swap board makes the stay-vs-switch recommendation explicit after a run or compare-all pass.
- Context-switch tax board reads switching overhead as a schedule share so preemption costs are visible instead of buried in the averages.
- Queue promise board translates response-time and wait pain into the kind of service promise the scheduler is actually making.
- Responsiveness split board compares whether short and long jobs are sharing first-response pain evenly or whether one class is subsidizing the other.
- Per-process metrics:
  - Completion time
  - Turnaround time
  - Waiting time
  - Response time
- Aggregate averages for quick comparison.
- Fairness spread readout to show how uneven waiting time is across the workload.
- Slowdown metric to surface which process got stretched furthest relative to its own burst time.
- Starvation watch that flags processes with severe wait-to-work imbalance.
- SLA stress board that calls out which processes violate practical interactive or batch service expectations.
- Deadline-fit board that estimates which jobs miss soft interactive or batch deadlines under the current scheduler.
- Process pressure map classifies each process as interactive-friendly, batch-heavy, balanced, or at-risk after a run.
- Tail-risk board identifies which process absorbs the worst wait pain versus the worst slowdown pain.
- Schedule rhythm board classifies whether the visible timeline behaves like long batches, balanced slices, or choppy preemption.

## Platform honesty

- Project type: Browser scheduling visualizer
- Stack truth: HTML, CSS, JavaScript
- Purpose: concept demonstration and workload comparison, not a native OS kernel scheduler
- Idle fragmentation board shows whether CPU idle time is one clean waiting block or a fragmented arrival-pattern problem.
- Preemption watch calls out when the workload actually wants interrupt-friendly scheduling rather than a simpler non-preemptive baseline.
- Round Robin quantum coach that turns the sweep table into an explicit tuning recommendation.
- Scheduler settings now stay in the shareable URL while you tune algorithm, quantum, and context-switch cost.
- Dispatch audit summarizes idle gaps, process handoffs, context-switch segments, and shortest run length after each simulation.

## Technical Design

- `index.html`: semantic app layout, controls, and output sections.
- `style.css`: responsive visual system and accessible tables.
- `script.js`: deterministic scheduling logic + rendering layer.

```mermaid
flowchart LR
  A[Input Processes] --> B[Validate]
  B --> C[Scheduling Algorithm]
  C --> D[Timeline Segments]
  C --> E[Completion and First-Start Maps]
  D --> F[Gantt Renderer]
  E --> G[Metric Calculator]
  G --> H[Results Table + Averages]
```

## Usage

1. Add or edit processes with arrival/burst values.
2. Choose an algorithm.
3. For Round Robin, set a quantum.
4. Click `Run Simulation`.

## CSV Import Shape

For spreadsheet handoffs, CSV import works best with columns in this order:

- `pid`
- `arrival`
- `burst`

Header names are preferred, but the core expectation is still one process per row with numeric arrival and burst values.

## Local Run

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Portfolio Demo Path

1. Load the `Starvation Watch Preset`.
2. Run the current scheduler, then use `Compare All`.
3. Sweep Round Robin quantums to show fairness versus overhead.
4. Copy the decision brief for a reproducible scheduler recommendation.
5. Read the tail-risk board so the demo names who actually paid for the average metric.

## Reproducible Review Flow

- Use the shareable URL when the current algorithm, quantum, context-switch cost, and workload should reopen exactly.
- Use `Copy Decision Brief` when the output needs to move into notes, Slack, or a design review.
- Use workload export plus compare-tape export when the same workload should be revisited later instead of re-entered by hand.

## GitHub Pages Compatibility

- No server/runtime dependency.
- Relative static assets only.
- Deploy by publishing repository root via GitHub Pages.

## Portfolio Positioning

- Honest label: browser-based scheduling simulator for OS concepts.
- Best demo move: compare one workload across two policies rather than narrating every board on screen.
- Current direction: protect clarity and metric trust before adding more scheduler meta-analysis.

## Future Improvements

- Priority scheduling and multilevel feedback queue.
- Context-switch overhead visualization.
- Add per-segment hover detail for timeline slices and context-switch intervals.

## Verification Matrix

Before release, validate these three workload types:

1. Convoy-heavy batch: long burst first, several short bursts later.
2. Interactive-biased: many short bursts with staggered arrivals.
3. Mixed lane: one long job plus periodic short arrivals.

Capture one `Compare All` output per workload so policy tradeoffs are documented with evidence, not just averages.

## Quick Verification Command

Run this syntax check before sharing updates:
- node --check script.js

