# Enkidu Journal Worker

## Purpose

The Enkidu Journal Worker is a Cloudflare Worker application designed to understand and engage with users deeply across various dimensions of their identity and experiences. By leveraging the OpenAI API, the application analyzes incoming SMS messages, determines the relevant dimension of the message, and generates thoughtful AI responses. The ultimate goal is for the system to know users so well and in depth across all dimensions that it can match them with an ideal best friend.

## Key Dimensions

The application focuses on the following dimensions of user identity and experiences:
1. **Identity and Values**
2. **Key Experiences**
3. **Creative Drive**
4. **Family Connections**
5. **Mental Health**
6. **Motivation Growth**
7. **Setbacks Wins**
8. **Faith Philosophy**

## Workflow

1. **Receive SMS Messages**: The application receives SMS messages from users via a webhook from Twilio.
2. **Parse SMS Messages**: The application parses the incoming SMS messages to extract the sender's phone number and the message body.
3. **Fetch User Context**: The application retrieves the user's context from a Cloudflare KV store. This context includes information about the user's interaction history and dimensions introduced.
4. **Rate Limiting**: The application checks if the user has exceeded the rate limit for sending messages to prevent abuse.
5. **Determine Message Dimension**: The application uses the OpenAI API to analyze the message and determine its relevant dimension.
6. **Generate AI Response**: The application generates an AI response based on the user's message and context, tailored to the identified dimension.
7. **Update User Context**: The application updates the user's context in the Cloudflare KV store with the new interaction and dimension information.
8. **Send AI Response**: The application sends the AI-generated response back to the user via SMS using Twilio.
9. **Acknowledge Webhook**: The application sends an HTTP response back to Twilio to acknowledge that the webhook was processed successfully.
10. **Matching with Best Friend**: Over time, as the system gathers more information about the user across various dimensions, it aims to match the user with an ideal best friend based on their in-depth profile.

## Setup

### Prerequisites

- Cloudflare Workers account
- Twilio account
- OpenAI API key

### Configuration

1. **Cloudflare KV Namespace**: Set up a KV namespace in your Cloudflare Workers account and add it to your `wrangler.toml` file.

```toml
name = "enkidu-journal-worker"
main = "src/index.js"
compatibility_date = "2024-10-19"

[[kv_namespaces]]
binding = "USER_DATA"
id = "your-kv-namespace-id"
```

2. **Environment Variables**: Set up the necessary environment variables in your Cloudflare Workers environment.

```sh
wrangler secret put OPENAI_API_KEY
wrangler secret put TWILIO_ACCOUNT_SID
wrangler secret put TWILIO_AUTH_TOKEN
wrangler secret put TWILIO_PHONE_NUMBER
```

### Deployment

1. **Deploy the Worker**: Use Wrangler to deploy the Cloudflare Worker.

```sh
wrangler deploy
```
