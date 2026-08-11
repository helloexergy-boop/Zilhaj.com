package com.umrah.api.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * Offer Document stored in MongoDB under 'offers' collection.
 * Represents personalized discount offers suggested by Admins to specific users.
 */
@Document(collection = "offers")
public class Offer {

    @Id
    private String id;
    private String userId;
    private String requirementId;
    private String packageId;
    private String packageTitle;
    private double originalPrice;
    private double discountedPrice;
    private double discountPercentage;
    private String specialNote;
    private LocalDateTime createdAt = LocalDateTime.now();

    public Offer() {}

    public Offer(String userId, String packageId, String packageTitle, double originalPrice,
                 double discountPercentage, String specialNote) {
        this.userId = userId;
        this.packageId = packageId;
        this.packageTitle = packageTitle;
        this.originalPrice = originalPrice;
        this.discountPercentage = discountPercentage;
        this.discountedPrice = originalPrice * (1.0 - (discountPercentage / 100.0));
        this.specialNote = specialNote;
        this.createdAt = LocalDateTime.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getPackageId() { return packageId; }
    public void setPackageId(String packageId) { this.packageId = packageId; }

    public String getRequirementId() { return requirementId; }
    public void setRequirementId(String requirementId) { this.requirementId = requirementId; }

    public String getPackageTitle() { return packageTitle; }
    public void setPackageTitle(String packageTitle) { this.packageTitle = packageTitle; }

    public double getOriginalPrice() { return originalPrice; }
    public void setOriginalPrice(double originalPrice) { this.originalPrice = originalPrice; }

    public double getDiscountedPrice() { return discountedPrice; }
    public void setDiscountedPrice(double discountedPrice) { this.discountedPrice = discountedPrice; }

    public double getDiscountPercentage() { return discountPercentage; }
    public void setDiscountPercentage(double discountPercentage) { this.discountPercentage = discountPercentage; }

    public String getSpecialNote() { return specialNote; }
    public void setSpecialNote(String specialNote) { this.specialNote = specialNote; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
