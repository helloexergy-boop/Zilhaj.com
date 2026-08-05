/**
 * RAJU TRAVELS – Single Page Web Application Engine
 * Journey of Faith, Comfort & Blessings
 */

const API_BASE = 'http://localhost:8080/api';

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
            activeTab: 'browse' // 'browse' or 'request'
        };

        this.init();
    }

    async init() {
        this.renderAuthNav();

        // Populate initial packages immediately from localStorage or default
        const savedPackages = JSON.parse(localStorage.getItem('umrah_packages') || 'null');
        if (savedPackages && Array.isArray(savedPackages) && savedPackages.length > 0) {
            this.state.packages = savedPackages;
        } else {
            this.state.packages = [
                {
                    id: 'pkg-1',
                    agentName: 'UMRAH TRAVELS',
                    title: '18-Day Deluxe Umrah Package',
                    description: 'Journey of Faith, Comfort & Blessings. Complete 18 days pilgrimage featuring top 5-star hotels near Haram, return air tickets, Indian buffet meals, and guided ziyarat.',
                    price: 125000,
                    durationDays: 18,
                    distanceToHaramMakkah: 600,
                    distanceToHaramMadinah: 250,
                    hotelMakkahStars: 5,
                    hotelMadinahStars: 5,
                    availableSeats: 30,
                    departureDateText: '12 AUGUST',
                    makkahHotelName: 'Manarat Al Misk / Dream Zone (or similar)',
                    madinahHotelName: 'Marjan International / Marjan Gold (or similar)',
                    flightRoute: 'Return Air Ticket (SXR-JED-MED-SXR)',
                    sharingType: '4/5 Sharing Accommodation',
                    complimentaryServices: ['Ahram Kit', 'Laundry Service', '5 Litres Zamzam Water'],
                    importantNote: 'Rawdah permits must be booked through Nusuk App.',
                    contactPhone: '9541692891',
                    includes: { flights: true, visa: true, transport: true, meals: true, ziyarah: true },
                    imageUrls: ['https://images.unsplash.com/photo-1591604466107-ec97de577aff']
                }
            ];
            localStorage.setItem('umrah_packages', JSON.stringify(this.state.packages));
        }

        // Render page IMMEDIATELY (0ms delay) so page is never blank!
        this.navigate(this.state.currentPage);

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
        const offersLink = document.getElementById('offersNavLink');
        const offerBadge = document.getElementById('userOfferBadge');

        const localOffers = JSON.parse(localStorage.getItem('umrah_user_offers') || '[]');
        if (offerBadge) offerBadge.innerText = localOffers.length;
        if (offersLink) offersLink.style.display = 'inline-flex';

        if (!authContainer) return;

        if (this.state.currentUser) {
            const isAdmin = this.state.currentUser.role === 'ROLE_ADMIN';
            authContainer.innerHTML = `
                <div class="user-profile-nav" style="display:flex; align-items:center; gap:0.6rem;">
                    ${isAdmin ? `<button class="btn btn-gold btn-sm" onclick="app.navigate('admin')">🔑 Control Panel</button>` : ''}
                    <button class="btn btn-outline btn-sm" onclick="app.logout()">Logout</button>
                </div>
            `;
        } else {
            authContainer.innerHTML = `
                <button class="btn btn-outline btn-sm" onclick="app.openAuthModal('login')">Pilgrim Login</button>
                <button class="btn btn-primary btn-sm" onclick="app.openAuthModal('register')">Register Account</button>
                <button class="btn btn-gold btn-sm" onclick="app.openAuthModal('admin-login')">🔑 Admin Portal</button>
            `;
        }
    }

    async login(email, password) {
        if (!email || !password) {
            this.showToast('Please enter both email and password', 'error');
            return;
        }

        let userObj = null;

        // Try backend REST API first
        const res = await this.apiCall('/auth/login', 'POST', { email, password });
        if (res && res.token) {
            userObj = res;
        } else if (email.trim().toLowerCase() === 'admin@umrah.com' && password === 'password123') {
            // Master Admin Credentials
            userObj = {
                id: 'admin-1',
                name: 'System Administrator',
                email: 'admin@umrah.com',
                role: 'ROLE_ADMIN',
                token: 'master-admin-token'
            };
        } else {
            // Check registered local users list or default pilgrim user
            const registeredUsers = JSON.parse(localStorage.getItem('umrah_registered_users') || '[]');
            const foundUser = registeredUsers.find(u => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password);
            if (foundUser) {
                userObj = {
                    id: foundUser.id || 'usr-' + Date.now(),
                    name: foundUser.name,
                    email: foundUser.email,
                    role: foundUser.role || 'ROLE_USER',
                    token: 'user-local-token'
                };
            } else if (email.trim().toLowerCase() === 'user@pilgrim.com' && password === 'password123') {
                userObj = {
                    id: 'usr-1',
                    name: 'Tariq Mahmood',
                    email: 'user@pilgrim.com',
                    role: 'ROLE_USER',
                    token: 'user-default-token'
                };
            } else if (email && password && password.length >= 4) {
                // Generous sign-in for registered pilgrims
                userObj = {
                    id: 'usr-' + Date.now(),
                    name: email.split('@')[0],
                    email: email,
                    role: 'ROLE_USER',
                    token: 'user-session-token'
                };
            }
        }

        if (userObj) {
            this.state.currentUser = userObj;
            localStorage.setItem('umrah_user', JSON.stringify(userObj));
            this.renderAuthNav();
            this.closeModal();
            if (userObj.role === 'ROLE_ADMIN') {
                this.showToast(`Admin Authenticated! Welcome, ${userObj.name}`, 'success');
                await this.fetchUserData();
                this.navigate('admin');
            } else {
                this.showToast(`Welcome back, ${userObj.name}!`, 'success');
                await this.fetchUserData();
                this.navigate('home');
            }
        } else {
            this.showToast(res?.message || 'Invalid email or password', 'error');
        }
    }

    async register(name, email, password, phone, role = 'ROLE_USER', companyName = '') {
        if (!name || !email || !password) {
            this.showToast('Please fill in name, email, and password', 'error');
            return;
        }

        const payload = { name, email, password, phone, role, companyName };
        const res = await this.apiCall('/auth/register', 'POST', payload);

        // Store in registered users array in localStorage
        const registeredUsers = JSON.parse(localStorage.getItem('umrah_registered_users') || '[]');
        if (!registeredUsers.some(u => u.email.toLowerCase() === email.trim().toLowerCase())) {
            registeredUsers.push({ id: 'usr-' + Date.now(), name, email: email.trim(), password, phone, role });
            localStorage.setItem('umrah_registered_users', JSON.stringify(registeredUsers));
        }

        this.showToast('Account registered successfully! Please log in.', 'success');
        this.openAuthModal('login');
    }

    logout() {
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
        } else if (this.state.packages.length === 0) {
            this.state.packages = [
                {
                    id: 'pkg-1',
                    agentName: 'UMRAH TRAVELS',
                    title: '18-Day Deluxe Umrah Package',
                    description: 'Journey of Faith, Comfort & Blessings. Complete 18 days pilgrimage featuring top 5-star hotels near Haram, return air tickets, Indian buffet meals, and guided ziyarat.',
                    price: 125000,
                    durationDays: 18,
                    distanceToHaramMakkah: 600,
                    distanceToHaramMadinah: 250,
                    hotelMakkahStars: 5,
                    hotelMadinahStars: 5,
                    availableSeats: 30,
                    departureDateText: '12 AUGUST',
                    makkahHotelName: 'Manarat Al Misk / Dream Zone (or similar)',
                    madinahHotelName: 'Marjan International / Marjan Gold (or similar)',
                    flightRoute: 'Return Air Ticket (SXR-JED-MED-SXR)',
                    sharingType: '4/5 Sharing Accommodation',
                    complimentaryServices: ['Ahram Kit', 'Laundry Service', '5 Litres Zamzam Water'],
                    importantNote: 'Rawdah permits must be booked by the pilgrim through the Nusuk App, subject to availability. The company is not responsible for the booking, availability, approval, or non-issuance of the Rawdah permit.',
                    contactPhone: '9541692891',
                    includes: { flights: true, visa: true, transport: true, meals: true, ziyarah: true },
                    imageUrls: ['https://images.unsplash.com/photo-1591604466107-ec97de577aff']
                }
            ];
            localStorage.setItem('umrah_packages', JSON.stringify(this.state.packages));
        }
    }

    navigate(page) {
        this.state.currentPage = page;
        const main = document.getElementById('mainContainer');
        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (page === 'home' || page === 'packages') {
            main.innerHTML = this.renderHomePage();
            this.bindFilterEvents();
            this.initHeroSlideshow();
        } else if (page === 'trust') {
            main.innerHTML = this.renderTrustPage();
        } else if (page === 'bookings') {
            main.innerHTML = this.renderBookingsPage();
        } else if (page === 'offers') {
            main.innerHTML = this.renderOffersPage();
        } else if (page === 'dashboard') {
            main.innerHTML = this.renderDashboardPage();
        } else if (page === 'admin') {
            if (this.state.currentUser?.role === 'ROLE_ADMIN') {
                this.renderAdminPage();
            } else {
                this.showToast('Access restricted to Platform Administrators', 'error');
                this.navigate('home');
            }
        }
    }

    initHeroSlideshow() {
        if (this.slideshowInterval) clearInterval(this.slideshowInterval);
        
        let currentSlide = 0;
        const slides = document.querySelectorAll('.hero-slide');
        const dots = document.querySelectorAll('.slide-dots .dot');
        const quoteEl = document.getElementById('heroQuoteText');

        const quotes = [
            "Labbayk Allahumma Labbayk — Here I am O Allah, at Your service.",
            "Peace and blessings be upon the Beloved Prophet in Madinah Al-Munawwarah.",
            "Perform Umrah with complete peace of mind, luxury, and spiritual comfort.",
            "Experience unforgettable sacred moments near the Holy Rawdah & Haramain."
        ];

        if (slides.length === 0) return;

        const showSlide = (index) => {
            slides.forEach((slide, i) => {
                slide.classList.toggle('active', i === index);
            });
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === index);
            });
            if (quoteEl && quotes[index]) {
                quoteEl.style.opacity = 0;
                setTimeout(() => {
                    quoteEl.innerText = quotes[index];
                    quoteEl.style.opacity = 1;
                }, 200);
            }
            currentSlide = index;
        };

        window.goToSlide = (index) => {
            showSlide(index);
        };

        this.slideshowInterval = setInterval(() => {
            const nextSlide = (currentSlide + 1) % slides.length;
            showSlide(nextSlide);
        }, 4000);
    }

    renderHomePage() {
        return `
            <!-- Hero Banner with Makkah & Madinah Image Slideshow -->
            <section class="hero-slideshow-container">
                <!-- Slideshow Background Images -->
                <div class="hero-slide active" style="background-image: url('https://images.unsplash.com/photo-1591604466107-ec97de577aff?auto=format&fit=crop&w=1600&q=80');"></div>
                <div class="hero-slide" style="background-image: url('https://images.unsplash.com/photo-1542856391-010fb87dcfed?auto=format&fit=crop&w=1600&q=80');"></div>
                <div class="hero-slide" style="background-image: url('https://images.unsplash.com/photo-1565552070094-1a3b379e4bf0?auto=format&fit=crop&w=1600&q=80');"></div>
                <div class="hero-slide" style="background-image: url('https://images.unsplash.com/photo-1519817650390-64a93db51149?auto=format&fit=crop&w=1600&q=80');"></div>
                
                <!-- Crystal Clear Dark Vignette Overlay for High Contrast & Visible Images -->
                <div class="hero-overlay"></div>

                <!-- Hero Content Layer -->
                <div class="hero-content">
                    <div class="hero-badge">
                        <span>✨ UMRAH TRAVELS – Ministry Licensed Official Partner</span>
                    </div>
                    <h1 class="hero-title">UMRAH TRAVELS</h1>
                    
                    <!-- Dynamic Umrah Quote Box -->
                    <div class="hero-quote-box">
                        <span class="quote-mark">“</span>
                        <p class="hero-quote-text" id="heroQuoteText">Labbayk Allahumma Labbayk — Here I am O Allah, at Your service.</p>
                        <span class="quote-mark">”</span>
                    </div>
                    
                    <!-- Search & Custom Requirement Tab Buttons -->
                    <div style="display:flex; justify-content:center; gap:1.2rem; margin-bottom:1.8rem; flex-wrap:wrap;">
                        <button class="btn-glass-tab ${this.state.activeTab === 'browse' ? 'active' : ''}" onclick="app.switchTab('browse')">🕋 Browse Umrah Packages</button>
                        <button class="btn-glass-tab ${this.state.activeTab === 'request' ? 'active' : ''}" onclick="app.switchTab('request')">📝 Submit Custom Requirement</button>
                    </div>

                    ${this.state.activeTab === 'browse' ? `
                        <div class="search-card">
                            <div class="form-group">
                                <label style="color:#0f172a; font-weight:700;">Max Budget Limit (₹)</label>
                                <input type="number" id="quickMaxPrice" class="form-control" value="${this.state.filters.maxPrice}" placeholder="e.g. 150000">
                            </div>
                            <div class="form-group">
                                <label style="color:#0f172a; font-weight:700;">Distance to Kaaba</label>
                                <select id="quickDistance" class="form-control">
                                    <option value="300" ${this.state.filters.maxDistanceMakkah == 300 ? 'selected' : ''}>Under 300 meters</option>
                                    <option value="600" ${this.state.filters.maxDistanceMakkah == 600 ? 'selected' : ''}>Under 600 meters</option>
                                    <option value="1500" ${this.state.filters.maxDistanceMakkah == 1500 ? 'selected' : ''}>Under 1.5 km</option>
                                </select>
                            </div>
                            <div class="form-group" style="justify-content:center;">
                                <label>&nbsp;</label>
                                <button class="btn btn-gold" onclick="app.applyQuickSearch()">🔍 Search Packages</button>
                            </div>
                        </div>
                    ` : ''}
                </div>

                <!-- Slide Navigation Dots -->
                <div class="slide-dots">
                    <span class="dot active" onclick="goToSlide(0)"></span>
                    <span class="dot" onclick="goToSlide(1)"></span>
                    <span class="dot" onclick="goToSlide(2)"></span>
                    <span class="dot" onclick="goToSlide(3)"></span>
                </div>
            </section>

            ${this.state.activeTab === 'request' ? this.renderCustomRequirementForm() : ''}

            <!-- Trust Badges Strip -->
            <section class="trust-strip" id="trust">
                <div class="trust-container">
                    <div class="trust-item">
                        <div class="trust-icon">✈️</div>
                        <div class="trust-text">
                            <h5>Return Air Tickets</h5>
                            <p>Direct flights (SXR-JED-MED-SXR)</p>
                        </div>
                    </div>
                    <div class="trust-item">
                        <div class="trust-icon">🏨</div>
                        <div class="trust-text">
                            <h5>Hotels Near Haram</h5>
                            <p>600m Makkah & 250m Madinah</p>
                        </div>
                    </div>
                    <div class="trust-item">
                        <div class="trust-icon">🍽️</div>
                        <div class="trust-text">
                            <h5>3 Times Buffet Meals</h5>
                            <p>Daily Indian Buffet & Refreshments</p>
                        </div>
                    </div>
                    <div class="trust-item">
                        <div class="trust-icon">📞</div>
                        <div class="trust-text">
                            <h5>Enquiries & Support</h5>
                            <p>Call Direct: 9541692891</p>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Main Package Cards Layout -->
            <section class="packages-layout" id="packages">
                <!-- Filter Sidebar (Booking.com Inspired Filter System) -->
                <aside class="filter-sidebar">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.2rem;">
                        <h3 style="font-size:1.15rem; font-weight:800; color:var(--primary-dark);">Filter Packages</h3>
                        <button class="btn btn-outline btn-sm" onclick="app.resetFilters()">Reset All</button>
                    </div>

                    <!-- Price Filter -->
                    <div class="filter-group">
                        <h4>Budget Limit (₹)</h4>
                        <input type="range" id="filterPriceRange" min="45000" max="400000" step="5000" value="${this.state.filters.maxPrice}" style="width:100%; accent-color:var(--primary);">
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-top:0.4rem; font-weight:700;">
                            <span>₹45,000</span>
                            <span id="priceValueText" style="color:var(--primary);">${this.formatCurrency(this.state.filters.maxPrice)}</span>
                            <span>₹4,00,000</span>
                        </div>
                    </div>

                    <!-- Distance to Kaaba Filter -->
                    <div class="filter-group">
                        <h4>Makkah Distance to Kaaba</h4>
                        <select id="filterDistanceSelect" class="form-control">
                            <option value="2000" ${this.state.filters.maxDistanceMakkah == 2000 ? 'selected' : ''}>Any Distance</option>
                            <option value="300" ${this.state.filters.maxDistanceMakkah == 300 ? 'selected' : ''}>≤ 300 meters (Ultra Close)</option>
                            <option value="600" ${this.state.filters.maxDistanceMakkah == 600 ? 'selected' : ''}>≤ 600 meters (Shuttle/Walk)</option>
                        </select>
                    </div>

                    <!-- Hotel Star Rating Filter -->
                    <div class="filter-group">
                        <h4>Hotel Star Category</h4>
                        <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.88rem; margin-bottom:0.5rem; cursor:pointer;">
                            <input type="checkbox" checked> ⭐⭐⭐⭐⭐ 5-Star Luxury Hotels
                        </label>
                        <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.88rem; margin-bottom:0.5rem; cursor:pointer;">
                            <input type="checkbox" checked> ⭐⭐⭐⭐ 4-Star Premium Hotels
                        </label>
                        <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.88rem; cursor:pointer;">
                            <input type="checkbox"> ⭐⭐⭐ 3-Star Budget Hotels
                        </label>
                    </div>

                    <!-- Duration Filter -->
                    <div class="filter-group">
                        <h4>Trip Duration</h4>
                        <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.88rem; margin-bottom:0.5rem; cursor:pointer;">
                            <input type="checkbox" checked> 18 - 21 Days (Full Umrah)
                        </label>
                        <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.88rem; margin-bottom:0.5rem; cursor:pointer;">
                            <input type="checkbox" checked> 14 - 15 Days (Standard)
                        </label>
                        <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.88rem; cursor:pointer;">
                            <input type="checkbox"> 10 Days (Express Package)
                        </label>
                    </div>

                    <!-- Inclusions & Services Filter -->
                    <div class="filter-group" style="border-bottom:none; margin-bottom:0; padding-bottom:0;">
                        <h4>Key Inclusions</h4>
                        <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.88rem; margin-bottom:0.5rem; cursor:pointer;">
                            <input type="checkbox" checked> ✈️ Direct Flights (SXR-JED-MED)
                        </label>
                        <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.88rem; margin-bottom:0.5rem; cursor:pointer;">
                            <input type="checkbox" checked> 🍽️ 3x Daily Indian Buffet Meals
                        </label>
                        <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.88rem; margin-bottom:0.5rem; cursor:pointer;">
                            <input type="checkbox" checked> 👔 Complimentary Ahram & Zamzam
                        </label>
                        <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.88rem; cursor:pointer;">
                            <input type="checkbox" checked> 📌 Nusuk Permit Assistance
                        </label>
                    </div>
                </aside>

                <!-- Independent Package Scroll Container -->
                <div class="packages-scroll-container">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; sticky:top;">
                        <div>
                            <span style="font-size:0.8rem; color:var(--text-muted); font-weight:600;">Saudi Arabia > Makkah & Madinah</span>
                            <h3 style="font-size:1.25rem;">Available Packages (${this.state.packages.length})</h3>
                        </div>
                        <span style="font-weight:700; color:var(--primary); font-size:0.9rem;">📞 Support: 9541692891</span>
                    </div>

                    <div class="packages-grid-layout">
                        ${this.state.packages.map(pkg => this.renderTravelCard(pkg)).join('')}
                    </div>
                </div>
            </section>
        `;
    }

    renderTravelCard(pkg) {
        const imageUrl = (pkg.imageUrls && pkg.imageUrls.length > 0)
            ? pkg.imageUrls[0]
            : 'https://images.unsplash.com/photo-1591604466107-ec97de577aff';

        const originalPrice = pkg.price ? Math.round(pkg.price * 1.15) : 145000;

        return `
            <div class="travel-card">
                <!-- Left Image Thumbnail & Star Rating -->
                <div class="travel-card-image">
                    <img src="${imageUrl}" alt="${this.escapeHtml(pkg.title)}">
                    <div class="travel-star-badge">⭐ ${pkg.hotelMakkahStars || 5}-Star Stay</div>
                </div>

                <!-- Middle Content Details -->
                <div class="travel-card-body">
                    <div>
                        <div class="travel-agency-strip">
                            <span>🏢 ${this.escapeHtml(pkg.agentName || 'UMRAH TRAVELS')}</span>
                            <span>•</span>
                            <span>📅 Departure: ${this.escapeHtml(pkg.departureDateText || '12 AUG')}</span>
                            <span>•</span>
                            <span>⏳ ${pkg.durationDays || 18} Days</span>
                        </div>
                        <h4 class="travel-pkg-title">${this.escapeHtml(pkg.title)}</h4>

                        <div class="travel-hotels-bar">
                            <div class="travel-hotel-loc">
                                <span>🕋 Makkah:</span>
                                <strong>${this.escapeHtml(pkg.makkahHotelName || 'Manarat Al Misk')}</strong> (${pkg.distanceToHaramMakkah || 600}m)
                            </div>
                            <div class="travel-hotel-loc">
                                <span>🕌 Madinah:</span>
                                <strong>${this.escapeHtml(pkg.madinahHotelName || 'Marjan International')}</strong> (${pkg.distanceToHaramMadinah || 250}m)
                            </div>
                        </div>
                    </div>

                    <!-- Highlight Tags -->
                    <div class="travel-highlights-tags">
                        <span class="travel-tag">✈️ Return Flight (SXR-JED-MED-SXR)</span>
                        <span class="travel-tag">🍽️ 3x Daily Buffet Meals</span>
                        <span class="travel-tag">👔 Ahram & Zamzam Included</span>
                        <span class="travel-tag">📌 Nusuk Permit Assistance</span>
                    </div>
                </div>

                <!-- Right Price & CTA Sidebar -->
                <div class="travel-card-pricing">
                    <div>
                        <div class="travel-original-price">${this.formatCurrency(originalPrice)}</div>
                        <div class="travel-final-price">${this.formatCurrency(pkg.price)}</div>
                        <div class="travel-price-unit">per pilgrim (all taxes incl.)</div>
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
        const pkg = this.state.packages.find(p => p.id === packageId);
        if (!pkg) return;

        this.openModal(`
            <div class="modal-header">
                <h3>${this.escapeHtml(pkg.title)}</h3>
                <p style="color:var(--text-muted); font-size:0.9rem;">By ${this.escapeHtml(pkg.agentName || 'UMRAH TRAVELS')} | Departure: ${this.escapeHtml(pkg.departureDateText || '12 AUGUST')} (${pkg.durationDays || 18} Days)</p>
            </div>
            <div class="modal-body" style="max-height:70vh; overflow-y:auto;">
                <p style="line-height:1.6; margin-bottom:1.2rem; color:var(--text-main);">${this.escapeHtml(pkg.description)}</p>

                <h4 style="color:var(--primary); margin-bottom:0.6rem;">🏨 Hotel Accommodations</h4>
                <div style="background:#f8fafc; border-radius:10px; padding:1rem; margin-bottom:1.2rem; border:1px solid #e2e8f0;">
                    <div style="margin-bottom:0.6rem;">
                        <strong>📍 Makkah Hotel:</strong> ${this.escapeHtml(pkg.makkahHotelName || 'Manarat Al Misk / Dream Zone (or similar)')}<br>
                        <small style="color:#92400e;">Distance: Approx. ${pkg.distanceToHaramMakkah || 600} meters from Masjid Al-Haram</small>
                    </div>
                    <div>
                        <strong>📍 Madinah Hotel:</strong> ${this.escapeHtml(pkg.madinahHotelName || 'Marjan International / Marjan Gold (or similar)')}<br>
                        <small style="color:#92400e;">Distance: Approx. ${pkg.distanceToHaramMadinah || 250} meters from Al-Masjid An-Nabawi</small>
                    </div>
                </div>

                <h4 style="color:var(--primary); margin-bottom:0.6rem;">📦 Full Package Inclusions</h4>
                <ul style="line-height:1.8; margin-left:1.2rem; margin-bottom:1.2rem; color:var(--text-main);">
                    <li>✔ ${this.escapeHtml(pkg.flightRoute || 'Return Air Ticket (SXR-JED-MED-SXR)')}</li>
                    <li>✔ ${this.escapeHtml(pkg.sharingType || '4/5 Sharing Accommodation')}</li>
                    <li>✔ 03 Times Daily Indian Buffet Meals</li>
                    <li>✔ Half-Day Guided Ziyarat in Makkah & Madinah</li>
                    <li>✔ Airport & Intercity AC Transfers</li>
                    <li>✔ Complimentary Gifts: Ahram Kit, Laundry Service, 5 Litres Zamzam Water</li>
                </ul>

                <div style="background:#fef2f2; border:1px solid #fca5a5; border-radius:10px; padding:0.9rem; font-size:0.85rem; color:#991b1b; margin-bottom:1.5rem;">
                    <strong>📌 Important Note:</strong> ${this.escapeHtml(pkg.importantNote || 'Rawdah permits must be booked by the pilgrim through the Nusuk App, subject to availability. The company is not responsible for the booking, availability, approval, or non-issuance of the Rawdah permit.')}
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; background:#ecfdf5; padding:1rem; border-radius:10px; border:1px solid #a7f3d0;">
                    <div>
                        <span style="font-size:0.8rem; text-transform:uppercase; color:#047857; font-weight:700;">Package Price</span>
                        <div style="font-size:1.5rem; font-weight:800; color:#047857;">${this.formatCurrency(pkg.price)}</div>
                    </div>
                    <button class="btn btn-gold" onclick="app.closeModal(); app.startBooking('${pkg.id}')">Book This Package Now</button>
                </div>
            </div>
        `);
    }

    renderCustomRequirementForm() {
        return `
            <div class="main-container" style="max-width:850px; margin:2rem auto;">
                <div class="requirement-card">
                    <h3 style="color:var(--primary); margin-bottom:0.5rem;">📝 Submit Your Custom Package Requirement</h3>
                    <p style="color:var(--text-muted); margin-bottom:1.5rem;">Tell us your travel preferences, and Umrah Travels admins will suggest the best matching package for you.</p>

                    <form onsubmit="event.preventDefault(); app.submitRequirementForm();">
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.2rem; margin-bottom:1rem;">
                            <div class="form-group">
                                <label>Preferred Departure Date</label>
                                <input type="date" id="reqDate" class="form-control" required value="2026-08-12">
                            </div>
                            <div class="form-group">
                                <label>Duration (Days)</label>
                                <input type="number" id="reqDuration" class="form-control" min="7" max="30" value="18" required>
                            </div>
                        </div>

                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.2rem; margin-bottom:1rem;">
                            <div class="form-group">
                                <label>Number of Pilgrims</label>
                                <input type="number" id="reqTravelers" class="form-control" min="1" value="2" required>
                            </div>
                            <div class="form-group">
                                <label>Sharing Room Preference</label>
                                <select id="reqSharing" class="form-control">
                                    <option value="4/5 Sharing Accommodation">4/5 Sharing Accommodation</option>
                                    <option value="Triple Sharing Room">Triple Sharing Room</option>
                                    <option value="Double / Twin Room">Double / Twin Room</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-group" style="margin-bottom:1rem;">
                            <label>Maximum Budget per Pilgrim (₹)</label>
                            <input type="number" id="reqBudget" class="form-control" value="125000" required placeholder="e.g. 125000">
                        </div>

                        <div class="form-group" style="margin-bottom:1.5rem;">
                            <label>Special Notes & Preferences</label>
                            <textarea id="reqNotes" class="form-control" rows="3" placeholder="e.g. Wheelchair assistance required, specific flight preferences..."></textarea>
                        </div>

                        <button type="submit" class="btn btn-gold" style="width:100%; font-size:1.1rem; padding:0.9rem;">
                            Submit Custom Requirement 🚀
                        </button>
                    </form>
                </div>
            </div>
        `;
    }

    async submitRequirementForm() {
        const date = document.getElementById('reqDate')?.value || '2026-08-12';
        const duration = parseInt(document.getElementById('reqDuration')?.value) || 18;
        const travelers = parseInt(document.getElementById('reqTravelers')?.value) || 2;
        const sharing = document.getElementById('reqSharing')?.value || '4/5 Sharing Accommodation';
        const budget = parseFloat(document.getElementById('reqBudget')?.value) || 125000;
        const notes = document.getElementById('reqNotes')?.value || 'Custom trip request';

        const currentUser = this.state.currentUser || {
            id: 'usr-guest-' + Date.now(),
            name: 'Pilgrim User',
            email: 'user@pilgrim.com',
            phone: '9541692891'
        };

        const newReq = {
            id: 'req-' + Date.now(),
            userId: currentUser.id,
            userName: currentUser.name,
            userEmail: currentUser.email,
            userPhone: currentUser.phone || '9541692891',
            preferredDepartureDate: date,
            durationDays: duration,
            travelersCount: travelers,
            sharingPreference: sharing,
            maxBudget: budget,
            specialNotes: notes,
            status: 'PENDING'
        };

        // Try API endpoint
        await this.apiCall('/requirements', 'POST', newReq);

        // Always store locally in localStorage & state
        const localReqs = JSON.parse(localStorage.getItem('umrah_requirements') || '[]');
        localReqs.unshift(newReq);
        localStorage.setItem('umrah_requirements', JSON.stringify(localReqs));
        this.state.admin.requirements = localReqs;

        this.showToast('Travel requirement submitted! Umrah Travels admin will review and offer matching packages.', 'success');
        this.switchTab('browse');
    }

    switchTab(tab) {
        this.state.activeTab = tab;
        this.navigate('home');
    }

    renderTrustPage() {
        return `
            <div class="main-container" style="max-width:900px; margin:4rem auto;">
                <div class="section-title" style="text-align:center;">
                    <h2>UMRAH TRAVELS — Journey of Faith, Comfort & Blessings</h2>
                    <p>Verified Umrah Travel Partner | Enquiries: 9541692891</p>
                </div>
                <div style="background:white; border-radius:16px; padding:2.5rem; box-shadow:var(--shadow-md); border:1px solid var(--border-color);">
                    <h3 style="color:var(--primary); margin-bottom:1rem;">🛡️ Comfort & Blessings Guarantee</h3>
                    <ul style="line-height:2; margin-left:1.5rem; color:var(--text-main);">
                        <li><strong>Hotels Near Haram:</strong> Manarat Al Misk (600m Makkah) & Marjan International (250m Madinah).</li>
                        <li><strong>Complete Inclusions:</strong> Direct Flights (SXR-JED-MED-SXR), 3 Times Daily Indian Buffet Meals, Guided Ziyarat.</li>
                        <li><strong>Complimentary Gifts:</strong> Ahram Kit, Laundry Service & 5 Litres Zamzam Water.</li>
                        <li><strong>Dedicated Support:</strong> Call 9541692891 anytime for bookings & enquiries.</li>
                    </ul>
                </div>
            </div>
        `;
    }

    renderBookingsPage() {
        return `
            <div class="main-container" style="max-width:1000px; margin:3rem auto; padding:0 1.5rem;">
                <div class="section-title" style="text-align:left; margin-bottom:2rem;">
                    <h2>My Bookings & Travel Tickets</h2>
                    <p>View your reservations, payment receipts, and download official PDF travel vouchers.</p>
                </div>

                ${this.state.myBookings.length > 0 ? `
                    <div style="display:flex; flex-direction:column; gap:1.5rem;">
                        ${this.state.myBookings.map(b => `
                            <div style="background:white; border-radius:14px; padding:1.5rem; border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                                <div>
                                    <div style="display:flex; align-items:center; gap:0.8rem; margin-bottom:0.5rem;">
                                        <span class="status-badge status-${b.status ? b.status.toLowerCase() : 'pending'}">${b.status || 'PENDING'}</span>
                                        <span style="font-size:0.85rem; color:var(--text-muted);">Booking Ref: ${b.id}</span>
                                    </div>
                                    <h4 style="font-size:1.2rem;">${this.escapeHtml(b.packageTitle)}</h4>
                                    <p style="font-size:0.9rem; color:var(--text-muted); margin-top:0.2rem;">
                                        🏢 Agency: ${this.escapeHtml(b.agentName || 'UMRAH TRAVELS')} | 👥 Pilgrims: ${b.travelersCount} | 📅 Travel Date: ${b.travelDate || 'TBD'}
                                    </p>
                                    <p style="font-size:1.2rem; font-weight:800; color:var(--primary); margin-top:0.4rem;">
                                        Total Paid: ${this.formatCurrency(b.totalPrice)}
                                    </p>
                                </div>
                                <div style="display:flex; gap:0.8rem;">
                                    <a href="${API_BASE}/invoice/${b.id}" target="_blank" class="btn btn-outline btn-sm">📄 Download PDF Ticket</a>
                                    ${b.status !== 'CANCELLED' ? `<button class="btn btn-danger btn-sm" onclick="app.cancelBooking('${b.id}')">Cancel Booking</button>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div style="background:white; border-radius:14px; padding:4rem; text-align:center;">
                        <h3>No active bookings found</h3>
                        <button class="btn btn-primary" onclick="app.navigate('packages')" style="margin-top:1.5rem;">Browse Umrah Packages</button>
                    </div>
                `}
            </div>
        `;
    }

    renderDashboardPage() {
        const user = this.state.currentUser || {
            name: 'Pilgrim User',
            email: 'user@pilgrim.com',
            phone: '9541692891',
            role: 'ROLE_USER'
        };

        const requirements = JSON.parse(localStorage.getItem('umrah_requirements') || '[]');
        const offers = JSON.parse(localStorage.getItem('umrah_user_offers') || '[]');
        const bookings = this.state.myBookings || JSON.parse(localStorage.getItem('umrah_my_bookings') || '[]');

        return `
            <div class="main-container" style="max-width:1050px; margin:2.5rem auto; padding:0 1.5rem;">
                <!-- Header User Profile Banner -->
                <div style="background:linear-gradient(135deg, #047857 0%, #064e3b 100%); border-radius:16px; padding:2rem; color:white; box-shadow:0 8px 25px rgba(4, 120, 87, 0.25); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1.5rem; margin-bottom:2.5rem;">
                    <div>
                        <div style="display:flex; align-items:center; gap:0.8rem;">
                            <span style="font-size:2.5rem;">👤</span>
                            <div>
                                <h2 style="color:var(--accent-gold); font-size:1.8rem; margin:0;">${this.escapeHtml(user.name)}</h2>
                                <p style="color:#d1fae5; font-size:0.95rem; margin-top:0.2rem;">${this.escapeHtml(user.email)} | 📞 ${this.escapeHtml(user.phone || '9541692891')}</p>
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; gap:0.8rem; flex-wrap:wrap;">
                        <button class="btn btn-gold btn-sm" onclick="app.navigate('home'); app.switchTab('request');">📝 Submit New Requirement</button>
                        <button class="btn btn-outline btn-sm" onclick="app.openAuthModal('login')" style="color:white; border-color:rgba(255,255,255,0.4);">🔑 Switch Account / Login</button>
                    </div>
                </div>

                <!-- Metrics Overview Row -->
                <div class="admin-grid" style="margin-bottom:2.5rem;">
                    <div class="admin-stat-card">
                        <div class="stat-val" style="color:var(--primary);">${requirements.length}</div>
                        <div style="color:var(--text-muted); font-size:0.9rem; font-weight:600;">Submitted Travel Forms</div>
                    </div>
                    <div class="admin-stat-card">
                        <div class="stat-val" style="color:var(--accent-gold);">${offers.length}</div>
                        <div style="color:var(--text-muted); font-size:0.9rem; font-weight:600;">Received Package Offers</div>
                    </div>
                    <div class="admin-stat-card">
                        <div class="stat-val" style="color:#059669;">${bookings.length}</div>
                        <div style="color:var(--text-muted); font-size:0.9rem; font-weight:600;">Confirmed Umrah Bookings</div>
                    </div>
                </div>

                <!-- SECTION 1: MY SUBMITTED TRAVEL REQUIREMENTS -->
                <div style="background:white; border-radius:14px; padding:1.8rem; box-shadow:0 4px 15px rgba(0,0,0,0.05); margin-bottom:2.5rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.2rem;">
                        <h3 style="color:var(--primary-dark); display:flex; align-items:center; gap:0.5rem; margin:0;">
                            📋 My Submitted Travel Requirement Forms (${requirements.length})
                        </h3>
                        <button class="btn btn-gold btn-sm" onclick="app.navigate('home'); app.switchTab('request');">➕ New Form</button>
                    </div>

                    ${requirements.length > 0 ? `
                        <div class="data-table-wrap">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Departure Date</th>
                                        <th>Duration</th>
                                        <th>Pilgrims & Sharing</th>
                                        <th>Max Budget</th>
                                        <th>Special Notes</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${requirements.map(r => `
                                        <tr>
                                            <td><strong>📅 ${r.preferredDepartureDate || 'Any Date'}</strong></td>
                                            <td>⏳ ${r.durationDays || 18} Days</td>
                                            <td>👥 ${r.travelersCount || 1} Person(s)<br><small style="color:var(--text-muted);">${r.sharingPreference || 'Quad'}</small></td>
                                            <td><strong style="color:var(--primary);">${this.formatCurrency(r.maxBudget)}</strong></td>
                                            <td><small style="color:var(--text-muted);">${this.escapeHtml(r.specialNotes || 'Standard requirements')}</small></td>
                                            <td>
                                                ${r.status === 'OFFERED' ? `
                                                    <span style="background:#dcfce7; color:#166534; font-size:0.8rem; font-weight:700; padding:0.3rem 0.7rem; border-radius:99px; display:inline-flex; align-items:center; gap:0.3rem;">
                                                        ✅ Offer Received!
                                                    </span>
                                                ` : `
                                                    <span style="background:#fef3c7; color:#92400e; font-size:0.8rem; font-weight:700; padding:0.3rem 0.7rem; border-radius:99px; display:inline-flex; align-items:center; gap:0.3rem;">
                                                        ⏳ Admin Reviewing
                                                    </span>
                                                `}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div style="text-align:center; padding:2.5rem; color:var(--text-muted);">
                            <p style="font-size:1.05rem; margin-bottom:1rem;">You haven't submitted any custom travel requirement forms yet.</p>
                            <button class="btn btn-gold" onclick="app.navigate('home'); app.switchTab('request');">📝 Submit Your Custom Travel Form</button>
                        </div>
                    `}
                </div>

                <!-- SECTION 2: MY RECEIVED PACKAGE OFFERS -->
                <div style="background:white; border-radius:14px; padding:1.8rem; box-shadow:0 4px 15px rgba(0,0,0,0.05); margin-bottom:2.5rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.2rem;">
                        <h3 style="color:var(--primary-dark); display:flex; align-items:center; gap:0.5rem; margin:0;">
                            🎁 Custom Package Offers Offered to Me (${offers.length})
                        </h3>
                        <button class="btn btn-outline btn-sm" onclick="app.navigate('offers')">View Full Offers Page</button>
                    </div>

                    ${offers.length > 0 ? `
                        <div style="display:flex; flex-direction:column; gap:1.2rem;">
                            ${offers.map(o => `
                                <div style="background:linear-gradient(135deg, #ffffff 0%, #fef3c7 100%); border-radius:12px; padding:1.5rem; border:1.5px solid #fde68a; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                                    <div>
                                        <span style="background:linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color:white; font-size:0.75rem; font-weight:800; padding:0.25rem 0.6rem; border-radius:99px;">
                                            🔥 ${o.discountPercentage}% CUSTOM DISCOUNT OFFER
                                        </span>
                                        <h4 style="margin-top:0.5rem; color:var(--primary-dark); font-size:1.15rem;">${this.escapeHtml(o.packageTitle)}</h4>
                                        <p style="color:#78350f; font-size:0.9rem; margin-top:0.3rem;">
                                            <strong>Admin Note:</strong> ${this.escapeHtml(o.specialNote || 'Matched to your custom requirements.')}
                                        </p>
                                        <div style="margin-top:0.6rem; display:flex; align-items:center; gap:1rem;">
                                            <span style="text-decoration:line-through; color:var(--text-muted); font-size:1rem;">${this.formatCurrency(o.originalPrice)}</span>
                                            <span style="font-size:1.4rem; font-weight:800; color:var(--primary);">${this.formatCurrency(o.discountedPrice)}</span>
                                        </div>
                                    </div>
                                    <button class="btn btn-gold" onclick="app.openPackageDetailModal('${o.packageId}')">Claim & Book Package 🚀</button>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div style="text-align:center; padding:2rem; color:var(--text-muted);">
                            <p>No package offers received yet. Submit a custom requirement form above to receive custom package offers!</p>
                        </div>
                    `}
                </div>

                <!-- SECTION 3: MY CONFIRMED UMRAH BOOKINGS -->
                <div style="background:white; border-radius:14px; padding:1.8rem; box-shadow:0 4px 15px rgba(0,0,0,0.05);">
                    <h3 style="color:var(--primary-dark); margin-bottom:1.2rem;">🎟️ My Confirmed Umrah Trip Bookings (${bookings.length})</h3>
                    ${bookings.length > 0 ? `
                        <div class="data-table-wrap">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Booking Ref</th>
                                        <th>Package Title</th>
                                        <th>Travel Date</th>
                                        <th>Travelers</th>
                                        <th>Total Paid</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${bookings.map(b => `
                                        <tr>
                                            <td><strong>${b.id || 'BK-' + Date.now()}</strong></td>
                                            <td>${this.escapeHtml(b.packageTitle || 'Umrah Package')}</td>
                                            <td>📅 ${b.travelDate || 'Upcoming'}</td>
                                            <td>👥 ${b.travelersCount || 1} Person(s)</td>
                                            <td><strong style="color:var(--primary);">${this.formatCurrency(b.totalPrice)}</strong></td>
                                            <td><span style="background:#dcfce7; color:#166534; font-size:0.8rem; font-weight:700; padding:0.25rem 0.6rem; border-radius:99px;">CONFIRMED</span></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div style="text-align:center; padding:2rem; color:var(--text-muted);">
                            <p>No confirmed bookings found. Browse available packages to book your sacred pilgrimage!</p>
                            <button class="btn btn-primary btn-sm" onclick="app.navigate('packages')" style="margin-top:0.8rem;">Browse Umrah Packages</button>
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    renderOffersPage() {
        const offers = JSON.parse(localStorage.getItem('umrah_user_offers') || '[]');
        return `
            <div class="main-container" style="max-width:900px; margin:3rem auto; padding:0 1.5rem;">
                <div class="section-title" style="text-align:left; margin-bottom:2rem;">
                    <h2>🎁 Offers Available — Tailored Custom Offers</h2>
                    <p>Exclusive package discount offers customized for you by Umrah Travels admin based on your custom requirements.</p>
                </div>

                ${offers.length > 0 ? `
                    <div style="display:flex; flex-direction:column; gap:1.5rem;">
                        ${offers.map(o => `
                            <div style="background:linear-gradient(135deg, #ffffff 0%, #fef3c7 100%); border-radius:14px; padding:1.8rem; border:1.5px solid #fde68a; box-shadow:0 4px 15px rgba(217, 119, 6, 0.15); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1.2rem;">
                                <div>
                                    <span style="background:linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color:white; font-size:0.75rem; font-weight:800; padding:0.3rem 0.7rem; border-radius:99px;">
                                        🔥 ${o.discountPercentage}% CUSTOM OFFER DISCOUNT
                                    </span>
                                    <h3 style="margin-top:0.7rem; color:var(--primary-dark); font-size:1.3rem;">${this.escapeHtml(o.packageTitle)}</h3>
                                    <p style="color:#78350f; font-size:0.95rem; margin-top:0.4rem; background:#fffbeb; padding:0.6rem 0.8rem; border-radius:8px; border:1px solid #fef3c7;">
                                        <strong>Admin Note:</strong> ${this.escapeHtml(o.specialNote || 'Recommended package matched to your custom requirements.')}
                                    </p>
                                    <div style="margin-top:0.8rem; display:flex; align-items:center; gap:1rem;">
                                        <span style="text-decoration:line-through; color:var(--text-muted); font-size:1.1rem;">${this.formatCurrency(o.originalPrice)}</span>
                                        <span style="font-size:1.6rem; font-weight:800; color:var(--primary);">${this.formatCurrency(o.discountedPrice)}</span>
                                    </div>
                                </div>
                                <button class="btn btn-gold" onclick="app.openPackageDetailModal('${o.packageId}')">Claim & View Package 🚀</button>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div style="background:white; border-radius:14px; padding:4rem; text-align:center; box-shadow:0 4px 15px rgba(0,0,0,0.05);">
                        <h3 style="color:var(--primary-dark);">No Custom Package Offers Received Yet</h3>
                        <p style="color:var(--text-muted); margin-top:0.5rem; margin-bottom:1.5rem;">Submit your custom travel requirement on the home page and our admin team will send you custom package offers!</p>
                        <button class="btn btn-gold" onclick="app.navigate('home'); app.switchTab('request');">📝 Submit Custom Requirement Now</button>
                    </div>
                `}
            </div>
        `;
    }

    async renderAdminPage() {
        const main = document.getElementById('mainContainer');
        main.innerHTML = `
            <div class="admin-container">
                <div class="section-title" style="text-align:left; margin-bottom:2rem;">
                    <h2>Admin Dashboard – Umrah Travels Control Panel</h2>
                    <p>Single authorized admin manager to add packages, review pilgrim requirements, and dispatch offers.</p>
                </div>
                <div id="adminAnalyticsArea">Loading metrics...</div>
            </div>
        `;

        const analytics = await this.apiCall('/admin/analytics');
        const users = await this.apiCall('/admin/users');
        const reqs = await this.apiCall('/admin/requirements');

        const localReqs = JSON.parse(localStorage.getItem('umrah_requirements') || '[]');
        const localUsers = JSON.parse(localStorage.getItem('umrah_registered_users') || '[]');

        this.state.admin.analytics = analytics;
        this.state.admin.users = (Array.isArray(users) && users.length > 0) ? users : localUsers;
        this.state.admin.requirements = (Array.isArray(reqs) && reqs.length > 0) ? reqs : localReqs;

        const totalRev = this.state.myBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0) ||
                         this.state.packages.reduce((sum, p) => sum + (p.price || 0), 0);

        const area = document.getElementById('adminAnalyticsArea');
        area.innerHTML = `
            <div class="admin-grid">
                <div class="admin-stat-card">
                    <div class="stat-val">${this.state.packages.length}</div>
                    <div style="color:var(--text-muted); font-size:0.9rem;">Active Listed Packages</div>
                </div>
                <div class="admin-stat-card">
                    <div class="stat-val">${this.state.admin.requirements.length}</div>
                    <div style="color:var(--text-muted); font-size:0.9rem;">Pilgrim Travel Requirements</div>
                </div>
                <div class="admin-stat-card">
                    <div class="stat-val">${this.state.myBookings.length || 1}</div>
                    <div style="color:var(--text-muted); font-size:0.9rem;">Total Bookings</div>
                </div>
                <div class="admin-stat-card">
                    <div class="stat-val" style="color:var(--accent-gold);">${this.formatCurrency(analytics?.totalRevenueINR || totalRev)}</div>
                    <div style="color:var(--text-muted); font-size:0.9rem;">Total Revenue</div>
                </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
                <h3>Admin Control Actions</h3>
                <div style="display:flex; gap:0.8rem;">
                    <a href="${API_BASE}/admin/reports/export" target="_blank" class="btn btn-outline btn-sm">📊 Export CSV Report</a>
                    <button class="btn btn-gold btn-sm" onclick="app.openDispatchOfferModal()">🎁 Dispatch Custom Offer</button>
                    <button class="btn btn-primary btn-sm" onclick="app.openAddPackageModal()">➕ Add Custom Package</button>
                </div>
            </div>

            <!-- Pilgrim Custom Requirements Submissions -->
            <h4 style="margin-bottom:1rem; color:var(--primary);">📋 Pilgrim Travel Requirements Submissions (${this.state.admin.requirements.length})</h4>
            <div class="data-table-wrap">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Pilgrim Name</th>
                            <th>Contact Phone</th>
                            <th>Departure Date</th>
                            <th>Pilgrims & Sharing</th>
                            <th>Max Budget</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.state.admin.requirements.length > 0 ? this.state.admin.requirements.map(r => `
                            <tr>
                                <td><strong>${this.escapeHtml(r.userName || 'Pilgrim User')}</strong><br><small style="color:var(--text-muted);">${this.escapeHtml(r.userEmail || 'user@pilgrim.com')}</small></td>
                                <td>${this.escapeHtml(r.userPhone || '9541692891')}</td>
                                <td>${r.preferredDepartureDate || 'Any'}</td>
                                <td>${r.travelersCount || 1} Person(s) (${r.sharingPreference || 'Quad'})</td>
                                <td>${this.formatCurrency(r.maxBudget)}</td>
                                <td>
                                    ${r.status === 'OFFERED' ? `
                                        <button class="btn btn-outline btn-sm" onclick="app.openSuggestPackageModal('${r.userId || 'usr-1'}', '${r.id}')">🎁 Send Another Offer</button>
                                    ` : `
                                        <button class="btn btn-gold btn-sm" onclick="app.openSuggestPackageModal('${r.userId || 'usr-1'}', '${r.id}')">Give Package Offer</button>
                                    `}
                                </td>
                            </tr>
                        `).join('') : `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">No pilgrim custom requirements submitted yet.</td></tr>`}
                    </tbody>
                </table>
            </div>

            <!-- Packages View -->
            <h4 style="margin-top:2rem; margin-bottom:1rem;">Listed Available Packages (${this.state.packages.length})</h4>
            <div class="data-table-wrap">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Departure</th>
                            <th>Package Title</th>
                            <th>Makkah Hotel</th>
                            <th>Madinah Hotel</th>
                            <th>Price</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.state.packages.map(p => `
                            <tr>
                                <td><strong>${p.departureDateText || '12 AUG'}</strong></td>
                                <td>${this.escapeHtml(p.title)}</td>
                                <td>${this.escapeHtml(p.makkahHotelName || 'Manarat Al Misk')} (${p.distanceToHaramMakkah || 600}m)</td>
                                <td>${this.escapeHtml(p.madinahHotelName || 'Marjan International')} (${p.distanceToHaramMadinah || 250}m)</td>
                                <td>${this.formatCurrency(p.price)}</td>
                                <td>
                                    <button class="btn btn-danger btn-sm" onclick="app.deletePackageByAdmin('${p.id}')">Delete</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    bindFilterEvents() {
        const range = document.getElementById('filterPriceRange');
        const text = document.getElementById('priceValueText');
        const dist = document.getElementById('filterDistanceSelect');

        if (range) {
            range.addEventListener('input', (e) => {
                text.innerText = this.formatCurrency(e.target.value);
                this.state.filters.maxPrice = e.target.value;
                this.fetchPackages().then(() => this.navigate('packages'));
            });
        }
        if (dist) {
            dist.addEventListener('change', (e) => {
                this.state.filters.maxDistanceMakkah = e.target.value;
                this.fetchPackages().then(() => this.navigate('packages'));
            });
        }
    }

    applyQuickSearch() {
        const price = document.getElementById('quickMaxPrice').value;
        const dist = document.getElementById('quickDistance').value;
        this.state.filters.maxPrice = price || 250000;
        this.state.filters.maxDistanceMakkah = dist || 1000;
        this.fetchPackages().then(() => this.navigate('packages'));
    }

    resetFilters() {
        this.state.filters = { maxPrice: 250000, maxDistanceMakkah: 1000, flightsOnly: false };
        this.fetchPackages().then(() => this.navigate('packages'));
    }

    openModal(contentHtml) {
        document.getElementById('modalContent').innerHTML = contentHtml;
        document.getElementById('modalBackdrop').classList.add('active');
    }

    closeModal() {
        document.getElementById('modalBackdrop').classList.remove('active');
    }

    openAuthModal(mode = 'login') {
        const isAdminMode = mode === 'admin-login';
        const isLogin = mode === 'login' || mode === 'admin-login';

        this.openModal(`
            <div class="modal-header" style="padding-bottom:0.5rem;">
                <div class="auth-tab-bar">
                    <button class="auth-tab-btn ${mode === 'login' ? 'active' : ''}" onclick="app.openAuthModal('login')">👤 Pilgrim Login</button>
                    <button class="auth-tab-btn ${mode === 'register' ? 'active' : ''}" onclick="app.openAuthModal('register')">📝 Pilgrim Sign Up</button>
                    <button class="auth-tab-btn ${mode === 'admin-login' ? 'active-admin' : ''}" onclick="app.openAuthModal('admin-login')">🔑 Admin Login</button>
                </div>
            </div>
            <div class="modal-body">
                <div style="margin-bottom:1.2rem; text-align:center;">
                    <h3 style="color:${isAdminMode ? 'var(--accent-gold)' : 'var(--primary)'}; font-size:1.3rem;">
                        ${mode === 'login' ? '👤 Pilgrim Portal Sign In' : ''}
                        ${mode === 'register' ? '📝 Create Pilgrim Travel Account' : ''}
                        ${mode === 'admin-login' ? '🔑 Admin Portal Login' : ''}
                    </h3>
                    <p style="font-size:0.85rem; color:var(--text-muted); margin-top:0.2rem;">
                        ${isAdminMode ? 'Authorized Management Access Only' : 'Book verified Umrah packages with hotels near Haram'}
                    </p>
                </div>

                <form onsubmit="event.preventDefault(); app.handleAuthSubmit('${mode}');">
                    ${!isLogin ? `
                        <div class="form-group" style="margin-bottom:1rem;">
                            <label>Full Name</label>
                            <input type="text" id="authName" class="form-control" required placeholder="e.g. Tariq Mahmood">
                        </div>
                    ` : ''}

                    <div class="form-group" style="margin-bottom:1rem;">
                        <label>Email Address</label>
                        <input type="email" id="authEmail" class="form-control" required placeholder="${isAdminMode ? 'admin@umrah.com' : 'user@pilgrim.com'}">
                    </div>

                    <div class="form-group" style="margin-bottom:1.5rem;">
                        <label>Password</label>
                        <input type="password" id="authPassword" class="form-control" required placeholder="••••••••">
                    </div>

                    ${!isLogin ? `
                        <div class="form-group" style="margin-bottom:1.5rem;">
                            <label>Phone Number</label>
                            <input type="tel" id="authPhone" class="form-control" required placeholder="e.g. 9541692891">
                        </div>
                    ` : ''}

                    <button type="submit" class="btn ${isAdminMode ? 'btn-gold' : 'btn-primary'}" style="width:100%; font-size:1rem; padding:0.85rem;">
                        ${mode === 'login' ? 'Sign In to Pilgrim Portal 🚀' : ''}
                        ${mode === 'register' ? 'Create Pilgrim Account 📝' : ''}
                        ${mode === 'admin-login' ? 'Sign In to Admin Control Panel 🔑' : ''}
                    </button>
                </form>
            </div>
        `);
    }

    handleAuthSubmit(mode) {
        const emailEl = document.getElementById('authEmail');
        const passwordEl = document.getElementById('authPassword');

        if (!emailEl || !passwordEl) return;

        const email = emailEl.value.trim();
        const password = passwordEl.value.trim();

        if (mode === 'login' || mode === 'admin-login') {
            this.login(email, password);
        } else if (mode === 'register') {
            const name = document.getElementById('authName')?.value || '';
            const phone = document.getElementById('authPhone')?.value || '';
            this.register(name, email, password, phone, 'ROLE_USER', '');
        }
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
                        <input type="text" id="pkgTitle" class="form-control" required value="18-Day Deluxe Umrah Package">
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
                        <div class="form-group">
                            <label>Departure Date</label>
                            <input type="text" id="pkgDeparture" class="form-control" required value="12 AUGUST">
                        </div>
                        <div class="form-group">
                            <label>Duration (Days)</label>
                            <input type="number" id="pkgDuration" class="form-control" required value="18">
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
                        <div class="form-group">
                            <label>Makkah Hotel Name</label>
                            <input type="text" id="pkgMakkahHotel" class="form-control" required value="Manarat Al Misk / Dream Zone (or similar)">
                        </div>
                        <div class="form-group">
                            <label>Distance to Kaaba (Meters)</label>
                            <input type="number" id="pkgDistMakkah" class="form-control" required value="600">
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
                        <div class="form-group">
                            <label>Madinah Hotel Name</label>
                            <input type="text" id="pkgMadinahHotel" class="form-control" required value="Marjan International / Marjan Gold (or similar)">
                        </div>
                        <div class="form-group">
                            <label>Distance to Nabawi (Meters)</label>
                            <input type="number" id="pkgDistMadinah" class="form-control" required value="250">
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
                        <div class="form-group">
                            <label>Flight Route</label>
                            <input type="text" id="pkgFlightRoute" class="form-control" required value="Return Air Ticket (SXR-JED-MED-SXR)">
                        </div>
                        <div class="form-group">
                            <label>Sharing Accommodation</label>
                            <input type="text" id="pkgSharing" class="form-control" required value="4/5 Sharing Accommodation">
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
                        <div class="form-group">
                            <label>Price (₹)</label>
                            <input type="number" id="pkgPrice" class="form-control" required value="125000">
                        </div>
                        <div class="form-group">
                            <label>Enquiries Contact Phone</label>
                            <input type="text" id="pkgPhone" class="form-control" required value="9541692891">
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width:100%;">Publish Package to Website 🚀</button>
                </form>
            </div>
        `);
    }

    async submitNewPackage() {
        const title = document.getElementById('pkgTitle')?.value || 'New Umrah Package';
        const departure = document.getElementById('pkgDeparture')?.value || '12 AUGUST';
        const duration = parseInt(document.getElementById('pkgDuration')?.value) || 18;
        const makkahHotel = document.getElementById('pkgMakkahHotel')?.value || 'Manarat Al Misk (or similar)';
        const distMakkah = parseInt(document.getElementById('pkgDistMakkah')?.value) || 600;
        const madinahHotel = document.getElementById('pkgMadinahHotel')?.value || 'Marjan International (or similar)';
        const distMadinah = parseInt(document.getElementById('pkgDistMadinah')?.value) || 250;
        const flightRoute = document.getElementById('pkgFlightRoute')?.value || 'Return Air Ticket (SXR-JED-MED-SXR)';
        const sharingType = document.getElementById('pkgSharing')?.value || '4/5 Sharing Accommodation';
        const price = parseFloat(document.getElementById('pkgPrice')?.value) || 125000;
        const phone = document.getElementById('pkgPhone')?.value || '9541692891';

        const newPkg = {
            id: 'pkg-' + Date.now(),
            agentName: 'UMRAH TRAVELS',
            title,
            description: `Journey of Faith, Comfort & Blessings. Complete ${duration} days pilgrimage featuring top hotels near Haram, return air tickets, Indian buffet meals, and guided ziyarat.`,
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
            <div class="modal-header">
                <h3>🎁 Give Custom Package Offer to Pilgrim</h3>
                ${req ? `<p style="color:var(--text-muted); font-size:0.88rem; margin-top:0.3rem;">Pilgrim Request: <strong>${this.escapeHtml(req.userName)}</strong> (${req.travelersCount} Pilgrims, Departure: ${req.preferredDepartureDate}, Budget: ${this.formatCurrency(req.maxBudget)})</p>` : ''}
            </div>
            <div class="modal-body" style="max-height:75vh; overflow-y:auto;">
                <div class="auth-tab-bar" style="margin-bottom:1.2rem;">
                    <button class="auth-tab-btn active" id="tabOptExisting" onclick="app.toggleOfferMode('existing')">📦 Select From Available Packages</button>
                    <button class="auth-tab-btn" id="tabOptCustom" onclick="app.toggleOfferMode('custom')">🛠️ Create Custom Package Offer</button>
                </div>

                <!-- MODE 1: SELECT FROM EXISTING PACKAGES -->
                <form id="formOfferExisting" onsubmit="event.preventDefault(); app.submitSuggestOffer('${userId}', '${reqId}', 'existing');">
                    <div class="form-group" style="margin-bottom:1.2rem;">
                        <label style="font-weight:700; color:var(--primary-dark);">CHOOSE AN AVAILABLE PACKAGE (${this.state.packages.length}):</label>
                        <div style="display:flex; flex-direction:column; gap:0.8rem; margin-top:0.6rem;">
                            ${this.state.packages.length > 0 ? this.state.packages.map((p, idx) => `
                                <label style="display:flex; align-items:flex-start; gap:0.8rem; background:#f8fafc; border:1.5px solid #cbd5e1; border-radius:10px; padding:0.9rem; cursor:pointer;">
                                    <input type="radio" name="offerPackageSelect" value="${p.id}" ${idx === 0 ? 'checked' : ''} style="margin-top:0.3rem; accent-color:var(--primary);">
                                    <div style="flex:1;">
                                        <div style="display:flex; justify-content:space-between; align-items:center;">
                                            <strong style="color:var(--primary-dark); font-size:1rem;">${this.escapeHtml(p.title)}</strong>
                                            <span style="font-weight:800; color:var(--primary); font-size:1.05rem;">${this.formatCurrency(p.price)}</span>
                                        </div>
                                        <div style="font-size:0.83rem; color:var(--text-muted); margin-top:0.4rem; line-height:1.4;">
                                            📅 Departure: <strong>${p.departureDateText || '12 AUG'}</strong> | ⏳ <strong>${p.durationDays || 18} Days</strong><br>
                                            🕋 Makkah: ${this.escapeHtml(p.makkahHotelName || 'Manarat Al Misk')} (${p.distanceToHaramMakkah || 600}m) | 🕌 Madinah: ${this.escapeHtml(p.madinahHotelName || 'Marjan International')} (${p.distanceToHaramMadinah || 250}m)
                                        </div>
                                    </div>
                                </label>
                            `).join('') : '<p style="color:var(--text-muted); text-align:center; padding:1rem;">No packages currently listed. Switch tab to "Create Custom Package Offer".</p>'}
                        </div>
                    </div>
                    <div class="form-group" style="margin-bottom:1rem;">
                        <label style="font-weight:700;">Special Discount Percentage (%)</label>
                        <input type="number" id="offerDiscount" class="form-control" min="0" max="50" value="10" required>
                    </div>
                    <div class="form-group" style="margin-bottom:1.5rem;">
                        <label style="font-weight:700;">Personalized Admin Recommendation Note</label>
                        <textarea id="offerNote" class="form-control" rows="2" required>Special custom package offer matched to your requested departure date, duration, and budget requirements.</textarea>
                    </div>
                    <button type="submit" class="btn btn-gold" style="width:100%; font-size:1.05rem; padding:0.9rem;">
                        Send Custom Package Offer to Pilgrim 🚀
                    </button>
                </form>

                <!-- MODE 2: CREATE CUSTOM PACKAGE OFFER -->
                <form id="formOfferCustom" style="display:none;" onsubmit="event.preventDefault(); app.submitSuggestOffer('${userId}', '${reqId}', 'custom');">
                    <div class="form-group" style="margin-bottom:1rem;">
                        <label style="font-weight:700;">Custom Offer Package Title</label>
                        <input type="text" id="custTitle" class="form-control" required value="${req ? 'Tailored ' + req.durationDays + '-Day Package for ' + req.userName : 'Custom Tailored Umrah Package'}">
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
                        <div class="form-group">
                            <label style="font-weight:700;">Offered Price per Pilgrim (₹)</label>
                            <input type="number" id="custPrice" class="form-control" required value="${req ? req.maxBudget : 125000}">
                        </div>
                        <div class="form-group">
                            <label style="font-weight:700;">Original Base Price (₹)</label>
                            <input type="number" id="custOrigPrice" class="form-control" required value="${req ? Math.round(req.maxBudget * 1.15) : 145000}">
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
                        <div class="form-group">
                            <label style="font-weight:700;">Departure Date</label>
                            <input type="text" id="custDeparture" class="form-control" required value="${req ? req.preferredDepartureDate : '15 AUGUST'}">
                        </div>
                        <div class="form-group">
                            <label style="font-weight:700;">Duration (Days)</label>
                            <input type="number" id="custDuration" class="form-control" required value="${req ? req.durationDays : 18}">
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
                        <div class="form-group">
                            <label style="font-weight:700;">Makkah Hotel & Distance</label>
                            <input type="text" id="custMakkahHotel" class="form-control" required value="Swissotel Makkah / Dream Zone (400m)">
                        </div>
                        <div class="form-group">
                            <label style="font-weight:700;">Madinah Hotel & Distance</label>
                            <input type="text" id="custMadinahHotel" class="form-control" required value="Marjan International / Gold (200m)">
                        </div>
                    </div>
                    <div class="form-group" style="margin-bottom:1.5rem;">
                        <label style="font-weight:700;">Admin Special Recommendation Note</label>
                        <textarea id="custNote" class="form-control" rows="2" required>Exclusive custom package tailored specifically to your requested dates, room sharing, and budget requirements.</textarea>
                    </div>
                    <button type="submit" class="btn btn-gold" style="width:100%; font-size:1.05rem; padding:0.9rem;">
                        Publish & Send Custom Package Offer to Pilgrim 🚀
                    </button>
                </form>
            </div>
        `);
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

            const discountPercentage = parseFloat(document.getElementById('offerDiscount').value) || 10;
            const specialNote = document.getElementById('offerNote').value;

            const pkg = this.state.packages.find(p => p.id === packageId);
            if (!pkg) {
                this.showToast('Selected package not found', 'error');
                return;
            }

            const originalPrice = pkg.price || 125000;
            const discountedPrice = Math.round(originalPrice * (1 - discountPercentage / 100));

            offerObj = {
                id: 'off-' + Date.now(),
                userId: userId || 'usr-1',
                requirementId: reqId,
                packageId: pkg.id,
                packageTitle: pkg.title,
                discountPercentage,
                specialNote,
                originalPrice,
                discountedPrice,
                departureDateText: pkg.departureDateText || '12 AUGUST',
                durationDays: pkg.durationDays || 18,
                makkahHotelName: pkg.makkahHotelName || 'Manarat Al Misk',
                madinahHotelName: pkg.madinahHotelName || 'Marjan International',
                distanceToHaramMakkah: pkg.distanceToHaramMakkah || 600,
                distanceToHaramMadinah: pkg.distanceToHaramMadinah || 250,
                createdAt: new Date().toLocaleDateString()
            };
        } else {
            // CUSTOM PACKAGE OFFER MODE
            const title = document.getElementById('custTitle').value;
            const price = parseFloat(document.getElementById('custPrice').value) || 125000;
            const origPrice = parseFloat(document.getElementById('custOrigPrice').value) || Math.round(price * 1.15);
            const departure = document.getElementById('custDeparture').value;
            const duration = parseInt(document.getElementById('custDuration').value) || 18;
            const makkahHotel = document.getElementById('custMakkahHotel').value;
            const madinahHotel = document.getElementById('custMadinahHotel').value;
            const note = document.getElementById('custNote').value;

            const discountPercentage = Math.round(((origPrice - price) / origPrice) * 100) || 15;

            // Save as new package in available packages list as well
            const newPkg = {
                id: 'pkg-' + Date.now(),
                agentName: 'UMRAH TRAVELS',
                title,
                description: `Custom package tailored specifically to your requested dates, room sharing, and budget requirements.`,
                price,
                durationDays: duration,
                distanceToHaramMakkah: 400,
                distanceToHaramMadinah: 250,
                departureDateText: departure,
                makkahHotelName: makkahHotel,
                madinahHotelName: madinahHotel,
                flightRoute: 'Return Air Ticket (SXR-JED-MED-SXR)',
                sharingType: 'Custom Room Sharing',
                contactPhone: '9541692891',
                includes: { flights: true, visa: true, transport: true, meals: true, ziyarah: true },
                imageUrls: ['https://images.unsplash.com/photo-1591604466107-ec97de577aff']
            };

            this.state.packages.unshift(newPkg);
            localStorage.setItem('umrah_packages', JSON.stringify(this.state.packages));

            offerObj = {
                id: 'off-' + Date.now(),
                userId: userId || 'usr-1',
                requirementId: reqId,
                packageId: newPkg.id,
                packageTitle: title,
                discountPercentage,
                specialNote: note,
                originalPrice: origPrice,
                discountedPrice: price,
                departureDateText: departure,
                durationDays: duration,
                makkahHotelName: makkahHotel,
                madinahHotelName: madinahHotel,
                createdAt: new Date().toLocaleDateString()
            };
        }

        // Try API call
        await this.apiCall('/admin/offers', 'POST', offerObj);

        // Save offer into localStorage and update userOffers state
        const localOffers = JSON.parse(localStorage.getItem('umrah_user_offers') || '[]');
        localOffers.unshift(offerObj);
        localStorage.setItem('umrah_user_offers', JSON.stringify(localOffers));
        this.state.userOffers = localOffers;

        // Update requirement status if exists
        if (reqId) {
            const localReqs = JSON.parse(localStorage.getItem('umrah_requirements') || '[]');
            const reqIndex = localReqs.findIndex(r => r.id === reqId);
            if (reqIndex !== -1) {
                localReqs[reqIndex].status = 'OFFERED';
                localReqs[reqIndex].offeredPackageTitle = offerObj.packageTitle;
                localStorage.setItem('umrah_requirements', JSON.stringify(localReqs));
                this.state.admin.requirements = localReqs;
            }
        }

        // Update badge count in header
        const offerBadge = document.getElementById('userOfferBadge');
        if (offerBadge) {
            offerBadge.innerText = localOffers.length;
            const offersLink = document.getElementById('offersNavLink');
            if (offersLink) offersLink.style.display = 'inline-flex';
        }

        this.showToast(`Custom offer for "${offerObj.packageTitle}" sent to pilgrim! It is now live on the Available Offers tab.`, 'success');
        this.closeModal();

        if (this.state.currentPage === 'admin') {
            this.renderAdminPage();
        }
    }

    openDispatchOfferModal() {
        if (this.state.admin.users.length === 0) {
            this.showToast('No registered users found', 'error');
            return;
        }
        this.openSuggestPackageModal(this.state.admin.users[0].id);
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

    startBooking(packageId) {
        if (!this.state.currentUser) {
            this.showToast('Please sign in to proceed with booking', 'error');
            this.openAuthModal('login');
            return;
        }

        const pkg = this.state.packages.find(p => p.id === packageId);
        if (!pkg) return;

        this.openModal(`
            <div class="modal-header">
                <h3>📋 Book Umrah Package</h3>
                <p style="color:var(--text-muted); font-size:0.9rem;">${this.escapeHtml(pkg.title)}</p>
            </div>
            <div class="modal-body">
                <form onsubmit="event.preventDefault(); app.submitBookingForm('${pkg.id}');">
                    <div class="form-group" style="margin-bottom:1rem;">
                        <label>Travel Date</label>
                        <input type="date" id="bookDate" class="form-control" required value="2026-08-12">
                    </div>
                    <div class="form-group" style="margin-bottom:1rem;">
                        <label>Number of Pilgrims</label>
                        <input type="number" id="bookCount" class="form-control" min="1" max="${pkg.availableSeats}" value="1" onchange="document.getElementById('calcTotal').innerText = app.formatCurrency(this.value * ${pkg.price})">
                    </div>
                    <div class="form-group" style="margin-bottom:1rem;">
                        <label>Contact Phone Number (Enquiries: 9541692891)</label>
                        <input type="tel" id="bookPhone" class="form-control" required value="9541692891">
                    </div>
                    
                    <h4 style="margin-top:1.2rem; margin-bottom:0.8rem;">Pilgrim 1 Passport Info</h4>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.5rem;">
                        <div class="form-group">
                            <label>Full Legal Name</label>
                            <input type="text" id="passName1" class="form-control" required value="${this.escapeHtml(this.state.currentUser.name)}">
                        </div>
                        <div class="form-group">
                            <label>Passport Number</label>
                            <input type="text" id="passNum1" class="form-control" required value="Z9840192">
                        </div>
                    </div>

                    <div style="background:var(--primary-light); padding:1rem; border-radius:8px; margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center;">
                        <span>Total Payable Amount:</span>
                        <strong id="calcTotal" style="font-size:1.4rem; color:var(--primary);">${this.formatCurrency(pkg.price)}</strong>
                    </div>

                    <button type="submit" class="btn btn-primary" style="width:100%;">Proceed to Checkout 💳</button>
                </form>
            </div>
        `);
    }

    async submitBookingForm(packageId) {
        const date = document.getElementById('bookDate').value;
        const count = parseInt(document.getElementById('bookCount').value);
        const phone = document.getElementById('bookPhone').value;
        const passName = document.getElementById('passName1').value;
        const passNum = document.getElementById('passNum1').value;

        const bookingPayload = {
            packageId,
            travelersCount: count,
            travelDate: date,
            contactPhone: phone,
            passengers: [{ fullName: passName, passportNumber: passNum }]
        };

        const res = await this.apiCall('/bookings', 'POST', bookingPayload);
        if (res && res.id) {
            this.showToast('Booking created! Opening checkout...', 'success');
            this.openPaymentModal(res);
        } else {
            this.showToast(res?.message || 'Booking creation failed', 'error');
        }
    }

    openPaymentModal(booking) {
        this.openModal(`
            <div class="modal-header" style="text-align:center;">
                <span style="font-size:2.5rem;">💳</span>
                <h2>Payment Checkout</h2>
                <p style="color:var(--text-muted);">Amount Payable: <strong>${this.formatCurrency(booking.totalPrice)}</strong></p>
            </div>
            <div class="modal-body">
                <div class="form-group" style="margin-bottom:1rem;">
                    <label>Select Payment Option</label>
                    <select id="payMethod" class="form-control">
                        <option value="UPI">UPI (GPay / PhonePe / Paytm / BHIM)</option>
                        <option value="RAZORPAY">Razorpay Gateway</option>
                        <option value="STRIPE">Credit / Debit Card</option>
                    </select>
                </div>
                <button class="btn btn-gold" style="width:100%; font-size:1.1rem; padding:0.9rem;" onclick="app.processPaymentCheckout('${booking.id}')">
                    Pay ${this.formatCurrency(booking.totalPrice)} & Download PDF Voucher 📄
                </button>
            </div>
        `);
    }

    async processPaymentCheckout(bookingId) {
        const method = document.getElementById('payMethod').value;
        const res = await this.apiCall('/payments/checkout', 'POST', {
            bookingId,
            paymentMethod: method
        });

        if (res && res.status === 'SUCCESS') {
            this.showToast('Payment Successful! Travel Ticket PDF ready.', 'success');
            await this.fetchUserData();
            this.openModal(`
                <div class="modal-header" style="text-align:center;">
                    <span style="font-size:3rem;">🎉</span>
                    <h2>Booking Confirmed!</h2>
                    <p style="color:var(--primary); font-weight:700;">Transaction Ref: ${res.transactionId}</p>
                </div>
                <div class="modal-body" style="text-align:center;">
                    <p style="margin-bottom:1.5rem;">May Allah accept your Umrah! Your official invoice and voucher has been generated.</p>
                    <a href="${API_BASE}/invoice/${bookingId}" target="_blank" class="btn btn-primary" style="width:100%;">
                        📄 View & Download Official PDF Ticket
                    </a>
                </div>
            `);
        } else {
            this.showToast(res?.message || 'Payment checkout failed', 'error');
        }
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

    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerText = message;

        container.appendChild(toast);
        setTimeout(() => {
            toast.remove();
        }, 3500);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new App();
    });
} else {
    window.app = new App();
}
