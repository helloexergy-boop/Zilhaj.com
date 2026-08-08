package com.umrah.api.controller;

import com.umrah.api.dto.JwtResponse;
import com.umrah.api.dto.LoginRequest;
import com.umrah.api.dto.MessageResponse;
import com.umrah.api.dto.RegisterRequest;
import com.umrah.api.model.Agent;
import com.umrah.api.model.User;
import com.umrah.api.repository.AgentRepository;
import com.umrah.api.repository.UserRepository;
import com.umrah.api.security.JwtUtils;
import com.umrah.api.security.UserDetailsImpl;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

/**
 * AuthController manages user registration, login, JWT token issuance, and user profile retrieval.
 * Endpoint base path: /api/auth
 */
@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AgentRepository agentRepository;

    @Autowired
    private PasswordEncoder encoder;

    @Autowired
    private JwtUtils jwtUtils;

    /**
     * POST /api/auth/register
     * Registers a new User or Travel Agent account.
     * @param signUpRequest JSON payload containing user details (name, email, password, phone, role, companyName)
     * @return Success message response or error message if email already exists
     */
    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@Valid @RequestBody RegisterRequest signUpRequest) {
        // Validate if email is already taken
        if (userRepository.existsByEmail(signUpRequest.getEmail())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Email is already in use!"));
        }

        // Determine user role (default to ROLE_USER if unspecified)
        String role = signUpRequest.getRole();
        if (role == null || role.isBlank()) {
            role = "ROLE_USER";
        } else if (!role.startsWith("ROLE_")) {
            role = "ROLE_" + role.toUpperCase();
        }

        // Create new User entity with BCrypt encrypted password
        User user = new User(
                signUpRequest.getName(),
                signUpRequest.getEmail(),
                encoder.encode(signUpRequest.getPassword()),
                signUpRequest.getPhone(),
                role
        );

        User savedUser = userRepository.save(user);

        // If registered as an Agent, initialize an Agent company record in PENDING state
        if ("ROLE_AGENT".equals(role)) {
            String company = signUpRequest.getCompanyName() != null ? signUpRequest.getCompanyName() : signUpRequest.getName() + " Travels";
            String license = signUpRequest.getLicenseNumber() != null ? signUpRequest.getLicenseNumber() : "LIC-" + System.currentTimeMillis();
            Agent agent = new Agent(savedUser.getId(), company, license);
            agentRepository.save(agent);
        }

        savedUser.setPasswordHash(null); // Mask password hash in response
        java.util.Map<String, Object> res = new java.util.HashMap<>();
        res.put("message", "User registered successfully!");
        res.put("user", savedUser);
        return ResponseEntity.ok(res);
    }

    /**
     * POST /api/auth/login
     * Authenticates user credentials and returns a JWT Bearer Token.
     * @param loginRequest JSON payload containing email and password
     * @return JwtResponse containing JWT token and user profile
     */
    @PostMapping("/login")
    public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest loginRequest) {
        try {
            // Authenticate email/phone and password using Spring Security AuthenticationManager
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(loginRequest.getEmail(), loginRequest.getPassword()));

            SecurityContextHolder.getContext().setAuthentication(authentication);
            String jwt = jwtUtils.generateJwtToken(authentication);

            UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
            String role = userDetails.getAuthorities().stream()
                    .findFirst().map(item -> item.getAuthority()).orElse("ROLE_USER");

            return ResponseEntity.ok(new JwtResponse(jwt,
                    userDetails.getId(),
                    userDetails.getName(),
                    userDetails.getEmail(),
                    role));
        } catch (Exception e) {
            return ResponseEntity.status(401).body(new MessageResponse("Invalid credentials or user not found"));
        }
    }

    /**
     * GET /api/auth/profile
     * Retrieves the profile details of the currently authenticated user.
     * @return User details object
     */
    @GetMapping("/profile")
    public ResponseEntity<?> getUserProfile() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getPrincipal().equals("anonymousUser")) {
            return ResponseEntity.status(401).body(new MessageResponse("Unauthorized access"));
        }

        UserDetailsImpl userDetails = (UserDetailsImpl) auth.getPrincipal();
        User user = userRepository.findById(userDetails.getId()).orElse(null);

        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        user.setPasswordHash(null); // Mask password hash before sending response
        return ResponseEntity.ok(user);
    }
}
