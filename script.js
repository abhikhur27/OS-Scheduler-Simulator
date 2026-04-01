const processBody = document.getElementById('process-body');
const addProcessBtn = document.getElementById('add-process');
const randomWorkloadBtn = document.getElementById('random-workload');
const runButton = document.getElementById('run-sim');
const exportCsvButton = document.getElementById('export-csv');
const compareAllButton = document.getElementById('compare-all');
const comparisonBody = document.getElementById('comparison-body');
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
const contextSwitchTimeEl = document.getElementById('context-switch-time');
const metricsBody = document.getElementById('metrics-body');
const ganttEl = document.getElementById('gantt');
const noteEl = document.getElementById('algorithm-note');
const presetConvoyBtn = document.getElementById('preset-convoy');
const presetInteractiveBtn = document.getElementById('preset-interactive');
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
    });
    removeCell.appendChild(removeButton);

    row.append(idCell, arrivalCell, burstCell, removeCell);
    processBody.appendChild(row);
  });
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
    rows,
    averages: {
      waiting: totals.waiting / rows.length,
      turnaround: totals.turnaround / rows.length,
      response: totals.response / rows.length,
    },
    longestWait: Math.max(...rows.map((row) => row.waiting)),
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

function renderMetrics(metrics) {
  metricsBody.innerHTML = metrics.rows
    .map(
      (row) => `
        <tr>
          <td>${row.id}</td>
          <td>${row.completion}</td>
          <td>${row.turnaround}</td>
          <td>${row.waiting}</td>
          <td>${row.response}</td>
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
  contextSwitchTimeEl.textContent = `${metrics.contextSwitchTime.toFixed(1)} time`;
}

function buildSimulationInsights(metrics, algorithm, contextSwitchCost) {
  const insights = [algorithmNotes[algorithm]];

  if (metrics.longestWait >= metrics.averages.waiting * 1.8 && metrics.longestWait >= 4) {
    insights.push('Longest wait is much higher than the average, so this workload is showing queue unfairness or convoy pressure.');
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
  renderMetrics(metrics);
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

  errorText.textContent = `${rows[0].algorithm} currently has the best average waiting time on this workload.`;
  noteEl.textContent = buildComparisonSummary(rows, contextSwitchCost);
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
  } else {
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

algorithmSelect.addEventListener('change', updateQuantumVisibility);
runButton.addEventListener('click', runSimulation);
exportCsvButton.addEventListener('click', exportSimulationCsv);
randomWorkloadBtn.addEventListener('click', generateRandomWorkload);
presetConvoyBtn.addEventListener('click', () => loadPresetWorkload('convoy'));
presetInteractiveBtn.addEventListener('click', () => loadPresetWorkload('interactive'));
exportWorkloadBtn.addEventListener('click', exportWorkload);
importWorkloadBtn.addEventListener('click', () => importWorkloadFile.click());
importWorkloadFile.addEventListener('change', importWorkload);
compareAllButton.addEventListener('click', compareAllAlgorithms);

renderProcessTable();
updateQuantumVisibility();
runSimulation();
