package com.umrah.api.model;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;
/**
 * Agent Entity Document stored in MongoDB under the 'agents' collection.
 * Holds business license details and verification status for travel agency partners.
 */
@Document(collection = "agents")
public class Agent {

    // Unique identifier for the Agent record
    @Id
    private String id;

    // Foreign key reference linking to the associated User account ID
    private String userId;

    // Registered business company or travel agency name
    private String companyName;

    // Official government or ministry travel license number
    private String licenseNumber;

    // Agent verification state: PENDING, VERIFIED, or REJECTED
    private String verificationStatus = "PENDING";

    // Average customer review rating score (0.0 to 5.0)
    private double rating = 5.0;

    // Total number of reviews received by this agent
    private int reviewCount = 0;

    // Date and time when the agent registered their agency
    private LocalDateTime createdAt = LocalDateTime.now();

    // Default no-args constructor for Mongo deserialization
    public Agent() {}

    // Parametrized constructor for new agency onboarding
    public Agent(String userId, String companyName, String licenseNumber) {
        this.userId = userId;
        this.companyName = companyName;
        this.licenseNumber = licenseNumber;
        this.verificationStatus = "PENDING";
        this.rating = 5.0;
        this.reviewCount = 0;
        this.createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }

    public String getLicenseNumber() { return licenseNumber; }
    public void setLicenseNumber(String licenseNumber) { this.licenseNumber = licenseNumber; }

    public String getVerificationStatus() { return verificationStatus; }
    public void setVerificationStatus(String verificationStatus) { this.verificationStatus = verificationStatus; }

    public double getRating() { return rating; }
    public void setRating(double rating) { this.rating = rating; }

    public int getReviewCount() { return reviewCount; }
    public void setReviewCount(int reviewCount) { this.reviewCount = reviewCount; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
