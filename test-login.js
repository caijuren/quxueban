const axios = require('axios');

async function testLogin() {
  try {
    const response = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'andycoy',
      password: '123456'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('Login successful:', response.data);
  } catch (error) {
    console.error('Login failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testLogin();