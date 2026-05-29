/**
 * Wires doctor-platform.html demo UI to /api/platform backend.
 */
(function () {
  const API = (window.location.origin.replace(/\/$/, "") + "/api/platform");

  let authToken = localStorage.getItem("platform_token") || "";
  let activeConsultId = null;
  let activeOtherUserId = null;

  function headers(json) {
    const h = json ? { "Content-Type": "application/json" } : {};
    if (authToken) h.Authorization = "Bearer " + authToken;
    return h;
  }

  async function api(path, opts) {
    const res = await fetch(API + path, {
      ...opts,
      headers: { ...headers(opts?.body != null), ...(opts?.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText || "Request failed");
    return data;
  }

  function mapUser(u) {
    return {
      name: u.name,
      initials: u.initials || (u.name || "?").split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase(),
      role: (u.role || "PATIENT").toLowerCase(),
      id: u.id,
      email: u.email,
    };
  }

  function finishAuth(data, successMsg) {
    if (data.step === "2fa_required" && data.pendingToken) {
      localStorage.setItem("platform_pending_2fa", data.pendingToken);
      (window.top || window).location.href = "/verify-2fa";
      return;
    }
    if (!data.token) throw new Error("No session token");
    authToken = data.token;
    localStorage.setItem("platform_token", authToken);
    currentUser = mapUser(data.user);
    currentRole = currentUser.role;
    authAccountRole = currentUser.role;
    bootApp();
    toast(successMsg || "Signed in", "success");
  }

  window.doLogin = async function () {
    const email = document.getElementById("login-email")?.value?.trim();
    const pass = document.getElementById("login-pass")?.value;
    if (!email || !pass) {
      toast("Please enter email and password");
      return;
    }
    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password: pass }),
      });
      finishAuth(data);
    } catch (e) {
      toast(e.message || "Login failed");
    }
  };

  window.doRegister = async function () {
    const tab = document.getElementById("tab-register");
    const first = tab?.querySelectorAll("input[type=text]")[0]?.value?.trim() || "";
    const last = tab?.querySelectorAll("input[type=text]")[1]?.value?.trim() || "";
    const email = tab?.querySelector('input[type="email"]')?.value?.trim();
    const pass = tab?.querySelector('input[type="password"]')?.value;
    const name = `${first} ${last}`.trim() || email?.split("@")[0] || "";
    if (!email || !pass || !name) {
      toast("Fill name, email and password");
      return;
    }
    const payload = {
      email,
      password: pass,
      name,
      role: currentRole === "doctor" ? "DOCTOR" : "PATIENT",
    };
    if (currentRole === "doctor") {
      const df = document.getElementById("doctor-fields");
      payload.regNo = df?.querySelector('input[type="text"]')?.value || "";
      payload.specialty = df?.querySelector("select")?.value || "General Physician";
      payload.experience =
        parseInt(df?.querySelector('input[type="number"]')?.value || "0", 10) || 0;
      payload.hospital = "";
    }
    try {
      const data = await api("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      authToken = data.token;
      localStorage.setItem("platform_token", authToken);
      finishAuth(data, "Account created");
    } catch (e) {
      toast(e.message || "Registration failed");
    }
  };

  window.doLogout = function () {
    authToken = "";
    localStorage.removeItem("platform_token");
    localStorage.removeItem("platform_pending_2fa");
    currentUser = null;
    if (window.top && window.top !== window) {
      window.top.location.href = "/login";
      return;
    }
    document.getElementById("screen-auth")?.classList.add("active");
    document.getElementById("screen-app")?.classList.remove("active");
    toast("Signed out");
  };

  window.populatePosts = async function () {
    const el = document.getElementById("posts-list");
    if (!el) return;
    try {
      const data = await api("/posts");
      const posts = data.posts || [];
      if (!posts.length) {
        el.innerHTML = '<p style="color:var(--ink3);padding:20px">No posts yet. Patients can ask the first question.</p>';
        return;
      }
      el.innerHTML = posts
        .map(
          (post) => `
    <div class="post-card">
      <div class="post-header">
        <div class="post-avatar pat">${(post.author || "P")[0]}</div>
        <div>
          <div class="post-author">${post.author || "Patient"}</div>
          <div class="post-meta">${new Date(post.time).toLocaleString()}</div>
        </div>
        <div class="post-tags">${(post.tags || []).map((t) => `<span class="post-tag">${t}</span>`).join("")}</div>
      </div>
      <div class="post-title">${post.title}</div>
      <div class="post-body">${post.body}</div>
      <div class="post-footer">
        <div class="post-stats">
          <span class="post-stat">💬 ${post.replies} replies</span>
          <span class="post-stat">🗨️ ${(post.comments || []).length} comments</span>
          <span class="post-stat">❤️ ${post.likes || 0} likes</span>
          <span class="post-stat">👁 ${post.views} views</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="reply-btn" onclick="likePost('${post.id}')">${post.likedByMe ? "💔 Unlike" : "❤️ Like"}</button>
          ${
            currentRole === "doctor"
              ? `<button class="reply-btn doctor" onclick="toggleReplies('${post.id}')">✍️ Add reply</button>`
              : `<button class="reply-btn" onclick="toggleReplies('${post.id}')">View replies</button>`
          }
        </div>
      </div>
      <div class="replies-section" id="replies-${post.id}" style="display:none">
        <div style="margin:8px 0 12px">
          <div style="font-size:12px;color:var(--ink3);margin-bottom:6px">Comments</div>
          ${(post.comments || [])
            .map(
              (c) => `
            <div class="reply-item" style="margin-bottom:8px">
              <div class="reply-avatar">${c.initials}</div>
              <div class="reply-content">
                <div class="reply-author">${c.author} <span class="badge">${c.role}</span></div>
                <div class="reply-text">${c.text}</div>
              </div>
            </div>`
            )
            .join("")}
          <textarea id="comment-input-${post.id}" placeholder="Write a comment…" style="width:100%;height:60px;margin-top:6px"></textarea>
          <button onclick="submitComment('${post.id}')" style="margin-top:6px;padding:7px 12px;background:var(--teal);color:#fff;border:none;border-radius:8px;cursor:pointer">Post comment</button>
        </div>
        ${(post.doctorReplies || [])
          .map(
            (r) => `
          <div class="reply-item">
            <div class="reply-avatar">${r.initials}</div>
            <div class="reply-content">
              <div class="reply-author">${r.doctor} <span class="badge badge-verified">${r.specialty}</span></div>
              <div class="reply-text">${r.text}</div>
              ${
                currentRole === "patient"
                  ? `<button class="tip-btn" onclick="openTipModal('${r.doctor}')">💛 Tip</button>
                     <button class="tip-btn" onclick="startConsultFromReply('${post.id}','${r.id}','${r.doctorId}','${r.doctor}','${r.initials}','${r.specialty || "Doctor"}')">💬 Consult</button>`
                  : ""
              }
            </div>
          </div>`
          )
          .join("")}
        ${
          currentRole === "doctor"
            ? `<textarea id="reply-input-${post.id}" placeholder="Write your medical response…" style="width:100%;height:80px;margin-top:8px"></textarea>
               <button onclick="submitReply('${post.id}')" style="margin-top:8px;padding:8px 14px;background:var(--teal);color:#fff;border:none;border-radius:8px;cursor:pointer">Post reply</button>`
            : ""
        }
      </div>
    </div>`
        )
        .join("");
      const bc = document.getElementById("board-count");
      if (bc) bc.textContent = String(posts.length);
    } catch (e) {
      el.innerHTML = `<p style="color:var(--rose)">${e.message}</p>`;
    }
  };

  window.submitReply = async function (postId) {
    const inp = document.getElementById("reply-input-" + postId);
    const text = inp?.value?.trim();
    if (!text) {
      toast("Please write your response");
      return;
    }
    try {
      await api("/posts/" + postId + "/reply", {
        method: "POST",
        body: JSON.stringify({ body: text }),
      });
      toast("Reply posted", "success");
      inp.value = "";
      populatePosts();
    } catch (e) {
      toast(e.message || "Reply failed");
    }
  };

  window.submitComment = async function (postId) {
    const inp = document.getElementById("comment-input-" + postId);
    const text = inp?.value?.trim();
    if (!text) {
      toast("Please write a comment");
      return;
    }
    try {
      await api("/posts/" + postId + "/comment", {
        method: "POST",
        body: JSON.stringify({ body: text }),
      });
      inp.value = "";
      toast("Comment posted", "success");
      populatePosts();
    } catch (e) {
      toast(e.message || "Comment failed");
    }
  };

  window.likePost = async function (postId) {
    try {
      await api("/posts/" + postId + "/like", { method: "POST" });
      populatePosts();
    } catch (e) {
      toast(e.message || "Like failed");
    }
  };

  window.submitPost = async function () {
    const title = document.getElementById("np-title")?.value?.trim();
    const body = document.getElementById("np-body")?.value?.trim();
    if (!title || !body) {
      toast("Please fill title and description");
      return;
    }
    try {
      await api("/posts", {
        method: "POST",
        body: JSON.stringify({ title, body, tags: [] }),
      });
      closeNewPost();
      toast("Question posted", "success");
      populatePosts();
    } catch (e) {
      toast(e.message || "Post failed");
    }
  };

  window.populateDoctors = async function () {
    const el = document.getElementById("doctors-list");
    if (!el) return;
    try {
      if (currentRole === "patient") {
        const data = await api("/doctors");
        el.innerHTML = (data.doctors || [])
          .map(
            (d) => `
      <div class="doctor-card">
        <div class="doctor-avatar">${d.initials}</div>
        <div class="doctor-info">
          <div class="doctor-name">${d.name}</div>
          <div class="doctor-spec">${d.specialty} · ${d.hospital}</div>
          <div class="doctor-stats">
            <span class="ds">⭐ ${d.rating}</span>
            <span class="ds">💬 ${d.consults}</span>
          </div>
        </div>
        <button class="doctor-action" onclick="startConsultWithId('${d.id}','${d.name}','${d.initials}','${d.specialty}')">💬 Consult</button>
      </div>`
          )
          .join("");
      } else {
        const data = await api("/patients");
        el.innerHTML = (data.patients || [])
          .map(
            (p) => `
      <div class="doctor-card">
        <div class="doctor-avatar" style="background:linear-gradient(135deg,var(--violet),#7c3aed)">${p.initials}</div>
        <div class="doctor-info">
          <div class="doctor-name">${p.name}</div>
          <div class="doctor-spec">${p.condition}</div>
        </div>
        <button class="doctor-action" onclick="startConsultWithId('${p.id}','${p.name}','${p.initials}','${p.condition}')">💬 Message</button>
      </div>`
          )
          .join("");
      }
    } catch (e) {
      el.innerHTML = `<p style="color:var(--rose)">${e.message}</p>`;
    }
  };

  window.startConsultWithId = async function (otherUserId, name, initials, sub) {
    activeOtherUserId = otherUserId;
    try {
      const data = await api("/consultations/start", {
        method: "POST",
        body: JSON.stringify({ otherUserId }),
      });
      activeConsultId = data.consultation?.id;
      const msgs = data.consultation?.messages || [];
      renderConsultMessages(msgs);
      document.getElementById("consult-name").textContent = name;
      document.getElementById("cs-name").textContent = name;
      document.getElementById("cs-sub").textContent = sub;
      document.getElementById("cs-avatar").textContent = initials;
      showPanel("consult");
    } catch (e) {
      toast(e.message || "Could not start consultation");
    }
  };

  window.startConsultFromReply = async function (postId, replyId, doctorId, doctorName, doctorInitials, doctorSpec) {
    try {
      activeOtherUserId = doctorId;
      const data = await api("/consultations/start", {
        method: "POST",
        body: JSON.stringify({ otherUserId: doctorId, postId, replyId })
      });
      activeConsultId = data.consultation?.id;
      renderConsultMessages(data.consultation?.messages || []);
      document.getElementById("consult-name").textContent = doctorName;
      document.getElementById("cs-name").textContent = doctorName;
      document.getElementById("cs-sub").textContent = doctorSpec;
      document.getElementById("cs-avatar").textContent = doctorInitials;
      showPanel("consult");
    } catch (e) {
      toast(e.message || "Could not start consultation");
    }
  };

  window.startDigilockerVerification = async function () {
    if (currentRole !== "doctor") {
      toast("Doctor account required");
      return;
    }
    try {
      const data = await api("/doctors/digilocker/start");
      window.location.href = data.authUrl;
    } catch (e) {
      toast(e.message || "Could not start DigiLocker flow");
    }
  };

  window.refreshDigilockerStatus = async function () {
    if (currentRole !== "doctor") return;
    try {
      const data = await api("/doctors/verification-status");
      const el = document.getElementById("doctor-verify-status");
      if (el) {
        el.textContent = data.verified ? "DigiLocker Verified" : "Verification Pending";
      }
    } catch {
      // ignore UI-only status refresh failures
    }
  };

  function renderConsultMessages(msgs) {
    const box = document.getElementById("chat-msgs-consult");
    if (!box) return;
    box.innerHTML = msgs
      .map((m) => {
        const mine = m.senderId === currentUser?.id;
        const from = mine ? "sent" : "received";
        return `<div class="msg-row ${mine ? "sent" : ""}">
      <div class="msg-bubble ${from}">${m.body}</div>
      <div class="msg-time">${new Date(m.sentAt).toLocaleString()}</div>
    </div>`;
      })
      .join("");
    box.scrollTop = box.scrollHeight;
  }

  window.respondConsult = async function (decision, consultId) {
    const id = consultId || activeConsultId;
    if (!id) {
      toast("Open a consultation first");
      return;
    }
    try {
      await api("/consultations/" + id + "/respond", {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      toast(decision === "ACCEPT" ? "Consultation approved" : "Consultation declined", "success");
      if (typeof window.populateConsultations === "function") window.populateConsultations();
    } catch (e) {
      toast(e.message || "Could not update consultation");
    }
  };

  window.sendConsultMsg = async function () {
    const inp = document.getElementById("consult-input");
    const text = inp?.value?.trim();
    if (!text || !activeConsultId) return;
    inp.value = "";
    try {
      const data = await api("/consultations/" + activeConsultId + "/message", {
        method: "POST",
        body: JSON.stringify({ body: text }),
      });
      const box = document.getElementById("chat-msgs-consult");
      box.insertAdjacentHTML(
        "beforeend",
        `<div class="msg-row sent"><div class="msg-bubble sent">${text}</div><div class="msg-time">Just now</div></div>`
      );
      box.scrollTop = box.scrollHeight;
    } catch (e) {
      toast(e.message || "Send failed");
    }
  };

  window.populateEarnings = async function () {
    const el = document.getElementById("earnings-list");
    if (!el || currentRole !== "doctor") return;
    try {
      const data = await api("/tips/received");
      const tips = data.tips || [];
      el.innerHTML = tips.length
        ? tips
            .map(
              (t) => `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--paper2)">
          <span>${t.patient} · ${t.type}</span><strong>${t.amount}</strong></div>`
            )
            .join("")
        : "<p>No tips yet</p>";
      const totalEl = document.getElementById("earnings-total");
      if (totalEl) totalEl.textContent = "₹" + (data.total || 0);
    } catch (e) {
      el.innerHTML = `<p>${e.message}</p>`;
    }
  };

  window.sendTip = async function () {
    const customVal = document.getElementById("custom-tip-input")?.value;
    const amount = customVal ? parseInt(customVal, 10) : selectedTipAmount;
    if (!amount || amount < 1) {
      toast("Select tip amount");
      return;
    }
    if (!activeOtherUserId) {
      toast("Open a doctor consultation first", "gold");
      closeTipModal();
      return;
    }
    try {
      await api("/tips", {
        method: "POST",
        body: JSON.stringify({ receiverId: activeOtherUserId, amount, note: "Patient tip" }),
      });
      closeTipModal();
      toast("₹" + amount + " sent", "gold");
    } catch (e) {
      toast(e.message || "Tip failed");
    }
  };

  function fillPatientProfileForm(profile, stats, user) {
    const p = profile || {};
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val ?? "";
    };
    set("pf-name", p.name || user?.name);
    set("pf-age", p.age != null ? String(p.age) : "");
    set("pf-blood", p.bloodGroup);
    set("pf-city", p.city);
    set("pf-languages", p.languages);
    set("pf-medications", p.medications);
    set("pf-conditions", Array.isArray(p.conditions) ? p.conditions.join(", ") : "");
    set("pf-allergies", Array.isArray(p.allergies) ? p.allergies.join(", ") : "");

    const initials = user?.initials || (p.name || "?").split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase();
    const av = document.getElementById("pat-ph-avatar");
    const nm = document.getElementById("pat-ph-name");
    const sp = document.getElementById("pat-ph-spec");
    if (av) av.textContent = initials;
    if (nm) nm.textContent = p.name || user?.name || "Patient";
    if (sp) sp.textContent = "Patient · " + (p.city || "—");
    if (stats) {
      const posts = document.getElementById("pat-stat-posts");
      const cons = document.getElementById("pat-stat-consults");
      const tips = document.getElementById("pat-stat-tips");
      if (posts) posts.textContent = String(stats.posts ?? 0);
      if (cons) cons.textContent = String(stats.consultations ?? 0);
      if (tips) tips.textContent = String(stats.tipsGivenCount ?? 0);
    }
    if (user?.name) {
      currentUser = mapUser(user);
      const sbName = document.getElementById("sb-name");
      const sbAv = document.getElementById("sb-avatar");
      if (sbName) sbName.textContent = user.name;
      if (sbAv) sbAv.textContent = initials;
    }
  }

  window.loadPlatformProfile = async function () {
    if (!authToken) return;
    try {
      const data = await api("/profile");
      if (data.profile && (currentRole === "patient" || data.user?.role === "PATIENT")) {
        fillPatientProfileForm(data.profile, data.stats, data.user);
      }
    } catch (e) {
      toast(e.message || "Could not load profile");
    }
  };

  window.platformSaveProfile = async function (e) {
    e.preventDefault();
    if (!authToken) {
      toast("Sign in first", "gold");
      return;
    }
    const btn = document.getElementById("pf-save-btn");
    if (btn) btn.disabled = true;
    try {
      const payload = {
        name: document.getElementById("pf-name")?.value?.trim(),
        age: parseInt(document.getElementById("pf-age")?.value || "", 10) || undefined,
        bloodGroup: document.getElementById("pf-blood")?.value?.trim(),
        city: document.getElementById("pf-city")?.value?.trim(),
        languages: document.getElementById("pf-languages")?.value?.trim(),
        medications: document.getElementById("pf-medications")?.value?.trim(),
        conditions: document.getElementById("pf-conditions")?.value?.trim(),
        allergies: document.getElementById("pf-allergies")?.value?.trim(),
      };
      const data = await api("/profile", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      if (data.user) {
        currentUser = mapUser(data.user);
        authAccountRole = currentUser.role;
      }
      toast(data.message || "Saved to database", "success");
      await window.loadPlatformProfile();
    } catch (err) {
      toast(err.message || "Save failed");
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  const origBoot = window.bootApp;
  window.bootApp = function () {
    if (origBoot) origBoot();
    populatePosts();
    populateDoctors();
    if (currentRole === "doctor") populateEarnings();
    if (document.getElementById("panel-profile")?.classList.contains("active")) {
      window.loadPlatformProfile();
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    if (authToken) {
      api("/auth/me")
        .then((data) => {
          if (!data.valid) throw new Error("Invalid session");
          currentUser = mapUser(data.user);
          currentRole = currentUser.role;
          authAccountRole = currentUser.role;
          bootApp();
        })
        .catch(() => {
          authToken = "";
          localStorage.removeItem("platform_token");
        });
    }
  });
})();
