const processBody = document.getElementById('process-body');
const addProcessBtn = document.getElementById('add-process');
const runButton = document.getElementById('run-sim');
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
const metricsBody = document.getElementById('metrics-body');
const ganttEl = document.getElementById('gantt');
const noteEl = document.getElementById('algorithm-note');

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

  return {
    rows,
    averages: {
      waiting: totals.waiting / rows.length,
      turnaround: totals.turnaround / rows.length,
      response: totals.response / rows.length,
    },
    utilization:
      (timeline.reduce((sum, segment) => {
        if (segment.pid === 'IDLE' || segment.pid === 'CS') return sum;
        return sum + (segment.end - segment.start);
      }, 0) /
        Math.max(1, timeline[timeline.length - 1]?.end || 1)) *
      100,
    throughput: rows.length / Math.max(1, timeline[timeline.length - 1]?.end || 1),
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
  noteEl.textContent = `${algorithmNotes[selectedAlgorithm]} Context switch cost applied: ${contextSwitchCost}.`;
}

addProcessBtn.addEventListener('click', () => {
  processes.push({ id: getNextProcessId(), arrival: 0, burst: 1 });
  renderProcessTable();
});

algorithmSelect.addEventListener('change', updateQuantumVisibility);
runButton.addEventListener('click', runSimulation);

renderProcessTable();
updateQuantumVisibility();
runSimulation();
