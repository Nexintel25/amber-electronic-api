// Local entry point (npm run dev / npm start).
// On Vercel, src/app.js is used directly.
import app from "./app.js";

const port = process.env.PORT || 3003;

// starting server log
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
