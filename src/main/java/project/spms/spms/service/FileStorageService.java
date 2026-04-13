package project.spms.spms.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.*;
import java.util.UUID;

@Service
public class FileStorageService {

    @Value("${spms.upload.path:./uploads}")
    private String uploadPath;

    public String store(MultipartFile file, Integer projectId) throws IOException {
        Path dir = Paths.get(uploadPath, "projects", String.valueOf(projectId));
        Files.createDirectories(dir);
        String unique = UUID.randomUUID() + "_" + file.getOriginalFilename();
        Path dest = dir.resolve(unique);
        Files.copy(file.getInputStream(), dest, StandardCopyOption.REPLACE_EXISTING);
        return dir.resolve(unique).toString();
    }

    /**
     * Load a file as a Spring Resource for download.
     */
    public Resource load(String filepath) throws MalformedURLException {
        Path path = Paths.get(filepath);
        Resource res = new UrlResource(path.toUri());
        if (res.exists() && res.isReadable())
            return res;
        throw new RuntimeException("File not found: " + filepath);
    }

    /**
     * Delete a file from disk (best-effort — won't throw if missing).
     */
    public void delete(String filepath) {
        try {
            Files.deleteIfExists(Paths.get(filepath));
        } catch (IOException ignored) {
        }
    }

    /** Format bytes into a human-readable size string. */
    public String humanSize(long bytes) {
        if (bytes < 1024)
            return bytes + " B";
        if (bytes < 1_048_576)
            return String.format("%.1f KB", bytes / 1024.0);
        if (bytes < 1_073_741_824)
            return String.format("%.1f MB", bytes / 1_048_576.0);
        return String.format("%.2f GB", bytes / 1_073_741_824.0);
    }
}