import React, { useEffect, useRef, useState } from 'react';
import { login, getUser } from './api/user';
import LeftPanel from './components/LeftPanel';
import MainPanel from './components/MainPanel';
import BottomPanel from './components/BottomPanel';
import './App.css';

const App: React.FC = () => {
  const authenticated = useRef(false);
  const [user, setUser] = useState({ score: 0 });

  useEffect(() => {
    if (!authenticated.current) {
      login().then(() => {
        getUser().then(setUser);
      });
      authenticated.current = true;
    }
  }, []);

  const updateUser = () => {
    getUser().then(setUser);
  };

  return (
    <div className="app-container">
      <aside className="left-panel">
        <LeftPanel score={user.score} />
      </aside>
      <main className="main-panel">
        <MainPanel onBetResolved={updateUser} />
        <BottomPanel />
      </main>
    </div>
  );
};

export default App;
