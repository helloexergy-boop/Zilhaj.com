package com.umrah.api.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "agent_offers")
public class AgentOffer {

    @Id
    private String id;

    private String requirementId;
    private String agentId;
    private String agentName;
    private String agentCompanyName;

    private String packageTitle;
    private String packageDescription;

    private double pricePerPerson;
    private double totalPrice;
    private double originalPrice;
    private double discountPercentage;

    private int durationDays;
    private String hotelCategory;
    private String sharingType;

    private String makkahHotelName;
    private int makkahHotelStars;
    private String makkahDistanceToHaram;
    private String madinahHotelName;
    private int madinahHotelStars;
    private String madinahDistanceToHaram;

    private String flightRoute;
    private boolean flightsIncluded;
    private boolean visaIncluded;
    private boolean transportIncluded;
    private boolean mealsIncluded;
    private boolean ziyarahIncluded;

    private List<String> inclusions;
    private List<String> exclusions;
    private List<String> complimentaryServices;

    private String termsAndConditions;
    private String specialNotes;

    private int availableSeats;
    private String validUntil;

    private String status; // PENDING, ACCEPTED, REJECTED, EXPIRED, WITHDRAWN
    private String userResponse; // ACCEPTED, REJECTED, PENDING

    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime updatedAt = LocalDateTime.now();
    private LocalDateTime respondedAt;

    public AgentOffer() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getRequirementId() { return requirementId; }
    public void setRequirementId(String requirementId) { this.requirementId = requirementId; }

    public String getAgentId() { return agentId; }
    public void setAgentId(String agentId) { this.agentId = agentId; }

    public String getAgentName() { return agentName; }
    public void setAgentName(String agentName) { this.agentName = agentName; }

    public String getAgentCompanyName() { return agentCompanyName; }
    public void setAgentCompanyName(String agentCompanyName) { this.agentCompanyName = agentCompanyName; }

    public String getPackageTitle() { return packageTitle; }
    public void setPackageTitle(String packageTitle) { this.packageTitle = packageTitle; }

    public String getPackageDescription() { return packageDescription; }
    public void setPackageDescription(String packageDescription) { this.packageDescription = packageDescription; }

    public double getPricePerPerson() { return pricePerPerson; }
    public void setPricePerPerson(double pricePerPerson) { this.pricePerPerson = pricePerPerson; }

    public double getTotalPrice() { return totalPrice; }
    public void setTotalPrice(double totalPrice) { this.totalPrice = totalPrice; }

    public double getOriginalPrice() { return originalPrice; }
    public void setOriginalPrice(double originalPrice) { this.originalPrice = originalPrice; }

    public double getDiscountPercentage() { return discountPercentage; }
    public void setDiscountPercentage(double discountPercentage) { this.discountPercentage = discountPercentage; }

    public int getDurationDays() { return durationDays; }
    public void setDurationDays(int durationDays) { this.durationDays = durationDays; }

    public String getHotelCategory() { return hotelCategory; }
    public void setHotelCategory(String hotelCategory) { this.hotelCategory = hotelCategory; }

    public String getSharingType() { return sharingType; }
    public void setSharingType(String sharingType) { this.sharingType = sharingType; }

    public String getMakkahHotelName() { return makkahHotelName; }
    public void setMakkahHotelName(String makkahHotelName) { this.makkahHotelName = makkahHotelName; }

    public int getMakkahHotelStars() { return makkahHotelStars; }
    public void setMakkahHotelStars(int makkahHotelStars) { this.makkahHotelStars = makkahHotelStars; }

    public String getMakkahDistanceToHaram() { return makkahDistanceToHaram; }
    public void setMakkahDistanceToHaram(String makkahDistanceToHaram) { this.makkahDistanceToHaram = makkahDistanceToHaram; }

    public String getMadinahHotelName() { return madinahHotelName; }
    public void setMadinahHotelName(String madinahHotelName) { this.madinahHotelName = madinahHotelName; }

    public int getMadinahHotelStars() { return madinahHotelStars; }
    public void setMadinahHotelStars(int madinahHotelStars) { this.madinahHotelStars = madinahHotelStars; }

    public String getMadinahDistanceToHaram() { return madinahDistanceToHaram; }
    public void setMadinahDistanceToHaram(String madinahDistanceToHaram) { this.madinahDistanceToHaram = madinahDistanceToHaram; }

    public String getFlightRoute() { return flightRoute; }
    public void setFlightRoute(String flightRoute) { this.flightRoute = flightRoute; }

    public boolean isFlightsIncluded() { return flightsIncluded; }
    public void setFlightsIncluded(boolean flightsIncluded) { this.flightsIncluded = flightsIncluded; }

    public boolean isVisaIncluded() { return visaIncluded; }
    public void setVisaIncluded(boolean visaIncluded) { this.visaIncluded = visaIncluded; }

    public boolean isTransportIncluded() { return transportIncluded; }
    public void setTransportIncluded(boolean transportIncluded) { this.transportIncluded = transportIncluded; }

    public boolean isMealsIncluded() { return mealsIncluded; }
    public void setMealsIncluded(boolean mealsIncluded) { this.mealsIncluded = mealsIncluded; }

    public boolean isZiyarahIncluded() { return ziyarahIncluded; }
    public void setZiyarahIncluded(boolean ziyarahIncluded) { this.ziyarahIncluded = ziyarahIncluded; }

    public List<String> getInclusions() { return inclusions; }
    public void setInclusions(List<String> inclusions) { this.inclusions = inclusions; }

    public List<String> getExclusions() { return exclusions; }
    public void setExclusions(List<String> exclusions) { this.exclusions = exclusions; }

    public List<String> getComplimentaryServices() { return complimentaryServices; }
    public void setComplimentaryServices(List<String> complimentaryServices) { this.complimentaryServices = complimentaryServices; }

    public String getTermsAndConditions() { return termsAndConditions; }
    public void setTermsAndConditions(String termsAndConditions) { this.termsAndConditions = termsAndConditions; }

    public String getSpecialNotes() { return specialNotes; }
    public void setSpecialNotes(String specialNotes) { this.specialNotes = specialNotes; }

    public int getAvailableSeats() { return availableSeats; }
    public void setAvailableSeats(int availableSeats) { this.availableSeats = availableSeats; }

    public String getValidUntil() { return validUntil; }
    public void setValidUntil(String validUntil) { this.validUntil = validUntil; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getUserResponse() { return userResponse; }
    public void setUserResponse(String userResponse) { this.userResponse = userResponse; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public LocalDateTime getRespondedAt() { return respondedAt; }
    public void setRespondedAt(LocalDateTime respondedAt) { this.respondedAt = respondedAt; }
}