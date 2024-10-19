export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		// Handle POST request to store SMS and generate Enkidu Journal response
		if (request.method === 'POST') {
			return await handleSmsPost(request, env, ctx);
		}

		return new Response('Only POST method is supported', { status: 405 });
	},
};

// Function to call OpenAI API for Enkidu Journal's custom response and follow-up questions
async function generateEnkiduJournalResponse(userContext, newMessage, env) {
	const escalationSection =
		userContext.tier >= 4
			? 'Enkidu Journal is becoming a trusted companion. Offer insights that align with trust and deeper vulnerability.'
			: "Based on the user's current openness, provide support and guidance to encourage deeper engagement.";

	// OpenAI call for generating journal response
	const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${env.OPENAI_API_KEY}`, // Using the secret stored in Cloudflare
		},
		body: JSON.stringify({
			model: 'gpt-4',
			messages: [
				{
					role: 'system',
					content: `You are Enkidu Journal, an empathetic and insightful assistant designed to help users across career, relationships, wellness, and more.`,
				},
				{
					role: 'system',
					content: `This is the user's history: ${userContext.history.join(' | ')}. User is currently in tier ${
						userContext.tier
					}. Emotional state: ${userContext.emotionalState || 'neutral'}. ${escalationSection}`,
				},
				{
					role: 'user',
					content: newMessage,
				},
			],
		}),
	});

	const data = await openaiResponse.json();

	// Log detected focus areas for debugging
	console.log(`OpenAI Response: ${JSON.stringify(data)}`);

	return data.choices[0].message.content.trim();
}

// Retry logic for sending SMS with Twilio
async function sendSmsWithRetry(env, from, body, retries = 3) {
	for (let attempt = 0; attempt < retries; attempt++) {
		try {
			const response = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + env.TWILIO_ACCOUNT_SID + '/Messages.json', {
				method: 'POST',
				headers: {
					Authorization: `Basic ${btoa(env.TWILIO_ACCOUNT_SID + ':' + env.TWILIO_AUTH_TOKEN)}`,
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams({
					From: env.TWILIO_PHONE_NUMBER,
					To: from,
					Body: body,
				}),
			});
			const result = await response.json();
			if (response.ok) {
				console.log('SMS sent successfully:', result.sid);
				return result;
			} else {
				console.log('Failed to send SMS, attempt:', attempt + 1);
			}
		} catch (error) {
			console.error('Error sending SMS:', error);
		}
	}
	console.error('SMS failed after max retries');
	return null;
}

// Function to handle POST request and generate Enkidu Journal's response
async function handleSmsPost(request, env, ctx) {
	try {
		const bodyText = await request.text();
		const params = new URLSearchParams(bodyText);
		const from = params.get('From');
		const smsBody = params.get('Body');

		if (!from || !smsBody) {
			return new Response('Missing From or Body parameters', { status: 400 });
		}

		// Rate limiting: limit to 10 messages per minute per user
		const userKey = `rate_limit_${from}`;
		let recentMessageCount = await env.USER_DATA.get(userKey);
		if (recentMessageCount && parseInt(recentMessageCount) >= 10) {
			return new Response('Rate limit exceeded. Try again later.', { status: 429 });
		}

		// Store rate limit information
		ctx.waitUntil(env.USER_DATA.put(userKey, (parseInt(recentMessageCount || '0') + 1).toString(), { expirationTtl: 60 }));

		// Retrieve user context from KV
		const userContextKey = `user_${from}`;
		let userContext = await env.USER_DATA.get(userContextKey);
		if (!userContext) {
			userContext = { history: [], emotionalState: null, tier: 1 };
		} else {
			userContext = JSON.parse(userContext);
		}

		// Analyze sentiment using OpenAI
		const analysis = await analyzeSentimentAndDepth(smsBody, env);
		userContext.emotionalState = analysis.sentiment;

		// Escalate tier based on emotional depth
		if (analysis.depth === 'high' && userContext.tier < 5) {
			userContext.tier++;
		}

		// Generate response from OpenAI
		const enkiduResponse = await generateEnkiduJournalResponse(userContext, smsBody, env);

		// Update user context and store in KV
		userContext.history.push(smsBody);
		await env.USER_DATA.put(userContextKey, JSON.stringify(userContext));

		// Send SMS with retry logic
		const smsResult = await sendSmsWithRetry(env, from, enkiduResponse);

		if (!smsResult) {
			return new Response('Failed to send SMS', { status: 500 });
		}

		// Log the conversation
		console.log(`--- Conversation with ${from} ---`);
		console.log(`User: ${smsBody}`);
		console.log(`Enkidu Journal: ${enkiduResponse}`);
		console.log(`Sentiment: ${userContext.emotionalState}`);
		console.log(`Emotional Depth: ${analysis.depth}`);
		console.log(`Friendship Tier: ${userContext.tier}`);
		console.log('--- End of Conversation ---');

		return new Response(null, { status: 204 }); // No content, no "OK" response.
	} catch (error) {
		console.error('Error processing SMS:', error);
		return new Response('Internal Server Error', { status: 500 });
	}
}

// Sentiment and emotional depth analysis function
async function analyzeSentimentAndDepth(message, env) {
	try {
		const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${env.OPENAI_API_KEY}`,
			},
			body: JSON.stringify({
				model: 'gpt-4',
				messages: [
					{
						role: 'system',
						content: 'Analyze the sentiment and emotional depth of this message.',
					},
					{ role: 'user', content: message },
				],
			}),
		});

		const data = await openaiResponse.json();
		const analysisContent = data.choices[0]?.message?.content?.split('\n') || ['neutral', 'low'];

		return {
			sentiment: analysisContent[0].trim() || 'neutral',
			depth: analysisContent[1].trim() || 'low',
		};
	} catch (error) {
		console.error('Error analyzing sentiment:', error);
		return { sentiment: 'neutral', depth: 'low' };
	}
}
