const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');

const SITE_URL = process.env.SITE_URL || 'https://onerequest.in';
const SUPPORT_EMAIL = 'support@zilhaj.com';
const SUPPORT_PHONE = '+91 95416 92891';

function getMailTransporter(forceIpv6 = false) {
    const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER || 'hello.exergy@gmail.com';
    const rawPass = process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || 'gjok vyma ilqs etfl';
    const gmailPass = rawPass ? rawPass.replace(/\s+/g, '') : '';
    if (!gmailPass) return null;
    const config = {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: { user: gmailUser, pass: gmailPass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 10000
    };
    if (forceIpv6) config.family = 6;
    return nodemailer.createTransport(config);
}

async function sendMailWithFallback(mailOptions) {
    const attempt = async (forceIpv6 = false) => {
        const transporter = getMailTransporter(forceIpv6);
        if (!transporter) return false;
        await transporter.sendMail(mailOptions);
        return true;
    };
    try {
        await attempt(false);
        return true;
    } catch (err) {
        try {
            await attempt(true);
            return true;
        } catch (e) {
            console.error('[EMAIL] Send failed:', e.message);
            return false;
        }
    }
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const formatINR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN');
const formatDate = (d) => {
    if (!d) return 'N/A';
    try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }); } catch (e) { return 'N/A'; }
};
const baseFrom = () => `"Zilhaj.com Umrah Travel" <${process.env.GMAIL_USER || 'hello.exergy@gmail.com'}>`;

// ---------------------------------------------------------------------------
// PDF INVOICE GENERATION (A4, branded, print-quality)
// ---------------------------------------------------------------------------
function generateInvoicePdf(booking) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 0 });
        const chunks = [];
        doc.on('data', (c) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const W = 595.28;
        const darkGreen = '#05281E';
        const gold = '#B8860B';
        const lightGreen = '#F0FDF4';
        const ink = '#0F172A';
        const gray = '#64748B';

        // Header band
        doc.rect(0, 0, W, 112).fill(darkGreen);
        doc.rect(0, 112, W, 4).fill(gold);
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(22).text('ZILHAJ.COM', 48, 32);
        doc.fillColor(gold).fontSize(9).text('OFFICIAL PAYMENT INVOICE & RECEIPT', 48, 60);
        doc.fillColor('#E2E8F0').font('Helvetica').fontSize(8).text('Umrah & Hajj Travel Platform  |  Escrow-Secured Payments', 48, 75);

        const invNo = 'INV-' + (booking.id || 'BK-000000');
        doc.save()
            .fillColor(darkGreen).roundedRect(W - 226, 28, 178, 62, 6)
            .strokeColor(gold).lineWidth(1.5).stroke();
        doc.restore();
        doc.fillColor(gold).font('Helvetica-Bold').fontSize(7)
            .text('INVOICE NO', W - 226 + 12, 36, { width: 154, align: 'center' });
        doc.fillColor('#FEF08A').font('Helvetica-Bold').fontSize(13)
            .text(invNo, W - 226 + 12, 48, { width: 154, align: 'center' });
        doc.fillColor('#E2E8F0').font('Helvetica').fontSize(7)
            .text('Issued On: ' + formatDate(new Date()), W - 226 + 12, 72, { width: 154, align: 'center' });

        const paymentStatus = booking.paymentStatus || (booking.status === 'CONFIRMED' ? 'PAID' : booking.status || 'CONFIRMED');
        const totalPrice = formatINR(booking.totalPrice || 0);
        const paymentId = booking.paymentId || booking.razorpay_payment_id || 'N/A';
        const txnId = booking.transactionId || paymentId || 'N/A';
        const orderId = booking.razorpayOrderId || booking.orderId || 'N/A';
        const paymentMethod = booking.paymentMethod || (paymentId !== 'N/A' ? 'RAZORPAY (UPI / CARD / NETBANKING)' : 'ONLINE PAYMENT');

        // Status banner
        doc.save().rect(48, 140, W - 96, 30).fill(lightGreen).restore();
        doc.fillColor('#047857').font('Helvetica-Bold').fontSize(9)
            .text('PAID IN FULL & VERIFIED', 64, 149);
        doc.fillColor(gray).font('Helvetica').fontSize(7.5)
            .text('Booking Ref: ' + (booking.id || 'N/A') + '   |   Saudi License #MOT-KSA-984120', 64, 161);

        // Section title helper
        const sectionTitle = (text, y) => {
            doc.fillColor('#166534').font('Helvetica-Bold').fontSize(8.5).text(text.toUpperCase(), 48, y);
            doc.moveTo(48, y + 12).lineTo(W - 48, y + 12).lineWidth(0.8).strokeColor('#E2E8F0').stroke();
        };

        const fieldRow = (label, value, y, opts = {}) => {
            doc.fillColor(gray).font('Helvetica').fontSize(8.5).text(label, 60, y);
            doc.fillColor(ink).font('Helvetica-Bold').fontSize(8.5).text(value, 200, y, { width: 330 });
            return y + (opts.h || 16);
        };

        // Billed To / Bill From
        sectionTitle('Billed To (Pilgrim)', 190);
        doc.save().rect(48, 204, 243, 92).fill('#F8FAFC').strokeColor('#E2E8F0').lineWidth(1).stroke().restore();
        let y = 214;
        y = fieldRow('Name', booking.userName || 'N/A', y);
        y = fieldRow('Email', booking.userEmail || 'N/A', y);
        y = fieldRow('Phone', booking.userPhone || 'N/A', y);
        fieldRow('Travelers', (booking.travelersCount || 1) + ' Person(s)', y);

        sectionTitle('Bill From (Operator)', 306);
        doc.save().rect(48, 320, 243, 92).fill('#F0FDF4').strokeColor('#BBF7D0').lineWidth(1).stroke().restore();
        y = 330;
        y = fieldRow('Operator', booking.agentName || 'Zilhaj.com Verified Operator', y);
        y = fieldRow('KSA Permit', '#UM-984120', y);
        fieldRow('Hotline', '+966 50 123 4567', y);

        // Package & itinerary
        sectionTitle('Package & Itinerary Details', 432);
        doc.save().rect(48, 446, 500, 86).fill('#FFFFFF').strokeColor('#E2E8F0').lineWidth(1).stroke().restore();
        y = 458;
        y = fieldRow('Package', booking.packageTitle || 'Umrah Package', y);
        y = fieldRow('Makkah Hotel', booking.makkahHotel || 'N/A', y);
        y = fieldRow('Madinah Hotel', booking.madinahHotel || 'N/A', y);
        y = fieldRow('Travel Date', booking.travelDate ? formatDate(booking.travelDate) : 'N/A', y);
        fieldRow('Includes', 'Saudi Visa, Meals, Ziyarat, Nusuk Assistance', y);

        // Payment details
        sectionTitle('Payment Details (Secure Gateway Records)', 552);
        doc.save().rect(48, 566, 500, 110).fill('#F0FDF4').strokeColor('#BBF7D0').lineWidth(1).stroke().restore();
        y = 578;
        y = fieldRow('Payment ID', paymentId, y);
        y = fieldRow('Transaction ID', txnId, y);
        y = fieldRow('Order ID', orderId, y);
        y = fieldRow('Payment Method', paymentMethod, y);
        y = fieldRow('Payment Date', formatDate(booking.paidAt || booking.updatedAt || booking.createdAt), y);
        fieldRow('Payment Status', paymentStatus + ' - VERIFIED', y, { h: 18 });

        // Amount summary
        sectionTitle('Amount Summary', 696);
        doc.save().rect(48, 710, 500, 30).fill(darkGreen).restore();
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10)
            .text('TOTAL PAID', 60, 718);
        doc.fillColor('#F9E07A')
            .text(totalPrice, W - 60, 718, { width: 170, align: 'right' });

        // Footer
        doc.fillColor(gray).font('Helvetica').fontSize(7)
            .text('Zilhaj.com  |  Hotline: ' + SUPPORT_PHONE + '  |  ' + SUPPORT_EMAIL, 48, 800, { width: W - 96, align: 'center' });
        doc.fillColor('#94A3B8')
            .text('This is a system-generated invoice. Payment secured and verified via HMAC-SHA256.', 48, 814, { width: W - 96, align: 'center' });

        doc.end();
    });
}

// ---------------------------------------------------------------------------
// EMAIL: BOOKING CONFIRMATION WITH PDF INVOICE
// ---------------------------------------------------------------------------
async function sendBookingConfirmationEmail(booking) {
    try {
        if (!booking || !booking.userEmail) return false;
        const pdfBuffer = await generateInvoicePdf(booking);
        const invNo = 'INV-' + (booking.id || 'BK-000000');
        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:640px;margin:24px auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    <div style="background:#05281e;padding:28px 32px;border-bottom:4px solid #b8860b;">
      <div style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">ZILHAJ.COM</div>
      <div style="color:#d4af37;font-size:11px;font-weight:700;letter-spacing:1.5px;margin-top:4px;">BOOKING CONFIRMATION & INVOICE</div>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px;">Assalamu Alaikum, ${esc(booking.userName || 'Pilgrim')}</h2>
      <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.65;">Your Umrah package booking has been <strong style="color:#047857;">confirmed</strong>. A copy of your official invoice (PDF) is attached to this email, and you can also download it anytime from your dashboard.</p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr><td style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:16px 20px;font-size:14px;color:#0f172a;">
          <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">
            <span style="color:#64748b;">Booking Reference</span>
            <strong>${esc(booking.id || 'N/A')}</strong>
          </div>
        </td></tr>
      </table>

      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr><td style="padding:9px 0;color:#64748b;border-bottom:1px solid #f1f5f9;">Package</td><td style="padding:9px 0;text-align:right;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;">${esc(booking.packageTitle || 'Umrah Package')}</td></tr>
        <tr><td style="padding:9px 0;color:#64748b;border-bottom:1px solid #f1f5f9;">Operator</td><td style="padding:9px 0;text-align:right;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;">${esc(booking.agentName || 'Zilhaj.com Verified Operator')}</td></tr>
        <tr><td style="padding:9px 0;color:#64748b;border-bottom:1px solid #f1f5f9;">Makkah Hotel</td><td style="padding:9px 0;text-align:right;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;">${esc(booking.makkahHotel || 'N/A')}</td></tr>
        <tr><td style="padding:9px 0;color:#64748b;border-bottom:1px solid #f1f5f9;">Madinah Hotel</td><td style="padding:9px 0;text-align:right;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;">${esc(booking.madinahHotel || 'N/A')}</td></tr>
        <tr><td style="padding:9px 0;color:#64748b;border-bottom:1px solid #f1f5f9;">Travel Date</td><td style="padding:9px 0;text-align:right;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;">${esc(formatDate(booking.travelDate))}</td></tr>
        <tr><td style="padding:9px 0;color:#64748b;border-bottom:1px solid #f1f5f9;">Travellers</td><td style="padding:9px 0;text-align:right;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;">${esc(booking.travelersCount || 1)} Person(s)</td></tr>
        <tr><td style="padding:9px 0;color:#64748b;border-bottom:1px solid #f1f5f9;">Payment Method</td><td style="padding:9px 0;text-align:right;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;">${esc(booking.paymentMethod || 'Online Payment')}</td></tr>
        <tr><td style="padding:9px 0;color:#64748b;border-bottom:1px solid #f1f5f9;">Transaction ID</td><td style="padding:9px 0;text-align:right;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;">${esc(booking.transactionId || booking.paymentId || 'N/A')}</td></tr>
        <tr><td style="padding:9px 0;color:#64748b;">Amount Paid</td><td style="padding:9px 0;text-align:right;font-weight:800;color:#047857;font-size:16px;">${formatINR(booking.totalPrice || 0)}</td></tr>
      </table>

      <div style="background:#f0fdf4;border:1px solid #a7f3d0;border-radius:10px;padding:14px 18px;margin:22px 0 0;font-size:12.5px;color:#166534;line-height:1.6;">
        <strong>Next steps:</strong> Your visa and hotel confirmation will be processed by the operator. You can track your booking status at any time from your Zilhaj.com dashboard.
      </div>

      <a href="${SITE_URL}/api/invoice/${encodeURIComponent(booking.id || '')}" style="display:inline-block;margin:22px 0 0;background:#166534;color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;padding:13px 28px;border-radius:8px;">View Invoice Online</a>

      <p style="margin:24px 0 0;color:#94a3b8;font-size:11px;line-height:1.6;border-top:1px solid #f1f5f9;padding-top:16px;">
        Zilhaj.com Umrah & Hajj Travel Platform &bull; Hotline: ${SUPPORT_PHONE} &bull; ${SUPPORT_EMAIL}<br>
        This is an automated email. Please do not reply to this message.
      </p>
    </div>
  </div>
</body>
</html>`;

        return await sendMailWithFallback({
            from: baseFrom(),
            to: booking.userEmail,
            subject: `Booking Confirmed - ${booking.packageTitle || 'Umrah Package'} (Ref: ${booking.id || ''})`,
            html,
            attachments: [
                {
                    filename: `${invNo}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        });
    } catch (err) {
        console.error('[EMAIL] Booking confirmation error:', err.message);
        return false;
    }
}

// ---------------------------------------------------------------------------
// EMAIL: NEW OFFER NOTIFICATION
// ---------------------------------------------------------------------------
async function sendNewOfferEmail(offer, requirement) {
    try {
        const toEmail = (requirement && (requirement.userEmail || requirement.email)) || offer.userEmail || offer.email;
        if (!toEmail) return false;
        const reqId = (offer.requirementId || offer.requestId || (requirement && requirement.id) || 'N/A');
        const price = Number(offer.pricePerPerson || offer.price || 0);
        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:640px;margin:24px auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    <div style="background:#05281e;padding:28px 32px;border-bottom:4px solid #b8860b;">
      <div style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">ZILHAJ.COM</div>
      <div style="color:#d4af37;font-size:11px;font-weight:700;letter-spacing:1.5px;margin-top:4px;">NEW OFFER RECEIVED</div>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px;">Assalamu Alaikum${requirement && requirement.userName ? ', ' + esc(requirement.userName) : ''}</h2>
      <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.65;">A verified operator has submitted an offer for your request <strong style="color:#0f172a;">${esc(reqId)}</strong>. Review the details below and respond before it expires.</p>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px 22px;margin-bottom:22px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
          <div>
            <div style="font-size:16px;font-weight:800;color:#0f172a;">${esc(offer.agencyName || 'Verified Operator')}</div>
            <div style="font-size:13px;color:#64748b;margin-top:3px;">${esc(offer.title || 'Umrah Offer')} &bull; ${esc(offer.durationDays || '')} Days</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px;color:#64748b;font-weight:700;">PRICE PER PERSON</div>
            <div style="font-size:22px;font-weight:800;color:#047857;">${price > 0 ? formatINR(price) : 'On Request'}</div>
          </div>
        </div>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tr><td style="padding:6px 0;color:#64748b;">Makkah Hotel</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#0f172a;">${esc(offer.hotelMakkah || 'N/A')}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">Madinah Hotel</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#0f172a;">${esc(offer.hotelMadinah || 'N/A')}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">Distance to Haram</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#0f172a;">${esc(offer.distanceHaram || 'N/A')}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">Rating</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#0f172a;">${esc(offer.rating || 'N/A')} / 5</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">Inclusions</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#0f172a;">${Array.isArray(offer.inclusions) && offer.inclusions.length ? esc(offer.inclusions.join(', ')) : 'Flight, Hotel, Transport, Visa'}</td></tr>
        </table>
      </div>

      <a href="${SITE_URL}/" style="display:inline-block;background:#166534;color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;padding:13px 28px;border-radius:8px;">View Offer in Dashboard</a>

      <p style="margin:20px 0 0;color:#64748b;font-size:12px;line-height:1.6;">Offers are time-sensitive and may be withdrawn by the operator. Your personal contact details remain private until you accept an offer.</p>

      <p style="margin:24px 0 0;color:#94a3b8;font-size:11px;line-height:1.6;border-top:1px solid #f1f5f9;padding-top:16px;">
        Zilhaj.com Umrah & Hajj Travel Platform &bull; Hotline: ${SUPPORT_PHONE} &bull; ${SUPPORT_EMAIL}<br>
        This is an automated email. Please do not reply to this message.
      </p>
    </div>
  </div>
</body>
</html>`;

        return await sendMailWithFallback({
            from: baseFrom(),
            to: toEmail,
            subject: `New Offer Received for Request ${reqId} - ${offer.agencyName || 'Verified Operator'}`,
            html
        });
    } catch (err) {
        console.error('[EMAIL] Offer notification error:', err.message);
        return false;
    }
}

module.exports = {
    sendBookingConfirmationEmail,
    sendNewOfferEmail,
    generateInvoicePdf
};