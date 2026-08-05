package com.umrah.api.controller;

import com.umrah.api.dto.MessageResponse;
import com.umrah.api.model.Agent;
import com.umrah.api.model.Booking;
import com.umrah.api.model.User;
import com.umrah.api.repository.AgentRepository;
import com.umrah.api.repository.BookingRepository;
import com.umrah.api.repository.PackageRepository;
import com.umrah.api.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * AdminController provides administration endpoints for User & Agent management, Agent verification, package moderation, and analytics.
 * Endpoint base path: /api/admin
 */
@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = "*")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AgentRepository agentRepository;

    @Autowired
    private PackageRepository packageRepository;

    @Autowired
    private BookingRepository bookingRepository;

    /**
     * GET /api/admin/users
     * Retrieves all platform registered users. (Requires ROLE_ADMIN)
     */
    @GetMapping("/users")
    public ResponseEntity<List<User>> getAllUsers() {
        List<User> users = userRepository.findAll();
        users.forEach(u -> u.setPasswordHash(null)); // Mask password hashes
        return ResponseEntity.ok(users);
    }

    /**
     * GET /api/admin/agents
     * Retrieves all travel agents. (Requires ROLE_ADMIN)
     */
    @GetMapping("/agents")
    public ResponseEntity<List<Agent>> getAllAgents() {
        return ResponseEntity.ok(agentRepository.findAll());
    }

    /**
     * PUT /api/admin/agents/{agentId}/verify
     * Updates an agent's license verification status (VERIFIED or REJECTED). (Requires ROLE_ADMIN)
     * @param agentId Agent Document ID
     * @param status Query param (VERIFIED or REJECTED)
     */
    @PutMapping("/agents/{agentId}/verify")
    public ResponseEntity<?> verifyAgent(@PathVariable String agentId, @RequestParam String status) {
        return agentRepository.findById(agentId).map(agent -> {
            agent.setVerificationStatus(status.toUpperCase());
            agentRepository.save(agent);
            return ResponseEntity.ok(agent);
        }).orElse(ResponseEntity.notFound().build());
    }

    /**
     * DELETE /api/admin/packages/{packageId}
     * Administrative moderation removal of an Umrah package listing. (Requires ROLE_ADMIN)
     */
    @DeleteMapping("/packages/{packageId}")
    public ResponseEntity<?> deletePackageByAdmin(@PathVariable String packageId) {
        if (!packageRepository.existsById(packageId)) {
            return ResponseEntity.notFound().build();
        }
        packageRepository.deleteById(packageId);
        return ResponseEntity.ok(new MessageResponse("Package moderated and deleted successfully by Admin."));
    }

    /**
     * GET /api/admin/analytics
     * Returns platform high-level business analytics metrics. (Requires ROLE_ADMIN)
     */
    @GetMapping("/analytics")
    public ResponseEntity<Map<String, Object>> getPlatformAnalytics() {
        long totalUsers = userRepository.count();
        long totalAgents = agentRepository.count();
        long totalPackages = packageRepository.count();
        long totalBookings = bookingRepository.count();

        List<Booking> confirmedBookings = bookingRepository.findByStatus("CONFIRMED");
        double totalRevenue = confirmedBookings.stream()
                .mapToDouble(Booking::getTotalPrice)
                .sum();

        Map<String, Object> analytics = new HashMap<>();
        analytics.put("totalUsers", totalUsers);
        analytics.put("totalAgents", totalAgents);
        analytics.put("totalPackages", totalPackages);
        analytics.put("totalBookings", totalBookings);
        analytics.put("confirmedBookingsCount", confirmedBookings.size());
        analytics.put("totalRevenueINR", totalRevenue);

        return ResponseEntity.ok(analytics);
    }

    /**
     * GET /api/admin/reports/export
     * Exports platform bookings and revenue report in CSV format. (Requires ROLE_ADMIN)
     */
    @GetMapping("/reports/export")
    public ResponseEntity<byte[]> exportBookingsReport() {
        List<Booking> bookings = bookingRepository.findAll();
        StringBuilder csv = new StringBuilder();
        csv.append("Booking ID,User ID,Package Title,Travel Agency,Travelers,Travel Date,Total Price (INR),Status,Created At\n");

        for (Booking b : bookings) {
            csv.append(String.format("\"%s\",\"%s\",\"%s\",\"%s\",%d,\"%s\",%.2f,\"%s\",\"%s\"\n",
                    b.getId(),
                    b.getUserId(),
                    b.getPackageTitle() != null ? b.getPackageTitle().replace("\"", "\"\"") : "",
                    b.getAgentName() != null ? b.getAgentName().replace("\"", "\"\"") : "",
                    b.getTravelersCount(),
                    b.getTravelDate() != null ? b.getTravelDate() : "",
                    b.getTotalPrice(),
                    b.getStatus(),
                    b.getCreatedAt() != null ? b.getCreatedAt().toString() : ""
            ));
        }

        byte[] csvBytes = csv.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.add("Content-Disposition", "attachment; filename=Umrah-Bookings-Report.csv");

        return ResponseEntity.ok()
                .headers(headers)
                .contentType(org.springframework.http.MediaType.parseMediaType("text/csv"))
                .body(csvBytes);
    }
}
