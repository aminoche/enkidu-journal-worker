#!/bin/bash

# Namespace ID
NAMESPACE_ID="c4cf8e9740014f85bc4eb18492b346e9"

# Output file
OUTPUT_FILE="kv_data.json"

# Start JSON object
echo "{" > $OUTPUT_FILE

# Read keys from kv_keys.json and fetch values
KEYS=$(jq -r '.[].name' kv_keys.json)

for KEY in $KEYS; do
  VALUE=$(wrangler kv:key get --namespace-id $NAMESPACE_ID "$KEY")
  echo "\"$KEY\": $VALUE," >> $OUTPUT_FILE
  echo "Fetched key: $KEY"
done

# Close JSON object
sed -i '$ s/,$//' $OUTPUT_FILE  # Remove trailing comma
echo "}" >> $OUTPUT_FILE

echo "All KV pairs saved to $OUTPUT_FILE"
