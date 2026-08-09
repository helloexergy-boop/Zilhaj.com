package com.umrah.api.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "travel_requirements")
public class TravelRequirement {

    @Id
    private String id;
    private String userId;
    private String userName;
    private String userEmail;
    private String userPhone;

    private String tripType; // UMRAH, HAJJ
    private String preferredDepartureDate;
    private String returnDate;
    private int durationDays;
    private String departureCity;
    private String state;
    private String district;
    private String address;

    private int maleCount;
    private int femaleCount;
    private int childrenCount;
    private int totalTravelers;

    private String hotelCategory; // 5-STAR, 4-STAR, 3-STAR, ECONOMY
    private String sharingPreference; // SINGLE, DOUBLE, TRIPLE, QUAD
    private double maxBudgetPerPerson;
    private double totalMaxBudget;

    private String specialNotes;
    private List<String> requiredServices; // FLIGHTS, VISA, TRANSPORT, MEALS, ZIYARAH, WHEELCHAIR

    private String status; // PENDING, OPEN_FOR_BIDS, BIDS_RECEIVED, AWARDED, COMPLETED, CANCELLED
    private String awardedAgentId;
    private String awardedOfferId;

    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime updatedAt = LocalDateTime.now();
    private LocalDateTime expiresAt;

    public TravelRequirement() {}

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

    public String getTripType() { return tripType; }
    public void setTripType(String tripType) { this.tripType = tripType; }

    public String getPreferredDepartureDate() { return preferredDepartureDate; }
    public void setPreferredDepartureDate(String preferredDepartureDate) { this.preferredDepartureDate = preferredDepartureDate; }

    public String getReturnDate() { return returnDate; }
    public void setReturnDate(String returnDate) { this.returnDate = returnDate; }

    public int getDurationDays() { return durationDays; }
    public void setDurationDays(int durationDays) { this.durationDays = durationDays; }

    public String getDepartureCity() { return departureCity; }
    public void setDepartureCity(String departureCity) { this.departureCity = departureCity; }

    public String getState() { return state; }
    public void setState(String state) { this.state = state; }

    public String getDistrict() { return district; }
    public void setDistrict(String district) { this.district = district; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public int getMaleCount() { return maleCount; }
    public void setMaleCount(int maleCount) { this.maleCount = maleCount; }

    public int getFemaleCount() { return femaleCount; }
    public void setFemaleCount(int femaleCount) { this.femaleCount = femaleCount; }

    public int getChildrenCount() { return childrenCount; }
    public void setChildrenCount(int childrenCount) { this.childrenCount = childrenCount; }

    public int getTotalTravelers() { return totalTravelers; }
    public void setTotalTravelers(int totalTravelers) { this.totalTravelers = totalTravelers; }

    public String getHotelCategory() { return hotelCategory; }
    public void setHotelCategory(String hotelCategory) { this.hotelCategory = hotelCategory; }

    public String getSharingPreference() { return sharingPreference; }
    public void setSharingPreference(String sharingPreference) { this.sharingPreference = sharingPreference; }

    public double getMaxBudgetPerPerson() { return maxBudgetPerPerson; }
    public void setMaxBudgetPerPerson(double maxBudgetPerPerson) { this.maxBudgetPerPerson = maxBudgetPerPerson; }

    public double getTotalMaxBudget() { return totalMaxBudget; }
    public void setTotalMaxBudget(double totalMaxBudget) { this.totalMaxBudget = totalMaxBudget; }

    public String getSpecialNotes() { return specialNotes; }
    public void setSpecialNotes(String specialNotes) { this.specialNotes = specialNotes; }

    public List<String> getRequiredServices() { return requiredServices; }
    public void setRequiredServices(List<String> requiredServices) { this.requiredServices = requiredServices; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getAwardedAgentId() { return awardedAgentId; }
    public void setAwardedAgentId(String awardedAgentId) { this.awardedAgentId = awardedAgentId; }

    public String getAwardedOfferId() { return awardedOfferId; }
    public void setAwardedOfferId(String awardedOfferId) { this.awardedOfferId = awardedOfferId; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
}