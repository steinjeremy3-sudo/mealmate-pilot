// In-memory fake of the supabase-js client, for A2 idempotency tests.
//
// It emulates the slice of the PostgREST query builder our server
// handlers actually use: from / select / insert / upsert / update /
// delete, the eq/in/is/not/gte filters, single / maybeSingle, order /
// limit, count, and FK-based embedded joins ("table ( cols )" /
// "table!inner ( cols )", including one level of nesting).
//
// Crucially it enforces UNIQUE constraints — replaying an insert that
// would duplicate a unique key returns Postgres error 23505, exactly
// as the real DB does. That is what makes "replay → no duplicate" a
// real assertion rather than a tautology.
//
// It is NOT a general Supabase emulator: unsupported syntax throws so
// a test fails loudly instead of passing on a wrong result.

export type Row = Record<string, unknown>;

/** parentTable.embedName → how to resolve the embedded resource. */
export type Relation = {
  /** Table the embedded rows come from. */
  target: string;
  /** Column on the parent row. */
  localKey: string;
  /** Column on the target row (defaults to "id"). */
  targetKey?: string;
};

export type FakeSchema = {
  /** Per table: each entry is a set of columns that must be unique together. */
  unique?: Record<string, string[][]>;
  /** Embedded-join relations, keyed "parentTable.embedName". */
  relations?: Record<string, Relation>;
};

export type FakeDb = Record<string, Row[]>;

type PgResult = { data: unknown; error: { code?: string; message: string } | null };

let idCounter = 0;
function genId(): string {
  idCounter += 1;
  return `fake-id-${idCounter}`;
}

type SelectField = { name: string; embed?: SelectField[]; inner?: boolean };

// Split "a, b ( x, y ), c" on top-level commas (paren-aware).
function splitTopLevel(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

function parseSelect(sel: string): SelectField[] {
  return splitTopLevel(sel)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((token) => {
      const parenIdx = token.indexOf("(");
      if (parenIdx === -1) return { name: token };
      const head = token.slice(0, parenIdx).trim();
      const inner = head.includes("!inner");
      const name = head.split("!")[0].trim();
      const body = token.slice(parenIdx + 1, token.lastIndexOf(")"));
      return { name, inner, embed: parseSelect(body) };
    });
}

export class FakeSupabase {
  private db: FakeDb;
  private schema: FakeSchema;

  constructor(initial: FakeDb, schema: FakeSchema = {}) {
    // Deep-ish clone so a test can't mutate another's seed.
    this.db = {};
    for (const [t, rows] of Object.entries(initial)) {
      this.db[t] = rows.map((r) => ({ ...r }));
    }
    this.schema = schema;
  }

  /** Read raw table contents — for test assertions. */
  table(name: string): Row[] {
    return (this.db[name] ?? []).map((r) => ({ ...r }));
  }

  from(table: string): FakeQuery {
    if (!this.db[table]) this.db[table] = [];
    return new FakeQuery(this.db, this.schema, table);
  }
}

type Filter =
  | { kind: "eq" | "gte"; col: string; val: unknown }
  | { kind: "in"; col: string; vals: unknown[] }
  | { kind: "is"; col: string; val: null }
  | { kind: "not-is"; col: string; val: null };

class FakeQuery implements PromiseLike<PgResult> {
  private op: "select" | "insert" | "upsert" | "update" | "delete" = "select";
  private payload: Row | Row[] | null = null;
  private patch: Row | null = null;
  private upsertOpts: { onConflict?: string; ignoreDuplicates?: boolean } = {};
  private selectFields: SelectField[] | null = null;
  private filters: Filter[] = [];
  private orderBy: { col: string; ascending: boolean } | null = null;
  private limitN: number | null = null;
  private rowMode: "many" | "single" | "maybeSingle" = "many";
  private countMode: "exact" | null = null;
  private headOnly = false;

  constructor(
    private db: FakeDb,
    private schema: FakeSchema,
    private tableName: string,
  ) {}

  // -- mutations -----------------------------------------------------
  insert(payload: Row | Row[]) {
    this.op = "insert";
    this.payload = payload;
    return this;
  }
  upsert(
    payload: Row | Row[],
    opts: { onConflict?: string; ignoreDuplicates?: boolean } = {},
  ) {
    this.op = "upsert";
    this.payload = payload;
    this.upsertOpts = opts;
    return this;
  }
  update(patch: Row) {
    this.op = "update";
    this.patch = patch;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }

  // -- projection ----------------------------------------------------
  select(sel = "*", opts?: { count?: "exact"; head?: boolean }) {
    if (this.op === "select") this.op = "select";
    this.selectFields = sel === "*" ? null : parseSelect(sel);
    if (opts?.count) this.countMode = opts.count;
    if (opts?.head) this.headOnly = true;
    return this;
  }

  // -- filters -------------------------------------------------------
  eq(col: string, val: unknown) {
    this.filters.push({ kind: "eq", col, val });
    return this;
  }
  gte(col: string, val: unknown) {
    this.filters.push({ kind: "gte", col, val });
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filters.push({ kind: "in", col, vals });
    return this;
  }
  is(col: string, val: null) {
    this.filters.push({ kind: "is", col, val });
    return this;
  }
  not(col: string, op: string, val: null) {
    if (op !== "is" || val !== null) {
      throw new Error(`FakeSupabase: only .not(col,'is',null) supported`);
    }
    this.filters.push({ kind: "not-is", col, val });
    return this;
  }
  or(): never {
    throw new Error(
      "FakeSupabase: .or() is not supported — restructure the test query",
    );
  }

  // -- modifiers -----------------------------------------------------
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy = { col, ascending: opts?.ascending ?? true };
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  single() {
    this.rowMode = "single";
    return this;
  }
  maybeSingle() {
    this.rowMode = "maybeSingle";
    return this;
  }

  // -- execution -----------------------------------------------------
  then<R1 = PgResult, R2 = never>(
    onfulfilled?: ((v: PgResult) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }

  private rows(): Row[] {
    return this.db[this.tableName] ?? (this.db[this.tableName] = []);
  }

  private uniqueKeysFor(): string[][] {
    return this.schema.unique?.[this.tableName] ?? [];
  }

  /** Does inserting `candidate` collide with an existing row's unique key? */
  private collides(candidate: Row, ignore?: Row): boolean {
    for (const keyCols of this.uniqueKeysFor()) {
      const same = this.rows().some(
        (r) =>
          r !== ignore &&
          keyCols.every((c) => r[c] !== undefined && r[c] === candidate[c]),
      );
      if (same) return true;
    }
    return false;
  }

  private resolveEmbeds(row: Row, fields: SelectField[] | null): Row {
    // Start from every raw column. Real PostgREST projects down to the
    // selected columns, but filters still apply to the full row — so
    // the fake keeps all columns (harmless extras; our handlers
    // destructure specific fields) and only ADDS resolved embeds.
    const out: Row = { ...row };
    if (!fields) return out;
    for (const f of fields) {
      if (!f.embed) continue;
      const rel = this.schema.relations?.[`${this.tableName}.${f.name}`];
      if (!rel) {
        throw new Error(
          `FakeSupabase: no relation declared for ${this.tableName}.${f.name}`,
        );
      }
      const targetKey = rel.targetKey ?? "id";
      const match = (this.db[rel.target] ?? []).find(
        (t) => t[targetKey] === row[rel.localKey],
      );
      // Recurse for nested embeds, scoped to the target table.
      const nested =
        match &&
        new FakeQuery(this.db, this.schema, rel.target).resolveEmbeds(
          match,
          f.embed,
        );
      out[f.name] = nested ?? null;
    }
    return out;
  }

  /** Read a possibly-dotted path against a (joined) row. */
  private readPath(row: Row, path: string): unknown {
    const parts = path.split(".");
    let cur: unknown = row;
    for (const p of parts) {
      if (cur == null) return undefined;
      const c = cur as Row;
      // The first segment may be the joined resource OR a plain column.
      cur = c[p];
    }
    return cur;
  }

  private passesFilters(joined: Row): boolean {
    for (const f of this.filters) {
      const v = this.readPath(joined, f.col);
      if (f.kind === "eq" && v !== f.val) return false;
      if (f.kind === "is" && v != null) return false;
      if (f.kind === "not-is" && v == null) return false;
      if (f.kind === "in" && !f.vals.includes(v)) return false;
      if (f.kind === "gte") {
        if (v == null) return false;
        if ((v as string | number) < (f.val as string | number)) return false;
      }
    }
    return true;
  }

  private hasMissingInner(joined: Row, fields: SelectField[] | null): boolean {
    if (!fields) return false;
    for (const f of fields) {
      if (f.embed && f.inner) {
        const child = joined[f.name];
        if (child == null) return true;
        if (this.hasMissingInner(child as Row, f.embed)) return true;
      }
    }
    return false;
  }

  private shape(rows: Row[]): PgResult {
    if (this.countMode) {
      return {
        data: this.headOnly ? null : rows,
        error: null,
        // supabase exposes count alongside; tests read `.count`.
        ...(({ count: rows.length }) as object),
      } as PgResult;
    }
    if (this.rowMode === "single") {
      if (rows.length !== 1) {
        return {
          data: null,
          error: { code: "PGRST116", message: "expected exactly one row" },
        };
      }
      return { data: rows[0], error: null };
    }
    if (this.rowMode === "maybeSingle") {
      return { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null };
  }

  private run(): PgResult {
    // ---- INSERT ----
    if (this.op === "insert") {
      const incoming = Array.isArray(this.payload)
        ? this.payload
        : [this.payload as Row];
      const inserted: Row[] = [];
      for (const raw of incoming) {
        const row: Row = { id: genId(), ...raw };
        if (this.collides(row)) {
          return {
            data: null,
            error: {
              code: "23505",
              message: "duplicate key value violates unique constraint",
            },
          };
        }
        this.rows().push(row);
        inserted.push(row);
      }
      if (!this.selectFields && this.rowMode === "many") {
        return { data: null, error: null };
      }
      return this.shape(inserted.map((r) => this.resolveEmbeds(r, this.selectFields)));
    }

    // ---- UPSERT ----
    if (this.op === "upsert") {
      const incoming = Array.isArray(this.payload)
        ? this.payload
        : [this.payload as Row];
      const conflictCol = this.upsertOpts.onConflict;
      const affected: Row[] = [];
      for (const raw of incoming) {
        const existing = conflictCol
          ? this.rows().find((r) => r[conflictCol] === raw[conflictCol])
          : undefined;
        if (existing) {
          if (!this.upsertOpts.ignoreDuplicates) Object.assign(existing, raw);
          affected.push(existing);
        } else {
          const row: Row = { id: genId(), ...raw };
          this.rows().push(row);
          affected.push(row);
        }
      }
      if (!this.selectFields && this.rowMode === "many") {
        return { data: null, error: null };
      }
      return this.shape(affected.map((r) => this.resolveEmbeds(r, this.selectFields)));
    }

    // ---- UPDATE ----
    if (this.op === "update") {
      const affected = this.rows().filter((r) => this.passesFilters(r));
      for (const r of affected) Object.assign(r, this.patch);
      if (!this.selectFields && this.rowMode === "many") {
        return { data: null, error: null };
      }
      return this.shape(affected.map((r) => this.resolveEmbeds(r, this.selectFields)));
    }

    // ---- DELETE ----
    if (this.op === "delete") {
      const keep = this.rows().filter((r) => !this.passesFilters(r));
      const removed = this.rows().length - keep.length;
      this.db[this.tableName] = keep;
      return { data: removed > 0 ? [] : [], error: null };
    }

    // ---- SELECT ----
    let joined = this.rows().map((r) => this.resolveEmbeds(r, this.selectFields));
    joined = joined.filter((r) => this.passesFilters(r));
    joined = joined.filter((r) => !this.hasMissingInner(r, this.selectFields));
    if (this.orderBy) {
      const { col, ascending } = this.orderBy;
      joined.sort((a, b) => {
        const av = a[col] as string | number;
        const bv = b[col] as string | number;
        if (av === bv) return 0;
        return (av < bv ? -1 : 1) * (ascending ? 1 : -1);
      });
    }
    if (this.limitN != null) joined = joined.slice(0, this.limitN);
    return this.shape(joined);
  }
}

/** Convenience: build a fake and return its `createSupabaseAdminClient`-shaped fn. */
export function makeFakeAdmin(initial: FakeDb, schema?: FakeSchema) {
  const fake = new FakeSupabase(initial, schema);
  return { fake, createClient: () => fake };
}
