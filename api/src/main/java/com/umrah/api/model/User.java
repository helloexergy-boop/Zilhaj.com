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

    // Role assigned to the user: ROLE_USER, ROLE_AGENT, ROLE_ADMIN, or ROLE_SUBADMIN
    private String role;

    // Granular permissions assigned to sub-admins (e.g. MANAGE_USERS, MANAGE_AGENTS, APPROVE_REQUIREMENTS, MODERATE_PACKAGES, VIEW_FINANCES, MANAGE_SUBADMINS)
    private java.util.List<String> permissions = new java.util.ArrayList<>();

    // Google OAuth 2.0 unique subject/user ID (null for email/password users)
    private String googleId;

    // Permanent profile picture URL stored in database
    private String profilePictureUrl;

    // Timestamp when user registered on the platform
    private LocalDateTime createdAt = LocalDateTime.now();

    // Timestamp when user profile was last updated
    private LocalDateTime updatedAt = LocalDateTime.now();

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
        this.updatedAt = LocalDateTime.now();
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

    public java.util.List<String> getPermissions() { return permissions; }
    public void setPermissions(java.util.List<String> permissions) { this.permissions = permissions != null ? permissions : new java.util.ArrayList<>(); }

    public String getGoogleId() { return googleId; }
    public void setGoogleId(String googleId) { this.googleId = googleId; }

    public String getProfilePictureUrl() { return profilePictureUrl; }
    public void setProfilePictureUrl(String profilePictureUrl) { this.profilePictureUrl = profilePictureUrl; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
