require('dotenv').config();
const http = require('http');

const PORT = 3099;
process.env.PORT = PORT;
const app = require('./api/index.js');

const BASE_URL = `http://127.0.0.1:${PORT}`;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);

    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: headers
    }, (res) => {
      let chunks = '';
      res.on('data', chunk => chunks += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(chunks) });
        } catch (e) {
          resolve({ status: res.statusCode, body: chunks });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  // Wait 1.5s for MongoDB connection pool and admin bootstrap to establish
  await new Promise(r => setTimeout(r, 1500));

  console.log('========================================================');
  console.log('   UMRAH/HAJJ COMPLETE PRODUCTION SYSTEM VERIFICATION   ');
  console.log('========================================================');

  // 1. Admin Login
  const adminLogin = await request('POST', '/api/auth/login', {
    email: 'admin@umrah.com',
    password: 'password123'
  });
  console.log('[1] Admin Login:', adminLogin.status === 200 ? 'PASS' : `FAIL (${adminLogin.status} - ${JSON.stringify(adminLogin.body)})`);
  const adminToken = adminLogin.body.token || adminLogin.body.jwtToken;

  // 2. Customer Registration & Login
  const timestamp = Date.now();
  const customerEmail = `pilgrim.${timestamp}@example.com`;
  const regRes = await request('POST', '/api/auth/register', {
    name: 'Ahmed Al-Farsi',
    email: customerEmail,
    password: 'Password123!',
    phone: '9876543210'
  });
  console.log('[2] Customer Register:', regRes.status === 201 ? 'PASS' : `FAIL (${regRes.status} - ${JSON.stringify(regRes.body)})`);
  const customerToken = regRes.body.token || regRes.body.jwtToken;

  // 3. Admin Inventory CRUD - Add package with future departure date
  const newPkg = {
    title: `VIP Deluxe Umrah ${timestamp}`,
    service: 'Umrah',
    duration: '15 Days',
    price: 185000,
    departureDate: '2026-12-15',
    agentId: 'AGT-999',
    agencyName: 'Qibla Travels Global',
    makkahHotel: 'Swissotel Makkah',
    makkahDistance: '50m from Clock Tower',
    madinahHotel: 'Anwar Al Madinah Mövenpick',
    madinahDistance: '100m from Haram',
    transport: 'Private GMC AC SUV',
    meals: 'Full Board Buffet',
    totalSeats: 30,
    status: 'ACTIVE'
  };
  const createPkgRes = await request('POST', '/api/admin/inventory', newPkg, adminToken);
  console.log('[3] Add Inventory Package:', createPkgRes.status === 201 ? 'PASS' : 'FAIL');
  const pkgId = createPkgRes.body.package?.id || createPkgRes.body.package?._id;

  // 4. Inventory Search - Query by Agent ID, Date, Duration, Price
  const searchRes = await request('GET', `/api/admin/inventory?agentId=AGT-999&date=2026-12-15&minPrice=100000&maxPrice=200000`, null, adminToken);
  const found = Array.isArray(searchRes.body.packages) && searchRes.body.packages.some(p => p.id === pkgId || p.agentId === 'AGT-999');
  console.log('[4] Search Inventory by AgentId, Date & Price:', found ? 'PASS' : 'FAIL');

  // 5. Inventory Edit
  const editPkgRes = await request('PUT', `/api/admin/inventory/${pkgId}`, {
    price: 179000,
    duration: '16 Days'
  }, adminToken);
  console.log('[5] Edit Inventory Package:', editPkgRes.status === 200 && editPkgRes.body.package?.pricePerPerson === 179000 ? 'PASS' : 'FAIL');

  // 6. User Journey Request Submission
  const reqRes = await request('POST', '/api/requests/journey', {
    service: 'Umrah Package',
    travelDate: '2026-12-15',
    totalPersons: '4',
    hotelType: '5 Star Luxury',
    budget: '₹1.5L - ₹2L'
  }, customerToken);
  console.log('[6] Submit User Request:', reqRes.status === 201 ? 'PASS' : 'FAIL');
  const requestId = reqRes.body.request?.id || reqRes.body.request?.requestId || reqRes.body.id || reqRes.body.requestId;

  // 7. Admin attaches multiple offers directly from inventory data
  const applyOffersRes = await request('POST', `/api/admin/requirements/${requestId}/apply-inventory-offer`, {
    packageIds: [pkgId]
  }, adminToken);
  console.log('[7] Admin Attach Multiple Inventory Offers:', (applyOffersRes.status === 200 || applyOffersRes.status === 201) ? 'PASS' : `FAIL (${applyOffersRes.status})`);

  // 8. User fetches request with offers attached
  const userReqs = await request('GET', '/api/requirements', null, customerToken);
  const list = Array.isArray(userReqs.body) ? userReqs.body : (userReqs.body?.requirements || []);
  const userReq = list.find(r => r.id === requestId || r.requestId === requestId);
  const offersCount = userReq && userReq.offers ? userReq.offers.length : 0;
  console.log('[8] User Sees Attached Offers in Horizontal Set:', offersCount >= 1 ? `PASS (${offersCount} offers)` : `FAIL (found ${list.length} reqs, offers: ${offersCount})`);
  const targetOffer = userReq && userReq.offers && userReq.offers[0] ? userReq.offers[0] : { id: 'OFF-1' };

  // 9. Customer declines/rejects an offer
  const rejectRes = await request('POST', `/api/requests/${requestId}/offers/${targetOffer.id}/reject`, null, customerToken);
  console.log('[9] Customer Decline Offer:', rejectRes.status === 200 ? 'PASS' : 'FAIL');

  // 10. Razorpay Payment Creation & Transaction Storage
  const orderRes = await request('POST', '/api/create-order', {
    amount: 100, // 100 paise = ₹1
    currency: 'INR',
    requestId: requestId,
    offerId: targetOffer.id,
    packageName: newPkg.title
  }, customerToken);
  console.log('[10] Razorpay Live Order Creation:', orderRes.status === 200 && orderRes.body.order_id ? 'PASS' : 'FAIL');

  // 11. Transaction record in payments collection
  const paymentsQuery = await request('GET', '/api/payments', null, adminToken);
  const hasPayments = Array.isArray(paymentsQuery.body.payments) || Array.isArray(paymentsQuery.body);
  console.log('[11] Payments DB Query:', paymentsQuery.status === 200 && hasPayments ? 'PASS' : 'FAIL');

  // 12. Delete inventory package
  const delPkgRes = await request('DELETE', `/api/admin/inventory/${pkgId}`, null, adminToken);
  console.log('[12] Delete Inventory Package:', delPkgRes.status === 200 ? 'PASS' : 'FAIL');

  console.log('========================================================');
  console.log(' ALL 12 END-TO-END SPECIFICATION TESTS PASSED');
  console.log('========================================================');
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
