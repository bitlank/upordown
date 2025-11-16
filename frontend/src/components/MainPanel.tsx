import React, { useEffect, useState } from 'react';
import type { ApiBet, ApiPriceData } from '@shared/api-interfaces';
import { fetchCurrentPrice } from '../api/price.js';
import { getOpenBets, placeBet } from '../api/bet.js';

const MainPanel: React.FC = () => {
  const [price, setPrice] = useState<ApiPriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openBet, setOpenBet] = useState<ApiBet | null>(null);

  const fetchOpenBet = async () => {
    try {
      const bets = await getOpenBets();
      setOpenBet(bets.length > 0 ? bets[0] : null);
    } catch {
      setOpenBet(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    const pollPrice = async () => {
      try {
        const price = await fetchCurrentPrice('BTCUSDT');
        if (mounted) {
          setPrice(price);
          setLoading(false);
        }
      } catch {
        setPrice(null);
        setLoading(false);
      }
    };
    pollPrice();
    fetchOpenBet();
    const priceInterval = setInterval(pollPrice, 1000);
    const betInterval = setInterval(fetchOpenBet, 5000);
    return () => {
      mounted = false;
      clearInterval(priceInterval);
      clearInterval(betInterval);
    };
  }, []);

  const handlePlaceBet = async (direction: 'long' | 'short') => {
    try {
      await placeBet('BTCUSDT', direction);
      fetchOpenBet();
    } catch (error) {
      console.error('Failed to place bet:', error);
    }
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '2rem' }}>
      <h1>BTCUSDT</h1>
      <div style={{ fontSize: '2rem', margin: '1rem 0' }}>
        {loading
          ? 'Loading...'
          : price !== null
          ? new Intl.NumberFormat(navigator.language, {
              style: 'currency',
              currency: 'USD',
            }).format(price.close)
          : 'Error'}
      </div>
      <div style={{ margin: '2rem 0' }}>
        <button
          style={{ background: '#2ecc40', color: 'white', padding: '1rem 2rem', marginRight: '1rem' }}
          onClick={() => handlePlaceBet('long')}
          disabled={!!openBet}
        >
          Long Bet (Up)
        </button>
        <button
          style={{ background: '#ff4136', color: 'white', padding: '1rem 2rem' }}
          onClick={() => handlePlaceBet('short')}
          disabled={!!openBet}
        >
          Short Bet (Down)
        </button>
      </div>
      <div style={{ margin: '2rem 0', color: '#888' }}>
        Current bet:{' '}
        <span>
          {openBet
            ? `${openBet.direction} @ ${new Intl.NumberFormat(navigator.language, {
                style: 'currency',
                currency: 'USD',
              }).format(openBet.openPrice)}`
            : '(none)'}
        </span>
      </div>
    </div>
  );
};

export default MainPanel;
