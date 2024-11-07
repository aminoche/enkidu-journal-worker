import { USER_CONFIG } from '../config/config.js';

// Adjust user tier based on message importance
function adjustTier(userContext) {
	const recentMessages = userContext.history.slice(-5);
	const importantCount = recentMessages.filter((msg) => msg.important).length;

	if (importantCount >= USER_CONFIG.IMPORTANT_MESSAGE_THRESHOLD) {
		userContext.tier = USER_CONFIG.TIER.HIGH;
	} else if (importantCount >= USER_CONFIG.MEDIUM_MESSAGE_THRESHOLD) {
		userContext.tier = USER_CONFIG.TIER.MEDIUM;
	} else {
		userContext.tier = USER_CONFIG.TIER.LOW;
	}
}

// Adjust interaction depth based on message content
function adjustDepth(userContext, message) {
	// Analyze message complexity and adjust depth accordingly
	const messageLength = message.length;
	const hasQuestions = message.includes('?');
	const hasEmotionalContent = /feel|think|believe|worry|hope/i.test(message);

	if (hasQuestions && hasEmotionalContent) {
		increaseDepth(userContext);
	} else if (messageLength < 20) {
		decreaseDepth(userContext);
	}
}

// Increase depth level
function increaseDepth(userContext) {
	userContext.depth = Math.min(userContext.depth + 1, USER_CONFIG.MAX_DEPTH);
}

// Decrease depth level
function decreaseDepth(userContext) {
	userContext.depth = Math.max(userContext.depth - 1, USER_CONFIG.MIN_DEPTH);
}

// Adjust user engagement streak
function adjustStreak(userContext) {
	const recentMessages = userContext.history.slice(-2);
	const isEngaged = recentMessages.every((msg) => msg.sender === 'user');

	if (isEngaged) {
		userContext.streak += 1;
	} else {
		userContext.streak = 0;
	}
}

export { adjustTier, adjustDepth, adjustStreak, increaseDepth, decreaseDepth };
