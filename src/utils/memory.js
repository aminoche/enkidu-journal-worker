export class MemoryService {
	constructor(userDataStore) {
		this.userDataStore = userDataStore;
	}

	async getUserContext(userId) {
		try {
			const context = await this.userDataStore.get(userId);
			if (context) {
				const parsedContext = JSON.parse(context);
				// Ensure coveredDimensions and coveredQuestions are initialized
				if (!parsedContext.coveredDimensions) {
					parsedContext.coveredDimensions = [];
				}
				if (!parsedContext.coveredQuestions) {
					parsedContext.coveredQuestions = {};
				}
				return parsedContext;
			}
			return {
				userId,
				history: [],
				historyArchive: [],
				dimensionsIntroduced: {},
				depth: 1,
				tier: 'low',
				streak: 0,
				requestHistory: [],
				matches: [],
				coveredDimensions: [], // Initialize coveredDimensions
				coveredQuestions: {}, // Initialize coveredQuestions
			};
		} catch (error) {
			console.error('Error getting user context:', error);
			throw error;
		}
	}

	async updateUserContext(userContext) {
		try {
			await this.userDataStore.put(userContext.userId, JSON.stringify(userContext));
		} catch (error) {
			console.error('Error updating user context:', error);
			throw error;
		}
	}

	// Fetch all users from KV store
	async getAllUsers() {
		try {
			const keys = await this.userDataStore.list();
			const users = await Promise.all(
				keys.keys.map(async (key) => {
					const user = await this.userDataStore.get(key.name);
					return JSON.parse(user);
				})
			);
			return users;
		} catch (error) {
			console.error('Error fetching all users:', error);
			throw error;
		}
	}
}
