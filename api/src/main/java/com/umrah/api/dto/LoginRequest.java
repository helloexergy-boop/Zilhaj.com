package com.umrah.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Data Transfer Object (DTO) for handling incoming authentication login requests.
 */
public class LoginRequest {

    // User email credential (must not be blank and must follow valid email format)
    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    // User raw password string (must not be blank)
    @NotBlank(message = "Password is required")
    private String password;

    public LoginRequest() {}

    public LoginRequest(String email, String password) {
        this.email = email;
        this.password = password;
    }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
}
