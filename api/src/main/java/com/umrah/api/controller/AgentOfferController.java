package com.umrah.api.controller;

import com.umrah.api.dto.MessageResponse;
import com.umrah.api.model.AgentOffer;
import com.umrah.api.model.TravelRequirement;
import com.umrah.api.repository.AgentOfferRepository;
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
@RequestMapping("/api/agent-offers")
@CrossOrigin(origins = "*")
public class AgentOfferController {

    @Autowired
    private AgentOfferRepository offerRepository;

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
    @PreAuthorize("hasRole('AGENT')")
    public ResponseEntity<?> submitOffer(@Valid @RequestBody AgentOffer offer) {
        UserDetailsImpl currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Error: Unauthorized"));
        }

        Optional<TravelRequirement> reqOpt = requirementRepository.findById(offer.getRequirementId());
        if (reqOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Requirement not found"));
        }

        TravelRequirement req = reqOpt.get();
        if (!req.getStatus().equals("OPEN_FOR_BIDS") && !req.getStatus().equals("PENDING")) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: This requirement is not open for bids"));
        }

        offer.setAgentId(currentUser.getId());
        offer.setAgentName(currentUser.getName());
        offer.setStatus("PENDING");
        offer.setUserResponse("PENDING");
        offer.setCreatedAt(LocalDateTime.now());
        offer.setUpdatedAt(LocalDateTime.now());

        if (offer.getTotalPrice() == 0 && offer.getPricePerPerson() > 0 && req.getTotalTravelers() > 0) {
            offer.setTotalPrice(offer.getPricePerPerson() * req.getTotalTravelers());
        } else if (offer.getPricePerPerson() == 0 && offer.getTotalPrice() > 0 && req.getTotalTravelers() > 0) {
            offer.setPricePerPerson(offer.getTotalPrice() / req.getTotalTravelers());
        }

        if (offer.getOriginalPrice() == 0) {
            offer.setOriginalPrice(offer.getTotalPrice());
        }

        if (offer.getDiscountPercentage() > 0) {
            offer.setTotalPrice(offer.getOriginalPrice() * (1.0 - (offer.getDiscountPercentage() / 100.0)));
            offer.setPricePerPerson(offer.getTotalPrice() / req.getTotalTravelers());
        } else if (offer.getOriginalPrice() > offer.getTotalPrice()) {
            offer.setDiscountPercentage(((offer.getOriginalPrice() - offer.getTotalPrice()) / offer.getOriginalPrice()) * 100.0);
        }

        AgentOffer saved = offerRepository.save(offer);

        req.setStatus("BIDS_RECEIVED");
        req.setUpdatedAt(LocalDateTime.now());
        requirementRepository.save(req);

        return ResponseEntity.ok(saved);
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('AGENT')")
    public ResponseEntity<?> getMyOffers() {
        UserDetailsImpl currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Error: Unauthorized"));
        }

        List<AgentOffer> offers = offerRepository.findByAgentId(currentUser.getId());
        return ResponseEntity.ok(offers);
    }

    @GetMapping("/requirement/{requirementId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getOffersForRequirement(@PathVariable String requirementId) {
        UserDetailsImpl currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Error: Unauthorized"));
        }

        Optional<TravelRequirement> reqOpt = requirementRepository.findById(requirementId);
        if (reqOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        TravelRequirement req = reqOpt.get();
        if (!req.getUserId().equals(currentUser.getId()) && !isAdmin(currentUser) && !isAgent(currentUser)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse("Error: Access denied"));
        }

        List<AgentOffer> offers = offerRepository.findByRequirementIdAndStatus(requirementId, "PENDING");
        return ResponseEntity.ok(offers);
    }

    @PutMapping("/{id}/respond")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> respondToOffer(@PathVariable String id, @RequestParam String response) {
        UserDetailsImpl currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Error: Unauthorized"));
        }

        Optional<AgentOffer> offerOpt = offerRepository.findById(id);
        if (offerOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        AgentOffer offer = offerOpt.get();

        Optional<TravelRequirement> reqOpt = requirementRepository.findById(offer.getRequirementId());
        if (reqOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        TravelRequirement req = reqOpt.get();
        if (!req.getUserId().equals(currentUser.getId()) && !isAdmin(currentUser)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse("Error: Only the requirement owner can respond to offers"));
        }

        if (!response.equalsIgnoreCase("ACCEPTED") && !response.equalsIgnoreCase("REJECTED")) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Invalid response. Must be ACCEPTED or REJECTED"));
        }

        offer.setUserResponse(response.toUpperCase());
        offer.setRespondedAt(LocalDateTime.now());
        offer.setUpdatedAt(LocalDateTime.now());
        offerRepository.save(offer);

        if (response.equalsIgnoreCase("ACCEPTED")) {
            req.setStatus("AWARDED");
            req.setAwardedAgentId(offer.getAgentId());
            req.setAwardedOfferId(offer.getId());
            req.setUpdatedAt(LocalDateTime.now());
            requirementRepository.save(req);

            List<AgentOffer> otherOffers = offerRepository.findByRequirementIdAndStatus(offer.getRequirementId(), "PENDING");
            for (AgentOffer other : otherOffers) {
                if (!other.getId().equals(offer.getId())) {
                    other.setStatus("REJECTED");
                    other.setUserResponse("REJECTED");
                    other.setRespondedAt(LocalDateTime.now());
                    other.setUpdatedAt(LocalDateTime.now());
                    offerRepository.save(other);
                }
            }
        }

        return ResponseEntity.ok(offer);
    }

    @PutMapping("/{id}/withdraw")
    @PreAuthorize("hasRole('AGENT')")
    public ResponseEntity<?> withdrawOffer(@PathVariable String id) {
        UserDetailsImpl currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Error: Unauthorized"));
        }

        Optional<AgentOffer> offerOpt = offerRepository.findById(id);
        if (offerOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        AgentOffer offer = offerOpt.get();
        if (!offer.getAgentId().equals(currentUser.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse("Error: Access denied"));
        }

        offer.setStatus("WITHDRAWN");
        offer.setUpdatedAt(LocalDateTime.now());
        offerRepository.save(offer);

        return ResponseEntity.ok(offer);
    }

    @GetMapping("/admin/all")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<AgentOffer>> getAllOffers() {
        return ResponseEntity.ok(offerRepository.findAll());
    }
}