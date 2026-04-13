package project.spms.spms.service;

import project.spms.spms.dto.*;
import project.spms.spms.entity.*;
import project.spms.spms.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class ProjectService {

    @Autowired
    private ProjectRepository projRepo;
    @Autowired
    private ProjectAssignmentRepository assignRepo;
    @Autowired
    private ProjectFileRepository fileRepo;
    @Autowired
    private ProjectCommentRepository commentRepo;
    @Autowired
    private ProjectHistoryRepository historyRepo;
    @Autowired
    private UserRepository userRepo;
    @Autowired
    private NotificationService notifService;
    @Autowired
    private AuditService audit;

    // ── GET ALL ────────────────────────────────────────────────────────────────
    public List<Project> getAll() {
        return projRepo.findAll();
    }

    public List<Project> getByUserId(Integer userId) {
        return projRepo.findByUserId(userId);
    }

    public List<Project> getByDept(String dept) {
        return projRepo.findByDepartmentName(dept);
    }

    public Optional<Project> getById(Integer id) {
        return projRepo.findById(id);
    }

    // ── FULL DETAIL (team + files + comments + history) ───────────────────────
    public ProjectDetailDto getDetail(Integer projectId) {
        Project p = projRepo.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found: " + projectId));

        ProjectDetailDto dto = new ProjectDetailDto();
        dto.setId(p.getId());
        dto.setCode(p.getCode());
        dto.setName(p.getName());
        dto.setDescription(p.getDescription());
        dto.setDepartmentName(p.getDepartmentName());
        dto.setStatus(p.getStatus().name());
        dto.setPriority(p.getPriority().name());
        dto.setUrgency(p.getUrgency().name());
        dto.setProgress(p.getProgress());
        dto.setProgressNote(p.getProgressNote());
        dto.setStartDate(p.getStartDate() != null ? p.getStartDate().toString() : null);
        dto.setDeadline(p.getDeadline() != null ? p.getDeadline().toString() : null);

        // Team Members
        List<ProjectAssignment> assignments = assignRepo.findByProjectId(projectId);
        List<ProjectDetailDto.TeamMemberDto> team = assignments.stream().map(a -> {
            ProjectDetailDto.TeamMemberDto m = new ProjectDetailDto.TeamMemberDto();
            m.setUserId(a.getUserId());
            m.setRoleInProject(a.getRoleInProject());
            m.setCommits(a.getCommits());
            m.setHoursContributed(a.getHoursContributed());
            userRepo.findById(a.getUserId()).ifPresent(u -> {
                m.setName(u.getName());
                m.setAvatarInitials(u.getAvatarInitials());
            });
            return m;
        }).collect(Collectors.toList());
        dto.setTeam(team);

        // Files — enrich uploader name
        List<ProjectFile> files = fileRepo.findByProjectId(projectId);
        files.forEach(f -> userRepo.findById(f.getUploaderId())
                .ifPresent(u -> f.setUploaderName(u.getName())));
        dto.setFiles(files);

        // Comments
        dto.setComments(commentRepo.findByProjectIdOrderByCreatedAtDesc(projectId));

        // History (last 15 entries)
        dto.setHistory(historyRepo.findTop10ByProjectIdOrderByCreatedAtDesc(projectId));

        return dto;
    }

    // ── CREATE ─────────────────────────────────────────────────────────────────
    public Project create(Map<String, Object> body, Integer requestorId, String requestorName) {
        Project p = new Project();
        p.setName((String) body.get("name"));
        p.setDescription((String) body.get("description"));
        p.setDepartmentName((String) body.get("departmentName"));
        p.setPriority(Project.Priority.valueOf(
                body.getOrDefault("priority", "medium").toString()));
        p.setUrgency(Project.Urgency.valueOf(
                body.getOrDefault("urgency", "medium").toString()));
        p.setStatus(Project.ProjectStatus.unassigned);
        p.setProgress(0);

        // Auto-generate project code
        long count = projRepo.count() + 1;
        String code = String.format("PROJ-%03d", count);
        while (projRepo.existsByCode(code)) {
            count++;
            code = String.format("PROJ-%03d", count);
        }
        p.setCode(code);

        if (body.get("deadline") != null)
            p.setDeadline(LocalDate.parse(body.get("deadline").toString()));
        if (body.get("startDate") != null)
            p.setStartDate(LocalDate.parse(body.get("startDate").toString()));

        Project saved = projRepo.save(p);
        addHistory(saved.getId(), requestorId, requestorName, "Project created");
        audit.log(requestorId, requestorName, "Created project: " + saved.getName() + " (" + saved.getCode() + ")",
                AuditLog.AuditType.create);
        return saved;
    }

    // ── UPDATE ─────────────────────────────────────────────────────────────────
    public Project update(Integer id, Map<String, Object> body, Integer requestorId, String requestorName) {
        Project p = projRepo.findById(id).orElseThrow(() -> new RuntimeException("Project not found: " + id));
        if (body.get("name") != null)
            p.setName(body.get("name").toString());
        if (body.get("description") != null)
            p.setDescription(body.get("description").toString());
        if (body.get("departmentName") != null)
            p.setDepartmentName(body.get("departmentName").toString());
        if (body.get("status") != null)
            p.setStatus(Project.ProjectStatus.valueOf(body.get("status").toString()));
        if (body.get("priority") != null)
            p.setPriority(Project.Priority.valueOf(body.get("priority").toString()));
        if (body.get("urgency") != null)
            p.setUrgency(Project.Urgency.valueOf(body.get("urgency").toString()));
        if (body.get("deadline") != null)
            p.setDeadline(LocalDate.parse(body.get("deadline").toString()));
        if (body.get("progress") != null) {
            int prog = Integer.parseInt(body.get("progress").toString());
            p.setProgress(prog);
            if (prog == 100)
                p.setStatus(Project.ProjectStatus.completed);
        }

        Project saved = projRepo.save(p);
        addHistory(id, requestorId, requestorName, "Project details updated");
        audit.log(requestorId, requestorName, "Updated project: " + saved.getName(),
                AuditLog.AuditType.update);
        return saved;
    }

    // ── UPDATE PROGRESS ────────────────────────────────────────────────────────
    public void updateProgress(Integer projectId, Integer progress, String note,
            Integer userId, String userName) {
        projRepo.updateProgress(projectId, progress, note);
        if (progress == 100) {
            Project p = projRepo.findById(projectId).orElseThrow();
            p.setStatus(Project.ProjectStatus.completed);
            projRepo.save(p);
        }
        addHistory(projectId, userId, userName, "Progress updated to " + progress + "%" +
                (note != null && !note.isBlank() ? " — " + note : ""));
        audit.log(userId, userName, "Updated progress on project " + projectId + " to " + progress + "%",
                AuditLog.AuditType.update);
    }

    // ── DELETE ─────────────────────────────────────────────────────────────────
    public void delete(Integer id, Integer requestorId, String requestorName) {
        Project p = projRepo.findById(id).orElseThrow(() -> new RuntimeException("Project not found: " + id));
        assignRepo.deleteAllByProjectId(id);
        projRepo.deleteById(id);
        audit.log(requestorId, requestorName, "Deleted project: " + p.getName() + " (" + p.getCode() + ")",
                AuditLog.AuditType.delete);
    }

    // ── ASSIGN USERS ───────────────────────────────────────────────────────────
    public void assign(Integer projectId, List<Integer> userIds, String roleInProject,
            Integer assignedBy, String assignerName) {
        Project p = projRepo.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found: " + projectId));

        for (Integer uid : userIds) {
            if (assignRepo.existsByProjectIdAndUserId(projectId, uid))
                continue;
            ProjectAssignment a = new ProjectAssignment();
            a.setProjectId(projectId);
            a.setUserId(uid);
            a.setRoleInProject(roleInProject != null ? roleInProject : "Team Member");
            a.setAssignedBy(assignedBy);
            assignRepo.save(a);

            userRepo.findById(uid).ifPresent(u -> {
                addHistory(projectId, assignedBy, assignerName,
                        "Assigned " + u.getName() + " as " + a.getRoleInProject());
                notifService.sendInfo(uid, "Project Assigned",
                        "You have been assigned to " + p.getName() + " as " + a.getRoleInProject(),
                        "projects");
                audit.log(assignedBy, assignerName,
                        "Assigned " + u.getName() + " to project " + p.getCode(),
                        AuditLog.AuditType.assign);
            });
        }

        // Activate the project if it was unassigned
        if (p.getStatus() == Project.ProjectStatus.unassigned) {
            p.setStatus(Project.ProjectStatus.active);
            projRepo.save(p);
        }
    }

    // ── REMOVE ASSIGNMENT ──────────────────────────────────────────────────────
    public void removeAssignment(Integer projectId, Integer userId,
            Integer requestorId, String requestorName) {
        assignRepo.deleteByProjectIdAndUserId(projectId, userId);
        userRepo.findById(userId).ifPresent(
                u -> addHistory(projectId, requestorId, requestorName, "Removed " + u.getName() + " from team"));
        audit.log(requestorId, requestorName,
                "Removed user " + userId + " from project " + projectId,
                AuditLog.AuditType.update);
    }

    // ── HELPER: add project history entry ─────────────────────────────────────
    public void addHistory(Integer projectId, Integer userId, String personName, String action) {
        ProjectHistory h = new ProjectHistory();
        h.setProjectId(projectId);
        h.setUserId(userId);
        h.setPersonName(personName);
        h.setAction(action);
        historyRepo.save(h);
    }
}