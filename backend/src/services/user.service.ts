import prisma from "../db.js";
import crypto from "node:crypto";

/** Auto-create or get user — prevents foreign key errors */
export async function ensureUser(userId: string, name?: string, role = "student") {
  let user = await prisma.user.findFirst({ where: { OR: [{ id: userId }, { token: userId }] } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: userId,
        name: name || userId,
        role,
        token: crypto.randomBytes(16).toString("hex"),
      },
    });
  }
  return user;
}
