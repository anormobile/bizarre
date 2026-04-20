import postgres from "postgres";
import { env } from "@/lib/env";

const sql = postgres(env.DATABASE_URL);

export default sql;
