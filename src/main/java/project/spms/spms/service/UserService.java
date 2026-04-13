package project.spms.spms.service;

import project.spms.spms.entity.User;
import project.spms.spms.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class UserService {

    @Autowired
    private UserRepository userRepo;
    @Autowired
    private ProjectAssignmentRepository assignRepo;
    @Autowired
    private DailyActivityRepository activityRepo;
    @Autowired
    private BCryptPasswordEncoder encoder;
    @Autowired
    private AuditService audit;

    public Optional<User> login(String username, String role, String rawPassword) {
        User.Role r;
        try {
            r = User.Role.valueOf(role);
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }

        Optional<User> opt = userRepo.findByUsernameAndRole(username, r);
        if (opt.isEmpty())
            return Optional.empty();
        User user = opt.get();

        if (user.getStatus() != User.Status.active)
            return Optional.empty();
        if (!encoder.matches(rawPassword, user.getPassword()))
            return Optional.empty();

        // Update last login
        userRepo.updateLastLogin(user.getId(), LocalDateTime.now());
        user.setLastLogin(LocalDateTime.now());

        // Set transient computed fields
        user.setProjectCount(assignRepo.countByUserId(user.getId()).intValue());

        // Calculate tasks completed this month
        LocalDate start = LocalDate.now().with(TemporalAdjusters.firstDayOfMonth());
        LocalDate end = LocalDate.now();
        Integer tasks = activityRepo.sumTasksInRange(user.getId(), start, end);
        user.setTasksCompleted(tasks != null ? tasks : 0);

        audit.log(user.getId(), user.getName(), "User logged in", project.spms.spms.entity.AuditLog.AuditType.login);
        return Optional.of(user);
    }

    // ── GET ALL / FILTERED ─────────────────────────────────────────────────────
    public List<User> getAll() {
        return userRepo.findAll();
    }

    public List<User> getByRole(String role) {
        return userRepo.findByRole(User.Role.valueOf(role));
    }

    public List<User> getByManagerId(Integer managerId) {
        return userRepo.findByManagerIdAndRole(managerId, User.Role.employee);
    }

    public Optional<User> getById(Integer id) {
        return userRepo.findById(id);
    }

    // ── CREATE ─────────────────────────────────────────────────────────────────
    public User create(User user, String rawPassword, Integer requestorId, String requestorName) {
        if (userRepo.existsByUsername(user.getUsername()))
            throw new RuntimeException("Username already taken: " + user.getUsername());
        if (userRepo.existsByEmail(user.getEmail()))
            throw new RuntimeException("Email already registered: " + user.getEmail());

        // Generate employee ID
        String prefix = switch (user.getRole()) {
            case admin -> "ADM";
            case hr -> "HR";
            case manager -> "MGR";
            default -> "EMP";
        };
        long count = userRepo.findByRole(user.getRole()).size() + 1;
        user.setEmployeeId(String.format("%s-%03d", prefix, count));

        // Avatar initials
        String[] parts = user.getName().split(" ");
        String initials = parts.length >= 2
                ? "" + parts[0].charAt(0) + parts[1].charAt(0)
                : user.getName().substring(0, Math.min(2, user.getName().length())).toUpperCase();
        user.setAvatarInitials(initials);

        user.setPassword(encoder.encode(rawPassword != null ? rawPassword : "password"));
        user.setJoinDate(LocalDate.now());
        user.setStatus(User.Status.active);

        User saved = userRepo.save(user);
        audit.log(requestorId, requestorName,
                "Created user: " + saved.getName() + " (" + saved.getEmployeeId() + ")",
                project.spms.spms.entity.AuditLog.AuditType.create);
        return saved;
    }

    // ── UPDATE ─────────────────────────────────────────────────────────────────
    public User update(Integer id, User updates, Integer requestorId, String requestorName) {
        User u = userRepo.findById(id).orElseThrow(() -> new RuntimeException("User not found: " + id));
        if (updates.getName() != null)
            u.setName(updates.getName());
        if (updates.getEmail() != null)
            u.setEmail(updates.getEmail());
        if (updates.getRole() != null)
            u.setRole(updates.getRole());
        if (updates.getDepartmentName() != null)
            u.setDepartmentName(updates.getDepartmentName());
        if (updates.getWorkload() != null)
            u.setWorkload(updates.getWorkload());
        if (updates.getHoursPerWeek() != null)
            u.setHoursPerWeek(updates.getHoursPerWeek());
        if (updates.getPerformanceScore() != null)
            u.setPerformanceScore(updates.getPerformanceScore());

        User saved = userRepo.save(u);
        audit.log(requestorId, requestorName,
                "Updated user: " + saved.getName(),
                project.spms.spms.entity.AuditLog.AuditType.update);
        return saved;
    }

    // ── UPDATE STATUS ──────────────────────────────────────────────────────────
    public void updateStatus(Integer id, String status, Integer requestorId, String requestorName) {
        userRepo.updateStatus(id, status);
        audit.log(requestorId, requestorName,
                "Changed user ID " + id + " status to " + status,
                project.spms.spms.entity.AuditLog.AuditType.update);
    }

    // ── DELETE ─────────────────────────────────────────────────────────────────
    public void delete(Integer id, Integer requestorId, String requestorName) {
        User u = userRepo.findById(id).orElseThrow(() -> new RuntimeException("User not found: " + id));
        userRepo.deleteById(id);
        audit.log(requestorId, requestorName,
                "Deleted user: " + u.getName() + " (" + u.getEmployeeId() + ")",
                project.spms.spms.entity.AuditLog.AuditType.delete);
    }
}