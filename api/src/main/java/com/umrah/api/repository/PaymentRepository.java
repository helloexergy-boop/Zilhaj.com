package com.umrah.api.repository;

import com.umrah.api.model.Payment;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data Mongo Repository for Payment entity operations.
 */
@Repository
public interface PaymentRepository extends MongoRepository<Payment, String> {

    // Finds payment record by associated booking ID
    Optional<Payment> findByBookingId(String bookingId);

    // Finds payment records by user ID
    List<Payment> findByUserId(String userId);
}
