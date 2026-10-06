package com.umrah.api.repository;

import com.umrah.api.model.Review;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Spring Data Mongo Repository for Review entity operations.
 */
@Repository
public interface ReviewRepository extends MongoRepository<Review, String> {

    // Finds all customer reviews for a given package ID
    List<Review> findByPackageId(String packageId);
}
