
let config = {
  apiToken: '',
  symbol: 'R_10',
  stake: 1.0,
  takeProfit: 2.0,
  stopLoss: 2.0,
  maxTradesPerDay: 5,
  dailyProfitCap: 10.0,
  dailyLossCap: 10.0,
  emaFast: 10,
  emaSlow: 20,
  rsiPeriod: 14,
};

let derivSocket, tradeCount = 0, dailyProfit = 0, dailyLoss = 0, activeTrade = null, tradeLog = [], priceHistory = [];

function logMessage(msg) {
  const logBox = document.getElementById("log");
  logBox.innerHTML += `[${new Date().toLocaleTimeString()}] ${msg}<br>`;
  logBox.scrollTop = logBox.scrollHeight;
}

function initSocket(token) {
  derivSocket = new WebSocket("wss://ws.deriv.com/websockets/v3/websocket.json");

  derivSocket.onopen = () => {
    logMessage("WebSocket connected. Authorizing...");
    derivSocket.send(JSON.stringify({ authorize: token }));
  };

  derivSocket.onmessage = (msg) => handleMessage(JSON.parse(msg.data));
}

function handleMessage(data) {
  if (data.error) {
    logMessage("Error: " + data.error.message);
    stopTrading();
    return;
  }

  if (data.msg_type === "authorize") {
    logMessage("Authorization successful.");
    subscribeToTicks(config.symbol);
    return;
  }

  if (data.msg_type === "tick") {
    const price = parseFloat(data.tick.quote);
    priceHistory.push(price);
    if (priceHistory.length > config.emaSlow + 2) priceHistory.shift();
    if (priceHistory.length >= config.emaSlow + 1) evaluateTrade();
  }

  if (data.msg_type === "buy") {
    activeTrade = { id: data.buy.contract_id, direction: data.buy.contract_type, entryPrice: data.buy.buy_price };
    tradeLog.push({ ...activeTrade, timestamp: Date.now() });
    logMessage("Trade opened: " + activeTrade.direction);
  }

  if (data.msg_type === "proposal_open_contract") {
    const contract = data.proposal_open_contract;
    if (!contract.is_valid_to_sell) return;
    const pnl = contract.profit;
    if (pnl >= config.takeProfit || pnl <= -config.stopLoss) {
      derivSocket.send(JSON.stringify({ sell: contract.contract_id, price: contract.bid_price }));
      activeTrade = null;
      tradeCount++;
      if (pnl > 0) dailyProfit += pnl; else dailyLoss -= pnl;
      logMessage("Trade closed with PnL: " + pnl.toFixed(2));
    }
  }
}

function subscribeToTicks(symbol) {
  derivSocket.send(JSON.stringify({ ticks: symbol }));
  logMessage("Subscribed to " + symbol);
}

function calculateEMA(data, period) {
  const k = 2 / (period + 1);
  let ema = data[data.length - period];
  for (let i = data.length - period + 1; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

function calculateRSI(data, period) {
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = data[data.length - i] - data[data.length - i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const rs = gains / (losses || 1);
  return 100 - (100 / (1 + rs));
}

function evaluateTrade() {
  if (activeTrade || tradeCount >= config.maxTradesPerDay || dailyProfit >= config.dailyProfitCap || dailyLoss >= config.dailyLossCap) return;
  const ema10 = calculateEMA(priceHistory, config.emaFast);
  const ema20 = calculateEMA(priceHistory, config.emaSlow);
  const rsi = calculateRSI(priceHistory, config.rsiPeriod);
  if (ema10 > ema20 && rsi < 70) openTrade("CALL");
  else if (ema10 < ema20 && rsi > 30) openTrade("PUT");
}

function openTrade(direction) {
  derivSocket.send(JSON.stringify({
    buy: 1,
    price: config.stake,
    parameters: {
      amount: config.stake,
      basis: "stake",
      contract_type: direction,
      currency: "USD",
      duration: 5,
      duration_unit: "t",
      symbol: config.symbol
    }
  }));
}

function startTrading() {
  config.apiToken = document.getElementById("apiToken").value;
  config.symbol = document.getElementById("symbol").value;
  config.stake = parseFloat(document.getElementById("stake").value);
  config.takeProfit = parseFloat(document.getElementById("takeProfit").value);
  config.stopLoss = parseFloat(document.getElementById("stopLoss").value);
  config.maxTradesPerDay = parseInt(document.getElementById("maxTrades").value);
  config.dailyProfitCap = parseFloat(document.getElementById("profitCap").value);
  config.dailyLossCap = parseFloat(document.getElementById("lossCap").value);

  document.getElementById("startBtn").disabled = true;
  document.getElementById("stopBtn").disabled = false;
  logMessage("Start trading...");
  initSocket(config.apiToken);
}

function stopTrading() {
  if (derivSocket) derivSocket.close();
  activeTrade = null;
  priceHistory = [];
  logMessage("Stopped trading.");
  document.getElementById("startBtn").disabled = false;
  document.getElementById("stopBtn").disabled = true;
}

document.getElementById("startBtn").addEventListener("click", startTrading);
document.getElementById("stopBtn").addEventListener("click", stopTrading);
