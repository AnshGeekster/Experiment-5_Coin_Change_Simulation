function previousStep() {
    if (stepInProgress) return;
    if (currentStep <= 0) return;
    stepInProgress = true;

    // Remove last coin from selectedCoins
    let box = document.getElementById("selectedCoins");
    if (box && box.lastChild) {
        box.removeChild(box.lastChild);
    }

    // Restore amount
    currentStep--;
    let coin = steps[currentStep];
    amount += coin;
    const remEl = document.getElementById("remainingAmount");
    if (remEl) remEl.innerHTML = "Remaining Amount: " + amount;
    try { popLastLog(); } catch (e) { }

    // Remove highlight from all coins
    document.querySelectorAll('#coinBox .coin').forEach(c => c.classList.remove("highlight"));

    // Optionally highlight the coin just undone
    const coinEl = document.getElementById("coin_" + coin);
    if (coinEl) coinEl.classList.add("highlight");

    // Enable/disable buttons as needed
    document.getElementById("nextBtn").disabled = false;
    document.getElementById("autoBtn").disabled = false;
    document.getElementById("pauseBtn").disabled = true;
    document.getElementById("prevBtn").disabled = (currentStep === 0);

    stepInProgress = false;
}
let amount = 0;
let originalAmount = 0;
let denoms = [];
let steps = [];
let currentStep = 0;
let autoInterval = null;
let startTime = 0;   // For measuring execution time
let highlightQueue = [];
let highlightProcessing = false;
let highlightDelay = 500; // default delay
let minDelay = 50;  // Fastest speed (ms)
let maxDelay = 2000; // Slowest speed (ms)
document.addEventListener("click", (e) => {
    const guide = document.getElementById("startGuide");
    if (!guide) return;

    if (
        e.target.id === "nextBtn" ||
        e.target.id === "autoBtn"
    ) {
        guide.classList.remove("show");
    }
});

function updateSpeed() {
    const slider = document.getElementById("speedRange");
    if (!slider) return;

    // Invert the value: higher slider value (100) -> lower delay (minDelay)
    // Formula: delay = maxDelay - ( (val - min) / (max - min) ) * (maxDelay - minDelay)
    // Simplify: val 0-100. 
    // val 1 -> maxDelay
    // val 100 -> minDelay

    const val = parseInt(slider.value);
    const percentage = (val - 1) / 99; // 0 to 1

    // Lerp (Linear Interpolation) inverted
    // newDelay = maxDelay - (percentage * (maxDelay - minDelay))
    const newDelay = maxDelay - (percentage * (maxDelay - minDelay));

    highlightDelay = Math.floor(newDelay);

    // Update slider background gradient to show progress/fill
    const fillPercent = ((val - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.background = `linear-gradient(to right, #0066ff ${fillPercent}%, #d3d3d3 ${fillPercent}%)`;
}
let stepInProgress = false;

// Execution logs utilities: append, clear, toggle
function logExecution(message) {
    try {
        const box = document.getElementById('execLogs');
        if (!box) return;
        const time = new Date().toLocaleTimeString();
        const div = document.createElement('div');
        div.className = 'exec-log-entry';
        div.innerHTML = `<span class="log-time">[${time}]</span> ${message}`;
        box.appendChild(div);
        box.scrollTop = box.scrollHeight;
    } catch (e) {
        console.error('logExecution error', e);
    }
}

function clearExecutionLogs() {
    const box = document.getElementById('execLogs');
    if (box) box.innerHTML = '';
}

function toggleExecPanel() {
    const box = document.getElementById('execLogs');
    if (!box) return;
    box.style.display = (box.style.display === 'none') ? 'block' : 'none';
}

// Remove (pop) the last execution log entry — used when user steps back
function popLastLog() {
    const box = document.getElementById('execLogs');
    if (!box) return;
    if (box.lastElementChild) box.removeChild(box.lastElementChild);
}

// callbacks keyed by pseudocode line number; executed when that line's highlight completes
let lineCallbacks = {};

// Flags to ensure certain UI updates happen exactly once when pseudocode lines run
let remainingLoaded = false;
let coinsLoaded = false;


function validateInputs(amountInput, denomsInput) {
    // Check if amount is empty or not a number
    if (!amountInput || isNaN(amountInput) || parseInt(amountInput) <= 0) {
        alert("Error: Please enter a valid positive amount!");
        return false;
    }
    const amountVal = parseInt(amountInput);

    // Check if amount exceeds 1 crore (10^7)
    if (amountVal > 10000000) {
        alert("Enter a value upto 10^7 for smooth execution.");
        return false;
    }

    // Check if denominations are empty
    if (!denomsInput || denomsInput.trim() === "") {
        alert("Error: Please enter valid denominations separated by commas!");
        return false;
    }

    // Parse denominations
    let denomsArray = denomsInput.split(",").map(d => Number(d.trim()));

    // Check for non-number or zero/negative denominations
    if (denomsArray.some(d => isNaN(d) || d <= 0)) {
        alert("Error: All denominations must be positive numbers!");
        return false;
    }

    // Check for duplicates
    let uniqueDenoms = new Set(denomsArray);
    if (uniqueDenoms.size !== denomsArray.length) {
        alert("Error: Duplicate denominations detected! Please enter unique values.");
        return false;
    }

    // Check if amount is smaller than smallest denomination
    const minDenom = Math.min(...denomsArray);
    if (amountVal < minDenom) {
        alert(`Error: The entered amount (${amountVal}) is smaller than the smallest denomination (${minDenom}).`);
        return false;
    }

    // Check if the amount can actually be formed using these denominations
    // Small DP array to determine if amount is possible
    const dp = Array(amountVal + 1).fill(false);
    dp[0] = true; // 0 can always be made

    for (let i = 1; i <= amountVal; i++) {
        for (let coin of denomsArray) {
            if (i - coin >= 0 && dp[i - coin]) {
                dp[i] = true;
                break;
            }
        }
    }

    if (!dp[amountVal]) {
        alert(`Error: The entered amount (${amountVal}) cannot be formed with the given denominations (${denomsArray.join(", ")}). Please adjust your inputs.`);
        return false;
    }

    return denomsArray; // valid, return parsed array
}


function enqueueHighlight(lineNumber) {
    highlightQueue.push(lineNumber);
    if (!highlightProcessing) processHighlightQueue();
}

function processHighlightQueue() {
    if (highlightQueue.length === 0) {
        highlightProcessing = false;
        return;
    }
    highlightProcessing = true;
    const line = highlightQueue.shift();
    highlightLine(line);
    // Trigger any UI effects that should run in parallel with pseudocode
    handlePseudoLine(line);
    // Use highlightDelay for ALL lines so speed slider controls everything consistently
    setTimeout(processHighlightQueue, highlightDelay);

}

// Called when a pseudocode line is highlighted; triggers UI updates that should run
// in parallel with the highlighting (e.g., showing Remaining Amount, loading coins)
function handlePseudoLine(lineNumber) {
    // Log the pseudocode line (grab text if available)
    try {
        const pre = document.getElementById('pseudocode');
        let linedesc = '';
        if (pre) {
            const lt = pre.querySelector(`.code-line[data-line="${lineNumber}"] .line-text`);
            linedesc = lt ? lt.innerText.trim() : '';
        }
        logExecution(`Pseudocode ${lineNumber}: ${linedesc}`);
    } catch (e) { /* ignore logging errors */ }

    // Line 1: read amount -> show Remaining Amount
    if (lineNumber === 1 && !remainingLoaded) {
        const rem = document.getElementById("remainingAmount");
        if (rem) rem.innerHTML = "Remaining Amount: " + amount;
        remainingLoaded = true;
        logExecution(`Read amount: ${amount} — displayed as Remaining Amount`);
    }

    // Line 2 or 3: read denominations and sort -> show available coins in descending order
    if ((lineNumber === 2 || lineNumber === 3) && !coinsLoaded) {
        // ensure denoms is already set at startSimulation; build UI now
        buildCoinUI();
        // subtle animation for coins to appear sequentially
        const coins = document.querySelectorAll('#coinBox .coin');
        coins.forEach((c, idx) => {
            c.style.opacity = '0';
            c.style.transform = 'translateY(-8px)';
            setTimeout(() => {
                // slightly slower transition for clearer appearance
                c.style.transition = 'opacity 450ms ease, transform 450ms ease';
                c.style.opacity = '1';
                c.style.transform = 'translateY(0)';
            }, idx * 120);
        });

        coinsLoaded = true;
        try { logExecution(`Loaded available coins: ${denoms.join(', ')}`); } catch (e) { }
    }
}

function clearHighlightQueue() {
    highlightQueue = [];
    highlightProcessing = false;
    clearAllHighlights();
    // also reset step-in-progress state (in case clearing while mid-step)
    stepInProgress = false;
}

function clearAllHighlights() {
    const pseudo = document.getElementById('pseudocode');
    if (!pseudo) return;
    const els = pseudo.querySelectorAll('.code-line .line-text');
    els.forEach(e => e.classList.remove('active', 'fill', 'done'));

    // hide arrow indicator if present
    const box = pseudo.parentElement;
    if (box) {
        const arrow = box.querySelector('.pseudo-arrow');
        if (arrow) arrow.classList.remove('visible');
    }

    // clear any pending callbacks (prevent stray coin additions after reset)
    lineCallbacks = {};
}

function initializePseudocode() {
    const pre = document.getElementById('pseudocode');
    if (!pre) return;
    const text = pre.textContent || pre.innerText || '';
    const lines = text.replace(/\r/g, '').split('\n');
    pre.innerHTML = lines.map((line, i) =>
        `<div class="code-line" data-line="${i + 1}"><span class="line-text">${line}</span></div>`
    ).join('');

    // create a single arrow indicator inside the pseudocode box (if not already present)
    const box = pre.parentElement; // #pseudocodeBox
    if (box && !box.querySelector('.pseudo-arrow')) {
        const arrow = document.createElement('div');
        arrow.className = 'pseudo-arrow';
        arrow.innerHTML = '➤';
        box.appendChild(arrow);
    }
}

// Move the arrow to the vertical position of a given pseudocode line (1-based index)
function movePseudoArrow(lineNumber, fast = false) {
    const pre = document.getElementById('pseudocode');
    if (!pre) return;
    const box = pre.parentElement;
    if (!box) return;
    const arrow = box.querySelector('.pseudo-arrow');
    const lines = pre.querySelectorAll('.code-line');
    const idx = lineNumber - 1;
    if (!arrow || idx < 0 || idx >= lines.length) return;

    const line = lines[idx];
    const boxRect = box.getBoundingClientRect();
    const lineRect = line.getBoundingClientRect();
    const top = lineRect.top - boxRect.top + (lineRect.height / 2) - (arrow.offsetHeight / 2);

    // use an even shorter duration for loop lines to keep the arrow strictly in sync
    const duration = fast ? 6 : 80; // 6ms when fast mode is requested (very snappy)
    arrow.style.transition = `top ${duration}ms cubic-bezier(0.2,0.8,0.2,1), opacity ${duration}ms linear, transform ${duration}ms cubic-bezier(0.2,0.8,0.2,1)`;

    // move with requestAnimationFrame to ensure the browser applies the transition
    requestAnimationFrame(() => {
        arrow.style.top = top + 'px';
        arrow.classList.add('visible');
    });
}




// Advanced comparison page removed.

// Register a callback to execute when a particular pseudocode line finishes its highlight
function registerLineCallback(lineNumber, cb) {
    lineCallbacks[lineNumber] = lineCallbacks[lineNumber] || [];
    lineCallbacks[lineNumber].push(cb);
}


// Helper for frequency table
// buildFreqTable2 removed with advanced page.


function applyCurrencySystem(currencySelectId = "currencySystem", denomsId = "denoms") {
    const systemSelect = document.getElementById(currencySelectId);
    const denomsInput = document.getElementById(denomsId);
    if (!systemSelect || !denomsInput) return;

    const system = systemSelect.value;

    // Infer the corresponding amount input id from the currency selector id.
    // e.g., 'currencySystem' -> 'amount', 'currencySystem2' -> 'amount2'
    const amountId = currencySelectId.replace('currencySystem', 'amount');
    const amountInputField = document.getElementById(amountId);

    if (system === "indian") {
        denomsInput.value = "1,2,5,10,20,50,100,200,500,2000";
    }
    else if (system === "old_british") {
        denomsInput.value = "1,6,7,12";
    }
    else if (system === "custom") {
        denomsInput.value = "";
        denomsInput.placeholder = "Enter custom denominations...";

        // Also reset the corresponding amount field when selecting custom
        if (amountInputField) {
            amountInputField.value = "";
            amountInputField.placeholder = "Enter amount...";
            // Reset displayed remaining amount on the main panel if present
            const rem = document.getElementById('remainingAmount');
            if (rem) rem.innerHTML = "Remaining Amount: --";
        }
    }

    // Extra validation: if user manually types, check input on blur.
    // Use a silent/basic check (no alert) to verify format/positivity/uniqueness.
    // Only run full `validateInputs` (which shows alerts) if a non-empty amount field exists.
    denomsInput.onblur = () => {
        const val = denomsInput.value ? denomsInput.value.trim() : "";

        if (!val) {
            denomsInput.classList.remove('invalid');
            denomsInput.title = "";
            return;
        }

        const arr = val.split(",").map(d => Number(d.trim()));

        // Basic format checks (silent): numeric & positive
        if (arr.some(d => isNaN(d) || d <= 0)) {
            denomsInput.classList.add('invalid');
            denomsInput.title = "All denominations must be positive numbers separated by commas.";
            return;
        }

        // Uniqueness check (silent)
        if (new Set(arr).size !== arr.length) {
            denomsInput.classList.add('invalid');
            denomsInput.title = "Duplicate denominations detected.";
            return;
        }

        // If there's an amount field and it has a value, run full validation (this may show alerts when truly needed)
        if (amountInputField && amountInputField.value) {
            const parsed = validateInputs(amountInputField.value, denomsInput.value);
            if (!parsed) {
                // validateInputs already displays alerts for critical errors; clear any visual invalid state here
                denomsInput.classList.remove('invalid');
                denomsInput.title = "";
            } else {
                denomsInput.classList.remove('invalid');
                denomsInput.title = "";
            }
        } else {
            denomsInput.classList.remove('invalid');
            denomsInput.title = "";
        }
    };
}

function highlightLine(lineNumber) {
    const pseudo = document.getElementById('pseudocode');
    if (!pseudo) return;
    const lines = pseudo.querySelectorAll('.code-line');
    if (!lines || lines.length === 0) return;

    const idx = lineNumber - 1;
    if (idx < 0 || idx >= lines.length) return;
    const line = lines[idx];
    const txt = line.querySelector('.line-text');
    if (!txt) return;

    // Determine loop vs one-time lines
    const isLoopLine = (lineNumber >= 5 && lineNumber <= 8);
    const isOneTimeLine = (lineNumber >= 1 && lineNumber <= 4);

    // Move arrow (always)
    movePseudoArrow(lineNumber, isLoopLine);

    if (isOneTimeLine) {
        // For lines 1-4: mark permanently as done once highlighted
        txt.classList.add('done');
        // run callbacks after a short delay to preserve timing
        setTimeout(() => {
            const ln = parseInt(line.dataset.line, 10);
            if (lineCallbacks[ln] && lineCallbacks[ln].length) {
                const cbs = lineCallbacks[ln].slice();
                lineCallbacks[ln] = [];
                cbs.forEach(cb => { try { cb(); } catch (e) { console.error('line callback error', e); } });
            }
        }, Math.max(80, highlightDelay - 200));
        return;
    }

    if (isLoopLine) {
        // Toggle highlight among loop lines (5-8)
        // remove loop-active from any other loop line
        const loopLines = pseudo.querySelectorAll('.code-line');
        loopLines.forEach(l => {
            const lt = l.querySelector('.line-text');
            if (!lt) return;
            const ln = parseInt(l.dataset.line, 10);
            if (ln >= 5 && ln <= 8 && ln !== lineNumber) lt.classList.remove('loop-active');
        });

        // activate current loop line visually
        txt.classList.add('loop-active');

        // run callbacks after highlightDelay/2 to make UI feel responsive
        setTimeout(() => {
            const ln = parseInt(line.dataset.line, 10);
            if (lineCallbacks[ln] && lineCallbacks[ln].length) {
                const cbs = lineCallbacks[ln].slice();
                lineCallbacks[ln] = [];
                cbs.forEach(cb => { try { cb(); } catch (e) { console.error('line callback error', e); } });
            }
        }, Math.floor(Math.max(80, highlightDelay / 2)));
        return;
    }

    // Fallback for other lines: briefly show as loop-active then mark done
    txt.classList.add('loop-active');
    setTimeout(() => {
        txt.classList.add('done');
        txt.classList.remove('loop-active');
        const ln = parseInt(line.dataset.line, 10);
        if (lineCallbacks[ln] && lineCallbacks[ln].length) {
            const cbs = lineCallbacks[ln].slice();
            lineCallbacks[ln] = [];
            cbs.forEach(cb => { try { cb(); } catch (e) { console.error('line callback error', e); } });
        }
    }, Math.max(80, highlightDelay - 100));
}


function startSimulation() {
     const guide = document.getElementById("startGuide");
    if (guide) {
        guide.classList.add("show");
    }


    const amountInput = document.getElementById("amount").value;
    const denomsInput = document.getElementById("denoms").value;

    // Sync speed with slider before starting
    updateSpeed();

    const parsedDenoms = validateInputs(amountInput, denomsInput);
    if (!parsedDenoms) return; // stop if invalid inputs

    amount = parseInt(amountInput);
    originalAmount = amount;
    denoms = parsedDenoms.sort((a, b) => b - a);

    // reset logs for a fresh run and record starting state
    clearExecutionLogs();
    logExecution(`Simulation started — amount: ${amount}; denominations: ${denoms.join(', ')}`);

    // Reset simulation internals
    steps = [];
    currentStep = 0;

    // Clear visible outputs but keep "Remaining Amount" blank until line 1 highlights
    const sel = document.getElementById("selectedCoins");
    if (sel) sel.innerHTML = "";
    const sum = document.getElementById("summary");
    if (sum) sum.innerHTML = "";
    const rem = document.getElementById("remainingAmount");
    if (rem) rem.innerHTML = "Remaining Amount: --";

    // Clear coin box now (will be populated when pseudocode lines 2/3 run)
    const box = document.getElementById("coinBox");
    if (box) box.innerHTML = "";

    // Reset flags so handlePseudoLine will perform the updates once
    remainingLoaded = false;
    coinsLoaded = false;

    // Prepare paced highlighting AFTER inputs are read
    clearHighlightQueue();
    enqueueHighlight(1);   // reading amount
    enqueueHighlight(2);
    enqueueHighlight(3);

    precomputeSteps();

    document.getElementById("nextBtn").disabled = false;
    document.getElementById("pauseBtn").disabled = true; // only enabled during auto run
    document.getElementById("autoBtn").disabled = false;

    startTime = performance.now();   // Start time
}

function buildCoinUI() {
    let box = document.getElementById("coinBox");
    box.innerHTML = "";
    denoms.forEach(d => {
        let c = document.createElement("div");
        c.className = "coin";
        c.id = "coin_" + d;
        c.innerHTML = d;
        box.appendChild(c);
    });
}

function precomputeSteps() {

    // Queue checking denomination highlight once
    enqueueHighlight(4);

    // Efficiently compute how many times each denomination will be used
    // instead of iterating one-by-one which can be slow for large amounts.
    let temp = amount;
    for (let i = 0; i < denoms.length && temp > 0; i++) {
        const coin = denoms[i];
        const count = Math.floor(temp / coin);
        for (let k = 0; k < count; k++) {
            steps.push(coin);
        }
        temp -= count * coin;
    }
}

function nextStep() {
    // prevent overlapping steps; wait for the current iteration's callback to finish
    if (stepInProgress) return;
    stepInProgress = true;
    // Keep Previous disabled during auto-run; enable only for manual stepping
    const prevBtn = document.getElementById("prevBtn");
    if (prevBtn) prevBtn.disabled = !!autoInterval;

    // Highlight the loop 'while amount >= d' before choosing/subtracting/recording
    enqueueHighlight(5);
    enqueueHighlight(6);  // choosing coin
    enqueueHighlight(7); // subtracting amount
    enqueueHighlight(8); // recording

    if (currentStep >= steps.length) {
        stepInProgress = false;
        finishSimulation();
        document.getElementById("nextBtn").disabled = true;
        document.getElementById("autoBtn").disabled = true;
        return;
    }

    let coin = steps[currentStep];

    // Ensure coin UI exists (in case user clicked Next before pseudocode loaded coins)
    if (!document.getElementById("coin_" + coin)) {
        buildCoinUI();
        coinsLoaded = true; // mark as loaded since we built it here
    }

    // highlight the coin in the available coins box immediately
    document.querySelectorAll('#coinBox .coin').forEach(c => c.classList.remove("highlight"));
    const coinEl = document.getElementById("coin_" + coin);
    if (coinEl) coinEl.classList.add("highlight");

    // register a callback to actually add the coin to the "Coins Used" list
    // when the loop's recording line (line 8) finishes its highlight
    registerLineCallback(8, () => {
        // append coin to selected list
        let box = document.getElementById("selectedCoins");
        let c = document.createElement("div");
        c.className = "coin highlight";
        c.innerHTML = coin;
        box.appendChild(c);

        // remove highlight from the coin in coinBox and update remaining amount
        if (coinEl) coinEl.classList.remove("highlight");

        amount -= coin;
        const remEl = document.getElementById("remainingAmount");
        if (remEl) remEl.innerHTML = "Remaining Amount: " + amount;
        // log the recorded coin and new remaining amount
        try { logExecution(`Recorded coin ${coin}. New remaining amount: ${amount}`); } catch (e) { }
        remainingLoaded = true;

        currentStep++;
        stepInProgress = false;
        // If auto-run is active, keep Previous disabled; otherwise enable based on step
        const prevBtn2 = document.getElementById("prevBtn");
        if (prevBtn2) prevBtn2.disabled = autoInterval ? true : (currentStep === 0);
        if (currentStep === steps.length) {
            finishSimulation();
            highlightLine(9);
            document.getElementById("nextBtn").disabled = true;
            document.getElementById("autoBtn").disabled = true;
        }
    });
}

function pauseSimulation() {
    // Clear running flag
    autoInterval = null;

    // Enable single-step controls
    document.getElementById("nextBtn").disabled = false;
    document.getElementById("prevBtn").disabled = true;
    document.getElementById("autoBtn").disabled = false;
    document.getElementById("pauseBtn").disabled = true;

    // Re-enable Start button on pause
    const startBtn = document.getElementById("startBtn");
    if (startBtn) startBtn.disabled = false;
}

function autoRun() {
    // Disable controls during auto-run
    document.getElementById("nextBtn").disabled = true;
    document.getElementById("autoBtn").disabled = true;

    // Disable Start button to prevent interruption
    const startBtn = document.getElementById("startBtn");
    if (startBtn) startBtn.disabled = true;

    // Enable Pause
    document.getElementById("pauseBtn").disabled = false;

    // Keep Previous disabled while auto-running
    const prev = document.getElementById("prevBtn");
    if (prev) prev.disabled = true;

    function runLoop() {
        if (!autoInterval) return; // halted
        if (currentStep >= steps.length) {
            autoInterval = null; // stop the flag
            finishSimulation();
        } else {
            nextStep();
            // Reschedule next call based on CURRENT highlightDelay
            // Adding a small buffer to ensure visual smoothness
            setTimeout(runLoop, highlightDelay + 120);
        }
    }

    // Set a flag to indicate running (we use autoInterval variable as a boolean flag now, or dummy id)
    autoInterval = 1;
    runLoop();
}

function finishSimulation() {
    autoInterval = null;

    document.getElementById("nextBtn").disabled = true;
    document.getElementById("pauseBtn").disabled = true;
    document.getElementById("autoBtn").disabled = true;

    // Re-enable Start button when finished
    const startBtn = document.getElementById("startBtn");
    if (startBtn) startBtn.disabled = false;

    // ensure step state resets
    stepInProgress = false;

    let endTime = performance.now();
    let execTime = (endTime - startTime).toFixed(3);

    let coinCountMap = {};
    steps.forEach(c => {
        coinCountMap[c] = (coinCountMap[c] || 0) + 1;
    });
    enqueueHighlight(9);

    let summaryHTML = `
        <table>
            <tr>
                <th>Coin</th>
                <th>Times Used</th>
                <th>Total Contribution</th>
            </tr>
    `;

    let totalCoins = steps.length;

    for (let c in coinCountMap) {
        summaryHTML += `
            <tr>
                <td>${c}</td>
                <td>${coinCountMap[c]}</td>
                <td>${c * coinCountMap[c]}</td>
            </tr>
        `;
    }
    summaryHTML += `</table><br>`;

    let efficiency = ((totalCoins / totalCoins) * 100).toFixed(2);

    summaryHTML += `
        <p><b>Total Coins Used:</b> ${totalCoins}</p>
        <p><b>Execution Time:</b> ${execTime} ms</p>
        <p><b>Efficiency:</b> ${efficiency}%</p>
    `;

    document.getElementById("summary").innerHTML = summaryHTML;

    try { logExecution(`Simulation finished. Total coins used: ${totalCoins}. Execution time: ${execTime} ms`); } catch (e) { }
}

function resetAll() {
    location.reload();
}

// Open advanced page with current inputs as URL params
// Advanced page and related navigation removed from the UI.



// DOM-ready initializer: run prefill on pages that have advanced inputs
document.addEventListener("DOMContentLoaded", () => {
    // Ensure Next Step, Auto Run buttons are disabled initially on index page
    const nextBtn = document.getElementById("nextBtn");
    const pauseBtn = document.getElementById("pauseBtn");
    const autoBtn = document.getElementById("autoBtn");

    if (nextBtn) nextBtn.disabled = true;
    if (pauseBtn) pauseBtn.disabled = true;
    if (autoBtn) autoBtn.disabled = true;

    // Initialize slider fill
    updateSpeed();

    // initialize pseudocode DOM lines for highlighting
    initializePseudocode();
});

// Advanced reset removed (advanced UI no longer present).
