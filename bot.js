
const config = {
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
  rsiPeriod: 14
};

let tradeCount = 0;
let dailyProfit = 0;
let dailyLoss = 0;
let activeTrade = null;
let tradeLog = [];
let priceHistory = [];
let derivSocket;

function log(message) {
  const logBox = document.getElementById("log");
  logBox.textContent += message + "\n";
  logBox.scrollTop = logBox.scrollHeight;
}

function initSocket(apiToken) {
  derivSocket = new WebSocket("wss://ws.deriv.com/websockets/v3/websocket.json");
  derivSocket.onopen = () => {
    derivSocket.send(JSON.stringify({ authorize: apiToken }));
    subscribeToTicks(config.symbol);
    log("Socket connected and authorized.");
  };
  derivSocket.onmessage = handleMessage;
}

function subscribeToTicks(symbol) {
  derivSocket.send(JSON.stringify({ ticks: symbol }));
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

function handleMessage(msg) {
  const data = JSON.parse(msg.data);
  if (data.msg_type === "tick") {
    const price = parseFloat(data.tick.quote);
    priceHistory.push(price);
    if (priceHistory.length > config.emaSlow + 2) priceHistory.shift();
    if (priceHistory.length >= config.emaSlow + 1) evaluateTrade();
  } else if (data.msg_type === "buy") {
    activeTrade = {
      id: data.buy.contract_id,
      direction: data.buy.contract_type,
      entryPrice: data.buy.buy_price
    };
    tradeLog.push({ ...activeTrade, timestamp: Date.now() });
    log(`Trade opened: ${activeTrade.direction} @ ${activeTrade.entryPrice}`);
  } else if (data.msg_type === "proposal_open_contract") {
    const contract = data.proposal_open_contract;
    if (!contract.is_valid_to_sell) return;
    const pnl = contract.profit;
    if (pnl >= config.takeProfit || pnl <= -config.stopLoss) {
      derivSocket.send(JSON.stringify({ sell: contract.contract_id, price: contract.bid_price }));
      activeTrade = null;
      tradeCount++;
      if (pnl > 0) dailyProfit += pnl;
      else dailyLoss -= pnl;
      log(`Trade closed. PnL: ${pnl}`);
    }
  } else if (data.msg_type === "sell") {
    log("Trade fully settled.");
  }
}

function evaluateTrade() {
  if (activeTrade || tradeCount >= config.maxTradesPerDay || dailyProfit >= config.dailyProfitCap || dailyLoss >= config.dailyLossCap) return;
  const ema10 = calculateEMA(priceHistory, config.emaFast);
  const ema20 = calculateEMA(priceHistory, config.emaSlow);
  const rsi = calculateRSI(priceHistory, config.rsiPeriod);
  if (ema10 > ema20 && rsi < 70) {
    openTrade("CALL");
  } else if (ema10 < ema20 && rsi > 30) {
    openTrade("PUT");
  }
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

function updateSettings(newSettings) {
  Object.assign(config, newSettings);
}

function start() {
  const token = document.getElementById("token").value;
  const symbol = document.getElementById("symbol").value;
  if (!token) {
    alert("Enter your API token.");
    return;
  }
  updateSettings({ apiToken: token, symbol: symbol });
  startTrading(token);
}

function startTrading(token) {
  config.apiToken = token;
  initSocket(token);
}

function stop() {
  if (derivSocket) derivSocket.close();
  activeTrade = null;
  priceHistory = [];
  log("Trading stopped.");
}
