import { MemoryService } from '../utils/memory.js';
import { determineDimension, generateMainCharacterResponse, getNextUncoveredDimension, getNextQuestion } from '../services/openai.js';
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

		// Ensure dimensions is initialized
		if (!userContext.dimensions) {
			userContext.dimensions = {};
		}
		console.log(`Dimensions: ${JSON.stringify(userContext.dimensions)}`);

		// Check rate limit
		userContext = await handleRateLimit(userContext);
		console.log('Rate limit check passed');

		// Determine message dimension
		let dimension;
		if (Object.keys(userContext.dimensions).length < 8) {
			dimension = getNextUncoveredDimension(userContext);
			userContext.dimensions[dimension] = { covered: true, questions: [] };
		} else {
			dimension = await determineDimension(body, env.OPENAI_API_KEY);
		}
		console.log(`Determined dimension: ${dimension}`);

		// Get the last question asked for this dimension
		const lastQuestionIndex = userContext.dimensions[dimension].questions.length - 1;
		const lastQuestion = userContext.dimensions[dimension].questions[lastQuestionIndex]?.question;
		console.log(`Last question for ${dimension}: ${lastQuestion}`);

		// Update the answer for the last question
		if (lastQuestion) {
			userContext.dimensions[dimension].questions[lastQuestionIndex].answer = body;
			userContext.dimensions[dimension].questions[lastQuestionIndex].timestamp = Date.now();
		} else {
			// If no last question, add the answer directly
			userContext.dimensions[dimension].questions.push({ answer: body, timestamp: Date.now() });
		}
		console.log(`Updated questions for ${dimension}: ${JSON.stringify(userContext.dimensions[dimension].questions)}`);

		// Generate the next question for the dimension
		const nextQuestion = getNextQuestion(userContext, dimension);
		console.log(`Next question for dimension ${dimension}: ${nextQuestion}`);

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
