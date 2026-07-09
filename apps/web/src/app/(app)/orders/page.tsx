import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import type { Order } from "@/lib/api";
import { OrdersListClient } from "./orders-list-client";

export default async function OrdersPage() {
  const session = await auth();
  if (!session) redirect("/login");

  let initialOrders: Array<Order & { person: { name: string } }> = [];
  let initialTotal = 0;

  try {
    const res = await api.getOrders(session.accessToken, {
      page: 1,
      limit: 20,
      sortBy: "placedAt",
      sortOrder: "desc",
    });
    initialOrders = res.data;
    initialTotal = res.meta.total;
  } catch {
    // Graceful degradation — client component shows empty state
  }

  return <OrdersListClient initialOrders={initialOrders} initialTotal={initialTotal} />;
}
