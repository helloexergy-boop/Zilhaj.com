package com.umrah.api.controller;

import com.umrah.api.dto.MessageResponse;
import com.umrah.api.model.Booking;
import com.umrah.api.model.Payment;
import com.umrah.api.repository.BookingRepository;
import com.umrah.api.repository.PaymentRepository;
import com.umrah.api.security.UserDetailsImpl;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;
import java.util.UUID;

/**
 * PaymentController handles payment processing, checkout completion, and payment receipt retrieval.
 * Endpoint base path: /api/payments
 */
@RestController
@RequestMapping("/api/payments")
@CrossOrigin(origins = "*")
public class PaymentController {

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private BookingRepository bookingRepository;

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
     * POST /api/payments/checkout
     * Initiates and confirms a payment checkout transaction for a booking.
     */
    @PostMapping("/checkout")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> processPaymentCheckout(@Valid @RequestBody Payment payment) {
        UserDetailsImpl currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Error: Unauthorized"));
        }

        Optional<Booking> bookingOpt = bookingRepository.findById(payment.getBookingId());
        if (bookingOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Associated Booking ID not found"));
        }

        Booking booking = bookingOpt.get();

        // Ownership Verification: User can only make payment for their own booking unless Admin
        if (!booking.getUserId().equals(currentUser.getId()) && !isAdmin(currentUser)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse("Error: Access denied to pay for this booking"));
        }

        payment.setUserId(currentUser.getId());
        String method = payment.getPaymentMethod() != null ? payment.getPaymentMethod().toUpperCase() : "CARD";
        String txnId = "TXN-" + method + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        payment.setTransactionId(txnId);
        payment.setStatus("SUCCESS");
        payment.setAmount(booking.getTotalPrice());

        Payment savedPayment = paymentRepository.save(payment);

        // Transition booking status to CONFIRMED
        booking.setStatus("CONFIRMED");
        bookingRepository.save(booking);

        return ResponseEntity.ok(savedPayment);
    }

    /**
     * GET /api/payments/{id}
     * Retrieves payment transaction receipt by Payment Document ID.
     */
    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getPaymentById(@PathVariable String id) {
        UserDetailsImpl currentUser = getCurrentUser();
        Optional<Payment> paymentOpt = paymentRepository.findById(id);
        if (paymentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Payment payment = paymentOpt.get();
        if (currentUser == null || (!payment.getUserId().equals(currentUser.getId()) && !isAdmin(currentUser))) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse("Error: Access denied"));
        }
        return ResponseEntity.ok(payment);
    }

    /**
     * GET /api/payments/booking/{bookingId}
     * Retrieves payment record linked to a specific Booking ID.
     */
    @GetMapping("/booking/{bookingId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getPaymentByBookingId(@PathVariable String bookingId) {
        UserDetailsImpl currentUser = getCurrentUser();
        Optional<Payment> paymentOpt = paymentRepository.findByBookingId(bookingId);
        if (paymentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Payment payment = paymentOpt.get();
        if (currentUser == null || (!payment.getUserId().equals(currentUser.getId()) && !isAdmin(currentUser))) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse("Error: Access denied"));
        }
        return ResponseEntity.ok(payment);
    }
}
