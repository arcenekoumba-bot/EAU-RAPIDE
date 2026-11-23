import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";



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
    livreurs: publicProcedure.query(() => []),
    estimate: publicProcedure.input(z.object({ unitPrice: z.number(), quantity: z.number().int().min(1) })).query(({ input }) => ({
      subtotal: input.unitPrice * input.quantity,
      deliveryFee: 1000,
      total: input.unitPrice * input.quantity + 1000,
      paymentMethod: "Paiement à la livraison",
    })),
  }),
});

export type AppRouter = typeof appRouter;
