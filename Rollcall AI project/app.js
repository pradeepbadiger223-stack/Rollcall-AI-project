/* Rollcall — Modern UI & Application Controller */
(function () {
  "use strict";

  let D = null;
  let currentUser = null;
  let activeTab = "";

  const $ = (sel) => document.querySelector(sel);

  const ICONS = {
    dashboard: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>`,
    challenges: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    leaderboard: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`,
    mark: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
    approvals: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    compliance: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    settings: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
  };

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.add("hidden"), 3200);
  }

  function svgRing(pct, level) {
    const val = pct !== null ? Math.round(pct) : 0;
    const r = 32;
    const c = 2 * Math.PI * r;
    const offset = c - (val / 100) * c;
    const color = level === "ok" ? "#059669" : level === "warn" ? "#d97706" : "#e11d48";
    return `
      <div class="ring-wrap">
        <svg width="78" height="78" viewBox="0 0 78 78">
          <circle cx="39" cy="39" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="7" />
          <circle cx="39" cy="39" r="${r}" fill="none" stroke="${color}" stroke-width="7"
            stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}" stroke-linecap="round" />
        </svg>
        <div class="ring-text" style="color:${color}">${pct !== null ? val + "%" : "—"}</div>
      </div>`;
  }

  async function init() {
    await DB.open();
    D = await DB.loadAll();
    if (!D.users || D.users.length === 0) {
      D = Seed.build(Logic.todayStr());
      await DB.replaceAll(D);
    } else {
      const writes = Logic.settle(D, Logic.todayStr());
      if (writes.length) await DB.putMany(writes);
    }
    bindAuthEvents();
  }

  function bindAuthEvents() {
    document.querySelectorAll(".demo-card[data-user]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const u = btn.dataset.user;
        const p = btn.dataset.pass;
        $("#username").value = u;
        $("#password").value = p;
        const hash = Seed.hash(u, p);
        const user = D.users.find((x) => x.username.toLowerCase() === u && x.passwordHash === hash);
        if (user) loginAs(user);
      });
    });

    $("#login-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const uname = $("#username").value.trim().toLowerCase();
      const pass = $("#password").value;
      const hash = Seed.hash(uname, pass);
      const user = D.users.find((u) => u.username.toLowerCase() === uname && u.passwordHash === hash);

      if (!user) {
        const err = $("#login-error");
        err.textContent = "Invalid username or password. Try one of the demo cards below.";
        err.classList.remove("hidden");
        return;
      }
      $("#login-error").classList.add("hidden");
      loginAs(user);
    });

    $("#btn-logout").addEventListener("click", () => {
      currentUser = null;
      $("#app-view").classList.add("hidden");
      $("#login-view").classList.remove("hidden");
    });

    $("#btn-reset-demo").addEventListener("click", async () => {
      D = Seed.build(Logic.todayStr());
      await DB.replaceAll(D);
      toast("Demo database restored to initial 4-week state.");
      if (currentUser) {
        currentUser = D.users.find((u) => u.username === currentUser.username) || D.users[0];
        renderApp();
      }
    });
  }

  function loginAs(user) {
    currentUser = user;
    $("#login-view").classList.add("hidden");
    $("#app-view").classList.remove("hidden");

    const initials = user.name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
    $("#user-avatar").textContent = initials;
    $("#user-display-name").textContent = user.name;
    $("#user-role-badge").textContent = user.role.toUpperCase();

    const todayFormatted = new Date().toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric"
    });
    $("#topbar-date").textContent = `📅 ${todayFormatted}`;

    const tabsByRole = {
      student: [
        { id: "dashboard", label: "My Attendance", sub: "Subject-wise compliance & safe absence calculator" },
        { id: "challenges", label: "Challenges & Wallet", sub: "Stake reward points on attendance commitments" },
        { id: "leaderboard", label: "Leaderboard & Badges", sub: "Class rankings and unlocked milestones" }
      ],
      teacher: [
        { id: "mark", label: "Mark Attendance", sub: "Record daily session roll and evaluate active stakes" },
        { id: "approvals", label: "Challenge Approvals", sub: "Review student proposals and monitor class targets" },
        { id: "compliance", label: "Class Compliance", sub: "Real-time student eligibility & shortage report" },
        { id: "leaderboard", label: "Leaderboard", sub: "Student engagement & streak standings" }
      ],
      admin: [
        { id: "compliance", label: "Compliance Report", sub: "Institution-wide shortage audit & recovery metrics" },
        { id: "settings", label: "Policy & Thresholds", sub: "Configure minimum attendance & warning margins" },
        { id: "leaderboard", label: "Leaderboard", sub: "Department-wide student participation standings" }
      ]
    };

    const tabs = tabsByRole[user.role];
    activeTab = tabs[0].id;
    renderTabs(tabs);
    renderApp();
  }

  function renderTabs(tabs) {
    const nav = $("#nav-tabs");
    nav.innerHTML = tabs
      .map(
        (t) =>
          `<button class="nav-tab ${t.id === activeTab ? "active" : ""}" data-tab="${t.id}" data-sub="${t.sub}">
            ${ICONS[t.id] || ""} <span>${t.label}</span>
          </button>`
      )
      .join("");

    const updateHeader = () => {
      const current = tabs.find((t) => t.id === activeTab);
      if (current) {
        $("#page-title").textContent = current.label;
        $("#page-subtitle").textContent = current.sub;
      }
    };
    updateHeader();

    nav.querySelectorAll(".nav-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeTab = btn.dataset.tab;
        nav.querySelectorAll(".nav-tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === activeTab));
        updateHeader();
        renderApp();
      });
    });
  }

  function renderApp() {
    const main = $("#main-content");
    if (activeTab === "dashboard") renderStudentDashboard(main);
    else if (activeTab === "challenges") renderStudentChallenges(main);
    else if (activeTab === "leaderboard") renderLeaderboard(main);
    else if (activeTab === "mark") renderMarkAttendance(main);
    else if (activeTab === "approvals") renderTeacherApprovals(main);
    else if (activeTab === "compliance") renderCompliance(main);
    else if (activeTab === "settings") renderAdminSettings(main);
  }

  /* ---------------- STUDENT VIEWS ---------------- */
  function renderStudentDashboard(main) {
    const sid = currentUser.id;
    const student = D.students.find((s) => s.id === sid) || {};
    const overall = Logic.overallStats(D, sid);
    const streak = Logic.streak(D, sid);
    const bal = Logic.balance(D, sid);
    const avail = Logic.available(D, sid);
    const { required } = Logic.getSettings(D);
    const overallAccent = overall.pct >= required ? "#059669" : "#e11d48";

    const subjCards = D.subjects
      .map((sub) => {
        const st = Logic.subjectStats(D, sid, sub.id);
        const adviceBg = st.level === "low" ? "var(--low-bg)" : st.level === "warn" ? "var(--warn-bg)" : "var(--ok-bg)";
        const adviceColor = st.level === "low" ? "var(--low)" : st.level === "warn" ? "var(--warn)" : "var(--ok)";
        const adviceText =
          st.level === "low"
            ? `Attend next ${st.needed} class(es) to reach ${required}%`
            : `Safe buffer: can miss ${st.canMiss} class(es)`;

        return `
          <div class="subj-card">
            ${svgRing(st.pct, st.level)}
            <div class="subj-info">
              <div class="subj-code">${sub.code}</div>
              <div class="subj-title">${sub.name}</div>
              <div class="subj-meta">Attended <strong>${st.attended}</strong> of <strong>${st.total}</strong> classes</div>
              <div class="subj-advice" style="background:${adviceBg}; color:${adviceColor};">${adviceText}</div>
            </div>
          </div>`;
      })
      .join("");

    main.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card" style="--accent:${overallAccent}">
          <div class="kpi-label">Overall Attendance</div>
          <div class="kpi-val" style="color:${overallAccent}">${overall.pct !== null ? overall.pct.toFixed(1) + "%" : "—"}</div>
          <div class="kpi-foot">${overall.attended} / ${overall.total} sessions · USN ${student.usn || ""}</div>
        </div>
        <div class="kpi-card" style="--accent:#f59e0b">
          <div class="kpi-label">Active Streak</div>
          <div class="kpi-val">${streak} 🔥</div>
          <div class="kpi-foot">Consecutive classes attended</div>
        </div>
        <div class="kpi-card" style="--accent:#2563eb">
          <div class="kpi-label">Reward Wallet</div>
          <div class="kpi-val">${bal} pts</div>
          <div class="kpi-foot">${avail} pts available to stake</div>
        </div>
        <div class="kpi-card" style="--accent:#7c3aed">
          <div class="kpi-label">Badges Unlocked</div>
          <div class="kpi-val">${D.badges.filter((b) => b.studentId === sid).length} / ${Object.keys(Logic.BADGES).length}</div>
          <div class="kpi-foot">Achievement milestones</div>
        </div>
      </div>

      <h2 style="font-size:1.15rem; font-weight:800; margin-bottom:1rem;">Subject Compliance Breakdown</h2>
      <div class="grid-2">${subjCards}</div>
    `;
  }

  function renderStudentChallenges(main) {
    const sid = currentUser.id;
    const avail = Logic.available(D, sid);
    const myChallenges = D.challenges.filter((c) => c.studentId === sid);
    const ledgerRows = D.ledger.filter((l) => l.studentId === sid).slice().reverse();

    main.innerHTML = `
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <h2>Create Attendance Commitment</h2>
            <span class="pill pill-ok">Wallet: ${avail} pts</span>
          </div>
          <form id="challenge-form">
            <div class="field">
              <label>Target Subject</label>
              <select id="ch-subj">
                ${D.subjects.map((s) => `<option value="${s.id}">${s.code} — ${s.name}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label>Commitment Type</label>
              <select id="ch-type">
                <option value="streak_n">Consecutive Class Streak (Next N classes)</option>
                <option value="percent_month">Monthly Attendance Percentage Target</option>
              </select>
            </div>
            <div class="field">
              <label id="ch-target-label">Target Streak (Classes in a row)</label>
              <input type="number" id="ch-target" min="2" max="100" value="5" required />
            </div>
            <div class="field">
              <label>Points to Stake (Bonus: +50% on completion)</label>
              <input type="number" id="ch-stake" min="5" max="${Math.max(5, avail)}" value="${Math.min(15, avail)}" required />
            </div>
            <button type="submit" class="btn btn-primary full-width" ${avail < 5 ? "disabled" : ""}>
              Propose Challenge to Faculty
            </button>
          </form>
        </div>

        <div class="card">
          <div class="card-header"><h2>My Commitments (${myChallenges.length})</h2></div>
          ${
            myChallenges.length === 0
              ? `<p style="color:var(--muted);">You haven't proposed any challenges yet.</p>`
              : myChallenges
                  .map((c) => {
                    const ev = c.status === "active" ? Logic.evaluateChallenge(D, c, Logic.todayStr()) : null;
                    const pct = ev ? Math.min(100, Math.round((ev.current / ev.target) * 100)) : c.status === "completed" ? 100 : 0;
                    const pill =
                      c.status === "completed" ? "pill-ok" : c.status === "failed" ? "pill-low" : c.status === "active" ? "pill-warn" : "pill-neutral";
                    return `
                      <div style="border:1px solid var(--border); border-radius:11px; padding:0.95rem; margin-bottom:0.75rem; background:#f8fafc;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem;">
                          <strong style="font-size:0.94rem;">${Logic.describeChallenge(D, c)}</strong>
                          <span class="pill ${pill}">${c.status.toUpperCase()}</span>
                        </div>
                        <div style="font-size:0.82rem; color:var(--text-secondary); margin-top:0.3rem;">
                          Stake: <strong>${c.stake} pts</strong> · Potential Reward: <strong style="color:var(--ok);">+${c.bonus} pts</strong>
                        </div>
                        ${
                          ev
                            ? `<div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
                               <div style="font-size:0.8rem; font-weight:600; color:var(--primary);">${ev.text}</div>`
                            : ""
                        }
                        ${c.result ? `<div style="font-size:0.82rem; color:var(--text-secondary); margin-top:0.3rem;">${c.result}</div>` : ""}
                        ${c.note ? `<div style="font-size:0.8rem; color:var(--muted); margin-top:0.2rem;">Note: ${c.note}</div>` : ""}
                      </div>`;
                  })
                  .join("")
          }
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h2>Points Ledger Statement</h2></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Transaction Description</th><th>Delta</th></tr></thead>
            <tbody>
              ${ledgerRows
                .map(
                  (l) => `
                <tr>
                  <td>${l.date}</td>
                  <td><strong>${l.reason}</strong></td>
                  <td><span class="pill ${l.delta >= 0 ? "pill-ok" : "pill-low"}">${l.delta >= 0 ? "+" + l.delta : l.delta} pts</span></td>
                </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    $("#ch-type").addEventListener("change", (e) => {
      const isStreak = e.target.value === "streak_n";
      $("#ch-target-label").textContent = isStreak ? "Target Streak (Classes in a row)" : "Target Monthly Percentage (%)";
      $("#ch-target").value = isStreak ? 5 : 85;
    });

    $("#challenge-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const stake = Number($("#ch-stake").value);
      if (stake > Logic.available(D, sid) || stake <= 0) {
        toast("Insufficient available points for that stake.");
        return;
      }
      const type = $("#ch-type").value;
      const target = Number($("#ch-target").value);
      const ch = {
        id: Logic.uid("c"),
        studentId: sid,
        subjectId: $("#ch-subj").value,
        type,
        target,
        stake,
        bonus: Math.round(stake * 0.5),
        benefit: "",
        month: type === "percent_month" ? Logic.monthOf(Logic.todayStr()) : "",
        status: "pending",
        createdAt: Logic.todayStr(),
        startDate: null,
        note: ""
      };
      D.challenges.push(ch);
      await DB.put("challenges", ch);
      toast("Challenge submitted for faculty approval!");
      renderApp();
    });
  }

  /* ---------------- TEACHER VIEWS ---------------- */
  function renderMarkAttendance(main) {
    const today = Logic.todayStr();
    main.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2>Session Attendance Register</h2>
          <div style="display:flex; gap:0.65rem; align-items:center; flex-wrap:wrap;">
            <select id="att-subj" style="width:auto; min-width:230px;">
              ${D.subjects.map((s) => `<option value="${s.id}">${s.code} — ${s.name}</option>`).join("")}
            </select>
            <input type="date" id="att-date" value="${today}" style="width:auto;" />
          </div>
        </div>
        <div id="att-sheet"></div>
      </div>
    `;

    const renderSheet = () => {
      const subjId = $("#att-subj").value;
      const date = $("#att-date").value;
      const sessionId = `${subjId}@${date}`;
      const existing = new Map(
        D.attendance.filter((a) => a.sessionId === sessionId).map((a) => [a.studentId, a.status])
      );

      const state = {};
      D.students.forEach((s) => { state[s.id] = existing.get(s.id) || "P"; });

      const sheet = $("#att-sheet");
      sheet.innerHTML = `
        <div style="margin-bottom:0.9rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
          <span style="font-size:0.84rem; color:var(--muted);">Showing <strong>${D.students.length}</strong> enrolled students · CSE Sem 3</span>
          <button type="button" class="btn btn-outline btn-sm" id="mark-all-p">✓ Mark All Present</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>USN</th><th>Student Name</th><th>Attendance Status</th></tr></thead>
            <tbody>
              ${D.students
                .map((s) => {
                  const u = D.users.find((x) => x.id === s.id) || {};
                  return `
                    <tr>
                      <td style="font-family:monospace; font-weight:600;">${s.usn}</td>
                      <td><strong>${u.name}</strong></td>
                      <td>
                        <div class="status-group" data-sid="${s.id}">
                          ${["P", "L", "A"]
                            .map(
                              (st) =>
                                `<button type="button" class="status-btn ${state[s.id] === st ? "active-" + st : ""}" data-val="${st}">${
                                  st === "P" ? "Present" : st === "L" ? "Late" : "Absent"
                                }</button>`
                            )
                            .join("")}
                        </div>
                      </td>
                    </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>
        <div style="margin-top:1.15rem; display:flex; justify-content:flex-end;">
          <button type="button" class="btn btn-primary" id="save-att">Save Session &amp; Settle Challenges</button>
        </div>
      `;

      sheet.querySelectorAll(".status-group").forEach((grp) => {
        grp.querySelectorAll(".status-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            state[grp.dataset.sid] = btn.dataset.val;
            grp.querySelectorAll(".status-btn").forEach((b) => {
              b.className = "status-btn" + (b.dataset.val === btn.dataset.val ? " active-" + b.dataset.val : "");
            });
          });
        });
      });

      $("#mark-all-p").addEventListener("click", () => {
        D.students.forEach((s) => { state[s.id] = "P"; });
        sheet.querySelectorAll(".status-group").forEach((grp) => {
          grp.querySelectorAll(".status-btn").forEach((b) => {
            b.className = "status-btn" + (b.dataset.val === "P" ? " active-P" : "");
          });
        });
      });

      $("#save-att").addEventListener("click", async () => {
        const writes = [];
        let sess = D.sessions.find((s) => s.id === sessionId);
        if (!sess) {
          sess = { id: sessionId, subjectId: subjId, date };
          D.sessions.push(sess);
          writes.push(["sessions", sess]);
        }
        D.students.forEach((s) => {
          const attId = `${sessionId}|${s.id}`;
          let rec = D.attendance.find((a) => a.id === attId);
          if (!rec) {
            rec = { id: attId, sessionId, studentId: s.id, status: state[s.id] };
            D.attendance.push(rec);
          } else {
            rec.status = state[s.id];
          }
          writes.push(["attendance", rec]);
        });

        const settleWrites = Logic.settle(D, Logic.todayStr());
        await DB.putMany([...writes, ...settleWrites]);
        toast(`Attendance saved for ${date}. Active challenges settled!`);
      });
    };

    $("#att-subj").addEventListener("change", renderSheet);
    $("#att-date").addEventListener("change", renderSheet);
    renderSheet();
  }

  function renderTeacherApprovals(main) {
    const pending = D.challenges.filter((c) => c.status === "pending");
    const active = D.challenges.filter((c) => c.status === "active");
    const classCh = D.classChallenges;

    main.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2>Pending Challenge Proposals</h2>
          <span class="pill ${pending.length ? "pill-warn" : "pill-neutral"}">${pending.length} Awaiting Review</span>
        </div>
        ${
          pending.length === 0
            ? `<p style="color:var(--muted);">All student challenge proposals have been reviewed.</p>`
            : pending
                .map((c) => {
                  const u = D.users.find((x) => x.id === c.studentId) || {};
                  return `
                    <div style="border:1px solid var(--border); border-radius:11px; padding:1rem; margin-bottom:0.75rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem; background:#f8fafc;">
                      <div>
                        <strong>${u.name}</strong> · <span style="color:var(--primary); font-weight:600;">${Logic.describeChallenge(D, c)}</span>
                        <div style="font-size:0.83rem; color:var(--text-secondary); margin-top:0.2rem;">
                          Staking <strong>${c.stake} pts</strong> for a <strong>+${c.bonus} pts</strong> bonus
                        </div>
                      </div>
                      <div style="display:flex; gap:0.5rem;">
                        <button class="btn btn-ok btn-sm" data-approve="${c.id}">Approve &amp; Lock Stake</button>
                        <button class="btn btn-low btn-sm" data-reject="${c.id}">Decline</button>
                      </div>
                    </div>`;
                })
                .join("")
        }
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header"><h2>Active Individual Stakes (${active.length})</h2></div>
          ${active
            .map((c) => {
              const u = D.users.find((x) => x.id === c.studentId) || {};
              const ev = Logic.evaluateChallenge(D, c, Logic.todayStr());
              const pct = Math.min(100, Math.round((ev.current / ev.target) * 100));
              return `
                <div style="border-bottom:1px solid var(--border); padding:0.85rem 0;">
                  <strong>${u.name}</strong>
                  <div style="font-size:0.86rem; color:var(--text-secondary);">${Logic.describeChallenge(D, c)}</div>
                  <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
                  <div style="font-size:0.8rem; font-weight:600; color:var(--primary);">${ev.text}</div>
                </div>`;
            })
            .join("")}
        </div>

        <div class="card">
          <div class="card-header"><h2>Class-Wide Turnout Goals</h2></div>
          ${classCh
            .map((cc) => {
              const sub = D.subjects.find((s) => s.id === cc.subjectId) || {};
              const ev = Logic.evaluateClassChallenge(D, cc, Logic.todayStr());
              return `
                <div style="border:1px solid var(--border); border-radius:11px; padding:1rem; background:#f8fafc;">
                  <div style="display:flex; justify-content:space-between;">
                    <strong>${sub.name} (≥${cc.threshold}% Turnout)</strong>
                    <span class="pill pill-ok">+${cc.reward} pts / student</span>
                  </div>
                  <div style="font-size:0.83rem; color:var(--text-secondary); margin-top:0.35rem;">Window: ${cc.startDate} to ${cc.endDate}</div>
                  <div style="font-size:0.84rem; font-weight:600; color:var(--primary); margin-top:0.35rem;">${ev.text}</div>
                </div>`;
            })
            .join("")}
        </div>
      </div>
    `;

    main.querySelectorAll("[data-approve]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const c = D.challenges.find((x) => x.id === btn.dataset.approve);
        const today = Logic.todayStr();
        c.status = "active";
        c.startDate = today;
        c.note = "Approved by faculty.";
        const led = {
          id: Logic.uid("l"),
          studentId: c.studentId,
          delta: -c.stake,
          reason: "Stake placed",
          refId: c.id,
          ts: Date.now() * 1000,
          date: today
        };
        D.ledger.push(led);
        await DB.putMany([["challenges", c], ["ledger", led]]);
        toast("Challenge approved and points locked!");
        renderApp();
      });
    });

    main.querySelectorAll("[data-reject]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const c = D.challenges.find((x) => x.id === btn.dataset.reject);
        c.status = "rejected";
        c.note = "Declined by faculty.";
        await DB.put("challenges", c);
        toast("Challenge proposal declined.");
        renderApp();
      });
    });
  }

  /* ---------------- SHARED / ADMIN VIEWS ---------------- */
  function renderCompliance(main) {
    const rows = Logic.compliance(D);
    const { required } = Logic.getSettings(D);
    const shortageCount = rows.filter((r) => r.below > 0).length;

    main.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card" style="--accent:#2563eb">
          <div class="kpi-label">Total Cohort</div>
          <div class="kpi-val">${rows.length}</div>
          <div class="kpi-foot">Active CSE Semester 3 students</div>
        </div>
        <div class="kpi-card" style="--accent:#059669">
          <div class="kpi-label">Fully Compliant</div>
          <div class="kpi-val" style="color:var(--ok);">${rows.length - shortageCount}</div>
          <div class="kpi-foot">Meeting ≥${required}% across all subjects</div>
        </div>
        <div class="kpi-card" style="--accent:#e11d48">
          <div class="kpi-label">Shortage Alerts</div>
          <div class="kpi-val" style="color:var(--low);">${shortageCount}</div>
          <div class="kpi-foot">Below ${required}% in ≥1 subject</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2>Student Compliance Matrix (Minimum Required: ${required}%)</h2>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>USN</th>
                <th>Student Name</th>
                ${D.subjects.map((s) => `<th>${s.code}</th>`).join("")}
                <th>Overall</th>
                <th>Eligibility Status</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (r) => `
                <tr>
                  <td style="font-family:monospace; font-weight:600;">${r.usn}</td>
                  <td><strong>${r.name}</strong></td>
                  ${r.subjects
                    .map((s) => {
                      const cls = s.level === "ok" ? "pill-ok" : s.level === "warn" ? "pill-warn" : "pill-low";
                      return `<td><span class="pill ${cls}">${s.pct !== null ? s.pct.toFixed(0) + "%" : "—"}</span></td>`;
                    })
                    .join("")}
                  <td><strong>${r.overall.pct !== null ? r.overall.pct.toFixed(1) + "%" : "—"}</strong></td>
                  <td>${
                    r.below > 0
                      ? `<span class="pill pill-low">Needs ${r.needed} consecutive class(es)</span>`
                      : `<span class="pill pill-ok">Eligible</span>`
                  }</td>
                </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderLeaderboard(main) {
    const board = Logic.leaderboard(D);
    const myBadges = currentUser.role === "student" ? D.badges.filter((b) => b.studentId === currentUser.id) : [];

    main.innerHTML = `
      ${
        currentUser.role === "student"
          ? `
        <div class="card">
          <div class="card-header"><h2>Achievement Trophy Case</h2></div>
          <div class="badge-grid">
            ${Object.entries(Logic.BADGES)
              .map(([key, info]) => {
                const earned = myBadges.find((b) => b.badgeKey === key);
                return `
                  <div class="badge-item ${earned ? "earned" : "locked"}">
                    <div style="font-size:1.5rem; margin-bottom:0.35rem;">${earned ? "🏆" : "🔒"}</div>
                    <strong style="display:block; font-size:0.95rem;">${info.name}</strong>
                    <p style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.2rem;">${info.text}</p>
                    ${earned ? `<span class="pill pill-ok" style="margin-top:0.5rem;">Unlocked ${earned.earnedAt}</span>` : ""}
                  </div>`;
              })
              .join("")}
          </div>
        </div>`
          : ""
      }

      <div class="card">
        <div class="card-header"><h2>Cohort Points &amp; Streak Leaderboard</h2></div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Rank</th><th>Student</th><th>USN</th><th>Current Streak</th><th>Challenges Won</th><th>Badges</th><th>Total Points</th></tr>
            </thead>
            <tbody>
              ${board
                .map((row, idx) => {
                  const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;
                  return `
                    <tr>
                      <td><strong style="font-size:1rem;">${medal}</strong></td>
                      <td><strong>${row.name}</strong></td>
                      <td style="font-family:monospace;">${row.usn}</td>
                      <td>${row.streak} 🔥</td>
                      <td>${row.completed}</td>
                      <td>${row.badges}</td>
                      <td><span class="pill pill-ok">${row.points} pts</span></td>
                    </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderAdminSettings(main) {
    const { required, margin } = Logic.getSettings(D);
    main.innerHTML = `
      <div class="card" style="max-width:540px;">
        <div class="card-header"><h2>Institutional Policy Configuration</h2></div>
        <form id="settings-form">
          <div class="field">
            <label>Minimum Required Attendance (%)</label>
            <input type="number" id="set-req" min="50" max="95" value="${required}" required />
          </div>
          <div class="field">
            <label>At-Risk Warning Buffer Margin (%)</label>
            <input type="number" id="set-margin" min="1" max="20" value="${margin}" required />
          </div>
          <button type="submit" class="btn btn-primary">Save Policy Thresholds</button>
        </form>
      </div>
    `;

    $("#settings-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const req = { key: "requiredPercent", value: Number($("#set-req").value) };
      const mar = { key: "warnMargin", value: Number($("#set-margin").value) };
      D.settings = [req, mar];
      await DB.putMany([["settings", req], ["settings", mar]]);
      toast("Institutional attendance policy updated.");
    });
  }

  window.addEventListener("DOMContentLoaded", init);
})();