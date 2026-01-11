import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Add a route to history after navigation
export const addRouteHistory = mutation({
  args: {
    userId: v.id("users"),
    originName: v.string(),
    originCoords: v.object({
      latitude: v.number(),
      longitude: v.number(),
    }),
    destinationSpotId: v.string(),
    destinationName: v.string(),
    destinationCoords: v.object({
      latitude: v.number(),
      longitude: v.number(),
    }),
    routeTitle: v.string(),
    duration: v.string(),
    cost: v.string(),
    transportMode: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("routeHistory", {
      userId: args.userId,
      originName: args.originName,
      originCoords: args.originCoords,
      destinationSpotId: args.destinationSpotId,
      destinationName: args.destinationName,
      destinationCoords: args.destinationCoords,
      routeTitle: args.routeTitle,
      duration: args.duration,
      cost: args.cost,
      transportMode: args.transportMode,
      navigatedAt: Date.now(),
    });
  },
});

// Mark route as completed (arrived at destination)
export const markRouteCompleted = mutation({
  args: { historyId: v.id("routeHistory") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.historyId, {
      completedAt: Date.now(),
    });
  },
});

// Get route history for a user (most recent first)
export const getUserRouteHistory = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("routeHistory")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Get recent route history (limited)
export const getRecentRouteHistory = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    return await ctx.db
      .query("routeHistory")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
  },
});

// Delete a route from history
export const deleteRouteHistory = mutation({
  args: { historyId: v.id("routeHistory") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.historyId);
  },
});

// Clear all route history for a user
export const clearRouteHistory = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const history = await ctx.db
      .query("routeHistory")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    for (const item of history) {
      await ctx.db.delete(item._id);
    }
  },
});
