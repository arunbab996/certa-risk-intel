const express = require("express");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("✅ Certa backend is alive");
});

app.post("/api/scan", (req, res) => {
  res.json({
    message: "Scan endpoint reached",
    query: req.body?.query || null
  });
});

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
