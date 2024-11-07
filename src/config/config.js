// SMS Configuration
export const SMS_CONFIG = {
	MAX_LENGTH: 160,
	MAX_RETRIES: 3,
	RETRY_DELAY: 1000, // Base delay in ms
};

// Memory/History Configuration
export const MEMORY_CONFIG = {
	RECENT_HISTORY_LIMIT: 10,
	MAX_HISTORY_LENGTH: 100,
	ARCHIVE_THRESHOLD: 50,
};

// OpenAI Configuration
export const AI_CONFIG = {
	API_URL: 'https://api.openai.com/v1/chat/completions',
	MODEL: 'gpt-4-turbo',
	MAX_TOKENS: 1000,
	TEMPERATURE: 0.7,
};

// User Metrics Configuration
export const USER_CONFIG = {
	TIER: {
		LOW: 'low',
		MEDIUM: 'medium',
		HIGH: 'high',
	},
	IMPORTANT_MESSAGE_THRESHOLD: 5,
	MEDIUM_MESSAGE_THRESHOLD: 3,
	MAX_DEPTH: 5,
	MIN_DEPTH: 1,
};

// Rate Limiting Configuration
export const RATE_LIMIT = {
	MAX_REQUESTS: 10,
	WINDOW_MS: 60000, // 1 minute
};

// Export combined config
export const CONFIG = {
	SMS: SMS_CONFIG,
	MEMORY: MEMORY_CONFIG,
	AI: AI_CONFIG,
	USER: USER_CONFIG,
	RATE_LIMIT,
};
