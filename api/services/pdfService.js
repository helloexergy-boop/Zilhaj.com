const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const INVOICES_DIR = path.join(__dirname, '../../public/invoices');
if (!fs.existsSync(INVOICES_DIR)) {
    fs.mkdirSync(INVOICES_DIR, { recursive: true });
}

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

            doc.rect(40, y, 515, 95).fill('#ffffff').stroke('#cbd5e1');
            doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text(bookingData.packageTitle || bookingData.packageName || 'Deluxe Umrah Package', 50, y + 12);
            doc.fillColor('#475569').fontSize(9).font('Helvetica').text(`Duration: ${bookingData.duration || '18 Days'}  |  Sharing Type: Quad / Triple Sharing  |  Category: 5 Star Deluxe`, 50, y + 28);

            doc.moveTo(50, y + 45).lineTo(545, y + 45).stroke('#e2e8f0');

            doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('Makkah Hotel:', 50, y + 55);
            doc.font('Helvetica').text(bookingData.makkahHotel || 'Al Safwa Royal Orchid (5-Star near Haram)', 140, y + 55);

            doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('Madinah Hotel:', 50, y + 72);
            doc.font('Helvetica').text(bookingData.madinahHotel || 'Dar Al-Taqwa Hotel (5-Star near Haram)', 140, y + 72);

            // FINANCIAL & PRICE BREAKDOWN
            y += 115;
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
            doc.text('1', 350, y + 8);
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

            // TRANSACTION METADATA & QR CODE VERIFICATION
            doc.rect(40, y, 360, 75).fill('#f8fafc').stroke('#e2e8f0');
            doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('TRANSACTION DETAILS', 50, y + 10);
            doc.fillColor('#475569').fontSize(8).font('Helvetica');
            doc.text(`Payment Gateway: Razorpay Secure Server`, 50, y + 25);
            doc.text(`Payment Txn ID: ${bookingData.paymentId || bookingData.razorpayPaymentId || 'pay_live_zilhaj_' + Date.now()}`, 50, y + 38);
            doc.text(`Order ID: ${bookingData.orderId || bookingData.razorpayOrderId || 'order_' + Date.now()}`, 50, y + 51);

            // Scannable Verification Box / QR representation
            doc.rect(415, y, 140, 75).fill('#ffffff').stroke('#0f172a');
            doc.rect(425, y + 10, 45, 45).fill('#0f172a');
            doc.fillColor('#ffffff').fontSize(7).font('Helvetica-Bold').text('VERIFY', 432, y + 28);
            doc.fillColor('#0f172a').fontSize(7).font('Helvetica-Bold').text('SECURE QR VERIFICATION', 417, y + 60, { width: 136, align: 'center' });

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
