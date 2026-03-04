/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package carrentalsystem;

/**
 *
 * @author YourName
 */
public class Car {

    private String carId;
    private String make;
    private String model;
    private int year;
    private String category;
    private double pricePerDay;
    private String status; // e.g., "Available", "Rented"
    private String licensePlate;


    // This constructor is used to create a new Car object and set its initial values
    public Car(String carId, String make, String model, int year, String category, double pricePerDay, String licensePlate) {
        this.carId = carId;
        this.make = make;
        this.model = model;
        this.year = year;
        this.category = category;
        this.pricePerDay = pricePerDay;
        this.licensePlate = licensePlate;
        this.status = "Available"; // Set a default status for new cars
    }


    // This method returns a simple string summary of the car
    public String toString() {
        return this.year + " " + this.make + " " + this.model + " (" + this.licensePlate + ")";
    }

    // This method checks if the car is available
    public boolean isAvailable() {
        return this.status.equals("Available");
    }

    // GETTERS (To let other classes read our private data)
    
    public String getCarId() {
        return this.carId;
    }

    public String getMake() {
        return this.make;
    }

    public String getModel() {
        return this.model;
    }

    public String getCategory() {
        return this.category;
    }

    public double getPricePerDay() {
        return this.pricePerDay;
    }

    public String getStatus() {
        return this.status;
    }
    
    //SETTERS (To let other classes change the private data here)
    
    // The system will need to change a car's status from "Available" to "Rented"
    public void setStatus(String status) {
        this.status = status;
    }
}