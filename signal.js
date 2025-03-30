require("dotenv").config();
const axios = require("axios");
const {
  SMA, EMA, RSI, StochasticRSI, MACD, BollingerBands, ATR, PSAR,
  CCI, ADX, WilliamsR, IchimokuCloud, Fibonacci, PivotPoints, KeltnerChannels,
  CMO, OBV, CMF, VWMA
} = require("technicalindicators");

const BINANCE_API_URL = "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=100";

const getMarketData = async () => {
  try {
    const response = await axios.get(BINANCE_API_URL);
    return response.data.map(candle => ({
      close: parseFloat(candle[4]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      volume: parseFloat(candle[5])
    }));
  } catch (error) {
    console.error("❌ Error fetching market data:", error);
    return [];
  }
};

const calculateIndicators = (prices, highs, lows, volumes) => {
  return {
    shortSMA: SMA.calculate({ period: 50, values: prices }),
    longSMA: SMA.calculate({ period: 200, values: prices }),
    shortEMA: EMA.calculate({ period: 50, values: prices }),
    longEMA: EMA.calculate({ period: 200, values: prices }),
    rsi: RSI.calculate({ period: 14, values: prices }),
    stochRsi: StochasticRSI.calculate({ values: prices, rsiPeriod: 14, stochasticPeriod: 14, kPeriod: 3, dPeriod: 3 }),
    macd: MACD.calculate({ values: prices, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }),
    bollinger: BollingerBands.calculate({ period: 20, values: prices, stdDev: 2 }),
    atr: ATR.calculate({ period: 14, high: highs, low: lows, close: prices }),
    psar: PSAR.calculate({ high: highs, low: lows, step: 0.02, max: 0.2 }),
    cci: CCI.calculate({ period: 14, high: highs, low: lows, close: prices }),
    adx: ADX.calculate({ period: 14, high: highs, low: lows, close: prices }),
    williamsR: WilliamsR.calculate({ period: 14, high: highs, low: lows, close: prices }),
    ichimoku: IchimokuCloud.calculate({ high: highs, low: lows, conversionPeriod: 9, basePeriod: 26, spanBPeriod: 52, displacement: 26 }),
    pivotPoints: PivotPoints.calculate({ high: highs, low: lows, close: prices }),
    keltner: KeltnerChannels.calculate({ period: 20, high: highs, low: lows, close: prices, multiplier: 2 }),
    cmo: CMO.calculate({ period: 14, values: prices }),
    obv: OBV.calculate({ close: prices, volume: volumes }),
    cmf: CMF.calculate({ high: highs, low: lows, close: prices, volume: volumes, period: 20 }),
    vwma: VWMA.calculate({ period: 20, values: prices, volume: volumes })
  };
};

const generateTradingSignal = (indicators, prices) => {
  let signal = "HOLD";
  const latestPrice = prices[prices.length - 1];
  const { rsi, macd, bollinger, atr, cci, adx, williamsR, ichimoku, keltner, cmf, obv } = indicators;

  if (rsi[rsi.length - 1] < 30) signal = "BUY";
  if (rsi[rsi.length - 1] > 70) signal = "SELL";
  if (macd[macd.length - 1]?.MACD > macd[macd.length - 1]?.signal) signal = "BUY";
  if (macd[macd.length - 1]?.MACD < macd[macd.length - 1]?.signal) signal = "SELL";
  if (latestPrice <= bollinger[bollinger.length - 1]?.lower) signal = "BUY";
  if (latestPrice >= bollinger[bollinger.length - 1]?.upper) signal = "SELL";
  if (adx[adx.length - 1]?.adx > 25 && signal !== "HOLD") signal += " (Strong Trend)";
  if (obv[obv.length - 1] > obv[obv.length - 2]) signal = "BUY";
  if (cmf[cmf.length - 1] > 0.05) signal = "BUY";
  if (cmf[cmf.length - 1] < -0.05) signal = "SELL";

  return { signal, latestPrice };
};

const sendTelegramAlert = async (message) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;
  try {
    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, { chat_id: chatId, text: message });
    console.log("📩 Telegram Alert Sent:", message);
  } catch (error) {
    console.error("❌ Telegram Alert Failed:", error.message);
  }
};

const runTradingBot = async () => {
  const marketData = await getMarketData();
  if (marketData.length === 0) return;
  
  const prices = marketData.map(data => data.close);
  const highs = marketData.map(data => data.high);
  const lows = marketData.map(data => data.low);
  const volumes = marketData.map(data => data.volume);

  const indicators = calculateIndicators(prices, highs, lows, volumes);
  const tradingSignal = generateTradingSignal(indicators, prices);

  console.log(tradingSignal);
  if (tradingSignal.signal !== "HOLD") {
    sendTelegramAlert(`🚀 Signal: ${tradingSignal.signal} at $${tradingSignal.latestPrice}`);
  }
};

setInterval(runTradingBot, 3600000);
runTradingBot();
