package carrentalsystem;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Minimal OpenAI Responses API client for recommending one car from a provided fleet.
 */
public class OpenAICarRecommendationGateway {

    private static final String RESPONSES_URL = "https://api.openai.com/v1/responses";
    private static final Pattern MESSAGE_PATTERN = Pattern.compile("\"message\"\\s*:\\s*\"([^\"]*)\"");
    private static final Pattern TEXT_PATTERN = Pattern.compile("\"text\"\\s*:\\s*\"((?:\\\\.|[^\\\"])*)\"");
    private static final Pattern CAR_ID_PATTERN = Pattern.compile("\"carId\"\\s*:\\s*\"([^\"]+)\"");
    private static final Pattern REASON_PATTERN = Pattern.compile("\"reason\"\\s*:\\s*\"((?:\\\\.|[^\\\"])*)\"");

    private final String apiKey;
    private final String model;
    private final HttpClient httpClient;

    public OpenAICarRecommendationGateway(String apiKey, String model) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = (model == null || model.isBlank()) ? "o3-mini" : model.trim();
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .build();
    }

    public boolean isConfigured() {
        return !apiKey.isBlank();
    }

    public RecommendationResult recommend(RecommendationRequest request) throws IOException {
        ensureConfigured();

        String prompt = buildPrompt(request);
        String payload = "{"
                + "\"model\":\"" + escape(model) + "\","
                + "\"input\":["
                + "{"
                + "\"role\":\"system\","
                + "\"content\":[{\"type\":\"input_text\",\"text\":\"You are a car rental recommendation assistant. You must recommend exactly one car from the provided fleet only. Do not invent cars. Base the recommendation on the user's preferences and the actual cars supplied.\"}]"
                + "},"
                + "{"
                + "\"role\":\"user\","
                + "\"content\":[{\"type\":\"input_text\",\"text\":\"" + escape(prompt) + "\"}]"
                + "}"
                + "],"
                + "\"text\":{"
                + "\"format\":{"
                + "\"type\":\"json_schema\","
                + "\"name\":\"car_recommendation\","
                + "\"strict\":true,"
                + "\"schema\":{"
                + "\"type\":\"object\","
                + "\"additionalProperties\":false,"
                + "\"properties\":{"
                + "\"carId\":{\"type\":\"string\"},"
                + "\"reason\":{\"type\":\"string\"}"
                + "},"
                + "\"required\":[\"carId\",\"reason\"]"
                + "}"
                + "}"
                + "}"
                + "}";

        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(RESPONSES_URL))
                .timeout(Duration.ofSeconds(45))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .build();

        HttpResponse<String> response = send(httpRequest);
        String body = response.body();
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IOException(extractMessage(body, "Could not get recommendation from OpenAI."));
        }

        String text = extractRequired(body, TEXT_PATTERN, "Missing recommendation output from OpenAI.");
        String normalized = unescapeJson(text);
        String carId = extractRequired(normalized, CAR_ID_PATTERN, "Missing recommended carId.");
        String reason = unescapeJson(extractRequired(normalized, REASON_PATTERN, "Missing recommendation reason."));

        return new RecommendationResult(carId, reason);
    }

    private HttpResponse<String> send(HttpRequest request) throws IOException {
        try {
            return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IOException("OpenAI request was interrupted.", ex);
        }
    }

    private void ensureConfigured() throws IOException {
        if (!isConfigured()) {
            throw new IOException("OPENAI_API_KEY is not set on the backend.");
        }
    }

    private static String buildPrompt(RecommendationRequest request) {
        StringBuilder fleetBuilder = new StringBuilder();
        for (RecommendationCar car : request.fleet) {
            if (fleetBuilder.length() > 0) {
                fleetBuilder.append("\\n");
            }
            fleetBuilder.append("- carId: ").append(car.carId)
                    .append(", make: ").append(car.make)
                    .append(", model: ").append(car.model)
                    .append(", category: ").append(car.category)
                    .append(", pricePerDay: ").append(car.pricePerDay)
                    .append(", seats: ").append(car.seats);
        }

        return "User preferences:\\n"
                + "budget: " + request.budget + "\\n"
                + "passengers: " + request.passengers + "\\n"
                + "tripType: " + request.tripType + "\\n"
                + "rentalDuration: " + request.rentalDuration + "\\n"
                + "preferredCategory: " + request.preferredCategory + "\\n\\n"
                + "Available fleet:\\n"
                + fleetBuilder;
    }

    private static String extractRequired(String body, Pattern pattern, String fallbackMessage) throws IOException {
        String value = extractOptional(body, pattern);
        if (value == null || value.isBlank()) {
            throw new IOException(fallbackMessage);
        }
        return value;
    }

    private static String extractOptional(String body, Pattern pattern) {
        Matcher matcher = pattern.matcher(body);
        if (!matcher.find()) {
            return null;
        }
        return matcher.group(1);
    }

    private static String extractMessage(String body, String fallback) {
        String message = extractOptional(body, MESSAGE_PATTERN);
        if (message == null || message.isBlank()) {
            return fallback;
        }
        return unescapeJson(message);
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

    private static String unescapeJson(String input) {
        return input
                .replace("\\\"", "\"")
                .replace("\\\\", "\\")
                .replace("\\n", "\n")
                .replace("\\r", "\r")
                .replace("\\t", "\t");
    }

    public static final class RecommendationRequest {

        private final double budget;
        private final int passengers;
        private final String tripType;
        private final int rentalDuration;
        private final String preferredCategory;
        private final List<RecommendationCar> fleet;

        public RecommendationRequest(double budget, int passengers, String tripType, int rentalDuration, String preferredCategory, List<RecommendationCar> fleet) {
            this.budget = budget;
            this.passengers = passengers;
            this.tripType = tripType;
            this.rentalDuration = rentalDuration;
            this.preferredCategory = preferredCategory;
            this.fleet = fleet;
        }

        public double getBudget() {
            return budget;
        }

        public int getPassengers() {
            return passengers;
        }

        public String getTripType() {
            return tripType;
        }

        public int getRentalDuration() {
            return rentalDuration;
        }

        public String getPreferredCategory() {
            return preferredCategory;
        }

        public List<RecommendationCar> getFleet() {
            return fleet;
        }
    }

    public static final class RecommendationCar {

        private final String carId;
        private final String make;
        private final String model;
        private final String category;
        private final double pricePerDay;
        private final int seats;

        public RecommendationCar(String carId, String make, String model, String category, double pricePerDay, int seats) {
            this.carId = carId;
            this.make = make;
            this.model = model;
            this.category = category;
            this.pricePerDay = pricePerDay;
            this.seats = seats;
        }

        public String getCarId() {
            return carId;
        }

        public String getMake() {
            return make;
        }

        public String getModel() {
            return model;
        }

        public String getCategory() {
            return category;
        }

        public double getPricePerDay() {
            return pricePerDay;
        }

        public int getSeats() {
            return seats;
        }
    }

    public static final class RecommendationResult {

        private final String carId;
        private final String reason;

        public RecommendationResult(String carId, String reason) {
            this.carId = carId;
            this.reason = reason;
        }

        public String getCarId() {
            return carId;
        }

        public String getReason() {
            return reason;
        }
    }
}
