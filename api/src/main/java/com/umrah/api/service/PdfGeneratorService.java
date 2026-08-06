package com.umrah.api.service;

import com.lowagie.text.*;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import com.umrah.api.model.Booking;
import com.umrah.api.model.Payment;
import com.umrah.api.model.UmrahPackage;
import com.umrah.api.model.User;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.awt.Color;
import java.time.format.DateTimeFormatter;

/**
 * Service for programmatically generating professional PDF Invoices and Travel Tickets for Umrah Bookings.
 */
@Service
public class PdfGeneratorService {

    public ByteArrayInputStream generateInvoiceAndTicketPdf(Booking booking, Payment payment, UmrahPackage pkg, User user) {
        Document document = new Document(PageSize.A4, 36, 36, 36, 36);
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        try {
            PdfWriter.getInstance(document, out);
            document.open();

            // Fonts
            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 20, new Color(4, 120, 87));
            Font subTitleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, new Color(217, 119, 6));
            Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, Color.WHITE);
            Font regularFont = FontFactory.getFont(FontFactory.HELVETICA, 10, Color.BLACK);
            Font boldFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, Color.BLACK);

            // Document Header
            Paragraph title = new Paragraph("UMRAH TRIP BOOKING PLATFORM", titleFont);
            title.setAlignment(Element.ALIGN_CENTER);
            document.add(title);

            Paragraph docType = new Paragraph("OFFICIAL INVOICE & TRAVEL TICKET VOUCHER", subTitleFont);
            docType.setAlignment(Element.ALIGN_CENTER);
            docType.setSpacingAfter(15);
            document.add(docType);

            // Invoice Summary Table
            PdfPTable metaTable = new PdfPTable(2);
            metaTable.setWidthPercentage(100);
            metaTable.setSpacingAfter(15);

            metaTable.addCell(createCell("Booking ID: " + booking.getId(), boldFont, false));
            metaTable.addCell(createCell("Date: " + (booking.getCreatedAt() != null ? booking.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")) : "N/A"), regularFont, false));
            metaTable.addCell(createCell("Booking Status: " + booking.getStatus(), boldFont, false));
            metaTable.addCell(createCell("Payment Status: " + (payment != null ? payment.getStatus() : "PENDING"), boldFont, false));
            if (payment != null && payment.getTransactionId() != null) {
                metaTable.addCell(createCell("Transaction Reference: " + payment.getTransactionId(), regularFont, false));
                metaTable.addCell(createCell("Payment Method: " + payment.getPaymentMethod(), regularFont, false));
            }
            document.add(metaTable);

            // Customer Details Section
            Paragraph custHeader = new Paragraph("ZAIREEN & TRAVELER INFORMATION", subTitleFont);
            custHeader.setSpacingAfter(8);
            document.add(custHeader);

            PdfPTable custTable = new PdfPTable(2);
            custTable.setWidthPercentage(100);
            custTable.setSpacingAfter(15);

            custTable.addCell(createCell("Primary Traveler: " + (user != null ? user.getName() : "N/A"), regularFont, false));
            custTable.addCell(createCell("Contact Email: " + (user != null ? user.getEmail() : "N/A"), regularFont, false));
            custTable.addCell(createCell("Contact Phone: " + booking.getContactPhone(), regularFont, false));
            custTable.addCell(createCell("Travelers Count: " + booking.getTravelersCount() + " Person(s)", boldFont, false));
            document.add(custTable);

            // Package Breakdown
            Paragraph pkgHeader = new Paragraph("PACKAGE & ACCOMMODATION DETAILS", subTitleFont);
            pkgHeader.setSpacingAfter(8);
            document.add(pkgHeader);

            PdfPTable pkgTable = new PdfPTable(2);
            pkgTable.setWidthPercentage(100);
            pkgTable.setSpacingAfter(15);

            pkgTable.addCell(createCell("Package Title: " + booking.getPackageTitle(), boldFont, false));
            pkgTable.addCell(createCell("Travel Agency: " + booking.getAgentName(), regularFont, false));
            pkgTable.addCell(createCell("Departure Date: " + booking.getTravelDate(), regularFont, false));
            if (pkg != null) {
                pkgTable.addCell(createCell("Duration: " + pkg.getDurationDays() + " Days", regularFont, false));
                pkgTable.addCell(createCell("Makkah Hotel: " + pkg.getHotelMakkahStars() + "-Star (" + pkg.getDistanceToHaramMakkah() + "m to Haram)", regularFont, false));
                pkgTable.addCell(createCell("Madinah Hotel: " + pkg.getHotelMadinahStars() + "-Star (" + pkg.getDistanceToHaramMadinah() + "m to Nabawi)", regularFont, false));
            }
            document.add(pkgTable);

            // Passengers Manifest Table
            if (booking.getPassengers() != null && !booking.getPassengers().isEmpty()) {
                Paragraph manifestHeader = new Paragraph("REGISTERED PASSENGERS MANIFEST", subTitleFont);
                manifestHeader.setSpacingAfter(8);
                document.add(manifestHeader);

                PdfPTable passTable = new PdfPTable(2);
                passTable.setWidthPercentage(100);
                passTable.setSpacingAfter(15);

                PdfPCell cell1 = new PdfPCell(new Phrase("Full Legal Name", headerFont));
                cell1.setBackgroundColor(new Color(4, 120, 87));
                cell1.setPadding(6);
                passTable.addCell(cell1);

                PdfPCell cell2 = new PdfPCell(new Phrase("Passport Number", headerFont));
                cell2.setBackgroundColor(new Color(4, 120, 87));
                cell2.setPadding(6);
                passTable.addCell(cell2);

                for (Booking.PassengerDetail p : booking.getPassengers()) {
                    passTable.addCell(createCell(p.getFullName(), regularFont, true));
                    passTable.addCell(createCell(p.getPassportNumber(), regularFont, true));
                }
                document.add(passTable);
            }

            // Financial Summary
            Paragraph finHeader = new Paragraph("PAYMENT & PRICE SUMMARY", subTitleFont);
            finHeader.setSpacingAfter(8);
            document.add(finHeader);

            PdfPTable priceTable = new PdfPTable(2);
            priceTable.setWidthPercentage(100);
            priceTable.setSpacingAfter(20);

            priceTable.addCell(createCell("Travelers Count:", regularFont, true));
            priceTable.addCell(createCell(String.valueOf(booking.getTravelersCount()), regularFont, true));

            priceTable.addCell(createCell("Total Amount Paid:", boldFont, true));
            priceTable.addCell(createCell(String.format("INR %.2f (₹)", booking.getTotalPrice()), boldFont, true));

            document.add(priceTable);

            // Footer note
            Paragraph footer = new Paragraph("Thank you for booking your sacred journey with Umrah Trip Platform. May Allah accept your Umrah!", FontFactory.getFont(FontFactory.HELVETICA, 9, Font.ITALIC, Color.GRAY));
            footer.setAlignment(Element.ALIGN_CENTER);
            document.add(footer);

            document.close();
        } catch (DocumentException ex) {
            ex.printStackTrace();
        }

        return new ByteArrayInputStream(out.toByteArray());
    }

    private PdfPCell createCell(String text, Font font, boolean border) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setPadding(5);
        if (!border) {
            cell.setBorder(Rectangle.NO_BORDER);
        }
        return cell;
    }
}
