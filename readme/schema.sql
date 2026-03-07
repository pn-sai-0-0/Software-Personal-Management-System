-- ============================================================
--  SPMS v2 — Complete MySQL Schema + Seed Data
--  27 Users: 1 Admin | 2 HR | 4 Managers (2 depts) | 20 Employees
--  2 Departments: Engineering | DevOps
--  Each dept: 2 managers × 5 employees = 10 employees/dept
--  ALL passwords = "password"  (BCrypt hash below)
--  Demo logins: admin/password | hr/password | manager/password | employee/password
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
DROP DATABASE IF EXISTS spms;
CREATE DATABASE spms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE spms;

-- ============================================================
-- DEPARTMENTS
-- ============================================================
CREATE TABLE departments (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    code        VARCHAR(10)  NOT NULL UNIQUE,
    description TEXT,
    head_name   VARCHAR(100),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    employee_id       VARCHAR(20)  NOT NULL UNIQUE,
    name              VARCHAR(100) NOT NULL,
    email             VARCHAR(150) NOT NULL UNIQUE,
    username          VARCHAR(50)  NOT NULL UNIQUE,
    password          VARCHAR(255) NOT NULL,
    role              ENUM('employee','manager','hr','admin') NOT NULL DEFAULT 'employee',
    department_id     INT,
    department_name   VARCHAR(100),
    manager_id        INT NULL,
    skills            JSON,
    workload          INT DEFAULT 0,
    hours_per_week    INT DEFAULT 40,
    performance_score INT DEFAULT 85,
    status            ENUM('active','inactive') DEFAULT 'active',
    avatar_initials   VARCHAR(5),
    join_date         DATE,
    last_login        DATETIME,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (manager_id)    REFERENCES users(id)       ON DELETE SET NULL
);

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE projects (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    code            VARCHAR(20)  NOT NULL UNIQUE,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    department_id   INT,
    department_name VARCHAR(100),
    status          ENUM('unassigned','active','completed','delayed','archived') DEFAULT 'unassigned',
    priority        ENUM('low','medium','high','critical') DEFAULT 'medium',
    urgency         ENUM('low','medium','high') DEFAULT 'medium',
    progress        INT DEFAULT 0,
    progress_note   VARCHAR(255),
    start_date      DATE,
    deadline        DATE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

-- ============================================================
-- PROJECT ASSIGNMENTS
-- ============================================================
CREATE TABLE project_assignments (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    project_id        INT NOT NULL,
    user_id           INT NOT NULL,
    role_in_project   VARCHAR(100) DEFAULT 'Team Member',
    assigned_by       INT NULL,
    commits           INT DEFAULT 0,
    hours_contributed INT DEFAULT 0,
    assigned_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id)  REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)     REFERENCES users(id)    ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id)    ON DELETE SET NULL,
    UNIQUE KEY uq_proj_user (project_id, user_id)
);

-- ============================================================
-- PROJECT FILES
-- ============================================================
CREATE TABLE project_files (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    project_id     INT NOT NULL,
    filename       VARCHAR(255) NOT NULL,
    file_extension VARCHAR(20),
    filepath       VARCHAR(500),
    file_content   LONGBLOB,
    filesize       VARCHAR(20),
    uploader_id    INT,
    upload_date    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id)  REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (uploader_id) REFERENCES users(id)    ON DELETE SET NULL
);

-- ============================================================
-- PROJECT COMMENTS
-- ============================================================
CREATE TABLE project_comments (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    project_id   INT NOT NULL,
    author_id    INT,
    author_name  VARCHAR(100),
    author_role  VARCHAR(50),
    comment_text TEXT NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id)  REFERENCES users(id)    ON DELETE SET NULL
);

-- ============================================================
-- PROJECT HISTORY / AUDIT TRAIL (per project)
-- ============================================================
CREATE TABLE project_history (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    project_id  INT NOT NULL,
    user_id     INT,
    person_name VARCHAR(100),
    action      VARCHAR(500) NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE SET NULL
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    title      VARCHAR(200) NOT NULL,
    message    TEXT NOT NULL,
    type       ENUM('info','warning','review','success','error') DEFAULT 'info',
    is_read    TINYINT(1) DEFAULT 0,
    link       VARCHAR(100) DEFAULT 'overview',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- AUDIT LOG (system-wide)
-- ============================================================
CREATE TABLE audit_log (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NULL,
    user_name  VARCHAR(100),
    action     TEXT NOT NULL,
    type       ENUM('create','update','delete','assign','login','logout','upload','system','config','report','permission','revoke') DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- DAILY ACTIVITIES
-- ============================================================
CREATE TABLE daily_activities (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT NOT NULL,
    activity_date DATE NOT NULL,
    hours_worked  DECIMAL(4,1) DEFAULT 0,
    commits       INT DEFAULT 0,
    tasks_done    INT DEFAULT 0,
    stress_level  ENUM('none','low','medium','high') DEFAULT 'low',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_date (user_id, activity_date)
);

-- ============================================================
-- MESSAGES (internal)
-- ============================================================
CREATE TABLE messages (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    from_id     INT,
    to_id       INT NOT NULL,
    subject     VARCHAR(200),
    body        TEXT NOT NULL,
    is_read     TINYINT(1) DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (from_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (to_id)   REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- APP SETTINGS
-- ============================================================
CREATE TABLE app_settings (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    setting_key   VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- USER SESSIONS (tracks login/logout + session duration for all roles)
-- ============================================================
CREATE TABLE user_sessions (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    user_id        INT NOT NULL,
    user_name      VARCHAR(100),
    user_role      ENUM('employee','manager','hr','admin') NOT NULL,
    login_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    logout_at      DATETIME NULL,
    hours_worked   DECIMAL(5,2) DEFAULT 0,
    session_date   DATE NOT NULL,
    ip_address     VARCHAR(45),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_sessions_date (user_id, session_date)
);

-- ============================================================
-- EMPLOYEE COMMITS LOG (tracks per-commit entries for employees)
-- ============================================================
CREATE TABLE employee_commits (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT NOT NULL,
    project_id    INT,
    commit_date   DATE NOT NULL,
    commit_count  INT DEFAULT 1,
    commit_msg    VARCHAR(255),
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)   REFERENCES users(id)    ON DELETE CASCADE,
    FOREIGN KEY (project_id)REFERENCES projects(id) ON DELETE SET NULL,
    INDEX idx_emp_commits_user_date (user_id, commit_date)
);

-- ============================================================
-- MANAGER DAILY LOG (tracks manager daily actions: logins, comments, assignments)
-- ============================================================
CREATE TABLE manager_daily_log (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    manager_id    INT NOT NULL,
    manager_name  VARCHAR(100),
    action_type   ENUM('login','logout','comment','assign','review','report','message') NOT NULL,
    action_detail VARCHAR(500),
    project_id    INT NULL,
    log_date      DATE NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES users(id)    ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    INDEX idx_mgr_log_date (manager_id, log_date)
);

-- ============================================================
-- TRIGGER: Auto-log manager logins into manager_daily_log on last_login update
-- ============================================================
DELIMITER //
CREATE TRIGGER trg_after_user_login
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    IF NEW.last_login <> OLD.last_login OR (OLD.last_login IS NULL AND NEW.last_login IS NOT NULL) THEN
        IF NEW.role = 'manager' THEN
            INSERT INTO manager_daily_log (manager_id, manager_name, action_type, action_detail, log_date)
            VALUES (NEW.id, NEW.name, 'login', 'Manager logged in', DATE(NEW.last_login));
        END IF;
        -- Record session start for all roles
        INSERT INTO user_sessions (user_id, user_name, user_role, login_at, session_date)
        VALUES (NEW.id, NEW.name, NEW.role, NEW.last_login, DATE(NEW.last_login));
    END IF;
END//
DELIMITER ;

-- ============================================================
-- TRIGGER: Auto-create daily_activities record on employee login (if not exists)
-- ============================================================
DELIMITER //
CREATE TRIGGER trg_employee_login_activity
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    IF NEW.last_login <> OLD.last_login OR (OLD.last_login IS NULL AND NEW.last_login IS NOT NULL) THEN
        IF NEW.role = 'employee' THEN
            INSERT IGNORE INTO daily_activities (user_id, activity_date, hours_worked, commits, tasks_done, stress_level)
            VALUES (NEW.id, DATE(NEW.last_login), 0, 0, 0, 'low');
        END IF;
    END IF;
END//
DELIMITER ;

-- ============================================================
-- TRIGGER: Auto-log manager comments into manager_daily_log
-- ============================================================
DELIMITER //
CREATE TRIGGER trg_manager_comment_log
AFTER INSERT ON project_comments
FOR EACH ROW
BEGIN
    DECLARE v_role VARCHAR(20);
    SELECT role INTO v_role FROM users WHERE id = NEW.author_id LIMIT 1;
    IF v_role = 'manager' THEN
        INSERT INTO manager_daily_log (manager_id, manager_name, action_type, action_detail, project_id, log_date)
        VALUES (NEW.author_id, NEW.author_name, 'comment',
                CONCAT('Commented on project: ', SUBSTRING(NEW.comment_text, 1, 200)),
                NEW.project_id, DATE(NEW.created_at));
    END IF;
END//
DELIMITER ;

-- ============================================================
-- TRIGGER: Update employee commits count in daily_activities when project_history inserted
-- ============================================================
DELIMITER //
CREATE TRIGGER trg_employee_commit_activity
AFTER INSERT ON project_history
FOR EACH ROW
BEGIN
    DECLARE v_role VARCHAR(20);
    IF NEW.user_id IS NOT NULL THEN
        SELECT role INTO v_role FROM users WHERE id = NEW.user_id LIMIT 1;
        IF v_role = 'employee' THEN
            -- Upsert daily_activities: increment commits and tasks_done
            INSERT INTO daily_activities (user_id, activity_date, hours_worked, commits, tasks_done, stress_level)
            VALUES (NEW.user_id, DATE(NEW.created_at), 0, 1, 0, 'low')
            ON DUPLICATE KEY UPDATE commits = commits + 1;
        END IF;
    END IF;
END//
DELIMITER ;

-- ============================================================
-- TRIGGER: Record file uploads in employee daily_activities
-- ============================================================
DELIMITER //
CREATE TRIGGER trg_employee_upload_activity
AFTER INSERT ON project_files
FOR EACH ROW
BEGIN
    DECLARE v_role VARCHAR(20);
    IF NEW.uploader_id IS NOT NULL THEN
        SELECT role INTO v_role FROM users WHERE id = NEW.uploader_id LIMIT 1;
        IF v_role = 'employee' THEN
            INSERT INTO daily_activities (user_id, activity_date, hours_worked, commits, tasks_done, stress_level)
            VALUES (NEW.uploader_id, DATE(NEW.upload_date), 0, 0, 1, 'low')
            ON DUPLICATE KEY UPDATE tasks_done = tasks_done + 1;
        END IF;
    END IF;
END//
DELIMITER ;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- SEED: DEPARTMENTS (2)
-- ============================================================
INSERT INTO departments (id, name, code, description, head_name) VALUES
(1, 'Engineering', 'ENG', 'Software engineering and product development', 'Sarah Adams'),
(2, 'DevOps',      'OPS', 'Infrastructure, CI/CD, cloud operations and reliability', 'Robert Brown');

-- ============================================================
-- SEED: USERS (27)
-- BCrypt hash of "password":
--   $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh32
-- ============================================================
-- Admin (1)
INSERT INTO users (id,employee_id,name,email,username,password,role,department_id,department_name,manager_id,skills,workload,hours_per_week,performance_score,status,avatar_initials,join_date) VALUES
(1,'ADM-001','David Martinez','david.martinez@spms.com','admin',
 '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh32',
 'admin',NULL,NULL,NULL,'["System Administration","Security","Compliance","Reporting"]',0,40,98,'active','DM','2022-01-01');

-- HR (2)
INSERT INTO users (id,employee_id,name,email,username,password,role,department_id,department_name,manager_id,skills,workload,hours_per_week,performance_score,status,avatar_initials,join_date) VALUES
(2,'HR-001','Emily Chen','emily.chen@spms.com','hr',
 '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh32',
 'hr',NULL,NULL,NULL,'["Recruitment","Performance Management","Payroll","Employee Relations"]',35,40,93,'active','EC','2022-03-15'),
(3,'HR-002','Nina Patel','nina.patel@spms.com','nina.p',
 '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh32',
 'hr',NULL,NULL,NULL,'["Training","Onboarding","HR Analytics","Policy Management"]',30,40,91,'active','NP','2022-06-01');

-- Managers: Engineering (2)
INSERT INTO users (id,employee_id,name,email,username,password,role,department_id,department_name,manager_id,skills,workload,hours_per_week,performance_score,status,avatar_initials,join_date) VALUES
(4,'MGR-001','Sarah Adams','sarah.adams@spms.com','manager',
 '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh32',
 'manager',1,'Engineering',NULL,'["Project Management","Agile","React","Node.js","Team Leadership"]',60,45,95,'active','SA','2022-02-10'),
(5,'MGR-002','Chris Morgan','chris.morgan@spms.com','chris.m',
 '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh32',
 'manager',1,'Engineering',NULL,'["Backend Architecture","Java","Spring Boot","Microservices","Team Leadership"]',55,44,92,'active','CM','2022-04-05');

-- Managers: DevOps (2)
INSERT INTO users (id,employee_id,name,email,username,password,role,department_id,department_name,manager_id,skills,workload,hours_per_week,performance_score,status,avatar_initials,join_date) VALUES
(6,'MGR-003','Robert Brown','robert.brown@spms.com','robert.b',
 '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh32',
 'manager',2,'DevOps',NULL,'["AWS","Kubernetes","Terraform","CI/CD","Team Leadership"]',65,44,94,'active','RB','2022-01-20'),
(7,'MGR-004','Jessica Williams','jessica.williams@spms.com','jessica.w',
 '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh32',
 'manager',2,'DevOps',NULL,'["GCP","Azure","GitOps","Site Reliability","Team Leadership"]',58,44,91,'active','JW','2022-05-12');

-- Employees: Engineering / Sarah Adams (5)
INSERT INTO users (id,employee_id,name,email,username,password,role,department_id,department_name,manager_id,skills,workload,hours_per_week,performance_score,status,avatar_initials,join_date) VALUES
(8,'EMP-001','John Doe','john.doe@spms.com','employee',
 '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh32',
 'employee',1,'Engineering',4,'["React","Node.js","Python","AWS","TypeScript"]',70,40,92,'active','JD','2024-01-15'),
(9,'EMP-002','Mike Johnson','mike.johnson@spms.com','mike.j',
 '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh32',
 'employee',1,'Engineering',4,'["Java","Spring Boot","PostgreSQL","Kafka","REST APIs"]',65,40,89,'active','MJ','2023-04-20'),
(10,'EMP-003','Chloe Evans','chloe.evans@spms.com','chloe.e',
 '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh32',
 'employee',1,'Engineering',4,'["Vue.js","React","SCSS","UI Testing","Figma"]',55,38,88,'active','CE','2023-07-08'),
(11,'EMP-004','Alex Thompson','alex.thompson@spms.com','alex.t',
 '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh32',
 'employee',1,'Engineering',4,'["React Native","Flutter","iOS","Android","Firebase"]',75,42,91,'active','AT','2023-01-12'),
(12,'EMP-005','Maria Garcia','maria.garcia@spms.com','maria.g',
 '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh32',
 'employee',1,'Engineering',4,'["Node.js","GraphQL","MongoDB","Redis","Docker"]',60,40,90,'active','MG','2023-09-03');

-- Employees: Engineering / Chris Morgan (5)
INSERT INTO users (id,employee_id,name,email,username,password,role,department_id,department_name,manager_id,skills,workload,hours_per_week,performance_score,status,avatar_initials,join_date) VALUES
(13,'EMP-006','James Wilson','james.wilson@spms.com','james.w',
 '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh32',
 'employee',1,'Engineering',5,'["Python","Django","ML Ops","TensorFlow","Pandas"]',80,42,93,'active','JW2','2022-11-10'),
(14,'EMP-007','Lily Wang','lily.wang@spms.com','lily.w',
 '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh32',
 'employee',1,'Engineering',5,'["Angular","TypeScript","RxJS","NgRx","SCSS"]',50,38,87,'active','LW','2024-02-20'),
(15,'EMP-008','Oscar Brown','oscar.brown@spms.com','oscar.b',
 '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh32',
 'employee',1,'Engineering',5,'["Go","gRPC","Protocol Buffers","Microservices","Kafka"]',70,40,91,'active','OB','2023-06-14'),
(16,'EMP-009','Priya Singh','priya.singh@spms.com','priya.s',
 '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh32',
 'employee',1,'Engineering',5,'["MySQL","PostgreSQL","Redis","Elasticsearch","Data Modeling"]',45,36,86,'active','PS','2024-03-05'),
(17,'EMP-010','Ryan Lee','ryan.lee@spms.com','ryan.l',
 '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh32',
 'employee',1,'Engineering',5,'["C++","Rust","WebAssembly","Performance Optimization"]',35,34,85,'active','RL','2024-06-01');

-- Employees: DevOps / Robert Brown (5)
INSERT INTO users (id,employee_id,name,email,username,password,role,department_id,department_name,manager_id,skills,workload,hours_per_week,performance_score,status,avatar_initials,join_date) VALUES
(18,'EMP-011','Quinn Stevens','quinn.stevens@spms.com','quinn.s',
 '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh32',
 'employee',2,'DevOps',6,'["AWS","Terraform","CloudFormation","IAM","EKS"]',70,40,92,'active','QS','2022-10-14'),
(19,'EMP-012','Rosa Martinez','rosa.martinez@spms.com','rosa.m',
 '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh32',
 'employee',2,'DevOps',6,'["Kubernetes","Helm","ArgoCD","GitOps","Service Mesh"]',65,38,90,'active','RM','2022-08-31'),
(20,'EMP-013','Sam Lee','sam.lee@spms.com','sam.l',
 '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh32',
 'employee',2,'DevOps',6,'["Docker","Podman","Container Security","Registry","Buildah"]',55,36,88,'active','SL','2023-03-17'),
(21,'EMP-014','Tina Turner','tina.turner@spms.com','tina.t',
 '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh32',
 'employee',2,'DevOps',6,'["Jenkins","GitHub Actions","CircleCI","CI/CD","Nexus"]',80,42,91,'active','TT','2022-04-05'),
(22,'EMP-015','Umar Khan','umar.khan@spms.com','umar.k',
 '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh32',
 'employee',2,'DevOps',6,'["Prometheus","Grafana","Loki","Observability","Alertmanager"]',60,38,89,'active','UK','2023-01-24');

-- Employees: DevOps / Jessica Williams (5)
INSERT INTO users (id,employee_id,name,email,username,password,role,department_id,department_name,manager_id,skills,workload,hours_per_week,performance_score,status,avatar_initials,join_date) VALUES
(23,'EMP-016','Adam Reynolds','adam.reynolds@spms.com','adam.r',
 '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh32',
 'employee',2,'DevOps',7,'["GCP","BigQuery","Cloud Run","Pub/Sub","Dataflow"]',75,40,91,'active','AR','2022-09-26'),
(24,'EMP-017','Betty Crawford','betty.crawford@spms.com','betty.c',
 '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh32',
 'employee',2,'DevOps',7,'["Azure","DevOps Pipelines","ARM Templates","AKS","Azure Monitor"]',60,38,89,'active','BC','2023-02-08'),
(25,'EMP-018','Carlos Mendez','carlos.mendez@spms.com','carlos.m',
 '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh32',
 'employee',2,'DevOps',7,'["Terraform","Vault","Secrets Management","PKI","Consul"]',55,36,88,'active','CM2','2023-06-15'),
(26,'EMP-019','Dana Fisher','dana.fisher@spms.com','dana.f',
 '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh32',
 'employee',2,'DevOps',7,'["ELK Stack","Elasticsearch","Logstash","Kibana","Beats"]',45,34,87,'active','DF','2023-10-02'),
(27,'EMP-020','Evan Hughes','evan.hughes@spms.com','evan.h',
 '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh32',
 'employee',2,'DevOps',7,'["ArgoCD","Flux","GitOps","Kubernetes","Helm"]',80,42,92,'active','EH','2022-07-01');

-- ============================================================
-- SEED: PROJECTS (10)
-- ============================================================
INSERT INTO projects (id,code,name,description,department_id,department_name,status,priority,urgency,progress,deadline,start_date) VALUES
(1,'PROJ-001','E-Commerce Platform Redesign',   'Full redesign of customer-facing shopping experience with modern UI/UX',          1,'Engineering','active',    'high',    'medium',75,'2026-04-30','2026-01-10'),
(2,'PROJ-002','Mobile App Development',          'Cross-platform mobile app for iOS and Android using React Native',                1,'Engineering','active',    'medium',  'high',  45,'2026-03-15','2026-01-20'),
(3,'PROJ-003','API Integration Gateway',         'Unified API gateway for third-party integrations with rate limiting and auth',   1,'Engineering','active',    'low',     'high',  25,'2026-02-28','2026-01-25'),
(4,'PROJ-004','Cloud Infrastructure Migration',  'Migrate on-prem services to AWS with zero downtime using blue-green deployment', 2,'DevOps',    'active',    'high',    'low',   60,'2026-05-10','2026-01-05'),
(5,'PROJ-005','DevOps Pipeline Automation',      'Automated CI/CD pipelines with GitOps patterns and quality gates',              2,'DevOps',    'active',    'high',    'medium',55,'2026-03-30','2026-01-08'),
(6,'PROJ-006','ML Data Pipeline',                'Machine learning data pipeline for predictive analytics and model serving',      1,'Engineering','unassigned','critical','high',   0,'2026-07-01','2026-03-15'),
(7,'PROJ-007','Security Hardening Initiative',   'Security audit, vulnerability patching, and zero-trust network implementation',  2,'DevOps',    'active',    'critical','high',  40,'2026-04-15','2026-02-01'),
(8,'PROJ-008','HR Management System',            'Internal HR platform for leave, payroll, onboarding and performance tracking',  1,'Engineering','completed', 'medium',  'low',  100,'2026-01-15','2025-10-01'),
(9,'PROJ-009','Design System v2.0',              'Unified design system, component library, and documentation portal',            1,'Engineering','active',    'high',    'medium',50,'2026-04-01','2026-01-15'),
(10,'PROJ-010','Monitoring Dashboard',           'Real-time observability platform with alerts, APM and distributed tracing',     2,'DevOps',    'active',    'medium',  'medium',35,'2026-05-20','2026-02-10');

-- ============================================================
-- SEED: PROJECT ASSIGNMENTS
-- ============================================================
-- PROJ-001: E-Commerce
INSERT INTO project_assignments (project_id,user_id,role_in_project,assigned_by,commits,hours_contributed) VALUES
(1,8, 'Lead Developer',   4,145,320),
(1,9, 'Backend Developer',4,112,290),
(1,10,'Frontend Developer',4,89,240);
-- PROJ-002: Mobile App
INSERT INTO project_assignments (project_id,user_id,role_in_project,assigned_by,commits,hours_contributed) VALUES
(2,11,'Mobile Developer',4,78,210),
(2,12,'Backend Developer',4,65,190);
-- PROJ-003: API Gateway
INSERT INTO project_assignments (project_id,user_id,role_in_project,assigned_by,commits,hours_contributed) VALUES
(3,8, 'Full Stack Dev',5,45,120),
(3,13,'Integrations Dev',5,38,100);
-- PROJ-004: Cloud Migration
INSERT INTO project_assignments (project_id,user_id,role_in_project,assigned_by,commits,hours_contributed) VALUES
(4,18,'Cloud Architect',6,95,280),
(4,20,'Infrastructure Dev',6,88,240),
(4,21,'AWS Specialist',6,72,200);
-- PROJ-005: Pipeline Automation
INSERT INTO project_assignments (project_id,user_id,role_in_project,assigned_by,commits,hours_contributed) VALUES
(5,18,'DevOps Engineer',6,90,250),
(5,21,'CI/CD Specialist',6,85,230),
(5,19,'Platform Engineer',6,70,190);
-- PROJ-007: Security Hardening
INSERT INTO project_assignments (project_id,user_id,role_in_project,assigned_by,commits,hours_contributed) VALUES
(7,23,'Security Architect',7,60,180),
(7,24,'Cloud Security Eng',7,45,150),
(7,25,'Secrets Manager',7,30,120);
-- PROJ-009: Design System
INSERT INTO project_assignments (project_id,user_id,role_in_project,assigned_by,commits,hours_contributed) VALUES
(9,14,'Frontend Developer',5,55,160),
(9,15,'Component Developer',5,48,140);
-- PROJ-010: Monitoring Dashboard
INSERT INTO project_assignments (project_id,user_id,role_in_project,assigned_by,commits,hours_contributed) VALUES
(10,22,'Metrics Engineer',7,40,120),
(10,26,'ELK Engineer',7,35,100),
(10,27,'GitOps Engineer',7,50,140);

-- ============================================================
-- SEED: PROJECT HISTORY
-- ============================================================
-- Project history WITH user_id so /activities endpoint can filter properly
INSERT INTO project_history (project_id, user_id, person_name, action, created_at) VALUES
(1, 8,  'John Doe',       'Pushed 12 commits — Cart module update',              NOW() - INTERVAL 2 HOUR),
(1, 9,  'Mike Johnson',   'Completed backend API integration for checkout',       NOW() - INTERVAL 4 HOUR),
(1, 10, 'Chloe Evans',    'Updated UI components for product listing page',       NOW() - INTERVAL 1 DAY),
(1, 4,  'Sarah Adams',    'Reviewed milestone 3 deliverables',                   NOW() - INTERVAL 2 DAY),
(2, 11, 'Alex Thompson',  'Implemented push notification system',                 NOW() - INTERVAL 3 HOUR),
(2, 12, 'Maria Garcia',   'Completed user authentication module',                NOW() - INTERVAL 6 HOUR),
(3, 8,  'John Doe',       'Added rate limiting middleware',                       NOW() - INTERVAL 1 HOUR),
(3, 13, 'James Wilson',   'Configured OAuth2 provider integrations',             NOW() - INTERVAL 5 HOUR),
(4, 18, 'Quinn Stevens',  'Provisioned new VPC and subnets on AWS',              NOW() - INTERVAL 1 HOUR),
(4, 21, 'Tina Turner',    'Configured GitHub Actions pipeline for infra deploy',  NOW() - INTERVAL 3 HOUR),
(5, 21, 'Tina Turner',    'Deployed Jenkins pipeline for staging environment',   NOW() - INTERVAL 2 HOUR),
(5, 18, 'Quinn Stevens',  'Set up ArgoCD for GitOps-based deployment',           NOW() - INTERVAL 8 HOUR),
(7, 23, 'Adam Reynolds',  'Completed vulnerability scan — 12 issues found',      NOW() - INTERVAL 4 HOUR),
(9, 14, 'Lily Wang',      'Published new button component to Storybook',         NOW() - INTERVAL 5 HOUR),
(10,22, 'Umar Khan',      'Added Grafana dashboard for API latency tracking',    NOW() - INTERVAL 2 HOUR),
-- Additional John Doe (id=8) activity entries for recent activities timeline
(1, 8,  'John Doe',       'Updated progress on PROJ-001 to 75%',                 NOW() - INTERVAL 6 HOUR),
(1, 8,  'John Doe',       'Reviewed PR #87 — Backend Auth module',               NOW() - INTERVAL 1 DAY),
(3, 8,  'John Doe',       'Fixed rate limiting bug in API Gateway',               NOW() - INTERVAL 2 DAY),
(1, 8,  'John Doe',       'Uploaded api-documentation.pdf to PROJ-001',          NOW() - INTERVAL 3 DAY),
(1, 8,  'John Doe',       'Merged feature/cart-checkout into develop branch',    NOW() - INTERVAL 4 DAY),
(3, 8,  'John Doe',       'Implemented JWT token refresh endpoint',               NOW() - INTERVAL 5 DAY),
(1, 8,  'John Doe',       'Sprint planning — assigned 6 tasks for sprint 8',     NOW() - INTERVAL 6 DAY);

-- ============================================================
-- SEED: PROJECT FILES
-- ============================================================
INSERT INTO project_files (project_id,filename,file_extension,filepath,filesize,uploader_id) VALUES
(1,'api-documentation.pdf', 'pdf', 'uploads/projects/1/api-documentation.pdf',   '1.8 MB',  8),
(1,'e2e-tests.spec.js',     'js',  'uploads/projects/1/e2e-tests.spec.js',        '256 KB',  10),
(2,'app-wireframes.pdf',    'pdf', 'uploads/projects/2/app-wireframes.pdf',       '3.1 MB',  11),
(4,'infra-diagram.png',     'png', 'uploads/projects/4/infra-diagram.png',        '890 KB',  18),
(5,'pipeline-config.yml',   'yml', 'uploads/projects/5/pipeline-config.yml',      '42 KB',   21),
(7,'security-audit.pdf',    'pdf', 'uploads/projects/7/security-audit.pdf',       '2.4 MB',  23);

-- ============================================================
-- SEED: PROJECT COMMENTS
-- ============================================================
INSERT INTO project_comments (project_id,author_id,author_name,author_role,comment_text) VALUES
(1,2, 'Emily Chen',   'HR Manager', 'Great progress! Please ensure all deliverables are ready by month end.'),
(1,4, 'Sarah Adams',  'Manager',    'Prioritize the checkout flow — client review is on the 15th.'),
(2,4, 'Sarah Adams',  'Manager',    'Ensure offline mode is handled gracefully before the next demo.'),
(3,5, 'Chris Morgan', 'Manager',    'Make sure all third-party integrations have proper fallback handling.'),
(4,6, 'Robert Brown', 'Manager',    'Zero-downtime requirement is critical — test the blue-green switch thoroughly.'),
(5,6, 'Robert Brown', 'Manager',    'All pipelines must pass quality gates before merging to main branch.'),
(7,1, 'David Martinez','Admin',     'This is highest priority — escalate any blockers immediately.');

-- ============================================================
-- SEED: NOTIFICATIONS (for key users)
-- ============================================================
-- John Doe (employee demo user — id=8)
INSERT INTO notifications (user_id,title,message,type,is_read,link) VALUES
(8,'Project Assigned',     'You have been assigned to PROJ-001 as Lead Developer',           'info',   0,'projects'),
(8,'Deadline Approaching', 'PROJ-003 API Gateway is overdue — was due 2026-02-28',           'warning',0,'projects'),
(8,'Code Review Requested','Mike Johnson requested a review on PR #87 — Backend Auth',       'review', 0,'projects'),
(8,'New Team Member',      'Chloe Evans has joined your E-Commerce project team',            'info',   1,'overview'),
(8,'Performance Report',   'Your Q1 2026 performance report is now available',               'info',   1,'performance');
-- Sarah Adams (manager demo user — id=4)
INSERT INTO notifications (user_id,title,message,type,is_read,link) VALUES
(4,'Project At Risk',      'PROJ-003 API Gateway is overdue — immediate attention needed',   'warning',0,'projects'),
(4,'Team Update',          'Alex Thompson completed the mobile push notification module',    'info',   0,'overview'),
(4,'HR Message',           'Emily Chen: Please review the Q1 performance evaluations',       'info',   1,'overview');
-- Emily Chen (hr demo user — id=2)
INSERT INTO notifications (user_id,title,message,type,is_read,link) VALUES
(2,'New Employee',         'Ryan Lee (EMP-010) has been onboarded successfully',             'info',   0,'employee'),
(2,'Project Unassigned',   'PROJ-006 ML Pipeline still has no team assigned',               'warning',0,'assignment'),
(2,'System Report',        'Monthly HR analytics report is ready for review',               'info',   1,'overview');
-- David Martinez (admin — id=1)
INSERT INTO notifications (user_id,title,message,type,is_read,link) VALUES
(1,'System Alert',         'Disk usage on prod server reached 78% — consider cleanup',      'warning',0,'health'),
(1,'New User Created',     'HR added Ryan Lee as EMP-010 in Engineering department',         'info',   0,'users'),
(1,'Audit Event',          'Sarah Adams updated PROJ-001 progress to 75%',                  'info',   1,'audit');

-- ============================================================
-- SEED: AUDIT LOG
-- ============================================================
INSERT INTO audit_log (user_id,user_name,action,type) VALUES
(1,'David Martinez', 'System initialized — 27 users across 2 departments',                         'system'),
(4,'Sarah Adams',    'Assigned John Doe as Lead Developer on PROJ-001',                             'assign'),
(4,'Sarah Adams',    'Updated PROJ-001 progress from 65% to 75%',                                  'update'),
(2,'Emily Chen',     'Onboarded new employee Ryan Lee (EMP-010)',                                   'create'),
(6,'Robert Brown',   'Assigned Quinn Stevens as Cloud Architect on PROJ-004',                      'assign'),
(1,'David Martinez', 'Created new project: PROJ-010 Monitoring Dashboard',                         'create'),
(5,'Chris Morgan',   'Updated PROJ-003 status to active',                                          'update'),
(2,'Emily Chen',     'Generated monthly performance report for Engineering dept',                   'report'),
(8,'John Doe',       'Uploaded api-documentation.pdf to PROJ-001',                                 'upload'),
(1,'David Martinez', 'System backup completed successfully',                                         'system');

-- ============================================================
-- SEED: DAILY ACTIVITIES (for key users)
-- ============================================================
-- John Doe (EMP-001, id=8) — Engineering
INSERT INTO daily_activities (user_id,activity_date,hours_worked,commits,tasks_done,stress_level) VALUES
(8,'2026-02-03',8.5,12,5,'high'),(8,'2026-02-04',8.0,10,4,'medium'),(8,'2026-02-05',9.0,15,6,'high'),
(8,'2026-02-06',7.5, 8,3,'low'),(8,'2026-02-07',8.0,11,5,'medium'),(8,'2026-02-10',8.5,13,5,'medium'),
(8,'2026-02-11',7.0, 9,4,'low'),(8,'2026-02-12',8.0,10,4,'medium'),(8,'2026-02-13',9.5,16,7,'high'),
(8,'2026-02-14',7.5, 8,3,'low'),(8,'2026-02-17',8.0,11,5,'medium'),(8,'2026-02-18',8.5,13,5,'medium'),
(8,'2026-02-19',9.0,14,6,'high'),(8,'2026-02-20',7.0, 9,4,'low'),(8,'2026-02-21',8.0,12,5,'medium'),
-- March 2026 (current month — fixes the 0 stats bug)
(8,'2026-03-03',8.5,13,5,'medium'),(8,'2026-03-04',9.0,14,6,'high'),
(8,'2026-03-05',8.0,11,4,'medium'),(8,'2026-03-06',7.5,9, 3,'low'),
-- 2025 historical data (for year filter)
(8,'2025-01-06',8.0,10,4,'medium'),(8,'2025-01-07',8.5,12,5,'medium'),(8,'2025-01-08',9.0,14,6,'high'),
(8,'2025-02-03',7.5, 9,3,'low'),(8,'2025-02-04',8.0,11,4,'medium'),(8,'2025-02-05',8.5,13,5,'medium'),
(8,'2025-03-03',8.0,10,4,'medium'),(8,'2025-03-04',9.5,15,7,'high'),(8,'2025-03-05',8.0,11,4,'medium'),
(8,'2025-04-07',8.5,13,5,'medium'),(8,'2025-04-08',7.0, 8,3,'low'),(8,'2025-04-09',8.0,10,4,'medium'),
(8,'2025-05-05',9.0,14,6,'high'),(8,'2025-05-06',8.5,12,5,'medium'),(8,'2025-05-07',7.5, 9,3,'low'),
(8,'2025-06-02',8.0,11,4,'medium'),(8,'2025-06-03',8.5,13,5,'medium'),(8,'2025-06-04',9.0,15,6,'high'),
(8,'2025-07-07',7.5, 9,3,'low'),(8,'2025-07-08',8.0,10,4,'medium'),(8,'2025-07-09',8.5,12,5,'medium'),
(8,'2025-08-04',9.0,14,6,'high'),(8,'2025-08-05',8.0,11,4,'medium'),(8,'2025-08-06',7.0, 8,3,'low'),
(8,'2025-09-01',8.5,13,5,'medium'),(8,'2025-09-02',8.0,10,4,'medium'),(8,'2025-09-03',9.5,16,7,'high'),
(8,'2025-10-06',7.5, 9,3,'low'),(8,'2025-10-07',8.0,11,4,'medium'),(8,'2025-10-08',8.5,13,5,'medium'),
(8,'2025-11-03',9.0,14,6,'high'),(8,'2025-11-04',8.0,10,4,'medium'),(8,'2025-11-05',7.5, 9,3,'low'),
(8,'2025-12-01',8.5,12,5,'medium'),(8,'2025-12-02',9.0,15,6,'high'),(8,'2025-12-03',8.0,11,4,'medium');
-- Mike Johnson (id=9)
INSERT INTO daily_activities (user_id,activity_date,hours_worked,commits,tasks_done,stress_level) VALUES
(9,'2026-02-03',8.0,9,4,'medium'),(9,'2026-02-04',8.5,11,5,'high'),(9,'2026-02-05',7.5,8,3,'medium'),
(9,'2026-02-06',8.0,10,4,'medium'),(9,'2026-02-07',7.0,7,3,'low'),(9,'2026-02-10',8.5,12,5,'medium'),
(9,'2026-02-11',9.0,14,6,'high'),(9,'2026-02-12',8.0,10,4,'medium'),
(9,'2026-03-03',8.0,10,4,'medium'),(9,'2026-03-04',8.5,12,5,'high'),(9,'2026-03-05',7.5,8,3,'medium');
-- Sarah Adams (Manager, id=4)
INSERT INTO daily_activities (user_id,activity_date,hours_worked,commits,tasks_done,stress_level) VALUES
(4,'2026-02-03',8.0,3,6,'medium'),(4,'2026-02-04',9.0,2,8,'high'),(4,'2026-02-05',8.5,4,7,'medium'),
(4,'2026-02-06',8.0,2,6,'medium'),(4,'2026-02-07',9.5,5,9,'high'),(4,'2026-02-10',8.0,3,7,'medium'),
(4,'2026-03-03',8.5,4,8,'medium'),(4,'2026-03-04',9.0,5,9,'high'),(4,'2026-03-05',8.0,3,7,'medium');
-- Quinn Stevens (id=18)
INSERT INTO daily_activities (user_id,activity_date,hours_worked,commits,tasks_done,stress_level) VALUES
(18,'2026-02-03',8.0,7,4,'medium'),(18,'2026-02-04',8.5,9,5,'high'),(18,'2026-02-05',7.5,6,3,'medium'),
(18,'2026-02-06',8.0,8,4,'medium'),(18,'2026-02-07',9.0,11,5,'high'),(18,'2026-02-10',8.0,8,4,'medium'),
(18,'2026-02-11',7.5,7,4,'low'),(18,'2026-02-12',8.5,9,5,'medium'),
(18,'2026-03-03',8.0,8,4,'medium'),(18,'2026-03-04',9.0,10,5,'high'),(18,'2026-03-05',7.5,7,3,'medium');

-- ============================================================
-- SEED: APP SETTINGS
-- ============================================================
INSERT INTO app_settings (setting_key,setting_value) VALUES
('company_name',           'TechCorp Solutions'),
('max_projects_per_employee','5'),
('work_hours_per_day',      '8'),
('session_timeout',         '60'),
('email_notifications',     'true'),
('app_version',             '2.0.0');

-- ============================================================
-- SEED: USER SESSIONS (recent login history)
-- ============================================================
INSERT INTO user_sessions (user_id,user_name,user_role,login_at,logout_at,hours_worked,session_date) VALUES
-- Sarah Adams (Manager) — recent sessions
(4,'Sarah Adams','manager','2026-03-06 08:30:00','2026-03-06 17:45:00',9.25,'2026-03-06'),
(4,'Sarah Adams','manager','2026-03-05 08:15:00','2026-03-05 18:00:00',9.75,'2026-03-05'),
(4,'Sarah Adams','manager','2026-03-04 09:00:00','2026-03-04 17:30:00',8.50,'2026-03-04'),
(4,'Sarah Adams','manager','2026-03-03 08:45:00','2026-03-03 17:00:00',8.25,'2026-03-03'),
-- John Doe (Employee) — recent sessions
(8,'John Doe','employee','2026-03-06 08:00:00','2026-03-06 15:30:00',7.50,'2026-03-06'),
(8,'John Doe','employee','2026-03-05 08:30:00','2026-03-05 16:30:00',8.00,'2026-03-05'),
(8,'John Doe','employee','2026-03-04 09:00:00','2026-03-04 18:00:00',9.00,'2026-03-04'),
(8,'John Doe','employee','2026-03-03 08:00:00','2026-03-03 16:30:00',8.50,'2026-03-03'),
-- Emily Chen (HR) — recent sessions
(2,'Emily Chen','hr','2026-03-06 09:00:00','2026-03-06 17:00:00',8.00,'2026-03-06'),
(2,'Emily Chen','hr','2026-03-05 08:30:00','2026-03-05 17:30:00',9.00,'2026-03-05');

-- ============================================================
-- SEED: MANAGER DAILY LOG (recent manager activities)
-- ============================================================
INSERT INTO manager_daily_log (manager_id,manager_name,action_type,action_detail,project_id,log_date) VALUES
(4,'Sarah Adams','login',  'Manager logged into portal',                              NULL, '2026-03-06'),
(4,'Sarah Adams','comment','Prioritize the checkout flow — client review is on 15th',  1,   '2026-03-06'),
(4,'Sarah Adams','assign', 'Assigned John Doe to PROJ-001 as Lead Developer',          1,   '2026-03-05'),
(4,'Sarah Adams','review', 'Reviewed milestone 3 deliverables for PROJ-001',           1,   '2026-03-04'),
(4,'Sarah Adams','login',  'Manager logged into portal',                              NULL, '2026-03-04'),
(4,'Sarah Adams','comment','Ensure offline mode is handled gracefully before demo',    2,   '2026-03-03'),
(4,'Sarah Adams','login',  'Manager logged into portal',                              NULL, '2026-03-03'),
(5,'Chris Morgan','login', 'Manager logged into portal',                              NULL, '2026-03-06'),
(5,'Chris Morgan','comment','Make sure all third-party integrations have fallback',    3,   '2026-03-05'),
(5,'Chris Morgan','assign','Assigned team to PROJ-003 API Gateway',                   3,   '2026-03-04'),
(6,'Robert Brown','login', 'Manager logged into portal',                              NULL, '2026-03-06'),
(6,'Robert Brown','comment','Zero-downtime requirement is critical — test thoroughly', 4,   '2026-03-05'),
(7,'Jessica Williams','login','Manager logged into portal',                           NULL, '2026-03-06');

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================
/*
SELECT role, COUNT(*) AS total FROM users GROUP BY role;
-- Expected: admin=1, hr=2, manager=4, employee=20

SELECT d.name AS dept, u.role, COUNT(*) AS cnt
FROM departments d JOIN users u ON u.department_id=d.id
GROUP BY d.name, u.role ORDER BY d.name, u.role;
-- Engineering: manager=2, employee=10
-- DevOps:      manager=2, employee=10

SELECT m.name AS manager, COUNT(e.id) AS direct_reports
FROM users m JOIN users e ON e.manager_id=m.id
WHERE m.role='manager' GROUP BY m.id;
-- Each manager: 5 direct reports

SELECT p.name, COUNT(pa.id) AS team_size
FROM projects p LEFT JOIN project_assignments pa ON p.id=pa.project_id
GROUP BY p.id;

-- Check user sessions
SELECT user_name, user_role, session_date, hours_worked
FROM user_sessions ORDER BY session_date DESC LIMIT 10;

-- Check manager daily log
SELECT manager_name, action_type, action_detail, log_date
FROM manager_daily_log ORDER BY log_date DESC LIMIT 10;
*/

-- ============================================================
-- FILE DELETION LOG TABLE
-- Tracks every file removal: who deleted it, which project, when
-- ============================================================
CREATE TABLE IF NOT EXISTS file_deletion_log (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    file_id      INT            NOT NULL,
    filename     VARCHAR(255)   NOT NULL,
    project_id   INT            NOT NULL,
    deleter_id   INT,
    deleter_name VARCHAR(100),
    deleted_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TRIGGER: log every project_files DELETE into
--   1. file_deletion_log   (permanent audit trail)
--   2. project_history     (shows up in the activity timeline)
--   3. manager_daily_log   (if the deleter is a manager)
-- ============================================================
DELIMITER $$

DROP TRIGGER IF EXISTS trg_after_file_delete$$
CREATE TRIGGER trg_after_file_delete
AFTER DELETE ON project_files
FOR EACH ROW
BEGIN
    -- 1. Write permanent file deletion record
    INSERT INTO file_deletion_log (file_id, filename, project_id, deleter_id, deleter_name)
    VALUES (OLD.id, OLD.filename, OLD.project_id, OLD.uploader_id, 'system');

    -- 2. Add a project history / timeline entry
    INSERT INTO project_history (project_id, user_id, person_name, action, created_at)
    VALUES (
        OLD.project_id,
        OLD.uploader_id,
        IFNULL((SELECT name FROM users WHERE id = OLD.uploader_id LIMIT 1), 'User'),
        CONCAT('Deleted file: ', OLD.filename),
        NOW()
    );
END$$

DELIMITER ;

-- ============================================================
-- HR ACTIVITY LOG TABLE
-- Tracks every HR action: login, assignment, comment, download
-- ============================================================
CREATE TABLE IF NOT EXISTS hr_activity_log (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    hr_id        INT,
    hr_name      VARCHAR(100),
    action_type  ENUM('login','logout','assign','comment','download','view','message') NOT NULL,
    action_detail TEXT,
    project_id   INT NULL,
    log_date     DATE DEFAULT (CURDATE()),
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed: sample HR activity log for Emily Chen (id=2) and Michael Scott (id=3)
INSERT INTO hr_activity_log (hr_id, hr_name, action_type, action_detail, project_id, log_date) VALUES
(2,'Emily Chen','login',   'HR logged into portal',                             NULL, '2026-03-06'),
(2,'Emily Chen','assign',  'Assigned PROJ-001 to Engineering department',        1,   '2026-03-06'),
(2,'Emily Chen','comment', 'HR commented on project PROJ-004',                  4,   '2026-03-05'),
(2,'Emily Chen','download','Downloaded infra-diagram.png from PROJ-004',        4,   '2026-03-05'),
(2,'Emily Chen','login',   'HR logged into portal',                             NULL, '2026-03-05'),
(2,'Emily Chen','assign',  'Assigned PROJ-005 to DevOps department',            5,   '2026-03-04'),
(2,'Emily Chen','login',   'HR logged into portal',                             NULL, '2026-03-04');

-- updating the password coz its bugged
UPDATE users SET password = '$2a$10$XURPShQNCsLjp1ESc2laoObo9QZDhxz73hJPaEv7/cBha4pk0AgP.';