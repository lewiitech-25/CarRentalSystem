/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package carrentalsystem;

/**
 *
 * @author YourName
 */
public class Customer {

    private String customerId;
    private String name;
    private String email;
    private String phone;
    private String licenseNumber;
    

    // This constructor is used to create a new Customer object
    public Customer(String customerId, String name, String email, String phone, String licenseNumber) {
        this.customerId = customerId;
        this.name = name;
        this.email = email;
        this.phone = phone;
        this.licenseNumber = licenseNumber;
    }

    // GETTERS (To let other classes read our private data)
    public String getName() {
        return this.name;
    }

    public String getCustomerId() {
        return this.customerId;
    }

    public String getEmail() {
        return this.email;
    }

    public String getPhone() {
        return this.phone;
    }

    public String getLicenseNumber() {
        return this.licenseNumber;
    }
}
