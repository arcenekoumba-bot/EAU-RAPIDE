import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

const demoLivreurs = [
  { id: "liv-001", name: "Michaël N.", zone: "Akanda · La Sablière", distance: 0.8, rating: 4.9, deliveries: 126, product: "Bidon 20 L", unitPrice: 2500, eta: "15–25 min", verified: true, phone: "+241 06 20 14 88" },
  { id: "liv-002", name: "Grâce Services", zone: "Av. Jean-Paul II", distance: 1.6, rating: 4.8, deliveries: 89, product: "Bidon 20 L", unitPrice: 2300, eta: "20–30 min", verified: true, phone: "+241 07 42 11 03" },
  { id: "liv-003", name: "Eau Claire Express", zone: "Angondjé · Centre", distance: 2.4, rating: 4.7, deliveries: 64, product: "Pack bouteilles", unitPrice: 4500, eta: "25–35 min", verified: true, phone: "+241 06 98 73 10" },
];

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  marketplace: router({
    livreurs: publicProcedure.query(() => demoLivreurs),
    estimate: publicProcedure.input(z.object({ unitPrice: z.number(), quantity: z.number().int().min(1) })).query(({ input }) => ({
      subtotal: input.unitPrice * input.quantity,
      deliveryFee: 1000,
      total: input.unitPrice * input.quantity + 1000,
      paymentMethod: "Paiement à la livraison",
    })),
  }),
});

export type AppRouter = typeof appRouter;
