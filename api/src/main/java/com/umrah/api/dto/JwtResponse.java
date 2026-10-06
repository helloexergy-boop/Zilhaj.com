package com.umrah.api.dto;

/**
 * Data Transfer Object (DTO) returned to the frontend client upon successful authentication.
 * Contains JWT token and user profile details.
 */
public class JwtResponse {

    // JWT Access Token string to be included in subsequent request headers: Authorization: Bearer <token>
    private String token;
    private String type = "Bearer";
    private String id;
    private String name;
    private String email;
    private String role;
    private String profilePictureUrl;
    private java.util.List<String> permissions;

    public JwtResponse(String accessToken, String id, String name, String email, String role) {
        this.token = accessToken;
        this.id = id;
        this.name = name;
        this.email = email;
        this.role = role;
    }

    public JwtResponse(String accessToken, String id, String name, String email, String role, String profilePictureUrl) {
        this.token = accessToken;
        this.id = id;
        this.name = name;
        this.email = email;
        this.role = role;
        this.profilePictureUrl = profilePictureUrl;
    }

    public JwtResponse(String accessToken, String id, String name, String email, String role, String profilePictureUrl, java.util.List<String> permissions) {
        this.token = accessToken;
        this.id = id;
        this.name = name;
        this.email = email;
        this.role = role;
        this.profilePictureUrl = profilePictureUrl;
        this.permissions = permissions;
    }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getProfilePictureUrl() { return profilePictureUrl; }
    public void setProfilePictureUrl(String profilePictureUrl) { this.profilePictureUrl = profilePictureUrl; }

    public java.util.List<String> getPermissions() { return permissions; }
    public void setPermissions(java.util.List<String> permissions) { this.permissions = permissions; }
}
