// Minimal zero-dependency static server for the Chirp SPA.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, "public");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split("?")[0]);
    let file = path.normalize(path.join(ROOT, urlPath));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403);
      return res.end("Forbidden");
    }
    fs.stat(file, (err, stat) => {
      // Unknown paths fall back to index.html so client-side routing works.
      if (err || stat.isDirectory()) file = path.join(ROOT, "index.html");
      fs.readFile(file, (err2, data) => {
        if (err2) {
          res.writeHead(500);
          return res.end("Server error");
        }
        res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
        res.end(data);
      });
    });
  })
  .listen(PORT, () => console.log(`Chirp running at http://localhost:${PORT}`));
