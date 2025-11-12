import React, { useEffect, useState } from 'react';
import type { PriceData } from '@shared/api-interfaces';
import { fetchCurrentPrice } from '../api/price';

const MainPanel: React.FC = () => {
  const [price, setPrice] = useState<PriceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
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
    poll();
    const interval = setInterval(poll, 1000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

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
        <button style={{ background: '#2ecc40', color: 'white', padding: '1rem 2rem', marginRight: '1rem' }}>Long Bet (Up)</button>
        <button style={{ background: '#ff4136', color: 'white', padding: '1rem 2rem' }}>Short Bet (Down)</button>
      </div>
      <div style={{ margin: '2rem 0', color: '#888' }}>
        Current bet: <span>(none)</span>
      </div>
    </div>
  );
};

export default MainPanel;
