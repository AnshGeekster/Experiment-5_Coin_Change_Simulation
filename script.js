let amount = 0;
let originalAmount = 0;
let denoms = [];
let steps = [];
let currentStep = 0;
let autoInterval = null;
let startTime = 0;   // For measuring execution time
let highlightQueue = [];
let highlightProcessing = false;
let highlightDelay = 500; // ms between highlighted lines (animation time) — increased for slower, clearer visuals
let stepInProgress = false;

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
    const isLoopLine = (line >= 5 && line <= 8);
setTimeout(processHighlightQueue, isLoopLine ? 250 : highlightDelay);

}

// Called when a pseudocode line is highlighted; triggers UI updates that should run
// in parallel with the highlighting (e.g., showing Remaining Amount, loading coins)
function handlePseudoLine(lineNumber) {
    // Line 1: read amount -> show Remaining Amount
    if (lineNumber === 1 && !remainingLoaded) {
        const rem = document.getElementById("remainingAmount");
        if (rem) rem.innerHTML = "Remaining Amount: " + amount;
        remainingLoaded = true;
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
    els.forEach(e => e.classList.remove('active','fill','done'));

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
    const lines = text.replace(/\r/g,'').split('\n');
    pre.innerHTML = lines.map((line, i) =>
        `<div class="code-line" data-line="${i+1}"><span class="line-text">${line}</span></div>`
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




// -------------------- PANEL 2: GREEDY VS OPTIMAL DP --------------------
function runSimulation2() {
   const amountInput = document.getElementById("amount2").value;
    const denomsInput = document.getElementById("denoms2").value;

    const parsedDenoms = validateInputs(amountInput, denomsInput);
    if (!parsedDenoms) return; // stop execution if invalid

    let amount = parseInt(amountInput);
    let denoms = parsedDenoms;

    if (!amount || denoms.length === 0) {
        alert("Please enter valid inputs!");
        return;
    }

    // Greedy algorithm
    let startGreedy = performance.now();
    denoms.sort((a,b)=>b-a);
    let greedyCoins = [];
    let remaining = amount;
    denoms.forEach(coin => {
        while (remaining >= coin) {
            greedyCoins.push(coin);
            remaining -= coin;
        }
    });
    let greedyTime = performance.now() - startGreedy;

    // Optimal DP algorithm
    let startDP = performance.now();
    let dp = Array(amount+1).fill(Infinity);
    let parent = Array(amount+1).fill(-1);
    dp[0] = 0;

    for (let i=1; i<=amount; i++) {
        for (let coin of denoms) {
            if (i-coin>=0 && dp[i-coin]+1<dp[i]) {
                dp[i] = dp[i-coin]+1;
                parent[i] = coin;
            }
        }
    }

    let optimalCoins = [];
    let curr = amount;
    while (curr > 0) {
        optimalCoins.push(parent[curr]);
        curr -= parent[curr];
    }
    let dpTime = performance.now() - startDP;

    // Populate outputs
    document.getElementById("greedy-steps2").innerHTML = greedyCoins.map(c=>`<div class='coin greedy-coin'>₹${c}</div>`).join("");
    document.getElementById("greedy-summary2").innerHTML = `
        <b>Total Coins Used:</b> ${greedyCoins.length}<br>
        <b>Execution Time:</b> ${greedyTime.toFixed(3)} ms<br>
        <h4>Frequency Table</h4>
        ${buildFreqTable2(greedyCoins)}
    `;

    document.getElementById("optimal-container2").innerHTML = optimalCoins.map(c=>`<div class='coin optimal-coin'>₹${c}</div>`).join("");
    document.getElementById("optimal-summary2").innerHTML = `
        <b>Total Coins Used:</b> ${optimalCoins.length}<br>
        <b>Execution Time:</b> ${dpTime.toFixed(3)} ms<br>
        <h4>Frequency Table</h4>
        ${buildFreqTable2(optimalCoins)}
    `;

    let efficiency = (optimalCoins.length / greedyCoins.length * 100).toFixed(2);
    document.getElementById("compare-box2").innerHTML = `
        <b>Greedy Coins:</b> ${greedyCoins.length}<br>
        <b>Optimal Coins:</b> ${optimalCoins.length}<br>
        <b>Efficiency:</b> ${efficiency}%<br>
        ${efficiency==100? "<span style='color:green'>Greedy is optimal ✔</span>":"<span style='color:red'>Greedy is NOT optimal ✘</span>"}
    `;
}

// Register a callback to execute when a particular pseudocode line finishes its highlight
function registerLineCallback(lineNumber, cb) {
    lineCallbacks[lineNumber] = lineCallbacks[lineNumber] || [];
    lineCallbacks[lineNumber].push(cb);
}


// Helper for frequency table
function buildFreqTable2(arr) {
    let freq = {};
    arr.forEach(c => freq[c] = (freq[c] || 0)+1);

    let html = `<table><tr><th>Coin</th><th>Count</th></tr>`;
    for (let c in freq) {
        html += `<tr><td>₹${c}</td><td>${freq[c]}</td></tr>`;
    }
    html += `</table>`;
    return html;
}


function applyCurrencySystem(currencySelectId = "currencySystem", denomsId = "denoms") {
    const systemSelect = document.getElementById(currencySelectId);
    const denomsInput = document.getElementById(denomsId);
    if (!systemSelect || !denomsInput) return;

    const system = systemSelect.value;

    if (system === "indian") {
        denomsInput.value = "1,2,5,10,20,50,100,200,500,2000";
    }
    else if (system === "old_british") {
        denomsInput.value = "1,6,7,12";
    }
    else if (system === "custom") {
        denomsInput.value = "";
        denomsInput.placeholder = "Enter custom denominations...";
    }

    // Extra validation: if user manually types, check input immediately
    denomsInput.addEventListener("blur", () => {
        validateInputs("1", denomsInput.value); // dummy amount for checking only denoms
    });
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

    // mark as active then trigger fill animation
    const isLoopLine = (lineNumber >= 6 && lineNumber <= 8);
    line.classList.add('active');
    txt.classList.remove('fill');
    // move the arrow to this line (use faster speed for loop lines)
    movePseudoArrow(lineNumber, isLoopLine);
    // small delay to ensure class removal takes effect before adding fill
    setTimeout(() => {
        txt.classList.add('fill');
    }, 20);

    // after the animation completes, mark as done so it stays filled
    setTimeout(() => {
        txt.classList.add('done');
        line.classList.remove('active');

        // run and clear any callbacks registered for this line (e.g., coin selection after loop iteration)
        const ln = parseInt(line.dataset.line, 10);
        if (lineCallbacks[ln] && lineCallbacks[ln].length) {
            const cbs = lineCallbacks[ln].slice();
            lineCallbacks[ln] = [];
            cbs.forEach(cb => {
                try { cb(); } catch (e) { console.error('line callback error', e); }
            });
        }
    }, highlightDelay - 100);
}


function startSimulation() {

    const amountInput = document.getElementById("amount").value;
    const denomsInput = document.getElementById("denoms").value;

    const parsedDenoms = validateInputs(amountInput, denomsInput);
    if (!parsedDenoms) return; // stop if invalid inputs

    amount = parseInt(amountInput);
    originalAmount = amount;
    denoms = parsedDenoms.sort((a, b) => b - a);

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

    let temp = amount;
    let i = 0;
    while (temp > 0) {
        if (denoms[i] <= temp) {
            // highlight the while-condition when we take a coin
            enqueueHighlight(5);
            steps.push(denoms[i]);
            temp -= denoms[i];
        } else {
            i++;
        }
    }
}

function nextStep() {
    // prevent overlapping steps; wait for the current iteration's callback to finish
    if (stepInProgress) return;
    stepInProgress = true;

    enqueueHighlight(6);  // choosing coin
    enqueueHighlight(7); // subtracting amount
    enqueueHighlight(8); // recording

    if (currentStep >= steps.length) {
        stepInProgress = false;
        finishSimulation();
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
        remainingLoaded = true;

        currentStep++;
        stepInProgress = false;

        if (currentStep === steps.length) {
            finishSimulation();
            highlightLine(9);
        }
    });
}

function autoRun() {
    autoInterval = setInterval(() => {
        if (currentStep >= steps.length) {
            clearInterval(autoInterval);
            finishSimulation();
        } else {
            nextStep();
        }
    }, highlightDelay + 120);
}

function finishSimulation() {
    // stop any running auto-run
    if (autoInterval) {
        clearInterval(autoInterval);
        autoInterval = null;
    }

    document.getElementById("nextBtn").disabled = true;
    document.getElementById("autoBtn").disabled = true;

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

    const advBtn = document.getElementById("advancedBtn");
    if (advBtn) advBtn.disabled = false;
}

function resetAll() {
    location.reload();
}

// Open advanced page with current inputs as URL params
function openAdvanced() {
    const amount = document.getElementById("amount").value;
    const denoms = document.getElementById("denoms").value;

    if (!amount || !denoms) {
        alert("Please enter amount and denominations first!");
        return;
    }

    const params = new URLSearchParams();
    params.set("amount", amount);
    params.set("denoms", denoms);

    window.open("advanced.html?" + params.toString(), "_blank");
}

// Go back to index (used by advanced page)
function goBack() {
    window.location.href = "index.html";
}

// Prefill advanced page inputs using URL parameters (if any)
function prefillAdvancedParams() {
    const aField = document.getElementById("amount2");
    const dField = document.getElementById("denoms2");
    if (!aField && !dField) return; // nothing to do when not on advanced page

    const p = new URLSearchParams(window.location.search);
    const a = p.get("amount");
    const d = p.get("denoms");
    if (a) aField.value = a;
    if (d) dField.value = d;
}



// DOM-ready initializer: run prefill on pages that have advanced inputs
document.addEventListener("DOMContentLoaded", () => {
    // Only attempt to prefill when advanced page elements exist
    if (document.getElementById("amount2") || document.getElementById("denoms2")) {
        prefillAdvancedParams();
    }

    // Ensure Next Step, Auto Run and Advanced buttons are disabled initially on index page
    const nextBtn = document.getElementById("nextBtn");
    const autoBtn = document.getElementById("autoBtn");
    const advBtn = document.getElementById("advancedBtn");
    if (nextBtn) nextBtn.disabled = true;
    if (autoBtn) autoBtn.disabled = true;
    if (advBtn) advBtn.disabled = true;
    // initialize pseudocode DOM lines for highlighting
    initializePseudocode();
});

function resetAdvanced() {
    // Stop any interval and clear simulation state
    if (autoInterval) {
        clearInterval(autoInterval);
        autoInterval = null;
    }
    currentStep = 0;
    steps = [];
    amount = 0;
    originalAmount = 0;

    // Reset inputs (use a reasonable default for denominations)
    const amountField = document.getElementById("amount2");
    const denomsField = document.getElementById("denoms2");
    if (amountField) amountField.value = "";
    if (denomsField) denomsField.value = "1,2,5,10,20,50,100";

    // Clear outputs on the advanced page
    ["greedy-steps2","greedy-summary2","optimal-container2","optimal-summary2","compare-box2"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = "";
    });

    // clear any pending callbacks and step state
    lineCallbacks = {};
    stepInProgress = false;
    clearHighlightQueue();
}
