# Azure OpenAI Setup Guide

This guide will help you configure Azure OpenAI for the recipe suggestion feature.

## Prerequisites

1. An Azure account
2. An Azure OpenAI resource deployed
3. A deployed GPT model (e.g., GPT-4, GPT-3.5-turbo)

## Step 1: Get Your Azure OpenAI Credentials

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to your Azure OpenAI resource
3. Go to "Keys and Endpoint" section
4. Copy the following information:
   - **Endpoint**: Your Azure OpenAI endpoint URL (e.g., `https://your-resource-name.openai.azure.com/`)
   - **API Key**: One of the keys (KEY 1 or KEY 2)

5. Go to "Model deployments" section
6. Note your **Deployment Name** (the name you gave when deploying the model)

## Step 2: Configure Environment Variables

1. Open the `.env` file in the project root directory
2. Fill in your credentials:

```env
# Your Azure OpenAI endpoint
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com/

# Your Azure OpenAI API key
AZURE_OPENAI_API_KEY=your_api_key_here

# Your deployment name
AZURE_OPENAI_DEPLOYMENT_NAME=your_deployment_name_here

# API version (usually 2024-02-15-preview)
AZURE_OPENAI_API_VERSION=2024-02-15-preview
```

## Step 3: Restart the App

After configuring the `.env` file, restart your Expo app:

```bash
# Stop the current session (Ctrl+C)
# Then restart
npm start
```

## How to Use

1. Go to the **Recipes** tab in the app
2. Add some food items to your inventory first
3. Type what you're craving (e.g., "ข้าวผัด" or "fried rice")
4. The AI will suggest a recipe based on your available ingredients
5. After getting the recipe, you can tap **"Remove Used Ingredients"** to remove them from your inventory

## Features

- **Bilingual Support**: Works in both Thai and English
- **Smart Ingredient Detection**: Automatically detects which ingredients from your inventory are used
- **Recipe Generation**: Get detailed cooking instructions based on what you're craving
- **Inventory Integration**: Remove used ingredients after cooking

## Troubleshooting

### "Not Configured" Error
- Make sure all fields in `.env` are filled in
- Check that there are no extra spaces in your credentials
- Restart the app after editing `.env`

### API Errors
- Verify your API key is correct
- Check that your deployment name matches exactly
- Ensure your Azure OpenAI resource has quota available
- Try a different API version if needed (e.g., `2023-12-01-preview`)

### No Response
- Check your internet connection
- Verify the endpoint URL is correct (should start with `https://`)
- Make sure you have items in your inventory

## Security Note

**Important**: The `.env` file is git-ignored and should never be committed to version control. Keep your API keys secure and never share them publicly.

## Cost

Azure OpenAI is a paid service. Each API call will incur costs based on your Azure pricing plan. Monitor your usage in the Azure Portal.
