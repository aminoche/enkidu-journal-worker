import { MemoryService } from '../utils/memory.js';
import { determineDimension, generateMainCharacterResponse } from '../services/openai.js';
import { sendSmsSafely } from '../utils/sms.js';
import { CONFIG } from '../config/config.js';

// Parse SMS request parameters
async function parseSmsRequest(request) {
	const formData = await request.formData();
	return {
		from: formData.get('From'),
		body: formData.get('Body'),
	};
}

// Cache request body since it can only be read once
async function cacheRequestBody(request) {
	const body = await request.text();
	return new Request(request.url, {
		method: request.method,
		headers: request.headers,
		body,
	});
}

// Handle rate limiting
async function handleRateLimit(userContext) {
	const now = Date.now();
	const recentRequests = userContext.requestHistory || [];

	// Clean up old requests outside window
	const validRequests = recentRequests.filter((timestamp) => now - timestamp < CONFIG.RATE_LIMIT.WINDOW_MS);

	if (validRequests.length >= CONFIG.RATE_LIMIT.MAX_REQUESTS) {
		throw new Error('Rate limit exceeded');
	}

	userContext.requestHistory = [...validRequests, now];
	return userContext;
}

// Main SMS handler
export async function handleSmsPost(request, env) {
	try {
		console.log('Handling SMS POST request');

		const memoryService = new MemoryService(env.USER_DATA);

		// Cache request body
		const cachedRequest = await cacheRequestBody(request);

		// Parse SMS details
		const { from, body } = await parseSmsRequest(cachedRequest);
		console.log(`Received SMS from ${from}`);

		// Get user context
		let userContext = await memoryService.getUserContext(from);

		// Check rate limit
		userContext = await handleRateLimit(userContext);

		// Determine message dimension
		const dimension = await determineDimension(body, env.OPENAI_API_KEY);

		// Generate AI response
		const response = await generateMainCharacterResponse(userContext, body, dimension, env.OPENAI_API_KEY);

		// Update user context
		await memoryService.updateUserContext(userContext);

		// Send AI response back to the user
		await sendSmsSafely(
			{
				to: from,
				body: response,
			},
			env
		);
		console.log('AI response sent successfully');

		// Return an empty response body with a 200 OK status
		return new Response(null, { status: 200 });
	} catch (error) {
		console.error('Error handling SMS:', error);
		return new Response(error.message, { status: 500 });
	}
}
