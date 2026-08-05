package com.umrah.api.repository;

import com.umrah.api.model.Booking;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Spring Data Mongo Repository for Booking entity operations.
 */
@Repository
public interface BookingRepository extends MongoRepository<Booking, String> {

    // Finds all bookings made by a specific customer/user ID
    List<Booking> findByUserId(String userId);

    // Finds all bookings for packages owned by a specific travel agency
    List<Booking> findByPackageId(String packageId);

    // Finds all bookings by current status (e.g., PENDING, CONFIRMED, CANCELLED)
    List<Booking> findByStatus(String status);
}
