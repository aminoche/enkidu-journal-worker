import { MemoryService } from '../utils/memory.js';
import { determineDimension, generateMainCharacterResponse, getNextUncoveredDimension } from '../services/openai.js';
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
		console.log(`User context: ${JSON.stringify(userContext)}`);

		// Ensure coveredDimensions is initialized
		if (!userContext.coveredDimensions) {
			userContext.coveredDimensions = [];
		}
		console.log(`Covered dimensions: ${JSON.stringify(userContext.coveredDimensions)}`);

		// Ensure coveredQuestions is initialized
		if (!userContext.coveredQuestions) {
			userContext.coveredQuestions = {};
		}
		console.log(`Covered questions: ${JSON.stringify(userContext.coveredQuestions)}`);

		// Check rate limit
		userContext = await handleRateLimit(userContext);
		console.log('Rate limit check passed');

		// Determine message dimension
		let dimension;
		if (userContext.coveredDimensions.length < 8) {
			dimension = getNextUncoveredDimension(userContext);
			userContext.coveredDimensions.push(dimension);
		} else {
			dimension = await determineDimension(body, env.OPENAI_API_KEY);
		}
		console.log(`Determined dimension: ${dimension}`);

		// Log the state of coveredQuestions for the determined dimension
		console.log(`Covered questions for ${dimension}: ${JSON.stringify(userContext.coveredQuestions[dimension])}`);

		// Get the last question asked for this dimension
		const lastQuestion = userContext.coveredQuestions[dimension]?.[userContext.coveredQuestions[dimension].length - 1];
		console.log(`Last question for ${dimension}: ${lastQuestion}`);

		// Update user context with the question and answer
		if (!userContext.answers) {
			userContext.answers = [];
		}
		userContext.answers.push({ question: lastQuestion, answer: body });
		console.log(`Updated answers: ${JSON.stringify(userContext.answers)}`);

		// Generate AI response
		const response = await generateMainCharacterResponse(userContext, body, dimension, env.OPENAI_API_KEY);
		console.log(`Generated AI response: ${response}`);

		// Update user context in KV storage
		await memoryService.updateUserContext(userContext);
		console.log('User context updated');

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
