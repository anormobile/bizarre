import { z } from "zod";

export const sessionCheckModeSchema = z.enum(["set", "read", "tamper"]);

export const registerInputSchema = z.object({
  email: z
    .string()
    .min(1, "email is required")
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "invalid email format"),
  username: z
    .string()
    .min(3, "username must be 3–32 characters")
    .max(32, "username must be 3–32 characters")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "username may only contain letters, digits, and underscores",
    ),
  password: z.string().min(8, "password must be at least 8 characters"),
});

export const loginInputSchema = z.object({
  emailOrUsername: z.string().min(1, "emailOrUsername is required"),
  password: z.string().min(1, "password is required"),
});
