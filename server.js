const express = require('express');
const path = require('path');
const app = express();

// Use the PORT environment variable provided by Cloud Run, or fallback to 8080
const port = process.env.PORT || 8080;

// Serve all static files from the current directory
app.use(express.static(__dirname));

// Fallback to index.html for any other requests
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
