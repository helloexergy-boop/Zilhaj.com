package com.umrah.api.repository;

import com.umrah.api.model.AgentOffer;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AgentOfferRepository extends MongoRepository<AgentOffer, String> {

    List<AgentOffer> findByRequirementId(String requirementId);

    List<AgentOffer> findByAgentId(String agentId);

    List<AgentOffer> findByRequirementIdAndStatus(String requirementId, String status);

    @Query("{ 'requirementId': ?0, 'status': 'PENDING' }")
    List<AgentOffer> findPendingOffersForRequirement(String requirementId);

    @Query("{ 'requirementId': ?0, 'sersResponse': 'ACCEPTED' }")
    Optional<AgentOffer> findAcceptedOfferForRequirement(String requirementId);
}