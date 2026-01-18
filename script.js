let processes = [
    { id: 'P1', arrival: 0, burst: 5 },
    { id: 'P2', arrival: 1, burst: 3 }
];

function addProcess() {
    const id = `P${processes.length + 1}`;
    processes.push({ id, arrival: 0, burst: 1 });
    renderTable();
}

function renderTable() {
    const body = document.getElementById('process-body');
    body.innerHTML = processes.map((p, i) => `
        <tr>
            <td>${p.id}</td>
            <td><input type="number" value="${p.arrival}" onchange="updateProcess(${i}, 'arrival', this.value)"></td>
            <td><input type="number" value="${p.burst}" onchange="updateProcess(${i}, 'burst', this.value)"></td>
            <td><button onclick="removeProcess(${i})">×</button></td>
        </tr>
    `).join('');
}

function updateProcess(index, key, val) {
    processes[index][key] = parseInt(val);
}

function toggleQuantum() {
    const algo = document.getElementById('algo-choice').value;
    document.getElementById('quantum').style.display = (algo === 'RR') ? 'inline-block' : 'none';
}

function runSimulation() {
    const algo = document.getElementById('algo-choice').value;
    let timeline = [];
    let explainText = "";

    if (algo === 'FCFS') {
        timeline = calcFCFS();
        explainText = "<strong>First Come, First Served:</strong> Processes are attended to in the exact order they arrive. It is simple but can lead to the 'Convoy Effect' where long processes delay shorter ones.";
    } else if (algo === 'SJF') {
        timeline = calcSJF();
        explainText = "<strong>Shortest Job First:</strong> By choosing the smallest burst time available, we minimize the overall average waiting time. This is optimal but requires knowing the future!";
    } else if (algo === 'RR') {
        timeline = calcRR();
        explainText = "<strong>Round Robin:</strong> Each process gets a small fixed slice of time (Quantum). This ensures responsiveness, making it ideal for interactive systems.";
    }

    renderGantt(timeline);
    renderStats(timeline);
    document.getElementById('explanation-box').innerHTML = explainText;
    document.getElementById('results-section').style.display = 'block';
}

function calcFCFS() {
    let time = 0;
    let result = [];
    let sorted = [...processes].sort((a, b) => a.arrival - b.arrival);
    
    sorted.forEach(p => {
        if (time < p.arrival) time = p.arrival;
        let start = time;
        time += p.burst;
        result.push({ id: p.id, start, end: time, arrival: p.arrival });
    });
    return result;
}

function calcSJF() {
    let time = 0;
    let result = [];
    let ready = [];
    let pool = [...processes].sort((a, b) => a.arrival - b.arrival);
    
    while (pool.length > 0 || ready.length > 0) {
        while (pool.length > 0 && pool[0].arrival <= time) {
            ready.push(pool.shift());
        }
        if (ready.length === 0) { time = pool[0].arrival; continue; }
        
        ready.sort((a, b) => a.burst - b.burst);
        let p = ready.shift();
        let start = time;
        time += p.burst;
        result.push({ id: p.id, start, end: time, arrival: p.arrival });
    }
    return result;
}

function calcRR() {
    let q = parseInt(document.getElementById('quantum').value);
    let time = 0;
    let result = [];
    let queue = [];
    let pool = [...processes].map(p => ({...p, remaining: p.burst})).sort((a, b) => a.arrival - b.arrival);

    while (pool.length > 0 || queue.length > 0) {
        while (pool.length > 0 && pool[0].arrival <= time) queue.push(pool.shift());
        
        if (queue.length === 0) { time = pool[0].arrival; continue; }

        let p = queue.shift();
        let slice = Math.min(p.remaining, q);
        let start = time;
        time += slice;
        p.remaining -= slice;
        
        result.push({ id: p.id, start, end: time, arrival: p.arrival, isComplete: p.remaining === 0 });

        while (pool.length > 0 && pool[0].arrival <= time) queue.push(pool.shift());
        if (p.remaining > 0) queue.push(p);
    }
    return result;
}

function renderGantt(timeline) {
    const chart = document.getElementById('gantt-chart');
    chart.innerHTML = timeline.map(block => `
        <div class="gantt-block" style="flex-grow: ${block.end - block.start}">
            ${block.id}
            <span class="gantt-time">${block.end}</span>
        </div>
    `).join('');
}

function renderStats(timeline) {
    // For simplicity, we calculate Wait Time as (Start of last segment - Arrival) - (Sum of previous segments)
    // A more robust way is tracking completion time for each unique ID.
    const processIds = [...new Set(processes.map(p => p.id))];
    let totalWait = 0;
    let totalTAT = 0;

    processIds.forEach(id => {
        const segments = timeline.filter(t => t.id === id);
        const completionTime = segments[segments.length - 1].end;
        const arrival = processes.find(p => p.id === id).arrival;
        const burst = processes.find(p => p.id === id).burst;
        
        totalTAT += (completionTime - arrival);
        totalWait += (completionTime - arrival - burst);
    });

    document.getElementById('avg-wait').innerText = (totalWait / processIds.length).toFixed(2);
    document.getElementById('avg-tat').innerText = (totalTAT / processIds.length).toFixed(2);
}

// Init
renderTable();