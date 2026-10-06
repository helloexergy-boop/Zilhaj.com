package com.umrah.api.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.ArrayList;
import java.util.List;

/**
 * UmrahPackage Document stored in MongoDB under the 'packages' collection.
 * Details an Umrah trip listing created by a travel agent, including inclusions, distance to Haram, price, and itinerary.
 */
@Document(collection = "packages")
public class UmrahPackage {

    // Unique MongoDB Document Identifier for this Umrah Package
    @Id
    private String id;

    // Foreign key reference to the ID of the travel agent offering this package
    private String agentId;

    // Display name of the travel agency
    private String agentName;

    // Package headline title (e.g. "Economy 14-Day Ramadan Special")
    private String title;

    // Comprehensive package description and highlights
    private String description;

    // Price per person in USD (or local currency)
    private double price;

    // Total duration of the sacred journey package in days
    private int durationDays;

    // Walking distance in meters from the Makkah hotel to Masjid al-Haram
    private int distanceToHaramMakkah;

    // Distance in meters from the Madinah hotel to Al-Masjid an-Nabawi
    private int distanceToHaramMadinah;

    // Makkah Hotel Star Rating (3, 4, or 5 stars)
    private int hotelMakkahStars;

    // Madinah Hotel Star Rating (3, 4, or 5 stars)
    private int hotelMadinahStars;

    // Included services object flags
    private Inclusions includes = new Inclusions();

    // Day-by-day travel itinerary schedule
    private List<String> itinerary = new ArrayList<>();

    // Available seat inventory remaining for booking
    private int availableSeats = 30;

    // Image URL links showcasing hotel rooms and transport
    private List<String> imageUrls = new ArrayList<>();

    // Poster specific Agent & Package details
    private String departureDateText = "12 AUGUST";
    private String makkahHotelName = "Manarat Al Misk / Dream Zone (or similar)";
    private String madinahHotelName = "Marjan International / Marjan Gold (or similar)";
    private String flightRoute = "Return Air Ticket (SXR-JED-MED-SXR)";
    private String sharingType = "4/5 Sharing Accommodation";
    private List<String> complimentaryServices = List.of("Ahram Kit", "Laundry Service", "5 Litres Zamzam Water");
    private String importantNote = "Rawdah permits must be booked by the Zaireen through the Nusuk App, subject to availability. The company is not responsible for the booking, availability, approval, or non-issuance of the Rawdah permit.";
    private String contactPhone = "9541692891";

    // Inner static class defining package inclusions
    public static class Inclusions {
        private boolean flights = true;      // Roundtrip flight tickets included
        private boolean hotel = true;        // Hotel accommodation included
        private boolean meals = true;        // Daily breakfast & meals included
        private boolean transport = true;    // AC bus transportation included
        private boolean visaSupport = true;  // Umrah Visa assistance included

        public Inclusions() {}

        public Inclusions(boolean flights, boolean hotel, boolean meals, boolean transport, boolean visaSupport) {
            this.flights = flights;
            this.hotel = hotel;
            this.meals = meals;
            this.transport = transport;
            this.visaSupport = visaSupport;
        }

        public boolean isFlights() { return flights; }
        public void setFlights(boolean flights) { this.flights = flights; }

        public boolean isHotel() { return hotel; }
        public void setHotel(boolean hotel) { this.hotel = hotel; }

        public boolean isMeals() { return meals; }
        public void setMeals(boolean meals) { this.meals = meals; }

        public boolean isTransport() { return transport; }
        public void setTransport(boolean transport) { this.transport = transport; }

        public boolean isVisaSupport() { return visaSupport; }
        public void setVisaSupport(boolean visaSupport) { this.visaSupport = visaSupport; }
    }

    // Default constructor
    public UmrahPackage() {}

    // Fully-parameterized constructor
    public UmrahPackage(String agentId, String agentName, String title, String description, double price,
                        int durationDays, int distanceToHaramMakkah, int distanceToHaramMadinah,
                        int hotelMakkahStars, int hotelMadinahStars, Inclusions includes,
                        List<String> itinerary, int availableSeats, List<String> imageUrls) {
        this.agentId = agentId;
        this.agentName = agentName;
        this.title = title;
        this.description = description;
        this.price = price;
        this.durationDays = durationDays;
        this.distanceToHaramMakkah = distanceToHaramMakkah;
        this.distanceToHaramMadinah = distanceToHaramMadinah;
        this.hotelMakkahStars = hotelMakkahStars;
        this.hotelMadinahStars = hotelMadinahStars;
        this.includes = includes != null ? includes : new Inclusions();
        this.itinerary = itinerary != null ? itinerary : new ArrayList<>();
        this.availableSeats = availableSeats;
        this.imageUrls = imageUrls != null ? imageUrls : new ArrayList<>();
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getAgentId() { return agentId; }
    public void setAgentId(String agentId) { this.agentId = agentId; }

    public String getAgentName() { return agentName; }
    public void setAgentName(String agentName) { this.agentName = agentName; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public double getPrice() { return price; }
    public void setPrice(double price) { this.price = price; }

    public int getDurationDays() { return durationDays; }
    public void setDurationDays(int durationDays) { this.durationDays = durationDays; }

    public int getDistanceToHaramMakkah() { return distanceToHaramMakkah; }
    public void setDistanceToHaramMakkah(int distanceToHaramMakkah) { this.distanceToHaramMakkah = distanceToHaramMakkah; }

    public int getDistanceToHaramMadinah() { return distanceToHaramMadinah; }
    public void setDistanceToHaramMadinah(int distanceToHaramMadinah) { this.distanceToHaramMadinah = distanceToHaramMadinah; }

    public int getHotelMakkahStars() { return hotelMakkahStars; }
    public void setHotelMakkahStars(int hotelMakkahStars) { this.hotelMakkahStars = hotelMakkahStars; }

    public int getHotelMadinahStars() { return hotelMadinahStars; }
    public void setHotelMadinahStars(int hotelMadinahStars) { this.hotelMadinahStars = hotelMadinahStars; }

    public Inclusions getIncludes() { return includes; }
    public void setIncludes(Inclusions includes) { this.includes = includes; }

    public List<String> getItinerary() { return itinerary; }
    public void setItinerary(List<String> itinerary) { this.itinerary = itinerary; }

    public int getAvailableSeats() { return availableSeats; }
    public void setAvailableSeats(int availableSeats) { this.availableSeats = availableSeats; }

    public List<String> getImageUrls() { return imageUrls; }
    public void setImageUrls(List<String> imageUrls) { this.imageUrls = imageUrls; }

    public String getDepartureDateText() { return departureDateText; }
    public void setDepartureDateText(String departureDateText) { this.departureDateText = departureDateText; }

    public String getMakkahHotelName() { return makkahHotelName; }
    public void setMakkahHotelName(String makkahHotelName) { this.makkahHotelName = makkahHotelName; }

    public String getMadinahHotelName() { return madinahHotelName; }
    public void setMadinahHotelName(String madinahHotelName) { this.madinahHotelName = madinahHotelName; }

    public String getFlightRoute() { return flightRoute; }
    public void setFlightRoute(String flightRoute) { this.flightRoute = flightRoute; }

    public String getSharingType() { return sharingType; }
    public void setSharingType(String sharingType) { this.sharingType = sharingType; }

    public List<String> getComplimentaryServices() { return complimentaryServices; }
    public void setComplimentaryServices(List<String> complimentaryServices) { this.complimentaryServices = complimentaryServices; }

    public String getImportantNote() { return importantNote; }
    public void setImportantNote(String importantNote) { this.importantNote = importantNote; }

    public String getContactPhone() { return contactPhone; }
    public void setContactPhone(String contactPhone) { this.contactPhone = contactPhone; }
}
