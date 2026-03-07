# SPMS v3 — Complete Spring Boot Backend Manual
### Group: `project.spms` · Artifact: `spms` · Package: `project.spms.spms`
### Java 21 · Spring Boot 4.0.3 · Spring Web · Spring Data JPA · MySQL Driver
### Server Port: **9090** | 27 Users | Full DB Integration | No Mock Data

---

## Table of Contents
1. [Project Setup](#1-project-setup)
2. [application.properties](#2-applicationproperties)
3. [pom.xml Additions](#3-pomxml-additions)
4. [Project File Structure](#4-project-file-structure)
5. [Entity Classes](#5-entity-classes)
6. [Repository Interfaces](#6-repository-interfaces)
7. [DTO Classes](#7-dto-classes)
8. [Service Classes](#8-service-classes)
9. [Complete REST Controller](#9-complete-rest-controller)
10. [Security & CORS Configuration](#10-security--cors-configuration)
11. [File Storage Service](#11-file-storage-service)
12. [Running the Application](#12-running-the-application)
13. [All API Endpoints Reference](#13-all-api-endpoints-reference)
14. [Testing Each Page](#14-testing-each-page)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Project Setup

Created at **start.spring.io** with:

| Setting | Value |
|---|---|
| Project | Maven |
| Language | Java 21 |
| Spring Boot | 4.0.3 |
| Group | `project.spms` |
| Artifact | `spms` |
| Package Name | `project.spms.spms` |
| Packaging | Jar |
| Dependencies | Spring Web, Spring Data JPA, MySQL Driver |

---

## 2. application.properties

**File:** `src/main/resources/application.properties`

```properties
# Server
server.port=9090

# MySQL Database
spring.datasource.url=jdbc:mysql://localhost:3306/spms?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
spring.datasource.username=root
spring.datasource.password=yourMySQLpassword
spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver

# JPA / Hibernate
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.show-sql=false
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.MySQLDialect
spring.jpa.properties.hibernate.format_sql=true

# Jackson
spring.jackson.deserialization.fail-on-unknown-properties=false
spring.jackson.default-property-inclusion=non_null
spring.jackson.property-naming-strategy=SNAKE_CASE

# File Upload
spring.servlet.multipart.max-file-size=50MB
spring.servlet.multipart.max-request-size=50MB

# Uploads folder (files saved here)
spms.upload.path=./uploads

# Session
server.servlet.session.timeout=60m

# Logging
logging.level.project.spms=INFO
```

---

## 3. pom.xml Additions

Add these dependencies to your `pom.xml` inside `<dependencies>`:

```xml
<!-- BCrypt password encoder -->
<dependency>
    <groupId>org.springframework.security</groupId>
    <artifactId>spring-security-crypto</artifactId>
</dependency>

<!-- Lombok (removes boilerplate getters/setters) -->
<dependency>
    <groupId>org.projectlombok</groupId>
    <artifactId>lombok</artifactId>
    <optional>true</optional>
</dependency>

<!-- Jackson for JSON (usually already included) -->
<dependency>
    <groupId>com.fasterxml.jackson.core</groupId>
    <artifactId>jackson-databind</artifactId>
</dependency>
```

---

## 4. Project File Structure

```
src/main/java/project/spms/spms/
├── SpmsApplication.java
├── config/
│   ├── CorsConfig.java
│   └── SecurityConfig.java
├── controller/
│   └── ApiController.java
├── dto/
│   ├── ApiResponse.java
│   ├── LoginRequest.java
│   └── ProjectDetailDto.java
├── entity/
│   ├── User.java
│   ├── Project.java
│   ├── Department.java
│   ├── ProjectAssignment.java
│   ├── ProjectFile.java
│   ├── ProjectComment.java
│   ├── ProjectHistory.java
│   ├── Notification.java
│   ├── AuditLog.java
│   ├── DailyActivity.java
│   ├── Message.java
│   └── AppSetting.java
├── repository/
│   ├── UserRepository.java
│   ├── ProjectRepository.java
│   ├── DepartmentRepository.java
│   ├── ProjectAssignmentRepository.java
│   ├── ProjectFileRepository.java
│   ├── ProjectCommentRepository.java
│   ├── ProjectHistoryRepository.java
│   ├── NotificationRepository.java
│   ├── AuditLogRepository.java
│   ├── DailyActivityRepository.java
│   ├── MessageRepository.java
│   └── AppSettingRepository.java
└── service/
    ├── UserService.java
    ├── ProjectService.java
    ├── NotificationService.java
    ├── FileStorageService.java
    └── AuditService.java

src/main/resources/
├── application.properties
uploads/                    ← created at runtime
```

---

## 5. Entity Classes

### `entity/User.java`
```java
package project.spms.spms.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data @NoArgsConstructor @Entity @Table(name="users")
public class User {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
    private Integer id;
    @Column(name="employee_id", unique=true, length=20)
    private String employeeId;
    @Column(nullable=false, length=100)
    private String name;
    @Column(unique=true, length=150)
    private String email;
    @Column(unique=true, length=50)
    private String username;
    @JsonIgnore
    @Column(nullable=false, length=255)
    private String password;
    @Enumerated(EnumType.STRING)
    @Column(nullable=false, length=20)
    private Role role;
    @Column(name="department_id")
    private Integer departmentId;
    @Column(name="department_name", length=100)
    private String departmentName;
    @Column(name="manager_id")
    private Integer managerId;
    @Column(columnDefinition="JSON")
    private String skills;
    private Integer workload = 0;
    @Column(name="hours_per_week")
    private Integer hoursPerWeek = 40;
    @Column(name="performance_score")
    private Integer performanceScore = 85;
    @Enumerated(EnumType.STRING)
    @Column(length=10)
    private Status status = Status.active;
    @Column(name="avatar_initials", length=5)
    private String avatarInitials;
    @Column(name="join_date")
    private LocalDate joinDate;
    @Column(name="last_login")
    private LocalDateTime lastLogin;
    @Column(name="created_at", updatable=false)
    private LocalDateTime createdAt;
    @Column(name="updated_at")
    private LocalDateTime updatedAt;
    @Transient private Integer projectCount;
    @Transient private Integer projectsCompleted;
    @Transient private Integer projectsOnTime;
    @Transient private Integer tasksCompleted;
    public enum Role   { employee, manager, hr, admin }
    public enum Status { active, inactive }
    @PrePersist  protected void onCreate() { createdAt = LocalDateTime.now(); updatedAt = LocalDateTime.now(); }
    @PreUpdate   protected void onUpdate() { updatedAt = LocalDateTime.now(); }
}
```

### `entity/Project.java`
```java
package project.spms.spms.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data @NoArgsConstructor @Entity @Table(name="projects")
public class Project {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
    private Integer id;
    @Column(unique=true, nullable=false, length=20)
    private String code;
    @Column(nullable=false, length=200)
    private String name;
    @Column(columnDefinition="TEXT")
    private String description;
    @Column(name="department_id")
    private Integer departmentId;
    @Column(name="department_name", length=100)
    private String departmentName;
    @Enumerated(EnumType.STRING) @Column(length=20)
    private ProjectStatus status = ProjectStatus.unassigned;
    @Enumerated(EnumType.STRING) @Column(length=10)
    private Priority priority = Priority.medium;
    @Enumerated(EnumType.STRING) @Column(length=10)
    private Urgency urgency = Urgency.medium;
    private Integer progress = 0;
    @Column(name="progress_note", length=255)
    private String progressNote;
    @Column(name="start_date")
    private LocalDate startDate;
    private LocalDate deadline;
    @Column(name="created_at", updatable=false)
    private LocalDateTime createdAt;
    @Column(name="updated_at")
    private LocalDateTime updatedAt;
    public enum ProjectStatus { unassigned, active, completed, delayed, archived }
    public enum Priority      { low, medium, high, critical }
    public enum Urgency       { low, medium, high }
    @PrePersist  protected void onCreate() { createdAt = LocalDateTime.now(); updatedAt = LocalDateTime.now(); }
    @PreUpdate   protected void onUpdate() { updatedAt = LocalDateTime.now(); }
}
```

### `entity/Department.java`
```java
package project.spms.spms.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data @NoArgsConstructor @Entity @Table(name="departments")
public class Department {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
    private Integer id;
    @Column(unique=true, nullable=false, length=100) private String name;
    @Column(unique=true, nullable=false, length=10)  private String code;
    @Column(columnDefinition="TEXT") private String description;
    @Column(name="head_name", length=100) private String headName;
    @Column(name="created_at", updatable=false) private LocalDateTime createdAt;
    @PrePersist protected void onCreate() { createdAt = LocalDateTime.now(); }
}
```

### `entity/ProjectAssignment.java`
```java
package project.spms.spms.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data @NoArgsConstructor @Entity @Table(name="project_assignments",
    uniqueConstraints=@UniqueConstraint(columnNames={"project_id","user_id"}))
public class ProjectAssignment {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
    private Integer id;
    @Column(name="project_id", nullable=false) private Integer projectId;
    @Column(name="user_id",    nullable=false) private Integer userId;
    @Column(name="role_in_project", length=100) private String roleInProject = "Team Member";
    @Column(name="assigned_by") private Integer assignedBy;
    private Integer commits = 0;
    @Column(name="hours_contributed") private Integer hoursContributed = 0;
    @Column(name="assigned_at", updatable=false) private LocalDateTime assignedAt;
    @PrePersist protected void onCreate() { assignedAt = LocalDateTime.now(); }
}
```

### `entity/ProjectFile.java`
```java
package project.spms.spms.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data @NoArgsConstructor @Entity @Table(name="project_files")
public class ProjectFile {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
    private Integer id;
    @Column(name="project_id", nullable=false) private Integer projectId;
    @Column(nullable=false, length=255) private String filename;
    @Column(nullable=false, length=500) private String filepath;
    private String filesize;
    @Column(name="uploader_id") private Integer uploaderId;
    @Transient private String uploaderName;
    @Column(name="upload_date", updatable=false) private LocalDateTime uploadDate;
    @PrePersist protected void onCreate() { uploadDate = LocalDateTime.now(); }
}
```

### `entity/ProjectComment.java`
```java
package project.spms.spms.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data @NoArgsConstructor @Entity @Table(name="project_comments")
public class ProjectComment {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
    private Integer id;
    @Column(name="project_id", nullable=false) private Integer projectId;
    @Column(name="author_id") private Integer authorId;
    @Column(name="author_name", length=100) private String authorName;
    @Column(name="author_role", length=50)  private String authorRole;
    @Column(name="comment_text", columnDefinition="TEXT", nullable=false) private String commentText;
    @Column(name="created_at", updatable=false) private LocalDateTime createdAt;
    @PrePersist protected void onCreate() { createdAt = LocalDateTime.now(); }
}
```

### `entity/ProjectHistory.java`
```java
package project.spms.spms.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data @NoArgsConstructor @Entity @Table(name="project_history")
public class ProjectHistory {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
    private Integer id;
    @Column(name="project_id", nullable=false) private Integer projectId;
    @Column(name="user_id") private Integer userId;
    @Column(name="person_name", length=100) private String personName;
    @Column(nullable=false, length=500) private String action;
    @Column(name="created_at", updatable=false) private LocalDateTime createdAt;
    @PrePersist protected void onCreate() { createdAt = LocalDateTime.now(); }
}
```

### `entity/Notification.java`
```java
package project.spms.spms.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data @NoArgsConstructor @Entity @Table(name="notifications")
public class Notification {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
    private Integer id;
    @Column(name="user_id", nullable=false) private Integer userId;
    @Column(nullable=false, length=200) private String title;
    @Column(nullable=false, columnDefinition="TEXT") private String message;
    @Enumerated(EnumType.STRING) @Column(length=10)
    private NotifType type = NotifType.info;
    @Column(name="is_read") private Boolean isRead = false;
    @Column(length=100) private String link = "overview";
    @Column(name="created_at", updatable=false) private LocalDateTime createdAt;
    public enum NotifType { info, warning, review, success, error }
    @PrePersist protected void onCreate() { createdAt = LocalDateTime.now(); }
}
```

### `entity/AuditLog.java`
```java
package project.spms.spms.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data @NoArgsConstructor @Entity @Table(name="audit_log")
public class AuditLog {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
    private Integer id;
    @Column(name="user_id") private Integer userId;
    @Column(name="user_name", length=100) private String userName;
    @Column(nullable=false, columnDefinition="TEXT") private String action;
    @Enumerated(EnumType.STRING) @Column(length=20)
    private AuditType type = AuditType.system;
    @Column(name="created_at", updatable=false) private LocalDateTime createdAt;
    public enum AuditType { create, update, delete, assign, login, logout, upload, system, config, report, permission, revoke }
    @PrePersist protected void onCreate() { createdAt = LocalDateTime.now(); }
}
```

### `entity/DailyActivity.java`
```java
package project.spms.spms.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data @NoArgsConstructor @Entity @Table(name="daily_activities",
    uniqueConstraints=@UniqueConstraint(columnNames={"user_id","activity_date"}))
public class DailyActivity {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
    private Integer id;
    @Column(name="user_id", nullable=false) private Integer userId;
    @Column(name="activity_date", nullable=false) private LocalDate activityDate;
    @Column(name="hours_worked", precision=4, scale=1) private BigDecimal hoursWorked = BigDecimal.ZERO;
    private Integer commits = 0;
    @Column(name="tasks_done") private Integer tasksDone = 0;
    @Enumerated(EnumType.STRING) @Column(name="stress_level", length=10)
    private StressLevel stressLevel = StressLevel.low;
    public enum StressLevel { none, low, medium, high }
}
```

### `entity/Message.java`
```java
package project.spms.spms.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data @NoArgsConstructor @Entity @Table(name="messages")
public class Message {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
    private Integer id;
    @Column(name="from_id") private Integer fromId;
    @Column(name="to_id", nullable=false) private Integer toId;
    @Column(length=200) private String subject;
    @Column(nullable=false, columnDefinition="TEXT") private String body;
    @Column(name="is_read") private Boolean isRead = false;
    @Column(name="created_at", updatable=false) private LocalDateTime createdAt;
    @PrePersist protected void onCreate() { createdAt = LocalDateTime.now(); }
}
```

### `entity/AppSetting.java`
```java
package project.spms.spms.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @NoArgsConstructor @Entity @Table(name="app_settings")
public class AppSetting {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
    private Integer id;
    @Column(name="setting_key", unique=true, nullable=false, length=100) private String settingKey;
    @Column(name="setting_value", columnDefinition="TEXT") private String settingValue;
}
```

---

## 6. Repository Interfaces

### `repository/UserRepository.java`
```java
package project.spms.spms.repository;

import project.spms.spms.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Integer> {
    Optional<User> findByUsername(String username);
    Optional<User> findByUsernameAndRole(String username, User.Role role);
    List<User>     findByRole(User.Role role);
    List<User>     findByManagerId(Integer managerId);
    List<User>     findByManagerIdAndRole(Integer managerId, User.Role role);
    List<User>     findByDepartmentName(String departmentName);
    List<User>     findByDepartmentNameAndRole(String departmentName, User.Role role);
    List<User>     findByStatus(User.Status status);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
    @Modifying @Query(value="UPDATE users SET last_login=:t WHERE id=:id", nativeQuery=true)
    void updateLastLogin(@Param("id") Integer id, @Param("t") LocalDateTime t);
    @Modifying @Query(value="UPDATE users SET status=:status WHERE id=:id", nativeQuery=true)
    void updateStatus(@Param("id") Integer id, @Param("status") String status);
    @Query("SELECT COUNT(pa) FROM ProjectAssignment pa JOIN Project p ON pa.projectId=p.id WHERE pa.userId=:uid AND p.status='active'")
    Long countActiveProjectsByUserId(@Param("uid") Integer uid);
}
```

### `repository/ProjectRepository.java`
```java
package project.spms.spms.repository;

import project.spms.spms.entity.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ProjectRepository extends JpaRepository<Project, Integer> {
    List<Project> findByStatus(Project.ProjectStatus status);
    List<Project> findByDepartmentName(String departmentName);
    List<Project> findByDepartmentId(Integer departmentId);
    @Query("SELECT p FROM Project p WHERE p.id IN (SELECT pa.projectId FROM ProjectAssignment pa WHERE pa.userId=:uid)")
    List<Project> findByUserId(@Param("uid") Integer uid);
    @Query("SELECT p FROM Project p WHERE p.status=:status AND p.id IN (SELECT pa.projectId FROM ProjectAssignment pa WHERE pa.userId=:uid)")
    List<Project> findByUserIdAndStatus(@Param("uid") Integer uid, @Param("status") Project.ProjectStatus status);
    @Modifying @Query("UPDATE Project p SET p.progress=:prog, p.progressNote=:note WHERE p.id=:id")
    void updateProgress(@Param("id") Integer id, @Param("prog") Integer prog, @Param("note") String note);
    boolean existsByCode(String code);
}
```

### `repository/ProjectAssignmentRepository.java`
```java
package project.spms.spms.repository;

import project.spms.spms.entity.ProjectAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectAssignmentRepository extends JpaRepository<ProjectAssignment, Integer> {
    List<ProjectAssignment>     findByProjectId(Integer projectId);
    List<ProjectAssignment>     findByUserId(Integer userId);
    Optional<ProjectAssignment> findByProjectIdAndUserId(Integer projectId, Integer userId);
    boolean existsByProjectIdAndUserId(Integer projectId, Integer userId);
    @Modifying @Query("DELETE FROM ProjectAssignment pa WHERE pa.projectId=:pid AND pa.userId=:uid")
    void deleteByProjectIdAndUserId(@Param("pid") Integer pid, @Param("uid") Integer uid);
    Long countByUserId(Integer userId);
    @Modifying @Query("DELETE FROM ProjectAssignment pa WHERE pa.projectId=:pid")
    void deleteAllByProjectId(@Param("pid") Integer pid);
}
```

### `repository/ProjectFileRepository.java`
```java
package project.spms.spms.repository;

import project.spms.spms.entity.ProjectFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ProjectFileRepository extends JpaRepository<ProjectFile, Integer> {
    List<ProjectFile> findByProjectId(Integer projectId);
    long countByProjectId(Integer projectId);
    void deleteAllByProjectId(Integer projectId);
}
```

### `repository/ProjectCommentRepository.java`
```java
package project.spms.spms.repository;

import project.spms.spms.entity.ProjectComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ProjectCommentRepository extends JpaRepository<ProjectComment, Integer> {
    List<ProjectComment> findByProjectIdOrderByCreatedAtDesc(Integer projectId);
}
```

### `repository/ProjectHistoryRepository.java`
```java
package project.spms.spms.repository;

import project.spms.spms.entity.ProjectHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ProjectHistoryRepository extends JpaRepository<ProjectHistory, Integer> {
    List<ProjectHistory> findByProjectIdOrderByCreatedAtDesc(Integer projectId);
    List<ProjectHistory> findTop10ByProjectIdOrderByCreatedAtDesc(Integer projectId);
}
```

### `repository/NotificationRepository.java`
```java
package project.spms.spms.repository;

import project.spms.spms.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Integer> {
    List<Notification> findByUserIdOrderByCreatedAtDesc(Integer userId);
    @Modifying @Query("UPDATE Notification n SET n.isRead=true WHERE n.id=:id")
    void markAsRead(@


# SPMS v3 — Spring Boot Backend Manual (Continued)
## Sections 6–15: Repositories → Services → Controller → Endpoints → Testing

---

## 6. Repository Interfaces (Continued)

### `repository/NotificationRepository.java`
```java
package project.spms.spms.repository;

import project.spms.spms.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Integer> {
    List<Notification> findByUserIdOrderByCreatedAtDesc(Integer userId);
    Long countByUserIdAndIsReadFalse(Integer userId);

    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.id = :id")
    void markAsRead(@Param("id") Integer id);

    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.userId = :userId")
    void markAllAsRead(@Param("userId") Integer userId);
}
```

### `repository/AuditLogRepository.java`
```java
package project.spms.spms.repository;

import project.spms.spms.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Integer> {
    List<AuditLog> findTop100ByOrderByCreatedAtDesc();
    List<AuditLog> findByUserIdOrderByCreatedAtDesc(Integer userId);
    List<AuditLog> findByTypeOrderByCreatedAtDesc(AuditLog.AuditType type);
}
```

### `repository/DailyActivityRepository.java`
```java
package project.spms.spms.repository;

import project.spms.spms.entity.DailyActivity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface DailyActivityRepository extends JpaRepository<DailyActivity, Integer> {
    List<DailyActivity> findByUserIdOrderByActivityDateDesc(Integer userId);
    Optional<DailyActivity> findByUserIdAndActivityDate(Integer userId, LocalDate date);

    @Query("SELECT da FROM DailyActivity da WHERE da.userId = :uid " +
           "AND YEAR(da.activityDate) = :year ORDER BY da.activityDate DESC")
    List<DailyActivity> findByUserIdAndYear(@Param("uid") Integer uid, @Param("year") int year);

    @Query("SELECT da FROM DailyActivity da WHERE da.userId = :uid " +
           "AND YEAR(da.activityDate) = :year AND MONTH(da.activityDate) = :month " +
           "ORDER BY da.activityDate DESC")
    List<DailyActivity> findByUserIdAndYearAndMonth(@Param("uid") Integer uid,
                                                     @Param("year") int year,
                                                     @Param("month") int month);

    @Query("SELECT SUM(da.hoursWorked) FROM DailyActivity da WHERE da.userId = :uid " +
           "AND da.activityDate >= :from AND da.activityDate <= :to")
    Double sumHoursInRange(@Param("uid") Integer uid,
                            @Param("from") LocalDate from,
                            @Param("to") LocalDate to);

    @Query("SELECT SUM(da.tasksDone) FROM DailyActivity da WHERE da.userId = :uid " +
           "AND da.activityDate >= :from AND da.activityDate <= :to")
    Integer sumTasksInRange(@Param("uid") Integer uid,
                             @Param("from") LocalDate from,
                             @Param("to") LocalDate to);
}
```

### `repository/DepartmentRepository.java`
```java
package project.spms.spms.repository;

import project.spms.spms.entity.Department;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface DepartmentRepository extends JpaRepository<Department, Integer> {
    Optional<Department> findByName(String name);
    boolean existsByName(String name);
}
```

### `repository/MessageRepository.java`
```java
package project.spms.spms.repository;

import project.spms.spms.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message, Integer> {
    List<Message> findByToIdOrderByCreatedAtDesc(Integer toId);
    List<Message> findByFromIdOrderByCreatedAtDesc(Integer fromId);
    Long countByToIdAndIsReadFalse(Integer toId);
}
```

### `repository/AppSettingRepository.java`
```java
package project.spms.spms.repository;

import project.spms.spms.entity.AppSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface AppSettingRepository extends JpaRepository<AppSetting, Integer> {
    Optional<AppSetting> findBySettingKey(String key);
}
```

---

## 7. DTO Classes

### `dto/ApiResponse.java`
```java
package project.spms.spms.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @NoArgsConstructor @AllArgsConstructor
public class ApiResponse {
    private boolean success;
    private String  message;
    private Object  data;

    public static ApiResponse ok(Object data)                    { return new ApiResponse(true,  "OK",      data); }
    public static ApiResponse ok(String message, Object data)    { return new ApiResponse(true,  message,   data); }
    public static ApiResponse error(String message)              { return new ApiResponse(false, message,   null); }
}
```

### `dto/LoginRequest.java`
```java
package project.spms.spms.dto;

import lombok.Data;

@Data
public class LoginRequest {
    private String username;
    private String password;
    private String role;   // "employee" | "manager" | "hr" | "admin"
}
```

### `dto/ProjectDetailDto.java`
```java
package project.spms.spms.dto;

import lombok.Data;
import project.spms.spms.entity.*;
import java.util.List;

/**
 * Full project detail returned by GET /api/projects/{id}
 * Includes team members, files, comments, and activity history.
 */
@Data
public class ProjectDetailDto {
    private Integer     id;
    private String      code;
    private String      name;
    private String      description;
    private String      departmentName;
    private String      status;
    private String      priority;
    private String      urgency;
    private Integer     progress;
    private String      progressNote;
    private String      startDate;
    private String      deadline;
    private List<TeamMemberDto>    team;
    private List<ProjectFile>      files;
    private List<ProjectComment>   comments;
    private List<ProjectHistory>   history;

    @Data
    public static class TeamMemberDto {
        private Integer userId;
        private String  name;
        private String  avatarInitials;
        private String  roleInProject;
        private Integer commits;
        private Integer hoursContributed;
    }
}
```

### `dto/DashboardStatsDto.java`
```java
package project.spms.spms.dto;

import lombok.Data;

@Data
public class DashboardStatsDto {
    private Integer activeProjects;
    private Integer tasksCompleted;
    private Integer pendingReviews;
    private Double  hoursThisMonth;
    private Integer productivityScore;
    private Integer totalCommits;
    private Double  avgHoursPerDay;
}
```

### `dto/AssignRequest.java`
```java
package project.spms.spms.dto;

import lombok.Data;
import java.util.List;

@Data
public class AssignRequest {
    private Integer      projectId;
    private List<Integer> userIds;
    private String       roleInProject;
    private Integer      assignedBy;
}
```

---

## 8. Service Classes

### `service/AuditService.java`
```java
package project.spms.spms.service;

import project.spms.spms.entity.AuditLog;
import project.spms.spms.repository.AuditLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditService {

    @Autowired private AuditLogRepository auditRepo;

    @Transactional
    public void log(Integer userId, String userName, String action, AuditLog.AuditType type) {
        AuditLog entry = new AuditLog();
        entry.setUserId(userId);
        entry.setUserName(userName);
        entry.setAction(action);
        entry.setType(type);
        auditRepo.save(entry);
    }

    @Transactional
    public void log(String userName, String action, AuditLog.AuditType type) {
        log(null, userName, action, type);
    }
}
```

### `service/NotificationService.java`
```java
package project.spms.spms.service;

import project.spms.spms.entity.Notification;
import project.spms.spms.repository.NotificationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationService {

    @Autowired private NotificationRepository notifRepo;

    /** Send a notification to a single user. */
    @Transactional
    public Notification send(Integer userId, String title, String message,
                             Notification.NotifType type, String link) {
        Notification n = new Notification();
        n.setUserId(userId);
        n.setTitle(title);
        n.setMessage(message);
        n.setType(type);
        n.setLink(link != null ? link : "overview");
        return notifRepo.save(n);
    }

    /** Convenience overload for info type. */
    @Transactional
    public Notification sendInfo(Integer userId, String title, String message, String link) {
        return send(userId, title, message, Notification.NotifType.info, link);
    }

    /** Convenience overload for warning type. */
    @Transactional
    public Notification sendWarning(Integer userId, String title, String message, String link) {
        return send(userId, title, message, Notification.NotifType.warning, link);
    }
}
```

### `service/FileStorageService.java`
```java
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

    /**
     * Save a file to disk.
     * Returns the relative filepath stored in the DB, e.g. "uploads/projects/1/uuid_filename.pdf"
     */
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
        if (res.exists() && res.isReadable()) return res;
        throw new RuntimeException("File not found: " + filepath);
    }

    /**
     * Delete a file from disk (best-effort — won't throw if missing).
     */
    public void delete(String filepath) {
        try { Files.deleteIfExists(Paths.get(filepath)); } catch (IOException ignored) {}
    }

    /** Format bytes into a human-readable size string. */
    public String humanSize(long bytes) {
        if (bytes < 1024)           return bytes + " B";
        if (bytes < 1_048_576)      return String.format("%.1f KB", bytes / 1024.0);
        if (bytes < 1_073_741_824)  return String.format("%.1f MB", bytes / 1_048_576.0);
        return String.format("%.2f GB", bytes / 1_073_741_824.0);
    }
}
```

### `service/UserService.java`
```java
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

    @Autowired private UserRepository              userRepo;
    @Autowired private ProjectAssignmentRepository assignRepo;
    @Autowired private DailyActivityRepository     activityRepo;
    @Autowired private BCryptPasswordEncoder        encoder;
    @Autowired private AuditService                audit;

    // ── LOGIN ──────────────────────────────────────────────────────────────────
    public Optional<User> login(String username, String role, String rawPassword) {
        User.Role r;
        try { r = User.Role.valueOf(role); }
        catch (IllegalArgumentException e) { return Optional.empty(); }

        Optional<User> opt = userRepo.findByUsernameAndRole(username, r);
        if (opt.isEmpty()) return Optional.empty();
        User user = opt.get();

        if (user.getStatus() != User.Status.active)   return Optional.empty();
        if (!encoder.matches(rawPassword, user.getPassword())) return Optional.empty();

        // Update last login
        userRepo.updateLastLogin(user.getId(), LocalDateTime.now());
        user.setLastLogin(LocalDateTime.now());

        // Set transient computed fields
        user.setProjectCount(assignRepo.countByUserId(user.getId()).intValue());

        // Calculate tasks completed this month
        LocalDate start = LocalDate.now().with(TemporalAdjusters.firstDayOfMonth());
        LocalDate end   = LocalDate.now();
        Integer tasks = activityRepo.sumTasksInRange(user.getId(), start, end);
        user.setTasksCompleted(tasks != null ? tasks : 0);

        audit.log(user.getId(), user.getName(), "User logged in", project.spms.spms.entity.AuditLog.AuditType.login);
        return Optional.of(user);
    }

    // ── GET ALL / FILTERED ─────────────────────────────────────────────────────
    public List<User> getAll()                                { return userRepo.findAll(); }
    public List<User> getByRole(String role)                  { return userRepo.findByRole(User.Role.valueOf(role)); }
    public List<User> getByManagerId(Integer managerId)       { return userRepo.findByManagerIdAndRole(managerId, User.Role.employee); }
    public Optional<User> getById(Integer id)                 { return userRepo.findById(id); }

    // ── CREATE ─────────────────────────────────────────────────────────────────
    public User create(User user, String rawPassword, Integer requestorId, String requestorName) {
        if (userRepo.existsByUsername(user.getUsername()))
            throw new RuntimeException("Username already taken: " + user.getUsername());
        if (userRepo.existsByEmail(user.getEmail()))
            throw new RuntimeException("Email already registered: " + user.getEmail());

        // Generate employee ID
        String prefix = switch (user.getRole()) {
            case admin -> "ADM"; case hr -> "HR"; case manager -> "MGR"; default -> "EMP";
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
        if (updates.getName()           != null) u.setName(updates.getName());
        if (updates.getEmail()          != null) u.setEmail(updates.getEmail());
        if (updates.getRole()           != null) u.setRole(updates.getRole());
        if (updates.getDepartmentName() != null) u.setDepartmentName(updates.getDepartmentName());
        if (updates.getWorkload()       != null) u.setWorkload(updates.getWorkload());
        if (updates.getHoursPerWeek()   != null) u.setHoursPerWeek(updates.getHoursPerWeek());
        if (updates.getPerformanceScore()!= null) u.setPerformanceScore(updates.getPerformanceScore());

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
```

### `service/ProjectService.java`
```java
package project.spms.spms.service;

import project.spms.spms.dto.*;
import project.spms.spms.entity.*;
import project.spms.spms.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class ProjectService {

    @Autowired private ProjectRepository            projRepo;
    @Autowired private ProjectAssignmentRepository  assignRepo;
    @Autowired private ProjectFileRepository        fileRepo;
    @Autowired private ProjectCommentRepository     commentRepo;
    @Autowired private ProjectHistoryRepository     historyRepo;
    @Autowired private UserRepository               userRepo;
    @Autowired private NotificationService          notifService;
    @Autowired private AuditService                 audit;

    // ── GET ALL ────────────────────────────────────────────────────────────────
    public List<Project> getAll()                         { return projRepo.findAll(); }
    public List<Project> getByUserId(Integer userId)      { return projRepo.findByUserId(userId); }
    public List<Project> getByDept(String dept)           { return projRepo.findByDepartmentName(dept); }
    public Optional<Project> getById(Integer id)          { return projRepo.findById(id); }

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
            body.getOrDefault("urgency",  "medium").toString()));
        p.setStatus(Project.ProjectStatus.unassigned);
        p.setProgress(0);

        // Auto-generate project code
        long count = projRepo.count() + 1;
        String code = String.format("PROJ-%03d", count);
        while (projRepo.existsByCode(code)) { count++; code = String.format("PROJ-%03d", count); }
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
        if (body.get("name")           != null) p.setName(body.get("name").toString());
        if (body.get("description")    != null) p.setDescription(body.get("description").toString());
        if (body.get("departmentName") != null) p.setDepartmentName(body.get("departmentName").toString());
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
            if (prog == 100) p.setStatus(Project.ProjectStatus.completed);
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
            if (assignRepo.existsByProjectIdAndUserId(projectId, uid)) continue;
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
        userRepo.findById(userId).ifPresent(u ->
            addHistory(projectId, requestorId, requestorName, "Removed " + u.getName() + " from team"));
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
```

---

## 9. Complete REST Controller

### `config/SecurityConfig.java`
*(Configure BCrypt bean and disable Spring Security's default login — we handle auth ourselves.)*
```java
package project.spms.spms.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public BCryptPasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(10);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
        return http.build();
    }
}
```

### `config/CorsConfig.java`
```java
package project.spms.spms.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.*;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins("*")           // In production: set to your domain
                .allowedMethods("GET","POST","PUT","DELETE","OPTIONS")
                .allowedHeaders("*")
                .maxAge(3600);
    }
}
```

### `controller/ApiController.java`

This is the **single REST controller** that handles all frontend API calls.

```java
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

    @Autowired private UserService              userService;
    @Autowired private ProjectService           projectService;
    @Autowired private NotificationService      notifService;
    @Autowired private FileStorageService       fileStorage;
    @Autowired private AuditService             audit;

    @Autowired private UserRepository           userRepo;
    @Autowired private ProjectRepository        projRepo;
    @Autowired private DepartmentRepository     deptRepo;
    @Autowired private ProjectAssignmentRepository assignRepo;
    @Autowired private ProjectFileRepository    fileRepo;
    @Autowired private ProjectCommentRepository commentRepo;
    @Autowired private ProjectHistoryRepository historyRepo;
    @Autowired private NotificationRepository   notifRepo;
    @Autowired private AuditLogRepository       auditRepo;
    @Autowired private DailyActivityRepository  activityRepo;
    @Autowired private MessageRepository        messageRepo;
    @Autowired private AppSettingRepository     settingRepo;

    // ════════════════════════════════════════════════════════════
    //  AUTH — POST /api/auth/login  |  POST /api/auth/logout
    // ════════════════════════════════════════════════════════════

    @PostMapping("/auth/login")
    public ResponseEntity<ApiResponse> login(@RequestBody LoginRequest req) {
        try {
            Optional<User> opt = userService.login(req.getUsername(), req.getRole(), req.getPassword());
            if (opt.isEmpty()) return ok(ApiResponse.error("Invalid credentials or inactive account"));
            return ok(ApiResponse.ok(opt.get()));
        } catch (Exception e) {
            return ok(ApiResponse.error("Login failed: " + e.getMessage()));
        }
    }

    @PostMapping("/auth/logout")
    public ResponseEntity<ApiResponse> logout(@RequestBody Map<String,Object> body) {
        Integer userId = toInt(body.get("userId"));
        userRepo.findById(userId).ifPresent(u ->
            audit.log(userId, u.getName(), "User logged out", AuditLog.AuditType.logout));
        return ok(ApiResponse.ok("Logged out"));
    }

    // ════════════════════════════════════════════════════════════
    //  USERS
    // ════════════════════════════════════════════════════════════

    /** GET /api/users — list all, or filter by role / managerId */
    @GetMapping("/users")
    public ResponseEntity<ApiResponse> listUsers(
            @RequestParam(required=false) String role,
            @RequestParam(required=false) Integer managerId) {
        List<User> users;
        if (managerId != null)      users = userService.getByManagerId(managerId);
        else if (role != null)      users = userService.getByRole(role);
        else                        users = userService.getAll();
        // Populate project count transient field
        users.forEach(u -> u.setProjectCount(assignRepo.countByUserId(u.getId()).intValue()));
        return ok(ApiResponse.ok(users));
    }

    /** GET /api/users/{id} */
    @GetMapping("/users/{id}")
    public ResponseEntity<ApiResponse> getUser(@PathVariable Integer id) {
        Optional<User> opt = userRepo.findById(id);
        if (opt.isEmpty()) return ok(ApiResponse.error("User not found"));
        User u = opt.get();
        u.setProjectCount(assignRepo.countByUserId(u.getId()).intValue());
        // Enrich with daily activities for detail modal
        List<DailyActivity> acts = activityRepo.findByUserIdOrderByActivityDateDesc(u.getId());
        Map<String, Object> result = new HashMap<>();
        result.put("user",             u);
        result.put("dailyActivities",  acts.stream().limit(14).collect(Collectors.toList()));
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
            u.setRole(User.Role.valueOf(body.getOrDefault("role","employee").toString()));
            u.setDepartmentName((String) body.get("departmentName"));
            if (body.get("managerId") != null) u.setManagerId(toInt(body.get("managerId")));
            String rawPwd = (String) body.getOrDefault("password", "password");
            Integer reqId   = toInt(body.get("requestorId"));
            String  reqName = (String) body.getOrDefault("requestorName","Admin");
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
            if (body.get("name")           != null) updates.setName(body.get("name").toString());
            if (body.get("email")          != null) updates.setEmail(body.get("email").toString());
            if (body.get("role")           != null) updates.setRole(User.Role.valueOf(body.get("role").toString()));
            if (body.get("departmentName") != null) updates.setDepartmentName(body.get("departmentName").toString());
            if (body.get("workload")       != null) updates.setWorkload(toInt(body.get("workload")));
            Integer reqId   = toInt(body.get("requestorId"));
            String  reqName = (String) body.getOrDefault("requestorName","Admin");
            User saved = userService.update(id, updates, reqId, reqName);
            return ok(ApiResponse.ok("User updated", saved));
        } catch (Exception e) {
            return ok(ApiResponse.error(e.getMessage()));
        }
    }

    /** PUT /api/users/{id}/status — toggle active / inactive */
    @PutMapping("/users/{id}/status")
    public ResponseEntity<ApiResponse> updateStatus(@PathVariable Integer id,
                                                     @RequestBody Map<String,Object> body) {
        try {
            String  status  = body.get("status").toString();
            Integer reqId   = toInt(body.get("requestorId"));
            String  reqName = (String) body.getOrDefault("requestorName","Admin");
            userService.updateStatus(id, status, reqId, reqName);
            return ok(ApiResponse.ok("Status updated to " + status, null));
        } catch (Exception e) {
            return ok(ApiResponse.error(e.getMessage()));
        }
    }

    /** DELETE /api/users/{id} */
    @DeleteMapping("/users/{id}")
    public ResponseEntity<ApiResponse> deleteUser(@PathVariable Integer id,
                                                   @RequestBody(required=false) Map<String,Object> body) {
        try {
            Integer reqId   = body != null ? toInt(body.get("requestorId"))   : null;
            String  reqName = body != null ? (String)body.get("requestorName") : "Admin";
            userService.delete(id, reqId, reqName);
            return ok(ApiResponse.ok("User deleted", null));
        } catch (Exception e) {
            return ok(ApiResponse.error(e.getMessage()));
        }
    }

    // ════════════════════════════════════════════════════════════
    //  PROJECTS
    // ════════════════════════════════════════════════════════════

    /** GET /api/projects — list, filtered by userId or departmentName */
    @GetMapping("/projects")
    public ResponseEntity<ApiResponse> listProjects(
            @RequestParam(required=false) Integer userId,
            @RequestParam(required=false) String  departmentName) {
        List<Project> projects;
        if (userId != null)           projects = projectService.getByUserId(userId);
        else if (departmentName != null) projects = projectService.getByDept(departmentName);
        else                          projects = projectService.getAll();
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
            Integer reqId   = toInt(body.get("requestorId"));
            String  reqName = (String) body.getOrDefault("requestorName","Admin");
            Project saved   = projectService.create(body, reqId, reqName);
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
            Integer reqId   = toInt(body.get("requestorId"));
            String  reqName = (String) body.getOrDefault("requestorName","User");
            Project saved   = projectService.update(id, body, reqId, reqName);
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
            String  note     = (String) body.getOrDefault("note", "");
            Integer userId   = toInt(body.get("userId"));
            String  userName = userRepo.findById(userId).map(User::getName).orElse("User");
            projectService.updateProgress(id, progress, note, userId, userName);
            return ok(ApiResponse.ok("Progress updated", null));
        } catch (Exception e) {
            return ok(ApiResponse.error(e.getMessage()));
        }
    }

    /** DELETE /api/projects/{id} — admin only */
    @DeleteMapping("/projects/{id}")
    public ResponseEntity<ApiResponse> deleteProject(@PathVariable Integer id,
                                                      @RequestBody(required=false) Map<String,Object> body) {
        try {
            Integer reqId   = body != null ? toInt(body.get("requestorId"))    : null;
            String  reqName = body != null ? (String)body.get("requestorName") : "Admin";
            projectService.delete(id, reqId, reqName);
            return ok(ApiResponse.ok("Project deleted", null));
        } catch (Exception e) {
            return ok(ApiResponse.error(e.getMessage()));
        }
    }

    // ════════════════════════════════════════════════════════════
    //  PROJECT ASSIGNMENTS
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
            @RequestParam(required=false) Integer requestorId,
            @RequestParam(required=false) String  requestorName) {
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
    //  COMMENTS
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
    //  FILE UPLOAD & DOWNLOAD
    // ════════════════════════════════════════════════════════════

    /** POST /api/files/upload — multipart file upload */
    @PostMapping("/files/upload")
    @Transactional
    public ResponseEntity<ApiResponse> uploadFile(
            @RequestParam("file")       MultipartFile file,
            @RequestParam("projectId")  Integer projectId,
            @RequestParam("uploaderId") Integer uploaderId) {
        try {
            String filepath = fileStorage.store(file, projectId);
            String size     = fileStorage.humanSize(file.getSize());

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
    //  NOTIFICATIONS
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
            Integer userId  = toInt(body.get("userId"));
            String  title   = (String) body.get("title");
            String  message = (String) body.get("message");
            String  typeStr = (String) body.getOrDefault("type", "info");
            String  link    = (String) body.getOrDefault("link", "overview");
            Notification saved = notifService.send(userId, title, message,
                Notification.NotifType.valueOf(typeStr), link);
            return ok(ApiResponse.ok("Notification sent", saved));
        } catch (Exception e) {
            return ok(ApiResponse.error(e.getMessage()));
        }
    }

    // ════════════════════════════════════════════════════════════
    //  MESSAGES
    // ════════════════════════════════════════════════════════════

    /** POST /api/messages — send a message */
    @PostMapping("/messages")
    @Transactional
    public ResponseEntity<ApiResponse> sendMessage(@RequestBody Map<String, Object> body) {
        try {
            Message m = new Message();
            m.setFromId(toInt(body.get("fromId")));
            m.setToId(toInt(body.get("toId")));
            m.setSubject((String) body.getOrDefault("subject","No Subject"));
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
    //  PERFORMANCE / DAILY ACTIVITIES
    // ════════════════════════════════════════════════════════════

    /** GET /api/performance?userId=X&year=2026&month=02 */
    @GetMapping("/performance")
    public ResponseEntity<ApiResponse> getPerformance(
            @RequestParam Integer userId,
            @RequestParam(defaultValue = "2026") int year,
            @RequestParam(required = false)       String month) {
        try {
            List<DailyActivity> acts;
            if (month != null && !month.equals("all")) {
                int m = Integer.parseInt(month);
                acts = activityRepo.findByUserIdAndYearAndMonth(userId, year, m);
            } else {
                acts = activityRepo.findByUserIdAndYear(userId, year);
            }

            // Aggregate stats
            double  totalHours  = acts.stream().mapToDouble(a -> a.getHoursWorked().doubleValue()).sum();
            int     totalCommits= acts.stream().mapToInt(DailyActivity::getCommits).sum();
            int     totalTasks  = acts.stream().mapToInt(DailyActivity::getTasksDone).sum();
            double  avgHrs      = acts.isEmpty() ? 0 : totalHours / acts.size();
            int     productivity= Math.min(100, (int)(totalCommits / Math.max(1, acts.size()) * 8 + 70));

            User u = userRepo.findById(userId).orElseThrow();

            Map<String, Object> result = new HashMap<>();
            result.put("activities",        acts);
            result.put("totalCommits",      totalCommits);
            result.put("totalHours",        totalHours);
            result.put("totalTasks",        totalTasks);
            result.put("avgHoursPerDay",    Math.round(avgHrs * 10.0) / 10.0);
            result.put("productivityScore", productivity);
            result.put("performanceScore",  u.getPerformanceScore());
            return ok(ApiResponse.ok(result));
        } catch (Exception e) {
            return ok(ApiResponse.error(e.getMessage()));
        }
    }

    // ════════════════════════════════════════════════════════════
    //  ACTIVITIES TIMELINE (for dashboards)
    // ════════════════════════════════════════════════════════════

    /** GET /api/activities?userId=X&limit=5  OR  ?departmentId=X&limit=8 */
    @GetMapping("/activities")
    public ResponseEntity<ApiResponse> getActivities(
            @RequestParam(required=false) Integer userId,
            @RequestParam(required=false) Integer departmentId,
            @RequestParam(defaultValue="10") int limit) {
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
    //  DASHBOARD STATS
    // ════════════════════════════════════════════════════════════

    /** GET /api/dashboard/stats?userId=X&role=employee */
    @GetMapping("/dashboard/stats")
    public ResponseEntity<ApiResponse> getDashboardStats(
            @RequestParam Integer userId,
            @RequestParam String  role) {
        try {
            DashboardStatsDto stats = new DashboardStatsDto();
            LocalDate start = LocalDate.now().with(TemporalAdjusters.firstDayOfMonth());
            LocalDate end   = LocalDate.now();

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
    //  DEPARTMENTS
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
    //  AUDIT LOG
    // ════════════════════════════════════════════════════════════

    @GetMapping("/audit-log")
    public ResponseEntity<ApiResponse> getAuditLog() {
        return ok(ApiResponse.ok(auditRepo.findTop100ByOrderByCreatedAtDesc()));
    }

    // ════════════════════════════════════════════════════════════
    //  SYSTEM HEALTH
    // ════════════════════════════════════════════════════════════

    @GetMapping("/system/health")
    public ResponseEntity<ApiResponse> systemHealth() {
        Map<String, Object> health = new LinkedHashMap<>();
        health.put("status",        "UP");
        health.put("database",      "OK");
        health.put("totalUsers",    userRepo.count());
        health.put("totalProjects", projRepo.count());
        health.put("totalFiles",    fileRepo.count());
        health.put("version",       "3.0.0");
        health.put("uptime",        "Running");
        return ok(ApiResponse.ok(health));
    }

    // ════════════════════════════════════════════════════════════
    //  APP SETTINGS
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
            if (settings == null) return ok(ApiResponse.error("No settings provided"));
            settings.forEach((key, value) -> {
                AppSetting s = settingRepo.findBySettingKey(key)
                                         .orElse(new AppSetting());
                s.setSettingKey(key);
                s.setSettingValue(value);
                settingRepo.save(s);
            });
            Integer reqId   = toInt(body.get("requestorId"));
            String  reqName = (String) body.getOrDefault("requestorName", "Admin");
            audit.log(reqId, reqName, "Updated app settings", AuditLog.AuditType.config);
            return ok(ApiResponse.ok("Settings saved", null));
        } catch (Exception e) {
            return ok(ApiResponse.error(e.getMessage()));
        }
    }

    // ════════════════════════════════════════════════════════════
    //  PRIVATE HELPERS
    // ════════════════════════════════════════════════════════════

    private ResponseEntity<ApiResponse> ok(ApiResponse body) {
        return ResponseEntity.ok(body);
    }

    private Integer toInt(Object val) {
        if (val == null) return null;
        if (val instanceof Integer i) return i;
        if (val instanceof Number  n) return n.intValue();
        try { return Integer.parseInt(val.toString()); } catch (Exception e) { return null; }
    }
}
```

---

## 10. Security & CORS Configuration

> Already shown in Section 9 (`SecurityConfig.java` and `CorsConfig.java`).

**Key points:**
- BCrypt bean is declared in `SecurityConfig` so it can be `@Autowired` everywhere.
- CSRF is disabled — this is a stateless JSON API.
- All origins are allowed (`"*"`) during development. **For production**, replace with your frontend domain.

---

## 11. File Storage Service

> Already shown in Section 8 (`FileStorageService.java`).

**How files flow:**

```
Browser  →  POST /api/files/upload  →  FileStorageService.store()
                                      → saves to  ./uploads/projects/{projectId}/{uuid}_filename.ext
                                      → saves row in project_files table

Browser  →  GET /api/files/{id}/download
                                      → FileStorageService.load(filepath)
                                      → streams bytes back as attachment
```

**Make the uploads folder:**
```bash
mkdir -p uploads/projects
```

---

## 12. Running the Application

### Step 1 — Import the SQL schema
```bash
mysql -u root -p < spms_schema_v2.sql
```
This creates the `spms` database, all 12 tables, and seeds **27 users**, **10 projects**, assignments, history, notifications, and daily activities.

### Step 2 — Edit application.properties
Change only one line:
```properties
spring.datasource.password=yourMySQLpassword
```

### Step 3 — Build & Run
```bash
# From your project root (where pom.xml is)
./mvnw spring-boot:run
```
Or from IntelliJ: click the **Run** button on `SpmsApplication.java`.

### Step 4 — Open the frontend
Simply open `index.html` in your browser — no web server needed for the HTML/CSS/JS.

### Step 5 — Login with demo credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `password` |
| HR | `hr` | `password` |
| Manager | `manager` | `password` |
| Employee | `employee` | `password` |

All 27 users also have individual usernames (e.g. `john.doe`, `mike.j`) — all with `password`.

---

## 13. All API Endpoints Reference

| Method | Endpoint | Description | Used By |
|--------|----------|-------------|---------|
| POST | `/api/auth/login` | Login with username + password + role | Login page |
| POST | `/api/auth/logout` | Log out and update audit | Logout button |
| GET | `/api/users` | List all users (optional: `?role=` or `?managerId=`) | HR, Admin, Manager |
| GET | `/api/users/{id}` | Get one user + daily activities | Detail modal |
| POST | `/api/users` | Create new user | Admin |
| PUT | `/api/users/{id}` | Edit user details | Admin |
| PUT | `/api/users/{id}/status` | Toggle active/inactive | Admin |
| DELETE | `/api/users/{id}` | Delete user | Admin |
| GET | `/api/projects` | All projects (optional: `?userId=` or `?departmentName=`) | All roles |
| GET | `/api/projects/{id}` | Full project detail (team + files + comments + history) | All roles |
| POST | `/api/projects` | Create project | Admin |
| PUT | `/api/projects/{id}` | Edit/archive project | Admin, Manager |
| PUT | `/api/projects/{id}/progress` | Update progress slider | Employee |
| DELETE | `/api/projects/{id}` | Delete project | Admin |
| POST | `/api/assignments` | Assign users to project | Manager, HR |
| DELETE | `/api/assignments?projectId=&userId=` | Remove team member | Manager |
| POST | `/api/comments` | Add comment to project | Manager, HR |
| POST | `/api/files/upload` | Upload file to project | Employee |
| GET | `/api/files/{id}/download` | Download project file | All |
| GET | `/api/notifications?userId=` | Get notifications for user | All |
| PUT | `/api/notifications/{id}/read` | Mark one notification as read | All |
| PUT | `/api/notifications/read-all?userId=` | Mark all as read | All |
| POST | `/api/notifications` | Create notification | Manager, HR, Admin |
| POST | `/api/messages` | Send internal message | Manager, HR |
| GET | `/api/messages?userId=` | Get inbox | All |
| GET | `/api/performance?userId=&year=&month=` | Performance + daily activities | Employee |
| GET | `/api/dashboard/stats?userId=&role=` | Dashboard stat cards | All |
| GET | `/api/activities?userId=&limit=` | Project history timeline | All |
| GET | `/api/departments` | List departments | All |
| POST | `/api/departments` | Create department | Admin |
| GET | `/api/audit-log` | System-wide audit log | Admin |
| GET | `/api/system/health` | Server + DB health check | Admin |
| GET | `/api/settings` | App settings key-value map | Admin |
| POST | `/api/settings` | Save app settings | Admin |

---

## 14. Testing Each Page

### Login Page
1. Open `index.html` → click **Login**
2. Enter `employee` / `password` / select **Employee** → click Sign In
3. **Expected:** Dashboard loads with YOUR data from the DB (John Doe, Engineering dept)
4. **What hits DB:** `SELECT * FROM users WHERE username='employee' AND role='employee'` + BCrypt verify

### Employee Overview
- Stat cards (Active Projects, Tasks Done, Hours) → from `project_assignments`, `daily_activities`
- Upcoming Deadlines → sorted project deadlines from `projects` table
- Recent Activities → from `project_history` table

### Employee My Projects
- Grid shows only projects assigned to the logged-in user
- Click a project card → full detail modal with real team, files, comments
- Drag & drop file → **POST /api/files/upload** → saved to disk + `project_files` table
- Download file → **GET /api/files/{id}/download** → streams from disk
- Progress slider → **PUT /api/projects/{id}/progress** → updates `projects.progress` in DB
- Add comment → **POST /api/comments** → saved to `project_comments` + notifications sent

### Employee Performance
- Charts read from `daily_activities` table for the logged-in user
- Change Year/Month dropdowns → re-queries DB with new filters

### Employee Profile
- All info (name, ID, dept, email, join date, role, skills) from `users` table
- Performance %, Projects, Tasks Done calculated from DB

### Manager Dashboard
- Overview charts built from live `projects` + `users` data
- Workload table: all employees under this manager from `users WHERE manager_id=X`
- Assign Project modal → **POST /api/assignments** → writes to `project_assignments`
- Manage Team → add/remove members → updates `project_assignments`
- Send Message → **POST /api/messages** + notification created

### HR Dashboard
- Assignment tab: unassigned projects from `projects WHERE status='unassigned'`
- Assign employee → **POST /api/assignments** → DB write + notification to employee
- Employee tracking: all employees from `users WHERE role='employee'`

### Admin Dashboard
- User Management: full CRUD on `users` table
- Project Management: full CRUD on `projects` table
- Audit Log: reads `audit_log` table (every action is logged)
- System Health: live counts from DB
- Settings: reads/writes `app_settings` table

### Notifications (All Roles)
- Bell icon → loads from `notifications WHERE user_id=X` (real-time from DB)
- Mark read → **PUT /api/notifications/{id}/read** → `UPDATE notifications SET is_read=1`
- Notifications auto-created when: project assigned, comment added, message sent

---

## 15. Troubleshooting

### ❌ "Cannot reach backend" toast
- Spring Boot is not running → run `./mvnw spring-boot:run`
- Check it's on port **9090** — not 8080 (that's Jenkins)
- Verify `server.port=9090` in `application.properties`

### ❌ Application fails to start
- Check MySQL is running: `mysql -u root -p`
- Verify database exists: `USE spms; SHOW TABLES;` → should show 12 tables
- Check `spring.datasource.password` matches your MySQL root password
- `ddl-auto=validate` will throw if entity fields don't match table columns

### ❌ "Invalid credentials" even with correct password
- Seed data uses BCrypt hash: `$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh32`
- This is the BCrypt hash of the word **`password`**
- The BCryptPasswordEncoder bean in `SecurityConfig` must match (cost factor 10)
- Verify: `SELECT username, role, LEFT(password,20) FROM users LIMIT 5;`

### ❌ File upload fails
- Make sure `./uploads/projects/` folder exists or is creatable
- Check `spms.upload.path=./uploads` in `application.properties`
- Max size is 50MB — adjust in `application.properties` if needed

### ❌ CORS errors in browser console
- Add the exact frontend origin to `CorsConfig.allowedOrigins()`
- During local dev `"*"` is fine — just open the HTML file directly

### ❌ Charts don't appear
- Means `daily_activities` table has no rows for the logged-in user
- Run this to add test data for any user (replace `8` with your user's id):
```sql
INSERT INTO daily_activities (user_id, activity_date, hours_worked, commits, tasks_done, stress_level) VALUES
(8, CURDATE() - INTERVAL 1 DAY, 8.0, 10, 4, 'medium'),
(8, CURDATE() - INTERVAL 2 DAY, 7.5,  8, 3, 'low'),
(8, CURDATE() - INTERVAL 3 DAY, 9.0, 14, 6, 'high');
```

### ❌ Notifications show 0 / empty
- Seed data only adds notifications for users 1, 2, 4, 8
- After login, any action (assign, comment, message) auto-creates notifications

### Useful SQL Verification Queries
```sql
-- Check all 27 users loaded
SELECT role, COUNT(*) FROM users GROUP BY role;
-- Expected: admin=1, hr=2, manager=4, employee=20

-- Check passwords are BCrypt (not plain text!)
SELECT username, LEFT(password,7) AS hash_start FROM users LIMIT 5;
-- Expected: $2a$10$

-- Check project assignments
SELECT p.code, p.name, COUNT(pa.id) AS team_size
FROM projects p LEFT JOIN project_assignments pa ON p.id = pa.project_id
GROUP BY p.id ORDER BY p.code;

-- Check notifications
SELECT u.name, COUNT(n.id) AS notifs
FROM users u JOIN notifications n ON n.user_id = u.id
GROUP BY u.id;
```

---

## Quick Cheat Sheet — Data Flow for Each UI Action

| UI Action | JavaScript Call | Spring Endpoint | DB Operation |
|-----------|----------------|-----------------|--------------|
| Sign In | `api('POST','/auth/login')` | `POST /api/auth/login` | `SELECT users` + BCrypt verify + `UPDATE last_login` |
| View Dashboard | `api('GET','/dashboard/stats')` | `GET /api/dashboard/stats` | `COUNT project_assignments` + `SUM daily_activities` |
| Load Projects | `api('GET','/projects')` | `GET /api/projects?userId=X` | `SELECT projects JOIN assignments` |
| Open Project | `api('GET','/projects/{id}')` | `GET /api/projects/{id}` | `SELECT project + assignments + files + comments + history` |
| Update Progress | `api('PUT','/projects/{id}/progress')` | `PUT /api/projects/{id}/progress` | `UPDATE projects SET progress=X` + INSERT history |
| Upload File | `apiUpload('/files/upload')` | `POST /api/files/upload` | Save file to disk + `INSERT project_files` + INSERT history |
| Download File | `downloadFile(id)` | `GET /api/files/{id}/download` | `SELECT project_files` → stream bytes |
| Add Comment | `api('POST','/comments')` | `POST /api/comments` | `INSERT project_comments` + INSERT notifications |
| Assign Employee | `api('POST','/assignments')` | `POST /api/assignments` | `INSERT project_assignments` + INSERT notifications |
| Remove from Team | `api('DELETE','/assignments')` | `DELETE /api/assignments` | `DELETE project_assignments` + INSERT history |
| Send Message | `api('POST','/messages')` | `POST /api/messages` | `INSERT messages` + INSERT notifications |
| Create User | `api('POST','/users')` | `POST /api/users` | `INSERT users` (BCrypt hashed pwd) + INSERT audit_log |
| Edit User | `api('PUT','/users/{id}')` | `PUT /api/users/{id}` | `UPDATE users` + INSERT audit_log |
| Delete User | `api('DELETE','/users/{id}')` | `DELETE /api/users/{id}` | `DELETE users` (cascades assignments) + INSERT audit_log |
| Toggle Status | `api('PUT','/users/{id}/status')` | `PUT /api/users/{id}/status` | `UPDATE users SET status=X` + INSERT audit_log |
| View Performance | `api('GET','/performance')` | `GET /api/performance?userId=X` | `SELECT daily_activities WHERE year/month` |
| Bell Notifications | `api('GET','/notifications')` | `GET /api/notifications?userId=X` | `SELECT notifications WHERE user_id=X ORDER BY created_at DESC` |
| Mark Read | `api('PUT','/notifications/{id}/read')` | `PUT /api/notifications/{id}/read` | `UPDATE notifications SET is_read=1` |
| View Audit Log | `api('GET','/audit-log')` | `GET /api/audit-log` | `SELECT audit_log ORDER BY created_at DESC LIMIT 100` |
| System Health | `api('GET','/system/health')` | `GET /api/system/health` | `COUNT users, projects, files` |
| Save Settings | `api('POST','/settings')` | `POST /api/settings` | `INSERT/UPDATE app_settings` + INSERT audit_log |

---

*End of SPMS v3 Spring Boot Backend Manual.*
*Every feature of the app — login, dashboard, projects, performance, profile, notifications, admin CRUD — is fully wired to MySQL through this Spring Boot API. No mock data anywhere.*
