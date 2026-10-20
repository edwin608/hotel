
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const MONGO_URI = "mongodb://edwinmoses:EdwinTce123@ac-eel1v7j-shard-00-00.cnxnw6l.mongodb.net:27017,ac-eel1v7j-shard-00-01.cnxnw6l.mongodb.net:27017,ac-eel1v7j-shard-00-02.cnxnw6l.mongodb.net:27017/?ssl=true&replicaSet=atlas-xe9b91-shard-0&authSource=admin";

mongoose.connect(MONGO_URI)
    .then(() => console.log("MongoDB Atlas Connected"))
    .catch(err => console.error("MongoDB Error:", err.message));

const roomSchema = new mongoose.Schema({
    roomNumber: { type: String, required: true, unique: true },
    roomType: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    available: { type: Boolean, default: true }
});

const Room = mongoose.model("Room", roomSchema);

const bookingSchema = new mongoose.Schema({
    guestName: { type: String, required: true },
    guestPhone: { type: String, required: true },
    roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Room",
        required: true
    },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    status: {
        type: String,
        enum: ["Booked", "Checked Out", "Cancelled"],
        default: "Booked"
    }
});

const Booking = mongoose.model("Booking", bookingSchema);

app.get("/", (req, res) => {
    res.send("Hotel Management API is running");
});


app.post("/rooms", async (req, res) => {
    try {
        const room = await Room.create(req.body);
        res.status(201).json(room);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.get("/rooms", async (req, res) => {
    try {
        const rooms = await Room.find().sort({ roomNumber: 1 });
        res.json(rooms);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete("/rooms/:id", async (req, res) => {
    try {
        const activeBooking = await Booking.findOne({
            roomId: req.params.id,
            status: "Booked"
        });

        if (activeBooking) {
            return res.status(400).json({
                error: "Cannot delete a room with an active booking"
            });
        }

        const room = await Room.findByIdAndDelete(req.params.id);

        if (!room) {
            return res.status(404).json({ error: "Room not found" });
        }

        res.json({ message: "Room deleted successfully" });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post("/bookings", async (req, res) => {
    try {
        const { guestName, guestPhone, roomId, checkIn, checkOut } = req.body;

        if (!guestName || !guestPhone || !roomId || !checkIn || !checkOut) {
            return res.status(400).json({
                error: "Please provide all booking details"
            });
        }

        const start = new Date(checkIn);
        const end = new Date(checkOut);

        if (Number.isNaN(start.getTime()) ||
            Number.isNaN(end.getTime()) || end <= start) {
            return res.status(400).json({
                error: "Check-out must be after check-in"
            });
        }

        const room = await Room.findById(roomId);

        if (!room) {
            return res.status(404).json({ error: "Room not found" });
        }

        if (!room.available) {
            return res.status(400).json({
                error: "Room is not available"
            });
        }

        const booking = await Booking.create({
            guestName,
            guestPhone,
            roomId,
            checkIn: start,
            checkOut: end
        });

        room.available = false;
        await room.save();

        res.status(201).json(booking);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.get("/bookings", async (req, res) => {
    try {
        const bookings = await Booking.find()
            .populate("roomId", "roomNumber roomType price")
            .sort({ checkIn: -1 });

        res.json(bookings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch("/bookings/:id/checkout", async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ error: "Booking not found" });
        }

        if (booking.status !== "Booked") {
            return res.status(400).json({
                error: "Booking is not active"
            });
        }

        booking.status = "Checked Out";
        await booking.save();

        const anotherActiveBooking = await Booking.findOne({
            roomId: booking.roomId,
            status: "Booked"
        });

        if (!anotherActiveBooking) {
            await Room.findByIdAndUpdate(booking.roomId, {
                available: true
            });
        }

        res.json({ message: "Guest checked out successfully", booking });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.listen(5000, () => {
    console.log("Hotel server running on port 5000");
});
