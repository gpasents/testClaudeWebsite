# Chirp

> **Note:** This is a test application, built to try out what Claude (Anthropic's AI assistant, working through Claude Code) can do. It was generated from a short prompt asking for a working Twitter-like single page app. It is a demo and isn't meant for production use.

Chirp is a small Twitter-style single page application written in plain HTML, CSS and JavaScript, with no frameworks and no dependencies. The home wall starts with 10 hard-coded demo posts.

## Features

- **Home feed** with "For you" and "Following" tabs
- **Write posts** with a 280-character limit and a live counter (Ctrl/Cmd + Enter to send)
- **Reply, repost, like and bookmark** any post; delete your own posts
- **Post pages** showing a post with its full reply thread
- **Profiles** with follow/unfollow, and an editable name and bio for your own profile
- **Explore and search** across posts and users; clickable #hashtags and @mentions
- **Trending hashtags** and "Who to follow" in the side panel
- **Saved in the browser**: your activity is kept in `localStorage`, so it survives a refresh. Use "Reset demo data" to go back to the original posts.
- Dark mode that follows your system setting, and a layout that works on phones

## Running it

You need [Node.js](https://nodejs.org/). There's nothing to install.

```bash
npm start
```

Then open <http://localhost:3000>. To use another port, set the `PORT` environment variable.

## Project structure

```
server.js          Small static file server (Node, no dependencies)
public/index.html  Page layout
public/styles.css  Styling, including dark mode and responsive layout
public/app.js      All app logic: demo data, hash-based routing, rendering, actions
```

The demo posts and users are defined in the `seed()` function in `public/app.js`.
