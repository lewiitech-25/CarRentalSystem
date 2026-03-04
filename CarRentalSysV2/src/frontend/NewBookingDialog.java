package frontend;

import carrentalsystem.Booking;
import carrentalsystem.Car;
import carrentalsystem.Customer;
import java.awt.BorderLayout;
import java.awt.GridLayout;
import java.awt.Window;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import javax.swing.JButton;
import javax.swing.JComboBox;
import javax.swing.JDialog;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JTextField;

/**
 * Dialog used to create a new booking from existing customers and cars.
 */
public class NewBookingDialog extends JDialog {

    private final DashboardService service;
    private final JComboBox<Customer> customerComboBox;
    private final JComboBox<Car> carComboBox;
    private final JTextField startDateField;
    private final JTextField endDateField;

    private final SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd");

    public NewBookingDialog(Window owner, DashboardService service) {
        super(owner, "New Booking", ModalityType.APPLICATION_MODAL);
        this.service = service;

        setLayout(new BorderLayout(10, 10));

        JPanel formPanel = new JPanel(new GridLayout(4, 2, 5, 5));

        formPanel.add(new JLabel("Customer:"));
        customerComboBox = new JComboBox<>();
        populateCustomers();
        formPanel.add(customerComboBox);

        formPanel.add(new JLabel("Car:"));
        carComboBox = new JComboBox<>();
        populateCars();
        formPanel.add(carComboBox);

        formPanel.add(new JLabel("Start Date (yyyy-MM-dd):"));
        startDateField = new JTextField();
        formPanel.add(startDateField);

        formPanel.add(new JLabel("End Date (yyyy-MM-dd):"));
        endDateField = new JTextField();
        formPanel.add(endDateField);

        add(formPanel, BorderLayout.CENTER);

        JPanel buttonsPanel = new JPanel();
        JButton createButton = new JButton("Create");
        JButton cancelButton = new JButton("Cancel");
        buttonsPanel.add(createButton);
        buttonsPanel.add(cancelButton);

        add(buttonsPanel, BorderLayout.SOUTH);

        createButton.addActionListener(e -> onCreate());
        cancelButton.addActionListener(e -> dispose());

        pack();
        setLocationRelativeTo(owner);
    }

    private void populateCustomers() {
        List<Customer> customers = service.getCustomers();
        for (Customer customer : customers) {
            customerComboBox.addItem(customer);
        }
    }

    private void populateCars() {
        List<Car> cars = service.getCars();
        for (Car car : cars) {
            carComboBox.addItem(car);
        }
    }

    private void onCreate() {
        if (customerComboBox.getItemCount() == 0) {
            JOptionPane.showMessageDialog(this, "No customers available.", "Error", JOptionPane.ERROR_MESSAGE);
            return;
        }
        if (carComboBox.getItemCount() == 0) {
            JOptionPane.showMessageDialog(this, "No cars available.", "Error", JOptionPane.ERROR_MESSAGE);
            return;
        }

        Customer customer = (Customer) customerComboBox.getSelectedItem();
        Car car = (Car) carComboBox.getSelectedItem();

        if (customer == null || car == null) {
            JOptionPane.showMessageDialog(this, "Please select both a customer and a car.", "Error", JOptionPane.ERROR_MESSAGE);
            return;
        }

        Date startDate;
        Date endDate;
        try {
            startDate = dateFormat.parse(startDateField.getText().trim());
            endDate = dateFormat.parse(endDateField.getText().trim());
        } catch (ParseException ex) {
            JOptionPane.showMessageDialog(this, "Invalid date format. Please use yyyy-MM-dd.", "Error", JOptionPane.ERROR_MESSAGE);
            return;
        }

        if (endDate.before(startDate)) {
            JOptionPane.showMessageDialog(this, "End date cannot be before start date.", "Error", JOptionPane.ERROR_MESSAGE);
            return;
        }

        Booking booking = service.createAndAddBooking(customer, car, startDate, endDate);
        if (booking == null) {
            JOptionPane.showMessageDialog(this, "Failed to create booking.", "Error", JOptionPane.ERROR_MESSAGE);
            return;
        }

        JOptionPane.showMessageDialog(this, "Booking created: " + booking.getBookingId(), "Success", JOptionPane.INFORMATION_MESSAGE);
        dispose();
    }
}

