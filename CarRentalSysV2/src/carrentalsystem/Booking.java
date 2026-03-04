/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package carrentalsystem;

// We need to import these to use the Date type and TimeUnit for math
import java.util.Date;
import java.util.concurrent.TimeUnit;

/**
 *
 * @author YourName
 */
public class Booking {
    
    private String bookingId;
    private String customerId; // This links to the Customer
    private String carId;      // This links to the Car
    private Date startDate;
    private Date endDate;
    private double totalAmount;
    private String status;     // e.g., "Pending", "Confirmed", "Cancelled"
    
    // This is used by the createBooking method to set up the object
    public Booking(String bookingId, String customerId, String carId, Date startDate, Date endDate) {
        this.bookingId = bookingId;
        this.customerId = customerId;
        this.carId = carId;
        this.startDate = startDate;
        this.endDate = endDate;
        this.status = "Pending"; // New bookings always start as "Pending"
        this.totalAmount = 0.0;  // We calculate this later
    }
    
    /**
     * It creates and returns a new Booking object.
     */
    public static Booking createBooking(Customer customer, Car car, Date startDate, Date endDate) {
        // We can create a unique booking ID from the customer and car IDs
        String newBookingId = "B-" + customer.getCustomerId() + "-" + car.getCarId();
        
        // Create the new Booking object using our constructor
        Booking newBooking = new Booking(newBookingId, customer.getCustomerId(), car.getCarId(), startDate, endDate);
        
        return newBooking; // Return the fully-formed object
    }
    
    /**
     * This method confirms the booking.
     */
    public void confirmBooking() {
        this.status = "Confirmed";
    }
    
    /**
     * This method cancels the booking.
     */
    public void cancelBooking() {
        this.status = "Cancelled";
    }
    
    /**
     * This method calculates the total cost of the rental.
     * It needs the pricePerDay from the Car object.
     */
    public void calculateTotal(double pricePerDay) {
        // Get the time difference in milliseconds
        long diffInMillies = this.endDate.getTime() - this.startDate.getTime();
        
        // Convert milliseconds to days (using the TimeUnit helper)
        long diffInDays = TimeUnit.MILLISECONDS.toDays(diffInMillies);
        
        // Enforce a 1-day minimum charge
        if (diffInDays == 0) {
            diffInDays = 1;
        }
        
        // Set the total amount property
        this.totalAmount = diffInDays * pricePerDay;
    }
    
    // GETTERS (To let other classes read our private data) ---
    
    public String getBookingId() {
        return this.bookingId;
    }

    public String getCustomerId() {
        return this.customerId;
    }

    public String getCarId() {
        return this.carId;
    }

    public double getTotalAmount() {
        return this.totalAmount;
    }

    public String getStatus() {
        return this.status;
    }
    
    public Date getStartDate() {
        return startDate;
    }

    public Date getEndDate() {
        return endDate;
    }
}
