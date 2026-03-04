package frontend;

import carrentalsystem.Car;
import java.awt.BorderLayout;
import java.awt.GridLayout;
import java.awt.Window;
import java.util.List;
import javax.swing.JButton;
import javax.swing.JDialog;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.JTextField;
import javax.swing.table.DefaultTableModel;

/**
 * Dialog that allows basic CRUD operations on cars.
 */
public class CarManagementDialog extends JDialog {

    private final DashboardService service;
    private final JTable table;
    private final DefaultTableModel model;

    public CarManagementDialog(Window owner, DashboardService service) {
        super(owner, "Manage Cars", ModalityType.APPLICATION_MODAL);
        this.service = service;

        setLayout(new BorderLayout(10, 10));

        String[] columns = new String[]{
            "ID", "Make", "Model", "Year", "Category", "Price/Day", "License Plate"
        };
        model = new DefaultTableModel(columns, 0) {
            @Override
            public boolean isCellEditable(int row, int column) {
                return false;
            }
        };
        table = new JTable(model);
        loadCars();

        add(new JScrollPane(table), BorderLayout.CENTER);

        JPanel buttonsPanel = new JPanel();
        JButton addButton = new JButton("Add");
        JButton editButton = new JButton("Edit");
        JButton deleteButton = new JButton("Delete");
        JButton closeButton = new JButton("Close");

        buttonsPanel.add(addButton);
        buttonsPanel.add(editButton);
        buttonsPanel.add(deleteButton);
        buttonsPanel.add(closeButton);

        add(buttonsPanel, BorderLayout.SOUTH);

        addButton.addActionListener(e -> onAdd());
        editButton.addActionListener(e -> onEdit());
        deleteButton.addActionListener(e -> onDelete());
        closeButton.addActionListener(e -> dispose());

        pack();
        setLocationRelativeTo(owner);
    }

    private void loadCars() {
        model.setRowCount(0);
        List<Car> cars = service.getCars();
        for (Car car : cars) {
            Object[] row = new Object[]{
                car.getCarId(),
                car.getMake(),
                car.getModel(),
                car.getStatus(), // placeholder for year, will adjust if year getter exists later
                car.getCategory(),
                car.getPricePerDay(),
                car.toString()
            };
            model.addRow(row);
        }
    }

    private void onAdd() {
        CarFormResult result = showCarForm(null);
        if (result == null) {
            return;
        }
        Car car = new Car(result.id, result.make, result.model, result.year, result.category, result.pricePerDay, result.licensePlate);
        service.addCar(car);
        loadCars();
    }

    private void onEdit() {
        int row = table.getSelectedRow();
        if (row < 0) {
            JOptionPane.showMessageDialog(this, "Please select a car to edit.", "Info", JOptionPane.INFORMATION_MESSAGE);
            return;
        }
        String id = (String) model.getValueAt(row, 0);
        String make = (String) model.getValueAt(row, 1);
        String modelValue = (String) model.getValueAt(row, 2);
        String category = (String) model.getValueAt(row, 4);
        double pricePerDay = Double.parseDouble(model.getValueAt(row, 5).toString());
        String licensePlate = model.getValueAt(row, 6).toString();

        CarFormResult initial = new CarFormResult(id, make, modelValue, 2020, category, pricePerDay, licensePlate);
        CarFormResult result = showCarForm(initial);
        if (result == null) {
            return;
        }
        Car updatedCar = new Car(result.id, result.make, result.model, result.year, result.category, result.pricePerDay, result.licensePlate);
        service.updateCar(updatedCar);
        loadCars();
    }

    private void onDelete() {
        int row = table.getSelectedRow();
        if (row < 0) {
            JOptionPane.showMessageDialog(this, "Please select a car to delete.", "Info", JOptionPane.INFORMATION_MESSAGE);
            return;
        }
        String id = (String) model.getValueAt(row, 0);
        int confirm = JOptionPane.showConfirmDialog(this, "Delete car " + id + "?", "Confirm", JOptionPane.YES_NO_OPTION);
        if (confirm == JOptionPane.YES_OPTION) {
            service.removeCar(id);
            loadCars();
        }
    }

    private CarFormResult showCarForm(CarFormResult initial) {
        JTextField idField = new JTextField();
        JTextField makeField = new JTextField();
        JTextField modelField = new JTextField();
        JTextField yearField = new JTextField();
        JTextField categoryField = new JTextField();
        JTextField priceField = new JTextField();
        JTextField plateField = new JTextField();

        if (initial != null) {
            idField.setText(initial.id);
            idField.setEditable(false);
            makeField.setText(initial.make);
            modelField.setText(initial.model);
            yearField.setText(Integer.toString(initial.year));
            categoryField.setText(initial.category);
            priceField.setText(Double.toString(initial.pricePerDay));
            plateField.setText(initial.licensePlate);
        }

        JPanel panel = new JPanel(new GridLayout(7, 2, 5, 5));
        panel.add(new JLabel("ID:"));
        panel.add(idField);
        panel.add(new JLabel("Make:"));
        panel.add(makeField);
        panel.add(new JLabel("Model:"));
        panel.add(modelField);
        panel.add(new JLabel("Year:"));
        panel.add(yearField);
        panel.add(new JLabel("Category:"));
        panel.add(categoryField);
        panel.add(new JLabel("Price/Day:"));
        panel.add(priceField);
        panel.add(new JLabel("License Plate:"));
        panel.add(plateField);

        int result = JOptionPane.showConfirmDialog(this, panel, "Car Details", JOptionPane.OK_CANCEL_OPTION, JOptionPane.PLAIN_MESSAGE);
        if (result != JOptionPane.OK_OPTION) {
            return null;
        }

        try {
            String id = idField.getText().trim();
            String make = makeField.getText().trim();
            String modelValue = modelField.getText().trim();
            int year = Integer.parseInt(yearField.getText().trim());
            String category = categoryField.getText().trim();
            double pricePerDay = Double.parseDouble(priceField.getText().trim());
            String licensePlate = plateField.getText().trim();

            if (id.isEmpty() || make.isEmpty() || modelValue.isEmpty() || category.isEmpty() || licensePlate.isEmpty()) {
                JOptionPane.showMessageDialog(this, "All fields are required.", "Error", JOptionPane.ERROR_MESSAGE);
                return null;
            }

            return new CarFormResult(id, make, modelValue, year, category, pricePerDay, licensePlate);
        } catch (NumberFormatException ex) {
            JOptionPane.showMessageDialog(this, "Invalid number format.", "Error", JOptionPane.ERROR_MESSAGE);
            return null;
        }
    }

    private static class CarFormResult {

        final String id;
        final String make;
        final String model;
        final int year;
        final String category;
        final double pricePerDay;
        final String licensePlate;

        CarFormResult(String id, String make, String model, int year, String category, double pricePerDay, String licensePlate) {
            this.id = id;
            this.make = make;
            this.model = model;
            this.year = year;
            this.category = category;
            this.pricePerDay = pricePerDay;
            this.licensePlate = licensePlate;
        }
    }
}

