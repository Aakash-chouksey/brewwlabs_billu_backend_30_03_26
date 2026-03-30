/**
 * SOCKET SERVICE - Multi-tenant WebSocket Room Management
 * Standardized for scoping events by tenant businessId and outletId
 */

const { Server } = require("socket.io");

let io = null;

const socketService = {
    /**
     * Initialize Socket.io with the HTTP server
     */
    init: (server) => {
        io = new Server(server, {
            cors: {
                origin: "*", // Adjust origins in production if needed
                methods: ["GET", "POST"]
            }
        });

        io.on("connection", (socket) => {
            console.log(`🔌 New socket connection: ${socket.id}`);

            // Room-based join for outlet-specific events
            socket.on("join-outlet", (outletId) => {
                const roomName = `outlet:${outletId}`;
                socket.join(roomName);
                console.log(`📡 Socket ${socket.id} joined room: ${roomName}`);
            });

            // Enhanced multi-tenant join (businessId + outletId)
            socket.on("join-tenant-outlet", ({ businessId, outletId }) => {
                const roomName = `tenant:${businessId}:outlet:${outletId}`;
                socket.join(roomName);
                console.log(`📡 Socket ${socket.id} joined scoped room: ${roomName}`);
            });

            socket.on("disconnect", () => {
                console.log(`🔌 Socket disconnected: ${socket.id}`);
            });
        });

        return io;
    },

    /**
     * Get the IO instance
     */
    getIO: () => {
        if (!io) {
            throw new Error("Socket.io not initialized!");
        }
        return io;
    },

    /**
     * Emit specific event to an outlet's room
     */
    emitToOutlet: (outletId, event, data) => {
        if (!io) return;
        
        // Simple outlet room
        io.to(`outlet:${outletId}`).emit(event, data);
        
        // Scoped room fallback (if businessId unknown in this context)
        // Note: we mainly use outlet:ID for simplicity as IDs are UUID globally unique
        console.log(`📣 Emitted ${event} to outlet:${outletId}`);
    },

    /**
     * Emit to a strictly scoped tenant-outlet room
     */
    emitToTenantOutlet: (businessId, outletId, event, data) => {
        if (!io) return;
        const roomName = `tenant:${businessId}:outlet:${outletId}`;
        io.to(roomName).emit(event, data);
        console.log(`📣 Emitted ${event} to strictly scoped room: ${roomName}`);
    }
};

module.exports = socketService;
