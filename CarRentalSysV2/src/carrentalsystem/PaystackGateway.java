package carrentalsystem;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Minimal Paystack API client for test-mode checkout initialization and verification.
 */
public class PaystackGateway {

    private static final String INITIALIZE_URL = "https://api.paystack.co/transaction/initialize";
    private static final String VERIFY_URL = "https://api.paystack.co/transaction/verify/";
    private static final Pattern MESSAGE_PATTERN = Pattern.compile("\"message\"\\s*:\\s*\"([^\"]*)\"");
    private static final Pattern AUTH_URL_PATTERN = Pattern.compile("\"authorization_url\"\\s*:\\s*\"([^\"]+)\"");
    private static final Pattern ACCESS_CODE_PATTERN = Pattern.compile("\"access_code\"\\s*:\\s*\"([^\"]+)\"");
    private static final Pattern REFERENCE_PATTERN = Pattern.compile("\"reference\"\\s*:\\s*\"([^\"]+)\"");
    private static final Pattern AMOUNT_PATTERN = Pattern.compile("\"amount\"\\s*:\\s*(\\d+)");
    private static final Pattern CURRENCY_PATTERN = Pattern.compile("\"currency\"\\s*:\\s*\"([^\"]+)\"");
    private static final Pattern CHANNEL_PATTERN = Pattern.compile("\"channel\"\\s*:\\s*\"([^\"]+)\"");
    private static final Pattern GATEWAY_RESPONSE_PATTERN = Pattern.compile("\"gateway_response\"\\s*:\\s*\"([^\"]+)\"");
    private static final Pattern DATA_STATUS_PATTERN = Pattern.compile("\"data\"\\s*:\\s*\\{[\\s\\S]*?\"status\"\\s*:\\s*\"([^\"]+)\"");

    private final String secretKey;
    private final HttpClient httpClient;

    public PaystackGateway(String secretKey) {
        this.secretKey = secretKey == null ? "" : secretKey.trim();
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .build();
    }

    public boolean isConfigured() {
        return !secretKey.isBlank();
    }

    public InitializeResult initializeTransaction(
            String email,
            long amountInSubunit,
            String reference,
            String callbackUrl,
            String currency,
            String metadataJson
    ) throws IOException {
        ensureConfigured();

        String payload = "{"
                + "\"email\":\"" + escape(email) + "\","
                + "\"amount\":\"" + amountInSubunit + "\","
                + "\"reference\":\"" + escape(reference) + "\","
                + "\"currency\":\"" + escape(currency) + "\","
                + "\"callback_url\":\"" + escape(callbackUrl) + "\","
                + "\"metadata\":" + metadataJson
                + "}";

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(INITIALIZE_URL))
                .timeout(Duration.ofSeconds(30))
                .header("Authorization", "Bearer " + secretKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .build();

        HttpResponse<String> response = send(request);
        String body = response.body();
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IOException(extractMessage(body, "Could not initialize Paystack transaction."));
        }

        String authorizationUrl = extractRequired(body, AUTH_URL_PATTERN, "Missing Paystack authorization URL.");
        String accessCode = extractRequired(body, ACCESS_CODE_PATTERN, "Missing Paystack access code.");
        String resolvedReference = extractRequired(body, REFERENCE_PATTERN, "Missing Paystack reference.");

        return new InitializeResult(authorizationUrl, accessCode, resolvedReference);
    }

    public VerifyResult verifyTransaction(String reference) throws IOException {
        ensureConfigured();

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(VERIFY_URL + reference))
                .timeout(Duration.ofSeconds(30))
                .header("Authorization", "Bearer " + secretKey)
                .GET()
                .build();

        HttpResponse<String> response = send(request);
        String body = response.body();
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IOException(extractMessage(body, "Could not verify Paystack transaction."));
        }

        String status = extractRequired(body, DATA_STATUS_PATTERN, "Missing Paystack transaction status.");
        long amount = Long.parseLong(extractRequired(body, AMOUNT_PATTERN, "Missing Paystack transaction amount."));
        String currency = extractOptional(body, CURRENCY_PATTERN);
        String channel = extractOptional(body, CHANNEL_PATTERN);
        String gatewayResponse = extractOptional(body, GATEWAY_RESPONSE_PATTERN);
        String resolvedReference = extractRequired(body, REFERENCE_PATTERN, "Missing Paystack reference.");

        return new VerifyResult(resolvedReference, status, amount, currency, channel, gatewayResponse);
    }

    private HttpResponse<String> send(HttpRequest request) throws IOException {
        try {
            return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IOException("Paystack request was interrupted.", ex);
        }
    }

    private void ensureConfigured() throws IOException {
        if (!isConfigured()) {
            throw new IOException("PAYSTACK_SECRET_KEY is not set on the backend.");
        }
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
        return message;
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

    public static final class InitializeResult {

        private final String authorizationUrl;
        private final String accessCode;
        private final String reference;

        public InitializeResult(String authorizationUrl, String accessCode, String reference) {
            this.authorizationUrl = authorizationUrl;
            this.accessCode = accessCode;
            this.reference = reference;
        }

        public String getAuthorizationUrl() {
            return authorizationUrl;
        }

        public String getAccessCode() {
            return accessCode;
        }

        public String getReference() {
            return reference;
        }
    }

    public static final class VerifyResult {

        private final String reference;
        private final String status;
        private final long amount;
        private final String currency;
        private final String channel;
        private final String gatewayResponse;

        public VerifyResult(String reference, String status, long amount, String currency, String channel, String gatewayResponse) {
            this.reference = reference;
            this.status = status;
            this.amount = amount;
            this.currency = currency;
            this.channel = channel;
            this.gatewayResponse = gatewayResponse;
        }

        public String getReference() {
            return reference;
        }

        public String getStatus() {
            return status;
        }

        public long getAmount() {
            return amount;
        }

        public String getCurrency() {
            return currency;
        }

        public String getChannel() {
            return channel;
        }

        public String getGatewayResponse() {
            return gatewayResponse;
        }
    }
}
