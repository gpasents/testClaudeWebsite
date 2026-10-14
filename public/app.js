/* Chirp — a Twitter-like single page app in plain JavaScript.
 * State lives in memory and is persisted to localStorage so your posts,
 * likes, reposts, bookmarks and follows survive a page refresh. */
(() => {
  "use strict";

  const STORAGE_KEY = "chirp-state-v1";
  const MAX_CHARS = 280;
  const ME = "you";
  const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;

  // ---------- Seed data ----------
  function seed() {
    const now = Date.now();
    const users = {
      you: { handle: "you", name: "You", color: "#1d9bf0", bio: "Just setting up my chirp.", verified: false, followers: 12, following: 3 },
      nasa: { handle: "nasa", name: "NASA", color: "#0b3d91", bio: "Exploring the universe and our home planet.", verified: true, followers: 84200000, following: 180 },
      adalovelace: { handle: "adalovelace", name: "Ada Lovelace", color: "#8e44ad", bio: "First programmer. Poetical science enthusiast.", verified: true, followers: 1830, following: 42 },
      chefmarco: { handle: "chefmarco", name: "Marco Rossi", color: "#e67e22", bio: "Pasta is a love language. 🍝", verified: false, followers: 23900, following: 512 },
      devjess: { handle: "devjess", name: "Jess Codes", color: "#16a085", bio: "Frontend engineer. CSS whisperer. Coffee-powered.", verified: false, followers: 9100, following: 701 },
      weatherbot: { handle: "weatherbot", name: "Weather Bot", color: "#2980b9", bio: "Automated forecasts, mostly accurate.", verified: false, followers: 4400, following: 0 },
      hikerlena: { handle: "hikerlena", name: "Lena Berg", color: "#27ae60", bio: "Mountains > meetings. 🏔️", verified: false, followers: 15300, following: 288 },
      bookworm: { handle: "bookworm", name: "The Book Nook", color: "#c0392b", bio: "Independent bookshop. Recommendations daily.", verified: true, followers: 61000, following: 1200 },
    };
    const p = (id, author, text, ago, likes, reposts, extra = {}) => ({
      id, author, text, createdAt: now - ago, likes, reposts,
      liked: false, reposted: false, bookmarked: false, parentId: null, image: null, ...extra,
    });
    const posts = [
      p("p1", "nasa", "Our telescope just captured a stunning new image of a distant spiral galaxy, 50 million light-years away. Every point of light is a sun. 🌌 #space #astronomy", 12 * MIN, 48210, 9120, { image: { emoji: "🌌", bg: "linear-gradient(135deg,#0f2027,#203a43,#2c5364)" } }),
      p("p2", "devjess", "Hot take: 90% of CSS problems are solved by `display: grid` and a cup of coffee. The other 10% are z-index. #webdev #css", 38 * MIN, 1320, 214),
      p("p3", "chefmarco", "Reminder: never, ever break spaghetti before putting it in the pot. My nonna is watching. 👵🍝 #cooking", 1.5 * HOUR, 8740, 1102, { image: { emoji: "🍝", bg: "linear-gradient(135deg,#f6d365,#fda085)" } }),
      p("p4", "adalovelace", "The Analytical Engine weaves algebraic patterns just as the Jacquard loom weaves flowers and leaves. #programming", 3 * HOUR, 5620, 980),
      p("p5", "weatherbot", "☀️ Tomorrow: sunny with a high of 22°C. Perfect weather to finally touch grass. #weather", 5 * HOUR, 312, 41),
      p("p6", "hikerlena", "Made it to the summit at sunrise. 2,400m, numb fingers, zero regrets. 🏔️ @you you need to come next time! #hiking", 8 * HOUR, 3409, 287, { image: { emoji: "🏔️", bg: "linear-gradient(135deg,#ff9a9e,#fad0c4,#a1c4fd)" } }),
      p("p7", "bookworm", "Staff pick of the week: a sci-fi novel about a lone astronaut who has to save Earth with science and an unlikely friend. Bring tissues. 📚 #books", 14 * HOUR, 2210, 390),
      p("p8", "devjess", "Shipped a feature on a Friday. Nothing broke. I'm scared. #webdev", 22 * HOUR, 6870, 1543),
      p("p9", "nasa", "Did you know? A day on Venus is longer than a year on Venus. 🪐 #space", 1.5 * DAY, 30110, 7720),
      p("p10", "chefmarco", "Pineapple on pizza: yes or no? Wrong answers only. 🍍🍕", 2 * DAY, 4450, 612),
      // A few replies so threads have content.
      p("r1", "devjess", "@chefmarco absolutely yes, and add ketchup too.", 1.9 * DAY, 120, 4, { parentId: "p10" }),
      p("r2", "hikerlena", "@chefmarco only if it's served on a mountain top 🏔️", 1.8 * DAY, 88, 2, { parentId: "p10" }),
      p("r3", "adalovelace", "@devjess grid is truly a marvel of computation.", 30 * MIN, 54, 3, { parentId: "p2" }),
    ];
    return { users, posts, following: ["nasa", "devjess", "hikerlena"], repostLog: [], nextId: 1 };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) { /* fall through to seed */ }
    return seed();
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* storage unavailable */ }
  }

  let state = load();
  let homeTab = "foryou";

  // ---------- Helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const main = $("#main");

  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function linkify(text) {
    return esc(text)
      .replace(/(^|\s)#(\w+)/g, (_, pre, tag) => `${pre}<a class="tag" href="#/explore?q=${encodeURIComponent("#" + tag)}">#${tag}</a>`)
      .replace(/(^|\s)@(\w+)/g, (m, pre, h) => state.users[h.toLowerCase()]
        ? `${pre}<a class="mention" href="#/profile/${h.toLowerCase()}">@${h}</a>` : m);
  }

  function fmtNum(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
    return n.toLocaleString();
  }

  function timeAgo(ts) {
    const d = Date.now() - ts;
    if (d < MIN) return Math.max(1, Math.floor(d / 1000)) + "s";
    if (d < HOUR) return Math.floor(d / MIN) + "m";
    if (d < DAY) return Math.floor(d / HOUR) + "h";
    return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  const fullDate = (ts) => new Date(ts).toLocaleString(undefined, { hour: "numeric", minute: "2-digit", month: "short", day: "numeric", year: "numeric" });
  const getPost = (id) => state.posts.find((p) => p.id === id);
  const repliesOf = (id) => state.posts.filter((p) => p.parentId === id).sort((a, b) => a.createdAt - b.createdAt);
  const avatar = (u, cls = "") => `<div class="avatar ${cls}" style="background:${u.color}">${esc(u.name[0])}</div>`;
  const verified = (u) => (u.verified ? ' <span class="verified" title="Verified">✔</span>' : "");

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.add("hidden"), 2200);
  }

  // ---------- Rendering: posts ----------
  function postHTML(post, { repostedBy = null } = {}) {
    const u = state.users[post.author];
    const parent = post.parentId && getPost(post.parentId);
    return `
      <article class="post" data-id="${post.id}">
        ${avatar(u)}
        <div class="post-body">
          ${repostedBy ? `<div class="reposted-by">🔁 ${repostedBy === ME ? "You" : esc(state.users[repostedBy].name)} reposted</div>` : ""}
          <div class="post-meta">
            <a class="name" href="#/profile/${u.handle}">${esc(u.name)}</a>${verified(u)}
            <span class="muted">@${u.handle} · <span title="${fullDate(post.createdAt)}">${timeAgo(post.createdAt)}</span></span>
          </div>
          ${parent ? `<div class="replying-to">Replying to <a class="mention" href="#/profile/${parent.author}">@${parent.author}</a></div>` : ""}
          <div class="post-text">${linkify(post.text)}</div>
          ${post.image ? `<div class="post-image" style="background:${post.image.bg}">${post.image.emoji}</div>` : ""}
          ${actionsHTML(post)}
        </div>
      </article>`;
  }

  function actionsHTML(post) {
    const replies = repliesOf(post.id).length;
    return `
      <div class="actions">
        <button class="action reply" data-act="reply" title="Reply"><span class="ic">💬</span>${replies ? fmtNum(replies) : ""}</button>
        <button class="action repost ${post.reposted ? "on" : ""}" data-act="repost" title="Repost"><span class="ic">🔁</span>${post.reposts ? fmtNum(post.reposts) : ""}</button>
        <button class="action like ${post.liked ? "on" : ""}" data-act="like" title="Like"><span class="ic">${post.liked ? "❤️" : "🤍"}</span>${post.likes ? fmtNum(post.likes) : ""}</button>
        <button class="action bookmark ${post.bookmarked ? "on" : ""}" data-act="bookmark" title="Bookmark"><span class="ic">${post.bookmarked ? "🔖" : "📑"}</span></button>
        ${post.author === ME ? `<button class="action delete" data-act="delete" title="Delete"><span class="ic">🗑️</span></button>` : ""}
      </div>`;
  }

  function composerHTML({ id, placeholder = "What is happening?!", button = "Post" }) {
    return `
      <div class="composer" data-composer="${id}">
        ${avatar(state.users[ME])}
        <div style="flex:1">
          <textarea placeholder="${placeholder}" maxlength="${MAX_CHARS + 50}"></textarea>
          <div class="composer-actions">
            <span class="counter"></span>
            <button class="btn btn-primary" data-submit disabled>${button}</button>
          </div>
        </div>
      </div>`;
  }

  function feedHTML(items, emptyTitle, emptyText) {
    if (!items.length) return `<div class="empty"><h3>${emptyTitle}</h3><p>${emptyText}</p></div>`;
    return items.map((it) => (it.post ? postHTML(it.post, it) : postHTML(it))).join("");
  }

  // Home timeline: top-level posts plus your reposts, newest first.
  function timelineItems(filterAuthors) {
    const items = state.posts
      .filter((p) => !p.parentId)
      .map((p) => ({ post: p, at: p.createdAt }));
    state.repostLog.forEach((r) => {
      const post = getPost(r.postId);
      if (post) items.push({ post, at: r.at, repostedBy: ME });
    });
    return items
      .filter((it) => !filterAuthors || filterAuthors.includes(it.post.author) || it.repostedBy === ME)
      .sort((a, b) => b.at - a.at);
  }

  // ---------- Views ----------
  function viewHome() {
    const items = homeTab === "foryou" ? timelineItems() : timelineItems([...state.following, ME]);
    main.innerHTML = `
      <div class="header">
        <h2>Home</h2>
        <div class="tabs">
          <button class="tab ${homeTab === "foryou" ? "active" : ""}" data-tab="foryou">For you</button>
          <button class="tab ${homeTab === "following" ? "active" : ""}" data-tab="following">Following</button>
        </div>
      </div>
      ${composerHTML({ id: "home" })}
      ${feedHTML(items, "Nothing here yet", "Follow some accounts to fill your timeline.")}`;
  }

  function viewExplore(q) {
    const query = (q || "").trim().toLowerCase();
    const results = query
      ? state.posts.filter((p) => {
          const u = state.users[p.author];
          return p.text.toLowerCase().includes(query) || u.name.toLowerCase().includes(query) || u.handle.includes(query.replace(/^@/, ""));
        }).sort((a, b) => b.createdAt - a.createdAt)
      : [...state.posts].filter((p) => !p.parentId).sort((a, b) => b.likes - a.likes);
    main.innerHTML = `
      <div class="header"><h2>${query ? `Results for “${esc(q)}”` : "Explore · Top posts"}</h2></div>
      ${feedHTML(results, "No results", `Nothing matched “${esc(q || "")}”. Try another search.`)}`;
  }

  function viewBookmarks() {
    const items = state.posts.filter((p) => p.bookmarked).sort((a, b) => b.createdAt - a.createdAt);
    main.innerHTML = `
      <div class="header"><h2>Bookmarks</h2></div>
      ${feedHTML(items, "Save posts for later", "Bookmark posts to easily find them again in the future.")}`;
  }

  function viewProfile(handle) {
    const u = state.users[handle];
    if (!u) return viewNotFound();
    const isMe = handle === ME;
    const following = state.following.includes(handle);
    const posts = state.posts.filter((p) => p.author === handle && !p.parentId).sort((a, b) => b.createdAt - a.createdAt);
    const followingCount = isMe ? state.following.length : u.following;
    const followerCount = u.followers + (following ? 1 : 0);
    main.innerHTML = `
      <div class="header"><h2><a href="#/" title="Back">←</a><span>${esc(u.name)}<br><small class="muted" style="font-size:13px;font-weight:400">${posts.length} posts</small></span></h2></div>
      <div class="banner" style="background:linear-gradient(135deg, ${u.color}, #222)"></div>
      <div class="profile-head">
        <div class="row">
          ${avatar(u, "lg")}
          ${isMe ? `<button class="btn btn-outline" data-act="edit-profile">Edit profile</button>`
                 : `<button class="btn ${following ? "btn-outline" : "btn-dark"}" data-follow="${handle}">${following ? "Following" : "Follow"}</button>`}
        </div>
        <h2>${esc(u.name)}${verified(u)}</h2>
        <div class="muted">@${u.handle}</div>
        <p class="bio">${linkify(u.bio)}</p>
        <div class="follow-stats"><span><b>${fmtNum(followingCount)}</b> Following</span><span><b>${fmtNum(followerCount)}</b> Followers</span></div>
      </div>
      ${feedHTML(posts, isMe ? "You haven't posted yet" : `@${handle} hasn't posted`, isMe ? "When you post, it'll show up here." : "")}`;
  }

  function viewPost(id) {
    const post = getPost(id);
    if (!post) return viewNotFound();
    const u = state.users[post.author];
    const parent = post.parentId && getPost(post.parentId);
    main.innerHTML = `
      <div class="header"><h2><a href="javascript:history.back()" title="Back">←</a>Post</h2></div>
      ${parent ? postHTML(parent) : ""}
      <div class="detail" data-id="${post.id}">
        <div style="display:flex;gap:12px;align-items:center">
          ${avatar(u)}
          <div><a class="name" href="#/profile/${u.handle}"><b>${esc(u.name)}</b></a>${verified(u)}<div class="muted">@${u.handle}</div></div>
        </div>
        <div class="post-text">${linkify(post.text)}</div>
        ${post.image ? `<div class="post-image" style="background:${post.image.bg}">${post.image.emoji}</div>` : ""}
        <div class="stamp">${fullDate(post.createdAt)}</div>
        <div class="stats">
          <span><b>${fmtNum(post.reposts)}</b> Reposts</span>
          <span><b>${fmtNum(post.likes)}</b> Likes</span>
          <span><b>${fmtNum(repliesOf(post.id).length)}</b> Replies</span>
        </div>
        ${actionsHTML(post)}
      </div>
      ${composerHTML({ id: "reply:" + post.id, placeholder: "Post your reply", button: "Reply" })}
      ${repliesOf(post.id).map((r) => postHTML(r)).join("")}`;
  }

  function viewNotFound() {
    main.innerHTML = `<div class="header"><h2>Not found</h2></div><div class="empty"><h3>Hmm… this page doesn't exist.</h3><p><a class="link-btn" href="#/">Go home</a></p></div>`;
  }

  // ---------- Sidebars ----------
  function renderAside() {
    const counts = {};
    state.posts.forEach((p) => (p.text.match(/#\w+/g) || []).forEach((t) => {
      const k = t.toLowerCase();
      counts[k] = (counts[k] || 0) + 1;
    }));
    const trends = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    $("#trends").innerHTML = trends.map(([tag, n], i) => `
      <a class="trend" href="#/explore?q=${encodeURIComponent(tag)}">
        <small>${i + 1} · Trending</small><b>${esc(tag)}</b><small>${n} post${n > 1 ? "s" : ""}</small>
      </a>`).join("");

    const suggestions = Object.values(state.users).filter((u) => u.handle !== ME).slice(0, 4);
    $("#who-to-follow").innerHTML = suggestions.map((u) => {
      const f = state.following.includes(u.handle);
      return `
        <div class="follow-row">
          <a href="#/profile/${u.handle}">${avatar(u)}</a>
          <a class="who" href="#/profile/${u.handle}"><div><b>${esc(u.name)}</b>${verified(u)}</div><div class="muted">@${u.handle}</div></a>
          <button class="btn ${f ? "btn-outline" : "btn-dark"}" data-follow="${u.handle}">${f ? "Following" : "Follow"}</button>
        </div>`;
    }).join("");

    const me = state.users[ME];
    $("#me-card").innerHTML = `${avatar(me)}<div class="who"><b>${esc(me.name)}</b><div class="muted">@${me.handle}</div></div>`;
  }

  // ---------- Router ----------
  function route() {
    const hash = location.hash.slice(1) || "/";
    const [path, qs] = hash.split("?");
    const parts = path.split("/").filter(Boolean);
    const params = new URLSearchParams(qs || "");
    const section = parts[0] || "home";

    document.querySelectorAll(".nav-link").forEach((a) => {
      const active = a.dataset.route === section && (section !== "profile" || parts[1] === ME);
      a.classList.toggle("active", active);
    });

    if (section === "home") viewHome();
    else if (section === "explore") viewExplore(params.get("q"));
    else if (section === "bookmarks") viewBookmarks();
    else if (section === "profile") viewProfile((parts[1] || ME).toLowerCase());
    else if (section === "post") viewPost(parts[1]);
    else viewNotFound();

    if (section === "explore") $("#search").value = params.get("q") || "";
    renderAside();
  }

  // Re-render the current view without losing scroll position or draft text.
  function refresh() {
    const y = window.scrollY;
    const drafts = {};
    document.querySelectorAll("[data-composer]").forEach((c) => (drafts[c.dataset.composer] = c.querySelector("textarea").value));
    route();
    Object.entries(drafts).forEach(([id, val]) => {
      const c = main.querySelector(`[data-composer="${CSS.escape(id)}"]`);
      if (c && val) { c.querySelector("textarea").value = val; updateCounter(c); }
    });
    window.scrollTo(0, y);
  }

  // ---------- Actions ----------
  function createPost(text, parentId = null) {
    const post = {
      id: "u" + state.nextId++, author: ME, text, createdAt: Date.now(),
      likes: 0, reposts: 0, liked: false, reposted: false, bookmarked: false, parentId, image: null,
    };
    state.posts.push(post);
    save();
    return post;
  }

  function act(action, post) {
    switch (action) {
      case "like":
        post.liked = !post.liked;
        post.likes += post.liked ? 1 : -1;
        break;
      case "repost":
        post.reposted = !post.reposted;
        post.reposts += post.reposted ? 1 : -1;
        if (post.reposted) state.repostLog.push({ postId: post.id, at: Date.now() });
        else state.repostLog = state.repostLog.filter((r) => r.postId !== post.id);
        toast(post.reposted ? "Reposted" : "Repost removed");
        break;
      case "bookmark":
        post.bookmarked = !post.bookmarked;
        toast(post.bookmarked ? "Added to your Bookmarks" : "Removed from your Bookmarks");
        break;
      case "reply":
        return openReplyModal(post);
      case "delete": {
        if (!confirm("Delete this post? This can't be undone.")) return;
        // Remove the post and its whole reply thread.
        const doomed = new Set([post.id]);
        let grew = true;
        while (grew) {
          grew = false;
          state.posts.forEach((p) => { if (p.parentId && doomed.has(p.parentId) && !doomed.has(p.id)) { doomed.add(p.id); grew = true; } });
        }
        state.posts = state.posts.filter((p) => !doomed.has(p.id));
        state.repostLog = state.repostLog.filter((r) => !doomed.has(r.postId));
        save();
        toast("Your post was deleted");
        if (location.hash === "#/post/" + post.id) location.hash = "#/";
        else refresh();
        return;
      }
    }
    save();
    refresh();
    // Little "pop" animation on the icon that was clicked.
    const sel = `[data-id="${post.id}"] [data-act="${action}"] .ic`;
    document.querySelectorAll(sel).forEach((el) => el.classList.add("pop"));
  }

  function toggleFollow(handle) {
    const i = state.following.indexOf(handle);
    if (i >= 0) state.following.splice(i, 1);
    else state.following.push(handle);
    toast(i >= 0 ? `Unfollowed @${handle}` : `Following @${handle}`);
    save();
    refresh();
  }

  function updateCounter(composer) {
    const ta = composer.querySelector("textarea");
    const counter = composer.querySelector(".counter");
    const left = MAX_CHARS - ta.value.length;
    counter.textContent = ta.value.length ? left : "";
    counter.className = "counter" + (left < 0 ? " over" : left <= 20 ? " warn" : "");
    composer.querySelector("[data-submit]").disabled = !ta.value.trim() || left < 0;
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
  }

  function submitComposer(composer) {
    const ta = composer.querySelector("textarea");
    const text = ta.value.trim();
    if (!text || text.length > MAX_CHARS) return;
    const id = composer.dataset.composer;
    const parentId = id.startsWith("reply:") ? id.slice(6) : null;
    createPost(text, parentId);
    ta.value = "";
    closeModal();
    toast(parentId ? "Your reply was sent" : "Your post was sent");
    refresh();
  }

  // ---------- Modal ----------
  function openModal(html) {
    $("#modal-body").innerHTML = html;
    $("#modal").classList.remove("hidden");
    const ta = $("#modal-body textarea");
    if (ta) ta.focus();
  }
  function closeModal() { $("#modal").classList.add("hidden"); $("#modal-body").innerHTML = ""; }

  function openReplyModal(post) {
    const u = state.users[post.author];
    openModal(`
      <div class="post">
        ${avatar(u)}
        <div class="post-body">
          <div class="post-meta"><span class="name">${esc(u.name)}</span><span class="muted">@${u.handle} · ${timeAgo(post.createdAt)}</span></div>
          <div class="post-text">${linkify(post.text)}</div>
          <div class="replying-to">Replying to <span class="mention" style="color:var(--accent)">@${u.handle}</span></div>
        </div>
      </div>
      ${composerHTML({ id: "reply:" + post.id, placeholder: "Post your reply", button: "Reply" })}`);
  }

  function openEditProfile() {
    const me = state.users[ME];
    openModal(`
      <div style="padding:0 16px 8px">
        <h2>Edit profile</h2>
        <label class="muted">Name</label>
        <input id="edit-name" class="search" style="border-radius:6px;margin:4px 0 12px" maxlength="50" value="${esc(me.name)}">
        <label class="muted">Bio</label>
        <textarea id="edit-bio" class="search" style="border-radius:6px;margin:4px 0 12px;min-height:80px;resize:vertical" maxlength="160">${esc(me.bio)}</textarea>
        <button class="btn btn-dark" id="save-profile">Save</button>
      </div>`);
    $("#save-profile").onclick = () => {
      me.name = $("#edit-name").value.trim() || "You";
      me.bio = $("#edit-bio").value.trim();
      save();
      closeModal();
      toast("Profile updated");
      refresh();
    };
  }

  // ---------- Event wiring (delegated) ----------
  document.addEventListener("click", (e) => {
    const t = e.target;

    const actBtn = t.closest("[data-act]");
    if (actBtn) {
      e.preventDefault();
      e.stopPropagation();
      if (actBtn.dataset.act === "edit-profile") return openEditProfile();
      const host = actBtn.closest("[data-id]");
      const post = host && getPost(host.dataset.id);
      if (post) act(actBtn.dataset.act, post);
      return;
    }

    const followBtn = t.closest("[data-follow]");
    if (followBtn) { e.preventDefault(); return toggleFollow(followBtn.dataset.follow); }

    const tab = t.closest("[data-tab]");
    if (tab) { homeTab = tab.dataset.tab; return refresh(); }

    const submit = t.closest("[data-submit]");
    if (submit) return submitComposer(submit.closest("[data-composer]"));

    // Clicking a post card (but not a link inside it) opens the thread.
    const card = t.closest(".post[data-id]");
    if (card && !t.closest("a") && !t.closest(".modal")) location.hash = "#/post/" + card.dataset.id;
  });

  document.addEventListener("input", (e) => {
    const composer = e.target.closest("[data-composer]");
    if (composer) updateCounter(composer);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
    // Ctrl/Cmd + Enter posts from any composer.
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      const composer = e.target.closest && e.target.closest("[data-composer]");
      if (composer) submitComposer(composer);
    }
  });

  $("#sidebar-post").onclick = () => openModal(composerHTML({ id: "modal" }));
  $("#modal-close").onclick = closeModal;
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });

  let searchTimer;
  $("#search").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    const q = e.target.value;
    searchTimer = setTimeout(() => {
      location.hash = q.trim() ? "#/explore?q=" + encodeURIComponent(q) : "#/explore";
      setTimeout(() => $("#search").focus(), 0);
    }, 250);
  });

  $("#reset").onclick = () => {
    if (!confirm("Reset all posts, likes and follows to the demo data?")) return;
    state = seed();
    save();
    location.hash = "#/";
    refresh();
    toast("Demo data restored");
  };

  window.addEventListener("hashchange", () => { closeModal(); route(); window.scrollTo(0, 0); });
  // Keep relative timestamps fresh.
  setInterval(() => { if ($("#modal").classList.contains("hidden") && !document.activeElement.matches("textarea, input")) refresh(); }, 30000);

  route();
})();
