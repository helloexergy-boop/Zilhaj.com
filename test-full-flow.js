require('dotenv').config();
const http = require('http');

const PORT = 3099;
process.env.PORT = PORT;

const app = require('./api/index.js');

function request(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, (res) => {
      let chunks = '';
      res.on('data', chunk => chunks += chunk);
      res.on('end', () => {
        let parsed = chunks;
        try { parsed = JSON.parse(chunks); } catch(e) {}
        resolve({ status: res.statusCode, headers: res.headers, data: parsed, raw: chunks });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runFullVerification() {
  console.log('========================================================');
  console.log('     ZILHAJ COMPLETE WORKFLOW & ENDPOINT TEST SUITE     ');
  console.log('========================================================\n');

  let passed = 0;
  let total = 0;

  function assert(title, condition, extra = '') {
    total++;
    if (condition) {
      console.log(`  [PASS] ${title}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${title} - ${extra}`);
    }
  }

  try {
    // 1. Health & DB Health
    const healthRes = await request('/api/health');
    assert('GET /api/health returns 200 OK', healthRes.status === 200 && healthRes.data.status === 'UP');

    const dbHealthRes = await request('/api/health/db');
    assert('GET /api/health/db returns DB latency & status', dbHealthRes.status === 200 && dbHealthRes.data.status);

    // 2. Auth: Register & Login
    const testEmail = `test.pilgrim.${Date.now()}@zilhaj.com`;
    const regRes = await request('/api/auth/register', 'POST', {
      name: 'Automated Test Pilgrim',
      email: testEmail,
      password: 'password123',
      phone: '9876543210'
    });
    assert('POST /api/auth/register registers user (201)', regRes.status === 201 && regRes.data.token);
    const userToken = regRes.data ? regRes.data.token : null;

    const loginRes = await request('/api/auth/login', 'POST', {
      email: testEmail,
      password: 'password123'
    });
    assert('POST /api/auth/login logs in user & returns session token (200)', loginRes.status === 200 && loginRes.data.token);

    // 3. Unauthenticated Journey Submission Gating
    const unauthReq = await request('/api/requests/journey', 'POST', {
      service: 'Umrah Package',
      travelers: '2'
    });
    assert('POST /api/requests/journey blocks unauthenticated requests (401)', unauthReq.status === 401);

    // 4. Authenticated Journey Submission
    const authReq = await request('/api/requests/journey', 'POST', {
      service: '18-Day Deluxe Umrah Package',
      serviceType: 'Umrah',
      travelers: '3',
      departureCity: 'Delhi (DEL)',
      travelDate: '22 Mar 2026',
      duration: '18 Days',
      hotelType: '5 Star'
    }, userToken);
    assert('POST /api/requests/journey submits authenticated request (201)', authReq.status === 201 && authReq.data.request.id);
    const requestId = authReq.data ? authReq.data.request.id : 'REQ-0517';

    const crypto = require('crypto');
    const { generateAuthToken } = require('./api/middleware/auth');
    const staffToken = generateAuthToken({ id: 'staff-ops-1', email: 'ops@zilhaj.com', name: 'Ops Officer', role: 'SUBADMIN' });

    // 5. Operations Specialist Offer Dispatching (Real Staff Role Authentication)
    const opsRes = await request('/api/ops/offers', 'POST', {
      requestId: requestId,
      selectedItems: [
        {
          id: 'pkg-1',
          title: '18-Day Deluxe Umrah Package',
          price: 1,
          duration: '18 Days',
          makkahHotelName: 'Al Safwa Royal Orchid',
          madinahHotelName: 'Dar Al-Taqwa Hotel'
        }
      ]
    }, staffToken);
    assert('POST /api/ops/offers dispatches offers to customer (200)', opsRes.status === 200 && opsRes.data.data.status === 'OFFERS_PROVIDED');

    // 6. Payment Verification & Booking Confirmation (Valid HMAC-SHA256 Signature)
    const testOrderId = `order_test_${Date.now()}`;
    const testPaymentId = `pay_test_${Date.now()}`;
    const razorpaySecret = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret_2026';
    const validSignature = crypto.createHmac('sha256', razorpaySecret).update(`${testOrderId}|${testPaymentId}`).digest('hex');

    const payRes = await request('/api/payments/verify', 'POST', {
      requestId: requestId,
      offerId: `OFF-${requestId}-1`,
      paymentId: testPaymentId,
      orderId: testOrderId,
      signature: validSignature,
      price: 1
    }, userToken);
    assert('POST /api/payments/verify verifies payment & confirms booking (200)', payRes.status === 200 && payRes.data.booking.bookingId);
    const bookingId = payRes.data ? payRes.data.booking.bookingId : null;

    // 7. PDF Invoice Download (Authenticated Booking Ownership Protected)
    const unauthPdf = await request(`/api/bookings/${bookingId}/pdf`);
    assert('GET /api/bookings/:id/pdf rejects unauthenticated lookup (401)', unauthPdf.status === 401);

    const pdfRes = await request(`/api/bookings/${bookingId}/pdf`, 'GET', null, userToken);
    assert('GET /api/bookings/:id/pdf serves generated PDF invoice for owner (200)', pdfRes.status === 200 && pdfRes.headers['content-type'] === 'application/pdf');

    console.log('\n========================================================');
    console.log(` SUMMARY: ${passed}/${total} Core Workflow Tests Passed!`);
    console.log('========================================================\n');

    if (passed === total) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test Suite Error:', err);
    process.exit(1);
  }
}

setTimeout(runFullVerification, 1500);
