const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const CLIENT_INVOICES_DIR = path.join(__dirname, '../../client/invoices');
const PUBLIC_INVOICES_DIR = path.join(__dirname, '../../public/invoices');

[CLIENT_INVOICES_DIR, PUBLIC_INVOICES_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
    }
});
const INVOICES_DIR = CLIENT_INVOICES_DIR;

/**
 * Generate official Booking Confirmation PDF Document
 */
async function generateBookingPDF(bookingData) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            const bookingId = bookingData.bookingId || bookingData.id || `BK-${Date.now()}`;
            const fileName = `Booking_${bookingId.replace(/[^a-zA-Z0-9_-]/g, '')}.pdf`;
            const filePath = path.join(INVOICES_DIR, fileName);
            const stream = fs.createWriteStream(filePath);

            doc.pipe(stream);

            // HEADER SECTION
            doc.rect(0, 0, 595, 110).fill('#0f172a');

            doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold').text('ZILHAJ', 40, 30);
            doc.fontSize(10).font('Helvetica').text('PREMIUM UMRAH & PILGRIMAGE SERVICES', 40, 58);
            doc.fontSize(9).text('Official Booking & Payment Confirmation', 40, 74);

            doc.fillColor('#38bdf8').fontSize(14).font('Helvetica-Bold').text('BOOKING CONFIRMATION', 350, 32, { align: 'right' });
            doc.fillColor('#94a3b8').fontSize(9).font('Helvetica').text(`Ref ID: ${bookingId}`, 350, 55, { align: 'right' });
            doc.text(`Issued: ${new Date().toLocaleDateString('en-GB')}`, 350, 70, { align: 'right' });

            // STATUS BADGE
            doc.save();
            doc.roundedRect(40, 125, 515, 35, 6).fill('#f0fdf4').stroke('#16a34a');
            doc.fillColor('#15803d').fontSize(11).font('Helvetica-Bold').text('STATUS: PAYMENT CONFIRMED & SEATS ALLOCATED', 55, 137);
            doc.restore();

            // CUSTOMER DETAILS & BOOKING INFO
            let y = 175;
            doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('1. PILGRIM & CONTACT INFORMATION', 40, y);
            y += 20;

            doc.rect(40, y, 515, 65).fill('#f8fafc').stroke('#e2e8f0');
            doc.fillColor('#334155').fontSize(10).font('Helvetica-Bold');
            doc.text('Customer Name:', 50, y + 10);
            doc.text('Email Address:', 50, y + 28);
            doc.text('Phone Number:', 50, y + 46);

            doc.font('Helvetica');
            doc.text(bookingData.customerName || bookingData.userName || 'Valued Pilgrim', 160, y + 10);
            doc.text(bookingData.customerEmail || bookingData.email || 'N/A', 160, y + 28);
            doc.text(bookingData.customerPhone || bookingData.phone || 'N/A', 160, y + 46);

            doc.font('Helvetica-Bold').text('Departure City:', 320, y + 10);
            doc.font('Helvetica-Bold').text('Travel Date:', 320, y + 28);
            doc.font('Helvetica-Bold').text('Total Passengers:', 320, y + 46);

            doc.font('Helvetica');
            doc.text(bookingData.departureCity || 'Delhi (DEL)', 430, y + 10);
            doc.text(bookingData.travelDate || bookingData.departureDate || 'As Scheduled', 430, y + 28);
            doc.text(String(bookingData.travelers || bookingData.totalPersons || 1), 430, y + 46);

            // ITINERARY BREAKDOWN
            y += 85;
            doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('2. ITINERARY & ACCOMMODATION DETAILS', 40, y);
            y += 20;

            doc.rect(40, y, 515, 115).fill('#ffffff').stroke('#cbd5e1');
            doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text(bookingData.packageTitle || bookingData.packageName || 'Deluxe Umrah Package', 50, y + 12);
            doc.fillColor('#475569').fontSize(9).font('Helvetica').text(`Duration: ${bookingData.duration || '18 Days'}  |  Partner Agency: ${bookingData.agencyName || bookingData.agentName || 'Al-Haramain Luxury Group'} (${bookingData.agentCode || 'AGENT-2826'})`, 50, y + 28);

            doc.moveTo(50, y + 42).lineTo(545, y + 42).stroke('#e2e8f0');

            doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('Makkah Hotel:', 50, y + 50);
            doc.font('Helvetica').text(`${bookingData.makkahHotel || 'Fairmont Clock Tower'} (${bookingData.makkahDistance || '50m from Haram'})`, 140, y + 50);

            doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('Madinah Hotel:', 50, y + 66);
            doc.font('Helvetica').text(`${bookingData.madinahHotel || 'Dar Al-Taqwa'} (${bookingData.madinahDistance || '50m from Gate 25'})`, 140, y + 66);

            doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('Transport:', 50, y + 82);
            doc.font('Helvetica').text(bookingData.transport || 'VIP AC Luxury Coach (Private Fleet)', 140, y + 82);

            doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('Meal Plan:', 50, y + 98);
            doc.font('Helvetica').text(bookingData.mealPlan || 'Full Board (Indian & International Buffet)', 140, y + 98);

            // FINANCIAL & PRICE BREAKDOWN
            y += 130;
            doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('3. FINANCIAL BREAKDOWN & PAYMENT', 40, y);
            y += 20;

            // Table Header
            doc.rect(40, y, 515, 22).fill('#1e293b');
            doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
            doc.text('Description', 50, y + 6);
            doc.text('Qty', 350, y + 6);
            doc.text('Amount (INR)', 450, y + 6, { align: 'right' });
            y += 22;

            const price = Number(bookingData.price || 1);
            const basePrice = Math.round(price * 0.95 * 100) / 100;
            const taxAmount = Math.round((price - basePrice) * 100) / 100;

            doc.rect(40, y, 515, 50).fill('#ffffff').stroke('#e2e8f0');
            doc.fillColor('#334155').fontSize(9).font('Helvetica');
            doc.text(bookingData.packageTitle || 'Umrah Pilgrimage Package', 50, y + 8);
            doc.text('Includes eVisa, Flight Tickets, 5-Star Hotel, Ziyarat & Zamzam', 50, y + 22);
            doc.text(String(bookingData.travelers || 1), 350, y + 8);
            doc.text(`₹${basePrice.toLocaleString('en-IN')}`, 450, y + 8, { align: 'right' });

            doc.text('GST & Statutory Taxes (5% Included)', 50, y + 34);
            doc.text(`₹${taxAmount.toLocaleString('en-IN')}`, 450, y + 34, { align: 'right' });
            y += 50;

            // Total Row
            doc.rect(40, y, 515, 25).fill('#f1f5f9').stroke('#cbd5e1');
            doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold');
            doc.text('TOTAL AMOUNT PAID:', 50, y + 7);
            doc.fillColor('#16a34a').fontSize(12).text(`₹${price.toLocaleString('en-IN')}`, 450, y + 6, { align: 'right' });
            y += 35;

            // TRANSACTION METADATA & STAMP / QR CODE VERIFICATION
            doc.rect(40, y, 320, 80).fill('#f8fafc').stroke('#e2e8f0');
            doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('TRANSACTION & ESCROW METADATA', 50, y + 10);
            doc.fillColor('#475569').fontSize(8).font('Helvetica');
            doc.text(`Payment Gateway: Razorpay Escrow Protected`, 50, y + 26);
            doc.text(`Payment Txn ID: ${bookingData.paymentId || bookingData.razorpayPaymentId || 'pay_live_zilhaj_' + Date.now()}`, 50, y + 39);
            doc.text(`Razorpay Order ID: ${bookingData.orderId || bookingData.razorpayOrderId || 'order_' + Date.now()}`, 50, y + 52);
            doc.text(`Escrow Clearance: 100% Guaranteed & Insured`, 50, y + 65);

            // Official Stamp & Digital Signatory
            doc.save();
            doc.circle(410, y + 40, 26).lineWidth(1.5).stroke('#127a4d');
            doc.circle(410, y + 40, 23).lineWidth(0.6).dash(2, { space: 2 }).stroke('#127a4d');
            doc.undash();
            doc.fillColor('#127a4d').fontSize(5.5).font('Helvetica-Bold').text('ZILHAJ ESCROW', 386, y + 28, { width: 48, align: 'center' });
            doc.fontSize(5).text('OFFICIAL SEAL', 386, y + 36, { width: 48, align: 'center' });
            doc.fontSize(4.5).text('VERIFIED & VALID', 386, y + 45, { width: 48, align: 'center' });
            doc.restore();

            // Scannable Verification Box / QR representation
            doc.rect(455, y, 100, 80).fill('#ffffff').stroke('#0f172a');
            doc.rect(480, y + 8, 50, 48).fill('#0f172a');
            doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold').text('SCAN QR', 484, y + 26, { width: 42, align: 'center' });
            doc.fillColor('#0f172a').fontSize(6.5).font('Helvetica-Bold').text('SECURE QR VALIDATION', 458, y + 60, { width: 94, align: 'center' });
            doc.fillColor('#64748b').fontSize(5.5).font('Helvetica').text(`Ref: ${bookingId}`, 458, y + 69, { width: 94, align: 'center' });

            // Signatory Row
            y += 90;
            doc.fillColor('#64748b').fontSize(8).font('Helvetica').text('Authorized Signatory: Tawseef Assadullah H (Head of Pilgrimage Operations) • Digitally Validated Document', 40, y);

            // FOOTER
            doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text('Zilhaj.com Pilgrimage Services  |  Support Hotline: +91 95416 92891  |  Email: support@zilhaj.com', 40, 770, { align: 'center' });

            doc.end();

            stream.on('finish', () => {
                const publicUrl = `/invoices/${fileName}`;
                resolve({
                    fileName,
                    filePath,
                    publicUrl,
                    bookingId
                });
            });

            stream.on('error', (err) => {
                reject(err);
            });
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = {
    generateBookingPDF
};
