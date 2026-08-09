package com.umrah.api.repository;

import com.umrah.api.model.TravelRequirement;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface TravelRequirementRepository extends MongoRepository<TravelRequirement, String> {

    List<TravelRequirement> findByUserId(String userId);

    List<TravelRequirement> findByStatus(String status);

    @Query("{ 'status': 'OPEN_FOR_BIDS', 'expiresAt': { $gt: ?0 } }")
    List<TravelRequirement> findOpenRequirements(LocalDateTime now);

    List<TravelRequirement> findByAgentId(String agentId);

    @Query("{ 'userId': ?0, 'status': { $in: ['PENDING', 'OPEN_FOR_BIDS', 'BIDS_RECEIVED'] } }")
    List<TravelRequirement> findActiveByUserId(String userId);
}