/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package carrentalsystem;

// We need to import these to use List and ArrayList
import java.util.ArrayList;
import java.util.List;

/**
 *
 * @author YourName
 */
public class Cardatabase { //this is the database where we will store our car objects
    

    // It's a list that will hold all of our Car objects
    private List<Car> cars;

    // This is used to set up the database when the system starts
    public Cardatabase() {
        // We must initialize the list, otherwise it will be 'null' (empty)
        this.cars = new ArrayList<>();
    }

//this method adds a car to the cars list we just created
    public void addCar(Car car) {
        this.cars.add(car);
    }

//this method removes a car from the cars list we just created
    public void removeCar(Car car) {
        this.cars.remove(car);
    }

    /**
     * This method finds a specific car in the list by its ID.
     * It loops through all cars until it finds a match.
     * It returns the 'Car' object if found, or 'null' (nothing) if not found.
     */
    public Car getCarById(String carId) {
        for (Car car : this.cars) { // Loop through each car in the 'cars' list
            if (car.getCarId().equals(carId)) { // Check if the car's ID matches
                return car; // Return the matching car object
            }
        }
        return null; // Return null if no car was found with that ID
    }

    /**
     * This method finds all cars that match a certain criteria (e.g., "Available").
     * It returns a new list containing only the matching cars.
     */
    public List<Car> getAvailableCars(String criteria) {
        List<Car> availableCars = new ArrayList<>(); // Create a new, empty list
        
        for (Car car : this.cars) { // Loop through all cars in the database
            // We check if the car is available AND if its category matches the criteria
            // We use equalsIgnoreCase to allow "Sedan" or "sedan"
            if (car.isAvailable() && car.getCategory().equalsIgnoreCase(criteria)) {
                availableCars.add(car); // Add the matching car to our new list
            }
        }
        return availableCars; // Return the list of available cars
    }

    //This method finds a car and updates its status that is if its rented or available
    public void updateCarStatus(String carId, String status) {
        Car carToUpdate = this.getCarById(carId); // First, find the car
        if (carToUpdate != null) { // Check if the car was found
            carToUpdate.setStatus(status); // Use the car's own setStatus method
        } else {
           //because for this system everything is hardcoded there wont be an error message
        }
    }
}