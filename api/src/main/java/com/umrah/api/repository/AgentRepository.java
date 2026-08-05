package com.umrah.api.repository;

import com.umrah.api.model.Agent;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data Mongo Repository for Agent entity operations.
 */
@Repository
public interface AgentRepository extends MongoRepository<Agent, String> {

    // Finds an agent record linked to a specific user account ID
    Optional<Agent> findByUserId(String userId);

    // Retrieves all agents by their verification status (e.g. PENDING for admin review)
    List<Agent> findByVerificationStatus(String verificationStatus);
}
