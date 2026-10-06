package com.umrah.api.controller;

import com.umrah.api.dto.MessageResponse;
import com.umrah.api.model.Agent;
import com.umrah.api.model.UmrahPackage;
import com.umrah.api.repository.AgentRepository;
import com.umrah.api.repository.PackageRepository;
import com.umrah.api.security.UserDetailsImpl;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

/**
 * PackageController manages Umrah travel package search, filtering, detail retrieval, creation, updating, and deletion.
 * Optimizes searching using MongoDB database queries and pagination, and enforces agent ownership security.
 */
@RestController
@RequestMapping("/api/packages")
@CrossOrigin(origins = "*")
public class PackageController {

    @Autowired
    private PackageRepository packageRepository;

    @Autowired
    private AgentRepository agentRepository;

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
     * GET /api/packages
     * Retrieves filtered Umrah packages using MongoDB database criteria queries and optional pagination.
     * @param maxPrice optional upper price limit filter
     * @param maxDistanceMakkah optional maximum distance in meters to Haram Makkah
     * @param flightsOnly optional boolean flag to filter packages including flights
     * @param page optional zero-indexed page number (default 0)
     * @param size optional page size (default 20)
     * @return List of matching Umrah Packages
     */
    @GetMapping
    public ResponseEntity<List<UmrahPackage>> getAllPackages(
            @RequestParam(required = false) Double maxPrice,
            @RequestParam(required = false) Integer maxDistanceMakkah,
            @RequestParam(required = false) Boolean flightsOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Query query = new Query();

        if (maxPrice != null && maxPrice > 0) {
            query.addCriteria(Criteria.where("price").lte(maxPrice));
        }

        if (maxDistanceMakkah != null && maxDistanceMakkah > 0) {
            query.addCriteria(Criteria.where("distanceToHaramMakkah").lte(maxDistanceMakkah));
        }

        if (flightsOnly != null && flightsOnly) {
            query.addCriteria(Criteria.where("includes.flights").is(true));
        }

        // Apply pagination
        Pageable pageable = PageRequest.of(page, size);
        query.with(pageable);

        List<UmrahPackage> packages = mongoTemplate.find(query, UmrahPackage.class);
        return ResponseEntity.ok(packages);
    }

    /**
     * GET /api/packages/{id}
     * Fetches single Umrah package by Document ID.
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getPackageById(@PathVariable String id) {
        return packageRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * POST /api/packages
     * Creates a new Umrah package listing. (Requires ROLE_AGENT or ROLE_ADMIN)
     */
    @PostMapping
    @PreAuthorize("hasRole('AGENT') or hasRole('ADMIN')")
    public ResponseEntity<?> createPackage(@Valid @RequestBody UmrahPackage umrahPackage) {
        UserDetailsImpl currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Error: Unauthorized"));
        }

        // Link package to agent entity if logged in as an Agent
        if (currentUser.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_AGENT"))) {
            Optional<Agent> agentOpt = agentRepository.findByUserId(currentUser.getId());
            if (agentOpt.isPresent()) {
                Agent agent = agentOpt.get();
                umrahPackage.setAgentId(agent.getId());
                umrahPackage.setAgentName(agent.getCompanyName());
            } else {
                umrahPackage.setAgentId(currentUser.getId());
                umrahPackage.setAgentName(currentUser.getName());
            }
        }

        UmrahPackage savedPackage = packageRepository.save(umrahPackage);
        return ResponseEntity.ok(savedPackage);
    }

    /**
     * PUT /api/packages/{id}
     * Updates an existing Umrah package listing. Enforces agent ownership check.
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('AGENT') or hasRole('ADMIN')")
    public ResponseEntity<?> updatePackage(@PathVariable String id, @Valid @RequestBody UmrahPackage updatedPackage) {
        UserDetailsImpl currentUser = getCurrentUser();
        Optional<UmrahPackage> existingOpt = packageRepository.findById(id);

        if (existingOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        UmrahPackage existing = existingOpt.get();

        // Ownership Verification: Agent can only modify their own packages unless Admin
        if (!isAdmin(currentUser)) {
            Optional<Agent> agentOpt = agentRepository.findByUserId(currentUser.getId());
            String currentAgentId = agentOpt.map(Agent::getId).orElse(currentUser.getId());
            if (!currentAgentId.equals(existing.getAgentId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(new MessageResponse("Error: You are not authorized to update this package"));
            }
        }

        existing.setTitle(updatedPackage.getTitle());
        existing.setDescription(updatedPackage.getDescription());
        existing.setPrice(updatedPackage.getPrice());
        existing.setDurationDays(updatedPackage.getDurationDays());
        existing.setDistanceToHaramMakkah(updatedPackage.getDistanceToHaramMakkah());
        existing.setDistanceToHaramMadinah(updatedPackage.getDistanceToHaramMadinah());
        existing.setHotelMakkahStars(updatedPackage.getHotelMakkahStars());
        existing.setHotelMadinahStars(updatedPackage.getHotelMadinahStars());
        existing.setIncludes(updatedPackage.getIncludes());
        existing.setItinerary(updatedPackage.getItinerary());
        existing.setAvailableSeats(updatedPackage.getAvailableSeats());
        if (updatedPackage.getImageUrls() != null && !updatedPackage.getImageUrls().isEmpty()) {
            existing.setImageUrls(updatedPackage.getImageUrls());
        }

        packageRepository.save(existing);
        return ResponseEntity.ok(existing);
    }

    /**
     * DELETE /api/packages/{id}
     * Deletes an Umrah package listing by ID. Enforces agent ownership check.
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('AGENT') or hasRole('ADMIN')")
    public ResponseEntity<?> deletePackage(@PathVariable String id) {
        UserDetailsImpl currentUser = getCurrentUser();
        Optional<UmrahPackage> existingOpt = packageRepository.findById(id);

        if (existingOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        UmrahPackage existing = existingOpt.get();

        // Ownership Verification: Agent can only delete their own packages unless Admin
        if (!isAdmin(currentUser)) {
            Optional<Agent> agentOpt = agentRepository.findByUserId(currentUser.getId());
            String currentAgentId = agentOpt.map(Agent::getId).orElse(currentUser.getId());
            if (!currentAgentId.equals(existing.getAgentId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(new MessageResponse("Error: You are not authorized to delete this package"));
            }
        }

        packageRepository.deleteById(id);
        return ResponseEntity.ok(new MessageResponse("Package deleted successfully!"));
    }
}
