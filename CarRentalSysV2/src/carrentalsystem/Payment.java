/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package carrentalsystem;

// We need to import this to use the 'Date' type for the timestamp
import java.util.Date;

/**
 *
 * @author YourName
 */
public class Payment {

    private String paymentId;
    private String bookingId; // This links the payment to a specific booking
    private double amount;
    private String paymentMethod; // e.g., "Credit Card", "Mpesa"
    private String status;        // e.g., "Pending", "Completed", "Failed"
    private Date timestamp;     // The exact time the payment was processed

    // This is used by the PaymentGateway to create a new payment object
    public Payment(String paymentId, String bookingId, double amount, String paymentMethod) {
        this.paymentId = paymentId;
        this.bookingId = bookingId;
        this.amount = amount;
        this.paymentMethod = paymentMethod;
        
        this.status = "Pending"; // All new payments start as "Pending"
        this.timestamp = new Date(); // Set the timestamp to the moment of creation
    }

    /**
     * This method marks the payment as 'Completed'
     * and updates the timestamp to the completion time.
     * These methods are used by the PaymentGateway to update the payment's status
     */
    public void markAsCompleted() {
        this.status = "Completed";
        this.timestamp = new Date(); // Update timestamp to show completion time
    }

    /**
     * This method marks the payment as 'Failed'.
     */
    public void markAsFailed() {
        this.status = "Failed";
    }
    
    // GETTERS (To let other classes read our private data)
    
    public String getPaymentId() {
        return this.paymentId;
    }

    public String getBookingId() {
        return this.bookingId;
    }

    public double getAmount() {
        return this.amount;
    }

    public String getStatus() {
        return this.status;
    }

    public Date getTimestamp() {
        return this.timestamp;
    }
    

    // This method returns a simple string summary of the payment
    @Override
    public String toString() {
        return "Payment [ID: " + this.paymentId + ", Amount: KSh" + this.amount + ", Status: " + this.status + "]";
    }
}