package com.umrah.api.repository;

import com.umrah.api.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Spring Data Mongo Repository for User entity operations.
 * Provides out-of-the-box CRUD methods (save, findById, findAll, delete) plus custom query methods.
 */
@Repository
public interface UserRepository extends MongoRepository<User, String> {

    // Custom query to find a user by email address
    Optional<User> findByEmail(String email);

    // Custom query to find a user by email or phone number
    Optional<User> findByEmailOrPhone(String email, String phone);

    // Checks if a given email is already registered in MongoDB
    Boolean existsByEmail(String email);

    // Checks if a given phone number is already registered in MongoDB
    Boolean existsByPhone(String phone);
}
