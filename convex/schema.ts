import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users table - synced from Clerk
  users: defineTable({
    clerkId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
    lastLoginAt: v.number(),
  }).index("by_clerkId", ["clerkId"]),

  // Favorites - spots and routes
  favorites: defineTable({
    userId: v.id("users"),
    type: v.string(), // "spot" | "route"

    // For spots
    spotId: v.optional(v.string()),
    spotName: v.optional(v.string()),
    spotDescription: v.optional(v.string()),
    spotLocation: v.optional(
      v.object({
        latitude: v.number(),
        longitude: v.number(),
      })
    ),
    spotImageUrl: v.optional(v.string()),
    spotCongestionLevel: v.optional(v.number()),

    // For routes
    routeOriginName: v.optional(v.string()),
    routeOriginCoords: v.optional(
      v.object({
        latitude: v.number(),
        longitude: v.number(),
      })
    ),
    routeDestinationName: v.optional(v.string()),
    routeDestinationCoords: v.optional(
      v.object({
        latitude: v.number(),
        longitude: v.number(),
      })
    ),
    routeTitle: v.optional(v.string()),
    routeDuration: v.optional(v.string()),
    routeCost: v.optional(v.string()),

    createdAt: v.number(),
    note: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_type", ["userId", "type"])
    .index("by_userId_spotId", ["userId", "spotId"]),

  // Route History - logged-in users only
  routeHistory: defineTable({
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
    transportMode: v.string(), // "WALKING" | "TRANSIT"
    navigatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_navigatedAt", ["userId", "navigatedAt"]),
});
