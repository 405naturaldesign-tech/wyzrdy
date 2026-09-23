import cron from 'node-cron';
import http from 'http';

const API_URL = process.env.API_URL || 'http://api:3001';
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || 'your-service-token-change-me';
const HEALTH_CHECK_INTERVAL = process.env.HEALTH_CHECK_INTERVAL || '*/5 * * * *'; // Every 5 minutes

console.log(`Scheduler started. Polling ${API_URL}/monitor/health every 5 minutes.`);

// Health check task
const task = cron.schedule(HEALTH_CHECK_INTERVAL, async () => {
	try {
		const url = new URL('/monitor/health', API_URL);

		const options = {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${SERVICE_TOKEN}`
			}
		};

		const response = await new Promise((resolve, reject) => {
			const req = http.request(url, options, (res) => {
				let data = '';
				res.on('data', (chunk) => {
					data += chunk;
				});
				res.on('end', () => {
					resolve({
						statusCode: res.statusCode,
						body: data
					});
				});
			});

			req.on('error', reject);
			req.end();
		});

		if (response.statusCode >= 200 && response.statusCode < 300) {
			console.log(`✓ Health check passed at ${new Date().toISOString()}`);
		} else {
			console.error(`✗ Health check failed with status ${response.statusCode} at ${new Date().toISOString()}`);
			console.error(`Response: ${response.body}`);
		}
	} catch (error) {
		console.error(`✗ Health check error at ${new Date().toISOString()}:`, error.message);
	}
});

// Start the scheduler
task.start();

// Handle graceful shutdown
process.on('SIGTERM', () => {
	console.log('SIGTERM received, shutting down gracefully...');
	task.stop();
	process.exit(0);
});

process.on('SIGINT', () => {
	console.log('SIGINT received, shutting down gracefully...');
	task.stop();
	process.exit(0);
});
