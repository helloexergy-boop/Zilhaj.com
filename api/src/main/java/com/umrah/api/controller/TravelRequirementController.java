package com.umrah.api.controller;

import com.umrah.api.dto.MessageResponse;
import com.umrah.api.model.TravelRequirement;
import com.umrah.api.repository.TravelRequirementRepository;
import com.umrah.api.security.UserDetailsImpl;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/travel-requirements")
@CrossOrigin(origins = "*")
public class TravelRequirementController {

    @Autowired
    private TravelRequirementRepository requirementRepository;

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

    private boolean isAgent(UserDetailsImpl user) {
        return user != null && user.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_AGENT"));
    }

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> submitRequirement(@Valid @RequestBody TravelRequirement requirement) {
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
        if (requirement.getUserPhone() == null || requirement.getUserPhone().isBlank()) {
            requirement.setUserPhone(currentUser.getPhone() != null ? currentUser.getPhone() : "");
        }

        requirement.setTotalTravelers(requirement.getMaleCount() + requirement.getFemaleCount() + requirement.getChildrenCount());
        requirement.setTotalMaxBudget(requirement.getMaxBudgetPerPerson() * requirement.getTotalTravelers());

        requirement.setStatus("PENDING");
        requirement.setCreatedAt(LocalDateTime.now());
        requirement.setUpdatedAt(LocalDateTime.now());
        requirement.setExpiresAt(LocalDateTime.now().plusDays(30));

        TravelRequirement saved = requirementRepository.save(requirement);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/my")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getMyRequirements() {
        UserDetailsImpl currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Error: Unauthorized"));
        }

        List<TravelRequirement> requirements = requirementRepository.findByUserId(currentUser.getId());
        return ResponseEntity.ok(requirements);
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getRequirement(@PathVariable String id) {
        UserDetailsImpl currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Error: Unauthorized"));
        }

        Optional<TravelRequirement> reqOpt = requirementRepository.findById(id);
        if (reqOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        TravelRequirement req = reqOpt.get();
        if (!req.getUserId().equals(currentUser.getId()) && !isAdmin(currentUser) && !isAgent(currentUser)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse("Error: Access denied"));
        }

        return ResponseEntity.ok(req);
    }

    @GetMapping("/open")
    @PreAuthorize("hasRole('AGENT') or hasRole('ADMIN')")
    public ResponseEntity<?> getOpenRequirements() {
        List<TravelRequirement> requirements = requirementRepository.findOpenRequirements(LocalDateTime.now());
        return ResponseEntity.ok(requirements);
    }

    @PutMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateStatus(@PathVariable String id, @RequestParam String status) {
        Optional<TravelRequirement> reqOpt = requirementRepository.findById(id);
        if (reqOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        TravelRequirement req = reqOpt.get();
        req.setStatus(status.toUpperCase());
        req.setUpdatedAt(LocalDateTime.now());
        requirementRepository.save(req);
        return ResponseEntity.ok(req);
    }

    @PutMapping("/{id}/award")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> awardRequirement(@PathVariable String id, @RequestParam String agentId, @RequestParam String offerId) {
        UserDetailsImpl currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Error: Unauthorized"));
        }

        Optional<TravelRequirement> reqOpt = requirementRepository.findById(id);
        if (reqOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        TravelRequirement req = reqOpt.get();
        if (!req.getUserId().equals(currentUser.getId()) && !isAdmin(currentUser)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse("Error: Only the requirement owner or admin can award"));
        }

        req.setStatus("AWARDED");
        req.setAwardedAgentId(agentId);
        req.setAwardedOfferId(offerId);
        req.setUpdatedAt(LocalDateTime.now());
        requirementRepository.save(req);
        return ResponseEntity.ok(req);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> cancelRequirement(@PathVariable String id) {
        UserDetailsImpl currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Error: Unauthorized"));
        }

        Optional<TravelRequirement> reqOpt = requirementRepository.findById(id);
        if (reqOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        TravelRequirement req = reqOpt.get();
        if (!req.getUserId().equals(currentUser.getId()) && !isAdmin(currentUser)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse("Error: Access denied"));
        }

        req.setStatus("CANCELLED");
        req.setUpdatedAt(LocalDateTime.now());
        requirementRepository.save(req);
        return ResponseEntity.ok(req);
    }

    @GetMapping("/admin/all")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<TravelRequirement>> getAllRequirements() {
        return ResponseEntity.ok(requirementRepository.findAll());
    }
}