package com.umrah.api.repository;

import com.umrah.api.model.Offer;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Spring Data Mongo Repository for Offer entity operations.
 */
@Repository
public interface OfferRepository extends MongoRepository<Offer, String> {
    List<Offer> findByUserId(String userId);
}
