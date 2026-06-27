import { createHash } from "crypto";

export function hashPassword(password: string, email: string) {
  return createHash("sha256")
    .update(`${email.toLowerCase()}:${password}`)
    .digest("hex");
}

export function hashAdminPassword(password: string, username: string) {
  return createHash("sha256")
    .update(`${username.toLowerCase()}:${password}`)
    .digest("hex");
}
