require('dotenv').config();
const { generateAIResponse } = require('../services/aiService');

async function testGemini() {
  try {
    const response = await generateAIResponse('Reply with exactly: HabitUp Gemini test successful');
    console.log(response);
  } catch (err) {
    console.error('Gemini test failed:', err.message || err);
    process.exit(1);
  }
}

testGemini();
