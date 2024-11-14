import { handleSmsPost } from './handlers/smsHandler.js';
import { handleVoicePost } from './handlers/voiceHandler.js';

export default {
	async fetch(request, env, ctx) {
		try {
			const url = new URL(request.url);

			if (request.method === 'POST' && url.pathname === '/sms') {
				return await handleSmsPost(request, env);
			}

			if (request.method === 'POST' && url.pathname === '/voice') {
				return await handleVoicePost(request, env);
			}

			if (request.method === 'GET' && url.pathname === '/health') {
				return new Response('OK', { status: 200 });
			}

			return new Response('Not Found', { status: 404 });
		} catch (error) {
			console.error('Application error:', error);
			return new Response(error.message, { status: 500 });
		}
	},
};
