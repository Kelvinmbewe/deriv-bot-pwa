
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
        logMessage("WebSocket Error: " + JSON.stringify(err));
    };

    derivSocket.onclose = () => {
        logMessage("WebSocket connection closed.");
    };

    derivSocket.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        logMessage("Received: " + data.msg_type);
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
