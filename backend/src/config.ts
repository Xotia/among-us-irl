import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  databaseUrl: process.env.DATABASE_URL!,
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
};
