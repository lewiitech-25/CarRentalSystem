package carrentalsystem;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import frontend.DashboardService;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
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
    private final PaystackGateway paystackGateway;
    private final OpenAICarRecommendationGateway recommendationGateway;

    public CarRentalApiServer(DashboardService service) {
        this(
                service,
                new PaystackGateway(resolvePaystackSecretKey()),
                new OpenAICarRecommendationGateway(resolveOpenAiApiKey(), resolveOpenAiModel())
        );
    }

    public CarRentalApiServer(DashboardService service, PaystackGateway paystackGateway) {
        this(service, paystackGateway, new OpenAICarRecommendationGateway(resolveOpenAiApiKey(), resolveOpenAiModel()));
    }

    public CarRentalApiServer(
            DashboardService service,
            PaystackGateway paystackGateway,
            OpenAICarRecommendationGateway recommendationGateway
    ) {
        this.service = service;
        this.paystackGateway = paystackGateway;
        this.recommendationGateway = recommendationGateway;
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
        System.out.println("GET  /api/payments/verify?reference=...");
        System.out.println("POST /api/recommend-car");
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
                String payerEmail = resolvePaymentEmail(body.get("email"), bookingId);

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

                String reference = bookingId + "-" + System.currentTimeMillis();
                String callbackUrl = defaultIfBlank(body.get("callbackUrl"), buildPaystackCallbackUrl(exchange));
                String metadataJson = "{"
                        + "\"bookingId\":\"" + escape(bookingId) + "\","
                        + "\"customerId\":\"" + escape(booking.getCustomerId()) + "\""
                        + "}";

                PaystackGateway.InitializeResult initialized = paystackGateway.initializeTransaction(
                        payerEmail,
                        toMinorUnits(booking.getTotalAmount()),
                        reference,
                        callbackUrl,
                        "KES",
                        metadataJson
                );

                return "{"
                        + "\"bookingId\":\"" + escape(bookingId) + "\","
                        + "\"paymentMethod\":\"Paystack\","
                        + "\"reference\":\"" + escape(initialized.getReference()) + "\","
                        + "\"accessCode\":\"" + escape(initialized.getAccessCode()) + "\","
                        + "\"authorizationUrl\":\"" + escape(initialized.getAuthorizationUrl()) + "\""
                        + "}";
            }
        });

        server.createContext("/api/payments/verify", new JsonHandler() {
            @Override
            protected String handleGet(HttpExchange exchange) throws IOException {
                Map<String, String> query = parseQuery(exchange.getRequestURI().getRawQuery());
                String reference = requireField(query, "reference");
                long expectedAmount = parsePositiveLong(requireField(query, "expectedAmount"), "expectedAmount");
                String expectedCurrency = defaultIfBlank(query.get("currency"), "KES");
                String bookingId = extractBookingIdFromReference(reference);

                PaystackGateway.VerifyResult verified = paystackGateway.verifyTransaction(reference);
                if (!"success".equalsIgnoreCase(verified.getStatus())) {
                    throw new ApiException(409, "Paystack payment was not successful.");
                }
                if (!expectedCurrency.equalsIgnoreCase(defaultIfBlank(verified.getCurrency(), expectedCurrency))) {
                    throw new ApiException(409, "Unexpected Paystack currency.");
                }
                if (verified.getAmount() != expectedAmount) {
                    throw new ApiException(409, "Paystack amount does not match booking total.");
                }

                return "{"
                        + "\"bookingId\":\"" + escape(bookingId) + "\","
                        + "\"reference\":\"" + escape(verified.getReference()) + "\","
                        + "\"status\":\"" + escape(verified.getStatus()) + "\","
                        + "\"channel\":\"" + escape(defaultIfBlank(verified.getChannel(), "unknown")) + "\","
                        + "\"gatewayResponse\":\"" + escape(defaultIfBlank(verified.getGatewayResponse(), "Payment verified")) + "\""
                        + "}";
            }
        });

        server.createContext("/api/recommend-car", new JsonHandler() {
            @Override
            protected String handlePost(HttpExchange exchange) throws IOException {
                String rawBody = readRequestBody(exchange);
                System.out.println("[recommend-car] raw request body: " + rawBody);
                Map<String, String> body = parseFlatJson(rawBody);
                System.out.println("[recommend-car] parsed body keys: " + body.keySet());

                double budget = parsePositiveDouble(requireField(body, "budget"), "budget");
                int passengers = parsePositiveInt(requireField(body, "passengers"), "passengers");
                int rentalDuration = parsePositiveInt(requireField(body, "rentalDuration"), "rentalDuration");
                String tripType = requireField(body, "tripType");
                String preferredCategory = defaultIfBlank(body.get("preferredCategory"), "Any");
                String fleetJson = requireField(body, "fleetJson");
                System.out.println("[recommend-car] parsed values -> budget=" + budget
                        + ", passengers=" + passengers
                        + ", rentalDuration=" + rentalDuration
                        + ", tripType=" + tripType
                        + ", preferredCategory=" + preferredCategory
                        + ", fleetJsonLength=" + fleetJson.length());

                List<OpenAICarRecommendationGateway.RecommendationCar> fleet = parseRecommendationFleet(fleetJson);
                List<OpenAICarRecommendationGateway.RecommendationCar> availableFleet = new ArrayList<>();
                for (OpenAICarRecommendationGateway.RecommendationCar car : fleet) {
                    if (car != null) {
                        availableFleet.add(car);
                    }
                }
                System.out.println("[recommend-car] parsed fleet count=" + fleet.size()
                        + ", availableFleet count=" + availableFleet.size());
                if (!availableFleet.isEmpty()) {
                    OpenAICarRecommendationGateway.RecommendationCar firstCar = availableFleet.get(0);
                    System.out.println("[recommend-car] first fleet car -> carId=" + firstCar.getCarId()
                            + ", make=" + firstCar.getMake()
                            + ", model=" + firstCar.getModel()
                            + ", category=" + firstCar.getCategory()
                            + ", pricePerDay=" + firstCar.getPricePerDay()
                            + ", seats=" + firstCar.getSeats());
                }

                if (availableFleet.isEmpty()) {
                    throw new ApiException(400, "No available cars were provided for recommendation.");
                }

                OpenAICarRecommendationGateway.RecommendationRequest request =
                        new OpenAICarRecommendationGateway.RecommendationRequest(
                                budget,
                                passengers,
                                tripType,
                                rentalDuration,
                                preferredCategory,
                                availableFleet
                        );

                OpenAICarRecommendationGateway.RecommendationResult recommendation;
                try {
                    System.out.println("[recommend-car] starting OpenAI recommendation request");
                    recommendation = recommendationGateway.recommend(request);
                    System.out.println("[recommend-car] OpenAI response received -> carId="
                            + recommendation.getCarId() + ", reason=" + recommendation.getReason());
                } catch (IOException ex) {
                    System.out.println("[recommend-car] OpenAI path failed, using local fallback: " + ex.getMessage());
                    recommendation = recommendCarLocally(request, availableFleet);
                    System.out.println("[recommend-car] local fallback selected -> carId="
                            + recommendation.getCarId() + ", reason=" + recommendation.getReason());
                }
                if (!fleetContainsCarId(availableFleet, recommendation.getCarId())) {
                    throw new ApiException(502, "OpenAI returned a carId that was not in the provided fleet.");
                }
                System.out.println("[recommend-car] returned carId validated successfully");

                return "{"
                        + "\"carId\":\"" + escape(recommendation.getCarId()) + "\","
                        + "\"reason\":\"" + escape(recommendation.getReason()) + "\""
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

    private String resolvePaymentEmail(String providedEmail, String bookingId) {
        if (providedEmail != null && !providedEmail.isBlank()) {
            return providedEmail.trim();
        }
        Booking booking = getService().findBookingById(bookingId);
        if (booking != null) {
            Customer customer = getService().findCustomerById(booking.getCustomerId());
            if (customer != null && customer.getEmail() != null && !customer.getEmail().isBlank()) {
                return customer.getEmail().trim();
            }
        }
        throw new ApiException(400, "A payer email is required for Paystack.");
    }

    private String buildPaystackCallbackUrl(HttpExchange exchange) {
        String configuredCallback = defaultIfBlank(resolvePaystackCallbackUrl(), "");
        if (!configuredCallback.isBlank()) {
            return configuredCallback;
        }

        String origin = defaultIfBlank(exchange.getRequestHeaders().getFirst("Origin"), "http://localhost:5173");
        if (origin.contains("?")) {
            return origin + "&paystack=callback";
        }
        if (origin.endsWith("/")) {
            return origin + "?paystack=callback";
        }
        return origin + "/?paystack=callback";
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

    private static Map<String, String> parseQuery(String rawQuery) {
        Map<String, String> query = new LinkedHashMap<>();
        if (rawQuery == null || rawQuery.isBlank()) {
            return query;
        }
        String[] pairs = rawQuery.split("&");
        for (String pair : pairs) {
            if (pair == null || pair.isBlank()) {
                continue;
            }
            String[] keyValue = pair.split("=", 2);
            String key = decodeUrlComponent(keyValue[0]);
            String value = keyValue.length > 1 ? decodeUrlComponent(keyValue[1]) : "";
            query.put(key, value);
        }
        return query;
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

    private static String decodeUrlComponent(String value) {
        return URLDecoder.decode(value == null ? "" : value, StandardCharsets.UTF_8);
    }

    private static long toMinorUnits(double amount) {
        return Math.round(amount * 100.0d);
    }

    private static String extractBookingIdFromReference(String reference) {
        int hyphenIndex = reference.indexOf('-');
        if (hyphenIndex <= 0) {
            throw new ApiException(400, "Invalid Paystack reference.");
        }
        return reference.substring(0, hyphenIndex);
    }

    private static boolean fleetContainsCarId(List<OpenAICarRecommendationGateway.RecommendationCar> fleet, String carId) {
        if (carId == null || carId.isBlank()) {
            return false;
        }
        for (OpenAICarRecommendationGateway.RecommendationCar car : fleet) {
            if (carId.equals(car.getCarId())) {
                return true;
            }
        }
        return false;
    }

    private static OpenAICarRecommendationGateway.RecommendationResult recommendCarLocally(
            OpenAICarRecommendationGateway.RecommendationRequest request,
            List<OpenAICarRecommendationGateway.RecommendationCar> fleet
    ) {
        OpenAICarRecommendationGateway.RecommendationCar bestCar = null;
        double bestScore = Double.NEGATIVE_INFINITY;

        for (OpenAICarRecommendationGateway.RecommendationCar car : fleet) {
            double score = scoreRecommendationCar(request, car);
            if (bestCar == null || score > bestScore) {
                bestCar = car;
                bestScore = score;
            }
        }

        if (bestCar == null) {
            throw new ApiException(400, "No available cars were provided for recommendation.");
        }

        return new OpenAICarRecommendationGateway.RecommendationResult(
                bestCar.getCarId(),
                buildLocalRecommendationReason(request, bestCar)
        );
    }

    private static double scoreRecommendationCar(
            OpenAICarRecommendationGateway.RecommendationRequest request,
            OpenAICarRecommendationGateway.RecommendationCar car
    ) {
        double score = 0.0d;

        if (car.getPricePerDay() <= request.getBudget()) {
            score += 45.0d;
            score += Math.max(0.0d, 15.0d - ((request.getBudget() - car.getPricePerDay()) / 1000.0d));
        } else {
            score -= 25.0d + ((car.getPricePerDay() - request.getBudget()) / 500.0d);
        }

        if (car.getSeats() >= request.getPassengers()) {
            score += 20.0d;
            score += Math.max(0.0d, 6.0d - (car.getSeats() - request.getPassengers()));
        } else {
            score -= 40.0d;
        }

        String preferredCategory = defaultIfBlank(request.getPreferredCategory(), "Any");
        if (!"Any".equalsIgnoreCase(preferredCategory)) {
            if (car.getCategory().equalsIgnoreCase(preferredCategory)) {
                score += 28.0d;
            } else if (car.getCategory().toLowerCase().contains(preferredCategory.toLowerCase())
                    || preferredCategory.toLowerCase().contains(car.getCategory().toLowerCase())) {
                score += 16.0d;
            } else {
                score -= 6.0d;
            }
        }

        String tripType = defaultIfBlank(request.getTripType(), "").toLowerCase();
        String category = defaultIfBlank(car.getCategory(), "").toLowerCase();

        if (tripType.contains("family") || tripType.contains("group") || tripType.contains("road trip")) {
            if (category.contains("suv") || category.contains("pickup")) {
                score += 12.0d;
            }
        }
        if (tripType.contains("city") || tripType.contains("commute") || tripType.contains("work")) {
            if (category.contains("sedan") || category.contains("hatchback")) {
                score += 12.0d;
            }
        }
        if (tripType.contains("luxury") || tripType.contains("business") || tripType.contains("executive")) {
            if (category.contains("luxury")) {
                score += 12.0d;
            }
        }

        if (request.getRentalDuration() >= 7 && car.getPricePerDay() <= request.getBudget()) {
            score += 6.0d;
        }

        return score;
    }

    private static String buildLocalRecommendationReason(
            OpenAICarRecommendationGateway.RecommendationRequest request,
            OpenAICarRecommendationGateway.RecommendationCar car
    ) {
        StringBuilder reason = new StringBuilder();
        reason.append(car.getMake()).append(" ").append(car.getModel())
                .append(" is the strongest match from the currently available fleet");

        if (car.getPricePerDay() <= request.getBudget()) {
            reason.append(", stays within the stated budget");
        } else {
            reason.append(", is the closest available match even though it stretches the stated budget");
        }

        if (car.getSeats() >= request.getPassengers()) {
            reason.append(", and fits ").append(request.getPassengers()).append(" passenger");
            if (request.getPassengers() != 1) {
                reason.append("s");
            }
        }

        String preferredCategory = defaultIfBlank(request.getPreferredCategory(), "Any");
        if (!"Any".equalsIgnoreCase(preferredCategory) && car.getCategory().equalsIgnoreCase(preferredCategory)) {
            reason.append(". It also matches the preferred category");
        } else {
            reason.append(".");
        }

        return reason.toString();
    }

    private static List<OpenAICarRecommendationGateway.RecommendationCar> parseRecommendationFleet(String fleetJson) {
        List<OpenAICarRecommendationGateway.RecommendationCar> cars = new ArrayList<>();
        if (fleetJson == null || fleetJson.isBlank()) {
            return cars;
        }

        Matcher objectMatcher = Pattern.compile("\\{([^{}]+)\\}").matcher(fleetJson);
        while (objectMatcher.find()) {
            Map<String, String> carMap = parseFlatJson("{" + objectMatcher.group(1) + "}");
            if (!carMap.containsKey("carId")) {
                System.out.println("[recommend-car] skipping malformed fleet object: " + carMap);
                continue;
            }
            String status = defaultIfBlank(carMap.get("status"), "Available");
            if (!"Available".equalsIgnoreCase(status)) {
                continue;
            }

            String carId = requireField(carMap, "carId");
            String make = defaultIfBlank(carMap.get("make"), "Unknown");
            String model = defaultIfBlank(carMap.get("model"), "Unknown");
            String category = defaultIfBlank(carMap.get("category"), "Uncategorized");
            double pricePerDay = parsePositiveDouble(defaultIfBlank(carMap.get("pricePerDay"), "1"), "pricePerDay");
            int seats = parseOptionalPositiveInt(carMap.get("seats"), 4);

            cars.add(new OpenAICarRecommendationGateway.RecommendationCar(
                    carId,
                    make,
                    model,
                    category,
                    pricePerDay,
                    seats
            ));
        }

        return cars;
    }

    private static String resolvePaystackSecretKey() {
        String value = System.getenv("PAYSTACK_SECRET_KEY");
        if (value == null || value.isBlank()) {
            value = System.getProperty("paystack.secret.key", "");
        }
        if (value == null || value.isBlank()) {
            value = EnvFileConfig.get("PAYSTACK_SECRET_KEY");
        }
        return value == null ? "" : value.trim();
    }

    private static String resolveOpenAiApiKey() {
        String value = System.getenv("OPENAI_API_KEY");
        if (value == null || value.isBlank()) {
            value = System.getProperty("openai.api.key", "");
        }
        if (value == null || value.isBlank()) {
            value = EnvFileConfig.get("OPENAI_API_KEY");
        }
        return value == null ? "" : value.trim();
    }

    private static String resolveOpenAiModel() {
        String value = System.getenv("OPENAI_MODEL");
        if (value == null || value.isBlank()) {
            value = System.getProperty("openai.model", "o3-mini");
        }
        if (value == null || value.isBlank()) {
            value = EnvFileConfig.get("OPENAI_MODEL");
        }
        return value == null ? "o3-mini" : value.trim();
    }

    private static String resolvePaystackCallbackUrl() {
        String value = System.getenv("PAYSTACK_CALLBACK_URL");
        if (value == null || value.isBlank()) {
            value = System.getProperty("paystack.callback.url", "");
        }
        if (value == null || value.isBlank()) {
            value = EnvFileConfig.get("PAYSTACK_CALLBACK_URL");
        }
        return value == null ? "" : value.trim();
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

    private static int parseOptionalPositiveInt(String value, int fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        try {
            int parsed = Integer.parseInt(value.trim());
            if (parsed <= 0) {
                return fallback;
            }
            return parsed;
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private static long parsePositiveLong(String value, String field) {
        try {
            long parsed = Long.parseLong(value.trim());
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
                ex.printStackTrace();
                sendJson(exchange, ex.statusCode, "{\"error\":\"" + escape(ex.getMessage()) + "\"}");
            } catch (IOException ex) {
                ex.printStackTrace();
                sendJson(exchange, 500, "{\"error\":\"" + escape(defaultIfBlank(ex.getMessage(), "Internal server error")) + "\"}");
            } catch (Exception ex) {
                ex.printStackTrace();
                sendJson(exchange, 500, "{\"error\":\"" + escape(defaultIfBlank(ex.getMessage(), ex.getClass().getSimpleName())) + "\"}");
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
