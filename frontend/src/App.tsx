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
  const [openBet, setOpenBet] = useState<ApiBet | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [recentPrices, setRecentPrices] = useState<ApiPriceData[]>([]);
  const [timer, setTimer] = useState<string>("0:00");
  const [currentTime, setCurrentTime] = useState<string>("00:00:00");
  const [message, setMessage] = useState<Message | null>(null);

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

  const updatePrice = useCallback(async () => {
    if (!currentTicker) return;

    const oldestPossibleTime = Math.trunc(Date.now() / 1000) * 1000 - PRICE_MAX_AGE;
    let nextTime = 0

    setRecentPrices(prev => {
      nextTime = prev.length > 0 ? prev[prev.length - 1].openAt + 1000 : 0;
      return prev;
    });

    const startAt = Math.max(nextTime, oldestPossibleTime);
    const fetchedPrices = await fetchRecentPrices(currentTicker, startAt);

    if (fetchedPrices && fetchedPrices.length > 0) {
      setRecentPrices(prev => {
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
          let deleteCount = 0;
          for (; deleteCount < newPrices.length && newPrices[deleteCount].openAt < oldestPossibleTime; deleteCount++);
          newPrices.splice(0, deleteCount);
        }

        return newPrices;
      });
    }
  }, [currentTicker, fetchRecentPrices]);

  const updateBet = useCallback(async () => {
    const bets = await getOpenBets();
    const currentBet = bets.filter((b) => b.ticker === currentTicker).pop();

    setOpenBet((prev) => {
      if (currentBet) {
        return currentBet;
      }

      if (prev) {
        updateUser();
        showMessage("Bet Resolved! Score updated.", "gray");
        return null;
      }

      return prev;
    });
  }, [currentTicker]);

  useEffect(() => {
    if (!isAuthReady || !currentTicker) return;

    updatePrice();
    updateBet();

    const priceInterval = setInterval(updatePrice, 1000);
    const betInterval = setInterval(updateBet, 5000);

    return () => {
      clearInterval(priceInterval);
      clearInterval(betInterval);
    };
  }, [isAuthReady, currentTicker, updatePrice, updateBet]);

  useEffect(() => {
    if (!openBet || !openBet.resolveAt) return;

    const now = Date.now();
    const resolveAt = openBet.resolveAt;
    const delay = resolveAt - now + 1000;

    if (delay <= 0) {
      updateBet();
      return;
    }

    const timer = setTimeout(() => {
      updateBet();
    }, delay);

    return () => clearTimeout(timer);
  }, [openBet?.resolveAt, updateBet]);

  // Clock & Timer Loop (UI only, no network)
  useEffect(() => {
    const tickClock = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("en-US", { hour12: false }));

      let remaining = 0;
      if (openBet) {
        remaining = openBet.resolveAt - Date.now();
      } else if (nextResolve) {
        remaining = nextResolve - Date.now();
      }

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
  }, [nextResolve, openBet?.resolveAt]);

  // --- Actions ---
  const handlePlaceBet = async (direction: BetDirection) => {
    try {
      if (!currentTicker) {
        return;
      }

      const bet = await placeBet(currentTicker, direction);
      if (bet) {
        setOpenBet(bet);
        await updateUser();
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

  const usdFormatter = new Intl.NumberFormat(navigator.language, {
    style: "currency",
    currency: "USD",
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
                setOpenBet(null);
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
                bet={openBet}
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
                {currentPrice ? usdFormatter.format(currentPrice) : ""}
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
                  className={`text-3xl font-extrabold ${openBet ? "text-yellow-300" : "text-gray-400"}`}
                >
                  {timer || ""}
                </p>
              </div>

              {/* Active Bet Status */}
              {openBet && (
                <div className="mt-4 pt-4 border-t border-gray-700 animate-fade-in">
                  <p className="text-sm font-semibold text-gray-400">
                    Active Position
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span
                      className={`text-lg font-bold flex items-center gap-2 ${openBet.direction === BetDirection.Long ? "text-green-500" : "text-red-500"}`}
                    >
                      {openBet.direction.toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-400 font-mono">
                      {usdFormatter.format(openBet.openPrice)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {!openBet && (
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
