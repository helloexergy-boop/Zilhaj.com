package com.umrah.api.dto;

/**
 * Standard API JSON message wrapper response for operation notifications and errors.
 */
public class MessageResponse {

    // Descriptive message text
    private String message;

    public MessageResponse(String message) {
        this.message = message;
    }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
}
