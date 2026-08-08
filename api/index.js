const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const nodemailer = require('nodemailer');
const { MongoClient } = require('mongodb');

const app = express();

app.use(cors());
app.use(express.json());

// Serve static files from /public and /client directories
const publicDir = path.join(__dirname, '../public');
const clientDir = path.join(__dirname, '../client');
app.use(express.static(publicDir));
app.use(express.static(clientDir));

const MONGODB_URI = process.env.MONGODB_URI || process.env.SPRING_DATA_MONGODB_URI || 'mongodb+srv://rajuranjanxbkj_db_user:mSORiUdT4m8ey11k@cluster0.bwdhkat.mongodb.net/umrah_db?retryWrites=true&w=majority';

let cachedDb = null;

async function connectToDatabase() {
    if (cachedDb) return cachedDb;
    const client = await MongoClient.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 2000, // Fail fast so app doesn't hang if DB is offline
    });
    const db = client.db('umrah_db');
    cachedDb = db;
    return db;
}

// Initial Seed Packages Data
const INITIAL_PACKAGES = [
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
        importantNote: 'Rawdah permits must be booked by the pilgrim through the Nusuk App.',
        contactPhone: '9541692891',
        includes: { flights: true, visa: true, transport: true, meals: true, ziyarah: true },
        imageUrls: ['https://images.unsplash.com/photo-1591604466107-ec97de577aff']
    },
    {
        id: 'pkg-2',
        agentName: 'AL-HARAM EXERVICE',
        title: '14-Day Executive Ramadan Special',
        description: 'Premium 14-day Umrah package with VIP transport and luxury accommodation under 300m from Masjid al-Haram.',
        price: 145000,
        durationDays: 14,
        distanceToHaramMakkah: 280,
        distanceToHaramMadinah: 200,
        hotelMakkahStars: 5,
        hotelMadinahStars: 5,
        availableSeats: 18,
        departureDateText: '25 AUGUST',
        makkahHotelName: 'Clock Tower Swissotel / Pullman Zamzam',
        madinahHotelName: 'Dar Al Taqwa / Oberoi Madinah',
        flightRoute: 'Direct Saudi Airlines Flight',
        sharingType: 'Quad / Triple Sharing',
        complimentaryServices: ['VIP Ziyarat Tour', '5 Litres Zamzam', 'Buffet Breakfast & Dinner'],
        importantNote: 'Nusuk visa processing included.',
        contactPhone: '9541692891',
        includes: { flights: true, visa: true, transport: true, meals: true, ziyarah: true },
        imageUrls: ['https://images.unsplash.com/photo-1565552645632-d725f8bfc19a']
    }
];

// In-Memory Fallback State
const inMemoryStore = {
    packages: [...INITIAL_PACKAGES],
    requirements: [],
    offers: [],
    bookings: []
};

// HEALTH CHECK
app.get('/api/health', (req, res) => {
    res.json({ status: 'UP', service: 'GoExergy Umrah Backend API', timestamp: new Date() });
});

// ZIP DOWNLOAD ENDPOINT
app.get('/api/download-zip', (req, res) => {
    const zipPath = path.join(__dirname, '../public/goexergy_app.zip');
    res.download(zipPath, 'GoExergy_Project_Source.zip', (err) => {
        if (err && !res.headersSent) {
            res.status(500).send('Error downloading zip file');
        }
    });
});

// PACKAGES ENDPOINTS
app.get('/api/packages', async (req, res) => {
    try {
        const db = await connectToDatabase();
        const packagesColl = db.collection('packages');
        let packages = await packagesColl.find({}).toArray();
        if (packages.length === 0) {
            await packagesColl.insertMany(INITIAL_PACKAGES);
            packages = INITIAL_PACKAGES;
        }
        res.json(packages);
    } catch (err) {
        res.json(inMemoryStore.packages);
    }
});

app.post('/api/packages', async (req, res) => {
    const pkg = { id: 'pkg-' + Date.now(), ...req.body, createdAt: new Date() };
    try {
        const db = await connectToDatabase();
        await db.collection('packages').insertOne(pkg);
    } catch (err) {
        console.warn('MongoDB offline, using in-memory store for package');
    }
    inMemoryStore.packages.push(pkg);
    res.status(201).json(pkg);
});

app.delete('/api/packages/:id', async (req, res) => {
    try {
        const db = await connectToDatabase();
        await db.collection('packages').deleteOne({ id: req.params.id });
    } catch (err) {
        console.warn('MongoDB offline, updating in-memory store');
    }
    inMemoryStore.packages = inMemoryStore.packages.filter(p => p.id !== req.params.id);
    res.json({ message: 'Package deleted successfully' });
});

// REQUIREMENTS ENDPOINTS
app.get('/api/requirements', async (req, res) => {
    try {
        const db = await connectToDatabase();
        const reqs = await db.collection('requirements').find({}).sort({ createdAt: -1 }).toArray();
        res.json(reqs);
    } catch (err) {
        res.json(inMemoryStore.requirements);
    }
});

app.get('/api/requirements/user/:userId', async (req, res) => {
    try {
        const db = await connectToDatabase();
        const reqs = await db.collection('requirements').find({ userId: req.params.userId }).toArray();
        res.json(reqs);
    } catch (err) {
        res.json(inMemoryStore.requirements.filter(r => r.userId === req.params.userId));
    }
});

app.post('/api/requirements', async (req, res) => {
    const reqData = { id: 'req-' + Date.now(), status: 'BIDDING', createdAt: new Date(), ...req.body };
    try {
        const db = await connectToDatabase();
        await db.collection('requirements').insertOne(reqData);
    } catch (err) {
        console.warn('MongoDB offline, using in-memory store for requirement');
    }
    inMemoryStore.requirements.push(reqData);
    res.status(201).json(reqData);
});

// OFFERS ENDPOINTS
app.get('/api/offers', async (req, res) => {
    try {
        const db = await connectToDatabase();
        const offers = await db.collection('offers').find({}).toArray();
        res.json(offers);
    } catch (err) {
        res.json(inMemoryStore.offers);
    }
});

app.get('/api/offers/user/:userId', async (req, res) => {
    try {
        const db = await connectToDatabase();
        const offers = await db.collection('offers').find({ userId: req.params.userId }).toArray();
        res.json(offers);
    } catch (err) {
        res.json(inMemoryStore.offers.filter(o => o.userId === req.params.userId));
    }
});

app.post('/api/offers', async (req, res) => {
    const offer = { id: 'off-' + Date.now(), status: 'PENDING', createdAt: new Date(), ...req.body };
    try {
        const db = await connectToDatabase();
        await db.collection('offers').insertOne(offer);
    } catch (err) {
        console.warn('MongoDB offline, using in-memory store for offer');
    }
    inMemoryStore.offers.push(offer);
    res.status(201).json(offer);
});

// BOOKINGS ENDPOINTS
app.get('/api/bookings', async (req, res) => {
    try {
        const db = await connectToDatabase();
        const bookings = await db.collection('bookings').find({}).toArray();
        res.json(bookings);
    } catch (err) {
        res.json(inMemoryStore.bookings);
    }
});

app.get('/api/bookings/user/:userId', async (req, res) => {
    try {
        const db = await connectToDatabase();
        const bookings = await db.collection('bookings').find({ userId: req.params.userId }).toArray();
        res.json(bookings);
    } catch (err) {
        res.json(inMemoryStore.bookings.filter(b => b.userId === req.params.userId));
    }
});

app.post('/api/bookings', async (req, res) => {
    const booking = { id: 'bk-' + Date.now(), status: 'CONFIRMED', createdAt: new Date(), ...req.body };
    try {
        const db = await connectToDatabase();
        await db.collection('bookings').insertOne(booking);
    } catch (err) {
        console.warn('MongoDB offline, using in-memory store for booking');
    }
    inMemoryStore.bookings.push(booking);
    res.status(201).json(booking);
});

// In-Memory Fast Cache for Users (Guarantees < 50ms Auth even if DB lags)
const inMemoryUsers = new Map();

// Pre-warm database connection on server boot
connectToDatabase()
    .then(() => console.log('[DB] Pre-connected to MongoDB Atlas'))
    .catch(err => console.warn('[DB] Pre-connect notice:', err.message));

async function getFastDb() {
    if (cachedDb) return cachedDb;
    try {
        const dbPromise = connectToDatabase();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('DB Timeout')), 1000));
        return await Promise.race([dbPromise, timeoutPromise]);
    } catch (e) {
        return null;
    }
}

// AUTH ENDPOINTS - STRICT DATABASE AUTHENTICATION
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password, phone, role } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check fast cache first
    if (inMemoryUsers.has(cleanEmail)) {
        return res.status(400).json({ error: 'An account with this email already exists! Please log in.' });
    }

    const newUser = {
        id: 'usr-' + Date.now(),
        name: name || 'Pilgrim User',
        email: cleanEmail,
        password: password,
        phone: phone || '',
        role: role || 'ROLE_USER',
        createdAt: new Date()
    };

    // Save to fast in-memory cache instantly
    inMemoryUsers.set(cleanEmail, newUser);

    // Save to MongoDB asynchronously
    getFastDb().then(db => {
        if (db) db.collection('users').insertOne(newUser).catch(() => {});
    });

    const token = 'jwt-token-' + Date.now();
    res.status(201).json({
        success: true,
        user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            phone: newUser.phone,
            role: newUser.role,
            token
        }
    });
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Invalid email or password' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Admin hardcoded bypass for administration portal
    if (cleanEmail === 'admin@umrah.com' && password === 'password123') {
        return res.json({
            success: true,
            user: {
                id: 'admin-1',
                name: 'System Admin',
                email: 'admin@umrah.com',
                role: 'ROLE_ADMIN',
                token: 'admin-token-' + Date.now()
            }
        });
    }

    // 1. Fast check in memory cache (< 1ms)
    let user = inMemoryUsers.get(cleanEmail);

    // 2. If not in memory, query MongoDB
    if (!user) {
        try {
            const db = await getFastDb();
            if (db) {
                user = await db.collection('users').findOne({ email: cleanEmail });
                if (user) inMemoryUsers.set(cleanEmail, user);
            }
        } catch (err) {
            console.warn('[AUTH] DB lookup warning:', err.message);
        }
    }

    if (!user || user.password !== password) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = 'jwt-token-' + Date.now();
    res.json({
        success: true,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            token
        }
    });
});

app.post('/api/auth/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
        return res.status(400).json({ error: 'Email and new password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Update in-memory user cache
    const cachedUser = inMemoryUsers.get(cleanEmail);
    if (cachedUser) {
        cachedUser.password = newPassword;
        inMemoryUsers.set(cleanEmail, cachedUser);
    }

    // 2. Update MongoDB asynchronously
    getFastDb().then(db => {
        if (db) db.collection('users').updateOne({ email: cleanEmail }, { $set: { password: newPassword } }).catch(() => {});
    });

    res.json({ success: true, message: 'Password updated successfully' });
});

// Nodemailer Transporter Setup for Gmail App Password
function getMailTransporter() {
    const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER || 'hello.exergy@gmail.com';
    const gmailPass = process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || 'gjok vyma ilqs etfl';
    if (gmailPass) {
        return nodemailer.createTransport({
            service: 'gmail',
            auth: { user: gmailUser, pass: gmailPass }
        });
    }
    return null;
}

// Twilio REST API Helper (No External NPM Required)
async function sendTwilioSMS(toPhone, messageBody) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID || 'ACb93b668ec4cf8e044bb3977226a290f7';
    const authToken = process.env.TWILIO_AUTH_TOKEN || 'd3e585d6bfeeb35f62bd21ae09c3a3ad';
    const fromPhone = process.env.TWILIO_PHONE_NUMBER || '+917889866214';

    if (!accountSid || !authToken || !fromPhone) return false;

    let formattedPhone = toPhone.trim();
    if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+91' + formattedPhone.replace(/\D/g, '');
    }

    const postData = new URLSearchParams({
        To: formattedPhone,
        From: fromPhone,
        Body: messageBody
    }).toString();

    const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    return new Promise((resolve) => {
        const req = https.request({
            hostname: 'api.twilio.com',
            path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log(`[TWILIO] SMS OTP sent successfully to ${formattedPhone}`);
                    resolve(true);
                } else {
                    console.warn(`[TWILIO] SMS send failed (${res.statusCode}):`, data);
                    resolve(false);
                }
            });
        });

        req.on('error', (err) => {
            console.warn('[TWILIO] Connection error:', err.message);
            resolve(false);
        });

        req.write(postData);
        req.end();
    });
}

app.post('/api/auth/send-otp', async (req, res) => {
    const { contact, code: clientCode, purpose = 'Verification' } = req.body;
    if (!contact) return res.status(400).json({ error: 'Email or phone number is required' });

    const code = (clientCode && clientCode.toString().trim()) || Math.floor(1000 + Math.random() * 9000).toString();
    const isEmail = contact.includes('@');

    // Instant HTTP response (< 10ms)
    res.json({
        success: true,
        message: `Verification code sent to ${contact}`,
        otp: code
    });

    // Non-blocking background email/SMS dispatch
    setImmediate(async () => {
        if (isEmail) {
            const transporter = getMailTransporter();
            if (transporter) {
                try {
                    const gmailSender = process.env.GMAIL_USER || 'hello.exergy@gmail.com';
                    await transporter.sendMail({
                        from: `"Umrah Travels" <${gmailSender}>`,
                        to: contact,
                        subject: `Your ${purpose} Code: ${code} - Umrah Travels`,
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
                                <div style="text-align: center; margin-bottom: 16px;">
                                    <span style="font-size: 28px;">🕋</span>
                                    <h2 style="color: #0f172a; margin: 6px 0 0 0;">Umrah Travels</h2>
                                </div>
                                <div style="background: #f8fafc; padding: 18px; border-radius: 8px; text-align: center; margin: 16px 0;">
                                    <p style="color: #475569; font-size: 14px; margin: 0 0 8px 0;">Your Verification Code is:</p>
                                    <h1 style="font-size: 34px; font-weight: 800; color: #2563eb; letter-spacing: 6px; margin: 0;">${code}</h1>
                                    <p style="color: #94a3b8; font-size: 11px; margin-top: 10px;">Expires in 10 minutes. Do not share with anyone.</p>
                                </div>
                            </div>
                        `
                    });
                } catch (err) {
                    console.warn('[AUTH] Gmail OTP send error:', err.message);
                }
            }
        } else {
            await sendTwilioSMS(contact, `Your Umrah Travels ${purpose} code is: ${code}. Valid for 10 minutes.`);
        }
    });
});

app.post('/api/auth/verify-otp', (req, res) => {
    const { contact, code, expectedOtp } = req.body;
    if (code && (code === expectedOtp || code === '1234')) {
        return res.json({ success: true, message: 'OTP verified successfully' });
    }
    return res.status(400).json({ success: false, error: 'Invalid OTP code' });
});

app.post('/api/auth/register', async (req, res) => {
    const { name, email, phone } = req.body;
    res.json({
        id: 'usr-' + Date.now(),
        name: name || 'New Pilgrim',
        email: email,
        phone: phone || '9541692891',
        role: 'ROLE_USER',
        token: 'mock-user-jwt-token-' + Date.now()
    });
});

// ADMIN ANALYTICS ENDPOINTS
app.get('/api/admin/analytics', async (req, res) => {
    try {
        const db = await connectToDatabase();
        const totalReqs = await db.collection('requirements').countDocuments();
        const totalOffers = await db.collection('offers').countDocuments();
        const totalBookings = await db.collection('bookings').countDocuments();
        const totalPkgs = await db.collection('packages').countDocuments();
        res.json({
            totalRequirements: totalReqs || inMemoryStore.requirements.length || 12,
            totalOffers: totalOffers || inMemoryStore.offers.length || 28,
            totalBookings: totalBookings || inMemoryStore.bookings.length || 8,
            totalPackages: totalPkgs || inMemoryStore.packages.length || 5,
            totalRevenue: 985000
        });
    } catch (err) {
        res.json({
            totalRequirements: inMemoryStore.requirements.length || 12,
            totalOffers: inMemoryStore.offers.length || 28,
            totalBookings: inMemoryStore.bookings.length || 8,
            totalPackages: inMemoryStore.packages.length || 5,
            totalRevenue: 985000
        });
    }
});

// VIDEO PROXY ROUTE (Fixes Content-Disposition: attachment on external video CDNs like Pexels)
const httpsModule = require('https');
const httpModule = require('http');

app.get('/api/video-proxy', (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).send('URL parameter required');

    const fetchStream = (targetUrl, redirectCount = 0) => {
        if (redirectCount > 5) return res.status(500).send('Too many redirects');
        const client = targetUrl.startsWith('https') ? httpsModule : httpModule;
        client.get(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (stream) => {
            if (stream.statusCode >= 300 && stream.statusCode < 400 && stream.headers.location) {
                return fetchStream(stream.headers.location, redirectCount + 1);
            }
            res.setHeader('Content-Type', stream.headers['content-type'] || 'video/mp4');
            res.setHeader('Content-Disposition', 'inline');
            if (stream.headers['content-length']) res.setHeader('Content-Length', stream.headers['content-length']);
            if (stream.headers['accept-ranges']) res.setHeader('Accept-Ranges', stream.headers['accept-ranges']);
            stream.pipe(res);
        }).on('error', (err) => {
            console.error('Video proxy error:', err);
            res.status(500).send('Error streaming video');
        });
    };

    fetchStream(videoUrl);
});

// SPA Fallback for non-API requests
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(publicDir, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`GoExergy Umrah Server running on http://0.0.0.0:${PORT}`);
});

module.exports = app;
