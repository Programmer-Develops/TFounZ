import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load server/.env if present; fallback to process env
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

function stripTrailingSlash(url) {
  return (url || '').trim().replace(/\/+$/, '');
}

function parseAllowedOrigins(raw) {
  const list = (raw || 'http://localhost:5173')
    .split(',')
    .map((u) => stripTrailingSlash(u))
    .filter(Boolean);
  return list.length > 0 ? list : ['http://localhost:5173'];
}

const allowedOrigins = parseAllowedOrigins(process.env.CLIENT_URL);

const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI || '',
  jwtAccessSecret:
    process.env.JWT_ACCESS_SECRET || 'dev_tfounz_access_secret_change_in_env',
  jwtRefreshSecret:
    process.env.JWT_REFRESH_SECRET || 'dev_tfounz_refresh_secret_change_in_env',
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
  jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  clientUrl: allowedOrigins[0],
  allowedOrigins,
  isOriginAllowed(origin) {
    if (!origin) return true;
    const normalized = stripTrailingSlash(origin);
    if (allowedOrigins.includes('*') || allowedOrigins.includes(normalized)) return true;
    return false;
  },
  geminiApiKey: (process.env.GEMINI_API_KEY || '').trim(),
  geminiModel: (process.env.GEMINI_MODEL || 'gemini-flash-lite-latest').trim(),
  filmyAiUrl:
    stripTrailingSlash(process.env.FILMY_AI_URL) ||
    'https://shantanu-pandya-filmy-ai-api.hf.space',
  sounzAiUrl:
    stripTrailingSlash(process.env.SOUNZ_AI_URL) ||
    'https://shantanu-pandya-sounz-ai.hf.space',
};

export default env;
