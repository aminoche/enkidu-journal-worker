export default {
	async fetch(request, env, ctx) {
		// Handle incoming requests directly without Durable Objects
		const url = new URL(request.url);
		const from = url.searchParams.get('From') || 'Unknown sender';
		const body = url.searchParams.get('Body') || 'No message body';

		console.log(`Received SMS from ${from}: ${body}`);

		// Return a basic response
		return new Response('SMS received and logged in Enkidu Journal', { status: 200 });
	},
};
