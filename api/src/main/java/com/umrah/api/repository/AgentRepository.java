package com.umrah.api.repository;

import com.umrah.api.model.Agent;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AgentRepository extends MongoRepository<Agent, String> {

    Optional<Agent> findByEmail(String email);

    Optional<Agent> findByUserId(String userId);

    List<Agent> findByVerifiedTrueAndActiveTrue();

    List<Agent> findByVerifiedTrueAndActiveTrueAndSpecializationsContaining(String specialization);

    List<Agent> findByServiceAreasContaining(String area);

    Optional<Agent> findByCompanyLicenseNumber(String licenseNumber);
}