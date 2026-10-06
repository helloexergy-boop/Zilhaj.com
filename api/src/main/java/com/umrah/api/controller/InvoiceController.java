package com.umrah.api.controller;

import com.umrah.api.dto.MessageResponse;
import com.umrah.api.model.Booking;
import com.umrah.api.model.Payment;
import com.umrah.api.model.UmrahPackage;
import com.umrah.api.model.User;
import com.umrah.api.repository.BookingRepository;
import com.umrah.api.repository.PackageRepository;
import com.umrah.api.repository.PaymentRepository;
import com.umrah.api.repository.UserRepository;
import com.umrah.api.security.UserDetailsImpl;
import com.umrah.api.service.PdfGeneratorService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.io.ByteArrayInputStream;
import java.util.Optional;

/**
 * Controller for serving generated PDF Invoices and Travel Vouchers.
 */
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class InvoiceController {

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private PackageRepository packageRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PdfGeneratorService pdfGeneratorService;

    private UserDetailsImpl getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserDetailsImpl) {
            return (UserDetailsImpl) auth.getPrincipal();
        }
        return null;
    }

    private boolean isAdmin(UserDetailsImpl user) {
        return user != null && user.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }

    /**
     * GET /api/invoice/{bookingId}
     * Downloads PDF invoice and voucher for a specific booking.
     */
    @GetMapping("/invoice/{bookingId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> downloadInvoicePdf(@PathVariable String bookingId) {
        UserDetailsImpl currentUser = getCurrentUser();
        Optional<Booking> bookingOpt = bookingRepository.findById(bookingId);

        if (bookingOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Booking booking = bookingOpt.get();

        // Ownership Verification
        if (currentUser == null || (!booking.getUserId().equals(currentUser.getId()) && !isAdmin(currentUser))) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse("Error: Access denied to download invoice"));
        }

        Payment payment = paymentRepository.findByBookingId(bookingId).orElse(null);
        UmrahPackage pkg = packageRepository.findById(booking.getPackageId()).orElse(null);
        User user = userRepository.findById(booking.getUserId()).orElse(null);

        ByteArrayInputStream bis = pdfGeneratorService.generateInvoiceAndTicketPdf(booking, payment, pkg, user);

        HttpHeaders headers = new HttpHeaders();
        headers.add("Content-Disposition", "inline; filename=Umrah-Invoice-" + bookingId + ".pdf");

        return ResponseEntity
                .ok()
                .headers(headers)
                .contentType(MediaType.APPLICATION_PDF)
                .body(new InputStreamResource(bis));
    }
}
