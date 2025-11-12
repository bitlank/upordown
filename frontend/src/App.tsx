import React from 'react';
import LeftPanel from './components/LeftPanel';
import MainPanel from './components/MainPanel';
import BottomPanel from './components/BottomPanel';
import './App.css';

const App: React.FC = () => {
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
