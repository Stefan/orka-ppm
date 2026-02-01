// Quick test of the help chat API route
const fetch = require('node-fetch');

async function testAPI() {
  try {
    console.log('Testing help chat API...');

    const response = await fetch('http://localhost:3001/api/ai/help/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'Hello, how does this work?',
        sessionId: 'test-session',
        context: {
          route: '/',
          pageTitle: 'Dashboard',
          userRole: 'user'
        },
        language: 'en'
      })
    });

    if (!response.ok) {
      console.log('Response not OK:', response.status, response.statusText);
      return;
    }

    const data = await response.json();
    console.log('Success! Mock response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
  }
}

testAPI();