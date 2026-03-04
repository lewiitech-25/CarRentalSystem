package frontend;

import carrentalsystem.Customer;
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
 * Dialog that allows basic CRUD operations on customers.
 */
public class CustomerManagementDialog extends JDialog {

    private final DashboardService service;
    private final JTable table;
    private final DefaultTableModel model;

    public CustomerManagementDialog(Window owner, DashboardService service) {
        super(owner, "Manage Customers", ModalityType.APPLICATION_MODAL);
        this.service = service;

        setLayout(new BorderLayout(10, 10));

        String[] columns = new String[]{
            "ID", "Name", "Email", "Phone", "License Number"
        };
        model = new DefaultTableModel(columns, 0) {
            @Override
            public boolean isCellEditable(int row, int column) {
                return false;
            }
        };
        table = new JTable(model);
        loadCustomers();

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

    private void loadCustomers() {
        model.setRowCount(0);
        List<Customer> customers = service.getCustomers();
        for (Customer customer : customers) {
            Object[] row = new Object[]{
                customer.getCustomerId(),
                customer.getName(),
                customer.getEmail(),
                customer.getPhone(),
                customer.getLicenseNumber()
            };
            model.addRow(row);
        }
    }

    private void onAdd() {
        CustomerFormResult result = showCustomerForm(null);
        if (result == null) {
            return;
        }
        Customer customer = new Customer(result.id, result.name, result.email, result.phone, result.licenseNumber);
        service.addCustomer(customer);
        loadCustomers();
    }

    private void onEdit() {
        int row = table.getSelectedRow();
        if (row < 0) {
            JOptionPane.showMessageDialog(this, "Please select a customer to edit.", "Info", JOptionPane.INFORMATION_MESSAGE);
            return;
        }
        String id = (String) model.getValueAt(row, 0);
        String name = (String) model.getValueAt(row, 1);
        String email = (String) model.getValueAt(row, 2);
        String phone = (String) model.getValueAt(row, 3);
        String licenseNumber = (String) model.getValueAt(row, 4);

        CustomerFormResult initial = new CustomerFormResult(id, name, email, phone, licenseNumber);
        CustomerFormResult result = showCustomerForm(initial);
        if (result == null) {
            return;
        }
        Customer updatedCustomer = new Customer(result.id, result.name, result.email, result.phone, result.licenseNumber);
        service.updateCustomer(updatedCustomer);
        loadCustomers();
    }

    private void onDelete() {
        int row = table.getSelectedRow();
        if (row < 0) {
            JOptionPane.showMessageDialog(this, "Please select a customer to delete.", "Info", JOptionPane.INFORMATION_MESSAGE);
            return;
        }
        String id = (String) model.getValueAt(row, 0);
        int confirm = JOptionPane.showConfirmDialog(this, "Delete customer " + id + "?", "Confirm", JOptionPane.YES_NO_OPTION);
        if (confirm == JOptionPane.YES_OPTION) {
            service.removeCustomer(id);
            loadCustomers();
        }
    }

    private CustomerFormResult showCustomerForm(CustomerFormResult initial) {
        JTextField idField = new JTextField();
        JTextField nameField = new JTextField();
        JTextField emailField = new JTextField();
        JTextField phoneField = new JTextField();
        JTextField licenseField = new JTextField();

        if (initial != null) {
            idField.setText(initial.id);
            idField.setEditable(false);
            nameField.setText(initial.name);
            emailField.setText(initial.email);
            phoneField.setText(initial.phone);
            licenseField.setText(initial.licenseNumber);
        }

        JPanel panel = new JPanel(new GridLayout(5, 2, 5, 5));
        panel.add(new JLabel("ID:"));
        panel.add(idField);
        panel.add(new JLabel("Name:"));
        panel.add(nameField);
        panel.add(new JLabel("Email:"));
        panel.add(emailField);
        panel.add(new JLabel("Phone:"));
        panel.add(phoneField);
        panel.add(new JLabel("License Number:"));
        panel.add(licenseField);

        int result = JOptionPane.showConfirmDialog(this, panel, "Customer Details", JOptionPane.OK_CANCEL_OPTION, JOptionPane.PLAIN_MESSAGE);
        if (result != JOptionPane.OK_OPTION) {
            return null;
        }

        String id = idField.getText().trim();
        String name = nameField.getText().trim();
        String email = emailField.getText().trim();
        String phone = phoneField.getText().trim();
        String license = licenseField.getText().trim();

        if (id.isEmpty() || name.isEmpty() || email.isEmpty() || phone.isEmpty() || license.isEmpty()) {
            JOptionPane.showMessageDialog(this, "All fields are required.", "Error", JOptionPane.ERROR_MESSAGE);
            return null;
        }

        return new CustomerFormResult(id, name, email, phone, license);
    }

    private static class CustomerFormResult {

        final String id;
        final String name;
        final String email;
        final String phone;
        final String licenseNumber;

        CustomerFormResult(String id, String name, String email, String phone, String licenseNumber) {
            this.id = id;
            this.name = name;
            this.email = email;
            this.phone = phone;
            this.licenseNumber = licenseNumber;
        }
    }
}

