const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Safe invoices directory resolution (root/public/invoices and os tmp fallback)
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const PUBLIC_INVOICES_DIR = path.join(PROJECT_ROOT, 'public', 'invoices');
const TMP_INVOICES_DIR = path.join(require('os').tmpdir(), 'zilhaj_invoices');

[PUBLIC_INVOICES_DIR, TMP_INVOICES_DIR].forEach(dir => {
    try {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch (e) {}
});

/**
 * Generate official Booking Confirmation PDF Document
 * Collects PDF stream into memory Buffer and writes to disk if possible.
 */
async function generateBookingPDF(bookingData) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            const bookingId = bookingData.bookingId || bookingData.id || `BK-${Date.now()}`;
            const fileName = `Booking_${String(bookingId).replace(/[^a-zA-Z0-9_-]/g, '')}.pdf`;
            
            // Try saving to public or temp directory
            let filePath = path.join(PUBLIC_INVOICES_DIR, fileName);
            let fileStream = null;
            try {
                fileStream = fs.createWriteStream(filePath);
            } catch (e) {
                try {
                    filePath = path.join(TMP_INVOICES_DIR, fileName);
                    fileStream = fs.createWriteStream(filePath);
                } catch (err) {}
            }

            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));

            if (fileStream) {
                doc.pipe(fileStream);
                fileStream.on('error', (err) => console.warn('[PDF] File stream write warning:', err.message));
            }

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
            doc.text(bookingData.customerName || bookingData.userName || bookingData.customer || 'Valued Pilgrim', 160, y + 10);
            doc.text(bookingData.customerEmail || bookingData.email || 'N/A', 160, y + 28);
            doc.text(bookingData.customerPhone || bookingData.phone || 'N/A', 160, y + 46);

            // PACKAGE DETAILS
            y += 80;
            doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('2. RESERVED PACKAGE DETAILS', 40, y);
            y += 20;

            doc.rect(40, y, 515, 95).fill('#f8fafc').stroke('#e2e8f0');
            doc.fillColor('#334155').fontSize(10).font('Helvetica-Bold');
            doc.text('Package Title:', 50, y + 10);
            doc.text('Service Type:', 50, y + 28);
            doc.text('Agency / Provider:', 50, y + 46);
            doc.text('Departure Date:', 50, y + 64);
            doc.text('Duration:', 50, y + 82);

            doc.font('Helvetica');
            doc.text(bookingData.packageTitle || bookingData.service || 'Custom Umrah Package', 160, y + 10);
            doc.text(bookingData.serviceType || 'Umrah Pilgrimage', 160, y + 28);
            doc.text(bookingData.agentName || 'Verified Zilhaj Partner Agency', 160, y + 46);
            doc.text(bookingData.departureDateText || bookingData.travelDate || 'Flexible / Confirmed', 160, y + 64);
            doc.text(bookingData.duration || '14-18 Days', 160, y + 82);

            // FINANCIAL SUMMARY TABLE
            y += 115;
            doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('3. PAYMENT & ESCROW SUMMARY', 40, y);
            y += 20;

            // Table Header
            doc.rect(40, y, 515, 25).fill('#e2e8f0');
            doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold');
            doc.text('Description', 50, y + 7);
            doc.text('Qty / Travelers', 280, y + 7);
            doc.text('Amount (INR)', 430, y + 7, { width: 110, align: 'right' });

            // Table Row 1: Package Cost
            y += 25;
            doc.rect(40, y, 515, 25).fill('#ffffff').stroke('#e2e8f0');
            doc.fillColor('#334155').fontSize(9).font('Helvetica');
            doc.text(bookingData.packageTitle || 'Pilgrimage Package Full Service', 50, y + 7);
            doc.text(`${bookingData.travelers || bookingData.passengers || 1} Person(s)`, 280, y + 7);
            
            const rawAmount = bookingData.totalAmount || bookingData.amount || bookingData.price || 85000;
            const formattedAmount = Number(rawAmount).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
            doc.font('Helvetica-Bold').text(formattedAmount, 430, y + 7, { width: 110, align: 'right' });

            // Table Row 2: Escrow Protection
            y += 25;
            doc.rect(40, y, 515, 25).fill('#f8fafc').stroke('#e2e8f0');
            doc.fillColor('#15803d').fontSize(9).font('Helvetica');
            doc.text('Zilhaj Safe Escrow Protection & Verification', 50, y + 7);
            doc.text('Included', 280, y + 7);
            doc.font('Helvetica-Bold').text('FREE (₹0)', 430, y + 7, { width: 110, align: 'right' });

            // Total Due / Paid Row
            y += 25;
            doc.rect(40, y, 515, 30).fill('#0f172a');
            doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold');
            doc.text('TOTAL PAID & CLEARED:', 50, y + 9);
            doc.fillColor('#38bdf8').text(formattedAmount, 430, y + 9, { width: 110, align: 'right' });

            // ESCROW & TRUST ASSURANCE BOX
            y += 45;
            doc.rect(40, y, 515, 75).fill('#f0fdf4').stroke('#86efac');
            doc.fillColor('#166534').fontSize(10).font('Helvetica-Bold').text('ZILHAJ 100% ESCROW GUARANTEE', 50, y + 10);
            doc.fillColor('#15803d').fontSize(8.5).font('Helvetica').text(
                'Your payment is held safely in ZILHAJ escrow until services are verified. Direct booking protection is provided under strict Islamic ethics and verified partner agency guidelines. For assistance or amendments, quote your Ref ID to support@zilhaj.com.',
                50, y + 26, { width: 415, lineGap: 3 }
            );

            // QR & Security Code
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

            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(chunks);
                const publicUrl = `/invoices/${fileName}`;
                resolve({
                    fileName,
                    filePath,
                    pdfBuffer,
                    publicUrl,
                    bookingId
                });
            });

            doc.on('error', (err) => {
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
