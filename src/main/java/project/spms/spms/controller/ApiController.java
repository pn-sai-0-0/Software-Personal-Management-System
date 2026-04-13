package project.spms.spms.controller;

import project.spms.spms.dto.*;
import project.spms.spms.entity.*;
import project.spms.spms.repository.*;
import project.spms.spms.service.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class ApiController {

    @Autowired
    private UserService userService;
    @Autowired
    private ProjectService projectService;
    @Autowired
    private NotificationService notifService;
    @Autowired
    private FileStorageService fileStorage;
    @Autowired
    private AuditService audit;

    @Autowired
    private UserRepository userRepo;
    @Autowired
    private ProjectRepository projRepo;
    @Autowired
    private DepartmentRepository deptRepo;
    @Autowired
    private ProjectAssignmentRepository assignRepo;
    @Autowired
    private ProjectFileRepository fileRepo;
    @Autowired
    private ProjectCommentRepository commentRepo;
    @Autowired
    private ProjectHistoryRepository historyRepo;
    @Autowired
    private NotificationRepository notifRepo;
    @Autowired
    private AuditLogRepository auditRepo;
    @Autowired
    private DailyActivityRepository activityRepo;
    @Autowired
    private MessageRepository messageRepo;
    @Autowired
    private AppSettingRepository settingRepo;

    @PostMapping("/auth/login")
    public ResponseEntity<ApiResponse> login(@RequestBody LoginRequest req) {
        try {
            Optional<User> opt = userService.login(req.getUsername(), req.getRole(), req.getPassword());
            if (opt.isEmpty())
                return ok(ApiResponse.error("Invalid credentials or inactive account"));
            return ok(ApiResponse.ok(opt.get()));
        } catch (Exception e) {
            return ok(ApiResponse.error("Login failed: " + e.getMessage()));
        }
    }

    @PostMapping("/auth/logout")
    public ResponseEntity<ApiResponse> logout(@RequestBody Map<String, Object> body) {
        Integer userId = toInt(body.get("userId"));
        userRepo.findById(userId)
                .ifPresent(u -> audit.log(userId, u.getName(), "User logged out", AuditLog.AuditType.logout));
        return ok(ApiResponse.ok("Logged out"));
    }

    // ════════════════════════════════════════════════════════════
    // USERS
    // ════════════════════════════════════════════════════════════

    /** GET /api/users — list all, or filter by role / managerId */
    @GetMapping("/users")
    public ResponseEntity<ApiResponse> listUsers(
            @RequestParam(required = false) String role,
            @RequestParam(required = false) Integer managerId) {
        List<User> users;
        if (managerId != null)
            users = userService.getByManagerId(managerId);
        else if (role != null)
            users = userService.getByRole(role);
        else
            users = userService.getAll();
        // Populate project count transient field
        users.forEach(u -> u.setProjectCount(assignRepo.countByUserId(u.getId()).intValue()));
        return ok(ApiResponse.ok(users));
    }

    /** GET /api/users/{id} */
    @GetMapping("/users/{id}")
    public ResponseEntity<ApiResponse> getUser(@PathVariable Integer id) {
        Optional<User> opt = userRepo.findById(id);
        if (opt.isEmpty())
            return ok(ApiResponse.error("User not found"));
        User u = opt.get();
        u.setProjectCount(assignRepo.countByUserId(u.getId()).intValue());
        // Enrich with daily activities for detail modal
        List<DailyActivity> acts = activityRepo.findByUserIdOrderByActivityDateDesc(u.getId());
        Map<String, Object> result = new HashMap<>();
        result.put("user", u);
        result.put("dailyActivities", acts.stream().limit(14).collect(Collectors.toList()));
        return ok(ApiResponse.ok(result));
    }

    /** POST /api/users — create a new user (admin only) */
    @PostMapping("/users")
    public ResponseEntity<ApiResponse> createUser(@RequestBody Map<String, Object> body) {
        try {
            User u = new User();
            u.setName((String) body.get("name"));
            u.setEmail((String) body.get("email"));
            u.setUsername((String) body.get("username"));
            u.setRole(User.Role.valueOf(body.getOrDefault("role", "employee").toString()));
            u.setDepartmentName((String) body.get("departmentName"));
            if (body.get("managerId") != null)
                u.setManagerId(toInt(body.get("managerId")));
            String rawPwd = (String) body.getOrDefault("password", "password");
            Integer reqId = toInt(body.get("requestorId"));
            String reqName = (String) body.getOrDefault("requestorName", "Admin");
            User saved = userService.create(u, rawPwd, reqId, reqName);
            return ok(ApiResponse.ok("User created", saved));
        } catch (Exception e) {
            return ok(ApiResponse.error(e.getMessage()));
        }
    }

    /** PUT /api/users/{id} — update user details */
    @PutMapping("/users/{id}")
    public ResponseEntity<ApiResponse> updateUser(@PathVariable Integer id,
            @RequestBody Map<String, Object> body) {
        try {
            User updates = new User();
            if (body.get("name") != null)
                updates.setName(body.get("name").toString());
            if (body.get("email") != null)
                updates.setEmail(body.get("email").toString());
            if (body.get("role") != null)
                updates.setRole(User.Role.valueOf(body.get("role").toString()));
            if (body.get("departmentName") != null)
                updates.setDepartmentName(body.get("departmentName").toString());
            if (body.get("workload") != null)
                updates.setWorkload(toInt(body.get("workload")));
            Integer reqId = toInt(body.get("requestorId"));
            String reqName = (String) body.getOrDefault("requestorName", "Admin");
            User saved = userService.update(id, updates, reqId, reqName);
            return ok(ApiResponse.ok("User updated", saved));
        } catch (Exception e) {
            return ok(ApiResponse.error(e.getMessage()));
        }
    }

    /** PUT /api/users/{id}/status — toggle active / inactive */
    @PutMapping("/users/{id}/status")
    public ResponseEntity<ApiResponse> updateStatus(@PathVariable Integer id,
            @RequestBody Map<String, Object> body) {
        try {
            String status = body.get("status").toString();
            Integer reqId = toInt(body.get("requestorId"));
            String reqName = (String) body.getOrDefault("requestorName", "Admin");
            userService.updateStatus(id, status, reqId, reqName);
            return ok(ApiResponse.ok("Status updated to " + status, null));
        } catch (Exception e) {
            return ok(ApiResponse.error(e.getMessage()));
        }
    }

    /** DELETE /api/users/{id} */
    @DeleteMapping("/users/{id}")
    public ResponseEntity<ApiResponse> deleteUser(@PathVariable Integer id,
            @RequestBody(required = false) Map<String, Object> body) {
        try {
            Integer reqId = body != null ? toInt(body.get("requestorId")) : null;
            String reqName = body != null ? (String) body.get("requestorName") : "Admin";
            userService.delete(id, reqId, reqName);
            return ok(ApiResponse.ok("User deleted", null));
        } catch (Exception e) {
            return ok(ApiResponse.error(e.getMessage()));
        }
    }

    // ════════════════════════════════════════════════════════════
    // PROJECTS
    // ════════════════════════════════════════════════════════════

    /** GET /api/projects — list, filtered by userId or departmentName */
    @GetMapping("/projects")
    public ResponseEntity<ApiResponse> listProjects(
            @RequestParam(required = false) Integer userId,
            @RequestParam(required = false) String departmentName) {
        List<Project> projects;
        if (userId != null)
            projects = projectService.getByUserId(userId);
        else if (departmentName != null)
            projects = projectService.getByDept(departmentName);
        else
            projects = projectService.getAll();
        return ok(ApiResponse.ok(projects));
    }

    /** GET /api/projects/{id} — full detail with team, files, comments, history */
    @GetMapping("/projects/{id}")
    public ResponseEntity<ApiResponse> getProject(@PathVariable Integer id) {
        try {
            return ok(ApiResponse.ok(projectService.getDetail(id)));
        } catch (Exception e) {
            return ok(ApiResponse.error(e.getMessage()));
        }
    }

    /** POST /api/projects — create project (admin/manager) */
    @PostMapping("/projects")
    public ResponseEntity<ApiResponse> createProject(@RequestBody Map<String, Object> body) {
        try {
            Integer reqId = toInt(body.get("requestorId"));
            String reqName = (String) body.getOrDefault("requestorName", "Admin");
            Project saved = projectService.create(body, reqId, reqName);
            return ok(ApiResponse.ok("Project created", saved));
        } catch (Exception e) {
            return ok(ApiResponse.error(e.getMessage()));
        }
    }

    /** PUT /api/projects/{id} — update project details or archive */
    @PutMapping("/projects/{id}")
    public ResponseEntity<ApiResponse> updateProject(@PathVariable Integer id,
            @RequestBody Map<String, Object> body) {
        try {
            Integer reqId = toInt(body.get("requestorId"));
            String reqName = (String) body.getOrDefault("requestorName", "User");
            Project saved = projectService.update(id, body, reqId, reqName);
            return ok(ApiResponse.ok("Project updated", saved));
        } catch (Exception e) {
            return ok(ApiResponse.error(e.getMessage()));
        }
    }

    /** PUT /api/projects/{id}/progress — employee updates progress slider */
    @PutMapping("/projects/{id}/progress")
    public ResponseEntity<ApiResponse> updateProgress(@PathVariable Integer id,
            @RequestBody Map<String, Object> body) {
        try {
            Integer progress = toInt(body.get("progress"));
            String note = (String) body.getOrDefault("note", "");
            Integer userId = toInt(body.get("userId"));
            String userName = userRepo.findById(userId).map(User::getName).orElse("User");
            projectService.updateProgress(id, progress, note, userId, userName);
            return ok(ApiResponse.ok("Progress updated", null));
        } catch (Exception e) {
            return ok(ApiResponse.error(e.getMessage()));
        }
    }

    /** DELETE /api/projects/{id} — admin only */
    @DeleteMapping("/projects/{id}")
    public ResponseEntity<ApiResponse> deleteProject(@PathVariable Integer id,
            @RequestBody(required = false) Map<String, Object> body) {
        try {
            Integer reqId = body != null ? toInt(body.get("requestorId")) : null;
            String reqName = body != null ? (String) body.get("requestorName") : "Admin";
            projectService.delete(id, reqId, reqName);
            return ok(ApiResponse.ok("Project deleted", null));
        } catch (Exception e) {
            return ok(ApiResponse.error(e.getMessage()));
        }
    }

    // ════════════════════════════════════════════════════════════
    // PROJECT ASSIGNMENTS
    // ════════════════════════════════════════════════════════════

    /** POST /api/assignments — assign one or many users to a project */
    @PostMapping("/assignments")
    public ResponseEntity<ApiResponse> assign(@RequestBody AssignRequest req) {
        try {
            String assigner = userRepo.findById(req.getAssignedBy())
                    .map(User::getName).orElse("Manager");
            projectService.assign(req.getProjectId(), req.getUserIds(),
                    req.getRoleInProject(), req.getAssignedBy(), assigner);
            return ok(ApiResponse.ok("Assigned successfully", null));
        } catch (Exception e) {
            return ok(ApiResponse.error(e.getMessage()));
        }
    }

    /** DELETE /api/assignments?projectId=X&userId=Y — remove a team member */
    @DeleteMapping("/assignments")
    public ResponseEntity<ApiResponse> removeAssignment(
            @RequestParam Integer projectId,
            @RequestParam Integer userId,
            @RequestParam(required = false) Integer requestorId,
            @RequestParam(required = false) String requestorName) {
        try {
            String name = requestorName != null ? requestorName
                    : userRepo.findById(requestorId != null ? requestorId : 0)
                            .map(User::getName).orElse("Manager");
            projectService.removeAssignment(projectId, userId, requestorId, name);
            return ok(ApiResponse.ok("Removed from team", null));
        } catch (Exception e) {
            return ok(ApiResponse.error(e.getMessage()));
        }
    }

    // ════════════════════════════════════════════════════════════
    // COMMENTS
    // ════════════════════════════════════════════════════════════

    /** POST /api/comments — add a comment to a project */
    @PostMapping("/comments")
    @Transactional
    public ResponseEntity<ApiResponse> addComment(@RequestBody Map<String, Object> body) {
        try {
            ProjectComment c = new ProjectComment();
            c.setProjectId(toInt(body.get("projectId")));
            c.setAuthorId(toInt(body.get("authorId")));
            c.setAuthorName((String) body.get("authorName"));
            c.setAuthorRole((String) body.get("authorRole"));
            c.setCommentText((String) body.get("commentText"));
            ProjectComment saved = commentRepo.save(c);

            // Add to project history
            projectService.addHistory(c.getProjectId(), c.getAuthorId(),
                    c.getAuthorName(), "Added comment: " + c.getCommentText());

            // Notify all team members
            List<ProjectAssignment> team = assignRepo.findByProjectId(c.getProjectId());
            projRepo.findById(c.getProjectId()).ifPresent(p -> {
                team.stream()
                        .filter(a -> !a.getUserId().equals(c.getAuthorId()))
                        .forEach(a -> notifService.sendInfo(a.getUserId(),
                                "New Comment on " + p.getName(),
                                c.getAuthorName() + ": " + c.getCommentText(),
                                "projects"));
            });

            return ok(ApiResponse.ok("Comment added", saved));
        } catch (Exception e) {
            return ok(ApiResponse.error(e.getMessage()));
        }
    }

    // ════════════════════════════════════════════════════════════
    // FILE UPLOAD & DOWNLOAD
    // ════════════════════════════════════════════════════════════

    /** POST /api/files/upload — multipart file upload */
    @PostMapping("/files/upload")
    @Transactional
    public ResponseEntity<ApiResponse> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam("projectId") Integer projectId,
            @RequestParam("uploaderId") Integer uploaderId) {
        try {
            String filepath = fileStorage.store(file, projectId);
            String size = fileStorage.humanSize(file.getSize());

            ProjectFile pf = new ProjectFile();
            pf.setProjectId(projectId);
            pf.setFilename(file.getOriginalFilename());
            pf.setFilepath(filepath);
            pf.setFilesize(size);
            pf.setUploaderId(uploaderId);
            ProjectFile saved = fileRepo.save(pf);

            String uploaderName = userRepo.findById(uploaderId)
                    .map(User::getName).orElse("User");
            projectService.addHistory(projectId, uploaderId, uploaderName,
                    "Uploaded file: " + file.getOriginalFilename());
            audit.log(uploaderId, uploaderName,
                    "Uploaded " + file.getOriginalFilename() + " to project " + projectId,
                    AuditLog.AuditType.upload);
            return ok(ApiResponse.ok("File uploaded", saved));
        } catch (Exception e) {
            return ok(ApiResponse.error("Upload failed: " + e.getMessage()));
        }
    }

    /** GET /api/files/{id}/download — download a project file */
    @GetMapping("/files/{id}/download")
    public ResponseEntity<Resource> downloadFile(@PathVariable Integer id) {
        try {
            ProjectFile pf = fileRepo.findById(id)
                    .orElseThrow(() -> new RuntimeException("File not found"));
            Resource resource = fileStorage.load(pf.getFilepath());
            String contentType = "application/octet-stream";
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"" + pf.getFilename() + "\"")
                    .contentType(MediaType.parseMediaType(contentType))
                    .body(resource);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    // ════════════════════════════════════════════════════════════
    // NOTIFICATIONS
    // ════════════════════════════════════════════════════════════

    /** GET /api/notifications?userId=X */
    @GetMapping("/notifications")
    public ResponseEntity<ApiResponse> getNotifications(@RequestParam Integer userId) {
        return ok(ApiResponse.ok(notifRepo.findByUserIdOrderByCreatedAtDesc(userId)));
    }

    /** PUT /api/notifications/{id}/read */
    @PutMapping("/notifications/{id}/read")
    @Transactional
    public ResponseEntity<ApiResponse> markRead(@PathVariable Integer id) {
        notifRepo.markAsRead(id);
        return ok(ApiResponse.ok("Marked as read", null));
    }

    /** PUT /api/notifications/read-all?userId=X */
    @PutMapping("/notifications/read-all")
    @Transactional
    public ResponseEntity<ApiResponse> markAllRead(@RequestParam Integer userId) {
        notifRepo.markAllAsRead(userId);
        return ok(ApiResponse.ok("All marked as read", null));
    }

    /** POST /api/notifications — send a notification (admin/manager/hr) */
    @PostMapping("/notifications")
    public ResponseEntity<ApiResponse> createNotification(@RequestBody Map<String, Object> body) {
        try {
            Integer userId = toInt(body.get("userId"));
            String title = (String) body.get("title");
            String message = (String) body.get("message");
            String typeStr = (String) body.getOrDefault("type", "info");
            String link = (String) body.getOrDefault("link", "overview");
            Notification saved = notifService.send(userId, title, message,
                    Notification.NotifType.valueOf(typeStr), link);
            return ok(ApiResponse.ok("Notification sent", saved));
        } catch (Exception e) {
            return ok(ApiResponse.error(e.getMessage()));
        }
    }

    // ════════════════════════════════════════════════════════════
    // MESSAGES
    // ════════════════════════════════════════════════════════════

    /** POST /api/messages — send a message */
    @PostMapping("/messages")
    @Transactional
    public ResponseEntity<ApiResponse> sendMessage(@RequestBody Map<String, Object> body) {
        try {
            Message m = new Message();
            m.setFromId(toInt(body.get("fromId")));
            m.setToId(toInt(body.get("toId")));
            m.setSubject((String) body.getOrDefault("subject", "No Subject"));
            m.setBody((String) body.get("body"));
            Message saved = messageRepo.save(m);

            // Also create a notification for the recipient
            String senderName = userRepo.findById(m.getFromId())
                    .map(User::getName).orElse("Someone");
            notifService.sendInfo(m.getToId(),
                    "Message from " + senderName, m.getBody(), "overview");

            return ok(ApiResponse.ok("Message sent", saved));
        } catch (Exception e) {
            return ok(ApiResponse.error(e.getMessage()));
        }
    }

    /** GET /api/messages?userId=X — inbox */
    @GetMapping("/messages")
    public ResponseEntity<ApiResponse> getMessages(@RequestParam Integer userId) {
        return ok(ApiResponse.ok(messageRepo.findByToIdOrderByCreatedAtDesc(userId)));
    }

    // ════════════════════════════════════════════════════════════
    // PERFORMANCE / DAILY ACTIVITIES
    // ════════════════════════════════════════════════════════════

    /** GET /api/performance?userId=X&year=2026&month=02 */
    @GetMapping("/performance")
    public ResponseEntity<ApiResponse> getPerformance(
            @RequestParam Integer userId,
            @RequestParam(defaultValue = "2026") int year,
            @RequestParam(required = false) String month) {
        try {
            List<DailyActivity> acts;
            if (month != null && !month.equals("all")) {
                int m = Integer.parseInt(month);
                acts = activityRepo.findByUserIdAndYearAndMonth(userId, year, m);
            } else {
                acts = activityRepo.findByUserIdAndYear(userId, year);
            }

            // Aggregate stats
            double totalHours = acts.stream().mapToDouble(a -> a.getHoursWorked().doubleValue()).sum();
            int totalCommits = acts.stream().mapToInt(DailyActivity::getCommits).sum();
            int totalTasks = acts.stream().mapToInt(DailyActivity::getTasksDone).sum();
            double avgHrs = acts.isEmpty() ? 0 : totalHours / acts.size();
            int productivity = Math.min(100, (int) (totalCommits / Math.max(1, acts.size()) * 8 + 70));

            User u = userRepo.findById(userId).orElseThrow();

            Map<String, Object> result = new HashMap<>();
            result.put("activities", acts);
            result.put("totalCommits", totalCommits);
            result.put("totalHours", totalHours);
            result.put("totalTasks", totalTasks);
            result.put("avgHoursPerDay", Math.round(avgHrs * 10.0) / 10.0);
            result.put("productivityScore", productivity);
            result.put("performanceScore", u.getPerformanceScore());
            return ok(ApiResponse.ok(result));
        } catch (Exception e) {
            return ok(ApiResponse.error(e.getMessage()));
        }
    }

    // ════════════════════════════════════════════════════════════
    // ACTIVITIES TIMELINE (for dashboards)
    // ════════════════════════════════════════════════════════════

    /** GET /api/activities?userId=X&limit=5 OR ?departmentId=X&limit=8 */
    @GetMapping("/activities")
    public ResponseEntity<ApiResponse> getActivities(
            @RequestParam(required = false) Integer userId,
            @RequestParam(required = false) Integer departmentId,
            @RequestParam(defaultValue = "10") int limit) {
        List<ProjectHistory> history;
        if (userId != null) {
            history = historyRepo.findByProjectIdOrderByCreatedAtDesc(userId);
        } else {
            history = historyRepo.findAll();
            history.sort(Comparator.comparing(ProjectHistory::getCreatedAt,
                    Comparator.nullsLast(Comparator.reverseOrder())));
        }
        return ok(ApiResponse.ok(history.stream().limit(limit).collect(Collectors.toList())));
    }

    // ════════════════════════════════════════════════════════════
    // DASHBOARD STATS
    // ════════════════════════════════════════════════════════════

    /** GET /api/dashboard/stats?userId=X&role=employee */
    @GetMapping("/dashboard/stats")
    public ResponseEntity<ApiResponse> getDashboardStats(
            @RequestParam Integer userId,
            @RequestParam String role) {
        try {
            DashboardStatsDto stats = new DashboardStatsDto();
            LocalDate start = LocalDate.now().with(TemporalAdjusters.firstDayOfMonth());
            LocalDate end = LocalDate.now();

            if ("employee".equals(role)) {
                stats.setActiveProjects(assignRepo.countByUserId(userId).intValue());
                Integer tasks = activityRepo.sumTasksInRange(userId, start, end);
                stats.setTasksCompleted(tasks != null ? tasks : 0);
                stats.setPendingReviews(0); // Could query PR table if added
                Double hours = activityRepo.sumHoursInRange(userId, start, end);
                stats.setHoursThisMonth(hours != null ? Math.round(hours * 10.0) / 10.0 : 0.0);
            } else {
                stats.setActiveProjects((int) projRepo.findAll().stream()
                        .filter(p -> p.getStatus() == Project.ProjectStatus.active).count());
            }
            return ok(ApiResponse.ok(stats));
        } catch (Exception e) {
            return ok(ApiResponse.error(e.getMessage()));
        }
    }

    // ════════════════════════════════════════════════════════════
    // DEPARTMENTS
    // ════════════════════════════════════════════════════════════

    @GetMapping("/departments")
    public ResponseEntity<ApiResponse> getDepartments() {
        return ok(ApiResponse.ok(deptRepo.findAll()));
    }

    @PostMapping("/departments")
    @Transactional
    public ResponseEntity<ApiResponse> createDepartment(@RequestBody Department dept) {
        if (deptRepo.existsByName(dept.getName()))
            return ok(ApiResponse.error("Department already exists"));
        return ok(ApiResponse.ok("Department created", deptRepo.save(dept)));
    }

    // ════════════════════════════════════════════════════════════
    // AUDIT LOG
    // ════════════════════════════════════════════════════════════

    @GetMapping("/audit-log")
    public ResponseEntity<ApiResponse> getAuditLog() {
        return ok(ApiResponse.ok(auditRepo.findTop100ByOrderByCreatedAtDesc()));
    }

    // ════════════════════════════════════════════════════════════
    // SYSTEM HEALTH
    // ════════════════════════════════════════════════════════════

    @GetMapping("/system/health")
    public ResponseEntity<ApiResponse> systemHealth() {
        Map<String, Object> health = new LinkedHashMap<>();
        health.put("status", "UP");
        health.put("database", "OK");
        health.put("totalUsers", userRepo.count());
        health.put("totalProjects", projRepo.count());
        health.put("totalFiles", fileRepo.count());
        health.put("version", "3.0.0");
        health.put("uptime", "Running");
        return ok(ApiResponse.ok(health));
    }

    // ════════════════════════════════════════════════════════════
    // APP SETTINGS
    // ════════════════════════════════════════════════════════════

    @GetMapping("/settings")
    public ResponseEntity<ApiResponse> getSettings() {
        Map<String, String> settings = new HashMap<>();
        settingRepo.findAll().forEach(s -> settings.put(s.getSettingKey(), s.getSettingValue()));
        return ok(ApiResponse.ok(settings));
    }

    @PostMapping("/settings")
    @Transactional
    public ResponseEntity<ApiResponse> saveSettings(@RequestBody Map<String, Object> body) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, String> settings = (Map<String, String>) body.get("settings");
            if (settings == null)
                return ok(ApiResponse.error("No settings provided"));
            settings.forEach((key, value) -> {
                AppSetting s = settingRepo.findBySettingKey(key)
                        .orElse(new AppSetting());
                s.setSettingKey(key);
                s.setSettingValue(value);
                settingRepo.save(s);
            });
            Integer reqId = toInt(body.get("requestorId"));
            String reqName = (String) body.getOrDefault("requestorName", "Admin");
            audit.log(reqId, reqName, "Updated app settings", AuditLog.AuditType.config);
            return ok(ApiResponse.ok("Settings saved", null));
        } catch (Exception e) {
            return ok(ApiResponse.error(e.getMessage()));
        }
    }

    @DeleteMapping("/files/{id}")
    @Transactional
    public ResponseEntity<ApiResponse> deleteFile(
            @PathVariable Integer id,
            @RequestBody(required = false) Map<String, Object> body) {
        try {
            ProjectFile pf = fileRepo.findById(id)
                    .orElseThrow(() -> new RuntimeException("File not found: " + id));

            Integer deleterId = body != null ? toInt(body.get("deleterId")) : pf.getUploaderId();
            String deleterName = body != null ? (String) body.get("deleterName") : "User";
            Integer projectId = pf.getProjectId();

            if (deleterName == null || deleterName.isBlank()) {
                deleterName = userRepo.findById(deleterId).map(User::getName).orElse("User");
            }

            // 1. Delete the physical file from disk (best-effort)
            fileStorage.delete(pf.getFilepath());

            // 2. Delete DB row (trigger fires: writes project_history + file_deletion_log)
            fileRepo.deleteById(id);

            // 3. Add a project history entry with the real deleter's name
            projectService.addHistory(projectId, deleterId, deleterName,
                    "Deleted file: " + pf.getFilename());

            // 4. Write to audit_log so Admins can see it in the audit view
            audit.log(deleterId, deleterName,
                    "Deleted file \"" + pf.getFilename() + "\" from project " + projectId,
                    AuditLog.AuditType.delete);

            return ok(ApiResponse.ok("File deleted", null));
        } catch (Exception e) {
            return ok(ApiResponse.error("Delete failed: " + e.getMessage()));
        }
    }

    // ════════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ════════════════════════════════════════════════════════════

    private ResponseEntity<ApiResponse> ok(ApiResponse body) {
        return ResponseEntity.ok(body);
    }

    private Integer toInt(Object val) {
        if (val == null)
            return null;
        if (val instanceof Integer i)
            return i;
        if (val instanceof Number n)
            return n.intValue();
        try {
            return Integer.parseInt(val.toString());
        } catch (Exception e) {
            return null;
        }
    }
}