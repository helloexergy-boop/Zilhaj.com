package com.umrah.api.controller;

import com.umrah.api.dto.MessageResponse;
import com.umrah.api.model.Offer;
import com.umrah.api.model.UmrahPackage;
import com.umrah.api.repository.OfferRepository;
import com.umrah.api.repository.PackageRepository;
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
import java.util.Optional;

/**
 * Controller for dispatching and retrieving personalized travel offers.
 */
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class OfferController {

    @Autowired
    private OfferRepository offerRepository;

    @Autowired
    private PackageRepository packageRepository;

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
     * POST /api/admin/offers
     * Dispatches a personalized package offer to a target user. (Requires ROLE_ADMIN)
     */
    @PostMapping("/admin/offers")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> createOffer(@Valid @RequestBody Offer offer) {
        Optional<UmrahPackage> pkgOpt = packageRepository.findById(offer.getPackageId());
        if (pkgOpt.isPresent()) {
            UmrahPackage pkg = pkgOpt.get();
            offer.setPackageTitle(pkg.getTitle());
            offer.setOriginalPrice(pkg.getPrice());
            if (offer.getDiscountPercentage() > 0) {
                offer.setDiscountedPrice(pkg.getPrice() * (1.0 - (offer.getDiscountPercentage() / 100.0)));
            } else if (offer.getDiscountedPrice() > 0) {
                offer.setDiscountPercentage(((pkg.getPrice() - offer.getDiscountedPrice()) / pkg.getPrice()) * 100.0);
            }
        }

        Offer savedOffer = offerRepository.save(offer);
        return ResponseEntity.ok(savedOffer);
    }

    /**
     * GET /api/offers/user/{userId}
     * Retrieves personalized offers for a given user.
     */
    @GetMapping("/offers/user/{userId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getUserOffers(@PathVariable String userId) {
        UserDetailsImpl currentUser = getCurrentUser();
        if (currentUser == null || (!userId.equals(currentUser.getId()) && !isAdmin(currentUser))) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse("Error: Access denied"));
        }

        List<Offer> userOffers = offerRepository.findByUserId(userId);
        return ResponseEntity.ok(userOffers);
    }

    /**
     * GET /api/admin/offers
     * Retrieves all issued offers for administrative review.
     */
    @GetMapping("/admin/offers")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<Offer>> getAllOffers() {
        return ResponseEntity.ok(offerRepository.findAll());
    }
}
