"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_crypto_1 = require("node:crypto");
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const shared_1 = require("@health/shared");
const config_js_1 = require("./config.js");
const store_js_1 = require("./store.js");
const storage_js_1 = require("./storage.js");
const donor_data_js_1 = require("./donor-data.js");
const app = (0, express_1.default)();
app.disable("x-powered-by");
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: config_js_1.config.mode === "local"
        ? (origin, callback) => {
            if (!origin || /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(origin))
                return callback(null, true);
            return callback(null, false);
        }
        : config_js_1.config.allowedOrigin,
    credentials: true
}));
app.use(express_1.default.json({ limit: "64kb" }));
const roleTitles = {
    patient: "patient", caregiver: "caregiver", clinician: "clinician", administrator: "administrator", donor: "donor", volunteer: "volunteer"
};
const error = (res, status, message) => res.status(status).json({ error: "request_failed", message });
const aiProviderSettings = [
    config_js_1.config.azureOpenAiEndpoint,
    config_js_1.config.azureOpenAiKey,
    config_js_1.config.azureOpenAiDeployment
];
if (aiProviderSettings.some(Boolean) && !aiProviderSettings.every(Boolean)) {
    throw new Error("Configure AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and AZURE_OPENAI_DEPLOYMENT together.");
}
function authenticate(req, res, next) {
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer "))
        return error(res, 401, "Sign in is required.");
    const token = header.slice(7);
    try {
        const payload = jsonwebtoken_1.default.verify(token, config_js_1.config.jwtSecret, { algorithms: ["HS256"] });
        if (typeof payload === "string" || typeof payload.sub !== "string" || typeof payload.role !== "string" || !Object.hasOwn(roleTitles, payload.role)) {
            return error(res, 401, "Invalid access token.");
        }
        const name = typeof payload.name === "string" ? payload.name : "User";
        req.user = {
            id: payload.sub,
            name,
            role: payload.role,
            clinic: typeof payload.clinic === "string" ? payload.clinic : "Community donor network",
            initials: name.split(/\s+/).map((part) => part[0] ?? "").join("").slice(0, 2).toUpperCase(),
            ...(typeof payload.volunteerCode === "string" ? { volunteerCode: payload.volunteerCode } : {})
        };
        next();
    }
    catch {
        return error(res, 401, "Invalid or expired access token. Sign in again.");
    }
}
const allow = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role))
        return error(res, 403, "Your role cannot perform this action.");
    next();
};
const patientScope = (req, requestedId) => {
    if (req.user?.role === "administrator" || req.user?.role === "clinician")
        return true;
    if (req.user?.role === "caregiver")
        return requestedId === "u-patient";
    return req.user?.id === requestedId;
};
function accountToken(user) {
    if (!config_js_1.config.jwtSecret)
        throw new Error("JWT_SECRET is not configured.");
    return jsonwebtoken_1.default.sign({
        sub: user.id,
        name: user.name,
        role: user.role,
        clinic: user.clinic,
        ...(user.volunteerCode ? { volunteerCode: user.volunteerCode } : {})
    }, config_js_1.config.jwtSecret, { algorithm: "HS256", expiresIn: "12h" });
}
function accountUser(row) {
    if (!shared_1.roles.includes(row.role))
        throw new Error("The stored account has an unsupported role.");
    const name = row.full_name;
    return {
        id: row.id,
        name,
        role: row.role,
        clinic: "Community donor network",
        initials: name.split(/\s+/).map((part) => part[0] ?? "").join("").slice(0, 2).toUpperCase(),
        ...(row.volunteer_code ? { volunteerCode: row.volunteer_code } : {})
    };
}
async function passwordHash(password, salt = (0, node_crypto_1.randomBytes)(16)) {
    const derived = await derivePassword(password, salt, 64);
    return `scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}
function derivePassword(password, salt, length) {
    return new Promise((resolve, reject) => {
        (0, node_crypto_1.scrypt)(password, salt, length, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (reason, key) => {
            if (reason)
                reject(reason);
            else
                resolve(key);
        });
    });
}
function isUniqueConstraintError(reason) {
    if (typeof reason !== "object" || reason === null)
        return false;
    if (!("code" in reason))
        return false;
    if (reason.code === "23505")
        return true;
    return reason.code === "ERR_SQLITE_ERROR" && "errcode" in reason && reason.errcode === 2067;
}
async function passwordMatches(password, stored) {
    const [algorithm, saltValue, expectedValue] = stored.split("$");
    if (algorithm !== "scrypt" || !saltValue || !expectedValue)
        return false;
    const salt = Buffer.from(saltValue, "base64url");
    const expected = Buffer.from(expectedValue, "base64url");
    const actual = await derivePassword(password, salt, expected.length);
    return actual.length === expected.length && (0, node_crypto_1.timingSafeEqual)(actual, expected);
}
function requireDatabase(res) {
    if (!storage_js_1.database) {
        error(res, 503, "PostgreSQL is not configured. For local sign-in, restart the API with APP_MODE=local; production requires DATABASE_URL and the database migration.");
        return null;
    }
    return storage_js_1.database;
}
async function activeBloodRequests() {
    if (storage_js_1.localDatabase) {
        const rows = storage_js_1.localDatabase.prepare(`SELECT id, blood_group, area, units, urgency, clinic, status
       FROM blood_requests WHERE status = 'active'
       ORDER BY (urgency = 'Urgent') DESC, created_at DESC LIMIT 100`).all();
        return rows.map((row) => ({
            id: row.id,
            bloodType: row.blood_group,
            area: row.area,
            units: row.units,
            urgency: row.urgency,
            clinic: row.clinic,
            status: row.status
        }));
    }
    if (!storage_js_1.database) {
        return store_js_1.demoStore.requests.map((request) => ({ ...request, status: "active" }));
    }
    const result = await storage_js_1.database.query(`SELECT id, blood_group, area, units, urgency, clinic, status
      FROM blood_requests WHERE status = 'active'
      ORDER BY (urgency = 'Urgent') DESC, created_at DESC LIMIT 100`);
    return result.rows.map((row) => ({
        id: row.id,
        bloodType: row.blood_group,
        area: row.area,
        units: row.units,
        urgency: row.urgency,
        clinic: row.clinic,
        status: row.status
    }));
}
app.get("/health", (_req, res) => res.json({ status: "ok", mode: config_js_1.config.mode, databaseConfigured: Boolean(storage_js_1.database || storage_js_1.localDatabase), region: process.env.AZURE_REGION ?? "undecided" }));
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.get("/api/public/blood-requests", async (_req, res) => {
    try {
        res.json({ data: await activeBloodRequests() });
    }
    catch (reason) {
        console.error("Could not load active blood requests:", reason instanceof Error ? reason.message : reason);
        error(res, 500, "Active blood requests are temporarily unavailable.");
    }
});
app.post("/api/auth/signup", async (req, res) => {
    const parsed = zod_1.z.object({
        name: zod_1.z.string().trim().min(2).max(100),
        email: zod_1.z.string().trim().email().max(254),
        password: zod_1.z.string().min(12).max(128),
        role: zod_1.z.enum(["patient", "donor", "volunteer"]),
        referralCode: zod_1.z.string().trim().max(32).optional().default("")
    }).safeParse(req.body);
    if (!parsed.success)
        return error(res, 400, "Enter your name, a valid email, a password with at least 12 characters, and an account type.");
    if (parsed.data.referralCode && parsed.data.role !== "volunteer")
        return error(res, 400, "Volunteer referral codes are only accepted for volunteer accounts.");
    const email = parsed.data.email.toLowerCase();
    try {
        if (storage_js_1.localDatabase) {
            let referrerId = null;
            if (parsed.data.referralCode) {
                const referral = storage_js_1.localDatabase.prepare("SELECT id FROM accounts WHERE role = 'volunteer' AND volunteer_code = ?").get(parsed.data.referralCode.toUpperCase());
                if (!referral)
                    return error(res, 400, "That volunteer referral code is not valid.");
                referrerId = referral.id;
            }
            const id = (0, node_crypto_1.randomUUID)();
            const volunteerCode = parsed.data.role === "volunteer" ? `VOL-${(0, node_crypto_1.randomBytes)(6).toString("hex").toUpperCase()}` : null;
            const hash = await passwordHash(parsed.data.password);
            storage_js_1.localDatabase.prepare(`INSERT INTO accounts (id, email, full_name, password_hash, role, volunteer_code, referred_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, email, parsed.data.name, hash, parsed.data.role, volunteerCode, referrerId);
            const user = accountUser({ id, full_name: parsed.data.name, role: parsed.data.role, volunteer_code: volunteerCode });
            return res.status(201).json({ token: accountToken(user), user, mode: config_js_1.config.mode });
        }
        const db = requireDatabase(res);
        if (!db)
            return;
        let referrerId = null;
        if (parsed.data.referralCode) {
            const referral = await db.query("SELECT id FROM accounts WHERE role = 'volunteer' AND volunteer_code = $1", [parsed.data.referralCode.toUpperCase()]);
            const referrer = referral.rows[0];
            if (!referrer)
                return error(res, 400, "That volunteer referral code is not valid.");
            referrerId = referrer.id;
        }
        const id = (0, node_crypto_1.randomUUID)();
        const volunteerCode = parsed.data.role === "volunteer" ? `VOL-${(0, node_crypto_1.randomBytes)(6).toString("hex").toUpperCase()}` : null;
        const hash = await passwordHash(parsed.data.password);
        const result = await db.query(`INSERT INTO accounts (id, email, full_name, password_hash, role, volunteer_code, referred_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, full_name, role, volunteer_code`, [id, email, parsed.data.name, hash, parsed.data.role, volunteerCode, referrerId]);
        const row = result.rows[0];
        if (!row)
            throw new Error("Account registration did not return the new account.");
        const user = accountUser(row);
        res.status(201).json({ token: accountToken(user), user, mode: config_js_1.config.mode });
    }
    catch (reason) {
        if (isUniqueConstraintError(reason)) {
            return error(res, 409, "An account with that email already exists.");
        }
        console.error("Account registration failed:", reason instanceof Error ? reason.message : reason);
        error(res, 500, "Account registration failed. Please try again later.");
    }
});
app.post("/api/auth/login", async (req, res) => {
    const parsed = zod_1.z.object({ email: zod_1.z.string().trim().email().max(254), password: zod_1.z.string().min(1).max(128) }).safeParse(req.body);
    if (!parsed.success)
        return error(res, 400, "Enter your email and password.");
    try {
        if (storage_js_1.localDatabase) {
            const row = storage_js_1.localDatabase.prepare("SELECT id, full_name, role, volunteer_code, password_hash FROM accounts WHERE email = ?").get(parsed.data.email.toLowerCase());
            if (!row || !(await passwordMatches(parsed.data.password, row.password_hash))) {
                return error(res, 401, "Email or password is incorrect.");
            }
            const user = accountUser(row);
            return res.json({ token: accountToken(user), user, mode: config_js_1.config.mode });
        }
        const db = requireDatabase(res);
        if (!db)
            return;
        const result = await db.query("SELECT id, full_name, role, volunteer_code, password_hash FROM accounts WHERE email = $1", [parsed.data.email.toLowerCase()]);
        const row = result.rows[0];
        if (!row || !(await passwordMatches(parsed.data.password, row.password_hash))) {
            return error(res, 401, "Email or password is incorrect.");
        }
        const user = accountUser(row);
        res.json({ token: accountToken(user), user, mode: config_js_1.config.mode });
    }
    catch (reason) {
        console.error("Account sign-in failed:", reason instanceof Error ? reason.message : reason);
        error(res, 500, "Sign-in is temporarily unavailable.");
    }
});
app.use("/api", authenticate);
app.use("/api", (_req, res, next) => {
    if (config_js_1.config.mode === "production" && ![
        "/me",
        "/donors/profile",
        "/donors/matches",
        "/blood-requests",
        "/volunteers/referral-code"
    ].includes(_req.path)) {
        return error(res, 503, "This workflow is not connected to production storage.");
    }
    next();
});
app.get("/api/me", (req, res) => res.json({ user: req.user, mode: config_js_1.config.mode }));
app.get("/api/appointments", (req, res) => {
    if (storage_js_1.localDatabase) {
        try {
            const rows = storage_js_1.localDatabase.prepare(`SELECT id, patient_id, patient_name, clinician, type, hospital, hospital_phone,
                appointment_date, appointment_time, status
         FROM appointments WHERE patient_id = ? ORDER BY appointment_date, created_at DESC`).all(req.user.id);
            return res.json({ data: rows.map((row) => ({
                    id: row.id, patientId: row.patient_id, patientName: row.patient_name, clinician: row.clinician,
                    type: row.type, hospital: row.hospital, ...(row.hospital_phone ? { hospitalPhone: row.hospital_phone } : {}),
                    date: row.appointment_date, time: row.appointment_time, status: row.status
                })) });
        }
        catch (reason) {
            console.error("Could not load local appointment requests:", reason instanceof Error ? reason.message : reason);
            return error(res, 500, "Appointment requests are temporarily unavailable.");
        }
    }
    res.json({ data: store_js_1.demoStore.appointments.filter((item) => patientScope(req, item.patientId)) });
});
app.post("/api/appointments", (req, res) => {
    if (!["patient", "caregiver", "administrator"].includes(req.user.role))
        return error(res, 403, "Your role cannot request appointments.");
    const parsed = zod_1.z.object({
        date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: zod_1.z.string().min(1).max(40),
        type: zod_1.z.string().min(2).max(100),
        hospital: zod_1.z.string().trim().min(2).max(160),
        hospitalPhone: zod_1.z.string().trim().max(40).optional()
    }).safeParse(req.body);
    if (!parsed.success)
        return error(res, 400, "Provide an appointment type, date, and time.");
    if (parsed.data.hospitalPhone && !/^[+0-9\s().-]{5,40}$/.test(parsed.data.hospitalPhone)) {
        return error(res, 400, "The hospital phone number is invalid.");
    }
    if (storage_js_1.localDatabase) {
        try {
            const id = `apt-${(0, node_crypto_1.randomUUID)()}`;
            const clinician = "Hospital confirmation pending";
            storage_js_1.localDatabase.prepare(`INSERT INTO appointments
           (id, patient_id, patient_name, clinician, type, hospital, hospital_phone, appointment_date, appointment_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, req.user.id, req.user.name, clinician, parsed.data.type, parsed.data.hospital, parsed.data.hospitalPhone ?? null, parsed.data.date, parsed.data.time);
            return res.status(201).json({ data: {
                    id, patientId: req.user.id, patientName: req.user.name, clinician, type: parsed.data.type,
                    hospital: parsed.data.hospital, ...(parsed.data.hospitalPhone ? { hospitalPhone: parsed.data.hospitalPhone } : {}),
                    date: parsed.data.date, time: parsed.data.time, status: "requested"
                } });
        }
        catch (reason) {
            console.error("Could not save local appointment request:", reason instanceof Error ? reason.message : reason);
            return error(res, 500, "Appointment request could not be saved.");
        }
    }
    const patientId = req.user.role === "caregiver" ? "u-patient" : req.user.id;
    const patientName = store_js_1.demoUsers.find((u) => u.id === patientId)?.name ?? req.user.name;
    res.status(201).json({ data: store_js_1.demoStore.addAppointment({ ...parsed.data, patientId, clinician: "Care team" }, patientName) });
});
app.get("/api/medications", (req, res) => {
    res.json({ data: store_js_1.demoStore.medications.filter((item) => patientScope(req, item.patientId)) });
});
app.post("/api/medications", allow("clinician", "administrator"), (req, res) => {
    const parsed = zod_1.z.object({
        patientId: zod_1.z.string().min(1),
        name: zod_1.z.string().trim().min(2).max(100),
        dose: zod_1.z.string().trim().min(1).max(80),
        frequency: zod_1.z.string().trim().min(2).max(80),
        quantity: zod_1.z.number().int().min(1).max(10000),
        instructions: zod_1.z.string().trim().min(2).max(200),
        reminder: zod_1.z.string().trim().min(2).max(80)
    }).safeParse(req.body);
    if (!parsed.success)
        return error(res, 400, "Provide the patient and clinician-supplied medication, dose, frequency, quantity, instructions, and schedule.");
    const patient = store_js_1.demoUsers.find((candidate) => candidate.id === parsed.data.patientId && candidate.role === "patient");
    if (!patient || !patientScope(req, patient.id))
        return error(res, 403, "You cannot add a medication for this patient.");
    res.status(201).json({ data: store_js_1.demoStore.addMedication(parsed.data, req.user.name) });
});
app.get("/api/records", (req, res) => {
    res.json({ data: store_js_1.demoStore.records.filter((item) => patientScope(req, item.patientId)) });
});
app.post("/api/records", (req, res) => {
    if (!["patient", "caregiver", "clinician", "administrator"].includes(req.user.role))
        return error(res, 403, "Your role cannot add a health-record summary.");
    const parsed = zod_1.z.object({
        title: zod_1.z.string().trim().min(2).max(120),
        category: zod_1.z.string().trim().min(2).max(80),
        date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        source: zod_1.z.string().trim().min(2).max(120),
        summary: zod_1.z.string().trim().max(500).optional().default("")
    }).safeParse(req.body);
    if (!parsed.success)
        return error(res, 400, "Provide a report title, lab/source, and valid date.");
    const patientId = ["clinician", "administrator"].includes(req.user.role) && typeof req.body.patientId === "string"
        ? req.body.patientId
        : req.user.role === "caregiver" ? "u-patient" : req.user.id;
    if (!store_js_1.demoUsers.some((candidate) => candidate.id === patientId && candidate.role === "patient"))
        return error(res, 400, "Choose a patient profile for this demo report.");
    if (!patientScope(req, patientId))
        return error(res, 403, "You cannot add a record for this patient.");
    res.status(201).json({ data: store_js_1.demoStore.addRecord({ ...parsed.data, patientId }) });
});
app.get("/api/device-readings", (req, res) => {
    res.json({ data: store_js_1.demoStore.deviceReadings.filter((item) => patientScope(req, item.patientId)) });
});
app.post("/api/device-readings", (req, res) => {
    if (!["patient", "caregiver", "clinician", "administrator"].includes(req.user.role))
        return error(res, 403, "Your role cannot add a device reading.");
    const parsed = zod_1.z.object({
        patientId: zod_1.z.string().min(1).optional(),
        device: zod_1.z.string().trim().min(2).max(80),
        measurement: zod_1.z.string().trim().min(2).max(80),
        value: zod_1.z.number().finite().min(0).max(100000000),
        unit: zod_1.z.string().trim().min(1).max(30),
        recordedAt: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
    }).safeParse(req.body);
    if (!parsed.success)
        return error(res, 400, "Provide a device, measurement, non-negative value, unit, and valid date.");
    const patientId = parsed.data.patientId ?? (req.user.role === "caregiver" ? "u-patient" : req.user.id);
    if (!store_js_1.demoUsers.some((candidate) => candidate.id === patientId && candidate.role === "patient"))
        return error(res, 400, "Choose a patient profile for this demo device reading.");
    if (!patientScope(req, patientId))
        return error(res, 403, "You cannot add a device reading for this patient.");
    res.status(201).json({ data: store_js_1.demoStore.addDeviceReading({ ...parsed.data, patientId }) });
});
app.get("/api/messages", (req, res) => {
    const patientId = req.query.patientId?.toString() ?? (req.user.role === "clinician" || req.user.role === "administrator" || req.user.role === "caregiver"
        ? "u-patient"
        : req.user.id);
    if (!patientScope(req, patientId))
        return error(res, 403, "You cannot access this care-team conversation.");
    res.json({ data: store_js_1.demoStore.messages.filter((item) => item.patientId === patientId) });
});
app.post("/api/messages", (req, res) => {
    const parsed = zod_1.z.object({ text: zod_1.z.string().trim().min(2).max(1000), patientId: zod_1.z.string().optional() }).safeParse(req.body);
    if (!parsed.success)
        return error(res, 400, "Message must be between 2 and 1000 characters.");
    const patientId = parsed.data.patientId ?? (req.user.role === "clinician" || req.user.role === "administrator" ? "u-patient" : req.user.id);
    if (!patientScope(req, patientId))
        return error(res, 403, "You cannot message for this patient.");
    res.status(201).json({ data: store_js_1.demoStore.addMessage(patientId, req.user.name, req.user.role, parsed.data.text) });
});
app.get("/api/assistant/status", (_req, res) => {
    res.json({ provider: config_js_1.config.azureOpenAiEndpoint ? "Azure OpenAI" : "Scripted demo" });
});
app.post("/api/assistant/chat", async (req, res) => {
    const parsed = zod_1.z.object({
        message: zod_1.z.string().trim().min(1).max(1000),
        history: zod_1.z.array(zod_1.z.object({
            role: zod_1.z.enum(["user", "assistant"]),
            content: zod_1.z.string().min(1).max(1000)
        })).max(8).optional().default([])
    }).safeParse(req.body);
    if (!parsed.success)
        return error(res, 400, "Send a message of up to 1000 characters.");
    const emergencyPattern = /\b(chest pain|can't breathe|cannot breathe|trouble breathing|difficulty breathing|unconscious|not waking|severe bleeding|suicid(?:e|al)|self.harm|overdose)\b/i;
    const urgentReply = "This may need urgent attention. Contact your local emergency services or go to the nearest emergency department now. Do not wait for a chatbot reply. This service is not monitored for emergencies.";
    if (emergencyPattern.test(parsed.data.message)) {
        return res.json({ reply: urgentReply, provider: "safety guidance" });
    }
    const medicationPattern = /\b(dosage|dose|how many pills|how much .* medicine|should i take|stop taking|change my medication|prescription)\b/i;
    if (medicationPattern.test(parsed.data.message)) {
        return res.json({
            reply: "I can't recommend a medicine, dose, or change to a prescribed treatment. Please ask your clinician or pharmacist, who can consider your individual health and current medicines. If this may be an emergency, contact local emergency services.",
            provider: "safety guidance"
        });
    }
    const demoReply = "I can offer general health information, but I can't diagnose a condition or decide what treatment is right for you. For symptoms that are severe, worsening, persistent, or worrying, contact a qualified healthcare professional. What general information can I help you find?";
    if (!config_js_1.config.azureOpenAiEndpoint || !config_js_1.config.azureOpenAiKey || !config_js_1.config.azureOpenAiDeployment) {
        return res.json({ reply: demoReply, provider: "scripted demo" });
    }
    const endpoint = config_js_1.config.azureOpenAiEndpoint.replace(/\/+$/, "");
    const url = `${endpoint}/openai/deployments/${encodeURIComponent(config_js_1.config.azureOpenAiDeployment)}/chat/completions?api-version=${encodeURIComponent(config_js_1.config.azureOpenAiApiVersion)}`;
    let upstream;
    try {
        upstream = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "api-key": config_js_1.config.azureOpenAiKey },
            signal: AbortSignal.timeout(15000),
            body: JSON.stringify({
                temperature: 0.2,
                max_tokens: 300,
                messages: [
                    {
                        role: "system",
                        content: "You are Harbor Health's general health information assistant, not a clinician. Provide brief, empathetic, general educational information only. Never diagnose, estimate the likelihood of a condition, prescribe or recommend medication/dosage, or claim to review patient records. For personal treatment or medication decisions, direct the user to a licensed clinician or pharmacist. If the user describes an emergency, severe symptoms, trouble breathing, chest pain, loss of consciousness, severe bleeding, overdose, or self-harm, tell them to contact local emergency services or go to an emergency department now; do not continue ordinary advice. Ask users not to share identifying or private medical information. Do not claim that anyone is monitoring this chat."
                    },
                    ...parsed.data.history.map(({ role, content }) => ({ role, content })),
                    { role: "user", content: parsed.data.message }
                ]
            })
        });
    }
    catch {
        return error(res, 502, "The AI assistant is temporarily unavailable. Please try again later or contact your care team.");
    }
    if (!upstream.ok) {
        return error(res, 502, "The AI assistant is temporarily unavailable. Please try again later or contact your care team.");
    }
    let result;
    try {
        result = await upstream.json();
    }
    catch {
        return error(res, 502, "The AI assistant returned an unreadable response. Please try again later.");
    }
    const reply = result.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
        return error(res, 502, "The AI assistant returned an unreadable response. Please try again later.");
    }
    return res.json({ reply: reply.trim().slice(0, 3000), provider: "Azure OpenAI" });
});
app.get("/api/admin/users", allow("administrator"), (_req, res) => res.json({ data: store_js_1.demoStore.users }));
app.get("/api/volunteers/referral-code", allow("volunteer"), (req, res) => {
    res.json({ code: req.user.volunteerCode ?? null });
});
app.get("/api/catalog", (_req, res) => res.json({ data: store_js_1.demoStore.catalog, checkout: "demo-only" }));
app.post("/api/checkout", allow("patient", "caregiver"), (req, res) => {
    const parsed = zod_1.z.object({ itemId: zod_1.z.string(), quantity: zod_1.z.number().int().min(1).max(10) }).safeParse(req.body);
    if (!parsed.success || !store_js_1.demoStore.catalog.some((item) => item.id === parsed.data.itemId))
        return error(res, 400, "Choose a catalog item and valid quantity.");
    res.status(201).json({ message: "Demo checkout complete. No order was placed and no payment was collected.", transaction: "DEMO ONLY" });
});
app.get("/api/donors/matches", allow("clinician", "administrator", "donor", "volunteer"), async (req, res) => {
    const area = req.query.area?.toString().toLowerCase();
    const bloodType = req.query.bloodType?.toString();
    if (storage_js_1.localDatabase) {
        try {
            const rows = storage_js_1.localDatabase.prepare(`SELECT blood_group, city, district, state, country FROM donor_profiles
         WHERE available = 1
           AND (? IS NULL OR lower(blood_group) = lower(?))
           AND (? IS NULL OR lower(city || ', ' || district || ', ' || state || ', ' || country) LIKE '%' || ? || '%')
         ORDER BY created_at DESC LIMIT 100`).all(bloodType ?? null, bloodType ?? null, area ?? null, area ?? null);
            return res.json({
                data: rows.map((row, index) => ({
                    donorId: `anonymous-${index + 1}`,
                    bloodType: row.blood_group,
                    area: [row.city, row.district, row.state, row.country].filter(Boolean).join(", ")
                }))
            });
        }
        catch (reason) {
            console.error("Could not load donor matches:", reason instanceof Error ? reason.message : reason);
            return error(res, 500, "Donor availability is temporarily unavailable.");
        }
    }
    if (config_js_1.config.mode === "production") {
        const db = requireDatabase(res);
        if (!db)
            return;
        try {
            const result = await db.query(`SELECT blood_group, city, district, state, country FROM donor_profiles
         WHERE available = true
           AND ($1::text IS NULL OR lower(blood_group) = lower($1))
           AND ($2::text IS NULL OR lower(concat_ws(', ', city, district, state, country)) LIKE '%' || $2 || '%')
         ORDER BY created_at DESC LIMIT 100`, [bloodType ?? null, area ?? null]);
            return res.json({
                data: result.rows.map((row, index) => ({
                    donorId: `anonymous-${index + 1}`,
                    bloodType: row.blood_group,
                    area: [row.city, row.district, row.state, row.country].filter(Boolean).join(", ")
                }))
            });
        }
        catch (reason) {
            console.error("Could not load donor matches:", reason instanceof Error ? reason.message : reason);
            return error(res, 500, "Donor availability is temporarily unavailable.");
        }
    }
    const matches = store_js_1.demoStore.donors.filter((donor) => donor.available && (!area || donor.area.toLowerCase().includes(area)) && (!bloodType || donor.bloodType === bloodType));
    res.json({ data: matches.map(({ userId, bloodType: type, area: donorArea }) => ({ donorId: userId, bloodType: type, area: donorArea })) });
});
app.get("/api/donors/profile", allow("donor"), (req, res) => {
    if (storage_js_1.localDatabase) {
        try {
            const row = storage_js_1.localDatabase.prepare(`SELECT dp.user_id, a.full_name, dp.phone_ciphertext, dp.phone_iv, dp.phone_auth_tag,
                dp.blood_group, dp.country, dp.state, dp.district, dp.city, dp.available, a.volunteer_code
         FROM donor_profiles dp JOIN accounts a ON a.id = dp.user_id WHERE dp.user_id = ?`).get(req.user.id);
            if (!row)
                return res.json({ data: null });
            return res.json({
                data: {
                    userId: row.user_id, name: row.full_name,
                    phone: (0, donor_data_js_1.decryptDonorPhone)(row.phone_ciphertext, row.phone_iv, row.phone_auth_tag),
                    bloodType: row.blood_group,
                    area: `${row.city}, ${row.district}, ${row.state}, ${row.country}`,
                    country: row.country, state: row.state, district: row.district, city: row.city,
                    available: Boolean(row.available),
                    ...(row.volunteer_code ? { volunteerCode: row.volunteer_code } : {})
                }
            });
        }
        catch (reason) {
            console.error("Could not load donor profile:", reason instanceof Error ? reason.message : reason);
            return error(res, 500, "Donor profile is temporarily unavailable.");
        }
    }
    if (config_js_1.config.mode === "production") {
        const db = requireDatabase(res);
        if (!db)
            return;
        void db.query(`SELECT dp.user_id, a.full_name, dp.phone_ciphertext, dp.phone_iv, dp.phone_auth_tag,
              dp.blood_group, dp.country, dp.state, dp.district, dp.city, dp.available, a.volunteer_code
       FROM donor_profiles dp JOIN accounts a ON a.id = dp.user_id
       WHERE dp.user_id = $1`, [req.user.id]).then((result) => {
            const row = result.rows[0];
            if (!row)
                return res.json({ data: null });
            const phone = (0, donor_data_js_1.decryptDonorPhone)(row.phone_ciphertext, row.phone_iv, row.phone_auth_tag);
            return res.json({
                data: {
                    userId: row.user_id, name: row.full_name, phone, bloodType: row.blood_group,
                    area: `${row.city}, ${row.district}, ${row.state}, ${row.country}`,
                    country: row.country, state: row.state, district: row.district, city: row.city,
                    available: row.available,
                    ...(row.volunteer_code ? { volunteerCode: row.volunteer_code } : {})
                }
            });
        }).catch((reason) => {
            console.error("Could not load donor profile:", reason instanceof Error ? reason.message : reason);
            error(res, 500, "Donor profile is temporarily unavailable.");
        });
        return;
    }
    const profile = store_js_1.demoStore.donors.find((entry) => entry.userId === req.user.id);
    res.json({ data: profile ?? null });
});
app.post("/api/donors/profile", allow("donor"), async (req, res) => {
    const parsed = zod_1.z.object({
        name: zod_1.z.string().trim().min(2).max(100),
        phone: zod_1.z.string().trim().min(7).max(25).refine((value) => {
            const digits = value.replace(/\D/g, "");
            return /^\+?[0-9\s().-]+$/.test(value) && digits.length >= 7 && digits.length <= 15;
        }),
        bloodType: zod_1.z.enum(shared_1.bloodGroups),
        country: zod_1.z.string().min(2).max(80),
        state: zod_1.z.string().min(2).max(100),
        district: zod_1.z.string().min(2).max(100),
        city: zod_1.z.string().min(2).max(100),
        available: zod_1.z.boolean(),
        consent: zod_1.z.literal(true)
    }).safeParse(req.body);
    if (!parsed.success)
        return error(res, 400, "Enter your name, a valid phone number, blood group, country, state, district, and city.");
    const area = `${parsed.data.city}, ${parsed.data.district}, ${parsed.data.state}, ${parsed.data.country}`;
    if (storage_js_1.localDatabase) {
        const encryptedPhone = (0, donor_data_js_1.encryptDonorPhone)(parsed.data.phone);
        try {
            storage_js_1.localDatabase.exec("BEGIN");
            storage_js_1.localDatabase.prepare("UPDATE accounts SET full_name = ? WHERE id = ?").run(parsed.data.name, req.user.id);
            storage_js_1.localDatabase.prepare(`INSERT INTO donor_profiles
           (user_id, phone_ciphertext, phone_iv, phone_auth_tag, blood_group, country, state, district, city, available, consent_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
         ON CONFLICT (user_id) DO UPDATE SET
           phone_ciphertext = excluded.phone_ciphertext, phone_iv = excluded.phone_iv,
           phone_auth_tag = excluded.phone_auth_tag, blood_group = excluded.blood_group,
           country = excluded.country, state = excluded.state, district = excluded.district,
           city = excluded.city, available = excluded.available,
           consent_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`).run(req.user.id, encryptedPhone.phoneCiphertext, encryptedPhone.phoneIv, encryptedPhone.phoneAuthTag, parsed.data.bloodType, parsed.data.country, parsed.data.state, parsed.data.district, parsed.data.city, Number(parsed.data.available));
            storage_js_1.localDatabase.exec("COMMIT");
            const user = { ...req.user, name: parsed.data.name };
            return res.status(201).json({
                data: { userId: user.id, ...parsed.data, area, ...(user.volunteerCode ? { volunteerCode: user.volunteerCode } : {}) },
                token: accountToken(user)
            });
        }
        catch (reason) {
            storage_js_1.localDatabase.exec("ROLLBACK");
            console.error("Could not save local donor profile:", reason instanceof Error ? reason.message : reason);
            return error(res, 500, "Donor profile could not be saved.");
        }
    }
    if (config_js_1.config.mode === "production") {
        const db = requireDatabase(res);
        if (!db)
            return;
        const encryptedPhone = (0, donor_data_js_1.encryptDonorPhone)(parsed.data.phone);
        try {
            await db.query("UPDATE accounts SET full_name = $2 WHERE id = $1", [req.user.id, parsed.data.name]);
            await db.query(`INSERT INTO donor_profiles
           (user_id, phone_ciphertext, phone_iv, phone_auth_tag, blood_group, country, state, district, city, available, consent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
         ON CONFLICT (user_id) DO UPDATE SET
           phone_ciphertext = EXCLUDED.phone_ciphertext, phone_iv = EXCLUDED.phone_iv,
           phone_auth_tag = EXCLUDED.phone_auth_tag, blood_group = EXCLUDED.blood_group,
           country = EXCLUDED.country, state = EXCLUDED.state, district = EXCLUDED.district,
           city = EXCLUDED.city, available = EXCLUDED.available, consent_at = now(), updated_at = now()`, [req.user.id, encryptedPhone.phoneCiphertext, encryptedPhone.phoneIv, encryptedPhone.phoneAuthTag,
                parsed.data.bloodType, parsed.data.country, parsed.data.state, parsed.data.district, parsed.data.city, parsed.data.available]);
            const user = { ...req.user, name: parsed.data.name };
            return res.status(201).json({
                data: { userId: user.id, ...parsed.data, area, ...(user.volunteerCode ? { volunteerCode: user.volunteerCode } : {}) },
                token: accountToken(user)
            });
        }
        catch (reason) {
            console.error("Could not save donor profile:", reason instanceof Error ? reason.message : reason);
            return error(res, 500, "Donor profile could not be saved.");
        }
    }
    const profile = { userId: req.user.id, ...parsed.data, area };
    const previous = store_js_1.demoStore.donors.findIndex((entry) => entry.userId === req.user.id);
    if (previous >= 0)
        store_js_1.demoStore.donors[previous] = profile;
    else
        store_js_1.demoStore.donors.push(profile);
    res.status(201).json({ data: profile });
});
app.get("/api/blood-requests", async (req, res) => {
    if (storage_js_1.localDatabase) {
        try {
            return res.json({ data: await activeBloodRequests() });
        }
        catch (reason) {
            console.error("Could not load local blood requests:", reason instanceof Error ? reason.message : reason);
            return error(res, 500, "Active blood requests are temporarily unavailable.");
        }
    }
    if (config_js_1.config.mode === "production") {
        try {
            return res.json({ data: await activeBloodRequests() });
        }
        catch (reason) {
            console.error("Could not load blood requests:", reason instanceof Error ? reason.message : reason);
            return error(res, 500, "Active blood requests are temporarily unavailable.");
        }
    }
    if (req.user.role === "donor" || req.user.role === "patient")
        return res.json({ data: store_js_1.demoStore.requests.map(({ id, bloodType, area, units, urgency }) => ({ id, bloodType, area, units, urgency })) });
    res.json({ data: store_js_1.demoStore.requests });
});
app.post("/api/blood-requests", allow("patient", "clinician", "administrator", "volunteer"), async (req, res) => {
    const parsed = zod_1.z.object({ bloodType: zod_1.z.enum(shared_1.bloodGroups), area: zod_1.z.string().min(2).max(80), units: zod_1.z.number().int().min(1).max(20), urgency: zod_1.z.enum(["Routine", "Urgent"]) }).safeParse(req.body);
    if (!parsed.success)
        return error(res, 400, "Provide blood type, general area, units, and urgency.");
    if (storage_js_1.localDatabase) {
        if (req.user.role !== "patient" && req.user.role !== "volunteer")
            return error(res, 403, "Only recipients and registered volunteers can submit a request.");
        try {
            const id = (0, node_crypto_1.randomUUID)();
            storage_js_1.localDatabase.prepare(`INSERT INTO blood_requests (id, requester_id, blood_group, area, units, urgency, clinic)
         VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, req.user.id, parsed.data.bloodType, parsed.data.area, parsed.data.units, parsed.data.urgency, "Community donor network");
            return res.status(201).json({ data: {
                    id, bloodType: parsed.data.bloodType, area: parsed.data.area, units: parsed.data.units,
                    urgency: parsed.data.urgency, clinic: "Community donor network", status: "active"
                } });
        }
        catch (reason) {
            console.error("Could not save local blood request:", reason instanceof Error ? reason.message : reason);
            return error(res, 500, "Blood request could not be saved.");
        }
    }
    if (config_js_1.config.mode === "production") {
        if (req.user.role !== "patient" && req.user.role !== "volunteer")
            return error(res, 403, "Only recipients and registered volunteers can submit a request.");
        const db = requireDatabase(res);
        if (!db)
            return;
        try {
            const result = await db.query(`INSERT INTO blood_requests (id, requester_id, blood_group, area, units, urgency, clinic)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, blood_group, area, units, urgency, clinic, status`, [(0, node_crypto_1.randomUUID)(), req.user.id, parsed.data.bloodType, parsed.data.area, parsed.data.units, parsed.data.urgency, "Community donor network"]);
            const row = result.rows[0];
            if (!row)
                throw new Error("Blood request insert did not return the saved request.");
            return res.status(201).json({ data: {
                    id: row.id, bloodType: row.blood_group, area: row.area, units: row.units,
                    urgency: row.urgency, clinic: row.clinic, status: row.status
                } });
        }
        catch (reason) {
            console.error("Could not save blood request:", reason instanceof Error ? reason.message : reason);
            return error(res, 500, "Blood request could not be saved.");
        }
    }
    res.status(201).json({ data: store_js_1.demoStore.addBloodRequest(parsed.data) });
});
app.get("/api/education", (_req, res) => res.json({ data: store_js_1.demoStore.education, scope: "educational-only" }));
app.use((req, res) => error(res, 404, `No route for ${req.method} ${req.path}.`));
app.use((err, _req, res, _next) => {
    console.error("API request failed:", err.message);
    error(res, 500, "An unexpected server error occurred.");
});
app.listen(config_js_1.config.port, () => console.log(`Healthcare API listening on ${config_js_1.config.port} (${config_js_1.config.mode} mode)`));
