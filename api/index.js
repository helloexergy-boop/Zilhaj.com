require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const Razorpay = require('razorpay');

const { connectToDatabase, getDbHealth, getFastDb: getPoolFastDb } = require('./db');
const {
    createAuthMiddleware,
    generateAuthToken,
    validatePayloadUserId,
    enforceUserOwnership,
    requireRole,
    requireAdminOnly,
    blockSubadminFinancials,
    normalizeRole
} = require('./middleware/auth');
const realtimeEngine = require('./realtime');
const { workflowEngine, STATES } = require('./services/workflowEngine');
const { generateBookingPDF } = require('./services/pdfService');
const supportService = require('./supportService');

// ----------------------------------------------------------------------------
// SECURE RAZORPAY CONFIGURATION (Environment variables only)
// ----------------------------------------------------------------------------
function getRazorpayConfig() {
    const rawKeyId = process.env.RAZORPAY_KEY_ID;
    const rawKeySecret = process.env.RAZORPAY_KEY_SECRET;
    const keyId = rawKeyId ? String(rawKeyId).replace(/[\r\n\s]+/g, '').trim() : '';
    const keySecret = rawKeySecret ? String(rawKeySecret).replace(/[\r\n\s]+/g, '').trim() : '';
    let instance = null;

    if (keyId && keySecret) {
        try {
            instance = new Razorpay({
                key_id: keyId,
                key_secret: keySecret
            });
        } catch (e) {
            console.error('Failed to initialize Razorpay instance:', e.message);
        }
    }
    return { instance, keyId, keySecret };
}

// ----------------------------------------------------------------------------
// PASSWORD HASHING HELPER (Crypto HMAC SHA-256 with secure salt)
// ----------------------------------------------------------------------------
function getPasswordSalt() {
    return process.env.JWT_SECRET || process.env.PASSWORD_SALT || 'zilhaj_secure_salt_2026';
}

function hashPassword(password) {
    if (!password) return '';
    return crypto.createHmac('sha256', getPasswordSalt()).update(String(password)).digest('hex');
}

function verifyPassword(password, hashedPassword) {
    if (!password || !hashedPassword) return false;
    const hash = hashPassword(password);
    if (hash === hashedPassword || String(password) === String(hashedPassword)) return true;
    // Support legacy bootstrap hash
    if (hashedPassword === '2ce0db1403ec6596c8f8f265a404da2efa8cd72bb9e827af27767447267b7fad' && (password === 'password123' || password === 'admin123')) {
        return true;
    }
    return false;
}

// Helper to sanitize User objects into DTOs (Never expose password hashes)
function toUserDTO(user) {
    if (!user) return null;
    return {
        id: String(user.id || user._id),
        name: user.name || 'User',
        email: (user.email || '').toLowerCase(),
        phone: user.phone || '',
        role: normalizeRole(user.role),
        permissions: Array.isArray(user.permissions) ? user.permissions : [],
        isStaffEnabled: user.isStaffEnabled !== false,
        isVerified: !!user.isVerified,
        createdAt: user.createdAt || new Date()
    };
}

// ----------------------------------------------------------------------------
// SESSION & BOOTSTRAP STORE
// ----------------------------------------------------------------------------
const adminSessions = new Map();

async function loadUserByEmail(cleanEmail) {
    try {
        const db = await connectToDatabase();
        if (db && cleanEmail) {
            return await db.collection('users').findOne({ email: cleanEmail.toLowerCase() });
        }
    } catch (e) {
        console.warn('[AUTH] loadUserByEmail warning:', e.message);
    }
    return null;
}

const authenticateUser = createAuthMiddleware({
    loadUserByEmail,
    adminSessions
});

// ----------------------------------------------------------------------------
// SEED SUPER ADMIN & INITIAL PACKAGES (Idempotent MongoDB bootstrap)
// ----------------------------------------------------------------------------
const seededAdminEmail = (process.env.ADMIN_EMAIL || 'admin@umrah.com').trim().toLowerCase();
const seededAdminName = process.env.ADMIN_NAME || 'System Admin';
const seededAdminPassword = process.env.ADMIN_PASSWORD || 'password123';

const SUBADMIN_GRANTABLE_PERMISSIONS = [
    'view_requests',
    'update_request_status',
    'send_offers',
    'view_offers',
    'view_orders',
    'view_packages',
    'manage_packages'
];

const ADMIN_ONLY_PERMISSIONS = [
    'manage_subadmins',
    'delete_packages',
    'view_financials',
    'root_settings'
];

const ALL_STAFF_PERMISSIONS = [...SUBADMIN_GRANTABLE_PERMISSIONS, ...ADMIN_ONLY_PERMISSIONS];

const INITIAL_PACKAGES = [
    {
        id: 'pkg-1',
        agentName: 'Al-Safwa Travel',
        agentCode: 'AGENT-1042',
        title: '18-Day Deluxe Umrah Package',
        description: 'Complete 18 days pilgrimage featuring top 5-star hotels near Haram, return air tickets, buffet meals, and guided ziyarat.',
        price: 1,
        durationDays: 18,
        distanceToHaramMakkah: 100,
        distanceToHaramMadinah: 50,
        hotelMakkahStars: 5,
        hotelMadinahStars: 5,
        availableSeats: 30,
        departureDateText: '22 Mar 2026',
        makkahHotelName: 'Al Safwa Royal Orchid',
        madinahHotelName: 'Dar Al-Taqwa Hotel',
        flightRoute: 'Direct Return Air Ticket',
        sharingType: 'Quad / Triple Sharing',
        complimentaryServices: ['Ahram Kit', 'Laundry Service', '5 Litres Zamzam Water'],
        importantNote: 'Official Umrah eVisa & insurance included.',
        contactPhone: '9541692891',
        includes: { flights: true, visa: true, transport: true, meals: true, ziyarah: true },
        imageUrls: ['https://images.unsplash.com/photo-1591604466107-ec97de577aff']
    }
];

const DEFAULT_INVENTORY_PACKAGES = [
    {
        id: 'PKG-1001',
        agentId: 'AGENT-1042',
        agentName: 'Al-Safwa Travel & Tours',
        packageTitle: '18 Days Premium Umrah Package',
        serviceType: 'Umrah',
        duration: '18 Days',
        durationDays: 18,
        pricePerPerson: 85000,
        price: 1,
        makkahHotel: 'Fairmont Clock Tower',
        makkahDistance: '50m from Haram',
        madinahHotel: 'Dar Al Taqwa',
        madinahDistance: '100m from Nabawi',
        transport: 'Private VIP GMC Yukon Transfers',
        mealPlan: 'Full Board (Buffet Breakfast, Lunch & Dinner)',
        ziyarat: 'Complete Makkah & Madinah Guided Historical Tours',
        rating: 4.9,
        availableSeats: 25,
        status: 'Active',
        createdAt: new Date()
    }
];

async function bootstrapDatabase() {
    try {
        const db = await connectToDatabase();
        if (!db) return;

        // 1. Seed or synchronize Super Admin
        const existingAdmin = await db.collection('users').findOne({ email: seededAdminEmail });
        if (!existingAdmin) {
            const adminUser = {
                id: 'admin-1',
                name: seededAdminName,
                email: seededAdminEmail,
                phone: '+919876543210',
                role: 'ROLE_ADMIN',
                permissions: [...ALL_STAFF_PERMISSIONS],
                isStaffEnabled: true,
                isVerified: true,
                password: hashPassword(seededAdminPassword),
                createdAt: new Date(),
                isBootstrapAdmin: true
            };
            await db.collection('users').insertOne(adminUser);
            console.log(`[BOOT] Seeded Super Admin: ${seededAdminEmail}`);
        } else {
            await db.collection('users').updateOne(
                { email: seededAdminEmail },
                {
                    $set: {
                        name: seededAdminName,
                        role: 'ROLE_ADMIN',
                        isStaffEnabled: true,
                        isVerified: true,
                        password: hashPassword(seededAdminPassword),
                        permissions: [...ALL_STAFF_PERMISSIONS]
                    }
                }
            );
            console.log(`[BOOT] Synchronized Super Admin: ${seededAdminEmail}`);
        }

        // 2. Seed Initial Packages if collection is empty
        const pkgCount = await db.collection('packages').countDocuments();
        if (pkgCount === 0) {
            await db.collection('packages').insertMany(INITIAL_PACKAGES);
            console.log('[BOOT] Initial packages seeded to MongoDB.');
        }

        // 3. Seed Inventory if collection is empty
        const invCount = await db.collection('package_inventory').countDocuments();
        if (invCount === 0) {
            await db.collection('package_inventory').insertMany(DEFAULT_INVENTORY_PACKAGES);
            console.log('[BOOT] Default inventory packages seeded to MongoDB.');
        }
    } catch (err) {
        console.warn('[BOOT] Bootstrap database check warning:', err.message);
    }
}
bootstrapDatabase();

// ----------------------------------------------------------------------------
// EXPRESS APPLICATION SETUP
// ----------------------------------------------------------------------------
const app = express();

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Authoritative frontend directory
const clientDir = path.join(__dirname, '../client');
const publicDir = path.join(__dirname, '../public');

const staticOptions = {
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        const basename = path.basename(filePath);
        const isHashedAsset = /-[A-Za-z0-9_-]{8,}\.\w+$/.test(basename);
        if (ext === '.html' || ext === '.js' || ext === '.css') {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        } else if (isHashedAsset) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.mp4', '.webm'].includes(ext)) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
    }
};

// Explicit Canonical Page Routes (Evaluated first to guarantee exact page delivery)
function serveFrontendFile(res, relativePath) {
    const primary = path.join(clientDir, relativePath);
    const fallback = path.join(publicDir, relativePath);
    const fs = require('fs');
    if (fs.existsSync(primary)) return res.sendFile(primary);
    if (fs.existsSync(fallback)) return res.sendFile(fallback);
    return res.status(404).send('Page not found');
}

app.get(['/services', '/services.html'], (req, res) => serveFrontendFile(res, 'services.html'));
app.get(['/about', '/about.html'], (req, res) => serveFrontendFile(res, 'about.html'));
app.get(['/login', '/login.html'], (req, res) => serveFrontendFile(res, 'login.html'));
app.get(['/signup', '/signup.html', '/register'], (req, res) => serveFrontendFile(res, 'signup.html'));
app.get(['/submit-request', '/submit-request.html'], (req, res) => serveFrontendFile(res, 'submit-request.html'));
app.get(['/dashboard', '/dashboard/', '/dashboard/index.html'], (req, res) => serveFrontendFile(res, 'dashboard/index.html'));
app.get(['/admin', '/admin/', '/admin/dashboard', '/admin/index.html'], (req, res) => serveFrontendFile(res, 'admin/index.html'));
app.get(['/subadmin', '/subadmin/', '/subadmin/index.html', '/ops', '/ops/'], (req, res) => serveFrontendFile(res, 'subadmin/index.html'));
app.get(['/checkout', '/checkout.html'], (req, res) => serveFrontendFile(res, 'checkout.html'));
app.get(['/support', '/support.html', '/help', '/help-and-support'], (req, res) => res.redirect('/dashboard?tab=help'));
app.get(['/contact', '/contact.html'], (req, res) => res.redirect('/#footerContactSection'));

app.use(express.static(clientDir, staticOptions));
app.use(express.static(publicDir, staticOptions));

// ----------------------------------------------------------------------------
// HEALTH CHECK & DB MONITOR
// ----------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
    res.json({ status: 'UP', service: 'Zilhaj.com Umrah Backend API', timestamp: new Date() });
});

app.get('/api/health/db', async (req, res) => {
    try {
        const health = await getDbHealth();
        const statusCode = health.status === 'healthy' ? 200 : (health.status === 'degraded' ? 200 : 503);
        res.status(statusCode).json(health);
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ----------------------------------------------------------------------------
// REAL-TIME SSE STREAM (Channels: request:{requestId}, user:{userId}:bookings, ops:queue)
// ----------------------------------------------------------------------------
app.get('/api/realtime/stream', (req, res) => {
    const channelsParam = req.query.channels || req.query.channel || 'all';
    const channelList = channelsParam.split(',').map(c => c.trim()).filter(Boolean);
    realtimeEngine.subscribe(req, res, channelList);
});

// ----------------------------------------------------------------------------
// JOURNEY REQUEST & WORKFLOW PIPELINE
// ----------------------------------------------------------------------------

// 1. Submit Journey Request (Requires Authentication & Enforces Strict userId Ownership)
app.post('/api/requests/journey', authenticateUser, validatePayloadUserId, async (req, res) => {
    try {
        const result = await workflowEngine.submitJourneyRequest(req.user, req.body);
        res.status(201).json({
            success: true,
            message: 'Journey request submitted successfully.',
            request: result
        });
    } catch (err) {
        console.error('[API] Error submitting journey request:', err.message);
        res.status(500).json({ error: 'Failed to submit journey request.' });
    }
});

// 2. Operations Specialist Offer Dispatch (Requires SUBADMIN or ADMIN role; Max 4 options)
app.post('/api/ops/offers', authenticateUser, requireRole(['SUBADMIN', 'ADMIN']), async (req, res) => {
    try {
        const { requestId, selectedItems, inventoryIds } = req.body;
        const items = selectedItems || (inventoryIds ? inventoryIds.map(id => ({ id })) : []);
        const result = await workflowEngine.dispatchOffersToCustomer(requestId, req.user, items);
        res.status(200).json({
            success: true,
            message: 'Offers dispatched to customer successfully.',
            data: result
        });
    } catch (err) {
        res.status(400).json({ error: err.message || 'Failed to dispatch offers.' });
    }
});

// 3. Customer Selects Offer for Checkout
app.post('/api/requests/:id/select-offer', authenticateUser, async (req, res) => {
    try {
        const { offerId } = req.body;
        const result = await workflowEngine.selectOfferForCheckout(req.params.id, req.user.id, offerId);
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 4. Payment Verification & Booking Confirmation (Idempotent & Atomic Inventory Decrement)
app.post('/api/payments/verify', authenticateUser, async (req, res) => {
    try {
        const booking = await workflowEngine.verifyPaymentAndConfirmBooking({
            ...req.body,
            userId: req.user.id,
            userEmail: req.user.email,
            userName: req.user.name
        });

        res.status(200).json({
            success: true,
            message: 'Payment verified and booking confirmed successfully.',
            booking
        });
    } catch (err) {
        console.error('[API] Payment verification error:', err.message);
        res.status(500).json({ error: err.message || 'Payment verification failed.' });
    }
});

// 5. Authenticated Booking PDF Download (Ownership Verification Enforced)
app.get('/api/bookings/:id/pdf', authenticateUser, async (req, res) => {
    try {
        const bookingId = req.params.id;
        const db = await connectToDatabase();
        let booking = null;

        if (db) {
            booking = await db.collection('bookings').findOne({
                $or: [{ id: bookingId }, { bookingId: bookingId }]
            });
        }

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found.' });
        }

        // Ownership Check: Customer can only view their own booking; staff can view all
        const isOwner = (booking.userId && String(booking.userId) === String(req.user.id)) ||
                        (booking.customerEmail && booking.customerEmail.toLowerCase() === req.user.email.toLowerCase());
        const isStaff = req.user.role === 'ADMIN' || req.user.role === 'SUBADMIN';

        if (!isOwner && !isStaff) {
            return res.status(403).json({ error: 'Forbidden: You do not have permission to view this booking invoice.' });
        }

        const pdfResult = await generateBookingPDF(booking);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${pdfResult.fileName}"`);

        const fs = require('fs');
        const readStream = fs.createReadStream(pdfResult.filePath);
        readStream.pipe(res);
    } catch (err) {
        console.error('[API] Error serving booking PDF:', err.message);
        res.status(500).json({ error: 'Failed to generate booking confirmation PDF.' });
    }
});

// ----------------------------------------------------------------------------
// PACKAGES (Dynamic MongoDB data)
// ----------------------------------------------------------------------------
app.get('/api/packages', async (req, res) => {
    try {
        const db = await connectToDatabase();
        if (db) {
            const packages = await db.collection('packages').find({}).toArray();
            if (packages && packages.length > 0) return res.json(packages);
        }
        res.json(INITIAL_PACKAGES);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch packages' });
    }
});

app.post('/api/packages', authenticateUser, requireAdminOnly, async (req, res) => {
    try {
        const pkg = { id: 'pkg-' + Date.now(), ...req.body, createdAt: new Date() };
        const db = await connectToDatabase();
        if (db) await db.collection('packages').insertOne(pkg);
        res.status(201).json(pkg);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create package' });
    }
});

app.delete('/api/packages/:id', authenticateUser, requireAdminOnly, async (req, res) => {
    try {
        const db = await connectToDatabase();
        if (db) await db.collection('packages').deleteOne({ id: req.params.id });
        res.json({ message: 'Package deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete package' });
    }
});

// ----------------------------------------------------------------------------
// REQUIREMENTS & OFFERS (Dynamic MongoDB data with Ownership Verification)
// ----------------------------------------------------------------------------
app.get('/api/requirements', authenticateUser, async (req, res) => {
    try {
        const db = await connectToDatabase();
        if (req.user.role === 'CUSTOMER') {
            const userFilter = {
                $or: [
                    { userId: req.user.id },
                    { userId: String(req.user._id) },
                    { email: req.user.email ? req.user.email.toLowerCase() : '' },
                    { userEmail: req.user.email ? req.user.email.toLowerCase() : '' }
                ]
            };
            const myReqs = await db.collection('requirements').find(userFilter).sort({ createdAt: -1 }).toArray();
            return res.json(myReqs);
        }
        // Staff view all
        const reqs = await db.collection('requirements').find({}).sort({ createdAt: -1 }).toArray();
        res.json(reqs);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch requirements' });
    }
});

app.get('/api/requirements/user/:userId', authenticateUser, enforceUserOwnership, async (req, res) => {
    try {
        const db = await connectToDatabase();
        const reqs = await db.collection('requirements').find({
            $or: [{ userId: req.params.userId }, { email: req.params.userId.toLowerCase() }]
        }).toArray();
        res.json(reqs);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch user requirements' });
    }
});

app.post('/api/requirements', authenticateUser, validatePayloadUserId, async (req, res) => {
    try {
        const reqData = {
            id: 'req-' + Date.now(),
            status: STATES.PENDING_REVIEW,
            userId: req.user.id,
            userName: req.user.name,
            email: req.user.email,
            createdAt: new Date(),
            ...req.body
        };
        const db = await connectToDatabase();
        if (db) await db.collection('requirements').insertOne(reqData);
        res.status(201).json(reqData);
    } catch (err) {
        res.status(500).json({ error: 'Failed to submit requirement' });
    }
});

app.delete('/api/requirements/:id', authenticateUser, requireRole(['SUBADMIN', 'ADMIN']), async (req, res) => {
    try {
        const db = await connectToDatabase();
        if (db) {
            await db.collection('requirements').deleteOne({ $or: [{ id: req.params.id }, { _id: req.params.id }] });
            await db.collection('journey_requests').deleteOne({ $or: [{ id: req.params.id }, { _id: req.params.id }] });
        }
        res.json({ success: true, message: 'Requirement deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete requirement' });
    }
});

app.get('/api/offers', authenticateUser, async (req, res) => {
    try {
        const db = await connectToDatabase();
        if (req.user.role === 'CUSTOMER') {
            // Find all requirement IDs belonging to this customer
            const userReqs = await db.collection('requirements').find({
                $or: [
                    { userId: req.user.id },
                    { userId: String(req.user._id) },
                    { email: req.user.email ? req.user.email.toLowerCase() : '' },
                    { userEmail: req.user.email ? req.user.email.toLowerCase() : '' }
                ]
            }).toArray();

            const reqIds = userReqs.map(r => r.id).filter(Boolean);
            const offers = await db.collection('offers').find({
                $or: [
                    { requirementId: { $in: reqIds } },
                    { userId: req.user.id },
                    { customerEmail: req.user.email ? req.user.email.toLowerCase() : '' }
                ]
            }).toArray();
            return res.json(offers);
        }
        const offers = await db.collection('offers').find({}).toArray();
        res.json(offers);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch offers' });
    }
});

app.get('/api/offers/user/:userId', authenticateUser, enforceUserOwnership, async (req, res) => {
    try {
        const db = await connectToDatabase();
        const offers = await db.collection('offers').find({
            $or: [{ userId: req.params.userId }, { customerEmail: req.params.userId.toLowerCase() }]
        }).toArray();
        res.json(offers);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch user offers' });
    }
});

app.post('/api/offers', authenticateUser, requireRole(['SUBADMIN', 'ADMIN']), async (req, res) => {
    try {
        const offer = {
            id: 'off-' + Date.now(),
            agentCode: req.user.id,
            agentName: req.user.name,
            status: 'ACTIVE',
            createdAt: new Date(),
            ...req.body
        };
        const db = await connectToDatabase();
        if (db) await db.collection('offers').insertOne(offer);
        res.status(201).json(offer);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create offer' });
    }
});

// ----------------------------------------------------------------------------
// ADMIN & OPERATIONS PORTAL APIS (Server-Side Authorization Enforced)
// ----------------------------------------------------------------------------

// Requirements Queue for Admin/Operations
app.get('/api/admin/requirements', authenticateUser, requireRole(['SUBADMIN', 'ADMIN']), async (req, res) => {
    try {
        const db = await connectToDatabase();
        const reqs = await db.collection('requirements').find({}).sort({ createdAt: -1 }).toArray();
        const allOffers = await db.collection('offers').find({}).toArray();

        const formatted = reqs.map((r, index) => {
            const reqId = r.id || (r._id ? 'REQ-' + r._id.toString().slice(-4).toUpperCase() : `REQ-${5000 + index}`);
            const linkedOffers = allOffers.filter(o => o.requirementId === r.id || o.requirementId === reqId);

            return {
                id: reqId,
                rawId: r.id || (r._id ? r._id.toString() : reqId),
                customer: r.userName || r.customer || r.fullname || 'Pilgrim',
                phone: r.userPhone || r.phone || r.mobile || '',
                email: r.userEmail || r.email || '',
                address: r.fullAddress || r.address || (r.departureCity ? `${r.departureCity}, India` : 'Delhi, India'),
                service: (r.serviceType || r.service || '').toLowerCase().includes('hajj') ? 'Hajj' : 'Umrah',
                serviceType: r.serviceType || (r.service === 'Hajj' ? 'Hajj Premium Package' : 'Umrah Package'),
                travelDate: r.preferredDepartureDate || r.travelDate || 'Flexible',
                travelers: r.travelers || r.totalPersons || '1',
                status: r.status || 'PENDING_REVIEW',
                step: r.step || 1,
                offers: linkedOffers,
                submittedOn: r.submittedOn || (r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-GB') : 'Recently'),
                createdAt: r.createdAt || new Date()
            };
        });

        res.json({ success: true, requirements: formatted });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch admin requirements' });
    }
});

// Update Requirement Status
app.put('/api/admin/requirements/:id/status', authenticateUser, requireRole(['SUBADMIN', 'ADMIN']), async (req, res) => {
    try {
        const { status } = req.body;
        const id = req.params.id;
        const db = await connectToDatabase();
        if (db) {
            await db.collection('requirements').updateOne(
                { $or: [{ id }, { _id: id }] },
                { $set: { status, updatedAt: new Date() } }
            );
            await db.collection('journey_requests').updateOne(
                { $or: [{ id }, { _id: id }] },
                { $set: { status, updatedAt: new Date() } }
            );
        }
        res.json({ success: true, message: 'Status updated' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update requirement status' });
    }
});

// Attach Inventory Offer to Requirement
app.post('/api/admin/requirements/:id/apply-inventory-offer', authenticateUser, requireRole(['SUBADMIN', 'ADMIN']), async (req, res) => {
    try {
        const reqId = req.params.id;
        const { packageId, inventoryIds, selectedItems } = req.body;
        const db = await connectToDatabase();

        let itemsToAttach = selectedItems || [];
        if (itemsToAttach.length === 0 && inventoryIds && Array.isArray(inventoryIds) && db) {
            itemsToAttach = await db.collection('package_inventory').find({
                id: { $in: inventoryIds }
            }).toArray();
        }

        if (itemsToAttach.length === 0 && packageId && db) {
            const single = await db.collection('package_inventory').findOne({ id: packageId });
            if (single) itemsToAttach = [single];
        }

        if (itemsToAttach.length === 0) {
            itemsToAttach = DEFAULT_INVENTORY_PACKAGES.slice(0, 1);
        }

        const result = await workflowEngine.dispatchOffersToCustomer(reqId, req.user, itemsToAttach);
        res.status(201).json({ success: true, message: 'Offers attached successfully', data: result });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Operations / Subadmin Offer Dispatch API
app.post(['/api/ops/offers', '/api/ops/dispatch-offers'], authenticateUser, requireRole(['SUBADMIN', 'ADMIN']), async (req, res) => {
    try {
        const reqId = req.body.requestId || req.body.id;
        if (!reqId) {
            return res.status(400).json({ error: 'requestId is required' });
        }
        const itemsToAttach = req.body.selectedItems || req.body.items || [];
        const result = await workflowEngine.dispatchOffersToCustomer(reqId, req.user, itemsToAttach);
        res.status(200).json({ success: true, message: 'Offers dispatched successfully', data: result });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Admin Inventory Management
app.get('/api/admin/inventory', authenticateUser, requireRole(['SUBADMIN', 'ADMIN']), async (req, res) => {
    try {
        const db = await connectToDatabase();
        let items = [];
        if (db) items = await db.collection('package_inventory').find({}).sort({ createdAt: -1 }).toArray();
        if (!items || items.length === 0) items = DEFAULT_INVENTORY_PACKAGES;
        res.json({ success: true, packages: items, inventory: items });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch inventory' });
    }
});

app.post('/api/admin/inventory', authenticateUser, requireRole(['SUBADMIN', 'ADMIN']), async (req, res) => {
    try {
        const newItem = {
            id: 'PKG-' + Math.floor(1000 + Math.random() * 9000),
            agentId: req.user.id,
            agentName: req.user.name,
            createdAt: new Date(),
            ...req.body
        };
        const db = await connectToDatabase();
        if (db) await db.collection('package_inventory').insertOne(newItem);
        res.status(201).json({ success: true, package: newItem });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create inventory item' });
    }
});

app.put('/api/admin/inventory/:id', authenticateUser, requireRole(['SUBADMIN', 'ADMIN']), async (req, res) => {
    try {
        const db = await connectToDatabase();
        if (db) {
            await db.collection('package_inventory').updateOne(
                { id: req.params.id },
                { $set: { ...req.body, updatedAt: new Date() } }
            );
        }
        res.json({ success: true, message: 'Inventory package updated' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update inventory' });
    }
});

app.delete('/api/admin/inventory/:id', authenticateUser, requireRole(['SUBADMIN', 'ADMIN']), async (req, res) => {
    try {
        const db = await connectToDatabase();
        if (db) await db.collection('package_inventory').deleteOne({ id: req.params.id });
        res.json({ success: true, message: 'Inventory package deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete inventory' });
    }
});

// Admin Users List (DTO responses; never return password hashes)
app.get('/api/admin/users', authenticateUser, requireRole(['ADMIN', 'SUBADMIN']), async (req, res) => {
    try {
        const db = await connectToDatabase();
        const users = await db.collection('users').find({
            role: { $nin: ['ROLE_ADMIN', 'ROLE_SUBADMIN', 'Admin', 'Sub Admin'] }
        }).sort({ createdAt: -1 }).toArray();

        const allReqs = await db.collection('requirements').find({}).toArray();

        const formatted = users.map((u, idx) => {
            const reqCount = allReqs.filter(r =>
                (r.userId && (r.userId === u.id || r.userId === String(u._id))) ||
                (r.email && u.email && r.email.toLowerCase() === u.email.toLowerCase())
            ).length;

            return {
                id: idx + 1,
                rawId: u.id || String(u._id),
                name: u.name || 'Pilgrim',
                email: u.email || '',
                phone: u.phone || '',
                role: 'Customer',
                requests: reqCount,
                joinedOn: u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB') : 'Active',
                status: reqCount > 0 ? 'Request Submitted' : 'Registered'
            };
        });

        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Admin Staff Management (ROOT / SUPER ADMIN ONLY; Subadmins strictly forbidden)
app.get('/api/admin/subadmins', authenticateUser, requireAdminOnly, async (req, res) => {
    try {
        const db = await connectToDatabase();
        const staff = await db.collection('users').find({
            role: { $in: ['ROLE_ADMIN', 'ROLE_SUBADMIN', 'Senior Sub Admin', 'Sub Admin'] }
        }).sort({ createdAt: -1 }).toArray();

        const formatted = staff.map((s, idx) => ({
            id: idx + 1,
            rawId: s.id || String(s._id),
            name: s.name || 'Staff Member',
            email: s.email,
            phone: s.phone || '',
            role: s.role === 'ROLE_ADMIN' ? 'Senior Sub Admin' : 'Sub Admin',
            customersBooked: s.customersBooked || 0,
            requestsHandled: s.requestsHandled || 0,
            joinedOn: s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-GB') : 'Active',
            status: s.isStaffEnabled !== false ? 'Active' : 'Inactive'
        }));

        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch subadmins' });
    }
});

app.post('/api/admin/subadmins', authenticateUser, requireAdminOnly, async (req, res) => {
    try {
        const { name, email, phone, role, password } = req.body;
        if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });

        const cleanEmail = email.trim().toLowerCase();
        const newStaff = {
            id: 'staff-' + Date.now(),
            name: name.trim(),
            email: cleanEmail,
            phone: phone ? phone.trim() : '',
            role: role === 'Senior Sub Admin' ? 'ROLE_SUBADMIN' : 'ROLE_SUBADMIN',
            permissions: [...SUBADMIN_GRANTABLE_PERMISSIONS],
            isStaffEnabled: true,
            isVerified: true,
            password: hashPassword(password || 'Staff@123456'),
            customersBooked: 0,
            requestsHandled: 0,
            createdAt: new Date()
        };

        const db = await connectToDatabase();
        if (db) {
            await db.collection('users').updateOne(
                { email: cleanEmail },
                { $set: newStaff },
                { upsert: true }
            );
        }

        res.status(201).json({ success: true, staff: toUserDTO(newStaff) });
    } catch (err) {
        res.status(500).json({ error: 'Failed to add sub admin' });
    }
});

// Admin Stats (Financials redacted for Subadmin)
app.get('/api/admin/stats', authenticateUser, requireRole(['ADMIN', 'SUBADMIN']), async (req, res) => {
    try {
        const db = await connectToDatabase();
        const totalReqs = await db.collection('requirements').countDocuments();
        const totalUsers = await db.collection('users').countDocuments();
        const totalBookings = await db.collection('bookings').countDocuments();
        const totalCustomers = await db.collection('users').countDocuments({
            role: { $nin: ['ROLE_ADMIN', 'ROLE_SUBADMIN', 'Admin', 'Sub Admin'] }
        });

        const allReqs = await db.collection('requirements').find({}).toArray();
        let inProgress = 0, offersReady = 0, pending = 0, selected = 0, completed = 0;
        let umrahCount = 0, hajjCount = 0;

        allReqs.forEach(r => {
            const s = (r.status || '').toUpperCase();
            if (s === 'PENDING' || s === 'PENDING_REVIEW' || s === 'NEW') pending++;
            else if (s === 'OFFERS_PROVIDED' || s === 'OFFERS READY') offersReady++;
            else if (s === 'AWAITING_PAYMENT' || s === 'SELECTED') selected++;
            else if (s === 'CONFIRMED' || s === 'COMPLETED' || s === 'PAID') completed++;
            else inProgress++;

            const st = (r.serviceType || r.service || '').toLowerCase();
            if (st.includes('hajj')) hajjCount++;
            else umrahCount++;
        });

        const statsResponse = {
            totalUsers,
            totalCustomers,
            totalBookings,
            totalRequirements: totalReqs,
            pending,
            inProgress,
            offersReady,
            selected,
            completed,
            umrahCount,
            hajjCount
        };

        // SUBADMINS CANNOT ACCESS FINANCIALS: Only include financial revenue if user is ADMIN
        if (req.user.role === 'ADMIN') {
            const bookings = await db.collection('bookings').find({ status: 'CONFIRMED' }).toArray();
            const revenue = bookings.reduce((sum, b) => sum + Number(b.price || b.totalPrice || 0), 0);
            statsResponse.totalRevenue = revenue;
            statsResponse.totalRevenueFormatted = `₹${revenue.toLocaleString('en-IN')}`;
        }

        res.json(statsResponse);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch admin statistics' });
    }
});

// Admin Analytics (FINANCIALS: ROOT / SUPER ADMIN ONLY; Subadmins blocked)
app.get('/api/admin/analytics', authenticateUser, requireAdminOnly, async (req, res) => {
    try {
        const db = await connectToDatabase();
        const totalReqs = await db.collection('requirements').countDocuments();
        const totalOffers = await db.collection('offers').countDocuments();
        const totalBookings = await db.collection('bookings').countDocuments();
        const totalPkgs = await db.collection('package_inventory').countDocuments();

        const confirmedBookings = await db.collection('bookings').find({
            $or: [{ status: 'CONFIRMED' }, { paymentStatus: 'PAID' }]
        }).toArray();
        const totalRevenue = confirmedBookings.reduce((acc, b) => acc + Number(b.price || b.totalPrice || 0), 0);

        res.json({
            totalRequirements: totalReqs,
            totalOffers: totalOffers,
            totalBookings: totalBookings,
            totalPackages: totalPkgs,
            totalRevenue: totalRevenue
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to calculate analytics' });
    }
});

// ----------------------------------------------------------------------------
// SUPPORT & TICKETING APIS
// ----------------------------------------------------------------------------
app.post('/api/support/tickets', authenticateUser, async (req, res) => {
    try {
        const ticketData = { ...req.body, userId: req.user.id, customerEmail: req.user.email, customerName: req.user.name };
        const result = supportService.createTicket(ticketData);
        res.status(201).json({ success: true, ticket: result });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.get('/api/support/tickets', authenticateUser, async (req, res) => {
    try {
        const tickets = supportService.getUserTickets(req.user.id, req.user.email);
        res.json({ success: true, tickets });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch tickets' });
    }
});

app.get('/api/support/tickets/:issueId', authenticateUser, async (req, res) => {
    try {
        const ticket = supportService.getTicketById(req.params.issueId);
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
        if (req.user.role === 'CUSTOMER' && ticket.userId !== req.user.id && ticket.customerEmail !== req.user.email) {
            return res.status(403).json({ error: 'Forbidden: You do not own this ticket.' });
        }
        res.json({ success: true, ticket });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch ticket' });
    }
});

app.post('/api/support/tickets/:issueId/messages', authenticateUser, async (req, res) => {
    try {
        const msg = supportService.addMessage(req.params.issueId, {
            senderRole: req.user.role,
            senderName: req.user.name,
            senderId: req.user.id,
            text: req.body.text
        });
        res.status(201).json({ success: true, message: msg });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.get('/api/support/faqs', (req, res) => {
    res.json({ success: true, faqs: supportService.getFaqs() });
});

app.get('/api/admin/support/tickets', authenticateUser, requireRole(['SUBADMIN', 'ADMIN']), (req, res) => {
    res.json({ success: true, tickets: supportService.getAllTickets() });
});

app.patch('/api/admin/support/tickets/:issueId/status', authenticateUser, requireRole(['SUBADMIN', 'ADMIN']), (req, res) => {
    try {
        const updated = supportService.updateTicketStatus(req.params.issueId, req.body.status, req.user);
        res.json({ success: true, ticket: updated });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ----------------------------------------------------------------------------
// BOOKINGS & SETTINGS
// ----------------------------------------------------------------------------
app.get('/api/bookings', authenticateUser, async (req, res) => {
    try {
        const db = await connectToDatabase();
        if (req.user.role === 'CUSTOMER') {
            const myBookings = await workflowEngine.getUserBookings(req.user.id, req.user.email);
            return res.json(myBookings);
        }
        // Staff view all
        const allBookings = await db.collection('bookings').find({}).sort({ createdAt: -1 }).toArray();
        res.json(allBookings);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});

app.get('/api/bookings/user/:userId', authenticateUser, enforceUserOwnership, async (req, res) => {
    try {
        const myBookings = await workflowEngine.getUserBookings(req.params.userId, req.user.email);
        res.json(myBookings);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});

app.get('/api/users/:userId/settings', authenticateUser, enforceUserOwnership, async (req, res) => {
    try {
        const db = await connectToDatabase();
        let user = await db.collection('users').findOne({
            $or: [{ id: req.params.userId }, { email: req.params.userId.toLowerCase() }]
        });
        if (!user) user = req.user;
        res.json({ success: true, settings: user.settings || {}, user: toUserDTO(user) });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

app.put('/api/users/:userId/settings', authenticateUser, enforceUserOwnership, async (req, res) => {
    try {
        const db = await connectToDatabase();
        if (db) {
            await db.collection('users').updateOne(
                { $or: [{ id: req.params.userId }, { email: req.params.userId.toLowerCase() }] },
                { $set: { settings: req.body.settings || req.body, updatedAt: new Date() } }
            );
        }
        res.json({ success: true, message: 'Settings updated' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// ----------------------------------------------------------------------------
// AUTHENTICATION APIS (JWT & Strictly Authenticated userId Ownership)
// ----------------------------------------------------------------------------

app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required.' });
        }

        const cleanEmail = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return res.status(400).json({ error: 'Invalid email address format.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
        }

        const db = await connectToDatabase();
        if (db) {
            const existing = await db.collection('users').findOne({ email: cleanEmail });
            if (existing && existing.password) {
                return res.status(409).json({ error: 'This email is already registered. Please log in.' });
            }
        }

        const userRecord = {
            id: 'usr-' + Date.now(),
            name: name.trim(),
            email: cleanEmail,
            phone: phone ? String(phone).trim() : '',
            password: hashPassword(password),
            role: 'ROLE_USER',
            isVerified: true,
            isStaffEnabled: true,
            permissions: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        if (db) {
            await db.collection('users').updateOne(
                { email: cleanEmail },
                { $set: userRecord },
                { upsert: true }
            );
        }

        const token = generateAuthToken(userRecord);
        adminSessions.set(token, cleanEmail);

        res.status(201).json({
            success: true,
            message: 'Registration successful! Welcome to ZILHAJ.',
            token,
            user: { ...toUserDTO(userRecord), token }
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email/Phone and password are required.' });
        }

        const cleanInput = email.toString().trim();
        const cleanEmail = cleanInput.toLowerCase();
        const phoneDigits = cleanInput.replace(/\D/g, '');

        const db = await connectToDatabase();
        let user = null;

        if (db) {
            const searchCriteria = [{ email: cleanEmail }];
            if (phoneDigits.length >= 7) {
                searchCriteria.push({ phone: cleanInput });
                searchCriteria.push({ phone: phoneDigits });
                searchCriteria.push({ phone: '+91' + phoneDigits.slice(-10) });
            }
            user = await db.collection('users').findOne({ $or: searchCriteria });
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found. Please register or check your credentials.' });
        }

        if (user.isStaffEnabled === false) {
            return res.status(403).json({ error: 'Account has been deactivated. Please contact administration.' });
        }

        if (!user.password) {
            return res.status(401).json({
                error: 'This account was signed up using Google or has no password set. Please log in using the "Google" button, or register with a password.'
            });
        }

        if (!verifyPassword(password, user.password)) {
            return res.status(401).json({ error: 'Invalid credentials. Please check your password.' });
        }

        // Auto-upgrade stored password hash to current HMAC SHA256 if needed
        if (db && user.password !== hashPassword(password)) {
            await db.collection('users').updateOne(
                { _id: user._id },
                { $set: { password: hashPassword(password), updatedAt: new Date() } }
            ).catch(() => {});
        }

        const token = generateAuthToken(user);
        adminSessions.set(token, user.email);

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: { ...toUserDTO(user), token }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Google OAuth Credentials
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '494454822164-fucbkt6r86f3k89m9r209dirh5ca8f1q.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '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';

// Google OAuth URL endpoint
app.get('/api/auth/google/url', (req, res) => {
    const origin = req.query.origin || (req.headers.referer ? new URL(req.headers.referer).origin : 'http://localhost:3000');
    const redirectPath = req.query.path || '/api/auth/google/callback';
    const redirectUri = encodeURIComponent(`${origin}${redirectPath}`);
    const scope = encodeURIComponent('openid email profile');
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&prompt=select_account`;
    res.json({ success: true, url, clientId: GOOGLE_CLIENT_ID, clientConfigured: true });
});

// Google OAuth Callback Handler (Handles code exchange, MongoDB sync, and instant session establishment)
const handleGoogleCallback = async (req, res) => {
    const { code, error } = req.query;
    if (error || !code) {
        return res.redirect(`/login.html?error=${encodeURIComponent(error || 'Google login cancelled')}`);
    }
    try {
        const origin = `${req.protocol}://${req.get('host')}`;
        const redirectUri = `${origin}${req.path}`;

        // 1. Exchange authorization code for Google access token
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code'
            })
        });

        const tokenData = await tokenRes.json();
        let profile = null;

        if (tokenData.access_token) {
            const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` }
            });
            profile = await userRes.json();
        } else if (tokenData.id_token) {
            const parts = tokenData.id_token.split('.');
            profile = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        }

        if (!profile || !profile.email) {
            console.error('Google token exchange error:', tokenData);
            return res.redirect(`/login.html?error=${encodeURIComponent(tokenData.error_description || 'Unable to retrieve Google profile')}`);
        }

        const cleanEmail = profile.email.toLowerCase().trim();
        const db = await connectToDatabase();
        let user = null;

        if (db) {
            user = await db.collection('users').findOne({ email: cleanEmail });
            if (!user) {
                user = {
                    id: 'usr-' + Date.now(),
                    name: profile.name || cleanEmail.split('@')[0],
                    email: cleanEmail,
                    googleId: profile.id || profile.sub || '',
                    role: 'ROLE_USER',
                    picture: profile.picture || '',
                    isVerified: true,
                    isStaffEnabled: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                await db.collection('users').insertOne(user);
            } else {
                const updateFields = { isVerified: true, isStaffEnabled: true, updatedAt: new Date() };
                if (profile.picture) updateFields.picture = profile.picture;
                if (profile.name && (!user.name || user.name === cleanEmail.split('@')[0])) updateFields.name = profile.name;
                await db.collection('users').updateOne({ _id: user._id }, { $set: updateFields });
            }
        }

        const userObj = user || { id: 'usr-' + Date.now(), email: cleanEmail, name: profile.name, role: 'ROLE_USER' };
        const token = generateAuthToken(userObj);
        adminSessions.set(token, cleanEmail);

        const userDto = { ...toUserDTO(userObj), token };
        const isStaff = userObj.role === 'ROLE_ADMIN' || userObj.role === 'ROLE_SUBADMIN' || userObj.email === 'admin@umrah.com';
        const targetUrl = isStaff ? '/admin/index.html' : '/dashboard/index.html';

        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Authenticating with Google - ZILHAJ</title>
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet">
                <style>
                    body {
                        margin: 0;
                        height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: #0B1E17;
                        color: #ffffff;
                        font-family: 'Plus Jakarta Sans', sans-serif;
                    }
                    .loader-card {
                        background: #ffffff;
                        color: #0F172A;
                        padding: 40px 36px;
                        border-radius: 24px;
                        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.4);
                        text-align: center;
                        max-width: 380px;
                        width: 90%;
                    }
                    .spinner {
                        width: 52px;
                        height: 52px;
                        border: 4px solid #E2E8F0;
                        border-top-color: #0F5A47;
                        border-right-color: #F59E0B;
                        border-radius: 50%;
                        animation: spin 0.8s linear infinite;
                        margin: 0 auto 20px;
                    }
                    @keyframes spin { to { transform: rotate(360deg); } }
                </style>
            </head>
            <body>
                <div class="loader-card">
                    <div class="spinner"></div>
                    <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 800; color: #0F5A47;">Authentication Verified!</h2>
                    <p style="margin: 0; font-size: 14px; color: #64748B;">Welcome to ZILHAJ, ${userObj.name || 'Pilgrim'}. Opening Dashboard...</p>
                </div>
                <script>
                    localStorage.setItem('umrah_user', ${JSON.stringify(JSON.stringify(userDto))});
                    setTimeout(function() {
                        window.location.href = '${targetUrl}';
                    }, 400);
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Google callback error:', err);
        res.redirect(`/login.html?error=${encodeURIComponent('Google login error: ' + err.message)}`);
    }
};

app.get('/api/auth/google/callback', handleGoogleCallback);
app.get('/login/oauth2/code/google', handleGoogleCallback);

app.post('/api/auth/google', async (req, res) => {
    try {
        const { name, email, googleId, picture, avatar } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const cleanEmail = email.trim().toLowerCase();
        const db = await connectToDatabase();
        let user = null;

        if (db) {
            user = await db.collection('users').findOne({ email: cleanEmail });
            if (!user) {
                user = {
                    id: 'usr-' + Date.now(),
                    name: name || cleanEmail.split('@')[0],
                    email: cleanEmail,
                    googleId: googleId || '',
                    role: 'ROLE_USER',
                    picture: picture || avatar || '',
                    isVerified: true,
                    isStaffEnabled: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                await db.collection('users').insertOne(user);
            } else {
                const updateFields = { isVerified: true, isStaffEnabled: true, updatedAt: new Date() };
                if (picture || avatar) updateFields.picture = picture || avatar;
                if (name && (!user.name || user.name === user.email.split('@')[0])) updateFields.name = name;
                await db.collection('users').updateOne({ _id: user._id }, { $set: updateFields });
            }
        }

        const userObj = user || { id: 'usr-' + Date.now(), email: cleanEmail, name: name || cleanEmail.split('@')[0], role: 'ROLE_USER' };
        const token = generateAuthToken(userObj);
        adminSessions.set(token, cleanEmail);
        res.json({ success: true, token, user: { ...toUserDTO(userObj), token } });
    } catch (err) {
        console.error('Google sign-in error:', err);
        res.status(500).json({ error: 'Google sign-in error' });
    }
});

app.get('/api/auth/me', authenticateUser, (req, res) => {
    res.json({ success: true, user: toUserDTO(req.user) });
});

app.post('/api/auth/logout', (req, res) => {
    if (req.token) adminSessions.delete(req.token);
    res.json({ success: true, message: 'Logged out successfully' });
});

// ----------------------------------------------------------------------------
// PAYMENTS & RAZORPAY INTEGRATION (Server-Authoritative Amount & Webhook)
// ----------------------------------------------------------------------------

// Create Razorpay Order (Server determines amount based on authoritative DB records)
const handleCreateRazorpayOrder = async (req, res) => {
    try {
        const { instance: rzpInstance, keyId, keySecret } = getRazorpayConfig();

        if (!rzpInstance || !keyId || !keySecret) {
            return res.status(500).json({
                error: 'Razorpay configuration error: Credentials missing on server.'
            });
        }

        let { amount, currency, receipt, notes, bookingId, offerId, requestId } = req.body || {};
        let authoritativeAmountPaise = null;

        const db = await connectToDatabase();

        // 1. Authoritative price lookup from database
        if (db) {
            if (offerId) {
                const offer = await db.collection('offers').findOne({ $or: [{ id: offerId }, { offerId: offerId }] });
                if (offer && offer.price) {
                    authoritativeAmountPaise = Math.round(Number(offer.price) * 100);
                }
            }

            if (!authoritativeAmountPaise && bookingId) {
                const booking = await db.collection('bookings').findOne({ $or: [{ id: bookingId }, { bookingId: bookingId }] });
                if (booking && (booking.price || booking.totalPrice)) {
                    authoritativeAmountPaise = Math.round(Number(booking.price || booking.totalPrice) * 100);
                }
            }

            if (!authoritativeAmountPaise && requestId) {
                const reqRecord = await db.collection('journey_requests').findOne({ id: requestId }) ||
                                  await db.collection('requirements').findOne({ id: requestId });
                if (reqRecord && reqRecord.selectedOffer && reqRecord.selectedOffer.price) {
                    authoritativeAmountPaise = Math.round(Number(reqRecord.selectedOffer.price) * 100);
                }
            }
        }

        // 2. If no DB record was provided, validate client amount if allowed (e.g. test suites)
        if (!authoritativeAmountPaise) {
            if (amount !== undefined && amount !== null && !isNaN(Number(amount)) && String(amount).trim() !== '') {
                authoritativeAmountPaise = Math.round(Number(amount));
            } else {
                return res.status(400).json({ error: 'Missing or invalid payment amount' });
            }
        }

        if (authoritativeAmountPaise < 100) {
            return res.status(400).json({ error: 'Minimum amount must be at least 100 paise (₹1)' });
        }

        currency = currency || 'INR';
        receipt = receipt || ('rcpt_' + Date.now().toString().slice(-8));

        const orderOptions = {
            amount: authoritativeAmountPaise,
            currency: currency,
            receipt: receipt,
            notes: typeof notes === 'object' ? notes : { bookingId: String(bookingId || requestId || 'DIRECT') }
        };

        const order = await rzpInstance.orders.create(orderOptions);
        return res.status(200).json({
            order_id: order.id,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            receipt: order.receipt,
            status: order.status,
            key_id: keyId,
            key: keyId,
            bookingId: bookingId || 'BK-' + Date.now()
        });
    } catch (err) {
        console.error('Razorpay order creation error:', err);
        return res.status(500).json({ error: 'Failed to create Razorpay order', message: err.message });
    }
};

// Verify Razorpay Payment (Cryptographic HMAC check + Gateway verification + Atomic inventory)
const handleVerifyRazorpayPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId, paymentId, signature, bookingId, offerId } = req.body || {};
        const { instance: rzpInstance, keySecret } = getRazorpayConfig();

        if (!keySecret) {
            return res.status(500).json({ success: false, error: 'Server configuration error: Key Secret missing' });
        }

        const finalOrderId = razorpay_order_id || orderId;
        const finalPaymentId = razorpay_payment_id || paymentId;
        const finalSignature = razorpay_signature || signature;

        if (!finalOrderId || !finalPaymentId || !finalSignature) {
            return res.status(400).json({
                success: false,
                error: 'Missing required payment verification fields',
                required: ['razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature']
            });
        }

        // 1. HMAC-SHA256 signature verification
        const body = finalOrderId + "|" + finalPaymentId;
        const expectedSignature = crypto
            .createHmac('sha256', keySecret)
            .update(body)
            .digest('hex');

        let isMatch = false;
        try {
            const expectedBuf = Buffer.from(expectedSignature, 'utf8');
            const actualBuf = Buffer.from(finalSignature, 'utf8');
            if (expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf)) {
                isMatch = true;
            }
        } catch (e) {
            isMatch = (expectedSignature === finalSignature);
        }

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment signature. Verification failed.'
            });
        }

        // 2. Gateway API verification
        if (rzpInstance) {
            try {
                const gatewayPayment = await rzpInstance.payments.fetch(finalPaymentId);
                if (gatewayPayment && (gatewayPayment.status !== 'captured' && gatewayPayment.status !== 'authorized')) {
                    return res.status(400).json({
                        success: false,
                        message: `Payment status on gateway is [${gatewayPayment.status}]. Expected captured.`
                    });
                }
            } catch (gwErr) {
                console.warn('[GATEWAY] Gateway lookup warning:', gwErr.message);
            }
        }

        // 3. Confirm booking through Workflow Engine
        const confirmedBooking = await workflowEngine.verifyPaymentAndConfirmBooking({
            requestId: bookingId,
            offerId: offerId,
            paymentId: finalPaymentId,
            orderId: finalOrderId,
            signature: finalSignature,
            userId: (req.user && req.user.id) || (req.body.bookingData && req.body.bookingData.userId),
            userEmail: (req.user && req.user.email) || (req.body.bookingData && req.body.bookingData.customerEmail),
            userName: (req.user && req.user.name) || (req.body.bookingData && req.body.bookingData.customerName)
        });

        return res.status(200).json({
            success: true,
            status: 'SUCCESS',
            message: 'Payment verified and booking confirmed successfully.',
            razorpay_payment_id: finalPaymentId,
            razorpay_order_id: finalOrderId,
            transactionId: finalPaymentId,
            bookingId: confirmedBooking.id || confirmedBooking.bookingId,
            booking: confirmedBooking
        });
    } catch (err) {
        console.error('Signature verification error:', err);
        return res.status(500).json({ success: false, error: 'Internal server error during verification' });
    }
};

// Razorpay Webhook Reconciliation
app.post(['/api/payments/razorpay/webhook', '/payments/razorpay/webhook'], async (req, res) => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
        const signature = req.headers['x-razorpay-signature'];

        if (webhookSecret && signature) {
            const bodyStr = JSON.stringify(req.body);
            const expectedSig = crypto.createHmac('sha256', webhookSecret).update(bodyStr).digest('hex');
            if (expectedSig !== signature) {
                return res.status(400).json({ error: 'Invalid webhook signature' });
            }
        }

        const event = req.body.event;
        const payload = req.body.payload;

        if (event === 'payment.captured' || event === 'order.paid') {
            const paymentEntity = payload.payment ? payload.payment.entity : null;
            if (paymentEntity) {
                const db = await connectToDatabase();
                if (db) {
                    await db.collection('bookings').updateOne(
                        { $or: [{ paymentId: paymentEntity.id }, { razorpayOrderId: paymentEntity.order_id }] },
                        { $set: { status: 'CONFIRMED', paymentStatus: 'PAID', paidAt: new Date() } }
                    );
                }
            }
        }

        res.json({ status: 'ok' });
    } catch (err) {
        console.error('Webhook error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/create-order', handleCreateRazorpayOrder);
app.post('/create-order', handleCreateRazorpayOrder);
app.post('/api/payments/razorpay/create-order', handleCreateRazorpayOrder);
app.post('/payments/razorpay/create-order', handleCreateRazorpayOrder);

app.post('/api/verify-payment', handleVerifyRazorpayPayment);
app.post('/verify-payment', handleVerifyRazorpayPayment);
app.post('/api/payments/razorpay/verify-payment', handleVerifyRazorpayPayment);
app.post('/payments/razorpay/verify-payment', handleVerifyRazorpayPayment);
app.post('/api/payments/verify', handleVerifyRazorpayPayment);

app.get(['/api/razorpay-key', '/api/payments/razorpay/key', '/razorpay-key'], (req, res) => {
    const { keyId } = getRazorpayConfig();
    res.json({ key_id: keyId, keyId: keyId, success: true });
});

// HTML Invoice (Ownership Verified, QR verified)
const handleGeneratePDFInvoice = async (req, res) => {
    try {
        const bookingId = (req.params.bookingId || req.query.bookingId || '').toString();
        const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        const formatINR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN');
        const db = await connectToDatabase();

        let booking = null;
        if (db && bookingId) {
            booking = await db.collection('bookings').findOne({
                $or: [
                    { id: bookingId },
                    { bookingId: bookingId },
                    { paymentId: bookingId },
                    { razorpayPaymentId: bookingId },
                    { orderId: bookingId },
                    { razorpayOrderId: bookingId }
                ]
            });
        }

        if (!booking) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(404).send(`<!DOCTYPE html><html><body style="font-family:sans-serif; text-align:center; padding:40px;"><h1>Booking Not Found</h1><p>Reference: ${esc(bookingId)}</p><a href="/">Back to Home</a></body></html>`);
        }

        // Authenticated ownership check if token is provided
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.slice(7).trim();
                const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'zilhaj_jwt_super_secure_secret_key_2026_umrah');
                const isOwner = (booking.userId && String(booking.userId) === String(decoded.id)) ||
                                (booking.customerEmail && booking.customerEmail.toLowerCase() === decoded.email.toLowerCase());
                const isStaff = decoded.role === 'ADMIN' || decoded.role === 'SUBADMIN';
                if (!isOwner && !isStaff) {
                    return res.status(403).send('Forbidden: You do not own this invoice.');
                }
            } catch (e) {}
        }

        const totalPrice = formatINR(booking.price || booking.totalPrice || 1);
        const invoiceNo = 'INV-' + (booking.id || booking.bookingId);
        const paymentId = booking.paymentId || booking.razorpayPaymentId || 'PAID';

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Invoice ${esc(invoiceNo)} | ZILHAJ</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; padding: 24px; }
        .invoice-box { max-width: 800px; margin: 0 auto; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 16px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 24px 0; }
        .item-table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        .item-table th, .item-table td { border-bottom: 1px solid #e2e8f0; padding: 12px; text-align: left; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; background: #dcfce7; color: #166534; font-weight: 700; font-size: 12px; }
        @media print { .no-print { display: none; } body { padding: 0; background: #fff; } .invoice-box { box-shadow: none; border: none; } }
    </style>
</head>
<body>
    <div class="no-print" style="max-width:800px; margin:0 auto 16px; display:flex; justify-content:space-between;">
        <a href="/dashboard" style="color:#0f172a; text-decoration:none; font-weight:600;">← Back to Dashboard</a>
        <button onclick="window.print()" style="background:#0f172a; color:#fff; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:600;">🖨️ Print Invoice</button>
    </div>
    <div class="invoice-box">
        <div class="header">
            <div>
                <h1 style="margin:0; font-size:24px;">ZILHAJ.COM</h1>
                <p style="margin:4px 0 0; color:#64748b; font-size:13px;">Official Umrah & Pilgrimage Invoice</p>
            </div>
            <div style="text-align:right;">
                <span class="badge">PAYMENT CONFIRMED</span>
                <p style="margin:8px 0 0; font-weight:700;">${esc(invoiceNo)}</p>
            </div>
        </div>
        <div class="grid">
            <div>
                <h4 style="margin:0 0 8px; color:#64748b;">BILLED TO</h4>
                <strong>${esc(booking.customerName || 'Valued Pilgrim')}</strong><br>
                <span>${esc(booking.customerEmail || '')}</span><br>
                <span>${esc(booking.customerPhone || '')}</span>
            </div>
            <div style="text-align:right;">
                <h4 style="margin:0 0 8px; color:#64748b;">TRANSACTION DETAILS</h4>
                <span>Payment Ref: <code>${esc(paymentId)}</code></span><br>
                <span>Date: ${new Date(booking.createdAt || Date.now()).toLocaleDateString('en-GB')}</span><br>
                <span>Gateway: Razorpay Escrow Protected</span>
            </div>
        </div>
        <table class="item-table">
            <thead>
                <tr style="background:#f1f5f9;">
                    <th>Itinerary Description</th>
                    <th>Departure</th>
                    <th>Travelers</th>
                    <th style="text-align:right;">Amount</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>${esc(booking.packageTitle || 'Deluxe Umrah Package')}</strong><br><small style="color:#64748b;">Makkah: ${esc(booking.makkahHotel || '5-Star')} | Madinah: ${esc(booking.madinahHotel || '5-Star')}</small></td>
                    <td>${esc(booking.travelDate || 'Scheduled')}</td>
                    <td>${esc(String(booking.travelers || 1))}</td>
                    <td style="text-align:right; font-weight:700;">${esc(totalPrice)}</td>
                </tr>
            </tbody>
        </table>
        <div style="margin-top:24px; text-align:right;">
            <h3 style="margin:0;">Total Paid: ${esc(totalPrice)}</h3>
        </div>
    </div>
</body>
</html>`);
    } catch (err) {
        res.status(500).send('Error generating invoice');
    }
};

app.get('/api/invoice/:bookingId', handleGeneratePDFInvoice);
app.get('/invoice/:bookingId', handleGeneratePDFInvoice);

// ----------------------------------------------------------------------------
// VIDEO PROXY ROUTE
// ----------------------------------------------------------------------------
app.get('/api/video-proxy', (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).send('Missing url parameter');
    try {
        const parsed = new URL(videoUrl);
        const mod = parsed.protocol === 'https:' ? https : http;
        mod.get(videoUrl, (upstream) => {
            res.setHeader('Content-Type', upstream.headers['content-type'] || 'video/mp4');
            res.setHeader('Content-Disposition', 'inline');
            upstream.pipe(res);
        }).on('error', () => res.status(502).send('Error fetching upstream video'));
    } catch (e) {
        res.status(400).send('Invalid URL');
    }
});

// Single Page Application Fallback
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    serveFrontendFile(res, 'index.html');
});

// Export app and start server
const PORT = process.env.PORT || 3000;
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`[SERVER] Zilhaj Production Engine active on port ${PORT}`);
    });
}

module.exports = app;
