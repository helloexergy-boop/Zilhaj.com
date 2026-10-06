require('dotenv').config();
const http = require('http');

const PORT = 3096;
process.env.PORT = PORT;

const app = require('./api/index.js');

function fetchPath(path, method = 'GET', body = null) {
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
        resolve({ status: res.statusCode, headers: res.headers, body: chunks });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runSuite() {
  console.log('========================================================');
  console.log('       ZILHAJ COMPREHENSIVE E2E VERIFICATION SUITE       ');
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

  // 1. CANONICAL HTML PAGES
  console.log('--- 1. CANONICAL HTML PAGE ROUTES ---');
  
  const homeRes = await fetchPath('/');
  assert('GET / loads Home page (200)', homeRes.status === 200);
  assert('GET / contains Zilhaj.com brand', homeRes.body.includes('Zilhaj.com'));

  const servicesRes = await fetchPath('/services');
  assert('GET /services loads dedicated Services page (200)', servicesRes.status === 200);
  assert('GET /services contains Video Guides', servicesRes.body.includes('video-guides') || servicesRes.body.includes('Visual Pilgrim Guides'));
  assert('GET /services contains Pilgrim Community', servicesRes.body.includes('community') || servicesRes.body.includes('Pilgrim Community'));
  assert('GET /services contains Noor AI widget', servicesRes.body.includes('Noor AI Spiritual Assistant') || servicesRes.body.includes('Noor AI'));

  const aboutRes = await fetchPath('/about');
  assert('GET /about loads dedicated About Us page (200)', aboutRes.status === 200);
  assert('GET /about contains Founder credentials', aboutRes.body.includes('Tawseef Assadullah H') && aboutRes.body.includes('NIT Srinagar'));
  assert('GET /about contains 5 Pillars of Zilhaj', aboutRes.body.includes('Five Pillars') || aboutRes.body.includes('Idea Behind ZILHAJ'));

  const loginRes = await fetchPath('/login');
  assert('GET /login loads Login page (200)', loginRes.status === 200 && loginRes.body.includes('Login'));

  const signupRes = await fetchPath('/signup');
  assert('GET /signup loads Signup page (200)', signupRes.status === 200 && (signupRes.body.includes('Sign Up') || signupRes.body.includes('Create Account')));

  const submitReqRes = await fetchPath('/submit-request');
  assert('GET /submit-request loads Standalone Request page (200)', submitReqRes.status === 200 && submitReqRes.body.includes('Submit Umrah'));

  const checkoutRes = await fetchPath('/checkout');
  assert('GET /checkout loads Standalone Checkout (200)', checkoutRes.status === 200 && checkoutRes.body.includes('checkout'));

  const dashboardRes = await fetchPath('/dashboard');
  assert('GET /dashboard loads Dashboard (200)', dashboardRes.status === 200 && dashboardRes.body.includes('dashboard'));

  const adminRes = await fetchPath('/admin');
  assert('GET /admin loads Admin Control Panel (200)', adminRes.status === 200 && adminRes.body.includes('Admin'));

  // 2. CSS & JAVASCRIPT ASSETS
  console.log('\n--- 2. CANONICAL CSS & JAVASCRIPT ASSETS ---');

  const servicesCss = await fetchPath('/css/services.css');
  assert('GET /css/services.css served (200)', servicesCss.status === 200 && servicesCss.body.toLowerCase().includes('services'));

  const aboutCss = await fetchPath('/css/about.css');
  assert('GET /css/about.css served (200)', aboutCss.status === 200 && aboutCss.body.toLowerCase().includes('about'));

  const servicesJs = await fetchPath('/js/services.js');
  assert('GET /js/services.js served (200)', servicesJs.status === 200 && servicesJs.body.includes('initRequestModal'));

  const aboutJs = await fetchPath('/js/about.js');
  assert('GET /js/about.js served (200)', aboutJs.status === 200);

  // 3. BACKEND API ENDPOINTS
  console.log('\n--- 3. BACKEND API ENDPOINTS ---');

  const packagesRes = await fetchPath('/api/packages');
  assert('GET /api/packages returns packages (200)', packagesRes.status === 200);

  const razorpayKeyRes = await fetchPath('/api/razorpay-key');
  assert('GET /api/razorpay-key returns public key (200)', razorpayKeyRes.status === 200 && razorpayKeyRes.body.includes('rzp_live_'));

  const orderRes = await fetchPath('/api/create-order', 'POST', { amount: 250000 });
  assert('POST /api/create-order creates Razorpay order (200)', orderRes.status === 200 && orderRes.body.includes('order_'));

  const invalidLogin = await fetchPath('/api/auth/login', 'POST', { email: 'nonexistent@zilhaj.test', password: 'wrong' });
  assert('POST /api/auth/login rejects invalid credentials safely (4xx)', invalidLogin.status >= 400 && invalidLogin.status < 500);

  console.log('\n========================================================');
  console.log(` SUMMARY: ${passed}/${total} Tests Passed Successfully!`);
  console.log('========================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

setTimeout(runSuite, 1500);
