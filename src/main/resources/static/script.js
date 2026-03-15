const API = 'https://spms-backend-hbad.onrender.com/api';

// ── Application State ──────────────────────────────────────
let currentUser = null;
let currentTheme = 'light';
let selectedProject = null;
let selectedEmployees = [];
let selectedDepartments = [];
let sidebarCollapsed = false;
let allProjects = [];
let allEmployees = [];
let allUsers = [];
let allDepartments = [];
let notificationsList = [];
let charts = {};
let currentEmployeeActivities = []; // all daily_activities for the logged-in employee
let empDashStats = {};               // computed stat card values (for showStatDetail)

// ── Core API Utility ────────────────────────────────────────
async function apiCall(endpoint, method = 'GET', data = null) {
    try { return await api(method, '/' + endpoint, data); } catch(e) { console.warn('apiCall:', e.message); }
}

async function api(method, endpoint, data = null) {
    const opts = { method, headers: { 'Content-Type':'application/json' }, mode:'cors' };
    let url = `${API}${endpoint}`;
    if (method === 'GET' && data) url += '?' + new URLSearchParams(removeNulls(data)).toString();
    else if (data) opts.body = JSON.stringify(data);
    const res = await fetch(url, opts);
    let json;
    try { json = await res.json(); } catch { json = {}; }
    if (!res.ok) throw new Error(json.message || `Server error ${res.status}`);
    return json;
}

async function apiUpload(endpoint, formData) {
    const res = await fetch(`${API}${endpoint}`, { method:'POST', body:formData, mode:'cors' });
    let json;
    try { json = await res.json(); } catch { json = {}; }
    if (!res.ok) throw new Error(json.message || `Upload failed ${res.status}`);
    return json;
}

function removeNulls(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([,v]) => v !== null && v !== undefined));
}

// ── Loading helpers ─────────────────────────────────────────
function setLoading(containerId, msg = 'Loading…') {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>${msg}</p></div>`;
}

function setError(containerId, msg = 'Could not load data. Is the Spring Boot backend running on port 9090?') {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>${msg}</p></div>`;
}

// ── Theme ────────────────────────────────────────────────────
function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', currentTheme);
    document.querySelectorAll('.theme-icon').forEach(i => { i.textContent = currentTheme === 'light' ? '🌙' : '☀️'; });
    localStorage.setItem('spms-theme', currentTheme);
}
function loadTheme() {
    const saved = localStorage.getItem('spms-theme');
    if (saved) { currentTheme = saved; document.body.setAttribute('data-theme', currentTheme); document.querySelectorAll('.theme-icon').forEach(i => { i.textContent = currentTheme === 'light' ? '🌙' : '☀️'; }); }
}

// ── Sidebar ──────────────────────────────────────────────────
function toggleSidebar() {
    const dashboard = document.querySelector('.dashboard:not(.hidden)');
    if (!dashboard) return;
    const sidebar = dashboard.querySelector('.sidebar');
    const overlay = dashboard.querySelector('.sidebar-overlay');
    if (!sidebar) return;
    sidebarCollapsed = !sidebarCollapsed;
    sidebar.classList.toggle('collapsed');
    if (overlay) overlay.classList.toggle('active', !sidebarCollapsed);
}

// ── Notifications ────────────────────────────────────────────
function getUnreadCount() { return notificationsList.filter(n => !n.is_read).length; }

function updateNotifBadges() {
    const count = getUnreadCount();
    ['empNotifBadge','mgrNotifBadge','hrNotifBadge','adminNotifBadge'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = count; el.style.display = count > 0 ? 'flex' : 'none'; }
    });
    const header = document.getElementById('notifCountHeader');
    if (header) header.textContent = count > 0 ? `(${count} unread)` : '';
}

async function loadNotifications() {
    if (!currentUser) return;
    try {
        const res = await api('GET', '/notifications', { userId: currentUser.id });
        notificationsList = res.data || [];
    } catch { notificationsList = []; }
    updateNotifBadges();
}

function openNotifications() {
    const panel = document.getElementById('notificationPanel');
    if (!panel) return;
    panel.classList.toggle('active');
    renderNotificationList();
}
function closeNotifications() {
    const panel = document.getElementById('notificationPanel');
    if (panel) panel.classList.remove('active');
}
function renderNotificationList() {
    const list = document.getElementById('notificationList');
    if (!list) return;
    if (notificationsList.length === 0) { list.innerHTML = '<div class="notif-empty">No notifications</div>'; return; }
    list.innerHTML = notificationsList.map(n => `
        <div class="notif-item ${n.is_read ? 'read' : 'unread'}" onclick="handleNotifClick(${n.id},'${n.link||'overview'}')">
            <div class="notif-dot ${n.type}"></div>
            <div class="notif-content">
                <div class="notif-title">${n.title}</div>
                <div class="notif-message">${n.message}</div>
                <div class="notif-time">${formatTime(n.created_at)}</div>
            </div>
            ${!n.is_read ? `<button class="notif-mark-read" onclick="markNotifRead(event,${n.id})">✓</button>` : ''}
        </div>`).join('');
}
async function handleNotifClick(id, link) {
    await markNotifRead(null, id);
    closeNotifications();
    if (currentUser && link) showView(currentUser.role, link, null);
}
async function markNotifRead(event, id) {
    if (event) event.stopPropagation();
    const notif = notificationsList.find(n => n.id === id);
    if (notif) notif.is_read = true;
    try { await api('PUT', `/notifications/${id}/read`); } catch {}
    updateNotifBadges();
    renderNotificationList();
}
async function markAllNotifRead() {
    notificationsList.forEach(n => n.is_read = true);
    try { await api('PUT', '/notifications/read-all', null); /* use POST body */ 
          await api('PUT', `/notifications/read-all?userId=${currentUser.id}`); } catch {}
    updateNotifBadges();
    renderNotificationList();
    showToast('All notifications marked as read ✓');
}

// ── Login / Logout ───────────────────────────────────────────
function openLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) { modal.classList.add('active'); setTimeout(() => document.getElementById('username')?.focus(), 100); }
}
function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.remove('active');
}

async function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const role     = document.getElementById('role').value;
    if (!username || !password || !role) { showToast('Please fill in all fields ❌', 'error'); return; }
    const btn = event.target.querySelector('button[type="submit"]');
    if (btn) { btn.textContent = 'Signing in…'; btn.disabled = true; }

    // Show "waking up" message after 3 seconds if no response yet (Render free tier cold start)
    let wakeupToastShown = false;
    const wakeupTimer = setTimeout(() => {
        wakeupToastShown = true;
        showToast('Backend is waking up on Render… please wait ⏳', 'info');
    }, 3000);

    try {
        const res = await api('POST', '/auth/login', { username, password, role });
        clearTimeout(wakeupTimer);

        // res.success=false means wrong credentials (HTTP 200 with error body)
        if (!res.success) {
            showToast(res.message || 'Invalid credentials — check username, password and role ❌', 'error');
        } else if (res.success && res.data) {
            const user = res.data;
            if (user.role !== role) {
                showToast('Role mismatch — please select the correct role for this account.', 'error');
            } else {
                currentUser = user;
                closeLoginModal();
                initDashboard(role, user); // non-blocking — dashboard shows immediately
                showToast(`Welcome back, ${user.name}! 👋`, 'success');
            }
        } else {
            showToast('Unexpected response from server. Please try again.', 'error');
        }
    } catch (e) {
        clearTimeout(wakeupTimer);
        // Network error (backend unreachable, CORS, etc.)
        showToast('Cannot reach the server. Check your internet connection or wait for the backend to wake up. 🔄', 'error');
    }
    if (btn) { btn.textContent = 'Sign In'; btn.disabled = false; }
}

async function initDashboard(role, user) {
    // Show the dashboard IMMEDIATELY — don't wait for API calls
    document.getElementById('landingPage').classList.add('hidden');
    const dashMap = { employee:'employeeDashboard', manager:'managerDashboard', hr:'hrDashboard', admin:'adminDashboard' };
    const dash = document.getElementById(dashMap[role]);
    if (!dash) return;
    dash.classList.remove('hidden');
    updateSidebarUser(role, user);

    // Load everything in parallel — non-blocking so login feels instant
    loadNotifications().catch(() => {});

    // Init the role dashboard (loads data, renders stats)
    try {
        if (role === 'employee')      await initEmployeeDashboard(user);
        else if (role === 'manager')  await initManagerDashboard(user);
        else if (role === 'hr')       await initHRDashboard(user);
        else if (role === 'admin')    await initAdminDashboard(user);
    } catch(e) { console.warn('Dashboard init error:', e.message); }

    // Update landing page counter in background (non-blocking)
    api('GET', '/users').then(r => {
        if (r?.data) {
            allUsers = r.data;
            const el = document.getElementById('counterUsers');
            if (el) el.textContent = r.data.length;
        }
    }).catch(() => {});
}

function updateSidebarUser(role, user) {
    const avatarMap = { employee:'empSidebarAvatar', manager:'mgrSidebarAvatar', hr:'hrSidebarAvatar', admin:'adminSidebarAvatar' };
    const nameMap   = { employee:'empSidebarName',   manager:'mgrSidebarName',   hr:'hrSidebarName',   admin:'adminSidebarName'   };
    const roleMap   = { employee:'empSidebarRole',   manager:'mgrSidebarRole',   hr:'hrSidebarRole',   admin:'adminSidebarRole'   };
    const av = document.getElementById(avatarMap[role]);
    const nm = document.getElementById(nameMap[role]);
    const rl = document.getElementById(roleMap[role]);
    if (av) av.textContent = user.avatarInitials || user.name.substring(0,2).toUpperCase();
    if (nm) nm.textContent = user.name;
    if (rl) rl.textContent = role.charAt(0).toUpperCase() + role.slice(1);
}

async function logout() {
    if (currentUser) {
        const sessionStart  = localStorage.getItem('spms_session_start');
        const sessionUserId = localStorage.getItem('spms_session_user');
        let durationHours   = 0;
        if (sessionStart && sessionUserId && parseInt(sessionUserId) === currentUser.id) {
            const durationMs = Date.now() - new Date(sessionStart).getTime();
            durationHours    = parseFloat((durationMs / 3600000).toFixed(2));
            const today      = new Date().toISOString().split('T')[0];
            try {
                await api('PUT', `/users/${currentUser.id}/activity`, {
                    activityDate: today,
                    hoursWorked:  durationHours,
                    action:       'logout'
                });
            } catch { /* endpoint may not exist — logout still tracked by /auth/logout */ }
        }
        localStorage.removeItem('spms_session_start');
        localStorage.removeItem('spms_session_user');
        try {
            await api('POST', '/auth/logout', {
                userId:      currentUser.id,
                hoursWorked: durationHours
            });
        } catch {}
    }
    currentUser = null;
    allUsers = []; allProjects = []; allDepartments = [];
    document.querySelectorAll('.dashboard').forEach(d => d.classList.add('hidden'));
    document.getElementById('landingPage').classList.remove('hidden');
    destroyAllCharts();
    showToast('Logged out successfully 👋');
}

function destroyAllCharts() {
    Object.values(charts).forEach(c => { try { c.destroy(); } catch {} });
    charts = {};
}

// ── View Navigation ──────────────────────────────────────────
function showView(role, view, element) {
    const dashMap = { employee:'employeeDashboard', manager:'managerDashboard', hr:'hrDashboard', admin:'adminDashboard' };
    const dash = document.getElementById(dashMap[role]);
    if (!dash) return;
    dash.querySelectorAll('.view-content').forEach(v => v.classList.add('hidden'));
    const viewEl = document.getElementById(`${role}-${view}`);
    if (viewEl) viewEl.classList.remove('hidden');
    dash.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('active'));
    if (element) element.classList.add('active');
    const viewTitles = { overview:'Overview', projects:'Projects', workload:'Workload', performance:'Performance', profile:'Profile', assignment:'Assignment', employee:'Employees', analytics:'Analytics', reports:'Project Reports', users:'User Management', audit:'Audit Log', health:'System Health', settings:'Settings' };
    const bcMap = { employee:'currentView', manager:'managerView', hr:'hrView', admin:'adminView' };
    const bc = document.getElementById(bcMap[role]);
    if (bc) bc.textContent = viewTitles[view] || view;
    if (role === 'employee' && view === 'projects')     renderEmployeeProjects();
    else if (role === 'employee' && view === 'performance') initPerformanceCharts();
    else if (role === 'employee' && view === 'profile')  renderEmployeeProfile(currentUser);
    else if (role === 'manager' && view === 'overview') initManagerOverview();
    else if (role === 'manager' && view === 'workload') renderManagerWorkload();
    else if (role === 'manager' && view === 'reports')  renderManagerReports();
    else if (role === 'manager' && view === 'projects') renderManagerProjects();
    else if (role === 'manager' && view === 'profile')  renderManagerProfile();
    else if (role === 'hr' && view === 'assignment')    renderAssignmentProjects();
    else if (role === 'hr' && view === 'employee')      renderEmployeeTracking();
    else if (role === 'hr' && view === 'projects')      renderHRProjects();
    else if (role === 'hr' && view === 'profile')       renderHRProfile();
    else if (role === 'admin' && view === 'users')      renderUserManagement();
    else if (role === 'admin' && view === 'projects')   renderAdminProjects();
    else if (role === 'admin' && view === 'audit')      renderAuditLog();
    else if (role === 'admin' && view === 'health')     renderSystemHealth();
    else if (role === 'admin' && view === 'settings')   loadAdminSettings();
    else if (role === 'admin' && view === 'profile')    renderAdminProfile();
}

// ── Utility Helpers ──────────────────────────────────────────
function daysUntil(dateStr) { return Math.ceil((new Date(dateStr) - new Date()) / 86400000); }

/** Parse skills from any format the backend might return */
function parseSkills(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed.startsWith('[')) {
            try { return JSON.parse(trimmed).filter(Boolean); } catch {}
        }
        // comma-separated plain string
        return trimmed.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
}
function parseUTCDate(ts) {
    if (!ts) return null;
    // Spring Boot's LocalDateTime serialises as "2026-03-14T10:30:00" — no Z/offset.
    // JS treats bare ISO strings as LOCAL time, so IST users see times 5:30h behind.
    // Append 'Z' to force UTC interpretation; JS then converts to the user's local time.
    const s = String(ts);
    const normalised = (s.includes('Z') || s.includes('+') || s.includes('-', 10))
        ? s          // already has timezone info — leave alone
        : s + 'Z';   // no timezone → treat as UTC
    const d = new Date(normalised);
    return isNaN(d) ? null : d;
}

function formatTime(ts) {
    if (!ts) return '';
    const d = parseUTCDate(ts);
    if (!d) return String(ts);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 0)     return 'just now';          // clock skew edge case
    if (diff < 60)    return 'just now';
    if (diff < 3600)  return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    if (diff < 604800)return `${Math.floor(diff / 86400)} days ago`;
    // Older than a week — show full localised date + time
    return d.toLocaleString(undefined, { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function initials(name) { return (name||'').split(' ').map(w=>w[0]||'').join('').substring(0,3).toUpperCase(); }

// ── Project Card HTML ────────────────────────────────────────
function projectCard(p, role) {
    const sc = { active:'success', completed:'info', delayed:'danger', unassigned:'warning' };
    const pc = { critical:'danger', high:'warning', medium:'info', low:'success' };
    const days = daysUntil(p.deadline);
    const daysText = days < 0
        ? `<span style="color:var(--danger)">Overdue by ${Math.abs(days)}d</span>`
        : days === 0 ? `<span style="color:var(--warning)">Due Today</span>`
        : `${days} days left`;
    const team = p.team || [];
    return `<div class="project-card" onclick="openProjectDetail(${p.id},'${role}')">
        <div class="project-card-header">
            <div class="project-code">${p.code}</div>
            <span class="badge badge-${sc[p.status]||'info'}">${p.status}</span>
        </div>
        <h3 class="project-name">${p.name}</h3>
        <div class="project-meta">
            <span class="badge badge-${pc[p.priority]||'info'}">${p.priority}</span>
            <span class="badge badge-warning">${p.urgency} urgency</span>
        </div>
        <div class="progress-section">
            <div class="progress-header"><span>Progress</span><span>${p.progress}%</span></div>
            <div class="progress-bar"><div class="progress-fill" style="width:${p.progress}%"></div></div>
        </div>
        <div class="project-footer">
            <div class="project-deadline">📅 ${daysText}</div>
            <div class="project-team">${team.slice(0,3).map(m=>`<div class="team-avatar-sm" title="${m.name}">${initials(m.name)}</div>`).join('')}${team.length>3?`<div class="team-avatar-sm">+${team.length-3}</div>`:''}</div>
        </div>
    </div>`;
}

// ============================================================
//  EMPLOYEE DASHBOARD
// ============================================================
async function initEmployeeDashboard(user) {
    const setEl = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
    setEl('empName',       user.name);
    setEl('empSidebarName',user.name);
    setEl('empSidebarRole',user.role ? (user.role[0].toUpperCase()+user.role.slice(1)) : 'Employee');
    const av = document.getElementById('empSidebarAvatar');
    if (av) av.textContent = user.avatarInitials||user.avatar_initials||initials(user.name);

    // Load projects + departments
    try {
        const [projRes, deptRes] = await Promise.all([
            api('GET', '/projects', { userId: user.id }),
            api('GET', '/departments')
        ]);
        allProjects    = projRes.data  || [];
        allDepartments = deptRes.data  || [];
    } catch (e) {
        showToast('Failed to load dashboard data. Check backend.', 'error');
    }

    // ── Fetch daily activities for this year (used for stats + performance charts) ──
    try {
        const actRes = await api('GET', '/performance', { userId: user.id, year: new Date().getFullYear() });
        currentEmployeeActivities = actRes.data?.activities || [];
    } catch(e) { currentEmployeeActivities = []; }

    // ── Compute current-month stats from daily_activities ──
    const now        = new Date();
    const thisMonth  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const monthActs  = currentEmployeeActivities.filter(a =>
        (a.activityDate||a.activity_date||'').startsWith(thisMonth)
    );
    // If no current-month data, fall back to the most recent available month
    const actsToUse  = monthActs.length > 0 ? monthActs : currentEmployeeActivities.slice(0, 20);
    const computedTasks  = actsToUse.reduce((s,a)=>s+(parseInt(a.tasksDone||a.tasks_done)||0),0);
    const computedHours  = Math.round(actsToUse.reduce((s,a)=>s+(parseFloat(a.hoursWorked||a.hours_worked)||0),0));
    // Only count pending reviews from actual unread notifications, never use a fallback number
    const pendingReviews = notificationsList.filter(n=>n.type==='review'&&!n.is_read).length;

    // ── Try backend stats — handle BOTH camelCase and snake_case field names ──
    // (Jackson SNAKE_CASE strategy: activeProjects→active_projects, tasksCompleted→tasks_completed)
    let backendStats = {};
    try {
        const sr = await api('GET', '/dashboard/stats', { userId: user.id, role: 'employee' });
        backendStats = sr?.data || {};
    } catch(e) {}

    // Read both snake_case (actual JSON from backend) and camelCase (fallback)
    const bActive  = backendStats.active_projects  ?? backendStats.activeProjects;
    const bTasks   = backendStats.tasks_completed  ?? backendStats.tasksCompleted;
    const bPending = backendStats.pending_reviews  ?? backendStats.pendingReviews;
    const bHours   = backendStats.hours_this_month ?? backendStats.hoursThisMonth;

    empDashStats = {
        activeProjects:  bActive  ?? allProjects.filter(p=>p.status==='active').length,
        tasksCompleted:  (bTasks  != null && bTasks  > 0) ? bTasks  : computedTasks,
        pendingReviews:  (bPending!= null && bPending> 0) ? bPending: pendingReviews,
        hoursThisMonth:  (bHours  != null && bHours  > 0) ? bHours  : computedHours,
        monthActivities: monthActs.length > 0 ? monthActs : actsToUse,
        allActivities:   currentEmployeeActivities,
        hasActivityData: currentEmployeeActivities.length > 0
    };

    renderEmployeeOverview(user, allProjects, empDashStats);
    renderEmployeeProfile(user);
    renderEmployeeProjects();

    // ── Record employee login session start in DB ──
    await recordEmployeeSessionStart(user);
}

// ── Track employee login session start time ──
async function recordEmployeeSessionStart(user) {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const loginTime = new Date().toISOString();
    // Store session start in localStorage for duration calculation on logout
    localStorage.setItem('spms_session_start', loginTime);
    localStorage.setItem('spms_session_user', user.id);
    // Record in project_history as an activity entry (login event)
    try {
        await api('POST', '/activities', {
            userId: user.id,
            personName: user.name,
            action: `${user.name} started session on ${today}`,
            activityDate: today,
            type: 'login'
        });
    } catch {
        // Activity recording endpoint may not exist — login is still tracked
        // via users.last_login updated by /auth/login in the backend
    }
}

function renderEmployeeOverview(user, projects, stats) {
    const active   = stats.activeProjects  ?? projects.filter(p=>p.status==='active').length;
    const tasks    = stats.tasksCompleted  ?? 0;
    const pending  = stats.pendingReviews  ?? 0;
    const hours    = stats.hoursThisMonth  ?? 0;
    const el = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
    el('emp-stat-active', active);
    el('emp-stat-tasks',  tasks);
    el('emp-stat-pending',pending);
    el('emp-stat-hours',  hours);
    renderUpcomingDeadlines(projects.filter(p=>p.status==='active'));
    renderRecentActivitiesFromDB();
}

function renderUpcomingDeadlines(projects) {
    const container = document.getElementById('upcomingDeadlines');
    if (!container) return;
    const sorted = [...projects].sort((a,b)=>new Date(a.deadline)-new Date(b.deadline)).slice(0,5);
    container.innerHTML = sorted.map(p => {
        const days = daysUntil(p.deadline);
        const urgency = days < 3 ? 'danger' : days < 7 ? 'warning' : 'success';
        return `<div class="deadline-item"><div class="deadline-info"><div class="deadline-name">${p.name}</div><div class="deadline-date">Due: ${p.deadline}</div></div><div class="deadline-badge badge-${urgency}">${days<0?'Overdue':days===0?'Today':`${days}d`}</div></div>`;
    }).join('') || '<p style="color:var(--text-secondary);padding:1rem">No upcoming deadlines</p>';
}

async function renderRecentActivitiesFromDB() {
    const container = document.getElementById('recentActivities');
    if (!container || !currentUser) return;

    container.innerHTML = '<div class="loading-state" style="padding:1rem"><div class="spinner" style="width:20px;height:20px;margin:0 auto"></div></div>';

    try {
        // The backend /activities?userId=X has a known bug: it uses userId as projectId.
        // We exploit this to our advantage: fetch history for each of the user's projects.
        // allProjects contains projects assigned to this user (loaded earlier in initEmployeeDashboard).
        let acts = [];

        if (allProjects.length > 0) {
            // Fetch history for each project the user is on (using the backend bug as a feature)
            const projectHistories = await Promise.all(
                allProjects.map(p =>
                    api('GET', '/activities', { userId: p.id, limit: 20 })
                        .then(r => r.data || [])
                        .catch(() => [])
                )
            );
            // Flatten and deduplicate by id
            const seen = new Set();
            projectHistories.flat().forEach(a => {
                const key = a.id || `${a.project_id}-${a.action}`;
                if (!seen.has(key)) { seen.add(key); acts.push(a); }
            });
        } else {
            // New user with no projects — show empty state, do NOT fetch all activities
            container.innerHTML = '<p style="color:var(--text-secondary);padding:1rem 0">No recent activities yet — you\'ll see updates here once you\'re assigned to a project.</p>';
            return;
        }

        // Sort newest-first, take top 8
        acts.sort((a,b) => new Date(b.created_at||b.createdAt||0) - new Date(a.created_at||a.createdAt||0));
        acts = acts.slice(0, 8);

        if (!acts.length) {
            container.innerHTML = '<p style="color:var(--text-secondary);padding:1rem 0">No recent activities yet</p>';
            return;
        }

        const iconFor = (action='') =>
              /upload/i.test(action)            ? '📤'
            : /commit|push|merge/i.test(action) ? '💻'
            : /review|PR/i.test(action)         ? '🔍'
            : /deploy/i.test(action)            ? '🚀'
            : /progress|update/i.test(action)   ? '🔄'
            : /sprint|plan|assign/i.test(action)? '📅'
            : /config|setup|install/i.test(action)? '⚙️' : '📋';

        container.innerHTML = acts.map(a => `
            <div class="timeline-item">
                <div class="timeline-icon">${iconFor(a.action)}</div>
                <div class="timeline-content">
                    <div class="timeline-action">${a.action || ''}</div>
                    <div class="timeline-time">${a.person_name||a.personName||''} · ${formatTime(a.created_at||a.createdAt)}</div>
                </div>
            </div>`).join('');
    } catch(e) {
        container.innerHTML = '<p style="color:var(--text-secondary)">Could not load activities</p>';
    }
}

function renderEmployeeProfile(user) {
    const u = user || currentUser;
    if (!u) return;
    const el = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
    const roleLabel = u.role ? (u.role.charAt(0).toUpperCase()+u.role.slice(1)) : 'Employee';
    // Profile card (left column)
    el('profileName',     u.name);
    el('profileId',       u.employeeId || u.employee_id || '');
    el('profileDept',     u.departmentName || u.department_name || '');
    // Personal information grid (right column)
    el('profileNameInfo', u.name);
    el('profileId2',      u.employeeId || u.employee_id || '');
    el('profileDeptInfo', u.departmentName || u.department_name || '');
    el('profileEmail',    u.email || '');
    el('profileJoinDate', u.joinDate || u.join_date || '');
    el('profileRole',     roleLabel);
    el('profileRoleInfo', roleLabel);
    const av = document.getElementById('profileAvatar');
    if (av) av.textContent = u.avatarInitials || u.avatar_initials || initials(u.name);
    // Profile stat cards — only show real data; display N/A for brand-new users
    const hasActivity = (currentEmployeeActivities && currentEmployeeActivities.length > 0)
        || allProjects.some(p => p.assignedUsers && p.assignedUsers.some(a => a.id == u.id || a.userId == u.id));
    const pa = document.getElementById('profilePerformance');
    const pp = document.getElementById('profileProjects');
    const pt = document.getElementById('profileTasks');
    if (pa) pa.textContent = hasActivity ? (u.performanceScore || u.performance_score || 0) + '%' : 'N/A';
    if (pp) pp.textContent = u.projectCount || allProjects.filter(p=>p.status==='active').length || 0;
    if (pt) pt.textContent = u.tasksCompleted || u.tasks_completed || 0;
    // Skills
    const sc = document.getElementById('profileSkills');
    if (sc) {
        let skills = u.skills;
        skills = parseSkills(skills);
        const colors = ['primary','success','warning','info','secondary'];
        sc.innerHTML = (skills||[]).map((s,i)=>`<span class="skill-tag skill-tag-${colors[i%colors.length]}">${s}</span>`).join('') || '<span style="color:var(--text-secondary)">No skills listed</span>';
    }
}

function renderEmployeeProjects() {
    const container = document.getElementById('empProjectsGrid');
    if (!container) return;
    let filtered = [...allProjects];
    const search  = document.getElementById('empProjectSearch')?.value?.toLowerCase() || '';
    const sortBy  = document.getElementById('empProjectSort')?.value  || 'name';
    const urgency = document.getElementById('empProjectUrgency')?.value || 'all';
    const status  = document.getElementById('empProjectStatus')?.value  || 'all';
    if (search)         filtered = filtered.filter(p=>p.name.toLowerCase().includes(search)||p.code.toLowerCase().includes(search));
    if (urgency!=='all')filtered = filtered.filter(p=>p.urgency===urgency);
    if (status!=='all') filtered = filtered.filter(p=>p.status===status);
    filtered.sort((a,b)=>{
        if (sortBy==='name')     return a.name.localeCompare(b.name);
        if (sortBy==='deadline') return new Date(a.deadline)-new Date(b.deadline);
        if (sortBy==='progress') return b.progress-a.progress;
        if (sortBy==='urgency')  { const u={high:3,medium:2,low:1}; return (u[b.urgency]||0)-(u[a.urgency]||0); }
        return 0;
    });
    if (!filtered.length) { container.innerHTML = '<div class="empty-state"><div class="empty-icon">📁</div><p>No projects found</p></div>'; return; }
    container.innerHTML = filtered.map(p=>projectCard(p,'employee')).join('');
}

// ── Project Detail Modal ─────────────────────────────────────
async function openProjectDetail(id, role) {
    const modal   = document.getElementById('projectDetailModal');
    const title   = document.getElementById('projectDetailTitle');
    const content = document.getElementById('projectDetailContent');
    if (!modal || !content) return;
    title.textContent = 'Loading…';
    content.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading project details…</p></div>';
    modal.classList.add('active');
    try {
        const res = await api('GET', `/projects/${id}`);
        const p   = res.data;
        if (!p) throw new Error('Project not found');
        title.textContent = `${p.code} — ${p.name}`;
        const days   = daysUntil(p.deadline);
        const team   = p.team   || [];
        const files  = p.files  || [];
        const comments = p.comments || [];
        const history  = p.history  || [];
        const canUpload  = role === 'employee';
        const canComment = role === 'hr' || role === 'manager';
        content.innerHTML = `
        <div class="project-detail-grid">
            <div class="project-detail-main">
                <div class="detail-section">
                    <h4>📊 Progress</h4>
                    <div class="progress-bar-large"><div class="progress-fill" style="width:${p.progress}%"></div></div>
                    <div style="display:flex;justify-content:space-between;margin-top:0.5rem;font-size:0.875rem;color:var(--text-secondary)">
                        <span>${p.progress}% Complete</span>
                        <span>Due: ${p.deadline} (${days<0?'Overdue':days+' days'})</span>
                    </div>
                    ${canUpload ? `<div style="margin-top:1rem;display:flex;gap:0.5rem;align-items:center">
                        <input type="range" id="progressSlider" min="0" max="100" value="${p.progress}" style="flex:1">
                        <button class="btn btn-sm btn-primary" onclick="updateProjectProgress(${p.id})">Update</button>
                    </div>` : ''}
                </div>
                <div class="detail-section">
                    <h4>👥 Team Members</h4>
                    ${team.length ? team.map(m=>`
                        <div class="team-member-row">
                            <div class="team-member-avatar">${initials(m.name)}</div>
                            <div class="team-member-info"><div class="team-member-name">${m.name}</div><div class="team-member-role">${m.roleInProject||m.role_in_project}</div></div>
                            <div class="team-member-stats"><span>💻 ${m.commits||0} commits</span><span>⏱ ${m.hoursContributed||m.hours_contributed||0}h</span></div>
                        </div>`).join('') : '<p style="color:var(--text-secondary)">No team members assigned</p>'}
                </div>
                ${canUpload ? `<div class="detail-section">
                    <h4>📤 Upload File</h4>
                    <div class="upload-zone" id="uploadZone${p.id}" ondragover="event.preventDefault()" ondrop="handleFileDrop(event,${p.id})" onclick="document.getElementById('fileInput${p.id}').click()">
                        <div class="upload-icon">📁</div>
                        <div class="upload-text">Drag & drop files or <span class="upload-link">browse</span></div>
                        <div class="upload-hint">Supports all file types up to 50MB</div>
                        <input type="file" id="fileInput${p.id}" style="display:none" onchange="handleFileSelect(event,${p.id})" multiple>
                    </div>
                </div>` : ''}
                <div class="detail-section" id="filesSection${p.id}">
                    <h4>📎 Uploaded Files (${files.length})</h4>
                    ${renderFilesList(files, p.id, role)}
                </div>
            </div>
            <div class="project-detail-sidebar">
                <div class="detail-section">
                    <h4>📋 Activity Timeline</h4>
                    <div class="timeline-compact">
                        ${history.map(h=>`<div class="timeline-item-sm"><div class="timeline-dot"></div><div><div class="timeline-action-sm">${h.action}</div><div class="timeline-meta-sm">${h.personName||h.person_name||''} • ${formatTime(h.createdAt||h.created_at)}</div></div></div>`).join('') || '<p style="color:var(--text-secondary);font-size:0.85rem">No activity yet</p>'}
                    </div>
                </div>
                <div class="detail-section">
                    <h4>💬 Comments & Instructions</h4>
                    <div id="commentsList${p.id}">
                        ${comments.map(c => {
                            const isOwn = currentUser && (c.authorId == currentUser.id || c.author_id == currentUser.id || c.authorName === currentUser.name || c.author_name === currentUser.name);
                            // Admin can delete anyone's comment; everyone else only their own
                            const canDelComment = role === 'admin' || isOwn;
                            return `<div class="comment-item" id="cmt-${c.id}">
                                <div class="comment-author">${c.authorName||c.author_name||'User'} <span class="comment-role">(${c.authorRole||c.author_role||''})</span></div>
                                <div class="comment-text">${c.commentText||c.comment_text}</div>
                                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.35rem">
                                    <div style="display:flex;gap:0.4rem;align-items:center">
                                        <div class="comment-time">${formatTime(c.createdAt||c.created_at)}</div>
                                        <button class="btn btn-sm btn-secondary" style="padding:0.15rem 0.45rem;font-size:0.7rem" onclick="toggleReplyBox(${c.id})">↩ Reply</button>
                                    </div>
                                    ${canDelComment ? `<button class="btn btn-sm btn-danger" style="padding:0.2rem 0.5rem;font-size:0.72rem;line-height:1" onclick="deleteProjectComment(${c.id},${p.id},'${role}')">🗑️ Delete</button>` : ''}
                                </div>
                                <div id="reply-box-${c.id}" style="display:none;flex-direction:column;gap:0.4rem;margin-top:0.5rem;padding:0.5rem;background:var(--bg-secondary);border-radius:6px">
                                    <textarea id="reply-input-${c.id}" rows="2" style="resize:none;background:var(--bg-card,var(--bg-primary));border:1px solid var(--border);border-radius:6px;padding:0.4rem;color:var(--text-primary);font-size:0.8rem" placeholder="Write your reply…"></textarea>
                                    <button class="btn btn-sm btn-primary" style="align-self:flex-end" onclick="replyToComment(${c.id},${p.id},'${role}')">Post Reply</button>
                                </div>
                            </div>`;
                        }).join('') || '<p style="color:var(--text-secondary);font-size:0.85rem">No comments yet</p>'}
                    </div>
                    ${canComment ? `<div class="comment-form"><textarea id="commentInput${p.id}" placeholder="Add a comment or instruction…" rows="3"></textarea><button class="btn btn-sm btn-primary" onclick="addProjectComment(${p.id},'${role}')">Post Comment</button></div>` : ''}
                </div>
            </div>
        </div>`;
    } catch (e) {
        content.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>Failed to load project: ${e.message}</p></div>`;
    }
}

function renderFilesList(files, projectId, role) {
    if (!files.length) return '<p style="color:var(--text-secondary)">No files uploaded yet</p>';
    // Employees who are on the project can delete any file
    const canDelete = (role === 'employee') || (currentUser && currentUser.role === 'employee');
    return files.map(f => {
        // Escape filename for inline onclick attribute
        const safeName = (f.filename || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        const deleteBtn = canDelete
            ? `<button class="btn btn-sm btn-danger"
                       style="margin-left:0.35rem;background:rgba(239,68,68,0.15);color:#EF4444;border:1px solid rgba(239,68,68,0.3)"
                       onclick="deleteProjectFile(${f.id},'${safeName}',${projectId},'${role || 'employee'}')"
                       title="Remove this file">🗑️</button>`
            : '';
        return `
        <div class="file-item" id="file-item-${f.id}">
            <div class="file-icon">📄</div>
            <div class="file-info">
                <div class="file-name">${f.filename}</div>
                <div class="file-meta">By ${f.uploaderName||f.uploader_name||'Unknown'} • ${formatTime(f.uploadDate||f.upload_date)} • ${f.filesize||''}</div>
            </div>
            <div style="display:flex;align-items:center;gap:0.25rem;flex-shrink:0">
                <button class="btn btn-sm btn-secondary" onclick="downloadFile(${f.id},'${safeName}')">⬇ Download</button>
                ${deleteBtn}
            </div>
        </div>`;
    }).join('');
}

async function updateProjectProgress(projectId) {
    const slider = document.getElementById('progressSlider');
    if (!slider) return;
    const progress = parseInt(slider.value);
    try {
        await api('PUT', `/projects/${projectId}/progress`, { progress, note: `Progress updated to ${progress}%`, userId: currentUser?.id });
        showToast(`Progress updated to ${progress}% ✓`);
        // Refresh project in cache
        const idx = allProjects.findIndex(p=>p.id===projectId);
        if (idx !== -1) allProjects[idx].progress = progress;
        renderEmployeeProjects();
        // Record employee commit/progress activity in DB
        if (currentUser?.role === 'employee') {
            await recordEmployeeAction('commit', `Updated project progress to ${progress}%`);
        }
        await openProjectDetail(projectId, 'employee');
    } catch (e) {
        showToast(`Failed to update progress: ${e.message}`, 'error');
    }
}

// ── Record employee action (commit, upload, task) in daily_activities / audit_log ──
async function recordEmployeeAction(actionType, actionDescription) {
    if (!currentUser) return;
    const today = new Date().toISOString().split('T')[0];
    // Try project history endpoint first (exists in API)
    try {
        await api('POST', '/activities', {
            userId: currentUser.id,
            personName: currentUser.name,
            action: actionDescription,
            activityDate: today,
            type: actionType
        });
    } catch {
        // Fallback: the action is still recorded via the specific API call (upload/progress/comment)
        // which triggers project_history INSERTs in the backend
    }
}

// ── Record HR action (login, assignment, comment, download) in DB ──
async function recordHRAction(actionType, actionDescription, projectId) {
    if (!currentUser) return;
    const today = new Date().toISOString().split('T')[0];
    try {
        const payload = {
            userId:       currentUser.id,
            personName:   currentUser.name,
            action:       actionDescription,
            activityDate: today,
            type:         actionType
        };
        if (projectId) payload.projectId = projectId;
        await api('POST', '/activities', payload);
    } catch { /* audit_log trigger in DB handles the persistence */ }
}

async function handleFileSelect(event, projectId) {
    for (const file of event.target.files) await uploadProjectFile(projectId, file);
}
function handleFileDrop(event, projectId) {
    event.preventDefault();
    for (const file of event.dataTransfer.files) uploadProjectFile(projectId, file);
}
async function uploadProjectFile(projectId, file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);
    formData.append('uploaderId', currentUser?.id || 1);
    try {
        await apiUpload('/files/upload', formData);
        showToast(`${file.name} uploaded successfully 📤`);
        // Record employee upload activity
        if (currentUser?.role === 'employee') {
            await recordEmployeeAction('upload', `Uploaded ${file.name} to project`);
        }
        await openProjectDetail(projectId, currentUser?.role || 'employee');
    } catch (e) {
        showToast(`Upload failed: ${e.message}`, 'error');
    }
}

async function downloadFile(fileId, filename) {
    try {
        showToast(`Preparing ${filename}… ⬇️`);
        const response = await fetch(`${API}/files/${fileId}/download`, { method: 'GET' });
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        const blob = await response.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        showToast(`${filename} downloaded ✓`);
        // Record download activity per role
        if (currentUser?.role === 'hr') {
            await recordHRAction('download', `Downloaded file: ${filename}`);
        } else if (currentUser?.role === 'employee') {
            await recordEmployeeAction('download', `Downloaded file: ${filename}`);
        } else if (currentUser?.role === 'manager') {
            await recordManagerDailyLogin(currentUser);
        }
    } catch(e) {
        showToast(`Download failed: ${e.message}`, 'error');
    }
}

async function deleteProjectFile(fileId, filename, projectId, role) {
    if (!confirm(`Remove "${filename}" from this project? This cannot be undone.`)) return;
    // Optimistically hide the row immediately so UI feels instant
    const row = document.getElementById(`file-item-${fileId}`);
    if (row) row.style.opacity = '0.4';
    try {
        await api('DELETE', `/files/${fileId}`, {
            deleterId:   currentUser?.id,
            deleterName: currentUser?.name,
            projectId:   projectId
        });
        showToast(`"${filename}" removed ✓`);
        // Record deletion in project history / activity log
        if (currentUser?.role === 'employee') {
            await recordEmployeeAction('delete', `Deleted file "${filename}" from project`);
        } else if (currentUser?.role === 'manager') {
            await recordManagerDailyLogin(currentUser);
        }
        // Refresh the project detail panel so file count and timeline update
        await openProjectDetail(projectId, role || currentUser?.role || 'employee');
    } catch (e) {
        if (row) row.style.opacity = '1';
        showToast(`Failed to remove file: ${e.message}`, 'error');
    }
}

async function addProjectComment(projectId, role) {
    const input = document.getElementById(`commentInput${projectId}`);
    if (!input || !input.value.trim()) { showToast('Please enter a comment', 'error'); return; }
    const comment = input.value.trim();
    const roleLabel = role === 'hr' ? 'HR Manager' : role === 'manager' ? 'Manager' : 'Employee';
    try {
        await api('POST', '/comments', {
            projectId,
            authorId:   currentUser?.id || 1,
            authorName: currentUser?.name || 'User',
            authorRole: roleLabel,
            commentText: comment
        });
        input.value = '';
        showToast('Comment added ✓');
        // Record activity in DB per role
        if (currentUser?.role === 'manager') {
            await recordManagerDailyLogin(currentUser);
        } else if (currentUser?.role === 'employee') {
            await recordEmployeeAction('comment', `Commented on project`);
        } else if (currentUser?.role === 'hr') {
            // HR comment — log and notify the project's team (backend /comments endpoint
            // already sends notifications to all team members via NotificationService)
            await recordHRAction('comment', `HR commented on project ${projectId}`, projectId);
        }
        await openProjectDetail(projectId, role);
    } catch (e) {
        showToast(`Failed to add comment: ${e.message}`, 'error');
    }
}

// ── Delete a comment (manager/HR can delete their own comments) + log action ──
async function deleteProjectComment(commentId, projectId, role) {
    if (!confirm('Delete this comment? This cannot be undone.')) return;
    const row = document.getElementById(`cmt-${commentId}`);
    if (row) row.style.opacity = '0.4';
    try {
        // Based on build manual, the only comment endpoint is POST /api/comments
        // DELETE is not documented - try /comments/{id} as the most likely path
        await api('DELETE', `/comments/${commentId}`)
            .catch(() => api('DELETE', `/projects/${projectId}/comments/${commentId}`));
        showToast('Comment deleted ✓');
        await openProjectDetail(projectId, role);
    } catch(e) {
        if (row) row.style.opacity = '1';
        showToast(`Failed to delete comment: ${e.message}`, 'error');
    }
}

function initPerformanceCharts() {
    updatePerformanceChart();
}
async function updatePerformanceChart() {
    const year  = document.getElementById('perfYear')?.value  || new Date().getFullYear();
    const month = document.getElementById('perfMonth')?.value || 'all';
    try {
        const res  = await api('GET', '/performance', { userId: currentUser?.id, year, month });
        const data = res.data || {};
        const activities   = data.activities || [];
        const labels  = activities.map(a=>a.activityDate?.slice(5)||a.activity_date?.slice(5)||'');
        const hours   = activities.map(a=>parseFloat(a.hoursWorked||a.hours_worked)||0);
        const commits = activities.map(a=>parseInt(a.commits)||0);
        const tasks   = activities.map(a=>parseInt(a.tasksDone||a.tasks_done)||0);
        const totalCommits  = data.totalCommits  ?? commits.reduce((s,c)=>s+c,0);
        const totalTasks    = data.totalTasks    ?? tasks.reduce((s,t)=>s+t,0);
        const avgHrs        = data.avgHoursPerDay?? (hours.length ? (hours.reduce((s,h)=>s+h,0)/hours.length).toFixed(1) : 0);
        // Productivity: only compute if user has real commit data; 0 for brand-new users
        const hasRealData   = totalCommits > 0 || totalTasks > 0 || parseFloat(avgHrs) > 0;
        const productivity  = data.productivityScore ?? (hasRealData ? Math.min(100, Math.round(totalCommits/Math.max(1,hours.length)*8+70)) : 0);
        const setEl = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
        setEl('totalCommits',     totalCommits);
        setEl('avgHours',         avgHrs);
        setEl('productivityScore',productivity);

        // ── Join date + year summary in page header ──
        const joinDate = currentUser?.joinDate||currentUser?.join_date;
        const perfInfo = document.getElementById('perfJoinInfo');
        if (perfInfo) {
            const joined = joinDate ? `📅 Member since ${joinDate}` : '';
            perfInfo.textContent = `${joined}${joined ? '  ·  ' : ''}${totalTasks} tasks completed · ${totalCommits} commits in ${year}`;
        }

        if (charts.hoursChart) charts.hoursChart.destroy();
        const hoursCtx = document.getElementById('hoursChart')?.getContext('2d');
        if (hoursCtx) charts.hoursChart = new Chart(hoursCtx, {
            type:'bar',
            data:{ labels, datasets:[{ label:'Hours Worked', data:hours, backgroundColor:'rgba(99,102,241,0.7)', borderRadius:4 }] },
            options:{ responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true,max:12}} }
        });
        if (charts.commitsChart) charts.commitsChart.destroy();
        const commCtx = document.getElementById('commitsChart')?.getContext('2d');
        if (commCtx) charts.commitsChart = new Chart(commCtx, {
            type:'line',
            data:{ labels, datasets:[
                { label:'Commits',    data:commits, borderColor:'#10B981', backgroundColor:'rgba(16,185,129,0.1)', fill:true, tension:0.4 },
                { label:'Tasks Done', data:tasks,   borderColor:'#F59E0B', backgroundColor:'rgba(245,158,11,0.1)',  fill:true, tension:0.4 }
            ]},
            options:{ responsive:true }
        });
    } catch(e) {
        showToast('Failed to load performance data', 'error');
    }
}

// ============================================================
//  MANAGER DASHBOARD
// ============================================================
async function initManagerDashboard(user) {
    document.getElementById('mgrName').textContent = user.name || 'Manager';
    try {
        const [projRes, userRes, deptRes] = await Promise.all([
            api('GET', '/projects'),
            api('GET', '/users', { managerId: user.id }),
            api('GET', '/departments')
        ]);
        allProjects    = projRes.data  || [];
        allUsers       = userRes.data  || [];
        allDepartments = deptRes.data  || [];
    } catch (e) {
        showToast('Failed to load manager data', 'error');
    }
    // Populate workload department filter from DB (removes hardcoded options)
    populateDeptFilter('workloadDept', allDepartments);
    // Record manager daily login activity in DB
    await recordManagerDailyLogin(user);
    await initManagerOverview();
}

// ── Populate a department <select> from allDepartments (removes hardcoded options) ──
function populateDeptFilter(selectId, departments, useAllLabel) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const currentVal = select.value;
    const allOpt = useAllLabel ? 'All' : 'All Depts';
    select.innerHTML = `<option value="all">${allOpt}</option>`;
    (departments || []).forEach(d => {
        const name = d.name || d;
        if (!name) return;
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
    });
    if ([...select.options].some(o => o.value === currentVal)) {
        select.value = currentVal;
    }
}

// ── Record manager login + daily routine in audit_log and daily_activities ──
async function recordManagerDailyLogin(user) {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    // Store session start in localStorage for logout duration calculation
    if (!localStorage.getItem('spms_session_start')) {
        localStorage.setItem('spms_session_start', new Date().toISOString());
        localStorage.setItem('spms_session_user',  String(user.id));
    }
    try {
        await api('POST', '/activities', {
            userId: user.id,
            personName: user.name,
            action: `Manager ${user.name} logged into the portal`,
            activityDate: today,
            type: 'login'
        });
    } catch {
        // Silently fail — login is already tracked in users.last_login by /auth/login
    }
}

async function initManagerOverview() {
    await renderManagerStatsCards();
    renderManagerCharts();
    renderManagerHighPriorityProjects();
    await renderManagerTimeline();
}

async function renderManagerStatsCards() {
    const activeProj  = allProjects.filter(p=>p.status==='active').length;
    const atRisk      = allProjects.filter(p=>p.status==='delayed'||(p.urgency==='high'&&p.progress<30)).length;
    const employees   = allUsers.filter(e=>e.role==='employee');
    const teamMembers = employees.length;
    const el = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
    const elTrend = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };

    // How many projects are on-track (progress >= 50% or not delayed)
    const onTrack = allProjects.filter(p=>p.status==='active'&&p.progress>=50).length;
    const onTrackPct = activeProj > 0 ? Math.round(onTrack/activeProj*100) : 0;

    el('mgrStatTeam', teamMembers);
    elTrend('mgrStatTeamTrend', `→ ${teamMembers} in your department`);
    el('mgrStatProj', activeProj);
    elTrend('mgrStatProjTrend', `↗ ${onTrackPct}% on track`);
    el('mgrStatRisk', atRisk || 0);
    elTrend('mgrStatRiskTrend', atRisk > 0 ? `↘ Need attention` : `✓ All projects healthy`);

    // Compute employee efficiency: try backend stats first, then calculate from performance scores
    let eff = '—';
    try {
        const sr = await api('GET', '/dashboard/stats', { userId: currentUser?.id, role: 'manager' });
        const stats = sr?.data || {};
        const effVal = stats.team_efficiency ?? stats.teamEfficiency
                    ?? stats.employee_efficiency ?? stats.employeeEfficiency
                    ?? stats.avg_performance ?? stats.avgPerformance;
        if (effVal != null && effVal > 0) {
            eff = typeof effVal === 'number' ? effVal + '%' : effVal;
        } else {
            throw new Error('no stat');
        }
    } catch {
        // Calculate from employee performance scores in allUsers
        if (employees.length > 0) {
            const avg = Math.round(
                employees.reduce((s,e)=>s+(e.performanceScore||e.performance_score||85),0) / employees.length
            );
            eff = avg + '%';
        } else {
            eff = '87%'; // safe fallback
        }
    }
    el('mgrStatEff', eff);
    elTrend('mgrStatEffTrend', `↗ Based on ${teamMembers} employee${teamMembers!==1?'s':''}`);
}

function renderManagerCharts() {
    if (charts.teamPerformanceChart) charts.teamPerformanceChart.destroy();
    const ctx1 = document.getElementById('teamPerformanceChart')?.getContext('2d');
    if (ctx1) {
        const emps   = allUsers.filter(e=>e.role==='employee');
        const depts  = [...new Set(emps.map(e=>e.departmentName||e.department_name||'Unknown'))];
        const scores = depts.map(d=>{
            const group = emps.filter(e=>(e.departmentName||e.department_name)===d);
            return group.length ? Math.round(group.reduce((s,e)=>s+(e.performanceScore||e.performance_score||85),0)/group.length) : 85;
        });
        charts.teamPerformanceChart = new Chart(ctx1, { type:'bar', data:{ labels:depts, datasets:[{ label:'Avg Performance', data:scores, backgroundColor:['rgba(99,102,241,0.8)','rgba(16,185,129,0.8)','rgba(245,158,11,0.8)','rgba(59,130,246,0.8)'], borderRadius:6 }] }, options:{ responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true,max:100}} } });
    }
    if (charts.projectStatusChart) charts.projectStatusChart.destroy();
    const ctx2 = document.getElementById('projectStatusChart')?.getContext('2d');
    if (ctx2) {
        const active     = allProjects.filter(p=>p.status==='active').length;
        const completed  = allProjects.filter(p=>p.status==='completed').length;
        const unassigned = allProjects.filter(p=>p.status==='unassigned').length;
        const delayed    = allProjects.filter(p=>p.status==='delayed').length;
        charts.projectStatusChart = new Chart(ctx2, { type:'doughnut', data:{ labels:['Active','Completed','Unassigned','Delayed'], datasets:[{ data:[active,completed,unassigned,delayed], backgroundColor:['#10B981','#6366F1','#F59E0B','#EF4444'], borderWidth:0 }] }, options:{ responsive:true, cutout:'65%', plugins:{legend:{position:'bottom'}} } });
    }
}

function renderManagerHighPriorityProjects() {
    const container = document.getElementById('managerHighPriorityProjects');
    if (!container) return;
    const hp = allProjects.filter(p=>(p.priority==='high'||p.priority==='critical')&&p.status==='active').slice(0,4);
    container.innerHTML = hp.map(p=>projectCard(p,'manager')).join('') || '<p style="color:var(--text-secondary);padding:1rem">No high-priority projects</p>';
}

async function renderManagerTimeline() {
    const container = document.getElementById('managerTimeline');
    if (!container) return;
    try {
        const res = await api('GET', '/activities', { departmentId: currentUser?.departmentId || currentUser?.department_id, limit: 8 });
        const acts = res.data || [];
        const icons = { commit:'💻', milestone:'🏆', completion:'✅', upload:'📤', update:'🔄', user:'👤', assign:'📋' };
        container.innerHTML = acts.map(a=>`<div class="timeline-item"><div class="timeline-icon">${icons[a.type]||'📋'}</div><div class="timeline-content"><div class="timeline-action">${a.action}</div><div class="timeline-time">${formatTime(a.createdAt||a.created_at)}</div></div></div>`).join('') || '<p style="color:var(--text-secondary);padding:1rem">No recent activity</p>';
    } catch {
        container.innerHTML = '<p style="color:var(--text-secondary)">Could not load timeline</p>';
    }
}

function renderManagerWorkload() {
    const container = document.getElementById('workloadTableBody');
    if (!container) return;
    let employees = allUsers.filter(e=>e.role==='employee');
    const search   = document.getElementById('workloadSearch')?.value?.toLowerCase() || '';
    const deptF    = document.getElementById('workloadDept')?.value   || 'all';
    const loadF    = document.getElementById('workloadLoad')?.value   || 'all';
    if (search) employees = employees.filter(e=>e.name.toLowerCase().includes(search)||(e.employeeId||e.employee_id||'').toLowerCase().includes(search));
    if (deptF !== 'all') employees = employees.filter(e=>(e.departmentName||e.department_name)===deptF);
    if (loadF !== 'all') {
        if (loadF==='high')   employees = employees.filter(e=>e.workload>=75);
        else if (loadF==='medium') employees = employees.filter(e=>e.workload>=40&&e.workload<75);
        else if (loadF==='low')    employees = employees.filter(e=>e.workload<40);
    }
    const wc = w => w>=75?'danger':w>=50?'warning':'success';
    const wl = w => w>=75?'High':w>=50?'Medium':'Low';
    const projCount = e => allProjects.filter(p=>p.team&&p.team.some(t=>t.userId===e.id||t.name===e.name)).length;
    container.innerHTML = employees.map(e=>`
        <tr>
            <td><div class="emp-cell"><div class="emp-avatar-sm">${e.avatarInitials||e.avatar_initials||initials(e.name)}</div><div><div class="emp-name">${e.name}</div><div class="emp-id">${e.employeeId||e.employee_id}</div></div></div></td>
            <td>${e.departmentName||e.department_name}</td>
            <td><div style="display:flex;align-items:center;gap:0.5rem"><div class="progress-bar" style="width:100px;flex:none"><div class="progress-fill" style="width:${e.workload}%;background:var(--${wc(e.workload)})"></div></div><span>${e.workload}%</span></div></td>
            <td><span class="badge badge-${wc(e.workload)}">${wl(e.workload)}</span></td>
            <td>${projCount(e)}</td>
            <td>${e.hoursPerWeek||e.hours_per_week}h/week</td>
            <td><span class="badge badge-${(e.performanceScore||e.performance_score||0)>=90?'success':(e.performanceScore||e.performance_score||0)>=75?'warning':'danger'}">${e.performanceScore||e.performance_score||0}%</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-secondary" onclick="viewEmployeeDetail(${e.id},'manager')" title="View">👁️</button>
                    <button class="btn btn-sm btn-primary"   onclick="openManagerAssignModal(${e.id})"       title="Assign">📋</button>
                    <button class="btn btn-sm btn-success"   onclick="openMessageModal(${e.id})"             title="Message">💬</button>
                </div>
            </td>
        </tr>`).join('');
    if (!employees.length) container.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-secondary);padding:2rem">No employees found</td></tr>';
}

async function renderManagerReports() {
    const container = document.getElementById('managerReportsContainer');
    if (!container) return;
    let projects = [...allProjects];
    const search  = document.getElementById('reportSearch')?.value?.toLowerCase() || '';
    const status  = document.getElementById('reportStatus')?.value  || 'all';
    const urgency = document.getElementById('reportUrgency')?.value || 'all';
    if (search)         projects = projects.filter(p=>p.name.toLowerCase().includes(search)||p.code.toLowerCase().includes(search));
    if (status!=='all') projects = projects.filter(p=>p.status===status);
    if (urgency!=='all')projects = projects.filter(p=>p.urgency===urgency);

    // Load team members for projects that haven't had their teams fetched yet
    const needTeam = projects.filter(p => !p._teamLoaded);
    if (needTeam.length > 0) {
        container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading project team data…</p></div>';
        try {
            await Promise.all(needTeam.slice(0, 20).map(async p => {
                try {
                    const detail = await api('GET', `/projects/${p.id}`);
                    if (detail?.data) {
                        // Update in allProjects cache
                        const cached = allProjects.find(ap => ap.id === p.id);
                        if (cached) {
                            cached.team = detail.data.team || detail.data.team_members || [];
                            cached._teamLoaded = true;
                        }
                        p.team = detail.data.team || detail.data.team_members || [];
                        p._teamLoaded = true;
                    }
                } catch { p._teamLoaded = true; /* mark so we don't retry */ }
            }));
        } catch {}
    }

    container.innerHTML = projects.map(p => {
        const days = daysUntil(p.deadline);
        const sc   = { active:'success', completed:'info', delayed:'danger', unassigned:'warning' }[p.status]||'info';
        const rl   = p.progress<30&&days<14?'Critical':p.progress<60&&days<7?'High':p.progress>=70?'Low':'Medium';
        const rc   = { Critical:'danger',High:'warning',Medium:'info',Low:'success' }[rl];
        const team = p.team || p.team_members || p.members || [];
        return `<div class="report-card">
            <div class="report-card-header">
                <div><div class="report-code">${p.code}</div><div class="report-name">${p.name}</div></div>
                <div style="display:flex;gap:0.5rem"><span class="badge badge-${sc}">${p.status}</span><span class="badge badge-${rc}">${rl} Risk</span></div>
            </div>
            <div class="report-progress-section">
                <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem"><span>Progress: ${p.progress}%</span><span>${days<0?'Overdue':days+'d left'}</span></div>
                <div class="progress-bar"><div class="progress-fill" style="width:${p.progress}%"></div></div>
            </div>
            <div class="report-stats">
                <div class="report-stat"><span>👥</span><span>${team.length} member${team.length!==1?'s':''}</span></div>
                <div class="report-stat"><span>📅</span><span>${p.deadline}</span></div>
            </div>
            <div class="report-actions">
                <button class="btn btn-sm btn-secondary" onclick="openProjectDetail(${p.id},'manager')">📋 View Details</button>
                <button class="btn btn-sm btn-primary"   onclick="openProjectDetail(${p.id},'manager')">💬 Comment</button>
                <button class="btn btn-sm btn-secondary" onclick="exportProjectReport(${p.id})">📥 Export</button>
            </div>
        </div>`;
    }).join('') || '<div class="empty-state"><div class="empty-icon">📊</div><p>No projects</p></div>';
}

function renderManagerProjects() {
    const container = document.getElementById('managerProjectsGrid');
    if (!container) return;
    let projects = [...allProjects];
    const search = document.getElementById('mgrProjSearch')?.value?.toLowerCase() || '';
    const status = document.getElementById('mgrProjStatus')?.value || 'all';
    if (search) projects = projects.filter(p=>p.name.toLowerCase().includes(search)||p.code.toLowerCase().includes(search));
    if (status !== 'all') projects = projects.filter(p=>p.status===status);
    container.innerHTML = projects.map(p=>managerProjectCard(p)).join('') || '<div class="empty-state"><div class="empty-icon">📁</div><p>No projects found</p></div>';
}

function managerProjectCard(p) {
    const sc  = { active:'success', completed:'info', delayed:'danger', unassigned:'warning' };
    const pc  = { critical:'danger', high:'warning', medium:'info', low:'success' };
    const days = daysUntil(p.deadline);
    const dt  = days<0?`<span style="color:var(--danger)">Overdue by ${Math.abs(days)}d</span>`:days===0?`<span style="color:var(--warning)">Due Today</span>`:`${days} days left`;
    const team = p.team || [];
    return `<div class="project-card">
        <div class="project-card-header"><div class="project-code">${p.code}</div><span class="badge badge-${sc[p.status]||'info'}">${p.status}</span></div>
        <h3 class="project-name">${p.name}</h3>
        <div class="project-meta"><span class="badge badge-${pc[p.priority]||'info'}">${p.priority}</span><span class="badge badge-warning">${p.urgency} urgency</span></div>
        <div class="progress-section"><div class="progress-header"><span>Progress</span><span>${p.progress}%</span></div><div class="progress-bar"><div class="progress-fill" style="width:${p.progress}%"></div></div></div>
        <div class="project-footer"><div class="project-deadline">📅 ${dt}</div><div class="project-team">${team.slice(0,3).map(m=>`<div class="team-avatar-sm" title="${m.name}">${initials(m.name)}</div>`).join('')}${team.length>3?`<div class="team-avatar-sm">+${team.length-3}</div>`:''}</div></div>
        <div style="display:flex;gap:0.5rem;margin-top:0.75rem;border-top:1px solid var(--border);padding-top:0.75rem">
            <button class="btn btn-sm btn-secondary" onclick="openProjectDetail(${p.id},'manager')" style="flex:1">👁️ View</button>
            ${p.status !== 'unassigned'
                ?`<button class="btn btn-sm btn-success btn-glow" onclick="openManageTeamModal(${p.id})" style="flex:1">⚙️ Manage Project</button>`
                :`<button class="btn btn-sm btn-primary btn-glow" onclick="openManagerAssignModal(null,${p.id})" style="flex:1">📋 Assign Project</button>`}
            <button class="btn btn-sm btn-secondary" onclick="openProjectDetail(${p.id},'manager')" style="flex:0 0 auto">💬</button>
        </div>
    </div>`;
}

async function openManagerAssignModal(employeeId = null, preSelectProjectId = null) {
    const assignableProjs = allProjects.filter(p=>p.status==='active'||p.status==='unassigned');
    const employees = allUsers.filter(e=>e.role==='employee');
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'tempAssignModal';
    const empOptions = employees.map(e=>`
        <div class="assign-emp-item" data-id="${e.id}" onclick="toggleAssignEmployee(this,${e.id})">
            <div class="assign-emp-avatar">${e.avatarInitials||e.avatar_initials||initials(e.name)}</div>
            <div class="assign-emp-info"><div class="assign-emp-name">${e.name}</div><div class="assign-emp-dept">${e.departmentName||e.department_name} · ${e.workload}% load</div></div>
            <div class="assign-emp-check">✓</div>
        </div>`).join('');
    modal.innerHTML = `<div class="modal-backdrop" onclick="closeModal('tempAssignModal')"></div>
        <div class="modal-content modal-modern modal-wide">
            <button class="modal-close" onclick="closeModal('tempAssignModal')">×</button>
            <div class="modal-header-modern"><h2>📋 Assign Project</h2><p>Select a project and assign employees</p></div>
            <div class="form-group"><label>📁 Select Project *</label>
                <select id="assignProjSelect" class="form-control">
                    <option value="">-- Choose project --</option>
                    ${assignableProjs.map(p=>`<option value="${p.id}">${p.code} — ${p.name} (${p.status})</option>`).join('')}
                </select>
            </div>
            <div class="form-group"><label>👥 Select Employees <span id="selectedEmpCount" style="color:var(--primary);font-weight:600">(0 selected)</span></label>
                <div class="assign-emp-list" id="assignEmpList">${empOptions}</div>
            </div>
            <div class="form-group"><label>🏷️ Role in Project</label>
                <input type="text" id="assignProjRole" placeholder="e.g. Lead Developer" value="Team Member" class="form-control">
            </div>
            <div class="assign-modal-footer">
                <button class="btn btn-secondary" onclick="closeModal('tempAssignModal')">Cancel</button>
                <button class="btn btn-primary btn-glow" onclick="confirmManagerAssign()">Assign ✓</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    window._selectedAssignEmps = employeeId ? [employeeId] : [];
    if (preSelectProjectId) { const sel=document.getElementById('assignProjSelect'); if(sel) sel.value=preSelectProjectId; }
    if (employeeId) {
        const item = modal.querySelector(`[data-id="${employeeId}"]`);
        if (item) { item.classList.add('selected'); item.querySelector('.assign-emp-check').classList.add('checked'); }
        document.getElementById('selectedEmpCount').textContent = '(1 selected)';
    }
}

function toggleAssignEmployee(el, empId) {
    if (!window._selectedAssignEmps) window._selectedAssignEmps = [];
    const idx = window._selectedAssignEmps.indexOf(empId);
    if (idx === -1) { window._selectedAssignEmps.push(empId); el.classList.add('selected'); el.querySelector('.assign-emp-check').classList.add('checked'); }
    else            { window._selectedAssignEmps.splice(idx,1); el.classList.remove('selected'); el.querySelector('.assign-emp-check').classList.remove('checked'); }
    const ce = document.getElementById('selectedEmpCount');
    if (ce) ce.textContent = `(${window._selectedAssignEmps.length} selected)`;
}

async function confirmManagerAssign() {
    const projId = parseInt(document.getElementById('assignProjSelect')?.value);
    const role   = document.getElementById('assignProjRole')?.value || 'Team Member';
    const empIds = window._selectedAssignEmps || [];
    if (!projId) { showToast('Please select a project ⚠️', 'error'); return; }
    if (!empIds.length) { showToast('Please select at least one employee ⚠️', 'error'); return; }
    try {
        await api('POST', '/assignments', { projectId: projId, userIds: empIds, roleInProject: role, assignedBy: currentUser?.id });
        closeModal('tempAssignModal');
        window._selectedAssignEmps = [];
        showToast(`Assigned ${empIds.length} employee(s) to project ✓`);
        // Refresh projects from DB to get the real updated status
        const projRes = await api('GET', '/projects');
        allProjects = projRes.data || [];
        // Also optimistically update the local project status if API didn't change it
        const localProj = allProjects.find(p=>p.id===projId);
        if (localProj && localProj.status === 'unassigned') {
            localProj.status = 'active';
        }
        renderManagerWorkload();
        renderManagerProjects();
    } catch (e) {
        showToast(`Assignment failed: ${e.message}`, 'error');
    }
}

async function openManageTeamModal(projectId) {
    // Remove any existing instance first
    const existing = document.getElementById('manageTeamModal');
    if (existing) existing.parentNode?.removeChild(existing);

    const projRes = await api('GET', `/projects/${projectId}`).catch(()=>null);
    const project = projRes?.data;
    if (!project) { showToast('Could not load project', 'error'); return; }

    const team      = project.team || [];
    const employees = allUsers.filter(e=>e.role==='employee');
    const teamIds   = team.map(m=>m.userId||m.user_id);
    // Only employees NOT already on the team appear in the add-dropdown
    const available = employees.filter(e=>!teamIds.includes(e.id));

    const removeSection = team.length
        ? team.map(m=>`
            <div class="manage-member-row">
                <div style="display:flex;align-items:center;gap:0.75rem">
                    <div class="manage-member-avatar">${initials(m.name)}</div>
                    <div>
                        <div class="manage-member-name">${m.name}</div>
                        <div class="manage-member-role">${m.roleInProject||m.role_in_project||'Team Member'}</div>
                    </div>
                </div>
                <button class="btn btn-sm btn-danger" onclick="removeTeamMember(${projectId},${m.userId||m.user_id})">✕ Remove</button>
            </div>`).join('')
        : `<div class="manage-empty-note">No team members assigned yet.</div>`;

    const addSection = available.length
        ? `<div class="manage-add-row">
                <select id="newTeamMemberSelect" class="form-control">
                    <option value="">— Select an employee to add —</option>
                    ${available.map(e=>`<option value="${e.id}">${e.name} · ${e.departmentName||e.department_name} · ${e.workload||0}% load</option>`).join('')}
                </select>
                <input type="text" id="newTeamMemberRole" placeholder="Role in project" value="Team Member" class="form-control" style="max-width:180px">
                <button class="btn btn-primary btn-glow" onclick="addTeamMemberFromModal(${projectId})">➕ Add</button>
           </div>`
        : `<div class="manage-empty-note">All available employees are already on this project.</div>`;

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'manageTeamModal';
    modal.innerHTML = `
        <div class="modal-backdrop" onclick="closeModal('manageTeamModal')"></div>
        <div class="modal-content modal-modern modal-wide">
            <button class="modal-close" onclick="closeModal('manageTeamModal')">×</button>
            <div class="modal-header-modern">
                <h2>⚙️ Manage Project — ${project.name}</h2>
                <p>${project.code} · Add or remove team members</p>
            </div>

            <!-- REMOVE SECTION -->
            <div class="manage-section">
                <div class="manage-section-title">
                    <span class="manage-section-icon" style="background:rgba(239,68,68,0.12);color:#EF4444">👥</span>
                    <div>
                        <div style="font-weight:700;font-size:0.95rem">Current Team</div>
                        <div style="font-size:0.8rem;color:var(--text-secondary)">Remove members from this project</div>
                    </div>
                    <span class="badge badge-${team.length?'success':'warning'}" style="margin-left:auto">${team.length} member${team.length!==1?'s':''}</span>
                </div>
                <div class="manage-member-list" id="currentTeamList">
                    ${removeSection}
                </div>
            </div>

            <!-- ADD SECTION -->
            <div class="manage-section" style="border-top:2px solid var(--border);margin-top:0.25rem;padding-top:1.25rem">
                <div class="manage-section-title">
                    <span class="manage-section-icon" style="background:rgba(16,185,129,0.12);color:#10B981">➕</span>
                    <div>
                        <div style="font-weight:700;font-size:0.95rem">Add Team Member</div>
                        <div style="font-size:0.8rem;color:var(--text-secondary)">Only employees not yet on this project are shown</div>
                    </div>
                </div>
                ${addSection}
            </div>

            <div class="assign-modal-footer">
                <button class="btn btn-secondary" onclick="closeModal('manageTeamModal')">Done</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}

async function removeTeamMember(projectId, userId) {
    try {
        await api('DELETE', `/assignments?projectId=${projectId}&userId=${userId}`);
        showToast('Team member removed ✓');
        const projRes = await api('GET', '/projects');
        allProjects = projRes.data || [];
        closeModal('manageTeamModal');
        await openManageTeamModal(projectId);
        renderManagerProjects();
    } catch (e) {
        showToast(`Failed to remove: ${e.message}`, 'error');
    }
}

async function addTeamMemberFromModal(projectId) {
    const empId = parseInt(document.getElementById('newTeamMemberSelect')?.value);
    const role  = document.getElementById('newTeamMemberRole')?.value || 'Team Member';
    if (!empId) { showToast('Please select an employee ⚠️', 'error'); return; }
    try {
        await api('POST', '/assignments', { projectId, userIds: [empId], roleInProject: role, assignedBy: currentUser?.id });
        showToast('Team member added ✓');
        const projRes = await api('GET', '/projects');
        allProjects = projRes.data || [];
        closeModal('manageTeamModal');
        await openManageTeamModal(projectId);
        renderManagerProjects();
    } catch (e) {
        showToast(`Failed to add: ${e.message}`, 'error');
    }
}

async function openMessageModal(employeeId) {
    const emp = allUsers.find(e=>e.id===employeeId);
    if (!emp) return;
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'tempMsgModal';
    modal.innerHTML = `<div class="modal-backdrop" onclick="closeModal('tempMsgModal')"></div>
        <div class="modal-content modal-modern">
            <button class="modal-close" onclick="closeModal('tempMsgModal')">×</button>
            <div class="modal-header-modern"><h2>💬 Send Message</h2><p>To: ${emp.name}</p></div>
            <div class="form-group"><label>Message</label><textarea id="msgContent" rows="4" placeholder="Write your message here…"></textarea></div>
            <button class="btn btn-primary btn-block btn-glow" onclick="sendMessage(${employeeId})">Send Message 📤</button>
        </div>`;
    document.body.appendChild(modal);
}

async function sendMessage(employeeId) {
    const msg = document.getElementById('msgContent')?.value?.trim();
    if (!msg) { showToast('Please enter a message', 'error'); return; }
    try {
        await _postMessage(currentUser.id, employeeId, `Message from ${currentUser?.name||'Manager'}`, msg);
        // Cache sent message
        _sentMessages.push({ fromId: currentUser.id, toId: employeeId, from_id: currentUser.id, to_id: employeeId, body: msg, subject: `Message from ${currentUser?.name||'Manager'}`, is_read: true, _localTime: new Date().toISOString() });
        closeModal('tempMsgModal');
        showToast('Message sent successfully 📨');
    } catch (e) {
        showToast(`Failed to send: ${e.message}`, 'error');
    }
}

async function viewEmployeeDetail(id, role) {
    const modal   = document.getElementById('employeeDetailModal');
    const title   = document.getElementById('employeeDetailTitle');
    const content = document.getElementById('employeeDetailContent');
    if (!modal || !content) return;
    title.textContent = 'Loading…';
    content.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading employee profile…</p></div>';
    modal.classList.add('active');

    let emp = null;
    let acts = [];

    try {
        const empRes = await api('GET', `/users/${id}`);
        if (empRes?.data) {
            // Handle both direct user object and nested { user: {...}, activities: [...] } formats
            const d = empRes.data;
            if (d.name != null) {
                emp = d;
                acts = d.daily_activities || d.dailyActivities || d.activities || [];
            } else if (d.user) {
                emp = d.user;
                acts = d.activities || d.daily_activities || d.dailyActivities || [];
            } else {
                emp = d;
                acts = [];
            }
        }
    } catch { /* fall through to allUsers lookup */ }

    // Fallback: try to find in allUsers if API failed or returned incomplete data
    if (!emp || (!emp.name && !emp.employee_id && !emp.employeeId)) {
        const fromCache = allUsers.find(e => e.id === id || e.id === Number(id));
        if (fromCache) emp = { ...fromCache, daily_activities: fromCache.daily_activities || acts };
    } else if (!emp.name) {
        // emp exists but name is missing — merge with allUsers entry
        const cached = allUsers.find(e => e.id === id || e.id === Number(id));
        if (cached) emp = Object.assign({}, cached, emp);
    }

    // If still no data, show error
    if (!emp || !emp.name) {
        title.textContent = 'Employee Profile';
        content.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Could not load employee data. Please try again.</p></div>';
        return;
    }

    // Merge acts from emp if not already set
    if (!acts.length) {
        acts = emp.daily_activities || emp.dailyActivities || emp.activities || [];
    }

    title.textContent = `${emp.name} — Employee Profile`;
    const onTimeRate = (emp.projectsCompleted||0) > 0
        ? Math.round(((emp.projectsOnTime||emp.projects_on_time||0)/(emp.projectsCompleted||emp.projects_completed||1))*100)
        : 0;
    const wc = (emp.workload||0)>=75?'danger':(emp.workload||0)>=50?'warning':'success';
    let skills = emp.skills;
    skills = parseSkills(skills);

    // Compute project count from allProjects if not in emp
    const empProjectCount = emp.projectCount ?? emp.project_count
        ?? allProjects.filter(p=>p.team&&p.team.some(t=>t.userId===emp.id||t.user_id===emp.id||t.name===emp.name)).length;

    content.innerHTML = `
        <div class="emp-detail-grid">
            <div class="emp-detail-left">
                <div class="emp-detail-header">
                    <div class="profile-avatar-large">${emp.avatarInitials||emp.avatar_initials||initials(emp.name)}</div>
                    <div>
                        <h2>${emp.name}</h2>
                        <p class="emp-id-large">${emp.employeeId||emp.employee_id||'—'}</p>
                        <p>${emp.departmentName||emp.department_name||'—'} • ${emp.role||'Employee'}</p>
                    </div>
                </div>
                <div class="emp-detail-stats">
                    <div class="emp-stat-item"><div class="emp-stat-value">${emp.performanceScore||emp.performance_score||0}%</div><div class="emp-stat-label">Performance</div></div>
                    <div class="emp-stat-item"><div class="emp-stat-value">${empProjectCount}</div><div class="emp-stat-label">Active Projects</div></div>
                    <div class="emp-stat-item"><div class="emp-stat-value">${emp.projectsCompleted||emp.projects_completed||0}</div><div class="emp-stat-label">Completed</div></div>
                    <div class="emp-stat-item"><div class="emp-stat-value">${onTimeRate}%</div><div class="emp-stat-label">On-Time</div></div>
                </div>
                <div class="detail-section">
                    <h4>🔧 Skills</h4>
                    <div class="skills-container">${(skills||[]).map((s,i)=>`<span class="skill-tag skill-tag-${['primary','success','warning','info'][i%4]}">${s}</span>`).join('') || '<span style="color:var(--text-secondary)">No skills listed</span>'}</div>
                </div>
                <div class="detail-section">
                    <h4>📊 Workload</h4>
                    <div style="display:flex;align-items:center;gap:1rem">
                        <div class="progress-bar" style="flex:1"><div class="progress-fill" style="width:${emp.workload||0}%;background:var(--${wc})"></div></div>
                        <span class="badge badge-${wc}">${emp.workload||0}% Utilized</span>
                    </div>
                </div>
                <div class="detail-section">
                    <h4>📋 Contact</h4>
                    <div style="font-size:0.875rem;color:var(--text-secondary)">
                        <div style="margin-bottom:0.3rem">📧 ${emp.email||'—'}</div>
                        <div>📅 Joined: ${emp.joinDate||emp.join_date||'—'}</div>
                    </div>
                </div>
            </div>
            <div class="emp-detail-right">
                <div class="detail-section">
                    <h4>📅 Daily Activities (Last 7 Days)</h4>
                    <table class="data-table">
                        <thead><tr><th>Date</th><th>Hours</th><th>Commits</th><th>Tasks</th><th>Stress</th></tr></thead>
                        <tbody>${acts.slice(0,7).map(a=>{
                            const sl=a.stressLevel||a.stress_level||'low';
                            const sc2=sl==='high'?'danger':sl==='medium'?'warning':'success';
                            return`<tr><td>${a.activityDate||a.activity_date||'—'}</td><td>${a.hoursWorked||a.hours_worked||0}h</td><td>${a.commits||0}</td><td>${a.tasksDone||a.tasks_done||0}</td><td><span class="badge badge-${sc2}">${sl}</span></td></tr>`;
                        }).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--text-secondary)">No activity data</td></tr>'}</tbody>
                    </table>
                </div>
                ${role==='manager'?`<div class="emp-detail-actions">
                    <button class="btn btn-primary btn-glow" onclick="openManagerAssignModal(${emp.id});closeModal('employeeDetailModal')">📋 Assign Project</button>
                    <button class="btn btn-secondary" onclick="openMessageModal(${emp.id});closeModal('employeeDetailModal')">💬 Message</button>
                    <button class="btn btn-secondary" onclick="exportEmployeeReport(${emp.id})">📥 Export</button>
                </div>`:role==='hr'?`<div class="emp-detail-actions">
                    <button class="btn btn-secondary" onclick="openMessageModal(${emp.id});closeModal('employeeDetailModal')">💬 Message</button>
                    <button class="btn btn-secondary" onclick="exportEmployeeReport(${emp.id})">📥 Export</button>
                </div>`:''}
            </div>
        </div>`;
}

// ============================================================
//  HR DASHBOARD
// ============================================================
async function initHRDashboard(user) {
    document.getElementById('hrName').textContent = user.name || 'HR Manager';
    try {
        const [projRes, userRes, deptRes] = await Promise.all([
            api('GET', '/projects'),
            api('GET', '/users'),
            api('GET', '/departments')
        ]);
        allProjects    = projRes.data || [];
        allUsers       = userRes.data || [];
        allDepartments = deptRes.data || [];
    } catch { showToast('Failed to load HR data', 'error'); }

    // Populate dept filter from real DB data
    populateDeptFilter('empTrackDept', allDepartments);

    renderHRStats();
    renderHROverviewCharts();

    // Record HR login activity in DB
    await recordHRAction('login', `HR ${user.name} logged into the portal`);
    // Store session start in localStorage for logout duration calculation
    if (!localStorage.getItem('spms_session_start')) {
        localStorage.setItem('spms_session_start', new Date().toISOString());
        localStorage.setItem('spms_session_user',  String(user.id));
    }
}

function renderHRStats() {
    const el  = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
    const tr  = (id,cls,txt) => {
        const e=document.getElementById(id);
        if (!e) return;
        e.className = `stat-trend stat-trend-${cls}`;
        e.textContent = txt;
    };

    const employees   = allUsers.filter(e=>e.role==='employee');
    const empCount    = employees.length;
    const activeProj  = allProjects.filter(p=>p.status==='active').length;
    const unassigned  = allProjects.filter(p=>p.status==='unassigned').length;

    // Allocation Rate: percentage of employees that have workload > 0 (i.e. are on a project)
    const assigned    = employees.filter(e=>(e.workload||0)>0).length;
    const allocRate   = empCount ? Math.round(assigned/empCount*100) : 0;

    el('hrStatEmployees',  empCount);
    el('hrStatActive',     activeProj);
    el('hrStatUnassigned', unassigned);
    el('hrStatAllocation', allocRate+'%');

    tr('hrStatEmployeesTrend', 'up',     `↗ ${employees.filter(e=>e.status==='active').length} active`);
    tr('hrStatActiveTrend',    activeProj>0?'neutral':'down', activeProj>0?'→ Ongoing':'— None');
    tr('hrStatUnassignedTrend',unassigned>0?'down':'up',      unassigned>0?`↘ ${unassigned} need staffing`:'↗ All assigned');
    tr('hrStatAllocationTrend',allocRate>=80?'up':allocRate>=50?'neutral':'down', allocRate>=80?'↗ Optimal':allocRate>=50?'→ Moderate':'↘ Low');
}

function renderHROverviewCharts() {
    if (charts.deptChart) charts.deptChart.destroy();
    const ctx = document.getElementById('deptChart')?.getContext('2d');
    if (ctx) {
        const depts  = [...new Set(allUsers.filter(e=>e.role==='employee').map(e=>e.departmentName||e.department_name).filter(Boolean))];
        const counts = depts.map(d=>allUsers.filter(e=>e.role==='employee'&&(e.departmentName||e.department_name)===d).length);
        charts.deptChart = new Chart(ctx, { type:'pie', data:{ labels:depts, datasets:[{ data:counts, backgroundColor:['#6366F1','#10B981','#F59E0B','#3B82F6','#8B5CF6','#EF4444'] }] }, options:{ responsive:true, plugins:{legend:{position:'bottom'}} } });
    }
    renderHRActivities();
}

// ── Render HR-specific recent activities from DB into #hrActivities ──
async function renderHRActivities() {
    const container = document.getElementById('hrActivities');
    if (!container) return;
    container.innerHTML = '<div class="loading-state" style="padding:1rem"><div class="spinner" style="width:20px;height:20px;margin:0 auto"></div></div>';
    try {
        // Fetch recent global activities (project_history across all projects)
        const r = await api('GET', '/activities', { limit: 30 }).catch(()=>({ data:[] }));
        let acts = r.data || [];
        // Also fetch audit-log if accessible
        const auditRes = await api('GET', '/audit-log').catch(()=>({ data:[] }));
        const audits = (auditRes.data || []).slice(0,20).map(a=>({
            action: a.action||a.description||'',
            person_name: a.performedBy||a.performed_by||a.userName||a.user_name||'',
            created_at: a.createdAt||a.created_at
        }));
        // Merge, deduplicate, sort newest-first
        const merged = [...acts, ...audits];
        merged.sort((a,b)=>new Date(b.created_at||b.createdAt||0)-new Date(a.created_at||a.createdAt||0));
        const top = merged.slice(0,10);
        if (!top.length) {
            container.innerHTML = '<p style="color:var(--text-secondary);padding:1rem 0">No recent activities yet</p>';
            return;
        }
        const iconFor = (action='') =>
              /upload/i.test(action)             ? '📤'
            : /delet/i.test(action)              ? '🗑️'
            : /download/i.test(action)           ? '⬇️'
            : /comment/i.test(action)            ? '💬'
            : /assign/i.test(action)             ? '📋'
            : /login/i.test(action)              ? '🔑'
            : /commit|push|progress/i.test(action)? '💻'
            : /create|add/i.test(action)         ? '➕'
            : '📌';
        container.innerHTML = top.map(a=>`
            <div class="timeline-item">
                <div class="timeline-icon">${iconFor(a.action)}</div>
                <div class="timeline-content">
                    <div class="timeline-action">${a.action||''}</div>
                    <div class="timeline-time">${a.person_name||a.personName||''} · ${formatTime(a.created_at||a.createdAt)}</div>
                </div>
            </div>`).join('');
    } catch {
        container.innerHTML = '<p style="color:var(--text-secondary)">Could not load activities</p>';
    }
}

// ── Safely extract department names from any project shape ──────
// Backend may return `departments[]`, `departmentName`, or `department_name`
function getProjectDepts(p) {
    if (Array.isArray(p.departments) && p.departments.length)
        return p.departments.map(d => d.name || d).filter(Boolean);
    const dn = p.departmentName || p.department_name || '';
    // department_name may be comma-separated (our HR multi-dept storage)
    return dn ? dn.split(',').map(s=>s.trim()).filter(Boolean) : [];
}

async function renderAssignmentProjects() {
    const container = document.getElementById('assignmentProjectsGrid');
    if (!container) return;
    setLoading('assignmentProjectsGrid', 'Loading projects…');
    // Reload fresh from DB and update global allProjects
    const res = await api('GET', '/projects').catch(()=>({ data:[] }));
    const projects = res.data || [];
    allProjects = projects; // ← keep global in sync so selectAssignmentProject can find them
    // Show all non-completed/archived projects so HR can assign or manage
    let filtered = projects.filter(p=>p.status!=='completed'&&p.status!=='archived');
    const search  = document.getElementById('assignProjectSearch')?.value?.toLowerCase() || '';
    const urgency = document.getElementById('assignProjectUrgency')?.value || 'all';
    const dueDate = document.getElementById('assignProjectDueDate')?.value || '';
    if (search)         filtered = filtered.filter(p=>p.name.toLowerCase().includes(search)||p.code.toLowerCase().includes(search));
    if (urgency!=='all')filtered = filtered.filter(p=>p.urgency===urgency);
    if (dueDate)        filtered = filtered.filter(p=>p.deadline&&p.deadline<=dueDate);
    const statusColor = { active:'success', unassigned:'warning', completed:'info', delayed:'danger' };
    container.innerHTML = filtered.map(p=>{
        const depts     = getProjectDepts(p);
        const isAssigned = p.status !== 'unassigned';
        const sc = statusColor[p.status] || 'info';
        const btnClass = isAssigned ? 'btn-success' : 'btn-primary btn-glow';
        const btnLabel = isAssigned ? '⚙️ Manage Project' : '🏢 Assign to Departments';
        const btnAction = isAssigned
            ? `openHRManageProjectModal(${p.id})`
            : `selectAssignmentProject(${p.id})`;
        return `<div class="assignment-project-card" id="apc-${p.id}">
            <div class="apc-header">
                <div><div class="apc-code">${p.code}</div><div class="apc-name">${p.name}</div></div>
                <span class="badge badge-${sc}">${p.status}</span>
            </div>
            <div class="apc-meta">
                <span class="badge badge-${p.urgency==='high'?'danger':p.urgency==='medium'?'warning':'success'}">${p.urgency}</span>
                <span>📅 ${p.deadline||'—'}</span>
                <span>📊 ${p.progress||0}%</span>
            </div>
            ${isAssigned && depts.length ? `<div class="apc-team-section"><div class="apc-current-team">${depts.map(d=>`<span class="team-chip">🏢 ${d}</span>`).join('')}</div></div>` : ''}
            <div style="margin-top:0.75rem">
                <button class="btn btn-sm ${btnClass}" style="width:100%" onclick="${btnAction}">${btnLabel}</button>
            </div>
        </div>`;
    }).join('') || '<div class="empty-state"><div class="empty-icon">📋</div><p>No projects available</p></div>';
}

// ── HR Department Assignment Step 2 ─────────────────────────
let _hrSelectedProject = null;
let _selectedDeptNames = [];

function selectAssignmentProject(projectId) {
    const proj = allProjects.find(p=>p.id===projectId) || { id: projectId, name: 'Project' };
    _hrSelectedProject = proj;
    _selectedDeptNames = (proj.departments||[]).map(d=>d.name||d);
    document.getElementById('assignmentStep1')?.classList.add('hidden');
    document.getElementById('assignmentStep2')?.classList.remove('hidden');
    const nameEl = document.getElementById('selectedProjectName');
    if (nameEl) nameEl.textContent = `${proj.code||''} — ${proj.name}`;
    renderDeptSelectionPanels();
}

function renderDeptSelectionPanels() {
    const availEl    = document.getElementById('availableDepartments');
    const selectedEl = document.getElementById('selectedDepartments');
    const countEl    = document.getElementById('selectedDeptCount');
    if (!availEl || !selectedEl) return;
    const deptNames = allDepartments.map(d=>d.name||d);
    const remaining = deptNames.filter(d=>!_selectedDeptNames.includes(d));
    availEl.innerHTML = remaining.map(d=>`
        <div class="emp-list-item" onclick="toggleDeptSelection('${d.replace(/'/g,"\\'")}')">
            <div class="emp-list-avatar">🏢</div>
            <div class="emp-list-info"><div class="emp-list-name">${d}</div></div>
            <div class="emp-list-check">+</div>
        </div>`).join('') || '<p style="color:var(--text-secondary);font-size:0.875rem;padding:0.5rem">All departments assigned</p>';
    selectedEl.innerHTML = _selectedDeptNames.map(d=>`
        <div class="emp-list-item emp-list-item-selected">
            <div class="emp-list-avatar">🏢</div>
            <div class="emp-list-info"><div class="emp-list-name">${d}</div></div>
            <button class="btn btn-sm btn-danger" onclick="removeDeptSelection('${d.replace(/'/g,"\\'")}')">✕</button>
        </div>`).join('') || '<p style="color:var(--text-secondary);font-size:0.875rem;padding:0.5rem">No departments selected</p>';
    if (countEl) countEl.textContent = `(${_selectedDeptNames.length})`;
}

function toggleDeptSelection(deptName) {
    if (!_selectedDeptNames.includes(deptName)) _selectedDeptNames.push(deptName);
    renderDeptSelectionPanels();
}

function removeDeptSelection(deptName) {
    _selectedDeptNames = _selectedDeptNames.filter(d=>d!==deptName);
    renderDeptSelectionPanels();
}

function clearDeptSelection() {
    _selectedDeptNames = [];
    renderDeptSelectionPanels();
}

function backToProjectSelection() {
    _hrSelectedProject = null;
    _selectedDeptNames = [];
    document.getElementById('assignmentStep2')?.classList.add('hidden');
    document.getElementById('assignmentStep1')?.classList.remove('hidden');
}

async function confirmDeptAssignment() {
    if (!_hrSelectedProject) { showToast('No project selected ⚠️', 'error'); return; }
    if (!_selectedDeptNames.length) { showToast('Please select at least one department ⚠️', 'error'); return; }

    // Append new departments to existing ones (comma-separated in single column)
    const existing = (_hrSelectedProject.department_name || _hrSelectedProject.departmentName || '')
        .split(',').map(s=>s.trim()).filter(Boolean);
    const merged = [...new Set([...existing, ..._selectedDeptNames])].join(', ');

    try {
        const sp = _hrSelectedProject;
        await api('PUT', `/projects/${sp.id}`, {
            name:           sp.name,
            status:         'active',
            priority:       sp.priority || 'medium',
            departmentName: merged,
            description:    sp.description || sp.name || '',
            requestorId:    currentUser?.id,
            requestorName:  currentUser?.name
        });
        showToast(`Project assigned to: ${merged} ✓`);
        const projRes = await api('GET', '/projects');
        allProjects = projRes.data || allProjects;
        backToProjectSelection();
        renderAssignmentProjects();
    } catch (e) {
        showToast(`Assignment failed: ${e.message}`, 'error');
    }
}

function goToAssignProject(projectId) {
    const li = document.querySelector('#hrDashboard .sidebar-menu li:nth-child(2)');
    showView('hr', 'assignment', li);
    // Wait for render then select
    setTimeout(() => selectAssignmentProject(projectId), 300);
}

// ── HR Manage Departments for an Assigned Project ────────────
async function openHRManageProjectModal(projectId) {
    // Remove any existing instance first
    const existing = document.getElementById('hrManageProjectModal');
    if (existing) existing.parentNode?.removeChild(existing);

    // Always fetch fresh from DB so we have latest department assignments
    const projRes = await api('GET', `/projects/${projectId}`).catch(()=>null);
    let project = projRes?.data;
    if (!project) {
        // Fallback: reload all projects and find
        try {
            const allRes = await api('GET', '/projects');
            if (allRes?.data) allProjects = allRes.data;
        } catch {}
        project = allProjects.find(p=>p.id===projectId);
    }
    if (!project) { showToast('Could not load project', 'error'); return; }

    const assignedDepts  = getProjectDepts(project);
    const allDeptNames   = allDepartments.map(d=>d.name||d);
    // Only show departments NOT already assigned in the add-dropdown
    const availableToAdd = allDeptNames.filter(d=>!assignedDepts.includes(d));

    const removeSection = assignedDepts.length
        ? assignedDepts.map(d=>`
            <div class="manage-member-row">
                <div style="display:flex;align-items:center;gap:0.75rem">
                    <div class="manage-member-avatar">🏢</div>
                    <div class="manage-member-name">${d}</div>
                </div>
                <button class="btn btn-sm btn-danger" onclick="hrRemoveDeptFromProject(${projectId},'${d.replace(/'/g,"\\'")}')">✕ Remove</button>
            </div>`).join('')
        : `<div class="manage-empty-note">No departments assigned to this project yet.</div>`;

    const addSection = availableToAdd.length
        ? `<div class="manage-add-row">
                <select id="hrAddDeptSelect" class="form-control">
                    <option value="">— Select a department to add —</option>
                    ${availableToAdd.map(d=>`<option value="${d}">${d}</option>`).join('')}
                </select>
                <button class="btn btn-primary btn-glow" onclick="hrAddDeptToProject(${projectId})">➕ Add</button>
           </div>`
        : `<div class="manage-empty-note">All departments are already assigned to this project.</div>`;

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'hrManageProjectModal';
    modal.innerHTML = `
        <div class="modal-backdrop" onclick="closeModal('hrManageProjectModal')"></div>
        <div class="modal-content modal-modern modal-wide">
            <button class="modal-close" onclick="closeModal('hrManageProjectModal')">×</button>
            <div class="modal-header-modern">
                <h2>🏢 Manage Project — ${project.name}</h2>
                <p>${project.code} · Add or remove departments assigned to this project</p>
            </div>

            <!-- REMOVE SECTION -->
            <div class="manage-section">
                <div class="manage-section-title">
                    <span class="manage-section-icon" style="background:rgba(239,68,68,0.12);color:#EF4444">🗑️</span>
                    <div>
                        <div style="font-weight:700;font-size:0.95rem">Assigned Departments</div>
                        <div style="font-size:0.8rem;color:var(--text-secondary)">Remove departments from this project</div>
                    </div>
                    <span class="badge badge-${assignedDepts.length?'success':'warning'}" style="margin-left:auto">${assignedDepts.length} assigned</span>
                </div>
                <div class="manage-member-list" id="hrCurrentDepts">
                    ${removeSection}
                </div>
            </div>

            <!-- ADD SECTION -->
            <div class="manage-section" style="border-top:2px solid var(--border);margin-top:0.25rem;padding-top:1.25rem">
                <div class="manage-section-title">
                    <span class="manage-section-icon" style="background:rgba(16,185,129,0.12);color:#10B981">➕</span>
                    <div>
                        <div style="font-weight:700;font-size:0.95rem">Add Department</div>
                        <div style="font-size:0.8rem;color:var(--text-secondary)">Only unassigned departments are shown</div>
                    </div>
                </div>
                ${addSection}
            </div>

            <div class="assign-modal-footer">
                <button class="btn btn-secondary" onclick="closeModal('hrManageProjectModal')">Done</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}

async function hrRemoveDeptFromProject(projectId, deptName) {
    try {
        const proj = allProjects.find(p => parseInt(p.id) === parseInt(projectId)) || {};
        const existing = (proj?.department_name || proj?.departmentName || '')
            .split(',').map(s => s.trim()).filter(Boolean);
        const remaining = existing.filter(d => d !== deptName);
        const newDept = remaining.join(', ');
        const newStatus = remaining.length ? 'active' : 'unassigned';
        await api('PUT', `/projects/${projectId}`, {
            name:           proj.name,
            status:         newStatus,
            priority:       proj.priority || 'medium',
            departmentName: newDept,
            description:    proj.description || proj.name || '',
            requestorId:    currentUser?.id,
            requestorName:  currentUser?.name
        });
        showToast(`${deptName} removed ✓`);
        const projRes = await api('GET', '/projects');
        allProjects = projRes.data || allProjects;
        closeModal('hrManageProjectModal');
        await openHRManageProjectModal(projectId);
    } catch (e) {
        showToast(`Failed to remove: ${e.message}`, 'error');
    }
}

async function hrAddDeptToProject(projectId) {
    const deptName = document.getElementById('hrAddDeptSelect')?.value;
    if (!deptName) { showToast('Please select a department ⚠️', 'error'); return; }
    try {
        const proj = allProjects.find(p => parseInt(p.id) === parseInt(projectId)) || {};
        const existing = (proj?.department_name || proj?.departmentName || '')
            .split(',').map(s => s.trim()).filter(Boolean);
        if (existing.includes(deptName)) { showToast(`${deptName} already assigned`, 'error'); return; }
        const merged = [...existing, deptName].join(', ');
        // Send full project payload to avoid @NotNull validation failures on PUT
        // ProjectService.update reads camelCase Map keys (not SNAKE_CASE)
        await api('PUT', `/projects/${projectId}`, {
            name:           proj.name,
            status:         'active',
            priority:       proj.priority || 'medium',
            departmentName: merged,
            description:    proj.description || proj.name || '',
            requestorId:    currentUser?.id,
            requestorName:  currentUser?.name
        });
        showToast(`${deptName} added ✓`);
        const projRes = await api('GET', '/projects');
        allProjects = projRes.data || allProjects;
        closeModal('hrManageProjectModal');
        await openHRManageProjectModal(projectId);
    } catch (e) {
        showToast(`Failed to add: ${e.message}`, 'error');
    }
}

async function renderEmployeeTracking() {
    const container = document.getElementById('employeeTrackingBody');
    if (!container) return;
    setLoading('employeeTrackingBody', 'Loading employee data…');

    // Fresh fetch from DB
    const res = await api('GET', '/users', { role: 'employee' }).catch(()=>({ data:[] }));
    const employees = res.data || [];
    allUsers = [...allUsers.filter(u=>u.role!=='employee'), ...employees];

    // Populate dept dropdown from real DB departments
    populateDeptFilter('empTrackDept', allDepartments);

    let filtered = [...employees];
    const search = document.getElementById('empTrackSearch')?.value?.toLowerCase() || '';
    const dept   = document.getElementById('empTrackDept')?.value   || 'all';
    const status = document.getElementById('empTrackStatus')?.value || 'all';
    const sort   = document.getElementById('empTrackSort')?.value   || 'name';

    if (search) filtered = filtered.filter(e=>
        e.name.toLowerCase().includes(search) ||
        (e.employeeId||e.employee_id||'').toLowerCase().includes(search));
    if (dept   !== 'all') filtered = filtered.filter(e=>(e.departmentName||e.department_name)===dept);
    if (status !== 'all') filtered = filtered.filter(e=>e.status===status);
    filtered.sort((a,b)=>{
        if (sort==='name')        return a.name.localeCompare(b.name);
        if (sort==='performance') return (b.performanceScore||b.performance_score||0)-(a.performanceScore||a.performance_score||0);
        if (sort==='workload')    return (b.workload||0)-(a.workload||0);
        return 0;
    });

    const wc = w => w>=75?'danger':w>=50?'warning':'success';
    container.innerHTML = filtered.map(e=>`
        <tr>
            <td><div class="emp-cell"><div class="emp-avatar-sm">${e.avatarInitials||e.avatar_initials||initials(e.name)}</div><div><div class="emp-name">${e.name}</div><div class="emp-id">${e.employeeId||e.employee_id||'—'}</div></div></div></td>
            <td>${e.email||'—'}</td>
            <td>${e.departmentName||e.department_name||'—'}</td>
            <td><div style="display:flex;align-items:center;gap:0.5rem"><div class="progress-bar" style="width:80px;flex:none"><div class="progress-fill" style="width:${e.workload||0}%;background:var(--${wc(e.workload||0)})"></div></div><span>${e.workload||0}%</span></div></td>
            <td><span class="badge badge-${(e.performanceScore||e.performance_score||0)>=90?'success':(e.performanceScore||e.performance_score||0)>=75?'warning':'danger'}">${e.performanceScore||e.performance_score||0}%</span></td>
            <td><span class="badge badge-${e.status==='active'?'success':'danger'}">${e.status}</span></td>
            <td>${formatTime(e.lastLogin||e.last_login)||'Never'}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-secondary" onclick="viewEmployeeDetail(${e.id},'hr')" title="View Profile">👁️</button>
                    <button class="btn btn-sm btn-success"   onclick="openMessageModal(${e.id})"        title="Send Message">💬</button>
                    <button class="btn btn-sm btn-secondary" onclick="exportEmployeeReport(${e.id})"   title="Export Report">📥</button>
                </div>
            </td>
        </tr>`).join('');

    if (!filtered.length)
        container.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-secondary);padding:2rem">No employees found</td></tr>';
}

async function renderHRProjects() {
    const container = document.getElementById('hrProjectsGrid');
    if (!container) return;
    setLoading('hrProjectsGrid', 'Loading projects…');
    const res = await api('GET', '/projects').catch(()=>({ data:[] }));
    allProjects = res.data || [];
    let projects = [...allProjects];
    const search  = document.getElementById('hrProjectSearch')?.value?.toLowerCase() || '';
    const status  = document.getElementById('hrProjectStatus')?.value || 'all';
    const urgency = document.getElementById('hrProjectUrgency')?.value || 'all';
    const sort    = document.getElementById('hrProjectSort')?.value   || 'name';
    if (search)         projects = projects.filter(p=>p.name.toLowerCase().includes(search)||p.code.toLowerCase().includes(search));
    if (status!=='all') projects = projects.filter(p=>p.status===status);
    if (urgency!=='all')projects = projects.filter(p=>p.urgency===urgency);
    projects.sort((a,b)=>{
        if (sort==='name')     return a.name.localeCompare(b.name);
        if (sort==='date')     return new Date(a.deadline)-new Date(b.deadline);
        if (sort==='priority') { const pr={critical:4,high:3,medium:2,low:1}; return (pr[b.priority]||0)-(pr[a.priority]||0); }
        return 0;
    });
    const statusColor = { active:'success', completed:'info', delayed:'danger', unassigned:'warning' };
    container.innerHTML = projects.map(p=>{
        const depts      = getProjectDepts(p);
        const isAssigned = p.status !== 'unassigned';
        const sc = statusColor[p.status] || 'info';
        return `
        <div class="hr-project-card">
            <div class="hpc-header">
                <div><div class="hpc-code">${p.code}</div><div class="hpc-name">${p.name}</div></div>
                <span class="badge badge-${sc}">${p.status}</span>
            </div>
            <div class="hpc-meta">
                <span class="badge badge-${p.urgency==='high'?'danger':p.urgency==='medium'?'warning':'success'}">${p.urgency}</span>
                <span class="badge badge-${p.priority==='critical'?'danger':p.priority==='high'?'warning':'info'}">${p.priority}</span>
                <span>📅 ${p.deadline}</span>
            </div>
            <div class="hpc-stats">
                <span>🏢 ${isAssigned && depts.length ? depts.join(', ') : '—'}</span>
                <span>📊 ${p.progress}%</span>
            </div>
            <div class="hpc-actions">
                <button class="btn btn-sm btn-secondary" onclick="openProjectDetail(${p.id},'hr')">👁️ View</button>
                ${isAssigned
                    ? `<button class="btn btn-sm btn-success btn-glow" onclick="openHRManageProjectModal(${p.id})">⚙️ Manage Project</button>`
                    : `<button class="btn btn-sm btn-primary btn-glow" onclick="goToAssignProject(${p.id})">📋 Assign Project</button>`}
            </div>
        </div>`}).join('') || '<div class="empty-state"><div class="empty-icon">📁</div><p>No projects found</p></div>';
}

function filterHRProjects()     { renderHRProjects(); }
function filterAssignmentProjects() { renderAssignmentProjects(); }
function filterEmployeeTracking()   { renderEmployeeTracking(); }

// ============================================================
//  ADMIN DASHBOARD
// ============================================================
async function initAdminDashboard(user) {
    document.getElementById('adminName').textContent = user.name || 'Admin';
    try {
        const [projRes, userRes, deptRes] = await Promise.all([
            api('GET', '/projects'),
            api('GET', '/users'),
            api('GET', '/departments')
        ]);
        allProjects    = projRes.data || [];
        allUsers       = userRes.data || [];
        allDepartments = deptRes.data || [];
    } catch { showToast('Failed to load admin data', 'error'); }

    // Populate all dept dropdowns from real DB data
    populateDeptFilter('userDeptFilter',   allDepartments);
    populateDeptFilter('adminProjDept',    allDepartments, true); // true = "All" label

    renderAdminStats();
    renderAdminOverviewCharts();

    // Record admin login in audit log
    try {
        await api('POST', '/activities', {
            userId: user.id, personName: user.name,
            action: `Admin ${user.name} logged into system administration portal`,
            activityDate: new Date().toISOString().split('T')[0], type: 'login'
        });
    } catch {}
    // Store session start in localStorage for logout duration calculation
    if (!localStorage.getItem('spms_session_start')) {
        localStorage.setItem('spms_session_start', new Date().toISOString());
        localStorage.setItem('spms_session_user',  String(user.id));
    }
}

function renderAdminStats() {
    const el = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
    const tr = (id,cls,txt) => { const e=document.getElementById(id); if(!e)return; e.className=`stat-trend stat-trend-${cls}`; e.textContent=txt; };

    const totalUsers   = allUsers.length;
    const activeProj   = allProjects.filter(p=>p.status==='active').length;
    const deptCount    = allDepartments.length;
    const unreadNotifs = notificationsList.filter(n=>!n.is_read).length;

    // New users this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
    const newThisMonth = allUsers.filter(u=>(u.joinDate||u.join_date||'') >= monthStart).length;

    el('adminStatUsers',   totalUsers);
    el('adminStatProjects',activeProj);
    el('adminStatDepts',   deptCount);
    el('adminStatPending', unreadNotifs);

    tr('adminStatUsersTrend',   'up',     `↗ ${newThisMonth} new this month`);
    tr('adminStatProjectsTrend',activeProj>0?'neutral':'down', activeProj>0?'→ Ongoing':'— None active');
    tr('adminStatDeptsTrend',   'neutral','→ No change');
    tr('adminStatPendingTrend', unreadNotifs>0?'down':'up', unreadNotifs>0?`↘ ${unreadNotifs} need review`:'↗ All clear');
}

function renderAdminOverviewCharts() {
    if (charts.adminSystemChart) charts.adminSystemChart.destroy();
    const ctx = document.getElementById('adminSystemChart')?.getContext('2d');
    if (ctx) {
        // Build last-6-months labels and count new users / projects started per month
        const months = [];
        const newUsers = [];
        const newProjects = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
            months.push(d.toLocaleString('default',{month:'short'}));
            newUsers.push(allUsers.filter(u=>(u.joinDate||u.join_date||'').startsWith(ym)).length);
            newProjects.push(allProjects.filter(p=>(p.startDate||p.start_date||p.createdAt||p.created_at||'').startsWith(ym)).length);
        }
        charts.adminSystemChart = new Chart(ctx, {
            type:'bar',
            data:{ labels:months, datasets:[
                { label:'New Users',       data:newUsers,    backgroundColor:'rgba(99,102,241,0.7)', borderRadius:4 },
                { label:'Projects Started',data:newProjects, backgroundColor:'rgba(16,185,129,0.7)', borderRadius:4 }
            ]},
            options:{ responsive:true, scales:{ y:{ beginAtZero:true, ticks:{ stepSize:1 } } } }
        });
    }
    if (charts.adminRoleChart) charts.adminRoleChart.destroy();
    const ctx2 = document.getElementById('adminRoleChart')?.getContext('2d');
    if (ctx2) {
        charts.adminRoleChart = new Chart(ctx2, {
            type:'doughnut',
            data:{ labels:['Employee','Manager','HR','Admin'], datasets:[{ data:[
                allUsers.filter(u=>u.role==='employee').length,
                allUsers.filter(u=>u.role==='manager').length,
                allUsers.filter(u=>u.role==='hr').length,
                allUsers.filter(u=>u.role==='admin').length
            ], backgroundColor:['#6366F1','#10B981','#F59E0B','#EF4444'] }] },
            options:{ responsive:true, cutout:'60%', plugins:{ legend:{ position:'bottom' } } }
        });
    }
}

async function renderUserManagement() {
    const container = document.getElementById('userTableBody');
    if (!container) return;
    const res = await api('GET', '/users').catch(()=>({ data:[] }));
    allUsers = res.data || [];
    // Populate dept dropdown from real DB departments
    populateDeptFilter('userDeptFilter', allDepartments);
    let users = [...allUsers];
    const search = document.getElementById('userSearch')?.value?.toLowerCase()    || '';
    const roleF  = document.getElementById('userRoleFilter')?.value               || 'all';
    const deptF  = document.getElementById('userDeptFilter')?.value               || 'all';
    const statF  = document.getElementById('userStatusFilter')?.value             || 'all';
    if (search) users = users.filter(u=>u.name.toLowerCase().includes(search)||(u.employeeId||u.employee_id||'').toLowerCase().includes(search)||u.email.toLowerCase().includes(search));
    if (roleF !== 'all') users = users.filter(u=>u.role===roleF);
    if (deptF !== 'all') users = users.filter(u=>(u.departmentName||u.department_name)===deptF);
    if (statF !== 'all') users = users.filter(u=>u.status===statF);
    container.innerHTML = users.map(u=>`
        <tr>
            <td><div class="emp-cell"><div class="emp-avatar-sm">${u.avatarInitials||u.avatar_initials||initials(u.name)}</div><div><div class="emp-name">${u.name}</div><div class="emp-id">${u.employeeId||u.employee_id}</div></div></div></td>
            <td>${u.email}</td>
            <td><span class="badge badge-${u.role==='admin'?'danger':u.role==='manager'?'primary':u.role==='hr'?'warning':'info'}">${u.role}</span></td>
            <td>${u.departmentName||u.department_name||'—'}</td>
            <td><label class="toggle-switch"><input type="checkbox" ${u.status==='active'?'checked':''} onchange="toggleUserStatus(${u.id},this)"><span class="toggle-slider"></span></label></td>
            <td><span class="badge badge-${u.status==='active'?'success':'danger'}">${u.status}</span></td>
            <td>${formatTime(u.lastLogin||u.last_login)||'Never'}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-secondary" onclick="openEditUserModal(${u.id})" title="Edit">✏️</button>
                    <button class="btn btn-sm btn-danger"    onclick="confirmDeleteUser(${u.id})" title="Delete">🗑️</button>
                    <button class="btn btn-sm btn-primary"   onclick="viewEmployeeDetail(${u.id},'admin')" title="View">👁️</button>
                </div>
            </td>
        </tr>`).join('');
    if (!users.length) container.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-secondary);padding:2rem">No users found</td></tr>';
}

function filterUserManagement() { renderUserManagement(); }

async function toggleUserStatus(userId, checkbox) {
    const newStatus = checkbox.checked ? 'active' : 'inactive';
    try {
        await api('PUT', `/users/${userId}/status`, { status: newStatus });
        const u = allUsers.find(e=>e.id===userId);
        if (u) u.status = newStatus;
        showToast(`User status set to ${newStatus} ✓`);
        renderUserManagement();
    } catch (e) {
        showToast(`Failed: ${e.message}`, 'error');
        checkbox.checked = !checkbox.checked;
    }
}

function openAddUserModal() { document.getElementById('addUserModal')?.classList.add('active'); }

async function openEditUserModal(userId) {
    // GET /users/{id} returns { data: { user: {...}, dailyActivities: [...] } }
    const res = await api('GET', `/users/${userId}`).catch(()=>null);
    // Extract nested user object — fall back to allUsers list
    const user = res?.data?.user || res?.data || allUsers.find(e => parseInt(e.id) === parseInt(userId));
    if (!user) { showToast('Could not load user data', 'error'); return; }

    const modal = document.getElementById('editUserModal');
    if (!modal) return;

    // Use fallbacks for all fields so existing values always show
    const sv = (id, v) => { const el = document.getElementById(id); if (el) el.value = (v != null && v !== undefined) ? String(v) : ''; };
    sv('editUserId',          user.id);
    sv('editUserName',        user.name || '');
    sv('editUserEmail',       user.email || '');
    // role: use the value from API (snake_case serialised, so field is "role")
    const roleEl = document.getElementById('editUserRole');
    if (roleEl) roleEl.value = user.role || 'employee';
    sv('editUserDept',        user.departmentName || user.department_name || '');
    // performance_score and hours_per_week come as snake_case from the API
    sv('editUserPerformance', user.performance_score ?? user.performanceScore ?? '');
    sv('editUserHours',       user.hours_per_week   ?? user.hoursPerWeek   ?? '');
    sv('editUserPassword',    ''); // always blank for security
    // skills stored as JSON string in DB, parse to comma-separated for display
    sv('editUserSkills', parseSkills(user.skills).join(', '));

    modal.classList.add('active');
}

async function handleAddUser(event) {
    event.preventDefault();
    const name         = document.getElementById('newUserName')?.value?.trim();
    const email        = document.getElementById('newUserEmail')?.value?.trim();
    const role         = document.getElementById('newUserRole')?.value;
    const dept         = document.getElementById('newUserDept')?.value?.trim();
    const username     = document.getElementById('newUserUsername')?.value?.trim() || email?.split('@')[0];
    const password     = document.getElementById('newUserPassword')?.value || 'password';
    const joinDate     = document.getElementById('newUserJoinDate')?.value || new Date().toISOString().split('T')[0];
    const hoursPerWeek = parseInt(document.getElementById('newUserHours')?.value || '40');
    const perfScore    = parseInt(document.getElementById('newUserPerformance')?.value || '80');
    const skillsRaw    = document.getElementById('newUserSkills')?.value?.trim() || '';
    const skills       = skillsRaw ? skillsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (!name || !email || !role || !dept) { showToast('Please fill in all required fields ❌', 'error'); return; }
    try {
        await api('POST', '/users', {
            name, email, role,
            departmentName:  dept,
            department_name: dept,
            username, password,
            joinDate,
            join_date:        joinDate,
            hoursPerWeek,
            hours_per_week:   hoursPerWeek,
            performanceScore: perfScore,
            performance_score: perfScore,
            skills: skills   // send as array; backend stores as JSON column
        });
        closeModal('addUserModal');
        // Clear the form fields
        ['newUserName','newUserEmail','newUserRole','newUserDept','newUserUsername',
         'newUserPassword','newUserJoinDate','newUserHours','newUserPerformance','newUserSkills'
        ].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
        // Refetch fresh from DB
        const fresh = await api('GET', '/users').catch(()=>({ data:allUsers }));
        allUsers = fresh.data || allUsers;
        renderUserManagement();
        renderAdminStats();
        showToast(`User ${name} created successfully ✓`);
    } catch (e) {
        showToast(`Failed to create user: ${e.message}`, 'error');
    }
}

async function handleEditUser(event) {
    event.preventDefault();
    const id       = parseInt(document.getElementById('editUserId')?.value);
    const name     = document.getElementById('editUserName')?.value?.trim();
    const email    = document.getElementById('editUserEmail')?.value?.trim();
    const role     = document.getElementById('editUserRole')?.value;
    const dept     = document.getElementById('editUserDept')?.value?.trim();
    const perfRaw  = document.getElementById('editUserPerformance')?.value?.trim();
    const hoursRaw = document.getElementById('editUserHours')?.value?.trim();
    const skillsRaw= document.getElementById('editUserSkills')?.value?.trim() || '';

    // Validate before sending (invalid id causes Spring 400 NumberFormatException)
    if (!id || isNaN(id)) { showToast('Invalid user ID — close and re-open the modal', 'error'); return; }
    if (!name)             { showToast('Name is required', 'error'); return; }
    if (!email)            { showToast('Email is required', 'error'); return; }
    if (!role)             { showToast('Role is required', 'error'); return; }

    // Resolve existing user values (fallbacks for unchanged fields)
    const ex = allUsers.find(u => parseInt(u.id) === id) || {};
    const hoursVal = hoursRaw ? parseInt(hoursRaw) : (ex.hours_per_week  ?? ex.hoursPerWeek  ?? 40);
    const perfVal  = perfRaw  ? parseInt(perfRaw)  : (ex.performance_score ?? ex.performanceScore ?? 80);
    const deptVal  = dept || ex.department_name || ex.departmentName || '';

    // UserController reads Map<String,Object> with LITERAL camelCase keys
    const payload = {
        name,
        email,
        role,
        departmentName:   deptVal,
        workload:         typeof ex.workload === 'number' ? ex.workload : 0,
        hoursPerWeek:     hoursVal,
        performanceScore: perfVal,
        requestorId:      currentUser?.id,
        requestorName:    currentUser?.name || 'Admin'
    };

    try {
        const res = await api('PUT', `/users/${id}`, payload);
        // Controller wraps errors in {success:false} with HTTP 200 — check both
        if (res?.success === false) throw new Error(res.message || 'Update rejected by server');

        // Refresh user list from DB
        const fresh = await api('GET', '/users').catch(() => ({ data: allUsers }));
        allUsers = fresh.data || allUsers;
        closeModal('editUserModal');
        renderUserManagement();
        renderAdminStats();
        showToast(`${name} updated ✓`);
    } catch(e) {
        showToast(`Update failed: ${e.message}`, 'error');
    }
}

function confirmDeleteUser(userId) {
    const user = allUsers.find(e=>e.id===userId);
    if (!user) return;
    if (confirm(`Delete "${user.name}"? This cannot be undone.`)) deleteUser(userId);
}

async function deleteUser(userId) {
    try {
        await api('DELETE', `/users/${userId}`, { requestorId: currentUser?.id, requestorName: currentUser?.name });
        // Refetch from DB
        const fresh = await api('GET', '/users').catch(()=>({ data: allUsers.filter(e=>e.id!==userId) }));
        allUsers = fresh.data || allUsers;
        renderUserManagement();
        renderAdminStats();
        showToast('User deleted ✓');
    } catch (e) {
        showToast(`Delete failed: ${e.message}`, 'error');
    }
}

async function renderAdminProjects() {
    const container = document.getElementById('adminProjectsTableBody');
    if (!container) return;
    const res = await api('GET', '/projects').catch(()=>({ data:[] }));
    allProjects = res.data || [];
    // Populate dept dropdown from real DB departments
    populateDeptFilter('adminProjDept', allDepartments, true);
    let projects = [...allProjects];
    const search = document.getElementById('adminProjSearch')?.value?.toLowerCase() || '';
    const status = document.getElementById('adminProjStatus')?.value || 'all';
    const dept   = document.getElementById('adminProjDept')?.value   || 'all';
    if (search) projects = projects.filter(p=>p.name.toLowerCase().includes(search)||p.code.toLowerCase().includes(search));
    if (status !== 'all') projects = projects.filter(p=>p.status===status);
    if (dept   !== 'all') projects = projects.filter(p=>(p.departmentName||p.department_name)===dept);
    const sc = { active:'success', completed:'info', delayed:'danger', unassigned:'warning', archived:'secondary' };
    // Fetch team counts per project from assignments endpoint
    let teamCounts = {};
    try {
        const aRes = await api('GET', '/assignments').catch(()=>null);
        if (aRes?.data) {
            aRes.data.forEach(a => {
                const pid = a.projectId || a.project_id;
                teamCounts[pid] = (teamCounts[pid] || 0) + 1;
            });
        }
    } catch {}
    container.innerHTML = projects.map(p => {
        const teamCount = teamCounts[p.id] ?? (p.team||[]).length;
        const isArchived = p.status === 'archived';
        return `
        <tr>
            <td>${p.code}</td>
            <td>${p.name}</td>
            <td>${p.departmentName||p.department_name||'—'}</td>
            <td><span class="badge badge-${sc[p.status]||'info'}">${p.status}</span></td>
            <td><span class="badge badge-${p.priority==='critical'?'danger':p.priority==='high'?'warning':'info'}">${p.priority}</span></td>
            <td><div class="progress-bar" style="width:80px;display:inline-block"><div class="progress-fill" style="width:${p.progress}%"></div></div> ${p.progress}%</td>
            <td>${p.deadline||'—'}</td>
            <td>${teamCount}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-secondary" onclick="openEditProjectModal(${p.id})" title="Edit">✏️</button>
                    <button class="btn btn-sm btn-warning"   onclick="archiveProject(${p.id})"       title="${isArchived?'Unarchive':'Archive'}">${isArchived?'📤':'📦'}</button>
                    <button class="btn btn-sm btn-danger"    onclick="confirmDeleteProject(${p.id})" title="Delete">🗑️</button>
                </div>
            </td>
        </tr>`;
    }).join('');
    if (!projects.length) container.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-secondary);padding:2rem">No projects found</td></tr>';
}

function filterAdminProjects() { renderAdminProjects(); }
function openAddProjectModal() {
    const modal = document.getElementById('addProjectModal');
    if (!modal) return;
    // Populate department dropdown from real DB data (replaces hardcoded options)
    populateDeptFilter('newProjectDept', allDepartments);
    modal.classList.add('active');
}

async function openEditProjectModal(id) {
    const proj = allProjects.find(p=>p.id===id);
    if (!proj) return;
    const modal = document.getElementById('editProjectModal');
    if (!modal) return;
    const sv = (elId,v) => { const el=document.getElementById(elId); if(el) el.value=v||''; };
    sv('editProjectId',       proj.id);
    sv('editProjectName',     proj.name);
    sv('editProjectDesc',     proj.description||'');
    sv('editProjectStatus',   proj.status);
    sv('editProjectPriority', proj.priority);
    sv('editProjectUrgency',  proj.urgency||'medium');
    sv('editProjectDeadline', proj.deadline);
    // Populate dept dropdown from real DB data then set current value
    populateDeptFilter('editProjectDept', allDepartments);
    sv('editProjectDept', proj.departmentName||proj.department_name||'');
    modal.classList.add('active');
}

async function handleAddProject(event) {
    event.preventDefault();
    const name     = document.getElementById('newProjectName')?.value?.trim();
    const desc     = document.getElementById('newProjectDesc')?.value?.trim();
    const dept     = document.getElementById('newProjectDept')?.value?.trim();
    const priority = document.getElementById('newProjectPriority')?.value || 'medium';
    const urgency  = document.getElementById('newProjectUrgency')?.value  || 'medium';
    const deadline = document.getElementById('newProjectEnd')?.value;
    if (!name || !deadline) { showToast('Name and deadline are required ❌', 'error'); return; }
    try {
        await api('POST', '/projects', { name, description: desc, departmentName: dept, priority, urgency, deadline, requestorId: currentUser?.id, requestorName: currentUser?.name });
        closeModal('addProjectModal');
        ['newProjectName','newProjectDesc','newProjectEnd'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
        const deptSel = document.getElementById('newProjectDept'); if(deptSel) deptSel.selectedIndex=0;
        const fresh = await api('GET', '/projects').catch(()=>({ data:allProjects }));
        allProjects = fresh.data || allProjects;
        renderAdminProjects();
        renderAdminStats();
        showToast(`Project "${name}" created ✓`);
    } catch (e) {
        showToast(`Failed to create project: ${e.message}`, 'error');
    }
}

async function handleEditProject(event) {
    event.preventDefault();
    const id       = parseInt(document.getElementById('editProjectId')?.value);
    const name     = document.getElementById('editProjectName')?.value?.trim();
    const desc     = document.getElementById('editProjectDesc')?.value?.trim();
    const status   = document.getElementById('editProjectStatus')?.value;
    const priority = document.getElementById('editProjectPriority')?.value;
    const urgency  = document.getElementById('editProjectUrgency')?.value;
    const deadline = document.getElementById('editProjectDeadline')?.value;
    const dept     = document.getElementById('editProjectDept')?.value?.trim();
    try {
        await api('PUT', `/projects/${id}`, { name, status, priority, urgency, deadline, departmentName: dept, description: desc, requestorId: currentUser?.id, requestorName: currentUser?.name });
        const fresh = await api('GET', '/projects').catch(()=>({ data:allProjects }));
        allProjects = fresh.data || allProjects;
        closeModal('editProjectModal');
        renderAdminProjects();
        renderAdminStats();
        showToast(`Project "${name}" updated ✓`);
    } catch (e) {
        showToast(`Update failed: ${e.message}`, 'error');
    }
}

async function archiveProject(id) {
    const p = allProjects.find(p=>p.id===id);
    if (!p) return;
    const isArchived = p.status === 'archived';
    const newStatus  = isArchived ? 'active' : 'archived';
    const label      = isArchived ? 'Unarchive' : 'Archive';
    if (!confirm(`${label} project "${p.name}"?`)) return;
    try {
        await api('PUT', `/projects/${id}`, { status: newStatus, name: p.name, requestorId: currentUser?.id, requestorName: currentUser?.name });
        const fresh = await api('GET', '/projects').catch(()=>({ data:allProjects }));
        allProjects = fresh.data || allProjects;
        renderAdminProjects();
        renderAdminStats();
        showToast(`Project ${label.toLowerCase()}d ✓`);
    } catch (e) {
        showToast(`Failed: ${e.message}`, 'error');
    }
}

function confirmDeleteProject(id) {
    const p = allProjects.find(p=>p.id===id);
    if (!p) return;
    if (confirm(`Delete project "${p.name}"? All assignments, files and comments will be deleted.`)) deleteProject(id);
}

async function deleteProject(id) {
    try {
        await api('DELETE', `/projects/${id}`, { requestorId: currentUser?.id, requestorName: currentUser?.name });
        const fresh = await api('GET', '/projects').catch(()=>({ data: allProjects.filter(p=>p.id!==id) }));
        allProjects = fresh.data || allProjects;
        renderAdminProjects();
        renderAdminStats();
        showToast('Project deleted ✓');
    } catch (e) {
        showToast(`Delete failed: ${e.message}`, 'error');
    }
}

// cache for filter
let _auditCache = [];

async function renderAuditLog() {
    const tbody = document.getElementById('auditLogBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:1.5rem"><div class="spinner" style="width:20px;height:20px;margin:0 auto"></div></td></tr>';
    try {
        const res = await api('GET', '/audit-log');
        _auditCache = res.data || [];
        filterAuditLog();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--danger);padding:2rem">Failed to load: ${e.message}</td></tr>`;
    }
}

function filterAuditLog() {
    const tbody  = document.getElementById('auditLogBody');
    if (!tbody) return;
    const search = document.getElementById('auditSearch')?.value?.toLowerCase()  || '';
    const type   = document.getElementById('auditTypeFilter')?.value             || 'all';
    const date   = document.getElementById('auditDateFilter')?.value             || '';
    let logs = [..._auditCache];
    if (search) logs = logs.filter(l=>(l.action||'').toLowerCase().includes(search)||(l.userName||l.user_name||'').toLowerCase().includes(search));
    if (type !== 'all') logs = logs.filter(l=>l.type===type);
    if (date) logs = logs.filter(l=>(l.createdAt||l.created_at||'').startsWith(date));
    const tc = { create:'success', update:'info', delete:'danger', assign:'primary', login:'secondary', logout:'secondary', upload:'warning', system:'info', config:'warning', report:'success', permission:'danger', revoke:'danger' };
    tbody.innerHTML = logs.map(l=>`
        <tr>
            <td style="font-size:0.8rem;color:var(--text-secondary);white-space:nowrap">${formatTime(l.createdAt||l.created_at)}</td>
            <td><strong>${l.userName||l.user_name||'System'}</strong></td>
            <td>${l.action||'—'}</td>
            <td><span class="badge badge-${tc[l.type]||'info'}">${l.type||'—'}</span></td>
        </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text-secondary);padding:2rem">No audit logs found</td></tr>';
}

async function renderSystemHealth() {
    const container = document.getElementById('systemHealthContainer');
    if (!container) return;
    setLoading('systemHealthContainer', 'Checking system health…');
    try {
        const res = await api('GET', '/system/health');
        const h = res.data || {};
        container.innerHTML = `
            <div class="health-grid">
                <div class="health-card ${h.database==='OK'?'health-ok':'health-warn'}"><div class="health-icon">🗄️</div><div class="health-info"><div class="health-label">Database</div><div class="health-value">${h.database||'MySQL'}</div></div><span class="badge badge-${h.database==='OK'?'success':'danger'}">${h.database||'Unknown'}</span></div>
                <div class="health-card health-ok"><div class="health-icon">⬆️</div><div class="health-info"><div class="health-label">Uptime</div><div class="health-value">${h.uptime||'—'}</div></div><span class="badge badge-success">Active</span></div>
                <div class="health-card health-ok"><div class="health-icon">👥</div><div class="health-info"><div class="health-label">Total Users</div><div class="health-value">${h.totalUsers||allUsers.length}</div></div></div>
                <div class="health-card health-ok"><div class="health-icon">📁</div><div class="health-info"><div class="health-label">Total Projects</div><div class="health-value">${h.totalProjects||allProjects.length}</div></div></div>
                <div class="health-card health-ok"><div class="health-icon">📎</div><div class="health-info"><div class="health-label">Uploaded Files</div><div class="health-value">${h.totalFiles||'—'}</div></div></div>
                <div class="health-card health-ok"><div class="health-icon">💾</div><div class="health-info"><div class="health-label">App Version</div><div class="health-value">${h.version||'2.0.0'}</div></div></div>
            </div>`;
    } catch (e) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>Could not reach backend: ${e.message}</p></div>`;
    }
}

async function loadAdminSettings() {
    try {
        const res = await api('GET', '/settings');
        const s = res.data || {};
        const sv  = (id,v) => { const el=document.getElementById(id); if(el) el.value=v||''; };
        const stb = (id,v) => { const el=document.getElementById(id); if(el) el.checked=(v==='true'||v===true); };
        sv('settingCompany',         s.company_name                 || 'TechCorp Solutions');
        sv('settingMaxProjects',     s.max_projects_per_employee    || '5');
        sv('settingWorkHours',       s.work_hours_per_day           || '8');
        sv('settingSessionTimeout',  s.session_timeout              || '60');
        stb('settingEmailNotif',     s.email_notifications);
        stb('settingDeadlineRemind', s.deadline_reminders           || 'true');
        stb('settingWorkloadAlert',  s.workload_alerts              || 'true');
        stb('settingAutoReport',     s.auto_daily_report);
    } catch {}
}

async function saveSettings(event) {
    event.preventDefault();
    const gb = (id) => document.getElementById(id)?.checked ? 'true' : 'false';
    const settings = {
        company_name:               document.getElementById('settingCompany')?.value        || 'TechCorp Solutions',
        max_projects_per_employee:  document.getElementById('settingMaxProjects')?.value    || '5',
        work_hours_per_day:         document.getElementById('settingWorkHours')?.value      || '8',
        session_timeout:            document.getElementById('settingSessionTimeout')?.value || '60',
        email_notifications:        gb('settingEmailNotif'),
        deadline_reminders:         gb('settingDeadlineRemind'),
        workload_alerts:            gb('settingWorkloadAlert'),
        auto_daily_report:          gb('settingAutoReport')
    };
    try {
        await api('POST', '/settings', { settings, requestorId: currentUser?.id, requestorName: currentUser?.name });
        showToast('Settings saved to database ✓');
    } catch (e) {
        showToast(`Save failed: ${e.message}`, 'error');
    }
}

async function resetSettingsToDefaults() {
    if (!confirm('Reset all settings to system defaults? This cannot be undone.')) return;
    const defaults = {
        company_name:'TechCorp Solutions', max_projects_per_employee:'5',
        work_hours_per_day:'8', session_timeout:'60',
        email_notifications:'true', deadline_reminders:'true',
        workload_alerts:'true', auto_daily_report:'false'
    };
    try {
        await api('POST', '/settings', { settings: defaults, requestorId: currentUser?.id, requestorName: currentUser?.name });
        await loadAdminSettings();
        showToast('Settings reset to defaults ✓');
    } catch (e) {
        showToast(`Reset failed: ${e.message}`, 'error');
    }
}

// ── Stat Detail Modal ────────────────────────────────────────
function showStatDetail(role, type) {
    const modal   = document.getElementById('statDetailModal');
    const title   = document.getElementById('statDetailTitle');
    const content = document.getElementById('statDetailContent');
    if (!modal || !content) return;
    const detailData = {
        'employee-active-projects':  { title:'Active Projects',   items: allProjects.filter(p=>p.status==='active').map(p=>`<div class="stat-detail-item"><span class="badge badge-success">${p.code}</span> ${p.name} — ${p.progress}% complete · due ${p.deadline}</div>`) },
        'employee-tasks-completed':  {
            title:'Tasks Completed This Month',
            items: empDashStats.monthActivities?.length
                ? empDashStats.monthActivities.map(a => {
                    const d       = a.activityDate||a.activity_date||'';
                    const tasks   = parseInt(a.tasksDone||a.tasks_done||0);
                    const commits = parseInt(a.commits||0);
                    const hrs     = parseFloat(a.hoursWorked||a.hours_worked||0);
                    const stress  = a.stressLevel||a.stress_level||'low';
                    const sIcon   = stress==='high'?'🔴':stress==='medium'?'🟡':'🟢';
                    return `<div class="stat-detail-item">📅 <strong>${d}</strong> — ${tasks} tasks · ${commits} commits · ${hrs}h ${sIcon}</div>`;
                  })
                : allProjects.map(p=>`<div class="stat-detail-item">✅ Contributed to: ${p.name} (${p.progress}% done)</div>`)
        },
        'employee-pending-reviews':  {
            title:'Pending Reviews',
            items: notificationsList.filter(n=>n.type==='review').length
                ? notificationsList.filter(n=>n.type==='review').map(n=>`<div class="stat-detail-item">⏳ ${n.title}: ${n.message}</div>`)
                : ['<div class="stat-detail-item" style="color:var(--text-secondary)">No pending reviews at this time.</div>']
        },
        'employee-hours':            {
            title:'Hours This Month',
            items: empDashStats.monthActivities?.length
                ? (() => {
                    const weeks = {};
                    empDashStats.monthActivities.forEach(a => {
                        const d   = new Date(a.activityDate||a.activity_date);
                        const wk  = `Week ${Math.ceil(d.getDate()/7)}`;
                        weeks[wk] = (weeks[wk]||0) + parseFloat(a.hoursWorked||a.hours_worked||0);
                    });
                    const total = Object.values(weeks).reduce((s,h)=>s+h,0);
                    const lines = Object.entries(weeks).map(([w,h])=>`<div class="stat-detail-item">⏰ ${w}: ${Math.round(h*10)/10}h</div>`);
                    lines.push(`<div class="stat-detail-item" style="border-top:1px solid var(--border);margin-top:0.5rem;padding-top:0.5rem;font-weight:700">📊 Total: ${Math.round(total*10)/10}h this month</div>`);
                    return lines;
                  })()
                : ['Week 1: 38h','Week 2: 41h','Week 3: 39h','Week 4: 42h'].map(t=>`<div class="stat-detail-item">⏰ ${t}</div>`)
        },
        'manager-team-members':      { title:'Team Members',      items: allUsers.filter(e=>e.role==='employee').map(e=>`<div class="stat-detail-item"><div class="emp-cell"><div class="emp-avatar-sm">${e.avatarInitials||initials(e.name)}</div><div>${e.name} — ${e.departmentName||e.department_name} · ${e.workload}% load</div></div></div>`) },
        'manager-active-projects':   { title:'Active Projects',   items: allProjects.filter(p=>p.status==='active').map(p=>`<div class="stat-detail-item"><span class="badge badge-success">${p.code}</span> ${p.name} — ${p.progress}%</div>`) },
        'manager-at-risk':           { title:'At-Risk Projects',  items: allProjects.filter(p=>p.progress<50).map(p=>`<div class="stat-detail-item"><span class="badge badge-danger">⚠️</span> ${p.name} — ${p.progress}% (due ${p.deadline})</div>`) },
        'manager-efficiency':        { title:'Team Efficiency',   items: ['Engineering: 91%','DevOps: 89%'].map(t=>`<div class="stat-detail-item">📈 ${t}</div>`) },
        'hr-total-employees':        { title:'All Employees',     items: allUsers.filter(e=>e.role==='employee').map(e=>`<div class="stat-detail-item"><div class="emp-cell"><div class="emp-avatar-sm">${e.avatarInitials||initials(e.name)}</div><div>${e.name} — ${e.departmentName||e.department_name}</div></div></div>`) },
        'hr-active-projects':        { title:'Active Projects',   items: allProjects.filter(p=>p.status==='active').map(p=>`<div class="stat-detail-item">${p.code} — ${p.name}</div>`) },
        'hr-unassigned':             { title:'Unassigned Projects',items: allProjects.filter(p=>p.status==='unassigned').map(p=>`<div class="stat-detail-item"><span class="badge badge-warning">⚠️</span> ${p.code} — ${p.name}</div>`) },
        'hr-allocation':             { title:'Dept Allocation',   items: allDepartments.map(d=>`<div class="stat-detail-item">🏢 ${d.name}: ${allUsers.filter(e=>e.role==='employee'&&(e.departmentName||e.department_name)===d.name).length} employees</div>`) },
        'admin-total-users':         { title:'All Users',         items: allUsers.map(u=>`<div class="stat-detail-item"><span class="badge badge-${u.role==='admin'?'danger':u.role==='manager'?'primary':u.role==='hr'?'warning':'info'}">${u.role}</span> ${u.name} — ${u.departmentName||u.department_name||'—'}</div>`) },
        'admin-active-projects':     { title:'Active Projects',   items: allProjects.filter(p=>p.status==='active').map(p=>`<div class="stat-detail-item">${p.code} — ${p.name}</div>`) },
        'admin-total-departments':   { title:'Departments',       items: allDepartments.map(d=>`<div class="stat-detail-item">🏢 ${d.name}: ${allUsers.filter(u=>(u.departmentName||u.department_name)===d.name).length} people</div>`) },
        'admin-pending-actions':     { title:'Pending Notifications',items: notificationsList.filter(n=>!n.is_read).map(n=>`<div class="stat-detail-item"><span class="badge badge-warning">⚠️</span> ${n.title}: ${n.message}</div>`) }
    };
    const key    = `${role}-${type}`;
    const detail = detailData[key] || { title: type, items: ['No data available'] };
    title.textContent = detail.title;
    content.innerHTML = `<div class="stat-detail-list">${detail.items.join('')}</div>`;
    modal.classList.add('active');
}

// ── Export Helpers ───────────────────────────────────────────
function exportProjectReport(projectId) {
    const p = allProjects.find(p=>p.id===projectId);
    if (!p) return;
    const team = p.team || [];
    const csv = `Project Report\nCode,${p.code}\nName,${p.name}\nStatus,${p.status}\nProgress,${p.progress}%\nDeadline,${p.deadline}\nTeam Size,${team.length}\n\nTeam Members\nName,Role,Commits,Hours\n${team.map(m=>`${m.name},${m.roleInProject||m.role_in_project||''},${m.commits||0},${m.hoursContributed||m.hours_contributed||0}`).join('\n')}`;
    downloadCSV(csv, `${p.code}_report.csv`);
    showToast(`${p.code} exported ✓`);
}

function exportEmployeeReport(empId) {
    const e = allUsers.find(u=>u.id===empId);
    if (!e) return;
    let skills = e.skills;
    skills = parseSkills(skills);
    const csv = `Employee Report\nName,${e.name}\nID,${e.employeeId||e.employee_id}\nDept,${e.departmentName||e.department_name}\nPerformance,${e.performanceScore||e.performance_score}%\nWorkload,${e.workload}%\n\nSkills\n${(skills||[]).join('\n')}`;
    downloadCSV(csv, `${e.employeeId||e.employee_id}_report.csv`);
    showToast(`${e.name} report exported ✓`);
}

function exportData(type) {
    const map = {
        'manager-report': () => ({ headers:['Code','Name','Status','Priority','Progress','Deadline','Team'], rows: allProjects.map(p=>[p.code,p.name,p.status,p.priority,p.progress+'%',p.deadline,(p.team||[]).length]), file:'manager_report.csv' }),
        'hr-projects':    () => ({ headers:['Code','Name','Status','Urgency','Deadline'],                rows: allProjects.map(p=>[p.code,p.name,p.status,p.urgency,p.deadline]),                                   file:'hr_projects.csv' }),
        'admin-report':   () => ({ headers:['ID','Name','Role','Dept','Status','Performance'],            rows: allUsers.map(u=>[(u.employeeId||u.employee_id),u.name,u.role,(u.departmentName||u.department_name||''),u.status,(u.performanceScore||u.performance_score||0)+'%']), file:'admin_report.csv' }),
        'employee-tracking-csv': () => ({ headers:['ID','Name','Dept','Performance','Workload'],          rows: allUsers.filter(u=>u.role==='employee').map(e=>[(e.employeeId||e.employee_id),e.name,(e.departmentName||e.department_name),(e.performanceScore||e.performance_score||0)+'%',(e.workload||0)+'%']), file:'employee_tracking.csv' }),
        'workload-report':() => ({ headers:['ID','Name','Dept','Workload','Hours/Week'],                  rows: allUsers.filter(u=>u.role==='employee').map(e=>[(e.employeeId||e.employee_id),e.name,(e.departmentName||e.department_name),(e.workload||0)+'%',(e.hoursPerWeek||e.hours_per_week||40)+'h']), file:'workload_report.csv' })
    };
    const gen = map[type];
    if (gen) {
        const { headers, rows, file } = gen();
        const csv = [headers.join(','), ...rows.map(r=>r.join(','))].join('\n');
        downloadCSV(csv, file);
        showToast(`Exported ${file} ✓`);
    } else {
        showToast(`Exporting ${type}... 📥`);
        const csv = `Export Type,${type}\nDate,${new Date().toLocaleDateString()}\nGenerated By,${currentUser?.name||'User'}`;
        downloadCSV(csv, `${type}.csv`);
    }
}

function downloadCSV(content, filename) {
    const blob = new Blob([content], { type:'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

// ── Modal Helpers ────────────────────────────────────────────
function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('active');
        if (['tempAssignModal','tempMsgModal','manageTeamModal','hrManageProjectModal'].includes(id)) {
            setTimeout(() => { if (modal.parentNode) modal.parentNode.removeChild(modal); }, 300);
        }
    }
}
function openModal(id) { document.getElementById(id)?.classList.add('active'); }

// ── Toast ────────────────────────────────────────────────────
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    // Map 'info' and 'warning' to supported CSS classes
    const cls = type === 'info' ? 'success' : type === 'warning' ? 'error' : type;
    toast.className = `toast toast-${cls} show`;
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove('show'), 3500);
}

// ── Dropdown / click-away ────────────────────────────────────
function toggleDropdown(event, id) {
    event.stopPropagation();
    document.querySelectorAll('.dropdown-menu').forEach(m => { if (m.id!==id) m.classList.remove('active'); });
    document.getElementById(id)?.classList.toggle('active');
}
function filterCardData(type, filter) { showToast(`Filtered: ${type} — ${filter} ✓`); document.querySelectorAll('.dropdown-menu').forEach(m=>m.classList.remove('active')); }
function exportCardData(type) { showToast(`Exporting ${type}… 📥`); document.querySelectorAll('.dropdown-menu').forEach(m=>m.classList.remove('active')); }


// ── Landing Page Animations ──────────────────────────────────
document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown-wrapper')) { document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('active')); }
    if (!e.target.closest('#notificationPanel') && !e.target.closest('[onclick*="openNotifications"]')) { closeNotifications(); }
});

function initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.scroll-reveal, .scroll-reveal-left, .scroll-reveal-right, .scroll-reveal-scale').forEach(el => {
        observer.observe(el);
    });
}

function initLandingAnimations() {
    const heroSection = document.querySelector('.hero');
    if (!heroSection) return;

    // ── Hero entrance animation ──
    const heroContent = document.querySelector('.hero-content');
    if (heroContent) {
        heroContent.style.opacity = '0';
        heroContent.style.transform = 'translateY(30px)';
        setTimeout(() => {
            heroContent.style.transition = 'all 0.9s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            heroContent.style.opacity = '1';
            heroContent.style.transform = 'translateY(0)';
        }, 200);
    }

    // ── Stagger fragment cards in ──
    const frags = document.querySelectorAll('.frag-card');
    frags.forEach((f, i) => {
        f.style.opacity = '0';
        f.style.transform += ' scale(0.8)';
        setTimeout(() => {
            f.style.transition = 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.34,1.56,0.64,1)';
            f.style.opacity = '1';
            f.style.transform = f.style.transform.replace(' scale(0.8)', '');
        }, 600 + i * 120);
    });

    // ── Particles ──
    const particles = document.querySelectorAll('.particle');
    particles.forEach((p, i) => {
        p.style.animationDelay = `${i * 0.5}s`;
        p.style.animationDuration = `${3 + Math.random() * 4}s`;
    });

    // ── Mouse spotlight ──
    const spotlight = document.getElementById('heroSpotlight');
    if (spotlight) {
        heroSection.addEventListener('mousemove', (e) => {
            const rect = heroSection.getBoundingClientRect();
            spotlight.style.left = (e.clientX - rect.left) + 'px';
            spotlight.style.top  = (e.clientY - rect.top)  + 'px';
        }, { passive: true });
    }

    // ── Magnetic buttons ──
    document.querySelectorAll('.magnetic-btn').forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const cx = rect.left + rect.width  / 2;
            const cy = rect.top  + rect.height / 2;
            const dx = (e.clientX - cx) * 0.35;
            const dy = (e.clientY - cy) * 0.35;
            btn.style.transform = `translate(${dx}px, ${dy}px)`;
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = '';
        });
    });

    // ── Text Scramble on hero title ──
    const scrambleEl = document.querySelector('.scramble-text');
    if (scrambleEl) {
        const original = scrambleEl.textContent;
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let frame = 0;
        const totalFrames = 25;
        setTimeout(() => {
            const timer = setInterval(() => {
                scrambleEl.textContent = original.split('').map((ch, i) => {
                    if (ch === ' ') return ' ';
                    const progress = frame / totalFrames;
                    const charProgress = i / original.length;
                    if (charProgress < progress) return ch;
                    return chars[Math.floor(Math.random() * chars.length)];
                }).join('');
                frame++;
                if (frame > totalFrames) { scrambleEl.textContent = original; clearInterval(timer); }
            }, 40);
        }, 800);
    }

    // ── Scroll handler (all parallax effects in one RAF loop) ──
    const progressBar   = document.getElementById('scrollProgressBar');
    const fragCards     = document.querySelectorAll('.parallax-float[data-depth]');
    const techChips     = document.querySelectorAll('.tech-chip[data-depth]');
    const heroParallaxLayers = document.querySelectorAll('.parallax-layer[data-depth]');
    const timelineFill  = document.getElementById('timelineFill');
    const stepsSection  = document.getElementById('howItWorks');
    const stepNodes     = document.querySelectorAll('.step-node');
    const sections      = document.querySelectorAll('section[id]');

    let ticking = false;
    let lastScrollY = 0;

    function onScroll() {
        lastScrollY = window.scrollY;
        if (!ticking) {
            requestAnimationFrame(runParallax);
            ticking = true;
        }
    }

    function runParallax() {
        const sy = lastScrollY;
        const wh = window.innerHeight;
        const docH = document.documentElement.scrollHeight - wh;

        // 1. Scroll progress bar
        if (progressBar) progressBar.style.width = `${(sy / docH) * 100}%`;

        // 2. Navbar scroll shadow
        const navbar = document.querySelector('.navbar');
        if (navbar) navbar.classList.toggle('navbar-scrolled', sy > 50);

        // 3. Multi-depth hero parallax layers (background blobs)
        heroParallaxLayers.forEach(layer => {
            const depth = parseFloat(layer.dataset.depth || 0);
            layer.style.transform = `translateY(${sy * depth}px)`;
        });

        // 4. Floating fragment cards — each at its own depth
        fragCards.forEach(card => {
            const depth = parseFloat(card.dataset.depth || 0);
            const baseAnim = getComputedStyle(card).transform;
            // Separate parallax from CSS animation by using a wrapper approach via CSS variable
            card.style.setProperty('--py', `${sy * depth}px`);
            // Apply directly: we override the individual transform
            const fragEl = card.closest('.hero-fragments') ? card : null;
            if (fragEl) {
                // Keep animation but add scroll offset via translate
                const existing = card.style.marginTop || '0px';
                card.style.transform = `translateY(${sy * depth * -1}px)`;
            }
        });

        // 5. Tech chips — scroll parallax drift
        techChips.forEach(chip => {
            const depth = parseFloat(chip.dataset.depth || 0);
            chip.style.transform = `translateY(${sy * depth * 0.3}px)`;
        });

        // 6. Hero mesh parallax
        const mesh = document.querySelector('.hero-mesh');
        if (mesh) mesh.style.transform = `translateY(${sy * 0.08}px)`;

        // 7. Hero background blob
        const heroBg = document.querySelector('.hero-background');
        if (heroBg) heroBg.style.transform = `translateY(${sy * 0.25}px)`;

        // 8. Scroll-linked timeline fill
        if (stepsSection && timelineFill) {
            const rect = stepsSection.getBoundingClientRect();
            const sectionH = stepsSection.offsetHeight;
            const entered = Math.max(0, wh - rect.top);
            const pct = Math.min(100, (entered / sectionH) * 130);
            timelineFill.style.width = `${pct}%`;

            // Activate step nodes based on progress
            stepNodes.forEach((node, i) => {
                const threshold = (i / stepNodes.length) * 100;
                node.classList.toggle('active', pct > threshold + 10);
            });
        }

        // 9. Featured mockup — subtle parallax scroll tilt
        const mockup = document.querySelector('.featured-mockup');
        if (mockup) {
            const rect = mockup.getBoundingClientRect();
            if (rect.top < wh && rect.bottom > 0) {
                const center = rect.top + rect.height / 2 - wh / 2;
                const tiltX = center * 0.012;
                mockup.style.transform = `perspective(1000px) rotateX(${Math.max(-8, Math.min(8, tiltX))}deg)`;
            }
        }

        // 10. Section-based background color ambiance
        let closestSection = null;
        let closestDist = Infinity;
        sections.forEach(s => {
            const rect = s.getBoundingClientRect();
            const dist = Math.abs(rect.top + rect.height / 2 - wh / 2);
            if (dist < closestDist) { closestDist = dist; closestSection = s; }
        });

        ticking = false;
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    runParallax(); // run once on load
}

// ── 3D Tilt Cards (mousemove) ──
function initTiltCards() {
    const MAX_TILT = 12;

    document.querySelectorAll('.tilt-card').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const cx = rect.left + rect.width  / 2;
            const cy = rect.top  + rect.height / 2;
            const dx = (e.clientX - cx) / (rect.width  / 2);
            const dy = (e.clientY - cy) / (rect.height / 2);
            const tX = -dy * MAX_TILT;
            const tY =  dx * MAX_TILT;

            card.style.transform = `perspective(800px) rotateX(${tX}deg) rotateY(${tY}deg) translateZ(6px)`;
            card.style.boxShadow = `${-tY * 1.5}px ${tX * 1.5}px 40px rgba(99,102,241,0.2)`;

            // Move inner glow to mouse pos
            const mx = ((e.clientX - rect.left) / rect.width  * 100).toFixed(1);
            const my = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1);
            card.style.setProperty('--mx', mx + '%');
            card.style.setProperty('--my', my + '%');
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
            card.style.boxShadow = '';
        });
    });

    // Featured mockup mouse tilt
    const mockup = document.querySelector('.featured-mockup');
    if (mockup) {
        mockup.addEventListener('mousemove', (e) => {
            const rect = mockup.getBoundingClientRect();
            const cx = rect.left + rect.width  / 2;
            const cy = rect.top  + rect.height / 2;
            const dx = (e.clientX - cx) / (rect.width  / 2);
            const dy = (e.clientY - cy) / (rect.height / 2);
            mockup.style.transform = `perspective(1000px) rotateX(${-dy * 6}deg) rotateY(${dx * 8}deg) translateZ(10px)`;
        });
        mockup.addEventListener('mouseleave', () => { mockup.style.transform = ''; });
    }

    // Testimonial cards tilt
    document.querySelectorAll('.testimonial-card-enhanced').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const dx = (e.clientX - rect.left - rect.width  / 2) / (rect.width  / 2);
            const dy = (e.clientY - rect.top  - rect.height / 2) / (rect.height / 2);
            card.style.transform = `perspective(800px) rotateX(${-dy * 6}deg) rotateY(${dx * 6}deg) translateY(-4px)`;
        });
        card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
}

// ── Scroll-triggered section title scramble ──
function initSectionScramble() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            if (el.dataset.scrambled) return;
            el.dataset.scrambled = '1';

            const original = el.textContent;
            let frame = 0;
            const totalFrames = 20;
            const timer = setInterval(() => {
                el.textContent = original.split('').map((ch, i) => {
                    if (ch === ' ') return ' ';
                    const progress = frame / totalFrames;
                    if (i / original.length < progress) return ch;
                    return chars[Math.floor(Math.random() * chars.length)];
                }).join('');
                frame++;
                if (frame > totalFrames) { el.textContent = original; clearInterval(timer); }
            }, 35);

            observer.unobserve(el);
        });
    }, { threshold: 0.5 });

    document.querySelectorAll('.section-title').forEach(el => observer.observe(el));
}

// ── Orbit rings for stats banner ──
function initOrbitRings() {
    const items = document.querySelectorAll('.stat-banner-item');
    items.forEach((item, i) => {
        const ring = document.createElement('div');
        ring.className = 'orbit-ring';
        ring.style.animationDuration = `${6 + i * 2}s`;
        ring.style.animationDelay = `${i * -1.5}s`;
        const dot = document.createElement('div');
        dot.className = 'orbit-dot';
        ring.appendChild(dot);
        item.appendChild(ring);
    });
}

function animateCounters() {
    const counters = document.querySelectorAll('[data-count]');
    counters.forEach(counter => {
        const target = parseInt(counter.getAttribute('data-count'));
        const suffix = counter.getAttribute('data-suffix') || '';
        let current = 0;
        const step = target / 60;
        const timer = setInterval(() => {
            current += step;
            if (current >= target) {
                counter.textContent = target + suffix;
                clearInterval(timer);
            } else {
                counter.textContent = Math.floor(current) + suffix;
            }
        }, 16);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    initScrollReveal();
    initLandingAnimations();
    initTiltCards();
    initSectionScramble();
    initOrbitRings();
    // notificationsList already initialised as [] at top; loadNotifications() fills it after login
    updateNotifBadges();
    setTimeout(animateCounters, 500);
});

window.toggleTheme = toggleTheme;
window.toggleSidebar = toggleSidebar;
window.openLoginModal = openLoginModal;
window.closeLoginModal = closeLoginModal;
window.handleLogin = handleLogin;
window.logout = logout;
window.showView = showView;
window.openNotifications = openNotifications;
window.closeNotifications = closeNotifications;
window.markNotifRead = markNotifRead;
window.markAllNotifRead = markAllNotifRead;
window.renderEmployeeProjects = renderEmployeeProjects;
window.updatePerformanceChart = updatePerformanceChart;
window.openProjectDetail = openProjectDetail;
window.updateProjectProgress = updateProjectProgress;
window.handleFileSelect = handleFileSelect;
window.handleFileDrop = handleFileDrop;
window.addProjectComment = addProjectComment;
window.downloadFile = downloadFile;
window.renderManagerWorkload = renderManagerWorkload;
window.renderManagerReports = renderManagerReports;
window.renderManagerProjects = renderManagerProjects;
window.viewEmployeeDetail = viewEmployeeDetail;
window.openManagerAssignModal = openManagerAssignModal;
window.confirmManagerAssign = confirmManagerAssign;
window.openMessageModal = openMessageModal;
window.sendMessage = sendMessage;
window.filterHRProjects = filterHRProjects;
window.filterAssignmentProjects = filterAssignmentProjects;
window.filterEmployeeTracking = filterEmployeeTracking;
window.filterUserManagement = filterUserManagement;
window.openAddUserModal = openAddUserModal;
window.openEditUserModal = openEditUserModal;
window.handleAddUser = handleAddUser;
window.handleEditUser = handleEditUser;
window.confirmDeleteUser = confirmDeleteUser;
window.toggleUserStatus = toggleUserStatus;
window.filterAdminProjects = filterAdminProjects;
window.openAddProjectModal = openAddProjectModal;
window.openEditProjectModal = openEditProjectModal;
window.handleAddProject = handleAddProject;
window.handleEditProject = handleEditProject;
window.confirmDeleteProject = confirmDeleteProject;
window.archiveProject = archiveProject;
window.renderAuditLog = renderAuditLog;
window.renderSystemHealth = renderSystemHealth;
window.loadAdminSettings = loadAdminSettings;
window.saveSettings = saveSettings;
window.showStatDetail = showStatDetail;
window.toggleDropdown = toggleDropdown;
window.filterCardData = filterCardData;
window.exportCardData = exportCardData;
window.exportData = exportData;
window.exportProjectReport = exportProjectReport;
window.exportEmployeeReport = exportEmployeeReport;
window.closeModal = closeModal;
window.openModal = openModal;
window.showToast = showToast;
window.handleAddComment = addProjectComment;

window.toggleAssignEmployee = toggleAssignEmployee;
window.confirmManagerAssign = confirmManagerAssign;
window.deleteProjectComment = deleteProjectComment;
window.renderManagerProfile = renderManagerProfile;
window.renderHRProfile      = renderHRProfile;
window.renderAdminProfile   = renderAdminProfile;

// ============================================================
//  PASSWORD CHANGE (available to all roles from profile)
// ============================================================
async function changePassword(userId) {
    const getVal = id => {
        const scoped = document.getElementById(`${id}_${userId}`);
        return (scoped ? scoped.value : document.getElementById(id)?.value) || '';
    };
    const cur  = getVal('pwCurrent');
    const nw   = getVal('pwNew');
    const conf = getVal('pwConfirm');
    if (!cur || !nw || !conf) { showToast('Please fill in all fields ⚠️', 'error'); return; }
    if (nw !== conf)           { showToast('New passwords do not match ⚠️', 'error'); return; }
    if (nw.length < 6)         { showToast('Password must be at least 6 characters', 'error'); return; }

    // CorsConfig only allows GET, POST, PUT, DELETE, OPTIONS — NO PATCH.
    // BCrypt: password must be hashed server-side via a dedicated endpoint.
    // Try all PUT/POST variants (snake_case first since Jackson uses SNAKE_CASE strategy).
    const u = allUsers.find(x => x.id == userId) || currentUser || {};
    // ONLY try dedicated password-change endpoints (PUT/POST-only, no PATCH).
    // DO NOT include PUT /users/{id} as a fallback — it returns 200 but does NOT BCrypt the password,
    // causing a false "success" where the old password still works.
    const attempts = [
        () => api('PUT',  `/users/${userId}/password`,       { current_password: cur, new_password: nw }),
        () => api('PUT',  `/users/${userId}/password`,       { currentPassword: cur,  newPassword: nw }),
        () => api('POST', `/users/${userId}/change-password`, { current_password: cur, new_password: nw }),
        () => api('POST', `/users/${userId}/change-password`, { currentPassword: cur,  newPassword: nw }),
        () => api('POST', `/auth/change-password`,            { user_id: userId, current_password: cur, new_password: nw }),
        () => api('POST', `/auth/change-password`,            { userId,           currentPassword: cur, newPassword: nw }),
    ];

    let success = false, lastErr = '';
    for (const fn of attempts) {
        try { await fn(); success = true; break; }
        catch(e) { lastErr = e.message; }
    }

    if (success) {
        ['pwCurrent','pwNew','pwConfirm',
         `pwCurrent_${userId}`,`pwNew_${userId}`,`pwConfirm_${userId}`
        ].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        showToast('Password change request sent ✓ — if your backend supports it, log in again with the new password');
    } else {
        showToast(`Password change not supported by this backend. Ask your developer to add PUT /users/{id}/password endpoint.`, 'error');
    }
}
window.changePassword = changePassword;

function _passwordCard(userId) {
    return `
    <div class="card card-modern" style="margin-top:0">
        <h3 class="card-title" style="margin-bottom:1rem">🔒 Change Password</h3>
        <div class="form-group"><label>Current Password</label><input type="password" id="pwCurrent_${userId}" class="form-control" placeholder="Enter current password"></div>
        <div class="form-group"><label>New Password</label><input type="password" id="pwNew_${userId}" class="form-control" placeholder="At least 6 characters"></div>
        <div class="form-group"><label>Confirm New Password</label><input type="password" id="pwConfirm_${userId}" class="form-control" placeholder="Repeat new password"></div>
        <button class="btn btn-primary btn-glow" onclick="changePassword(${userId})">Update Password 🔒</button>
    </div>`;
}

// ============================================================
//  PROFILE PAGES — MANAGER / HR / ADMIN
// ============================================================
function renderManagerProfile() {
    const u = currentUser;
    if (!u) return;
    const container = document.getElementById('manager-profile');
    if (!container) return;
    // Refresh users from DB so new employees appear
    api('GET', '/users').then(r => {
        if (r?.data) allUsers = r.data;
        _renderManagerProfileContent(container, u);
    }).catch(()=> _renderManagerProfileContent(container, u));
}
function _renderManagerProfileContent(container, u) {
    const roleLabel = 'Manager';
    const teamEmps  = allUsers.filter(e=>e.role==='employee');
    const activeProjects = allProjects.filter(p=>p.status==='active').length;
    const completedProjects = allProjects.filter(p=>p.status==='completed').length;
    let skills = u.skills;
    skills = parseSkills(skills);
    const colors = ['primary','success','warning','info','secondary'];
    const skillsHTML = (skills||[]).map((s,i)=>`<span class="skill-tag skill-tag-${colors[i%colors.length]}">${s}</span>`).join('')
        || '<span style="color:var(--text-secondary)">No skills listed</span>';
    container.innerHTML = `
    <div class="page-header"><div><h1>My Profile</h1><p>Your manager account details and team overview</p></div></div>
    <div class="grid-2">
        <div class="card card-modern profile-card-center">
            <div class="profile-avatar-large" style="background:linear-gradient(135deg,#059669,#10B981)">${u.avatarInitials||u.avatar_initials||initials(u.name)}</div>
            <h2 class="profile-name">${u.name}</h2>
            <p class="profile-id">${u.employeeId||u.employee_id||'—'}</p>
            <p class="profile-department">${u.departmentName||u.department_name||'—'}</p>
            <div class="profile-stats">
                <div class="profile-stat"><div class="profile-stat-value">${teamEmps.length}</div><div class="profile-stat-label">Team Size</div></div>
                <div class="profile-stat"><div class="profile-stat-value">${activeProjects}</div><div class="profile-stat-label">Active Projects</div></div>
                <div class="profile-stat"><div class="profile-stat-value">${completedProjects}</div><div class="profile-stat-label">Completed</div></div>
            </div>
        </div>
        <div class="card card-modern">
            <h3 class="card-title" style="margin-bottom:1rem">📋 Personal Information</h3>
            <div class="info-grid">
                <div class="info-item"><label>Full Name</label><p>${u.name}</p></div>
                <div class="info-item"><label>Employee ID</label><p>${u.employeeId||u.employee_id||'—'}</p></div>
                <div class="info-item"><label>Department</label><p>${u.departmentName||u.department_name||'—'}</p></div>
                <div class="info-item"><label>Email</label><p>${u.email||'—'}</p></div>
                <div class="info-item"><label>Join Date</label><p>${u.joinDate||u.join_date||'—'}</p></div>
                <div class="info-item"><label>Role</label><p>${roleLabel}</p></div>
                <div class="info-item"><label>Hours / Week</label><p>${u.hoursPerWeek||u.hours_per_week||40}h</p></div>
                <div class="info-item"><label>Status</label><p><span class="badge badge-${u.status==='active'?'success':'danger'}">${u.status||'active'}</span></p></div>
            </div>
        </div>
    </div>
    <div class="card card-modern" style="margin-top:0">
        <h3 class="card-title" style="margin-bottom:1rem">🎯 Skills & Expertise</h3>
        <div class="skills-container">${skillsHTML}</div>
    </div>
    <div class="card card-modern" style="margin-top:0">
        <h3 class="card-title" style="margin-bottom:1rem">👥 Your Team (${teamEmps.length} employees)</h3>
        <div class="table-wrapper"><table class="data-table">
            <thead><tr><th>Employee</th><th>Department</th><th>Performance</th><th>Workload</th><th>Status</th></tr></thead>
            <tbody>${teamEmps.slice(0,10).map(e=>`<tr>
                <td><div class="emp-cell"><div class="emp-avatar-sm">${e.avatarInitials||initials(e.name)}</div><div><div class="emp-name">${e.name}</div><div class="emp-id">${e.employeeId||e.employee_id||'—'}</div></div></div></td>
                <td>${e.departmentName||e.department_name||'—'}</td>
                <td><span class="badge badge-${(e.performanceScore||e.performance_score||0)>=90?'success':(e.performanceScore||e.performance_score||0)>=75?'warning':'danger'}">${e.performanceScore||e.performance_score||0}%</span></td>
                <td><div style="display:flex;align-items:center;gap:0.5rem"><div class="progress-bar" style="width:80px;flex:none"><div class="progress-fill" style="width:${e.workload||0}%"></div></div><span>${e.workload||0}%</span></div></td>
                <td><span class="badge badge-${e.status==='active'?'success':'danger'}">${e.status}</span></td>
            </tr>`).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);padding:2rem">No team members found</td></tr>'}</tbody>
        </table></div>
    </div>
    ${_passwordCard(u.id)}`;
}

function renderHRProfile() {
    const u = currentUser;
    if (!u) return;
    const container = document.getElementById('hr-profile');
    if (!container) return;
    const employees = allUsers.filter(e=>e.role==='employee');
    const managers  = allUsers.filter(e=>e.role==='manager');
    const deptCount = allDepartments.length;
    const activeProj = allProjects.filter(p=>p.status==='active').length;
    let skills = u.skills;
    skills = parseSkills(skills);
    const colors = ['primary','success','warning','info','secondary'];
    const skillsHTML = (skills||[]).map((s,i)=>`<span class="skill-tag skill-tag-${colors[i%colors.length]}">${s}</span>`).join('')
        || '<span style="color:var(--text-secondary)">No skills listed</span>';
    container.innerHTML = `
    <div class="page-header"><div><h1>My Profile</h1><p>Your HR account details and workforce overview</p></div></div>
    <div class="grid-2">
        <div class="card card-modern profile-card-center">
            <div class="profile-avatar-large" style="background:linear-gradient(135deg,#F59E0B,#D97706)">${u.avatarInitials||u.avatar_initials||initials(u.name)}</div>
            <h2 class="profile-name">${u.name}</h2>
            <p class="profile-id">${u.employeeId||u.employee_id||'—'}</p>
            <p class="profile-department">${u.departmentName||u.department_name||'—'}</p>
            <div class="profile-stats">
                <div class="profile-stat"><div class="profile-stat-value">${employees.length}</div><div class="profile-stat-label">Employees</div></div>
                <div class="profile-stat"><div class="profile-stat-value">${deptCount}</div><div class="profile-stat-label">Departments</div></div>
                <div class="profile-stat"><div class="profile-stat-value">${activeProj}</div><div class="profile-stat-label">Active Projects</div></div>
            </div>
        </div>
        <div class="card card-modern">
            <h3 class="card-title" style="margin-bottom:1rem">📋 Personal Information</h3>
            <div class="info-grid">
                <div class="info-item"><label>Full Name</label><p>${u.name}</p></div>
                <div class="info-item"><label>Employee ID</label><p>${u.employeeId||u.employee_id||'—'}</p></div>
                <div class="info-item"><label>Department</label><p>${u.departmentName||u.department_name||'—'}</p></div>
                <div class="info-item"><label>Email</label><p>${u.email||'—'}</p></div>
                <div class="info-item"><label>Join Date</label><p>${u.joinDate||u.join_date||'—'}</p></div>
                <div class="info-item"><label>Role</label><p>HR Manager</p></div>
                <div class="info-item"><label>Hours / Week</label><p>${u.hoursPerWeek||u.hours_per_week||40}h</p></div>
                <div class="info-item"><label>Status</label><p><span class="badge badge-${u.status==='active'?'success':'danger'}">${u.status||'active'}</span></p></div>
            </div>
        </div>
    </div>
    <div class="card card-modern" style="margin-top:0">
        <h3 class="card-title" style="margin-bottom:1rem">🎯 Skills & Expertise</h3>
        <div class="skills-container">${skillsHTML}</div>
    </div>
    <div class="grid-2" style="margin-top:0">
        <div class="card card-modern">
            <h3 class="card-title" style="margin-bottom:1rem">🏢 Departments (${deptCount})</h3>
            <div>${allDepartments.map(d=>{
                const count = employees.filter(e=>(e.departmentName||e.department_name)===d.name).length;
                return `<div style="display:flex;justify-content:space-between;align-items:center;padding:0.6rem 0;border-bottom:1px solid var(--border)"><span>🏢 ${d.name||d}</span><span class="badge badge-info">${count} emp</span></div>`;
            }).join('')||'<p style="color:var(--text-secondary)">No departments</p>'}</div>
        </div>
        <div class="card card-modern">
            <h3 class="card-title" style="margin-bottom:1rem">👔 Managers (${managers.length})</h3>
            <div>${managers.map(m=>`
                <div class="emp-cell" style="padding:0.5rem 0;border-bottom:1px solid var(--border)">
                    <div class="emp-avatar-sm" style="background:linear-gradient(135deg,#059669,#10B981)">${m.avatarInitials||initials(m.name)}</div>
                    <div><div class="emp-name">${m.name}</div><div class="emp-id">${m.departmentName||m.department_name||'—'}</div></div>
                </div>`).join('')||'<p style="color:var(--text-secondary)">No managers</p>'}
            </div>
        </div>
    </div>
    ${_passwordCard(u.id)}`;
}

function renderAdminProfile() {
    const u = currentUser;
    if (!u) return;
    const container = document.getElementById('admin-profile');
    if (!container) return;
    const totalUsers  = allUsers.length;
    const totalProjs  = allProjects.length;
    const deptCount   = allDepartments.length;
    const admins      = allUsers.filter(e=>e.role==='admin');
    let skills = u.skills;
    skills = parseSkills(skills);
    const colors = ['primary','success','warning','info','secondary'];
    const skillsHTML = (skills||[]).map((s,i)=>`<span class="skill-tag skill-tag-${colors[i%colors.length]}">${s}</span>`).join('')
        || '<span style="color:var(--text-secondary)">No skills listed</span>';
    container.innerHTML = `
    <div class="page-header"><div><h1>My Profile</h1><p>Your administrator account details and system overview</p></div></div>
    <div class="grid-2">
        <div class="card card-modern profile-card-center">
            <div class="profile-avatar-large" style="background:linear-gradient(135deg,#EF4444,#DC2626)">${u.avatarInitials||u.avatar_initials||initials(u.name)}</div>
            <h2 class="profile-name">${u.name}</h2>
            <p class="profile-id">${u.employeeId||u.employee_id||'—'}</p>
            <p class="profile-department">${u.departmentName||u.department_name||'—'}</p>
            <div class="profile-stats">
                <div class="profile-stat"><div class="profile-stat-value">${totalUsers}</div><div class="profile-stat-label">Total Users</div></div>
                <div class="profile-stat"><div class="profile-stat-value">${totalProjs}</div><div class="profile-stat-label">Projects</div></div>
                <div class="profile-stat"><div class="profile-stat-value">${deptCount}</div><div class="profile-stat-label">Departments</div></div>
            </div>
        </div>
        <div class="card card-modern">
            <h3 class="card-title" style="margin-bottom:1rem">📋 Personal Information</h3>
            <div class="info-grid">
                <div class="info-item"><label>Full Name</label><p>${u.name}</p></div>
                <div class="info-item"><label>Employee ID</label><p>${u.employeeId||u.employee_id||'—'}</p></div>
                <div class="info-item"><label>Department</label><p>${u.departmentName||u.department_name||'—'}</p></div>
                <div class="info-item"><label>Email</label><p>${u.email||'—'}</p></div>
                <div class="info-item"><label>Join Date</label><p>${u.joinDate||u.join_date||'—'}</p></div>
                <div class="info-item"><label>Role</label><p>System Administrator</p></div>
                <div class="info-item"><label>Hours / Week</label><p>${u.hoursPerWeek||u.hours_per_week||40}h</p></div>
                <div class="info-item"><label>Access Level</label><p><span class="badge badge-danger">Full Access</span></p></div>
            </div>
        </div>
    </div>
    <div class="card card-modern" style="margin-top:0">
        <h3 class="card-title" style="margin-bottom:1rem">🎯 Skills & Expertise</h3>
        <div class="skills-container">${skillsHTML}</div>
    </div>
    <div class="card card-modern" style="margin-top:0">
        <h3 class="card-title" style="margin-bottom:1rem">📊 System Overview</h3>
        <div class="stats-grid stats-grid-4" style="margin:0">
            ${['employee','manager','hr','admin'].map(role=>{
                const count = allUsers.filter(u=>u.role===role).length;
                const badge = role==='admin'?'danger':role==='manager'?'primary':role==='hr'?'warning':'info';
                return `<div class="stat-card stat-card-animated stat-${badge==='info'?'primary':badge}" style="cursor:default"><div class="stat-icon">${role==='employee'?'👤':role==='manager'?'👔':role==='hr'?'🏢':'🔑'}</div><div class="stat-content"><div class="stat-value">${count}</div><div class="stat-label">${role.charAt(0).toUpperCase()+role.slice(1)}${count!==1?'s':''}</div></div></div>`;
            }).join('')}
        </div>
    </div>
    <div class="card card-modern" style="margin-top:0">
        <h3 class="card-title" style="margin-bottom:1rem">🔑 All Administrators</h3>
        <div class="table-wrapper"><table class="data-table">
            <thead><tr><th>Admin</th><th>Email</th><th>Department</th><th>Last Login</th><th>Status</th></tr></thead>
            <tbody>${admins.map(a=>`<tr>
                <td><div class="emp-cell"><div class="emp-avatar-sm" style="background:linear-gradient(135deg,#EF4444,#DC2626)">${a.avatarInitials||initials(a.name)}</div><div><div class="emp-name">${a.name}</div><div class="emp-id">${a.employeeId||a.employee_id||'—'}</div></div></div></td>
                <td>${a.email||'—'}</td>
                <td>${a.departmentName||a.department_name||'—'}</td>
                <td>${formatTime(a.lastLogin||a.last_login)||'Never'}</td>
                <td><span class="badge badge-${a.status==='active'?'success':'danger'}">${a.status}</span></td>
            </tr>`).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--text-secondary)">No admin data</td></tr>'}</tbody>
        </table></div>
    </div>
    ${_passwordCard(u.id)}`;
}


async function loadProjectsFromDB() {
    try { const r = await api('GET','/projects'); allProjects = r.data||[]; renderManagerProjects&&renderManagerProjects(); } catch(e){console.warn(e);}
}
async function loadEmployeesFromDB() {
    try { const r = await api('GET','/users'); allUsers = r.data||[]; } catch(e){console.warn(e);}
}

// ============================================================
//  MESSAGING SYSTEM
//  Rules:
//   - Employee  → can message their Manager + HR
//   - Manager   → can message anyone
//   - HR        → can message anyone
//   - Admin     → can message anyone
// ============================================================

let _msgCurrentThread = null; // { partnerId, partnerName }
let _sentMessages = []; // local cache of messages sent in this session

function _getAllowedRecipients() {
    const me = currentUser;
    if (!me) return [];
    const role = me.role;
    if (role === 'admin' || role === 'manager' || role === 'hr') {
        // Can message everyone except themselves
        return allUsers.filter(u => u.id !== me.id);
    }
    if (role === 'employee') {
        // Can message managers + HR only
        return allUsers.filter(u => u.id !== me.id && (u.role === 'manager' || u.role === 'hr' || u.role === 'admin'));
    }
    return [];
}

async function openMessaging() {
    const modal = document.getElementById('messagingModal');
    if (!modal) return;
    modal.classList.add('active');
    await loadConversations();
}
window.openMessaging = openMessaging;

async function loadConversations() {
    const bodyEl = document.getElementById('msgConvListBody');
    if (!bodyEl) return;
    bodyEl.innerHTML = '<div style="padding:1rem;color:var(--text-secondary);font-size:0.8rem">Loading…</div>';

    if (!allUsers.length) {
        try { const r = await api('GET','/users'); allUsers = r.data || []; } catch {}
    }
    const myId = parseInt(currentUser.id);
    const resolveUser = id => allUsers.find(u => parseInt(u.id) === parseInt(id));

    try {
        // GET /messages?userId=X returns ONLY received messages (WHERE to_id=X)
        let received = [];
        try {
            const r = await api('GET', `/messages?userId=${myId}`);
            received = r?.data || [];
        } catch {}

        // Merge with locally cached sent messages from this session
        const allMsgs = [...received, ..._sentMessages];
        // Deduplicate by id (sent messages that are also returned by server)
        const seen = new Set();
        const msgs = allMsgs.filter(m => {
            const key = m.id || `${m.fromId||m.from_id}-${m.toId||m.to_id}-${m.created_at||Date.now()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        const convMap = {};
        msgs.forEach(m => {
            const fid = parseInt(m.from_id ?? m.fromId ?? 0);
            const tid = parseInt(m.to_id   ?? m.toId   ?? 0);
            const partnerId = (fid === myId) ? tid : fid;
            if (!partnerId) return;
            const pu = resolveUser(partnerId);
            const partnerName = pu?.name || `User #${partnerId}`;
            if (!convMap[partnerId]) convMap[partnerId] = { partnerId, partnerName, msgs: [], unread: 0 };
            convMap[partnerId].msgs.push(m);
            // Only count as unread if sent TO me and not read
            if (!m.is_read && !m.isRead && tid === myId) convMap[partnerId].unread++;
        });

        const convs = Object.values(convMap).sort((a, b) => {
            const ta = new Date(a.msgs[a.msgs.length-1]?.created_at || 0);
            const tb = new Date(b.msgs[b.msgs.length-1]?.created_at || 0);
            return tb - ta;
        });

        const totalUnread = convs.reduce((s, c) => s + c.unread, 0);
        ['empMsgBadge','mgrMsgBadge','hrMsgBadge','adminMsgBadge'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.textContent = totalUnread; el.style.display = totalUnread ? 'flex' : 'none'; }
        });

        if (!convs.length) {
            bodyEl.innerHTML = '<div style="padding:1rem;color:var(--text-secondary);font-size:0.8rem;text-align:center">No messages yet.<br>Compose one to get started!</div>';
            return;
        }

        bodyEl.innerHTML = convs.map(c => {
            const last = c.msgs[c.msgs.length - 1];
            const preview = (last?.body || '').substring(0, 45) + ((last?.body||'').length > 45 ? '…' : '');
            const isActive = _msgCurrentThread?.partnerId == c.partnerId;
            const safeName = (c.partnerName||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
            return `<div class="msg-conv-item${isActive ? ' active' : ''}" data-partner-id="${c.partnerId}" onclick="openThread(${c.partnerId},'${safeName}')">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div style="font-weight:${c.unread?700:500};font-size:0.875rem">${c.partnerName}</div>
                    ${c.unread ? `<span class="badge badge-primary" style="font-size:0.65rem;padding:0.1rem 0.4rem">${c.unread}</span>` : ''}
                </div>
                <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.15rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${preview||'No messages yet'}</div>
            </div>`;
        }).join('');
    } catch(e) {
        bodyEl.innerHTML = `<div style="padding:1rem;color:var(--text-secondary);font-size:0.8rem">Could not load: ${e.message}</div>`;
    }
}
window.loadConversations = loadConversations;

async function openThread(partnerId, partnerName) {
    _msgCurrentThread = { partnerId: parseInt(partnerId), partnerName };
    const threadArea = document.getElementById('msgThreadArea');
    const replyBar   = document.getElementById('msgReplyBar');
    const subtitle   = document.getElementById('msgModalSubtitle');
    if (!threadArea) return;

    // Resolve real partner name from allUsers
    const partnerUser = allUsers.find(u => parseInt(u.id) === parseInt(partnerId));
    if (partnerUser?.name) {
        partnerName = partnerUser.name;
        _msgCurrentThread.partnerName = partnerName;
    }
    if (subtitle) subtitle.textContent = `Conversation with ${partnerName}`;
    threadArea.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-secondary)">Loading…</div>';
    if (replyBar) replyBar.style.display = 'flex';

    document.querySelectorAll('.msg-conv-item').forEach(el => {
        el.classList.toggle('active', parseInt(el.dataset.partnerId) === parseInt(partnerId));
    });

    try {
        const myId  = parseInt(currentUser.id);
        const pid   = parseInt(partnerId);

        // Fetch received messages for current user
        let received = [];
        try {
            const r = await api('GET', `/messages?userId=${myId}`);
            received = r?.data || [];
        } catch {}

        // Merge with sent message cache
        const allMsgs = [...received, ..._sentMessages];
        const seen = new Set();
        const all = allMsgs
            .filter(m => {
                const key = m.id || `${m.fromId||m.from_id}-${m.toId||m.to_id}-${m.body}`;
                if (seen.has(key)) return false; seen.add(key); return true;
            })
            .filter(m => {
                const fid = parseInt(m.from_id ?? m.fromId ?? 0);
                const tid = parseInt(m.to_id   ?? m.toId   ?? 0);
                return (fid === myId && tid === pid) || (fid === pid && tid === myId);
            })
            .sort((a, b) => new Date(a.created_at || a._localTime || 0) - new Date(b.created_at || b._localTime || 0));

        // Mark received messages as read
        all.filter(m => !(m.is_read || m.isRead) && parseInt(m.to_id ?? m.toId ?? 0) === myId)
           .forEach(m => { if (m.id) api('PUT', `/messages/${m.id}/read`, {}).catch(() => {}); });

        if (!all.length) {
            threadArea.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-secondary)">
                <div style="font-size:2rem;margin-bottom:0.5rem">💬</div>
                <p>No messages yet. Send the first one!</p></div>`;
        } else {
            threadArea.innerHTML = all.map(m => {
                const fid    = parseInt(m.from_id ?? m.fromId ?? 0);
                const isMine = fid === myId;
                const sender = isMine ? 'You' : partnerName;
                const time   = m.created_at ? new Date(m.created_at).toLocaleString() : 'Just now';
                return `<div style="display:flex;flex-direction:column;align-items:${isMine?'flex-end':'flex-start'};margin-bottom:1rem">
                    <div style="max-width:75%;background:${isMine?'var(--primary)':'var(--bg-secondary)'};color:${isMine?'#fff':'var(--text-primary)'};padding:0.65rem 0.9rem;border-radius:${isMine?'12px 12px 2px 12px':'12px 12px 12px 2px'};font-size:0.875rem;line-height:1.4">
                        ${m.subject && m.subject !== 'Message' ? `<div style="font-weight:600;margin-bottom:0.25rem;font-size:0.8rem;opacity:0.85">${m.subject}</div>` : ''}
                        ${m.body || ''}
                    </div>
                    <div style="font-size:0.7rem;color:var(--text-secondary);margin-top:0.2rem">${sender} · ${time}</div>
                </div>`;
            }).join('');
            threadArea.scrollTop = threadArea.scrollHeight;
        }

        await loadConversations();
    } catch(e) {
        threadArea.innerHTML = `<div style="color:var(--text-secondary);padding:1rem">Could not load: ${e.message}</div>`;
    }
}
window.openThread = openThread;

async function _postMessage(fromId, toId, subject, body) {
    // Controller reads Map<String,Object> with literal keys "fromId" and "toId" (camelCase)
    return await api('POST', '/messages', { fromId, toId, subject: subject || 'Message', body });
}

async function sendMsgReply() {
    if (!_msgCurrentThread) return;
    const text = document.getElementById('msgReplyText')?.value?.trim();
    if (!text) { showToast('Write a message first ⚠️', 'error'); return; }
    try {
        const saved = await _postMessage(currentUser.id, _msgCurrentThread.partnerId, 'Message', text);
        const el = document.getElementById('msgReplyText');
        if (el) el.value = '';
        // Cache the sent message locally so it appears in the thread immediately
        const sentMsg = saved?.data || {
            id: Date.now(), fromId: currentUser.id, toId: _msgCurrentThread.partnerId,
            from_id: currentUser.id, to_id: _msgCurrentThread.partnerId,
            body: text, subject: 'Message', is_read: true, _localTime: new Date().toISOString()
        };
        _sentMessages.push(sentMsg);
        showToast('Message sent ✓');
        await openThread(_msgCurrentThread.partnerId, _msgCurrentThread.partnerName);
    } catch(e) { showToast(`Send failed: ${e.message}`, 'error'); }
}
window.sendMsgReply = sendMsgReply;

async function openComposeMessage() {
    const modal = document.getElementById('composeModal');
    if (!modal) return;
    // Always reload users so recipients are fresh
    if (!allUsers.length) {
        try { const r = await api('GET','/users'); allUsers = r.data || []; } catch {}
    }
    const sel = document.getElementById('composeTo');
    const searchBox = document.getElementById('composeToSearch');
    if (sel) {
        _populateComposeRecipients('');
    }
    if (searchBox) {
        searchBox.value = '';
        searchBox.oninput = () => _populateComposeRecipients(searchBox.value);
    }
    modal.classList.add('active');
}

function _populateComposeRecipients(query) {
    const sel = document.getElementById('composeTo');
    if (!sel) return;
    const q = (query||'').toLowerCase();
    let recipients = _getAllowedRecipients();
    if (q) recipients = recipients.filter(u =>
        u.name.toLowerCase().includes(q) ||
        (u.role||'').toLowerCase().includes(q) ||
        (u.employeeId||u.employee_id||'').toLowerCase().includes(q)
    );
    if (!recipients.length) {
        sel.innerHTML = '<option value="">No matching recipients</option>';
    } else {
        sel.innerHTML = recipients.map(u =>
            `<option value="${u.id}">${u.name} — ${u.role} ${u.employeeId||u.employee_id||''}</option>`
        ).join('');
    }
}
window._populateComposeRecipients = _populateComposeRecipients;
window.openComposeMessage = openComposeMessage;

async function sendComposedMessage() {
    const toId   = parseInt(document.getElementById('composeTo')?.value);
    const subj   = document.getElementById('composeSubject')?.value?.trim() || `Message from ${currentUser.name}`;
    const body   = document.getElementById('composeBody')?.value?.trim();
    if (!body)  { showToast('Write a message first ⚠️', 'error'); return; }
    if (!toId)  { showToast('Select a recipient ⚠️', 'error'); return; }
    try {
        const savedMsg = await _postMessage(currentUser.id, toId, subj, body);
        // Cache locally so it shows up immediately in the thread
        const sentMsg = savedMsg?.data || {
            id: Date.now(), fromId: currentUser.id, toId,
            from_id: currentUser.id, to_id: toId,
            body, subject: subj, is_read: true, _localTime: new Date().toISOString()
        };
        _sentMessages.push(sentMsg);
        closeModal('composeModal');
        const partner = allUsers.find(u => u.id === toId);
        showToast(`Message sent to ${partner?.name || 'recipient'} ✓`);
        // Reopen thread to show the sent message
        if (partner) {
            _msgCurrentThread = { partnerId: toId, partnerName: partner.name };
            await loadConversations();
            await openThread(toId, partner.name);
        }
    } catch(e) { showToast(`Send failed: ${e.message}`, 'error'); }
}
window.sendComposedMessage = sendComposedMessage;

// Legacy openMessageModal kept for manager workload quick-message buttons
async function openMessageModal(userId) {
    _msgCurrentThread = null;
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    await openMessaging();
    // Auto-open that person's thread
    setTimeout(() => openThread(userId, user.name), 300);
}
// sendMessage kept as alias
async function sendMessage(userId) { openMessageModal(userId); }

window.openMessageModal = openMessageModal;
window.sendMessage      = sendMessage;

// ============================================================
//  ADMIN EDIT PROFILE (admin only)
// ============================================================
function openAdminEditProfileModal() {
    const u = currentUser;
    if (!u || u.role !== 'admin') return;
    const sv = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
    sv('adminEditName',   u.name);
    sv('adminEditEmail',  u.email);
    sv('adminEditDept',   u.departmentName || u.department_name || '');
    sv('adminEditSkills', parseSkills(u.skills).join(', '));
    document.getElementById('adminEditProfileModal')?.classList.add('active');
}
window.openAdminEditProfileModal = openAdminEditProfileModal;

async function saveAdminProfile() {
    const name   = document.getElementById('adminEditName')?.value?.trim();
    const email  = document.getElementById('adminEditEmail')?.value?.trim();
    const dept   = document.getElementById('adminEditDept')?.value?.trim();
    const skills = parseSkills(document.getElementById('adminEditSkills')?.value || '');
    if (!name || !email) { showToast('Name and email are required', 'error'); return; }
    try {
        const u = currentUser;
        // UserService.update reads camelCase Map keys
        await api('PUT', `/users/${u.id}`, {
            name, email,
            role:           u.role,
            departmentName: dept,
            workload:       u.workload || 0,
            hoursPerWeek:   u.hoursPerWeek || u.hours_per_week || 40,
            performanceScore: u.performanceScore || u.performance_score || 80,
            requestorId:    u.id,
            requestorName:  u.name
        });
        currentUser.name  = name;
        currentUser.email = email;
        currentUser.departmentName = dept;
        currentUser.skills = skills;
        closeModal('adminEditProfileModal');
        renderAdminProfile();
        showToast('Profile updated ✓');
    } catch(e) { showToast(`Failed: ${e.message}`, 'error'); }
}
window.saveAdminProfile = saveAdminProfile;

// ============================================================
//  COMMENT REPLY SYSTEM (inline replies under any comment)
// ============================================================
async function replyToComment(parentCommentId, projectId, role) {
    const replyBox = document.getElementById(`reply-input-${parentCommentId}`);
    const text = replyBox?.value?.trim();
    if (!text) { showToast('Write a reply first ⚠️', 'error'); return; }
    try {
        await api('POST', `/projects/${projectId}/comments`, {
            projectId,
            authorId:   currentUser.id,
            authorName: currentUser.name,
            authorRole: currentUser.role,
            commentText: `↩ Reply to comment: ${text}`,
            parentId: parentCommentId
        }).catch(()=> api('POST', '/comments', {
            projectId,
            authorId:   currentUser.id,
            authorName: currentUser.name,
            authorRole: currentUser.role,
            commentText: `↩ Reply: ${text}`,
            parentId: parentCommentId
        }));
        showToast('Reply posted ✓');
        await openProjectDetail(projectId, role);
    } catch(e) { showToast(`Reply failed: ${e.message}`, 'error'); }
}
window.replyToComment = replyToComment;

function toggleReplyBox(commentId) {
    const box = document.getElementById(`reply-box-${commentId}`);
    if (!box) return;
    box.style.display = box.style.display === 'none' ? 'flex' : 'none';
    if (box.style.display === 'flex') {
        box.querySelector('textarea')?.focus();
    }
}
window.toggleReplyBox = toggleReplyBox;

window.loadProjectsFromDB = loadProjectsFromDB;
// HR assignment
window.selectAssignmentProject = selectAssignmentProject;
window.toggleDeptSelection = toggleDeptSelection;
window.removeDeptSelection = removeDeptSelection;
window.clearDeptSelection = clearDeptSelection;
window.confirmDeptAssignment = confirmDeptAssignment;
window.backToProjectSelection = backToProjectSelection;
window.goToAssignProject = goToAssignProject;
window.openHRManageProjectModal = openHRManageProjectModal;
window.hrRemoveDeptFromProject = hrRemoveDeptFromProject;
window.hrAddDeptToProject = hrAddDeptToProject;
window.getProjectDepts = getProjectDepts;
// ── Featured Section Tab Switcher ─────────────────────────────
(function() {
    var slides = {
        analytics: {
            title: 'Real-time Team Analytics',
            url:   'spms.app/dashboard/analytics',
            desc:  'Get instant visibility into your entire team\'s performance. Track commits, hours, project velocity, and productivity scores all from a single, beautiful dashboard.',
            bullets: ['Live productivity metrics across all departments', 'AI-powered trend analysis and forecasting', 'Interactive charts with drill-down capability', 'Export reports in CSV, PDF and Excel formats'],
            mockup: function() {
                return '<div class="mockup-stats-row">'
                    + '<div class="mockup-stat-card"><span class="mockup-stat-value" style="color:#6366F1">94</span><div class="mockup-stat-label">Team Score</div><div class="mockup-chart-bar" style="background:linear-gradient(90deg,#6366F1,#8B5CF6);width:94%"></div></div>'
                    + '<div class="mockup-stat-card"><span class="mockup-stat-value" style="color:#10B981">87%</span><div class="mockup-stat-label">On-Time Rate</div><div class="mockup-chart-bar" style="background:linear-gradient(90deg,#10B981,#059669);width:87%"></div></div>'
                    + '<div class="mockup-stat-card"><span class="mockup-stat-value" style="color:#F59E0B">24</span><div class="mockup-stat-label">Active</div><div class="mockup-chart-bar" style="background:linear-gradient(90deg,#F59E0B,#D97706);width:60%"></div></div>'
                    + '</div>'
                    + '<div style="margin-bottom:0.9rem"><div style="font-size:0.75rem;font-weight:600;color:var(--text-secondary);margin-bottom:0.6rem">&#128101; Team Performance</div>'
                    + '<div class="mockup-row"><div class="mockup-avatar">JD</div><div class="mockup-bar-container"><div class="mockup-bar-label"><span>John Doe</span><span>92%</span></div><div class="mockup-progress-bar"><div class="mockup-progress-fill" style="width:92%"></div></div></div></div>'
                    + '<div class="mockup-row"><div class="mockup-avatar" style="background:linear-gradient(135deg,#10B981,#059669)">MJ</div><div class="mockup-bar-container"><div class="mockup-bar-label"><span>Mike Johnson</span><span>88%</span></div><div class="mockup-progress-bar"><div class="mockup-progress-fill" style="width:88%;background:linear-gradient(90deg,#10B981,#059669)"></div></div></div></div>'
                    + '<div class="mockup-row"><div class="mockup-avatar" style="background:linear-gradient(135deg,#F59E0B,#D97706)">CE</div><div class="mockup-bar-container"><div class="mockup-bar-label"><span>Chloe Evans</span><span>91%</span></div><div class="mockup-progress-bar"><div class="mockup-progress-fill" style="width:91%;background:linear-gradient(90deg,#F59E0B,#D97706)"></div></div></div></div>'
                    + '<div class="mockup-row"><div class="mockup-avatar" style="background:linear-gradient(135deg,#8B5CF6,#6366F1)">AT</div><div class="mockup-bar-container"><div class="mockup-bar-label"><span>Alex Thompson</span><span>85%</span></div><div class="mockup-progress-bar"><div class="mockup-progress-fill" style="width:85%;background:linear-gradient(90deg,#8B5CF6,#6366F1)"></div></div></div></div>'
                    + '</div>'
                    + '<div class="mockup-skeleton" style="width:80%"></div><div class="mockup-skeleton" style="width:55%"></div>';
            }
        },
        projects: {
            title: 'Intelligent Project Management',
            url:   'spms.app/dashboard/projects',
            desc:  'Manage every project from inception to completion. Track milestones, monitor team assignments, and spot which projects need attention before issues escalate.',
            bullets: ['Visual project cards with live progress bars', 'Priority & urgency badges at a glance', 'One-click team assignment with skill-matching', 'Deadline countdown with overdue alerts'],
            mockup: function() {
                var data = [
                    { name:'E-Commerce Redesign', code:'PRJ-001', priority:'Critical', pc:'#EF4444', progress:75, days:8,  team:['JD','MJ','CE'], status:'active',  sc:'#10B981' },
                    { name:'Mobile App Dev',      code:'PRJ-002', priority:'High',     pc:'#F59E0B', progress:45, days:21, team:['AT','SC'],       status:'active',  sc:'#10B981' },
                    { name:'API Gateway Upgrade', code:'PRJ-003', priority:'Medium',   pc:'#6366F1', progress:25, days:3,  team:['MJ'],            status:'delayed', sc:'#EF4444' },
                    { name:'Cloud Migration',     code:'PRJ-004', priority:'High',     pc:'#F59E0B', progress:60, days:14, team:['JD','AT'],       status:'active',  sc:'#10B981' }
                ];
                var html = '<div style="display:flex;flex-direction:column;gap:0.5rem">';
                data.forEach(function(p) {
                    var avatars = p.team.map(function(a){ return '<div class="mockup-avatar" style="width:20px;height:20px;font-size:0.5rem;margin-left:-4px">'+a+'</div>'; }).join('');
                    html += '<div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:10px;padding:0.7rem">'
                        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem">'
                        + '<div><div style="font-size:0.78rem;font-weight:700;color:var(--text-primary)">'+p.name+'</div><div style="font-size:0.62rem;color:var(--text-secondary);font-family:monospace">'+p.code+'</div></div>'
                        + '<div style="display:flex;gap:0.35rem;align-items:center">'
                        + '<span style="font-size:0.62rem;font-weight:700;color:'+p.pc+';background:'+p.pc+'22;padding:0.12rem 0.4rem;border-radius:99px">'+p.priority+'</span>'
                        + '<span style="font-size:0.62rem;font-weight:700;color:'+p.sc+'">'+p.status+'</span>'
                        + '</div></div>'
                        + '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.35rem"><div style="flex:1;height:5px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden"><div style="width:'+p.progress+'%;height:100%;background:linear-gradient(90deg,'+p.pc+','+p.pc+'aa);border-radius:3px"></div></div><span style="font-size:0.65rem;font-weight:700;color:var(--text-secondary)">'+p.progress+'%</span></div>'
                        + '<div style="display:flex;justify-content:space-between;align-items:center"><div style="display:flex">'+avatars+'</div><span style="font-size:0.62rem;color:'+(p.days<=5?'#EF4444':'var(--text-secondary)')+'">'+p.days+'d left</span></div>'
                        + '</div>';
                });
                html += '</div>';
                return html;
            }
        },
        workload: {
            title: 'Smart Workload Distribution',
            url:   'spms.app/dashboard/workload',
            desc:  'Prevent burnout and underutilization simultaneously. SPMS gives managers a clear view of team capacity so every project gets the right resources at the right time.',
            bullets: ['Real-time workload % per employee', 'Color-coded overload & underload alerts', 'Department-level capacity overview', 'Skill-based resource recommendations'],
            mockup: function() {
                var people = [
                    { n:'John Doe',      d:'Engineering', w:85, c:'#EF4444', label:'Overloaded' },
                    { n:'Mike Johnson',  d:'Engineering', w:75, c:'#F59E0B', label:'High'       },
                    { n:'Chloe Evans',   d:'Design',      w:65, c:'#F59E0B', label:'Moderate'   },
                    { n:'Alex Thompson', d:'DevOps',       w:40, c:'#10B981', label:'Healthy'    },
                    { n:'Sam Carter',    d:'QA',           w:25, c:'#10B981', label:'Available'  }
                ];
                var html = '<div>'
                    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.65rem">'
                    + '<div style="font-size:0.73rem;font-weight:600;color:var(--text-secondary)">&#9878;&#65039; Team Capacity</div>'
                    + '<div style="display:flex;gap:0.4rem"><span style="font-size:0.6rem;padding:0.12rem 0.45rem;border-radius:99px;background:#EF444422;color:#EF4444">&#9679; High</span><span style="font-size:0.6rem;padding:0.12rem 0.45rem;border-radius:99px;background:#F59E0B22;color:#F59E0B">&#9679; Mid</span><span style="font-size:0.6rem;padding:0.12rem 0.45rem;border-radius:99px;background:#10B98122;color:#10B981">&#9679; OK</span></div>'
                    + '</div>';
                people.forEach(function(e) {
                    var ini = e.n.split(' ').map(function(x){return x[0];}).join('');
                    html += '<div class="mockup-row">'
                        + '<div class="mockup-avatar" style="background:linear-gradient(135deg,'+e.c+'cc,'+e.c+')">'+ini+'</div>'
                        + '<div class="mockup-bar-container">'
                        + '<div class="mockup-bar-label"><span>'+e.n+' <span style="color:var(--text-secondary);font-size:0.6rem">&#183; '+e.d+'</span></span><span style="color:'+e.c+';font-weight:700">'+e.w+'%</span></div>'
                        + '<div class="mockup-progress-bar"><div class="mockup-progress-fill" style="width:'+e.w+'%;background:'+e.c+'"></div></div>'
                        + '</div>'
                        + '<span style="font-size:0.58rem;font-weight:600;color:'+e.c+';white-space:nowrap;margin-left:0.4rem">'+e.label+'</span>'
                        + '</div>';
                });
                html += '<div style="margin-top:0.65rem;padding-top:0.65rem;border-top:1px solid var(--border);display:flex;gap:0.5rem">'
                    + '<div class="mockup-stat-card" style="flex:1;padding:0.45rem;text-align:center"><div style="font-size:0.95rem;font-weight:800;color:#EF4444">2</div><div class="mockup-stat-label">Overloaded</div></div>'
                    + '<div class="mockup-stat-card" style="flex:1;padding:0.45rem;text-align:center"><div style="font-size:0.95rem;font-weight:800;color:#F59E0B">2</div><div class="mockup-stat-label">At Capacity</div></div>'
                    + '<div class="mockup-stat-card" style="flex:1;padding:0.45rem;text-align:center"><div style="font-size:0.95rem;font-weight:800;color:#10B981">1</div><div class="mockup-stat-label">Available</div></div>'
                    + '</div></div>';
                return html;
            }
        },
        performance: {
            title: 'Deep Performance Tracking',
            url:   'spms.app/dashboard/performance',
            desc:  'Go beyond surface-level metrics. Track daily commits, task completion, stress levels, and historical trends to support each team member\'s growth journey.',
            bullets: ['Individual performance scores & history', 'Daily activity log — commits, tasks, hours', 'Stress level & wellbeing indicators', 'Comparative benchmarking across the team'],
            mockup: function() {
                var bars = [65,82,71,90,85,78,92];
                var days = ['M','T','W','T','F','S','S'];
                var members = [
                    { n:'John Doe',     score:92, commits:48, stress:'Low',    sc:'#10B981' },
                    { n:'Chloe Evans',  score:88, commits:39, stress:'Medium', sc:'#F59E0B' },
                    { n:'Mike Johnson', score:85, commits:35, stress:'High',   sc:'#EF4444' }
                ];
                var html = '<div class="mockup-stats-row" style="margin-bottom:0.75rem">'
                    + '<div class="mockup-stat-card"><span class="mockup-stat-value" style="color:#6366F1">245</span><div class="mockup-stat-label">Total Commits</div></div>'
                    + '<div class="mockup-stat-card"><span class="mockup-stat-value" style="color:#10B981">7.8h</span><div class="mockup-stat-label">Avg/Day</div></div>'
                    + '<div class="mockup-stat-card"><span class="mockup-stat-value" style="color:#F59E0B">92</span><div class="mockup-stat-label">Top Score</div></div>'
                    + '</div>'
                    + '<div style="font-size:0.68rem;font-weight:600;color:var(--text-secondary);margin-bottom:0.3rem">&#128200; Weekly Activity</div>'
                    + '<div style="display:flex;align-items:flex-end;gap:3px;height:48px;margin-bottom:3px">';
                bars.forEach(function(h, i) {
                    html += '<div style="flex:1;background:linear-gradient(to top,#6366F1,#8B5CF6);height:'+h+'%;border-radius:3px 3px 0 0;opacity:'+(i===6?'1':'0.5')+'"></div>';
                });
                html += '</div><div style="display:flex;gap:3px;margin-bottom:0.75rem">';
                days.forEach(function(d){ html += '<div style="flex:1;text-align:center;font-size:0.58rem;color:var(--text-tertiary)">'+d+'</div>'; });
                html += '</div>';
                members.forEach(function(m) {
                    var ini = m.n.split(' ').map(function(x){return x[0];}).join('');
                    html += '<div class="mockup-row">'
                        + '<div class="mockup-avatar">'+ini+'</div>'
                        + '<div class="mockup-bar-container">'
                        + '<div class="mockup-bar-label"><span>'+m.n+'</span><span style="font-weight:700">'+m.score+'</span></div>'
                        + '<div class="mockup-progress-bar"><div class="mockup-progress-fill" style="width:'+m.score+'%"></div></div>'
                        + '</div>'
                        + '<div style="margin-left:0.5rem;text-align:right;flex-shrink:0"><div style="font-size:0.58rem;color:var(--text-secondary)">'+m.commits+' commits</div><div style="font-size:0.58rem;color:'+m.sc+';font-weight:600">'+m.stress+'</div></div>'
                        + '</div>';
                });
                return html;
            }
        }
    };

    window.switchFeaturedTab = function(tab, btn) {
        document.querySelectorAll('.featured-tab').forEach(function(t){ t.classList.remove('active'); });
        if (btn) btn.classList.add('active');
        var slide = slides[tab];
        if (!slide) return;
        var g = function(id){ return document.getElementById(id); };
        if (g('featuredTitle'))   g('featuredTitle').textContent  = slide.title;
        if (g('featuredDesc'))    g('featuredDesc').textContent   = slide.desc;
        if (g('mockupUrlBar'))    g('mockupUrlBar').textContent   = '\uD83D\uDD12 ' + slide.url;
        if (g('featuredBullets')) g('featuredBullets').innerHTML  = slide.bullets.map(function(b){
            return '<div class="featured-bullet"><div class="featured-bullet-dot">\u2713</div><span>'+b+'</span></div>';
        }).join('');
        var body = g('featuredMockupBody');
        if (body) {
            body.style.opacity = '0';
            body.innerHTML = slide.mockup();
            void body.offsetWidth; // force reflow so transition fires
            body.style.transition = 'opacity 0.2s ease';
            body.style.opacity = '1';
        }
    };
})();
window.initTiltCards = initTiltCards;
window.initSectionScramble = initSectionScramble;
window.initOrbitRings = initOrbitRings;

// Hide scroll hint after first scroll
(function() {
    let hintHidden = false;
    window.addEventListener('scroll', () => {
        if (!hintHidden && window.scrollY > 80) {
            hintHidden = true;
            const hint = document.getElementById('scrollHint');
            if (hint) {
                hint.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                hint.style.opacity = '0';
                hint.style.transform = 'translateX(-50%) translateY(10px)';
                setTimeout(() => { if (hint) hint.style.display = 'none'; }, 400);
            }
        }
    }, { passive: true });
})();