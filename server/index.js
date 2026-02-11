const express = require("express");

const app = express();
const PORT = process.env.PORT || 8080;

app.get("/", (req, res) => {
  res.send("✅ Certa backend minimal server is alive");
});

app.listen(PORT, () => {
  console.log("🚀 Minimal server running on port", PORT);
});
