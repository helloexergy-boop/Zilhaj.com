package com.umrah.api.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * Requirement Document stored in MongoDB under 'requirements' collection.
 * Allows pilgrims to submit custom package requests for Admin review and recommendation.
 */
@Document(collection = "requirements")
public class Requirement {

    @Id
    private String id;
    private String userId;
    private String userName;
    private String userEmail;
    private String userPhone;
    private String preferredDepartureDate;
    private int durationDays = 14;
    private int travelersCount = 1;
    private String sharingPreference; // Quad, Triple, Double, Single
    private double maxBudget;
    private String specialNotes;
    private String status = "PENDING"; // PENDING, MATCHED, CONTACTED
    private LocalDateTime createdAt = LocalDateTime.now();

    public Requirement() {}

    public Requirement(String userId, String userName, String userEmail, String userPhone,
                       String preferredDepartureDate, int durationDays, int travelersCount,
                       String sharingPreference, double maxBudget, String specialNotes) {
        this.userId = userId;
        this.userName = userName;
        this.userEmail = userEmail;
        this.userPhone = userPhone;
        this.preferredDepartureDate = preferredDepartureDate;
        this.durationDays = durationDays;
        this.travelersCount = travelersCount;
        this.sharingPreference = sharingPreference;
        this.maxBudget = maxBudget;
        this.specialNotes = specialNotes;
        this.status = "PENDING";
        this.createdAt = LocalDateTime.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }

    public String getUserEmail() { return userEmail; }
    public void setUserEmail(String userEmail) { this.userEmail = userEmail; }

    public String getUserPhone() { return userPhone; }
    public void setUserPhone(String userPhone) { this.userPhone = userPhone; }

    public String getPreferredDepartureDate() { return preferredDepartureDate; }
    public void setPreferredDepartureDate(String preferredDepartureDate) { this.preferredDepartureDate = preferredDepartureDate; }

    public int getDurationDays() { return durationDays; }
    public void setDurationDays(int durationDays) { this.durationDays = durationDays; }

    public int getTravelersCount() { return travelersCount; }
    public void setTravelersCount(int travelersCount) { this.travelersCount = travelersCount; }

    public String getSharingPreference() { return sharingPreference; }
    public void setSharingPreference(String sharingPreference) { this.sharingPreference = sharingPreference; }

    public double getMaxBudget() { return maxBudget; }
    public void setMaxBudget(double maxBudget) { this.maxBudget = maxBudget; }

    public String getSpecialNotes() { return specialNotes; }
    public void setSpecialNotes(String specialNotes) { this.specialNotes = specialNotes; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
