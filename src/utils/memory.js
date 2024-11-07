import { MEMORY_CONFIG } from '../config/config.js';
import { generateThematicSummaries } from '../services/openai.js';

export class MemoryService {
	constructor(userDataStore) {
		this.userDataStore = userDataStore;
	}

	async getUserContext(userId) {
		try {
			console.log('Fetching user context from KV storage');
			const context = await this.userDataStore.get(userId);
			if (context) {
				console.log('User context found');
				return JSON.parse(context);
			}
			console.log('User context not found, creating new context');
			return {
				userId,
				history: [],
				historyArchive: [],
				dimensionsIntroduced: {},
				depth: 1,
				tier: 'low',
				streak: 0,
				requestHistory: [],
			};
		} catch (error) {
			console.error('Error getting user context:', error);
			throw error;
		}
	}

	async updateUserContext(userContext) {
		try {
			console.log('Updating user context in KV storage');
			await this.userDataStore.put(userContext.userId, JSON.stringify(userContext));
		} catch (error) {
			console.error('Error updating user context:', error);
			throw error;
		}
	}
}
