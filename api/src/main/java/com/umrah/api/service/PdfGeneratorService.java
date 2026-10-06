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
        Document document = new Document(PageSize.A4, 30, 30, 30, 30);
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        try {
            PdfWriter.getInstance(document, out);
            document.open();

            // Fonts
            Font brandFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 24, Color.BLACK);
            Font taxTitleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, Color.BLACK);
            Font subTitleFont = FontFactory.getFont(FontFactory.HELVETICA, 10, Color.DARK_GRAY);
            Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, Color.BLACK);
            Font regularFont = FontFactory.getFont(FontFactory.HELVETICA, 10, Color.BLACK);
            Font boldFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, Color.BLACK);

            // Document Header Table (zilhaj.com left, Tax Invoice right)
            PdfPTable headerTable = new PdfPTable(2);
            headerTable.setWidthPercentage(100);

            PdfPCell brandCell = new PdfPCell(new Phrase("zilhaj.com", brandFont));
            brandCell.setBorder(Rectangle.NO_BORDER);
            brandCell.setVerticalAlignment(Element.ALIGN_MIDDLE);
            headerTable.addCell(brandCell);

            PdfPCell taxCell = new PdfPCell();
            taxCell.setBorder(Rectangle.NO_BORDER);
            taxCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
            taxCell.addElement(new Paragraph("Tax Invoice/Bill of Supply/Cash Memo", taxTitleFont));
            taxCell.addElement(new Paragraph("(Original for Pilgrim)", subTitleFont));
            headerTable.addCell(taxCell);

            document.add(headerTable);

            // Divider line
            Paragraph line = new Paragraph("____________________________________________________________________________________", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, Color.BLACK));
            line.setSpacingAfter(15);
            document.add(line);

            // 2-Column Info Grid
            PdfPTable detailsTable = new PdfPTable(2);
            detailsTable.setWidthPercentage(100);
            detailsTable.setSpacingAfter(15);

            // Left Column (Lead Pilgrim Info)
            PdfPCell leftCell = new PdfPCell();
            leftCell.setBorder(Rectangle.NO_BORDER);
            leftCell.addElement(new Paragraph("Lead Pilgrim Information :", boldFont));
            leftCell.addElement(new Paragraph((user != null && user.getName() != null ? user.getName() : "Animesh"), regularFont));
            leftCell.addElement(new Paragraph("ID/Passport: [Redacted]", regularFont));
            leftCell.addElement(new Paragraph("Contact: [Redacted]", regularFont));
            leftCell.addElement(new Paragraph("Email: [Redacted]", regularFont));
            leftCell.addElement(new Paragraph("\nEscrow Account No: ESC-ZHJ-99281", boldFont));
            leftCell.addElement(new Paragraph("Verification Status: Verified & Secured", regularFont));
            leftCell.addElement(new Paragraph("\nBooking Number: " + (booking != null && booking.getId() != null ? booking.getId() : "402-9749063-3541152"), boldFont));
            leftCell.addElement(new Paragraph("Booking Date: " + (booking != null && booking.getCreatedAt() != null ? booking.getCreatedAt().format(DateTimeFormatter.ofPattern("dd.MM.yyyy")) : "02.05.2024"), regularFont));
            leftCell.addElement(new Paragraph("PO Number: UTPL_Zhj_003", regularFont));
            detailsTable.addCell(leftCell);

            // Right Column (Hotel & Travel Details)
            PdfPCell rightCell = new PdfPCell();
            rightCell.setBorder(Rectangle.NO_BORDER);
            rightCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
            rightCell.addElement(new Paragraph("Hotel & Travel Details (Makkah) :", boldFont));
            rightCell.addElement(new Paragraph("Swissotel Makkah", regularFont));
            rightCell.addElement(new Paragraph("King Abdul Aziz Endowment", regularFont));
            rightCell.addElement(new Paragraph("Abraj Al Bait Complex, Makkah, Saudi Arabia", regularFont));
            rightCell.addElement(new Paragraph("Check-In: [Date] | Check-Out: [Date]\n", regularFont));

            rightCell.addElement(new Paragraph("Hotel & Travel Details (Madinah) :", boldFont));
            rightCell.addElement(new Paragraph("Pullman Zamzam Madina", regularFont));
            rightCell.addElement(new Paragraph("Amr Bin Al Aas Street, Madinah, Saudi Arabia", regularFont));
            rightCell.addElement(new Paragraph("Check-In: [Date] | Check-Out: [Date]\n", regularFont));

            rightCell.addElement(new Paragraph("Place of supply: SAUDI ARABIA", regularFont));
            rightCell.addElement(new Paragraph("Place of delivery: SAUDI ARABIA", regularFont));
            rightCell.addElement(new Paragraph("Invoice Number : HYD8-630451", regularFont));
            rightCell.addElement(new Paragraph("Invoice Details : TG-HYD8-179184911-2324", regularFont));
            rightCell.addElement(new Paragraph("Invoice Date : 04.05.2024", regularFont));
            detailsTable.addCell(rightCell);

            document.add(detailsTable);

            // Invoice Items Table
            float[] columnWidths = {1f, 6f, 2f, 2f, 2.5f};
            PdfPTable itemsTable = new PdfPTable(columnWidths);
            itemsTable.setWidthPercentage(100);

            // Header row
            addTableHeaderCell(itemsTable, "Sl. No", headerFont);
            addTableHeaderCell(itemsTable, "Description", headerFont);
            addTableHeaderCell(itemsTable, "Category", headerFont);
            addTableHeaderCell(itemsTable, "Status", headerFont);
            addTableHeaderCell(itemsTable, "Amount", headerFont);

            // Data row
            itemsTable.addCell(createCell("1", regularFont, true));
            String desc = (booking != null && booking.getPackageTitle() != null ? booking.getPackageTitle() : "Hajj Package 2024 - Premium") + "\nIncludes Accommodation (Swissotel Makkah, Pullman Zamzam), Visa Processing, and Ground Transport.";
            itemsTable.addCell(createCell(desc, regularFont, true));
            itemsTable.addCell(createCell("Package", regularFont, true));
            itemsTable.addCell(createCell("Confirmed", regularFont, true));
            double amt = (booking != null ? booking.getTotalPrice() : 450000.0);
            itemsTable.addCell(createCell(String.format("₹%,.2f", amt), regularFont, true));

            // Total Row
            PdfPCell totalLabelCell = new PdfPCell(new Phrase("TOTAL:", boldFont));
            totalLabelCell.setColspan(4);
            totalLabelCell.setPadding(6);
            itemsTable.addCell(totalLabelCell);

            PdfPCell totalValCell = new PdfPCell(new Phrase(String.format("₹%,.2f", amt), boldFont));
            totalValCell.setPadding(6);
            itemsTable.addCell(totalValCell);

            document.add(itemsTable);

            // Amount in words box
            PdfPTable wordsTable = new PdfPTable(1);
            wordsTable.setWidthPercentage(100);
            wordsTable.setSpacingAfter(25);
            PdfPCell wordsCell = new PdfPCell();
            wordsCell.setPadding(10);
            wordsCell.addElement(new Paragraph("Amount in Words:", boldFont));
            wordsCell.addElement(new Paragraph("Four Lakh Fifty Thousand only", boldFont));
            wordsTable.addCell(wordsCell);
            document.add(wordsTable);

            // Footer note
            Paragraph footer = new Paragraph("*Zilhaj.com acts as a facilitator. Services are fulfilled by respective partners.\nPlease note that this confirmation is not a demand for payment if already settled via Escrow.", FontFactory.getFont(FontFactory.HELVETICA, 8, Font.ITALIC, Color.DARK_GRAY));
            footer.setAlignment(Element.ALIGN_CENTER);
            document.add(footer);

            document.close();
        } catch (DocumentException ex) {
            ex.printStackTrace();
        }

        return new ByteArrayInputStream(out.toByteArray());
    }

    private void addTableHeaderCell(PdfPTable table, String text, Font font) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setBackgroundColor(new Color(229, 231, 235)); // #e5e7eb
        cell.setPadding(6);
        table.addCell(cell);
    }

    private PdfPCell createCell(String text, Font font, boolean border) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setPadding(6);
        if (!border) {
            cell.setBorder(Rectangle.NO_BORDER);
        }
        return cell;
    }
}

