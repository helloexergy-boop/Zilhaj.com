package com.umrah.api.repository;

import com.umrah.api.model.Requirement;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Spring Data Mongo Repository for Requirement entity operations.
 */
@Repository
public interface RequirementRepository extends MongoRepository<Requirement, String> {
    List<Requirement> findByUserId(String userId);
}
