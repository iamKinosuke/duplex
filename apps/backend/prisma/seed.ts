import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";

import { prisma } from "../src/db/prisma.js";
import { ConversationType, MemberRole, MessageType } from "../src/generated/prisma/client.js";

const PASSWORD = "password123";

const PEOPLE = [
  { username: "kinosuke", displayName: "Kinosuke", bio: "Building things." },
  { username: "mai", displayName: "Mai Nguyen", bio: "Designer." },
  { username: "tuan", displayName: "Tuan Le", bio: "Backend engineer." },
  { username: "linh", displayName: "Linh Pham", bio: null },
] as const;

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const users = [];
  for (const person of PEOPLE) {
    const user = await prisma.user.upsert({
      where: { username: person.username },
      update: { displayName: person.displayName, bio: person.bio },
      create: {
        username: person.username,
        email: `${person.username}@example.com`,
        displayName: person.displayName,
        bio: person.bio,
        passwordHash,
      },
    });
    users.push(user);
  }

  const [kinosuke, mai, tuan, linh] = users;
  if (
    kinosuke === undefined ||
    mai === undefined ||
    tuan === undefined ||
    linh === undefined
  ) {
    throw new Error("seed expected four users");
  }

  const directKey = directKeyFor(kinosuke.id, mai.id);
  const direct = await prisma.conversation.upsert({
    where: { directKey },
    update: {},
    create: {
      type: ConversationType.DIRECT,
      directKey,
      members: {
        create: [
          { userId: kinosuke.id, role: MemberRole.MEMBER },
          { userId: mai.id, role: MemberRole.MEMBER },
        ],
      },
    },
  });

  await seedMessages(direct.id, [
    { senderId: mai.id, body: "Ê, cái mockup mới xong rồi nhé." },
    { senderId: kinosuke.id, body: "Ngon. Để tôi ghép vào frontend." },
    { senderId: mai.id, body: "Nhớ kiểm tra dark mode giúp tôi." },
  ]);

  const existingGroup = await prisma.conversation.findFirst({
    where: { type: ConversationType.GROUP, name: "Team Chat" },
  });

  const group =
    existingGroup ??
    (await prisma.conversation.create({
      data: {
        type: ConversationType.GROUP,
        name: "Team Chat",
        ownerId: kinosuke.id,
        members: {
          create: [
            { userId: kinosuke.id, role: MemberRole.OWNER },
            { userId: mai.id, role: MemberRole.ADMIN },
            { userId: tuan.id, role: MemberRole.MEMBER },
            { userId: linh.id, role: MemberRole.MEMBER },
          ],
        },
      },
    }));

  await seedMessages(group.id, [
    { senderId: kinosuke.id, body: "Chào cả nhà, phòng chung của team đây." },
    { senderId: tuan.id, body: "Backend đã lên staging rồi nhé." },
    { senderId: linh.id, body: "Tôi test xong sẽ báo lại." },
    { senderId: mai.id, body: "👍" },
  ]);

  console.log(
    `seeded ${users.length} users, 2 conversations — sign in with ` +
      `kinosuke@example.com / ${PASSWORD}`,
  );
}

function directKeyFor(a: bigint, b: bigint): string {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return `${lo}:${hi}`;
}

async function seedMessages(
  conversationId: bigint,
  entries: ReadonlyArray<{ senderId: bigint; body: string }>,
): Promise<void> {
  const already = await prisma.message.count({ where: { conversationId } });
  if (already > 0) return;

  let last: bigint | undefined;
  for (const entry of entries) {
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: entry.senderId,
        type: MessageType.TEXT,
        body: entry.body,
        clientMsgId: randomUUID(),
      },
    });
    last = message.id;
  }

  if (last !== undefined) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageId: last },
    });
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
