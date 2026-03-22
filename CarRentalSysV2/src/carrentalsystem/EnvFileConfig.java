package carrentalsystem;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Minimal dotenv-style loader for backend-only configuration.
 */
public final class EnvFileConfig {

    private static final Map<String, String> VALUES = load();

    private EnvFileConfig() {
    }

    public static String get(String key) {
        return VALUES.getOrDefault(key, "");
    }

    private static Map<String, String> load() {
        Path path = Path.of(".env.backend");
        if (!Files.exists(path)) {
            return Collections.emptyMap();
        }

        Map<String, String> values = new LinkedHashMap<>();
        try {
            List<String> lines = Files.readAllLines(path, StandardCharsets.UTF_8);
            for (String line : lines) {
                String trimmed = line == null ? "" : line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                    continue;
                }

                int equalsIndex = trimmed.indexOf('=');
                if (equalsIndex <= 0) {
                    continue;
                }

                String key = trimmed.substring(0, equalsIndex).trim();
                String value = trimmed.substring(equalsIndex + 1).trim();
                values.put(key, stripQuotes(value));
            }
        } catch (IOException ex) {
            System.out.println("[env] Could not read .env.backend: " + ex.getMessage());
        }
        return values;
    }

    private static String stripQuotes(String value) {
        if (value == null || value.length() < 2) {
            return value == null ? "" : value;
        }

        if ((value.startsWith("\"") && value.endsWith("\""))
                || (value.startsWith("'") && value.endsWith("'"))) {
            return value.substring(1, value.length() - 1);
        }

        return value;
    }
}
