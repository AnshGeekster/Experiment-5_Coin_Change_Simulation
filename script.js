let amount = 0;
let originalAmount = 0;
let denoms = [];
let steps = [];
let currentStep = 0;
let autoInterval = null;
let startTime = 0;   // For measuring execution time
let highlightQueue = [];
let highlightProcessing = false;
let highlightDelay = 550; // ms between highlighted lines (animation time)
let stepInProgress = false;

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
    setTimeout(processHighlightQueue, highlightDelay);
}

function clearHighlightQueue() {
    highlightQueue = [];
    highlightProcessing = false;
    clearAllHighlights();
}

function clearAllHighlights() {
    const pseudo = document.getElementById('pseudocode');
    if (!pseudo) return;
    const els = pseudo.querySelectorAll('.code-line .line-text');
    els.forEach(e => e.classList.remove('active','fill','done'));
}

function initializePseudocode() {
    const pre = document.getElementById('pseudocode');
    if (!pre) return;
    const text = pre.textContent || pre.innerText || '';
    const lines = text.replace(/\r/g,'').split('\n');
    pre.innerHTML = lines.map((line, i) =>
        `<div class="code-line" data-line="${i+1}"><span class="line-text">${line}</span></div>`
    ).join('');
}


// -------------------- PANEL 2: GREEDY VS OPTIMAL DP --------------------
function runSimulation2() {
    let amount = parseInt(document.getElementById("amount2").value);
    let denoms = document.getElementById("denoms2").value.split(",").map(Number);

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
        // OLD BRITISH CURRENCY 
        denomsInput.value = "1,6,7,12";
    }
    else if (system === "custom") {
        denomsInput.value = "";
        denomsInput.placeholder = "Enter custom denominations...";
    }
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
    line.classList.add('active');
    txt.classList.remove('fill');
    // small delay to ensure class removal takes effect before adding fill
    setTimeout(() => {
        txt.classList.add('fill');
    }, 20);

    // after the animation completes, mark as done so it stays filled
    setTimeout(() => {
        txt.classList.add('done');
        line.classList.remove('active');
    }, highlightDelay - 100);
}


function startSimulation() {
    // Prepare paced highlighting
    clearHighlightQueue();
    enqueueHighlight(1);   // reading amount
    enqueueHighlight(2);
    enqueueHighlight(3);

    amount = parseInt(document.getElementById("amount").value);
    originalAmount = amount;
    denoms = document.getElementById("denoms").value
                 .split(",").map(Number).sort((a, b) => b - a);

    steps = [];
    currentStep = 0;

    document.getElementById("selectedCoins").innerHTML = "";
    document.getElementById("summary").innerHTML = "";
    document.getElementById("remainingAmount").innerHTML = "Remaining Amount: " + amount;

    buildCoinUI();
    precomputeSteps();

    document.getElementById("nextBtn").disabled = false;
    document.getElementById("autoBtn").disabled = false;
    const advBtn = document.getElementById("advancedBtn");
    if (advBtn) advBtn.disabled = false;

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
    enqueueHighlight(6);  // choosing coin
    enqueueHighlight(7); // subtracting amount
    enqueueHighlight(8); // recording

    if (currentStep >= steps.length) {
        finishSimulation();
        return;
    }

    let coin = steps[currentStep];

    document.querySelectorAll('.coin').forEach(c => c.classList.remove("highlight"));
    document.getElementById("coin_" + coin).classList.add("highlight");

    let box = document.getElementById("selectedCoins");
    let c = document.createElement("div");
    c.className = "coin highlight";
    c.innerHTML = coin;
    box.appendChild(c);

    amount -= coin;
    document.getElementById("remainingAmount").innerHTML = "Remaining Amount: " + amount;

    currentStep++;

    if (currentStep === steps.length) {
        finishSimulation();
          highlightLine(9);
    }
}

function autoRun() {
    autoInterval = setInterval(() => {
        if (currentStep >= steps.length) {
            clearInterval(autoInterval);
            finishSimulation();
        } else {
            nextStep();
        }
    }, highlightDelay + 100);
}

function finishSimulation() {
    document.getElementById("nextBtn").disabled = true;
    document.getElementById("autoBtn").disabled = true;

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
}