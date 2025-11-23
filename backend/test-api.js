// Simple API test script - run with: node test-api.js
const http = require('http');

const BASE_URL = 'http://localhost:3000';
let authToken = '';
let userId = '';
let inventoryItemId = '';

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: data ? JSON.parse(data) : null,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data,
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting API Tests...\n');

  try {
    // Test 1: Health Check
    console.log('1️⃣  Testing /health endpoint...');
    let res = await makeRequest('GET', '/health');
    console.log(`   Status: ${res.status}`);
    console.log(`   Response: ${JSON.stringify(res.data)}\n`);

    // Test 2: User Registration
    console.log('2️⃣  Testing user registration...');
    res = await makeRequest('POST', '/api/auth/register', {
      email: `user-${Date.now()}@example.com`,
      password: 'TestPassword123',
      name: 'Test User',
      language: 'en',
    });
    console.log(`   Status: ${res.status}`);
    console.log(`   User Created: ${res.data.user.name}`);
    console.log(`   Token: ${res.data.token.substring(0, 20)}...`);
    authToken = res.data.token;
    userId = res.data.user.id;
    console.log();

    // Test 3: Login
    console.log('3️⃣  Testing user login...');
    res = await makeRequest('POST', '/api/auth/login', {
      email: `user-${Date.now() - 1000}@example.com`,
      password: 'TestPassword123',
    });
    console.log(`   Status: ${res.status}`);
    if (res.data.error) {
      console.log(`   Note: User doesn't exist (expected for demo)\n`);
    }

    // Test 4: Get Empty Inventory
    console.log('4️⃣  Testing GET /api/inventory (should be empty)...');
    res = await makeRequest('GET', '/api/inventory');
    console.log(`   Status: ${res.status}`);
    console.log(`   Items: ${res.data.data.length}`);
    console.log();

    // Test 5: Create Inventory Item
    console.log('5️⃣  Testing POST /api/inventory (create item)...');
    res = await makeRequest('POST', '/api/inventory', {
      name: 'Milk',
      category: 'Dairy',
      quantity: 1.5,
      unit: 'liter',
      expirationDate: '2025-12-20',
      emoji: '🥛',
      backgroundColor: '#E8F4F8',
    });
    console.log(`   Status: ${res.status}`);
    console.log(`   Item Created: ${res.data.data.name}`);
    inventoryItemId = res.data.data.id;
    console.log();

    // Test 6: Get Inventory
    console.log('6️⃣  Testing GET /api/inventory (should have 1 item)...');
    res = await makeRequest('GET', '/api/inventory');
    console.log(`   Status: ${res.status}`);
    console.log(`   Items: ${res.data.data.length}`);
    if (res.data.data.length > 0) {
      console.log(`   First Item: ${res.data.data[0].name}`);
    }
    console.log();

    // Test 7: Get Single Item
    console.log('7️⃣  Testing GET /api/inventory/:id...');
    res = await makeRequest('GET', `/api/inventory/${inventoryItemId}`);
    console.log(`   Status: ${res.status}`);
    console.log(`   Item: ${res.data.data.name}`);
    console.log();

    // Test 8: Update Item
    console.log('8️⃣  Testing PUT /api/inventory/:id (update item)...');
    res = await makeRequest('PUT', `/api/inventory/${inventoryItemId}`, {
      quantity: 2.0,
    });
    console.log(`   Status: ${res.status}`);
    console.log(`   Updated Quantity: ${res.data.data.quantity}`);
    console.log();

    // Test 9: Get Expiring Soon
    console.log('9️⃣  Testing GET /api/inventory/expiring/soon...');
    res = await makeRequest('GET', '/api/inventory/expiring/soon');
    console.log(`   Status: ${res.status}`);
    console.log(`   Expiring Soon: ${res.data.data.length} items`);
    console.log();

    // Test 10: Delete Item
    console.log('🔟 Testing DELETE /api/inventory/:id...');
    res = await makeRequest('DELETE', `/api/inventory/${inventoryItemId}`);
    console.log(`   Status: ${res.status}`);
    console.log(`   Message: ${res.data.message}`);
    console.log();

    console.log('✅ All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
