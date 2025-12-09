let amount = 0;
let originalAmount = 0;
let denoms = [];
let steps = [];
let currentStep = 0;
let autoInterval = null;
let startTime = 0;   // For measuring execution time

function startSimulation() {
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
    let temp = amount;
    let i = 0;
    while (temp > 0) {
        if (denoms[i] <= temp) {
            steps.push(denoms[i]);
            temp -= denoms[i];
        } else {
            i++;
        }
    }
}

function nextStep() {
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
    }, 600);
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
