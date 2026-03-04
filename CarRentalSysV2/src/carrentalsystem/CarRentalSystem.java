/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Main.java to edit this template
 */
package carrentalsystem;

// We need to import all our blueprints and the Date utility
import java.util.Date;
import java.util.List;

/**
 *
 * @author YourName
 */
public class CarRentalSystem {

    /**
     * @param args the command line arguments
     * This is the main "test script" that runs our system.
     */
    public static void main(String[] args) {
        
        System.out.println("Car Rental System");

        // Create our objects that we need to run the car rental system
        PaymentGateway gateway = new PaymentGateway("Gateway 1", "Gateway API"); //this object being created is just a simulation not connected to a real gateway
        Cardatabase database = new Cardatabase(); //used to create a list object that will hold all the cars its the storage area or database
        System.out.println("System services (Database, Payment Gateway) are online.");
        
//Car object creation
        // Create some Car objects and add them to the database
        Car car1 = new Car("C001", "Toyota", "Crown", 2022, "Sedan", 45000.0, "KCE 354I");
        Car car2 = new Car("C002", "Subaru", "Outback", 2023, "SUV", 50000.0, "KDA 290T");
        Car car3 = new Car("C003", "Suzuki", "Alto", 2021, "Hatchback", 25000.0, "KBU 358Z");
        
        database.addCar(car1);
        database.addCar(car2);
        database.addCar(car3);
        System.out.println("Database populated with 3 cars.");
        
//Customer object creation
        // Create a customer
        Customer cust1 = new Customer("Customer1", "Mohammed Salah", "MoSalah@gmail.com", "0735092654", "DL1-9860");
        
        // The customer searches for a "Sedan"
        System.out.println("\n  Customer 'Mohammed Salah' is searching for a Sedan...");
        List<Car> searchResults = database.getAvailableCars("Sedan");
        
        // Print the search results
        for (Car car : searchResults) {
            System.out.println("Found: " + car.toString());
        }
        
//Customer Booking
        // The customer (customer1) decides to book the first search result (car1)
        System.out.println("\n   Simulating Booking for Car C001...");
        Car carToBook = database.getCarById("C001");
        
        // We set the start and end dates for the booking
        Date startDate = new Date(); // today
        // Get today's time in milliseconds and add 3 days (in milliseconds)
        Date endDate = new Date(startDate.getTime() + (3 * 24 * 60 * 60 * 1000)); 

        // Create the booking using the static method
        Booking booking1 = Booking.createBooking(cust1, carToBook, startDate, endDate);
        
        // Update the car's status in the database
        database.updateCarStatus(carToBook.getCarId(), "Rented");
        System.out.println("Booking created: " + booking1.getBookingId());

        // Now we must process the payment for the booking
        System.out.println("\n   Simulating Payment for Booking...");
        
        // First, calculate the total on the booking object
        booking1.calculateTotal(carToBook.getPricePerDay());
        System.out.println("Calculated total: Ksh" + booking1.getTotalAmount());
        
        // Use the gateway to create a 'Payment' object
        Payment payment = gateway.makePayment(booking1, "Credit Card");
        
        // Use the gateway to process the payment
        boolean paymentSuccessful = gateway.processPayment(payment);
        
//Booking confirmation
        // If the payment was successful, we confirm the booking
        if (paymentSuccessful) {
            booking1.confirmBooking();
        }
        
        // This is the final line, like in the lecturer's project,
        // to prove all the links worked.
        System.out.println("\n    FINAL STATUS ");
        System.out.println("Booking: " + booking1.getBookingId() + " has status: " + booking1.getStatus());
        System.out.println("Car: " + carToBook.getModel() + " has status: " + carToBook.getStatus());
        System.out.println("Payment: " + payment.getPaymentId() + " has status: " + payment.getStatus());
    }
}
