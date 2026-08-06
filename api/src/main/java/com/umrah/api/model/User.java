package com.umrah.api.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * User Entity Document stored in MongoDB under the 'users' collection.
 * Represents registered users of the platform (Zaireen/Travelers, Travel Agents, or Admins).
 */
@Document(collection = "users")
public class User {

    // Unique MongoDB Identifier string assigned to each user document automatically
    @Id
    private String id;

    // Full name of the user
    private String name;

    // Unique email address used for login and notifications
    @Indexed(unique = true)
    private String email;

    // BCrypt encrypted password hash (never raw plain text passwords)
    private String passwordHash;

    // Contact phone number of the user
    private String phone;

    // Role assigned to the user: ROLE_USER, ROLE_AGENT, or ROLE_ADMIN
    private String role;

    // Timestamp when user registered on the platform
    private LocalDateTime createdAt = LocalDateTime.now();

    // Default no-argument constructor required by Spring Data MongoDB deserialization
    public User() {}

    // Convenience constructor for creating new users
    public User(String name, String email, String passwordHash, String phone, String role) {
        this.name = name;
        this.email = email;
        this.passwordHash = passwordHash;
        this.phone = phone;
        this.role = role;
        this.createdAt = LocalDateTime.now();
    }

    // Getters and Setters for all fields
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
