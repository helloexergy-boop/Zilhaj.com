package com.umrah.api.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * Review Document stored in MongoDB under the 'reviews' collection.
 * Holds customer feedback, star ratings, and review comments for completed Umrah packages.
 */
@Document(collection = "reviews")
public class Review {

    // Unique MongoDB Document Identifier for this review
    @Id
    private String id;

    // Foreign key reference to the User writing the review
    private String userId;

    // Display name of the user writing the review
    private String userName;

    // Foreign key reference to the package being reviewed
    private String packageId;

    // Numerical rating score from 1 to 5 stars
    private int rating;

    // Review text feedback comment
    private String comment;

    // Date and time when the review was posted
    private LocalDateTime createdAt = LocalDateTime.now();

    // Default constructor
    public Review() {}

    // Parametrized constructor
    public Review(String userId, String userName, String packageId, int rating, String comment) {
        this.userId = userId;
        this.userName = userName;
        this.packageId = packageId;
        this.rating = rating;
        this.comment = comment;
        this.createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }

    public String getPackageId() { return packageId; }
    public void setPackageId(String packageId) { this.packageId = packageId; }

    public int getRating() { return rating; }
    public void setRating(int rating) { this.rating = rating; }

    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
