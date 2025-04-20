
let derivSocket;
const config = {
    apiToken: '',
    symbol: 'R_10',
    stake: 1.0,
    takeProfit: 2.0,
    stopLoss: 2.0
};

function logMessage(msg) {
    const logDiv = document.getElementById("log");
    logDiv.innerHTML += msg + "<br>";
    logDiv.scrollTop = logDiv.scrollHeight;
}

function startTrading() {
    const token = document.getElementById("apiToken").value.trim();
    const symbol = document.getElementById("symbol").value;
    if (!token) {
        logMessage("Please enter a valid API token.");
        return;
    }
    config.apiToken = token;
    config.symbol = symbol;
    document.getElementById("startBtn").disabled = true;
    document.getElementById("stopBtn").disabled = false;
    logMessage("Starting trading...");
    initSocket(token);
}

function stopTrading() {
    if (derivSocket) derivSocket.close();
    logMessage("Stopped trading.");
    document.getElementById("startBtn").disabled = false;
    document.getElementById("stopBtn").disabled = true;
}

function initSocket(token) {
    derivSocket = new WebSocket("wss://ws.deriv.com/websockets/v3/websocket.json");

    derivSocket.onopen = () => {
        logMessage("WebSocket connected. Sending authorization...");
        derivSocket.send(JSON.stringify({ authorize: token }));
    };

    derivSocket.onerror = (err) => {
        logMessage("WebSocket Error: Connection issue. Please check your network, HTTPS, or token validity.");
        console.error("WebSocket error event:", err);
    };

    derivSocket.onclose = (event) => {
        logMessage("WebSocket connection closed (code: " + event.code + ", reason: " + event.reason + ")");
    };

    derivSocket.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        console.log("WebSocket message:", data);
        logMessage("Received: " + data.msg_type);
        if (data.error) {
            logMessage("Error: " + data.error.message);
            stopTrading();
        }
        if (data.msg_type === "authorize") {
            logMessage("Authorization successful: " + data.authorize.loginid);
            subscribeToTicks(config.symbol);
        }
        if (data.msg_type === "tick") {
            logMessage("Tick received: " + data.tick.quote);
        }
    };
}

function subscribeToTicks(symbol) {
    logMessage("Subscribing to ticks for " + symbol);
    derivSocket.send(JSON.stringify({ ticks: symbol }));
}

window.onload = () => {
    document.getElementById("startBtn").addEventListener("click", startTrading);
    document.getElementById("stopBtn").addEventListener("click", stopTrading);
};
