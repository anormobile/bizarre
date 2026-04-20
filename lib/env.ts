import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters"),
  SESSION_COOKIE_NAME: z.string().default("bizarre_session"),
  SESSION_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(2592000),
  ENABLE_DEV_ROUTES: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

type Env = z.infer<typeof envSchema>;

let _env: Env | undefined;

export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string) {
    if (!_env) _env = envSchema.parse(process.env);
    return _env[prop as keyof Env];
  },
});
