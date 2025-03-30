require("dotenv").config();
const axios = require("axios");
const {
  SMA, EMA, RSI, StochasticRSI, MACD, BollingerBands, ATR, PSAR,
  CCI, ADX, WilliamsR
} = require("technicalindicators");

// 📌 Binance API (Change symbol/interval as needed)
const BINANCE_API_URL = "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=100";

// 📌 Fetch Market Data (Closing, High, Low Prices)
const getMarketData = async () => {
  try {
    const response = await axios.get(BINANCE_API_URL);
    return response.data.map(candle => ({
      close: parseFloat(candle[4]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3])
    }));
  } catch (error) {
    console.error("❌ Error fetching market data:", error);
    return [];
  }
};

// 📌 Calculate indicators
const calculateIndicators = (prices, highs, lows) => {
  return {
    shortSMA: SMA.calculate({ period: 50, values: prices }),
    longSMA: SMA.calculate({ period: 200, values: prices }),
    shortEMA: EMA.calculate({ period: 50, values: prices }),
    longEMA: EMA.calculate({ period: 200, values: prices }),
    rsi: RSI.calculate({ period: 14, values: prices }),
    stochRsi: StochasticRSI.calculate({ values: prices, rsiPeriod: 14, stochasticPeriod: 14, kPeriod: 3, dPeriod: 3 }),
    macd: MACD.calculate({
      values: prices, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9,
      SimpleMAOscillator: false, SimpleMASignal: false,
    }),
    bollinger: BollingerBands.calculate({ period: 20, values: prices, stdDev: 2 }),
    atr: ATR.calculate({ period: 14, high: highs, low: lows, close: prices }),
    psar: PSAR.calculate({ high: highs, low: lows, step: 0.02, max: 0.2 }),
    cci: CCI.calculate({ period: 14, high: highs, low: lows, close: prices }),
    adx: ADX.calculate({ period: 14, high: highs, low: lows, close: prices }),
    williamsR: WilliamsR.calculate({ period: 14, high: highs, low: lows, close: prices }),
  };
};

// 📌 Generate Trading Signals
const generateTradingSignal = (indicators, prices) => {
  const latestPrice = prices[prices.length - 1];

  const shortSMA = indicators.shortSMA[indicators.shortSMA.length - 1];
  const longSMA = indicators.longSMA[indicators.longSMA.length - 1];
  const shortEMA = indicators.shortEMA[indicators.shortEMA.length - 1];
  const longEMA = indicators.longEMA[indicators.longEMA.length - 1];
  const rsi = indicators.rsi[indicators.rsi.length - 1];
  const stochRsiK = indicators.stochRsi[indicators.stochRsi.length - 1]?.k;
  const stochRsiD = indicators.stochRsi[indicators.stochRsi.length - 1]?.d;
  const macdLine = indicators.macd[indicators.macd.length - 1]?.MACD;
  const signalLine = indicators.macd[indicators.macd.length - 1]?.signal;
  const lowerBand = indicators.bollinger[indicators.bollinger.length - 1]?.lower;
  const upperBand = indicators.bollinger[indicators.bollinger.length - 1]?.upper;
  const atr = indicators.atr[indicators.atr.length - 1];
  const psar = indicators.psar[indicators.psar.length - 1];
  const cci = indicators.cci[indicators.cci.length - 1];
  const adx = indicators.adx[indicators.adx.length - 1]?.adx;
  const williamsR = indicators.williamsR[indicators.williamsR.length - 1];

  let signal = "HOLD";

  // 📌 Moving Average Strategies
  if (shortSMA > longSMA) signal = "BUY";  
  if (shortSMA < longSMA) signal = "SELL";  
  if (shortEMA > longEMA) signal = "BUY";  
  if (shortEMA < longEMA) signal = "SELL";  

  // 📌 RSI Overbought & Oversold
  if (rsi < 30) signal = "BUY";
  if (rsi > 70) signal = "SELL";

  // 📌 Stochastic RSI
  if (stochRsiK < 20 && stochRsiD < 20) signal = "BUY";
  if (stochRsiK > 80 && stochRsiD > 80) signal = "SELL";

  // 📌 MACD Cross
  if (macdLine > signalLine) signal = "BUY";
  if (macdLine < signalLine) signal = "SELL";

  // 📌 Bollinger Bands
  if (latestPrice <= lowerBand) signal = "BUY";
  if (latestPrice >= upperBand) signal = "SELL";

  // 📌 ATR - High volatility avoidance
  if (atr > latestPrice * 0.01) signal = "HOLD";

  // 📌 Parabolic SAR
  if (latestPrice > psar) signal = "BUY";
  if (latestPrice < psar) signal = "SELL";

  // 📌 CCI Overbought/Oversold
  if (cci < -100) signal = "BUY";
  if (cci > 100) signal = "SELL";

  // 📌 ADX Trend Strength
  if (adx > 25 && signal !== "HOLD") signal += " (Strong Trend)";

  // 📌 Williams %R
  if (williamsR < -80) signal = "BUY";
  if (williamsR > -20) signal = "SELL";

  return { signal, latestPrice, rsi, shortSMA, longSMA, shortEMA, longEMA, macdLine, signalLine, lowerBand, upperBand, atr, psar, cci, adx, williamsR };
};

// 📌 Send Telegram Alerts
const sendTelegramAlert = async (message) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn("⚠️ Telegram bot credentials missing.");
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

// 📌 Run Trading Bot
const runTradingBot = async () => {
  const marketData = await getMarketData();
  if (marketData.length === 0) return;

  const prices = marketData.map(data => data.close);
  const highs = marketData.map(data => data.high);
  const lows = marketData.map(data => data.low);

  const indicators = calculateIndicators(prices, highs, lows);
  const tradingSignal = generateTradingSignal(indicators, prices);

  console.log(tradingSignal);

  if (tradingSignal.signal !== "HOLD") {
    sendTelegramAlert(`🚀 Signal: ${tradingSignal.signal} at $${tradingSignal.latestPrice}`);
  }
};

// 📌 Run every hour
setInterval(runTradingBot, 3600000);
runTradingBot();
