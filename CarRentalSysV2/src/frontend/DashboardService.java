package frontend;

import carrentalsystem.Car;
import carrentalsystem.Customer;
import carrentalsystem.Booking;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

/**
 * Simple service class used by the dashboard UI to read data
 * from the existing domain objects and calculate summary metrics.
 */
public class DashboardService {

    private final List<Car> cars;
    private final List<Customer> customers;
    private final List<Booking> bookings;

    public DashboardService(List<Car> cars, List<Customer> customers, List<Booking> bookings) {
        this.cars = cars;
        this.customers = customers;
        this.bookings = bookings;
    }

    public int getTotalCars() {
        return cars.size();
    }

    public int getTotalCustomers() {
        return customers.size();
    }

    public int getAvailableCarsToday() {
        Date today = new Date();
        int count = 0;
        for (Car car : cars) {
            boolean bookedToday = false;
            for (Booking booking : bookings) {
                if (!"Confirmed".equals(booking.getStatus())) {
                    continue;
                }
                if (!booking.getCarId().equals(car.getCarId())) {
                    continue;
                }
                Date start = booking.getStartDate();
                Date end = booking.getEndDate();
                if (!today.before(start) && !today.after(end)) {
                    bookedToday = true;
                    break;
                }
            }
            if (!bookedToday) {
                count++;
            }
        }
        return count;
    }

    public int getActiveBookingsToday() {
        Date today = new Date();
        int count = 0;
        for (Booking booking : bookings) {
            if (!"Confirmed".equals(booking.getStatus())) {
                continue;
            }
            Date start = booking.getStartDate();
            Date end = booking.getEndDate();
            if (!today.before(start) && !today.after(end)) {
                count++;
            }
        }
        return count;
    }

    public double getTotalRevenue() {
        double total = 0.0;
        for (Booking booking : bookings) {
            if ("Confirmed".equals(booking.getStatus())) {
                total += booking.getTotalAmount();
            }
        }
        return total;
    }

    public List<Booking> getRecentBookings(int limit) {
        List<Booking> result = new ArrayList<>();
        int size = bookings.size();
        if (size == 0) {
            return result;
        }
        int startIndex = Math.max(0, size - limit);
        for (int i = startIndex; i < size; i++) {
            result.add(bookings.get(i));
        }
        return result;
    }
}

