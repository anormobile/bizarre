import { z } from "zod";

export const sessionCheckModeSchema = z.enum(["set", "read", "tamper"]);
