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
  clientUrl: stripTrailingSlash(process.env.CLIENT_URL) || 'http://localhost:5173',
  geminiApiKey: (process.env.GEMINI_API_KEY || '').trim(),
  geminiModel: (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim(),
  filmyAiUrl:
    stripTrailingSlash(process.env.FILMY_AI_URL) ||
    'https://shantanu-pandya-filmy-ai-api.hf.space',
  sounzAiUrl:
    stripTrailingSlash(process.env.SOUNZ_AI_URL) ||
    'https://shantanu-pandya-sounz-ai.hf.space',
};

export default env;
