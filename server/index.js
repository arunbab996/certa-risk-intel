const express = require("express");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("✅ Certa backend is alive");
});

app.post("/api/scan", (req, res) => {
  const { query } = req.body || {};

  res.json({
    message: "Scan working",
    query,
    data: [],
    related: [],
    brief: "Demo response from backend",
    tweets: []
  });
});

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
