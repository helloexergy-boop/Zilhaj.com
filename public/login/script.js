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
        console.log('Login Success:', { emailOrPhone: emailOrPhoneVal });
        showToast('Login Successful! Welcome back to ZILHAJ.');
      }
    });
  }

  // ==========================================
  // SIGNUP FORM & OTP HANDLING
  // ==========================================
  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    const fullnameInput = document.getElementById('signup-fullname');
    const emailInput = document.getElementById('signup-email');
    const displayOtpEmail = document.getElementById('display-otp-email');
    const phoneInput = document.getElementById('signup-phone');
    const passwordInput = document.getElementById('signup-password');
    const confirmPasswordInput = document.getElementById('signup-confirm-password');
    const termsInput = document.getElementById('signup-terms');
    const termsContainer = document.getElementById('terms-container');
    const otpBoxes = document.querySelectorAll('.otp-box');
    const resendOtpBtn = document.getElementById('resendOtpBtn');
    const otpTimer = document.getElementById('otpTimer');

    // 1. Dynamic Email Display in OTP section
    if (emailInput && displayOtpEmail) {
      emailInput.addEventListener('input', function () {
        const val = emailInput.value.trim();
        displayOtpEmail.textContent = val ? val : 'zubairahmad@gmail.com';
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

    startOtpTimer();

    if (resendOtpBtn) {
      resendOtpBtn.addEventListener('click', function () {
        showToast('A new 6-digit OTP code has been sent to your email!');
        startOtpTimer();
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

      // 3. OTP Code Validation
      let otpCode = '';
      let allOtpFilled = true;
      otpBoxes.forEach(box => {
        if (!box.value) allOtpFilled = false;
        otpCode += box.value;
      });

      if (!allOtpFilled || otpCode.length < 6) {
        otpBoxes.forEach(box => box.classList.add('is-invalid'));
        showError(null, 'signup-otp-error', 'Please enter the complete 6-digit OTP code sent to your email');
        isValid = false;
      } else {
        otpBoxes.forEach(box => box.classList.remove('is-invalid'));
        clearError(null, 'signup-otp-error');
      }

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

      // 5. Password (min 8 chars)
      const passwordVal = passwordInput.value;
      if (!passwordVal) {
        showError(passwordInput, 'signup-password-error', 'Password is required');
        isValid = false;
      } else if (passwordVal.length < 8) {
        showError(passwordInput, 'signup-password-error', 'Minimum 8 characters with letters and numbers required');
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
        console.log('Signup Success:', { fullname: fullnameVal, email: emailVal, phone: phoneVal, otpCode });
        showToast('Account Created Successfully! Welcome to ZILHAJ.');
      }
    });
  }
});
