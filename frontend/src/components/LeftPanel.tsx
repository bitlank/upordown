import React from 'react';

interface LeftPanelProps {
  score: number;
}

const LeftPanel: React.FC<LeftPanelProps> = ({ score }) => {
  return (
    <div>
      <h2>User</h2>
      <div>Score: <span>{score}</span></div>
      {/* Leaderboard placeholder */}
      <div style={{ marginTop: '2rem', fontSize: '0.9em', color: '#888' }}>
        Leaderboard (coming soon)
      </div>
    </div>
  );
};

export default LeftPanel;
