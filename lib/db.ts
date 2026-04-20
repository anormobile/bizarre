import postgres from "postgres";
import { env } from "@/lib/env";

let _sql: ReturnType<typeof postgres> | undefined;

export function getDb() {
  if (!_sql) _sql = postgres(env.DATABASE_URL);
  return _sql;
}

const sql = new Proxy((() => {}) as unknown as ReturnType<typeof postgres>, {
  get(_target, prop) {
    const db = getDb();
    const val = Reflect.get(db, prop);
    if (typeof val === "function") return val.bind(db);
    return val;
  },
  apply(_target, _thisArg, args) {
    return (getDb() as unknown as (...a: unknown[]) => unknown)(...args);
  },
});

export default sql;
