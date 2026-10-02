import "dotenv/config";

// Les tests d'intégration utilisent une base dédiée, jamais la base de développement.
const url = process.env.TEST_DATABASE_URL ?? "postgresql://postgres@127.0.0.1:5433/creato_test";
process.env.DATABASE_URL = url;
process.env.SESSION_SECRET ??= "test-secret-test-secret-test-secret-123";
process.env.STORAGE_DIR = "/var/tmp/creato-test-storage";
process.env.AI_PROVIDER = "mock";
process.env.DISCORD_BOT_TOKEN = "";
