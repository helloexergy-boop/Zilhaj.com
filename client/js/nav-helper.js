/**
 * ZILHAJ Universal Navigation, Auth State & Loading Experience Helper
 */
(function() {
  // Inject global progress bar style
  const style = document.createElement('style');
  style.id = 'zilhaj-nav-helper-styles';
  style.textContent = `
    #globalProgressBar {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 3px;
      z-index: 9999999;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    #globalProgressBar .fill-bar {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #10b981 0%, #047857 50%, #f59e0b 100%);
      box-shadow: 0 0 10px rgba(16, 185, 129, 0.8), 0 0 4px rgba(245, 158, 11, 0.8);
      transition: width 0.28s cubic-bezier(0.1, 0.9, 0.2, 1);
      border-radius: 0 4px 4px 0;
    }
    #globalProgressBar.loading {
      opacity: 1;
    }
    #globalProgressBar.loading .fill-bar {
      width: 75%;
    }
    #globalProgressBar.done {
      opacity: 1;
    }
    #globalProgressBar.done .fill-bar {
      width: 100%;
      transition: width 0.12s ease, opacity 0.25s ease 0.1s;
      opacity: 0;
    }

    /* Remove any lingering green underlines */
    .nav-link::after,
    .nav-link:hover::after,
    .nav-link.active::after {
      display: none !important;
      content: none !important;
    }
    .nav-link.active {
      background-color: #e6f4ea !important;
      color: #047857 !important;
      font-weight: 700 !important;
      border-radius: 8px !important;
    }
  `;
  document.head.appendChild(style);

  // Global Progress Bar Controller
  let progressBar = null;
  function getProgressBar() {
    if (!progressBar) {
      progressBar = document.createElement('div');
      progressBar.id = 'globalProgressBar';
      progressBar.innerHTML = '<div class="fill-bar"></div>';
      document.body.appendChild(progressBar);
    }
    return progressBar;
  }

  window.showLoadingProgress = function() {
    const pb = getProgressBar();
    pb.classList.remove('done');
    pb.classList.add('loading');
    const fill = pb.querySelector('.fill-bar');
    if (fill) {
      fill.style.width = '0%';
      fill.style.opacity = '1';
      setTimeout(() => { if (pb.classList.contains('loading')) fill.style.width = '78%'; }, 10);
    }
  };

  window.hideLoadingProgress = function() {
    const pb = getProgressBar();
    pb.classList.remove('loading');
    pb.classList.add('done');
    const fill = pb.querySelector('.fill-bar');
    if (fill) fill.style.width = '100%';
    setTimeout(() => {
      pb.classList.remove('done');
      if (fill) fill.style.width = '0%';
    }, 400);
  };

  // Sync Auth State in Top Navigation Bar
  window.syncNavAuth = function() {
    const authActions = document.getElementById('navAuthActions');
    if (!authActions) return;

    let user = null;
    try {
      const raw = localStorage.getItem('umrah_user');
      if (raw) user = JSON.parse(raw);
    } catch(e) {}

    if (user && (user.email || user.name)) {
      const displayName = user.name || user.fullName || (user.email ? user.email.split('@')[0] : 'Pilgrim');
      const initial = displayName.trim().charAt(0).toUpperCase() || 'P';
      const isDashboardPage = window.location.pathname.includes('/dashboard');

      authActions.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.65rem;">
          <div onclick="window.location.href='/dashboard'" style="display:flex; align-items:center; gap:0.45rem; cursor:pointer; background:#f0fdf4; border:1px solid #bbf7d0; padding:4px 11px; border-radius:99px; transition:all 0.15s;" onmouseover="this.style.background='#dcfce7'" onmouseout="this.style.background='#f0fdf4'" title="Go to Pilgrim Dashboard">
            <span style="width:28px; height:28px; border-radius:50%; background:#1b633e; color:#ffffff; font-weight:800; font-size:0.8rem; display:flex; align-items:center; justify-content:center;">${initial}</span>
            <span style="font-weight:700; font-size:0.84rem; color:#064e3b; max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${displayName}</span>
          </div>
          <button type="button" onclick="localStorage.removeItem('umrah_user'); window.location.href='/';" style="background:#fee2e2; border:1px solid #fecaca; color:#dc2626; font-size:0.8rem; font-weight:700; padding:6px 12px; border-radius:8px; cursor:pointer; transition:background 0.15s;" onmouseover="this.style.background='#fca5a5'" onmouseout="this.style.background='#fee2e2'">
            Logout
          </button>
        </div>
      `;
    } else {
      authActions.innerHTML = `
        <button class="nav-btn btn-login" onclick="window.location.href='/login'">Login</button>
        <button class="nav-btn btn-signup" onclick="window.location.href='/signup'">Sign Up</button>
      `;
    }
  };

  // Setup Contact Us Scrolling & Link Loading Handlers
  function initNavEvents() {
    // Intercept contact links
    document.querySelectorAll('a[href*="footerContactSection"], .contact-scroll-link, a[href="/contact"]').forEach(link => {
      link.addEventListener('click', function(e) {
        const contactSec = document.getElementById('footerContactSection') || document.querySelector('footer');
        if (contactSec) {
          e.preventDefault();
          contactSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
          try { history.pushState(null, '', '/#footerContactSection'); } catch(err) {}
        } else {
          // If on a page without contact footer, navigate to home footer
          window.location.href = '/#footerContactSection';
        }
      });
    });

    // Handle initial hash scroll if arriving with #footerContactSection
    if (window.location.hash === '#footerContactSection') {
      setTimeout(() => {
        const el = document.getElementById('footerContactSection') || document.querySelector('footer');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 250);
    }

    // Intercept top nav page transitions to show instantaneous progress bar
    document.querySelectorAll('.nav-links a, .nav-menu a, .sidebar-nav button').forEach(link => {
      link.addEventListener('click', function() {
        const href = this.getAttribute('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          window.showLoadingProgress();
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.syncNavAuth();
      initNavEvents();
    });
  } else {
    window.syncNavAuth();
    initNavEvents();
  }
})();
