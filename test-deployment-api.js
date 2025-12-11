// Test script for deployment API endpoints
const https = require('https');
const http = require('http');

// Allow self-signed certificates for testing
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const BASE_URL = 'https://localhost:3002';

async function makeRequest(method, path, data = null, cookies = '') {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookies
            },
            rejectUnauthorized: false
        };

        const protocol = url.protocol === 'https:' ? https : http;
        const req = protocol.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const responseData = JSON.parse(body);
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: responseData
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: body
                    });
                }
            });
        });

        req.on('error', reject);
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

async function testDeploymentAPI() {
    console.log('🧪 Testing Deployment API Endpoints\n');
    console.log('=' .repeat(60));

    // Test 1: Check if server is running
    console.log('\n1️⃣ Testing server connectivity...');
    try {
        const response = await makeRequest('GET', '/api/admin-auth/status');
        console.log(`   ✅ Server is running`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Response:`, response.data);
    } catch (error) {
        console.log(`   ❌ Server connection failed: ${error.message}`);
        return;
    }

    // Test 2: Get deployment config (requires auth)
    console.log('\n2️⃣ Testing GET /api/deployment/config...');
    try {
        const response = await makeRequest('GET', '/api/deployment/config');
        if (response.status === 401) {
            console.log(`   ⚠️ Authentication required (expected)`);
        } else if (response.status === 200) {
            console.log(`   ✅ Config retrieved successfully`);
            console.log(`   Config:`, JSON.stringify(response.data.config, null, 2));
        } else {
            console.log(`   ⚠️ Unexpected status: ${response.status}`);
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }

    // Test 3: Get deployment status (requires auth)
    console.log('\n3️⃣ Testing GET /api/deployment/status...');
    try {
        const response = await makeRequest('GET', '/api/deployment/status');
        if (response.status === 401) {
            console.log(`   ⚠️ Authentication required (expected)`);
        } else if (response.status === 200) {
            console.log(`   ✅ Status retrieved successfully`);
            console.log(`   Status:`, JSON.stringify(response.data, null, 2));
        } else {
            console.log(`   ⚠️ Unexpected status: ${response.status}`);
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }

    // Test 4: Test public config endpoint (no auth required)
    console.log('\n4️⃣ Testing GET /api/deployment/public-config...');
    try {
        const response = await makeRequest('GET', '/api/deployment/public-config');
        console.log(`   Status: ${response.status}`);
        console.log(`   Response:`, response.data);
        if (response.status === 200) {
            console.log(`   ✅ Public config retrieved successfully`);
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ API endpoint tests completed!\n');
    console.log('ℹ️ Note: Some endpoints require authentication and will return 401.');
    console.log('ℹ️ This is expected behavior for secured endpoints.\n');
}

// Run the tests
testDeploymentAPI().catch(console.error);

