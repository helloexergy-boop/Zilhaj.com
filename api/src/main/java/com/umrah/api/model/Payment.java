package com.umrah.api.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * Payment Document stored in MongoDB under the 'payments' collection.
 * Tracks payment receipts, transaction IDs, payment gateways (Stripe, Razorpay, Cards, UPI), and payment statuses.
 */
@Document(collection = "payments")
public class Payment {

    // Unique MongoDB Document Identifier for this payment transaction
    @Id
    private String id;

    // Foreign key reference to the associated Booking ID
    private String bookingId;

    // Foreign key reference to the User making the payment
    private String userId;

    // Payment transaction amount in USD/local currency
    private double amount;

    // Payment gateway method chosen: STRIPE, RAZORPAY, CARD, or UPI
    private String paymentMethod;

    // Unique reference / transaction ID returned by payment provider (e.g. txn_1M89X23)
    private String transactionId;

    // Status of the payment transaction: SUCCESS, FAILED, or PENDING
    private String status = "PENDING";

    // Timestamp when payment transaction occurred
    private LocalDateTime createdAt = LocalDateTime.now();

    // Default constructor
    public Payment() {}

    // Parametrized constructor
    public Payment(String bookingId, String userId, double amount, String paymentMethod, String transactionId, String status) {
        this.bookingId = bookingId;
        this.userId = userId;
        this.amount = amount;
        this.paymentMethod = paymentMethod;
        this.transactionId = transactionId;
        this.status = status;
        this.createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getBookingId() { return bookingId; }
    public void setBookingId(String bookingId) { this.bookingId = bookingId; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public double getAmount() { return amount; }
    public void setAmount(double amount) { this.amount = amount; }

    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }

    public String getTransactionId() { return transactionId; }
    public void setTransactionId(String transactionId) { this.transactionId = transactionId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
