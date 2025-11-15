import React, { useEffect, useRef } from 'react';
import { login } from './api/user';
import LeftPanel from './components/LeftPanel';
import MainPanel from './components/MainPanel';
import BottomPanel from './components/BottomPanel';
import './App.css';

const App: React.FC = () => {
  const authenticated = useRef(false);

  useEffect(() => {
    if (!authenticated.current) {
      login();
      authenticated.current = true;
    }
  }, []);

  return (
    <div className="app-container">
      <aside className="left-panel">
        <LeftPanel />
      </aside>
      <main className="main-panel">
        <MainPanel />
        <BottomPanel />
      </main>
    </div>
  );
};

export default App;
