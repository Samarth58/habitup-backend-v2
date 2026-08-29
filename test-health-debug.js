/**
 * Debug script to test /health endpoint
 */
const BASE_URL = 'http://localhost:5000';

async function testHealth() {
  console.log('Testing /health endpoint...\n');
  
  try {
    const response = await fetch(`${BASE_URL}/health`);
    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers));
    
    const data = await response.json();
    console.log('Body:', JSON.stringify(data, null, 2));
    
    if (response.status === 200 && data.status === 'ok') {
      console.log('\n✓ SUCCESS: /health endpoint works correctly!');
    } else {
      console.log('\n✗ FAIL: /health returned unexpected response');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testHealth();
