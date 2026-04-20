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

export const broadcastTestInputSchema = z.object({
  text: z.string().min(1).max(200),
});

export const createRoomInputSchema = z.object({
  name: z.string().min(3).max(48).regex(/^[a-zA-Z0-9_-]+$/, "invalid name"),
  description: z.string().max(256).optional(),
  visibility: z.enum(["public", "private"]),
});

export const sendMessageInputSchema = z
  .object({
    roomId: z.number().int().positive().optional(),
    dmId: z.number().int().positive().optional(),
    userId: z.string().uuid().optional(),
    content: z.string().min(1).max(3072),
  })
  .refine(
    (v) =>
      (v.roomId ? 1 : 0) + (v.dmId ? 1 : 0) + (v.userId ? 1 : 0) === 1,
    { message: "exactly one of roomId, dmId, userId required" },
  );

export const editMessageInputSchema = z.object({
  content: z.string().min(1).max(3072),
});

export const listMessagesQuerySchema = z.object({
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const userSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(48),
});

export const sendFriendRequestInputSchema = z.object({
  username: z.string().trim().min(1).max(48),
  note: z.string().max(200).optional(),
});

export const userIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const dmPathParamSchema = z.object({
  userId: z.string().uuid(),
});

export const listDmMessagesQuerySchema = z.object({
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const presenceStatusSchema = z.enum(['online', 'afk', 'offline']);
