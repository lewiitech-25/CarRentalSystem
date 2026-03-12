/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Main.java to edit this template
 */
package carrentalsystem;

// We need to import all our blueprints and the Date utility
import frontend.DashboardFrame;
import frontend.DashboardService;
import java.util.ArrayList;
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
        System.out.println("Car Rental System - Dashboard Demo");

        PaymentGateway gateway = new PaymentGateway("Gateway 1", "Gateway API");
        Cardatabase database = new Cardatabase();

        List<Car> allCars = new ArrayList<>();
        List<Customer> allCustomers = new ArrayList<>();
        List<Booking> allBookings = new ArrayList<>();

        Car car1 = new Car("C001", "Toyota", "Crown", 2022, "Sedan", 45000.0, "KCE 354I");
        Car car2 = new Car("C002", "Subaru", "Outback", 2023, "SUV", 50000.0, "KDA 290T");
        Car car3 = new Car("C003", "Suzuki", "Alto", 2021, "Hatchback", 25000.0, "KBU 358Z");

        database.addCar(car1);
        database.addCar(car2);
        database.addCar(car3);

        allCars.add(car1);
        allCars.add(car2);
        allCars.add(car3);

        Customer cust1 = new Customer("Customer1", "Mohammed Salah", "MoSalah@gmail.com", "0735092654", "DL1-9860");
        allCustomers.add(cust1);

        Date today = new Date();
        Date threeDaysLater = new Date(today.getTime() + (3 * 24 * 60 * 60 * 1000));

        Booking booking1 = Booking.createBooking(cust1, car1, today, threeDaysLater);
        booking1.calculateTotal(car1.getPricePerDay());

        Payment payment = gateway.makePayment(booking1, "Credit Card");
        boolean paymentSuccessful = gateway.processPayment(payment);
        if (paymentSuccessful) {
            booking1.confirmBooking();
            database.updateCarStatus(car1.getCarId(), "Rented");
        }

        allBookings.add(booking1);

        DashboardService dashboardService = new DashboardService(allCars, allCustomers, allBookings);
        DashboardFrame.showDashboard(dashboardService);
    }
}
