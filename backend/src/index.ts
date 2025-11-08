import express from 'express';

const app = express();
const port = process.env.LISTEN_PORT || 3000;

// Add CORS headers for development
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.get('/', (_req, res) => {
  res.send('Hello from the backend!');
});

app.listen(port, () => {
  console.log(`Backend server is running at http://localhost:${port}`);
});
