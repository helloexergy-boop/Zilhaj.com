package com.umrah.api.controller;

import com.umrah.api.dto.MessageResponse;
import com.umrah.api.model.Requirement;
import com.umrah.api.repository.RequirementRepository;
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
 * Controller managing custom pilgrim travel package requirement submissions.
 */
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class RequirementController {

    @Autowired
    private RequirementRepository requirementRepository;

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
     * POST /api/requirements
     * Submits a custom travel package request from a pilgrim.
     */
    @PostMapping("/requirements")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> submitRequirement(@Valid @RequestBody Requirement requirement) {
        UserDetailsImpl currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Error: Unauthorized"));
        }

        requirement.setUserId(currentUser.getId());
        if (requirement.getUserName() == null || requirement.getUserName().isBlank()) {
            requirement.setUserName(currentUser.getName());
        }
        if (requirement.getUserEmail() == null || requirement.getUserEmail().isBlank()) {
            requirement.setUserEmail(currentUser.getEmail());
        }

        Requirement saved = requirementRepository.save(requirement);
        return ResponseEntity.ok(saved);
    }

    /**
     * GET /api/requirements/user/{userId}
     * Retrieves custom requirements submitted by a specific pilgrim.
     */
    @GetMapping("/requirements/user/{userId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getUserRequirements(@PathVariable String userId) {
        UserDetailsImpl currentUser = getCurrentUser();
        if (currentUser == null || (!userId.equals(currentUser.getId()) && !isAdmin(currentUser))) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse("Error: Access denied"));
        }

        List<Requirement> requirements = requirementRepository.findByUserId(userId);
        return ResponseEntity.ok(requirements);
    }

    /**
     * GET /api/admin/requirements
     * Retrieves all pilgrim custom package requirements for Admin matching. (Requires ROLE_ADMIN)
     */
    @GetMapping("/admin/requirements")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<Requirement>> getAllRequirements() {
        return ResponseEntity.ok(requirementRepository.findAll());
    }

    /**
     * PUT /api/admin/requirements/{id}/status
     * Updates status of a custom requirement request. (Requires ROLE_ADMIN)
     */
    @PutMapping("/admin/requirements/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateRequirementStatus(@PathVariable String id, @RequestParam String status) {
        Optional<Requirement> reqOpt = requirementRepository.findById(id);
        if (reqOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Requirement req = reqOpt.get();
        req.setStatus(status.toUpperCase());
        requirementRepository.save(req);
        return ResponseEntity.ok(req);
    }
}
