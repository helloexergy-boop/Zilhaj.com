/**
 * ZILHAJ.com - About Us Interactive Scripts
 * Pure Vanilla JavaScript (Zero Dependencies)
 */

document.addEventListener('DOMContentLoaded', () => {
  initHeaderScroll();
  initMobileNav();
  initScrollAnimations();
  initNoorChatbot();
  initRequestModal();
});

/* --------------------------------------------------------------------------
   1. Header Dynamic Scroll Effect
   -------------------------------------------------------------------------- */
function initHeaderScroll() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const handleScroll = () => {
    if (window.scrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll(); // run once initially
}

/* --------------------------------------------------------------------------
   2. Mobile Navigation Menu Drawer
   -------------------------------------------------------------------------- */
function initMobileNav() {
  const toggleBtn = document.querySelector('.mobile-toggle');
  const drawer = document.querySelector('.mobile-drawer');
  const backdrop = document.querySelector('.drawer-backdrop');
  const navLinks = document.querySelectorAll('.mobile-nav-link');

  if (!toggleBtn || !drawer || !backdrop) return;

  function openMenu() {
    toggleBtn.classList.add('active');
    toggleBtn.setAttribute('aria-expanded', 'true');
    drawer.classList.add('open');
    backdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    toggleBtn.classList.remove('active');
    toggleBtn.setAttribute('aria-expanded', 'false');
    drawer.classList.remove('open');
    backdrop.classList.remove('active');
    document.body.style.overflow = '';
  }

  toggleBtn.addEventListener('click', () => {
    const isOpen = drawer.classList.contains('open');
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  backdrop.addEventListener('click', closeMenu);

  navLinks.forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) {
      closeMenu();
    }
  });
}

/* --------------------------------------------------------------------------
   3. Subtle Scroll Reveal Animations
   -------------------------------------------------------------------------- */
function initScrollAnimations() {
  const revealElements = document.querySelectorAll('.reveal-on-scroll');
  if (!revealElements.length) return;

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px'
    });

    revealElements.forEach(el => observer.observe(el));
  } else {
    // Fallback for older browsers
    revealElements.forEach(el => el.classList.add('is-visible'));
  }
}

/* --------------------------------------------------------------------------
   4. Noor AI Pilgrimage Assistant Chatbot
   -------------------------------------------------------------------------- */
function initNoorChatbot() {
  const noorBtn = document.querySelector('.noor-ai-btn');
  const chatWindow = document.querySelector('.noor-chat-window');
  const closeBtn = document.querySelector('.noor-chat-close');
  const chatBody = document.querySelector('.noor-chat-body');
  const chatInput = document.querySelector('.noor-chat-input');
  const sendBtn = document.querySelector('.noor-chat-send');
  const quickActionBtns = document.querySelectorAll('.chat-quick-btn');

  if (!noorBtn || !chatWindow || !chatBody) return;

  const responses = {
    'how_works': `Salam! At ZILHAJ, you submit ONE Hajj or Umrah request with your preferences and budget. We connect your request with relevant verified pilgrimage service providers who submit tailored offers. You then transparently compare and choose what fits best!`,
    'submit_request': `You can click any "Submit a Request" button on this page to enter your dates, group size, and preferences. It takes less than 2 minutes, and verified providers will send you options.`,
    'compare_offers': `Once providers receive your request, they send you suitable offers. You can compare accommodation, services, and pricing side-by-side in one transparent view.`,
    'difference': `Unlike a traditional travel agency with fixed packages, ZILHAJ is a pilgrim-first platform where verified providers compete for your journey, giving you choice and transparency.`
  };

  function toggleChat() {
    const isOpen = chatWindow.classList.contains('open');
    if (isOpen) {
      chatWindow.classList.remove('open');
    } else {
      chatWindow.classList.add('open');
      if (chatInput) chatInput.focus();
    }
  }

  noorBtn.addEventListener('click', toggleChat);
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      chatWindow.classList.remove('open');
    });
  }

  function appendMessage(sender, text) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble chat-bubble-${sender}`;
    bubble.textContent = text;
    chatBody.appendChild(bubble);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function showBotTyping(callback) {
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'chat-bubble chat-bubble-bot';
    typingIndicator.innerHTML = '<em>Noor is typing...</em>';
    chatBody.appendChild(typingIndicator);
    chatBody.scrollTop = chatBody.scrollHeight;

    setTimeout(() => {
      typingIndicator.remove();
      callback();
    }, 600);
  }

  function handleUserInput() {
    if (!chatInput) return;
    const text = chatInput.value.trim();
    if (!text) return;

    appendMessage('user', text);
    chatInput.value = '';

    const lower = text.toLowerCase();
    let reply = `Thank you for asking! ZILHAJ helps you submit one Hajj & Umrah request to receive and compare multiple verified offers. Would you like to submit a request now?`;

    if (lower.includes('how') || lower.includes('work') || lower.includes('process')) {
      reply = responses.how_works;
    } else if (lower.includes('submit') || lower.includes('request') || lower.includes('book') || lower.includes('apply')) {
      reply = responses.submit_request;
    } else if (lower.includes('compare') || lower.includes('offer') || lower.includes('quote') || lower.includes('price')) {
      reply = responses.compare_offers;
    } else if (lower.includes('agency') || lower.includes('different') || lower.includes('who are you') || lower.includes('zilhaj')) {
      reply = responses.difference;
    }

    showBotTyping(() => {
      appendMessage('bot', reply);
    });
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', handleUserInput);
  }

  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleUserInput();
      }
    });
  }

  quickActionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action');
      const questionText = btn.textContent;
      appendMessage('user', questionText);
      const reply = responses[action] || responses.how_works;
      showBotTyping(() => {
        appendMessage('bot', reply);
      });
    });
  });
}

/* --------------------------------------------------------------------------
   5. Interactive Request Modal System
   -------------------------------------------------------------------------- */
function initRequestModal() {
  const modal = document.querySelector('.request-modal');
  const backdrop = document.querySelector('.modal-backdrop');
  const closeBtn = document.querySelector('.modal-close');
  const triggerBtns = document.querySelectorAll('[data-open-request-modal]');
  const requestForm = document.querySelector('#pilgrimRequestForm');

  if (!modal || !backdrop) return;

  function openModal(journeyType = 'Umrah') {
    modal.classList.add('active');
    backdrop.classList.add('active');
    document.body.style.overflow = 'hidden';

    const journeySelect = modal.querySelector('#journeyType');
    if (journeySelect && journeyType) {
      journeySelect.value = journeyType;
    }
  }

  function closeModal() {
    modal.classList.remove('active');
    backdrop.classList.remove('active');
    document.body.style.overflow = '';
  }

  triggerBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const journey = btn.getAttribute('data-journey') || 'Umrah';
      openModal(journey);
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });

  if (requestForm) {
    requestForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const submitBtn = requestForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Connecting with Verified Providers...';
      submitBtn.disabled = true;

      setTimeout(() => {
        const modalBody = modal.querySelector('.modal-body');
        modalBody.innerHTML = `
          <div style="text-align: center; padding: 24px 12px;">
            <div style="width: 56px; height: 56px; background: #D1FAE5; color: #065F46; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 24px;">✓</div>
            <h3 style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 20px; font-weight: 700; color: #083324; margin-bottom: 8px;">Request Submitted Successfully</h3>
            <p style="font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 20px;">
              Your pilgrimage requirements have been received. We are connecting your request with relevant verified Hajj &amp; Umrah service providers. Suitable offers will be prepared for you to compare.
            </p>
            <button class="btn btn-primary" onclick="location.reload()" style="width: 100%;">Done</button>
          </div>
        `;
      }, 900);
    });
  }
}
