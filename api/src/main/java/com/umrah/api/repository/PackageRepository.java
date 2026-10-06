package com.umrah.api.repository;

import com.umrah.api.model.UmrahPackage;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Spring Data Mongo Repository for UmrahPackage entity operations.
 */
@Repository
public interface PackageRepository extends MongoRepository<UmrahPackage, String> {

    // Finds all packages belonging to a specific travel agent
    List<UmrahPackage> findByAgentId(String agentId);

    // Custom search query filter: find packages with price <= maxPrice
    List<UmrahPackage> findByPriceLessThanEqual(double maxPrice);

    // Custom search query filter: find packages with distance to Makkah Haram <= maxDistance
    List<UmrahPackage> findByDistanceToHaramMakkahLessThanEqual(int maxDistance);
}
