/* Rollcall — demo data and password hashing */
(function (root) {
  "use strict";

  const L = root.Logic || require("./logic.js");
  const Seed = {};

  // Pure JavaScript SHA-256 (works offline via file:// protocol)
  function sha256(message) {
    const bytes = unescape(encodeURIComponent(message))
      .split("")
      .map((c) => c.charCodeAt(0));

    const primes = [];
    for (let n = 2; primes.length < 64; n++) {
      if (primes.every((p) => n % p)) primes.push(n);
    }
    const frac = (x) => Math.floor((x - Math.floor(x)) * 4294967296) >>> 0;
    const K = primes.map((p) => frac(Math.cbrt(p)));
    const H = primes.slice(0, 8).map((p) => frac(Math.sqrt(p)));
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));

    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) {
      bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 255);
    }

    for (let off = 0; off < bytes.length; off += 64) {
      const w = new Array(64);
      for (let i = 0; i < 16; i++) {
        w[i] =
          (bytes[off + 4 * i] << 24) |
          (bytes[off + 4 * i + 1] << 16) |
          (bytes[off + 4 * i + 2] << 8) |
          bytes[off + 4 * i + 3];
      }
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }

      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;

        h = g;
        g = f;
        f = e;
        e = (d + t1) | 0;
        d = c;
        c = b;
        b = a;
        a = (t1 + t2) | 0;
      }
      [a, b, c, d, e, f, g, h].forEach((v, i) => {
        H[i] = (H[i] + v) | 0;
      });
    }

    return H.map((v) => (v >>> 0).toString(16).padStart(8, "0")).join("");
  }

  Seed.hash = (username, password) => sha256(username.toLowerCase() + ":" + password);
  Seed.sha256 = sha256;

  const SUBJECTS = [
    { id: "fsd",  code: "FSD",  name: "Full Stack Development",      days: [1, 3, 5] },
    { id: "asp",  code: "ASP",  name: "Applied Statistics",          days: [2, 4] },
    { id: "dbms", code: "DBMS", name: "Database Management Systems", days: [1, 3] },
    { id: "fai",  code: "FAI",  name: "Fundamentals of AI",          days: [2, 5] }
  ];

  const PEOPLE = [
    ["Aarav Nair",      "ENG25CS0101", "aarav",  0.97],
    ["Diya Menon",      "ENG25CS0102", "diya",   0.88],
    ["Kabir Shah",      "ENG25CS0103", "kabir",  0.62],
    ["Meera Iyer",      "ENG25CS0104", "meera",  0.95],
    ["Rohan Gowda",     "ENG25CS0105", "rohan",  0.78],
    ["Sana Khan",       "ENG25CS0106", "sana",   0.76],
    ["Tanvi Rao",       "ENG25CS0107", "tanvi",  0.70],
    ["Vikram Patil",    "ENG25CS0108", "vikram", 0.90],
    ["Ishaan Kulkarni", "ENG25CS0109", "ishaan", 0.82],
    ["Neha Joshi",      "ENG25CS0110", "neha",   0.92]
  ];

  Seed.DEMO_PASSWORDS = {
    admin: "admin123",
    teacher: "teacher123",
    student: "student123"
  };

  Seed.build = function (today) {
    today = today || L.todayStr();
    const D = {
      users: [],
      students: [],
      subjects: [],
      sessions: [],
      attendance: [],
      challenges: [],
      classChallenges: [],
      ledger: [],
      badges: [],
      settings: [
        { key: "requiredPercent", value: 75 },
        { key: "warnMargin", value: 5 }
      ]
    };

    D.users.push({
      id: "u_admin",
      username: "admin",
      name: "Office Admin",
      role: "admin",
      passwordHash: Seed.hash("admin", Seed.DEMO_PASSWORDS.admin)
    });
    D.users.push({
      id: "u_teacher",
      username: "teacher",
      name: "Prof. Anand Rao",
      role: "teacher",
      passwordHash: Seed.hash("teacher", Seed.DEMO_PASSWORDS.teacher)
    });

    SUBJECTS.forEach((s) => D.subjects.push({ id: s.id, code: s.code, name: s.name, days: s.days }));

    PEOPLE.forEach(([name, usn, username]) => {
      const id = "u_" + username;
      D.users.push({
        id,
        username,
        name,
        role: "student",
        passwordHash: Seed.hash(username, Seed.DEMO_PASSWORDS.student)
      });
      D.students.push({
        id,
        usn,
        department: "CSE",
        semester: "3",
        streakResetDate: ""
      });
    });

    // Generate past 4 weeks of sessions
    const sessionsBySubject = {};
    SUBJECTS.forEach((s) => { sessionsBySubject[s.id] = []; });

    for (let back = 28; back >= 1; back--) {
      const date = L.addDays(today, -back);
      const dow = new Date(date + "T00:00:00").getDay();
      SUBJECTS.forEach((s) => {
        if (s.days.includes(dow)) {
          const session = { id: s.id + "@" + date, subjectId: s.id, date };
          D.sessions.push(session);
          sessionsBySubject[s.id].push(session);
        }
      });
    }

    // Populate attendance records matching target attendance ratios
    PEOPLE.forEach(([, username, target], si) => {
      SUBJECTS.forEach((sub, subi) => {
        const list = sessionsBySubject[sub.id];
        const n = list.length;
        const absences = Math.round(n * (1 - target));
        const absentAt = new Set();

        for (let k = 0; k < absences; k++) {
          let idx = Math.floor(((k + 0.5 + ((si * 0.37 + subi * 0.21) % 1) * 0.5) / Math.max(1, absences)) * n) % n;
          while (absentAt.has(idx)) idx = (idx + 1) % n;
          absentAt.add(idx);
        }

        list.forEach((session, i) => {
          const status = absentAt.has(i) ? "A" : (i + si) % 7 === 3 ? "L" : "P";
          D.attendance.push({
            id: session.id + "|u_" + username,
            sessionId: session.id,
            studentId: "u_" + username,
            status
          });
        });
      });
    });

    // Seed ledger, challenges, and class challenges
    let ts = Date.now() * 1000;
    const led = (studentId, delta, reason, refId, date) =>
      D.ledger.push({
        id: L.uid("l"),
        studentId,
        delta,
        reason,
        refId: refId || "",
        ts: ts++,
        date: date || today
      });

    D.students.forEach((s) => led(s.id, 100, "Welcome points", "", L.addDays(today, -28)));

    const month = L.monthOf(today);
    const prevMonth = L.monthOf(L.addDays(month + "-01", -1));

    D.challenges.push({
      id: "c_pending",
      studentId: "u_diya",
      subjectId: "fsd",
      type: "streak_n",
      target: 5,
      stake: 20,
      bonus: 10,
      benefit: "",
      month: "",
      status: "pending",
      createdAt: today,
      startDate: null,
      note: ""
    });

    D.challenges.push({
      id: "c_active1",
      studentId: "u_kabir",
      subjectId: "fai",
      type: "percent_month",
      target: 80,
      stake: 20,
      bonus: 15,
      benefit: "",
      month,
      status: "active",
      createdAt: today,
      startDate: today,
      note: "Approved to boost FAI compliance."
    });
    led("u_kabir", -20, "Stake placed", "c_active1");

    D.challenges.push({
      id: "c_active2",
      studentId: "u_rohan",
      subjectId: "fsd",
      type: "streak_n",
      target: 4,
      stake: 15,
      bonus: 10,
      benefit: "Teacher-approved: 1 extra mark in the FSD lab record",
      month: "",
      status: "active",
      createdAt: today,
      startDate: today,
      note: "Target raised from 3 to 4 by teacher.",
      modified: true
    });
    led("u_rohan", -15, "Stake placed", "c_active2");

    D.challenges.push({
      id: "c_done",
      studentId: "u_aarav",
      subjectId: "dbms",
      type: "streak_n",
      target: 3,
      stake: 10,
      bonus: 5,
      benefit: "",
      month: "",
      status: "completed",
      createdAt: L.addDays(today, -20),
      startDate: L.addDays(today, -20),
      settledAt: L.addDays(today, -12),
      result: "Attended 3 classes in a row.",
      note: ""
    });
    led("u_aarav", -10, "Stake placed", "c_done", L.addDays(today, -20));
    led("u_aarav", 10, "Stake returned", "c_done", L.addDays(today, -12));
    led("u_aarav", 5, "Challenge bonus", "c_done", L.addDays(today, -12));
    D.badges.push({ id: L.uid("b"), studentId: "u_aarav", badgeKey: "first_win", earnedAt: L.addDays(today, -12) });

    D.challenges.push({
      id: "c_failed",
      studentId: "u_tanvi",
      subjectId: "asp",
      type: "percent_month",
      target: 80,
      stake: 25,
      bonus: 15,
      benefit: "",
      month: prevMonth,
      status: "failed",
      createdAt: L.addDays(today, -40),
      startDate: L.addDays(today, -40),
      settledAt: L.addDays(month + "-01", -1),
      result: "Finished the month at 70% (target 80%).",
      note: ""
    });
    led("u_tanvi", -25, "Stake placed", "c_failed", L.addDays(today, -40));
    led("u_tanvi", 0, "Stake lost: challenge missed", "c_failed", L.addDays(month + "-01", -1));

    D.classChallenges.push({
      id: "cc_active",
      subjectId: "fsd",
      threshold: 80,
      startDate: today,
      endDate: L.addDays(today, 14),
      reward: 20,
      status: "active",
      createdBy: "u_teacher",
      createdAt: today
    });

    L.settle(D, today);
    return D;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Seed;
  else root.Seed = Seed;
})(typeof window !== "undefined" ? window : globalThis);