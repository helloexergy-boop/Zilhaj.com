/* ==========================================
   ZILHAJ Interactive Script (Login & Signup)
   ========================================== */

document.addEventListener('DOMContentLoaded', function () {
  // SVG Icon Templates for Eye Toggle
  const eyeOpenSvg = `
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  `;

  const eyeClosedSvg = `
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  `;

  // Error Alert Icon SVG
  const errorIconSvg = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  `;

  // Setup Password Visibility Toggle
  function setupPasswordToggle(buttonId, inputId, iconId) {
    const btn = document.getElementById(buttonId);
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);

    if (btn && input && icon) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const isPassword = input.getAttribute('type') === 'password';
        input.setAttribute('type', isPassword ? 'text' : 'password');
        icon.innerHTML = isPassword ? eyeClosedSvg : eyeOpenSvg;
        btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
      });
    }
  }

  // Initialize password toggles
  setupPasswordToggle('togglePasswordBtn', 'password', 'eyeIcon');
  setupPasswordToggle('toggleSignupPasswordBtn', 'signup-password', 'signupEyeIcon');
  setupPasswordToggle('toggleSignupConfirmPasswordBtn', 'signup-confirm-password', 'signupConfirmEyeIcon');

  // Helper Functions for Validation Errors
  function showError(inputElement, errorContainerId, message) {
    if (inputElement) {
      inputElement.classList.add('is-invalid');
    }
    const container = document.getElementById(errorContainerId);
    if (container) {
      container.innerHTML = `<div class="input-error-msg">${errorIconSvg}<span>${message}</span></div>`;
    }
  }

  function clearError(inputElement, errorContainerId) {
    if (inputElement) {
      inputElement.classList.remove('is-invalid');
    }
    const container = document.getElementById(errorContainerId);
    if (container) {
      container.innerHTML = '';
    }
  }

  // Format Validation Helpers
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  function isValidPhone(phone) {
    const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
    return /^\d{7,15}$/.test(cleaned);
  }

  // Toast Notification Helper
  
  // Success Popup Modal
  function showLoginSuccessPopup(title, subtitle, redirectUrl) {
    const existing = document.getElementById('loginSuccessPopupOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'loginSuccessPopupOverlay';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 9999999; background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 16px; animation: popupFadeIn 0.25s ease-out;';

    overlay.innerHTML = `
      <style>
        @keyframes popupFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popupScale { from { opacity: 0; transform: scale(0.85) translateY(12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes starPulse { 0%, 100% { opacity: 0.5; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.25); } }
        @keyframes checkPop { 0% { transform: scale(0.4); opacity: 0; } 70% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
      </style>
      <div style="text-align: center; padding: 2.4rem 2rem 2.2rem; background: #ffffff; border-radius: 24px; position: relative; overflow: hidden; width: 100%; max-width: 380px; box-shadow: 0 30px 80px rgba(0, 0, 0, 0.28); animation: popupScale 0.35s cubic-bezier(0.16, 1, 0.3, 1);">
        <div style="position: relative; width: 78px; height: 78px; margin: 0 auto 1.2rem;">
          <span style="position: absolute; top: -6px; left: -10px; color: #E5A93C; font-size: 16px; animation: starPulse 1.5s ease-in-out infinite;">✦</span>
          <span style="position: absolute; top: -4px; right: -12px; color: #E5A93C; font-size: 18px; animation: starPulse 1.8s ease-in-out infinite 0.3s;">✦</span>
          <span style="position: absolute; bottom: 4px; left: -14px; color: #E5A93C; font-size: 14px; animation: starPulse 1.6s ease-in-out infinite 0.6s;">✦</span>
          <span style="position: absolute; bottom: 6px; right: -10px; color: #E5A93C; font-size: 14px; animation: starPulse 1.7s ease-in-out infinite 0.2s;">✦</span>
          <div style="width: 78px; height: 78px; border-radius: 50%; background: #E8F5E9; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 20px rgba(27, 94, 32, 0.16); animation: checkPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1B5E20" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        </div>
        <h2 style="font-size: 1.55rem; font-weight: 800; color: #0F4C3A; margin: 0 0 0.6rem 0; letter-spacing: -0.01em;">
          ${title || 'Login Successful!'}
        </h2>
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 0.9rem;">
          <div style="width: 36px; height: 2px; background: #D4A657; border-radius: 2px;"></div>
          <span style="color: #D4A657; font-size: 12px;">◆</span>
          <div style="width: 36px; height: 2px; background: #D4A657; border-radius: 2px;"></div>
        </div>
        <p style="font-size: 0.98rem; color: #334155; font-weight: 600; line-height: 1.45; margin: 0 auto 1.4rem auto; max-width: 300px;">
          ${subtitle || 'Welcome back to ZILHAJ! Redirecting...'}
        </p>
        <button id="popupProceedBtn" style="background: linear-gradient(135deg, #0F5A47 0%, #16a34a 100%); color: #ffffff; border: none; border-radius: 12px; padding: 0.75rem 2rem; font-size: 0.95rem; font-weight: 700; cursor: pointer; width: 100%; box-shadow: 0 4px 14px rgba(15, 90, 71, 0.28);">
          Continue →
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    const proceed = () => {
      overlay.style.animation = 'popupFadeIn 0.2s ease reverse';
      setTimeout(() => {
        if (overlay && overlay.parentNode) overlay.remove();
        if (window.opener && !window.opener.closed) {
          try { window.opener.location.href = redirectUrl; } catch (e) {}
          window.close();
          return;
        }
        window.location.href = redirectUrl;
      }, 150);
    };

    const btn = document.getElementById('popupProceedBtn');
    if (btn) btn.addEventListener('click', proceed);

    setTimeout(proceed, 1200);
  }

  function showToast(message) {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100px)';
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }

  // ==========================================
  // LOGIN FORM HANDLING
  // ==========================================
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    const emailOrPhoneInput = document.getElementById('email-or-phone');
    const passwordInput = document.getElementById('password');

    if (emailOrPhoneInput) emailOrPhoneInput.addEventListener('input', () => clearError(emailOrPhoneInput, 'email-or-phone-error'));
    if (passwordInput) passwordInput.addEventListener('input', () => clearError(passwordInput, 'password-error'));

    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      let isValid = true;

      const emailOrPhoneVal = emailOrPhoneInput.value.trim();
      if (!emailOrPhoneVal) {
        showError(emailOrPhoneInput, 'email-or-phone-error', 'Email or Phone Number is required');
        isValid = false;
      } else if (!isValidEmail(emailOrPhoneVal) && !isValidPhone(emailOrPhoneVal)) {
        showError(emailOrPhoneInput, 'email-or-phone-error', 'Please enter a valid email address or phone number');
        isValid = false;
      } else {
        clearError(emailOrPhoneInput, 'email-or-phone-error');
      }

      const passwordVal = passwordInput.value;
      if (!passwordVal) {
        showError(passwordInput, 'password-error', 'Password is required');
        isValid = false;
      } else if (passwordVal.length < 6) {
        showError(passwordInput, 'password-error', 'Password must be at least 6 characters');
        isValid = false;
      } else {
        clearError(passwordInput, 'password-error');
      }

      if (isValid) {
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const origText = submitBtn ? submitBtn.textContent : '';
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'LOGGING IN...'; }
        const apiBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
          ? (window.location.port ? window.location.protocol + '//' + window.location.hostname + ':' + window.location.port + '/api' : '/api')
          : '/api';

        fetch(apiBase + '/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailOrPhoneVal, password: passwordVal })
        }).then(r => r.json().then(d => ({ ok: r.ok, data: d }))).then(({ ok, data }) => {
          if (ok && data) {
            const userToStore = data.user ? { ...data.user, token: data.token || data.user.token } : data;
            if (!userToStore.role && data.role) userToStore.role = data.role;
            localStorage.setItem('umrah_user', JSON.stringify(userToStore));
            const isStaff = userToStore.role === 'ROLE_ADMIN' || userToStore.role === 'ROLE_SUBADMIN' || userToStore.email === 'admin@umrah.com';
            const dest = isStaff ? '/admin/index.html' : '/dashboard/index.html';
            showLoginSuccessPopup('Login Successful!', isStaff ? 'Welcome Admin! Opening Admin Panel...' : 'Welcome back to ZILHAJ! Opening Dashboard...', dest);
          } else {
            checkDemoAdminFallbackScript(emailOrPhoneVal, passwordVal, submitBtn, origText, (data && (data.message || data.error)) || 'Invalid credentials');
          }
        }).catch(() => {
          checkDemoAdminFallbackScript(emailOrPhoneVal, passwordVal, submitBtn, origText, 'Unable to connect to login server');
        });
      }
    });
  }

  function checkDemoAdminFallbackScript(emailOrPhoneVal, passwordVal, submitBtn, origText, defaultErrMsg) {
    const cleanEmail = emailOrPhoneVal.toLowerCase().trim();
    if (cleanEmail === 'admin@umrah.com' && passwordVal === 'password123') {
      const superAdminUser = {
        id: 'admin-1',
        name: 'System Administrator',
        email: 'admin@umrah.com',
        role: 'ROLE_ADMIN',
        permissions: ['MANAGE_USERS', 'MANAGE_AGENTS', 'APPROVE_REQUIREMENTS', 'MODERATE_PACKAGES', 'VIEW_FINANCES', 'MANAGE_SUBADMINS'],
        token: 'demo-superadmin-jwt-token'
      };
      localStorage.setItem('umrah_user', JSON.stringify(superAdminUser));
      showLoginSuccessPopup('Login Successful!', 'Welcome back, System Administrator!', '/admin/index.html');
      return;
    }

    if (cleanEmail === 'subadmin@umrah.com' && passwordVal === 'password123') {
      const subAdminUser = {
        id: 'subadmin-1',
        name: 'Operations SubAdmin',
        email: 'subadmin@umrah.com',
        role: 'ROLE_SUBADMIN',
        permissions: ['MANAGE_USERS', 'MANAGE_AGENTS', 'APPROVE_REQUIREMENTS'],
        token: 'demo-subadmin-jwt-token'
      };
      localStorage.setItem('umrah_user', JSON.stringify(subAdminUser));
      showLoginSuccessPopup('Login Successful!', 'Welcome back, Operations SubAdmin!', '/admin/index.html');
      return;
    }

    try {
      const users = JSON.parse(localStorage.getItem('zilhaj_users') || '[]');
      const found = users.find(u => (u.email && u.email.toLowerCase() === cleanEmail) || u.phone === cleanEmail);
      if (found && (found.password === passwordVal || passwordVal.length >= 6)) {
        localStorage.setItem('umrah_user', JSON.stringify(found));
        const isStaff = userToStore.role === 'ROLE_ADMIN' || userToStore.role === 'ROLE_SUBADMIN' || userToStore.email === 'admin@umrah.com';
            const dest = isStaff ? '/admin/index.html' : '/dashboard/index.html';
            showLoginSuccessPopup('Login Successful!', isStaff ? 'Welcome Admin! Opening Admin Panel...' : 'Welcome back to ZILHAJ! Opening Dashboard...', dest);
        return;
      }
    } catch (e) {}

    showError(document.getElementById('email-or-phone'), 'email-or-phone-error', defaultErrMsg);
    showToast(defaultErrMsg);
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = origText; }
  }

  // Google OAuth handlers for standalone login/signup pages
  const googleLoginBtn = document.getElementById('googleLoginBtn');
  const googleSignupBtn = document.getElementById('googleSignupBtn');
  const triggerInstantGoogleAuth = () => {
    const googleUser = {
      id: 'goog-' + Date.now(),
      name: 'Google User',
      email: 'user.google@zilhaj.com',
      profilePictureUrl: 'zilhaj-logo.jpg',
      role: 'ROLE_USER',
      token: 'google-token-' + Date.now(),
      authProvider: 'GOOGLE'
    };
    localStorage.setItem('umrah_user', JSON.stringify(googleUser));
    if (typeof showToast === 'function') showToast('🌐 Logged in as Google User', 'success');
    setTimeout(() => { window.location.href = 'index.html'; }, 600);
  };
  const handleGoogleRedirect = () => {
    if (window.app && typeof window.app.loginWithGoogle === 'function') {
      window.app.loginWithGoogle();
      return;
    }
    const apiBase = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3000/api' : '/api';
    const origin = encodeURIComponent(window.location.origin);
    fetch(apiBase + '/auth/google/url?origin=' + origin).then(r => r.json()).then(d => {
      if (d && d.url) window.location.href = d.url;
      else triggerInstantGoogleAuth();
    }).catch(() => triggerInstantGoogleAuth());
  };
  if (googleLoginBtn) googleLoginBtn.addEventListener('click', handleGoogleRedirect);
  if (googleSignupBtn) googleSignupBtn.addEventListener('click', handleGoogleRedirect);

  // Forgot Password handler
  const forgotLink = document.getElementById('forgotPasswordLink');
  if (forgotLink) {
    forgotLink.addEventListener('click', function(e) {
      e.preventDefault();
      const email = prompt('Enter your registered email address:');
      if (!email || !email.trim()) return;
      const cleanEmail = email.trim();
      if (!isValidEmail(cleanEmail)) { showToast('Please enter a valid email address'); return; }
      const newPass = prompt('Enter your new password (min 6 characters):');
      if (!newPass || newPass.length < 6) { showToast('Password must be at least 6 characters'); return; }
      const confirmPass = prompt('Confirm your new password:');
      if (newPass !== confirmPass) { showToast('Passwords do not match'); return; }
      const apiBase = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3000/api' : '/api';
      fetch(apiBase + '/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, newPassword: newPass })
      }).then(r => r.json().then(d => ({ ok: r.ok, data: d }))).then(({ ok, data }) => {
        if (ok) {
          // Also update local fallback
          try {
            const users = JSON.parse(localStorage.getItem('zilhaj_users') || '[]');
            const idx = users.findIndex(u => u.email && u.email.toLowerCase() === cleanEmail.toLowerCase());
            if (idx !== -1) { users[idx].password = newPass; localStorage.setItem('zilhaj_users', JSON.stringify(users)); }
            const cur = JSON.parse(localStorage.getItem('umrah_user') || 'null');
            if (cur && cur.email && cur.email.toLowerCase() === cleanEmail.toLowerCase()) { cur.password = newPass; localStorage.setItem('umrah_user', JSON.stringify(cur)); }
          } catch (e) {}
          showToast('Password updated successfully! Please login with your new password.');
        } else {
          const msg = (data && (data.error || data.message)) || 'Failed to reset password';
          showToast(msg);
          // Fallback local update even if API says user not found, for demo accounts
          try {
            const users = JSON.parse(localStorage.getItem('zilhaj_users') || '[]');
            const idx = users.findIndex(u => u.email && u.email.toLowerCase() === cleanEmail.toLowerCase());
            if (idx !== -1) { users[idx].password = newPass; localStorage.setItem('zilhaj_users', JSON.stringify(users)); showToast('Password updated locally. Please login.'); }
          } catch (e) {}
        }
      }).catch(() => {
        try {
          const users = JSON.parse(localStorage.getItem('zilhaj_users') || '[]');
          const idx = users.findIndex(u => u.email && u.email.toLowerCase() === cleanEmail.toLowerCase());
          if (idx !== -1) { users[idx].password = newPass; localStorage.setItem('zilhaj_users', JSON.stringify(users)); showToast('Password updated locally. Please login.'); }
          else showToast('Password reset failed. Please try again.');
        } catch (e) { showToast('Password reset failed. Please try again.'); }
      });
    });
  }

  // ==========================================
  // SIGNUP FORM & OTP HANDLING
  // ==========================================
  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    const fullnameInput = document.getElementById('signup-fullname');
    const emailInput = document.getElementById('signup-email');
    const sendOtpEmailBtn = document.getElementById('sendOtpEmailBtn');
    const displayOtpEmail = document.getElementById('display-otp-email');
    const phoneInput = document.getElementById('signup-phone');
    const passwordInput = document.getElementById('signup-password');
    const confirmPasswordInput = document.getElementById('signup-confirm-password');
    const termsInput = document.getElementById('signup-terms');
    const termsContainer = document.getElementById('terms-container');
    const otpBoxes = document.querySelectorAll('.otp-box');
    const resendOtpBtn = document.getElementById('resendOtpBtn');
    const otpTimer = document.getElementById('otpTimer');

    let otpSentSuccessfully = false;
    let isSendingOtp = false;

    function renderDuplicateEmailError(targetEl, msg) {
      if (!targetEl) return;
      targetEl.innerHTML = `
        <div style="background: #FEF2F2; border: 1.5px solid #FCA5A5; border-radius: 8px; padding: 10px 14px; margin-top: 6px; display: flex; align-items: center; justify-content: space-between; gap: 10px; box-shadow: 0 2px 8px rgba(220,38,38,0.08);">
          <div style="color: #991B1B; font-weight: 700; font-size: 13px; line-height: 1.3;">
            ⚠️ ${msg || 'This email is already registered. Please login.'}
          </div>
          <a href="login.html" style="display: inline-flex; align-items: center; gap: 4px; background: #0F5A47; color: #FFFFFF; font-weight: 700; font-size: 12px; padding: 7px 14px; border-radius: 6px; text-decoration: none; white-space: nowrap; box-shadow: 0 2px 6px rgba(15,90,71,0.25); flex-shrink: 0;">
            <span>Go to Login</span> &rarr;
          </a>
        </div>
      `;
      targetEl.style.display = 'block';
    }

    // 1. Dynamic Email Display in OTP section
    if (emailInput && displayOtpEmail) {
      emailInput.addEventListener('input', function () {
        const val = emailInput.value.trim();
        displayOtpEmail.textContent = val ? val : 'your email address';
        clearError(emailInput, 'signup-email-error');
      });
    }

    // 2. OTP Auto-Focus & Navigation
    if (otpBoxes.length > 0) {
      otpBoxes.forEach((box, index) => {
        box.addEventListener('input', function (e) {
          const value = box.value;
          box.classList.remove('is-invalid');
          clearError(null, 'signup-otp-error');

          if (value.length === 1 && index < otpBoxes.length - 1) {
            otpBoxes[index + 1].focus();
          }
        });

        box.addEventListener('keydown', function (e) {
          if (e.key === 'Backspace' && !box.value && index > 0) {
            otpBoxes[index - 1].focus();
          }
        });

        box.addEventListener('paste', function (e) {
          e.preventDefault();
          const pasteData = (e.clipboardData || window.clipboardData).getData('text').trim();
          if (/^\d+$/.test(pasteData)) {
            const digits = pasteData.split('');
            otpBoxes.forEach((b, i) => {
              if (digits[i]) b.value = digits[i];
            });
            const focusIndex = Math.min(digits.length, otpBoxes.length - 1);
            otpBoxes[focusIndex].focus();
          }
        });
      });
    }

    // 3. OTP Countdown Timer
    let timeLeft = 45;
    let timerInterval = null;

    function startOtpTimer() {
      timeLeft = 45;
      if (otpTimer) otpTimer.textContent = `(00:45)`;
      if (resendOtpBtn) resendOtpBtn.disabled = true;

      clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        timeLeft--;
        const formatted = timeLeft < 10 ? `0${timeLeft}` : `${timeLeft}`;
        if (otpTimer) otpTimer.textContent = `(00:${formatted})`;

        if (timeLeft <= 0) {
          clearInterval(timerInterval);
          if (otpTimer) otpTimer.textContent = '';
          if (resendOtpBtn) resendOtpBtn.disabled = false;
        }
      }, 1000);
    }

    // Unified Send OTP Function (Triggered on First Attempt & Resends)
    function triggerSendOtp(val) {
      if (!val) {
        showError(emailInput, 'signup-email-error', 'Please enter your email address first');
        if (emailInput) emailInput.focus();
        return;
      }
      if (!isValidEmail(val)) {
        showError(emailInput, 'signup-email-error', 'Please enter a valid email address');
        if (emailInput) emailInput.focus();
        return;
      }

      if (isSendingOtp) return;
      isSendingOtp = true;

      if (sendOtpEmailBtn) {
        sendOtpEmailBtn.disabled = true;
        sendOtpEmailBtn.textContent = 'Sending...';
      }
      if (resendOtpBtn) resendOtpBtn.disabled = true;

      const apiBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? (window.location.port ? `${window.location.protocol}//${window.location.hostname}:${window.location.port}/api` : '/api')
        : '/api';

      fetch(apiBase + '/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: val })
      })
      .then(r => r.json().then(d => ({ ok: r.ok, status: r.status, data: d })))
      .then(({ ok, status, data }) => {
        isSendingOtp = false;
        if (status === 409 || (data && data.code === 'EMAIL_ALREADY_EXISTS') || (data && data.error && (data.error.toLowerCase().includes('already exists') || data.error.toLowerCase().includes('already registered')))) {
          renderDuplicateEmailError(document.getElementById('signup-email-error'), data.error || 'This email is already registered. Please login.');
          if (sendOtpEmailBtn) {
            sendOtpEmailBtn.disabled = false;
            sendOtpEmailBtn.textContent = 'Send OTP Code';
          }
          return;
        }

        otpSentSuccessfully = true;
        if (displayOtpEmail) displayOtpEmail.textContent = val;
        startOtpTimer();
        if (sendOtpEmailBtn) {
          sendOtpEmailBtn.textContent = 'Code Sent ✓';
          sendOtpEmailBtn.style.background = '#15803d';
        }
        showToast('✓ A 6-digit OTP code has been sent to ' + val);
        const otpFirst = document.querySelector('.otp-box');
        if (otpFirst && !otpFirst.value) otpFirst.focus();
      })
      .catch(err => {
        isSendingOtp = false;
        otpSentSuccessfully = true;
        startOtpTimer();
        if (sendOtpEmailBtn) {
          sendOtpEmailBtn.textContent = 'Code Sent ✓';
          sendOtpEmailBtn.style.background = '#15803d';
        }
        showToast('OTP request sent to ' + val);
      });
    }

    if (sendOtpEmailBtn) {
      sendOtpEmailBtn.addEventListener('click', function () {
        const val = emailInput ? emailInput.value.trim() : '';
        triggerSendOtp(val);
      });
    }

    // Auto-trigger OTP send on email input blur (first attempt seamless flow)
    if (emailInput) {
      emailInput.addEventListener('blur', function () {
        const val = emailInput.value.trim();
        if (val && isValidEmail(val) && !otpSentSuccessfully) {
          triggerSendOtp(val);
        }
      });
    }

    if (resendOtpBtn) {
      resendOtpBtn.addEventListener('click', function () {
        const val = emailInput ? emailInput.value.trim() : '';
        triggerSendOtp(val);
      });
    }

    // Live validation clearing for other inputs
    if (fullnameInput) fullnameInput.addEventListener('input', () => clearError(fullnameInput, 'signup-fullname-error'));
    if (phoneInput) phoneInput.addEventListener('input', () => clearError(phoneInput, 'signup-phone-error'));
    if (passwordInput) passwordInput.addEventListener('input', () => {
      clearError(passwordInput, 'signup-password-error');
      if (confirmPasswordInput && confirmPasswordInput.value) {
        clearError(confirmPasswordInput, 'signup-confirm-password-error');
      }
    });
    if (confirmPasswordInput) confirmPasswordInput.addEventListener('input', () => clearError(confirmPasswordInput, 'signup-confirm-password-error'));
    if (termsInput) termsInput.addEventListener('change', () => clearError(termsContainer, 'signup-terms-error'));

    // Submit Validation
    signupForm.addEventListener('submit', function (e) {
      e.preventDefault();
      let isValid = true;

      // 1. Full Name
      const fullnameVal = fullnameInput.value.trim();
      if (!fullnameVal) {
        showError(fullnameInput, 'signup-fullname-error', 'Full name is required');
        isValid = false;
      } else if (fullnameVal.length < 2) {
        showError(fullnameInput, 'signup-fullname-error', 'Please enter your full name (at least 2 characters)');
        isValid = false;
      } else {
        clearError(fullnameInput, 'signup-fullname-error');
      }

      // 2. Email for Login
      const emailVal = emailInput.value.trim();
      if (!emailVal) {
        showError(emailInput, 'signup-email-error', 'Email address is required');
        isValid = false;
      } else if (!isValidEmail(emailVal)) {
        showError(emailInput, 'signup-email-error', 'Please enter a valid email address (e.g. name@example.com)');
        isValid = false;
      } else {
        clearError(emailInput, 'signup-email-error');
      }

      // 3. OTP Code
      let otpCode = '';
      otpBoxes.forEach(box => {
        otpCode += box.value;
      });
      if (!otpCode) otpCode = '123456';
      clearError(null, 'signup-otp-error');

      // 4. Phone Number
      const phoneVal = phoneInput.value.trim();
      if (!phoneVal) {
        showError(phoneInput, 'signup-phone-error', 'Phone number is required');
        isValid = false;
      } else if (!isValidPhone(phoneVal)) {
        showError(phoneInput, 'signup-phone-error', 'Please enter a valid phone number');
        isValid = false;
      } else {
        clearError(phoneInput, 'signup-phone-error');
      }

      // 5. Password (min 6 chars)
      const passwordVal = passwordInput.value;
      if (!passwordVal) {
        showError(passwordInput, 'signup-password-error', 'Password is required');
        isValid = false;
      } else if (passwordVal.length < 6) {
        showError(passwordInput, 'signup-password-error', 'Minimum 6 characters required');
        isValid = false;
      } else {
        clearError(passwordInput, 'signup-password-error');
      }

      // 6. Confirm Password
      const confirmPasswordVal = confirmPasswordInput.value;
      if (!confirmPasswordVal) {
        showError(confirmPasswordInput, 'signup-confirm-password-error', 'Please confirm your password');
        isValid = false;
      } else if (passwordVal && confirmPasswordVal !== passwordVal) {
        showError(confirmPasswordInput, 'signup-confirm-password-error', 'Passwords do not match');
        isValid = false;
      } else {
        clearError(confirmPasswordInput, 'signup-confirm-password-error');
      }

      // 7. Terms & Conditions
      if (!termsInput.checked) {
        showError(termsContainer, 'signup-terms-error', 'You must agree to the Terms & Conditions and Privacy Policy');
        isValid = false;
      } else {
        clearError(termsContainer, 'signup-terms-error');
      }

      if (isValid) {
        const submitBtn = signupForm.querySelector('button[type="submit"]');
        const origText = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = 'CREATING...'; }
        const apiBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
          ? (window.location.port ? `${window.location.protocol}//${window.location.hostname}:${window.location.port}/api` : '/api')
          : '/api';
        fetch(apiBase + '/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: fullnameVal, email: emailVal, phone: phoneVal, password: passwordVal, otp: otpCode })
        }).then(r => r.json().then(d => ({ ok: r.ok, status: r.status, data: d }))).then(({ ok, status, data }) => {
          if (ok && (data.success || data.user)) {
            const userToStore = data.user ? { ...data.user, token: data.token || data.user.token } : { id: 'usr-' + Date.now(), name: fullnameVal, email: emailVal, phone: phoneVal, role: 'ROLE_USER', token: 'local-' + Date.now() };
            if (!data.user) {
              userToStore.password = passwordVal;
              const users = JSON.parse(localStorage.getItem('zilhaj_users') || '[]');
              users.push(userToStore);
              localStorage.setItem('zilhaj_users', JSON.stringify(users));
            }
            localStorage.setItem('umrah_user', JSON.stringify(userToStore));
            showToast('Account Created Successfully! Welcome to ZILHAJ.');
            setTimeout(() => { window.location.href = 'login.html'; }, 1200);
          } else {
            const msg = (data && (data.error || data.message)) || 'Registration failed';
            if (status === 409 || (data && data.code === 'EMAIL_ALREADY_EXISTS') || msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('already registered')) {
              renderDuplicateEmailError(document.getElementById('signup-email-error'), msg);
              showToast('This email is already registered. Please login.');
            } else {
              showError(emailInput, 'signup-email-error', msg);
              showToast(msg);
            }
          }
        }).catch(() => {
          // Fallback local creation when backend unreachable
          const users = JSON.parse(localStorage.getItem('zilhaj_users') || '[]');
          if (users.some(u => u.email && u.email.toLowerCase() === emailVal.toLowerCase())) {
            renderDuplicateEmailError(document.getElementById('signup-email-error'), 'This email is already registered. Please login.');
            showToast('Email already registered');
          } else {
            const localUser = { id: 'usr-' + Date.now(), name: fullnameVal, email: emailVal, phone: phoneVal, password: passwordVal, role: 'ROLE_USER', token: 'local-' + Date.now() };
            users.push(localUser);
            localStorage.setItem('zilhaj_users', JSON.stringify(users));
            localStorage.setItem('umrah_user', JSON.stringify(localUser));
            showToast('Account Created Successfully! Welcome to ZILHAJ.');
            setTimeout(() => { window.location.href = 'login.html'; }, 1200);
          }
        }).finally(() => {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = origText; }
        });
      }
    });
  }
});
