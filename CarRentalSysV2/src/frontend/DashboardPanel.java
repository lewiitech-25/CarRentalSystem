package frontend;

import carrentalsystem.Booking;
import java.awt.BorderLayout;
import java.awt.GridLayout;
import java.text.NumberFormat;
import java.text.SimpleDateFormat;
import java.util.List;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.SwingConstants;
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

        refreshButton.addActionListener(e -> refreshData());

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

