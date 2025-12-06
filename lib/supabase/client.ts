import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.debug("Supabase environment variables not available, using mock client")
    return createMockClient()
  }

  // Create a singleton instance
  // @ts-ignore
  if (typeof window !== "undefined") {
    // @ts-ignore
    if (!window._supabaseBrowserClient) {
      // @ts-ignore
      window._supabaseBrowserClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce",
        },
      })
    }
    // @ts-ignore
    return window._supabaseBrowserClient
  }

  // Fallback for SSR (should generally use createServerClient in server components, but this handles edge cases)
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

function createMockClient() {
  const createMockQueryBuilder = (tableName?: string) => {
    const mockResult = { data: [], error: null, count: 0 }

    // Mock data for different tables to make preview more realistic
    const getMockData = (table: string) => {
      switch (table) {
        case "workspaces":
          return [
            {
              id: "1",
              name: "Demo Workspace",
              description: "A sample workspace for preview",
              created_at: new Date().toISOString(),
              created_by: "demo-user",
              position: 0,
              projects: [],
            },
          ]
        case "projects":
          return [
            {
              id: "1",
              name: "Demo Project",
              description: "A sample project for preview",
              workspace_id: "1",
              created_at: new Date().toISOString(),
              due_date: null,
              completed: false,
              position: 0,
            },
          ]
        case "tasks":
          return [
            {
              id: "1",
              title: "Demo Task",
              description: "A sample task for preview",
              project_id: "1",
              status: "todo",
              created_at: new Date().toISOString(),
              position: 0,
            },
          ]
        case "users":
          return [
            {
              id: "demo-user",
              email: "demo@proper.am",
              full_name: "Demo User",
              role: "admin",
              organization: "proper.am",
            },
          ]
        default:
          return []
      }
    }

    const queryBuilder = {
      select: (columns?: string) => {
        // Handle complex select with joins
        if ((columns && columns.includes("creator:users")) || columns.includes("projects(")) {
          const data = getMockData(tableName || "").map((item) => ({
            ...item,
            creator: { full_name: "Demo User" },
            projects: getMockData("projects"),
          }))
          return { ...queryBuilder, mockData: data }
        }
        return { ...queryBuilder, mockData: getMockData(tableName || "") }
      },
      insert: (values: any) => queryBuilder,
      update: (values: any) => queryBuilder,
      delete: () => queryBuilder,
      upsert: (values: any) => queryBuilder,
      eq: (column: string, value: any) => queryBuilder,
      neq: (column: string, value: any) => queryBuilder,
      gt: (column: string, value: any) => queryBuilder,
      gte: (column: string, value: any) => queryBuilder,
      lt: (column: string, value: any) => queryBuilder,
      lte: (column: string, value: any) => queryBuilder,
      like: (column: string, pattern: string) => queryBuilder,
      ilike: (column: string, pattern: string) => queryBuilder,
      is: (column: string, value: any) => queryBuilder,
      in: (column: string, values: any[]) => queryBuilder,
      contains: (column: string, value: any) => queryBuilder,
      containedBy: (column: string, value: any) => queryBuilder,
      rangeGt: (column: string, value: any) => queryBuilder,
      rangeGte: (column: string, value: any) => queryBuilder,
      rangeLt: (column: string, value: any) => queryBuilder,
      rangeLte: (column: string, value: any) => queryBuilder,
      rangeAdjacent: (column: string, value: any) => queryBuilder,
      overlaps: (column: string, value: any) => queryBuilder,
      textSearch: (column: string, query: string) => queryBuilder,
      match: (query: Record<string, any>) => queryBuilder,
      not: (column: string, operator: string, value: any) => queryBuilder,
      or: (filters: string) => queryBuilder,
      filter: (column: string, operator: string, value: any) => queryBuilder,
      order: (column: string, options?: { ascending?: boolean }) => queryBuilder,
      limit: (count: number) => queryBuilder,
      range: (from: number, to: number) => queryBuilder,
      single: () => {
        const data = (queryBuilder as any).mockData || getMockData(tableName || "")
        return Promise.resolve({ data: data[0] || null, error: null })
      },
      maybeSingle: () => {
        const data = (queryBuilder as any).mockData || getMockData(tableName || "")
        return Promise.resolve({ data: data[0] || null, error: null })
      },
      // Support count queries with exact option
      then: (resolve: any) => {
        const data = (queryBuilder as any).mockData || getMockData(tableName || "")
        resolve({ data, error: null, count: data.length })
      },
      catch: (reject: any) => Promise.resolve(mockResult),
    }

    // Make it thenable so it can be awaited directly
    Object.defineProperty(queryBuilder, "then", {
      value: (resolve: any) => {
        const data = (queryBuilder as any).mockData || getMockData(tableName || "")
        resolve({ data, error: null, count: data.length })
      },
      writable: false,
    })

    return queryBuilder
  }

  // Return a mock client that prevents crashes but doesn't perform actual operations
  return {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
      signInWithPassword: () => Promise.resolve({ error: new Error("Supabase not configured") }),
      signUp: () => Promise.resolve({ error: new Error("Supabase not configured") }),
      signOut: () => Promise.resolve({ error: null }),
    },
    from: (tableName: string) => createMockQueryBuilder(tableName),
    rpc: (functionName: string) => createMockQueryBuilder(),
  } as any
}
