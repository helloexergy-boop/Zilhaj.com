package com.umrah.api.controller;

import com.umrah.api.dto.MessageResponse;
import com.umrah.api.model.Review;
import com.umrah.api.repository.ReviewRepository;
import com.umrah.api.security.UserDetailsImpl;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * ReviewController manages customer reviews and ratings for Umrah packages.
 * Endpoint base path: /api/reviews
 */
@RestController
@RequestMapping("/api/reviews")
@CrossOrigin(origins = "*")
public class ReviewController {

    @Autowired
    private ReviewRepository reviewRepository;

    /**
     * POST /api/reviews
     * Submits a customer review for an Umrah package.
     */
    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> createReview(@Valid @RequestBody Review review) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof UserDetailsImpl)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Error: Unauthorized"));
        }

        UserDetailsImpl currentUser = (UserDetailsImpl) auth.getPrincipal();
        review.setUserId(currentUser.getId());
        if (review.getUserName() == null || review.getUserName().isBlank()) {
            review.setUserName(currentUser.getName());
        }

        Review savedReview = reviewRepository.save(review);
        return ResponseEntity.ok(savedReview);
    }

    /**
     * GET /api/reviews/package/{packageId}
     * Retrieves all customer reviews for a given Umrah package ID.
     */
    @GetMapping("/package/{packageId}")
    public ResponseEntity<List<Review>> getReviewsByPackage(@PathVariable String packageId) {
        List<Review> reviews = reviewRepository.findByPackageId(packageId);
        return ResponseEntity.ok(reviews);
    }
}
