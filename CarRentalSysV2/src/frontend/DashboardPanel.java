package frontend;

import carrentalsystem.Booking;
import java.awt.BorderLayout;
import java.awt.GridLayout;
import java.awt.Window;
import java.text.NumberFormat;
import java.text.SimpleDateFormat;
import java.util.List;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.SwingConstants;
import javax.swing.SwingUtilities;
import javax.swing.table.DefaultTableModel;

/**
 * Main dashboard panel that shows summary metrics and recent bookings.
 */
public class DashboardPanel extends JPanel {

    private final DashboardService service;

    private final JLabel totalCarsValueLabel;
    private final JLabel availableCarsValueLabel;
    private final JLabel activeBookingsValueLabel;
    private final JLabel totalRevenueValueLabel;

    private final JTable bookingsTable;

    public DashboardPanel(DashboardService service) {
        this.service = service;

        // #region agent log
        DebugLogger.log(
                "DashboardPanel.java:37",
                "DashboardPanel constructor start",
                "H1",
                "initial",
                "service=" + (service != null)
        );
        // #endregion

        setLayout(new BorderLayout(10, 10));

        JPanel metricsPanel = new JPanel(new GridLayout(1, 4, 10, 10));

        totalCarsValueLabel = createMetricCard(metricsPanel, "Total Cars");
        availableCarsValueLabel = createMetricCard(metricsPanel, "Available Cars Today");
        activeBookingsValueLabel = createMetricCard(metricsPanel, "Active Bookings Today");
        totalRevenueValueLabel = createMetricCard(metricsPanel, "Total Revenue (Confirmed)");

        add(metricsPanel, BorderLayout.NORTH);

        bookingsTable = new JTable();
        bookingsTable.setFillsViewportHeight(true);
        bookingsTable.setAutoCreateRowSorter(true);

        JScrollPane scrollPane = new JScrollPane(bookingsTable);
        add(scrollPane, BorderLayout.CENTER);

        JPanel buttonsPanel = new JPanel();
        JButton newBookingButton = new JButton("New Booking");
        JButton manageCarsButton = new JButton("Manage Cars");
        JButton manageCustomersButton = new JButton("Manage Customers");
        JButton refreshButton = new JButton("Refresh");

        buttonsPanel.add(newBookingButton);
        buttonsPanel.add(manageCarsButton);
        buttonsPanel.add(manageCustomersButton);
        buttonsPanel.add(refreshButton);

        add(buttonsPanel, BorderLayout.SOUTH);

        refreshButton.addActionListener(e -> {
            // #region agent log
            DebugLogger.log(
                    "DashboardPanel.java:69",
                    "Refresh button clicked",
                    "H1",
                    "initial",
                    ""
            );
            // #endregion
            refreshData();
        });

        newBookingButton.addActionListener(e -> {
            // #region agent log
            DebugLogger.log(
                    "DashboardPanel.java:78",
                    "New Booking button clicked",
                    "H1",
                    "initial",
                    ""
            );
            // #endregion
            openNewBookingDialog();
        });
        manageCarsButton.addActionListener(e -> {
            // #region agent log
            DebugLogger.log(
                    "DashboardPanel.java:89",
                    "Manage Cars button clicked",
                    "H1",
                    "initial",
                    ""
            );
            // #endregion
            openCarManagementDialog();
        });
        manageCustomersButton.addActionListener(e -> {
            // #region agent log
            DebugLogger.log(
                    "DashboardPanel.java:100",
                    "Manage Customers button clicked",
                    "H1",
                    "initial",
                    ""
            );
            // #endregion
            openCustomerManagementDialog();
        });

        refreshData();
    }

    private JLabel createMetricCard(JPanel parent, String title) {
        JPanel card = new JPanel(new BorderLayout());
        JLabel titleLabel = new JLabel(title, SwingConstants.CENTER);
        JLabel valueLabel = new JLabel("0", SwingConstants.CENTER);
        valueLabel.setFont(valueLabel.getFont().deriveFont(18f));

        card.add(titleLabel, BorderLayout.NORTH);
        card.add(valueLabel, BorderLayout.CENTER);

        parent.add(card);
        return valueLabel;
    }

    private Window getParentWindow() {
        Window owner = SwingUtilities.getWindowAncestor(this);
        // #region agent log
        DebugLogger.log(
                "DashboardPanel.java:93",
                "getParentWindow",
                "H2",
                "initial",
                "ownerIsNull=" + (owner == null)
        );
        // #endregion
        return owner;
    }

    private void openNewBookingDialog() {
        Window owner = getParentWindow();
        NewBookingDialog dialog = new NewBookingDialog(owner, service);
        dialog.setVisible(true);
        refreshData();
    }

    private void openCarManagementDialog() {
        Window owner = getParentWindow();
        CarManagementDialog dialog = new CarManagementDialog(owner, service);
        dialog.setVisible(true);
        refreshData();
    }

    private void openCustomerManagementDialog() {
        Window owner = getParentWindow();
        CustomerManagementDialog dialog = new CustomerManagementDialog(owner, service);
        dialog.setVisible(true);
        refreshData();
    }

    public void refreshData() {
        int totalCars = service.getTotalCars();
        int availableCars = service.getAvailableCarsToday();
        int activeBookings = service.getActiveBookingsToday();
        double totalRevenue = service.getTotalRevenue();

        totalCarsValueLabel.setText(String.valueOf(totalCars));
        availableCarsValueLabel.setText(String.valueOf(availableCars));
        activeBookingsValueLabel.setText(String.valueOf(activeBookings));

        NumberFormat currency = NumberFormat.getCurrencyInstance();
        totalRevenueValueLabel.setText(currency.format(totalRevenue));

        List<Booking> recent = service.getRecentBookings(20);

        String[] columnNames = {
            "Booking ID",
            "Customer ID",
            "Car ID",
            "Start Date",
            "End Date",
            "Status",
            "Total Amount"
        };

        DefaultTableModel model = new DefaultTableModel(columnNames, 0) {
            @Override
            public boolean isCellEditable(int row, int column) {
                return false;
            }
        };

        SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd");

        for (Booking booking : recent) {
            Object[] row = new Object[]{
                booking.getBookingId(),
                booking.getCustomerId(),
                booking.getCarId(),
                dateFormat.format(booking.getStartDate()),
                dateFormat.format(booking.getEndDate()),
                booking.getStatus(),
                booking.getTotalAmount()
            };
            model.addRow(row);
        }

        bookingsTable.setModel(model);
    }
}

