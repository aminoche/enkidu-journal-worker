// Configuration constants for API interactions and limits
const CONFIG = {
	MAX_SMS_LENGTH: 1600,
	RECENT_HISTORY_LIMIT: 50,
	MAX_HISTORY_LENGTH: 200,
	OPENAI_API_URL: 'https://api.openai.com/v1/chat/completions',
};

// Valid dimensions for verification
const VALID_DIMENSIONS = [
	'identityAndValues',
	'keyExperiences',
	'creativeDrive',
	'familyConnections',
	'mentalHealth',
	'motivationGrowth',
	'setbacksWins',
	'faithPhilosophy',
];

// Event listener for incoming requests
addEventListener('fetch', (event) => {
	event.respondWith(handleSmsPost(event.request));
});

// Main function to handle SMS POST requests
async function handleSmsPost(request) {
	try {
		console.log('Starting SMS POST request handling...');

		const bodyText = await cacheRequestBody(request);
		const { from, smsBody } = parseSmsRequest(bodyText);
		console.log(`Parsed SMS - From: ${from}, Body: ${smsBody}`);

		let userContext = await getUserContext(from);
		console.log('User context successfully retrieved or initialized.');

		if (await handleRateLimit(from, userContext)) {
			return new Response('Rate limit exceeded. Try again later.', { status: 429 });
		}

		const dimension = await determineDimension(smsBody);
		console.log(`Dimension detected: ${dimension}`);

		const mainCharacterResponse = await generateMainCharacterResponse(userContext, smsBody, dimension);
		console.log('Response generated successfully from OpenAI.');

		// Update memory and generate thematic summaries
		await updateMemory(userContext, smsBody, false, dimension);
		await updateMemory(userContext, mainCharacterResponse, true, dimension);

		// Save the final updated user context in storage once
		await updateUserContext(from, userContext);
		console.log(`User context successfully updated in storage for user ${from}.`);

		await sendSmsSafely(from, mainCharacterResponse);
		console.log(`SMS response sent successfully to ${from}.`);

		return new Response(null, { status: 204 });
	} catch (error) {
		console.error('Error during SMS POST request processing:', error);
		return new Response('Internal Server Error', { status: 500 });
	}
}

// Caches the request body to prevent multiple consumptions
async function cacheRequestBody(request) {
	if (request.bodyUsed) throw new Error('Request body already consumed.');
	return await request.text();
}

// Parses SMS request for 'From' and 'Body' parameters
function parseSmsRequest(bodyText) {
	const params = new URLSearchParams(bodyText);
	const from = params.get('From');
	const smsBody = params.get('Body');

	if (!from || !smsBody) throw new Error('Missing "From" or "Body" parameters');
	return { from, smsBody };
}

// Fetches user context from KV storage or initializes new context if absent
async function getUserContext(from) {
	const userKey = `user_${from}`;
	const userContextRaw = await USER_DATA.get(userKey);
	let userContext = userContextRaw ? JSON.parse(userContextRaw) : null;

	async function generateThematicSummaries(userContext) {
		const dimensions = Object.keys(userContext.thematicSummaries);

		for (const dimension of dimensions) {
			// Get recent messages for this dimension that are not responses
			const relevantMessages = userContext.history
				.filter((message) => message.dimension === dimension && !message.isResponse)
				.map((msg) => msg.message)
				.join('; ');

			if (relevantMessages) {
				const summaryPrompt = `
				Summarize the following messages about ${dimension} in a concise way:
				"${relevantMessages}"
			`;

				try {
					const response = await fetch(CONFIG.OPENAI_API_URL, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
						body: JSON.stringify({
							model: 'gpt-4-turbo',
							messages: [{ role: 'system', content: summaryPrompt }],
						}),
					});

					const data = await response.json();
					if (data.choices && data.choices[0].message) {
						userContext.thematicSummaries[dimension] = data.choices[0].message.content.trim();
					}
				} catch (error) {
					console.error(`Error generating summary for ${dimension}:`, error);
				}
			}
		}

		// Save the updated user context with new summaries
		await updateUserContext(userContext);
	}

	// Initialize thematicSummaries and dimensionsIntroduced if they don't exist
	if (!userContext || !userContext.thematicSummaries || !userContext.dimensionsIntroduced) {
		userContext = {
			history: userContext?.history || [],
			historyArchive: userContext?.historyArchive || [],
			dimensionsIntroduced: {
				identityAndValues: false,
				keyExperiences: false,
				creativeDrive: false,
				familyConnections: false,
				mentalHealth: false,
				motivationGrowth: false,
				setbacksWins: false,
				faithPhilosophy: false,
			},
			thematicSummaries: {
				identityAndValues: '',
				keyExperiences: '',
				creativeDrive: '',
				familyConnections: '',
				mentalHealth: '',
				motivationGrowth: '',
				setbacksWins: '',
				faithPhilosophy: '',
			},
			milestones: userContext?.milestones || {
				goals: ['Establish meaningful friendships', 'Improve emotional resilience'],
				lastFollowUp: null,
			},
			streak: userContext?.streak || 0,
			tier: userContext?.tier || 1,
			depth: userContext?.depth || 'Moderate',
			emotionalState: userContext?.emotionalState || 'Neutral',
			emotionalTrends: userContext?.emotionalTrends || [],
			rateLimit: userContext?.rateLimit || { count: 0, lastMessageTime: 0 },
		};
	}

	return userContext;
}

async function generateThematicSummaries(userContext) {
	const dimensions = Object.keys(userContext.thematicSummaries);

	for (const dimension of dimensions) {
		const relevantMessages = userContext.history
			.filter((message) => message.dimension === dimension && !message.isResponse)
			.map((msg) => msg.message)
			.join('; ');

		if (relevantMessages) {
			const summaryPrompt = `
				Summarize the following messages about ${dimension} in a concise way:
				"${relevantMessages}"
			`;

			try {
				const response = await fetch(CONFIG.OPENAI_API_URL, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
					body: JSON.stringify({
						model: 'gpt-4-turbo',
						messages: [{ role: 'system', content: summaryPrompt }],
					}),
				});

				const data = await response.json();
				if (data.choices && data.choices[0].message) {
					userContext.thematicSummaries[dimension] = data.choices[0].message.content.trim();
				}
			} catch (error) {
				console.error(`Error generating summary for ${dimension}:`, error);
			}
		}
	}
}

// Updates user context in KV storage
async function updateUserContext(from, userContext) {
	const userKey = `user_${from}`;
	await USER_DATA.put(userKey, JSON.stringify(userContext));
	console.log('User context successfully updated in storage.');
}

// Adaptive rate limit function for handling user engagement
async function handleRateLimit(from, userContext) {
	const maxMessages = 50;
	const abuseLimit = 100;
	const resetTime = 300000;
	const abuseResetTime = 60000;

	const currentTime = Date.now();

	if (userContext.rateLimit.count >= abuseLimit && currentTime - userContext.rateLimit.lastMessageTime < abuseResetTime) {
		console.warn(`Abusive rate limit exceeded for user ${from}.`);
		return true;
	}

	if (userContext.rateLimit.count >= maxMessages && currentTime - userContext.rateLimit.lastMessageTime < resetTime) {
		console.warn(`Standard rate limit exceeded for user ${from}.`);
		return true;
	}

	if (currentTime - userContext.rateLimit.lastMessageTime > resetTime) {
		userContext.rateLimit.count = 0;
	}

	userContext.rateLimit.count += 1;
	userContext.rateLimit.lastMessageTime = currentTime;
	await updateUserContext(from, userContext);

	return false;
}

// Maps OpenAI dimension names to keys in `userContext.dimensionsIntroduced`
function mapDimension(dimension) {
	const dimensionMapping = {
		'Identity and Values': 'identityAndValues',
		'Key Experiences': 'keyExperiences',
		'Creative Drive': 'creativeDrive',
		'Family Connections': 'familyConnections',
		'Mental Health': 'mentalHealth',
		'Motivation Growth': 'motivationGrowth',
		'Setbacks Wins': 'setbacksWins',
		'Faith Philosophy': 'faithPhilosophy',
	};
	return dimensionMapping[dimension] || null;
}

// Determines which dimension to focus on using OpenAI with validation
async function determineDimension(smsBody) {
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
		const openaiResponse = await fetch(CONFIG.OPENAI_API_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
			body: JSON.stringify({
				model: 'gpt-4-turbo',
				messages: [{ role: 'system', content: prompt }],
			}),
		});

		const data = await openaiResponse.json();
		if (!data.choices || !data.choices[0].message) throw new Error('Invalid OpenAI response format.');

		const dimension = data.choices[0].message.content.trim();
		const mappedDimension = mapDimension(dimension);

		// Re-prompt if OpenAI response does not match valid dimensions
		if (!mappedDimension) {
			console.warn('OpenAI returned an unrecognized dimension; re-prompting...');
			return await determineDimension(smsBody); // Retry the request for a valid response
		}

		return mappedDimension;
	} catch (error) {
		console.error('Error determining dimension from OpenAI:', error);
		throw error; // Ensure failure if OpenAI cannot deliver a valid response after re-prompting
	}
}

// Builds the main prompt for OpenAI to generate an empathetic response based on user context and dimension
function buildMainCharacterPrompt(userContext, smsBody, dimension) {
	const explanations = {
		identityAndValues: 'Exploring Identity and Values helps me connect with your core beliefs and principles.',
		keyExperiences: 'Understanding Key Experiences and Career gives insight into your journey.',
		creativeDrive: 'Creativity and Legacy help me see your passions and the mark you want to leave.',
		familyConnections: 'Family, Culture, and Connections ground us and shape perspectives.',
		mentalHealth: 'Mental Health and Self-Worth help me support you in a balanced way.',
		motivationGrowth: 'Motivation and Growth reveal your ambitions and personal goals.',
		setbacksWins: 'Setbacks and Wins show how you handle life’s ups and downs.',
		faithPhilosophy: 'Faith, Philosophy, and Purpose guide your worldview and deeper purpose.',
	};

	// Ensure the detected dimension is valid
	if (!(dimension in userContext.dimensionsIntroduced)) {
		console.error(`Invalid dimension detected: ${dimension}`);
		return '';
	}

	const dimensionExplanation = !userContext.dimensionsIntroduced[dimension] ? explanations[dimension] : '';
	if (dimensionExplanation) {
		userContext.dimensionsIntroduced[dimension] = true;
	}

	const summaryText = userContext.thematicSummaries[dimension] || 'No summary available for this dimension.';

	return `
        You are an empathetic and conversational AI friend aiming for a 100% understanding of the user across eight dimensions. Guide conversations naturally back to dimensions if it strays.

        **8 Key Dimensions for Understanding and Matching**:
        1. **Identity and Values**: Core beliefs and principles that guide the user’s actions.
        2. **Key Experiences and Career**: Major experiences and their impact on career and life outlook.
        3. **Creative Drive and Legacy**: How creativity influences their life and their envisioned legacy.
        4. **Family, Culture, and Connections**: Influence of family, culture, and relationships on their perspective.
        5. **Mental Health and Self-Worth**: Approaches to managing well-being and maintaining a sense of worth.
        6. **Motivation and Growth**: Balance between personal ambition, growth, and perfectionism.
        7. **Setbacks and Wins**: Approach to handling setbacks and celebrating achievements.
        8. **Faith, Philosophy, and Purpose**: Beliefs that shape their purpose, worldview, and sense of meaning.

        Dimension focus: ${dimensionExplanation}

        Summary for ${dimension}: "${summaryText}"

        User message: "${smsBody}"
    `;
}

// Generates an empathetic response tailored to the user's context
async function generateMainCharacterResponse(userContext, smsBody, dimension) {
	const openaiPrompt = buildMainCharacterPrompt(userContext, smsBody, dimension);

	try {
		const openaiResponse = await fetch(CONFIG.OPENAI_API_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
			body: JSON.stringify({
				model: 'gpt-4-turbo',
				messages: [
					{ role: 'system', content: openaiPrompt },
					{ role: 'user', content: smsBody },
				],
			}),
		});

		const data = await openaiResponse.json();
		if (!data.choices || !data.choices[0].message) throw new Error('Invalid OpenAI response format.');
		return data.choices[0].message.content.trim();
	} catch (error) {
		console.error('Error generating response from OpenAI:', error);
		return 'Sorry, I’m having trouble responding right now. Let’s try again later.';
	}
}

// Helper functions to adjust user attributes and behaviors
function adjustTier(userContext) {
	const recentMessages = userContext.history.slice(-5);
	const importantCount = recentMessages.filter((msg) => msg.important).length;

	if (importantCount >= 3) userContext.tier = Math.min(userContext.tier + 1, 3);
	else if (importantCount <= 1 && userContext.tier > 1) userContext.tier = Math.max(userContext.tier - 1, 1);
}

async function adjustDepth(userContext, message) {
	const keywords = ['stressed', 'happy', 'worried', 'inspired', 'lonely'];
	const containsEmotionalKeywords = keywords.some((keyword) => message.toLowerCase().includes(keyword));

	if (containsEmotionalKeywords) {
		increaseDepth(userContext);
	} else {
		try {
			const emotion = await fetchEmotionalAnalysis(message);
			if (emotion === 'positive' || emotion === 'negative') increaseDepth(userContext);
			else decreaseDepth(userContext);
		} catch (error) {
			console.warn('Failed OpenAI sentiment analysis, defaulting to previous depth.');
			decreaseDepth(userContext);
		}
	}
}

function adjustStreak(userContext) {
	const recentMessages = userContext.history.slice(-2);
	const isEngaged = recentMessages.every((msg) => msg.sender === 'user');
	userContext.streak = isEngaged ? userContext.streak + 1 : 0;
}

function increaseDepth(userContext) {
	if (userContext.depth === 'Moderate') userContext.depth = 'High';
	else if (userContext.depth === 'High') userContext.depth = 'Very High';
}

function decreaseDepth(userContext) {
	if (userContext.depth === 'Very High') userContext.depth = 'High';
	else if (userContext.depth === 'High') userContext.depth = 'Moderate';
}

// Updates user memory with the new message and sender
async function updateMemory(userContext, message, isResponse = false, dimension = null) {
	const sender = isResponse ? 'ai' : 'user';
	const newMemory = {
		message,
		timestamp: Date.now(),
		isResponse,
		sender,
		important: tagMessage(message),
		dimension, // Storing the dimension for thematic summarization
	};

	userContext.history.push(newMemory);

	// Archive older messages if exceeding limit
	if (userContext.history.length > CONFIG.RECENT_HISTORY_LIMIT) {
		userContext.history = manageRecentMemory(userContext.history);
		if (userContext.historyArchive.length > CONFIG.MAX_HISTORY_LENGTH) summarizeAndArchive(userContext);
	}

	// Adjust user attributes and generate updated thematic summaries
	adjustTier(userContext);
	adjustDepth(userContext, message);
	adjustStreak(userContext);
	await generateThematicSummaries(userContext);
}

// Helper function to summarize and archive memory
function summarizeAndArchive(userContext) {
	const archivePortion = userContext.history.splice(0, CONFIG.RECENT_HISTORY_LIMIT / 2);

	// Ensure historyArchive is initialized
	if (!userContext.historyArchive) userContext.historyArchive = [];

	userContext.historyArchive.push(...archivePortion);
	if (userContext.historyArchive.length > CONFIG.MAX_HISTORY_LENGTH) {
		userContext.historyArchive = userContext.historyArchive.slice(-CONFIG.MAX_HISTORY_LENGTH);
	}
}

// Helper functions for memory management
function manageRecentMemory(history) {
	return history.slice(-CONFIG.RECENT_HISTORY_LIMIT);
}

function tagMessage(message) {
	const keywords = ['help', 'stressed', 'advice', 'sad', 'relationship', 'confused', 'excited', 'job', 'friend'];
	return keywords.some((keyword) => message.toLowerCase().includes(keyword));
}

async function fetchEmotionalAnalysis(message) {
	const response = await fetch(CONFIG.OPENAI_API_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
		body: JSON.stringify({
			model: 'gpt-4-turbo',
			messages: [
				{ role: 'system', content: 'Analyze the emotional tone: positive, negative, or neutral.' },
				{ role: 'user', content: message },
			],
		}),
	});
	const data = await response.json();
	if (!data.choices || !data.choices[0].message) throw new Error('Invalid OpenAI emotion analysis response.');
	return data.choices[0].message.content.toLowerCase();
}

async function sendSmsSafely(to, body) {
	if (body.length <= CONFIG.MAX_SMS_LENGTH) await sendSmsWithRetry(to, body);
	else {
		const messageParts = splitMessage(body, CONFIG.MAX_SMS_LENGTH);
		for (const part of messageParts) await sendSmsWithRetry(to, part);
	}
}

function splitMessage(message, maxLength) {
	const parts = [];
	let currentIndex = 0;
	while (currentIndex < message.length) {
		parts.push(message.slice(currentIndex, currentIndex + maxLength));
		currentIndex += maxLength;
	}
	return parts;
}

async function sendSmsWithRetry(to, body, retries = 3) {
	for (let attempt = 0; attempt < retries; attempt++) {
		try {
			const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
				method: 'POST',
				headers: {
					Authorization: `Basic ${btoa(TWILIO_ACCOUNT_SID + ':' + TWILIO_AUTH_TOKEN)}`,
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams({ From: TWILIO_PHONE_NUMBER, To: to, Body: body }),
			});
			if (response.ok) return console.log('SMS sent successfully.');
		} catch (error) {
			console.error(`Attempt ${attempt + 1} failed to send SMS:`, error);
		}
		await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
	}
	console.error('Failed to send SMS after multiple attempts.');
}
