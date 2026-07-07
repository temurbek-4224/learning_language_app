"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentStudent } from "@/lib/student-auth";

export type JoinClassState = {
  status: "idle" | "success" | "error";
  message: string;
};

const initialState: JoinClassState = {
  status: "idle",
  message: "",
};

export { initialState as joinClassInitialState };

function extractInviteCode(input: string) {
  const trimmed = input.trim();

  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    const startParam = url.searchParams.get("start");

    if (startParam?.startsWith("class_")) {
      return startParam.replace(/^class_/, "").trim();
    }
  } catch {
    // Not a full URL; fall through to class_ or plain invite code parsing.
  }

  if (trimmed.startsWith("class_")) {
    return trimmed.replace(/^class_/, "").trim();
  }

  return trimmed;
}

export async function joinClassByInviteCodeAction(
  _previousState: JoinClassState,
  formData: FormData,
): Promise<JoinClassState> {
  const rawInput = formData.get("invite");
  const inviteCode = extractInviteCode(
    typeof rawInput === "string" ? rawInput : "",
  );

  if (!inviteCode) {
    return {
      status: "error",
      message: "Class link yoki invite code kiriting.",
    };
  }

  const student = await getCurrentStudent();

  if (!student) {
    return {
      status: "error",
      message: "Telegram Mini App ichida qayta oching.",
    };
  }

  const classRoom = await prisma.classRoom.findUnique({
    where: { inviteCode },
    select: {
      id: true,
      title: true,
      isActive: true,
    },
  });

  if (!classRoom || !classRoom.isActive) {
    return {
      status: "error",
      message: "Bu class link topilmadi yoki faol emas.",
    };
  }

  const existingMembership = await prisma.classMember.findUnique({
    where: {
      classId_studentId: {
        classId: classRoom.id,
        studentId: student.id,
      },
    },
    select: { id: true },
  });

  if (existingMembership) {
    return {
      status: "success",
      message: "Siz bu classga allaqachon qo'shilgansiz.",
    };
  }

  await prisma.classMember.create({
    data: {
      classId: classRoom.id,
      studentId: student.id,
    },
  });

  revalidatePath("/app");
  revalidatePath("/app/classes");

  return {
    status: "success",
    message: `Classga qo'shildingiz: ${classRoom.title}`,
  };
}
