package carrentalsystem;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import frontend.DashboardService;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

/**
 * Lightweight HTTP API that exposes the same in-memory demo data used by the
 * Swing dashboard, so a web frontend can consume it.
 */
public class CarRentalApiServer {

    private final DashboardService service;

    public CarRentalApiServer(DashboardService service) {
        this.service = service;
    }

    public static void main(String[] args) throws IOException {
        int port = 8080;
        if (args.length > 0) {
            try {
                port = Integer.parseInt(args[0]);
            } catch (NumberFormatException ignored) {
                System.out.println("Invalid port in args, falling back to 8080.");
            }
        }

        DashboardService service = createDemoService();
        CarRentalApiServer apiServer = new CarRentalApiServer(service);
        apiServer.start(port);
        System.out.println("CarRental API running on http://localhost:" + port);
        System.out.println("Endpoints: /api/health, /api/dashboard, /api/cars, /api/customers, /api/bookings");
    }

    public void start(int port) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/api/health", new JsonHandler() {
            @Override
            protected String handleGet(HttpExchange exchange) {
                return "{\"status\":\"ok\"}";
            }
        });
        server.createContext("/api/dashboard", new JsonHandler() {
            @Override
            protected String handleGet(HttpExchange exchange) {
                return buildDashboardJson();
            }
        });
        server.createContext("/api/cars", new JsonHandler() {
            @Override
            protected String handleGet(HttpExchange exchange) {
                return buildCarsJson();
            }
        });
        server.createContext("/api/customers", new JsonHandler() {
            @Override
            protected String handleGet(HttpExchange exchange) {
                return buildCustomersJson();
            }
        });
        server.createContext("/api/bookings", new JsonHandler() {
            @Override
            protected String handleGet(HttpExchange exchange) {
                return buildBookingsJson();
            }
        });
        server.setExecutor(null);
        server.start();
    }

    private DashboardService getService() {
        return this.service;
    }

    private static DashboardService createDemoService() {
        PaymentGateway gateway = new PaymentGateway("Gateway 1", "Gateway API");
        Cardatabase database = new Cardatabase();

        List<Car> allCars = new ArrayList<>();
        List<Customer> allCustomers = new ArrayList<>();
        List<Booking> allBookings = new ArrayList<>();

        Car car1 = new Car("C001", "Toyota", "Crown", 2022, "Sedan", 45000.0, "KCE 354I");
        Car car2 = new Car("C002", "Subaru", "Outback", 2023, "SUV", 50000.0, "KDA 290T");
        Car car3 = new Car("C003", "Suzuki", "Alto", 2021, "Hatchback", 25000.0, "KBU 358Z");

        database.addCar(car1);
        database.addCar(car2);
        database.addCar(car3);

        allCars.add(car1);
        allCars.add(car2);
        allCars.add(car3);

        Customer cust1 = new Customer("Customer1", "Mohammed Salah", "MoSalah@gmail.com", "0735092654", "DL1-9860");
        allCustomers.add(cust1);

        Date today = new Date();
        Date threeDaysLater = new Date(today.getTime() + (3L * 24 * 60 * 60 * 1000));

        Booking booking1 = Booking.createBooking(cust1, car1, today, threeDaysLater);
        booking1.calculateTotal(car1.getPricePerDay());

        Payment payment = gateway.makePayment(booking1, "Credit Card");
        boolean paymentSuccessful = gateway.processPayment(payment);
        if (paymentSuccessful) {
            booking1.confirmBooking();
            database.updateCarStatus(car1.getCarId(), "Rented");
        }

        allBookings.add(booking1);
        return new DashboardService(allCars, allCustomers, allBookings);
    }

    private String buildDashboardJson() {
        DashboardService currentService = getService();
        return "{"
                + "\"totalCars\":" + currentService.getTotalCars() + ","
                + "\"totalCustomers\":" + currentService.getTotalCustomers() + ","
                + "\"availableCarsToday\":" + currentService.getAvailableCarsToday() + ","
                + "\"activeBookingsToday\":" + currentService.getActiveBookingsToday() + ","
                + "\"totalRevenue\":" + currentService.getTotalRevenue()
                + "}";
    }

    private String buildCarsJson() {
        StringBuilder sb = new StringBuilder();
        sb.append("[");
        List<Car> cars = getService().getCars();
        for (int i = 0; i < cars.size(); i++) {
            Car car = cars.get(i);
            if (i > 0) {
                sb.append(",");
            }
            sb.append("{")
                    .append("\"carId\":\"").append(escape(car.getCarId())).append("\",")
                    .append("\"make\":\"").append(escape(car.getMake())).append("\",")
                    .append("\"model\":\"").append(escape(car.getModel())).append("\",")
                    .append("\"year\":").append(car.getYear()).append(",")
                    .append("\"category\":\"").append(escape(car.getCategory())).append("\",")
                    .append("\"pricePerDay\":").append(car.getPricePerDay()).append(",")
                    .append("\"status\":\"").append(escape(car.getStatus())).append("\",")
                    .append("\"licensePlate\":\"").append(escape(car.getLicensePlate())).append("\"")
                    .append("}");
        }
        sb.append("]");
        return sb.toString();
    }

    private String buildCustomersJson() {
        StringBuilder sb = new StringBuilder();
        sb.append("[");
        List<Customer> customers = getService().getCustomers();
        for (int i = 0; i < customers.size(); i++) {
            Customer customer = customers.get(i);
            if (i > 0) {
                sb.append(",");
            }
            sb.append("{")
                    .append("\"customerId\":\"").append(escape(customer.getCustomerId())).append("\",")
                    .append("\"name\":\"").append(escape(customer.getName())).append("\",")
                    .append("\"email\":\"").append(escape(customer.getEmail())).append("\",")
                    .append("\"phone\":\"").append(escape(customer.getPhone())).append("\",")
                    .append("\"licenseNumber\":\"").append(escape(customer.getLicenseNumber())).append("\"")
                    .append("}");
        }
        sb.append("]");
        return sb.toString();
    }

    private String buildBookingsJson() {
        StringBuilder sb = new StringBuilder();
        sb.append("[");
        List<Booking> bookings = getService().getBookings();
        for (int i = 0; i < bookings.size(); i++) {
            Booking booking = bookings.get(i);
            if (i > 0) {
                sb.append(",");
            }
            sb.append("{")
                    .append("\"bookingId\":\"").append(escape(booking.getBookingId())).append("\",")
                    .append("\"customerId\":\"").append(escape(booking.getCustomerId())).append("\",")
                    .append("\"carId\":\"").append(escape(booking.getCarId())).append("\",")
                    .append("\"status\":\"").append(escape(booking.getStatus())).append("\",")
                    .append("\"totalAmount\":").append(booking.getTotalAmount()).append(",")
                    .append("\"startDate\":\"").append(escape(booking.getStartDate().toInstant().toString())).append("\",")
                    .append("\"endDate\":\"").append(escape(booking.getEndDate().toInstant().toString())).append("\"")
                    .append("}");
        }
        sb.append("]");
        return sb.toString();
    }

    private static String escape(String input) {
        if (input == null) {
            return "";
        }
        return input
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    private abstract static class JsonHandler implements HttpHandler {

        @Override
        public final void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            String method = exchange.getRequestMethod();
            if ("OPTIONS".equalsIgnoreCase(method)) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            if (!"GET".equalsIgnoreCase(method)) {
                sendJson(exchange, 405, "{\"error\":\"Method Not Allowed\"}");
                return;
            }
            String json = handleGet(exchange);
            sendJson(exchange, 200, json);
        }

        protected abstract String handleGet(HttpExchange exchange);
    }

    private static void addCorsHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET,OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
    }

    private static void sendJson(HttpExchange exchange, int statusCode, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(statusCode, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }
}
