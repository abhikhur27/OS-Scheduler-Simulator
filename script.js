const processBody = document.getElementById('process-body');
const addProcessBtn = document.getElementById('add-process');
const randomWorkloadBtn = document.getElementById('random-workload');
const runButton = document.getElementById('run-sim');
const exportCsvButton = document.getElementById('export-csv');
const compareAllButton = document.getElementById('compare-all');
const sweepRrButton = document.getElementById('sweep-rr');
const comparisonBody = document.getElementById('comparison-body');
const compareHistoryEl = document.getElementById('compare-history');
const rrSweepBody = document.getElementById('rr-sweep-body');
const rrCoachEl = document.getElementById('rr-coach');
const algorithmSelect = document.getElementById('algorithm');
const quantumWrap = document.getElementById('quantum-wrap');
const quantumInput = document.getElementById('quantum');
const contextSwitchInput = document.getElementById('context-switch');
const errorText = document.getElementById('error-text');

const avgWaitEl = document.getElementById('avg-wait');
const avgTatEl = document.getElementById('avg-tat');
const avgResponseEl = document.getElementById('avg-response');
const cpuUtilEl = document.getElementById('cpu-util');
const throughputEl = document.getElementById('throughput');
const idleTimeEl = document.getElementById('idle-time');
const longestWaitEl = document.getElementById('longest-wait');
const fairnessSpreadEl = document.getElementById('fairness-spread');
const contextSwitchTimeEl = document.getElementById('context-switch-time');
const maxSlowdownEl = document.getElementById('max-slowdown');
const starvationWatchEl = document.getElementById('starvation-watch');
const slaBoardEl = document.getElementById('sla-board');
const deadlineFitBoardEl = document.getElementById('deadline-fit-board');
const servicePostureEl = document.getElementById('service-posture');
const decisionBriefEl = document.getElementById('decision-brief');
const processPressureMapEl = document.getElementById('process-pressure-map');
const tailRiskBoardEl = document.getElementById('tail-risk-board');
const dispatchAuditEl = document.getElementById('dispatch-audit');
const preemptionWatchEl = document.getElementById('preemption-watch');
const metricsBody = document.getElementById('metrics-body');
const ganttEl = document.getElementById('gantt');
const noteEl = document.getElementById('algorithm-note');
const workloadArrivalSpanEl = document.getElementById('workload-arrival-span');
const workloadBurstMixEl = document.getElementById('workload-burst-mix');
const workloadShortShareEl = document.getElementById('workload-short-share');
const workloadSummaryEl = document.getElementById('workload-summary');
const presetConvoyBtn = document.getElementById('preset-convoy');
const presetInteractiveBtn = document.getElementById('preset-interactive');
const presetStarvationBtn = document.getElementById('preset-starvation');
const shareWorkloadBtn = document.getElementById('share-workload');
const copyDecisionBriefBtn = document.getElementById('copy-decision-brief');
const exportWorkloadBtn = document.getElementById('export-workload');
const importWorkloadBtn = document.getElementById('import-workload');
const importWorkloadFile = document.getElementById('import-workload-file');

const algorithmNotes = {
  FCFS: 'FCFS is simple and fair by arrival order, but long jobs can significantly delay short jobs.',
  SJF: 'SJF minimizes average waiting in many workloads, but requires burst-time knowledge and can starve long jobs.',
  SRTF: 'SRTF preempts running tasks when shorter work arrives, improving responsiveness for short tasks.',
  RR: 'Round Robin shares CPU time with fixed quanta to improve interactivity at the cost of context-switch overhead.',
};

const colorPalette = ['#0f766e', '#0284c7', '#7c3aed', '#16a34a', '#ca8a04', '#e11d48', '#0891b2', '#4f46e5'];

let processes = [
  { id: 'P1', arrival: 0, burst: 6 },
  { id: 'P2', arrival: 1, burst: 3 },
  { id: 'P3', arrival: 2, burst: 8 },
];
let lastSimulation = null;
let compareHistory = [];

function serializeWorkload(processList) {
  return processList.map((process) => `${process.id}:${process.arrival}:${process.burst}`).join(';');
}

function parseSharedWorkload(raw) {
  if (!raw) return null;

  const parsed = raw
    .split(';')
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const [id, arrival, burst] = row.split(':');
      return {
        id: (id || '').trim().toUpperCase(),
        arrival: Number.parseInt(arrival, 10),
        burst: Number.parseInt(burst, 10),
      };
    });

  if (!parsed.length) return null;
  return parsed;
}

function syncUrlState() {
  const params = new URLSearchParams(window.location.search);
  params.set('algorithm', algorithmSelect.value);
  params.set('context', contextSwitchInput.value);
  params.set('workload', serializeWorkload(processes));

  if (algorithmSelect.value === 'RR') {
    params.set('quantum', quantumInput.value);
  } else {
    params.delete('quantum');
  }

  const nextUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, '', nextUrl);
}

function hydrateFromUrlState() {
  const params = new URLSearchParams(window.location.search);
  if (![...params.keys()].length) return false;

  const algorithm = params.get('algorithm');
  if (algorithm && algorithmNotes[algorithm]) {
    algorithmSelect.value = algorithm;
  }

  const quantum = Number.parseInt(params.get('quantum') || '', 10);
  if (Number.isInteger(quantum) && quantum > 0) {
    quantumInput.value = String(quantum);
  }

  const context = Number.parseInt(params.get('context') || '', 10);
  if (Number.isInteger(context) && context >= 0) {
    contextSwitchInput.value = String(context);
  }

  const shared = parseSharedWorkload(params.get('workload') || '');
  if (shared?.length) {
    processes = shared;
    return true;
  }

  return false;
}

function compareByArrivalThenId(a, b) {
  if (a.arrival !== b.arrival) {
    return a.arrival - b.arrival;
  }
  return a.id.localeCompare(b.id);
}

function pushSegment(timeline, pid, start, end) {
  if (end <= start) return;

  const last = timeline[timeline.length - 1];
  if (last && last.pid === pid && last.end === start) {
    last.end = end;
    return;
  }

  timeline.push({ pid, start, end });
}

function renderProcessTable() {
  processBody.innerHTML = '';

  processes.forEach((process, index) => {
    const row = document.createElement('tr');

    const idCell = document.createElement('td');
    const idInput = document.createElement('input');
    idInput.type = 'text';
    idInput.value = process.id;
    idInput.maxLength = 6;
    idInput.addEventListener('input', (event) => {
      processes[index].id = event.target.value.trim().toUpperCase();
      syncUrlState();
    });
    idCell.appendChild(idInput);

    const arrivalCell = document.createElement('td');
    const arrivalInput = document.createElement('input');
    arrivalInput.type = 'number';
    arrivalInput.min = '0';
    arrivalInput.step = '1';
    arrivalInput.value = process.arrival;
    arrivalInput.addEventListener('input', (event) => {
      processes[index].arrival = Number.parseInt(event.target.value, 10);
      renderWorkloadFingerprint();
      syncUrlState();
    });
    arrivalCell.appendChild(arrivalInput);

    const burstCell = document.createElement('td');
    const burstInput = document.createElement('input');
    burstInput.type = 'number';
    burstInput.min = '1';
    burstInput.step = '1';
    burstInput.value = process.burst;
    burstInput.addEventListener('input', (event) => {
      processes[index].burst = Number.parseInt(event.target.value, 10);
      renderWorkloadFingerprint();
      syncUrlState();
    });
    burstCell.appendChild(burstInput);

    const removeCell = document.createElement('td');
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.textContent = 'Remove';
    removeButton.disabled = processes.length === 1;
    removeButton.addEventListener('click', () => {
      processes.splice(index, 1);
      renderProcessTable();
      syncUrlState();
    });
    removeCell.appendChild(removeButton);

    row.append(idCell, arrivalCell, burstCell, removeCell);
    processBody.appendChild(row);
  });

  renderWorkloadFingerprint();
  syncUrlState();
}

function renderWorkloadFingerprint() {
  if (!workloadSummaryEl || !processes.length) return;

  const arrivals = processes.map((process) => Number(process.arrival)).filter(Number.isFinite);
  const bursts = processes.map((process) => Number(process.burst)).filter(Number.isFinite);
  if (!arrivals.length || !bursts.length) {
    workloadArrivalSpanEl.textContent = '-';
    workloadBurstMixEl.textContent = '-';
    workloadShortShareEl.textContent = '-';
    workloadSummaryEl.textContent = 'Fill in valid arrival and burst values to fingerprint the workload.';
    return;
  }

  const arrivalSpan = Math.max(...arrivals) - Math.min(...arrivals);
  const avgBurst = bursts.reduce((sum, value) => sum + value, 0) / bursts.length;
  const longestBurst = Math.max(...bursts);
  const shortestBurst = Math.min(...bursts);
  const shortJobs = bursts.filter((burst) => burst <= Math.max(2, avgBurst * 0.6)).length;
  const shortShare = (shortJobs / bursts.length) * 100;

  workloadArrivalSpanEl.textContent = `${arrivalSpan} time`;
  workloadBurstMixEl.textContent = `${shortestBurst}-${longestBurst} burst`;
  workloadShortShareEl.textContent = `${shortShare.toFixed(0)}%`;

  let summary = 'The workload is mixed enough that SJF or SRTF are sensible baselines.';
  if (arrivalSpan === 0 && longestBurst >= avgBurst * 1.8) {
    summary = 'This looks convoy-prone: FCFS will amplify the long job, while SJF should cut average waiting.';
  } else if (shortShare >= 50 && arrivalSpan > 0) {
    summary = 'Short jobs arrive throughout the trace, so SRTF should respond best if preemption cost is acceptable.';
  } else if (shortShare <= 25 && longestBurst - shortestBurst <= 2) {
    summary = 'Burst sizes are tightly clustered, so Round Robin can trade a little overhead for fairness without much pain.';
  }

  workloadSummaryEl.textContent = summary;
}

function getNextProcessId() {
  const ids = processes
    .map((process) => Number.parseInt(process.id.replace(/\D/g, ''), 10))
    .filter((value) => Number.isFinite(value));

  const maxId = ids.length ? Math.max(...ids) : processes.length;
  return `P${maxId + 1}`;
}

function validateProcesses() {
  if (!processes.length) {
    return { ok: false, message: 'Add at least one process before running the simulation.' };
  }

  const seen = new Set();
  const sanitized = processes.map((process, index) => ({
    id: (process.id || `P${index + 1}`).trim().toUpperCase(),
    arrival: Number(process.arrival),
    burst: Number(process.burst),
  }));

  for (const process of sanitized) {
    if (!process.id) {
      return { ok: false, message: 'Each process must have a non-empty ID.' };
    }
    if (seen.has(process.id)) {
      return { ok: false, message: `Duplicate process ID detected: ${process.id}.` };
    }
    seen.add(process.id);

    if (!Number.isInteger(process.arrival) || process.arrival < 0) {
      return { ok: false, message: `Arrival time for ${process.id} must be an integer >= 0.` };
    }

    if (!Number.isInteger(process.burst) || process.burst <= 0) {
      return { ok: false, message: `Burst time for ${process.id} must be an integer > 0.` };
    }
  }

  processes = sanitized;
  renderProcessTable();

  return { ok: true, processes: sanitized };
}

function buildMetrics(baseProcesses, completionTimes, firstStartTimes, timeline) {
  const rows = baseProcesses.map((process) => {
    const completion = completionTimes[process.id] ?? 0;
    const turnaround = completion - process.arrival;
    const waiting = turnaround - process.burst;
    const response = (firstStartTimes[process.id] ?? process.arrival) - process.arrival;

    return {
      id: process.id,
      completion,
      turnaround,
      waiting,
      response,
      slowdown: turnaround / Math.max(1, process.burst),
    };
  });

  const totals = rows.reduce(
    (acc, row) => {
      acc.waiting += row.waiting;
      acc.turnaround += row.turnaround;
      acc.response += row.response;
      return acc;
    },
    { waiting: 0, turnaround: 0, response: 0 }
  );

  const idleTime = timeline.reduce((sum, segment) => {
    if (segment.pid === 'IDLE') return sum + (segment.end - segment.start);
    return sum;
  }, 0);

  return {
    timeline,
    rows,
    averages: {
      waiting: totals.waiting / rows.length,
      turnaround: totals.turnaround / rows.length,
      response: totals.response / rows.length,
    },
    longestWait: Math.max(...rows.map((row) => row.waiting)),
    fairnessSpread: Math.max(...rows.map((row) => row.waiting)) - Math.min(...rows.map((row) => row.waiting)),
    utilization:
      (timeline.reduce((sum, segment) => {
        if (segment.pid === 'IDLE' || segment.pid === 'CS') return sum;
        return sum + (segment.end - segment.start);
      }, 0) /
        Math.max(1, timeline[timeline.length - 1]?.end || 1)) *
      100,
    throughput: rows.length / Math.max(1, timeline[timeline.length - 1]?.end || 1),
    idleTime,
    contextSwitchTime: timeline.reduce((sum, segment) => {
      if (segment.pid === 'CS') return sum + (segment.end - segment.start);
      return sum;
    }, 0),
    maxSlowdown: Math.max(...rows.map((row) => row.slowdown)),
  };
}

function simulateFCFS(baseProcesses) {
  const queue = [...baseProcesses].sort(compareByArrivalThenId);
  const timeline = [];
  const completionTimes = {};
  const firstStartTimes = {};
  let time = 0;

  queue.forEach((process) => {
    if (time < process.arrival) {
      pushSegment(timeline, 'IDLE', time, process.arrival);
      time = process.arrival;
    }

    firstStartTimes[process.id] = time;
    const end = time + process.burst;
    pushSegment(timeline, process.id, time, end);
    completionTimes[process.id] = end;
    time = end;
  });

  return { timeline, completionTimes, firstStartTimes };
}

function simulateSJF(baseProcesses) {
  const pending = [...baseProcesses].sort(compareByArrivalThenId);
  const ready = [];
  const timeline = [];
  const completionTimes = {};
  const firstStartTimes = {};
  let time = 0;

  while (pending.length || ready.length) {
    while (pending.length && pending[0].arrival <= time) {
      ready.push(pending.shift());
    }

    if (!ready.length) {
      const nextArrival = pending[0].arrival;
      pushSegment(timeline, 'IDLE', time, nextArrival);
      time = nextArrival;
      continue;
    }

    ready.sort((a, b) => {
      if (a.burst !== b.burst) return a.burst - b.burst;
      return compareByArrivalThenId(a, b);
    });

    const process = ready.shift();
    firstStartTimes[process.id] = time;

    const end = time + process.burst;
    pushSegment(timeline, process.id, time, end);
    completionTimes[process.id] = end;
    time = end;
  }

  return { timeline, completionTimes, firstStartTimes };
}

function simulateSRTF(baseProcesses) {
  const pending = [...baseProcesses]
    .map((process) => ({ ...process, remaining: process.burst }))
    .sort(compareByArrivalThenId);

  const ready = [];
  const timeline = [];
  const completionTimes = {};
  const firstStartTimes = {};
  let time = 0;

  while (pending.length || ready.length) {
    while (pending.length && pending[0].arrival <= time) {
      ready.push(pending.shift());
    }

    if (!ready.length) {
      const nextArrival = pending[0].arrival;
      pushSegment(timeline, 'IDLE', time, nextArrival);
      time = nextArrival;
      continue;
    }

    ready.sort((a, b) => {
      if (a.remaining !== b.remaining) return a.remaining - b.remaining;
      return compareByArrivalThenId(a, b);
    });

    const current = ready[0];
    if (firstStartTimes[current.id] === undefined) {
      firstStartTimes[current.id] = time;
    }

    pushSegment(timeline, current.id, time, time + 1);
    current.remaining -= 1;
    time += 1;

    if (current.remaining === 0) {
      completionTimes[current.id] = time;
      ready.shift();
    }
  }

  return { timeline, completionTimes, firstStartTimes };
}

function simulateRR(baseProcesses, quantum) {
  const pending = [...baseProcesses]
    .map((process) => ({ ...process, remaining: process.burst }))
    .sort(compareByArrivalThenId);

  const queue = [];
  const timeline = [];
  const completionTimes = {};
  const firstStartTimes = {};
  let time = 0;

  while (pending.length || queue.length) {
    while (pending.length && pending[0].arrival <= time) {
      queue.push(pending.shift());
    }

    if (!queue.length) {
      const nextArrival = pending[0].arrival;
      pushSegment(timeline, 'IDLE', time, nextArrival);
      time = nextArrival;
      continue;
    }

    const current = queue.shift();
    if (firstStartTimes[current.id] === undefined) {
      firstStartTimes[current.id] = time;
    }

    const runDuration = Math.min(quantum, current.remaining);
    const endTime = time + runDuration;
    pushSegment(timeline, current.id, time, endTime);

    current.remaining -= runDuration;
    time = endTime;

    while (pending.length && pending[0].arrival <= time) {
      queue.push(pending.shift());
    }

    if (current.remaining > 0) {
      queue.push(current);
    } else {
      completionTimes[current.id] = time;
    }
  }

  return { timeline, completionTimes, firstStartTimes };
}

function colorForProcess(pid, colorMap) {
  if (pid === 'IDLE') return '#94a3b8';
  if (pid === 'CS') return '#f59e0b';

  if (!colorMap[pid]) {
    const index = Object.keys(colorMap).length % colorPalette.length;
    colorMap[pid] = colorPalette[index];
  }

  return colorMap[pid];
}

function renderGantt(timeline) {
  if (!timeline.length) {
    ganttEl.innerHTML = '<p class="empty">No timeline generated.</p>';
    return;
  }

  const colorMap = {};
  const html = timeline
    .map((segment) => {
      const duration = segment.end - segment.start;
      const color = colorForProcess(segment.pid, colorMap);

      return `
        <div class="gantt-segment" data-id="${segment.pid}" style="flex-grow: ${duration}; background: ${color};">
          <span class="pid">${segment.pid}</span>
          <span class="times">${segment.start} -> ${segment.end}</span>
        </div>
      `;
    })
    .join('');

  ganttEl.innerHTML = html;
}

function renderMetrics(metrics, algorithm, contextSwitchCost) {
  metricsBody.innerHTML = metrics.rows
    .map(
      (row) => `
        <tr>
          <td>${row.id}</td>
          <td>${row.completion}</td>
          <td>${row.turnaround}</td>
          <td>${row.waiting}</td>
          <td>${row.response}</td>
          <td>${row.slowdown.toFixed(2)}x</td>
        </tr>
      `
    )
    .join('');

  avgWaitEl.textContent = metrics.averages.waiting.toFixed(2);
  avgTatEl.textContent = metrics.averages.turnaround.toFixed(2);
  avgResponseEl.textContent = metrics.averages.response.toFixed(2);
  cpuUtilEl.textContent = `${metrics.utilization.toFixed(1)}%`;
  throughputEl.textContent = `${metrics.throughput.toFixed(3)} proc/time`;
  idleTimeEl.textContent = `${metrics.idleTime.toFixed(1)} time`;
  longestWaitEl.textContent = `${metrics.longestWait.toFixed(1)} time`;
  fairnessSpreadEl.textContent = `${metrics.fairnessSpread.toFixed(1)} time`;
  contextSwitchTimeEl.textContent = `${metrics.contextSwitchTime.toFixed(1)} time`;
  maxSlowdownEl.textContent = `${metrics.maxSlowdown.toFixed(2)}x`;
  renderStarvationWatch(metrics);
  renderSlaBoard(metrics);
  renderDeadlineFitBoard(metrics);
  renderServicePosture(metrics, algorithm);
  renderDecisionBrief(metrics, algorithm, contextSwitchCost);
  renderProcessPressureMap(metrics);
  renderTailRiskBoard(metrics);
  renderDispatchAudit(metrics);
  renderPreemptionWatch(metrics, algorithm);
}

function renderStarvationWatch(metrics) {
  if (!starvationWatchEl) return;

  const atRisk = metrics.rows
    .map((row) => ({
      ...row,
      waitRatio: row.waiting / Math.max(1, row.turnaround),
    }))
    .filter((row) => row.waiting >= 4 && (row.slowdown >= 2.4 || row.waitRatio >= 0.55))
    .sort((a, b) => b.slowdown - a.slowdown);

  if (!atRisk.length) {
    starvationWatchEl.textContent = 'Starvation watch: no process is currently showing a severe wait-to-work imbalance.';
    return;
  }

  starvationWatchEl.textContent = `Starvation watch: ${atRisk
    .slice(0, 3)
    .map((row) => `${row.id} waited ${row.waiting.toFixed(1)} with slowdown ${row.slowdown.toFixed(2)}x`)
    .join(' | ')}`;
}

function renderSlaBoard(metrics) {
  if (!slaBoardEl) return;

  const responseBudget = Math.max(2, Math.ceil(metrics.averages.response));
  const breaches = metrics.rows
    .map((row) => {
      const burstEstimate = row.turnaround / Math.max(row.slowdown, 1);
      const batchBudget = Math.max(3, burstEstimate * 2.5);
      return {
        ...row,
        batchBudget,
        responseBreach: row.response > responseBudget,
        turnaroundBreach: row.turnaround > batchBudget,
      };
    })
    .filter((row) => row.responseBreach || row.turnaroundBreach)
    .sort((a, b) => b.waiting - a.waiting);

  if (!breaches.length) {
    slaBoardEl.textContent = `SLA stress test: every process stayed within the current interactive response budget (${responseBudget}) and batch stretch budget.`;
    return;
  }

  const worst = breaches[0];
  const failureNotes = [];
  if (worst.responseBreach) failureNotes.push(`response ${worst.response} > ${responseBudget}`);
  if (worst.turnaroundBreach) failureNotes.push(`turnaround ${worst.turnaround} > ${worst.batchBudget.toFixed(1)}`);
  slaBoardEl.textContent = `SLA stress test: ${breaches.length} process${breaches.length === 1 ? '' : 'es'} missed a practical service budget. Worst offender: ${worst.id} (${failureNotes.join(', ')}).`;
}

function renderDeadlineFitBoard(metrics) {
  if (!deadlineFitBoardEl) return;

  const rows = metrics.rows.map((row) => {
    const burstEstimate = row.turnaround / Math.max(row.slowdown, 1);
    const interactiveDeadline = Math.max(2, Math.ceil(metrics.averages.response * 1.5));
    const batchDeadline = Math.max(4, Math.ceil(burstEstimate * 3));
    return {
      ...row,
      interactiveDeadline,
      batchDeadline,
      missesInteractive: row.response > interactiveDeadline,
      missesBatch: row.turnaround > batchDeadline,
    };
  });

  const interactiveMisses = rows.filter((row) => row.missesInteractive);
  const batchMisses = rows.filter((row) => row.missesBatch);

  deadlineFitBoardEl.textContent =
    interactiveMisses.length || batchMisses.length
      ? `Deadline fit: interactive misses ${interactiveMisses.length ? interactiveMisses.map((row) => `${row.id} (>${row.interactiveDeadline} response)`).join(', ') : 'none'} | batch misses ${batchMisses.length ? batchMisses.map((row) => `${row.id} (>${row.batchDeadline} turnaround)`).join(', ') : 'none'}.`
      : 'Deadline fit: no processes miss the current soft interactive or batch deadlines under this simulation.';
}

function renderServicePosture(metrics, algorithm) {
  if (!servicePostureEl) return;

  const fastResponse = metrics.averages.response <= Math.max(2, metrics.averages.waiting * 0.65);
  const fairQueue = metrics.fairnessSpread <= Math.max(4, metrics.averages.waiting * 0.75);
  const heavySlowdown = metrics.maxSlowdown >= 3;
  const posture = fastResponse && fairQueue
    ? 'Interactive-friendly'
    : !fastResponse && heavySlowdown
      ? 'Batch-heavy'
      : 'Mixed';

  const cue =
    posture === 'Interactive-friendly'
      ? `${algorithm} is keeping first response times tight without spreading wait pain too unevenly.`
      : posture === 'Batch-heavy'
        ? `${algorithm} is stretching some jobs hard enough that throughput is coming at a visible responsiveness cost.`
        : `${algorithm} is splitting the difference: some processes respond quickly, but fairness or slowdown still needs attention.`;

  servicePostureEl.textContent = `Service posture: ${posture}. ${cue}`;
}

function renderDecisionBrief(metrics, algorithm, contextSwitchCost) {
  if (!decisionBriefEl) return;

  const worstWaiter = [...metrics.rows].sort((a, b) => b.waiting - a.waiting)[0];
  const quickestResponder = [...metrics.rows].sort((a, b) => a.response - b.response)[0];
  const unfair = metrics.fairnessSpread >= 6;
  const heavyOverhead = contextSwitchCost > 0 && metrics.contextSwitchTime >= Math.max(2, metrics.averages.waiting * 0.75);

  const cues = [
    `${algorithm} currently gives ${quickestResponder.id} the fastest first response (${quickestResponder.response.toFixed(1)}).`,
    `${worstWaiter.id} absorbs the most waiting pain at ${worstWaiter.waiting.toFixed(1)} time units.`,
  ];

  if (unfair) {
    cues.push('Fairness spread is wide, so the queue is favoring some jobs much more than others.');
  } else {
    cues.push('Fairness spread stays fairly tight, so pain is distributed reasonably evenly.');
  }

  if (algorithm === 'RR' && heavyOverhead) {
    cues.push('Round Robin is paying a noticeable context-switch tax here; consider a larger quantum or lower switch cost.');
  } else if ((algorithm === 'FCFS' || algorithm === 'SJF') && worstWaiter.response >= metrics.averages.response * 1.8) {
    cues.push('An interactive lane is getting buried; a preemptive policy would likely improve perceived responsiveness.');
  } else if (algorithm === 'SRTF' && metrics.contextSwitchTime > 0) {
    cues.push('SRTF is responsive, but the preemption pattern only stays worth it while switch overhead remains low.');
  } else {
    cues.push('The current tuning is plausible for this workload; compare-all is the next check if you want a stronger recommendation.');
  }

  decisionBriefEl.textContent = `Decision brief: ${cues.join(' ')}`;
}

function renderProcessPressureMap(metrics) {
  if (!processPressureMapEl) return;

  const pressureRows = metrics.rows.map((row) => {
    const interactive = row.response <= Math.max(2, metrics.averages.response);
    const stretched = row.slowdown >= Math.max(1.8, metrics.maxSlowdown * 0.7);
    const backlogHeavy = row.waiting >= Math.max(metrics.averages.waiting, row.burst);
    let posture = 'Balanced';

    if (interactive && !stretched) posture = 'Interactive-friendly';
    else if (stretched || backlogHeavy) posture = 'At risk';
    else if (row.turnaround >= metrics.averages.turnaround) posture = 'Batch-heavy';

    return `${row.id}: ${posture} (response ${row.response.toFixed(1)}, wait ${row.waiting.toFixed(1)}, slowdown ${row.slowdown.toFixed(2)}x)`;
  });

  const atRiskCount = pressureRows.filter((row) => row.includes('At risk')).length;
  const summary =
    atRiskCount === 0
      ? 'Pressure map: no process is falling into a clearly risky posture under the current schedule.'
      : `Pressure map: ${atRiskCount} process${atRiskCount === 1 ? '' : 'es'} are drifting into an at-risk posture and deserve closer scheduling scrutiny.`;

  processPressureMapEl.innerHTML = `
    <p>${summary}</p>
    ${pressureRows.map((row) => `<p>${row}</p>`).join('')}
  `;
}

function renderTailRiskBoard(metrics) {
  if (!tailRiskBoardEl) return;

  if (!metrics.rows.length) {
    tailRiskBoardEl.textContent = 'Run a simulation to see which process absorbs the worst tail-latency pain.';
    return;
  }

  const byWait = [...metrics.rows].sort((a, b) => b.waiting - a.waiting);
  const bySlowdown = [...metrics.rows].sort((a, b) => b.slowdown - a.slowdown);
  const tailWait = byWait[0];
  const tailSlow = bySlowdown[0];

  tailRiskBoardEl.innerHTML =
    tailWait.id === tailSlow.id
      ? `<p><strong>${tailWait.id}</strong> is carrying both the longest wait (${tailWait.waiting.toFixed(1)}) and the heaviest slowdown (${tailWait.slowdown.toFixed(2)}x). This scheduler is creating one obvious tail-risk victim.</p>`
      : `<p><strong>${tailWait.id}</strong> absorbs the longest queue wait (${tailWait.waiting.toFixed(1)}), while <strong>${tailSlow.id}</strong> suffers the worst self-relative stretch (${tailSlow.slowdown.toFixed(2)}x slowdown). Tail pain is split across two different process types.</p>`;
}

function renderDispatchAudit(metrics) {
  if (!dispatchAuditEl) return;

  const timeline = metrics.timeline || [];
  const idleSegments = timeline.filter((segment) => segment.pid === 'IDLE');
  const contextSwitches = timeline.filter((segment) => segment.pid === 'CS');
  const processSegments = timeline.filter((segment) => segment.pid !== 'IDLE' && segment.pid !== 'CS');
  const handoffs = processSegments.reduce((count, segment, index, segments) => {
    if (index === 0) return count;
    return segments[index - 1].pid === segment.pid ? count : count + 1;
  }, 0);
  const shortestRun = processSegments.length
    ? Math.min(...processSegments.map((segment) => segment.end - segment.start))
    : 0;
  const churn =
    handoffs >= processSegments.length * 0.55
      ? 'high dispatch churn'
      : handoffs >= processSegments.length * 0.3
        ? 'moderate dispatch churn'
        : 'low dispatch churn';

  dispatchAuditEl.textContent = `Dispatch audit: ${idleSegments.length} idle gap${idleSegments.length === 1 ? '' : 's'}, ${handoffs} process handoff${handoffs === 1 ? '' : 's'}, ${contextSwitches.length} explicit context switch segment${contextSwitches.length === 1 ? '' : 's'}, and shortest run ${shortestRun}. This is ${churn}.`;
}

function renderPreemptionWatch(metrics, algorithm) {
  if (!preemptionWatchEl) return;

  const shortArrivals = metrics.rows.filter((row) => row.response <= Math.max(2, metrics.averages.response) && row.waiting <= row.turnaround * 0.45).length;
  const punishedLongJob = metrics.rows.some((row) => row.slowdown >= 3 && row.waiting >= row.response * 1.5);
  const interactivePressure = shortArrivals >= Math.ceil(metrics.rows.length / 2);
  const wantsPreemption = interactivePressure && metrics.averages.response > 1.8;

  if (algorithm === 'SRTF' || algorithm === 'RR') {
    preemptionWatchEl.textContent = wantsPreemption
      ? `Preemption watch: this workload does benefit from fast first response, and ${algorithm} is aligned with that pressure. Keep an eye on slowdown for the stretched long job.`
      : `Preemption watch: ${algorithm} is responsive, but this workload may not need that much interruption. Compare against SJF if you want a simpler baseline.`;
    return;
  }

  preemptionWatchEl.textContent = wantsPreemption
    ? 'Preemption watch: short arrivals are stacking up behind slower work, so a preemptive policy would likely improve perceived responsiveness.'
    : punishedLongJob
      ? 'Preemption watch: a long job is suffering, but the bigger issue is fairness stretch rather than pure response latency. Tune policy choice around slowdown, not just preemption.'
      : 'Preemption watch: this workload is not strongly demanding preemption right now. Non-preemptive baselines remain defensible.';
}

function buildSimulationInsights(metrics, algorithm, contextSwitchCost) {
  const insights = [algorithmNotes[algorithm]];

  if (metrics.longestWait >= metrics.averages.waiting * 1.8 && metrics.longestWait >= 4) {
    insights.push('Longest wait is much higher than the average, so this workload is showing queue unfairness or convoy pressure.');
  }

  if (metrics.fairnessSpread >= 6) {
    insights.push(`Wait times are spread across the workload by ${metrics.fairnessSpread.toFixed(1)} time units, so some processes are absorbing much more pain than others.`);
  } else {
    insights.push('Waiting time stays relatively tight across the workload, so fairness is holding up reasonably well.');
  }

  if (metrics.contextSwitchTime > 0) {
    const overheadShare = (metrics.contextSwitchTime / Math.max(1, metrics.contextSwitchTime + metrics.idleTime + metrics.rows.reduce((sum, row) => sum + row.turnaround - row.waiting, 0))) * 100;
    insights.push(
      overheadShare >= 12
        ? `Context switching is expensive here (${metrics.contextSwitchTime.toFixed(1)} time units), so smaller quanta are likely hurting throughput.`
        : `Context switch cost is present (${contextSwitchCost} per switch) but not dominating the run.`
    );
  } else {
    insights.push('No context-switch overhead is being added, so the comparison is isolating algorithm behavior only.');
  }

  if (metrics.averages.response <= metrics.averages.waiting * 0.6) {
    insights.push('Response time is relatively strong, which suggests short jobs are getting CPU quickly.');
  } else {
    insights.push('Response time is close to waiting time, which usually means interactive tasks are not being favored.');
  }

  if (metrics.idleTime > 0) {
    insights.push(`Idle gaps total ${metrics.idleTime.toFixed(1)} time units, so arrivals are leaving the CPU underutilized at points in the trace.`);
  }

  return insights.join(' ');
}

function buildComparisonSummary(rows, contextSwitchCost) {
  if (!rows.length) return 'No comparison results yet.';

  const bestWait = rows.reduce((best, row) => (row.metrics.averages.waiting < best.metrics.averages.waiting ? row : best));
  const bestResponse = rows.reduce((best, row) => (row.metrics.averages.response < best.metrics.averages.response ? row : best));
  const bestUtilization = rows.reduce((best, row) => (row.metrics.utilization > best.metrics.utilization ? row : best));
  const highestOverhead = rows.reduce((best, row) => (row.metrics.contextSwitchTime > best.metrics.contextSwitchTime ? row : best));

  return `${bestWait.algorithm} minimizes waiting, ${bestResponse.algorithm} responds fastest, and ${bestUtilization.algorithm} keeps the CPU busiest. ${
    contextSwitchCost > 0
      ? `${highestOverhead.algorithm} pays the largest context-switch bill under the current overhead setting.`
      : 'Context-switch overhead is disabled in this comparison.'
  }`;
}

function applyContextSwitchOverhead(timeline, overhead) {
  if (!overhead) {
    return timeline.map((segment) => ({ ...segment }));
  }

  const adjusted = [];
  let cursor = timeline[0]?.start || 0;

  timeline.forEach((segment, index) => {
    const duration = segment.end - segment.start;
    const start = cursor;
    const end = cursor + duration;
    pushSegment(adjusted, segment.pid, start, end);
    cursor = end;

    const next = timeline[index + 1];
    if (!next) return;

    const switchingProcesses =
      segment.pid !== 'IDLE' && next.pid !== 'IDLE' && segment.pid !== next.pid;
    if (switchingProcesses) {
      pushSegment(adjusted, 'CS', cursor, cursor + overhead);
      cursor += overhead;
    }
  });

  return adjusted;
}

function deriveTimesFromTimeline(timeline, processIds) {
  const completionTimes = {};
  const firstStartTimes = {};
  const validIds = new Set(processIds);

  timeline.forEach((segment) => {
    if (!validIds.has(segment.pid)) return;
    if (firstStartTimes[segment.pid] === undefined) {
      firstStartTimes[segment.pid] = segment.start;
    }
    completionTimes[segment.pid] = segment.end;
  });

  return { completionTimes, firstStartTimes };
}

function updateQuantumVisibility() {
  const showQuantum = algorithmSelect.value === 'RR';
  quantumWrap.classList.toggle('hidden', !showQuantum);
}

function runSimulation() {
  errorText.textContent = '';

  const validation = validateProcesses();
  if (!validation.ok) {
    errorText.textContent = validation.message;
    return;
  }

  const selectedAlgorithm = algorithmSelect.value;
  const contextSwitchCost = Number.parseInt(contextSwitchInput.value, 10);
  if (!Number.isInteger(contextSwitchCost) || contextSwitchCost < 0) {
    errorText.textContent = 'Context switch cost must be an integer >= 0.';
    return;
  }
  let result;

  if (selectedAlgorithm === 'RR') {
    const quantum = Number.parseInt(quantumInput.value, 10);
    if (!Number.isInteger(quantum) || quantum <= 0) {
      errorText.textContent = 'Round Robin requires a valid quantum (integer > 0).';
      return;
    }
    result = simulateRR(validation.processes, quantum);
  } else if (selectedAlgorithm === 'SJF') {
    result = simulateSJF(validation.processes);
  } else if (selectedAlgorithm === 'SRTF') {
    result = simulateSRTF(validation.processes);
  } else {
    result = simulateFCFS(validation.processes);
  }

  const timelineWithOverhead = applyContextSwitchOverhead(result.timeline, contextSwitchCost);
  const derivedTimes = deriveTimesFromTimeline(
    timelineWithOverhead,
    validation.processes.map((process) => process.id)
  );
  const metrics = buildMetrics(
    validation.processes,
    derivedTimes.completionTimes,
    derivedTimes.firstStartTimes,
    timelineWithOverhead
  );
  renderGantt(timelineWithOverhead);
  renderMetrics(metrics, selectedAlgorithm, contextSwitchCost);
  noteEl.textContent = buildSimulationInsights(metrics, selectedAlgorithm, contextSwitchCost);
  lastSimulation = {
    algorithm: selectedAlgorithm,
    contextSwitchCost,
    metrics,
    timeline: timelineWithOverhead,
  };
}

function runAlgorithmForComparison(processList, algorithm, quantum, contextSwitchCost) {
  let result;

  if (algorithm === 'RR') {
    result = simulateRR(processList, quantum);
  } else if (algorithm === 'SJF') {
    result = simulateSJF(processList);
  } else if (algorithm === 'SRTF') {
    result = simulateSRTF(processList);
  } else {
    result = simulateFCFS(processList);
  }

  const timelineWithOverhead = applyContextSwitchOverhead(result.timeline, contextSwitchCost);
  const derivedTimes = deriveTimesFromTimeline(
    timelineWithOverhead,
    processList.map((process) => process.id)
  );

  return buildMetrics(processList, derivedTimes.completionTimes, derivedTimes.firstStartTimes, timelineWithOverhead);
}

function compareAllAlgorithms() {
  errorText.textContent = '';
  const validation = validateProcesses();
  if (!validation.ok) {
    errorText.textContent = validation.message;
    return;
  }

  const contextSwitchCost = Number.parseInt(contextSwitchInput.value, 10);
  const quantum = Number.parseInt(quantumInput.value, 10);
  if (!Number.isInteger(contextSwitchCost) || contextSwitchCost < 0) {
    errorText.textContent = 'Context switch cost must be an integer >= 0.';
    return;
  }
  if (!Number.isInteger(quantum) || quantum <= 0) {
    errorText.textContent = 'Round Robin requires a valid quantum (integer > 0).';
    return;
  }

  const algorithms = ['FCFS', 'SJF', 'SRTF', 'RR'];
  const rows = algorithms.map((algorithm) => ({
    algorithm,
    metrics: runAlgorithmForComparison(validation.processes, algorithm, quantum, contextSwitchCost),
  }));

  rows.sort((a, b) => a.metrics.averages.waiting - b.metrics.averages.waiting);

  comparisonBody.innerHTML = rows
    .map(
      ({ algorithm, metrics }) => `
        <tr>
          <td>${algorithm}</td>
          <td>${metrics.averages.waiting.toFixed(2)}</td>
          <td>${metrics.averages.response.toFixed(2)}</td>
          <td>${metrics.averages.turnaround.toFixed(2)}</td>
          <td>${metrics.utilization.toFixed(1)}%</td>
        </tr>
      `
    )
    .join('');

  compareHistory = [
    `${rows[0].algorithm} won this ${validation.processes.length}-process workload; ${rows[rows.length - 1].algorithm} trailed on average wait.`,
    ...compareHistory,
  ].slice(0, 4);
  if (compareHistoryEl) {
    compareHistoryEl.innerHTML = compareHistory.map((entry) => `<p>${entry}</p>`).join('');
  }

  errorText.textContent = `${rows[0].algorithm} currently has the best average waiting time on this workload.`;
  noteEl.textContent = buildComparisonSummary(rows, contextSwitchCost);
}

function sweepRoundRobinQuantums() {
  const validation = validateProcesses();
  if (!validation.ok) {
    errorText.textContent = validation.message;
    return;
  }

  const contextSwitchCost = Number.parseInt(contextSwitchInput.value, 10);
  if (!Number.isInteger(contextSwitchCost) || contextSwitchCost < 0) {
    errorText.textContent = 'Context switch cost must be an integer >= 0.';
    return;
  }

  const rows = Array.from({ length: 6 }, (_, index) => {
    const quantum = index + 1;
    return {
      quantum,
      metrics: runAlgorithmForComparison(validation.processes, 'RR', quantum, contextSwitchCost),
    };
  });

  if (rrSweepBody) {
    rrSweepBody.innerHTML = rows
      .map(({ quantum, metrics }) => {
        const bestWait = rows.reduce((best, row) => (row.metrics.averages.waiting < best.metrics.averages.waiting ? row : best)).quantum;
        const note = quantum === bestWait ? ' <- lowest wait' : '';
        return `
          <tr>
            <td>${quantum}${note}</td>
            <td>${metrics.averages.waiting.toFixed(2)}</td>
            <td>${metrics.averages.response.toFixed(2)}</td>
            <td>${metrics.averages.turnaround.toFixed(2)}</td>
            <td>${metrics.utilization.toFixed(1)}%</td>
          </tr>
        `;
      })
      .join('');
  }

  const bestWaitRow = rows.reduce((best, row) => (row.metrics.averages.waiting < best.metrics.averages.waiting ? row : best));
  const bestResponseRow = rows.reduce((best, row) => (row.metrics.averages.response < best.metrics.averages.response ? row : best));
  noteEl.textContent = `RR sweep: quantum ${bestWaitRow.quantum} minimizes waiting, while quantum ${bestResponseRow.quantum} responds fastest under the current context-switch cost.`;
  if (rrCoachEl) {
    const overheadHeavy = rows.filter((row) => row.metrics.contextSwitchTime >= row.metrics.averages.waiting * 0.7);
    const coach =
      bestWaitRow.quantum === bestResponseRow.quantum
        ? `Quantum coach: use q=${bestWaitRow.quantum}. It currently balances waiting and first-response time best on this workload.`
        : `Quantum coach: q=${bestResponseRow.quantum} is the interactive pick, while q=${bestWaitRow.quantum} is the throughput-friendly pick.`;
    const overheadNote = overheadHeavy.length
      ? ` Smaller quantums are paying a visible context-switch tax for q=${overheadHeavy.map((row) => row.quantum).join(', ')}.`
      : ' Context-switch overhead stays contained across the tested range.';
    rrCoachEl.textContent = `${coach}${overheadNote}`;
  }
  errorText.textContent = 'Round Robin quantum sweep complete.';
}

function exportSimulationCsv() {
  if (!lastSimulation) {
    errorText.textContent = 'Run a simulation before exporting.';
    return;
  }

  const rows = [];
  rows.push('Section,Metric,Value');
  rows.push(`Summary,Algorithm,${lastSimulation.algorithm}`);
  rows.push(`Summary,ContextSwitchCost,${lastSimulation.contextSwitchCost}`);
  rows.push(`Summary,AvgWaiting,${lastSimulation.metrics.averages.waiting.toFixed(3)}`);
  rows.push(`Summary,AvgTurnaround,${lastSimulation.metrics.averages.turnaround.toFixed(3)}`);
  rows.push(`Summary,AvgResponse,${lastSimulation.metrics.averages.response.toFixed(3)}`);
  rows.push(`Summary,CPUUtilizationPct,${lastSimulation.metrics.utilization.toFixed(3)}`);
  rows.push(`Summary,Throughput,${lastSimulation.metrics.throughput.toFixed(6)}`);
  rows.push(`Summary,IdleTime,${lastSimulation.metrics.idleTime.toFixed(3)}`);

  rows.push('');
  rows.push('PerProcess,PID,Completion,Turnaround,Waiting,Response');
  lastSimulation.metrics.rows.forEach((row) => {
    rows.push(`PerProcess,${row.id},${row.completion},${row.turnaround},${row.waiting},${row.response}`);
  });

  rows.push('');
  rows.push('Timeline,PID,Start,End,Duration');
  lastSimulation.timeline.forEach((segment) => {
    rows.push(`Timeline,${segment.pid},${segment.start},${segment.end},${segment.end - segment.start}`);
  });

  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `cpu-scheduler-${lastSimulation.algorithm.toLowerCase()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
  errorText.textContent = 'Exported simulation CSV.';
}

function buildDecisionBrief() {
  const algorithm = algorithmSelect.value;
  const lines = [
    'CPU Scheduling Studio Decision Brief',
    '',
    `Algorithm: ${algorithm}`,
    `Context switch cost: ${contextSwitchInput.value}`,
    `Quantum: ${algorithm === 'RR' ? quantumInput.value : 'n/a'}`,
    `Workload: ${serializeWorkload(processes)}`,
    `Fingerprint: arrival span ${workloadArrivalSpanEl?.textContent || '-'} | burst mix ${workloadBurstMixEl?.textContent || '-'} | short jobs ${workloadShortShareEl?.textContent || '-'}`,
    `Summary metrics: wait ${avgWaitEl?.textContent || '-'} | turnaround ${avgTatEl?.textContent || '-'} | response ${avgResponseEl?.textContent || '-'} | utilization ${cpuUtilEl?.textContent || '-'} | fairness ${fairnessSpreadEl?.textContent || '-'}`,
    `Starvation watch: ${starvationWatchEl?.textContent || '-'}`,
    `Decision brief: ${decisionBriefEl?.textContent || 'Run a simulation to generate a tuning brief.'}`,
    `Pressure map: ${processPressureMapEl?.textContent || '-'}`,
    `Tail risk: ${tailRiskBoardEl?.textContent || '-'}`,
  ];

  if (lastSimulation?.metrics?.rows?.length) {
    lines.push('');
    lines.push('Per-process rows:');
    lastSimulation.metrics.rows.forEach((row) => {
      lines.push(`${row.id}: completion ${row.completion}, turnaround ${row.turnaround}, waiting ${row.waiting}, response ${row.response}, slowdown ${row.slowdown.toFixed(2)}`);
    });
  }

  return lines.join('\n');
}

function generateRandomWorkload() {
  const processCount = 4 + Math.floor(Math.random() * 4);
  processes = Array.from({ length: processCount }, (_, index) => ({
    id: `P${index + 1}`,
    arrival: Math.floor(Math.random() * 8),
    burst: 1 + Math.floor(Math.random() * 9),
  }));

  processes.sort(compareByArrivalThenId);
  renderProcessTable();
  errorText.textContent = `Generated random workload (${processCount} processes).`;
  runSimulation();
}

function loadPresetWorkload(type) {
  if (type === 'convoy') {
    processes = [
      { id: 'P1', arrival: 0, burst: 14 },
      { id: 'P2', arrival: 1, burst: 2 },
      { id: 'P3', arrival: 2, burst: 1 },
      { id: 'P4', arrival: 3, burst: 2 },
    ];
    algorithmSelect.value = 'FCFS';
    contextSwitchInput.value = '0';
    errorText.textContent = 'Loaded convoy-effect preset. Compare FCFS against SJF or RR.';
  } else if (type === 'interactive') {
    processes = [
      { id: 'P1', arrival: 0, burst: 6 },
      { id: 'P2', arrival: 1, burst: 2 },
      { id: 'P3', arrival: 2, burst: 1 },
      { id: 'P4', arrival: 4, burst: 3 },
      { id: 'P5', arrival: 6, burst: 2 },
    ];
    algorithmSelect.value = 'RR';
    quantumInput.value = '2';
    contextSwitchInput.value = '1';
    errorText.textContent = 'Loaded interactive preset. Round Robin now shows context-switch tradeoffs.';
  } else {
    processes = [
      { id: 'P1', arrival: 0, burst: 18 },
      { id: 'P2', arrival: 1, burst: 2 },
      { id: 'P3', arrival: 2, burst: 2 },
      { id: 'P4', arrival: 3, burst: 1 },
      { id: 'P5', arrival: 5, burst: 2 },
      { id: 'P6', arrival: 7, burst: 1 },
    ];
    algorithmSelect.value = 'SJF';
    contextSwitchInput.value = '0';
    errorText.textContent = 'Loaded starvation-watch preset. Compare SJF, SRTF, and RR to see who protects late short jobs without trapping the long runner.';
  }

  renderProcessTable();
  updateQuantumVisibility();
  runSimulation();
}

function exportWorkload() {
  const payload = {
    algorithm: algorithmSelect.value,
    quantum: quantumInput.value,
    contextSwitchCost: contextSwitchInput.value,
    processes,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'cpu-scheduler-workload.json';
  anchor.click();
  URL.revokeObjectURL(url);
  errorText.textContent = 'Exported workload JSON.';
}

function importWorkload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || '{}'));
      processes = Array.isArray(parsed.processes) ? parsed.processes : [];
      algorithmSelect.value = parsed.algorithm || 'FCFS';
      quantumInput.value = parsed.quantum || '2';
      contextSwitchInput.value = parsed.contextSwitchCost || '0';
      renderProcessTable();
      updateQuantumVisibility();
      runSimulation();
      errorText.textContent = 'Imported workload JSON.';
    } catch (error) {
      errorText.textContent = 'Could not import that workload JSON.';
    } finally {
      event.target.value = '';
    }
  };

  reader.readAsText(file);
}

addProcessBtn.addEventListener('click', () => {
  processes.push({ id: getNextProcessId(), arrival: 0, burst: 1 });
  renderProcessTable();
});

algorithmSelect.addEventListener('change', () => {
  updateQuantumVisibility();
  syncUrlState();
});
quantumInput.addEventListener('input', syncUrlState);
contextSwitchInput.addEventListener('input', syncUrlState);
runButton.addEventListener('click', runSimulation);
exportCsvButton.addEventListener('click', exportSimulationCsv);
randomWorkloadBtn.addEventListener('click', generateRandomWorkload);
presetConvoyBtn.addEventListener('click', () => loadPresetWorkload('convoy'));
presetInteractiveBtn.addEventListener('click', () => loadPresetWorkload('interactive'));
presetStarvationBtn.addEventListener('click', () => loadPresetWorkload('starvation'));
exportWorkloadBtn.addEventListener('click', exportWorkload);
shareWorkloadBtn.addEventListener('click', async () => {
  syncUrlState();
  try {
    await navigator.clipboard.writeText(window.location.href);
    errorText.textContent = 'Share link copied with the current workload and scheduler settings.';
  } catch (error) {
    errorText.textContent = 'Clipboard copy failed in this environment.';
  }
});
copyDecisionBriefBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(buildDecisionBrief());
    errorText.textContent = 'Copied a decision brief with the current workload and simulation summary.';
  } catch (error) {
    errorText.textContent = 'Clipboard copy failed in this environment.';
  }
});
importWorkloadBtn.addEventListener('click', () => importWorkloadFile.click());
importWorkloadFile.addEventListener('change', importWorkload);
compareAllButton.addEventListener('click', compareAllAlgorithms);
sweepRrButton.addEventListener('click', sweepRoundRobinQuantums);

hydrateFromUrlState();
renderProcessTable();
updateQuantumVisibility();
runSimulation();
