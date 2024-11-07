import { handleSmsPost } from './src/handlers/smsHandler.js';

// Error handling middleware
async function errorHandler(error) {
	console.error('Application error:', error);

	return new Response(
		JSON.stringify({
			error: 'Internal Server Error',
			message: error.message,
		}),
		{
			status: 500,
			headers: {
				'Content-Type': 'application/json',
			},
		}
	);
}

// Main request handler with routing
async function handleRequest(request) {
	try {
		const url = new URL(request.url);

		// Route handling
		if (request.method === 'POST' && url.pathname === '/sms') {
			return await handleSmsPost(request);
		}

		// Health check endpoint
		if (request.method === 'GET' && url.pathname === '/health') {
			return new Response('OK', { status: 200 });
		}

		// Handle 404
		return new Response('Not Found', { status: 404 });
	} catch (error) {
		return errorHandler(error);
	}
}

// Register event listener
addEventListener('fetch', (event) => {
	event.respondWith(handleRequest(event.request));
});

// Export for testing
export { handleRequest, errorHandler };
