package frontend;

import javax.swing.JFrame;
import javax.swing.SwingUtilities;

/**
 * Simple top-level window that hosts the DashboardPanel.
 */
public class DashboardFrame extends JFrame {

    public DashboardFrame(DashboardService service) {
        super("Car Rental Dashboard");

        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setSize(900, 600);
        setLocationRelativeTo(null);

        DashboardPanel panel = new DashboardPanel(service);
        setContentPane(panel);
    }

    public static void showDashboard(DashboardService service) {
        SwingUtilities.invokeLater(() -> {
            DashboardFrame frame = new DashboardFrame(service);
            frame.setVisible(true);
        });
    }
}

