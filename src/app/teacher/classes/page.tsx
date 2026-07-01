import { UserRole } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { createClassAction } from "./actions";

type TeacherClassesPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getInviteLink(inviteCode: string) {
  const username = process.env.TELEGRAM_BOT_USERNAME?.trim();

  if (!username) {
    return null;
  }

  return `https://t.me/${username}?start=class_${inviteCode}`;
}

export default async function TeacherClassesPage({
  searchParams,
}: TeacherClassesPageProps) {
  const teacher = await requireRole(UserRole.TEACHER, "/teacher/login");
  const params = await searchParams;
  const classes = await prisma.classRoom.findMany({
    where: { teacherId: teacher.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      inviteCode: true,
      isActive: true,
      createdAt: true,
      _count: {
        select: { members: true },
      },
    },
  });

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Classes</h1>
        <p className="text-sm text-zinc-600">
          Create classes and share Telegram invite links with students.
        </p>
      </div>

      {params?.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {params.error}
        </div>
      ) : null}

      {!process.env.TELEGRAM_BOT_USERNAME ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          TELEGRAM_BOT_USERNAME is missing. Invite links will show as placeholders.
        </div>
      ) : null}

      <form
        action={createClassAction}
        className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 md:grid-cols-[1fr_1fr_auto]"
      >
        <label className="block space-y-2">
          <span className="text-sm font-medium">Title</span>
          <input
            name="title"
            className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-950"
            required
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium">Description</span>
          <input
            name="description"
            className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-950"
          />
        </label>
        <div className="flex items-end">
          <Button type="submit">Create Class</Button>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Students</th>
              <th className="px-4 py-3 font-medium">Invite link</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {classes.map((classRoom) => {
              const inviteLink = getInviteLink(classRoom.inviteCode);

              return (
                <tr key={classRoom.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{classRoom.title}</div>
                    {classRoom.description ? (
                      <div className="text-xs text-zinc-500">
                        {classRoom.description}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{classRoom._count.members}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    {inviteLink ?? `t.me/<bot>?start=class_${classRoom.inviteCode}`}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {formatDate(classRoom.createdAt)}
                  </td>
                </tr>
              );
            })}
            {classes.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-600">
                  No classes yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
