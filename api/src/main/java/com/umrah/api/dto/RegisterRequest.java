package com.umrah.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Data Transfer Object (DTO) for processing new user registrations.
 */
public class RegisterRequest {

    // User's full name
    @NotBlank(message = "Name is required")
    private String name;

    // User's email address
    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    // User's chosen password (min 6 characters)
    @NotBlank(message = "Password is required")
    @Size(min = 6, message = "Password must be at least 6 characters")
    private String password;

    // Contact telephone number
    private String phone;

    // Requested role: ROLE_USER, ROLE_AGENT, or ROLE_ADMIN
    private String role = "ROLE_USER";

    // Optional business details if registering as an agent
    private String companyName;
    private String licenseNumber;

    public RegisterRequest() {}

    public RegisterRequest(String name, String email, String password, String phone, String role) {
        this.name = name;
        this.email = email;
        this.password = password;
        this.phone = phone;
        this.role = role;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }

    public String getLicenseNumber() { return licenseNumber; }
    public void setLicenseNumber(String licenseNumber) { this.licenseNumber = licenseNumber; }
}
