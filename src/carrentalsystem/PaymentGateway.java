/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package carrentalsystem;

/**
 *
 * @author YourName
 */
public class PaymentGateway {

    // These would be the details for connecting to a real payment service like PayPal or Mpesa
    private String gatewayId;
    private String apiKey;

    // This is used to set up the payment gateway when the system starts
    public PaymentGateway(String gatewayId, String apiKey) {
        this.gatewayId = gatewayId;
        this.apiKey = apiKey;
    }


    /**
     * This method creates a new Payment object for a specific booking.
     * It takes the booking and the payment method.
     * It returns the new, Pending Payment object.
     */
    public Payment makePayment(Booking booking, String paymentMethod) {
        // Create a unique payment ID based on the booking ID
        String paymentId = "P-" + booking.getBookingId();
        
        // Get the total amount that was calculated in the booking
        double amount = booking.getTotalAmount();
        
        // Create the new Payment object using its constructor
        Payment newPayment = new Payment(paymentId, booking.getBookingId(), amount, paymentMethod);
        
        return newPayment; // Return the newly created payment
    }

    //This method simulates processing a payment..

    public boolean processPayment(Payment paymentToProcess) {
        System.out.println("Processing payment " + paymentToProcess.getPaymentId() + " for Ksh" + paymentToProcess.getAmount() + "...");
        
        // Simulation
        // We'll just pretend the payment is always approved
        boolean paymentSuccess = true;

        if (paymentSuccess) {
            // We use the method from the Payment class to update its status
            paymentToProcess.markAsCompleted();
            System.out.println("Payment Successful.");
            return true;
        } else {
            // If it failed, we would mark it as failed
            paymentToProcess.markAsFailed();
            System.out.println("Payment Failed.");
            return false;
        }
    }
}