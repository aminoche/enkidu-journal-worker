import { AI_CONFIG } from '../config/config.js';
import { questions } from './questions.js';
import { dimensions } from './dimensions.js';

// Get the next uncovered dimension
function getNextUncoveredDimension(userContext) {
	const allDimensions = Object.keys(dimensions);

	const uncoveredDimensions = allDimensions.filter((dimension) => !userContext.dimensions[dimension]?.covered);

	return uncoveredDimensions.length > 0 ? uncoveredDimensions[0] : null;
}

// Get the next question for a dimension
function getNextQuestion(userContext, dimension) {
	if (!userContext.dimensions[dimension]) {
		userContext.dimensions[dimension] = { covered: false, questions: [] };
	}
	const coveredQuestions = userContext.dimensions[dimension].questions;
	const dimensionQuestions = questions[dimension];

	if (!dimensionQuestions) {
		throw new Error(`No questions found for dimension: ${dimension}`);
	}

	const nextQuestionIndex = coveredQuestions.length;

	console.log(`Covered questions for ${dimension}: ${JSON.stringify(coveredQuestions)}`);
	console.log(`All questions for ${dimension}: ${JSON.stringify(dimensionQuestions)}`);

	if (nextQuestionIndex < dimensionQuestions.length) {
		const nextQuestion = dimensionQuestions[nextQuestionIndex];
		coveredQuestions.push({ question: nextQuestion, answer: null, timestamp: Date.now() });
		userContext.dimensions[dimension].questions = coveredQuestions;
		return nextQuestion;
	}

	return null;
}

// Determine message dimension using OpenAI
async function determineDimension(smsBody, apiKey) {
	const prompt = `
    Please analyze the following message and identify the dimension it best aligns with.
    Return one and only one of the following dimensions:
    - Identity and Values
    - Key Experiences
    - Creative Drive
    - Family Connections
    - Mental Health
    - Motivation Growth
    - Setbacks Wins
    - Faith Philosophy

    Message: "${smsBody}"

    Respond ONLY with the dimension name without extra text.
  `;

	try {
		const response = await fetch(AI_CONFIG.API_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model: AI_CONFIG.MODEL,
				messages: [{ role: 'system', content: prompt }],
				max_tokens: AI_CONFIG.MAX_TOKENS,
				temperature: AI_CONFIG.TEMPERATURE,
			}),
		});

		const data = await response.json();
		if (!data.choices?.[0]?.message?.content) {
			throw new Error('Invalid OpenAI response format');
		}

		const dimension = data.choices[0].message.content.trim();

		if (!dimensions[dimension]) {
			console.warn('Unrecognized dimension, retrying...');
			return await determineDimension(smsBody, apiKey);
		}

		return dimension;
	} catch (error) {
		console.error('Error determining dimension:', error);
		throw error;
	}
}

// Build main character prompt
function buildMainCharacterPrompt(userContext, message, dimension) {
	const nextQuestion = getNextQuestion(userContext, dimension);
	console.log(`Next question for dimension ${dimension}: ${nextQuestion}`);
	return `
    Act as an empathetic AI companion helping someone process their thoughts and feelings.
    Consider their message in the context of ${dimension}.
    Current user depth level: ${userContext.depth}
    Recent history: ${JSON.stringify(userContext.history.slice(-3))}

    User message: "${message}"

    Provide a thoughtful, empathetic response that:
    1. Acknowledges their feelings
    2. Shows understanding of their situation
    3. Offers gentle guidance or perspective
    4. Encourages further reflection
    5. Ties back to the dimension of ${dimension}
    6. Asks the following question: "${nextQuestion}"

    Keep the response concise and natural.
  `;
}

// Generate main character response
async function generateMainCharacterResponse(userContext, message, dimension, apiKey) {
	const prompt = buildMainCharacterPrompt(userContext, message, dimension);

	try {
		const response = await fetch(AI_CONFIG.API_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model: AI_CONFIG.MODEL,
				messages: [{ role: 'system', content: prompt }],
				max_tokens: AI_CONFIG.MAX_TOKENS,
				temperature: AI_CONFIG.TEMPERATURE,
			}),
		});

		const data = await response.json();
		return data.choices[0].message.content.trim();
	} catch (error) {
		console.error('Error generating response:', error);
		throw error;
	}
}

// Generate thematic summaries
async function generateThematicSummaries(userContext) {
	const summaries = {};

	// Group messages by dimension
	const messagesByDimension = userContext.history.reduce((acc, message) => {
		const dimension = message.dimension || 'unknown';
		if (!acc[dimension]) {
			acc[dimension] = [];
		}
		acc[dimension].push(message);
		return acc;
	}, {});

	// Generate summaries for each dimension
	for (const [dimension, messages] of Object.entries(messagesByDimension)) {
		const summary = await generateSummaryForDimension(messages, dimension);
		summaries[dimension] = summary;
	}

	return summaries;
}

// Generate summary for a specific dimension
async function generateSummaryForDimension(messages, dimension) {
	const prompt = `
    Summarize the following messages in the context of ${dimension}:
    ${messages.map((msg) => msg.content).join('\n')}

    Provide a concise summary that captures the key insights and themes.
  `;

	const response = await fetch(AI_CONFIG.API_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${AI_CONFIG.API_KEY}`,
		},
		body: JSON.stringify({
			model: AI_CONFIG.MODEL,
			messages: [{ role: 'system', content: prompt }],
			max_tokens: AI_CONFIG.MAX_TOKENS,
			temperature: AI_CONFIG.TEMPERATURE,
		}),
	});

	const data = await response.json();
	return data.choices[0].message.content.trim();
}

export { determineDimension, generateMainCharacterResponse, generateThematicSummaries, getNextUncoveredDimension, getNextQuestion };
