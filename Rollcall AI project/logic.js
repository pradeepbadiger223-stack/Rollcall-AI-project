/* Rollcall — business logic */
(function (root) {
  "use strict";

  const Logic = {};

  // Small helpers
  const pad = (n) => String(n).padStart(2, "0");
  Logic.toDateStr = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  Logic.todayStr = () => Logic.toDateStr(new Date());

  Logic.addDays = (dateStr, n) => {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + n);
    return Logic.toDateStr(d);
  };

  Logic.monthOf = (dateStr) => dateStr.slice(0, 7);

  Logic.monthEnd = (month) => {
    const [y, m] = month.split("-").map(Number);
    return Logic.toDateStr(new Date(y, m, 0));
  };

  let counter = 0;
  Logic.uid = (prefix) => prefix + Date.now().toString(36) + (counter++).toString(36);
  const nextTs = () => Date.now() * 1000 + (counter++ % 1000);

  Logic.BADGES = {
    first_win:    { name: "First win",         text: "Completed your first challenge." },
    ten_in_a_row: { name: "Ten in a row",      text: "Completed a challenge to attend 10 classes in a row." },
    month_master: { name: "Month master",      text: "Reached a monthly attendance target." },
    streak_5:     { name: "Five-class streak", text: "Attended 5 classes in a row." },
    streak_10:    { name: "Ten-class streak",  text: "Attended 10 classes in a row." },
    class_hero:   { name: "Class hero",        text: "Helped the whole class complete a class challenge." }
  };

  Logic.STREAK_REWARDS = [
    { at: 5,  badge: "streak_5",  points: 10 },
    { at: 10, badge: "streak_10", points: 25 }
  ];

  // Settings
  Logic.getSettings = (D) => {
    const get = (key, fallback) => {
      const row = (D.settings || []).find((s) => s.key === key);
      return row ? Number(row.value) : fallback;
    };
    return { required: get("requiredPercent", 75), margin: get("warnMargin", 5) };
  };

  // Attendance queries
  Logic.marksFor = (D, studentId) => {
    const sessionById = new Map(D.sessions.map((s) => [s.id, s]));
    const rows = [];
    D.attendance.forEach((a) => {
      if (a.studentId !== studentId) return;
      const s = sessionById.get(a.sessionId);
      if (s) rows.push({ date: s.date, subjectId: s.subjectId, status: a.status });
    });
    rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.subjectId.localeCompare(b.subjectId)));
    return rows;
  };

  Logic.subjectStats = (D, studentId, subjectId) => {
    const { required, margin } = Logic.getSettings(D);
    const rows = Logic.marksFor(D, studentId).filter((r) => r.subjectId === subjectId);
    const total = rows.length;
    const attended = rows.filter((r) => r.status !== "A").length;
    const pct = total ? (attended / total) * 100 : null;
    const r = required / 100;

    let level = "none";
    if (total > 0) {
      level = pct < required ? "low" : pct < required + margin ? "warn" : "ok";
    }

    const needed = level === "low" ? Math.ceil((r * total - attended) / (1 - r)) : 0;
    const canMiss = total > 0 && pct >= required ? Math.max(0, Math.floor((attended - r * total) / r)) : 0;

    return { subjectId, attended, total, pct, level, needed, canMiss, required };
  };

  Logic.overallStats = (D, studentId) => {
    const rows = Logic.marksFor(D, studentId);
    const attended = rows.filter((r) => r.status !== "A").length;
    return {
      attended,
      total: rows.length,
      pct: rows.length ? (attended / rows.length) * 100 : null
    };
  };

  Logic.streak = (D, studentId) => {
    const st = D.students.find((s) => s.id === studentId);
    const reset = (st && st.streakResetDate) || "";
    const rows = Logic.marksFor(D, studentId).filter((r) => r.date > reset);
    let n = 0;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].status === "A") break;
      n++;
    }
    return n;
  };

  // Points
  Logic.balance = (D, studentId) =>
    D.ledger.filter((l) => l.studentId === studentId).reduce((sum, l) => sum + l.delta, 0);

  Logic.pendingStake = (D, studentId) =>
    D.challenges
      .filter((c) => c.studentId === studentId && c.status === "pending")
      .reduce((sum, c) => sum + c.stake, 0);

  Logic.available = (D, studentId) => Logic.balance(D, studentId) - Logic.pendingStake(D, studentId);

  // Challenge descriptions
  function monthLabel(month) {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }
  Logic.monthLabel = monthLabel;

  Logic.describeChallenge = (D, c) => {
    const subj = (D.subjects.find((s) => s.id === c.subjectId) || {}).name || "the subject";
    if (c.type === "streak_n") {
      return `Attend the next ${c.target} ${subj} class(es) in a row`;
    }
    return `Reach ${c.target}% attendance in ${subj} during ${monthLabel(c.month)}`;
  };

  // Evaluate student challenge
  Logic.evaluateChallenge = (D, c, today) => {
    const rows = Logic.marksFor(D, c.studentId).filter((r) => r.subjectId === c.subjectId);

    if (c.type === "streak_n") {
      let count = 0;
      for (const r of rows) {
        if (r.date < c.startDate) continue;
        if (r.status === "A") {
          return {
            state: "failed",
            current: count,
            target: c.target,
            text: `${count} of ${c.target} before absence`,
            reason: `Missed a class on ${r.date}.`
          };
        }
        count++;
        if (count >= c.target) {
          return {
            state: "completed",
            current: count,
            target: c.target,
            text: `${count} of ${c.target} completed`,
            reason: `Attended ${c.target} classes in a row.`
          };
        }
      }
      return {
        state: "active",
        current: count,
        target: c.target,
        text: `${count} of ${c.target} so far`,
        reason: ""
      };
    }

    // percent_month
    const inMonth = rows.filter((r) => Logic.monthOf(r.date) === c.month);
    const attended = inMonth.filter((r) => r.status !== "A").length;
    const total = inMonth.length;
    const pct = total ? (attended / total) * 100 : 0;
    const ended = today > Logic.monthEnd(c.month) || c.finalised === true;
    const text = `${total ? Math.round(pct) : 0}% so far (${attended} of ${total})`;

    if (!ended) {
      return { state: "active", current: Math.round(pct), target: c.target, text, reason: "" };
    }
    if (total > 0 && pct >= c.target) {
      return {
        state: "completed",
        current: Math.round(pct),
        target: c.target,
        text,
        reason: `Finished the month at ${Math.round(pct)}% (target ${c.target}%).`
      };
    }
    return {
      state: "failed",
      current: Math.round(pct),
      target: c.target,
      text,
      reason: `Finished the month at ${Math.round(pct)}% (target ${c.target}%).`
    };
  };

  // Class-wide challenges
  Logic.classSessionResults = (D, cc) => {
    const sess = D.sessions.filter(
      (s) => s.subjectId === cc.subjectId && s.date >= cc.startDate && s.date <= cc.endDate
    );
    const results = [];
    sess.forEach((s) => {
      const marks = D.attendance.filter((a) => a.sessionId === s.id);
      if (!marks.length) return;
      const attended = marks.filter((m) => m.status !== "A").length;
      results.push({
        date: s.date,
        attended,
        total: marks.length,
        pct: (attended / marks.length) * 100
      });
    });
    results.sort((a, b) => (a.date < b.date ? -1 : 1));
    return results;
  };

  Logic.evaluateClassChallenge = (D, cc, today) => {
    const results = Logic.classSessionResults(D, cc);
    const bad = results.find((r) => r.pct < cc.threshold);
    if (bad) {
      return {
        state: "failed",
        results,
        text: `Only ${Math.round(bad.pct)}% attended on ${bad.date}`,
        reason: `Attendance dropped to ${Math.round(bad.pct)}% on ${bad.date} (needed ${cc.threshold}%).`
      };
    }
    const ended = today > cc.endDate || cc.finalised === true;
    const text = `${results.length} session(s) so far, all at or above ${cc.threshold}%`;
    if (!ended) return { state: "active", results, text, reason: "" };
    if (results.length > 0) {
      return {
        state: "completed",
        results,
        text,
        reason: `Every session held met the ${cc.threshold}% target.`
      };
    }
    return {
      state: "failed",
      results,
      text,
      reason: "No sessions were held in the challenge window."
    };
  };

  // Settlement engine
  Logic.settle = (D, today) => {
    const writes = [];
    const put = (store, obj) => {
      if (!writes.some((w) => w[1] === obj)) writes.push([store, obj]);
    };

    const ledger = (studentId, delta, reason, refId) => {
      const e = {
        id: Logic.uid("l"),
        studentId,
        delta,
        reason,
        refId: refId || "",
        ts: nextTs(),
        date: today
      };
      D.ledger.push(e);
      put("ledger", e);
    };

    const badge = (studentId, key) => {
      if (D.badges.some((b) => b.studentId === studentId && b.badgeKey === key)) return false;
      const b = { id: Logic.uid("b"), studentId, badgeKey: key, earnedAt: today };
      D.badges.push(b);
      put("badges", b);
      return true;
    };

    D.challenges.filter((c) => c.status === "active").forEach((c) => {
      const r = Logic.evaluateChallenge(D, c, today);
      if (r.state === "active") return;
      c.status = r.state;
      c.settledAt = today;
      c.result = r.reason;
      put("challenges", c);

      if (r.state === "completed") {
        ledger(c.studentId, c.stake, "Stake returned", c.id);
        if (c.bonus > 0) ledger(c.studentId, c.bonus, "Challenge bonus", c.id);
        badge(c.studentId, "first_win");
        if (c.type === "streak_n" && c.target >= 10) badge(c.studentId, "ten_in_a_row");
        if (c.type === "percent_month") badge(c.studentId, "month_master");
      } else {
        ledger(c.studentId, 0, "Stake lost: challenge missed", c.id);
        const st = D.students.find((s) => s.id === c.studentId);
        if (st) {
          st.streakResetDate = today;
          put("students", st);
        }
      }
    });

    D.classChallenges.filter((cc) => cc.status === "active").forEach((cc) => {
      const r = Logic.evaluateClassChallenge(D, cc, today);
      if (r.state === "active") return;
      cc.status = r.state;
      cc.settledAt = today;
      cc.result = r.reason;
      put("classChallenges", cc);

      if (r.state === "completed") {
        D.students.forEach((s) => {
          ledger(s.id, cc.reward, "Class challenge reward", cc.id);
          badge(s.id, "class_hero");
        });
      }
    });

    // Streak milestones
    D.students.forEach((s) => {
      const n = Logic.streak(D, s.id);
      Logic.STREAK_REWARDS.forEach((m) => {
        if (n >= m.at && badge(s.id, m.badge)) {
          ledger(s.id, m.points, `Streak reward (${m.at} classes)`, "");
        }
      });
    });

    return writes;
  };

  // Leaderboard
  Logic.leaderboard = (D) =>
    D.students
      .map((s) => {
        const user = D.users.find((u) => u.id === s.id) || {};
        return {
          id: s.id,
          name: user.name || s.usn,
          usn: s.usn,
          streak: Logic.streak(D, s.id),
          completed: D.challenges.filter((c) => c.studentId === s.id && c.status === "completed").length,
          points: Logic.balance(D, s.id),
          badges: D.badges.filter((b) => b.studentId === s.id).length
        };
      })
      .sort((a, b) => b.points - a.points || b.streak - a.streak);

  // Compliance report
  Logic.compliance = (D) => {
    const { required } = Logic.getSettings(D);
    return D.students.map((s) => {
      const user = D.users.find((u) => u.id === s.id) || {};
      const subjects = D.subjects.map((sub) => Logic.subjectStats(D, s.id, sub.id));
      const below = subjects.filter((x) => x.level === "low");
      const overall = Logic.overallStats(D, s.id);
      return {
        id: s.id,
        name: user.name || s.usn,
        usn: s.usn,
        department: s.department,
        subjects,
        overall,
        below: below.length,
        needed: below.reduce((m, x) => Math.max(m, x.needed), 0),
        required
      };
    });
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Logic;
  else root.Logic = Logic;
})(typeof window !== "undefined" ? window : globalThis);