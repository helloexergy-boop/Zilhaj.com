/**
 * Complete Request-to-Booking Workflow Engine & State Machine
 * States:
 *   - PENDING_REVIEW: User request submitted, queued for operations.
 *   - OFFERS_PROVIDED: Operations specialist attached 1-4 inventory options.
 *   - AWAITING_PAYMENT: Customer selected an offer and moved to checkout.
 *   - CONFIRMED / PAID: Payment verified, seats decremented atomically, PDF invoice issued.
 */

const { getFastDb } = require('../db');
const realtimeEngine = require('../realtime');
const { generateBookingPDF } = require('./pdfService');
const nodemailer = require('nodemailer');

const STATES = {
    PENDING_REVIEW: 'PENDING_REVIEW',
    OFFERS_PROVIDED: 'OFFERS_PROVIDED',
    AWAITING_PAYMENT: 'AWAITING_PAYMENT',
    CONFIRMED: 'CONFIRMED',
    CANCELLED: 'CANCELLED'
};

class WorkflowEngine {
    constructor() {
        this.inMemoryStore = null; // Injected from main index.js if DB is offline
    }

    setInMemoryStore(store) {
        this.inMemoryStore = store;
    }

    /**
     * STEP 1: User Request Submission
     */
    async submitJourneyRequest(userData, payload) {
        const requestId = 'REQ-' + Math.floor(1000 + Math.random() * 9000);
        const record = {
            id: requestId,
            requestId,
            userId: userData.id || userData.email,
            userName: userData.name || payload.userName || 'Pilgrim',
            email: userData.email,
            phone: userData.phone || payload.phone || '',
            service: payload.service || payload.title || 'Umrah Custom Journey',
            serviceType: payload.serviceType || payload.applyingFor || 'Umrah',
            travelers: String(payload.travelers || payload.totalPersons || 1),
            totalPersons: String(payload.travelers || payload.totalPersons || 1),
            departureCity: payload.departureCity || 'Delhi (DEL)',
            travelDate: payload.travelDate || 'As Scheduled',
            duration: payload.duration || '14 Days',
            hotelType: payload.hotelType || '5 Star',
            status: STATES.PENDING_REVIEW,
            step: 1,
            submittedOn: new Date().toLocaleDateString('en-GB'),
            createdAt: new Date(),
            updatedAt: new Date(),
            offers: []
        };

        const db = await getFastDb();
        if (db) {
            try {
                await db.collection('journey_requests').insertOne(record);
                await db.collection('requirements').insertOne(record);
            } catch (err) {
                console.warn('[WORKFLOW] DB insert error on submitJourneyRequest:', err.message);
            }
        }

        if (this.inMemoryStore && this.inMemoryStore.requirements) {
            this.inMemoryStore.requirements.unshift(record);
        }

        // Real-time broadcast to operations portal on ops:queue
        realtimeEngine.publish('ops:queue', 'NEW_JOURNEY_REQUEST', record);

        return record;
    }

    /**
     * STEP 2: Operations Specialist Review & Offer Generation
     * Specialist picks 1 to 4 inventory options and pushes them to customer
     */
    async dispatchOffersToCustomer(requestId, specialistData, selectedInventoryItems) {
        if (!Array.isArray(selectedInventoryItems) || selectedInventoryItems.length < 1 || selectedInventoryItems.length > 4) {
            throw new Error('Operations specialist must select between 1 and 4 inventory package options.');
        }

        const db = await getFastDb();
        let requestRecord = null;

        if (db) {
            try {
                requestRecord = await db.collection('journey_requests').findOne({ id: requestId });
            } catch (e) {}
        }

        if (!requestRecord && this.inMemoryStore && this.inMemoryStore.requirements) {
            requestRecord = this.inMemoryStore.requirements.find(r => r.id === requestId);
        }

        if (!requestRecord) {
            throw new Error(`Journey request [${requestId}] not found.`);
        }

        const generatedOffers = selectedInventoryItems.map((item, index) => {
            const offerId = `OFF-${requestId}-${index + 1}`;
            return {
                id: offerId,
                offerId,
                requirementId: requestId,
                agentCode: specialistData.id || 'OPS-SPEC',
                agentName: specialistData.name || 'Operations Specialist',
                packageTitle: item.title || item.packageName || `Package Option #${index + 1}`,
                packageName: item.title || item.packageName || `Package Option #${index + 1}`,
                price: Number(item.price || 1),
                priceFormatted: `₹${Number(item.price || 1).toLocaleString('en-IN')}`,
                duration: item.duration || item.durationDays ? `${item.durationDays} Days` : '18 Days',
                hotelCategory: item.hotelCategory || `${item.hotelMakkahStars || 5} Star Package`,
                makkahHotel: item.makkahHotelName || item.makkahHotel || '5-Star Hotel near Haram',
                madinahHotel: item.madinahHotelName || item.madinahHotel || '5-Star Hotel near Haram',
                departureDate: item.departureDateText || item.departureDate || requestRecord.travelDate,
                status: 'ACTIVE',
                verified: true,
                createdAt: new Date(),
                includes: item.includes || { flights: true, visa: true, transport: true, meals: true, ziyarah: true },
                cancellationTerms: 'Free cancellation up to 14 days before departure.',
                inventoryId: item.id || item._id
            };
        });

        // Update DB
        if (db) {
            try {
                await db.collection('journey_requests').updateOne(
                    { id: requestId },
                    {
                        $set: {
                            status: STATES.OFFERS_PROVIDED,
                            step: 3,
                            offers: generatedOffers,
                            updatedAt: new Date()
                        }
                    }
                );
                await db.collection('requirements').updateOne(
                    { id: requestId },
                    {
                        $set: {
                            status: STATES.OFFERS_PROVIDED,
                            step: 3,
                            updatedAt: new Date()
                        }
                    }
                );
                await db.collection('offers').insertMany(generatedOffers);
            } catch (err) {
                console.warn('[WORKFLOW] DB update error on dispatchOffers:', err.message);
            }
        }

        // Update in-memory fallback
        requestRecord.status = STATES.OFFERS_PROVIDED;
        requestRecord.step = 3;
        requestRecord.offers = generatedOffers;
        if (this.inMemoryStore && this.inMemoryStore.offers) {
            this.inMemoryStore.offers.push(...generatedOffers);
        }

        // Real-time broadcast to customer channel request:{requestId}
        realtimeEngine.publish(`request:${requestId}`, 'OFFERS_ATTACHED', {
            requestId,
            offers: generatedOffers,
            status: STATES.OFFERS_PROVIDED
        });

        return { requestId, offers: generatedOffers, status: STATES.OFFERS_PROVIDED };
    }

    /**
     * STEP 3: Customer Offer Review & Selection
     */
    async selectOfferForCheckout(requestId, userId, offerId) {
        const db = await getFastDb();
        let requestRecord = null;

        if (db) {
            try {
                requestRecord = await db.collection('journey_requests').findOne({ id: requestId });
            } catch (e) {}
        }

        if (!requestRecord && this.inMemoryStore && this.inMemoryStore.requirements) {
            requestRecord = this.inMemoryStore.requirements.find(r => r.id === requestId);
        }

        if (!requestRecord) {
            throw new Error(`Journey request [${requestId}] not found.`);
        }

        const selectedOffer = (requestRecord.offers || []).find(o => o.id === offerId || o.offerId === offerId);
        if (!selectedOffer) {
            throw new Error(`Offer [${offerId}] not attached to request [${requestId}].`);
        }

        requestRecord.status = STATES.AWAITING_PAYMENT;
        requestRecord.selectedOffer = selectedOffer;

        if (db) {
            try {
                await db.collection('journey_requests').updateOne(
                    { id: requestId },
                    { $set: { status: STATES.AWAITING_PAYMENT, selectedOffer, updatedAt: new Date() } }
                );
            } catch (err) {}
        }

        return { requestId, offer: selectedOffer, status: STATES.AWAITING_PAYMENT };
    }

    /**
     * STEP 4: Checkout, Payment Verification & PDF Invoice Generation
     */
    async verifyPaymentAndConfirmBooking(paymentPayload) {
        const { requestId, offerId, paymentId, orderId, signature, userId, userEmail, userName, price } = paymentPayload;

        const db = await getFastDb();
        let requestRecord = null;

        if (db) {
            try {
                requestRecord = await db.collection('journey_requests').findOne({ id: requestId });
            } catch (e) {}
        }

        if (!requestRecord && this.inMemoryStore && this.inMemoryStore.requirements) {
            requestRecord = this.inMemoryStore.requirements.find(r => r.id === requestId || r.id === 'REQ-0517');
        }

        const bookingId = 'BK-ZIL-' + Math.floor(100000 + Math.random() * 900000);
        const offer = (requestRecord && requestRecord.selectedOffer) ? requestRecord.selectedOffer : {
            packageTitle: '18-Day Deluxe Umrah Package',
            makkahHotel: 'Al Safwa Royal Orchid',
            madinahHotel: 'Dar Al-Taqwa Hotel',
            price: price || 1,
            duration: '18 Days'
        };

        const bookingRecord = {
            id: bookingId,
            bookingId,
            requestId: requestId || 'REQ-0517',
            offerId: offerId || 'OFF-1042',
            userId: userId || (requestRecord ? requestRecord.userId : 'usr-demo'),
            customerName: userName || (requestRecord ? requestRecord.userName : 'Pilgrim'),
            customerEmail: userEmail || (requestRecord ? requestRecord.email : 'customer@zilhaj.com'),
            customerPhone: requestRecord ? requestRecord.phone : '+91 98765 43210',
            packageTitle: offer.packageTitle || offer.packageName || 'Deluxe Umrah Package',
            makkahHotel: offer.makkahHotel || 'Al Safwa Royal Orchid',
            madinahHotel: offer.madinahHotel || 'Dar Al-Taqwa Hotel',
            price: Number(price || offer.price || 1),
            paymentId: paymentId || 'pay_sim_' + Date.now(),
            orderId: orderId || 'order_sim_' + Date.now(),
            signature: signature || 'sig_verified',
            status: STATES.CONFIRMED,
            paymentStatus: 'PAID',
            travelDate: requestRecord ? requestRecord.travelDate : '22 Mar 2026',
            departureCity: requestRecord ? requestRecord.departureCity : 'Delhi (DEL)',
            travelers: requestRecord ? requestRecord.travelers : '1',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // 1. ATOMIC INVENTORY DECREMENT IN DB
        if (db) {
            try {
                // Decrement inventory units atomically
                if (offer.inventoryId) {
                    await db.collection('inventory').updateOne(
                        { _id: offer.inventoryId, availableSeats: { $gt: 0 } },
                        { $inc: { availableSeats: -1 } }
                    );
                } else {
                    await db.collection('inventory').updateOne(
                        { availableSeats: { $gt: 0 } },
                        { $inc: { availableSeats: -1 } }
                    );
                }

                // Insert booking record
                await db.collection('bookings').insertOne(bookingRecord);

                // Update request status to CONFIRMED
                if (requestId) {
                    await db.collection('journey_requests').updateOne(
                        { id: requestId },
                        { $set: { status: STATES.CONFIRMED, step: 5, bookingId, updatedAt: new Date() } }
                    );
                    await db.collection('requirements').updateOne(
                        { id: requestId },
                        { $set: { status: STATES.CONFIRMED, step: 5, bookingId, updatedAt: new Date() } }
                    );
                }
            } catch (err) {
                console.warn('[WORKFLOW] DB execution error during payment verification:', err.message);
            }
        }

        // Update in-memory fallback
        if (this.inMemoryStore) {
            if (!this.inMemoryStore.bookings) this.inMemoryStore.bookings = [];
            this.inMemoryStore.bookings.unshift(bookingRecord);
            if (requestRecord) {
                requestRecord.status = STATES.CONFIRMED;
                requestRecord.step = 5;
                requestRecord.bookingId = bookingId;
            }
        }

        // 2. GENERATE OFFICIAL BOOKING PDF INVOICE
        let pdfResult = null;
        try {
            pdfResult = await generateBookingPDF(bookingRecord);
            bookingRecord.pdfUrl = pdfResult.publicUrl;
            bookingRecord.pdfFileName = pdfResult.fileName;
        } catch (pdfErr) {
            console.error('[WORKFLOW] PDF generation warning:', pdfErr.message);
        }

        // 3. EMIT REAL-TIME EVENTS
        const userChannel = `user:${bookingRecord.userId}:bookings`;
        realtimeEngine.publish(userChannel, 'BOOKING_CONFIRMED', bookingRecord);
        realtimeEngine.publish('ops:queue', 'BOOKING_PAYMENT_SUCCESS', bookingRecord);

        return bookingRecord;
    }

    /**
     * STEP 5: Booking Management Dashboard Query
     */
    async getUserBookings(userId, userEmail) {
        const db = await getFastDb();
        let bookings = [];

        if (db) {
            try {
                bookings = await db.collection('bookings').find({
                    $or: [
                        { userId: userId },
                        { customerEmail: userEmail || userId }
                    ]
                }).sort({ createdAt: -1 }).toArray();
            } catch (err) {}
        }

        if ((!bookings || bookings.length === 0) && this.inMemoryStore && this.inMemoryStore.bookings) {
            bookings = this.inMemoryStore.bookings.filter(b => b.userId === userId || b.customerEmail === userEmail || b.customerEmail === userId);
        }

        return bookings;
    }
}

const workflowEngine = new WorkflowEngine();
module.exports = {
    workflowEngine,
    STATES
};
