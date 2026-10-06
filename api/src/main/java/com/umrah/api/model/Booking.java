package com.umrah.api.model;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Booking Document stored in MongoDB under the 'bookings' collection.
 * Records package reservations placed by users, including traveler numbers, status, and payment linkage.
 */
@Document(collection = "bookings")
public class Booking {

    // Unique MongoDB Document Identifier for this booking
    @Id
    private String id;

    // Foreign key reference linking to the User who made the booking
    private String userId;

    // Foreign key reference linking to the reserved Umrah Package
    private String packageId;

    // Title of the booked package (cached for quick rendering)
    private String packageTitle;

    // Name of the travel agency managing the booked package
    private String agentName;

    // Total count of travelers included in this booking
    private int travelersCount = 1;

    // Date selected by the user for departure/travel
    private String travelDate;

    // Total price computed (Price per person * travelersCount)
    private double totalPrice;

    // Booking status: PENDING, CONFIRMED, or CANCELLED
    private String status = "PENDING";

    // Passenger details list (e.g. names, passport numbers)
    private List<PassengerDetail> passengers = new ArrayList<>();

    // Contact telephone number for booking confirmations
    private String contactPhone;

    // Timestamp when booking was initialized
    private LocalDateTime createdAt = LocalDateTime.now();

    // Passenger nested detail object
    public static class PassengerDetail {
        private String fullName;
        private String passportNumber;

        public PassengerDetail() {}

        public PassengerDetail(String fullName, String passportNumber) {
            this.fullName = fullName;
            this.passportNumber = passportNumber;
        }

        public String getFullName() { return fullName; }
        public void setFullName(String fullName) { this.fullName = fullName; }

        public String getPassportNumber() { return passportNumber; }
        public void setPassportNumber(String passportNumber) { this.passportNumber = passportNumber; }
    }

    // Default constructor
    public Booking() {}

    // Parametrized constructor
    public Booking(String userId, String packageId, String packageTitle, String agentName, int travelersCount,
                   String travelDate, double totalPrice, String contactPhone, List<PassengerDetail> passengers) {
        this.userId = userId;
        this.packageId = packageId;
        this.packageTitle = packageTitle;
        this.agentName = agentName;
        this.travelersCount = travelersCount;
        this.travelDate = travelDate;
        this.totalPrice = totalPrice;
        this.contactPhone = contactPhone;
        this.passengers = passengers != null ? passengers : new ArrayList<>();
        this.status = "PENDING";
        this.createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getPackageId() { return packageId; }
    public void setPackageId(String packageId) { this.packageId = packageId; }

    public String getPackageTitle() { return packageTitle; }
    public void setPackageTitle(String packageTitle) { this.packageTitle = packageTitle; }

    public String getAgentName() { return agentName; }
    public void setAgentName(String agentName) { this.agentName = agentName; }

    public int getTravelersCount() { return travelersCount; }
    public void setTravelersCount(int travelersCount) { this.travelersCount = travelersCount; }

    public String getTravelDate() { return travelDate; }
    public void setTravelDate(String travelDate) { this.travelDate = travelDate; }

    public double getTotalPrice() { return totalPrice; }
    public void setTotalPrice(double totalPrice) { this.totalPrice = totalPrice; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public List<PassengerDetail> getPassengers() { return passengers; }
    public void setPassengers(List<PassengerDetail> passengers) { this.passengers = passengers; }

    public String getContactPhone() { return contactPhone; }
    public void setContactPhone(String contactPhone) { this.contactPhone = contactPhone; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
