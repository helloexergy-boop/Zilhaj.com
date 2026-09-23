const fs = require('fs');
const assert = require('assert');

function checkFile(name, filePath) {
  console.log('--- Checking ' + name + ' (' + filePath + ') ---');
  const html = fs.readFileSync(filePath, 'utf8');

  // Check 1: original navbar present
  assert(html.includes('navbar-wrapper') && html.includes('id="navbar"'), name + ' must contain navbar-wrapper and id="navbar"');
  console.log('  [PASS] Has original floating island navbar');

  // Check 2: site-header NOT present
  assert(!html.includes('class="site-header"'), name + ' must NOT contain site-header');
  console.log('  [PASS] No custom site-header');

  // Check 3: Packages and Contact Us NOT in nav-menu
  const navMenuMatch = html.match(/<nav[^>]*id=["']navMenu["'][^>]*>([\s\S]*?)<\/nav>/i);
  if (navMenuMatch) {
    const navContent = navMenuMatch[1];
    assert(!navContent.includes('/#packages') && !navContent.includes('/packages'), name + ' navMenu must not contain Packages link');
    assert(!navContent.includes('/#contact') && !navContent.includes('/contact'), name + ' navMenu must not contain Contact link');
    assert(navContent.includes('/services'), name + ' navMenu must contain Services');
    assert(navContent.includes('/about'), name + ' navMenu must contain About Us');
    console.log('  [PASS] navMenu contains ONLY Home, Services, About Us (Packages & Contact removed)');
  }

  // Check 4: Original footer present
  assert(html.includes('HEAD OFFICE') && html.includes('CALL US') && html.includes('EMAIL US'), name + ' must contain original footer with Head Office, Call Us, Email Us');
  assert(html.includes('One Request.<br>Multiple Verified Offers.'), name + ' must contain original footer brand column');
  console.log('  [PASS] Has exact original footer');

  // Check 5: No small request modal popup element
  assert(!html.includes('class="request-modal"'), name + ' must NOT contain small request-modal popup');
  console.log('  [PASS] Small request-modal popup removed');

  // Check 6: Submit request links go to /submit-request
  assert(html.includes('/submit-request'), name + ' must contain link/redirect to /submit-request');
  console.log('  [PASS] Routes to /submit-request');

  // Check 7: Noor AI widget preserved
  assert(html.includes('Noor AI') && html.includes('chatbot-circle-btn'), name + ' must preserve Noor AI widget');
  console.log('  [PASS] Noor AI widget preserved');
}

checkFile('about.html', 'public/about.html');
checkFile('services.html', 'public/services.html');
checkFile('services-tawseef/services.html', 'public/services-tawseef/services.html');
console.log('\n=========================================');
console.log('ALL NAV, FOOTER & SUBMIT CHECKS PASSED!');
console.log('=========================================');
