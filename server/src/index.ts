try { process.loadEnvFile(); } catch { /* env may be set externally */ }
import app from './app.js';
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Plover backend proxy on port ${PORT}`));
