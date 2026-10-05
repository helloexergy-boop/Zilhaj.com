/**
 * ZILHAJ - Services Page Interactive Scripts
 * Pure Vanilla JavaScript (Zero Dependencies)
 * Brand: ZILHAJ | "One Request. Multiple Verified Offers."
 */

document.addEventListener('DOMContentLoaded', () => {
  initHeaderScroll();
  initMobileNav();
  initScrollAnimations();
  initNoorChatbot();
  initRequestModal();
  initVideoPlayer();
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
  handleScroll();
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
      threshold: 0.1,
      rootMargin: '0px 0px -30px 0px'
    });

    revealElements.forEach(el => observer.observe(el));
  } else {
    revealElements.forEach(el => el.classList.add('is-visible'));
  }
}

/* --------------------------------------------------------------------------
   4. Noor AI Chatbot Assistant
   -------------------------------------------------------------------------- */
function initNoorChatbot() {
  const btn = document.getElementById('noorAiBtn');
  const windowEl = document.getElementById('noorChatWindow');
  if (!btn || !windowEl) return;

  const closeBtn = windowEl.querySelector('.noor-chat-close');
  const chatBody = windowEl.querySelector('.noor-chat-body');
  const inputEl = windowEl.querySelector('.noor-chat-input');
  const sendBtn = windowEl.querySelector('.noor-chat-send');
  const quickBtns = windowEl.querySelectorAll('.chat-quick-btn');

  function openChat() {
    windowEl.classList.add('active');
    inputEl.focus();
  }

  function closeChat() {
    windowEl.classList.remove('active');
  }

  btn.addEventListener('click', () => {
    if (windowEl.classList.contains('active')) {
      closeChat();
    } else {
      openChat();
    }
  });

  if (closeBtn) closeBtn.addEventListener('click', closeChat);

  const responses = {
    services: "ZILHAJ connects you with verified service providers for Hajj & Umrah packages, accommodation in Makkah & Madinah, visa assistance, local transportation, ziyarat arrangements, and pilgrimage guidance.",
    how_works: "Simply submit your pilgrimage requirements once. ZILHAJ connects your request with verified providers who send you suitable offers to compare in one place.",
    hajj_umrah: "Hajj is the sacred annual pilgrimage during Dhul Hijjah, while Umrah can be performed at any time of the year. We support custom requests for both journeys.",
    verified: "All service providers on ZILHAJ undergo strict verification of their licensing, track record, and operational quality before they can send offers."
  };

  function appendBotMessage(text) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble chat-bubble-bot';
    bubble.innerHTML = text;
    chatBody.appendChild(bubble);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function appendUserMessage(text) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble chat-bubble-user';
    bubble.textContent = text;
    chatBody.appendChild(bubble);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  quickBtns.forEach(qBtn => {
    qBtn.addEventListener('click', () => {
      const action = qBtn.getAttribute('data-action');
      appendUserMessage(qBtn.textContent.replace(/^[^\w]+/, '').trim());
      
      setTimeout(() => {
        if (responses[action]) {
          appendBotMessage(responses[action]);
        } else {
          appendBotMessage("Submit your request using the <strong>Submit Request</strong> button and our verified network will prepare tailored options for you.");
        }
      }, 500);
    });
  });

  function handleSend() {
    const query = inputEl.value.trim();
    if (!query) return;

    appendUserMessage(query);
    inputEl.value = '';

    setTimeout(() => {
      const lower = query.toLowerCase();
      if (lower.includes('hajj')) {
        appendBotMessage("For Hajj, you can submit one request detailing your preferred duration and budget, and verified providers will send comprehensive package options.");
      } else if (lower.includes('umrah')) {
        appendBotMessage("For Umrah, you can specify your travel month, hotel proximity preference, and group size to receive tailored offers.");
      } else if (lower.includes('price') || lower.includes('cost')) {
        appendBotMessage("ZILHAJ does not charge fixed package markups. Verified providers send competitive offers directly based on your specific requirements.");
      } else {
        appendBotMessage("Thank you for reaching out! You can submit your requirements through our request form, and verified pilgrimage providers will provide suitable offers.");
      }
    }, 600);
  }

  if (sendBtn) sendBtn.addEventListener('click', handleSend);
  if (inputEl) {
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    });
  }
}

/* --------------------------------------------------------------------------
   5. Interactive Request Trigger - Direct Route to Original Form Page
   -------------------------------------------------------------------------- */
function initRequestModal() {
  const openButtons = document.querySelectorAll('[data-open-request-modal]');
  openButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const journey = btn.getAttribute('data-journey');
      if (journey) {
        window.location.href = `/submit-request?type=${encodeURIComponent(journey)}`;
      } else {
        window.location.href = '/submit-request';
      }
    });
  });
}

/* --------------------------------------------------------------------------
   6. Video Guides Placeholder Handler
   -------------------------------------------------------------------------- */
function initVideoPlayer() {
  const videoCards = document.querySelectorAll('.video-card');
  videoCards.forEach(card => {
    const playBtn = card.querySelector('.video-play-btn');
    const watchLink = card.querySelector('.video-watch-link');
    const title = card.querySelector('.video-card-title')?.textContent || 'Video Guide';

    const handleVideoClick = (e) => {
      e.preventDefault();
      const url = card.getAttribute('data-youtube-url');
      if (url && url !== '#') {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        alert(`"${title}" - This video resource will open in YouTube once the verified video link is updated by the administrator.`);
      }
    };

    if (playBtn) playBtn.addEventListener('click', handleVideoClick);
    if (watchLink) watchLink.addEventListener('click', handleVideoClick);
  });
}
