import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api')
      .then(response => response.text())
      .then(data => setMessage(data))
      .catch(err => setError(err.message))
  }, [])

  return (
    <div className="App">
      <h1>Up or Down</h1>
      {error ? (
        <p style={{ color: 'red' }}>Error: {error}</p>
      ) : (
        <p>{message || 'Loading...'}</p>
      )}
    </div>
  )
}

export default App
