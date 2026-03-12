package frontend;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;

/**
 * Minimal logger that appends NDJSON entries to the debug log file
 * used by the debugging system.
 */
public class DebugLogger {

    private static final String LOG_PATH = "c:\\Users\\josep\\Documents\\CarRentalSysV2[1]\\.cursor\\debug.log";

    private DebugLogger() {
    }

    public static void log(String location, String message, String hypothesisId, String runId, String data) {
        long timestamp = System.currentTimeMillis();
        String id = "log_" + timestamp + "_" + Math.round(Math.random() * 1000000);

        StringBuilder sb = new StringBuilder();
        sb.append("{");
        sb.append("\"id\":\"").append(escape(id)).append("\",");
        sb.append("\"timestamp\":").append(timestamp).append(",");
        sb.append("\"location\":\"").append(escape(location)).append("\",");
        sb.append("\"message\":\"").append(escape(message)).append("\",");
        sb.append("\"runId\":\"").append(escape(runId)).append("\",");
        sb.append("\"hypothesisId\":\"").append(escape(hypothesisId)).append("\",");
        sb.append("\"data\":\"").append(escape(data)).append("\"");
        sb.append("}");

        try {
            File logFile = new File(LOG_PATH);
            File parent = logFile.getParentFile();
            if (parent != null && !parent.exists()) {
                parent.mkdirs();
            }
        } catch (Exception ex) {
            // ignore directory creation errors
        }

        try (FileWriter writer = new FileWriter(LOG_PATH, true)) {
            writer.write(sb.toString());
            writer.write(System.lineSeparator());
        } catch (IOException ex) {
            // Swallow logging errors to avoid impacting application behavior
        }
    }

    private static String escape(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
    }
}

