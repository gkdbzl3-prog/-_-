import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !secretKey) {
    throw new Error("Supabase 환경변수가 설정되지 않았어.");
}

export const supabase = createClient(url, secretKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    },
});