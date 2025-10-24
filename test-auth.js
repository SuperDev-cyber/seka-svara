// Simple test script for authentication endpoints
// Run with: node test-auth.js

const API_BASE_URL = 'http://localhost:8000/api/v1';

async function testAuth() {
  console.log('🧪 Testing Authentication Endpoints...\n');

  try {
    // Test 1: Register a new user
    console.log('1️⃣ Testing User Registration...');
    const registerData = {
      username: 'testuser_' + Date.now(),
      email: `test_${Date.now()}@example.com`,
      password: 'Test123!',
      confirmPassword: 'Test123!'
    };

    const registerResponse = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(registerData),
    });

    if (registerResponse.ok) {
      const registerResult = await registerResponse.json();
      console.log('✅ Registration successful');
      console.log('User ID:', registerResult.user.id);
      console.log('Access Token:', registerResult.access_token.substring(0, 20) + '...');
      
      // Test 2: Login with the registered user
      console.log('\n2️⃣ Testing User Login...');
      const loginData = {
        email: registerData.email,
        password: registerData.password
      };

      const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData),
      });

      if (loginResponse.ok) {
        const loginResult = await loginResponse.json();
        console.log('✅ Login successful');
        console.log('User:', loginResult.user.username);
        
        // Test 3: Test protected endpoint (logout)
        console.log('\n3️⃣ Testing Protected Endpoint (Logout)...');
        const logoutResponse = await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${loginResult.access_token}`,
          },
        });

        if (logoutResponse.ok) {
          const logoutResult = await logoutResponse.json();
          console.log('✅ Logout successful');
          console.log('Message:', logoutResult.message);
        } else {
          console.log('❌ Logout failed:', logoutResponse.status);
        }
      } else {
        console.log('❌ Login failed:', loginResponse.status);
        const error = await loginResponse.text();
        console.log('Error:', error);
      }
    } else {
      console.log('❌ Registration failed:', registerResponse.status);
      const error = await registerResponse.text();
      console.log('Error:', error);
    }

    // Test 4: Test invalid login
    console.log('\n4️⃣ Testing Invalid Login...');
    const invalidLoginData = {
      email: 'nonexistent@example.com',
      password: 'WrongPassword123!'
    };

    const invalidLoginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidLoginData),
    });

    if (invalidLoginResponse.status === 401) {
      console.log('✅ Invalid login correctly rejected');
    } else {
      console.log('❌ Invalid login should have been rejected');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }

  console.log('\n🎉 Authentication tests completed!');
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.log('❌ This script requires Node.js 18+ or you need to install node-fetch');
  console.log('Run: npm install node-fetch');
  process.exit(1);
}

testAuth();

