import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("No API key found in .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
  console.log("Listing available models...");
  // Use listModels method from genAI
  // Note: the listModels method in some SDK versions is on a client, but let's see if we can do a simple request or search
  // Let's call the listModels endpoint via fetch to be 100% independent of SDK quirks
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.models) {
    console.log("Available models:");
    json.models.forEach(m => {
      console.log(`- Name: ${m.name} (${m.displayName}) -> supports: ${m.supportedGenerationMethods.join(', ')}`);
    });
  } else {
    console.log("Response:", JSON.stringify(json, null, 2));
  }
}

listModels().catch(console.error);
