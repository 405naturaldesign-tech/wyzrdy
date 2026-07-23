import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import routes from './routes/index.js';
import stripeWebhook from './routes/stripe-webhook.js';
import { errorMiddleware } from './middleware/error.js';
import { globalRateLimit } from './middleware/global-rate-limit.js';
import logger from './utils/logger.js';
import { BodyLimit } from './constants/common.js';
import { validateEnv } from './config/env.js';
import { metricsMiddleware } from './utils/metrics.js';
import { correlationId } from './middleware/tier.js';

validateEnv();

const app = express();

app.set('trust proxy', true);

process.on('uncaughtException', (error) => {
	logger.error('Uncaught exception:', error);
});
  
process.on('unhandledRejection', (reason, promise) => {
	logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});

process.on('SIGINT', async () => {
	logger.info('Interrupted');
	process.exit(0);
});

process.on('SIGTERM', async () => {
	logger.info('SIGTERM signal received');

	await new Promise(resolve => setTimeout(resolve, 3000));

	logger.info('Exiting');
	process.exit();
});

app.use(helmet());
app.use(cors({
	origin: process.env.CORS_ORIGIN || false, // deny cors when unset (on purpose)
	methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'QUERY'],
	allowedHeaders: ['Authorization', 'Content-Type'],
}));
app.use(morgan('combined'));
app.use(correlationId);

// Stripe webhook MUST receive the raw body for HMAC signature verification,
// so it is registered BEFORE the JSON body parser below.
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhook);

app.use(metricsMiddleware);
app.use(globalRateLimit);
app.use(express.json({
	limit: BodyLimit,
}));
app.use(express.urlencoded({ 
	extended: true,
	limit: BodyLimit,
}));

app.use('/', routes());

app.use(errorMiddleware);

app.use((req, res) => {
	res.status(404).json({ error: 'Route not found' });
});

const port = process.env.PORT || 3001;

app.listen(port, () => {
	logger.info(`🚀 API Server running on http://localhost:${port}`);
});

export default app;
