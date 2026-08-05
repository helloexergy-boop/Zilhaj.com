package com.umrah.api.config;

import com.umrah.api.model.*;
import com.umrah.api.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;

/**
 * DataSeeder component pre-populates initial sample data into MongoDB upon application startup
 * if database collections are empty, ensuring out-of-the-box working endpoints.
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(DataSeeder.class);

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AgentRepository agentRepository;

    @Autowired
    private PackageRepository packageRepository;

    @Autowired
    private ReviewRepository reviewRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @org.springframework.beans.factory.annotation.Value("${app.db.seed-data:true}")
    private boolean seedDataEnabled;

    @Override
    public void run(String... args) throws Exception {
        if (!seedDataEnabled) {
            logger.info("Data seeding is disabled via app.db.seed-data=false configuration.");
            return;
        }

        // Seed default accounts if database is empty
        if (userRepository.count() == 0) {
            logger.info("Database is empty. Seeding initial accounts, agents, and Umrah packages...");

            // 1. Seed Admin User Account (email: admin@umrah.com / password: password123)
            User admin = new User("System Administrator", "admin@umrah.com", passwordEncoder.encode("password123"), "+1234567890", "ROLE_ADMIN");
            userRepository.save(admin);

            // 2. Seed Travel Agent User Account (email: agent@alharam.com / password: password123)
            User agentUser = new User("Umrah Travels", "agent@alharam.com", passwordEncoder.encode("password123"), "9541692891", "ROLE_AGENT");
            User savedAgentUser = userRepository.save(agentUser);

            // 3. Seed Agent Business Verification Record
            Agent agent = new Agent(savedAgentUser.getId(), "UMRAH TRAVELS", "UMRAH-LIC-95416");
            agent.setVerificationStatus("VERIFIED");
            agent.setRating(4.9);
            agent.setReviewCount(128);
            Agent savedAgent = agentRepository.save(agent);

            // 4. Seed Standard Pilgrim User Account (email: user@pilgrim.com / password: password123)
            User pilgrim = new User("Tariq Mahmood", "user@pilgrim.com", passwordEncoder.encode("password123"), "+919541692891", "ROLE_USER");
            userRepository.save(pilgrim);

            // 5. Seed Authentic Sample Umrah Packages from Poster
            UmrahPackage.Inclusions luxuryInclusions = new UmrahPackage.Inclusions(true, true, true, true, true);

            UmrahPackage pkg1 = new UmrahPackage(
                    savedAgent.getId(),
                    savedAgent.getCompanyName(),
                    "18-Day Deluxe Umrah Package",
                    "Journey of Faith, Comfort & Blessings. Complete 18 days pilgrimage package featuring top hotels near Haram, return air tickets, Indian buffet meals, and guided ziyarat.",
                    125000.00,
                    18,
                    600, // 600 meters to Makkah Haram
                    250, // 250 meters to Madinah Haram
                    5,
                    5,
                    luxuryInclusions,
                    Arrays.asList("Day 1: Departure & Arrival in Jeddah (SXR-JED), Transfer to Makkah Hotel", "Day 2-9: Perform Umrah & Daily Prayers at Masjid al-Haram", "Day 10: Guided Ziyarat in Makkah & Haramain Train Transfer to Madinah", "Day 11-17: Ziyarah in Madinah, Rawdah Sharif & Prayers at Al-Masjid An-Nabawi", "Day 18: Departure from Prince Mohammad Airport (MED-SXR)"),
                    30,
                    Arrays.asList("https://images.unsplash.com/photo-1591604466107-ec97de577aff", "https://images.unsplash.com/photo-1542856391-010fb87dcfed")
            );
            pkg1.setDepartureDateText("12 AUGUST");
            pkg1.setMakkahHotelName("Manarat Al Misk / Dream Zone (or similar)");
            pkg1.setMadinahHotelName("Marjan International / Marjan Gold (or similar)");
            pkg1.setFlightRoute("Return Air Ticket (SXR-JED-MED-SXR)");
            pkg1.setSharingType("4/5 Sharing Accommodation");
            pkg1.setComplimentaryServices(Arrays.asList("Ahram Kit", "Laundry Service", "5 Litres Zamzam Water"));
            pkg1.setImportantNote("Rawdah permits must be booked by the pilgrim through the Nusuk App, subject to availability. The company is not responsible for the booking, availability, approval, or non-issuance of the Rawdah permit.");
            pkg1.setContactPhone("9541692891");

            UmrahPackage savedPkg1 = packageRepository.save(pkg1);

            // 6. Seed Sample Review
            Review review = new Review(pilgrim.getId(), pilgrim.getName(), savedPkg1.getId(), 5, "MashaAllah, incredible service! The proximity to Al-Haram made prayers so convenient for my elderly parents.");
            reviewRepository.save(review);

            logger.info("Sample database seeding completed successfully!");
            logger.info("Pre-configured Login Credentials:");
            logger.info("   User:  email=user@pilgrim.com   password=password123");
            logger.info("   Agent: email=agent@alharam.com  password=password123");
            logger.info("   Admin: email=admin@umrah.com    password=password123");
        }
    }
}
