import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Add a spot to favorites
export const addSpotFavorite = mutation({
  args: {
    userId: v.id("users"),
    spotId: v.string(),
    spotName: v.string(),
    spotDescription: v.optional(v.string()),
    spotLocation: v.object({
      latitude: v.number(),
      longitude: v.number(),
    }),
    spotImageUrl: v.optional(v.string()),
    spotCongestionLevel: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if already favorited
    const existing = await ctx.db
      .query("favorites")
      .withIndex("by_userId_spotId", (q) =>
        q.eq("userId", args.userId).eq("spotId", args.spotId)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("favorites", {
      userId: args.userId,
      type: "spot",
      spotId: args.spotId,
      spotName: args.spotName,
      spotDescription: args.spotDescription,
      spotLocation: args.spotLocation,
      spotImageUrl: args.spotImageUrl,
      spotCongestionLevel: args.spotCongestionLevel,
      note: args.note,
      createdAt: Date.now(),
    });
  },
});

// Add a route to favorites
export const addRouteFavorite = mutation({
  args: {
    userId: v.id("users"),
    routeOriginName: v.string(),
    routeOriginCoords: v.object({
      latitude: v.number(),
      longitude: v.number(),
    }),
    routeDestinationName: v.string(),
    routeDestinationCoords: v.object({
      latitude: v.number(),
      longitude: v.number(),
    }),
    routeTitle: v.string(),
    routeDuration: v.string(),
    routeCost: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("favorites", {
      userId: args.userId,
      type: "route",
      routeOriginName: args.routeOriginName,
      routeOriginCoords: args.routeOriginCoords,
      routeDestinationName: args.routeDestinationName,
      routeDestinationCoords: args.routeDestinationCoords,
      routeTitle: args.routeTitle,
      routeDuration: args.routeDuration,
      routeCost: args.routeCost,
      note: args.note,
      createdAt: Date.now(),
    });
  },
});

// Remove from favorites
export const removeFavorite = mutation({
  args: { favoriteId: v.id("favorites") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.favoriteId);
  },
});

// Remove spot from favorites by spotId
export const removeSpotFavorite = mutation({
  args: {
    userId: v.id("users"),
    spotId: v.string(),
  },
  handler: async (ctx, args) => {
    const favorite = await ctx.db
      .query("favorites")
      .withIndex("by_userId_spotId", (q) =>
        q.eq("userId", args.userId).eq("spotId", args.spotId)
      )
      .first();

    if (favorite) {
      await ctx.db.delete(favorite._id);
    }
  },
});

// Get all favorites for a user
export const getUserFavorites = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("favorites")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Get spot favorites for a user
export const getSpotFavorites = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("favorites")
      .withIndex("by_userId_type", (q) =>
        q.eq("userId", args.userId).eq("type", "spot")
      )
      .order("desc")
      .collect();
  },
});

// Get route favorites for a user
export const getRouteFavorites = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("favorites")
      .withIndex("by_userId_type", (q) =>
        q.eq("userId", args.userId).eq("type", "route")
      )
      .order("desc")
      .collect();
  },
});

// Check if a spot is favorited
export const isSpotFavorited = query({
  args: {
    userId: v.id("users"),
    spotId: v.string(),
  },
  handler: async (ctx, args) => {
    const favorite = await ctx.db
      .query("favorites")
      .withIndex("by_userId_spotId", (q) =>
        q.eq("userId", args.userId).eq("spotId", args.spotId)
      )
      .first();

    return favorite !== null;
  },
});
