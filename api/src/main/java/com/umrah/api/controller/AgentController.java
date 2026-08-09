package com.umrah.api.controller;

import com.umrah.api.dto.MessageResponse;
import com.umrah.api.model.Agent;
import com.umrah.api.repository.AgentRepository;
import com.umrah.api.security.UserDetailsImpl;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/agents")
@CrossOrigin(origins = "*")
public class AgentController {

    @Autowired
    private AgentRepository agentRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

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

    @PostMapping("/register")
    public ResponseEntity<?> registerAgent(@Valid @RequestBody Agent agent) {
        if (agentRepository.findByEmail(agent.getEmail()).isPresent()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Email already registered"));
        }

        agent.setPasswordHash(passwordEncoder.encode(agent.getPasswordHash()));
        agent.setRole("ROLE_AGENT");
        agent.setVerified(false);
        agent.setActive(true);
        agent.setRating(0.0);
        agent.setTotalReviews(0);
        agent.setTotalBookings(0);
        agent.setCreatedAt(LocalDateTime.now());
        agent.setUpdatedAt(LocalDateTime.now());

        Agent saved = agentRepository.save(agent);
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/login")
    public ResponseEntity<?> loginAgent(@RequestBody Agent loginRequest) {
        Optional<Agent> agentOpt = agentRepository.findByEmail(loginRequest.getEmail());
        if (agentOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Error: Invalid credentials"));
        }

        Agent agent = agentOpt.get();
        if (!passwordEncoder.matches(loginRequest.getPasswordHash(), agent.getPasswordHash())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Error: Invalid credentials"));
        }

        if (!agent.isVerified()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse("Error: Agent not verified. Please wait for admin approval."));
        }

        if (!agent.isActive()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse("Error: Agent account is deactivated"));
        }

        agent.setLastLoginAt(LocalDateTime.now());
        agentRepository.save(agent);

        return ResponseEntity.ok(agent);
    }

    @GetMapping("/profile")
    @PreAuthorize("hasRole('AGENT')")
    public ResponseEntity<?> getProfile() {
        UserDetailsImpl currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Error: Unauthorized"));
        }

        Optional<Agent> agentOpt = agentRepository.findByEmail(currentUser.getEmail());
        if (agentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(agentOpt.get());
    }

    @PutMapping("/profile")
    @PreAuthorize("hasRole('AGENT')")
    public ResponseEntity<?> updateProfile(@RequestBody Agent updatedAgent) {
        UserDetailsImpl currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Error: Unauthorized"));
        }

        Optional<Agent> agentOpt = agentRepository.findByEmail(currentUser.getEmail());
        if (agentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Agent agent = agentOpt.get();
        agent.setName(updatedAgent.getName());
        agent.setPhone(updatedAgent.getPhone());
        agent.setCompanyName(updatedAgent.getCompanyName());
        agent.setAddress(updatedAgent.getAddress());
        agent.setCity(updatedAgent.getCity());
        agent.setState(updatedAgent.getState());
        agent.setGstNumber(updatedAgent.getGstNumber());
        agent.setBankAccountNumber(updatedAgent.getBankAccountNumber());
        agent.setBankIfsc(updatedAgent.getBankIfsc());
        agent.setBankAccountHolderName(updatedAgent.getBankAccountHolderName());
        agent.setPanNumber(updatedAgent.getPanNumber());
        agent.setServiceAreas(updatedAgent.getServiceAreas());
        agent.setSpecializations(updatedAgent.getSpecializations());
        agent.setDescription(updatedAgent.getDescription());
        agent.setProfileImageUrl(updatedAgent.getProfileImageUrl());
        agent.setCoverImageUrl(updatedAgent.getCoverImageUrl());
        agent.setUpdatedAt(LocalDateTime.now());

        Agent saved = agentRepository.save(agent);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/verified")
    public ResponseEntity<List<Agent>> getVerifiedAgents() {
        List<Agent> agents = agentRepository.findByVerifiedTrueAndActiveTrue();
        return ResponseEntity.ok(agents);
    }

    @GetMapping("/verified/{specialization}")
    public ResponseEntity<List<Agent>> getVerifiedAgentsBySpecialization(@PathVariable String specialization) {
        List<Agent> agents = agentRepository.findByVerifiedTrueAndActiveTrueAndSpecializationsContaining(specialization.toUpperCase());
        return ResponseEntity.ok(agents);
    }

    @GetMapping("/admin/all")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<Agent>> getAllAgents() {
        return ResponseEntity.ok(agentRepository.findAll());
    }

    @PutMapping("/admin/{id}/verify")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> verifyAgent(@PathVariable String id, @RequestParam boolean verified) {
        Optional<Agent> agentOpt = agentRepository.findById(id);
        if (agentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Agent agent = agentOpt.get();
        agent.setVerified(verified);
        agent.setUpdatedAt(LocalDateTime.now());
        agentRepository.save(agent);
        return ResponseEntity.ok(agent);
    }

    @PutMapping("/admin/{id}/toggle-active")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> toggleAgentActive(@PathVariable String id, @RequestParam boolean active) {
        Optional<Agent> agentOpt = agentRepository.findById(id);
        if (agentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Agent agent = agentOpt.get();
        agent.setActive(active);
        agent.setUpdatedAt(LocalDateTime.now());
        agentRepository.save(agent);
        return ResponseEntity.ok(agent);
    }
}