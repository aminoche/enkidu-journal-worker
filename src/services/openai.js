import { AI_CONFIG } from '../config/config.js';

// Map dimension names to user context keys
function mapDimension(dimension) {
	const dimensionMap = {
		'Identity and Values': 'identity',
		'Key Experiences': 'experiences',
		'Creative Drive': 'creative',
		'Family Connections': 'family',
		'Mental Health': 'mental',
		'Motivation Growth': 'motivation',
		'Setbacks Wins': 'setbacks',
		'Faith Philosophy': 'faith',
	};
	return dimensionMap[dimension];
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
		const mappedDimension = mapDimension(dimension);

		if (!mappedDimension) {
			console.warn('Unrecognized dimension, retrying...');
			return await determineDimension(smsBody, apiKey);
		}

		return mappedDimension;
	} catch (error) {
		console.error('Error determining dimension:', error);
		throw error;
	}
}

// Build main character prompt
function buildMainCharacterPrompt(userContext, message, dimension) {
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
	// Implementation for generating thematic summaries
	// This would analyze user history and generate summaries for each dimension
}

export { determineDimension, generateMainCharacterResponse, generateThematicSummaries, mapDimension };
