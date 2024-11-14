import { MemoryService } from '../utils/memory.js';
import { determineDimension, generateMainCharacterResponse, getNextUncoveredDimension, getNextQuestion } from '../services/openai.js';
import { CONFIG } from '../config/config.js';

export async function handleVoicePost(request, env) {
	try {
		console.log('Handling Voice POST request');

		const memoryService = new MemoryService(env.USER_DATA);

		// Parse Twilio Voice request
		const formData = await request.formData();
		const from = formData.get('From');
		const body = formData.get('SpeechResult');
		console.log(`Received call from ${from} with speech result: ${body}`);

		// Get user context
		let userContext = await memoryService.getUserContext(from);
		console.log(`User context: ${JSON.stringify(userContext)}`);

		// Ensure dimensions is initialized
		if (!userContext.dimensions) {
			userContext.dimensions = {};
		}
		console.log(`Dimensions: ${JSON.stringify(userContext.dimensions)}`);

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
		const responseText = await generateMainCharacterResponse(userContext, body, dimension, env.OPENAI_API_KEY);
		console.log(`Generated AI response: ${responseText}`);

		// Update user context in KV storage
		await memoryService.updateUserContext(userContext);
		console.log('User context updated');

		// Create Twilio Voice response
		const twiml = `
      <Response>
        <Say>${responseText}</Say>
        <Gather input="speech" action="/voice" speechTimeout="auto">
          <Say>${nextQuestion}</Say>
        </Gather>
      </Response>
    `;

		return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
	} catch (error) {
		console.error('Error handling Voice:', error);
		return new Response(error.message, { status: 500 });
	}
}
