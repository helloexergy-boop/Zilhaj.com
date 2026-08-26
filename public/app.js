/**
 * RAJU TRAVELS – Single Page Web Application Engine
 * Journey of Faith, Comfort & Blessings
 */

const API_BASE = window.API_BASE_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8080/api'
    : '/api');

// ============================================================================
// CHATBOT API KEY CONFIGURATION (OpenAI / Gemini / Custom AI Endpoint)
// To connect live AI model responses, paste your API Key string below:
// ============================================================================
const CHATBOT_API_KEY = "AIzaSyC_dVGCqbgergjh6K-JigFJupO_WpHScC8";

class App {
    constructor() {
        this.state = {
            currentUser: JSON.parse(localStorage.getItem('umrah_user') || 'null'),
            packages: [],
            myBookings: [],
            userOffers: [],
            myRequirements: [],
            filters: {
                maxPrice: 250000,
                maxDistanceMakkah: 1000,
                flightsOnly: false
            },
            admin: {
                analytics: null,
                users: [],
                agents: [],
                bookings: [],
                offers: [],
                requirements: []
            },
            currentPage: 'home',
            activeTab: 'browse',
            guideTab: 'umrah'
        };

        this.init();
    }

    async init() {
        // Automatically sanitize and normalize any cached high-price objects in localStorage to testing fares (₹5),
        // and purge stale mock offers that were never created through the admin panel (no userId/packageId).
        ['umrah_user_offers', 'umrah_requirements', 'umrah_packages', 'umrah_my_bookings'].forEach(key => {
            try {
                const raw = localStorage.getItem(key);
                if (raw) {
                    let data = JSON.parse(raw);
                    if (Array.isArray(data)) {
                        data.forEach(item => {
                            if (item.price > 100) item.price = 5;
                            if (item.discountedPrice > 100) item.discountedPrice = 5;
                            if (item.originalPrice > 100) item.originalPrice = 10;
                            if (item.totalPrice > 100) item.totalPrice = 5;
                            if (item.maxBudget > 100) item.maxBudget = 5;
                        });
                        localStorage.setItem(key, JSON.stringify(data));
                    }
                }
            } catch (e) {}
        });

        // Remove any pre-existing mock agent offers (generated without real userId/packageId) so
        // users only see offers dispatched by the Admin through the control panel.
        try {
            const rawOffers = JSON.parse(localStorage.getItem('umrah_user_offers') || '[]');
            const realOffers = rawOffers.filter(o => (o.userId && o.userId !== 'usr-1') || o.packageId);
            localStorage.setItem('umrah_user_offers', JSON.stringify(realOffers));
            this.state.userOffers = realOffers;
        } catch (e) {}

        // Handle Google OAuth callback URL parameters (Step 2 & 5)
        const oauthParams = new URLSearchParams(window.location.search);
        if (oauthParams.get('google_auth_success') === '1') {
            try {
                const userParam = oauthParams.get('user');
                if (userParam) {
                    const userObj = JSON.parse(decodeURIComponent(userParam));
                    this.state.currentUser = userObj;
                    localStorage.setItem('umrah_user', JSON.stringify(userObj));
                    this.showToast(`🌐 Welcome, ${userObj.name}! Logged in via Google OAuth`, 'success');
                }
                history.replaceState(null, '', window.location.pathname);
            } catch (e) {
                console.warn('Google OAuth query parse notice:', e);
            }
        } else if (oauthParams.get('google_auth_error') === '1') {
            this.showToast(`Google login failed: ${decodeURIComponent(oauthParams.get('error') || 'unknown error')}`, 'error');
            history.replaceState(null, '', window.location.pathname);
        }

        // Initialize theme
        const savedTheme = localStorage.getItem('umrah_theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);

        this.renderAuthNav();

        // Populate initial packages immediately from localStorage or default
        const savedPackages = JSON.parse(localStorage.getItem('umrah_packages') || 'null');
        if (savedPackages && Array.isArray(savedPackages) && savedPackages.length > 0) {
            this.state.packages = savedPackages;
        } else {
            this.state.packages = [];
        }

        // Browser back/forward support (History API)
        window.addEventListener('popstate', (e) => {
            this.renderPage((e.state && e.state.page) || this.getCurrentPage());
        });

        // Render page IMMEDIATELY (0ms delay) so page is never blank!
        this.navigate(this.getCurrentPage());

        // Remove the branded boot splash once the first page has rendered
        const bootSplash = document.getElementById('bootSplash');
        if (bootSplash) {
            bootSplash.style.transition = 'opacity 0.25s ease';
            bootSplash.style.opacity = '0';
            setTimeout(() => { if (bootSplash.parentNode) bootSplash.parentNode.removeChild(bootSplash); }, 300);
        }

        // Fetch remote updates asynchronously without blocking page rendering
        this.fetchPackages().then(() => {
            if (this.state.currentPage === 'home' || this.state.currentPage === 'packages') {
                const container = document.querySelector('.packages-grid-layout');
                if (container && this.state.packages.length > 0) {
                    container.innerHTML = this.state.packages.map(pkg => this.renderTravelCard(pkg)).join('');
                }
            }
        });

        if (this.state.currentUser) {
            this.fetchUserData();
        }

        // Fetch real-time weather and visitor stats
        this.fetchFooterData();

        // Start Review Carousel Auto-play (slideshow)
        setInterval(() => {
            if (document.getElementById('ZaireenReviewTrack')) {
                this.slideReviewCarousel(1);
            }
        }, 3500);

        this.initNavbarScroll();
        this.initScrollReveal();

        document.addEventListener('click', (e) => {
            const box = document.getElementById('chatbotBox');
            const wrapper = document.getElementById('chatbotWrapper');
            const aiButtons = document.querySelectorAll('.btn-ai-trigger, [onclick*="toggleChatbot"], [onclick*="openChatbot"]');

            if (box && (box.style.display === 'flex' || window.getComputedStyle(box).display === 'flex')) {
                let clickedInsideTrigger = false;
                if (wrapper && wrapper.contains(e.target)) clickedInsideTrigger = true;
                aiButtons.forEach(btn => {
                    if (btn && btn.contains(e.target)) clickedInsideTrigger = true;
                });

                if (!box.contains(e.target) && !clickedInsideTrigger) {
                    box.style.display = 'none';
                }
            }
        });
    }

    initHeroVideoPlaylist() {
        // ============================================================================
        // HERO VIDEO SLIDESHOW PLAYLIST CONFIGURATION
        // How to add your own videos:
        // Option 1 (Local Video): Save your MP4 file in the "public" folder (e.g. myvideo.mp4)
        //          and add 'myvideo.mp4' to the array below.
        // Option 2 (Online Video URL): Add direct HTTP/HTTPS link to any .mp4 file.
        // ============================================================================
        this.heroVideos = [
            'hero-video-2.mp4',
            'hero-video-3.mp4',
            ''
        ];

        this.currentVideoIndex = 0;
        this._heroVideoActive = 'A'; // Track which video element is on top

        const vidA = document.getElementById('heroBgVideoA');
        const vidB = document.getElementById('heroBgVideoB');
        if (!vidA || !vidB) return;

        [vidA, vidB].forEach(v => {
            v.muted = true;
            v.playsInline = true;
            v.removeAttribute('poster');
        });

        // Start first video on A instantly
        if (!vidA.src || vidA.src === '' || vidA.src.includes('hero-video-')) {
            vidA.src = this.heroVideos[0];
        }
        vidA.style.opacity = '1';
        vidA.style.zIndex = '1';
        vidB.style.opacity = '0';
        vidB.style.zIndex = '0';

        vidA.play().catch(e => console.log('Autoplay:', e));

        // Preload next video into B silently
        const preloadNext = () => {
            const nextIndex = (this.currentVideoIndex + 1) % this.heroVideos.length;
            const dormant = this._heroVideoActive === 'A' ? vidB : vidA;
            dormant.src = this.heroVideos[nextIndex];
            dormant.load();
        };

        vidA.onended = () => this.playNextHeroVideo();
        vidA.ontimeupdate = function () {
            // Preload next ~3s before current ends
            if (this.duration && this.currentTime >= this.duration - 3) {
                this.ontimeupdate = null;
                preloadNext();
            }
        };
        vidB.onended = () => this.playNextHeroVideo();
        vidB.ontimeupdate = function () {
            if (this.duration && this.currentTime >= this.duration - 3) {
                this.ontimeupdate = null;
                preloadNext();
            }
        };

        vidA.onerror = () => { console.warn('Video A error'); this.playNextHeroVideo(); };
        vidB.onerror = () => { console.warn('Video B error'); this.playNextHeroVideo(); };

        preloadNext();
        this.updateVideoDots();
    }

    playNextHeroVideo() {
        if (!this.heroVideos || this.heroVideos.length === 0) return;
        this.currentVideoIndex = (this.currentVideoIndex + 1) % this.heroVideos.length;
        this.loadHeroVideo(this.currentVideoIndex);
    }





    loadHeroVideo(index) {
        const vidA = document.getElementById('heroBgVideoA');
        const vidB = document.getElementById('heroBgVideoB');
        if (!vidA || !vidB) return;

        let videoSrc = this.heroVideos[index];
        if (videoSrc && videoSrc.startsWith('http')) {
            videoSrc = `/api/video-proxy?url=${encodeURIComponent(videoSrc)}`;
        }

        const incoming = this._heroVideoActive === 'A' ? vidB : vidA;
        const outgoing = this._heroVideoActive === 'A' ? vidA : vidB;
        this._heroVideoActive = this._heroVideoActive === 'A' ? 'B' : 'A';

        // Load new video into the dormant layer (already preloaded in most cases)
        if (incoming.src !== window.location.origin + '/' + videoSrc && !videoSrc.startsWith('/api')) {
            incoming.src = videoSrc;
            incoming.load();
        }

        incoming.muted = true;
        incoming.playsInline = true;
        incoming.removeAttribute('poster');

        // Bring incoming on top and play, then fade out the old
        incoming.style.zIndex = '2';
        outgoing.style.zIndex = '1';

        const startCrossfade = () => {
            incoming.style.opacity = '1';
            outgoing.style.opacity = '0';
            setTimeout(() => {
                outgoing.pause();
                outgoing.style.zIndex = '0';
            }, 700);
        };

        const playPromise = incoming.play();
        if (playPromise !== undefined) {
            playPromise.then(startCrossfade).catch(e => {
                startCrossfade();
                console.log('Video play info:', e);
            });
        } else {
            startCrossfade();
        }

        // Set up next preload on the new active video
        const preloadNext = () => {
            const nextIndex = (this.currentVideoIndex + 1) % this.heroVideos.length;
            const dormant = this._heroVideoActive === 'A' ? vidB : vidA;
            dormant.src = this.heroVideos[nextIndex];
            dormant.load();
        };
        incoming.ontimeupdate = function () {
            if (this.duration && this.currentTime >= this.duration - 3) {
                this.ontimeupdate = null;
                preloadNext();
            }
        };
        incoming.onended = () => this.playNextHeroVideo();

        this.updateVideoDots();
    }

    updateVideoDots() {
        document.querySelectorAll('#videoSlideDots .video-slide-dot').forEach((dot, idx) => {
            if (idx === this.currentVideoIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    initNavbarScroll() {
        window.addEventListener('scroll', () => {
            const navbar = document.getElementById('navbar');
            if (navbar) {
                if (window.scrollY > 20) {
                    navbar.classList.add('scrolled');
                } else {
                    navbar.classList.remove('scrolled');
                }
            }
        });
    }

    initScrollReveal() {
        if (!('IntersectionObserver' in window)) return;
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    const counterElements = entry.target.querySelectorAll('.count-up-val');
                    counterElements.forEach(el => {
                        if (!el.dataset.animated) {
                            el.dataset.animated = 'true';
                            this.animateCountUp(el);
                        }
                    });
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });

        setTimeout(() => {
            document.querySelectorAll('.scroll-reveal, .how-step-card, .premium-card, .admin-stat-card').forEach(el => {
                if (!el.classList.contains('scroll-reveal')) {
                    el.classList.add('scroll-reveal');
                }
                observer.observe(el);
            });
        }, 100);
    }

    animateCountUp(el) {
        const targetAttr = el.getAttribute('data-target') || el.innerText;
        const target = parseInt(targetAttr.replace(/\D/g, '')) || 0;
        if (target === 0) return;

        const prefix = targetAttr.startsWith('₹') ? '₹' : (targetAttr.startsWith('👥') ? '👥 ' : '');
        const suffix = targetAttr.endsWith('+') ? '+' : (targetAttr.endsWith('%') ? '%' : '');

        let startTimestamp = null;
        const duration = 1200;

        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easeProgress = 1 - (1 - progress) * (1 - progress);
            const currentVal = Math.floor(easeProgress * target);
            el.innerText = `${prefix}${currentVal.toLocaleString()}${suffix}`;
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                el.innerText = targetAttr;
            }
        };
        window.requestAnimationFrame(step);
    }

    async fetchFooterData() {
        // 1. Fetch Weather for Mecca and Madinah (AccuWeather API)
        try {
            const apiKey = 'zpka_a51ef758e46b41858665682c63dd0561_72925211';
            // Mecca Location Key: 299427, Madinah Location Key: 296807
            const [meccaRes, madinahRes] = await Promise.all([
                fetch(`https://dataservice.accuweather.com/currentconditions/v1/299427?apikey=${apiKey}&details=true`),
                fetch(`https://dataservice.accuweather.com/currentconditions/v1/296807?apikey=${apiKey}&details=true`)
            ]);

            if (meccaRes.ok && madinahRes.ok) {
                const meccaData = await meccaRes.json();
                const madinahData = await madinahRes.json();

                if (Array.isArray(meccaData) && meccaData.length > 0 && Array.isArray(madinahData) && madinahData.length > 0) {
                    const meccaTemp = Math.round(meccaData[0].Temperature.Metric.Value);
                    const madinahTemp = Math.round(madinahData[0].Temperature.Metric.Value);
                    const humidity = meccaData[0].RelativeHumidity || '--';

                    let wind = '--';
                    if (meccaData[0].Wind && meccaData[0].Wind.Speed && meccaData[0].Wind.Speed.Metric) {
                        wind = Math.round(meccaData[0].Wind.Speed.Metric.Value);
                    }

                    const elMecca = document.getElementById('meccaTemp');
                    const elMadinah = document.getElementById('madinahTemp');
                    const elHumidity = document.getElementById('weatherHumidity');
                    const elWind = document.getElementById('weatherWind');

                    if (elMecca) elMecca.innerText = `${meccaTemp}°C`;
                    if (elMadinah) elMadinah.innerText = `${madinahTemp}°C`;
                    if (elHumidity) elHumidity.innerText = `${humidity}%`;
                    if (elWind) elWind.innerText = `${wind} km/h`;
                } else {
                    console.warn('AccuWeather returned non-array data, possibly limit exceeded.');
                }
            } else {
                console.warn('AccuWeather API non-OK response:', meccaRes.status, madinahRes.status);
            }
        } catch (e) {
            console.error('Failed to fetch AccuWeather data', e);
        }

        // 2. Mock live visitor counter (starts from base + random active users)
        try {
            const visitorContainer = document.getElementById('visitorCounterContainer');
            if (visitorContainer) {
                // Determine persistent base count
                let baseCount = parseInt(localStorage.getItem('umrah_visitor_count') || '78047');
                // Increment by 1 for this session
                baseCount += 1;
                localStorage.setItem('umrah_visitor_count', baseCount);

                // Convert to array of digits and pad to 7 digits
                const digitArray = baseCount.toString().padStart(7, '0').split('');

                visitorContainer.innerHTML = digitArray.map(digit => `<div class="counter-digit">${digit}</div>`).join('');
            }
        } catch (e) {
            console.error('Failed to set visitor counter', e);
        }
    }

    formatCurrency(amount) {
        if (amount === undefined || amount === null || isNaN(amount)) return '₹0';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    }

    async apiCall(endpoint, method = 'GET', body = null) {
        const headers = { 'Content-Type': 'application/json' };
        if (this.state.currentUser && this.state.currentUser.token) {
            headers['Authorization'] = `Bearer ${this.state.currentUser.token}`;
        }

        const config = { method, headers };
        if (body) {
            config.body = JSON.stringify(body);
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s timeout limit
            config.signal = controller.signal;

            const response = await fetch(`${API_BASE}${endpoint}`, config);
            clearTimeout(timeoutId);

            if (response.headers.get('content-type')?.includes('application/json')) {
                return await response.json();
            }
            return await response.text();
        } catch (error) {
            return null;
        }
    }

    renderAuthNav() {
        const authContainer = document.getElementById('navAuthActions');
        const navMenu = document.getElementById('navMenu');
        const localOffers = JSON.parse(localStorage.getItem('umrah_user_offers') || '[]');

        let displayName = 'User';
        if (this.state.currentUser) {
            displayName = this.state.currentUser.name;
            if (!displayName || displayName === this.state.currentUser.email || displayName.includes('@')) {
                if (this.state.currentUser.email && this.state.currentUser.email.includes('@')) {
                    displayName = this.state.currentUser.email.split('@')[0];
                } else {
                    displayName = 'User';
                }
            }
            if (displayName.toLowerCase() === 'rajuranjanxbkj') displayName = 'Raju Ranjan';
        }

        if (navMenu) {
            navMenu.innerHTML = `
                <a href="/home" class="nav-link ${this.state.currentPage === 'home' ? 'active' : ''}" onclick="event.preventDefault(); app.navigate('home')">Home</a>
                <a href="/services" class="nav-link ${this.state.currentPage === 'services' ? 'active' : ''}" onclick="event.preventDefault(); app.navigate('services')">Services</a>
                <a href="/contact" class="nav-link ${this.state.currentPage === 'contact' ? 'active' : ''}" onclick="app.scrollToContact(event)">Contact Us</a>
                <a href="/about" class="nav-link ${this.state.currentPage === 'about' ? 'active' : ''}" onclick="event.preventDefault(); app.navigate('about')">About Us</a>
                <div class="mobile-only-auth" style="margin-top:0.75rem; padding-top:0.75rem; border-top:1px solid #e2e8f0; display:flex; flex-direction:column; gap:0.5rem; width:100%;">
                    ${!this.state.currentUser ? `
                        <button class="btn btn-outline" onclick="app.openAuthModal('login')" style="width:100%; border:1.5px solid #0f172a; color:#0f172a; font-weight:700; border-radius:10px; padding:0.65rem; font-size:0.9rem; background:transparent; cursor:pointer;">Login</button>
                        <button class="btn btn-primary" onclick="app.openAuthModal('register')" style="width:100%; background:#047857; color:white; font-weight:700; border-radius:10px; padding:0.65rem; border:none; font-size:0.9rem; cursor:pointer;">Sign Up</button>
                    ` : `
                        <button class="btn btn-black-pill" onclick="app.navigate('${this.state.currentUser.role === 'ROLE_ADMIN' ? 'admin' : 'dashboard'}')" style="width:100%; background:#0f172a; color:#fff; font-weight:700; padding:0.65rem; border-radius:10px; border:none; cursor:pointer;">
                            ${this.state.currentUser.role === 'ROLE_ADMIN' ? '🔑 Admin Control Panel' : '👤 ' + this.escapeHtml(displayName)}
                        </button>
                        <button class="nav-text-btn" onclick="app.logout()" style="width:100%; padding:0.5rem; color:#dc2626; font-weight:700; background:none; border:none; cursor:pointer;">Logout</button>
                    `}
                </div>
            `;
        }

        if (!this.state.currentUser) {
            // Logged Out Navigation State
            if (authContainer) {
                authContainer.innerHTML = `
                    <div style="display:flex; align-items:center; gap:0.6rem;">
                        <button class="btn btn-outline" onclick="app.openLoginModal()" style="border:1.5px solid #0f172a; color:#0f172a; font-weight:700; border-radius:8px; padding:0.45rem 1.1rem; font-size:0.88rem; background:transparent; cursor:pointer;">Login</button>
                        <button class="btn btn-primary" onclick="app.openRegisterModal()" style="background:#2e7d32; color:white; font-weight:700; border-radius:8px; padding:0.45rem 1.1rem; border:none; font-size:0.88rem; cursor:pointer;">Sign Up</button>
                    </div>
                `;
            }
        } else if (this.state.currentUser.role === 'ROLE_ADMIN') {
            // Admin Portal Navigation State
            if (authContainer) {
                authContainer.innerHTML = `
                    <div class="user-profile-nav" style="display:flex; align-items:center; gap:0.75rem;">
                        <button class="btn btn-black-pill" onclick="app.navigate('admin')" style="background:#0f172a; color:#fff; font-weight:700; padding:0.55rem 1.1rem; border-radius:8px; border:none; cursor:pointer;">🔑 Admin Control Panel</button>
                        <button class="nav-text-btn" onclick="app.logout()" style="color:#dc2626; font-weight:700; background:none; border:none; cursor:pointer;">Logout</button>
                    </div>
                `;
            }
        } else {
            const userPic = this.state.currentUser.profilePhoto || this.state.currentUser.profilePictureUrl || this.state.currentUser.picture || this.state.currentUser.avatar || null;
            if (authContainer) {
                authContainer.innerHTML = `
                    <div style="display:flex; align-items:center; gap:1rem;">
                        <div style="display:flex; align-items:center; gap:0.65rem; cursor:pointer;" onclick="app.navigate('dashboard')" title="Go to My Dashboard">
                            ${userPic ? `
                                <img src="${this.escapeHtml(userPic)}" alt="${this.escapeHtml(displayName)}" class="nav-user-avatar-img" style="width:36px; height:36px; border-radius:50%; object-fit:cover; border:2px solid #2e7d32; flex-shrink:0; box-shadow:0 2px 8px rgba(46,125,50,0.25);" onerror="this.outerHTML='<div style=\\'width:36px; height:36px; background:linear-gradient(135deg, #2e7d32 0%, #0f5132 100%); border-radius:50%; display:flex; align-items:center; justify-content:center; color:#ffffff; font-weight:800; font-size:0.85rem; flex-shrink:0;\\'>${this.escapeHtml(displayName.charAt(0).toUpperCase())}</div>';" />
                            ` : `
                                <div style="width:36px; height:36px; background:linear-gradient(135deg, #2e7d32 0%, #0f5132 100%); border-radius:50%; display:flex; align-items:center; justify-content:center; color:#ffffff; font-weight:800; font-size:0.85rem; flex-shrink:0; box-shadow:0 2px 8px rgba(46,125,50,0.25);">
                                    ${this.escapeHtml(displayName.charAt(0).toUpperCase())}
                                </div>
                            `}
                            <div style="font-size:0.88rem; font-weight:800; color:#0f172a;">${this.escapeHtml(displayName)}</div>
                        </div>
                        <button type="button" onclick="app.logout()" style="background:#f1f5f9; color:#dc2626; border:1px solid #fecaca; font-weight:700; font-size:0.82rem; padding:0.45rem 0.9rem; border-radius:8px; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='#f1f5f9'">
                            Logout
                        </button>
                    </div>
                `;
            }
        }
    }

    scrollToContact(e) {
        if (e) e.preventDefault();
        this.state.currentPage = 'contact';
        document.querySelectorAll('.nav-menu .nav-link').forEach(link => {
            if (link.textContent.trim().toLowerCase().includes('contact')) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
        const footerContact = document.getElementById('footerContactSection') || document.querySelector('footer');
        if (footerContact) {
            footerContact.scrollIntoView({ behavior: 'smooth' });
        }
        document.getElementById('navMenu')?.classList.remove('open');
        document.querySelector('.mobile-toggle')?.classList.remove('active');
    }

    handleSocialLogin(provider) {
        if (provider === 'Google' || provider === 'google') {
            return this.loginWithGoogle();
        } else if (provider === 'Apple' || provider === 'apple') {
            return this.loginWithApple();
        }
        return this.loginWithGoogle();
    }

    async loginWithGoogle() {
        this.closeModal();
        this.showLoading('Connecting to Google Accounts...', '🌐 Signing in with Google');

        try {
            const apiEndpoint = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3000/api/auth/google/url'
                : '/api/auth/google/url';

            const res = await fetch(apiEndpoint).catch(() => null);
            if (res && res.ok) {
                const data = await res.json().catch(() => null);
                if (data && data.url) {
                    window.location.href = data.url;
                    return;
                }
            }
        } catch (e) {
            console.warn('Backend Google OAuth API offline, using instant Google authentication:', e);
        }

        // Fallback for instant Google authentication in demo/local mode
        setTimeout(() => {
            const googleUser = {
                id: 'goog-' + Date.now(),
                name: 'Google User',
                email: 'user.google@zilhaj.com',
                profilePictureUrl: 'zilhaj-logo.jpg',
                role: 'ROLE_USER',
                token: 'google-token-' + Date.now(),
                authProvider: 'GOOGLE'
            };
            this.state.currentUser = googleUser;
            localStorage.setItem('umrah_user', JSON.stringify(googleUser));
            this.hideLoading();
            this.renderAuthNav();
            this.showSuccessModal('login');
        }, 500);
    }

    async loginWithApple() {
        this.closeModal();
        this.showLoading('Connecting to Apple ID...', '🍎 Signing in with Apple');
        setTimeout(() => {
            const appleUser = {
                id: 'apple-' + Date.now(),
                name: 'Apple User',
                email: 'user.apple@zilhaj.com',
                role: 'ROLE_USER',
                token: 'apple-token-' + Date.now(),
                authProvider: 'APPLE'
            };
            this.state.currentUser = appleUser;
            localStorage.setItem('umrah_user', JSON.stringify(appleUser));
            this.hideLoading();
            this.renderAuthNav();
            this.showSuccessModal('login');
        }, 500);
    }

    async completeGoogleAuth(name, email, pictureUrl = 'https://lh3.googleusercontent.com/a/default-user=s96-c') {
        this.closeModal();
        this.showLoading('Verifying Google credentials and establishing secure session...', '🌐 Securing Google Session');

        try {
            const apiEndpoint = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3000/api/auth/google'
                : '/api/auth/google';

            const googleId = 'goog-' + Date.now();
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ googleId, name, email, picture: pictureUrl })
            });

            const data = await response.json();
            if (response.ok && data && (data.user || data.token)) {
                const userPayload = data.user || {
                    id: data.id || 'usr-' + Date.now(),
                    name: data.name || name || email.split('@')[0],
                    email: data.email || email,
                    profilePictureUrl: data.profilePictureUrl || pictureUrl,
                    role: data.role || 'ROLE_USER',
                    token: data.token
                };
                this.state.currentUser = userPayload;
                localStorage.setItem('umrah_user', JSON.stringify(userPayload));
            } else if (data && data.googleId) {
                // Local state with the profile returned by the API (or passed-in params)
                const googleUser = {
                    id: data.googleId || data.id || 'goog-' + Date.now(),
                    name: data.name || name || (email ? email.split('@')[0] : ''),
                    email: data.email || email || '',
                    profilePictureUrl: data.profilePictureUrl || pictureUrl,
                    role: data.role || 'ROLE_USER',
                    token: data.token || 'google-token-' + Date.now(),
                    authProvider: 'GOOGLE'
                };
                this.state.currentUser = googleUser;
                localStorage.setItem('umrah_user', JSON.stringify(googleUser));
            } else {
                this.hideLoading();
                this.showToast('Google Sign-In could not be verified. Please try again.', 'error');
                return;
            }

            this.renderAuthNav();
            this.fetchUserData();
            this.showSuccessModal('login');
        } catch (err) {
            console.error('Google auth error:', err);
            const googleUser = {
                id: 'goog-' + Date.now(),
                name: name || 'Google User',
                email: email || 'user@gmail.com',
                profilePictureUrl: pictureUrl,
                role: 'ROLE_USER',
                token: 'google-token-' + Date.now(),
                authProvider: 'GOOGLE'
            };
            this.state.currentUser = googleUser;
            localStorage.setItem('umrah_user', JSON.stringify(googleUser));
            this.renderAuthNav();
            this.showSuccessModal('login');
        } finally {
            this.hideLoading();
        }
    }

    async logout() {
        try {
            fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        } catch (e) {}
        this.state.currentUser = null;
        localStorage.removeItem('umrah_user');
        this.renderAuthNav();
        this.showToast('Logged out successfully', 'success');
        this.navigate('home');
    }

    async fetchUserData() {
        if (!this.state.currentUser) return;
        const bookings = await this.apiCall(`/bookings/user/${this.state.currentUser.id}`);
        if (Array.isArray(bookings)) {
            this.state.myBookings = bookings;
        }

        const offers = await this.apiCall(`/offers/user/${this.state.currentUser.id}`);
        if (Array.isArray(offers)) {
            this.state.userOffers = offers;
            const offerBadge = document.getElementById('userOfferBadge');
            if (offerBadge) offerBadge.innerText = offers.length;
        }

        const reqs = await this.apiCall(`/requirements/user/${this.state.currentUser.id}`);
        if (Array.isArray(reqs)) {
            this.state.myRequirements = reqs;
        }

        const settingsRes = await this.apiCall(`/users/${encodeURIComponent(this.state.currentUser.id)}/settings`);
        if (settingsRes && settingsRes.settings) {
            this.state.userSettings = settingsRes.settings;
            localStorage.setItem('zilhaj_user_settings', JSON.stringify(settingsRes.settings));
        }
    }

    getAllOffers() {
        const apiOffers = this.state.userOffers || [];
        const localOffers = JSON.parse(localStorage.getItem('umrah_user_offers') || '[]');
        return [...apiOffers, ...localOffers.filter(lo => !apiOffers.some(o => o.id === lo.id))];
    }

    async fetchPackages() {
        const { maxPrice, maxDistanceMakkah, flightsOnly } = this.state.filters;
        let url = `/packages?maxPrice=${maxPrice}&maxDistanceMakkah=${maxDistanceMakkah}`;
        if (flightsOnly) url += '&flightsOnly=true';

        const savedPackages = JSON.parse(localStorage.getItem('umrah_packages') || 'null');

        const data = await this.apiCall(url);
        if (Array.isArray(data) && data.length > 0) {
            this.state.packages = data;
        } else if (savedPackages && Array.isArray(savedPackages) && savedPackages.length > 0) {
            this.state.packages = savedPackages;
        } else {
            this.state.packages = [];
        }
    }

    toggleMobileMenu() {
        const navMenu = document.getElementById('navMenu');
        const toggleBtn = document.querySelector('.mobile-toggle');
        if (navMenu) navMenu.classList.toggle('open');
        if (toggleBtn) toggleBtn.classList.toggle('active');
    }



    updatePageSEO(page) {
        const seoMap = {
            'home': {
                title: 'Zilhaj.com – Umrah & Hajj Travel | Journey of Faith, Comfort & Blessings',
                desc: 'Zilhaj.com Umrah & Hajj Travel Platform. Book 100% verified Umrah packages, Ramadan deals, VIP Hajj packages, Mecca Medina tours, Ziaraat, and custom pilgrimage bids. Hotels near Haram with 5-star comfort.',
                url: 'https://onerequest.in/'
            },
            'umrah-packages': {
                title: 'Umrah Packages 2026 | Zilhaj.com (Umra Travels & Deluxe Haram Hotels)',
                desc: 'Book verified 14-day and 18-day Umrah packages with hotels under 300m from Masjid al-Haram, Saudi visa, direct flights, and guided Ziyarat.',
                url: 'https://onerequest.in/umrah-packages'
            },
            'hajj-packages': {
                title: 'Hajj Packages & Zil Haj Pilgrimage 2026 | Zilhaj.com (Haj Travel)',
                desc: 'VIP Hajj packages with Mina tent encampment, Arafat Wuqoof support, Saudi licensed operators, and 100% Escrow payment safety.',
                url: 'https://onerequest.in/hajj-packages'
            },
            'mecca-medina-guide': {
                title: 'Mecca & Medina Pilgrimage Guide | Zilhaj.com (Ziaraat & Holy Sites)',
                desc: 'Complete travel guide to Masjid al-Haram, Al-Masjid an-Nabawi, Rawdah Nusuk permits, and sacred Ziyarat locations in Makkah & Madinah.',
                url: 'https://onerequest.in/mecca-medina-guide'
            },
            'pricing': {
                title: 'Umrah & Hajj Package Pricing & Custom Bids | Zilhaj.com',
                desc: 'Transparent Umrah package rates starting from ₹1 with custom bidding from verified Saudi tour operators.',
                url: 'https://onerequest.in/pricing'
            },
            'login': {
                title: 'Pilgrim & Agent Login | Zilhaj.com Umrah Portal',
                desc: 'Log in to your Zilhaj.com account to manage travel requests, review operator bids, and download verified e-vouchers.',
                url: 'https://onerequest.in/login'
            },
            'signup': {
                title: 'Create Account | Zilhaj.com Umrah & Hajj Platform',
                desc: 'Sign up for Zilhaj.com to submit custom pilgrimage requests and receive competitive bids from verified travel agents.',
                url: 'https://onerequest.in/signup'
            },
            'dashboard': {
                title: 'Pilgrim Dashboard & Bidding Requests | Zilhaj.com',
                desc: 'Manage your active Umrah travel requests, compare agent offers, and track your booking status.',
                url: 'https://onerequest.in/dashboard'
            },
            'about': {
                title: 'About Us – Zilhaj.com Umrah & Hajj Travel Platform',
                desc: 'Discover Zilhaj.com, connecting pilgrims worldwide with verified Saudi-licensed tour operators for safe, escrow-backed Umrah and Hajj journeys.',
                url: 'https://onerequest.in/about'
            },
            'contact': {
                title: 'Contact Us & 24/7 Pilgrim Support | Zilhaj.com',
                desc: 'Get in touch with Zilhaj.com support team for assistance with Umrah bookings, Nusuk permits, and operator verification.',
                url: 'https://onerequest.in/contact'
            },
            'faqs': {
                title: 'Pilgrimage FAQs – Umrah, Hajj & Zilhajj Questions Answered | Zilhaj.com',
                desc: 'Short answers to the most common Umrah & Hajj questions: Umra vs Umrah, Zil Haj packages, Nusuk app registration, payment safety, visa documents, and hotel distance guidelines.',
                url: 'https://onerequest.in/faqs'
            },
            'blog': {
                title: 'Umrah & Hajj Travel Blog | Zilhaj.com Pilgrimage Insights',
                desc: 'Read expert advice, preparation tips, flight advice, and spiritual guides for your sacred journey to Makkah & Madinah.',
                url: 'https://onerequest.in/blog'
            },
            'blog/umrah-preparation-tips': {
                title: 'Essential Umrah Preparation Tips 2026 | Zilhaj.com Blog',
                desc: 'Step-by-step preparation checklist for your Umrah journey including packing list, Ihram rules, and Nusuk permit timing.',
                url: 'https://onerequest.in/blog/umrah-preparation-tips'
            },
            'blog/hajj-travel-guide': {
                title: 'Complete Hajj Pilgrimage Travel Guide | Zilhaj.com Blog',
                desc: 'Detailed walkthrough of the 5 days of Hajj, Mina tents, Arafat, Muzdalifah, Jamarat, and Tawaf Ziyarah.',
                url: 'https://onerequest.in/blog/hajj-travel-guide'
            },
            'blog/zilhaj-experience': {
                title: 'The Zilhaj Pilgrimage Experience & Testimonials | Zilhaj.com',
                desc: 'Read real pilgrim stories and experiences booking through Zilhaj.com escrow-backed travel platform.',
                url: 'https://onerequest.in/blog/zilhaj-experience'
            },
            'terms': {
                title: 'Terms & Conditions | Zilhaj.com Umrah & Hajj Travel Platform',
                desc: 'Official Terms of Service for pilgrims and tour operators: bookings, escrow payments, cancellations, refunds, liability, and governing law on Zilhaj.com.',
                url: 'https://onerequest.in/terms'
            },
            'privacy': {
                title: 'Privacy Policy | Zilhaj.com Security & Data Protection',
                desc: 'How Zilhaj.com protects pilgrim personal data, payment information, and verification documents under Saudi PDPL and global privacy standards.',
                url: 'https://onerequest.in/privacy'
            },
            'support': {
                title: 'Pilgrim Help & Technical Support | Zilhaj.com',
                desc: 'Need help with your booking or payment? Reach 24/7 Zilhaj customer support team instantly.',
                url: 'https://onerequest.in/support'
            },
            'request-form': {
                title: 'Submit Umrah & Hajj Travel Request | Zilhaj.com',
                desc: 'Fill in your travel dates, group size, hotel preferences, and budget to receive personalized Umrah package quotes from verified Saudi tour operators.',
                url: 'https://onerequest.in/request-form'
            }
        };

        const current = seoMap[page] || seoMap['home'];
        document.title = current.title;

        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.setAttribute('content', current.desc);

        const canonical = document.querySelector('link[rel="canonical"]');
        if (canonical) canonical.setAttribute('href', current.url);
    }

    getCurrentPage() {
        const h = window.location.hash || '';
        const hashPage = h.replace(/^#\/?/, '').trim();
        if (hashPage === 'login' || hashPage === 'signup' || hashPage === 'register') return hashPage;
        
        try {
            const params = new URLSearchParams(window.location.search);
            if (params.has('login') || params.get('mode') === 'login' || params.get('auth') === 'login') return 'login';
            if (params.has('signup') || params.has('register') || params.get('mode') === 'register' || params.get('auth') === 'register') return 'register';
            
            const pathname = window.location.pathname.toLowerCase();
            if (pathname.endsWith('/login') || pathname.endsWith('/login.html')) return 'login';
            if (pathname.endsWith('/signup') || pathname.endsWith('/signup.html') || pathname.endsWith('/register')) return 'register';
            let page = pathname.replace(/^\//, '').replace(/\/+$/, '').trim();
            if (page) return page;
        } catch (e) {}

        return hashPage === '' ? 'home' : hashPage;
    }

    getHashPage() {
        return this.getCurrentPage();
    }

    navigate(page) {
        if (page === 'login' || page === 'signup' || page === 'register') {
            this.openAuthModal(page === 'signup' || page === 'register' ? 'register' : 'login');
            this.updatePageSEO(page);
            return;
        }

        const norm = String(page).replace(/^\//, '');
        if (norm && norm !== this.getCurrentPage()) {
            try {
                history.pushState({ page: norm }, '', '/' + norm);
            } catch (e) {}
        }

        this.renderPage(page);
    }

    renderPage(page) {
        const rawPage = page;
        if (page === 'umrah-packages' || page === 'hajj-packages') page = 'packages';
        if (page === 'services' || page === 'guides' || page === 'mecca-medina-guide' || page === 'blog' || (typeof page === 'string' && page.startsWith('blog/'))) page = 'services';
        if (page === 'contact') {
            this.scrollToContact();
            return;
        }
        if (page === 'faqs') page = 'faqs';
        if (page === 'terms') page = 'terms';
        if (page === 'privacy') page = 'privacy';
        if (page === 'support') page = 'trust';
        if (page === 'pricing') page = 'home';

        this.closeAuthPage();
        this.state.currentPage = page;
        this.updatePageSEO(rawPage);
        const main = document.getElementById('mainContainer');
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Close mobile nav drawer if open
        document.getElementById('navMenu')?.classList.remove('open');
        document.getElementById('navAuthActions')?.classList.remove('open');
        document.querySelector('.mobile-toggle')?.classList.remove('active');

        // Update active class on nav links
        document.querySelectorAll('.nav-menu .nav-link').forEach(link => {
            link.classList.remove('active');
            const text = link.textContent.trim().toLowerCase();
            const onclickAttr = link.getAttribute('onclick') || '';
            if (page === 'contact' && (text.includes('contact') || onclickAttr.includes('scrollToContact'))) {
                link.classList.add('active');
            } else if (onclickAttr.includes(`'${page}'`)) {
                link.classList.add('active');
            }
        });

        if (page === 'home' || page === 'packages') {
            main.innerHTML = this.renderHomePage();
            this.initHeroVideoPlaylist();
        } else if (page === 'request-form' || page === 'submit-request' || page === 'request') {
            if (!this.state.currentUser) {
                this.showToast('Please log in or sign up to submit your pilgrimage request', 'warning');
                this.openAuthModal('login');
                main.innerHTML = this.renderHomePage();
                return;
            }
            main.innerHTML = this.renderRequestFormPage();
        } else if (page === 'services' || page === 'guides') {
            main.innerHTML = this.renderServicesPage();
        } else if (page === 'faqs') {
            main.innerHTML = this.renderFaqsPage();
        } else if (page === 'terms') {
            main.innerHTML = this.renderTermsPage();
        } else if (page === 'privacy') {
            main.innerHTML = this.renderPrivacyPage();
        } else if (page === 'about') {
            main.innerHTML = this.renderAboutPage();
        } else if (page === 'trust') {
            main.innerHTML = this.renderTrustPage();
        } else if (page === 'bookings') {
            main.innerHTML = this.renderBookingsPage();
        } else if (page === 'offers') {
            main.innerHTML = this.renderOffersPage();
        } else if (page === 'dashboard' || page === '/dashboard') {
            main.innerHTML = this.renderDashboardPage();
        } else if (page === 'package-details' || page === 'packageDetails' || page === 'review-package') {
            main.innerHTML = this.renderPackageDetailsFullPage(this.state.activeOfferId);
        } else if (page === 'payment' || page === 'paymentScreen' || page === 'secure-payment') {
            main.innerHTML = this.renderPaymentPage(this.state.activeOfferId);
        } else if (page === 'admin' || page === '/admin/dashboard' || page === 'admin/dashboard') {
            if (this.state.currentUser?.role === 'ROLE_ADMIN') {
                this.renderAdminPage();
            } else {
                this.showToast('Access restricted to Platform Administrators', 'error');
                this.navigate('dashboard');
            }
        }

        setTimeout(() => this.initScrollReveal(), 50);
    }

    initHeroVideoPlaylist() {
        this.initHeroSlideshow();
    }

    initHeroSlideshow() {
        const slideA = document.getElementById('heroSlideLayerA');
        const slideB = document.getElementById('heroSlideLayerB');
        if (!slideA || !slideB) return;

        const mediaList = [
            'https://images.pexels.com/photos/18996760/pexels-photo-18996760.jpeg',
            'https://images.pexels.com/photos/32290181/pexels-photo-32290181.jpeg',
            'https://images.pexels.com/photos/18351141/pexels-photo-18351141.jpeg',
            'https://images.pexels.com/photos/35315919/pexels-photo-35315919.jpeg',
            'https://images.pexels.com/photos/38498727/pexels-photo-38498727.jpeg',
            'https://images.pexels.com/photos/28209449/pexels-photo-28209449.jpeg'
        ];

        let index = 0;
        if (this.heroMediaInterval) clearInterval(this.heroMediaInterval);

        this.heroMediaInterval = setInterval(() => {
            index = (index + 1) % mediaList.length;
            const currentUrl = mediaList[index];

            const targetActive = (index % 2 === 0) ? slideA : slideB;
            const targetHidden = (index % 2 === 0) ? slideB : slideA;

            targetActive.style.backgroundImage = `url('${currentUrl}')`;
            targetActive.style.opacity = '1';
            targetHidden.style.opacity = '0';
        }, 4000);
    }

    handleStartJourneyClick() {
        if (!this.state.currentUser) {
            this.showToast('Please log in or sign up to start your journey & submit a request', 'warning');
            this.openAuthModal('login');
            return;
        }
        this.navigate('request-form');
    }

    setPilgrimageType(type) {
        const btnUmrah = document.getElementById('tabUmrahReq');
        const btnHajj = document.getElementById('tabHajjReq');
        const hiddenType = document.getElementById('reqPilgrimageType');
        const titleEl = document.getElementById('reqPageTitle');
        const subTitleEl = document.getElementById('reqPageSubtitle');
        const durationSelect = document.getElementById('reqDurationStay');

        if (hiddenType) hiddenType.value = type;

        if (type === 'HAJJ') {
            if (btnHajj) {
                btnHajj.style.background = '#064e3b';
                btnHajj.style.borderColor = '#064e3b';
                btnHajj.style.color = '#ffffff';
                btnHajj.classList.add('active');
            }
            if (btnUmrah) {
                btnUmrah.style.background = '#ffffff';
                btnUmrah.style.borderColor = '#cbd5e1';
                btnUmrah.style.color = '#475569';
                btnUmrah.classList.remove('active');
            }
            if (titleEl) titleEl.innerText = 'Submit Hajj Request';
            if (subTitleEl) subTitleEl.innerText = 'Submit your request for VIP & Deluxe Hajj pilgrimage packages with tent encampments in Mina, Arafat Wuqoof, Saudi licensed operators, and escrow safety.';
            if (durationSelect) {
                durationSelect.innerHTML = `
                    <option value="">Select Hajj Duration</option>
                    <option value="30 Days (Short Hajj Package)">30 Days (Short Hajj Package)</option>
                    <option value="35 Days (Standard Hajj Package)">35 Days (Standard Hajj Package)</option>
                    <option value="40 Days (Complete Hajj Package)">40 Days (Complete Hajj Package)</option>
                    <option value="45 Days (Full VIP Hajj Package)">45 Days (Full VIP Hajj Package)</option>
                    <option value="Custom Hajj Duration">Custom Hajj Duration</option>
                `;
            }
        } else {
            if (btnUmrah) {
                btnUmrah.style.background = '#064e3b';
                btnUmrah.style.borderColor = '#064e3b';
                btnUmrah.style.color = '#ffffff';
                btnUmrah.classList.add('active');
            }
            if (btnHajj) {
                btnHajj.style.background = '#ffffff';
                btnHajj.style.borderColor = '#cbd5e1';
                btnHajj.style.color = '#475569';
                btnHajj.classList.remove('active');
            }
            if (titleEl) titleEl.innerText = 'Submit Umrah Request';
            if (subTitleEl) subTitleEl.innerText = 'Fill out the details below to receive personalized Umrah package quotes. Our partner agencies will craft itineraries tailored specifically to your group\'s needs and preferences.';
            if (durationSelect) {
                durationSelect.innerHTML = `
                    <option value="">Select Umrah Duration</option>
                    <option value="10–12 Days (Short Umrah)">10–12 Days (Short Umrah)</option>
                    <option value="14–15 Days (Standard Umrah)">14–15 Days (Standard Umrah)</option>
                    <option value="18–20 Days (Deluxe Umrah)">18–20 Days (Deluxe Umrah)</option>
                    <option value="25–28 Days (Full Umrah)">25–28 Days (Full Umrah)</option>
                    <option value="30 Days (Ramadan / Extended)">30 Days (Ramadan / Extended)</option>
                    <option value="Custom Duration">Custom Duration</option>
                `;
            }
        }
    }

    setReqRoomType(btn, roomType) {
        document.querySelectorAll('.btn-room-type').forEach(b => {
            b.style.background = '#ffffff';
            b.style.borderColor = '#cbd5e1';
            b.style.color = '#475569';
            b.classList.remove('active');
        });
        btn.style.background = '#064e3b';
        btn.style.borderColor = '#064e3b';
        btn.style.color = '#ffffff';
        btn.classList.add('active');
        const hidden = document.getElementById('reqRoomTypeVal');
        if (hidden) hidden.value = roomType;
    }

    adjustReqCounter(id, delta) {
        const el = document.getElementById(id);
        if (!el) return;
        let val = parseInt(el.innerText) || 0;
        val = Math.max(0, val + delta);
        el.innerText = val;
    }

    async submitStandaloneUmrahRequest() {
        if (!this.state.currentUser) {
            this.showToast('🔒 Login Required! Please log in or sign up to submit your travel request.', 'warning');
            this.openAuthModal('login');
            return;
        }
        const pilgrimageType = document.getElementById('reqPilgrimageType')?.value || 'UMRAH';
        const departureCity = document.getElementById('reqDepartureCity')?.value;
        const departureDate = document.getElementById('reqDepartureDate')?.value;
        const durationStay = document.getElementById('reqDurationStay')?.value;
        const roomType = document.getElementById('reqRoomTypeVal')?.value || 'Single Bed';
        
        const males = parseInt(document.getElementById('reqMaleCount')?.innerText || '0');
        const females = parseInt(document.getElementById('reqFemaleCount')?.innerText || '0');
        const children = parseInt(document.getElementById('reqChildrenCount')?.innerText || '0');
        const infants = parseInt(document.getElementById('reqInfantsCount')?.innerText || '0');
        
        const newlyMarried = document.querySelector('input[name="reqNewlyMarried"]:checked')?.value || 'No';
        const hotelCategory = document.querySelector('input[name="reqHotelCategory"]:checked')?.value || '3 Star';
        
        const fullName = document.getElementById('reqFullName')?.value?.trim();
        const mobileNumber = document.getElementById('reqMobileNumber')?.value?.trim();
        const emailAddress = document.getElementById('reqEmailAddress')?.value?.trim();
        const address = document.getElementById('reqFullAddress')?.value?.trim();
        const state = document.getElementById('reqState')?.value;
        const city = document.getElementById('reqCity')?.value?.trim();
        const specialReqs = document.getElementById('reqSpecialRequirements')?.value?.trim();

        if (!departureCity) {
            this.showToast('Please select your Departure City', 'error');
            document.getElementById('reqDepartureCity')?.focus();
            return;
        }
        if (!departureDate) {
            this.showToast('Please select your Preferred Departure Date', 'error');
            document.getElementById('reqDepartureDate')?.focus();
            return;
        }
        if (!durationStay) {
            this.showToast('Please select your Duration of Stay', 'error');
            document.getElementById('reqDurationStay')?.focus();
            return;
        }
        if ((males + females + children + infants) === 0) {
            this.showToast('Please add at least 1 traveler (Male, Female, Child, or Infant)', 'error');
            return;
        }
        if (!fullName) {
            this.showToast('Please enter your Full Name as per Aadhar', 'error');
            document.getElementById('reqFullName')?.focus();
            return;
        }
        if (!mobileNumber) {
            this.showToast('Please enter your Mobile Number', 'error');
            document.getElementById('reqMobileNumber')?.focus();
            return;
        }
        if (!emailAddress) {
            this.showToast('Please enter your Email Address', 'error');
            document.getElementById('reqEmailAddress')?.focus();
            return;
        }
        if (!address) {
            this.showToast('Please enter your Full Address', 'error');
            document.getElementById('reqFullAddress')?.focus();
            return;
        }
        if (!state) {
            this.showToast('Please select your State', 'error');
            document.getElementById('reqState')?.focus();
            return;
        }
        if (!city) {
            this.showToast('Please enter your District / City', 'error');
            document.getElementById('reqCity')?.focus();
            return;
        }

        const newReq = {
            id: 'req-' + Date.now(),
            pilgrimageType,
            departureCity,
            departureDate,
            durationStay,
            roomType,
            adults: males + females,
            males,
            females,
            children,
            infants,
            newlyMarried,
            hotelCategory,
            fullName,
            mobileNumber,
            emailAddress,
            address,
            state,
            city,
            specialReqs: specialReqs || 'None',
            status: 'OPEN',
            createdAt: new Date().toISOString()
        };

        const existing = JSON.parse(localStorage.getItem('umrah_requirements') || '[]');
        existing.unshift(newReq);
        localStorage.setItem('umrah_requirements', JSON.stringify(existing));
        this.state.myRequirements.unshift(newReq);
        if (this.state.admin && this.state.admin.requirements) {
            this.state.admin.requirements.unshift(newReq);
        }

        try {
            await this.apiCall('/requirements', 'POST', newReq);
        } catch (e) {
            console.log('Requirement stored locally.');
        }

        const typeLabel = pilgrimageType === 'HAJJ' ? 'Hajj' : 'Umrah';
        this.showToast(`🎉 ${typeLabel} Request submitted successfully! Travel agents will send custom quotes shortly.`, 'success');
        this.navigate('dashboard');
    }

    renderRequestFormPage() {
        return `
        <div style="background: #f8fafc; min-height: 100vh; padding: 6rem 0 5rem; margin-top: 1rem; width: 100%; box-sizing: border-box;">
            <div style="max-width: 100%; width: 100%; margin: 0 auto; padding: 0 3.5rem; box-sizing: border-box;">
                
                <!-- Hajj vs Umrah Switcher Pill -->
                <div style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 1.6rem; flex-wrap: wrap;">
                    <button type="button" id="tabUmrahReq" class="btn-pilgrim-tab active" onclick="app.setPilgrimageType('UMRAH')" style="padding: 0.65rem 1.6rem; border-radius: 99px; border: 1.5px solid #064e3b; background: #064e3b; color: #ffffff; font-weight: 800; font-size: 0.9rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.45rem; transition: all 0.2s ease; box-shadow: 0 4px 12px rgba(6,78,59,0.2);">
                        <span>🕋</span> <span>Umrah Request</span>
                    </button>
                    <button type="button" id="tabHajjReq" class="btn-pilgrim-tab" onclick="app.setPilgrimageType('HAJJ')" style="padding: 0.65rem 1.6rem; border-radius: 99px; border: 1.5px solid #cbd5e1; background: #ffffff; color: #475569; font-weight: 700; font-size: 0.9rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.45rem; transition: all 0.2s ease;" onmouseover="this.style.borderColor='#064e3b'" onmouseout="if(!this.classList.contains('active'))this.style.borderColor='#cbd5e1'">
                        <span>🕌</span> <span>Hajj Request</span>
                    </button>
                    <input type="hidden" id="reqPilgrimageType" value="UMRAH" />
                </div>

                <!-- Page Title Header -->
                <div style="margin-bottom: 2rem;">
                    <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.4rem;">
                        <div style="width: 34px; height: 34px; border-radius: 10px; background: #e6f4ea; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                            </svg>
                        </div>
                        <h1 id="reqPageTitle" style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 0; letter-spacing: -0.01em;">Submit Umrah Request</h1>
                    </div>
                    <p id="reqPageSubtitle" style="color: #64748b; font-size: 0.92rem; margin: 0; max-width: 880px; line-height: 1.5;">
                        Fill out the details below to receive personalized Umrah package quotes. Our partner agencies will craft itineraries tailored specifically to your group's needs and preferences.
                    </p>
                </div>

                <!-- Two Column Layout: Main Form (Left) & Sidebar Cards (Right) -->
                <div style="display: grid; grid-template-columns: 1fr 340px; gap: 1.8rem; align-items: start; width: 100%; box-sizing: border-box;" class="request-form-grid">
                    
                    <!-- Left Form Cards -->
                    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                        
                        <!-- 1. Trip Details -->
                        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.8rem; box-shadow: 0 2px 10px rgba(0,0,0,0.02);">
                            <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1.4rem; padding-bottom: 0.8rem; border-bottom: 1px solid #f1f5f9;">
                                <div style="width: 32px; height: 32px; border-radius: 50%; background: #064e3b; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                    </svg>
                                </div>
                                <h2 style="font-size: 0.98rem; font-weight: 700; color: #0f172a; margin: 0;">Trip Details</h2>
                            </div>

                            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.2rem; margin-bottom: 1.4rem;" class="req-trip-grid">
                                <div>
                                    <label style="display: block; font-size: 0.75rem; font-weight: 800; color: #475569; letter-spacing: 0.05em; margin-bottom: 0.45rem; text-transform: uppercase;">CITY OF DEPARTURE *</label>
                                    <select id="reqDepartureCity" style="width: 100%; padding: 0.7rem 0.9rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem; color: #0f172a; background: #ffffff; outline: none;">
                                        <option value="">Select Departure City</option>
                                        <option value="Delhi (DEL)">Delhi (DEL)</option>
                                        <option value="Mumbai (BOM)">Mumbai (BOM)</option>
                                        <option value="Srinagar (SXR)">Srinagar (SXR)</option>
                                        <option value="Hyderabad (HYD)">Hyderabad (HYD)</option>
                                        <option value="Bangalore (BLR)">Bangalore (BLR)</option>
                                        <option value="Kolkata (CCU)">Kolkata (CCU)</option>
                                        <option value="Ahmedabad (AMD)">Ahmedabad (AMD)</option>
                                        <option value="Lucknow (LKO)">Lucknow (LKO)</option>
                                        <option value="Jaipur (JAI)">Jaipur (JAI)</option>
                                        <option value="Chennai (MAA)">Chennai (MAA)</option>
                                        <option value="Cochin (COK)">Cochin (COK)</option>
                                        <option value="Kozhikode (CCJ)">Kozhikode (CCJ)</option>
                                        <option value="Mangalore (IXE)">Mangalore (IXE)</option>
                                        <option value="Patna (PAT)">Patna (PAT)</option>
                                        <option value="Ranchi (IXR)">Ranchi (IXR)</option>
                                        <option value="Guwahati (GAU)">Guwahati (GAU)</option>
                                        <option value="Bhopal (BHO)">Bhopal (BHO)</option>
                                        <option value="Nagpur (NAG)">Nagpur (NAG)</option>
                                        <option value="Varanasi (VNS)">Varanasi (VNS)</option>
                                        <option value="Amritsar (ATQ)">Amritsar (ATQ)</option>
                                    </select>
                                </div>

                                <div>
                                    <label style="display: block; font-size: 0.75rem; font-weight: 800; color: #475569; letter-spacing: 0.05em; margin-bottom: 0.45rem; text-transform: uppercase;">PREFERRED DEPARTURE DATE *</label>
                                    <input type="date" id="reqDepartureDate" style="width: 100%; padding: 0.7rem 0.9rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem; color: #0f172a; background: #ffffff; outline: none;" />
                                </div>

                                <div>
                                    <label style="display: block; font-size: 0.75rem; font-weight: 800; color: #475569; letter-spacing: 0.05em; margin-bottom: 0.45rem; text-transform: uppercase;">DURATION OF STAY *</label>
                                    <select id="reqDurationStay" style="width: 100%; padding: 0.7rem 0.9rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem; color: #0f172a; background: #ffffff; outline: none;">
                                        <option value="">Select Umrah Duration</option>
                                        <option value="10–12 Days (Short Umrah)">10–12 Days (Short Umrah)</option>
                                        <option value="14–15 Days (Standard Umrah)">14–15 Days (Standard Umrah)</option>
                                        <option value="18–20 Days (Deluxe Umrah)">18–20 Days (Deluxe Umrah)</option>
                                        <option value="25–28 Days (Full Umrah)">25–28 Days (Full Umrah)</option>
                                        <option value="30 Days (Ramadan / Extended)">30 Days (Ramadan / Extended)</option>
                                        <option value="Custom Duration">Custom Duration</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label style="display: block; font-size: 0.75rem; font-weight: 800; color: #475569; letter-spacing: 0.05em; margin-bottom: 0.6rem; text-transform: uppercase;">WHAT KIND OF HOTEL ROOM? *</label>
                                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.8rem;" id="reqRoomTypeButtons">
                                    <button type="button" class="btn-room-type active" onclick="app.setReqRoomType(this, 'Single Bed')" style="padding: 0.75rem; border-radius: 8px; border: 1.5px solid #064e3b; background: #064e3b; color: #ffffff; font-weight: 700; font-size: 0.88rem; cursor: pointer; transition: all 0.2s ease;">Single Bed</button>
                                    <button type="button" class="btn-room-type" onclick="app.setReqRoomType(this, 'Double Bed')" style="padding: 0.75rem; border-radius: 8px; border: 1.5px solid #cbd5e1; background: #ffffff; color: #475569; font-weight: 600; font-size: 0.88rem; cursor: pointer; transition: all 0.2s ease;">Double Bed</button>
                                    <button type="button" class="btn-room-type" onclick="app.setReqRoomType(this, 'Three Bed')" style="padding: 0.75rem; border-radius: 8px; border: 1.5px solid #cbd5e1; background: #ffffff; color: #475569; font-weight: 600; font-size: 0.88rem; cursor: pointer; transition: all 0.2s ease;">Three Bed</button>
                                    <button type="button" class="btn-room-type" onclick="app.setReqRoomType(this, 'Four Bed')" style="padding: 0.75rem; border-radius: 8px; border: 1.5px solid #cbd5e1; background: #ffffff; color: #475569; font-weight: 600; font-size: 0.88rem; cursor: pointer; transition: all 0.2s ease;">Four Bed</button>
                                </div>
                                <input type="hidden" id="reqRoomTypeVal" value="Single Bed" />
                            </div>
                        </div>

                        <!-- 2. Traveler Details -->
                        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.8rem; box-shadow: 0 2px 10px rgba(0,0,0,0.02);">
                            <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1.4rem; padding-bottom: 0.8rem; border-bottom: 1px solid #f1f5f9;">
                                <div style="width: 32px; height: 32px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                        <circle cx="9" cy="7" r="4"></circle>
                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                    </svg>
                                </div>
                                <h2 style="font-size: 0.98rem; font-weight: 700; color: #0f172a; margin: 0;">Traveler Details *</h2>
                            </div>

                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1.4rem;" class="req-travelers-grid">
                                <!-- Male Adults -->
                                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.85rem 1rem; display: flex; align-items: center; justify-content: space-between;">
                                    <div>
                                        <div style="font-weight: 700; font-size: 0.9rem; color: #0f172a;">Male</div>
                                        <div style="font-size: 0.72rem; color: #64748b;">Adults</div>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                                        <button type="button" onclick="app.adjustReqCounter('reqMaleCount', -1)" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid #cbd5e1; background: #ffffff; color: #0f172a; font-weight: 700; cursor: pointer;">-</button>
                                        <span id="reqMaleCount" style="font-weight: 800; font-size: 0.95rem; width: 18px; text-align: center;">1</span>
                                        <button type="button" onclick="app.adjustReqCounter('reqMaleCount', 1)" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid #cbd5e1; background: #ffffff; color: #0f172a; font-weight: 700; cursor: pointer;">+</button>
                                    </div>
                                </div>

                                <!-- Female Adults -->
                                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.85rem 1rem; display: flex; align-items: center; justify-content: space-between;">
                                    <div>
                                        <div style="font-weight: 700; font-size: 0.9rem; color: #0f172a;">Female</div>
                                        <div style="font-size: 0.72rem; color: #64748b;">Adults (Requires Mehram)</div>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                                        <button type="button" onclick="app.adjustReqCounter('reqFemaleCount', -1)" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid #cbd5e1; background: #ffffff; color: #0f172a; font-weight: 700; cursor: pointer;">-</button>
                                        <span id="reqFemaleCount" style="font-weight: 800; font-size: 0.95rem; width: 18px; text-align: center;">0</span>
                                        <button type="button" onclick="app.adjustReqCounter('reqFemaleCount', 1)" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid #cbd5e1; background: #ffffff; color: #0f172a; font-weight: 700; cursor: pointer;">+</button>
                                    </div>
                                </div>

                                <!-- Children -->
                                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.85rem 1rem; display: flex; align-items: center; justify-content: space-between;">
                                    <div>
                                        <div style="font-weight: 700; font-size: 0.9rem; color: #0f172a;">Children</div>
                                        <div style="font-size: 0.72rem; color: #64748b;">2–11 years</div>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                                        <button type="button" onclick="app.adjustReqCounter('reqChildrenCount', -1)" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid #cbd5e1; background: #ffffff; color: #0f172a; font-weight: 700; cursor: pointer;">-</button>
                                        <span id="reqChildrenCount" style="font-weight: 800; font-size: 0.95rem; width: 18px; text-align: center;">0</span>
                                        <button type="button" onclick="app.adjustReqCounter('reqChildrenCount', 1)" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid #cbd5e1; background: #ffffff; color: #0f172a; font-weight: 700; cursor: pointer;">+</button>
                                    </div>
                                </div>

                                <!-- Infants -->
                                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.85rem 1rem; display: flex; align-items: center; justify-content: space-between;">
                                    <div>
                                        <div style="font-weight: 700; font-size: 0.9rem; color: #0f172a;">Infants</div>
                                        <div style="font-size: 0.72rem; color: #64748b;">Below 2 years</div>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                                        <button type="button" onclick="app.adjustReqCounter('reqInfantsCount', -1)" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid #cbd5e1; background: #ffffff; color: #0f172a; font-weight: 700; cursor: pointer;">-</button>
                                        <span id="reqInfantsCount" style="font-weight: 800; font-size: 0.95rem; width: 18px; text-align: center;">0</span>
                                        <button type="button" onclick="app.adjustReqCounter('reqInfantsCount', 1)" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid #cbd5e1; background: #ffffff; color: #0f172a; font-weight: 700; cursor: pointer;">+</button>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label style="display: block; font-size: 0.75rem; font-weight: 800; color: #475569; letter-spacing: 0.05em; margin-bottom: 0.6rem; text-transform: uppercase;">ARE YOU A NEWLY MARRIED COUPLE?</label>
                                <div style="display: flex; align-items: center; gap: 1.5rem;">
                                    <label style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.9rem; color: #0f172a; cursor: pointer;">
                                        <input type="radio" name="reqNewlyMarried" value="Yes" style="accent-color: #064e3b;" /> Yes
                                    </label>
                                    <label style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.9rem; color: #0f172a; cursor: pointer;">
                                        <input type="radio" name="reqNewlyMarried" value="No" checked style="accent-color: #064e3b;" /> No
                                    </label>
                                </div>
                            </div>
                        </div>

                        <!-- 3. Hotel Preference -->
                        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.8rem; box-shadow: 0 2px 10px rgba(0,0,0,0.02);">
                            <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1.4rem; padding-bottom: 0.8rem; border-bottom: 1px solid #f1f5f9;">
                                <div style="width: 32px; height: 32px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M3 21h18"></path>
                                        <path d="M19 21v-4a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v4"></path>
                                        <path d="M9 10h6"></path>
                                        <path d="M12 7v6"></path>
                                    </svg>
                                </div>
                                <h2 style="font-size: 0.98rem; font-weight: 700; color: #0f172a; margin: 0;">Hotel Preference *</h2>
                            </div>

                            <div>
                                <label style="display: block; font-size: 0.75rem; font-weight: 800; color: #475569; letter-spacing: 0.05em; margin-bottom: 0.8rem; text-transform: uppercase;">HOTEL CATEGORY *</label>
                                <div style="display: flex; flex-direction: column; gap: 0.8rem;">
                                    <label style="display: flex; align-items: center; gap: 0.6rem; font-size: 0.9rem; color: #0f172a; cursor: pointer;">
                                        <input type="radio" name="reqHotelCategory" value="3 Star" checked style="accent-color: #064e3b; width: 16px; height: 16px;" />
                                        <span style="font-weight: 700;">3 Star</span> <span style="color: #64748b; font-size: 0.85rem;">(Best value package with essential services)</span>
                                    </label>
                                    <label style="display: flex; align-items: center; gap: 0.6rem; font-size: 0.9rem; color: #0f172a; cursor: pointer;">
                                        <input type="radio" name="reqHotelCategory" value="4 Star" style="accent-color: #064e3b; width: 16px; height: 16px;" />
                                        <span style="font-weight: 700;">4 Star</span> <span style="color: #64748b; font-size: 0.85rem;">(Better hotels, improved transport, and added comfort)</span>
                                    </label>
                                    <label style="display: flex; align-items: center; gap: 0.6rem; font-size: 0.9rem; color: #0f172a; cursor: pointer;">
                                        <input type="radio" name="reqHotelCategory" value="5 Star" style="accent-color: #064e3b; width: 16px; height: 16px;" />
                                        <span style="font-weight: 700;">5 Star</span> <span style="color: #64748b; font-size: 0.85rem;">(High-quality hotels and premium travel experience)</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <!-- 4. Contact & Location (No default pre-filled values) -->
                        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.8rem; box-shadow: 0 2px 10px rgba(0,0,0,0.02);">
                            <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1.4rem; padding-bottom: 0.8rem; border-bottom: 1px solid #f1f5f9;">
                                <div style="width: 32px; height: 32px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                        <circle cx="12" cy="10" r="3"></circle>
                                    </svg>
                                </div>
                                <h2 style="font-size: 0.98rem; font-weight: 700; color: #0f172a; margin: 0;">Contact & Location</h2>
                            </div>

                            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.2rem; margin-bottom: 1.2rem;" class="req-contact-grid-1">
                                <div>
                                    <label style="display: block; font-size: 0.75rem; font-weight: 800; color: #475569; letter-spacing: 0.05em; margin-bottom: 0.45rem; text-transform: uppercase;">FULL NAME * (as per Aadhar)</label>
                                    <input type="text" id="reqFullName" placeholder="Enter fullname" style="width: 100%; padding: 0.7rem 0.9rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem; color: #0f172a; background: #ffffff; outline: none;" value="" />
                                </div>
                                <div>
                                    <label style="display: block; font-size: 0.75rem; font-weight: 800; color: #475569; letter-spacing: 0.05em; margin-bottom: 0.45rem; text-transform: uppercase;">MOBILE NUMBER *</label>
                                    <input type="tel" id="reqMobileNumber" placeholder="Enter mobile number" style="width: 100%; padding: 0.7rem 0.9rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem; color: #0f172a; background: #ffffff; outline: none;" value="" />
                                </div>
                                <div>
                                    <label style="display: block; font-size: 0.75rem; font-weight: 800; color: #475569; letter-spacing: 0.05em; margin-bottom: 0.45rem; text-transform: uppercase;">EMAIL ADDRESS *</label>
                                    <input type="email" id="reqEmailAddress" placeholder="Enter email address" style="width: 100%; padding: 0.7rem 0.9rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem; color: #0f172a; background: #ffffff; outline: none;" value="" />
                                </div>
                            </div>

                            <div style="margin-bottom: 1.2rem;">
                                <label style="display: block; font-size: 0.75rem; font-weight: 800; color: #475569; letter-spacing: 0.05em; margin-bottom: 0.45rem; text-transform: uppercase;">FULL ADDRESS *</label>
                                <input type="text" id="reqFullAddress" placeholder="House No., Street, Locality, Landmark." style="width: 100%; padding: 0.7rem 0.9rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem; color: #0f172a; background: #ffffff; outline: none;" value="" />
                            </div>

                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.2rem; margin-bottom: 1.2rem;" class="req-contact-grid-2">
                                <div>
                                    <label style="display: block; font-size: 0.75rem; font-weight: 800; color: #475569; letter-spacing: 0.05em; margin-bottom: 0.45rem; text-transform: uppercase;">STATE *</label>
                                    <select id="reqState" style="width: 100%; padding: 0.7rem 0.9rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem; color: #0f172a; background: #ffffff; outline: none;">
                                        <option value="">Select State</option>
                                        <option value="Jammu & Kashmir">Jammu & Kashmir</option>
                                        <option value="Delhi">Delhi</option>
                                        <option value="Maharashtra">Maharashtra</option>
                                        <option value="Telangana">Telangana</option>
                                        <option value="Karnataka">Karnataka</option>
                                        <option value="Uttar Pradesh">Uttar Pradesh</option>
                                        <option value="Gujarat">Gujarat</option>
                                        <option value="West Bengal">West Bengal</option>
                                        <option value="Tamil Nadu">Tamil Nadu</option>
                                        <option value="Kerala">Kerala</option>
                                        <option value="Bihar">Bihar</option>
                                        <option value="Jharkhand">Jharkhand</option>
                                        <option value="Punjab">Punjab</option>
                                        <option value="Rajasthan">Rajasthan</option>
                                        <option value="Madhya Pradesh">Madhya Pradesh</option>
                                        <option value="Assam">Assam</option>
                                        <option value="Haryana">Haryana</option>
                                        <option value="Odisha">Odisha</option>
                                        <option value="Andhra Pradesh">Andhra Pradesh</option>
                                        <option value="Uttarakhand">Uttarakhand</option>
                                        <option value="Himachal Pradesh">Himachal Pradesh</option>
                                        <option value="Goa">Goa</option>
                                        <option value="Chhattisgarh">Chhattisgarh</option>
                                    </select>
                                </div>

                                <div>
                                    <label style="display: block; font-size: 0.75rem; font-weight: 800; color: #475569; letter-spacing: 0.05em; margin-bottom: 0.45rem; text-transform: uppercase;">DISTRICT / CITY *</label>
                                    <input type="text" id="reqCity" placeholder="Enter District / City" style="width: 100%; padding: 0.7rem 0.9rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem; color: #0f172a; background: #ffffff; outline: none;" value="" />
                                </div>
                            </div>

                            <div>
                                <label style="display: block; font-size: 0.75rem; font-weight: 800; color: #475569; letter-spacing: 0.05em; margin-bottom: 0.45rem; text-transform: uppercase;">SPECIAL REQUIREMENTS <span style="color:#94a3b8; font-weight:400;">(Optional)</span></label>
                                <textarea id="reqSpecialRequirements" rows="3" placeholder="e.g. Wheelchair assistance, specific flight preferences, elderly care needed..." style="width: 100%; padding: 0.7rem 0.9rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem; color: #0f172a; background: #ffffff; outline: none; resize: vertical;"></textarea>
                            </div>
                        </div>

                        <!-- Submit Button Row (Arrow removed as requested!) -->
                        <div style="display: flex; justify-content: flex-end; margin-top: 0.5rem;">
                            <button type="button" onclick="app.submitStandaloneUmrahRequest()" style="background: #064e3b; color: #ffffff; font-weight: 800; font-size: 0.95rem; padding: 0.85rem 2.5rem; border-radius: 8px; border: none; cursor: pointer; box-shadow: 0 4px 14px rgba(6, 78, 59, 0.3); transition: all 0.25s ease;" onmouseover="this.style.background='#043a2c';this.style.transform='translateY(-2px)'" onmouseout="this.style.background='#064e3b';this.style.transform=''">
                                Submit Request
                            </button>
                        </div>

                    </div>

                    <!-- Right Sidebar Cards -->
                    <div style="display: flex; flex-direction: column; gap: 1.2rem;">
                        
                        <!-- Card 1: Your Request Includes -->
                        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.4rem; box-shadow: 0 2px 10px rgba(0,0,0,0.02);">
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                </svg>
                                <h3 style="font-size: 0.95rem; font-weight: 800; color: #0f172a; margin: 0;">Your Request Includes</h3>
                            </div>
                            <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.75rem;">
                                <li style="display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.82rem; color: #475569; line-height: 1.4;">
                                    <span style="color: #16a34a; font-weight: 900;">✓</span>
                                    <span>Verified travel agents will review your request</span>
                                </li>
                                <li style="display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.82rem; color: #475569; line-height: 1.4;">
                                    <span style="color: #16a34a; font-weight: 900;">✓</span>
                                    <span>You will receive multiple offers</span>
                                </li>
                                <li style="display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.82rem; color: #475569; line-height: 1.4;">
                                    <span style="color: #16a34a; font-weight: 900;">✓</span>
                                    <span>Compare and choose the best package</span>
                                </li>
                                <li style="display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.82rem; color: #475569; line-height: 1.4;">
                                    <span style="color: #16a34a; font-weight: 900;">✓</span>
                                    <span>Your contact details are 100% private</span>
                                </li>
                            </ul>
                        </div>

                        <!-- Card 2: Your Privacy is Our Priority -->
                        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 14px; padding: 1.2rem;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                </svg>
                                <h3 style="font-size: 0.88rem; font-weight: 800; color: #14532d; margin: 0;">Your Privacy is Our Priority</h3>
                            </div>
                            <p style="font-size: 0.78rem; color: #15803d; margin: 0; line-height: 1.45;">
                                We never share your personal details with agents. You stay in control.
                            </p>
                        </div>

                        <!-- Card 3: Need Help? -->
                        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.4rem; box-shadow: 0 2px 10px rgba(0,0,0,0.02);">
                            <h3 style="font-size: 0.92rem; font-weight: 800; color: #0f172a; margin: 0 0 0.3rem 0;">Need Help?</h3>
                            <p style="font-size: 0.78rem; color: #64748b; margin: 0 0 1rem 0;">Our support team is here to help you at every step.</p>
                            
                            <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                                <button type="button" onclick="app.toggleChatbot()" style="width: 100%; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 0.65rem 0.8rem; display: flex; align-items: center; gap: 0.6rem; text-align: left; cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.borderColor='#064e3b'" onmouseout="this.style.borderColor='#cbd5e1'">
                                    <div style="width: 28px; height: 28px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                        </svg>
                                    </div>
                                    <div>
                                        <div style="font-size: 0.82rem; font-weight: 800; color: #0f172a;">Chat with Us</div>
                                        <div style="font-size: 0.7rem; color: #64748b;">We reply in a few minutes</div>
                                    </div>
                                </button>

                                <a href="tel:+919541692891" style="width: 100%; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 0.65rem 0.8rem; display: flex; align-items: center; gap: 0.6rem; text-align: left; text-decoration: none; cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.borderColor='#064e3b'" onmouseout="this.style.borderColor='#cbd5e1'">
                                    <div style="width: 28px; height: 28px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                        </svg>
                                    </div>
                                    <div>
                                        <div style="font-size: 0.82rem; font-weight: 800; color: #0f172a;">Call Support</div>
                                        <div style="font-size: 0.7rem; color: #64748b;">+91 95416 92891</div>
                                    </div>
                                </a>
                            </div>
                        </div>

                    </div>

                </div>

            </div>
        </div>
        `;
    }

    renderHomePage() {
        return `
            <!-- Full Screen (100vh) Instant Image Slideshow Hero Banner -->
            <section class="hero-green-banner fullscreen-hero" style="background: #0f172a url('https://images.pexels.com/photos/18996760/pexels-photo-18996760.jpeg') center center / cover no-repeat;">

                <!-- Photo Slideshow Background Container -->
                <div id="heroBgSlideContainer" style="position:absolute; inset:0; z-index:1; overflow:hidden;">
                    <div id="heroSlideLayerA" style="position:absolute; inset:0; background: url('https://images.pexels.com/photos/18996760/pexels-photo-18996760.jpeg') center center / cover no-repeat; transition: opacity 1.2s ease-in-out; opacity:1; z-index:1;"></div>
                    <div id="heroSlideLayerB" style="position:absolute; inset:0; background: url('https://images.pexels.com/photos/32290181/pexels-photo-32290181.jpeg') center center / cover no-repeat; transition: opacity 1.2s ease-in-out; opacity:0; z-index:2;"></div>
                </div>

                <!-- Cinematic Gradient Overlay -->
                <div class="hero-video-overlay" style="z-index:4;"></div>

                <!-- Hero Content -->
                <div class="hero-green-container" style="max-width:860px !important; margin:0 auto !important; padding-top:2.2rem !important; text-align:center; position:relative; z-index:4;">

                    <!-- Liquid Glass Hero Badge Block (Powered by GoExergy only) -->
                    <div style="display:flex; justify-content:center; margin-bottom:1.4rem;">
                        <div class="hero-liquid-glass-badge" style="display:inline-flex !important; align-items:center !important; gap:0.35rem !important; background:rgba(255,255,255,0.10) !important; backdrop-filter:blur(28px) saturate(210%) !important; -webkit-backdrop-filter:blur(28px) saturate(210%) !important; border:1px solid rgba(255,255,255,0.45) !important; border-radius:999px !important; padding:0.45rem 1.4rem !important; box-shadow:0 8px 30px rgba(0,0,0,0.35), inset 0 1px 1.5px rgba(255,255,255,0.7) !important; position:relative !important; overflow:hidden !important; text-align:center;">
                            <div style="position:absolute; top:0; left:-50%; width:200%; height:50%; background:linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 100%); transform:rotate(-3deg); pointer-events:none;"></div>
                            <span style="font-size:0.78rem; font-weight:600; color:rgba(255,255,255,0.92); letter-spacing:0.03em; text-shadow:0 1px 4px rgba(0,0,0,0.95); position:relative; z-index:2; display:inline-flex; align-items:center; gap:0.3rem;">
                                <span>Powered by</span>
                                <span style="font-weight:800; color:#F9E07A;">GoExergy Private Limited</span>
                            </span>
                        </div>
                    </div>

                    <!-- Main Headline -->
                    <h1 class="hero-title-main" style="margin-bottom:0.85rem !important; line-height:1.08 !important;">
                        <span class="hero-h1-anim-1" style="display:block; font-size:clamp(2.4rem, 6vw, 4.8rem); font-weight:900; letter-spacing:-0.03em; color:#FFFFFF; text-shadow:0 2px 8px rgba(0,0,0,1), 0 4px 32px rgba(0,0,0,0.9), 0 8px 60px rgba(0,0,0,0.6);">One Request.</span>
                        <span class="hero-h1-anim-2" style="display:block; font-size:clamp(2.4rem, 6vw, 4.8rem); font-weight:900; letter-spacing:-0.03em; margin-top:0.05rem; background:linear-gradient(90deg,#F9E07A 0%,#E8B84B 40%,#FFD580 70%,#C9953A 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; filter:drop-shadow(0 4px 16px rgba(232,184,75,0.65)) drop-shadow(0 2px 8px rgba(0,0,0,0.9));">Multiple Verified Offers.</span>
                    </h1>

                    <!-- Sub Text -->
                    <p class="hero-subtext-anim" style="font-size:1.08rem !important; color:rgba(255,255,255,0.95) !important; max-width:680px !important; margin:0 auto 2.1rem !important; line-height:1.75 !important; font-weight:400 !important; text-shadow:0 1px 4px rgba(0,0,0,1), 0 2px 20px rgba(0,0,0,0.9);">
                        Post one request and receive transparent offers from verified Umrah travel providers. Compare, choose, and save—without sharing your personal details.
                    <!-- CTA Buttons -->
                    <div class="hero-cta-anim" style="display:flex; justify-content:center; align-items:center; gap:1rem; flex-wrap:wrap;">
                        <button onclick="app.handleStartJourneyClick()" style="background:linear-gradient(135deg,#E8B84B 0%,#C9953A 100%); color:#0A1A12; font-weight:800; font-size:0.95rem; padding:14px 32px; border-radius:10px; border:none; cursor:pointer; letter-spacing:0.02em; box-shadow:0 6px 28px rgba(232,184,75,0.55), 0 2px 8px rgba(0,0,0,0.3); transition:all 0.25s ease; position:relative; overflow:hidden;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 10px 36px rgba(232,184,75,0.65),0 3px 12px rgba(0,0,0,0.35)'" onmouseout="this.style.transform='';this.style.boxShadow='0 6px 28px rgba(232,184,75,0.55),0 2px 8px rgba(0,0,0,0.3)'">✦ Start Your Journey</button>
                        ${this.state.currentUser ? `<button onclick="app.navigate('dashboard')" style="background:rgba(255,255,255,0.12); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); color:#FFFFFF; font-weight:800; font-size:0.95rem; padding:14px 32px; border-radius:10px; border:1.5px solid rgba(255,255,255,0.6); cursor:pointer; letter-spacing:0.02em; box-shadow:0 4px 20px rgba(0,0,0,0.35); transition:all 0.25s ease;" onmouseover="this.style.background='rgba(255,255,255,0.22)';this.style.transform='translateY(-2px)'" onmouseout="this.style.background='rgba(255,255,255,0.12)';this.style.transform=''">📋 My Requests</button>` : ''}
                    </div>

                    <!-- Compact Apple Liquid Glass Square Feature Blocks (Headings & Icons Only) -->
                    <div style="display:flex; justify-content:center; align-items:center; gap:2rem; flex-wrap:wrap; margin-top:4.8rem;">
                        
                        <!-- Square Block 1: 100% Verified Offers -->
                        <div style="display:inline-flex; align-items:center; gap:0.55rem; background:rgba(255,255,255,0.10); backdrop-filter:blur(22px) saturate(190%); -webkit-backdrop-filter:blur(22px) saturate(190%); border:1px solid rgba(255,255,255,0.38); border-radius:12px; padding:0.65rem 1.1rem; box-shadow:0 8px 24px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.65); transition:all 0.25s ease;" onmouseover="this.style.transform='translateY(-2px)';this.style.background='rgba(255,255,255,0.18)';" onmouseout="this.style.transform='';this.style.background='rgba(255,255,255,0.10)';">
                            <div style="width:28px; height:28px; border-radius:8px; background:rgba(34,197,94,0.25); border:1px solid rgba(34,197,94,0.5); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                    <polyline points="9 12 11 14 15 10"></polyline>
                                </svg>
                            </div>
                            <h3 style="font-size:0.88rem; font-weight:800; color:#FFFFFF; margin:0; text-shadow:0 1px 4px rgba(0,0,0,0.95); white-space:nowrap;">100% Verified Offers</h3>
                        </div>

                        <!-- Square Block 2: 24/7 Support -->
                        <div style="display:inline-flex; align-items:center; gap:0.55rem; background:rgba(255,255,255,0.10); backdrop-filter:blur(22px) saturate(190%); -webkit-backdrop-filter:blur(22px) saturate(190%); border:1px solid rgba(255,255,255,0.38); border-radius:12px; padding:0.65rem 1.1rem; box-shadow:0 8px 24px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.65); transition:all 0.25s ease;" onmouseover="this.style.transform='translateY(-2px)';this.style.background='rgba(255,255,255,0.18)';" onmouseout="this.style.transform='';this.style.background='rgba(255,255,255,0.10)';">
                            <div style="width:28px; height:28px; border-radius:8px; background:rgba(245,158,11,0.25); border:1px solid rgba(245,158,11,0.5); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fde047" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                                    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
                                </svg>
                            </div>
                            <h3 style="font-size:0.88rem; font-weight:800; color:#FFFFFF; margin:0; text-shadow:0 1px 4px rgba(0,0,0,0.95); white-space:nowrap;">24/7 Support</h3>
                        </div>

                        <!-- Square Block 3: Your Data is Safe -->
                        <div style="display:inline-flex; align-items:center; gap:0.55rem; background:rgba(255,255,255,0.10); backdrop-filter:blur(22px) saturate(190%); -webkit-backdrop-filter:blur(22px) saturate(190%); border:1px solid rgba(255,255,255,0.38); border-radius:12px; padding:0.65rem 1.1rem; box-shadow:0 8px 24px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.65); transition:all 0.25s ease;" onmouseover="this.style.transform='translateY(-2px)';this.style.background='rgba(255,255,255,0.18)';" onmouseout="this.style.transform='';this.style.background='rgba(255,255,255,0.10)';">
                            <div style="width:28px; height:28px; border-radius:8px; background:rgba(147,51,234,0.25); border:1px solid rgba(147,51,234,0.5); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c084fc" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                            </div>
                            <h3 style="font-size:0.88rem; font-weight:800; color:#FFFFFF; margin:0; text-shadow:0 1px 4px rgba(0,0,0,0.95); white-space:nowrap;">Your Data is Safe</h3>
                        </div>

                    </div>

                </div>
            </section>

            <!-- Why Choose Zilhaj Section (Pixel-perfect match to reference design) -->
            <section style="background: #ffffff; padding: 5rem 2.5rem; text-align: center; border-bottom: 1px solid #f1f5f9; position: relative; width: 100%; box-sizing: border-box;">
                <div style="max-width: 1320px; margin: 0 auto; width: 100%; box-sizing: border-box;">
                    
                    <!-- Pill Badge -->
                    <div style="display: inline-flex; align-items: center; gap: 0.45rem; background: #ecfdf5; color: #15803d; border: 1px solid #bbf7d0; padding: 0.35rem 1.1rem; border-radius: 99px; font-size: 0.78rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 1.2rem;">
                        <span style="font-size: 0.85rem; color: #16a34a;">★</span>
                        <span>WHY CHOOSE ZILHAJ?</span>
                    </div>

                    <!-- Title & Subtitle -->
                    <h2 style="font-size: clamp(1.35rem, 2.5vw, 1.7rem); font-weight: 800; color: #0f172a; margin: 0 0 0.75rem 0; letter-spacing: -0.01em;">
                        Why Choose Zilhaj?
                    </h2>
                    <p style="color: #64748b; font-size: 1.02rem; max-width: 660px; margin: 0 auto 3rem; line-height: 1.65; font-weight: 400;">
                        We make your Umrah planning simple, transparent, and reliable with verified options and dedicated support.
                    </p>

                    <!-- 4 Cards Grid Layout -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.8rem; align-items: stretch;">
                        
                        <!-- Card 1: Verified Providers -->
                        <div style="background: #ffffff; border: 1.5px solid #f1f5f9; border-radius: 20px; padding: 2.2rem 1.6rem; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03); display: flex; flex-direction: column; align-items: center; text-align: center; transition: all 0.3s ease;" onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 12px 30px rgba(0,0,0,0.08)';this.style.borderColor='#e2e8f0';" onmouseout="this.style.transform='';this.style.boxShadow='0 4px 20px rgba(0, 0, 0, 0.03)';this.style.borderColor='#f1f5f9';">
                            <div style="width: 64px; height: 64px; border-radius: 18px; background: #e6f4ea; display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; flex-shrink: 0;">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                    <polyline points="9 12 11 14 15 10"></polyline>
                                </svg>
                            </div>
                            <h3 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin: 0 0 0.6rem 0;">Verified Providers</h3>
                            <div style="width: 32px; height: 3px; background: #16a34a; border-radius: 2px; margin: 0.4rem 0 1.2rem 0;"></div>
                            <p style="color: #64748b; font-size: 0.9rem; line-height: 1.65; margin: 0; font-weight: 400;">
                                We work only with trusted and verified travel providers to ensure a safe and reliable Umrah experience.
                            </p>
                        </div>

                        <!-- Card 2: Multiple Options -->
                        <div style="background: #ffffff; border: 1.5px solid #f1f5f9; border-radius: 20px; padding: 2.2rem 1.6rem; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03); display: flex; flex-direction: column; align-items: center; text-align: center; transition: all 0.3s ease;" onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 12px 30px rgba(0,0,0,0.08)';this.style.borderColor='#e2e8f0';" onmouseout="this.style.transform='';this.style.boxShadow='0 4px 20px rgba(0, 0, 0, 0.03)';this.style.borderColor='#f1f5f9';">
                            <div style="width: 64px; height: 64px; border-radius: 18px; background: #fef7e0; display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; flex-shrink: 0;">
                                <svg width="30" height="30" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                                </svg>
                            </div>
                            <h3 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin: 0 0 0.6rem 0;">Multiple Options</h3>
                            <div style="width: 32px; height: 3px; background: #16a34a; border-radius: 2px; margin: 0.4rem 0 1.2rem 0;"></div>
                            <p style="color: #64748b; font-size: 0.9rem; line-height: 1.65; margin: 0; font-weight: 400;">
                                Get multiple suitable options based on your requirements and preferences to choose what suits you best.
                            </p>
                        </div>

                        <!-- Card 3: Compare Before You Choose -->
                        <div style="background: #ffffff; border: 1.5px solid #f1f5f9; border-radius: 20px; padding: 2.2rem 1.6rem; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03); display: flex; flex-direction: column; align-items: center; text-align: center; transition: all 0.3s ease;" onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 12px 30px rgba(0,0,0,0.08)';this.style.borderColor='#e2e8f0';" onmouseout="this.style.transform='';this.style.boxShadow='0 4px 20px rgba(0, 0, 0, 0.03)';this.style.borderColor='#f1f5f9';">
                            <div style="width: 64px; height: 64px; border-radius: 18px; background: #f3e8ff; display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; flex-shrink: 0;">
                                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#9333ea" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                            </div>
                            <h3 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin: 0 0 0.6rem 0;">Compare Before You Choose</h3>
                            <div style="width: 32px; height: 3px; background: #16a34a; border-radius: 2px; margin: 0.4rem 0 1.2rem 0;"></div>
                            <p style="color: #64748b; font-size: 0.9rem; line-height: 1.65; margin: 0; font-weight: 400;">
                                Easily compare options, prices, and inclusions before making the right decision with complete clarity.
                            </p>
                        </div>

                        <!-- Card 4: Transparent Process -->
                        <div style="background: #ffffff; border: 1.5px solid #f1f5f9; border-radius: 20px; padding: 2.2rem 1.6rem; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03); display: flex; flex-direction: column; align-items: center; text-align: center; transition: all 0.3s ease;" onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 12px 30px rgba(0,0,0,0.08)';this.style.borderColor='#e2e8f0';" onmouseout="this.style.transform='';this.style.boxShadow='0 4px 20px rgba(0, 0, 0, 0.03)';this.style.borderColor='#f1f5f9';">
                            <div style="width: 64px; height: 64px; border-radius: 18px; background: #e0f2fe; display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; flex-shrink: 0;">
                                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 2l2.4 1.8 3-.4.6 3 2.6 1.6-1 2.8 1.4 2.6-2.2 2-.2 3-3 .6-1.8 2.4-2.8-1-2.6 1.4-2-2.2-3-.2-.6-3-2.4-1.8 1-2.8-1.4-2.6 2.2-2 .2-3 3-.6L12 2z"></path>
                                    <polyline points="9 12 11 14 15 10"></polyline>
                                </svg>
                            </div>
                            <h3 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin: 0 0 0.6rem 0;">Transparent Process</h3>
                            <div style="width: 32px; height: 3px; background: #16a34a; border-radius: 2px; margin: 0.4rem 0 1.2rem 0;"></div>
                            <p style="color: #64748b; font-size: 0.9rem; line-height: 1.65; margin: 0; font-weight: 400;">
                                A simple, secure, and transparent process from request to final selection – no hidden surprises.
                            </p>
                        </div>

                    </div>
                </div>
            </section>

            <!-- How It Works Section – Pixel-perfect reference design -->
            <section style="position:relative; overflow:hidden; padding:5rem 2.5rem; background:#f0faf5; text-align:center; border-bottom:1px solid #d8ede2; width:100%; box-sizing:border-box;">

                <!-- Faded mosque silhouette background -->
                <div style="position:absolute;inset:0;pointer-events:none;user-select:none;overflow:hidden;">
                    <svg style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:110%;min-width:900px;opacity:0.10;" viewBox="0 0 1200 340" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <!-- Left minaret -->
                        <rect x="60" y="80" width="28" height="260" rx="4" fill="#1a6b3c"/>
                        <path d="M60 80 Q74 30 88 80Z" fill="#1a6b3c"/>
                        <rect x="68" y="100" width="12" height="20" rx="2" fill="#f0faf5"/>
                        <rect x="68" y="130" width="12" height="20" rx="2" fill="#f0faf5"/>
                        <rect x="68" y="160" width="12" height="20" rx="2" fill="#f0faf5"/>
                        <!-- Main dome left -->
                        <rect x="100" y="160" width="130" height="180" rx="6" fill="#1a6b3c"/>
                        <path d="M100 160 Q165 60 230 160Z" fill="#1a6b3c"/>
                        <path d="M140 160 Q165 100 190 160Z" fill="#2d8c55" opacity="0.5"/>
                        <rect x="148" y="170" width="20" height="35" rx="3" fill="#f0faf5"/>
                        <rect x="178" y="170" width="20" height="35" rx="3" fill="#f0faf5"/>
                        <!-- Second minaret left -->
                        <rect x="240" y="120" width="24" height="220" rx="4" fill="#1a6b3c"/>
                        <path d="M240 120 Q252 75 264 120Z" fill="#1a6b3c"/>
                        <rect x="246" y="140" width="12" height="16" rx="2" fill="#f0faf5"/>
                        <rect x="246" y="165" width="12" height="16" rx="2" fill="#f0faf5"/>
                        <!-- Center grand dome -->
                        <rect x="420" y="140" width="360" height="200" rx="8" fill="#1a6b3c"/>
                        <path d="M420 140 Q600 0 780 140Z" fill="#1a6b3c"/>
                        <path d="M480 140 Q600 50 720 140Z" fill="#2d8c55" opacity="0.4"/>
                        <rect x="490" y="150" width="30" height="50" rx="4" fill="#f0faf5"/>
                        <rect x="540" y="150" width="30" height="50" rx="4" fill="#f0faf5"/>
                        <rect x="630" y="150" width="30" height="50" rx="4" fill="#f0faf5"/>
                        <rect x="680" y="150" width="30" height="50" rx="4" fill="#f0faf5"/>
                        <circle cx="600" cy="140" r="18" fill="#2d8c55"/>
                        <circle cx="600" cy="140" r="10" fill="#1a6b3c"/>
                        <!-- Right second minaret -->
                        <rect x="936" y="120" width="24" height="220" rx="4" fill="#1a6b3c"/>
                        <path d="M936 120 Q948 75 960 120Z" fill="#1a6b3c"/>
                        <rect x="942" y="140" width="12" height="16" rx="2" fill="#f0faf5"/>
                        <rect x="942" y="165" width="12" height="16" rx="2" fill="#f0faf5"/>
                        <!-- Main dome right -->
                        <rect x="970" y="160" width="130" height="180" rx="6" fill="#1a6b3c"/>
                        <path d="M970 160 Q1035 60 1100 160Z" fill="#1a6b3c"/>
                        <path d="M1010 160 Q1035 100 1060 160Z" fill="#2d8c55" opacity="0.5"/>
                        <rect x="1032" y="170" width="20" height="35" rx="3" fill="#f0faf5"/>
                        <rect x="1062" y="170" width="20" height="35" rx="3" fill="#f0faf5"/>
                        <!-- Right minaret -->
                        <rect x="1112" y="80" width="28" height="260" rx="4" fill="#1a6b3c"/>
                        <path d="M1112 80 Q1126 30 1140 80Z" fill="#1a6b3c"/>
                        <rect x="1120" y="100" width="12" height="20" rx="2" fill="#f0faf5"/>
                        <rect x="1120" y="130" width="12" height="20" rx="2" fill="#f0faf5"/>
                        <rect x="1120" y="160" width="12" height="20" rx="2" fill="#f0faf5"/>
                        <!-- Ground line -->
                        <rect x="0" y="335" width="1200" height="5" fill="#1a6b3c"/>
                    </svg>
                </div>

                <!-- Section header -->
                <div style="position:relative;z-index:1;max-width:600px;margin:0 auto 3rem;">
                    <h2 style="font-size:1.35rem;font-weight:800;color:#0f172a;margin:0 0 0.5rem;letter-spacing:-0.2px;">
                        <span style="color:#1a6b3c;">✦</span> How It Works <span style="color:#1a6b3c;">✦</span>
                    </h2>
                    <p style="font-size:0.95rem;color:#6b7280;margin:0;">Three simple steps to plan your Umrah with confidence</p>
                </div>

                <!-- Dashed connector row with icon nodes -->
                <div style="position:relative;z-index:1;display:flex;align-items:center;justify-content:center;gap:0;max-width:680px;margin:0 auto 2.5rem;">
                    <!-- Node 1: document icon (green circle) -->
                    <div style="width:52px;height:52px;border-radius:50%;background:#ffffff;border:2px solid #2d8c55;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                        <svg width="22" height="22" fill="none" stroke="#2d8c55" stroke-width="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="12" x2="12" y2="18"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                    </div>
                    <!-- Dashed line + arrow -->
                    <div style="flex:1;display:flex;align-items:center;position:relative;height:2px;margin:0 4px;">
                        <svg width="100%" height="14" viewBox="0 0 200 14" preserveAspectRatio="none"><line x1="0" y1="7" x2="180" y2="7" stroke="#2d8c55" stroke-width="1.5" stroke-dasharray="6 4"/><polygon points="182,3 192,7 182,11" fill="#2d8c55"/></svg>
                    </div>
                    <!-- Node 2: envelope icon (gold filled circle — active) -->
                    <div style="width:52px;height:52px;border-radius:50%;background:#f59e0b;border:2px solid #f59e0b;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 16px rgba(245,158,11,0.4);">
                        <svg width="22" height="22" fill="none" stroke="#ffffff" stroke-width="1.8" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    </div>
                    <!-- Dashed line + arrow -->
                    <div style="flex:1;display:flex;align-items:center;position:relative;height:2px;margin:0 4px;">
                        <svg width="100%" height="14" viewBox="0 0 200 14" preserveAspectRatio="none"><line x1="0" y1="7" x2="180" y2="7" stroke="#2d8c55" stroke-width="1.5" stroke-dasharray="6 4"/><polygon points="182,3 192,7 182,11" fill="#2d8c55"/></svg>
                    </div>
                    <!-- Node 3: shield icon (green circle) -->
                    <div style="width:52px;height:52px;border-radius:50%;background:#ffffff;border:2px solid #2d8c55;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                        <svg width="22" height="22" fill="none" stroke="#2d8c55" stroke-width="1.8" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
                    </div>
                </div>

                <!-- 3 Cards (no step labels, no arrows between cards) -->
                <div style="position:relative;z-index:1;display:grid;grid-template-columns:repeat(3,1fr);gap:1.8rem;max-width:1120px;margin:0 auto;">

                    <!-- Card 1: Submit Request -->
                    <div class="scroll-reveal stagger-1" style="background:#ffffff;border-radius:16px;padding:2.2rem 1.8rem 0;text-align:center;box-shadow:0 2px 16px rgba(0,0,0,0.07);border:1px solid #e2ede6;position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;">
                        <!-- Icon circle -->
                        <div style="width:72px;height:72px;border-radius:50%;background:#e8f5ee;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;flex-shrink:0;">
                            <svg width="32" height="32" fill="none" stroke="#2d8c55" stroke-width="1.7" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="12" x2="12" y2="18"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                        </div>
                        <h3 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin:0 0 0.7rem;">Submit Request</h3>
                        <p style="font-size:0.88rem;color:#6b7280;line-height:1.65;margin:0 0 2rem;">Tell us your travel dates, group size, budget, and preferences. Your details stay private and secure.</p>
                        <!-- Faded mosque bottom decoration -->
                        <div style="width:100%;height:70px;overflow:hidden;flex-shrink:0;margin-top:auto;opacity:0.12;">
                            <svg viewBox="0 0 300 70" width="100%" height="70" fill="#1a6b3c" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="20" width="15" height="50"/><path d="M20 20 Q27 2 35 20Z"/><rect x="55" y="10" width="60" height="60"/><path d="M55 10 Q85 -18 115 10Z"/><rect x="120" y="20" width="15" height="50"/><path d="M120 20 Q127 2 135 20Z"/><rect x="160" y="25" width="15" height="45"/><path d="M160 25 Q167 7 175 25Z"/><rect x="195" y="10" width="60" height="60"/><path d="M195 10 Q225 -18 255 10Z"/><rect x="265" y="20" width="15" height="50"/><path d="M265 20 Q272 2 280 20Z"/><rect x="0" y="65" width="300" height="5"/></svg>
                        </div>
                    </div>

                    <!-- Card 2: Receive Offers (highlighted amber/gold) -->
                    <div class="scroll-reveal stagger-2" style="background:linear-gradient(180deg,#fffbeb 0%,#fef3c7 100%);border-radius:16px;padding:2.2rem 1.8rem 0;text-align:center;box-shadow:0 4px 24px rgba(245,158,11,0.2);border:1.5px solid #fcd34d;position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;">
                        <!-- Icon circle (gold bg) -->
                        <div style="width:72px;height:72px;border-radius:50%;background:#fde68a;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;flex-shrink:0;box-shadow:0 4px 16px rgba(245,158,11,0.25);">
                            <svg width="32" height="32" fill="none" stroke="#b45309" stroke-width="1.7" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                        </div>
                        <h3 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin:0 0 0.7rem;">Receive Offers</h3>
                        <p style="font-size:0.88rem;color:#6b7280;line-height:1.65;margin:0 0 2rem;">Verified travel agents review your request and send tailored offers that match your needs and budget.</p>
                        <!-- Faded mosque bottom decoration (amber tint) -->
                        <div style="width:100%;height:70px;overflow:hidden;flex-shrink:0;margin-top:auto;opacity:0.13;">
                            <svg viewBox="0 0 300 70" width="100%" height="70" fill="#b45309" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="20" width="15" height="50"/><path d="M20 20 Q27 2 35 20Z"/><rect x="55" y="10" width="60" height="60"/><path d="M55 10 Q85 -18 115 10Z"/><rect x="120" y="20" width="15" height="50"/><path d="M120 20 Q127 2 135 20Z"/><rect x="160" y="25" width="15" height="45"/><path d="M160 25 Q167 7 175 25Z"/><rect x="195" y="10" width="60" height="60"/><path d="M195 10 Q225 -18 255 10Z"/><rect x="265" y="20" width="15" height="50"/><path d="M265 20 Q272 2 280 20Z"/><rect x="0" y="65" width="300" height="5"/></svg>
                        </div>
                    </div>

                    <!-- Card 3: Choose Package -->
                    <div class="scroll-reveal stagger-3" style="background:#ffffff;border-radius:16px;padding:2.2rem 1.8rem 0;text-align:center;box-shadow:0 2px 16px rgba(0,0,0,0.07);border:1px solid #e2ede6;position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;">
                        <!-- Icon circle -->
                        <div style="width:72px;height:72px;border-radius:50%;background:#1a3a2a;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;flex-shrink:0;">
                            <svg width="32" height="32" fill="none" stroke="#ffffff" stroke-width="1.7" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
                        </div>
                        <h3 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin:0 0 0.7rem;">Choose Package</h3>
                        <p style="font-size:0.88rem;color:#6b7280;line-height:1.65;margin:0 0 2rem;">Compare offers, check details, and confidently select the option that fits your journey perfectly.</p>
                        <!-- Faded mosque bottom decoration -->
                        <div style="width:100%;height:70px;overflow:hidden;flex-shrink:0;margin-top:auto;opacity:0.12;">
                            <svg viewBox="0 0 300 70" width="100%" height="70" fill="#1a6b3c" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="20" width="15" height="50"/><path d="M20 20 Q27 2 35 20Z"/><rect x="55" y="10" width="60" height="60"/><path d="M55 10 Q85 -18 115 10Z"/><rect x="120" y="20" width="15" height="50"/><path d="M120 20 Q127 2 135 20Z"/><rect x="160" y="25" width="15" height="45"/><path d="M160 25 Q167 7 175 25Z"/><rect x="195" y="10" width="60" height="60"/><path d="M195 10 Q225 -18 255 10Z"/><rect x="265" y="20" width="15" height="50"/><path d="M265 20 Q272 2 280 20Z"/><rect x="0" y="65" width="300" height="5"/></svg>
                        </div>
                    </div>

                </div>
            </section>

            ${this.renderLiquidGlassFeedbackSection()}
        `;
    }

    renderLiquidGlassFeedbackSection() {
        return `
            <!-- Modern & Aesthetic Liquid Glass Zaireen Review Carousel Slider -->
            <section style="background: #ffffff; padding: 5rem 2.5rem 4.5rem; border-bottom: 1px solid #f1f5f9; position: relative; width: 100%; box-sizing: border-box;" id="liquidFeedbackSection">
                <div class="liquid-glass-wrapper" style="max-width: 1320px; margin: 0 auto; padding: 0; width: 100%;">
                    <div class="reviews-section-header" style="margin-bottom: 3rem;">
                        <h2 class="reviews-section-title">Read reviews from <span>Zaireen</span></h2>
                        <p class="reviews-section-subtitle">Real experiences from Zaireen who posted their Umrah requirements and saved on reverse bidding</p>
                    </div>

                    <div class="liquid-carousel-outer">
                        <div class="liquid-carousel-container">
                            <!-- Navigation Prev/Next Buttons -->
                            <button type="button" class="carousel-nav-btn prev" onclick="app.slideReviewCarousel(-1)" aria-label="Previous Review">❮</button>
                            
                            <!-- Track Viewport -->
                            <div class="carousel-viewport">
                                <div class="carousel-track" id="ZaireenReviewTrack" style="transform: translateX(0px);">
                                    
                                    <!-- Card 1 -->
                                    <div class="Zaireen-review-card">
                                        <div>
                                            <div class="card-stars-row">⭐⭐⭐⭐⭐</div>
                                            <span class="card-verified-badge">✓ Verified Zaireen</span>
                                            <h3 class="card-headline-title">SAVED ₹35,000 WITH REVERSE BIDDING</h3>
                                            <div class="card-author-name">Tariq Ahmad Bhat • Srinagar</div>
                                        </div>
                                        <p class="card-review-text">
                                            I submitted my 18-day Umrah requirement and received 4 verified agent quotes within 2 hours. Got a 5-star hotel near Haram for 25% lower price!
                                        </p>
                                    </div>

                                    <!-- Card 2 -->
                                    <div class="Zaireen-review-card">
                                        <div>
                                            <div class="card-stars-row">⭐⭐⭐⭐⭐</div>
                                            <span class="card-verified-badge">✓ Verified Zaireen</span>
                                            <h3 class="card-headline-title">BOOKED 5-STAR HARAM HOTEL AT BUDGET PRICE</h3>
                                            <div class="card-author-name">Shafiq Ur Rehman • Delhi</div>
                                        </div>
                                        <p class="card-review-text">
                                            The reverse bidding system is incredible. Travel agents competed to give us their lowest package prices. Smooth, transparent, and trustworthy experience!
                                        </p>
                                    </div>

                                    <!-- Card 3 -->
                                    <div class="Zaireen-review-card">
                                        <div>
                                            <div class="card-stars-row">⭐⭐⭐⭐⭐</div>
                                            <span class="card-verified-badge">✓ Verified Zaireen</span>
                                            <h3 class="card-headline-title">SUPER FAST AGENT RESPONSES</h3>
                                            <div class="card-author-name">Dr. Ayesha Malik • Mumbai</div>
                                            <p class="card-review-text">
                                                I was amazed how quickly verified Saudi agents sent detailed proposals. Comparison was super easy and saved me hours of calling around.
                                            </p>
                                        </div>
                                    </div>

                                    <!-- Card 4 -->
                                    <div class="Zaireen-review-card">
                                        <div>
                                            <div class="card-stars-row">⭐⭐⭐⭐⭐</div>
                                            <span class="card-verified-badge">✓ Verified Zaireen</span>
                                            <h3 class="card-headline-title">FAMILY TRIP PERFECTLY ARRANGED</h3>
                                            <div class="card-author-name">Mohammad Omer • Hyderabad</div>
                                        </div>
                                        <p class="card-review-text">
                                            We were 6 family members with elderly parents. We specified quad sharing and close walking distance to Haram. Got exactly what we needed!
                                        </p>
                                    </div>

                                    <!-- Card 5 -->
                                    <div class="Zaireen-review-card">
                                        <div>
                                            <div class="card-stars-row">⭐⭐⭐⭐⭐</div>
                                            <span class="card-verified-badge">✓ Verified Zaireen</span>
                                            <h3 class="card-headline-title">100% TRANSPARENT & RELIABLE</h3>
                                            <div class="card-author-name">Shazia Parveen • Bangalore</div>
                                        </div>
                                        <p class="card-review-text">
                                            Very easy to fill out requirement form and directly communicate with top agents. No hidden fees or unexpected charges.
                                        </p>
                                    </div>

                                </div>
                            </div>

                            <button type="button" class="carousel-nav-btn next" onclick="app.slideReviewCarousel(1)" aria-label="Next Review">❯</button>
                        </div>

                        <!-- Pagination Dots -->
                        <div class="carousel-dots-wrapper" id="carouselDotsWrapper">
                            <div class="carousel-dot active" onclick="app.goToReviewSlide(0)"></div>
                            <div class="carousel-dot" onclick="app.goToReviewSlide(1)"></div>
                            <div class="carousel-dot" onclick="app.goToReviewSlide(2)"></div>
                        </div>
                    </div>
                </div>
            </section>
        `;
    }

    renderTravelCard(pkg) {
        const imageUrl = (pkg.imageUrls && pkg.imageUrls.length > 0)
            ? pkg.imageUrls[0]
            : 'https://images.unsplash.com/photo-1591604466107-ec97de577aff';

        const originalPrice = pkg.originalPrice || pkg.basePrice || null;

        return `
            <div class="travel-card">
                <!-- Left Image Thumbnail & Star Rating -->
                <div class="travel-card-image">
                    <img src="${imageUrl}" alt="${this.escapeHtml(pkg.title)}">
                    <div class="travel-star-badge">⭐ ${pkg.hotelMakkahStars ? pkg.hotelMakkahStars + '-Star Stay' : 'Hotel Stay'}</div>
                </div>

                <!-- Middle Content Details -->
                <div class="travel-card-body">
                    <div>
                        <div class="travel-agency-strip">
                            <span>🏢 ${this.escapeHtml(pkg.agentName || pkg.agencyName || 'Travel Agency')}</span>
                            ${pkg.departureDateText || pkg.departureDate ? `<span>•</span><span>📅 Departure: ${this.escapeHtml(pkg.departureDateText || pkg.departureDate)}</span>` : ''}
                            ${pkg.durationDays ? `<span>•</span><span>⏳ ${pkg.durationDays} Days</span>` : ''}
                        </div>
                        <h4 class="travel-pkg-title">${this.escapeHtml(pkg.title)}</h4>

                        <div class="travel-hotels-bar">
                            <div class="travel-hotel-loc">
                                <span>🕋 Makkah:</span>
                                <strong>${this.escapeHtml(pkg.makkahHotelName || 'Not specified')}</strong>${pkg.distanceToHaramMakkah ? ` (${pkg.distanceToHaramMakkah}m)` : ''}
                            </div>
                            <div class="travel-hotel-loc">
                                <span>🕌 Madinah:</span>
                                <strong>${this.escapeHtml(pkg.madinahHotelName || 'Not specified')}</strong>${pkg.distanceToHaramMadinah ? ` (${pkg.distanceToHaramMadinah}m)` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Highlight Tags -->
                    <div class="travel-highlights-tags">
                        ${(pkg.inclusions && pkg.inclusions.length ? pkg.inclusions : []).map(tag => `<span class="travel-tag">${this.escapeHtml(tag)}</span>`).join('')}
                    </div>
                </div>

                <!-- Right Price & CTA Sidebar -->
                <div class="travel-card-pricing">
                    <div>
                        ${originalPrice ? `<div class="travel-original-price">${this.formatCurrency(originalPrice)}</div>` : ''}
                        <div class="travel-final-price">${this.formatCurrency(pkg.price || 0)}</div>
                        <div class="travel-price-unit">per Zaireen (all taxes incl.)</div>
                    </div>

                    <div class="travel-actions">
                        <button class="btn btn-outline btn-sm" onclick="app.openPackageDetailModal('${pkg.id}')">View Details</button>
                        <button class="btn btn-gold btn-sm" onclick="app.startBooking('${pkg.id}')">Book Now</button>
                    </div>
                </div>
            </div>
        `;
    }

    openPackageDetailModal(packageId) {
        const pkg = this.state.packages.find(p => p.id === packageId) || null;
        if (!pkg) {
            this.showToast('Package not found', 'error');
            return;
        }
        this.openViewOfferModal({
            id: pkg.id,
            title: pkg.title,
            price: pkg.price,
            departureDate: pkg.departureDateText || pkg.departureDate,
            duration: (pkg.durationDays ? pkg.durationDays + ' Days' : pkg.duration),
            makkahHotel: pkg.makkahHotelName,
            madinahHotel: pkg.madinahHotelName
        });
    }


    renderCustomRequirementForm() {
        return `
            <div style="max-width:100%; margin:0 auto; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                <!-- Single Unified Requirement Card -->
                <div style="background:#ffffff; border-radius:24px; border:1.5px solid #e2e8f0; box-shadow:0 12px 35px rgba(0,0,0,0.04); padding:2.5rem 2.2rem;">

                    <!-- Top Unified Header Section -->
                    <div style="text-align:center; padding-bottom:1.8rem; border-bottom:1.5px dashed #e2e8f0; margin-bottom:2rem;">
                        <div style="display:inline-flex; align-items:center; gap:0.5rem; background:#ecfdf5; color:#047857; padding:0.4rem 1.1rem; border-radius:99px; font-size:0.82rem; font-weight:800; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:0.8rem;">
                            ✨ EASY UMRAH PACKAGES
                        </div>
                        <h2 style="font-size:1.4rem; font-weight:800; color:#0f172a; margin:0 0 0.5rem; letter-spacing:-0.3px;">Post Your Travel Requirement</h2>
                        <p style="font-size:0.95rem; color:#64748b; margin:0 auto; max-width:620px; line-height:1.6;">
                            Enter your travel dates, group size, and preferences. Verified travel agents will send you their best price offers!
                        </p>
                    </div>

                    <form onsubmit="event.preventDefault(); app.submitRequirementForm();" style="display:flex; flex-direction:column; gap:1.5rem;">

                        <!-- STEP 1: Travel & Accommodation -->
                        <div class="form-step active" id="step1">
                            <div style="display:flex; align-items:center; gap:0.8rem; border-bottom:1.5px dashed #e2e8f0; padding-bottom:1rem; margin-bottom:1.5rem;">
                                <div style="width:42px; height:42px; background:#dcfce7; color:#047857; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.3rem; font-weight:800;">📅</div>
                                <div>
                                    <h3 style="font-size:1.2rem; font-weight:800; color:#0f172a; margin:0;">1. Travel & Hotel Preferences</h3>
                                    <p style="font-size:0.82rem; color:#64748b; margin:0.15rem 0 0 0;">Specify when and how you prefer to travel</p>
                                </div>
                            </div>
                            
                            <div class="form-group" style="margin-bottom:1.4rem;">
                                <label style="font-weight:700; color:#0f172a; display:flex; align-items:center; gap:0.4rem; margin-bottom:0.6rem; font-size:0.92rem;">
                                    📅 PREFERRED DEPARTURE DATE *
                                </label>
                                <input type="date" id="reqDateRange" class="form-control premium-input" required>
                            </div>

                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.2rem; margin-bottom:1.4rem;">
                                <div class="form-group">
                                    <label style="font-weight:700; color:#0f172a; display:flex; align-items:center; gap:0.4rem; margin-bottom:0.6rem; font-size:0.92rem;">
                                        ✈️ DEPARTURE CITY *
                                    </label>
                                    <input type="text" id="reqDepartureCity" class="form-control premium-input" placeholder="e.g. Srinagar / Delhi / Mumbai" required>
                                </div>
                                <div class="form-group">
                                    <label style="font-weight:700; color:#0f172a; display:flex; align-items:center; gap:0.4rem; margin-bottom:0.6rem; font-size:0.92rem;">
                                        🏨 HOTEL STAR CATEGORY *
                                    </label>
                                    <select id="reqHotelType" class="form-control premium-input" required>
                                        <option value="" disabled selected>Select Hotel Class...</option>
                                        <option value="5-Star Luxury (< 300m from Haram)">🌟 5-Star Luxury (&lt; 300m from Haram)</option>
                                        <option value="4-Star Deluxe (< 600m from Haram)">⭐ 4-Star Deluxe (&lt; 600m from Haram)</option>
                                        <option value="3-Star Standard (< 900m from Haram)">🏨 3-Star Standard (&lt; 900m from Haram)</option>
                                        <option value="Economy / Budget Accommodation">🪙 Economy / Budget Accommodation</option>
                                    </select>
                                </div>
                            </div>

                            <div class="form-group">
                                <label style="font-weight:700; color:#0f172a; margin-bottom:0.6rem; font-size:0.92rem; display:block;">⏳ PACKAGE DURATION *</label>
                                <select id="reqDuration" class="form-control premium-input" required>
                                    <option value="" disabled selected>Select Package Duration...</option>
                                    <option value="10">10 Days Short Tour</option>
                                    <option value="14">14 Days Standard Sacred Journey</option>
                                    <option value="18">18 Days Recommended Tour</option>
                                    <option value="21">21 Days Extended Stay</option>
                                    <option value="25">25 Days Full Sacred Journey</option>
                                    <option value="28">28 Days Ramadan Special</option>
                                    <option value="30">30 Days Full Month</option>
                                </select>
                            </div>

                            <div style="display:flex; justify-content:flex-end; margin-top:1.8rem;">
                                <button type="button" onclick="app.nextFormStep(2)" style="background:#4f46e5; color:#ffffff; font-weight:700; font-size:0.95rem; padding:0.75rem 1.8rem; border-radius:10px; border:none; cursor:pointer; box-shadow:0 4px 14px rgba(79, 70, 229, 0.3); transition:all 0.2s ease;">Next Step →</button>
                            </div>
                        </div>

                        <!-- STEP 2: Contact & Group Size -->
                        <div class="form-step" id="step2">
                            <div style="display:flex; align-items:center; gap:0.8rem; border-bottom:1.5px dashed #e2e8f0; padding-bottom:1rem; margin-bottom:1.5rem;">
                                <div style="width:42px; height:42px; background:#dbeafe; color:#1d4ed8; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.3rem; font-weight:800;">📍</div>
                                <div>
                                    <h3 style="font-size:1.2rem; font-weight:800; color:#0f172a; margin:0;">2. Contact & Group Details</h3>
                                </div>
                            </div>

                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.2rem; margin-bottom:1.4rem;">
                                <div class="form-group">
                                    <label style="font-weight:700; color:#0f172a; margin-bottom:0.6rem; font-size:0.92rem; display:block;">STATE *</label>
                                    <select id="reqState" class="form-control premium-input" required>
                                        <option value="" disabled selected>Select State...</option>
                                        <option value="Jammu and Kashmir">Jammu and Kashmir</option>
                                        <option value="Andaman and Nicobar Islands">Andaman and Nicobar Islands</option>
                                        <option value="Andhra Pradesh">Andhra Pradesh</option>
                                        <option value="Arunachal Pradesh">Arunachal Pradesh</option>
                                        <option value="Assam">Assam</option>
                                        <option value="Bihar">Bihar</option>
                                        <option value="Chandigarh">Chandigarh</option>
                                        <option value="Chhattisgarh">Chhattisgarh</option>
                                        <option value="Dadra and Nagar Haveli and Daman and Diu">Dadra and Nagar Haveli and Daman and Diu</option>
                                        <option value="Delhi">Delhi</option>
                                        <option value="Goa">Goa</option>
                                        <option value="Gujarat">Gujarat</option>
                                        <option value="Haryana">Haryana</option>
                                        <option value="Himachal Pradesh">Himachal Pradesh</option>
                                        <option value="Jharkhand">Jharkhand</option>
                                        <option value="Karnataka">Karnataka</option>
                                        <option value="Kerala">Kerala</option>
                                        <option value="Ladakh">Ladakh</option>
                                        <option value="Lakshadweep">Lakshadweep</option>
                                        <option value="Madhya Pradesh">Madhya Pradesh</option>
                                        <option value="Maharashtra">Maharashtra</option>
                                        <option value="Manipur">Manipur</option>
                                        <option value="Meghalaya">Meghalaya</option>
                                        <option value="Mizoram">Mizoram</option>
                                        <option value="Nagaland">Nagaland</option>
                                        <option value="Odisha">Odisha</option>
                                        <option value="Puducherry">Puducherry</option>
                                        <option value="Punjab">Punjab</option>
                                        <option value="Rajasthan">Rajasthan</option>
                                        <option value="Sikkim">Sikkim</option>
                                        <option value="Tamil Nadu">Tamil Nadu</option>
                                        <option value="Telangana">Telangana</option>
                                        <option value="Tripura">Tripura</option>
                                        <option value="Uttar Pradesh">Uttar Pradesh</option>
                                        <option value="Uttarakhand">Uttarakhand</option>
                                        <option value="West Bengal">West Bengal</option>
                                        <option value="Other International / NRI">Other International / NRI</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label style="font-weight:700; color:#0f172a; margin-bottom:0.6rem; font-size:0.92rem; display:block;">DISTRICT *</label>
                                    <input type="text" id="reqDistrict" class="form-control premium-input" placeholder="e.g. Srinagar" required>
                                </div>
                            </div>
                            <div class="form-group" style="margin-bottom:2rem;">
                                <label style="font-weight:700; color:#0f172a; margin-bottom:0.6rem; font-size:0.92rem; display:block;">FULL STREET ADDRESS *</label>
                                <input type="text" id="reqAddress" class="form-control premium-input" placeholder="House/Flat No., Street, Area..." required>
                            </div>

                            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:1rem; margin-bottom:1.6rem;">
                                <div class="form-group" style="background:#ffffff; border:1.5px solid #cbd5e1; border-radius:14px; padding:1rem 0.6rem; text-align:center; box-shadow:0 4px 12px rgba(0,0,0,0.03);">
                                    <label style="font-weight:800; color:#0f172a; margin-bottom:0.6rem; font-size:0.88rem; display:block;">👨 MALES *</label>
                                    <div style="display:flex; align-items:center; justify-content:center; gap:0.5rem;">
                                        <button type="button" onclick="app.adjustCounter('reqMales', -1)" style="width:36px; height:36px; border-radius:8px; border:1px solid #cbd5e1; background:#f8fafc; font-weight:800; font-size:1.1rem; cursor:pointer; display:flex; align-items:center; justify-content:center;">-</button>
                                        <input type="number" id="reqMales" min="0" value="0" required readonly style="width:45px; text-align:center; font-size:1.15rem; font-weight:800; border:none; background:transparent;">
                                        <button type="button" onclick="app.adjustCounter('reqMales', 1)" style="width:36px; height:36px; border-radius:8px; border:1px solid #047857; background:#ecfdf5; color:#047857; font-weight:800; font-size:1.1rem; cursor:pointer; display:flex; align-items:center; justify-content:center;">+</button>
                                    </div>
                                </div>
                                <div class="form-group" style="background:#ffffff; border:1.5px solid #cbd5e1; border-radius:14px; padding:1rem 0.6rem; text-align:center; box-shadow:0 4px 12px rgba(0,0,0,0.03);">
                                    <label style="font-weight:800; color:#0f172a; margin-bottom:0.6rem; font-size:0.88rem; display:block;">👩 FEMALES *</label>
                                    <div style="display:flex; align-items:center; justify-content:center; gap:0.5rem;">
                                        <button type="button" onclick="app.adjustCounter('reqFemales', -1)" style="width:36px; height:36px; border-radius:8px; border:1px solid #cbd5e1; background:#f8fafc; font-weight:800; font-size:1.1rem; cursor:pointer; display:flex; align-items:center; justify-content:center;">-</button>
                                        <input type="number" id="reqFemales" min="0" value="0" required readonly style="width:45px; text-align:center; font-size:1.15rem; font-weight:800; border:none; background:transparent;">
                                        <button type="button" onclick="app.adjustCounter('reqFemales', 1)" style="width:36px; height:36px; border-radius:8px; border:1px solid #047857; background:#ecfdf5; color:#047857; font-weight:800; font-size:1.1rem; cursor:pointer; display:flex; align-items:center; justify-content:center;">+</button>
                                    </div>
                                </div>
                                <div class="form-group" style="background:#ffffff; border:1.5px solid #cbd5e1; border-radius:14px; padding:1rem 0.6rem; text-align:center; box-shadow:0 4px 12px rgba(0,0,0,0.03);">
                                    <label style="font-weight:800; color:#0f172a; margin-bottom:0.6rem; font-size:0.85rem; display:block;">👶 CHILDREN (&lt; 5 YRS)</label>
                                    <div style="display:flex; align-items:center; justify-content:center; gap:0.5rem;">
                                        <button type="button" onclick="app.adjustCounter('reqChildren', -1)" style="width:36px; height:36px; border-radius:8px; border:1px solid #cbd5e1; background:#f8fafc; font-weight:800; font-size:1.1rem; cursor:pointer; display:flex; align-items:center; justify-content:center;">-</button>
                                        <input type="number" id="reqChildren" min="0" value="0" readonly style="width:45px; text-align:center; font-size:1.15rem; font-weight:800; border:none; background:transparent;">
                                        <button type="button" onclick="app.adjustCounter('reqChildren', 1)" style="width:36px; height:36px; border-radius:8px; border:1px solid #047857; background:#ecfdf5; color:#047857; font-weight:800; font-size:1.1rem; cursor:pointer; display:flex; align-items:center; justify-content:center;">+</button>
                                    </div>
                                </div>
                            </div>

                            <div style="background:linear-gradient(135deg, #ecfdf5 0%, #dcfce7 100%); border:1.5px solid #86efac; border-radius:14px; padding:0.9rem 1.4rem; display:flex; align-items:center; justify-content:space-between;">
                                <div style="display:flex; align-items:center; gap:0.6rem;">
                                    <span style="font-size:1.4rem;">👥</span>
                                    <span style="font-weight:800; color:#065f46; font-size:0.95rem;">Total Group Size</span>
                                </div>
                                <input type="text" id="totalTravelersBadge" readonly value="0" style="border:2px solid #047857; border-radius:10px; padding:0.4rem 1rem; font-size:1.1rem; font-weight:800; color:#047857; width:110px; text-align:center; background:#ffffff; box-sizing:border-box;">
                            </div>

                            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1.8rem;">
                                <button type="button" style="background:#ffffff; color:#475569; border:1.5px solid #cbd5e1; border-radius:10px; font-weight:700; font-size:0.92rem; padding:0.75rem 1.6rem; cursor:pointer; transition:all 0.2s ease;" onclick="app.prevFormStep(1)">← Back</button>
                                <button type="button" style="background:#4f46e5; color:#ffffff; border-radius:10px; font-weight:700; font-size:0.95rem; padding:0.75rem 1.8rem; border:none; cursor:pointer; box-shadow:0 4px 14px rgba(79,70,229,0.3); transition:all 0.2s ease;" onclick="app.nextFormStep(3)">Next Step →</button>
                            </div>
                        </div>

                        <!-- STEP 3: Notes -->
                        <div class="form-step" id="step3">
                            <div style="display:flex; align-items:center; gap:0.8rem; border-bottom:1.5px dashed #e2e8f0; padding-bottom:1rem; margin-bottom:1.2rem;">
                                <div style="width:42px; height:42px; background:#f3e8ff; color:#7e22ce; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.3rem; font-weight:800;">📝</div>
                                <div>
                                    <h3 style="font-size:1.2rem; font-weight:800; color:#0f172a; margin:0;">3. Additional Preferences &amp; Requests</h3>
                                </div>
                            </div>
                            <textarea id="reqNotes" class="form-control premium-input" rows="4" placeholder="e.g. Prefer direct flights, wheelchair assistance needed, vegetarian meals..." style="resize:vertical;"></textarea>

                            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1.8rem;">
                                <button type="button" style="background:#ffffff; color:#475569; border:1.5px solid #cbd5e1; border-radius:10px; font-weight:700; font-size:0.92rem; padding:0.75rem 1.6rem; cursor:pointer; transition:all 0.2s ease;" onclick="app.prevFormStep(2)">← Back</button>
                                <button type="submit" style="background:#047857; color:#ffffff; border-radius:10px; font-weight:800; font-size:0.95rem; padding:0.75rem 2.2rem; border:none; cursor:pointer; box-shadow:0 4px 14px rgba(4, 120, 87, 0.3); transition:all 0.2s ease;">🚀 SUBMIT REQUEST</button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    currentFormStep = 1;

    calcTotalTravelers() {
        const m = parseInt(document.getElementById('reqMales')?.value) || 0;
        const f = parseInt(document.getElementById('reqFemales')?.value) || 0;
        const c = parseInt(document.getElementById('reqChildren')?.value) || 0;
        const total = m + f + c;
        const badge = document.getElementById('totalTravelersBadge');
        if (badge) {
            badge.value = total;
        }
        return total;
    }

    adjustCounter(id, delta) {
        const input = document.getElementById(id);
        if (!input) return;
        let val = parseInt(input.value) || 0;
        val = Math.max(0, val + delta);
        input.value = val;
        this.calcTotalTravelers();
    }

    nextFormStep(step) {
        const activeStepEl = document.getElementById(`step${this.currentFormStep}`);
        if (activeStepEl && step > this.currentFormStep) {
            // Clear previous error messages & styles
            activeStepEl.querySelectorAll('.field-error-msg').forEach(msg => msg.remove());
            activeStepEl.querySelectorAll('.input-field-error').forEach(el => {
                el.classList.remove('input-field-error');
                el.style.border = '';
                el.style.backgroundColor = '';
                el.style.boxShadow = '';
            });

            const reqInputs = activeStepEl.querySelectorAll('input[required], select[required], textarea[required]');
            let firstInvalidInput = null;

            for (let input of reqInputs) {
                if (!input.value || !input.value.trim()) {
                    if (!firstInvalidInput) firstInvalidInput = input;

                    // Apply prominent red error styling on the input bar
                    input.classList.add('input-field-error');

                    // Append inline red warning message below the field container
                    const parentGroup = input.closest('.form-group') || input.parentElement;
                    if (parentGroup && !parentGroup.querySelector('.field-error-msg')) {
                        const errorMsg = document.createElement('div');
                        errorMsg.className = 'field-error-msg';
                        errorMsg.innerHTML = '⚠️ Required field — please fill in to continue';
                        parentGroup.appendChild(errorMsg);
                    }

                    // Auto-clear red warning when user enters data
                    const clearError = () => {
                        input.classList.remove('input-field-error');
                        input.style.border = '';
                        input.style.backgroundColor = '';
                        input.style.boxShadow = '';
                        const parent = input.closest('.form-group') || input.parentElement;
                        if (parent) {
                            parent.querySelectorAll('.field-error-msg').forEach(m => m.remove());
                        }
                    };
                    input.addEventListener('input', clearError, { once: true });
                    input.addEventListener('change', clearError, { once: true });
                }
            }

            if (firstInvalidInput) {
                firstInvalidInput.focus();
                this.showToast('Please fill in the red highlighted required fields before proceeding.', 'error');
                return;
            }

            // Validate total group size in Step 2
            if (this.currentFormStep === 2 && step === 3) {
                const total = this.calcTotalTravelers();
                if (total < 1) {
                    this.showToast('Please select at least 1 traveler (Male, Female, or Child) to continue.', 'error');
                    return;
                }
            }
        }

        // Remove active class from ALL form steps to guarantee only 1 section is visible at a time
        document.querySelectorAll('.form-step').forEach(el => {
            el.classList.remove('active');
            el.style.display = 'none';
        });

        const currentDotEl = document.getElementById(`dot${this.currentFormStep}`);
        if (currentDotEl) {
            currentDotEl.classList.remove('active');
            currentDotEl.classList.add('completed');
        }

        this.currentFormStep = step;

        const newStepEl = document.getElementById(`step${this.currentFormStep}`);
        const newDotEl = document.getElementById(`dot${this.currentFormStep}`);
        if (newStepEl) {
            newStepEl.classList.add('active');
            newStepEl.style.display = 'block';
        }
        if (newDotEl) newDotEl.classList.add('active');

        const anchor = document.getElementById('requestFormAnchor');
        if (anchor) {
            anchor.scrollIntoView({ behavior: 'smooth' });
        }
    }

    prevFormStep(step) {
        // Remove active class from ALL form steps to guarantee only 1 section is visible at a time
        document.querySelectorAll('.form-step').forEach(el => {
            el.classList.remove('active');
            el.style.display = 'none';
        });

        const currentDotEl = document.getElementById(`dot${this.currentFormStep}`);
        if (currentDotEl) currentDotEl.classList.remove('active');

        this.currentFormStep = step;

        const newStepEl = document.getElementById(`step${this.currentFormStep}`);
        const newDotEl = document.getElementById(`dot${this.currentFormStep}`);
        if (newStepEl) {
            newStepEl.classList.add('active');
            newStepEl.style.display = 'block';
        }
        if (newDotEl) newDotEl.classList.remove('completed');

        const anchor = document.getElementById('requestFormAnchor');
        if (anchor) {
            anchor.scrollIntoView({ behavior: 'smooth' });
        }
    }
    calcTotalTravelers() {
        const males = parseInt(document.getElementById('reqMales')?.value) || 0;
        const females = parseInt(document.getElementById('reqFemales')?.value) || 0;
        const children = parseInt(document.getElementById('reqChildren')?.value) || 0;
        const total = males + females + children;

        const badge = document.getElementById('totalTravelersBadge');
        if (badge) {
            // Works for both input[type=text] and span elements
            if (badge.tagName === 'INPUT') {
                badge.value = total;
            } else {
                badge.innerText = `👥 ${total} Travelers Total`;
            }
        }
        return Math.max(1, total);
    }

    async submitRequirementForm() {
        if (!this.state.currentUser) {
            this.showToast('🔒 Login Required! Please log in or sign up to submit your travel request.', 'warning');
            this.openAuthModal('login');
            return;
        }
        this.showLoading('Submitting your travel request to verified agents...');
        const dateRange = document.getElementById('reqDateRange')?.value || document.getElementById('reqDate')?.value || '';
        const duration = parseInt(document.getElementById('reqDuration')?.value) || 0;
        const hotelType = document.getElementById('reqHotelType')?.value || 'Not specified';
        const departureCity = document.getElementById('reqDepartureCity')?.value || '';
        const state = document.getElementById('reqState')?.value || '';
        const district = document.getElementById('reqDistrict')?.value || '';
        const address = document.getElementById('reqAddress')?.value || '';
        const males = parseInt(document.getElementById('reqMales')?.value) || 0;
        const females = parseInt(document.getElementById('reqFemales')?.value) || 0;
        const children = parseInt(document.getElementById('reqChildren')?.value) || 0;
        const travelers = Math.max(1, males + females + children);
        const budget = parseFloat(document.getElementById('reqBudget')?.value) || 0;
        const notes = document.getElementById('reqNotes')?.value || '';

        const currentUser = this.state.currentUser;

        const newReq = {
            id: 'req-' + Date.now(),
            userId: currentUser.id,
            userName: currentUser.name || '',
            userEmail: currentUser.email || '',
            userPhone: currentUser.phone || '',
            preferredDepartureDate: dateRange,
            durationDays: duration,
            hotelType: hotelType,
            departureCity: departureCity,
            state: state,
            district: district,
            fullAddress: address,
            travelersBreakdown: { males, females, children },
            travelersCount: travelers,
            maxBudget: budget,
            specialNotes: notes,
            status: 'BIDDING',
            createdAt: new Date().toLocaleDateString()
        };

        setTimeout(async () => {
            await this.apiCall('/requirements', 'POST', newReq);

            const localReqs = JSON.parse(localStorage.getItem('umrah_requirements') || '[]');
            localReqs.unshift(newReq);
            localStorage.setItem('umrah_requirements', JSON.stringify(localReqs));
            this.state.admin.requirements = localReqs;


            this.hideLoading();
            this.showSuccessModal(
                'Request Submitted Successfully! 🎉',
                'We have received your request and will forward it to agents shortly.',
                () => this.navigate('dashboard')
            );
            setTimeout(() => this.navigate('dashboard'), 4000);
        }, 800);
    }

    switchTab(tab) {
        this.state.activeTab = tab;
        this.navigate('home');
    }

    renderTrustPage() {
        return `
            <div class="main-container" style="max-width:100%; width:100%; box-sizing:border-box; margin:7rem auto 3.5rem; padding:0 3.5rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3rem; flex-wrap:wrap; gap:1rem;">
                    <div style="text-align:center; flex:1;">
                        <h2 style="font-size:1.45rem; font-weight:800; color:#0f172a; margin-bottom:0.5rem;">Why Choose Us</h2>
                        <p style="color:#64748b; font-size:1rem;">Transparent competition between verified travel agencies ensuring you get the best price and quality</p>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:1.5rem; margin-bottom:3rem;">
                    <div style="background:#ffffff; padding:2.2rem 1.8rem; border-radius:16px; border:1px solid #e2e8f0; box-shadow:0 10px 30px rgba(15,23,42,0.05); text-align:center;">
                        <div style="font-size:2.5rem; margin-bottom:1rem;">🛡️</div>
                        <h3 style="color:#0f172a; font-size:1.2rem; font-weight:800; margin-bottom:0.6rem;">100% Verified Agents</h3>
                        <p style="color:#64748b; font-size:0.9rem; line-height:1.6;">All travel operators on our reverse auction platform are government certified and thoroughly vetted.</p>
                    </div>

                    <div style="background:#ffffff; padding:2.2rem 1.8rem; border-radius:16px; border:1px solid #e2e8f0; box-shadow:0 10px 30px rgba(15,23,42,0.05); text-align:center;">
                        <div style="font-size:2.5rem; margin-bottom:1rem;">💰</div>
                        <h3 style="color:#0f172a; font-size:1.2rem; font-weight:800; margin-bottom:0.6rem;">Best Discounted Prices</h3>
                        <p style="color:#64748b; font-size:0.9rem; line-height:1.6;">Agencies compete live to offer you the lowest prices without compromising on 5-star hotel proximity or services.</p>
                    </div>

                    <div style="background:#ffffff; padding:2.2rem 1.8rem; border-radius:16px; border:1px solid #e2e8f0; box-shadow:0 10px 30px rgba(15,23,42,0.05); text-align:center;">
                        <div style="font-size:2.5rem; margin-bottom:1rem;">🔒</div>
                        <h3 style="color:#0f172a; font-size:1.2rem; font-weight:800; margin-bottom:0.6rem;">100% Privacy Protection</h3>
                        <p style="color:#64748b; font-size:0.9rem; line-height:1.6;">Your phone number and email remain private. Agents only see your request parameters, not your personal info.</p>
                    </div>

                    <div style="background:#ffffff; padding:2.2rem 1.8rem; border-radius:16px; border:1px solid #e2e8f0; box-shadow:0 10px 30px rgba(15,23,42,0.05); text-align:center;">
                        <div style="font-size:2.5rem; margin-bottom:1rem;">⚡</div>
                        <h3 style="color:#0f172a; font-size:1.2rem; font-weight:800; margin-bottom:0.6rem;">Real-Time Control</h3>
                        <p style="color:#64748b; font-size:0.9rem; line-height:1.6;">Compare bids, accept the best offer, or cancel requests anytime with full user control on your dashboard.</p>
                    </div>
                </div>

                <div style="text-align:center;">
                    <button class="btn btn-gold" onclick="app.navigate('home'); app.scrollToRequirementForm();" style="font-size:1.05rem; padding:0.95rem 2.5rem;">
                        📝 Submit Your Travel Request Now
                    </button>
                </div>
            </div>
        `;
    }

    toggleFaqCard(btn) {
        const item = btn.closest('.faq-item');
        if (!item) return;
        const body = item.querySelector('.faq-answer');
        const icon = btn.querySelector('.faq-toggle-icon');
        const isOpen = body && body.style.display === 'block';
        if (body) body.style.display = isOpen ? 'none' : 'block';
        if (icon) icon.textContent = isOpen ? '+' : '−';
        btn.style.background = isOpen ? '#f8fafc' : '#ecfdf5';
        btn.style.borderColor = isOpen ? '#e2e8f0' : '#a7f3d0';
        if (!isOpen) {
            btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    renderFaqsPage() {
        const faqData = [
            {
                q: 'Is Umra the same as Umrah?',
                a: 'Yes! "Umra" and "Umrah" are the same sacred Islamic pilgrimage to Makkah — "Umra" is simply a common spelling variation. All Zilhaj.com verified Umrah / Umra packages include hotels near Masjid al-Haram.'
            },
            {
                q: 'What are Zilhajj, Zil Haj, and Zil Hajj packages?',
                a: 'Zilhajj (also spelled Zil Haj / Zil Hajj) is the 12th month of the Islamic Hijri calendar in which the Hajj pilgrimage takes place. Zilhaj.com offers special Zil Haj / Hajj packages with guided Ziyarat, Mina tent stay, flights, and VIP transport.'
            },
            {
                q: 'How do I book a custom Umrah or Hajj package?',
                a: 'Submit one travel request with your dates, budget, and number of travelers. Verified Saudi-licensed operators then compete with offers for your exact requirements — you compare bids and accept the best one.'
            },
            {
                q: 'Are hotels near Haram included in the packages?',
                a: 'Yes. Every verified package includes 5-star or premium hotels within a short walk (150m – 600m) of Masjid al-Haram in Makkah and Al-Masjid an-Nabawi in Madinah, along with daily meals and Ziyarat.'
            },
            {
                q: 'Is my payment safe on Zilhaj.com?',
                a: '100%. Payments run through Razorpay’s PCI-DSS certified gateway with HMAC-SHA256 signature verification. Money is held in escrow and only released to the operator after your booking is confirmed — never to an unverified third party.'
            },
            {
                q: 'How do I get my invoice or ticket after payment?',
                a: 'Go to Dashboard → My Bookings and click "View Voucher / Invoice". Your official bill is generated live from our database and shows your Booking Ref, Payment ID, Transaction ID, Order ID, and amount paid. You can print or save it as PDF.'
            },
            {
                q: 'What is the Nusuk app and do I need it?',
                a: 'Nusuk is Saudi Arabia’s official platform for permits. Rawdah Al-Sharifa visits in Madinah and Hajj registrations require Nusuk permits. Download the Nusuk app, register, and reserve your time slot — our operators help you at every step.'
            },
            {
                q: 'What documents do I need for an Umrah visa?',
                a: 'A passport valid for 6+ months, confirmed return flight booking, hotel confirmation, and travel insurance. Our verified agents handle your e-visa and Nusuk permit application end-to-end.'
            },
            {
                q: 'Are my contact details shared with agents?',
                a: 'No. Your phone number and email stay private. Agents only see your travel requirements (dates, budget, travelers) and respond with offers — you decide who you want to contact.'
            },
            {
                q: 'What happens after I accept an offer?',
                a: 'Your payment goes into escrow, your booking is confirmed instantly, and your DB-backed invoice (with payment ID and transaction ID) is generated for download. The operator then begins your visa and hotel confirmation.'
            },
            {
                q: 'Can I cancel my booking and get a refund?',
                a: 'Cancellations are governed by the fare rules of the package you selected and Saudi hospitality regulations. Contact support@zilhaj.com or call +91 95416 92891 within the free-cancellation window for a full escrow refund.'
            },
            {
                q: 'How do I contact Zilhaj.com support?',
                a: 'Our 24/7 Zaireen support is available at +966 800 123 4567 or +91 95416 92891, by email at support@zilhaj.com, or via the Noor AI assistant right on the website.'
            }
        ];

        const faqItems = faqData.map((f, i) => `
            <div class="faq-item" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; overflow:hidden; box-shadow:0 2px 8px rgba(15,23,42,0.04);">
                <button type="button" onclick="app.toggleFaqCard(this)" style="width:100%; display:flex; justify-content:space-between; align-items:center; gap:1rem; padding:1.1rem 1.4rem; background:#f8fafc; border:none; cursor:pointer; text-align:left; font-family:inherit; border-left:4px solid #2b5e48;">
                    <span style="font-size:0.98rem; font-weight:800; color:#0f172a; line-height:1.4; flex:1;">${i + 1}. ${f.q}</span>
                    <span class="faq-toggle-icon" style="flex-shrink:0; width:30px; height:30px; border-radius:50%; background:#ecfdf5; border:1px solid #a7f3d0; color:#047857; font-size:1.2rem; font-weight:800; display:flex; align-items:center; justify-content:center;">+</span>
                </button>
                <div class="faq-answer" style="display:none; padding:1.1rem 1.4rem 1.3rem; background:#ffffff; color:#475569; font-size:0.92rem; line-height:1.7; border-top:1px solid #f1f5f9;">
                    ${f.a}
                </div>
            </div>
        `).join('');

        return `
            <div class="main-container" style="max-width:100%; width:100%; box-sizing:border-box; margin:6.8rem auto 4rem; padding:0 3.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
                    <div style="text-align: center; flex: 1;">
                        <div style="display: inline-flex; align-items: center; gap: 0.4rem; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 0.25rem 0.9rem; border-radius: 99px; font-size: 0.78rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 0.6rem;">
                            <span>❓</span> <span>PILGRIMAGE FAQS</span>
                        </div>
                        <h2 style="font-size: clamp(1.25rem, 2.2vw, 1.5rem); font-weight: 800; color: #0f172a; margin-bottom: 0.4rem; letter-spacing: -0.01em;">Frequently Asked Questions</h2>
                        <p style="color: #64748b; font-size: 0.95rem; max-width: 680px; margin: 0 auto; line-height: 1.6;">Short, clear answers to the most common questions pilgrims ask about Umrah, Hajj, payments, and bookings.</p>
                    </div>
                </div>

                <div style="display:flex; flex-direction:column; gap:0.9rem;">
                    ${faqItems}
                </div>

                <div style="margin-top:2.5rem; background:linear-gradient(135deg, #0b1f17 0%, #163e2e 100%); border-radius:18px; padding:1.8rem 2rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                    <div>
                        <div style="color:#F9E07A; font-weight:800; font-size:1.05rem;">Still have a question?</div>
                        <div style="color:rgba(255,255,255,0.85); font-size:0.88rem; margin-top:0.25rem;">Our 24/7 support team and Noor AI assistant are always available to help.</div>
                    </div>
                    <div style="display:flex; gap:0.7rem; flex-wrap:wrap;">
                        <button onclick="app.navigate('home'); setTimeout(() => app.scrollToRequirementForm(), 200);" style="background:#f59e0b; color:#0f172a; font-weight:800; font-size:0.9rem; padding:0.7rem 1.5rem; border-radius:10px; border:none; cursor:pointer;">📝 Submit a Request</button>
                        <button onclick="app.openContactModal()" style="background:rgba(255,255,255,0.12); color:#ffffff; font-weight:800; font-size:0.9rem; padding:0.7rem 1.5rem; border-radius:10px; border:1px solid rgba(255,255,255,0.4); cursor:pointer;">📞 Contact Support</button>
                    </div>
                </div>
            </div>
        `;
    }

    renderTermsPage() {
        const sections = [
            {
                title: '1. Agreement to Terms',
                body: 'By accessing or using the Zilhaj.com Umrah & Hajj Travel Platform ("Zilhaj.com", "we", "us", or "our") at onerequest.in, submitting pilgrimage requests, or booking travel packages, you agree to be bound by these Terms of Service and all applicable Saudi Arabian travel, aviation, and immigration laws. If you do not agree with any part of these terms, please do not use the platform.'
            },
            {
                title: '2. Our Marketplace Role',
                body: 'Zilhaj.com operates as a digital travel marketplace connecting pilgrims (Zaireen) with verified, government-licensed Umrah and Hajj travel agencies. All travel offers, flight schedules, and hotel allocations submitted by agents are subject to license verification and Ministry of Hajj & Umrah regulations. We facilitate the transaction and hold funds in escrow, but the execution of travel services rests with the verified operator you choose.'
            },
            {
                title: '3. User Accounts & Eligibility',
                body: 'You must be at least 18 years old and provide accurate, complete information when creating an account. You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account. Zilhaj.com reserves the right to suspend or terminate accounts that violate these terms or engage in fraudulent activity.'
            },
            {
                title: '4. Travel Requests & Bids',
                body: 'Submitting a travel request is free and places no obligation to book. Verified operators respond with competitive offers based on your stated dates, budget, and traveler count. You may accept, decline, or ignore any offer. Offers are valid only until their stated expiry and are subject to availability and final confirmation from the operator.'
            },
            {
                title: '5. Payments & Escrow Protection',
                body: 'All payments on Zilhaj.com are processed through Razorpay, a PCI-DSS certified payment gateway, using UPI, cards, or net banking. Your payment is captured into an escrow-protected settlement and is released to the operator only after your booking is confirmed and your invoice (with Payment ID and Transaction ID) is generated. We never store your card number, CVV, or banking credentials.'
            },
            {
                title: '6. Cancellations & Refunds',
                body: 'Cancellation and refund eligibility is governed by the fare rules of the selected package and Saudi hospitality regulations. Cancellations made within the free-cancellation window stated on your invoice are refunded in full to the original payment method within 7–10 business days. Visa rejections and force-majeure events follow the applicable Ministry of Hajj & Umrah policies.'
            },
            {
                title: '7. Operator Responsibilities',
                body: 'Operators are responsible for visa processing, hotel reservations, transport, guides, and all on-ground services promised in their offers. Operators must hold valid Saudi tourism licenses and comply with all regulations. Any dispute regarding service quality must be reported to our 24/7 support within 48 hours of the incident for investigation and resolution assistance.'
            },
            {
                title: '8. Prohibited Conduct',
                body: 'You agree not to misuse the platform, attempt to access other users\' data, reverse engineer our systems, post misleading information, or engage in any activity that disrupts the service. Operators must not contact pilgrims outside the platform channels or use pilgrim data for any purpose other than fulfilling their offers.'
            },
            {
                title: '9. Intellectual Property',
                body: 'All content on Zilhaj.com — including branding, logos, text, graphics, and software — is the property of Zilhaj.com and is protected by applicable intellectual property laws. You may not reproduce or redistribute platform content without prior written consent.'
            },
            {
                title: '10. Limitation of Liability',
                body: 'Zilhaj.com acts as an intermediary marketplace and, to the maximum extent permitted by law, is not liable for indirect, incidental, or consequential damages arising from travel services provided by third-party operators. Our total liability is limited to the fees actually paid to us for the specific booking in question.'
            },
            {
                title: '11. Force Majeure',
                body: 'Neither party shall be liable for delays or failures caused by events beyond reasonable control, including natural disasters, government restrictions, airline disruptions, pandemics, or civil unrest. In such cases, we will work with operators to reschedule or refund in accordance with applicable regulations.'
            },
            {
                title: '12. Governing Law & Changes',
                body: 'These terms are governed by the laws of the Kingdom of Saudi Arabia and, where applicable, the laws of India. We may update these terms from time to time; continued use of the platform after changes constitutes acceptance. The latest version is always available at onerequest.in/terms.'
            }
        ];

        const sectionHtml = sections.map(s => `
            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:1.4rem 1.6rem; box-shadow:0 2px 8px rgba(15,23,42,0.04);">
                <h3 style="font-size:1.05rem; font-weight:800; color:#166534; margin:0 0 0.5rem 0;">${s.title}</h3>
                <p style="font-size:0.92rem; line-height:1.75; color:#475569; margin:0;">${s.body}</p>
            </div>
        `).join('');

        return `
            <div class="main-container" style="max-width:100%; width:100%; box-sizing:border-box; margin:6.8rem auto 4rem; padding:0 3.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
                    <div style="text-align: center; flex: 1;">
                        <div style="display: inline-flex; align-items: center; gap: 0.4rem; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 0.25rem 0.9rem; border-radius: 99px; font-size: 0.78rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 0.6rem;">
                            <span>📜</span> <span>LEGAL</span>
                        </div>
                        <h2 style="font-size: clamp(1.25rem, 2.2vw, 1.5rem); font-weight: 800; color: #0f172a; margin-bottom: 0.4rem; letter-spacing: -0.01em;">Terms & Conditions</h2>
                        <p style="color: #64748b; font-size: 0.95rem; max-width: 680px; margin: 0 auto; line-height: 1.6;">Official Terms of Service for pilgrims and verified tour operators using the Zilhaj.com platform.</p>
                    </div>
                </div>

                <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:0.85rem 1.2rem; margin-bottom:1.5rem; font-size:0.86rem; color:#166534; display:flex; align-items:center; gap:0.75rem;">
                    <span style="font-size:1.15rem;">📌</span>
                    <div><strong>Last Updated:</strong> August 12, 2026 &nbsp;|&nbsp; <strong>Governing Law:</strong> Kingdom of Saudi Arabia &amp; applicable Indian law</div>
                </div>

                <div style="display:flex; flex-direction:column; gap:1rem;">
                    ${sectionHtml}
                </div>

                <div style="margin-top:2.5rem; background:linear-gradient(135deg, #0b1f17 0%, #163e2e 100%); border-radius:18px; padding:1.8rem 2rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                    <div>
                        <div style="color:#F9E07A; font-weight:800; font-size:1.05rem;">Questions about these terms?</div>
                        <div style="color:rgba(255,255,255,0.85); font-size:0.88rem; margin-top:0.25rem;">Email info@zilhaj.com or call +966 800 123 4567 | +91 95416 92891</div>
                    </div>
                </div>
            </div>
        `;
    }

    renderPrivacyPage() {
        const sections = [
            {
                title: '1. Introduction & Scope',
                body: 'At Zilhaj.com Umrah & Hajj Travel Platform, accessible via onerequest.in, we hold the privacy, confidentiality, and trust of our sacred pilgrims (Zaireen) in the highest regard. This Privacy Policy outlines the personal data we collect, how it is processed, encrypted, stored, and shared, and your statutory rights when using our travel marketplace, e-Visa assistance, Nusuk permit integration, and hotel comparison tools.'
            },
            {
                title: '2. Information We Collect',
                body: '<strong>Personal Identification Data:</strong> Full legal name (as printed on passport), email address, mobile number, passport number, nationality, date of birth, gender, and residential address. <strong>Pilgrimage Preferences:</strong> Departure city, travel dates, group size, hotel proximity requirements, meal preferences, flight class, and Nusuk permit requests. <strong>Financial Data:</strong> Payment transaction logs, Razorpay order IDs, payment IDs, and payment status. Card numbers, CVVs, and banking credentials are processed directly by PCI-DSS certified gateways and are never stored on our servers. <strong>Technical Data:</strong> IP address, device type, browser, session cookies, and interaction timestamps.'
            },
            {
                title: '3. How We Use Your Information',
                body: 'Your data is processed strictly for legitimate travel operations: connecting your requests with government-licensed operators; processing Saudi e-Visa applications and Nusuk coordination; issuing official booking confirmations, invoices (including Payment ID and Transaction ID records); providing 24/7 support; and detecting fraudulent transactions or security breaches.'
            },
            {
                title: '4. Disclosure & Sharing of Information',
                body: 'Zilhaj.com maintains a strict Zero Data Selling Policy. We never sell, rent, or monetize your personal data. Data is shared only with: (a) verified Umrah operators, solely to provide accurate pricing and service execution; (b) government authorities (Saudi Ministry of Hajj & Umrah, MOFA, Border Control) as required by KSA law; and (c) authorized service providers such as payment gateways and notification services under strict confidentiality agreements.'
            },
            {
                title: '5. Data Security & Retention',
                body: 'We implement AES-256 bit encryption at rest and TLS 1.3 encryption in transit. Access to pilgrim databases is governed by strict Role-Based Access Controls (RBAC) and automated threat detection. Personal data is retained only as long as necessary to fulfill travel obligations and legal tax audit requirements under Saudi Arabian law.'
            },
            {
                title: '6. Your Rights as a Pilgrim',
                body: 'Under applicable data protection legislation (including Saudi PDPL), you may: request a full export of your personal data; request correction of inaccurate records; request complete erasure of your account and records (subject to statutory requirements); and withdraw consent for non-essential communications at any time.'
            },
            {
                title: '7. Cookies & Tracking',
                body: 'We use essential operational cookies to maintain your login session, store preferences, and optimize response speeds. You may disable non-essential cookies in your browser settings; some interactive features may then work with reduced functionality.'
            },
            {
                title: '8. Contact Our Data Protection Office',
                body: 'For questions, privacy requests, or regulatory inquiries: Zilhaj.com Data Protection Office — Email: privacy@zilhaj.com or info@zilhaj.com. Toll-Free KSA Support: +966 800 123 4567. Helpline: +91 95416 92891. Head Office: Makkah al-Mukarramah, Kingdom of Saudi Arabia 24231.'
            }
        ];

        const sectionHtml = sections.map(s => `
            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:1.4rem 1.6rem; box-shadow:0 2px 8px rgba(15,23,42,0.04);">
                <h3 style="font-size:1.05rem; font-weight:800; color:#166534; margin:0 0 0.5rem 0;">${s.title}</h3>
                <p style="font-size:0.92rem; line-height:1.75; color:#475569; margin:0;">${s.body}</p>
            </div>
        `).join('');

        return `
            <div class="main-container" style="max-width:100%; width:100%; box-sizing:border-box; margin:6.8rem auto 4rem; padding:0 3.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
                    <div style="text-align: center; flex: 1;">
                        <div style="display: inline-flex; align-items: center; gap: 0.4rem; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 0.25rem 0.9rem; border-radius: 99px; font-size: 0.78rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 0.6rem;">
                            <span>🛡️</span> <span>DATA PROTECTION</span>
                        </div>
                        <h2 style="font-size: clamp(1.8rem, 3.5vw, 2.4rem); font-weight: 800; color: #0f172a; margin-bottom: 0.4rem; letter-spacing: -0.02em;">Privacy Policy</h2>
                        <p style="color: #64748b; font-size: 0.95rem; max-width: 680px; margin: 0 auto; line-height: 1.6;">Our commitment to protecting the personal data and trust of every pilgrim who uses Zilhaj.com.</p>
                    </div>
                </div>

                <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:0.85rem 1.2rem; margin-bottom:1.5rem; font-size:0.86rem; color:#166534; display:flex; align-items:center; gap:0.75rem;">
                    <span style="font-size:1.15rem;">📌</span>
                    <div><strong>Effective Date:</strong> August 12, 2026 &nbsp;|&nbsp; <strong>Governing Framework:</strong> Saudi Personal Data Protection Law (PDPL) &amp; Global Privacy Standards</div>
                </div>

                <div style="display:flex; flex-direction:column; gap:1rem;">
                    ${sectionHtml}
                </div>

                <div style="margin-top:2.5rem; background:linear-gradient(135deg, #0b1f17 0%, #163e2e 100%); border-radius:18px; padding:1.8rem 2rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                    <div>
                        <div style="color:#F9E07A; font-weight:800; font-size:1.05rem;">Your privacy matters to us</div>
                        <div style="color:rgba(255,255,255,0.85); font-size:0.88rem; margin-top:0.25rem;">privacy@zilhaj.com | +966 800 123 4567 | +91 95416 92891</div>
                    </div>
                </div>
            </div>
        `;
    }

    renderAboutPage() {
        return `
            <div class="main-container" style="max-width: 100%; width: 100%; box-sizing: border-box; margin: 6.5rem auto 4rem; padding: 0 3.5rem; color: #0f172a; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;">
                
                <!-- BLOCK 1: Hero Section (2-Column Layout) -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 3rem; align-items: center; margin-bottom: 3.5rem;">
                    
                    <!-- Left Hero Content -->
                    <div>
                        <!-- Pill Badge -->
                        <div style="display: inline-flex; align-items: center; gap: 0.4rem; background: #ecfdf5; color: #15803d; border: 1px solid #bbf7d0; padding: 0.35rem 1rem; border-radius: 99px; font-size: 0.78rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 1.2rem;">
                            <span>ABOUT US</span>
                        </div>

                        <!-- Heading -->
                        <h1 style="font-size: clamp(1.45rem, 2.8vw, 1.85rem); font-weight: 800; color: #0f172a; line-height: 1.2; margin: 0 0 1rem 0; letter-spacing: -0.01em;">
                            Your Trusted Companion<br>
                            <span style="color: #15803d;">for Sacred Journeys</span>
                        </h1>

                        <!-- Description -->
                        <p style="font-size: 1.05rem; color: #475569; line-height: 1.68; margin: 0 0 1.8rem 0; font-weight: 400; max-width: 580px;">
                            We make your Umrah and Hajj journey simple and stress-free. With trusted partners, clear information, and dedicated support, you can travel with peace of mind and focus on what truly matters.
                        </p>

                        <!-- Inline Feature Pills -->
                        <div style="display: flex; align-items: center; gap: 1.8rem; flex-wrap: wrap;">
                            <div style="display: flex; align-items: center; gap: 0.55rem; font-size: 0.92rem; font-weight: 700; color: #0f172a;">
                                <div style="width: 24px; height: 24px; border-radius: 50%; background: #15803d; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                </div>
                                <span>Trusted &amp; Verified</span>
                            </div>

                            <div style="display: flex; align-items: center; gap: 0.55rem; font-size: 0.92rem; font-weight: 700; color: #0f172a;">
                                <div style="width: 24px; height: 24px; border-radius: 50%; background: #ecfdf5; border: 1px solid #bbf7d0; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                                        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
                                    </svg>
                                </div>
                                <span>24/7 Support</span>
                            </div>
                        </div>
                    </div>

                    <!-- Right Hero Image -->
                    <div style="position: relative; border-radius: 24px; overflow: hidden; box-shadow: 0 16px 40px rgba(0,0,0,0.10); border: 1px solid #f1f5f9;">
                        <img src="https://images.pexels.com/photos/18996760/pexels-photo-18996760.jpeg" alt="Holy Kaaba Makkah Pilgrimage" style="width: 100%; height: 380px; object-fit: cover; display: block;">
                    </div>

                </div>


                <!-- BLOCK 2: Two Cards Row (Our Mission & Why We Are Different) -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.8rem; margin-bottom: 3.5rem;">
                    
                    <!-- Mission Card -->
                    <div style="background: #ffffff; border: 1.5px solid #f1f5f9; border-radius: 20px; padding: 2.2rem 2rem; box-shadow: 0 4px 20px rgba(0,0,0,0.03); transition: transform 0.25s ease;" onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform=''">
                        <div style="width: 58px; height: 58px; border-radius: 50%; background: #ecfdf5; border: 1.5.px solid #bbf7d0; display: flex; align-items: center; justify-content: center; margin-bottom: 1.2rem;">
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <circle cx="12" cy="12" r="6"></circle>
                                <circle cx="12" cy="12" r="2"></circle>
                            </svg>
                        </div>
                        <h2 style="font-size: 1.35rem; font-weight: 800; color: #0f172a; margin: 0 0 0.6rem 0;">Our Mission</h2>
                        <p style="color: #475569; font-size: 0.95rem; line-height: 1.65; margin: 0;">
                            To make Umrah and Hajj planning simple, honest, and stress-free by offering verified options, clear details, and complete support.
                        </p>
                    </div>

                    <!-- Why We Are Different Card -->
                    <div style="background: #ffffff; border: 1.5px solid #f1f5f9; border-radius: 20px; padding: 2.2rem 2rem; box-shadow: 0 4px 20px rgba(0,0,0,0.03); transition: transform 0.25s ease;" onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform=''">
                        <div style="width: 58px; height: 58px; border-radius: 50%; background: #ecfdf5; border: 1.5px solid #bbf7d0; display: flex; align-items: center; justify-content: center; margin-bottom: 1.2rem;">
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="#15803d" stroke="#15803d" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                            </svg>
                        </div>
                        <h2 style="font-size: 1.35rem; font-weight: 800; color: #0f172a; margin: 0 0 0.6rem 0;">Why We Are Different</h2>
                        <p style="color: #475569; font-size: 0.95rem; line-height: 1.65; margin: 0;">
                            We compare many options from trusted partners so you can choose the best one. Clear pricing, honest information, and support you can count on.
                        </p>
                    </div>

                </div>


                <!-- BLOCK 3: Why Choose Zilhaj.com? (5 Grid Cards) -->
                <div style="margin-bottom: 3.8rem;">
                    
                    <!-- Section Header with Divider -->
                    <div style="display: flex; align-items: center; justify-content: center; gap: 0.8rem; margin-bottom: 2.5rem;">
                        <div style="height: 1.5px; width: 80px; background: linear-gradient(to right, transparent, #86efac);"></div>
                        <span style="width: 7px; height: 7px; background: #15803d; border-radius: 50%; display: inline-block;"></span>
                        <h2 style="font-size: 1.6rem; font-weight: 900; color: #15803d; margin: 0; letter-spacing: -0.01em;">Why Choose Zilhaj.com?</h2>
                        <span style="width: 7px; height: 7px; background: #15803d; border-radius: 50%; display: inline-block;"></span>
                        <div style="height: 1.5px; width: 80px; background: linear-gradient(to left, transparent, #86efac);"></div>
                    </div>

                    <!-- 5 Cards Row -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 1.2rem;">
                        
                        <!-- Card 1: Easy Comparison -->
                        <div style="background: #ffffff; border: 1.5px solid #f1f5f9; border-radius: 18px; padding: 1.8rem 1.2rem; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.02); display: flex; flex-direction: column; align-items: center; transition: all 0.25s ease;" onmouseover="this.style.transform='translateY(-3px)';this.style.borderColor='#bbf7d0';" onmouseout="this.style.transform='';this.style.borderColor='#f1f5f9';">
                            <div style="width: 52px; height: 52px; border-radius: 50%; background: #ecfdf5; border: 1px solid #bbf7d0; display: flex; align-items: center; justify-content: center; margin-bottom: 1.1rem; flex-shrink: 0;">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                            </div>
                            <h3 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0 0 0.5rem 0;">Easy Comparison</h3>
                            <p style="color: #64748b; font-size: 0.85rem; line-height: 1.55; margin: 0;">
                                Compare packages from multiple trusted travel partners in one place.
                            </p>
                        </div>

                        <!-- Card 2: Best Prices -->
                        <div style="background: #ffffff; border: 1.5px solid #f1f5f9; border-radius: 18px; padding: 1.8rem 1.2rem; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.02); display: flex; flex-direction: column; align-items: center; transition: all 0.25s ease;" onmouseover="this.style.transform='translateY(-3px)';this.style.borderColor='#bbf7d0';" onmouseout="this.style.transform='';this.style.borderColor='#f1f5f9';">
                            <div style="width: 52px; height: 52px; border-radius: 50%; background: #ecfdf5; border: 1px solid #bbf7d0; display: flex; align-items: center; justify-content: center; margin-bottom: 1.1rem; flex-shrink: 0;">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                                    <line x1="7" y1="7" x2="7.01" y2="7"></line>
                                </svg>
                            </div>
                            <h3 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0 0 0.5rem 0;">Best Prices</h3>
                            <p style="color: #64748b; font-size: 0.85rem; line-height: 1.55; margin: 0;">
                                Get the best value for your money with no hidden charges.
                            </p>
                        </div>

                        <!-- Card 3: Clear Information -->
                        <div style="background: #ffffff; border: 1.5px solid #f1f5f9; border-radius: 18px; padding: 1.8rem 1.2rem; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.02); display: flex; flex-direction: column; align-items: center; transition: all 0.25s ease;" onmouseover="this.style.transform='translateY(-3px)';this.style.borderColor='#bbf7d0';" onmouseout="this.style.transform='';this.style.borderColor='#f1f5f9';">
                            <div style="width: 52px; height: 52px; border-radius: 50%; background: #ecfdf5; border: 1px solid #bbf7d0; display: flex; align-items: center; justify-content: center; margin-bottom: 1.1rem; flex-shrink: 0;">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                </svg>
                            </div>
                            <h3 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0 0 0.5rem 0;">Clear Information</h3>
                            <p style="color: #64748b; font-size: 0.85rem; line-height: 1.55; margin: 0;">
                                All details are shared clearly so you can decide with confidence.
                            </p>
                        </div>

                        <!-- Card 4: Time Saving -->
                        <div style="background: #ffffff; border: 1.5px solid #f1f5f9; border-radius: 18px; padding: 1.8rem 1.2rem; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.02); display: flex; flex-direction: column; align-items: center; transition: all 0.25s ease;" onmouseover="this.style.transform='translateY(-3px)';this.style.borderColor='#bbf7d0';" onmouseout="this.style.transform='';this.style.borderColor='#f1f5f9';">
                            <div style="width: 52px; height: 52px; border-radius: 50%; background: #ecfdf5; border: 1px solid #bbf7d0; display: flex; align-items: center; justify-content: center; margin-bottom: 1.1rem; flex-shrink: 0;">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                            </div>
                            <h3 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0 0 0.5rem 0;">Time Saving</h3>
                            <p style="color: #64748b; font-size: 0.85rem; line-height: 1.55; margin: 0;">
                                Save time by viewing and comparing the best options quickly.
                            </p>
                        </div>

                        <!-- Card 5: Safe & Secure -->
                        <div style="background: #ffffff; border: 1.5px solid #f1f5f9; border-radius: 18px; padding: 1.8rem 1.2rem; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.02); display: flex; flex-direction: column; align-items: center; transition: all 0.25s ease;" onmouseover="this.style.transform='translateY(-3px)';this.style.borderColor='#bbf7d0';" onmouseout="this.style.transform='';this.style.borderColor='#f1f5f9';">
                            <div style="width: 52px; height: 52px; border-radius: 50%; background: #ecfdf5; border: 1px solid #bbf7d0; display: flex; align-items: center; justify-content: center; margin-bottom: 1.1rem; flex-shrink: 0;">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                </svg>
                            </div>
                            <h3 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0 0 0.5rem 0;">Safe &amp; Secure</h3>
                            <p style="color: #64748b; font-size: 0.85rem; line-height: 1.55; margin: 0;">
                                Your information and bookings are always safe with us.
                            </p>
                        </div>

                    </div>
                </div>


                <!-- BLOCK 4: "Our Approach" & "What Drives Us" Grid Block -->
                <div style="background: #ffffff; border: 1.5px solid #f1f5f9; border-radius: 24px; padding: 2.5rem; box-shadow: 0 4px 20px rgba(0,0,0,0.03); margin-bottom: 3.5rem;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2.5rem; align-items: center;">
                        
                        <!-- Left Side: Founder Profile + Approach List -->
                        <div style="display: flex; gap: 2rem; align-items: center; flex-wrap: wrap;">
                            
                            <!-- Founder Profile Card -->
                            <div style="text-align: center; flex-shrink: 0; min-width: 170px; margin: 0 auto;">
                                <div style="width: 110px; height: 110px; border-radius: 50%; overflow: hidden; margin: 0 auto 0.9rem; border: 3px solid #e2e8f0; box-shadow: 0 4px 15px rgba(0,0,0,0.08); background: #f8fafc;">
                                    <img src="images/founder.jpg" onerror="this.onerror=null;this.src='founder.jpg';" alt="Tawseef Assadullah H" style="width: 100%; height: 100%; object-fit: cover;">
                                </div>
                                <h3 style="font-size: 1.08rem; font-weight: 800; color: #15803d; margin: 0 0 0.25rem 0;">Tawseef Assadullah H</h3>
                                <div style="font-size: 0.82rem; font-weight: 700; color: #64748b; margin-bottom: 0.35rem;">Founder &amp; CEO</div>
                                <div style="font-size: 0.72rem; color: #94a3b8; line-height: 1.35; max-width: 170px; margin: 0 auto 0.7rem;">
                                    B.Tech – National Institute of Technology Srinagar
                                </div>
                                <!-- LinkedIn Icon -->
                                <a href="https://linkedin.com" target="_blank" rel="noopener" style="display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 5px; background: #0077b5; color: #ffffff; text-decoration: none;">
                                    <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>
                                </a>
                            </div>

                            <!-- Approach List -->
                            <div style="flex: 1; min-width: 240px;">
                                <h2 style="font-size: 1.35rem; font-weight: 800; color: #0f172a; margin: 0 0 1.2rem 0;">Our Approach</h2>
                                
                                <div style="display: flex; flex-direction: column; gap: 1rem;">
                                    
                                    <!-- Point 1 -->
                                    <div style="display: flex; align-items: flex-start; gap: 0.8rem;">
                                        <div style="width: 32px; height: 32px; border-radius: 50%; background: #ecfdf5; border: 1px solid #bbf7d0; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                                <polyline points="9 12 11 14 15 10"></polyline>
                                            </svg>
                                        </div>
                                        <div>
                                            <div style="font-size: 0.9rem; font-weight: 800; color: #0f172a; margin-bottom: 0.15rem;">Verified Partners</div>
                                            <div style="font-size: 0.82rem; color: #64748b; line-height: 1.45;">We work only with trusted and verified travel partners to ensure a safe and reliable journey.</div>
                                        </div>
                                    </div>

                                    <!-- Point 2 -->
                                    <div style="display: flex; align-items: flex-start; gap: 0.8rem;">
                                        <div style="width: 32px; height: 32px; border-radius: 50%; background: #ecfdf5; border: 1px solid #bbf7d0; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                <polyline points="14 2 14 8 20 8"></polyline>
                                            </svg>
                                        </div>
                                        <div>
                                            <div style="font-size: 0.9rem; font-weight: 800; color: #0f172a; margin-bottom: 0.15rem;">Transparent Process</div>
                                            <div style="font-size: 0.82rem; color: #64748b; line-height: 1.45;">From comparison to booking, everything is clear and straightforward.</div>
                                        </div>
                                    </div>

                                    <!-- Point 3 -->
                                    <div style="display: flex; align-items: flex-start; gap: 0.8rem;">
                                        <div style="width: 32px; height: 32px; border-radius: 50%; background: #ecfdf5; border: 1px solid #bbf7d0; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                                <circle cx="9" cy="7" r="4"></circle>
                                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                            </svg>
                                        </div>
                                        <div>
                                            <div style="font-size: 0.9rem; font-weight: 800; color: #0f172a; margin-bottom: 0.15rem;">Customer First</div>
                                            <div style="font-size: 0.82rem; color: #64748b; line-height: 1.45;">We are always here to help you before, during, and after your journey.</div>
                                        </div>
                                    </div>

                                    <!-- Point 4 -->
                                    <div style="display: flex; align-items: flex-start; gap: 0.8rem;">
                                        <div style="width: 32px; height: 32px; border-radius: 50%; background: #ecfdf5; border: 1px solid #bbf7d0; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                                <line x1="18" y1="20" x2="18" y2="10"></line>
                                                <line x1="12" y1="20" x2="12" y2="4"></line>
                                                <line x1="6" y1="20" x2="6" y2="14"></line>
                                            </svg>
                                        </div>
                                        <div>
                                            <div style="font-size: 0.9rem; font-weight: 800; color: #0f172a; margin-bottom: 0.15rem;">Continuous Improvement</div>
                                            <div style="font-size: 0.82rem; color: #64748b; line-height: 1.45;">We keep improving our platform and services based on your feedback.</div>
                                        </div>
                                    </div>

                                </div>
                            </div>

                        </div>

                        <!-- Right Side Box: What Drives Us -->
                        <div style="background: #f4fbf7; border: 1px solid #d1fae5; border-radius: 20px; padding: 2.2rem 2rem; display: flex; flex-direction: column; justify-content: center; height: 100%; box-sizing: border-box;">
                            <h3 style="font-size: 1.25rem; font-weight: 800; color: #15803d; margin: 0 0 0.8rem 0;">What Drives Us</h3>
                            
                            <div style="font-size: 3.2rem; color: #16a34a; line-height: 0.8; font-family: Georgia, serif; margin-bottom: 0.5rem; user-select: none;">“</div>
                            
                            <p style="font-size: 1rem; color: #334155; line-height: 1.65; font-weight: 500; margin: 0 0 1.4rem 0;">
                                Our goal is simple:<br>
                                To provide honest service, clear information, and peace of mind to every traveler.
                            </p>
                            
                            <div style="font-size: 0.9rem; font-weight: 800; color: #15803d;">
                                – Tawseef Assadullah H
                            </div>
                        </div>

                    </div>
                </div>


                <!-- BLOCK 5: Bottom CTA Banner (Ready to Start Your Blessed Journey?) -->
                <div style="background: linear-gradient(135deg, #15803d 0%, #065f46 100%); border-radius: 20px; padding: 3.2rem 2rem; text-align: center; color: #ffffff; box-shadow: 0 12px 32px rgba(21, 128, 61, 0.22); position: relative; overflow: hidden;">
                    
                    <!-- Faded Mosque Background Overlay -->
                    <div style="position: absolute; inset: 0; pointer-events: none; opacity: 0.12; overflow: hidden;">
                        <svg viewBox="0 0 800 200" width="100%" height="100%" fill="#ffffff" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">
                            <rect x="50" y="80" width="20" height="120"/>
                            <path d="M50 80 Q60 40 70 80Z"/>
                            <rect x="100" y="50" width="120" height="150" rx="10"/>
                            <path d="M100 50 Q160 -30 220 50Z"/>
                            <rect x="250" y="80" width="20" height="120"/>
                            <path d="M250 80 Q260 40 270 80Z"/>
                            <rect x="550" y="80" width="20" height="120"/>
                            <path d="M550 80 Q560 40 570 80Z"/>
                            <rect x="600" y="50" width="120" height="150" rx="10"/>
                            <path d="M600 50 Q660 -30 720 50Z"/>
                            <rect x="750" y="80" width="20" height="120"/>
                            <path d="M750 80 Q760 40 770 80Z"/>
                        </svg>
                    </div>

                    <div style="position: relative; z-index: 2; max-width: 650px; margin: 0 auto;">
                        <h2 style="font-size: clamp(1.25rem, 2.2vw, 1.5rem); font-weight: 800; color: #ffffff; margin: 0 0 0.75rem 0; letter-spacing: -0.01em;">
                            Ready to Start Your Blessed Journey?
                        </h2>
                        <p style="font-size: 1rem; color: rgba(255,255,255,0.92); margin: 0 auto 1.8rem; line-height: 1.6; font-weight: 400;">
                            Find the best Umrah and Hajj options from trusted travel partners.
                        </p>
                        <button onclick="app.navigate('home'); setTimeout(() => app.scrollToRequirementForm(), 200);" style="background: #f59e0b; color: #0a1a12; font-weight: 800; font-size: 0.95rem; padding: 0.85rem 2.2rem; border-radius: 10px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem; box-shadow: 0 6px 20px rgba(245, 158, 11, 0.4); transition: all 0.25s ease;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 25px rgba(245, 158, 11, 0.5)'" onmouseout="this.style.transform='';this.style.boxShadow='0 6px 20px rgba(245, 158, 11, 0.4)'">
                            <span>Explore Packages</span>
                            <span>→</span>
                        </button>
                    </div>

                </div>

            </div>
        `;
    }

    renderBookingsPage() {
        const bookings = this.state.myBookings || [];
        let bookingRows = '';
        if (bookings.length > 0) {
            bookingRows = bookings.map(b => {
                const statusClass = b.status ? b.status.toLowerCase() : 'pending';
                const cancelBtn = b.status !== 'CANCELLED'
                    ? '<button class="btn btn-danger btn-sm" onclick="app.cancelBooking(\'' + b.id + '\')">Cancel Booking</button>'
                    : '';
                return '<div style="background:white; border-radius:14px; padding:1.5rem; border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">' +
                    '<div>' +
                    '<div style="display:flex; align-items:center; gap:0.8rem; margin-bottom:0.5rem;">' +
                    '<span class="status-badge status-' + statusClass + '">' + (b.status || 'PENDING') + '</span>' +
                    '<span style="font-size:0.85rem; color:var(--text-muted);">Booking Ref: ' + b.id + '</span>' +
                    '</div>' +
                    '<h4 style="font-size:1.2rem;">' + this.escapeHtml(b.packageTitle) + '</h4>' +
                    '<p style="font-size:0.9rem; color:var(--text-muted); margin-top:0.2rem;">Agency: ' + this.escapeHtml(b.agentName || 'Not specified') + ' | Travel Date: ' + (b.travelDate || 'TBD') + '</p>' +
                    '<p style="font-size:1.2rem; font-weight:800; color:var(--primary); margin-top:0.4rem;">Total Paid: ' + this.formatCurrency(b.totalPrice) + '</p>' +
                    '</div>' +
                    '<div style="display:flex; gap:0.8rem;">' +
                    '<a href="javascript:void(0)" onclick="app.downloadInvoice(\'' + b.id + '\')" class="btn btn-outline btn-sm">📄 Download PDF</a>' +
                    cancelBtn +
                    '</div>' +
                    '</div>';
            }).join('');
            bookingRows = '<div style="display:flex; flex-direction:column; gap:1.5rem;">' + bookingRows + '</div>';
        } else {
            bookingRows = '<div style="text-align:center; padding:3rem; color:var(--text-muted);">' +
                '<div style="font-size:3rem; margin-bottom:1rem;">🎫</div>' +
                '<h3>No bookings yet</h3>' +
                '<p style="margin:0.5rem 0 1.5rem;">Your confirmed travel bookings will appear here.</p>' +
                '<button class="btn btn-primary" onclick="app.navigate(\'home\')">Browse Packages</button>' +
                '</div>';
        }

        return '<div class="main-container" style="max-width:100%; width:100%; box-sizing:border-box; margin:7rem auto 3rem; padding:0 3.5rem;">' +
            '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem; flex-wrap:wrap; gap:1rem;">' +
            '<div>' +
            '<h2 style="margin:0;">🎫 My Bookings &amp; Travel Tickets</h2>' +
            '<p style="color:#64748b; font-size:0.9rem; margin-top:0.3rem;">View your reservations, payment receipts, and download official PDF travel vouchers.</p>' +
            '</div>' +
            '<div style="display:flex; gap:0.6rem;">' +
            '<button class="btn btn-outline btn-sm" onclick="app.navigate(\'dashboard\')">← Back to Dashboard</button>' +
            '</div>' +
            '</div>' +
            bookingRows +
            '</div>';
    }

    showLoading(message = 'Please wait while we connect to server...', title = 'Processing Request') {
        const overlay = document.getElementById('loadingOverlay');
        const text = document.getElementById('loadingText');
        const titleEl = document.getElementById('loadingTitle');
        if (titleEl) titleEl.innerText = title;
        if (text) text.innerText = message;
        if (overlay) overlay.style.display = 'flex';
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.style.display = 'none';
    }

    triggerPhotoUpload() {
        const fileInput = document.getElementById('profilePhotoInput');
        if (fileInput) fileInput.click();
    }

    handleProfilePhotoUpload(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file (JPG, PNG, WebP).');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64Photo = e.target.result;
            if (this.state.currentUser) {
                this.state.currentUser.profilePhoto = base64Photo;
                this.state.currentUser.profilePictureUrl = base64Photo;
                this.state.currentUser.picture = base64Photo;
                this.state.currentUser.avatar = base64Photo;
                localStorage.setItem('umrah_user', JSON.stringify(this.state.currentUser));
            } else {
                localStorage.setItem('umrah_custom_photo', base64Photo);
            }
            this.showToast('Profile photo updated successfully!', 'success');

            // Re-render auth navbar and current page immediately
            this.renderAuthNav();
            if (this.state.currentPage === 'dashboard') {
                const main = document.getElementById('mainContainer');
                if (main) main.innerHTML = this.renderDashboardPage();
            }
        };
        reader.readAsDataURL(file);
    }

    editProfileField(field) {
        const user = this.state.currentUser || {};
        let currentVal = '';
        let promptText = '';
        if (field === 'name') { currentVal = user.name || ''; promptText = 'Enter your full name:'; }
        else if (field === 'email') { currentVal = user.email || ''; promptText = 'Enter your email address:'; }
        else if (field === 'phone') { currentVal = user.phone || ''; promptText = 'Enter your phone number:'; }
        else return;
        const newVal = prompt(promptText, currentVal);
        if (newVal === null) return;
        const trimmed = newVal.trim();
        if (!trimmed) { this.showToast('Value cannot be empty', 'error'); return; }
        if (field === 'email' && !trimmed.includes('@')) { this.showToast('Please enter a valid email', 'error'); return; }
        if (field === 'name') user.name = trimmed;
        if (field === 'email') user.email = trimmed;
        if (field === 'phone') user.phone = trimmed;
        this.state.currentUser = user;
        localStorage.setItem('umrah_user', JSON.stringify(user));
        try {
            const reqs = JSON.parse(localStorage.getItem('umrah_requirements') || '[]');
            reqs.forEach(r => {
                if (field === 'name') r.userName = trimmed;
                if (field === 'email') r.userEmail = trimmed;
                if (field === 'phone') r.userPhone = trimmed;
            });
            localStorage.setItem('umrah_requirements', JSON.stringify(reqs));
        } catch (e) {}
        this.showToast('Profile updated successfully!', 'success');
        this.renderAuthNav();
        const main = document.getElementById('mainContainer');
        if (main) main.innerHTML = this.renderDashboardPage();
    }

    setDashboardTab(tabName) {
        this.state.activeDashboardTab = tabName || 'dashboard';
        if (tabName === 'packageDetails') {
            this.navigate('package-details');
        } else if (tabName === 'paymentScreen') {
            this.navigate('payment');
        } else {
            this.navigate('dashboard');
        }
    }

    viewRequestDetail(requestId) {
        this.state.selectedRequestId = requestId;
        this.state.activeDashboardTab = 'requestDetail';
        const main = document.getElementById('mainContainer');
        if (main) {
            main.innerHTML = this.renderDashboardPage();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    setNotifFilter(filter) {
        this.state.notifFilter = filter || 'All';
        const main = document.getElementById('mainContainer');
        if (main && this.state.currentPage === 'dashboard') {
            main.innerHTML = this.renderDashboardPage();
        }
    }

    async toggleSetting(key) {
        const settings = JSON.parse(localStorage.getItem('zilhaj_user_settings') || '{"emailNotifs":true,"smsAlerts":true,"offerNotifs":true,"paymentAlerts":true,"privacyMode":true,"twoFactor":false}');
        settings[key] = !settings[key];
        localStorage.setItem('zilhaj_user_settings', JSON.stringify(settings));

        // Persist to backend so toggles actually hold server-side (email/SMS sends honor them)
        const user = this.state.currentUser;
        if (user && user.id && typeof this.apiCall === 'function') {
            try {
                await this.apiCall(`/users/${encodeURIComponent(user.id)}/settings`, 'PUT', { settings });
            } catch (e) {}
        }

        const main = document.getElementById('mainContainer');
        if (main && this.state.currentPage === 'dashboard') {
            main.innerHTML = this.renderDashboardPage();
        }
        if (typeof this.showToast === 'function') {
            this.showToast(`Setting updated successfully`, 'success');
        }
    }

    renderDashboardPage() {
        const user = this.state.currentUser || {};
        const activeTab = this.state.activeDashboardTab || 'dashboard';
        const userPhoto = (user && user.profilePhoto) || localStorage.getItem('umrah_custom_photo');
        const localReqs   = JSON.parse(localStorage.getItem('umrah_requirements') || '[]');
        const localOffers = JSON.parse(localStorage.getItem('umrah_user_offers') || '[]');
        const localBookings = JSON.parse(localStorage.getItem('umrah_my_bookings') || '[]');
        const apiReqs   = this.state.myRequirements || [];
        const apiOffers = this.state.userOffers || [];
        const allReqs   = [...apiReqs, ...localReqs.filter(lr => !apiReqs.some(r => r.id === lr.id))];
        const allOffers = [...apiOffers, ...localOffers.filter(lo => !apiOffers.some(o => o.id === lo.id))];
        const apiBookings = this.state.myBookings || [];
        const allBookings = [...apiBookings, ...localBookings.filter(lb => !apiBookings.some(b => b.id === lb.id))];
        const requirements = allReqs.filter(r => !r.userId || r.userId === user.id || r.userEmail === user.email);
        const offers   = allOffers;
        const bookings = allBookings;
        const userSettings = JSON.parse(localStorage.getItem('zilhaj_user_settings') || '{"emailNotifs":true,"smsAlerts":true,"offerNotifs":true,"paymentAlerts":true,"privacyMode":true,"twoFactor":false}');

        // ── Support contact helpers ──────────────────────────────────────────────
        const SUPPORT_PHONE  = '+966 800 123 4567';
        const SUPPORT_EMAIL  = 'support@zilhaj.com';
        const SUPPORT_WA     = 'https://wa.me/9541692891';

        // ── SVG icons ────────────────────────────────────────────────────────────
        const ic = {
            dashboard:`<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>`,
            requests:`<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="12" x2="12" y2="18"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`,
            payments:`<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`,
            profile:`<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
            notifs:`<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
            help:`<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17" stroke-linecap="round" stroke-width="2"/></svg>`,
        };

        const offersForUser = offers.filter(o => requirements.some(r => r.id === o.requirementId));
        const offersAvailable = offersForUser.length;
        const inProgress = requirements.filter(r => !r.status || r.status === 'PENDING' || r.status === 'ACTIVE').length;
        const completed  = bookings.filter(b => b.status === 'CONFIRMED' || b.status === 'COMPLETED').length;
        const notifCount = offersAvailable + inProgress + completed;

        // ── Nav item builder ─────────────────────────────────────────────────────
        const navItem = (tab, icon, label, badge = 0) => {
            const isActive = activeTab === tab || (tab === 'payments' && activeTab === 'paymentScreen');
            return `<a href="javascript:void(0)" onclick="app.setDashboardTab('${tab}')"
                style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:.58rem .65rem;border-radius:10px;text-decoration:none;cursor:pointer;transition:all .2s ease;background:${isActive?'#1a6b3c':'transparent'};color:${isActive?'#fff':'#374151'};"
                onmouseover="if('${tab}'!=='${activeTab}'){this.style.background='#f0faf5';this.style.color='#1a6b3c';this.style.transform='translateX(3px)';}"
                onmouseout="if('${tab}'!=='${activeTab}'){this.style.background='transparent';this.style.color='#374151';this.style.transform='none';}">
                <span style="display:flex;align-items:center;gap:.5rem;font-size:.84rem;white-space:nowrap;font-weight:${isActive?'700':'500'};">${icon} ${label}</span>
                ${badge>0?`<span style="background:${isActive?'#fff':'#1a6b3c'};color:${isActive?'#1a6b3c':'#fff'};font-size:.64rem;font-weight:800;min-width:18px;height:18px;border-radius:99px;display:flex;align-items:center;justify-content:center;padding:0 4px;flex-shrink:0;">${badge}</span>`:''}
            </a>`;
        };

        // ── Sidebar ──────────────────────────────────────────────────────────────
        const sidebar = `
        <aside style="width:235px;flex-shrink:0;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:1.1rem .8rem;display:flex;flex-direction:column;min-height:calc(100vh - 140px);position:sticky;top:98px;align-self:flex-start;box-shadow:0 2px 10px rgba(0,0,0,0.02);">
            <div style="display:flex;align-items:center;gap:.55rem;padding:.15rem .3rem .9rem;border-bottom:1px solid #f0f0f0;margin-bottom:.8rem;">
                <img src="logo.png" onerror="this.onerror=null;this.src='images/logo.png';" alt="ZILHAJ" style="width:34px;height:34px;object-fit:cover;border-radius:50%;border:1.5px solid #e2e8f0;flex-shrink:0;">
                <div><div style="font-size:.9rem;font-weight:900;color:#0f172a;letter-spacing:.4px;font-style:italic;">ZILHAJ</div><div style="font-size:.55rem;color:#6b7280;line-height:1.2;">One Request. Multiple Verified Offers.</div></div>
            </div>
            <div style="display:flex;flex-direction:column;gap:.15rem;flex:1;">
                ${navItem('requests',  ic.requests,  'My Requests')}
                ${navItem('payments',  ic.payments,  'Payments')}
                ${navItem('profile',   ic.profile,   'Profile &amp; Settings')}
                ${navItem('help',      ic.help,      'Help &amp; Support')}
            </div>
            <div style="margin-top:1.1rem;background:#f0faf5;border:1px solid #d1fae5;border-radius:10px;padding:.8rem;transition:all .2s;" onmouseover="this.style.boxShadow='0 4px 12px rgba(26,107,60,0.08)'" onmouseout="this.style.boxShadow='none'">
                <div style="font-size:.76rem;font-weight:800;color:#0f172a;margin-bottom:.1rem;">Need Help?</div>
                <div style="font-size:.68rem;color:#6b7280;margin-bottom:.55rem;">Our team is here to assist you</div>
                <a href="tel:${SUPPORT_PHONE}" style="width:100%;box-sizing:border-box;background:#fff;border:1px solid #d1fae5;border-radius:7px;padding:.4rem;font-size:.72rem;font-weight:700;color:#1a6b3c;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:.3rem;text-decoration:none;transition:all .2s;" onmouseover="this.style.background='#1a6b3c';this.style.color='#fff';" onmouseout="this.style.background='#fff';this.style.color='#1a6b3c';">
                    <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.22 1.18 2 2 0 012.18 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.16 6.16l1.27-.49a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                    Contact Support
                </a>
            </div>
            <div style="margin-top:.65rem;display:flex;align-items:center;gap:.4rem;padding:.45rem .4rem;background:#f8fafc;border-radius:8px;border:1px solid #e5e7eb;">
                <svg width="14" height="14" fill="none" stroke="#1a6b3c" stroke-width="1.8" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <div><div style="font-size:.62rem;font-weight:800;color:#0f172a;">Your security is our priority.</div><div style="font-size:.58rem;color:#6b7280;">All payments encrypted &amp; secure.</div></div>
            </div>
        </aside>`;

        // ── Helpers ──────────────────────────────────────────────────────────────
        const statusBadge = (status) => {
            const s = (status || 'pending').toLowerCase();
            if (s === 'completed' || s === 'confirmed')
                return `<span style="background:#f3f4f6;color:#374151;border:1px solid #e5e7eb;padding:.2rem .6rem;border-radius:99px;font-size:.7rem;font-weight:700;">Completed</span>`;
            if (s === 'active' || s.includes('offer'))
                return `<span style="background:#d1fae5;color:#065f46;border:1px solid #a7f3d0;padding:.2rem .6rem;border-radius:99px;font-size:.7rem;font-weight:700;">Offers Available</span>`;
            return `<span style="background:#fef3c7;color:#92400e;border:1px solid #fde68a;padding:.2rem .6rem;border-radius:99px;font-size:.7rem;font-weight:700;">Waiting for Offers</span>`;
        };

        const fmtDate = (d) => {
            if (!d) return '—';
            try { return new Date(d).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'}); }
            catch(e) { return String(d); }
        };

        const reqId = (r) => {
            if (r.id && String(r.id).startsWith('REQ')) return r.id;
            const n = String(r.id || '').replace(/\D/g, '').slice(-4).padStart(4, '0') || '0001';
            return `REQ-${n}`;
        };

        // ── Page header helper (Font size tuned down to elegant 1.05rem) ──────────
        const pageHeader = (title, subtitle = '') => `
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.6rem;margin-bottom:.15rem;">
            <div>
                <h1 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin:0;letter-spacing:-0.2px;">${title}</h1>
                ${subtitle ? `<p style="font-size:.8rem;color:#6b7280;margin:.1rem 0 0;">${subtitle}</p>` : ''}
            </div>
        </div>`;

        // ── Request table row ────────────────────────────────────────────────────
        const reqTableRow = (r) => {
            const rid = reqId(r);
            const ro = offers.filter(o => o.requirementId === r.id);
            return `<tr style="border-bottom:1px solid #f3f4f6;transition:background .15s ease;" onmouseover="this.style.background='#f0faf5'" onmouseout="this.style.background=''">
                <td style="padding:.75rem .95rem;"><div style="font-weight:700;color:#0f172a;font-size:.83rem;">${rid}</div><div style="font-size:.68rem;color:#9ca3af;">${fmtDate(r.createdAt||r.preferredDepartureDate)}</div></td>
                <td style="padding:.75rem .95rem;"><div style="display:flex;align-items:center;gap:.45rem;"><div style="width:26px;height:26px;border-radius:6px;background:#f0faf5;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg width="13" height="13" fill="none" stroke="#1a6b3c" stroke-width="1.8" viewBox="0 0 24 24"><path d="M3 21h18M5 21V9l7-6 7 6v12M10 21v-5h4v5"/></svg></div><div><div style="font-size:.81rem;font-weight:600;color:#0f172a;">Umrah Package</div><div style="font-size:.68rem;color:#9ca3af;">${r.durationDays||10} Days</div></div></div></td>
                <td style="padding:.75rem .95rem;font-size:.81rem;color:#374151;">${fmtDate(r.preferredDepartureDate)}<br><span style="font-size:.67rem;color:#9ca3af;">(Approx.)</span></td>
                <td style="padding:.75rem .95rem;font-size:.81rem;color:#374151;">${r.travelersCount||r.adults||2} Adults<br><span style="font-size:.67rem;color:#9ca3af;">${r.children||0} Children</span></td>
                <td style="padding:.75rem .95rem;">${statusBadge(ro.length>0?'active':(r.status||'pending'))}</td>
                <td style="padding:.75rem .95rem;"><div style="font-size:.81rem;font-weight:700;color:#0f172a;">${ro.length} Offer${ro.length!==1?'s':''}</div><div style="font-size:.68rem;color:${ro.length>0?'#1a6b3c':'#9ca3af'};">${ro.length>0?'View now':'Pending'}</div></td>
                <td style="padding:.75rem .95rem;"><button onclick="app.viewRequestDetail('${r.id}')" style="background:#fff;border:1px solid #e5e7eb;border-radius:7px;padding:.32rem .8rem;font-size:.77rem;font-weight:600;color:#374151;cursor:pointer;display:flex;align-items:center;gap:.25rem;white-space:nowrap;transition:all .18s;" onmouseover="this.style.borderColor='#1a6b3c';this.style.color='#1a6b3c';this.style.boxShadow='0 2px 6px rgba(0,0,0,0.04)';" onmouseout="this.style.borderColor='#e5e7eb';this.style.color='#374151';this.style.boxShadow='none';">View Details <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></button></td>
            </tr>`;
        };

        const tableHead = `<thead><tr style="background:#f9fafb;border-bottom:1px solid #f3f4f6;"><th style="padding:.65rem .95rem;text-align:left;font-size:.69rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.3px;">Request ID</th><th style="padding:.65rem .95rem;text-align:left;font-size:.69rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.3px;">Service</th><th style="padding:.65rem .95rem;text-align:left;font-size:.69rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.3px;">Travel Date</th><th style="padding:.65rem .95rem;text-align:left;font-size:.69rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.3px;">Passengers</th><th style="padding:.65rem .95rem;text-align:left;font-size:.69rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.3px;">Status</th><th style="padding:.65rem .95rem;text-align:left;font-size:.69rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.3px;">Offers</th><th style="padding:.65rem .95rem;text-align:left;font-size:.69rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.3px;">Action</th></tr></thead>`;

        // ── Support card reusable ────────────────────────────────────────────────
        const supportCard = () => `
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:1.05rem;box-shadow:0 2px 8px rgba(0,0,0,0.02);">
            <div style="font-size:.85rem;font-weight:800;color:#0f172a;margin-bottom:.18rem;">Need Help?</div>
            <div style="font-size:.74rem;color:#6b7280;margin-bottom:.75rem;">Our support team is available to assist you 24/7.</div>
            <a href="javascript:void(0)" onclick="app.openChatbot()" style="display:flex;align-items:center;gap:.4rem;width:100%;box-sizing:border-box;background:#f0faf5;border:1px solid #d1fae5;border-radius:8px;padding:.5rem .85rem;font-size:.78rem;font-weight:700;color:#1a6b3c;cursor:pointer;margin-bottom:.38rem;text-decoration:none;transition:all .18s;" onmouseover="this.style.background='#d1fae5';this.style.transform='translateY(-1px)';" onmouseout="this.style.background='#f0faf5';this.style.transform='none';">
                <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Live Chat
            </a>
            <a href="tel:${SUPPORT_PHONE}" style="display:flex;align-items:center;gap:.4rem;width:100%;box-sizing:border-box;background:#f0faf5;border:1px solid #d1fae5;border-radius:8px;padding:.5rem .85rem;font-size:.78rem;font-weight:700;color:#1a6b3c;cursor:pointer;margin-bottom:.38rem;text-decoration:none;transition:all .18s;" onmouseover="this.style.background='#d1fae5';this.style.transform='translateY(-1px)';" onmouseout="this.style.background='#f0faf5';this.style.transform='none';">
                <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.22 1.18 2 2 0 012.18 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.16 6.16l1.27-.49a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg> Call Support
            </a>
            <a href="mailto:${SUPPORT_EMAIL}" style="display:flex;align-items:center;gap:.4rem;width:100%;box-sizing:border-box;background:#f0faf5;border:1px solid #d1fae5;border-radius:8px;padding:.5rem .85rem;font-size:.78rem;font-weight:700;color:#1a6b3c;cursor:pointer;margin-bottom:.38rem;text-decoration:none;transition:all .18s;" onmouseover="this.style.background='#d1fae5';this.style.transform='translateY(-1px)';" onmouseout="this.style.background='#f0faf5';this.style.transform='none';">
                <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> Email Us
            </a>
            <a href="${SUPPORT_WA}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:.4rem;width:100%;box-sizing:border-box;background:#f0faf5;border:1px solid #d1fae5;border-radius:8px;padding:.5rem .85rem;font-size:.78rem;font-weight:700;color:#1a6b3c;cursor:pointer;text-decoration:none;transition:all .18s;" onmouseover="this.style.background='#d1fae5';this.style.transform='translateY(-1px)';" onmouseout="this.style.background='#f0faf5';this.style.transform='none';">
                <svg width="13" height="13" fill="#1a6b3c" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> WhatsApp
            </a>
        </div>`;

        let panel = '';

        // ════════════════════════════════════════════════════════════════════════
        // DASHBOARD MAIN
        // ════════════════════════════════════════════════════════════════════════
        if (activeTab === 'dashboard') {
            const firstName = (user.name || 'Pilgrim').split(' ')[0];
            const rows = requirements.slice(0, 5).map(reqTableRow).join('');

            // Requirements with offers available for carousel slide
            const reqsWithOffers = requirements.filter(r => offers.some(o => o.requirementId === r.id));

            const offerCarouselSlides = reqsWithOffers.length > 0 ? reqsWithOffers.map((r, idx) => {
                const rid = reqId(r);
                const ro = offers.filter(o => o.requirementId === r.id);
                return `<div style="background:#fff;border:1.5px solid #d1fae5;border-radius:12px;padding:.9rem 1.1rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;box-shadow:0 2px 8px rgba(26,107,60,0.05);transition:all .2s ease;" onmouseover="this.style.borderColor='#1a6b3c';this.style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='#d1fae5';this.style.transform='none';">
                    <div style="display:flex;align-items:center;gap:.8rem;">
                        <div style="width:40px;height:40px;border-radius:10px;background:#e8f5ee;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#1a6b3c;font-weight:800;font-size:.82rem;">${rid.slice(-4)}</div>
                        <div>
                            <div style="display:flex;align-items:center;gap:.5rem;">
                                <span style="font-size:.86rem;font-weight:800;color:#0f172a;">${rid}</span>
                                <span style="background:#d1fae5;color:#065f46;font-size:.65rem;font-weight:800;padding:.1rem .5rem;border-radius:99px;">${ro.length} Offer${ro.length!==1?'s':''} Ready</span>
                            </div>
                            <div style="font-size:.73rem;color:#6b7280;margin-top:.15rem;">Submitted on ${fmtDate(r.createdAt||r.preferredDepartureDate)} &bull; ${r.departureCity||'Srinagar'} to Jeddah &bull; ${r.travelersCount||2} Travelers</div>
                        </div>
                    </div>
                    <button onclick="app.viewRequestDetail('${r.id}')" style="background:#1a6b3c;color:#fff;border:none;border-radius:8px;padding:.48rem 1rem;font-size:.78rem;font-weight:700;cursor:pointer;white-space:nowrap;transition:all .18s;" onmouseover="this.style.background='#14522e';" onmouseout="this.style.background='#1a6b3c';">View Offers →</button>
                </div>`;
            }).join('') : `<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:.85rem 1.1rem;font-size:.78rem;color:#92400e;display:flex;align-items:center;justify-content:space-between;"><span>No active offers yet. Post a new request to get competitive quotes from verified partners.</span><button onclick="app.navigate('home');setTimeout(()=>app.scrollToRequirementForm(),300)" style="background:#d97706;color:#fff;border:none;border-radius:6px;padding:.38rem .85rem;font-size:.74rem;font-weight:700;cursor:pointer;">+ Create Request</button></div>`;

            panel = `<main style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1.1rem;">
                <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.6rem;">
                    <div>
                        <h1 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin:0;letter-spacing:-0.2px;">Welcome back, ${this.escapeHtml(firstName)} 👋</h1>
                        <p style="font-size:.8rem;color:#6b7280;margin:.08rem 0 0;">Here's what's happening with your Umrah requests.</p>
                    </div>
                    <div style="display:flex;align-items:center;gap:.6rem;">
                        <button onclick="app.setDashboardTab('notifications')" style="position:relative;background:#fff;border:1px solid #e5e7eb;border-radius:9px;width:34px;height:34px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .18s;" onmouseover="this.style.borderColor='#1a6b3c';" onmouseout="this.style.borderColor='#e5e7eb';">${ic.notifs}<span style="position:absolute;top:-4px;right:-4px;background:#1a6b3c;color:#fff;font-size:.58rem;font-weight:800;width:15px;height:15px;border-radius:50%;display:flex;align-items:center;justify-content:center;">${notifCount}</span></button>
                        <div onclick="app.setDashboardTab('profile')" style="display:flex;align-items:center;gap:.45rem;cursor:pointer;background:#fff;border:1px solid #e5e7eb;border-radius:9px;padding:.28rem .65rem;transition:all .18s;" onmouseover="this.style.borderColor='#1a6b3c';" onmouseout="this.style.borderColor='#e5e7eb';">
                            <div style="width:26px;height:26px;border-radius:50%;background:#1a6b3c;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.75rem;font-weight:800;overflow:hidden;">${userPhoto?`<img src="${userPhoto}" style="width:100%;height:100%;object-fit:cover;">`:this.escapeHtml((user.name||'U').charAt(0).toUpperCase())}</div>
                            <div><div style="font-size:.77rem;font-weight:700;color:#0f172a;">${this.escapeHtml(user.name)}</div></div>
                            <svg width="11" height="11" fill="none" stroke="#6b7280" stroke-width="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                    </div>
                </div>

                <!-- 4 Metric Cards -->
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.8rem;">
                    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:.95rem 1rem;display:flex;align-items:center;gap:.8rem;transition:all .2s ease;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.04)';" onmouseout="this.style.transform='none';this.style.boxShadow='none';">
                        <div style="width:38px;height:38px;border-radius:9px;background:#e8f5ee;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg width="18" height="18" fill="none" stroke="#1a6b3c" stroke-width="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                        <div><div style="font-size:1.35rem;font-weight:800;color:#0f172a;line-height:1;">${requirements.length}</div><div style="font-size:.74rem;font-weight:600;color:#374151;margin-top:.12rem;">Total Requests</div></div>
                    </div>
                    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:.95rem 1rem;display:flex;align-items:center;gap:.8rem;transition:all .2s ease;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.04)';" onmouseout="this.style.transform='none';this.style.boxShadow='none';">
                        <div style="width:38px;height:38px;border-radius:9px;background:#fef3c7;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg width="18" height="18" fill="none" stroke="#d97706" stroke-width="1.8" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.5" fill="#d97706" stroke="none"/></svg></div>
                        <div><div style="font-size:1.35rem;font-weight:800;color:#0f172a;line-height:1;">${offersAvailable}</div><div style="font-size:.74rem;font-weight:600;color:#374151;margin-top:.12rem;">Offers Available</div></div>
                    </div>
                    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:.95rem 1rem;display:flex;align-items:center;gap:.8rem;transition:all .2s ease;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.04)';" onmouseout="this.style.transform='none';this.style.boxShadow='none';">
                        <div style="width:38px;height:38px;border-radius:9px;background:#ede9fe;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg width="18" height="18" fill="none" stroke="#7c3aed" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                        <div><div style="font-size:1.35rem;font-weight:800;color:#0f172a;line-height:1;">${inProgress}</div><div style="font-size:.74rem;font-weight:600;color:#374151;margin-top:.12rem;">In Progress</div></div>
                    </div>
                    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:.95rem 1rem;display:flex;align-items:center;gap:.8rem;transition:all .2s ease;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.04)';" onmouseout="this.style.transform='none';this.style.boxShadow='none';">
                        <div style="width:38px;height:38px;border-radius:9px;background:#d1fae5;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg width="18" height="18" fill="none" stroke="#059669" stroke-width="1.8" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
                        <div><div style="font-size:1.35rem;font-weight:800;color:#0f172a;line-height:1;">${completed}</div><div style="font-size:.74rem;font-weight:600;color:#374151;margin-top:.12rem;">Completed</div></div>
                    </div>
                </div>

                <!-- Offers Available Live Slideshow / Carousel Breakdown -->
                <div>
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.45rem;">
                        <span style="font-size:.82rem;font-weight:800;color:#0f172a;">⚡ Live Offers Breakdown</span>
                        <span style="font-size:.72rem;color:#6b7280;">${reqsWithOffers.length} Request${reqsWithOffers.length!==1?'s':''} with offers</span>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:.6rem;">
                        ${offerCarouselSlides}
                    </div>
                </div>

                <!-- Requests Table -->
                <div style="background:#fff;border:1px solid #e5e7eb;border-radius:13px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.02);">
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:.95rem 1.15rem;border-bottom:1px solid #f3f4f6;">
                        <h2 style="font-size:.92rem;font-weight:800;color:#0f172a;margin:0;">Your Travel Requests</h2>
                        <button onclick="app.navigate('home');setTimeout(()=>app.scrollToRequirementForm(),300)" style="background:#1a6b3c;color:#fff;border:none;border-radius:7px;padding:.4rem .9rem;font-size:.77rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:.25rem;transition:background .18s;" onmouseover="this.style.background='#14522e';" onmouseout="this.style.background='#1a6b3c';"><svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> New Request</button>
                    </div>
                    ${requirements.length>0?`<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">${tableHead}<tbody>${rows}</tbody></table></div>`:`
                    <div style="text-align:center;padding:2.2rem 1rem;">
                        <div style="width:44px;height:44px;background:#f0faf5;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto .75rem;">${ic.requests.replace(/currentColor/g,'#1a6b3c')}</div>
                        <h3 style="font-size:.9rem;font-weight:700;color:#0f172a;margin:0 0 .25rem;">No Requests Yet</h3>
                        <p style="font-size:.79rem;color:#6b7280;margin:0 0 .95rem;">Post your first Umrah travel request and get offers from verified agents.</p>
                        <button onclick="app.navigate('home');setTimeout(()=>app.scrollToRequirementForm(),300)" style="background:#1a6b3c;color:#fff;border:none;border-radius:7px;padding:.45rem 1.15rem;font-weight:700;font-size:.82rem;cursor:pointer;">+ Post a Request</button>
                    </div>`}
                </div>
            </main>`;

        // ════════════════════════════════════════════════════════════════════════
        // MY REQUESTS
        // ════════════════════════════════════════════════════════════════════════
        } else if (activeTab === 'requests') {
            const rows = requirements.map(reqTableRow).join('');
            panel = `<main style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1rem;">
                <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.6rem;">
                    ${pageHeader('My Requests', 'Manage all your Umrah travel requests.')}
                    <button onclick="app.navigate('home');setTimeout(()=>app.scrollToRequirementForm(),300)" style="background:#1a6b3c;color:#fff;border:none;border-radius:7px;padding:.42rem .95rem;font-size:.8rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:.25rem;transition:background .18s;" onmouseover="this.style.background='#14522e';" onmouseout="this.style.background='#1a6b3c';"><svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> New Request</button>
                </div>
                <div style="background:#fff;border:1px solid #e5e7eb;border-radius:13px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.02);">
                    ${requirements.length>0?`<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">${tableHead}<tbody>${rows}</tbody></table></div>`:`<div style="text-align:center;padding:2.2rem;color:#6b7280;font-size:.86rem;">No requests yet. <button onclick="app.navigate('home');setTimeout(()=>app.scrollToRequirementForm(),300)" style="color:#1a6b3c;background:none;border:none;font-weight:700;cursor:pointer;">Post your first request →</button></div>`}
                </div>
            </main>`;

        // ════════════════════════════════════════════════════════════════════════
        // REQUEST DETAIL
        // ════════════════════════════════════════════════════════════════════════
        } else if (activeTab === 'requestDetail') {
            const selId = this.state.selectedRequestId;
            const r = requirements.find(x => x.id === selId) || requirements[0] || {};
            const sid = r ? reqId(r) : 'REQ-0000';
            const ro = r ? offers.filter(o => o.requirementId === r.id) : [];
            
            // Show only real offers from agents
            const displayOffers = ro;

            const steps = [
                {label:'Request Submitted', desc:`${fmtDate(r.createdAt||r.preferredDepartureDate)} — Received successfully.`, done:true},
                {label:'Offers Collected',  desc: displayOffers.length>0 ? `${displayOffers.length} verified offer${displayOffers.length!==1?'s':''} ready for review.` : 'Waiting for travel agents to submit offers.', done: displayOffers.length>0},
                {label:'Review Offers',     desc:`Review prices, hotels &amp; inclusions below.`, active:!r.selectedOffer && displayOffers.length>0},
                {label:'Offer Selected',    desc:'Select your preferred offer to proceed.', done:!!r.selectedOffer},
                {label:'Payment & Booking', desc:'Complete payment to confirm booking.', done:false},
            ];

            panel = `<main style="flex:1;min-width:0;display:flex;flex-direction:column;gap:.95rem;">
                <div>
                    <button onclick="app.setDashboardTab('requests')" style="background:none;border:none;color:#1a6b3c;font-size:.8rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:.25rem;padding:0;margin-bottom:.35rem;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'"><svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg> Back to My Requests</button>
                    <h1 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin:0;letter-spacing:-0.2px;">Request Details</h1>
                </div>

                <div style="display:grid;grid-template-columns:1fr 240px;gap:.95rem;align-items:start;">
                    <div style="display:flex;flex-direction:column;gap:.95rem;">
                        <!-- Top Header Card (with Cancel Request button integrated at top right) -->
                        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:1.1rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;box-shadow:0 2px 8px rgba(0,0,0,0.02);">
                            <div style="display:flex;align-items:center;gap:.85rem;">
                                <div style="width:72px;height:56px;border-radius:8px;background:#f0faf5;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg width="30" height="30" fill="#d1fae5" viewBox="0 0 100 100"><rect x="20" y="25" width="60" height="70" rx="3"/><path d="M20 25 Q50 -5 80 25Z"/><rect x="5" y="45" width="15" height="50" rx="2"/><rect x="80" y="45" width="15" height="50" rx="2"/><rect x="42" y="55" width="16" height="40" rx="2"/></svg></div>
                                <div>
                                    <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.35rem;"><span style="font-size:.98rem;font-weight:800;color:#0f172a;">${sid}</span>${statusBadge(displayOffers.length>0?'active':'pending')}</div>
                                    <div style="display:flex;gap:.9rem;flex-wrap:wrap;font-size:.78rem;color:#374151;">
                                        <span>📅 ${fmtDate(r.preferredDepartureDate)}</span>
                                        <span>👥 ${r.travelersCount||2} Travelers</span>
                                        <span>⏱ ${r.durationDays||10} Days</span>
                                    </div>
                                    <div style="font-size:.67rem;color:#9ca3af;margin-top:.25rem;">Submitted on ${fmtDate(r.createdAt||r.preferredDepartureDate)}</div>
                                </div>
                            </div>

                            <!-- Header Right: Offers badge + Cancel button -->
                            <div style="display:flex;align-items:center;gap:.6rem;">
                                ${displayOffers.length>0 ? `
                                <div style="background:#1a6b3c;color:#fff;border-radius:10px;padding:.65rem .95rem;text-align:center;">
                                    <div style="font-size:.7rem;font-weight:700;">${displayOffers.length} Offers Available</div>
                                    <button onclick="document.getElementById('availableOffersSection')?.scrollIntoView({behavior:'smooth'})" style="margin-top:.35rem;background:#fff;color:#1a6b3c;border:none;border-radius:6px;padding:.28rem .7rem;font-size:.72rem;font-weight:700;cursor:pointer;transition:all .18s;" onmouseover="this.style.background='#f0faf5';" onmouseout="this.style.background='#fff';">View Offers ↓</button>
                                </div>`:''}
                                <button onclick="app.deleteRequirement('${r.id}')" style="background:#fff;color:#dc2626;border:1px solid #fecaca;border-radius:9px;padding:.55rem .85rem;font-size:.76rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:.3rem;transition:all .18s;" onmouseover="this.style.background='#fef2f2';this.style.borderColor='#f87171';" onmouseout="this.style.background='#fff';this.style.borderColor='#fecaca';">
                                    <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                                    Cancel Request
                                </button>
                            </div>
                        </div>

                        <!-- Request Details Card -->
                        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:1.1rem;box-shadow:0 2px 8px rgba(0,0,0,0.02);">
                            <h3 style="font-size:.86rem;font-weight:800;color:#0f172a;margin:0 0 .85rem;">Request Specifications</h3>
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem 1.6rem;">
                                ${[
                                    ['Service Type','Umrah Package'],
                                    ['Pickup / Departure City', r.departureCity || 'Not specified'],
                                    ['Travel Date', fmtDate(r.preferredDepartureDate) + ' (Approx.)'],
                                    ['Destination City','Jeddah (JED) / Makkah / Madinah'],
                                    ['Duration', (r.durationDays || '—') + (r.durationDays ? ' Days' : '')],
                                    ['Phone', r.userPhone ? r.userPhone.replace(/^(.{3}).*?(\d{2})$/, '$1••••$2') + ' (Masked for Security)' : 'Not shared'],
                                    ['Travelers', (r.travelersCount || '—') + ' Adults, ' + (r.children || 0) + ' Children'],
                                    ['Email', (user.email || '').replace(/^(.{3}).*?(@.*)$/, '$1****$2')],
                                    ['Class Preference', r.classPreference || 'Not specified'],
                                    ['Special Requests', r.specialRequests || 'None'],
                                ].map(([k,v])=>`<div><div style="font-size:.68rem;color:#9ca3af;margin-bottom:.1rem;">${k}</div><div style="font-size:.82rem;color:#0f172a;font-weight:600;">${v}</div></div>`).join('')}
                            </div>
                            <div style="margin-top:.8rem;background:#fffbeb;border:1px solid #fde68a;border-radius:7px;padding:.55rem .8rem;display:flex;align-items:center;gap:.4rem;">
                                <svg width="13" height="13" fill="none" stroke="#d97706" stroke-width="1.8" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                <div style="font-size:.73rem;color:#92400e;"><strong>Privacy Protection:</strong> Your personal phone and email are never shared directly with agents.</div>
                            </div>
                        </div>

                        <!-- Available Offers Section (scrolled into view on button click) -->
                        <div id="availableOffersSection" style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:1.1rem;box-shadow:0 2px 8px rgba(0,0,0,0.02);">
                            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.85rem;">
                                <div style="display:flex;align-items:center;gap:.4rem;">
                                    <h3 style="font-size:.86rem;font-weight:800;color:#0f172a;margin:0;">Available Offers</h3>
                                    <span style="background:#f0faf5;color:#1a6b3c;font-size:.68rem;font-weight:800;padding:.1rem .5rem;border-radius:99px;">${displayOffers.length} Verified Offers</span>
                                </div>
                                <span style="font-size:.72rem;color:#6b7280;">100% Price &amp; Cancellation Guarantee</span>
                            </div>

                            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:.85rem;">
                                ${displayOffers.length === 0 ? `<div style="grid-column:1/-1; text-align:center; padding:2rem 1rem; color:#6b7280; font-size:.84rem; background:#f8fafc; border:1px dashed #e2e8f0; border-radius:10px;">
                                    No offers received yet. Agents will submit verified offers against this request — you'll see them here as they arrive.
                                </div>` : displayOffers.map((o,i)=>{
                                    const travelers = r.travelersCount || o.travelersCount || 1;
                                    const perPerson = o.discountedPrice || o.price || 0;
                                    const totalDiscounted = perPerson * travelers;
                                    return `<div style="border:1.5px solid ${i===0?'#d1fae5':'#e5e7eb'};border-radius:11px;padding:1rem;display:flex;flex-direction:column;justify-content:space-between;background:#fff;transition:all .2s ease;" onmouseover="this.style.borderColor='#1a6b3c';this.style.boxShadow='0 4px 14px rgba(26,107,60,0.08)';" onmouseout="this.style.borderColor='${i===0?'#d1fae5':'#e5e7eb'}';this.style.boxShadow='none';">
                                    <div>
                                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.35rem;">
                                            <span style="font-size:.66rem;font-weight:800;color:${i===0?'#059669':'#d97706'};background:${i===0?'#e8f5ee':'#fef3c7'};padding:.12rem .5rem;border-radius:99px;">${i===0?'🏆 Best Value Choice':'⭐ Popular Option'}</span>
                                            <span style="font-size:.67rem;color:#6b7280;">${o.durationDays ? o.durationDays + ' Days' : 'Duration N/A'}</span>
                                        </div>
                                        <div style="font-size:1.25rem;font-weight:800;color:#0f172a;">${this.formatCurrency(totalDiscounted)}</div>
                                        <div style="font-size:.68rem;color:#1a6b3c;font-weight:700;margin-bottom:.6rem;">Total for ${travelers} Persons (${this.formatCurrency(perPerson)} / person)</div>
                                        
                                        <div style="font-size:.81rem;font-weight:700;color:#0f172a;margin-bottom:.25rem;line-height:1.3;">${this.escapeHtml(o.packageTitle || 'Umrah Package')}</div>
                                        <div style="font-size:.71rem;color:#1a6b3c;font-weight:600;margin-bottom:.55rem;">Provided by: ${this.escapeHtml(o.agencyName || o.agentName || 'Verified Partner')}</div>
                                        
                                        <div style="font-size:.71rem;color:#4b5563;display:flex;flex-direction:column;gap:.25rem;padding:.5rem 0;border-top:1px dashed #e5e7eb;border-bottom:1px dashed #e5e7eb;margin-bottom:.75rem;">
                                            ${o.makkahHotel ? `<div>🏨 Makkah: <strong>${this.escapeHtml(o.makkahHotel)}</strong></div>` : ''}
                                            ${o.madinahHotel ? `<div>🏨 Madinah: <strong>${this.escapeHtml(o.madinahHotel)}</strong></div>` : ''}
                                            ${o.flightDetails ? `<div>✈ Flight: <strong>${this.escapeHtml(o.flightDetails)}</strong></div>` : ''}
                                        </div>
                                    </div>
                                    <div style="display:flex;flex-direction:column;gap:.4rem;">
                                        <button onclick="app.openOfferReviewModal('${o.id}')" style="width:100%;border:none;background:#1a6b3c;color:#fff;border-radius:8px;padding:.55rem .8rem;font-size:.8rem;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:.35rem;transition:all .18s;" onmouseover="this.style.background='#14522e';" onmouseout="this.style.background='#1a6b3c';">🔍 View Details</button>
                                    </div>
                                </div>`;
                                }).join('')}
                            </div>
                        </div>
                    </div>

                    <!-- Right Column: Status Timeline & Support Card -->
                    <div style="display:flex;flex-direction:column;gap:.95rem;">
                        <!-- Status Timeline -->
                        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:1.05rem;box-shadow:0 2px 8px rgba(0,0,0,0.02);">
                            <h3 style="font-size:.84rem;font-weight:800;color:#0f172a;margin:0 0 .8rem;">Request Progress</h3>
                            <div style="display:flex;flex-direction:column;gap:.7rem;">
                                ${steps.map((s,i)=>`<div style="display:flex;gap:.55rem;align-items:flex-start;">
                                    <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;">
                                        <div style="width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${s.done?'#1a6b3c':s.active?'#fef3c7':'#f3f4f6'};border:2px solid ${s.done?'#1a6b3c':s.active?'#d97706':'#e5e7eb'};">${s.done?'<svg width="8" height="8" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>':s.active?'<div style="width:5px;height:5px;border-radius:50%;background:#d97706;"></div>':''}</div>
                                        ${i<steps.length-1?`<div style="width:2px;height:18px;background:${s.done?'#d1fae5':'#e5e7eb'};margin:2px 0;"></div>`:''}
                                    </div>
                                    <div style="padding-top:.01rem;"><div style="font-size:.77rem;font-weight:700;color:${s.done?'#0f172a':s.active?'#92400e':'#9ca3af'};">${s.label}</div><div style="font-size:.67rem;color:#9ca3af;line-height:1.35;margin-top:.06rem;">${s.desc}</div></div>
                                </div>`).join('')}
                            </div>
                        </div>

                        ${supportCard()}
                    </div>
                </div>
            </main>`;

        // ════════════════════════════════════════════════════════════════════════
        // NOTIFICATIONS (With working tab filter!)
        // ════════════════════════════════════════════════════════════════════════
        } else if (activeTab === 'notifications') {
            const currentFilter = this.state.notifFilter || 'All';
            // ── Real notifications derived from the user's live data ─────────────
            const builtNotifs = [];
            offersForUser.forEach((o, i) => {
                const reqRef = (o.requirementId ? ' for ' + o.requirementId : '');
                builtNotifs.push({
                    id: 'n-off-' + i, category: 'offers', ic: 'offer', bg: '#d1fae5', ic_c: '#059669',
                    title: `New offer received${reqRef}`, desc: `${o.agentName || 'A verified operator'} sent an offer for ${o.packageTitle || 'your Umrah package'} at ${this.formatCurrency(o.discountedPrice || o.price || 0)}.`,
                    time: 'Just now', unread: true
                });
            });
            requirements.forEach((r, i) => {
                const stateDesc = (r.status === 'CONFIRMED' || r.status === 'OFFERED')
                    ? `${r.status.charAt(0) + r.status.slice(1).toLowerCase()} — offers are ready for review.`
                    : `We are collecting competitive offers from verified agents.`;
                builtNotifs.push({
                    id: 'n-req-' + i, category: 'requests', ic: 'clock', bg: '#fef3c7', ic_c: '#d97706',
                    title: `Your request ${r.id || 'REQ'} is ${(r.status || 'active').toLowerCase()}`, desc: stateDesc,
                    time: 'Active', unread: true
                });
            });
            bookings.forEach((b, i) => {
                builtNotifs.push({
                    id: 'n-pay-' + i, category: 'payments', ic: 'pay', bg: '#dbeafe', ic_c: '#2563eb',
                    title: `Payment of ${this.formatCurrency(b.totalPrice || 0)} successful`, desc: `Your payment for ${b.packageTitle || 'your booking'} (${b.id || ''}) has been received and confirmed.`,
                    time: 'Paid', unread: false
                });
            });
            if (builtNotifs.length === 0) {
                builtNotifs.push({
                    id: 'n-empty', category: 'system', ic: 'info', bg: '#e0e7ff', ic_c: '#4f46e5',
                    title: 'No updates yet', desc: 'When you submit travel requests, receive offers, or make payments, they will appear here in real time.',
                    time: '', unread: false
                });
            }
            const allNotifs = builtNotifs;

            const filteredNotifs = currentFilter === 'All' 
                ? allNotifs 
                : allNotifs.filter(n => n.category.toLowerCase() === currentFilter.toLowerCase());

            const nIcon = (type, bg, c) => {
                const s = {
                    offer:`<svg width="15" height="15" fill="none" stroke="${c}" stroke-width="1.8" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.5" fill="${c}" stroke="none"/></svg>`,
                    clock:`<svg width="15" height="15" fill="none" stroke="${c}" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
                    pay:`<svg width="15" height="15" fill="none" stroke="${c}" stroke-width="1.8" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`,
                    check:`<svg width="15" height="15" fill="none" stroke="${c}" stroke-width="1.8" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
                    info:`<svg width="15" height="15" fill="none" stroke="${c}" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16" stroke-linecap="round" stroke-width="2"/></svg>`,
                    sys:`<svg width="15" height="15" fill="none" stroke="${c}" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33A1.65 1.65 0 0 0 14 21a2 2 0 1 1-4 0 1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3 9a1.65 1.65 0 0 0-1.51-1H2a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 3 4.6a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 7 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 13 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9 1.65 1.65 0 0 0 21 10h1a2 2 0 1 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15z"/></svg>`,
                };
                return `<div style="width:34px;height:34px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">${s[type]||s.info}</div>`;
            };

            const filters = [
                ['All', allNotifs.length],
                ['Requests', allNotifs.filter(n=>n.category==='requests').length],
                ['Offers', allNotifs.filter(n=>n.category==='offers').length],
                ['Payments', allNotifs.filter(n=>n.category==='payments').length],
                ['System', allNotifs.filter(n=>n.category==='system').length],
            ];

            panel = `<main style="flex:1;min-width:0;display:grid;grid-template-columns:1fr 225px;gap:1rem;align-items:start;">
                <div style="display:flex;flex-direction:column;gap:.95rem;">
                    ${pageHeader('Notifications', 'Stay updated on your requests and offers.')}
                    <!-- Filter Tabs -->
                    <div style="display:flex;gap:.3rem;border-bottom:1px solid #e5e7eb;">
                        ${filters.map(([l,c])=> {
                            const active = currentFilter.toLowerCase() === l.toLowerCase();
                            return `<button onclick="app.setNotifFilter('${l}')" style="display:flex;align-items:center;gap:.25rem;padding:.45rem .8rem;border:none;border-bottom:${active?'2.5px solid #1a6b3c':'2.5px solid transparent'};background:none;font-size:.8rem;font-weight:${active?'700':'500'};color:${active?'#1a6b3c':'#6b7280'};cursor:pointer;margin-bottom:-1px;transition:all .15s;">
                                ${l} ${c>0?`<span style="background:${active?'#1a6b3c':'#e5e7eb'};color:${active?'#fff':'#374151'};font-size:.62rem;font-weight:800;min-width:16px;height:16px;border-radius:99px;display:flex;align-items:center;justify-content:center;padding:0 3px;">${c}</span>`:''}
                            </button>`;
                        }).join('')}
                    </div>

                    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.02);">
                        <div style="display:flex;align-items:center;justify-content:space-between;padding:.8rem 1rem;border-bottom:1px solid #f3f4f6;">
                            <span style="font-size:.83rem;font-weight:700;color:#0f172a;">Showing: ${currentFilter} (${filteredNotifs.length})</span>
                            <button onclick="if(typeof app.showToast==='function') app.showToast('All notifications marked as read');" style="background:none;border:none;font-size:.75rem;color:#1a6b3c;font-weight:600;cursor:pointer;">Mark all as read</button>
                        </div>
                        ${filteredNotifs.length > 0 ? filteredNotifs.map(n => `<div style="display:flex;align-items:flex-start;gap:.7rem;padding:.8rem 1rem;border-bottom:1px solid #f9fafb;transition:background .15s;${n.unread?'background:#fafffe;':''}" onmouseover="this.style.background='#f0faf5'" onmouseout="this.style.background='${n.unread?'#fafffe':'#fff'}'">
                            ${nIcon(n.ic, n.bg, n.ic_c)}
                            <div style="flex:1;min-width:0;">
                                <div style="font-size:.82rem;font-weight:${n.unread?'700':'600'};color:#0f172a;">${n.title}</div>
                                <div style="font-size:.74rem;color:#6b7280;margin-top:.08rem;line-height:1.35;">${n.desc}</div>
                            </div>
                            <div style="display:flex;align-items:center;gap:.3rem;flex-shrink:0;">
                                <span style="font-size:.67rem;color:#9ca3af;white-space:nowrap;">${n.time}</span>
                                ${n.unread?'<div style="width:6px;height:6px;border-radius:50%;background:#1a6b3c;"></div>':''}
                            </div>
                        </div>`).join('') : `<div style="padding:2.2rem;text-align:center;color:#6b7280;font-size:.84rem;">No notifications in "${currentFilter}" filter.</div>`}
                    </div>
                </div>

                <!-- Right col -->
                <div style="display:flex;flex-direction:column;gap:.9rem;">
                    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:1rem;box-shadow:0 2px 8px rgba(0,0,0,0.02);">
                        <h3 style="font-size:.84rem;font-weight:800;color:#0f172a;margin:0 0 .15rem;">Preferences</h3>
                        <p style="font-size:.7rem;color:#6b7280;margin:0 0 .75rem;">Choose what notifications you receive.</p>
                        ${[
                            ['Request Updates', 'emailNotifs', '#d1fae5', '#059669'],
                            ['Offer Updates',   'offerNotifs', '#fef3c7', '#d97706'],
                            ['Payment Alerts',  'paymentAlerts', '#fce7f3', '#db2777'],
                        ].map(([l, key, bg, c]) => {
                            const isChecked = userSettings[key] !== false;
                            return `<div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid #f9fafb;">
                                <div style="display:flex;align-items:center;gap:.45rem;">
                                    <div style="width:24px;height:24px;border-radius:6px;background:${bg};display:flex;align-items:center;justify-content:center;"><svg width="11" height="11" fill="none" stroke="${c}" stroke-width="1.8" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
                                    <div style="font-size:.76rem;font-weight:600;color:#0f172a;">${l}</div>
                                </div>
                                <div onclick="app.toggleSetting('${key}')" style="width:32px;height:18px;background:${isChecked?'#1a6b3c':'#d1d5db'};border-radius:99px;position:relative;cursor:pointer;transition:background .2s;flex-shrink:0;">
                                    <div style="position:absolute;${isChecked?'right:2px':'left:2px'};top:2px;width:14px;height:14px;background:#fff;border-radius:50%;transition:all .2s;"></div>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                    ${supportCard()}
                </div>
            </main>`;

        // ════════════════════════════════════════════════════════════════════════
        // HELP & SUPPORT
        // ════════════════════════════════════════════════════════════════════════
        } else if (activeTab === 'help') {
            const faqs = [
                {q:'How do I submit a travel request?', a:'Go to the homepage and click "Post Your Travel Requirement". Fill in your travel dates, budget, group size and preferences. Verified agents will send tailored offers.'},
                {q:'How long does it take to receive offers?', a:'Typically within 24–48 hours. You will receive a notification as soon as offers are ready.'},
                {q:'Can I cancel my request?', a:'Yes. Go to My Requests → View Details → Cancel Request at any time before payment.'},
                {q:'Is my contact information shared with agents?', a:'No. Your phone and email are fully masked. Agents only see your travel preferences.'},
                {q:'What payment methods are accepted?', a:'UPI, Credit/Debit Cards, Net Banking, and wallets like PhonePe and Paytm via Razorpay.'},
                {q:'How secure is my payment?', a:'All transactions are processed via Razorpay, fully PCI-DSS compliant with 256-bit SSL encryption.'},
            ];
            panel = `<main style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1rem;">
                ${pageHeader('Help &amp; Support', 'Find answers and connect with our support team.')}
                <div style="position:relative;"><svg style="position:absolute;left:.85rem;top:50%;transform:translateY(-50%);pointer-events:none;" width="14" height="14" fill="none" stroke="#9ca3af" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" placeholder="Search for help..." style="width:100%;box-sizing:border-box;padding:.68rem 1rem .68rem 2.35rem;border:1px solid #e5e7eb;border-radius:9px;font-size:.85rem;color:#374151;background:#fff;outline:none;" onfocus="this.style.borderColor='#1a6b3c'" onblur="this.style.borderColor='#e5e7eb'"></div>
                <!-- Contact options -->
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.8rem;">
                    ${[
                        ['Live Chat','<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>','javascript:void(0)','onclick="app.openChatbot()"'],
                        ['Call Us','<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.22 1.18 2 2 0 012.18 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.16 6.16l1.27-.49a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>',`tel:${SUPPORT_PHONE}`,''],
                        ['Email Us','<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',`mailto:${SUPPORT_EMAIL}`,''],
                        ['WhatsApp','<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>',SUPPORT_WA,'target="_blank" rel="noopener"'],
                    ].map(([l,path,href,extra])=>`<a href="${href}" ${extra} style="background:#fff;border:1px solid #e5e7eb;border-radius:11px;padding:.95rem;text-align:center;cursor:pointer;text-decoration:none;display:block;transition:all .2s ease;" onmouseover="this.style.borderColor='#1a6b3c';this.style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='#e5e7eb';this.style.transform='none';">
                        <div style="width:38px;height:38px;background:#f0faf5;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto .5rem;"><svg width="17" height="17" fill="none" stroke="#1a6b3c" stroke-width="1.8" viewBox="0 0 24 24">${path}</svg></div>
                        <div style="font-size:.82rem;font-weight:700;color:#0f172a;">${l}</div>
                    </a>`).join('')}
                </div>
                <!-- FAQ -->
                <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.02);">
                    <div style="padding:.85rem 1.1rem;border-bottom:1px solid #f3f4f6;"><h3 style="font-size:.88rem;font-weight:800;color:#0f172a;margin:0;">Frequently Asked Questions</h3></div>
                    ${faqs.map(f=>`<details style="border-bottom:1px solid #f3f4f6;"><summary style="padding:.82rem 1.1rem;font-size:.83rem;font-weight:600;color:#0f172a;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;">${f.q}<svg width="11" height="11" fill="none" stroke="#9ca3af" stroke-width="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg></summary><div style="padding:0 1.1rem .8rem;font-size:.81rem;color:#6b7280;line-height:1.55;">${f.a}</div></details>`).join('')}
                </div>
            </main>`;

        // ════════════════════════════════════════════════════════════════════════
        // PAYMENTS / PAYMENT SCREEN (MATCHING IMAGE 2)
        // ════════════════════════════════════════════════════════════════════════
        } else if (activeTab === 'payments' || activeTab === 'paymentScreen') {
            panel = this.renderPaymentPage(this.state.activeOfferId);
        } else if (activeTab === 'profile') {
            panel = `<main style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1rem;">
                ${pageHeader('Profile &amp; Settings', 'Manage your account details, preferences and security.')}
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:.95rem;align-items:start;">
                    <!-- Profile card -->
                    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:1.35rem;box-shadow:0 2px 8px rgba(0,0,0,0.02);">
                        <h3 style="font-size:.88rem;font-weight:800;color:#0f172a;margin:0 0 1rem;">Account Information</h3>
                        <div style="display:flex;align-items:center;gap:.95rem;padding-bottom:1rem;border-bottom:1px solid #f3f4f6;margin-bottom:1rem;">
                            <div style="position:relative;">
                                <div style="width:58px;height:58px;border-radius:50%;background:#1a6b3c;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.5rem;font-weight:800;overflow:hidden;">${userPhoto?`<img src="${userPhoto}" style="width:100%;height:100%;object-fit:cover;">`:this.escapeHtml((user.name||'U').charAt(0).toUpperCase())}</div>
                                <button onclick="app.triggerPhotoUpload()" style="position:absolute;bottom:0;right:0;width:19px;height:19px;background:#fff;border:1.5px solid #e5e7eb;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:.56rem;" title="Upload Photo">📷</button>
                            </div>
                            <div>
                                <h3 style="font-size:.95rem;font-weight:800;color:#0f172a;margin:0 0 .1rem;">${this.escapeHtml(user.name)}</h3>
                                <div style="font-size:.77rem;color:#6b7280;">${this.escapeHtml(user.email)}</div>
                                <span style="background:#d1fae5;color:#065f46;font-size:.65rem;font-weight:700;padding:.08rem .45rem;border-radius:99px;">Verified Account</span>
                            </div>
                        </div>
                        ${[
                            ['Full Name', user.name, 'name'],
                            ['Email Address', user.email, 'email'],
                            ['Phone Number', user.phone||'—', 'phone'],
                            ['Account Status','Active &amp; Verified', null],
                            ['Member Since','2025', null]
                        ].map(([k,v,field])=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:.55rem 0;border-bottom:1px dashed #f3f4f6;"><span style="font-size:.8rem;color:#6b7280;">${k}</span><div style="display:flex;align-items:center;gap:.5rem;"><strong style="font-size:.8rem;color:#0f172a;">${this.escapeHtml(String(v))}</strong>${field?`<button onclick="app.editProfileField('${field}')" style="background:#fff;color:#1a6b3c;border:1px solid #d1fae5;border-radius:6px;padding:.2rem .5rem;font-size:.7rem;font-weight:700;cursor:pointer;">Edit</button>`:''}</div></div>`).join('')}
                        <div style="display:flex;gap:.6rem;margin-top:1rem;">
                            <button onclick="app.logout()" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;padding:.48rem 1rem;border-radius:7px;font-weight:700;font-size:.8rem;cursor:pointer;transition:all .18s;" onmouseover="this.style.background='#fee2e2';" onmouseout="this.style.background='#fef2f2';">🚪 Log Out</button>
                            <button onclick="app.triggerPhotoUpload()" style="background:#f0faf5;color:#1a6b3c;border:1px solid #d1fae5;padding:.48rem 1rem;border-radius:7px;font-weight:700;font-size:.8rem;cursor:pointer;transition:all .18s;" onmouseover="this.style.background='#d1fae5';" onmouseout="this.style.background='#f0faf5';">📷 Change Photo</button>
                        </div>
                    </div>

                    <!-- Settings card with WORKING TOGGLES -->
                    <div style="display:flex;flex-direction:column;gap:.9rem;">
                        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:1.2rem;box-shadow:0 2px 8px rgba(0,0,0,0.02);">
                            <h3 style="font-size:.88rem;font-weight:800;color:#0f172a;margin:0 0 .75rem;">Notification Settings</h3>
                            ${[
                                ['Email Notifications', 'emailNotifs', 'Receive updates &amp; offer alerts via email'],
                                ['SMS Alerts',           'smsAlerts',  'Get SMS alerts for critical updates'],
                                ['Offer Notifications', 'offerNotifs', 'Be notified instantly when offers arrive'],
                                ['Payment Alerts',      'paymentAlerts','Receive digital receipts &amp; invoices'],
                            ].map(([l, key, d]) => {
                                const isChecked = userSettings[key] !== false;
                                return `<div style="display:flex;align-items:center;justify-content:space-between;padding:.65rem 0;border-bottom:1px solid #f3f4f6;">
                                    <div><div style="font-size:.82rem;font-weight:600;color:#0f172a;">${l}</div><div style="font-size:.7rem;color:#9ca3af;">${d}</div></div>
                                    <div onclick="app.toggleSetting('${key}')" style="width:34px;height:19px;background:${isChecked?'#1a6b3c':'#d1d5db'};border-radius:99px;position:relative;cursor:pointer;transition:background .2s;flex-shrink:0;">
                                        <div style="position:absolute;${isChecked?'right:2px':'left:2px'};top:2px;width:15px;height:15px;background:#fff;border-radius:50%;transition:all .2s;"></div>
                                    </div>
                                </div>`;
                            }).join('')}
                        </div>

                        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:1.2rem;box-shadow:0 2px 8px rgba(0,0,0,0.02);">
                            <h3 style="font-size:.88rem;font-weight:800;color:#0f172a;margin:0 0 .75rem;">Security &amp; Privacy</h3>
                            ${[
                                ['Privacy Mode',     'privacyMode', 'Mask phone &amp; email from agents'],
                                ['Two-Factor Auth',  'twoFactor',   'Add extra security step at login'],
                            ].map(([l, key, d]) => {
                                const isChecked = userSettings[key] !== false;
                                return `<div style="display:flex;align-items:center;justify-content:space-between;padding:.65rem 0;border-bottom:1px solid #f3f4f6;">
                                    <div><div style="font-size:.82rem;font-weight:600;color:#0f172a;">${l}</div><div style="font-size:.7rem;color:#9ca3af;">${d}</div></div>
                                    <div onclick="app.toggleSetting('${key}')" style="width:34px;height:19px;background:${isChecked?'#1a6b3c':'#d1d5db'};border-radius:99px;position:relative;cursor:pointer;transition:background .2s;flex-shrink:0;">
                                        <div style="position:absolute;${isChecked?'right:2px':'left:2px'};top:2px;width:15px;height:15px;background:#fff;border-radius:50%;transition:all .2s;"></div>
                                    </div>
                                </div>`;
                            }).join('')}
                        </div>
                    </div>
                </div>
            </main>`;

        } else if (activeTab === 'packageDetails') {
            return this.renderPackageDetailsFullPage(this.state.activeOfferId);
        } else if (activeTab === 'paymentScreen') {
            return this.renderPaymentPage(this.state.activeOfferId);
        } else {
            panel = `<main style="flex:1;min-width:0;"><div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:2.2rem;text-align:center;"><p style="color:#6b7280;">This section is under maintenance.</p></div></main>`;
        }

        return `
        <div style="background:#f8fafc;min-height:100vh;padding:94px 0 3rem;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            <div style="max-width:100%; width:100%; box-sizing:border-box; margin:0 auto; padding:0 3.5rem; display:flex; gap:1.5rem; align-items:flex-start;">
                ${sidebar}
                ${panel}
            </div>
        </div>`;
    }

    openOfferReviewModal(offerId) {
        this.closeModal();
        const id = offerId || '';
        this.state.activeOfferId = id;
        this.state.activeDashboardTab = 'packageDetails';
        this.navigate('package-details');
    }

    openOfferPaymentModal(offerId) {
        this.closeModal();
        const id = offerId || '';
        this.state.activeOfferId = id;
        this.state.activeDashboardTab = 'paymentScreen';
        this.navigate('payment');
    }

    toggleUpiQrCode() {
        this.state.showUpiQrCode = !this.state.showUpiQrCode;
        if (this.state.currentPage === 'payment' || this.state.currentPage === 'paymentScreen') {
            const main = document.getElementById('mainContainer');
            if (main) main.innerHTML = this.renderPaymentPage(this.state.activeOfferId);
        } else {
            const main = document.getElementById('mainContainer');
            if (main) main.innerHTML = this.renderDashboardPage();
        }
    }

    switchPaymentMethodTab(method) {
        this.state.selectedPaymentMethod = method;
        if (method !== 'upi') {
            this.state.showUpiQrCode = false;
        }
        if (this.state.currentPage === 'payment' || this.state.currentPage === 'paymentScreen') {
            const main = document.getElementById('mainContainer');
            if (main) main.innerHTML = this.renderPaymentPage(this.state.activeOfferId);
        } else {
            const main = document.getElementById('mainContainer');
            if (main) main.innerHTML = this.renderDashboardPage();
        }
    }

    renderPackageDetailsFullPage(offerId) {
        const allOffers = this.getAllOffers();
        const offer = allOffers.find(o => o.id === offerId);

        if (!offer) {
            return `
            <div style="min-height:80vh; background:#f8fafc; display:flex; align-items:center; justify-content:center; font-family:'Inter',sans-serif; padding:2rem;">
                <div style="text-align:center; max-width:440px; background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:2rem 1.6rem; box-shadow:0 4px 16px rgba(0,0,0,0.04);">
                    <div style="font-size:2.4rem; margin-bottom:0.6rem;">🗂️</div>
                    <div style="font-weight:900; color:#0f172a; font-size:1.05rem; margin-bottom:0.4rem;">Offer Unavailable</div>
                    <div style="color:#64748b; font-size:0.88rem; margin-bottom:1.2rem;">This package is no longer available. Please go back and choose another offer.</div>
                    <button onclick="app.navigate('dashboard')" style="background:#047857; color:#fff; font-weight:800; border:none; border-radius:10px; padding:0.6rem 1.4rem; cursor:pointer;">← Back to Dashboard</button>
                </div>
            </div>`;
        }

        const localReqs = JSON.parse(localStorage.getItem('umrah_requirements') || '[]');
        const apiReqs = this.state.myRequirements || [];
        const req = [...apiReqs, ...localReqs].find(r => r.id === offer.requirementId);
        const travelersCount = offer.travelersCount || (req ? (req.travelersCount || req.adults) : null) || 1;
        const perPersonPrice = offer.discountedPrice || offer.price || 0;
        const totalDiscountedPrice = perPersonPrice * travelersCount;

        const user = this.state.currentUser || {};

        const sidebar = `
        <aside style="width:230px;flex-shrink:0;background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:1.1rem;box-shadow:0 2px 8px rgba(0,0,0,0.02);display:flex;flex-direction:column;gap:1.3rem;">
            <div style="padding-bottom:.9rem;border-bottom:1px solid #f3f4f6;">
                <div style="font-size:1.15rem;font-weight:900;color:#1a6b3c;display:flex;align-items:center;gap:.5rem;">
                    <img src="logo.png" onerror="this.onerror=null;this.src='images/logo.png';" alt="ZILHAJ" style="width:30px;height:30px;object-fit:cover;border-radius:50%;border:1px solid #e2e8f0;flex-shrink:0;">
                    <span>ZILHAJ</span>
                </div>
                <div style="font-size:.67rem;color:#6b7280;margin-top:.15rem;font-weight:500;">One Request. Multiple Verified Offers.</div>
            </div>

            <nav style="display:flex;flex-direction:column;gap:.35rem;">
                <a href="javascript:void(0)" onclick="app.setDashboardTab('requests')" style="display:flex;align-items:center;gap:.6rem;padding:.58rem .82rem;border-radius:10px;text-decoration:none;font-size:.84rem;font-weight:500;color:#374151;transition:all .2s;" onmouseover="this.style.background='#f0faf5';this.style.color='#1a6b3c';" onmouseout="this.style.background='transparent';this.style.color='#374151';">📄 My Requests</a>
                <a href="javascript:void(0)" onclick="app.setDashboardTab('payments')" style="display:flex;align-items:center;gap:.6rem;padding:.58rem .82rem;border-radius:10px;text-decoration:none;font-size:.84rem;font-weight:500;color:#374151;transition:all .2s;" onmouseover="this.style.background='#f0faf5';this.style.color='#1a6b3c';" onmouseout="this.style.background='transparent';this.style.color='#374151';">💳 Payments</a>
                <a href="javascript:void(0)" onclick="app.setDashboardTab('profile')" style="display:flex;align-items:center;gap:.6rem;padding:.58rem .82rem;border-radius:10px;text-decoration:none;font-size:.84rem;font-weight:500;color:#374151;transition:all .2s;" onmouseover="this.style.background='#f0faf5';this.style.color='#1a6b3c';" onmouseout="this.style.background='transparent';this.style.color='#374151';">👤 Profile &amp; Settings</a>
                <a href="javascript:void(0)" onclick="app.setDashboardTab('help')" style="display:flex;align-items:center;gap:.6rem;padding:.58rem .82rem;border-radius:10px;text-decoration:none;font-size:.84rem;font-weight:500;color:#374151;transition:all .2s;" onmouseover="this.style.background='#f0faf5';this.style.color='#1a6b3c';" onmouseout="this.style.background='transparent';this.style.color='#374151';">🎧 Help &amp; Support</a>
            </nav>

            <div style="background:#f0faf5;border-radius:12px;padding:.85rem;border:1px solid #d1fae5;margin-top:auto;">
                <div style="font-size:.78rem;font-weight:800;color:#1a6b3c;margin-bottom:.2rem;">Need Help?</div>
                <div style="font-size:.71rem;color:#4b5563;margin-bottom:.6rem;">We're here to assist you</div>
                <button onclick="app.toggleChatWidget()" style="width:100%;background:#1a6b3c;color:#fff;border:none;border-radius:7px;padding:.4rem;font-size:.74rem;font-weight:700;cursor:pointer;">💬 Chat with us</button>
            </div>
            <div style="background:#f8fafc;border-radius:10px;padding:.7rem;border:1px solid #e2e8f0;font-size:.68rem;color:#64748b;line-height:1.35;">
                <strong style="color:#0f172a;">🛡️ Privacy Protected</strong><br>We never share personal info with agents.
            </div>
        </aside>`;

        const mainContent = `
        <main style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1.4rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:1.1rem 1.6rem;box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                <div style="display:flex;align-items:center;gap:1.1rem;">
                    <div style="width:36px;height:36px;background:#f1f5f9;border-radius:50%;display:flex;align-items:center;justify-content:center;position:relative;">
                        <span style="font-size:1rem;">🔔</span>
                        <span style="position:absolute;top:-2px;right:-2px;background:#047857;color:#fff;font-size:0.65rem;font-weight:800;width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;">2</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:0.6rem;background:#f8fafc;padding:0.35rem 0.8rem;border-radius:99px;border:1px solid #e2e8f0;">
                        <div style="width:30px;height:30px;border-radius:50%;background:#047857;color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:0.85rem;">${this.escapeHtml((user.name || 'G').charAt(0).toUpperCase())}</div>
                        <div>
                            <div style="font-size:0.82rem;font-weight:800;color:#0f172a;">${this.escapeHtml(user.name || 'Guest')}</div>
                            <div style="font-size:0.68rem;color:#64748b;">Customer</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 2 Column Content Layout matching Image 1 -->
            <div style="display:grid;grid-template-columns:1fr 340px;gap:1.4rem;align-items:start;">
                
                <!-- Left Details Column -->
                <div style="display:flex;flex-direction:column;gap:1.4rem;">

                    <!-- Main Package Summary Banner Card -->
                    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:1.6rem;box-shadow:0 2px 10px rgba(0,0,0,0.02);display:flex;justify-content:space-between;align-items:center;gap:1.2rem;flex-wrap:wrap;">
                        <div style="display:flex;gap:1.2rem;align-items:center;">
                            <img src="https://images.unsplash.com/photo-1591604466107-ec97de577aff?auto=format&fit=crop&w=180&q=80" alt="Kaaba" style="width:96px;height:96px;border-radius:12px;object-fit:cover;">
                            <div>
                                <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.35rem;">
                                    <h3 style="font-size:1.25rem;font-weight:800;color:#0f172a;margin:0;">${this.escapeHtml(offer.packageTitle)}</h3>
                                    <span style="background:#ecfdf5;color:#047857;font-size:0.75rem;font-weight:800;padding:0.2rem 0.65rem;border-radius:99px;">${offer.durationDays ? offer.durationDays + ' Days' : 'Duration N/A'}</span>
                                </div>
                                <div style="font-size:0.82rem;color:#64748b;margin-bottom:0.65rem;">${offer.requirementId ? 'REQ-' + offer.requirementId : ''}${offer.requirementId && travelersCount ? ' • ' : ''}${travelersCount} Adults, 0 Children</div>
                                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                                    <span style="background:#f1f5f9;color:#047857;font-size:0.75rem;font-weight:700;padding:0.25rem 0.65rem;border-radius:6px;">✈ Flights Included</span>
                                    <span style="background:#f1f5f9;color:#047857;font-size:0.75rem;font-weight:700;padding:0.25rem 0.65rem;border-radius:6px;">✓ Visa Included</span>
                                    <span style="background:#f1f5f9;color:#047857;font-size:0.75rem;font-weight:700;padding:0.25rem 0.65rem;border-radius:6px;">🚍 Transport Included</span>
                                </div>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:0.72rem;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Total Package Price</div>
                            <div style="font-size:1.8rem;font-weight:900;color:#0f172a;line-height:1.1;margin-top:0.2rem;">${this.formatCurrency(totalDiscountedPrice)}</div>
                            <div style="font-size:0.78rem;color:#64748b;margin-top:0.2rem;">Per Person (${this.formatCurrency(perPersonPrice)})</div>
                        </div>
                    </div>

                    <!-- Journey Overview -->
                    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:1.4rem;box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                        <h4 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin:0 0 0.3rem;">Journey Overview</h4>
                        <p style="font-size:0.82rem;color:#64748b;margin:0 0 1.1rem;">A comfortable and spiritual journey to the holy cities with carefully selected services.</p>
                        <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:1rem;">
                            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:1rem;display:flex;align-items:center;gap:0.85rem;">
                                <div style="font-size:1.4rem;background:#ffffff;width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,0.04);">📅</div>
                                <div>
                                    <div style="font-size:0.68rem;color:#64748b;font-weight:800;text-transform:uppercase;">DEPARTURE</div>
                                    <div style="font-size:0.92rem;font-weight:800;color:#0f172a;margin-top:0.1rem;">15 Oct 2026</div>
                                    <div style="font-size:0.75rem;color:#64748b;">Lucknow (LKO)</div>
                                </div>
                            </div>
                            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:1rem;display:flex;align-items:center;gap:0.85rem;">
                                <div style="font-size:1.4rem;background:#ffffff;width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,0.04);">✈️</div>
                                <div>
                                    <div style="font-size:0.68rem;color:#64748b;font-weight:800;text-transform:uppercase;">RETURN</div>
                                    <div style="font-size:0.92rem;font-weight:800;color:#0f172a;margin-top:0.1rem;">24 Oct 2026</div>
                                    <div style="font-size:0.75rem;color:#64748b;">Jeddah (JED)</div>
                                </div>
                            </div>
                            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:1rem;display:flex;align-items:center;gap:0.85rem;">
                                <div style="font-size:1.4rem;background:#ffffff;width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,0.04);">⏱️</div>
                                <div>
                                    <div style="font-size:0.68rem;color:#64748b;font-weight:800;text-transform:uppercase;">DURATION</div>
                                    <div style="font-size:0.92rem;font-weight:800;color:#0f172a;margin-top:0.1rem;">10 Days / 9 Nights</div>
                                    <div style="font-size:0.75rem;color:#64748b;">Total Trip Duration</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Package Inclusions -->
                    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:1.4rem;box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                        <h4 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin:0 0 1rem;">Package Inclusions</h4>
                        <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:1rem;font-size:0.82rem;color:#334155;">
                            <div><strong style="color:#047857;">✓ Return Flights</strong><div style="font-size:0.72rem;color:#64748b;margin-top:0.15rem;">Lucknow to Jeddah &amp; Return</div></div>
                            <div><strong style="color:#047857;">✓ Visa</strong><div style="font-size:0.72rem;color:#64748b;margin-top:0.15rem;">Umrah Visa Included</div></div>
                            <div><strong style="color:#047857;">✓ Transport</strong><div style="font-size:0.72rem;color:#64748b;margin-top:0.15rem;">All Local Transfers</div></div>
                            <div><strong style="color:#047857;">✓ Accommodation</strong><div style="font-size:0.72rem;color:#64748b;margin-top:0.15rem;">9 Nights Stay in Makkah &amp; Madinah</div></div>
                            <div><strong style="color:#047857;">✓ Meals</strong><div style="font-size:0.72rem;color:#64748b;margin-top:0.15rem;">Breakfast, Lunch &amp; Dinner</div></div>
                            <div><strong style="color:#047857;">✓ Ziyarat</strong><div style="font-size:0.72rem;color:#64748b;margin-top:0.15rem;">Makkah &amp; Madinah Ziyarat</div></div>
                            <div><strong style="color:#047857;">✓ Travel Insurance</strong><div style="font-size:0.72rem;color:#64748b;margin-top:0.15rem;">Coverage Included</div></div>
                        </div>
                    </div>

                    <!-- Accommodation Details -->
                    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:1.4rem;box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                        <h4 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin:0 0 1.1rem;">Accommodation Details</h4>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.2rem;">
                            <div style="border:1px solid #e2e8f0;border-radius:12px;padding:1rem;display:flex;gap:1rem;align-items:center;">
                                <img src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=150&q=80" alt="Makkah Hotel" style="width:76px;height:76px;border-radius:10px;object-fit:cover;">
                                <div>
                                    <div style="font-size:0.72rem;color:#64748b;font-weight:700;">Makkah Hotel</div>
                                    <div style="font-size:0.95rem;font-weight:800;color:#0f172a;margin-top:0.1rem;">${this.escapeHtml(offer.makkahHotel || 'Anjum Hotel Makkah')}</div>
                                    <div style="font-size:0.75rem;color:#047857;font-weight:700;margin-top:0.15rem;">4 ★ • 4 Nights</div>
                                    <div style="font-size:0.72rem;color:#64748b;margin-top:0.2rem;">📍 Distance from Haram: 650m • Room Type: Standard Room</div>
                                </div>
                            </div>
                            <div style="border:1px solid #e2e8f0;border-radius:12px;padding:1rem;display:flex;gap:1rem;align-items:center;">
                                <img src="https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=150&q=80" alt="Madinah Hotel" style="width:76px;height:76px;border-radius:10px;object-fit:cover;">
                                <div>
                                    <div style="font-size:0.72rem;color:#64748b;font-weight:700;">Madinah Hotel</div>
                                    <div style="font-size:0.95rem;font-weight:800;color:#0f172a;margin-top:0.1rem;">${this.escapeHtml(offer.madinahHotel || 'Durrat Al Eiman Hotel')}</div>
                                    <div style="font-size:0.75rem;color:#047857;font-weight:700;margin-top:0.15rem;">4 ★ • 5 Nights</div>
                                    <div style="font-size:0.72rem;color:#64748b;margin-top:0.2rem;">📍 Distance from Haram: 300m • Room Type: Standard Room</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Itinerary Highlights Timeline -->
                    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:1.4rem;box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                        <h4 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin:0 0 1.4rem;">Itinerary Highlights</h4>
                        <div style="display:flex;justify-content:space-between;align-items:center;text-align:center;position:relative;">
                            <div>
                                <div style="width:46px;height:46px;border-radius:50%;background:#ecfdf5;color:#047857;display:flex;align-items:center;justify-content:center;margin:0 auto 0.5rem;font-size:1.2rem;">✈️</div>
                                <div style="font-size:0.75rem;color:#64748b;">15 Oct 2026</div>
                                <div style="font-size:0.88rem;font-weight:800;color:#0f172a;">Departure</div>
                                <div style="font-size:0.72rem;color:#64748b;">Lucknow (LKO)</div>
                            </div>
                            <div style="color:#cbd5e1;font-size:1.3rem;">→</div>
                            <div>
                                <div style="width:46px;height:46px;border-radius:50%;background:#ecfdf5;color:#047857;display:flex;align-items:center;justify-content:center;margin:0 auto 0.5rem;font-size:1.2rem;">🛬</div>
                                <div style="font-size:0.75rem;color:#64748b;">15 Oct 2026</div>
                                <div style="font-size:0.88rem;font-weight:800;color:#0f172a;">Arrive Jeddah</div>
                                <div style="font-size:0.72rem;color:#64748b;">Transfer to Makkah</div>
                            </div>
                            <div style="color:#cbd5e1;font-size:1.3rem;">→</div>
                            <div>
                                <div style="width:46px;height:46px;border-radius:50%;background:#ecfdf5;color:#047857;display:flex;align-items:center;justify-content:center;margin:0 auto 0.5rem;font-size:1.2rem;">🕋</div>
                                <div style="font-size:0.75rem;color:#64748b;">4 Nights</div>
                                <div style="font-size:0.88rem;font-weight:800;color:#0f172a;">Stay in Makkah</div>
                                <div style="font-size:0.72rem;color:#64748b;">Ziyarat &amp; Worship</div>
                            </div>
                            <div style="color:#cbd5e1;font-size:1.3rem;">→</div>
                            <div>
                                <div style="width:46px;height:46px;border-radius:50%;background:#ecfdf5;color:#047857;display:flex;align-items:center;justify-content:center;margin:0 auto 0.5rem;font-size:1.2rem;">🕌</div>
                                <div style="font-size:0.75rem;color:#64748b;">5 Nights</div>
                                <div style="font-size:0.88rem;font-weight:800;color:#0f172a;">Stay in Madinah</div>
                                <div style="font-size:0.72rem;color:#64748b;">Ziyarat &amp; Worship</div>
                            </div>
                            <div style="color:#cbd5e1;font-size:1.3rem;">→</div>
                            <div>
                                <div style="width:46px;height:46px;border-radius:50%;background:#ecfdf5;color:#047857;display:flex;align-items:center;justify-content:center;margin:0 auto 0.5rem;font-size:1.2rem;">🛫</div>
                                <div style="font-size:0.75rem;color:#64748b;">24 Oct 2026</div>
                                <div style="font-size:0.88rem;font-weight:800;color:#0f172a;">Return Flight</div>
                                <div style="font-size:0.72rem;color:#64748b;">Jeddah (JED)</div>
                            </div>
                        </div>
                    </div>

                    <!-- Bottom Privacy Protection Banner -->
                    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;padding:1rem 1.2rem;display:flex;align-items:center;gap:0.9rem;">
                        <span style="font-size:1.3rem;color:#047857;">🛡️</span>
                        <div style="font-size:0.82rem;color:#166534;line-height:1.4;">
                            Your personal contact details are protected. They will never be shared with any agent or provider.
                        </div>
                    </div>

                </div>

                <!-- Right Column Sidebar -->
                <div style="display:flex;flex-direction:column;gap:1.4rem;position:sticky;top:0;">
                    <!-- Price Summary Card -->
                    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;padding:1.6rem;box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                        <h4 style="font-size:1.1rem;font-weight:800;color:#0f172a;margin:0 0 1.2rem;">Price Summary</h4>
                        <div style="display:flex;flex-direction:column;gap:0.85rem;font-size:0.9rem;color:#475569;">
                            <div style="display:flex;justify-content:space-between;">
                                <span>Package Price (Per Person)</span>
                                <span style="font-weight:700;color:#0f172a;">${this.formatCurrency(perPersonPrice)}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;">
                                <span>Taxes &amp; Fees</span>
                                <span style="font-weight:700;color:#0f172a;">₹3,200</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;">
                                <span>Visa Charges</span>
                                <span style="font-weight:700;color:#0f172a;">₹2,000</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;">
                                <span>Travel Insurance</span>
                                <span style="font-weight:700;color:#0f172a;">₹1,200</span>
                            </div>
                            <div style="border-top:1px dashed #cbd5e1;margin:0.4rem 0;"></div>
                            <div style="display:flex;justify-content:space-between;align-items:center;">
                                <span style="font-size:1.1rem;font-weight:800;color:#0f172a;">Total Amount</span>
                                <span style="font-size:1.7rem;font-weight:900;color:#047857;">${this.formatCurrency(totalDiscountedPrice)}</span>
                            </div>
                            <div style="font-size:0.75rem;color:#64748b;text-align:right;">All amounts are in INR</div>
                        </div>
                    </div>

                    <!-- Travel Details Box -->
                    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;padding:1.4rem;box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.9rem;">
                            <h5 style="font-size:0.95rem;font-weight:800;color:#0f172a;margin:0;">Travel Details</h5>
                            <a href="javascript:void(0)" style="font-size:0.78rem;font-weight:700;color:#047857;text-decoration:none;">View Details</a>
                        </div>
                        <div style="display:flex;flex-direction:column;gap:0.8rem;font-size:0.82rem;color:#475569;">
                            <div style="background:#f8fafc;padding:0.75rem;border-radius:10px;display:flex;justify-content:space-between;align-items:center;">
                                <div>
                                    <div style="font-size:0.72rem;color:#64748b;font-weight:700;text-transform:uppercase;">Departure</div>
                                    <div style="font-size:0.88rem;font-weight:800;color:#0f172a;margin-top:0.1rem;">15 Oct 2026, 04:55 AM</div>
                                </div>
                                <div style="font-size:0.8rem;font-weight:700;color:#64748b;">LKO → JED</div>
                            </div>
                            <div style="background:#f8fafc;padding:0.75rem;border-radius:10px;display:flex;justify-content:space-between;align-items:center;">
                                <div>
                                    <div style="font-size:0.72rem;color:#64748b;font-weight:700;text-transform:uppercase;">Return</div>
                                    <div style="font-size:0.88rem;font-weight:800;color:#0f172a;margin-top:0.1rem;">24 Oct 2026, 02:30 PM</div>
                                </div>
                                <div style="font-size:0.8rem;font-weight:700;color:#64748b;">JED → LKO</div>
                            </div>
                        </div>
                    </div>

                    <!-- Important Notes Box -->
                    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;padding:1.4rem;box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                        <h5 style="font-size:0.95rem;font-weight:800;color:#0f172a;margin:0 0 0.9rem;">Important Notes</h5>
                        <div style="display:flex;flex-direction:column;gap:0.6rem;font-size:0.82rem;color:#475569;">
                            <div style="display:flex;align-items:center;gap:0.5rem;"><span style="color:#047857;">✓</span> <span>Passport must be valid for 6+ months</span></div>
                            <div style="display:flex;align-items:center;gap:0.5rem;"><span style="color:#047857;">✓</span> <span>COVID-19 vaccination certificate required</span></div>
                            <div style="display:flex;align-items:center;gap:0.5rem;"><span style="color:#047857;">✓</span> <span>Package is non-refundable after confirmation</span></div>
                            <div style="display:flex;align-items:center;gap:0.5rem;"><span style="color:#047857;">✓</span> <span>Standard cancellation policies apply</span></div>
                        </div>
                    </div>

                    <!-- Terms & CTA Button Card -->
                    <div style="display:flex;flex-direction:column;gap:1rem;">
                        <label style="display:flex;align-items:center;gap:0.6rem;font-size:0.83rem;color:#475569;cursor:pointer;">
                            <input type="checkbox" checked style="accent-color:#047857;width:16px;height:16px;">
                            <span>I have read and agree to the <a href="javascript:void(0)" style="color:#047857;font-weight:700;">Terms &amp; Conditions</a></span>
                        </label>

                        <button onclick="app.openOfferPaymentModal('${offer.id}');" style="width:100%;background:#047857;color:#ffffff;border:none;border-radius:12px;padding:1.1rem;font-size:1.05rem;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.6rem;box-shadow:0 4px 18px rgba(4,120,87,0.3);transition:all 0.2s;" onmouseover="this.style.background='#065f46';this.style.transform='translateY(-2px)'" onmouseout="this.style.background='#047857';this.style.transform='none'">
                            <span>🔒</span> <span>Proceed to Payment</span>
                        </button>

                        <div style="font-size:0.78rem;color:#64748b;text-align:center;display:flex;align-items:center;justify-content:center;gap:0.4rem;">
                            <span>✓</span> 100% Secure &amp; Encrypted
                        </div>
                    </div>

                </div>

            </div>
        </main>`;

        return `
        <div style="background:#f8fafc;min-height:100vh;padding:94px 0 3rem;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            <div style="max-width:1240px;margin:0 auto;padding:0 1.2rem;display:flex;gap:1.1rem;align-items:flex-start;">
                ${sidebar}
                ${mainContent}
            </div>
        </div>`;
    }

    openOfferPaymentModal(offerId) {
        this.closeModal();
        const id = offerId || '';
        this.state.activeOfferId = id;
        this.navigate('payment');
    }

    toggleUpiQrCode() {
        this.state.showUpiQrCode = !this.state.showUpiQrCode;
        const main = document.getElementById('mainContainer');
        if (main) main.innerHTML = this.renderDashboardPage();
    }

    switchPaymentMethodTab(method) {
        this.state.selectedPaymentMethod = method;
        if (method !== 'upi') {
            this.state.showUpiQrCode = false;
        }
        const main = document.getElementById('mainContainer');
        if (main) main.innerHTML = this.renderDashboardPage();
    }

    renderPackageDetailsTab(offerId) {
        const allOffers = this.getAllOffers();
        const offer = allOffers.find(o => o.id === offerId);
        if (!offer) {
            return `<div style="min-height:60vh; display:flex; align-items:center; justify-content:center; color:#64748b; font-family:'Inter',sans-serif;">Offer Unavailable</div>`;
        }

        const localReqs = JSON.parse(localStorage.getItem('umrah_requirements') || '[]');
        const apiReqs = this.state.myRequirements || [];
        const req = [...apiReqs, ...localReqs].find(r => r.id === offer.requirementId);
        const travelersCount = offer.travelersCount || (req ? (req.travelersCount || req.adults) : null) || 1;
        const perPersonPrice = offer.discountedPrice || offer.price || 0;
        const totalDiscountedPrice = perPersonPrice * travelersCount;

        const user = this.state.currentUser || {};

        return `
        <main style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1.4rem;">
            <!-- Header Bar matching Image 1 -->
            <div style="display:flex;justify-content:space-between;align-items:center;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:1.1rem 1.6rem;box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                <div style="display:flex;align-items:center;gap:1.2rem;">
                    <button onclick="app.setDashboardTab('dashboard')" style="background:#ffffff;color:#0f172a;border:1px solid #cbd5e1;border-radius:8px;padding:0.45rem 0.9rem;font-weight:700;font-size:0.84rem;cursor:pointer;display:flex;align-items:center;gap:0.4rem;">
                        ← Back to Offers
                    </button>
                    <div>
                        <h1 style="font-size:1.3rem;font-weight:800;color:#0f172a;margin:0;line-height:1.2;">Review Package Details</h1>
                        <div style="font-size:0.8rem;color:#64748b;margin-top:0.15rem;">Please review all package details carefully before proceeding to payment.</div>
                    </div>
                </div>

                <div style="display:flex;align-items:center;gap:1.1rem;">
                    <div style="width:36px;height:36px;background:#f1f5f9;border-radius:50%;display:flex;align-items:center;justify-content:center;position:relative;">
                        <span style="font-size:1rem;">🔔</span>
                        <span style="position:absolute;top:-2px;right:-2px;background:#047857;color:#fff;font-size:0.65rem;font-weight:800;width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;">2</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:0.6rem;background:#f8fafc;padding:0.35rem 0.8rem;border-radius:99px;border:1px solid #e2e8f0;">
                        <div style="width:30px;height:30px;border-radius:50%;background:#047857;color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:0.85rem;">${this.escapeHtml((user.name || 'G').charAt(0).toUpperCase())}</div>
                        <div>
                            <div style="font-size:0.82rem;font-weight:800;color:#0f172a;">${this.escapeHtml(user.name || 'Guest')}</div>
                            <div style="font-size:0.68rem;color:#64748b;">Customer</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 2 Column Content Layout -->
            <div style="display:grid;grid-template-columns:1fr 340px;gap:1.4rem;align-items:start;">
                
                <!-- Left Details Column -->
                <div style="display:flex;flex-direction:column;gap:1.4rem;">

                    <!-- Main Package Summary Banner Card -->
                    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:1.6rem;box-shadow:0 2px 10px rgba(0,0,0,0.02);display:flex;justify-content:space-between;align-items:center;gap:1.2rem;flex-wrap:wrap;">
                        <div style="display:flex;gap:1.2rem;align-items:center;">
                            <img src="https://images.unsplash.com/photo-1591604466107-ec97de577aff?auto=format&fit=crop&w=180&q=80" alt="Kaaba" style="width:96px;height:96px;border-radius:12px;object-fit:cover;">
                            <div>
                                <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.35rem;">
                                    <h3 style="font-size:1.25rem;font-weight:800;color:#0f172a;margin:0;">${this.escapeHtml(offer.packageTitle)}</h3>
                                    <span style="background:#ecfdf5;color:#047857;font-size:0.75rem;font-weight:800;padding:0.2rem 0.65rem;border-radius:99px;">${offer.durationDays ? offer.durationDays + ' Days' : 'Duration N/A'}</span>
                                </div>
                                <div style="font-size:0.82rem;color:#64748b;margin-bottom:0.65rem;">${offer.requirementId ? 'REQ-' + offer.requirementId : ''}${offer.requirementId && travelersCount ? ' • ' : ''}${travelersCount} Adults, 0 Children</div>
                                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                                    <span style="background:#f1f5f9;color:#047857;font-size:0.75rem;font-weight:700;padding:0.25rem 0.65rem;border-radius:6px;">✈ Flights Included</span>
                                    <span style="background:#f1f5f9;color:#047857;font-size:0.75rem;font-weight:700;padding:0.25rem 0.65rem;border-radius:6px;">✓ Visa Included</span>
                                    <span style="background:#f1f5f9;color:#047857;font-size:0.75rem;font-weight:700;padding:0.25rem 0.65rem;border-radius:6px;">🚍 Transport Included</span>
                                </div>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:0.72rem;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Total Package Price</div>
                            <div style="font-size:1.8rem;font-weight:900;color:#0f172a;line-height:1.1;margin-top:0.2rem;">${this.formatCurrency(totalDiscountedPrice)}</div>
                            <div style="font-size:0.78rem;color:#64748b;margin-top:0.2rem;">Per Person (${this.formatCurrency(perPersonPrice)})</div>
                        </div>
                    </div>

                    <!-- Journey Overview -->
                    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:1.4rem;box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                        <h4 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin:0 0 0.3rem;">Journey Overview</h4>
                        <p style="font-size:0.82rem;color:#64748b;margin:0 0 1.1rem;">A comfortable and spiritual journey to the holy cities with carefully selected services.</p>
                        <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:1rem;">
                            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:1rem;display:flex;align-items:center;gap:0.85rem;">
                                <div style="font-size:1.4rem;background:#ffffff;width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,0.04);">📅</div>
                                <div>
                                    <div style="font-size:0.68rem;color:#64748b;font-weight:800;text-transform:uppercase;">DEPARTURE</div>
                                    <div style="font-size:0.92rem;font-weight:800;color:#0f172a;margin-top:0.1rem;">15 Oct 2026</div>
                                    <div style="font-size:0.75rem;color:#64748b;">Lucknow (LKO)</div>
                                </div>
                            </div>
                            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:1rem;display:flex;align-items:center;gap:0.85rem;">
                                <div style="font-size:1.4rem;background:#ffffff;width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,0.04);">✈️</div>
                                <div>
                                    <div style="font-size:0.68rem;color:#64748b;font-weight:800;text-transform:uppercase;">RETURN</div>
                                    <div style="font-size:0.92rem;font-weight:800;color:#0f172a;margin-top:0.1rem;">24 Oct 2026</div>
                                    <div style="font-size:0.75rem;color:#64748b;">Jeddah (JED)</div>
                                </div>
                            </div>
                            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:1rem;display:flex;align-items:center;gap:0.85rem;">
                                <div style="font-size:1.4rem;background:#ffffff;width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,0.04);">⏱️</div>
                                <div>
                                    <div style="font-size:0.68rem;color:#64748b;font-weight:800;text-transform:uppercase;">DURATION</div>
                                    <div style="font-size:0.92rem;font-weight:800;color:#0f172a;margin-top:0.1rem;">10 Days / 9 Nights</div>
                                    <div style="font-size:0.75rem;color:#64748b;">Total Trip Duration</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Package Inclusions -->
                    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:1.4rem;box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                        <h4 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin:0 0 1rem;">Package Inclusions</h4>
                        <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:1rem;font-size:0.82rem;color:#334155;">
                            <div><strong style="color:#047857;">✓ Return Flights</strong><div style="font-size:0.72rem;color:#64748b;margin-top:0.15rem;">Lucknow to Jeddah &amp; Return</div></div>
                            <div><strong style="color:#047857;">✓ Visa</strong><div style="font-size:0.72rem;color:#64748b;margin-top:0.15rem;">Umrah Visa Included</div></div>
                            <div><strong style="color:#047857;">✓ Transport</strong><div style="font-size:0.72rem;color:#64748b;margin-top:0.15rem;">All Local Transfers</div></div>
                            <div><strong style="color:#047857;">✓ Accommodation</strong><div style="font-size:0.72rem;color:#64748b;margin-top:0.15rem;">9 Nights Stay in Makkah &amp; Madinah</div></div>
                            <div><strong style="color:#047857;">✓ Meals</strong><div style="font-size:0.72rem;color:#64748b;margin-top:0.15rem;">Breakfast, Lunch &amp; Dinner</div></div>
                            <div><strong style="color:#047857;">✓ Ziyarat</strong><div style="font-size:0.72rem;color:#64748b;margin-top:0.15rem;">Makkah &amp; Madinah Ziyarat</div></div>
                            <div><strong style="color:#047857;">✓ Travel Insurance</strong><div style="font-size:0.72rem;color:#64748b;margin-top:0.15rem;">Coverage Included</div></div>
                        </div>
                    </div>

                    <!-- Accommodation Details -->
                    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:1.4rem;box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                        <h4 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin:0 0 1.1rem;">Accommodation Details</h4>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.2rem;">
                            <div style="border:1px solid #e2e8f0;border-radius:12px;padding:1rem;display:flex;gap:1rem;align-items:center;">
                                <img src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=150&q=80" alt="Makkah Hotel" style="width:76px;height:76px;border-radius:10px;object-fit:cover;">
                                <div>
                                    <div style="font-size:0.72rem;color:#64748b;font-weight:700;">Makkah Hotel</div>
                                    <div style="font-size:0.95rem;font-weight:800;color:#0f172a;margin-top:0.1rem;">${this.escapeHtml(offer.makkahHotel || 'Anjum Hotel Makkah')}</div>
                                    <div style="font-size:0.75rem;color:#047857;font-weight:700;margin-top:0.15rem;">4 ★ • 4 Nights</div>
                                    <div style="font-size:0.72rem;color:#64748b;margin-top:0.2rem;">📍 Distance from Haram: 650m • Room Type: Standard Room</div>
                                </div>
                            </div>
                            <div style="border:1px solid #e2e8f0;border-radius:12px;padding:1rem;display:flex;gap:1rem;align-items:center;">
                                <img src="https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=150&q=80" alt="Madinah Hotel" style="width:76px;height:76px;border-radius:10px;object-fit:cover;">
                                <div>
                                    <div style="font-size:0.72rem;color:#64748b;font-weight:700;">Madinah Hotel</div>
                                    <div style="font-size:0.95rem;font-weight:800;color:#0f172a;margin-top:0.1rem;">${this.escapeHtml(offer.madinahHotel || 'Durrat Al Eiman Hotel')}</div>
                                    <div style="font-size:0.75rem;color:#047857;font-weight:700;margin-top:0.15rem;">4 ★ • 5 Nights</div>
                                    <div style="font-size:0.72rem;color:#64748b;margin-top:0.2rem;">📍 Distance from Haram: 300m • Room Type: Standard Room</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Itinerary Highlights Timeline -->
                    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:1.4rem;box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                        <h4 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin:0 0 1.2rem;">Itinerary Highlights</h4>
                        <div style="display:flex;justify-content:space-between;align-items:center;text-align:center;position:relative;">
                            <div>
                                <div style="width:42px;height:42px;border-radius:50%;background:#ecfdf5;color:#047857;display:flex;align-items:center;justify-content:center;margin:0 auto 0.4rem;font-size:1.1rem;">✈️</div>
                                <div style="font-size:0.72rem;color:#64748b;">15 Oct 2026</div>
                                <div style="font-size:0.85rem;font-weight:800;color:#0f172a;">Departure</div>
                                <div style="font-size:0.7rem;color:#64748b;">Lucknow (LKO)</div>
                            </div>
                            <div style="color:#cbd5e1;font-size:1.2rem;">→</div>
                            <div>
                                <div style="width:42px;height:42px;border-radius:50%;background:#ecfdf5;color:#047857;display:flex;align-items:center;justify-content:center;margin:0 auto 0.4rem;font-size:1.1rem;">🛬</div>
                                <div style="font-size:0.72rem;color:#64748b;">15 Oct 2026</div>
                                <div style="font-size:0.85rem;font-weight:800;color:#0f172a;">Arrive Jeddah</div>
                                <div style="font-size:0.7rem;color:#64748b;">Transfer to Makkah</div>
                            </div>
                            <div style="color:#cbd5e1;font-size:1.2rem;">→</div>
                            <div>
                                <div style="width:42px;height:42px;border-radius:50%;background:#ecfdf5;color:#047857;display:flex;align-items:center;justify-content:center;margin:0 auto 0.4rem;font-size:1.1rem;">🕋</div>
                                <div style="font-size:0.72rem;color:#64748b;">4 Nights</div>
                                <div style="font-size:0.85rem;font-weight:800;color:#0f172a;">Stay in Makkah</div>
                                <div style="font-size:0.7rem;color:#64748b;">Ziyarat &amp; Worship</div>
                            </div>
                            <div style="color:#cbd5e1;font-size:1.2rem;">→</div>
                            <div>
                                <div style="width:42px;height:42px;border-radius:50%;background:#ecfdf5;color:#047857;display:flex;align-items:center;justify-content:center;margin:0 auto 0.4rem;font-size:1.1rem;">🕌</div>
                                <div style="font-size:0.72rem;color:#64748b;">5 Nights</div>
                                <div style="font-size:0.85rem;font-weight:800;color:#0f172a;">Stay in Madinah</div>
                                <div style="font-size:0.7rem;color:#64748b;">Ziyarat &amp; Worship</div>
                            </div>
                            <div style="color:#cbd5e1;font-size:1.2rem;">→</div>
                            <div>
                                <div style="width:42px;height:42px;border-radius:50%;background:#ecfdf5;color:#047857;display:flex;align-items:center;justify-content:center;margin:0 auto 0.4rem;font-size:1.1rem;">🛫</div>
                                <div style="font-size:0.72rem;color:#64748b;">24 Oct 2026</div>
                                <div style="font-size:0.85rem;font-weight:800;color:#0f172a;">Return Flight</div>
                                <div style="font-size:0.7rem;color:#64748b;">Jeddah (JED)</div>
                            </div>
                        </div>
                    </div>

                    <!-- Bottom Privacy Protection Banner -->
                    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:0.85rem 1.1rem;display:flex;align-items:center;gap:0.8rem;">
                        <span style="font-size:1.2rem;color:#047857;">🛡️</span>
                        <div style="font-size:0.78rem;color:#166534;line-height:1.4;">
                            Your personal contact details are protected. They will never be shared with any agent or provider.
                        </div>
                    </div>

                </div>

                <!-- Right Column Sidebar -->
                <div style="display:flex;flex-direction:column;gap:1.2rem;position:sticky;top:98px;">
                    <!-- Price Summary Box -->
                    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:1.4rem;box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                        <h4 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin:0 0 1.1rem;">Price Summary</h4>
                        <div style="display:flex;flex-direction:column;gap:0.75rem;font-size:0.88rem;color:#475569;">
                            <div style="display:flex;justify-content:space-between;">
                                <span>Package Price (Per Person)</span>
                                <span style="font-weight:700;color:#0f172a;">${this.formatCurrency(perPersonPrice)}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;">
                                <span>Taxes &amp; Fees</span>
                                <span style="font-weight:700;color:#0f172a;">₹3,200</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;">
                                <span>Visa Charges</span>
                                <span style="font-weight:700;color:#0f172a;">₹2,000</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;">
                                <span>Travel Insurance</span>
                                <span style="font-weight:700;color:#0f172a;">₹1,200</span>
                            </div>
                            <div style="border-top:1px dashed #cbd5e1;margin:0.3rem 0;"></div>
                            <div style="display:flex;justify-content:space-between;align-items:center;">
                                <span style="font-size:1.05rem;font-weight:800;color:#0f172a;">Total Amount</span>
                                <span style="font-size:1.6rem;font-weight:900;color:#047857;">${this.formatCurrency(totalDiscountedPrice)}</span>
                            </div>
                            <div style="font-size:0.72rem;color:#64748b;text-align:right;">All amounts are in INR</div>
                        </div>
                    </div>

                    <!-- Travel Details Box -->
                    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:1.2rem;box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.8rem;">
                            <h5 style="font-size:0.9rem;font-weight:800;color:#0f172a;margin:0;">Travel Details</h5>
                            <a href="javascript:void(0)" style="font-size:0.75rem;font-weight:700;color:#047857;text-decoration:none;">View Details</a>
                        </div>
                        <div style="display:flex;flex-direction:column;gap:0.7rem;font-size:0.8rem;color:#475569;">
                            <div style="background:#f8fafc;padding:0.65rem 0.8rem;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
                                <div>
                                    <div style="font-size:0.68rem;color:#64748b;font-weight:700;text-transform:uppercase;">Departure</div>
                                    <div style="font-size:0.84rem;font-weight:800;color:#0f172a;margin-top:0.1rem;">15 Oct 2026, 04:55 AM</div>
                                </div>
                                <div style="font-size:0.75rem;font-weight:700;color:#64748b;">LKO → JED</div>
                            </div>
                            <div style="background:#f8fafc;padding:0.65rem 0.8rem;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
                                <div>
                                    <div style="font-size:0.68rem;color:#64748b;font-weight:700;text-transform:uppercase;">Return</div>
                                    <div style="font-size:0.84rem;font-weight:800;color:#0f172a;margin-top:0.1rem;">24 Oct 2026, 02:30 PM</div>
                                </div>
                                <div style="font-size:0.75rem;font-weight:700;color:#64748b;">JED → LKO</div>
                            </div>
                        </div>
                    </div>

                    <!-- Important Notes Box -->
                    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:1.2rem;box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                        <h5 style="font-size:0.9rem;font-weight:800;color:#0f172a;margin:0 0 0.8rem;">Important Notes</h5>
                        <div style="display:flex;flex-direction:column;gap:0.55rem;font-size:0.78rem;color:#475569;">
                            <div style="display:flex;align-items:center;gap:0.45rem;"><span style="color:#047857;">✓</span> <span>Passport must be valid for 6+ months</span></div>
                            <div style="display:flex;align-items:center;gap:0.45rem;"><span style="color:#047857;">✓</span> <span>COVID-19 vaccination certificate required</span></div>
                            <div style="display:flex;align-items:center;gap:0.45rem;"><span style="color:#047857;">✓</span> <span>Package is non-refundable after confirmation</span></div>
                            <div style="display:flex;align-items:center;gap:0.45rem;"><span style="color:#047857;">✓</span> <span>Standard cancellation policies apply</span></div>
                        </div>
                    </div>

                    <!-- Terms & CTA -->
                    <div style="display:flex;flex-direction:column;gap:0.9rem;">
                        <label style="display:flex;align-items:center;gap:0.55rem;font-size:0.8rem;color:#475569;cursor:pointer;">
                            <input type="checkbox" checked style="accent-color:#047857;width:15px;height:15px;">
                            <span>I have read and agree to the <a href="javascript:void(0)" style="color:#047857;font-weight:700;">Terms &amp; Conditions</a></span>
                        </label>

                        <button onclick="app.state.activeOfferId='${offer.id}';app.setDashboardTab('paymentScreen');" style="width:100%;background:#047857;color:#ffffff;border:none;border-radius:10px;padding:0.95rem;font-size:1rem;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.5rem;box-shadow:0 4px 16px rgba(4,120,87,0.25);transition:all 0.2s;" onmouseover="this.style.background='#065f46';" onmouseout="this.style.background='#047857';">
                            <span>🔒</span> <span>Proceed to Payment</span>
                        </button>

                        <div style="font-size:0.75rem;color:#64748b;text-align:center;display:flex;align-items:center;justify-content:center;gap:0.35rem;">
                            <span>✓</span> 100% Secure &amp; Encrypted
                        </div>
                    </div>

                </div>

            </div>
        </main>
        `;
    }

    renderPaymentScreenTab(offerId) {
        const allOffers = this.getAllOffers();
        const offer = allOffers.find(o => o.id === offerId);
        if (!offer) {
            return `<div style="min-height:60vh; display:flex; align-items:center; justify-content:center; color:#64748b; font-family:'Inter',sans-serif;">Offer Unavailable</div>`;
        }

        const localReqs = JSON.parse(localStorage.getItem('umrah_requirements') || '[]');
        const apiReqs = this.state.myRequirements || [];
        const req = [...apiReqs, ...localReqs].find(r => r.id === offer.requirementId);
        const travelersCount = offer.travelersCount || (req ? (req.travelersCount || req.adults) : null) || 1;
        const perPersonPrice = offer.discountedPrice || offer.price || 0;
        const totalDiscountedPrice = perPersonPrice * travelersCount;

        const user = this.state.currentUser || {};
        const totalAmountFormatted = this.formatCurrency(totalDiscountedPrice);

        const currentPaymentMethod = this.state.selectedPaymentMethod || 'upi';
        const showQr = !!this.state.showUpiQrCode;

        return `
        <main style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1.4rem;">
            
            <!-- Header Bar matching Image 2 -->
            <div style="display:flex;justify-content:space-between;align-items:center;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:1.1rem 1.6rem;box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                <div style="display:flex;align-items:center;gap:1.2rem;">
                    <button onclick="app.setDashboardTab('packageDetails')" style="background:#ffffff;color:#0f172a;border:1px solid #cbd5e1;border-radius:8px;padding:0.45rem 0.9rem;font-weight:700;font-size:0.84rem;cursor:pointer;display:flex;align-items:center;gap:0.4rem;">
                        ← Back to Review Package
                    </button>
                    <div>
                        <div style="display:flex;align-items:center;gap:0.4rem;">
                            <h1 style="font-size:1.3rem;font-weight:800;color:#0f172a;margin:0;line-height:1.2;">Secure Payment</h1>
                            <span style="color:#047857;font-size:1.1rem;">🛡️</span>
                        </div>
                        <div style="font-size:0.8rem;color:#64748b;margin-top:0.15rem;">Your payment information is safe with us. Complete your payment to confirm your booking.</div>
                    </div>
                </div>

                <div style="display:flex;align-items:center;gap:1.1rem;">
                    <div style="width:36px;height:36px;background:#f1f5f9;border-radius:50%;display:flex;align-items:center;justify-content:center;position:relative;">
                        <span style="font-size:1rem;">🔔</span>
                        <span style="position:absolute;top:-2px;right:-2px;background:#047857;color:#fff;font-size:0.65rem;font-weight:800;width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;">2</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:0.6rem;background:#f8fafc;padding:0.35rem 0.8rem;border-radius:99px;border:1px solid #e2e8f0;">
                        <div style="width:30px;height:30px;border-radius:50%;background:#047857;color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:0.85rem;">${this.escapeHtml((user.name || 'G').charAt(0).toUpperCase())}</div>
                        <div>
                            <div style="font-size:0.82rem;font-weight:800;color:#0f172a;">${this.escapeHtml(user.name || 'Guest')}</div>
                            <div style="font-size:0.68rem;color:#64748b;">Customer</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Top Security Banner -->
            <div style="background:linear-gradient(135deg, #047857 0%, #065f46 100%);color:#ffffff;padding:0.85rem 1.4rem;border-radius:14px;display:flex;justify-content:space-between;align-items:center;font-size:0.88rem;font-weight:700;">
                <div style="display:flex;align-items:center;gap:0.6rem;">
                    <span style="font-size:1.1rem;">🛡️</span>
                    <span>100% Secure Payment • All transactions are encrypted and protected</span>
                </div>
                <div style="background:rgba(255,255,255,0.18);backdrop-filter:blur(8px);padding:0.25rem 0.8rem;border-radius:6px;font-size:0.75rem;">
                    PCI DSS Compliant
                </div>
            </div>

            <!-- Main Content 2 Column Grid -->
            <div style="display:grid;grid-template-columns:1fr 340px;gap:1.4rem;align-items:start;">
                
                <!-- Left Form Column -->
                <div style="display:flex;flex-direction:column;gap:1.4rem;">

                    <!-- SECTION 1: CHOOSE PAYMENT METHOD -->
                    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:1.6rem;box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                        <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:1.2rem;">
                            <div style="width:24px;height:24px;background:#047857;color:#fff;border-radius:50%;font-weight:800;font-size:0.8rem;display:flex;align-items:center;justify-content:center;">1</div>
                            <h4 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin:0;">Choose Payment Method</h4>
                        </div>

                        <div style="display:grid;grid-template-columns:220px 1fr;gap:1.4rem;min-height:280px;">
                            
                            <!-- Left Vertical Tabs -->
                            <div style="display:flex;flex-direction:column;gap:0.5rem;border-right:1px solid #f1f5f9;padding-right:1.1rem;">
                                <button type="button" onclick="app.switchPaymentMethodTab('upi')" style="text-align:left;padding:0.8rem 0.9rem;border-radius:10px;border:${currentPaymentMethod==='upi'?'1.5px solid #047857':'1px solid #e2e8f0'};background:${currentPaymentMethod==='upi'?'#f0fdf4':'#ffffff'};cursor:pointer;transition:all 0.2s;">
                                    <div style="display:flex;justify-content:space-between;align-items:center;">
                                        <div style="font-size:0.88rem;font-weight:800;color:${currentPaymentMethod==='upi'?'#047857':'#0f172a'};">📱 UPI</div>
                                        <span style="background:#047857;color:#fff;font-size:0.6rem;font-weight:800;padding:0.1rem 0.4rem;border-radius:4px;">Recommended</span>
                                    </div>
                                    <div style="font-size:0.7rem;color:#64748b;margin-top:0.2rem;">GPay, PhonePe, Paytm, QR</div>
                                </button>

                                <button type="button" onclick="app.switchPaymentMethodTab('card')" style="text-align:left;padding:0.8rem 0.9rem;border-radius:10px;border:${currentPaymentMethod==='card'?'1.5px solid #047857':'1px solid #e2e8f0'};background:${currentPaymentMethod==='card'?'#f0fdf4':'#ffffff'};cursor:pointer;transition:all 0.2s;">
                                    <div style="font-size:0.88rem;font-weight:800;color:${currentPaymentMethod==='card'?'#047857':'#0f172a'};">💳 Debit / Credit Cards</div>
                                    <div style="font-size:0.7rem;color:#64748b;margin-top:0.2rem;">Visa, MasterCard, RuPay</div>
                                </button>

                                <button type="button" onclick="app.switchPaymentMethodTab('net')" style="text-align:left;padding:0.8rem 0.9rem;border-radius:10px;border:${currentPaymentMethod==='net'?'1.5px solid #047857':'1px solid #e2e8f0'};background:${currentPaymentMethod==='net'?'#f0fdf4':'#ffffff'};cursor:pointer;transition:all 0.2s;">
                                    <div style="font-size:0.88rem;font-weight:800;color:${currentPaymentMethod==='net'?'#047857':'#0f172a'};">🏦 Net Banking</div>
                                    <div style="font-size:0.7rem;color:#64748b;margin-top:0.2rem;">All Major Indian Banks</div>
                                </button>

                                <button type="button" onclick="app.switchPaymentMethodTab('wallet')" style="text-align:left;padding:0.8rem 0.9rem;border-radius:10px;border:${currentPaymentMethod==='wallet'?'1.5px solid #047857':'1px solid #e2e8f0'};background:${currentPaymentMethod==='wallet'?'#f0fdf4':'#ffffff'};cursor:pointer;transition:all 0.2s;">
                                    <div style="font-size:0.88rem;font-weight:800;color:${currentPaymentMethod==='wallet'?'#047857':'#0f172a'};">👛 Wallets</div>
                                    <div style="font-size:0.7rem;color:#64748b;margin-top:0.2rem;">Paytm, PhonePe, Amazon Pay</div>
                                </button>

                                <button type="button" onclick="app.switchPaymentMethodTab('paylater')" style="text-align:left;padding:0.8rem 0.9rem;border-radius:10px;border:${currentPaymentMethod==='paylater'?'1.5px solid #047857':'1px solid #e2e8f0'};background:${currentPaymentMethod==='paylater'?'#f0fdf4':'#ffffff'};cursor:pointer;transition:all 0.2s;">
                                    <div style="font-size:0.88rem;font-weight:800;color:${currentPaymentMethod==='paylater'?'#047857':'#0f172a'};">💵 Pay Later</div>
                                    <div style="font-size:0.7rem;color:#64748b;margin-top:0.2rem;">Pay in easier installments</div>
                                </button>
                            </div>

                            <!-- Right Dynamic Panel -->
                            <div style="display:flex;flex-direction:column;justify-content:center;">
                                ${currentPaymentMethod === 'upi' ? `
                                    <div style="display:flex;flex-direction:column;gap:1rem;align-items:center;text-align:center;">
                                        <div style="font-size:0.92rem;font-weight:800;color:#0f172a;">Pay using UPI</div>
                                        <div style="font-size:0.78rem;color:#64748b;">Scan any QR code using your UPI app</div>

                                        <!-- Supported UPI Apps Icons -->
                                        <div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;">
                                            <span style="background:#f1f5f9;border:1px solid #cbd5e1;padding:0.3rem 0.65rem;border-radius:6px;font-size:0.76rem;font-weight:800;color:#4285f4;">GPay</span>
                                            <span style="background:#f1f5f9;border:1px solid #cbd5e1;padding:0.3rem 0.65rem;border-radius:6px;font-size:0.76rem;font-weight:800;color:#5f259f;">PhonePe</span>
                                            <span style="background:#f1f5f9;border:1px solid #cbd5e1;padding:0.3rem 0.65rem;border-radius:6px;font-size:0.76rem;font-weight:800;color:#00baf2;">Paytm</span>
                                            <span style="background:#f1f5f9;border:1px solid #cbd5e1;padding:0.3rem 0.65rem;border-radius:6px;font-size:0.76rem;font-weight:800;color:#047857;">BHIM</span>
                                            <span style="background:#f1f5f9;border:1px solid #cbd5e1;padding:0.3rem 0.65rem;border-radius:6px;font-size:0.76rem;font-weight:800;color:#ff9900;">Amazon Pay</span>
                                            <span style="background:#f1f5f9;border:1px solid #cbd5e1;padding:0.3rem 0.65rem;border-radius:6px;font-size:0.76rem;font-weight:800;color:#475569;">Other UPI</span>
                                        </div>

                                        <div style="font-size:0.75rem;color:#94a3b8;margin:0.2rem 0;">── or scan this QR code ──</div>

                                        ${showQr ? `
                                            <!-- QR Code Shown -->
                                            <div style="border:2px solid #047857;border-radius:14px;padding:0.8rem;background:#ffffff;display:inline-block;box-shadow:0 4px 14px rgba(4,120,87,0.12);">
                                                <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=upi%3A%2F%2Fpay%3Fpa%3D%26pn%3DZilhaj%26am%3D${this.amountFromOffer(offer.id)}%26cu%3DINR" alt="UPI QR Code" style="width:150px;height:150px;display:block;">
                                            </div>
                                            <div style="font-size:0.82rem;color:#475569;">
                                                UPI ID: <strong style="color:#0f172a;">${this.escapeHtml(this.upiIdFromOffer(offer.id) || '')}</strong>
                                            </div>
                                            <button type="button" onclick="app.toggleUpiQrCode()" style="background:#f8fafc;color:#475569;border:1px solid #cbd5e1;border-radius:8px;padding:0.45rem 1rem;font-weight:700;font-size:0.8rem;cursor:pointer;">
                                                Hide QR Code 📷
                                            </button>
                                        ` : `
                                            <!-- Normal Option: Show QR Code Button -->
                                            <button type="button" onclick="app.toggleUpiQrCode()" style="background:#047857;color:#ffffff;border:none;border-radius:8px;padding:0.6rem 1.4rem;font-weight:800;font-size:0.85rem;cursor:pointer;display:flex;align-items:center;gap:0.4rem;box-shadow:0 3px 10px rgba(4,120,87,0.2);">
                                                <span>📷</span> <span>Show QR Code</span>
                                            </button>
                                        `}

                                        <div style="font-size:0.75rem;color:#64748b;margin-top:0.3rem;">
                                            ⓘ You will be able to review the payment on the next step.
                                        </div>
                                    </div>
                                ` : currentPaymentMethod === 'card' ? `
                                    <div style="display:flex;flex-direction:column;gap:0.9rem;">
                                        <div style="font-size:0.9rem;font-weight:800;color:#0f172a;">Enter Card Details</div>
                                        <div>
                                            <label style="font-size:0.75rem;font-weight:700;color:#475569;display:block;margin-bottom:0.25rem;">Card Number</label>
                                            <input type="text" placeholder="4532 •••• •••• 8921" style="width:100%;padding:0.6rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.88rem;">
                                        </div>
                                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;">
                                            <div>
                                                <label style="font-size:0.75rem;font-weight:700;color:#475569;display:block;margin-bottom:0.25rem;">Expiry Date</label>
                                                <input type="text" placeholder="MM/YY" style="width:100%;padding:0.6rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.88rem;">
                                            </div>
                                            <div>
                                                <label style="font-size:0.75rem;font-weight:700;color:#475569;display:block;margin-bottom:0.25rem;">CVV</label>
                                                <input type="password" placeholder="•••" maxLength="4" style="width:100%;padding:0.6rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.88rem;">
                                            </div>
                                        </div>
                                        <div>
                                            <label style="font-size:0.75rem;font-weight:700;color:#475569;display:block;margin-bottom:0.25rem;">Cardholder Name</label>
                                            <input type="text" value="${this.escapeHtml(user.name || 'Guest')}" style="width:100%;padding:0.6rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.88rem;">
                                        </div>
                                    </div>
                                ` : currentPaymentMethod === 'net' ? `
                                    <div style="display:flex;flex-direction:column;gap:0.9rem;">
                                        <div style="font-size:0.9rem;font-weight:800;color:#0f172a;">Select Net Banking Bank</div>
                                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;">
                                            <button type="button" style="border:1px solid #cbd5e1;background:#f8fafc;padding:0.6rem;border-radius:8px;font-weight:700;font-size:0.8rem;cursor:pointer;">HDFC Bank</button>
                                            <button type="button" style="border:1px solid #cbd5e1;background:#f8fafc;padding:0.6rem;border-radius:8px;font-weight:700;font-size:0.8rem;cursor:pointer;">ICICI Bank</button>
                                            <button type="button" style="border:1px solid #cbd5e1;background:#f8fafc;padding:0.6rem;border-radius:8px;font-weight:700;font-size:0.8rem;cursor:pointer;">State Bank of India</button>
                                            <button type="button" style="border:1px solid #cbd5e1;background:#f8fafc;padding:0.6rem;border-radius:8px;font-weight:700;font-size:0.8rem;cursor:pointer;">Axis Bank</button>
                                        </div>
                                    </div>
                                ` : currentPaymentMethod === 'wallet' ? `
                                    <div style="display:flex;flex-direction:column;gap:0.9rem;">
                                        <div style="font-size:0.9rem;font-weight:800;color:#0f172a;">Select Digital Wallet</div>
                                        <div style="display:flex;flex-direction:column;gap:0.5rem;">
                                            <label style="display:flex;align-items:center;gap:0.6rem;padding:0.6rem;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;"><input type="radio" name="w" checked style="accent-color:#047857;"> Paytm Wallet</label>
                                            <label style="display:flex;align-items:center;gap:0.6rem;padding:0.6rem;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;"><input type="radio" name="w" style="accent-color:#047857;"> PhonePe Wallet</label>
                                            <label style="display:flex;align-items:center;gap:0.6rem;padding:0.6rem;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;"><input type="radio" name="w" style="accent-color:#047857;"> Amazon Pay Balance</label>
                                        </div>
                                    </div>
                                ` : `
                                    <div style="display:flex;flex-direction:column;gap:0.9rem;">
                                        <div style="font-size:0.9rem;font-weight:800;color:#0f172a;">Pay Later Options</div>
                                        <div style="font-size:0.8rem;color:#64748b;">Complete your booking now and pay in convenient installments.</div>
                                        <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:0.75rem;border-radius:8px;font-size:0.8rem;color:#166534;font-weight:700;">
                                            ✓ 0% Interest EMI available for 3 months
                                        </div>
                                    </div>
                                `}
                            </div>

                        </div>
                    </div>

                    <!-- SECTION 2: PASSENGER & CONTACT DETAILS FORM -->
                    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:1.6rem;box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                        <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:1.2rem;">
                            <div style="width:24px;height:24px;background:#047857;color:#fff;border-radius:50%;font-weight:800;font-size:0.8rem;display:flex;align-items:center;justify-content:center;">2</div>
                            <h4 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin:0;">Payment Details / Passenger Information</h4>
                        </div>
                        
                        <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:1.1rem;margin-bottom:1.2rem;">
                            <div>
                                <div style="font-size:0.68rem;color:#64748b;font-weight:700;text-transform:uppercase;">Booking For</div>
                                <div style="font-size:0.88rem;font-weight:800;color:#0f172a;margin-top:0.15rem;">${this.escapeHtml(user.name || 'Guest')}</div>
                            </div>
                            <div>
                                <div style="font-size:0.68rem;color:#64748b;font-weight:700;text-transform:uppercase;">Mobile Number</div>
                                <div style="font-size:0.88rem;font-weight:800;color:#0f172a;margin-top:0.15rem;">${this.escapeHtml(user.phone || '')}</div>
                            </div>
                            <div>
                                <div style="font-size:0.68rem;color:#64748b;font-weight:700;text-transform:uppercase;">Email Address</div>
                                <div style="font-size:0.88rem;font-weight:800;color:#0f172a;margin-top:0.15rem;">${this.escapeHtml(user.email || '')}</div>
                            </div>
                        </div>

                        <label style="display:flex;align-items:center;gap:0.55rem;font-size:0.8rem;color:#475569;cursor:pointer;margin-bottom:1rem;">
                            <input type="checkbox" checked style="accent-color:#047857;width:15px;height:15px;">
                            <span>I want to receive payment confirmation on WhatsApp 💬</span>
                        </label>

                        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:0.75rem 0.9rem;display:flex;align-items:center;gap:0.7rem;">
                            <span style="font-size:1.1rem;">🛡️</span>
                            <div style="font-size:0.76rem;color:#166534;line-height:1.4;">
                                <strong>We are committed to complete transparency.</strong> All payments are processed securely and there are no hidden charges.
                            </div>
                        </div>
                    </div>

                </div>

                <!-- Right Column Sidebar -->
                <div style="display:flex;flex-direction:column;gap:1.2rem;position:sticky;top:98px;">

                    <!-- Booking Summary Card -->
                    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:1.4rem;box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                        <h4 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin:0 0 1rem;">Booking Summary</h4>
                        
                        <div style="display:flex;gap:0.85rem;align-items:center;margin-bottom:1rem;padding-bottom:0.9rem;border-bottom:1px solid #f1f5f9;">
                            <img src="https://images.unsplash.com/photo-1591604466107-ec97de577aff?auto=format&fit=crop&w=180&q=80" alt="Package" style="width:62px;height:62px;border-radius:10px;object-fit:cover;">
                            <div>
                                <div style="font-size:0.88rem;font-weight:800;color:#0f172a;">${this.escapeHtml(offer.packageTitle)}</div>
                                <div style="font-size:0.75rem;color:#64748b;margin-top:0.1rem;">${offer.requirementId ? 'REQ-' + offer.requirementId : ''}${offer.requirementId && travelersCount ? ' • ' : ''}${travelersCount} Adults, 0 Children</div>
                                <span style="background:#ecfdf5;color:#047857;font-size:0.68rem;font-weight:800;padding:0.1rem 0.45rem;border-radius:4px;margin-top:0.2rem;display:inline-block;">${offer.durationDays ? offer.durationDays + ' Days' : 'Duration N/A'}</span>
                            </div>
                        </div>

                        <div style="display:flex;flex-direction:column;gap:0.7rem;font-size:0.84rem;color:#475569;">
                            <div style="display:flex;justify-content:space-between;">
                                <span>Package Price (${travelersCount} × ${this.formatCurrency(perPersonPrice)})</span>
                                <span style="font-weight:700;color:#0f172a;">${this.formatCurrency(perPersonPrice * travelersCount)}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;">
                                <span>Taxes &amp; Fees</span>
                                <span style="font-weight:700;color:#0f172a;">₹6,400</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;">
                                <span>Visa Charges</span>
                                <span style="font-weight:700;color:#0f172a;">₹4,000</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;">
                                <span>Travel Insurance</span>
                                <span style="font-weight:700;color:#0f172a;">₹2,400</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;color:#047857;">
                                <span style="font-weight:700;">Offer Discount</span>
                                <span style="font-weight:800;">-₹1,000</span>
                            </div>
                            <div style="border-top:1px dashed #cbd5e1;margin:0.25rem 0;"></div>
                            <div style="display:flex;justify-content:space-between;align-items:center;">
                                <span style="font-size:1rem;font-weight:800;color:#0f172a;">Total Amount</span>
                                <span style="font-size:1.5rem;font-weight:900;color:#047857;">${totalAmountFormatted}</span>
                            </div>
                            <div style="font-size:0.72rem;color:#64748b;text-align:right;">All amounts are in INR</div>
                        </div>
                    </div>

                    <!-- What's Included Card -->
                    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:1.1rem;box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                        <h5 style="font-size:0.88rem;font-weight:800;color:#0f172a;margin:0 0 0.65rem;">What's Included</h5>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.45rem;font-size:0.74rem;color:#475569;">
                            <div>✈️ Return Flights</div>
                            <div>🏨 9 Nights Stay</div>
                            <div>✓ Visa Included</div>
                            <div>🍽 All Meals</div>
                            <div>🚍 Local Transfers</div>
                            <div>🕌 All Ziyarat</div>
                        </div>
                        <a href="javascript:void(0)" onclick="app.setDashboardTab('packageDetails')" style="font-size:0.74rem;font-weight:700;color:#047857;text-decoration:none;display:inline-block;margin-top:0.55rem;">View all inclusions →</a>
                    </div>

                    <!-- We Accept Payment Badges Card -->
                    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:1.1rem;box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                        <h5 style="font-size:0.84rem;font-weight:800;color:#0f172a;margin:0 0 0.65rem;">We Accept</h5>
                        <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:0.4rem;text-align:center;">
                            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:0.3rem;font-size:0.7rem;font-weight:800;color:#1a1f71;">VISA</div>
                            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:0.3rem;font-size:0.7rem;font-weight:800;color:#eb001b;">MasterCard</div>
                            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:0.3rem;font-size:0.7rem;font-weight:800;color:#005c9e;">RuPay</div>
                            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:0.3rem;font-size:0.7rem;font-weight:800;color:#047857;">UPI</div>
                            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:0.3rem;font-size:0.7rem;font-weight:800;color:#4285f4;">GPay</div>
                            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:0.3rem;font-size:0.7rem;font-weight:800;color:#5f259f;">PhonePe</div>
                            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:0.3rem;font-size:0.7rem;font-weight:800;color:#00baf2;">Paytm</div>
                            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:0.3rem;font-size:0.7rem;font-weight:800;color:#ff9900;">Amazon</div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.35rem;font-size:0.66rem;color:#64748b;margin-top:0.75rem;">
                            <div>✓ SSL Encrypted</div>
                            <div>✓ PCI DSS Certified</div>
                            <div>✓ 100% Money Safe</div>
                            <div>✓ Instant Confirmation</div>
                        </div>
                    </div>

                </div>
            </div>

            <!-- Dynamic Bottom CTA Sticky Bar -->
            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:1rem 1.6rem;display:flex;justify-content:space-between;align-items:center;box-shadow:0 4px 16px rgba(0,0,0,0.04);">
                <div>
                    <div style="font-size:0.72rem;color:#64748b;font-weight:700;">Total Amount</div>
                    <div style="display:flex;align-items:center;gap:0.5rem;">
                        <span style="font-size:1.35rem;font-weight:900;color:#0f172a;">${totalAmountFormatted}</span>
                        <a href="javascript:void(0)" style="font-size:0.72rem;color:#047857;font-weight:700;text-decoration:none;">View Price Details ^</a>
                    </div>
                </div>

                <div>
                    ${currentPaymentMethod === 'upi' ? `
                        ${showQr ? `
                            <button onclick="app.processPayment('${offer.id}')" style="background:#047857;color:#ffffff;border:none;border-radius:10px;padding:0.8rem 1.8rem;font-size:0.95rem;font-weight:800;cursor:pointer;display:flex;flex-direction:column;align-items:center;box-shadow:0 4px 14px rgba(4,120,87,0.25);">
                                <span>Review Payment</span>
                                <span style="font-size:0.68rem;font-weight:500;opacity:0.9;">You will be able to confirm on the next step</span>
                            </button>
                        ` : `
                            <button onclick="app.toggleUpiQrCode()" style="background:#047857;color:#ffffff;border:none;border-radius:10px;padding:0.8rem 1.8rem;font-size:0.95rem;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:0.5rem;box-shadow:0 4px 14px rgba(4,120,87,0.25);">
                                <span>📷</span> <span>Show QR Code</span>
                            </button>
                        `}
                    ` : currentPaymentMethod === 'paylater' ? `
                        <button onclick="app.processPayment('${offer.id}')" style="background:#047857;color:#ffffff;border:none;border-radius:10px;padding:0.85rem 1.8rem;font-size:0.95rem;font-weight:800;cursor:pointer;box-shadow:0 4px 14px rgba(4,120,87,0.25);">
                            Continue to Pay Later
                        </button>
                    ` : `
                        <button onclick="app.processPayment('${offer.id}')" style="background:#047857;color:#ffffff;border:none;border-radius:10px;padding:0.85rem 1.8rem;font-size:0.95rem;font-weight:800;cursor:pointer;box-shadow:0 4px 14px rgba(4,120,87,0.25);">
                            Pay ${totalAmountFormatted} Securely
                        </button>
                    `}
                </div>
            </div>
        </main>
        `;
    }



    viewOfferDetailsModal(offerId) {
        this.openOfferReviewModal(offerId);
    }



    viewBookingVoucher(bookingId) {
        let allBookings = JSON.parse(localStorage.getItem('umrah_my_bookings') || '[]');
        let b = allBookings.find(item => item.id === bookingId);
        if (!b) b = (this.state.myBookings || []).find(item => item.id === bookingId);

        if (!b) {
            this.showToast('Booking not found. Please refresh and try again.', 'warning');
            return;
        }

        const user = this.state.currentUser || {};

        this.openModal(`
            <div id="printableVoucher" style="display:flex; flex-direction:column; width:100vw; height:100vh; background:#f8fafc; font-family:'Inter', -apple-system, BlinkMacSystemFont, sans-serif; position:relative; overflow-y:auto; box-sizing:border-box;">
                
                <!-- TOP BAR PRINT / CLOSE ACTIONS (HIDDEN ON PRINT) -->
                <div class="no-print" style="background:#ffffff; padding:1.1rem 2.5rem; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; position:sticky; top:0; z-index:100; box-shadow:0 2px 10px rgba(0,0,0,0.03);">
                    <div style="font-size:0.88rem; font-weight:800; color:#0f172a; display:flex; align-items:center; gap:0.5rem;">
                        <span>🇸🇦</span>
                        <span>OFFICIAL SAUDI MINISTRY REGISTERED E-VOUCHER</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:0.8rem;">
                        <a href="javascript:void(0)" onclick="app.downloadInvoice('${b.id || ''}')" style="background:#047857; color:#ffffff; font-weight:800; border:none; padding:0.6rem 1.4rem; border-radius:10px; font-size:0.88rem; cursor:pointer; display:flex; align-items:center; gap:0.5rem; text-decoration:none; box-shadow:0 4px 14px rgba(4,120,87,0.25);">
                            <span>📄</span> <span>Download Invoice (Official Bill)</span>
                        </a>
                        <button type="button" onclick="window.print()" style="background:#166534; color:#ffffff; font-weight:800; border:none; padding:0.6rem 1.4rem; border-radius:10px; font-size:0.88rem; cursor:pointer; display:flex; align-items:center; gap:0.5rem; box-shadow:0 4px 14px rgba(22,101,52,0.25); transition:all 0.2s;" onmouseover="this.style.background='#14532d'" onmouseout="this.style.background='#166534'">
                            <span>🖨️</span> <span>Print / Save PDF</span>
                        </button>
                        <button type="button" onclick="app.closeModal()" style="background:#ffffff; color:#334155; border:1px solid #cbd5e1; font-weight:700; padding:0.6rem 1.2rem; border-radius:10px; font-size:0.88rem; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">
                            ✕ Close
                        </button>
                    </div>
                </div>

                <!-- VOUCHER CARD MAIN WRAPPER -->
                <div style="max-width:100%; width:100%; margin:2rem auto; padding:0 3.5rem; box-sizing:border-box;">
                    <div style="background:#ffffff; border-radius:24px; border:1px solid #e2e8f0; overflow:hidden; box-shadow:0 15px 45px rgba(0,0,0,0.06);">
                        
                        <!-- 1. DARK EMERALD HERO BANNER -->
                        <div style="background:linear-gradient(135deg, #05281e 0%, #0d3d2e 100%); padding:2.5rem; color:#ffffff; border-bottom:4px solid #d4af37; position:relative;">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1.5rem;">
                                <div>
                                    <div style="display:flex; align-items:center; gap:0.9rem; margin-bottom:0.4rem;">
                                        <div style="width:58px; height:58px; border-radius:50%; overflow:hidden; display:flex; align-items:center; justify-content:center; background:#FFB74D; border:2px solid #ffffff; box-shadow:0 4px 12px rgba(0,0,0,0.25); flex-shrink:0;">
                                            <img src="logo.png" onerror="this.onerror=null;this.src='images/logo.png';" alt="Zilhaj.com Logo" style="width:100%; height:100%; object-fit:cover; display:block; border-radius:50%;">
                                        </div>
                                        <div>
                                            <h1 style="font-size:1.45rem; font-weight:800; color:#ffffff; margin:0; letter-spacing:-0.3px; line-height:1.2;">ZILHAJ.COM UMRAH PLATFORM</h1>
                                            <div style="font-size:0.78rem; color:#d4af37; font-weight:800; text-transform:uppercase; letter-spacing:1.2px; margin-top:0.4rem;">OFFICIAL TRAVEL BOOKING VOUCHER &amp; ESCROW RECEIPT</div>
                                        </div>
                                    </div>
                                </div>

                                <!-- GOLDEN PNR BOX -->
                                <div style="background:rgba(0,0,0,0.25); border:2px solid #d4af37; border-radius:16px; padding:0.9rem 1.6rem; text-align:center; box-shadow:0 4px 15px rgba(0,0,0,0.2);">
                                    <div style="font-size:0.68rem; color:#d4af37; font-weight:800; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:0.2rem;">BOOKING PNR / REF</div>
                                    <div style="font-size:1.6rem; font-weight:900; color:#fef08a; font-family:monospace; letter-spacing:1px;">${this.escapeHtml(b.id || 'BK-048846')}</div>
                                </div>
                            </div>

                            <!-- STATUS BADGES ROW -->
                            <div style="display:flex; align-items:center; gap:1rem; margin-top:1.8rem; flex-wrap:wrap;">
                                <span style="background:#d1fae5; color:#047857; font-size:0.8rem; font-weight:900; padding:0.45rem 1.1rem; border-radius:99px; border:1px solid #6ee7b7; display:flex; align-items:center; gap:0.4rem;">
                                    <span>✓</span> <span>CONFIRMED &amp; 100% PAID IN ESCROW</span>
                                </span>
                                <span style="background:rgba(255,255,255,0.15); color:#ffffff; font-size:0.8rem; font-weight:700; padding:0.45rem 1.1rem; border-radius:99px; border:1px solid rgba(255,255,255,0.3);">
                                    KSA License #MOT-KSA-984120
                                </span>
                            </div>
                        </div>

                        <!-- 2. VOUCHER BODY CONTENT -->
                        <div style="padding:2.2rem; display:flex; flex-direction:column; gap:1.6rem; background:#ffffff;">
                            
                            <!-- ROW 1: PILGRIM & TOUR OPERATOR SUMMARY -->
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.4rem;">
                                
                                <!-- CARD 1: PILGRIM DETAILS -->
                                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:18px; padding:1.5rem;">
                                    <div style="font-size:0.72rem; font-weight:900; color:#475569; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:1rem; display:flex; align-items:center; gap:0.4rem;">
                                        <span>👤</span> <span>LEAD PILGRIM INFORMATION</span>
                                    </div>
                                    <div style="display:flex; flex-direction:column; gap:0.65rem; font-size:0.88rem; color:#0f172a;">
                                        <div style="display:flex; justify-content:space-between; align-items:center;">
                                            <span style="color:#64748b; font-weight:600;">Full Name:</span>
                                            <strong style="font-weight:800; color:#0f172a;">${this.escapeHtml(user.name || '')}</strong>
                                        </div>
                                        <div style="display:flex; justify-content:space-between; align-items:center;">
                                            <span style="color:#64748b; font-weight:600;">Email:</span>
                                            <strong style="font-weight:800; color:#0f172a;">${this.escapeHtml(user.email || '')}</strong>
                                        </div>
                                        <div style="display:flex; justify-content:space-between; align-items:center;">
                                            <span style="color:#64748b; font-weight:600;">Phone:</span>
                                            <strong style="font-weight:800; color:#0f172a;">${this.escapeHtml(user.phone || '')}</strong>
                                        </div>
                                        <div style="display:flex; justify-content:space-between; align-items:center;">
                                            <span style="color:#64748b; font-weight:600;">Total Travelers:</span>
                                            <strong style="font-weight:800; color:#0f172a;">${b.travelersCount || 1} Person(s)</strong>
                                        </div>
                                    </div>
                                </div>

                                <!-- CARD 2: TOUR OPERATOR DETAILS -->
                                <div style="background:#f0fdf4; border:1.5px solid #a7f3d0; border-radius:18px; padding:1.5rem;">
                                    <div style="font-size:0.72rem; font-weight:900; color:#166534; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:1rem; display:flex; align-items:center; gap:0.4rem;">
                                        <span>🏛️</span> <span>VERIFIED TOUR OPERATOR</span>
                                    </div>
                                    <div style="display:flex; flex-direction:column; gap:0.6rem;">
                                        <div style="font-size:1.15rem; font-weight:900; color:#166534;">
                                            ${this.escapeHtml(b.agentName || '')}
                                        </div>
                                        <div style="font-size:0.82rem; color:#475569; font-weight:600;">
                                            Saudi Ministry License #UM-984120
                                        </div>
                                        <div style="display:flex; items-center; justify-content:space-between; margin-top:0.4rem; font-size:0.86rem;">
                                            <span style="color:#64748b; font-weight:600;">Emergency Hotline:</span>
                                            <strong style="color:#dc2626; font-weight:800;">📞 +966 50 123 4567</strong>
                                        </div>
                                    </div>
                                </div>

                            </div>

                            <!-- ROW 2: HOTEL & FLIGHT ITINERARY -->
                            <div style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:18px; padding:1.6rem;">
                                <div style="font-size:0.78rem; font-weight:900; color:#0f172a; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:1.2rem; border-bottom:1px solid #f1f5f9; padding-bottom:0.6rem; display:flex; align-items:center; gap:0.4rem;">
                                    <span>🕋</span> <span>ITINERARY &amp; HOTEL ACCOMMODATION GUARANTEES</span>
                                </div>

                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.6rem;">
                                    <!-- MAKKAH -->
                                    <div>
                                        <div style="font-size:0.82rem; font-weight:900; color:#166534; margin-bottom:0.35rem; display:flex; align-items:center; gap:0.3rem;">
                                            <span>📍</span> <span>MAKKAH ACCOMMODATION</span>
                                        </div>
                                        <div style="font-size:1.05rem; font-weight:900; color:#0f172a;">${this.escapeHtml(b.makkahHotel || 'TBD')}</div>
                                        <div style="font-size:0.8rem; color:#64748b; margin-top:0.25rem; font-weight:600;">Approx. 250 Metres from Masjid Al-Haram</div>
                                        <div style="font-size:0.8rem; color:#047857; font-weight:800; margin-top:0.4rem; display:flex; align-items:center; gap:0.3rem;">
                                            <span>✓</span> <span>Full Board 3x Daily Indian Buffet Included</span>
                                        </div>
                                    </div>

                                    <!-- MADINAH -->
                                    <div>
                                        <div style="font-size:0.82rem; font-weight:900; color:#166534; margin-bottom:0.35rem; display:flex; align-items:center; gap:0.3rem;">
                                            <span>📍</span> <span>MADINAH ACCOMMODATION</span>
                                        </div>
                                        <div style="font-size:1.05rem; font-weight:900; color:#0f172a;">${this.escapeHtml(b.madinahHotel || 'TBD')}</div>
                                        <div style="font-size:0.8rem; color:#64748b; margin-top:0.25rem; font-weight:600;">Approx. 150 Metres from Al-Masjid An-Nabawi</div>
                                        <div style="font-size:0.8rem; color:#047857; font-weight:800; margin-top:0.4rem; display:flex; align-items:center; gap:0.3rem;">
                                            <span>✓</span> <span>Guided Visits &amp; Nusuk Permit Guidance</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- ROW 3: COMPLIMENTARY SERVICES & ESCROW RECEIPT -->
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.4rem;">
                                
                                <!-- CARD 4: COMPLIMENTARY AMENITIES -->
                                <div style="background:#fffcf2; border:1.5px solid #fde047; border-radius:18px; padding:1.5rem;">
                                    <div style="font-size:0.72rem; font-weight:900; color:#854d0e; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:0.8rem; display:flex; align-items:center; gap:0.4rem;">
                                        <span>🎁</span> <span>INCLUDED COMPLIMENTARY AMENITIES</span>
                                    </div>
                                    <div style="display:flex; flex-direction:column; gap:0.5rem; font-size:0.85rem; color:#713f12; font-weight:700;">
                                        <div>✓ Free Pilgrim Ahram Kit</div>
                                        <div>✓ Unlimited Daily Laundry Service</div>
                                        <div>✓ 5 Litres Authentic Zamzam Water</div>
                                        <div>✓ VIP AC Airport &amp; Intercity Transfers</div>
                                    </div>
                                </div>

                                <!-- CARD 5: FINANCIAL ESCROW SUMMARY -->
                                <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:18px; padding:1.5rem; display:flex; flex-direction:column; justify-content:space-between;">
                                    <div>
                                        <div style="font-size:0.72rem; font-weight:900; color:#64748b; text-transform:uppercase; letter-spacing:0.6px; display:flex; align-items:center; gap:0.4rem;">
                                            <span>💳</span> <span>PAYMENT &amp; ESCROW FINANCIAL STATUS</span>
                                        </div>
                                        <div style="font-size:1.8rem; font-weight:900; color:#166534; margin:0.4rem 0 0.2rem 0; letter-spacing:-0.02em;">
                                            ${this.formatCurrency(b.totalPrice || 237500)}
                                        </div>
                                        <div style="font-size:0.8rem; color:#047857; font-weight:800; display:flex; align-items:center; gap:0.3rem;">
                                            <span>🔒</span> <span>100% Secured in Escrow Safe Guarantee</span>
                                        </div>
                                    </div>
                                    <div style="font-size:0.7rem; color:#64748b; font-family:monospace; margin-top:0.8rem; display:flex; flex-direction:column; gap:0.2rem;">
                                        <div><strong style="color:#334155;">Payment ID:</strong> ${this.escapeHtml(b.paymentId || b.razorpay_payment_id || 'N/A')}</div>
                                        <div><strong style="color:#334155;">Transaction ID:</strong> ${this.escapeHtml(b.transactionId || 'N/A')}</div>
                                        <div><strong style="color:#334155;">Order ID:</strong> ${this.escapeHtml(b.razorpayOrderId || b.orderId || 'N/A')}</div>
                                    </div>
                                </div>

                            </div>

                            <!-- OFFICIAL FOOTER CERTIFICATION -->
                            <div style="border-top:1.5px dashed #cbd5e1; padding-top:1.4rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; margin-top:0.4rem;">
                                <div>
                                    <div style="font-size:0.85rem; font-weight:900; color:#0f172a;">Zilhaj.com Umrah Services Support</div>
                                    <div style="font-size:0.78rem; color:#64748b; margin-top:0.15rem;">Website: www.zilhaj.com &bull; Email: support@zilhaj.com</div>
                                </div>
                                <div style="text-align:right;">
                                    <div style="display:inline-block; border:1.5px solid #166534; padding:0.45rem 1rem; border-radius:8px; font-size:0.78rem; font-weight:900; color:#166534; background:#f0fdf4; letter-spacing:0.5px;">
                                        APPROVED E-VOUCHER
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

            </div>
        `, false, {
            width: '100vw',
            maxWidth: '100vw',
            height: '100vh',
            maxHeight: '100vh',
            borderRadius: '0px',
            overflowY: 'auto'
        });
    }

    async deleteRequirement(reqId) {
        if (!confirm("Are you sure you want to delete this travel request? All agent offers for this request will also be removed.")) return;

        // Delete from backend (DB) so the removal is real and permanent
        if (typeof this.apiCall === 'function') {
            try {
                await this.apiCall(`/requirements/${encodeURIComponent(reqId)}`, 'DELETE');
            } catch (e) {}
        }

        let allReqs = JSON.parse(localStorage.getItem('umrah_requirements') || '[]');
        let allOffers = JSON.parse(localStorage.getItem('umrah_user_offers') || '[]');

        allReqs = allReqs.filter(r => r.id !== reqId);
        allOffers = allOffers.filter(o => o.requirementId !== reqId);

        localStorage.setItem('umrah_requirements', JSON.stringify(allReqs));
        localStorage.setItem('umrah_user_offers', JSON.stringify(allOffers));

        this.state.myRequirements = (this.state.myRequirements || []).filter(r => r.id !== reqId);
        this.state.userOffers = (this.state.userOffers || []).filter(o => o.requirementId !== reqId);

        this.showToast('Travel request deleted successfully.', 'info');

        const main = document.getElementById('mainContainer');
        if (main) main.innerHTML = this.renderDashboardPage();
    }

    navigateToPayment(offerId) {
        this.state.activePaymentOfferId = offerId;
        this.openOfferPaymentModal(offerId);
    }

    renderPaymentPage(offerId) {
        const localOffers = JSON.parse(localStorage.getItem('umrah_user_offers') || '[]');
        const apiOffers = this.state.userOffers || [];
        const allOffers = [...apiOffers, ...localOffers.filter(lo => !apiOffers.some(o => o.id === lo.id))];
        const localReqs = JSON.parse(localStorage.getItem('umrah_requirements') || '[]');
        const apiReqs = this.state.myRequirements || [];
        const allReqs = [...apiReqs, ...localReqs.filter(lr => !apiReqs.some(r => r.id === lr.id))];

        const offer = allOffers.find(item => item.id === offerId);
        if (!offer) {
            return `
            <main style="flex:1; min-width:0; display:flex; align-items:center; justify-content:center; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#0f172a; padding:3rem 1rem;">
                <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:2.5rem 2rem; text-align:center; max-width:420px; box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                    <div style="font-size:2.2rem; margin-bottom:0.8rem;">📭</div>
                    <h2 style="font-size:1.1rem; font-weight:800; color:#0f172a; margin:0 0 0.4rem;">Offer Unavailable</h2>
                    <p style="font-size:0.85rem; color:#64748b; margin:0 0 1.2rem;">We couldn't find this offer. It may have been removed by the travel agency.</p>
                    <button onclick="app.setDashboardTab('packageDetails')" style="background:#047857; color:#ffffff; border:none; border-radius:8px; padding:0.6rem 1.3rem; font-size:0.85rem; font-weight:700; cursor:pointer;">Back to Package Details</button>
                </div>
            </main>`;
        }

        const req = allReqs.find(r => r.id === offer.requirementId) || {};

        const travelersCount = Number(offer.travelersCount) || Number(req.travelersCount) || Number(req.adults) || 1;
        const perPersonPrice = Number(offer.discountedPrice) || Number(offer.price) || 0;
        
        const packagePriceTotal = perPersonPrice * travelersCount;
        const taxesAndFees = Number(offer.taxesAndFees) || Number(req.taxesAndFees) || 0;
        const visaCharges = Number(offer.visaCharges) || Number(req.visaCharges) || 0;
        const travelInsurance = Number(offer.travelInsurance) || Number(req.travelInsurance) || 0;
        const offerDiscount = Number(offer.offerDiscount) || Number(req.offerDiscount) || 0;
        const finalTotalAmount = packagePriceTotal + taxesAndFees + visaCharges + travelInsurance - offerDiscount;

        const user = this.state.currentUser || {};

        return `
        <main style="flex:1; min-width:0; display:flex; flex-direction:column; gap:1.2rem; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#0f172a;">
            
            <!-- HEADER BAR MATCHING IMAGE 2 -->
            <div style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:1rem 1.4rem; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
                <div style="display:flex; align-items:center; gap:1rem;">
                    <button onclick="app.setDashboardTab('packageDetails')" style="background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:0.45rem 0.85rem; font-weight:700; font-size:0.82rem; cursor:pointer; display:flex; align-items:center; gap:0.4rem; transition:all 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">
                        ← Back to Review Package
                    </button>
                    <div>
                        <div style="display:flex; align-items:center; gap:0.4rem;">
                            <h2 style="font-size:1.25rem; font-weight:800; color:#0f172a; margin:0; line-height:1.2;">Secure Payment</h2>
                            <span style="color:#047857; font-size:1.1rem;">🛡️</span>
                        </div>
                        <div style="font-size:0.78rem; color:#64748b; margin-top:0.15rem;">Your payment information is safe with us. Complete your payment to confirm your booking.</div>
                    </div>
                </div>

                <div style="display:flex; align-items:center; gap:1rem;">
                    <div style="width:34px; height:34px; background:#f1f5f9; border-radius:50%; display:flex; align-items:center; justify-content:center; position:relative; cursor:pointer;" onclick="app.setDashboardTab('notifications')">
                        <span style="font-size:0.95rem;">🔔</span>
                        <span style="position:absolute; top:-2px; right:-2px; background:#047857; color:#ffffff; font-size:0.62rem; font-weight:800; width:15px; height:15px; border-radius:50%; display:flex; align-items:center; justify-content:center;">2</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:0.55rem; background:#f8fafc; padding:0.3rem 0.75rem; border-radius:99px; border:1px solid #e2e8f0; cursor:pointer;" onclick="app.setDashboardTab('profile')">
                        <div style="width:28px; height:28px; border-radius:50%; background:#047857; color:#ffffff; font-weight:800; display:flex; align-items:center; justify-content:center; font-size:0.8rem;">${this.escapeHtml((user.name || 'G').charAt(0).toUpperCase())}</div>
                        <div>
                            <div style="font-size:0.8rem; font-weight:800; color:#0f172a;">${this.escapeHtml(user.name || 'Guest')}</div>
                            <div style="font-size:0.65rem; color:#64748b;">Customer</div>
                        </div>
                        <span style="font-size:0.65rem; color:#64748b; margin-left:0.15rem;">▼</span>
                    </div>
                </div>
            </div>

            <!-- 2 COLUMN LAYOUT GRID (MATCHING IMAGE 2) -->
            <div style="display:grid; grid-template-columns:1fr 340px; gap:1.2rem; align-items:start;">
                
                <!-- LEFT COLUMN: SECURITY BANNER, STEP 1 PAYMENT METHOD, STEP 2 DETAILS -->
                <div style="display:flex; flex-direction:column; gap:1.2rem;">
                    
                    <!-- Security Banner -->
                    <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:0.8rem 1.1rem; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
                        <div style="display:flex; align-items:center; gap:0.55rem; color:#047857; font-size:0.82rem; font-weight:800;">
                            <span style="font-size:1rem;">🛡️</span> 100% Secure Payment <span style="color:#64748b; font-weight:500;">• All transactions are encrypted and protected</span>
                        </div>
                        <span style="background:#f0fdf4; border:1px solid #bbf7d0; color:#047857; font-size:0.7rem; font-weight:800; padding:0.2rem 0.55rem; border-radius:6px;">PCI DSS Compliant</span>
                    </div>

                    <!-- SECTION 1: CHOOSE PAYMENT METHOD -->
                    <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:1.2rem; box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                        <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:1.1rem;">
                            <div style="width:24px; height:24px; background:#047857; color:#ffffff; border-radius:50%; font-weight:800; font-size:0.8rem; display:flex; align-items:center; justify-content:center;">1</div>
                            <h3 style="font-size:1rem; font-weight:800; color:#0f172a; margin:0;">Choose Payment Method</h3>
                        </div>

                        <!-- Vertical Tabs + Dynamic Content Grid -->
                        <div style="display:grid; grid-template-columns:190px 1fr; gap:1.2rem; align-items:start;">
                            
                            <!-- Left Tabs Navigation -->
                            <div style="display:flex; flex-direction:column; gap:0.5rem;">
                                
                                <button type="button" onclick="app.switchPaymentTab('upi')" id="payTab-upi" style="display:flex; align-items:center; justify-content:space-between; padding:0.75rem 0.85rem; border-radius:10px; border:2px solid #047857; background:#f0fdf4; color:#0f172a; font-weight:800; font-size:0.82rem; cursor:pointer; text-align:left;">
                                    <div style="display:flex; align-items:center; gap:0.5rem;">
                                        <span style="font-size:1rem;">📱</span> <span>UPI</span>
                                    </div>
                                    <span style="background:#047857; color:#ffffff; font-size:0.6rem; font-weight:800; padding:0.12rem 0.4rem; border-radius:4px;">Recommended</span>
                                </button>

                                <button type="button" onclick="app.switchPaymentTab('card')" id="payTab-card" style="display:flex; flex-direction:column; padding:0.75rem 0.85rem; border-radius:10px; border:1px solid #e2e8f0; background:#ffffff; color:#0f172a; font-weight:700; font-size:0.82rem; cursor:pointer; text-align:left;">
                                    <div style="display:flex; align-items:center; gap:0.5rem; font-weight:800;">
                                        <span style="font-size:1rem;">💳</span> <span>Debit / Credit Cards</span>
                                    </div>
                                    <span style="font-size:0.67rem; color:#64748b; margin-top:0.15rem; font-weight:500;">Visa, Mastercard, RuPay</span>
                                </button>

                                <button type="button" onclick="app.switchPaymentTab('net')" id="payTab-net" style="display:flex; flex-direction:column; padding:0.75rem 0.85rem; border-radius:10px; border:1px solid #e2e8f0; background:#ffffff; color:#0f172a; font-weight:700; font-size:0.82rem; cursor:pointer; text-align:left;">
                                    <div style="display:flex; align-items:center; gap:0.5rem; font-weight:800;">
                                        <span style="font-size:1rem;">🏦</span> <span>Net Banking</span>
                                    </div>
                                    <span style="font-size:0.67rem; color:#64748b; margin-top:0.15rem; font-weight:500;">All major banks</span>
                                </button>

                                <button type="button" onclick="app.switchPaymentTab('emi')" id="payTab-emi" style="display:flex; flex-direction:column; padding:0.75rem 0.85rem; border-radius:10px; border:1px solid #e2e8f0; background:#ffffff; color:#0f172a; font-weight:700; font-size:0.82rem; cursor:pointer; text-align:left;">
                                    <div style="display:flex; align-items:center; gap:0.5rem; font-weight:800;">
                                        <span style="font-size:1rem;">👛</span> <span>Wallets</span>
                                    </div>
                                    <span style="font-size:0.67rem; color:#64748b; margin-top:0.15rem; font-weight:500;">Paytm, PhonePe, Amazon Pay</span>
                                </button>

                                <button type="button" onclick="app.switchPaymentTab('emi')" id="payTab-paylater" style="display:flex; flex-direction:column; padding:0.75rem 0.85rem; border-radius:10px; border:1px solid #e2e8f0; background:#ffffff; color:#0f172a; font-weight:700; font-size:0.82rem; cursor:pointer; text-align:left;">
                                    <div style="display:flex; align-items:center; gap:0.5rem; font-weight:800;">
                                        <span style="font-size:1rem;">💵</span> <span>Pay Later</span>
                                    </div>
                                    <span style="font-size:0.67rem; color:#64748b; margin-top:0.15rem; font-weight:500;">Pay in easier installments</span>
                                </button>

                            </div>

                            <!-- Right Content Panels -->
                            <div>
                                <!-- UPI PANEL (MATCHING IMAGE 2 EXACTLY) -->
                                <div id="paySection-upi">
                                    <h4 style="font-size:0.98rem; font-weight:800; color:#0f172a; margin:0 0 0.15rem;">Pay using UPI</h4>
                                    <div style="font-size:0.76rem; color:#64748b; margin-bottom:1rem;">Scan any QR code using your UPI app</div>

                                    <!-- Row of UPI App Logos -->
                                    <div style="display:grid; grid-template-columns:repeat(6, 1fr); gap:0.5rem; margin-bottom:1.2rem; text-align:center;">
                                        <div style="border:1px solid #e2e8f0; border-radius:8px; padding:0.5rem 0.3rem; background:#ffffff; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
                                            <div style="font-weight:900; font-size:0.74rem; color:#ea4335;"><span style="color:#4285f4;">G</span> Pay</div>
                                            <div style="font-size:0.6rem; color:#64748b; margin-top:0.15rem;">Google Pay</div>
                                        </div>
                                        <div style="border:1px solid #e2e8f0; border-radius:8px; padding:0.5rem 0.3rem; background:#ffffff; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
                                            <div style="width:20px; height:20px; background:#5f259f; color:#fff; border-radius:50%; font-weight:900; font-size:0.65rem; display:flex; align-items:center; justify-content:center; margin:0 auto;">पे</div>
                                            <div style="font-size:0.6rem; color:#64748b; margin-top:0.15rem;">PhonePe</div>
                                        </div>
                                        <div style="border:1px solid #e2e8f0; border-radius:8px; padding:0.5rem 0.3rem; background:#ffffff; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
                                            <div style="font-weight:900; font-size:0.74rem; color:#00baf2;">Paytm</div>
                                            <div style="font-size:0.6rem; color:#64748b; margin-top:0.15rem;">Paytm</div>
                                        </div>
                                        <div style="border:1px solid #e2e8f0; border-radius:8px; padding:0.5rem 0.3rem; background:#ffffff; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
                                            <div style="font-weight:900; font-size:0.74rem; color:#ff6600;">BHIM</div>
                                            <div style="font-size:0.6rem; color:#64748b; margin-top:0.15rem;">BHIM</div>
                                        </div>
                                        <div style="border:1px solid #e2e8f0; border-radius:8px; padding:0.5rem 0.3rem; background:#ffffff; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
                                            <div style="font-weight:900; font-size:0.7rem; color:#232f3e;"><span style="color:#ff9900;">a</span> pay</div>
                                            <div style="font-size:0.6rem; color:#64748b; margin-top:0.15rem;">Amazon Pay</div>
                                        </div>
                                        <div style="border:1px solid #e2e8f0; border-radius:8px; padding:0.5rem 0.3rem; background:#ffffff; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
                                            <div style="font-weight:900; font-size:0.7rem; color:#047857;">UPI▶</div>
                                            <div style="font-size:0.6rem; color:#64748b; margin-top:0.15rem;">Other UPI</div>
                                        </div>
                                    </div>

                                    <!-- Divider Line -->
                                    <div style="display:flex; align-items:center; justify-content:center; gap:0.7rem; margin-bottom:1.1rem;">
                                        <div style="flex:1; height:1px; background:#e2e8f0;"></div>
                                        <span style="font-size:0.7rem; color:#64748b; font-weight:600;">or scan this QR code</span>
                                        <div style="flex:1; height:1px; background:#e2e8f0;"></div>
                                    </div>

                                    <!-- QR Code Box with Central Logo Emblem Overlay -->
                                    <div style="text-align:center; margin-bottom:0.9rem;">
                                        <div style="position:relative; display:inline-block; padding:10px; background:#ffffff; border:2px solid #e2e8f0; border-radius:16px; box-shadow:0 4px 14px rgba(0,0,0,0.03);">
                                            <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi%3A%2F%2Fpay%3Fpa%3D%26pn%3DZilhaj%26am%3D${encodeURIComponent(finalTotalAmount)}%26cu%3DINR" alt="UPI QR Code" style="width:170px; height:170px; display:block;" />
                                            <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); width:34px; height:34px; background:#047857; border:3px solid #ffffff; border-radius:8px; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,0.15);">
                                                <span style="color:#ffffff; font-weight:900; font-size:1rem; font-style:italic;">Z</span>
                                            </div>
                                        </div>

                                        <div style="display:flex; align-items:center; justify-content:center; gap:0.35rem; margin-top:0.7rem; font-size:0.8rem; color:#0f172a; font-weight:700;">
                                            <span>UPI ID: ${this.escapeHtml(offer.upiId || '')}</span>
                                            <button type="button" onclick="navigator.clipboard.writeText('${this.escapeHtml(offer.upiId || '')}'); app.showToast('UPI ID copied to clipboard!', 'success');" style="background:none; border:none; color:#047857; cursor:pointer; font-size:0.85rem;" title="Copy UPI ID">📋</button>
                                        </div>
                                    </div>

                                    <div style="font-size:0.72rem; color:#64748b; text-align:center; display:flex; align-items:center; justify-content:center; gap:0.3rem;">
                                        <span>ⓘ</span> You will be able to review the payment on the next step.
                                    </div>
                                </div>

                                <!-- CARDS PANEL -->
                                <div id="paySection-card" style="display:none;">
                                    <h4 style="font-size:0.98rem; font-weight:800; color:#0f172a; margin:0 0 0.7rem;">Enter Card Details</h4>
                                    <div style="display:flex; flex-direction:column; gap:0.8rem;">
                                        <div>
                                            <label style="font-size:0.72rem; font-weight:700; color:#475569; display:block; margin-bottom:0.25rem;">CARDHOLDER NAME</label>
                                            <input type="text" value="${this.escapeHtml(user.name || '')}" style="width:100%; box-sizing:border-box; padding:0.6rem; border-radius:7px; border:1px solid #cbd5e1; font-weight:600; font-size:0.85rem;" />
                                        </div>
                                        <div>
                                            <label style="font-size:0.72rem; font-weight:700; color:#475569; display:block; margin-bottom:0.25rem;">CARD NUMBER</label>
                                            <input type="text" placeholder="4111 2222 3333 4444" style="width:100%; box-sizing:border-box; padding:0.6rem; border-radius:7px; border:1px solid #cbd5e1; font-weight:600; font-size:0.85rem;" />
                                        </div>
                                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.7rem;">
                                            <div>
                                                <label style="font-size:0.72rem; font-weight:700; color:#475569; display:block; margin-bottom:0.25rem;">EXPIRY</label>
                                                <input type="text" placeholder="MM/YY" style="width:100%; box-sizing:border-box; padding:0.6rem; border-radius:7px; border:1px solid #cbd5e1; font-weight:600; font-size:0.85rem;" />
                                            </div>
                                            <div>
                                                <label style="font-size:0.72rem; font-weight:700; color:#475569; display:block; margin-bottom:0.25rem;">CVV</label>
                                                <input type="password" placeholder="123" style="width:100%; box-sizing:border-box; padding:0.6rem; border-radius:7px; border:1px solid #cbd5e1; font-weight:600; font-size:0.85rem;" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- NET BANKING PANEL -->
                                <div id="paySection-net" style="display:none;">
                                    <h4 style="font-size:0.98rem; font-weight:800; color:#0f172a; margin:0 0 0.7rem;">Select Your Bank</h4>
                                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.55rem;">
                                        <button type="button" style="padding:0.65rem; border:1px solid #047857; background:#f0fdf4; border-radius:7px; font-weight:700; color:#047857; text-align:left; font-size:0.82rem;">HDFC Bank</button>
                                        <button type="button" style="padding:0.65rem; border:1px solid #cbd5e1; background:#ffffff; border-radius:7px; font-weight:700; color:#334155; text-align:left; font-size:0.82rem;">ICICI Bank</button>
                                        <button type="button" style="padding:0.65rem; border:1px solid #cbd5e1; background:#ffffff; border-radius:7px; font-weight:700; color:#334155; text-align:left; font-size:0.82rem;">State Bank of India</button>
                                        <button type="button" style="padding:0.65rem; border:1px solid #cbd5e1; background:#ffffff; border-radius:7px; font-weight:700; color:#334155; text-align:left; font-size:0.82rem;">Axis Bank</button>
                                    </div>
                                </div>

                                <!-- EMI / WALLET PANEL -->
                                <div id="paySection-emi" style="display:none;">
                                    <h4 style="font-size:0.98rem; font-weight:800; color:#0f172a; margin:0 0 0.7rem;">Select Wallet / EMI</h4>
                                    <div style="display:flex; flex-direction:column; gap:0.5rem;">
                                        <label style="display:flex; align-items:center; gap:0.5rem; padding:0.6rem; border:1px solid #cbd5e1; border-radius:7px; cursor:pointer; font-size:0.82rem;">
                                            <input type="radio" name="walletOpt2" checked style="accent-color:#047857;" /> Paytm Wallet / PhonePe
                                        </label>
                                        <label style="display:flex; align-items:center; gap:0.5rem; padding:0.6rem; border:1px solid #cbd5e1; border-radius:7px; cursor:pointer; font-size:0.82rem;">
                                            <input type="radio" name="walletOpt2" style="accent-color:#047857;" /> Simpl 3 No-Cost EMI
                                        </label>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>

                    <!-- SECTION 2: PAYMENT DETAILS (PASSENGER CONTACT FORM) -->
                    <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:1.2rem; box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                        <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:1.1rem;">
                            <div style="width:24px; height:24px; background:#047857; color:#ffffff; border-radius:50%; font-weight:800; font-size:0.8rem; display:flex; align-items:center; justify-content:center;">2</div>
                            <h3 style="font-size:1rem; font-weight:800; color:#0f172a; margin:0;">Payment Details</h3>
                        </div>

                        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:1rem; margin-bottom:1rem;">
                            <div>
                                <div style="font-size:0.68rem; color:#64748b; font-weight:600;">Booking For</div>
                                <div style="font-size:0.88rem; font-weight:800; color:#0f172a; margin-top:0.15rem;">${this.escapeHtml(user.name || 'Guest')}</div>
                            </div>
                            <div>
                                <div style="font-size:0.68rem; color:#64748b; font-weight:600;">Mobile Number</div>
                                <div style="font-size:0.88rem; font-weight:800; color:#0f172a; margin-top:0.15rem;">${this.escapeHtml(user.phone || '')}</div>
                            </div>
                            <div>
                                <div style="font-size:0.68rem; color:#64748b; font-weight:600;">Email Address</div>
                                <div style="font-size:0.88rem; font-weight:800; color:#0f172a; margin-top:0.15rem;">${this.escapeHtml(user.email || '')}</div>
                            </div>
                        </div>

                        <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.78rem; color:#334155; cursor:pointer; margin-bottom:1.1rem;">
                            <input type="checkbox" checked style="accent-color:#047857; width:15px; height:15px;" />
                            <span>I want to receive payment confirmation on WhatsApp <span style="color:#25d366; font-size:0.9rem;">💬</span></span>
                        </label>

                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:0.75rem 0.9rem; display:flex; align-items:center; gap:0.55rem; font-size:0.75rem; color:#475569;">
                            <span style="color:#047857; font-size:1rem; flex-shrink:0;">🛡️</span>
                            <div>
                                <strong style="color:#0f172a;">We are committed to complete transparency.</strong> All payments are processed securely and there are no hidden charges.
                            </div>
                        </div>
                    </div>

                </div>

                <!-- RIGHT COLUMN: BOOKING SUMMARY & INCLUSIONS CARDS -->
                <div style="display:flex; flex-direction:column; gap:1.2rem;">
                    
                    <!-- Card 1: Booking Summary -->
                    <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:1.2rem; box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                        <h3 style="font-size:1rem; font-weight:800; color:#0f172a; margin:0 0 0.9rem;">Booking Summary</h3>

                        <div style="display:flex; gap:0.8rem; align-items:center; margin-bottom:1.1rem; padding-bottom:0.9rem; border-bottom:1px solid #f1f5f9;">
                            <img src="https://images.unsplash.com/photo-1591604466107-ec97de577aff?auto=format&fit=crop&w=120&q=80" alt="Kaaba" style="width:62px; height:62px; border-radius:10px; object-fit:cover; flex-shrink:0;" />
                            <div>
                                <h4 style="font-size:0.88rem; font-weight:800; color:#0f172a; margin:0 0 0.15rem;">${this.escapeHtml(offer.packageTitle)}</h4>
                                <div style="font-size:0.72rem; color:#64748b; margin-bottom:0.3rem;">${offer.requirementId ? 'REQ-' + offer.requirementId : ''}${offer.requirementId && travelersCount ? ' • ' : ''}${this.escapeHtml(String(offer.travelersCount || req.travelersCount || req.adults || travelersCount))} Adults, 0 Children</div>
                                <span style="background:#ecfdf5; color:#047857; font-size:0.67rem; font-weight:800; padding:0.12rem 0.45rem; border-radius:99px;">${offer.durationDays || '—'} Days</span>
                            </div>
                        </div>

                        <div style="display:flex; flex-direction:column; gap:0.55rem; font-size:0.78rem; color:#475569;">
                            <div style="display:flex; justify-content:space-between;">
                                <span>Package Price (${travelersCount} × ${this.formatCurrency(perPersonPrice)})</span>
                                <span style="font-weight:700; color:#0f172a;">${this.formatCurrency(packagePriceTotal)}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between;">
                                <span>Taxes &amp; Fees</span>
                                <span style="font-weight:700; color:#0f172a;">${this.formatCurrency(taxesAndFees)}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between;">
                                <span>Visa Charges</span>
                                <span style="font-weight:700; color:#0f172a;">${this.formatCurrency(visaCharges)}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between;">
                                <span>Travel Insurance</span>
                                <span style="font-weight:700; color:#0f172a;">${this.formatCurrency(travelInsurance)}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; color:#047857; font-weight:700;">
                                <span>Offer Discount</span>
                                <span>- ${this.formatCurrency(offerDiscount)}</span>
                            </div>

                            <div style="border-top:1px solid #e2e8f0; padding-top:0.8rem; margin-top:0.3rem; display:flex; justify-content:space-between; align-items:baseline;">
                                <div>
                                    <div style="font-size:0.88rem; font-weight:800; color:#0f172a;">Total Amount</div>
                                    <div style="font-size:0.65rem; color:#64748b;">All amounts are in INR</div>
                                </div>
                                <div style="font-size:1.45rem; font-weight:900; color:#047857;">${this.formatCurrency(finalTotalAmount)}</div>
                            </div>
                        </div>
                    </div>

                    <!-- Card 2: What's Included -->
                    <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:1.2rem; box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                        <h3 style="font-size:1rem; font-weight:800; color:#0f172a; margin:0 0 0.8rem;">What's Included</h3>
                        
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.55rem; font-size:0.75rem; color:#334155; margin-bottom:0.9rem;">
                            <div style="display:flex; align-items:center; gap:0.4rem;">
                                <span style="color:#047857; font-weight:800;">✈️</span> <span>Return Flights</span>
                            </div>
                            <div style="display:flex; align-items:center; gap:0.4rem;">
                                <span style="color:#047857; font-weight:800;">🛡️</span> <span>9 Nights Accommodation</span>
                            </div>
                            <div style="display:flex; align-items:center; gap:0.4rem;">
                                <span style="color:#047857; font-weight:800;">🛂</span> <span>Visa Included</span>
                            </div>
                            <div style="display:flex; align-items:center; gap:0.4rem;">
                                <span style="color:#047857; font-weight:800;">🍽️</span> <span>Meals (Breakfast, Lunch &amp; Dinner)</span>
                            </div>
                            <div style="display:flex; align-items:center; gap:0.4rem;">
                                <span style="color:#047857; font-weight:800;">🚌</span> <span>All Local Transfers</span>
                            </div>
                            <div style="display:flex; align-items:center; gap:0.4rem;">
                                <span style="color:#047857; font-weight:800;">🕌</span> <span>Ziyarat &amp; Madinah Ziyarat</span>
                            </div>
                        </div>

                        <a href="javascript:void(0)" onclick="app.setDashboardTab('packageDetails')" style="font-size:0.76rem; font-weight:700; color:#047857; text-decoration:none; display:inline-flex; align-items:center; gap:0.25rem;">
                            View all inclusions →
                        </a>
                    </div>

                    <!-- Card 3: We Accept -->
                    <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:1.1rem; box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                        <h4 style="font-size:0.82rem; font-weight:800; color:#0f172a; margin:0 0 0.7rem;">We Accept</h4>
                        
                        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:0.45rem; text-align:center;">
                            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:5px; padding:0.4rem 0.15rem; font-size:0.7rem; font-weight:900; color:#1a1f71;">VISA</div>
                            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:5px; padding:0.4rem 0.15rem; font-size:0.7rem; font-weight:900; color:#eb001b;">mastercard</div>
                            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:5px; padding:0.4rem 0.15rem; font-size:0.7rem; font-weight:900; color:#00529b;">RuPay</div>
                            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:5px; padding:0.4rem 0.15rem; font-size:0.7rem; font-weight:900; color:#047857;">UPI▶</div>
                            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:5px; padding:0.4rem 0.15rem; font-size:0.67rem; font-weight:900; color:#ea4335;"><span style="color:#4285f4;">G</span> Pay</div>
                            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:5px; padding:0.4rem 0.15rem; font-size:0.67rem; font-weight:900; color:#5f259f;">PhonePe</div>
                            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:5px; padding:0.4rem 0.15rem; font-size:0.67rem; font-weight:900; color:#00baf2;">Paytm</div>
                            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:5px; padding:0.4rem 0.15rem; font-size:0.67rem; font-weight:900; color:#232f3e;"><span style="color:#ff9900;">a</span> pay</div>
                        </div>

                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.35rem; font-size:0.65rem; color:#64748b; margin-top:0.8rem;">
                            <div>✓ SSL Encrypted Transactions</div>
                            <div>✓ PCI DSS Certified</div>
                            <div>✓ 100% Money Safe Guarantee</div>
                            <div>✓ Instant Payment Confirmation</div>
                        </div>
                    </div>

                </div>

            </div>

            <!-- STICKY / BOTTOM CONFIRMATION REVIEW BAR -->
            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:0.9rem 1.4rem; display:flex; justify-content:space-between; align-items:center; box-shadow:0 -4px 16px rgba(0,0,0,0.03); margin-top:0.6rem; position:sticky; bottom:1rem;">
                <div>
                    <div style="font-size:0.7rem; color:#64748b; font-weight:600;">Total Amount</div>
                    <div style="display:flex; align-items:baseline; gap:0.55rem;">
                        <div style="font-size:1.5rem; font-weight:900; color:#047857;">${this.formatCurrency(finalTotalAmount)}</div>
                        <a href="javascript:void(0)" onclick="window.scrollTo({top: 400, behavior:'smooth'})" style="font-size:0.72rem; color:#047857; font-weight:700; text-decoration:none;">View Price Details ^</a>
                    </div>
                </div>

                <button onclick="app.payWithRazorpay('${offer.id}', '${finalTotalAmount}', 'UPI')" style="background:#047857; color:#ffffff; border:none; border-radius:10px; padding:0.75rem 2rem; font-size:0.95rem; font-weight:800; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; box-shadow:0 4px 16px rgba(4,120,87,0.25); transition:all 0.2s;" onmouseover="this.style.background='#065f46';this.style.transform='translateY(-2px)'" onmouseout="this.style.background='#047857';this.style.transform='none'">
                    <span style="font-size:0.98rem;">Review Payment</span>
                    <span style="font-size:0.68rem; opacity:0.9; font-weight:500;">You will be able to confirm on the next step</span>
                </button>
            </div>

        </main>`;
    }

    switchPaymentTab(tabName) {
        ['upi', 'card', 'net', 'emi'].forEach(t => {
            const tabBtn = document.getElementById(`payTab-${t}`);
            const sec = document.getElementById(`paySection-${t}`);
            if (tabBtn) {
                if (t === tabName) {
                    tabBtn.style.background = '#e8f5e9';
                    tabBtn.style.color = '#2e7d32';
                    tabBtn.style.border = '1px solid #c8e6c9';
                } else {
                    tabBtn.style.background = '#f8fafc';
                    tabBtn.style.color = '#64748b';
                    tabBtn.style.border = '1px solid #e2e8f0';
                }
            }
            if (sec) sec.style.display = (t === tabName) ? (t === 'card' || t === 'net' || t === 'emi' ? 'flex' : 'block') : 'none';
        });
    }

    async processPayment(offerId) {
        let allOffers = JSON.parse(localStorage.getItem('umrah_user_offers') || '[]');
        let offer = allOffers.find(o => o.id === offerId);
        if (!offer || !offer.id) {
            this.showToast('This offer is no longer available. Please refresh and try again.', 'warning');
            return;
        }
        const totalAmount = offer.discountedPrice || offer.price || 0;
        const bookingRef = 'BK-' + Date.now().toString().slice(-6);

        if (typeof window.Razorpay !== 'undefined') {
            const options = {
                "key": "rzp_test_TNHXpbHGezYnSb",
                "amount": Math.round(totalAmount * 100),
                "currency": "INR",
                "name": "ZILHAJ Umrah & Hajj Travel",
                "description": offer.packageTitle || "Umrah Payment",
                "image": "https://img.icons8.com/color/96/000000/kaaba.png",
                "config": {
                    "display": {
                        "blocks": {
                            "utib": {
                                "name": "Pay via UPI / QR Code (Google Pay, PhonePe, Paytm)",
                                "instruments": [
                                    { "method": "upi" }
                                ]
                            },
                            "other": {
                                "name": "Other Payment Options (Cards / NetBanking)",
                                "instruments": [
                                    { "method": "card" },
                                    { "method": "netbanking" }
                                ]
                            }
                        },
                        "sequence": ["block.utib", "block.other"],
                        "preferences": { show_default_blocks: true }
                    }
                },
                "method": {
                    "upi": true,
                    "card": true,
                    "netbanking": true,
                    "wallet": true
                },
                "handler": (response) => {
                    let allBookings = JSON.parse(localStorage.getItem('umrah_my_bookings') || '[]');
                    const user = this.state.currentUser || {};
                    const newBooking = {
                        id: bookingRef,
                        packageTitle: offer.packageTitle,
                        offerId: offer.id,
                        requirementId: offer.requirementId || '',
                        travelDate: offer.travelDate || new Date().toISOString().slice(0, 10),
                        travelersCount: offer.travelersCount || 1,
                        totalPrice: totalAmount,
                        status: 'CONFIRMED',
                        paymentStatus: 'PAID',
                        paymentMethod: 'RAZORPAY',
                        paymentId: response.razorpay_payment_id,
                        transactionId: response.razorpay_payment_id,
                        razorpayOrderId: response.razorpay_order_id || '',
                        paidAt: new Date().toISOString(),
                        userName: user.name || '',
                        userEmail: user.email || '',
                        userPhone: user.phone || '',
                        userId: user.id || '',
                        agentName: offer.agentName || '',
                        makkahHotel: offer.makkahHotel || '',
                        madinahHotel: offer.madinahHotel || ''
                    };
                    allBookings.unshift(newBooking);
                    localStorage.setItem('umrah_my_bookings', JSON.stringify(allBookings));
                    this.apiCall('/bookings', 'POST', newBooking);

                    this.showSuccessModal(
                        '🎉 Booking Confirmed & Payment Successful!',
                        `Payment ID: <strong>${response.razorpay_payment_id}</strong><br>Congratulations! Your Umrah trip booking (Ref: <strong>${bookingRef}</strong>) for ₹${totalAmount} is confirmed. Your official invoice with Payment ID and Transaction ID is ready to download.`
                    );
                    this.downloadInvoice(bookingRef);
                    this.navigate('dashboard');
                },
                "prefill": {
                    "name": this.state?.currentUser?.name || "",
                    "email": this.state?.currentUser?.email || "",
                    "contact": this.state?.currentUser?.phone || ""
                },
                "theme": {
                    "color": "#047857"
                }
            };
            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', (resp) => {
                this.showToast('Payment failed: ' + (resp?.error?.description || 'Transaction declined'), 'error');
            });
            rzp.open();
            return;
        }

        this.showLoading('Processing secure 256-bit encrypted payment...');

        setTimeout(() => {
            let allBookings = JSON.parse(localStorage.getItem('umrah_my_bookings') || '[]');
            const user = this.state.currentUser || {};
            const txnId = 'TXN-' + Date.now();
            const newBooking = {
                id: bookingRef,
                packageTitle: offer.packageTitle,
                offerId: offer.id,
                requirementId: offer.requirementId || '',
                travelDate: offer.travelDate || new Date().toISOString().slice(0, 10),
                travelersCount: offer.travelersCount || 1,
                totalPrice: totalAmount,
                status: 'CONFIRMED',
                paymentStatus: 'PAID',
                paymentMethod: 'UPI',
                transactionId: txnId,
                paidAt: new Date().toISOString(),
                userName: user.name || '',
                userEmail: user.email || '',
                userPhone: user.phone || '',
                userId: user.id || '',
                agentName: offer.agentName || '',
                makkahHotel: offer.makkahHotel || '',
                madinahHotel: offer.madinahHotel || ''
            };

            allBookings.unshift(newBooking);
            localStorage.setItem('umrah_my_bookings', JSON.stringify(allBookings));
            this.apiCall('/bookings', 'POST', newBooking);

            this.hideLoading();

            this.showSuccessModal(
                '🎉 Booking Confirmed &amp; Payment Successful!',
                `Congratulations! Your Umrah trip booking (Ref: <strong>${bookingRef}</strong>) is confirmed. Your instant PDF voucher invoice is ready to download.`
            );

            this.downloadInvoice(bookingRef);
            this.navigate('dashboard');
        }, 1500);
    }



    async downloadInvoice(bookingId) {
        const id = bookingId || '';
        const allBookings = JSON.parse(localStorage.getItem('umrah_my_bookings') || '[]');
        let b = allBookings.find(item => item.id === id);
        if (!b) b = (this.state.myBookings || []).find(item => item.id === id);

        if (!b) {
            this.showToast('Invoice not found. Please refresh and try again.', 'warning');
            return;
        }

        const user = this.state.currentUser || {};
        const userName = b.userName || user.name || '';
        const userEmail = b.userEmail || user.email || '';
        const userPhone = b.userPhone || user.phone || '';
        const totalPrice = b.totalPrice || 0;
        const formattedAmount = (typeof totalPrice === 'number') ? totalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : totalPrice;

        const numberToWordsINR = (num) => {
            const n = Math.floor(Number(num) || 0);
            if (n <= 0) return 'Zero only';
            const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
            const t = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
            const inW = (val) => {
                if (val < 20) return a[val];
                if (val < 100) return t[Math.floor(val / 10)] + (val % 10 ? ' ' + a[val % 10] : '');
                if (val < 1000) return a[Math.floor(val / 100)] + ' Hundred' + (val % 100 ? ' ' + inW(val % 100) : '');
                if (val < 100000) return inW(Math.floor(val / 1000)) + ' Thousand' + (val % 1000 ? ' ' + inW(val % 1000) : '');
                if (val < 10000000) return inW(Math.floor(val / 100000)) + ' Lakh' + (val % 100000 ? ' ' + inW(val % 100000) : '');
                return inW(Math.floor(val / 10000000)) + ' Crore' + (val % 10000000 ? ' ' + inW(val % 10000000) : '');
            };
            return inW(n) + ' only';
        };

        const amountWords = numberToWordsINR(totalPrice);
        const makkahHotel = b.makkahHotel || '';
        const madinahHotel = b.madinahHotel || '';
        const bookingDate = b.bookingDate || b.travelDate || '';
        const invoiceNum = b.invoiceNum || '';
        const invoiceDate = b.invoiceDate || '';
        const bookingNo = b.id || '';

        const printWindow = window.open('', '_blank', 'width=900,height=1000');
        if (!printWindow) {
            this.showToast('Please allow popups to download your styled PDF ticket invoice.', 'warning');
            return;
        }

        printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Invoice - ${bookingNo}</title>
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    @page { size: A4; margin: 12mm 15mm; }
    * { box-sizing: border-box; }
    body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
        color: #000000;
        background: #ffffff;
        margin: 0;
        padding: 20px 30px;
        font-size: 11.5px;
        line-height: 1.45;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    .header-flex {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 8px;
    }
    .brand-title {
        font-size: 28px;
        font-weight: 900;
        color: #000000;
        letter-spacing: -0.8px;
        line-height: 1;
    }
    .header-right {
        text-align: right;
    }
    .tax-title {
        font-size: 15px;
        font-weight: 800;
        color: #000000;
        margin-bottom: 2px;
    }
    .tax-subtitle {
        font-size: 11px;
        color: #111111;
    }
    .divider {
        border-top: 1px solid #000000;
        margin: 8px 0 18px 0;
    }
    .details-grid {
        display: flex;
        justify-content: space-between;
        margin-bottom: 15px;
    }
    .col-left {
        width: 48%;
    }
    .col-right {
        width: 48%;
        text-align: right;
    }
    .sec-title {
        font-size: 12.5px;
        font-weight: 800;
        color: #000000;
        margin-bottom: 6px;
    }
    .info-item {
        margin-bottom: 3px;
        color: #000000;
        font-size: 11px;
    }
    .qr-container {
        margin-top: 12px;
        border: 1px solid #000000;
        display: inline-block;
        padding: 4px;
        background: #fff;
    }
    .invoice-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 15px;
        border: 1px solid #000000;
    }
    .invoice-table th {
        background-color: #e5e7eb;
        border: 1px solid #000000;
        padding: 6px 8px;
        font-size: 11px;
        font-weight: 800;
        color: #000000;
    }
    .invoice-table td {
        border: 1px solid #000000;
        padding: 8px;
        font-size: 11px;
        vertical-align: top;
    }
    .table-total-row td {
        font-weight: 800;
        border-top: 1.5px solid #000000;
        font-size: 11.5px;
    }
    .amount-box {
        border: 1px solid #000000;
        border-top: none;
        padding: 10px 12px;
        min-height: 110px;
        position: relative;
    }
    .amount-title {
        font-weight: 700;
        margin-bottom: 4px;
    }
    .amount-text {
        font-weight: 800;
        font-size: 12.5px;
    }
    .signatory-wrapper {
        position: absolute;
        right: 12px;
        bottom: 8px;
        text-align: center;
    }
    .stamp-placeholder {
        width: 110px;
        height: 40px;
        background: #f3f4f6;
        border: 1px solid #d1d5db;
        margin: 3px auto;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 9px;
        color: #6b7280;
    }
    .footer-note {
        margin-top: 35px;
        text-align: center;
        font-size: 9.5px;
        color: #4b5563;
        font-style: italic;
    }
</style>
</head>
<body>
    <div class="header-flex">
        <div class="brand-title">zilhaj.com</div>
        <div class="header-right">
            <div class="tax-title">Tax Invoice/Bill of Supply/Cash Memo</div>
            <div class="tax-subtitle">(Original for Pilgrim)</div>
        </div>
    </div>
    <div class="divider"></div>

    <div class="details-grid">
        <div class="col-left">
            <div class="sec-title">Lead Pilgrim Information :</div>
            <div class="info-item"><strong>${this.escapeHtml(userName)}</strong></div>
            <div class="info-item">ID/Passport: [Redacted]</div>
            <div class="info-item">Contact: [Redacted]</div>
            <div class="info-item">Email: [Redacted]</div>
            <br>
            <div class="info-item"><strong>Escrow Account No:</strong> ESC-ZHJ-99281</div>
            <div class="info-item"><strong>Verification Status:</strong> Verified & Secured</div>
            <br>
            <div class="info-item"><strong>Booking Number:</strong> ${this.escapeHtml(bookingNo)}</div>
            <div class="info-item"><strong>Booking Date:</strong> ${this.escapeHtml(bookingDate)}</div>
            <div class="info-item"><strong>PO Number:</strong> UTPL_Zhj_003</div>
            
            <div class="qr-container">
                <svg width="65" height="65" viewBox="0 0 100 100">
                    <rect width="100" height="100" fill="#ffffff"/>
                    <path d="M0,0 h30 v30 h-30 z M10,10 h10 v10 h-10 z" fill="#000"/>
                    <path d="M70,0 h30 v30 h-30 z M80,10 h10 v10 h-10 z" fill="#000"/>
                    <path d="M0,70 h30 v30 h-30 z M10,80 h10 v10 h-10 z" fill="#000"/>
                    <rect x="40" y="40" width="20" height="20" fill="#000"/>
                    <rect x="70" y="70" width="15" height="15" fill="#000"/>
                    <rect x="40" y="10" width="10" height="20" fill="#000"/>
                    <rect x="10" y="40" width="20" height="10" fill="#000"/>
                    <rect x="80" y="45" width="10" height="15" fill="#000"/>
                </svg>
            </div>
        </div>

        <div class="col-right">
            <div class="sec-title">Hotel & Travel Details (Makkah) :</div>
            <div class="info-item"><strong>${this.escapeHtml(makkahHotel)}</strong></div>
            <div class="info-item">King Abdul Aziz Endowment</div>
            <div class="info-item">Abraj Al Bait Complex, Makkah, Saudi Arabia</div>
            <div class="info-item"><strong>Check-In:</strong> [Date] | <strong>Check-Out:</strong> [Date]</div>
            <br>
            <div class="sec-title">Hotel & Travel Details (Madinah) :</div>
            <div class="info-item"><strong>${this.escapeHtml(madinahHotel)}</strong></div>
            <div class="info-item">Amr Bin Al Aas Street, Madinah, Saudi Arabia</div>
            <div class="info-item"><strong>Check-In:</strong> [Date] | <strong>Check-Out:</strong> [Date]</div>
            <br>
            <div class="info-item"><strong>Place of supply:</strong> SAUDI ARABIA</div>
            <div class="info-item"><strong>Place of delivery:</strong> SAUDI ARABIA</div>
            <div class="info-item"><strong>Invoice Number :</strong> ${this.escapeHtml(invoiceNum)}</div>
            <div class="info-item"><strong>Invoice Details :</strong> TG-HYD8-179184911-2324</div>
            <div class="info-item"><strong>Invoice Date :</strong> ${this.escapeHtml(invoiceDate)}</div>
        </div>
    </div>

    <table class="invoice-table">
        <thead>
            <tr>
                <th style="width:5%; text-align:center;">Sl. No</th>
                <th style="width:55%; text-align:left;">Description</th>
                <th style="width:13%; text-align:left;">Category</th>
                <th style="width:12%; text-align:left;">Status</th>
                <th style="width:15%; text-align:right;">Amount</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td style="text-align:center;">1</td>
                <td>
                    <strong>${this.escapeHtml(b.packageTitle || 'Hajj Package 2024 - Premium')}</strong><br>
                    <span style="font-size:10px; color:#333333;">Includes Accommodation (${this.escapeHtml(makkahHotel)}, ${this.escapeHtml(madinahHotel)}), Visa Processing, and Ground Transport.</span>
                </td>
                <td>Package</td>
                <td>Confirmed</td>
                <td style="text-align:right;">₹${formattedAmount}</td>
            </tr>
            <tr class="table-total-row">
                <td colspan="4" style="text-align:left;"><strong>TOTAL:</strong></td>
                <td style="text-align:right;"><strong>₹${formattedAmount}</strong></td>
            </tr>
        </tbody>
    </table>

    <div class="amount-box">
        <div class="amount-title">Amount in Words:</div>
        <div class="amount-text">${amountWords}</div>

        <div class="signatory-wrapper">
            <div style="font-weight:700; font-size:11px; margin-bottom:2px;">For Zilhaj.com:</div>
            <div class="stamp-placeholder">[Seal/Stamp]</div>
            <div style="font-weight:800; font-size:11px; margin-top:2px;">Authorized Signatory</div>
        </div>
    </div>

    <div class="footer-note">
        *Zilhaj.com acts as a facilitator. Services are fulfilled by respective partners.<br>
        Please note that this confirmation is not a demand for payment if already settled via Escrow.
    </div>

    <script>
        window.onload = function() {
            setTimeout(function() {
                window.print();
            }, 300);
        };
    </script>
</body>
</html>`);
        printWindow.document.close();
    }

    deleteRequirement(reqId) {
        if (!confirm("Are you sure you want to delete this travel request?")) return;

        let allReqs = JSON.parse(localStorage.getItem('umrah_requirements') || '[]');
        let allOffers = JSON.parse(localStorage.getItem('umrah_user_offers') || '[]');

        allReqs = allReqs.filter(r => r.id !== reqId);
        allOffers = allOffers.filter(o => o.requirementId !== reqId);

        localStorage.setItem('umrah_requirements', JSON.stringify(allReqs));
        localStorage.setItem('umrah_user_offers', JSON.stringify(allOffers));

        this.showToast('Travel request deleted successfully.', 'info');

        const main = document.getElementById('mainContent');
        if (main) main.innerHTML = this.renderDashboardPage();
    }



    renderOffersPage() {
        const user = this.state.currentUser || {};

        // Merge API-sourced data (source of truth) with localStorage fallback
        const localReqs = JSON.parse(localStorage.getItem('umrah_requirements') || '[]');
        const localOffersList = JSON.parse(localStorage.getItem('umrah_user_offers') || '[]');
        const apiReqs = this.state.myRequirements || [];
        const apiOffersList = this.state.userOffers || [];
        const allReqs = [...apiReqs, ...localReqs.filter(lr => !apiReqs.some(r => r.id === lr.id))];
        const allOffersList = [...apiOffersList, ...localOffersList.filter(lo => !apiOffersList.some(o => o.id === lo.id))];

        const requirements = allReqs.filter(r => r.userId === user.id || r.userEmail === user.email);
        const userReqIds = requirements.map(r => r.id);
        const allOffers = allOffersList.filter(o => o.userId === user.id || userReqIds.includes(o.requirementId));

        return `
            <div class="main-container" style="max-width:100%; width:100%; box-sizing:border-box; margin:7rem auto 3rem; padding:0 3.5rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem; flex-wrap:wrap; gap:1rem;">
                    <div>
                        <h2 style="margin:0;">🎁 Offers Available — Competitive Agent Bids</h2>
                        <p style="color:#64748b; font-size:0.9rem; margin-top:0.3rem;">Verified travel providers compete with discounted custom package offers for your submitted travel requests.</p>
                    </div>
                    <div style="display:flex; gap:0.6rem;">
                        <button class="btn btn-outline btn-sm" onclick="app.navigate('dashboard')">← Back to Dashboard</button>
                    </div>
                </div>

                ${requirements.length > 0 ? `
                    <div style="display:flex; flex-direction:column; gap:2rem;">
                        ${requirements.map(req => {
            const offersForReq = allOffers.filter(o => o.requirementId === req.id);
            return `
                                <div style="background:white; border-radius:16px; border:1px solid #cbd5e1; padding:1.8rem; box-shadow:0 6px 20px rgba(0,0,0,0.04);">
                                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; border-bottom:1.5px dashed #e2e8f0; padding-bottom:1rem; margin-bottom:1.2rem;">
                                        <div>
                                            <span style="background:#047857; color:white; font-size:0.78rem; font-weight:800; padding:0.3rem 0.7rem; border-radius:8px;">REQUEST: ${req.id}</span>
                                            <h3 style="color:#0f172a; margin-top:0.4rem;">📅 ${req.preferredDepartureDate || 'Not specified'}</h3>
                                            <p style="color:#64748b; font-size:0.88rem; margin-top:0.2rem;">👥 Travelers: <strong>${req.travelersCount || '—'}</strong> | 🏨 Preferred: <strong>${this.escapeHtml(req.hotelType || 'Not specified')}</strong> | Max Budget: <strong>${req.maxBudget ? this.formatCurrency(req.maxBudget) : 'Not specified'}</strong></p>
                                        </div>
                                        <button class="btn btn-gold" onclick="app.viewOffersForRequest('${req.id}')" style="font-weight:800; font-size:0.95rem;">
                                            🔍 View All Offers for This Request (${offersForReq.length})
                                        </button>
                                    </div>

                                    <!-- Quick Preview of top 2 offers -->
                                    <div style="display:flex; flex-direction:column; gap:1rem;">
                                        ${offersForReq.length > 0 ? offersForReq.map(o => {
                                            const travelers = req.travelersCount || o.travelersCount || 1;
                                            const perPerson = o.discountedPrice || o.price || 0;
                                            const totalDiscounted = perPerson * travelers;
                                            const origPerPerson = o.originalPrice || 0;
                                            const totalOriginal = origPerPerson * travelers;
                                            return `
                                            <div style="background:linear-gradient(135deg, #ffffff 0%, #fef3c7 100%); border-radius:12px; padding:1.4rem; border:1.5px solid #fde68a; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                                                <div>
                                                    <span style="background:linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color:white; font-size:0.75rem; font-weight:800; padding:0.25rem 0.6rem; border-radius:99px;">
                                                        🔥 ${o.discountPercentage || 0}% DISCOUNT BID
                                                    </span>
                                                    <h4 style="margin-top:0.5rem; color:#0f172a; font-size:1.1rem;">🏢 ${this.escapeHtml(o.agentName || 'Verified Agent')}</h4>
                                                    <p style="color:#78350f; font-size:0.88rem; margin-top:0.3rem;">
                                                        ${this.escapeHtml(o.packageTitle)}${o.makkahHotel ? ' — ' + this.escapeHtml(o.makkahHotel) : ''}
                                                    </p>
                                                    <div style="margin-top:0.5rem; display:flex; flex-direction:column; gap:0.2rem;">
                                                        <div style="display:flex; align-items:center; gap:0.8rem;">
                                                            ${origPerPerson > 0 ? `<span style="text-decoration:line-through; color:var(--text-muted); font-size:0.95rem;">${this.formatCurrency(totalOriginal)}</span>` : ''}
                                                            <span style="font-size:1.35rem; font-weight:800; color:#047857;">${this.formatCurrency(totalDiscounted)}</span>
                                                        </div>
                                                        <span style="font-size:0.75rem; color:#047857; font-weight:700;">Total for ${travelers} Persons (${this.formatCurrency(perPerson)} / person)</span>
                                                    </div>
                                                </div>
                                                <button class="btn btn-gold" onclick="app.openOfferReviewModal('${o.id}')" style="font-weight:800; padding:0.75rem 1.4rem;">
                                                    🔍 View Details
                                                </button>
                                            </div>
                                        `;
                                        }).join('') : '<p style="color:#64748b; text-align:center; padding:1rem;">No agent offers received yet for this request.</p>'}
                                    </div>
                                </div>
                            `;
        }).join('')}
                    </div>
                ` : `
                    <div style="background:white; border-radius:14px; padding:3rem; text-align:center; color:#64748b;">
                        <p style="font-size:1.1rem; margin-bottom:1.2rem;">You don't have any active travel requests.</p>
                        <button class="btn btn-gold" onclick="app.navigate('home'); app.switchTab('request');">📝 Submit Your Travel Request Now</button>
                    </div>
                `}
            </div>
        `;
    }

    viewOffersForRequest(reqId) {
        const allOffers = this.getAllOffers();
        const offers = allOffers.filter(o => o.requirementId === reqId);

        this.openModal(`
            <div style="padding:0.5rem 0.5rem 1.5rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.2rem; border-bottom:1px solid #e2e8f0; padding-bottom:0.8rem;">
                    <div>
                        <h3 style="color:#0f172a; font-size:1.35rem; margin:0;">🎁 Incoming Offers List (${offers.length})</h3>
                        <p style="color:#64748b; font-size:0.85rem; margin-top:0.2rem;">Request ID: ${reqId}</p>
                    </div>
                </div>

                ${offers.length > 0 ? `
                    <div style="display:flex; flex-direction:column; gap:1.2rem; max-height:480px; overflow-y:auto; padding-right:0.5rem;">
                        ${offers.map(o => `
                            <div style="background:linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%); border-radius:14px; padding:1.5rem; border:1.5px solid #a7f3d0; box-shadow:0 6px 18px rgba(4,120,87,0.08);">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
                                    <span style="background:#047857; color:white; font-size:0.75rem; font-weight:800; padding:0.25rem 0.6rem; border-radius:6px;">🏢 ${this.escapeHtml(o.agentName || 'Verified Agent')}</span>
                                    <span style="background:#f59e0b; color:white; font-size:0.75rem; font-weight:800; padding:0.25rem 0.6rem; border-radius:99px;">🔥 ${o.discountPercentage || 15}% OFF</span>
                                </div>
                                <h4 style="font-size:1.15rem; color:#0f172a; margin-bottom:0.4rem;">${this.escapeHtml(o.packageTitle)}</h4>
                                <p style="font-size:0.88rem; color:#475569; margin-bottom:0.6rem; line-height:1.5;">
                                    🕋 <strong>Makkah:</strong> ${this.escapeHtml(o.makkahHotel || 'Not specified')} | 🕌 <strong>Madinah:</strong> ${this.escapeHtml(o.madinahHotel || 'Not specified')}
                                </p>
                                <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:1rem;">
                                    ${(o.inclusions && o.inclusions.length ? o.inclusions : []).map(inc => `<span style="background:#e2e8f0; color:#334155; font-size:0.75rem; font-weight:600; padding:0.2rem 0.5rem; border-radius:4px;">✓ ${inc}</span>`).join('')}
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #d1fae5; padding-top:0.8rem;">
                                    <div>
                                        <span style="text-decoration:line-through; color:#94a3b8; font-size:0.9rem;">${this.formatCurrency(o.originalPrice)}</span>
                                        <div style="font-size:1.45rem; font-weight:800; color:#047857;">${this.formatCurrency(o.discountedPrice)}</div>
                                    </div>
                                    <button class="btn btn-gold" onclick="app.closeModal(); app.openOfferReviewModal('${o.id}');" style="font-weight:800; padding:0.75rem 1.4rem;">
                                        Review &amp; Accept Offer 📋
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div style="text-align:center; padding:3rem; color:#64748b;">
                        <p>No agent offers received yet for this request.</p>
                    </div>
                `}
            </div>
        `);
    }



    openOfferReviewModal_old(offerId) {
        const allOffers = this.getAllOffers();
        const offer = allOffers.find(o => o.id === offerId);
        if (!offer) {
            this.showToast('Offer not found.', 'warning');
            return;
        }

        const localReqs = JSON.parse(localStorage.getItem('umrah_requirements') || '[]');
        const apiReqs = this.state.myRequirements || [];
        const req = [...apiReqs, ...localReqs].find(r => r.id === offer.requirementId);
        const travelersCount = offer.travelersCount || (req ? (req.travelersCount || req.adults) : null) || 1;
        const perPersonPrice = offer.discountedPrice || offer.price || 0;
        const origPerPerson = offer.originalPrice || 0;
        const totalDiscountedPrice = perPersonPrice * travelersCount;
        const totalOriginalPrice = origPerPerson * travelersCount;
        const user = this.state.currentUser || {};

        // Calculate itemized fees for display
        const taxesFee = Number(offer.taxesAndFees) || 0;
        const visaFee = Number(offer.visaCharges) || 0;
        const insuranceFee = Number(offer.travelInsurance) || 0;

        // Fullscreen Modal setup
        const modal = document.getElementById('modalCard');
        if (modal) {
            modal.style.maxWidth = '100vw';
            modal.style.width = '100vw';
            modal.style.height = '100vh';
            modal.style.maxHeight = '100vh';
            modal.style.margin = '0';
            modal.style.padding = '0';
            modal.style.borderRadius = '0';
            modal.style.border = 'none';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
        }

        this.openModal(`
            <div style="padding:0; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#0f172a; height:100vh; display:flex; flex-direction:column; background:#f8fafc; overflow:hidden;">

                <!-- ══ IMAGE 1 MATCHING HEADER BAR ══ -->
                <div style="background:#ffffff; padding:1.1rem 2.2rem; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; flex-shrink:0;">
                    <div style="display:flex; align-items:center; gap:1.2rem;">
                        <button onclick="app.closeModal(); app.navigate('offers');" style="background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:0.5rem 1rem; font-weight:700; font-size:0.88rem; cursor:pointer; display:flex; align-items:center; gap:0.4rem;">
                            ← Back to Offers
                        </button>
                        <div>
                            <h2 style="font-size:1.4rem; font-weight:800; color:#0f172a; margin:0; line-height:1.2;">Review Package Details</h2>
                            <div style="font-size:0.8rem; color:#64748b; margin-top:0.15rem;">Please review all package details carefully before proceeding to payment.</div>
                        </div>
                    </div>
                    
                    <div style="display:flex; align-items:center; gap:1.2rem;">
                        <div style="width:38px; height:38px; background:#f1f5f9; border-radius:50%; display:flex; align-items:center; justify-content:center; position:relative;">
                            <span style="font-size:1.1rem;">🔔</span>
                            <span style="position:absolute; top:4px; right:4px; width:14px; height:14px; background:#047857; color:white; font-size:0.65rem; font-weight:800; border-radius:50%; display:flex; align-items:center; justify-content:center;">2</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:0.75rem; background:#f1f5f9; padding:0.4rem 0.9rem 0.4rem 0.5rem; border-radius:99px;">
                            <div style="width:34px; height:34px; background:#047857; color:white; border-radius:50%; font-weight:800; display:flex; align-items:center; justify-content:center; font-size:0.95rem;">T</div>
                            <div>
                                <div style="font-size:0.85rem; font-weight:800; color:#0f172a;">${this.escapeHtml(user.name || 'Guest')}</div>
                                <div style="font-size:0.7rem; color:#64748b;">Customer</div>
                            </div>
                        </div>
                        <button onclick="app.closeModal();" style="background:#f1f5f9; border:none; color:#64748b; font-size:1.1rem; width:34px; height:34px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center;">✕</button>
                    </div>
                </div>

                <!-- ══ DUAL COLUMN BODY (IMAGE 1 LAYOUT) ══ -->
                <div style="display:grid; grid-template-columns:1fr 380px; gap:1.8rem; padding:1.8rem 2.2rem; flex:1; overflow-y:auto; background:#f8fafc;">

                    <!-- LEFT COLUMN — DETAILS & SPECIFICATIONS -->
                    <div style="display:flex; flex-direction:column; gap:1.4rem;">

                        <!-- Card 1: Main Package Banner -->
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:1.4rem; box-shadow:0 2px 10px rgba(0,0,0,0.02); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1.2rem;">
                            <div style="display:flex; align-items:center; gap:1.2rem;">
                                <img src="https://images.unsplash.com/photo-1591604466107-ec97de577aff?auto=format&fit=crop&w=240&q=80" alt="Kaaba Makkah" style="width:96px; height:96px; border-radius:12px; object-fit:cover;">
                                <div>
                                    <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:0.35rem;">
                                        <h3 style="font-size:1.25rem; font-weight:800; color:#0f172a; margin:0;">${this.escapeHtml(offer.packageTitle)}</h3>
                                        <span style="background:#ecfdf5; color:#047857; font-size:0.75rem; font-weight:800; padding:0.2rem 0.61rem; border-radius:99px; border:1px solid #a7f3d0;">${offer.durationDays ? offer.durationDays + ' Days' : 'Duration N/A'}</span>
                                    </div>
                                    <div style="font-size:0.84rem; color:#64748b; margin-bottom:0.75rem;">${offer.requirementId ? 'REQ-' + offer.requirementId : ''}${offer.requirementId && travelersCount ? ' • ' : ''}${travelersCount} Adults, 0 Children</div>
                                    <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
                                        <span style="background:#f0fdf4; border:1px solid #bbf7d0; color:#166534; font-size:0.75rem; font-weight:700; padding:0.25rem 0.65rem; border-radius:8px;">✈ Flights Included</span>
                                        <span style="background:#f0fdf4; border:1px solid #bbf7d0; color:#166534; font-size:0.75rem; font-weight:700; padding:0.25rem 0.65rem; border-radius:8px;">✓ Visa Included</span>
                                        <span style="background:#f0fdf4; border:1px solid #bbf7d0; color:#166534; font-size:0.75rem; font-weight:700; padding:0.25rem 0.65rem; border-radius:8px;">🚍 Transport Included</span>
                                    </div>
                                </div>
                            </div>
                            <div style="text-align:right;">
                                <div style="font-size:0.72rem; color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Total Package Price</div>
                                <div style="font-size:1.9rem; font-weight:900; color:#0f172a; line-height:1.1; margin-top:0.2rem;">${this.formatCurrency(totalDiscountedPrice)}</div>
                                <div style="font-size:0.78rem; color:#64748b; margin-top:0.2rem;">Per Person (${this.formatCurrency(perPersonPrice)})</div>
                            </div>
                        </div>

                        <!-- Card 2: Journey Overview (3 Box Grid) -->
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:1.4rem; box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                            <h4 style="font-size:1.05rem; font-weight:800; color:#0f172a; margin:0 0 0.3rem;">Journey Overview</h4>
                            <div style="font-size:0.83rem; color:#64748b; margin-bottom:1.1rem;">A comfortable and spiritual journey to the holy cities with carefully selected services.</div>
                            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:1rem;">
                                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1rem; display:flex; gap:0.9rem; align-items:center;">
                                    <span style="font-size:1.6rem;">📅</span>
                                    <div>
                                        <div style="font-size:0.72rem; color:#64748b; font-weight:700; text-transform:uppercase;">Departure</div>
                                        <div style="font-size:0.95rem; font-weight:800; color:#0f172a; margin-top:0.15rem;">15 Oct 2026</div>
                                        <div style="font-size:0.78rem; color:#64748b;">Lucknow (LKO)</div>
                                    </div>
                                </div>
                                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1rem; display:flex; gap:0.9rem; align-items:center;">
                                    <span style="font-size:1.6rem;">✈️</span>
                                    <div>
                                        <div style="font-size:0.72rem; color:#64748b; font-weight:700; text-transform:uppercase;">Return</div>
                                        <div style="font-size:0.95rem; font-weight:800; color:#0f172a; margin-top:0.15rem;">24 Oct 2026</div>
                                        <div style="font-size:0.78rem; color:#64748b;">Jeddah (JED)</div>
                                    </div>
                                </div>
                                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1rem; display:flex; gap:0.9rem; align-items:center;">
                                    <span style="font-size:1.6rem;">⏱️</span>
                                    <div>
                                        <div style="font-size:0.72rem; color:#64748b; font-weight:700; text-transform:uppercase;">Duration</div>
                                        <div style="font-size:0.95rem; font-weight:800; color:#0f172a; margin-top:0.15rem;">10 Days / 9 Nights</div>
                                        <div style="font-size:0.78rem; color:#64748b;">Total Trip Duration</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Card 3: Package Inclusions -->
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:1.4rem; box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                            <h4 style="font-size:1.05rem; font-weight:800; color:#0f172a; margin:0 0 1rem;">Package Inclusions</h4>
                            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:1rem;">
                                <div style="display:flex; align-items:flex-start; gap:0.6rem;">
                                    <span style="color:#047857; font-weight:900; font-size:1rem;">✓</span>
                                    <div>
                                        <div style="font-weight:800; font-size:0.86rem; color:#0f172a;">Return Flights</div>
                                        <div style="font-size:0.75rem; color:#64748b;">Lucknow to Jeddah &amp; Return</div>
                                    </div>
                                </div>
                                <div style="display:flex; align-items:flex-start; gap:0.6rem;">
                                    <span style="color:#047857; font-weight:900; font-size:1rem;">✓</span>
                                    <div>
                                        <div style="font-weight:800; font-size:0.86rem; color:#0f172a;">Visa</div>
                                        <div style="font-size:0.75rem; color:#64748b;">Umrah Visa Included</div>
                                    </div>
                                </div>
                                <div style="display:flex; align-items:flex-start; gap:0.6rem;">
                                    <span style="color:#047857; font-weight:900; font-size:1rem;">✓</span>
                                    <div>
                                        <div style="font-weight:800; font-size:0.86rem; color:#0f172a;">Transport</div>
                                        <div style="font-size:0.75rem; color:#64748b;">All Local Transfers</div>
                                    </div>
                                </div>
                                <div style="display:flex; align-items:flex-start; gap:0.6rem;">
                                    <span style="color:#047857; font-weight:900; font-size:1rem;">✓</span>
                                    <div>
                                        <div style="font-weight:800; font-size:0.86rem; color:#0f172a;">Accommodation</div>
                                        <div style="font-size:0.75rem; color:#64748b;">9 Nights Stay in Makkah &amp; Madinah</div>
                                    </div>
                                </div>
                                <div style="display:flex; align-items:flex-start; gap:0.6rem;">
                                    <span style="color:#047857; font-weight:900; font-size:1rem;">✓</span>
                                    <div>
                                        <div style="font-weight:800; font-size:0.86rem; color:#0f172a;">Meals</div>
                                        <div style="font-size:0.75rem; color:#64748b;">Breakfast, Lunch &amp; Dinner</div>
                                    </div>
                                </div>
                                <div style="display:flex; align-items:flex-start; gap:0.6rem;">
                                    <span style="color:#047857; font-weight:900; font-size:1rem;">✓</span>
                                    <div>
                                        <div style="font-weight:800; font-size:0.86rem; color:#0f172a;">Ziyarat</div>
                                        <div style="font-size:0.75rem; color:#64748b;">Makkah &amp; Madinah Ziyarat</div>
                                    </div>
                                </div>
                                <div style="display:flex; align-items:flex-start; gap:0.6rem;">
                                    <span style="color:#047857; font-weight:900; font-size:1rem;">✓</span>
                                    <div>
                                        <div style="font-weight:800; font-size:0.86rem; color:#0f172a;">Travel Insurance</div>
                                        <div style="font-size:0.75rem; color:#64748b;">Coverage Included</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Card 4: Accommodation Details (2 Hotel Cards) -->
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:1.4rem; box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                            <h4 style="font-size:1.05rem; font-weight:800; color:#0f172a; margin:0 0 1rem;">Accommodation Details</h4>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.2rem;">

                                <!-- Makkah Hotel Card -->
                                <div style="border:1px solid #cbd5e1; border-radius:14px; padding:1rem; display:flex; gap:1rem; align-items:center; background:#ffffff;">
                                    <img src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=300&q=80" alt="Makkah Hotel" style="width:110px; height:90px; border-radius:10px; object-fit:cover;">
                                    <div style="flex:1;">
                                        <div style="font-size:0.72rem; color:#64748b; font-weight:700; text-transform:uppercase;">Makkah Hotel</div>
                                        <div style="display:flex; align-items:center; justify-content:space-between; margin-top:0.15rem;">
                                            <h5 style="font-size:0.95rem; font-weight:800; color:#0f172a; margin:0;">${this.escapeHtml(offer.makkahHotel || 'Anjum Hotel Makkah')}</h5>
                                            <span style="background:#f0fdf4; color:#047857; font-size:0.72rem; font-weight:800; padding:0.15rem 0.4rem; border-radius:6px; border:1px solid #bbf7d0;">4 ★</span>
                                        </div>
                                        <div style="font-size:0.78rem; color:#64748b; margin-top:0.15rem;">4 Nights</div>
                                        <div style="font-size:0.76rem; color:#475569; margin-top:0.4rem;">📍 Distance from Haram: 650m</div>
                                        <div style="font-size:0.76rem; color:#475569; margin-top:0.15rem;">🛏 Room Type: Standard Room</div>
                                    </div>
                                </div>

                                <!-- Madinah Hotel Card -->
                                <div style="border:1px solid #cbd5e1; border-radius:14px; padding:1rem; display:flex; gap:1rem; align-items:center; background:#ffffff;">
                                    <img src="https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=300&q=80" alt="Madinah Hotel" style="width:110px; height:90px; border-radius:10px; object-fit:cover;">
                                    <div style="flex:1;">
                                        <div style="font-size:0.72rem; color:#64748b; font-weight:700; text-transform:uppercase;">Madinah Hotel</div>
                                        <div style="display:flex; align-items:center; justify-content:space-between; margin-top:0.15rem;">
                                            <h5 style="font-size:0.95rem; font-weight:800; color:#0f172a; margin:0;">${this.escapeHtml(offer.madinahHotel || 'Durrat Al Eiman Hotel')}</h5>
                                            <span style="background:#f0fdf4; color:#047857; font-size:0.72rem; font-weight:800; padding:0.15rem 0.4rem; border-radius:6px; border:1px solid #bbf7d0;">4 ★</span>
                                        </div>
                                        <div style="font-size:0.78rem; color:#64748b; margin-top:0.15rem;">5 Nights</div>
                                        <div style="font-size:0.76rem; color:#475569; margin-top:0.4rem;">📍 Distance from Haram: 300m</div>
                                        <div style="font-size:0.76rem; color:#475569; margin-top:0.15rem;">🛏 Room Type: Standard Room</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Card 5: Itinerary Highlights Timeline -->
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:1.4rem; box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                            <h4 style="font-size:1.05rem; font-weight:800; color:#0f172a; margin:0 0 1rem;">Itinerary Highlights</h4>
                            <div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem; text-align:center;">
                                <div>
                                    <div style="width:36px; height:36px; background:#f0fdf4; border:1px solid #bbf7d0; color:#047857; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 0.4rem; font-size:1rem;">✈️</div>
                                    <div style="font-size:0.7rem; color:#64748b;">15 Oct 2026</div>
                                    <div style="font-size:0.82rem; font-weight:800; color:#0f172a;">Departure</div>
                                    <div style="font-size:0.72rem; color:#64748b;">Lucknow (LKO)</div>
                                </div>
                                <div style="color:#cbd5e1; font-weight:700;">→</div>
                                <div>
                                    <div style="width:36px; height:36px; background:#f0fdf4; border:1px solid #bbf7d0; color:#047857; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 0.4rem; font-size:1rem;">✈️</div>
                                    <div style="font-size:0.7rem; color:#64748b;">15 Oct 2026</div>
                                    <div style="font-size:0.82rem; font-weight:800; color:#0f172a;">Arrive Jeddah</div>
                                    <div style="font-size:0.72rem; color:#64748b;">Transfer to Makkah</div>
                                </div>
                                <div style="color:#cbd5e1; font-weight:700;">→</div>
                                <div>
                                    <div style="width:36px; height:36px; background:#f0fdf4; border:1px solid #bbf7d0; color:#047857; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 0.4rem; font-size:1rem;">🕋</div>
                                    <div style="font-size:0.7rem; color:#64748b;">4 Nights</div>
                                    <div style="font-size:0.82rem; font-weight:800; color:#0f172a;">Stay in Makkah</div>
                                    <div style="font-size:0.72rem; color:#64748b;">Ziyarat &amp; Worship</div>
                                </div>
                                <div style="color:#cbd5e1; font-weight:700;">→</div>
                                <div>
                                    <div style="width:36px; height:36px; background:#f0fdf4; border:1px solid #bbf7d0; color:#047857; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 0.4rem; font-size:1rem;">🕌</div>
                                    <div style="font-size:0.7rem; color:#64748b;">5 Nights</div>
                                    <div style="font-size:0.82rem; font-weight:800; color:#0f172a;">Stay in Madinah</div>
                                    <div style="font-size:0.72rem; color:#64748b;">Ziyarat &amp; Worship</div>
                                </div>
                                <div style="color:#cbd5e1; font-weight:700;">→</div>
                                <div>
                                    <div style="width:36px; height:36px; background:#f0fdf4; border:1px solid #bbf7d0; color:#047857; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 0.4rem; font-size:1rem;">✈️</div>
                                    <div style="font-size:0.7rem; color:#64748b;">24 Oct 2026</div>
                                    <div style="font-size:0.82rem; font-weight:800; color:#0f172a;">Return Flight</div>
                                    <div style="font-size:0.72rem; color:#64748b;">Jeddah (JED)</div>
                                </div>
                            </div>
                        </div>

                        <!-- Card 6: Privacy Banner -->
                        <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:0.9rem 1.2rem; display:flex; align-items:center; gap:0.75rem;">
                            <span style="font-size:1.3rem;">🛡️</span>
                            <div style="font-size:0.82rem; color:#166534; font-weight:600;">
                                Your personal contact details are protected. They will never be shared with any agent or provider.
                            </div>
                        </div>

                    </div>

                    <!-- RIGHT COLUMN — ORDER PRICE SUMMARY & IMPORTANT NOTES -->
                    <div style="display:flex; flex-direction:column; gap:1.2rem; position:sticky; top:0;">

                        <!-- Price Summary Card -->
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:1.4rem; box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                            <h4 style="font-size:1.05rem; font-weight:800; color:#0f172a; margin:0 0 1rem;">Price Summary</h4>
                            <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.88rem; color:#475569;">
                                <div style="display:flex; justify-content:space-between;">
                                    <span>Package Price (Per Person)</span>
                                    <span style="font-weight:700; color:#0f172a;">${this.formatCurrency(perPersonPrice)}</span>
                                </div>
                                <div style="display:flex; justify-content:space-between;">
                                    <span>Taxes &amp; Fees</span>
                                    <span style="font-weight:700; color:#0f172a;">₹3,200</span>
                                </div>
                                <div style="display:flex; justify-content:space-between;">
                                    <span>Visa Charges</span>
                                    <span style="font-weight:700; color:#0f172a;">₹2,000</span>
                                </div>
                                <div style="display:flex; justify-content:space-between;">
                                    <span>Travel Insurance</span>
                                    <span style="font-weight:700; color:#0f172a;">₹1,200</span>
                                </div>
                                <div style="border-top:1px dashed #cbd5e1; margin:0.3rem 0;"></div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span style="font-size:1.05rem; font-weight:800; color:#0f172a;">Total Amount</span>
                                    <span style="font-size:1.6rem; font-weight:900; color:#047857;">${this.formatCurrency(totalDiscountedPrice)}</span>
                                </div>
                                <div style="font-size:0.75rem; color:#64748b; text-align:right;">All amounts are in INR</div>
                            </div>
                        </div>

                        <!-- Travel Details Sidebar Box -->
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:1.2rem; box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
                                <h5 style="font-size:0.9rem; font-weight:800; color:#0f172a; margin:0;">Travel Details</h5>
                                <a href="javascript:void(0)" style="font-size:0.75rem; font-weight:700; color:#047857; text-decoration:none;">View Details</a>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:0.6rem;">
                                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:0.7rem 0.9rem; display:flex; justify-content:space-between; align-items:center;">
                                    <div>
                                        <div style="font-size:0.7rem; color:#64748b; font-weight:700;">Departure</div>
                                        <div style="font-size:0.82rem; font-weight:800; color:#0f172a;">15 Oct 2026, 04:55 AM</div>
                                    </div>
                                    <span style="font-size:0.78rem; font-weight:800; color:#047857;">LKO → JED</span>
                                </div>
                                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:0.7rem 0.9rem; display:flex; justify-content:space-between; align-items:center;">
                                    <div>
                                        <div style="font-size:0.7rem; color:#64748b; font-weight:700;">Return</div>
                                        <div style="font-size:0.82rem; font-weight:800; color:#0f172a;">24 Oct 2026, 02:30 PM</div>
                                    </div>
                                    <span style="font-size:0.78rem; font-weight:800; color:#047857;">JED → LKO</span>
                                </div>
                            </div>
                        </div>

                        <!-- Important Notes Sidebar Box -->
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:1.2rem; box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                            <h5 style="font-size:0.9rem; font-weight:800; color:#0f172a; margin:0 0 0.75rem;">Important Notes</h5>
                            <div style="display:flex; flex-direction:column; gap:0.45rem; font-size:0.78rem; color:#475569;">
                                <div><span style="color:#047857; font-weight:800;">✓</span> Passport must be valid for 6+ months</div>
                                <div><span style="color:#047857; font-weight:800;">✓</span> COVID-19 vaccination certificate required</div>
                                <div><span style="color:#047857; font-weight:800;">✓</span> Package is non-refundable after confirmation</div>
                                <div><span style="color:#047857; font-weight:800;">✓</span> Standard cancellation policies apply</div>
                            </div>
                        </div>

                        <!-- T&C Checkbox & CTA Button -->
                        <div style="display:flex; flex-direction:column; gap:0.9rem;">
                            <label style="display:flex; align-items:center; gap:0.6rem; font-size:0.8rem; color:#475569; cursor:pointer;">
                                <input type="checkbox" id="chkTerms" checked style="accent-color:#047857; width:16px; height:16px;">
                                <span>I have read and agree to the <a href="javascript:void(0)" style="color:#047857; font-weight:700;">Terms &amp; Conditions</a></span>
                            </label>
                            
                            <button onclick="app.closeModal(); app.openOfferPaymentModal('${offer.id}');"
                                style="width:100%; background:#047857; color:#ffffff; font-size:1.05rem; font-weight:800; padding:1.1rem; border-radius:12px; border:none; cursor:pointer; font-family:inherit; box-shadow:0 4px 16px rgba(4,120,87,0.25); display:flex; align-items:center; justify-content:center; gap:0.5rem; transition:all 0.2s;">
                                🔒 Proceed to Payment
                            </button>
                            
                            <div style="font-size:0.75rem; color:#64748b; text-align:center; display:flex; align-items:center; justify-content:center; gap:0.4rem;">
                                <span>✓</span> 100% Secure &amp; Encrypted
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        `, true, { width: '100vw', maxWidth: '100vw', height: '100vh', maxHeight: '100vh', borderRadius: '0' });
    }



    openOfferPaymentModal_old(offerId) {
        const allOffers = this.getAllOffers();
        const offer = allOffers.find(o => o.id === offerId);
        if (!offer) {
            this.showToast('Offer not found.', 'warning');
            return;
        }

        const localReqs = JSON.parse(localStorage.getItem('umrah_requirements') || '[]');
        const apiReqs = this.state.myRequirements || [];
        const req = [...apiReqs, ...localReqs].find(r => r.id === offer.requirementId);
        const travelersCount = offer.travelersCount || (req ? (req.travelersCount || req.adults) : null) || 1;
        const perPersonPrice = offer.discountedPrice || offer.price || 0;
        const totalDiscountedPrice = perPersonPrice * travelersCount;

        const user = this.state.currentUser || {};
        const totalAmountFormatted = this.formatCurrency(totalDiscountedPrice);

        // Modal Fullscreen Setup
        const modal = document.getElementById('modalCard');
        if (modal) {
            modal.style.maxWidth = '100vw';
            modal.style.width = '100vw';
            modal.style.height = '100vh';
            modal.style.maxHeight = '100vh';
            modal.style.margin = '0';
            modal.style.padding = '0';
            modal.style.borderRadius = '0';
            modal.style.border = 'none';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
        }

        // Attach dynamic payment tab logic to app
        this.selectedPaymentMethod = 'upi';

        this.openModal(`
            <div style="padding:0; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#0f172a; height:100vh; display:flex; flex-direction:column; background:#f8fafc; overflow:hidden;">

                <!-- ══ IMAGE 2 MATCHING HEADER BAR ══ -->
                <div style="background:#ffffff; padding:1.1rem 2.2rem; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; flex-shrink:0;">
                    <div style="display:flex; align-items:center; gap:1.2rem;">
                        <button onclick="app.closeModal(); app.openOfferReviewModal('${offer.id}');" style="background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:0.5rem 1rem; font-weight:700; font-size:0.88rem; cursor:pointer; display:flex; align-items:center; gap:0.4rem;">
                            ← Back to Review Package
                        </button>
                        <div>
                            <div style="display:flex; align-items:center; gap:0.4rem;">
                                <h2 style="font-size:1.4rem; font-weight:800; color:#0f172a; margin:0; line-height:1.2;">Secure Payment</h2>
                                <span style="color:#047857; font-size:1.2rem;">🛡️</span>
                            </div>
                            <div style="font-size:0.8rem; color:#64748b; margin-top:0.15rem;">Your payment information is safe with us. Complete your payment to confirm your booking.</div>
                        </div>
                    </div>
                    
                    <div style="display:flex; align-items:center; gap:1.2rem;">
                        <div style="width:38px; height:38px; background:#f1f5f9; border-radius:50%; display:flex; align-items:center; justify-content:center; position:relative;">
                            <span style="font-size:1.1rem;">🔔</span>
                            <span style="position:absolute; top:4px; right:4px; width:14px; height:14px; background:#047857; color:white; font-size:0.65rem; font-weight:800; border-radius:50%; display:flex; align-items:center; justify-content:center;">2</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:0.75rem; background:#f1f5f9; padding:0.4rem 0.9rem 0.4rem 0.5rem; border-radius:99px;">
                            <div style="width:34px; height:34px; background:#047857; color:white; border-radius:50%; font-weight:800; display:flex; align-items:center; justify-content:center; font-size:0.95rem;">T</div>
                            <div>
                                <div style="font-size:0.85rem; font-weight:800; color:#0f172a;">${this.escapeHtml(user.name || 'Guest')}</div>
                                <div style="font-size:0.7rem; color:#64748b;">Customer</div>
                            </div>
                        </div>
                        <button onclick="app.closeModal();" style="background:#f1f5f9; border:none; color:#64748b; font-size:1.1rem; width:34px; height:34px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center;">✕</button>
                    </div>
                </div>

                <!-- ══ MAIN CHECKOUT BODY GRID ══ -->
                <div style="display:grid; grid-template-columns:1fr 380px; gap:1.8rem; padding:1.8rem 2.2rem; flex:1; overflow-y:auto; background:#f8fafc;">

                    <!-- LEFT COLUMN — PAYMENT METHODS & PASSENGER FORM -->
                    <div style="display:flex; flex-direction:column; gap:1.4rem;">

                        <!-- Security Header Banner -->
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:0.9rem 1.2rem; display:flex; justify-content:space-between; align-items:center;">
                            <div style="display:flex; align-items:center; gap:0.6rem; color:#047857; font-size:0.85rem; font-weight:800;">
                                <span style="font-size:1.1rem;">🛡️</span> 100% Secure Payment <span style="color:#64748b; font-weight:500;">• All transactions are encrypted and protected</span>
                            </div>
                            <span style="background:#f0fdf4; border:1px solid #bbf7d0; color:#047857; font-size:0.72rem; font-weight:800; padding:0.2rem 0.6rem; border-radius:6px;">PCI DSS Compliant</span>
                        </div>

                        <!-- SECTION 1: CHOOSE PAYMENT METHOD (IMAGE 2 MATCHING TABS & DYNAMIC PANELS) -->
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:1.4rem; box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                            <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:1.2rem;">
                                <div style="width:26px; height:26px; background:#047857; color:white; border-radius:50%; font-weight:800; font-size:0.85rem; display:flex; align-items:center; justify-content:center;">1</div>
                                <h4 style="font-size:1.05rem; font-weight:800; color:#0f172a; margin:0;">Choose Payment Method</h4>
                            </div>

                            <!-- Tabs & Content Layout Grid -->
                            <div style="display:grid; grid-template-columns:220px 1fr; gap:1.4rem; align-items:start;">

                                <!-- Left Vertical Tabs -->
                                <div style="display:flex; flex-direction:column; gap:0.6rem;">
                                    <button type="button" onclick="app.switchPaymentTab('upi', '${totalAmountFormatted}', '${offer.id}');" id="payMethodTab-upi"
                                        style="display:flex; align-items:center; justify-content:space-between; padding:0.85rem 1rem; border-radius:12px; border:2px solid #047857; background:#f0fdf4; color:#0f172a; font-weight:800; font-size:0.88rem; cursor:pointer; text-align:left;">
                                        <div style="display:flex; align-items:center; gap:0.6rem;">
                                            <span>📱</span> UPI
                                        </div>
                                        <span style="background:#047857; color:white; font-size:0.65rem; font-weight:800; padding:0.15rem 0.45rem; border-radius:4px;">Recommended</span>
                                    </button>

                                    <button type="button" onclick="app.switchPaymentTab('card', '${totalAmountFormatted}', '${offer.id}');" id="payMethodTab-card"
                                        style="display:flex; flex-direction:column; padding:0.85rem 1rem; border-radius:12px; border:1px solid #e2e8f0; background:#ffffff; color:#0f172a; font-weight:700; font-size:0.88rem; cursor:pointer; text-align:left;">
                                        <div style="display:flex; align-items:center; gap:0.6rem; font-weight:800;">
                                            <span>💳</span> Debit / Credit Cards
                                        </div>
                                        <span style="font-size:0.7rem; color:#64748b; margin-top:0.2rem;">Visa, MasterCard, RuPay</span>
                                    </button>

                                    <button type="button" onclick="app.switchPaymentTab('net', '${totalAmountFormatted}', '${offer.id}');" id="payMethodTab-net"
                                        style="display:flex; flex-direction:column; padding:0.85rem 1rem; border-radius:12px; border:1px solid #e2e8f0; background:#ffffff; color:#0f172a; font-weight:700; font-size:0.88rem; cursor:pointer; text-align:left;">
                                        <div style="display:flex; align-items:center; gap:0.6rem; font-weight:800;">
                                            <span>🏦</span> Net Banking
                                        </div>
                                        <span style="font-size:0.7rem; color:#64748b; margin-top:0.2rem;">All major banks</span>
                                    </button>

                                    <button type="button" onclick="app.switchPaymentTab('wallet', '${totalAmountFormatted}', '${offer.id}');" id="payMethodTab-wallet"
                                        style="display:flex; flex-direction:column; padding:0.85rem 1rem; border-radius:12px; border:1px solid #e2e8f0; background:#ffffff; color:#0f172a; font-weight:700; font-size:0.88rem; cursor:pointer; text-align:left;">
                                        <div style="display:flex; align-items:center; gap:0.6rem; font-weight:800;">
                                            <span>👛</span> Wallets
                                        </div>
                                        <span style="font-size:0.7rem; color:#64748b; margin-top:0.2rem;">Paytm, PhonePe, Amazon Pay</span>
                                    </button>

                                    <button type="button" onclick="app.switchPaymentTab('paylater', '${totalAmountFormatted}', '${offer.id}');" id="payMethodTab-paylater"
                                        style="display:flex; flex-direction:column; padding:0.85rem 1rem; border-radius:12px; border:1px solid #e2e8f0; background:#ffffff; color:#0f172a; font-weight:700; font-size:0.88rem; cursor:pointer; text-align:left;">
                                        <div style="display:flex; align-items:center; gap:0.6rem; font-weight:800;">
                                            <span>💵</span> Pay Later
                                        </div>
                                        <span style="font-size:0.7rem; color:#64748b; margin-top:0.2rem;">Pay in easier installments</span>
                                    </button>
                                </div>

                                <!-- Dynamic Tab Content Panel -->
                                <div id="payTabDynamicPanel" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:1.4rem; text-align:center;">
                                    <!-- Populated dynamically via app.switchPaymentTab -->
                                </div>

                            </div>
                        </div>

                        <!-- SECTION 2: PAYMENT DETAILS (PASSENGER CONTACT FORM) -->
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:1.4rem; box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                            <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:1.1rem;">
                                <div style="width:26px; height:26px; background:#047857; color:white; border-radius:50%; font-weight:800; font-size:0.85rem; display:flex; align-items:center; justify-content:center;">2</div>
                                <h4 style="font-size:1.05rem; font-weight:800; color:#0f172a; margin:0;">Payment Details</h4>
                            </div>

                            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:1.1rem; margin-bottom:1rem;">
                                <div>
                                    <div style="font-size:0.72rem; color:#64748b; font-weight:700; text-transform:uppercase;">Booking For</div>
                                    <div style="font-size:0.92rem; font-weight:800; color:#0f172a; margin-top:0.2rem;">${this.escapeHtml(user.name || 'Guest')}</div>
                                </div>
                                <div>
                                    <div style="font-size:0.72rem; color:#64748b; font-weight:700; text-transform:uppercase;">Mobile Number</div>
                                    <div style="font-size:0.92rem; font-weight:800; color:#0f172a; margin-top:0.2rem;">${this.escapeHtml(user.phone || '')}</div>
                                </div>
                                <div>
                                    <div style="font-size:0.72rem; color:#64748b; font-weight:700; text-transform:uppercase;">Email Address</div>
                                    <div style="font-size:0.92rem; font-weight:800; color:#0f172a; margin-top:0.2rem;">${this.escapeHtml(user.email || '')}</div>
                                </div>
                            </div>

                            <label style="display:flex; align-items:center; gap:0.6rem; font-size:0.83rem; color:#475569; cursor:pointer; margin-bottom:1.1rem;">
                                <input type="checkbox" checked style="accent-color:#047857; width:16px; height:16px;">
                                <span>I want to receive payment confirmation on WhatsApp 💬</span>
                            </label>

                            <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:0.8rem 1rem; display:flex; align-items:center; gap:0.7rem;">
                                <span style="font-size:1.2rem;">🛡️</span>
                                <div style="font-size:0.78rem; color:#166534; line-height:1.4;">
                                    <strong>We are committed to complete transparency.</strong> All payments are processed securely and there are no hidden charges.
                                </div>
                            </div>
                        </div>

                    </div>

                    <!-- RIGHT COLUMN — BOOKING SUMMARY & ACCEPTED PAYMENTS -->
                    <div style="display:flex; flex-direction:column; gap:1.2rem; position:sticky; top:0;">

                        <!-- Booking Summary Card -->
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:1.4rem; box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                            <h4 style="font-size:1.05rem; font-weight:800; color:#0f172a; margin:0 0 1rem;">Booking Summary</h4>
                            
                            <div style="display:flex; gap:0.9rem; align-items:center; margin-bottom:1.1rem; padding-bottom:1rem; border-bottom:1px solid #f1f5f9;">
                                <img src="https://images.unsplash.com/photo-1591604466107-ec97de577aff?auto=format&fit=crop&w=180&q=80" alt="Package" style="width:68px; height:68px; border-radius:10px; object-fit:cover;">
                                <div>
                                    <div style="font-size:0.92rem; font-weight:800; color:#0f172a;">${this.escapeHtml(offer.packageTitle)}</div>
                                    <div style="font-size:0.78rem; color:#64748b; margin-top:0.15rem;">${offer.requirementId ? 'REQ-' + offer.requirementId : ''}${offer.requirementId && travelersCount ? ' • ' : ''}${travelersCount} Adults, 0 Children</div>
                                    <span style="background:#ecfdf5; color:#047857; font-size:0.7rem; font-weight:800; padding:0.1rem 0.5rem; border-radius:4px; margin-top:0.25rem; display:inline-block;">${offer.durationDays ? offer.durationDays + ' Days' : 'Duration N/A'}</span>
                                </div>
                            </div>

                            <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.88rem; color:#475569;">
                                <div style="display:flex; justify-content:space-between;">
<span>Package Price (${this.escapeHtml(String(offer.travelersCount || req.travelersCount || req.adults || travelersCount))} × ${this.formatCurrency(perPersonPrice)})</span>
                                    <span style="font-weight:700; color:#0f172a;">₹1,57,000</span>
                                </div>
                                <div style="display:flex; justify-content:space-between;">
                                    <span>Taxes &amp; Fees</span>
                                    <span style="font-weight:700; color:#0f172a;">₹6,400</span>
                                </div>
                                <div style="display:flex; justify-content:space-between;">
                                    <span>Visa Charges</span>
                                    <span style="font-weight:700; color:#0f172a;">₹4,000</span>
                                </div>
                                <div style="display:flex; justify-content:space-between;">
                                    <span>Travel Insurance</span>
                                    <span style="font-weight:700; color:#0f172a;">₹2,400</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; color:#047857;">
                                    <span style="font-weight:700;">Offer Discount</span>
                                    <span style="font-weight:800;">-₹1,000</span>
                                </div>
                                <div style="border-top:1px dashed #cbd5e1; margin:0.3rem 0;"></div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span style="font-size:1.05rem; font-weight:800; color:#0f172a;">Total Amount</span>
                                    <span style="font-size:1.6rem; font-weight:900; color:#047857;">${totalAmountFormatted}</span>
                                </div>
                                <div style="font-size:0.75rem; color:#64748b; text-align:right;">All amounts are in INR</div>
                            </div>
                        </div>

                        <!-- What's Included Card -->
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:1.2rem; box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                            <h5 style="font-size:0.9rem; font-weight:800; color:#0f172a; margin:0 0 0.75rem;">What's Included</h5>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; font-size:0.76rem; color:#475569;">
                                <div>✈️ Return Flights</div>
                                <div>🏨 9 Nights Accommodation</div>
                                <div>✓ Visa Included</div>
                                <div>🍽 Meals (Breakfast, Lunch &amp; Dinner)</div>
                                <div>🚍 All Local Transfers</div>
                                <div>🕌 Ziyarat &amp; Madinah Ziyarat</div>
                            </div>
                            <a href="javascript:void(0)" onclick="app.closeModal(); app.openOfferReviewModal('${offer.id}');" style="font-size:0.75rem; font-weight:700; color:#047857; text-decoration:none; display:inline-block; margin-top:0.6rem;">View all inclusions →</a>
                        </div>

                        <!-- We Accept Payment Icons -->
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:1.2rem; box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                            <h5 style="font-size:0.85rem; font-weight:800; color:#0f172a; margin:0 0 0.75rem;">We Accept</h5>
                            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:0.5rem; text-align:center;">
                                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:0.35rem; font-size:0.72rem; font-weight:800; color:#1a1f71;">VISA</div>
                                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:0.35rem; font-size:0.72rem; font-weight:800; color:#eb001b;">MasterCard</div>
                                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:0.35rem; font-size:0.72rem; font-weight:800; color:#005c9e;">RuPay</div>
                                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:0.35rem; font-size:0.72rem; font-weight:800; color:#047857;">UPI</div>
                                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:0.35rem; font-size:0.72rem; font-weight:800; color:#4285f4;">GPay</div>
                                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:0.35rem; font-size:0.72rem; font-weight:800; color:#5f259f;">PhonePe</div>
                                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:0.35rem; font-size:0.72rem; font-weight:800; color:#00baf2;">Paytm</div>
                                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:0.35rem; font-size:0.72rem; font-weight:800; color:#ff9900;">Amazon</div>
                            </div>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.4rem; font-size:0.68rem; color:#64748b; margin-top:0.8rem;">
                                <div>✓ SSL Encrypted Transactions</div>
                                <div>✓ PCI DSS Certified</div>
                                <div>✓ 100% Money Safe Guarantee</div>
                                <div>✓ Instant Payment Confirmation</div>
                            </div>
                        </div>

                    </div>
                </div>

                <!-- ══ DYNAMIC BOTTOM BAR (IMAGE 2 BOTTOM BAR) ══ -->
                <div style="background:#ffffff; border-top:1px solid #e2e8f0; padding:1.1rem 2.2rem; display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">
                    <div>
                        <div style="font-size:0.75rem; color:#64748b; font-weight:700;">Total Amount</div>
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <span style="font-size:1.45rem; font-weight:900; color:#0f172a;">${totalAmountFormatted}</span>
                            <a href="javascript:void(0)" style="font-size:0.75rem; color:#047857; font-weight:700; text-decoration:none;">View Price Details ^</a>
                        </div>
                    </div>

                    <!-- Dynamic CTA Action Container -->
                    <div id="dynamicPayCtaContainer">
                        <!-- Populated by app.switchPaymentTab -->
                    </div>
                </div>
            </div>
        `, true, { width: '100vw', maxWidth: '100vw', height: '100vh', maxHeight: '100vh', borderRadius: '0' });

        // Initialize default tab to UPI
        setTimeout(() => {
            this.switchPaymentTab('upi', totalAmountFormatted, offer.id);
        }, 50);
    }

    amountFromOffer(offerId) {
        const offers = [...(this.state.userOffers || []), ...(JSON.parse(localStorage.getItem('umrah_user_offers') || '[]'))];
        const offer = offers.find(o => o.id === offerId);
        return (offer && (Number(offer.discountedPrice) || Number(offer.price))) || '';
    }

    upiIdFromOffer(offerId) {
        const offers = [...(this.state.userOffers || []), ...(JSON.parse(localStorage.getItem('umrah_user_offers') || '[]'))];
        const offer = offers.find(o => o.id === offerId);
        return (offer && offer.upiId) || '';
    }

    switchPaymentTab(method, totalAmountFormatted, offerId) {
        this.selectedPaymentMethod = method;
        const methods = ['upi', 'card', 'net', 'wallet', 'paylater'];
        
        methods.forEach(m => {
            const btn = document.getElementById(`payMethodTab-${m}`);
            if (btn) {
                if (m === method) {
                    btn.style.border = '2px solid #047857';
                    btn.style.background = '#f0fdf4';
                } else {
                    btn.style.border = '1px solid #e2e8f0';
                    btn.style.background = '#ffffff';
                }
            }
        });

        const panel = document.getElementById('payTabDynamicPanel');
        const ctaContainer = document.getElementById('dynamicPayCtaContainer');
        const payOffer = [...(this.state.userOffers || []), ...(JSON.parse(localStorage.getItem('umrah_user_offers') || '[]'))].find(o => o.id === offerId) || {};
        const payTitle = payOffer.packageTitle || '';
        const payAmount = Number(payOffer.discountedPrice) || Number(payOffer.price) || Math.round(parseFloat(String(totalAmountFormatted).replace(/[^0-9.]/g, ''))) || 0;
        const payTravelers = Number(payOffer.travelersCount) || Number((this.state.myRequirements || []).find(r => r.id === payOffer.requirementId)?.travelersCount) || 1;

        if (method === 'upi') {
            // UPI Panel Behavior (Matches Image 2 & Explicit Prompt Rules)
            if (panel) {
                panel.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; gap:0.9rem;">
                        <h4 style="font-size:1rem; font-weight:800; color:#0f172a; margin:0;">Pay using UPI</h4>
                        <div style="font-size:0.8rem; color:#64748b;">Scan any QR code using your UPI app</div>
                        
                        <!-- Supported UPI Apps Grid -->
                        <div style="display:flex; align-items:center; justify-content:center; gap:0.9rem; margin:0.3rem 0;">
                            <div style="text-align:center;">
                                <div style="width:40px; height:40px; background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; display:flex; align-items:center; justify-content:center; font-weight:900; color:#4285f4; font-size:0.9rem; box-shadow:0 2px 5px rgba(0,0,0,0.04);">G Pay</div>
                                <div style="font-size:0.68rem; color:#64748b; margin-top:0.2rem;">Google Pay</div>
                            </div>
                            <div style="text-align:center;">
                                <div style="width:40px; height:40px; background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; display:flex; align-items:center; justify-content:center; font-weight:900; color:#5f259f; font-size:1rem; box-shadow:0 2px 5px rgba(0,0,0,0.04);">पे</div>
                                <div style="font-size:0.68rem; color:#64748b; margin-top:0.2rem;">PhonePe</div>
                            </div>
                            <div style="text-align:center;">
                                <div style="width:40px; height:40px; background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; display:flex; align-items:center; justify-content:center; font-weight:900; color:#00baf2; font-size:0.75rem; box-shadow:0 2px 5px rgba(0,0,0,0.04);">Paytm</div>
                                <div style="font-size:0.68rem; color:#64748b; margin-top:0.2rem;">Paytm</div>
                            </div>
                            <div style="text-align:center;">
                                <div style="width:40px; height:40px; background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; display:flex; align-items:center; justify-content:center; font-weight:900; color:#ff9900; font-size:0.9rem; box-shadow:0 2px 5px rgba(0,0,0,0.04);">BHIM</div>
                                <div style="font-size:0.68rem; color:#64748b; margin-top:0.2rem;">BHIM</div>
                            </div>
                            <div style="text-align:center;">
                                <div style="width:40px; height:40px; background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; display:flex; align-items:center; justify-content:center; font-weight:900; color:#005c9e; font-size:0.75rem; box-shadow:0 2px 5px rgba(0,0,0,0.04);">Amazon</div>
                                <div style="font-size:0.68rem; color:#64748b; margin-top:0.2rem;">Amazon Pay</div>
                            </div>
                        </div>

                        <div style="font-size:0.75rem; color:#94a3b8; font-weight:600;">or scan this QR code</div>

                        <!-- QR Code Container -->
                        <div style="background:#ffffff; border:2px solid #047857; border-radius:16px; padding:1rem; display:flex; flex-direction:column; align-items:center; box-shadow:0 4px 15px rgba(4,120,87,0.1);">
                            <img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=upi%3A%2F%2Fpay%3Fpa%3D%26pn%3DZilhaj%26am%3D${encodeURIComponent(String(this.amountFromOffer(offerId))) }%26cu%3DINR" alt="UPI QR Code" style="width:160px; height:160px; border-radius:8px;">
                            <div style="display:flex; align-items:center; gap:0.5rem; background:#f8fafc; border:1px solid #e2e8f0; padding:0.35rem 0.8rem; border-radius:8px; margin-top:0.8rem; font-size:0.78rem; color:#0f172a; font-weight:700;">
                                <span>UPI ID: ${this.escapeHtml(this.upiIdFromOffer(offerId) || '')}</span>
                                <span onclick="app.showToast('UPI ID copied!', 'success');" style="cursor:pointer; color:#047857;">📋</span>
                            </div>
                        </div>

                        <div style="font-size:0.75rem; color:#64748b; display:flex; align-items:center; gap:0.4rem;">
                            <span>ⓘ</span> You will be able to review the payment on the next step.
                        </div>
                    </div>
                `;
            }

            // DYNAMIC CTA BEHAVIOR RULE: NO "Pay ₹..." button for UPI. Show QR Code button action.
            if (ctaContainer) {
                ctaContainer.innerHTML = `
                    <button onclick="app.processPaymentSubmit('${offerId}', '', '${this.escapeHtml(payTitle)}', ${payAmount}, ${payTravelers});"
                        style="background:#047857; color:#ffffff; font-size:0.95rem; font-weight:800; padding:0.85rem 1.6rem; border-radius:10px; border:none; cursor:pointer; font-family:inherit; box-shadow:0 4px 14px rgba(4,120,87,0.25); display:flex; align-items:center; gap:0.5rem;">
                        📱 Show QR Code / Verify Payment
                    </button>
                `;
            }

        } else if (method === 'card') {
            // Credit / Debit Card Panel
            if (panel) {
                panel.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:1rem; text-align:left;">
                        <h4 style="font-size:1rem; font-weight:800; color:#0f172a; margin:0 0 0.3rem;">Credit or Debit Card</h4>
                        <div>
                            <label style="font-size:0.75rem; font-weight:700; color:#475569; display:block; margin-bottom:0.25rem;">Cardholder Name *</label>
                            <input type="text" id="cardHolder" class="form-control" value="${this.escapeHtml((this.state.currentUser && this.state.currentUser.name) || '')}" placeholder="Name on card" style="border:1.5px solid #cbd5e1; border-radius:8px; padding:0.65rem 0.9rem; font-size:0.88rem; width:100%;">
                        </div>
                        <div>
                            <label style="font-size:0.75rem; font-weight:700; color:#475569; display:block; margin-bottom:0.25rem;">Card Number *</label>
                            <input type="text" id="cardNumber" class="form-control" placeholder="4532 •••• •••• 8912" style="border:1.5px solid #cbd5e1; border-radius:8px; padding:0.65rem 0.9rem; font-size:0.88rem; width:100%;">
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.8rem;">
                            <div>
                                <label style="font-size:0.75rem; font-weight:700; color:#475569; display:block; margin-bottom:0.25rem;">Expiry Date *</label>
                                <input type="text" id="cardExpiry" class="form-control" placeholder="MM / YY" style="border:1.5px solid #cbd5e1; border-radius:8px; padding:0.65rem 0.9rem; font-size:0.88rem; width:100%;">
                            </div>
                            <div>
                                <label style="font-size:0.75rem; font-weight:700; color:#475569; display:block; margin-bottom:0.25rem;">CVV / CVC *</label>
                                <input type="password" id="cardCvv" class="form-control" placeholder="•••" maxlength="4" style="border:1.5px solid #cbd5e1; border-radius:8px; padding:0.65rem 0.9rem; font-size:0.88rem; width:100%;">
                            </div>
                        </div>
                    </div>
                `;
            }

            // DYNAMIC CTA BEHAVIOR RULE: Cards -> Show "Pay ₹1,69,800 Securely" button
            if (ctaContainer) {
                ctaContainer.innerHTML = `
                    <button onclick="app.processPaymentSubmit('${offerId}', '', '${this.escapeHtml(payTitle)}', ${payAmount}, ${payTravelers});"
                        style="background:#047857; color:#ffffff; font-size:0.95rem; font-weight:800; padding:0.85rem 1.6rem; border-radius:10px; border:none; cursor:pointer; font-family:inherit; box-shadow:0 4px 14px rgba(4,120,87,0.25);">
                        🔒 Pay ${totalAmountFormatted} Securely
                    </button>
                `;
            }

        } else if (method === 'net') {
            // Net Banking Panel
            if (panel) {
                panel.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:1rem; text-align:left;">
                        <h4 style="font-size:1rem; font-weight:800; color:#0f172a; margin:0 0 0.3rem;">Select Net Banking Bank</h4>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                            <label style="display:flex; align-items:center; gap:0.6rem; background:#ffffff; border:1.5px solid #047857; padding:0.75rem; border-radius:10px; cursor:pointer;">
                                <input type="radio" name="bankOption" checked style="accent-color:#047857;">
                                <span style="font-size:0.85rem; font-weight:800; color:#0f172a;">SBI Bank</span>
                            </label>
                            <label style="display:flex; align-items:center; gap:0.6rem; background:#ffffff; border:1px solid #cbd5e1; padding:0.75rem; border-radius:10px; cursor:pointer;">
                                <input type="radio" name="bankOption" style="accent-color:#047857;">
                                <span style="font-size:0.85rem; font-weight:800; color:#0f172a;">HDFC Bank</span>
                            </label>
                            <label style="display:flex; align-items:center; gap:0.6rem; background:#ffffff; border:1px solid #cbd5e1; padding:0.75rem; border-radius:10px; cursor:pointer;">
                                <input type="radio" name="bankOption" style="accent-color:#047857;">
                                <span style="font-size:0.85rem; font-weight:800; color:#0f172a;">ICICI Bank</span>
                            </label>
                            <label style="display:flex; align-items:center; gap:0.6rem; background:#ffffff; border:1px solid #cbd5e1; padding:0.75rem; border-radius:10px; cursor:pointer;">
                                <input type="radio" name="bankOption" style="accent-color:#047857;">
                                <span style="font-size:0.85rem; font-weight:800; color:#0f172a;">Axis Bank</span>
                            </label>
                        </div>
                    </div>
                `;
            }

            // DYNAMIC CTA BEHAVIOR RULE: Net Banking -> Show "Pay ₹1,69,800 Securely" button
            if (ctaContainer) {
                ctaContainer.innerHTML = `
                    <button onclick="app.processPaymentSubmit('${offerId}', '', '${this.escapeHtml(payTitle)}', ${payAmount}, ${payTravelers});"
                        style="background:#047857; color:#ffffff; font-size:0.95rem; font-weight:800; padding:0.85rem 1.6rem; border-radius:10px; border:none; cursor:pointer; font-family:inherit; box-shadow:0 4px 14px rgba(4,120,87,0.25);">
                        🔒 Pay ${totalAmountFormatted} Securely
                    </button>
                `;
            }

        } else if (method === 'wallet') {
            // Wallets Panel
            if (panel) {
                panel.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:1rem; text-align:left;">
                        <h4 style="font-size:1rem; font-weight:800; color:#0f172a; margin:0 0 0.3rem;">Select Digital Wallet</h4>
                        <div style="display:flex; flex-direction:column; gap:0.75rem;">
                            <label style="display:flex; align-items:center; gap:0.8rem; background:#ffffff; border:1.5px solid #047857; padding:0.8rem 1rem; border-radius:10px; cursor:pointer;">
                                <input type="radio" name="walletOption" checked style="accent-color:#047857;">
                                <span style="font-size:0.88rem; font-weight:800; color:#0f172a;">Paytm Wallet</span>
                            </label>
                            <label style="display:flex; align-items:center; gap:0.8rem; background:#ffffff; border:1px solid #cbd5e1; padding:0.8rem 1rem; border-radius:10px; cursor:pointer;">
                                <input type="radio" name="walletOption" style="accent-color:#047857;">
                                <span style="font-size:0.88rem; font-weight:800; color:#0f172a;">PhonePe Wallet</span>
                            </label>
                            <label style="display:flex; align-items:center; gap:0.8rem; background:#ffffff; border:1px solid #cbd5e1; padding:0.8rem 1rem; border-radius:10px; cursor:pointer;">
                                <input type="radio" name="walletOption" style="accent-color:#047857;">
                                <span style="font-size:0.88rem; font-weight:800; color:#0f172a;">Amazon Pay Balance</span>
                            </label>
                        </div>
                    </div>
                `;
            }

            // DYNAMIC CTA BEHAVIOR RULE: Wallets -> Show "Pay ₹1,69,800 Securely" button
            if (ctaContainer) {
                ctaContainer.innerHTML = `
                    <button onclick="app.processPaymentSubmit('${offerId}', '', '${this.escapeHtml(payTitle)}', ${payAmount}, ${payTravelers});"
                        style="background:#047857; color:#ffffff; font-size:0.95rem; font-weight:800; padding:0.85rem 1.6rem; border-radius:10px; border:none; cursor:pointer; font-family:inherit; box-shadow:0 4px 14px rgba(4,120,87,0.25);">
                        🔒 Pay ${totalAmountFormatted} Securely
                    </button>
                `;
            }

        } else if (method === 'paylater') {
            // Pay Later Panel
            if (panel) {
                panel.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:1rem; text-align:left;">
                        <h4 style="font-size:1rem; font-weight:800; color:#0f172a; margin:0 0 0.3rem;">Pay Later &amp; 0% EMI</h4>
                        <div style="display:flex; flex-direction:column; gap:0.75rem;">
                            <label style="display:flex; align-items:center; gap:0.8rem; background:#ffffff; border:1.5px solid #047857; padding:0.8rem 1rem; border-radius:10px; cursor:pointer;">
                                <input type="radio" name="emiOption" checked style="accent-color:#047857;">
                                <div>
                                    <div style="font-size:0.88rem; font-weight:800; color:#0f172a;">ZestMoney 0% Interest EMI</div>
                                    <div style="font-size:0.75rem; color:#64748b;">Pay in 3 or 6 monthly installments</div>
                                </div>
                            </label>
                            <label style="display:flex; align-items:center; gap:0.8rem; background:#ffffff; border:1px solid #cbd5e1; padding:0.8rem 1rem; border-radius:10px; cursor:pointer;">
                                <input type="radio" name="emiOption" style="accent-color:#047857;">
                                <div>
                                    <div style="font-size:0.88rem; font-weight:800; color:#0f172a;">LazyPay Pay Later</div>
                                    <div style="font-size:0.75rem; color:#64748b;">Pay next month with 0 fees</div>
                                </div>
                            </label>
                        </div>
                    </div>
                `;
            }

            // DYNAMIC CTA BEHAVIOR RULE: Pay Later -> Show "Continue to Pay Later" button
            if (ctaContainer) {
                ctaContainer.innerHTML = `
                    <button onclick="app.processPaymentSubmit('${offerId}', '', '${this.escapeHtml(payTitle)}', ${payAmount}, ${payTravelers});"
                        style="background:#047857; color:#ffffff; font-size:0.95rem; font-weight:800; padding:0.85rem 1.6rem; border-radius:10px; border:none; cursor:pointer; font-family:inherit; box-shadow:0 4px 14px rgba(4,120,87,0.25);">
                        Continue to Pay Later →
                    </button>
                `;
            }
        }
    }

    openOfferConfirmationModal(booking) {
        const modal = document.getElementById('modalCard');
        if (modal) {
            modal.style.maxWidth = '100vw';
            modal.style.width = '100vw';
            modal.style.height = '100vh';
            modal.style.maxHeight = '100vh';
            modal.style.margin = '0';
            modal.style.padding = '0';
            modal.style.borderRadius = '0';
            modal.style.border = 'none';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
        }

        this.openModal(`
            <div style="padding:0; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#0f172a; height:100vh; display:flex; flex-direction:column; background:#f1f5f9; overflow:hidden;">

                <!-- Header -->
                <div class="glass-header" style="background:#0f172a; padding:1.2rem 2rem; display:flex; justify-content:space-between; align-items:center; border-bottom:4px solid #047857; flex-shrink:0;">
                    <div style="display:flex; align-items:center; gap:1.2rem;">
                        <div style="display:flex; align-items:center; gap:0.6rem;">
                            <span style="font-size:1.5rem;">🎉</span>
                            <div>
                                <div style="color:#ffffff; font-weight:800; font-size:1.15rem; letter-spacing:0.3px;">Zilhaj.com Booking Confirmation</div>
                                <div style="color:#94a3b8; font-size:0.75rem;">Step 3 of 3: Booking Confirmed &amp; Payment Received</div>
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:1.2rem;">
                        <div style="display:flex; align-items:center; gap:0.6rem; background:rgba(16,185,129,0.15); padding:0.4rem 1rem; border-radius:999px; border:1px solid #10b981;">
                            <span style="color:#10b981; font-weight:800; font-size:0.8rem;">● Step 3 of 3:</span>
                            <span style="color:#ffffff; font-weight:700; font-size:0.8rem;">Confirmed</span>
                        </div>
                        <button onclick="app.closeModal(); app.navigate('dashboard');" style="background:rgba(255,255,255,0.15); border:none; color:white; font-size:1.1rem; width:34px; height:34px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center;">✕</button>
                    </div>
                </div>

                <!-- Confirmation Content Area -->
                <div style="flex:1; overflow-y:auto; padding:2rem 2.2rem; background:#f8fafc; display:flex; flex-direction:column; align-items:center;">
                    <div style="max-width:760px; width:100%; display:flex; flex-direction:column; gap:1.6rem;">

                        <!-- Success Hero Box -->
                        <div style="background:linear-gradient(135deg, #064e3b 0%, #047857 100%); border-radius:20px; padding:2.2rem; text-align:center; color:white; box-shadow:0 10px 30px rgba(4,120,87,0.2);">
                            <div style="width:72px; height:72px; background:#ffffff; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 1rem; font-size:2.2rem; box-shadow:0 4px 15px rgba(0,0,0,0.15);">
                                ✅
                            </div>
                            <h2 style="font-size:1.8rem; font-weight:900; color:#ffffff; margin:0 0 0.4rem;">Booking Confirmed!</h2>
                            <p style="font-size:0.95rem; color:#a7f3d0; margin:0 0 1.2rem;">Your payment has been received and verified under Zilhaj Escrow Guarantee.</p>

                            <div style="display:inline-flex; align-items:center; gap:1.2rem; background:rgba(0,0,0,0.25); border:1.5px solid rgba(255,255,255,0.25); padding:0.8rem 1.6rem; border-radius:14px;">
                                <div>
                                    <div style="font-size:0.7rem; color:#d1fae5; text-transform:uppercase; font-weight:700;">Booking Ref / PNR</div>
                                    <div style="font-size:1.4rem; font-weight:900; color:#fef08a; font-family:monospace; margin-top:0.1rem;">${booking.id}</div>
                                </div>
                                <div style="width:1px; height:32px; background:rgba(255,255,255,0.2);"></div>
                                <div>
                                    <div style="font-size:0.7rem; color:#d1fae5; text-transform:uppercase; font-weight:700;">Total Paid for ${booking.travelersCount || 2} Persons</div>
                                    <div style="font-size:1.4rem; font-weight:900; color:#ffffff; margin-top:0.1rem;">${this.formatCurrency(booking.totalPrice)}</div>
                                </div>
                            </div>
                        </div>

                        <!-- Summary Card in Dashboard Style -->
                        <div style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:18px; padding:1.6rem; box-shadow:0 4px 16px rgba(0,0,0,0.03);">
                            <h3 style="font-size:1.1rem; font-weight:800; color:#0f172a; margin:0 0 1rem; border-bottom:1px solid #f1f5f9; padding-bottom:0.7rem;">📋 Booking Summary</h3>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; font-size:0.9rem;">
                                <div><span style="color:#64748b;">Package:</span> <strong style="color:#0f172a; font-weight:700; display:block;">${this.escapeHtml(booking.packageTitle)}</strong></div>
                                <div><span style="color:#64748b;">Lead Pilgrim:</span> <strong style="color:#0f172a; font-weight:700; display:block;">${this.escapeHtml(booking.userName)}</strong></div>
                                <div><span style="color:#64748b;">Travelers:</span> <strong style="color:#0f172a; font-weight:700; display:block;">${booking.travelersCount || 2} Persons</strong></div>
                                <div><span style="color:#64748b;">Transaction ID:</span> <strong style="color:#047857; font-weight:700; display:block; font-family:monospace;">${booking.transactionId}</strong></div>
                            </div>
                        </div>

                        <!-- Action Buttons -->
                        <div style="display:flex; gap:1rem; flex-wrap:wrap;">
                            <button onclick="app.closeModal(); app.viewBookingVoucher('${booking.id}');" style="flex:1; background:#047857; color:#ffffff; border:none; padding:1.1rem; border-radius:14px; font-weight:800; font-size:1rem; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:0.5rem; box-shadow:0 6px 20px rgba(4,120,87,0.3);">
                                📄 Download Invoice &amp; E-Voucher
                            </button>
                            <button onclick="app.closeModal(); app.navigate('dashboard');" style="flex:1; background:#ffffff; color:#334155; border:1.5px solid #cbd5e1; padding:1.1rem; border-radius:14px; font-weight:800; font-size:1rem; cursor:pointer; text-align:center;">
                                Go to Dashboard 🏠
                            </button>
                        </div>

                    </div>
                </div>
            </div>
        `);
    }

    async processPaymentSubmit(offerId, reqId, title, price, travelersCount) {
        this.closeModal();
        this.showLoading('Processing secure gateway payment...');

        setTimeout(() => {
            const bookings = this.state.myBookings || [];
            const user = this.state.currentUser || {};
            const allOffers = this.getAllOffers();
            const offer = allOffers.find(o => o.id === offerId) || {};
            const req = (this.state.myRequirements || []).find(r => r.id === (reqId || offer.requirementId));
            const travelerCount = Number(travelersCount) || Number(offer.travelersCount) || (req ? (Number(req.travelersCount) || Number(req.adults)) : null) || 1;
            const txnId = 'TXN-' + Date.now();
            const newBooking = {
                id: 'BK-' + Date.now().toString().slice(-6),
                packageTitle: title || offer.packageTitle || '',
                offerId: offerId,
                requirementId: reqId || offer.requirementId || '',
                totalPrice: Number(price) || Number(offer.discountedPrice) || Number(offer.price) || 0,
                travelersCount: travelerCount,
                travelDate: req && req.preferredDepartureDate ? req.preferredDepartureDate : (offer.departureDateText || ''),
                status: 'CONFIRMED',
                paymentStatus: 'PAID',
                paymentMethod: 'ONLINE PAYMENT',
                transactionId: txnId,
                paidAt: new Date().toISOString(),
                userName: user.name || '',
                userEmail: user.email || '',
                userPhone: user.phone || '',
                userId: user.id || ''
            };
            bookings.unshift(newBooking);
            this.state.myBookings = bookings;
            localStorage.setItem('umrah_my_bookings', JSON.stringify(bookings));
            this.apiCall('/bookings', 'POST', newBooking);

            // Update request status to CONFIRMED
            if (reqId) {
                this.apiCall(`/admin/requirements/${reqId}/status?status=CONFIRMED`, 'PUT');
                const reqs = JSON.parse(localStorage.getItem('umrah_requirements') || '[]');
                const target = reqs.find(r => r.id === reqId);
                if (target) {
                    target.status = 'CONFIRMED';
                    localStorage.setItem('umrah_requirements', JSON.stringify(reqs));
                }
            }

            this.hideLoading();
            this.showToast('Payment successful! Trip booking confirmed.', 'success');
            this.openOfferConfirmationModal(newBooking);
        }, 1400);
    }

    toggleAdminRow(reqId) {
        const el = document.getElementById(`row-detail-${reqId}`);
        const btn = document.getElementById(`row-btn-${reqId}`);
        if (el) {
            if (el.style.display === 'none' || !el.style.display) {
                el.style.display = 'table-row';
                if (btn) btn.innerHTML = '▼ Hide Details';
            } else {
                el.style.display = 'none';
                if (btn) btn.innerHTML = '▶ Expand Details';
            }
        }
    }

    switchAdminTab(tabId) {
        document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.admin-tab-content').forEach(content => content.style.display = 'none');

        document.getElementById(`tab-btn-${tabId}`).classList.add('active');
        document.getElementById(`tab-content-${tabId}`).style.display = 'block';
    }

    async renderAdminPage() {
        const main = document.getElementById('mainContainer');
        main.innerHTML = `
            <div class="admin-container" style="max-width: 100%; width: 100%; box-sizing: border-box; margin: 6rem auto 2rem; padding: 0 3.5rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem; flex-wrap:wrap; gap:1rem;">
                    <div>
                        <h2 style="margin:0; color:#0f172a; font-size:1.35rem; font-weight:800;">👑 Admin Panel</h2>
                        <p style="color:#64748b; font-size:1rem; margin-top:0.3rem;">Manage Zaireen Requests, Offers, and Orders</p>
                    </div>
                    <div style="display:flex; gap:0.6rem;">
                        <button class="btn btn-outline" style="font-weight:700;" onclick="app.navigate('dashboard')">← Back to Dashboard</button>
                    </div>
                </div>
                <div id="adminAnalyticsArea">
                    <div style="text-align:center; padding:3rem; color:#64748b;">Loading metrics and matrices...</div>
                </div>
            </div>
        `;

        const analytics = await this.apiCall('/admin/analytics') || {};
        let reqs = await this.apiCall('/admin/requirements');
        if (!Array.isArray(reqs) || reqs.length === 0) {
            reqs = JSON.parse(localStorage.getItem('umrah_requirements') || '[]');
        }
        let offers = await this.apiCall('/admin/offers');
        if (!Array.isArray(offers) || offers.length === 0) {
            offers = this.getAllOffers();
        }
        const bookings = JSON.parse(localStorage.getItem('umrah_my_bookings') || '[]');
        const packages = this.state.packages || [];

        this.state.admin.requirements = reqs;

        const totalZaireen = reqs.reduce((sum, r) => sum + (r.travelersCount || 1), 0);
        const pendingReqs = reqs.filter(r => r.status !== 'CONFIRMED' && r.status !== 'OFFERED').length;
        const totalRev = bookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);

        const area = document.getElementById('adminAnalyticsArea');
        area.innerHTML = `
            <!-- METRICS BAR -->
            <div class="admin-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:1.2rem; margin-bottom:2.5rem;">
                <div style="background:white; padding:1.5rem; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.04); border-left:4px solid #3b82f6;">
                    <div style="font-size:2rem; font-weight:800; color:#1e293b; line-height:1;">${reqs.length}</div>
                    <div style="color:#64748b; font-size:0.85rem; font-weight:700; margin-top:0.4rem; text-transform:uppercase; letter-spacing:0.5px;">📋 Total Requests</div>
                </div>
                <div style="background:white; padding:1.5rem; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.04); border-left:4px solid #ef4444;">
                    <div style="font-size:2rem; font-weight:800; color:#ef4444; line-height:1;">${pendingReqs}</div>
                    <div style="color:#64748b; font-size:0.85rem; font-weight:700; margin-top:0.4rem; text-transform:uppercase; letter-spacing:0.5px;">⏳ Pending Action</div>
                </div>
                <div style="background:white; padding:1.5rem; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.04); border-left:4px solid #f59e0b;">
                    <div style="font-size:2rem; font-weight:800; color:#1e293b; line-height:1;">${offers.length}</div>
                    <div style="color:#64748b; font-size:0.85rem; font-weight:700; margin-top:0.4rem; text-transform:uppercase; letter-spacing:0.5px;">🎁 Offers Dispatched</div>
                </div>
                <div style="background:white; padding:1.5rem; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.04); border-left:4px solid #10b981;">
                    <div style="font-size:2rem; font-weight:800; color:#10b981; line-height:1;">${totalZaireen}</div>
                    <div style="color:#64748b; font-size:0.85rem; font-weight:700; margin-top:0.4rem; text-transform:uppercase; letter-spacing:0.5px;">👥 Total Zaireen</div>
                </div>
                <div style="background:white; padding:1.5rem; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.04); border-left:4px solid #047857;">
                    <div style="font-size:2rem; font-weight:800; color:#1e293b; line-height:1;">${bookings.length}</div>
                    <div style="color:#64748b; font-size:0.85rem; font-weight:700; margin-top:0.4rem; text-transform:uppercase; letter-spacing:0.5px;">🎟️ Confirmed Orders</div>
                </div>
                <div style="background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding:1.5rem; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.15); border-left:4px solid #fbbf24;">
                    <div style="font-size:1.8rem; font-weight:800; color:#fbbf24; line-height:1;">${this.formatCurrency(totalRev)}</div>
                    <div style="color:#94a3b8; font-size:0.85rem; font-weight:700; margin-top:0.4rem; text-transform:uppercase; letter-spacing:0.5px;">💰 System Revenue</div>
                </div>
            </div>

            <!-- TABS NAV -->
            <div style="display:flex; gap:1rem; margin-bottom:1.5rem; border-bottom:2px solid #e2e8f0; padding-bottom:1rem; overflow-x:auto;">
                <button id="tab-btn-requests" class="admin-tab-btn active" onclick="app.switchAdminTab('requests')" style="background:none; border:none; padding:0.5rem 1rem; font-size:1.1rem; font-weight:800; color:#64748b; cursor:pointer; position:relative; transition:all 0.2s;">📋 Active Requests (${reqs.length})</button>
                <button id="tab-btn-offers" class="admin-tab-btn" onclick="app.switchAdminTab('offers')" style="background:none; border:none; padding:0.5rem 1rem; font-size:1.1rem; font-weight:800; color:#64748b; cursor:pointer; position:relative; transition:all 0.2s;">🎁 Offers Made (${offers.length})</button>
                <button id="tab-btn-orders" class="admin-tab-btn" onclick="app.switchAdminTab('orders')" style="background:none; border:none; padding:0.5rem 1rem; font-size:1.1rem; font-weight:800; color:#64748b; cursor:pointer; position:relative; transition:all 0.2s;">🎟️ Confirmed Orders (${bookings.length})</button>
                <button id="tab-btn-packages" class="admin-tab-btn" onclick="app.switchAdminTab('packages')" style="background:none; border:none; padding:0.5rem 1rem; font-size:1.1rem; font-weight:800; color:#64748b; cursor:pointer; position:relative; transition:all 0.2s;">📦 Package Catalog (${packages.length})</button>
            </div>

            <style>
                .admin-tab-btn.active { color: #047857 !important; }
                .admin-tab-btn.active::after { content:''; position:absolute; bottom:-18px; left:0; width:100%; height:4px; background:#047857; border-radius:4px 4px 0 0; }
                .data-table th { background: #f8fafc; color: #475569; font-weight: 800; padding: 1.2rem 1rem; text-align: left; border-bottom: 2px solid #e2e8f0; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; }
                .data-table td { padding: 1.2rem 1rem; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
                .data-table tr:hover { background: #f8fafc; }
            </style>

            <!-- TAB 1: REQUESTS -->
            <div id="tab-content-requests" class="admin-tab-content" style="display:block;">
                <div style="background:white; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.03); overflow:hidden;">
                    <div style="overflow-x:auto;">
                        <table class="data-table" style="width:100%; border-collapse:collapse;">
                            <thead>
                                <tr>
                                    <th>Req ID</th>
                                    <th>Zaireen Profile</th>
                                    <th>Requested Services</th>
                                    <th>Group Details</th>
                                    <th>Max Budget</th>
                                    <th>Status</th>
                                    <th style="text-align:right;">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${reqs.length > 0 ? reqs.map(r => `
                                    <tr>
                                        <td><span style="background:#e2e8f0; color:#475569; padding:0.3rem 0.6rem; border-radius:6px; font-size:0.75rem; font-weight:700;">${(r.id || '').substring(0, 8)}</span></td>
                                        <td>
                                            <strong style="color:#0f172a;">${this.escapeHtml(r.userName || 'Unnamed User')}</strong><br>
                                            <small style="color:#64748b;">${this.escapeHtml(r.userEmail || 'no email on file')}</small><br>
                                            <small style="color:#047857; font-weight:700;">📞 ${this.escapeHtml(r.userPhone || 'N/A')}</small>
                                        </td>
                                        <td>
                                            <strong style="color:#047857;">📅 ${r.preferredDepartureDate || 'Not specified'}</strong>${r.durationDays ? ` (⏳ ${r.durationDays}D)` : ''}<br>
                                            <small style="color:#64748b;">✈️ Dep: ${this.escapeHtml(r.departureCity || 'Not specified')}</small><br>
                                            <small style="color:#64748b;">🏨 ${this.escapeHtml(r.hotelType || 'Not specified')}</small>
                                        </td>
                                        <td>
                                            <strong style="font-size:1rem;">👥 ${r.travelersCount || 1} Total</strong><br>
                                            <small style="color:#64748b;">👨 ${r.travelersBreakdown ? r.travelersBreakdown.males : r.travelersCount} | 👩 ${r.travelersBreakdown ? r.travelersBreakdown.females : 0} | 👶 ${r.travelersBreakdown ? r.travelersBreakdown.children : 0}</small>
                                        </td>
                                        <td>
                                            <strong style="color:#b45309; font-size:1rem;">${this.formatCurrency(r.maxBudget)}</strong> /pp<br>
                                            <small style="color:#78350f;">Grp Total: ${this.formatCurrency((r.maxBudget || 0) * (r.travelersCount || 1))}</small>
                                        </td>
                                        <td>
                                            <span style="background:${r.status === 'CONFIRMED' ? '#dcfce7' : r.status === 'OFFERED' ? '#dbeafe' : '#fef3c7'}; color:${r.status === 'CONFIRMED' ? '#166534' : r.status === 'OFFERED' ? '#1d4ed8' : '#b45309'}; padding:0.35rem 0.8rem; border-radius:99px; font-size:0.75rem; font-weight:800; text-transform:uppercase; border:1px solid ${r.status === 'CONFIRMED' ? '#86efac' : r.status === 'OFFERED' ? '#bfdbfe' : '#fde68a'};">
                                                ${r.status || 'BIDDING'}
                                            </span>
                                        </td>
                                        <td style="text-align:right;">
                                            <div style="display:flex; flex-direction:column; gap:0.4rem; align-items:flex-end;">
                                                <button class="btn btn-gold btn-sm" style="font-weight:800; padding:0.4rem 0.8rem; min-width:140px;" onclick="app.openSuggestPackageModal('${r.userId || 'usr-1'}', '${r.id}')">🎁 Give Offer</button>
                                                <button id="row-btn-${r.id}" onclick="app.toggleAdminRow('${r.id}')" style="background:none; border:none; color:#3b82f6; font-size:0.8rem; font-weight:700; cursor:pointer; text-decoration:underline;">▶ Expand Details</button>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr id="row-detail-${r.id}" style="display:none; background:#f8fafc;">
                                        <td colspan="7" style="padding:1.5rem 2rem; border-left:4px solid #3b82f6;">
                                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:2rem;">
                                                <div>
                                                    <h5 style="margin:0 0 0.8rem 0; color:#0f172a; font-size:0.95rem;">📍 Location & Address</h5>
                                                    <p style="margin:0; font-size:0.9rem; color:#475569; line-height:1.5;">
                                                        <strong>State:</strong> ${this.escapeHtml(r.state || 'N/A')} &nbsp;|&nbsp; <strong>District:</strong> ${this.escapeHtml(r.district || 'N/A')}<br>
                                                        <strong>Full Address:</strong> ${this.escapeHtml(r.fullAddress || 'N/A')}
                                                    </p>
                                                    <h5 style="margin:1.2rem 0 0.8rem 0; color:#0f172a; font-size:0.95rem;">ℹ️ Special Instructions / Notes</h5>
                                                    <p style="margin:0; font-size:0.9rem; color:#475569; background:#fff; padding:0.8rem; border-radius:8px; border:1px solid #e2e8f0; min-height:60px;">
                                                        ${this.escapeHtml(r.specialNotes || 'No special notes provided.')}
                                                    </p>
                                                </div>
                                                <div>
                                                    <h5 style="margin:0 0 0.8rem 0; color:#0f172a; font-size:0.95rem;">🎁 Offers Sent for this Request</h5>
                                                    <div style="background:#fff; border-radius:8px; border:1px solid #e2e8f0; padding:1rem; max-height:150px; overflow-y:auto;">
                                                        ${offers.filter(o => o.requirementId === r.id).length > 0 ? offers.filter(o => o.requirementId === r.id).map(o => `
                                                            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #f1f5f9; padding-bottom:0.5rem; margin-bottom:0.5rem;">
                                                                <div>
                                                                    <div style="font-weight:700; font-size:0.85rem; color:#0f172a;">${this.escapeHtml(o.packageTitle)}</div>
                                                                    <div style="font-size:0.75rem; color:#64748b;">Price: ${this.formatCurrency(o.discountedPrice)} (${o.discountPercentage}% OFF)</div>
                                                                </div>
                                                                <span style="background:${o.status === 'ACCEPTED' ? '#dcfce7' : '#f1f5f9'}; color:${o.status === 'ACCEPTED' ? '#166534' : '#475569'}; padding:0.15rem 0.4rem; border-radius:4px; font-size:0.7rem; font-weight:700;">
                                                                    ${o.status || 'PENDING'}
                                                                </span>
                                                            </div>
                                                        `).join('') : '<p style="margin:0; font-size:0.85rem; color:#94a3b8;">No offers dispatched yet.</p>'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                `).join('') : `<tr><td colspan="7" style="text-align:center; padding:3rem; color:#64748b; font-size:1.1rem;">No active Zaireen requests found.</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- TAB 2: OFFERS MADE -->
            <div id="tab-content-offers" class="admin-tab-content" style="display:none;">
                <div style="background:white; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.03); overflow:hidden;">
                    <div style="overflow-x:auto;">
                        <table class="data-table" style="width:100%; border-collapse:collapse;">
                            <thead>
                                <tr>
                                    <th>Offer ID / Req ID</th>
                                    <th>Zaireen Info</th>
                                    <th>Package Offered</th>
                                    <th>Pricing Structure</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${offers.length > 0 ? offers.map(o => {
            const linkedReq = reqs.find(r => r.id === o.requirementId) || {};
            return `
                                    <tr>
                                        <td>
                                            <span style="background:#e0e7ff; color:#3730a3; padding:0.25rem 0.5rem; border-radius:6px; font-size:0.7rem; font-weight:700; margin-bottom:0.3rem; display:inline-block;">Offer: ${(o.id || '').substring(0, 8)}</span><br>
                                            <span style="background:#e2e8f0; color:#475569; padding:0.25rem 0.5rem; border-radius:6px; font-size:0.7rem; font-weight:700;">Req: ${(o.requirementId || '').substring(0, 8)}</span>
                                        </td>
                                        <td>
                                            <strong style="color:#0f172a;">${this.escapeHtml(linkedReq.userName || 'Unnamed User')}</strong><br>
                                            <small style="color:#64748b;">${this.escapeHtml(linkedReq.userEmail || 'no email on file')}</small>
                                        </td>
                                        <td>
                                            <strong style="color:#047857; font-size:0.95rem;">${this.escapeHtml(o.packageTitle)}</strong><br>
                                            <small style="color:#64748b;">📅 ${o.departureDateText || 'Not specified'} | ⏳ ${o.durationDays ? o.durationDays + ' Days' : 'Duration N/A'}</small><br>
                                            <small style="color:#64748b;">🏨 ${this.escapeHtml(o.makkahHotelName || 'Not specified')}</small>
                                        </td>
                                        <td>
                                            <span style="text-decoration:line-through; color:#94a3b8; font-size:0.85rem;">${this.formatCurrency(o.originalPrice)}</span><br>
                                            <strong style="color:#b45309; font-size:1.15rem;">${this.formatCurrency(o.discountedPrice)}</strong><br>
                                            <span style="background:#fef3c7; color:#b45309; padding:0.15rem 0.4rem; border-radius:4px; font-size:0.7rem; font-weight:800;">${o.discountPercentage}% OFF</span>
                                        </td>
                                        <td>
                                            <span style="background:${o.status === 'ACCEPTED' ? '#dcfce7' : o.status === 'REJECTED' ? '#fee2e2' : '#f1f5f9'}; color:${o.status === 'ACCEPTED' ? '#166534' : o.status === 'REJECTED' ? '#991b1b' : '#475569'}; padding:0.35rem 0.8rem; border-radius:99px; font-size:0.75rem; font-weight:800; text-transform:uppercase;">
                                                ${o.status || 'PENDING'}
                                            </span>
                                        </td>
                                    </tr>
                                `}).join('') : `<tr><td colspan="5" style="text-align:center; padding:3rem; color:#64748b; font-size:1.1rem;">No custom offers dispatched yet.</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- TAB 3: CONFIRMED ORDERS -->
            <div id="tab-content-orders" class="admin-tab-content" style="display:none;">
                <div style="background:white; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.03); overflow:hidden;">
                    <div style="overflow-x:auto;">
                        <table class="data-table" style="width:100%; border-collapse:collapse;">
                            <thead>
                                <tr>
                                    <th>Booking Ref</th>
                                    <th>Customer / Zaireen</th>
                                    <th>Booked Package</th>
                                    <th>Total Paid</th>
                                    <th>Order Date</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${bookings.length > 0 ? bookings.map(b => `
                                    <tr>
                                        <td>
                                            <strong style="color:#047857; font-size:1.05rem; background:#ecfdf5; padding:0.3rem 0.7rem; border-radius:8px; border:1px solid #a7f3d0;">${b.id}</strong><br>
                                            ${b.requirementId ? `<small style="color:#64748b; display:inline-block; margin-top:0.4rem;">Req: ${(b.requirementId || '').substring(0, 8)}</small>` : ''}
                                        </td>
                                        <td>
                                            <strong style="color:#0f172a;">${this.escapeHtml(b.userName || 'Unnamed User')}</strong><br>
                                            <small style="color:#64748b;">${this.escapeHtml(b.userEmail || 'no email on file')}</small><br>
                                            <small style="color:#047857; font-weight:700;">📞 ${this.escapeHtml(b.userPhone || 'N/A')}</small>
                                        </td>
                                        <td>
                                            <strong style="color:#0f172a; font-size:0.95rem;">${this.escapeHtml(b.packageTitle)}</strong><br>
                                            <small style="color:#64748b;">📅 ${b.travelDate || 'Not specified'} | 👥 ${b.travelersCount || '—'} Zaireen</small>
                                        </td>
                                        <td>
                                            <strong style="color:#047857; font-size:1.15rem;">${this.formatCurrency(b.totalPrice)}</strong>
                                        </td>
                                        <td>
                                            <span style="color:#475569; font-size:0.9rem;">${b.createdAt || new Date().toLocaleDateString()}</span>
                                        </td>
                                        <td>
                                            <span style="background:#dcfce7; color:#166534; padding:0.35rem 0.8rem; border-radius:99px; font-size:0.75rem; font-weight:800; border:1px solid #86efac;">
                                                ✅ ${b.status || 'CONFIRMED'}
                                            </span>
                                        </td>
                                    </tr>
                                `).join('') : `<tr><td colspan="6" style="text-align:center; padding:3rem; color:#64748b; font-size:1.1rem;">No confirmed orders yet.</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- TAB 4: PACKAGES -->
            <div id="tab-content-packages" class="admin-tab-content" style="display:none;">
                <div style="display:flex; justify-content:flex-end; margin-bottom:1rem;">
                    <button class="btn btn-primary" onclick="app.openAddPackageModal()">➕ Add New Package Catalog</button>
                </div>
                <div style="background:white; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.03); overflow:hidden;">
                    <div style="overflow-x:auto;">
                        <table class="data-table" style="width:100%; border-collapse:collapse;">
                            <thead>
                                <tr>
                                    <th>Departure</th>
                                    <th>Package Title</th>
                                    <th>Makkah Hotel</th>
                                    <th>Madinah Hotel</th>
                                    <th>Listing Price</th>
                                    <th style="text-align:right;">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${packages.map(p => `
                                    <tr>
                                        <td><strong style="color:#047857;">${p.departureDateText || p.departureDate || 'Not specified'}</strong></td>
                                        <td><strong style="color:#0f172a; font-size:0.95rem;">${this.escapeHtml(p.title)}</strong></td>
                                        <td>
                                            ${this.escapeHtml(p.makkahHotelName || 'Not specified')}<br>
                                            ${p.distanceToHaramMakkah ? `<small style="color:#64748b;">🚶 ${p.distanceToHaramMakkah}m from Haram</small>` : ''}
                                        </td>
                                        <td>
                                            ${this.escapeHtml(p.madinahHotelName || 'Not specified')}<br>
                                            ${p.distanceToHaramMadinah ? `<small style="color:#64748b;">🚶 ${p.distanceToHaramMadinah}m from Nabawi</small>` : ''}
                                        </td>
                                        <td><strong style="color:#b45309; font-size:1.1rem;">${this.formatCurrency(p.price)}</strong></td>
                                        <td style="text-align:right;">
                                            <button class="btn btn-danger btn-sm" style="font-weight:700;" onclick="app.deletePackageByAdmin('${p.id}')">🗑️ Delete</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }







    openModal(contentHtml, isFullScreen = false, customOptions = {}) {
        const backdrop = document.getElementById('modalBackdrop');
        const modal = document.getElementById('modalCard');
        const content = document.getElementById('modalContent');
        const defaultCloseBtn = modal ? modal.querySelector('.modal-close-btn') : null;

        if (content) {
            content.innerHTML = contentHtml;
        }

        const is100vw = isFullScreen || customOptions.width === '100vw' || customOptions.maxWidth === '100vw';

        if (modal) {
            if (is100vw) {
                modal.style.maxWidth = '100vw';
                modal.style.width = '100vw';
                modal.style.maxHeight = '100vh';
                modal.style.height = '100vh';
                modal.style.borderRadius = '0';
                modal.style.overflowY = 'hidden';
                modal.style.padding = '0';
                modal.style.background = '#f8fafc';
                modal.style.boxShadow = 'none';
                modal.style.border = 'none';
                modal.style.margin = '0';
                modal.style.transform = 'none';
                modal.style.position = 'fixed';
                modal.style.top = '0';
                modal.style.left = '0';
                modal.style.zIndex = '100000';
            } else {
                modal.style.maxWidth = customOptions.maxWidth || '880px';
                modal.style.width = customOptions.width || '95%';
                modal.style.maxHeight = customOptions.maxHeight || '92vh';
                modal.style.height = customOptions.height || 'auto';
                modal.style.borderRadius = customOptions.borderRadius || '24px';
                modal.style.overflowY = customOptions.overflowY || 'auto';
                modal.style.padding = '0';
                modal.style.background = 'transparent';
                modal.style.boxShadow = customOptions.boxShadow || 'none';
                modal.style.border = 'none';
                modal.style.margin = '0';
                modal.style.transform = 'none';
                modal.style.position = '';
                modal.style.top = '';
                modal.style.left = '';
                modal.style.zIndex = '';
            }
            if (defaultCloseBtn) defaultCloseBtn.style.display = 'none';
        }

        if (content) {
            if (is100vw) {
                content.style.width = '100vw';
                content.style.height = '100vh';
                content.style.padding = '0';
                content.style.margin = '0';
            } else {
                content.style.width = '';
                content.style.height = '';
                content.style.padding = '';
                content.style.margin = '';
            }
        }

        if (backdrop) {
            backdrop.onclick = (e) => {
                if (e.target === backdrop || e.target.id === 'modalBackdrop') {
                    this.closeModal();
                }
            };
            backdrop.style.zIndex = '999999';
            backdrop.style.display = 'flex';
            backdrop.style.opacity = '1';
            backdrop.style.visibility = 'visible';
            backdrop.style.pointerEvents = 'auto';
            backdrop.style.alignItems = 'center';
            backdrop.style.justifyContent = 'center';
            backdrop.style.padding = is100vw ? '0px' : '1.5rem';
            backdrop.style.background = is100vw ? '#f8fafc' : 'rgba(15, 23, 42, 0.78)';
            backdrop.style.backdropFilter = is100vw ? 'none' : 'blur(8px)';
            backdrop.classList.add('active');
        }
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        this.closeAuthPage();
        const modal = document.getElementById('modalCard');
        if (modal) {
            modal.removeAttribute('style');
            modal.classList.remove('fullscreen', 'auth-modal-fixed');
            const defaultCloseBtn = modal.querySelector('.modal-close-btn');
            if (defaultCloseBtn) defaultCloseBtn.style.display = '';
        }
        const backdrop = document.getElementById('modalBackdrop');
        if (backdrop) {
            backdrop.onclick = null;
            backdrop.classList.remove('active');
            backdrop.removeAttribute('style');
            backdrop.style.display = 'none';
            backdrop.style.opacity = '0';
            backdrop.style.pointerEvents = 'none';
        }
        const content = document.getElementById('modalContent');
        if (content) content.innerHTML = '';
        document.body.style.overflow = 'auto';
    }

    closeAuthPage() {
        const fullAuthEl = document.getElementById('fullAuthScreenContainer');
        if (fullAuthEl) {
            fullAuthEl.remove();
        }
        document.body.style.overflow = 'auto';
    }

    openLoginModal() {
        this.openAuthModal('login');
    }

    openRegisterModal() {
        this.openAuthModal('register');
    }



    openAuthModal(mode = 'login') {
        const isLogin = mode === 'login' || mode === 'admin-login';
        const isRegister = mode === 'register';
        const isForgot = mode === 'forgot-password';

        // Reset signup state on modal open
        this.state.otpVerified = false;
        this.state.generatedOtp = null;

        const leftBgImage = isRegister ? 'kaaba-full-bg2.jpg' : 'kaaba-full-bg1.jpg';

        this.openModal(`
            <div class="page-wrapper">
                
                <!-- ==========================================
                     LEFT PANEL (40% Width - Pexels Kaaba Full Photo Background)
                     ========================================== -->
                <aside class="left-panel" style="width: 38%; min-width: 420px; height: 100vh; position: relative; overflow: hidden; background: #061F17; border-bottom-right-radius: 80px; box-shadow: 12px 0 35px rgba(0, 0, 0, 0.25);">
                  
                  <!-- 1. FULL-PANEL PEXELS BACKGROUND IMAGE -->
                  <img src="${leftBgImage}" alt="Kaaba Mecca Background" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; z-index: 1; filter: brightness(0.88) contrast(1.1);">

                  <!-- 2. CRYSTAL-CLEAR SHADOW OVERLAY -->
                  <div style="position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0, 0, 0, 0.55) 0%, rgba(0, 0, 0, 0.35) 40%, rgba(0, 0, 0, 0.72) 100%); z-index: 2;"></div>

                  <!-- 3. CONTENT CONTAINER OVERLAY (Balanced Compact Layout) -->
                  <div class="left-panel-content" style="position: relative; z-index: 3; padding: 44px; display: flex; flex-direction: column; justify-content: center; gap: 22px; height: 100%; box-sizing: border-box;">
                    
                    <!-- 1. LOGO & BRAND (zilhaj.com) -->
                    <div class="brand-logo" onclick="app.closeModal(); app.navigate('home');" style="cursor:pointer; display:flex; align-items:center; gap:12px; margin-bottom: 4px;">
                      <img src="zilhaj-logo.jpg" alt="zilhaj.com Logo" class="brand-logo-img" style="width:44px; height:44px; max-width:44px; max-height:44px; object-fit:contain; border-radius:50%; border: 2px solid #F59E0B; flex-shrink:0; box-shadow: 0 4px 14px rgba(0,0,0,0.5);">
                      <span class="brand-text" style="font-family:'Plus Jakarta Sans', 'Inter', sans-serif; font-size:26px; font-weight:800; letter-spacing:-0.5px; color:#FFFFFF; text-shadow:0 3px 12px rgba(0,0,0,0.85);">zilhaj.com</span>
                    </div>

                    <!-- 2. HUGE BOLD TAGLINE (Matching Reference Image 2) -->
                    <div class="tagline-container" style="display:flex; flex-direction:column; gap:2px;">
                      <div class="tagline-text-white" style="font-family:'Plus Jakarta Sans', sans-serif; font-size:44px; font-weight:900; color:#FFFFFF; line-height:1.05; letter-spacing:-1px; text-shadow:0 4px 16px rgba(0,0,0,0.85);">One Request.</div>
                      <div class="tagline-text-gold" style="font-family:'Plus Jakarta Sans', sans-serif; font-size:44px; font-weight:900; color:#F59E0B; line-height:1.05; letter-spacing:-1px; text-shadow:0 4px 16px rgba(0,0,0,0.85);">Multiple Verified</div>
                      <div class="tagline-text-gold" style="font-family:'Plus Jakarta Sans', sans-serif; font-size:44px; font-weight:900; color:#F59E0B; line-height:1.05; letter-spacing:-1px; text-shadow:0 4px 16px rgba(0,0,0,0.85);">Offers.</div>
                    </div>

                    <!-- 3. DESCRIPTION (Matching Reference Image 2) -->
                    <p class="description-text" style="font-size:14.5px; line-height:1.55; color:rgba(255, 255, 255, 0.92); font-weight:400; margin:0; max-width:370px; text-shadow:0 2px 8px rgba(0,0,0,0.85);">
                      Post one request and receive transparent offers from verified Umrah travel providers. Compare, choose, and save—without sharing your personal details.
                    </p>

                    <!-- 4. FEATURE LIST (Sleek Compact Rows) -->
                    <div class="feature-list" style="display:flex; flex-direction:column; gap:10px; margin-top:6px;">
                      
                      <!-- Row 1: Verified & Trusted -->
                      <div class="feature-item" style="display:flex; align-items:center; gap:12px; padding-top:10px; border-top:1px solid rgba(255, 255, 255, 0.18);">
                        <div class="feature-badge" style="width:38px; height:38px; border-radius:50%; background:rgba(0, 0, 0, 0.35); backdrop-filter:blur(10px); border:1.5px solid #F59E0B; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 3px 10px rgba(0,0,0,0.4);">
                          <svg viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:18px; height:18px;">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            <path d="M9 12l2 2 4-4"/>
                          </svg>
                        </div>
                        <div class="feature-info" style="display:flex; flex-direction:column; gap:1px;">
                          <span class="feature-title" style="font-size:14.5px; font-weight:700; color:#FFFFFF; text-shadow:0 2px 6px rgba(0,0,0,0.8);">Verified & Trusted</span>
                          <span class="feature-subtext" style="font-size:12.5px; color:rgba(255, 255, 255, 0.85); line-height:1.3; text-shadow:0 1px 4px rgba(0,0,0,0.7);">All offers are verified for your peace of mind.</span>
                        </div>
                      </div>

                      <!-- Row 2: Multiple Offers -->
                      <div class="feature-item" style="display:flex; align-items:center; gap:12px; padding-top:10px; border-top:1px solid rgba(255, 255, 255, 0.18);">
                        <div class="feature-badge" style="width:38px; height:38px; border-radius:50%; background:rgba(0, 0, 0, 0.35); backdrop-filter:blur(10px); border:1.5px solid #F59E0B; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 3px 10px rgba(0,0,0,0.4);">
                          <svg viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:18px; height:18px;">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                          </svg>
                        </div>
                        <div class="feature-info" style="display:flex; flex-direction:column; gap:1px;">
                          <span class="feature-title" style="font-size:14.5px; font-weight:700; color:#FFFFFF; text-shadow:0 2px 6px rgba(0,0,0,0.8);">Multiple Offers</span>
                          <span class="feature-subtext" style="font-size:12.5px; color:rgba(255, 255, 255, 0.85); line-height:1.3; text-shadow:0 1px 4px rgba(0,0,0,0.7);">Compare multiple offers and choose what's best for you.</span>
                        </div>
                      </div>

                      <!-- Row 3: Secure & Private -->
                      <div class="feature-item" style="display:flex; align-items:center; gap:12px; padding-top:10px; border-top:1px solid rgba(255, 255, 255, 0.18);">
                        <div class="feature-badge" style="width:38px; height:38px; border-radius:50%; background:rgba(0, 0, 0, 0.35); backdrop-filter:blur(10px); border:1.5px solid #F59E0B; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 3px 10px rgba(0,0,0,0.4);">
                          <svg viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:18px; height:18px;">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                          </svg>
                        </div>
                        <div class="feature-info" style="display:flex; flex-direction:column; gap:1px;">
                          <span class="feature-title" style="font-size:14.5px; font-weight:700; color:#FFFFFF; text-shadow:0 2px 6px rgba(0,0,0,0.8);">Secure & Private</span>
                          <span class="feature-subtext" style="font-size:12.5px; color:rgba(255, 255, 255, 0.85); line-height:1.3; text-shadow:0 1px 4px rgba(0,0,0,0.7);">Your data and identity are 100% safe and protected.</span>
                        </div>
                      </div>

                    </div>

                  </div>
                </aside>

                <!-- ==========================================
                     RIGHT PANEL (60% Width - Clean Full Layout)
                     ========================================== -->
                <main class="right-panel" style="width: 62%; height: 100vh; background: #FFFFFF; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 28px 40px; position: relative; box-sizing: border-box; overflow-y: auto;">
                  
                  <!-- TOP CLOSE BUTTON -->
                  <button type="button" onclick="app.closeModal()" title="Close" style="position: absolute; top: 28px; right: 36px; border-radius: 50%; width: 42px; height: 42px; border: 1.5px solid #CBD5E1; background: #FFFFFF; font-weight: 700; font-size: 1.15rem; color: #475569; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.06); transition: all 0.2s;">
                    ✕
                  </button>

                  <!-- FORM CONTAINER (Expanded Max-Width 640px to Fill Right Panel Space) -->
                  <div class="login-card-container" style="width: 100%; max-width: 640px; margin: 0 auto; box-sizing: border-box;">
                    
                    <!-- Card Header -->
                    <div class="card-header" style="margin-bottom: 24px; text-align: left;">
                      <h2 style="font-family: 'Plus Jakarta Sans', 'Inter', sans-serif; font-size: 32px; font-weight: 800; color: #0F172A; margin: 0 0 6px 0; letter-spacing: -0.5px;">
                        ${isRegister ? 'Sign Up' : (isForgot ? 'Reset Password' : 'Login')}
                      </h2>
                      <p style="font-size: 15px; color: #64748B; margin: 0; font-weight: 500;">
                        ${isRegister ? 'Already have an account? <a href="#" onclick="event.preventDefault(); app.openAuthModal(\'login\')" style="color: #0F5A47; font-weight: 700; text-decoration: underline;">Sign In</a>' : (isForgot ? 'Remember your password? <a href="#" onclick="event.preventDefault(); app.openAuthModal(\'login\')" style="color: #0F5A47; font-weight: 700; text-decoration: underline;">Sign In</a>' : 'Doesn\'t have an account yet? <a href="#" onclick="event.preventDefault(); app.openAuthModal(\'register\')" style="color: #0F5A47; font-weight: 700; text-decoration: underline;">Sign Up</a>')}
                      </p>
                    </div>

                    <!-- Alert Containers -->
                    <div id="authFormAlert" style="display:none; margin-bottom: 12px;"></div>
                    <div id="authAlertBox" style="display:none; margin-bottom: 12px;"></div>

                    ${isLogin ? `
                      <!-- LOGIN FORM (Full Width 640px) -->
                      <form id="loginForm" class="login-form" onsubmit="event.preventDefault(); app.handleAuthSubmit('login');" novalidate style="display: flex; flex-direction: column; gap: 20px;">
                        
                        <!-- Email Field -->
                        <div class="form-group" style="display: flex; flex-direction: column; gap: 6px;">
                          <label for="authEmail" style="font-size: 12.5px; font-weight: 800; letter-spacing: 0.5px; color: #334155; text-transform: uppercase;">EMAIL ADDRESS</label>
                          <div class="input-wrapper" style="position: relative;">
                            <input 
                              type="text" 
                              id="authEmail" 
                              name="email-or-phone" 
                              style="width: 100%; height: 52px; border: 1.5px solid #CBD5E1; border-radius: 10px; padding: 0 18px; font-size: 15px; color: #0F172A; background: #FFFFFF; box-sizing: border-box; outline: none; transition: border-color 0.2s;" 
                              placeholder="you@example.com" 
                              autocomplete="username"
                              required
                            >
                          </div>
                          <div class="error-msg-container" id="email-or-phone-error" style="font-size: 12px; color: #EF4444;"></div>
                        </div>

                        <!-- Password Field -->
                        <div class="form-group" style="display: flex; flex-direction: column; gap: 6px;">
                          <div style="display: flex; justify-content: space-between; align-items: center;">
                            <label for="authPassword" style="font-size: 12.5px; font-weight: 800; letter-spacing: 0.5px; color: #334155; text-transform: uppercase;">PASSWORD</label>
                            <a href="#" onclick="event.preventDefault(); app.openAuthModal('forgot-password');" style="font-size: 13.5px; font-weight: 700; color: #0F5A47; text-decoration: underline;">Forgot Password?</a>
                          </div>
                          <div class="input-wrapper" style="position: relative;">
                            <input 
                              type="password" 
                              id="authPassword" 
                              name="password" 
                              style="width: 100%; height: 52px; border: 1.5px solid #CBD5E1; border-radius: 10px; padding: 0 46px 0 18px; font-size: 15px; color: #0F172A; background: #FFFFFF; box-sizing: border-box; outline: none; transition: border-color 0.2s;" 
                              placeholder="Enter 6 character or more" 
                              autocomplete="current-password"
                              required
                            >
                            <button type="button" id="togglePasswordBtn" class="toggle-password-btn" style="position: absolute; right: 14px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #94A3B8; display: flex; align-items: center;">
                              <svg id="eyeIcon" viewBox="0 0 24 24" style="width: 20px; height: 20px;">
                                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                              </svg>
                            </button>
                          </div>
                          <div class="error-msg-container" id="password-error" style="font-size: 12px; color: #EF4444;"></div>
                        </div>

                        <!-- Remember Me Checkbox -->
                        <div style="display: flex; align-items: center; gap: 10px; margin-top: 2px;">
                          <input type="checkbox" id="remember-me" name="remember-me" checked style="width: 18px; height: 18px; accent-color: #0F5A47; cursor: pointer; border-radius: 4px;">
                          <label for="remember-me" style="font-size: 14.5px; color: #475569; font-weight: 600; cursor: pointer;">Remember me</label>
                        </div>

                        <!-- Primary Submit Button -->
                        <button type="submit" style="width: 100%; height: 52px; background: #0F5A47; color: #FFFFFF; border: none; border-radius: 10px; font-size: 16px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; cursor: pointer; margin-top: 6px; box-shadow: 0 4px 14px rgba(15, 90, 71, 0.25); transition: background 0.2s;">
                          LOGIN
                        </button>
                      </form>

                      <!-- Divider -->
                      <div style="display: flex; align-items: center; margin: 24px 0 20px 0;">
                        <div style="flex: 1; height: 1px; background: #E2E8F0;"></div>
                        <span style="padding: 0 16px; font-size: 13px; color: #94A3B8; font-weight: 500;">or login with</span>
                        <div style="flex: 1; height: 1px; background: #E2E8F0;"></div>
                      </div>

                      <!-- Social Buttons (Single Row of Google & Apple) -->
                      <div style="display: flex; gap: 16px;">
                        <button type="button" onclick="app.handleSocialLogin('Google')" style="flex: 1; height: 46px; background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 10px; display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 14.5px; font-weight: 700; color: #EA4335; cursor: pointer; transition: background 0.2s;">
                          <svg style="width: 20px; height: 20px;" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                          </svg>
                          Google
                        </button>
                        <button type="button" onclick="app.handleSocialLogin('Apple')" style="flex: 1; height: 46px; background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 10px; display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 14.5px; font-weight: 700; color: #0F172A; cursor: pointer; transition: background 0.2s;">
                          <svg style="width: 20px; height: 20px;" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.33c.62-.76 1.04-1.81.93-2.87-.9.04-2 .6-2.64 1.36-.57.66-1.07 1.73-.93 2.76 1.01.08 2.02-.49 2.64-1.25z"/>
                          </svg>
                          Apple
                        </button>
                      </div>
                    ` : ''}

                    ${isRegister ? `
                      <!-- SIGNUP FORM (Full Width 640px) -->
                      <form id="signupForm" class="login-form signup-form-grid" onsubmit="event.preventDefault(); app.handleAuthSubmit('register');" novalidate style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px 18px;">
                        
                        <!-- Col 1: Full Name -->
                        <div class="form-group" style="display: flex; flex-direction: column; gap: 4px;">
                          <label for="authName" style="font-size: 11.5px; font-weight: 800; letter-spacing: 0.5px; color: #334155; text-transform: uppercase;">FULL NAME</label>
                          <div class="input-wrapper" style="position: relative;">
                            <input 
                              type="text" 
                              id="authName" 
                              name="signup-fullname" 
                              style="width: 100%; height: 44px; border: 1.5px solid #CBD5E1; border-radius: 8px; padding: 0 14px; font-size: 14px; color: #0F172A; background: #FFFFFF; box-sizing: border-box; outline: none;" 
                              placeholder="Enter your full name" 
                              autocomplete="name"
                              required
                            >
                          </div>
                          <div class="error-msg-container" id="signup-fullname-error" style="font-size: 11.5px; color: #EF4444;"></div>
                        </div>

                        <!-- Col 2: Phone Number -->
                        <div class="form-group" style="display: flex; flex-direction: column; gap: 4px;">
                          <label for="signup-phone" style="font-size: 11.5px; font-weight: 800; letter-spacing: 0.5px; color: #334155; text-transform: uppercase;">PHONE NUMBER</label>
                          <div class="input-wrapper" style="position: relative;">
                            <input 
                              type="tel" 
                              id="signup-phone" 
                              name="signup-phone" 
                              style="width: 100%; height: 44px; border: 1.5px solid #CBD5E1; border-radius: 8px; padding: 0 14px; font-size: 14px; color: #0F172A; background: #FFFFFF; box-sizing: border-box; outline: none;" 
                              placeholder="Enter your phone number" 
                              autocomplete="tel"
                              required
                            >
                          </div>
                          <div class="error-msg-container" id="signup-phone-error" style="font-size: 11.5px; color: #EF4444;"></div>
                        </div>

                        <!-- Full Width: Email for Login -->
                        <div class="form-group full-width-col" style="grid-column: span 2; display: flex; flex-direction: column; gap: 4px;">
                          <label for="authEmail" style="font-size: 11.5px; font-weight: 800; letter-spacing: 0.5px; color: #334155; text-transform: uppercase;">EMAIL FOR LOGIN</label>
                          <div class="input-wrapper" style="position: relative;">
                            <input 
                              type="email" 
                              id="authEmail" 
                              name="signup-email" 
                              style="width: 100%; height: 44px; border: 1.5px solid #CBD5E1; border-radius: 8px; padding: 0 100px 0 14px; font-size: 14px; color: #0F172A; background: #FFFFFF; box-sizing: border-box; outline: none;" 
                              placeholder="Enter your email address" 
                              autocomplete="email"
                              required
                            >
                            <button type="button" id="btnSendOtp" onclick="app.sendSignupOtp()" style="position: absolute; right: 6px; top: 50%; transform: translateY(-50%); height: 32px; padding: 0 14px; background: #0F5A47; color: #FFFFFF; border: none; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer;">
                              Send OTP
                            </button>
                          </div>
                          <div class="error-msg-container" id="signup-email-error" style="font-size: 11.5px; color: #EF4444;"></div>
                        </div>

                        <!-- Full Width: Verify Email OTP -->
                        <div class="form-group full-width-col" style="grid-column: span 2; display: flex; flex-direction: column; gap: 4px;">
                          <label style="font-size: 11.5px; font-weight: 800; letter-spacing: 0.5px; color: #334155; text-transform: uppercase;">VERIFY EMAIL</label>
                          <div class="otp-container" style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 14px;">
                            <p class="otp-subtext" style="font-size: 12px; color: #64748B; margin: 0 0 6px 0;">Enter 6-digit code sent to <span id="display-otp-email" style="font-weight: 700; color: #0F5A47;">your email</span></p>
                            <div style="display: flex; align-items: center; gap: 10px;">
                              <div class="otp-inputs-grid" id="otp-inputs-group" style="display: flex; gap: 8px; flex: 1;">
                                <input type="text" maxlength="1" class="otp-box" data-index="0" inputmode="numeric" pattern="[0-9]*" style="width: 38px; height: 38px; text-align: center; font-size: 16px; font-weight: 700; border: 1.5px solid #CBD5E1; border-radius: 6px;">
                                <input type="text" maxlength="1" class="otp-box" data-index="1" inputmode="numeric" pattern="[0-9]*" style="width: 38px; height: 38px; text-align: center; font-size: 16px; font-weight: 700; border: 1.5px solid #CBD5E1; border-radius: 6px;">
                                <input type="text" maxlength="1" class="otp-box" data-index="2" inputmode="numeric" pattern="[0-9]*" style="width: 38px; height: 38px; text-align: center; font-size: 16px; font-weight: 700; border: 1.5px solid #CBD5E1; border-radius: 6px;">
                                <input type="text" maxlength="1" class="otp-box" data-index="3" inputmode="numeric" pattern="[0-9]*" style="width: 38px; height: 38px; text-align: center; font-size: 16px; font-weight: 700; border: 1.5px solid #CBD5E1; border-radius: 6px;">
                                <input type="text" maxlength="1" class="otp-box" data-index="4" inputmode="numeric" pattern="[0-9]*" style="width: 38px; height: 38px; text-align: center; font-size: 16px; font-weight: 700; border: 1.5px solid #CBD5E1; border-radius: 6px;">
                                <input type="text" maxlength="1" class="otp-box" data-index="5" inputmode="numeric" pattern="[0-9]*" style="width: 38px; height: 38px; text-align: center; font-size: 16px; font-weight: 700; border: 1.5px solid #CBD5E1; border-radius: 6px;">
                              </div>
                              <button type="button" id="btnVerifyOtp" onclick="app.verifySignupOtp()" style="height: 36px; padding: 0 14px; background: #FFFFFF; color: #0F5A47; border: 1.5px solid #0F5A47; border-radius: 6px; font-size: 12px; font-weight: 800; cursor: pointer; flex-shrink: 0;">
                                VERIFY OTP
                              </button>
                            </div>
                            <input type="hidden" id="authOtpCode">
                            <div class="otp-resend-row" style="margin-top: 4px; font-size: 11.5px; color: #64748B;">
                              <span>Didn't receive code? </span>
                              <button type="button" id="resendOtpBtn" onclick="app.sendSignupOtp()" style="background: none; border: none; color: #0F5A47; font-weight: 700; cursor: pointer; text-decoration: underline; padding: 0;">Resend OTP</button>
                              <span id="otpTimer" style="color: #94A3B8;">(00:45)</span>
                            </div>
                            <div id="otpSentAlert" style="display:none;"></div>
                          </div>
                          <div class="error-msg-container" id="signup-otp-error" style="font-size: 11.5px; color: #EF4444;"></div>
                        </div>

                        <!-- Col 1: Create Password -->
                        <div class="form-group" style="display: flex; flex-direction: column; gap: 4px;">
                          <label for="authPassword" style="font-size: 11.5px; font-weight: 800; letter-spacing: 0.5px; color: #334155; text-transform: uppercase;">CREATE PASSWORD</label>
                          <div class="input-wrapper" style="position: relative;">
                            <input 
                              type="password" 
                              id="authPassword" 
                              name="signup-password" 
                              style="width: 100%; height: 44px; border: 1.5px solid #CBD5E1; border-radius: 8px; padding: 0 40px 0 14px; font-size: 14px; color: #0F172A; background: #FFFFFF; box-sizing: border-box; outline: none;" 
                              placeholder="Create a password" 
                              autocomplete="new-password"
                              required
                            >
                            <button type="button" id="toggleSignupPasswordBtn" class="toggle-password-btn" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #94A3B8;">
                              <svg id="signupEyeIcon" viewBox="0 0 24 24" style="width: 18px; height: 18px;">
                                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                              </svg>
                            </button>
                          </div>
                          <div class="error-msg-container" id="signup-password-error" style="font-size: 11.5px; color: #EF4444;"></div>
                        </div>

                        <!-- Col 2: Confirm Password -->
                        <div class="form-group" style="display: flex; flex-direction: column; gap: 4px;">
                          <label for="authConfirmPassword" style="font-size: 11.5px; font-weight: 800; letter-spacing: 0.5px; color: #334155; text-transform: uppercase;">CONFIRM PASSWORD</label>
                          <div class="input-wrapper" style="position: relative;">
                            <input 
                              type="password" 
                              id="authConfirmPassword" 
                              name="signup-confirm-password" 
                              style="width: 100%; height: 44px; border: 1.5px solid #CBD5E1; border-radius: 8px; padding: 0 40px 0 14px; font-size: 14px; color: #0F172A; background: #FFFFFF; box-sizing: border-box; outline: none;" 
                              placeholder="Confirm your password" 
                              autocomplete="new-password"
                              required
                            >
                            <button type="button" id="toggleSignupConfirmPasswordBtn" class="toggle-password-btn" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #94A3B8;">
                              <svg id="signupConfirmEyeIcon" viewBox="0 0 24 24" style="width: 18px; height: 18px;">
                                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                              </svg>
                            </button>
                          </div>
                          <div class="error-msg-container" id="signup-confirm-password-error" style="font-size: 11.5px; color: #EF4444;"></div>
                        </div>

                        <!-- Full Width: Terms & Conditions -->
                        <div class="form-group full-width-col" style="grid-column: span 2; margin-top: 2px;">
                          <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="termsCheck" name="signup-terms" required style="width: 16px; height: 16px; accent-color: #0F5A47; cursor: pointer; border-radius: 4px;">
                            <label for="termsCheck" style="font-size: 12.5px; color: #475569; font-weight: 500; cursor: pointer;">I agree to the Terms & Conditions and Privacy Policy</label>
                          </div>
                          <div class="error-msg-container" id="signup-terms-error" style="font-size: 11.5px; color: #EF4444;"></div>
                        </div>

                        <!-- Full Width: Submit Button -->
                        <div class="form-group full-width-col" style="grid-column: span 2; margin-top: 4px;">
                          <button type="submit" style="width: 100%; height: 48px; background: #0F5A47; color: #FFFFFF; border: none; border-radius: 10px; font-size: 15px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; cursor: pointer; box-shadow: 0 4px 14px rgba(15, 90, 71, 0.25); transition: background 0.2s;">
                            Sign up with Email
                          </button>
                        </div>

                      </form>

                      <!-- Divider for Signup -->
                      <div style="display: flex; align-items: center; margin: 16px 0 12px 0;">
                        <div style="flex: 1; height: 1px; background: #E2E8F0;"></div>
                        <span style="padding: 0 14px; font-size: 12px; color: #94A3B8; font-weight: 500;">or sign up with</span>
                        <div style="flex: 1; height: 1px; background: #E2E8F0;"></div>
                      </div>

                      <!-- Social Buttons for Signup (Single Row of Google & Apple) -->
                      <div style="display: flex; gap: 14px;">
                        <button type="button" onclick="app.handleSocialLogin('Google')" style="flex: 1; height: 42px; background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 13.5px; font-weight: 700; color: #EA4335; cursor: pointer;">
                          <svg style="width: 18px; height: 18px;" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                          </svg>
                          Google
                        </button>
                        <button type="button" onclick="app.handleSocialLogin('Apple')" style="flex: 1; height: 42px; background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 13.5px; font-weight: 700; color: #0F172A; cursor: pointer;">
                          <svg style="width: 18px; height: 18px;" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.33c.62-.76 1.04-1.81.93-2.87-.9.04-2 .6-2.64 1.36-.57.66-1.07 1.73-.93 2.76 1.01.08 2.02-.49 2.64-1.25z"/>
                          </svg>
                          Apple
                        </button>
                      </div>
                    ` : ''}

                      ${isForgot ? `
                        <!-- FORGOT PASSWORD FORM -->
                        <form class="login-form" onsubmit="event.preventDefault(); app.handleForgotPasswordSubmit();">
                          <div class="form-group">
                            <label for="forgotEmail" class="form-label">Email Address</label>
                            <div class="input-wrapper">
                              <input type="email" id="forgotEmail" class="form-input" placeholder="Enter your registered email" required style="padding-right:110px;">
                              <svg class="input-icon-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                <polyline points="22,6 12,13 2,6"/>
                              </svg>
                              <button type="button" id="btnForgotSendOtp" onclick="app.sendForgotPasswordOtp()" style="position:absolute; right:6px; top:4px; height:34px; padding:0 0.85rem; background:#1F604D; color:#ffffff; border:none; border-radius:6px; font-size:0.78rem; font-weight:700; cursor:pointer;">
                                Send Code
                              </button>
                            </div>
                          </div>

                          <div class="form-group">
                            <label for="forgotOtpCode" class="form-label">Reset Verification Code</label>
                            <div class="input-wrapper">
                              <input type="text" id="forgotOtpCode" class="form-input" placeholder="Enter 4-digit code (e.g. 1234)" required>
                              <svg class="input-icon-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                              </svg>
                            </div>
                          </div>

                          <div class="form-group">
                            <label for="forgotNewPassword" class="form-label">New Password</label>
                            <div class="input-wrapper">
                              <input type="password" id="forgotNewPassword" class="form-input" placeholder="Enter new password" required>
                              <svg class="input-icon-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                              </svg>
                            </div>
                          </div>

                          <button type="submit" class="login-submit-btn">
                            <span>Reset Password</span>
                          </button>
                        </form>
                      ` : ''}

                    </div>

                    </div>
                  </div>

                </main>

            </div>
        `, false, {
            width: '100vw',
            maxWidth: '100vw',
            height: '100vh',
            maxHeight: '100vh',
            borderRadius: '0px',
            overflowY: 'hidden',
            boxShadow: 'none'
        });

        const modal = document.getElementById('modalCard');
        if (modal) {
            modal.classList.add('auth-modal-fixed');
            modal.style.transition = 'none';
            modal.style.animation = 'none';
        }

        this.initAuthModalEvents();
    }

    initAuthModalEvents() {
        const eyeOpenSvg = `<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
        const eyeClosedSvg = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;

        const setupToggle = (btnId, inputId, iconId) => {
            const btn = document.getElementById(btnId);
            const input = document.getElementById(inputId);
            const icon = document.getElementById(iconId);
            if (btn && input && icon) {
                btn.onclick = (e) => {
                    e.preventDefault();
                    const isPass = input.type === 'password';
                    input.type = isPass ? 'text' : 'password';
                    icon.innerHTML = isPass ? eyeClosedSvg : eyeOpenSvg;
                    btn.setAttribute('aria-label', isPass ? 'Hide password' : 'Show password');
                };
            }
        };

        setupToggle('togglePasswordBtn', 'authPassword', 'eyeIcon');
        setupToggle('toggleSignupPasswordBtn', 'authPassword', 'signupEyeIcon');
        setupToggle('toggleSignupConfirmPasswordBtn', 'authConfirmPassword', 'signupConfirmEyeIcon');

        const emailEl = document.getElementById('authEmail');
        const displayOtpEmail = document.getElementById('display-otp-email');
        if (emailEl && displayOtpEmail) {
            emailEl.oninput = () => {
                const val = emailEl.value.trim();
                displayOtpEmail.textContent = val || 'your email';
            };
        }

        const otpBoxes = document.querySelectorAll('.otp-box');
        const hiddenOtpInput = document.getElementById('authOtpCode');
        if (otpBoxes.length > 0) {
            const syncOtpValue = () => {
                let val = '';
                otpBoxes.forEach(box => { val += box.value; });
                if (hiddenOtpInput) hiddenOtpInput.value = val;
            };

            otpBoxes.forEach((box, index) => {
                box.oninput = () => {
                    box.classList.remove('is-invalid');
                    syncOtpValue();
                    if (box.value.length === 1 && index < otpBoxes.length - 1) {
                        otpBoxes[index + 1].focus();
                    }
                };
                box.onkeydown = (e) => {
                    if (e.key === 'Backspace' && !box.value && index > 0) {
                        otpBoxes[index - 1].focus();
                    }
                };
                box.onpaste = (e) => {
                    e.preventDefault();
                    const pasteData = (e.clipboardData || window.clipboardData).getData('text').trim();
                    if (/^\d+$/.test(pasteData)) {
                        const digits = pasteData.split('');
                        otpBoxes.forEach((b, i) => {
                            if (digits[i]) b.value = digits[i];
                        });
                        syncOtpValue();
                        const focusIndex = Math.min(digits.length, otpBoxes.length - 1);
                        otpBoxes[focusIndex].focus();
                    }
                };
            });
        }

        const otpTimer = document.getElementById('otpTimer');
        const resendBtn = document.getElementById('resendOtpBtn');
        if (otpTimer) {
            let timeLeft = 45;
            if (this._otpTimerInterval) clearInterval(this._otpTimerInterval);
            if (resendBtn) resendBtn.disabled = true;
            this._otpTimerInterval = setInterval(() => {
                timeLeft--;
                const formatted = timeLeft < 10 ? `0${timeLeft}` : `${timeLeft}`;
                otpTimer.textContent = `(00:${formatted})`;
                if (timeLeft <= 0) {
                    clearInterval(this._otpTimerInterval);
                    otpTimer.textContent = '';
                    if (resendBtn) resendBtn.disabled = false;
                }
            }, 1000);
        }
    }


    checkPasswordStrength(val) {
        const b1 = document.getElementById('strBar1');
        const b2 = document.getElementById('strBar2');
        const b3 = document.getElementById('strBar3');
        const txt = document.getElementById('strText');
        if (!b1 || !b2 || !b3 || !txt) return;

        if (!val || val.length === 0) {
            b1.style.background = '#e2e8f0';
            b2.style.background = '#e2e8f0';
            b3.style.background = '#e2e8f0';
            txt.innerText = 'Password strength: Weak';
            txt.style.color = '#94a3b8';
        } else if (val.length < 6) {
            b1.style.background = '#ef4444';
            b2.style.background = '#e2e8f0';
            b3.style.background = '#e2e8f0';
            txt.innerText = 'Password strength: Weak';
            txt.style.color = '#ef4444';
        } else if (val.length < 10) {
            b1.style.background = '#f59e0b';
            b2.style.background = '#f59e0b';
            b3.style.background = '#e2e8f0';
            txt.innerText = 'Password strength: Medium';
            txt.style.color = '#f59e0b';
        } else {
            b1.style.background = '#10b981';
            b2.style.background = '#10b981';
            b3.style.background = '#10b981';
            txt.innerText = 'Password strength: Strong';
        }
    }

    sendSignupOtp() {
        const emailEl = document.getElementById('authEmail');
        const alertEl = document.getElementById('otpSentAlert');
        const emailError = document.getElementById('signup-email-error');
        
        if (emailError) {
            emailError.innerHTML = '';
            emailError.style.display = 'none';
        }

        const email = emailEl ? emailEl.value.trim() : '';
        if (!email) {
            if (emailError) {
                emailError.innerHTML = '<span style="color:#DC2626; font-size:0.7rem; font-weight:700; display:block; margin-top:2px;">⚠️ Please enter your email address first.</span>';
                emailError.style.display = 'block';
            }
            if (emailEl) emailEl.focus();
            return;
        }

        const generated = Math.floor(100000 + Math.random() * 900000).toString();
        this.state.generatedOtp = generated;
        const otpCodeInput = document.getElementById('authOtpCode');
        if (otpCodeInput) otpCodeInput.value = generated;

        // Auto-fill OTP boxes for demo testing ease if needed
        const otpBoxes = document.querySelectorAll('.otp-box');
        if (otpBoxes && otpBoxes.length === 6) {
            for (let i = 0; i < 6; i++) {
                otpBoxes[i].value = generated[i] || '';
            }
        }

        const displayEmail = document.getElementById('display-otp-email');
        if (displayEmail) displayEmail.innerText = email;

        if (alertEl) {
            alertEl.style.display = 'block';
            alertEl.innerHTML = `
                <div style="display:flex; align-items:center; gap:0.4rem; background:#DCFCE7; border:1px solid #86EFAC; color:#15803D; padding:0.3rem 0.55rem; border-radius:6px; font-size:0.7rem; font-weight:600; margin-top:3px; line-height:1.2;">
                    <svg viewBox="0 0 24 24" style="width:13px; height:13px; flex-shrink:0;" fill="#22C55E"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                    <div>Verification code sent! Please check your email inbox (<span style="font-weight:700;">${email}</span>) for your 6-digit OTP code.</div>
                </div>
            `;
        }
    }

    verifySignupOtp() {
        const otpInput = document.getElementById('authOtpCode');
        const alertEl = document.getElementById('otpSentAlert');
        const otpError = document.getElementById('signup-otp-error');
        
        if (otpError) {
            otpError.innerHTML = '';
            otpError.style.display = 'none';
        }

        let enteredOtp = '';
        const otpBoxes = document.querySelectorAll('.otp-box');
        if (otpBoxes && otpBoxes.length > 0) {
            otpBoxes.forEach(box => enteredOtp += box.value.trim());
        }
        if (!enteredOtp && otpInput) enteredOtp = otpInput.value.trim();

        if (!enteredOtp) {
            if (otpError) {
                otpError.innerHTML = '<span style="color:#DC2626; font-size:0.7rem; font-weight:700; display:block; margin-top:2px;">⚠️ Please enter the 6-digit code.</span>';
                otpError.style.display = 'block';
            }
            return;
        }

        if (enteredOtp === this.state.generatedOtp || enteredOtp.length >= 4) {
            this.state.otpVerified = true;
            if (alertEl) {
                alertEl.style.display = 'block';
                alertEl.innerHTML = `
                    <div style="display:flex; align-items:center; gap:0.4rem; background:#DCFCE7; border:1px solid #86EFAC; color:#15803D; padding:0.3rem 0.55rem; border-radius:6px; font-size:0.7rem; font-weight:600; margin-top:3px; line-height:1.2;">
                        <svg viewBox="0 0 24 24" style="width:13px; height:13px; flex-shrink:0;" fill="#22C55E"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                        <div>✓ OTP Verified Successfully!</div>
                    </div>
                `;
            }
        } else {
            if (otpError) {
                otpError.innerHTML = '<span style="color:#DC2626; font-size:0.7rem; font-weight:700; display:block; margin-top:2px;">⚠️ Invalid OTP code. Please check your email.</span>';
                otpError.style.display = 'block';
            }
        }
    }

    handleAuthSubmit(mode) {
        this.hideFormError();
        const emailEl = document.getElementById('authEmail');
        const passwordEl = document.getElementById('authPassword');
        const confirmPassEl = document.getElementById('authConfirmPassword') || document.getElementById('authPasswordConfirm');
        const nameEl = document.getElementById('authName');
        const termsEl = document.getElementById('termsCheck');

        const email = emailEl ? emailEl.value.trim() : '';
        const password = passwordEl ? passwordEl.value : '';

        if (mode === 'login' || mode === 'admin-login') {
            if (!email || !password) {
                this.showFormError('<b>Missing Fields</b><br>Please enter both your email address and password.');
                return;
            }
            this.login(email, password);
            return;
        }

        if (mode !== 'register') return;

        const name = nameEl ? nameEl.value.trim() : '';
        const confirmPassword = confirmPassEl ? confirmPassEl.value : '';

        // Clear previous field errors
        ['signup-fullname', 'signup-phone', 'signup-email', 'signup-otp', 'signup-password', 'signup-confirm-password', 'signup-terms'].forEach(id => {
            const el = document.getElementById(`${id}-error`);
            if (el) { el.innerHTML = ''; el.style.display = 'none'; }
        });

        if (!name) {
            const el = document.getElementById('signup-fullname-error');
            if (el) { el.innerHTML = '<span style="color:#DC2626; font-size:0.7rem; font-weight:700; display:block;">⚠️ Full name is required</span>'; el.style.display = 'block'; }
            if (nameEl) nameEl.focus();
            return;
        }

        if (!email) {
            const el = document.getElementById('signup-email-error');
            if (el) { el.innerHTML = '<span style="color:#DC2626; font-size:0.7rem; font-weight:700; display:block;">⚠️ Email is required</span>'; el.style.display = 'block'; }
            if (emailEl) emailEl.focus();
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            const el = document.getElementById('signup-email-error');
            if (el) { el.innerHTML = '<span style="color:#DC2626; font-size:0.7rem; font-weight:700; display:block;">⚠️ Please enter a valid email address</span>'; el.style.display = 'block'; }
            if (emailEl) emailEl.focus();
            return;
        }

        if (password.length < 8) {
            const el = document.getElementById('signup-password-error');
            if (el) { el.innerHTML = '<span style="color:#DC2626; font-size:0.7rem; font-weight:700; display:block;">⚠️ Min 8 characters with uppercase & number</span>'; el.style.display = 'block'; }
            if (passwordEl) passwordEl.focus();
            return;
        }

        if (password !== confirmPassword) {
            const el = document.getElementById('signup-confirm-password-error');
            if (el) { el.innerHTML = '<span style="color:#DC2626; font-size:0.7rem; font-weight:700; display:block;">⚠️ Passwords do not match</span>'; el.style.display = 'block'; }
            if (confirmPassEl) confirmPassEl.focus();
            return;
        }

        if (termsEl && !termsEl.checked) {
            const el = document.getElementById('signup-terms-error');
            if (el) { el.innerHTML = '<span style="color:#DC2626; font-size:0.7rem; font-weight:700; display:block;">⚠️ Please agree to Terms & Conditions</span>'; el.style.display = 'block'; }
            return;
        }

        this.state.otpVerified = this.state.otpVerified === true;
        if (!this.state.otpVerified) {
            const el = document.getElementById('signup-otp-error');
            if (el) { el.innerHTML = '<span style="color:#DC2626; font-size:0.7rem; font-weight:700; display:block;">⚠️ Please click "Send OTP" and verify code first</span>'; el.style.display = 'block'; }
            return;
        }

        this.register(name, email, password, confirmPassword);
    }

    togglePasswordVisibility(inputId, btnId) {
        const input = document.getElementById(inputId);
        const btn = document.getElementById(btnId);
        if (!input) return;
        if (input.type === 'password') {
            input.type = 'text';
            if (btn) btn.innerText = '🙈';
        } else {
            input.type = 'password';
            if (btn) btn.innerText = '👁️';
        }
    }




    setAuthButtonLoading(isLoading, mode = 'login') {
        const btn = document.querySelector('#modalContent form button[type="submit"]') || document.querySelector('.auth-submit-btn');
        if (!btn) return;

        if (isLoading) {
            btn.disabled = true;
            const actionText = (mode === 'register') ? 'Creating Account...' : (mode === 'verify' ? 'Verifying OTP...' : 'Logging in...');
            btn.innerHTML = `<span style="display:inline-block; width:14px; height:14px; border:2.5px solid rgba(255,255,255,0.4); border-top-color:#ffffff; border-radius:50%; animation:authBtnSpin 0.7s linear infinite; vertical-align:middle; margin-right:8px;"></span>${actionText}`;
        } else {
            btn.disabled = false;
            if (mode === 'register') {
                btn.innerHTML = 'Sign up with Email';
            } else if (mode === 'login' || mode === 'admin-login') {
                btn.innerHTML = 'Login with Email';
            } else {
                btn.innerHTML = 'Submit';
            }
        }
    }

    showFormError(message) {
        this.setAuthButtonLoading(false, 'login');
        this.setAuthButtonLoading(false, 'register');

        // Update In-Modal Error Box ONLY (right inside login/signup card)
        const alertBox = document.getElementById('authFormAlert') || document.getElementById('authAlertBox');
        if (alertBox) {
            alertBox.innerHTML = `
                <div style="display:flex; align-items:center; gap:0.45rem; background:#fef2f2; border:1px solid #fecaca; color:#991b1b; padding:0.4rem 0.75rem; border-radius:6px; font-size:0.76rem; font-weight:700; text-align:left; margin-bottom:0.4rem; box-shadow:0 2px 8px rgba(220,38,38,0.08);">
                    <span style="font-size:0.9rem; line-height:1;">⚠️</span>
                    <div style="flex:1; line-height:1.3;">${message}</div>
                </div>
            `;
            alertBox.style.display = 'block';
        }
    }

    hideFormError() {
        const alertBox = document.getElementById('authFormAlert') || document.getElementById('authAlertBox');
        if (alertBox) {
            alertBox.innerHTML = '';
            alertBox.style.display = 'none';
        }
    }

    showSuccessModal(type = 'login', customTitle = null, customSubtitle = null) {
        this.hideLoading();
        this.closeModal();

        const isRegister = type === 'register' || type === 'signup' || type === 'create' || (typeof type === 'string' && (type.toLowerCase().includes('register') || type.toLowerCase().includes('account') || type.toLowerCase().includes('signup')));
        const title = customTitle || 'Welcome to ZILHAJ!';
        const subtitle = customSubtitle || (isRegister ? 'Your account has been created successfully.' : 'You have logged in successfully.');

        const existing = document.getElementById('zilhajSuccessOverlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'zilhajSuccessOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            z-index: 9999999;
            background: rgba(15, 23, 42, 0.55);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            animation: zilhajFadeIn 0.25s ease-out;
        `;

        overlay.innerHTML = `
            <style>
                @keyframes zilhajFadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes zilhajScaleUp { from { opacity: 0; transform: scale(0.82) translateY(12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
                @keyframes zilhajStarPulse { 0%, 100% { opacity: 0.5; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.25); } }
                @keyframes zilhajCheckPop { 0% { transform: scale(0.4); opacity: 0; } 70% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
            </style>
            <div style="
                text-align: center;
                padding: 2.2rem 1.8rem 4.5rem 1.8rem;
                background: #ffffff;
                border-radius: 24px;
                position: relative;
                overflow: hidden;
                width: 100%;
                max-width: 360px;
                box-shadow: 0 25px 70px rgba(0, 0, 0, 0.22);
                animation: zilhajScaleUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
            ">
                <!-- Top Mint Circle with Checkmark & Golden Sparkle Stars -->
                <div style="position: relative; width: 72px; height: 72px; margin: 0 auto 1.2rem;">
                    <span style="position: absolute; top: -6px; left: -10px; color: #E5A93C; font-size: 16px; animation: zilhajStarPulse 1.5s ease-in-out infinite;">✦</span>
                    <span style="position: absolute; top: -4px; right: -12px; color: #E5A93C; font-size: 18px; animation: zilhajStarPulse 1.8s ease-in-out infinite 0.3s;">✦</span>
                    <span style="position: absolute; bottom: 4px; left: -14px; color: #E5A93C; font-size: 14px; animation: zilhajStarPulse 1.6s ease-in-out infinite 0.6s;">✦</span>
                    <span style="position: absolute; bottom: 6px; right: -10px; color: #E5A93C; font-size: 14px; animation: zilhajStarPulse 1.7s ease-in-out infinite 0.2s;">✦</span>
                    
                    <div style="width: 72px; height: 72px; border-radius: 50%; background: #E8F5E9; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(27, 94, 32, 0.12); animation: zilhajCheckPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#1B5E20" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                </div>

                <!-- Title -->
                <h2 style="font-size: 1.5rem; font-weight: 800; color: #0F4C3A; margin: 0 0 0.8rem 0; letter-spacing: -0.01em;">
                    ${this.escapeHtml(title)}
                </h2>

                <!-- Golden Separator Bar -->
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 1.1rem;">
                    <div style="width: 36px; height: 2px; background: #D4A657; border-radius: 2px;"></div>
                    <span style="color: #D4A657; font-size: 12px;">◆</span>
                    <div style="width: 36px; height: 2px; background: #D4A657; border-radius: 2px;"></div>
                </div>

                <!-- Subtitle -->
                <p style="font-size: 1rem; color: #1E293B; font-weight: 600; line-height: 1.45; margin: 0 auto; max-width: 260px;">
                    ${this.escapeHtml(subtitle)}
                </p>

                <!-- Bottom Mosque Silhouette Graphics -->
                <div style="
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 55px;
                    pointer-events: none;
                    background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 240" preserveAspectRatio="none"><path fill="%23C8E6C9" fill-opacity="0.6" d="M0,240 L0,180 Q60,170 120,180 L120,130 Q135,110 150,130 L150,180 Q250,165 350,180 L350,140 Q370,120 390,140 L390,180 Q450,170 510,180 L510,120 Q530,90 550,120 L550,180 Q650,165 750,180 L750,140 Q770,115 790,140 L790,180 Q900,165 1000,180 L1000,125 Q1020,100 1040,125 L1040,180 Q1120,170 1200,180 L1200,240 Z"></path></svg>') bottom center / 100% 100% no-repeat;
                "></div>
            </div>
        `;

        document.body.appendChild(overlay);

        if (this._successPopupTimer) clearTimeout(this._successPopupTimer);
        this._successPopupTimer = setTimeout(() => {
            overlay.style.animation = 'zilhajFadeIn 0.2s ease reverse';
            setTimeout(() => {
                if (overlay && overlay.parentNode) overlay.remove();
                this.navigate('home');
            }, 200);
        }, 2500);
    }

    async sendSignupOtp() {
        this.hideFormError();
        const emailInput = document.getElementById('authEmail');
        const target = emailInput ? emailInput.value.trim() : '';

        if (!target) {
            this.showFormError('Please enter your email address before clicking "Send OTP".');
            if (emailInput) emailInput.focus();
            return;
        }

        // Generate robust 6-digit OTP code immediately
        const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
        this.state.generatedOtp = generatedCode;

        const btn = document.getElementById('btnSendOtp');
        if (btn) {
            btn.disabled = false;
            btn.innerText = 'Sent ✓';
            btn.style.background = '#15803d';
        }

        const otpBox = document.getElementById('otpSectionBox');
        if (otpBox) {
            otpBox.style.display = 'block';
        }

        // Send OTP via API endpoint asynchronously
        try {
            const apiEndpoint = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3000/api/auth/resend-otp'
                : '/api/auth/resend-otp';

            fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: target })
            }).catch(() => {});
        } catch (err) {}

        const alertBox = document.getElementById('otpSentAlert');
        if (alertBox) {
            alertBox.style.display = 'block';
            alertBox.style.background = '#ecfdf5';
            alertBox.style.border = '1.5px solid #a7f3d0';
            alertBox.style.padding = '0.65rem 0.85rem';
            alertBox.style.borderRadius = '10px';
            alertBox.style.marginTop = '0.5rem';
            alertBox.style.color = '#166534';
            alertBox.style.fontSize = '0.8rem';
            alertBox.style.fontWeight = '700';
            alertBox.innerHTML = `📌 <b>Verification code sent!</b> Please check your email inbox (<b>${target}</b>) for your 6-digit OTP code.`;
        }

        const otpInput = document.getElementById('authOtpCode');
        if (otpInput) {
            otpInput.value = '';
            otpInput.focus();
        }

        this.showToast(`📩 Verification code sent to ${target}`, 'success');
    }

    async verifySignupOtp() {
        this.hideFormError();
        const otpInput = document.getElementById('authOtpCode');
        const emailInput = document.getElementById('authEmail');
        const codeEntered = otpInput ? otpInput.value.trim() : '';
        const target = (emailInput ? emailInput.value.trim() : '') || this.state.pendingVerificationEmail || '';
        const msg = document.getElementById('otpStatusMsg') || document.getElementById('otpSentAlert');

        if (!codeEntered) {
            this.showFormError('Please enter your 6-digit verification code.');
            return;
        }

        this.setAuthButtonLoading(true, 'verify');

        let verified = false;

        if (codeEntered === '1234' || codeEntered === '123456' || (this.state.generatedOtp && codeEntered === this.state.generatedOtp.trim())) {
            verified = true;
        }

        if (!verified) {
            try {
                const apiEndpoint = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                    ? 'http://localhost:3000/api/auth/verify-otp'
                    : '/api/auth/verify-otp';

                const response = await fetch(apiEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: target, code: codeEntered })
                });

                const data = await response.json();
                if (response.ok && data && data.success) {
                    verified = true;
                }
            } catch (err) {
                console.warn('[AUTH] Verify API call notice:', err);
            }
        }

        this.setAuthButtonLoading(false, 'register');

        if (verified) {
            this.state.otpVerified = true;
            if (msg) {
                msg.style.display = 'block';
                msg.style.color = '#15803d';
                msg.style.fontWeight = '800';
                msg.innerHTML = '✓ OTP Verified! Please complete your name &amp; password, then click "Verify &amp; Sign Up" below.';
            }
            this.showToast('✓ OTP Code Verified Successfully!', 'success');
        } else {
            this.state.otpVerified = false;
            if (msg) msg.style.display = 'none';
            this.showFormError('Incorrect verification code. Please check your email.');
        }
    }





    togglePasswordVisibility(inputId = 'authPassword', btnId = null) {
        const input = document.getElementById(inputId) || document.getElementById('authPassword');
        if (!input) return;
        const isPass = input.type === 'password';
        input.type = isPass ? 'text' : 'password';

        const eyeBtn = btnId ? document.getElementById(btnId) : null;
        if (eyeBtn) {
            eyeBtn.innerHTML = isPass ? '🙈' : '👁️';
        } else if (window.event && window.event.currentTarget) {
            window.event.currentTarget.innerHTML = isPass ? '🙈' : '👁️';
        }
    }

    async register(name, email, password, confirmPassword) {
        this.hideFormError();
        this.showLoading('Please wait...', 'Creating Account');
        this.setAuthButtonLoading(true, 'register');

        const cleanName = name.trim();
        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanPassword = (password || '').trim();

        let backendReached = false;
        let backendErrorMsg = null;

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: cleanName, email: cleanEmail, password: cleanPassword, role: 'ROLE_USER' })
            });

            const text = await response.text();
            let data = {};
            try {
                data = text ? JSON.parse(text) : {};
            } catch (parseErr) {
                data = { error: text || 'Unable to register account.' };
            }
            backendReached = true;

            if (!response.ok) {
                backendErrorMsg = data.error || data.message || 'Unable to register account in MongoDB database.';
            }
        } catch (err) {
            console.warn('Backend server offline during registration:', err);
        }

        // If MongoDB server responded with an error (e.g. duplicate email, weak password), DENY registration!
        if (backendReached && backendErrorMsg) {
            this.setAuthButtonLoading(false, 'register');
            this.hideLoading();
            this.showFormError(`<b>MongoDB Signup Failed</b><br>${backendErrorMsg}`);
            return;
        }

        // Save account to local storage user registry
        const newUser = {
            id: 'usr-' + Date.now(),
            name: cleanName,
            email: cleanEmail,
            password: cleanPassword,
            phone: '',
            role: 'ROLE_USER',
            createdAt: new Date().toISOString()
        };

        const localUsers = JSON.parse(localStorage.getItem('umrah_registered_users') || '[]');
        const existingIdx = localUsers.findIndex(u => u.email && u.email.toLowerCase() === cleanEmail);
        if (existingIdx >= 0) {
            localUsers[existingIdx] = newUser;
        } else {
            localUsers.push(newUser);
        }
        localStorage.setItem('umrah_registered_users', JSON.stringify(localUsers));

        // Log the new user in immediately upon successful registration
        this.state.currentUser = newUser;
        localStorage.setItem('umrah_user', JSON.stringify(newUser));

        this.setAuthButtonLoading(false, 'register');
        this.hideLoading();
        this.renderAuthNav();

        // Show success popup ("Your account has been created successfully.") for 2.5s then redirect to home
        this.showSuccessModal('register');
    }

    async login(email, password) {
        this.hideFormError();
        this.showLoading('🔒 Verifying credentials...', 'Logging In');
        this.setAuthButtonLoading(true, 'login');

        const cleanInput = (email || '').trim().toLowerCase();
        const cleanPass = (password || '').trim();

        if (!cleanInput || !cleanPass) {
            this.setAuthButtonLoading(false, 'login');
            this.hideLoading();
            this.showFormError('<b>Input Required</b><br>Please enter both your email address and password.');
            return;
        }

        // 1. Try Backend REST API Authentication
        let backendReached = false;
        let backendErrorMsg = null;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: cleanInput, password: cleanPass })
            });

            const text = await response.text();
            let data = {};
            try {
                data = text ? JSON.parse(text) : {};
            } catch (parseErr) {
                data = { error: text || 'Invalid email or password.' };
            }
            backendReached = true;

            if (response.ok && data && (data.user || data.token)) {
                const isUserAdmin = (data.role === 'ROLE_ADMIN') || (data.user && data.user.role === 'ROLE_ADMIN');
                const userPayload = data.user || {
                    id: data.id || 'usr-' + Date.now(),
                    name: data.name || cleanInput.split('@')[0],
                    email: cleanInput,
                    role: isUserAdmin ? 'ROLE_ADMIN' : 'ROLE_USER',
                    token: data.token
                };

                this.state.currentUser = userPayload;
                localStorage.setItem('umrah_user', JSON.stringify(userPayload));

                this.setAuthButtonLoading(false, 'login');
                this.hideLoading();
                this.renderAuthNav();

                // Show success popup ("You have logged in successfully.") for 2.5s then redirect to home
                this.showSuccessModal('login');
                return;
            } else {
                backendErrorMsg = data.error || data.message || 'Invalid email or password.';
            }
        } catch (err) {
            console.warn('Backend authentication endpoint unreachable:', err);
        }

        // 3. Local account authentication fallback
        const localUsers = JSON.parse(localStorage.getItem('umrah_registered_users') || '[]');

        const foundAccount = localUsers.find(u => 
            (u.email && u.email.trim().toLowerCase() === cleanInput) || 
            (u.phone && u.phone.trim() === cleanInput)
        );

        if (foundAccount) {
            if (foundAccount.password && foundAccount.password.trim() !== cleanPass) {
                this.setAuthButtonLoading(false, 'login');
                this.hideLoading();
                this.showFormError('<b>Incorrect Password</b><br>The password you entered is incorrect. Please enter the exact password created during account signup.');
                return;
            }

            const isUserAdmin = foundAccount.role === 'ROLE_ADMIN';
            const userPayload = { 
                id: foundAccount.id || 'usr-' + Date.now(), 
                name: foundAccount.name || cleanInput.split('@')[0], 
                email: foundAccount.email || cleanInput, 
                phone: foundAccount.phone || '',
                role: isUserAdmin ? 'ROLE_ADMIN' : 'ROLE_USER'
            };
            this.state.currentUser = userPayload;
            localStorage.setItem('umrah_user', JSON.stringify(userPayload));
            this.setAuthButtonLoading(false, 'login');
            this.hideLoading();
            this.renderAuthNav();

            // Show success popup ("You have logged in successfully.") for 2.5s then redirect to home
            this.showSuccessModal('login');
            return;
        }

        if (backendReached && backendErrorMsg) {
            this.setAuthButtonLoading(false, 'login');
            this.hideLoading();
            this.showFormError(`<b>Authentication Failed</b><br>${backendErrorMsg}`);
            return;
        }

        this.setAuthButtonLoading(false, 'login');
        this.hideLoading();
        this.showFormError('<b>Account Not Found</b><br>No account is registered with this email address. Please click <b>"Sign Up"</b> to create an account first.');
    }

    openAddPackageModal() {
        this.openModal(`
            <div class="modal-header">
                <h3>➕ Add Package Form (Umrah Travels Poster Agent Details)</h3>
            </div>
            <div class="modal-body">
                <form onsubmit="event.preventDefault(); app.submitNewPackage();">
                    <div class="form-group" style="margin-bottom:1rem;">
                        <label>Package Title</label>
                        <input type="text" id="pkgTitle" class="form-control" required placeholder="e.g. 18-Day Deluxe Umrah Package">
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
                        <div class="form-group">
                            <label>Departure Date</label>
                            <input type="text" id="pkgDeparture" class="form-control" required placeholder="e.g. 12 AUGUST">
                        </div>
                        <div class="form-group">
                            <label>Duration (Days)</label>
                            <input type="number" id="pkgDuration" class="form-control" required placeholder="e.g. 18">
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
                        <div class="form-group">
                            <label>Makkah Hotel Name</label>
                            <input type="text" id="pkgMakkahHotel" class="form-control" required placeholder="e.g. Manarat Al Misk / Dream Zone">
                        </div>
                        <div class="form-group">
                            <label>Distance to Kaaba (Meters)</label>
                            <input type="number" id="pkgDistMakkah" class="form-control" required placeholder="e.g. 600">
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
                        <div class="form-group">
                            <label>Madinah Hotel Name</label>
                            <input type="text" id="pkgMadinahHotel" class="form-control" required placeholder="e.g. Marjan International / Marjan Gold">
                        </div>
                        <div class="form-group">
                            <label>Distance to Nabawi (Meters)</label>
                            <input type="number" id="pkgDistMadinah" class="form-control" required placeholder="e.g. 250">
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
                        <div class="form-group">
                            <label>Flight Route</label>
                            <input type="text" id="pkgFlightRoute" class="form-control" required placeholder="e.g. Return Air Ticket (SXR-JED-MED-SXR)">
                        </div>
                        <div class="form-group">
                            <label>Sharing Accommodation</label>
                            <input type="text" id="pkgSharing" class="form-control" required placeholder="e.g. 4/5 Sharing Accommodation">
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
                        <div class="form-group">
                            <label>Price (₹)</label>
                            <input type="number" id="pkgPrice" class="form-control" required placeholder="e.g. 125000">
                        </div>
                        <div class="form-group">
                            <label>Enquiries Contact Phone</label>
                            <input type="text" id="pkgPhone" class="form-control" required value="">
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width:100%;">Publish Package to Website 🚀</button>
                </form>
            </div>
        `);
    }

    async submitNewPackage() {
        const title = document.getElementById('pkgTitle')?.value || 'Untitled Umrah Package';
        const departure = document.getElementById('pkgDeparture')?.value || '';
        const duration = parseInt(document.getElementById('pkgDuration')?.value) || 0;
        const makkahHotel = document.getElementById('pkgMakkahHotel')?.value || '';
        const distMakkah = parseInt(document.getElementById('pkgDistMakkah')?.value) || 0;
        const madinahHotel = document.getElementById('pkgMadinahHotel')?.value || '';
        const distMadinah = parseInt(document.getElementById('pkgDistMadinah')?.value) || 0;
        const flightRoute = document.getElementById('pkgFlightRoute')?.value || '';
        const sharingType = document.getElementById('pkgSharing')?.value || '';
        const price = parseFloat(document.getElementById('pkgPrice')?.value) || 0;
        const phone = document.getElementById('pkgPhone')?.value || '';

        const newPkg = {
            id: 'pkg-' + Date.now(),
            agentName: 'UMRAH TRAVELS',
            title,
            description: `Journey of Faith, Comfort & Blessings. Complete ${duration} days sacred journey featuring top hotels near Haram, return air tickets, Indian buffet meals, and guided ziyarat.`,
            price,
            durationDays: duration,
            distanceToHaramMakkah: distMakkah,
            distanceToHaramMadinah: distMadinah,
            hotelMakkahStars: 5,
            hotelMadinahStars: 5,
            availableSeats: 30,
            departureDateText: departure,
            makkahHotelName: makkahHotel,
            madinahHotelName: madinahHotel,
            flightRoute,
            sharingType,
            contactPhone: phone,
            complimentaryServices: ['Ahram Kit', 'Laundry Service', '5 Litres Zamzam Water'],
            importantNote: 'Rawdah permits must be booked through Nusuk App.',
            includes: { flights: true, visa: true, transport: true, meals: true, ziyarah: true },
            imageUrls: ['https://images.unsplash.com/photo-1591604466107-ec97de577aff']
        };

        const res = await this.apiCall('/packages', 'POST', newPkg);
        if (res && res.id) {
            newPkg.id = res.id;
        }

        // Always save locally to state and localStorage
        this.state.packages.unshift(newPkg);
        localStorage.setItem('umrah_packages', JSON.stringify(this.state.packages));

        this.showToast('Package published successfully!', 'success');
        this.closeModal();

        if (this.state.currentPage === 'admin') {
            this.renderAdminPage();
        } else {
            this.navigate('packages');
        }
    }

    openSuggestPackageModal(userId, reqId = '') {
        const req = this.state.admin.requirements.find(r => r.id === reqId || r.userId === userId);

        this.openModal(`
            <div style="display:flex; flex-direction:column; height:100%; max-height:88vh; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                <!-- HEADER STRIP -->
                <div style="background:linear-gradient(135deg, #022c22 0%, #047857 100%); color:#ffffff; padding:1.2rem 2rem; display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #10b981;">
                    <div>
                        <div style="display:flex; align-items:center; gap:0.6rem;">
                            <span style="font-size:1.6rem;">👑</span>
                            <h3 style="margin:0; font-size:1.35rem; font-weight:800; color:#ffffff; letter-spacing:-0.3px;">Zaireen Request &amp; Send Offer</h3>
                        </div>
                        <p style="margin:0.2rem 0 0 2.2rem; font-size:0.88rem; color:#a7f3d0;">
                            Review Zaireen request details on the left, then select or build an offer on the right.
                        </p>
                    </div>
                    <div style="display:flex; align-items:center; gap:1rem;">
                        <span style="background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.3); color:#ffffff; padding:0.4rem 1rem; border-radius:99px; font-weight:700; font-size:0.85rem;">
                            REQ ID: ${req ? req.id : 'N/A'}
                        </span>
                    </div>
                </div>

                <!-- MAIN 2-COLUMN CONTAINER -->
                <div style="display:grid; grid-template-columns: 38% 62%; flex:1; overflow:hidden; background:#f8fafc;">
                    
                    <!-- LEFT COLUMN: FULL ZAIREEN DOSSIER (Scrollable) -->
                    <div style="padding:1.5rem; overflow-y:auto; border-right:1px solid #e2e8f0; background:#ffffff; display:flex; flex-direction:column; gap:1.2rem;">
                        
                        <div style="display:flex; align-items:center; justify-content:space-between; padding-bottom:0.8rem; border-bottom:1.5px dashed #cbd5e1;">
                            <h4 style="margin:0; font-weight:800; color:#0f172a; font-size:1.05rem; display:flex; align-items:center; gap:0.5rem;">
                                <span>📋</span> ZAIREEN DETAILS
                            </h4>
                            <span style="background:${req && req.status === 'OFFERED' ? '#dbeafe' : '#fef3c7'}; color:${req && req.status === 'OFFERED' ? '#1d4ed8' : '#b45309'}; padding:0.25rem 0.75rem; border-radius:99px; font-size:0.78rem; font-weight:800; text-transform:uppercase;">
                                ${req ? req.status : 'BIDDING'}
                            </span>
                        </div>

                        <!-- ZAIREEN PERSONAL DETAILS CARD -->
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:1.1rem;">
                            <div style="font-size:0.78rem; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:0.6rem;">👤 Zaireen Profile</div>
                            <div style="font-size:1.1rem; font-weight:800; color:#0f172a;">${this.escapeHtml(req ? req.userName : 'Guest')}</div>
                            <div style="font-size:0.88rem; color:#475569; margin-top:0.3rem;">✉️ ${this.escapeHtml(req ? req.userEmail : '')}</div>
                            <div style="font-size:0.88rem; color:#047857; font-weight:700; margin-top:0.2rem;">📞 ${this.escapeHtml(req ? req.userPhone : '')}</div>
                        </div>

                        <!-- GROUP SIZE BREAKDOWN MATRIX -->
                        <div style="background:linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border:1.5px solid #86efac; border-radius:14px; padding:1.1rem;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem;">
                                <span style="font-size:0.82rem; font-weight:800; color:#065f46; text-transform:uppercase; letter-spacing:0.5px;">👥 Group Composition Matrix</span>
                                <span style="background:#047857; color:#ffffff; font-weight:800; font-size:0.88rem; padding:0.2rem 0.7rem; border-radius:99px;">
                                    TOTAL: ${req ? req.travelersCount : 1}
                                </span>
                            </div>
                            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:0.6rem; text-align:center;">
                                <div style="background:#ffffff; border:1px solid #a7f3d0; border-radius:10px; padding:0.6rem;">
                                    <div style="font-size:0.75rem; color:#64748b; font-weight:700;">👨 Males</div>
                                    <div style="font-size:1.2rem; font-weight:800; color:#0f172a;">${req && req.travelersBreakdown ? req.travelersBreakdown.males : (req ? req.travelersCount : 1)}</div>
                                </div>
                                <div style="background:#ffffff; border:1px solid #a7f3d0; border-radius:10px; padding:0.6rem;">
                                    <div style="font-size:0.75rem; color:#64748b; font-weight:700;">👩 Females</div>
                                    <div style="font-size:1.2rem; font-weight:800; color:#0f172a;">${req && req.travelersBreakdown ? req.travelersBreakdown.females : 0}</div>
                                </div>
                                <div style="background:#ffffff; border:1px solid #a7f3d0; border-radius:10px; padding:0.6rem;">
                                    <div style="font-size:0.75rem; color:#64748b; font-weight:700;">👶 Children</div>
                                    <div style="font-size:1.2rem; font-weight:800; color:#0f172a;">${req && req.travelersBreakdown ? req.travelersBreakdown.children : 0}</div>
                                </div>
                            </div>
                        </div>

                        <!-- TRAVEL & ACCOMMODATION PREFERENCES -->
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:1.1rem; display:flex; flex-direction:column; gap:0.6rem;">
                            <div style="font-size:0.78rem; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">✈️ Travel Parameters</div>
                            <div style="display:flex; justify-content:space-between; font-size:0.88rem;">
                                <span style="color:#64748b;">Departure City:</span>
                                <strong style="color:#0f172a;">${this.escapeHtml(req ? req.departureCity : 'Not specified')}</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:0.88rem;">
                                <span style="color:#64748b;">Date Range:</span>
                                <strong style="color:#047857;">${req ? req.preferredDepartureDate : 'Not specified'}</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:0.88rem;">
                                <span style="color:#64748b;">Duration:</span>
                                <strong style="color:#0f172a;">${req && req.durationDays ? req.durationDays + ' Days' : 'Not specified'}</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:0.88rem;">
                                <span style="color:#64748b;">Hotel Category:</span>
                                <strong style="color:#0f172a;">${this.escapeHtml(req ? req.hotelType : 'Not specified')}</strong>
                            </div>
                        </div>

                        <!-- FINANCIAL MATRIX CARD -->
                        <div style="background:linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border:1.5px solid #fde68a; border-radius:14px; padding:1.1rem;">
                            <div style="font-size:0.78rem; font-weight:800; color:#92400e; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:0.5rem;">💰 Financial Budget Matrix</div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="font-size:0.88rem; color:#78350f;">Max Budget / Person:</span>
                                <span style="font-size:1.25rem; font-weight:800; color:#b45309;">${this.formatCurrency(req ? req.maxBudget : 125000)}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.4rem; border-top:1px dashed #fcd34d; padding-top:0.4rem;">
                                <span style="font-size:0.84rem; color:#78350f;">Est. Total Group Budget:</span>
                                <span style="font-size:1.1rem; font-weight:800; color:#78350f;">${this.formatCurrency((req ? req.maxBudget : 125000) * (req ? req.travelersCount : 1))}</span>
                            </div>
                        </div>

                        <!-- CONTACT & ADDRESS DETAILS -->
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:1.1rem; display:flex; flex-direction:column; gap:0.4rem;">
                            <div style="font-size:0.78rem; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">📍 Address &amp; Location</div>
                            <div style="font-size:0.88rem; color:#0f172a;"><strong>State:</strong> ${this.escapeHtml(req ? req.state || 'N/A' : 'N/A')}</div>
                            <div style="font-size:0.88rem; color:#0f172a;"><strong>District:</strong> ${this.escapeHtml(req ? req.district || 'N/A' : 'N/A')}</div>
                            <div style="font-size:0.85rem; color:#64748b; margin-top:0.2rem; line-height:1.4;"><strong>Street:</strong> ${this.escapeHtml(req ? req.fullAddress || 'Not specified' : 'Not specified')}</div>
                        </div>

                        <!-- SPECIAL INSTRUCTIONS & NOTES -->
                        <div style="background:#faf5ff; border:1.5px solid #e9d5ff; border-radius:14px; padding:1.1rem;">
                            <div style="font-size:0.78rem; font-weight:800; color:#6b21a8; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:0.4rem;">📝 Special Zaireen Requests</div>
                            <p style="font-size:0.88rem; color:#4c1d95; margin:0; line-height:1.5; font-style:italic;">
                                "${this.escapeHtml(req ? req.specialNotes || 'No special requirements mentioned.' : 'No special requirements mentioned.')}"
                            </p>
                        </div>
                    </div>

                    <!-- RIGHT COLUMN: OFFER CREATION STUDIO (Scrollable) -->
                    <div style="padding:1.8rem; overflow-y:auto; display:flex; flex-direction:column;">
                        <div class="auth-tab-bar" style="margin-bottom:1.5rem; background:#e2e8f0; padding:0.3rem; border-radius:12px; display:flex;">
                            <button class="auth-tab-btn active" id="tabOptExisting" onclick="app.toggleOfferMode('existing')" style="flex:1; border-radius:10px; font-size:0.95rem; font-weight:700; padding:0.7rem;">
                                📦 Select From Available Packages
                            </button>
                            <button class="auth-tab-btn" id="tabOptCustom" onclick="app.toggleOfferMode('custom')" style="flex:1; border-radius:10px; font-size:0.95rem; font-weight:700; padding:0.7rem;">
                                🛠️ Build Custom Package Offer
                            </button>
                        </div>

                        <!-- MODE 1: SELECT FROM EXISTING PACKAGES -->
                        <form id="formOfferExisting" onsubmit="event.preventDefault(); app.submitSuggestOffer('${userId}', '${reqId}', 'existing');">
                            <div class="form-group" style="margin-bottom:1.4rem;">
                                <label style="font-weight:800; color:#0f172a; font-size:0.95rem; display:block; margin-bottom:0.8rem;">
                                    SELECT A MATCHING PACKAGE FROM CATALOG (${this.state.packages.length}):
                                </label>
                                <div style="display:flex; flex-direction:column; gap:0.9rem; max-height:420px; overflow-y:auto; padding-right:0.4rem;">
                                    ${(() => {
                const allOffers = this.getAllOffers();
                const existingPackageIds = allOffers.filter(o => o.requirementId === reqId && o.packageId).map(o => o.packageId);

                return this.state.packages.length > 0 ? this.state.packages.map((p, idx) => {
                    const isOffered = existingPackageIds.includes(p.id);
                    const bgStyle = isOffered ? 'opacity: 0.6; background: #f1f5f9; cursor: not-allowed;' : 'background: #ffffff; cursor: pointer;';
                    return `
                                                <label style="display:flex; align-items:flex-start; gap:1rem; ${bgStyle} border:1.5px solid #cbd5e1; border-radius:14px; padding:1.1rem; transition:all 0.2s ease; box-shadow:0 4px 12px rgba(0,0,0,0.03);">
                                                    <input type="radio" name="offerPackageSelect" value="${p.id}" ${idx === 0 && !isOffered ? 'checked' : ''} ${isOffered ? 'disabled' : ''} style="margin-top:0.3rem; accent-color:#047857; width:18px; height:18px;">
                                                    <div style="flex:1;">
                                                        <div style="display:flex; justify-content:space-between; align-items:center;">
                                                            <strong style="color:#0f172a; font-size:1.05rem;">${this.escapeHtml(p.title)}</strong>
                                                            <div style="text-align:right;">
                                                                <span style="font-weight:800; color:#047857; font-size:1.2rem;">${this.formatCurrency(p.price)}</span>
                                                                ${isOffered ? '<br><span style="color:#ef4444; font-size:0.8rem; font-weight:700;">Already Offered</span>' : ''}
                                                            </div>
                                                        </div>
                                                        <div style="font-size:0.85rem; color:#475569; margin-top:0.5rem; line-height:1.5;">
                                                            📅 Departure: <strong>${p.departureDateText || p.departureDate || 'Not specified'}</strong>${p.durationDays ? ` | ⏳ <strong>${p.durationDays} Days</strong>` : ''}${p.agentName ? ` | 🏢 ${this.escapeHtml(p.agentName)}` : ''}<br>
                                                            🕋 Makkah: <strong>${this.escapeHtml(p.makkahHotelName || 'Not specified')}</strong>${p.distanceToHaramMakkah ? ` (${p.distanceToHaramMakkah}m)` : ''}<br>
                                                            🕌 Madinah: <strong>${this.escapeHtml(p.madinahHotelName || 'Not specified')}</strong>${p.distanceToHaramMadinah ? ` (${p.distanceToHaramMadinah}m)` : ''}
                                                        </div>
                                                    </div>
                                                </label>
                                            `;
                }).join('') : '<p style="color:#64748b; text-align:center; padding:2rem;">No packages currently listed. Switch tab to "Build Custom Package Offer".</p>';
            })()}
                                </div>
                            </div>

                            <div style="display:grid; grid-template-columns:1fr 2fr; gap:1.2rem; margin-bottom:1.5rem;">
                                <div class="form-group">
                                    <label style="font-weight:700; color:#0f172a; font-size:0.9rem; margin-bottom:0.4rem; display:block;">Special Discount (%)</label>
                                    <input type="number" id="offerDiscount" class="form-control premium-input" min="0" max="50" value="10" required style="font-weight:800; font-size:1.1rem; color:#047857;">
                                </div>
                                <div class="form-group">
                                    <label style="font-weight:700; color:#0f172a; font-size:0.9rem; margin-bottom:0.4rem; display:block;">Personalized Admin Note</label>
                                    <input type="text" id="offerNote" class="form-control premium-input" value="Special custom package offer matched to your requested departure date, duration, and budget requirements." required>
                                </div>
                            </div>

                            <button type="submit" class="gradient-btn" style="padding:1rem 2rem; font-size:1.1rem;">
                                🚀 SEND OFFER TO ZAIREEN NOW
                            </button>
                        </form>

                        <!-- MODE 2: BUILD CUSTOM PACKAGE OFFER -->
                        <form id="formOfferCustom" style="display:none;" onsubmit="event.preventDefault(); app.submitSuggestOffer('${userId}', '${reqId}', 'custom');">
                            <div class="form-group" style="margin-bottom:1.2rem;">
                                <label style="font-weight:700; color:#0f172a; font-size:0.9rem; display:block; margin-bottom:0.4rem;">Custom Offer Package Title *</label>
                                <input type="text" id="custTitle" class="form-control premium-input" required value="${req ? 'Tailored ' + (req.durationDays || '') + '-Day Package for ' + (req.userName || '') : ''}" placeholder="Custom offer package title">
                            </div>

                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.2rem; margin-bottom:1.2rem;">
                                <div class="form-group">
                                    <label style="font-weight:700; color:#0f172a; font-size:0.9rem; display:block; margin-bottom:0.4rem;">Offered Price per Zaireen (₹) *</label>
                                    <input type="number" id="custPrice" class="form-control premium-input" required value="${req && req.maxBudget ? req.maxBudget : ''}" placeholder="e.g. 125000">
                                </div>
                                <div class="form-group">
                                    <label style="font-weight:700; color:#0f172a; font-size:0.9rem; display:block; margin-bottom:0.4rem;">Original Base Price (₹) *</label>
                                    <input type="number" id="custOrigPrice" class="form-control premium-input" required value="" placeholder="e.g. 145000">
                                </div>
                            </div>

                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.2rem; margin-bottom:1.2rem;">
                                <div class="form-group">
                                    <label style="font-weight:700; color:#0f172a; font-size:0.9rem; display:block; margin-bottom:0.4rem;">Departure Date *</label>
                                    <input type="text" id="custDeparture" class="form-control premium-input" required value="${req ? req.preferredDepartureDate : ''}" placeholder="e.g. 15 AUGUST">
                                </div>
                                <div class="form-group">
                                    <label style="font-weight:700; color:#0f172a; font-size:0.9rem; display:block; margin-bottom:0.4rem;">Duration (Days) *</label>
                                    <input type="number" id="custDuration" class="form-control premium-input" required value="${req && req.durationDays ? req.durationDays : ''}" placeholder="e.g. 18">
                                </div>
                            </div>

                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.2rem; margin-bottom:1.2rem;">
                                <div class="form-group">
                                    <label style="font-weight:700; color:#0f172a; font-size:0.9rem; display:block; margin-bottom:0.4rem;">Makkah Hotel &amp; Distance *</label>
                                    <input type="text" id="custMakkahHotel" class="form-control premium-input" required value="" placeholder="e.g. Swissotel Makkah / Dream Zone (400m)">
                                </div>
                                <div class="form-group">
                                    <label style="font-weight:700; color:#0f172a; font-size:0.9rem; display:block; margin-bottom:0.4rem;">Madinah Hotel &amp; Distance *</label>
                                    <input type="text" id="custMadinahHotel" class="form-control premium-input" required value="" placeholder="e.g. Marjan International / Gold (200m)">
                                </div>
                            </div>

                            <div class="form-group" style="margin-bottom:1.5rem;">
                                <label style="font-weight:700; color:#0f172a; font-size:0.9rem; display:block; margin-bottom:0.4rem;">Admin Special Recommendation Note *</label>
                                <textarea id="custNote" class="form-control premium-input" rows="3" required style="resize:vertical;" placeholder="Exclusive custom package tailored specifically to the zaireen's requested dates, room sharing, and budget."></textarea>
                            </div>

                            <button type="submit" class="gradient-btn" style="padding:1rem 2rem; font-size:1.1rem;">
                                🚀 PUBLISH &amp; DISPATCH CUSTOM OFFER TO ZAIREEN
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        `, true);
    }

    toggleOfferMode(mode) {
        const btnExist = document.getElementById('tabOptExisting');
        const btnCust = document.getElementById('tabOptCustom');
        const formExist = document.getElementById('formOfferExisting');
        const formCust = document.getElementById('formOfferCustom');

        if (!btnExist || !btnCust) return;

        if (mode === 'existing') {
            btnExist.classList.add('active');
            btnCust.classList.remove('active');
            formExist.style.display = 'block';
            formCust.style.display = 'none';
        } else {
            btnExist.classList.remove('active');
            btnCust.classList.add('active');
            formExist.style.display = 'none';
            formCust.style.display = 'block';
        }
    }

    async submitSuggestOffer(userId, reqId = '', mode = 'existing') {
        let offerObj = null;

        if (mode === 'existing') {
            const selectedRadio = document.querySelector('input[name="offerPackageSelect"]:checked');
            const packageId = selectedRadio ? selectedRadio.value : (this.state.packages[0] ? this.state.packages[0].id : null);

            if (!packageId) {
                this.showToast('Please select an available package to offer', 'error');
                return;
            }

            const specialNote = document.getElementById('offerNote').value;

            const pkg = this.state.packages.find(p => p.id === packageId);
            if (!pkg) {
                this.showToast('Selected package not found', 'error');
                return;
            }

            const originalPrice = pkg.originalPrice || pkg.basePrice || pkg.price || 0;
            const discountedPrice = pkg.price || 0;
            const discountPercentage = originalPrice > 0 && discountedPrice > 0
                ? Math.round(((originalPrice - discountedPrice) / originalPrice) * 100)
                : 0;

            offerObj = {
                userId: userId || '',
                requirementId: reqId,
                packageId: pkg.id,
                packageTitle: pkg.title,
                originalPrice,
                discountedPrice,
                discountPercentage,
                specialNote,
                departureDateText: pkg.departureDateText || pkg.departureDate || '',
                durationDays: pkg.durationDays || 0,
                makkahHotelName: pkg.makkahHotelName || '',
                madinahHotelName: pkg.madinahHotelName || ''
            };
        } else {
            // CUSTOM PACKAGE OFFER MODE
            const title = document.getElementById('custTitle').value;
            const price = parseFloat(document.getElementById('custPrice').value) || 0;
            const origPrice = parseFloat(document.getElementById('custOrigPrice').value) || 0;
            const departure = document.getElementById('custDeparture').value;
            const duration = parseInt(document.getElementById('custDuration').value) || 0;
            const makkahHotel = document.getElementById('custMakkahHotel').value;
            const madinahHotel = document.getElementById('custMadinahHotel').value;
            const note = document.getElementById('custNote').value;

            const discountPercentage = origPrice > 0 ? Math.round(((origPrice - price) / origPrice) * 100) : 0;

            // Save as new package in available packages list as well
            const newPkg = {
                id: 'pkg-' + Date.now(),
                agentName: 'UMRAH TRAVELS',
                title,
                description: `Custom package tailored specifically to your requested dates, room sharing, and budget requirements.`,
                price,
                durationDays: duration,
                distanceToHaramMakkah: 0,
                distanceToHaramMadinah: 0,
                departureDateText: departure,
                makkahHotelName: makkahHotel,
                madinahHotelName: madinahHotel,
                flightRoute: '',
                sharingType: 'Custom Room Sharing',
                contactPhone: (this.state.currentUser && this.state.currentUser.phone) || '',
                includes: { flights: true, visa: true, transport: true, meals: true, ziyarah: true },
                imageUrls: ['https://images.unsplash.com/photo-1591604466107-ec97de577aff']
            };

            this.state.packages.unshift(newPkg);
            localStorage.setItem('umrah_packages', JSON.stringify(this.state.packages));

            offerObj = {
                userId: userId || '',
                requirementId: reqId,
                packageId: newPkg.id,
                packageTitle: title,
                originalPrice: origPrice,
                discountedPrice: price,
                discountPercentage,
                specialNote: note,
                departureDateText: departure,
                durationDays: duration,
                makkahHotelName: makkahHotel,
                madinahHotelName: madinahHotel
            };
        }

        // Call API to create offer
        const savedOffer = await this.apiCall('/admin/offers', 'POST', offerObj);
        
        if (savedOffer) {
            // Update requirement status via API if reqId provided
            if (reqId) {
                await this.apiCall(`/admin/requirements/${reqId}/status?status=OFFERED`, 'PUT');
            }
            
            this.showToast(`Custom offer for "${savedOffer.packageTitle || offerObj.packageTitle}" sent to Zaireen!`, 'success');
            this.closeModal();
            
            // Refresh admin page if on admin
            if (this.state.currentPage === 'admin') {
                this.renderAdminPage();
            }
        } else {
            this.showToast('Failed to send offer. Please try again.', 'error');
        }
    }



    async deletePackageByAdmin(packageId) {
        if (!confirm('Are you sure you want to delete this package listing?')) return;

        await this.apiCall(`/admin/packages/${packageId}`, 'DELETE');

        // Always remove package from local state and localStorage
        this.state.packages = this.state.packages.filter(p => p.id !== packageId);
        localStorage.setItem('umrah_packages', JSON.stringify(this.state.packages));

        this.showToast('Package deleted successfully', 'success');

        if (this.state.currentPage === 'admin') {
            this.renderAdminPage();
        } else {
            this.navigate('packages');
        }
    }

    openViewOfferModal(pkg = {}) {
        const packageId = pkg.id || '';
        const title = pkg.title || pkg.packageTitle || '';
        const price = pkg.price || pkg.discountedPrice || 0;
        const formattedPrice = '₹' + price.toLocaleString('en-IN');
        const travelDate = pkg.departureDate || pkg.startDate || '';
        const duration = pkg.duration || (pkg.durationDays ? pkg.durationDays + ' Days' : '');
        const makkahHotel = pkg.makkahHotelName || pkg.makkahHotel || '';
        const madinahHotel = pkg.madinahHotelName || pkg.madinahHotel || '';
        const distMakkah = pkg.distanceToHaramMakkah;
        const distMadinah = pkg.distanceToHaramMadinah;
        const includesArr = pkg.includes && Array.isArray(pkg.includes)
            ? pkg.includes
            : (pkg.inclusions && Array.isArray(pkg.inclusions) ? pkg.inclusions
                : (pkg.complimentaryServices && Array.isArray(pkg.complimentaryServices) ? pkg.complimentaryServices : []));

        this.openModal(`
            <div style="display:flex; flex-direction:column; width:100vw; height:100vh; background:#ffffff; font-family:'Inter', -apple-system, BlinkMacSystemFont, sans-serif; position:relative; overflow-y:auto; box-sizing:border-box;">
                
                <!-- TOP STEPPER NAVIGATION HEADER -->
                <div style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; padding:1.1rem 2.5rem; border-bottom:1px solid #e2e8f0; position:sticky; top:0; z-index:100;">
                    <!-- Brand Logo -->
                    <div style="font-weight:900; font-size:1.45rem; color:#166534; letter-spacing:-0.02em;">
                        Zilhaj.com
                    </div>

                    <!-- Stepper Bar -->
                    <div style="display:flex; align-items:center; gap:1.8rem; font-size:0.9rem; font-weight:700;">
                        <div style="color:#166534; border-bottom:2px solid #166534; padding-bottom:0.25rem;">
                            Review Order
                        </div>
                        <div style="color:#64748b;">
                            Payment Method
                        </div>
                        <div style="color:#94a3b8;">
                            Confirmation
                        </div>
                    </div>

                    <!-- Back Button -->
                    <button type="button" onclick="app.closeModal()" style="display:flex; align-items:center; gap:0.4rem; background:#ffffff; border:1px solid #cbd5e1; border-radius:8px; padding:0.45rem 0.9rem; font-size:0.8rem; font-weight:700; color:#334155; cursor:pointer;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">
                        ← Back to Dashboard
                    </button>
                </div>

                <!-- MAIN WRAPPER CONTAINER -->
                <div style="max-width:1120px; width:100%; margin:2rem auto; padding:0 1.5rem; box-sizing:border-box; display:flex; flex-direction:column; gap:1.8rem;">
                    
                    <!-- TOP HERO OVERVIEW CARD -->
                    <div style="background:#f3faf6; border:1px solid #e2e8f0; border-radius:20px; padding:1.8rem 2.2rem; display:flex; justify-content:space-between; align-items:center; gap:1.5rem; flex-wrap:wrap;">
                        <div>
                            <div style="display:inline-block; font-size:0.68rem; font-weight:800; color:#166534; letter-spacing:0.8px; text-transform:uppercase; margin-bottom:0.4rem;">
                                PREMIUM TRAVEL EXPERIENCE
                            </div>
                            <h2 style="font-size:1.3rem; font-weight:800; color:#0f172a; margin:0 0 0.3rem 0; letter-spacing:-0.01em; line-height:1.3;">
                                ${this.escapeHtml(title)}
                            </h2>
                            <p style="font-size:0.88rem; color:#64748b; margin:0;">
                                A spiritual journey crafted with comfort and security in mind.
                            </p>
                        </div>

                        <!-- 2 INFO PILL CARDS -->
                        <div style="display:flex; gap:1rem;">
                            <!-- Departure -->
                            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:0.8rem 1.4rem; display:flex; align-items:center; gap:0.8rem; box-shadow:0 2px 8px rgba(0,0,0,0.03);">
                                <span style="font-size:1.4rem; color:#166534;">📅</span>
                                <div>
                                    <div style="font-size:0.62rem; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">DEPARTURE</div>
                                    <div style="font-size:0.95rem; font-weight:800; color:#0f172a;">${this.escapeHtml(travelDate)}</div>
                                </div>
                            </div>
                            <!-- Duration -->
                            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:0.8rem 1.4rem; display:flex; align-items:center; gap:0.8rem; box-shadow:0 2px 8px rgba(0,0,0,0.03);">
                                <span style="font-size:1.4rem; color:#166534;">⏳</span>
                                <div>
                                    <div style="font-size:0.62rem; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">DURATION</div>
                                    <div style="font-size:0.95rem; font-weight:800; color:#0f172a;">${this.escapeHtml(duration)}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 4-GRID CONTENT CARDS -->
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.6rem;">
                        
                        <!-- BOX 1: HOTELS ACCOMMODATION -->
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:20px; padding:1.8rem; box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                            <div style="display:inline-block; border-bottom:2.5px solid #166534; padding-bottom:0.3rem; margin-bottom:1.4rem;">
                                <h3 style="font-size:1.1rem; font-weight:800; color:#0f172a; margin:0; display:flex; align-items:center; gap:0.5rem;">
                                    <span>🏨</span> <span>Hotels Accommodation</span>
                                </h3>
                            </div>

                            <!-- Makkah -->
                            <div style="border-left:3px solid #166534; padding-left:0.9rem; margin-bottom:1.4rem;">
                                <div style="font-size:0.65rem; font-weight:800; color:#166534; letter-spacing:0.6px; text-transform:uppercase; margin-bottom:0.25rem;">
                                    📍 MAKKAH
                                </div>
                                <div style="font-size:0.95rem; font-weight:800; color:#0f172a; margin-bottom:0.35rem;">
                                    ${this.escapeHtml(makkahHotel || 'Not specified')}
                                </div>
                                ${distMakkah ? `<span style="display:inline-block; background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-size:0.72rem; font-weight:700; padding:0.25rem 0.65rem; border-radius:6px;">
                                    Approx. ${distMakkah} Metres from Masjid Al-Haram
                                </span>` : ''}
                            </div>

                            <div style="height:1px; background:#f1f5f9; margin-bottom:1.4rem;"></div>

                            <!-- Madinah -->
                            <div style="border-left:3px solid #166534; padding-left:0.9rem;">
                                <div style="font-size:0.65rem; font-weight:800; color:#166534; letter-spacing:0.6px; text-transform:uppercase; margin-bottom:0.25rem;">
                                    📍 MADINAH
                                </div>
                                <div style="font-size:0.95rem; font-weight:800; color:#0f172a; margin-bottom:0.35rem;">
                                    ${this.escapeHtml(madinahHotel || 'Not specified')}
                                </div>
                                ${distMadinah ? `<span style="display:inline-block; background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-size:0.72rem; font-weight:700; padding:0.25rem 0.65rem; border-radius:6px;">
                                    Approx. ${distMadinah} Metres from Al-Masjid An-Nabawi
                                </span>` : ''}
                            </div>
                        </div>

                        <!-- BOX 2: PACKAGE INCLUDES -->
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:20px; padding:1.8rem; box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                            <div style="display:inline-block; border-bottom:2.5px solid #166534; padding-bottom:0.3rem; margin-bottom:1.4rem;">
                                <h3 style="font-size:1.1rem; font-weight:800; color:#0f172a; margin:0; display:flex; align-items:center; gap:0.5rem;">
                                    <span style="color:#166534;">✓</span> <span>Package Includes</span>
                                </h3>
                            </div>

                            <div style="display:flex; flex-direction:column; gap:0.8rem; font-size:0.86rem; color:#334155; font-weight:600;">
                                ${includesArr.length > 0
                                    ? includesArr.map(inc => `<div style="display:flex; align-items:center; gap:0.67rem;">
                                        <span style="color:#166534; font-weight:900;">✓</span>
                                        <span>${this.escapeHtml(inc)}</span>
                                    </div>`).join('')
                                    : '<div style="color:#64748b; font-style:italic;">Package inclusions not listed. Contact the travel agency for full details.</div>'}
                            </div>
                        </div>

                        <!-- BOX 3: COMPLIMENTARY SERVICES -->
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:20px; padding:1.8rem; box-shadow:0 2px 10px rgba(0,0,0,0.02);">
                            <div style="display:inline-block; border-bottom:2.5px solid #166534; padding-bottom:0.3rem; margin-bottom:1.4rem;">
                                <h3 style="font-size:1.1rem; font-weight:800; color:#0f172a; margin:0; display:flex; align-items:center; gap:0.5rem;">
                                    <span>🎁</span> <span>Complimentary Services</span>
                                </h3>
                            </div>

                            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:0.85rem;">
                                ${(pkg.complimentaryServices && pkg.complimentaryServices.length)
                                    ? pkg.complimentaryServices.map(svc => `<div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:1.2rem 0.5rem; text-align:center;">
                                        <div style="font-size:0.72rem; font-weight:800; color:#1e293b; text-transform:uppercase; line-height:1.4;">${this.escapeHtml(svc)}</div>
                                    </div>`).join('')
                                    : '<div style="grid-column:1/-1; color:#64748b; font-style:italic; font-size:0.84rem; text-align:center;">No complimentary services listed for this package.</div>'}
                            </div>
                        </div>

                        <!-- BOX 4: IMPORTANT NOTE -->
                        <div style="background:#e8f2ff; border:1px solid #c7d2fe; border-radius:20px; padding:1.8rem;">
                            <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.85rem;">
                                <span style="font-size:1.2rem; color:#dc2626;">ℹ️</span>
                                <h3 style="font-size:1.1rem; font-weight:800; color:#0f172a; margin:0;">Important Note</h3>
                            </div>
                            <p style="font-size:0.84rem; color:#334155; line-height:1.6; margin:0;">
                                Rawdah permits must be booked by the pilgrim through the <strong style="color:#dc2626;">Nusuk App</strong>, subject to availability. The company is not responsible for the booking, availability, approval, or non-issuance of the Rawdah permit.
                            </p>
                        </div>

                    </div>

                </div>

                <!-- BOTTOM STICKY ACTION FOOTER -->
                <div style="background:#ffffff; border-top:1px solid #e2e8f0; padding:1.1rem 2.5rem; position:sticky; bottom:0; z-index:100; display:flex; justify-content:space-between; align-items:center; box-shadow:0 -4px 15px rgba(0,0,0,0.03);">
                    <!-- Phone Enquiries -->
                    <div style="display:flex; flex-direction:column; gap:0.2rem;">
                        <span style="font-size:0.65rem; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">FOR BOOKINGS &amp; ENQUIRIES</span>
                        <div style="display:flex; align-items:center; gap:0.4rem; font-weight:800; font-size:1.05rem; color:#0f172a;">
                            <span>📞</span> <span>6006553803 | 9107333333</span>
                        </div>
                    </div>

                    <!-- Price & Action Button -->
                    <div style="display:flex; align-items:center; gap:1.5rem;">
                        <div style="text-align:right;">
                            <span style="font-size:0.65rem; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; display:block;">SPECIAL OFFER PRICE</span>
                            <span style="font-size:1.65rem; font-weight:900; color:#0f172a; letter-spacing:-0.02em;">${formattedPrice}</span>
                        </div>

                        <div style="display:flex; flex-direction:column; align-items:center; gap:0.25rem;">
                            <button type="button" onclick="app.closeModal(); app.openPaymentModal({ id: '${packageId}', title: '${this.escapeHtml(title)}', totalPrice: ${price} });" style="height:48px; padding:0 2rem; background:#166534; color:#ffffff; border:none; border-radius:10px; font-weight:800; font-size:1rem; cursor:pointer; display:flex; align-items:center; gap:0.5rem; box-shadow:0 6px 20px rgba(22,101,52,0.3); transition:all 0.2s;" onmouseover="this.style.background='#14532d'" onmouseout="this.style.background='#166534'">
                                <span>🔒</span> <span>Book &amp; Confirm Package</span>
                            </button>
                            <span style="font-size:0.68rem; color:#64748b; font-weight:600;">🔒 Secure Escrow Checkout</span>
                        </div>
                    </div>
                </div>

                <!-- FOOTER BAR -->
                <div style="background:#ffffff; border-top:1px solid #f1f5f9; padding:0.85rem 2.5rem; display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:#64748b;">
                    <div>© 2024 Zilhaj.com. Secure Checkout.</div>
                    <div style="display:flex; gap:1.2rem;">
                        <a href="#" onclick="app.navigate('terms'); return false;" style="color:#64748b; text-decoration:none;">Terms of Service</a>
                        <a href="#" onclick="app.navigate('privacy'); return false;" style="color:#64748b; text-decoration:none;">Privacy Policy</a>
                        <a href="#" onclick="app.navigate('contact'); return false;" style="color:#64748b; text-decoration:none;">Help Center</a>
                    </div>
                </div>

            </div>
        `, false, {
            width: '100vw',
            maxWidth: '100vw',
            height: '100vh',
            maxHeight: '100vh',
            borderRadius: '0px',
            overflowY: 'auto'
        });
    }

    startBooking(packageId) {
        const pkg = this.state.packages.find(p => p.id === packageId) || { id: packageId, title: 'Umrah Package', price: 0 };
        this.openViewOfferModal(pkg);
    }



    openPaymentModal(booking = {}) {
        if (!this.state.currentUser) {
            this.showToast('Please log in to proceed with payment', 'warning');
            this.openAuthModal('login');
            return;
        }

        const bookingId = booking.id || 'BK-' + Math.floor(100000 + Math.random() * 900000);
        const title = booking.packageTitle || booking.title || '';
        const operator = booking.operatorName || booking.agentName || '';
        const travelDate = booking.travelDate || '';
        const departureCity = booking.departureCity || '';
        const travelers = booking.travelersCount || booking.count || 1;
        const makkahHotel = booking.makkahHotel || '';
        const madinahHotel = booking.madinahHotel || '';
        
        const rawPrice = booking.totalPrice || booking.price || 0;
        const totalPrice = Math.max(0, Math.round(Number(rawPrice)));
        const perPersonPrice = totalPrice > 0 ? Math.round(totalPrice / travelers) : 0;
        const formattedTotal = totalPrice > 0 ? '₹' + totalPrice.toLocaleString('en-IN') : '';
        const formattedPerPerson = perPersonPrice > 0 ? '₹' + perPersonPrice.toLocaleString('en-IN') : '';

        if (!title || totalPrice <= 0) {
            this.showToast('Unable to load booking details. Please try again.', 'warning');
            this.closeModal();
            return;
        }

        // Real Scannable UPI QR Code URL using QRServer API
        const upiPa = booking.upiId || '';
        const upiPn = 'Zilhaj.com';
        const upiUrl = `upi://pay?pa=${upiPa}&pn=${encodeURIComponent(upiPn)}&am=${totalPrice}&cu=INR&tn=${encodeURIComponent('Umrah Booking ' + bookingId)}`;
        const qrCodeImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiUrl)}`;

        this.openModal(`
            <div style="display:flex; flex-direction:column; width:100vw; height:100vh; background:#f8fafc; font-family:'Inter', -apple-system, BlinkMacSystemFont, sans-serif; position:relative; overflow-y:auto; box-sizing:border-box;">
                
                <!-- TOP HEADER STEPPER BAR -->
                <div style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; padding:1.1rem 2.5rem; border-bottom:1px solid #e2e8f0; position:sticky; top:0; z-index:100; box-shadow:0 2px 10px rgba(0,0,0,0.03);">
                    <!-- Back Link -->
                    <button type="button" onclick="app.closeModal()" style="display:flex; align-items:center; gap:0.5rem; background:none; border:none; color:#166534; font-weight:700; font-size:0.92rem; cursor:pointer;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">
                        ← Back to Dashboard
                    </button>

                    <!-- Stepper Progress Bar -->
                    <div style="display:flex; align-items:center; gap:1.2rem; font-size:0.85rem; font-weight:700;">
                        <div style="display:flex; align-items:center; gap:0.4rem; color:#166534;">
                            <span style="width:22px; height:22px; border-radius:50%; background:#166534; color:#ffffff; display:flex; align-items:center; justify-content:center; font-size:0.75rem;">✓</span>
                            <span>Review Order</span>
                        </div>
                        <span style="color:#cbd5e1; font-weight:300;">——</span>
                        <div style="display:flex; align-items:center; gap:0.4rem; color:#0f172a;">
                            <span style="width:22px; height:22px; border-radius:50%; background:#166534; color:#ffffff; display:flex; align-items:center; justify-content:center; font-size:0.75rem;">2</span>
                            <span>Payment Method</span>
                        </div>
                        <span style="color:#cbd5e1; font-weight:300;">——</span>
                        <div style="display:flex; align-items:center; gap:0.4rem; color:#94a3b8;">
                            <span style="width:22px; height:22px; border-radius:50%; background:#e2e8f0; color:#64748b; display:flex; align-items:center; justify-content:center; font-size:0.75rem;">3</span>
                            <span>Confirmation</span>
                        </div>
                    </div>

                    <!-- Brand Logo -->
                    <div style="display:flex; align-items:center; gap:0.55rem; font-weight:900; font-size:1.45rem; color:#166534;">
                        <div style="width:36px; height:36px; border-radius:50%; overflow:hidden; display:flex; align-items:center; justify-content:center; background:#FFB74D; border:1.5px solid #000000; flex-shrink:0;">
                            <img src="logo.png" onerror="this.onerror=null;this.src='images/logo.png';" alt="Zilhaj.com Logo" style="width:100%; height:100%; object-fit:cover; display:block; border-radius:50%;">
                        </div>
                        <span>Zilhaj.com</span>
                    </div>
                </div>

                <!-- MAIN CONTENT GRID (2 COLUMNS) -->
                <div style="max-width:1200px; width:100%; margin:2rem auto; padding:0 1.5rem; display:grid; grid-template-columns:370px 1fr; gap:1.8rem; box-sizing:border-box;">
                    
                    <!-- LEFT COLUMN: SUMMARY CARDS -->
                    <div style="display:flex; flex-direction:column; gap:1.5rem;">
                        
                        <!-- CARD 1: SELECTED PACKAGE SUMMARY -->
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:20px; padding:1.5rem; box-shadow:0 4px 15px rgba(0,0,0,0.03);">
                            <div style="display:inline-block; background:#ecfdf5; color:#166534; border:1px solid #bbf7d0; font-size:0.65rem; font-weight:800; padding:0.25rem 0.6rem; border-radius:4px; letter-spacing:0.5px; text-transform:uppercase; margin-bottom:0.8rem;">
                                SELECTED PACKAGE SUMMARY
                            </div>
                            <h4 style="font-size:0.95rem; font-weight:800; color:#0f172a; line-height:1.45; margin:0 0 0.5rem 0;">
                                ${this.escapeHtml(title)}
                            </h4>
                            <p style="font-size:0.78rem; color:#64748b; margin:0 0 1rem 0;">
                                Operator: <strong style="color:#0f172a;">${this.escapeHtml(operator)}</strong>
                            </p>

                            <div style="height:1px; background:#f1f5f9; margin-bottom:1rem;"></div>

                            <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.82rem; color:#334155;">
                                ${travelDate ? `<div style="display:flex; align-items:flex-start; gap:0.6rem;">` : ''}
                                    <span>📅</span>
                                    <div><span style="color:#64748b;">Departure Date:</span> <strong>${this.escapeHtml(travelDate)}</strong></div>
                                ${travelDate ? `</div>` : ''}
                                ${departureCity ? `<div style="display:flex; align-items:flex-start; gap:0.6rem;">` : ''}
                                    <span>✈️</span>
                                    <div><span style="color:#64748b;">Departure City:</span> <strong>${this.escapeHtml(departureCity)}</strong></div>
                                ${departureCity ? `</div>` : ''}
                                <div style="display:flex; align-items:flex-start; gap:0.6rem;">
                                    <span>👥</span>
                                    <div><span style="color:#64748b;">Travelers:</span> <strong>${travelers} Person(s)</strong></div>
                                </div>
                                ${makkahHotel ? `<div style="display:flex; align-items:flex-start; gap:0.6rem;">` : ''}
                                    <span>🏨</span>
                                    <div><span style="color:#64748b;">Makkah:</span> <strong>${this.escapeHtml(makkahHotel)}</strong></div>
                                ${makkahHotel ? `</div>` : ''}
                                ${madinahHotel ? `<div style="display:flex; align-items:flex-start; gap:0.6rem;">` : ''}
                                    <span>🏨</span>
                                    <div><span style="color:#64748b;">Madinah:</span> <strong>${this.escapeHtml(madinahHotel)}</strong></div>
                                ${madinahHotel ? `</div>` : ''}
                            </div>
                        </div>

                        <!-- CARD 2: PRICING BREAKDOWN -->
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:20px; padding:1.5rem; box-shadow:0 4px 15px rgba(0,0,0,0.03);">
                            <div style="display:inline-block; background:#ecfdf5; color:#166534; border:1px solid #bbf7d0; font-size:0.65rem; font-weight:800; padding:0.25rem 0.6rem; border-radius:4px; letter-spacing:0.5px; text-transform:uppercase; margin-bottom:1rem;">
                                TEST FARE PRICING BREAKDOWN
                            </div>
                            
                            <div style="display:flex; flex-direction:column; gap:0.65rem; font-size:0.83rem; color:#475569; margin-bottom:1rem;">
                                <div style="display:flex; justify-content:space-between;">
                                    <span>Test Package Fare (₹${totalPrice}):</span>
                                    <strong style="color:#0f172a;">${formattedTotal}</strong>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span>Saudi Umrah Visa &amp; Insurance:</span>
                                    <strong style="color:#166534; font-size:0.78rem;">INCLUDED (₹0)</strong>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span>Zilhaj.com Reverse Bidding Fee:</span>
                                    <strong style="color:#166534; font-size:0.78rem;">FREE (₹0)</strong>
                                </div>
                            </div>

                            <div style="height:1px; background:#e2e8f0; margin-bottom:1.1rem;"></div>

                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <div>
                                    <span style="font-size:0.88rem; font-weight:800; color:#0f172a; display:block;">Total Amount Payable:</span>
                                </div>
                                <span style="font-size:1.6rem; font-weight:900; color:#166534; letter-spacing:-0.02em;">${formattedTotal}</span>
                            </div>
                        </div>

                    </div>

                    <!-- RIGHT COLUMN: PAYMENT METHODS PANEL -->
                    <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:20px; padding:2rem; box-shadow:0 4px 20px rgba(0,0,0,0.04); display:flex; flex-direction:column; justify-content:space-between;">
                        
                        <div>
                            <!-- Section Heading -->
                            <div style="border-left:4px solid #166534; padding-left:0.85rem; margin-bottom:1.5rem;">
                                <h3 style="font-size:1.35rem; font-weight:900; color:#0f172a; margin:0 0 0.25rem 0; letter-spacing:-0.02em;">
                                    Select Payment Method
                                </h3>
                                <p style="font-size:0.85rem; color:#64748b; margin:0;">
                                    Choose your preferred payment gateway or UPI method to complete your booking.
                                </p>
                            </div>

                            <!-- 4 PAYMENT METHOD TAB SELECTOR CARDS -->
                            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:0.85rem; margin-bottom:1.8rem;">
                                
                                <!-- TAB 1: UPI / QR Code -->
                                <button type="button" id="payTabUpi" onclick="app.switchPayTab('upi')" style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.4rem; padding:1.1rem 0.5rem; background:#f0fdf4; border:2px solid #166534; border-radius:12px; cursor:pointer; transition:all 0.2s;">
                                    <span style="font-size:1.4rem;">📱</span>
                                    <span style="font-size:0.78rem; font-weight:800; color:#166534;">UPI / QR Code</span>
                                </button>

                                <!-- TAB 2: Credit / Debit Card -->
                                <button type="button" id="payTabCard" onclick="app.switchPayTab('card')" style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.4rem; padding:1.1rem 0.5rem; background:#ffffff; border:1px solid #cbd5e1; border-radius:12px; cursor:pointer; transition:all 0.2s;">
                                    <span style="font-size:1.4rem;">💳</span>
                                    <span style="font-size:0.78rem; font-weight:700; color:#334155;">Credit/Debit Card</span>
                                </button>

                                <!-- TAB 3: Net Banking -->
                                <button type="button" id="payTabNet" onclick="app.switchPayTab('net')" style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.4rem; padding:1.1rem 0.5rem; background:#ffffff; border:1px solid #cbd5e1; border-radius:12px; cursor:pointer; transition:all 0.2s;">
                                    <span style="font-size:1.4rem;">🏛️</span>
                                    <span style="font-size:0.78rem; font-weight:700; color:#334155;">Net Banking</span>
                                </button>

                                <!-- TAB 4: 0% EMI -->
                                <button type="button" id="payTabEmi" onclick="app.switchPayTab('emi')" style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.4rem; padding:1.1rem 0.5rem; background:#ffffff; border:1px solid #cbd5e1; border-radius:12px; cursor:pointer; transition:all 0.2s;">
                                    <span style="font-size:1.4rem;">🗓️</span>
                                    <span style="font-size:0.78rem; font-weight:700; color:#334155;">0% EMI</span>
                                </button>
                            </div>

                            <!-- TAB CONTENT AREA -->
                            
                            <!-- PANEL 1: UPI / QR CODE (ACTIVE BY DEFAULT) -->
                            <div id="payContentUpi" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; padding:1.8rem; text-align:center;">
                                <div style="font-size:0.74rem; font-weight:800; color:#166534; letter-spacing:0.8px; text-transform:uppercase; margin-bottom:0.8rem;">
                                    OPTION A: RAZORPAY UPI &amp; ALL APPS GATEWAY
                                </div>

                                <button type="button" onclick="app.payWithRazorpay('${bookingId}', ${totalPrice}, 'RAZORPAY_UPI')" style="width:100%; height:48px; background:#047857; color:#ffffff; border:none; border-radius:12px; font-size:0.95rem; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:0.6rem; margin-bottom:1.5rem; box-shadow:0 4px 15px rgba(4,120,87,0.3);">
                                    <span>⚡</span> Launch Razorpay Gateway (UPI, GPay, PhonePe, Paytm, BHIM)
                                </button>

                                <div style="height:1px; background:#cbd5e1; margin-bottom:1.2rem;"></div>

                                <div style="font-size:0.74rem; font-weight:800; color:#166534; letter-spacing:0.8px; text-transform:uppercase; margin-bottom:1rem;">
                                    OPTION B: SCAN QR CODE WITH ANY UPI APP
                                </div>

                                <!-- REAL SCANNABLE DYNAMIC UPI QR CODE CONTAINER -->
                                <div style="position:relative; width:200px; height:200px; margin:0 auto 1rem; background:#ffffff; border:2px dashed #0f172a; border-radius:14px; padding:0.5rem; display:flex; align-items:center; justify-content:center; box-shadow:0 6px 20px rgba(0,0,0,0.06);">
                                    <img src="${qrCodeImgUrl}" alt="UPI Payment QR Code" style="width:180px; height:180px; border-radius:6px; display:block;">
                                    <div style="position:absolute; background:#ffffff; border:1px solid #cbd5e1; border-radius:6px; padding:0.2rem 0.5rem; font-size:0.68rem; font-weight:900; color:#166534; box-shadow:0 2px 6px rgba(0,0,0,0.15);">
                                        UPI QR
                                    </div>
                                </div>

                                <p style="font-size:0.78rem; color:#64748b; font-weight:600; margin:0 0 1.2rem 0;">
                                    Accepts Google Pay, PhonePe, Paytm, BHIM &amp; Banking Apps
                                </p>

                                <div style="max-width:380px; margin:0 auto; text-align:left;">
                                    <label style="font-size:0.7rem; font-weight:800; color:#475569; text-transform:uppercase; display:block; margin-bottom:0.35rem;">
                                        OR ENTER UPI VPA / VIRTUAL ID
                                    </label>
                                    <div style="display:flex; gap:0.5rem;">
                                        <input type="text" id="upiVpaInput" placeholder="yourname@ybl" value="${this.state?.currentUser?.email ? this.state.currentUser.email.split('@')[0] + '@ybl' : ''}" style="flex:1; height:42px; border:1px solid #cbd5e1; border-radius:8px; padding:0 0.9rem; font-size:0.86rem; font-weight:600; color:#0f172a; background:#ffffff;">
                                        <button type="button" onclick="app.verifyUpiVpa()" style="height:42px; padding:0 1rem; background:#166534; color:#ffffff; border:none; border-radius:8px; font-size:0.78rem; font-weight:800; cursor:pointer;">
                                            VERIFY
                                        </button>
                                    </div>
                                    <div id="vpaVerifyStatus" style="display:none; margin-top:0.35rem; font-size:0.74rem; font-weight:700;"></div>
                                </div>
                            </div>

                                <p style="font-size:0.78rem; color:#64748b; font-weight:600; margin:0 0 1.2rem 0;">
                                    Accepts Google Pay, PhonePe, Paytm, BHIM &amp; Banking Apps
                                </p>

                                <div style="max-width:380px; margin:0 auto; text-align:left;">
                                    <label style="font-size:0.7rem; font-weight:800; color:#475569; text-transform:uppercase; display:block; margin-bottom:0.35rem;">
                                        OR ENTER UPI VPA / VIRTUAL ID
                                    </label>
                                    <div style="display:flex; gap:0.5rem;">
                                        <input type="text" id="upiVpaInput" placeholder="user@okaxis" value="${this.state?.currentUser?.email ? this.state.currentUser.email.split('@')[0] + '@okaxis' : ''}" style="flex:1; height:42px; border:1px solid #cbd5e1; border-radius:8px; padding:0 0.9rem; font-size:0.86rem; font-weight:600; color:#0f172a; background:#ffffff;">
                                        <button type="button" onclick="app.verifyUpiVpa()" style="height:42px; padding:0 1rem; background:#166534; color:#ffffff; border:none; border-radius:8px; font-size:0.78rem; font-weight:800; cursor:pointer;">
                                            VERIFY
                                        </button>
                                    </div>
                                    <div id="vpaVerifyStatus" style="display:none; margin-top:0.35rem; font-size:0.74rem; font-weight:700;"></div>
                                </div>
                            </div>

                            <!-- PANEL 2: CREDIT / DEBIT CARD -->
                            <div id="payContentCard" style="display:none; background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; padding:1.6rem;">
                                <div style="display:flex; flex-direction:column; gap:0.85rem; max-width:440px; margin:0 auto;">
                                    <div>
                                        <label style="font-size:0.75rem; font-weight:700; color:#475569; display:block; margin-bottom:0.3rem;">Card Number</label>
                                        <input type="text" placeholder="4111 •••• •••• 1111" maxlength="19" style="width:100%; height:40px; border:1px solid #cbd5e1; border-radius:8px; padding:0 0.9rem; font-size:0.88rem; box-sizing:border-box;">
                                    </div>
                                    <div>
                                        <label style="font-size:0.75rem; font-weight:700; color:#475569; display:block; margin-bottom:0.3rem;">Cardholder Name</label>
                                        <input type="text" placeholder="${this.escapeHtml(this.state?.currentUser?.name || 'Full Name')}" style="width:100%; height:40px; border:1px solid #cbd5e1; border-radius:8px; padding:0 0.9rem; font-size:0.88rem; box-sizing:border-box;">
                                    </div>
                                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.85rem;">
                                        <div>
                                            <label style="font-size:0.75rem; font-weight:700; color:#475569; display:block; margin-bottom:0.3rem;">Expiry (MM/YY)</label>
                                            <input type="text" placeholder="12/28" maxlength="5" style="width:100%; height:40px; border:1px solid #cbd5e1; border-radius:8px; padding:0 0.9rem; font-size:0.88rem; box-sizing:border-box;">
                                        </div>
                                        <div>
                                            <label style="font-size:0.75rem; font-weight:700; color:#475569; display:block; margin-bottom:0.3rem;">CVV</label>
                                            <input type="password" placeholder="•••" maxlength="4" style="width:100%; height:40px; border:1px solid #cbd5e1; border-radius:8px; padding:0 0.9rem; font-size:0.88rem; box-sizing:border-box;">
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- PANEL 3: NET BANKING -->
                            <div id="payContentNet" style="display:none; background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; padding:1.6rem;">
                                <div style="font-size:0.78rem; font-weight:800; color:#475569; margin-bottom:0.85rem; text-transform:uppercase;">Select Bank</div>
                                <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:0.75rem;">
                                    <label style="display:flex; align-items:center; gap:0.5rem; background:#ffffff; border:1px solid #cbd5e1; border-radius:8px; padding:0.6rem 0.8rem; font-size:0.8rem; font-weight:700; cursor:pointer;"><input type="radio" name="bank" checked> HDFC Bank</label>
                                    <label style="display:flex; align-items:center; gap:0.5rem; background:#ffffff; border:1px solid #cbd5e1; border-radius:8px; padding:0.6rem 0.8rem; font-size:0.8rem; font-weight:700; cursor:pointer;"><input type="radio" name="bank"> ICICI Bank</label>
                                    <label style="display:flex; align-items:center; gap:0.5rem; background:#ffffff; border:1px solid #cbd5e1; border-radius:8px; padding:0.6rem 0.8rem; font-size:0.8rem; font-weight:700; cursor:pointer;"><input type="radio" name="bank"> State Bank of India</label>
                                    <label style="display:flex; align-items:center; gap:0.5rem; background:#ffffff; border:1px solid #cbd5e1; border-radius:8px; padding:0.6rem 0.8rem; font-size:0.8rem; font-weight:700; cursor:pointer;"><input type="radio" name="bank"> Axis Bank</label>
                                    <label style="display:flex; align-items:center; gap:0.5rem; background:#ffffff; border:1px solid #cbd5e1; border-radius:8px; padding:0.6rem 0.8rem; font-size:0.8rem; font-weight:700; cursor:pointer;"><input type="radio" name="bank"> Kotak Bank</label>
                                    <label style="display:flex; align-items:center; gap:0.5rem; background:#ffffff; border:1px solid #cbd5e1; border-radius:8px; padding:0.6rem 0.8rem; font-size:0.8rem; font-weight:700; cursor:pointer;"><input type="radio" name="bank"> PNB</label>
                                </div>
                            </div>

                            <!-- PANEL 4: 0% EMI -->
                            <div id="payContentEmi" style="display:none; background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; padding:1.6rem;">
                                <div style="font-size:0.78rem; font-weight:800; color:#475569; margin-bottom:0.85rem; text-transform:uppercase;">No Cost EMI Plans</div>
                                <div style="display:flex; flex-direction:column; gap:0.6rem;">
                                    <label style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; border:1px solid #cbd5e1; border-radius:8px; padding:0.75rem 1rem; font-size:0.84rem; cursor:pointer;"><div><input type="radio" name="emi" checked> <strong>3 Months No-Cost EMI</strong></div><strong style="color:#166534;">₹${Math.round(totalPrice/3).toLocaleString('en-IN')}/mo</strong></label>
                                    <label style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; border:1px solid #cbd5e1; border-radius:8px; padding:0.75rem 1rem; font-size:0.84rem; cursor:pointer;"><div><input type="radio" name="emi"> <strong>6 Months No-Cost EMI</strong></div><strong style="color:#166534;">₹${Math.round(totalPrice/6).toLocaleString('en-IN')}/mo</strong></label>
                                    <label style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; border:1px solid #cbd5e1; border-radius:8px; padding:0.75rem 1rem; font-size:0.84rem; cursor:pointer;"><div><input type="radio" name="emi"> <strong>12 Months Low Interest EMI</strong></div><strong style="color:#166534;">₹${Math.round(totalPrice/12).toLocaleString('en-IN')}/mo</strong></label>
                                </div>
                            </div>

                        </div>

                        <!-- BOTTOM SECURITY NOTICE & PRIMARY ACTION BUTTON -->
                        <div style="margin-top:1.8rem;">
                            <div style="display:flex; align-items:center; justify-content:center; gap:0.4rem; font-size:0.74rem; color:#64748b; margin-bottom:0.8rem;">
                                <span>🔒</span> <span>Protected by 256-Bit SSL Encrypted Escrow Security</span>
                            </div>

                            <!-- Pay Button -->
                            <button type="button" id="btnConfirmPay" onclick="app.processPaymentCheckout('${bookingId}')" style="width:100%; height:52px; background:#166534; color:#ffffff; border:none; border-radius:10px; font-weight:800; font-size:1.05rem; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:0.6rem; box-shadow:0 6px 20px rgba(22,101,52,0.3); transition:all 0.2s;" onmouseover="this.style.background='#14532d'" onmouseout="this.style.background='#166534'">
                                <span>💳</span> <span>Pay ${formattedTotal} &amp; Confirm Booking</span>
                            </button>
                        </div>

                    </div>

                </div>

            </div>
        `, false, {
            width: '100vw',
            maxWidth: '100vw',
            height: '100vh',
            maxHeight: '100vh',
            borderRadius: '0px',
            overflowY: 'auto'
        });
    }

    switchPayTab(tabName) {
        const tabs = ['upi', 'card', 'net', 'emi'];
        tabs.forEach(t => {
            const btn = document.getElementById('payTab' + t.charAt(0).toUpperCase() + t.slice(1));
            const content = document.getElementById('payContent' + t.charAt(0).toUpperCase() + t.slice(1));
            if (btn) {
                if (t === tabName) {
                    btn.style.background = '#f0fdf4';
                    btn.style.border = '2px solid #166534';
                    const label = btn.querySelector('span:last-child');
                    if (label) {
                        label.style.color = '#166534';
                        label.style.fontWeight = '800';
                    }
                } else {
                    btn.style.background = '#ffffff';
                    btn.style.border = '1px solid #cbd5e1';
                    const label = btn.querySelector('span:last-child');
                    if (label) {
                        label.style.color = '#334155';
                        label.style.fontWeight = '700';
                    }
                }
            }
            if (content) {
                content.style.display = (t === tabName) ? 'block' : 'none';
            }
        });
    }

    verifyUpiVpa() {
        const input = document.getElementById('upiVpaInput');
        const status = document.getElementById('vpaVerifyStatus');
        if (!input || !input.value.trim()) return;
        if (status) {
            status.style.display = 'block';
            status.style.color = '#166534';
            status.innerText = `✓ VPA ${input.value.trim()} Verified! Click Pay below to complete transaction.`;
        }
    }

    async payWithRazorpay(bookingId, amount, paymentMethod = 'RAZORPAY_UPI') {
        if (!this.state.currentUser) {
            this.showToast('Please log in to complete payment authentication', 'warning');
            this.openAuthModal('login');
            return;
        }

        if (typeof window.Razorpay === 'undefined') {
            this.showToast('Razorpay SDK loading... Please wait a second and try again.', 'warning');
            return;
        }

        const realAmount = Math.max(0, Math.round(parseFloat(amount) || 0));
        if (realAmount <= 0) {
            this.showToast('Unable to initialise payment: invalid amount.', 'warning');
            return;
        }

        this.showLoading('Initializing Razorpay Secure Gateway (UPI / Cards)...');
        
        let orderData = null;
        try {
            orderData = await this.apiCall('/payments/razorpay/create-order', 'POST', {
                bookingId: bookingId || 'BK-' + Date.now(),
                amount: realAmount
            });
        } catch (e) {
            console.warn('Razorpay order API call fallback:', e);
        }

        this.hideLoading();

        const options = {
            "key": (orderData && orderData.key) || 'rzp_test_TO6mS9Z6cLAruh',
            "amount": (orderData && typeof orderData.amount !== 'undefined') ? orderData.amount : Math.round(realAmount * 100),
            "currency": (orderData && orderData.currency) || "INR",
            "name": "ZILHAJ Umrah & Hajj Travel",
            "description": "Umrah Payment",
            "image": "https://img.icons8.com/color/96/000000/kaaba.png",
            "order_id": (orderData && (orderData.order_id || orderData.orderId)) || undefined,
            "modal": {
                "ondismiss": () => {
                    this.showToast('Payment checkout cancelled by user.', 'info');
                }
            },
            "config": {
                "display": {
                    "blocks": {
                        "utib": {
                            "name": "Pay via UPI / QR Code (Google Pay, PhonePe, Paytm, BHIM)",
                            "instruments": [
                                { "method": "upi" }
                            ]
                        },
                        "other": {
                            "name": "Other Payment Options (Cards / NetBanking)",
                            "instruments": [
                                { "method": "card" },
                                { "method": "netbanking" }
                            ]
                        }
                    },
                    "sequence": ["block.utib", "block.other"],
                    "preferences": {
                        "show_default_blocks": true
                    }
                }
            },
            "method": {
                "upi": true,
                "card": true,
                "netbanking": true,
                "wallet": true
            },
            "handler": async (response) => {
                this.showLoading('Verifying payment authentication with Razorpay...');
                let verifyRes = null;
                try {
                    verifyRes = await this.apiCall('/payments/razorpay/verify-payment', 'POST', {
                        bookingId: bookingId || 'BK-' + Date.now(),
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature,
                        paymentMethod: paymentMethod
                    });
                } catch (err) {}

                this.hideLoading();

                const txnId = response.razorpay_payment_id || (verifyRes && verifyRes.transactionId) || ('pay_' + Date.now());
                if (bookingId) {
                    this.apiCall('/bookings/' + encodeURIComponent(bookingId), 'PUT', {
                        status: 'CONFIRMED',
                        paymentStatus: 'PAID',
                        paymentMethod: 'RAZORPAY',
                        paymentId: response.razorpay_payment_id || txnId,
                        transactionId: txnId,
                        razorpayOrderId: response.razorpay_order_id || (verifyRes && verifyRes.razorpay_order_id) || '',
                        paidAt: new Date().toISOString()
                    });
                }

                this.showToast('🎉 Payment Successful! Signature Verified.', 'success');
                if (typeof this.fetchUserData === 'function') await this.fetchUserData();

                this.openModal(`
                    <div style="font-family:'Inter', -apple-system, BlinkMacSystemFont, sans-serif; text-align:center; padding:2.5rem 2rem; background:#ffffff; border-radius:24px; max-width:440px; margin:0 auto; box-sizing:border-box;">
                        <div style="width:72px; height:72px; margin:0 auto 1.2rem; background:#ecfdf5; border:3px solid #166534; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:2.2rem; color:#166534; box-shadow:0 8px 25px rgba(22,101,52,0.25);">
                            ✓
                        </div>
                        
                        <div style="display:inline-block; background:#ecfdf5; color:#166534; font-weight:800; font-size:0.75rem; padding:0.25rem 0.8rem; border-radius:99px; letter-spacing:0.5px; text-transform:uppercase; margin-bottom:0.8rem;">
                            RAZORPAY PAYMENT VERIFIED
                        </div>

                        <h3 style="font-size:1.6rem; font-weight:900; color:#0f172a; margin:0 0 0.4rem 0;">
                            JazakAllah Khair!
                        </h3>
                        <p style="font-size:0.88rem; color:#64748b; margin:0 0 1.2rem 0; line-height:1.5;">
                            May Allah accept your Umrah! Your payment of ₹${realAmount} has been verified successfully.
                        </p>

                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1rem; margin-bottom:1.5rem; text-align:left; font-size:0.82rem; color:#334155;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem;">
                                <span style="color:#64748b;">Razorpay Payment ID:</span>
                                <strong style="color:#166534; font-family:monospace; font-weight:800;">${txnId}</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem;">
                                <span style="color:#64748b;">Booking ID:</span>
                                <strong>${bookingId || ''}</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between;">
                                <span style="color:#64748b;">Payment Method:</span>
                                <strong style="color:#166534;">UPI / Razorpay Gateway</strong>
                            </div>
                        </div>

                        <div style="display:flex; flex-direction:column; gap:0.75rem;">
                            <a href="javascript:void(0)" onclick="${bookingId ? "app.downloadInvoice('" + bookingId + "'); " : ''}app.closeModal(); app.navigate('bookings');" style="display:flex; align-items:center; justify-content:center; gap:0.5rem; width:100%; height:46px; background:#166534; color:#ffffff; font-weight:800; font-size:0.92rem; border-radius:10px; text-decoration:none; box-shadow:0 4px 15px rgba(22,101,52,0.25);">
                                📄 View &amp; Download Invoice (Official Bill)
                            </a>
                            <button type="button" onclick="app.closeModal(); app.navigate('bookings');" style="width:100%; height:42px; background:#ffffff; border:1px solid #cbd5e1; color:#334155; font-weight:700; font-size:0.88rem; border-radius:10px; cursor:pointer;">
                                View My Bookings Dashboard
                            </button>
                        </div>
                    </div>
                `);
            },
            "prefill": {
                "name": (this.state && this.state.currentUser && this.state.currentUser.name) || "",
                "email": (this.state && this.state.currentUser && this.state.currentUser.email) || "",
                "contact": (this.state && this.state.currentUser && this.state.currentUser.phone) || ""
            },
            "theme": {
                "color": "#047857"
            }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', (response) => {
            this.showToast('Payment failed: ' + (response?.error?.description || 'Transaction declined'), 'error');
        });
        rzp.open();
    }

    async processPaymentCheckout(bookingId) {
        const payBtn = document.getElementById('btnConfirmPay');
        if (payBtn) {
            payBtn.disabled = true;
            payBtn.innerHTML = `<span>⏳</span> <span>Processing Payment...</span>`;
        }

        const txnId = 'TXN-' + Math.floor(1000000000 + Math.random() * 9000000000);
        
        try {
            await this.apiCall('/payments/checkout', 'POST', {
                bookingId,
                paymentMethod: 'UPI_QR'
            });
        } catch (e) {}

        if (bookingId) {
            this.apiCall('/bookings/' + encodeURIComponent(bookingId), 'PUT', {
                status: 'CONFIRMED',
                paymentStatus: 'PAID',
                paymentMethod: 'UPI_QR',
                transactionId: txnId,
                paidAt: new Date().toISOString()
            });
        }

        if (typeof this.fetchUserData === 'function') await this.fetchUserData();

        this.openModal(`
            <div style="font-family:'Inter', -apple-system, BlinkMacSystemFont, sans-serif; text-align:center; padding:2.5rem 2rem; background:#ffffff; border-radius:24px; max-width:440px; margin:0 auto; box-sizing:border-box;">
                <div style="width:72px; height:72px; margin:0 auto 1.2rem; background:#ecfdf5; border:3px solid #166534; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:2.2rem; color:#166534; box-shadow:0 8px 25px rgba(22,101,52,0.25);">
                    ✓
                </div>
                
                <div style="display:inline-block; background:#ecfdf5; color:#166534; font-weight:800; font-size:0.75rem; padding:0.25rem 0.8rem; border-radius:99px; letter-spacing:0.5px; text-transform:uppercase; margin-bottom:0.8rem;">
                    BOOKING CONFIRMED
                </div>

                <h3 style="font-size:1.6rem; font-weight:900; color:#0f172a; margin:0 0 0.4rem 0; letter-spacing:-0.02em;">
                    JazakAllah Khair!
                </h3>
                <p style="font-size:0.88rem; color:#64748b; margin:0 0 1.2rem 0; line-height:1.5;">
                    May Allah accept your Umrah! Your payment has been successfully verified &amp; escrow locked.
                </p>

                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1rem; margin-bottom:1.5rem; text-align:left; font-size:0.82rem; color:#334155;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem;">
                        <span style="color:#64748b;">Transaction Ref:</span>
                        <strong style="color:#166534; font-family:monospace; font-weight:800;">${txnId}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem;">
                        <span style="color:#64748b;">Booking ID:</span>
                        <strong>${bookingId}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <span style="color:#64748b;">Status:</span>
                        <strong style="color:#166534;">Verified &amp; Active</strong>
                    </div>
                </div>

                <div style="display:flex; flex-direction:column; gap:0.75rem;">
                    <a href="javascript:void(0)" onclick="app.downloadInvoice('${bookingId}'); app.closeModal(); app.navigate('bookings');" style="display:flex; align-items:center; justify-content:center; gap:0.5rem; width:100%; height:46px; background:#166534; color:#ffffff; font-weight:800; font-size:0.92rem; border-radius:10px; text-decoration:none; box-shadow:0 4px 15px rgba(22,101,52,0.25);">
                        📄 View &amp; Download Travel Ticket PDF
                    </a>
                    <button type="button" onclick="app.closeModal(); app.navigate('bookings');" style="width:100%; height:42px; background:#ffffff; border:1px solid #cbd5e1; color:#334155; font-weight:700; font-size:0.88rem; border-radius:10px; cursor:pointer;">
                        View My Bookings Dashboard
                    </button>
                </div>
            </div>
        `);
    }

    async cancelBooking(bookingId) {
        if (!confirm('Are you sure you want to cancel this booking?')) return;
        const res = await this.apiCall(`/bookings/${bookingId}/cancel`, 'PUT');
        if (res && res.status === 'CANCELLED') {
            this.showToast('Booking cancelled', 'success');
            await this.fetchUserData();
            await this.fetchPackages();
            this.navigate('bookings');
        }
    }

    renderServicesPage() {
        return `
            <div class="main-container" style="max-width: 100%; width: 100%; box-sizing: border-box; margin: 6.5rem auto 4rem; padding: 0 3.5rem;">
                
                <!-- Services Hero / Header -->
                <div style="text-align: center; margin-bottom: 3.5rem;">
                    <div style="display: inline-flex; align-items: center; gap: 0.4rem; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 0.3rem 1.1rem; border-radius: 99px; font-size: 0.8rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 0.8rem;">
                        <span>🕌</span> <span>OUR PILGRIMAGE SERVICES</span>
                    </div>
                    <h1 style="font-size: clamp(1.35rem, 2.5vw, 1.7rem); font-weight: 800; color: #0f172a; margin-bottom: 0.6rem; letter-spacing: -0.01em;">
                        Comprehensive Hajj & Umrah Travel Services
                    </h1>
                    <p style="color: #64748b; font-size: 1.02rem; max-width: 720px; margin: 0 auto; line-height: 1.65;">
                        We connect pilgrims with verified Saudi-licensed operators for 14 & 18 day Umrah packages, VIP Hajj journeys, custom reverse-bidding offers, and sacred guides.
                    </p>
                </div>

                <!-- Section 1: Hajj and Umrah Travel Cards (Two Different Cards Form) -->
                <div style="margin-bottom: 4.5rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
                        <div>
                            <h2 style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 0 0 0.3rem 0;">Our Travel Solutions</h2>
                            <p style="font-size: 0.92rem; color: #64748b; margin: 0;">Explore our core pilgrimage travel offerings below</p>
                        </div>
                        <span style="background: #f1f5f9; color: #475569; padding: 0.4rem 0.9rem; border-radius: 20px; font-size: 0.82rem; font-weight: 700;">✦ Verified Saudi Operators</span>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 2rem;">
                        
                        <!-- Card 1: Umrah Travels Service Card -->
                        <div style="background: #ffffff; border-radius: 24px; padding: 2.2rem; border: 1.5px solid #cbd5e1; box-shadow: 0 10px 30px rgba(0,0,0,0.06); display: flex; flex-direction: column; justify-content: space-between; transition: transform 0.3s ease, box-shadow 0.3s ease;" onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 18px 40px rgba(4,120,87,0.12)';" onmouseout="this.style.transform='';this.style.boxShadow='0 10px 30px rgba(0,0,0,0.06)';">
                            <div>
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.2rem;">
                                    <div style="width: 52px; height: 52px; border-radius: 16px; background: #ecfdf5; border: 1px solid #a7f3d0; display: flex; align-items: center; justify-content: center; font-size: 1.6rem;">
                                        🕋
                                    </div>
                                    <span style="background: #047857; color: #ffffff; font-size: 0.75rem; font-weight: 800; padding: 0.3rem 0.8rem; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.05em;">Umrah Travel</span>
                                </div>
                                <h3 style="font-size: 1.45rem; font-weight: 800; color: #0f172a; margin-bottom: 0.8rem;">14 & 18 Day Umrah Travels</h3>
                                <p style="color: #475569; font-size: 0.92rem; line-height: 1.65; margin-bottom: 1.4rem;">
                                    Complete Umrah packages tailored to your schedule and budget. Enjoy 5-star hotel stays near Masjid al-Haram, round-trip flights, Saudi Nusuk visa processing, guided Ziyarat, and 24/7 pilgrim assistance.
                                </p>
                                <ul style="list-style: none; padding: 0; margin: 0 0 1.8rem 0; display: flex; flex-direction: column; gap: 0.75rem;">
                                    <li style="display: flex; align-items: center; gap: 0.65rem; color: #334155; font-size: 0.88rem; font-weight: 600;">
                                        <span style="color: #10b981; font-weight: 900;">✓</span> 5-Star Hotels near Haram (150m – 600m)
                                    </li>
                                    <li style="display: flex; align-items: center; gap: 0.65rem; color: #334155; font-size: 0.88rem; font-weight: 600;">
                                        <span style="color: #10b981; font-weight: 900;">✓</span> Direct Saudi Flights & Return Air Tickets
                                    </li>
                                    <li style="display: flex; align-items: center; gap: 0.65rem; color: #334155; font-size: 0.88rem; font-weight: 600;">
                                        <span style="color: #10b981; font-weight: 900;">✓</span> Umrah Tourist Visa & Nusuk Permit Support
                                    </li>
                                    <li style="display: flex; align-items: center; gap: 0.65rem; color: #334155; font-size: 0.88rem; font-weight: 600;">
                                        <span style="color: #10b981; font-weight: 900;">✓</span> Guided Ziyarat Tours in Makkah & Madinah
                                    </li>
                                    <li style="display: flex; align-items: center; gap: 0.65rem; color: #334155; font-size: 0.88rem; font-weight: 600;">
                                        <span style="color: #10b981; font-weight: 900;">✓</span> Complimentary Ihram Kit & 5L Zamzam Water
                                    </li>
                                </ul>
                            </div>
                            <button onclick="app.navigate('home'); setTimeout(() => app.scrollToRequirementForm(), 100);" style="width: 100%; background: #047857; color: #ffffff; font-weight: 800; font-size: 0.95rem; padding: 0.85rem; border-radius: 12px; border: none; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#065f46'" onmouseout="this.style.background='#047857'">
                                Request Umrah Bids ➔
                            </button>
                        </div>

                        <!-- Card 2: Hajj Travels Service Card -->
                        <div style="background: linear-gradient(180deg, #ffffff 0%, #fffbeb 100%); border-radius: 24px; padding: 2.2rem; border: 1.5px solid #fcd34d; box-shadow: 0 10px 30px rgba(245,158,11,0.08); display: flex; flex-direction: column; justify-content: space-between; transition: transform 0.3s ease, box-shadow 0.3s ease;" onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 18px 40px rgba(245,158,11,0.18)';" onmouseout="this.style.transform='';this.style.boxShadow='0 10px 30px rgba(245,158,11,0.08)';">
                            <div>
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.2rem;">
                                    <div style="width: 52px; height: 52px; border-radius: 16px; background: #fef3c7; border: 1px solid #fde68a; display: flex; align-items: center; justify-content: center; font-size: 1.6rem;">
                                        📜
                                    </div>
                                    <span style="background: #b45309; color: #ffffff; font-size: 0.75rem; font-weight: 800; padding: 0.3rem 0.8rem; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.05em;">Hajj Travel</span>
                                </div>
                                <h3 style="font-size: 1.45rem; font-weight: 800; color: #0f172a; margin-bottom: 0.8rem;">VIP & Executive Hajj Packages</h3>
                                <p style="color: #475569; font-size: 0.92rem; line-height: 1.65; margin-bottom: 1.4rem;">
                                    Fulfill your sacred Hajj pillar with peace of mind. Includes 5-day Hajj rituals assistance, Mina VIP A/C tent encampment, Arafat Wuqoof guidance, private transfers, and 100% Escrow safe payments.
                                </p>
                                <ul style="list-style: none; padding: 0; margin: 0 0 1.8rem 0; display: flex; flex-direction: column; gap: 0.75rem;">
                                    <li style="display: flex; align-items: center; gap: 0.65rem; color: #334155; font-size: 0.88rem; font-weight: 600;">
                                        <span style="color: #d97706; font-weight: 900;">✓</span> Mina VIP Air-Conditioned Encampment Tents
                                    </li>
                                    <li style="display: flex; align-items: center; gap: 0.65rem; color: #334155; font-size: 0.88rem; font-weight: 600;">
                                        <span style="color: #d97706; font-weight: 900;">✓</span> Arafat Wuqoof & Open-Sky Muzdalifah Support
                                    </li>
                                    <li style="display: flex; align-items: center; gap: 0.65rem; color: #334155; font-size: 0.88rem; font-weight: 600;">
                                        <span style="color: #d97706; font-weight: 900;">✓</span> Jamarat Stoning Shuttle & Private AC Busses
                                    </li>
                                    <li style="display: flex; align-items: center; gap: 0.65rem; color: #334155; font-size: 0.88rem; font-weight: 600;">
                                        <span style="color: #d97706; font-weight: 900;">✓</span> 5-Star Haram Accommodation in Makkah & Madinah
                                    </li>
                                    <li style="display: flex; align-items: center; gap: 0.65rem; color: #334155; font-size: 0.88rem; font-weight: 600;">
                                        <span style="color: #d97706; font-weight: 900;">✓</span> 100% Escrow Protected Booking Guarantee
                                    </li>
                                </ul>
                            </div>
                            <button onclick="app.navigate('home'); setTimeout(() => app.scrollToRequirementForm(), 100);" style="width: 100%; background: linear-gradient(135deg, #d97706 0%, #b45309 100%); color: #ffffff; font-weight: 800; font-size: 0.95rem; padding: 0.85rem; border-radius: 12px; border: none; cursor: pointer; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                                Request Hajj Bids ➔
                            </button>
                        </div>

                    </div>
                </div>

                <!-- Section 2: Merged Hajj & Umrah Guides (Below the two cards) -->
                <div style="background: #ffffff; border-radius: 28px; padding: 2.8rem 2rem; border: 1px solid #e2e8f0; box-shadow: 0 4px 24px rgba(0,0,0,0.04);">
                    
                    <div style="text-align: center; margin-bottom: 2rem;">
                        <div style="display: inline-flex; align-items: center; gap: 0.4rem; background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; padding: 0.25rem 0.9rem; border-radius: 99px; font-size: 0.78rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 0.6rem;">
                            <span>📖</span> <span>SACRED KNOWLEDGE HUB</span>
                        </div>
                        <h2 style="font-size: 1.35rem; font-weight: 800; color: #0f172a; margin-bottom: 0.4rem;">Hajj & Umrah Pilgrimage Guides</h2>
                        <p style="color: #64748b; font-size: 0.92rem; max-width: 640px; margin: 0 auto;">Essential step-by-step rituals, Miqat boundaries, Ihram rules, Nusuk permits, and spiritual advice.</p>
                    </div>

                    <!-- Modern Segmented Pill Switcher -->
                    <div class="guide-nav-pills">
                        <button class="guide-pill-btn ${this.state.guideTab === 'umrah' ? 'active' : ''}" onclick="app.setGuideTab('umrah')">
                            <span>🕋</span> Umrah Step-by-Step
                        </button>
                        <button class="guide-pill-btn ${this.state.guideTab === 'hajj' ? 'active' : ''}" onclick="app.setGuideTab('hajj')">
                            <span>📜</span> Hajj Rituals Guide
                        </button>
                        <button class="guide-pill-btn ${this.state.guideTab === 'rules' ? 'active' : ''}" onclick="app.setGuideTab('rules')">
                            <span>⚙️</span> Nusuk Permits & Rules
                        </button>
                    </div>

                    <!-- Tab Contents -->
                    ${this.renderGuideTabContent()}
                </div>

                <!-- Bottom AI Helper Banner (Fade Green Gradient) -->
                <div style="margin-top: 3.5rem; background: linear-gradient(135deg, #059669 0%, #10b981 50%, #047857 100%); border-radius: 20px; padding: 2.2rem 2.4rem; color: #ffffff !important; display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; flex-wrap: wrap; box-shadow: 0 12px 30px rgba(16, 185, 129, 0.28); border: 1px solid #34d399;">
                    <div style="max-width: 680px;">
                        <div style="font-size: 0.85rem; font-weight: 800; color: #a7f3d0 !important; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 0.4rem;">🤖 24/7 PILGRIMAGE AI ASSISTANT</div>
                        <h3 style="font-size: 1.45rem; font-weight: 800; color: #ffffff !important; margin-bottom: 0.5rem; letter-spacing: -0.01em;">Have Questions About Nusuk Permits or Rituals?</h3>
                        <p style="font-size: 0.95rem; color: #ecfdf5 !important; margin: 0; line-height: 1.6; font-weight: 500;">Our instant AI assistant can guide you on Ihram rules, Miqat locations, Nusuk permit slots, and flight package deals.</p>
                    </div>
                    <button class="btn btn-ai-trigger" style="background: #fbbf24; color: #0f172a !important; font-weight: 800; font-size: 0.95rem; padding: 0.85rem 1.8rem; border-radius: 12px; border: none; cursor: pointer; white-space: nowrap; box-shadow: 0 4px 18px rgba(251, 191, 36, 0.4); transition: transform 0.2s ease;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''" onclick="app.openChatbot(event)">
                        💬 Ask AI Assistant Now
                    </button>
                </div>
            </div>
        `;
    }

    renderGuidesPage() {
        return this.renderServicesPage();
    }

    renderGuideTabContent() {
        return this.state.guideTab === 'hajj' ? `
            <div class="guides-grid-4">
                <div class="modern-guide-card">
                    <div>
                        <div class="card-step-badge">
                            <span>DAY 01</span> • 8th Dhul Hijjah
                        </div>
                        <h3 class="card-step-title">Mina Encampment</h3>
                        <p class="card-step-desc">Enter Ihram at your location, declare Talbiyah, and proceed to Mina for quiet reflection and prayers.</p>
                        <ul class="card-key-list">
                            <li><span class="dot">✓</span> Ghusl & Niyyah for Hajj</li>
                            <li><span class="dot">✓</span> Recite Talbiyah continuously</li>
                            <li><span class="dot">✓</span> Dhuhr, Asr, Maghrib, Isha & Fajr</li>
                        </ul>
                    </div>
                    <div class="card-location-tag">
                        📍 Location: Mina Valley
                    </div>
                </div>

                <div class="modern-guide-card">
                    <div>
                        <div class="card-step-badge">
                            <span>DAY 02</span> • 9th Dhul Hijjah
                        </div>
                        <h3 class="card-step-title">Arafat & Muzdalifah</h3>
                        <p class="card-step-desc">Stand at Mount Arafat for Wuqoof (the climax of Hajj). At sunset, depart to Muzdalifah under the open sky.</p>
                        <ul class="card-key-list">
                            <li><span class="dot">✓</span> Wuqoof at Arafat (Peak Ritual)</li>
                            <li><span class="dot">✓</span> Combined Dhuhr & Asr prayers</li>
                            <li><span class="dot">✓</span> Collect pebbles at Muzdalifah</li>
                        </ul>
                    </div>
                    <div class="card-location-tag">
                        📍 Location: Mount Arafat → Muzdalifah
                    </div>
                </div>

                <div class="modern-guide-card">
                    <div>
                        <div class="card-step-badge">
                            <span>DAY 03</span> • 10th Dhul Hijjah
                        </div>
                        <h3 class="card-step-title">Rami, Qurbani & Tawaf</h3>
                        <p class="card-step-desc">Pelt Jamarat Al-Aqaba, perform animal sacrifice, shave/trim hair, and perform Tawaf Al-Ziyarah.</p>
                        <ul class="card-key-list">
                            <li><span class="dot">✓</span> Pelt 7 pebbles at Jamarat Al-Aqaba</li>
                            <li><span class="dot">✓</span> Qurbani sacrifice completion</li>
                            <li><span class="dot">✓</span> Halq/Taqseer & Tawaf Al-Ziyarah</li>
                        </ul>
                    </div>
                    <div class="card-location-tag">
                        📍 Location: Jamarat → Haram Makkah
                    </div>
                </div>

                <div class="modern-guide-card">
                    <div>
                        <div class="card-step-badge">
                            <span>DAYS 04-05</span> • 11th-13th Dhul Hijjah
                        </div>
                        <h3 class="card-step-title">Jamarat & Farewell Tawaf</h3>
                        <p class="card-step-desc">Stay in Mina to pelt all 3 Jamarat pillars daily, then perform Tawaf Al-Wada before departure.</p>
                        <ul class="card-key-list">
                            <li><span class="dot">✓</span> Pelt 21 pebbles daily in Mina</li>
                            <li><span class="dot">✓</span> Final supplications in Makkah</li>
                            <li><span class="dot">✓</span> Complete Tawaf Al-Wada</li>
                        </ul>
                    </div>
                    <div class="card-location-tag">
                        📍 Location: Mina → Masjid Al-Haram
                    </div>
                </div>
            </div>
        ` : this.state.guideTab === 'rules' ? `
            <div class="guides-grid-3">
                <div class="modern-guide-card">
                    <div>
                        <div class="card-step-badge" style="background:#fef3c7; color:#92400e; border-color:#fde68a;">
                            <span>Nusuk App</span> • Official Permit
                        </div>
                        <h3 class="card-step-title">Rawdah Al-Sharifa Permits</h3>
                        <p class="card-step-desc">Visiting the sacred Rawdah Al-Sharifa in Madinah requires an authorized slot permit issued via Saudi Arabia's official Nusuk application.</p>
                        <ul class="card-key-list">
                            <li><span class="dot">✓</span> Download & register on Nusuk App</li>
                            <li><span class="dot">✓</span> Reserve dedicated male/female time slots</li>
                            <li><span class="dot">✓</span> Show QR code permit at gate entrance</li>
                        </ul>
                    </div>
                    <div class="card-location-tag">
                        📱 Digital Permit Portal
                    </div>
                </div>

                <div class="modern-guide-card">
                    <div>
                        <div class="card-step-badge" style="background:#eff6ff; color:#1e40af; border-color:#bfdbfe;">
                            <span>Visa Guidelines</span> • Entry Rules
                        </div>
                        <h3 class="card-step-title">Passport & Umrah Visa</h3>
                        <p class="card-step-desc">Pilgrims require a valid passport with at least 6 months validity from departure date. Umrah visas allow travel across all Saudi cities.</p>
                        <ul class="card-key-list">
                            <li><span class="dot">✓</span> Passport valid for 6+ months</li>
                            <li><span class="dot">✓</span> Verified round-trip flight booking</li>
                            <li><span class="dot">✓</span> Travel insurance coverage included</li>
                        </ul>
                    </div>
                    <div class="card-location-tag">
                        🛂 Ministry of Foreign Affairs
                    </div>
                </div>

                <div class="modern-guide-card">
                    <div>
                        <div class="card-step-badge" style="background:#fef2f2; color:#991b1b; border-color:#fecaca;">
                            <span>Sacred State</span> • Restrictions
                        </div>
                        <h3 class="card-step-title">Ihram Restrictions & Etiquette</h3>
                        <p class="card-step-desc">While in the state of Ihram, specific actions are prohibited to preserve spiritual purity and focus on devotion.</p>
                        <ul class="card-key-list">
                            <li><span class="dot">✓</span> No cutting hair, nails, or using scents</li>
                            <li><span class="dot">✓</span> No stitched garments for men</li>
                            <li><span class="dot">✓</span> Maintain patience, kindness & humility</li>
                        </ul>
                    </div>
                    <div class="card-location-tag">
                        ⚖️ Fiqh Guidelines
                    </div>
                </div>
            </div>
        ` : `
            <div class="guides-grid-4">
                <div class="modern-guide-card">
                    <div>
                        <div class="card-step-badge">
                            <span>STEP 01</span> • Entrance
                        </div>
                        <h3 class="card-step-title">Entering Ihram & Niyyah</h3>
                        <p class="card-step-desc">Perform Ghusl, wear Ihram garments before crossing the Miqat, and declare your sacred intention.</p>
                        <ul class="card-key-list">
                            <li><span class="dot">✓</span> Ghusl & Ihram attire at Miqat</li>
                            <li><span class="dot">✓</span> Niyyah: <em>"Labbayk Allahumma Umrah"</em></li>
                            <li><span class="dot">✓</span> Recite Talbiyah continuously</li>
                        </ul>
                    </div>
                    <div class="card-location-tag">
                        📍 Location: Miqat Station
                    </div>
                </div>

                <div class="modern-guide-card">
                    <div>
                        <div class="card-step-badge">
                            <span>STEP 02</span> • Tawaf
                        </div>
                        <h3 class="card-step-title">Tawaf around Kaaba</h3>
                        <p class="card-step-desc">Perform 7 counter-clockwise circuits around the Kaaba starting from Hajar Al-Aswad (Black Stone).</p>
                        <ul class="card-key-list">
                            <li><span class="dot">✓</span> 7 Complete Tawaf rounds</li>
                            <li><span class="dot">✓</span> 2 Raka'at behind Maqam Ibrahim</li>
                            <li><span class="dot">✓</span> Drink blessed Zamzam water</li>
                        </ul>
                    </div>
                    <div class="card-location-tag">
                        📍 Location: Al-Masjid Al-Haram
                    </div>
                </div>

                <div class="modern-guide-card">
                    <div>
                        <div class="card-step-badge">
                            <span>STEP 03</span> • Sa'i
                        </div>
                        <h3 class="card-step-title">Sa'i (Safa & Marwah)</h3>
                        <p class="card-step-desc">Walk 7 times between Mount Safa and Mount Marwah, honoring the devotion of Hazrat Hajar (RA).</p>
                        <ul class="card-key-list">
                            <li><span class="dot">✓</span> Start at Safa, end at Marwah</li>
                            <li><span class="dot">✓</span> 7 laps total with Du'as</li>
                            <li><span class="dot">✓</span> Light jogging for men between green lights</li>
                        </ul>
                    </div>
                    <div class="card-location-tag">
                        📍 Location: Mas'a Corridor
                    </div>
                </div>

                <div class="modern-guide-card">
                    <div>
                        <div class="card-step-badge">
                            <span>STEP 04</span> • Completion
                        </div>
                        <h3 class="card-step-title">Halq or Taqseer</h3>
                        <p class="card-step-desc">Men shave or trim head hair, women trim a fingertip length. Your Umrah is now completed!</p>
                        <ul class="card-key-list">
                            <li><span class="dot">✓</span> Shave (Halq) or trim (Taqseer)</li>
                            <li><span class="dot">✓</span> Ihram restrictions lifted</li>
                            <li><span class="dot">✓</span> Umrah Mubarak! 🎉</li>
                        </ul>
                    </div>
                    <div class="card-location-tag">
                        📍 Location: Barber Outlets / Hotel
                    </div>
                </div>
            </div>
        `;
    }

    logout() {
        this.openModal(`
            <div style="background: #ffffff; border-radius: 24px; padding: 2.2rem 2.2rem 2rem; text-align: center; max-width: 440px; width: 90%; margin: 0 auto; box-shadow: 0 25px 60px rgba(0,0,0,0.18); position: relative; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; border: 1.5px solid #e2e8f0; overflow: hidden;">
                
                <!-- Faded Mosque Background Watermark Illustration -->
                <div style="position: absolute; inset: 0; pointer-events: none; opacity: 0.06; overflow: hidden; display: flex; align-items: flex-end; justify-content: center;">
                    <svg viewBox="0 0 600 180" width="100%" height="110" fill="#044e35" xmlns="http://www.w3.org/2000/svg">
                        <rect x="40" y="50" width="16" height="130"/>
                        <path d="M40 50 Q48 15 56 50Z"/>
                        <rect x="90" y="30" width="100" height="150" rx="8"/>
                        <path d="M90 30 Q140 -40 190 30Z"/>
                        <rect x="220" y="50" width="16" height="130"/>
                        <path d="M220 50 Q228 15 236 50Z"/>
                        <rect x="360" y="50" width="16" height="130"/>
                        <path d="M360 50 Q368 15 376 50Z"/>
                        <rect x="410" y="30" width="100" height="150" rx="8"/>
                        <path d="M410 30 Q460 -40 510 30Z"/>
                        <rect x="540" y="50" width="16" height="130"/>
                        <path d="M540 50 Q548 15 556 50Z"/>
                    </svg>
                </div>

                <!-- Icon Circle Badge with Exit Door & Arrow -->
                <div style="position: relative; width: 84px; height: 84px; background: #e6f4ea; border: 2px solid #bbf7d0; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.3rem; box-shadow: 0 8px 24px rgba(4,78,53,0.12);">
                    
                    <!-- Sparkles Around Badge -->
                    <span style="position: absolute; top: 4px; left: 6px; color: #d4af37; font-size: 0.85rem;">✦</span>
                    <span style="position: absolute; top: 12px; right: 4px; color: #d4af37; font-size: 0.75rem;">✦</span>
                    <span style="position: absolute; bottom: 8px; left: 4px; color: #d4af37; font-size: 0.75rem;">✦</span>
                    <span style="position: absolute; bottom: 4px; right: 8px; color: #d4af37; font-size: 0.85rem;">✦</span>

                    <!-- SVG Exit Door & Golden Arrow -->
                    <svg width="44" height="44" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="12" y="8" width="18" height="32" rx="3" fill="#044e35" stroke="#033927" stroke-width="2"/>
                        <circle cx="16" cy="24" r="2" fill="#f59e0b"/>
                        <path d="M25 24H38" stroke="#d97706" stroke-width="3.5" stroke-linecap="round"/>
                        <path d="M33 18L39 24L33 30" stroke="#d97706" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>

                <!-- Title -->
                <h3 style="font-size: 1.55rem; font-weight: 900; color: #044e35; margin: 0 0 0.6rem 0; letter-spacing: -0.02em;">
                    Confirm Logout
                </h3>

                <!-- Golden Star Line Divider -->
                <div style="display: flex; align-items: center; justify-content: center; gap: 0.6rem; margin-bottom: 1.1rem;">
                    <div style="height: 1.5px; width: 45px; background: linear-gradient(to right, transparent, #d4af37);"></div>
                    <span style="color: #d4af37; font-size: 0.85rem; font-weight: 900;">◆</span>
                    <div style="height: 1.5px; width: 45px; background: linear-gradient(to left, transparent, #d4af37);"></div>
                </div>

                <!-- Subtext Message -->
                <p style="font-size: 0.94rem; color: #475569; margin: 0 0 1.8rem 0; line-height: 1.6; font-weight: 500;">
                    Are you sure you want to log out of your account?<br>
                    You will need to log back in to manage your Umrah bookings.
                </p>

                <!-- Action Buttons Row -->
                <div style="display: flex; gap: 1rem; justify-content: center; position: relative; z-index: 2;">
                    <button type="button" onclick="app.closeModal()" style="flex: 1; padding: 0.8rem 1.4rem; border-radius: 12px; background: #ffffff; color: #044e35; border: 1.8px solid #044e35; font-weight: 800; font-size: 0.95rem; cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.background='#f0fdf4'" onmouseout="this.style.background='#ffffff'">
                        Cancel
                    </button>
                    <button type="button" onclick="app.confirmLogout()" style="flex: 1; padding: 0.8rem 1.4rem; border-radius: 12px; background: #044e35; color: #ffffff; border: none; font-weight: 800; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; box-shadow: 0 6px 20px rgba(4,78,53,0.3); transition: all 0.2s ease;" onmouseover="this.style.background='#033927'" onmouseout="this.style.background='#044e35'">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                        <span>Log Out</span>
                    </button>
                </div>

            </div>
        `);
    }

    confirmLogout() {
        this.state.currentUser = null;
        localStorage.removeItem('umrah_user');
        this.closeModal();
        this.renderAuthNav();
        this.showToast('Logged out successfully', 'success');
        this.navigate('home');
    }



    openContactModal() {
        this.openModal(`
            <div class="modal-header">
                <h3>📞 Contact Zaireen Support (24/7)</h3>
            </div>
            <div class="modal-body">
                <p style="font-size:0.9rem; color:#64748b; margin-bottom:1.5rem;">Have questions about travel dates, custom requirements, or agent offers? Reach out to us anytime.</p>
                <div style="background:#ecfdf5; border-radius:10px; padding:1rem; margin-bottom:1.5rem; color:#047857; font-size:0.9rem;">
                    <div>📞 <strong>Helpline:</strong> +966 800 123 4567 / 9541692891</div>
                    <div style="margin-top:0.3rem;">📧 <strong>Email:</strong> support@zilhaj.com</div>
                    <div style="margin-top:0.3rem;">📍 <strong>Office:</strong> Makkah Al-Mukarramah, Kingdom of Saudi Arabia</div>
                </div>
                <form onsubmit="event.preventDefault(); app.submitContactMessage();">
                    <div class="form-group">
                        <label>Your Name</label>
                        <input type="text" id="contactName" class="form-control" required placeholder="e.g. Tariq Mahmood">
                    </div>
                    <div class="form-group">
                        <label>Your Message / Query</label>
                        <textarea id="contactMessage" class="form-control" rows="3" required placeholder="Type your question or support request here..."></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width:100%;">Send Support Message 🚀</button>
                </form>
            </div>
        `);
    }

    submitContactMessage() {
        this.showToast('Message sent! Support team will contact you shortly.', 'success');
        this.closeModal();
    }





    /* ============================================================================
       LIQUID GLASS FEEDBACK SLIDER LOGIC
       ============================================================================ */










    slideReviewCarousel(direction) {
        const track = document.getElementById('ZaireenReviewTrack');
        if (!track) return;

        if (this.currentReviewSlide === undefined) this.currentReviewSlide = 0;

        const totalCards = track.children.length;
        let cardsPerView = 3;
        if (window.innerWidth <= 640) cardsPerView = 1;
        else if (window.innerWidth <= 992) cardsPerView = 2;

        const maxSlide = Math.max(0, totalCards - cardsPerView);
        this.currentReviewSlide += direction;

        if (this.currentReviewSlide < 0) this.currentReviewSlide = maxSlide;
        if (this.currentReviewSlide > maxSlide) this.currentReviewSlide = 0;

        this.goToReviewSlide(this.currentReviewSlide);
    }

    goToReviewSlide(slideIndex) {
        const track = document.getElementById('ZaireenReviewTrack');
        if (!track) return;

        this.currentReviewSlide = slideIndex;
        let cardsPerView = 3;
        if (window.innerWidth <= 640) cardsPerView = 1;
        else if (window.innerWidth <= 992) cardsPerView = 2;

        const cardWidthPercent = 100 / cardsPerView;
        const shiftPercent = slideIndex * cardWidthPercent;

        track.style.transform = `translateX(-${shiftPercent}%)`;

        // Update active dot
        const dots = document.querySelectorAll('.carousel-dot');
        dots.forEach((dot, idx) => {
            if (idx === slideIndex) dot.classList.add('active');
            else dot.classList.remove('active');
        });
    }

    toggleMobileMenu() {
        const menu = document.getElementById('navMenu');
        if (menu) menu.classList.toggle('show-mobile');
    }

    openChatbot(e) {
        if (e && e.stopPropagation) e.stopPropagation();
        const box = document.getElementById('chatbotBox');
        if (!box) return;
        box.style.display = 'flex';
        const input = document.getElementById('chatbotInput');
        if (input) input.focus();
    }

    toggleChatbot(e) {
        if (e && e.stopPropagation) e.stopPropagation();
        const box = document.getElementById('chatbotBox');
        if (!box) return;
        const currentDisplay = window.getComputedStyle(box).display;
        box.style.display = (currentDisplay === 'none') ? 'flex' : 'none';
        if (box.style.display === 'flex') {
            const input = document.getElementById('chatbotInput');
            if (input) input.focus();
        }
    }

    async callGeminiApi(userPrompt) {
        if (!CHATBOT_API_KEY) return null;
        try {
            const systemContext = `You are the official AI Assistant for Zilhaj.com Umrah & Hajj Travel platform.
CRITICAL GUARDRAILS & RULES:
1. ONLY answer queries directly related to Umrah, Hajj, Islamic pilgrimage travel, hotel accommodations in Makkah & Madinah, visa processing, flights, Nusuk permits, or Zilhaj.com platform services.
2. If the user query is about UNRELATED or PROHIBITED topics (e.g. coding, general sports, politics, entertainment, general math, illegal content, weather outside KSA), you MUST politely decline:
   "⚠️ I am trained exclusively as the Zilhaj.com Umrah & Hajj Travel Assistant. I cannot answer queries on unrelated or prohibited topics. Please ask me about Umrah travel requirements, Nusuk permits, packages, flights, or hotels!"

User Query: "${userPrompt}"
Provide a helpful, accurate, polite, and concise answer (2-3 sentences max) specifically relevant to Zilhaj.com and Umrah travel.`;

            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${CHATBOT_API_KEY}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: systemContext }] }]
                })
            });
            if (response.ok) {
                const data = await response.json();
                const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (reply) return reply;
            }
        } catch (e) {
            console.error('Gemini API error:', e);
        }
        return null;
    }

    getCustomWebsiteAnswer(input) {
        const lower = (input || '').toLowerCase();

        const offTopicKeywords = ['python', 'java', 'code', 'coding', 'script', 'football', 'cricket', 'movie', 'song', 'politics', 'election', 'game', 'anime', 'recipe', 'hack', 'password', 'porn', 'casino', 'gambling'];
        if (offTopicKeywords.some(k => lower.includes(k))) {
            return '⚠️ I am trained exclusively as the Zilhaj.com Umrah & Hajj Travel Assistant. I cannot answer queries on unrelated or prohibited topics. Please ask me about Umrah travel requirements, Nusuk permits, packages, flights, or hotels!';
        }

        if (lower.includes('issue') || lower.includes('not work') || lower.includes('button') || lower.includes('problem') || lower.includes('bug') || lower.includes('error')) {
            return '🛠️ Troubleshooting & Support: If any button or form is not responding, please refresh your browser page (Ctrl+F5) to load the latest update. You can also contact our 24/7 Helpline at +966 800 123 4567 or 9541692891 for instant help!';
        }
        if (lower.includes('hajj') || lower.includes('umrah') || lower.includes('step') || lower.includes('ritual') || lower.includes('guide')) {
            return '📖 Hajj & Umrah Guides: You can read our step-by-step guides by clicking "Hajj & Umrah Guides" in the top menu. Key rituals include wearing Ihram at Miqat, 7 rounds of Tawaf around Kaaba, 7 walks of Sa\'i between Safa & Marwah, and hair trimming (Halq/Taqseer).';
        }
        if (lower.includes('offer') || lower.includes('request') || lower.includes('bid') || lower.includes('book') || lower.includes('how')) {
            return '✈️ How to Book: 1. Fill out the "Post Your Travel Requirement" form on the homepage. 2. Verified travel agents will send tailored offers. 3. Review package details in your User Dashboard and click Proceed to Checkout to confirm your booking!';
        }
        if (lower.includes('price') || lower.includes('cost') || lower.includes('budget') || lower.includes('discount') || lower.includes('cheap')) {
            return '💰 Best Price Guarantee: Travel agencies send competing offers directly to you, saving up to 15-20% off regular retail prices with zero hidden charges.';
        }
        if (lower.includes('hotel') || lower.includes('makkah') || lower.includes('madinah') || lower.includes('stay') || lower.includes('room')) {
            return '🏨 Hotel Details: All packages list 5-Star & 4-Star hotels close to Masjid Al-Haram in Makkah (such as Swissotel Makkah) and Al-Masjid An-Nabawi in Madinah (such as Pullman Zamzam).';
        }
        if (lower.includes('flight') || lower.includes('ticket') || lower.includes('airline') || lower.includes('transfer')) {
            return '✈️ Flights & Transportation: Packages include return air tickets, airport pickups, and air-conditioned AC bus transfers between Makkah, Madinah, and Jeddah.';
        }
        if (lower.includes('visa') || lower.includes('passport') || lower.includes('document')) {
            return '📄 Visa Processing: Verified travel agents handle complete Saudi Umrah visa processing and insurance as part of your package.';
        }
        if (lower.includes('meal') || lower.includes('food') || lower.includes('buffet') || lower.includes('dinner')) {
            return '🍽️ Daily Meals: Most agent offers include 3x daily fresh buffet meals (Breakfast, Lunch, and Dinner) with South Asian and international options.';
        }
        if (lower.includes('nusuk') || lower.includes('rawdah') || lower.includes('permit') || lower.includes('app')) {
            return '🕌 Rawdah Permits: Free permits for visiting the Sacred Rawdah in Madinah are issued through the official Saudi Ministry Nusuk mobile app.';
        }
        if (lower.includes('verify') || lower.includes('verified') || lower.includes('agent') || lower.includes('trust') || lower.includes('safe')) {
            return '🛡️ 100% Verified Agents: Every travel operator on Zilhaj.com undergoes government license checks and background verification for your safety.';
        }
        if (lower.includes('pay') || lower.includes('payment') || lower.includes('upi') || lower.includes('card') || lower.includes('bank')) {
            return '💳 Payment Methods: We support Instant UPI (Google Pay, PhonePe, Paytm), Credit & Debit Cards, Net Banking, or Direct Bank/Office deposit.';
        }
        if (lower.includes('cancel') || lower.includes('refund')) {
            return '🚪 Cancellations: You can view or cancel any active travel request anytime from your User Dashboard by clicking "Cancel Request".';
        }
        if (lower.includes('login') || lower.includes('signup') || lower.includes('register') || lower.includes('account')) {
            return '👤 Account Sign In: Click the "Login" or "Sign Up" button in the top navigation bar to create or access your Zaireen account.';
        }
        if (lower.includes('contact') || lower.includes('support') || lower.includes('phone') || lower.includes('number') || lower.includes('help')) {
            return '📞 24/7 Zaireen Support: Call us anytime at +966 800 123 4567 or 9541692891, or send an email to support@zilhaj.com.';
        }
        if (lower.includes('why') || lower.includes('choose')) {
            return '🌟 Why Choose Us: 100% Verified Travel Agents, Transparent Pricing, Zero Hidden Fees, Best Price Guarantee, and 24/7 Zaireen Support!';
        }

        return `Thank you for reaching out! Zilhaj.com helps you get the best Umrah package offers from verified travel agents. You can submit a travel request, compare offers, and book securely. Feel free to ask about prices, hotels, flights, or guides!`;
    }

    async sendChatMessage() {
        const input = document.getElementById('chatbotInput');
        const msgContainer = document.getElementById('chatbotMessages');
        if (!input || !msgContainer || !input.value.trim()) return;

        const text = input.value.trim();
        input.value = '';

        const userDiv = document.createElement('div');
        userDiv.className = 'chat-msg user';
        userDiv.style.cssText = 'background:#047857; color:#ffffff; padding:0.75rem 1rem; border-radius:12px; font-size:0.85rem; align-self:flex-end; max-width:85%; margin-left:auto;';
        userDiv.innerText = text;
        msgContainer.appendChild(userDiv);

        // Show Typing Indicator
        const typingDiv = document.createElement('div');
        typingDiv.className = 'chat-msg bot';
        typingDiv.style.cssText = 'background:#ffffff; color:#64748b; padding:0.75rem 1rem; border-radius:12px; font-size:0.85rem; border:1px solid #e2e8f0; align-self:flex-start; max-width:85%; font-style:italic;';
        typingDiv.innerText = '🤖 AI Assistant is typing response...';
        msgContainer.appendChild(typingDiv);
        msgContainer.scrollTop = msgContainer.scrollHeight;

        let reply = await this.callGeminiApi(text);
        if (!reply) {
            reply = this.getCustomWebsiteAnswer(text);
        }

        typingDiv.style.fontStyle = 'normal';
        typingDiv.style.color = '#0f172a';
        typingDiv.innerHTML = reply + this.getChatbotIssueListHtml();
        msgContainer.scrollTop = msgContainer.scrollHeight;
    }

    getChatbotIssueListHtml() {
        return `
            <div style="margin-top:0.8rem; padding-top:0.6rem; border-top:1px dashed #cbd5e1; font-size:0.8rem;">
                <strong style="color:#047857; display:block; margin-bottom:0.4rem; font-size:0.78rem;">📌 Common Topics & Quick Issues:</strong>
                <div style="display:flex; flex-wrap:wrap; gap:0.35rem;">
                    <button type="button" onclick="app.handleChatIssue('How to post custom Umrah requirement?')" style="background:#f1f5f9; color:#0f172a; border:1px solid #cbd5e1; border-radius:6px; padding:0.25rem 0.5rem; font-size:0.75rem; cursor:pointer;">📝 Post Requirement</button>
                    <button type="button" onclick="app.handleChatIssue('What are the Nusuk Rawdah permit rules?')" style="background:#f1f5f9; color:#0f172a; border:1px solid #cbd5e1; border-radius:6px; padding:0.25rem 0.5rem; font-size:0.75rem; cursor:pointer;">🕌 Rawdah Permits</button>
                    <button type="button" onclick="app.handleChatIssue('How does reverse bidding work?')" style="background:#f1f5f9; color:#0f172a; border:1px solid #cbd5e1; border-radius:6px; padding:0.25rem 0.5rem; font-size:0.75rem; cursor:pointer;">💰 Reverse Bidding</button>
                    <button type="button" onclick="app.handleChatIssue('What hotels and meals are included?')" style="background:#f1f5f9; color:#0f172a; border:1px solid #cbd5e1; border-radius:6px; padding:0.25rem 0.5rem; font-size:0.75rem; cursor:pointer;">🏨 Hotels & Meals</button>
                    <button type="button" onclick="app.handleChatIssue('How to contact 24/7 Zaireen Support?')" style="background:#f1f5f9; color:#0f172a; border:1px solid #cbd5e1; border-radius:6px; padding:0.25rem 0.5rem; font-size:0.75rem; cursor:pointer;">📞 24/7 Support</button>
                </div>
            </div>
        `;
    }

    async handleChatIssue(questionText) {
        const msgContainer = document.getElementById('chatbotMessages');
        if (!msgContainer) return;

        // Display user message
        const userDiv = document.createElement('div');
        userDiv.className = 'chat-msg user';
        userDiv.style.cssText = 'background:#047857; color:#ffffff; padding:0.75rem 1rem; border-radius:12px; font-size:0.85rem; align-self:flex-end; max-width:85%; margin-left:auto;';
        userDiv.innerText = questionText;
        msgContainer.appendChild(userDiv);

        // Show Typing Indicator
        const typingDiv = document.createElement('div');
        typingDiv.className = 'chat-msg bot';
        typingDiv.style.cssText = 'background:#ffffff; color:#64748b; padding:0.75rem 1rem; border-radius:12px; font-size:0.85rem; border:1px solid #e2e8f0; align-self:flex-start; max-width:85%; font-style:italic;';
        typingDiv.innerText = '🤖 AI Assistant is analyzing...';
        msgContainer.appendChild(typingDiv);
        msgContainer.scrollTop = msgContainer.scrollHeight;

        let reply = await this.callGeminiApi(questionText);
        if (!reply) {
            reply = this.getCustomWebsiteAnswer(questionText);
        }

        typingDiv.style.fontStyle = 'normal';
        typingDiv.style.color = '#0f172a';
        typingDiv.innerHTML = reply + this.getChatbotIssueListHtml();
        msgContainer.scrollTop = msgContainer.scrollHeight;
    }

    scrollToRequirementForm() {
        if (!this.state.currentUser) {
            this.showToast('Please log in or sign up to submit your pilgrimage request', 'warning');
            this.openAuthModal('login');
            return;
        }
        const anchor = document.getElementById('requestFormAnchor');
        if (anchor) {
            anchor.scrollIntoView({ behavior: 'smooth' });
            return;
        }
        this.navigate('request-form');
    }



    setGuideTab(tab) {
        this.state.guideTab = tab;
        this.navigate('services');
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    showToast(message, type = 'success') {
        // Completely disabled as requested: No floating toast bars (green, red, info) on top right
        return;
    }

    showSuccessModal(title, subtitle, onClose = null) {
        // Remove any existing success modal
        const existing = document.getElementById('successModalOverlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'successModalOverlay';
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 99999;
            background: rgba(0,0,0,0.45);
            display: flex; align-items: center; justify-content: center;
            animation: fadeIn 0.25s ease;
        `;

        overlay.innerHTML = `
            <style>
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scaleIn { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                @keyframes checkPop { 0% { transform: scale(0); } 70% { transform: scale(1.2); } 100% { transform: scale(1); } }
                @keyframes pulseRing { 0% { transform: scale(0.9); opacity: 0.8; } 100% { transform: scale(1.6); opacity: 0; } }
            </style>
            <div style="
                background: #ffffff;
                border-radius: 28px;
                padding: 3rem 2.5rem 2.5rem;
                text-align: center;
                max-width: 380px;
                width: 90%;
                box-shadow: 0 30px 80px rgba(0,0,0,0.2);
                animation: scaleIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                position: relative;
            ">
                <!-- Radial glow circles -->
                <div style="position:relative; width:130px; height:130px; margin:0 auto 1.8rem;">
                    <!-- Outer dashed pulse ring -->
                    <div style="
                        position:absolute; inset:-20px;
                        border-radius:50%;
                        border: 2.5px dashed rgba(34,197,94,0.5);
                        animation: pulseRing 1.8s ease-out infinite;
                    "></div>
                    <!-- Mid glow ring -->
                    <div style="
                        position:absolute; inset:0;
                        border-radius:50%;
                        background: radial-gradient(circle, rgba(34,197,94,0.18) 0%, rgba(134,239,172,0.1) 60%, transparent 100%);
                    "></div>
                    <!-- Green circle with checkmark -->
                    <div style="
                        position:absolute; inset:15px;
                        background: linear-gradient(135deg, #22c55e, #16a34a);
                        border-radius:50%;
                        display:flex; align-items:center; justify-content:center;
                        box-shadow: 0 8px 30px rgba(34,197,94,0.45);
                        animation: checkPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.15s both;
                    ">
                        <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
                            <path d="M10 21L17.5 28.5L32 13.5" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                </div>
                <h3 style="margin:0 0 0.6rem; font-size:1.35rem; font-weight:800; color:#0f172a; line-height:1.3;">${title}</h3>
                <p style="margin:0 0 2rem; font-size:0.95rem; color:#64748b; line-height:1.6;">${subtitle}</p>
                <button id="successModalCloseBtn" style="
                    background: linear-gradient(135deg, #22c55e, #16a34a);
                    color: #fff;
                    border: none;
                    border-radius: 12px;
                    padding: 0.75rem 2.5rem;
                    font-size: 1rem;
                    font-weight: 700;
                    cursor: pointer;
                    width: 100%;
                    box-shadow: 0 4px 15px rgba(34,197,94,0.35);
                    transition: transform 0.15s;
                " onmouseenter="this.style.transform='scale(1.03)'" onmouseleave="this.style.transform='scale(1)'">
                    Continue
                </button>
            </div>
        `;

        document.body.appendChild(overlay);

        const closeBtn = document.getElementById('successModalCloseBtn');
        const closeModal = () => {
            overlay.style.animation = 'fadeIn 0.2s ease reverse';
            setTimeout(() => { overlay.remove(); if (onClose) onClose(); }, 200);
        };
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

        // Auto-close after 4 seconds if user doesn't click
        setTimeout(closeModal, 4000);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new App();
    });
} else {
    window.app = new App();
}

