"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.demoStore = exports.DemoStore = exports.demoUsers = void 0;
const node_crypto_1 = require("node:crypto");
exports.demoUsers = [
    { id: "u-patient", name: "Maya Patel", role: "patient", clinic: "Harbor Community Clinic", initials: "MP" },
    { id: "u-caregiver", name: "Arjun Patel", role: "caregiver", clinic: "Harbor Community Clinic", initials: "AP" },
    { id: "u-clinician", name: "Dr. Elena Ruiz", role: "clinician", clinic: "Harbor Community Clinic", initials: "ER" },
    { id: "u-admin", name: "Morgan Chen", role: "administrator", clinic: "Harbor Community Clinic", initials: "MC" },
    { id: "u-donor", name: "Jordan Lee", role: "donor", clinic: "Harbor Community Clinic", initials: "JL" }
];
const today = new Date();
const inDays = (days) => {
    const date = new Date(today);
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
class DemoStore {
    appointments = [
        { id: "apt-1", patientId: "u-patient", patientName: "Maya Patel", clinician: "Dr. Elena Ruiz", type: "Primary care follow-up", date: inDays(2), time: "10:30 AM", status: "confirmed" },
        { id: "apt-2", patientId: "u-patient", patientName: "Maya Patel", clinician: "Care team", type: "Virtual check-in", date: inDays(8), time: "2:00 PM", status: "requested" }
    ];
    medications = [];
    deviceReadings = [];
    records = [
        { id: "rec-1", patientId: "u-patient", title: "Annual wellness visit", category: "Visit summary", date: inDays(-5), fileAvailable: false },
        { id: "rec-2", patientId: "u-patient", title: "Blood panel results", category: "Test results", date: inDays(-12), fileAvailable: false }
    ];
    messages = [
        { id: "msg-1", patientId: "u-patient", from: "Dr. Elena Ruiz", role: "clinician", text: "Your visit summary is ready. Please message us if you have questions.", date: inDays(-1) }
    ];
    catalog = [
        { id: "cat-1", name: "Saline nasal spray · sample", detail: "Fictional catalog listing · not a treatment recommendation", priceLabel: "$6 demo", demoOnly: true },
        { id: "cat-2", name: "Oral rehydration solution · sample", detail: "Demo listing only · ask a clinician or pharmacist about individual needs", priceLabel: "$8 demo", demoOnly: true },
        { id: "cat-3", name: "Basic pain-relief tablets · sample", detail: "No dosage guidance · follow clinician and product-label directions", priceLabel: "$5 demo", demoOnly: true }
    ];
    requests = [
        { id: "req-1", bloodType: "O+", area: "Hyderabad", units: 2, urgency: "Urgent", clinic: "Harbor Community Clinic" },
        { id: "req-2", bloodType: "A-", area: "Central Harbor", units: 1, urgency: "Routine", clinic: "Harbor Community Clinic" }
    ];
    donors = [{
            userId: "u-donor", name: "Jordan Lee", phone: "", bloodType: "O+", area: "Hyderabad, Hyderabad, Telangana, INDIA",
            country: "INDIA", state: "Telangana", district: "Hyderabad", city: "Hyderabad", available: true
        }];
    education = [
        { id: "edu-1", title: "Everyday hydration", summary: "General information on maintaining regular fluid intake. Individual needs vary; ask your care team for advice specific to you.", reviewStatus: "sample-not-reviewed", updated: "Demo content · clinical review required" },
        { id: "edu-2", title: "Fever: general information", summary: "Fever can have many causes, and this demo cannot assess the cause. Rest, drink fluids if appropriate for you, and contact a qualified healthcare professional if symptoms are severe, worsening, persistent, or concerning. Trouble breathing, confusion, loss of consciousness, severe dehydration, or another emergency needs immediate help. A baby under 3 months with a fever needs prompt medical advice.", reviewStatus: "sample-not-reviewed", updated: "Demo content · clinical review required" },
        { id: "edu-3", title: "Hand pain: general information", summary: "Hand pain can have many causes, and this demo cannot determine why it is happening. Avoid activities that worsen it and seek advice from a qualified healthcare professional if it persists, worsens, or concerns you. Prompt assessment is important after an injury or with severe pain, deformity, numbness, weakness, difficulty moving the fingers, marked swelling or redness, or fever.", reviewStatus: "sample-not-reviewed", updated: "Demo content · clinical review required" },
        { id: "edu-4", title: "When to seek urgent help", summary: "For severe difficulty breathing, loss of consciousness, uncontrolled bleeding, or another immediate emergency, contact local emergency services now.", reviewStatus: "sample-not-reviewed", updated: "Demo content · clinical review required" }
    ];
    users = exports.demoUsers;
    addAppointment(data, patientName) {
        const appointment = { ...data, id: `apt-${(0, node_crypto_1.randomUUID)()}`, patientName, status: "requested" };
        this.appointments.unshift(appointment);
        return appointment;
    }
    addMessage(patientId, from, role, text) {
        const message = { id: `msg-${(0, node_crypto_1.randomUUID)()}`, patientId, from, role, text, date: inDays(0) };
        this.messages.unshift(message);
        return message;
    }
    addMedication(input, prescribedBy) {
        const medication = { ...input, prescribedBy, id: `med-${(0, node_crypto_1.randomUUID)()}`, clinicianReviewed: true };
        this.medications.unshift(medication);
        return medication;
    }
    addRecord(input) {
        const record = { ...input, id: `rec-${(0, node_crypto_1.randomUUID)()}`, fileAvailable: false };
        this.records.unshift(record);
        return record;
    }
    addDeviceReading(input) {
        const reading = { ...input, id: `device-${(0, node_crypto_1.randomUUID)()}` };
        this.deviceReadings.unshift(reading);
        return reading;
    }
    addBloodRequest(data) {
        const request = { ...data, id: `req-${(0, node_crypto_1.randomUUID)()}`, clinic: "Harbor Community Clinic" };
        this.requests.unshift(request);
        return request;
    }
}
exports.DemoStore = DemoStore;
exports.demoStore = new DemoStore();
