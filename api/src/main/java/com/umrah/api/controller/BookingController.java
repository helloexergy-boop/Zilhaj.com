package com.umrah.api.controller;

import com.umrah.api.dto.MessageResponse;
import com.umrah.api.model.Booking;
import com.umrah.api.model.UmrahPackage;
import com.umrah.api.repository.BookingRepository;
import com.umrah.api.repository.PackageRepository;
import com.umrah.api.security.UserDetailsImpl;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

/**
 * BookingController manages customer trip bookings, passenger details registration, status updates, and cancellations.
 * Includes atomic MongoDB seat reservations to prevent concurrency race conditions and IDOR security checks.
 */
@RestController
@RequestMapping("/api/bookings")
@CrossOrigin(origins = "*")
public class BookingController {

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private PackageRepository packageRepository;

    @Autowired
    private MongoTemplate mongoTemplate;

    /**
     * Helper method to extract current authenticated user principal details.
     */
    private UserDetailsImpl getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserDetailsImpl) {
            return (UserDetailsImpl) auth.getPrincipal();
        }
        return null;
    }

    /**
     * Checks if current user is Admin.
     */
    private boolean isAdmin(UserDetailsImpl user) {
        return user != null && user.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }

    /**
     * POST /api/bookings
     * Creates a new booking reservation for an Umrah Package with atomic seat reduction.
     */
    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> createBooking(@Valid @RequestBody Booking booking) {
        UserDetailsImpl currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Error: Unauthorized"));
        }

        if (booking.getTravelersCount() <= 0) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Travelers count must be at least 1"));
        }

        // 1. Fetch package to calculate total price and store metadata
        Optional<UmrahPackage> pkgOpt = packageRepository.findById(booking.getPackageId());
        if (pkgOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Selected Umrah Package not found"));
        }
        UmrahPackage pkg = pkgOpt.get();

        // 2. Perform ATOMIC seat reservation in MongoDB to avoid race conditions under high concurrency
        Query query = new Query(Criteria.where("id").is(booking.getPackageId())
                .and("availableSeats").gte(booking.getTravelersCount()));
        Update update = new Update().inc("availableSeats", -booking.getTravelersCount());
        
        UmrahPackage updatedPkg = mongoTemplate.findAndModify(
                query, 
                update, 
                FindAndModifyOptions.options().returnNew(true), 
                UmrahPackage.class
        );

        if (updatedPkg == null) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Not enough available seats for this package"));
        }

        // 3. Bind user ID from authenticated security principal
        booking.setUserId(currentUser.getId());
        double totalPrice = pkg.getPrice() * booking.getTravelersCount();
        booking.setTotalPrice(totalPrice);
        booking.setPackageTitle(pkg.getTitle());
        booking.setAgentName(pkg.getAgentName());
        booking.setStatus("PENDING");

        Booking savedBooking = bookingRepository.save(booking);
        return ResponseEntity.ok(savedBooking);
    }

    /**
     * GET /api/bookings/{id}
     * Retrieves specific booking by Document ID. Enforces ownership authorization check.
     */
    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getBookingById(@PathVariable String id) {
        UserDetailsImpl currentUser = getCurrentUser();
        Optional<Booking> bookingOpt = bookingRepository.findById(id);
        
        if (bookingOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Booking booking = bookingOpt.get();
        // IDOR Prevention: User can only view their own booking unless they are Admin
        if (currentUser == null || (!booking.getUserId().equals(currentUser.getId()) && !isAdmin(currentUser))) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse("Error: Access denied to this booking"));
        }

        return ResponseEntity.ok(booking);
    }

    /**
     * GET /api/bookings/user/{userId}
     * Retrieves all bookings submitted by a specific user. Enforces ownership authorization check.
     */
    @GetMapping("/user/{userId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getBookingsByUser(@PathVariable String userId) {
        UserDetailsImpl currentUser = getCurrentUser();
        if (currentUser == null || (!userId.equals(currentUser.getId()) && !isAdmin(currentUser))) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse("Error: Access denied"));
        }

        List<Booking> userBookings = bookingRepository.findByUserId(userId);
        return ResponseEntity.ok(userBookings);
    }

    /**
     * PUT /api/bookings/{id}/cancel
     * Cancels an existing booking and atomically restores package available seats count.
     */
    @PutMapping("/{id}/cancel")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> cancelBooking(@PathVariable String id) {
        UserDetailsImpl currentUser = getCurrentUser();
        Optional<Booking> bookingOpt = bookingRepository.findById(id);
        
        if (bookingOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Booking booking = bookingOpt.get();
        // IDOR Prevention: User can only cancel their own booking unless they are Admin
        if (currentUser == null || (!booking.getUserId().equals(currentUser.getId()) && !isAdmin(currentUser))) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse("Error: Access denied to cancel this booking"));
        }

        if ("CANCELLED".equals(booking.getStatus())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Booking is already cancelled"));
        }

        booking.setStatus("CANCELLED");
        bookingRepository.save(booking);

        // Atomically restore package seats in MongoDB
        Query query = new Query(Criteria.where("id").is(booking.getPackageId()));
        Update update = new Update().inc("availableSeats", booking.getTravelersCount());
        mongoTemplate.updateFirst(query, update, UmrahPackage.class);

        return ResponseEntity.ok(booking);
    }
}
