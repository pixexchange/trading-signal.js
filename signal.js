require("dotenv").config();
const axios = require("axios");
const { SMA, RSI, MACD, BollingerBands } = require("technicalindicators");

// 📌 Binance API URL for historical price data (Change symbol & interval as needed)
const BINANCE_API_URL = "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=100";

// 📌 Function to fetch market data (Closing Prices)
const getMarketData = async () => {
  try {
    const response = await axios.get(BINANCE_API_URL);
    const prices = response.data.map(candle => parseFloat(candle[4])); // Extract closing prices
    return prices;
  } catch (error) {
    console.error("Error fetching market data:", error);
    return [];
  }
};

// 📌 Function to calculate indicators
const calculateIndicators = (prices) => {
  return {
    shortSMA: SMA.calculate({ period: 50, values: prices }),
    longSMA: SMA.calculate({ period: 200, values: prices }),
    rsi: RSI.calculate({ period: 14, values: prices }),
    macd: MACD.calculate({
      values: prices,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    }),
    bollinger: BollingerBands.calculate({
      period: 20,
      values: prices,
      stdDev: 2,
    }),
  };
};

// 📌 Function to generate Buy/Sell signals based on indicators
const generateTradingSignal = (indicators, prices) => {
  const latestPrice = prices[prices.length - 1];

  const shortSMA = indicators.shortSMA[indicators.shortSMA.length - 1];
  const longSMA = indicators.longSMA[indicators.longSMA.length - 1];
  const rsi = indicators.rsi[indicators.rsi.length - 1];
  const macdLine = indicators.macd[indicators.macd.length - 1]?.MACD;
  const signalLine = indicators.macd[indicators.macd.length - 1]?.signal;
  const lowerBand = indicators.bollinger[indicators.bollinger.length - 1]?.lower;
  const upperBand = indicators.bollinger[indicators.bollinger.length - 1]?.upper;

  let signal = "HOLD";

  // 📌 Golden Cross & Death Cross Strategy
  if (shortSMA > longSMA) signal = "BUY";
  if (shortSMA < longSMA) signal = "SELL";

  // 📌 RSI Overbought & Oversold
  if (rsi < 30) signal = "BUY";
  if (rsi > 70) signal = "SELL";

  // 📌 MACD Cross
  if (macdLine > signalLine) signal = "BUY";
  if (macdLine < signalLine) signal = "SELL";

  // 📌 Bollinger Bands Strategy
  if (latestPrice <= lowerBand) signal = "BUY";  // Price at lower band
  if (latestPrice >= upperBand) signal = "SELL"; // Price at upper band

  return { signal, latestPrice, rsi, shortSMA, longSMA, macdLine, signalLine, lowerBand, upperBand };
};

// 📌 Function to send Telegram Alerts
const sendTelegramAlert = async (message) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn("⚠️ Telegram bot credentials missing in .env file.");
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await axios.post(url, { chat_id: chatId, text: message });
    console.log("📩 Telegram Alert Sent:", message);
  } catch (error) {
    console.error("❌ Telegram Alert Failed:", error.message);
  }
};

// 📌 Main function: Fetch data, calculate indicators, and send signals
const runTradingBot = async () => {
  const prices = await getMarketData();
  if (prices.length === 0) return;

  const indicators = calculateIndicators(prices);
  const tradingSignal = generateTradingSignal(indicators, prices);

  console.log(tradingSignal);

  if (tradingSignal.signal !== "HOLD") {
    const alertMessage = `📈 Trading Signal: ${tradingSignal.signal} at $${tradingSignal.latestPrice}\n
    RSI: ${tradingSignal.rsi.toFixed(2)}
    SMA(50): ${tradingSignal.shortSMA.toFixed(2)}
    SMA(200): ${tradingSignal.longSMA.toFixed(2)}
    MACD: ${tradingSignal.macdLine.toFixed(2)} | Signal: ${tradingSignal.signalLine.toFixed(2)}
    Bollinger Bands: Lower ${tradingSignal.lowerBand.toFixed(2)} | Upper ${tradingSignal.upperBand.toFixed(2)}
    `;

    sendTelegramAlert(alertMessage);
  }
};

// 📌 Run the bot every hour
setInterval(runTradingBot, 3600000); // 1 hour (3600000 ms)
runTradingBot(); // Run immediately on startup
