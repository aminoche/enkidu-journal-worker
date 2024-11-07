import { SMS_CONFIG } from '../config/config.js';

// Maximum length for RCS message
const MAX_RCS_LENGTH = 8000;

// Send SMS safely with length checks and retries
export async function sendSmsSafely({ to, body }, env) {
	console.log(`Preparing to send SMS to ${to}`);

	// Reject message if it exceeds the maximum RCS length
	if (body.length > MAX_RCS_LENGTH) {
		throw new Error(`Message exceeds ${MAX_RCS_LENGTH} characters. Message not sent.`);
	}

	// Send the message
	await sendSmsWithRetry({ to, body }, env);
}

// Send SMS with retry logic
export async function sendSmsWithRetry(smsDetails, env) {
	for (let attempt = 0; attempt < SMS_CONFIG.MAX_RETRIES; attempt++) {
		try {
			console.log(`Attempting to send SMS (Attempt ${attempt + 1})`);

			const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
				method: 'POST',
				headers: {
					Authorization: `Basic ${btoa(env.TWILIO_ACCOUNT_SID + ':' + env.TWILIO_AUTH_TOKEN)}`,
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams({
					To: smsDetails.to,
					From: env.TWILIO_PHONE_NUMBER,
					Body: smsDetails.body,
				}),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
			}

			console.log('SMS sent successfully.');
			return;
		} catch (error) {
			console.error(`Attempt ${attempt + 1} failed to send SMS:`, error);
			if (attempt === SMS_CONFIG.MAX_RETRIES - 1) {
				throw error;
			}
			await new Promise((resolve) => setTimeout(resolve, SMS_CONFIG.RETRY_DELAY * (attempt + 1)));
		}
	}
}
