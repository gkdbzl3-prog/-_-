import { supabase } from "./supabase.js";

// Bearer 토큰을 검증해 req.userId 를 채운다. 없거나 유효하지 않으면 401.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return res.status(401).json({ error: "unauthorized" });
  }

  req.userId = data.user.id;
  next();
}
