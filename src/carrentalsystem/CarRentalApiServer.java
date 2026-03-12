package carrentalsystem;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import frontend.DashboardService;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Lightweight HTTP API that exposes in-memory data for the web frontend.
 */
public class CarRentalApiServer {

    private static final long DAY_MS = 24L * 60 * 60 * 1000;
    private static final Pattern JSON_PAIR_PATTERN = Pattern.compile("\\\"([^\\\"]+)\\\"\\s*:\\s*(\\\"((?:\\\\.|[^\\\"])*)\\\"|[^,}\\s]+)");

    private final DashboardService service;
    private final PaymentGateway paymentGateway;

    public CarRentalApiServer(DashboardService service) {
        this(service, new PaymentGateway("Gateway 1", "Gateway API"));
    }

    public CarRentalApiServer(DashboardService service, PaymentGateway paymentGateway) {
        this.service = service;
        this.paymentGateway = paymentGateway;
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
        System.out.println("Endpoints:");
        System.out.println("GET  /api/health");
        System.out.println("GET  /api/dashboard");
        System.out.println("GET  /api/cars");
        System.out.println("POST /api/cars");
        System.out.println("GET  /api/customers");
        System.out.println("POST /api/customers");
        System.out.println("GET  /api/bookings");
        System.out.println("POST /api/bookings");
        System.out.println("POST /api/bookings/cancel");
        System.out.println("POST /api/bookings/return");
        System.out.println("POST /api/payments");
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

            @Override
            protected String handlePost(HttpExchange exchange) throws IOException {
                Map<String, String> body = parseRequestBody(exchange);

                String make = requireField(body, "make");
                String model = requireField(body, "model");
                String category = requireField(body, "category");
                String licensePlate = defaultIfBlank(body.get("licensePlate"), "N/A");
                int year = parsePositiveInt(requireField(body, "year"), "year");
                double pricePerDay = parsePositiveDouble(requireField(body, "pricePerDay"), "pricePerDay");

                String carId = nextCarId();
                Car car = new Car(carId, make, model, year, category, pricePerDay, licensePlate);
                getService().addCar(car);
                return carJson(car);
            }
        });

        server.createContext("/api/customers", new JsonHandler() {
            @Override
            protected String handleGet(HttpExchange exchange) {
                return buildCustomersJson();
            }

            @Override
            protected String handlePost(HttpExchange exchange) throws IOException {
                Map<String, String> body = parseRequestBody(exchange);

                String name = requireField(body, "name");
                String email = requireField(body, "email");
                String phone = requireField(body, "phone");
                String licenseNumber = defaultIfBlank(body.get("licenseNumber"), "N/A");

                String customerId = nextCustomerId();
                Customer customer = new Customer(customerId, name, email, phone, licenseNumber);
                getService().addCustomer(customer);
                return customerJson(customer);
            }
        });

        server.createContext("/api/bookings", new JsonHandler() {
            @Override
            protected String handleGet(HttpExchange exchange) {
                return buildBookingsJson();
            }

            @Override
            protected String handlePost(HttpExchange exchange) throws IOException {
                Map<String, String> body = parseRequestBody(exchange);

                String customerId = requireField(body, "customerId");
                String carId = requireField(body, "carId");
                int days = parsePositiveInt(defaultIfBlank(body.get("days"), "1"), "days");

                DashboardService currentService = getService();
                Customer customer = currentService.findCustomerById(customerId);
                Car car = currentService.findCarById(carId);
                if (customer == null) {
                    throw new ApiException(400, "Unknown customerId");
                }
                if (car == null) {
                    throw new ApiException(400, "Unknown carId");
                }

                Date startDate = new Date();
                Date endDate = new Date(startDate.getTime() + (days * DAY_MS));

                if (!currentService.isCarAvailableForDates(carId, startDate, endDate)) {
                    throw new ApiException(409, "Selected car is already booked for the requested period");
                }

                String bookingId = nextBookingId();
                Booking booking = currentService.createAndAddBooking(bookingId, customer, car, startDate, endDate);
                if (booking == null) {
                    throw new ApiException(500, "Could not create booking");
                }
                return bookingJson(booking);
            }
        });

        server.createContext("/api/bookings/cancel", new JsonHandler() {
            @Override
            protected String handlePost(HttpExchange exchange) throws IOException {
                Map<String, String> body = parseRequestBody(exchange);
                String bookingId = requireField(body, "bookingId");

                DashboardService currentService = getService();
                Booking booking = currentService.findBookingById(bookingId);
                if (booking == null) {
                    throw new ApiException(404, "Booking not found");
                }
                if (!currentService.cancelBooking(bookingId)) {
                    throw new ApiException(409, "Booking cannot be cancelled");
                }
                Booking updated = currentService.findBookingById(bookingId);
                return bookingJson(updated);
            }
        });

        server.createContext("/api/bookings/return", new JsonHandler() {
            @Override
            protected String handlePost(HttpExchange exchange) throws IOException {
                Map<String, String> body = parseRequestBody(exchange);
                String bookingId = requireField(body, "bookingId");

                DashboardService currentService = getService();
                Booking booking = currentService.findBookingById(bookingId);
                if (booking == null) {
                    throw new ApiException(404, "Booking not found");
                }
                if (!currentService.returnBooking(bookingId)) {
                    throw new ApiException(409, "Booking cannot be marked returned");
                }
                Booking updated = currentService.findBookingById(bookingId);
                return bookingJson(updated);
            }
        });

        server.createContext("/api/payments", new JsonHandler() {
            @Override
            protected String handlePost(HttpExchange exchange) throws IOException {
                Map<String, String> body = parseRequestBody(exchange);
                String bookingId = requireField(body, "bookingId");
                String paymentMethod = defaultIfBlank(body.get("paymentMethod"), "Card");

                DashboardService currentService = getService();
                Booking booking = currentService.findBookingById(bookingId);
                if (booking == null) {
                    throw new ApiException(404, "Booking not found");
                }
                if (!"Confirmed".equals(booking.getStatus())) {
                    throw new ApiException(409, "Only confirmed bookings can be paid");
                }
                if ("Paid".equals(booking.getPaymentStatus())) {
                    throw new ApiException(409, "Booking is already paid");
                }

                Payment payment = paymentGateway.makePayment(booking, paymentMethod);
                boolean success = paymentGateway.processPayment(payment);
                if (!success) {
                    booking.markPaymentFailed();
                    throw new ApiException(402, "Payment failed");
                }
                currentService.markBookingPaid(bookingId);
                return "{"
                        + "\"paymentId\":\"" + escape(payment.getPaymentId()) + "\","
                        + "\"bookingId\":\"" + escape(payment.getBookingId()) + "\","
                        + "\"status\":\"" + escape(payment.getStatus()) + "\","
                        + "\"paymentMethod\":\"" + escape(payment.getPaymentMethod()) + "\""
                        + "}";
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
        Date threeDaysLater = new Date(today.getTime() + (3L * DAY_MS));

        Booking booking1 = Booking.createBooking(cust1, car1, today, threeDaysLater);
        booking1.calculateTotal(car1.getPricePerDay());

        Payment payment = gateway.makePayment(booking1, "Credit Card");
        boolean paymentSuccessful = gateway.processPayment(payment);
        if (paymentSuccessful) {
            booking1.confirmBooking();
            booking1.markAsPaid();
            database.updateCarStatus(car1.getCarId(), "Rented");
        }

        allBookings.add(booking1);
        return new DashboardService(allCars, allCustomers, allBookings);
    }

    private String nextCarId() {
        int max = 0;
        for (Car car : getService().getCars()) {
            String numericPart = car.getCarId().replaceAll("\\D", "");
            if (!numericPart.isEmpty()) {
                max = Math.max(max, Integer.parseInt(numericPart));
            }
        }
        return "C" + String.format("%03d", max + 1);
    }

    private String nextCustomerId() {
        int max = 0;
        for (Customer customer : getService().getCustomers()) {
            String numericPart = customer.getCustomerId().replaceAll("\\D", "");
            if (!numericPart.isEmpty()) {
                max = Math.max(max, Integer.parseInt(numericPart));
            }
        }
        return "Customer" + (max + 1);
    }

    private String nextBookingId() {
        int max = 0;
        for (Booking booking : getService().getBookings()) {
            String numericPart = booking.getBookingId().replaceAll("\\D", "");
            if (!numericPart.isEmpty()) {
                max = Math.max(max, Integer.parseInt(numericPart));
            }
        }
        return "B" + String.format("%04d", max + 1);
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
            if (i > 0) {
                sb.append(",");
            }
            sb.append(carJson(cars.get(i)));
        }
        sb.append("]");
        return sb.toString();
    }

    private String buildCustomersJson() {
        StringBuilder sb = new StringBuilder();
        sb.append("[");
        List<Customer> customers = getService().getCustomers();
        for (int i = 0; i < customers.size(); i++) {
            if (i > 0) {
                sb.append(",");
            }
            sb.append(customerJson(customers.get(i)));
        }
        sb.append("]");
        return sb.toString();
    }

    private String buildBookingsJson() {
        StringBuilder sb = new StringBuilder();
        sb.append("[");
        List<Booking> bookings = getService().getBookings();
        for (int i = 0; i < bookings.size(); i++) {
            if (i > 0) {
                sb.append(",");
            }
            sb.append(bookingJson(bookings.get(i)));
        }
        sb.append("]");
        return sb.toString();
    }

    private String carJson(Car car) {
        return "{"
                + "\"carId\":\"" + escape(car.getCarId()) + "\"," 
                + "\"make\":\"" + escape(car.getMake()) + "\"," 
                + "\"model\":\"" + escape(car.getModel()) + "\"," 
                + "\"year\":" + car.getYear() + ","
                + "\"category\":\"" + escape(car.getCategory()) + "\"," 
                + "\"pricePerDay\":" + car.getPricePerDay() + ","
                + "\"status\":\"" + escape(car.getStatus()) + "\"," 
                + "\"licensePlate\":\"" + escape(car.getLicensePlate()) + "\""
                + "}";
    }

    private String customerJson(Customer customer) {
        return "{"
                + "\"customerId\":\"" + escape(customer.getCustomerId()) + "\"," 
                + "\"name\":\"" + escape(customer.getName()) + "\"," 
                + "\"email\":\"" + escape(customer.getEmail()) + "\"," 
                + "\"phone\":\"" + escape(customer.getPhone()) + "\"," 
                + "\"licenseNumber\":\"" + escape(customer.getLicenseNumber()) + "\""
                + "}";
    }

    private String bookingJson(Booking booking) {
        return "{"
                + "\"bookingId\":\"" + escape(booking.getBookingId()) + "\"," 
                + "\"customerId\":\"" + escape(booking.getCustomerId()) + "\"," 
                + "\"carId\":\"" + escape(booking.getCarId()) + "\"," 
                + "\"status\":\"" + escape(booking.getStatus()) + "\"," 
                + "\"paymentStatus\":\"" + escape(booking.getPaymentStatus()) + "\","
                + "\"totalAmount\":" + booking.getTotalAmount() + ","
                + "\"startDate\":\"" + escape(booking.getStartDate().toInstant().toString()) + "\"," 
                + "\"endDate\":\"" + escape(booking.getEndDate().toInstant().toString()) + "\""
                + "}";
    }

    private static Map<String, String> parseRequestBody(HttpExchange exchange) throws IOException {
        String body = readRequestBody(exchange);
        return parseFlatJson(body);
    }

    private static String readRequestBody(HttpExchange exchange) throws IOException {
        try (InputStream input = exchange.getRequestBody()) {
            return new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private static Map<String, String> parseFlatJson(String body) {
        Map<String, String> map = new LinkedHashMap<>();
        if (body == null) {
            return map;
        }
        Matcher matcher = JSON_PAIR_PATTERN.matcher(body);
        while (matcher.find()) {
            String key = matcher.group(1);
            String raw = matcher.group(2);
            String value;
            if (raw.startsWith("\"")) {
                String inner = matcher.group(3) == null ? "" : matcher.group(3);
                value = unescapeJson(inner);
            } else {
                value = raw.trim();
            }
            map.put(key, value);
        }
        return map;
    }

    private static String requireField(Map<String, String> body, String field) {
        String value = body.get(field);
        if (value == null || value.isBlank()) {
            throw new ApiException(400, "Missing field: " + field);
        }
        return value.trim();
    }

    private static String defaultIfBlank(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value.trim();
    }

    private static int parsePositiveInt(String value, String field) {
        try {
            int parsed = Integer.parseInt(value.trim());
            if (parsed <= 0) {
                throw new ApiException(400, field + " must be greater than 0");
            }
            return parsed;
        } catch (NumberFormatException ex) {
            throw new ApiException(400, "Invalid number for " + field);
        }
    }

    private static double parsePositiveDouble(String value, String field) {
        try {
            double parsed = Double.parseDouble(value.trim());
            if (parsed <= 0) {
                throw new ApiException(400, field + " must be greater than 0");
            }
            return parsed;
        } catch (NumberFormatException ex) {
            throw new ApiException(400, "Invalid number for " + field);
        }
    }

    private static String unescapeJson(String input) {
        return input
                .replace("\\\"", "\"")
                .replace("\\\\", "\\")
                .replace("\\n", "\n")
                .replace("\\r", "\r")
                .replace("\\t", "\t");
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
            try {
                if ("OPTIONS".equalsIgnoreCase(method)) {
                    exchange.sendResponseHeaders(204, -1);
                    exchange.close();
                    return;
                }
                if ("GET".equalsIgnoreCase(method)) {
                    sendJson(exchange, 200, handleGet(exchange));
                    return;
                }
                if ("POST".equalsIgnoreCase(method)) {
                    sendJson(exchange, 200, handlePost(exchange));
                    return;
                }
                sendJson(exchange, 405, "{\"error\":\"Method Not Allowed\"}");
            } catch (ApiException ex) {
                sendJson(exchange, ex.statusCode, "{\"error\":\"" + escape(ex.getMessage()) + "\"}");
            }
        }

        protected String handleGet(HttpExchange exchange) throws IOException {
            throw new ApiException(405, "Method Not Allowed");
        }

        protected String handlePost(HttpExchange exchange) throws IOException {
            throw new ApiException(405, "Method Not Allowed");
        }
    }

    private static void addCorsHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
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

    private static class ApiException extends RuntimeException {

        private final int statusCode;

        private ApiException(int statusCode, String message) {
            super(message);
            this.statusCode = statusCode;
        }
    }
}
