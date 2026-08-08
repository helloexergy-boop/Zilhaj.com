package com.umrah.api.controller;

import com.razorpay.Order;
import com.umrah.api.dto.MessageResponse;
import com.umrah.api.model.Booking;
import com.umrah.api.model.Payment;
import com.umrah.api.repository.BookingRepository;
import com.umrah.api.repository.PaymentRepository;
import com.umrah.api.security.UserDetailsImpl;
import com.umrah.api.service.RazorPayService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * PaymentController handles payment processing, checkout completion, Razorpay order creation & signature verification,
 * and payment receipt retrieval.
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

    @Autowired
    private RazorPayService razorPayService;

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
     * POST /api/payments/razorpay/create-order
     * Generates a Razorpay Order ID for standard checkout popup (UPI, Cards, NetBanking, Wallets).
     */
    @PostMapping("/razorpay/create-order")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> createRazorpayOrder(@RequestBody Map<String, Object> request) {
        UserDetailsImpl currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Error: Unauthorized"));
        }

        String bookingId = (String) request.get("bookingId");
        if (bookingId == null || bookingId.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Booking ID is required"));
        }

        Optional<Booking> bookingOpt = bookingRepository.findById(bookingId);
        if (bookingOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Associated Booking ID not found"));
        }

        Booking booking = bookingOpt.get();
        if (!booking.getUserId().equals(currentUser.getId()) && !isAdmin(currentUser)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse("Error: Access denied to pay for this booking"));
        }

        try {
            double amount = booking.getTotalPrice();
            if (request.containsKey("amount") && request.get("amount") != null) {
                amount = Double.parseDouble(request.get("amount").toString());
            }

            Order order = razorPayService.createOrder(amount, "INR", "rec_" + bookingId.substring(0, Math.min(bookingId.length(), 10)));

            Map<String, Object> response = new HashMap<>();
            response.put("orderId", order.get("id"));
            response.put("amount", order.get("amount"));
            response.put("currency", order.get("currency"));
            response.put("key", razorPayService.getApiKey());
            response.put("bookingId", bookingId);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new MessageResponse("Error creating Razorpay order: " + e.getMessage()));
        }
    }

    /**
     * POST /api/payments/razorpay/verify-payment
     * Verifies the Razorpay payment HMAC-SHA256 signature, updates payment and booking status to CONFIRMED.
     */
    @PostMapping("/razorpay/verify-payment")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> verifyRazorpayPayment(@RequestBody Map<String, String> request) {
        UserDetailsImpl currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Error: Unauthorized"));
        }

        String bookingId = request.get("bookingId");
        String razorpayOrderId = request.get("razorpayOrderId");
        String razorpayPaymentId = request.get("razorpayPaymentId");
        String razorpaySignature = request.get("razorpaySignature");
        String paymentMethod = request.getOrDefault("paymentMethod", "RAZORPAY");

        if (bookingId == null || razorpayOrderId == null || razorpayPaymentId == null || razorpaySignature == null) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Missing payment verification parameters"));
        }

        Optional<Booking> bookingOpt = bookingRepository.findById(bookingId);
        if (bookingOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Associated Booking ID not found"));
        }

        Booking booking = bookingOpt.get();
        if (!booking.getUserId().equals(currentUser.getId()) && !isAdmin(currentUser)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse("Error: Access denied"));
        }

        // Signature verification
        boolean isValid = razorPayService.verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
        if (!isValid) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Invalid Razorpay payment signature verification failed"));
        }

        // Record successful payment
        Payment payment = new Payment();
        payment.setBookingId(bookingId);
        payment.setUserId(currentUser.getId());
        payment.setAmount(booking.getTotalPrice());
        payment.setPaymentMethod(paymentMethod.toUpperCase());
        payment.setTransactionId(razorpayPaymentId);
        payment.setStatus("SUCCESS");

        Payment savedPayment = paymentRepository.save(payment);

        // Update booking status to CONFIRMED
        booking.setStatus("CONFIRMED");
        bookingRepository.save(booking);

        return ResponseEntity.ok(savedPayment);
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
