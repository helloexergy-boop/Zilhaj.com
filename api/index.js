const express = require('express');
const cors = require('cors');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

const MONGODB_URI = process.env.MONGODB_URI || process.env.SPRING_DATA_MONGODB_URI || 'mongodb+srv://rajuranjanxbkj_db_user:mSORiUdT4m8ey11k@cluster0.bwdhkat.mongodb.net/umrah_db?retryWrites=true&w=majority';

let cachedDb = null;

async function connectToDatabase() {
    if (cachedDb) return cachedDb;
    const client = await MongoClient.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
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

// HEALTH CHECK
app.get('/api/health', (req, res) => {
    res.json({ status: 'UP', service: 'GoExergy Vercel Serverless Backend API', timestamp: new Date() });
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
        res.json(INITIAL_PACKAGES);
    }
});

app.post('/api/packages', async (req, res) => {
    try {
        const db = await connectToDatabase();
        const pkg = { id: 'pkg-' + Date.now(), ...req.body, createdAt: new Date() };
        await db.collection('packages').insertOne(pkg);
        res.status(201).json(pkg);
    } catch (err) {
        res.status(500).json({ error: 'Failed to save package' });
    }
});

app.delete('/api/packages/:id', async (req, res) => {
    try {
        const db = await connectToDatabase();
        await db.collection('packages').deleteOne({ id: req.params.id });
        res.json({ message: 'Package deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete package' });
    }
});

// REQUIREMENTS ENDPOINTS
app.get('/api/requirements', async (req, res) => {
    try {
        const db = await connectToDatabase();
        const reqs = await db.collection('requirements').find({}).sort({ createdAt: -1 }).toArray();
        res.json(reqs);
    } catch (err) {
        res.json([]);
    }
});

app.post('/api/requirements', async (req, res) => {
    try {
        const db = await connectToDatabase();
        const reqData = { id: 'req-' + Date.now(), status: 'BIDDING', createdAt: new Date(), ...req.body };
        await db.collection('requirements').insertOne(reqData);
        res.status(201).json(reqData);
    } catch (err) {
        res.status(500).json({ error: 'Failed to submit requirement' });
    }
});

// OFFERS ENDPOINTS
app.get('/api/offers', async (req, res) => {
    try {
        const db = await connectToDatabase();
        const offers = await db.collection('offers').find({}).toArray();
        res.json(offers);
    } catch (err) {
        res.json([]);
    }
});

app.post('/api/offers', async (req, res) => {
    try {
        const db = await connectToDatabase();
        const offer = { id: 'off-' + Date.now(), status: 'PENDING', createdAt: new Date(), ...req.body };
        await db.collection('offers').insertOne(offer);
        res.status(201).json(offer);
    } catch (err) {
        res.status(500).json({ error: 'Failed to submit offer' });
    }
});

// BOOKINGS ENDPOINTS
app.get('/api/bookings', async (req, res) => {
    try {
        const db = await connectToDatabase();
        const bookings = await db.collection('bookings').find({}).toArray();
        res.json(bookings);
    } catch (err) {
        res.json([]);
    }
});

app.post('/api/bookings', async (req, res) => {
    try {
        const db = await connectToDatabase();
        const booking = { id: 'bk-' + Date.now(), status: 'CONFIRMED', createdAt: new Date(), ...req.body };
        await db.collection('bookings').insertOne(booking);
        res.status(201).json(booking);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create booking' });
    }
});

// AUTH ENDPOINTS
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (email === 'admin@umrah.com' && password === 'password123') {
        return res.json({
            id: 'admin-1',
            name: 'System Admin',
            email: 'admin@umrah.com',
            role: 'ROLE_ADMIN',
            token: 'mock-admin-jwt-token-' + Date.now()
        });
    }
    return res.json({
        id: 'usr-1',
        name: 'Tariq Mahmood',
        email: email || 'user@pilgrim.com',
        role: 'ROLE_USER',
        token: 'mock-user-jwt-token-' + Date.now()
    });
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
            totalRequirements: totalReqs || 12,
            totalOffers: totalOffers || 28,
            totalBookings: totalBookings || 8,
            totalPackages: totalPkgs || 5,
            totalRevenue: 985000
        });
    } catch (err) {
        res.json({ totalRequirements: 12, totalOffers: 28, totalBookings: 8, totalPackages: 5, totalRevenue: 985000 });
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

module.exports = app;

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
        console.log(`GoExergy Vercel API running locally on http://localhost:${PORT}`);
    });
}
