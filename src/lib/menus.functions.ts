import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ymdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
const textField = z.string().max(300);

const menuItemSchema = z.object({
  menu_date: ymdSchema,
  base: textField,
  proteins: z.array(textField).length(2),
  sides: z.array(textField).length(2),
  salads: z.array(textField).length(3),
  dessert: textField,
});

export type MenuInput = z.infer<typeof menuItemSchema>;

export type MenuRow = {
  id: string;
  menu_date: string;
  base: string;
  proteins: string[];
  sides: string[];
  salads: string[];
  dessert: string;
};

export const getMenusForWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ weekStartYmd: ymdSchema, days: z.number().int().min(1).max(7).default(5) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const start = new Date(`${data.weekStartYmd}T00:00:00Z`);
    const dates: string[] = [];
    for (let i = 0; i < data.days; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }
    const { data: rows, error } = await context.supabase
      .from("menus")
      .select("id, menu_date, base, proteins, sides, salads, dessert")
      .in("menu_date", dates);
    if (error) throw new Error(error.message);
    return { dates, menus: (rows ?? []) as MenuRow[] };
  });

export const upsertMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => menuItemSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("menus")
      .upsert(data, { onConflict: "menu_date" })
      .select("id, menu_date, base, proteins, sides, salads, dessert")
      .single();
    if (error) throw new Error(error.message);
    return row as MenuRow;
  });

export const upsertMenuWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ items: z.array(menuItemSchema).min(1).max(7) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("menus")
      .upsert(data.items, { onConflict: "menu_date" })
      .select("id, menu_date, base, proteins, sides, salads, dessert");
    if (error) throw new Error(error.message);
    return (rows ?? []) as MenuRow[];
  });
