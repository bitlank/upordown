import React, { useState, useEffect, useRef, useCallback } from "react";
import { CandlestickSeries, ColorType, createChart } from "lightweight-charts";
import type {
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
} from "lightweight-charts";
import {
  BetDirection,
  type ApiBet,
  type ApiPriceData,
} from "@shared/api-interfaces";
import { getUser, login } from "./api/user";
import { getBetInfo, getOpenBets, placeBet } from "./api/bet";
import { fetchRecentPrices } from "./api/price";

const PRICE_MAX_AGE = 4 * 60 * 1000;

interface Message {
  text: string;
  color: "red" | "green" | "gray";
}

// --- Components ---

interface ChartProps {
  data: ApiPriceData[];
  bet: ApiBet | null;
  ticker: string;
}

const ChartComponent: React.FC<ChartProps> = ({ data, bet }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const betLineRef = useRef<any>(null);

  // Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current || chartRef.current) {
      return;
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#1F2937" }, // gray-800
        textColor: "#9CA3AF", // gray-400
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "#374151" }, // gray-700
        horzLines: { color: "#374151" },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderColor: "#4B5563",
        tickMarkFormatter: (time: number) => {
          const date = new Date(time * 1000);
          return new Intl.DateTimeFormat(undefined, {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }).format(date);
        }
      },
      rightPriceScale: {
        borderColor: "#4B5563",
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10B981", // emerald-500
      downColor: "#EF4444", // red-500
      borderVisible: false,
      wickUpColor: "#10B981",
      wickDownColor: "#EF4444",
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Update Data
  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      const formattedData: CandlestickData<Time>[] = data.map((d) => ({
        time: Math.floor(d.openAt / 1000) as Time,
        open: Number(d.open),
        high: Number(d.high),
        low: Number(d.low),
        close: Number(d.close),
      }));

      seriesRef.current.setData(formattedData);
    }
  }, [data]);

  // Update Bet Line
  useEffect(() => {
    if (!seriesRef.current) return;

    if (betLineRef.current) {
      seriesRef.current.removePriceLine(betLineRef.current);
      betLineRef.current = null;
    }

    if (bet) {
      betLineRef.current = seriesRef.current.createPriceLine({
        price: Number(bet.openPrice),
        color: "#FCD34D", // yellow-300
        lineWidth: 2,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: `BET ${bet.direction.toUpperCase()}`,
      });
    }
  }, [bet]);

  return <div ref={chartContainerRef} className="w-full h-full" />;
};

const App: React.FC = () => {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [score, setScore] = useState<number>(0);
  const [tickers, setTickers] = useState<string[]>([]);
  const [currentTicker, setCurrentTicker] = useState<string | null>(null);
  const [nextResolve, setNextResolve] = useState<number | null>(null);
  const [openBets, setOpenBets] = useState<ApiBet[]>([]);
  const [currentBet, setCurrentBet] = useState<ApiBet | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [recentPrices, setRecentPrices] = useState<ApiPriceData[]>([]);
  const [timer, setTimer] = useState<string>("0:00");
  const [currentTime, setCurrentTime] = useState<string>("00:00:00");
  const [message, setMessage] = useState<Message | null>(null);
  const recentPricesRef = useRef(recentPrices);

  const updateUser = async () => {
    const userData = await getUser();
    if (userData) {
      setScore(userData.score);
    }
  };

  useEffect(() => {
    const initSession = async () => {
      if (isAuthReady) {
        return;
      }

      try {
        await login();
        setIsAuthReady(true);
        await updateUser();
      } catch (Err) {
        console.error("Failed to create session:", Err);
        showMessage("Authentication failed", "red");
      }
    };

    initSession();
  }, []);

  const loadTickers = useCallback(async () => {
    const info = await getBetInfo();
    if (info?.tickers?.length) {
      setTickers(info.tickers);
      setCurrentTicker(info.tickers[0]);
    }
    if (info?.nextResolveAt) {
      setNextResolve(info.nextResolveAt);
    }
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;
    loadTickers();
  }, [loadTickers, isAuthReady]);

  useEffect(() => {
    if (!nextResolve) return;

    const now = Date.now();
    const delay = nextResolve - now;

    if (delay <= 0) {
      loadTickers();
      return;
    }

    const timer = setTimeout(() => {
      loadTickers();
    }, delay);

    return () => clearTimeout(timer);
  }, [nextResolve, loadTickers]);

  useEffect(() => {
    recentPricesRef.current = recentPrices;
  }, [recentPrices]);

  useEffect(() => {
    if (currentTicker) {
      setCurrentPrice(null);
      setRecentPrices([]);
    }
  }, [currentTicker]);

  const updatePrice = useCallback(async () => {
    if (!currentTicker) return;

    const oldestPossibleTime =
      Math.trunc(Date.now() / 1000) * 1000 - PRICE_MAX_AGE;

    const prevPrices = recentPricesRef.current;
    const nextTime =
      prevPrices.length > 0
        ? prevPrices[prevPrices.length - 1].openAt + 1000
        : 0;

    const startAt = Math.max(nextTime, oldestPossibleTime);
    const fetchedPrices = await fetchRecentPrices(currentTicker, startAt);

    if (fetchedPrices && fetchedPrices.length > 0) {
      setRecentPrices((prev) => {
        const newPrices = [...prev];
        let latestPrice = newPrices[newPrices.length - 1];

        for (const price of fetchedPrices) {
          if (price.openAt > (latestPrice?.openAt || 0)) {
            newPrices.push(price);
            latestPrice = price;
          }
        }

        setCurrentPrice(latestPrice?.close);

        if (newPrices.length > PRICE_MAX_AGE / 1000 + 60) {
          const firstToKeep = newPrices.findIndex(
            (p) => p.openAt >= oldestPossibleTime,
          );
          if (firstToKeep > 0) newPrices.splice(0, firstToKeep);
        }

        return newPrices;
      });
    }
  }, [currentTicker]);

  const updateOpenBets = useCallback(async () => {
    const bets = await getOpenBets();

    setOpenBets((prev) => {
      const resolved = prev.some((b) => !bets.includes(b));
      if (resolved) updateUser();
      return bets;
    });
  }, []);

  useEffect(() => {
    const bet = openBets.find((b) => b.ticker === currentTicker) ?? null;
    setCurrentBet(bet);
  }, [currentTicker, openBets]);

  useEffect(() => {
    if (!isAuthReady || !currentTicker) return;

    updatePrice();
    updateOpenBets();

    const priceInterval = setInterval(updatePrice, 1000);
    const betInterval = setInterval(updateOpenBets, 5000);

    return () => {
      clearInterval(priceInterval);
      clearInterval(betInterval);
    };
  }, [isAuthReady, currentTicker, updatePrice, updateOpenBets]);

  useEffect(() => {
    if (!currentBet || !currentBet.resolveAt) return;

    const now = Date.now();
    const resolveAt = currentBet.resolveAt;
    const delay = resolveAt - now + 1000;

    if (delay <= 0) {
      updateOpenBets();
      return;
    }

    const timer = setTimeout(() => {
      updateOpenBets();
    }, delay);

    return () => clearTimeout(timer);
  }, [currentBet, updateOpenBets]);

  // Clock & Timer Loop (UI only, no network)
  useEffect(() => {
    const tickClock = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("en-US", { hour12: false }));

      const deadline = currentBet?.resolveAt ?? nextResolve ?? 0;
      const remaining = deadline - Date.now();

      if (remaining <= 0) {
        setTimer("0:00");
      } else {
        const remainingSec = Math.ceil(remaining / 1000);
        const mins = Math.floor(remainingSec / 60);
        const secs = remainingSec % 60;
        setTimer(`${mins}:${secs.toString().padStart(2, "0")}`);
      }
    }, 1000);

    return () => clearInterval(tickClock);
  }, [nextResolve, currentBet?.resolveAt]);

  // --- Actions ---
  const handlePlaceBet = async (direction: BetDirection) => {
    try {
      if (!currentTicker) {
        return;
      }

      const bet = await placeBet(currentTicker, direction);
      if (bet) {
        setCurrentBet(bet);
        updateOpenBets();
      }
    } catch (e) {
      console.error(e);
      showMessage("Failed to place bet", "red");
    }
  };

  const showMessage = (text: string, color: "red" | "green" | "gray") => {
    setMessage({ text, color });
    setTimeout(() => setMessage(null), 3000);
  };

  const priceFormatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  });

  const getScoreColor = () => {
    if (score > 1000) return "text-green-500";
    if (score < 0) return "text-red-500";
    return "text-yellow-300";
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        Connecting...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans p-4 md:p-8">
      {/* Notification Toast */}
      {message && (
        <div
          className={`fixed inset-x-0 top-0 p-4 text-center font-bold text-white z-50 transition-all shadow-xl bg-${message.color === "red" ? "red" : message.color === "green" ? "green" : "gray"}-600`}
        >
          {message.text}
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div className="flex items-center">
            <select
              value={currentTicker || ""}
              onChange={(e) => {
                setCurrentTicker(e.target.value);
                setCurrentBet(null);
                setRecentPrices([]);
              }}
              className="bg-gray-700 text-white text-3xl md:text-5xl font-extrabold p-2 rounded-lg focus:ring-emerald-500 focus:outline-none mr-4"
            >
              {tickers.length > 0 ? (
                tickers.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))
              ) : (
                <option>Loading...</option>
              )}
            </select>
          </div>

          <div className="mt-4 md:mt-0 text-right">
            <p className="text-lg text-gray-400">Score</p>
            <p
              className={`text-4xl font-bold transition-colors ${getScoreColor()}`}
            >
              {score.toLocaleString()}
            </p>
          </div>
        </header>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Chart */}
          <div className="lg:col-span-3 bg-gray-800 p-1 rounded-xl shadow-2xl h-[400px] md:h-[600px] overflow-hidden relative">
            {recentPrices.length > 0 && currentTicker ? (
              <ChartComponent
                data={recentPrices}
                bet={currentBet}
                ticker={currentTicker}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Loading Market Data...
              </div>
            )}
          </div>

          {/* Sidebar Controls */}
          <div className="lg:col-span-1 flex flex-col space-y-6">
            {/* Info Card */}
            <div className="bg-gray-800 p-6 rounded-xl shadow-lg border-t-4 border-emerald-500">
              <p className="text-sm font-semibold text-gray-400 mb-1">Price</p>
              <p className="text-4xl font-extrabold text-white mb-4">
                {currentPrice ? priceFormatter.format(currentPrice) : ""}
              </p>

              <p className="text-sm font-semibold text-gray-400 mb-1">Time</p>
              <p className="text-2xl font-mono text-gray-200 mb-4">
                {currentTime}
              </p>

              <div className="mt-4 p-3 bg-gray-700 rounded-lg text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wider">
                  Resolution In
                </p>
                <p
                  className={`text-3xl font-extrabold ${currentBet ? "text-yellow-300" : "text-gray-400"}`}
                >
                  {timer || ""}
                </p>
              </div>

              {/* Active Bet Status */}
              {currentBet && (
                <div className="mt-4 pt-4 border-t border-gray-700 animate-fade-in">
                  <p className="text-sm font-semibold text-gray-400">
                    Active Position
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span
                      className={`text-lg font-bold flex items-center gap-2 ${currentBet.direction === BetDirection.Long ? "text-green-500" : "text-red-500"}`}
                    >
                      {currentBet.direction.toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-400 font-mono">
                      {priceFormatter.format(currentBet.openPrice)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {!currentBet && (
              <div className="mt-auto flex flex-col space-y-4">
                <p className="text-center text-gray-400 text-sm">Place Bet</p>
                <button
                  onClick={() => handlePlaceBet(BetDirection.Long)}
                  className="w-full p-4 rounded-xl text-2xl font-black shadow-lg transition-transform hover:scale-[1.02] bg-green-600 hover:bg-green-700 text-white ring-4 ring-green-500/50"
                >
                  LONG{" "}
                  <span className="text-sm ml-2 font-normal opacity-75">
                    (Bet Up)
                  </span>
                </button>
                <button
                  onClick={() => handlePlaceBet(BetDirection.Short)}
                  className="w-full p-4 rounded-xl text-2xl font-black shadow-lg transition-transform hover:scale-[1.02] bg-red-600 hover:bg-red-700 text-white ring-4 ring-red-500/50"
                >
                  SHORT{" "}
                  <span className="text-sm ml-2 font-normal opacity-75">
                    (Bet Down)
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
