require('dotenv').config();
const http = require('http');
const crypto = require('crypto');

const PORT = 3099;
process.env.PORT = PORT;

const app = require('./api/index.js');

function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, (res) => {
      let chunks = '';
      res.on('data', chunk => chunks += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(chunks);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: chunks });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('======================================================');
  console.log('   RAZORPAY STANDARD WEB CHECKOUT VERIFICATION SUITE  ');
  console.log('======================================================');
  let passed = 0;
  let total = 0;

  function assert(name, condition, extra = '') {
    total++;
    if (condition) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name} ${extra}`);
    }
  }

  try {
    // 1. Check Key Endpoint
    console.log('\n[Test 1] Public Key Endpoint (/api/razorpay-key)');
    const keyRes = await makeRequest('/api/razorpay-key');
    assert('Key endpoint returns status 200', keyRes.status === 200);
    assert('Key endpoint returns correct Key ID (rzp_live_TdOWoVLFjxHfTO)', keyRes.data?.key_id === 'rzp_live_TdOWoVLFjxHfTO');
    assert('Key endpoint does NOT expose secret', !keyRes.data?.keySecret && !keyRes.data?.secret);

    // 2. Order Creation - Success
    console.log('\n[Test 2] Order Creation - Valid Amount (/api/create-order)');
    const orderRes = await makeRequest('/api/create-order', 'POST', {
      amount: 500, // 500 paise (₹5)
      currency: 'INR',
      receipt: 'rcpt_' + Date.now().toString().slice(-6)
    });
    assert('Create order returns status 200', orderRes.status === 200);
    assert('Create order returns valid Razorpay order_id', !!orderRes.data?.order_id && orderRes.data.order_id.startsWith('order_'));
    assert('Create order returns amount (500 paise)', orderRes.data?.amount === 500);
    assert('Create order returns currency INR', orderRes.data?.currency === 'INR');
    const createdOrderId = orderRes.data?.order_id;
    console.log('   -> Razorpay Order ID created:', createdOrderId);

    // 3. Order Creation - Amount < 100 paise rejected
    console.log('\n[Test 3] Order Creation - Under minimum amount (< 100 paise)');
    const underMinRes = await makeRequest('/api/create-order', 'POST', {
      amount: 50,
      currency: 'INR'
    });
    assert('Amount < 100 paise rejected with status 400', underMinRes.status === 400);
    assert('Under minimum returns descriptive error', !!underMinRes.data?.error);

    // 4. Order Creation - Missing amount rejected
    console.log('\n[Test 4] Order Creation - Missing amount');
    const missingAmtRes = await makeRequest('/api/create-order', 'POST', {
      currency: 'INR'
    });
    assert('Missing amount rejected with status 400', missingAmtRes.status === 400);

    // 5. Signature Verification - Missing fields rejected
    console.log('\n[Test 5] Signature Verification - Missing fields (/api/verify-payment)');
    const missingFieldsRes = await makeRequest('/api/verify-payment', 'POST', {
      razorpay_order_id: createdOrderId
    });
    assert('Missing verification fields rejected with status 400', missingFieldsRes.status === 400);

    // 6. Signature Verification - Invalid signature rejected
    console.log('\n[Test 6] Signature Verification - Invalid signature');
    const invalidSigRes = await makeRequest('/api/verify-payment', 'POST', {
      razorpay_order_id: createdOrderId,
      razorpay_payment_id: 'pay_test_tampered123',
      razorpay_signature: 'invalid_tampered_signature_hex_123456789'
    });
    assert('Invalid signature rejected with status 400', invalidSigRes.status === 400);
    assert('Invalid signature returns success: false', invalidSigRes.data?.success === false);

    // 7. Signature Verification - Valid signature verified
    console.log('\n[Test 7] Signature Verification - Valid HMAC-SHA256 signature');
    const secret = (process.env.RAZORPAY_KEY_SECRET || '7ZOl0oWaGNDoMQwt2v2AnMAv').replace(/[\r\n\s]+/g, '').trim();
    const testPaymentId = 'pay_TciTest' + Date.now().toString().slice(-6);
    const validPayload = createdOrderId + '|' + testPaymentId;
    const validSig = crypto.createHmac('sha256', secret).update(validPayload).digest('hex');

    const validVerifyRes = await makeRequest('/api/verify-payment', 'POST', {
      razorpay_order_id: createdOrderId,
      razorpay_payment_id: testPaymentId,
      razorpay_signature: validSig
    });
    assert('Valid signature returns status 200', validVerifyRes.status === 200);
    assert('Valid signature returns success: true', validVerifyRes.data?.success === true);
    assert('Valid signature echoes razorpay_payment_id', validVerifyRes.data?.razorpay_payment_id === testPaymentId);

    // 8. Static Checkout Page
    console.log('\n[Test 8] Standalone Checkout UI (/checkout.html)');
    const checkoutPageRes = await makeRequest('/checkout.html');
    assert('Checkout page served with status 200', checkoutPageRes.status === 200);
    assert('Checkout page includes Razorpay Checkout SDK', checkoutPageRes.raw?.includes('checkout.razorpay.com/v1/checkout.js'));

    console.log(`\n======================================================`);
    console.log(` SUMMARY: ${passed}/${total} Tests Passed Successfully`);
    console.log(`======================================================`);
    process.exit(passed === total ? 0 : 1);
  } catch (err) {
    console.error('Test runner encountered error:', err);
    process.exit(1);
  }
}

// Give server time to bind before running tests
setTimeout(runTests, 800);
