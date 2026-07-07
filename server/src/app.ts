import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import {
  handleDecompose,
  handleInferProgress,
  handleMatchCommit,
  handleInferScreen,
  authMiddleware,
} from './controllers/gemini-controller.js';

const app = express();

// Trust proxy so req.ip reflects X-Forwarded-For; env-configurable per deployment topology.
const trustProxy = process.env.TRUST_PROXY ?? '1';
app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);

app.use(
  cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
  })
);
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res, _next, options) => {
    console.warn(`[Server] Rate limit hit: ${req.method} ${req.path} from ${req.ip}`);
    res.status(options.statusCode).json({ error: options.message });
  },
});

app.use('/api/', apiLimiter);
app.use('/api/', authMiddleware);

// Basic health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.post('/api/decompose', handleDecompose);
app.post('/api/infer-progress', handleInferProgress);
app.post('/api/match-commit', handleMatchCommit);
app.post('/api/infer-screen', handleInferScreen);

export default app;
