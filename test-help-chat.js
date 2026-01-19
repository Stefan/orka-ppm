// Test script to debug help chat 422 error
const BACKEND_URL = 'http://localhost:8000'

async function testHelpChatQuery() {
  const testRequest = {
    query: "How do I create a new project?",
    session_id: "test-session-123",
    context: {
      route: "/dashboards",
      pageTitle: "Portfolio",
      userRole: "user",
      currentProject: "",
      currentPortfolio: "",
      relevantData: {}
    },
    language: "en",
    include_proactive_tips: false
  }

  console.log('Sending request to:', `${BACKEND_URL}/ai/help/query`)
  console.log('Request body:', JSON.stringify(testRequest, null, 2))

  try {
    const response = await fetch(`${BACKEND_URL}/ai/help/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // You'll need to add a valid auth token here
        // 'Authorization': 'Bearer YOUR_TOKEN_HERE'
      },
      body: JSON.stringify(testRequest)
    })

    console.log('Response status:', response.status)
    console.log('Response headers:', Object.fromEntries(response.headers.entries()))

    const responseText = await response.text()
    console.log('Response body:', responseText)

    if (!response.ok) {
      console.error('Error response:', responseText)
      try {
        const errorJson = JSON.parse(responseText)
        console.error('Parsed error:', JSON.stringify(errorJson, null, 2))
      } catch (e) {
        console.error('Could not parse error as JSON')
      }
    } else {
      try {
        const data = JSON.parse(responseText)
        console.log('Success! Response:', JSON.stringify(data, null, 2))
      } catch (e) {
        console.error('Could not parse response as JSON')
      }
    }
  } catch (error) {
    console.error('Network error:', error.message)
  }
}

testHelpChatQuery()
